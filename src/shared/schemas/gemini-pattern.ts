import { z } from 'zod'

export const GEMINI_PATTERN_KINDS = [
  'thinking',
  'tool_call',
  'tool_result',
  'partial_text',
  'completion',
  'rate_limit',
  'safety_block',
  'unknown'
] as const

const GEMINI_REGEX_FLAG_PATTERN = /^[dgimsuvy]*$/

export const geminiPatternKindSchema = z.enum(GEMINI_PATTERN_KINDS)

export const geminiPatternRuleInputSchema = z.object({
  kind: geminiPatternKindSchema,
  regex: z.string().min(1),
  flags: z.string().regex(GEMINI_REGEX_FLAG_PATTERN).default('i'),
  confidence: z.number().min(0).max(1),
  ansiStrip: z.boolean().default(true)
}).strict()

export const geminiParseStateSchema = z.object({
  instanceId: z.string().min(1),
  lastKind: geminiPatternKindSchema.nullable(),
  toolStack: z.array(z.string()),
  partialBuffer: z.string(),
  totalLines: z.number().int().nonnegative()
}).strict()

export const geminiPatternStatRequestSchema = z.object({
  instanceId: z.string().min(1).optional()
}).strict()

export const geminiPatternStatSchema = z.object({
  instanceId: z.string().nullable(),
  kindCounts: z.record(z.string(), z.number().int().nonnegative()),
  totalLines: z.number().int().nonnegative(),
  unmatchedLines: z.number().int().nonnegative(),
  unmatchedRatio: z.number().min(0).max(1),
  lastKind: geminiPatternKindSchema.nullable(),
  toolStack: z.array(z.string()),
  partialBufferBytes: z.number().int().nonnegative(),
  ruleVersion: z.number().int().positive(),
  appliedRules: z.number().int().nonnegative(),
  observedAt: z.number().int().nonnegative()
}).strict()

export const geminiRuleReloadRequestSchema = z.object({
  rules: z.array(geminiPatternRuleInputSchema).min(1),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const geminiRuleReloadResponseSchema = z.object({
  success: z.literal(true),
  applied: z.number().int().nonnegative(),
  ruleVersion: z.number().int().positive(),
  kinds: z.array(geminiPatternKindSchema),
  confirmedBy: z.string().min(3).optional()
}).strict()

export type GeminiPatternKind = z.infer<typeof geminiPatternKindSchema>
export type GeminiPatternRuleInput = z.infer<typeof geminiPatternRuleInputSchema>
export type GeminiParseState = z.infer<typeof geminiParseStateSchema>
export type GeminiPatternStat = z.infer<typeof geminiPatternStatSchema>
export type GeminiRuleReloadRequest = z.infer<typeof geminiRuleReloadRequestSchema>
export type GeminiRuleReloadResponse = z.infer<typeof geminiRuleReloadResponseSchema>
