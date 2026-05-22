import { createActor, createMachine } from 'xstate'
import type { UiState } from '@shared/schemas/state-machine'

export type UiEvent = 'hide' | 'dim' | 'normalize' | 'highlight' | 'alert'

export const uiMachine = createMachine({
  id: 'ui-fsm',
  initial: 'hidden',
  states: {
    hidden: { on: { dim: { target: 'dim' }, normalize: { target: 'normal' }, highlight: { target: 'highlight' }, alert: { target: 'alert' } } },
    dim: { on: { hide: { target: 'hidden' }, normalize: { target: 'normal' }, highlight: { target: 'highlight' }, alert: { target: 'alert' } } },
    normal: { on: { hide: { target: 'hidden' }, dim: { target: 'dim' }, highlight: { target: 'highlight' }, alert: { target: 'alert' } } },
    highlight: { on: { hide: { target: 'hidden' }, dim: { target: 'dim' }, normalize: { target: 'normal' }, alert: { target: 'alert' } } },
    alert: { on: { hide: { target: 'hidden' }, dim: { target: 'dim' }, normalize: { target: 'normal' }, highlight: { target: 'highlight' } } }
  }
})

export function createUiActor() {
  const actor = createActor(uiMachine)
  actor.start()
  return actor
}

export function uiStateValue(value: unknown): UiState {
  return String(value) as UiState
}
