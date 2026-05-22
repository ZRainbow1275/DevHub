import { useEffect, useState } from 'react'
import type { MisreportKind, TaskState } from '@shared/schemas/r8-runtime'
import { AlertIcon } from '../../components/icons'

interface MisreportButtonProps {
  ariaLabel?: string
  armedLabel?: string
  idleLabel?: string
  instanceId: string
  kind?: MisreportKind
  expectedTaskState?: TaskState
  successMessage?: string
  title?: string
  userNote?: string
  onReported?: (id: string) => void
}

export function MisreportButton({
  ariaLabel = '标记误报',
  armedLabel = '确认误报',
  idleLabel = '误报',
  instanceId,
  kind = 'false-idle',
  expectedTaskState = 'running',
  successMessage = '误报已记录',
  title = '标记当前 AI 状态为误报',
  userNote,
  onReported
}: MisreportButtonProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [armed, setArmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (remainingSeconds <= 0) return undefined
    const timer = window.setTimeout(() => {
      setRemainingSeconds(value => {
        const next = value - 1
        if (next <= 0) setArmed(true)
        return Math.max(0, next)
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [remainingSeconds])

  async function submit() {
    if (!armed) {
      setMessage(null)
      setRemainingSeconds(3)
      return
    }
    const bridge = window.devhub?.r8?.ai
    if (!bridge?.reportMisreport) {
      setMessage('反馈通道不可用')
      return
    }
    setSubmitting(true)
    try {
      const result = await bridge.reportMisreport({
        instanceId,
        kind,
        expectedTaskState,
        userNote,
        reportedBy: 'self',
        confirmedBy: 'misreport-button'
      })
      setMessage(successMessage)
      onReported?.(result.id)
      setArmed(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '误报提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const label = submitting
    ? '提交中'
    : remainingSeconds > 0
      ? `确认 ${remainingSeconds}s`
      : armed
        ? armedLabel
        : idleLabel

  return (
    <div className="flex items-center gap-2" onClick={event => event.stopPropagation()}>
      <button
        type="button"
        onClick={submit}
        disabled={submitting || remainingSeconds > 0}
        className="btn-icon-sm bg-warning/10 text-warning/80 hover:bg-warning hover:text-surface-950 disabled:opacity-60 disabled:cursor-not-allowed"
        title={title}
        aria-label={ariaLabel}
      >
        <AlertIcon size={14} />
      </button>
      <span className="text-[10px] text-text-muted font-mono">{label}</span>
      {message && <span className="text-[10px] text-text-muted">{message}</span>}
    </div>
  )
}
