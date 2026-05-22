import type { CSSProperties } from 'react'

import {
  assertProgressInvariant,
  type DerivableProgressState,
  type DerivedProgress,
} from '@shared/detection/derive-progress'

const PROGRESS_BAR_CLASS: Record<DerivedProgress['accentColor'], string> = {
  neutral: 'bg-surface-700',
  info: 'bg-info',
  active: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
}

export interface ProgressBarProps {
  derived: DerivedProgress
  state: DerivableProgressState
  estimatedRemainingLabel?: string
  fillStyle?: CSSProperties
}

export function ProgressBar({
  derived,
  state,
  estimatedRemainingLabel,
  fillStyle,
}: ProgressBarProps) {
  assertProgressInvariant(state, derived)

  if (derived.mode === 'hidden') {
    return (
      <div
        data-testid="ai-progress-bar"
        data-progress-mode="hidden"
        data-progress-pct=""
        style={{ display: 'none' }}
      />
    )
  }

  const progressBarClass = PROGRESS_BAR_CLASS[derived.accentColor]
  const isDeterminate = derived.mode === 'determinate' && derived.percentage != null
  const progressLabel = isDeterminate
    ? derived.confidenceRange?.label ?? `${derived.percentage}%`
    : derived.label
  const progressValueAttributes = isDeterminate
    ? {
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': derived.percentage,
      }
    : {}

  return (
    <div
      className="mt-3 space-y-1.5"
      data-testid="ai-progress-bar"
      data-progress-mode={derived.mode}
      data-progress-pct={derived.percentage ?? ''}
      data-progress-confidence-range={derived.confidenceRange?.label ?? ''}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary font-medium">
          {derived.label}
        </span>
        <div className="flex items-center gap-2">
          {isDeterminate && (
            <span className="text-text-muted font-mono">
              {progressLabel}
            </span>
          )}
          {estimatedRemainingLabel && (
            <span className="text-text-tertiary">
              {estimatedRemainingLabel}
            </span>
          )}
        </div>
      </div>
      <div
        aria-label={derived.label}
        aria-valuetext={progressLabel}
        className="progress-bar h-1.5 bg-surface-700 rounded-full overflow-hidden"
        role="progressbar"
        {...progressValueAttributes}
      >
        {derived.mode === 'indeterminate' ? (
          <div
            className={`ai-progress-indeterminate-fill h-full w-1/2 rounded-full ${progressBarClass}`}
            style={fillStyle}
          />
        ) : (
          <div
            className={`progress-bar-fill h-full rounded-full transition-all duration-300 ease-out ${progressBarClass}`}
            style={{
              width: `${derived.percentage ?? 0}%`,
              ...fillStyle,
            }}
          />
        )}
      </div>
    </div>
  )
}
