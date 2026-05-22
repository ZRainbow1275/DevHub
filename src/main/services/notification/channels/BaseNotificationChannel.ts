import type { ChannelConfig, DevhubNotification, NotificationChannel } from '@shared/schemas/notification'
import { LEVEL_RANK, type NotificationDeliveryResult } from '../types'

export abstract class BaseNotificationChannel {
  readonly channel: NotificationChannel
  private config: ChannelConfig
  private readonly deliveredAt: number[] = []
  private readonly now: () => number

  constructor(config: ChannelConfig, now: () => number = () => Date.now()) {
    this.channel = config.channel
    this.config = config
    this.now = now
  }

  configure(config: ChannelConfig): void {
    if (config.channel !== this.channel) throw new Error(`E_VALIDATION:channel mismatch for ${this.channel}`)
    this.config = config
  }

  getConfig(): ChannelConfig {
    return { ...this.config }
  }

  protected gate(notification: DevhubNotification): NotificationDeliveryResult | null {
    if (!this.config.enabled) return this.result(false, true, 'channel-disabled')
    if (LEVEL_RANK[notification.level] < LEVEL_RANK[this.config.minLevel]) return this.result(false, true, 'below-min-level')
    const now = this.now()
    const cutoff = now - 60_000
    while (this.deliveredAt.length > 0 && this.deliveredAt[0] < cutoff) this.deliveredAt.shift()
    if (this.deliveredAt.length >= this.config.rateLimitPerMinute) return this.result(false, true, 'E_RATE_LIMITED')
    this.deliveredAt.push(now)
    return null
  }

  protected result(delivered: boolean, suppressed: boolean, reason?: string): NotificationDeliveryResult {
    return { channel: this.channel, delivered, suppressed, reason }
  }
}
