import { createActor, createMachine } from 'xstate'
import type { TaskState } from '@shared/schemas/state-machine'

export type TaskEvent = 'signal-active' | 'tool-use-detected' | 'stdin-prompt' | 'cli-completion-marker' | 'fatal-error' | 'reset'

export const taskMachine = createMachine({
  id: 'task-fsm',
  initial: 'idle',
  states: {
    idle: { on: { 'signal-active': { target: 'thinking' }, 'tool-use-detected': { target: 'running' }, 'fatal-error': { target: 'error' } } },
    thinking: { on: { 'tool-use-detected': { target: 'running' }, 'cli-completion-marker': { target: 'completed' }, 'fatal-error': { target: 'error' }, reset: { target: 'idle' } } },
    running: { on: { 'stdin-prompt': { target: 'awaiting-input' }, 'cli-completion-marker': { target: 'completed' }, 'fatal-error': { target: 'error' }, reset: { target: 'idle' } } },
    'awaiting-input': { on: { 'tool-use-detected': { target: 'running' }, 'cli-completion-marker': { target: 'completed' }, 'fatal-error': { target: 'error' }, reset: { target: 'idle' } } },
    completed: { on: { 'signal-active': { target: 'thinking' }, reset: { target: 'idle' } } },
    error: { on: { reset: { target: 'idle' } } }
  }
})

export function createTaskActor() {
  const actor = createActor(taskMachine)
  actor.start()
  return actor
}

export function taskStateValue(value: unknown): TaskState {
  return String(value) as TaskState
}
