import { describe, expect, it } from 'vitest'
import { rateLimitStatsResponseSchema } from '@shared/schemas/ipc-rate-limit'
import { notificationSchema } from '@shared/schemas/notification'
import { watchdogStatusSchema } from '@shared/schemas/r8-runtime'
import { SnapshotBuilder } from './SnapshotBuilder'

describe('SnapshotBuilder', () => {
  it('marks health degraded when reject-rate and state violations cross spec thresholds', () => {
    const builder = new SnapshotBuilder()
    const now = 1_000_000
    const rateLimitStats = rateLimitStatsResponseSchema.parse({
      generatedAt: now,
      windowMs: 60_000,
      perChannel: [{
        channel: 'obs:get-snapshot',
        rateClass: 'medium_query',
        totalRequests: 20,
        allowedRequests: 17,
        rejectedRequests: 3,
        rejectRate: 0.15,
        windowStart: now - 60_000,
        windowMs: 60_000,
        limitRpm: 60,
        remainingTokens: 10,
        lastAllowedAt: now,
        lastRejectedAt: now
      }]
    })
    const notification = notificationSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      level: 'WARN',
      source: 'system',
      title: 'Local runtime warning',
      body: 'Local warning',
      ts: now,
      channels: ['toast'],
      actions: [],
      dismissedAt: null,
      aggregationKey: 'WARN:system:local-runtime',
      occurrenceCount: 1,
      metadata: {}
    })
    const watchdogStatus = watchdogStatusSchema.parse({
      enabled: true,
      heartbeatTimeoutMs: 60_000,
      restartCount: 0,
      lastHeartbeatAt: now,
      state: 'healthy',
      isHealthy: true,
      monitoredInstances: []
    })
    const samples = builder.deriveCurrentSamples({
      collectedAt: now,
      config: { ringBufferMinutes: 30, samplingHz: 1, exportEnabled: true },
      notifications: [notification],
      rateLimitStats,
      runtimeSnapshot: null,
      signalSnapshots: [],
      stateSnapshots: [{
        instanceId: 'codex-1',
        system: 'alive',
        task: 'running',
        ui: 'normal',
        lastTransitions: [],
        assertionViolations: Array.from({ length: 6 }, (_, index) => ({
          rule: `rule-${index}`,
          severity: 'warning' as const,
          message: 'violation',
          detectedAt: now,
          resolvedAt: null
        })),
        updatedAt: now
      }],
      shimInstalledCount: 1,
      shimTotalCount: 3,
      watchdogStatus,
      csvThroughputPerMin: 2,
      injectAttempts: 4,
      injectSuccesses: 3
    })
    const snapshot = builder.build({
      collectedAt: now,
      config: { ringBufferMinutes: 30, samplingHz: 1, exportEnabled: true },
      existingSamples: samples,
      notifications: [notification],
      rateLimitStats,
      runtimeSnapshot: null,
      signalSnapshots: [],
      stateSnapshots: [{
        instanceId: 'codex-1',
        system: 'alive',
        task: 'running',
        ui: 'normal',
        lastTransitions: [],
        assertionViolations: Array.from({ length: 6 }, (_, index) => ({
          rule: `rule-${index}`,
          severity: 'warning' as const,
          message: 'violation',
          detectedAt: now,
          resolvedAt: null
        })),
        updatedAt: now
      }],
      shimInstalledCount: 1,
      shimTotalCount: 3,
      watchdogStatus,
      csvThroughputPerMin: 2,
      injectAttempts: 4,
      injectSuccesses: 3,
      windowStart: now - 60_000,
      windowEnd: now
    })

    expect(new Set(snapshot.metrics.map(metric => metric.kind)).size).toBe(11)
    expect(snapshot.globalCounters.totalRateLimited).toBe(3)
    expect(snapshot.globalCounters.totalAssertionViolations).toBe(6)
    expect(snapshot.health.overall).toBe('degraded')
    expect(snapshot.health.issues.join(' ')).toContain('reject rate')
  })
})
