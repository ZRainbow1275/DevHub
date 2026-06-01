import { useEffect } from 'react'
import { create } from 'zustand'
import type { BrowserPopout } from '@shared/schemas/r8-runtime'

/**
 * Shared single source for the live BrowserWindow panel-popout list.
 *
 * Why this exists: every {@link PanelDetachButton} previously ran its own
 * `setInterval` polling `popout:list` (RATE_LIMITS.QUERY). With the button mounted
 * in 5 tab panels + 4 detail views + every dashboard widget (one per WidgetHost) +
 * the monitor toolbar, dozens of instances polled concurrently and tripped the
 * rate limiter — `popout:list` threw `RateLimitError`, recall state went blank, and
 * the failure was misreported as "popout failed to open".
 *
 * The fix is one GLOBAL poller for the whole renderer, reference-counted so it only
 * runs while at least one detach button is mounted, plus an explicit
 * {@link refreshPanelPopoutList} that is awaited after every open/close action so
 * recall state updates immediately without leaning on the slow poll interval.
 */

// Global poll cadence. Deliberately slow (a single timer, not per-button) so the
// list stays fresh enough for recall UX without ever approaching the query rate
// limit. Actions (open/close) trigger an immediate refresh on top of this.
const PANEL_POPOUT_POLL_MS = 2000

interface PanelPopoutListState {
  popouts: BrowserPopout[]
  /** True once the first successful list fetch has resolved. */
  ready: boolean
  setPopouts: (popouts: BrowserPopout[]) => void
}

export const usePanelPopoutListStore = create<PanelPopoutListState>((set) => ({
  popouts: [],
  ready: false,
  setPopouts: (popouts) => set({ popouts, ready: true })
}))

let subscriberCount = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let inFlight: Promise<void> | null = null

function panelBridge() {
  return typeof window === 'undefined' ? undefined : window.devhub?.r8?.panel
}

/**
 * Fetches the popout list once and pushes it into the shared store. Failures
 * (including a transient `popout:list` rate-limit) are swallowed here: a failed
 * poll must NEVER surface a user-facing notification — only explicit open/close
 * actions report failure. De-duped so concurrent callers share one in-flight call.
 */
export function refreshPanelPopoutList(): Promise<void> {
  if (inFlight) return inFlight
  const bridge = panelBridge()
  if (!bridge?.listPopouts) return Promise.resolve()
  inFlight = bridge
    .listPopouts()
    .then((popouts) => {
      usePanelPopoutListStore.getState().setPopouts(popouts)
    })
    .catch(() => {
      // Transient (rate limit / bridge teardown). Keep the last known list and
      // let the next poll recover. Silent by design — see file header.
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

function startPolling(): void {
  if (pollTimer !== null) return
  void refreshPanelPopoutList()
  pollTimer = setInterval(() => {
    void refreshPanelPopoutList()
  }, PANEL_POPOUT_POLL_MS)
}

function stopPolling(): void {
  if (pollTimer === null) return
  clearInterval(pollTimer)
  pollTimer = null
}

/**
 * Registers a subscriber to the shared poller. The poller runs only while the
 * count is > 0 (reference counting), so an app with no detach buttons mounted does
 * no polling at all. Returns an unsubscribe that decrements the count.
 */
export function acquirePanelPopoutPolling(): () => void {
  subscriberCount += 1
  if (subscriberCount === 1) startPolling()
  let released = false
  return () => {
    if (released) return
    released = true
    subscriberCount = Math.max(0, subscriberCount - 1)
    if (subscriberCount === 0) stopPolling()
  }
}

/**
 * Subscribes a React component to the shared panel-popout list. All detach buttons
 * read from this single source instead of each running their own interval.
 */
export function usePanelPopoutList(): { popouts: BrowserPopout[]; ready: boolean } {
  const popouts = usePanelPopoutListStore((state) => state.popouts)
  const ready = usePanelPopoutListStore((state) => state.ready)

  useEffect(() => acquirePanelPopoutPolling(), [])

  return { popouts, ready }
}

/** Test-only reset so the module-level poller singleton does not leak across cases. */
export function __resetPanelPopoutListStoreForTests(): void {
  stopPolling()
  subscriberCount = 0
  inFlight = null
  usePanelPopoutListStore.setState({ popouts: [], ready: false })
}
