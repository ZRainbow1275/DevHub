import { BrowserWindow } from 'electron'
import { SystemProcessScanner } from './SystemProcessScanner'
import { PortScanner } from './PortScanner'
import { WindowManager } from './WindowManager'
import { AITaskTracker } from './AITaskTracker'
import { ScannerCache, ScannerType } from './ScannerCache'
import type {
  AITask,
  IPCEnvelope,
  ProcessInfo,
  ScannerAckResponse,
  ScannerChannelSeqMap,
  ScannerDiff,
  ScannerDiffChannel,
  SystemSummary,
  WindowInfo
} from '@shared/types-extended'
import type { ScannerBackpressureRow } from '@shared/observability'
import type { PortInfo } from '@shared/types-extended'
import { BroadcastBatcher } from '../ipc/BroadcastBatcher'

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
const ACK_TIMEOUT_SUSPEND_THRESHOLD = 3
const DIFF_QUEUE_CAPACITY = 256
const RENDERER_ACK_TIMEOUT_MS = 10_000

type ProgressCallback = (stage: string, percent: number, text: string) => void
type ScannerEnvelopePayload = ScannerDiff<unknown> | ScannerDiff<unknown>[]
type QueuedScannerEnvelope = IPCEnvelope<ScannerEnvelopePayload>

interface ChannelAckState {
  consecutiveTimeouts: number
  droppedEnvelopes: number
  lastAckedAt: number | null
  lastAckedSeq: number | null
  lastSentAt: number | null
  lastSentSeq: number | null
  lastTimeoutAt: number | null
  pendingSeq: number | null
  pendingEnvelopes: QueuedScannerEnvelope[]
  pendingSince: number | null
  suspended: boolean
  suspendedAt: number | null
  timedOut: boolean
  timeoutCount: number
  timer: NodeJS.Timeout | null
}

function createChannelAckState(): ChannelAckState {
  return {
    consecutiveTimeouts: 0,
    droppedEnvelopes: 0,
    lastAckedAt: null,
    lastAckedSeq: null,
    lastSentAt: null,
    lastSentSeq: null,
    lastTimeoutAt: null,
    pendingSeq: null,
    pendingEnvelopes: [],
    pendingSince: null,
    suspended: false,
    suspendedAt: null,
    timedOut: false,
    timeoutCount: 0,
    timer: null
  }
}

// ============ Background Scanner Manager ============

export class BackgroundScannerManager {
  private channelAckStates = new Map<ScannerDiffChannel, ChannelAckState>()
  private batchers = new Map<string, BroadcastBatcher<unknown>>()
  private channelSeqs = new Map<ScannerDiffChannel, number>()
  private timers = new Map<ScannerType, NodeJS.Timeout>()
  private retryTimers = new Map<ScannerType, NodeJS.Timeout>()
  private scanningGuards = new Set<ScannerType>()
  private cache: ScannerCache
  private cacheForwardingInitialized = false
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
  async stopAll(): Promise<void> {
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
    const batchers = Array.from(this.batchers.values())
    await Promise.all(batchers.map(async (batcher) => batcher.close()))
    this.batchers.clear()
    this.clearAllAckTimers()
    this.channelAckStates.clear()
    this.channelSeqs.clear()
    this.cacheForwardingInitialized = false
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

  getChannelSeqSnapshot(): ScannerChannelSeqMap {
    return Object.fromEntries(this.channelSeqs.entries()) as ScannerChannelSeqMap
  }

  getChannelAckSnapshot(): ScannerBackpressureRow[] {
    return Array.from(this.channelAckStates.entries())
      .map(([channel, state]) => ({
        channel,
        droppedEnvelopes: state.droppedEnvelopes,
        lastSentSeq: state.lastSentSeq,
        lastSentAt: state.lastSentAt,
        lastAckedSeq: state.lastAckedSeq,
        lastAckedAt: state.lastAckedAt,
        pendingSeq: state.pendingSeq,
        queuedEnvelopes: state.pendingEnvelopes.length,
        pendingSince: state.pendingSince,
        ackLag: state.lastSentSeq === null
          ? 0
          : Math.max(state.lastSentSeq - (state.lastAckedSeq ?? 0), 0),
        suspended: state.suspended,
        suspendedAt: state.suspendedAt,
        timedOut: state.timedOut,
        timeoutCount: state.timeoutCount,
        lastTimeoutAt: state.lastTimeoutAt
      }))
      .sort((left, right) => {
        if (Number(right.suspended) !== Number(left.suspended)) {
          return Number(right.suspended) - Number(left.suspended)
        }

        if (Number(right.timedOut) !== Number(left.timedOut)) {
          return Number(right.timedOut) - Number(left.timedOut)
        }

        return right.ackLag - left.ackLag
      })
  }

  prepareChannelsForSnapshot(channelSeqs?: ScannerChannelSeqMap): void {
    const channels = (channelSeqs ? Object.keys(channelSeqs) : Array.from(this.channelSeqs.keys()))
      .filter((channel): channel is ScannerDiffChannel => typeof channel === 'string')

    if (channels.length === 0) {
      return
    }

    const now = Date.now()
    for (const channel of channels) {
      const state = this.getChannelAckState(channel)
      state.pendingEnvelopes = []
      state.suspended = false
      state.suspendedAt = null
      state.timedOut = false
      state.consecutiveTimeouts = 0

      if (state.pendingSeq !== null) {
        state.pendingSince = now
        this.scheduleAckTimeout(channel)
      } else {
        this.clearAckTimeout(channel)
      }
    }
  }

  ackChannelSeq(channel: ScannerDiffChannel, seq: number): ScannerAckResponse {
    const state = this.getChannelAckState(channel)
    if (!Number.isInteger(seq) || seq < 1) {
      return {
        accepted: false,
        channel,
        ackedSeq: seq,
        lastSentSeq: state.lastSentSeq,
        pendingSeq: state.pendingSeq
      }
    }

    if (state.lastAckedSeq !== null && seq <= state.lastAckedSeq) {
      return {
        accepted: true,
        channel,
        ackedSeq: state.lastAckedSeq,
        lastSentSeq: state.lastSentSeq,
        pendingSeq: state.pendingSeq
      }
    }

    const now = Date.now()
    state.lastAckedSeq = seq
    state.lastAckedAt = now
    state.timedOut = false
    state.consecutiveTimeouts = 0

    if (state.pendingSeq !== null && seq >= state.pendingSeq) {
      state.pendingSeq = null
      state.pendingSince = null
      this.clearAckTimeout(channel)
      this.pruneQueuedEnvelopes(channel, seq)

      if (!state.suspended) {
        this.flushQueuedEnvelope(channel)
      }
    }

    return {
      accepted: true,
      channel,
      ackedSeq: seq,
      lastSentSeq: state.lastSentSeq,
      pendingSeq: state.pendingSeq
    }
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

    // AI completion detection must observe the current process table. The
    // process scanner cache can lag behind this 1s AI scan loop and miss short
    // Claude Code runs, so refresh here and keep the shared cache in sync.
    const processes = this.processScanner
      ? await this.processScanner.getAll({ refresh: true })
      : this.cache.getProcesses()
    if (this.processScanner) {
      this.cache.updateProcesses(processes)
    }

    const windows = this.cache.getWindows()
    await this.aiTaskTracker.scanForAITasks(processes, windows)
    const tasks = this.aiTaskTracker.getActiveTasks()
    this.cache.updateAITasks(tasks)
  }

  // ---- Private: IPC forwarding ----

  private setupCacheEventForwarding(): void {
    if (this.cacheForwardingInitialized) {
      return
    }

    this.cacheForwardingInitialized = true

    const sendToRenderer = (channel: string, data: unknown): void => {
      const win = this.getMainWindow?.()
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }

    const registerDiffBatcher = <T>(
      sourceEvent: 'processes:updated' | 'ports:updated' | 'windows:updated' | 'aiTasks:updated',
      channel: ScannerDiffChannel,
      options: { windowMs: number; maxBatchSize: number; maxBufferBytes: number }
    ): void => {
      const batcher = new BroadcastBatcher<ScannerDiff<T>>({
        channel,
        maxBatchSize: options.maxBatchSize,
        maxBufferBytes: options.maxBufferBytes,
        windowMs: options.windowMs
      })

      batcher.onFlush((batch, seq, meta) => {
        this.channelSeqs.set(channel, seq)
        const envelope: IPCEnvelope<ScannerDiff<T> | ScannerDiff<T>[]> = {
          channel,
          seq,
          timestamp: Date.now(),
          batch: batch.length > 1,
          partial: true,
          payload: batch.length === 1 ? batch[0] : batch
        }

        if (meta.truncated) {
          envelope.meta = { truncated: true }
        }

        this.dispatchDiffEnvelope(channel, envelope as QueuedScannerEnvelope)
      })

      this.batchers.set(channel, batcher as BroadcastBatcher<unknown>)
      this.cache.on(sourceEvent, (diff: ScannerDiff<T>) => {
        batcher.enqueue(diff)
      })
    }

    registerDiffBatcher<ProcessInfo>('processes:updated', 'scanner:processes:diff', {
      windowMs: 200,
      maxBatchSize: 50,
      maxBufferBytes: 256 * 1024
    })

    registerDiffBatcher<PortInfo>('ports:updated', 'scanner:ports:diff', {
      windowMs: 300,
      maxBatchSize: 50,
      maxBufferBytes: 256 * 1024
    })

    registerDiffBatcher<WindowInfo>('windows:updated', 'scanner:windows:diff', {
      windowMs: 150,
      maxBatchSize: 80,
      maxBufferBytes: 256 * 1024
    })
    this.cache.on('windows:updated', () => {
      sendToRenderer('window:updated', this.cache.getWindows())
    })

    registerDiffBatcher<AITask>('aiTasks:updated', 'scanner:aiTasks:diff', {
      windowMs: 500,
      maxBatchSize: 30,
      maxBufferBytes: 256 * 1024
    })
    this.cache.on('aiTasks:updated', (diff: ScannerDiff<AITask>) => {
      const tasksById = new Map(this.cache.getAITasks().map((task) => [task.id, task]))
      const changedIds = new Set<string>([
        ...diff.added.map((task) => task.id),
        ...diff.updated.map((entry) => entry.id)
      ])

      for (const taskId of changedIds) {
        const task = tasksById.get(taskId)
        if (task) {
          sendToRenderer('ai-task:updated', task)
        }
      }
    })

    this.cache.on('summary:updated', (summary: SystemSummary) => {
      sendToRenderer('scanner:summary:update', summary)
    })

    this.cache.on('scanning:changed', (status) => {
      sendToRenderer('scanner:scanning:changed', status)
    })
  }

  private clearAckTimeout(channel: ScannerDiffChannel): void {
    const state = this.channelAckStates.get(channel)
    if (!state?.timer) {
      return
    }

    clearTimeout(state.timer)
    state.timer = null
  }

  private clearAllAckTimers(): void {
    for (const [channel] of this.channelAckStates) {
      this.clearAckTimeout(channel)
    }
  }

  private getChannelAckState(channel: ScannerDiffChannel): ChannelAckState {
    const existing = this.channelAckStates.get(channel)
    if (existing) {
      return existing
    }

    const created = createChannelAckState()
    this.channelAckStates.set(channel, created)
    return created
  }

  private scheduleAckTimeout(channel: ScannerDiffChannel): void {
    const state = this.getChannelAckState(channel)
    this.clearAckTimeout(channel)

    if (state.pendingSeq === null || state.suspended) {
      return
    }

    state.timer = setTimeout(() => {
      if (state.pendingSeq === null) {
        state.timer = null
        return
      }

      state.timedOut = true
      state.timeoutCount += 1
      state.consecutiveTimeouts += 1
      state.lastTimeoutAt = Date.now()
      state.timer = null

      if (state.consecutiveTimeouts >= ACK_TIMEOUT_SUSPEND_THRESHOLD) {
        state.suspended = true
        state.suspendedAt = state.lastTimeoutAt
      }

      console.warn(
        `BackgroundScannerManager: renderer ack timeout on ${channel} pending=${state.pendingSeq} lastSent=${state.lastSentSeq ?? 'none'} lastAcked=${state.lastAckedSeq ?? 'none'} suspended=${state.suspended}`
      )

      if (!state.suspended) {
        this.scheduleAckTimeout(channel)
      }
    }, RENDERER_ACK_TIMEOUT_MS)
    state.timer.unref?.()
  }

  private trackChannelSeqSent(channel: ScannerDiffChannel, seq: number): void {
    const state = this.getChannelAckState(channel)
    const now = Date.now()
    state.lastSentSeq = seq
    state.lastSentAt = now

    if (state.pendingSeq === null) {
      state.pendingSeq = seq
      state.pendingSince = now
    }

    if (state.timer === null) {
      this.scheduleAckTimeout(channel)
    }
  }

  private dispatchDiffEnvelope(channel: ScannerDiffChannel, envelope: QueuedScannerEnvelope): void {
    const state = this.getChannelAckState(channel)
    if (state.pendingSeq !== null || state.suspended) {
      this.enqueuePendingEnvelope(channel, envelope)
      return
    }

    if (!this.sendEnvelope(channel, envelope)) {
      this.enqueuePendingEnvelope(channel, envelope)
    }
  }

  private enqueuePendingEnvelope(channel: ScannerDiffChannel, envelope: QueuedScannerEnvelope): void {
    const state = this.getChannelAckState(channel)
    if (state.pendingEnvelopes.length >= DIFF_QUEUE_CAPACITY) {
      state.pendingEnvelopes.shift()
      state.droppedEnvelopes += 1
      const nextDeliverable = state.pendingEnvelopes[0]
      if (nextDeliverable) {
        nextDeliverable.meta = {
          ...nextDeliverable.meta,
          causedBy: 'backpressure-drop-oldest',
          truncated: true
        }
      } else {
        envelope.meta = {
          ...envelope.meta,
          causedBy: 'backpressure-drop-oldest',
          truncated: true
        }
      }

      envelope.meta = {
        ...envelope.meta,
        causedBy: 'backpressure-drop-oldest',
        truncated: true
      }
    }

    state.pendingEnvelopes.push(envelope)
  }

  private flushQueuedEnvelope(channel: ScannerDiffChannel): void {
    const state = this.getChannelAckState(channel)
    if (state.pendingSeq !== null || state.suspended) {
      return
    }

    const next = state.pendingEnvelopes.shift()
    if (!next) {
      return
    }

    if (!this.sendEnvelope(channel, next)) {
      state.pendingEnvelopes.unshift(next)
    }
  }

  private pruneQueuedEnvelopes(channel: ScannerDiffChannel, ackedSeq: number): void {
    const state = this.getChannelAckState(channel)
    if (state.pendingEnvelopes.length === 0) {
      return
    }

    state.pendingEnvelopes = state.pendingEnvelopes.filter((envelope) => envelope.seq > ackedSeq)
  }

  private sendEnvelope(channel: ScannerDiffChannel, envelope: QueuedScannerEnvelope): boolean {
    const win = this.getMainWindow?.()
    if (!win || win.isDestroyed()) {
      return false
    }

    win.webContents.send(channel, envelope)
    this.trackChannelSeqSent(channel, envelope.seq)
    return true
  }
}
