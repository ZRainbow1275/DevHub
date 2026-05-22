import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_STATE, THEME_PRESETS, getPaletteDesignState } from './theme-language'
import { assertThemeNonColorDelta, ensureThemeNonColorDelta, hasThemeNonColorDelta, pairwiseThemeDistance, themeAxisDistanceSchema } from './theme-distance'

function presetState(id: string) {
  const preset = THEME_PRESETS.find(item => item.id === id)
  if (!preset) throw new Error(`Missing theme preset ${id}`)
  return preset.state
}

describe('theme non-color distance contract', () => {
  it('measures pairwise palette transitions across non-color axes', () => {
    const distance = pairwiseThemeDistance(presetState('constructivism-command'), presetState('modern-light-balanced'))

    expect(themeAxisDistanceSchema.safeParse(distance).success).toBe(true)
    expect(distance.paletteChanged).toBe(true)
    expect(distance.changedNonColorAxes).toEqual(['density', 'radiusFamily'])
    expect(distance.weightedNonColorDistance).toBe(2)
    expect(distance.hasNonColorDelta).toBe(true)
  })

  it('treats palette defaults as design-language changes instead of color-only swaps', () => {
    const constructivism = getPaletteDesignState('constructivism', 'standard')
    const modernLight = getPaletteDesignState('modern-light', 'standard')
    const warmLight = getPaletteDesignState('warm-light', 'standard')

    expect(assertThemeNonColorDelta(constructivism, modernLight).changedNonColorAxes).toEqual(['radiusFamily'])
    expect(assertThemeNonColorDelta(constructivism, warmLight).changedNonColorAxes).toEqual(['radiusFamily', 'motionLevel'])
  })

  it('rejects color-only transitions with no density, radius, or motion delta', () => {
    const colorOnly = { ...DEFAULT_THEME_STATE, palette: 'dark' as const }

    expect(hasThemeNonColorDelta(DEFAULT_THEME_STATE, colorOnly)).toBe(false)
    expect(() => assertThemeNonColorDelta(DEFAULT_THEME_STATE, colorOnly)).toThrow(/changes color only/)
  })

  it('can repair a color-only runtime theme transition with a minimum non-color delta', () => {
    const colorOnly = { ...DEFAULT_THEME_STATE, palette: 'dark' as const }
    const repaired = ensureThemeNonColorDelta(DEFAULT_THEME_STATE, colorOnly)

    expect(repaired.palette).toBe('dark')
    expect(assertThemeNonColorDelta(DEFAULT_THEME_STATE, repaired).changedNonColorAxes).toEqual(['radiusFamily'])
  })
})
