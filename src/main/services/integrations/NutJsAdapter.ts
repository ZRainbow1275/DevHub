import { z } from 'zod'
import { ServiceResult } from '@shared/types-extended'
import { isFeatureEnabled, FeatureFlagName } from '@shared/feature-flags'
import { importOptionalNativeModule, toRecord } from './nativeImport'

export const nutJsTextRequestSchema = z.object({
  text: z.string().min(1),
  flagOverrides: z.record(z.string(), z.boolean()).optional()
})

export const nutJsShortcutRequestSchema = z.object({
  flagOverrides: z.record(z.string(), z.boolean()).optional()
})

export type NutJsTextRequest = z.input<typeof nutJsTextRequestSchema>
export type NutJsShortcutRequest = z.input<typeof nutJsShortcutRequestSchema>

const NUT_KEY_LEFT_CONTROL = 104
const NUT_KEY_V = 91

export class NutJsAdapter {
  async typeText(input: NutJsTextRequest): Promise<ServiceResult<{ characters: number }>> {
    const request = nutJsTextRequestSchema.parse(input)
    const overrides = request.flagOverrides as Partial<Record<FeatureFlagName, boolean>> | undefined
    if (!isFeatureEnabled('R8.A.libs.nut-js', overrides)) return { success: false, error: 'NUT_JS_DISABLED_BY_FLAG' }

    const nativeModule = toRecord(await importOptionalNativeModule('@nut-tree-fork/nut-js'))
    const keyboard = toRecord(nativeModule?.keyboard)
    const typeCandidate = keyboard?.type
    if (typeof typeCandidate !== 'function') return { success: false, error: 'NUT_JS_UNAVAILABLE' }

    try {
      await typeCandidate.call(keyboard, request.text)
      return { success: true, data: { characters: request.text.length } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async pressPasteShortcut(input: NutJsShortcutRequest = {}): Promise<ServiceResult> {
    const request = nutJsShortcutRequestSchema.parse(input)
    const overrides = request.flagOverrides as Partial<Record<FeatureFlagName, boolean>> | undefined
    if (!isFeatureEnabled('R8.A.libs.nut-js', overrides)) return { success: false, error: 'NUT_JS_DISABLED_BY_FLAG' }

    const nativeModule = toRecord(await importOptionalNativeModule('@nut-tree-fork/nut-js'))
    const keyboard = toRecord(nativeModule?.keyboard)
    const pressKey = keyboard?.pressKey
    const releaseKey = keyboard?.releaseKey
    if (typeof pressKey !== 'function' || typeof releaseKey !== 'function') return { success: false, error: 'NUT_JS_KEYS_UNAVAILABLE' }

    try {
      await pressKey.call(keyboard, NUT_KEY_LEFT_CONTROL, NUT_KEY_V)
      await releaseKey.call(keyboard, NUT_KEY_LEFT_CONTROL, NUT_KEY_V)
      return { success: true }
    } catch (error) {
      try {
        await releaseKey.call(keyboard, NUT_KEY_LEFT_CONTROL, NUT_KEY_V)
      } catch {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
