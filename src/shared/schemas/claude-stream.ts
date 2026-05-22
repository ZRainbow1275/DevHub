import { z } from 'zod'

export const CLAUDE_STREAM_SCHEMA_VERSION = 1
export const claudeStreamSchemaVersionSchema = z.literal(CLAUDE_STREAM_SCHEMA_VERSION).default(CLAUDE_STREAM_SCHEMA_VERSION)

export const claudeUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative()
}).strict()

export const claudeTextContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string()
}).strict()

export const claudeToolUseContentBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.unknown()
}).strict()

export const claudeToolResultContentBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string().min(1),
  content: z.unknown(),
  is_error: z.boolean().optional()
}).strict()

export const claudeAssistantContentBlockSchema = z.discriminatedUnion('type', [
  claudeTextContentBlockSchema,
  claudeToolUseContentBlockSchema,
  claudeToolResultContentBlockSchema
])

export const claudeSystemStreamEventSchema = z.object({
  schemaVersion: claudeStreamSchemaVersionSchema,
  type: z.literal('system'),
  subtype: z.enum(['init', 'reset']),
  cwd: z.string(),
  session_id: z.string().min(1),
  tools: z.array(z.string()),
  model: z.string().min(1)
}).strict()

export const claudeAssistantStreamEventSchema = z.object({
  schemaVersion: claudeStreamSchemaVersionSchema,
  type: z.literal('assistant'),
  message: z.object({
    id: z.string().min(1),
    role: z.literal('assistant'),
    model: z.string().min(1),
    content: z.array(claudeAssistantContentBlockSchema),
    usage: claudeUsageSchema.optional()
  }).strict(),
  parent_tool_use_id: z.string().nullable().optional()
}).strict()

export const claudeUserStreamEventSchema = z.object({
  schemaVersion: claudeStreamSchemaVersionSchema,
  type: z.literal('user'),
  message: z.object({
    role: z.literal('user'),
    content: z.array(z.unknown())
  }).strict()
}).strict()

export const claudeResultStreamEventSchema = z.object({
  schemaVersion: claudeStreamSchemaVersionSchema,
  type: z.literal('result'),
  subtype: z.enum(['success', 'error_max_turns', 'error_during_execution']),
  is_error: z.boolean(),
  duration_ms: z.number().int().nonnegative(),
  total_cost_usd: z.number().nonnegative(),
  usage: claudeUsageSchema,
  result: z.string().optional()
}).strict()

export const claudePartialAssistantStreamEventSchema = z.object({
  schemaVersion: claudeStreamSchemaVersionSchema,
  type: z.literal('partial_assistant'),
  message: z.object({
    content: z.array(z.unknown())
  }).strict()
}).strict()

export const claudeStreamEventSchema = z.discriminatedUnion('type', [
  claudeSystemStreamEventSchema,
  claudeAssistantStreamEventSchema,
  claudeUserStreamEventSchema,
  claudeResultStreamEventSchema,
  claudePartialAssistantStreamEventSchema
])

export const claudeCostSummaryRequestSchema = z.object({
  instanceId: z.string().min(1)
}).strict()

export const claudeCostSummarySchema = z.object({
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  durationMs: z.number().int().nonnegative()
}).strict()

export const claudeStreamJsonRestartReasonSchema = z.enum(['non-stream-json-output', 'schema-mismatch'])

export const claudeStreamJsonRestartCommandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).max(200),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(600000).default(300000),
  originalPid: z.number().int().positive().nullable().default(null)
}).strict()

export const claudeStreamJsonRestartRequestSchema = z.object({
  instanceId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  detectedLine: z.string().min(1).max(2000),
  command: z.string().min(1),
  args: z.array(z.string()).max(200).default([]),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
  originalPid: z.number().int().positive().nullable().optional(),
  reason: claudeStreamJsonRestartReasonSchema.default('non-stream-json-output')
}).strict()

export const claudeStreamJsonRestartConfirmRequestSchema = z.object({
  requestId: z.string().uuid(),
  confirmedBy: z.string().min(3)
}).strict()

export const claudeStreamJsonRestartStatusSchema = z.enum(['pending-confirmation', 'confirmed', 'running', 'failed', 'exited'])

export const claudeStreamJsonRestartRecordSchema = z.object({
  requestId: z.string().uuid(),
  instanceId: z.string().min(1),
  sessionId: z.string().min(1).nullable(),
  reason: claudeStreamJsonRestartReasonSchema,
  detectedLine: z.string().min(1).max(2000),
  restartCommand: claudeStreamJsonRestartCommandSchema,
  status: claudeStreamJsonRestartStatusSchema,
  actionId: z.string().min(1).max(160),
  notificationId: z.string().uuid().nullable(),
  confirmedBy: z.string().min(3).nullable(),
  createdAt: z.number().int().nonnegative(),
  confirmedAt: z.number().int().nonnegative().nullable(),
  startedAt: z.number().int().nonnegative().nullable(),
  endedAt: z.number().int().nonnegative().nullable(),
  pid: z.number().int().positive().nullable(),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  error: z.string().nullable()
}).strict()

export type ClaudeUsage = z.infer<typeof claudeUsageSchema>
export type ClaudeAssistantContentBlock = z.infer<typeof claudeAssistantContentBlockSchema>
export type ClaudeStreamEvent = z.infer<typeof claudeStreamEventSchema>
export type ClaudeCostSummaryRequest = z.infer<typeof claudeCostSummaryRequestSchema>
export type ClaudeCostSummary = z.infer<typeof claudeCostSummarySchema>
export type ClaudeStreamJsonRestartCommand = z.infer<typeof claudeStreamJsonRestartCommandSchema>
export type ClaudeStreamJsonRestartRequest = z.infer<typeof claudeStreamJsonRestartRequestSchema>
export type ClaudeStreamJsonRestartConfirmRequest = z.infer<typeof claudeStreamJsonRestartConfirmRequestSchema>
export type ClaudeStreamJsonRestartRecord = z.infer<typeof claudeStreamJsonRestartRecordSchema>
