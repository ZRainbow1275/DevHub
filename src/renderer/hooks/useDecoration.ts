import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, ThemeDecorationConfig, ThemeOption } from '@shared/types'
import {
  THEME_DECORATION_CHANGE_EVENT,
  applyHolidayThemeToDocument,
  applyThemeDecorationToDocument,
  getPaletteDecorationConfig,
  normalizePalette,
  normalizeThemeDecorationConfig,
  promptHolidayThemeIfNeeded,
  resolveEffectiveThemeDecoration,
  resolveHolidayTheme,
} from '../theme/theme-language'

function getFallbackDecoration(): ThemeDecorationConfig {
  return getPaletteDecorationConfig('constructivism')
}

function getThemeFromSettings(settings: AppSettings | null): ThemeOption {
  return normalizePalette(settings?.appearance?.theme)
}

export function useDecoration() {
  const [config, setConfig] = useState<ThemeDecorationConfig>(() => getFallbackDecoration())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    void window.devhub?.settings?.get?.()
      .then((settings: AppSettings | null) => {
        if (cancelled) return
        const holiday = promptHolidayThemeIfNeeded(settings?.appearance)
        const resolved = resolveEffectiveThemeDecoration(settings)
        setConfig(resolved)
        applyHolidayThemeToDocument(holiday)
        applyThemeDecorationToDocument(resolved)
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        const fallback = getFallbackDecoration()
        applyHolidayThemeToDocument(resolveHolidayTheme(null))
        setConfig(fallback)
        applyThemeDecorationToDocument(fallback)
        setLoaded(true)
      })

    const handleDecorationChange = (event: Event) => {
      const next = normalizeThemeDecorationConfig((event as CustomEvent<unknown>).detail, config.kind === 'none' ? 'constructivism' : undefined)
      setConfig(next)
      applyThemeDecorationToDocument(next)
    }

    window.addEventListener(THEME_DECORATION_CHANGE_EVENT, handleDecorationChange)
    return () => {
      cancelled = true
      window.removeEventListener(THEME_DECORATION_CHANGE_EVENT, handleDecorationChange)
    }
  }, [config.kind])

  const setDecoration = useCallback(async (updates: Partial<ThemeDecorationConfig>) => {
    const settings = await window.devhub?.settings?.get?.()
    const palette = getThemeFromSettings(settings ?? null)
    const current = normalizeThemeDecorationConfig(settings?.appearance?.decoration ?? config, palette)
    const next = normalizeThemeDecorationConfig({ ...current, ...updates }, palette)
    setConfig(next)
    applyThemeDecorationToDocument(next)
    window.dispatchEvent(new CustomEvent<ThemeDecorationConfig>(THEME_DECORATION_CHANGE_EVENT, { detail: next }))

    if (settings?.appearance && window.devhub?.settings?.update) {
      await window.devhub.settings.update({
        appearance: {
          ...settings.appearance,
          decoration: next,
        },
      })
    }

    return next
  }, [config])

  return {
    config,
    loaded,
    setDecoration,
  } as const
}
