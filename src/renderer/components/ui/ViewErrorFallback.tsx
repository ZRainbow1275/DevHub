import { memo } from 'react'
import { AlertIcon, RefreshIcon } from '../icons'

interface ViewErrorFallbackProps {
  viewName: string
  error: Error
  onRetry: () => void
}

export const ViewErrorFallback = memo(function ViewErrorFallback({
  viewName,
  error,
  onRetry
}: ViewErrorFallbackProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-surface-950">
      <div
        className="w-16 h-16 bg-error/10 flex items-center justify-center mb-4 border-l-3 border-error radius-sm"
      >
        <AlertIcon size={32} className="text-error" />
      </div>

      <h3
        className="text-lg font-bold text-text-primary mb-2 uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {viewName} 加载失败
      </h3>

      <p className="text-sm text-text-muted mb-4 max-w-sm text-center">
        该模块遇到了意外错误，不会影响其他功能。
      </p>

      <div
        className="mb-6 p-3 bg-surface-800 border-l-2 border-error max-w-md w-full radius-sm"
      >
        <p className="text-xs text-error font-mono break-all">
          {error.message}
        </p>
      </div>

      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors border-l-2 border-accent radius-sm"
      >
        <RefreshIcon size={16} />
        重试
      </button>
    </div>
  )
})
