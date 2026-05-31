import { useCallback, useEffect, useState } from 'react'
import type { BrowserPopout, PanelPopoutSurface } from '@shared/schemas/r8-runtime'
import { PopoutIcon } from '../icons'

const PANEL_POPOUT_REFRESH_MS = 750

interface PanelDetachButtonProps {
  surface: PanelPopoutSurface
  testId?: string
  className?: string
  label?: string
}

function panelPopoutTargetId(surface: PanelPopoutSurface): string {
  return `r8-panel-${surface}`
}

function findActivePanelPopout(popouts: readonly BrowserPopout[], surface: PanelPopoutSurface): BrowserPopout | null {
  const targetId = panelPopoutTargetId(surface)
  return popouts.find(popout => (
    popout.mode === 'browserwindow'
    && popout.surface === surface
    && popout.targetId === targetId
    && popout.bridgeState !== 'closed'
  )) ?? null
}

export function PanelDetachButton({ surface, testId, className, label }: PanelDetachButtonProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [activePopout, setActivePopout] = useState<BrowserPopout | null>(null)

  const readActivePopout = useCallback(async (): Promise<BrowserPopout | null> => {
    const bridge = window.devhub?.r8?.panel
    if (!bridge?.listPopouts) return null
    const popouts = await bridge.listPopouts()
    return findActivePanelPopout(popouts, surface)
  }, [surface])

  const refreshActivePopout = useCallback(async (): Promise<void> => {
    setActivePopout(await readActivePopout())
  }, [readActivePopout])

  useEffect(() => {
    let disposed = false

    const refresh = async () => {
      const next = await readActivePopout().catch(() => null)
      if (!disposed) setActivePopout(next)
    }

    void refresh()
    const intervalId = window.setInterval(() => {
      void refresh()
    }, PANEL_POPOUT_REFRESH_MS)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [readActivePopout])

  const handleClick = useCallback(() => {
    if (busy) return
    setBusy(true)
    const bridge = window.devhub?.r8?.panel
    if (!bridge?.openPopout || !bridge.closePopout) {
      setBusy(false)
      return
    }
    const action = activePopout
      ? bridge.closePopout(activePopout.windowId)
      : bridge.openPopout(surface)
    action
      .then(() => refreshActivePopout())
      .catch(() => undefined)
      .finally(() => setBusy(false))
  }, [activePopout, busy, refreshActivePopout, surface])

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
        <PopoutIcon size={14} className="text-accent-200" />
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
      <PopoutIcon size={14} className="text-text-secondary" />
      {label ? <span className="ml-1 text-xs">{label}</span> : null}
    </button>
  )
}
