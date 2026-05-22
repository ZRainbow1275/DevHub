import { useCallback, useEffect, useState } from 'react'
import type { DevhubNotification, NotificationLevel } from '@shared/schemas/notification'
import { AlertIcon, BellIcon, CloseIcon, InfoIcon, LightningIcon } from '../icons'

function levelIcon(level: NotificationLevel) {
  if (level === 'FATAL') return <LightningIcon size={16} className="text-error" />
  if (level === 'ERROR') return <CloseIcon size={16} className="text-error" />
  if (level === 'WARN') return <AlertIcon size={16} className="text-warning" />
  return <InfoIcon size={16} className="text-info" />
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<DevhubNotification[]>([])

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

  const dismiss = (id: string) => {
    setNotifications(current => current.filter(item => item.id !== id))
    void window.devhub?.r8?.notify?.dismiss?.(id).catch(() => undefined)
  }

  return (
    <aside className="fixed bottom-11 left-4 z-[55]">
      <button
        aria-label="Open notification center"
        className="flex items-center gap-2 border-2 border-surface-700 bg-surface-900 px-3 py-2 text-xs uppercase tracking-wide text-text-secondary hover:border-accent hover:text-accent radius-sm"
        onClick={() => setOpen(value => !value)}
      >
        <BellIcon size={16} />
        Notifications
        {notifications.length > 0 && <span className="bg-accent px-1.5 py-0.5 text-[10px] font-bold text-surface-950 radius-sm">{notifications.length}</span>}
      </button>
      {open && (
        <div className="mt-2 w-[420px] max-w-[calc(100vw-2rem)] border-2 border-surface-700 bg-surface-900 shadow-elevated radius-sm">
          <header className="flex items-center justify-between border-b border-surface-700 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-primary">Notification Center</h2>
            <button className="text-text-muted hover:text-text-primary" onClick={() => setOpen(false)} aria-label="Close notification center">
              <CloseIcon size={14} />
            </button>
          </header>
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-text-muted">No active notifications</div>
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
                            className="border border-surface-600 px-2 py-1 text-[10px] text-text-secondary hover:border-accent hover:text-accent radius-sm"
                            onClick={() => { void window.devhub?.r8?.notify?.invokeAction?.({ id: notification.id, actionId: action.actionId }) }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="text-text-muted hover:text-text-primary" onClick={() => dismiss(notification.id)} aria-label="Dismiss notification">
                    <CloseIcon size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
