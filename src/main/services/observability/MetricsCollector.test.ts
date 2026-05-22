import { describe, expect, it } from 'vitest'
import type { MetricSample } from '@shared/observability'
import { CPU_AVERAGE_WINDOW_MS, computeMetricWindowAverage } from './MetricsCollector'

describe('computeMetricWindowAverage', () => {
  it('averages only finite samples inside the requested time window', () => {
    const now = 1_000_000
    const samples: MetricSample[] = [
      { ts: now - CPU_AVERAGE_WINDOW_MS - 1, v: 100 },
      { ts: now - CPU_AVERAGE_WINDOW_MS, v: 2 },
      { ts: now - 1_000, v: Number.NaN },
      { ts: now, v: 4 },
      { ts: now + 1, v: 50 }
    ]

    expect(computeMetricWindowAverage(samples, now)).toBe(3)
  })

  it('returns zero when the window has no finite samples', () => {
    const now = 1_000_000
    const samples: MetricSample[] = [
      { ts: now - CPU_AVERAGE_WINDOW_MS - 10, v: 5 },
      { ts: now - 1_000, v: Number.POSITIVE_INFINITY }
    ]

    expect(computeMetricWindowAverage(samples, now)).toBe(0)
  })

  it('rounds the average to one decimal place', () => {
    const now = 10_000
    const samples: MetricSample[] = [
      { ts: now - 2_000, v: 1 },
      { ts: now - 1_000, v: 2 }
    ]

    expect(computeMetricWindowAverage(samples, now, 5_000)).toBe(1.5)
  })
})
