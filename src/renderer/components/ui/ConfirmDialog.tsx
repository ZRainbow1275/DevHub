import { useEffect } from 'react'
import { AlertIcon, CheckIcon, CloseIcon } from '../icons'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const variantConfig = {
    danger: {
      icon: <CloseIcon size={20} className="text-error" />,
      iconBg: 'bg-error/20',
      iconBorder: 'border-error',
      buttonClass: 'bg-error hover:bg-red-500 border-l-2 border-error'
    },
    warning: {
      icon: <AlertIcon size={20} className="text-warning" />,
      iconBg: 'bg-warning/20',
      iconBorder: 'border-warning',
      buttonClass: 'bg-warning hover:bg-amber-400 text-surface-900 border-l-2 border-warning'
    },
    default: {
      icon: <CheckIcon size={20} className="text-accent" />,
      iconBg: 'bg-accent/20',
      iconBorder: 'border-accent',
      buttonClass: 'bg-accent hover:bg-accent-600 border-l-2 border-accent'
    }
  }

  const config = variantConfig[variant]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-surface-900 border-2 border-surface-600 w-full max-w-md mx-4 shadow-elevated relative radius-md"
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-surface-700 relative z-10">
          <div
            className={`w-10 h-10 ${config.iconBg} flex items-center justify-center border-l-3 ${config.iconBorder} radius-sm`}
          >
            {config.icon}
          </div>
          <h2
            id="confirm-dialog-title"
            className="text-gold font-bold uppercase tracking-wider"
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

        {/* Content */}
        <div className="p-6 relative z-10">
          <p className="text-text-secondary leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t-2 border-surface-700 relative z-10">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors font-medium radius-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 text-white font-medium transition-all duration-200 ${config.buttonClass} radius-sm`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
