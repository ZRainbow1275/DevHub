import { EventEmitter } from 'events'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  AITask,
  AITaskHistory,
  AIToolType,
  AITaskState,
  AITaskPhase,
  AIMonitorState,
  PhaseSignals,
  ProgressEstimate,
  PHASE_LABELS,
  AI_TOOL_SIGNATURES,
  AIToolDetectionConfig,
  DEFAULT_AI_TOOL_CONFIGS,
  ProcessInfo,
  WindowInfo,
  TimelineEntry
} from '@shared/types-extended'
import { SystemProcessScanner } from './SystemProcessScanner'
import { AIAliasManager } from './AIAliasManager'

const execFileAsync = promisify(execFile)

// 安全验证: 确保 hwnd 是有效的整数
function validateHwnd(hwnd: number): boolean {
  return Number.isInteger(hwnd) && hwnd > 0 && hwnd <= Number.MAX_SAFE_INTEGER
}

// 完成指示模式 - 用于检测终端窗口标题
const COMPLETION_PATTERNS = [
  /done\s+in\s+[\d.]+\s*[ms]/i,
  /build\s+complete/i,
  /compilation\s+successful/i,
  /✓\s+done/i,
  /✔/,
  /finished\s+in\s+[\d.]+/i,
  /completed\s+successfully/i,
  /task\s+complete/i,
  /waiting\s+for\s+input/i,
]

// 错误指示模式
const ERROR_PATTERNS = [
  /error:/i,
  /failed/i,
  /exception/i,
  /fatal/i,
  /crash/i,
  /panic/i,
  /✗/,
  /✘/
]

// 提示符模式 - 终端等待输入的标志
const PROMPT_PATTERNS = [
  /^\s*[>$%#]\s*$/m,
  /^\s*[❯]\s*$/m,
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

export class AITaskTracker extends EventEmitter {
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
    confirmationWindowMs: 3000
  }

  constructor(processScanner: SystemProcessScanner, aliasManager?: AIAliasManager) {
    super()
    this.setMaxListeners(20)
    this.processScanner = processScanner
    this.aliasManager = aliasManager ?? new AIAliasManager()

    // Initialize default per-tool configs
    for (const [toolType, config] of Object.entries(DEFAULT_AI_TOOL_CONFIGS)) {
      this.toolConfigs.set(toolType as AIToolType, { ...config })
    }
  }

  getAliasManager(): AIAliasManager {
    return this.aliasManager
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
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', psCmd],
        { windowsHide: true, timeout: 10000 }
      )

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
        const processes = await this.processScanner.getAll()
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
    const processes = cachedProcesses ?? await this.processScanner.getAll()
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

        const task: AITask = {
          id: `ai_${process.pid}_${Date.now()}`,
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
        const matchedAlias = this.aliasManager.matchOrCreateAlias(matchedWindow, process, toolType)
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

    // Clean up tasks for processes that no longer exist
    const currentPids = new Set(processes.map(p => p.pid))
    for (const [taskId, task] of this.tasks) {
      if (!currentPids.has(task.pid)) {
        this.completeTask(taskId, 'completed')
      }
    }

    return newTasks
  }

  private async updateTaskStatuses(cachedProcesses?: ProcessInfo[]): Promise<void> {
    const processes = cachedProcesses ?? await this.processScanner.getAll()
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
      let completionScore = 0
      const activeIndicators: string[] = []

      // Signal 1: Terminal output keywords (20% weight)
      if (isComplete) {
        completionScore += this.config.outputPatternWeight
        activeIndicators.push('terminal_keywords')
      }

      // Signal 2: CPU activity change (25% weight)
      const avgCpu = task.metrics.cpuHistory.reduce((a, b) => a + b, 0) / task.metrics.cpuHistory.length
      const recentCpu = task.metrics.cpuHistory.slice(-5)
      const recentAvg = recentCpu.length > 0
        ? recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length
        : avgCpu
      const toolConfig = this.toolConfigs.get(task.toolType)
      const cpuThreshold = toolConfig?.cpuBaselineThreshold ?? 3
      if (recentAvg < cpuThreshold && process.cpu < cpuThreshold) {
        completionScore += this.config.cpuIdleWeight
        activeIndicators.push('cpu_idle')
      }

      // Signal 3: Terminal output rate (20% weight) - real I/O counter delta
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

      // Score Signal 3: low output rate indicates task may be done
      const outputRate = task.metrics.outputRate ?? 0
      if (outputRate < 100 && idleDuration > this.config.idleThresholdMs) {
        // Low I/O write activity combined with idle time signals completion
        completionScore += this.config.cursorWaitWeight
        activeIndicators.push('low_output_rate')
      }

      // Signal 4: Input prompt detection (25% weight)
      if (hasPrompt) {
        completionScore += this.config.promptDetectionWeight
        activeIndicators.push('prompt_detected')
      }

      // Signal 5: Child process exit detection (10% weight)
      if (shouldCheckChildren) {
        const currentChildren = childPidSnapshots.get(taskId)
        const prevChildren = this._prevChildPids.get(taskId)

        if (prevChildren && prevChildren.size > 0 && currentChildren) {
          // Children existed before but are now gone => child processes exited
          if (currentChildren.size === 0) {
            completionScore += this.config.childProcessWeight
            activeIndicators.push('child_process_exit')
          }
        }

        // Update snapshot for next cycle
        if (currentChildren) {
          this._prevChildPids.set(taskId, currentChildren)
        }
      } else {
        // Between child-check cycles, use cached result if children were previously detected as exited
        const prevChildren = this._prevChildPids.get(taskId)
        if (prevChildren && prevChildren.size === 0) {
          // Keep scoring if children already exited
          const hadChildrenBefore = this._prevChildPids.has(taskId)
          if (hadChildrenBefore) {
            completionScore += this.config.childProcessWeight
            activeIndicators.push('child_process_exit')
          }
        }
      }

      // 如果检测到错误模式，直接标记为错误
      if (isError) {
        this.cancelConfirmation(taskId)
        task.status.state = 'error'
        task.monitorState = 'error'
        this.emit('task-status-changed', task)
        this.completeTask(taskId, 'error')
        continue
      }

      // ===== 7-state monitor state machine =====
      const prevMonitorState = task.monitorState
      task.monitorState = this.determineMonitorState(task, process.cpu, isComplete, hasPrompt)

      // ===== D7: Populate detection signals for frontend =====
      const phaseResult = this.detectPhase(task)
      task.detectionSignals = {
        completionScore,
        phaseConfidence: phaseResult.confidence,
        activeIndicators,
        inConfirmationWindow: this.confirmationTimers.has(taskId),
        confirmationRemainingMs: this._getConfirmationRemaining(taskId),
      }

      // ===== Confirmation window for completion =====
      if (completionScore >= this.config.completionThreshold) {
        // Enter confirmation window if not already in one
        if (!this.confirmationTimers.has(taskId)) {
          const confirmMs = toolConfig?.confirmationWindowMs ?? this.config.confirmationWindowMs
          const timer = setTimeout(async () => {
            // After confirmation window, re-compute the full confidence score
            const currentTask = this.tasks.get(taskId)
            if (currentTask) {
              const { isComplete, isError, hasPrompt } = await this.detectWindowTitlePattern(currentTask)
              let reScore = 0
              if (isComplete) reScore += this.config.outputPatternWeight
              const recentCpuSlice = currentTask.metrics.cpuHistory.slice(-5)
              const recentAvgRe = recentCpuSlice.length > 0
                ? recentCpuSlice.reduce((a, b) => a + b, 0) / recentCpuSlice.length
                : 0
              const reToolConfig = this.toolConfigs.get(currentTask.toolType)
              const reCpuThreshold = reToolConfig?.cpuBaselineThreshold ?? 3
              if (recentAvgRe < reCpuThreshold) reScore += this.config.cpuIdleWeight
              // Signal 3 re-check: use real outputRate
              const reOutputRate = currentTask.metrics.outputRate ?? 0
              if (reOutputRate < 100 && currentTask.metrics.idleDuration > this.config.idleThresholdMs) {
                reScore += this.config.cursorWaitWeight
              }
              if (hasPrompt) reScore += this.config.promptDetectionWeight
              // Signal 5 re-check: use cached child process state
              const rePrevChildren = this._prevChildPids.get(taskId)
              if (rePrevChildren && rePrevChildren.size === 0) {
                reScore += this.config.childProcessWeight
              }

              if (!isError && reScore >= this.config.completionThreshold) {
                currentTask.status.state = 'completed'
                currentTask.monitorState = 'completed'
                this.recordTimelineEntry(taskId, 'completed', currentTask.status.currentAction)
                this.emit('task-status-changed', currentTask)
                this.completeTask(taskId, 'completed')
              }
              // If re-score drops below threshold, cancel (don't complete)
            }
            this.confirmationTimers.delete(taskId)
          }, confirmMs)
          this.confirmationTimers.set(taskId, { timer, startedAt: now })
        }
      } else {
        // If score drops below threshold during confirmation, cancel
        this.cancelConfirmation(taskId)
      }

      // Determine new state (traditional)
      const prevState = task.status.state
      const newState = this.determineState(task, completionScore)

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
          this.completeTask(taskId, newState === 'error' ? 'error' : 'completed')
        }
      }

      // Update activity timestamp if CPU is active
      if (recentAvg > cpuThreshold) {
        task.status.lastActivity = now
      }
    }
  }

  /** Cancel a pending confirmation timer */
  private cancelConfirmation(taskId: string): void {
    const timer = this.confirmationTimers.get(taskId)
    if (timer) {
      clearTimeout(timer.timer)
      this.confirmationTimers.delete(taskId)
    }
  }

  /** Determine the 7-state monitor state */
  private determineMonitorState(
    task: AITask,
    _currentCpu: number,
    isComplete: boolean,
    hasPrompt: boolean
  ): AIMonitorState {
    const recentCpu = task.metrics.cpuHistory.slice(-5)
    const recentAvg = recentCpu.length > 0
      ? recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length
      : 0
    const cpuVariance = this.calculateVariance(task.metrics.cpuHistory.slice(-10))
    const action = task.status.currentAction || ''

    // Error state
    if (ERROR_PATTERNS.some(p => p.test(action))) {
      return 'error'
    }

    // Completed state
    if (isComplete && recentAvg < 5) {
      return 'completed'
    }

    // Waiting-input state: prompt detected + low CPU
    if (hasPrompt && recentAvg < 5) {
      return 'waiting-input'
    }

    // Compiling state: build/test commands detected + high CPU
    if (COMPILE_PATTERNS.test(action) && recentAvg > 5) {
      return 'compiling'
    }

    // Thinking state: CPU > 20% but stable (no terminal output)
    if (recentAvg > 20 && cpuVariance < 5) {
      return 'thinking'
    }

    // Coding state: moderate CPU with variance
    if (recentAvg > 5 && cpuVariance > 2) {
      return 'coding'
    }

    // Idle state: very low CPU for extended period
    if (recentAvg < 2 && task.metrics.idleDuration > 30000) {
      return 'idle'
    }

    // Thinking as default for any active process
    if (recentAvg > 2) {
      return 'thinking'
    }

    return 'idle'
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
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
        { windowsHide: true, timeout: 10000 }
      )

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
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  }

  private determineState(task: AITask, completionScore: number): AITaskState {
    const avgCpu = task.metrics.cpuHistory.reduce((a, b) => a + b, 0) / task.metrics.cpuHistory.length
    const recentCpu = task.metrics.cpuHistory.slice(-5)
    const recentAvg = recentCpu.length > 0
      ? recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length
      : avgCpu
    const cpuVariance = this.calculateVariance(task.metrics.cpuHistory.slice(-10))

    if (completionScore >= this.config.completionThreshold) {
      return 'completed'
    }

    // Check current action for compile/test indicators
    const action = task.status.currentAction || ''
    const isCompiling = /\b(tsc|vite|webpack|npm\s+run|pnpm|pytest|jest|cargo\s+build|go\s+build|mvn|gradle)\b/i.test(action)

    if (isCompiling && recentAvg > 5) {
      task.status.lastActivity = Date.now()
      return 'compiling'
    }

    // Thinking: CPU > 20% but no terminal output (stable CPU)
    if (recentAvg > 20 && cpuVariance < 5) {
      task.status.lastActivity = Date.now()
      return 'thinking'
    }

    // Coding: moderate CPU with variance (file writes happening)
    if (recentAvg > 5 && cpuVariance > 2) {
      task.status.lastActivity = Date.now()
      return 'coding'
    }

    // Running: any activity above threshold
    if (recentAvg > 10) {
      task.status.lastActivity = Date.now()
      return 'running'
    }

    // Waiting: low CPU for a while but not too long
    if (task.metrics.idleDuration > this.config.idleThresholdMs && task.metrics.idleDuration < 30000) {
      return 'waiting'
    }

    // Idle: low CPU for a long time
    if (task.metrics.idleDuration > 30000) {
      return 'idle'
    }

    // Default to running for any active process
    if (recentAvg > 2) {
      return 'running'
    }

    return 'waiting'
  }

  /** Record a state transition in the task's timeline */
  private recordTimelineEntry(taskId: string, status: AITaskState, detail?: string): void {
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

    task.endTime = Date.now()
    task.status.state = status === 'error' ? 'error' : 'completed'
    task.monitorState = status === 'error' ? 'error' : 'completed'

    const historyEntry: AITaskHistory = {
      id: task.id,
      toolType: task.toolType,
      projectId: task.projectId,
      startTime: task.startTime,
      endTime: task.endTime,
      duration: task.endTime - task.startTime,
      status
    }

    this.history.push(historyEntry)
    const MAX_HISTORY = 1000
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY)
    }
    const taskAlias = task.alias
    const taskWindowHwnd = task.windowHwnd
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
    // Clear all confirmation timers
    for (const [, ct] of this.confirmationTimers) {
      clearTimeout(ct.timer)
    }
    this.confirmationTimers.clear()
    this.tasks.clear()
    this.history = []
    this.timelines.clear()
    this.autoNameCounters.clear()
    this._previousIOCounters.clear()
    this._prevChildPids.clear()
    this._refreshCycleCount = 0
    this.removeAllListeners()
  }
}
