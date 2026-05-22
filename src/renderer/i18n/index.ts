import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Locale } from '@shared/schemas/r8-runtime'
import zhCN from './zh-CN.json'
import enUS from './en-US.json'

export const DEFAULT_LOCALE: Locale = 'zh-CN'

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (_languages, _namespace, key) => {
      if (import.meta.env.DEV) console.warn(`[i18n missing] ${key}`)
    },
    parseMissingKeyHandler: (key) => import.meta.env.DEV ? `[${key}]` : key,
  })

export default i18n
