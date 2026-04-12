import { useEffect } from 'react'
import { useWindowSize } from './useWindowSize'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const BREAKPOINTS: { name: Breakpoint; minWidth: number }[] = [
  { name: 'xl', minWidth: 1800 },
  { name: 'lg', minWidth: 1400 },
  { name: 'md', minWidth: 1000 },
  { name: 'sm', minWidth: 640 },
  { name: 'xs', minWidth: 0 },
]

function getBreakpoint(width: number): Breakpoint {
  for (const bp of BREAKPOINTS) {
    if (width >= bp.minWidth) return bp.name
  }
  return 'xs'
}

/**
 * Sets `data-breakpoint` attribute on <html> based on window width.
 * This drives CSS variable overrides defined in theme-tokens.css.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowSize()
  const breakpoint = getBreakpoint(width)

  useEffect(() => {
    document.documentElement.dataset.breakpoint = breakpoint
  }, [breakpoint])

  return breakpoint
}
