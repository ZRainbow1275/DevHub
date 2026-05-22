import { nativeTheme, systemPreferences } from 'electron'
import Store from 'electron-store'
import {
  a11yOsPrefsSchema,
  a11yPrefsSchema,
  a11ySelfCheckResultSchema,
  type A11yOsPrefs,
  type A11yPrefs,
  type A11ySelfCheckResult,
} from '@shared/schemas/r8-runtime'

interface A11yStoreShape {
  prefs: A11yPrefs
}

export type A11yOsPrefsReader = () => A11yOsPrefs

const DEFAULT_A11Y_PREFS: A11yPrefs = a11yPrefsSchema.parse({})

function readElectronOsPrefs(): A11yOsPrefs {
  const animationSettings = systemPreferences.getAnimationSettings()
  return a11yOsPrefsSchema.parse({
    reducedMotion: animationSettings.prefersReducedMotion,
    highContrast: nativeTheme.shouldUseHighContrastColors,
    forcedColors: nativeTheme.shouldUseHighContrastColors,
  })
}

export class A11ySelfCheck {
  private readonly store: Store<A11yStoreShape>
  private readonly osPrefsReader: A11yOsPrefsReader
  private readonly now: () => number

  constructor(
    store?: Store<A11yStoreShape>,
    osPrefsReader: A11yOsPrefsReader = readElectronOsPrefs,
    now: () => number = Date.now
  ) {
    this.store = store ?? new Store<A11yStoreShape>({
      name: 'devhub-a11y',
      defaults: { prefs: DEFAULT_A11Y_PREFS },
    })
    this.osPrefsReader = osPrefsReader
    this.now = now
  }

  getPrefs(): A11yPrefs {
    const rawPrefs = this.store.get('prefs', DEFAULT_A11Y_PREFS)
    const parsed = a11yPrefsSchema.safeParse({ ...DEFAULT_A11Y_PREFS, ...rawPrefs })
    return parsed.success ? parsed.data : DEFAULT_A11Y_PREFS
  }

  setPrefs(input: unknown): A11yPrefs {
    const parsed = a11yPrefsSchema.parse(input)
    this.store.set('prefs', parsed)
    return parsed
  }

  getOsPrefs(): A11yOsPrefs {
    try {
      return a11yOsPrefsSchema.parse(this.osPrefsReader())
    } catch (error) {
      console.warn('[A11ySelfCheck] Failed to read OS accessibility preferences:', error)
      return a11yOsPrefsSchema.parse({
        reducedMotion: false,
        highContrast: false,
        forcedColors: false,
      })
    }
  }

  runSelfCheck(): A11ySelfCheckResult {
    const prefs = this.getPrefs()
    const osPrefs = this.getOsPrefs()
    const warnings: string[] = [
      'Axe audit was not executed inside the main-process self-check. Run pnpm a11y:audit -- --url <running-url> against a live renderer for axe evidence.',
    ]

    if (prefs.followOsSettings && (osPrefs.reducedMotion || osPrefs.highContrast || osPrefs.forcedColors)) {
      warnings.push('OS accessibility preferences are active and will be reflected through renderer document attributes.')
    }

    const result = {
      ts: this.now(),
      axeExecuted: false,
      axeTarget: null,
      axeViolations: [],
      contrastFailures: [],
      keyboardUnreachable: [],
      warnings,
      passed: false,
    }

    return a11ySelfCheckResultSchema.parse(result)
  }
}
