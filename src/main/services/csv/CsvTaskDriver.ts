import { createReadStream, readFileSync, statSync } from 'node:fs'
import { mkdir, open, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import iconv from 'iconv-lite'
import { CSV_COLUMN_NAMES, csvPriorityToNumber, parseCsvInputArgs, type CsvTaskRow18 } from '@shared/schemas/csv-task-row'
import { CsvParser, type CsvMetadata, type CsvParseError } from './CsvParser'

export interface RuntimeCsvTaskRow {
  id: string
  group?: string
  tool: 'codex' | 'claude' | 'gemini' | 'cursor' | 'copilot'
  prompt: string
  cwd?: string
  skill?: string
  priority: number
  dependency?: string
  parallel_group?: string
  success_criteria?: string
  timeout_ms?: number
  retries: number
  env?: string
  tags?: string
  output_path?: string
  dry_run: boolean
  allow_inject: boolean
  permission_ttl_ms?: number
  on_fail?: 'next' | 'abort' | 'retry' | 'fallback-tool' | 'escalate-model' | 'human' | 'execute-skill'
  fallback_tool?: 'codex' | 'claude' | 'gemini' | 'cursor' | 'copilot'
  execute_skill?: string
  needs_bigger_model?: boolean
  notes?: string
}

export interface CsvDriverRow {
  rowIndex: number
  line: number
  raw: Record<string, string>
  row: CsvTaskRow18 | null
  runtimeRow: RuntimeCsvTaskRow | null
  rowState: 'valid' | 'invalid'
  errors: CsvParseError[]
}

export interface CsvFileGroup {
  groupId: string
  filePath: string
  rowCount: number
  validRowCount: number
  rows: CsvDriverRow[]
  errors: CsvParseError[]
  loadedAt: number
  fileMtime: number
  metadata: CsvMetadata
}

export interface CsvDriverState {
  groups: CsvFileGroup[]
  lastFullScanAt: number
  watchedDirs: string[]
}

type CsvFileEncoding = 'utf8' | 'utf16le' | 'gb18030'

interface CsvEncodingProbe {
  encoding: CsvFileEncoding
  skipBytes: number
}

interface CsvPromptSkillReferences {
  names: string[]
  errors: string[]
}

interface CsvPromptContext {
  cwd?: string
  file?: string
}

interface CsvPreparedPrompt {
  prompt: string
  errors: string[]
}

interface CsvFileValidationResult {
  ok: boolean
  message?: string
}

const SKILL_REFERENCE_PATTERN = /(?:^|\s)@skill:(\S*)/g
const SKILL_REFERENCE_NAME_PATTERN = /^[a-z0-9-]{1,60}$/
const PROMPT_FILE_REFERENCE_PATTERN = /(^|\s)@file:(\S*)/g
const CSV_PROMPT_FILE_REFERENCE_MAX_BYTES = 64 * 1024
const CSV_SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{16,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /api[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9_-]{16,}/i,
  /bearer\s+[a-zA-Z0-9._-]{20,}/i
] as const

export class CsvTaskDriver {
  private readonly parser = new CsvParser()

  async loadRoot(rootPath: string, skillNames: ReadonlySet<string>): Promise<CsvDriverState> {
    await mkdir(rootPath, { recursive: true })
    const entries = await readdir(rootPath, { withFileTypes: true })
    const csvFiles = entries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.csv') && !entry.name.startsWith('~$'))
      .map(entry => join(rootPath, entry.name))
      .sort((left, right) => left.localeCompare(right))
    const groups = await Promise.all(csvFiles.map(filePath => this.loadGroup(filePath, skillNames)))
    return { groups, lastFullScanAt: Date.now(), watchedDirs: [rootPath] }
  }

  async loadGroup(filePath: string, skillNames: ReadonlySet<string>): Promise<CsvFileGroup> {
    const absolute = resolve(filePath)
    const [encodingProbe, fileStat] = await Promise.all([this.probeEncoding(absolute), stat(absolute)])
    const stream = this.createDecodedCsvStream(absolute, encodingProbe)
    const parsed = await this.parser.parseStream(stream)
    const groupId = basename(absolute, '.csv')
    const parsedIds = new Set(parsed.rows.flatMap(row => row.row ? [row.row.taskId] : []))
    const idCounts = this.taskIdCounts(parsed.rows)
    const rows = parsed.rows.map(row => this.toDriverRow(groupId, row, parsedIds, idCounts, skillNames))
    const rowErrors = rows.flatMap(row => row.errors)
    return {
      groupId,
      filePath: absolute,
      rowCount: rows.length,
      validRowCount: rows.filter(row => row.rowState === 'valid').length,
      rows,
      errors: [...parsed.errors, ...rowErrors],
      loadedAt: Date.now(),
      fileMtime: Math.trunc(fileStat.mtimeMs),
      metadata: parsed.metadata
    }
  }

  async exportTemplate(savePath: string): Promise<{ success: true; filePath: string; columns: number }> {
    const absolute = resolve(savePath)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, this.parser.stringifyTemplate(new Date().toISOString()), 'utf8')
    return { success: true, filePath: absolute, columns: CSV_COLUMN_NAMES.length }
  }

  toRuntimeRow(groupId: string, row: CsvTaskRow18): RuntimeCsvTaskRow {
    const args = parseCsvInputArgs(row.inputArgs)
    const promptFromArgs = typeof args.prompt === 'string' ? args.prompt.trim() : ''
    const context = this.promptContext(row, args)
    const preparedPrompt = this.preparePrompt(promptFromArgs || [row.taskName, row.skill, row.inputFile].filter(Boolean).join(' | '), context)
    const prompt = preparedPrompt.prompt
    const promptSkill = this.parsePromptSkillReferences(promptFromArgs).names[0]
    const dependency = row.dependsOn.split(',').map(item => item.trim()).filter(Boolean)[0]
    const onFail = this.parseOnFail(args.on_fail ?? args.onFail)
    const fallbackTool = this.parseTool(args.fallback_tool ?? args.fallbackTool)
    const executeSkill = this.parseNonEmptyString(args.execute_skill ?? args.executeSkill)
    const cwd = context.cwd
    return {
      id: row.taskId,
      group: groupId,
      tool: row.tool,
      prompt,
      ...(cwd ? { cwd } : {}),
      skill: promptSkill ?? row.skill,
      priority: csvPriorityToNumber(row.priority),
      dependency,
      parallel_group: row.concurrencyKey || undefined,
      timeout_ms: row.timeoutMs > 0 ? row.timeoutMs : undefined,
      retries: row.retries,
      tags: row.tags || undefined,
      output_path: row.outputDir || undefined,
      dry_run: false,
      allow_inject: false,
      ...(onFail ? { on_fail: onFail } : {}),
      ...(fallbackTool ? { fallback_tool: fallbackTool } : {}),
      ...(executeSkill ? { execute_skill: executeSkill } : {}),
      notes: row.note || undefined
    }
  }

  rowHash(row: RuntimeCsvTaskRow | CsvTaskRow18): string {
    const normalized = JSON.stringify(row, Object.keys(row).sort())
    return createHash('sha256').update(normalized).digest('hex')
  }

  launchCommand(csvPath: string, options: { runner?: 'devhub' | 'python' | 'cli'; concurrent?: number; resume?: boolean; dryRun?: boolean } = {}): string {
    const parts = ['devhub', 'run-csv', this.quote(csvPath)]
    if (options.runner) parts.push('--runner', options.runner)
    if (typeof options.concurrent === 'number') parts.push('--concurrent', String(options.concurrent))
    if (options.resume) parts.push('--resume')
    if (options.dryRun) parts.push('--dry-run')
    return parts.join(' ')
  }

  private toDriverRow(groupId: string, parsedRow: { rowIndex: number; line: number; raw: Record<string, string>; row: CsvTaskRow18 | null; errors: CsvParseError[] }, ids: ReadonlySet<string>, idCounts: ReadonlyMap<string, number>, skillNames: ReadonlySet<string>): CsvDriverRow {
    const errors = [...parsedRow.errors]
    if (parsedRow.row) {
      if ((idCounts.get(parsedRow.row.taskId) ?? 0) > 1) {
        errors.push({ line: parsedRow.line, column: 'taskId', message: `duplicate taskId: ${parsedRow.row.taskId}` })
      }
      if (!skillNames.has(parsedRow.row.skill)) {
        errors.push({ line: parsedRow.line, column: 'skill', message: `skill not found: ${parsedRow.row.skill}` })
      }
      const args = parseCsvInputArgs(parsedRow.row.inputArgs)
      const promptFromArgs = this.promptFromArgs(args)
      const promptContext = this.promptContext(parsedRow.row, args)
      const inputFileValidation = this.validateRequiredInputFile(parsedRow.row, args, promptContext)
      if (!inputFileValidation.ok && inputFileValidation.message) {
        errors.push({ line: parsedRow.line, column: 'inputFile', message: inputFileValidation.message })
      }
      if (this.containsSecretMaterial(parsedRow.row.inputArgs) || this.containsSecretMaterial(promptFromArgs)) {
        errors.push({ line: parsedRow.line, column: 'inputArgs', message: 'possible API key leak in CSV inputArgs' })
      }
      const preparedPrompt = this.preparePrompt(promptFromArgs, promptContext)
      for (const message of preparedPrompt.errors) {
        errors.push({ line: parsedRow.line, column: 'inputArgs', message })
      }
      const promptSkillReferences = this.parsePromptSkillReferences(promptFromArgs)
      for (const message of promptSkillReferences.errors) {
        errors.push({ line: parsedRow.line, column: 'inputArgs', message })
      }
      if (promptSkillReferences.names.length > 1) {
        errors.push({ line: parsedRow.line, column: 'inputArgs', message: `multiple @skill references found: ${promptSkillReferences.names.join(', ')}` })
      }
      for (const name of promptSkillReferences.names) {
        if (!skillNames.has(name)) errors.push({ line: parsedRow.line, column: 'inputArgs', message: `skill not found: ${name}` })
      }
      for (const dependency of parsedRow.row.dependsOn.split(',').map(item => item.trim()).filter(Boolean)) {
        if (!ids.has(dependency)) errors.push({ line: parsedRow.line, column: 'dependsOn', message: `dependency not found: ${dependency}` })
      }
    }
    const rowState = parsedRow.row && errors.length === 0 ? 'valid' : 'invalid'
    return {
      rowIndex: parsedRow.rowIndex,
      line: parsedRow.line,
      raw: parsedRow.raw,
      row: parsedRow.row,
      runtimeRow: parsedRow.row && rowState === 'valid' ? this.toRuntimeRow(groupId, parsedRow.row) : null,
      rowState,
      errors
    }
  }

  private async probeEncoding(filePath: string): Promise<CsvEncodingProbe> {
    const handle = await open(filePath, 'r')
    try {
      const sample = Buffer.alloc(65536)
      const { bytesRead } = await handle.read(sample, 0, sample.length, 0)
      const buffer = sample.subarray(0, bytesRead)
      if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return { encoding: 'utf16le', skipBytes: 2 }
      if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) throw new Error('E_PARSE:utf16be CSV is not supported; please save as UTF-8')
      if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return { encoding: 'utf8', skipBytes: 3 }
      return buffer.toString('utf8').includes('\uFFFD') ? { encoding: 'gb18030', skipBytes: 0 } : { encoding: 'utf8', skipBytes: 0 }
    } finally {
      await handle.close()
    }
  }

  private createDecodedCsvStream(filePath: string, probe: CsvEncodingProbe): NodeJS.ReadableStream {
    const bytes = createReadStream(filePath, { start: probe.skipBytes })
    if (probe.encoding === 'utf16le') return bytes.pipe(iconv.decodeStream('utf16le'))
    if (probe.encoding === 'gb18030') return bytes.pipe(iconv.decodeStream('gb18030'))
    return bytes
  }

  private parseOnFail(value: unknown): RuntimeCsvTaskRow['on_fail'] | undefined {
    if (value === 'next' || value === 'abort' || value === 'retry' || value === 'fallback-tool' || value === 'escalate-model' || value === 'human' || value === 'execute-skill') return value
    return undefined
  }

  private parseTool(value: unknown): RuntimeCsvTaskRow['fallback_tool'] | undefined {
    if (value === 'codex' || value === 'claude' || value === 'gemini' || value === 'cursor' || value === 'copilot') return value
    return undefined
  }

  private parseNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  }

  private taskIdCounts(rows: readonly { row: CsvTaskRow18 | null }[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const parsed of rows) {
      if (!parsed.row) continue
      counts.set(parsed.row.taskId, (counts.get(parsed.row.taskId) ?? 0) + 1)
    }
    return counts
  }

  private promptFromArgs(args: Record<string, unknown>): string {
    return typeof args.prompt === 'string' ? args.prompt.trim() : ''
  }

  private promptContext(row: CsvTaskRow18, args: Record<string, unknown>): CsvPromptContext {
    const cwd = this.parseNonEmptyString(args.cwd)
    const file = this.parseNonEmptyString(args.file) ?? (row.inputFile.trim().length > 0 ? row.inputFile.trim() : undefined)
    return { cwd, file }
  }

  private preparePrompt(prompt: string, context: CsvPromptContext): CsvPreparedPrompt {
    const interpolated = this.interpolatePromptVariables(prompt, context)
    return this.expandPromptFileReferences(interpolated, context)
  }

  private interpolatePromptVariables(prompt: string, context: CsvPromptContext): string {
    return prompt
      .replaceAll('{{cwd}}', context.cwd ?? process.cwd())
      .replaceAll('{{file}}', context.file ?? '')
  }

  private expandPromptFileReferences(prompt: string, context: CsvPromptContext): CsvPreparedPrompt {
    const errors: string[] = []
    const expanded = prompt.replace(PROMPT_FILE_REFERENCE_PATTERN, (match: string, prefix: string, reference: string) => {
      if (reference.length === 0) {
        errors.push('invalid @file reference: empty file path')
        return match
      }
      const resolved = this.resolvePromptFileReference(reference, context)
      try {
        const fileStat = statSync(resolved)
        if (!fileStat.isFile()) {
          errors.push(`@file reference is not a file: ${reference}`)
          return match
        }
        if (fileStat.size > CSV_PROMPT_FILE_REFERENCE_MAX_BYTES) {
          errors.push(`@file reference exceeds 65536 bytes: ${reference}`)
          return match
        }
        return `${prefix}${readFileSync(resolved, 'utf8')}`
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`@file reference not readable: ${reference} (${message})`)
        return match
      }
    })
    return { prompt: expanded, errors }
  }

  private resolvePromptFileReference(reference: string, context: CsvPromptContext): string {
    const base = context.cwd ?? process.cwd()
    return isAbsolute(reference) ? reference : resolve(base, reference)
  }

  private validateRequiredInputFile(row: CsvTaskRow18, args: Record<string, unknown>, context: CsvPromptContext): CsvFileValidationResult {
    if (args.require_input_file !== true && args.requireInputFile !== true) return { ok: true }
    const inputFile = context.file ?? row.inputFile.trim()
    if (inputFile.length === 0) return { ok: false, message: 'required inputFile is empty' }
    const resolved = this.resolvePromptFileReference(inputFile, context)
    try {
      const fileStat = statSync(resolved)
      if (!fileStat.isFile()) return { ok: false, message: `required inputFile is not a file: ${inputFile}` }
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message: `required inputFile not readable: ${inputFile} (${message})` }
    }
  }

  private containsSecretMaterial(value: string): boolean {
    return CSV_SECRET_PATTERNS.some(pattern => pattern.test(value))
  }

  private parsePromptSkillReferences(prompt: string): CsvPromptSkillReferences {
    const names: string[] = []
    const errors: string[] = []
    for (const match of prompt.matchAll(SKILL_REFERENCE_PATTERN)) {
      const name = match[1] ?? ''
      if (name.length === 0) {
        errors.push('invalid @skill reference: empty skill name')
      } else if (!SKILL_REFERENCE_NAME_PATTERN.test(name)) {
        errors.push(`invalid @skill reference: ${name}`)
      } else if (!names.includes(name)) {
        names.push(name)
      }
    }
    return { names, errors }
  }

  private quote(value: string): string {
    return /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value
  }
}
