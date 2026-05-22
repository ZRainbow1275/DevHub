import { Notification } from 'electron'
import type { DevhubNotification } from '@shared/schemas/notification'
import { BaseNotificationChannel } from './BaseNotificationChannel'
import type { NotificationChannelAdapter, NotificationDeliveryContext, NotificationDeliveryResult } from '../types'

export class OsNotificationChannel extends BaseNotificationChannel implements NotificationChannelAdapter {
  async deliver(notification: DevhubNotification, context: NotificationDeliveryContext): Promise<NotificationDeliveryResult> {
    const gated = this.gate(notification)
    if (gated) return gated
    if (!Notification.isSupported()) return this.result(false, true, 'os-notification-unsupported')

    try {
      const osNotification = new Notification({
        title: notification.title,
        body: notification.body,
        silent: notification.level !== 'FATAL',
        urgency: notification.level === 'FATAL' ? 'critical' : notification.level === 'WARN' ? 'normal' : 'low',
        timeoutType: notification.level === 'FATAL' ? 'never' : 'default'
      })
      osNotification.on('click', () => {
        const firstAction = notification.actions[0]
        if (firstAction) {
          void context.invokeAction(notification.id, firstAction.actionId)
        }
      })
      osNotification.on('action', event => {
        const eventRecord = event as unknown as { actionIndex?: number }
        const actionIndex = typeof eventRecord.actionIndex === 'number' ? eventRecord.actionIndex : 0
        const selectedAction = notification.actions[actionIndex]
        if (selectedAction) {
          void context.invokeAction(notification.id, selectedAction.actionId)
        }
      })
      osNotification.on('failed', (_event, error) => {
        context.sendToRenderer('notify:channel-failed', { id: notification.id, channel: this.channel, error })
      })
      osNotification.show()
      return this.result(true, false)
    } catch (error) {
      return this.result(false, true, error instanceof Error ? error.message : 'os-notification-failed')
    }
  }
}
