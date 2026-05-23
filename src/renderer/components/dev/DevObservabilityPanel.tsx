import { useMemo, useState } from 'react'
import type {
  CacheSizeRow,
  ChannelRpmEntry,
  ErrorLogRow,
  IpcThrottleChannelReport,
  IpcThrottleReport,
  MetricSample,
  ReactCommitEntry,
  RuntimeMetricsSnapshot,
  ScannerBackpressureRow,
  ScannerHealthRow
} from '@shared/observability'
import type { ObservabilityMetricSample, ObservabilitySnapshot } from '@shared/schemas/r8-runtime'
import { ObservabilityPanel } from '../../views/observability/ObservabilityPanel'
import { useT } from '../../hooks/useT'

type PanelTab = 'observability' | 'core' | 'ipc' | 'scanners' | 'errors' | 'cache'

interface DevObservabilityPanelProps {
  error: string | null
  hotkeyLabel: string
  isRefreshing: boolean
  onClose: () => void
  onExport: () => void
  onExportObservationCsv: () => void
  onExportObservationJson: () => void
  onRefresh: () => void
  onReset: () => void
  open: boolean
  observabilitySnapshot: ObservabilitySnapshot | null
  snapshot: RuntimeMetricsSnapshot | null
  subscribeObservability: (listener: (samples: ObservabilityMetricSample[]) => void) => () => void
  throttleReport: IpcThrottleReport | null
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }
  return Math.round(value).toLocaleString()
}

function formatMetric(value: number, digits = 1, suffix = ''): string {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }
  return `${value.toFixed(digits)}${suffix}`
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) {
    return '未记录'
  }

  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false
  })
}

function MetricSparkline({
  color,
  samples
}: {
  color: string
  samples: readonly MetricSample[]
}) {
  const width = 280
  const height = 72
  const padding = 6

  const plotted = useMemo(() => {
    const finite = samples.filter((sample) => Number.isFinite(sample.v))
    if (finite.length === 0) {
      return null
    }

    const values = finite.map((sample) => sample.v)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const spread = max - min || 1

    return finite.map((sample, index) => {
      const x = padding + ((width - padding * 2) * index) / Math.max(finite.length - 1, 1)
      const y = height - padding - ((sample.v - min) / spread) * (height - padding * 2)
      return { ...sample, x, y }
    })
  }, [samples])

  if (!plotted || plotted.length === 0) {
    return (
      <div className="h-[72px] flex items-center justify-center text-xs text-text-muted border border-surface-700 radius-sm">
        暂无采样
      </div>
    )
  }

  const points = plotted.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <svg className="w-full h-[72px]" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {plotted.map((point, index) => (
        <circle
          key={`${point.ts}-${index}`}
          cx={point.x}
          cy={point.y}
          data-sample={point.v}
          fill={color}
          r="2.5"
        />
      ))}
    </svg>
  )
}

function SectionCard({
  children,
  title,
  testId
}: {
  children: React.ReactNode
  title: string
  testId?: string
}) {
  return (
    <section
      className="border border-surface-700 bg-surface-900/80 p-4 radius-md shadow-panel"
      data-testid={testId}
    >
      <div className="text-xs uppercase tracking-[0.24em] text-text-muted mb-3">{title}</div>
      {children}
    </section>
  )
}

function MetricSummary({
  label,
  value
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-lg font-semibold text-text-primary">{value}</span>
    </div>
  )
}

function DenseList<T>({
  empty,
  items,
  renderItem
}: {
  empty: string
  items: readonly T[]
  renderItem: (item: T, index: number) => React.ReactNode
}) {
  if (items.length === 0) {
    return <div className="text-sm text-text-muted">{empty}</div>
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-surface-700/80 bg-surface-950/60 px-3 py-2 radius-sm">
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}

function renderChannel(channel: ChannelRpmEntry) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm">
      <span className="text-text-primary truncate">{channel.channel}</span>
      <span className="text-text-secondary">{channel.rpm} rpm</span>
      <span className="text-text-muted">boot {channel.totalSinceBoot}</span>
    </div>
  )
}

function renderCommit(entry: ReactCommitEntry) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 text-sm">
      <div>
        <div className="text-text-primary truncate">{entry.id}</div>
        <div className="text-text-muted">
          {entry.lastPhase ?? 'unknown'} · {formatTimestamp(entry.lastCommitTime)}
        </div>
      </div>
      <div className="text-right">
        <div className="text-text-primary">{entry.commits} commits</div>
        <div className="text-text-muted">
          avg {formatMetric(entry.avgActualMs, 1, 'ms')}
        </div>
      </div>
    </div>
  )
}

function renderScanner(row: ScannerHealthRow) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 text-sm">
      <div>
        <div className="text-text-primary">{row.kind}</div>
        <div className="text-text-muted">
          上次运行 {formatTimestamp(row.lastRunAt)}
        </div>
      </div>
      <div className="text-right">
        <div className="text-text-primary">{row.state}</div>
        <div className="text-text-muted">
          连续失败 {row.consecutiveFailures}
        </div>
      </div>
    </div>
  )
}

function renderBackpressure(row: ScannerBackpressureRow) {
  const status = row.suspended
    ? 'suspended'
    : row.timedOut
      ? 'timeout'
      : row.pendingSeq === null
        ? 'healthy'
        : 'waiting-ack'

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-primary truncate">{row.channel}</span>
        <span
          className={
            row.suspended
              ? 'text-error'
              : row.timedOut
                ? 'text-amber-300'
                : 'text-text-secondary'
          }
        >
          {status} / lag {row.ackLag}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>sent seq {row.lastSentSeq ?? 'N/A'}</span>
        <span>acked seq {row.lastAckedSeq ?? 'N/A'}</span>
        <span>pending {row.pendingSeq ?? 'none'}</span>
        <span>queued {row.queuedEnvelopes}</span>
        <span>dropped {row.droppedEnvelopes}</span>
        <span>timeout {row.timeoutCount}</span>
        <span>sent {formatTimestamp(row.lastSentAt)}</span>
        <span>acked {formatTimestamp(row.lastAckedAt)}</span>
        <span>timeout at {formatTimestamp(row.lastTimeoutAt)}</span>
        <span>suspended {row.suspended ? 'yes' : 'no'}</span>
        <span>suspended at {formatTimestamp(row.suspendedAt)}</span>
      </div>
    </div>
  )
}

function renderError(row: ErrorLogRow) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-primary">{row.source}</span>
        <span className="text-text-muted">{formatTimestamp(row.ts)}</span>
      </div>
      <div className="text-text-secondary">{row.message}</div>
      {row.stack ? (
        <pre className="text-xs text-text-muted whitespace-pre-wrap break-all">{row.stack}</pre>
      ) : null}
    </div>
  )
}

function renderCache(row: CacheSizeRow) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-sm">
      <span className="text-text-primary">{row.name}</span>
      <span className="text-text-secondary">{row.entries} entries</span>
      <span className="text-text-muted">{formatCount(row.bytes)} bytes</span>
    </div>
  )
}

function renderThrottle(row: IpcThrottleChannelReport) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-primary truncate">{row.channel}</span>
        <span className="text-text-secondary">
          {row.activeWindowCount}/{row.limit}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>allowed {row.allowed}</span>
        <span>rejected {row.rejected}</span>
        <span>dropped {row.dropped}</span>
        <span>remaining {row.remaining}</span>
        <span>window {Math.round(row.windowMs / 1000)}s</span>
        <span>reset {formatTimestamp(row.resetAt)}</span>
      </div>
    </div>
  )
}

export function DevObservabilityPanel({
  error,
  hotkeyLabel,
  isRefreshing,
  onClose,
  onExport,
  onExportObservationCsv,
  onExportObservationJson,
  onRefresh,
  onReset,
  observabilitySnapshot,
  open,
  snapshot,
  subscribeObservability,
  throttleReport
}: DevObservabilityPanelProps) {
  const { t } = useT()
  const [activeTab, setActiveTab] = useState<PanelTab>('observability')

  if (!open) {
    return null
  }

  const scannerHealth = snapshot?.extended.scannerHealth ?? []
  const scannerBackpressure = snapshot?.extended.scannerBackpressure ?? []
  const psPoolStats = snapshot?.extended.psPoolStats
  const recentErrors = snapshot?.extended.recentErrors ?? []
  const cacheSizes = snapshot?.extended.cacheSizes ?? []
  const throttleRows = Object.values(throttleReport?.channels ?? {}).sort((left, right) => {
    if (right.rejected !== left.rejected) {
      return right.rejected - left.rejected
    }

    return right.allowed - left.allowed
  })

  return (
    <div
      className="fixed inset-y-4 right-4 z-[70] w-[min(32rem,calc(100vw-2rem))] bg-surface-950/98 border-2 border-surface-700 shadow-elevated backdrop-blur radius-lg flex flex-col overflow-hidden"
      data-testid="dev-obs-panel"
    >
      <div className="px-5 py-4 border-b border-surface-700 bg-surface-900/90">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-text-muted">Developer Observability</div>
            <div className="text-lg font-semibold text-text-primary mt-1">Runtime Metrics</div>
            <div className="text-xs text-text-muted mt-1">
              热键 {hotkeyLabel} · 最近采样 {formatTimestamp(snapshot?.sampledAt ?? null)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm border border-surface-600 radius-sm" onClick={onRefresh} type="button">
              刷新
            </button>
            <button className="px-3 py-1.5 text-sm border border-surface-600 radius-sm" onClick={onReset} type="button">
              重置
            </button>
            <button className="px-3 py-1.5 text-sm border border-surface-600 radius-sm" data-testid="export-btn" onClick={onExport} type="button">
              导出
            </button>
            <button className="px-3 py-1.5 text-sm border border-surface-600 radius-sm" onClick={onClose} type="button">
              关闭
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-3 text-sm text-error border border-error/30 bg-error/10 px-3 py-2 radius-sm">
            {error}
          </div>
        ) : null}
      </div>

      <div className="px-4 py-3 border-b border-surface-700 bg-surface-950/90 flex flex-wrap gap-2">
        {([
          ['observability', 'R8.C'],
          ['core', '核心'],
          ['ipc', 'IPC'],
          ['scanners', '扫描器'],
          ['errors', '错误'],
          ['cache', '缓存']
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            className={`px-3 py-1.5 text-sm border radius-sm ${activeTab === tab ? 'border-accent text-accent bg-accent/10' : 'border-surface-700 text-text-secondary'}`}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {label}
          </button>
        ))}
        <div className="ml-auto text-xs text-text-muted self-center">
          {isRefreshing ? '采集中…' : '1s polling'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'observability' ? (
          <ObservabilityPanel
            onExportCsv={onExportObservationCsv}
            onExportJson={onExportObservationJson}
            snapshot={observabilitySnapshot}
            subscribe={subscribeObservability}
          />
        ) : null}

        {activeTab === 'core' ? (
          <>
            <SectionCard title={t('dev.observability.cards.mainRss', 'Main RSS')} testId="metric-main-rss">
              <div className="space-y-3">
                <MetricSummary label="当前" value={formatMetric(snapshot?.mainRss.items.at(-1)?.v ?? Number.NaN, 1, ' MB')} />
                <MetricSparkline color="#f97316" samples={snapshot?.mainRss.items ?? []} />
              </div>
            </SectionCard>

            <SectionCard title={t('dev.observability.cards.rendererRss', 'Renderer RSS')} testId="metric-renderer-rss">
              <div className="space-y-3">
                <MetricSummary label="当前" value={formatMetric(snapshot?.rendererRss.items.at(-1)?.v ?? Number.NaN, 1, ' MB')} />
                <MetricSparkline color="#22c55e" samples={snapshot?.rendererRss.items ?? []} />
              </div>
            </SectionCard>

            <SectionCard title={t('dev.observability.cards.psChildren', 'PowerShell Children')} testId="metric-ps-children">
              <div className="space-y-3">
                <MetricSummary label="活跃子进程" value={formatCount(snapshot?.psChildCount ?? Number.NaN)} />
                <div className="text-sm text-text-secondary break-all">
                  PIDs: {(snapshot?.psChildPids ?? []).length > 0 ? snapshot?.psChildPids.join(', ') : '无'}
                </div>
              </div>
            </SectionCard>

            <SectionCard title={t('dev.observability.cards.cpu', 'CPU')} testId="metric-cpu">
              <div className="space-y-3">
                <MetricSummary label="当前 / 5m 平均" value={`${formatMetric(snapshot?.cpuNow ?? Number.NaN, 1, '%')} / ${formatMetric(snapshot?.cpu5mAvg ?? Number.NaN, 1, '%')}`} />
                <MetricSparkline color="#38bdf8" samples={snapshot?.cpuSeries.items ?? []} />
              </div>
            </SectionCard>

            <SectionCard title={t('dev.observability.cards.ipcRpm', 'IPC RPM')} testId="metric-ipc-rpm">
              <DenseList
                empty="暂无 IPC 采样"
                items={snapshot?.ipcRpm.top ?? []}
                renderItem={(item) => renderChannel(item)}
              />
            </SectionCard>

            <SectionCard title={t('dev.observability.cards.reactCommits', 'React Commits')} testId="metric-react-commits">
              <DenseList
                empty="暂无 React commit 采样"
                items={snapshot?.reactCommits.top ?? []}
                renderItem={(item) => renderCommit(item)}
              />
            </SectionCard>
          </>
        ) : null}

        {activeTab === 'ipc' ? (
          <>
            <SectionCard title={t('dev.observability.cards.throttleSnapshot', 'Throttle Snapshot')}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MetricSummary label="channels" value={formatCount(throttleRows.length)} />
                <MetricSummary
                  label="generated"
                  value={formatTimestamp(throttleReport?.generatedAt ?? null)}
                />
              </div>
            </SectionCard>

            <SectionCard title={t('dev.observability.cards.inboundLimits', 'Inbound Limits')} testId="metric-ipc-throttle">
              <DenseList
                empty="暂无 throttle 统计"
                items={throttleRows}
                renderItem={(item) => renderThrottle(item)}
              />
            </SectionCard>
          </>
        ) : null}

        {activeTab === 'scanners' ? (
          <>
            <SectionCard title={t('dev.observability.cards.scannerHealth', 'Scanner Health')}>
              <DenseList empty="暂无扫描器状态" items={scannerHealth} renderItem={(item) => renderScanner(item)} />
            </SectionCard>

            <SectionCard title={t('dev.observability.cards.rendererAck', 'Renderer ACK Backpressure')}>
              <DenseList
                empty="鏆傛棤 ACK 鍘嬪姏鐘舵€?"
                items={scannerBackpressure}
                renderItem={(item) => renderBackpressure(item)}
              />
            </SectionCard>

            <SectionCard title={t('dev.observability.cards.powerShellPool', 'PowerShell Pool')}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MetricSummary label="workers" value={formatCount(psPoolStats?.workers ?? Number.NaN)} />
                <MetricSummary label="idle" value={formatCount(psPoolStats?.idle ?? Number.NaN)} />
                <MetricSummary label="busy" value={formatCount(psPoolStats?.busy ?? Number.NaN)} />
                <MetricSummary label="queued" value={formatCount(psPoolStats?.queued ?? Number.NaN)} />
                <MetricSummary label="completed" value={formatCount(psPoolStats?.completedTotal ?? Number.NaN)} />
                <MetricSummary label="failed" value={formatCount(psPoolStats?.failedTotal ?? Number.NaN)} />
              </div>
            </SectionCard>
          </>
        ) : null}

        {activeTab === 'errors' ? (
          <SectionCard title={t('dev.observability.cards.recentErrors', 'Recent Errors')}>
            <DenseList empty="最近没有错误" items={recentErrors} renderItem={(item) => renderError(item)} />
          </SectionCard>
        ) : null}

        {activeTab === 'cache' ? (
          <>
            <SectionCard title={t('dev.observability.cards.cacheSizes', 'Cache Sizes')}>
              <DenseList empty="暂无缓存统计" items={cacheSizes} renderItem={(item) => renderCache(item)} />
            </SectionCard>
            <SectionCard title={t('dev.observability.cards.disposalPending', 'Disposal Pending')}>
              <MetricSummary label="待清理对象" value={formatCount(snapshot?.extended.disposalPending ?? Number.NaN)} />
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  )
}
