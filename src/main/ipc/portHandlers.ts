import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS_EXT, PortInfo } from '@shared/types-extended'
import { PortScanner } from '../services/PortScanner'
import { validatePort, validatePortArray } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'

let portScanner: PortScanner | null = null

export function setupPortHandlers(mainWindow: BrowserWindow, scanner?: PortScanner): void {
  portScanner = scanner || new PortScanner()

  ipcMain.handle(IPC_CHANNELS_EXT.PORT_SCAN, withRateLimit(
    IPC_CHANNELS_EXT.PORT_SCAN, RATE_LIMITS.SCAN,
    async (): Promise<PortInfo[]> => {
      if (!portScanner) return []
      return portScanner.scanAll()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PORT_CHECK, withRateLimit(
    IPC_CHANNELS_EXT.PORT_CHECK, RATE_LIMITS.QUERY,
    async (_, port: unknown): Promise<PortInfo | null> => {
      if (!portScanner) return null
      validatePort(port)
      return portScanner.checkPort(port)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PORT_RELEASE, withRateLimit(
    IPC_CHANNELS_EXT.PORT_RELEASE, RATE_LIMITS.ACTION,
    async (_, port: unknown): Promise<boolean> => {
      if (!portScanner) return false
      validatePort(port)
      if (port < 1024) {
        throw new Error('Refused to release system port')
      }
      const result = await portScanner.releasePort(port)

      if (result) {
        // Notify about conflict resolution
        mainWindow.webContents.send(IPC_CHANNELS_EXT.PORT_CONFLICT, { port, resolved: true })
      }

      return result
    }
  ))

  ipcMain.handle('port:scan-common', withRateLimit(
    'port:scan-common', RATE_LIMITS.SCAN,
    async (): Promise<PortInfo[]> => {
      if (!portScanner) return []
      return portScanner.scanCommonPorts()
    }
  ))

  ipcMain.handle('port:is-available', withRateLimit(
    'port:is-available', RATE_LIMITS.QUERY,
    async (_, port: unknown): Promise<boolean> => {
      if (!portScanner) return true
      validatePort(port)
      return portScanner.isPortAvailable(port)
    }
  ))

  ipcMain.handle('port:find-available', withRateLimit(
    'port:find-available', RATE_LIMITS.QUERY,
    async (_, startPort: unknown): Promise<number> => {
      if (!portScanner) return 3000
      validatePort(startPort)
      return portScanner.findAvailablePort(startPort)
    }
  ))

  ipcMain.handle('port:detect-conflicts', withRateLimit(
    'port:detect-conflicts', RATE_LIMITS.QUERY,
    async (_, ports: unknown): Promise<PortInfo[]> => {
      if (!portScanner) return []
      validatePortArray(ports)
      return portScanner.detectConflicts(ports)
    }
  ))
}

export function cleanupPortHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PORT_SCAN)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PORT_CHECK)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PORT_RELEASE)
  ipcMain.removeHandler('port:scan-common')
  ipcMain.removeHandler('port:is-available')
  ipcMain.removeHandler('port:find-available')
  ipcMain.removeHandler('port:detect-conflicts')
}
