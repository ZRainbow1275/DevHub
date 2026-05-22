import type { BrowserWindow } from 'electron'
import type { ChannelConfig, DevhubNotification, NotificationChannel } from '@shared/schemas/notification'

export interface NotificationDeliveryResult {
  channel: NotificationChannel
  delivered: boolean
  suppressed: boolean
  reason?: string
}

export interface NotificationDeliveryContext {
  mainWindow: BrowserWindow | null
  sendToRenderer: (channel: string, payload: unknown) => void
  invokeAction: (notificationId: string, actionId: string) => Promise<void>
}

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel
  configure(config: ChannelConfig): void
  getConfig(): ChannelConfig
  deliver(notification: DevhubNotification, context: NotificationDeliveryContext): Promise<NotificationDeliveryResult>
}

export const LEVEL_RANK = {
  INFO: 10,
  WARN: 20,
  ERROR: 30,
  FATAL: 40
} as const
