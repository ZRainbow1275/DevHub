import { useEffect, useRef, useState } from 'react'
import type { DevhubNotification, NotificationLevel } from '@shared/schemas/notification'
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon, LightningIcon } from '../icons'

const MAX_TOASTS = 5

function levelClass(level: NotificationLevel): string {
  if (level === 'FATAL') return 'border-l-error bg-error/10 text-error'
  if (level === 'ERROR') return 'border-l-error bg-surface-900 text-text-primary'
  if (level === 'WARN') return 'border-l-warning bg-surface-900 text-text-primary'
  return 'border-l-info bg-surface-900 text-text-primary'
}

function levelIcon(level: NotificationLevel) {
  if (level === 'FATAL') return <LightningIcon size={18} className="text-error" />
  if (level === 'ERROR') return <CloseIcon size={18} className="text-error" />
  if (level === 'WARN') return <AlertIcon size={18} className="text-warning" />
  return <InfoIcon size={18} className="text-info" />
}

function playDesktopBell(): void {
  const AudioContextCtor = window.AudioContext
  if (!AudioContextCtor) return
  const context = new AudioContextCtor()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'square'
  oscillator.frequency.value = 880
  gain.gain.value = 0.04
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.16)
  oscillator.addEventListener('ended', () => { void context.close() })
}

export function ToastHost() {
  const [toasts, setToasts] = useState<DevhubNotification[]>([])
  const timers = useRef<Set<number>>(new Set())

  useEffect(() => {
    const timerSet = timers.current
    const unsubscribeStream = window.devhub?.r8?.notify?.onStream?.((notification) => {
      setToasts(current => [notification, ...current.filter(item => item.id !== notification.id)].slice(0, MAX_TOASTS))
      const timer = window.setTimeout(() => {
        setToasts(current => current.filter(item => item.id !== notification.id))
        timerSet.delete(timer)
      }, notification.level === 'FATAL' ? 10000 : 6000)
      timerSet.add(timer)
    })
    const unsubscribeBell = window.devhub?.r8?.notify?.onDesktopBell?.(() => playDesktopBell())
    return () => {
      unsubscribeStream?.()
      unsubscribeBell?.()
      timerSet.forEach(timer => window.clearTimeout(timer))
      timerSet.clear()
    }
  }, [])

  const dismiss = (id: string) => {
    setToasts(current => current.filter(item => item.id !== id))
    void window.devhub?.r8?.notify?.dismiss?.(id).catch(() => undefined)
  }

  if (toasts.length === 0) return null

  return (
    <section aria-label="R8 notifications" className="fixed bottom-12 right-6 z-[60] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {toasts.map((toast) => (
        <article key={toast.id} className={`relative overflow-hidden border-2 border-surface-600 border-l-4 shadow-elevated radius-sm ${levelClass(toast.level)}`}>
          <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />
          <div className="relative z-10 flex gap-3 px-4 py-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center border-l-2 border-current bg-surface-800 radius-sm">
              {levelIcon(toast.level)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{toast.level}</span>
                {toast.occurrenceCount > 1 && <span className="text-[10px] text-warning">{toast.occurrenceCount} occurrences</span>}
              </div>
              <h3 className="truncate text-sm font-semibold text-text-primary">{toast.title}</h3>
              {toast.body && <p className="mt-1 line-clamp-3 text-xs leading-5 text-text-secondary">{toast.body}</p>}
              {toast.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {toast.actions.map(action => (
                    <button
                      key={action.actionId}
                      className="border border-surface-500 px-2 py-1 text-[10px] uppercase tracking-wide text-text-secondary hover:border-accent hover:text-accent radius-sm"
                      onClick={() => { void window.devhub?.r8?.notify?.invokeAction?.({ id: toast.id, actionId: action.actionId }) }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button aria-label="Dismiss notification" className="h-7 w-7 text-text-muted hover:text-text-primary" onClick={() => dismiss(toast.id)}>
              <CheckIcon size={16} />
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}
