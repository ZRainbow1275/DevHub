import { ipcMain, BrowserWindow } from 'electron'
import {
  TaskRecord,
  TaskStatistics,
  TaskType,
  TaskRecordStatus
} from '@shared/types-extended'
import { getTaskHistoryStore, TaskHistoryStore } from '../services/TaskHistoryStore'
import { guardProtoPollution, validateObject, validateDateString } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'

const VALID_TASK_TYPES: TaskType[] = ['ai-task', 'dev-server', 'build', 'test']
const VALID_TASK_STATUSES: TaskRecordStatus[] = ['running', 'completed', 'error', 'cancelled']
const TASK_UPDATE_ALLOWED_FIELDS = ['endTime', 'duration', 'status', 'metadata']

let taskHistoryStore: TaskHistoryStore | null = null

export function setupTaskHistoryHandlers(mainWindow: BrowserWindow): void {
  taskHistoryStore = getTaskHistoryStore()

  taskHistoryStore.on('record-added', (record: TaskRecord) => {
    mainWindow.webContents.send('task-history:record-added', record)
  })

  taskHistoryStore.on('record-updated', (record: TaskRecord) => {
    mainWindow.webContents.send('task-history:record-updated', record)
  })

  ipcMain.handle('task-history:add', withRateLimit(
    'task-history:add', RATE_LIMITS.ACTION,
    async (_, record: Omit<TaskRecord, 'id'>): Promise<TaskRecord> => {
      if (!taskHistoryStore) {
        taskHistoryStore = getTaskHistoryStore()
      }
      // Validate record is an object
      validateObject(record, 'record')
      // Check prototype pollution
      guardProtoPollution(record)
      // Validate required fields
      if (!record.type || !VALID_TASK_TYPES.includes(record.type)) {
        throw new Error(`Invalid record: type must be one of ${VALID_TASK_TYPES.join(', ')}`)
      }
      if (typeof record.toolOrCommand !== 'string' || record.toolOrCommand.length === 0) {
        throw new Error('Invalid record: toolOrCommand must be a non-empty string')
      }
      if (!record.startTime) {
        throw new Error('Invalid record: startTime is required')
      }
      if (!record.status || !VALID_TASK_STATUSES.includes(record.status)) {
        throw new Error(`Invalid record: status must be one of ${VALID_TASK_STATUSES.join(', ')}`)
      }
      return taskHistoryStore.addRecord(record)
    }
  ))

  ipcMain.handle('task-history:update', withRateLimit(
    'task-history:update', RATE_LIMITS.ACTION,
    async (_, id: string, updates: Partial<TaskRecord>): Promise<TaskRecord | undefined> => {
      // Validate id
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error('Invalid id: must be a non-empty string')
      }
      // Validate updates is an object
      validateObject(updates, 'updates')
      // Check prototype pollution
      guardProtoPollution(updates)
      // Apply field whitelist
      const sanitizedUpdates: Partial<TaskRecord> = {}
      for (const key of Object.keys(updates)) {
        if (TASK_UPDATE_ALLOWED_FIELDS.includes(key)) {
          ;(sanitizedUpdates as Record<string, unknown>)[key] = (updates as Record<string, unknown>)[key]
        }
      }
      // Validate status if present
      if (sanitizedUpdates.status && !VALID_TASK_STATUSES.includes(sanitizedUpdates.status)) {
        throw new Error(`Invalid status: must be one of ${VALID_TASK_STATUSES.join(', ')}`)
      }
      return taskHistoryStore?.updateRecord(id, sanitizedUpdates)
    }
  ))

  ipcMain.handle('task-history:complete', withRateLimit(
    'task-history:complete', RATE_LIMITS.ACTION,
    async (_, id: string, status?: TaskRecordStatus): Promise<TaskRecord | undefined> => {
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error('Invalid id: must be a non-empty string')
      }
      if (status !== undefined && !VALID_TASK_STATUSES.includes(status)) {
        throw new Error(`Invalid status: must be one of ${VALID_TASK_STATUSES.join(', ')}`)
      }
      return taskHistoryStore?.completeRecord(id, status)
    }
  ))

  ipcMain.handle('task-history:get', withRateLimit(
    'task-history:get', RATE_LIMITS.QUERY,
    async (_, id: string): Promise<TaskRecord | undefined> => {
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error('Invalid id: must be a non-empty string')
      }
      return taskHistoryStore?.getRecord(id)
    }
  ))

  ipcMain.handle('task-history:list', withRateLimit(
    'task-history:list', RATE_LIMITS.QUERY,
    async (_, options?: {
      type?: TaskType
      projectId?: string
      status?: TaskRecordStatus
      limit?: number
      offset?: number
      startDate?: string
      endDate?: string
    }): Promise<TaskRecord[]> => {
      if (!taskHistoryStore) return []

      if (options !== undefined) {
        validateObject(options, 'options')
        guardProtoPollution(options)
      }

      if (options?.startDate) validateDateString(options.startDate, 'startDate')
      if (options?.endDate) validateDateString(options.endDate, 'endDate')

      const parsedOptions = {
        ...options,
        startDate: options?.startDate ? new Date(options.startDate) : undefined,
        endDate: options?.endDate ? new Date(options.endDate) : undefined
      }

      return taskHistoryStore.getRecords(parsedOptions)
    }
  ))

  ipcMain.handle('task-history:statistics', withRateLimit(
    'task-history:statistics', RATE_LIMITS.QUERY,
    async (_, options?: {
      projectId?: string
      startDate?: string
      endDate?: string
    }): Promise<TaskStatistics | null> => {
      if (!taskHistoryStore) return null

      if (options !== undefined) {
        validateObject(options, 'options')
        guardProtoPollution(options)
      }

      if (options?.startDate) validateDateString(options.startDate, 'startDate')
      if (options?.endDate) validateDateString(options.endDate, 'endDate')

      const parsedOptions = {
        ...options,
        startDate: options?.startDate ? new Date(options.startDate) : undefined,
        endDate: options?.endDate ? new Date(options.endDate) : undefined
      }

      return taskHistoryStore.getStatistics(parsedOptions)
    }
  ))

  ipcMain.handle('task-history:clear-old', withRateLimit(
    'task-history:clear-old', RATE_LIMITS.ACTION,
    async (_, beforeDate: string): Promise<number> => {
      validateDateString(beforeDate, 'beforeDate')
      return taskHistoryStore?.clearOldRecords(new Date(beforeDate)) ?? 0
    }
  ))
}

export function cleanupTaskHistoryHandlers(): void {
  if (taskHistoryStore) {
    taskHistoryStore.removeAllListeners()
  }

  ipcMain.removeHandler('task-history:add')
  ipcMain.removeHandler('task-history:update')
  ipcMain.removeHandler('task-history:complete')
  ipcMain.removeHandler('task-history:get')
  ipcMain.removeHandler('task-history:list')
  ipcMain.removeHandler('task-history:statistics')
  ipcMain.removeHandler('task-history:clear-old')
}

export { getTaskHistoryStore }
