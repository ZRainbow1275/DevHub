import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertIcon, RefreshIcon } from '../icons'

// ============ Types ============

interface ProcessCardErrorBoundaryProps {
  children: ReactNode
  /** PID to display in the degraded card — makes it identifiable even on crash */
  pid: number
  /** Process name for display (optional) */
  processName?: string
  /** Called when the user clicks the retry button */
  onRetry?: () => void
}

interface ProcessCardErrorBoundaryState {
  hasError: boolean
  error?: Error
}

// ============ Degraded Process Card ============

function DegradedProcessCard({
  pid,
  processName,
  error,
  onRetry,
  onReset,
}: {
  pid: number
  processName?: string
  error?: Error
  onRetry?: () => void
  onReset: () => void
}) {
  const handleRetry = () => {
    onReset()
    onRetry?.()
  }

  return (
    <div
      className="monitor-card relative overflow-hidden border-l-3 border-error/50 opacity-80"
      style={{ minHeight: '80px' }}
    >
      <div className="absolute inset-0 bg-error/5 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center justify-center gap-2 py-4 px-3">
        <AlertIcon size={20} className="text-error/70" />
        <div className="text-center">
          <p className="text-xs font-bold text-text-primary truncate max-w-full">
            {processName || `PID ${pid}`}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {pid > 0 ? `PID: ${pid} - ` : ''}
            Info incomplete
          </p>
        </div>
        {error && (
          <p className="text-[9px] text-error/60 font-mono truncate max-w-full" title={error.message}>
            {error.message.slice(0, 80)}
          </p>
        )}
        <button
          onClick={handleRetry}
          className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 bg-surface-800 px-2 py-1 transition-colors radius-sm"
        >
          <RefreshIcon size={10} />
          Retry
        </button>
      </div>
    </div>
  )
}

// ============ Error Boundary ============

/**
 * Error boundary for individual process/port/window cards.
 * Catches rendering errors and shows a degraded card with PID + retry button,
 * preventing a single broken data entry from crashing the entire list.
 */
export class ProcessCardErrorBoundary extends Component<ProcessCardErrorBoundaryProps, ProcessCardErrorBoundaryState> {
  constructor(props: ProcessCardErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ProcessCardErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ProcessCardErrorBoundary] Card render error for PID ${this.props.pid}:`,
      error.message,
      errorInfo.componentStack
    )
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <DegradedProcessCard
          pid={this.props.pid}
          processName={this.props.processName}
          error={this.state.error}
          onRetry={this.props.onRetry}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}
