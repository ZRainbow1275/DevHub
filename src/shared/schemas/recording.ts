import { z } from 'zod'
import { injectModeSchema, injectScenarioSchema } from './inject'

export const recordingStreamKindSchema = z.enum(['stdout', 'stdin', 'screenshot', 'fs', 'git-diff'])
export const recordingSourceSchema = z.enum(['ai-task', 'csv-batch', 'watchdog', 'inject', 'system'])
export const recordingStatusSchema = z.enum(['recording', 'stopped', 'error'])
export const recordingFsOpSchema = z.enum(['add', 'change', 'unlink', 'addDir', 'unlinkDir'])
export const recordingScreenshotRegionSchema = z.enum(['window', 'cwd-tree', 'fullscreen'])

export const recordingStreamFileSchema = z.object({
  kind: recordingStreamKindSchema,
  path: z.string().min(1),
  bytes: z.number().int().nonnegative()
})

export const recordingManifestSchema = z.object({
  recordingId: z.string().uuid(),
  sessionId: z.string().uuid(),
  taskId: z.string().min(1),
  alias: z.string().min(1).optional(),
  tool: z.string().min(1).optional(),
  label: z.string().min(1).default('R8 recording'),
  source: recordingSourceSchema.default('system'),
  cwd: z.string().min(1),
  directory: z.string().min(1),
  manifestPath: z.string().min(1),
  enabledStreams: z.array(recordingStreamKindSchema).min(1),
  streams: z.array(recordingStreamFileSchema).default([]),
  screenshotIntervalMs: z.number().int().min(2000).default(10000),
  startedAt: z.number().int().nonnegative(),
  stoppedAt: z.number().int().nonnegative().nullable().default(null),
  status: recordingStatusSchema.default('recording'),
  bytes: z.number().int().nonnegative().default(0),
  rotated: z.boolean().default(false),
  rotationCount: z.number().int().nonnegative().default(0),
  redactionApplied: z.boolean().default(false),
  lastAccessedAt: z.number().int().nonnegative(),
  errors: z.array(z.object({ code: z.string().min(1), message: z.string().min(1), at: z.number().int().nonnegative() })).default([]),
  events: z.array(z.object({ type: z.string().min(1), at: z.number().int().nonnegative(), payload: z.unknown().optional() })).default([])
})

export const stdoutEventSchema = z.object({
  ts: z.number().int().nonnegative(),
  kind: z.literal('stdout'),
  stream: z.enum(['stdout', 'stderr', 'title', 'system']).default('stdout'),
  rawSource: z.enum(['ndjson', 'shim', 'line', 'sse', 'heuristic', 'window-title']).default('line'),
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown())
})

export const recordedInjectActionDetailsSchema = z.object({
  actionId: z.string().uuid(),
  targetAlias: z.string().min(1).optional(),
  mode: injectModeSchema.optional(),
  scenario: injectScenarioSchema.optional()
})

export const stdinEventSchema = z.object({
  ts: z.number().int().nonnegative(),
  kind: z.literal('stdin'),
  origin: z.enum(['user', 'inject']),
  injectActionId: z.string().uuid().nullable(),
  injectAction: recordedInjectActionDetailsSchema.optional(),
  text: z.string()
})

export const screenshotEventSchema = z.object({
  ts: z.number().int().nonnegative(),
  kind: z.literal('screenshot'),
  filePath: z.string().min(1),
  hwnd: z.number().int().nullable(),
  region: recordingScreenshotRegionSchema,
  sizeBytes: z.number().int().nonnegative()
})

export const fsEventSchema = z.object({
  ts: z.number().int().nonnegative(),
  kind: z.literal('fs'),
  op: recordingFsOpSchema,
  path: z.string().min(1),
  sha256Before: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  sha256After: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  sizeBytes: z.number().int().nonnegative().nullable()
})

export const gitDiffEventSchema = z.object({
  ts: z.number().int().nonnegative(),
  kind: z.literal('git-diff'),
  phase: z.enum(['pre-task', 'post-task']),
  branch: z.string().min(1),
  headSha: z.string().regex(/^[a-f0-9]{40}$/),
  diffStat: z.string(),
  diffPath: z.string().min(1)
})

export const recordingEventSchema = z.discriminatedUnion('kind', [
  stdoutEventSchema,
  stdinEventSchema,
  screenshotEventSchema,
  fsEventSchema,
  gitDiffEventSchema
])

export const recordingEventStreamPayloadSchema = recordingEventSchema.and(z.object({ recordingId: z.string().uuid() }))

export const recordingStartRequestSchema = z.object({
  sessionId: z.string().uuid(),
  taskId: z.string().min(1),
  cwd: z.string().min(1),
  alias: z.string().min(1).optional(),
  tool: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  source: recordingSourceSchema.optional(),
  enabledStreams: z.array(recordingStreamKindSchema).min(1).optional(),
  screenshotIntervalMs: z.number().int().positive().optional(),
  confirmedBy: z.string().min(3).optional()
})

export const legacyRecordingStartRequestSchema = z.object({
  label: z.string().min(1).optional(),
  source: recordingSourceSchema.optional(),
  confirmedBy: z.string().min(3).optional()
})

export const recordingStopRequestSchema = z.object({
  recordingId: z.string().uuid().optional(),
  sessionId: z.string().min(1).optional(),
  confirmedBy: z.string().min(3).optional()
}).refine(value => Boolean(value.recordingId || value.sessionId), { message: 'recordingId or sessionId is required' })

export const recordingListRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  taskId: z.string().min(1).optional(),
  sinceTs: z.number().int().nonnegative().optional()
}).optional()

export const recordingGetManifestRequestSchema = z.object({
  recordingId: z.string().uuid().optional(),
  sessionId: z.string().min(1).optional()
}).refine(value => Boolean(value.recordingId || value.sessionId), { message: 'recordingId or sessionId is required' })

export const recordingGetEventsRequestSchema = z.object({
  recordingId: z.string().uuid(),
  kind: recordingStreamKindSchema.optional(),
  sinceTs: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(10000).optional()
})

export const recordingExportAsciinemaRequestSchema = z.object({
  recordingId: z.string().uuid(),
  outPath: z.string().min(1)
})

export const recordingExportZipRequestSchema = z.object({
  recordingId: z.string().uuid(),
  outPath: z.string().min(1),
  redact: z.boolean().default(true)
})

export const recordingDeleteRequestSchema = z.object({
  recordingId: z.string().uuid(),
  confirmedBy: z.string().min(3).optional()
})

export const recordingExportResultSchema = z.object({ filePath: z.string().min(1) })
export const recordingDeleteResultSchema = z.object({ deleted: z.boolean() })

export type RecordingStreamKind = z.infer<typeof recordingStreamKindSchema>
export type RecordingManifest = z.infer<typeof recordingManifestSchema>
export type RecordingEvent = z.infer<typeof recordingEventSchema>
export type StdoutEvent = z.infer<typeof stdoutEventSchema>
export type StdinEvent = z.infer<typeof stdinEventSchema>
export type FsEvent = z.infer<typeof fsEventSchema>
export type ScreenshotEvent = z.infer<typeof screenshotEventSchema>
export type GitDiffEvent = z.infer<typeof gitDiffEventSchema>
export type RecordingStartRequest = z.infer<typeof recordingStartRequestSchema>
export type RecordingStopRequest = z.infer<typeof recordingStopRequestSchema>
export type RecordingListRequest = z.infer<typeof recordingListRequestSchema>
export type RecordingGetEventsRequest = z.infer<typeof recordingGetEventsRequestSchema>
