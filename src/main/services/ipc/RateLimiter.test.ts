import { describe, expect, it } from 'vitest'
import { IpcChannelRegistry } from './IpcChannelRegistry'
import { RateLimiter } from './RateLimiter'

describe('R8.C spec-31 IPC token bucket rate limiting', () => {
  it('enforces high_freq_scan at 30 RPM and rejects overflow with retryAfterMs', () => {
    let monotonic = 0
    let wallClock = 1_800_000_000_000
    const registry = new IpcChannelRegistry()
    const limiter = new RateLimiter({ nowMs: () => monotonic, wallClockMs: () => wallClock })
    const registration = registry.register({
      channel: 'ai:fusion-stream',
      rateClass: 'high_freq_scan',
      description: 'spec-31 high-frequency fusion stream'
    })

    const verdicts = Array.from({ length: 35 }, () => limiter.consume({ registration }))

    expect(verdicts.filter(verdict => verdict.allowed)).toHaveLength(30)
    expect(verdicts.filter(verdict => !verdict.allowed)).toHaveLength(5)
    expect(verdicts[30]).toMatchObject({
      allowed: false,
      channel: 'ai:fusion-stream',
      rateClass: 'high_freq_scan'
    })
    expect(verdicts[30].retryAfterMs).toBeGreaterThan(0)

    monotonic += 2_000
    wallClock += 2_000
    const refilled = limiter.consume({ registration })
    expect(refilled.allowed).toBe(true)
  })

  it('keeps all four rate classes in independent buckets', () => {
    const registry = new IpcChannelRegistry()
    const limiter = new RateLimiter({ nowMs: () => 0, wallClockMs: () => 1_800_000_000_000 })
    const high = registry.register({ channel: 'cli:event-stream', rateClass: 'high_freq_scan', description: 'high' })
    const medium = registry.register({ channel: 'cli:get-progress', rateClass: 'medium_query', description: 'medium' })
    const low = registry.register({ channel: 'csv:launch', rateClass: 'low_freq_op', description: 'low' })
    const meta = registry.register({ channel: 'ipc:rate-limit-stats', rateClass: 'meta', description: 'meta' })

    for (let index = 0; index < 30; index += 1) {
      expect(limiter.consume({ registration: high }).allowed).toBe(true)
    }
    expect(limiter.consume({ registration: high }).allowed).toBe(false)
    expect(limiter.consume({ registration: medium }).allowed).toBe(true)
    expect(limiter.consume({ registration: low }).allowed).toBe(true)
    expect(limiter.consume({ registration: meta }).allowed).toBe(true)
  })

  it('absorbs configured burstAllowance and rejects the next instantaneous request', () => {
    const registry = new IpcChannelRegistry()
    const limiter = new RateLimiter({ nowMs: () => 0, wallClockMs: () => 1_800_000_000_000 })
    const registration = registry.register({
      channel: 'ipc:burst-test',
      rateClass: 'high_freq_scan',
      burstAllowance: 5,
      description: 'burst override test',
      rpmOverride: 1
    })

    const verdicts = Array.from({ length: 6 }, () => limiter.consume({ registration }))

    expect(verdicts.slice(0, 5).every(verdict => verdict.allowed)).toBe(true)
    expect(verdicts[5].allowed).toBe(false)
    expect(verdicts[5].retryAfterMs).toBe(60_000)
  })

  it('reports per-channel one-minute stats for spec-32 observability', () => {
    const registry = new IpcChannelRegistry()
    const limiter = new RateLimiter({ nowMs: () => 0, wallClockMs: () => 1_800_000_000_000 })
    const registration = registry.register({
      channel: 'monitor:snapshot-stream',
      rateClass: 'high_freq_scan',
      description: 'stats test'
    })

    for (let index = 0; index < 31; index += 1) {
      limiter.consume({ registration })
    }

    const stats = limiter.getStats(registry.listRegistered()).perChannel.find(item => item.channel === registration.channel)
    expect(stats).toMatchObject({
      channel: 'monitor:snapshot-stream',
      rateClass: 'high_freq_scan',
      totalRequests: 31,
      allowedRequests: 30,
      rejectedRequests: 1,
      rejectRate: 1 / 31,
      windowStart: 1_800_000_000_000
    })
  })

  it('fails startup validation for channels without registry declarations', () => {
    const registry = new IpcChannelRegistry()
    registry.register({ channel: 'ipc:known', rateClass: 'meta', description: 'known' })

    expect(() => registry.assertRegistered(['ipc:known', 'ipc:missing'])).toThrow('IPC channel registry is missing rateClass declarations.')
  })

  it('records stats but does not reject when the rate-limit feature flag is off', () => {
    const registry = new IpcChannelRegistry()
    const limiter = new RateLimiter({ nowMs: () => 0, wallClockMs: () => 1_800_000_000_000 })
    const registration = registry.register({
      channel: 'ipc:flag-off',
      rateClass: 'high_freq_scan',
      burstAllowance: 0,
      description: 'flag off test',
      rpmOverride: 1
    })

    const verdicts = Array.from({ length: 3 }, () => limiter.consume({ registration, enabled: false }))
    const stats = limiter.getStats(registry.listRegistered()).perChannel.find(item => item.channel === registration.channel)

    expect(verdicts.every(verdict => verdict.allowed)).toBe(true)
    expect(stats).toMatchObject({
      totalRequests: 3,
      allowedRequests: 3,
      rejectedRequests: 0,
      rejectRate: 0
    })
  })
})
