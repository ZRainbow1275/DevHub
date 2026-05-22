import { describe, expect, it } from 'vitest'
import { getPaletteDecorationConfig } from './theme-language'
import { buildThemePack, devhubThemePackSchema, serializeThemePack } from './theme-pack'

describe('theme pack export contract', () => {
  it('builds a validated .devhub-theme.json payload from real theme editor state', () => {
    const pack = buildThemePack({
      name: 'constructivism-theme-pack',
      exportedAt: '2026-05-19T00:00:00.000Z',
      themeState: {
        palette: 'constructivism',
        density: 'standard',
        radiusFamily: 'sharp',
        motionLevel: 'balanced'
      },
      tokens: {
        accentColor: '#112233',
        cardRadiusPx: 6,
        spacingBasePx: 8,
        motionNormalMs: 220
      },
      decoration: getPaletteDecorationConfig('constructivism')
    })

    expect(devhubThemePackSchema.safeParse(pack).success).toBe(true)
    expect(pack.kind).toBe('devhub-theme-pack')
    expect(pack.source).toBe('settings-theme-editor')
    expect(pack.tokens.accentColor).toBe('#112233')
    expect(JSON.parse(serializeThemePack(pack))).toMatchObject({
      schemaVersion: 1,
      kind: 'devhub-theme-pack',
      tokens: {
        accentColor: '#112233',
        cardRadiusPx: 6
      }
    })
  })
})
