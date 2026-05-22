import { z } from 'zod'

export const flowEventKindSchema = z.enum(['task-start', 'task-end', 'task-retry', 'task-fail', 'inject', 'state-flip', 'cli-event', 'fs-burst', 'watchdog-action', 'recording-rotate'])
export const timelineFlowEdgeKindSchema = z.enum(['happens-before', 'triggers', 'fails', 'retries'])
export const flowSpeedSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4), z.literal(8)])
export const flowExportFormatSchema = z.enum(['mermaid-sequence', 'svg'])
export const flowScopeSchema = z.enum(['process', 'port', 'window', 'project', 'runtime', 'global'])
export const flowWindowMsSchema = z.union([z.literal(-1), z.number().int().min(60000).max(86400000)]).default(1800000)

export const flowFilterSchema = z.object({
  taskIds: z.array(z.string().min(1)).optional(),
  tools: z.array(z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot'])).optional(),
  kinds: z.array(flowEventKindSchema).optional(),
  minErrorLevel: z.enum(['INFO', 'WARN', 'ERROR', 'FATAL']).optional()
}).default({})

export const flowRequestSchema = z.object({
  scope: flowScopeSchema.default('runtime'),
  rootId: z.string().min(1).optional(),
  targetId: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
  windowMs: flowWindowMsSchema,
  fromTs: z.number().int().nonnegative().optional(),
  toTs: z.number().int().nonnegative().optional(),
  cursorTs: z.number().int().nonnegative().optional(),
  speed: flowSpeedSchema.default(1),
  filter: flowFilterSchema
}).refine(value => value.fromTs === undefined || value.toTs === undefined || value.fromTs <= value.toTs, { message: 'fromTs must be less than or equal to toTs', path: ['fromTs'] })

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  kind: flowEventKindSchema,
  ts: z.number().int().nonnegative(),
  label: z.string().min(1),
  taskId: z.string().nullable(),
  sessionId: z.string().nullable(),
  instanceId: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()).default({}),
  errorCode: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable()
})

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  kind: timelineFlowEdgeKindSchema,
  source: z.string().min(1),
  target: z.string().min(1),
  durationMs: z.number().int().nonnegative().optional()
})

export const flowStatsSchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  retryCount: z.number().int().nonnegative(),
  avgDurationMs: z.number().int().nonnegative(),
  p95DurationMs: z.number().int().nonnegative()
})
export const flowWarningSchema = z.object({
  code: z.enum(['E_GRAPH_NODE_LIMIT']),
  message: z.string().min(1)
})

export const flowSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  generatedAt: z.number().int().nonnegative(),
  windowMs: z.number().int(),
  fromTs: z.number().int().nonnegative(),
  toTs: z.number().int().nonnegative(),
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
  stats: flowStatsSchema,
  truncated: z.boolean(),
  warnings: z.array(flowWarningSchema).default([]),
  speed: flowSpeedSchema,
  source: z.enum(['task-queue', 'recording-audit', 'mixed']).default('task-queue')
})

export const flowExportRequestSchema = flowRequestSchema.extend({ snapshotId: z.string().uuid().optional(), format: flowExportFormatSchema.default('mermaid-sequence') })
export const flowExportResultSchema = z.object({ content: z.string(), mimeType: z.string().min(1), encoding: z.enum(['utf8']).default('utf8') })
export const flowEventStreamRequestSchema = z.object({
  subscriberId: z.string().min(1).optional(),
  request: z.unknown().optional().transform(value => flowRequestSchema.parse(value ?? {})),
  intervalMs: z.number().int().min(500).max(5000).default(1000)
})
export const flowEventStreamUnsubscribeRequestSchema = z.object({ subscriberId: z.string().min(1) })
export const flowEventStreamResponseSchema = z.object({ success: z.boolean(), subscriberId: z.string().min(1) })
export const flowEventStreamPayloadSchema = z.object({
  subscriberId: z.string().min(1),
  emittedAt: z.number().int().nonnegative(),
  snapshot: flowSnapshotSchema,
  appendedNodes: z.array(flowNodeSchema),
  reason: z.enum(['initial', 'append'])
})

export type FlowEventKind = z.infer<typeof flowEventKindSchema>
export type FlowFilter = z.infer<typeof flowFilterSchema>
export type FlowScope = z.infer<typeof flowScopeSchema>
export type FlowRequest = z.infer<typeof flowRequestSchema>
export type FlowNode = z.infer<typeof flowNodeSchema>
export type FlowEdge = z.infer<typeof flowEdgeSchema>
export type FlowStats = z.infer<typeof flowStatsSchema>
export type FlowWarning = z.infer<typeof flowWarningSchema>
export type FlowSnapshot = z.infer<typeof flowSnapshotSchema>
export type FlowExportRequest = z.infer<typeof flowExportRequestSchema>
export type FlowExportResult = z.infer<typeof flowExportResultSchema>
export type FlowEventStreamRequest = z.infer<typeof flowEventStreamRequestSchema>
export type FlowEventStreamUnsubscribeRequest = z.infer<typeof flowEventStreamUnsubscribeRequestSchema>
export type FlowEventStreamResponse = z.infer<typeof flowEventStreamResponseSchema>
export type FlowEventStreamPayload = z.infer<typeof flowEventStreamPayloadSchema>
