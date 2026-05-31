import { execFile, spawn } from 'node:child_process'
import net from 'node:net'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { hostname, tmpdir, userInfo } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { promisify } from 'node:util'
import { app, screen, session } from 'electron'
import Store from 'electron-store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import cron from 'node-cron'
import DatabaseConstructor from 'better-sqlite3'
import { CLAUDE_STREAM_SCHEMA_VERSION } from '@shared/schemas/claude-stream'
import { CSV_COLUMN_NAMES, type CsvColumnName } from '@shared/schemas/csv-task-row'
import { BUILTIN_NODE_TEMPLATES } from '@shared/schemas/dag-editor-state'
import { metricKindSchema } from '@shared/schemas/observability'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { AITask } from '@shared/types-extended'
import { R8RuntimeService } from './R8RuntimeService'
import { auditLogger } from './AuditLogger'
import { resetUnifiedNotificationService } from './notification'
import { resetRateLimits } from '../utils/rateLimiter'

const appStore = {
  getProjects: vi.fn(() => []),
  getSettings: vi.fn(() => ({
    appearance: {},
    scan: {},
    process: {},
    notification: {},
    window: {},
    advanced: {},
    firstLaunchDone: true
  })),
  updateSettings: vi.fn()
}

const nodeRequire = createRequire(import.meta.url)
const execFileAsync = promisify(execFile)


type CsvRowValues = Record<CsvColumnName, string>

function csvRow(overrides: Partial<CsvRowValues> = {}): CsvRowValues {
  return {
    taskId: `r8c-${Date.now()}`,
    taskName: 'Run R8C local checks',
    priority: 'P1',
    status: 'pending',
    tool: 'codex',
    skill: 'code-review',
    inputFile: 'src/app.ts',
    inputArgs: '{"prompt":"run real checks"}',
    outputDir: 'out/r8c',
    outputFormat: 'md',
    tags: 'r8c,local',
    dependsOn: '',
    timeoutMs: '60000',
    retries: '1',
    concurrencyKey: 'codex-pool',
    createdAt: '2026-05-03T08:00:00Z',
    scheduledAt: 'now',
    note: 'vitest real file driver',
    ...overrides
  }
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function csvDocument(rows: CsvRowValues[]): string {
  return [
    '# devhub-csv-version=1.0; runner=devhub; concurrentMax=3',
    CSV_COLUMN_NAMES.join(','),
    ...rows.map(rowValues => CSV_COLUMN_NAMES.map(column => csvEscape(rowValues[column])).join(','))
  ].join('\n') + '\n'
}

function flushAsyncWork(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 25))
}

async function waitUntil(assertion: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (assertion()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('waitUntil timeout')
}

async function waitUntilAsync(assertion: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await assertion()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('waitUntilAsync timeout')
}

async function removePathWithRetry(targetPath: string): Promise<void> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await rm(targetPath, { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      if (!['ENOTEMPTY', 'EBUSY', 'EPERM'].includes(code)) throw error
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

const runtime = {
  scannerCache: {
    getSnapshot: () => ({
      systemSummary: {
        processCount: 2,
        activePortCount: 1,
        windowCount: 3,
        aiToolCount: 4,
        cpuTotal: 5,
        memoryUsedPercent: 6
      }
    })
  }
}

interface TestRuntimeStoreShape {
  taskQueueEngine?: unknown
  featureOverrides?: Record<string, boolean>
  toolOverrides?: Record<string, string>
  toolDetectCache?: Record<string, unknown>
  drawers?: unknown[]
  drawerLayoutVersion?: unknown
}

let defaultUserDataRoot = join(tmpdir(), `devhub-r8-runtime-test-${randomUUID()}`)
const createdRuntimeServices: R8RuntimeService[] = []

type RuntimeServiceArgs = ConstructorParameters<typeof R8RuntimeService>

function createRuntimeService(
  getMainWindow: RuntimeServiceArgs[1] = (() => null) as RuntimeServiceArgs[1],
  runtimeOverride: RuntimeServiceArgs[2] = runtime as never
): R8RuntimeService {
  const service = new R8RuntimeService(appStore as never, getMainWindow, runtimeOverride)
  createdRuntimeServices.push(service)
  return service
}

function createRuntimeServiceWithStore(
  store: RuntimeServiceArgs[0],
  getMainWindow: RuntimeServiceArgs[1] = (() => null) as RuntimeServiceArgs[1],
  runtimeOverride: RuntimeServiceArgs[2] = runtime as never
): R8RuntimeService {
  const service = new R8RuntimeService(store, getMainWindow, runtimeOverride)
  createdRuntimeServices.push(service)
  return service
}

describe('R8RuntimeService', () => {
  beforeEach(() => {
    defaultUserDataRoot = join(tmpdir(), `devhub-r8-runtime-test-${randomUUID()}`)
    vi.clearAllMocks()
    vi.mocked(app.getPath).mockImplementation(() => defaultUserDataRoot)
    const runtimeStore = new Store<TestRuntimeStoreShape>({ name: 'devhub-r8-runtime' })
    runtimeStore.delete('taskQueueEngine')
    const featureOverrides = runtimeStore.get('featureOverrides', {})
    delete featureOverrides['R8.C.task.queue.engine']
    runtimeStore.set('featureOverrides', featureOverrides)
    runtimeStore.delete('toolOverrides')
    runtimeStore.delete('toolDetectCache')
    runtimeStore.delete('drawers')
    runtimeStore.delete('drawerLayoutVersion')
  })

  afterEach(async () => {
    for (const service of createdRuntimeServices.splice(0).reverse()) {
      try {
        service.dispose()
      } catch {
        // Best-effort cleanup; assertion failures should still report the original test error.
      }
    }
    await flushAsyncWork()
    await removePathWithRetry(defaultUserDataRoot)
  }, 30000)

  it('reports real registry health without background mocks', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const health = service.healthCheck()

    expect(health.featureFlags).toBeGreaterThanOrEqual(100)
    expect(health.ipcChannels).toBeGreaterThanOrEqual(90)
    expect(health.schemas).toBeGreaterThanOrEqual(20)
  })

  it('exposes spec-31 channel registrations and rate-limit stats without fake data', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const channels = service.listRateLimitChannels()
    const stats = service.rateLimitStats()

    expect(channels.find(channel => channel.channel === 'ipc:rate-limit-stats')).toMatchObject({
      rateClass: 'meta',
      burstAllowance: 5,
      perSenderBucket: false
    })
    expect(channels.find(channel => channel.channel === 'inject:execute')).toMatchObject({
      rateClass: 'medium_query',
      burstAllowance: 5,
      perSenderBucket: false
    })
    expect(stats.perChannel.length).toBeGreaterThanOrEqual(channels.length)
    expect(stats.perChannel.find(channel => channel.channel === 'ipc:rate-limit-stats')).toMatchObject({
      rateClass: 'meta',
      totalRequests: expect.any(Number),
      rejectedRequests: expect.any(Number)
    })
    expect(() => service.overrideRateClass({ channel: 'ipc:rate-limit-stats', rateClass: 'low_freq_op', confirmedBy: 'vitest' })).toThrow('E_VALIDATION')
  })

  it('builds a local spec-32 observability snapshot with all metric kinds', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const snapshot = service.getObservabilitySnapshot()
    const kinds = new Set(snapshot.metrics.map(metric => metric.kind))

    for (const kind of metricKindSchema.options) {
      expect(kinds.has(kind)).toBe(true)
    }
    expect(snapshot.globalCounters.totalIpcRequests).toBeGreaterThanOrEqual(0)
    expect(snapshot.globalCounters.totalRateLimited).toBeGreaterThanOrEqual(0)
    expect(snapshot.health.overall).toMatch(/healthy|degraded|unhealthy/)
  })

  it('exports spec-32 observability snapshots as real JSON and CSV files', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const tempDir = await mkdtemp(join(tmpdir(), 'devhub-obs-'))

    try {
      const jsonPath = join(tempDir, 'snapshot.json')
      const csvPath = join(tempDir, 'snapshot.csv')
      const jsonResult = await service.exportObservabilitySnapshot({ format: 'json', destPath: jsonPath })
      const csvResult = await service.exportObservabilitySnapshot({ format: 'csv', destPath: csvPath })
      const jsonContent = JSON.parse(await readFile(jsonPath, 'utf8')) as { metrics?: unknown[] }
      const csvContent = await readFile(csvPath, 'utf8')

      expect(jsonResult).toMatchObject({ success: true, filePath: jsonPath, format: 'json' })
      expect(csvResult).toMatchObject({ success: true, filePath: csvPath, format: 'csv' })
      expect(jsonContent.metrics?.length).toBeGreaterThan(0)
      expect(csvContent.startsWith('kind,ts,value,labels')).toBe(true)
      expect((await stat(jsonPath)).size).toBe(jsonResult.sizeBytes)
      expect((await stat(csvPath)).size).toBe(csvResult.sizeBytes)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('limits spec-32 observability stream subscriptions to three active senders', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const sender = (id: number) => ({
      id,
      isDestroyed: vi.fn(() => false),
      once: vi.fn(),
      send: vi.fn()
    })
    const first = sender(1)
    const second = sender(2)
    const third = sender(3)
    const fourth = sender(4)

    const one = service.subscribeObservability(first as never, { subscriberId: 'one' })
    const two = service.subscribeObservability(second as never, { subscriberId: 'two' })
    const three = service.subscribeObservability(third as never, { subscriberId: 'three' })

    expect(one.success).toBe(true)
    expect(two.success).toBe(true)
    expect(three.success).toBe(true)
    expect(() => service.subscribeObservability(fourth as never, { subscriberId: 'four' })).toThrow('E_RATE_LIMITED')
    expect(first.send).toHaveBeenCalledWith('obs:subscribe', expect.any(Array))

    service.unsubscribeObservability({ subscriberId: 'one' })
    service.unsubscribeObservability({ subscriberId: 'two' })
    service.unsubscribeObservability({ subscriberId: 'three' })
  })

  it('allows rateClass override only in development mode', () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const service = createRuntimeService(() => null, runtime as never)
      service.listRateLimitChannels()

      expect(service.overrideRateClass({ channel: 'ipc:rate-limit-stats', rateClass: 'low_freq_op', confirmedBy: 'vitest' })).toEqual({
        success: true,
        channel: 'ipc:rate-limit-stats',
        rateClass: 'low_freq_op',
        confirmedBy: 'vitest'
      })
    } finally {
      process.env.NODE_ENV = previousNodeEnv
      resetRateLimits()
    }
  })


  it('returns truthful contract-only status for registered but non-executable channels', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const query = service.invokeContractOnlyChannel({ channel: 'audit:query', payload: { token: 'secret-value' } })
    const destructive = service.invokeContractOnlyChannel({ channel: 'audit:purge' })

    expect(query.success).toBe(false)
    expect(query.status).toBe('contract-only')
    expect(query.code).toBe('E_R8_CONTRACT_ONLY')
    expect(query.executable).toBe(false)
    expect(query.payload).toEqual({ token: '[REDACTED]' })
    expect(destructive.status).toBe('permission-required')
    expect(destructive.code).toBe('E_PERMISSION')
  })

  it('validates payloads through the Zod runtime registry', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const schemas = service.listSchemas()
    const migration = service.migrationStatus()

    expect(service.validatePayload({ schemaName: 'CsvTaskRow', payload: { id: '1', tool: 'codex', prompt: 'go' } }).success).toBe(true)
    const invalid = service.validatePayload({ schemaName: 'CsvTaskRow', payload: { id: '1', tool: 'codex', prompt: '' } })

    expect(invalid.success).toBe(false)
    expect(invalid.errors.some(issue => issue.path === 'prompt')).toBe(true)
    expect(schemas.currentVersion).toBe('1.0.0')
    expect(schemas.schemas.some(schema => schema.schemaName === 'CsvTaskRow')).toBe(true)
    expect(migration.currentVersion).toBe('1.0.0')
    expect(migration.pendingMigrations).toEqual([])
  })

  it('loads strict builtin and user skills without executing skill scripts', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-skills-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const previousBuiltinEnabled = service.getFeatureFlag('R8.C.skill.builtin')
    service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: true, confirmedBy: 'vitest' })

    try {
      const builtins = service.listBuiltinSkills()
      expect(builtins.names).toHaveLength(10)
      expect(builtins.names).toContain('code-review')
      expect(builtins.skills.every(skill => skill.builtIn && skill.source === 'builtin')).toBe(true)

      const invalidDir = join(userData, 'skills', 'invalid-skill')
      await mkdir(invalidDir, { recursive: true })
      await writeFile(join(invalidDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: invalid-skill',
        'description: "missing required fields"',
        '---',
        '# invalid',
        ''
      ].join('\n'), 'utf8')

      const missingScriptDir = join(userData, 'skills', 'missing-script')
      await mkdir(missingScriptDir, { recursive: true })
      await writeFile(join(missingScriptDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: missing-script',
        'displayName: "Missing Script"',
        'version: "1.0.0"',
        'description: "Valid metadata with a script path that does not exist."',
        'author: "Vitest"',
        'tags: [test]',
        'inputs: []',
        'outputs: []',
        'scriptPath: "./missing.js"',
        'runtime: node',
        'permissions: [fs-read]',
        '---',
        '# Missing Script',
        ''
      ].join('\n'), 'utf8')

      const escapeDir = join(userData, 'skills', 'escape-skill')
      await mkdir(escapeDir, { recursive: true })
      await writeFile(join(escapeDir, 'run.js'), 'console.log(JSON.stringify({ ok: true }))\n', 'utf8')
      await writeFile(join(escapeDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: escape-skill',
        'displayName: "Escape Skill"',
        'version: "1.0.0"',
        'description: "Valid metadata with a path traversal script reference."',
        'author: "Vitest"',
        'tags: [test]',
        'inputs: []',
        'outputs: []',
        'scriptPath: "../../run.js"',
        'runtime: node',
        'permissions: [fs-read]',
        '---',
        '# Escape Skill',
        ''
      ].join('\n'), 'utf8')

      const absoluteDir = join(userData, 'skills', 'absolute-skill')
      await mkdir(absoluteDir, { recursive: true })
      await writeFile(join(absoluteDir, 'run.js'), 'console.log(JSON.stringify({ ok: true }))\n', 'utf8')
      await writeFile(join(absoluteDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: absolute-skill',
        'displayName: "Absolute Skill"',
        'version: "1.0.0"',
        'description: "Valid metadata with an absolute script path that must be rejected."',
        'author: "Vitest"',
        'tags: [test]',
        'inputs: []',
        'outputs: []',
        `scriptPath: ${JSON.stringify(join(absoluteDir, 'run.js'))}`,
        'runtime: node',
        'permissions: [fs-read]',
        '---',
        '# Absolute Skill',
        ''
      ].join('\n'), 'utf8')

      const extraFieldValidation = service.validateSkillYaml({ yaml: [
        '---',
        'schemaVersion: "1.0"',
        'name: extra-field',
        'displayName: "Extra Field"',
        'version: "1.0.0"',
        'description: "Strict schema must reject unexpected frontmatter keys."',
        'author: "Vitest"',
        'tags: [test]',
        'inputs: []',
        'outputs: []',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read]',
        'unexpected: true',
        '---',
        '# Extra Field',
        ''
      ].join('\n') })
      expect(extraFieldValidation.success).toBe(false)
      expect(extraFieldValidation.error).toContain('Unrecognized')
      const customTagValidation = service.validateSkillYaml({ yaml: [
        '---',
        'schemaVersion: "1.0"',
        'name: custom-tag',
        'displayName: !!js/function "function customTag() { return true }"',
        'version: "1.0.0"',
        'description: "Unsafe YAML custom tags must be rejected before schema load."',
        'author: "Vitest"',
        'tags: [test]',
        'inputs: []',
        'outputs: []',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read]',
        '---',
        '# Custom Tag',
        ''
      ].join('\n') })
      expect(customTagValidation.success).toBe(false)

      const validDir = join(userData, 'skills', 'code-review')
      await mkdir(validDir, { recursive: true })
      await writeFile(join(validDir, 'run.js'), 'console.log(JSON.stringify({ ok: true }))\n', 'utf8')
      await writeFile(join(validDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: code-review',
        'displayName: "User Code Review"',
        'version: "1.0.0"',
        'description: "User override for code review with strict schema."',
        'author: "Vitest"',
        'tags: [review]',
        'inputs:',
        '  - name: file',
        '    type: file',
        '    required: true',
        'outputs:',
        '  - name: report',
        '    type: json',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read]',
        '---',
        '# User Code Review',
        ''
      ].join('\n'), 'utf8')

      const listed = await service.listSkills()
      const override = listed.skills.find(skill => skill.name === 'code-review')
      expect(listed.skills.filter(skill => skill.builtIn)).toHaveLength(9)
      expect(override?.source).toBe('user')
      expect(auditSpy).toHaveBeenCalledWith('skill:user-override-builtin', expect.objectContaining({ name: 'code-review' }), 'success', 'user override builtin')
      expect(listed.errors.map(error => error.errorCode)).toEqual(expect.arrayContaining(['E_VALIDATION', 'E_NOT_FOUND']))
      expect(listed.errors.find(error => error.filePath.includes('escape-skill'))?.message).toContain('inside skill directory')
      expect(listed.errors.find(error => error.filePath.includes('absolute-skill'))?.message).toContain('relative to skill directory')

      const externalDir = join(userData, 'external-skill-source')
      await mkdir(externalDir, { recursive: true })
      await writeFile(join(externalDir, 'run.js'), 'console.log(JSON.stringify({ ok: true }))\n', 'utf8')
      await writeFile(join(externalDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: external-review',
        'displayName: "External Review"',
        'version: "1.0.0"',
        'description: "External local skill installed from a real directory."',
        'author: "Vitest"',
        'tags: [review]',
        'inputs:',
        '  - name: file',
        '    type: file',
        '    required: true',
        'outputs:',
        '  - name: report',
        '    type: json',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read]',
        '---',
        '# External Review',
        ''
      ].join('\n'), 'utf8')
      const installed = await service.installSkillFromPath({ sourcePath: externalDir, confirmedBy: 'vitest' })
      expect(installed.success).toBe(true)
      expect(installed.skill?.name).toBe('external-review')
      expect(auditSpy).toHaveBeenCalledWith('skill:install-from-path', expect.objectContaining({ name: 'external-review', confirmedBy: 'vitest' }), 'success')
      expect(await service.uninstallSkill({ name: 'external-review', confirmedBy: 'vitest' })).toMatchObject({ success: true })
      expect(auditSpy).toHaveBeenCalledWith('skill:uninstall', expect.objectContaining({ name: 'external-review', confirmedBy: 'vitest' }), 'success')

      const templates = service.listSkillTemplates()
      expect(templates.map(template => template.templateId)).toEqual(['blank', 'fork-builtin', 'prompt-only', 'script-only', 'full'])
      const invalidEditorYaml = ['schemaVersion: "1.0"', 'name: editor-invalid'].join(String.fromCharCode(10))
      const invalidEditorResult = service.validateSkillEditor({ yaml: invalidEditorYaml, body: '', script: '' })
      expect(invalidEditorResult.valid).toBe(false)
      expect(invalidEditorResult.schemaErrors.some(error => error.path === 'version')).toBe(true)
      const createdFromTemplate = await service.createSkillFromTemplate({ templateId: 'full', name: 'template-skill', displayName: 'Template Skill', confirmedBy: 'vitest' })
      expect(createdFromTemplate.skill.name).toBe('template-skill')
      expect(await service.uninstallSkill({ name: 'template-skill', confirmedBy: 'vitest' })).toMatchObject({ success: true })

      const forked = await service.forkBuiltinSkill({ name: 'security-audit', targetName: 'my-security-audit', confirmedBy: 'vitest' })
      expect(forked.success).toBe(true)
      expect(forked.newSkillPath).toContain('my-security-audit')
      expect(auditSpy).toHaveBeenCalledWith('skill:builtin-fork', expect.objectContaining({ name: 'security-audit', targetName: 'my-security-audit', confirmedBy: 'vitest' }), 'success')
      expect(service.builtinReadme({ name: 'security-audit' }).markdown).toContain('Security Audit Helper')
      expect(await service.uninstallSkill({ name: 'my-security-audit', confirmedBy: 'vitest' })).toMatchObject({ success: true })
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: previousBuiltinEnabled, confirmedBy: 'vitest-restore' })
      auditSpy.mockRestore()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('streams skill list diffs after local write with 100ms throttling contract', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-skill-stream-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as { store: { set: (key: string, value: unknown) => void } }
    serviceInternals.store.set('popouts', [])
    serviceInternals.store.set('monitorPopoutLayouts', {})

    try {
      const result = await service.writeSkill({
        name: 'stream-skill',
        yaml: [
          'schemaVersion: "1.0"',
          'name: stream-skill',
          'displayName: "Stream Skill"',
          'version: "1.0.0"',
          'description: "Local skill used to verify real list-stream payloads."',
          'author: "Vitest"',
          'tags: [stream]',
          'inputs: []',
          'outputs: []',
          'scriptPath: "./run.js"',
          'runtime: node',
          'permissions: [fs-read]'
        ].join('\n'),
        body: '# Stream Skill',
        script: 'console.log(JSON.stringify({ ok: true }))\n',
        confirmedBy: 'vitest'
      })

      expect(result.success).toBe(true)
      await flushAsyncWork()

      const streamCall = mainWindow.webContents.send.mock.calls.find(([channel]) => channel === 'skill:list-stream')
      expect(streamCall).toBeTruthy()
      expect(streamCall?.[1]).toMatchObject({
        source: 'write',
        removed: [],
        errors: []
      })
      expect(streamCall?.[1].skills.some((skill: { name: string }) => skill.name === 'stream-skill')).toBe(true)
      expect(streamCall?.[1].added.some((skill: { name: string }) => skill.name === 'stream-skill')).toBe(true)
    } finally {
      service.dispose()
      await flushAsyncWork()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('watches user skill files and streams add, change, and unlink diffs', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-skill-watch-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const skillDir = join(userData, 'skills', 'watched-skill')
    const skillPath = join(skillDir, 'SKILL.md')

    const renderSkill = (description: string) => [
      '---',
      'schemaVersion: "1.0"',
      'name: watched-skill',
      'displayName: "Watched Skill"',
      'version: "1.0.0"',
      `description: ${JSON.stringify(description)}`,
      'author: "Vitest"',
      'tags: [watch]',
      'inputs: []',
      'outputs: []',
      'scriptPath: "./run.js"',
      'runtime: node',
      'permissions: [fs-read]',
      '---',
      '# Watched Skill',
      ''
    ].join('\n')

    try {
      await service.startSkillWatcher({ force: true })
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'run.js'), 'console.log(JSON.stringify({ ok: true }))\n', 'utf8')
      await writeFile(skillPath, renderSkill('Initial watched skill for real chokidar add event.'), 'utf8')
      await waitUntil(() => mainWindow.webContents.send.mock.calls.some(([channel, payload]) => channel === 'skill:list-stream' && payload.source === 'add'))

      await writeFile(skillPath, renderSkill('Updated watched skill for real chokidar change event.'), 'utf8')
      await waitUntil(() => mainWindow.webContents.send.mock.calls.some(([channel, payload]) => channel === 'skill:list-stream' && payload.source === 'change' && payload.updated.some((skill: { name: string }) => skill.name === 'watched-skill')))

      await rm(skillPath, { force: true })
      await waitUntil(() => mainWindow.webContents.send.mock.calls.some(([channel, payload]) => channel === 'skill:list-stream' && payload.source === 'unlink' && payload.removed.includes('watched-skill')))
    } finally {
      service.dispose()
      await flushAsyncWork()
      await rm(userData, { recursive: true, force: true })
    }
  }, 5000)

  it('honors skill builtin feature flag off without hiding user skills', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-skill-flag-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    const skillDir = join(userData, 'skills', 'user-only-skill')
    const previousBuiltinEnabled = service.getFeatureFlag('R8.C.skill.builtin')

    try {
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'run.js'), 'console.log(JSON.stringify({ ok: true }))\n', 'utf8')
      await writeFile(join(skillDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: user-only-skill',
        'displayName: "User Only Skill"',
        'version: "1.0.0"',
        'description: "User skill remains available while builtins are disabled."',
        'author: "Vitest"',
        'tags: [user]',
        'inputs: []',
        'outputs: []',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read]',
        '---',
        '# User Only Skill',
        ''
      ].join('\n'), 'utf8')

      service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: false, confirmedBy: 'vitest' })

      expect(service.listBuiltinSkills()).toEqual({ names: [], skills: [] })
      await expect(service.forkBuiltinSkill({ name: 'code-review', targetName: 'disabled-review', confirmedBy: 'vitest' })).resolves.toMatchObject({ success: false, error: 'E_FEATURE_DISABLED' })
      expect(service.builtinReadme({ name: 'code-review' })).toMatchObject({ success: false, error: 'E_FEATURE_DISABLED', markdown: null })
      const listed = await service.listSkills()
      expect(listed.skills.map(skill => skill.name)).toEqual(['user-only-skill'])
      expect(listed.skills[0]?.source).toBe('user')
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: previousBuiltinEnabled, confirmedBy: 'vitest-restore' })
      service.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('detects DAG cycles and ready roots', () => {
    const service = createRuntimeService(() => null, runtime as never)

    expect(service.detectDagCycle({ nodes: [{ id: 'a', dependencyIds: ['b'] }, { id: 'b', dependencyIds: ['a'] }] }).hasCycle).toBe(true)
    expect(service.buildDag({ nodes: [{ id: 'root' }, { id: 'child', dependencyIds: ['root'] }] }).ready).toEqual(['root'])
  })

  it('builds, stores, layers, exports, and checks a DAG from a real CSV path', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-dag-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    const csvPath = join(userData, 'dag.csv')
    const dagSessionId = `csv-session-${randomUUID()}`

    try {
      await writeFile(csvPath, csvDocument([
        csvRow({ taskId: 'A', taskName: 'A', dependsOn: '', priority: 'P1' }),
        csvRow({ taskId: 'B', taskName: 'B', dependsOn: 'after:A', priority: 'P2' }),
        csvRow({ taskId: 'C', taskName: 'C', dependsOn: 'after:A', priority: 'P2' })
      ]), 'utf8')

      const built = service.buildDag({ sessionId: dagSessionId, csvPath }) as { layers: string[][]; hash?: string }

      expect(built.layers).toEqual([['A'], ['B', 'C']])
      expect(built.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(service.listDagAudit()[0]).toMatchObject({
        type: 'dag:build',
        sessionId: dagSessionId,
        hash: built.hash,
        previousHash: null,
        sequence: 1,
        nodeCount: 3,
        edgeCount: 2,
        warningCount: 0,
        layerCount: 2
      })
      const rebuilt = service.buildDag({ sessionId: dagSessionId, csvPath }) as { hash?: string }
      expect(service.listDagAudit().slice(0, 2)).toEqual([
        expect.objectContaining({ sessionId: dagSessionId, hash: rebuilt.hash, previousHash: built.hash, sequence: 2 }),
        expect.objectContaining({ sessionId: dagSessionId, hash: built.hash, previousHash: null, sequence: 1 })
      ])
      expect(service.dagLayer({ sessionId: dagSessionId, layerIndex: 1 })).toEqual({ taskIds: ['B', 'C'] })
      expect(service.exportDag({ sessionId: dagSessionId, format: 'mermaid' })).toMatchObject({ sessionId: dagSessionId, mimeType: 'text/vnd.mermaid' })
      expect(service.checkDagReady({ sessionId: dagSessionId, taskId: 'B', completedIds: ['A'] })).toMatchObject({ ready: true, blockers: [] })
    } finally {
      await rm(userData, { recursive: true, force: true })
    }
  })


  it('parses real CLI progress lines and stores latest progress plus sessions', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const events = service.parseCliChunk({ tool: 'codex', stream: 'stdout', instanceId: 'codex-test', chunk: 'Step 2/4 running typecheck' })

    expect(events[0].progress).toBe(0.5)
    expect(events[0].phase).toBe('validating')
    expect(service.getCliProgress({ tool: 'codex', limit: 1, instanceId: 'codex-test' }).latest?.line).toContain('Step 2/4')
    expect(service.getCliProgress({ instanceId: 'codex-test' }).progress?.percent).toBe(0.5)
    expect(service.listCliSessions()[0].instanceId).toBe('codex-test')
  })

  it('publishes real CLI parser events to the shared AITaskTracker subscription', () => {
    const forwarded: unknown[][] = []
    const runtimeWithTracker = {
      ...runtime,
      aiTaskTracker: {
        subscribeToCliOutputParser: (source: { subscribe: (listener: (events: readonly unknown[]) => void) => () => void }) => {
          return source.subscribe(events => {
            forwarded.push([...events])
          })
        }
      }
    }
    const service = createRuntimeService(() => null, runtimeWithTracker as never)

    service.parseCliChunk({ tool: 'codex', stream: 'stdout', instanceId: 'codex-shared-tracker', chunk: 'Step 3/4 running typecheck' })

    expect(forwarded[0]?.[0]).toMatchObject({
      tool: 'codex',
      instanceId: 'codex-shared-tracker',
      progress: 0.75,
      phase: 'validating'
    })
    service.dispose()
  })

  it('publishes an ERROR notification for Claude result.is_error stream-json events', async () => {
    const service = createRuntimeService(() => null, runtime as never)

    const events = service.parseCliChunk({
      tool: 'claude',
      stream: 'stdout',
      instanceId: 'claude-error-notify',
      strategy: 'ndjson',
      chunk: JSON.stringify({
        type: 'result',
        subtype: 'error_max_turns',
        is_error: true,
        duration_ms: 5000,
        total_cost_usd: 0.02,
        usage: { input_tokens: 100, output_tokens: 30 }
      })
    })

    expect(events[0]).toMatchObject({
      eventType: 'error',
      phase: 'error',
      payload: { isError: true, rawType: 'result', subtype: 'error_max_turns' }
    })

    await flushAsyncWork()

    const notification = service
      .listNotifications({ includeDismissed: true, level: 'ERROR' })
      .find(item => item.instanceId === 'claude-error-notify')

    expect(notification).toMatchObject({
      level: 'ERROR',
      source: 'ai-task',
      title: 'Claude stream-json error: error_max_turns'
    })
    expect(notification?.body).toContain('durationMs=5000')
    expect(notification?.body).toContain('tokens=input:100,output:30')
    service.dispose()
  })

  it('requires operator confirmation before restarting Claude after non stream-json output and then runs a real local child', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const instanceId = `claude-post-output-fallback-${randomUUID()}`
    const restartedLine = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 321,
      total_cost_usd: 0.004,
      usage: { input_tokens: 12, output_tokens: 5 }
    })
    const restartScript = `process.stdout.write(${JSON.stringify(`${restartedLine}\n`)})`

    const events = service.parseCliChunk({
      tool: 'claude',
      stream: 'stdout',
      instanceId,
      strategy: 'ndjson',
      chunk: 'plain claude text',
      command: process.execPath,
      args: ['-e', restartScript, '--', '-p', 'hello']
    })

    expect(events[0]).toMatchObject({
      eventType: 'error',
      payload: { subtype: 'invalid_stream_json' }
    })
    await flushAsyncWork()

    const pending = service.listClaudeStreamJsonRestarts().find(item => item.instanceId === instanceId)
    expect(pending).toMatchObject({
      status: 'pending-confirmation',
      reason: 'non-stream-json-output',
      confirmedBy: null
    })
    expect(pending?.restartCommand.args.slice(-3)).toEqual(['--output-format', 'stream-json', '--include-partial-messages'])
    expect(service.getClaudeCostSummary({ instanceId })).toEqual({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      durationMs: 0
    })
    const warning = service.listNotifications({ includeDismissed: true, level: 'WARN' }).find(item => item.instanceId === instanceId)
    expect(warning).toMatchObject({
      source: 'ai-task',
      title: 'Claude stream-json restart requires confirmation'
    })
    expect(warning?.actions[0]?.actionId).toBe(pending?.actionId)

    if (!pending) throw new Error('expected pending Claude restart request')
    const started = await service.confirmClaudeStreamJsonRestart({ requestId: pending.requestId, confirmedBy: 'vitest' })
    expect(started).toMatchObject({
      status: 'running',
      confirmedBy: 'vitest'
    })
    expect(started.pid).toEqual(expect.any(Number))

    await waitUntil(() => service.listClaudeStreamJsonRestarts().some(item => item.requestId === pending.requestId && item.status === 'exited'))

    expect(service.getCliProgress({ tool: 'claude', instanceId }).latest).toMatchObject({
      eventType: 'completion',
      payload: { subtype: 'success', inputTokens: 12, outputTokens: 5 }
    })
    expect(service.getClaudeCostSummary({ instanceId })).toEqual({
      totalInputTokens: 12,
      totalOutputTokens: 5,
      totalCostUsd: 0.004,
      durationMs: 321
    })
    service.dispose()
  })


  it('installs and uninstalls real shim files behind explicit confirmation', async () => {
    const service = createRuntimeService(() => null, runtime as never)

    await expect(service.installShim({ tool: 'codex' })).rejects.toThrow('E_PERMISSION')
    const installed = await service.installShim({ tool: 'codex', confirmedBy: 'vitest' })

    expect(installed.success).toBe(true)
    expect(installed.manifest.toolName).toBe('codex')
    expect(installed.pipeServer.listening).toBe(true)
    expect(service.listShimStatus().codex?.shimExePath).toBe(installed.shimPath)

    await new Promise<void>((resolve, reject) => {
      const client = net.createConnection(installed.pipeServer.pipeName, () => {
        client.write(`${JSON.stringify({ shimPid: 100, realPid: 101, source: 'stdout', line: 'DEVHUB::MARKER::v=1::PHASE=coding', ts: Date.now() })}\n`)
        client.end()
        setTimeout(resolve, 25)
      })
      client.on('error', reject)
    })
    expect(service.getCliProgress({ tool: 'codex', limit: 5 }).latest?.eventType).toBe('phase_marker')

    const removed = await service.uninstallShim({ tool: 'codex', confirmedBy: 'vitest' })
    expect(removed.success).toBe(true)
    expect(service.listShimStatus().codex).toBeNull()

    const geminiInstalled = await service.installShim({ tool: 'gemini', confirmedBy: 'vitest' })
    await new Promise<void>((resolve, reject) => {
      const client = net.createConnection(geminiInstalled.pipeServer.pipeName, () => {
        client.write(`${JSON.stringify({ shimPid: 110, realPid: 111, source: 'stdout', line: 'Thinking...', ts: Date.now() })}\n`)
        client.end()
        setTimeout(resolve, 25)
      })
      client.on('error', reject)
    })
    expect(service.getCliProgress({ tool: 'gemini', limit: 5 }).latest).toMatchObject({
      eventType: 'progress',
      phase: 'thinking',
      rawSource: 'line',
      tool: 'gemini'
    })

    const geminiRemoved = await service.uninstallShim({ tool: 'gemini', confirmedBy: 'vitest' })
    expect(geminiRemoved.success).toBe(true)
    expect(service.listShimStatus().gemini).toBeNull()
  })

  it('reloads Gemini parser rules behind confirmation and exposes stats', () => {
    const service = createRuntimeService(() => null, runtime as never)
    service.parseCliChunk({ tool: 'gemini', stream: 'stdout', instanceId: 'gemini-rules', strategy: 'line', chunk: 'plain model text' })

    expect(service.getGeminiPatternStat({ instanceId: 'gemini-rules' }).unmatchedRatio).toBe(1)
    expect(() => service.reloadGeminiRules({ rules: [{ kind: 'thinking', regex: 'Waiting for approval', confidence: 0.77 }] })).toThrow('E_PERMISSION')
    const reloaded = service.reloadGeminiRules({ rules: [{ kind: 'thinking', regex: 'Waiting for approval', flags: 'i', confidence: 0.77, ansiStrip: true }], confirmedBy: 'vitest' })
    service.parseCliChunk({ tool: 'gemini', stream: 'stdout', instanceId: 'gemini-rules', strategy: 'line', chunk: 'Waiting for approval' })

    expect(reloaded).toMatchObject({ success: true, applied: 1, confirmedBy: 'vitest' })
    expect(service.getCliProgress({ tool: 'gemini', limit: 1 }).latest).toMatchObject({ eventType: 'progress', phase: 'thinking' })
    expect(service.getGeminiPatternStat({ instanceId: 'gemini-rules' }).kindCounts.thinking).toBe(1)
  })

  it('reloads Gemini parser rules from a real gemini-pattern.json watcher event', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const userData = app.getPath('userData')
    await mkdir(userData, { recursive: true })
    const watchedPath = join(userData, 'gemini-pattern.json')

    const initialRules = {
      rules: [
        { kind: 'thinking', regex: 'Awaiting Gemini plan', flags: 'i', confidence: 0.79, ansiStrip: true }
      ]
    }
    await writeFile(watchedPath, `${JSON.stringify(initialRules)}\n`, 'utf8')

    const started = await service.startGeminiRuleWatcher()
    expect(started.success).toBe(true)
    if (!started.watchedPath) throw new Error('expected Gemini pattern watcher path')

    const initialVersion = service.getGeminiPatternStat().ruleVersion
    await waitUntil(() => service.getGeminiPatternStat().ruleVersion > initialVersion, 10_000)

    const updatedRules = {
      rules: [
        { kind: 'thinking', regex: 'Awaiting Gemini plan updated', flags: 'i', confidence: 0.83, ansiStrip: true }
      ]
    }
    await writeFile(watchedPath, `${JSON.stringify(updatedRules)}\n`, 'utf8')

    const versionBeforeUpdate = service.getGeminiPatternStat().ruleVersion
    await waitUntil(() => service.getGeminiPatternStat().ruleVersion > versionBeforeUpdate, 10_000)
    const currentVersion = service.getGeminiPatternStat().ruleVersion
    const events = service.parseCliChunk({
      tool: 'gemini',
      stream: 'stdout',
      instanceId: 'gemini-watch-rules',
      strategy: 'line',
      chunk: 'Awaiting Gemini plan updated'
    })

    expect(events[0]).toMatchObject({
      eventType: 'progress',
      phase: 'thinking',
      confidence: 0.83,
      payload: { kind: 'thinking', ruleVersion: currentVersion }
    })
    service.dispose()
  })

  it('audits a WARN-severity Gemini parser low match rate once per rule version', () => {
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const service = createRuntimeService(() => null, runtime as never)

    service.parseCliChunk({
      tool: 'gemini',
      stream: 'stdout',
      instanceId: 'gemini-low-match',
      strategy: 'line',
      chunk: ['plain one', 'plain two', 'plain three', 'plain four', 'plain five'].join('\n')
    })
    service.parseCliChunk({ tool: 'gemini', stream: 'stdout', instanceId: 'gemini-low-match', strategy: 'line', chunk: 'plain six' })

    const lowMatchAudits = auditSpy.mock.calls.filter(([action]) => action === 'ai:gemini-pattern-low-match-rate')
    expect(lowMatchAudits).toHaveLength(1)
    expect(lowMatchAudits[0]).toEqual([
      'ai:gemini-pattern-low-match-rate',
      expect.objectContaining({
        instanceId: 'gemini-low-match',
        matchRatio: 0,
        ruleVersion: 1,
        severity: 'WARN',
        threshold: 0.5,
        totalLines: 5,
        unmatchedLines: 5,
        unmatchedRatio: 1
      }),
      'success',
      'E_VALIDATION:gemini-pattern-low-match-rate'
    ])
    service.dispose()
    auditSpy.mockRestore()
  })

  it('emits one unknown Gemini timeout event and WARN audit after stdout goes stale', () => {
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const service = createRuntimeService(() => null, runtime as never)

    service.parseCliChunk({
      tool: 'gemini',
      stream: 'stdout',
      instanceId: 'gemini-timeout',
      strategy: 'line',
      chunk: 'Thinking...'
    })
    dateSpy.mockReturnValue(31_500)
    const timeoutEvents = service.checkGeminiStdoutTimeouts()
    const repeated = service.checkGeminiStdoutTimeouts()

    expect(timeoutEvents).toHaveLength(1)
    expect(repeated).toEqual([])
    expect(timeoutEvents[0]).toMatchObject({
      tool: 'gemini',
      stream: 'system',
      eventType: 'unknown',
      confidence: 0.1,
      phase: 'error',
      instanceId: 'gemini-timeout',
      payload: { elapsedMs: 30500, kind: 'unknown', reason: 'no-stdout-timeout', timeoutMs: 30000 }
    })
    expect(service.getCliProgress({ tool: 'gemini', limit: 1 }).latest).toMatchObject({
      eventType: 'unknown',
      instanceId: 'gemini-timeout'
    })
    expect(auditSpy).toHaveBeenCalledWith('ai:gemini-stdout-timeout', expect.objectContaining({
      elapsedMs: 30500,
      instanceId: 'gemini-timeout',
      severity: 'WARN',
      timeoutMs: 30000
    }), 'success', 'E_TIMEOUT')
    service.dispose()
    dateSpy.mockRestore()
    auditSpy.mockRestore()
  })

  it('switches CLI parser strategy for an existing session', () => {
    const service = createRuntimeService(() => null, runtime as never)
    service.parseCliChunk({ tool: 'codex', stream: 'stdout', instanceId: 'codex-switch-service', chunk: 'Step 1/2 running' })

    const selected = service.selectCliStrategy({ instanceId: 'codex-switch-service', strategy: 'shim' })

    expect(selected.success).toBe(true)
    expect(selected.session.strategy).toBe('shim')
    expect(service.listCliStrategyAudit()[0]).toMatchObject({
      type: 'cli:select-strategy',
      instanceId: 'codex-switch-service',
      fromStrategy: 'line',
      toStrategy: 'shim'
    })
  })

  it('validates tool override paths and detects the override command', async () => {
    const service = createRuntimeService(() => null, runtime as never)

    expect(() => service.setToolOverride({ tool: 'codex', path: 'Z:/definitely-missing/codex.exe', confirmedBy: 'vitest' })).toThrow('E_VALIDATION')
    expect(service.setToolOverride({ tool: 'codex', path: process.execPath, confirmedBy: 'vitest' })).toMatchObject({ tool: 'codex', path: process.execPath })
    const detected = await service.detectTool({ tool: 'codex', force: true })

    expect(detected.found).toBe(true)
    expect(detected.path).toBe(process.execPath)
    expect(detected.detectStrategy).toBe('user-override')
    expect(service.clearToolOverride({ tool: 'codex', confirmedBy: 'vitest' })).toMatchObject({ tool: 'codex', cleared: true, previousPath: process.execPath })
    expect(service.clearToolOverride({ tool: 'codex', confirmedBy: 'vitest' })).toMatchObject({ tool: 'codex', cleared: false, previousPath: null })
  })

  it('returns five-tool detection state, broadcasts it, and uses module-list for window-only tools', async () => {
    const send = vi.fn()
    const runtimeWithWindows = {
      scannerCache: {
        getSnapshot: () => ({
          windows: {
            data: [
              { hwnd: 101, pid: 1101, processName: 'Cursor.exe', title: 'Cursor - Editing main.ts' },
              { hwnd: 102, pid: 1102, processName: 'Code.exe', title: 'Visual Studio Code - main.ts (Copilot suggesting)' }
            ]
          },
          aiTasks: { data: [] },
          processes: { data: [] }
        })
      }
    }
    const service = createRuntimeService(() => ({ webContents: { send } }) as never, runtimeWithWindows as never)
    service.setToolOverride({ tool: 'codex', path: process.execPath, confirmedBy: 'vitest' })

    const state = await service.detectTools({ force: true })

    expect(state.results).toHaveLength(5)
    expect(state.results.find(result => result.tool === 'codex')).toMatchObject({ found: true, detectStrategy: 'user-override' })
    expect(state.results.find(result => result.tool === 'cursor')).toMatchObject({ found: true, detectStrategy: 'module-list', recommendedParser: 'window-title' })
    expect(state.results.find(result => result.tool === 'copilot')).toMatchObject({ found: true, detectStrategy: 'module-list' })
    expect(state.scanDurationMs).toBeGreaterThanOrEqual(0)
    expect(send).toHaveBeenCalledWith('cli:detection-event', expect.objectContaining({ results: expect.any(Array) }))
  })

  it('detects all five AI tools from scanner snapshots without treating plain gh as Copilot', async () => {
    const service = createRuntimeService(() => null, {
      scannerCache: {
        getSnapshot: () => ({
          windows: {
            data: [
              { hwnd: 201, pid: 2201, processName: 'Cursor.exe', title: 'Cursor - repository' },
              { hwnd: 202, pid: 2202, processName: 'Code.exe', title: 'Visual Studio Code - GitHub Copilot Chat' }
            ]
          },
          aiTasks: {
            data: [
              { tool: 'codex', pid: 2301, commandLine: 'node C:/Users/HP/AppData/Roaming/npm/node_modules/@openai/codex/bin/codex.js' },
              { tool: 'claude', pid: 2302, commandLine: 'C:/Users/HP/AppData/Roaming/npm/claude.cmd --print' }
            ]
          },
          processes: {
            data: [
              { pid: 2303, processName: 'gemini.cmd', commandLine: 'gemini --prompt status' },
              { pid: 2304, processName: 'gh.exe', commandLine: 'gh auth status' }
            ]
          }
        })
      }
    } as never)

    const state = await service.detectTools({ force: true })
    const byTool = new Map(state.results.map(result => [result.tool, result]))

    expect([...byTool.keys()].sort()).toEqual(['claude', 'codex', 'copilot', 'cursor', 'gemini'])
    expect(byTool.get('codex')).toMatchObject({ found: true, detectStrategy: 'module-list', recommendedParser: 'shim' })
    expect(byTool.get('claude')).toMatchObject({ found: true, detectStrategy: 'module-list', recommendedParser: 'ndjson' })
    expect(byTool.get('gemini')).toMatchObject({ found: true, detectStrategy: 'module-list', recommendedParser: 'line' })
    expect(byTool.get('cursor')).toMatchObject({ found: true, detectStrategy: 'module-list', recommendedParser: 'window-title' })
    expect(byTool.get('copilot')).toMatchObject({ found: true, detectStrategy: 'module-list', recommendedParser: 'window-title' })

    const matcher = service as unknown as { rowLooksLikeTool: (row: unknown, tool: 'copilot') => boolean }
    expect(matcher.rowLooksLikeTool({ processName: 'gh.exe', commandLine: 'gh auth status' }, 'copilot')).toBe(false)
  })

  it('prefers live Codex scanner evidence over a stale timeout cache entry', async () => {
    const checkedAt = Date.now()
    const runtimeStore = new Store<TestRuntimeStoreShape>({ name: 'devhub-r8-runtime' })
    runtimeStore.set('toolDetectCache', {
      codex: {
        tool: 'codex',
        found: false,
        version: null,
        path: 'C:/Users/HP/AppData/Roaming/npm/codex.CMD',
        detectStrategy: 'not-found',
        recommendedParser: null,
        capabilities: [],
        errors: ['CLI version probe timed out after 3000ms'],
        error: 'CLI version probe timed out after 3000ms',
        checkedAt,
        detectedAt: checkedAt
      }
    })
    const service = createRuntimeService(() => null, {
      scannerCache: {
        getSnapshot: () => ({
          windows: { data: [] },
          aiTasks: {
            data: [
              { tool: 'codex', pid: 2301, commandLine: 'node C:/Users/HP/AppData/Roaming/npm/node_modules/@openai/codex/bin/codex.js' }
            ]
          },
          processes: { data: [] }
        })
      }
    } as never)

    const detected = await service.detectTool({ tool: 'codex', force: false })

    expect(detected).toMatchObject({
      tool: 'codex',
      found: true,
      detectStrategy: 'module-list',
      recommendedParser: 'shim'
    })
    const serviceStore = (service as unknown as { store: Store<TestRuntimeStoreShape> }).store
    expect(serviceStore.get('toolDetectCache', {}).codex).toBeUndefined()
  })

  it('covers CLI detection GWT matrix with real executable overrides and cache reuse', async () => {
    const send = vi.fn()
    const service = createRuntimeService(() => ({ webContents: { send } }) as never, undefined)

    expect(() => service.setToolOverride({ tool: 'gemini', path: 'Z:/definitely-missing/gemini.exe', confirmedBy: 'vitest' })).toThrow('E_VALIDATION')
    const codexOverride = service.setToolOverride({ tool: 'codex', path: process.execPath, confirmedBy: 'vitest' })
    const claudeOverride = service.setToolOverride({ tool: 'claude', path: process.execPath, confirmedBy: 'vitest' })
    const geminiOverride = service.setToolOverride({ tool: 'gemini', path: process.execPath, confirmedBy: 'vitest' })

    expect(codexOverride).toMatchObject({ tool: 'codex', path: process.execPath })
    expect(claudeOverride).toMatchObject({ tool: 'claude', path: process.execPath })
    expect(geminiOverride).toMatchObject({ tool: 'gemini', path: process.execPath })

    const state = await service.detectTools({ force: true })
    const byTool = new Map(state.results.map(result => [result.tool, result]))

    expect(state.results.map(result => result.tool).sort()).toEqual(['claude', 'codex', 'copilot', 'cursor', 'gemini'])
    expect(byTool.get('codex')).toMatchObject({
      found: true,
      path: process.execPath,
      detectStrategy: 'user-override',
      recommendedParser: 'shim'
    })
    expect(byTool.get('codex')?.version).toMatch(/^v?\d+\./)
    expect(byTool.get('codex')?.capabilities).toContain('stream-json')
    expect(byTool.get('claude')).toMatchObject({
      found: true,
      path: process.execPath,
      detectStrategy: 'user-override',
      recommendedParser: 'ndjson'
    })
    expect(byTool.get('claude')?.capabilities).toContain('stream-json')
    expect(byTool.get('gemini')).toMatchObject({
      found: true,
      path: process.execPath,
      detectStrategy: 'user-override',
      recommendedParser: 'line'
    })

    const cachedCodex = await service.detectTool({ tool: 'codex', force: false })
    expect(cachedCodex.checkedAt).toBe(byTool.get('codex')?.checkedAt)
    expect(cachedCodex.version).toBe(byTool.get('codex')?.version)
    expect(send).toHaveBeenCalledWith('cli:detection-event', expect.objectContaining({
      results: expect.arrayContaining([
        expect.objectContaining({ tool: 'codex', found: true }),
        expect.objectContaining({ tool: 'claude', found: true }),
        expect.objectContaining({ tool: 'gemini', found: true })
      ])
    }))
  })

  it('queues CSV rows as durable task runs without pretending external CLI success', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const task = service.enqueueCsvRow({ id: `row-${Date.now()}`, tool: 'codex', prompt: 'run real checks', dry_run: true })

    expect(task.status).toBe('queued')
    expect(task.error).toContain('dry_run queued')
    expect(service.queueStats().total).toBeGreaterThanOrEqual(1)
  })

  it('uses the enum task queue engine selector and real queue.sqlite storage by default', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const task = service.enqueueCsvRow({ id: `sqlite-row-${Date.now()}`, group: 'sqlite-engine', tool: 'codex', prompt: 'persist in sqlite', dry_run: true })
    const status = service.getTaskQueueStorageStatus()

    expect(task.status).toBe('queued')
    expect(status).toMatchObject({
      flag: 'R8.C.task.queue.engine',
      engine: 'better-queue',
      backend: 'sqlite-kv-indexed',
      sqliteIntegrity: { status: 'ok' },
      nativeBetterQueueAvailable: true,
      nativeBetterQueueSqliteAvailable: false,
      nativeSqlite3Available: false,
      switchRequiresRestart: true
    })
    expect(status.allowedEngines).toEqual(['better-queue', 'p-queue'])
    expect(status.sqlitePath).toBe(join(defaultUserDataRoot, 'queue.sqlite'))
    expect(existsSync(join(defaultUserDataRoot, 'queue.sqlite'))).toBe(true)
    expect(status.warning).toContain('better-queue-sqlite is not available')

    const fallback = service.setTaskQueueEngine({ engine: 'p-queue', confirmedBy: 'vitest' })
    expect(fallback).toMatchObject({ engine: 'p-queue', switchRequiresRestart: true })
    expect(fallback.warning).toContain('restart is required')
  })

  it('exports real task results as CSV and JSON artifacts', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const sessionId = `export-session-${randomUUID()}`
    const taskId = `export-task-a-${randomUUID()}`
    service.enqueueCsvRow({
      id: taskId,
      group: sessionId,
      tool: 'codex',
      prompt: 'write result, with csv "quotes"',
      output_path: join(defaultUserDataRoot, 'task-artifacts', taskId),
      retries: 0
    })
    const started = service.startReadyTasks({ sessionId, concurrent: 1 }).started[0]
    const completed = service.completeTaskRun({ runId: started.runId, exitCode: 0 })
    const result = await service.exportTaskResults({
      sessionId,
      format: 'both',
      outputDir: join(defaultUserDataRoot, 'result-export'),
      confirmedBy: 'vitest'
    })

    expect(result).toMatchObject({
      success: true,
      scope: 'session',
      sessionId,
      taskCount: 1,
      runIds: [completed.runId],
      artifactDir: join(defaultUserDataRoot, 'result-export')
    })
    expect(result.files.map(file => file.format).sort()).toEqual(['csv', 'json'])
    for (const file of result.files) {
      expect(existsSync(file.path)).toBe(true)
      expect(file.bytes).toBeGreaterThan(0)
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/)
    }

    const jsonFile = result.files.find(file => file.format === 'json')
    const csvFile = result.files.find(file => file.format === 'csv')
    if (!jsonFile || !csvFile) throw new Error('missing export files')
    const jsonPayload = JSON.parse(await readFile(jsonFile.path, 'utf8')) as { taskCount: number; tasks: Array<{ runId: string; status: string; artifactsPath: string | null }> }
    expect(jsonPayload.taskCount).toBe(1)
    expect(jsonPayload.tasks[0]).toMatchObject({
      runId: completed.runId,
      status: 'succeeded',
      artifactsPath: join(defaultUserDataRoot, 'task-artifacts', taskId)
    })
    const csvText = await readFile(csvFile.path, 'utf8')
    expect(csvText).toContain('runId,taskId,sessionId,status')
    expect(csvText).toContain(taskId)
    expect(csvText).toContain('"write result, with csv ""quotes"""')
  })

  it('audits on_fail branch and fallback tool switch transitions', () => {
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const service = createRuntimeService(() => null, runtime as never)
    const sessionId = `on-fail-audit-session-${randomUUID()}`
    const taskId = `on-fail-audit-${randomUUID()}`

    try {
      const task = service.enqueueCsvRow({
        id: taskId,
        group: sessionId,
        tool: 'codex',
        prompt: 'real on_fail fallback',
        retries: 0,
        on_fail: 'fallback-tool',
        fallback_tool: 'gemini'
      })
      const started = service.startReadyTasks({ sessionId, concurrent: 1 }).started[0]
      service.completeTaskRun({ runId: started.runId, exitCode: 1, errorCode: 'E_TOOL' })

      expect(service.listTasks({ sessionId }).find(item => item.runId === task.runId)?.row.tool).toBe('gemini')
      expect(auditSpy).toHaveBeenCalledWith('task:tool-switch', expect.objectContaining({
        taskId: task.row.id,
        prev: 'running',
        next: 'retrying',
        reason: 'on-fail-fallback-tool'
      }), 'success', 'on-fail-fallback-tool')
    } finally {
      auditSpy.mockRestore()
    }
  })

  it('executes on_fail SKILL scripts locally and records real artifacts before retry', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-on-fail-skill-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const service = createRuntimeService(() => null, runtime as never)
    const previousLibraryEnabled = service.getFeatureFlag('R8.C.skill.library')
    service.setFeatureFlag({ flag: 'R8.C.skill.library', value: true, confirmedBy: 'vitest' })
    const sessionId = `skill-exec-session-${randomUUID()}`

    try {
      const skillDir = join(userData, 'skills', 'on-fail-recovery')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'run.js'), [
        "const fs = require('node:fs')",
        'const contextPath = process.argv[2]',
        "if (!contextPath) { console.error('missing context'); process.exit(2) }",
        "const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'))",
        "if (context.kind !== 'devhub.on_fail.execute_skill') process.exit(3)",
        "if (context.task.row.id !== 'skill-exec-task') process.exit(4)",
        "fs.writeFileSync(`${contextPath}.seen`, JSON.stringify({ runId: context.task.runId, errorCode: context.failure.errorCode }))",
        "console.log(JSON.stringify({ ok: true, taskId: context.task.row.id, errorCode: context.failure.errorCode }))",
        ''
      ].join('\n'), 'utf8')
      await writeFile(join(skillDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: on-fail-recovery',
        'displayName: "On Fail Recovery"',
        'version: "1.0.0"',
        'description: "Executes against a real DevHub on_fail failure context file."',
        'author: "Vitest"',
        'license: "MIT"',
        'sandbox: read-write',
        'tags: [queue]',
        'inputs:',
        '  - name: file',
        '    type: file',
        '    required: true',
        'outputs:',
        '  - name: report',
        '    type: json',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read, fs-write]',
        '---',
        '# On Fail Recovery',
        ''
      ].join('\n'), 'utf8')

      service.enqueueCsvRow({
        id: 'skill-exec-task',
        group: sessionId,
        tool: 'codex',
        prompt: 'real failing task triggers local skill',
        retries: 0,
        on_fail: 'execute-skill',
        execute_skill: 'on-fail-recovery',
        timeout_ms: 5_000
      })
      const started = service.startReadyTasks({ sessionId, concurrent: 1 }).started[0]
      const pending = service.completeTaskRun({ runId: started.runId, exitCode: 1, errorCode: 'E_REAL_FAIL', errorMessage: 'real executor failure' })
      expect(pending).toMatchObject({ status: 'awaiting-human', errorCode: 'ON_FAIL_EXECUTE_SKILL_RUNNING' })

      await waitUntil(() => {
        const current = service.listTasks({ sessionId })[0]
        return current?.status === 'queued' && current.errorCode === 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED' && typeof current.artifactsPath === 'string'
      }, 3000)

      const updated = service.listTasks({ sessionId })[0]
      expect(updated).toMatchObject({
        status: 'queued',
        errorCode: 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED',
        retryBackoffMs: 0
      })
      expect(updated.artifactsPath && existsSync(updated.artifactsPath)).toBe(true)
      const contextText = await readFile(join(updated.artifactsPath ?? '', 'failure-context.json'), 'utf8')
      const stdoutText = await readFile(join(updated.artifactsPath ?? '', 'stdout.txt'), 'utf8')
      const resultText = await readFile(join(updated.artifactsPath ?? '', 'result.json'), 'utf8')
      const seenText = await readFile(join(updated.artifactsPath ?? '', 'failure-context.json.seen'), 'utf8')
      expect(contextText).toContain('E_REAL_FAIL')
      expect(stdoutText).toContain('skill-exec-task')
      expect(resultText).toContain('"success": true')
      expect(seenText).toContain('E_REAL_FAIL')
      expect(auditSpy).toHaveBeenCalledWith('task:on-fail-skill', expect.objectContaining({
        taskId: 'skill-exec-task',
        skillName: 'on-fail-recovery',
        status: 'queued'
      }), 'success', 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED')
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.library', value: previousLibraryEnabled, confirmedBy: 'vitest-restore' })
      auditSpy.mockRestore()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('enforces read-only SKILL sandbox by blocking write side effects', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-on-fail-skill-read-only-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    const previousLibraryEnabled = service.getFeatureFlag('R8.C.skill.library')
    service.setFeatureFlag({ flag: 'R8.C.skill.library', value: true, confirmedBy: 'vitest' })

    try {
      const skillDir = join(userData, 'skills', 'read-only-recovery')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'run.js'), [
        "const fs = require('node:fs')",
        'const contextPath = process.argv[2]',
        "fs.writeFileSync(`${contextPath}.seen`, 'should be blocked')",
        "console.log('unexpected success')",
        ''
      ].join('\n'), 'utf8')
      await writeFile(join(skillDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: read-only-recovery',
        'displayName: "Read Only Recovery"',
        'version: "1.0.0"',
        'description: "Attempts a write that the read-only sandbox must block."',
        'author: "Vitest"',
        'license: "MIT"',
        'sandbox: read-only',
        'tags: [queue]',
        'inputs: []',
        'outputs:',
        '  - name: report',
        '    type: json',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read]',
        '---',
        '# Read Only Recovery',
        ''
      ].join('\n'), 'utf8')

      service.enqueueCsvRow({
        id: 'read-only-skill-task',
        group: 'read-only-skill-session',
        tool: 'codex',
        prompt: 'read-only sandbox task',
        retries: 0,
        on_fail: 'execute-skill',
        execute_skill: 'read-only-recovery',
        timeout_ms: 5_000
      })
      const started = service.startReadyTasks({ sessionId: 'read-only-skill-session', concurrent: 1 }).started[0]
      service.completeTaskRun({ runId: started.runId, exitCode: 1, errorCode: 'E_REAL_FAIL', errorMessage: 'real executor failure' })

      await waitUntil(() => {
        const current = service.listTasks({ sessionId: 'read-only-skill-session' })[0]
        return current?.status === 'awaiting-human' && current.errorCode === 'E_SKILL_EXECUTION_FAILED' && typeof current.artifactsPath === 'string'
      }, 3000)

      const updated = service.listTasks({ sessionId: 'read-only-skill-session' })[0]
      expect(existsSync(join(updated.artifactsPath ?? '', 'failure-context.json.seen'))).toBe(false)
      expect(await readFile(join(updated.artifactsPath ?? '', 'stderr.txt'), 'utf8')).toContain('E_PERMISSION:read-only skill cannot use fs.writeFileSync')
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.library', value: previousLibraryEnabled, confirmedBy: 'vitest-restore' })
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('permits system SKILL sandbox to run child processes explicitly', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-on-fail-skill-system-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    const previousLibraryEnabled = service.getFeatureFlag('R8.C.skill.library')
    service.setFeatureFlag({ flag: 'R8.C.skill.library', value: true, confirmedBy: 'vitest' })
    const sessionId = `system-skill-session-${randomUUID()}`

    try {
      const skillDir = join(userData, 'skills', 'system-recovery')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'run.js'), [
        "const fs = require('node:fs')",
        "const childProcess = require('node:child_process')",
        'const contextPath = process.argv[2]',
        "const child = childProcess.execFileSync(process.execPath, ['-e', 'process.stdout.write(\"system-ok\")'], { encoding: 'utf8' })",
        "fs.writeFileSync(`${contextPath}.seen`, child)",
        'console.log(child)',
        ''
      ].join('\n'), 'utf8')
      await writeFile(join(skillDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: system-recovery',
        'displayName: "System Recovery"',
        'version: "1.0.0"',
        'description: "Uses the system sandbox to run an explicit local child process."',
        'author: "Vitest"',
        'license: "MIT"',
        'sandbox: system',
        'tags: [queue]',
        'inputs: []',
        'outputs:',
        '  - name: report',
        '    type: json',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read, fs-write, exec]',
        '---',
        '# System Recovery',
        ''
      ].join('\n'), 'utf8')

      service.enqueueCsvRow({
        id: 'system-skill-task',
        group: sessionId,
        tool: 'codex',
        prompt: 'system sandbox task',
        retries: 0,
        on_fail: 'execute-skill',
        execute_skill: 'system-recovery',
        timeout_ms: 5_000
      })
      const started = service.startReadyTasks({ sessionId, concurrent: 1 }).started[0]
      service.completeTaskRun({ runId: started.runId, exitCode: 1, errorCode: 'E_REAL_FAIL', errorMessage: 'real executor failure' })

      await waitUntil(() => {
        const current = service.listTasks({ sessionId })[0]
        return current?.status === 'queued' && current.errorCode === 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED' && typeof current.artifactsPath === 'string'
      }, 3000)

      const updated = service.listTasks({ sessionId })[0]
      expect(await readFile(join(updated.artifactsPath ?? '', 'failure-context.json.seen'), 'utf8')).toBe('system-ok')
      expect(await readFile(join(updated.artifactsPath ?? '', 'stdout.txt'), 'utf8')).toContain('system-ok')
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.library', value: previousLibraryEnabled, confirmedBy: 'vitest-restore' })
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('passes MCP stdio server metadata to system SKILL scripts that call a real local server', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-on-fail-skill-mcp-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    const previousLibraryEnabled = service.getFeatureFlag('R8.C.skill.library')
    service.setFeatureFlag({ flag: 'R8.C.skill.library', value: true, confirmedBy: 'vitest' })
    const sessionId = `mcp-skill-session-${randomUUID()}`

    try {
      const skillDir = join(userData, 'skills', 'mcp-recovery')
      await mkdir(skillDir, { recursive: true })
      const serverPath = join(skillDir, 'mcp-server.js')
      await writeFile(serverPath, [
        "const readline = require('node:readline')",
        "const rl = readline.createInterface({ input: process.stdin })",
        "function send(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n') }",
        "rl.on('line', line => {",
        '  const request = JSON.parse(line)',
        "  if (request.method === 'initialize') send(request.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'devhub-test-mcp', version: '1.0.0' } })",
        "  else if (request.method === 'tools/list') send(request.id, { tools: [{ name: 'echo', inputSchema: { type: 'object' } }] })",
        "  else if (request.method === 'tools/call') send(request.id, { content: [{ type: 'text', text: `echo:${request.params.arguments.message}` }] })",
        '})',
        ''
      ].join('\n'), 'utf8')
      await writeFile(join(skillDir, 'run.js'), [
        "const fs = require('node:fs')",
        "const childProcess = require('node:child_process')",
        'const contextPath = process.argv[2]',
        'const servers = JSON.parse(process.env.DEVHUB_SKILL_MCP_SERVERS_JSON || "[]")',
        'const server = servers[0]',
        "if (!server || server.name !== 'local-echo') process.exit(2)",
        "const child = childProcess.spawn(server.command, server.args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...server.env } })",
        "let buffer = ''",
        'let seq = 0',
        'const pending = new Map()',
        "child.stdout.on('data', chunk => {",
        "  buffer += String(chunk)",
        "  for (;;) {",
        "    const index = buffer.indexOf('\\n')",
        '    if (index < 0) break',
        '    const line = buffer.slice(0, index)',
        '    buffer = buffer.slice(index + 1)',
        '    if (!line.trim()) continue',
        '    const message = JSON.parse(line)',
        '    const resolve = pending.get(message.id)',
        '    if (resolve) { pending.delete(message.id); resolve(message.result) }',
        '  }',
        '})',
        'function request(method, params) {',
        '  const id = ++seq',
        '  const payload = { jsonrpc: "2.0", id, method, params }',
        '  return new Promise(resolve => { pending.set(id, resolve); child.stdin.write(JSON.stringify(payload) + "\\n") })',
        '}',
        '(async () => {',
        "  await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'devhub-skill-test', version: '1.0.0' } })",
        "  const listed = await request('tools/list', {})",
        "  const called = await request('tools/call', { name: 'echo', arguments: { message: 'real' } })",
        "  fs.writeFileSync(`${contextPath}.mcp`, JSON.stringify({ listed, called }))",
        '  child.kill()',
        "  console.log(called.content[0].text)",
        '})().catch(error => { console.error(error); child.kill(); process.exit(1) })',
        ''
      ].join('\n'), 'utf8')
      await writeFile(join(skillDir, 'SKILL.md'), [
        '---',
        'schemaVersion: "1.0"',
        'name: mcp-recovery',
        'displayName: "MCP Recovery"',
        'version: "1.0.0"',
        'description: "Calls a real local MCP stdio server through declared metadata."',
        'author: "Vitest"',
        'license: "MIT"',
        'sandbox: system',
        'tags: [queue, mcp]',
        'inputs: []',
        'outputs:',
        '  - name: report',
        '    type: json',
        'scriptPath: "./run.js"',
        'runtime: node',
        'permissions: [fs-read, fs-write, exec]',
        'mcpServers:',
        '  - name: local-echo',
        '    transport: stdio',
        `    command: "${process.execPath.replaceAll('\\', '/')}"`,
        `    args: ["${serverPath.replaceAll('\\', '/')}"]`,
        '---',
        '# MCP Recovery',
        ''
      ].join('\n'), 'utf8')

      service.enqueueCsvRow({
        id: 'mcp-skill-task',
        group: sessionId,
        tool: 'codex',
        prompt: 'mcp sandbox task',
        retries: 0,
        on_fail: 'execute-skill',
        execute_skill: 'mcp-recovery',
        timeout_ms: 5_000
      })
      const started = service.startReadyTasks({ sessionId, concurrent: 1 }).started[0]
      service.completeTaskRun({ runId: started.runId, exitCode: 1, errorCode: 'E_REAL_FAIL', errorMessage: 'real executor failure' })

      await waitUntil(() => {
        const current = service.listTasks({ sessionId })[0]
        return current?.status === 'queued' && current.errorCode === 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED' && typeof current.artifactsPath === 'string'
      }, 3000)

      const updated = service.listTasks({ sessionId })[0]
      expect(await readFile(join(updated.artifactsPath ?? '', 'failure-context.json.mcp'), 'utf8')).toContain('echo:real')
      expect(await readFile(join(updated.artifactsPath ?? '', 'stdout.txt'), 'utf8')).toContain('echo:real')
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.library', value: previousLibraryEnabled, confirmedBy: 'vitest-restore' })
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('keeps injection dry-run real and blocks native execution while nut-js is disabled', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    service.addInjectWhitelist({ alias: 'r8-test', reason: 'vitest', confirmedBy: 'vitest' })
    const dryRun = service.dryRunInject({ targetAlias: 'r8-test', text: 'hello', dryRun: true })
    const blocked = await service.executeInject({ targetAlias: 'r8-test', text: 'hello', confirmedBy: 'vitest' })
    const auditDbPath = join(defaultUserDataRoot, 'inject-audit.sqlite')
    const database = new DatabaseConstructor(auditDbPath, { readonly: true })

    try {
      const auditRow = database.prepare('SELECT text, text_hash FROM inject_audit_records WHERE action_id = ?').get(dryRun.actionId) as { text: string; text_hash: string } | undefined

      expect(dryRun.success).toBe(true)
      expect(dryRun.characters).toBe(5)
      expect(blocked.failureKind).toBe('native-disabled')
      expect(existsSync(auditDbPath)).toBe(true)
      expect(auditRow).toMatchObject({ text: 'hello', text_hash: dryRun.textHash })
    } finally {
      database.close()
    }
  })

  it('triggers csv-task-driven inject from a real allow_inject task start', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const sessionId = `r8c-spec18-task-start-${randomUUID()}`
    const rowId = `inject-start-${randomUUID()}`
    const targetAlias = `codex-${rowId}`
    const prompt = 'Task queue start should trigger real csv-task-driven inject'

    service.addInjectWhitelist({
      alias: targetAlias,
      scenarios: ['csv-task-driven'],
      reason: 'vitest task-start inject',
      confirmedBy: 'vitest'
    })
    service.enqueueCsvRow({
      id: rowId,
      group: sessionId,
      tool: 'codex',
      prompt,
      cwd: process.cwd(),
      allow_inject: true,
      retries: 0
    })
    const started = service.startReadyTasks({ sessionId, concurrent: 1 }).started[0]

    expect(started).toMatchObject({
      status: 'running',
      row: { allow_inject: true }
    })
    await waitUntil(() => Boolean(service.listTasks({ sessionId })[0]?.injectActionId), 3000)

    const task = service.listTasks({ sessionId })[0]
    const injectHistory = service.listInjectHistory().find(entry => entry.injectId === task.injectActionId)
    const auditDbPath = join(defaultUserDataRoot, 'inject-audit.sqlite')
    const database = new DatabaseConstructor(auditDbPath, { readonly: true })

    try {
      const auditRow = database.prepare('SELECT scenario, target_alias, text, status FROM inject_audit_records WHERE action_id = ?').get(task.injectActionId) as { scenario: string; target_alias: string; text: string; status: string } | undefined

      expect(task.injectActionId).toEqual(expect.any(String))
      expect(injectHistory).toMatchObject({
        injectId: task.injectActionId,
        targetAlias,
        status: 'blocked',
        confirmedBy: 'task-queue-start'
      })
      expect(auditRow).toMatchObject({
        scenario: 'csv-task-driven',
        target_alias: targetAlias,
        text: prompt,
        status: 'failed'
      })
    } finally {
      database.close()
    }
  })

  it('streams inject countdown before truthful native execution failure', async () => {
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const actionId = randomUUID()
    const alias = `r8-countdown-${randomUUID()}`

    service.addInjectWhitelist({ alias, reason: 'vitest', confirmedBy: 'vitest' })
    service.configureInjectCountdown({ defaultMs: 220, confirmedBy: 'vitest' })
    const result = await service.executeInject({ id: actionId, targetAlias: alias, text: 'hello', confirmedBy: 'vitest' })
    const streamCalls = mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'inject:countdown-stream')
    const phases = streamCalls.map(([, payload]) => {
      const typedPayload = payload as { phase?: string }
      return typedPayload.phase
    })

    expect(result.actionId).toBe(actionId)
    expect(result.failureKind).toBe('native-disabled')
    expect(phases[0]).toBe('scheduled')
    expect(phases).toContain('tick')
    expect(phases.at(-1)).toBe('completed')
    expect(streamCalls.every(([, payload]) => {
      const typedPayload = payload as { actionId?: string; targetAlias?: string; totalMs?: number }
      return typedPayload.actionId === actionId && typedPayload.targetAlias === alias && typedPayload.totalMs === 220
    })).toBe(true)
  })

  it('cancels inject countdown without reaching native execution', async () => {
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const actionId = randomUUID()
    const alias = `r8-countdown-cancel-${randomUUID()}`

    service.addInjectWhitelist({ alias, reason: 'vitest', confirmedBy: 'vitest' })
    service.configureInjectCountdown({ defaultMs: 500, confirmedBy: 'vitest' })
    const executing = service.executeInject({ id: actionId, targetAlias: alias, text: 'hello', confirmedBy: 'vitest' })
    await waitUntil(() => mainWindow.webContents.send.mock.calls.some(([channel, payload]) => channel === 'inject:countdown-stream' && payload?.phase === 'scheduled'))
    expect(service.cancelInjectCountdown({ actionId, confirmedBy: 'vitest' }).cancelled).toBe(true)
    const result = await executing
    const streamCalls = mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'inject:countdown-stream')
    const phases = streamCalls.map(([, payload]) => {
      const typedPayload = payload as { phase?: string }
      return typedPayload.phase
    })
    const terminalHistory = service.listInjectHistory().filter(entry => entry.injectId === actionId && ['blocked', 'executed'].includes(entry.status))

    expect(result).toMatchObject({
      actionId,
      status: 'cancelled',
      success: false,
      failureKind: 'ignored',
      injectedLength: 0
    })
    expect(phases).toContain('cancelled')
    expect(phases).not.toContain('completed')
    expect(terminalHistory).toHaveLength(0)
  })

  it('fuses AI signals with weighted decay and transparent contribution percentages', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const now = 60_000
    const fused = service.fuseSignals({
      instanceId: 'ai-1',
      now,
      samples: [
        { source: 'cli_parse', rawValue: 0.6, confidence: 0.95, ts: now },
        { source: 'window_title', rawValue: 0.2, confidence: 0.4, ts: now }
      ]
    })

    const sum = fused.contributions.reduce((total, contribution) => total + contribution.contributionPct, 0)
    const snapshot = service.getSignalContributions({ instanceId: 'ai-1' })
    expect(sum).toBeCloseTo(1, 5)
    expect(fused.fusedProgress.percent).toBeGreaterThanOrEqual(0.5)
    expect(fused.fusedProgress.percent).toBeLessThanOrEqual(0.7)
    expect(snapshot.contributions.cli_parse.contributionPct).toBeGreaterThanOrEqual(0.7)
    expect(Object.values(snapshot.contributions).reduce((total, contribution) => total + contribution.contributionPct, 0)).toBeCloseTo(1, 5)
    expect(service.getInstanceState({ instanceId: 'ai-1' }).task).toBe(fused.state)
  })

  it('audits newly detected state assertion violations without disabling old task state paths', () => {
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const service = createRuntimeService(() => null, runtime as never)

    const state = service.transitionInstanceState({ instanceId: 'ai-dead', layer: 'system', event: 'process-exit', reason: 'real process exit' })

    expect(state.system).toBe('dead')
    expect(state.assertionViolations.map(item => item.rule)).toEqual(expect.arrayContaining([
      'system-dead-implies-task-error',
      'system-dead-implies-ui-alert'
    ]))
    expect(auditSpy).toHaveBeenCalledWith('ai:state-assertion-violation', expect.objectContaining({
      instanceId: 'ai-dead',
      rule: 'system-dead-implies-task-error',
      system: 'dead',
      task: 'idle',
      ui: 'hidden'
    }), 'error')
    auditSpy.mockRestore()
  })

  it('caps confidence when fusion has no cli_parse source', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const now = 90_000
    const fused = service.fuseSignals({
      instanceId: 'ai-no-cli',
      now,
      samples: [
        { source: 'window_title', rawValue: 0.7, confidence: 0.95, ts: now },
        { source: 'process_cpu_io', rawValue: 0.8, confidence: 0.9, ts: now }
      ]
    })

    expect(fused.fusedProgress.source).toBe('fusion')
    expect(fused.fusedProgress.confidence).toBeLessThanOrEqual(0.6)
  })

  it('applies user weight profiles and decays stale cli_parse signals', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const profile = service.setWeightProfile({
      profileId: 'user-custom',
      weights: { cli_parse: 0.5, window_title: 0.5, process_cpu_io: 0, task_queue: 0, watchdog: 0, user_feedback: 0 },
      confirmedBy: 'vitest'
    })
    expect(profile.success).toBe(true)
    expect(profile.profileId).toBe('user-custom')
    expect(profile.normalizedWeights.cli_parse).toBeCloseTo(0.5, 5)
    expect(service.listWeightProfiles().map(item => item.profileId)).toEqual(['default', 'cli-heavy', 'window-heavy', 'user-custom'])

    const fresh = service.fuseSignals({
      instanceId: 'ai-fresh',
      now: 120_000,
      samples: [
        { source: 'cli_parse', rawValue: 0.6, confidence: 0.95, ts: 120_000 },
        { source: 'window_title', rawValue: 0.6, confidence: 0.4, ts: 120_000 }
      ]
    })
    const stale = service.fuseSignals({
      instanceId: 'ai-stale',
      now: 120_000,
      samples: [
        { source: 'cli_parse', rawValue: 0.6, confidence: 0.95, ts: 90_000 },
        { source: 'window_title', rawValue: 0.6, confidence: 0.4, ts: 120_000 }
      ]
    })

    const freshCli = fresh.contributions.find(item => item.source === 'cli_parse')
    const staleCli = stale.contributions.find(item => item.source === 'cli_parse')
    expect(freshCli?.decayedConfidence).toBeCloseTo(0.95, 5)
    expect(staleCli?.decayedConfidence ?? 1).toBeLessThanOrEqual((freshCli?.decayedConfidence ?? 0) * 0.5)
  })


  it('requires confirmation for command history clearing', () => {
    const service = createRuntimeService(() => null, runtime as never)

    expect(() => service.clearCommandHistory({})).toThrow('E_PERMISSION')
    expect(service.clearCommandHistory({ confirmedBy: 'vitest' }).success).toBe(true)
  })

  it('persists command history as deduplicated recent entries with use counts', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    service.clearCommandHistory({ confirmedBy: 'vitest' })

    await service.invokeCommand({ commandId: 'monitor.process' })
    await service.invokeCommand({ commandId: 'monitor.ai-task', confirmedBy: 'vitest' })
    await service.invokeCommand({ commandId: 'monitor.process', confirmedBy: 'vitest' })

    const history = service.listCommandHistory()
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({ commandId: 'monitor.process', confirmedBy: 'vitest', useCount: 2 })
    expect(history[1]).toMatchObject({ commandId: 'monitor.ai-task', confirmedBy: 'vitest', useCount: 1 })
    expect(history.every(item => item.invokedAt > 0)).toBe(true)
  })

  it('supports standalone command history writes and rejects unsafe custom commands', () => {
    const service = createRuntimeService(() => null, runtime as never)
    service.clearCommandHistory({ confirmedBy: 'vitest' })

    expect(service.addCommandHistory({
      commandId: 'custom.audit-pack',
      invokedAt: 1_700_000_000_000,
      confirmedBy: 'vitest',
      useCount: 2
    })).toMatchObject({ commandId: 'custom.audit-pack', useCount: 2 })
    expect(service.addCommandHistory({
      commandId: 'custom.audit-pack',
      invokedAt: 1_700_000_000_001,
      confirmedBy: 'vitest',
      useCount: 1
    })).toMatchObject({ commandId: 'custom.audit-pack', useCount: 3 })
    expect(service.listCommandHistory()[0]).toMatchObject({ commandId: 'custom.audit-pack', useCount: 3 })

    expect(() => service.saveCustomCommand({
      id: 'custom.no-confirm',
      label: 'Missing confirmation',
      handlerScript: 'skill:run audit-pack'
    })).toThrow('E_PERMISSION')
    expect(() => service.saveCustomCommand({
      id: 'custom.unsafe',
      label: 'Unsafe command',
      handlerScript: 'Function("return process")()',
      confirmedBy: 'vitest'
    })).toThrow()

    const saved = service.saveCustomCommand({
      id: 'custom.audit-pack',
      label: 'Run audit pack',
      shortcut: ['Ctrl+Alt+A'],
      handlerScript: 'skill:run audit-pack',
      enabled: true,
      confirmedBy: 'vitest'
    })

    expect(saved.success).toBe(true)
    expect(saved.command).toMatchObject({
      id: 'custom.audit-pack',
      label: 'Run audit pack',
      confirmedBy: 'vitest',
      enabled: true
    })
    expect(saved.command.savedAt).toBeGreaterThan(0)
    expect(service.listCustomCommands().commands).toEqual(expect.arrayContaining([saved.command]))
  })

  it('registers and unregisters the devhub OS protocol behind confirmation', () => {
    const service = createRuntimeService(() => null, runtime as never)

    expect(() => service.registerOsProtocol({ register: true })).toThrow('E_PERMISSION')

    vi.mocked(app.setAsDefaultProtocolClient).mockReturnValueOnce(true)
    vi.mocked(app.isDefaultProtocolClient).mockReturnValueOnce(true)
    const registered = service.registerOsProtocol({ register: true, confirmedBy: 'vitest' })
    expect(app.setAsDefaultProtocolClient).toHaveBeenCalledWith('devhub')
    expect(registered).toMatchObject({
      success: true,
      registered: true,
      scheme: 'devhub',
      action: 'register',
      devMode: false
    })

    vi.mocked(app.removeAsDefaultProtocolClient).mockReturnValueOnce(true)
    vi.mocked(app.isDefaultProtocolClient).mockReturnValueOnce(false)
    const unregistered = service.registerOsProtocol({ register: false, confirmedBy: 'vitest' })
    expect(app.removeAsDefaultProtocolClient).toHaveBeenCalledWith('devhub')
    expect(unregistered).toMatchObject({
      success: true,
      registered: false,
      scheme: 'devhub',
      action: 'unregister'
    })
  })

  it('executes enabled custom commands through safe command and URI handlers', async () => {
    const send = vi.fn()
    const mainWindow = { isDestroyed: () => false, webContents: { send } }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    service.saveCustomCommand({
      id: 'custom.open-port-monitor',
      label: 'Open port monitor custom',
      shortcut: ['Ctrl+Alt+P'],
      handlerScript: 'command:monitor.port',
      enabled: true,
      confirmedBy: 'vitest'
    })
    service.saveCustomCommand({
      id: 'custom.open-port-uri',
      label: 'Open port URI custom',
      handlerScript: 'devhub://port/3000',
      enabled: true,
      confirmedBy: 'vitest'
    })

    expect(service.listCommands().find(command => command.id === 'custom.open-port-monitor')).toMatchObject({
      handler: 'custom',
      shortcut: 'Ctrl+Alt+P'
    })

    await service.invokeCommand({ commandId: 'custom.open-port-monitor', confirmedBy: 'vitest' })
    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'monitor-navigate', tab: 'port' })
    expect(service.listCommandHistory().map(item => item.commandId)).toEqual(expect.arrayContaining(['custom.open-port-monitor', 'monitor.port']))

    await service.invokeCommand({ commandId: 'custom.open-port-uri', confirmedBy: 'vitest' })
    expect(send).toHaveBeenCalledWith('r8:command-event', expect.objectContaining({ type: 'protocol-open', uri: 'devhub://port/3000' }))
    expect(service.listCommandHistory().map(item => item.commandId)).toContain('custom.open-port-uri')
  })

  it('generates CSV launch commands and only queues real execution sessions', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const row = { id: `launch-${Date.now()}`, tool: 'codex', prompt: 'run typecheck', dry_run: 'false' }

    expect(service.generateCsvCommand(row).command).toEqual(['codex', 'exec', 'run typecheck'])
    expect(() => service.launchCsvRow({ row })).toThrow('E_PERMISSION')

    const launched = service.launchCsvRow({ row, confirmedBy: 'vitest' })
    expect(launched.success).toBe(true)
    expect(launched.session.status).toBe('queued')
    expect(launched.note).toContain('queued only')
    expect(service.listCsvSessions().some(session => session.sessionId === launched.session.sessionId)).toBe(true)
  })

  it('schedules CSV groups with DAG dependency gates and parallel group limits', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-queue-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const tasksDir = join(userData, 'tasks')
    await mkdir(tasksDir, { recursive: true })
    const groupId = `queue-${Date.now()}`
    const filePath = join(tasksDir, `${groupId}.csv`)
    await writeFile(filePath, csvDocument([
      csvRow({ taskId: 'A', taskName: 'Root task', concurrencyKey: 'frontend' }),
      csvRow({ taskId: 'B', taskName: 'Child B', dependsOn: 'A', concurrencyKey: 'frontend' }),
      csvRow({ taskId: 'C', taskName: 'Child C', dependsOn: 'A', concurrencyKey: 'frontend' })
    ]), 'utf8')
    const service = createRuntimeService(() => null, runtime as never)
    const previousBuiltinEnabled = service.getFeatureFlag('R8.C.skill.builtin')
    service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: true, confirmedBy: 'vitest' })

    try {
      await service.reloadCsvGroups({ force: true })
      const enqueued = service.enqueueCsvGroup({ groupId, concurrent: 2, parallelGroupOverrides: { frontend: 1 } })
      expect(enqueued.tasks).toHaveLength(3)
      expect(enqueued.tasks.filter(task => task.status === 'waiting-dependency')).toHaveLength(2)

      const first = service.startReadyTasks({ sessionId: groupId, concurrent: 2, parallelGroupOverrides: { frontend: 1 } })
      expect(first.started.map(task => task.row.id)).toEqual(['A'])
      expect(first.started[0].parallelGroup).toBe('frontend')

      service.completeTaskRun({ runId: first.started[0].runId, exitCode: 0 })
      const second = service.startReadyTasks({ sessionId: groupId, concurrent: 2, parallelGroupOverrides: { frontend: 1 } })
      expect(second.started).toHaveLength(1)
      expect(['B', 'C']).toContain(second.started[0].row.id)
      expect(service.queueStats({ sessionId: groupId }).running).toBe(1)
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: previousBuiltinEnabled, confirmedBy: 'vitest-restore' })
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('streams task state transitions to renderer listeners', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-task-stream-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const sessionId = `task-stream-${randomUUID()}`

    try {
      const task = service.enqueueCsvRow({ id: 'stream-task', group: sessionId, tool: 'codex', prompt: 'real stream transition', retries: 0, dry_run: false, allow_inject: false })
      service.startReadyTasks({ sessionId, concurrent: 1 })
      service.completeTaskRun({ runId: task.runId, exitCode: 0 })

      await waitUntil(() => mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'task:state-stream').length >= 2, 1000)
      const streamCalls = mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'task:state-stream')
      expect(streamCalls.length).toBeGreaterThanOrEqual(2)
      expect(streamCalls[0]?.[1]).toMatchObject({
        transitions: [expect.objectContaining({ taskId: 'stream-task', prev: 'queued', next: 'running', reason: 'scheduler-start' })]
      })
      expect(streamCalls.at(-1)?.[1]).toMatchObject({
        transitions: [expect.objectContaining({ taskId: 'stream-task', prev: 'running', next: 'succeeded', reason: 'executor-success' })]
      })
      expect(auditSpy).toHaveBeenCalledWith('task:start', expect.objectContaining({ taskId: 'stream-task', prev: 'queued', next: 'running' }), 'success', 'scheduler-start')
      expect(auditSpy).toHaveBeenCalledWith('task:end', expect.objectContaining({ taskId: 'stream-task', prev: 'running', next: 'succeeded' }), 'success', 'executor-success')
    } finally {
      auditSpy.mockRestore()
      service.dispose()
      await removePathWithRetry(userData)
    }
  })

  it('automatically starts and stops real recordings for UUID task queue sessions', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-task-recording-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-r8c-task-recording-cwd-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const previousRecordingEnabled = service.getFeatureFlag('R8.C.recording.engine')
    service.setFeatureFlag({ flag: 'R8.C.recording.engine', value: true, confirmedBy: 'vitest' })

    try {
      const sessionId = randomUUID()
      const task = service.enqueueCsvRow({
        id: 'recording-auto-task',
        group: sessionId,
        tool: 'codex',
        prompt: 'run real task recording',
        cwd,
        retries: 0,
        dry_run: false,
        allow_inject: false
      })

      service.startReadyTasks({ sessionId, concurrent: 1 })
      await waitUntil(() => Boolean(service.listTasks({ sessionId }).find(item => item.runId === task.runId)?.recordingId))
      const runningTask = service.listTasks({ sessionId }).find(item => item.runId === task.runId)
      const recordingId = runningTask?.recordingId ?? ''
      expect(recordingId).toMatch(/^[0-9a-f-]{36}$/i)

      const manifestBeforeStop = await service.getRecordingManifest({ recordingId })
      expect(manifestBeforeStop.manifest).toMatchObject({
        recordingId,
        sessionId,
        taskId: 'recording-auto-task',
        source: 'csv-batch',
        status: 'recording'
      })

      service.completeTaskRun({ runId: task.runId, exitCode: 0 })
      await waitUntilAsync(async () => {
        const result = await service.getRecordingManifest({ recordingId })
        return result.manifest?.status === 'stopped'
      })

      const manifestAfterStop = await service.getRecordingManifest({ recordingId })
      expect(manifestAfterStop.manifest).toMatchObject({ recordingId, status: 'stopped' })
      expect(existsSync(manifestAfterStop.manifest?.manifestPath ?? '')).toBe(true)
      await waitUntil(() => auditSpy.mock.calls.some(([action, target, result, reason]) => (
        action === 'recording:task-auto-stop'
        && typeof target === 'object'
        && target !== null
        && 'runId' in target
        && target.runId === task.runId
        && 'recordingId' in target
        && target.recordingId === recordingId
        && 'next' in target
        && target.next === 'succeeded'
        && result === 'success'
        && reason === 'executor-success'
      )))
      expect(auditSpy).toHaveBeenCalledWith('recording:task-auto-start', expect.objectContaining({ runId: task.runId, recordingId }), 'success')
      expect(auditSpy).toHaveBeenCalledWith('recording:task-auto-stop', expect.objectContaining({ runId: task.runId, recordingId, next: 'succeeded' }), 'success', 'executor-success')
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.recording.engine', value: previousRecordingEnabled, confirmedBy: 'vitest-restore' })
      auditSpy.mockRestore()
      service.dispose()
      await rm(userData, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('emits real zero-percent progress when a task retries', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-retry-progress-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const previousRecordingEnabled = service.getFeatureFlag('R8.C.recording.engine')
    service.setFeatureFlag({ flag: 'R8.C.recording.engine', value: false, confirmedBy: 'vitest' })

    try {
      const sessionId = randomUUID()
      const task = service.enqueueCsvRow({
        id: 'retry-progress-reset',
        group: sessionId,
        tool: 'codex',
        prompt: 'real retry progress reset',
        retries: 1,
        dry_run: false,
        allow_inject: false
      })
      const started = service.startReadyTasks({ sessionId, concurrent: 1 }).started[0]
      expect(started.runId).toBe(task.runId)

      service.completeTaskRun({ runId: started.runId, exitCode: 1, errorCode: 'E_RETRY_REAL', errorMessage: 'real executor failure' })

      const csvResetEvent = mainWindow.webContents.send.mock.calls.find(([channel, payload]) => {
        return channel === 'csv:session-event-stream' &&
          payload?.type === 'task-progress' &&
          payload.data?.runId === started.runId &&
          payload.data?.percent === 0
      })?.[1]
      const cliResetEvent = mainWindow.webContents.send.mock.calls.find(([channel, payload]) => {
        return channel === 'cli:event-stream' &&
          payload?.instanceId === started.runId &&
          payload?.eventType === 'progress_pct' &&
          payload?.progress === 0
      })?.[1]

      expect(csvResetEvent).toMatchObject({
        sessionId,
        type: 'task-progress',
        data: {
          taskId: 'retry-progress-reset',
          runId: started.runId,
          percent: 0,
          reason: 'task-retry',
          prev: 'running',
          next: 'retrying'
        }
      })
      expect(cliResetEvent).toMatchObject({
        sessionId,
        instanceId: started.runId,
        progress: 0,
        payload: {
          source: 'csv-launch',
          kind: 'task-progress',
          taskId: 'retry-progress-reset'
        }
      })
      expect(auditSpy).toHaveBeenCalledWith('task:on-fail', expect.objectContaining({ taskId: 'retry-progress-reset', prev: 'running', next: 'retrying' }), 'success', 'on-fail-retry')
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.recording.engine', value: previousRecordingEnabled, confirmedBy: 'vitest-restore' })
      auditSpy.mockRestore()
      service.dispose()
      await removePathWithRetry(userData)
    }
  })

  it('loads 18 column CSV files and launches devhub or CLI sessions without fake runner success', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-csv-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const tasksDir = join(userData, 'tasks')
    await mkdir(tasksDir, { recursive: true })
    const filePath = join(tasksDir, 'batch-r8c.csv')
    const rowValues = csvRow({ taskId: `r8c-${Date.now()}` })
    await writeFile(filePath, csvDocument([rowValues]), 'utf8')
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const previousBuiltinEnabled = service.getFeatureFlag('R8.C.skill.builtin')
    const previousPythonEnabled = service.getFeatureFlag('R8.C.csv.launch.python')
    service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: true, confirmedBy: 'vitest' })
    service.setFeatureFlag({ flag: 'R8.C.csv.launch.python', value: false, confirmedBy: 'vitest' })

    try {
      expect(service.csvSchemaInfo().columnCount).toBe(18)
      expect(service.validateCsvHeader({ header: CSV_COLUMN_NAMES }).valid).toBe(true)
      expect(service.validateCsvRow(rowValues).mode).toBe('18-col')

      const reload = await service.reloadCsvGroups({ force: true })
      expect(reload).toMatchObject({ groupCount: 1, totalRows: 1, validRows: 1, errorCount: 0 })
      expect(service.listCsvGroups()[0].groupId).toBe('batch-r8c')
      expect(service.enqueueCsvGroup({ groupId: 'batch-r8c' }).taskRunIds).toHaveLength(1)

      const cli = await service.launchCsv({ csvPath: filePath, runner: 'cli', confirmedBy: 'vitest' })
      expect(cli.session.command).toContain('devhub run-csv')
      expect(cli.session.status).toBe('command-generated')
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('csv:session-event-stream', expect.objectContaining({ type: 'command-generated' }))
      expect(await readFile(join(userData, 'last-csv-command.txt'), 'utf8')).toContain('devhub run-csv')
      expect(await service.getCsvRunnerInfo({ kind: 'devhub' })).toMatchObject({ available: true })
      expect(await service.getCsvRunnerInfo({ kind: 'python' })).toMatchObject({ available: false, details: { reason: 'E_FEATURE_DISABLED' } })
      await expect(service.launchCsv({ csvPath: filePath, runner: 'python', confirmedBy: 'vitest' })).rejects.toThrow('E_FEATURE_DISABLED')

      const dryRun = await service.launchCsv({ csvPath: filePath, runner: 'devhub', dryRun: true, confirmedBy: 'vitest' })
      expect(dryRun.session.status).toBe('dry-run')
      expect(dryRun.tasks).toEqual([])
      if (!('dag' in dryRun)) throw new Error('expected dry-run DAG result')
      expect(dryRun.dag?.layers.flat()).toContain(rowValues.taskId)

      const launched = await service.launchCsv({ csvPath: filePath, runner: 'devhub', confirmedBy: 'vitest' })
      expect(launched.session.status).toBe('running')
      expect(launched.tasks).toHaveLength(1)
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('csv:session-event-stream', expect.objectContaining({ type: 'task-start' }))
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('cli:event-stream', expect.objectContaining({ sessionId: launched.session.sessionId, eventType: 'start' }))
      expect(auditSpy).toHaveBeenCalledWith('csv:launch', expect.objectContaining({ runner: 'devhub', rowCount: 1, validRows: 1 }), 'success')
      await expect(service.launchCsv({ csvPath: filePath, runner: 'devhub', confirmedBy: 'vitest' })).rejects.toThrow('E_VALIDATION')
      const paused = service.pauseCsvSession({ sessionId: launched.session.sessionId, confirmedBy: 'vitest' })
      expect(paused.session.status).toBe('paused')
      const resumed = service.resumeCsvSession({ sessionId: launched.session.sessionId, confirmedBy: 'vitest' })
      expect(resumed.session.status).toBe('running')
      const aborted = service.abortCsvSession({ sessionId: launched.session.sessionId, confirmedBy: 'vitest' })
      expect(aborted.session.status).toBe('aborted')
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: previousBuiltinEnabled, confirmedBy: 'vitest-restore' })
      service.setFeatureFlag({ flag: 'R8.C.csv.launch.python', value: previousPythonEnabled, confirmedBy: 'vitest-restore' })
      auditSpy.mockRestore()
      await removePathWithRetry(userData)
    }
  })

  it('emits throttled CSV row-stream payloads and audits reloads', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-csv-stream-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const tasksDir = join(userData, 'tasks')
    await mkdir(tasksDir, { recursive: true })
    const filePath = join(tasksDir, 'stream-r8c.csv')
    await writeFile(filePath, csvDocument([csvRow({ taskId: 'stream-A' })]), 'utf8')
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const previousBuiltinEnabled = service.getFeatureFlag('R8.C.skill.builtin')
    service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: true, confirmedBy: 'vitest' })

    try {
      const first = await service.reloadCsvGroups({ force: true })
      expect(first.validRows).toBe(1)
      expect(auditSpy).toHaveBeenCalledWith('csv:reload', expect.objectContaining({ groupCount: 1, validRows: 1 }), 'success')
      const firstStream = mainWindow.webContents.send.mock.calls.find(([channel]) => channel === 'csv:row-stream')
      expect(firstStream?.[1]).toMatchObject({ source: 'reload', changedGroupIds: ['stream-r8c'], removedGroupIds: [] })

      await writeFile(filePath, csvDocument([csvRow({ taskId: 'stream-A' }), csvRow({ taskId: 'stream-B' })]), 'utf8')
      await service.reloadCsvGroups({ force: true })
      await waitUntil(() => mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'csv:row-stream').length >= 2)
      const streamCalls = mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'csv:row-stream')
      expect(streamCalls.at(-1)?.[1]).toMatchObject({ source: 'reload', changedGroupIds: ['stream-r8c'], summary: { totalRows: 2, validRows: 2 } })
    } finally {
      service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: previousBuiltinEnabled, confirmedBy: 'vitest-restore' })
      auditSpy.mockRestore()
      service.dispose()
      await removePathWithRetry(userData)
    }
  })

  it('launches the real Python CSV bridge when the python runner flag is enabled', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-python-launch-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const tasksDir = join(userData, 'tasks')
    await mkdir(tasksDir, { recursive: true })
    const filePath = join(tasksDir, 'python-r8c.csv')
    const pythonRows = Array.from({ length: 30 }, (_, index) => csvRow({ taskId: `python-${index + 1}` }))
    await writeFile(filePath, csvDocument(pythonRows), 'utf8')
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const previousBuiltinEnabled = service.getFeatureFlag('R8.C.skill.builtin')
    const previousPythonEnabled = service.getFeatureFlag('R8.C.csv.launch.python')
    const previousPythonRowDelay = process.env.DEVHUB_CSV_PYTHON_ROW_DELAY_MS
    process.env.DEVHUB_CSV_PYTHON_ROW_DELAY_MS = '75'
    service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: true, confirmedBy: 'vitest' })
    service.setFeatureFlag({ flag: 'R8.C.csv.launch.python', value: true, confirmedBy: 'vitest' })

    try {
      const info = await service.getCsvRunnerInfo({ kind: 'python' })
      expect(info.available).toBe(true)

      const launched = await service.launchCsv({ csvPath: filePath, runner: 'python', confirmedBy: 'vitest' })
      expect(launched.session.runner).toBe('python')
      expect(launched.session.pid).toEqual(expect.any(Number))
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('csv:session-event-stream', expect.objectContaining({ type: 'session-start', data: expect.objectContaining({ transport: 'named-pipe' }) }))
      await waitUntil(() => mainWindow.webContents.send.mock.calls.some(([channel, payload]) => channel === 'csv:session-event-stream' && payload?.type === 'control-ack'), 5000)
      await waitUntil(() => mainWindow.webContents.send.mock.calls.some(([channel, payload]) => channel === 'csv:session-event-stream' && payload?.type === 'task-start'), 5000)
      const paused = service.pauseCsvSession({ sessionId: launched.session.sessionId, confirmedBy: 'vitest' })
      expect(paused.session.status).toBe('paused')
      await waitUntil(() => mainWindow.webContents.send.mock.calls.some(([channel, payload]) => {
        return channel === 'csv:session-event-stream' && payload?.type === 'control-ack' && payload.data?.action === 'pause'
      }), 5000)
      const resumeAckCountBefore = mainWindow.webContents.send.mock.calls.filter(([channel, payload]) => {
        return channel === 'csv:session-event-stream' && payload?.type === 'control-ack' && payload.data?.action === 'resume'
      }).length
      const resumed = service.resumeCsvSession({ sessionId: launched.session.sessionId, confirmedBy: 'vitest' })
      expect(resumed.session.status).toBe('running')
      await waitUntil(() => mainWindow.webContents.send.mock.calls.filter(([channel, payload]) => {
        return channel === 'csv:session-event-stream' && payload?.type === 'control-ack' && payload.data?.action === 'resume'
      }).length > resumeAckCountBefore, 5000)
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('cli:event-stream', expect.objectContaining({ sessionId: launched.session.sessionId, eventType: 'start' }))
    } finally {
      service.dispose()
      if (previousPythonRowDelay === undefined) {
        delete process.env.DEVHUB_CSV_PYTHON_ROW_DELAY_MS
      } else {
        process.env.DEVHUB_CSV_PYTHON_ROW_DELAY_MS = previousPythonRowDelay
      }
      service.setFeatureFlag({ flag: 'R8.C.skill.builtin', value: previousBuiltinEnabled, confirmedBy: 'vitest-restore' })
      service.setFeatureFlag({ flag: 'R8.C.csv.launch.python', value: previousPythonEnabled, confirmedBy: 'vitest-restore' })
      await removePathWithRetry(userData)
    }
  }, 45_000)

  it('records injection whitelist resolution and cancellation without native execution', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const entry = service.addInjectWhitelist({ alias: `target-${Date.now()}`, reason: 'vitest', confirmedBy: 'vitest' })

    expect(service.resolveInjectTarget({ targetAlias: entry.alias }).found).toBe(true)
    expect(service.getInjectReadyPool().find(item => item.id === entry.id)?.ready).toBe(false)
    expect(() => service.removeInjectWhitelist({ id: entry.id })).toThrow('E_PERMISSION')
    expect(service.removeInjectWhitelist({ id: entry.id, confirmedBy: 'vitest' }).success).toBe(true)
    expect(service.cancelInject({ injectId: 'inject-vitest', confirmedBy: 'vitest' }).status).toBe('cancel-requested')
  })

  it('derives inject targets from active AI aliases and task-layer awaiting input state', () => {
    const activeTask: AITask = {
      id: `active-${randomUUID()}`,
      toolType: 'codex',
      pid: 4321,
      windowHwnd: 987654,
      startTime: Date.now() - 2000,
      status: { state: 'waiting', lastActivity: Date.now() - 100 },
      alias: `codex-live-${randomUUID()}`,
      monitorState: 'waiting-input',
      metrics: {
        cpuHistory: [],
        outputLineCount: 12,
        lastOutputTime: Date.now() - 100,
        idleDuration: 100
      }
    }
    const trackerRuntime = {
      aiTaskTracker: {
        getActiveTasks: vi.fn(() => [activeTask]),
        subscribeToCliOutputParser: vi.fn(() => () => undefined)
      }
    }
    const service = createRuntimeService(() => null, trackerRuntime as never)
    try {
      const alias = activeTask.alias ?? activeTask.id
      service.addInjectWhitelist({ alias, reason: 'active-ai-task-map', confirmedBy: 'vitest' })
      const byAlias = service.resolveInjectTarget({ selector: 'alias', aliasOrId: alias, scenario: 'manual-template' })
      const byPid = service.resolveInjectTarget({ selector: 'pid', aliasOrId: alias, pid: activeTask.pid, scenario: 'manual-template' })
      const byHwnd = service.resolveInjectTarget({ selector: 'window-handle', aliasOrId: alias, hwnd: activeTask.windowHwnd, scenario: 'manual-template' })
      const readyPool = service.resolveInjectTarget({ selector: 'ready-pool', aliasOrId: 'any-codex', scenario: 'manual-template' })

      expect(trackerRuntime.aiTaskTracker.getActiveTasks).toHaveBeenCalled()
      expect(byAlias.target).toMatchObject({ resolvedAlias: alias, resolvedPid: activeTask.pid, resolvedHwnd: activeTask.windowHwnd, ready: true })
      expect(byPid.ok).toBe(true)
      expect(byHwnd.ok).toBe(true)
      expect(readyPool.target).toMatchObject({ resolvedAlias: alias, ready: true })

      const stateAlias = `codex-state-${randomUUID()}`
      service.addInjectWhitelist({ alias: stateAlias, reason: 'state-layer-ready', confirmedBy: 'vitest' })
      service.transitionInstanceState({ instanceId: stateAlias, layer: 'task', event: 'signal-active', reason: 'spec-28 state path' })
      service.transitionInstanceState({ instanceId: stateAlias, layer: 'task', event: 'tool-use-detected', reason: 'spec-28 state path' })
      service.transitionInstanceState({ instanceId: stateAlias, layer: 'task', event: 'stdin-prompt', reason: 'spec-28 state path' })

      const stateReady = service.resolveInjectTarget({ selector: 'ready-pool', aliasOrId: stateAlias, scenario: 'manual-template' })
      expect(stateReady.target).toMatchObject({ resolvedAlias: stateAlias, ready: true })
    } finally {
      service.dispose()
    }
  })

  it('runs inject whitelist expiry cleanup and records target safety audit events', () => {
    const service = createRuntimeService(() => null, runtime as never)
    try {
      const expiring = service.addInjectWhitelist({ alias: `cleanup-${randomUUID()}`, duration: '24h', reason: 'vitest', confirmedBy: 'vitest' })
      const strictTarget = service.addInjectWhitelist({ alias: `strict-${randomUUID()}`, reason: 'vitest', confirmedBy: 'vitest' })

      service.configureInjectStrictMode({ enabled: true, applyToScenarios: ['manual-template'], confirmedBy: 'vitest' })
      const strictResult = service.resolveInjectTarget({ targetAlias: strictTarget.alias })
      const cleanup = service.cleanupExpiredInjectWhitelist({ now: (expiring.expiresAt ?? expiring.createdAt) + 1, source: 'manual', confirmedBy: 'vitest' })
      const removed = service.removeInjectWhitelist({ id: strictTarget.id, confirmedBy: 'vitest' })
      const history = service.listInjectHistory()

      expect(strictResult.strictModeGate).toBe('requires-explicit-confirm')
      expect(cleanup.success).toBe(true)
      expect(cleanup.disabled).toBeGreaterThanOrEqual(1)
      expect(cleanup.ids).toContain(expiring.id)
      expect(service.listInjectWhitelist().find(entry => entry.id === expiring.id)?.enabled).toBe(false)
      expect(removed.success).toBe(true)
      expect(history).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: 'whitelist-add', status: 'whitelist-added', whitelistId: expiring.id, scope: 'instance' }),
        expect.objectContaining({ event: 'strict-mode-block', status: 'strict-mode-blocked', targetAlias: strictTarget.alias }),
        expect.objectContaining({ event: 'whitelist-expire', status: 'whitelist-expired', whitelistId: expiring.id }),
        expect.objectContaining({ event: 'whitelist-remove', status: 'whitelist-removed', whitelistId: strictTarget.id })
      ]))
    } finally {
      service.dispose()
    }
  })

  it('persists first-time inject confirmation through SQLite and reuses it as whitelist evidence', () => {
    const service = createRuntimeService(() => null, runtime as never)
    try {
      service.configureInjectStrictMode({ enabled: false, confirmedBy: 'vitest' })
      const taskId = `first-time-${randomUUID()}`
      service.enqueueCsvRow({
        id: taskId,
        group: 'first-time-confirm',
        tool: 'codex',
        prompt: 'real first-time target',
        dry_run: true,
        allow_inject: true
      })
      const alias = `codex-${taskId}`
      const before = service.resolveInjectTarget({ selector: 'alias', aliasOrId: alias, scenario: 'manual-template' })

      const confirmation = service.confirmInjectFirstTime({
        requestId: randomUUID(),
        selector: 'alias',
        aliasOrId: alias,
        scenario: 'manual-template',
        scope: 'instance',
        duration: '24h',
        confirmedBy: 'vitest'
      })
      const after = service.resolveInjectTarget({ selector: 'alias', aliasOrId: alias, scenario: 'manual-template' })
      const history = service.listInjectHistory()

      expect(before.whitelistGate).toBe('first-time-needed')
      expect(confirmation.success).toBe(true)
      expect(confirmation.entry.createdBy).toBe('first-time-modal')
      expect(after.ok).toBe(true)
      expect(after.whitelistGate).toBe('allowed')
      expect(service.listInjectWhitelist().find(entry => entry.id === confirmation.entry.id)).toMatchObject({ alias, scope: 'instance' })
      expect(history).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: 'first-time-confirm', whitelistId: confirmation.entry.id, targetAlias: alias }),
        expect.objectContaining({ event: 'whitelist-add', whitelistId: confirmation.entry.id, targetAlias: alias })
      ]))
    } finally {
      service.dispose()
    }
  })

  it('evaluates watchdog heartbeat policy without faking subprocess respawn', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-watchdog-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    try {
      const service = createRuntimeService(() => null, runtime as never)
      const base = Date.now()
      service.configureWatchdog({ maxRestartsPerHour: 100 })
      service.registerWatchdogInstance({ instanceId: 'watchdog-policy', pid: process.pid, tool: 'codex', mode: 'strict', graceMs: 0 })
      service.configureWatchdog({ instanceId: 'watchdog-policy', patch: { perPhase: { runningMs: 5000 } } })
      service.recordWatchdogHeartbeat({ instanceId: 'watchdog-policy', source: 'cpu-pulse', weight: 0.4, ts: base + 1000 })

      const suspect = service.evaluateWatchdog({ instanceId: 'watchdog-policy', now: base + 6001 })
      expect(suspect.monitoredInstances[0].state).toBe('suspect')
      const restarting = service.evaluateWatchdog({ instanceId: 'watchdog-policy', now: base + 9000 })
      expect(restarting.monitoredInstances[0].state).toBe('restarting')
      expect(service.getWatchdogHistory({ instanceId: 'watchdog-policy' }).some(event => event.type === 'action-taken')).toBe(true)
    } finally {
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('collects real local watchdog source adapters through runtime service', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-watchdog-collector-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const markerPath = join(userData, 'watchdog-marker.json')
    const activityPath = join(userData, 'watchdog-activity.log')
    await writeFile(markerPath, '{"writer":"test"}\n', 'utf8')
    await writeFile(activityPath, 'runtime activity\n', 'utf8')
    const service = createRuntimeService(() => null, runtime as never)
    const serviceInternals = service as unknown as { store: { delete: (key: string) => void } }
    serviceInternals.store.delete('watchdogInstances')
    serviceInternals.store.delete('watchdogBeats')
    serviceInternals.store.delete('watchdogHistory')

    try {
      const now = Date.now()
      service.registerWatchdogInstance({ instanceId: 'watchdog-runtime-collector', pid: process.pid, tool: 'codex', mode: 'lenient', graceMs: 0 })
      service.configureWatchdog({
        instanceId: 'watchdog-runtime-collector',
        patch: {
          enabledSources: ['marker-file', 'fs-activity', 'stdout'],
          perPhase: { runningMs: 5000 }
        }
      })

      const result = await service.collectWatchdogHeartbeats({
        now,
        sourceConfigByInstanceId: {
          'watchdog-runtime-collector': {
            markerFilePath: markerPath,
            fsActivityPaths: [activityPath],
            lastStdoutAt: now - 100,
            stdoutBytes: 24
          }
        }
      })
      const historySources = service.getWatchdogHistory({ instanceId: 'watchdog-runtime-collector' })
        .filter(event => event.type === 'heartbeat')
        .map(event => event.data.source)
        .sort()

      expect(result.failures).toEqual([])
      expect(result.sourceCountByInstance['watchdog-runtime-collector']).toBe(3)
      expect(historySources).toEqual(expect.arrayContaining(['fs-activity', 'marker-file', 'stdout']))
      expect(result.status.monitoredInstances.find(item => item.instanceId === 'watchdog-runtime-collector')?.state).toBe('healthy')
    } finally {
      service.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  }, 20000)

  it('streams watchdog events to renderer listeners with bounded batches', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-watchdog-stream-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    try {
      service.registerWatchdogInstance({ instanceId: 'watchdog-stream', pid: 901, tool: 'codex', graceMs: 0 })

      const streamCalls = mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'watchdog:event-stream')
      expect(streamCalls).toHaveLength(1)
      expect(streamCalls[0]?.[1]).toMatchObject({
        events: [expect.objectContaining({
          type: 'state-change',
          instanceId: 'watchdog-stream',
          data: expect.objectContaining({ next: 'healthy', reason: 'register' })
        })]
      })
      expect(streamCalls[0]?.[1].events).toHaveLength(1)
    } finally {
      service.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('detects a killed real child process and requests restart without fake respawn', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-watchdog-kill-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
      windowsHide: true
    })

    try {
      if (!child.pid) throw new Error('child pid missing')
      const instanceId = `watchdog-kill-${child.pid}`
      service.configureWatchdog({ maxRestartsPerHour: 100 })
      service.registerWatchdogInstance({ instanceId, pid: child.pid, tool: 'codex', graceMs: 0 })
      service.configureWatchdog({ instanceId, patch: { perPhase: { runningMs: 120000 } } })

      const exited = new Promise<void>(resolve => child.once('exit', () => resolve()))
      child.kill()
      await Promise.race([
        exited,
        new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('child exit timeout')), 3000))
      ])

      const status = service.evaluateWatchdog({ instanceId, now: Date.now() + 1000 })
      const instance = status.monitoredInstances.find(item => item.instanceId === instanceId)
      const history = service.getWatchdogHistory({ instanceId })

      expect(instance?.state).toBe('restarting')
      expect(history.some(event => event.type === 'state-change' && event.data.reason === 'pid-exited')).toBe(true)
      expect(history.some(event => event.type === 'action-taken' && event.data.action === 'restart')).toBe(true)
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill()
      service.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('executes watchdog restart actions through task queue, inject, and notifications', async () => {
    resetUnifiedNotificationService()
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-watchdog-action-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)

    try {
      const taskId = `watchdog-action-restart-${randomUUID()}`
      const sessionId = `watchdog-action-session-${randomUUID()}`
      const task = service.enqueueCsvRow({
        id: taskId,
        group: sessionId,
        tool: 'codex',
        prompt: 'Run a real watchdog restart task',
        retries: 1,
        allow_inject: true
      })
      if (!task.sessionId) throw new Error('test task sessionId missing')
      service.startReadyTasks({ sessionId: task.sessionId, concurrent: 1 })

      const base = Date.now()
      service.configureWatchdog({ maxRestartsPerHour: 100 })
      service.registerWatchdogInstance({
        instanceId: taskId,
        pid: process.pid,
        tool: 'codex',
        alias: taskId,
        graceMs: 0
      })
      service.configureWatchdog({ instanceId: taskId, patch: { perPhase: { runningMs: 5000 } } })
      service.evaluateWatchdog({ instanceId: taskId, now: base + 9000 })

      await waitUntil(() => service.listWatchdogActionResults({ instanceId: taskId }).length > 0)
      const [action] = service.listWatchdogActionResults({ instanceId: taskId })
      if (!action) throw new Error('watchdog restart action result missing')
      const updatedTask = service.listTasks({ sessionId: task.sessionId }).find(item => item.runId === task.runId)
      const notifications = service.listNotifications({ includeDismissed: true }).filter(item => item.source === 'watchdog' && item.instanceId === taskId)

      expect(action).toMatchObject({
        action: 'restart',
        taskRunId: task.runId,
        taskStatus: 'retrying'
      })
      expect(updatedTask?.status).toBe('retrying')
      expect(action.injectActionId).toMatch(/[0-9a-f-]{36}/)
      expect(service.listInjectHistory().some(entry => entry.injectId === action.injectActionId && entry.status === 'blocked')).toBe(true)
      expect(notifications.some(item => item.title === 'Watchdog restart requested')).toBe(true)
    } finally {
      service.dispose()
      resetUnifiedNotificationService()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('routes watchdog human-intervention actions into awaiting-human task state', async () => {
    resetUnifiedNotificationService()
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-watchdog-human-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)

    try {
      const taskId = `watchdog-action-human-${randomUUID()}`
      const sessionId = `watchdog-human-session-${randomUUID()}`
      const task = service.enqueueCsvRow({
        id: taskId,
        group: sessionId,
        tool: 'claude',
        prompt: 'Run a real watchdog human intervention task',
        retries: 0
      })
      if (!task.sessionId) throw new Error('test task sessionId missing')
      service.startReadyTasks({ sessionId: task.sessionId, concurrent: 1 })

      const base = Date.now()
      service.configureWatchdog({ maxRestartsPerHour: 100 })
      service.registerWatchdogInstance({
        instanceId: taskId,
        pid: process.pid,
        tool: 'claude',
        alias: taskId,
        graceMs: 0,
        actionPolicy: 'human-intervention'
      })
      service.configureWatchdog({ instanceId: taskId, patch: { perPhase: { runningMs: 5000 } } })
      service.evaluateWatchdog({ instanceId: taskId, now: base + 9000 })

      await waitUntil(() => service.listWatchdogActionResults({ instanceId: taskId }).length > 0)
      const [action] = service.listWatchdogActionResults({ instanceId: taskId })
      if (!action) throw new Error('watchdog human action result missing')
      const updatedTask = service.listTasks({ sessionId: task.sessionId }).find(item => item.runId === task.runId)

      expect(action).toMatchObject({
        action: 'human-intervention',
        taskRunId: task.runId,
        taskStatus: 'awaiting-human'
      })
      expect(updatedTask?.status).toBe('awaiting-human')
      expect(service.listNotifications({ includeDismissed: true }).some(item => item.source === 'watchdog' && item.instanceId === taskId && item.level === 'ERROR')).toBe(true)
    } finally {
      service.dispose()
      resetUnifiedNotificationService()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('supports watchdog history and truthful subprocess supervisor contracts', async () => {
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-supervisor-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    let spawnedPid: number | null = null
    try {
      const serviceInternals = service as unknown as { store: { delete: (key: string) => void; set: (key: string, value: unknown) => void } }
      serviceInternals.store.delete('watchdogSupervisorSession')
      serviceInternals.store.delete('watchdogSupervisorState')
      serviceInternals.store.delete('watchdogSupervisorChannels')
      const supervisor = service.watchdogSupervisorStatus()
      expect(['not-started', 'fatal']).toContain(supervisor.status)
      expect(supervisor.innerHealthy).toBe(false)
      expect(supervisor.sessionTokenPrefix).toMatch(/^[a-f0-9]{8}$/)
      const marker = JSON.parse(await readFile(supervisor.markerFilePath, 'utf8')) as Record<string, unknown>
      expect(marker.tokenPrefix).toBe(supervisor.sessionTokenPrefix)

      expect(service.watchdogSupervisorRespawn({ reason: 'manual' }).code).toBe('E_PERMISSION')
      const respawn = service.watchdogSupervisorRespawn({ reason: 'manual', confirmedBy: 'vitest' })
      if (respawn.success) {
        expect(respawn.code).toBe('OK')
        spawnedPid = respawn.spawnResult?.pid ?? null
        expect(spawnedPid).toEqual(expect.any(Number))
        expect(respawn.spawnResult?.command.env?.ELECTRON_RUN_AS_NODE).toBe('1')
      } else {
        expect(['E_SPAWN_FAILED', 'E_RESTART_STORM']).toContain(respawn.code)
      }
      if (respawn.spawnResult) {
        expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:spawn', expect.objectContaining({
          reason: 'manual',
          confirmedBy: 'vitest',
          success: respawn.success,
          pid: respawn.spawnResult.pid,
          command: expect.any(String),
          entryFile: expect.any(String)
        }), respawn.spawnResult.started ? 'success' : 'error', expect.any(String))
      }
      expect((await service.watchdogSupervisorInstallService({ confirmAdmin: false, confirmedBy: 'vitest' })).requiresElevation).toBe(true)
      expect((await service.watchdogSupervisorUninstallService({ confirmAdmin: false, confirmedBy: 'vitest' })).requiresElevation).toBe(true)
      expect(() => service.acceptWatchdogSupervisorHandshake({
        type: 'handshake',
        sessionToken: 'b'.repeat(64),
        protocolVersion: supervisor.protocolVersion,
        parentPid: process.pid
      })).toThrow('E_PERMISSION_DENIED')
      const degraded = service.recordWatchdogSupervisorChannel({ channel: 'tcp-localhost', at: Date.now() })
      expect(degraded.status).toBe('degraded')
      expect(() => service.overrideWatchdogRestart({ reason: 'test' })).toThrow('E_PERMISSION')
      expect(service.overrideWatchdogRestart({ reason: 'test', confirmedBy: 'vitest' }).type).toBe('manual-restart-override')
      expect(service.getWatchdogHistory().length).toBeGreaterThan(0)
      serviceInternals.store.set('watchdogSupervisorSession', {
        token: 'c'.repeat(64),
        createdAt: Date.now(),
        parentPid: 9_876_543,
        childPidExpected: null
      })
      const takeoverStatus = service.watchdogSupervisorStatus()
      const takeoverAuditCount = auditSpy.mock.calls.filter(([action]) => action === 'watchdog-supervisor:takeover').length
      service.watchdogSupervisorStatus()
      expect(takeoverStatus.sessionTokenPrefix).toBe('c'.repeat(8))
      expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:takeover', expect.objectContaining({
        sessionTokenPrefix: 'c'.repeat(8),
        evidence: expect.stringContaining('restart takeover adopted existing watchdog session')
      }), 'success', expect.stringContaining('restart takeover adopted existing watchdog session'))
      expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:orphan', expect.objectContaining({
        sessionTokenPrefix: 'c'.repeat(8),
        evidence: expect.stringContaining('restart takeover adopted existing watchdog session')
      }), 'refused', expect.stringContaining('restart takeover adopted existing watchdog session'))
      expect(auditSpy.mock.calls.filter(([action]) => action === 'watchdog-supervisor:takeover').length).toBe(takeoverAuditCount)
      expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:respawn', expect.objectContaining({ reason: 'manual', confirmedBy: null, code: 'E_PERMISSION', success: false }), 'refused', expect.stringContaining('confirmedBy required'))
      expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:respawn', expect.objectContaining({ reason: 'manual', confirmedBy: 'vitest', success: respawn.success }), expect.any(String), expect.any(String))
      expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:install-service', expect.objectContaining({ serviceName: 'devhub-watchdog', requiresElevation: true, elevated: false, code: 'E_PERMISSION' }), 'refused', expect.stringContaining('confirmAdmin=true'))
      expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:uninstall-service', expect.objectContaining({ serviceName: 'devhub-watchdog', requiresElevation: true, elevated: false, code: 'E_PERMISSION' }), 'refused', expect.stringContaining('confirmAdmin=true'))
      expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:handshake-fail', expect.objectContaining({ errorCode: 'E_PERMISSION_DENIED' }), 'refused', expect.stringContaining('sessionToken mismatch'))
      expect(auditSpy).toHaveBeenCalledWith('watchdog-supervisor:channel-degrade', expect.objectContaining({ channel: 'tcp-localhost', status: 'degraded' }), 'success', expect.stringContaining('fallback channel'))
    } finally {
      if (spawnedPid !== null) {
        try {
          process.kill(spawnedPid, 'SIGTERM')
        } catch {
          spawnedPid = null
        }
      }
      service.dispose()
      auditSpy.mockRestore()
      await rm(userData, { recursive: true, force: true })
    }
  }, 15000)

  it('streams watchdog supervisor lifecycle notifications to renderer listeners', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-supervisor-stream-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    try {
      const serviceInternals = service as unknown as { store: { delete: (key: string) => void } }
      serviceInternals.store.delete('watchdogSupervisorSession')
      serviceInternals.store.delete('watchdogSupervisorState')
      serviceInternals.store.delete('watchdogSupervisorChannels')

      const status = service.watchdogSupervisorStatus()
      expect(status.sessionTokenPrefix).toMatch(/^[a-f0-9]{8}$/)
      expect(service.watchdogSupervisorRespawn({ reason: 'manual' }).code).toBe('E_PERMISSION')
      expect(() => service.acceptWatchdogSupervisorHandshake({
        type: 'handshake',
        sessionToken: 'b'.repeat(64),
        protocolVersion: status.protocolVersion,
        parentPid: process.pid
      })).toThrow('E_PERMISSION_DENIED')
      service.recordWatchdogSupervisorChannel({ channel: 'tcp-localhost', ok: false, error: 'vitest channel failure' })

      const streamCalls = mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'watchdog-supervisor:event-stream')
      const eventTypes = streamCalls.flatMap(([, payload]) => {
        const typedPayload = payload as { events?: Array<{ type?: string }> }
        return typedPayload.events?.map(event => event.type ?? '') ?? []
      })
      expect(eventTypes).toContain('status')
      expect(eventTypes).toContain('respawn')
      expect(eventTypes).toContain('handshake-fail')
      expect(eventTypes).toContain('channel-degrade')
      expect(JSON.stringify(streamCalls)).toContain(status.sessionTokenPrefix)
      expect(JSON.stringify(streamCalls)).not.toContain('b'.repeat(64))
      expect(streamCalls.every(([, payload]) => {
        const typedPayload = payload as { events?: Array<{ status?: { sessionTokenPrefix?: string } }> }
        return typedPayload.events?.every(event => event.status?.sessionTokenPrefix === status.sessionTokenPrefix) ?? false
      })).toBe(true)
    } finally {
      service.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('builds monitor snapshots from real parser and title-signal state', () => {
    const service = createRuntimeService(() => null, {
      scannerCache: {
        getSnapshot: () => ({
          windows: { data: [
            { hwnd: 41, title: 'Cursor - Editing monitor.ts', processName: 'Cursor.exe', pid: 401, className: 'Chrome_WidgetWin_1', rect: { x: 0, y: 0, width: 100, height: 100 }, isVisible: true, isMinimized: false, isSystemWindow: false }
          ] },
          aiTasks: { data: [] },
          systemSummary: {}
        })
      }
    } as never)

    service.parseCliChunk({
      tool: 'claude',
      stream: 'stdout',
      instanceId: 'claude-monitor',
      strategy: 'ndjson',
      chunk: [
        JSON.stringify({ type: 'assistant', message: { id: 'm1', role: 'assistant', model: 'claude-sonnet-4-5', content: [{ type: 'text', text: 'working' }], usage: { input_tokens: 10, output_tokens: 8 } } }),
        JSON.stringify({ type: 'result', subtype: 'success', is_error: false, duration_ms: 1200, total_cost_usd: 0.001, usage: { input_tokens: 10, output_tokens: 8 } })
      ].join('\n')
    })

    const snapshot = service.monitorSnapshot()
    const claude = snapshot.cards.find(card => card.tool === 'claude')
    const cursor = snapshot.cards.find(card => card.tool === 'cursor')

    expect(snapshot.cards).toHaveLength(5)
    expect(claude?.currentPhase).toBe('completed')
    expect(claude?.progress?.source).toBe('cli-real')
    expect(claude?.tokens).toEqual({ input: 10, output: 8 })
    expect(claude?.costUsd).toBe(0.001)
    expect(service.getClaudeCostSummary({ instanceId: 'claude-monitor' })).toEqual({
      totalInputTokens: 10,
      totalOutputTokens: 8,
      totalCostUsd: 0.001,
      durationMs: 1200
    })
    expect(cursor?.currentPhase).toBe('editing')
    expect(cursor?.progress?.source).toBe('heuristic')
  })

  it('publishes parsed Claude stream-json events to the dedicated renderer stream', () => {
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    service.parseCliChunk({
      tool: 'claude',
      stream: 'stdout',
      instanceId: 'claude-stream',
      strategy: 'ndjson',
      chunk: JSON.stringify({
        type: 'system',
        subtype: 'init',
        cwd: 'D:/repo',
        session_id: 'claude-stream-session',
        tools: ['Read'],
        model: 'claude-sonnet-4-5'
      })
    })

    expect(mainWindow.webContents.send).toHaveBeenCalledWith('cli:event-stream', expect.objectContaining({ tool: 'claude', eventType: 'phase_marker' }))
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('ai:claude-stream-event', expect.objectContaining({ type: 'system', session_id: 'claude-stream-session', schemaVersion: CLAUDE_STREAM_SCHEMA_VERSION }))
  })

  it('throttles monitor snapshot stream after real CLI parser events', () => {
    vi.useFakeTimers()
    try {
      const mainWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn()
        }
      }
      const service = createRuntimeService(() => mainWindow as never, runtime as never)

      service.parseCliChunk({ tool: 'claude', stream: 'stdout', instanceId: 'claude-monitor-stream', chunk: 'Step 1/3 thinking' })
      service.parseCliChunk({ tool: 'claude', stream: 'stdout', instanceId: 'claude-monitor-stream', chunk: 'Step 2/3 running tool' })

      expect(mainWindow.webContents.send).toHaveBeenCalledWith('monitor:snapshot-stream', expect.objectContaining({ cards: expect.any(Array) }))
      const immediateCount = mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'monitor:snapshot-stream').length
      expect(immediateCount).toBe(1)

      vi.advanceTimersByTime(100)

      const finalCount = mainWindow.webContents.send.mock.calls.filter(([channel]) => channel === 'monitor:snapshot-stream').length
      expect(finalCount).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens monitor BrowserWindow via R8.B popout bridge and applies guarded prefs', async () => {
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      show: vi.fn(),
      focus: vi.fn(),
      webContents: { send: vi.fn() }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    try {
      const opened = await service.openMonitorWindow()
      const prefs = service.setMonitorWindowPrefs({ alwaysOnTop: true, opacity: 0.8, bounds: { x: 10, y: 20, w: 420, h: 260 }, confirmedBy: 'vitest' })
      const focus = service.focusMonitorInstance({ tool: 'claude', instanceId: 'claude-monitor' })

      expect(opened.windowId).toMatch(/^popout-/)
      expect(prefs.windowState).toMatchObject({ alwaysOnTop: true, opacity: 0.8, bounds: { x: 10, y: 20, w: 420, h: 260 } })
      expect(focus.success).toBe(true)
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('monitor:focus-instance', expect.objectContaining({ tool: 'claude', instanceId: 'claude-monitor' }))
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('monitor:snapshot-stream', expect.objectContaining({ cards: expect.any(Array) }))
      expect(auditSpy).toHaveBeenCalledWith('monitor:open', expect.objectContaining({ windowId: opened.windowId, reused: false }), 'success')
      expect(auditSpy).toHaveBeenCalledWith('monitor:set-window-prefs', expect.objectContaining({ alwaysOnTop: true, opacity: 0.8, confirmedBy: 'vitest' }), 'success')
      expect(service.closeMonitorWindow().success).toBe(true)
      expect(auditSpy).toHaveBeenCalledWith('monitor:close', expect.objectContaining({ windowIds: expect.arrayContaining([opened.windowId]) }), 'success')
    } finally {
      auditSpy.mockRestore()
    }
  }, 10000)

  it('enforces one monitor popout per tool and returns real card snapshots', async () => {
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const service = createRuntimeService(() => null, runtime as never)
    const serviceInternals = service as unknown as { store: { set: (key: string, value: unknown) => void } }
    serviceInternals.store.set('popouts', [])
    serviceInternals.store.set('monitorPopoutLayouts', {})

    try {
      await expect(service.openMonitorPopout({ tool: 'claude' })).rejects.toThrow('E_NOT_FOUND')
      await service.openMonitorWindow()
      service.parseCliChunk({ tool: 'claude', stream: 'stdout', instanceId: 'claude-popout', chunk: 'Step 1/2 running tool' })

      const opened = await service.openMonitorPopout({ tool: 'claude', layout: 'progress-only' })
      expect(opened.popoutId).toMatch(/^popout-/)
      expect(opened.popout.tool).toBe('claude')
      expect(opened.popout.miniLayout).toBe('progress-only')
      expect(opened.popout.card.progress?.source).toBe('cli-real')
      expect(() => service.listMonitorPopouts()).not.toThrow()
      expect(service.listMonitorPopouts()).toHaveLength(1)
      expect(auditSpy).toHaveBeenCalledWith('monitor:popout-open', expect.objectContaining({ popoutId: opened.popoutId, tool: 'claude', layout: 'progress-only' }), 'success')
      const layoutUpdate = service.setMonitorPopoutLayoutPreference({ popoutId: opened.popoutId, layout: 'events-only' })
      expect(layoutUpdate).toMatchObject({ success: true, popoutId: opened.popoutId, layout: 'events-only' })
      expect(layoutUpdate.popout.miniLayout).toBe('events-only')
      expect(service.listMonitorPopouts()[0]?.miniLayout).toBe('events-only')
      expect(auditSpy).toHaveBeenCalledWith('monitor:popout-layout-set', expect.objectContaining({ popoutId: opened.popoutId, tool: 'claude', layout: 'events-only' }), 'success')
      await expect(service.openMonitorPopout({ tool: 'claude' })).rejects.toThrow('E_VALIDATION')
      expect(service.returnMonitorPopoutToMain({ popoutId: opened.popoutId }).success).toBe(true)
      expect(service.listMonitorPopouts()).toHaveLength(0)
      expect(auditSpy).toHaveBeenCalledWith('monitor:popout-close', expect.objectContaining({ popoutId: opened.popoutId }), 'success')
    } finally {
      auditSpy.mockRestore()
    }
  })

  it('keeps monitor tool popout streams alive after the main monitor window closes', async () => {
    vi.useFakeTimers()
    const service = createRuntimeService(() => null, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
      popoutWindows: Map<string, { webContents: { send: ReturnType<typeof vi.fn> }; isDestroyed: () => boolean }>
    }
    serviceInternals.store.set('popouts', [])
    serviceInternals.store.set('monitorPopoutLayouts', {})

    try {
      await service.openMonitorWindow()
      const opened = await service.openMonitorPopout({ tool: 'claude', layout: 'compact' })
      const toolWindow = serviceInternals.popoutWindows.get(opened.popoutId)

      expect(toolWindow).toBeDefined()
      expect(service.closeMonitorWindow()).toMatchObject({ success: true, closed: 1 })
      expect(service.listMonitorPopouts()).toHaveLength(1)

      service.parseCliChunk({ tool: 'claude', stream: 'stdout', instanceId: 'claude-after-monitor-close', chunk: 'Step 2/3 running tool' })
      vi.advanceTimersByTime(100)

      expect(toolWindow?.webContents.send).toHaveBeenCalledWith(
        'monitor:popout-snapshot-stream',
        expect.objectContaining({
          tool: 'claude',
          progress: expect.objectContaining({ instanceId: 'claude-after-monitor-close', source: 'cli-real' })
        })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('manages BrowserWindow popout cap, bounds, monitor migration, promote, and demote paths', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    ;(service as unknown as { store: { set: (key: string, value: unknown) => void } }).store.set('popouts', [])

    const floating = await service.createPopout({
      surface: 'port',
      targetId: 3000,
      mode: 'floating',
      route: '/monitor?port=3000',
      bounds: { x: 1, y: 2, width: 360, height: 280 },
      title: 'Port 3000'
    })
    const promoted = await service.promotePopoutFromFloating({
      floatingId: floating.windowId,
      bounds: { x: 20, y: 30, width: 420, height: 300 },
      alwaysOnTop: true
    })
    expect(promoted.browserPopoutId).toMatch(/^popout-/)
    expect(promoted.popout.mode).toBe('browserwindow')
    expect(service.listPopouts().find(popout => popout.windowId === promoted.browserPopoutId)?.pinned).toBe(true)

    const saved = service.savePopoutBounds({
      windowId: promoted.browserPopoutId,
      bounds: { x: 10.2, y: 20.7, width: 200, height: 180 }
    })
    expect(saved.bounds).toEqual({ x: 10, y: 21, width: 280, height: 200 })

    const moved = service.movePopoutToMonitor({ windowId: promoted.browserPopoutId, monitorIndex: 1 })
    expect(moved.bounds.x).toBe(1944)
    expect(moved.monitorIndex).toBe(1)

    const demoted = await service.demotePopout({ windowId: promoted.browserPopoutId })
    expect(demoted.floatingId).toMatch(/^popout-/)
    expect(demoted.popout.mode).toBe('floating')

    ;(service as unknown as { store: { set: (key: string, value: unknown) => void } }).store.set('popouts', [])
    const panelPopout = await service.createPopout({ surface: 'process', targetId: 'r8-panel-process', mode: 'browserwindow', route: '/panel/process', title: 'DevHub process' })
    const duplicatePanelPopout = await service.createPopout({ surface: 'process', targetId: 'r8-panel-process', mode: 'browserwindow', route: '/panel/process', title: 'DevHub process duplicate' })
    expect(duplicatePanelPopout.windowId).toBe(panelPopout.windowId)
    expect(service.listPopouts().filter(popout => (
      popout.surface === 'process'
      && popout.targetId === 'r8-panel-process'
      && popout.bridgeState !== 'closed'
    ))).toHaveLength(1)

    ;(service as unknown as { store: { set: (key: string, value: unknown) => void } }).store.set('popouts', [])
    for (let index = 0; index < 10; index += 1) {
      await service.createPopout({ surface: 'port', targetId: 4000 + index, mode: 'browserwindow', route: '/monitor', title: `Port ${4000 + index}` })
    }
    await expect(service.createPopout({ surface: 'port', targetId: 5000, mode: 'browserwindow', route: '/monitor', title: 'Port 5000' })).rejects.toThrow('E_RATE_LIMITED')
  }, 10_000)

  it('records BrowserWindow popout heartbeats, reaps stale bridges, and restores pinned records', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const serviceInternals = service as unknown as { store: { set: (key: string, value: unknown) => void } }
    serviceInternals.store.set('popouts', [])

    const live = await service.createPopout({
      surface: 'port',
      targetId: 6100,
      mode: 'browserwindow',
      route: '/monitor?port=6100',
      bounds: { x: 10, y: 20, width: 400, height: 280 },
      title: 'Port 6100'
    })
    const heartbeat = service.handlePopoutBridgeMessage({ windowId: live.windowId, type: 'heartbeat', at: 1_000 })
    expect(heartbeat).toMatchObject({ success: true, windowId: live.windowId, heartbeatAt: 1_000, bridgeState: 'connected' })

    const stale = service.reapStalePopouts({ now: 32_000, timeoutMs: 30_000 })
    expect(stale.closedWindowIds).toEqual([live.windowId])
    expect(service.listPopouts().find(popout => popout.windowId === live.windowId)).toMatchObject({
      bridgeState: 'closed',
      closedAt: 32_000
    })

    serviceInternals.store.set('popouts', [{
      windowId: 'popout-pinned-1',
      surface: 'port',
      targetId: 6200,
      mode: 'browserwindow',
      route: '/monitor?port=6200',
      title: 'Port 6200',
      pinned: true,
      bounds: { x: 40, y: 50, width: 420, height: 300 },
      createdAt: 900,
      lastHeartbeatAt: 900,
      bridgeState: 'connected'
    }])

    const restored = await service.restorePinnedPopouts({ now: 3_333 })
    expect(restored).toMatchObject({ success: true, restoredWindowIds: ['popout-pinned-1'], restoredAt: 3_333 })
    expect(service.listPopouts().find(popout => popout.windowId === 'popout-pinned-1')).toMatchObject({
      bridgeState: 'connected',
      restoredAt: 3_333,
      lastHeartbeatAt: 3_333
    })
  })

  it('closes only unpinned BrowserWindow popouts when the main window closes', async () => {
    const closeHandlers: Array<() => void> = []
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'close') closeHandlers.push(handler)
        return mainWindow
      }),
      off: vi.fn(() => mainWindow),
      show: vi.fn(),
      focus: vi.fn(),
      webContents: { send: vi.fn() }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as { store: { set: (key: string, value: unknown) => void } }
    serviceInternals.store.set('popouts', [])

    const unpinned = await service.createPopout({
      surface: 'port',
      targetId: 6300,
      mode: 'browserwindow',
      route: '/monitor?port=6300',
      title: 'Port 6300'
    })
    const pinned = await service.createPopout({
      surface: 'port',
      targetId: 6400,
      mode: 'browserwindow',
      route: '/monitor?port=6400',
      title: 'Port 6400'
    })
    service.pinPopout({ windowId: pinned.windowId, pinned: true })

    expect(closeHandlers).toHaveLength(1)
    closeHandlers[0]()

    expect(service.listPopouts().find(popout => popout.windowId === unpinned.windowId)).toMatchObject({
      bridgeState: 'closed'
    })
    expect(service.listPopouts().find(popout => popout.windowId === pinned.windowId)).toMatchObject({
      bridgeState: 'connected',
      pinned: true
    })

    service.dispose()
    expect(mainWindow.off).toHaveBeenCalledWith('close', closeHandlers[0])
  })

  it('keeps the main monitor BrowserWindow alive when the main app window closes', async () => {
    const closeHandlers: Array<() => void> = []
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'close') closeHandlers.push(handler)
        return mainWindow
      }),
      off: vi.fn(() => mainWindow),
      webContents: { send: vi.fn() }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
      popoutWindows: Map<string, { isDestroyed: () => boolean }>
    }
    serviceInternals.store.set('popouts', [])
    serviceInternals.store.set('monitorPopoutLayouts', {})

    const opened = await service.openMonitorWindow()
    const monitorWindow = serviceInternals.popoutWindows.get(opened.windowId)

    expect(closeHandlers).toHaveLength(1)
    closeHandlers[0]()

    expect(monitorWindow?.isDestroyed()).toBe(false)
    expect(service.listPopouts().find(popout => popout.windowId === opened.windowId)).toMatchObject({
      surface: 'monitor',
      targetId: 'r8-monitor',
      bridgeState: 'connected'
    })

    service.dispose()
    expect(mainWindow.off).toHaveBeenCalledWith('close', closeHandlers[0])
  })

  it('migrates off-screen BrowserWindow popouts to the primary display on display changes', async () => {
    const send = vi.fn()
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: { send }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as { store: { set: (key: string, value: unknown) => void } }
    serviceInternals.store.set('popouts', [])

    const popout = await service.createPopout({
      surface: 'port',
      targetId: 6500,
      mode: 'browserwindow',
      route: '/monitor?port=6500',
      bounds: { x: 1944, y: 24, width: 420, height: 300 },
      title: 'Port 6500'
    })

    vi.mocked(screen.getAllDisplays).mockReturnValueOnce([
      { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }
    ] as never)

    const event = service.reflowPopoutsForDisplayChange({ type: 'display-removed', now: 4_444 })

    expect(event).toEqual({
      type: 'display-removed',
      affectedPopouts: [popout.windowId],
      reflowAction: 'migrate-to-primary',
      emittedAt: 4_444
    })
    expect(service.listPopouts().find(item => item.windowId === popout.windowId)?.bounds).toEqual({
      x: 24,
      y: 24,
      width: 420,
      height: 300
    })
    expect(send).toHaveBeenCalledWith('popout:screen-event', event)
  })

  it('restores migrated BrowserWindow popouts when their display reconnects', async () => {
    const send = vi.fn()
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: { send }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
      popoutWindows: Map<string, { setBounds: ReturnType<typeof vi.fn>; isDestroyed: () => boolean }>
    }
    serviceInternals.store.set('popouts', [])

    const originalBounds = { x: 1944, y: 24, width: 420, height: 300 }
    const primaryDisplay = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }
    const secondDisplay = { id: 2, workArea: { x: 1920, y: 0, width: 1920, height: 1080 } }
    const popout = await service.createPopout({
      surface: 'port',
      targetId: 6501,
      mode: 'browserwindow',
      route: '/monitor?port=6501',
      bounds: originalBounds,
      title: 'Port 6501'
    })
    const popoutWindow = serviceInternals.popoutWindows.get(popout.windowId)

    vi.mocked(screen.getAllDisplays).mockReturnValueOnce([primaryDisplay] as never)
    const removedEvent = service.reflowPopoutsForDisplayChange({ type: 'display-removed', now: 4_444 })

    expect(removedEvent).toEqual({
      type: 'display-removed',
      affectedPopouts: [popout.windowId],
      reflowAction: 'migrate-to-primary',
      emittedAt: 4_444
    })
    expect(service.listPopouts().find(item => item.windowId === popout.windowId)).toMatchObject({
      bounds: { x: 24, y: 24, width: 420, height: 300 },
      displayId: 1,
      pendingRestoreBounds: originalBounds,
      pendingRestoreDisplayId: 2,
      displayMigratedAt: 4_444
    })

    vi.mocked(screen.getAllDisplays).mockReturnValueOnce([primaryDisplay, secondDisplay] as never)
    const addedEvent = service.reflowPopoutsForDisplayChange({ type: 'display-added', now: 5_555 })

    expect(addedEvent).toEqual({
      type: 'display-added',
      affectedPopouts: [popout.windowId],
      reflowAction: 'restore',
      emittedAt: 5_555
    })
    const restoredRecord = service.listPopouts().find(item => item.windowId === popout.windowId)
    expect(restoredRecord?.bounds).toEqual(originalBounds)
    expect(restoredRecord?.displayId).toBe(2)
    expect(restoredRecord?.pendingRestoreBounds).toBeUndefined()
    expect(restoredRecord?.pendingRestoreDisplayId).toBeUndefined()
    expect(restoredRecord?.displayMigratedAt).toBeUndefined()
    expect(popoutWindow?.setBounds).toHaveBeenCalledWith({ x: 24, y: 24, width: 420, height: 300 })
    expect(popoutWindow?.setBounds).toHaveBeenCalledWith(originalBounds)
    expect(send).toHaveBeenCalledWith('popout:screen-event', removedEvent)
    expect(send).toHaveBeenCalledWith('popout:screen-event', addedEvent)
  })

  it('auto-closes idle unpinned BrowserWindow popouts without closing pinned popouts', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const serviceInternals = service as unknown as { store: { set: (key: string, value: unknown) => void } }
    serviceInternals.store.set('popouts', [
      {
        windowId: 'popout-idle',
        surface: 'port',
        targetId: 6600,
        mode: 'browserwindow',
        route: '/monitor?port=6600',
        title: 'Port 6600',
        pinned: false,
        bounds: { x: 10, y: 10, width: 420, height: 300 },
        createdAt: 1_000,
        lastInteractedAt: 1_000,
        lastHeartbeatAt: 3_500_000,
        bridgeState: 'connected'
      },
      {
        windowId: 'popout-pinned-idle',
        surface: 'port',
        targetId: 6700,
        mode: 'browserwindow',
        route: '/monitor?port=6700',
        title: 'Port 6700',
        pinned: true,
        bounds: { x: 20, y: 20, width: 420, height: 300 },
        createdAt: 1_000,
        lastInteractedAt: 1_000,
        lastHeartbeatAt: 3_500_000,
        bridgeState: 'connected'
      }
    ])

    const result = service.closeIdlePopouts({ now: 3_700_000, idleMs: 3_600_000 })

    expect(result.closedWindowIds).toEqual(['popout-idle'])
    expect(service.listPopouts().find(popout => popout.windowId === 'popout-idle')).toMatchObject({
      bridgeState: 'closed',
      closedAt: 3_700_000
    })
    expect(service.listPopouts().find(popout => popout.windowId === 'popout-pinned-idle')).toMatchObject({
      bridgeState: 'connected',
      pinned: true
    })
  })

  it('broadcasts real theme settings to live BrowserWindow popouts over the bridge', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
      popoutWindows: Map<string, { webContents: { send: ReturnType<typeof vi.fn> }; isDestroyed: () => boolean }>
    }
    serviceInternals.store.set('popouts', [])

    const live = await service.createPopout({
      surface: 'port',
      targetId: 6800,
      mode: 'browserwindow',
      route: '/monitor?port=6800',
      title: 'Port 6800'
    })
    await service.createPopout({
      surface: 'port',
      targetId: 6801,
      mode: 'floating',
      route: '/monitor?port=6801',
      title: 'Port 6801'
    })

    const settings = {
      ...DEFAULT_SETTINGS,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        theme: 'cyberpunk',
        informationDensity: 'compact',
        radiusFamily: 'round',
        motionLevel: 'expressive'
      }
    } satisfies typeof DEFAULT_SETTINGS

    const result = service.broadcastPopoutThemeSettings(settings, { now: 8_888 })
    const liveWindow = serviceInternals.popoutWindows.get(live.windowId)

    expect(result).toEqual({ success: true, sentWindowIds: [live.windowId], emittedAt: 8_888 })
    expect(liveWindow?.webContents.send).toHaveBeenCalledWith('popout:bridge-message', {
      windowId: live.windowId,
      type: 'sync',
      key: 'theme-settings',
      value: {
        emittedAt: 8_888,
        settings
      }
    })
  })

  it('broadcasts generic popout sync messages from a source popout to main and peer popouts', async () => {
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: { send: vi.fn() }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
      popoutWindows: Map<string, { webContents: { send: ReturnType<typeof vi.fn> }; isDestroyed: () => boolean }>
    }
    serviceInternals.store.set('popouts', [])

    const source = await service.createPopout({
      surface: 'port',
      targetId: 7000,
      mode: 'browserwindow',
      route: '/monitor?port=7000',
      title: 'Port 7000'
    })
    const peer = await service.createPopout({
      surface: 'port',
      targetId: 7001,
      mode: 'browserwindow',
      route: '/monitor?port=7001',
      title: 'Port 7001'
    })

    const sourceWindow = serviceInternals.popoutWindows.get(source.windowId)
    const peerWindow = serviceInternals.popoutWindows.get(peer.windowId)
    sourceWindow?.webContents.send.mockClear()
    peerWindow?.webContents.send.mockClear()
    mainWindow.webContents.send.mockClear()

    const message = {
      windowId: source.windowId,
      type: 'sync',
      key: 'port-view-state',
      value: {
        selectedPort: 7000,
        filter: 'listening',
        searchPort: '7000',
        viewMode: 'cards'
      }
    } as const

    const result = service.handlePopoutBridgeMessage(message)

    expect(result).toEqual({
      success: true,
      windowId: source.windowId,
      type: 'sync',
      sentWindowIds: ['main', peer.windowId]
    })
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('popout:bridge-message', message)
    expect(peerWindow?.webContents.send).toHaveBeenCalledWith('popout:bridge-message', message)
    expect(sourceWindow?.webContents.send).not.toHaveBeenCalledWith('popout:bridge-message', message)

    sourceWindow?.webContents.send.mockClear()
    peerWindow?.webContents.send.mockClear()
    mainWindow.webContents.send.mockClear()

    const mainMessage = {
      ...message,
      windowId: 'main:port-view',
      value: {
        selectedPort: 7001,
        filter: 'common',
        searchPort: '7001',
        viewMode: 'list'
      }
    } as const
    const mainResult = service.handlePopoutBridgeMessage(mainMessage)

    expect(mainResult).toEqual({
      success: true,
      windowId: 'main:port-view',
      type: 'sync',
      sentWindowIds: [source.windowId, peer.windowId]
    })
    expect(mainWindow.webContents.send).not.toHaveBeenCalledWith('popout:bridge-message', mainMessage)
    expect(sourceWindow?.webContents.send).toHaveBeenCalledWith('popout:bridge-message', mainMessage)
    expect(peerWindow?.webContents.send).toHaveBeenCalledWith('popout:bridge-message', mainMessage)
  })

  it('uses the shared persist:popouts session for BrowserWindow popouts', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const serviceInternals = service as unknown as {
      popoutWindows: Map<string, { options: { webPreferences?: { session?: unknown } } }>
    }
    const popoutSession = vi.mocked(session.fromPartition).mock.results[0]?.value as {
      partition: string
      webRequest: { onHeadersReceived: ReturnType<typeof vi.fn> }
    } | undefined
    if (!popoutSession) throw new Error('persist:popouts test session was not created')

    const popout = await service.createPopout({
      surface: 'port',
      targetId: 6900,
      mode: 'browserwindow',
      route: '/monitor?port=6900',
      title: 'Port 6900'
    })
    const popoutWindow = serviceInternals.popoutWindows.get(popout.windowId)

    expect(session.fromPartition).toHaveBeenCalledWith('persist:popouts')
    expect(popoutSession.partition).toBe('persist:popouts')
    expect(popoutWindow?.options.webPreferences?.session).toBe(popoutSession)
  })

  it('persists port popout positions through the main electron-store wrapper', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const saved = service.savePortPopoutPosition({
      port: 3000,
      position: { x: 220.4, y: 360.6 },
      size: { width: 420.2, height: 340.7 }
    })

    expect(saved).toMatchObject({
      success: true,
      port: 3000,
      position: { x: 220.4, y: 360.6 },
      size: { width: 420.2, height: 340.7 }
    })

    const reloaded = createRuntimeService(() => null, runtime as never)
    expect(reloaded.getPortPopoutPosition({ port: 3000 })).toMatchObject({
      success: true,
      port: 3000,
      position: { x: 220, y: 361 },
      size: { width: 420, height: 341 }
    })
  })

  it('routes port-specific popout open/list/pin/sync/batch/close paths through real runtime state', async () => {
    const mainWindow = { webContents: { send: vi.fn() }, isDestroyed: () => false }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
    }
    serviceInternals.store.set('popouts', [])

    const opened = await service.openPortPopout({
      port: 3000,
      pid: 1234,
      trigger: 'click',
      mode: 'browserwindow'
    })
    const peer = await service.openPortPopout({
      port: 3001,
      pid: 1235,
      trigger: 'drag',
      mode: 'browserwindow'
    })

    expect(opened).toMatchObject({
      success: true,
      popoutId: expect.stringMatching(/^popout-/),
      port: 3000,
      pid: 1234,
      mode: 'browserwindow'
    })
    expect(service.listPortPopouts()).toMatchObject({
      success: true,
      popouts: expect.arrayContaining([
        expect.objectContaining({ popoutId: opened.popoutId, port: 3000, pid: 1234 }),
        expect.objectContaining({ popoutId: peer.popoutId, port: 3001, pid: 1235 })
      ])
    })

    const pinned = service.pinPortPopout({ popoutId: opened.popoutId, pinned: true })
    expect(pinned).toMatchObject({ success: true, popoutId: opened.popoutId, pinned: true })

    const synced = service.syncPortPopout({
      popoutId: opened.popoutId,
      key: 'selection',
      value: { port: 3000 }
    })
    expect(synced).toMatchObject({
      success: true,
      popoutId: opened.popoutId,
      key: 'selection',
      sentWindowIds: expect.arrayContaining(['main', peer.popoutId])
    })
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('popout:bridge-message', expect.objectContaining({
      windowId: opened.popoutId,
      type: 'sync',
      key: 'selection'
    }))

    const batch = service.batchPortPopouts({
      confirmedBy: 'vitest',
      operations: [
        { popoutId: peer.popoutId, action: 'close' },
        { popoutId: opened.popoutId, action: 'unpin' }
      ]
    })
    expect(batch).toMatchObject({
      success: true,
      confirmedBy: 'vitest',
      results: [
        { popoutId: peer.popoutId, action: 'close', success: true },
        { popoutId: opened.popoutId, action: 'unpin', success: true }
      ]
    })

    const closed = service.closePortPopout({ popoutId: opened.popoutId, reason: 'user' })
    expect(closed).toMatchObject({
      success: true,
      popoutId: opened.popoutId,
      reason: 'user'
    })
  })

  it('demotes port-specific BrowserWindow popouts back to floating runtime records', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
    }
    serviceInternals.store.set('popouts', [])

    const opened = await service.openPortPopout({
      port: 3010,
      pid: 2345,
      trigger: 'context-menu',
      mode: 'browserwindow'
    })
    const demoted = await service.demotePortPopout({ popoutId: opened.popoutId })

    expect(demoted).toMatchObject({
      success: true,
      popoutId: opened.popoutId,
      floatingId: expect.stringMatching(/^popout-/),
      popout: {
        port: 3010,
        pid: 2345,
        mode: 'floating',
        browserPopout: expect.objectContaining({
          surface: 'port',
          targetId: 'port:3010:pid:2345',
          mode: 'floating'
        })
      }
    })
    expect(demoted.floatingId).not.toBe(opened.popoutId)
    expect(service.listPopouts().find(popout => popout.windowId === opened.popoutId)?.bridgeState).toBe('closed')
    expect(service.listPortPopouts()).toMatchObject({
      success: true,
      popouts: [
        expect.objectContaining({
          popoutId: demoted.floatingId,
          port: 3010,
          pid: 2345,
          mode: 'floating'
        })
      ]
    })
  })

  it('auto-evicts unpinned BrowserWindow port popouts when the RSS budget is exceeded', async () => {
    const mainWindow = { webContents: { send: vi.fn() }, isDestroyed: () => false }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
    }
    serviceInternals.store.set('popouts', [])

    const pinned = await service.openPortPopout({
      port: 3000,
      pid: 2234,
      trigger: 'click',
      mode: 'browserwindow'
    })
    const unpinned = await service.openPortPopout({
      port: 3001,
      pid: 2235,
      trigger: 'drag',
      mode: 'browserwindow'
    })

    service.pinPortPopout({ popoutId: pinned.popoutId, pinned: true })

    const now = Date.now() + 60_000
    const result = service.closeRssHeavyPopouts({
      now,
      popoutRssByWindowId: {
        [pinned.popoutId]: 90,
        [unpinned.popoutId]: 460
      }
    })

    expect(result).toMatchObject({
      success: true,
      closedAt: now,
      closedWindowIds: [unpinned.popoutId],
      blockedWindowIds: [],
      degradedWindowIds: [],
      perPopoutLimitMb: 100,
      totalLimitMb: 500,
      totalRssMb: 90
    })
    expect(service.listPortPopouts()).toMatchObject({
      success: true,
      popouts: [
        expect.objectContaining({ popoutId: pinned.popoutId, port: 3000, pid: 2234, pinned: true, bridgeState: 'connected' })
      ]
    })
  })

  it('degrades a single over-budget BrowserWindow port popout without closing it when the total budget is still safe', async () => {
    const mainWindow = { webContents: { send: vi.fn() }, isDestroyed: () => false }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
    }
    serviceInternals.store.set('popouts', [])

    const popout = await service.openPortPopout({
      port: 3002,
      pid: 2236,
      trigger: 'click',
      mode: 'browserwindow'
    })

    const result = service.closeRssHeavyPopouts({
      now: 43_000,
      popoutRssByWindowId: {
        [popout.popoutId]: 140
      }
    })

    expect(result).toMatchObject({
      success: true,
      closedWindowIds: [],
      blockedWindowIds: [],
      degradedWindowIds: [popout.popoutId],
      perPopoutLimitMb: 100,
      totalLimitMb: 500,
      totalRssMb: 140
    })
    expect(service.listPortPopouts()).toMatchObject({
      success: true,
      popouts: [
        expect.objectContaining({
          popoutId: popout.popoutId,
          port: 3002,
          pid: 2236,
          mode: 'browserwindow',
          bridgeState: 'connected'
        })
      ]
    })
  })

  it('keeps a fresh over-total BrowserWindow port popout alive during the RSS degrade grace window', async () => {
    const mainWindow = { webContents: { send: vi.fn() }, isDestroyed: () => false }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const serviceInternals = service as unknown as {
      store: { set: (key: string, value: unknown) => void }
    }
    serviceInternals.store.set('popouts', [])

    const popout = await service.openPortPopout({
      port: 3003,
      pid: 2237,
      trigger: 'click',
      mode: 'browserwindow'
    })

    const result = service.closeRssHeavyPopouts({
      now: Date.now() + 5_000,
      popoutRssByWindowId: {
        [popout.popoutId]: 620
      }
    })

    expect(result).toMatchObject({
      success: true,
      closedWindowIds: [],
      blockedWindowIds: [],
      degradedWindowIds: [popout.popoutId],
      totalRssMb: 620
    })
    expect(service.listPortPopouts()).toMatchObject({
      success: true,
      popouts: [
        expect.objectContaining({
          popoutId: popout.popoutId,
          port: 3003,
          pid: 2237,
          mode: 'browserwindow',
          bridgeState: 'connected'
        })
      ]
    })
  })

  it('checks BrowserWindow popout RSS release after close in dev assertion mode', async () => {
    const previousFlag = process.env.DEVHUB_R8_POPOUT_RSS_ASSERT
    const electronApp = app as unknown as { getAppMetrics?: () => unknown[] }
    const previousGetAppMetrics = electronApp.getAppMetrics
    process.env.DEVHUB_R8_POPOUT_RSS_ASSERT = '1'
    electronApp.getAppMetrics = vi.fn(() => [
      { pid: 9010, memory: { workingSetSize: 96 * 1024 } }
    ])

    try {
      const service = createRuntimeService(() => null, runtime as never)
      const serviceInternals = service as unknown as {
        store: { set: (key: string, value: unknown) => void }
        popoutWindows: Map<string, { webContents: { getOSProcessId?: () => number } }>
      }
      serviceInternals.store.set('popouts', [])

      const opened = await service.openPortPopout({
        port: 3020,
        pid: 3456,
        trigger: 'click',
        mode: 'browserwindow'
      })
      const popoutWindow = serviceInternals.popoutWindows.get(opened.popoutId)
      if (!popoutWindow) throw new Error('expected live popout window')
      popoutWindow.webContents.getOSProcessId = () => 9010

      service.closePortPopout({ popoutId: opened.popoutId, reason: 'user' })
      const releaseCheck = service.runClosedPopoutRssReleaseCheck({
        windowId: opened.popoutId,
        now: 5_000,
        appMetrics: []
      })

      expect(releaseCheck).toMatchObject({
        success: true,
        passed: true,
        windowId: opened.popoutId,
        pid: 9010,
        status: 'released',
        reason: 'process-closed',
        rssBeforeMb: 96,
        rssAfterMb: null
      })
    } finally {
      if (previousFlag === undefined) {
        delete process.env.DEVHUB_R8_POPOUT_RSS_ASSERT
      } else {
        process.env.DEVHUB_R8_POPOUT_RSS_ASSERT = previousFlag
      }
      if (previousGetAppMetrics) {
        electronApp.getAppMetrics = previousGetAppMetrics
      } else {
        delete electronApp.getAppMetrics
      }
    }
  })

  it('installs a strict CSP header on the shared popout session', () => {
    const previousRendererUrl = process.env.ELECTRON_RENDERER_URL
    delete process.env.ELECTRON_RENDERER_URL
    try {
      createRuntimeService(() => null, runtime as never)
      const popoutSession = vi.mocked(session.fromPartition).mock.results[0]?.value as {
        webRequest: { onHeadersReceived: ReturnType<typeof vi.fn> }
      } | undefined
      if (!popoutSession) throw new Error('persist:popouts test session was not created')
      const listener = popoutSession.webRequest.onHeadersReceived.mock.calls[0]?.[0] as ((
        details: { responseHeaders?: Record<string, string[]> },
        callback: (response: { responseHeaders: Record<string, string[]> }) => void
      ) => void) | undefined
      if (!listener) throw new Error('popout CSP listener was not registered')

      const callback = vi.fn()
      listener({
        responseHeaders: {
          'X-Existing': ['1'],
          'content-security-policy': ["default-src *; script-src * 'unsafe-inline'"]
        }
      }, callback)

      const response = callback.mock.calls[0]?.[0] as { responseHeaders: Record<string, string[]> } | undefined
      const csp = response?.responseHeaders['Content-Security-Policy']?.[0]
      expect(response?.responseHeaders['X-Existing']).toEqual(['1'])
      expect(response?.responseHeaders['content-security-policy']).toBeUndefined()
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain("worker-src 'self' blob:")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-src 'none'")
      expect(csp).toContain("base-uri 'self'")
      expect(csp).toContain("form-action 'none'")
      expect(csp).not.toContain("'unsafe-eval'")
    } finally {
      if (previousRendererUrl === undefined) delete process.env.ELECTRON_RENDERER_URL
      else process.env.ELECTRON_RENDERER_URL = previousRendererUrl
    }
  })

  it('detects Cursor and Copilot window-title signals from scanner cache', () => {
    const auditSpy = vi.spyOn(auditLogger, 'log')
    const service = createRuntimeService(() => null, {
      scannerCache: {
        getSnapshot: () => ({
          windows: { data: [
            { hwnd: 31, title: 'Cursor - Editing main.ts', processName: 'Cursor.exe', pid: 301, className: 'Chrome_WidgetWin_1', rect: { x: 0, y: 0, width: 100, height: 100 }, isVisible: true, isMinimized: false, isSystemWindow: false },
            { hwnd: 32, title: 'Visual Studio Code - main.ts (Copilot suggesting)', processName: 'Code.exe', pid: 302, className: 'Chrome_WidgetWin_1', rect: { x: 0, y: 0, width: 100, height: 100 }, isVisible: true, isMinimized: false, isSystemWindow: false }
          ] },
          aiTasks: { data: [] },
          systemSummary: {}
        })
      }
    } as never)

    const status = service.cursorCopilotStatus()

    expect(status.signals).toHaveLength(2)
    expect(status.signals[0].source).toBe('window-title')
    expect(status.signals[0].titleHash).toHaveLength(16)
    expect(status.confidence).toBeGreaterThanOrEqual(0.5)
    expect(auditSpy).toHaveBeenCalledWith('cli:cursor-copilot-title-signal', expect.objectContaining({
      titleHash: expect.any(String),
      hwnd: expect.any(Number),
      pid: expect.any(Number),
      processName: expect.any(String)
    }), 'success', undefined)
    expect(auditSpy.mock.calls.some(([action, target]) => action === 'cli:cursor-copilot-title-signal' && Object.prototype.hasOwnProperty.call(target, 'rawTitle'))).toBe(false)
    expect(() => service.reloadTitleRules({ rules: [{ tool: 'cursor', regex: 'Cursor Waiting', phase: 'thinking', confidence: 0.6 }] })).toThrow('E_PERMISSION')
    expect(service.reloadTitleRules({ rules: [{ tool: 'cursor', regex: 'Cursor Waiting', phase: 'thinking', confidence: 0.6 }], confirmedBy: 'vitest' })).toMatchObject({ success: true, confirmedBy: 'vitest' })
    auditSpy.mockRestore()
  })


  it('locks, saves, rejects cyclic CSV writes, and protects external mtime changes', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-csv-editor-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const csvPath = join(userData, 'tasks.csv')
    const originalRows = [
      csvRow({ taskId: 'A', taskName: 'Root A', dependsOn: '' }),
      csvRow({ taskId: 'B', taskName: 'Child B', dependsOn: 'after:A' }),
      csvRow({ taskId: 'C', taskName: 'Child C', dependsOn: 'after:B' })
    ]
    await writeFile(csvPath, csvDocument(originalRows), 'utf8')
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)

    try {
      const lockPath = `${csvPath}.lock`
      await writeFile(lockPath, JSON.stringify({
        csvPath,
        lockPath,
        ownerPid: process.pid + 10_000,
        owner: 'other-devhub',
        token: randomUUID(),
        lockedAt: Date.now(),
        expiresAt: Date.now() + 600_000
      }), 'utf8')
      const blocked = await service.lockCsv({ csvPath, confirmedBy: 'vitest' })
      expect(blocked.acquired).toBe(false)
      expect(auditSpy).toHaveBeenCalledWith('csv:lock-conflict', expect.objectContaining({ csvPath, confirmedBy: 'vitest' }), 'refused', 'E_CSV_LOCKED')
      await rm(lockPath, { force: true })

      const locked = await service.lockCsv({ csvPath, confirmedBy: 'vitest' })
      expect(locked.acquired).toBe(true)
      expect(locked.rows.map(row => row.taskId)).toEqual(['A', 'B', 'C'])
      expect(auditSpy).toHaveBeenCalledWith('csv:dag-editor-open', expect.objectContaining({ csvPath, rowCount: 3, confirmedBy: 'vitest' }), 'success', undefined)

      const editedRows = locked.rows.map(row => row.taskId === 'B' ? { ...row, priority: 'P0' as const } : row)
      const saved = await service.saveCsv({ csvPath, rows: editedRows, expectedMtimeMs: locked.mtimeMs ?? undefined, confirmedBy: 'vitest' })
      expect(saved.success).toBe(true)
      expect(await readFile(csvPath, 'utf8')).toContain('P0')
      expect(auditSpy).toHaveBeenCalledWith('csv:save', expect.objectContaining({ csvPath, rowCount: 3, confirmedBy: 'vitest' }), 'success')

      const beforeCycleContent = await readFile(csvPath, 'utf8')
      const cyclicRows = editedRows.map(row => row.taskId === 'A' ? { ...row, dependsOn: 'after:C' } : row)
      const cycle = await service.saveCsv({ csvPath, rows: cyclicRows, expectedMtimeMs: saved.mtimeMs, confirmedBy: 'vitest' })
      expect(cycle.success).toBe(false)
      expect(cycle.cycleDetected).toBe(true)
      expect(await readFile(csvPath, 'utf8')).toBe(beforeCycleContent)
      expect(auditSpy).toHaveBeenCalledWith('csv:cycle-attempt', expect.objectContaining({ csvPath, rowCount: 3, confirmedBy: 'vitest' }), 'refused', 'E_DAG_CYCLE')

      await new Promise(resolve => setTimeout(resolve, 20))
      await writeFile(csvPath, csvDocument([csvRow({ taskId: 'A', taskName: 'Externally edited' })]), 'utf8')
      const externalMtimeMs = Math.trunc((await stat(csvPath)).mtimeMs)
      expect(externalMtimeMs).not.toBe(saved.mtimeMs)
      await waitUntil(() => mainWindow.webContents.send.mock.calls.some(([channel, payload]) => (
        channel === 'csv:external-change-stream'
        && payload?.csvPath === csvPath
        && payload?.kind === 'change'
        && payload?.expectedMtimeMs === saved.mtimeMs
        && payload?.observedMtimeMs === externalMtimeMs
      )), 5000)
      expect(auditSpy).toHaveBeenCalledWith('csv:external-modify', expect.objectContaining({ csvPath, expectedMtimeMs: saved.mtimeMs, observedMtimeMs: externalMtimeMs }), 'success')
      const conflict = await service.saveCsv({ csvPath, rows: editedRows, expectedMtimeMs: saved.mtimeMs, confirmedBy: 'vitest' })
      expect(conflict.success).toBe(false)
      expect(conflict.error).toBe('E_INTEGRITY_FAIL')
      expect(auditSpy).toHaveBeenCalledWith('csv:save', expect.objectContaining({ csvPath, rowCount: 3, confirmedBy: 'vitest' }), 'refused', 'E_INTEGRITY_FAIL')

      const released = await service.unlockCsv({ csvPath, confirmedBy: 'vitest' })
      expect(released.released).toBe(true)
      expect(auditSpy).toHaveBeenCalledWith('csv:dag-editor-close', expect.objectContaining({ csvPath, released: true, confirmedBy: 'vitest' }), 'success', undefined)
    } finally {
      auditSpy.mockRestore()
      service.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('stores and deletes real CSV node templates with duplicate-name protection', () => {
    const service = createRuntimeService(() => null, runtime as never)
    expect(service.listCsvTemplates({ source: 'builtin' })).toHaveLength(BUILTIN_NODE_TEMPLATES.length)
    expect(service.listCsvTemplates({ source: 'builtin' }).map(template => template.name)).toEqual(['PR 描述', 'commit', '修 bug', '写测试', '代码评审'])
    const saved = service.saveCsvTemplate({ name: 'code-review-block', rowTemplate: csvRow({ taskId: 'template-A' }), confirmedBy: 'vitest' })
    expect(saved.template.name).toBe('code-review-block')
    expect(service.listCsvTemplates({ source: 'user' })).toHaveLength(1)
    expect(service.listCsvTemplates()).toHaveLength(BUILTIN_NODE_TEMPLATES.length + 1)
    expect(() => service.saveCsvTemplate({ name: 'code-review-block', rowTemplate: csvRow({ taskId: 'template-B' }), confirmedBy: 'vitest' })).toThrow('E_VALIDATION')
    expect(service.deleteCsvTemplate({ id: saved.template.id, confirmedBy: 'vitest' }).deleted).toBe(1)
    expect(service.listCsvTemplates({ source: 'user' })).toHaveLength(0)
    expect(service.listCsvTemplates({ source: 'builtin' })).toHaveLength(BUILTIN_NODE_TEMPLATES.length)
  })

  it('stores SQLite-backed signal misreports, explains diagnostics, rate-limits duplicates, and resets learned weights', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-misreport-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    const service = createRuntimeService(() => null, runtime as never)
    const now = 150_000

    service.fuseSignals({
      instanceId: 'ai-2',
      now,
      samples: [
        { source: 'cli_parse', rawValue: 0.05, confidence: 0.9, ts: now },
        { source: 'window_title', rawValue: 0.02, confidence: 0.5, ts: now }
      ]
    })

    try {
      const response = service.reportMisreport({ instanceId: 'ai-2', kind: 'false-idle', expectedTaskState: 'running', userNote: 'token=secret vitest note', confirmedBy: 'vitest' })
      expect(response.id).toMatch(/[0-9a-f-]{36}/)
      expect(response.weightAdjustments.every(item => Math.abs(item.delta) <= 0.05)).toBe(true)
      expect(response.weightAdjustments.some(item => item.source === 'cli_parse' && item.delta > 0)).toBe(true)
      expect(service.listMisreports().some(item => item.instanceId === 'ai-2' && item.kind === 'false-idle')).toBe(true)
      expect(service.diagnosticExplain({ instanceId: 'ai-2' }).topReasons.length).toBeLessThanOrEqual(5)
      expect(() => service.reportMisreport({ instanceId: 'ai-2', kind: 'false-idle', expectedTaskState: 'running' })).toThrow('E_RATE_LIMITED')
      expect(service.resetLearnedWeights({ confirmedBy: 'vitest' }).profileResetTo).toBe('default')
      expect(service.fusionConfig().profileId).toBe('default')
      expect(auditSpy).toHaveBeenCalledWith('ai:report-misreport', expect.objectContaining({
        id: response.id,
        instanceId: 'ai-2',
        kind: 'false-idle'
      }), 'success')
      expect(auditSpy).toHaveBeenCalledWith('ai:reset-learned-weights', expect.objectContaining({ profileResetTo: 'default' }), 'success')
    } finally {
      service.dispose()
      auditSpy.mockRestore()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('persists recovery reports and dismisses them by id', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    const report = await service.recoveryScan()

    expect(report.reportId).toMatch(/^recovery-/)
    expect(service.recoveryReport().some(item => item.reportId === report.reportId)).toBe(true)
    expect(service.dismissRecoveryReport({ reportId: report.reportId }).success).toBe(true)
    expect(service.recoveryReport().some(item => item.reportId === report.reportId)).toBe(false)
  })

  it('records and stops replayable operator sessions without exporting fake artifacts', () => {
    const service = createRuntimeService(() => null, runtime as never)

    expect(() => service.startRecording({ label: 'vitest' })).toThrow('E_PERMISSION')
    const recording = service.startRecording({ label: 'vitest', source: 'system', confirmedBy: 'vitest' })
    expect(recording.status).toBe('recording')
    expect(service.stopRecording({ sessionId: recording.sessionId, confirmedBy: 'vitest' })?.status).toBe('stopped')
    expect(service.getRecordingManifest({ sessionId: recording.sessionId }).success).toBe(true)

    const replay = service.startReplay({ sessionId: recording.sessionId, confirmedBy: 'vitest' })
    expect(service.seekReplay({ replayId: replay.replayId, cursorMs: 50 })?.cursorMs).toBe(50)
  })

  it('persists spec-22 recording manifests and captures parsed stdout through the runtime bridge', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-recording-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-r8c-recording-cwd-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    try {
      const service = createRuntimeService(() => null, runtime as never)
      service.setFeatureFlag({ flag: 'R8.C.recording.engine', value: true, confirmedBy: 'vitest' })
      const sessionId = randomUUID()
      const manifest = await service.startRecording({
        sessionId,
        taskId: 'runtime-recording',
        cwd,
        enabledStreams: ['stdout', 'stdin'],
        confirmedBy: 'vitest'
      })

      service.parseCliChunk({ tool: 'codex', stream: 'stdout', chunk: 'real stdout line', sessionId, strategy: 'line' })
      await waitForRecordingEvent(async () => (await service.getRecordingEvents({ recordingId: manifest.recordingId, kind: 'stdout' })).length > 0)
      await service.stopRecording({ recordingId: manifest.recordingId, confirmedBy: 'vitest' })

      const listed = await service.listRecordings({ sessionId })
      expect(listed).toHaveLength(1)
      const events = await service.getRecordingEvents({ recordingId: manifest.recordingId, kind: 'stdout' })
      expect(events[0]?.kind).toBe('stdout')
      const replayState = await service.getRecordingReplayState({ recordingId: manifest.recordingId, cursorTs: Date.now(), speed: 2 })
      const eventWindow = await service.getRecordingEventsWindow({ recordingId: manifest.recordingId, sinceTs: replayState.startedAtAbsTs, untilTs: replayState.endedAtAbsTs, kinds: ['stdout'] })
      const cast = await service.getRecordingCast({ recordingId: manifest.recordingId })
      expect(replayState.recordingId).toBe(manifest.recordingId)
      expect(eventWindow.some(event => event.kind === 'stdout')).toBe(true)
      expect(cast.cast.events.some(event => event[2] === 'real stdout line')).toBe(true)
      const castPath = join(userData, 'runtime.cast')
      await service.exportRecordingAsciinema({ recordingId: manifest.recordingId, outPath: castPath })
      expect((await readFile(castPath, 'utf8')).split('\n')[0]).toContain('"version":2')
      expect(await service.deleteRecording({ recordingId: manifest.recordingId, confirmedBy: 'vitest' })).toEqual({ deleted: true })
    } finally {
      const cleanupService = createRuntimeService(() => null, runtime as never)
      cleanupService.setFeatureFlag({ flag: 'R8.C.recording.engine', value: true, confirmedBy: 'vitest-restore' })
      await rm(userData, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('honors spec-22 recording engine and optional stream feature flags', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-recording-flags-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-r8c-recording-flags-cwd-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    try {
      const service = createRuntimeService(() => null, runtime as never)
      service.setFeatureFlag({ flag: 'R8.C.recording.engine', value: true, confirmedBy: 'vitest' })
      service.setFeatureFlag({ flag: 'R8.C.recording.engine.screenshot', value: true, confirmedBy: 'vitest' })
      service.setFeatureFlag({ flag: 'R8.C.recording.engine.screenshot', value: false, confirmedBy: 'vitest' })
      const manifest = await service.startRecording({
        sessionId: randomUUID(),
        taskId: 'runtime-recording-flags',
        cwd,
        enabledStreams: ['stdout', 'screenshot', 'fs', 'git-diff'],
        confirmedBy: 'vitest'
      })

      expect(manifest.enabledStreams).toEqual(['stdout', 'fs', 'git-diff'])
      await service.stopRecording({ recordingId: manifest.recordingId, confirmedBy: 'vitest' })
      service.setFeatureFlag({ flag: 'R8.C.recording.engine', value: false, confirmedBy: 'vitest' })
      expect(() => service.startRecording({ label: 'disabled', source: 'system', confirmedBy: 'vitest' })).toThrow('E_FEATURE_DISABLED:R8.C.recording.engine')
    } finally {
      const cleanupService = createRuntimeService(() => null, runtime as never)
      cleanupService.setFeatureFlag({ flag: 'R8.C.recording.engine', value: true, confirmedBy: 'vitest-restore' })
      cleanupService.setFeatureFlag({ flag: 'R8.C.recording.engine.screenshot', value: true, confirmedBy: 'vitest-restore' })
      await rm(userData, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('builds spec-26 attached flow from real task and recording events with default 30min window', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-flow-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-r8c-flow-cwd-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)
    try {
      service.enqueueCsvRow({ id: 'flow-failed', group: 'flow-failed-session', tool: 'codex', prompt: 'real failed task', retries: 0 })
      const failed = service.startReadyTasks({ sessionId: 'flow-failed-session', concurrent: 1 }).started[0]
      service.completeTaskRun({ runId: failed.runId, exitCode: 1, errorCode: 'E_FLOW_REAL' })
      service.enqueueCsvRow({ id: 'flow-retry', group: 'flow-retry-session', tool: 'codex', prompt: 'real retry task', retries: 1 })
      const retried = service.startReadyTasks({ sessionId: 'flow-retry-session', concurrent: 1 }).started[0]
      service.completeTaskRun({ runId: retried.runId, exitCode: 1, errorCode: 'E_RETRY_REAL' })

      const sessionId = randomUUID()
      const manifest = await service.startRecording({ sessionId, taskId: 'flow-recording', cwd, enabledStreams: ['stdout'], confirmedBy: 'vitest' })
      service.parseCliChunk({ tool: 'codex', stream: 'stdout', chunk: 'flow real stdout', sessionId, strategy: 'line' })
      await waitForRecordingEvent(async () => (await service.getRecordingEvents({ recordingId: manifest.recordingId, kind: 'stdout' })).length > 0)
      await service.stopRecording({ recordingId: manifest.recordingId, confirmedBy: 'vitest' })

      const snapshot = await service.getAttachedFlow({ scope: 'runtime' })
      expect(snapshot.windowMs).toBe(1800000)
      expect(snapshot.toTs - snapshot.fromTs).toBeLessThanOrEqual(1800000)
      expect(snapshot.nodes.some(node => node.kind === 'task-fail' && node.errorCode === 'E_FLOW_REAL')).toBe(true)
      expect(snapshot.nodes.some(node => node.kind === 'task-retry')).toBe(true)
      expect(snapshot.nodes.some(node => node.meta.source === 'recording')).toBe(true)
      expect(snapshot.stats.failCount).toBeGreaterThanOrEqual(1)
      expect(snapshot.stats.retryCount).toBeGreaterThanOrEqual(1)

      const stats = await service.flowScopedStats({ scope: 'runtime' })
      expect(stats.totalEvents).toBeGreaterThanOrEqual(snapshot.stats.totalEvents)
      const exported = await service.exportFlowTimeline({ scope: 'runtime', format: 'mermaid-sequence' })
      expect(exported.content).toMatch(/^sequenceDiagram/)
      expect(exported.content).toContain('participant')
    } finally {
      service.dispose()
      await rm(userData, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('streams spec-26 attached flow events through a real WebContents subscriber', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-flow-stream-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const send = vi.fn()
    const sender = {
      id: 26026,
      isDestroyed: () => false,
      send,
      once: vi.fn()
    }
    const service = createRuntimeService(() => null, runtime as never)
    try {
      const response = service.subscribeFlowEventStream(sender as never, {
        subscriberId: 'flow-vitest',
        request: { scope: 'runtime' },
        intervalMs: 500
      })
      expect(response).toEqual({ success: true, subscriberId: 'flow-vitest' })
      await waitUntil(() => send.mock.calls.some(([channel]) => channel === 'flow:event-stream'), 3000)

      service.enqueueCsvRow({ id: 'flow-stream-failed', group: 'flow-stream-session', tool: 'codex', prompt: 'real stream failure', retries: 0 })
      const started = service.startReadyTasks({ sessionId: 'flow-stream-session', concurrent: 1 }).started[0]
      service.completeTaskRun({ runId: started.runId, exitCode: 1, errorCode: 'E_FLOW_STREAM' })

      await waitUntil(() => send.mock.calls.some(([channel, payload]) =>
        channel === 'flow:event-stream'
        && payload?.subscriberId === 'flow-vitest'
        && payload?.appendedNodes?.some((node: { errorCode?: string | null }) => node.errorCode === 'E_FLOW_STREAM')
      ), 4000)
      expect(service.unsubscribeFlowEventStream({ subscriberId: 'flow-vitest' })).toEqual({ success: true, subscriberId: 'flow-vitest' })
    } finally {
      service.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('keeps permission reset behind explicit operator confirmation', () => {
    const service = createRuntimeService(() => null, runtime as never)

    expect(service.listPermissionAllowlist()).toEqual(expect.any(Array))
    expect(() => service.resetPermissions({})).toThrow('E_PERMISSION')
    expect(service.resetPermissions({ confirmedBy: 'vitest' }).success).toBe(true)
  })

  it('creates classified local backup artifacts with manifest hashes and secret redaction', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-backup-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const skillDir = join(userData, 'skills', 'secret-skill')
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), [
      '---',
      "schemaVersion: '1.0'",
      'name: secret-skill',
      'displayName: Secret Skill',
      'version: 1.0.0',
      'description: Secret skill for backup redaction checks.',
      'scriptPath: script.js',
      'runtime: node',
      'permissions: []',
      '---',
      'Use tok-secret12345 and AKIAABCDEFGHIJKLMNOP only for redaction checks.'
    ].join('\n'), 'utf8')
    const secretStore = {
      ...appStore,
      getSettings: vi.fn(() => ({
        appearance: { theme: 'dark' },
        scan: {},
        process: {},
        notification: {},
        window: {},
        advanced: { apiKey: 'sk-realistic12345', token: 'tok-realistic12345', jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature12345' },
        firstLaunchDone: true
      })),
      getProjects: vi.fn(() => [])
    }
    const service = createRuntimeServiceWithStore(secretStore as never, () => null, runtime as never)

    try {
      const bundle = await service.createBackup({ categories: ['settings', 'csv-tasks', 'skills', 'audit-log'] })
      const manifestText = await readFile(join(bundle.path, 'manifest.json'), 'utf8')
      const manifest = JSON.parse(manifestText) as { categories: Array<{ category: string; sha256: string; relativePath: string }>; redactedFields: string[]; zipPath: string }
      const settingsContent = await readFile(join(bundle.path, 'settings', 'store.json'), 'utf8')
      const skillsContent = await readFile(join(bundle.path, 'skills', 'skills.json'), 'utf8')
      if (!bundle.zipPath) throw new Error('zipPath missing from classified backup')
      const zipContent = await readFile(bundle.zipPath)

      expect(manifest.categories).toHaveLength(4)
      expect(manifest.categories.every(entry => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true)
      expect(manifest.zipPath).toBe(bundle.zipPath)
      expect(zipContent.subarray(0, 4).toString('hex')).toBe('504b0304')
      expect(manifest.redactedFields.length).toBeGreaterThan(0)
      expect(`${settingsContent}\n${skillsContent}`).not.toMatch(/sk-realistic|tok-realistic|AKIAABCDEFGHIJKLMNOP|eyJhbGci/)
    } finally {
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('lists local data ownership paths, browses real entries, and exports a real archive', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-data-ownership-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const skillDir = join(userData, 'skills', 'data-owned-skill')
    const csvDir = join(userData, 'tasks')
    await mkdir(skillDir, { recursive: true })
    await mkdir(csvDir, { recursive: true })
    await writeFile(join(userData, 'devhub-config.json'), '{"appearance":{"theme":"dark"}}\n', 'utf8')
    await writeFile(join(skillDir, 'SKILL.md'), 'name: data-owned-skill\nruntime: node\n', 'utf8')
    await writeFile(join(csvDir, 'example.csv'), csvDocument([csvRow({ taskId: 'data-owner-row' })]), 'utf8')
    const service = createRuntimeService(() => null, runtime as never)

    try {
      const paths = await service.listDataOwnershipPaths()
      const rootsById = new Map(paths.roots.map(root => [root.rootId, root]))

      expect(rootsById.get('user-data')).toMatchObject({ exists: true, kind: 'directory', sensitive: true, exportable: false })
      expect(rootsById.get('settings-store')).toMatchObject({ exists: true, kind: 'file', sensitive: true, exportable: true })
      expect(rootsById.get('skills')).toMatchObject({ exists: true, kind: 'directory', sensitive: true, exportable: true })
      expect(rootsById.get('csv-tasks')).toMatchObject({ exists: true, kind: 'directory', sensitive: true, exportable: true })
      expect(rootsById.get('skills')?.fileCount).toBeGreaterThanOrEqual(1)
      expect(rootsById.get('skills')?.sizeBytes).toBeGreaterThan(0)

      const rootEntries = await service.listDataOwnershipEntries({ rootId: 'skills' })
      expect(rootEntries).toMatchObject({
        rootId: 'skills',
        kind: 'directory',
        exists: true,
        entriesTruncated: false
      })
      expect(rootEntries.entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'data-owned-skill', kind: 'directory', relativePath: 'data-owned-skill' })
      ]))

      const skillEntries = await service.listDataOwnershipEntries({ rootId: 'skills', relativePath: 'data-owned-skill' })
      expect(skillEntries.entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'SKILL.md', kind: 'file', relativePath: join('data-owned-skill', 'SKILL.md') })
      ]))
      await expect(service.listDataOwnershipEntries({ rootId: 'skills', relativePath: '../outside' })).rejects.toThrow('E_DATA_OWNERSHIP_PATH_OUT_OF_SCOPE')

      const bundle = await service.exportDataOwnershipArchive({ confirmedBy: 'vitest' })
      if (!bundle.zipPath) throw new Error('zipPath missing from data ownership export')
      const zipContent = await readFile(bundle.zipPath)
      expect((await stat(bundle.path)).isDirectory()).toBe(true)
      expect(zipContent.subarray(0, 4).toString('hex')).toBe('504b0304')
      expect(bundle.categories?.map(entry => entry.category).sort()).toEqual(['audit-log', 'csv-tasks', 'settings', 'skills'])
    } finally {
      service.dispose()
      await removePathWithRetry(userData)
    }
  })

  it('restores selected backup categories only after sha256 verification and pre-restore snapshot', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-restore-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    await writeFile(join(userData, 'devhub-config.json'), '{"before":"restore"}\n', 'utf8')
    const updateSettings = vi.fn()
    const restoreStore = {
      ...appStore,
      getSettings: vi.fn(() => ({
        appearance: { theme: 'system' },
        scan: {},
        process: {},
        notification: {},
        window: {},
        advanced: {},
        firstLaunchDone: true
      })),
      getProjects: vi.fn(() => []),
      updateSettings
    }
    const service = createRuntimeServiceWithStore(restoreStore as never, () => null, runtime as never)

    try {
      const bundle = await service.createBackup({ categories: ['settings', 'csv-tasks'] })
      if (!bundle.backupId) throw new Error('backupId missing from classified backup')
      const result = await service.restoreBackup({
        backupId: bundle.backupId,
        categoriesToRestore: ['settings'],
        conflictPolicy: 'overwrite',
        preRestoreSnapshot: true,
        confirmedBy: 'vitest'
      })
      if (!('preRestoreSnapshotId' in result)) throw new Error('classified restore result missing preRestoreSnapshotId')

      expect(result.success).toBe(true)
      expect(result.preRestoreSnapshotId).toEqual(expect.any(String))
      expect(result.restored.map(item => item.category)).toEqual(['settings'])
      expect(result.skipped).toContain('csv-tasks')
      expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ appearance: { theme: 'system' } }))
    } finally {
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('rejects tampered classified backup files before restore mutates state', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-tamper-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const updateSettings = vi.fn()
    const service = createRuntimeServiceWithStore({ ...appStore, updateSettings } as never, () => null, runtime as never)

    try {
      const bundle = await service.createBackup({ categories: ['settings'] })
      if (!bundle.backupId) throw new Error('backupId missing from classified backup')
      await writeFile(join(bundle.path, 'settings', 'store.json'), '{"tampered":true}\n', 'utf8')

      await expect(service.restoreBackup({
        backupId: bundle.backupId,
        categoriesToRestore: ['settings'],
        conflictPolicy: 'overwrite',
        preRestoreSnapshot: true,
        confirmedBy: 'vitest'
      })).rejects.toThrow('E_VALIDATION:sha256 mismatch for settings')
      expect(updateSettings).not.toHaveBeenCalled()
    } finally {
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('exports and deletes classified backup bundles from an explicit local destination', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-export-delete-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)

    try {
      const destPath = join(userData, 'operator-backups')
      const bundle = await service.exportClassifiedBackup({ categories: ['settings'], destPath })
      if (!bundle.backupId) throw new Error('backupId missing from classified backup')
      if (!bundle.zipPath) throw new Error('zipPath missing from classified backup')
      expect((await stat(bundle.path)).isDirectory()).toBe(true)
      expect((await stat(bundle.zipPath)).isFile()).toBe(true)
      expect(await readFile(join(bundle.path, 'manifest.json'), 'utf8')).toContain(bundle.backupId)

      const deleted = await service.deleteBackup({ backupId: bundle.backupId, confirmedBy: 'vitest' })
      expect(deleted.success).toBe(true)
      await expect(stat(bundle.path)).rejects.toThrow()
      await expect(stat(bundle.zipPath)).rejects.toThrow()
    } finally {
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('persists backup schedule metadata while keeping cron validation strict', () => {
    const service = createRuntimeService(() => null, runtime as never)

    const configured = service.configureBackupSchedule({
      enabled: true,
      cron: '0 3 * * *',
      retentionDays: 30,
      categoriesIncluded: ['settings', 'skills']
    })

    expect(configured.success).toBe(true)
    expect(service.getBackupSchedule()).toMatchObject({ enabled: true, cron: '0 3 * * *', retentionDays: 30 })
    expect(() => service.configureBackupSchedule({ enabled: true, cron: 'bad cron' })).toThrow('E_VALIDATION')
    service.configureBackupSchedule({ enabled: false, cron: '0 3 * * *', retentionDays: 30, categoriesIncluded: ['settings'] })
    service.dispose()
  })

  it('executes enabled backup schedule through a real node-cron task', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-scheduled-backup-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)

    try {
      const destPath = join(userData, 'scheduled-backups')
      service.configureBackupSchedule({ enabled: false, cron: '59 23 * * 0', retentionDays: 30, categoriesIncluded: ['settings'] })
      ;(service as unknown as { store: { set: (key: string, value: unknown) => void } }).store.set('backups', [])
      service.configureBackupSchedule({
        enabled: true,
        cron: '59 23 * * 0',
        retentionDays: 30,
        destPath,
        categoriesIncluded: ['settings']
      })
      const scheduledTask = [...cron.getTasks().values()].find(task => task.name === 'devhub-r8-backup-schedule')
      if (!scheduledTask) throw new Error('node-cron backup schedule task was not registered')

      await scheduledTask.execute()
      const scheduledBackup = service.listBackups().find(backup => backup.createdBy === 'schedule' && backup.path.startsWith(destPath))
      if (!scheduledBackup) throw new Error('scheduled backup was not persisted')
      const manifestText = await readFile(join(scheduledBackup.path, 'manifest.json'), 'utf8')

      expect(scheduledBackup.path.startsWith(destPath)).toBe(true)
      expect(scheduledBackup.categories?.map(entry => entry.category)).toEqual(['settings'])
      expect(manifestText).toContain('"createdBy": "schedule"')
    } finally {
      service.dispose()
      await removePathWithRetry(userData)
    }
  })

  it('runs the backup content grep gate against real classified artifacts', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-backup-content-gate-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const service = createRuntimeService(() => null, runtime as never)

    try {
      const bundle = await service.createBackup({ categories: ['settings', 'skills'] })
      if (!bundle.zipPath) throw new Error('zipPath missing from classified backup')
      const scriptPath = join(process.cwd(), 'scripts', 'verify-backup-content.mjs')
      const cleanResult = await execFileAsync(process.execPath, [scriptPath, bundle.zipPath], { timeout: 15_000 })

      expect(cleanResult.stdout).toContain('Backup content gate passed')

      const leakedDir = join(userData, 'leaked-backup')
      await mkdir(leakedDir, { recursive: true })
      await writeFile(join(leakedDir, 'payload.json'), '{"apiKey":"sk-leaked1234567890","token":"tok-leaked123456"}\n', 'utf8')
      await expect(execFileAsync(process.execPath, [scriptPath, leakedDir], { timeout: 15_000 })).rejects.toThrow('Backup content gate failed')
    } finally {
      service.dispose()
      await removePathWithRetry(userData)
    }
  })

  it('migrates older backup manifests through the schema migration registry before restore', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-backup-migration-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const updateSettings = vi.fn()
    const service = createRuntimeServiceWithStore({ ...appStore, updateSettings } as never, () => null, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)

    try {
      const bundle = await service.createBackup({ categories: ['settings'] })
      if (!bundle.backupId) throw new Error('backupId missing from classified backup')
      const manifestPath = join(bundle.path, 'manifest.json')
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>
      await writeFile(manifestPath, `${JSON.stringify({ ...manifest, schemaVersion: '0.9.0' }, null, 2)}\n`, 'utf8')

      const result = await service.restoreBackup({
        backupId: bundle.backupId,
        categoriesToRestore: ['settings'],
        conflictPolicy: 'overwrite',
        preRestoreSnapshot: true,
        confirmedBy: 'vitest'
      })

      expect(result.success).toBe(true)
      expect(auditSpy).toHaveBeenCalledWith('backup:schema-migration', expect.objectContaining({
        backupId: bundle.backupId,
        appliedMigrations: expect.arrayContaining([expect.objectContaining({ schemaName: 'BackupManifest', fromVersion: '0.9.0', toVersion: '1.0.0' })])
      }), 'success')
    } finally {
      service.dispose()
      auditSpy.mockRestore()
      await removePathWithRetry(userData)
    }
  })

  it('exports spec-36 diagnostic packs as local redacted artifacts with preview parity', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-diagnostic-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const previousToken = process.env.DEVHUB_DIAG_TOKEN
    const previousCustomSecret = process.env.DEVHUB_CUSTOM_DIAG_SECRET
    process.env.DEVHUB_DIAG_TOKEN = 'sk-diagnostic1234567890'
    process.env.DEVHUB_CUSTOM_DIAG_SECRET = 'operator-secret-123'
    const service = createRuntimeService(() => null, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)

    try {
      const request = {
        sectionsIncluded: ['env-config-redacted', 'system-info', 'recovery-report'],
        includeScreenshots: false,
        redactionLevel: 'aggressive',
        customRedactionRules: [{
          ruleId: 'operator-secret',
          pattern: 'operator-secret-[0-9]+',
          replacement: '[REDACTED:operator-secret]',
          enabled: true,
          description: 'operator supplied diagnostic secret',
          category: 'custom'
        }],
        destPath: join(userData, 'operator-diagnostics')
      }
      const preview = await service.previewDiagnosticPack(request)
      const manifest = await service.exportDiagnosticPack(request)
      const combinedSectionText = (await Promise.all(manifest.sections.map(section => readFile(join(manifest.path, section.relativePath), 'utf8')))).join('\n')
      const obsForwarded = await service.exportObservabilityDiagnosticPack({ includeScreenshots: false })

      expect(preview.sections.every(section => section.sampleContent.length <= 2000)).toBe(true)
      expect(preview.redactionCounts['api-key']).toBeGreaterThan(0)
      expect((await stat(manifest.path)).isDirectory()).toBe(true)
      expect(manifest.sectionsIncluded).not.toContain('screenshots')
      expect(manifest.redactionsApplied).toBeGreaterThan(0)
      expect(combinedSectionText).not.toContain('sk-diagnostic1234567890')
      expect(combinedSectionText).toContain('[REDACTED:api-key]')
      expect(combinedSectionText).not.toContain('operator-secret-123')
      expect(combinedSectionText).toContain('[REDACTED:operator-secret]')
      expect(combinedSectionText).not.toContain(hostname())
      expect(combinedSectionText).not.toContain(userInfo().username)
      expect(auditSpy).toHaveBeenCalledWith('diagnostic:export', expect.objectContaining({
        packId: manifest.packId,
        sections: manifest.sectionsIncluded,
        redactionsApplied: manifest.redactionsApplied
      }), 'success')
      expect(obsForwarded.path).toEqual(expect.any(String))
      expect(obsForwarded.bytes).toBeGreaterThanOrEqual(0)
    } finally {
      service.dispose()
      auditSpy.mockRestore()
      if (previousToken === undefined) delete process.env.DEVHUB_DIAG_TOKEN
      else process.env.DEVHUB_DIAG_TOKEN = previousToken
      if (previousCustomSecret === undefined) delete process.env.DEVHUB_CUSTOM_DIAG_SECRET
      else process.env.DEVHUB_CUSTOM_DIAG_SECRET = previousCustomSecret
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('exports spec-36 diagnostic packs without opening outbound network clients', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-diagnostic-network-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const httpModule = nodeRequire('node:http') as typeof import('node:http')
    const httpsModule = nodeRequire('node:https') as typeof import('node:https')
    const netModule = nodeRequire('node:net') as typeof import('node:net')
    const httpRequestSpy = vi.spyOn(httpModule, 'request')
    const httpGetSpy = vi.spyOn(httpModule, 'get')
    const httpsRequestSpy = vi.spyOn(httpsModule, 'request')
    const httpsGetSpy = vi.spyOn(httpsModule, 'get')
    const netConnectSpy = vi.spyOn(netModule, 'connect')
    const netCreateConnectionSpy = vi.spyOn(netModule, 'createConnection')
    const service = createRuntimeService(() => null, runtime as never)

    try {
      await service.previewDiagnosticPack({
        sectionsIncluded: ['env-config-redacted', 'system-info', 'feature-flags'],
        includeScreenshots: false,
        redactionLevel: 'standard'
      })
      await service.exportDiagnosticPack({
        sectionsIncluded: ['env-config-redacted', 'system-info', 'feature-flags'],
        includeScreenshots: false,
        redactionLevel: 'standard',
        destPath: join(userData, 'network-guard-diagnostics')
      })

      expect(httpRequestSpy).not.toHaveBeenCalled()
      expect(httpGetSpy).not.toHaveBeenCalled()
      expect(httpsRequestSpy).not.toHaveBeenCalled()
      expect(httpsGetSpy).not.toHaveBeenCalled()
      expect(netConnectSpy).not.toHaveBeenCalled()
      expect(netCreateConnectionSpy).not.toHaveBeenCalled()
    } finally {
      service.dispose()
      httpRequestSpy.mockRestore()
      httpGetSpy.mockRestore()
      httpsRequestSpy.mockRestore()
      httpsGetSpy.mockRestore()
      netConnectSpy.mockRestore()
      netCreateConnectionSpy.mockRestore()
      await rm(userData, { recursive: true, force: true })
    }
  }, 15_000)

  it('enforces spec-37 permission TTL expiry, revoke, revoke-all, and rate limits', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T00:00:00Z'))
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-permission-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    resetRateLimits()
    const service = createRuntimeService(() => null, runtime as never)
    ;(service as unknown as { store: { set: (key: string, value: unknown) => void } }).store.set('permissionTtlRequestLog', {})
    ;(service as unknown as { store: { set: (key: string, value: unknown) => void } }).store.set('permissionTtlGrants', [])
    ;(service as unknown as { store: { set: (key: string, value: unknown) => void } }).store.set('permissionTtlPolicies', {})
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)

    try {
      const grant = service.requestPermission({ op: 'inject', scope: { instanceId: 'ai-1' }, ttlMs: 60_000, confirmedBy: 'vitest' })
      expect(service.checkPermission({ op: 'inject', scope: { instanceId: 'ai-1' } })).toMatchObject({ granted: true, grantId: grant.grantId, reason: 'active' })
      const firstStreamPayload = service.permissionExpiryStreamPayload()
      expect(firstStreamPayload.grants).toEqual([expect.objectContaining({ grantId: grant.grantId, op: 'inject' })])
      vi.setSystemTime(new Date('2026-05-05T00:00:00.500Z'))
      const cachedStreamPayload = service.permissionExpiryStreamPayload()
      expect(cachedStreamPayload).toBe(firstStreamPayload)
      expect(cachedStreamPayload.emittedAt).toBe(firstStreamPayload.emittedAt)
      const fileWriteGrant = service.requestPermission({ op: 'file-write', scope: { pathGlob: 'logs/*.txt' }, ttlMs: 60_000, confirmedBy: 'vitest' })
      const requestInvalidatedPayload = service.permissionExpiryStreamPayload()
      expect(requestInvalidatedPayload).not.toBe(firstStreamPayload)
      expect(requestInvalidatedPayload.emittedAt).toBe(Date.parse('2026-05-05T00:00:00.500Z'))
      expect(requestInvalidatedPayload.grants).toEqual([
        expect.objectContaining({ grantId: grant.grantId, op: 'inject' }),
        expect.objectContaining({ grantId: fileWriteGrant.grantId, op: 'file-write' })
      ])
      vi.setSystemTime(new Date('2026-05-05T00:00:01.501Z'))
      const refreshedStreamPayload = service.permissionExpiryStreamPayload()
      expect(refreshedStreamPayload).not.toBe(requestInvalidatedPayload)
      expect(refreshedStreamPayload.emittedAt).toBe(Date.parse('2026-05-05T00:00:01.501Z'))

      vi.setSystemTime(new Date('2026-05-05T00:01:01Z'))
      expect(service.checkPermission({ op: 'inject', scope: { instanceId: 'ai-1' } })).toMatchObject({ granted: false, reason: 'expired' })

      vi.setSystemTime(new Date('2026-05-05T00:02:00Z'))
      const smtpGrant = service.requestPermission({ op: 'smtp', scope: { targetUrl: 'smtp://localhost' }, ttlMs: 120_000, confirmedBy: 'vitest' })
      const smtpStreamPayload = service.permissionExpiryStreamPayload()
      expect(smtpStreamPayload.grants).toEqual([expect.objectContaining({ grantId: smtpGrant.grantId, op: 'smtp' })])
      expect(service.revokePermissionGrant({ grantId: smtpGrant.grantId, confirmedBy: 'vitest' }).revokedCount).toBe(1)
      const afterSmtpRevokePayload = service.permissionExpiryStreamPayload()
      expect(afterSmtpRevokePayload).not.toBe(smtpStreamPayload)
      expect(afterSmtpRevokePayload.grants.some(item => item.grantId === smtpGrant.grantId)).toBe(false)
      expect(service.checkPermission({ op: 'smtp', scope: { targetUrl: 'smtp://localhost' } })).toMatchObject({ granted: false, reason: 'revoked' })

      const webhookGrant = service.requestPermission({ op: 'webhook', scope: { targetUrl: 'https://example.invalid/hook' }, ttlMs: 120_000, confirmedBy: 'vitest' })
      expect(service.listActivePermissionGrants().some(item => item.grantId === webhookGrant.grantId)).toBe(true)
      const webhookStreamPayload = service.permissionExpiryStreamPayload()
      expect(webhookStreamPayload.grants).toEqual([expect.objectContaining({ grantId: webhookGrant.grantId, op: 'webhook' })])
      expect(service.revokeAllPermissionGrants({ confirmedBy: 'vitest' }).revokedCount).toBe(1)
      const afterRevokeAllPayload = service.permissionExpiryStreamPayload()
      expect(afterRevokeAllPayload).not.toBe(webhookStreamPayload)
      expect(afterRevokeAllPayload.grants).toEqual([])
      expect(service.listActivePermissionGrants()).toEqual([])

      service.configurePermissionPolicy({ op: 'store-api-key', defaultTtlMs: 60_000, maxTtlMs: 60_000, rateLimitPerHour: 1, confirmedBy: 'vitest' })
      service.requestPermission({ op: 'store-api-key', scope: {}, confirmedBy: 'vitest' })
      expect(() => service.requestPermission({ op: 'store-api-key', scope: {}, confirmedBy: 'vitest' })).toThrow('E_RATE_LIMITED')
      expect(auditSpy).toHaveBeenCalledWith('permission:request', expect.any(Object), 'success')
      expect(auditSpy).toHaveBeenCalledWith('permission:check-active', expect.any(Object), 'success')
      expect(auditSpy).toHaveBeenCalledWith('permission:expiry-stream', expect.any(Object), 'success')
      expect(auditSpy).toHaveBeenCalledWith('permission:check-denied', expect.any(Object), 'refused', 'expired')
      expect(auditSpy).toHaveBeenCalledWith('permission:revoke', expect.any(Object), 'success')
      expect(auditSpy).toHaveBeenCalledWith('permission:revoke-all', expect.any(Object), 'success')
      expect(auditSpy).toHaveBeenCalledWith('permission:configure-policy', expect.any(Object), 'success')
    } finally {
      service.dispose()
      auditSpy.mockRestore()
      vi.useRealTimers()
      resetRateLimits()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('returns stable disabled contracts for deferred cloud sync and OCR facades', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)

    try {
      expect(service.cloudSyncStatus()).toMatchObject({ enabled: false, errorCode: 'E_FEATURE_DEFERRED', scheduledRelease: 'R9' })
      expect(service.triggerCloudSync({ direction: 'push', conflictPolicy: 'local-wins' })).toMatchObject({ success: false, errorCode: 'E_FEATURE_DEFERRED', scheduledRelease: 'R9', enabled: false })
      expect(service.listRemoteCloudSkills()).toMatchObject({ skills: [], scheduledRelease: 'R9', enabled: false })
      expect(service.cloudSyncDisabled().code).toBe('E_SKILL_CLOUD_SYNC_DEFERRED')
      expect(service.ocrCapabilities()).toEqual({ enabled: false, reason: 'NO-OCR-INTEGRATION constraint', futureRelease: null })
      expect(service.recognizeOcr({ imageBase64: 'real-base64', languages: ['eng'] })).toMatchObject({ success: false, code: 'E_OCR_DISABLED', errorCode: 'E_OCR_DISABLED', blocks: [] })
      expect(service.listOcrSupportedLanguages()).toEqual({ languages: [], notice: 'OCR disabled', enabled: false })
      expect(auditSpy).toHaveBeenCalledWith('skill:cloud-sync-status', expect.any(Object), 'refused', 'E_FEATURE_DEFERRED')
      expect(auditSpy).toHaveBeenCalledWith('skill:cloud-sync-trigger', expect.any(Object), 'refused', 'E_FEATURE_DEFERRED')
      expect(auditSpy).toHaveBeenCalledWith('skill:cloud-sync-list-remote', expect.any(Object), 'refused', 'E_FEATURE_DEFERRED')
      expect(auditSpy).toHaveBeenCalledWith('skill:cloud-sync-disabled', expect.any(Object), 'refused', 'E_FEATURE_DEFERRED')
      expect(auditSpy).toHaveBeenCalledWith('ocr:capabilities', expect.any(Object), 'refused', 'E_OCR_DISABLED')
      expect(auditSpy).toHaveBeenCalledWith('ocr:recognize', expect.any(Object), 'refused', 'E_OCR_DISABLED')
      expect(auditSpy).toHaveBeenCalledWith('ocr:list-supported-languages', expect.any(Object), 'refused', 'E_OCR_DISABLED')
    } finally {
      auditSpy.mockRestore()
    }
  })

  it('builds, saves, lists, and exports spec-24 topology through the runtime bridge', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-graph-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const graphAppStore = {
      ...appStore,
      getProjects: vi.fn(() => [{
        id: 'project-1',
        name: 'DevHub',
        path: 'D:/repo/devhub',
        scripts: ['dev'],
        defaultScript: 'dev',
        projectType: 'pnpm',
        tags: ['r8'],
        status: 'running',
        createdAt: 1,
        updatedAt: 2
      }])
    }
    const graphRuntime = {
      scannerCache: {
        getSnapshot: () => ({
          processes: { data: [{ pid: 1234, name: 'node.exe', command: 'pnpm dev', cpu: 4, memory: 128, status: 'running', projectId: 'project-1', startTime: 1, type: 'dev-server', workingDir: 'D:/repo/devhub' }] },
          ports: { data: [{ port: 5173, pid: 1234, processName: 'node.exe', state: 'LISTENING', protocol: 'TCP', localAddress: '127.0.0.1', foreignAddress: '0.0.0.0', projectId: 'project-1' }] },
          windows: { data: [] },
          aiTasks: { data: [{ id: 'task-1', toolType: 'codex', pid: 1234, startTime: 1, status: { state: 'running', lastActivity: 1 }, projectId: 'project-1', metrics: { cpuHistory: [], outputLineCount: 1, lastOutputTime: 1, idleDuration: 0 } }] }
        })
      }
    }

    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    let service: R8RuntimeService | null = null
    try {
      service = createRuntimeServiceWithStore(graphAppStore as never, () => null, graphRuntime as never)
      const fullscreen = await service.topologyFullscreen()
      const historical = await service.getNetworkTopology({ scope: 'process', targetIds: [1234], asOfTs: 1_800_000 })
      const network = await service.getNetworkTopology({ scope: 'process', targetIds: [1234] })
      const neural = await service.getNeuralTopology({ scope: 'process', targetIds: [1234] })

      expect(fullscreen.slice.scope).toBe('global')
      expect(historical.warnings.some(warning => warning.code === 'E_GRAPH_HISTORICAL_CURSOR')).toBe(true)
      expect(network.slice.graphKind).toBe('network-topology')
      expect(neural.slice.graphKind).toBe('neural-relationship')
      expect(network.nodes.some(node => node.id === 'process-1234')).toBe(true)

      const attachedLazy = await service.topologyAttachedDeep10({ scope: 'process', targetId: 1234, graphKind: 'network-topology', depth: 10 })
      expect(attachedLazy.lazy).toBe(true)
      expect(attachedLazy.truncatedAtDepth).toBe(7)
      expect(attachedLazy.snapshot.slice.scope).toBe('process')
      expect(attachedLazy.snapshot.slice.depth).toBe(10)
      expect(attachedLazy.snapshot.warnings.some(warning => warning.code === 'E_ATTACHED_LAZY_REQUIRED')).toBe(true)
      expect(auditSpy).toHaveBeenCalledWith('topology:attached-depth', expect.objectContaining({
        scope: 'process',
        targetId: 1234,
        graphKind: 'network-topology',
        requestedDepth: 10,
        buildDepth: 7,
        lazy: true,
        truncatedAtDepth: 7,
        thumbnailMode: false,
        selectedNodeId: null,
        expandedNodeCount: 0
      }), 'success')

      const attachedExpanded = await service.topologyAttachedDeep10({ scope: 'process', targetId: 1234, graphKind: 'network-topology', depth: 10, expandedNodeIds: ['process-1234'] })
      expect(attachedExpanded.lazy).toBe(false)
      expect(attachedExpanded.truncatedAtDepth).toBeNull()
      expect(auditSpy).toHaveBeenCalledWith('topology:attached-lazy-expand', expect.objectContaining({
        scope: 'process',
        targetId: 1234,
        graphKind: 'network-topology',
        requestedDepth: 10,
        buildDepth: 10,
        lazy: false,
        expandedNodeIds: ['process-1234'],
        expandedNodeCount: 1
      }), 'success')

      const attachedThumbnail = await service.topologyAttachedDeep10({ scope: 'process', targetId: 1234, graphKind: 'network-topology', depth: 3, thumbnailMode: true, selectedNodeId: 'process-1234' })
      expect(attachedThumbnail.thumbnailRecommended).toBe(true)
      expect(auditSpy).toHaveBeenCalledWith('topology:attached-mini-thumbnail', expect.objectContaining({
        scope: 'process',
        targetId: 1234,
        graphKind: 'network-topology',
        requestedDepth: 3,
        thumbnailMode: true,
        selectedNodeId: 'process-1234'
      }), 'success')

      const favoriteAudit = service.auditAttachedTopologyFavoriteChange({
        action: 'pin',
        favorite: { label: 'process:1234', scope: 'process', targetId: 1234, graphKind: 'network-topology', pinnedAt: 1713830400000 },
        previousFavoriteCount: 0,
        nextFavoriteCount: 1,
        selectedNodeId: 'process-1234'
      })
      expect(favoriteAudit.success).toBe(true)
      expect(favoriteAudit.action).toBe('pin')
      expect(auditSpy).toHaveBeenCalledWith('topology:attached-favorite-change', expect.objectContaining({
        action: 'pin',
        scope: 'process',
        targetId: 1234,
        graphKind: 'network-topology',
        label: 'process:1234',
        previousFavoriteCount: 0,
        nextFavoriteCount: 1,
        selectedNodeId: 'process-1234'
      }), 'success')

      await service.saveTopologySnapshot({ snapshotId: network.snapshotId, label: 'runtime-topology', confirmedBy: 'vitest' })
      expect((await service.listTopologySnapshots())[0]?.label).toBe('runtime-topology')
      const autoSnapshot = await service.runTopologySnapshotterOnce('vitest')
      expect(autoSnapshot.status).toBe('saved')
      expect(autoSnapshot.saved.map(row => row.graphKind).sort()).toEqual(['flow', 'network-topology', 'neural-relationship'])
      const snapshotLabels = (await service.listTopologySnapshots()).map(row => row.label)
      expect(snapshotLabels.some(label => label.startsWith('auto-topology:network-topology:'))).toBe(true)
      expect((await service.exportTopology({ snapshotId: network.snapshotId, format: 'mermaid' })).content).toMatch(/^graph TD/)
      expect(auditSpy).toHaveBeenCalledWith('topology:time-cursor', expect.objectContaining({ graphKind: 'network-topology', scope: 'process', asOfTs: 1_800_000 }), 'success')
      expect(auditSpy).toHaveBeenCalledWith('topology:snapshot-save', expect.objectContaining({ snapshotId: network.snapshotId, label: 'runtime-topology' }), 'success')
      expect(auditSpy).toHaveBeenCalledWith('topology:auto-snapshot', expect.objectContaining({ status: 'saved', reason: 'vitest', saved: 3, pruned: 0 }), 'success', undefined)
      expect(auditSpy).toHaveBeenCalledWith('topology:export', expect.objectContaining({ snapshotId: network.snapshotId, format: 'mermaid', mimeType: 'text/plain' }), 'success')
      await expect(service.exportTopology({ snapshotId: network.snapshotId, format: 'png' })).rejects.toThrow('E_RUNTIME:png export requires renderer canvas')
    } finally {
      auditSpy.mockRestore()
      service?.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('refuses spec-25 attached lazy expansion when cumulative nodes exceed 500', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-attached-limit-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const graphRuntime = {
      scannerCache: {
        getSnapshot: () => ({
          processes: {
            data: [{
              pid: 1,
              name: 'proc-1.exe',
              command: 'node worker.js',
              cpu: 1,
              memory: 64,
              status: 'running',
              startTime: 1,
              type: 'worker',
              workingDir: 'D:/repo/devhub'
            }]
          },
          ports: {
            data: Array.from({ length: 501 }, (_, index) => ({
              port: 30_000 + index,
              pid: 1,
              processName: 'proc-1.exe',
              state: 'LISTENING',
              protocol: 'TCP',
              localAddress: '127.0.0.1',
              foreignAddress: '0.0.0.0'
            }))
          },
          windows: { data: [] },
          aiTasks: { data: [] }
        })
      }
    }
    const auditSpy = vi.spyOn(auditLogger, 'log').mockImplementation(() => undefined)
    let service: R8RuntimeService | null = null

    try {
      service = createRuntimeService(() => null, graphRuntime as never)
      await expect(service.topologyAttachedDeep10({
        scope: 'process',
        targetId: 1,
        graphKind: 'network-topology',
        depth: 10,
        expandedNodeIds: ['process-1']
      })).rejects.toThrow('E_GRAPH_NODE_LIMIT')
      expect(auditSpy).toHaveBeenCalledWith('topology:attached-lazy-expand', expect.objectContaining({
        scope: 'process',
        targetId: 1,
        graphKind: 'network-topology',
        requestedDepth: 10,
        buildDepth: 10,
        nodeCount: 502,
        expandedNodeIds: ['process-1'],
        limit: 500
      }), 'refused', 'E_GRAPH_NODE_LIMIT')
    } finally {
      auditSpy.mockRestore()
      service?.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('keeps spec-25 attached topology depth 3 p95 under 800ms for graphs up to 100 nodes', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8c-attached-perf-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    const processes = Array.from({ length: 48 }, (_, index) => ({
      pid: 10_000 + index,
      name: `worker-${index}.exe`,
      command: `node worker-${index}.js`,
      cpu: index % 9,
      memory: 64 + index,
      status: 'running',
      projectId: 'project-perf',
      startTime: 1 + index,
      type: 'worker',
      workingDir: 'D:/repo/devhub'
    }))
    const ports = Array.from({ length: 48 }, (_, index) => ({
      port: 31_000 + index,
      pid: 10_000 + index,
      processName: `worker-${index}.exe`,
      state: 'LISTENING',
      protocol: 'TCP',
      localAddress: '127.0.0.1',
      foreignAddress: '0.0.0.0',
      projectId: 'project-perf'
    }))
    const graphRuntime = {
      scannerCache: {
        getSnapshot: () => ({
          processes: { data: processes },
          ports: { data: ports },
          windows: { data: [] },
          aiTasks: { data: [] }
        })
      }
    }
    let service: R8RuntimeService | null = null

    try {
      service = createRuntimeService(() => null, graphRuntime as never)
      await service.topologyAttachedDeep10({ scope: 'process', graphKind: 'network-topology', depth: 3 })
      const samples: number[] = []
      const buildSamples: number[] = []
      const nodeCounts: number[] = []
      for (let index = 0; index < 10; index += 1) {
        const startedAt = performance.now()
        const result = await service.topologyAttachedDeep10({ scope: 'process', graphKind: 'network-topology', depth: 3 })
        samples.push(performance.now() - startedAt)
        buildSamples.push(result.buildMs ?? Number.POSITIVE_INFINITY)
        nodeCounts.push(result.snapshot.nodes.length)
      }
      const sortedSamples = [...samples].sort((left, right) => left - right)
      const sortedBuildSamples = [...buildSamples].sort((left, right) => left - right)
      const p95Index = Math.min(sortedSamples.length - 1, Math.ceil(sortedSamples.length * 0.95) - 1)
      const p95 = sortedSamples[p95Index] ?? Number.POSITIVE_INFINITY
      const buildP95 = sortedBuildSamples[p95Index] ?? Number.POSITIVE_INFINITY
      const maxNodeCount = Math.max(...nodeCounts)

      expect(maxNodeCount).toBeGreaterThan(10)
      expect(maxNodeCount).toBeLessThanOrEqual(100)
      expect(buildP95).toBeLessThan(800)
      expect(p95).toBeLessThan(800)
    } finally {
      service?.dispose()
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('opens fullscreen topology from the R8 command palette without using monitor tabs', async () => {
    const send = vi.fn()
    const mainWindow = { isDestroyed: () => false, webContents: { send } }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    expect(service.listCommands().some(command => command.id === 'topology.global' && command.shortcut === 'Ctrl+T')).toBe(true)
    expect(service.listCommands().some(command => command.id === 'topology.flow' && command.title === '打开全局流程图')).toBe(true)
    await service.invokeCommand({ commandId: 'topology.global' })

    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'topology-navigate' })

    send.mockClear()
    await service.invokeCommand({ commandId: 'topology.flow' })

    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'topology-navigate', graphKind: 'flow' })
    expect(send).not.toHaveBeenCalledWith('r8:command-event', expect.objectContaining({ type: 'monitor-navigate' }))
  })

  it('persists R8.B drawer state, layouts, and popout morphs through electron-store', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-drawer-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    try {
      const service = createRuntimeService(() => null, runtime as never)
      const initial = service.getDrawerState()
      expect(initial.map(drawer => drawer.slot)).toEqual(['top', 'right', 'bottom', 'floating', 'statusbar'])

      const right = service.setDrawerState({ slot: 'right', open: true, contentId: 'monitor.port-detail', size: 1600 })
      expect(right.open).toBe(true)
      expect(right.width).toBe(800)

      const saved = service.saveDrawerLayout({ name: 'debug-mode' })
      expect(saved.states).toHaveLength(5)
      expect(service.listDrawerLayouts().map(layout => layout.name)).toContain('debug-mode')

      service.setDrawerState({ slot: 'right', open: false, contentId: 'monitor.port-detail', size: 360 })
      const loaded = service.loadDrawerLayout({ name: 'debug-mode' })
      expect(loaded.states.find(drawer => drawer.slot === 'right')?.open).toBe(true)

      const morph = await service.morphDrawerToPopout({ slot: 'right', contentId: 'monitor.port-detail' })
      expect(morph.popoutId).toMatch(/^popout-/)
      const restored = service.morphPopoutToDrawer({ popoutId: morph.popoutId, slot: 'bottom' })
      expect(restored.drawerState.slot).toBe('bottom')
      expect(restored.drawerState.open).toBe(true)
    } finally {
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('runs the drawer layout migration once without closing later same-version restarts', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'devhub-r8-drawer-migration-'))
    vi.mocked(app.getPath).mockImplementation(() => userData)
    try {
      const firstService = createRuntimeService(() => null, runtime as never)
      const migrated = firstService.getDrawerState()
      expect(migrated.every(drawer => drawer.open === false)).toBe(true)

      const opened = firstService.setDrawerState({ slot: 'right', open: true, contentId: 'monitor.port-detail', size: 360 })
      expect(opened.open).toBe(true)

      const relaunchedService = createRuntimeService(() => null, runtime as never)
      const restoredRight = relaunchedService.getDrawerState().find(drawer => drawer.slot === 'right')
      expect(restoredRight).toMatchObject({
        contentId: 'monitor.port-detail',
        open: true,
        slot: 'right'
      })
    } finally {
      await rm(userData, { recursive: true, force: true })
    }
  })

  it('opens drawer slots from the R8 command palette', async () => {
    const send = vi.fn()
    const mainWindow = { isDestroyed: () => false, webContents: { send } }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    expect(service.listCommands().some(command => command.id === 'drawer.notifications')).toBe(true)
    await service.invokeCommand({ commandId: 'drawer.notifications' })

    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'drawer-open', slot: 'top', contentId: 'notifications.top' })
  })

  it('exposes executable default commands for the command palette five-scope assertion', async () => {
    const send = vi.fn()
    const mainWindow = { isDestroyed: () => false, webContents: { send } }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)
    const commands = service.listCommands()

    expect(commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'monitor.process', category: 'navigation' }),
      expect.objectContaining({ id: 'monitor.ai-task', category: 'monitor' }),
      expect.objectContaining({ id: 'ai.tasks.open', category: 'ai-action' }),
      expect.objectContaining({ id: 'theme.apply.constructivism', category: 'settings' }),
      expect.objectContaining({ id: 'settings.open', category: 'settings' })
    ]))

    await service.invokeCommand({ commandId: 'ai.tasks.open' })
    await service.invokeCommand({ commandId: 'settings.open' })
    await service.invokeCommand({ commandId: 'theme.apply.constructivism' })

    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'monitor-navigate', tab: 'ai-task' })
    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'settings-open' })
    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'theme-apply', theme: 'constructivism' })
    expect(service.listCommandHistory().map(item => item.commandId)).toEqual(expect.arrayContaining(['ai.tasks.open', 'settings.open', 'theme.apply.constructivism']))
  })

  it('extends the default command registry with executable scanner object commands above 100 entries', async () => {
    const send = vi.fn()
    const mainWindow = { isDestroyed: () => false, webContents: { send } }
    const snapshotRuntime = {
      scannerCache: {
        getSnapshot: () => ({
          processes: {
            data: Array.from({ length: 85 }, (_, index) => ({
              pid: 4000 + index,
              name: `node-${index}.exe`,
              workingDir: `D:/repo/devhub/${index}`
            }))
          },
          ports: {
            data: Array.from({ length: 25 }, (_, index) => ({
              port: 3100 + index,
              pid: 4000 + index,
              protocol: 'tcp',
              address: '127.0.0.1'
            }))
          },
          windows: {
            data: Array.from({ length: 10 }, (_, index) => ({
              hwnd: 9000 + index,
              title: `DevHub window ${index}`,
              processName: `node-${index}.exe`
            }))
          }
        })
      }
    }
    const service = createRuntimeService(() => mainWindow as never, snapshotRuntime as never)
    const commands = service.listCommands()
    const processCommand = commands.find(command => command.id === 'process.open.4001')
    const processTopologyCommand = commands.find(command => command.id === 'topology.process.4001')
    const portTopologyCommand = commands.find(command => command.id === 'topology.port.3101.4001')
    const windowTopologyCommand = commands.find(command => command.id === 'topology.window.9001')

    expect(commands.length).toBeGreaterThanOrEqual(100)
    expect(commands.filter(command => command.handler === 'uri:open').length).toBeGreaterThanOrEqual(100)
    expect(commands.filter(command => command.handler === 'topology:open').length).toBeGreaterThanOrEqual(100)
    expect(commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'port.open.3101.4001', category: 'port', handler: 'uri:open', uri: 'devhub://port/3101' }),
      expect.objectContaining({ id: 'window.open.9001', category: 'window', handler: 'uri:open', uri: 'devhub://window/9001' }),
      expect.objectContaining({ id: 'topology.process.4001', category: 'process', handler: 'topology:open', uri: 'devhub://process/4001?node=process-4001' }),
      expect.objectContaining({ id: 'topology.port.3101.4001', category: 'port', handler: 'topology:open', uri: 'devhub://port/3101?node=port-3101-4001-tcp' }),
      expect.objectContaining({ id: 'topology.window.9001', category: 'window', handler: 'topology:open', uri: 'devhub://window/9001?node=window-9001' })
    ]))
    expect(processCommand).toEqual(expect.objectContaining({
      category: 'process',
      handler: 'uri:open',
      uri: 'devhub://process/4001'
    }))
    if (!processCommand) throw new Error('process.open.4001 command missing from scanner-backed registry')
    if (!processTopologyCommand || !portTopologyCommand || !windowTopologyCommand) throw new Error('scanner-backed topology commands missing from registry')

    await service.invokeCommand({ commandId: processCommand.id })

    expect(send).toHaveBeenCalledWith('r8:command-event', {
      type: 'protocol-open',
      uri: 'devhub://process/4001',
      panel: 'process',
      monitor: 'monitor'
    })
    expect(service.listCommandHistory().map(item => item.commandId)).toContain('process.open.4001')

    send.mockClear()
    await service.invokeCommand({ commandId: processTopologyCommand.id })
    await service.invokeCommand({ commandId: portTopologyCommand.id })
    await service.invokeCommand({ commandId: windowTopologyCommand.id })

    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'topology-navigate', selectedNodeId: 'process-4001' })
    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'topology-navigate', selectedNodeId: 'port-3101-4001-tcp' })
    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'topology-navigate', selectedNodeId: 'window-9001' })
    expect(service.listCommandHistory().map(item => item.commandId)).toEqual(expect.arrayContaining([
      'topology.process.4001',
      'topology.port.3101.4001',
      'topology.window.9001'
    ]))
  })

  it('creates a BrowserWindow port popout from the R8 command palette command', async () => {
    const service = createRuntimeService(() => null, runtime as never)

    expect(service.listCommands().some(command => command.id === 'popout.port' && command.handler === 'popout:create')).toBe(true)
    const result = await service.invokeCommand({ commandId: 'popout.port', args: { port: 3000 } })
    const popout = service.listPopouts().find(item => (
      item.surface === 'port'
      && item.targetId === 3000
      && item.route === '/monitor'
      && item.title === 'DevHub port 3000'
    ))

    expect(result).toEqual({ success: true, commandId: 'popout.port' })
    expect(popout).toMatchObject({
      surface: 'port',
      targetId: 3000,
      mode: 'browserwindow',
      route: '/monitor',
      title: 'DevHub port 3000'
    })
    expect(service.listCommandHistory()).toEqual(expect.arrayContaining([
      expect.objectContaining({ commandId: 'popout.port' })
    ]))
  })

  it('opens batch tag dialog from the R8 command palette through monitor events', async () => {
    const send = vi.fn()
    const mainWindow = { isDestroyed: () => false, webContents: { send } }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    expect(service.listCommands()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'process.batch.tag',
        category: 'process',
        handler: 'process:batch-tag-open'
      })
    ]))

    await service.invokeCommand({ commandId: 'process.batch.tag' })

    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'monitor-navigate', tab: 'process' })
    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'process-batch-tag-open' })
    expect(service.listCommandHistory().map(item => item.commandId)).toContain('process.batch.tag')
  })

  it('opens filtered window batch focus from the R8 command palette through monitor events', async () => {
    const send = vi.fn()
    const mainWindow = { isDestroyed: () => false, webContents: { send } }
    const service = createRuntimeService(() => mainWindow as never, runtime as never)

    expect(service.listCommands()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'window.batch.focus-filtered',
        category: 'window',
        handler: 'window:batch-focus-filtered'
      })
    ]))

    await service.invokeCommand({ commandId: 'window.batch.focus-filtered' })

    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'monitor-navigate', tab: 'window' })
    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'window-batch-focus-filtered' })
    expect(service.listCommandHistory().map(item => item.commandId)).toContain('window.batch.focus-filtered')
  })

  it('resolves devhub URI targets against the live scanner snapshot without fake navigation', () => {
    const uriRuntime = {
      scannerCache: {
        getSnapshot: () => ({
          processes: { data: [{ pid: 9999, name: 'node.exe', workingDir: 'D:/repo/devhub' }] },
          ports: { data: [{ port: 3000, pid: 9999, processName: 'node.exe' }] },
          windows: { data: [{ hwnd: 123, title: 'DevHub' }] }
        })
      }
    }
    const service = createRuntimeService(() => null, uriRuntime as never)

    expect(service.resolveCommandUri({ uri: 'devhub://port/3000' })).toMatchObject({
      kind: 'port',
      id: '3000',
      exists: true,
      fallbackUsed: false,
      monitor: 'monitor',
      panel: 'port'
    })
    expect(service.resolveCommandUri({ uri: 'devhub://process/8812?fallback=exe:node.exe,cwd:D:/repo/devhub' })).toMatchObject({
      kind: 'process',
      id: '8812',
      exists: false,
      fallbackUsed: true,
      candidateCount: 1
    })
    expect(() => service.resolveCommandUri({ uri: 'http://example.com/port/3000' })).toThrow('Invalid')
  })

  it('persists dashboard presets and morphs a widget into the real drawer state store', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const presetName = `vitest-dashboard-${randomUUID()}`
    service.resetDashboardLayout({ preset: 'default', confirmedBy: 'vitest' })
    const base = service.getDashboardLayout().layout
    const layout = {
      ...base,
      name: presetName,
      layouts: {
        ...base.layouts,
        md: base.layouts.md.map((item, index) => index === 0 ? { ...item, x: 2, y: 2 } : item)
      }
    }

    const saved = service.saveDashboardLayout(layout)
    const loaded = service.getDashboardLayout({ name: presetName })
    const presets = service.listDashboardPresets()
    const morph = service.morphDashboardWidgetToDrawer({ widgetInstanceId: 'widget-process-summary', slot: 'right' })

    expect(base.layouts.md.length).toBeGreaterThanOrEqual(6)
    expect(saved.success).toBe(true)
    expect(loaded.layout.layouts.md[0]).toMatchObject({ x: 2, y: 2, widgetId: 'process-summary' })
    expect(presets.names).toContain(presetName)
    expect(morph.drawerState).toMatchObject({ slot: 'right', open: true, contentId: 'monitor.process' })
    expect(morph.layout.layouts.md.some(item => item.i === 'widget-process-summary')).toBe(false)
    expect(service.deleteDashboardPreset({ name: presetName, confirmedBy: 'vitest' })).toEqual({ success: true, name: presetName })
  })

  it('builds process tree and RSS-proportional treemap data from the live scanner snapshot', async () => {
    const send = vi.fn()
    const processRuntime = {
      scannerCache: {
        getSnapshot: () => ({
          processes: {
            data: [
              { pid: 10, ppid: 0, name: 'root.exe', memory: 1000, cpu: 2, type: 'other' },
              { pid: 11, ppid: 10, name: 'child.exe', memory: 500, cpu: 1, type: 'ai-tool' }
            ]
          }
        })
      }
    }
    const service = createRuntimeService(() => ({ isDestroyed: () => false, webContents: { send } }) as never, processRuntime as never)

    const tree = service.processTree({ maxDepth: 3 }).tree
    const treemap = service.processTreemapData({ groupBy: 'parent', colorBy: 'rss', width: 1500, height: 100 })
    const firstArea = (treemap.nodes[0].x1 - treemap.nodes[0].x0) * (treemap.nodes[0].y1 - treemap.nodes[0].y0)
    const secondArea = (treemap.nodes[1].x1 - treemap.nodes[1].x0) * (treemap.nodes[1].y1 - treemap.nodes[1].y0)
    const mode = await service.invokeCommand({ commandId: 'process.view.treemap' })

    expect(tree.children[0]).toMatchObject({ pid: 10, exe: 'root.exe' })
    expect(tree.children[0].children[0]).toMatchObject({ pid: 11, isAiTool: true })
    expect(Math.abs((firstArea / secondArea) - 2)).toBeLessThanOrEqual(0.1)
    expect(mode).toEqual({ success: true, commandId: 'process.view.treemap' })
    expect(send).toHaveBeenCalledWith('r8:command-event', { type: 'process-view-mode', mode: 'treemap' })
  })

  it('builds status aggregate from scanner cache summary', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const aggregate = service.statusAggregate()

    expect(aggregate.tiles).toHaveLength(12)
    expect(aggregate.badges).toHaveLength(6)
    expect(aggregate.tiles.find(tile => tile.id === 'listening-ports')?.value).toBe(1)
    expect(aggregate.tiles.find(tile => tile.id === 'cpu')?.badgeType).toBe('number')
    expect(aggregate.tiles.find(tile => tile.id === 'cmdk')?.clickAction?.type).toBe('open-cmdk')
  })

  it('persists statusbar hidden tile and order config through the runtime store', () => {
    const service = createRuntimeService(() => null, runtime as never)
    const initial = service.getStatusbarConfig()
    const configured = service.setStatusbarConfig({
      updatedAt: initial.updatedAt,
      tiles: initial.tiles.map(tile => {
        if (tile.id === 'cpu') return { ...tile, visible: false, order: 10 }
        if (tile.id === 'cmdk') return { ...tile, visible: true, order: 0 }
        return tile
      })
    })
    const aggregate = service.statusAggregate()

    expect(configured.tiles.find(tile => tile.id === 'cpu')).toMatchObject({ visible: false, order: 10 })
    expect(service.getStatusbarConfig().tiles.find(tile => tile.id === 'cmdk')).toMatchObject({ visible: true, order: 0 })
    expect(aggregate.tiles.find(tile => tile.id === 'cpu')).toMatchObject({ value: 5, visible: false, order: 10 })
    expect(aggregate.tiles[0].id).toBe('cmdk')

    const reset = service.resetStatusbarConfig({ confirmedBy: 'vitest' })

    expect(reset.tiles.find(tile => tile.id === 'cpu')).toMatchObject({ visible: true, order: 0 })
    expect(service.statusAggregate().tiles[0].id).toBe('cpu')
  })

  it('pushes status aggregate snapshots through the main-window IPC bridge', async () => {
    const send = vi.fn()
    const service = createRuntimeService(() => ({
      isDestroyed: () => false,
      webContents: { send }
    }) as never, runtime as never)

    const result = await service.publishStatusAggregateNow()
    service.stopStatusAggregator()

    expect(result.success).toBe(true)
    expect(send).toHaveBeenCalledWith('status:aggregate', expect.objectContaining({
      refreshIntervalMs: 1000,
      tiles: expect.arrayContaining([expect.objectContaining({ id: 'cpu', value: 5 })])
    }))
  })

  it('counts only live BrowserWindow popouts in the status aggregate', async () => {
    const service = createRuntimeService(() => null, runtime as never)
    ;(service as unknown as { store: { set: (key: string, value: unknown) => void } }).store.set('popouts', [])

    const browserPopout = await service.createPopout({
      surface: 'port',
      targetId: 3000,
      mode: 'browserwindow',
      route: '/monitor?port=3000',
      title: 'Port 3000',
    })
    await service.createPopout({
      surface: 'port',
      targetId: 3001,
      mode: 'floating',
      route: '/monitor?port=3001',
      title: 'Port 3001',
    })

    expect(service.statusAggregate().tiles.find(tile => tile.id === 'popouts')?.value).toBe(1)

    service.closePopout({ windowId: browserPopout.windowId })

    expect(service.statusAggregate().tiles.find(tile => tile.id === 'popouts')?.value).toBe(0)
  })

  it('classifies R8.B spec-13 port tiers and persists user blocklist entries', async () => {
    const service = createRuntimeService(() => null, {
      scannerCache: {
        getSnapshot: () => ({
          ports: {
            data: [
              { port: 3000, localAddress: '127.0.0.1', state: 'LISTENING', processName: 'node.exe' },
              { port: 8080, localAddress: '192.168.1.5', state: 'LISTENING', processName: 'vite.exe' },
              { port: 80, localAddress: '0.0.0.0', state: 'LISTENING', processName: 'nginx.exe' },
              { port: 4444, localAddress: '127.0.0.1', state: 'LISTENING', processName: 'unknown.exe' }
            ]
          },
          systemSummary: {}
        })
      }
    } as never)

    expect(service.classifyPort({ port: 3000, ip: '127.0.0.1' }).tier).toBe('Local')
    expect(service.classifyPort({ port: 8080, ip: '192.168.1.5' }).tier).toBe('LAN')
    expect(service.classifyPort({ port: 80, ip: '0.0.0.0' }).tier).toBe('WAN-Capable')
    expect(service.classifyPort({ port: 4444, ip: '127.0.0.1' }).tier).toBe('Suspicious')

    const added = service.addBlocklist({ port: 9090, reason: 'vitest', confirmedBy: 'vitest' })
    expect(added.source).toBe('user')
    expect(service.listBlocklist().some(entry => entry.port === 9090 && entry.source === 'user')).toBe(true)
    expect(service.classifyPort({ port: 9090, ip: '127.0.0.1' }).tier).toBe('Suspicious')

    const banner = service.publicBannerState()
    expect(banner.wanCount).toBe(1)
    expect(banner.suspiciousCount).toBe(1)
    expect(banner.ports.map(port => port.port)).toEqual(expect.arrayContaining([80, 4444]))

    await service.invokeCommand({ commandId: 'port.blocklist.add', args: { port: 8081, reason: 'cmdk' }, confirmedBy: 'vitest' })
    expect(service.listBlocklist().some(entry => entry.port === 8081 && entry.reason === 'cmdk')).toBe(true)

    expect(service.removeBlocklist({ port: 9090, confirmedBy: 'vitest' }).removed).toBe(1)
    expect(service.resetBlocklist({ confirmedBy: 'vitest' }).clearedUserEntries).toBe(1)
  })
})

async function waitForRecordingEvent(predicate: () => Promise<boolean>, timeoutMs = 1500): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('Timed out waiting for recording event')
}
