import nodemailer from 'nodemailer'
import type { DevhubNotification } from '@shared/schemas/notification'
import { BaseNotificationChannel } from './BaseNotificationChannel'
import type { NotificationChannelAdapter, NotificationDeliveryContext, NotificationDeliveryResult } from '../types'

export class EmailChannel extends BaseNotificationChannel implements NotificationChannelAdapter {
  async deliver(notification: DevhubNotification, _context: NotificationDeliveryContext): Promise<NotificationDeliveryResult> {
    const gated = this.gate(notification)
    if (gated) return gated
    const config = this.getConfig().smtpConfig
    if (!config) throw new Error('E_VALIDATION:email channel requires smtpConfig')
    const password = config.passwordEnv ? process.env[config.passwordEnv] : undefined
    if (config.passwordEnv && !password) throw new Error(`E_VALIDATION:SMTP password env ${config.passwordEnv} is empty`)
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.requireTls,
      auth: password ? { user: config.user, pass: password } : undefined
    })
    await transporter.sendMail({
      from: config.from ?? config.user,
      to: config.to ?? config.user,
      subject: `[${notification.level}] ${notification.title}`,
      text: `${notification.body}

source=${notification.source}
instanceId=${notification.instanceId ?? 'n/a'}
id=${notification.id}`
    })
    return this.result(true, false)
  }
}
