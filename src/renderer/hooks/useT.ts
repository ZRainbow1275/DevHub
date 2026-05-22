import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Locale } from '@shared/schemas/r8-runtime'
import type { TranslationKey } from '../i18n/keys'

const translationCache = new Map<string, string>()
let translationCacheLocale: string | null = null

function translateWithCache(translate: TFunction, locale: string, key: TranslationKey, fallback?: string): string {
  if (translationCacheLocale !== locale) {
    translationCache.clear()
    translationCacheLocale = locale
  }
  const defaultValue = fallback ?? key
  const cacheKey = `${key}\u0000${defaultValue}`
  const cached = translationCache.get(cacheKey)
  if (cached !== undefined) return cached
  const translated = translate(key, { defaultValue })
  const resolved = typeof translated === 'string' ? translated : defaultValue
  translationCache.set(cacheKey, resolved)
  return resolved
}

export function useT() {
  const { t: translate, i18n } = useTranslation()
  const locale = i18n.language as Locale
  return {
    t: (key: TranslationKey, fallback?: string) => translateWithCache(translate, locale, key, fallback),
    locale,
    change: (locale: Locale) => i18n.changeLanguage(locale),
  }
}
