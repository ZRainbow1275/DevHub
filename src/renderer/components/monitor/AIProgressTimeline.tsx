import { useEffect, useState, useCallback, memo } from 'react'
import { TimelineEntry, AITaskState } from '@shared/types-extended'
import { formatDuration } from '../../utils/formatDuration'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

const STATUS_CONFIG: Record<AITaskState, { label: string; color: string; bgColor: string }> = {
  idle: { label: '空闲', color: '#6b7280', bgColor: 'bg-gray-500/20' },
  thinking: { label: '思考中', color: '#3b82f6', bgColor: 'bg-blue-500/20' },
  coding: { label: '编码中', color: '#22c55e', bgColor: 'bg-green-500/20' },
  compiling: { label: '编译中', color: '#f97316', bgColor: 'bg-orange-500/20' },
  running: { label: '运行中', color: '#10b981', bgColor: 'bg-emerald-500/20' },
  waiting: { label: '等待输入', color: '#eab308', bgColor: 'bg-yellow-500/20' },
  completed: { label: '已完成', color: '#06b6d4', bgColor: 'bg-cyan-500/20' },
  error: { label: '错误', color: '#ef4444', bgColor: 'bg-red-500/20' },
}

interface TimelineItemProps {
  entry: TimelineEntry
  isLast: boolean
}

const TimelineItem = memo(function TimelineItem({ entry, isLast }: TimelineItemProps) {
  const config = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.running
  const time = new Date(entry.timestamp)
  const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const durationStr = entry.duration > 0 ? formatDuration(entry.duration * 1000) : (isLast ? 'now' : '<1s')

  return (
    <div className="flex items-start gap-3 group">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-3 h-3 rounded-full border-2 flex-shrink-0"
          style={{ borderColor: config.color, backgroundColor: isLast ? config.color : 'transparent' }}
        />
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[24px]" style={{ backgroundColor: `${config.color}30` }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted">{timeStr}</span>
          <span
            className="text-xs font-medium px-1.5 py-0.5"
            style={{ color: config.color, backgroundColor: `${config.color}15`, borderRadius: '2px' }}
          >
            {config.label}
          </span>
          <span className="text-xs text-text-tertiary font-mono">[{durationStr}]</span>
        </div>
        {entry.detail && (
          <p className="text-xs text-text-muted mt-0.5 truncate" title={entry.detail}>
            {entry.detail}
          </p>
        )}
      </div>
    </div>
  )
})

interface AIProgressTimelineProps {
  taskId: string
  taskAlias?: string
}

export const AIProgressTimeline = memo(function AIProgressTimeline({ taskId, taskAlias }: AIProgressTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTimeline = useCallback(async () => {
    if (!isElectron) return
    try {
      const entries = await window.devhub.aiTask?.getTimeline?.(taskId) ?? []
      setTimeline(entries)
    } catch (error) {
      console.warn('Failed to fetch timeline:', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    fetchTimeline()
    const interval = setInterval(fetchTimeline, 3000)
    return () => clearInterval(interval)
  }, [fetchTimeline])

  // Compute statistics
  const stats = timeline.reduce(
    (acc, entry) => {
      acc.total += entry.duration
      if (entry.status === 'coding' || entry.status === 'running') {
        acc.coding += entry.duration
      }
      if (entry.status === 'waiting' || entry.status === 'idle') {
        acc.waiting += entry.duration
      }
      if (entry.status === 'thinking') {
        acc.thinking += entry.duration
      }
      return acc
    },
    { total: 0, coding: 0, waiting: 0, thinking: 0 }
  )

  if (isLoading) {
    return (
      <div className="p-4 text-center text-xs text-text-muted">
        Loading timeline...
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-text-muted">
        No timeline data yet
      </div>
    )
  }

  return (
    <div className="p-4 bg-surface-800/50 border border-surface-700" style={{ borderRadius: '4px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {taskAlias ? `${taskAlias} ` : ''}Progress Timeline
        </h4>
        <button
          onClick={fetchTimeline}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Timeline entries */}
      <div className="max-h-60 overflow-y-auto">
        {timeline.map((entry, i) => (
          <TimelineItem
            key={`${entry.timestamp}-${i}`}
            entry={entry}
            isLast={i === timeline.length - 1}
          />
        ))}
      </div>

      {/* Statistics */}
      {stats.total > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-700 flex items-center gap-4 text-xs text-text-muted">
          <span>
            Total: <span className="font-mono text-text-secondary">{formatDuration(stats.total * 1000)}</span>
          </span>
          {stats.coding > 0 && (
            <span>
              Coding: <span className="font-mono text-green-400">{formatDuration(stats.coding * 1000)}</span>
            </span>
          )}
          {stats.thinking > 0 && (
            <span>
              Thinking: <span className="font-mono text-blue-400">{formatDuration(stats.thinking * 1000)}</span>
            </span>
          )}
          {stats.waiting > 0 && (
            <span>
              Waiting: <span className="font-mono text-yellow-400">{formatDuration(stats.waiting * 1000)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
})
