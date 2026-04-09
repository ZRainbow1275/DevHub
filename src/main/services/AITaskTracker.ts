import { EventEmitter } from 'events'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  AITask,
  AITaskHistory,
  AIToolType,
  AITaskState,
  AI_TOOL_SIGNATURES,
  ProcessInfo,
  WindowInfo
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
  /finished\s+in\s+[\d.]+/i,
  /completed\s+successfully/i,
  /task\s+complete/i,
  /success/i,
  /waiting\s+for\s+input/i,
  /idle/i,
  /ready/i
]

// 错误指示模式
const ERROR_PATTERNS = [
  /error:/i,
  /failed/i,
  /exception/i,
  /fatal/i,
  /crash/i
]

interface AITaskDetectionConfig {
  outputPatternWeight: number
  cpuIdleWeight: number
  cursorWaitWeight: number
  timeThresholdWeight: number
  idleThresholdMs: number
  completionThreshold: number
}

export class AITaskTracker extends EventEmitter {
  private tasks = new Map<string, AITask>()
  private history: AITaskHistory[] = []
  private processScanner: SystemProcessScanner
  private aliasManager: AIAliasManager
  private refreshInterval: number = 2000
  private refreshTimer: NodeJS.Timeout | null = null
  private config: AITaskDetectionConfig = {
    outputPatternWeight: 0.4,
    cpuIdleWeight: 0.25,
    cursorWaitWeight: 0.2,
    timeThresholdWeight: 0.15,
    idleThresholdMs: 5000,
    completionThreshold: 0.7
  }

  constructor(processScanner: SystemProcessScanner, aliasManager?: AIAliasManager) {
    super()
    this.setMaxListeners(20)
    this.processScanner = processScanner
    this.aliasManager = aliasManager ?? new AIAliasManager()
  }

  getAliasManager(): AIAliasManager {
    return this.aliasManager
  }

  setConfig(config: Partial<AITaskDetectionConfig>): void {
    this.config = { ...this.config, ...config }
  }

  startTracking(): void {
    if (this.refreshTimer) return
    this.refreshTimer = setInterval(async () => {
      // 一次性获取进程列表，供 scan 和 update 共用，避免重复系统调用
      const processes = await this.processScanner.getAll()
      await this.scanForAITasks(processes)
      await this.updateTaskStatuses(processes)
    }, this.refreshInterval)
  }

  stopTracking(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
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
          metrics: {
            cpuHistory: [process.cpu],
            outputLineCount: 0,
            lastOutputTime: Date.now(),
            idleDuration: 0
          }
        }

        // Match alias
        const matchedAlias = this.aliasManager.matchAlias(matchedWindow, process, toolType)
        if (matchedAlias) {
          task.alias = matchedAlias.alias
          task.aliasColor = matchedAlias.color
          this.aliasManager.updateLastMatched(matchedAlias.id)
        }

        this.tasks.set(task.id, task)
        newTasks.push(task)
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
          const matchedAlias = this.aliasManager.matchAlias(matchedWindow, process, toolType)
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

    for (const [taskId, task] of this.tasks) {
      const process = processMap.get(task.pid)
      if (!process) continue

      // Update CPU history
      task.metrics.cpuHistory.push(process.cpu)
      if (task.metrics.cpuHistory.length > 30) {
        task.metrics.cpuHistory.shift()
      }

      // 检测窗口标题模式
      const { isComplete, isError } = await this.detectWindowTitlePattern(task)

      // Calculate completion score
      let completionScore = this.calculateCompletionScore(task, process.cpu)

      // 如果窗口标题检测到完成模式，增加分数
      if (isComplete) {
        completionScore += this.config.outputPatternWeight * 0.5
      }

      // 如果检测到错误模式，直接标记为错误
      if (isError) {
        task.status.state = 'error'
        this.emit('task-status-changed', task)
        this.completeTask(taskId, 'error')
        continue
      }

      // Determine new state
      const prevState = task.status.state
      const newState = this.determineState(task, completionScore)

      if (newState !== prevState) {
        task.status.state = newState
        this.emit('task-status-changed', task)

        if (newState === 'completed' || newState === 'error') {
          this.completeTask(taskId, newState === 'error' ? 'error' : 'completed')
        }
      }
    }
  }

  private calculateCompletionScore(task: AITask, currentCpu: number): number {
    let score = 0

    // CPU idle detection (25% weight)
    const avgCpu = task.metrics.cpuHistory.reduce((a, b) => a + b, 0) / task.metrics.cpuHistory.length
    if (avgCpu < 2 && currentCpu < 1) {
      score += this.config.cpuIdleWeight
    }

    // Idle duration (15% weight) - proxy for time threshold
    const now = Date.now()
    const lastActivity = task.status.lastActivity
    const idleDuration = now - lastActivity
    task.metrics.idleDuration = idleDuration

    if (idleDuration > this.config.idleThresholdMs) {
      score += this.config.timeThresholdWeight
    }

    // CPU variance detection (20% weight) - low variance = likely idle/complete
    const recentCpuVariance = this.calculateVariance(task.metrics.cpuHistory.slice(-10))
    if (recentCpuVariance < 0.5) {
      score += this.config.outputPatternWeight * 0.5
    }

    // Window title pattern detection (20% weight) - 异步检测
    if (task.windowHwnd && task.status.currentAction) {
      if (COMPLETION_PATTERNS.some(p => p.test(task.status.currentAction || ''))) {
        score += this.config.outputPatternWeight * 0.5
      }
    }

    return score
  }

  async detectWindowTitlePattern(task: AITask): Promise<{ isComplete: boolean; isError: boolean }> {
    if (!task.windowHwnd) {
      return { isComplete: false, isError: false }
    }

    // 验证 hwnd 防止命令注入
    if (!validateHwnd(task.windowHwnd)) {
      console.warn(`Invalid hwnd for detectWindowTitlePattern: ${task.windowHwnd}`)
      return { isComplete: false, isError: false }
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
        { windowsHide: true }
      )

      const title = stdout.trim()
      task.status.currentAction = title

      const isComplete = COMPLETION_PATTERNS.some(p => p.test(title))
      const isError = ERROR_PATTERNS.some(p => p.test(title))

      return { isComplete, isError }
    } catch (error) {
      console.warn('detectWindowTitlePattern failed:', error instanceof Error ? error.message : 'Unknown error')
      return { isComplete: false, isError: false }
    }
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  }

  private determineState(task: AITask, completionScore: number): AITaskState {
    const avgCpu = task.metrics.cpuHistory.reduce((a, b) => a + b, 0) / task.metrics.cpuHistory.length

    if (completionScore >= this.config.completionThreshold) {
      return 'completed'
    }

    if (avgCpu > 10) {
      task.status.lastActivity = Date.now()
      return 'running'
    }

    if (task.metrics.idleDuration > this.config.idleThresholdMs) {
      return 'waiting'
    }

    return 'idle'
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

    task.endTime = Date.now()
    task.status.state = status === 'error' ? 'error' : 'completed'

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
    this.tasks.delete(taskId)
    this.emit('task-completed', historyEntry, taskAlias)
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

  cleanup(): void {
    this.stopTracking()
    this.tasks.clear()
    this.history = []
    this.removeAllListeners()
  }
}
