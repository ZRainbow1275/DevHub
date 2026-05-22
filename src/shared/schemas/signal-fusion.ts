import { z } from 'zod'

export const SIGNAL_SOURCES = [
  'cli_parse',
  'window_title',
  'process_cpu_io',
  'task_queue',
  'watchdog',
  'user_feedback'
] as const

export const signalSourceSchema = z.enum(SIGNAL_SOURCES)
export type SignalSource = z.infer<typeof signalSourceSchema>

export const weightProfileIdSchema = z.enum(['default', 'cli-heavy', 'window-heavy', 'user-custom'])
export type WeightProfileId = z.infer<typeof weightProfileIdSchema>

export const signalWeightMapSchema = z.record(signalSourceSchema, z.number().min(0).max(1)).superRefine((weights, ctx) => {
  const sum = Object.values(weights).reduce((total, value) => total + value, 0)
  if (Math.abs(sum - 1) > 0.01) {
    ctx.addIssue({
      code: 'custom',
      message: `E_VALIDATION: signal weights must sum to 1.0, received ${sum.toFixed(4)}`
    })
  }
})

const signalSampleInputSchema = z.object({
  source: signalSourceSchema,
  instanceId: z.string().min(1).optional(),
  weight: z.number().min(0).max(1).optional(),
  rawValue: z.number().min(0).max(1).optional(),
  value: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1),
  ts: z.number().int().nonnegative().optional(),
  observedAt: z.number().int().nonnegative().optional(),
  decayHalfLifeMs: z.number().int().positive().default(60_000)
}).superRefine((sample, ctx) => {
  if (sample.rawValue === undefined && sample.value === undefined) {
    ctx.addIssue({ code: 'custom', message: 'E_VALIDATION: rawValue or value is required' })
  }
  if (sample.ts === undefined && sample.observedAt === undefined) {
    ctx.addIssue({ code: 'custom', message: 'E_VALIDATION: ts or observedAt is required' })
  }
})

export const signalSampleSchema = signalSampleInputSchema.transform(sample => {
  const rawValue = sample.rawValue ?? sample.value ?? 0
  const ts = sample.ts ?? sample.observedAt ?? 0
  return {
    source: sample.source,
    instanceId: sample.instanceId ?? 'unknown',
    weight: sample.weight ?? 0,
    rawValue,
    value: rawValue,
    confidence: sample.confidence,
    ts,
    observedAt: ts,
    decayHalfLifeMs: sample.decayHalfLifeMs
  }
})
export type SignalSample = z.infer<typeof signalSampleSchema>

export const weightProfileSchema = z.object({
  profileId: weightProfileIdSchema,
  weights: signalWeightMapSchema,
  updatedAt: z.number().int().nonnegative(),
  validatedSum: z.literal(true),
  warning: z.string().optional()
})
export type WeightProfile = z.infer<typeof weightProfileSchema>

export const signalContributionValueSchema = z.object({
  weight: z.number().min(0).max(1),
  rawValue: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  contributionPct: z.number().min(0).max(1),
  weightedValue: z.number().min(0).max(1),
  effectiveWeight: z.number().min(0),
  decayedConfidence: z.number().min(0).max(1),
  ageMs: z.number().int().nonnegative(),
  stale: z.boolean()
})
export type SignalContributionValue = z.infer<typeof signalContributionValueSchema>

export const signalContributionSchema = signalContributionValueSchema.extend({
  source: signalSourceSchema
})
export type SignalContribution = z.infer<typeof signalContributionSchema>

export const signalContributionMapSchema = z.record(signalSourceSchema, signalContributionValueSchema)

export const fusionProgressDataPointSchema = z.object({
  instanceId: z.string().min(1),
  percent: z.number().min(0).max(1),
  source: z.literal('fusion'),
  confidence: z.number().min(0).max(1),
  observedAt: z.number().int().nonnegative(),
  message: z.string().optional()
})

export const signalContributionSnapshotSchema = z.object({
  instanceId: z.string().min(1),
  contributions: signalContributionMapSchema,
  fusedProgress: fusionProgressDataPointSchema,
  fusedAt: z.number().int().nonnegative(),
  state: z.enum(['idle', 'thinking', 'working', 'validating', 'waiting-input', 'completed', 'error', 'stuck']),
  profileId: weightProfileIdSchema,
  sampleCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()).default([])
})
export type SignalContributionSnapshot = z.infer<typeof signalContributionSnapshotSchema>

export const fusionConfigSchema = z.object({
  algorithm: z.enum(['weighted-mean', 'dempster-shafer', 'bayesian-update']).default('weighted-mean'),
  decayEnabled: z.boolean().default(true),
  minSourcesForFusion: z.number().int().min(1).max(6).default(2),
  fallbackToHighestConfidence: z.boolean().default(true),
  decayHalfLifeMs: z.number().int().positive().default(60_000),
  staleAfterMs: z.number().int().positive().default(30_000),
  streamThrottleMs: z.number().int().min(50).max(5_000).default(100),
  updatedAt: z.number().int().nonnegative().optional()
})
export type FusionConfig = z.infer<typeof fusionConfigSchema>
