import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DevhubNotification, NotificationLevel } from '@shared/schemas/notification'
import { useT } from '../../hooks/useT'
import { AlertIcon, BellIcon, CloseIcon, InfoIcon, LightningIcon } from '../icons'

function levelIcon(level: NotificationLevel) {
  if (level === 'FATAL') return <LightningIcon size={16} className="text-error" />
  if (level === 'ERROR') return <CloseIcon size={16} className="text-error" />
  if (level === 'WARN') return <AlertIcon size={16} className="text-warning" />
  return <InfoIcon size={16} className="text-info" />
}

export function NotificationCenter() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<DevhubNotification[]>([])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(() => {
    void window.devhub?.r8?.notify?.list?.()
      .then(items => setNotifications(items))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribeStream = window.devhub?.r8?.notify?.onStream?.((notification) => {
      setNotifications(current => [notification, ...current.filter(item => item.id !== notification.id)].slice(0, 100))
    })
    const unsubscribeStatusbar = window.devhub?.r8?.notify?.onStatusbar?.((notification) => {
      setNotifications(current => [notification, ...current.filter(item => item.id !== notification.id)].slice(0, 100))
    })
    return () => {
      unsubscribeStream?.()
      unsubscribeStatusbar?.()
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const dismiss = (id: string) => {
    setNotifications(current => current.filter(item => item.id !== id))
    void window.devhub?.r8?.notify?.dismiss?.(id).catch(() => undefined)
  }

  const count = notifications.length

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title="通知中心"
        aria-label="通知中心"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-9 w-9 items-center justify-center text-text-tertiary hover:bg-surface-800 hover:text-text-primary transition-colors no-drag"
        onClick={() => setOpen(value => !value)}
      >
        <BellIcon size={14} />
        {count > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 inline-flex items-center justify-center bg-accent text-surface-950 text-[9px] font-bold leading-none radius-sm"
            aria-hidden="true"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
        <span className="sr-only">{count > 0 ? `${count} ${t('notify.center.countAria', 'notifications')}` : t('notify.center.empty', 'No notifications')}</span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('notify.center.title', 'Notification Center')}
          className="fixed right-4 top-10 z-[60] w-[420px] max-w-[calc(100vw-2rem)] border-2 border-surface-700 bg-surface-900 shadow-elevated radius-sm"
        >
          <header className="flex items-center justify-between border-b border-surface-700 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-primary">{t('notify.center.title', 'Notification Center')}</h2>
            <button
              type="button"
              className="text-text-muted hover:text-text-primary"
              onClick={() => setOpen(false)}
              aria-label={t('notify.center.close', 'Close notification center')}
            >
              <CloseIcon size={14} />
            </button>
          </header>
          <div className="max-h-[360px] overflow-y-auto">
            {count === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-text-muted">{t('notify.center.emptyActive', 'No active notifications')}</div>
            ) : notifications.map(notification => (
              <article key={notification.id} className="border-b border-surface-800 px-4 py-3 last:border-b-0">
                <div className="flex gap-3">
                  <div className="mt-1">{levelIcon(notification.level)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-text-muted">
                      <span>{notification.level}</span>
                      <span>{notification.source}</span>
                    </div>
                    <h3 className="truncate text-sm font-semibold text-text-primary">{notification.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{notification.body}</p>
                    {notification.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {notification.actions.map(action => (
                          <button
                            key={action.actionId}
                            type="button"
                            className="border border-surface-600 px-2 py-1 text-[10px] text-text-secondary hover:border-accent hover:text-accent radius-sm"
                            onClick={() => { void window.devhub?.r8?.notify?.invokeAction?.({ id: notification.id, actionId: action.actionId }) }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-text-muted hover:text-text-primary"
                    onClick={() => dismiss(notification.id)}
                    aria-label={t('notify.dismiss', 'Dismiss notification')}
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
