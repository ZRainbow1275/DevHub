import { ipcMain } from 'electron'
import {
  localeSetRequestSchema,
  type LocaleGetResponse,
  type LocaleListResponse,
  type LocaleReloadResponse,
  type LocaleSetResponse,
} from '@shared/schemas/r8-runtime'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { LocaleStore } from '../services/LocaleStore'

let localeStore: LocaleStore | null = null

export function setupI18nHandlers(store: LocaleStore = new LocaleStore()): void {
  cleanupI18nHandlers()
  localeStore = store

  ipcMain.handle('i18n:get-locale', withRateLimit(
    'i18n:get-locale',
    RATE_LIMITS.QUERY,
    async (): Promise<LocaleGetResponse> => ({ locale: localeStore?.getLocale() ?? 'zh-CN' })
  ))

  ipcMain.handle('i18n:set-locale', withRateLimit(
    'i18n:set-locale',
    RATE_LIMITS.ACTION,
    async (_event, input: unknown): Promise<LocaleSetResponse> => {
      if (!localeStore) return { success: false, locale: 'zh-CN' }
      const parsed = localeSetRequestSchema.parse(input)
      return { success: true, locale: localeStore.setLocale(parsed.locale) }
    }
  ))

  ipcMain.handle('i18n:list-locales', withRateLimit(
    'i18n:list-locales',
    RATE_LIMITS.QUERY,
    async (): Promise<LocaleListResponse> => ({ manifest: localeStore?.listLocales() ?? [] })
  ))

  ipcMain.handle('i18n:reload-resources', withRateLimit(
    'i18n:reload-resources',
    RATE_LIMITS.ACTION,
    async (): Promise<LocaleReloadResponse> => ({ reloaded: localeStore?.reloadResources() ?? 0 })
  ))
}

export function cleanupI18nHandlers(): void {
  localeStore = null
  ipcMain.removeHandler('i18n:get-locale')
  ipcMain.removeHandler('i18n:set-locale')
  ipcMain.removeHandler('i18n:list-locales')
  ipcMain.removeHandler('i18n:reload-resources')
}
