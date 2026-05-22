import { useEffect, useState } from 'react'
import type { InjectFirstTimeRequiredPayload, InjectWhitelistDuration, InjectWhitelistScope } from '@shared/schemas/inject'
import { AlertIcon, CheckIcon, CloseIcon, TerminalIcon } from '../icons'
import { dispatchInjectWhitelistChanged } from './inject-events'

interface InjectFirstTimeModalProps {
  payload: InjectFirstTimeRequiredPayload
  onClose: () => void
  onConfirmed?: () => void
}

const CONFIRMED_BY = 'inject-first-time-modal'
const DURATION_OPTIONS: Array<{ value: InjectWhitelistDuration; label: string; description: string }> = [
  { value: 'session', label: '本次会话', description: '仅当前 DevHub 进程有效' },
  { value: '24h', label: '24 小时', description: '适合一次性批处理' },
  { value: '7d', label: '7 天', description: '适合短期项目冲刺' },
  { value: 'permanent', label: '永久', description: '仅用于稳定可信实例' }
]
const SCOPE_OPTIONS: Array<{ value: InjectWhitelistScope; label: string; description: string }> = [
  { value: 'instance', label: '实例', description: '只允许当前 alias' },
  { value: 'tool', label: '工具', description: '允许同类工具实例' },
  { value: 'project-cwd', label: '项目', description: '允许当前 cwd 及子路径' }
]

export function InjectFirstTimeModal({ payload, onClose, onConfirmed }: InjectFirstTimeModalProps) {
  const [duration, setDuration] = useState<InjectWhitelistDuration>('24h')
  const [scope, setScope] = useState<InjectWhitelistScope>('instance')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await window.devhub?.r8?.inject?.confirmFirstTime?.({
        requestId: payload.requestId,
        selector: payload.selector,
        aliasOrId: payload.aliasOrId,
        pid: payload.pid ?? undefined,
        hwnd: payload.hwnd ?? undefined,
        cwd: payload.cwd ?? undefined,
        taskId: payload.taskId ?? undefined,
        scenario: payload.scenario,
        scope,
        duration,
        confirmedBy: CONFIRMED_BY,
        reason: 'first-time-confirm-modal'
      })
      dispatchInjectWhitelistChanged(CONFIRMED_BY)
      onConfirmed?.()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[121] flex items-center justify-center bg-black/70 px-4 animate-fade-in" data-testid="inject-first-time-modal">
      <section
        aria-labelledby="inject-first-time-title"
        aria-modal="true"
        className="relative w-full max-w-2xl border-2 border-warning/70 bg-surface-900 shadow-elevated radius-md"
        role="dialog"
      >
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />
        <div className="relative z-10 flex items-center gap-3 border-b-2 border-surface-700 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center border-l-3 border-warning bg-warning/15 radius-sm">
            <AlertIcon size={20} className="text-warning" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
              <TerminalIcon size={12} />
              首次注入确认
            </div>
            <h2
              className="text-gold font-bold uppercase tracking-wider"
              id="inject-first-time-title"
              style={{ fontFamily: 'var(--font-display)', fontSize: '14px', transform: 'rotate(-1deg)', transformOrigin: 'left center' }}
            >
              允许此目标接收注入
            </h2>
          </div>
        </div>

        <div className="relative z-10 space-y-5 p-6">
          <div className="grid gap-2 border-l-3 border-warning bg-surface-950 p-3 text-sm radius-sm">
            <div className="flex justify-between gap-3">
              <span className="text-text-muted">Target</span>
              <span className="max-w-[360px] truncate font-mono text-text-primary">{payload.targetAlias}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-text-muted">Scenario</span>
              <span className="font-mono text-text-primary">{payload.scenario}</span>
            </div>
            {payload.reason && <div className="text-xs leading-5 text-warning">{payload.reason}</div>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">授权时长</legend>
              {DURATION_OPTIONS.map(option => (
                <label key={option.value} className="flex gap-2 border border-surface-800 bg-surface-950 p-2 text-xs radius-sm">
                  <input
                    checked={duration === option.value}
                    data-testid={`inject-first-time-duration-${option.value}`}
                    name="inject-first-time-duration"
                    onChange={() => setDuration(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span>
                    <span className="block font-semibold text-text-primary">{option.label}</span>
                    <span className="block text-text-muted">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">授权范围</legend>
              {SCOPE_OPTIONS.map(option => (
                <label key={option.value} className="flex gap-2 border border-surface-800 bg-surface-950 p-2 text-xs radius-sm">
                  <input
                    checked={scope === option.value}
                    data-testid={`inject-first-time-scope-${option.value}`}
                    name="inject-first-time-scope"
                    onChange={() => setScope(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span>
                    <span className="block font-semibold text-text-primary">{option.label}</span>
                    <span className="block text-text-muted">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>

          {error && <div className="border border-warning/50 bg-warning/10 p-2 text-xs text-warning radius-sm" data-testid="inject-first-time-error">{error}</div>}
        </div>

        <div className="relative z-10 flex justify-end gap-3 border-t-2 border-surface-700 px-6 py-4">
          <button
            className="flex items-center gap-2 px-4 py-2.5 font-medium text-text-secondary transition-colors hover:bg-surface-800 disabled:opacity-60 radius-sm"
            data-testid="inject-first-time-cancel"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <CloseIcon size={14} />
            取消
          </button>
          <button
            className="flex items-center gap-2 border-l-2 border-warning bg-warning px-4 py-2.5 font-medium text-surface-950 transition-all duration-200 hover:bg-amber-400 disabled:opacity-60 radius-sm"
            data-testid="inject-first-time-confirm"
            disabled={busy}
            onClick={() => { void confirm() }}
            type="button"
          >
            <CheckIcon size={14} />
            写入白名单
          </button>
        </div>
      </section>
    </div>
  )
}

export function InjectFirstTimeHost() {
  const [payload, setPayload] = useState<InjectFirstTimeRequiredPayload | null>(null)

  useEffect(() => {
    const unsubscribe = window.devhub?.r8?.inject?.onFirstTimeRequired?.((nextPayload) => {
      setPayload(nextPayload)
    })
    return unsubscribe
  }, [])

  if (!payload) return null

  return (
    <InjectFirstTimeModal
      payload={payload}
      onClose={() => setPayload(null)}
      onConfirmed={() => setPayload(null)}
    />
  )
}
