import type { DevhubNotification } from '@shared/schemas/notification'
import { BaseNotificationChannel } from './BaseNotificationChannel'
import type { NotificationChannelAdapter, NotificationDeliveryContext, NotificationDeliveryResult } from '../types'

const WEBHOOK_TIMEOUT_MS = 5000
const WEBHOOK_RETRIES = 3

export class WebhookChannel extends BaseNotificationChannel implements NotificationChannelAdapter {
  async deliver(notification: DevhubNotification, _context: NotificationDeliveryContext): Promise<NotificationDeliveryResult> {
    const gated = this.gate(notification)
    if (gated) return gated
    const config = this.getConfig().webhookConfig
    if (!config) throw new Error('E_VALIDATION:webhook channel requires webhookConfig')
    if (!config.url.startsWith('https://')) throw new Error('E_VALIDATION:webhook URL must be HTTPS')

    let lastReason = 'E_TIMEOUT'
    for (let attempt = 0; attempt < WEBHOOK_RETRIES; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
      try {
        const response = await fetch(config.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...config.headers },
          body: JSON.stringify(notification),
          signal: controller.signal
        })
        if (response.ok) return this.result(true, false)
        lastReason = `E_HTTP_${response.status}`
      } catch {
        lastReason = 'E_TIMEOUT'
      } finally {
        clearTimeout(timer)
      }
    }
    return this.result(false, true, lastReason)
  }
}
