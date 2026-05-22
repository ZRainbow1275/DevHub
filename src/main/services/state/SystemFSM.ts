import { createActor, createMachine } from 'xstate'
import type { SystemState } from '@shared/schemas/state-machine'

export type SystemEvent = 'spawned' | 'heartbeat-lost' | 'heartbeat-recovered' | 'watchdog-confirm' | 'process-exit'

export const systemMachine = createMachine({
  id: 'system-fsm',
  initial: 'spawning',
  states: {
    spawning: { on: { spawned: { target: 'alive' }, 'process-exit': { target: 'dead' } } },
    alive: { on: { 'heartbeat-lost': { target: 'zombie' }, 'process-exit': { target: 'dead' } } },
    zombie: { on: { 'heartbeat-recovered': { target: 'alive' }, 'watchdog-confirm': { target: 'dead' }, 'process-exit': { target: 'dead' } } },
    dead: {}
  }
})

export function createSystemActor() {
  const actor = createActor(systemMachine)
  actor.start()
  return actor
}

export function systemStateValue(value: unknown): SystemState {
  return String(value) as SystemState
}
