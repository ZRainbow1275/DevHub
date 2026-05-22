import { z } from 'zod'

export const toolNameSchema = z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot'])
export const toolDetectStrategySchema = z.enum([
  'path',
  'path-env',
  'where',
  'known-path',
  'user-override',
  'module-list',
  'not-found'
])
export const toolRecommendedParserSchema = z.enum([
  'ndjson',
  'shim',
  'line',
  'sse',
  'window-title',
  'stream-json',
  'stdout',
  'title'
])
export const toolCapabilitySchema = z.enum([
  'stream-json',
  'json-flag',
  'marker',
  'window-only',
  'resume',
  'exec',
  'print',
  'mcp',
  'permissions',
  'prompt',
  'window-title-detect',
  'gh-copilot'
])

export const toolDetectResultSchema = z.object({
  tool: toolNameSchema,
  found: z.boolean(),
  version: z.string().nullable(),
  path: z.string().nullable(),
  detectStrategy: toolDetectStrategySchema,
  recommendedParser: toolRecommendedParserSchema.nullable(),
  capabilities: z.array(toolCapabilitySchema),
  errors: z.array(z.string()).default([]),
  error: z.string().nullable().default(null),
  checkedAt: z.number().int().nonnegative(),
  detectedAt: z.number().int().nonnegative().optional()
}).strict().transform(result => ({
  ...result,
  detectedAt: result.detectedAt ?? result.checkedAt
}))

export const toolDetectionStateSchema = z.object({
  results: z.array(toolDetectResultSchema).length(5),
  lastFullScanAt: z.number().int().nonnegative(),
  scanDurationMs: z.number().int().nonnegative(),
  errors: z.array(z.string()).default([])
}).strict()

export const toolDetectAllRequestSchema = z.object({
  force: z.boolean().optional()
}).strict().optional()

export const toolDetectOneRequestSchema = z.object({
  tool: toolNameSchema,
  force: z.boolean().optional()
}).strict()

export const toolOverrideRequestSchema = z.object({
  tool: toolNameSchema,
  path: z.string().min(1),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const toolOverrideResponseSchema = z.object({
  tool: toolNameSchema,
  path: z.string().min(1),
  version: z.string().nullable().optional()
}).strict()

export const toolClearOverrideRequestSchema = z.object({
  tool: toolNameSchema,
  confirmedBy: z.string().min(3).optional()
}).strict()

export const toolClearOverrideResponseSchema = z.object({
  tool: toolNameSchema,
  cleared: z.boolean(),
  previousPath: z.string().min(1).nullable()
}).strict()

export type ToolName = z.infer<typeof toolNameSchema>
export type ToolDetectStrategy = z.infer<typeof toolDetectStrategySchema>
export type ToolRecommendedParser = z.infer<typeof toolRecommendedParserSchema>
export type ToolCapability = z.infer<typeof toolCapabilitySchema>
export type ToolDetectResult = z.infer<typeof toolDetectResultSchema>
export type ToolDetectionState = z.infer<typeof toolDetectionStateSchema>
export type ToolDetectAllRequest = z.infer<typeof toolDetectAllRequestSchema>
export type ToolDetectOneRequest = z.infer<typeof toolDetectOneRequestSchema>
export type ToolOverrideRequest = z.infer<typeof toolOverrideRequestSchema>
export type ToolOverrideResponse = z.infer<typeof toolOverrideResponseSchema>
export type ToolClearOverrideRequest = z.infer<typeof toolClearOverrideRequestSchema>
export type ToolClearOverrideResponse = z.infer<typeof toolClearOverrideResponseSchema>
