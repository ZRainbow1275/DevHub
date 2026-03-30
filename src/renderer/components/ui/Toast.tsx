import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import { CheckIcon, CloseIcon, AlertIcon, InfoIcon } from '../icons'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface ToastContextType {
  showToast: (type: Toast['type'], message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutIds = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    const ids = timeoutIds.current
    return () => {
      ids.forEach(id => clearTimeout(id))
      ids.clear()
    }
  }, [])

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])

    const timeoutId = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timeoutIds.current.delete(timeoutId)
    }, 4000)
    timeoutIds.current.add(timeoutId)
  }, [])

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const getToastConfig = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return {
          styles: 'bg-surface-900 border-l-success',
          icon: <CheckIcon size={18} className="text-success" />
        }
      case 'error':
        return {
          styles: 'bg-surface-900 border-l-error',
          icon: <CloseIcon size={18} className="text-error" />
        }
      case 'warning':
        return {
          styles: 'bg-surface-900 border-l-warning',
          icon: <AlertIcon size={18} className="text-warning" />
        }
      case 'info':
        return {
          styles: 'bg-surface-900 border-l-info',
          icon: <InfoIcon size={18} className="text-info" />
        }
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-10 right-6 z-50 flex flex-col gap-3">
          {toasts.map((toast, index) => {
            const config = getToastConfig(toast.type)
            return (
              <div
                key={toast.id}
                className={`
                  flex items-center gap-3 px-4 py-3 border-2 border-surface-600 border-l-3
                  shadow-elevated animate-slide-in min-w-[280px] max-w-[400px]
                  ${config.styles}
                `}
                style={{
                  borderRadius: '4px',
                  animationDelay: `${index * 50}ms`
                }}
              >
                {/* Diagonal decoration */}
                <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" style={{ borderRadius: '4px' }} />

                <div
                  className="w-8 h-8 bg-surface-800 flex items-center justify-center border-l-2 border-current flex-shrink-0"
                  style={{ borderRadius: '2px' }}
                >
                  {config.icon}
                </div>
                <span className="flex-1 text-sm font-medium text-text-primary relative z-10">
                  {toast.message}
                </span>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-text-muted hover:text-text-primary transition-colors relative z-10"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </ToastContext.Provider>
  )
}
