import {
  RATE_LIMIT_RPM,
  type ChannelRegistration,
  type RateLimitClass,
  type RateLimitVerdict
} from '@shared/schemas/ipc-rate-limit'
import type { R8IpcChannelDefinition } from '@shared/schemas/r8-runtime'
import {
  IpcChannelRegistry,
  ipcChannelRegistry,
  type ChannelRegistrationInput,
  type RegisteredIpcChannel
} from './IpcChannelRegistry'
import { createRateLimitError, globalIpcRateLimiter, RateLimiter } from './RateLimiter'

export type RateLimitedHandler<TArgs extends unknown[], TReturn> = (...args: TArgs) => TReturn
export type RateLimitSetting = number | RateLimitClass | ChannelRegistrationInput

export interface RateLimitAuditEvent {
  readonly channel: string
  readonly rateClass: RateLimitClass
  readonly rejectRate: number
  readonly rejectedRequests: number
  readonly totalRequests: number
}

interface RateLimitMiddlewareOptions {
  readonly registry?: IpcChannelRegistry
  readonly limiter?: RateLimiter
  readonly enabled?: () => boolean
}

type RateLimitAuditSink = (event: RateLimitAuditEvent) => void

let enabledProvider: (() => boolean) | null = null
let auditSink: RateLimitAuditSink | null = null
const warnedAtByChannel = new Map<string, number>()

function isRateLimitClass(value: unknown): value is RateLimitClass {
  return value === 'high_freq_scan' || value === 'medium_query' || value === 'low_freq_op' || value === 'meta'
}

function classForRpm(limit: number): RateLimitClass {
  if (limit === RATE_LIMIT_RPM.high_freq_scan) return 'high_freq_scan'
  if (limit === RATE_LIMIT_RPM.low_freq_op) return 'low_freq_op'
  if (limit >= RATE_LIMIT_RPM.meta) return 'meta'
  return 'medium_query'
}

function registrationFromSetting(channel: string, setting: RateLimitSetting): ChannelRegistrationInput {
  if (typeof setting === 'number') {
    return {
      channel,
      rateClass: classForRpm(setting),
      burstAllowance: 0,
      perSenderBucket: false,
      description: `Legacy IPC rate limit for ${channel}`,
      rpmOverride: setting
    }
  }

  if (isRateLimitClass(setting)) {
    return {
      channel,
      rateClass: setting,
      burstAllowance: 5,
      perSenderBucket: false,
      description: `R8 IPC rate limit for ${channel}`
    }
  }

  return {
    ...setting,
    channel
  }
}

function senderIdFromArgs(args: readonly unknown[]): string | undefined {
  const event = args[0]
  if (typeof event !== 'object' || event === null) return undefined
  const sender = (event as { sender?: { id?: unknown } }).sender
  return typeof sender?.id === 'number' ? String(sender.id) : undefined
}

function maybeAuditReject(registration: RegisteredIpcChannel, verdict: RateLimitVerdict, limiter: RateLimiter): void {
  if (verdict.allowed) return

  const stats = limiter.getStats([registration]).perChannel.find(item => item.channel === registration.channel)
  if (!stats || stats.rejectRate <= 0.05) return

  const lastWarnAt = warnedAtByChannel.get(registration.channel) ?? 0
  if (verdict.ts - lastWarnAt < 60_000) return

  warnedAtByChannel.set(registration.channel, verdict.ts)
  auditSink?.({
    channel: stats.channel,
    rateClass: stats.rateClass,
    rejectRate: stats.rejectRate,
    rejectedRequests: stats.rejectedRequests,
    totalRequests: stats.totalRequests
  })
}

export function setRateLimitFeatureFlagProvider(provider: (() => boolean) | null): void {
  enabledProvider = provider
}

export function setRateLimitAuditSink(sink: RateLimitAuditSink | null): void {
  auditSink = sink
}

export function registerRateLimitChannelDefinitions(definitions: readonly R8IpcChannelDefinition[]): ChannelRegistration[] {
  ipcChannelRegistry.registerDefinitions(definitions)
  return ipcChannelRegistry.list()
}

export function createRateLimitedHandler<TArgs extends unknown[], TReturn>(
  channel: string,
  setting: RateLimitSetting,
  handler: RateLimitedHandler<TArgs, TReturn>,
  options: RateLimitMiddlewareOptions = {}
): RateLimitedHandler<TArgs, TReturn> {
  const registry = options.registry ?? ipcChannelRegistry
  const limiter = options.limiter ?? globalIpcRateLimiter
  const registrationInput = registrationFromSetting(channel, setting)
  const registration = registry.register(registrationInput)

  return (...args: TArgs): TReturn => {
    const enabled = options.enabled?.() ?? enabledProvider?.() ?? true
    const verdict = limiter.consume({
      registration,
      senderId: senderIdFromArgs(args),
      enabled
    })

    maybeAuditReject(registration, verdict, limiter)

    if (!verdict.allowed) {
      throw createRateLimitError(verdict)
    }

    return handler(...args)
  }
}

export function resetRateLimitMiddlewareState(): void {
  warnedAtByChannel.clear()
  enabledProvider = null
  auditSink = null
}
