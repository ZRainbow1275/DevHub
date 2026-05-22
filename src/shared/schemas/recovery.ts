import { z } from 'zod'

export const dirtyKindSchema = z.enum([
  'unclean-shutdown',
  'pending-tasks-in-queue',
  'orphan-shim-processes',
  'unsaved-store',
  'truncated-audit-log',
  'inconsistent-state-machine',
  'sqlite-integrity-fail'
])

export const dirtySeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export const recoveryRecommendedActionSchema = z.enum(['restore', 'skip', 'backup-and-clean', 'manual-review'])
export const recoverySnapshotReasonSchema = z.enum(['pre-recovery', 'user-explicit', 'auto-checkpoint'])
export const recoveryUserChoiceSchema = z.enum(['restore-all', 'restore-selected', 'skip-all', 'cancel'])

export const dirtyFindingSchema = z.object({
  kind: dirtyKindSchema,
  severity: dirtySeveritySchema,
  detectedAt: z.number().int().nonnegative(),
  details: z.record(z.string(), z.unknown()),
  recommendedAction: recoveryRecommendedActionSchema
})

export const recoverySnapshotFileSchema = z.object({
  sourcePath: z.string().min(1),
  snapshotPath: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  kind: z.enum(['file', 'directory'])
})

export const recoverySnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  takenAt: z.number().int().nonnegative(),
  reason: recoverySnapshotReasonSchema,
  paths: z.array(z.string()),
  sizeBytes: z.number().int().nonnegative(),
  manifestPath: z.string().min(1).optional(),
  files: z.array(recoverySnapshotFileSchema).default([])
})

export const recoveryAppliedActionSchema = z.object({
  finding: dirtyKindSchema,
  action: z.string().min(1),
  success: z.boolean(),
  error: z.string().nullable()
})

export const legacyRecoveryIssueSchema = z.object({
  kind: z.string().min(1),
  severity: z.enum(['info', 'warning', 'error']),
  count: z.number().int().nonnegative().optional()
})

export const recoveryReportSchema = z.object({
  reportId: z.string().min(1),
  scannedAt: z.number().int().nonnegative(),
  startedAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().nullable(),
  findings: z.array(dirtyFindingSchema),
  snapshotsCreated: z.array(recoverySnapshotSchema),
  userChoice: recoveryUserChoiceSchema.nullable(),
  appliedActions: z.array(recoveryAppliedActionSchema),
  issues: z.array(legacyRecoveryIssueSchema).default([])
})

export const appLifecycleMarkerSchema = z.object({
  status: z.enum(['running', 'clean-shutdown']),
  pid: z.number().int().positive(),
  bootId: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  appVersion: z.string().min(1).nullable().default(null)
})

export const recoveryProbeSummarySchema = z.object({
  probeId: z.string().uuid(),
  startedAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative(),
  timedOut: z.boolean(),
  findingsCount: z.number().int().nonnegative()
})

export const recoveryCheckDirtyRequestSchema = z.object({}).default({})

export const recoveryCheckDirtyResponseSchema = z.object({
  findings: z.array(dirtyFindingSchema),
  report: recoveryReportSchema,
  probe: recoveryProbeSummarySchema
})

export const recoveryRestoreStateRequestSchema = z.object({
  snapshotId: z.string().uuid().optional(),
  kindsToRestore: z.array(dirtyKindSchema).min(1),
  confirmedBy: z.string().min(3).optional(),
  userChoice: recoveryUserChoiceSchema.default('restore-selected')
})

export const recoveryListSnapshotsResponseSchema = z.object({
  snapshots: z.array(recoverySnapshotSchema)
})

export const recoveryCreateCheckpointRequestSchema = z.object({
  reason: recoverySnapshotReasonSchema.default('user-explicit')
})

export const recoveryDismissRequestSchema = z.object({
  reportId: z.string().min(1).optional(),
  findingsToDismiss: z.array(dirtyKindSchema).min(1).optional()
}).refine(value => Boolean(value.reportId) || Boolean(value.findingsToDismiss), {
  message: 'reportId or findingsToDismiss is required'
})

export const recoveryDismissResponseSchema = z.object({
  success: z.boolean(),
  reportId: z.string().min(1).nullable(),
  findingsDismissed: z.array(dirtyKindSchema),
  dismissedUntil: z.number().int().nonnegative().nullable(),
  dismissedAt: z.number().int().nonnegative()
})

export type DirtyKind = z.infer<typeof dirtyKindSchema>
export type DirtySeverity = z.infer<typeof dirtySeveritySchema>
export type DirtyFinding = z.infer<typeof dirtyFindingSchema>
export type RecoverySnapshot = z.infer<typeof recoverySnapshotSchema>
export type RecoverySnapshotFile = z.infer<typeof recoverySnapshotFileSchema>
export type RecoveryReport = z.infer<typeof recoveryReportSchema>
export type RecoveryAppliedAction = z.infer<typeof recoveryAppliedActionSchema>
export type AppLifecycleMarker = z.infer<typeof appLifecycleMarkerSchema>
export type RecoveryProbeSummary = z.infer<typeof recoveryProbeSummarySchema>
export type RecoveryCheckDirtyResponse = z.infer<typeof recoveryCheckDirtyResponseSchema>
export type RecoveryRestoreStateRequest = z.infer<typeof recoveryRestoreStateRequestSchema>
export type RecoveryDismissRequest = z.infer<typeof recoveryDismissRequestSchema>
export type RecoveryDismissResponse = z.infer<typeof recoveryDismissResponseSchema>
