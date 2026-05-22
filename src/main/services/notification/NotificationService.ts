import { createHash, randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import { auditLogger } from '../AuditLogger'
import { NotificationAggregator } from './NotificationAggregator'
import { DesktopBellChannel } from './channels/DesktopBellChannel'
import { EmailChannel } from './channels/EmailChannel'
import { OsNotificationChannel } from './channels/OsNotificationChannel'
import { StatusbarChannel } from './channels/StatusbarChannel'
import { ToastChannel } from './channels/ToastChannel'
import { WebhookChannel } from './channels/WebhookChannel'
import type { NotificationChannelAdapter, NotificationDeliveryContext, NotificationDeliveryResult } from './types'
import {
  channelConfigSchema,
  notificationAggregationConfigSchema,
  notificationChannelSchema,
  notificationLevelSchema,
  notificationSchema,
  notificationSourceSchema,
  notifyEmitResponseSchema,
  type ChannelConfig,
  type DevhubNotification,
  type NotificationAction,
  type NotificationAggregationConfig,
  type NotificationChannel,
  type NotificationLevel,
  type NotificationSource,
  type NotifyEmitResponse,
  type NotifyListRequest
} from '@shared/schemas/notification'

const MAX_HISTORY = 200
const STREAM_THROTTLE_MS = 100

type NotificationActionHandler = (notification: DevhubNotification) => Promise<void> | void

export interface UnifiedNotificationServiceOptions {
  mainWindow?: BrowserWindow | null
  now?: () => number
}

function cloneConfig(config: ChannelConfig): ChannelConfig {
  return channelConfigSchema.parse(config)
}

function defaultChannelConfigs(): Record<NotificationChannel, ChannelConfig> {
  return {
    toast: { channel: 'toast', enabled: true, minLevel: 'INFO', rateLimitPerMinute: 60 },
    'os-notification': { channel: 'os-notification', enabled: true, minLevel: 'ERROR', rateLimitPerMinute: 20 },
    statusbar: { channel: 'statusbar', enabled: true, minLevel: 'INFO', rateLimitPerMinute: 60 },
    email: { channel: 'email', enabled: false, minLevel: 'ERROR', rateLimitPerMinute: 6 },
    webhook: { channel: 'webhook', enabled: false, minLevel: 'ERROR', rateLimitPerMinute: 30 },
    'desktop-bell': { channel: 'desktop-bell', enabled: true, minLevel: 'FATAL', rateLimitPerMinute: 10 }
  }
}

export class UnifiedNotificationService {
  private mainWindow: BrowserWindow | null
  private readonly now: () => number
  private readonly aggregator = new NotificationAggregator()
  private readonly history: DevhubNotification[] = []
  private readonly channels = new Map<NotificationChannel, NotificationChannelAdapter>()
  private readonly actionHandlers = new Map<string, NotificationActionHandler>()
  private readonly lastStreamAt = new Map<string, number>()
  private readonly channelFailures = new Map<NotificationChannel, number>()

  constructor(options: UnifiedNotificationServiceOptions = {}) {
    this.mainWindow = options.mainWindow ?? null
    this.now = options.now ?? (() => Date.now())
    const configs = defaultChannelConfigs()
    this.channels.set('toast', new ToastChannel(configs.toast, this.now))
    this.channels.set('statusbar', new StatusbarChannel(configs.statusbar, this.now))
    this.channels.set('desktop-bell', new DesktopBellChannel(configs['desktop-bell'], this.now))
    this.channels.set('os-notification', new OsNotificationChannel(configs['os-notification'], this.now))
    this.channels.set('email', new EmailChannel(configs.email, this.now))
    this.channels.set('webhook', new WebhookChannel(configs.webhook, this.now))
  }

  setMainWindow(mainWindow: BrowserWindow | null): void {
    this.mainWindow = mainWindow
  }

  getChannelConfigs(): ChannelConfig[] {
    return Array.from(this.channels.values()).map(channel => cloneConfig(channel.getConfig()))
  }

  configureAggregation(input: NotificationAggregationConfig): NotificationAggregationConfig {
    const config = this.aggregator.configure(notificationAggregationConfigSchema.parse(input))
    auditLogger.log('notify:configure-aggregation', { windowMs: config.windowMs, perLevel: config.perLevel ?? null }, 'success')
    return config
  }

  configureChannel(input: ChannelConfig): ChannelConfig {
    const config = channelConfigSchema.parse(input)
    const channel = this.channels.get(config.channel)
    if (!channel) throw new Error(`E_VALIDATION:unknown notification channel ${config.channel}`)
    channel.configure(config)
    auditLogger.log('notify:configure-channel', { channel: config.channel, enabled: config.enabled, minLevel: config.minLevel }, 'success')
    return cloneConfig(channel.getConfig())
  }

  registerAction(actionId: string, handler: NotificationActionHandler): void {
    if (!actionId.trim()) throw new Error('E_VALIDATION:actionId required')
    this.actionHandlers.set(actionId, handler)
  }

  async invokeAction(input: { id: string; actionId: string }): Promise<{ success: boolean; id: string; actionId: string }> {
    const notification = this.history.find(item => item.id === input.id)
    if (!notification) throw new Error('E_NOT_FOUND:notification')
    if (input.actionId === 'dismiss') {
      this.dismiss({ notificationId: input.id })
      return { success: true, id: input.id, actionId: input.actionId }
    }
    const handler = this.actionHandlers.get(input.actionId)
    if (!handler) throw new Error(`E_NOT_FOUND:notification action ${input.actionId}`)
    await handler(notification)
    this.dismiss({ notificationId: input.id })
    return { success: true, id: input.id, actionId: input.actionId }
  }

  async emit(input: unknown): Promise<NotifyEmitResponse> {
    const normalized = this.normalizeInput(input)
    const aggregation = this.aggregator.evaluate(normalized)
    if (aggregation.isNew) {
      this.history.unshift(aggregation.notification)
      if (this.history.length > MAX_HISTORY) this.history.splice(MAX_HISTORY)
    } else {
      const index = this.history.findIndex(item => item.id === aggregation.notification.id)
      if (index >= 0) this.history[index] = aggregation.notification
      else this.history.unshift(aggregation.notification)
    }

    const deliveries = await this.deliver(aggregation.notification)
    const response = notifyEmitResponseSchema.parse({
      id: aggregation.notification.id,
      suppressed: deliveries.some(item => item.suppressed),
      aggregated: aggregation.aggregated,
      occurrenceCount: aggregation.notification.occurrenceCount,
      deliveries
    })
    auditLogger.log('notify:emit', { id: response.id, level: aggregation.notification.level, source: aggregation.notification.source, aggregated: response.aggregated }, 'success')
    return response
  }

  list(input: Partial<NotifyListRequest> = {}): DevhubNotification[] {
    const since = input.since
    return this.history
      .filter(item => input.includeDismissed || item.dismissedAt === null)
      .filter(item => input.level ? item.level === input.level : true)
      .filter(item => typeof since === 'number' ? item.ts >= since : true)
      .map(item => notificationSchema.parse(item))
  }

  hydrate(notifications: readonly DevhubNotification[]): void {
    this.history.splice(0, this.history.length, ...notifications.slice(0, MAX_HISTORY).map(item => notificationSchema.parse(item)))
  }

  dismiss(input: { notificationId?: string; id?: string }): { success: boolean; notificationId: string } {
    const notificationId = input.notificationId ?? input.id
    if (!notificationId) throw new Error('E_VALIDATION:notificationId required')
    const notification = this.history.find(item => item.id === notificationId)
    if (notification) notification.dismissedAt = this.now()
    auditLogger.log('notify:dismiss', { notificationId }, 'success')
    return { success: true, notificationId }
  }

  private async deliver(notification: DevhubNotification): Promise<NotificationDeliveryResult[]> {
    const context: NotificationDeliveryContext = {
      mainWindow: this.mainWindow,
      sendToRenderer: (channel, payload) => this.sendToRenderer(channel, payload),
      invokeAction: (notificationId, actionId) => this.invokeAction({ id: notificationId, actionId }).then(() => undefined)
    }
    const results: NotificationDeliveryResult[] = []
    for (const channelName of notification.channels) {
      const channel = this.channels.get(channelName)
      if (!channel) continue
      try {
        const result = await channel.deliver(notification, context)
        results.push(result)
        await this.handleDeliveryFallback(notification, channelName, result, context, results)
      } catch (error) {
        const result = { channel: channelName, delivered: false, suppressed: true, reason: error instanceof Error ? error.message : 'channel-error' }
        results.push(result)
        await this.handleDeliveryFallback(notification, channelName, result, context, results)
      }
    }
    return results
  }

  private async handleDeliveryFallback(
    notification: DevhubNotification,
    channelName: NotificationChannel,
    result: NotificationDeliveryResult,
    context: NotificationDeliveryContext,
    results: NotificationDeliveryResult[]
  ): Promise<void> {
    if (result.delivered) {
      this.channelFailures.delete(channelName)
      return
    }

    if (channelName === 'webhook' || channelName === 'email') {
      const failures = (this.channelFailures.get(channelName) ?? 0) + 1
      this.channelFailures.set(channelName, failures)
      if (failures >= 5 || channelName === 'email') {
        const adapter = this.channels.get(channelName)
        const currentConfig = adapter?.getConfig()
        if (adapter && currentConfig?.enabled) {
          adapter.configure({ ...currentConfig, enabled: false })
          auditLogger.log('notify:channel-suspended', { channel: channelName, failures, reason: result.reason ?? null }, 'error')
        }
      }
    }

    if ((channelName === 'os-notification' || channelName === 'webhook' || channelName === 'email') && !notification.channels.includes('toast')) {
      const toast = this.channels.get('toast')
      if (toast) results.push(await toast.deliver(notificationSchema.parse({ ...notification, channels: ['toast'] }), context))
    }
  }

  private sendToRenderer(channel: string, payload: unknown): void {
    if (channel === 'notify:stream') {
      const now = this.now()
      const last = this.lastStreamAt.get(channel) ?? 0
      if (now - last < STREAM_THROTTLE_MS) return
      this.lastStreamAt.set(channel, now)
    }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload)
    }
  }

  private normalizeInput(input: unknown): DevhubNotification {
    const record = this.objectRecord(input)
    const level = this.normalizeLevel(record.level)
    const source = this.normalizeSource(record.source)
    const ts = this.normalizeTimestamp(record.ts ?? record.createdAt)
    const instanceId = typeof record.instanceId === 'string' && record.instanceId.trim() ? record.instanceId.trim() : undefined
    const title = this.truncate(String(record.title ?? 'Notification'), 120)
    const body = this.truncate(String(record.body ?? ''), 2000)
    const channels = this.normalizeChannels(record.channels, level)
    const actions = this.normalizeActions(record.actions)
    const aggregationKey = typeof record.aggregationKey === 'string' && record.aggregationKey.trim()
      ? record.aggregationKey.trim()
      : this.buildAggregationKey(level, source, instanceId)

    return notificationSchema.parse({
      id: typeof record.id === 'string' ? record.id : randomUUID(),
      level,
      ts,
      source,
      instanceId,
      title,
      body,
      channels,
      aggregationKey,
      signalContributions: this.objectNumberRecord(record.signalContributions),
      actions,
      occurrenceCount: 1,
      dismissedAt: null
    })
  }

  private normalizeLevel(value: unknown): NotificationLevel {
    if (typeof value === 'string') {
      const upper = value.toUpperCase()
      if (upper === 'WARNING') return 'WARN'
      if (upper === 'SUCCESS') return 'INFO'
      const parsed = notificationLevelSchema.safeParse(upper)
      if (parsed.success) return parsed.data
    }
    throw new Error('E_VALIDATION:invalid notification level')
  }

  private normalizeSource(value: unknown): NotificationSource {
    const parsed = notificationSourceSchema.safeParse(value)
    if (parsed.success) return parsed.data
    throw new Error('E_VALIDATION:invalid notification source')
  }

  private normalizeTimestamp(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : this.now()
  }

  private normalizeChannels(value: unknown, level: NotificationLevel): NotificationChannel[] {
    if (Array.isArray(value)) {
      const channels = value
        .map(item => notificationChannelSchema.safeParse(item))
        .filter((item): item is { success: true; data: NotificationChannel } => item.success)
        .map(item => item.data)
      if (channels.length > 0) return Array.from(new Set(channels))
    }
    if (level === 'FATAL') return ['toast', 'statusbar', 'os-notification', 'desktop-bell']
    if (level === 'ERROR') return ['toast', 'statusbar', 'os-notification']
    return ['toast', 'statusbar']
  }

  private normalizeActions(value: unknown): NotificationAction[] {
    if (!Array.isArray(value)) return []
    return value.slice(0, 3).map(item => {
      const actionRecord = this.objectRecord(item)
      const legacyAction = typeof actionRecord.action === 'string' ? actionRecord.action : undefined
      return {
        label: String(actionRecord.label ?? actionRecord.actionId ?? legacyAction ?? 'Action').slice(0, 60),
        actionId: String(actionRecord.actionId ?? legacyAction ?? '').slice(0, 160)
      }
    }).filter(action => action.actionId.length > 0)
  }

  private objectRecord(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('E_VALIDATION:object expected')
    return input as Record<string, unknown>
  }

  private objectNumberRecord(input: unknown): Record<string, number> | undefined {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined
    const output: Record<string, number> = {}
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'number' && Number.isFinite(value)) output[key] = value
    }
    return Object.keys(output).length > 0 ? output : undefined
  }

  private buildAggregationKey(level: NotificationLevel, source: NotificationSource, instanceId?: string): string {
    return createHash('sha256').update(`${level}:${source}:${instanceId ?? ''}`).digest('hex')
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 3)}...` : value
  }
}

let unifiedNotificationService: UnifiedNotificationService | null = null

export function getUnifiedNotificationService(mainWindow?: BrowserWindow | null): UnifiedNotificationService {
  if (!unifiedNotificationService) unifiedNotificationService = new UnifiedNotificationService({ mainWindow })
  if (mainWindow !== undefined) unifiedNotificationService.setMainWindow(mainWindow)
  return unifiedNotificationService
}

export function resetUnifiedNotificationService(): void {
  unifiedNotificationService = null
}
