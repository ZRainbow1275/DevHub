import { ipcMain, BrowserWindow, shell } from 'electron'
import { IPC_CHANNELS_EXT, ProcessInfo, ProcessGroup, ProcessRelationship, ProcessDeepDetail, NetworkConnectionInfo, LoadedModuleInfo, ServiceResult, isProtectedProcess } from '@shared/types-extended'
import { SystemProcessScanner } from '../services/SystemProcessScanner'
import { PortScanner } from '../services/PortScanner'
import { AppStore } from '../store/AppStore'
import { validatePid } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { auditLogger } from '../services/AuditLogger'
import { z } from 'zod'

// Zod schemas for IPC input validation
const pidSchema = z.number().int().positive()
const filePathSchema = z.string().min(1).max(500).regex(/^[A-Za-z]:[/\\]/, 'Must be an absolute path')
const prioritySchema = z.enum(['Idle', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'RealTime'])

let processScanner: SystemProcessScanner | null = null
let portScanner: PortScanner | null = null

export function setupProcessHandlers(mainWindow: BrowserWindow, appStore: AppStore): void {
  portScanner = new PortScanner()
  processScanner = new SystemProcessScanner(portScanner)

  // Set up callbacks to notify renderer
  processScanner.onUpdate((processes) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.PROCESS_UPDATED, processes)
  })

  processScanner.onZombieDetected((zombies) => {
    mainWindow.webContents.send(IPC_CHANNELS_EXT.PROCESS_ZOMBIE_DETECTED, zombies)
  })

  // Start auto-refresh
  processScanner.startAutoRefresh()

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

  // === Deep Detail Handlers (Layer 2) ===

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_GET_DEEP_DETAIL, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_GET_DEEP_DETAIL, RATE_LIMITS.QUERY,
    async (_, pid: unknown): Promise<ProcessDeepDetail | null> => {
      if (!processScanner) return null
      validatePid(pid)
      return processScanner.getProcessDeepDetail(pid)
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
}

export function cleanupProcessHandlers(): void {
  if (processScanner) {
    processScanner.stopAutoRefresh()
  }

  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_SCAN)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_KILL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES)
  ipcMain.removeHandler('process:get-groups')
  ipcMain.removeHandler('process:get-tree')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_FULL_RELATIONSHIP)
  ipcMain.removeHandler('process:get-history')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_DEEP_DETAIL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_CONNECTIONS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_ENVIRONMENT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_KILL_TREE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_SET_PRIORITY)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_OPEN_FILE_LOCATION)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_GET_MODULES)
}

export function getProcessScanner(): SystemProcessScanner | null {
  return processScanner
}

export function getPortScanner(): PortScanner | null {
  return portScanner
}
