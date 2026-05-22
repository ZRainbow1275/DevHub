import { z } from 'zod'

export const rateLimitClassSchema = z.enum(['high_freq_scan', 'medium_query', 'low_freq_op', 'meta'])
export type RateLimitClass = z.infer<typeof rateLimitClassSchema>

export const RATE_LIMIT_RPM = {
  high_freq_scan: 30,
  medium_query: 60,
  low_freq_op: 120,
  meta: 600
} as const satisfies Record<RateLimitClass, number>

export const channelRegistrationSchema = z.object({
  channel: z.string().regex(/^[a-z][a-z0-9-]*:[a-z0-9:-]+$/),
  rateClass: rateLimitClassSchema.default('medium_query'),
  burstAllowance: z.number().int().min(0).default(5),
  perSenderBucket: z.boolean().default(false),
  description: z.string().min(1),
  source: z.string().min(1).optional()
})

export const rateLimitVerdictSchema = z.object({
  channel: z.string(),
  allowed: z.boolean(),
  rateClass: rateLimitClassSchema,
  remainingTokens: z.number().min(0),
  retryAfterMs: z.number().int().min(0),
  ts: z.number().int(),
  bucketKey: z.string().min(1),
  limitRpm: z.number().int().min(0)
})

export const rateLimitStatsSchema = z.object({
  channel: z.string(),
  rateClass: rateLimitClassSchema,
  totalRequests: z.number().int().min(0),
  allowedRequests: z.number().int().min(0),
  rejectedRequests: z.number().int().min(0),
  rejectRate: z.number().min(0).max(1),
  windowStart: z.number().int(),
  windowMs: z.number().int().positive(),
  limitRpm: z.number().int().min(0),
  remainingTokens: z.number().min(0),
  lastAllowedAt: z.number().int().nullable(),
  lastRejectedAt: z.number().int().nullable()
})

export const rateLimitStatsResponseSchema = z.object({
  generatedAt: z.number().int(),
  windowMs: z.number().int().positive(),
  perChannel: z.array(rateLimitStatsSchema)
})

export const rateLimitOverrideRequestSchema = z.object({
  channel: channelRegistrationSchema.shape.channel,
  rateClass: rateLimitClassSchema,
  confirmedBy: z.string().min(3).optional()
})

export const rateLimitOverrideResponseSchema = z.object({
  success: z.boolean(),
  channel: channelRegistrationSchema.shape.channel,
  rateClass: rateLimitClassSchema,
  confirmedBy: z.string().nullable()
})

export type ChannelRegistration = z.infer<typeof channelRegistrationSchema>
export type RateLimitVerdict = z.infer<typeof rateLimitVerdictSchema>
export type RateLimitStats = z.infer<typeof rateLimitStatsSchema>
export type RateLimitStatsResponse = z.infer<typeof rateLimitStatsResponseSchema>
export type RateLimitOverrideRequest = z.infer<typeof rateLimitOverrideRequestSchema>
export type RateLimitOverrideResponse = z.infer<typeof rateLimitOverrideResponseSchema>
