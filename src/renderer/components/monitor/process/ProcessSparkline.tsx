import { useMemo } from 'react'
import type { ProcessHistory } from '@shared/schemas/r8-runtime'
import { useT } from '../../../hooks/useT'

export type ProcessSparklineMetric = 'cpu' | 'rssMb' | 'handles' | 'threads'

interface SegmentPoint {
  x: number
  y: number
}

type HistoryPoint = ProcessHistory['points'][number]

function metricValue(point: ProcessHistory['points'][number], metric: ProcessSparklineMetric): number | null {
  if (metric === 'cpu') return point.cpu
  if (metric === 'rssMb') return point.rssMb
  if (metric === 'handles') return typeof point.handles === 'number' ? point.handles : null
  return typeof point.threads === 'number' ? point.threads : null
}

function pointWithMetricValue(point: HistoryPoint, metric: ProcessSparklineMetric, value: number): HistoryPoint {
  if (metric === 'cpu') return { ...point, cpu: value }
  if (metric === 'rssMb') return { ...point, rssMb: value }
  if (metric === 'handles') return { ...point, handles: value }
  return { ...point, threads: value }
}

export function compactHistoryPoints(points: readonly HistoryPoint[], metric: ProcessSparklineMetric, maxPoints: number): HistoryPoint[] {
  if (points.length <= maxPoints) return [...points]
  const bucketSize = points.length / maxPoints
  const compacted: HistoryPoint[] = []

  for (let bucketIndex = 0; bucketIndex < maxPoints; bucketIndex += 1) {
    const startIndex = Math.floor(bucketIndex * bucketSize)
    const endIndex = Math.max(startIndex + 1, Math.floor((bucketIndex + 1) * bucketSize))
    const bucket = points.slice(startIndex, Math.min(endIndex, points.length))
    const fallbackPoint = bucket[bucket.length - 1] ?? points[Math.min(startIndex, points.length - 1)]
    if (!fallbackPoint) continue

    if (bucketIndex === maxPoints - 1) {
      compacted.push(points[points.length - 1] ?? fallbackPoint)
      continue
    }

    const values = bucket
      .filter(point => !point.missing)
      .map(point => metricValue(point, metric))
      .filter((value): value is number => typeof value === 'number')

    if (values.length === 0) {
      compacted.push({ ...fallbackPoint, missing: true })
      continue
    }

    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    compacted.push(pointWithMetricValue({ ...fallbackPoint, missing: false }, metric, average))
  }

  return compacted
}

export function ProcessSparkline({
  history,
  metric = 'cpu',
  width = 96,
  height = 20,
  color = 'var(--chart-series-1)',
  className,
  testId,
}: {
  history?: ProcessHistory
  metric?: ProcessSparklineMetric
  width?: number
  height?: number
  color?: string
  className?: string
  testId?: string
}) {
  const { t } = useT()
  const { paths, missingCount, latest } = useMemo(() => {
    const maxRenderPoints = Math.max(2, Math.min(160, Math.ceil(width / 2)))
    const points = compactHistoryPoints(history?.points ?? [], metric, maxRenderPoints)
    const values = points.map(point => metricValue(point, metric)).filter((value): value is number => typeof value === 'number')
    const max = Math.max(...values, 1)
    const padding = 1
    const drawableWidth = width - padding * 2
    const drawableHeight = height - padding * 2
    const segments: SegmentPoint[][] = []
    let current: SegmentPoint[] = []
    let missing = 0
    points.forEach((point, index) => {
      const value = metricValue(point, metric)
      if (value === null || point.missing) {
        missing += 1
        if (current.length > 0) {
          segments.push(current)
          current = []
        }
        return
      }
      current.push({
        x: padding + (index / Math.max(points.length - 1, 1)) * drawableWidth,
        y: padding + drawableHeight - (value / max) * drawableHeight,
      })
    })
    if (current.length > 0) segments.push(current)
    return {
      paths: segments.map(segment => segment.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')),
      missingCount: missing,
      latest: values[values.length - 1],
    }
  }, [height, history?.points, metric, width])

  if (!history || history.points.length < 2 || paths.length === 0) {
    return (
      <svg
        aria-label={t('statusbar.history.unavailable', '24h history unavailable')}
        className={className}
        data-testid={testId}
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <line stroke="var(--chart-grid-color)" strokeDasharray="2 2" strokeWidth={1} x1={1} x2={width - 1} y1={height / 2} y2={height / 2} />
      </svg>
    )
  }

  return (
    <svg
      aria-label={`24h ${metric} trend${missingCount > 0 ? ` with ${missingCount} gaps` : ''}`}
      className={className}
      data-latest={latest ?? ''}
      data-testid={testId}
      height={height}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {paths.map((path, index) => (
        <path
          d={path}
          fill="none"
          key={`${index}-${path}`}
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.4}
        />
      ))}
      {missingCount > 0 && (
        <line opacity={0.55} stroke="var(--chart-warning)" strokeDasharray="2 2" strokeWidth={0.8} x1={1} x2={width - 1} y1={height - 2} y2={height - 2} />
      )}
    </svg>
  )
}
