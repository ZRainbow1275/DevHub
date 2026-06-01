import { app } from 'electron'

/**
 * Applies the OS-level "open at login" setting via Electron's
 * {@link Electron.App.setLoginItemSettings}.
 *
 * Platform support:
 * - Windows / macOS: natively honored by `setLoginItemSettings`.
 * - Linux: Electron does not implement login-item settings, so this is a no-op.
 *
 * Cross-machine / release compatibility is a hard constraint: the API may be
 * missing (older Electron, unusual runtime) or throw on some platforms, so every
 * call is guarded. A failure degrades to "auto-start not applied" rather than
 * crashing the main process. Returns true when the setting was applied, false
 * when it was skipped/failed.
 */
export function applyAutoStartSetting(openAtLogin: boolean): boolean {
  try {
    const setLoginItemSettings = app?.setLoginItemSettings
    if (typeof setLoginItemSettings !== 'function') return false
    // Bind to `app` so the Electron native call keeps its receiver.
    setLoginItemSettings.call(app, { openAtLogin })
    return true
  } catch (error) {
    console.warn('autoStart: failed to apply login item settings:', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * Reads back whether the app is currently registered to open at login. Guarded
 * the same way as {@link applyAutoStartSetting}; returns null when the platform /
 * runtime does not expose the query.
 */
export function readAutoStartSetting(): boolean | null {
  try {
    const getLoginItemSettings = app?.getLoginItemSettings
    if (typeof getLoginItemSettings !== 'function') return null
    const settings = getLoginItemSettings.call(app)
    return typeof settings?.openAtLogin === 'boolean' ? settings.openAtLogin : null
  } catch (error) {
    console.warn('autoStart: failed to read login item settings:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Aligns the OS login-item state with a persisted `autoStartOnBoot` value at
 * boot. Only writes when the current OS state differs (or cannot be read), to
 * avoid redundant native calls. Safe to call unconditionally; never throws.
 */
export function reconcileAutoStartOnBoot(persistedOpenAtLogin: boolean): void {
  const current = readAutoStartSetting()
  if (current === persistedOpenAtLogin) return
  applyAutoStartSetting(persistedOpenAtLogin)
}
