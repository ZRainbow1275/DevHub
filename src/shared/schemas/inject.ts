import { z } from 'zod'

export const injectToolSchema = z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot'])
export const injectModeSchema = z.enum(['sendinput', 'pty', 'uia', 'clipboard-paste'])
export const injectScenarioSchema = z.enum([
  'csv-task-driven',
  'watchdog-restart-resume',
  'task-chain-next',
  'error-recovery',
  'user-schedule',
  'manual-template'
])
export const injectFailureKindSchema = z.enum([
  'window-not-found',
  'window-iconic',
  'no-focus',
  'input-not-ready',
  'user-stole-focus',
  'ignored',
  'wrong-position',
  'encoding-error',
  'rate-limited',
  'tool-crashed',
  'clipboard-conflict',
  'permission',
  'target-not-found',
  'native-disabled',
  'runtime-error',
  'shim-not-installed'
])
export const injectSelectorKindSchema = z.enum(['alias', 'ready-pool', 'csv-row-alias', 'pid', 'window-handle'])
export const injectTargetSchema = z.object({
  selector: injectSelectorKindSchema.default('alias'),
  aliasOrId: z.string().min(1),
  pid: z.number().int().positive().optional(),
  hwnd: z.number().int().optional(),
  cwd: z.string().min(1).optional(),
  taskId: z.string().min(1).optional()
}).strict()

export const resolvedInjectTargetSchema = injectTargetSchema.extend({
  resolvedPid: z.number().int().positive().nullable().default(null),
  resolvedHwnd: z.number().int().nullable().default(null),
  resolvedAlias: z.string().min(1).nullable().default(null),
  resolvedTool: injectToolSchema.nullable().default(null),
  cwd: z.string().min(1).nullable().default(null),
  ready: z.boolean().default(false),
  lastReadyAt: z.number().int().nonnegative().nullable().default(null)
}).strict()

export const injectWhitelistScopeSchema = z.enum(['instance', 'tool', 'project-cwd'])
export const injectWhitelistDurationSchema = z.enum(['session', '24h', '7d', 'permanent'])
export const injectWhitelistCreatedBySchema = z.enum(['user-explicit', 'first-time-modal', 'csv-mode-auto'])

export const injectWhitelistEntrySchema = z.object({
  id: z.string().uuid(),
  scope: injectWhitelistScopeSchema,
  pattern: z.string().min(1),
  patternHash: z.string().regex(/^[a-f0-9]{64}$/),
  scenarios: z.array(injectScenarioSchema).min(1),
  duration: injectWhitelistDurationSchema,
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative().nullable(),
  createdBy: injectWhitelistCreatedBySchema,
  enabled: z.boolean().default(true),
  reason: z.string().optional(),
  confirmedBy: z.string().nullable().default(null)
}).strict()

export const injectStrictModeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  applyToScenarios: z.array(injectScenarioSchema).default(['manual-template', 'user-schedule']),
  bypassForCsvMode: z.boolean().default(false),
  confirmedBy: z.string().nullable().default(null),
  updatedAt: z.number().int().nonnegative().optional()
}).strict()

export const injectCountdownConfigSchema = z.object({
  defaultMs: z.number().int().min(0).max(30000).default(3000),
  perScenarioMs: z.record(z.string(), z.number().int().min(0).max(30000)).default({}),
  showProgressBar: z.boolean().default(true),
  allowEscToCancel: z.boolean().default(true),
  confirmedBy: z.string().nullable().default(null),
  updatedAt: z.number().int().nonnegative().optional()
}).strict()

export const injectCountdownPhaseSchema = z.enum(['scheduled', 'tick', 'completed', 'cancelled'])

export const injectCountdownStreamPayloadSchema = z.object({
  actionId: z.string().uuid(),
  scenario: injectScenarioSchema,
  targetAlias: z.string().min(1),
  totalMs: z.number().int().min(0).max(30000),
  remainingMs: z.number().int().min(0).max(30000),
  elapsedMs: z.number().int().min(0).max(30000),
  emittedAt: z.number().int().nonnegative(),
  phase: injectCountdownPhaseSchema,
  canCancel: z.boolean()
}).strict()

export const injectCountdownControlRequestSchema = z.object({
  actionId: z.string().uuid(),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const injectResolveTargetInputSchema = z.object({
  selector: injectSelectorKindSchema.default('alias'),
  aliasOrId: z.string().min(1),
  pid: z.number().int().positive().optional(),
  hwnd: z.number().int().optional(),
  cwd: z.string().min(1).optional(),
  scenario: injectScenarioSchema.default('manual-template'),
  taskId: z.string().min(1).optional(),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const injectWhitelistGateSchema = z.enum(['allowed', 'denied-not-listed', 'denied-expired', 'first-time-needed'])
export const injectStrictModeGateSchema = z.enum(['allowed', 'requires-explicit-confirm'])

export const injectResolveTargetResultSchema = z.object({
  ok: z.boolean(),
  target: resolvedInjectTargetSchema.nullable().default(null),
  whitelistGate: injectWhitelistGateSchema,
  strictModeGate: injectStrictModeGateSchema,
  countdownMs: z.number().int().min(0).max(30000),
  reason: z.string().optional(),
  errorCode: z.enum(['E_NOT_FOUND', 'E_VALIDATION', 'E_INJECT_BLOCKED', 'E_PERMISSION_DENIED']).nullable().default(null),
  resolvedAt: z.number().int().nonnegative()
}).strict()

export const injectFirstTimeRequiredPayloadSchema = z.object({
  requestId: z.string().uuid(),
  selector: injectSelectorKindSchema,
  aliasOrId: z.string().min(1),
  pid: z.number().int().positive().nullable().default(null),
  hwnd: z.number().int().nullable().default(null),
  cwd: z.string().min(1).nullable().default(null),
  taskId: z.string().min(1).nullable().default(null),
  scenario: injectScenarioSchema,
  targetAlias: z.string().min(1),
  resolvedTool: injectToolSchema.nullable().default(null),
  reason: z.string().nullable().default(null),
  emittedAt: z.number().int().nonnegative()
}).strict()

export const injectFirstTimeConfirmRequestSchema = z.object({
  requestId: z.string().uuid().optional(),
  selector: injectSelectorKindSchema.default('alias'),
  aliasOrId: z.string().min(1),
  pid: z.number().int().positive().optional(),
  hwnd: z.number().int().optional(),
  cwd: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  scenario: injectScenarioSchema.default('manual-template'),
  scope: injectWhitelistScopeSchema.default('instance'),
  duration: injectWhitelistDurationSchema.default('24h'),
  confirmedBy: z.string().min(3),
  reason: z.string().min(1).default('first-time-confirm-modal')
}).strict()

export const injectFirstTimeConfirmResultSchema = z.object({
  success: z.boolean(),
  entry: injectWhitelistEntrySchema,
  target: resolvedInjectTargetSchema,
  confirmedAt: z.number().int().nonnegative()
}).strict()

export const injectReadyPoolInstanceSchema = resolvedInjectTargetSchema.extend({
  resolvedAlias: z.string().min(1),
  ready: z.literal(true),
  lastReadyAt: z.number().int().nonnegative()
}).strict()

export const injectActionSchemaV2 = z.object({
  id: z.string().uuid().optional(),
  scenario: injectScenarioSchema.default('manual-template'),
  target: injectTargetSchema.optional(),
  targetAlias: z.string().min(1).optional(),
  text: z.string().min(1),
  textHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  textLength: z.number().int().nonnegative().optional(),
  isMetaCommand: z.boolean().default(false),
  mode: injectModeSchema.default('sendinput'),
  modeFallback: z.array(injectModeSchema).default([]),
  dryRun: z.boolean().default(false),
  countdownMs: z.number().int().min(0).max(30000).default(3000),
  strictModeRequiresExplicitConfirm: z.boolean().default(false),
  confirmedBy: z.union([z.enum(['user-explicit', 'auto-policy', 'whitelist', 'csv-mode']), z.string().min(3)]).nullable().optional(),
  taskId: z.string().nullable().default(null),
  sessionId: z.string().uuid().nullable().default(null),
  recordingId: z.string().nullable().default(null)
}).strict().superRefine((value, ctx) => {
  if (!value.target && !value.targetAlias) ctx.addIssue({ code: 'custom', message: 'target or targetAlias is required' })
})

export const normalizedInjectActionSchema = injectActionSchemaV2.safeExtend({
  id: z.string().uuid(),
  target: injectTargetSchema,
  targetAlias: z.string().min(1),
  textHash: z.string().regex(/^[a-f0-9]{64}$/),
  textLength: z.number().int().nonnegative()
}).strict()

export const injectDryRunResultSchema = z.object({
  targetExists: z.boolean(),
  suggestedMode: injectModeSchema,
  suggestedFallback: z.array(injectModeSchema),
  estimatedDurationMs: z.number().int().nonnegative(),
  actionId: z.string().uuid().default('00000000-0000-4000-8000-000000000000'),
  textHash: z.string().regex(/^[a-f0-9]{64}$/),
  chunkCount: z.number().int().positive()
}).strict()

export const injectResultSchemaV2 = z.object({
  actionId: z.string().uuid().default('00000000-0000-4000-8000-000000000000'),
  status: z.enum(['success', 'failed', 'cancelled', 'timeout', 'partial']).default('failed'),
  success: z.boolean(),
  dryRun: z.boolean(),
  targetAlias: z.string().min(1),
  failureKind: injectFailureKindSchema.nullable(),
  error: z.string().nullable(),
  errorMessage: z.string().nullable().default(null),
  modeUsed: z.union([injectModeSchema, z.literal('disabled')]),
  attemptCount: z.number().int().nonnegative().default(0),
  durationMs: z.number().int().nonnegative().default(0),
  characters: z.number().int().nonnegative(),
  injectedLength: z.number().int().nonnegative().default(0),
  verifiedContentMatches: z.boolean().nullable().default(null),
  screenshotPathBefore: z.string().nullable().default(null),
  screenshotPathAfter: z.string().nullable().default(null),
  textHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  chunkCount: z.number().int().positive().optional()
}).strict()

export const injectAuditRecordSchema = z.object({
  auditId: z.string().uuid(),
  actionId: z.string().uuid().default('00000000-0000-4000-8000-000000000000'),
  scenario: injectScenarioSchema,
  targetAlias: z.string().min(1),
  text: z.string(),
  textHash: z.string().regex(/^[a-f0-9]{64}$/),
  textLength: z.number().int().nonnegative(),
  modeRequested: injectModeSchema,
  modeUsed: z.union([injectModeSchema, z.literal('disabled')]),
  status: z.enum(['success', 'failed', 'cancelled', 'timeout', 'partial', 'dry-run']),
  failureKind: injectFailureKindSchema.nullable(),
  verifiedContentMatches: z.boolean().nullable().default(null),
  verificationError: z.string().nullable().default(null),
  screenshotPathBefore: z.string().nullable().default(null),
  screenshotPathAfter: z.string().nullable().default(null),
  createdAt: z.number().int().nonnegative(),
  confirmedBy: z.string().nullable()
}).strict()

export type InjectTool = z.infer<typeof injectToolSchema>
export type InjectMode = z.infer<typeof injectModeSchema>
export type InjectScenario = z.infer<typeof injectScenarioSchema>
export type InjectFailureKind = z.infer<typeof injectFailureKindSchema>
export type InjectSelectorKind = z.infer<typeof injectSelectorKindSchema>
export type InjectTarget = z.infer<typeof injectTargetSchema>
export type ResolvedInjectTarget = z.infer<typeof resolvedInjectTargetSchema>
export type InjectWhitelistScope = z.infer<typeof injectWhitelistScopeSchema>
export type InjectWhitelistDuration = z.infer<typeof injectWhitelistDurationSchema>
export type InjectWhitelistEntry = z.infer<typeof injectWhitelistEntrySchema>
export type InjectStrictModeConfig = z.infer<typeof injectStrictModeConfigSchema>
export type InjectCountdownConfig = z.infer<typeof injectCountdownConfigSchema>
export type InjectCountdownPhase = z.infer<typeof injectCountdownPhaseSchema>
export type InjectCountdownStreamPayload = z.infer<typeof injectCountdownStreamPayloadSchema>
export type InjectCountdownControlRequest = z.infer<typeof injectCountdownControlRequestSchema>
export type InjectResolveTargetInput = z.infer<typeof injectResolveTargetInputSchema>
export type InjectResolveTargetResult = z.infer<typeof injectResolveTargetResultSchema>
export type InjectFirstTimeRequiredPayload = z.infer<typeof injectFirstTimeRequiredPayloadSchema>
export type InjectFirstTimeConfirmRequest = z.infer<typeof injectFirstTimeConfirmRequestSchema>
export type InjectFirstTimeConfirmResult = z.infer<typeof injectFirstTimeConfirmResultSchema>
export type InjectReadyPoolInstance = z.infer<typeof injectReadyPoolInstanceSchema>
export type InjectActionV2 = z.infer<typeof normalizedInjectActionSchema>
export type InjectResultV2 = z.infer<typeof injectResultSchemaV2>
export type InjectAuditRecord = z.infer<typeof injectAuditRecordSchema>
