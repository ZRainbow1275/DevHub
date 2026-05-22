import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, type BrowserWindow, type ProcessMetric } from 'electron'
import {
  buildEmptyReactCommitReport,
  type CacheSizeRow,
  type DisposalReport,
  type DevObservabilityExportBundle,
  type ErrorLogRow,
  type ExportDiagnosticBundleRequest,
  type ExportDiagnosticBundleResponse,
  type MetricSample,
  type PsPoolStatsRow,
  type ReactCommitReport,
  type RuntimeMetricsResetScope,
  type RuntimeMetricsSnapshot,
  type ScannerHealthRow
} from '@shared/observability'
import type { BackgroundScannerManager } from '../BackgroundScannerManager'
import { getDisposalRegistry } from '../runtime/DisposalRegistry'
import { getPowerShellGateway } from '../runtime/PowerShellGateway'
import { IpcChannelCounter } from './IpcChannelCounter'
import { RingBuffer } from './RingBuffer'

interface MetricsCollectorOptions {
  getMainWindow: () => BrowserWindow | null
  scannerManager?: BackgroundScannerManager
  ipcCounter?: IpcChannelCounter
  sampleIntervalMs?: number
  rssBufferCapacity?: number
  cpuBufferCapacity?: number
  recentErrorLimit?: number
}

export const CPU_AVERAGE_WINDOW_MS = 5 * 60 * 1000

export function computeMetricWindowAverage(
  samples: readonly MetricSample[],
  sampledAt: number,
  windowMs = CPU_AVERAGE_WINDOW_MS
): number {
  const windowStart = sampledAt - windowMs
  const values = samples
    .filter((sample) => sample.ts >= windowStart && sample.ts <= sampledAt)
    .map((sample) => sample.v)
    .filter((value) => Number.isFinite(value))

  if (values.length === 0) {
    return 0
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round((total / values.length) * 10) / 10
}

export class MetricsCollector {
  private readonly cpuSeries: RingBuffer<MetricSample>
  private readonly ipcCounter: IpcChannelCounter
  private lastSnapshot: RuntimeMetricsSnapshot | null = null
  private latestCpuNow = 0
  private readonly mainRss: RingBuffer<MetricSample>
  private readonly recentErrorLimit: number
  private readonly recentErrors: ErrorLogRow[] = []
  private readonly rendererRss: RingBuffer<MetricSample>
  private sampleTimer: NodeJS.Timeout | null = null
  private readonly sampleIntervalMs: number

  constructor(private readonly options: MetricsCollectorOptions) {
    this.sampleIntervalMs = options.sampleIntervalMs ?? 1000
    this.mainRss = new RingBuffer<MetricSample>(options.rssBufferCapacity ?? 30)
    this.rendererRss = new RingBuffer<MetricSample>(options.rssBufferCapacity ?? 30)
    this.cpuSeries = new RingBuffer<MetricSample>(options.cpuBufferCapacity ?? 300)
    this.ipcCounter = options.ipcCounter ?? new IpcChannelCounter()
    this.recentErrorLimit = options.recentErrorLimit ?? 50
  }

  start(): void {
    if (this.sampleTimer) {
      return
    }

    void this.collectSample()
    this.sampleTimer = setInterval(() => {
      void this.collectSample()
    }, this.sampleIntervalMs)
    this.sampleTimer.unref?.()
  }

  stop(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer)
      this.sampleTimer = null
    }
  }

  trackIpcChannel(channel: string): void {
    this.ipcCounter.track(channel)
  }

  getSnapshot(reactCommits?: ReactCommitReport): RuntimeMetricsSnapshot {
    const fallbackSnapshot = this.buildSnapshot(Date.now(), reactCommits)
    if (!this.lastSnapshot) {
      this.lastSnapshot = fallbackSnapshot
    }

    if (!reactCommits) {
      return this.lastSnapshot
    }

    return {
      ...this.lastSnapshot,
      reactCommits
    }
  }

  reset(scopes?: readonly RuntimeMetricsResetScope[]): readonly RuntimeMetricsResetScope[] {
    const requestedScopes = scopes && scopes.length > 0 ? new Set(scopes) : new Set<RuntimeMetricsResetScope>(['all'])
    const cleared = new Set<RuntimeMetricsResetScope>()

    const shouldClear = (scope: RuntimeMetricsResetScope): boolean =>
      requestedScopes.has('all') || requestedScopes.has(scope)

    if (shouldClear('rss')) {
      this.mainRss.clear()
      cleared.add('rss')
    }

    if (shouldClear('renderer')) {
      this.rendererRss.clear()
      cleared.add('renderer')
    }

    if (shouldClear('cpu')) {
      this.cpuSeries.clear()
      this.latestCpuNow = 0
      cleared.add('cpu')
    }

    if (shouldClear('ipc')) {
      this.ipcCounter.reset()
      cleared.add('ipc')
    }

    if (shouldClear('errors')) {
      this.recentErrors.length = 0
      cleared.add('errors')
    }

    if (requestedScopes.has('all')) {
      cleared.add('all')
    }

    this.lastSnapshot = this.buildSnapshot(Date.now())
    return Array.from(cleared)
  }

  async exportBundle(
    request?: ExportDiagnosticBundleRequest
  ): Promise<ExportDiagnosticBundleResponse> {
    const reactCommits = request?.reactCommits ?? this.lastSnapshot?.reactCommits ?? buildEmptyReactCommitReport()
    const snapshot = this.getSnapshot(reactCommits)

    const bundle: DevObservabilityExportBundle = {
      ...snapshot,
      exportedAt: Date.now()
    }

    const directory = join(app.getPath('userData'), 'diagnostics')
    const filename = `devobs-${this.formatTimestamp(bundle.exportedAt)}.json`
    const filePath = join(directory, filename)
    const content = JSON.stringify(bundle, null, 2)

    try {
      await mkdir(directory, { recursive: true })
      await writeFile(filePath, content, 'utf8')
      return {
        path: filePath,
        bytes: Buffer.byteLength(content, 'utf8')
      }
    } catch (error) {
      this.recordError('MetricsCollector.exportBundle', error)
      throw error
    }
  }

  private async collectSample(): Promise<void> {
    const sampledAt = Date.now()

    try {
      const appMetrics = this.readAppMetrics()
      const mainRssValue = process.memoryUsage().rss / 1024 / 1024
      const rendererRssValue = this.readRendererRssMB(appMetrics)
      const cpuNow = this.readMainProcessCpuPercent(appMetrics)

      this.mainRss.push({ ts: sampledAt, v: mainRssValue })
      this.rendererRss.push({ ts: sampledAt, v: rendererRssValue })
      this.cpuSeries.push({ ts: sampledAt, v: cpuNow })
      this.latestCpuNow = cpuNow
      this.lastSnapshot = this.buildSnapshot(sampledAt)
    } catch (error) {
      this.recordError('MetricsCollector.collectSample', error)
      this.lastSnapshot = this.buildSnapshot(sampledAt)
    }
  }

  private buildSnapshot(
    sampledAt: number,
    reactCommits: ReactCommitReport = buildEmptyReactCommitReport()
  ): RuntimeMetricsSnapshot {
    const powerShellStats = getPowerShellGateway().getStats()
    const disposalRegistry = getDisposalRegistry()
    const lastDisposalReport = disposalRegistry.getLastReport() as DisposalReport | null

    return {
      schemaVersion: 1,
      sampledAt,
      mainRss: this.mainRss.snapshot(),
      rendererRss: this.rendererRss.snapshot(),
      psChildCount: powerShellStats.runningPids.length,
      psChildPids: powerShellStats.runningPids,
      cpuNow: this.latestCpuNow,
      cpu5mAvg: this.computeCpuAverage(sampledAt),
      cpuSeries: this.cpuSeries.snapshot(),
      ipcRpm: this.ipcCounter.getReport(),
      reactCommits,
      extended: {
        scannerHealth: this.buildScannerHealth(),
        scannerBackpressure: this.buildScannerBackpressure(),
        psPoolStats: this.buildPowerShellStats(),
        disposalPending: lastDisposalReport?.remainingAfter.length ?? 0,
        lastDisposalReport,
        recentErrors: [...this.recentErrors],
        cacheSizes: this.buildCacheSizes()
      }
    }
  }

  private buildScannerHealth(): ScannerHealthRow[] {
    const scanStatus = this.options.scannerManager?.getCache().getScanStatus()
    if (!scanStatus) {
      return []
    }

    return Object.entries(scanStatus).map(([kind, status]) => ({
      kind,
      state: status.error ? 'failed' : status.isScanning ? 'scanning' : 'idle',
      lastRunAt: status.lastUpdated > 0 ? status.lastUpdated : null,
      lastDurationMs: null,
      consecutiveFailures: status.error ? 1 : 0,
      error: status.error
    }))
  }

  private buildScannerBackpressure() {
    return this.options.scannerManager?.getChannelAckSnapshot() ?? []
  }

  private buildPowerShellStats(): PsPoolStatsRow {
    const stats = getPowerShellGateway().getStats()
    const workers = Math.max(2, stats.activeCount)
    const busy = stats.activeCount
    const idle = Math.max(0, workers - busy)

    return {
      workers,
      idle,
      busy,
      queued: stats.queuedCount,
      completedTotal: stats.completedCount,
      failedTotal: stats.failedCount,
      timedOutTotal: stats.timedOutCount,
      abortedTotal: stats.abortedCount,
      maxObservedQueue: stats.maxObservedQueue,
      runningPids: stats.runningPids
    }
  }

  private buildCacheSizes(): CacheSizeRow[] {
    const snapshot = this.options.scannerManager?.getCache().getSnapshot()
    if (!snapshot) {
      return []
    }

    return [
      {
        name: 'processes',
        entries: snapshot.processes.data.length,
        bytes: this.estimateBytes(snapshot.processes.data)
      },
      {
        name: 'ports',
        entries: snapshot.ports.data.length,
        bytes: this.estimateBytes(snapshot.ports.data)
      },
      {
        name: 'windows',
        entries: snapshot.windows.data.length,
        bytes: this.estimateBytes(snapshot.windows.data)
      },
      {
        name: 'aiTasks',
        entries: snapshot.aiTasks.data.length,
        bytes: this.estimateBytes(snapshot.aiTasks.data)
      }
    ]
  }

  private computeCpuAverage(sampledAt: number): number {
    return computeMetricWindowAverage(this.cpuSeries.snapshot().items, sampledAt)
  }

  private estimateBytes(value: unknown): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8')
    } catch {
      return 0
    }
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp)
    const pad = (value: number) => String(value).padStart(2, '0')

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('') + 'T' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join('')
  }

  private recordError(source: string, error: unknown): void {
    const normalized = error instanceof Error
      ? error
      : new Error(String(error))

    this.recentErrors.push({
      ts: Date.now(),
      level: 'error',
      source,
      message: normalized.message,
      stack: normalized.stack
    })

    if (this.recentErrors.length > this.recentErrorLimit) {
      this.recentErrors.splice(0, this.recentErrors.length - this.recentErrorLimit)
    }
  }

  private readAppMetrics(): ProcessMetric[] {
    try {
      return app.getAppMetrics()
    } catch (error) {
      this.recordError('MetricsCollector.readAppMetrics', error)
    }

    return []
  }

  private readMainProcessCpuPercent(appMetrics: readonly ProcessMetric[]): number {
    const mainMetric = appMetrics.find((metric) => metric.pid === process.pid)
      ?? appMetrics.find((metric) => metric.type === 'Browser')
    const value = mainMetric?.cpu?.percentCPUUsage ?? 0
    return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0
  }

  private readRendererRssMB(appMetrics: readonly ProcessMetric[]): number {
    const mainWindow = this.options.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return Number.NaN
    }

    try {
      const rendererPid = typeof mainWindow.webContents.getOSProcessId === 'function'
        ? mainWindow.webContents.getOSProcessId()
        : mainWindow.webContents.getProcessId()
      const rendererMetric = appMetrics.find((metric) => metric.pid === rendererPid)
      if (!rendererMetric?.memory) {
        return Number.NaN
      }

      const residentSetKb = typeof rendererMetric.memory.workingSetSize === 'number'
        ? rendererMetric.memory.workingSetSize
        : rendererMetric.memory.privateBytes ?? Number.NaN
      return residentSetKb / 1024
    } catch (error) {
      this.recordError('MetricsCollector.readRendererRssMB', error)
      return Number.NaN
    }
  }
}
