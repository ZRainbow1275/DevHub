import { memo, useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
  threshold?: number
  animate?: boolean
  className?: string
}

/**
 * Sparkline: A compact, inline trend chart for time-series data.
 * Renders an SVG polyline with optional area fill and threshold line.
 */
export const Sparkline = memo(function Sparkline({
  data,
  width = 80,
  height = 20,
  color = 'var(--accent)',
  fillOpacity = 0.15,
  threshold,
  animate = true,
  className = ''
}: SparklineProps) {
  const { linePath, areaPath, maxVal } = useMemo(() => {
    if (!data || data.length === 0) {
      return { linePath: '', areaPath: '', maxVal: 0 }
    }

    const padding = 1
    const effectiveWidth = width - padding * 2
    const effectiveHeight = height - padding * 2

    const maxVal = Math.max(...data, 1) // at least 1 to avoid division by zero
    const points = data.map((value, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * effectiveWidth
      const y = padding + effectiveHeight - (value / maxVal) * effectiveHeight
      return { x, y }
    })

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

    // Area path: line + close to bottom
    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]
    const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${(height - padding).toFixed(1)} L ${firstPoint.x.toFixed(1)} ${(height - padding).toFixed(1)} Z`

    return { linePath, areaPath, maxVal }
  }, [data, width, height])

  if (!data || data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
        aria-label="No data"
      >
        <line
          x1={1}
          y1={height / 2}
          x2={width - 1}
          y2={height / 2}
          stroke="var(--surface-600)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    )
  }

  const padding = 1
  const effectiveHeight = height - padding * 2

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={`Sparkline: min ${Math.min(...data).toFixed(1)}, max ${Math.max(...data).toFixed(1)}`}
    >
      {/* Area fill */}
      {fillOpacity > 0 && (
        <path
          d={areaPath}
          fill={color}
          opacity={fillOpacity}
          className={animate ? 'transition-all duration-500' : ''}
        />
      )}

      {/* Threshold line */}
      {threshold !== undefined && maxVal > 0 && (
        <line
          x1={0}
          y1={padding + effectiveHeight - (threshold / maxVal) * effectiveHeight}
          x2={width}
          y2={padding + effectiveHeight - (threshold / maxVal) * effectiveHeight}
          stroke="var(--error)"
          strokeWidth={0.5}
          strokeDasharray="2 1"
          opacity={0.5}
        />
      )}

      {/* Main line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animate ? 'transition-all duration-500' : ''}
      />

      {/* Current value dot (last point) */}
      {data.length > 0 && (
        <circle
          cx={width - padding}
          cy={padding + effectiveHeight - (data[data.length - 1] / maxVal) * effectiveHeight}
          r={2}
          fill={color}
          className={animate ? 'transition-all duration-500' : ''}
        />
      )}
    </svg>
  )
})
