import type { AIMonitorState, AITask, AITaskState } from '@shared/types-extended'

export interface CompletionStateConfig {
  completionThreshold: number
  idleThresholdMs: number
}

export interface MonitorStateInput {
  task: AITask
  isComplete: boolean
  hasPrompt: boolean
  isError: boolean
  isCompilingAction: boolean
}

export interface TaskStateDecision {
  state: AITaskState
  markActivity: boolean
}

export interface StateDebounceCandidate<TState extends string> {
  state: TState
  firstSeenAt: number
  observations: number
}

export interface StateDebounceDecision<TState extends string> {
  state: TState
  pending: StateDebounceCandidate<TState> | null
  accepted: boolean
}

const HUMAN_PROMPT_PATTERNS = /\b(awaiting human|human intervention|waiting for (user|human|approval|confirmation|permission|input)|requires? (approval|confirmation|permission)|press enter|continue\?)\b/i
const RECEIVING_INPUT_PATTERNS = /\b(receiving input|reading stdin|stdin|input stream|prompt received|user input)\b/i
const STUCK_IDLE_MS = 10 * 60 * 1000
const STUCK_CPU_MAX_PERCENT = 1

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

export function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = average(values)
  return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
}

export function deriveMonitorState(input: MonitorStateInput): AIMonitorState {
  const recentCpu = input.task.metrics.cpuHistory.slice(-5)
  const recentAvg = average(recentCpu)
  const cpuVariance = calculateVariance(input.task.metrics.cpuHistory.slice(-10))
  const action = input.task.status.currentAction ?? ''
  const elapsedMs = Math.max(0, Date.now() - input.task.startTime)

  if (input.isError) return 'error'
  if (elapsedMs < 10000 && input.task.status.state === 'running') return 'initializing'
  if (input.isComplete && recentAvg < 5) return 'validating'
  if (HUMAN_PROMPT_PATTERNS.test(action) && recentAvg < 5) return 'awaiting-human'
  if (input.hasPrompt && RECEIVING_INPUT_PATTERNS.test(action)) return 'receiving-input'
  if (input.hasPrompt && recentAvg < 5) return 'waiting-input'
  if (
    input.task.status.state !== 'idle' &&
    input.task.status.state !== 'completed' &&
    input.task.status.state !== 'error' &&
    input.task.metrics.idleDuration >= STUCK_IDLE_MS &&
    recentAvg < STUCK_CPU_MAX_PERCENT
  ) {
    return 'stuck'
  }
  if (input.isCompilingAction && recentAvg > 5) return 'compiling'
  if (recentAvg > 20 && cpuVariance < 5) return 'thinking'
  if (recentAvg > 5 && cpuVariance > 2) return 'coding'
  if (recentAvg < 2 && input.task.metrics.idleDuration > 30000) return 'idle'
  if (recentAvg > 2) return 'thinking'
  return 'idle'
}

export function deriveTaskState(input: {
  task: AITask
  completionScore: number
  isCompilingAction: boolean
  config: CompletionStateConfig
}): TaskStateDecision {
  const recentCpu = input.task.metrics.cpuHistory.slice(-5)
  const recentAvg = average(recentCpu)
  const cpuVariance = calculateVariance(input.task.metrics.cpuHistory.slice(-10))

  if (input.completionScore >= input.config.completionThreshold) {
    return {
      state: input.task.status.state === 'idle' || input.task.status.state === 'completed'
        ? 'waiting'
        : input.task.status.state,
      markActivity: false
    }
  }

  if (input.isCompilingAction && recentAvg > 5) return { state: 'compiling', markActivity: true }
  if (recentAvg > 20 && cpuVariance < 5) return { state: 'thinking', markActivity: true }
  if (recentAvg > 5 && cpuVariance > 2) return { state: 'coding', markActivity: true }
  if (recentAvg > 10) return { state: 'running', markActivity: true }
  if (input.task.metrics.idleDuration > input.config.idleThresholdMs && input.task.metrics.idleDuration < 30000) {
    return { state: 'waiting', markActivity: false }
  }
  if (input.task.metrics.idleDuration > 30000) return { state: 'idle', markActivity: false }
  if (recentAvg > 2) return { state: 'running', markActivity: false }
  return { state: 'waiting', markActivity: false }
}

export function shouldCancelConfirmation(input: {
  recentAverageCpu: number
  cpuThreshold: number
  outputRate: number
  monitorState?: AIMonitorState
}): boolean {
  return input.recentAverageCpu > Math.max(input.cpuThreshold * 2, 5) ||
    input.outputRate >= 500 ||
    input.monitorState === 'receiving-input' ||
    input.monitorState === 'coding' ||
    input.monitorState === 'compiling'
}

export function stabilizeStateTransition<TState extends string>(input: {
  previousState: TState
  candidateState: TState
  now: number
  pending?: StateDebounceCandidate<TState>
  windowMs: number
  minObservations: number
  immediateStates: ReadonlySet<TState>
}): StateDebounceDecision<TState> {
  if (input.candidateState === input.previousState) {
    return { state: input.previousState, pending: null, accepted: true }
  }

  if (input.immediateStates.has(input.candidateState)) {
    return { state: input.candidateState, pending: null, accepted: true }
  }

  if (!input.pending || input.pending.state !== input.candidateState) {
    return {
      state: input.previousState,
      pending: { state: input.candidateState, firstSeenAt: input.now, observations: 1 },
      accepted: false
    }
  }

  const observations = input.pending.observations + 1
  const matured = observations >= input.minObservations || input.now - input.pending.firstSeenAt >= input.windowMs
  if (matured) {
    return { state: input.candidateState, pending: null, accepted: true }
  }

  return {
    state: input.previousState,
    pending: { ...input.pending, observations },
    accepted: false
  }
}

export function classifyMissingProcessExit(input: {
  task: AITask
  completionScore: number
  threshold: number
  isError: boolean
}): 'completed' | 'error' | 'cancelled' {
  if (input.task.status.state === 'error' || input.task.monitorState === 'error' || input.isError) {
    return 'error'
  }

  if (
    input.task.status.state === 'completed' ||
    input.task.monitorState === 'completed' ||
    input.task.monitorState === 'validating' ||
    input.completionScore >= input.threshold
  ) {
    return 'completed'
  }

  return 'cancelled'
}
