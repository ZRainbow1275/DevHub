import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { monitorToolSchema, type MonitorPopout, type MonitorPopoutLayout, type MonitorSnapshot, type MonitorTool } from '@shared/schemas/r8-runtime'
import { MonitorWindowCards } from './components/monitor/MonitorWindowCards'
import './styles/globals.css'

const FALLBACK_PREFS = { alwaysOnTop: false, opacity: 1 }

function readTargetTool(): MonitorTool | null {
  const params = new URLSearchParams(window.location.search)
  const parsed = monitorToolSchema.safeParse(params.get('target'))
  return parsed.success ? parsed.data : null
}

function readPopoutId(): string | null {
  const value = new URLSearchParams(window.location.search).get('r8Popout')
  return value && value.trim().length > 0 ? value : null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function findActivePopout(popouts: MonitorPopout[], tool: MonitorTool): MonitorPopout | null {
  return popouts.find(popout => popout.tool === tool && popout.bridgeState !== 'closed') ?? null
}

function MonitorPopoutApp(): React.JSX.Element {
  const targetTool = useMemo(() => readTargetTool(), [])
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null)
  const [popoutId, setPopoutId] = useState<string | null>(() => readPopoutId())
  const [layout, setLayout] = useState<MonitorPopoutLayout>('compact')
  const [error, setError] = useState<string | null>(null)

  const refreshPopoutRecord = useCallback(async () => {
    if (!targetTool) return
    const popouts = await window.devhub.r8.monitor.listPopouts()
    const activePopout = findActivePopout(popouts, targetTool)
    if (!activePopout) return
    setPopoutId(activePopout.windowId)
    setLayout(activePopout.miniLayout)
  }, [targetTool])

  useEffect(() => {
    if (!targetTool) return undefined
    let disposed = false

    const loadInitialState = async () => {
      try {
        const [nextSnapshot] = await Promise.all([
          window.devhub.r8.monitor.snapshot(),
          refreshPopoutRecord()
        ])
        if (!disposed) setSnapshot(nextSnapshot)
      } catch (loadError) {
        if (!disposed) setError(errorMessage(loadError))
      }
    }

    void loadInitialState()

    const unsubscribe = window.devhub.r8.monitor.onPopoutSnapshotStream(card => {
      if (card.tool !== targetTool) return
      setSnapshot(current => {
        if (!current) return current
        return {
          ...current,
          cards: current.cards.map(item => item.tool === card.tool ? card : item),
          collectedAt: Date.now()
        }
      })
      void refreshPopoutRecord().catch(refreshError => setError(errorMessage(refreshError)))
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [refreshPopoutRecord, targetTool])

  const poppedOutTools = useMemo(() => new Set<MonitorTool>(targetTool ? [targetTool] : []), [targetTool])

  const focusInstance = useCallback((tool: MonitorTool, instanceId: string) => {
    void window.devhub.r8.monitor.focusInstance(tool, instanceId).catch(focusError => setError(errorMessage(focusError)))
  }, [])

  const returnPopout = useCallback(() => {
    if (!popoutId) return
    void window.devhub.r8.monitor.returnPopoutToMain(popoutId).catch(returnError => setError(errorMessage(returnError)))
  }, [popoutId])

  const setPopoutLayout = useCallback((_tool: MonitorTool, nextLayout: MonitorPopoutLayout) => {
    if (!popoutId) return
    setLayout(nextLayout)
    void window.devhub.r8.monitor.setPopoutLayout(popoutId, nextLayout)
      .then(result => {
        setLayout(result.layout)
        return refreshPopoutRecord()
      })
      .catch(layoutError => setError(errorMessage(layoutError)))
  }, [popoutId, refreshPopoutRecord])

  if (!targetTool) {
    return (
      <main className="min-h-screen border border-error/40 bg-error/10 p-4 text-sm text-error" data-r8c-monitor-popout-error="missing-target">
        R8 monitor popout target is missing or invalid.
      </main>
    )
  }

  return (
    <main className="min-h-screen p-3" data-r8c-monitor-popout="true" data-target={targetTool}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">R8 Monitor Popout</div>
          <h1 className="text-base font-bold text-text-primary">{targetTool}</h1>
        </div>
        <button
          type="button"
          className="border border-surface-700 bg-surface-900 px-2 py-1 text-[10px] font-bold text-text-secondary hover:border-accent hover:text-accent radius-sm"
          onClick={returnPopout}
        >
          Return
        </button>
      </header>

      {error && (
        <div className="mb-3 border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning radius-sm" role="status">
          {error}
        </div>
      )}

      <MonitorWindowCards
        snapshot={snapshot}
        prefsDraft={snapshot?.windowState ?? FALLBACK_PREFS}
        targetTool={targetTool}
        targetPopoutLayout={layout}
        poppedOutTools={poppedOutTools}
        onFocusInstance={focusInstance}
        onReturnPopout={returnPopout}
        onSetPopoutLayout={setPopoutLayout}
        showWindowControls={false}
      />
    </main>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('R8 monitor popout root is missing')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <MonitorPopoutApp />
  </React.StrictMode>
)
