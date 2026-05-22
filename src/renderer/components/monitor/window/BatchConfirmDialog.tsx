import { memo, useEffect } from 'react'
import { AlertIcon, CloseIcon, TerminalIcon, WindowIcon } from '../../icons'

type BatchConfirmKind = 'close' | 'inject'
type BatchConfirmVariant = 'danger' | 'warning'

interface BatchConfirmDialogProps {
  confirmText: string
  isOpen: boolean
  kind: BatchConfirmKind
  message: string
  targetSummary: string
  title: string
  variant: BatchConfirmVariant
  onCancel: () => void
  onConfirm: () => void
}

function getIcon(kind: BatchConfirmKind, variant: BatchConfirmVariant) {
  if (kind === 'inject') return <TerminalIcon size={20} className="text-warning" />
  if (variant === 'danger') return <CloseIcon size={20} className="text-error" />
  return <AlertIcon size={20} className="text-warning" />
}

export const BatchConfirmDialog = memo(function BatchConfirmDialog({
  confirmText,
  isOpen,
  kind,
  message,
  targetSummary,
  title,
  variant,
  onCancel,
  onConfirm
}: BatchConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const borderClass = variant === 'danger' ? 'border-error' : 'border-warning'
  const buttonClass = variant === 'danger'
    ? 'bg-error hover:bg-red-500 border-l-2 border-error text-white'
    : 'bg-warning hover:bg-amber-400 border-l-2 border-warning text-surface-950'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 animate-fade-in">
      <section
        aria-labelledby="window-batch-confirm-title"
        aria-modal="true"
        className="relative w-full max-w-lg border-2 border-surface-600 bg-surface-900 shadow-elevated radius-md"
        data-confirm-kind={kind}
        data-testid="window-batch-confirm-dialog"
        role="dialog"
      >
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />
        <div className="relative z-10 flex items-center gap-3 border-b-2 border-surface-700 px-6 py-4">
          <div className={`flex h-10 w-10 items-center justify-center border-l-3 ${borderClass} bg-surface-800 radius-sm`}>
            {getIcon(kind, variant)}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
              <WindowIcon size={12} />
              窗口批量确认
            </div>
            <h2
              className="text-gold font-bold uppercase tracking-wider"
              id="window-batch-confirm-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                transform: 'rotate(-1deg)',
                transformOrigin: 'left center'
              }}
            >
              {title}
            </h2>
          </div>
        </div>

        <div className="relative z-10 space-y-3 p-6">
          <p className="text-sm leading-6 text-text-secondary">{message}</p>
          <div className={`border-l-3 ${borderClass} bg-surface-950/80 p-3 text-xs text-text-primary radius-sm`}>
            {targetSummary}
          </div>
        </div>

        <div className="relative z-10 flex justify-end gap-3 border-t-2 border-surface-700 px-6 py-4">
          <button
            className="px-4 py-2.5 font-medium text-text-secondary transition-colors hover:bg-surface-800 radius-sm"
            data-testid="window-batch-confirm-cancel"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className={`px-4 py-2.5 font-medium transition-all duration-200 ${buttonClass} radius-sm`}
            data-testid="window-batch-confirm-ok"
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </section>
    </div>
  )
})
