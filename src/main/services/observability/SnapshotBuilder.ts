import type { RateLimitStatsResponse } from '@shared/schemas/ipc-rate-limit'
import type { DevhubNotification, WatchdogStatus } from '@shared/schemas/r8-runtime'
import type { InstanceState } from '@shared/schemas/state-machine'
import type { SignalContributionSnapshot } from '@shared/schemas/signal-fusion'
import type {
  ObservabilityConfig,
  ObservabilityMetricSample,
  ObservabilitySnapshot
} from '@shared/schemas/observability'
import {
  metricSampleSchema,
  observabilitySnapshotSchema,
  type MetricKind
} from '@shared/schemas/observability'
import type { RuntimeMetricsSnapshot } from '@shared/observability'

export interface ObservabilityBuildInput {
  readonly collectedAt: number
  readonly config: ObservabilityConfig
  readonly existingSamples: readonly ObservabilityMetricSample[]
  readonly notifications: readonly DevhubNotification[]
  readonly rateLimitStats: RateLimitStatsResponse
  readonly runtimeSnapshot: RuntimeMetricsSnapshot | null
  readonly signalSnapshots: readonly SignalContributionSnapshot[]
  readonly stateSnapshots: readonly InstanceState[]
  readonly shimInstalledCount: number
  readonly shimTotalCount: number
  readonly watchdogStatus: WatchdogStatus
  readonly csvThroughputPerMin: number
  readonly injectAttempts: number
  readonly injectSuccesses: number
  readonly windowStart: number
  readonly windowEnd: number
}

function latestValue(samples: readonly { v: number }[]): number {
  const value = samples.at(-1)?.v ?? 0
  return Number.isFinite(value) ? value : 0
}

function sample(kind: MetricKind, ts: number, value: number, labels?: Record<string, string>): ObservabilityMetricSample {
  return metricSampleSchema.parse({
    kind,
    ts,
    value: Number.isFinite(value) ? value : 0,
    labels
  })
}

function average(values: readonly number[]): number {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) {
    return 0
  }

  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}

export class SnapshotBuilder {
  deriveCurrentSamples(input: Omit<ObservabilityBuildInput, 'existingSamples' | 'windowStart' | 'windowEnd'>): ObservabilityMetricSample[] {
    const ts = input.collectedAt
    const runtimeSnapshot = input.runtimeSnapshot
    const totalRejected = input.rateLimitStats.perChannel.reduce((sum, row) => sum + row.rejectedRequests, 0)
    const totalTransitions = input.stateSnapshots.reduce((sum, state) => sum + state.lastTransitions.length, 0)
    const totalNotifications = input.notifications.length
    const fusionConfidence = average(input.signalSnapshots.map(item => item.fusedProgress.confidence))
    const watchdogFreshnessMs = input.watchdogStatus.lastHeartbeatAt ? ts - input.watchdogStatus.lastHeartbeatAt : 0
    const injectSuccessRate = input.injectAttempts === 0 ? 1 : input.injectSuccesses / input.injectAttempts

    return [
      sample('ipc-rpm', ts, runtimeSnapshot?.ipcRpm.top.reduce((sum, row) => sum + row.rpm, 0) ?? 0, { scope: 'all-channels' }),
      sample('rate-limit-reject', ts, totalRejected, { windowMs: String(input.rateLimitStats.windowMs) }),
      sample('notification-emit', ts, totalNotifications, { source: 'local-history' }),
      sample('state-transition', ts, totalTransitions, { source: 'state-machine' }),
      sample('fusion-confidence', ts, fusionConfidence, { source: 'signal-fusion' }),
      sample('memory-rss', ts, latestValue(runtimeSnapshot?.mainRss.items ?? []), { process: 'main' }),
      sample('memory-rss', ts, latestValue(runtimeSnapshot?.rendererRss.items ?? []), { process: 'renderer' }),
      sample('cpu-pct', ts, runtimeSnapshot?.cpuNow ?? 0, { process: 'main' }),
      sample('shim-status', ts, input.shimTotalCount === 0 ? 0 : input.shimInstalledCount / input.shimTotalCount, {
        installed: String(input.shimInstalledCount),
        total: String(input.shimTotalCount)
      }),
      sample('watchdog-heartbeat', ts, input.watchdogStatus.isHealthy ? 1 : 0, {
        state: input.watchdogStatus.state,
        freshnessMs: String(Math.max(0, watchdogFreshnessMs))
      }),
      sample('csv-row-throughput', ts, input.csvThroughputPerMin, { source: 'task-queue' }),
      sample('inject-success-rate', ts, injectSuccessRate, { attempts: String(input.injectAttempts) })
    ]
  }

  build(input: ObservabilityBuildInput): ObservabilitySnapshot {
    const metrics = input.existingSamples
      .filter(sample => sample.ts >= input.windowStart && sample.ts <= input.windowEnd)
      .sort((left, right) => left.ts - right.ts || left.kind.localeCompare(right.kind))
    const counters = this.buildCounters(input)
    const health = this.buildHealth(input, counters)

    return observabilitySnapshotSchema.parse({
      collectedAt: input.collectedAt,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      metrics,
      globalCounters: counters,
      health
    })
  }

  private buildCounters(input: ObservabilityBuildInput): ObservabilitySnapshot['globalCounters'] {
    const totalIpcRequests = input.rateLimitStats.perChannel.reduce((sum, row) => sum + row.totalRequests, 0)
    const totalRateLimited = input.rateLimitStats.perChannel.reduce((sum, row) => sum + row.rejectedRequests, 0)
    const totalAssertionViolations = input.stateSnapshots.reduce((sum, state) => sum + state.assertionViolations.length, 0)
    const activeInstances = Math.max(
      input.stateSnapshots.length,
      input.signalSnapshots.length,
      input.watchdogStatus.monitoredInstances.length
    )

    return {
      totalIpcRequests,
      totalRateLimited,
      totalNotifications: input.notifications.length,
      totalAssertionViolations,
      activeInstances
    }
  }

  private buildHealth(
    input: ObservabilityBuildInput,
    counters: ObservabilitySnapshot['globalCounters']
  ): ObservabilitySnapshot['health'] {
    const issues: string[] = []
    const maxRejectRate = input.rateLimitStats.perChannel.reduce((max, row) => Math.max(max, row.rejectRate), 0)
    const latestMainRss = latestValue(input.runtimeSnapshot?.mainRss.items ?? [])
    const recentErrors = input.runtimeSnapshot?.extended.recentErrors.length ?? 0

    if (maxRejectRate > 0.1) {
      issues.push(`rate-limit reject rate ${(maxRejectRate * 100).toFixed(1)}% exceeds 10%`)
    }
    if (counters.totalAssertionViolations > 5) {
      issues.push(`state assertion violations ${counters.totalAssertionViolations} exceeds 5`)
    }
    if (!input.watchdogStatus.isHealthy || ['failed', 'stuck', 'dead'].includes(input.watchdogStatus.state)) {
      issues.push(`watchdog state is ${input.watchdogStatus.state}`)
    }
    if (latestMainRss > 300) {
      issues.push(`main process RSS ${latestMainRss.toFixed(1)} MB exceeds 300 MB`)
    }
    if (recentErrors > 5) {
      issues.push(`recent runtime errors ${recentErrors} exceeds 5`)
    }

    const unhealthy = maxRejectRate > 0.25
      || counters.totalAssertionViolations > 20
      || ['failed', 'stuck', 'dead'].includes(input.watchdogStatus.state)
      || latestMainRss > 500
    const degraded = issues.length > 0

    return {
      overall: unhealthy ? 'unhealthy' : degraded ? 'degraded' : 'healthy',
      issues
    }
  }
}
