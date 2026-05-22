import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DevhubNotification } from '@shared/schemas/notification'
import { ToastHost } from './ToastHost'

const sampleNotification: DevhubNotification = {
  id: '00000000-0000-4000-8000-000000000030',
  level: 'ERROR',
  ts: 1,
  source: 'ai-task',
  instanceId: 'codex-1',
  title: 'Task failed',
  body: 'The task failed with a real error',
  channels: ['toast', 'statusbar'],
  aggregationKey: 'a'.repeat(64),
  actions: [],
  occurrenceCount: 1,
  dismissedAt: null
}

describe('ToastHost', () => {
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(window, 'devhub')
  })

  it('renders streamed notifications and dismisses through the real preload API', async () => {
    vi.useFakeTimers()
    let streamListener: ((notification: DevhubNotification) => void) | null = null
    const dismiss = vi.fn(async () => ({ success: true, notificationId: sampleNotification.id }))
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: {
        r8: {
          notify: {
            dismiss,
            onStream: (listener: (notification: DevhubNotification) => void) => {
              streamListener = listener
              return () => { streamListener = null }
            },
            onDesktopBell: () => () => undefined
          }
        }
      }
    })

    render(<ToastHost />)
    await act(async () => {
      streamListener?.(sampleNotification)
    })

    expect(screen.getByText('Task failed')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    })

    expect(dismiss).toHaveBeenCalledWith(sampleNotification.id)
    expect(screen.queryByText('Task failed')).not.toBeInTheDocument()
  })
})
