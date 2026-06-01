import { useEffect } from 'react'
import { APP_SETTINGS_CHANGE_EVENT, type AppSettings } from '@shared/types'
import { popoutThemeSyncPayloadSchema } from '@shared/schemas/r8-runtime'
import {
  applyThemeDecorationToDocument,
  applyThemeStateToDocument,
  applyHolidayThemeToDocument,
  resolveEffectiveThemeDecoration,
  resolveHolidayTheme,
  resolveThemeState
} from '../theme/theme-language'

function readSystemThemePreference() {
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light' as const
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark' as const
  return 'no-preference' as const
}

function readSystemMotionPreference() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduce' as const : 'no-preference' as const
}

/**
 * Applies a theme settings payload pushed from the main process onto the current
 * document. Shared by {@link useTheme} (main window) and the panel popout shell.
 */
export function applyPopoutThemeSettings(settings: AppSettings): void {
  const resolved = resolveThemeState(settings, readSystemThemePreference(), readSystemMotionPreference())
  applyThemeStateToDocument(resolved)
  applyHolidayThemeToDocument(resolveHolidayTheme(settings.appearance))
  applyThemeDecorationToDocument(resolveEffectiveThemeDecoration(settings))
}

/**
 * Boots and keeps a detached panel popout window in sync with the main window's
 * theme. Panel popouts are full `index.html` instances that do NOT mount the full
 * {@link useTheme} hook (the App early-returns into the popout shell), so without
 * this hook they would render with the default-theme CSS and never re-skin:
 *
 * 1. On mount it reads persisted settings once and applies the initial theme, so
 *    a freshly-opened popout matches the main window instead of booting unthemed.
 * 2. It then subscribes to live theme broadcasts
 *    (`popout:bridge-message {type:'sync', key:'theme-settings'}`) so a theme
 *    change in the main window re-skins the already-open popout in real time (R3.4).
 *
 * Degrades safely when the settings API / bridge is unavailable (no-op cleanup).
 */
export function usePopoutThemeBridge(): void {
  useEffect(() => {
    let disposed = false

    // 1. Apply the persisted theme once on boot. The popout shell never mounts
    // useTheme, so this is the only initial-theme application for the window.
    void window.devhub?.settings?.get?.()
      .then((settings) => {
        if (disposed || !settings?.appearance) return
        applyPopoutThemeSettings(settings as AppSettings)
      })
      .catch(() => undefined)

    // 2. Subscribe to live theme broadcasts from the main window.
    const bridge = window.devhub?.r8?.popout?.onBridgeMessage
    const unsubscribe = bridge?.((message) => {
      if (message.type !== 'sync' || message.key !== 'theme-settings') return
      const parsed = popoutThemeSyncPayloadSchema.safeParse(message.value)
      if (!parsed.success) return
      const settings = parsed.data.settings as unknown as AppSettings
      applyPopoutThemeSettings(settings)
      window.dispatchEvent(new CustomEvent<AppSettings>(APP_SETTINGS_CHANGE_EVENT, { detail: settings }))
    })

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [])
}
