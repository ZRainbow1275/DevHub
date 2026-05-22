import { useMemo, useState } from 'react'
import type { RecoveryReport } from '@shared/schemas/r8-runtime'
import { AlertIcon, CheckIcon, CloseIcon, RefreshIcon } from '../../components/icons'

interface RecoveryDialogProps {
  report: RecoveryReport | null
  onChanged: () => void | Promise<void>
}

const severityClass: Record<RecoveryReport['findings'][number]['severity'], string> = {
  low: 'text-info border-info/30 bg-info/10',
  medium: 'text-warning border-warning/30 bg-warning/10',
  high: 'text-error border-error/30 bg-error/10',
  critical: 'text-error border-error/50 bg-error/15'
}

export function RecoveryDialog({ report, onChanged }: RecoveryDialogProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const findings = useMemo(() => report?.findings ?? [], [report])
  const kindsToRestore = useMemo(() => Array.from(new Set(findings.map(finding => finding.kind))), [findings])

  if (!report || findings.length === 0) return null

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label)
    setError(null)
    try {
      await action()
      await onChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mb-4 border border-warning/50 bg-surface-900 p-4 radius-md shadow-panel" data-testid="recovery-dialog">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertIcon size={20} className="mt-0.5 text-warning" />
          <div>
            <h4 className="font-bold text-text-primary">检测到上次会话存在可恢复状态</h4>
            <p className="text-sm text-text-muted">DevHub 已保留本地恢复报告。恢复操作会先创建 pre-recovery 快照，不会自动重启 AI 子进程。</p>
          </div>
        </div>
        <div className="font-mono text-xs text-text-muted">{new Date(report.scannedAt).toLocaleString()}</div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {findings.map(finding => (
          <div key={`${report.reportId}-${finding.kind}`} className={`border px-3 py-2 radius-sm ${severityClass[finding.severity]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">{finding.kind}</span>
              <span className="text-[10px] uppercase tracking-wider">{finding.recommendedAction}</span>
            </div>
            <div className="mt-1 text-xs text-text-muted">severity={finding.severity}</div>
          </div>
        ))}
      </div>

      {error && <div className="mt-3 border border-error/40 bg-error/10 px-3 py-2 text-sm text-error radius-sm">{error}</div>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary flex items-center gap-2"
          disabled={busy !== null}
          onClick={() => { void runAction('restore', () => window.devhub.r8.recovery.restoreState({ kindsToRestore, confirmedBy: 'r8-recovery-dialog', userChoice: 'restore-all' })) }}
        >
          <CheckIcon size={14} />
          恢复全部
        </button>
        <button
          type="button"
          className="btn-secondary flex items-center gap-2"
          disabled={busy !== null}
          onClick={() => { void runAction('checkpoint', () => window.devhub.r8.recovery.createCheckpoint('user-explicit')) }}
        >
          <RefreshIcon size={14} />
          创建检查点
        </button>
        <button
          type="button"
          className="btn-secondary flex items-center gap-2"
          disabled={busy !== null}
          onClick={() => { void runAction('dismiss', () => window.devhub.r8.recovery.dismiss({ reportId: report.reportId, findingsToDismiss: kindsToRestore })) }}
        >
          <CloseIcon size={14} />
          跳过 7 天
        </button>
        {busy && <span className="self-center text-xs text-text-muted">正在执行：{busy}</span>}
      </div>
    </section>
  )
}
