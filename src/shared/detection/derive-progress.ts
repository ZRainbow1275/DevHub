import type { AIMonitorState, AITaskPhase, AITaskState } from '@shared/types-extended'

export type DerivableProgressState = AIMonitorState | 'initializing'

export type DerivedProgressMode = 'hidden' | 'indeterminate' | 'determinate'
export type DerivedProgressPhase =
  | 'initializing'
  | 'thinking'
  | 'coding'
  | 'compiling'
  | 'validating'
  | 'done'
  | 'failed'
  | 'stuck'

export interface DerivedProgress {
  mode: DerivedProgressMode
  percentage?: number
  confidenceRange?: ProgressConfidenceRange
  label: string
  phase: DerivedProgressPhase
  accentColor: 'neutral' | 'info' | 'active' | 'success' | 'warning' | 'error'
  confidence?: number
}

export interface ProgressConfidenceRange {
  min: number
  max: number
  label: string
}

export interface DeriveProgressContext {
  elapsedMs?: number
  estimatedTotalMs?: number
  confidence?: number
  explicitPercentage?: number
}

export function toDerivableProgressState(
  state: AITaskState,
  phase?: AITaskPhase,
  monitorState?: AIMonitorState,
): DerivableProgressState {
  if (monitorState) {
    return monitorState
  }

  switch (state) {
    case 'idle':
    case 'thinking':
    case 'coding':
    case 'compiling':
    case 'completed':
    case 'error':
      return state
    case 'waiting':
      return 'waiting-input'
    case 'running':
      switch (phase) {
        case 'initializing':
          return 'initializing'
        case 'thinking':
          return 'thinking'
        case 'validating':
          return 'validating'
        case 'completed':
          return 'completed'
        case 'error':
          return 'error'
        default:
          return 'coding'
      }
  }
}

export function deriveProgress(
  state: DerivableProgressState,
  ctx: DeriveProgressContext = {},
): DerivedProgress {
  const elapsedMs = normalizeNonNegative(ctx.elapsedMs)
  const estimatedTotalMs = normalizePositive(ctx.estimatedTotalMs)
  const confidence = normalizeConfidence(ctx.confidence)
  const explicitPercentage = normalizePercentage(ctx.explicitPercentage)

  switch (state) {
    case 'idle':
      return { mode: 'hidden', label: '空闲', phase: 'done', accentColor: 'neutral' }
    case 'initializing':
      {
        const percentage = clamp(5 + elapsedMs / 200, 5, 15)
        return {
          mode: 'determinate',
          percentage,
          confidenceRange: buildProgressConfidenceRange(percentage, confidence),
          label: '初始化',
          phase: 'initializing',
          accentColor: 'info',
          confidence,
        }
      }
    case 'thinking':
      return {
        mode: 'indeterminate',
        label: '思考中',
        phase: 'thinking',
        accentColor: 'active',
        confidence,
      }
    case 'receiving-input':
      return {
        mode: 'indeterminate',
        label: '接收输入',
        phase: 'thinking',
        accentColor: 'info',
        confidence,
      }
    case 'coding': {
      const extraFromTime = estimatedTotalMs
        ? Math.min(35, (elapsedMs / estimatedTotalMs) * 35)
        : 20
      const percentage = explicitPercentage ?? clamp(40 + extraFromTime, 40, 75)
      return {
        mode: 'determinate',
        percentage,
        confidenceRange: buildProgressConfidenceRange(percentage, confidence),
        label: '编码中',
        phase: 'coding',
        accentColor: 'active',
        confidence,
      }
    }
    case 'compiling':
      return {
        mode: 'determinate',
        percentage: 78,
        confidenceRange: buildProgressConfidenceRange(78, confidence),
        label: '编译中',
        phase: 'compiling',
        accentColor: 'active',
        confidence,
      }
    case 'validating':
      return {
        mode: 'determinate',
        percentage: 92,
        confidenceRange: buildProgressConfidenceRange(92, confidence),
        label: '确认中',
        phase: 'validating',
        accentColor: 'info',
        confidence,
      }
    case 'waiting-input':
      return {
        mode: 'determinate',
        percentage: 98,
        confidenceRange: buildProgressConfidenceRange(98, confidence),
        label: '等待输入',
        phase: 'validating',
        accentColor: 'warning',
        confidence,
      }
    case 'awaiting-human':
      return {
        mode: 'determinate',
        percentage: 98,
        confidenceRange: buildProgressConfidenceRange(98, confidence),
        label: '等待人工',
        phase: 'validating',
        accentColor: 'warning',
        confidence,
      }
    case 'stuck':
      return {
        mode: 'determinate',
        percentage: 99,
        confidenceRange: buildProgressConfidenceRange(99, confidence),
        label: '疑似卡死',
        phase: 'stuck',
        accentColor: 'warning',
        confidence,
      }
    case 'completed':
      return {
        mode: 'determinate',
        percentage: 100,
        confidenceRange: buildProgressConfidenceRange(100, confidence),
        label: '已完成',
        phase: 'done',
        accentColor: 'success',
        confidence,
      }
    case 'error':
      return {
        mode: 'determinate',
        percentage: 100,
        confidenceRange: buildProgressConfidenceRange(100, confidence),
        label: '出错',
        phase: 'failed',
        accentColor: 'error',
        confidence,
      }
  }
}

export function assertProgressInvariant(
  state: DerivableProgressState,
  progress: DerivedProgress,
): void {
  if (state === 'idle') {
    if (progress.mode !== 'hidden') {
      throw new Error(`INVARIANT: idle state must have hidden progress, got ${progress.mode}`)
    }
    if (progress.percentage != null) {
      throw new Error(`INVARIANT: idle state must not expose percentage, got ${progress.percentage}`)
    }
  }

  if (state === 'thinking' || state === 'receiving-input') {
    if (progress.mode !== 'indeterminate') {
      throw new Error(`INVARIANT: ${state} must be indeterminate`)
    }
    if (progress.percentage != null) {
      throw new Error(`INVARIANT: ${state} must not expose percentage, got ${progress.percentage}`)
    }
  }

  if (state === 'coding') {
    if (progress.mode !== 'determinate') {
      throw new Error(`INVARIANT: coding must be determinate, got ${progress.mode}`)
    }
    if (progress.percentage == null || progress.percentage < 0 || progress.percentage > 99) {
      throw new Error(`INVARIANT: coding must be within 0..99, got ${progress.percentage}`)
    }
  }

  if (state === 'validating') {
    if (progress.mode !== 'determinate' || progress.percentage !== 92) {
      throw new Error(`INVARIANT: validating must be determinate 92, got ${progress.mode}:${progress.percentage}`)
    }
  }

  if (state === 'waiting-input' || state === 'awaiting-human') {
    if (progress.mode !== 'determinate' || progress.percentage !== 98) {
      throw new Error(`INVARIANT: ${state} must be determinate 98, got ${progress.mode}:${progress.percentage}`)
    }
  }

  if (state === 'stuck') {
    if (progress.mode !== 'determinate' || progress.percentage !== 99) {
      throw new Error(`INVARIANT: stuck must be determinate 99, got ${progress.mode}:${progress.percentage}`)
    }
  }

  if (state === 'completed' || state === 'error') {
    if (progress.mode !== 'determinate' || progress.percentage !== 100) {
      throw new Error(`INVARIANT: ${state} must be determinate 100, got ${progress.mode}:${progress.percentage}`)
    }
  }

  if (progress.mode !== 'determinate' && progress.percentage != null) {
    throw new Error(`INVARIANT: ${progress.mode} progress must not expose percentage, got ${progress.percentage}`)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeNonNegative(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0
  }
  return value
}

function normalizePositive(value?: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return value
}

function normalizePercentage(value?: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return Math.round(clamp(value, 0, 99))
}

function normalizeConfidence(value?: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return clamp(value, 0, 1)
}

export function buildProgressConfidenceRange(percentage: number, confidence?: number): ProgressConfidenceRange | undefined {
  const normalizedConfidence = normalizeConfidence(confidence)
  if (normalizedConfidence === undefined) return undefined

  const normalizedPercentage = Math.round(clamp(percentage, 0, 100))
  const radius = normalizedConfidence >= 0.9
    ? 3
    : normalizedConfidence >= 0.7
      ? 5
      : normalizedConfidence >= 0.5
        ? 8
        : 12
  const min = Math.max(0, normalizedPercentage - radius)
  const max = Math.min(100, normalizedPercentage + radius)
  if (min === max) return undefined
  return { min, max, label: `约 ${min}%-${max}%` }
}
