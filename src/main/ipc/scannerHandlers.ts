import { ipcMain, BrowserWindow } from 'electron'
import { BackgroundScannerManager } from '../services/BackgroundScannerManager'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'

let scannerManager: BackgroundScannerManager | null = null
let subscribedSenders = new WeakSet<Electron.WebContents>()

export function setupScannerHandlers(
  _mainWindow: BrowserWindow,
  manager: BackgroundScannerManager
): void {
  scannerManager = manager

  // Renderer subscribes to cache updates.
  // The actual push happens via BackgroundScannerManager's event forwarding,
  // but this channel lets the renderer signal it's ready to receive.
  ipcMain.on('scanner:subscribe', (event) => {
    if (subscribedSenders.has(event.sender)) return
    subscribedSenders.add(event.sender)

    // Send current snapshot immediately so the renderer doesn't start empty
    const cache = scannerManager?.getCache()
    if (cache) {
      const snapshot = cache.getSnapshot()
      if (!event.sender.isDestroyed()) {
        event.sender.send('scanner:snapshot:push', snapshot)
      }
    }

    event.sender.on('destroyed', () => {
      // WeakSet handles GC automatically
    })
  })

  // Renderer requests a full snapshot (invoke/handle pattern)
  ipcMain.handle('scanner:snapshot', withRateLimit(
    'scanner:snapshot', RATE_LIMITS.QUERY,
    () => {
      if (!scannerManager) return null
      return scannerManager.getCache().getSnapshot()
    }
  ))

  // Renderer queries scanning status
  ipcMain.handle('scanner:status', withRateLimit(
    'scanner:status', RATE_LIMITS.QUERY,
    () => {
      if (!scannerManager) return null
      return {
        isActive: scannerManager.isActive(),
        scanStatus: scannerManager.getCache().getScanStatus()
      }
    }
  ))
}

export function cleanupScannerHandlers(): void {
  ipcMain.removeHandler('scanner:snapshot')
  ipcMain.removeHandler('scanner:status')
  ipcMain.removeAllListeners('scanner:subscribe')
  subscribedSenders = new WeakSet()
  scannerManager = null
}
