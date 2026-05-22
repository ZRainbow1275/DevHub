import { ipcMain, BrowserWindow, shell } from 'electron'
import { IPC_CHANNELS_EXT, ProcessInfo, ProcessGroup, ProcessRelationship, ProcessDeepDetail, NetworkConnectionInfo, LoadedModuleInfo, ServiceResult, isProtectedProcess, AccessReport } from '@shared/types-extended'
import { SystemProcessScanner } from '../services/SystemProcessScanner'
import { PortScanner } from '../services/PortScanner'
import { AppStore } from '../store/AppStore'
import { validatePid } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { auditLogger } from '../services/AuditLogger'
import { AdminRelaunch } from '../services/elevation/AdminRelaunch'
import { ScannerRegistry } from '../services/runtime/ScannerRegistry'
import { ProcessTagStore } from '../services/ProcessTagStore'
import { ProcessBatchExecutor } from '../services/ProcessBatchExecutor'
import { z } from 'zod'
import type { SharedMonitorRuntime } from './runtimeBundle'
import type { R8RuntimeService } from '../services/R8RuntimeService'
import {
  processBatchCancelResponseSchema,
  processBatchJobRequestSchema,
  processBatchRequestSchema,
  processBatchStartResponseSchema,
  processBatchUndoResponseSchema,
  processHistoryBatchRequestSchema,
  processHistoryRequestSchema,
  processTagRemoveRequestSchema,
  processTagSetRequestSchema,
  type ProcessBatchCancelResponse,
  type ProcessBatchStartResponse,
  type ProcessBatchUndoResponse,
  processTagsImportRequestSchema,
  type ProcessHistory,
  type ProcessTag,
  type ProcessTagsImportResponse,
  type ProcessTagsListResponse,
} from '@shared/schemas/r8-runtime'

// Zod schemas for IPC input validation
const pidSchema = z.number().int().positive()
const filePathSchema = z.string().min(1).max(500).regex(/^[A-Za-z]:[/\\]/, 'Must be an absolute path')
const prioritySchema = z.enum(['Idle', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'RealTime'])

let processScanner: SystemProcessScanner | null = null
let portScanner: PortScanner | null = null
let processTagStore: ProcessTagStore | null = null
let processBatchExecutor: ProcessBatchExecutor | null = null
let ownsProcessScanner = false

export function setupProcessHandlers(
  mainWindow: BrowserWindow,
  appStore: AppStore,
  runtime?: SharedMonitorRuntime,
  r8RuntimeService?: R8RuntimeService
): void {
  const registeredPortScanner = ScannerRegistry.getInstance('port')
  const registeredProcessScanner = ScannerRegistry.getInstance('process')

  portScanner = runtime?.portScanner ?? registeredPortScanner ?? new PortScanner()
  processScanner = runtime?.processScanner ?? registeredProcessScanner ?? new SystemProcessScanner(portScanner)
  processTagStore = new ProcessTagStore()
  ownsProcessScanner = !runtime?.processScanner && !registeredProcessScanner
  processBatchExecutor = new ProcessBatchExecutor(
    processScanner,
    progress => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('process:batch-progress', progress)
      }
    },
    {
      tagStore: processTagStore,
      windowManager: runtime?.windowManager,
      runtimeService: r8RuntimeService
    }
  )

  // Set up callbacks to notify renderer
  processScanner.onUpdate((processes) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.PROCESS_UPDATED, processes)
  })

  processScanner.onZombieDetected((zombies) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.PROCESS_ZOMBIE_DETECTED, zombies)
  })

  // Start auto-refresh
  if (ownsProcessScanner) {
    processScanner.startAutoRefresh()
  }

  // IPC Handlers
  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_SCAN, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_SCAN, RATE_LIMITS.SCAN,
    async (): Promise<ServiceResult<ProcessInfo[]>> => {
      if (!processScanner) return { success: false, data: [], error: 'Process scanner not initialized' }
      return processScanner.scan()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_KILL, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_KILL, RATE_LIMITS.DESTRUCTIVE,
    async (_, pid: unknown): Promise<boolean> => {
      if (!processScanner) return false
      const parsed = pidSchema.safeParse(pid)
      if (!parsed.success) {
        console.warn('process:kill validation failed:', parsed.error.message)
        return false
      }
      validatePid(pid)
      const knownProcesses = await processScanner.getAll()
      const proc = knownProcesses.find(p => p.pid === pid)
      if (!proc) {
        console.warn(`Refused to kill unknown PID: ${pid}`)
        auditLogger.log('process:kill', { pid }, 'refused', 'unknown PID')
        return false
      }
      if (isProtectedProcess(proc.name)) {
        console.warn(`Refused to kill protected process: ${proc.name} (PID ${pid})`)
        auditLogger.log('process:kill', { pid, name: proc.name }, 'refused', 'protected process')
        return false
      }
      const result = await processScanner.killProcess(pid)
      auditLogger.log('process:kill', { pid, name: proc.name }, result ? 'success' : 'error')
      return result
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES, RATE_LIMITS.DESTRUCTIVE,
    async (): Promise<number> => {
      if (!processScanner) return 0
      const cleaned = await processScanner.cleanupZombies()
      auditLogger.log('process:cleanup-zombies', { cleaned }, cleaned >= 0 ? 'success' : 'error')
      return cleaned
    }
  ))

  ipcMain.handle('process:get-groups', withRateLimit(
    'process:get-groups', RATE_LIMITS.QUERY,
    async (): Promise<ProcessGroup[]> => {
      if (!processScanner) return []
      const projects = appStore.getProjects()
      return processScanner.groupByProject(projects)
    }
  ))

  ipcMain.handle('process:get-tree', withRateLimit(
    'process:get-tree', RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<ProcessInfo[]> => {
      if (!processScanner) return []
      pidSchema.parse(pid)
      validatePid(pid)
      return processScanner.getProcessTree(pid)
    }
  ))

  // Basic info handler: fast, no PowerShell call, reads from in-memory cache
  ipcMain.handle('process:get-basic-info', withRateLimit(
    'process:get-basic-info', RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<ProcessInfo | null> => {
      if (!processScanner) return null
      const parsed = pidSchema.safeParse(pid)
      if (!parsed.success) return null
      return processScanner.lookupProcessByPid(parsed.data)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_GET_FULL_RELATIONSHIP, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_GET_FULL_RELATIONSHIP, RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<ProcessRelationship | null> => {
      if (!processScanner) return null
      validatePid(pid)
      return processScanner.getFullRelationship(pid)
    }
  ))

  ipcMain.handle('process:get-history', withRateLimit(
    'process:get-history', RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<{ cpuHistory: number[]; memoryHistory: number[] }> => {
      if (!processScanner) return { cpuHistory: [], memoryHistory: [] }
      validatePid(pid)
      return processScanner.getProcessHistory(pid)
    }
  ))

  ipcMain.handle('process:tags-list', withRateLimit(
    'process:tags-list', RATE_LIMITS.QUERY,
    async (): Promise<ProcessTagsListResponse> => ({ tags: processTagStore?.list() ?? [] })
  ))

  ipcMain.handle('process:tags-set', withRateLimit(
    'process:tags-set', RATE_LIMITS.ACTION,
    async (_, input: unknown): Promise<ProcessTag> => {
      if (!processTagStore) throw new Error('Process tag store not initialized')
      return processTagStore.set(processTagSetRequestSchema.parse(input))
    }
  ))

  ipcMain.handle('process:tags-remove', withRateLimit(
    'process:tags-remove', RATE_LIMITS.ACTION,
    async (_, input: unknown): Promise<{ success: boolean; removed: number; key: string }> => {
      if (!processTagStore) return { success: false, removed: 0, key: '' }
      const parsed = processTagRemoveRequestSchema.parse(input)
      return processTagStore.remove(parsed.exe, parsed.cwd)
    }
  ))

  ipcMain.handle('process:tags-export', withRateLimit(
    'process:tags-export', RATE_LIMITS.QUERY,
    async (): Promise<{ json: string }> => ({
      json: processTagStore?.exportJson() ?? JSON.stringify({ version: 1, exportedAt: Date.now(), tags: [] })
    })
  ))

  ipcMain.handle('process:tags-import', withRateLimit(
    'process:tags-import', RATE_LIMITS.ACTION,
    async (_, input: unknown): Promise<ProcessTagsImportResponse> => {
      if (!processTagStore) return { success: false, imported: 0, skipped: 0 }
      const parsed = processTagsImportRequestSchema.parse(input)
      return processTagStore.importJson(parsed.json)
    }
  ))

  ipcMain.handle('process:history-24h', withRateLimit(
    'process:history-24h', RATE_LIMITS.QUERY,
    async (_, input: unknown): Promise<ProcessHistory> => {
      const parsed = processHistoryRequestSchema.parse(input)
      if (!processScanner) {
        return { key: '', exe: parsed.exe, cwd: parsed.cwd, windowMs: 86_400_000, points: [] }
      }
      return processScanner.getProcessHistory24h(parsed.exe, parsed.cwd)
    }
  ))

  ipcMain.handle('process:history-batch', withRateLimit(
    'process:history-batch', RATE_LIMITS.QUERY,
    async (_, input: unknown): Promise<{ histories: ProcessHistory[] }> => {
      if (!processScanner) return { histories: [] }
      const parsed = processHistoryBatchRequestSchema.parse(input)
      return { histories: processScanner.getProcessHistoryBatch(parsed.keys) }
    }
  ))

  ipcMain.handle('process:batch-op', withRateLimit(
    'process:batch-op',
    'low_freq_op',
    async (_, input: unknown): Promise<ProcessBatchStartResponse> => {
      const request = processBatchRequestSchema.parse(input)
      if (!processBatchExecutor) throw new Error('E_NOT_READY: Process batch executor not initialized')
      const response = processBatchStartResponseSchema.parse(processBatchExecutor.run(request))
      auditLogger.log('process:batch-op', {
        action: request.action,
        pidCount: request.pids.length,
        jobId: response.jobId,
        dryRun: request.dryRun
      }, 'success')
      return response
    }
  ))

  ipcMain.handle('process:batch-cancel', withRateLimit(
    'process:batch-cancel',
    'meta',
    async (_, input: unknown): Promise<ProcessBatchCancelResponse> => {
      const request = processBatchJobRequestSchema.parse(input)
      if (!processBatchExecutor) throw new Error('E_NOT_READY: Process batch executor not initialized')
      const response = processBatchCancelResponseSchema.parse(processBatchExecutor.cancel(request))
      auditLogger.log('process:batch-cancel', {
        jobId: request.jobId,
        confirmedBy: request.confirmedBy,
        skipped: response.skipped
      }, response.cancelled ? 'success' : 'refused')
      return response
    }
  ))

  ipcMain.handle('process:batch-undo', withRateLimit(
    'process:batch-undo',
    'meta',
    async (_, input: unknown): Promise<ProcessBatchUndoResponse> => {
      const request = processBatchJobRequestSchema.parse(input)
      if (!processBatchExecutor) throw new Error('E_NOT_READY: Process batch executor not initialized')
      const response = processBatchUndoResponseSchema.parse(await processBatchExecutor.undo(request))
      auditLogger.log('process:batch-undo', {
        jobId: request.jobId,
        confirmedBy: request.confirmedBy,
        undone: response.undone
      }, response.undone > 0 ? 'success' : 'refused')
      return response
    }
  ))

  // === Deep Detail Handlers (Layer 2) ===

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_GET_DEEP_DETAIL, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_GET_DEEP_DETAIL, RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<ProcessDeepDetail | null> => {
      if (!processScanner) return null
      validatePid(pid)
      return processScanner.getProcessDeepDetail(pid)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_PROBE_ACCESS, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_PROBE_ACCESS, RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<AccessReport> => {
      const parsed = pidSchema.safeParse(pid)
      const fallbackUser = process.env.USERDOMAIN && process.env.USERNAME
        ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
        : process.env.USERNAME || 'unknown'

      if (!parsed.success) {
        return {
          pid: 0,
          elevationRequired: false,
          scanAttempted: false,
          scanResult: 'not-found',
          currentUser: fallbackUser,
          suggestion: 'none',
          triedAt: Date.now()
        }
      }

      if (!processScanner) {
        return {
          pid: parsed.data,
          elevationRequired: false,
          scanAttempted: false,
          scanResult: 'wmi-error',
          currentUser: fallbackUser,
          suggestion: 'retry',
          triedAt: Date.now()
        }
      }

      return processScanner.probeProcessAccess(parsed.data)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_GET_CONNECTIONS, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_GET_CONNECTIONS, RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<NetworkConnectionInfo[]> => {
      if (!processScanner) return []
      validatePid(pid)
      return processScanner.getProcessConnections(pid)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_GET_ENVIRONMENT, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_GET_ENVIRONMENT, RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<{ variables: Record<string, string>; requiresElevation: boolean }> => {
      if (!processScanner) return { variables: {}, requiresElevation: false }
      validatePid(pid)
      return processScanner.getProcessEnvironment(pid)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_KILL_TREE, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_KILL_TREE, RATE_LIMITS.DESTRUCTIVE,
    async (_, pid: unknown): Promise<boolean> => {
      if (!processScanner) return false
      validatePid(pid)
      const knownProcesses = await processScanner.getAll()
      const proc = knownProcesses.find(p => p.pid === pid)
      if (!proc) {
        console.warn(`Refused to kill-tree unknown PID: ${pid}`)
        auditLogger.log('process:kill-tree', { pid }, 'refused', 'unknown process')
        return false
      }
      if (isProtectedProcess(proc.name)) {
        console.warn(`Refused to kill protected process tree: ${proc.name} (PID ${pid})`)
        auditLogger.log('process:kill-tree', { pid, name: proc.name }, 'refused', 'protected process')
        return false
      }
      const result = await processScanner.killProcessTree(pid)
      auditLogger.log('process:kill-tree', { pid, name: proc.name }, result ? 'success' : 'error')
      return result
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_SET_PRIORITY, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_SET_PRIORITY, RATE_LIMITS.ACTION,
    async (_, pid: unknown, priority: unknown): Promise<boolean> => {
      if (!processScanner) return false
      const pidResult = pidSchema.safeParse(pid)
      if (!pidResult.success) return false
      const priorityResult = prioritySchema.safeParse(priority)
      if (!priorityResult.success) return false
      validatePid(pid)
      const result = await processScanner.setProcessPriority(pid, priorityResult.data)
      auditLogger.log('process:set-priority', { pid, priority }, result ? 'success' : 'error')
      return result
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_OPEN_FILE_LOCATION, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_OPEN_FILE_LOCATION, RATE_LIMITS.ACTION,
    async (_, filePath: unknown): Promise<void> => {
      const parsed = filePathSchema.safeParse(filePath)
      if (!parsed.success) {
        throw new Error(`Invalid file path: ${parsed.error.issues[0]?.message ?? 'validation failed'}`)
      }
      shell.showItemInFolder(parsed.data)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_GET_MODULES, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_GET_MODULES, RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<{ modules: LoadedModuleInfo[]; requiresElevation: boolean }> => {
      if (!processScanner) return { modules: [], requiresElevation: false }
      validatePid(pid)
      return processScanner.getLoadedModules(pid)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.APP_RELAUNCH_AS_ADMIN, withRateLimit(
    IPC_CHANNELS_EXT.APP_RELAUNCH_AS_ADMIN, RATE_LIMITS.ACTION,
    async (): Promise<{ ok: boolean; reason?: string }> => {
      const result = await AdminRelaunch.relaunch()
      auditLogger.log(
        IPC_CHANNELS_EXT.APP_RELAUNCH_AS_ADMIN,
        {},
        result.ok ? 'success' : result.reason === 'user-cancelled' ? 'refused' : 'error',
        result.reason
      )
      return result
    }
  ))
}

export function cleanupProcessHandlers(): void {
  processBatchExecutor?.dispose()
  processBatchExecutor = null
  if (processScanner && ownsProcessScanner) {
    processScanner.stopAutoRefresh()
  }
  ownsProcessScanner = false
  processScanner = null
  portScanner = null
  processTagStore = null

  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_SCAN)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_KILL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES)
  ipcMain.removeHandler('process:get-groups')
  ipcMain.removeHandler('process:get-tree')
  ipcMain.removeHandler('process:get-basic-info')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_FULL_RELATIONSHIP)
  ipcMain.removeHandler('process:get-history')
  ipcMain.removeHandler('process:tags-list')
  ipcMain.removeHandler('process:tags-set')
  ipcMain.removeHandler('process:tags-remove')
  ipcMain.removeHandler('process:tags-export')
  ipcMain.removeHandler('process:tags-import')
  ipcMain.removeHandler('process:history-24h')
  ipcMain.removeHandler('process:history-batch')
  ipcMain.removeHandler('process:batch-op')
  ipcMain.removeHandler('process:batch-cancel')
  ipcMain.removeHandler('process:batch-undo')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_DEEP_DETAIL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_PROBE_ACCESS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_CONNECTIONS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_ENVIRONMENT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_KILL_TREE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_SET_PRIORITY)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_OPEN_FILE_LOCATION)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_MODULES)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.APP_RELAUNCH_AS_ADMIN)
}

export function getProcessScanner(): SystemProcessScanner | null {
  return processScanner ?? ScannerRegistry.getInstance('process')
}

export function getPortScanner(): PortScanner | null {
  return portScanner ?? ScannerRegistry.getInstance('port')
}
