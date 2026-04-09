import { useEffect, memo, useState, useCallback } from 'react'
import { useAITasks } from '../../hooks/useAITasks'
import { useAliasStore } from '../../stores/aliasStore'
import { useToast } from '../ui/Toast'
import { AITask, AITaskHistory, AIToolType, AITaskState, AIWindowAlias } from '@shared/types-extended'
import { AIWindowAliasEditor } from './AIWindowAlias'
import { formatDuration, formatDurationCN } from '../../utils/formatDuration'

const TOOL_INFO: Record<AIToolType, { name: string; icon: string; color: string }> = {
  'codex': { name: 'Codex', icon: '🧠', color: 'text-green-400' },
  'claude-code': { name: 'Claude Code', icon: '🤖', color: 'text-orange-400' },
  'gemini-cli': { name: 'Gemini CLI', icon: '✨', color: 'text-blue-400' },
  'cursor': { name: 'Cursor', icon: '📝', color: 'text-purple-400' },
  'other': { name: 'Other', icon: '⚙️', color: 'text-gray-400' }
}

const STATE_INFO: Record<AITaskState, { label: string; color: string; bgColor: string }> = {
  'running': { label: '运行中', color: 'text-success', bgColor: 'bg-success/10' },
  'waiting': { label: '等待中', color: 'text-warning', bgColor: 'bg-warning/10' },
  'completed': { label: '已完成', color: 'text-accent-300', bgColor: 'bg-accent/10' },
  'error': { label: '错误', color: 'text-error', bgColor: 'bg-error/10' },
  'idle': { label: '空闲', color: 'text-text-muted', bgColor: 'bg-surface-700' }
}

interface TaskCardProps {
  task: AITask
  isSelected: boolean
  onSelect: () => void
  onSaveAlias: (alias: AIWindowAlias) => void
  existingAlias?: AIWindowAlias
}

const TaskCard = memo(function TaskCard({ task, isSelected, onSelect, onSaveAlias, existingAlias }: TaskCardProps) {
  const toolInfo = TOOL_INFO[task.toolType]
  const stateInfo = STATE_INFO[task.status.state]
  const [now, setNow] = useState(Date.now())
  const [isEditingAlias, setIsEditingAlias] = useState(false)

  useEffect(() => {
    if (task.status.state !== 'running' && task.status.state !== 'waiting') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [task.status.state])

  const duration = now - task.startTime

  const avgCpu = task.metrics.cpuHistory.length > 0
    ? task.metrics.cpuHistory.reduce((a, b) => a + b, 0) / task.metrics.cpuHistory.length
    : 0

  const displayAlias = task.alias || existingAlias?.alias
  const aliasColor = task.aliasColor || existingAlias?.color

  return (
    <div
      onClick={onSelect}
      className={`
        group p-4 rounded-xl cursor-pointer transition-all duration-200
        ${isSelected
          ? 'bg-surface-700 border border-accent/50'
          : 'bg-surface-800 border border-transparent hover:bg-surface-750 hover:border-surface-600'
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl" title={toolInfo.name}>{toolInfo.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              {displayAlias ? (
                <>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: aliasColor ?? undefined }}
                  >
                    {displayAlias}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {toolInfo.name}
                  </span>
                </>
              ) : (
                <span className={`text-sm font-semibold ${toolInfo.color}`}>
                  {toolInfo.name}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded ${stateInfo.bgColor} ${stateInfo.color}`}>
                {stateInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
              <span>PID: {task.pid}</span>
              <span>运行时间: {formatDuration(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsEditingAlias(!isEditingAlias)
            }}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary
                       hover:bg-surface-600 rounded transition-colors opacity-0 group-hover:opacity-100"
            title={displayAlias ? '编辑别名' : '设置别名'}
          >
            {displayAlias ? '编辑' : '命名'}
          </button>
          <div className="text-right">
            <div className="text-xs text-text-tertiary">
              平均 CPU: {avgCpu.toFixed(1)}%
            </div>
            {task.status.state === 'running' && (
              <div className="flex items-center gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                <span className="text-xs text-success">活跃</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alias color indicator bar */}
      {aliasColor && (
        <div
          className="h-0.5 mt-2 rounded-full opacity-60"
          style={{ backgroundColor: aliasColor }}
        />
      )}

      {/* Inline alias editor */}
      {isEditingAlias && (
        <AIWindowAliasEditor
          task={task}
          existingAlias={existingAlias}
          onSave={(alias) => {
            onSaveAlias(alias)
            setIsEditingAlias(false)
          }}
          onCancel={() => setIsEditingAlias(false)}
        />
      )}

      {/* CPU History Mini Chart */}
      {task.metrics.cpuHistory.length > 1 && (
        <div className="mt-3 h-8 flex items-end gap-0.5">
          {task.metrics.cpuHistory.slice(-20).map((cpu, i) => (
            <div
              key={i}
              className="flex-1 bg-accent/30 rounded-t"
              style={{ height: `${Math.min(cpu * 2, 100)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  )
})

interface HistoryItemProps {
  entry: AITaskHistory
}

const HistoryItem = memo(function HistoryItem({ entry }: HistoryItemProps) {
  const toolInfo = TOOL_INFO[entry.toolType]

  const statusColor = {
    'completed': 'text-success',
    'error': 'text-error',
    'cancelled': 'text-warning'
  }[entry.status] ?? 'text-text-muted'

  return (
    <div className="p-3 bg-surface-800 rounded-lg border border-transparent hover:border-surface-600 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">{toolInfo.icon}</span>
          <div>
            <span className={`text-sm font-medium ${toolInfo.color}`}>
              {toolInfo.name}
            </span>
            <div className="text-xs text-text-muted mt-0.5">
              {new Date(entry.startTime).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-xs ${statusColor}`}>
            {entry.status === 'completed' ? '完成' : entry.status === 'error' ? '错误' : '取消'}
          </span>
          <div className="text-xs text-text-tertiary mt-0.5">
            耗时: {formatDurationCN(entry.duration)}
          </div>
        </div>
      </div>
    </div>
  )
})

export function AITaskView() {
  const {
    activeTasks,
    history,
    statistics,
    selectedTaskId,
    fetchActiveTasks,
    fetchHistory,
    fetchStatistics,
    selectTask
  } = useAITasks()

  const { aliases, fetchAliases, saveAlias } = useAliasStore()
  const { showToast } = useToast()
  const [viewTab, setViewTab] = useState<'active' | 'history' | 'stats'>('active')

  const findAliasForTask = useCallback((task: AITask) => {
    return aliases.find(
      (a) =>
        a.matchCriteria.toolType === task.toolType &&
        (a.matchCriteria.pid === task.pid ||
          (a.alias === task.alias))
    )
  }, [aliases])

  const handleSaveAlias = useCallback(async (alias: AIWindowAlias) => {
    const result = await saveAlias(alias)
    if (result) {
      showToast('success', `别名 "${alias.alias}" 已保存`)
    } else {
      showToast('error', '别名保存失败')
    }
  }, [saveAlias, showToast])

  useEffect(() => {
    fetchActiveTasks()
    fetchHistory(50)
    fetchStatistics()
    fetchAliases()

    const interval = setInterval(() => {
      fetchActiveTasks()
    }, 2000)

    return () => clearInterval(interval)
  }, [fetchActiveTasks, fetchHistory, fetchStatistics, fetchAliases])

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-surface-700 bg-surface-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-text-primary">AI 任务追踪</h2>
            {activeTasks.length > 0 && (
              <span className="text-xs bg-accent/10 text-accent-300 px-2 py-0.5 rounded flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                {activeTasks.length} 个活跃任务
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center bg-surface-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewTab('active')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  viewTab === 'active'
                    ? 'bg-surface-700 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                活跃 ({activeTasks.length})
              </button>
              <button
                onClick={() => setViewTab('history')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  viewTab === 'history'
                    ? 'bg-surface-700 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                历史
              </button>
              <button
                onClick={() => setViewTab('stats')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  viewTab === 'stats'
                    ? 'bg-surface-700 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                统计
              </button>
            </div>

            <button
              onClick={() => {
                fetchActiveTasks()
                fetchHistory(50)
                fetchStatistics()
              }}
              className="btn-icon"
              title="刷新"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewTab === 'active' && (
          <div className="space-y-3">
            {activeTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isSelected={selectedTaskId === task.id}
                onSelect={() => selectTask(task.id)}
                onSaveAlias={handleSaveAlias}
                existingAlias={findAliasForTask(task)}
              />
            ))}
            {activeTasks.length === 0 && (
              <div className="text-center py-12 text-text-muted">
                <span className="text-4xl mb-3 block">🤖</span>
                <p>没有检测到运行中的 AI 编程工具</p>
                <p className="text-xs mt-1">
                  支持: Codex, Claude Code, Gemini CLI, Cursor
                </p>
              </div>
            )}
          </div>
        )}

        {viewTab === 'history' && (
          <div className="space-y-2">
            {history.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} />
            ))}
            {history.length === 0 && (
              <div className="text-center py-12 text-text-muted">
                <p>暂无任务历史</p>
              </div>
            )}
          </div>
        )}

        {viewTab === 'stats' && statistics && (
          <div className="space-y-4">
            {/* Overview Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-surface-800 rounded-xl">
                <div className="text-2xl font-bold text-text-primary">
                  {statistics.totalTasks}
                </div>
                <div className="text-xs text-text-muted mt-1">总任务数</div>
              </div>
              <div className="p-4 bg-surface-800 rounded-xl">
                <div className="text-2xl font-bold text-success">
                  {statistics.completedTasks}
                </div>
                <div className="text-xs text-text-muted mt-1">已完成</div>
              </div>
              <div className="p-4 bg-surface-800 rounded-xl">
                <div className="text-2xl font-bold text-error">
                  {statistics.errorTasks}
                </div>
                <div className="text-xs text-text-muted mt-1">错误</div>
              </div>
              <div className="p-4 bg-surface-800 rounded-xl">
                <div className="text-2xl font-bold text-accent-300">
                  {formatDurationCN(statistics.avgDuration)}
                </div>
                <div className="text-xs text-text-muted mt-1">平均时长</div>
              </div>
            </div>

            {/* By Tool */}
            <div className="bg-surface-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">按工具统计</h3>
              <div className="space-y-2">
                {Object.entries(statistics.byTool)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([tool, count]) => {
                    const info = TOOL_INFO[tool as AIToolType]
                    const percentage = statistics.totalTasks > 0
                      ? (count / statistics.totalTasks) * 100
                      : 0
                    return (
                      <div key={tool} className="flex items-center gap-3">
                        <span className="text-lg w-8">{info.icon}</span>
                        <span className={`text-sm w-24 ${info.color}`}>{info.name}</span>
                        <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-text-secondary w-12 text-right">
                          {count}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {viewTab === 'stats' && !statistics && (
          <div className="text-center py-12 text-text-muted">
            <p>暂无统计数据</p>
          </div>
        )}
      </div>
    </div>
  )
}
