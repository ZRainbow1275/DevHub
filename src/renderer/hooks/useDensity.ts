import { useState, useEffect, useCallback } from 'react'

export type DensityLevel = 'compact' | 'standard' | 'comfortable'

const DENSITY_STORAGE_KEY = 'devhub:density'

/**
 * Manages the information density setting.
 * Persists to localStorage and sets `data-density` attribute on <html>.
 */
export function useDensity() {
  const [density, setDensityState] = useState<DensityLevel>(() => {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY)
    if (stored === 'compact' || stored === 'standard' || stored === 'comfortable') {
      return stored
    }
    return 'standard'
  })

  useEffect(() => {
    document.documentElement.dataset.density = density
    localStorage.setItem(DENSITY_STORAGE_KEY, density)
  }, [density])

  // Also try to load from electron-store settings on mount
  useEffect(() => {
    window.devhub?.settings?.get?.().then((s: { appearance?: { informationDensity?: string } } | null) => {
      const saved = s?.appearance?.informationDensity
      if (saved === 'compact' || saved === 'standard' || saved === 'comfortable') {
        setDensityState(saved)
      }
    }).catch(() => {
      // Fallback: keep localStorage value
    })
  }, [])

  const setDensity = useCallback(async (level: DensityLevel) => {
    setDensityState(level)
    document.documentElement.dataset.density = level
    localStorage.setItem(DENSITY_STORAGE_KEY, level)
    await window.devhub?.settings?.update?.({
      appearance: { informationDensity: level }
    } as Parameters<typeof window.devhub.settings.update>[0])
  }, [])

  return { density, setDensity } as const
}
