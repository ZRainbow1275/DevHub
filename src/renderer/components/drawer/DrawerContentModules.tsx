import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { BrowserPopout, DrawerSlot, StatusAggregate } from '@shared/schemas/r8-runtime'
import { AlertIcon, BellIcon, InfoIcon, TerminalIcon, WindowIcon } from '../icons'
import {
  DRAWER_CONTENT_REGISTRY,
  type DrawerContentDefinition
} from './drawer-model'
import { useDrawerStore } from '../../stores/drawerStore'
import { InjectWhitelistDrawer } from '../inject/InjectWhitelistDrawer'

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
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <InfoIcon size={15} className="text-accent" />
        Drawer 内容注册表
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

  if (error) return <div className="text-xs text-warning">{error}</div>
  if (items.length === 0) return <div className="text-xs text-text-muted" data-r8b-drawer-lazy-content="notifications.top">当前没有活动通知。</div>

  return (
    <div className="grid gap-2" data-r8b-drawer-lazy-content="notifications.top">
      {items.map(item => (
        <article key={item.id} className="border-l-2 border-accent/70 bg-surface-950 p-3 radius-sm">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
            <BellIcon size={12} className="text-accent" />
            <span>{item.level}</span>
            <span>{item.source}</span>
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

  if (error) return <div className="text-xs text-warning">{error}</div>
  if (!status) return <div className="text-xs text-text-muted" data-r8b-drawer-lazy-content="statusbar.aggregate">正在读取状态聚合。</div>

  return (
    <div className="flex flex-wrap gap-2" data-r8b-drawer-lazy-content="statusbar.aggregate">
      {status.badges.map(badge => (
        <span key={badge.id} className="border-l-2 border-accent bg-surface-950 px-2 py-1 text-xs text-text-secondary radius-sm">
          <span className="uppercase tracking-wider text-text-muted">{badge.label}</span>
          <span className="ml-2 font-mono text-text-primary">{String(badge.value)}</span>
        </span>
      ))}
    </div>
  )
}

export function PopoutManagerDrawerContent() {
  const [popouts, setPopouts] = useState<BrowserPopout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [returningId, setReturningId] = useState<string | null>(null)
  const morphFromPopout = useDrawerStore(store => store.morphFromPopout)

  useBrowserPopoutsEffect(setPopouts, setError)

  const activePopouts = popouts.filter(isActivePopout)

  if (error) return <div className="text-xs text-warning">{error}</div>
  if (activePopouts.length === 0) return <div className="text-xs text-text-muted" data-r8b-drawer-lazy-content="popout.manager">当前没有活动 popout。</div>

  const returnToDrawer = async (popout: BrowserPopout) => {
    const slot = drawerSlotForPopout(popout)
    setReturningId(popout.windowId)
    setError(null)
    try {
      const result = await morphFromPopout(popout.windowId, slot)
      if (!result) {
        setError(`无法将 popout ${popout.windowId} 收回 Drawer`)
        return
      }
      const nextPopouts = await window.devhub?.r8?.popout?.list?.()
      setPopouts(nextPopouts ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setReturningId(null)
    }
  }

  return (
    <div className="grid gap-2" data-r8b-drawer-lazy-content="popout.manager">
      {activePopouts.map(popout => (
        <article key={popout.windowId} className="border-l-2 border-surface-600 bg-surface-950 p-3 radius-sm">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
            <WindowIcon size={12} className="text-accent" />
            <span>{popout.mode}</span>
            <span>{popout.bridgeState}</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-text-primary">{popout.title}</h3>
          <p className="mt-1 text-xs text-text-secondary">{popout.surface} / {String(popout.targetId)}</p>
          <button
            type="button"
            className="mt-3 rounded border border-surface-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary hover:border-accent hover:text-accent disabled:opacity-60"
            data-testid={`popout-return-drawer-${popout.windowId}`}
            disabled={returningId === popout.windowId}
            onClick={() => { void returnToDrawer(popout) }}
          >
            收回 Drawer
          </button>
        </article>
      ))}
    </div>
  )
}

export function InjectWhitelistDrawerContent() {
  return <InjectWhitelistDrawer />
}

export function TerminalLikeDrawerContent({ contentId, definition }: DrawerContentModuleProps) {
  return (
    <div className="border-l-2 border-accent/70 bg-surface-950 p-3 radius-sm" data-r8b-drawer-lazy-content={contentId ?? 'terminal-like'}>
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <TerminalIcon size={15} className="text-accent" />
        {definition?.title ?? contentId}
      </div>
      <p className="mt-2 text-xs leading-5 text-text-secondary">
        该内容源复用现有项目日志和任务输出面板；当前 Drawer slice 已完成槽位、尺寸、持久化与 IPC 链路，具体日志嵌入保留给下游内容规格。
      </p>
    </div>
  )
}

export function RegisteredBoundaryDrawerContent({ slot, contentId, definition }: DrawerContentModuleProps) {
  return (
    <div
      className="border-l-2 border-warning/70 bg-surface-950 p-3 radius-sm"
      data-r8b-drawer-content-status="registered-boundary"
      data-r8b-drawer-lazy-content={contentId ?? 'registered-boundary'}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <AlertIcon size={15} className="text-warning" />
        {definition?.title ?? contentId}
      </div>
      <p className="mt-2 text-xs leading-5 text-text-secondary">
        内容 ID 已注册到 R8 Drawer registry，但当前构建尚未暴露该内容源的专用渲染器。该状态不会生成模拟数据。
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
    void window.devhub?.r8?.notify?.list?.()
      .then(notifications => {
        if (!disposed) {
          setItems(notifications.map(normalizeNotification).filter((item): item is NotificationLike => item !== null))
          setError(null)
        }
      })
      .catch(reason => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      disposed = true
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
  return 'right'
}
