import { useCallback, useMemo, useState } from 'react'
import type { BrowserPopout, PanelPopoutSurface } from '@shared/schemas/r8-runtime'
import { ExternalLinkIcon } from '../icons'
import { refreshPanelPopoutList, usePanelPopoutList } from '../../stores/panelPopoutListStore'

interface PanelDetachButtonProps {
  surface: PanelPopoutSurface
  /** Detach target (kind:value, e.g. `pid:1234`) for detail surfaces. */
  target?: string | null
  testId?: string
  className?: string
  label?: string
}

function panelPopoutTargetId(surface: PanelPopoutSurface, target?: string | null): string {
  return target ?? `r8-panel-${surface}`
}

// Surface a detach failure to the user instead of swallowing it. Routes through
// the notification system (visible in the notifications drawer / statusbar) so a
// failure to open the popout window is never silent. Best-effort: notify is a
// lazy path that must not itself throw.
function reportPanelDetachFailure(surface: PanelPopoutSurface, target: string | null | undefined, error: unknown): void {
  console.error('[panel-detach] openPopout failed', { surface, target: target ?? null }, error)
  const message = error instanceof Error ? error.message : String(error)
  try {
    void window.devhub?.r8?.notify?.emit?.({
      level: 'ERROR',
      source: 'system',
      title: '悬浮窗打开失败',
      body: `面板 ${surface}${target ? `（${target}）` : ''} 未能悬浮：${message}`
    })?.catch?.(() => undefined)
  } catch {
    // notify bridge unavailable (e.g. inside a detached popout shell): the
    // console.error above remains the visible signal.
  }
}

function isLivePanelPopout(popout: BrowserPopout, surface: PanelPopoutSurface): boolean {
  return popout.mode === 'browserwindow'
    && popout.surface === surface
    && popout.bridgeState !== 'closed'
}

/**
 * Resolves the popout this button should recall. The exact `(surface, target)`
 * match wins so a per-item detail button recalls its own window. When the button
 * has no target (e.g. the detail selection was cleared) we still recall ANY live
 * popout for the surface instead of falling through to a fresh `r8-panel-<surface>`
 * window — this is the PR2 recall quirk fix that prevented duplicate windows.
 */
function findActivePanelPopout(
  popouts: readonly BrowserPopout[],
  surface: PanelPopoutSurface,
  target?: string | null
): BrowserPopout | null {
  const live = popouts.filter(popout => isLivePanelPopout(popout, surface))
  if (live.length === 0) return null

  if (target) {
    const exact = live.find(popout => String(popout.targetId) === target)
    if (exact) return exact
    // A target was requested but no window matches it yet: open a new one.
    return null
  }

  // No target on this button: recall any live popout for the surface (prefer the
  // canonical whole-surface window) rather than spawning a duplicate.
  const canonicalId = panelPopoutTargetId(surface, null)
  return live.find(popout => String(popout.targetId) === canonicalId) ?? live[0]
}

export function PanelDetachButton({ surface, target, testId, className, label }: PanelDetachButtonProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  // Recall state is derived from the shared, globally-polled popout list — no
  // per-button interval — so dozens of mounted buttons never overload `popout:list`.
  const { popouts } = usePanelPopoutList()
  const activePopout = useMemo(
    () => findActivePanelPopout(popouts, surface, target),
    [popouts, surface, target]
  )

  const handleClick = useCallback(() => {
    if (busy) return
    setBusy(true)
    const bridge = window.devhub?.r8?.panel
    if (!bridge?.openPopout || !bridge.closePopout) {
      console.warn('[panel-detach] panel popout bridge unavailable; window.devhub.r8.panel.openPopout/closePopout missing', { surface, target: target ?? null })
      setBusy(false)
      return
    }
    const action = activePopout
      ? bridge.closePopout(activePopout.windowId)
      : bridge.openPopout(surface, target ?? undefined)
    action
      // Only the open/close ACTION reports failure (e.g. browserwindow limit). List
      // polling lives in the shared store and stays silent — a transient list rate
      // limit must never masquerade as a "popout failed to open" notification.
      .then(() => refreshPanelPopoutList())
      .catch(error => reportPanelDetachFailure(surface, target, error))
      .finally(() => setBusy(false))
  }, [activePopout, busy, surface, target])

  if (activePopout) {
    return (
      <button
        type="button"
        data-testid={testId ?? `${surface}-detach-popout`}
        data-r8c-panel-detach={surface}
        data-r8c-panel-detach-state="active"
        onClick={handleClick}
        disabled={busy}
        title="关闭悬浮窗口并召回面板"
        aria-label="已悬浮，点此召回"
        className={className ?? 'inline-flex min-h-8 flex-shrink-0 items-center gap-2 rounded border border-accent-600/40 bg-accent-500/10 px-3 py-1 text-accent-200 hover:border-accent-500 hover:bg-accent-500/15 disabled:opacity-60'}
      >
        <ExternalLinkIcon size={14} className="text-accent-200" />
        <span className="whitespace-nowrap text-xs font-medium">已悬浮，点此召回</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      data-testid={testId ?? `${surface}-detach-popout`}
      data-r8c-panel-detach={surface}
      onClick={handleClick}
      disabled={busy}
      title="悬浮到所有应用之上"
      aria-label="悬浮"
      className={className ?? 'btn-icon flex-shrink-0 bg-surface-800 border border-surface-700 hover:bg-surface-700 hover:border-surface-600'}
    >
      <ExternalLinkIcon size={14} className="text-text-secondary" />
      {label ? <span className="ml-1 text-xs">{label}</span> : null}
    </button>
  )
}
