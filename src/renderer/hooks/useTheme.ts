import { useState, useEffect, useCallback, useRef } from 'react'

export type ThemeName = 'constructivism' | 'modern-light' | 'warm-light' | 'cyberpunk' | 'swiss'

/** Duration in ms for theme transition animation (matches --duration-theme in CSS) */
const THEME_TRANSITION_MS = 250

/**
 * Fonts required per theme. Preloaded on theme switch so glyphs are
 * ready before the transition ends.  Uses the Font Loading API
 * (FontFace.load) which is non-blocking and returns a Promise.
 */
const THEME_FONTS: Record<ThemeName, string[]> = {
  constructivism: ['400 1em "Bebas Neue"', '400 1em "JetBrains Mono"'],
  'modern-light': ['400 1em "Inter"'],
  'warm-light': ['400 1em "Playfair Display"'],
  cyberpunk: ['400 1em "Orbitron"', '400 1em "Exo 2"'],
  swiss: ['400 1em "Inter"'],
}

/** Best-effort font preload; never throws. */
function preloadFontsForTheme(name: ThemeName): void {
  const specs = THEME_FONTS[name] ?? []
  for (const spec of specs) {
    // document.fonts.load is available in Chromium (Electron).
    document.fonts?.load(spec).catch(() => {
      /* Swallow: font may already be loaded or unavailable */
    })
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

    // Preload fonts for the target theme before switching
    preloadFontsForTheme(name)

    // Enable transition animation attribute before switching
    root.dataset.themeTransitioning = ''

    // Clear any pending timer from a previous rapid switch
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
    }

    // Apply the new theme
    setThemeState(name)
    root.dataset.theme = name

    // Remove the transitioning attribute after the animation completes
    transitionTimerRef.current = setTimeout(() => {
      delete root.dataset.themeTransitioning
      transitionTimerRef.current = null
    }, THEME_TRANSITION_MS)

    await window.devhub?.settings?.update?.({ appearance: { theme: name } } as Partial<import('@shared/types').AppSettings>)
  }, [])

  return { theme, setTheme } as const
}
