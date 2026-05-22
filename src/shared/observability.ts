export const DEV_OBS_CHANNELS = {
  GET_RUNTIME_METRICS: 'dev:get-runtime-metrics',
  RESET_RUNTIME_METRICS: 'dev:reset-runtime-metrics',
  EXPORT_DIAGNOSTIC_BUNDLE: 'dev:export-diagnostic-bundle',
  GET_THROTTLE_REPORT: 'dev:get-throttle-report'
} as const

export type Timestamp = number
export const DEFAULT_DEV_OBS_WINDOW_MS = 60_000

export interface IpcThrottleChannelReport {
  readonly channel: string
  readonly limit: number
  readonly windowMs: number
  readonly activeWindowCount: number
  readonly remaining: number
  readonly allowed: number
  readonly rejected: number
  readonly dropped: number
  readonly coalesced: number
  readonly resetAt: Timestamp | null
  readonly lastAllowedAt: Timestamp | null
  readonly lastRejectedAt: Timestamp | null
}

export interface IpcThrottleReport {
  readonly generatedAt: Timestamp
  readonly channels: Readonly<Record<string, IpcThrottleChannelReport>>
}

export interface MetricSample {
  readonly ts: Timestamp
  readonly v: number
}

export interface RingBufferSnapshot<T> {
  readonly capacity: number
  readonly size: number
  readonly items: readonly T[]
  readonly wrapped: boolean
}

export interface ChannelRpmEntry {
  readonly channel: string
  readonly rpm: number
  readonly totalSinceBoot: number
}

export interface ChannelRpmReport {
  readonly generatedAt: Timestamp
  readonly windowMs: number
  readonly top: readonly ChannelRpmEntry[]
  readonly truncated: boolean
}

export type ReactCommitPhase = 'mount' | 'update' | 'nested-update'

export interface ReactCommitEntry {
  readonly id: string
  readonly commits: number
  readonly avgActualMs: number
  readonly avgBaseMs: number
  readonly lastCommitTime: Timestamp | null
  readonly lastPhase: ReactCommitPhase | null
}

export interface ReactCommitReport {
  readonly generatedAt: Timestamp
  readonly windowMs: number
  readonly top: readonly ReactCommitEntry[]
}

export interface ScannerHealthRow {
  readonly kind: string
  readonly state: 'idle' | 'scanning' | 'failed'
  readonly lastRunAt: Timestamp | null
  readonly lastDurationMs: number | null
  readonly consecutiveFailures: number
  readonly error: string | null
}

export interface ScannerBackpressureRow {
  readonly channel: string
  readonly lastSentSeq: number | null
  readonly lastSentAt: Timestamp | null
  readonly lastAckedSeq: number | null
  readonly lastAckedAt: Timestamp | null
  readonly pendingSeq: number | null
  readonly queuedEnvelopes: number
  readonly droppedEnvelopes: number
  readonly pendingSince: Timestamp | null
  readonly ackLag: number
  readonly suspended: boolean
  readonly suspendedAt: Timestamp | null
  readonly timedOut: boolean
  readonly timeoutCount: number
  readonly lastTimeoutAt: Timestamp | null
}

export interface PsPoolStatsRow {
  readonly workers: number
  readonly idle: number
  readonly busy: number
  readonly queued: number
  readonly completedTotal: number
  readonly failedTotal: number
  readonly timedOutTotal: number
  readonly abortedTotal: number
  readonly maxObservedQueue: number
  readonly runningPids: readonly number[]
}

export interface ErrorLogRow {
  readonly ts: Timestamp
  readonly level: 'warn' | 'error' | 'fatal'
  readonly source: string
  readonly message: string
  readonly stack?: string
}

export interface CacheSizeRow {
  readonly name: string
  readonly entries: number
  readonly bytes: number
}

export interface DisposalFailureRow {
  readonly name: string
  readonly reason: string
}

export interface DisposalReport {
  readonly completedAt: Timestamp
  readonly durationMs: number
  readonly failed: readonly DisposalFailureRow[]
  readonly remainingAfter: readonly string[]
  readonly startedAt: Timestamp
  readonly succeeded: readonly string[]
  readonly timedOut: readonly string[]
  readonly total: number
}

export interface ExtendedPanels {
  readonly scannerHealth: readonly ScannerHealthRow[]
  readonly scannerBackpressure: readonly ScannerBackpressureRow[]
  readonly psPoolStats: PsPoolStatsRow
  readonly disposalPending: number
  readonly lastDisposalReport: DisposalReport | null
  readonly recentErrors: readonly ErrorLogRow[]
  readonly cacheSizes: readonly CacheSizeRow[]
}

export interface RuntimeMetricsSnapshot {
  readonly schemaVersion: 1
  readonly sampledAt: Timestamp
  readonly mainRss: RingBufferSnapshot<MetricSample>
  readonly rendererRss: RingBufferSnapshot<MetricSample>
  readonly psChildCount: number
  readonly psChildPids: readonly number[]
  readonly cpuNow: number
  readonly cpu5mAvg: number
  readonly cpuSeries: RingBufferSnapshot<MetricSample>
  readonly ipcRpm: ChannelRpmReport
  readonly reactCommits: ReactCommitReport
  readonly extended: ExtendedPanels
}

export interface DevObservabilityExportBundle extends RuntimeMetricsSnapshot {
  readonly exportedAt: Timestamp
}

export type RuntimeMetricsResetScope =
  | 'all'
  | 'rss'
  | 'renderer'
  | 'cpu'
  | 'ipc'
  | 'errors'

export interface ResetRuntimeMetricsResponse {
  readonly cleared: readonly RuntimeMetricsResetScope[]
}

export interface ExportDiagnosticBundleRequest {
  readonly includeLogs?: boolean
  readonly reactCommits?: ReactCommitReport
}

export interface ExportDiagnosticBundleResponse {
  readonly path: string
  readonly bytes: number
}

export function buildEmptyIpcThrottleReport(
  generatedAt = Date.now()
): IpcThrottleReport {
  return {
    generatedAt,
    channels: {}
  }
}

export function buildEmptyReactCommitReport(
  windowMs = DEFAULT_DEV_OBS_WINDOW_MS,
  generatedAt = Date.now()
): ReactCommitReport {
  return {
    generatedAt,
    windowMs,
    top: []
  }
}
