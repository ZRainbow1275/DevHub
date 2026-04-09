import { memo } from 'react'
import { ResponsiveMetric } from './ResponsiveMetric'
import type { MetricFormat } from '../../utils/formatMetric'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color?: 'default' | 'accent' | 'gold' | 'success' | 'info' | 'warning' | 'error' | 'steel'
  subValue?: string
  /** When value is a number, specifies the format for responsive display. Defaults to 'number'. */
  metricFormat?: MetricFormat
}

const COLOR_CLASSES: Record<NonNullable<StatCardProps['color']>, { border: string; bg: string }> = {
  default: { border: 'border-surface-600', bg: '' },
  accent: { border: 'border-accent', bg: 'bg-accent/5' },
  gold: { border: 'border-gold', bg: 'bg-gold/5' },
  success: { border: 'border-success', bg: 'bg-success/5' },
  info: { border: 'border-info', bg: 'bg-info/5' },
  warning: { border: 'border-warning', bg: 'bg-warning/5' },
  error: { border: 'border-error', bg: 'bg-error/5' },
  steel: { border: 'border-steel', bg: 'bg-steel/5' }
}

export const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  color = 'default',
  subValue,
  metricFormat = 'number'
}: StatCardProps) {
  const colorConfig = COLOR_CLASSES[color]

  const renderValue = () => {
    if (typeof value === 'number') {
      return <ResponsiveMetric value={value} format={metricFormat} variant="stat" />
    }
    // String values (pre-formatted like "23.5%") rendered directly
    return value
  }

  return (
    <div
      className={`relative bg-surface-800 border-l-3 ${colorConfig.border} ${colorConfig.bg} p-4 transition-all duration-200 hover:bg-surface-700`}
      style={{ borderRadius: '2px' }}
    >
      {/* Diagonal decoration */}
      <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />

      <div className="flex items-center gap-3 relative z-10">
        <div
          className="w-10 h-10 bg-surface-700 flex items-center justify-center border-l-2 border-current"
          style={{ borderRadius: '2px' }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="stat-card-value font-bold text-text-primary tabular-nums overflow-hidden text-ellipsis"
            style={{
              fontFamily: 'var(--font-display)',
              lineHeight: '1.2'
            }}
          >
            {renderValue()}
          </div>
          <div className="text-xs text-text-muted uppercase tracking-wider">{label}</div>
          {subValue && (
            <div className="text-xs text-text-tertiary mt-0.5">{subValue}</div>
          )}
        </div>
      </div>
    </div>
  )
})
