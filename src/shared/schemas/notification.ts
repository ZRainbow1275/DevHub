import { z } from 'zod'

export const notificationLevelSchema = z.enum(['INFO', 'WARN', 'ERROR', 'FATAL'])
export const notificationChannelSchema = z.enum(['toast', 'os-notification', 'statusbar', 'email', 'webhook', 'desktop-bell'])
export const notificationSourceSchema = z.enum(['ai-task', 'csv-batch', 'watchdog', 'inject', 'system'])

export const notificationActionSchema = z.object({
  label: z.string().min(1).max(60),
  actionId: z.string().min(1).max(160)
})

export const notificationSchema = z.object({
  id: z.string().uuid(),
  level: notificationLevelSchema,
  ts: z.number().int().nonnegative(),
  source: notificationSourceSchema,
  instanceId: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(120),
  body: z.string().max(2000),
  channels: z.array(notificationChannelSchema).min(1),
  aggregationKey: z.string().min(16).max(128),
  signalContributions: z.record(z.string(), z.number()).optional(),
  actions: z.array(notificationActionSchema).max(3).default([]),
  occurrenceCount: z.number().int().min(1).default(1),
  dismissedAt: z.number().int().nonnegative().nullable().default(null)
})

export const notificationAggregationConfigSchema = z.object({
  windowMs: z.number().int().min(5000).max(600000).default(60000),
  perLevel: z.partialRecord(notificationLevelSchema, z.number().int().min(5000).max(600000)).optional()
})

export const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1),
  requireTls: z.boolean(),
  from: z.string().email().optional(),
  to: z.string().email().optional(),
  passwordEnv: z.string().min(1).optional()
})

export const webhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.literal('POST').default('POST'),
  headers: z.record(z.string(), z.string()).default({})
})

export const channelConfigSchema = z.object({
  channel: notificationChannelSchema,
  enabled: z.boolean(),
  minLevel: notificationLevelSchema,
  rateLimitPerMinute: z.number().int().min(1).max(60),
  smtpConfig: smtpConfigSchema.optional(),
  webhookConfig: webhookConfigSchema.optional()
}).superRefine((config, context) => {
  if (config.channel === 'email' && config.enabled && !config.smtpConfig) {
    context.addIssue({ code: 'custom', message: 'E_VALIDATION:email channel requires smtpConfig', path: ['smtpConfig'] })
  }
  if (config.channel === 'webhook' && config.enabled) {
    if (!config.webhookConfig) {
      context.addIssue({ code: 'custom', message: 'E_VALIDATION:webhook channel requires webhookConfig', path: ['webhookConfig'] })
    } else if (!config.webhookConfig.url.startsWith('https://')) {
      context.addIssue({ code: 'custom', message: 'E_VALIDATION:webhook URL must be HTTPS', path: ['webhookConfig', 'url'] })
    }
  }
})

export const notifyEmitResponseSchema = z.object({
  id: z.string().uuid(),
  suppressed: z.boolean(),
  aggregated: z.boolean(),
  occurrenceCount: z.number().int().min(1),
  deliveries: z.array(z.object({
    channel: notificationChannelSchema,
    delivered: z.boolean(),
    suppressed: z.boolean(),
    reason: z.string().optional()
  }))
})

export const notifyListRequestSchema = z.object({
  since: z.number().int().nonnegative().optional(),
  level: notificationLevelSchema.optional(),
  includeDismissed: z.boolean().default(false)
}).default({ includeDismissed: false })

export const notifyDismissRequestSchema = z.object({
  id: z.string().uuid().optional(),
  notificationId: z.string().uuid().optional()
}).refine(input => Boolean(input.id ?? input.notificationId), 'id or notificationId required')

export const notifyInvokeActionRequestSchema = z.object({
  id: z.string().uuid(),
  actionId: z.string().min(1).max(160)
})

export type NotificationLevel = z.infer<typeof notificationLevelSchema>
export type NotificationChannel = z.infer<typeof notificationChannelSchema>
export type NotificationSource = z.infer<typeof notificationSourceSchema>
export type NotificationAction = z.infer<typeof notificationActionSchema>
export type DevhubNotification = z.infer<typeof notificationSchema>
export type NotificationAggregationConfig = z.infer<typeof notificationAggregationConfigSchema>
export type ChannelConfig = z.infer<typeof channelConfigSchema>
export type NotifyEmitResponse = z.infer<typeof notifyEmitResponseSchema>
export type NotifyListRequest = z.infer<typeof notifyListRequestSchema>
export type NotifyDismissRequest = z.infer<typeof notifyDismissRequestSchema>
export type NotifyInvokeActionRequest = z.infer<typeof notifyInvokeActionRequestSchema>
