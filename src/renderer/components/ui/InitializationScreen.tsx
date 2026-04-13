import { useEffect, useRef, useState, useCallback } from 'react'
import { useScannerStore } from '../../stores/scannerStore'
import { ScannerType } from '@shared/types-extended'

interface ScannerLineProps {
  label: string
  type: ScannerType
  onRetry: (type: ScannerType) => void
  retrying: boolean
}

const SCANNER_LABELS: Record<ScannerType, string> = {
  processes: '进程',
  ports: '端口',
  windows: '窗口',
  aiTasks: 'AI 工具'
}

function ScannerLine({ label, type, onRetry, retrying }: ScannerLineProps) {
  const status = useScannerStore(s => s.scannerStatus[type])

  const icon = status.error ? '!' : status.ready ? '\u2713' : '\u25CE'
  const iconColor = status.error
    ? 'text-red-400'
    : status.ready
      ? 'text-green-400'
      : 'text-text-muted animate-pulse'

  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <span className={`w-5 text-center ${iconColor}`}>{icon}</span>
      <span className="text-text-primary">
        {retrying
          ? `${label}重试中...`
          : status.ready
            ? `${label}扫描完成`
            : status.error
              ? `${label}扫描失败`
              : `${label}扫描中...`
        }
      </span>
      {status.ready && (
        <span className="text-text-muted ml-auto">
          {status.count} 个{label}已发现
        </span>
      )}
      {status.error && !retrying && (
        <button
          onClick={() => onRetry(type)}
          className="ml-auto text-xs px-2 py-0.5 border border-accent/50 text-accent hover:bg-accent/10 transition-colors"
          style={{ borderRadius: 'var(--radius-sm, 0px)' }}
        >
          RETRY
        </button>
      )}
      {status.error && retrying && (
        <span className="text-text-muted ml-auto text-xs animate-pulse">...</span>
      )}
    </div>
  )
}

interface InitializationScreenProps {
  onReady?: () => void
}

export function InitializationScreen({ onReady }: InitializationScreenProps) {
  const initStatus = useScannerStore(s => s.initStatus)
  const scannerStatus = useScannerStore(s => s.scannerStatus)
  const onReadyCalledRef = useRef(false)
  const [retryingTypes, setRetryingTypes] = useState<Set<ScannerType>>(new Set())

  // Auto-transition when ready -- use useEffect to avoid calling during render
  useEffect(() => {
    if (initStatus === 'ready' && onReady && !onReadyCalledRef.current) {
      onReadyCalledRef.current = true
      onReady()
    }
  }, [initStatus, onReady])

  const handleRetry = useCallback(async (type: ScannerType) => {
    if (!window.devhub?.scanner?.retryScanner) return
    setRetryingTypes(prev => new Set(prev).add(type))
    try {
      await window.devhub.scanner.retryScanner(type)
    } finally {
      setRetryingTypes(prev => {
        const next = new Set(prev)
        next.delete(type)
        return next
      })
    }
  }, [])

  // Compute progress based on individual scanner states
  const readyCount = Object.values(scannerStatus).filter(s => s.ready).length
  const totalCount = Object.keys(scannerStatus).length
  const hasErrors = Object.values(scannerStatus).some(s => s.error)

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 bg-surface-900"
    >
      {/* Diagonal stripe overlay for soviet feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(214,69,69,0.03) 10px, rgba(214,69,69,0.03) 11px)'
        }}
      />

      {/* Title */}
      <h1
        className="text-2xl font-bold uppercase tracking-widest relative z-10"
        style={{
          fontFamily: 'var(--font-display)',
          color: '#f0e8d8'
        }}
      >
        DevHub
      </h1>

      {/* Status message */}
      <div className="text-sm relative z-10" style={{ color: '#a09888' }}>
        {initStatus === 'loading' && !hasErrors && (
          <span className="animate-pulse">{'\u25C9'} Initializing system probes...</span>
        )}
        {initStatus === 'loading' && hasErrors && (
          <span>
            {'\u25C9'} Some scanners failed - click RETRY below
          </span>
        )}
        {initStatus === 'partial' && (
          <span className="animate-pulse">{'\u25C9'} Completing scans...</span>
        )}
        {initStatus === 'ready' && (
          <span style={{ color: '#4ade80' }}>{'\u2713'} Initialization complete</span>
        )}
      </div>

      {/* Scanner lines */}
      <div className="w-[380px] space-y-2 p-4 border-2 relative z-10"
        style={{
          borderRadius: 'var(--radius-md, 2px)',
          background: 'rgba(26,24,20,0.8)',
          borderColor: '#3a3530'
        }}
      >
        {(Object.keys(SCANNER_LABELS) as ScannerType[]).map((type) => (
          <ScannerLine
            key={type}
            label={SCANNER_LABELS[type]}
            type={type}
            onRetry={handleRetry}
            retrying={retryingTypes.has(type)}
          />
        ))}
      </div>

      {/* Loading bar */}
      {initStatus !== 'ready' && (
        <div className="w-[380px] h-1 overflow-hidden relative z-10"
          style={{
            borderRadius: 'var(--radius-sm, 0px)',
            background: '#2a2520'
          }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.round((readyCount / totalCount) * 100)}%`,
              background: 'linear-gradient(90deg, #d64545, #c9a227)'
            }}
          />
        </div>
      )}
    </div>
  )
}

