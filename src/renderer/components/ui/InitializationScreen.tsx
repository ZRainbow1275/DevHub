import { useEffect, useRef } from 'react'
import { useScannerStore, InitStatus } from '../../stores/scannerStore'
import { ScannerType } from '@shared/types-extended'

interface ScannerLineProps {
  label: string
  type: ScannerType
}

const SCANNER_LABELS: Record<ScannerType, string> = {
  processes: '进程',
  ports: '端口',
  windows: '窗口',
  aiTasks: 'AI 工具'
}

function ScannerLine({ label, type }: ScannerLineProps) {
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
        {status.ready
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
      {status.error && (
        <span className="text-red-400/70 ml-auto text-xs truncate max-w-[200px]">
          {status.error}
        </span>
      )}
    </div>
  )
}

interface InitializationScreenProps {
  onReady?: () => void
}

export function InitializationScreen({ onReady }: InitializationScreenProps) {
  const initStatus = useScannerStore(s => s.initStatus)
  const onReadyCalledRef = useRef(false)

  // Auto-transition when ready — use useEffect to avoid calling during render
  useEffect(() => {
    if (initStatus === 'ready' && onReady && !onReadyCalledRef.current) {
      onReadyCalledRef.current = true
      onReady()
    }
  }, [initStatus, onReady])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 bg-surface-950">
      {/* Title */}
      <h1
        className="text-2xl font-bold text-text-primary uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        DevHub
      </h1>

      {/* Status message */}
      <div className="text-sm text-text-muted">
        {initStatus === 'loading' && (
          <span className="animate-pulse">{'\u25C9'} 正在初始化系统勘探...</span>
        )}
        {initStatus === 'partial' && (
          <span className="animate-pulse">{'\u25C9'} 正在完成扫描...</span>
        )}
        {initStatus === 'ready' && (
          <span className="text-green-400">{'\u2713'} 初始化完成</span>
        )}
      </div>

      {/* Scanner lines */}
      <div className="w-[380px] space-y-2 bg-surface-900/50 p-4 border-2 border-surface-700"
        style={{ borderRadius: 'var(--radius-md, 2px)' }}
      >
        {(Object.keys(SCANNER_LABELS) as ScannerType[]).map((type) => (
          <ScannerLine key={type} label={SCANNER_LABELS[type]} type={type} />
        ))}
      </div>

      {/* Loading bar */}
      {initStatus !== 'ready' && (
        <div className="w-[380px] h-1 bg-surface-800 overflow-hidden"
          style={{ borderRadius: 'var(--radius-sm, 0px)' }}
        >
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{
              width: getProgressPercent(initStatus)
            }}
          />
        </div>
      )}
    </div>
  )
}

function getProgressPercent(status: InitStatus): string {
  switch (status) {
    case 'loading': return '20%'
    case 'partial': return '60%'
    case 'ready': return '100%'
  }
}
