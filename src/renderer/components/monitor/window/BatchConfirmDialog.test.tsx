import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BatchConfirmDialog } from './BatchConfirmDialog'

describe('R8.B BatchConfirmDialog', () => {
  it('renders close confirmation with target summary and confirms', () => {
    const onConfirm = vi.fn()
    render(
      <BatchConfirmDialog
        confirmText="关闭窗口"
        isOpen
        kind="close"
        message="将关闭 6 个真实窗口。"
        targetSummary="HWND 1, 2, 3, 4, 5, 6"
        title="确认批量关闭"
        variant="danger"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByTestId('window-batch-confirm-dialog')).toHaveAttribute('data-confirm-kind', 'close')
    expect(screen.getByTestId('window-batch-confirm-dialog')).toHaveTextContent('确认批量关闭')
    expect(screen.getByTestId('window-batch-confirm-dialog')).toHaveTextContent('HWND 1, 2, 3, 4, 5, 6')

    fireEvent.click(screen.getByTestId('window-batch-confirm-ok'))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('renders inject confirmation and supports Escape cancel', () => {
    const onCancel = vi.fn()
    render(
      <BatchConfirmDialog
        confirmText="发送键盘事件"
        isOpen
        kind="inject"
        message="将向目标窗口发送安全键盘事件。"
        targetSummary="HWND 9001 / DevHub / Escape"
        title="确认键盘注入"
        variant="warning"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByTestId('window-batch-confirm-dialog')).toHaveAttribute('data-confirm-kind', 'inject')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('returns null when closed', () => {
    render(
      <BatchConfirmDialog
        confirmText="确认"
        isOpen={false}
        kind="close"
        message="hidden"
        targetSummary="hidden"
        title="hidden"
        variant="danger"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.queryByTestId('window-batch-confirm-dialog')).not.toBeInTheDocument()
  })
})
