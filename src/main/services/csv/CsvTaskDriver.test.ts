import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import iconv from 'iconv-lite'
import { describe, expect, it } from 'vitest'
import { CSV_COLUMN_NAMES, type CsvColumnName } from '@shared/schemas/csv-task-row'
import { CsvTaskDriver } from './CsvTaskDriver'

type RowValues = Record<CsvColumnName, string>

const skillNames = new Set(['code-review', 'lint-fix'])

function row(overrides: Partial<RowValues> = {}): RowValues {
  return {
    taskId: 'task-001',
    taskName: 'Review local file',
    priority: 'P1',
    status: 'pending',
    tool: 'codex',
    skill: 'code-review',
    inputFile: 'src/app.ts',
    inputArgs: '{"prompt":"review this file"}',
    outputDir: 'out/reports',
    outputFormat: 'md',
    tags: 'review,local',
    dependsOn: '',
    timeoutMs: '60000',
    retries: '1',
    concurrencyKey: 'codex-pool',
    createdAt: '2026-05-03T08:00:00Z',
    scheduledAt: 'now',
    note: 'owner: local',
    ...overrides
  }
}

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function csv(rows: RowValues[], metadata = '# devhub-csv-version=1.0; runner=cli; concurrentMax=4'): string {
  return [
    metadata,
    CSV_COLUMN_NAMES.join(','),
    ...rows.map(values => CSV_COLUMN_NAMES.map(column => escapeCsv(values[column])).join(','))
  ].join('\n') + '\n'
}

describe('CsvTaskDriver', () => {
  it('loads a real CSV file, validates skills, and maps rows to runtime tasks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-driver-'))
    const filePath = join(root, 'batch-a.csv')
    await writeFile(filePath, csv([row()]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.groupId).toBe('batch-a')
      expect(group.metadata.runner).toBe('cli')
      expect(group.metadata.concurrentMax).toBe(4)
      expect(group.rowCount).toBe(1)
      expect(group.validRowCount).toBe(1)
      expect(group.rows[0].runtimeRow).toMatchObject({ id: 'task-001', tool: 'codex', prompt: 'review this file', priority: 75, retries: 1, parallel_group: 'codex-pool' })
      const runtimeRow = group.rows[0].runtimeRow
      if (!runtimeRow) throw new Error('expected runtime row')
      expect(driver.rowHash(runtimeRow)).toHaveLength(64)
      expect(driver.rowHash(runtimeRow)).toBe(
        createHash('sha256')
          .update(JSON.stringify(runtimeRow, Object.keys(runtimeRow).sort()))
          .digest('hex')
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('maps on_fail controls from inputArgs without adding CSV columns', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-on-fail-'))
    const filePath = join(root, 'on-fail.csv')
    await writeFile(filePath, csv([row({
      inputArgs: '{"prompt":"retry with another tool","on_fail":"fallback-tool","fallback_tool":"gemini","execute_skill":"code-review"}'
    })]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)
      expect(group.validRowCount).toBe(1)
      expect(group.rows[0].runtimeRow).toMatchObject({
        on_fail: 'fallback-tool',
        fallback_tool: 'gemini',
        execute_skill: 'code-review'
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('validates @skill references in CSV prompts and maps the referenced skill to runtime rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-prompt-skill-'))
    const filePath = join(root, 'prompt-skill.csv')
    await writeFile(filePath, csv([row({
      inputArgs: '{"prompt":"@skill:lint-fix fix lint failures in src/app.ts"}'
    })]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(1)
      expect(group.errors).toEqual([])
      expect(group.rows[0].runtimeRow).toMatchObject({
        prompt: '@skill:lint-fix fix lint failures in src/app.ts',
        skill: 'lint-fix'
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('interpolates CSV prompt variables and expands @file references from real local files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-prompt-file-'))
    const sourceDir = join(root, 'src')
    const sourceFile = join(sourceDir, 'auth.ts')
    const filePath = join(root, 'prompt-file.csv')
    await mkdir(sourceDir, { recursive: true })
    await writeFile(sourceFile, 'export const token = "local-source"\n', 'utf8')
    await writeFile(filePath, csv([row({
      inputFile: 'src/auth.ts',
      inputArgs: JSON.stringify({ cwd: root, prompt: 'Review {{cwd}}/{{file}}\n@file:{{file}}' })
    })]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(1)
      expect(group.errors).toEqual([])
      expect(group.rows[0].runtimeRow).toMatchObject({ cwd: root })
      expect(group.rows[0].runtimeRow?.prompt).toContain(`${root}/src/auth.ts`)
      expect(group.rows[0].runtimeRow?.prompt).toContain('export const token = "local-source"')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects unreadable @file references before launching runtime rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-prompt-file-missing-'))
    const filePath = join(root, 'missing-file.csv')
    await writeFile(filePath, csv([row({
      inputArgs: JSON.stringify({ cwd: root, prompt: 'Review @file:missing.ts' })
    })]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(0)
      expect(group.rows[0].runtimeRow).toBeNull()
      expect(group.errors.some(error => error.column === 'inputArgs' && error.message.includes('@file reference not readable: missing.ts'))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects duplicate task ids before creating runtime rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-duplicate-id-'))
    const filePath = join(root, 'duplicate-id.csv')
    await writeFile(filePath, csv([
      row({ taskId: 'duplicate-task', inputArgs: '{"prompt":"first"}' }),
      row({ taskId: 'duplicate-task', inputArgs: '{"prompt":"second"}' })
    ]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(0)
      expect(group.rows.every(driverRow => driverRow.runtimeRow === null)).toBe(true)
      expect(group.errors.filter(error => error.column === 'taskId' && error.message === 'duplicate taskId: duplicate-task')).toHaveLength(2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('validates required inputFile paths when explicitly requested', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-required-file-'))
    const sourceDir = join(root, 'src')
    const sourceFile = join(sourceDir, 'app.ts')
    const filePath = join(root, 'required-file.csv')
    await mkdir(sourceDir, { recursive: true })
    await writeFile(sourceFile, 'export const ok = true\n', 'utf8')
    await writeFile(filePath, csv([
      row({ taskId: 'file-ok', inputFile: 'src/app.ts', inputArgs: JSON.stringify({ cwd: root, require_input_file: true, prompt: 'review {{file}}' }) }),
      row({ taskId: 'file-missing', inputFile: 'src/missing.ts', inputArgs: JSON.stringify({ cwd: root, require_input_file: true, prompt: 'review {{file}}' }) })
    ]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(1)
      expect(group.rows.find(driverRow => driverRow.row?.taskId === 'file-ok')?.runtimeRow?.prompt).toBe('review src/app.ts')
      expect(group.rows.find(driverRow => driverRow.row?.taskId === 'file-missing')?.runtimeRow).toBeNull()
      expect(group.errors.some(error => error.column === 'inputFile' && error.message.includes('required inputFile not readable: src/missing.ts'))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects likely API key leakage in CSV inputArgs before launch', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-secret-'))
    const filePath = join(root, 'secret.csv')
    await writeFile(filePath, csv([row({
      inputArgs: '{"prompt":"use api_key=sk-1234567890abcdef1234567890abcdef"}'
    })]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(0)
      expect(group.rows[0].runtimeRow).toBeNull()
      expect(group.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ column: 'inputArgs', message: 'possible API key leak in CSV inputArgs' })
      ]))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects missing @skill references before launching runtime rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-prompt-skill-missing-'))
    const filePath = join(root, 'missing-prompt-skill.csv')
    await writeFile(filePath, csv([row({
      inputArgs: '{"prompt":"@skill:missing-skill review src/app.ts"}'
    })]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(0)
      expect(group.rows[0].runtimeRow).toBeNull()
      expect(group.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ column: 'inputArgs', message: 'skill not found: missing-skill' })
      ]))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects malformed @skill references with explicit prompt errors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-prompt-skill-malformed-'))
    const filePath = join(root, 'malformed-prompt-skill.csv')
    await writeFile(filePath, csv([row({
      inputArgs: '{"prompt":"@skill:Bad_Skill review src/app.ts"}'
    })]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(0)
      expect(group.rows[0].runtimeRow).toBeNull()
      expect(group.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ column: 'inputArgs', message: 'invalid @skill reference: Bad_Skill' })
      ]))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports strict header errors for missing or reordered columns', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-header-'))
    const missingHeaderPath = join(root, 'missing.csv')
    const reorderedPath = join(root, 'reordered.csv')
    await writeFile(missingHeaderPath, `${CSV_COLUMN_NAMES.slice(0, 17).join(',')}\n`, 'utf8')
    await writeFile(reorderedPath, `${[CSV_COLUMN_NAMES[1], CSV_COLUMN_NAMES[0], ...CSV_COLUMN_NAMES.slice(2)].join(',')}\n`, 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const missing = await driver.loadGroup(missingHeaderPath, skillNames)
      const reordered = await driver.loadGroup(reorderedPath, skillNames)

      expect(missing.errors.some(error => error.message.includes('missing CSV column note'))).toBe(true)
      expect(reordered.errors.some(error => error.message.includes('expected taskId'))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects unknown skills and missing dependencies at group level', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-invalid-'))
    const filePath = join(root, 'invalid.csv')
    await writeFile(filePath, csv([row({ taskId: 'task-002', skill: 'missing-skill', dependsOn: 'task-404' })]), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(0)
      expect(group.rows[0].runtimeRow).toBeNull()
      expect(group.errors.map(error => error.column)).toEqual(expect.arrayContaining(['skill', 'dependsOn']))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('exports a real 18 column CSV template to disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-template-'))
    const savePath = join(root, 'template.csv')
    const driver = new CsvTaskDriver()

    try {
      const result = await driver.exportTemplate(savePath)
      const content = await readFile(result.filePath, 'utf8')

      expect(result.columns).toBe(18)
      expect(content.split(/\r?\n/)[0]).toBe(CSV_COLUMN_NAMES.join(','))
      expect(content).toContain('task-001')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('decodes GB18030 CSV files without corrupting valid rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-gb18030-'))
    const filePath = join(root, 'gb18030.csv')
    await writeFile(filePath, iconv.encode(csv([row({ taskName: '中文任务', note: '中文备注' })]), 'gb18030'))
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.validRowCount).toBe(1)
      expect(group.rows[0].row?.taskName).toBe('中文任务')
      expect(group.rows[0].row?.note).toBe('中文备注')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('streams large Papa Parse CSV files with quoted delimiters and embedded newlines', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-csv-stream-'))
    const filePath = join(root, 'stream.csv')
    const rows = Array.from({ length: 1200 }, (_, index) => row({
      taskId: `task-${String(index + 1).padStart(4, '0')}`,
      taskName: index === 1199 ? 'Review "quoted", multiline task' : `Review task ${index + 1}`,
      note: index === 1199 ? 'line one\nline two, with comma' : `owner: local-${index + 1}`
    }))
    await writeFile(filePath, csv(rows), 'utf8')
    const driver = new CsvTaskDriver()

    try {
      const group = await driver.loadGroup(filePath, skillNames)

      expect(group.rowCount).toBe(1200)
      expect(group.validRowCount).toBe(1200)
      expect(group.rows.at(-1)?.row?.taskName).toBe('Review "quoted", multiline task')
      expect(group.rows.at(-1)?.row?.note).toBe('line one\nline two, with comma')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('generates copyable CLI launch commands without spawning external processes', () => {
    const driver = new CsvTaskDriver()
    const command = driver.launchCommand('C:/tmp/devhub batch.csv', { runner: 'devhub', concurrent: 3, resume: true, dryRun: true })

    expect(command).toBe('devhub run-csv "C:/tmp/devhub batch.csv" --runner devhub --concurrent 3 --resume --dry-run')
  })
})
