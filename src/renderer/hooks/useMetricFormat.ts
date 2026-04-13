import { useState, useEffect, type RefObject } from 'react'

/**
 * Display format tiers for responsive metric rendering.
 *
 * - full:    complete numbers (e.g. "1,234,567")
 * - short:   abbreviated with decimals (e.g. "1.2M", "3.4K")
 * - compact: abbreviated integers (e.g. "1M", "3K")
 * - icon:    no text, icon-only display
 */
export type DisplayFormat = 'full' | 'short' | 'compact' | 'icon'

/**
 * Format a numeric value according to the given display format tier.
 */
export function formatMetricDisplay(value: number, format: DisplayFormat): string {
  switch (format) {
    case 'full':
      return value.toLocaleString('en-US')
    case 'short':
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
      return String(value)
    case 'compact':
      if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`
      if (value >= 1_000) return `${Math.round(value / 1_000)}K`
      return String(value)
    case 'icon':
      return ''
  }
}

/**
 * Hook that monitors a container element's width via ResizeObserver
 * and returns the appropriate display format tier.
 *
 * Breakpoints:
 * - width < 150  -> 'icon'
 * - width < 250  -> 'compact'
 * - width < 400  -> 'short'
 * - width >= 400 -> 'full'
 */
export function useMetricFormat(containerRef: RefObject<HTMLElement | null>): DisplayFormat {
  const [format, setFormat] = useState<DisplayFormat>('full')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        if (width < 150) {
          setFormat('icon')
        } else if (width < 250) {
          setFormat('compact')
        } else if (width < 400) {
          setFormat('short')
        } else {
          setFormat('full')
        }
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef])

  return format
}
