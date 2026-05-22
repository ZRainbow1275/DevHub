import { describe, expect, it } from 'vitest'
import {
  CSV_COLUMN_NAMES,
  CSV_TASK_ROW_SCHEMA_VERSION,
  buildCsvTemplateRows,
  csvPriorityToNumber,
  csvTaskRow18Schema,
  parseCsvInputArgs,
  validateCsvHeader,
  type CsvTaskRow18
} from './csv-task-row'

function validRow(overrides: Partial<Record<keyof CsvTaskRow18, string | number>> = {}): Record<string, string | number> {
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

describe('csv-task-row 18 column schema', () => {
  it('keeps the fixed 18 column order as the schema source of truth', () => {
    expect(CSV_COLUMN_NAMES).toHaveLength(18)
    expect(validateCsvHeader(CSV_COLUMN_NAMES)).toMatchObject({ valid: true, missing: [], extra: [], orderErrors: [] })
    expect(buildCsvTemplateRows('2026-05-03T08:00:00.000Z')[0]).toEqual([...CSV_COLUMN_NAMES])
  })

  it('rejects missing columns and preserves the missing column name', () => {
    const result = validateCsvHeader(CSV_COLUMN_NAMES.slice(0, 17))

    expect(result.valid).toBe(false)
    expect(result.missing).toContain('note')
    expect(result.orderErrors.at(-1)).toMatchObject({ expected: 'note', actual: null })
  })

  it('rejects reordered headers even when the names are present', () => {
    const reordered = [...CSV_COLUMN_NAMES]
    const first = reordered[0]
    reordered[0] = reordered[1]
    reordered[1] = first

    const result = validateCsvHeader(reordered)

    expect(result.valid).toBe(false)
    expect(result.missing).toEqual([])
    expect(result.orderErrors.map(error => error.expected)).toEqual(['taskId', 'taskName'])
  })

  it('coerces valid numeric fields and maps priority to runtime score', () => {
    const parsed = csvTaskRow18Schema.parse(validRow())

    expect(parsed.schemaVersion).toBe(CSV_TASK_ROW_SCHEMA_VERSION)
    expect(parsed.timeoutMs).toBe(60000)
    expect(parsed.retries).toBe(1)
    expect(csvPriorityToNumber(parsed.priority)).toBe(75)
    expect(parseCsvInputArgs(parsed.inputArgs)).toEqual({ prompt: 'review this file' })
  })

  it('rejects invalid timeout and malformed JSON args', () => {
    const timeout = csvTaskRow18Schema.safeParse(validRow({ timeoutMs: 'abc' }))
    const args = csvTaskRow18Schema.safeParse(validRow({ inputArgs: '{not-json' }))

    expect(timeout.success).toBe(false)
    expect(args.success).toBe(false)
    if (!args.success) expect(args.error.issues.map(issue => issue.message)).toContain('inputArgs must be valid JSON')
  })

  it('rejects timeouts above 24 hours', () => {
    const result = csvTaskRow18Schema.safeParse(validRow({ timeoutMs: '86400001' }))

    expect(result.success).toBe(false)
  })
})
