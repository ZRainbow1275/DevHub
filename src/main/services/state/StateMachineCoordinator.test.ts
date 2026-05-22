import { describe, expect, it } from 'vitest'
import type { SignalContributionSnapshot } from '@shared/schemas/signal-fusion'
import { StateMachineCoordinator } from './StateMachineCoordinator'

function signalSnapshot(instanceId: string, percent: number, confidence: number): SignalContributionSnapshot {
  return {
    instanceId,
    contributions: {
      cli_parse: { weight: 0.8, rawValue: percent, confidence, contributionPct: 1, weightedValue: percent, effectiveWeight: 0.8, decayedConfidence: confidence, ageMs: 0, stale: false },
      window_title: { weight: 0, rawValue: 0, confidence: 0, contributionPct: 0, weightedValue: 0, effectiveWeight: 0, decayedConfidence: 0, ageMs: 0, stale: false },
      process_cpu_io: { weight: 0, rawValue: 0, confidence: 0, contributionPct: 0, weightedValue: 0, effectiveWeight: 0, decayedConfidence: 0, ageMs: 0, stale: false },
      task_queue: { weight: 0, rawValue: 0, confidence: 0, contributionPct: 0, weightedValue: 0, effectiveWeight: 0, decayedConfidence: 0, ageMs: 0, stale: false },
      watchdog: { weight: 0, rawValue: 0, confidence: 0, contributionPct: 0, weightedValue: 0, effectiveWeight: 0, decayedConfidence: 0, ageMs: 0, stale: false },
      user_feedback: { weight: 0, rawValue: 0, confidence: 0, contributionPct: 0, weightedValue: 0, effectiveWeight: 0, decayedConfidence: 0, ageMs: 0, stale: false }
    },
    fusedProgress: { instanceId, percent, source: 'fusion', confidence, observedAt: 1 },
    fusedAt: 1,
    state: percent >= 0.65 ? 'working' : 'thinking',
    profileId: 'default',
    sampleCount: 1,
    warnings: []
  }
}

describe('StateMachineCoordinator', () => {
  it('transitions system spawning to alive through xstate events and records ringbuffer history', () => {
    let now = 1
    const coordinator = new StateMachineCoordinator(() => now++)
    const state = coordinator.transition({ instanceId: 'inst-1', layer: 'system', event: 'spawned', reason: 'process spawned' })

    expect(state.system).toBe('alive')
    expect(state.lastTransitions[0]).toMatchObject({ layer: 'system', fromState: 'spawning', toState: 'alive', trigger: 'spawned' })
  })

  it('records assertion violations and respects user rule overrides', () => {
    let now = 10
    const coordinator = new StateMachineCoordinator(() => now++)
    const dead = coordinator.transition({ instanceId: 'inst-2', layer: 'system', event: 'process-exit', reason: 'real process exit' })

    expect(dead.system).toBe('dead')
    expect(dead.assertionViolations.some(item => item.rule === 'system-dead-implies-task-error' && item.resolvedAt === null)).toBe(true)

    coordinator.overrideRule('system-dead-implies-task-error', false)
    const afterOverride = coordinator.getState('inst-2')
    expect(afterOverride.assertionViolations.some(item => item.rule === 'system-dead-implies-task-error' && item.resolvedAt === null)).toBe(false)
  })

  it('drives task state from spec-27 fused progress snapshots', () => {
    const coordinator = new StateMachineCoordinator(() => 100)
    const thinking = coordinator.applySignal('inst-3', signalSnapshot('inst-3', 0.4, 0.85))
    expect(thinking.task).toBe('thinking')

    const running = coordinator.applySignal('inst-3', signalSnapshot('inst-3', 0.8, 0.9))
    expect(running.task).toBe('running')
    expect(running.lastTransitions[0].signalSnapshot?.topContribution).toBe('cli_parse')
  })

  it('keeps p99 transition latency below the spec budget on deterministic transitions', () => {
    let now = 1_000
    const coordinator = new StateMachineCoordinator(() => now++)
    coordinator.transition({ instanceId: 'perf', layer: 'system', event: 'spawned', reason: 'warmup' })
    const durations: number[] = []

    for (let index = 0; index < 1000; index += 1) {
      const start = performance.now()
      coordinator.transition({ instanceId: 'perf', layer: 'system', event: index % 2 === 0 ? 'heartbeat-lost' : 'heartbeat-recovered', reason: 'p99 benchmark' })
      durations.push(performance.now() - start)
    }

    const p99 = durations.sort((left, right) => left - right)[Math.floor(durations.length * 0.99)]
    expect(p99).toBeLessThan(50)
    expect(coordinator.getState('perf').lastTransitions).toHaveLength(1001)
  })

  it('keeps only the latest 1024 transition events in the ringbuffer', () => {
    let now = 2_000
    const coordinator = new StateMachineCoordinator(() => now++)
    coordinator.transition({ instanceId: 'ringbuffer', layer: 'system', event: 'spawned', reason: 'initial spawn' })

    for (let index = 0; index < 1100; index += 1) {
      coordinator.transition({
        instanceId: 'ringbuffer',
        layer: 'system',
        event: index % 2 === 0 ? 'heartbeat-lost' : 'heartbeat-recovered',
        reason: 'ringbuffer pressure'
      })
    }

    const transitions = coordinator.getState('ringbuffer').lastTransitions
    expect(transitions).toHaveLength(1024)
    expect(transitions[0]).toMatchObject({ trigger: 'heartbeat-recovered' })
    expect(transitions.some(item => item.trigger === 'spawned')).toBe(false)
  })

  it('rejects invalid transitions instead of direct state mutation', () => {
    const coordinator = new StateMachineCoordinator(() => 1)
    expect(() => coordinator.transition({ instanceId: 'inst-4', layer: 'system', event: 'watchdog-confirm', reason: 'invalid direct jump' })).toThrow('E_VALIDATION')
  })
})
