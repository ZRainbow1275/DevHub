import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ObservabilitySnapshot } from '@shared/schemas/r8-runtime'
import { ObservabilityPanel } from './ObservabilityPanel'

function snapshot(): ObservabilitySnapshot {
  const now = 1_000_000
  return {
    collectedAt: now,
    windowStart: now - 30 * 60_000,
    windowEnd: now,
    metrics: [
      { kind: 'ipc-rpm', ts: now - 1000, value: 12, labels: { channel: 'obs:get-snapshot' } },
      { kind: 'rate-limit-reject', ts: now - 1000, value: 0 },
      { kind: 'notification-emit', ts: now - 1000, value: 3 },
      { kind: 'state-transition', ts: now - 1000, value: 5 },
      { kind: 'fusion-confidence', ts: now - 1000, value: 0.72 },
      { kind: 'memory-rss', ts: now - 1000, value: 128, labels: { process: 'main' } },
      { kind: 'cpu-pct', ts: now - 1000, value: 8 },
      { kind: 'shim-status', ts: now - 1000, value: 0.5 },
      { kind: 'watchdog-heartbeat', ts: now - 1000, value: 1 },
      { kind: 'csv-row-throughput', ts: now - 1000, value: 2 },
      { kind: 'inject-success-rate', ts: now - 1000, value: 1 }
    ],
    globalCounters: {
      totalIpcRequests: 12,
      totalRateLimited: 0,
      totalNotifications: 3,
      totalAssertionViolations: 0,
      activeInstances: 1
    },
    health: {
      overall: 'healthy',
      issues: []
    }
  }
}

describe('ObservabilityPanel', () => {
  it('renders all spec-32 metric cards and cleans up the stream subscription', () => {
    const cleanup = vi.fn()
    const subscribe = vi.fn(() => cleanup)
    const { unmount } = render(
      <ObservabilityPanel
        onExportCsv={vi.fn()}
        onExportJson={vi.fn()}
        snapshot={snapshot()}
        subscribe={subscribe}
      />
    )

    expect(screen.getByTestId('observability-panel')).toBeInTheDocument()
    expect(screen.getByTestId('observability-metric-grid').children).toHaveLength(11)
    expect(screen.getByText('healthy')).toBeInTheDocument()
    expect(subscribe).toHaveBeenCalledTimes(1)

    unmount()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('supports time cursor movement and JSON/CSV export actions', () => {
    const onExportCsv = vi.fn()
    const onExportJson = vi.fn()
    render(
      <ObservabilityPanel
        onExportCsv={onExportCsv}
        onExportJson={onExportJson}
        snapshot={snapshot()}
        subscribe={() => () => undefined}
      />
    )

    fireEvent.change(screen.getByLabelText('Observability time cursor'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(onExportJson).toHaveBeenCalledTimes(1)
    expect(onExportCsv).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('observability-time-cursor')).toBeInTheDocument()
  })
})
