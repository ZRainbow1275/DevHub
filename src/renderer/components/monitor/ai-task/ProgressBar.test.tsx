import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { DerivedProgress } from '@shared/detection/derive-progress'

import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('hides idle progress and does not expose a progressbar role', () => {
    const derived: DerivedProgress = {
      mode: 'hidden',
      label: '空闲',
      phase: 'done',
      accentColor: 'neutral',
    }

    render(<ProgressBar derived={derived} state="idle" />)

    expect(screen.getByTestId('ai-progress-bar')).toHaveStyle({ display: 'none' })
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders indeterminate progress without aria-valuenow or a percentage label', () => {
    const derived: DerivedProgress = {
      mode: 'indeterminate',
      label: '思考中',
      phase: 'thinking',
      accentColor: 'active',
    }

    render(<ProgressBar derived={derived} state="thinking" />)

    const progressbar = screen.getByRole('progressbar', { name: '思考中' })
    expect(progressbar).not.toHaveAttribute('aria-valuenow')
    expect(progressbar).toHaveAttribute('aria-valuetext', '思考中')
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.getByTestId('ai-progress-bar')).toHaveAttribute('data-progress-mode', 'indeterminate')
  })

  it('renders determinate progress with aria-valuenow and percentage text', () => {
    const derived: DerivedProgress = {
      mode: 'determinate',
      percentage: 60,
      label: '编码中',
      phase: 'coding',
      accentColor: 'active',
    }

    render(
      <ProgressBar
        derived={derived}
        estimatedRemainingLabel="~1m"
        state="coding"
      />,
    )

    const progressbar = screen.getByRole('progressbar', { name: '编码中' })
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '100')
    expect(progressbar).toHaveAttribute('aria-valuenow', '60')
    expect(progressbar).toHaveAttribute('aria-valuetext', '60%')
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('~1m')).toBeInTheDocument()
    expect(screen.getByTestId('ai-progress-bar')).toHaveAttribute('data-progress-pct', '60')
  })

  it('renders a confidence interval label while keeping exact aria-valuenow', () => {
    const derived: DerivedProgress = {
      mode: 'determinate',
      percentage: 47,
      confidenceRange: { min: 40, max: 54, label: '约 40%-54%' },
      label: '编码中',
      phase: 'coding',
      accentColor: 'active',
      confidence: 0.6,
    }

    render(<ProgressBar derived={derived} state="coding" />)

    const progressbar = screen.getByRole('progressbar', { name: '编码中' })
    expect(progressbar).toHaveAttribute('aria-valuenow', '47')
    expect(progressbar).toHaveAttribute('aria-valuetext', '约 40%-54%')
    expect(screen.getByText('约 40%-54%')).toBeInTheDocument()
    expect(screen.getByTestId('ai-progress-bar')).toHaveAttribute('data-progress-confidence-range', '约 40%-54%')
  })
})
