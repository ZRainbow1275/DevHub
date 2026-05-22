import {
  stateAssertionRuleSchema,
  type InstanceState,
  type StateAssertionRule,
  type StateAssertionViolation
} from '@shared/schemas/state-machine'

export const BUILTIN_STATE_ASSERTION_RULES: StateAssertionRule[] = [
  stateAssertionRuleSchema.parse({ ruleId: 'system-dead-implies-task-error', description: 'system=dead requires task=error', predicate: 'system === dead -> task === error', severity: 'error', onViolate: 'invalidate-and-recompute', enabled: true }),
  stateAssertionRuleSchema.parse({ ruleId: 'system-dead-implies-ui-alert', description: 'system=dead requires ui=alert', predicate: 'system === dead -> ui === alert', severity: 'error', onViolate: 'notify', enabled: true }),
  stateAssertionRuleSchema.parse({ ruleId: 'system-zombie-implies-ui-alert', description: 'system=zombie requires ui=alert', predicate: 'system === zombie -> ui === alert', severity: 'warn', onViolate: 'notify', enabled: true }),
  stateAssertionRuleSchema.parse({ ruleId: 'task-error-implies-ui-alert', description: 'task=error requires ui=alert', predicate: 'task === error -> ui === alert', severity: 'error', onViolate: 'notify', enabled: true }),
  stateAssertionRuleSchema.parse({ ruleId: 'task-awaiting-input-implies-ui-highlight', description: 'awaiting input should highlight UI', predicate: 'task === awaiting-input -> ui === highlight', severity: 'warn', onViolate: 'log', enabled: true }),
  stateAssertionRuleSchema.parse({ ruleId: 'task-running-implies-visible-ui', description: 'running task should not be hidden', predicate: 'task === running -> ui !== hidden', severity: 'warn', onViolate: 'log', enabled: true }),
  stateAssertionRuleSchema.parse({ ruleId: 'task-completed-not-alert-unless-system-bad', description: 'completed task should not alert when system is alive', predicate: 'task === completed && system === alive -> ui !== alert', severity: 'warn', onViolate: 'log', enabled: true }),
  stateAssertionRuleSchema.parse({ ruleId: 'system-alive-ui-alert-needs-task-error', description: 'alert UI on alive system should correspond to task error or awaiting input', predicate: 'system === alive && ui === alert -> task in [error, awaiting-input]', severity: 'warn', onViolate: 'log', enabled: true })
]

export type RuleOverrideMap = Record<string, boolean>

function violates(ruleId: string, state: InstanceState): boolean {
  switch (ruleId) {
    case 'system-dead-implies-task-error': return state.system === 'dead' && state.task !== 'error'
    case 'system-dead-implies-ui-alert': return state.system === 'dead' && state.ui !== 'alert'
    case 'system-zombie-implies-ui-alert': return state.system === 'zombie' && state.ui !== 'alert'
    case 'task-error-implies-ui-alert': return state.task === 'error' && state.ui !== 'alert'
    case 'task-awaiting-input-implies-ui-highlight': return state.task === 'awaiting-input' && state.ui !== 'highlight'
    case 'task-running-implies-visible-ui': return state.task === 'running' && state.ui === 'hidden'
    case 'task-completed-not-alert-unless-system-bad': return state.task === 'completed' && state.system === 'alive' && state.ui === 'alert'
    case 'system-alive-ui-alert-needs-task-error': return state.system === 'alive' && state.ui === 'alert' && state.task !== 'error' && state.task !== 'awaiting-input'
    default: return false
  }
}

export function listStateAssertionRules(overrides: RuleOverrideMap = {}): StateAssertionRule[] {
  return BUILTIN_STATE_ASSERTION_RULES.map(rule => ({ ...rule, enabled: overrides[rule.ruleId] ?? rule.enabled }))
}

export function evaluateStateAssertions(state: InstanceState, overrides: RuleOverrideMap, now: number): StateAssertionViolation[] {
  const existing = new Map(state.assertionViolations.map(violation => [violation.rule, violation]))
  for (const rule of listStateAssertionRules(overrides)) {
    const current = existing.get(rule.ruleId)
    if (!rule.enabled || !violates(rule.ruleId, state)) {
      if (current && current.resolvedAt === null) existing.set(rule.ruleId, { ...current, resolvedAt: now })
      continue
    }
    if (!current || current.resolvedAt !== null) {
      existing.set(rule.ruleId, { rule: rule.ruleId, detectedAt: now, resolvedAt: null })
    }
  }
  return Array.from(existing.values()).sort((left, right) => right.detectedAt - left.detectedAt)
}
