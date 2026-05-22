import type { DevhubNotification, NotificationAggregationConfig } from '@shared/schemas/notification'
import { notificationAggregationConfigSchema, notificationSchema } from '@shared/schemas/notification'

interface AggregationBucket {
  firstTs: number
  lastTs: number
  count: number
  baseBody: string
  notification: DevhubNotification
}

export interface AggregationResult {
  notification: DevhubNotification
  aggregated: boolean
  isNew: boolean
}

export class NotificationAggregator {
  private config: NotificationAggregationConfig = notificationAggregationConfigSchema.parse({ windowMs: 60000 })
  private readonly buckets = new Map<string, AggregationBucket>()

  configure(input: NotificationAggregationConfig): NotificationAggregationConfig {
    this.config = notificationAggregationConfigSchema.parse(input)
    this.prune(Date.now())
    return this.getConfig()
  }

  getConfig(): NotificationAggregationConfig {
    return { windowMs: this.config.windowMs, perLevel: this.config.perLevel ? { ...this.config.perLevel } : undefined }
  }

  evaluate(notification: DevhubNotification): AggregationResult {
    if (notification.level === 'FATAL') {
      this.buckets.delete(notification.aggregationKey)
      return { notification, aggregated: false, isNew: true }
    }

    const windowMs = this.config.perLevel?.[notification.level] ?? this.config.windowMs
    const existing = this.buckets.get(notification.aggregationKey)
    if (existing && notification.ts - existing.firstTs <= windowMs) {
      existing.count += 1
      existing.lastTs = notification.ts
      existing.notification = notificationSchema.parse({
        ...existing.notification,
        ts: notification.ts,
        body: this.renderAggregatedBody(existing.baseBody, notification.body, existing.count, windowMs),
        channels: Array.from(new Set([...existing.notification.channels, ...notification.channels])),
        signalContributions: notification.signalContributions ?? existing.notification.signalContributions,
        actions: notification.actions.length > 0 ? notification.actions : existing.notification.actions,
        occurrenceCount: existing.count
      })
      return { notification: existing.notification, aggregated: true, isNew: false }
    }

    const nextBucket: AggregationBucket = {
      firstTs: notification.ts,
      lastTs: notification.ts,
      count: 1,
      baseBody: notification.body,
      notification
    }
    this.buckets.set(notification.aggregationKey, nextBucket)
    this.prune(notification.ts)
    return { notification, aggregated: false, isNew: true }
  }

  private renderAggregatedBody(firstBody: string, latestBody: string, count: number, windowMs: number): string {
    const text = `${firstBody}

${count} occurrences within ${Math.round(windowMs / 1000)}s window. Latest: ${latestBody}`
    return text.length > 2000 ? `${text.slice(0, 1997)}...` : text
  }

  private prune(now: number): void {
    const maxWindow = Math.max(this.config.windowMs, ...Object.values(this.config.perLevel ?? {}))
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastTs > maxWindow) this.buckets.delete(key)
    }
  }
}
