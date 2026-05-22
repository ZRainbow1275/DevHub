import type { DevhubNotification } from '@shared/schemas/notification'
import { BaseNotificationChannel } from './BaseNotificationChannel'
import type { NotificationChannelAdapter, NotificationDeliveryContext, NotificationDeliveryResult } from '../types'

export class ToastChannel extends BaseNotificationChannel implements NotificationChannelAdapter {
  async deliver(notification: DevhubNotification, context: NotificationDeliveryContext): Promise<NotificationDeliveryResult> {
    const gated = this.gate(notification)
    if (gated) return gated
    context.sendToRenderer('notify:stream', notification)
    return this.result(true, false)
  }
}
