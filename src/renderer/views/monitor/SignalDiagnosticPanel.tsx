import { useState } from 'react'
import type { DiagnosticExplain, MisreportKind, TaskState } from '@shared/schemas/r8-runtime'
import { InfoIcon } from '../../components/icons'
import { MisreportButton } from './MisreportButton'

interface SignalDiagnosticPanelProps {
  instanceId: string
  initiallyOpen?: boolean
}

function incorrectKindForState(state: TaskState): MisreportKind {
  if (state === 'idle') return 'false-idle'
  if (state === 'thinking' || state === 'running' || state === 'awaiting-input') return 'false-thinking'
  if (state === 'completed') return 'false-completion'
  if (state === 'error') return 'false-error'
  return 'false-progress'
}

function expectedStateForIncorrect(state: TaskState): TaskState {
  if (state === 'idle') return 'running'
  if (state === 'completed' || state === 'error') return 'running'
  return 'idle'
}

export function SignalDiagnosticPanel({ instanceId, initiallyOpen = false }: SignalDiagnosticPanelProps) {
  const [open, setOpen] = useState(initiallyOpen)
  const [diagnostic, setDiagnostic] = useState<DiagnosticExplain | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadDiagnostic() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (!nextOpen || diagnostic || loading) return
    const bridge = window.devhub?.r8?.ai
    if (!bridge?.diagnosticExplain) {
      setError('诊断通道不可用')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setDiagnostic(await bridge.diagnosticExplain(instanceId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '诊断加载失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 border border-surface-800 bg-surface-950/80 p-3 radius-sm" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={loadDiagnostic} className="flex items-center gap-2 text-xs text-info hover:text-info/80">
        <InfoIcon size={14} />
        信号诊断
        <span className="text-text-muted">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs text-text-muted">
          {loading && <p>正在读取本地信号贡献与状态历史...</p>}
          {error && <p className="text-error">{error}</p>}
          {diagnostic && (
            <>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <span>task={diagnostic.currentTaskState}</span>
                <span>action={diagnostic.suggestedAction}</span>
              </div>
              <div className="space-y-1">
                {diagnostic.topReasons.map(reason => (
                  <div key={reason.sourceCitation} className="border-l-2 border-info/50 pl-2" data-source-citation={reason.sourceCitation}>
                    <div className="font-mono text-[10px] text-text-tertiary">
                      source={reason.sourceCitation} contribution={(reason.contributionPct * 100).toFixed(1)}%
                    </div>
                    <span className="text-text-secondary">{reason.reasonText}</span>
                  </div>
                ))}
              </div>
              {diagnostic.recentTransitions.length > 0 && (
                <div className="font-mono text-[10px] text-text-tertiary">
                  最近状态翻转: {diagnostic.recentTransitions.map(item => `${item.layer}:${item.fromState}->${item.toState}`).join(' | ')}
                </div>
              )}
              <div className="border-t border-surface-800 pt-2">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-text-tertiary">本地反馈闭环</p>
                <div className="flex flex-wrap gap-2">
                  <MisreportButton
                    ariaLabel="标记检测正确"
                    armedLabel="确认正确"
                    idleLabel="正确"
                    instanceId={instanceId}
                    kind="correct-detection"
                    expectedTaskState={diagnostic.currentTaskState}
                    successMessage="正确反馈已记录"
                    title="标记此次 AI 状态检测正确"
                    userNote={`correct:${diagnostic.currentTaskState}`}
                  />
                  <MisreportButton
                    ariaLabel="标记检测错误"
                    armedLabel="确认错误"
                    idleLabel="错误"
                    instanceId={instanceId}
                    kind={incorrectKindForState(diagnostic.currentTaskState)}
                    expectedTaskState={expectedStateForIncorrect(diagnostic.currentTaskState)}
                    successMessage="错误反馈已记录"
                    title="标记此次 AI 状态检测错误"
                    userNote={`incorrect:${diagnostic.currentTaskState}`}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
