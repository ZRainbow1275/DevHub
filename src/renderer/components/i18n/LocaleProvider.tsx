import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { localeManifestSchema, type Locale, type LocaleManifest } from '@shared/schemas/r8-runtime'
import i18n, { DEFAULT_LOCALE } from '../../i18n'
import { installLegacyDomLocalizer } from '../../i18n/legacy-dom-localizer'

interface LocaleContextValue {
  locale: Locale
  manifests: LocaleManifest[]
  changeLocale: (locale: Locale) => Promise<void>
  reloadLocales: () => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readLocaleManifests(response: unknown): LocaleManifest[] {
  if (typeof response !== 'object' || response === null || !('manifest' in response)) return []
  const manifest = (response as { manifest?: unknown }).manifest
  if (!Array.isArray(manifest)) return []
  return manifest.flatMap(item => {
    const parsed = localeManifestSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  const [manifests, setManifests] = useState<LocaleManifest[]>([])

  const applyLocale = async (nextLocale: Locale) => {
    await i18n.changeLanguage(nextLocale)
    document.documentElement.lang = nextLocale
    setLocale(nextLocale)
  }

  const reloadLocales = async () => {
    const response = await window.devhub.i18n.listLocales()
    setManifests(readLocaleManifests(response))
  }

  useEffect(() => {
    let disposed = false
    const load = async () => {
      const [localeResponse, manifestResponse] = await Promise.all([
        window.devhub.i18n.getLocale(),
        window.devhub.i18n.listLocales(),
      ])
      if (disposed) return
      setManifests(readLocaleManifests(manifestResponse))
      await applyLocale(localeResponse.locale)
    }
    load().catch(() => {
      if (!disposed) void applyLocale(DEFAULT_LOCALE)
    })
    return () => { disposed = true }
  }, [])

  useEffect(() => installLegacyDomLocalizer(i18n), [])

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    manifests,
    changeLocale: async (nextLocale: Locale) => {
      const response = await window.devhub.i18n.setLocale(nextLocale)
      if (response.success) await applyLocale(response.locale)
    },
    reloadLocales,
  }), [locale, manifests])

  return (
    <I18nextProvider i18n={i18n}>
      <LocaleContext.Provider value={value}>
        {children}
      </LocaleContext.Provider>
    </I18nextProvider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) throw new Error('LocaleProvider is not mounted')
  return context
}
