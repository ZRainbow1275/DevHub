import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS_EXT, PortInfo, PortTopologyData, PortFocusData } from '@shared/types-extended'
import { PortScanner } from '../services/PortScanner'
import { SystemProcessScanner } from '../services/SystemProcessScanner'
import { ScannerCache } from '../services/ScannerCache'
import { validatePort, validatePortArray } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'

let portScanner: PortScanner | null = null
let portScannerCache: ScannerCache | null = null

// Active incremental queries for cancellation
const activePortQueries = new Map<number, { abort: () => void }>()
const MAX_PARALLEL_PORT_QUERIES = 3

function cancelPortQuery(port: number): void {
  const existing = activePortQueries.get(port)
  if (existing) {
    existing.abort()
    activePortQueries.delete(port)
  }
}

function cancelAllExcessQueries(): void {
  // If we have too many active queries, cancel oldest ones
  while (activePortQueries.size >= MAX_PARALLEL_PORT_QUERIES) {
    const oldest = activePortQueries.keys().next().value
    if (oldest !== undefined) {
      cancelPortQuery(oldest)
    } else {
      break
    }
  }
}

/**
 * Build PortFocusData from cached port list (fast, no PowerShell calls).
 */
function buildCachedFocusData(targetPort: number, cachedPorts: PortInfo[]): PortFocusData | null {
  const portInfo = cachedPorts.find(p => p.port === targetPort && p.state === 'LISTENING')
    ?? cachedPorts.find(p => p.port === targetPort)
  if (!portInfo) return null

  const siblingPorts = cachedPorts.filter(p => p.pid === portInfo.pid && p.port !== targetPort)
  const connections = cachedPorts
    .filter(p => p.port === targetPort)
    .map(p => ({
      localAddress: p.localAddress,
      foreignAddress: p.foreignAddress,
      state: p.state,
      foreignProcessName: undefined,
      direction: (p.state === 'LISTENING' || p.localAddress.includes(`:${targetPort}`))
        ? 'inbound' as const
        : 'outbound' as const
    }))

  return {
    port: portInfo,
    process: null,
    siblingPorts,
    connections,
    processChildren: []
  }
}

export function setupPortHandlers(mainWindow: BrowserWindow, scanner?: PortScanner, cache?: ScannerCache): void {
  portScanner = scanner || new PortScanner()
  portScannerCache = cache || null

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

  ipcMain.handle(IPC_CHANNELS_EXT.PORT_TOPOLOGY, withRateLimit(
    IPC_CHANNELS_EXT.PORT_TOPOLOGY, RATE_LIMITS.SCAN,
    async (): Promise<PortTopologyData> => {
      if (!portScanner) return { nodes: [], edges: [] }
      return portScanner.buildTopology()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.PORT_GET_FOCUS_DATA, withRateLimit(
    IPC_CHANNELS_EXT.PORT_GET_FOCUS_DATA, RATE_LIMITS.QUERY,
    async (_, port: unknown): Promise<PortFocusData | null> => {
      if (!portScanner) return null
      validatePort(port)
      // Try to create a process scanner for extended info
      let processScanner: SystemProcessScanner | undefined
      try {
        processScanner = new SystemProcessScanner()
      } catch {
        // Fallback: no extended process info
      }
      return portScanner.getPortFocusData(port, processScanner)
    }
  ))

  // ==================== Incremental Port Detail (Cache-First + Timeout) ====================

  ipcMain.handle('port:get-detail-incremental', withRateLimit(
    'port:get-detail-incremental', RATE_LIMITS.QUERY,
    async (_, port: unknown): Promise<{
      data: PortFocusData | null
      source: 'cache' | 'incremental' | 'timeout'
      isStale: boolean
    }> => {
      if (!portScanner) return { data: null, source: 'cache', isStale: true }
      validatePort(port)
      const targetPort = port as number

      // 1. Immediately try to return cached data
      const cachedPorts = portScannerCache?.getPorts() ?? []
      const cachedData = buildCachedFocusData(targetPort, cachedPorts)

      // 2. Cancel any previous query for this port and enforce max parallel
      cancelPortQuery(targetPort)
      cancelAllExcessQueries()

      // 3. Launch incremental query with timeout + cancellation
      let aborted = false
      const abortHandle = { abort: () => { aborted = true } }
      activePortQueries.set(targetPort, abortHandle)

      const TIMEOUT_MS = 3000

      try {
        const incrementalPromise = (async (): Promise<PortFocusData | null> => {
          if (aborted) return null
          let processScanner: SystemProcessScanner | undefined
          try {
            processScanner = new SystemProcessScanner()
          } catch {
            // Fallback: no extended process info
          }
          if (aborted) return null
          return portScanner!.getPortDetailIncremental(targetPort, processScanner)
        })()

        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), TIMEOUT_MS)
        })

        const result = await Promise.race([incrementalPromise, timeoutPromise])
        activePortQueries.delete(targetPort)

        if (aborted) {
          // Query was cancelled (user switched ports)
          return { data: cachedData, source: 'cache', isStale: true }
        }

        if (result === null && cachedData !== null) {
          // Timeout — return cached data with stale warning
          return { data: cachedData, source: 'timeout', isStale: true }
        }

        if (result !== null) {
          return { data: result, source: 'incremental', isStale: false }
        }

        // Both null — no data available
        return { data: cachedData, source: 'cache', isStale: cachedData !== null }
      } catch {
        activePortQueries.delete(targetPort)
        // On error, degrade to cached data
        return { data: cachedData, source: 'cache', isStale: true }
      }
    }
  ))

  // Cancel a previous port query (called by renderer when switching ports)
  ipcMain.handle('port:cancel-query', async (_, port: unknown): Promise<boolean> => {
    if (typeof port === 'number') {
      cancelPortQuery(port)
      return true
    }
    return false
  })
}

export function cleanupPortHandlers(): void {
  // Cancel all active queries
  for (const [port] of activePortQueries) {
    cancelPortQuery(port)
  }
  activePortQueries.clear()

  ipcMain.removeHandler(IPC_CHANNELS_EXT.PORT_SCAN)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PORT_CHECK)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PORT_RELEASE)
  ipcMain.removeHandler('port:scan-common')
  ipcMain.removeHandler('port:is-available')
  ipcMain.removeHandler('port:find-available')
  ipcMain.removeHandler('port:detect-conflicts')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PORT_TOPOLOGY)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.PORT_GET_FOCUS_DATA)
  ipcMain.removeHandler('port:get-detail-incremental')
  ipcMain.removeHandler('port:cancel-query')
  portScannerCache = null
}
