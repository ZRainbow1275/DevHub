import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS_EXT, AITask, AITaskHistory, AIToolType, AIWindowAlias, AIToolDetectionConfig, ProgressEstimate, TimelineEntry } from '@shared/types-extended'
import { AITaskTracker } from '../services/AITaskTracker'
import { AIAliasManager } from '../services/AIAliasManager'
import { getProcessScanner } from './processHandlers'
import { getWindowManager } from './windowHandlers'
import { getNotificationService } from '../services/NotificationService'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { validateString, validateObject, guardProtoPollution } from '../utils/validation'

let aiTaskTracker: AITaskTracker | null = null
let aliasManager: AIAliasManager | null = null

export function setupAITaskHandlers(mainWindow: BrowserWindow): void {
  const processScanner = getProcessScanner()
  if (!processScanner) {
    console.error('Process scanner not initialized')
    return
  }

  aliasManager = new AIAliasManager()
  aiTaskTracker = new AITaskTracker(processScanner, aliasManager)

  // Wire window scanner so AITaskTracker can match windows to tasks
  aiTaskTracker.setWindowScanner(async () => {
    const wm = getWindowManager()
    if (!wm) return []
    const result = await wm.scanWindows()
    return result.data ?? []
  })

  // Set up event listeners
  aiTaskTracker.on('task-started', (task: AITask) => {
    mainWindow.webContents.send('ai-task:started', task)
  })

  aiTaskTracker.on('task-status-changed', (task: AITask) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_STATUS_CHANGED, task)
  })

  aiTaskTracker.on('task-completed', (history: AITaskHistory, taskAlias?: string, taskWindowHwnd?: number) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, history)

    // 通过 NotificationService 发送通知（自动去重，与 ToolMonitor 协调）
    const notificationService = getNotificationService()
    const toolName = AIAliasManager.getToolDisplayName(history.toolType)
    notificationService.notifyTaskComplete(
      toolName,
      history.duration,
      taskAlias,
      history.id,
      taskWindowHwnd,
      undefined // pid not available from history, only from live task
    )
  })

  // Error notification
  aiTaskTracker.on('task-status-changed', (task: AITask) => {
    if (task.status.state === 'error') {
      const notificationService = getNotificationService()
      const toolName = AIAliasManager.getToolDisplayName(task.toolType)
      notificationService.notifyTaskError(toolName, task.alias, task.id, task.windowHwnd, task.pid)
    }
  })

  // Start tracking
  aiTaskTracker.startTracking()

  // IPC Handlers
  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_SCAN, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_SCAN, RATE_LIMITS.SCAN,
    async (): Promise<AITask[]> => {
      if (!aiTaskTracker) return []
      return aiTaskTracker.scanForAITasks()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_ACTIVE, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_ACTIVE, RATE_LIMITS.QUERY,
    async (): Promise<AITask[]> => {
      if (!aiTaskTracker) return []
      return aiTaskTracker.getActiveTasks()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_ALL, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_ALL, RATE_LIMITS.QUERY,
    async (): Promise<AITask[]> => {
      if (!aiTaskTracker) return []
      return aiTaskTracker.getActiveTasks()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_HISTORY, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_HISTORY, RATE_LIMITS.QUERY,
    async (_, limit?: number): Promise<AITaskHistory[]> => {
      if (!aiTaskTracker) return []
      if (limit !== undefined) {
        if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 10000) {
          console.warn(`Invalid limit for AI task history: ${limit}`)
          return []
        }
      }
      return aiTaskTracker.getHistory(limit)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_START_TRACKING, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_START_TRACKING, RATE_LIMITS.ACTION,
    async (_, pid: number): Promise<AITask | null> => {
      if (!aiTaskTracker) return null
      aiTaskTracker.startTracking()
      // Return the task associated with this PID if it exists after scanning
      const tasks = await aiTaskTracker.scanForAITasks()
      return tasks.find(t => t.pid === pid) || null
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_STOP_TRACKING, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_STOP_TRACKING, RATE_LIMITS.ACTION,
    async (): Promise<boolean> => {
      if (!aiTaskTracker) return false
      aiTaskTracker.stopTracking()
      return true
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_STATISTICS, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_STATISTICS, RATE_LIMITS.QUERY,
    async () => {
      if (!aiTaskTracker) return null
      return aiTaskTracker.getStatistics()
    }
  ))

  ipcMain.handle('ai-task:get-by-id', withRateLimit(
    'ai-task:get-by-id', RATE_LIMITS.QUERY,
    async (_, taskId: unknown): Promise<AITask | undefined> => {
      if (!aiTaskTracker) return undefined
      if (typeof taskId !== 'string' || taskId.trim().length === 0) {
        console.warn(`Invalid taskId for get-by-id: ${taskId}`)
        return undefined
      }
      return aiTaskTracker.getTaskById(taskId)
    }
  ))

  // ==================== Progress / Phase Handlers ====================

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_PROGRESS, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_PROGRESS, RATE_LIMITS.QUERY,
    async (_, taskId: unknown): Promise<ProgressEstimate | null> => {
      if (!aiTaskTracker) return null
      if (typeof taskId !== 'string' || taskId.trim().length === 0) {
        console.warn(`Invalid taskId for get-progress: ${taskId}`)
        return null
      }
      return aiTaskTracker.getProgress(taskId)
    }
  ))

  ipcMain.handle('ai-task:get-timeline', withRateLimit(
    'ai-task:get-timeline', RATE_LIMITS.QUERY,
    async (_, taskId: unknown): Promise<TimelineEntry[]> => {
      if (!aiTaskTracker) return []
      if (typeof taskId !== 'string' || taskId.trim().length === 0) {
        console.warn(`Invalid taskId for get-timeline: ${taskId}`)
        return []
      }
      return aiTaskTracker.getTimeline(taskId)
    }
  ))

  // ==================== False Positive / Detection Config ====================

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_MARK_FALSE_POSITIVE, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_MARK_FALSE_POSITIVE, RATE_LIMITS.ACTION,
    async (_, taskId: unknown): Promise<boolean> => {
      if (!aiTaskTracker) return false
      if (typeof taskId !== 'string' || taskId.trim().length === 0) {
        console.warn(`Invalid taskId for mark-false-positive: ${taskId}`)
        return false
      }
      aiTaskTracker.markFalsePositive(taskId as string)
      return true
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_SET_DETECTION_CONFIG, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_SET_DETECTION_CONFIG, RATE_LIMITS.ACTION,
    async (_, toolType: unknown, config: unknown): Promise<boolean> => {
      if (!aiTaskTracker) return false
      validateString(toolType, 'toolType')
      validateObject(config, 'config')
      guardProtoPollution(config)
      aiTaskTracker.setToolDetectionConfig(toolType as AIToolType, config as Partial<AIToolDetectionConfig>)
      return true
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_DETECTION_CONFIG, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_DETECTION_CONFIG, RATE_LIMITS.QUERY,
    async (_, toolType: unknown): Promise<AIToolDetectionConfig | null> => {
      if (!aiTaskTracker) return null
      validateString(toolType, 'toolType')
      return aiTaskTracker.getToolDetectionConfig(toolType as AIToolType) ?? null
    }
  ))

  // ==================== AI Alias Handlers ====================

  ipcMain.handle(IPC_CHANNELS_EXT.AI_ALIAS_GET_ALL, withRateLimit(
    IPC_CHANNELS_EXT.AI_ALIAS_GET_ALL, RATE_LIMITS.QUERY,
    async (): Promise<AIWindowAlias[]> => {
      if (!aliasManager) return []
      return aliasManager.getAll()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_ALIAS_SET, withRateLimit(
    IPC_CHANNELS_EXT.AI_ALIAS_SET, RATE_LIMITS.ACTION,
    async (_, alias: unknown): Promise<boolean> => {
      if (!aliasManager) return false
      validateObject(alias, 'alias')
      const a = alias as unknown as AIWindowAlias
      guardProtoPollution(alias)
      validateString(a.id, 'alias.id')
      validateString(a.alias, 'alias.alias', 100)
      if (!a.matchCriteria || typeof a.matchCriteria !== 'object') {
        throw new Error('Invalid alias: matchCriteria must be an object')
      }
      return aliasManager.set(a)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_ALIAS_REMOVE, withRateLimit(
    IPC_CHANNELS_EXT.AI_ALIAS_REMOVE, RATE_LIMITS.ACTION,
    async (_, aliasId: unknown): Promise<boolean> => {
      if (!aliasManager) return false
      validateString(aliasId, 'aliasId')
      return aliasManager.remove(aliasId as string)
    }
  ))

  ipcMain.handle('ai-alias:rename', withRateLimit(
    'ai-alias:rename', RATE_LIMITS.ACTION,
    async (_, aliasId: unknown, newName: unknown): Promise<boolean> => {
      if (!aliasManager) return false
      validateString(aliasId, 'aliasId')
      validateString(newName, 'newName', 50)
      return aliasManager.rename(aliasId as string, newName as string)
    }
  ))
}

export function cleanupAITaskHandlers(): void {
  if (aiTaskTracker) {
    aiTaskTracker.cleanup()
  }

  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_SCAN)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_ACTIVE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_HISTORY)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_START_TRACKING)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_STOP_TRACKING)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_STATISTICS)
  ipcMain.removeHandler('ai-task:get-by-id')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_PROGRESS)
  ipcMain.removeHandler('ai-task:get-timeline')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_MARK_FALSE_POSITIVE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_SET_DETECTION_CONFIG)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_DETECTION_CONFIG)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_GET_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_SET)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_REMOVE)
  ipcMain.removeHandler('ai-alias:rename')
}

export function getAITaskTracker(): AITaskTracker | null {
  return aiTaskTracker
}
