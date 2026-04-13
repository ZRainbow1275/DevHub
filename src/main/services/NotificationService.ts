import { Notification, BrowserWindow } from 'electron'
import {
  NotificationType,
  NotificationConfig,
  AppNotification
} from '@shared/types-extended'

export class NotificationService {
  private config: NotificationConfig = {
    enabled: true,
    types: {
      'task-complete': true,
      'task-error': true,
      'port-conflict': true,
      'zombie-process': true,
      'high-resource': true,
      'project-error': true
    },
    sound: true,
    persistent: false
  }
  private history: AppNotification[] = []
  private mainWindow: BrowserWindow | null = null

  // 通知去重：基于 dedup key + 时间窗口
  private recentNotifications = new Map<string, number>()
  private static readonly DEDUP_WINDOW_MS = 30000 // 30秒去重窗口

  // 改进：添加定期清理机制
  private cleanupInterval: NodeJS.Timeout | null = null
  private static readonly CLEANUP_INTERVAL_MS = 30000  // 每 30 秒清理一次

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || null
    this.startCleanupTimer()
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  setConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): NotificationConfig {
    return { ...this.config }
  }

  isTypeEnabled(type: NotificationType): boolean {
    return this.config.enabled && this.config.types[type]
  }

  /**
   * 检查通知是否在去重窗口内（防止 ToolMonitor 和 AITaskTracker 重复发送）
   * @param dedupKey 去重键（例如 toolId 或 toolType）
   * @returns true 表示应该被去重（跳过），false 表示可以发送
   */
  isDuplicate(dedupKey: string): boolean {
    const lastTime = this.recentNotifications.get(dedupKey)
    if (lastTime === undefined) return false
    return (Date.now() - lastTime) < NotificationService.DEDUP_WINDOW_MS
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupRecentNotifications()
    }, NotificationService.CLEANUP_INTERVAL_MS)

    // 设置 unref 避免定时器阻止进程退出
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  private cleanupRecentNotifications(): void {
    const now = Date.now()
    let cleaned = 0
    for (const [key, time] of this.recentNotifications) {
      if (now - time >= NotificationService.DEDUP_WINDOW_MS) {
        this.recentNotifications.delete(key)
        cleaned++
      }
    }
    if (cleaned > 0) {
      console.warn(`Cleaned ${cleaned} expired dedup entries`)
    }
  }

  /**
   * 记录已发送的通知用于去重
   */
  private recordNotification(dedupKey: string): void {
    this.recentNotifications.set(dedupKey, Date.now())
  }

  async notify(
    type: NotificationType,
    title: string,
    body: string,
    options?: {
      icon?: string
      actions?: { label: string; action: string }[]
      dedupKey?: string  // 可选的去重键
      metadata?: Record<string, unknown>  // arbitrary metadata for click-to-navigate etc.
    }
  ): Promise<void> {
    if (!this.isTypeEnabled(type)) return

    // 去重检查
    if (options?.dedupKey) {
      if (this.isDuplicate(options.dedupKey)) {
        return
      }
      this.recordNotification(options.dedupKey)
    }

    // Create notification record
    const notification: AppNotification = {
      id: `notif_${Date.now()}`,
      type,
      title,
      body,
      icon: options?.icon,
      actions: options?.actions,
      createdAt: Date.now(),
      read: false
    }

    this.history.unshift(notification)
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100)
    }

    // Send to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('notification:new', notification)
    }

    // Capture metadata for click handler closure
    const metadata = options?.metadata

    // Show system notification
    if (Notification.isSupported()) {
      const systemNotif = new Notification({
        title,
        body,
        silent: !this.config.sound
      })

      systemNotif.on('click', () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.show()
          this.mainWindow.focus()

          // If metadata contains a taskId, send navigate-to-task to renderer
          if (metadata?.taskId && typeof metadata.taskId === 'string') {
            this.mainWindow.webContents.send('navigate-to-task', metadata.taskId)
          }

          // If metadata contains windowHwnd, tell renderer to focus that external window
          if (metadata?.windowHwnd && typeof metadata.windowHwnd === 'number') {
            this.mainWindow.webContents.send('notification:focus-window', metadata.windowHwnd)
          }
        }
      })

      systemNotif.show()
    }
  }

  notifyTaskComplete(
    toolName: string,
    duration: number,
    alias?: string,
    taskId?: string,
    windowHwnd?: number,
    pid?: number
  ): void {
    const displayName = alias ?? toolName
    const durationSec = Math.round(duration / 1000)
    const durationMin = Math.floor(durationSec / 60)
    const durationRemSec = durationSec % 60
    const durationStr = durationMin > 0
      ? `${durationMin}分${durationRemSec}秒`
      : `${durationSec}秒`

    const title = `[${displayName}] 任务完成`
    const bodyParts = [`${toolName}`]
    if (pid) bodyParts[0] += ` (PID:${pid})`
    bodyParts.push(`持续时间: ${durationStr}`)

    this.notify(
      'task-complete',
      title,
      bodyParts.join('\n'),
      {
        dedupKey: `task-complete:${toolName}:${taskId ?? ''}`,
        metadata: {
          taskId,
          windowHwnd,
          aliasOrToolName: displayName
        }
      }
    )
  }

  /** Notify about an AI task error */
  notifyTaskError(
    toolName: string,
    alias?: string,
    taskId?: string,
    windowHwnd?: number,
    pid?: number
  ): void {
    const displayName = alias ?? toolName
    this.notify(
      'task-error',
      `[${displayName}] 检测到错误`,
      `${toolName}${pid ? ` (PID:${pid})` : ''}`,
      {
        dedupKey: `task-error:${taskId ?? toolName}`,
        metadata: {
          taskId,
          windowHwnd,
          aliasOrToolName: displayName
        }
      }
    )
  }

  notifyPortConflict(port: number, processName: string): void {
    this.notify(
      'port-conflict',
      '端口冲突检测',
      `端口 ${port} 被 ${processName} 占用`,
      {
        actions: [
          { label: '释放端口', action: `release-port:${port}` }
        ]
      }
    )
  }

  notifyZombieProcess(count: number): void {
    this.notify(
      'zombie-process',
      '僵尸进程检测',
      `检测到 ${count} 个可能的僵尸进程`,
      {
        actions: [
          { label: '清理', action: 'cleanup-zombies' }
        ]
      }
    )
  }

  notifyHighResource(processName: string, cpu: number, memory: number): void {
    const issues: string[] = []
    if (cpu > 80) issues.push(`CPU: ${cpu.toFixed(1)}%`)
    if (memory > 1000) issues.push(`内存: ${memory}MB`)

    this.notify(
      'high-resource',
      '资源使用警告',
      `${processName} 资源占用过高 (${issues.join(', ')})`
    )
  }

  notifyProjectError(projectName: string, error: string): void {
    this.notify(
      'project-error',
      `项目错误: ${projectName}`,
      error.length > 100 ? error.slice(0, 100) + '...' : error
    )
  }

  getHistory(limit?: number): AppNotification[] {
    return limit ? this.history.slice(0, limit) : [...this.history]
  }

  markAsRead(notificationId: string): void {
    const notification = this.history.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
    }
  }

  markAllAsRead(): void {
    this.history.forEach(n => { n.read = true })
  }

  clearHistory(): void {
    this.history = []
  }

  getUnreadCount(): number {
    return this.history.filter(n => !n.read).length
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.recentNotifications.clear()
  }
}

let notificationService: NotificationService | null = null

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService()
  }
  return notificationService
}

export function initNotificationService(mainWindow: BrowserWindow): NotificationService {
  if (notificationService) {
    notificationService.destroy()
  }
  notificationService = new NotificationService(mainWindow)
  return notificationService
}
