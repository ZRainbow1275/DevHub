import { z } from 'zod'

export const metricKindSchema = z.enum([
  'ipc-rpm',
  'rate-limit-reject',
  'notification-emit',
  'state-transition',
  'fusion-confidence',
  'memory-rss',
  'cpu-pct',
  'shim-status',
  'watchdog-heartbeat',
  'csv-row-throughput',
  'inject-success-rate'
])

export const MetricKindEnum = metricKindSchema

export const metricSampleSchema = z.object({
  kind: metricKindSchema,
  ts: z.number().int(),
  value: z.number(),
  labels: z.record(z.string(), z.string()).optional()
})

export const MetricSampleSchema = metricSampleSchema

export const observabilityHealthSchema = z.object({
  overall: z.enum(['healthy', 'degraded', 'unhealthy']),
  issues: z.array(z.string())
})

export const observabilityGlobalCountersSchema = z.object({
  totalIpcRequests: z.number().int().min(0),
  totalRateLimited: z.number().int().min(0),
  totalNotifications: z.number().int().min(0),
  totalAssertionViolations: z.number().int().min(0),
  activeInstances: z.number().int().min(0)
})

export const observabilitySnapshotSchema = z.object({
  collectedAt: z.number().int(),
  windowStart: z.number().int(),
  windowEnd: z.number().int(),
  metrics: z.array(metricSampleSchema),
  globalCounters: observabilityGlobalCountersSchema,
  health: observabilityHealthSchema
})

export const SnapshotSchema = observabilitySnapshotSchema

export const observabilityConfigSchema = z.object({
  ringBufferMinutes: z.number().int().min(5).max(360).default(30),
  samplingHz: z.number().min(0.1).max(10).default(1),
  exportEnabled: z.boolean().default(true)
})

export const ObservabilityConfigSchema = observabilityConfigSchema

export const observabilitySnapshotRequestSchema = z.object({
  sinceMs: z.number().int().nonnegative().optional()
}).optional()

export const observabilityConfigureResponseSchema = z.object({
  success: z.boolean(),
  config: observabilityConfigSchema,
  effectiveSamplingHz: z.number().min(0.1).max(10)
})

export const observabilityExportFormatSchema = z.enum(['json', 'csv'])

export const observabilityExportSnapshotRequestSchema = z.object({
  format: observabilityExportFormatSchema.default('json'),
  destPath: z.string().min(1).optional()
}).optional()

export const observabilityExportSnapshotResponseSchema = z.object({
  success: z.boolean(),
  sizeBytes: z.number().int().min(0),
  filePath: z.string().min(1),
  format: observabilityExportFormatSchema,
  exportedAt: z.number().int()
})

export const observabilityDiagnosticPackRequestSchema = z.object({
  includeScreenshots: z.boolean().default(false)
}).optional()

export const observabilityDiagnosticPackResponseSchema = z.object({
  zipPath: z.string().nullable(),
  path: z.string().min(1),
  bytes: z.number().int().min(0),
  exportedAt: z.number().int()
})

export const observabilitySubscribeRequestSchema = z.object({
  subscriberId: z.string().min(1).optional()
}).optional()

export const observabilitySubscribeResponseSchema = z.object({
  success: z.boolean(),
  subscriberId: z.string().min(1)
})

export const observabilityUnsubscribeRequestSchema = z.object({
  subscriberId: z.string().min(1)
})

export const observabilityUnsubscribeResponseSchema = z.object({
  success: z.boolean(),
  subscriberId: z.string().min(1)
})

export type MetricKind = z.infer<typeof metricKindSchema>
export type ObservabilityMetricSample = z.infer<typeof metricSampleSchema>
export type ObservabilityConfig = z.infer<typeof observabilityConfigSchema>
export type ObservabilitySnapshot = z.infer<typeof observabilitySnapshotSchema>
export type ObservabilitySnapshotRequest = z.infer<NonNullable<typeof observabilitySnapshotRequestSchema>>
export type ObservabilityConfigureResponse = z.infer<typeof observabilityConfigureResponseSchema>
export type ObservabilityExportSnapshotRequest = z.infer<NonNullable<typeof observabilityExportSnapshotRequestSchema>>
export type ObservabilityExportSnapshotResponse = z.infer<typeof observabilityExportSnapshotResponseSchema>
export type ObservabilityDiagnosticPackRequest = z.infer<NonNullable<typeof observabilityDiagnosticPackRequestSchema>>
export type ObservabilityDiagnosticPackResponse = z.infer<typeof observabilityDiagnosticPackResponseSchema>
export type ObservabilitySubscribeResponse = z.infer<typeof observabilitySubscribeResponseSchema>
export type ObservabilityUnsubscribeRequest = z.infer<typeof observabilityUnsubscribeRequestSchema>
export type ObservabilityUnsubscribeResponse = z.infer<typeof observabilityUnsubscribeResponseSchema>
