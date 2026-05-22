import { useCallback, useEffect, useMemo, useState } from 'react'
import { useScannerStore } from '../../stores/scannerStore'
import { AlertIcon, GearIcon, NetworkIcon, RefreshIcon, TerminalIcon } from '../icons'
import { SkillEditorPanel } from '../../views/skills/SkillEditorPanel'
import { RecoveryDialog } from '../../views/recovery/RecoveryDialog'
import { DagEditorPanel } from '../dag-editor/DagEditorPanel'
import { RecordingReplayPanel } from '../recording-replay/RecordingReplayPanel'
import { CsvLaunchWizard } from '../csv/CsvLaunchWizard'
import { MonitorWindowCards } from './MonitorWindowCards'
import { CountdownBadge } from '../permission/CountdownBadge'
import { BUILTIN_DRAWER_CONTENTS } from '../drawer/drawer-model'
import { useDrawerStore } from '../../stores/drawerStore'
import type { BackupBundle, BackupCategory, ChannelRegistration, CliOutputEvent, DiagnosticPackManifest, DiagnosticPackOptions, DiagnosticPreview, InjectResult, MonitorPopout, MonitorPopoutLayout, MonitorSnapshot, MonitorTool, MonitorWindowState, PermissionExpiryStreamPayload, QueueStats, RecordingSession, RecoveryReport, RestoreResult, SchemaMeta, SecurityTier, StatusAggregate, TaskResultExportResult, ToolDetectResult, ToolDetectionState, WatchdogStatus } from '@shared/schemas/r8-runtime'

interface R8Health {
  checkedAt: number
  featureFlags: number
  ipcChannels: number
  schemas: number
  popouts: number
  stores: string[]
}

interface R8SupervisorStatus {
  installed?: boolean
  status?: string
}

const MONITOR_TOOL_VALUES = ['codex', 'claude', 'gemini', 'cursor', 'copilot'] as const satisfies readonly MonitorTool[]
const BACKUP_CATEGORY_OPTIONS = [
  { value: 'settings', label: 'Settings', description: 'AppStore and runtime settings' },
  { value: 'csv-tasks', label: 'CSV Tasks', description: 'CSV task runtime state' },
  { value: 'skills', label: 'Skills', description: 'Local user skills' },
  { value: 'audit-log', label: 'Audit Log', description: 'Redacted audit review copy' }
] as const satisfies ReadonlyArray<{ value: BackupCategory; label: string; description: string }>
const BACKUP_CONFIRMATION_ACTOR = 'r8-ops-restore-wizard'
const R8_DIAGNOSTIC_PANEL_REQUEST = {
  sectionsIncluded: [
    'observability-snapshot',
    'audit-log',
    'system-info',
    'env-config-redacted'
  ],
  includeScreenshots: false,
  screenshotMode: 'main-window',
  redactionLevel: 'aggressive',
  customRedactionRules: []
} satisfies DiagnosticPackOptions

function readMonitorPopoutTarget(): MonitorTool | null {
  const params = new URLSearchParams(window.location.search)
  const target = params.get('target')
  return params.get('surface') === 'monitor' && MONITOR_TOOL_VALUES.includes(target as MonitorTool) ? target as MonitorTool : null
}

function isR8SupervisorStatus(value: unknown): value is R8SupervisorStatus {
  return typeof value === 'object' && value !== null
}

function isBackupBundle(value: unknown): value is BackupBundle {
  return typeof value === 'object' && value !== null && 'bundleId' in value && typeof (value as { bundleId?: unknown }).bundleId === 'string'
}

function DenseCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="border border-surface-700 bg-surface-900/80 p-4 radius-md shadow-panel">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-accent" style={{ fontFamily: 'var(--font-display)' }}>{title}</div>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-text-primary">{value}</span>
    </div>
  )
}

function DeferredFact({ label, value, tooltip }: { label: string; value: React.ReactNode; tooltip: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 text-sm opacity-70"
      title={tooltip}
      aria-label={`${label}: ${tooltip}`}
      data-r8c-deferred-integration={label}
    >
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-text-muted">{value}</span>
    </div>
  )
}

export function R8OpsPanel() {
  const ports = useScannerStore(state => state.ports)
  const [health, setHealth] = useState<R8Health | null>(null)
  const [channels, setChannels] = useState<ChannelRegistration[]>([])
  const [schemas, setSchemas] = useState<SchemaMeta[]>([])
  const [status, setStatus] = useState<StatusAggregate | null>(null)
  const [watchdog, setWatchdog] = useState<WatchdogStatus | null>(null)
  const [portTier, setPortTier] = useState<SecurityTier | null>(null)
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [taskExport, setTaskExport] = useState<TaskResultExportResult | null>(null)
  const [taskExportBusy, setTaskExportBusy] = useState(false)
  const [taskExportError, setTaskExportError] = useState<string | null>(null)
  const [cliLatest, setCliLatest] = useState<CliOutputEvent | null>(null)
  const [monitorSnapshot, setMonitorSnapshot] = useState<MonitorSnapshot | null>(null)
  const [monitorPrefsDraft, setMonitorPrefsDraft] = useState<Pick<MonitorWindowState, 'alwaysOnTop' | 'opacity'>>({ alwaysOnTop: false, opacity: 1 })
  const [monitorPopouts, setMonitorPopouts] = useState<MonitorPopout[]>([])
  const [toolDetect, setToolDetect] = useState<ToolDetectResult[]>([])
  const [toolDetectionState, setToolDetectionState] = useState<ToolDetectionState | null>(null)
  const [injectDryRun, setInjectDryRun] = useState<InjectResult | null>(null)
  const [csvSessions, setCsvSessions] = useState<unknown[]>([])
  const [csvTemplates, setCsvTemplates] = useState<unknown[]>([])
  const [recordings, setRecordings] = useState<RecordingSession[]>([])
  const [recoveryReports, setRecoveryReports] = useState<RecoveryReport[]>([])
  const [injectHistory, setInjectHistory] = useState<unknown[]>([])
  const [supervisor, setSupervisor] = useState<R8SupervisorStatus | null>(null)
  const [permissionExpiry, setPermissionExpiry] = useState<PermissionExpiryStreamPayload | null>(null)
  const [ocrCode, setOcrCode] = useState<string | null>(null)
  const [cloudCode, setCloudCode] = useState<string | null>(null)
  const [diagnosticPreview, setDiagnosticPreview] = useState<DiagnosticPreview | null>(null)
  const [diagnosticManifest, setDiagnosticManifest] = useState<DiagnosticPackManifest | null>(null)
  const [diagnosticBusy, setDiagnosticBusy] = useState(false)
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null)
  const [backupBundles, setBackupBundles] = useState<BackupBundle[]>([])
  const [selectedBackupKey, setSelectedBackupKey] = useState<string>('')
  const [selectedBackupCategories, setSelectedBackupCategories] = useState<BackupCategory[]>(BACKUP_CATEGORY_OPTIONS.map(option => option.value))
  const [restoreConflictPolicy, setRestoreConflictPolicy] = useState<'overwrite' | 'merge' | 'skip'>('overwrite')
  const [restorePreSnapshot, setRestorePreSnapshot] = useState(true)
  const [restoreConfirmed, setRestoreConfirmed] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [backupCreated, setBackupCreated] = useState<BackupBundle | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const monitorPopoutTarget = useMemo(() => readMonitorPopoutTarget(), [])
  const openDrawerContent = useDrawerStore(store => store.setContent)
  const firstListeningPort = useMemo(() => ports.find(port => port.state === 'LISTENING') ?? ports[0] ?? null, [ports])
  const poppedOutTools = useMemo(() => new Set(monitorPopouts.map(popout => popout.tool)), [monitorPopouts])
  const targetMonitorPopout = useMemo(() => (
    monitorPopoutTarget ? monitorPopouts.find(popout => popout.tool === monitorPopoutTarget) ?? null : null
  ), [monitorPopoutTarget, monitorPopouts])
  const selectedBackup = useMemo(() => backupBundles.find(bundle => (bundle.backupId ?? bundle.bundleId) === selectedBackupKey) ?? backupBundles[0] ?? null, [backupBundles, selectedBackupKey])

  const refreshBackups = useCallback(async () => {
    const nextBackups = (await window.devhub.r8.backup.list()).filter(isBackupBundle)
    setBackupBundles(nextBackups)
    setSelectedBackupKey(current => {
      if (current && nextBackups.some(bundle => (bundle.backupId ?? bundle.bundleId) === current)) return current
      return nextBackups[0] ? nextBackups[0].backupId ?? nextBackups[0].bundleId : ''
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [
        nextHealth,
        nextChannels,
        nextSchemas,
        nextStatus,
        nextWatchdog,
        nextOcr,
        nextCloud,
        nextQueue,
        nextCli,
        nextMonitorSnapshot,
        nextMonitorPopouts,
        nextCsvSessions,
        nextCsvTemplates,
        nextRecordings,
        nextRecoveryReports,
        nextInjectHistory,
        nextSupervisor,
        nextPermissionExpiry
      ] = await Promise.all([
        window.devhub.r8.integrations.healthCheck(),
        window.devhub.r8.ipc.listChannels(),
        window.devhub.r8.zod.listSchemas(),
        window.devhub.r8.status.aggregate(),
        window.devhub.r8.watchdog.status(),
        window.devhub.r8.ocr.recognize({ imagePath: 'disabled-contract.png' }),
        window.devhub.r8.skill.cloudSyncDisabled(),
        window.devhub.r8.task.stats(),
        window.devhub.r8.cli.getProgress({ limit: 1 }),
        window.devhub.r8.monitor.snapshot(),
        window.devhub.r8.monitor.listPopouts(),
        window.devhub.r8.csv.listSessions(),
        window.devhub.r8.csv.listTemplates(),
        window.devhub.r8.recording.list(),
        window.devhub.r8.recovery.report(),
        window.devhub.r8.inject.history(),
        window.devhub.r8.watchdog.supervisorStatus(),
        window.devhub.r8.permission.expiryStream()
      ])
      setHealth(nextHealth)
      setChannels(nextChannels)
      setSchemas(nextSchemas.schemas)
      setStatus(nextStatus)
      setWatchdog(nextWatchdog)
      setQueueStats(nextQueue)
      setCliLatest(nextCli.latest)
      setMonitorSnapshot(nextMonitorSnapshot)
      setMonitorPrefsDraft({ alwaysOnTop: nextMonitorSnapshot.windowState.alwaysOnTop, opacity: nextMonitorSnapshot.windowState.opacity })
      setMonitorPopouts(nextMonitorPopouts)
      setCsvSessions(nextCsvSessions)
      setCsvTemplates(nextCsvTemplates)
      setRecordings(nextRecordings)
      setRecoveryReports(nextRecoveryReports)
      setInjectHistory(nextInjectHistory)
      setSupervisor(isR8SupervisorStatus(nextSupervisor) ? nextSupervisor : null)
      setPermissionExpiry(nextPermissionExpiry)
      setOcrCode(nextOcr.code)
      setCloudCode(nextCloud.code)
      if (firstListeningPort) {
        setPortTier(await window.devhub.r8.portSecurity.classify(firstListeningPort.port, firstListeningPort.localAddress))
      } else {
        setPortTier(null)
      }
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [firstListeningPort])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return window.devhub.r8.watchdog.onSupervisorEventStream((payload) => {
      const latestEvent = payload.events[payload.events.length - 1]
      if (latestEvent && isR8SupervisorStatus(latestEvent.status)) {
        setSupervisor(latestEvent.status)
      }
    })
  }, [])

  useEffect(() => {
    void refreshBackups().catch(reason => {
      const message = reason instanceof Error ? reason.message : String(reason)
      setBackupError(message)
      setError(message)
    })
  }, [refreshBackups])

  useEffect(() => {
    let disposed = false
    const refreshPermissionExpiry = () => {
      void window.devhub.r8.permission.expiryStream()
        .then(payload => {
          if (!disposed) setPermissionExpiry(payload)
        })
        .catch(reason => {
          if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
        })
    }
    refreshPermissionExpiry()
    const timer = window.setInterval(refreshPermissionExpiry, 1000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    return window.devhub.r8.cli.onDetectionEvent?.(state => {
      setToolDetectionState(state)
      setToolDetect(state.results)
    })
  }, [])

  useEffect(() => {
    return window.devhub.r8.monitor.onSnapshotStream(snapshot => {
      setMonitorSnapshot(snapshot)
      setMonitorPrefsDraft({ alwaysOnTop: snapshot.windowState.alwaysOnTop, opacity: snapshot.windowState.opacity })
    })
  }, [])

  useEffect(() => {
    return window.devhub.r8.monitor.onPopoutSnapshotStream(card => {
      setMonitorSnapshot(current => {
        if (!current) return current
        return {
          ...current,
          cards: current.cards.map(item => item.tool === card.tool ? card : item),
          collectedAt: Date.now()
        }
      })
      void window.devhub.r8.monitor.listPopouts()
        .then(setMonitorPopouts)
        .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
    })
  }, [])

  const focusMonitorInstance = useCallback((tool: MonitorTool, instanceId: string) => {
    void window.devhub.r8.monitor.focusInstance(tool, instanceId)
  }, [])

  const updateMonitorPrefs = useCallback((patch: Partial<Pick<MonitorWindowState, 'alwaysOnTop' | 'opacity'>>) => {
    setMonitorPrefsDraft(current => ({ ...current, ...patch }))
    void window.devhub.r8.monitor.setWindowPrefs({ ...patch, confirmedBy: 'r8-ops-panel' })
      .then(result => {
        setMonitorPrefsDraft({ alwaysOnTop: result.windowState.alwaysOnTop, opacity: result.windowState.opacity })
        setMonitorSnapshot(current => current ? { ...current, windowState: result.windowState } : current)
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [])

  const openMonitorPopout = useCallback((tool: MonitorTool, layout: MonitorPopoutLayout = 'compact') => {
    void window.devhub.r8.monitor.openPopout(tool, layout)
      .then(() => window.devhub.r8.monitor.listPopouts())
      .then(setMonitorPopouts)
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [])

  const returnMonitorPopout = useCallback((tool: MonitorTool) => {
    const popout = monitorPopouts.find(item => item.tool === tool)
    if (!popout) return
    void window.devhub.r8.monitor.returnPopoutToMain(popout.windowId)
      .then(() => window.devhub.r8.monitor.listPopouts())
      .then(setMonitorPopouts)
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [monitorPopouts])

  const setMonitorPopoutLayout = useCallback((tool: MonitorTool, layout: MonitorPopoutLayout) => {
    const popout = monitorPopouts.find(item => item.tool === tool)
    if (!popout) return
    void window.devhub.r8.monitor.setPopoutLayout(popout.windowId, layout)
      .then(() => window.devhub.r8.monitor.listPopouts())
      .then(setMonitorPopouts)
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [monitorPopouts])

  const exportDiagnosticPackFromPanel = useCallback(async () => {
    setDiagnosticBusy(true)
    setDiagnosticError(null)
    try {
      const preview = await window.devhub.r8.diagnostic.preview(R8_DIAGNOSTIC_PANEL_REQUEST)
      setDiagnosticPreview(preview)
      const manifest = await window.devhub.r8.diagnostic.export(R8_DIAGNOSTIC_PANEL_REQUEST)
      setDiagnosticManifest(manifest)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setDiagnosticError(message)
      setError(message)
    } finally {
      setDiagnosticBusy(false)
    }
  }, [])

  const toggleBackupCategory = useCallback((category: BackupCategory) => {
    setSelectedBackupCategories(current => {
      if (current.includes(category)) return current.filter(item => item !== category)
      return [...current, category]
    })
    setRestoreConfirmed(false)
  }, [])

  const createSelectedBackupFromPanel = useCallback(async () => {
    setBackupBusy(true)
    setBackupError(null)
    try {
      const created = await window.devhub.r8.backup.create({
        categories: selectedBackupCategories,
        confirmedBy: BACKUP_CONFIRMATION_ACTOR
      })
      if (isBackupBundle(created)) {
        setBackupCreated(created)
        setSelectedBackupKey(created.backupId ?? created.bundleId)
      }
      await refreshBackups()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setBackupError(message)
      setError(message)
    } finally {
      setBackupBusy(false)
    }
  }, [refreshBackups, selectedBackupCategories])

  const restoreSelectedBackupFromPanel = useCallback(async () => {
    if (!selectedBackup || selectedBackupCategories.length === 0 || !restoreConfirmed) return
    setBackupBusy(true)
    setBackupError(null)
    try {
      const restoreIdentity = selectedBackup.backupId ? { backupId: selectedBackup.backupId } : { bundleId: selectedBackup.bundleId }
      const result = await window.devhub.r8.backup.restore({
        ...restoreIdentity,
        categoriesToRestore: selectedBackupCategories,
        conflictPolicy: restoreConflictPolicy,
        preRestoreSnapshot: restorePreSnapshot,
        confirmedBy: BACKUP_CONFIRMATION_ACTOR
      }) as RestoreResult
      setRestoreResult(result)
      setRestoreConfirmed(false)
      await refreshBackups()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setBackupError(message)
      setError(message)
    } finally {
      setBackupBusy(false)
    }
  }, [refreshBackups, restoreConfirmed, restoreConflictPolicy, restorePreSnapshot, selectedBackup, selectedBackupCategories])

  const exportTaskResultsFromPanel = useCallback(async () => {
    setTaskExportBusy(true)
    setTaskExportError(null)
    try {
      const result = await window.devhub.r8.task.exportResults({
        format: 'both',
        confirmedBy: 'r8-ops-task-export'
      })
      setTaskExport(result)
      await refresh()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setTaskExportError(message)
      setError(message)
    } finally {
      setTaskExportBusy(false)
    }
  }, [refresh])

  const perSenderChannels = channels.filter(channel => channel.perSenderBucket)
  const highFreqChannels = channels.filter(channel => channel.rateClass === 'high_freq_scan')
  const latestDirtyRecoveryReport = recoveryReports.find(report => report.findings.length > 0) ?? null
  const diagnosticPreviewRedactions = diagnosticPreview
    ? Object.values(diagnosticPreview.redactionCounts).reduce((total, count) => total + count, 0)
    : null
  const diagnosticScreenshotsIncluded = diagnosticManifest?.sectionsIncluded.includes('screenshots') ?? false

  return (
    <div className="h-full overflow-y-auto bg-surface-950 p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-gold font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>R8 OPERATIONS</h3>
          <p className="text-sm text-text-muted">R8.B / R8.C 真实契约、Zod、IPC、诊断和禁用接口总览</p>
        </div>
        <button type="button" onClick={() => { void refresh() }} className="btn-secondary flex items-center gap-2">
          <RefreshIcon size={14} />
          刷新
        </button>
      </div>

      {error && <div className="mb-4 border border-warning/50 bg-warning/10 p-3 text-sm text-warning radius-sm">{error}</div>}
      <RecoveryDialog report={latestDirtyRecoveryReport} onChanged={refresh} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-3">
          <DenseCard title="CSV Launch">
            <CsvLaunchWizard />
          </DenseCard>
        </div>

        <DenseCard title="R8 健康">
          <div className="space-y-2">
            <Fact label="Feature Flags" value={health?.featureFlags ?? 'N/A'} />
            <Fact label="IPC Channels" value={health?.ipcChannels ?? 'N/A'} />
            <Fact label="Zod Schemas" value={health?.schemas ?? 'N/A'} />
            <Fact label="Popouts" value={health?.popouts ?? 'N/A'} />
          </div>
        </DenseCard>

        <DenseCard title="IPC 限流与确认">
          <div className="space-y-2">
            <Fact label="Registered" value={channels.length} />
            <Fact label="High Freq" value={highFreqChannels.length} />
            <Fact label="Per Sender" value={perSenderChannels.length} />
            <Fact label="Rate Classes" value={new Set(channels.map(channel => channel.rateClass)).size} />
          </div>
        </DenseCard>

        <DenseCard title="禁用接口">
          <div className="space-y-2">
            <DeferredFact
              label="OCR"
              value={ocrCode ?? 'E_OCR_DISABLED'}
              tooltip="OCR is not supported in R8. Recognition calls return E_OCR_DISABLED and do not load OCR engines."
            />
            <DeferredFact
              label="Skill Cloud Sync"
              value={cloudCode ?? 'E_FEATURE_DEFERRED'}
              tooltip="Skill cloud sync is deferred to R9. R8 returns E_FEATURE_DEFERRED and performs no network sync."
            />
            <Fact label="Watchdog" value={watchdog?.state ?? 'N/A'} />
            <Fact label="Heartbeat" value={watchdog ? `${watchdog.heartbeatTimeoutMs}ms` : 'N/A'} />
          </div>
        </DenseCard>

        <DenseCard title="R8.C 队列">
          <div className="space-y-2" data-testid="task-result-export-panel">
            <Fact label="Total" value={queueStats?.total ?? 'N/A'} />
            <Fact label="Queued" value={queueStats?.queued ?? 'N/A'} />
            <Fact label="Running" value={queueStats?.running ?? 'N/A'} />
            <Fact label="Failed" value={queueStats?.failed ?? 'N/A'} />
            <button
              type="button"
              className="btn-secondary mt-2 w-full"
              data-testid="task-result-export-button"
              disabled={taskExportBusy}
              onClick={() => { void exportTaskResultsFromPanel() }}
            >
              {taskExportBusy ? 'Exporting task results' : 'Export task results CSV/JSON'}
            </button>
            <Fact label="Last Export Tasks" value={<span data-testid="task-result-export-count">{taskExport?.taskCount ?? 'N/A'}</span>} />
            <div className="break-all font-mono text-[11px] text-text-muted" data-testid="task-result-export-path">
              {taskExport?.artifactDir ?? ''}
            </div>
            <div className="flex flex-wrap gap-1" data-testid="task-result-export-files">
              {(taskExport?.files ?? []).map(file => (
                <span key={file.path} className="status-badge">{file.format}:{file.bytes}</span>
              ))}
            </div>
            {taskExportError && <div className="border border-warning/50 bg-warning/10 p-2 text-xs text-warning radius-sm">{taskExportError}</div>}
          </div>
        </DenseCard>

        <DenseCard title="Permission TTL">
          <div className="space-y-2">
            <Fact label="Active Grants" value={permissionExpiry?.grants.length ?? 'N/A'} />
            <Fact label="Stream At" value={permissionExpiry ? new Date(permissionExpiry.emittedAt).toLocaleTimeString() : 'N/A'} />
            <div className="space-y-1 pt-1" data-testid="permission-countdown-list">
              {(permissionExpiry?.grants ?? []).length > 0 ? (
                permissionExpiry?.grants.map(grant => (
                  <div key={grant.grantId} className="flex items-center justify-between gap-3 border border-surface-800 bg-surface-950 px-2 py-1 radius-sm">
                    <span className="truncate text-xs text-text-secondary">{grant.op}</span>
                    <CountdownBadge grant={grant} />
                  </div>
                ))
              ) : (
                <div className="text-xs text-text-muted">No active TTL grants</div>
              )}
            </div>
          </div>
        </DenseCard>

        <DenseCard title="Diagnostic Pack">
          <div className="space-y-2" data-testid="diagnostic-pack-panel">
            <Fact label="Status" value={<span data-testid="diagnostic-pack-export-status">{diagnosticBusy ? 'exporting' : diagnosticManifest ? 'exported' : 'idle'}</span>} />
            <Fact label="Preview Sections" value={diagnosticPreview?.sections.length ?? 'N/A'} />
            <Fact label="Preview Bytes" value={diagnosticPreview?.totalEstimatedSize ?? 'N/A'} />
            <Fact label="Preview Redactions" value={<span data-testid="diagnostic-pack-preview-redactions">{diagnosticPreviewRedactions ?? 'N/A'}</span>} />
            <Fact label="Export Sections" value={<span data-testid="diagnostic-pack-section-count">{diagnosticManifest?.sectionsIncluded.length ?? 'N/A'}</span>} />
            <Fact label="Screenshots" value={<span data-testid="diagnostic-pack-screenshots">{diagnosticScreenshotsIncluded ? 'included' : 'excluded'}</span>} />
            <Fact label="No Telemetry" value={diagnosticManifest ? String(diagnosticManifest.noTelemetry) : 'N/A'} />
            <div className="break-all font-mono text-[11px] text-text-muted" data-testid="diagnostic-pack-artifact-path">
              {diagnosticManifest?.artifactPath ?? ''}
            </div>
            {diagnosticError && <div className="border border-warning/50 bg-warning/10 p-2 text-xs text-warning radius-sm">{diagnosticError}</div>}
          </div>
        </DenseCard>

        <DenseCard title="Backup RestoreWizard">
          <div className="space-y-3" data-testid="backup-restore-wizard">
            <div className="grid gap-2 sm:grid-cols-2">
              {BACKUP_CATEGORY_OPTIONS.map(option => (
                <label key={option.value} className="flex gap-2 border border-surface-800 bg-surface-950 p-2 text-xs radius-sm">
                  <input
                    type="checkbox"
                    checked={selectedBackupCategories.includes(option.value)}
                    data-testid={`backup-category-${option.value}`}
                    onChange={() => toggleBackupCategory(option.value)}
                  />
                  <span>
                    <span className="block font-semibold text-text-primary">{option.label}</span>
                    <span className="block text-text-muted">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="block text-xs text-text-muted">
              Backup artifact
              <select
                className="mt-1 w-full border border-surface-700 bg-surface-950 px-2 py-1 text-text-primary radius-sm"
                value={selectedBackup?.backupId ?? selectedBackup?.bundleId ?? ''}
                data-testid="backup-restore-select"
                onChange={event => {
                  setSelectedBackupKey(event.target.value)
                  setRestoreConfirmed(false)
                }}
              >
                {backupBundles.length === 0 ? (
                  <option value="">No classified backup yet</option>
                ) : backupBundles.map(bundle => (
                  <option key={bundle.bundleId} value={bundle.backupId ?? bundle.bundleId}>
                    {new Date(bundle.createdAt).toLocaleString()} / {(bundle.categories ?? []).map(category => category.category).join(', ') || bundle.scope.join(', ')}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-text-muted">
                Conflict policy
                <select
                  className="mt-1 w-full border border-surface-700 bg-surface-950 px-2 py-1 text-text-primary radius-sm"
                  value={restoreConflictPolicy}
                  data-testid="backup-conflict-policy"
                  onChange={event => {
                    setRestoreConflictPolicy(event.target.value as 'overwrite' | 'merge' | 'skip')
                    setRestoreConfirmed(false)
                  }}
                >
                  <option value="overwrite">Overwrite selected categories</option>
                  <option value="merge">Merge selected categories</option>
                  <option value="skip">Skip existing records</option>
                </select>
              </label>
              <label className="flex items-center gap-2 border border-surface-800 bg-surface-950 p-2 text-xs text-text-muted radius-sm">
                <input
                  type="checkbox"
                  checked={restorePreSnapshot}
                  data-testid="backup-pre-restore-snapshot"
                  onChange={event => {
                    setRestorePreSnapshot(event.target.checked)
                    setRestoreConfirmed(false)
                  }}
                />
                Create pre-restore snapshot
              </label>
            </div>
            <label className="flex items-start gap-2 border border-warning/40 bg-warning/10 p-2 text-xs text-warning radius-sm">
              <input
                type="checkbox"
                checked={restoreConfirmed}
                data-testid="backup-restore-confirm"
                onChange={event => setRestoreConfirmed(event.target.checked)}
              />
              <span>I understand restore overwrites or merges the selected local categories.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                data-testid="backup-create-selected-button"
                disabled={backupBusy || selectedBackupCategories.length === 0}
                onClick={() => { void createSelectedBackupFromPanel() }}
              >
                {backupBusy ? 'Running backup operation' : 'Create selected backup'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                data-testid="backup-restore-button"
                disabled={backupBusy || !selectedBackup || selectedBackupCategories.length === 0 || !restoreConfirmed}
                onClick={() => { void restoreSelectedBackupFromPanel() }}
              >
                Restore selected categories
              </button>
            </div>
            <div className="space-y-1 text-xs text-text-muted">
              <Fact label="Available Backups" value={<span data-testid="backup-count">{backupBundles.length}</span>} />
              <Fact label="Last Created" value={backupCreated ? new Date(backupCreated.createdAt).toLocaleString() : 'N/A'} />
              <Fact label="Last Restore" value={<span data-testid="backup-restore-status">{restoreResult ? `${restoreResult.restored.filter(item => item.success).length}/${restoreResult.restored.length}` : 'N/A'}</span>} />
              <Fact label="Pre Snapshot" value={<span data-testid="backup-pre-snapshot-id">{restoreResult?.preRestoreSnapshotId ?? 'N/A'}</span>} />
            </div>
            {backupError && <div className="border border-warning/50 bg-warning/10 p-2 text-xs text-warning radius-sm">{backupError}</div>}
          </div>
        </DenseCard>

        <DenseCard title="操作闭环状态">
          <div className="space-y-2">
            <Fact label="CSV Sessions" value={csvSessions.length} />
            <Fact label="CSV Templates" value={csvTemplates.length} />
            <Fact label="Recordings" value={recordings.length} />
            <Fact label="Recovery Reports" value={recoveryReports.length} />
            <Fact label="Inject History" value={injectHistory.length} />
            <Fact label="Supervisor" value={supervisor?.status ?? 'N/A'} />
          </div>
        </DenseCard>

        <DenseCard title="CLI 进度">
          <div className="space-y-2">
            <Fact label="Tool" value={cliLatest?.tool ?? 'N/A'} />
            <Fact label="Phase" value={cliLatest?.phase ?? 'N/A'} />
            <Fact label="Progress" value={cliLatest?.progress === null || cliLatest?.progress === undefined ? 'N/A' : `${Math.round(cliLatest.progress * 100)}%`} />
            <Fact label="Confidence" value={cliLatest ? `${Math.round(cliLatest.confidence * 100)}%` : 'N/A'} />
          </div>
        </DenseCard>

        <DenseCard title="状态栏聚合">
          <div className="grid grid-cols-2 gap-2">
            {(status?.tiles ?? []).slice(0, 12).map(tile => (
              <div key={tile.id} className="border border-surface-700 bg-surface-950 px-3 py-2 radius-sm">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">{tile.label}</div>
                <div className="font-mono text-sm text-text-primary">{String(tile.value)}</div>
              </div>
            ))}
          </div>
        </DenseCard>

        <DenseCard title="端口安全分级">
          {portTier ? (
            <div className="space-y-2">
              <Fact label="Target" value={`${portTier.ip}:${portTier.port}`} />
              <Fact label="Tier" value={portTier.tier} />
              <Fact label="Score" value={portTier.score} />
              <div className="flex flex-wrap gap-1 pt-2">
                {portTier.reasons.map(reason => <span key={reason} className="status-badge">{reason}</span>)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-muted">等待真实端口扫描数据</div>
          )}
        </DenseCard>

        <DenseCard title="Schema Registry">
          <div className="max-h-48 overflow-y-auto space-y-1">
            {schemas.map(schema => (
          <div key={schema.schemaName} className="flex items-center gap-2 text-xs text-text-secondary">
            <GearIcon size={12} className="text-accent" />
            <span>{schema.schemaName}</span>
            <span className="font-mono text-[10px] text-text-muted">{schema.version}</span>
          </div>
            ))}
          </div>
        </DenseCard>
      </div>


      <div className="mt-4">
        <DenseCard title="AI 监控窗口">
          <MonitorWindowCards
            snapshot={monitorSnapshot}
            prefsDraft={monitorPrefsDraft}
            targetTool={monitorPopoutTarget}
            targetPopoutLayout={targetMonitorPopout?.miniLayout ?? 'compact'}
            poppedOutTools={poppedOutTools}
            onFocusInstance={focusMonitorInstance}
            onOpenPopout={openMonitorPopout}
            onReturnPopout={returnMonitorPopout}
            onSetPopoutLayout={setMonitorPopoutLayout}
            onPrefsChange={updateMonitorPrefs}
          />
        </DenseCard>
      </div>

      <div className="mt-4">
        <DenseCard title="任务回放">
          <RecordingReplayPanel />
        </DenseCard>
      </div>

      <div className="mt-4">
        <DenseCard title="DAG 编辑器">
          <DagEditorPanel />
        </DenseCard>
      </div>

      <div className="mt-4">
        <DenseCard title="SKILL 编辑器">
          <SkillEditorPanel />
        </DenseCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DenseCard title="关键动作">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary flex items-center gap-2" data-testid="diagnostic-pack-export-button" disabled={diagnosticBusy} onClick={() => { void exportDiagnosticPackFromPanel() }}>
              <AlertIcon size={14} />
              {diagnosticBusy ? 'Exporting diagnostic pack' : 'Export diagnostic pack'}
            </button>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { void createSelectedBackupFromPanel() }}>
              <NetworkIcon size={14} />
              创建选中备份
            </button>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { void window.devhub.r8.command.invoke('monitor.ai-task') }}>
              <TerminalIcon size={14} />
              打开 AI 任务
            </button>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { void window.devhub.r8.cli.detectAll({ force: true }).then(state => { setToolDetectionState(state); setToolDetect(state.results) }) }}>
              <TerminalIcon size={14} />
              检测 CLI
            </button>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { void window.devhub.r8.inject.dryRun({ targetAlias: 'r8-ops-panel', text: 'R8 dry run', dryRun: true }).then(setInjectDryRun) }}>
              <GearIcon size={14} />
              注入 Dry Run
            </button>
            <button type="button" className="btn-secondary flex items-center gap-2" data-testid="open-inject-whitelist-drawer" onClick={() => { void openDrawerContent('right', BUILTIN_DRAWER_CONTENTS.RIGHT_INJECT_WHITELIST) }}>
              <TerminalIcon size={14} />
              管理注入白名单
            </button>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { void window.devhub.r8.recovery.scan().then(() => refresh()) }}>
              <RefreshIcon size={14} />
              扫描恢复报告
            </button>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { void window.devhub.r8.recording.start({ label: 'R8 Ops Panel', source: 'system', confirmedBy: 'r8-ops-panel' }).then(() => refresh()) }}>
              <TerminalIcon size={14} />
              开始录制
            </button>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { void window.devhub.r8.skill.reload().then(() => refresh()) }}>
              <GearIcon size={14} />
              重载技能库
            </button>
          </div>
        </DenseCard>

        <DenseCard title="CLI / 注入结果">
          <div className="space-y-2 text-xs">
            <Fact label="Detected" value={toolDetect.length} />
            <Fact label="Found" value={toolDetect.filter(tool => tool.found).length} />
            <Fact label="Scan" value={toolDetectionState ? `${toolDetectionState.scanDurationMs}ms` : 'N/A'} />
            <Fact label="Dry Run" value={injectDryRun ? `${injectDryRun.characters} chars` : 'N/A'} />
            <div className="max-h-24 overflow-y-auto space-y-1">
              {toolDetect.map(tool => (
                <div key={tool.tool} className="grid grid-cols-[auto_1fr] gap-2 border border-surface-800 bg-surface-950 px-2 py-1 radius-sm">
                  <span className={tool.found ? 'text-success' : 'text-text-muted'}>{tool.tool}</span>
                  <span className="truncate text-text-muted">{tool.version ?? tool.error ?? 'not detected'}</span>
                </div>
              ))}
            </div>
          </div>
        </DenseCard>

        <DenseCard title="代表性 IPC">
          <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
            {channels.slice(0, 24).map(channel => (
              <div key={channel.channel} className="grid grid-cols-[1fr_auto_auto] gap-2 border border-surface-800 bg-surface-950 px-2 py-1 radius-sm">
                <span className="truncate text-text-primary">{channel.channel}</span>
                <span className="text-text-muted">{channel.rateClass}</span>
                <span className={channel.perSenderBucket ? 'text-warning' : 'text-text-muted'}>{channel.perSenderBucket ? 'sender' : `burst ${channel.burstAllowance}`}</span>
              </div>
            ))}
          </div>
        </DenseCard>
      </div>
    </div>
  )
}
