import { useEffect, useState, useCallback, memo, useMemo } from 'react'
import { TimelineEntry, AITaskState } from '@shared/types-extended'
import { formatDuration } from '../../utils/formatDuration'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

const STATUS_CONFIG: Record<AITaskState, { label: string; color: string; bgColor: string }> = {
  idle:      { label: '空闲',     color: '#6b7280', bgColor: 'bg-gray-500/20' },
  thinking:  { label: '思考中',   color: '#3b82f6', bgColor: 'bg-blue-500/20' },
  coding:    { label: '编码中',   color: '#22c55e', bgColor: 'bg-green-500/20' },
  compiling: { label: '编译中',   color: '#f97316', bgColor: 'bg-orange-500/20' },
  running:   { label: '运行中',   color: '#10b981', bgColor: 'bg-emerald-500/20' },
  waiting:   { label: '等待输入', color: '#eab308', bgColor: 'bg-yellow-500/20' },
  completed: { label: '已完成',   color: '#06b6d4', bgColor: 'bg-cyan-500/20' },
  error:     { label: '错误',     color: '#ef4444', bgColor: 'bg-red-500/20' },
}

// ============ Mini Sparkline Chart ============

interface SparklineProps {
  data: number[]
  color: string
  height?: number
  label?: string
  unit?: string
  maxVal?: number
}

const Sparkline = memo(function Sparkline({ data, color, height = 28, label, unit = '', maxVal }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center gap-1">
        {label && <span className="text-[9px] text-text-muted">{label}</span>}
        <span className="text-[9px] text-text-muted font-mono">--</span>
      </div>
    )
  }

  const w = 60
  const h = height
  const max = maxVal ?? Math.max(...data, 0.01)
  const min = 0
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const latest = data[data.length - 1] ?? 0

  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-[9px] text-text-muted">{label}</span>}
      <svg width={w} height={h} style={{ flexShrink: 0 }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Fill area */}
        <polyline
          points={`0,${h} ${points} ${w},${h}`}
          fill={color}
          opacity="0.12"
          strokeWidth="0"
        />
      </svg>
      <span className="text-[9px] font-mono" style={{ color }}>
        {latest.toFixed(1)}{unit}
      </span>
    </div>
  )
})

// ============ Phase Bar ============

interface PhaseBarProps {
  timeline: TimelineEntry[]
}

const PhaseBar = memo(function PhaseBar({ timeline }: PhaseBarProps) {
  if (timeline.length === 0) return null

  const totalDuration = timeline.reduce((sum, e) => sum + Math.max(e.duration, 0.1), 0)
  if (totalDuration <= 0) return null

  return (
    <div className="flex h-2 w-full overflow-hidden radius-sm gap-px">
      {timeline.map((entry, i) => {
        const config = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.running
        const widthPct = (Math.max(entry.duration, 0.1) / totalDuration) * 100
        return (
          <div
            key={i}
            className="h-full transition-all"
            style={{
              width: `${widthPct}%`,
              backgroundColor: config.color,
              opacity: 0.7,
              minWidth: '2px',
            }}
            title={`${config.label}: ${formatDuration(entry.duration * 1000)}`}
          />
        )
      })}
    </div>
  )
})

// ============ Timeline Item ============

interface TimelineItemProps {
  entry: TimelineEntry
  isLast: boolean
}

const TimelineItem = memo(function TimelineItem({ entry, isLast }: TimelineItemProps) {
  const config = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.running
  const time = new Date(entry.timestamp)
  const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const durationStr = entry.duration > 0 ? formatDuration(entry.duration * 1000) : (isLast ? '进行中' : '<1s')

  return (
    <div className="flex items-start gap-3 group">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-3 h-3 border-2 flex-shrink-0"
          style={{
            borderColor: config.color,
            backgroundColor: isLast ? config.color : 'transparent',
            borderRadius: '50%',
          }}
        />
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[24px]" style={{ backgroundColor: `${config.color}30` }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
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

// ============ Main Component ============

interface AIProgressTimelineProps {
  taskId: string
  taskAlias?: string
  /** Real-time CPU history (last N samples) from parent, passed for live chart */
  cpuHistory?: number[]
  /** Real-time write bytes per second history */
  writeRateHistory?: number[]
}

export const AIProgressTimeline = memo(function AIProgressTimeline({
  taskId,
  taskAlias,
  cpuHistory = [],
  writeRateHistory = [],
}: AIProgressTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [elapsedSec, setElapsedSec] = useState(0)

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

  // Elapsed time counter for current phase
  useEffect(() => {
    const lastEntry = timeline[timeline.length - 1]
    if (!lastEntry) return
    const startMs = new Date(lastEntry.timestamp).getTime()
    const tick = () => setElapsedSec(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [timeline])

  // Compute statistics
  const stats = useMemo(() => timeline.reduce(
    (acc, entry) => {
      acc.total += entry.duration
      if (entry.status === 'coding' || entry.status === 'running') acc.coding += entry.duration
      if (entry.status === 'waiting' || entry.status === 'idle') acc.waiting += entry.duration
      if (entry.status === 'thinking') acc.thinking += entry.duration
      if (entry.status === 'compiling') acc.compiling += entry.duration
      return acc
    },
    { total: 0, coding: 0, waiting: 0, thinking: 0, compiling: 0 }
  ), [timeline])

  const currentPhase = timeline[timeline.length - 1]
  const currentConfig = currentPhase ? (STATUS_CONFIG[currentPhase.status] ?? STATUS_CONFIG.running) : null

  if (isLoading) {
    return (
      <div className="p-4 text-center text-xs text-text-muted animate-pulse">
        加载时间线...
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-text-muted">
        暂无时间线数据
      </div>
    )
  }

  return (
    <div className="p-4 bg-surface-800/50 border border-surface-700 radius-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4
          className="text-xs font-semibold text-text-secondary uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {taskAlias ? `[${taskAlias}] ` : ''}进度时间线
        </h4>
        <button
          onClick={fetchTimeline}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          刷新
        </button>
      </div>

      {/* Phase bar (horizontal) */}
      <div className="mb-3">
        <PhaseBar timeline={timeline} />
        {/* Phase legend */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const hasPhase = timeline.some(e => e.status === key)
            if (!hasPhase) return null
            return (
              <div key={key} className="flex items-center gap-1">
                <span className="w-2 h-2" style={{ backgroundColor: cfg.color, borderRadius: '2px' }} />
                <span className="text-[9px] text-text-muted">{cfg.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Current phase indicator */}
      {currentConfig && currentPhase && (
        <div
          className="flex items-center gap-2 px-2 py-1.5 mb-3 border-l-2"
          style={{ borderColor: currentConfig.color, backgroundColor: `${currentConfig.color}10` }}
        >
          <span
            className="w-2 h-2 animate-pulse"
            style={{ backgroundColor: currentConfig.color, borderRadius: '50%' }}
          />
          <span className="text-xs font-medium" style={{ color: currentConfig.color }}>
            当前: {currentConfig.label}
          </span>
          <span className="text-xs font-mono text-text-muted ml-auto">
            {formatDuration(elapsedSec * 1000)}
          </span>
        </div>
      )}

      {/* Real-time charts */}
      {(cpuHistory.length > 1 || writeRateHistory.length > 1) && (
        <div className="flex items-center gap-4 mb-3 px-2 py-1.5 bg-surface-900/50 border-l-2 border-surface-600 radius-sm">
          {cpuHistory.length > 1 && (
            <Sparkline
              data={cpuHistory}
              color="#3b82f6"
              label="CPU"
              unit="%"
              maxVal={100}
            />
          )}
          {writeRateHistory.length > 1 && (
            <Sparkline
              data={writeRateHistory}
              color="#22c55e"
              label="写入"
              unit="B/s"
            />
          )}
        </div>
      )}

      {/* Timeline entries */}
      <div className="max-h-48 overflow-y-auto">
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
        <div className="mt-3 pt-3 border-t border-surface-700 flex items-center gap-4 flex-wrap text-xs text-text-muted">
          <span>
            总计: <span className="font-mono text-text-secondary">{formatDuration(stats.total * 1000)}</span>
          </span>
          {stats.thinking > 0 && (
            <span>
              思考: <span className="font-mono text-blue-400">{formatDuration(stats.thinking * 1000)}</span>
            </span>
          )}
          {stats.coding > 0 && (
            <span>
              编码: <span className="font-mono text-green-400">{formatDuration(stats.coding * 1000)}</span>
            </span>
          )}
          {stats.compiling > 0 && (
            <span>
              编译: <span className="font-mono text-orange-400">{formatDuration(stats.compiling * 1000)}</span>
            </span>
          )}
          {stats.waiting > 0 && (
            <span>
              等待: <span className="font-mono text-yellow-400">{formatDuration(stats.waiting * 1000)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
})
