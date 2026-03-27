import { useRef, useEffect } from 'react'
import { useLogs } from '../../hooks/useLogs'
import { LogEntry } from '@shared/types'
import { TerminalIcon, TrashIcon } from '../icons'

interface LogPanelProps {
  projectId: string | null
  projectName: string
}

export function LogPanel({ projectId, projectName }: LogPanelProps) {
  const { logs, clearLogs } = useLogs(projectId)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getLogClass = (type: LogEntry['type']) => {
    switch (type) {
      case 'stdout':
        return 'log-stdout'
      case 'stderr':
        return 'log-stderr'
      case 'system':
        return 'log-system'
      default:
        return ''
    }
  }

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-950 relative">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />

        <div className="text-center relative z-10">
          <div className="w-20 h-20 mx-auto mb-6 bg-surface-800 flex items-center justify-center border-l-3 border-accent" style={{ borderRadius: '4px' }}>
            <TerminalIcon size={40} className="text-text-muted" />
          </div>
          <p
            className="text-text-tertiary font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)', fontSize: '14px' }}
          >
            选择一个项目查看日志
          </p>
          <p className="text-text-muted text-xs mt-2">在左侧列表中点击项目</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b-2 border-surface-700 bg-surface-900 relative">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-8 h-8 bg-surface-700 flex items-center justify-center border-l-2 border-accent" style={{ borderRadius: '2px' }}>
            <TerminalIcon size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{projectName}</h3>
            <p className="text-xs text-text-muted">终端输出</p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <span className="text-xs text-text-primary font-bold bg-surface-800 px-2 py-1 border-l-2 border-gold tabular-nums" style={{ borderRadius: '2px' }}>
            {logs.length} 条日志
          </span>
          <button
            onClick={clearLogs}
            className="btn-icon-sm text-text-muted hover:text-error hover:bg-error/10"
            title="清除日志"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-3 font-mono text-mono leading-relaxed bg-surface-950"
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-2 text-text-muted px-5">
            <span className="w-2 h-2 bg-success animate-pulse" style={{ borderRadius: '1px' }} />
            <span className="italic">等待输出...</span>
          </div>
        ) : (
          <div className="space-y-0">
            {logs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className={`log-line ${getLogClass(log.type)}`}>
                <span className="log-timestamp">
                  {formatTime(log.timestamp)}
                </span>
                <span className="pl-3 whitespace-pre-wrap break-all">{log.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Terminal cursor */}
        {logs.length > 0 && (
          <div className="flex items-center gap-1 mt-2 px-5">
            <span className="text-success font-bold">❯</span>
            <span className="inline-block w-2 h-4 bg-accent animate-pulse" style={{ borderRadius: '1px' }} />
          </div>
        )}
      </div>
    </div>
  )
}
