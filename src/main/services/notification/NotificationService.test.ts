import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  class MockNotification {
    static isSupported(): boolean {
      return false
    }

    on(): void {}
    show(): void {}
  }

  return { Notification: MockNotification }
})

import { UnifiedNotificationService } from './NotificationService'

function createWindow() {
  return {
    isDestroyed: vi.fn(() => false),
    webContents: {
      send: vi.fn()
    }
  }
}

describe('UnifiedNotificationService', () => {
  let now = 1_000_000

  beforeEach(() => {
    now = 1_000_000
    vi.clearAllMocks()
  })

  it('routes ERROR notifications to toast and statusbar while email and webhook remain off by default', async () => {
    const mainWindow = createWindow()
    const service = new UnifiedNotificationService({ mainWindow: mainWindow as never, now: () => now })

    const response = await service.emit({
      level: 'ERROR',
      source: 'ai-task',
      instanceId: 'codex-1',
      title: 'Task failed',
      body: 'The real command failed'
    })

    expect(response.deliveries.map(item => item.channel)).toEqual(['toast', 'statusbar', 'os-notification'])
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('notify:stream', expect.objectContaining({ level: 'ERROR' }))
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('notify:statusbar', expect.objectContaining({ level: 'ERROR' }))
    expect(service.getChannelConfigs().find(item => item.channel === 'email')?.enabled).toBe(false)
    expect(service.getChannelConfigs().find(item => item.channel === 'webhook')?.enabled).toBe(false)
  })

  it('aggregates matching notifications within the default 60s window', async () => {
    const service = new UnifiedNotificationService({ mainWindow: createWindow() as never, now: () => now })

    for (let index = 0; index < 5; index++) {
      now += 1000
      await service.emit({
        level: 'ERROR',
        source: 'ai-task',
        instanceId: 'same-instance',
        title: 'Repeated failure',
        body: `failure ${index + 1}`
      })
    }

    const list = service.list({ level: 'ERROR' })
    expect(list).toHaveLength(1)
    expect(list[0]?.occurrenceCount).toBe(5)
    expect(list[0]?.body).toContain('5 occurrences')
    expect(list[0]?.aggregationKey).toHaveLength(64)
  })

  it('applies user configured aggregation windows immediately', async () => {
    const service = new UnifiedNotificationService({ mainWindow: createWindow() as never, now: () => now })
    const config = service.configureAggregation({ windowMs: 120000 })

    expect(config.windowMs).toBe(120000)
    await service.emit({ level: 'WARN', source: 'system', instanceId: 'slow', title: 'Warn', body: 'first' })
    now += 90_000
    await service.emit({ level: 'WARN', source: 'system', instanceId: 'slow', title: 'Warn', body: 'second' })

    expect(service.list({ level: 'WARN' })).toHaveLength(1)
    expect(service.list({ level: 'WARN' })[0]?.occurrenceCount).toBe(2)
  })

  it('does not aggregate FATAL notifications and triggers desktop bell delivery', async () => {
    const mainWindow = createWindow()
    const service = new UnifiedNotificationService({ mainWindow: mainWindow as never, now: () => now })

    await service.emit({ level: 'FATAL', source: 'watchdog', instanceId: 'dead', title: 'Fatal', body: 'first' })
    await service.emit({ level: 'FATAL', source: 'watchdog', instanceId: 'dead', title: 'Fatal', body: 'second' })

    expect(service.list({ level: 'FATAL' })).toHaveLength(2)
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('notify:desktop-bell', expect.objectContaining({ level: 'FATAL' }))
  })

  it('invokes registered actions and dismisses the notification', async () => {
    const service = new UnifiedNotificationService({ mainWindow: createWindow() as never, now: () => now })
    const handler = vi.fn()
    service.registerAction('restart', handler)
    await service.emit({
      level: 'ERROR',
      source: 'watchdog',
      instanceId: 'svc',
      title: 'Restart required',
      body: 'watchdog failed',
      actions: [{ label: 'restart', actionId: 'restart' }]
    })
    const [notification] = service.list({ level: 'ERROR' })

    await service.invokeAction({ id: notification.id, actionId: 'restart' })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: notification.id }))
    expect(service.list({ level: 'ERROR' })).toHaveLength(0)
    expect(service.list({ level: 'ERROR', includeDismissed: true })[0]?.dismissedAt).toBe(now)
  })

  it('enforces per-channel rate limits but keeps notifications in list', async () => {
    const service = new UnifiedNotificationService({ mainWindow: createWindow() as never, now: () => now })
    service.configureChannel({ channel: 'toast', enabled: true, minLevel: 'INFO', rateLimitPerMinute: 1 })

    await service.emit({ level: 'INFO', source: 'system', instanceId: 'one', title: 'One', body: 'one' })
    const response = await service.emit({ level: 'INFO', source: 'system', instanceId: 'two', title: 'Two', body: 'two' })

    expect(response.suppressed).toBe(true)
    expect(response.deliveries).toContainEqual(expect.objectContaining({ channel: 'toast', reason: 'E_RATE_LIMITED' }))
    expect(service.list({ level: 'INFO' })).toHaveLength(2)
  })

  it('suspends repeatedly failing webhooks and falls back to toast', async () => {
    const mainWindow = createWindow()
    const service = new UnifiedNotificationService({ mainWindow: mainWindow as never, now: () => now })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response)
    service.configureChannel({
      channel: 'webhook',
      enabled: true,
      minLevel: 'ERROR',
      rateLimitPerMinute: 30,
      webhookConfig: { url: 'https://example.test/hook', method: 'POST', headers: {} }
    })

    for (let index = 0; index < 5; index++) {
      now += 1000
      await service.emit({
        level: 'ERROR',
        source: 'system',
        instanceId: `webhook-${index}`,
        title: 'Webhook failure',
        body: 'webhook failed',
        channels: ['webhook']
      })
    }

    expect(fetchSpy).toHaveBeenCalled()
    expect(service.getChannelConfigs().find(item => item.channel === 'webhook')?.enabled).toBe(false)
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('notify:stream', expect.objectContaining({ title: 'Webhook failure' }))
    fetchSpy.mockRestore()
  })

  it('rejects enabled webhook configs that are not HTTPS', () => {
    const service = new UnifiedNotificationService({ mainWindow: createWindow() as never, now: () => now })

    expect(() => service.configureChannel({
      channel: 'webhook',
      enabled: true,
      minLevel: 'ERROR',
      rateLimitPerMinute: 5,
      webhookConfig: { url: 'http://example.test/hook', method: 'POST', headers: {} }
    })).toThrow('webhook URL must be HTTPS')
  })
})
