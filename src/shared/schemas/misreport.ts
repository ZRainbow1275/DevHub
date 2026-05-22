import { z } from 'zod'
import { signalContributionSnapshotSchema, signalSourceSchema } from './signal-fusion'
import { stateTransitionEventSchema, taskStateSchema } from './state-machine'

export const misreportKindSchema = z.enum([
  'correct-detection',
  'false-idle',
  'false-thinking',
  'false-progress',
  'false-completion',
  'false-error'
])
export type MisreportKind = z.infer<typeof misreportKindSchema>

export const misreportRecordSchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string().min(1),
  kind: misreportKindSchema,
  reportedBy: z.string().min(1).default('self'),
  reportedAt: z.number().int().nonnegative(),
  signalSnapshot: signalContributionSnapshotSchema,
  userNote: z.string().max(500).optional(),
  expectedTaskState: taskStateSchema.optional()
})
export type MisreportRecord = z.infer<typeof misreportRecordSchema>

export const weightAdjustmentSchema = z.object({
  source: signalSourceSchema,
  oldWeight: z.number().min(0).max(1),
  newWeight: z.number().min(0).max(1),
  delta: z.number().refine(value => Math.abs(value) <= 0.05, { message: 'single feedback delta must be <= 5%' }),
  triggeredByMisreportId: z.string().uuid(),
  appliedAt: z.number().int().nonnegative()
})
export type WeightAdjustment = z.infer<typeof weightAdjustmentSchema>

export const diagnosticReasonSchema = z.object({
  reasonText: z.string().min(1),
  sourceCitation: z.string().min(1),
  contributionPct: z.number().min(0).max(1)
})

export const diagnosticExplainSchema = z.object({
  instanceId: z.string().min(1),
  currentTaskState: taskStateSchema,
  topReasons: z.array(diagnosticReasonSchema).max(5),
  recentTransitions: z.array(stateTransitionEventSchema).max(10),
  suggestedAction: z.enum(['wait', 'restart-instance', 'toggle-shim', 'adjust-weights', 'report-misreport'])
})
export type DiagnosticExplain = z.infer<typeof diagnosticExplainSchema>

export const reportMisreportRequestSchema = z.object({
  instanceId: z.string().min(1),
  kind: misreportKindSchema,
  userNote: z.string().max(500).optional(),
  expectedTaskState: taskStateSchema.optional(),
  reportedBy: z.string().min(1).optional(),
  confirmedBy: z.string().min(3).optional()
})
export type ReportMisreportRequest = z.infer<typeof reportMisreportRequestSchema>

export const listMisreportsRequestSchema = z.object({
  since: z.number().int().nonnegative().optional()
}).optional()
export type ListMisreportsRequest = z.infer<typeof listMisreportsRequestSchema>

export const resetLearnedWeightsRequestSchema = z.object({
  confirmedBy: z.string().min(3)
})
export type ResetLearnedWeightsRequest = z.infer<typeof resetLearnedWeightsRequestSchema>

export const misreportResponseSchema = z.object({
  id: z.string().uuid(),
  record: misreportRecordSchema,
  weightAdjustments: z.array(weightAdjustmentSchema),
  profileId: z.literal('user-custom'),
  nextWeights: z.record(signalSourceSchema, z.number().min(0).max(1))
})
export type MisreportResponse = z.infer<typeof misreportResponseSchema>

export const resetLearnedWeightsResponseSchema = z.object({
  success: z.literal(true),
  profileResetTo: z.literal('default')
})
export type ResetLearnedWeightsResponse = z.infer<typeof resetLearnedWeightsResponseSchema>
