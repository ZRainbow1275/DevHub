import { describe, expect, it } from 'vitest'
import type { AppearanceSettings } from '@shared/types'
import {
  DEFAULT_THEME_STATE,
  HOLIDAY_THEME_DEFINITIONS,
  THEME_DECORATION_BUILTIN_COUNT,
  THEME_PRESETS,
  applyHolidayThemeToDocument,
  applyThemeDecorationToDocument,
  applyThemeStateToDocument,
  getPaletteDecorationConfig,
  getPaletteDesignState,
  getPresetState,
  normalizeDensity,
  promptHolidayThemeIfNeeded,
  resolveEffectiveThemeDecoration,
  resolveHolidayTheme,
  resolveSystemMotionLevel,
  normalizeThemeDecorationConfig,
  resolveSystemPalette,
  resolveThemeDecoration,
  resolveThemeState,
  themeDecorationConfigSchema,
  themeStateSchema
} from './theme-language'

function makeDocument(): Document {
  return document.implementation.createHTMLDocument('theme-test')
}

class MemoryHolidayStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function baseAppearance(overrides: Partial<AppearanceSettings> = {}): AppearanceSettings {
  return {
    theme: 'constructivism',
    followSystemTheme: false,
    fontSize: 'medium',
    sidebarPosition: 'left',
    compactMode: false,
    enableAnimations: true,
    holidayDecorationsEnabled: true,
    holidayAutoPromptEnabled: true,
    holidayFocusMode: false,
    layoutMode: 'auto',
    informationDensity: 'standard',
    radiusFamily: 'sharp',
    motionLevel: 'balanced',
    ...overrides
  }
}

describe('theme language state', () => {
  it('exposes required final-acceptance preset palettes as real theme presets', () => {
    const presetPalettes = new Set(THEME_PRESETS.map(preset => preset.state.palette))

    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(7)
    expect(presetPalettes).toEqual(new Set(['constructivism', 'modern-light', 'warm-light', 'cyberpunk', 'swiss', 'dark', 'light']))
  })

  it('resolves legacy or incomplete settings into a complete four-axis theme state', () => {
    const state = resolveThemeState({
      appearance: baseAppearance({
        theme: 'modern-light',
        informationDensity: 'compact',
        radiusFamily: 'soft',
        motionLevel: 'balanced'
      })
    })

    expect(state).toEqual({
      palette: 'modern-light',
      density: 'compact',
      radiusFamily: 'soft',
      motionLevel: 'balanced'
    })
  })

  it('resolves follow-system theme settings to the current OS color scheme', () => {
    const appearance = baseAppearance({
      followSystemTheme: true,
    })

    expect(resolveSystemPalette('light')).toBe('light')
    expect(resolveSystemPalette('dark')).toBe('dark')
    expect(resolveThemeState({ appearance }, 'light').palette).toBe('light')
    expect(resolveThemeState({ appearance }, 'dark').palette).toBe('dark')
  })

  it('resolves OS reduced-motion preference as an effective reduced motion level', () => {
    const appearance = baseAppearance({
      motionLevel: 'expressive'
    })

    expect(resolveSystemMotionLevel('reduce', 'expressive', 'constructivism')).toBe('reduced')
    expect(resolveSystemMotionLevel('no-preference', 'expressive', 'constructivism')).toBe('expressive')
    expect(resolveThemeState({ appearance }, 'dark', 'reduce').motionLevel).toBe('reduced')
  })

  it('maps palette changes to design-language defaults instead of color-only changes', () => {
    expect(getPaletteDesignState('constructivism', 'standard')).toEqual({
      palette: 'constructivism',
      density: 'standard',
      radiusFamily: 'sharp',
      motionLevel: 'balanced'
    })
    expect(getPaletteDesignState('modern-light', 'standard')).toEqual({
      palette: 'modern-light',
      density: 'standard',
      radiusFamily: 'soft',
      motionLevel: 'balanced'
    })
  })

  it('normalizes legacy density names and rejects invalid theme-state axes', () => {
    expect(normalizeDensity('normal')).toBe('standard')
    expect(themeStateSchema.safeParse({ ...DEFAULT_THEME_STATE, motionLevel: 'fast' }).success).toBe(false)
  })

  it('applies all theme axes to document dataset', () => {
    const doc = makeDocument()
    const state = getPresetState('terminal-focus') ?? DEFAULT_THEME_STATE

    applyThemeStateToDocument(state, doc)

    expect(doc.documentElement.dataset.theme).toBe(state.palette)
    expect(doc.documentElement.dataset.palette).toBe(state.palette)
    expect(doc.documentElement.dataset.density).toBe(state.density)
    expect(doc.documentElement.dataset.radiusFamily).toBe(state.radiusFamily)
    expect(doc.documentElement.dataset.motionLevel).toBe(state.motionLevel)
  })

  it('resolves palette-linked decoration defaults and clamps invalid opacity', () => {
    const config = resolveThemeDecoration({
      appearance: baseAppearance({
        theme: 'cyberpunk',
        motionLevel: 'expressive',
        decoration: {
          kind: 'scanline',
          opacity: 0.16,
          positions: ['global-background', 'header'],
          blendMode: 'screen',
          scale: 1,
          motionRespect: true
        }
      })
    })

    expect(config.kind).toBe('scanline')
    expect(config.positions).toContain('global-background')
    expect(themeDecorationConfigSchema.safeParse({ ...config, opacity: 0.75 }).success).toBe(false)
    expect(normalizeThemeDecorationConfig({ ...config, positions: ['header', 'header'] }, 'cyberpunk').positions).toEqual(['header'])
  })

  it('exposes eight built-in decoration options before custom SVG is enabled', () => {
    expect(THEME_DECORATION_BUILTIN_COUNT).toBe(8)
    expect(getPaletteDecorationConfig('constructivism')).toMatchObject({
      kind: 'soviet-geo',
      opacity: 0.25
    })
  })

  it('applies decoration metadata and CSS variables to document', () => {
    const doc = makeDocument()
    const config = getPaletteDecorationConfig('warm-light')

    applyThemeDecorationToDocument(config, doc)

    expect(doc.documentElement.dataset.decorationKind).toBe(config.kind)
    expect(doc.documentElement.dataset.decorationPositions).toBe(config.positions.join(' '))
    expect(doc.documentElement.style.getPropertyValue('--theme-decoration-opacity')).toBe(String(config.opacity))
  })

  it('defines three real holiday theme packs and prompts before the local holiday date', () => {
    const storage = new MemoryHolidayStorage()
    const preSpringFestival = new Date(2026, 1, 10)
    const appearance = baseAppearance()

    const pending = resolveHolidayTheme(appearance, preSpringFestival, storage)
    expect(HOLIDAY_THEME_DEFINITIONS.map(holiday => holiday.id)).toEqual(['spring-festival', 'christmas', 'halloween'])
    expect(pending.promptTheme?.id).toBe('spring-festival')
    expect(pending.activeTheme).toBeNull()

    const accepted = promptHolidayThemeIfNeeded(appearance, preSpringFestival, storage, (_message, theme) => theme.id === 'spring-festival')
    expect(accepted.activeTheme?.id).toBe('spring-festival')
    expect(resolveEffectiveThemeDecoration({ appearance }, preSpringFestival, storage).kind).toBe('golden')
  })

  it('suppresses all holiday decoration in focus work mode', () => {
    const storage = new MemoryHolidayStorage()
    const springFestival = new Date(2026, 1, 17)
    const appearance = baseAppearance({ holidayFocusMode: true })
    const resolution = resolveHolidayTheme(appearance, springFestival, storage)
    const doc = makeDocument()

    applyHolidayThemeToDocument(resolution, doc)

    expect(resolution.suppressedByFocusMode).toBe(true)
    expect(resolution.activeTheme).toBeNull()
    expect(doc.documentElement.dataset.holidayTheme).toBeUndefined()
    expect(doc.documentElement.dataset.holidayFocusMode).toBe('true')
    expect(resolveEffectiveThemeDecoration({ appearance }, springFestival, storage).kind).toBe('soviet-geo')
  })
})
