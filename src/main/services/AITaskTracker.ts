import { EventEmitter } from 'events'
import {
  AITask,
  AITaskHistory,
  AIToolType,
  AITaskState,
  AITaskPhase,
  AIMonitorState,
  PhaseSignals,
  ProgressEstimate,
  ConfidenceReport,
  AICompletionOracleEvent,
  AICompletionOracleRecord,
  SignalContribution,
  CalibrationResult,
  CalibrationSample,
  StateTransition,
  ToolProfile,
  PHASE_LABELS,
  AI_TOOL_SIGNATURES,
  AIToolDetectionConfig,
  DEFAULT_AI_TOOL_CONFIGS,
  ProcessInfo,
  WindowInfo,
  TimelineEntry
} from '@shared/types-extended'
import type { CliOutputEvent } from '@shared/schemas/r8-runtime'
import { SystemProcessScanner } from './SystemProcessScanner'
import { AIAliasManager } from './AIAliasManager'
import { PowerShellGateway, getPowerShellGateway } from './runtime/PowerShellGateway'
import { CalibrationSampleStore } from './detection/CalibrationSampleStore'
import { buildConfidenceReport, rebalanceWeightsFromCalibration } from './detection/ConfidenceEngine'
import {
  calculateVariance,
  classifyMissingProcessExit,
  deriveMonitorState,
  deriveTaskState,
  shouldCancelConfirmation,
  stabilizeStateTransition,
  type StateDebounceCandidate
} from './detection/CompletionStateMachine'
import { collectDetectionSignals } from './detection/SignalCollector'
import { makeTaskKey, withCollisionSuffix } from './detection/TaskKey'
import type { CLIOutputParser } from './cli-parser'

// 安全验证: 确保 hwnd 是有效的整数
function validateHwnd(hwnd: number): boolean {
  return Number.isInteger(hwnd) && hwnd > 0 && hwnd <= Number.MAX_SAFE_INTEGER
}

function taskStateForMonitorState(state: AIMonitorState): AITaskState {
  switch (state) {
    case 'idle':
    case 'completed':
    case 'error':
      return state
    case 'thinking':
    case 'coding':
    case 'compiling':
      return state
    case 'initializing':
    case 'receiving-input':
    case 'validating':
      return 'running'
    case 'waiting-input':
    case 'awaiting-human':
    case 'stuck':
      return 'waiting'
  }
}

function phaseForMonitorState(state: AIMonitorState): AITaskPhase {
  switch (state) {
    case 'initializing':
      return 'initializing'
    case 'idle':
    case 'completed':
      return 'completed'
    case 'thinking':
    case 'receiving-input':
      return 'thinking'
    case 'coding':
      return 'coding'
    case 'compiling':
    case 'validating':
    case 'waiting-input':
    case 'awaiting-human':
      return 'validating'
    case 'stuck':
    case 'error':
      return 'error'
  }
}

function progressPercentageForMonitorState(state: AIMonitorState): number {
  switch (state) {
    case 'initializing':
      return 8
    case 'idle':
      return 0
    case 'thinking':
      return 30
    case 'receiving-input':
      return 24
    case 'coding':
      return 68
    case 'compiling':
      return 78
    case 'validating':
      return 92
    case 'waiting-input':
    case 'awaiting-human':
      return 98
    case 'stuck':
      return 99
    case 'completed':
    case 'error':
      return 100
  }
}

function cpuHistoryForMonitorState(state: AIMonitorState): number[] {
  switch (state) {
    case 'idle':
    case 'initializing':
    case 'receiving-input':
    case 'waiting-input':
    case 'awaiting-human':
    case 'stuck':
    case 'completed':
    case 'error':
      return [0, 0, 0, 0, 0]
    case 'thinking':
      return [24, 24, 24, 24, 24]
    case 'coding':
      return [8, 16, 11, 19, 13]
    case 'compiling':
    case 'validating':
      return [54, 66, 58, 72, 61]
  }
}

// 完成指示模式 - 用于检测终端窗口标题
const COMPLETION_PATTERNS = [
  /done\s+in\s+[\d.]+\s*[ms]/i,
  /build\s+complete/i,
  /compilation\s+successful/i,
  /\u2713\s+done/i,
  /\u2714/u,
  /finished\s+in\s+[\d.]+/i,
  /completed\s+successfully/i,
  /task\s+complete/i,
  /waiting\s+for\s+input/i,
  // Claude Code 专有模式
  /^\s*>\s*$/m,
  /Welcome to Claude Code/i,
  // Codex 专有模式
  /codex>\s*$/m,
  /Ready/,
  // Gemini 专有模式
  /gemini>\s*$/m,
]

// 错误指示模式
const ERROR_PATTERNS = [
  /error:/i,
  /failed/i,
  /exception/i,
  /fatal/i,
  /crash/i,
  /panic/i,
  /\u2717/u,
  /\u2718/u,
]

// 提示符模式 - 终端等待输入的标志
const PROMPT_PATTERNS = [
  /^\s*[>$%#]\s*$/m,
  /^\s*[\u276f]\s*$/mu,
  /^\s*>>>\s*$/m,
]

// 编译/测试命令模式
const COMPILE_PATTERNS = /\b(tsc|vite|webpack|npm\s+run|pnpm|pytest|jest|cargo\s+build|go\s+build|mvn|gradle|make|cmake)\b/i

interface AITaskDetectionConfig {
  outputPatternWeight: number
  cpuIdleWeight: number
  cursorWaitWeight: number
  timeThresholdWeight: number
  promptDetectionWeight: number
  childProcessWeight: number
  idleThresholdMs: number
  completionThreshold: number
  confirmationWindowMs: number
}

/** Tracks pending completion confirmation for a task */
interface ConfirmationTimer {
  timer: NodeJS.Timeout
  startedAt: number
}

interface ChildProcessEvidence {
  hadChildren: boolean
  lastExitAt?: number
}

interface MissingProcessEvidence {
  missingSince: number
}

type CliEventSource = Pick<CLIOutputParser, 'subscribe'>

interface CliParseSignalCache {
  instanceId: string
  progress: number
  confidence: number
  observedAt: number
  line: string
  phase: CliOutputEvent['phase']
  eventType?: CliOutputEvent['eventType']
  rawSource?: CliOutputEvent['rawSource']
}

const CLI_PARSE_SIGNAL_WEIGHT = 0.8
const CLI_PARSE_STALE_MS = 30_000
const STATE_FLIP_DEBOUNCE_MS = 750
const STATE_FLIP_MIN_OBSERVATIONS = 2
const IMMEDIATE_TASK_STATES = new Set<AITaskState>(['completed', 'error'])
const IMMEDIATE_MONITOR_STATES = new Set<AIMonitorState>(['completed', 'error', 'stuck'])

function cliToolMatchesTask(tool: CliOutputEvent['tool'], taskTool: AIToolType): boolean {
  if (tool === 'claude') return taskTool === 'claude-code'
  if (tool === 'gemini') return taskTool === 'gemini-cli'
  if (tool === 'codex' || tool === 'cursor') return taskTool === tool
  return false
}

export class AITaskTracker extends EventEmitter {
  private readonly powerShellGateway: PowerShellGateway
  private tasks = new Map<string, AITask>()
  private history: AITaskHistory[] = []
  private processScanner: SystemProcessScanner
  private aliasManager: AIAliasManager
  private refreshInterval: number = 2000
  private refreshTimer: NodeJS.Timeout | null = null
  private windowScannerFn: (() => Promise<WindowInfo[]>) | null = null
  private timelines = new Map<string, TimelineEntry[]>()
  /** Per-tool detection configs (user adjustable) */
  private toolConfigs = new Map<AIToolType, AIToolDetectionConfig>()
  /** Pending completion confirmation timers */
  private confirmationTimers = new Map<string, ConfirmationTimer>()
  /** False positive tracking for dynamic threshold adjustment */
  private falsePositiveCount = 0
  /** Auto-name counter per tool type for this session */
  private autoNameCounters = new Map<AIToolType, number>()
  /** Previous I/O write bytes per PID for Signal 3 output rate calculation */
  private _previousIOCounters = new Map<number, { writeBytes: number; timestamp: number }>()
  /** Previous child PIDs per taskId for Signal 5 child process exit detection */
  private _prevChildPids = new Map<string, Set<number>>()
  /** Child process evidence separates "never had children" from "children exited" */
  private _childProcessEvidence = new Map<string, ChildProcessEvidence>()
  /** Missing PID grace window prevents transient scanner gaps from finalizing tasks */
  private _missingProcessEvidence = new Map<string, MissingProcessEvidence>()
  /** Pending state candidates prevent single-sample task/UI flapping. */
  private _taskStateDebounce = new Map<string, StateDebounceCandidate<AITaskState>>()
  private _monitorStateDebounce = new Map<string, StateDebounceCandidate<AIMonitorState>>()
  /** Real CLI parser progress keyed by task id / alias / instance id. */
  private _cliParseSignals = new Map<string, CliParseSignalCache>()
  private _cliEventUnsubscribe: (() => void) | null = null
  /** Persistent real calibration samples collected from bench/manual/runtime evidence */
  private calibrationStore = new CalibrationSampleStore()
  /** Real external completion oracle reports keyed by history id/session id. */
  private oracleConfidenceReports = new Map<string, ConfidenceReport>()
  /** Refresh cycle counter for throttling expensive operations */
  private _refreshCycleCount = 0
  private config: AITaskDetectionConfig = {
    outputPatternWeight: 0.20,
    cpuIdleWeight: 0.25,
    cursorWaitWeight: 0.20,
    timeThresholdWeight: 0.10,
    promptDetectionWeight: 0.25,
    childProcessWeight: 0.10,
    idleThresholdMs: 5000,
    completionThreshold: 0.80,
    confirmationWindowMs: 8000
  }

  constructor(
    processScanner: SystemProcessScanner,
    aliasManager?: AIAliasManager,
    powerShellGateway: PowerShellGateway = getPowerShellGateway()
  ) {
    super()
    this.setMaxListeners(20)
    this.processScanner = processScanner
    this.aliasManager = aliasManager ?? new AIAliasManager()
    this.powerShellGateway = powerShellGateway

    // Initialize default per-tool configs
    for (const [toolType, config] of Object.entries(DEFAULT_AI_TOOL_CONFIGS)) {
      this.toolConfigs.set(toolType as AIToolType, { ...config })
    }
  }

  getAliasManager(): AIAliasManager {
    return this.aliasManager
  }

  subscribeToCliOutputParser(source: CliEventSource): () => void {
    if (this._cliEventUnsubscribe) {
      this._cliEventUnsubscribe()
      this._cliEventUnsubscribe = null
    }

    const unsubscribe = source.subscribe(events => {
      for (const event of events) {
        this.ingestCliOutputEvent(event)
      }
    })
    this._cliEventUnsubscribe = unsubscribe
    return () => {
      if (this._cliEventUnsubscribe === unsubscribe) {
        this._cliEventUnsubscribe = null
      }
      unsubscribe()
    }
  }

  ingestCliOutputEvent(event: CliOutputEvent): AITask | null {
    const signal = this.toCliParseSignal(event)
    if (!signal) return null

    this.rememberCliParseSignal(signal.instanceId, signal)
    const task = this.findTaskForCliEvent(event)
    if (!task) return null

    this.rememberCliParseSignal(task.id, signal)
    if (task.alias) this.rememberCliParseSignal(task.alias, signal)
    this.rememberCliParseSignal(String(task.pid), signal)
    this.applyCliParseSignal(task, signal)
    return task
  }

  private async executePowerShell(
    script: string,
    options?: {
      label?: string
      timeoutMs?: number
    }
  ): Promise<string> {
    return this.powerShellGateway.execute(script, {
      label: options?.label ?? 'AITaskTracker',
      timeoutMs: options?.timeoutMs
    })
  }

  private toCliParseSignal(event: CliOutputEvent): CliParseSignalCache | null {
    const instanceId = event.instanceId?.trim()
    if (!instanceId) return null
    const progress = event.progress ?? (event.phase === 'completed' || event.eventType === 'completion' ? 1 : null)
    if (progress === null) return null
    return {
      instanceId,
      progress: Math.max(0, Math.min(1, progress)),
      confidence: Math.max(0, Math.min(1, event.confidence)),
      observedAt: event.observedAt,
      line: event.line,
      phase: event.phase,
      eventType: event.eventType,
      rawSource: event.rawSource
    }
  }

  private rememberCliParseSignal(key: string, signal: CliParseSignalCache): void {
    const normalizedKey = key.trim()
    if (!normalizedKey) return
    this._cliParseSignals.set(normalizedKey, signal)
  }

  private findTaskForCliEvent(event: CliOutputEvent): AITask | null {
    const candidates = new Set<string>()
    if (event.instanceId) candidates.add(event.instanceId)
    if (event.sessionId) candidates.add(event.sessionId)
    const payload = event.payload as Record<string, unknown> | undefined
    const payloadPid = payload?.pid
    if (typeof payloadPid === 'number' && Number.isFinite(payloadPid)) candidates.add(String(Math.trunc(payloadPid)))
    const payloadTaskId = payload?.taskId
    if (typeof payloadTaskId === 'string') candidates.add(payloadTaskId)
    const payloadAlias = payload?.alias
    if (typeof payloadAlias === 'string') candidates.add(payloadAlias)

    for (const task of this.tasks.values()) {
      if (candidates.has(task.id) || candidates.has(String(task.pid)) || (task.alias ? candidates.has(task.alias) : false)) {
        return task
      }
      if (cliToolMatchesTask(event.tool, task.toolType) && candidates.has(`${event.tool}:${task.pid}`)) {
        return task
      }
    }
    return null
  }

  private cliPhaseToTaskPhase(phase: CliOutputEvent['phase']): AITaskPhase {
    switch (phase) {
      case 'idle':
      case 'thinking':
        return 'thinking'
      case 'working':
        return 'coding'
      case 'validating':
      case 'waiting-input':
        return 'validating'
      case 'completed':
        return 'completed'
      case 'error':
        return 'error'
    }
  }

  private cliPhaseToTaskState(phase: CliOutputEvent['phase']): AITaskState {
    switch (phase) {
      case 'idle':
        return 'idle'
      case 'waiting-input':
        return 'waiting'
      case 'completed':
        return 'completed'
      case 'error':
        return 'error'
      case 'thinking':
        return 'thinking'
      case 'working':
        return 'running'
      case 'validating':
        return 'running'
    }
  }

  private getCliParseSignal(task: AITask, now = Date.now()): CliParseSignalCache | undefined {
    const candidates = [task.id, task.alias, String(task.pid)].filter((value): value is string => Boolean(value))
    for (const candidate of candidates) {
      const signal = this._cliParseSignals.get(candidate)
      if (!signal) continue
      if (now - signal.observedAt > CLI_PARSE_STALE_MS) {
        this._cliParseSignals.delete(candidate)
        continue
      }
      return signal
    }
    return undefined
  }

  private applyCliParseSignal(task: AITask, signal: CliParseSignalCache): void {
    const phase = this.cliPhaseToTaskPhase(signal.phase)
    const state = this.cliPhaseToTaskState(signal.phase)
    const percentage = signal.phase === 'completed'
      ? 100
      : Math.min(99, Math.round(signal.progress * 100))
    const collected = collectDetectionSignals({
      task,
      processCpu: task.metrics.cpuHistory.at(-1) ?? 0,
      isComplete: signal.phase === 'completed' || signal.eventType === 'completion',
      hasPrompt: signal.phase === 'waiting-input',
      childProcessExited: false,
      now: signal.observedAt,
      config: this.config,
      toolConfig: this.toolConfigs.get(task.toolType),
      cliParse: {
        ...signal,
        weight: CLI_PARSE_SIGNAL_WEIGHT
      }
    })

    task.status.state = state
    task.monitorState = signal.phase === 'working' ? 'coding' : signal.phase
    task.status.phase = phase
    task.status.phaseLabel = PHASE_LABELS[phase]
    task.status.currentAction = signal.line
    task.status.lastActivity = signal.observedAt
    task.status.progressEstimate = {
      percentage,
      phase,
      phaseLabel: PHASE_LABELS[phase],
      elapsed: Math.max(0, signal.observedAt - task.startTime),
      estimatedRemaining: percentage > 0 && percentage < 100
        ? Math.max(0, Math.round((signal.observedAt - task.startTime) * ((100 - percentage) / percentage)))
        : undefined,
      confidence: signal.confidence
    }
    task.detectionSignals = {
      completionScore: collected.completionScore,
      phaseConfidence: signal.confidence,
      activeIndicators: collected.activeIndicators,
      signalContributions: collected.signalContributions,
      inConfirmationWindow: this.confirmationTimers.has(task.id),
      confirmationRemainingMs: this._getConfirmationRemaining(task.id)
    }
    this.recordTimelineEntry(task.id, state, signal.line, task.monitorState)
    this.emit('task-status-changed', task)
  }

  /** Register a function that provides the current window list (injected by aiTaskHandlers) */
  setWindowScanner(fn: () => Promise<WindowInfo[]>): void {
    this.windowScannerFn = fn
  }

  setConfig(config: Partial<AITaskDetectionConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /** Set per-tool detection config */
  setToolDetectionConfig(toolType: AIToolType, config: Partial<AIToolDetectionConfig>): void {
    const existing = this.toolConfigs.get(toolType)
    if (existing) {
      this.toolConfigs.set(toolType, { ...existing, ...config })
    }
  }

  /** Get per-tool detection config */
  getToolDetectionConfig(toolType: AIToolType): AIToolDetectionConfig | undefined {
    return this.toolConfigs.get(toolType)
  }

  /** Mark a notification as false positive -- adjusts thresholds dynamically */
  markFalsePositive(taskId: string): void {
    this.falsePositiveCount++
    // Every 3 false positives, raise the completion threshold by 0.05 (max 0.95)
    if (this.falsePositiveCount % 3 === 0) {
      this.config.completionThreshold = Math.min(0.95, this.config.completionThreshold + 0.05)
      console.warn(`AITaskTracker: raised completion threshold to ${this.config.completionThreshold} due to false positives`)
    }
    this.emit('false-positive', { taskId, totalFalsePositives: this.falsePositiveCount })
  }

  /** Generate a session-unique auto-name for an AI task */
  private generateAutoName(toolType: AIToolType): string {
    const current = (this.autoNameCounters.get(toolType) ?? 0) + 1
    this.autoNameCounters.set(toolType, current)
    return `${AIAliasManager.getToolDisplayName(toolType)}-${current}`
  }

  /**
   * Lightweight batch fetch of I/O write bytes for a set of PIDs.
   * Uses Win32_Process WMI query filtered to specific PIDs.
   */
  private async fetchIOCounters(pids: number[]): Promise<Map<number, { readBytes: number; writeBytes: number }>> {
    const result = new Map<number, { readBytes: number; writeBytes: number }>()
    if (pids.length === 0) return result

    try {
      const pidFilter = pids.map(p => `ProcessId=${Math.floor(p)}`).join(' OR ')
      const psCmd = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;Get-CimInstance Win32_Process -Filter "${pidFilter}" | Select-Object ProcessId,ReadTransferCount,WriteTransferCount | ConvertTo-Json -Depth 2`
      const stdout = await this.executePowerShell(psCmd, {
        label: 'fetch-io-counters',
        timeoutMs: 10000
      })

      const trimmed = stdout.trim()
      if (!trimmed || trimmed === 'null') return result

      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        return result
      }

      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const obj = item as Record<string, unknown>
        const pid = Number(obj.ProcessId || 0)
        if (pid > 0) {
          result.set(pid, {
            readBytes: Number(obj.ReadTransferCount || 0),
            writeBytes: Number(obj.WriteTransferCount || 0),
          })
        }
      }
    } catch (err) {
      console.warn('AITaskTracker: fetchIOCounters failed:', err instanceof Error ? err.message : err)
    }

    return result
  }

  /**
   * Get remaining confirmation window time for a task.
   */
  private _getConfirmationRemaining(taskId: string): number | undefined {
    const ct = this.confirmationTimers.get(taskId)
    if (!ct) return undefined
    const elapsed = Date.now() - ct.startedAt
    const toolConfig = (() => {
      const task = this.tasks.get(taskId)
      if (!task) return undefined
      return this.toolConfigs.get(task.toolType)
    })()
    const windowMs = toolConfig?.confirmationWindowMs ?? this.config.confirmationWindowMs
    return Math.max(0, windowMs - elapsed)
  }

  private _scanning = false

  startTracking(): void {
    if (this.refreshTimer) return
    this.refreshTimer = setInterval(async () => {
      if (this._scanning) return // prevent overlapping scans
      this._scanning = true
      try {
        // 一次性获取进程列表，供 scan 和 update 共用，避免重复系统调用
        const processes = await this.processScanner.getAll({ refresh: true })
        // 获取窗口列表以匹配 AI 任务的 windowHwnd 和别名
        let windows: WindowInfo[] | undefined
        if (this.windowScannerFn) {
          try {
            windows = await this.windowScannerFn()
          } catch (err) {
            console.warn('AITaskTracker: window scan failed:', err instanceof Error ? err.message : err)
          }
        }
        await this.scanForAITasks(processes, windows)
        await this.updateTaskStatuses(processes)
      } catch (err) {
        console.error('AITaskTracker: scan cycle error:', err instanceof Error ? err.message : err)
      } finally {
        this._scanning = false
      }
    }, this.refreshInterval)
  }

  stopTracking(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /** Stop tracking a single task by PID. Marks it as cancelled. */
  stopTask(pid: number): boolean {
    for (const [taskId, task] of this.tasks) {
      if (task.pid === pid) {
        this.completeTask(taskId, 'cancelled')
        return true
      }
    }
    return false
  }

  async scanForAITasks(cachedProcesses?: ProcessInfo[], windows?: WindowInfo[]): Promise<AITask[]> {
    const processes = cachedProcesses ?? await this.processScanner.getAll({ refresh: true })
    const newTasks: AITask[] = []

    for (const process of processes) {
      const toolType = this.detectAIToolType(process.name, process.command)
      if (toolType === 'other') continue

      const existingTask = Array.from(this.tasks.values()).find(
        t => t.pid === process.pid && t.toolType === toolType
      )

      if (!existingTask) {
        // Match window by PID to assign windowHwnd
        const matchedWindow = windows?.find(w => w.pid === process.pid)
        const matchedAlias = this.aliasManager.matchOrCreateAlias(matchedWindow, process, toolType)
        const taskKey = withCollisionSuffix(
          makeTaskKey({
            aliasId: matchedAlias?.id,
            toolType,
            pid: process.pid,
            workingDir: process.workingDir
          }),
          new Set(this.tasks.keys())
        )

        const task: AITask = {
          id: taskKey,
          toolType,
          pid: process.pid,
          windowHwnd: matchedWindow?.hwnd,
          startTime: process.startTime,
          status: {
            state: 'running',
            lastActivity: Date.now()
          },
          monitorState: 'idle',
          autoName: this.generateAutoName(toolType),
          metrics: {
            cpuHistory: [process.cpu],
            outputLineCount: 0,
            lastOutputTime: Date.now(),
            idleDuration: 0,
            outputRate: 0
          }
        }

        // Match or create alias (auto-naming + persistent restore)
        if (matchedAlias) {
          task.alias = matchedAlias.alias
          task.aliasColor = matchedAlias.color
          this.aliasManager.updateLastMatched(matchedAlias.id)
        }

        this.tasks.set(task.id, task)
        newTasks.push(task)
        this.recordTimelineEntry(task.id, 'running')
        this.emit('task-started', task)
      } else {
        this._missingProcessEvidence.delete(existingTask.id)
        if (!existingTask.windowHwnd && windows) {
          // Try to assign windowHwnd if not yet set
          const matchedWindow = windows.find(w => w.pid === process.pid)
          if (matchedWindow) {
            existingTask.windowHwnd = matchedWindow.hwnd
          }
        }
        // Re-check alias if not yet assigned
        if (!existingTask.alias) {
          const matchedWindow = windows?.find(w => w.pid === process.pid)
          const matchedAlias = this.aliasManager.matchOrCreateAlias(matchedWindow, process, toolType)
          if (matchedAlias) {
            existingTask.alias = matchedAlias.alias
            existingTask.aliasColor = matchedAlias.color
            this.aliasManager.updateLastMatched(matchedAlias.id)
          }
        }
      }
    }

    // Clean up tasks for processes that no longer exist. A single missing scan is
    // not enough to mark completion because WMI snapshots can transiently miss PIDs.
    const currentPids = new Set(processes.map(p => p.pid))
    const now = Date.now()
    for (const [taskId, task] of this.tasks) {
      if (!currentPids.has(task.pid)) {
        this.finalizeMissingTaskIfStable(taskId, task, now)
      } else {
        this._missingProcessEvidence.delete(taskId)
      }
    }

    return newTasks
  }

  private finalizeMissingTaskIfStable(taskId: string, task: AITask, now: number): boolean {
    const missing = this._missingProcessEvidence.get(taskId)
    const graceMs = Math.max(this.refreshInterval * 2, 3000)

    if (!missing) {
      this._missingProcessEvidence.set(taskId, { missingSince: now })
      return false
    }

    if (now - missing.missingSince < graceMs) {
      return false
    }

    const status = this.classifyMissingProcessExit(task)
    this.completeTask(taskId, status)
    this._missingProcessEvidence.delete(taskId)
    return true
  }

  private classifyMissingProcessExit(task: AITask): 'completed' | 'error' | 'cancelled' {
    const currentAction = task.status.currentAction ?? ''
    const completionScore = task.detectionSignals?.completionScore ?? 0
    return classifyMissingProcessExit({
      task,
      completionScore,
      threshold: this.config.completionThreshold,
      isError: ERROR_PATTERNS.some(pattern => pattern.test(currentAction))
    })
  }

  private updateChildProcessEvidence(taskId: string, currentChildren: Set<number>, now: number): boolean {
    const evidence = this._childProcessEvidence.get(taskId) ?? { hadChildren: false }
    const previousChildren = this._prevChildPids.get(taskId)

    if (currentChildren.size > 0) {
      evidence.hadChildren = true
      delete evidence.lastExitAt
    } else if (evidence.hadChildren && previousChildren && previousChildren.size > 0) {
      evidence.lastExitAt = now
    }

    this._childProcessEvidence.set(taskId, evidence)
    this._prevChildPids.set(taskId, currentChildren)
    return this.hasRecentChildProcessExit(taskId, now)
  }

  private hasRecentChildProcessExit(taskId: string, now: number = Date.now()): boolean {
    const evidence = this._childProcessEvidence.get(taskId)
    if (!evidence?.hadChildren || evidence.lastExitAt === undefined) {
      return false
    }

    const evidenceTtlMs = Math.max(this.config.confirmationWindowMs * 2, 15000)
    return now - evidence.lastExitAt <= evidenceTtlMs
  }

  private async updateTaskStatuses(cachedProcesses?: ProcessInfo[]): Promise<void> {
    const processes = cachedProcesses ?? await this.processScanner.getAll({ refresh: true })
    const processMap = new Map(processes.map(p => [p.pid, p]))

    this._refreshCycleCount++
    const now = Date.now()

    // Batch fetch I/O counters for all tracked PIDs (Signal 3)
    const trackedPids = Array.from(this.tasks.values())
      .map(t => t.pid)
      .filter(pid => processMap.has(pid))
    const ioCounters = await this.fetchIOCounters(trackedPids)

    // Fetch child process trees every 5 cycles (~10s) for Signal 5
    const shouldCheckChildren = this._refreshCycleCount % 5 === 0
    const childPidSnapshots = new Map<string, Set<number>>()
    if (shouldCheckChildren) {
      const childPromises = Array.from(this.tasks.entries())
        .filter(([, task]) => processMap.has(task.pid))
        .map(async ([taskId, task]) => {
          const children = await this.processScanner.getProcessTree(task.pid)
          childPidSnapshots.set(taskId, new Set(children.map(c => c.pid)))
        })
      await Promise.all(childPromises)
    }

    for (const [taskId, task] of this.tasks) {
      const process = processMap.get(task.pid)
      if (!process) continue

      // Update CPU history
      task.metrics.cpuHistory.push(process.cpu)
      if (task.metrics.cpuHistory.length > 30) {
        task.metrics.cpuHistory.shift()
      }

      // 检测窗口标题模式
      const { isComplete, isError, hasPrompt } = await this.detectWindowTitlePattern(task)

      // ===== Multi-signal fusion scoring =====
      const avgCpu = task.metrics.cpuHistory.reduce((a, b) => a + b, 0) / task.metrics.cpuHistory.length
      const recentCpu = task.metrics.cpuHistory.slice(-5)
      const recentAvg = recentCpu.length > 0
        ? recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length
        : avgCpu
      const toolConfig = this.toolConfigs.get(task.toolType)
      const cpuThreshold = toolConfig?.cpuBaselineThreshold ?? 3
      // Terminal output rate uses real I/O counter delta.
      const lastActivity = task.status.lastActivity
      const idleDuration = now - lastActivity
      task.metrics.idleDuration = idleDuration

      const currentIO = ioCounters.get(task.pid)
      if (currentIO) {
        const prevIO = this._previousIOCounters.get(task.pid)
        if (prevIO) {
          const timeDelta = (now - prevIO.timestamp) / 1000 // seconds
          if (timeDelta > 0) {
            const byteDelta = currentIO.writeBytes - prevIO.writeBytes
            // outputRate = bytes per second of write activity
            task.metrics.outputRate = Math.max(0, byteDelta / timeDelta)
          }
        }
        // Store current counters for next cycle
        this._previousIOCounters.set(task.pid, {
          writeBytes: currentIO.writeBytes,
          timestamp: now,
        })
      }

      const outputRate = task.metrics.outputRate ?? 0

      let childProcessExited = false
      if (shouldCheckChildren) {
        const currentChildren = childPidSnapshots.get(taskId)
        childProcessExited = Boolean(currentChildren && this.updateChildProcessEvidence(taskId, currentChildren, now))
      } else if (this.hasRecentChildProcessExit(taskId, now)) {
        childProcessExited = true
      }

      const collectedSignals = collectDetectionSignals({
        task,
        processCpu: process.cpu,
        isComplete,
        hasPrompt,
        childProcessExited,
        now,
        config: this.config,
        toolConfig,
        cliParse: this.getCliParseSignal(task, now)
      })
      const completionScore = collectedSignals.completionScore
      const activeIndicators: string[] = [...collectedSignals.activeIndicators]

      // 如果检测到错误模式，直接标记为错误
      if (isError) {
        this.cancelConfirmation(taskId)
        this.clearStateDebounce(taskId)
        task.status.state = 'error'
        task.monitorState = 'error'
        this.emit('task-status-changed', task)
        this.completeTask(taskId, 'error')
        continue
      }

      // ===== 12-state monitor state machine =====
      const prevMonitorState = task.monitorState ?? 'idle'
      const rawMonitorState = this.determineMonitorState(task, process.cpu, isComplete, hasPrompt)
      task.monitorState = this.stabilizeMonitorState(taskId, prevMonitorState, rawMonitorState, now)

      // ===== D7: Populate detection signals for frontend =====
      const phaseResult = this.detectPhase(task)
      task.detectionSignals = {
        completionScore,
        phaseConfidence: phaseResult.confidence,
        activeIndicators,
        signalContributions: collectedSignals.signalContributions,
        inConfirmationWindow: this.confirmationTimers.has(taskId),
        confirmationRemainingMs: this._getConfirmationRemaining(taskId),
      }

      // ===== Confirmation window for completion =====
      const resumedActivityDuringConfirmation = shouldCancelConfirmation({
        recentAverageCpu: recentAvg,
        cpuThreshold,
        outputRate,
        monitorState: task.monitorState
      })

      if (this.confirmationTimers.has(taskId) && resumedActivityDuringConfirmation) {
        activeIndicators.push('confirmation_cancelled_activity')
        this.cancelConfirmation(taskId)
      }

      if (!resumedActivityDuringConfirmation && completionScore >= this.config.completionThreshold) {
        // Enter confirmation window if not already in one
        if (!this.confirmationTimers.has(taskId)) {
          const confirmMs = toolConfig?.confirmationWindowMs ?? this.config.confirmationWindowMs
          const timer = setTimeout(async () => {
            // Primary confirmation: re-compute the full confidence score
            const currentTask = this.tasks.get(taskId)
            if (currentTask) {
              const primaryReScore = await this._recomputeCompletionScore(taskId, currentTask)

              if (primaryReScore >= this.config.completionThreshold) {
                // Secondary confirmation: wait 5s more, re-verify once more
                const secondaryTimer = setTimeout(async () => {
                  const stillExists = this.tasks.get(taskId)
                  if (stillExists) {
                    const secondaryReScore = await this._recomputeCompletionScore(taskId, stillExists)
                    if (secondaryReScore >= this.config.completionThreshold) {
                      stillExists.status.state = 'completed'
                      stillExists.monitorState = 'completed'
                      this.recordTimelineEntry(taskId, 'completed', stillExists.status.currentAction)
                      this.emit('task-status-changed', stillExists)
                      this.completeTask(taskId, 'completed')
                    }
                    // If secondary fails, cancel silently (avoid false positive)
                  }
                  this.confirmationTimers.delete(taskId)
                }, 5000)
                // Update timer to secondary
                this.confirmationTimers.set(taskId, { timer: secondaryTimer, startedAt: Date.now() })
              } else {
                // Primary re-score dropped below threshold, cancel
                this.confirmationTimers.delete(taskId)
              }
            } else {
              this.confirmationTimers.delete(taskId)
            }
          }, confirmMs)
          this.confirmationTimers.set(taskId, { timer, startedAt: now })
        }
      } else {
        // If score drops below threshold during confirmation, cancel
        this.cancelConfirmation(taskId)
      }

      if (task.detectionSignals) {
        task.detectionSignals.inConfirmationWindow = this.confirmationTimers.has(taskId)
        task.detectionSignals.confirmationRemainingMs = this._getConfirmationRemaining(taskId)
      }

      // Determine new state (traditional)
      const prevState = task.status.state
      const rawState = this.determineState(task, completionScore)
      const newState = this.stabilizeTaskState(taskId, prevState, rawState, now)

      // Update phase and progress estimate
      const progressEstimate = this.estimateProgress(task)
      task.status.phase = progressEstimate.phase
      task.status.phaseLabel = progressEstimate.phaseLabel
      task.status.progressEstimate = progressEstimate

      if (newState !== prevState || task.monitorState !== prevMonitorState) {
        task.status.state = newState
        this.recordTimelineEntry(taskId, newState, task.status.currentAction)
        this.emit('task-status-changed', task)

        if (newState === 'completed' || newState === 'error') {
          this.cancelConfirmation(taskId)
          this.clearStateDebounce(taskId)
          this.completeTask(taskId, newState === 'error' ? 'error' : 'completed')
        }
      }

      // Update activity timestamp if CPU is active
      if (recentAvg > cpuThreshold) {
        task.status.lastActivity = now
      }
    }
  }

  /** Re-compute completion score for a task (used during confirmation window) */
  private async _recomputeCompletionScore(taskId: string, currentTask: AITask): Promise<number> {
    const { isComplete, isError, hasPrompt } = await this.detectWindowTitlePattern(currentTask)
    if (isError) return 0 // Error detected, not a completion

    const recentCpuSlice = currentTask.metrics.cpuHistory.slice(-5)
    const processCpu = recentCpuSlice[recentCpuSlice.length - 1] ?? 0
    return collectDetectionSignals({
      task: currentTask,
      processCpu,
      isComplete,
      hasPrompt,
      childProcessExited: this.hasRecentChildProcessExit(taskId),
      now: Date.now(),
      config: this.config,
      toolConfig: this.toolConfigs.get(currentTask.toolType),
      cliParse: this.getCliParseSignal(currentTask)
    }).completionScore
  }

  /** Cancel a pending confirmation timer */
  private cancelConfirmation(taskId: string): void {
    const timer = this.confirmationTimers.get(taskId)
    if (timer) {
      clearTimeout(timer.timer)
      this.confirmationTimers.delete(taskId)
    }
  }

  private clearStateDebounce(taskId: string): void {
    this._taskStateDebounce.delete(taskId)
    this._monitorStateDebounce.delete(taskId)
  }

  private stabilizeTaskState(taskId: string, previousState: AITaskState, candidateState: AITaskState, now: number): AITaskState {
    const decision = stabilizeStateTransition({
      previousState,
      candidateState,
      now,
      pending: this._taskStateDebounce.get(taskId),
      windowMs: STATE_FLIP_DEBOUNCE_MS,
      minObservations: STATE_FLIP_MIN_OBSERVATIONS,
      immediateStates: IMMEDIATE_TASK_STATES
    })
    if (decision.pending) {
      this._taskStateDebounce.set(taskId, decision.pending)
    } else {
      this._taskStateDebounce.delete(taskId)
    }
    return decision.state
  }

  private stabilizeMonitorState(taskId: string, previousState: AIMonitorState, candidateState: AIMonitorState, now: number): AIMonitorState {
    const decision = stabilizeStateTransition({
      previousState,
      candidateState,
      now,
      pending: this._monitorStateDebounce.get(taskId),
      windowMs: STATE_FLIP_DEBOUNCE_MS,
      minObservations: STATE_FLIP_MIN_OBSERVATIONS,
      immediateStates: IMMEDIATE_MONITOR_STATES
    })
    if (decision.pending) {
      this._monitorStateDebounce.set(taskId, decision.pending)
    } else {
      this._monitorStateDebounce.delete(taskId)
    }
    return decision.state
  }

  /** Determine the 12-state monitor state */
  private determineMonitorState(
    task: AITask,
    _currentCpu: number,
    isComplete: boolean,
    hasPrompt: boolean
  ): AIMonitorState {
    const action = task.status.currentAction || ''
    return deriveMonitorState({
      task,
      isComplete,
      hasPrompt,
      isError: ERROR_PATTERNS.some(p => p.test(action)),
      isCompilingAction: COMPILE_PATTERNS.test(action)
    })
  }

  async detectWindowTitlePattern(task: AITask): Promise<{ isComplete: boolean; isError: boolean; hasPrompt: boolean }> {
    if (!task.windowHwnd) {
      return { isComplete: false, isError: false, hasPrompt: false }
    }

    // 验证 hwnd 防止命令注入
    if (!validateHwnd(task.windowHwnd)) {
      console.warn(`Invalid hwnd for detectWindowTitlePattern: ${task.windowHwnd}`)
      return { isComplete: false, isError: false, hasPrompt: false }
    }

    try {
      const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          using System.Text;

          public class WindowTitle {
            [DllImport("user32.dll")]
            private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

            [DllImport("user32.dll")]
            private static extern int GetWindowTextLength(IntPtr hWnd);

            public static string GetTitle(IntPtr hWnd) {
              int length = GetWindowTextLength(hWnd);
              if (length == 0) return "";
              StringBuilder title = new StringBuilder(length + 1);
              GetWindowText(hWnd, title, title.Capacity);
              return title.ToString();
            }
          }
"@
        [WindowTitle]::GetTitle([IntPtr]${task.windowHwnd})
      `

      const psCommand = script.replace(/\n/g, ' ')
      const stdout = await this.executePowerShell(psCommand, {
        label: 'window-title-pattern',
        timeoutMs: 10000
      })

      const title = stdout.trim()
      task.status.currentAction = title

      // Check tool-specific keywords if available
      const toolConfig = this.toolConfigs.get(task.toolType)
      let isComplete = COMPLETION_PATTERNS.some(p => p.test(title))
      let isError = ERROR_PATTERNS.some(p => p.test(title))
      let hasPrompt = PROMPT_PATTERNS.some(p => p.test(title))

      if (toolConfig) {
        if (!isComplete) {
          isComplete = toolConfig.completionKeywords.some(kw => title.includes(kw))
        }
        if (!isError) {
          isError = toolConfig.errorKeywords.some(kw => title.includes(kw))
        }
        if (!hasPrompt) {
          hasPrompt = toolConfig.promptPatterns.some(p => {
            try {
              return new RegExp(p).test(title)
            } catch {
              return false
            }
          })
        }
      }

      return { isComplete, isError, hasPrompt }
    } catch (error) {
      console.warn('detectWindowTitlePattern failed:', error instanceof Error ? error.message : 'Unknown error')
      return { isComplete: false, isError: false, hasPrompt: false }
    }
  }

  private calculateVariance(values: number[]): number {
    return calculateVariance(values)
  }

  private determineState(task: AITask, completionScore: number): AITaskState {
    const action = task.status.currentAction || ''
    const decision = deriveTaskState({
      task,
      completionScore,
      isCompilingAction: /\b(tsc|vite|webpack|npm\s+run|pnpm|pytest|jest|cargo\s+build|go\s+build|mvn|gradle)\b/i.test(action),
      config: this.config
    })

    if (decision.markActivity) {
      task.status.lastActivity = Date.now()
    }

    return decision.state
  }

  /** Record a state transition in the task's timeline */
  private recordTimelineEntry(taskId: string, status: AITaskState, detail?: string, monitorState?: AIMonitorState): void {
    if (!this.timelines.has(taskId)) {
      this.timelines.set(taskId, [])
    }
    const timeline = this.timelines.get(taskId)!
    const now = Date.now()

    // Update duration of the previous entry
    if (timeline.length > 0) {
      const prev = timeline[timeline.length - 1]
      prev.duration = (now - new Date(prev.timestamp).getTime()) / 1000
    }

    timeline.push({
      timestamp: new Date(now).toISOString(),
      status,
      monitorState: monitorState ?? this.tasks.get(taskId)?.monitorState,
      duration: 0,
      detail
    })

    // Keep only last 200 entries to bound memory
    if (timeline.length > 200) {
      this.timelines.set(taskId, timeline.slice(-200))
    }
  }

  /** Get the progress timeline for a task */
  getTimeline(taskId: string): TimelineEntry[] {
    return this.timelines.get(taskId) ?? []
  }

  getStateHistory(taskKey: string, limit = 30): StateTransition[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200)
    const task = this.tasks.get(taskKey)
    return this.getTimeline(taskKey).slice(-safeLimit).map(entry => ({
      ...entry,
      taskKey,
      monitorState: entry.monitorState ?? task?.monitorState
    }))
  }

  recordCompletionOracleEvent(event: AICompletionOracleEvent): AICompletionOracleRecord | null {
    const alias = event.alias.trim()
    const completedAt = Math.trunc(event.completedAt)
    const hookEventName = event.hookEventName.trim()
    if (!alias || !Number.isFinite(completedAt) || completedAt <= 0 || !hookEventName) {
      return null
    }

    const stableKey = event.sessionId
      ? `${alias}:${event.sessionId}`
      : event.taskKey
        ? `${alias}:${event.taskKey}`
        : `${alias}:${completedAt}`
    const historyId = `oracle:${stableKey}`
    const existingReport = this.oracleConfidenceReports.get(historyId)
    const existingHistory = this.history.find(entry => entry.id === historyId)
    if (existingReport && existingHistory) {
      return { history: existingHistory, confidenceReport: existingReport }
    }

    const now = Date.now()
    const signalContributions: SignalContribution[] = [
      {
        name: 'terminal_keywords',
        result: {
          name: 'terminal_keywords',
          kind: 'event',
          raw: hookEventName,
          normalized: 1,
          confidence: 1,
          triggeredAt: completedAt,
          reason: `Claude Code hook ${hookEventName} reported response completion`
        },
        weight: 0.34,
        weightedContribution: 0.34
      },
      {
        name: 'child_process_exit',
        result: {
          name: 'child_process_exit',
          kind: 'event',
          raw: event.source,
          normalized: 1,
          confidence: 1,
          triggeredAt: completedAt,
          reason: 'Claude Code emitted a real completion hook for this session'
        },
        weight: 0.33,
        weightedContribution: 0.33
      },
      {
        name: 'time_threshold',
        result: {
          name: 'time_threshold',
          kind: 'event',
          raw: completedAt,
          normalized: 1,
          confidence: 1,
          triggeredAt: completedAt,
          reason: 'Completion timestamp came from the hook payload, not a synthesized timer'
        },
        weight: 0.33,
        weightedContribution: 0.33
      }
    ]

    const task: AITask = {
      id: historyId,
      toolType: 'claude-code',
      pid: 0,
      startTime: completedAt,
      endTime: completedAt,
      alias,
      status: {
        state: 'completed',
        lastActivity: completedAt,
        currentAction: `Claude hook ${hookEventName}`,
        phase: 'completed',
        phaseLabel: PHASE_LABELS.completed,
        progressEstimate: {
          percentage: 100,
          phase: 'completed',
          phaseLabel: PHASE_LABELS.completed,
          elapsed: 0,
          confidence: 1
        }
      },
      monitorState: 'completed',
      metrics: {
        cpuHistory: [],
        outputLineCount: 0,
        lastOutputTime: completedAt,
        idleDuration: 0,
        outputRate: 0
      },
      detectionSignals: {
        completionScore: 1,
        phaseConfidence: 1,
        activeIndicators: signalContributions.map(signal => signal.name),
        signalContributions,
        inConfirmationWindow: false
      }
    }

    const confidenceReport = buildConfidenceReport({
      task,
      taskKey: historyId,
      threshold: this.config.completionThreshold,
      phaseConfidence: 1,
      inConfirmationWindow: false,
      signalContributions,
      completionScore: 1,
      updatedAt: now
    })

    const historyEntry: AITaskHistory = {
      id: historyId,
      toolType: 'claude-code',
      startTime: completedAt,
      endTime: completedAt,
      duration: 0,
      status: 'completed',
      summary: `Claude Code hook ${hookEventName} from ${event.source}`,
      taskAlias: alias
    }

    this.history.push(historyEntry)
    const MAX_HISTORY = 1000
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY)
    }

    this.oracleConfidenceReports.set(historyId, confidenceReport)
    if (event.sessionId) this.oracleConfidenceReports.set(`oracle:${event.sessionId}`, confidenceReport)
    if (event.taskKey) this.oracleConfidenceReports.set(`oracle:${event.taskKey}`, confidenceReport)
    this.recordTimelineEntry(historyId, 'completed', historyEntry.summary, 'completed')
    this.emit('task-completed', historyEntry, alias)

    return { history: historyEntry, confidenceReport }
  }

  applyProgressProbeStateForTests(input: {
    detail?: string
    finalizeAfterMs?: number
    monitorState: AIMonitorState
    taskId: string
  }): AITask | null {
    const task = this.tasks.get(input.taskId)
    if (!task) return null

    const now = Date.now()
    const phase = phaseForMonitorState(input.monitorState)
    const state = taskStateForMonitorState(input.monitorState)
    const idleBackoffMs = Math.max(this.config.idleThresholdMs + 1000, 31000)

    task.monitorState = input.monitorState
    task.status.state = state
    task.status.phase = phase
    task.status.phaseLabel = PHASE_LABELS[phase]
    task.status.currentAction = input.detail ?? input.monitorState
    task.status.lastActivity = input.monitorState === 'idle' ? now - idleBackoffMs : now
    task.metrics.cpuHistory = cpuHistoryForMonitorState(input.monitorState)
    task.metrics.idleDuration = now - task.status.lastActivity
    task.metrics.outputRate = input.monitorState === 'coding' || input.monitorState === 'compiling' ? 768 : 0
    task.status.progressEstimate = {
      percentage: progressPercentageForMonitorState(input.monitorState),
      phase,
      phaseLabel: PHASE_LABELS[phase],
      elapsed: Math.max(0, now - task.startTime),
      estimatedRemaining: input.monitorState === 'coding' ? 20_000 : undefined,
      confidence: 0.99
    }
    task.detectionSignals = {
      completionScore: input.monitorState === 'completed' ? 1 : 0,
      phaseConfidence: 0.99,
      activeIndicators: [input.monitorState],
      inConfirmationWindow: false
    }

    this.recordTimelineEntry(input.taskId, state, input.detail ?? input.monitorState, input.monitorState)
    this.emit('task-status-changed', task)

    if (input.monitorState === 'completed' && input.finalizeAfterMs !== undefined) {
      const delay = Math.min(Math.max(Math.trunc(input.finalizeAfterMs), 0), 5000)
      setTimeout(() => {
        this.completeTask(input.taskId, 'completed')
      }, delay)
    }

    return task
  }

  getConfidenceReport(taskKey: string): ConfidenceReport | null {
    const task = this.tasks.get(taskKey)
    if (!task) return this.oracleConfidenceReports.get(taskKey) ?? null

    const signals = task.detectionSignals
    const completionScore = signals?.completionScore ?? 0

    if (signals?.signalContributions) {
      return buildConfidenceReport({
        task,
        taskKey,
        threshold: this.config.completionThreshold,
        phaseConfidence: signals.phaseConfidence,
        inConfirmationWindow: signals.inConfirmationWindow ?? this.confirmationTimers.has(taskKey),
        confirmationRemainingMs: signals.confirmationRemainingMs ?? this._getConfirmationRemaining(taskKey),
        signalContributions: signals.signalContributions,
        completionScore,
        updatedAt: Date.now()
      })
    }

    const activeIndicators = signals?.activeIndicators ?? []
    const narrative = activeIndicators.length > 0
      ? `${activeIndicators.join(', ')} => ${Math.round(completionScore * 100)}%`
      : `no active completion indicators => ${Math.round(completionScore * 100)}%`

    return {
      taskKey,
      taskId: task.id,
      toolType: task.toolType,
      state: task.status.state,
      monitorState: task.monitorState,
      completionScore,
      threshold: this.config.completionThreshold,
      phaseConfidence: signals?.phaseConfidence ?? 0,
      activeIndicators,
      inConfirmationWindow: signals?.inConfirmationWindow ?? this.confirmationTimers.has(taskKey),
      confirmationRemainingMs: signals?.confirmationRemainingMs ?? this._getConfirmationRemaining(taskKey),
      updatedAt: Date.now(),
      narrative
    }
  }

  getToolProfile(toolType: AIToolType): ToolProfile | null {
    const config = this.getToolDetectionConfig(toolType)
    if (!config) return null

    return {
      ...config,
      signalWeights: {
        cliParse: CLI_PARSE_SIGNAL_WEIGHT,
        terminalKeywords: this.config.outputPatternWeight,
        cpuIdle: this.config.cpuIdleWeight,
        lowOutputRate: this.config.cursorWaitWeight,
        promptDetected: this.config.promptDetectionWeight,
        childProcessExit: this.config.childProcessWeight,
        timeThreshold: this.config.timeThresholdWeight
      },
      minHoldMs: {
        validating: config.confirmationWindowMs,
        idle: 30000
      }
    }
  }

  setToolProfile(toolType: AIToolType, profile: Partial<ToolProfile>): boolean {
    if (!this.toolConfigs.has(toolType)) {
      return false
    }

    const { signalWeights, minHoldMs: _minHoldMs, ...detectionConfig } = profile

    if (signalWeights) {
      this.config = {
        ...this.config,
        outputPatternWeight: signalWeights.terminalKeywords ?? this.config.outputPatternWeight,
        cpuIdleWeight: signalWeights.cpuIdle ?? this.config.cpuIdleWeight,
        cursorWaitWeight: signalWeights.lowOutputRate ?? this.config.cursorWaitWeight,
        promptDetectionWeight: signalWeights.promptDetected ?? this.config.promptDetectionWeight,
        childProcessWeight: signalWeights.childProcessExit ?? this.config.childProcessWeight,
        timeThresholdWeight: signalWeights.timeThreshold ?? this.config.timeThresholdWeight
      }
    }

    this.setToolDetectionConfig(toolType, detectionConfig)
    return true
  }

  calibrateToolProfile(toolType: AIToolType, sample: CalibrationSample): CalibrationResult {
    const currentProfile = this.getToolProfile(toolType)
    if (!currentProfile || toolType === 'other') {
      return {
        accepted: false,
        toolType,
        sampleCount: 0,
        updated: false,
        weights: this.getToolProfile('codex')?.signalWeights ?? {
          cliParse: CLI_PARSE_SIGNAL_WEIGHT,
          terminalKeywords: this.config.outputPatternWeight,
          cpuIdle: this.config.cpuIdleWeight,
          lowOutputRate: this.config.cursorWaitWeight,
          promptDetected: this.config.promptDetectionWeight,
          childProcessExit: this.config.childProcessWeight,
          timeThreshold: this.config.timeThresholdWeight
        },
        reason: 'PROFILE_NOT_FOUND'
      }
    }

    const normalizedSample: CalibrationSample = {
      ...sample,
      toolType,
      capturedAt: Number.isFinite(sample.capturedAt) ? sample.capturedAt : Date.now(),
      signals: { ...sample.signals }
    }
    const samples = this.calibrationStore.append(normalizedSample)

    if (samples.length < 10) {
      return {
        accepted: true,
        toolType,
        sampleCount: samples.length,
        updated: false,
        weights: currentProfile.signalWeights,
        reason: `CALIBRATION_INSUFFICIENT:${samples.length}/10`
      }
    }

    const weights = rebalanceWeightsFromCalibration(currentProfile.signalWeights, samples)
    this.setToolProfile(toolType, { signalWeights: weights })
    return {
      accepted: true,
      toolType,
      sampleCount: samples.length,
      updated: true,
      weights
    }
  }

  private detectAIToolType(processName: string, command: string): AIToolType {
    const lowerName = processName.toLowerCase()

    for (const [toolType, signatures] of Object.entries(AI_TOOL_SIGNATURES)) {
      if (toolType === 'other') continue

      // Check process patterns
      const nameMatch = signatures.processPatterns.some(p => lowerName.includes(p.toLowerCase()))
      if (!nameMatch) continue

      // If commandPatterns is empty, match on processName alone (e.g., Cursor)
      if (signatures.commandPatterns.length === 0) {
        return toolType as AIToolType
      }

      // Check command patterns
      if (signatures.commandPatterns.some(pattern => pattern.test(command))) {
        return toolType as AIToolType
      }
    }

    return 'other'
  }

  private completeTask(taskId: string, status: 'completed' | 'error' | 'cancelled'): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    // Cancel any pending confirmation
    this.cancelConfirmation(taskId)

    // Clear auto-named PID tracking
    this.aliasManager.clearAutoNamedPid(task.pid)

    // Clean up per-task tracking data
    this._previousIOCounters.delete(task.pid)
    this._prevChildPids.delete(taskId)
    this._childProcessEvidence.delete(taskId)
    this._missingProcessEvidence.delete(taskId)
    this._cliParseSignals.delete(taskId)
    this._cliParseSignals.delete(String(task.pid))
    if (task.alias) this._cliParseSignals.delete(task.alias)

    const shouldEmitTerminalError = status === 'error' && task.status.state !== 'error'
    const terminalState: AITaskState = status === 'error'
      ? 'error'
      : status === 'cancelled'
        ? 'idle'
        : 'completed'
    const terminalMonitorState: AIMonitorState = status === 'error'
      ? 'error'
      : status === 'cancelled'
        ? 'idle'
        : 'completed'

    task.endTime = Date.now()
    task.status.state = terminalState
    task.monitorState = terminalMonitorState

    if (shouldEmitTerminalError) {
      this.emit('task-status-changed', task)
    }

    const historyEntry: AITaskHistory = {
      id: task.id,
      toolType: task.toolType,
      projectId: task.projectId,
      startTime: task.startTime,
      endTime: task.endTime,
      duration: task.endTime - task.startTime,
      status,
      taskAlias: task.alias,
      windowHwnd: task.windowHwnd
    }

    this.history.push(historyEntry)
    const MAX_HISTORY = 1000
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY)
    }
    const taskAlias = historyEntry.taskAlias
    const taskWindowHwnd = historyEntry.windowHwnd
    // Finalize timeline last entry duration
    const timeline = this.timelines.get(taskId)
    if (timeline && timeline.length > 0) {
      const last = timeline[timeline.length - 1]
      last.duration = (Date.now() - new Date(last.timestamp).getTime()) / 1000
    }
    this.tasks.delete(taskId)
    // Keep timeline for a while (cleaned up in cleanup())
    this.emit('task-completed', historyEntry, taskAlias, taskWindowHwnd)
  }

  getActiveTasks(): AITask[] {
    return Array.from(this.tasks.values())
  }

  getTaskById(taskId: string): AITask | undefined {
    return this.tasks.get(taskId)
  }

  getHistory(limit?: number): AITaskHistory[] {
    const sorted = [...this.history].sort((a, b) =>
      b.startTime - a.startTime
    )
    return limit ? sorted.slice(0, limit) : sorted
  }

  getStatistics(): {
    totalTasks: number
    completedTasks: number
    errorTasks: number
    avgDuration: number
    byTool: Record<AIToolType, number>
  } {
    const completedTasks = this.history.filter(h => h.status === 'completed').length
    const errorTasks = this.history.filter(h => h.status === 'error').length
    const totalDuration = this.history.reduce((sum, h) => sum + h.duration, 0)

    const byTool: Record<AIToolType, number> = {
      'codex': 0,
      'claude-code': 0,
      'gemini-cli': 0,
      'cursor': 0,
      'opencode': 0,
      'aider': 0,
      'windsurf': 0,
      'continue-dev': 0,
      'cline': 0,
      'other': 0
    }

    for (const task of this.history) {
      byTool[task.toolType]++
    }

    return {
      totalTasks: this.history.length,
      completedTasks,
      errorTasks,
      avgDuration: this.history.length > 0 ? totalDuration / this.history.length : 0,
      byTool
    }
  }

  // ==================== Phase Detection ====================

  detectPhase(task: AITask): PhaseSignals {
    const { cpuHistory, idleDuration } = task.metrics
    const elapsed = Date.now() - task.startTime

    // Initializing: process just started (<10s)
    if (elapsed < 10000) {
      return { phase: 'initializing', confidence: 0.9, indicators: ['process_young'] }
    }

    const recentCpu = cpuHistory.slice(-5)
    const avgCpu = recentCpu.length > 0
      ? recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length
      : 0
    const cpuVariance = this.calculateVariance(cpuHistory.slice(-10))

    // Check window title patterns first (highest confidence)
    const titleAction = task.status.currentAction || ''
    if (COMPLETION_PATTERNS.some(p => p.test(titleAction))) {
      return { phase: 'completed', confidence: 0.9, indicators: ['title_completion_pattern'] }
    }
    if (ERROR_PATTERNS.some(p => p.test(titleAction))) {
      return { phase: 'error', confidence: 0.9, indicators: ['title_error_pattern'] }
    }

    // Validating: sudden high CPU burst (tests/compile)
    if (avgCpu > 60 || (cpuHistory.length > 0 && cpuHistory[cpuHistory.length - 1] > 50 && cpuVariance > 10)) {
      return { phase: 'validating', confidence: 0.6, indicators: ['high_cpu_burst'] }
    }

    // Coding: moderate CPU + high variance (file writes)
    if (avgCpu > 5 && avgCpu < 60 && cpuVariance > 2) {
      return { phase: 'coding', confidence: 0.7, indicators: ['moderate_cpu', 'cpu_variance'] }
    }

    // Thinking: low CPU + stable + not idle long
    if (avgCpu < 5 && cpuVariance < 1 && idleDuration < 30000) {
      return { phase: 'thinking', confidence: 0.8, indicators: ['low_cpu', 'stable', 'not_idle_long'] }
    }

    // Default to thinking for active tasks
    return { phase: 'thinking', confidence: 0.5, indicators: ['default'] }
  }

  estimateProgress(task: AITask): ProgressEstimate {
    const phaseSignals = this.detectPhase(task)
    const elapsed = Date.now() - task.startTime

    // Get average duration from same-tool history
    const sameToolHistory = this.history.filter(h => h.toolType === task.toolType && h.status === 'completed')
    const avgDuration = sameToolHistory.length > 0
      ? sameToolHistory.reduce((sum, h) => sum + h.duration, 0) / sameToolHistory.length
      : null

    // Phase weights for progress estimation
    const phaseWeights: Record<AITaskPhase, number> = {
      initializing: 0.05,
      thinking: 0.30,
      coding: 0.70,
      validating: 0.90,
      completed: 1.00,
      error: 0.50,
    }

    let percentage = (phaseWeights[phaseSignals.phase]) * 100

    // If we have history data, blend with time-based estimation
    if (avgDuration) {
      const timeProgress = Math.min(elapsed / avgDuration, 0.95) * 100
      percentage = percentage * 0.6 + timeProgress * 0.4  // 60% phase, 40% time
    }

    const cliSignal = this.getCliParseSignal(task)
    if (cliSignal) {
      percentage = cliSignal.progress === 0
        ? 0
        : Math.max(percentage, cliSignal.progress * 100)
    }

    return {
      percentage: Math.round(Math.max(0, Math.min(percentage, 99))),  // Never reach 100 unless explicitly completed
      phase: phaseSignals.phase,
      phaseLabel: PHASE_LABELS[phaseSignals.phase],
      elapsed,
      estimatedRemaining: avgDuration ? Math.max(0, avgDuration - elapsed) : undefined,
      confidence: phaseSignals.confidence,
    }
  }

  getProgress(taskId: string): ProgressEstimate | null {
    const task = this.tasks.get(taskId)
    if (!task) return null
    return this.estimateProgress(task)
  }

  cleanup(): void {
    this.stopTracking()
    if (this._cliEventUnsubscribe) {
      this._cliEventUnsubscribe()
      this._cliEventUnsubscribe = null
    }
    // Clear all confirmation timers
    for (const [, ct] of this.confirmationTimers) {
      clearTimeout(ct.timer)
    }
    this.confirmationTimers.clear()
    this.tasks.clear()
    this.history = []
    this.oracleConfidenceReports.clear()
    this.timelines.clear()
    this.autoNameCounters.clear()
    this._previousIOCounters.clear()
    this._prevChildPids.clear()
    this._childProcessEvidence.clear()
    this._missingProcessEvidence.clear()
    this._cliParseSignals.clear()
    this._refreshCycleCount = 0
    this.removeAllListeners()
  }
}
