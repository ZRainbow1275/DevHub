import {
  RATE_LIMIT_RPM,
  type ChannelRegistration,
  type RateLimitClass,
  type RateLimitStatsResponse
} from '@shared/schemas/ipc-rate-limit'
import type { IpcThrottleReport } from '@shared/observability'
import type { R8IpcChannelDefinition } from '@shared/schemas/r8-runtime'
import {
  createRateLimitedHandler,
  registerRateLimitChannelDefinitions,
  resetRateLimitMiddlewareState,
  setRateLimitAuditSink,
  setRateLimitFeatureFlagProvider,
  type RateLimitAuditEvent,
  type RateLimitSetting
} from '../services/ipc/RateLimitMiddleware'
import { ipcChannelRegistry } from '../services/ipc/IpcChannelRegistry'
import { globalIpcRateLimiter } from '../services/ipc/RateLimiter'

export const RATE_LIMITS = {
  SCAN: RATE_LIMIT_RPM.high_freq_scan,
  ACTION: RATE_LIMIT_RPM.low_freq_op,
  QUERY: RATE_LIMIT_RPM.medium_query,
  BURST: RATE_LIMIT_RPM.meta,
  DESTRUCTIVE: 5
} as const

let rateLimitObserver: ((channel: string) => void) | null = null

export function withRateLimit<TArgs extends unknown[], TReturn>(
  channel: string,
  limitOrClass: number | RateLimitClass,
  handler: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const setting: RateLimitSetting = limitOrClass
  const limited = createRateLimitedHandler(channel, setting, handler)

  return (...args: TArgs): TReturn => {
    try {
      rateLimitObserver?.(channel)
    } catch {
      // Observation must never interfere with the protected handler path.
    }

    return limited(...args)
  }
}

export function resetRateLimits(): void {
  globalIpcRateLimiter.reset()
  ipcChannelRegistry.reset()
  resetRateLimitMiddlewareState()
}

export function setRateLimitObserver(observer: ((channel: string) => void) | null): void {
  rateLimitObserver = observer
}

export function getRateLimitReport(): IpcThrottleReport {
  return globalIpcRateLimiter.getLegacyReport(ipcChannelRegistry.listRegistered())
}

export function getRateLimitStats(): RateLimitStatsResponse {
  return globalIpcRateLimiter.getStats(ipcChannelRegistry.listRegistered())
}

export function listRateLimitChannelRegistrations(): ChannelRegistration[] {
  return ipcChannelRegistry.list()
}

export function registerR8RateLimitChannels(definitions: readonly R8IpcChannelDefinition[]): ChannelRegistration[] {
  return registerRateLimitChannelDefinitions(definitions)
}

export function overrideRateLimitChannelClass(channel: string, rateClass: RateLimitClass): ChannelRegistration {
  return ipcChannelRegistry.overrideRateClass(channel, rateClass)
}

export function assertRateLimitChannelsRegistered(channels: Iterable<string>): void {
  ipcChannelRegistry.assertRegistered(channels)
}

export {
  setRateLimitAuditSink,
  setRateLimitFeatureFlagProvider,
  type RateLimitAuditEvent
}
