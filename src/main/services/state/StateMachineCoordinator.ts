import {
  instanceStateSchema,
  stateTransitionEventSchema,
  type InstanceState,
  type StateLayer,
  type StateAssertionViolation,
  type StateTransitionEvent,
  type SystemState,
  type TaskState,
  type UiState
} from '@shared/schemas/state-machine'
import type { SignalContributionSnapshot } from '@shared/schemas/signal-fusion'
import { createSystemActor, systemStateValue, type SystemEvent } from './SystemFSM'
import { createTaskActor, taskStateValue, type TaskEvent } from './TaskFSM'
import { createUiActor, uiStateValue, type UiEvent } from './UiFSM'
import { evaluateStateAssertions, listStateAssertionRules, type RuleOverrideMap } from './StateAssertion'

const RINGBUFFER_LIMIT = 1024

type SystemActor = ReturnType<typeof createSystemActor>
type TaskActor = ReturnType<typeof createTaskActor>
type UiActor = ReturnType<typeof createUiActor>
type LayerEvent = SystemEvent | TaskEvent | UiEvent

type Runtime = {
  system: SystemActor
  task: TaskActor
  ui: UiActor
  transitions: StateTransitionEvent[]
  violations: InstanceState['assertionViolations']
}

const SYSTEM_EVENTS: Record<SystemState, readonly SystemEvent[]> = {
  spawning: ['spawned', 'process-exit'],
  alive: ['heartbeat-lost', 'process-exit'],
  zombie: ['heartbeat-recovered', 'watchdog-confirm', 'process-exit'],
  dead: []
}

const TASK_EVENTS: Record<TaskState, readonly TaskEvent[]> = {
  idle: ['signal-active', 'tool-use-detected', 'fatal-error'],
  thinking: ['tool-use-detected', 'cli-completion-marker', 'fatal-error', 'reset'],
  running: ['stdin-prompt', 'cli-completion-marker', 'fatal-error', 'reset'],
  'awaiting-input': ['tool-use-detected', 'cli-completion-marker', 'fatal-error', 'reset'],
  completed: ['signal-active', 'reset'],
  error: ['reset']
}

const UI_EVENTS: Record<UiState, readonly UiEvent[]> = {
  hidden: ['dim', 'normalize', 'highlight', 'alert'],
  dim: ['hide', 'normalize', 'highlight', 'alert'],
  normal: ['hide', 'dim', 'highlight', 'alert'],
  highlight: ['hide', 'dim', 'normalize', 'alert'],
  alert: ['hide', 'dim', 'normalize', 'highlight']
}

type SnapshotActor = { getSnapshot: () => { value: unknown } }

function snapshotValue<T extends string>(actor: SnapshotActor, coerce: (value: unknown) => T): T {
  return coerce(actor.getSnapshot().value)
}

function topContribution(snapshot?: SignalContributionSnapshot): string | undefined {
  if (!snapshot) return undefined
  return Object.entries(snapshot.contributions).sort((left, right) => right[1].contributionPct - left[1].contributionPct)[0]?.[0]
}

export class StateMachineCoordinator {
  private readonly runtimes = new Map<string, Runtime>()
  private ruleOverrides: RuleOverrideMap = {}

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly onViolation?: (violation: StateAssertionViolation, state: InstanceState) => void
  ) {}

  getState(instanceId: string): InstanceState {
    const runtime = this.runtimeFor(instanceId)
    return this.stateFor(instanceId, runtime)
  }

  listStates(): InstanceState[] {
    return [...this.runtimes.entries()].map(([instanceId, runtime]) => this.stateFor(instanceId, runtime))
  }

  transition(input: { instanceId: string; layer: StateLayer; event: LayerEvent; reason: string; signalSnapshot?: SignalContributionSnapshot }): InstanceState {
    const runtime = this.runtimeFor(input.instanceId)
    const before = this.layerState(runtime, input.layer)
    this.assertAllowed(runtime, input.layer, input.event)
    this.actorFor(runtime, input.layer).send({ type: input.event })
    const after = this.layerState(runtime, input.layer)
    if (before !== after) {
      const transition = stateTransitionEventSchema.parse({
        instanceId: input.instanceId,
        layer: input.layer,
        fromState: before,
        toState: after,
        trigger: input.event,
        reason: input.reason,
        ts: this.now(),
        signalSnapshot: input.signalSnapshot ? {
          fusedConfidence: input.signalSnapshot.fusedProgress.confidence,
          topContribution: topContribution(input.signalSnapshot) ?? 'none'
        } : undefined
      })
      runtime.transitions = [transition, ...runtime.transitions].slice(0, RINGBUFFER_LIMIT)
    }
    return this.refreshAssertions(input.instanceId, runtime)
  }

  applySignal(instanceId: string, snapshot: SignalContributionSnapshot): InstanceState {
    const current = this.getState(instanceId).task
    if (snapshot.fusedProgress.percent >= 0.65 && (current === 'idle' || current === 'thinking')) {
      return this.transition({ instanceId, layer: 'task', event: 'tool-use-detected', reason: 'spec-27 fused progress crossed running threshold', signalSnapshot: snapshot })
    }
    if (snapshot.fusedProgress.percent > 0.1 && snapshot.fusedProgress.confidence >= 0.5 && (current === 'idle' || current === 'completed')) {
      return this.transition({ instanceId, layer: 'task', event: 'signal-active', reason: 'spec-27 fused progress activated task', signalSnapshot: snapshot })
    }
    return this.getState(instanceId)
  }

  listRules() {
    return listStateAssertionRules(this.ruleOverrides)
  }

  overrideRule(ruleId: string, enabled: boolean): { success: boolean; ruleId: string; enabled: boolean } {
    if (!this.listRules().some(rule => rule.ruleId === ruleId)) throw new Error('E_VALIDATION:unknown state assertion rule')
    this.ruleOverrides = { ...this.ruleOverrides, [ruleId]: enabled }
    for (const [instanceId, runtime] of this.runtimes) this.refreshAssertions(instanceId, runtime)
    return { success: true, ruleId, enabled }
  }

  private runtimeFor(instanceId: string): Runtime {
    const key = instanceId.trim()
    if (!key) throw new Error('E_VALIDATION:instanceId required')
    const existing = this.runtimes.get(key)
    if (existing) return existing
    const runtime = { system: createSystemActor(), task: createTaskActor(), ui: createUiActor(), transitions: [], violations: [] }
    this.runtimes.set(key, runtime)
    return runtime
  }

  private stateFor(instanceId: string, runtime: Runtime): InstanceState {
    return instanceStateSchema.parse({
      instanceId,
      system: snapshotValue(runtime.system, systemStateValue),
      task: snapshotValue(runtime.task, taskStateValue),
      ui: snapshotValue(runtime.ui, uiStateValue),
      lastTransitions: runtime.transitions,
      assertionViolations: runtime.violations,
      updatedAt: this.now()
    })
  }

  private refreshAssertions(instanceId: string, runtime: Runtime): InstanceState {
    const previousOpenRules = new Set(runtime.violations.filter(violation => violation.resolvedAt === null).map(violation => violation.rule))
    const state = this.stateFor(instanceId, runtime)
    runtime.violations = evaluateStateAssertions(state, this.ruleOverrides, this.now())
    const refreshed = this.stateFor(instanceId, runtime)
    if (this.onViolation) {
      for (const violation of refreshed.assertionViolations) {
        if (violation.resolvedAt === null && !previousOpenRules.has(violation.rule)) this.onViolation(violation, refreshed)
      }
    }
    return refreshed
  }

  private actorFor(runtime: Runtime, layer: StateLayer) {
    if (layer === 'system') return runtime.system
    if (layer === 'task') return runtime.task
    return runtime.ui
  }

  private layerState(runtime: Runtime, layer: StateLayer): string {
    if (layer === 'system') return snapshotValue(runtime.system, systemStateValue)
    if (layer === 'task') return snapshotValue(runtime.task, taskStateValue)
    return snapshotValue(runtime.ui, uiStateValue)
  }

  private assertAllowed(runtime: Runtime, layer: StateLayer, event: LayerEvent): void {
    if (layer === 'system' && !SYSTEM_EVENTS[snapshotValue(runtime.system, systemStateValue)].includes(event as SystemEvent)) {
      throw new Error('E_VALIDATION:invalid system transition')
    }
    if (layer === 'task' && !TASK_EVENTS[snapshotValue(runtime.task, taskStateValue)].includes(event as TaskEvent)) {
      throw new Error('E_VALIDATION:invalid task transition')
    }
    if (layer === 'ui' && !UI_EVENTS[snapshotValue(runtime.ui, uiStateValue)].includes(event as UiEvent)) {
      throw new Error('E_VALIDATION:invalid ui transition')
    }
  }
}
