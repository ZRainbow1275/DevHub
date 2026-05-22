import { useMediaQueryPreference } from './useMediaQueryPreference'

export function usePrefersContrast(): boolean {
  return useMediaQueryPreference('(prefers-contrast: more), (forced-colors: active)')
}
