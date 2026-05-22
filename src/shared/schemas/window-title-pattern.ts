import { z } from 'zod'

export const TITLE_RULE_TOOLS = ['cursor', 'copilot'] as const
export const WINDOW_TITLE_SIGNAL_TOOLS = ['cursor', 'copilot', 'unknown'] as const
export const TITLE_PHASES = ['idle', 'thinking', 'editing', 'running', 'completed'] as const
export const WINDOW_TITLE_SIGNAL_PHASES = [...TITLE_PHASES, 'unknown'] as const

const TITLE_REGEX_FLAG_PATTERN = /^[dgimsuvy]*$/
const TITLE_HASH_PATTERN = /^[a-f0-9]{16}$/

export const titleToolSchema = z.enum(TITLE_RULE_TOOLS)
export const windowTitleSignalToolSchema = z.enum(WINDOW_TITLE_SIGNAL_TOOLS)
export const titlePhaseSchema = z.enum(TITLE_PHASES)
export const windowTitleSignalPhaseSchema = z.enum(WINDOW_TITLE_SIGNAL_PHASES)

export const titlePatternRuleSchema = z.object({
  tool: titleToolSchema,
  regex: z.string().min(1),
  flags: z.string().regex(TITLE_REGEX_FLAG_PATTERN).default('i'),
  phase: titlePhaseSchema,
  confidence: z.number().min(0).max(0.7)
}).strict()

export const titleSampleSchema = z.object({
  hwnd: z.number().int(),
  pid: z.number().int(),
  exe: z.string().min(1),
  title: z.string(),
  sampledAt: z.number().int().nonnegative()
}).strict()

export const cursorCopilotSignalSchema = z.object({
  instanceId: z.string().min(1),
  tool: windowTitleSignalToolSchema,
  phase: windowTitleSignalPhaseSchema,
  confidence: z.number().min(0).max(0.7),
  source: z.literal('window-title'),
  rawTitle: z.string(),
  titleHash: z.string().regex(TITLE_HASH_PATTERN),
  hwnd: z.number().int(),
  pid: z.number().int(),
  processName: z.string(),
  ts: z.number().int().nonnegative()
}).strict()

export const cursorCopilotStatusRequestSchema = z.object({
  instanceId: z.string().min(1).optional()
}).strict().optional()

export const cursorCopilotStatusSchema = z.object({
  checkedAt: z.number().int().nonnegative(),
  cursorTasks: z.number().int().nonnegative(),
  copilotTasks: z.number().int().nonnegative(),
  totalAiTasks: z.number().int().nonnegative(),
  phase: windowTitleSignalPhaseSchema,
  confidence: z.number().min(0).max(0.7),
  rawTitle: z.string().nullable(),
  titleHash: z.string().regex(TITLE_HASH_PATTERN).nullable(),
  ts: z.number().int().nonnegative(),
  signals: z.array(cursorCopilotSignalSchema)
}).strict()

export const titleRuleReloadRequestSchema = z.object({
  rules: z.array(titlePatternRuleSchema).min(1),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const titleRuleReloadResponseSchema = z.object({
  success: z.literal(true),
  applied: z.number().int().nonnegative(),
  confirmedBy: z.string().min(3).optional()
}).strict()

export type TitleTool = z.infer<typeof titleToolSchema>
export type WindowTitleSignalTool = z.infer<typeof windowTitleSignalToolSchema>
export type TitlePhase = z.infer<typeof titlePhaseSchema>
export type WindowTitleSignalPhase = z.infer<typeof windowTitleSignalPhaseSchema>
export type TitlePatternRule = z.infer<typeof titlePatternRuleSchema>
export type TitleSample = z.infer<typeof titleSampleSchema>
export type CursorCopilotSignal = z.infer<typeof cursorCopilotSignalSchema>
export type CursorCopilotStatus = z.infer<typeof cursorCopilotStatusSchema>
export type TitleRuleReloadRequest = z.infer<typeof titleRuleReloadRequestSchema>
export type TitleRuleReloadResponse = z.infer<typeof titleRuleReloadResponseSchema>
