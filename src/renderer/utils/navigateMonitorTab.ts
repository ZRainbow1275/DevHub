/**
 * Popout-aware cross-tab navigation for the system monitor.
 *
 * The Monitor tabs (process / port / window / ai-task / topology / r8-ops) are
 * hosted by {@link MonitorPanel} in the MAIN window, which switches the active
 * tab by listening for the `devhub:monitor-navigate` window event.
 *
 * Cross-process caveat (PR2/PR3): detail/panel/toolbar surfaces can be detached
 * into their OWN BrowserWindow via the panel popout system. Inside such a popout
 * a local `window.dispatchEvent('devhub:monitor-navigate')` only reaches
 * listeners in that popout's render process — it never reaches the main window's
 * `MonitorPanel`, and detail popouts do not even mount a `MonitorPanel`. So the
 * naive local-event approach silently no-ops when detached.
 *
 * This helper centralizes the correct behavior so every monitor view shares one
 * code path instead of re-deriving it (and re-stepping on the same trap):
 *
 * - In a panel popout (`?r8PanelPopout=` present): hop through the main-process
 *   command bridge `command.invoke('monitor.<tab>')`. The main process
 *   re-broadcasts it as an `r8:command-event {type:'monitor-navigate', tab}` that
 *   the MAIN window's `App` turns back into the local navigate event, so the main
 *   window (not the popout) switches tabs. If the bridge is unavailable or the
 *   invoke rejects, we fall back to the local event so the action never silently
 *   dies.
 * - In the main window: dispatch the cheap local event directly.
 *
 * Extra `detail` fields (pid / port / hwnd / taskId / scope) ride along for any
 * listener that wants to pre-select an item; they match the existing event shape
 * used across `ProcessView` / `WindowView` / topology.
 */

export type MonitorTab = 'process' | 'port' | 'window' | 'ai-task' | 'topology' | 'r8-ops'

const MONITOR_TABS = new Set<MonitorTab>(['process', 'port', 'window', 'ai-task', 'topology', 'r8-ops'])

export function isMonitorTab(value: unknown): value is MonitorTab {
  return typeof value === 'string' && MONITOR_TABS.has(value as MonitorTab)
}

/** Whether the current render process is a detached panel popout window. */
export function isInsidePanelPopout(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('r8PanelPopout')
}

export interface NavigateMonitorTabOptions {
  /**
   * Optional selection payload to carry on the local navigate event so a tab can
   * pre-select an item once it mounts. Ignored by the command-bridge hop (the
   * main window re-selects via its own mechanisms / popout hydration).
   */
  detail?: Record<string, unknown>
  /**
   * When true (default) also fire `devhub:open-monitor` so a non-monitor main
   * view switches into the monitor first. Has no effect inside a popout hop.
   */
  openMonitor?: boolean
}

function dispatchLocalNavigate(tab: MonitorTab, options?: NavigateMonitorTabOptions): void {
  if (typeof window === 'undefined') return
  if (options?.openMonitor !== false) {
    window.dispatchEvent(new CustomEvent('devhub:open-monitor'))
  }
  window.dispatchEvent(
    new CustomEvent('devhub:monitor-navigate', {
      detail: { tab, ...(options?.detail ?? {}) }
    })
  )
}

/**
 * Navigate the system monitor to {@link tab}, transparently handling whether the
 * caller is running in the main window or a detached panel popout. Always safe to
 * call (degrades to the local event; never throws).
 */
export function navigateMonitorTab(tab: MonitorTab, options?: NavigateMonitorTabOptions): void {
  if (typeof window === 'undefined') return

  if (isInsidePanelPopout()) {
    const invoke = window.devhub?.r8?.command?.invoke
    if (invoke) {
      // Cross-process: route through main so the MAIN window switches tabs.
      void invoke(`monitor.${tab}`).catch(() => {
        // Bridge rejected (e.g. command missing) — degrade to local event rather
        // than silently failing.
        dispatchLocalNavigate(tab, options)
      })
      return
    }
    // No bridge at all (e.g. preload unavailable) — degrade to local event.
  }

  dispatchLocalNavigate(tab, options)
}
