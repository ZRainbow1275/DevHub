import Store from 'electron-store'
import {
  localeManifestSchema,
  localeSchema,
  localeSetRequestSchema,
  type Locale,
  type LocaleManifest,
} from '@shared/schemas/r8-runtime'

interface LocaleStoreShape {
  locale: Locale
}

const DEFAULT_LOCALE: Locale = 'zh-CN'

const LOCALE_MANIFESTS: LocaleManifest[] = [
  localeManifestSchema.parse({
    locale: 'zh-CN',
    displayName: 'Simplified Chinese',
    nativeName: '简体中文',
    status: 'stable',
    coverage: 1,
    updatedAt: 0,
  }),
  localeManifestSchema.parse({
    locale: 'en-US',
    displayName: 'English',
    nativeName: 'English',
    status: 'partial',
    coverage: 0.35,
    updatedAt: 0,
  }),
]

export class LocaleStore {
  private readonly store: Store<LocaleStoreShape>

  constructor(store?: Store<LocaleStoreShape>) {
    this.store = store ?? new Store<LocaleStoreShape>({
      name: 'devhub-locale',
      defaults: { locale: DEFAULT_LOCALE },
    })
  }

  getLocale(): Locale {
    const parsed = localeSchema.safeParse(this.store.get('locale', DEFAULT_LOCALE))
    return parsed.success ? parsed.data : DEFAULT_LOCALE
  }

  setLocale(locale: Locale): Locale {
    const parsed = localeSetRequestSchema.parse({ locale })
    this.store.set('locale', parsed.locale)
    return parsed.locale
  }

  listLocales(): LocaleManifest[] {
    return LOCALE_MANIFESTS
  }

  reloadResources(): number {
    return LOCALE_MANIFESTS.length
  }
}
