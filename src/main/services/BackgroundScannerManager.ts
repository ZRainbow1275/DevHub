import { BrowserWindow } from 'electron'
import { SystemProcessScanner } from './SystemProcessScanner'
import { PortScanner } from './PortScanner'
import { WindowManager } from './WindowManager'
import { AITaskTracker } from './AITaskTracker'
import { ScannerCache, ScannerType } from './ScannerCache'

// ============ Scanner Intervals (ms) ============

const SCANNER_INTERVALS: Record<ScannerType, number> = {
  processes: 2000,
  ports: 5000,
  windows: 3000,
  aiTasks: 1000
}

// ============ Background Scanner Manager ============

export class BackgroundScannerManager {
  private timers = new Map<ScannerType, NodeJS.Timeout>()
  private scanningGuards = new Set<ScannerType>()
  private cache: ScannerCache
  private isRunning = false

  // External scanners (may be shared with existing IPC handlers)
  private processScanner: SystemProcessScanner | null = null
  private portScanner: PortScanner | null = null
  private windowManager: WindowManager | null = null
  private aiTaskTracker: AITaskTracker | null = null

  // Reference to main window for IPC push
  private getMainWindow: (() => BrowserWindow | null) | null = null

  constructor(cache: ScannerCache) {
    this.cache = cache
  }

  /**
   * Inject external scanner instances so we coordinate with the existing
   * processHandlers / portHandlers / windowHandlers instead of creating duplicates.
   */
  setScanners(options: {
    processScanner?: SystemProcessScanner
    portScanner?: PortScanner
    windowManager?: WindowManager
    aiTaskTracker?: AITaskTracker
  }): void {
    if (options.processScanner) this.processScanner = options.processScanner
    if (options.portScanner) this.portScanner = options.portScanner
    if (options.windowManager) this.windowManager = options.windowManager
    if (options.aiTaskTracker) this.aiTaskTracker = options.aiTaskTracker
  }

  setMainWindowGetter(getter: () => BrowserWindow | null): void {
    this.getMainWindow = getter
  }

  /**
   * Start all background scanners in parallel.
   * Each scanner does a first full scan, then enters a periodic polling loop.
   */
  async startAll(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    // Wire cache events to IPC push
    this.setupCacheEventForwarding()

    // Launch all first scans in parallel (best-effort)
    const results = await Promise.allSettled([
      this.startScanner('processes'),
      this.startScanner('ports'),
      this.startScanner('windows'),
      this.startScanner('aiTasks')
    ])

    // Log any first-scan failures (non-fatal)
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('BackgroundScannerManager: first scan failed:', result.reason)
      }
    }
  }

  /**
   * Stop all scanners and release timers.
   */
  stopAll(): void {
    this.isRunning = false
    this.timers.forEach((timer, type) => {
      clearInterval(timer)
      console.warn(`BackgroundScannerManager: stopped ${type} scanner`)
    })
    this.timers.clear()
    this.scanningGuards.clear()
    // Stop sub-scanner timers
    this.aiTaskTracker?.stopTracking()
    this.processScanner?.cleanup()
    this.cache.cleanup()
  }

  getCache(): ScannerCache {
    return this.cache
  }

  isActive(): boolean {
    return this.isRunning
  }

  // ---- Private: individual scanner lifecycle ----

  private async startScanner(type: ScannerType): Promise<void> {
    // Mark scanning
    this.cache.setScanning(type, true)

    // First full scan
    try {
      await this.runScan(type)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`BackgroundScannerManager: first scan for ${type} failed:`, msg)
      this.cache.setError(type, msg)
    }

    // Set up interval with overlap guard
    const interval = SCANNER_INTERVALS[type]
    const timer = setInterval(async () => {
      if (!this.isRunning) return
      if (this.scanningGuards.has(type)) return // prevent overlapping scans
      this.scanningGuards.add(type)
      try {
        await this.runScan(type)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.cache.setError(type, msg)
      } finally {
        this.scanningGuards.delete(type)
      }
    }, interval)

    this.timers.set(type, timer)
  }

  private async runScan(type: ScannerType): Promise<void> {
    switch (type) {
      case 'processes':
        await this.scanProcesses()
        break
      case 'ports':
        await this.scanPorts()
        break
      case 'windows':
        await this.scanWindows()
        break
      case 'aiTasks':
        await this.scanAITasks()
        break
    }
  }

  private async scanProcesses(): Promise<void> {
    if (!this.processScanner) return
    const result = await this.processScanner.scan()
    if (result.success && result.data) {
      this.cache.updateProcesses(result.data)
    } else if (result.error) {
      this.cache.setError('processes', result.error)
    }
  }

  private async scanPorts(): Promise<void> {
    if (!this.portScanner) return
    const ports = await this.portScanner.scanAll()
    this.cache.updatePorts(ports)
  }

  private async scanWindows(): Promise<void> {
    if (!this.windowManager) return
    const result = await this.windowManager.scanWindows()
    if (result.success && result.data) {
      this.cache.updateWindows(result.data)
    } else if (result.error) {
      this.cache.setError('windows', result.error)
    }
  }

  private async scanAITasks(): Promise<void> {
    if (!this.aiTaskTracker) return
    // scanForAITasks uses cached processes from the processScanner,
    // also pass current windows for window matching
    const processes = this.cache.getProcesses()
    const windows = this.cache.getWindows()
    await this.aiTaskTracker.scanForAITasks(processes, windows)
    const tasks = this.aiTaskTracker.getActiveTasks()
    this.cache.updateAITasks(tasks)
  }

  // ---- Private: IPC forwarding ----

  private setupCacheEventForwarding(): void {
    const sendToRenderer = (channel: string, data: unknown): void => {
      const win = this.getMainWindow?.()
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }

    this.cache.on('processes:updated', (diff) => {
      sendToRenderer('scanner:processes:diff', diff)
    })

    this.cache.on('ports:updated', (diff) => {
      sendToRenderer('scanner:ports:diff', diff)
    })

    this.cache.on('windows:updated', (diff) => {
      sendToRenderer('scanner:windows:diff', diff)
    })

    this.cache.on('aiTasks:updated', (diff) => {
      sendToRenderer('scanner:aiTasks:diff', diff)
    })

    this.cache.on('summary:updated', (summary) => {
      sendToRenderer('scanner:summary:update', summary)
    })

    this.cache.on('scanning:changed', (status) => {
      sendToRenderer('scanner:scanning:changed', status)
    })
  }
}
