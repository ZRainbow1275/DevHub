import { Suspense, lazy, useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  AppVersionInfo,
  BrowserPopout,
  CliOutputEvent,
  DrawerSlot,
  ObservabilityMetricSample,
  ObservabilitySnapshot,
  StatusAggregate
} from '@shared/schemas/r8-runtime'
import { AlertIcon, BellIcon, InfoIcon, LogIcon, MonitorIcon, PackageIcon, PopoutIcon, TerminalIcon, WindowIcon } from '../icons'
import {
  DRAWER_CONTENT_REGISTRY,
  getDrawerContentDefinition,
  type DrawerContentDefinition
} from './drawer-model'
import { useDrawerStore } from '../../stores/drawerStore'
import { useProjectStore } from '../../stores/projectStore'
import { usePortPopoutStore } from '../../stores/portPopoutStore'
import { closePortPopout } from '../popout/port-popout-model'
import { isPanelPopoutSurface } from '../popout/detachable-registry'
import { InjectWhitelistDrawer } from '../inject/InjectWhitelistDrawer'
import { SettingsDialog } from '../settings/SettingsDialog'
import { ObservabilityPanel } from '../../views/observability/ObservabilityPanel'
import { LogPanel } from '../log/LogPanel'
import { ErrorBoundary } from '../ErrorBoundary'

// Detail views are lazily imported so the (eagerly-loaded) drawer content module
// stays light — importing the full Monitor view tree up front would block the
// notifications/settings/etc. drawers behind the same module load.
const PortView = lazy(() => import('../monitor/PortView').then(m => ({ default: m.PortView })))
const ProcessView = lazy(() => import('../monitor/ProcessView').then(m => ({ default: m.ProcessView })))
const WindowView = lazy(() => import('../monitor/WindowView').then(m => ({ default: m.WindowView })))
const AITaskView = lazy(() => import('../monitor/AITaskView').then(m => ({ default: m.AITaskView })))

export interface DrawerContentModuleProps {
  slot: DrawerSlot
  contentId: string | null
  definition: DrawerContentDefinition | null
}

interface NotificationLike {
  id: string
  level: string
  source: string
  title: string
  body: string
}

function normalizeNotification(value: unknown): NotificationLike | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.title !== 'string') return null
  return {
    id: record.id,
    level: typeof record.level === 'string' ? record.level : 'INFO',
    source: typeof record.source === 'string' ? record.source : 'system',
    title: record.title,
    body: typeof record.body === 'string' ? record.body : ''
  }
}

export function RegistryCatalogContent() {
  return (
    <div className="space-y-3" data-r8b-drawer-lazy-content="registry">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
        <InfoIcon size={15} className="shrink-0 text-accent" />
        <span className="truncate">Drawer 内容注册表</span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {DRAWER_CONTENT_REGISTRY.map(definition => (
          <article key={definition.id} className="border-l-2 border-surface-600 bg-surface-950 p-3 radius-sm">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">{definition.defaultSlot}</div>
            <h3 className="text-sm font-bold text-text-primary">{definition.title}</h3>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{definition.description}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

export function NotificationsDrawerContent() {
  const [items, setItems] = useState<NotificationLike[]>([])
  const [error, setError] = useState<string | null>(null)

  useNotificationsEffect(setItems, setError)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted" data-r8b-drawer-lazy-content="notifications.top">
        <AlertIcon size={20} className="text-text-muted opacity-60" />
        <span>{error}</span>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" data-r8b-drawer-lazy-content="notifications.top">
        <div className="flex h-12 w-12 items-center justify-center bg-surface-800 radius-sm">
          <BellIcon size={20} className="text-text-muted" />
        </div>
        <div className="mt-3 text-sm font-semibold text-text-primary">当前没有活动通知</div>
        <p className="mt-1 max-w-xs text-xs leading-5 text-text-muted">系统通知、错误与桌面铃铛事件出现时会显示在此处。</p>
      </div>
    )
  }

  return (
    <div className="grid gap-2" data-r8b-drawer-lazy-content="notifications.top">
      {items.map(item => (
        <article key={item.id} className="border-l-2 border-accent/70 bg-surface-950 p-3 radius-sm">
          <div className="flex min-w-0 items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
            <BellIcon size={16} className="shrink-0 text-accent" />
            <span className="truncate">{item.level}</span>
            <span className="truncate">{item.source}</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-text-primary">{item.title}</h3>
          {item.body && <p className="mt-1 text-xs leading-5 text-text-secondary">{item.body}</p>}
        </article>
      ))}
    </div>
  )
}

export function StatusAggregateDrawerContent() {
  const [status, setStatus] = useState<StatusAggregate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useStatusAggregateEffect(setStatus, setError)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted" data-r8b-drawer-lazy-content="statusbar.aggregate">
        <AlertIcon size={20} className="text-text-muted opacity-60" />
        <span>{error}</span>
      </div>
    )
  }
  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted" data-r8b-drawer-lazy-content="statusbar.aggregate">
        <MonitorIcon size={20} className="text-text-muted opacity-60" />
        <span>正在读取状态聚合。</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2" data-r8b-drawer-lazy-content="statusbar.aggregate">
      {status.badges.map(badge => (
        <span key={badge.id} className="inline-flex items-center whitespace-nowrap border-l-2 border-accent bg-surface-950 px-2 py-1 text-xs text-text-secondary radius-sm">
          <span className="uppercase tracking-wider text-text-muted">{badge.label}</span>
          <span className="ml-2 font-mono text-text-primary">{String(badge.value)}</span>
        </span>
      ))}
    </div>
  )
}

// A single unified row model so the manager can list every popout family — the
// in-app floating port cards, the BrowserWindow panel/detail/widget/toolbar
// popouts, and the drawer "morph" floating records — under one mental model with
// consistent focus / recall / close actions (R3.5).
type UnifiedPopoutKind = 'in-app-card' | 'browser-window' | 'morph-record'

interface UnifiedPopoutRow {
  key: string
  /** Stable suffix for action test ids (windowId for browser/morph, card id for cards). */
  testIdSuffix: string
  kind: UnifiedPopoutKind
  kindLabel: string
  title: string
  detail: string
  status: string
  /** Bring the popout to front. */
  onFocus?: () => void
  /** Recall the popout back into a drawer (BrowserWindow / morph records). */
  onRecall?: () => void
  /** Close / dismiss the popout. */
  onClose?: () => void
  busy: boolean
}

const UNIFIED_POPOUT_KIND_LABELS: Record<UnifiedPopoutKind, string> = {
  'in-app-card': '浮卡',
  'browser-window': '悬浮窗',
  'morph-record': '抽屉 morph'
}

export function PopoutManagerDrawerContent() {
  const [popouts, setPopouts] = useState<BrowserPopout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const morphFromPopout = useDrawerStore(store => store.morphFromPopout)
  const portCards = usePortPopoutStore(store => store.popouts)
  const updatePortCards = usePortPopoutStore(store => store.updatePopouts)

  useBrowserPopoutsEffect(setPopouts, setError)

  const refreshBrowserPopouts = async () => {
    const next = await window.devhub?.r8?.popout?.list?.()
    setPopouts(next ?? [])
  }

  // BrowserWindow popouts (panel / detail / widget / toolbar) recall into a
  // drawer slot; the floating "morph" records do too. Re-creating a PANEL surface
  // focuses the existing window through the main-process (surface,targetId) dedup,
  // giving us a focus action without a dedicated IPC. This trick only holds for
  // panel surfaces: legacy `port`/`monitor` BrowserWindow popouts are NOT deduped
  // by createPopout, so re-creating them would spawn a DUPLICATE window. We
  // therefore gate the focus affordance to panel surfaces only (see canFocus
  // below) and keep this helper defensive.
  const focusBrowserPopout = async (popout: BrowserPopout) => {
    const bridge = window.devhub?.r8?.popout
    if (!bridge?.create) return
    if (!isPanelPopoutSurface(popout.surface)) return
    await bridge.create({
      surface: popout.surface,
      targetId: popout.targetId,
      mode: popout.mode,
      route: popout.route,
      title: popout.title
    })
  }

  const recallBrowserPopout = async (popout: BrowserPopout) => {
    const slot = drawerSlotForPopout(popout)
    setBusyId(popout.windowId)
    setError(null)
    try {
      const result = await morphFromPopout(popout.windowId, slot)
      if (!result) {
        setError(`无法将 popout ${popout.windowId} 收回 Drawer`)
        return
      }
      await refreshBrowserPopouts()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusyId(null)
    }
  }

  const closeBrowserPopout = async (popout: BrowserPopout) => {
    setBusyId(popout.windowId)
    setError(null)
    try {
      await window.devhub?.r8?.popout?.close?.(popout.windowId)
      await refreshBrowserPopouts()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusyId(null)
    }
  }

  const rows: UnifiedPopoutRow[] = [
    ...portCards.map<UnifiedPopoutRow>(card => ({
      key: `card:${card.id}`,
      testIdSuffix: card.id,
      kind: 'in-app-card',
      kindLabel: UNIFIED_POPOUT_KIND_LABELS['in-app-card'],
      title: `端口 ${card.port.port}`,
      detail: `pid ${card.port.pid}`,
      status: card.minimized ? '已最小化' : card.pinned ? '已固定' : '浮动',
      onClose: () => updatePortCards(previous => closePortPopout(previous, card.id)),
      busy: false
    })),
    ...popouts.filter(isActivePopout).map<UnifiedPopoutRow>(popout => {
      const isMorph = popout.mode === 'floating'
      // Focus only where re-create deduplicates (panel surfaces). Legacy
      // port/monitor BrowserWindow popouts have no focus IPC, so we omit the
      // action rather than spawn a duplicate window.
      const canFocus = !isMorph && isPanelPopoutSurface(popout.surface)
      return {
        key: `popout:${popout.windowId}`,
        testIdSuffix: popout.windowId,
        kind: isMorph ? 'morph-record' : 'browser-window',
        kindLabel: UNIFIED_POPOUT_KIND_LABELS[isMorph ? 'morph-record' : 'browser-window'],
        title: popout.title,
        detail: `${popout.surface} / ${String(popout.targetId)}`,
        status: popout.bridgeState,
        onFocus: canFocus ? () => { void focusBrowserPopout(popout) } : undefined,
        onRecall: () => { void recallBrowserPopout(popout) },
        onClose: isMorph ? undefined : () => { void closeBrowserPopout(popout) },
        busy: busyId === popout.windowId
      }
    })
  ]

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted" data-r8b-drawer-lazy-content="popout.manager">
        <AlertIcon size={20} className="text-text-muted opacity-60" />
        <span>{error}</span>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted" data-r8b-drawer-lazy-content="popout.manager">
        <PopoutIcon size={20} className="text-text-muted opacity-60" />
        <span>当前没有活动 popout。</span>
      </div>
    )
  }

  return (
    <div className="grid gap-2" data-r8b-drawer-lazy-content="popout.manager">
      {rows.map(row => (
        <article key={row.key} className="border-l-2 border-surface-600 bg-surface-950 p-3 radius-sm" data-r8c-popout-kind={row.kind}>
          <div className="flex min-w-0 items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
            <WindowIcon size={12} className="shrink-0 text-accent" />
            <span className="truncate">{row.kindLabel}</span>
            <span className="truncate">{row.status}</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-text-primary">{row.title}</h3>
          <p className="mt-1 break-all text-xs text-text-secondary">{row.detail}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.onFocus ? (
              <button
                type="button"
                className="whitespace-nowrap rounded border border-surface-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary hover:border-accent hover:text-accent disabled:opacity-60"
                data-testid={`popout-focus-${row.testIdSuffix}`}
                disabled={row.busy}
                onClick={row.onFocus}
              >
                聚焦
              </button>
            ) : null}
            {row.onRecall ? (
              <button
                type="button"
                className="whitespace-nowrap rounded border border-surface-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary hover:border-accent hover:text-accent disabled:opacity-60"
                data-testid={`popout-return-drawer-${row.testIdSuffix}`}
                disabled={row.busy}
                onClick={row.onRecall}
              >
                收回 Drawer
              </button>
            ) : null}
            {row.onClose ? (
              <button
                type="button"
                className="whitespace-nowrap rounded border border-surface-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary hover:border-warning hover:text-warning disabled:opacity-60"
                data-testid={`popout-close-${row.testIdSuffix}`}
                disabled={row.busy}
                onClick={row.onClose}
              >
                关闭
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

export function InjectWhitelistDrawerContent() {
  return <InjectWhitelistDrawer />
}

// Detail surfaces (port/process/window/ai-task) embed the full Monitor view
// (embedded-full-view pattern, same as panel popouts). The view re-fetches its
// own data through the IPC bridge and reuses the shared in-tab selection store,
// so the drawer mirrors whatever item is focused in the Monitor tab without any
// target-passing protocol or DrawerState schema change (ADR decision). An
// ErrorBoundary keeps a missing bridge from crashing the whole drawer host.
function DetailDrawerFrame({ contentId, children }: { contentId: string; children: React.ReactNode }) {
  return (
    <div className="h-full min-h-[16rem]" data-r8b-drawer-lazy-content={contentId}>
      <ErrorBoundary fallback={<div className="text-xs text-warning">详情视图当前不可用。</div>}>
        <Suspense fallback={<div className="text-xs text-text-muted">正在加载详情视图。</div>}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export function PortDetailDrawerContent() {
  return <DetailDrawerFrame contentId="monitor.port-detail"><PortView /></DetailDrawerFrame>
}

export function ProcessDetailDrawerContent() {
  return <DetailDrawerFrame contentId="monitor.process-detail"><ProcessView /></DetailDrawerFrame>
}

export function WindowDetailDrawerContent() {
  return <DetailDrawerFrame contentId="monitor.window-detail"><WindowView /></DetailDrawerFrame>
}

export function AITaskDetailDrawerContent() {
  return <DetailDrawerFrame contentId="ai-task.detail"><AITaskView /></DetailDrawerFrame>
}

// Embeds the real SettingsDialog (non-modal variant) so the right drawer and the
// status-bar "theme" tile both open the live 7-palette switcher. Closing simply
// closes the host drawer slot.
export function SettingsDrawerContent({ slot }: DrawerContentModuleProps) {
  const setOpen = useDrawerStore(store => store.setOpen)
  const closeDrawer = useCallback(() => {
    void setOpen(slot, false)
  }, [setOpen, slot])

  return (
    <div className="h-full" data-r8b-drawer-lazy-content="settings">
      <SettingsDialog embedded isOpen onClose={closeDrawer} />
    </div>
  )
}

// Embeds the lean inner ObservabilityPanel. It owns an independent obs snapshot +
// subscription (preload allows up to 3 local subscribers; App's DevObservability
// panel is the only other one) and tears the subscription down on unmount.
export function ObservabilityDrawerContent() {
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    const obs = window.devhub?.r8?.obs
    if (!obs?.getSnapshot) {
      setError('当前运行时未启用可观测数据。')
      return
    }

    void obs.getSnapshot()
      .then(next => {
        if (!disposed) {
          setSnapshot(next)
          setError(null)
        }
      })
      .catch(reason => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      })

    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = obs.subscribe?.((samples: ObservabilityMetricSample[]) => {
        if (disposed || samples.length === 0) return
        // Refresh the snapshot so charts reflect newly streamed samples.
        void obs.getSnapshot?.()
          .then(next => { if (!disposed) setSnapshot(next) })
          .catch(() => undefined)
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [])

  const exportObservation = useCallback((format: 'json' | 'csv') => {
    void window.devhub?.r8?.obs?.exportSnapshot?.({ format }).catch(() => undefined)
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted" data-r8b-drawer-lazy-content="observability">
        <MonitorIcon size={20} className="text-text-muted opacity-60" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div data-r8b-drawer-lazy-content="observability">
      <ObservabilityPanel
        snapshot={snapshot}
        subscribe={() => () => undefined}
        onExportCsv={() => exportObservation('csv')}
        onExportJson={() => exportObservation('json')}
      />
    </div>
  )
}

// Project logs keyed off the globally selected project (App's projectStore).
export function LogsDrawerContent() {
  const selectedProjectId = useProjectStore(state => state.selectedProjectId)
  const projects = useProjectStore(state => state.projects)
  const project = projects.find(item => item.id === selectedProjectId)

  if (!selectedProjectId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted" data-r8b-drawer-lazy-content="logs">
        <LogIcon size={20} className="text-text-muted opacity-60" />
        <span>请选择一个项目以查看其日志。</span>
      </div>
    )
  }

  return (
    <div className="h-full min-h-[12rem]" data-r8b-drawer-lazy-content="logs">
      <LogPanel projectId={selectedProjectId} projectName={project?.name ?? selectedProjectId} />
    </div>
  )
}

// Live AI CLI / task runner output stream (r8.cli.onEvent + getProgress seed).
export function TerminalDrawerContent() {
  const [events, setEvents] = useState<CliOutputEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let disposed = false
    const cli = window.devhub?.r8?.cli
    if (!cli) {
      setError('当前运行时未提供 CLI / 任务输出流。')
      return
    }

    void cli.getProgress?.({ limit: 50 })
      .then(progress => {
        if (!disposed && progress?.events) {
          setEvents(progress.events.slice(-50))
          setError(null)
        }
      })
      .catch(reason => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      })

    const unsubscribe = cli.onEvent?.((event: CliOutputEvent) => {
      if (disposed) return
      setEvents(current => [...current, event].slice(-200))
    })

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [events])

  return (
    <div className="flex h-full min-h-[12rem] flex-col" data-r8b-drawer-lazy-content="terminal">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
        <TerminalIcon size={15} className="shrink-0 text-accent" />
        <span className="truncate">终端 / 任务输出</span>
      </div>
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted">
          <AlertIcon size={20} className="text-text-muted opacity-60" />
          <span>{error}</span>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-xs text-text-muted">
          <TerminalIcon size={20} className="text-text-muted opacity-60" />
          <span>暂无任务或 CLI 输出。</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="mt-2 flex-1 overflow-y-auto font-mono text-mono leading-relaxed"
        >
          {events.map((event, index) => (
            <div key={`${event.observedAt}-${index}`} className="flex gap-2 break-all">
              <span className="shrink-0 uppercase text-text-muted">{event.tool}</span>
              <span className={event.stream === 'stderr' ? 'text-error' : 'text-text-secondary'}>{event.line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// App identity / version banner. Reads system.getVersion (degrades to 'unknown').
export function VersionBannerDrawerContent() {
  const [info, setInfo] = useState<AppVersionInfo | null>(null)

  useEffect(() => {
    let disposed = false
    const getVersion = window.devhub?.system?.getVersion
    if (!getVersion) {
      setInfo({ name: 'DevHub', version: 'unknown', electron: 'unknown' })
      return
    }
    void getVersion()
      .then(next => { if (!disposed) setInfo(next) })
      .catch(() => { if (!disposed) setInfo({ name: 'DevHub', version: 'unknown', electron: 'unknown' }) })
    return () => { disposed = true }
  }, [])

  return (
    <div className="border-l-2 border-accent/70 bg-surface-950 p-3 radius-sm" data-r8b-drawer-lazy-content="system.version-banner">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
        <PackageIcon size={15} className="shrink-0 text-accent" />
        <span className="truncate">{info?.name ?? 'DevHub'}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-text-secondary">
        版本 <span className="font-mono text-text-primary">{info?.version ?? '...'}</span>
        {info?.electron ? <> · Electron <span className="font-mono text-text-primary">{info.electron}</span></> : null}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-text-muted">当前已安装版本</p>
    </div>
  )
}

// Neutral fallback for any contentId without a dedicated renderer yet (e.g. the
// detail drawers landing in a later PR, or an unknown id). Intentionally avoids
// dev-time placeholder phrasing while still being honest that no view is bound.
export function RegisteredBoundaryDrawerContent({ slot, contentId, definition }: DrawerContentModuleProps) {
  return (
    <div
      className="border-l-2 border-surface-600 bg-surface-950 p-3 radius-sm"
      data-r8b-drawer-content-status="registered-boundary"
      data-r8b-drawer-lazy-content={contentId ?? 'registered-boundary'}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
        <InfoIcon size={15} className="shrink-0 text-text-muted" />
        <span className="truncate">{definition?.title ?? contentId}</span>
      </div>
      <p className="mt-2 break-words text-xs leading-5 text-text-secondary">
        该内容暂不可用。
      </p>
      <div className="mt-3 text-[10px] uppercase tracking-wider text-text-muted">slot: {slot}</div>
    </div>
  )
}

function useNotificationsEffect(
  setItems: Dispatch<SetStateAction<NotificationLike[]>>,
  setError: Dispatch<SetStateAction<string | null>>
) {
  useEffect(() => {
    let disposed = false

    const refresh = () => {
      const list = window.devhub?.r8?.notify?.list?.()
      if (!list) return
      void list
        .then(notifications => {
          if (!disposed) {
            setItems(notifications.map(normalizeNotification).filter((item): item is NotificationLike => item !== null))
            setError(null)
          }
        })
        .catch(reason => {
          if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
        })
    }

    // Initial fetch of the canonical notification list.
    refresh()

    // Re-fetch the canonical list on BOTH the toast stream and the statusbar
    // stream. The statusbar tile count is driven by the statusbar channel
    // (delivered for every notification at/above its min level), whereas
    // `notify:stream` only fires for the toast channel and is throttled — so a
    // notification could bump the tile count without ever firing onStream,
    // leaving the drawer stale ("count 1 but drawer empty"). Listening to both
    // keeps the drawer in lockstep with whatever the count reflects.
    const unsubscribeStream = window.devhub?.r8?.notify?.onStream?.(() => {
      if (!disposed) refresh()
    })
    const unsubscribeStatusbar = window.devhub?.r8?.notify?.onStatusbar?.(() => {
      if (!disposed) refresh()
    })

    return () => {
      disposed = true
      unsubscribeStream?.()
      unsubscribeStatusbar?.()
    }
  }, [setError, setItems])
}

function useStatusAggregateEffect(
  setStatus: Dispatch<SetStateAction<StatusAggregate | null>>,
  setError: Dispatch<SetStateAction<string | null>>
) {
  useEffect(() => {
    let disposed = false
    void window.devhub?.r8?.status?.aggregate?.()
      .then(nextStatus => {
        if (!disposed) {
          setStatus(nextStatus)
          setError(null)
        }
      })
      .catch(reason => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      disposed = true
    }
  }, [setError, setStatus])
}

function useBrowserPopoutsEffect(
  setPopouts: Dispatch<SetStateAction<BrowserPopout[]>>,
  setError: Dispatch<SetStateAction<string | null>>
) {
  useEffect(() => {
    let disposed = false
    void window.devhub?.r8?.popout?.list?.()
      .then(nextPopouts => {
        if (!disposed) {
          setPopouts(nextPopouts)
          setError(null)
        }
      })
      .catch(reason => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      disposed = true
    }
  }, [setError, setPopouts])
}

function isActivePopout(popout: BrowserPopout): boolean {
  return popout.bridgeState !== 'closed'
}

function drawerSlotForPopout(popout: BrowserPopout): DrawerSlot {
  if (popout.surface === 'monitor') return 'bottom'
  // A morphed-drawer popout encodes its content as `contentId:<id>`; recall it to
  // the content's home slot (e.g. notifications.top -> top) instead of defaulting
  // to the right slot.
  if (popout.surface === 'drawer') {
    const rawTarget = String(popout.targetId)
    const contentId = rawTarget.startsWith('contentId:') ? rawTarget.slice('contentId:'.length) : rawTarget
    return getDrawerContentDefinition(contentId)?.defaultSlot ?? 'right'
  }
  return 'right'
}
