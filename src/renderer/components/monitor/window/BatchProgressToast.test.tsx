import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WindowBatchProgress } from '@shared/schemas/r8-runtime'
import { BatchProgressToast } from './BatchProgressToast'

function createProgress(patch: Partial<WindowBatchProgress> = {}): WindowBatchProgress {
  return {
    jobId: '33333333-3333-4333-8333-333333333333',
    total: 4,
    completed: 2,
    failed: 1,
    state: 'running',
    results: [
      { hwnd: 101, status: 'ok' },
      { hwnd: 102, status: 'failed', error: 'focus failed' }
    ],
    ...patch
  }
}

describe('R8.B BatchProgressToast', () => {
  it('renders running progress and forwards cancel', () => {
    const onCancel = vi.fn()
    render(
      <BatchProgressToast
        actionLabel="批量聚焦"
        progress={createProgress()}
        onCancel={onCancel}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByTestId('window-batch-progress-toast')).toHaveTextContent('批量聚焦')
    expect(screen.getByTestId('window-batch-progress-toast')).toHaveTextContent('2/4')
    expect(screen.getByTestId('window-batch-progress-toast')).toHaveTextContent('成功 1')
    expect(screen.getByTestId('window-batch-result-102')).toHaveTextContent('HWND 102: failed - focus failed')
    expect(screen.getByTestId('window-batch-progress-bar')).toHaveStyle({ width: '50%' })

    fireEvent.click(screen.getByTestId('window-batch-progress-cancel'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables duplicate cancellation while cancel is already requested', () => {
    render(
      <BatchProgressToast
        actionLabel="批量最小化"
        cancelRequested
        progress={createProgress()}
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByTestId('window-batch-progress-toast')).toHaveTextContent('正在取消剩余操作')
    expect(screen.getByTestId('window-batch-progress-cancel')).toBeDisabled()
  })

  it('renders completed progress and forwards dismiss', () => {
    const onDismiss = vi.fn()
    render(
      <BatchProgressToast
        actionLabel="批量恢复"
        progress={createProgress({
          completed: 4,
          failed: 0,
          state: 'completed',
          results: [
            { hwnd: 101, status: 'ok' },
            { hwnd: 102, status: 'ok' },
            { hwnd: 103, status: 'ok' },
            { hwnd: 104, status: 'ok' }
          ]
        })}
        onCancel={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByTestId('window-batch-progress-toast')).toHaveTextContent('已完成')
    expect(screen.getByTestId('window-batch-progress-bar')).toHaveStyle({ width: '100%' })

    fireEvent.click(screen.getByTestId('window-batch-progress-close'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('shows retry for completed failures and forwards retry callback', () => {
    const onRetryFailed = vi.fn()
    render(
      <BatchProgressToast
        actionLabel="批量聚焦"
        progress={createProgress({
          completed: 4,
          failed: 1,
          state: 'completed',
          results: [
            { hwnd: 101, status: 'ok' },
            { hwnd: 102, status: 'failed', error: 'focus failed' },
            { hwnd: 103, status: 'ok' },
            { hwnd: 104, status: 'ok' }
          ]
        })}
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
        onRetryFailed={onRetryFailed}
      />
    )

    fireEvent.click(screen.getByTestId('window-batch-progress-retry-failed'))

    expect(onRetryFailed).toHaveBeenCalledTimes(1)
  })

  it('does not show retry when a completed batch has no failures', () => {
    render(
      <BatchProgressToast
        actionLabel="批量恢复"
        progress={createProgress({
          completed: 4,
          failed: 0,
          state: 'completed',
          results: [
            { hwnd: 101, status: 'ok' },
            { hwnd: 102, status: 'ok' },
            { hwnd: 103, status: 'ok' },
            { hwnd: 104, status: 'ok' }
          ]
        })}
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
        onRetryFailed={vi.fn()}
      />
    )

    expect(screen.queryByTestId('window-batch-progress-retry-failed')).not.toBeInTheDocument()
  })
})
