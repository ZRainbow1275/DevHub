import { useEffect, memo, useState, useCallback, useMemo } from 'react'
import { useAITasks } from '../../hooks/useAITasks'
import { useAliasStore } from '../../stores/aliasStore'
import { useToast } from '../ui/Toast'
import { useT } from '../../hooks/useT'
import { AITask, AITaskHistory, AIToolType, AIWindowAlias } from '@shared/types-extended'
import { assertProgressInvariant, deriveProgress, toDerivableProgressState, type DerivableProgressState, type DerivedProgress } from '@shared/detection/derive-progress'
import { AIWindowAliasEditor } from './AIWindowAlias'
import { AIProgressTimeline } from './AIProgressTimeline'
import { ProgressBar } from './ai-task/ProgressBar'
import { formatDuration, formatDurationCN } from '../../utils/formatDuration'
import { AIToolBrandLogo } from '../icons/AIToolBrandLogo'
import { AIIcon, RefreshIcon, LightningIcon, CheckIcon, AlertIcon, ClockIcon } from '../icons'
import { StatCard } from '../ui/StatCard'
import { PanelDetachButton } from '../popout/PanelDetachButton'
import type { DetachableViewProps } from '../popout/detachable-registry'

const TOOL_INFO: Record<AIToolType, { name: string; accentClass: string }> = {
  'codex': { name: 'Codex', accentClass: 'text-green-400' },
  'claude-code': { name: 'Claude Code', accentClass: 'text-orange-400' },
  'gemini-cli': { name: 'Gemini CLI', accentClass: 'text-blue-400' },
  'cursor': { name: 'Cursor', accentClass: 'text-purple-400' },
  'opencode': { name: 'OpenCode', accentClass: 'text-cyan-400' },
  'aider': { name: 'Aider', accentClass: 'text-emerald-400' },
  'windsurf': { name: 'Windsurf', accentClass: 'text-teal-400' },
  'continue-dev': { name: 'Continue', accentClass: 'text-indigo-400' },
  'cline': { name: 'Cline', accentClass: 'text-rose-400' },
  'other': { name: 'Other', accentClass: 'text-gray-400' }
}

const STATE_INFO: Record<DerivableProgressState, { label: string; color: string; bgColor: string }> = {
  'initializing': { label: '初始化', color: 'text-info', bgColor: 'bg-info/10' },
  'thinking': { label: '思考中', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  'receiving-input': { label: '接收输入', color: 'text-info', bgColor: 'bg-info/10' },
  'coding': { label: '编码中', color: 'text-green-400', bgColor: 'bg-green-500/10' },
  'compiling': { label: '编译中', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  'validating': { label: '确认中', color: 'text-info', bgColor: 'bg-info/10' },
  'waiting-input': { label: '等待输入', color: 'text-warning', bgColor: 'bg-warning/10' },
  'awaiting-human': { label: '等待人工', color: 'text-warning', bgColor: 'bg-warning/10' },
  'stuck': { label: '疑似卡死', color: 'text-warning', bgColor: 'bg-warning/10' },
  'completed': { label: '已完成', color: 'text-accent-300', bgColor: 'bg-accent/10' },
  'error': { label: '错误', color: 'text-error', bgColor: 'bg-error/10' },
  'idle': { label: '空闲', color: 'text-text-muted', bgColor: 'bg-surface-700' }
}

type AITaskActiveViewMode = 'cards' | 'list' | 'detail'

const ACTIVE_VIEW_MODES: Array<{ mode: AITaskActiveViewMode; label: string }> = [
  { mode: 'cards', label: '卡片' },
  { mode: 'list', label: '列表' },
  { mode: 'detail', label: '详情' }
]

function resolveProgressState(task: Pick<AITask, 'monitorState' | 'status'>): DerivableProgressState {
  return toDerivableProgressState(task.status.state, task.status.phase, task.monitorState)
}

function getEstimatedTotalMs(task: AITask): number | undefined {
  const estimate = task.status.progressEstimate
  if (!estimate) {
    return undefined
  }

  if (
    typeof estimate.elapsed !== 'number' ||
    !Number.isFinite(estimate.elapsed) ||
    estimate.elapsed < 0
  ) {
    return undefined
  }

  if (
    typeof estimate.estimatedRemaining !== 'number' ||
    !Number.isFinite(estimate.estimatedRemaining) ||
    estimate.estimatedRemaining < 0
  ) {
    return undefined
  }

  return estimate.elapsed + estimate.estimatedRemaining
}

function getExplicitProgressPercentage(task: AITask): number | undefined {
  const estimate = task.status.progressEstimate
  if (!estimate) {
    return undefined
  }

  if (estimate.percentage === 0 || estimate.confidence >= 0.9) {
    return estimate.percentage
  }

  return undefined
}

function getDerivedProgress(
  state: DerivableProgressState,
  task: AITask,
  elapsedMs: number,
): DerivedProgress {
  const derived = deriveProgress(state, {
    elapsedMs,
    estimatedTotalMs: getEstimatedTotalMs(task),
    explicitPercentage: getExplicitProgressPercentage(task),
    confidence: task.status.progressEstimate?.confidence ?? task.detectionSignals?.phaseConfidence,
  })

  assertProgressInvariant(state, derived)
  return derived
}

interface TaskListRowProps {
  task: AITask
  isSelected: boolean
  onSelect: () => void
  existingAlias?: AIWindowAlias
}

const TaskListRow = memo(function TaskListRow({ task, isSelected, onSelect, existingAlias }: TaskListRowProps) {
  const toolInfo = TOOL_INFO[task.toolType]
  const progressState = resolveProgressState(task)
  const stateInfo = STATE_INFO[progressState]
  const displayAlias = task.alias || existingAlias?.alias || toolInfo.name
  const derivedProgress = getDerivedProgress(progressState, task, Math.max(0, Date.now() - task.startTime))

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      data-testid={`ai-task-list-row-${task.id}`}
      data-view-kind="list"
      data-state={progressState}
      className={`
        grid w-full grid-cols-[minmax(0,1.4fr)_110px_90px_120px] items-center gap-3
        radius-md border px-3 py-2 text-left transition-colors
        ${isSelected
          ? 'border-accent/50 bg-surface-700'
          : 'border-surface-700 bg-surface-800 hover:border-surface-600'
        }
      `}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-text-primary">{displayAlias}</span>
        <span className="block truncate text-xs text-text-muted">{toolInfo.name} / PID {task.pid}</span>
      </span>
      <span className={`justify-self-start rounded px-2 py-0.5 text-xs ${stateInfo.bgColor} ${stateInfo.color}`}>
        {stateInfo.label}
      </span>
      <span className="text-xs font-mono text-text-secondary">
        {derivedProgress.percentage == null ? '--' : `${Math.round(derivedProgress.percentage)}%`}
      </span>
      <span className="text-xs text-text-muted">
        输出 {task.metrics.outputLineCount} 行
      </span>
    </button>
  )
})

interface TaskDetailPanelProps {
  task: AITask
  onSaveAlias: (alias: AIWindowAlias) => void
  existingAlias?: AIWindowAlias
}

const TaskDetailPanel = memo(function TaskDetailPanel({ task, onSaveAlias, existingAlias }: TaskDetailPanelProps) {
  const toolInfo = TOOL_INFO[task.toolType]
  const progressState = resolveProgressState(task)
  const stateInfo = STATE_INFO[progressState]
  const displayAlias = task.alias || existingAlias?.alias || toolInfo.name
  const derivedProgress = getDerivedProgress(progressState, task, Math.max(0, Date.now() - task.startTime))
  const estimatedRemaining = task.status.progressEstimate?.estimatedRemaining
  const estimatedRemainingLabel = derivedProgress.mode === 'determinate' &&
    derivedProgress.percentage != null &&
    derivedProgress.percentage < 100 &&
    estimatedRemaining != null &&
    estimatedRemaining > 0
    ? `~${formatDuration(estimatedRemaining)}`
    : undefined

  return (
    <section
      className="space-y-4 radius-md border border-surface-700 bg-surface-800 p-4"
      data-testid="ai-task-detail-panel"
      data-task-id={task.id}
      data-view-kind="detail"
      data-state={progressState}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AIToolBrandLogo toolType={task.toolType} title={toolInfo.name} size={20} />
            <h3 className="truncate text-sm font-semibold text-text-primary">{displayAlias}</h3>
            <span className={`rounded px-2 py-0.5 text-xs ${stateInfo.bgColor} ${stateInfo.color}`}>
              {stateInfo.label}
            </span>
          </div>
          <div className="mt-2 grid gap-1 text-xs text-text-muted sm:grid-cols-2">
            <span>工具：{toolInfo.name}</span>
            <span>PID：{task.pid}</span>
            <span>窗口：{task.windowHwnd ?? '未绑定'}</span>
            <span>输出行数：{task.metrics.outputLineCount}</span>
            <span>当前动作：{task.status.currentAction ?? task.status.phaseLabel ?? '未报告'}</span>
            <span>最近活动：{formatDuration(Math.max(0, Date.now() - task.status.lastActivity))} 前</span>
          </div>
        </div>
        <AIWindowAliasEditor
          task={task}
          existingAlias={existingAlias}
          onSave={onSaveAlias}
          onCancel={() => undefined}
        />
      </div>

      <ProgressBar
        derived={derivedProgress}
        estimatedRemainingLabel={estimatedRemainingLabel}
        state={progressState}
      />

      <AIProgressTimeline
        taskId={task.id}
        taskAlias={displayAlias}
        cpuHistory={task.metrics.cpuHistory}
      />
    </section>
  )
})

interface TaskCardProps {
  task: AITask
  isSelected: boolean
  onSelect: () => void
  onSaveAlias: (alias: AIWindowAlias) => void
  existingAlias?: AIWindowAlias
}

const TaskCard = memo(function TaskCard({ task, isSelected, onSelect, onSaveAlias, existingAlias }: TaskCardProps) {
  const { t } = useT()
  const toolInfo = TOOL_INFO[task.toolType]
  const [now, setNow] = useState(Date.now())
  const [isEditingAlias, setIsEditingAlias] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const progressState = resolveProgressState(task)
  const stateInfo = STATE_INFO[progressState]

  useEffect(() => {
    if (progressState === 'idle' || progressState === 'completed' || progressState === 'error') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [progressState])

  const duration = Math.max(0, now - task.startTime)

  const avgCpu = task.metrics.cpuHistory.length > 0
    ? task.metrics.cpuHistory.reduce((a, b) => a + b, 0) / task.metrics.cpuHistory.length
    : 0

  const displayAlias = task.alias || existingAlias?.alias
  const aliasColor = task.aliasColor || existingAlias?.color
  const derivedProgress = getDerivedProgress(progressState, task, duration)
  const shouldShowProgress = derivedProgress.mode !== 'hidden'
  const isActiveState = progressState === 'initializing' || progressState === 'thinking' || progressState === 'receiving-input' || progressState === 'coding' || progressState === 'compiling' || progressState === 'validating'
  const estimatedRemaining = task.status.progressEstimate?.estimatedRemaining
  const shouldShowEta = derivedProgress.mode === 'determinate' &&
    derivedProgress.percentage != null &&
    derivedProgress.percentage < 100 &&
    estimatedRemaining != null &&
    estimatedRemaining > 0
  const progressFillStyle = aliasColor && derivedProgress.accentColor === 'active'
    ? { backgroundColor: aliasColor }
    : undefined
  const estimatedRemainingLabel = shouldShowEta ? `~${formatDuration(estimatedRemaining)}` : undefined

  return (
    <div
      onClick={onSelect}
      data-testid="ai-task-card"
      data-state={progressState}
      data-progress-mode={derivedProgress.mode}
      data-progress-pct={derivedProgress.percentage ?? ''}
      className={`
        group monitor-card cursor-pointer border-l-3
        ${isSelected
          ? 'border-l-accent bg-surface-750'
          : 'border-l-blue-500'
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center radius-sm border border-surface-600 bg-surface-800"
            title={toolInfo.name}
          >
            <AIToolBrandLogo toolType={task.toolType} title={toolInfo.name} size={20} />
          </div>
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
                <span className={`text-sm font-semibold ${toolInfo.accentClass}`}>
                  {toolInfo.name}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded ${stateInfo.bgColor} ${stateInfo.color}`}>
                {stateInfo.label}
              </span>
              {task.status.phaseLabel && shouldShowProgress && (
                <span className="text-xs px-2 py-0.5 rounded bg-surface-700 text-text-secondary">
                  {task.status.phaseLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
              <span>PID: {task.pid}</span>
              <span>运行时间: {formatDuration(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={showTimeline ? 'Hide Timeline' : 'Timeline'}
            onClick={(e) => {
              e.stopPropagation()
              setShowTimeline(!showTimeline)
            }}
            className="px-2 py-1 text-xs text-text-muted hover:text-text-primary
                       hover:bg-surface-600 rounded transition-colors opacity-0 group-hover:opacity-100"
            title={t('monitor.aiTask.progressTimeline', 'Progress Timeline')}
          >
            {showTimeline ? t('monitor.aiTask.hideTimeline', 'Hide Timeline') : t('monitor.aiTask.timeline', 'Timeline')}
          </button>
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
            {isActiveState && (
              <div className="flex items-center gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                <span className="text-xs text-success">活跃</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProgressBar
        derived={derivedProgress}
        estimatedRemainingLabel={estimatedRemainingLabel}
        fillStyle={progressFillStyle}
        state={progressState}
      />

      {/* Alias color indicator bar (only when no progress bar) */}
      {aliasColor && !shouldShowProgress && (
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

      {/* Progress Timeline */}
      {showTimeline && (
        <div className="mt-3">
          <AIProgressTimeline
            taskId={task.id}
            taskAlias={displayAlias}
          />
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
    <div className="p-3 bg-surface-800 radius-md border border-transparent hover:border-surface-600 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center radius-sm border border-surface-600 bg-surface-800">
            <AIToolBrandLogo toolType={entry.toolType} title={toolInfo.name} size={16} />
          </div>
          <div>
            <span className={`text-sm font-medium ${toolInfo.accentClass}`}>
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

export function AITaskView({ initialTarget }: DetachableViewProps = {}) {
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

  // Hydrate the focused task from a detach target (ai-task-detail popout / drawer)
  // once on mount, reusing the existing aiTaskStore selection.
  useEffect(() => {
    if (initialTarget?.kind !== 'taskId') return
    if (initialTarget.value) selectTask(initialTarget.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { aliases, fetchAliases, saveAlias } = useAliasStore()
  const { showToast } = useToast()
  const [viewTab, setViewTab] = useState<'active' | 'history' | 'stats'>('active')
  const [activeViewMode, setActiveViewMode] = useState<AITaskActiveViewMode>('cards')

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

  const selectedActiveTask = useMemo(() => (
    activeTasks.find((task) => task.id === selectedTaskId) ?? activeTasks[0] ?? null
  ), [activeTasks, selectedTaskId])

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
    <div className="h-full min-h-0 flex flex-col bg-surface-950" data-testid="ai-task-view">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b-2 border-surface-700 bg-surface-900 relative">
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
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
            <div className="flex items-center bg-surface-800 radius-md p-0.5">
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
              <RefreshIcon size={16} />
            </button>

            <PanelDetachButton
              surface="ai-task-detail"
              target={selectedActiveTask ? `taskId:${selectedActiveTask.id}` : null}
              testId="ai-task-detail-detach-popout"
            />
          </div>
        </div>
      </div>

      {/* Hero Stats — overview cards aligned with Process/Port/Window hero rhythm */}
      <div className="flex-shrink-0 px-5 py-3 stat-grid border-b border-surface-700/50 bg-surface-900/50">
        <StatCard
          compact
          icon={<LightningIcon size={16} className="text-info" />}
          label="活跃任务"
          value={activeTasks.length}
          color="info"
        />
        <StatCard
          compact
          icon={<CheckIcon size={16} className="text-success" />}
          label="已完成"
          value={statistics?.completedTasks ?? 0}
          color="success"
        />
        <StatCard
          compact
          icon={<AlertIcon size={16} className="text-error" />}
          label="错误"
          value={statistics?.errorTasks ?? 0}
          color={statistics && statistics.errorTasks > 0 ? 'error' : 'default'}
        />
        <StatCard
          compact
          icon={<ClockIcon size={16} className="text-steel" />}
          label="平均时长"
          value={statistics ? formatDurationCN(statistics.avgDuration) : '--'}
          color="steel"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {viewTab === 'active' && (
          <div className="space-y-3">
            {activeTasks.length > 0 && (
              <div
                className="flex items-center justify-between radius-md border border-surface-700 bg-surface-900 px-3 py-2"
                data-testid="ai-task-active-view-switcher"
              >
                <span className="text-xs text-text-muted">活动任务视图</span>
                <div className="flex items-center gap-1">
                  {ACTIVE_VIEW_MODES.map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setActiveViewMode(mode)}
                      data-testid={`ai-task-view-mode-${mode}`}
                      aria-pressed={activeViewMode === mode}
                      className={`rounded px-2 py-1 text-xs transition-colors ${
                        activeViewMode === mode
                          ? 'bg-surface-700 text-text-primary'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTasks.length > 0 && activeViewMode === 'cards' && activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  onSelect={() => selectTask(task.id)}
                  onSaveAlias={handleSaveAlias}
                  existingAlias={findAliasForTask(task)}
                />
              ))}

            {activeTasks.length > 0 && activeViewMode === 'list' && (
              <div className="space-y-2" data-testid="ai-task-list-view" data-view-kind="list">
                {activeTasks.map((task) => (
                  <TaskListRow
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onSelect={() => selectTask(task.id)}
                    existingAlias={findAliasForTask(task)}
                  />
                ))}
              </div>
            )}

            {activeTasks.length > 0 && activeViewMode === 'detail' && selectedActiveTask && (
              <TaskDetailPanel
                task={selectedActiveTask}
                onSaveAlias={handleSaveAlias}
                existingAlias={findAliasForTask(selectedActiveTask)}
              />
            )}

            {activeTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-text-muted">
                <span className="mb-3 inline-flex h-12 w-12 items-center justify-center radius-sm border-l-3 border-accent bg-surface-800">
                  <AIIcon className="text-text-muted" size={24} />
                </span>
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
              <div className="text-center py-16 text-text-muted">
                <p>暂无任务历史</p>
              </div>
            )}
          </div>
        )}

        {viewTab === 'stats' && statistics && (
          <div className="space-y-4">
            {/* Overview Cards */}
            <div className="stat-grid">
              <StatCard
                compact
                icon={<AIIcon size={16} className="text-info" />}
                label="总任务数"
                value={statistics.totalTasks}
                color="info"
              />
              <StatCard
                compact
                icon={<CheckIcon size={16} className="text-success" />}
                label="已完成"
                value={statistics.completedTasks}
                color="success"
              />
              <StatCard
                compact
                icon={<AlertIcon size={16} className="text-error" />}
                label="错误"
                value={statistics.errorTasks}
                color={statistics.errorTasks > 0 ? 'error' : 'default'}
              />
              <StatCard
                compact
                icon={<ClockIcon size={16} className="text-steel" />}
                label="平均时长"
                value={formatDurationCN(statistics.avgDuration)}
                color="steel"
              />
            </div>

            {/* By Tool */}
            <div className="bg-surface-800 radius-md p-4">
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
                        <div className="flex h-8 w-8 items-center justify-center radius-sm border border-surface-600 bg-surface-800">
                          <AIToolBrandLogo toolType={tool as AIToolType} title={info.name} size={16} />
                        </div>
                        <span className={`text-sm w-24 ${info.accentClass}`}>{info.name}</span>
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
          <div className="text-center py-16 text-text-muted">
            <p>暂无统计数据</p>
          </div>
        )}
      </div>
    </div>
  )
}
