import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProcessBatchTagDialog } from './ProcessBatchTagDialog'

describe('R8.B ProcessBatchTagDialog', () => {
  it('collects tag arguments for the selected real process identities', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ProcessBatchTagDialog
        selectedCount={3}
        onSave={onSave}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTestId('process-batch-tag-dialog')).toHaveTextContent('将标签写入 3 个已选进程')

    fireEvent.change(screen.getByLabelText('标签'), { target: { value: 'devhub-batch' } })
    fireEvent.click(screen.getByLabelText('选择 warning'))
    fireEvent.click(screen.getByLabelText('同步加入收藏关联'))
    fireEvent.click(screen.getByRole('button', { name: '应用到 3 个进程' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('devhub-batch', 'warning', true)
    })
  })
})
