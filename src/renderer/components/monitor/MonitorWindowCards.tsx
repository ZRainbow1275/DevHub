import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { MonitorPopoutLayout, MonitorSnapshot, MonitorTool, MonitorWindowState, ToolMonitorCard } from '@shared/schemas/r8-runtime'
import { useT } from '../../hooks/useT'

const TOOL_LABELS: Record<MonitorTool, string> = {
  codex: 'Codex',
  claude: 'Claude',
  gemini: 'Gemini',
  cursor: 'Cursor',
  copilot: 'Copilot'
}

type MonitorPrefsDraft = Pick<MonitorWindowState, 'alwaysOnTop' | 'opacity'>

const MONITOR_POPOUT_LAYOUTS: { value: MonitorPopoutLayout; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'progress-only', label: '仅进度' },
  { value: 'events-only', label: '仅事件' }
]

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function confidenceTone(confidence: number): string {
  if (confidence < 0.5) return 'border-error/50 bg-error/10 text-error'
  if (confidence < 0.7) return 'border-warning/50 bg-warning/10 text-warning'
  if (confidence < 0.9) return 'border-accent/50 bg-accent/10 text-accent'
  return 'border-success/50 bg-success/10 text-success'
}

function instanceIdForCard(card: ToolMonitorCard): string {
  const latestEvent = card.recentEvents.at(-1)
  return card.progress?.instanceId ?? latestEvent?.instanceId ?? `${card.tool}-main`
}

export function ConfidenceBadge({ confidence }: { confidence: number | null | undefined }) {
  if (confidence === null || confidence === undefined) {
    return (
      <span className="border border-surface-700 bg-surface-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted radius-sm">
        N/A
      </span>
    )
  }

  return (
    <span
      className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider radius-sm ${confidenceTone(confidence)}`}
      data-confidence={confidence}
    >
      {formatPercent(confidence)}
    </span>
  )
}

export function MonitorWindowCards({
  snapshot,
  prefsDraft,
  targetTool = null,
  targetPopoutLayout = 'compact',
  poppedOutTools = new Set<MonitorTool>(),
  onFocusInstance,
  onOpenPopout,
  onReturnPopout,
  onSetPopoutLayout,
  onPrefsChange,
  showWindowControls = true
}: {
  snapshot: MonitorSnapshot | null
  prefsDraft: MonitorPrefsDraft
  targetTool?: MonitorTool | null
  targetPopoutLayout?: MonitorPopoutLayout
  poppedOutTools?: ReadonlySet<MonitorTool>
  onFocusInstance: (tool: MonitorTool, instanceId: string) => void
  onOpenPopout?: (tool: MonitorTool, layout?: MonitorPopoutLayout) => void
  onReturnPopout?: (tool: MonitorTool) => void
  onSetPopoutLayout?: (tool: MonitorTool, layout: MonitorPopoutLayout) => void
  onPrefsChange?: (patch: Partial<MonitorPrefsDraft>) => void
  showWindowControls?: boolean
}) {
  const { t } = useT()
  const [layoutMenuTool, setLayoutMenuTool] = useState<MonitorTool | null>(null)
  const layoutMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!layoutMenuTool) return undefined
    const closeOnOutside = (event: MouseEvent) => {
      if (layoutMenuRef.current?.contains(event.target as Node)) return
      setLayoutMenuTool(null)
    }
    document.addEventListener('click', closeOnOutside)
    return () => document.removeEventListener('click', closeOnOutside)
  }, [layoutMenuTool])

  if (!snapshot) {
    return <div className="text-sm text-text-muted">等待真实 monitor:snapshot 数据</div>
  }

  const visibleCards = targetTool ? snapshot.cards.filter(card => card.tool === targetTool) : snapshot.cards

  return (
    <div className="space-y-4" data-r8c-monitor-window="true">
      <div className="grid gap-3 xl:grid-cols-5">
        {visibleCards.map(card => {
          const progressValue = card.progress?.percent ?? 0
          const progressPercent = Math.round(progressValue * 100)
          const confidence = card.progress?.confidence ?? card.recentEvents.at(-1)?.confidence ?? null
          const instanceId = instanceIdForCard(card)
          const poppedOut = poppedOutTools.has(card.tool)
          const activeLayout = targetTool === card.tool ? targetPopoutLayout : 'compact'
          const canChangeLayout = Boolean(targetTool === card.tool && onSetPopoutLayout)
          const focusCard = () => onFocusInstance(card.tool, instanceId)
          const openLayoutMenu = (event: ReactMouseEvent) => {
            if (!canChangeLayout) return
            event.preventDefault()
            event.stopPropagation()
            setLayoutMenuTool(card.tool)
          }
          return (
            <div
              role="button"
              aria-label={`${TOOL_LABELS[card.tool]} 监控卡片，状态 ${card.currentPhase}`}
              tabIndex={0}
              key={card.tool}
              data-tool={card.tool}
              data-layout={targetTool === card.tool ? activeLayout : undefined}
              onClick={focusCard}
              onContextMenu={openLayoutMenu}
              onDoubleClick={() => {
                if (targetTool === card.tool) onReturnPopout?.(card.tool)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  focusCard()
                }
              }}
              className="min-h-[150px] border border-surface-700 bg-surface-950 p-3 text-left transition-colors hover:border-accent/60 hover:bg-surface-900 radius-md"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-text-primary">{TOOL_LABELS[card.tool]}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{card.currentPhase}</div>
                </div>
                <ConfidenceBadge confidence={confidence} />
              </div>

              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={poppedOut ? 'text-[10px] font-bold uppercase tracking-wider text-accent' : 'text-[10px] uppercase tracking-wider text-text-muted'}>
                  {poppedOut ? '已弹出' : '主面板'}
                </span>
                {onOpenPopout && !targetTool && (
                  <button
                    type="button"
                    className="border border-surface-700 bg-surface-900 px-2 py-1 text-[10px] font-bold text-text-secondary hover:border-accent hover:text-accent radius-sm"
                    onClick={event => {
                      event.stopPropagation()
                      onOpenPopout(card.tool, 'compact')
                    }}
                  >
                    弹出
                  </button>
                )}
                {canChangeLayout && (
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={layoutMenuTool === card.tool}
                    className="border border-surface-700 bg-surface-900 px-2 py-1 text-[10px] font-bold text-text-secondary hover:border-accent hover:text-accent radius-sm"
                    onClick={openLayoutMenu}
                  >
                    布局
                  </button>
                )}
              </div>

              {layoutMenuTool === card.tool && canChangeLayout && (
                <div
                  ref={layoutMenuRef}
                  role="menu"
                  aria-label={`${TOOL_LABELS[card.tool]} layout menu`}
                  className="mb-3 grid gap-1 border border-surface-700 bg-surface-950 p-2 radius-sm"
                  onClick={event => event.stopPropagation()}
                  onKeyDown={event => {
                    if (event.key === 'Escape') setLayoutMenuTool(null)
                  }}
                >
                  {MONITOR_POPOUT_LAYOUTS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      className={`px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider radius-sm ${activeLayout === option.value ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-surface-900 hover:text-text-primary'}`}
                      onClick={() => {
                        onSetPopoutLayout?.(card.tool, option.value)
                        setLayoutMenuTool(null)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {activeLayout !== 'events-only' && (
                <div
                  role="progressbar"
                  aria-label={`${TOOL_LABELS[card.tool]} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  className="mb-3 h-2 overflow-hidden bg-surface-800 radius-sm"
                >
                  <div className="h-full bg-accent transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
              )}

              {activeLayout === 'compact' && (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <span className="text-text-muted">进度</span>
                  <span className="text-right font-mono text-text-primary">{formatPercent(progressValue)}</span>
                  <span className="text-text-muted">实例</span>
                  <span className="text-right font-mono text-text-primary">{card.instanceCount}</span>
                  <span className="text-text-muted">Tokens</span>
                  <span className="text-right font-mono text-text-primary">{card.tokens ? `${card.tokens.input}/${card.tokens.output}` : 'N/A'}</span>
                  <span className="text-text-muted">Cost</span>
                  <span className="text-right font-mono text-text-primary">{card.costUsd === null ? 'N/A' : `$${card.costUsd.toFixed(4)}`}</span>
                </div>
              )}

              {activeLayout === 'events-only' && (
                <div className="space-y-1 text-[11px]" data-monitor-popout-events={card.tool}>
                  {(card.recentEvents.length > 0 ? card.recentEvents.slice(-3) : [{ line: '暂无实时事件', observedAt: 0 }]).map((event, index) => (
                    <div key={`${card.tool}-event-${index}`} className="border border-surface-800 bg-surface-900 px-2 py-1 text-text-secondary radius-sm">
                      <span className="font-mono text-text-muted">{event.observedAt ? new Date(event.observedAt).toLocaleTimeString() : '--:--:--'}</span>
                      <span className="ml-2">{event.line}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showWindowControls && onPrefsChange && (
        <div className="grid gap-3 border border-surface-800 bg-surface-950 p-3 radius-md lg:grid-cols-[1fr_220px]">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-text-secondary">{t('monitor.window.alwaysOnTop', 'Always on top')}</span>
            <input
              type="checkbox"
              checked={prefsDraft.alwaysOnTop}
              onChange={event => onPrefsChange({ alwaysOnTop: event.currentTarget.checked })}
              aria-label="monitor always on top"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="flex items-center justify-between gap-3 text-text-secondary">
              <span>Opacity</span>
              <span className="font-mono text-text-primary">{formatPercent(prefsDraft.opacity)}</span>
            </span>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={prefsDraft.opacity}
              onChange={event => onPrefsChange({ opacity: Number(event.currentTarget.value) })}
              aria-label="monitor opacity"
            />
          </label>
        </div>
      )}

      <div className="text-[11px] text-text-muted">
        Snapshot: {new Date(snapshot.collectedAt).toLocaleTimeString()} / stream: monitor:snapshot-stream
      </div>
    </div>
  )
}
