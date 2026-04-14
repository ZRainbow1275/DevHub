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

// ============ Retry Config ============

const MAX_RETRIES = 5
const MAX_RETRY_DELAY_MS = 30000

type ProgressCallback = (stage: string, percent: number, text: string) => void

// ============ Background Scanner Manager ============

export class BackgroundScannerManager {
  private timers = new Map<ScannerType, NodeJS.Timeout>()
  private retryTimers = new Map<ScannerType, NodeJS.Timeout>()
  private scanningGuards = new Set<ScannerType>()
  private cache: ScannerCache
  private isRunning = false

  // Retry state
  private retryCounts = new Map<ScannerType, number>()

  // Progress callback for splash screen
  private progressCallback: ProgressCallback | null = null

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
   * Register a callback for progress updates (used by splash screen).
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback
  }

  private emitProgress(stage: string, percent: number, text: string): void {
    this.progressCallback?.(stage, percent, text)
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

    // Launch first scans with progress reporting
    // Process scan (Stage 4)
    this.emitProgress('processes', 50, 'Scanning system processes...')
    const processResult = await Promise.allSettled([this.startScanner('processes')])
    if (processResult[0].status === 'rejected') {
      console.error('BackgroundScannerManager: process scan failed:', processResult[0].reason)
    }
    this.emitProgress('processes-done', 60, 'Scanning system processes... done')

    // Port scan (Stage 5)
    this.emitProgress('ports', 65, 'Scanning ports...')
    const portResult = await Promise.allSettled([this.startScanner('ports')])
    if (portResult[0].status === 'rejected') {
      console.error('BackgroundScannerManager: port scan failed:', portResult[0].reason)
    }
    this.emitProgress('ports-done', 75, 'Scanning ports... done')

    // Window and AI scans (Stage 6)
    this.emitProgress('windows', 80, 'Scanning windows...')
    const remaining = await Promise.allSettled([
      this.startScanner('windows'),
      this.startScanner('aiTasks')
    ])
    for (const result of remaining) {
      if (result.status === 'rejected') {
        console.error('BackgroundScannerManager: scan failed:', result.reason)
      }
    }
    this.emitProgress('windows-done', 90, 'Scanning windows... done')
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
    this.retryTimers.forEach((timer) => clearTimeout(timer))
    this.retryTimers.clear()
    this.retryCounts.clear()
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
      // Reset retry count on success
      this.retryCounts.set(type, 0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`BackgroundScannerManager: first scan for ${type} failed:`, msg)
      this.cache.setError(type, msg)
      // Schedule retry for failed first scan
      this.scheduleRetry(type)
    }

    // Set up interval with overlap guard
    const interval = SCANNER_INTERVALS[type]
    const timer = setInterval(async () => {
      if (!this.isRunning) return
      if (this.scanningGuards.has(type)) return // prevent overlapping scans
      this.scanningGuards.add(type)
      try {
        await this.runScan(type)
        // Reset retry count on successful scan
        this.retryCounts.set(type, 0)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.cache.setError(type, msg)
        this.scheduleRetry(type)
      } finally {
        this.scanningGuards.delete(type)
      }
    }, interval)

    this.timers.set(type, timer)
  }

  /**
   * Schedule a retry with exponential backoff for a failed scanner.
   */
  private scheduleRetry(type: ScannerType): void {
    if (!this.isRunning) return

    const currentRetries = this.retryCounts.get(type) || 0
    if (currentRetries >= MAX_RETRIES) {
      console.error(`BackgroundScannerManager: ${type} scanner exhausted ${MAX_RETRIES} retries, giving up`)
      this.cache.setError(type, `Scanner failed after ${MAX_RETRIES} retries`)
      // Stop the interval timer so it doesn't keep firing
      const timer = this.timers.get(type)
      if (timer) {
        clearInterval(timer)
        this.timers.delete(type)
      }
      // Emit to renderer so UI can show retry button
      const win = this.getMainWindow?.()
      if (win && !win.isDestroyed()) {
        win.webContents.send('scanner:failed', { type, retries: currentRetries })
      }
      return
    }

    const nextRetry = currentRetries + 1
    this.retryCounts.set(type, nextRetry)
    const delay = Math.min(1000 * Math.pow(2, nextRetry), MAX_RETRY_DELAY_MS)
    console.warn(`BackgroundScannerManager: scheduling retry ${nextRetry}/${MAX_RETRIES} for ${type} in ${delay}ms`)

    // Clear existing retry timer if any
    const existingTimer = this.retryTimers.get(type)
    if (existingTimer) clearTimeout(existingTimer)

    const retryTimer = setTimeout(async () => {
      if (!this.isRunning) return
      try {
        await this.runScan(type)
        this.retryCounts.set(type, 0)
        console.warn(`BackgroundScannerManager: ${type} scanner recovered after retry ${nextRetry}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.cache.setError(type, msg)
        this.scheduleRetry(type)
      }
    }, delay)

    this.retryTimers.set(type, retryTimer)
  }

  /**
   * Manual retry for a specific scanner (called from renderer via IPC).
   */
  async retryScanner(type: ScannerType): Promise<{ success: boolean; error?: string }> {
    this.retryCounts.set(type, 0)
    this.cache.setScanning(type, true)
    try {
      await this.runScan(type)
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.cache.setError(type, msg)
      return { success: false, error: msg }
    }
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
