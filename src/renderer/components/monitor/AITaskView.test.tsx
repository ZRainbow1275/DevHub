import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AITask, AITaskHistory, AITaskStatistics, AIWindowAlias, TimelineEntry } from '@shared/types-extended'
import { useAITaskStore } from '../../stores/aiTaskStore'
import { useAliasStore } from '../../stores/aliasStore'
import { ToastProvider } from '../ui/Toast'
import { AITaskView } from './AITaskView'

interface TestAITaskApi {
  getAll: ReturnType<typeof vi.fn<() => Promise<AITask[]>>>
  getHistory: ReturnType<typeof vi.fn<(limit?: number) => Promise<AITaskHistory[]>>>
  getStatistics: ReturnType<typeof vi.fn<() => Promise<AITaskStatistics>>>
  getTimeline: ReturnType<typeof vi.fn<(taskId: string) => Promise<TimelineEntry[]>>>
  onStarted: ReturnType<typeof vi.fn<() => undefined>>
  onStatusChanged: ReturnType<typeof vi.fn<() => undefined>>
  onCompleted: ReturnType<typeof vi.fn<() => undefined>>
}

interface TestAIAliasApi {
  getAll: ReturnType<typeof vi.fn<() => Promise<AIWindowAlias[]>>>
  set: ReturnType<typeof vi.fn<(alias: AIWindowAlias) => Promise<boolean>>>
  remove: ReturnType<typeof vi.fn<(aliasId: string) => Promise<boolean>>>
  rename: ReturnType<typeof vi.fn<(aliasId: string, newName: string) => Promise<boolean>>>
}

interface TestDevhubApi {
  aiTask: TestAITaskApi
  aiAlias: TestAIAliasApi
}

function devhubApi(): TestDevhubApi {
  return window.devhub as unknown as TestDevhubApi
}

function createTask(index: number): AITask {
  const now = Date.now()
  const toolTypes: AITask['toolType'][] = ['codex', 'claude-code', 'gemini-cli', 'cursor']
  return {
    id: `task-${index}`,
    toolType: toolTypes[index % toolTypes.length],
    pid: 4100 + index,
    windowHwnd: 9000 + index,
    startTime: now - (60_000 + index * 1000),
    status: {
      state: 'running',
      phase: 'coding',
      phaseLabel: '编码中',
      currentAction: `处理第 ${index} 个真实任务`,
      lastActivity: now - 5000,
      progressEstimate: {
        percentage: Math.min(95, 20 + index),
        phase: 'coding',
        phaseLabel: '编码中',
        elapsed: 60_000,
        estimatedRemaining: 30_000,
        confidence: 0.95
      }
    },
    monitorState: 'coding',
    alias: `AI 任务 ${index}`,
    metrics: {
      cpuHistory: [1, 3 + index, 2 + index],
      outputLineCount: 100 + index,
      lastOutputTime: now - 2000,
      idleDuration: 0,
      outputRate: 512 + index
    },
    detectionSignals: {
      completionScore: 0.35,
      phaseConfidence: 0.91,
      activeIndicators: ['cli_parse'],
      inConfirmationWindow: false
    }
  }
}

const timeline: TimelineEntry[] = [
  {
    timestamp: new Date(Date.now() - 120_000).toISOString(),
    status: 'thinking',
    monitorState: 'thinking',
    duration: 30,
    detail: '读取上下文'
  },
  {
    timestamp: new Date(Date.now() - 90_000).toISOString(),
    status: 'coding',
    monitorState: 'coding',
    duration: 90,
    detail: '执行真实任务'
  }
]

const statistics: AITaskStatistics = {
  totalTasks: 12,
  completedTasks: 8,
  errorTasks: 1,
  avgDuration: 120_000,
  byTool: {
    codex: 4,
    'claude-code': 3,
    'gemini-cli': 3,
    cursor: 2,
    opencode: 0,
    aider: 0,
    windsurf: 0,
    'continue-dev': 0,
    cline: 0,
    other: 0
  }
}

function installAiTaskBridge(tasks: AITask[]) {
  devhubApi().aiTask = {
    getAll: vi.fn(async () => tasks),
    getHistory: vi.fn(async () => []),
    getStatistics: vi.fn(async () => statistics),
    getTimeline: vi.fn(async () => timeline),
    onStarted: vi.fn(() => undefined),
    onStatusChanged: vi.fn(() => undefined),
    onCompleted: vi.fn(() => undefined)
  }
  devhubApi().aiAlias = {
    getAll: vi.fn(async () => []),
    set: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    rename: vi.fn(async () => true)
  }
}

function renderAITaskView(tasks: AITask[]) {
  installAiTaskBridge(tasks)
  render(
    <ToastProvider>
      <AITaskView />
    </ToastProvider>
  )
}

beforeEach(() => {
  useAITaskStore.setState({
    activeTasks: [],
    history: [],
    statistics: null,
    selectedTaskId: null,
    detectionConfigs: {}
  })
  useAliasStore.setState({ aliases: [] })
  vi.useRealTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AITaskView monitor views', () => {
  it('renders twelve real-shaped active tasks across card, list, and detail views', async () => {
    renderAITaskView(Array.from({ length: 12 }, (_, index) => createTask(index + 1)))

    expect(await screen.findByText('12 个活跃任务')).toBeInTheDocument()
    expect(await screen.findAllByTestId('ai-task-card')).toHaveLength(12)

    fireEvent.click(screen.getByTestId('ai-task-view-mode-list'))
    const listView = await screen.findByTestId('ai-task-list-view')
    expect(within(listView).getAllByTestId(/^ai-task-list-row-/)).toHaveLength(12)

    fireEvent.click(screen.getByTestId('ai-task-list-row-task-3'))
    fireEvent.click(screen.getByTestId('ai-task-view-mode-detail'))

    const detail = await screen.findByTestId('ai-task-detail-panel')
    expect(detail).toHaveAttribute('data-task-id', 'task-3')
    expect(detail).toHaveAttribute('data-view-kind', 'detail')
    expect(detail).toHaveTextContent('PID：4103')
    expect(detail).toHaveTextContent('输出行数：103')
  })

  it('opens the timeline as a gantt-style phase bar from a task card', async () => {
    renderAITaskView([createTask(1)])

    const card = await screen.findByTestId('ai-task-card')
    fireEvent.click(within(card).getByRole('button', { name: 'Timeline' }))

    const timelineRoot = await screen.findByTestId('ai-progress-timeline')
    expect(timelineRoot).toHaveAttribute('data-timeline-states', 'thinking,coding')
    expect(screen.getByTestId('ai-progress-gantt-phasebar')).toHaveAttribute('data-phase-count', '2')

    await waitFor(() => expect(devhubApi().aiTask.getTimeline).toHaveBeenCalledWith('task-1'))
  })
})
