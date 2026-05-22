import { useMemo } from 'react'
import type { ObservabilityMetricSample } from '@shared/schemas/r8-runtime'

interface MetricChartProps {
  color: string
  samples: readonly ObservabilityMetricSample[]
}

export function MetricChart({ color, samples }: MetricChartProps) {
  const width = 320
  const height = 84
  const padding = 8
  const plotted = useMemo(() => {
    const finite = samples.filter(sample => Number.isFinite(sample.value))
    if (finite.length === 0) {
      return []
    }

    const values = finite.map(sample => sample.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const spread = max - min || 1
    return finite.map((sample, index) => ({
      ...sample,
      x: padding + ((width - padding * 2) * index) / Math.max(finite.length - 1, 1),
      y: height - padding - ((sample.value - min) / spread) * (height - padding * 2)
    }))
  }, [samples])

  if (plotted.length === 0) {
    return (
      <div className="h-[84px] flex items-center justify-center text-xs text-text-muted border border-surface-700 radius-sm">
        No local samples
      </div>
    )
  }

  return (
    <svg className="w-full h-[84px]" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        points={plotted.map(point => `${point.x},${point.y}`).join(' ')}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      {plotted.map((point, index) => (
        <circle
          key={`${point.kind}-${point.ts}-${index}`}
          cx={point.x}
          cy={point.y}
          fill={color}
          r="2.5"
        />
      ))}
    </svg>
  )
}
