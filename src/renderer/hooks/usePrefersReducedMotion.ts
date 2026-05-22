import { useMediaQueryPreference } from './useMediaQueryPreference'

export function usePrefersReducedMotion(): boolean {
  return useMediaQueryPreference('(prefers-reduced-motion: reduce)')
}
