import { performance } from 'node:perf_hooks'
import {
  RATE_LIMIT_RPM,
  rateLimitStatsResponseSchema,
  rateLimitStatsSchema,
  rateLimitVerdictSchema,
  type ChannelRegistration,
  type RateLimitStats,
  type RateLimitStatsResponse,
  type RateLimitVerdict
} from '@shared/schemas/ipc-rate-limit'
import type { IpcThrottleReport } from '@shared/observability'
import type { RegisteredIpcChannel } from './IpcChannelRegistry'

interface TokenBucket {
  tokens: number
  updatedAtMs: number
}

interface ChannelWindowStats {
  totalRequests: number
  allowedRequests: number
  rejectedRequests: number
  windowStart: number
  lastAllowedAt: number | null
  lastRejectedAt: number | null
  lastRemainingTokens: number
}

export interface RateLimiterOptions {
  readonly nowMs?: () => number
  readonly wallClockMs?: () => number
  readonly windowMs?: number
  readonly maxBuckets?: number
}

export interface ConsumeRateLimitOptions {
  readonly registration: RegisteredIpcChannel
  readonly senderId?: string
  readonly enabled?: boolean
}

export interface RateLimitErrorWithCode extends Error {
  code: 'E_RATE_LIMITED'
  retryAfterMs: number
  verdict: RateLimitVerdict
}

const DEFAULT_WINDOW_MS = 60_000

function limitRpmFor(registration: RegisteredIpcChannel): number {
  return registration.rpmOverride ?? RATE_LIMIT_RPM[registration.rateClass]
}

function capacityFor(registration: RegisteredIpcChannel): number {
  return Math.max(limitRpmFor(registration), registration.burstAllowance)
}

function bucketKeyFor(registration: ChannelRegistration, senderId?: string): string {
  if (!registration.perSenderBucket) return registration.channel
  return `${registration.channel}::sender:${senderId ?? 'unknown'}`
}

function emptyStats(now: number): ChannelWindowStats {
  return {
    totalRequests: 0,
    allowedRequests: 0,
    rejectedRequests: 0,
    windowStart: now,
    lastAllowedAt: null,
    lastRejectedAt: null,
    lastRemainingTokens: 0
  }
}

export function createRateLimitError(verdict: RateLimitVerdict): RateLimitErrorWithCode {
  const error = new Error(`Rate limit exceeded for ${verdict.channel} (E_RATE_LIMITED; retry after ${verdict.retryAfterMs}ms)`) as RateLimitErrorWithCode
  error.name = 'RateLimitError'
  error.code = 'E_RATE_LIMITED'
  error.retryAfterMs = verdict.retryAfterMs
  error.verdict = verdict
  return error
}

export class RateLimiter {
  private readonly buckets = new Map<string, TokenBucket>()
  private readonly stats = new Map<string, ChannelWindowStats>()
  private readonly nowMs: () => number
  private readonly wallClockMs: () => number
  private readonly windowMs: number
  private readonly maxBuckets: number

  constructor(options: RateLimiterOptions = {}) {
    this.nowMs = options.nowMs ?? (() => performance.now())
    this.wallClockMs = options.wallClockMs ?? (() => Date.now())
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
    this.maxBuckets = options.maxBuckets ?? 512
  }

  consume(options: ConsumeRateLimitOptions): RateLimitVerdict {
    const registration = options.registration
    const now = this.nowMs()
    const wallClock = Math.floor(this.wallClockMs())
    const key = bucketKeyFor(registration, options.senderId)
    const limitRpm = limitRpmFor(registration)
    const capacity = capacityFor(registration)
    const bucket = this.getBucket(key, capacity, now)
    const enabled = options.enabled ?? true

    this.refill(bucket, registration, now)

    const allowed = !enabled || bucket.tokens >= 1
    const remainingTokens = allowed && enabled ? Math.max(bucket.tokens - 1, 0) : Math.max(bucket.tokens, 0)
    const retryAfterMs = allowed ? 0 : this.retryAfterMs(bucket.tokens, limitRpm)

    if (allowed && enabled) {
      bucket.tokens = remainingTokens
    }

    const verdict = rateLimitVerdictSchema.parse({
      channel: registration.channel,
      allowed,
      rateClass: registration.rateClass,
      remainingTokens,
      retryAfterMs,
      ts: wallClock,
      bucketKey: key,
      limitRpm
    })

    this.recordStats(verdict)
    this.pruneBuckets(now)
    return verdict
  }

  getStats(registrations: readonly RegisteredIpcChannel[] = []): RateLimitStatsResponse {
    const generatedAt = Math.floor(this.wallClockMs())
    const byChannel = new Map<string, RegisteredIpcChannel>()
    for (const registration of registrations) {
      byChannel.set(registration.channel, registration)
    }
    for (const channel of this.stats.keys()) {
      if (!byChannel.has(channel)) {
        byChannel.set(channel, {
          channel,
          rateClass: 'medium_query',
          burstAllowance: 5,
          perSenderBucket: false,
          description: 'Implicit medium_query IPC channel'
        })
      }
    }

    const perChannel = Array.from(byChannel.values())
      .map(registration => this.toStats(registration, generatedAt))
      .sort((left, right) => left.channel.localeCompare(right.channel))

    return rateLimitStatsResponseSchema.parse({
      generatedAt,
      windowMs: this.windowMs,
      perChannel
    })
  }

  getLegacyReport(registrations: readonly RegisteredIpcChannel[] = []): IpcThrottleReport {
    const generatedAt = Math.floor(this.wallClockMs())
    const channels = Object.fromEntries(registrations.map(registration => {
      const stats = this.stats.get(registration.channel)
      const limitRpm = limitRpmFor(registration)
      const active = stats && generatedAt - stats.windowStart < this.windowMs
      return [
        registration.channel,
        {
        channel: registration.channel,
        limit: limitRpm,
        windowMs: this.windowMs,
        activeWindowCount: active ? stats.allowedRequests : 0,
        remaining: active ? Math.max(Math.floor(stats.lastRemainingTokens), 0) : limitRpm,
        allowed: stats?.allowedRequests ?? 0,
        rejected: stats?.rejectedRequests ?? 0,
        dropped: stats?.rejectedRequests ?? 0,
        coalesced: 0,
        resetAt: active ? stats.windowStart + this.windowMs : null,
        lastAllowedAt: stats?.lastAllowedAt ?? null,
        lastRejectedAt: stats?.lastRejectedAt ?? null
      }
      ]
    }))

    return {
      generatedAt,
      channels
    }
  }

  reset(): void {
    this.buckets.clear()
    this.stats.clear()
  }

  private getBucket(key: string, capacity: number, now: number): TokenBucket {
    const existing = this.buckets.get(key)
    if (existing) return existing

    const bucket = { tokens: capacity, updatedAtMs: now }
    this.buckets.set(key, bucket)
    return bucket
  }

  private refill(bucket: TokenBucket, registration: RegisteredIpcChannel, now: number): void {
    const elapsedMs = Math.max(now - bucket.updatedAtMs, 0)
    if (elapsedMs <= 0) return

    const limitRpm = limitRpmFor(registration)
    const refill = (elapsedMs / 60_000) * limitRpm
    bucket.tokens = Math.min(capacityFor(registration), bucket.tokens + refill)
    bucket.updatedAtMs = now
  }

  private retryAfterMs(currentTokens: number, limitRpm: number): number {
    if (limitRpm <= 0) return this.windowMs
    const missingTokens = Math.max(1 - currentTokens, 0)
    return Math.ceil((missingTokens / limitRpm) * 60_000)
  }

  private recordStats(verdict: RateLimitVerdict): void {
    const current = this.stats.get(verdict.channel) ?? emptyStats(verdict.ts)
    if (verdict.ts - current.windowStart >= this.windowMs) {
      this.stats.set(verdict.channel, {
        ...emptyStats(verdict.ts),
        totalRequests: 1,
        allowedRequests: verdict.allowed ? 1 : 0,
        rejectedRequests: verdict.allowed ? 0 : 1,
        lastAllowedAt: verdict.allowed ? verdict.ts : null,
        lastRejectedAt: verdict.allowed ? null : verdict.ts,
        lastRemainingTokens: verdict.remainingTokens
      })
      return
    }

    current.totalRequests += 1
    if (verdict.allowed) {
      current.allowedRequests += 1
      current.lastAllowedAt = verdict.ts
    } else {
      current.rejectedRequests += 1
      current.lastRejectedAt = verdict.ts
    }
    current.lastRemainingTokens = verdict.remainingTokens
    this.stats.set(verdict.channel, current)
  }

  private toStats(registration: RegisteredIpcChannel, now: number): RateLimitStats {
    const current = this.stats.get(registration.channel)
    const limitRpm = limitRpmFor(registration)
    if (!current || now - current.windowStart >= this.windowMs) {
      return rateLimitStatsSchema.parse({
        channel: registration.channel,
        rateClass: registration.rateClass,
        totalRequests: 0,
        allowedRequests: 0,
        rejectedRequests: 0,
        rejectRate: 0,
        windowStart: now,
        windowMs: this.windowMs,
        limitRpm,
        remainingTokens: Math.max(limitRpm, registration.burstAllowance),
        lastAllowedAt: null,
        lastRejectedAt: null
      })
    }

    const rejectRate = current.totalRequests === 0 ? 0 : current.rejectedRequests / current.totalRequests
    return rateLimitStatsSchema.parse({
      channel: registration.channel,
      rateClass: registration.rateClass,
      totalRequests: current.totalRequests,
      allowedRequests: current.allowedRequests,
      rejectedRequests: current.rejectedRequests,
      rejectRate,
      windowStart: current.windowStart,
      windowMs: this.windowMs,
      limitRpm,
      remainingTokens: current.lastRemainingTokens,
      lastAllowedAt: current.lastAllowedAt,
      lastRejectedAt: current.lastRejectedAt
    })
  }

  private pruneBuckets(now: number): void {
    if (this.buckets.size <= this.maxBuckets) return

    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAtMs > this.windowMs) {
        this.buckets.delete(key)
      }
      if (this.buckets.size <= this.maxBuckets) return
    }
  }
}

export const globalIpcRateLimiter = new RateLimiter()
