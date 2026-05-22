import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRateLimitReport, resetRateLimits, withRateLimit } from './rateLimiter'

describe('rateLimiter', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T00:00:00.000Z'))
  })

  afterEach(() => {
    resetRateLimits()
    vi.useRealTimers()
  })

  it('reports allowed and rejected attempts per channel', () => {
    const limited = withRateLimit('process:get-history', 2, () => 'ok')

    expect(limited()).toBe('ok')
    expect(limited()).toBe('ok')
    expect(() => limited()).toThrow('Rate limit exceeded for process:get-history')

    const report = getRateLimitReport()
    expect(report.channels['process:get-history']).toMatchObject({
      channel: 'process:get-history',
      limit: 2,
      windowMs: 60_000,
      activeWindowCount: 2,
      remaining: 0,
      allowed: 2,
      rejected: 1,
      dropped: 1,
      coalesced: 0
    })
    expect(report.channels['process:get-history'].lastAllowedAt).toBeTypeOf('number')
    expect(report.channels['process:get-history'].lastRejectedAt).toBeTypeOf('number')
  })

  it('keeps cumulative totals after the active window expires', () => {
    const limited = withRateLimit('scanner:snapshot', 1, () => true)

    expect(limited()).toBe(true)
    vi.advanceTimersByTime(60_001)

    const report = getRateLimitReport()
    expect(report.channels['scanner:snapshot']).toMatchObject({
      activeWindowCount: 0,
      remaining: 1,
      allowed: 1,
      rejected: 0,
      dropped: 0
    })
    expect(report.channels['scanner:snapshot'].resetAt).toBeNull()
  })
})
