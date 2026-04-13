import { useState, useEffect, useCallback, useRef } from 'react'

export type ThemeName = 'constructivism' | 'modern-light' | 'warm-light' | 'cyberpunk' | 'swiss'

export type FontStatus = 'idle' | 'loading' | 'loaded' | 'failed'

/** Fallback duration in ms for theme transition animation */
const THEME_TRANSITION_MS = 250

/** Maximum time to wait for fonts before proceeding with theme switch */
const FONT_TIMEOUT_MS = 1500

/**
 * Fonts required per theme. Preloaded on theme switch so glyphs are
 * ready before the transition ends.  Uses the Font Loading API
 * (FontFace.load) which is non-blocking and returns a Promise.
 */
const THEME_FONTS: Record<ThemeName, string[]> = {
  constructivism: ['400 1em "Oswald Variable"', '400 1em "Bebas Neue"', '400 1em "JetBrains Mono Variable"'],
  'modern-light': ['400 1em "Inter Variable"'],
  'warm-light': ['400 1em "Playfair Display Variable"'],
  cyberpunk: ['400 1em "Orbitron Variable"', '400 1em "Share Tech Mono"', '400 1em "Exo 2 Variable"'],
  swiss: ['400 1em "Inter Variable"', '600 1em "Inter Variable"'],
}

/** Preload fonts for a theme. Returns true if all fonts loaded successfully. */
async function preloadFontsForTheme(name: ThemeName): Promise<boolean> {
  const specs = THEME_FONTS[name] ?? []
  if (specs.length === 0) return true

  try {
    const results = await Promise.allSettled(
      specs.map(spec => document.fonts.load(spec))
    )
    return results.every(r => r.status === 'fulfilled')
  } catch {
    return false
  }
}

const THEME_MAP: Record<string, ThemeName> = {
  dark: 'cyberpunk',
  light: 'swiss',
  constructivism: 'constructivism',
  'modern-light': 'modern-light',
  'warm-light': 'warm-light',
  cyberpunk: 'cyberpunk',
  swiss: 'swiss',
}

/** Type guard for legacy flat settings that store `theme` at the top level. */
function isLegacySettings(s: unknown): s is { theme: string } {
  return (
    typeof s === 'object' &&
    s !== null &&
    'theme' in s &&
    typeof (s as { theme: unknown }).theme === 'string'
  )
}

/** Safely extract the raw theme string from settings, supporting both nested and flat (legacy) structures. */
function extractThemeValue(s: { appearance?: { theme?: string } } | null): string {
  if (s?.appearance?.theme) return s.appearance.theme
  if (isLegacySettings(s)) return s.theme
  return ''
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>('constructivism')
  const [fontStatus, setFontStatus] = useState<FontStatus>('idle')
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.devhub?.settings?.get?.().then((s: { appearance?: { theme?: string }; theme?: string } | null) => {
      // Support both nested (new) and flat (legacy) structures
      const rawTheme = extractThemeValue(s)
      const resolved = THEME_MAP[rawTheme] || 'constructivism'
      setThemeState(resolved)
      document.documentElement.dataset.theme = resolved
    }).catch(() => {
      // Fallback: keep default constructivism
    })
  }, [])

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
    }
  }, [])

  const setTheme = useCallback(async (name: ThemeName) => {
    const root = document.documentElement

    // Mark loading
    setFontStatus('loading')

    // Enable transition animation attribute before switching
    root.dataset.themeTransitioning = ''

    // Clear any pending timer from a previous rapid switch
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
    }

    // Apply the new theme
    setThemeState(name)
    root.dataset.theme = name

    // Race font loading against timeout
    const fontsLoaded = await Promise.race([
      preloadFontsForTheme(name),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), FONT_TIMEOUT_MS))
    ])

    setFontStatus(fontsLoaded ? 'loaded' : 'failed')

    // Read CSS transition duration or use fallback
    const cssDuration = getComputedStyle(root).getPropertyValue('--duration-theme').trim()
    const transitionMs = cssDuration ? parseFloat(cssDuration) : THEME_TRANSITION_MS

    // Remove transitioning attribute after the animation completes
    transitionTimerRef.current = setTimeout(() => {
      delete root.dataset.themeTransitioning
      transitionTimerRef.current = null
    }, isFinite(transitionMs) ? transitionMs : THEME_TRANSITION_MS)

    // Save to settings
    await window.devhub?.settings?.update?.({ appearance: { theme: name } } as Partial<import('@shared/types').AppSettings>)
  }, [])

  return { theme, setTheme, fontStatus } as const
}
