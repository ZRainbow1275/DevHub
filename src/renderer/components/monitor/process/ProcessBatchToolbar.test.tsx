import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProcessBatchToolbar } from './ProcessBatchToolbar'

describe('R8.B ProcessBatchToolbar', () => {
  it('renders six batch actions and forwards enabled actions', () => {
    const onAction = vi.fn()
    render(
      <ProcessBatchToolbar
        selectedCount={3}
        totalCount={8}
        disabled={false}
        disabledActions={{
          'inject-text': 'not ready',
          'add-watchdog': 'not ready'
        }}
        onAction={onAction}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />
    )

    expect(screen.getByTestId('process-selection-counter')).toHaveTextContent('已选 3 / 8')
    expect(screen.getAllByTestId(/^process-batch-action-/)).toHaveLength(6)

    fireEvent.click(screen.getByTestId('process-batch-action-kill'))
    fireEvent.click(screen.getByTestId('process-batch-action-focus'))
    fireEvent.click(screen.getByTestId('process-batch-action-tag'))
    fireEvent.click(screen.getByTestId('process-batch-action-export-diag'))
    fireEvent.click(screen.getByTestId('process-batch-action-inject-text'))

    expect(onAction).toHaveBeenCalledTimes(4)
    expect(onAction).toHaveBeenNthCalledWith(1, 'kill')
    expect(onAction).toHaveBeenNthCalledWith(2, 'focus')
    expect(onAction).toHaveBeenNthCalledWith(3, 'tag')
    expect(onAction).toHaveBeenNthCalledWith(4, 'export-diag')
  })
})
