import { ipcMain, BrowserWindow, Notification } from 'electron'
import { IPC_CHANNELS_EXT, AITask, AITaskHistory, AIToolType } from '@shared/types-extended'
import { AITaskTracker } from '../services/AITaskTracker'
import { getProcessScanner } from './processHandlers'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'

let aiTaskTracker: AITaskTracker | null = null

export function setupAITaskHandlers(mainWindow: BrowserWindow): void {
  const processScanner = getProcessScanner()
  if (!processScanner) {
    console.error('Process scanner not initialized')
    return
  }

  aiTaskTracker = new AITaskTracker(processScanner)

  // Set up event listeners
  aiTaskTracker.on('task-started', (task: AITask) => {
    mainWindow.webContents.send('ai-task:started', task)
  })

  aiTaskTracker.on('task-status-changed', (task: AITask) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_STATUS_CHANGED, task)
  })

  aiTaskTracker.on('task-completed', (history: AITaskHistory) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, history)

    // Show Windows notification
    if (Notification.isSupported()) {
      const toolNames: Record<AIToolType, string> = {
        'codex': 'Codex',
        'claude-code': 'Claude Code',
        'gemini-cli': 'Gemini CLI',
        'cursor': 'Cursor',
        'other': 'AI Tool'
      }

      const notification = new Notification({
        title: `${toolNames[history.toolType]} 任务完成`,
        body: `任务耗时: ${Math.round(history.duration / 1000)}秒`,
        icon: undefined,
        silent: false
      })

      notification.on('click', () => {
        mainWindow.show()
        mainWindow.focus()
      })

      notification.show()
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
}

export function getAITaskTracker(): AITaskTracker | null {
  return aiTaskTracker
}
