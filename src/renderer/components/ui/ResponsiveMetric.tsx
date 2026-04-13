import { type ReactNode } from 'react'
import { formatMetric, type MetricFormat } from '../../utils/formatMetric'

interface ResponsiveMetricProps {
  value: number
  label?: string
  icon?: ReactNode
  variant?: 'hero' | 'stat' | 'inline'
  format?: MetricFormat
}

/**
 * A responsive metric display component that adapts its formatting
 * based on CSS Container Query breakpoints.
 *
 * Renders three formatted versions of the value (full, compact, minimal)
 * and uses CSS container queries to show/hide the appropriate one.
 * No JS ResizeObserver needed.
 *
 * Container breakpoints (defined in globals.css):
 * - >= 800px: full mode   (e.g. "12,345")
 * - >= 500px: compact mode (e.g. "12.3K")
 * - <  500px: minimal mode (e.g. "12K")
 */
export function ResponsiveMetric({
  value,
  label,
  icon,
  variant = 'stat',
  format = 'number',
}: ResponsiveMetricProps) {
  const fullText = formatMetric(value, format, 'full')
  const compactText = formatMetric(value, format, 'compact')
  const minimalText = formatMetric(value, format, 'minimal')

  const variantClass = `responsive-metric--${variant}`

  return (
    <span className={`responsive-metric ${variantClass}`}>
      {icon && <span className="responsive-metric__icon">{icon}</span>}
      <span className="responsive-metric__value">
        <span className="responsive-metric__full">{fullText}</span>
        <span className="responsive-metric__compact">{compactText}</span>
        <span className="responsive-metric__minimal">{minimalText}</span>
      </span>
      {label && <span className="responsive-metric__label">{label}</span>}
    </span>
  )
}
