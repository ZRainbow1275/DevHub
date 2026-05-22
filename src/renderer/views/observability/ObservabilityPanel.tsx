import { useEffect, useMemo, useState } from 'react'
import type {
  MetricKind,
  ObservabilityMetricSample,
  ObservabilitySnapshot
} from '@shared/schemas/r8-runtime'
import { MetricChart } from './MetricChart'
import { TimeCursor } from './TimeCursor'

const METRIC_ORDER: MetricKind[] = [
  'ipc-rpm',
  'rate-limit-reject',
  'notification-emit',
  'state-transition',
  'fusion-confidence',
  'memory-rss',
  'cpu-pct',
  'shim-status',
  'watchdog-heartbeat',
  'csv-row-throughput',
  'inject-success-rate'
]

const METRIC_LABEL: Record<MetricKind, string> = {
  'ipc-rpm': 'IPC RPM',
  'rate-limit-reject': 'Rate Limit Rejects',
  'notification-emit': 'Notifications',
  'state-transition': 'State Transitions',
  'fusion-confidence': 'Fusion Confidence',
  'memory-rss': 'Memory RSS',
  'cpu-pct': 'CPU Percent',
  'shim-status': 'SHIM Status',
  'watchdog-heartbeat': 'Watchdog Heartbeat',
  'csv-row-throughput': 'CSV Throughput',
  'inject-success-rate': 'Inject Success Rate'
}

const METRIC_COLOR: Record<MetricKind, string> = {
  'ipc-rpm': '#38bdf8',
  'rate-limit-reject': '#fb7185',
  'notification-emit': '#a78bfa',
  'state-transition': '#f97316',
  'fusion-confidence': '#22c55e',
  'memory-rss': '#f59e0b',
  'cpu-pct': '#06b6d4',
  'shim-status': '#84cc16',
  'watchdog-heartbeat': '#10b981',
  'csv-row-throughput': '#818cf8',
  'inject-success-rate': '#14b8a6'
}

interface ObservabilityPanelProps {
  onExportCsv: () => void
  onExportJson: () => void
  snapshot: ObservabilitySnapshot | null
  subscribe: (listener: (samples: ObservabilityMetricSample[]) => void) => () => void
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }
  if (Math.abs(value) >= 100) {
    return Math.round(value).toLocaleString()
  }
  return value.toFixed(2)
}

function latestSample(samples: readonly ObservabilityMetricSample[]): ObservabilityMetricSample | null {
  return samples.length > 0 ? samples[samples.length - 1] : null
}

function labelsToText(labels: Record<string, string> | undefined): string {
  if (!labels) {
    return 'local'
  }
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(' / ')
}

export function ObservabilityPanel({
  onExportCsv,
  onExportJson,
  snapshot,
  subscribe
}: ObservabilityPanelProps) {
  const [cursorTs, setCursorTs] = useState<number | null>(null)
  const [streamCount, setStreamCount] = useState(0)

  useEffect(() => {
    return subscribe((samples) => {
      setStreamCount(current => current + samples.length)
    })
  }, [subscribe])

  useEffect(() => {
    if (snapshot && (cursorTs === null || cursorTs > snapshot.windowEnd)) {
      setCursorTs(snapshot.windowEnd)
    }
  }, [cursorTs, snapshot])

  const effectiveCursor = cursorTs ?? snapshot?.windowEnd ?? Date.now()
  const metricsByKind = useMemo(() => {
    const grouped = new Map<MetricKind, ObservabilityMetricSample[]>()
    for (const kind of METRIC_ORDER) {
      grouped.set(kind, [])
    }
    for (const metric of snapshot?.metrics ?? []) {
      if (metric.ts <= effectiveCursor) {
        grouped.get(metric.kind)?.push(metric)
      }
    }
    return grouped
  }, [effectiveCursor, snapshot])

  if (!snapshot) {
    return (
      <section className="border border-surface-700 bg-surface-900/80 p-4 radius-md" data-testid="observability-panel-empty">
        <div className="text-sm text-text-muted">Waiting for local observability snapshot.</div>
      </section>
    )
  }

  return (
    <section className="space-y-4" data-testid="observability-panel">
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-surface-700 bg-surface-900/80 p-3 radius-md">
          <div className="text-xs uppercase tracking-[0.24em] text-text-muted">Health</div>
          <div className={`text-xl font-semibold mt-1 ${snapshot.health.overall === 'healthy' ? 'text-success' : snapshot.health.overall === 'degraded' ? 'text-amber-300' : 'text-error'}`}>
            {snapshot.health.overall}
          </div>
          <div className="text-xs text-text-muted mt-2">
            {snapshot.health.issues.length === 0 ? 'No local issues detected' : snapshot.health.issues.join(' / ')}
          </div>
        </div>
        <div className="border border-surface-700 bg-surface-900/80 p-3 radius-md">
          <div className="text-xs uppercase tracking-[0.24em] text-text-muted">Counters</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-secondary mt-2">
            <span>IPC {snapshot.globalCounters.totalIpcRequests}</span>
            <span>Rejected {snapshot.globalCounters.totalRateLimited}</span>
            <span>Notify {snapshot.globalCounters.totalNotifications}</span>
            <span>Violations {snapshot.globalCounters.totalAssertionViolations}</span>
            <span>Instances {snapshot.globalCounters.activeInstances}</span>
            <span>Stream {streamCount}</span>
          </div>
        </div>
      </div>

      <TimeCursor
        cursorTs={effectiveCursor}
        onChange={setCursorTs}
        windowEnd={snapshot.windowEnd}
        windowStart={snapshot.windowStart}
      />

      <div className="flex items-center justify-end gap-2">
        <button className="px-3 py-1.5 text-sm border border-surface-600 radius-sm" onClick={onExportJson} type="button">
          Export JSON
        </button>
        <button className="px-3 py-1.5 text-sm border border-surface-600 radius-sm" onClick={onExportCsv} type="button">
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3" data-testid="observability-metric-grid">
        {METRIC_ORDER.map((kind) => {
          const samples = metricsByKind.get(kind) ?? []
          const latest = latestSample(samples)
          return (
            <article key={kind} className="border border-surface-700 bg-surface-950/70 p-3 radius-md" data-testid={`observability-metric-${kind}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-text-muted">{METRIC_LABEL[kind]}</div>
                  <div className="text-xs text-text-muted mt-1">{labelsToText(latest?.labels)}</div>
                </div>
                <div className="text-lg font-semibold text-text-primary">
                  {formatNumber(latest?.value ?? Number.NaN)}
                </div>
              </div>
              <MetricChart color={METRIC_COLOR[kind]} samples={samples} />
            </article>
          )
        })}
      </div>
    </section>
  )
}
