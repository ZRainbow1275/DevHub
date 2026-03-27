import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS_EXT, ProcessInfo, ProcessGroup, ServiceResult } from '@shared/types-extended'
import { SystemProcessScanner } from '../services/SystemProcessScanner'
import { PortScanner } from '../services/PortScanner'
import { AppStore } from '../store/AppStore'
import { validatePid } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'

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
    IPC_CHANNELS_EXT.PROCESS_KILL, RATE_LIMITS.ACTION,
    async (_, pid: unknown): Promise<boolean> => {
      if (!processScanner) return false
      validatePid(pid)
      const knownProcesses = await processScanner.getAll()
      if (!knownProcesses.some(p => p.pid === pid)) {
        console.warn(`Refused to kill unknown PID: ${pid}`)
        return false
      }
      return processScanner.killProcess(pid)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES, withRateLimit(
    IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES, RATE_LIMITS.ACTION,
    async (): Promise<number> => {
      if (!processScanner) return 0
      return processScanner.cleanupZombies()
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
}

export function cleanupProcessHandlers(): void {
  if (processScanner) {
    processScanner.stopAutoRefresh()
  }

  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_SCAN)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_KILL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES)
  ipcMain.removeHandler('process:get-groups')
}

export function getProcessScanner(): SystemProcessScanner | null {
  return processScanner
}

export function getPortScanner(): PortScanner | null {
  return portScanner
}
