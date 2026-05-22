import { memo } from 'react'
import type { WindowBatchProgress } from '@shared/schemas/r8-runtime'
import { AlertIcon, CheckIcon, CloseIcon, WindowIcon } from '../../icons'

interface BatchProgressToastProps {
  actionLabel: string
  cancelRequested?: boolean
  progress: WindowBatchProgress | null
  onCancel: () => void
  onDismiss: () => void
  onRetryFailed?: () => void
}

function getStateLabel(progress: WindowBatchProgress, cancelRequested: boolean): string {
  if (cancelRequested && progress.state === 'running') return '正在取消剩余操作'
  if (progress.state === 'cancelled') return '已取消剩余操作'
  if (progress.state === 'completed') return progress.failed > 0 ? '已完成，存在失败项' : '已完成'
  if (progress.state === 'paused') return '已暂停'
  return '执行中'
}

export const BatchProgressToast = memo(function BatchProgressToast({
  actionLabel,
  cancelRequested = false,
  progress,
  onCancel,
  onDismiss,
  onRetryFailed
}: BatchProgressToastProps) {
  if (!progress) return null

  const ok = progress.results.filter(result => result.status === 'ok').length
  const skipped = progress.results.filter(result => result.status === 'skipped').length
  const nonOkResults = progress.results.filter(result => result.status !== 'ok')
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const isRunning = progress.state === 'running'
  const canRetryFailed = !isRunning && progress.failed > 0 && typeof onRetryFailed === 'function'

  return (
    <section
      aria-live="polite"
      className="fixed bottom-28 right-6 w-[360px] max-w-[calc(100vw-2rem)] border-2 border-surface-600 border-l-3 border-l-accent bg-surface-950 shadow-elevated animate-slide-in radius-sm"
      data-testid="window-batch-progress-toast"
      style={{ zIndex: 'var(--z-tier-toast, 5000)' }}
    >
      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none radius-sm" />
      <div className="relative z-10 p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border-l-2 border-accent bg-surface-800 radius-sm">
            <WindowIcon size={16} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">窗口批量操作</div>
            <div className="truncate text-sm font-semibold text-text-primary">{actionLabel}</div>
            <div className="mt-1 text-xs text-text-secondary">{getStateLabel(progress, cancelRequested)}</div>
          </div>
          {!isRunning && (
            <button
              aria-label="关闭窗口批量进度"
              className="text-text-muted transition-colors hover:text-text-primary"
              data-testid="window-batch-progress-dismiss"
              onClick={onDismiss}
              type="button"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
            <span>{progress.completed}/{progress.total}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 bg-surface-800 radius-sm">
            <div
              className={`h-full transition-all ${progress.failed > 0 ? 'bg-warning' : 'bg-accent'}`}
              data-testid="window-batch-progress-bar"
              style={{ width: `${percent}%`, borderRadius: '1px' }}
            />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-success">
            <CheckIcon size={12} />
            成功 {ok}
          </div>
          <div className="flex items-center gap-1.5 text-error">
            <AlertIcon size={12} />
            失败 {progress.failed}
          </div>
          <div className="text-warning">跳过 {skipped}</div>
        </div>

        {nonOkResults.length > 0 && (
          <div className="mb-3 grid max-h-28 gap-1 overflow-y-auto border-l-2 border-surface-700 bg-surface-900/70 p-2 text-[11px] text-text-muted radius-sm">
            {nonOkResults.slice(0, 6).map(result => (
              <div key={`${result.hwnd}-${result.status}`} data-testid={`window-batch-result-${result.hwnd}`}>
                HWND {result.hwnd}: {result.status}{result.error ? ` - ${result.error}` : ''}
              </div>
            ))}
            {nonOkResults.length > 6 && <div>还有 {nonOkResults.length - 6} 项未显示</div>}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {isRunning ? (
            <button
              className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="window-batch-progress-cancel"
              disabled={cancelRequested}
              onClick={onCancel}
              type="button"
            >
              {cancelRequested ? '正在取消' : '取消剩余'}
            </button>
          ) : (
            <>
              {canRetryFailed && (
                <button
                  className="btn-secondary px-3 py-1.5 text-xs"
                  data-testid="window-batch-progress-retry-failed"
                  onClick={onRetryFailed}
                  type="button"
                >
                  重试失败项
                </button>
              )}
              <button
                className="btn-primary px-3 py-1.5 text-xs"
                data-testid="window-batch-progress-close"
                onClick={onDismiss}
                type="button"
              >
                关闭
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
})
