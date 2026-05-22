import { z } from 'zod'
import { csvTaskRow18Schema } from './csv-task-row'
import { dagSnapshotSchema } from './dag'

export const dagViewKindSchema = z.enum(['canvas', 'list', 'gantt', 'kanban'])

export const dagEditorValidationErrorSchema = z.strictObject({
  rowIndex: z.number().int().nonnegative(),
  field: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1)
})

export const dagEditorPatchSchema = z.strictObject({
  at: z.number().int().nonnegative(),
  patch: z.unknown()
})

export const dagEditorEdgeHoverSchema = z.strictObject({
  from: z.string().min(1),
  to: z.string().min(1)
})

export const dagEditorStateSchema = z.strictObject({
  csvPath: z.string(),
  isLocked: z.boolean(),
  lockOwnerPid: z.number().int().nullable(),
  isDirty: z.boolean(),
  rows: z.array(csvTaskRow18Schema),
  snapshot: dagSnapshotSchema.nullable(),
  selectedTaskIds: z.array(z.string().min(1)),
  hoveredEdge: dagEditorEdgeHoverSchema.nullable(),
  view: dagViewKindSchema.default('canvas'),
  undoStack: z.array(dagEditorPatchSchema),
  redoStack: z.array(dagEditorPatchSchema),
  cyclePaths: z.array(z.array(z.string().min(1)).min(2)).default([]),
  validationErrors: z.array(dagEditorValidationErrorSchema).default([])
})

export const csvLockRequestSchema = z.strictObject({
  csvPath: z.string().min(1),
  confirmedBy: z.string().min(3).optional()
})

export const csvUnlockRequestSchema = csvLockRequestSchema

export const csvLockStatusRequestSchema = z.strictObject({
  csvPath: z.string().min(1)
})

export const csvSaveRequestSchema = z.strictObject({
  csvPath: z.string().min(1),
  rows: z.array(csvTaskRow18Schema).min(1),
  expectedMtimeMs: z.number().int().nonnegative().optional(),
  forceWrite: z.boolean().optional(),
  confirmedBy: z.string().min(3).optional()
})

export const nodeTemplateSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  rowTemplate: csvTaskRow18Schema.partial(),
  createdAt: z.number().int().nonnegative(),
  source: z.enum(['builtin', 'user']),
  confirmedBy: z.string().optional()
})

export const csvTemplateListRequestSchema = z.strictObject({
  source: z.enum(['builtin', 'user']).optional()
}).optional()

export const csvSaveTemplateRequestSchema = z.strictObject({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  row: z.unknown().optional(),
  rowTemplate: csvTaskRow18Schema.partial().optional(),
  confirmedBy: z.string().min(3).optional()
}).refine(value => Boolean(value.row || value.rowTemplate), { message: 'row or rowTemplate is required' })

export const csvDeleteTemplateRequestSchema = z.strictObject({
  id: z.string().min(1),
  confirmedBy: z.string().min(3).optional()
})

export const csvLockStatusSchema = z.strictObject({
  csvPath: z.string().min(1),
  lockPath: z.string().min(1),
  locked: z.boolean(),
  ownerPid: z.number().int().nullable(),
  owner: z.string().nullable(),
  lockedAt: z.number().int().nonnegative().nullable(),
  expiresAt: z.number().int().nonnegative().nullable(),
  stale: z.boolean(),
  mtimeMs: z.number().int().nonnegative().nullable()
})

export const csvExternalChangeEventSchema = z.strictObject({
  csvPath: z.string().min(1),
  kind: z.enum(['add', 'change', 'unlink']),
  observedAt: z.number().int().nonnegative(),
  expectedMtimeMs: z.number().int().nonnegative().nullable(),
  observedMtimeMs: z.number().int().nonnegative().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable()
})

export const csvLockResultSchema = csvLockStatusSchema.extend({
  acquired: z.boolean(),
  rows: z.array(csvTaskRow18Schema).default([])
})

export const csvSaveResultSchema = z.strictObject({
  success: z.boolean(),
  cycleDetected: z.boolean(),
  validationErrors: z.array(dagEditorValidationErrorSchema).default([]),
  cyclePaths: z.array(z.array(z.string().min(1)).min(2)).default([]),
  savedAt: z.number().int().nonnegative().optional(),
  mtimeMs: z.number().int().nonnegative().optional(),
  rowCount: z.number().int().nonnegative(),
  csvPath: z.string().min(1),
  error: z.string().min(1).optional()
})

export const csvDeleteTemplateResultSchema = z.strictObject({
  success: z.boolean(),
  deleted: z.number().int().nonnegative(),
  id: z.string().min(1)
})

export type DagViewKind = z.infer<typeof dagViewKindSchema>
export type DagEditorState = z.infer<typeof dagEditorStateSchema>
export type DagEditorValidationError = z.infer<typeof dagEditorValidationErrorSchema>
export type DagEditorPatch = z.infer<typeof dagEditorPatchSchema>
export type CsvExternalChangeEvent = z.infer<typeof csvExternalChangeEventSchema>
export type CsvLockResult = z.infer<typeof csvLockResultSchema>
export type CsvLockStatus = z.infer<typeof csvLockStatusSchema>
export type CsvSaveResult = z.infer<typeof csvSaveResultSchema>
export type NodeTemplate = z.infer<typeof nodeTemplateSchema>

export const BUILTIN_NODE_TEMPLATES: NodeTemplate[] = [
  {
    id: 'builtin-code-review',
    name: '代码评审',
    description: 'Review a local code change and produce a concise risk report.',
    rowTemplate: {
      priority: 'P1',
      status: 'pending',
      tool: 'codex',
      skill: 'code-review',
      inputFile: '',
      inputArgs: '{"prompt":"review the selected code change"}',
      outputDir: 'out/reports',
      outputFormat: 'md',
      tags: 'review,quality',
      dependsOn: '',
      timeoutMs: 60000,
      retries: 1,
      concurrencyKey: 'codex-review',
      scheduledAt: 'now',
      note: 'builtin template: code review'
    },
    createdAt: 1,
    source: 'builtin'
  },
  {
    id: 'builtin-write-tests',
    name: '写测试',
    description: 'Add or strengthen focused tests for the selected change.',
    rowTemplate: {
      priority: 'P1',
      status: 'pending',
      tool: 'codex',
      skill: 'write-tests',
      inputFile: '',
      inputArgs: '{"prompt":"add focused regression tests"}',
      outputDir: 'out/tests',
      outputFormat: 'md',
      tags: 'test,regression',
      dependsOn: '',
      timeoutMs: 90000,
      retries: 1,
      concurrencyKey: 'codex-test',
      scheduledAt: 'now',
      note: 'builtin template: write tests'
    },
    createdAt: 2,
    source: 'builtin'
  },
  {
    id: 'builtin-fix-bug',
    name: '修 bug',
    description: 'Diagnose a real failure and implement a root-cause fix.',
    rowTemplate: {
      priority: 'P0',
      status: 'pending',
      tool: 'codex',
      skill: 'fix-bug',
      inputFile: '',
      inputArgs: '{"prompt":"diagnose and fix the failure at root cause"}',
      outputDir: 'out/fixes',
      outputFormat: 'md',
      tags: 'bugfix,root-cause',
      dependsOn: '',
      timeoutMs: 120000,
      retries: 1,
      concurrencyKey: 'codex-fix',
      scheduledAt: 'now',
      note: 'builtin template: fix bug'
    },
    createdAt: 3,
    source: 'builtin'
  },
  {
    id: 'builtin-commit',
    name: 'commit',
    description: 'Prepare a focused commit summary for reviewed local changes.',
    rowTemplate: {
      priority: 'P2',
      status: 'pending',
      tool: 'codex',
      skill: 'commit-summary',
      inputFile: '',
      inputArgs: '{"prompt":"summarize staged changes for a focused commit"}',
      outputDir: 'out/git',
      outputFormat: 'md',
      tags: 'git,commit',
      dependsOn: '',
      timeoutMs: 30000,
      retries: 0,
      concurrencyKey: 'codex-git',
      scheduledAt: 'now',
      note: 'builtin template: commit'
    },
    createdAt: 4,
    source: 'builtin'
  },
  {
    id: 'builtin-pr-description',
    name: 'PR 描述',
    description: 'Draft a pull request description from verified local changes.',
    rowTemplate: {
      priority: 'P2',
      status: 'pending',
      tool: 'codex',
      skill: 'pr-description',
      inputFile: '',
      inputArgs: '{"prompt":"draft a pull request description with tests and risks"}',
      outputDir: 'out/git',
      outputFormat: 'md',
      tags: 'git,pr',
      dependsOn: '',
      timeoutMs: 45000,
      retries: 0,
      concurrencyKey: 'codex-git',
      scheduledAt: 'now',
      note: 'builtin template: PR description'
    },
    createdAt: 5,
    source: 'builtin'
  }
]
