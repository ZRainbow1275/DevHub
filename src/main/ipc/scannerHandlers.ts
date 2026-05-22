import { ipcMain, BrowserWindow } from 'electron'
import { BackgroundScannerManager } from '../services/BackgroundScannerManager'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import type { MetricsCollector } from '../services/observability/MetricsCollector'
import type {
  ScannerAckRequest,
  ScannerAckResponse,
  ScannerDiffChannel,
  ScannerResyncResponse,
  ScannerSnapshotPushPayload
} from '@shared/types-extended'

let scannerManager: BackgroundScannerManager | null = null
let subscribedSenders = new WeakSet<Electron.WebContents>()
const DIFF_CHANNELS: ReadonlySet<ScannerDiffChannel> = new Set([
  'scanner:processes:diff',
  'scanner:ports:diff',
  'scanner:windows:diff',
  'scanner:aiTasks:diff'
])

function buildSnapshotPushPayload(manager: BackgroundScannerManager): ScannerSnapshotPushPayload {
  const channelSeqs = manager.getChannelSeqSnapshot()
  manager.prepareChannelsForSnapshot(channelSeqs)

  return {
    snapshot: manager.getCache().getSnapshot(),
    channelSeqs
  }
}

function ackScannerRequest(request: ScannerAckRequest): ScannerAckResponse {
  const channel = request?.channel ?? ''
  if (!scannerManager || !DIFF_CHANNELS.has(channel as ScannerDiffChannel)) {
    return {
      accepted: false,
      channel,
      ackedSeq: request?.seq ?? -1,
      lastSentSeq: null,
      pendingSeq: null
    }
  }

  return scannerManager.ackChannelSeq(channel as ScannerDiffChannel, request.seq)
}

export function setupScannerHandlers(
  _mainWindow: BrowserWindow,
  manager: BackgroundScannerManager,
  metricsCollector?: MetricsCollector
): void {
  scannerManager = manager

  // Renderer subscribes to cache updates.
  // The actual push happens via BackgroundScannerManager's event forwarding,
  // but this channel lets the renderer signal it's ready to receive.
  ipcMain.on('scanner:subscribe', (event) => {
    metricsCollector?.trackIpcChannel('scanner:subscribe')

    // Always send initial snapshot on subscribe, even for re-subscriptions (handles reconnection)
    const isNew = !subscribedSenders.has(event.sender)
    subscribedSenders.add(event.sender)

    // Send current snapshot regardless of whether this is a new or re-subscription
    const managerInstance = scannerManager
    if (managerInstance) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('scanner:snapshot:push', buildSnapshotPushPayload(managerInstance))
      }
    }

    if (isNew) {
      event.sender.on('destroyed', () => {
        // WeakSet handles GC automatically
      })
    }
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

  // Renderer requests manual retry for a failed scanner
  ipcMain.handle('scanner:retry', async (_event, type: string) => {
    metricsCollector?.trackIpcChannel('scanner:retry')
    if (!scannerManager) return { success: false, error: 'Scanner manager not available' }
    const validTypes = ['processes', 'ports', 'windows', 'aiTasks']
    if (!validTypes.includes(type)) return { success: false, error: 'Invalid scanner type' }
    return scannerManager.retryScanner(type as 'processes' | 'ports' | 'windows' | 'aiTasks')
  })

  ipcMain.handle('ipc:request-resync', withRateLimit(
    'ipc:request-resync', RATE_LIMITS.ACTION,
    (event, channel: string): ScannerResyncResponse => {
      if (!scannerManager || !DIFF_CHANNELS.has(channel as ScannerDiffChannel)) {
        return {
          accepted: false,
          channel,
          snapshotPushed: false
        }
      }

      if (!event.sender.isDestroyed()) {
        event.sender.send('scanner:snapshot:push', buildSnapshotPushPayload(scannerManager))
      }

      return {
        accepted: true,
        channel,
        snapshotPushed: true
      }
    }
  ))

  ipcMain.handle('ipc:ack-seq', withRateLimit(
    'ipc:ack-seq', RATE_LIMITS.BURST,
    (_event, request: ScannerAckRequest | ScannerAckRequest[]): ScannerAckResponse | ScannerAckResponse[] => {
      if (Array.isArray(request)) {
        return request.map(ackScannerRequest)
      }

      return ackScannerRequest(request)
    }
  ))
}

export function cleanupScannerHandlers(): void {
  ipcMain.removeHandler('ipc:ack-seq')
  ipcMain.removeHandler('scanner:snapshot')
  ipcMain.removeHandler('scanner:status')
  ipcMain.removeHandler('scanner:retry')
  ipcMain.removeHandler('ipc:request-resync')
  ipcMain.removeAllListeners('scanner:subscribe')
  subscribedSenders = new WeakSet()
  scannerManager = null
}
