import { useState, useEffect, useCallback } from 'react'

export type ThemeName = 'constructivism' | 'modern-light' | 'warm-light'

const THEME_MAP: Record<string, ThemeName> = {
  dark: 'constructivism',
  light: 'modern-light',
  constructivism: 'constructivism',
  'modern-light': 'modern-light',
  'warm-light': 'warm-light',
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>('constructivism')

  useEffect(() => {
    window.devhub?.settings?.get?.().then((s: { theme?: string } | null) => {
      const resolved = THEME_MAP[s?.theme ?? ''] || 'constructivism'
      setThemeState(resolved)
      document.documentElement.dataset.theme = resolved
    }).catch(() => {
      // Fallback: keep default constructivism
    })
  }, [])

  const setTheme = useCallback(async (name: ThemeName) => {
    setThemeState(name)
    document.documentElement.dataset.theme = name
    await window.devhub?.settings?.update?.({ theme: name })
  }, [])

  return { theme, setTheme } as const
}
