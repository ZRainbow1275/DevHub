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

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || null
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

  async notify(
    type: NotificationType,
    title: string,
    body: string,
    options?: {
      icon?: string
      actions?: { label: string; action: string }[]
    }
  ): Promise<void> {
    if (!this.isTypeEnabled(type)) return

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
        }
      })

      systemNotif.show()
    }
  }

  notifyTaskComplete(toolName: string, duration: number): void {
    this.notify(
      'task-complete',
      `${toolName} 任务完成`,
      `任务耗时: ${Math.round(duration / 1000)}秒`
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
}

let notificationService: NotificationService | null = null

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService()
  }
  return notificationService
}

export function initNotificationService(mainWindow: BrowserWindow): NotificationService {
  notificationService = new NotificationService(mainWindow)
  return notificationService
}
