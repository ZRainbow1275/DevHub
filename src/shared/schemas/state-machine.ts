import { z } from 'zod'

export const systemStateSchema = z.enum(['spawning', 'alive', 'zombie', 'dead'])
export const taskStateSchema = z.enum(['idle', 'thinking', 'running', 'awaiting-input', 'completed', 'error'])
export const uiStateSchema = z.enum(['hidden', 'dim', 'normal', 'highlight', 'alert'])
export const stateLayerSchema = z.enum(['system', 'task', 'ui'])
export const assertionSeveritySchema = z.enum(['warn', 'error', 'fatal'])
export const assertionActionSchema = z.enum(['log', 'notify', 'invalidate-and-recompute'])

export type SystemState = z.infer<typeof systemStateSchema>
export type TaskState = z.infer<typeof taskStateSchema>
export type UiState = z.infer<typeof uiStateSchema>
export type StateLayer = z.infer<typeof stateLayerSchema>

export const stateTransitionEventSchema = z.object({
  instanceId: z.string().min(1),
  layer: stateLayerSchema,
  fromState: z.string().min(1),
  toState: z.string().min(1),
  trigger: z.string().min(1),
  reason: z.string().min(1),
  ts: z.number().int().nonnegative(),
  signalSnapshot: z.object({
    fusedConfidence: z.number().min(0).max(1),
    topContribution: z.string().min(1)
  }).optional()
})
export type StateTransitionEvent = z.infer<typeof stateTransitionEventSchema>

export const stateAssertionViolationSchema = z.object({
  rule: z.string().min(1),
  detectedAt: z.number().int().nonnegative(),
  resolvedAt: z.number().int().nonnegative().nullable()
})
export type StateAssertionViolation = z.infer<typeof stateAssertionViolationSchema>

export const instanceStateSchema = z.object({
  instanceId: z.string().min(1),
  system: systemStateSchema,
  task: taskStateSchema,
  ui: uiStateSchema,
  lastTransitions: z.array(stateTransitionEventSchema).max(1024),
  assertionViolations: z.array(stateAssertionViolationSchema),
  updatedAt: z.number().int().nonnegative()
})
export type InstanceState = z.infer<typeof instanceStateSchema>

export const stateAssertionRuleSchema = z.object({
  ruleId: z.string().min(1),
  description: z.string().min(1),
  predicate: z.string().min(1),
  severity: assertionSeveritySchema,
  onViolate: assertionActionSchema,
  enabled: z.boolean().default(true)
})
export type StateAssertionRule = z.infer<typeof stateAssertionRuleSchema>

export const stateRuleOverrideRequestSchema = z.object({
  ruleId: z.string().min(1),
  enabled: z.boolean(),
  confirmedBy: z.string().min(3).optional()
})
export type StateRuleOverrideRequest = z.infer<typeof stateRuleOverrideRequestSchema>
