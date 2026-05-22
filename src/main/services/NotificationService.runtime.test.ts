import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  class MockNotification {
    static isSupported(): boolean {
      return false
    }

    on(): void {}
    show(): void {}
  }

  return {
    Notification: MockNotification
  }
})

import { NotificationService } from './NotificationService'

describe('NotificationService runtime behavior', () => {
  const send = vi.fn()
  const show = vi.fn()
  const focus = vi.fn()
  const mainWindow = {
    isDestroyed: vi.fn(() => false),
    show,
    focus,
    webContents: {
      send
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should persist metadata into notification history and renderer payload', async () => {
    const service = new NotificationService(mainWindow as never)

    await service.notify('task-complete', '任务完成', 'Codex', {
      metadata: {
        taskId: 'task-1',
        windowHwnd: 1024
      }
    })

    const [historyEntry] = service.getHistory()
    expect(historyEntry?.metadata).toEqual({
      taskId: 'task-1',
      windowHwnd: 1024
    })
    expect(send).toHaveBeenCalledWith('notification:new', expect.objectContaining({
      metadata: {
        taskId: 'task-1',
        windowHwnd: 1024
      }
    }))

    service.destroy()
  })
})
