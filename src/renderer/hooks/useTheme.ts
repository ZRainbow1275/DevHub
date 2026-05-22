import { useState, useEffect, useCallback, useRef } from 'react'
import { APP_SETTINGS_CHANGE_EVENT, type AppSettings, type InformationDensity, type MotionLevel, type RadiusFamily } from '@shared/types'
import { popoutThemeSyncPayloadSchema } from '@shared/schemas/r8-runtime'
import {
  DEFAULT_THEME_STATE,
  applyThemeDecorationToDocument,
  applyThemeStateToDocument,
  getPaletteDesignState,
  getPresetState,
  normalizeDensity,
  normalizeMotionLevel,
  normalizePalette,
  normalizeRadiusFamily,
  applyHolidayThemeToDocument,
  resolveEffectiveThemeDecoration,
  resolveHolidayTheme,
  resolveThemeState,
  type SystemMotionPreference,
  type SystemThemePreference,
  type PaletteName,
  type ThemeState
} from '../theme/theme-language'
import { ensureThemeNonColorDelta } from '../theme/theme-distance'

export type ThemeName = PaletteName
export type { ThemeState, RadiusFamily, MotionLevel }

export type FontStatus = 'idle' | 'loading' | 'loaded' | 'failed'

/** Fallback duration in ms for theme transition animation */
const THEME_TRANSITION_MS = 250

/** Maximum time to wait for fonts before proceeding with theme switch */
const FONT_TIMEOUT_MS = 1500

/**
 * Fonts required per theme. Preloaded on theme switch so glyphs are
 * ready before the transition ends. Uses the Font Loading API when available.
 */
const THEME_FONTS: Record<ThemeName, string[]> = {
  constructivism: ['400 1em "Oswald Variable"', '400 1em "Bebas Neue"', '400 1em "JetBrains Mono Variable"'],
  'modern-light': ['400 1em "Inter Variable"'],
  'warm-light': ['400 1em "Playfair Display Variable"'],
  cyberpunk: ['400 1em "Orbitron Variable"', '400 1em "Share Tech Mono"', '400 1em "Exo 2 Variable"'],
  swiss: ['400 1em "Inter Variable"', '600 1em "Inter Variable"'],
  dark: ['400 1em "Inter Variable"'],
  light: ['400 1em "Inter Variable"']
}

async function preloadFontsForTheme(name: ThemeName): Promise<boolean> {
  const specs = THEME_FONTS[name] ?? []
  if (specs.length === 0 || !document.fonts?.load) return true

  try {
    const results = await Promise.allSettled(specs.map(spec => document.fonts.load(spec)))
    return results.every(r => r.status === 'fulfilled')
  } catch {
    return false
  }
}

function getTransitionMs(root: HTMLElement): number {
  const cssDuration = getComputedStyle(root).getPropertyValue('--duration-theme').trim()
  const parsed = cssDuration ? parseFloat(cssDuration) : THEME_TRANSITION_MS
  return Number.isFinite(parsed) ? parsed : THEME_TRANSITION_MS
}

function toAppearanceUpdate(state: ThemeState): Partial<AppSettings> {
  return {
    appearance: {
      theme: state.palette,
      informationDensity: state.density,
      radiusFamily: state.radiusFamily,
      motionLevel: state.motionLevel
    }
  } as Partial<AppSettings>
}

function readSystemThemePreference(): SystemThemePreference {
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light'
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'no-preference'
}

function readSystemMotionPreference(): SystemMotionPreference {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference'
}

function applySystemMotionPreference(state: ThemeState): ThemeState {
  return readSystemMotionPreference() === 'reduce'
    ? { ...state, motionLevel: 'reduced' }
    : state
}

export function useTheme() {
  const [themeState, setThemeState] = useState<ThemeState>(DEFAULT_THEME_STATE)
  const [fontStatus, setFontStatus] = useState<FontStatus>('idle')
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    window.devhub?.settings?.get?.()
      .then((settings: AppSettings | null) => {
        if (cancelled) return
        const resolved = resolveThemeState(settings, readSystemThemePreference(), readSystemMotionPreference())
        const holiday = resolveHolidayTheme(settings?.appearance)
        const decoration = resolveEffectiveThemeDecoration(settings)
        setThemeState(resolved)
        applyThemeStateToDocument(resolved)
        applyHolidayThemeToDocument(holiday)
        applyThemeDecorationToDocument(decoration)
      })
      .catch(() => {
        if (!cancelled) applyThemeStateToDocument(DEFAULT_THEME_STATE)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const applySettings = (settings: AppSettings) => {
      const resolved = resolveThemeState(settings, readSystemThemePreference(), readSystemMotionPreference())
      const holiday = resolveHolidayTheme(settings.appearance)
      const decoration = resolveEffectiveThemeDecoration(settings)
      setThemeState(resolved)
      applyThemeStateToDocument(resolved)
      applyHolidayThemeToDocument(holiday)
      applyThemeDecorationToDocument(decoration)
    }

    const handleSettingsChange = (event: Event) => {
      const settings = (event as CustomEvent<AppSettings>).detail
      if (settings?.appearance) applySettings(settings)
    }

    const handleSystemThemeChange = () => {
      void window.devhub?.settings?.get?.()
        .then((settings: AppSettings | null) => {
          if (settings?.appearance.followSystemTheme) applySettings(settings)
        })
    }

    const handleSystemMotionChange = () => {
      void window.devhub?.settings?.get?.()
        .then((settings: AppSettings | null) => {
          if (settings?.appearance) applySettings(settings)
        })
    }

    window.addEventListener(APP_SETTINGS_CHANGE_EVENT, handleSettingsChange)
    const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)')
    const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    lightQuery?.addEventListener?.('change', handleSystemThemeChange)
    darkQuery?.addEventListener?.('change', handleSystemThemeChange)
    motionQuery?.addEventListener?.('change', handleSystemMotionChange)

    return () => {
      window.removeEventListener(APP_SETTINGS_CHANGE_EVENT, handleSettingsChange)
      lightQuery?.removeEventListener?.('change', handleSystemThemeChange)
      darkQuery?.removeEventListener?.('change', handleSystemThemeChange)
      motionQuery?.removeEventListener?.('change', handleSystemMotionChange)
    }
  }, [])

  useEffect(() => {
    return window.devhub?.r8?.popout?.onBridgeMessage?.((message) => {
      if (message.type !== 'sync' || message.key !== 'theme-settings') return
      const parsed = popoutThemeSyncPayloadSchema.safeParse(message.value)
      if (!parsed.success) return
      const syncedSettings = parsed.data.settings as unknown as AppSettings
      const resolved = resolveThemeState(syncedSettings, readSystemThemePreference(), readSystemMotionPreference())
      const holiday = resolveHolidayTheme(syncedSettings.appearance)
      const decoration = resolveEffectiveThemeDecoration(syncedSettings)
      setThemeState(resolved)
      applyThemeStateToDocument(resolved)
      applyHolidayThemeToDocument(holiday)
      applyThemeDecorationToDocument(decoration)
      window.dispatchEvent(new CustomEvent<AppSettings>(APP_SETTINGS_CHANGE_EVENT, { detail: syncedSettings }))
    })
  }, [])

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
  }, [])

  const applyThemeState = useCallback(async (nextState: ThemeState, persist = true) => {
    const root = document.documentElement
    setFontStatus('loading')
    root.dataset.themeTransitioning = ''

    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)

    const effectiveState = applySystemMotionPreference(nextState)
    setThemeState(effectiveState)
    applyThemeStateToDocument(effectiveState)

    const fontsLoaded = await Promise.race([
      preloadFontsForTheme(effectiveState.palette),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), FONT_TIMEOUT_MS))
    ])
    setFontStatus(fontsLoaded ? 'loaded' : 'failed')

    transitionTimerRef.current = setTimeout(() => {
      delete root.dataset.themeTransitioning
      transitionTimerRef.current = null
    }, getTransitionMs(root))

    if (persist) {
      await window.devhub?.settings?.update?.(toAppearanceUpdate(effectiveState))
    }
  }, [])

  const setTheme = useCallback(async (name: ThemeName) => {
    const palette = normalizePalette(name)
    const candidateState = getPaletteDesignState(palette, themeState.density)
    const nextState = ensureThemeNonColorDelta(themeState, candidateState)
    await applyThemeState(nextState)
  }, [applyThemeState, themeState])

  const setDensity = useCallback(async (density: InformationDensity | 'normal') => {
    await applyThemeState({ ...themeState, density: normalizeDensity(density) })
  }, [applyThemeState, themeState])

  const setRadiusFamily = useCallback(async (radiusFamily: RadiusFamily) => {
    await applyThemeState({ ...themeState, radiusFamily: normalizeRadiusFamily(radiusFamily, themeState.palette) })
  }, [applyThemeState, themeState])

  const setMotionLevel = useCallback(async (motionLevel: MotionLevel) => {
    await applyThemeState({ ...themeState, motionLevel: normalizeMotionLevel(motionLevel, themeState.palette) })
  }, [applyThemeState, themeState])

  const applyPreset = useCallback(async (presetId: string) => {
    const presetState = getPresetState(presetId)
    if (presetState) await applyThemeState(presetState)
  }, [applyThemeState])

  return {
    theme: themeState.palette,
    themeState,
    setTheme,
    setDensity,
    setRadiusFamily,
    setMotionLevel,
    applyPreset,
    fontStatus
  } as const
}
