import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { MonitorPopout, MonitorPopoutLayout, MonitorSnapshot, MonitorTool, MonitorWindowState } from '@shared/schemas/r8-runtime'
import { MonitorWindowCards } from './components/monitor/MonitorWindowCards'
import './styles/globals.css'

type MonitorPrefsDraft = Pick<MonitorWindowState, 'alwaysOnTop' | 'opacity'>

const FALLBACK_PREFS: MonitorPrefsDraft = { alwaysOnTop: false, opacity: 1 }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function MonitorApp(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null)
  const [popouts, setPopouts] = useState<MonitorPopout[]>([])
  const [prefsDraft, setPrefsDraft] = useState<MonitorPrefsDraft>(FALLBACK_PREFS)
  const [error, setError] = useState<string | null>(null)

  const refreshPopouts = useCallback(async () => {
    const nextPopouts = await window.devhub.r8.monitor.listPopouts()
    setPopouts(nextPopouts.filter(popout => popout.bridgeState !== 'closed'))
  }, [])

  const loadSnapshot = useCallback(async () => {
    const nextSnapshot = await window.devhub.r8.monitor.snapshot()
    setSnapshot(nextSnapshot)
    setPrefsDraft({
      alwaysOnTop: nextSnapshot.windowState.alwaysOnTop,
      opacity: nextSnapshot.windowState.opacity
    })
  }, [])

  useEffect(() => {
    let disposed = false

    const loadInitialState = async () => {
      try {
        const [nextSnapshot, nextPopouts] = await Promise.all([
          window.devhub.r8.monitor.snapshot(),
          window.devhub.r8.monitor.listPopouts()
        ])
        if (disposed) return
        setSnapshot(nextSnapshot)
        setPrefsDraft({
          alwaysOnTop: nextSnapshot.windowState.alwaysOnTop,
          opacity: nextSnapshot.windowState.opacity
        })
        setPopouts(nextPopouts.filter(popout => popout.bridgeState !== 'closed'))
      } catch (loadError) {
        if (!disposed) setError(errorMessage(loadError))
      }
    }

    void loadInitialState()

    const unsubscribeSnapshot = window.devhub.r8.monitor.onSnapshotStream(nextSnapshot => {
      setSnapshot(nextSnapshot)
      setPrefsDraft({
        alwaysOnTop: nextSnapshot.windowState.alwaysOnTop,
        opacity: nextSnapshot.windowState.opacity
      })
    })
    const unsubscribePopoutSnapshot = window.devhub.r8.monitor.onPopoutSnapshotStream(card => {
      setSnapshot(current => {
        if (!current) return current
        return {
          ...current,
          cards: current.cards.map(item => item.tool === card.tool ? card : item),
          collectedAt: Date.now()
        }
      })
      void refreshPopouts().catch(refreshError => setError(errorMessage(refreshError)))
    })

    return () => {
      disposed = true
      unsubscribeSnapshot()
      unsubscribePopoutSnapshot()
    }
  }, [refreshPopouts])

  const poppedOutTools = useMemo(() => new Set<MonitorTool>(popouts.map(popout => popout.tool)), [popouts])

  const focusInstance = useCallback((tool: MonitorTool, instanceId: string) => {
    void window.devhub.r8.monitor.focusInstance(tool, instanceId).catch(focusError => setError(errorMessage(focusError)))
  }, [])

  const openPopout = useCallback((tool: MonitorTool, layout?: MonitorPopoutLayout) => {
    void window.devhub.r8.monitor.openPopout(tool, layout)
      .then(() => refreshPopouts())
      .catch(openError => setError(errorMessage(openError)))
  }, [refreshPopouts])

  const returnPopout = useCallback((tool: MonitorTool) => {
    const popout = popouts.find(item => item.tool === tool && item.bridgeState !== 'closed')
    if (!popout) return
    void window.devhub.r8.monitor.returnPopoutToMain(popout.windowId)
      .then(() => refreshPopouts())
      .catch(returnError => setError(errorMessage(returnError)))
  }, [popouts, refreshPopouts])

  const setPopoutLayout = useCallback((tool: MonitorTool, layout: MonitorPopoutLayout) => {
    const popout = popouts.find(item => item.tool === tool && item.bridgeState !== 'closed')
    if (!popout) return
    void window.devhub.r8.monitor.setPopoutLayout(popout.windowId, layout)
      .then(() => refreshPopouts())
      .catch(layoutError => setError(errorMessage(layoutError)))
  }, [popouts, refreshPopouts])

  const updatePrefs = useCallback((patch: Partial<MonitorPrefsDraft>) => {
    const nextDraft = { ...prefsDraft, ...patch }
    setPrefsDraft(nextDraft)
    void window.devhub.r8.monitor.setWindowPrefs({ ...patch, confirmedBy: 'monitor-window' })
      .then(() => loadSnapshot())
      .catch(prefError => setError(errorMessage(prefError)))
  }, [loadSnapshot, prefsDraft])

  return (
    <main className="min-h-screen p-4" data-r8c-monitor-dedicated="true">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">R8 Monitor</div>
          <h1 className="text-xl font-bold text-text-primary">AI Monitor Window</h1>
          <p className="mt-1 text-xs text-text-muted">Dedicated renderer and monitor-only preload.</p>
        </div>
        <button
          type="button"
          className="border border-surface-700 bg-surface-900 px-2 py-1 text-[10px] font-bold text-text-secondary hover:border-accent hover:text-accent radius-sm"
          onClick={() => { void window.devhub.r8.monitor.close().catch(closeError => setError(errorMessage(closeError))) }}
        >
          Close
        </button>
      </header>

      {error && (
        <div className="mb-3 border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning radius-sm" role="status">
          {error}
        </div>
      )}

      <MonitorWindowCards
        snapshot={snapshot}
        prefsDraft={prefsDraft}
        poppedOutTools={poppedOutTools}
        onFocusInstance={focusInstance}
        onOpenPopout={openPopout}
        onReturnPopout={returnPopout}
        onSetPopoutLayout={setPopoutLayout}
        onPrefsChange={updatePrefs}
      />
    </main>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('R8 monitor root is missing')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <MonitorApp />
  </React.StrictMode>
)
