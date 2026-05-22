import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProcessBatchProgress as ProcessBatchProgressState } from '@shared/schemas/r8-runtime'
import { ProcessBatchProgress } from './ProcessBatchProgress'

function createProgress(patch: Partial<ProcessBatchProgressState> = {}): ProcessBatchProgressState {
  return {
    jobId: '55555555-5555-4555-8555-555555555555',
    total: 3,
    completed: 3,
    failed: 1,
    state: 'completed',
    results: [
      { pid: 101, status: 'ok' },
      { pid: 102, status: 'failed', error: 'E_TEST_FAILURE' },
      { pid: 103, status: 'skipped', error: 'E_TEST_SKIPPED' }
    ],
    ...patch
  }
}

describe('ProcessBatchProgress', () => {
  it('shows retry-failed and close controls only after the batch stops running', () => {
    const onRetryFailed = vi.fn()
    const onDismiss = vi.fn()
    render(
      <ProcessBatchProgress
        onDismiss={onDismiss}
        onRetryFailed={onRetryFailed}
        progress={createProgress()}
      />
    )

    expect(screen.getByTestId('process-batch-progress')).toHaveTextContent('失败 1')
    fireEvent.click(screen.getByTestId('process-batch-retry-failed'))
    fireEvent.click(screen.getByTestId('process-batch-progress-close'))

    expect(onRetryFailed).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not expose retry while a backend job is still running', () => {
    render(
      <ProcessBatchProgress
        onRetryFailed={vi.fn()}
        progress={createProgress({ state: 'running', completed: 1 })}
      />
    )

    expect(screen.queryByTestId('process-batch-retry-failed')).not.toBeInTheDocument()
  })
})
