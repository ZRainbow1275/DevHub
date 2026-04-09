import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS_EXT, AITask, AITaskHistory, AIToolType, AIWindowAlias } from '@shared/types-extended'
import { AITaskTracker } from '../services/AITaskTracker'
import { AIAliasManager } from '../services/AIAliasManager'
import { getProcessScanner } from './processHandlers'
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

  // Set up event listeners
  aiTaskTracker.on('task-started', (task: AITask) => {
    mainWindow.webContents.send('ai-task:started', task)
  })

  aiTaskTracker.on('task-status-changed', (task: AITask) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_STATUS_CHANGED, task)
  })

  aiTaskTracker.on('task-completed', (history: AITaskHistory, taskAlias?: string) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, history)

    // 通过 NotificationService 发送通知（自动去重，与 ToolMonitor 协调）
    const notificationService = getNotificationService()
    const toolDisplayNames: Record<AIToolType, string> = {
      'codex': 'Codex CLI',
      'claude-code': 'Claude Code',
      'gemini-cli': 'Gemini CLI',
      'cursor': 'Cursor',
      'other': 'AI Tool'
    }

    const toolName = toolDisplayNames[history.toolType]
    notificationService.notifyTaskComplete(toolName, history.duration, taskAlias)
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
}

export function cleanupAITaskHandlers(): void {
  if (aiTaskTracker) {
    aiTaskTracker.stopTracking()
    aiTaskTracker.removeAllListeners()
  }

  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_SCAN)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_ACTIVE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_HISTORY)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_START_TRACKING)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_STOP_TRACKING)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_STATISTICS)
  ipcMain.removeHandler('ai-task:get-by-id')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_GET_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_SET)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_REMOVE)
}

export function getAITaskTracker(): AITaskTracker | null {
  return aiTaskTracker
}
