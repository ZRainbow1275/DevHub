import { useEffect } from 'react'
import { AlertIcon, ChevronIcon, CloseIcon } from '../icons'

interface CloseConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function CloseConfirmDialog({ isOpen, onClose }: CloseConfirmDialogProps) {
  const handleMinimizeToTray = () => {
    const devhub = window.devhub
    if (devhub?.window?.hideToTray) {
      devhub.window.hideToTray()
    }
    onClose()
  }

  const handleExit = () => {
    const devhub = window.devhub
    if (devhub?.window?.forceClose) {
      devhub.window.forceClose()
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-confirm-dialog-title"
        className="bg-surface-900 border-2 border-surface-600 w-full max-w-md mx-4 shadow-elevated relative"
        style={{ borderRadius: '4px' }}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" style={{ borderRadius: '4px' }} />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-surface-700 relative z-10">
          <div
            className="w-10 h-10 bg-accent/20 flex items-center justify-center border-l-3 border-accent"
            style={{ borderRadius: '2px' }}
          >
            <AlertIcon size={20} className="text-accent" />
          </div>
          <div>
            <h2
              id="close-confirm-dialog-title"
              className="text-gold font-bold uppercase tracking-wider"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                transform: 'rotate(-1deg)',
                transformOrigin: 'left center'
              }}
            >
              关闭应用
            </h2>
            <p className="text-xs text-text-muted">CLOSE APPLICATION</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 relative z-10">
          <p className="text-text-secondary text-sm">
            您希望如何处理 DevHub？
          </p>

          <div className="space-y-3">
            {/* Minimize to tray option */}
            <button
              onClick={handleMinimizeToTray}
              className="w-full flex items-center gap-4 p-4 bg-surface-800 hover:bg-surface-700 border-l-3 border-info transition-colors text-left group"
              style={{ borderRadius: '2px' }}
            >
              <div
                className="w-10 h-10 bg-info/20 flex items-center justify-center border-l-2 border-info flex-shrink-0"
                style={{ borderRadius: '2px' }}
              >
                <ChevronIcon size={20} className="text-info rotate-90" />
              </div>
              <div className="flex-1">
                <div className="text-text-primary font-semibold group-hover:text-white transition-colors">
                  最小化到系统托盘
                </div>
                <div className="text-text-muted text-xs mt-0.5">
                  DevHub 将在后台继续运行，可从托盘图标恢复
                </div>
              </div>
            </button>

            {/* Exit option */}
            <button
              onClick={handleExit}
              className="w-full flex items-center gap-4 p-4 bg-surface-800 hover:bg-error/20 border-l-3 border-error/50 hover:border-error transition-colors text-left group"
              style={{ borderRadius: '2px' }}
            >
              <div
                className="w-10 h-10 bg-error/20 flex items-center justify-center border-l-2 border-error flex-shrink-0"
                style={{ borderRadius: '2px' }}
              >
                <CloseIcon size={20} className="text-error" />
              </div>
              <div className="flex-1">
                <div className="text-text-primary font-semibold group-hover:text-error transition-colors">
                  完全退出
                </div>
                <div className="text-text-muted text-xs mt-0.5">
                  关闭 DevHub 并停止所有后台进程
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t-2 border-surface-700 relative z-10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-surface-800 transition-colors text-sm font-medium"
            style={{ borderRadius: '2px' }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
