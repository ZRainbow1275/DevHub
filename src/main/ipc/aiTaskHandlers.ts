import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS_EXT, AITask, AITaskHistory, AIToolType, AIWindowAlias, AIRenameAndApplyRequest, AIRenameAndApplyResult, AIToolDetectionConfig, CalibrationResult, CalibrationSample, ConfidenceReport, StateTransition, ToolProfile, validateAliasName, ProgressEstimate, TimelineEntry, isAIWindowAlias, AICompletionOracleEvent, AICompletionOracleRecord } from '@shared/types-extended'
import { AITaskTracker } from '../services/AITaskTracker'
import { AIAliasManager, hashCommand, stripAppliedAliasPrefix } from '../services/AIAliasManager'
import { ScannerRegistry } from '../services/runtime/ScannerRegistry'
import { getProcessScanner } from './processHandlers'
import { getWindowManager } from './windowHandlers'
import { getNotificationService } from '../services/NotificationService'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { validateString, validateObject, guardProtoPollution } from '../utils/validation'
import type { SharedMonitorRuntime } from './runtimeBundle'

let aiTaskTracker: AITaskTracker | null = null
let aliasManager: AIAliasManager | null = null
let ownsAITaskTracker = false

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= Number.MAX_SAFE_INTEGER
}

function buildAliasDisplayName(toolDisplayName: string, alias: string): string {
  return alias.startsWith(`${toolDisplayName}-`) ? alias : `${toolDisplayName}-${alias}`
}

function buildAppliedWindowTitle(toolDisplayName: string, alias: string, originalTitle: string): string {
  const displayName = buildAliasDisplayName(toolDisplayName, alias)
  const baseTitle = stripAppliedAliasPrefix(originalTitle) || toolDisplayName
  return `[${displayName}] ${baseTitle}`
}

function isCalibrationSample(value: unknown): value is CalibrationSample {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.taskKey === 'string'
    && typeof record.toolType === 'string'
    && typeof record.capturedAt === 'number'
    && ['completed', 'running', 'error', 'cancelled'].includes(String(record.expected))
    && ['completed', 'running', 'error', 'cancelled', 'idle', 'thinking', 'coding', 'compiling', 'waiting'].includes(String(record.observed))
    && typeof record.signals === 'object'
    && record.signals !== null
    && ['manual', 'bench', 'runtime'].includes(String(record.source))
}

function isCompletionOracleSource(value: unknown): value is AICompletionOracleEvent['source'] {
  return value === 'claude-code-hook' || value === 'bench' || value === 'runtime'
}

function optionalOracleString(value: unknown, paramName: string, maxLength = 260): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  validateString(value, paramName, maxLength)
  return value.trim()
}

function toCompletionOracleEvent(value: unknown): AICompletionOracleEvent {
  validateObject(value, 'completionOracleEvent')
  guardProtoPollution(value)
  const record = value as Record<string, unknown>

  validateString(record.alias, 'completionOracleEvent.alias', 100)
  validateString(record.hookEventName, 'completionOracleEvent.hookEventName', 64)
  if (typeof record.completedAt !== 'number' || !Number.isFinite(record.completedAt) || record.completedAt <= 0) {
    throw new Error('Invalid completionOracleEvent.completedAt: must be a positive timestamp')
  }
  if (!isCompletionOracleSource(record.source)) {
    throw new Error('Invalid completionOracleEvent.source')
  }

  return {
    alias: record.alias.trim(),
    completedAt: Math.trunc(record.completedAt),
    hookEventName: record.hookEventName.trim(),
    source: record.source,
    cwd: optionalOracleString(record.cwd, 'completionOracleEvent.cwd', 500),
    sessionId: optionalOracleString(record.sessionId, 'completionOracleEvent.sessionId', 160),
    taskKey: optionalOracleString(record.taskKey, 'completionOracleEvent.taskKey', 260),
    transcriptPath: optionalOracleString(record.transcriptPath, 'completionOracleEvent.transcriptPath', 500)
  }
}

export function setupAITaskHandlers(mainWindow: BrowserWindow, runtime?: SharedMonitorRuntime): void {
  const registeredProcessScanner = ScannerRegistry.getInstance('process')
  const registeredAiTaskTracker = ScannerRegistry.getInstance('aiTask')
  const registeredWindowManager = ScannerRegistry.getInstance('window')
  const processScanner = runtime?.processScanner ?? registeredProcessScanner ?? getProcessScanner()
  if (!processScanner) {
    console.error('Process scanner not initialized')
    return
  }

  aiTaskTracker = runtime?.aiTaskTracker ?? registeredAiTaskTracker ?? new AITaskTracker(processScanner, runtime?.aliasManager)
  aliasManager = runtime?.aliasManager ?? aiTaskTracker.getAliasManager()
  ownsAITaskTracker = !runtime?.aiTaskTracker && !registeredAiTaskTracker

  // Wire window scanner so AITaskTracker can match windows to tasks
  aiTaskTracker.setWindowScanner(async () => {
    const wm = runtime?.windowManager ?? registeredWindowManager ?? getWindowManager()
    if (!wm) return []
    const result = await wm.scanWindows()
    return result.data ?? []
  })

  // Set up event listeners
  aiTaskTracker.on('task-started', (task: AITask) => {
    mainWindow.webContents.send('ai-task:started', task)
    mainWindow.webContents.send('ai-task:updated', task)
  })

  aiTaskTracker.on('task-status-changed', (task: AITask) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_STATUS_CHANGED, task)
    mainWindow.webContents.send('ai-task:updated', task)
  })

  aiTaskTracker.on('task-completed', (history: AITaskHistory, taskAlias?: string, taskWindowHwnd?: number) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, history)

    if (history.status !== 'completed') {
      return
    }

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
  if (ownsAITaskTracker) {
    aiTaskTracker.startTracking()
  }

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

  // Known limitation: AI_TASK_GET_ALL currently returns only active tasks
  // (same as AI_TASK_GET_ACTIVE). Historical completed tasks are typed as
  // AITaskHistory[] and are not compatible with AITask[]. Use
  // AI_TASK_GET_HISTORY to retrieve completed task records.
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
    async (_, pid: number): Promise<boolean> => {
      if (!aiTaskTracker) return false
      if (typeof pid === 'number' && pid > 0) {
        return aiTaskTracker.stopTask(pid)
      }
      // No valid pid provided — stop the global tracking loop
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

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_CONFIDENCE_REPORT, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_CONFIDENCE_REPORT, RATE_LIMITS.QUERY,
    async (_, taskKey: unknown): Promise<ConfidenceReport | null> => {
      if (!aiTaskTracker) return null
      validateString(taskKey, 'taskKey')
      return aiTaskTracker.getConfidenceReport(taskKey)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_STATE_HISTORY, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_STATE_HISTORY, RATE_LIMITS.QUERY,
    async (_, taskKey: unknown, limit?: unknown): Promise<StateTransition[]> => {
      if (!aiTaskTracker) return []
      validateString(taskKey, 'taskKey')
      const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? limit : 30
      return aiTaskTracker.getStateHistory(taskKey, safeLimit)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_RECORD_COMPLETION_ORACLE, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_RECORD_COMPLETION_ORACLE, RATE_LIMITS.ACTION,
    async (_, event: unknown): Promise<AICompletionOracleRecord | null> => {
      if (!aiTaskTracker) return null
      const payload = toCompletionOracleEvent(event)
      return aiTaskTracker.recordCompletionOracleEvent(payload)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_GET_PROFILE, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_GET_PROFILE, RATE_LIMITS.QUERY,
    async (_, toolType: unknown): Promise<ToolProfile | null> => {
      if (!aiTaskTracker) return null
      validateString(toolType, 'toolType')
      return aiTaskTracker.getToolProfile(toolType as AIToolType)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_SET_PROFILE, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_SET_PROFILE, RATE_LIMITS.ACTION,
    async (_, toolType: unknown, profile: unknown): Promise<boolean> => {
      if (!aiTaskTracker) return false
      validateString(toolType, 'toolType')
      validateObject(profile, 'profile')
      guardProtoPollution(profile)
      return aiTaskTracker.setToolProfile(toolType as AIToolType, profile as Partial<ToolProfile>)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_TASK_CALIBRATE, withRateLimit(
    IPC_CHANNELS_EXT.AI_TASK_CALIBRATE, RATE_LIMITS.DESTRUCTIVE,
    async (_, toolType: unknown, sample: unknown): Promise<CalibrationResult | null> => {
      if (!aiTaskTracker) return null
      validateString(toolType, 'toolType')
      validateObject(sample, 'sample')
      guardProtoPollution(sample)
      if (!isCalibrationSample(sample)) {
        throw new Error('Invalid calibration sample')
      }
      return aiTaskTracker.calibrateToolProfile(toolType as AIToolType, sample)
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
      guardProtoPollution(alias)
      if (!isAIWindowAlias(alias)) {
        throw new Error(
          'Invalid alias: schema mismatch (required fields: id: string, alias: string, matchCriteria: object)'
        )
      }
      // Post-guard narrowing: alias is now typed as AIWindowAlias
      validateString(alias.id, 'alias.id')
      validateString(alias.alias, 'alias.alias', 100)
      return aliasManager.set(alias)
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

  ipcMain.handle(IPC_CHANNELS_EXT.AI_ALIAS_RENAME, withRateLimit(
    IPC_CHANNELS_EXT.AI_ALIAS_RENAME, RATE_LIMITS.ACTION,
    async (_, aliasId: unknown, newName: unknown): Promise<boolean> => {
      if (!aliasManager) return false
      validateString(aliasId, 'aliasId')
      validateString(newName, 'newName', 64)
      return aliasManager.rename(aliasId as string, newName as string)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.AI_ALIAS_RENAME_AND_APPLY, withRateLimit(
    IPC_CHANNELS_EXT.AI_ALIAS_RENAME_AND_APPLY, RATE_LIMITS.ACTION,
    async (_, request: unknown): Promise<AIRenameAndApplyResult> => {
      const fail = (code: AIRenameAndApplyResult['code'], error: string): AIRenameAndApplyResult => ({
        success: false,
        titleApplied: false,
        code,
        error,
      })

      if (!aliasManager) return fail('ALIAS_PERSIST_WRITE_FAILED', 'Alias manager not initialized')
      validateObject(request, 'renameRequest')
      guardProtoPollution(request)

      const payload = request as Partial<AIRenameAndApplyRequest>
      if (!isAIWindowAlias(payload.alias)) {
        return fail('ALIAS_SCHEMA_INVALID', 'Invalid alias payload')
      }
      if (!isPositiveInteger(payload.hwnd) || !isPositiveInteger(payload.pid)) {
        return fail('ALIAS_SCHEMA_INVALID', 'Invalid hwnd or pid')
      }
      if (typeof payload.newName !== 'string') {
        return fail('ALIAS_NAME_INVALID', 'Invalid alias name')
      }

      const validation = validateAliasName(payload.newName)
      if (!validation.valid) {
        return fail('ALIAS_NAME_INVALID', validation.error ?? 'Invalid alias name')
      }

      const trimmedName = payload.newName.trim()
      const previousAlias = aliasManager.getAll().find(alias => alias.id === payload.alias!.id)
      const processInfo = processScanner.getBasicInfo(payload.pid)
        ?? (await processScanner.scan()).data?.find(process => process.pid === payload.pid)
      const toolType = payload.toolType ?? payload.alias.matchCriteria.toolType
      const toolDisplayName = typeof payload.toolDisplayName === 'string' && payload.toolDisplayName.trim()
        ? payload.toolDisplayName.trim()
        : AIAliasManager.getToolDisplayName(toolType)
      const originalTitle = typeof payload.originalTitle === 'string' && payload.originalTitle.trim()
        ? payload.originalTitle.trim()
        : toolDisplayName
      const shouldApplyTitle = payload.applyToExternalWindow !== false
      const appliedTitle = shouldApplyTitle
        ? buildAppliedWindowTitle(toolDisplayName, trimmedName, originalTitle)
        : undefined
      const stableMatchCriteria = { ...payload.alias.matchCriteria }
      delete stableMatchCriteria.pid

      const aliasToSave: AIWindowAlias = {
        ...payload.alias,
        alias: trimmedName,
        matchCriteria: {
          ...stableMatchCriteria,
          toolType,
          workingDir: processInfo?.workingDir ?? payload.alias.matchCriteria.workingDir,
          commandHash: processInfo?.command ? hashCommand(processInfo.command) : payload.alias.matchCriteria.commandHash,
          titlePrefix: stripAppliedAliasPrefix(originalTitle).substring(0, 30),
        },
        lastMatchedAt: Date.now(),
        autoGenerated: false,
        ...(appliedTitle ? {
          appliedExternalTitle: {
            hwnd: payload.hwnd,
            originalTitle,
            appliedTitle,
            appliedAt: Date.now(),
          }
        } : {}),
      }

      try {
        if (!aliasManager.set(aliasToSave)) {
          return fail('ALIAS_PERSIST_WRITE_FAILED', 'Alias persistence rejected the payload')
        }
      } catch (error) {
        return fail('ALIAS_PERSIST_WRITE_FAILED', error instanceof Error ? error.message : 'Alias persistence failed')
      }

      if (shouldApplyTitle && appliedTitle) {
        const wm = runtime?.windowManager ?? registeredWindowManager ?? getWindowManager()
        if (!wm) {
          if (previousAlias) aliasManager.set(previousAlias)
          else aliasManager.remove(aliasToSave.id)
          return fail('WINDOW_MANAGER_UNAVAILABLE', 'Window manager not initialized')
        }

        const titleResult = await wm.setWindowTitle(payload.hwnd, appliedTitle)
        if (!titleResult.success) {
          const rolledBack = previousAlias ? aliasManager.set(previousAlias) : aliasManager.remove(aliasToSave.id)
          return fail(
            rolledBack ? 'WINDOW_SET_TITLE_FAILED' : 'ROLLBACK_FAILED',
            titleResult.error ?? 'Failed to apply external window title',
          )
        }
      }

      const activeTask = aiTaskTracker?.getActiveTasks().find(task => task.pid === payload.pid)
      if (activeTask) {
        activeTask.alias = trimmedName
        activeTask.aliasColor = aliasToSave.color
        activeTask.windowHwnd = payload.hwnd
        mainWindow.webContents.send(IPC_CHANNELS_EXT.AI_TASK_STATUS_CHANGED, activeTask)
        mainWindow.webContents.send('ai-task:updated', activeTask)
      }

      return {
        success: true,
        alias: aliasToSave,
        titleApplied: shouldApplyTitle && Boolean(appliedTitle),
        appliedTitle,
      }
    }
  ))
}

export function cleanupAITaskHandlers(): void {
  if (aiTaskTracker && ownsAITaskTracker) {
    aiTaskTracker.cleanup()
  }
  aiTaskTracker = null
  aliasManager = null
  ownsAITaskTracker = false

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
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_CONFIDENCE_REPORT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_STATE_HISTORY)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_RECORD_COMPLETION_ORACLE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_GET_PROFILE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_SET_PROFILE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_TASK_CALIBRATE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_GET_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_SET)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_REMOVE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_RENAME)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.AI_ALIAS_RENAME_AND_APPLY)
}

export function getAITaskTracker(): AITaskTracker | null {
  return aiTaskTracker
}
