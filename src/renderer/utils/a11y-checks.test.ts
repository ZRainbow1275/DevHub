import { describe, expect, it } from 'vitest'
import {
  applyA11yDocumentState,
  buildEffectiveA11yPrefs,
  contrastRatio,
  evaluateContrast,
  parseHexColor,
} from './a11y-checks'

describe('a11y-checks', () => {
  it('parses hex colors and calculates WCAG contrast ratios', () => {
    const black = parseHexColor('#000')
    const white = parseHexColor('#ffffff')

    expect(black).toEqual({ r: 0, g: 0, b: 0 })
    expect(white).toEqual({ r: 255, g: 255, b: 255 })
    expect(black && white ? contrastRatio(black, white) : 0).toBe(21)
  })

  it('reports contrast failures without inventing a pass for invalid colors', () => {
    expect(evaluateContrast({
      selector: '.muted',
      foreground: '#777777',
      background: '#777777',
    })).toEqual({
      selector: '.muted',
      ratio: 1,
      required: 4.5,
    })

    expect(evaluateContrast({
      selector: '.invalid',
      foreground: 'not-a-color',
      background: '#ffffff',
    })).toEqual({
      selector: '.invalid',
      ratio: 0,
      required: 4.5,
    })
  })

  it('builds effective prefs from OS settings only when followOsSettings is enabled', () => {
    const basePrefs = buildEffectiveA11yPrefs(undefined, {
      reducedMotion: true,
      highContrast: true,
      forcedColors: true,
    })

    expect(basePrefs.reducedMotion).toBe(true)
    expect(basePrefs.highContrast).toBe(true)
    expect(basePrefs.forcedColors).toBe(true)

    const manualPrefs = buildEffectiveA11yPrefs({
      ...basePrefs,
      followOsSettings: false,
      reducedMotion: false,
      highContrast: false,
      forcedColors: false,
    }, {
      reducedMotion: true,
      highContrast: true,
      forcedColors: true,
    })

    expect(manualPrefs.reducedMotion).toBe(false)
    expect(manualPrefs.highContrast).toBe(false)
    expect(manualPrefs.forcedColors).toBe(false)
  })

  it('applies document data attributes for CSS a11y switches', () => {
    const root = document.createElement('html')
    const effective = applyA11yDocumentState(root, {
      reducedMotion: false,
      highContrast: false,
      largeText: true,
      forcedColors: false,
      screenReaderOptimized: true,
      focusRingThickness: 'thick',
      followOsSettings: true,
    }, {
      reducedMotion: true,
      highContrast: true,
      forcedColors: true,
    })

    expect(effective.reducedMotion).toBe(true)
    expect(root.dataset.a11yReducedMotion).toBe('true')
    expect(root.dataset.a11yHighContrast).toBe('true')
    expect(root.dataset.a11yForcedColors).toBe('true')
    expect(root.dataset.a11yLargeText).toBe('true')
    expect(root.dataset.a11yScreenReader).toBe('true')
    expect(root.dataset.a11yFocusRing).toBe('thick')
  })
})
