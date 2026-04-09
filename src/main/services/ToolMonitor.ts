import { execFile } from 'child_process'
import { promisify } from 'util'
import { CodingTool } from '@shared/types'

const execFileAsync = promisify(execFile)

type CompletionCallback = (tool: CodingTool) => void

// 严格的进程名白名单 - 只允许这些进程名用于检测
const VALID_PROCESS_NAMES = ['codex', 'claude', 'gemini', 'node', 'cursor', 'code', 'windsurf'] as const
type ValidProcessName = typeof VALID_PROCESS_NAMES[number]

function isValidProcessName(name: string): name is ValidProcessName {
  return VALID_PROCESS_NAMES.includes(name.toLowerCase() as ValidProcessName)
}

// 工具检测配置
interface ToolDetectionConfig {
  processNames: ValidProcessName[]  // 可能的进程名 (严格类型)
  commandPatterns: string[]         // 命令行参数中的关键词
}

// 工具检测配置 - 使用精确匹配模式
interface ToolDetectionConfigExt extends ToolDetectionConfig {
  excludePatterns?: string[]  // 排除包含这些关键词的进程
}

const TOOL_DETECTION_CONFIG: Record<string, ToolDetectionConfigExt> = {
  'codex': {
    processNames: ['codex', 'node'],
    // 精确匹配 @openai/codex 路径，避免匹配到其他包含 codex 的包
    commandPatterns: ['@openai/codex', '/codex/bin/codex.js'],
    excludePatterns: ['codex-mcp', 'mcp-server']
  },
  'claude-code': {
    processNames: ['claude', 'node'],
    // 精确匹配 claude-code CLI 路径
    commandPatterns: ['@anthropic-ai/claude-code', '/claude-code/cli.js'],
    excludePatterns: ['mcp-server']
  },
  'gemini-cli': {
    processNames: ['gemini', 'node'],
    commandPatterns: ['gemini-cli', '@google/gemini-cli'],
    excludePatterns: ['mcp-server']
  }
}

export class ToolMonitor {
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private tools: CodingTool[] = []
  private previousStatus = new Map<string, boolean>()
  private onCompletion: CompletionCallback | null = null
  private statusResetTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private isStopped: boolean = true

  // 通知去重：记录每个工具最后一次发送完成通知的时间戳
  private lastNotificationTime = new Map<string, number>()
  private static readonly NOTIFICATION_DEDUP_WINDOW_MS = 30000 // 30秒内同一工具不重复通知

  // 智能轮询配置
  private baseIntervalMs: number = 3000
  private activeIntervalMs: number = 1000  // 活跃时快速轮询
  private idleIntervalMs: number = 5000    // 空闲时慢速轮询
  private currentIntervalMs: number = 3000
  private consecutiveIdleCount: number = 0
  private idleThreshold: number = 3  // 连续3次空闲后切换到慢速模式

  start(
    tools: CodingTool[],
    checkIntervalMs: number,
    onCompletion: CompletionCallback
  ): void {
    this.isStopped = false
    this.tools = tools
    this.onCompletion = onCompletion
    this.baseIntervalMs = checkIntervalMs
    this.currentIntervalMs = checkIntervalMs

    // Initialize previous status
    this.tools.forEach((tool) => {
      this.previousStatus.set(tool.id, false)
    })

    // Run initial check and start smart polling
    this.checkTools().then(() => {
      if (!this.isStopped) {
        this.scheduleNextCheck()
      }
    })
  }

  stop(): void {
    this.isStopped = true
    this.onCompletion = null

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    // 清理所有状态重置定时器
    this.statusResetTimers.forEach((timer) => clearTimeout(timer))
    this.statusResetTimers.clear()

    // 清理通知去重记录
    this.lastNotificationTime.clear()

    // 重置轮询状态
    this.consecutiveIdleCount = 0
    this.currentIntervalMs = this.baseIntervalMs
  }

  // 智能轮询调度
  private scheduleNextCheck(): void {
    if (this.isStopped) return

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    this.timeoutId = setTimeout(() => {
      if (this.isStopped) return
      this.checkTools().then(() => {
        if (!this.isStopped) {
          this.scheduleNextCheck()
        }
      })
    }, this.currentIntervalMs)
  }

  // 根据活跃状态调整轮询间隔
  private adjustPollingInterval(hasActiveTools: boolean): void {
    if (hasActiveTools) {
      // 有工具运行时，使用快速轮询
      this.currentIntervalMs = this.activeIntervalMs
      this.consecutiveIdleCount = 0
    } else {
      // 空闲时，逐步降低轮询频率
      this.consecutiveIdleCount++
      if (this.consecutiveIdleCount >= this.idleThreshold) {
        this.currentIntervalMs = this.idleIntervalMs
      } else {
        this.currentIntervalMs = this.baseIntervalMs
      }
    }
  }

  private scheduleStatusReset(toolId: string, delay: number = 5000): void {
    if (this.isStopped) return

    // 清除之前的定时器
    const existing = this.statusResetTimers.get(toolId)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = setTimeout(() => {
      if (this.isStopped) return
      const tool = this.tools.find(t => t.id === toolId)
      if (tool) {
        tool.status = 'idle'
      }
      this.statusResetTimers.delete(toolId)
    }, delay)

    this.statusResetTimers.set(toolId, timer)
  }

  private async checkTools(): Promise<void> {
    // 已停止时不做任何检查
    if (this.isStopped) return

    let hasActiveTools = false
    const failedToolDetections: Map<string, string> = new Map()

    // 一次性获取所有进程列表，避免为每个工具单独调用 tasklist
    let allProcessNames: Set<string>
    try {
      allProcessNames = await this.getAllProcessNames()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.warn(`Failed to get process list: ${errorMsg}`)
      // 关键修复：进程列表获取失败时，清除 previousStatus 以避免
      // 下次成功检查时误判"从 running 到 stopped"的状态转变
      this.previousStatus.clear()
      this.tools.forEach((tool) => {
        this.previousStatus.set(tool.id, false)
      })
      this.adjustPollingInterval(false)
      return
    }

    // 二次检查：获取进程列表期间可能已被 stop()
    if (this.isStopped) return

    // 预先获取命令行信息（仅在有 node 进程时才需要）
    let commandLines: string[] | null = null
    if (allProcessNames.has('node.exe')) {
      try {
        commandLines = await this.getNodeCommandLines()
      } catch (error) {
        console.warn(
          'Failed to get node command lines:',
          error instanceof Error ? error.message : 'Unknown error'
        )
        // 如果无法获取详细命令行，则 node 进程检测会失败
        // 这是可接受的，至少进程列表是可用的
      }
    }

    for (const tool of this.tools) {
      // 检查是否已停止
      if (this.isStopped) return

      try {
        const isRunning = this.isToolDetected(tool.id, allProcessNames, commandLines)
        const wasRunning = this.previousStatus.get(tool.id) ?? false

        if (isRunning) {
          hasActiveTools = true
        }

        // Update tool status
        if (isRunning) {
          tool.status = 'running'
          tool.lastRunAt = Date.now()
        } else if (wasRunning && !isRunning) {
          // Transition from running to stopped = completed
          tool.status = 'completed'
          tool.lastCompletedAt = Date.now()

          // 通知去重：检查是否在去重时间窗口内
          if (this.shouldSendNotification(tool.id)) {
            this.lastNotificationTime.set(tool.id, Date.now())
            this.onCompletion?.(tool)
          }

          // 使用安全的状态重置方法
          this.scheduleStatusReset(tool.id)
        } else {
          tool.status = 'idle'
        }

        this.previousStatus.set(tool.id, isRunning)
      } catch (error) {
        // 改进：单个工具检测失败，记录但不中断其他工具检测
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        failedToolDetections.set(tool.id, errorMsg)
        console.warn(`Tool detection failed for ${tool.id}: ${errorMsg}`)

        // 改进：失败时保留原有状态，不更新
        // 这样多次失败也不会造成虚假状态转变
      }
    }

    // 改进：在循环结束后统一日志输出失败信息
    if (failedToolDetections.size > 0) {
      const failedList = Array.from(failedToolDetections.entries())
        .map(([id, err]) => `${id}(${err})`)
        .join('; ')
      console.warn(`Tool detection batch had ${failedToolDetections.size} failures: ${failedList}`)
    }

    // 根据活跃状态调整下次轮询间隔
    this.adjustPollingInterval(hasActiveTools)
  }

  // 检查是否应该发送通知（去重逻辑）
  private shouldSendNotification(toolId: string): boolean {
    if (this.isStopped) return false

    const lastTime = this.lastNotificationTime.get(toolId)
    if (lastTime === undefined) return true

    return (Date.now() - lastTime) >= ToolMonitor.NOTIFICATION_DEDUP_WINDOW_MS
  }

  // 一次性获取所有进程名称（CSV 格式，解析后返回 Set）
  private async getAllProcessNames(): Promise<Set<string>> {
    const { stdout } = await execFileAsync(
      'tasklist',
      ['/FO', 'CSV', '/NH'],
      { windowsHide: true }
    )
    const names = new Set<string>()
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // CSV format: "ImageName","PID","Session Name","Session#","Mem Usage"
      const match = trimmed.match(/^"([^"]+)"/)
      if (match) {
        names.add(match[1].toLowerCase())
      }
    }
    return names
  }

  // 获取所有 node 进程的命令行（仅调用一次）
  private async getNodeCommandLines(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*node*' } | Select-Object -ExpandProperty CommandLine"],
        { windowsHide: true, maxBuffer: 1024 * 1024 }
      )
      return stdout.split('\n').filter(l => l.trim())
    } catch (error) {
      console.warn(
        'PowerShell command line check failed:',
        error instanceof Error ? error.message : 'Unknown error'
      )
      return []
    }
  }

  // 基于已获取的进程列表判断工具是否在运行（纯内存匹配，无系统调用）
  private isToolDetected(
    toolId: string,
    allProcessNames: Set<string>,
    commandLines: string[] | null
  ): boolean {
    const config = TOOL_DETECTION_CONFIG[toolId]
    if (!config) {
      return false
    }

    for (const pName of config.processNames) {
      if (!isValidProcessName(pName)) continue

      // 检查进程是否存在于全局进程列表中
      if (!allProcessNames.has(`${pName}.exe`)) continue

      if (pName === 'node') {
        // node 进程需要进一步检查命令行参数
        if (!commandLines) continue
        for (const line of commandLines) {
          const lowerLine = line.toLowerCase()
          const matchesPattern = config.commandPatterns.some(p => lowerLine.includes(p.toLowerCase()))
          if (!matchesPattern) continue
          const isExcluded = config.excludePatterns?.some(p => lowerLine.includes(p.toLowerCase())) ?? false
          if (!isExcluded) return true
        }
      } else {
        return true
      }
    }

    return false
  }


  getToolStatus(toolId: string): CodingTool | undefined {
    return this.tools.find((t) => t.id === toolId)
  }

  getAllToolStatus(): CodingTool[] {
    return [...this.tools]
  }

  async checkToolNow(toolId: string): Promise<CodingTool | undefined> {
    const tool = this.tools.find((t) => t.id === toolId)
    if (!tool) return undefined

    const allProcessNames = await this.getAllProcessNames()
    let commandLines: string[] | null = null
    if (allProcessNames.has('node.exe')) {
      commandLines = await this.getNodeCommandLines()
    }
    const isRunning = this.isToolDetected(tool.id, allProcessNames, commandLines)
    tool.status = isRunning ? 'running' : 'idle'

    return tool
  }

  // 获取当前轮询间隔（用于调试）
  getCurrentInterval(): number {
    return this.currentIntervalMs
  }
}
