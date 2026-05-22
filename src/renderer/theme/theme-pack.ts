import { z } from 'zod'
import { themeDecorationConfigSchema } from '@shared/schemas/r8-runtime'
import { themeStateSchema, type ThemeState } from './theme-language'

export const themePackTokenSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cardRadiusPx: z.number().int().min(0).max(64),
  spacingBasePx: z.number().int().min(0).max(64),
  motionNormalMs: z.number().int().min(0).max(1000)
})

export const devhubThemePackSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('devhub-theme-pack'),
  exportedAt: z.string().datetime(),
  name: z.string().min(1).max(80),
  source: z.literal('settings-theme-editor'),
  themeState: themeStateSchema,
  tokens: themePackTokenSchema,
  decoration: themeDecorationConfigSchema.optional()
})

export type ThemePackTokens = z.infer<typeof themePackTokenSchema>
export type DevhubThemePack = z.infer<typeof devhubThemePackSchema>

export function buildThemePack(input: {
  name: string
  exportedAt: string
  themeState: ThemeState
  tokens: ThemePackTokens
  decoration?: unknown
}): DevhubThemePack {
  return devhubThemePackSchema.parse({
    schemaVersion: 1,
    kind: 'devhub-theme-pack',
    source: 'settings-theme-editor',
    ...input
  })
}

export function serializeThemePack(pack: DevhubThemePack): string {
  return `${JSON.stringify(devhubThemePackSchema.parse(pack), null, 2)}\n`
}
