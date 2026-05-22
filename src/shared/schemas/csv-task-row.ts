import { z } from 'zod'

export const CSV_COLUMN_NAMES = [
  'taskId',
  'taskName',
  'priority',
  'status',
  'tool',
  'skill',
  'inputFile',
  'inputArgs',
  'outputDir',
  'outputFormat',
  'tags',
  'dependsOn',
  'timeoutMs',
  'retries',
  'concurrencyKey',
  'createdAt',
  'scheduledAt',
  'note'
] as const

export type CsvColumnName = typeof CSV_COLUMN_NAMES[number]

export const CSV_TASK_ROW_SCHEMA_VERSION = '1.0' as const

export const csvPrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3'])
export const csvTaskStatus18Schema = z.enum(['pending', 'running', 'done', 'failed', 'skipped'])
export const csvToolSchema = z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot'])
export const csvOutputFormatSchema = z.enum(['json', 'md', 'txt', 'file'])

const csvJsonStringSchema = z.string().default('{}').refine((value) => {
  try {
    JSON.parse(value || '{}')
    return true
  } catch {
    return false
  }
}, { message: 'inputArgs must be valid JSON' })

const csvScheduledAtSchema = z.union([z.literal('now'), z.string().datetime()])

export const csvTaskRow18Schema = z.object({
  schemaVersion: z.literal(CSV_TASK_ROW_SCHEMA_VERSION).default(CSV_TASK_ROW_SCHEMA_VERSION),
  taskId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_:.-]+$/),
  taskName: z.string().min(1).max(200),
  priority: csvPrioritySchema,
  status: csvTaskStatus18Schema.default('pending'),
  tool: csvToolSchema,
  skill: z.string().min(1).max(60),
  inputFile: z.string().max(500).default(''),
  inputArgs: csvJsonStringSchema,
  outputDir: z.string().max(500).default(''),
  outputFormat: csvOutputFormatSchema,
  tags: z.string().max(200).default(''),
  dependsOn: z.string().max(500).default(''),
  timeoutMs: z.coerce.number().int().min(0).max(86_400_000),
  retries: z.coerce.number().int().min(0).max(5),
  concurrencyKey: z.string().max(60).default(''),
  createdAt: z.string().datetime(),
  scheduledAt: csvScheduledAtSchema,
  note: z.string().max(1000).default('')
}).strict()

export type CsvTaskRow18 = z.infer<typeof csvTaskRow18Schema>

export const csvColumnInfoSchema = z.object({
  index: z.number().int().positive(),
  name: z.enum(CSV_COLUMN_NAMES),
  type: z.string().min(1),
  required: z.boolean(),
  description: z.string().min(1),
  example: z.string()
}).strict()

export type CsvColumnInfo = z.infer<typeof csvColumnInfoSchema>

export const CSV_COLUMN_INFO: CsvColumnInfo[] = [
  { index: 1, name: 'taskId', type: 'string', required: true, description: 'Unique task id within the CSV group.', example: 'task-001' },
  { index: 2, name: 'taskName', type: 'string', required: true, description: 'Human readable task name.', example: 'Review PR 42' },
  { index: 3, name: 'priority', type: 'enum P0|P1|P2|P3', required: true, description: 'Scheduling priority where P0 is highest.', example: 'P1' },
  { index: 4, name: 'status', type: 'enum pending|running|done|failed|skipped', required: false, description: 'CSV-authored lifecycle status, default pending.', example: 'pending' },
  { index: 5, name: 'tool', type: 'enum codex|claude|gemini|cursor|copilot', required: true, description: 'Tool runner requested for the task.', example: 'codex' },
  { index: 6, name: 'skill', type: 'string', required: true, description: 'Local SKILL name to invoke.', example: 'code-review' },
  { index: 7, name: 'inputFile', type: 'path', required: false, description: 'Input file path relative to cwd or absolute.', example: 'src/app.ts' },
  { index: 8, name: 'inputArgs', type: 'json string', required: false, description: 'JSON-encoded args passed to the skill or runner.', example: '{"prompt":"review this file"}' },
  { index: 9, name: 'outputDir', type: 'path', required: false, description: 'Directory for artifacts or reports.', example: 'out/reports' },
  { index: 10, name: 'outputFormat', type: 'enum json|md|txt|file', required: true, description: 'Expected output artifact format.', example: 'md' },
  { index: 11, name: 'tags', type: 'csv string', required: false, description: 'Comma-separated labels for filtering.', example: 'review,security' },
  { index: 12, name: 'dependsOn', type: 'csv task ids', required: false, description: 'Comma-separated task ids that must succeed first.', example: 'task-001,task-002' },
  { index: 13, name: 'timeoutMs', type: 'integer 0..86400000', required: true, description: 'Execution timeout in milliseconds.', example: '60000' },
  { index: 14, name: 'retries', type: 'integer 0..5', required: true, description: 'Maximum retry count for runtime failures.', example: '1' },
  { index: 15, name: 'concurrencyKey', type: 'string', required: false, description: 'Optional parallel group or limiter key.', example: 'frontend' },
  { index: 16, name: 'createdAt', type: 'ISO datetime', required: true, description: 'Task creation timestamp.', example: '2026-05-03T08:00:00Z' },
  { index: 17, name: 'scheduledAt', type: 'ISO datetime or now', required: true, description: 'Requested schedule timestamp or now.', example: 'now' },
  { index: 18, name: 'note', type: 'string', required: false, description: 'Free-form operator note.', example: 'owner: local' }
]

export const csvHeaderValidationResultSchema = z.object({
  valid: z.boolean(),
  missing: z.array(z.enum(CSV_COLUMN_NAMES)),
  extra: z.array(z.string()),
  orderErrors: z.array(z.object({ index: z.number().int().nonnegative(), expected: z.enum(CSV_COLUMN_NAMES), actual: z.string().nullable() }).strict())
}).strict()

export type CsvHeaderValidationResult = z.infer<typeof csvHeaderValidationResultSchema>

export function validateCsvHeader(header: readonly string[]): CsvHeaderValidationResult {
  const trimmed = header.map((column) => column.trim())
  const expected = new Set<string>(CSV_COLUMN_NAMES)
  const got = new Set(trimmed)
  const missing = CSV_COLUMN_NAMES.filter((column) => !got.has(column))
  const extra = trimmed.filter((column, index) => index >= CSV_COLUMN_NAMES.length || !expected.has(column))
  const orderErrors = CSV_COLUMN_NAMES.flatMap((expectedColumn, index) => {
    const actual = trimmed[index]
    return actual === expectedColumn ? [] : [{ index, expected: expectedColumn, actual: actual ?? null }]
  })
  return csvHeaderValidationResultSchema.parse({
    valid: trimmed.length === CSV_COLUMN_NAMES.length && orderErrors.length === 0,
    missing,
    extra,
    orderErrors
  })
}

export function csvPriorityToNumber(priority: z.infer<typeof csvPrioritySchema>): number {
  if (priority === 'P0') return 100
  if (priority === 'P1') return 75
  if (priority === 'P2') return 50
  return 25
}

export function parseCsvInputArgs(inputArgs: string): Record<string, unknown> {
  const parsed = JSON.parse(inputArgs || '{}')
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: parsed }
}

export function buildCsvTemplateRows(nowIso = new Date(0).toISOString()): string[][] {
  return [
    [...CSV_COLUMN_NAMES],
    [
      'task-001',
      'Review local file',
      'P1',
      'pending',
      'codex',
      'code-review',
      'src/app.ts',
      '{"prompt":"review this file"}',
      'out/reports',
      'md',
      'review,local',
      '',
      '60000',
      '1',
      'codex-pool',
      nowIso,
      'now',
      'example row; replace before launch'
    ]
  ]
}
