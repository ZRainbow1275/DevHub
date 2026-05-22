import { useEffect, useMemo, useState } from 'react'
import type { InjectCountdownStreamPayload } from '@shared/schemas/inject'
import { AlertIcon, CheckIcon, CloseIcon, TerminalIcon } from '../icons'

interface InjectCountdownModalProps {
  busy?: boolean
  payload: InjectCountdownStreamPayload
  onCancel: () => void
  onInjectNow: () => void
}

const CONFIRMED_BY = 'inject-countdown-modal'

export function InjectCountdownModal({ busy = false, payload, onCancel, onInjectNow }: InjectCountdownModalProps) {
  const progressPercent = payload.totalMs <= 0
    ? 100
    : Math.max(0, Math.min(100, Math.round(((payload.totalMs - payload.remainingMs) / payload.totalMs) * 100)))

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && payload.canCancel) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, payload.canCancel])

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 animate-fade-in" data-testid="inject-countdown-modal">
      <section
        aria-labelledby="inject-countdown-title"
        aria-modal="true"
        className="relative w-full max-w-lg border-2 border-warning/70 bg-surface-900 shadow-elevated radius-md"
        role="dialog"
      >
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />
        <div className="relative z-10 flex items-center gap-3 border-b-2 border-surface-700 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center border-l-3 border-warning bg-warning/15 radius-sm">
            <TerminalIcon size={20} className="text-warning" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
              <AlertIcon size={12} />
              注入安全倒计时
            </div>
            <h2
              className="text-gold font-bold uppercase tracking-wider"
              id="inject-countdown-title"
              style={{ fontFamily: 'var(--font-display)', fontSize: '14px', transform: 'rotate(-1deg)', transformOrigin: 'left center' }}
            >
              等待确认窗口
            </h2>
          </div>
        </div>

        <div className="relative z-10 space-y-4 p-6">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-muted">Target</span>
              <span className="max-w-[260px] truncate font-mono text-text-primary">{payload.targetAlias}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-muted">Scenario</span>
              <span className="font-mono text-text-primary">{payload.scenario}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-muted">Remaining</span>
              <span className="font-mono text-warning" data-testid="inject-countdown-remaining">{payload.remainingMs}ms</span>
            </div>
          </div>

          <div className="h-2 overflow-hidden border border-surface-700 bg-surface-950 radius-sm" aria-label="注入倒计时进度">
            <div className="h-full bg-warning transition-[width] duration-100" data-testid="inject-countdown-progress" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="relative z-10 flex justify-end gap-3 border-t-2 border-surface-700 px-6 py-4">
          <button
            className="flex items-center gap-2 px-4 py-2.5 font-medium text-text-secondary transition-colors hover:bg-surface-800 disabled:opacity-60 radius-sm"
            data-testid="inject-countdown-cancel"
            disabled={busy || !payload.canCancel}
            onClick={onCancel}
            type="button"
          >
            <CloseIcon size={14} />
            取消
          </button>
          <button
            className="flex items-center gap-2 border-l-2 border-accent bg-accent px-4 py-2.5 font-medium text-white transition-all duration-200 hover:bg-accent-600 disabled:opacity-60 radius-sm"
            data-testid="inject-countdown-now"
            disabled={busy}
            onClick={onInjectNow}
            type="button"
          >
            <CheckIcon size={14} />
            立即注入
          </button>
        </div>
      </section>
    </div>
  )
}

export function InjectCountdownHost() {
  const [payload, setPayload] = useState<InjectCountdownStreamPayload | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = window.devhub?.r8?.inject?.onCountdownStream?.((nextPayload) => {
      if (nextPayload.phase === 'completed' || nextPayload.phase === 'cancelled') {
        setPayload(null)
        return
      }
      setPayload(nextPayload)
    })
    return unsubscribe
  }, [])

  const busy = useMemo(() => Boolean(payload && busyAction === payload.actionId), [busyAction, payload])

  if (!payload) return null

  const cancel = async () => {
    if (!payload.canCancel) return
    setBusyAction(payload.actionId)
    try {
      await window.devhub?.r8?.inject?.cancelCountdown?.(payload.actionId, CONFIRMED_BY)
    } finally {
      setBusyAction(null)
    }
  }

  const injectNow = async () => {
    setBusyAction(payload.actionId)
    try {
      await window.devhub?.r8?.inject?.completeCountdown?.(payload.actionId, CONFIRMED_BY)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <InjectCountdownModal
      busy={busy}
      payload={payload}
      onCancel={() => { void cancel() }}
      onInjectNow={() => { void injectNow() }}
    />
  )
}
