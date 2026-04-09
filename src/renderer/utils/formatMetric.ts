/**
 * Responsive metric formatting utility.
 *
 * Provides three display modes that map to CSS container query breakpoints:
 * - full:    >= 800px container width
 * - compact: >= 500px container width
 * - minimal: <  500px container width
 */

export type MetricFormat = 'number' | 'percent' | 'bytes' | 'duration'
export type MetricMode = 'full' | 'compact' | 'minimal'

/**
 * Format a number with thousands separators.
 */
function formatFullNumber(value: number): string {
  return value.toLocaleString('en-US')
}

/**
 * Format a number in compact form (e.g. 12.3K, 1.2M).
 */
function formatCompactNumber(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) {
    const k = value / 1000
    return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`
  }
  if (value < 1_000_000_000) {
    const m = value / 1_000_000
    return m >= 100 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`
  }
  const b = value / 1_000_000_000
  return `${b.toFixed(1)}B`
}

/**
 * Format a number in minimal form (e.g. 12K, 1M).
 */
function formatMinimalNumber(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) {
    return `${Math.round(value / 1000)}K`
  }
  if (value < 1_000_000_000) {
    return `${Math.round(value / 1_000_000)}M`
  }
  return `${Math.round(value / 1_000_000_000)}B`
}

function formatPercent(value: number, mode: MetricMode): string {
  switch (mode) {
    case 'full':
      return `${value.toFixed(1)}%`
    case 'compact':
      return `${Math.round(value)}%`
    case 'minimal':
      return `${Math.round(value)}`
  }
}

function formatBytesMetric(valueMB: number, mode: MetricMode): string {
  switch (mode) {
    case 'full': {
      if (valueMB < 1024) return `${Math.round(valueMB)} MB`
      const gb = valueMB / 1024
      if (gb < 1024) return `${gb.toFixed(2)} GB`
      return `${(gb / 1024).toFixed(2)} TB`
    }
    case 'compact': {
      if (valueMB < 1024) return `${Math.round(valueMB)}MB`
      const gb = valueMB / 1024
      if (gb < 1024) return `${gb.toFixed(1)}G`
      return `${(gb / 1024).toFixed(1)}T`
    }
    case 'minimal': {
      if (valueMB < 1024) return `${Math.round(valueMB)}M`
      const gb = valueMB / 1024
      if (gb < 1024) return `${Math.round(gb)}G`
      return `${Math.round(gb / 1024)}T`
    }
  }
}

function formatDurationMetric(seconds: number, mode: MetricMode): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  switch (mode) {
    case 'full': {
      const parts: string[] = []
      if (h > 0) parts.push(`${h}h`)
      if (m > 0) parts.push(`${m}m`)
      parts.push(`${s}s`)
      return parts.join(' ')
    }
    case 'compact': {
      const parts: string[] = []
      if (h > 0) parts.push(`${h}h`)
      parts.push(`${m}m`)
      return parts.join(' ')
    }
    case 'minimal': {
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}`
      return `${m}:${String(s).padStart(2, '0')}`
    }
  }
}

/**
 * Format a metric value according to the given format and display mode.
 *
 * @param value - The raw numeric value
 * @param format - The type of metric ('number', 'percent', 'bytes', 'duration')
 * @param mode - Display density ('full', 'compact', 'minimal')
 * @returns Formatted string
 */
export function formatMetric(value: number, format: MetricFormat, mode: MetricMode): string {
  switch (format) {
    case 'number':
      switch (mode) {
        case 'full': return formatFullNumber(value)
        case 'compact': return formatCompactNumber(value)
        case 'minimal': return formatMinimalNumber(value)
      }
      break
    case 'percent':
      return formatPercent(value, mode)
    case 'bytes':
      return formatBytesMetric(value, mode)
    case 'duration':
      return formatDurationMetric(value, mode)
  }
}
