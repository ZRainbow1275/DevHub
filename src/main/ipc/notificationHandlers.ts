import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS_EXT, NotificationConfig, AppNotification } from '@shared/types-extended'
import { initNotificationService, getNotificationService, NotificationService } from '../services/NotificationService'
import { guardProtoPollution, validateObject } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { getPortScanner } from './processHandlers'

const NOTIFICATION_CONFIG_ALLOWED_FIELDS = ['enabled', 'types', 'sound', 'persistent']

let notificationService: NotificationService | null = null

export function setupNotificationHandlers(mainWindow: BrowserWindow): void {
  notificationService = initNotificationService(mainWindow)

  ipcMain.handle(IPC_CHANNELS_EXT.NOTIFICATION_GET_CONFIG, withRateLimit(
    IPC_CHANNELS_EXT.NOTIFICATION_GET_CONFIG, RATE_LIMITS.QUERY,
    async (): Promise<NotificationConfig> => {
      return notificationService?.getConfig() ?? {
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
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.NOTIFICATION_SET_CONFIG, withRateLimit(
    IPC_CHANNELS_EXT.NOTIFICATION_SET_CONFIG, RATE_LIMITS.ACTION,
    async (_, config: Partial<NotificationConfig>): Promise<NotificationConfig> => {
      // Validate config is an object
      validateObject(config, 'config')
      // Check prototype pollution
      guardProtoPollution(config)
      // Apply field whitelist
      const sanitizedConfig: Partial<NotificationConfig> = {}
      for (const key of Object.keys(config)) {
        if (NOTIFICATION_CONFIG_ALLOWED_FIELDS.includes(key)) {
          ;(sanitizedConfig as Record<string, unknown>)[key] = (config as Record<string, unknown>)[key]
        }
      }
      // Validate types field if present
      if (sanitizedConfig.types !== undefined) {
        if (typeof sanitizedConfig.types !== 'object' || sanitizedConfig.types === null) {
          throw new Error('Invalid config: types must be an object')
        }
        guardProtoPollution(sanitizedConfig.types)
      }
      notificationService?.setConfig(sanitizedConfig)
      return notificationService?.getConfig() ?? {} as NotificationConfig
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.NOTIFICATION_GET_HISTORY, withRateLimit(
    IPC_CHANNELS_EXT.NOTIFICATION_GET_HISTORY, RATE_LIMITS.QUERY,
    async (_, limit?: number): Promise<AppNotification[]> => {
      if (limit !== undefined && (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 10000)) {
        throw new Error('Invalid limit: must be an integer between 1 and 10000')
      }
      return notificationService?.getHistory(limit) ?? []
    }
  ))

  ipcMain.handle('notification:mark-read', withRateLimit(
    'notification:mark-read', RATE_LIMITS.ACTION,
    async (_, notificationId: string): Promise<void> => {
      if (typeof notificationId !== 'string' || notificationId.length === 0) {
        throw new Error('Invalid notificationId: must be a non-empty string')
      }
      notificationService?.markAsRead(notificationId)
    }
  ))

  ipcMain.handle('notification:mark-all-read', withRateLimit(
    'notification:mark-all-read', RATE_LIMITS.ACTION,
    async (): Promise<void> => {
      notificationService?.markAllAsRead()
    }
  ))

  ipcMain.handle('notification:clear-history', withRateLimit(
    'notification:clear-history', RATE_LIMITS.ACTION,
    async (): Promise<void> => {
      notificationService?.clearHistory()
    }
  ))

  ipcMain.handle('notification:get-unread-count', withRateLimit(
    'notification:get-unread-count', RATE_LIMITS.QUERY,
    async (): Promise<number> => {
      return notificationService?.getUnreadCount() ?? 0
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.NOTIFICATION_ACTION, withRateLimit(
    IPC_CHANNELS_EXT.NOTIFICATION_ACTION, RATE_LIMITS.ACTION,
    async (_, notificationId: string, action: string): Promise<void> => {
      // Validate inputs
      if (typeof notificationId !== 'string' || notificationId.length === 0) {
        throw new Error('Invalid notificationId: must be a non-empty string')
      }
      if (typeof action !== 'string' || action.length === 0) {
        throw new Error('Invalid action: must be a non-empty string')
      }
      // Handle notification actions
      if (action.startsWith('release-port:')) {
        const portStr = action.split(':')[1]
        const port = parseInt(portStr, 10)
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error('Invalid port: must be a number between 1 and 65535')
        }
        // Call portScanner directly in main process instead of bouncing through renderer
        const scanner = getPortScanner()
        if (scanner) {
          await scanner.releasePort(port)
        }
      } else if (action === 'cleanup-zombies') {
        mainWindow.webContents.send('notification:action', { notificationId, action })
      }
    }
  ))
}

export function cleanupNotificationHandlers(): void {
  notificationService?.destroy()
  ipcMain.removeHandler(IPC_CHANNELS_EXT.NOTIFICATION_GET_CONFIG)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.NOTIFICATION_SET_CONFIG)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.NOTIFICATION_GET_HISTORY)
  ipcMain.removeHandler('notification:mark-read')
  ipcMain.removeHandler('notification:mark-all-read')
  ipcMain.removeHandler('notification:clear-history')
  ipcMain.removeHandler('notification:get-unread-count')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.NOTIFICATION_ACTION)
}

export { getNotificationService }
