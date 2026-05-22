import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DevhubNotification } from '@shared/schemas/notification'
import { NotificationCenter } from './NotificationCenter'

const notification: DevhubNotification = {
  id: '00000000-0000-4000-8000-000000000031',
  level: 'WARN',
  ts: 1,
  source: 'system',
  title: 'High resource usage',
  body: 'CPU is above threshold',
  channels: ['toast', 'statusbar'],
  aggregationKey: 'b'.repeat(64),
  actions: [],
  occurrenceCount: 1,
  dismissedAt: null
}

describe('NotificationCenter', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'devhub')
  })

  it('loads notification history and supports dismissing items', async () => {
    const dismiss = vi.fn(async () => ({ success: true, notificationId: notification.id }))
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: {
        r8: {
          notify: {
            list: vi.fn(async () => [notification]),
            dismiss,
            onStream: () => () => undefined,
            onStatusbar: () => () => undefined
          }
        }
      }
    })

    render(<NotificationCenter />)
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open notification center' }))

    expect(screen.getByText('High resource usage')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    })

    expect(dismiss).toHaveBeenCalledWith(notification.id)
    expect(screen.queryByText('High resource usage')).not.toBeInTheDocument()
  })
})
