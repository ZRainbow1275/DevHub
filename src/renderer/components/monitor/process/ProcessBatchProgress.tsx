import { memo } from 'react'
import type { ProcessBatchProgress as ProcessBatchProgressState } from '@shared/schemas/r8-runtime'
import { AlertIcon, CheckIcon, ProcessIcon } from '../../icons'

interface ProcessBatchProgressProps {
  onDismiss?: () => void
  onRetryFailed?: () => void
  progress: ProcessBatchProgressState | null
}

export const ProcessBatchProgress = memo(function ProcessBatchProgress({
  onDismiss,
  onRetryFailed,
  progress
}: ProcessBatchProgressProps) {
  if (!progress) return null

  const skipped = progress.results.filter(result => result.status === 'skipped').length
  const ok = progress.results.filter(result => result.status === 'ok').length
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const isRunning = progress.state === 'running'
  const canRetryFailed = !isRunning && progress.failed > 0 && typeof onRetryFailed === 'function'

  return (
    <div
      data-testid="process-batch-progress"
      className="border-b border-surface-700/40 bg-surface-950/70 px-5 py-2"
    >
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-text-primary">
          <ProcessIcon size={14} />
          批量进度 {progress.completed}/{progress.total}
        </div>
        <div className="h-1.5 w-40 bg-surface-800 radius-sm">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${percent}%`, borderRadius: '1px' }}
          />
        </div>
        <span className="flex items-center gap-1 text-success">
          <CheckIcon size={12} />
          成功 {ok}
        </span>
        {progress.failed > 0 && (
          <span className="flex items-center gap-1 text-error">
            <AlertIcon size={12} />
            失败 {progress.failed}
          </span>
        )}
        {skipped > 0 && <span className="text-warning">跳过 {skipped}</span>}
      </div>
      {progress.results.some(result => result.status !== 'ok') && (
        <div className="mt-2 grid gap-1 text-[11px] text-text-muted">
            {progress.results
              .filter(result => result.status !== 'ok')
              .slice(0, 6)
            .map(result => (
              <div key={`${result.pid}-${result.status}`} data-testid={`process-batch-result-${result.pid}`}>
                PID {result.pid}: {result.status} {result.error ? `- ${result.error}` : ''}
              </div>
            ))}
        </div>
      )}
      {!isRunning && (canRetryFailed || onDismiss) && (
        <div className="mt-2 flex justify-end gap-2">
          {canRetryFailed && (
            <button
              className="btn-secondary px-2 py-1 text-[11px]"
              data-testid="process-batch-retry-failed"
              onClick={onRetryFailed}
              type="button"
            >
              重试失败项
            </button>
          )}
          {onDismiss && (
            <button
              className="btn-secondary px-2 py-1 text-[11px]"
              data-testid="process-batch-progress-close"
              onClick={onDismiss}
              type="button"
            >
              关闭
            </button>
          )}
        </div>
      )}
    </div>
  )
})
