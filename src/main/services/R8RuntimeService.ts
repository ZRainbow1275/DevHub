import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync, readFileSync, writeFileSync, type Dirent } from 'node:fs'
import { freemem, hostname, tmpdir, totalmem, userInfo } from 'node:os'
import { createServer, type Server, type Socket } from 'node:net'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { deflateRawSync } from 'node:zlib'
import { app, BrowserWindow, clipboard, screen, session, shell, type BrowserWindowConstructorOptions, type ProcessMetric, type Session, type WebContents } from 'electron'
import Store from 'electron-store'
import matter from 'gray-matter'
import { load as loadYaml } from 'js-yaml'
import type { FSWatcher } from 'chokidar'
import cron, { type ScheduledTask } from 'node-cron'
import { coerce as coerceSemver } from 'semver'
import which from 'which'
import { fromZodError, fromZodIssue } from 'zod-validation-error'
import { CSV_COLUMN_INFO, CSV_COLUMN_NAMES, csvTaskRow18Schema, validateCsvHeader, type CsvTaskRow18 } from '@shared/schemas/csv-task-row'
import {
  R8_IPC_CHANNELS,
  assertR8IpcRegistry,
  attachedTopologyFavoriteChangeRequestSchema,
  attachedTopologyFavoriteChangeResultSchema,
  attachedTopologyRequestSchema,
  attachedTopologyResultSchema,
  backupCreateRequestSchema,
  backupDeleteRequestSchema,
  backupExportClassifiedRequestSchema,
  backupManifestSchema,
  backupScheduleResultSchema,
  backupScheduleSchema,
  backupBundleSchema,
  BUILTIN_NODE_TEMPLATES,
  blocklistEntrySchema,
  cloudSyncRemoteListResponseSchema,
  cloudSyncRequestSchema,
  cloudSyncResultSchema,
  cloudSyncStatusSchema,
  browserPopoutSchema,
  claudeCostSummarySchema,
  claudeStreamJsonRestartCommandSchema,
  claudeStreamJsonRestartConfirmRequestSchema,
  claudeStreamJsonRestartRecordSchema,
  claudeStreamJsonRestartRequestSchema,
  claudeStreamEventSchema,
  cliOutputEventSchema,
  commandHistoryEntrySchema,
  commandPaletteEntrySchema,
  commandParsedUriSchema,
  commandRegisterOsProtocolRequestSchema,
  commandRegisterOsProtocolResultSchema,
  commandResolvedUriSchema,
  commandResolveUriRequestSchema,
  customCommandListResponseSchema,
  customCommandSaveResultSchema,
  customCommandSchema,
  csvDeleteTemplateRequestSchema,
  csvDeleteTemplateResultSchema,
  csvExternalChangeEventSchema,
  csvDriverStateSchema,
  csvLaunchOptionsSchema,
  csvLaunchSessionSchema,
  csvLockRequestSchema,
  csvLockResultSchema,
  csvLockStatusRequestSchema,
  csvSaveResultSchema,
  csvReloadSummarySchema,
  csvRowStreamPayloadSchema,
  csvSessionEventSchema,
  csvSchemaInfoSchema,
  csvSaveTemplateRequestSchema,
  dagAuditEntrySchema,
  csvTaskRowSchema,
  csvTemplateListRequestSchema,
  dagBuildRequestSchema,
  dagExportRequestSchema,
  dagExportResultSchema,
  dagGraphSchema,
  dagLayerRequestSchema,
  dagReadyRequestSchema,
  dagSnapshotSchema,
  dashboardDeletePresetRequestSchema,
  dashboardGetLayoutRequestSchema,
  dashboardGridItemSchema,
  dashboardLayoutResponseSchema,
  dashboardLayoutSchema,
  dashboardListPresetsResponseSchema,
  dashboardMorphWidgetToDrawerRequestSchema,
  dashboardMorphWidgetToDrawerResultSchema,
  dashboardResetRequestSchema,
  dashboardSaveLayoutResultSchema,
  diagnosticListPacksResponseSchema,
  dataOwnershipExportAllRequestSchema,
  dataOwnershipListEntriesRequestSchema,
  dataOwnershipListEntriesResponseSchema,
  dataOwnershipListPathsResponseSchema,
  dataOwnershipPathSummarySchema,
  diagnosticPackManifestSchema,
  diagnosticPackOptionsSchema,
  diagnosticPreviewSchema,
  diagnosticRedactionRulesResponseSchema,
  diagnosticScreenshotRequestSchema,
  diagnosticScreenshotResultSchema,
  diagnosticExportRequestSchema,
  nodeTemplateSchema,
  drawerLayoutRecordSchema,
  drawerLoadLayoutRequestSchema,
  drawerMorphFromPopoutRequestSchema,
  drawerMorphFromPopoutResultSchema,
  drawerMorphToPopoutRequestSchema,
  drawerMorphToPopoutResultSchema,
  drawerSaveLayoutRequestSchema,
  drawerSlotSchema,
  drawerStateSchema,
  flowExportRequestSchema,
  flowEventStreamPayloadSchema,
  flowEventStreamRequestSchema,
  flowEventStreamResponseSchema,
  flowEventStreamUnsubscribeRequestSchema,
  flowRequestSchema,
  fusedSignalSchema,
  graphExportRequestSchema,
  graphSaveSnapshotRequestSchema,
  injectActionSchema,
  monitorPopoutLayoutSchema,
  monitorPopoutSchema,
  monitorSnapshotSchema,
  monitorToolSchema,
  monitorWindowStateSchema,
  injectResultSchema,
  ocrCapabilitiesSchema,
  ocrDisabledResponseSchema,
  ocrRecognizeRequestSchema,
  ocrSupportedLanguagesResponseSchema,
  parseSessionSchema,
  parserStrategySchema,
  permissionCheckRequestSchema,
  permissionCheckResultSchema,
  permissionConfigurePolicyResponseSchema,
  permissionExpiryStreamPayloadSchema,
  progressDataPointSchema,
  permissionGrantSchema,
  permissionListActiveResponseSchema,
  permissionPolicySchema,
  permissionRequestSchema,
  permissionRevokeAllRequestSchema,
  permissionRevokeRequestSchema,
  permissionRevokeResponseSchema,
  permissionTtlGrantSchema,
  popoutBridgeMessageSchema,
  popoutScreenEventSchema,
  popoutThemeSyncPayloadSchema,
  portPopoutBatchRequestSchema,
  portPopoutBatchResponseSchema,
  portPopoutCloseRequestSchema,
  portPopoutCloseResponseSchema,
  portPopoutDemoteRequestSchema,
  portPopoutDemoteResponseSchema,
  portPopoutListResponseSchema,
  portPopoutOpenRequestSchema,
  portPopoutOpenResponseSchema,
  portPopoutPinRequestSchema,
  portPopoutPinResponseSchema,
  portPopoutPositionGetRequestSchema,
  portPopoutPositionGetResponseSchema,
  portPopoutPositionSaveRequestSchema,
  portPopoutPositionSaveResponseSchema,
  portPopoutRuntimeRecordSchema,
  portPopoutSyncRequestSchema,
  portPopoutSyncResponseSchema,
  processTreeChildrenRequestSchema,
  processTreeNodeSchema,
  processTreeRequestSchema,
  processTreemapDataRequestSchema,
  processViewModeSetRequestSchema,
  processViewModeSetResultSchema,
  popoutCreateRequestSchema,
  panelPopoutSurfaceSchema,
  r8ContractOnlyResponseSchema,
  r8NotificationSchema,
  recordingExportAsciinemaRequestSchema,
  recordingExportZipRequestSchema,
  recordingDeleteRequestSchema,
  recordingGetEventsRequestSchema,
  recordingGetFsSnapshotAtRequestSchema,
  recordingGetCastRequestSchema,
  recordingGetEventsWindowRequestSchema,
  recordingGetManifestRequestSchema,
  recordingGetReplayStateRequestSchema,
  recordingGetScreenshotRequestSchema,
  recordingListAnchorsRequestSchema,
  recordingListRequestSchema,
  recordingSessionSchema,
  recordingStartRequestSchema,
  toolMonitorCardSchema,
  recoveryCheckDirtyRequestSchema,
  recoveryCheckDirtyResponseSchema,
  recoveryCreateCheckpointRequestSchema,
  recoveryDismissRequestSchema,
  recoveryDismissResponseSchema,
  recoveryListSnapshotsResponseSchema,
  recoveryReportSchema,
  recoveryRestoreStateRequestSchema,
  recoverySnapshotSchema,
  restorePlanSchema,
  restoreResultSchema,
  replayStateSchema,
  publicBannerStateSchema,
  securityTierSchema,
  skillFrontmatterSchema,
  skillLoadErrorSchema,
  skillListStreamPayloadSchema,
  skillSchema,
  skillTemplateSchema,
  skillValidationResultSchema,
  STATUSBAR_LIMITS,
  customSvgListResponseSchema,
  customSvgRemoveRequestSchema,
  customSvgUploadRequestSchema,
  statusAggregateSchema,
  statusbarConfigSchema,
  statusbarResetRequestSchema,
  taskResultExportPayloadSchema,
  taskResultExportRequestSchema,
  taskResultExportResultSchema,
  taskStateStreamPayloadSchema,
  taskQueueEngineSchema,
  taskQueueStorageStatusSchema,
  themeDecorationConfigSchema,
  themeDecorationListResponseSchema,
  themeSoundConfigGetRequestSchema,
  themeSoundConfigResponseSchema,
  themeSoundConfigSchema,
  taskRunSchema,
  toolDetectResultSchema,
  toolDetectionStateSchema,
  watchdogEventSchema,
  watchdogEventStreamPayloadSchema,
  watchdogStatusSchema,
  zodListSchemasResponseSchema,
  zodMigrationStatusResponseSchema,
  zodValidatePayloadRequestSchema,
  zodValidatePayloadResponseSchema,
  type CsvSaveResult,
  type DagSnapshot,
  type R8ContractOnlyResponse,
  type R8IpcChannelDefinition,
  type Skill,
  type SkillLoadError,
  type SkillListStreamPayload,
  type SkillTemplate,
  type NodeTemplate,
  type SkillValidationResult,
  type MonitorPopout,
  type MonitorPopoutLayout,
  type MonitorSnapshot,
  type MonitorTool,
  type MonitorWindowState,
  type ParserStrategy,
  type ProgressDataPoint,
  type R8RuntimeSchemaName,
  type GraphExportResult,
  type GraphSavedSnapshot,
  type GraphSnapshot,
  type AttachedTopologyFavoriteChangeResult,
  type AttachedTopologyResult,
  type BackupCategory,
  type BackupManifest,
  type BackupSchedule,
  type BlocklistEntry,
  type CloudSyncResult,
  type CloudSyncStatus,
  type CommandPaletteEntry,
  type ClaudeCostSummary,
  type ClaudeStreamJsonRestartCommand,
  type ClaudeStreamJsonRestartRecord,
  type CommandHistoryEntry,
  type DiagnosticPackManifest,
  type DiagnosticPackOptions,
  type DiagnosticRedactionRule,
  type DiagnosticSection,
  type DataOwnershipExportAllRequest,
  type DataOwnershipListEntriesResponse,
  type DataOwnershipListPathsResponse,
  type DataOwnershipPathSummary,
  type FlowExportResult,
  type FlowEventStreamPayload,
  type FlowRequest,
  type FlowSnapshot,
  type FlowStats,
  type OcrCapabilities,
  type OcrDisabledResponse,
  type PermissionCheckResult,
  type PermissionExpiryStreamPayload,
  type PermissionPolicy,
  type PermissionTtlGrant,
  type SensitivePermissionOperation,
  type RecordingEvent,
  type RecordingManifest,
  type RecordingStartRequest,
  type RecordingStreamKind,
  type RecoveryCheckDirtyResponse,
  type RecoveryDismissResponse,
  type RestoreResult,
  type ToolMonitorCard,
  type ToolDetectionState,
  type WatchdogEvent,
  type WatchdogEventStreamPayload,
  type ZodListSchemasResponse,
  type ZodMigrationStatusResponse,
  type StatusTile,
  type StatusbarConfig,
  type StatusbarResetRequest,
  type CustomSvgListResponse,
  type CustomSvgRemoveRequest,
  type CustomSvgRemoveResponse,
  type CustomSvgUploadRequest,
  type CustomSvgUploadResponse,
  type ThemeDecorationConfig,
  type ThemeDecorationListResponse,
  type ThemeSoundConfig,
  type ThemeSoundConfigGetRequest,
  type ThemeSoundConfigResponse,
  type CsvExternalChangeEvent,
  type CsvReloadSummary,
  type CsvRowStreamPayload,
  type DagAuditEntry,
  type TaskResultExportResult,
  type ZodValidatePayloadResponse
} from '@shared/schemas/r8-runtime'
import { THEME_DECORATION_KIND_VALUES, type ThemeOption } from '@shared/types'
import { getPaletteDisplayName } from '@shared/theme-display-names'
import { PORT_POPOUT_LIMITS, type AITask, type AIToolType } from '@shared/types-extended'
import {
  R8_FEATURE_FLAGS,
  assertFeatureFlagRegistry,
  featureFlagNameSchema,
  resolveFeatureFlagDefault,
  type FeatureFlagName
} from '@shared/feature-flags'
import { R8A_INTEGRATION_MANIFEST } from '@shared/integration-manifest'
import { BUILTIN_SKILLS } from '@shared/skill-builtins'
import { SECURITY_TIER_LIMITS, buildDefaultBlocklistEntries, classifyPortSecurity, isPortBlocklisted } from '@shared/port-security'
import type { AppStore } from '../store/AppStore'
import { NodeWindowManagerAdapter } from './integrations/NodeWindowManagerAdapter'
import { NutJsAdapter } from './integrations/NutJsAdapter'
import { CLIOutputParser } from './cli-parser'
import { CursorCopilotDetector } from './cli-parser/CursorCopilotDetector'
import { ShimRegistry, type ShimTool } from './shim'
import type { SharedMonitorRuntime } from '../ipc/runtimeBundle'
import { CsvFileWatcher, CsvParser, CsvTaskDriver, type CsvFileGroup, type CsvFileWatcherEvent, type RuntimeCsvTaskRow } from './csv'
import { PythonScriptManager } from './csv-launcher'
import { CsvFileLockService } from './csv-lock'
import { RecordingService } from './recording'
import { auditLogger, type AuditEntry, type AuditResult } from './AuditLogger'
import { FlowBuilder, GraphService, GraphSnapshotter, type GraphSnapshotterRunResult } from './graph'
import { SignalContributionTracker } from './detection/SignalContributionTracker'
import { SignalFusion } from './detection/SignalFusion'
import { DEFAULT_WEIGHT_PROFILES, coerceWeightProfileId, createWeightProfile } from './detection/WeightProfile'
import { StateMachineCoordinator } from './state'
import { DiagnosticExplainService, MisreportLogger, WeightAdjuster } from './feedback'
import { getUnifiedNotificationService, type UnifiedNotificationService } from './notification'
import { SQLiteTaskQueueStore, StoreBackedTaskQueueService, type QueueStorageBackend, type TaskQueueStore } from './task-queue'
import { DagOrchestrator, type DagOrchestratorBuildInput } from './dag'
import { StatusAggregator } from './StatusAggregator'
import { CustomSvgStore } from './CustomSvgStore'
import { PopoutPositionStore } from './PopoutPositionStore'
import { WatchdogActionExecutor, WatchdogEngine, WatchdogHeartbeatCollector, type PidLivenessState, type WatchdogActionExecutionResult, type WatchdogCollectorSourceConfig, type WatchdogStore } from './watchdog'
import { WatchdogSupervisor, type WatchdogSupervisorStore } from './watchdog-supervisor'
import { AppLifecycle } from './AppLifecycle'
import { DirtyStateScanner, RecoveryProbe, RecoveryStrategy, defaultRecoveryBootId } from './recovery'
import {
  InjectService,
  InjectFirstTimeConfirmRepository,
  InjectTargetResolver,
  expiresAtForDuration,
  hashInjectWhitelistPattern,
  type InjectAuditStore,
  type InjectTargetRecord
} from './inject'
import {
  watchdogSupervisorEventStreamPayloadSchema,
  type RpcChannel,
  type WatchdogSupervisorEventResult,
  type WatchdogSupervisorEventType,
  type WatchdogSupervisorRespawnRequest,
  type WatchdogSupervisorServiceRequest,
  type WatchdogSupervisorStatus
} from '@shared/schemas/watchdog-rpc'
import {
  injectCountdownConfigSchema,
  injectCountdownControlRequestSchema,
  injectFirstTimeConfirmRequestSchema,
  injectFirstTimeConfirmResultSchema,
  injectFirstTimeRequiredPayloadSchema,
  injectCountdownStreamPayloadSchema,
  injectResolveTargetInputSchema,
  injectStrictModeConfigSchema,
  injectWhitelistEntrySchema,
  type InjectCountdownConfig,
  type InjectCountdownControlRequest,
  type InjectCountdownStreamPayload,
  type InjectResolveTargetInput,
  type InjectResolveTargetResult,
  type InjectScenario,
  type InjectStrictModeConfig,
  type InjectTool,
  type InjectWhitelistDuration,
  type InjectWhitelistEntry,
  type InjectWhitelistScope
} from '@shared/schemas/inject'
import {
  getRateLimitStats,
  listRateLimitChannelRegistrations,
  overrideRateLimitChannelClass,
  registerR8RateLimitChannels
} from '../utils/rateLimiter'
import {
  fusionConfigSchema,
  signalContributionSnapshotSchema,
  type FusionConfig,
  type SignalContributionSnapshot,
  type SignalSource,
  type WeightProfile,
  type WeightProfileId
} from '@shared/schemas/signal-fusion'
import type { InstanceState, StateLayer, StateRuleOverrideRequest, StateTransitionEvent } from '@shared/schemas/state-machine'
import {
  diagnosticExplainSchema,
  listMisreportsRequestSchema,
  misreportRecordSchema,
  misreportResponseSchema,
  reportMisreportRequestSchema,
  resetLearnedWeightsRequestSchema,
  resetLearnedWeightsResponseSchema,
  type DiagnosticExplain,
  type MisreportRecord,
  type MisreportResponse,
  type ResetLearnedWeightsResponse
} from '@shared/schemas/misreport'
import {
  channelConfigSchema,
  notificationAggregationConfigSchema,
  notifyInvokeActionRequestSchema,
  notifyListRequestSchema,
  type ChannelConfig,
  type DevhubNotification,
  type NotificationAggregationConfig,
  type NotifyListRequest
} from '@shared/schemas/notification'
import {
  rateLimitOverrideResponseSchema,
  type RateLimitOverrideRequest,
  type RateLimitOverrideResponse,
  type RateLimitStatsResponse
} from '@shared/schemas/ipc-rate-limit'
import {
  observabilityConfigSchema,
  observabilityConfigureResponseSchema,
  observabilityDiagnosticPackRequestSchema,
  observabilityDiagnosticPackResponseSchema,
  observabilityExportSnapshotRequestSchema,
  observabilityExportSnapshotResponseSchema,
  observabilitySnapshotRequestSchema,
  observabilitySubscribeRequestSchema,
  observabilitySubscribeResponseSchema,
  observabilityUnsubscribeRequestSchema,
  observabilityUnsubscribeResponseSchema,
  type ObservabilityDiagnosticPackResponse,
  type ObservabilityExportSnapshotResponse,
  type ObservabilitySnapshot
} from '@shared/schemas/observability'
import { RingBufferStore } from './observability/RingBufferStore'
import { SnapshotBuilder } from './observability/SnapshotBuilder'
import { createR8SchemaRegistry } from './zod/SchemaRegistry'
import { SchemaMigration } from './zod/SchemaMigration'

const nodeRequire = createRequire(import.meta.url)

interface CliStrategyAuditEntry {
  type: 'cli:select-strategy'
  sessionId: string
  instanceId: string
  fromStrategy: ParserStrategy
  toStrategy: ParserStrategy
  changedAt: number
}

interface FlowEventSubscriber {
  timer: NodeJS.Timeout
  seenNodeIds: Set<string>
}
type RuntimeInjectWhitelistEntry = InjectWhitelistEntry & { alias: string }

interface InjectHistoryEntry {
  injectId: string
  targetAlias?: string
  status: string
  at: number
  confirmedBy?: string
  characters?: number
  error?: string | null
  event?: string
  whitelistId?: string
  scope?: InjectWhitelistScope
  patternHash?: string
  reason?: string | null
}

interface R8RuntimeStoreShape {
  backups?: unknown[]
  backupSchedule?: unknown
  blocklist?: unknown[]
  cliEvents?: unknown[]
  cliSessions?: unknown[]
  cliStrategyAudit?: unknown[]
  shimManifests?: unknown[]
  commandHistory?: unknown[]
  customCommands?: unknown[]
  diagnostics?: unknown[]
  drawers?: unknown[]
  drawerLayouts?: Record<string, unknown>
  dashboardLayouts?: Record<string, unknown>
  drawerLayoutVersion?: unknown
  featureOverrides?: Record<string, boolean>
  injectWhitelist?: unknown[]
  notifications?: unknown[]
  permissions?: unknown[]
  permissionTtlGrants?: unknown[]
  permissionTtlPolicies?: Record<string, unknown>
  permissionTtlRequestLog?: Record<string, unknown>
  popouts?: unknown[]
  processViewMode?: unknown
  signalFeedback?: unknown[]
  signalStates?: Record<string, unknown>
  signalContributionSnapshots?: Record<string, unknown>
  signalFusionConfig?: unknown
  signalWeights?: Record<string, number>
  signalWeightProfile?: unknown
  statusbarConfig?: unknown
  taskQueueEngine?: unknown
  themeSoundConfigs?: Record<string, unknown>
  tasks?: unknown[]
  taskStateTransitions?: unknown[]
  toolDetectCache?: Record<string, unknown>
  toolOverrides?: Record<string, string>
  monitorWindowPrefs?: unknown
  monitorPopoutLayouts?: Record<string, unknown>
  csvDriverState?: unknown
  dagAudit?: unknown[]
  dagSnapshots?: unknown[]
  csvSessions?: unknown[]
  csvTemplates?: unknown[]
  injectHistory?: unknown[]
  injectAuditRecords?: unknown[]
  injectCountdownConfig?: unknown
  injectCountdownCancellations?: unknown[]
  injectCountdownCompletions?: unknown[]
  notifyConfig?: unknown
  permissionAllowlist?: unknown[]
  recordingSessions?: unknown[]
  recoveryReports?: unknown[]
  recoveryDismissals?: Record<string, number>
  replayStates?: unknown[]
  watchdogConfig?: unknown
  watchdogHistory?: unknown[]
  watchdogInstances?: unknown[]
  watchdogBeats?: unknown[]
  watchdogSelfCheckAt?: unknown
  watchdogActionResults?: unknown[]
  observabilityConfig?: unknown
}

type PopoutRecord = ReturnType<typeof browserPopoutSchema.parse>
type R8Display = ReturnType<typeof screen.getAllDisplays>[number]
type PopoutBounds = NonNullable<PopoutRecord['bounds']>
type PortPopoutRuntimeRecord = ReturnType<typeof portPopoutRuntimeRecordSchema.parse>
type ParsedPortPopoutTarget = { port: number; pid: number | null }
type PopoutScreenEvent = ReturnType<typeof popoutScreenEventSchema.parse>
type ClosedPopoutRssReleaseStatus = 'released' | 'recovered' | 'shared-process' | 'retained' | 'unknown'
interface PendingClosedPopoutRssCheck {
  windowId: string
  pid: number | null
  rssBeforeMb: number | null
  scheduledAt: number
  dueAt: number
  timer: NodeJS.Timeout | null
}
interface ClosedPopoutRssReleaseResult {
  success: boolean
  passed: boolean
  windowId: string
  pid: number | null
  status: ClosedPopoutRssReleaseStatus
  reason: string
  rssBeforeMb: number | null
  rssAfterMb: number | null
  scheduledAt: number
  dueAt: number
  checkedAt: number
}
const BROWSER_POPOUT_LIMIT = 10
// Derived from the Zod single source of truth so adding a detachable surface is a
// one-line schema edit (process/window/dashboard/topology/r8-ops + the four
// PR2 detail surfaces).
const PANEL_POPOUT_SURFACES = new Set<string>(panelPopoutSurfaceSchema.options)
const BROWSER_POPOUT_HEARTBEAT_TIMEOUT_MS = 30_000
const BROWSER_POPOUT_IDLE_AUTO_CLOSE_MS = 60 * 60_000
const BROWSER_POPOUT_RSS_MONITOR_INTERVAL_MS = 5_000
const BROWSER_POPOUT_RSS_DEGRADE_GRACE_MS = 30_000
const BROWSER_POPOUT_RSS_RELEASE_CHECK_DELAY_MS = 5_000
const POPOUT_SESSION_PARTITION = 'persist:popouts'
const DEVHUB_OS_PROTOCOL_SCHEME = 'devhub'
const POPOUT_CSP_INSTALLED_SESSIONS = new WeakSet<Session>()
const POPOUT_PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ')
// The dev popout window loads the SAME Vite-served index.html as the main window.
// Vite + @vitejs/plugin-react inject an INLINE React-refresh preamble script into
// the served HTML; without 'unsafe-inline' in script-src that inline script is
// blocked by CSP and the popout's React app never boots — the popout opens blank /
// "nothing happens". Mirror the main window's dev CSP (src/main/index.ts) so the
// detached panel boots identically. Prod CSP stays strict (no unsafe-inline/eval).
const POPOUT_DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ')

function isElectronDefaultApp(): boolean {
  return Boolean((process as NodeJS.Process & { defaultApp?: boolean }).defaultApp)
}

type DrawerState = ReturnType<typeof drawerStateSchema.parse>
type DrawerSlot = ReturnType<typeof drawerSlotSchema.parse>
type DrawerLayoutRecord = ReturnType<typeof drawerLayoutRecordSchema.parse>
type DashboardLayout = ReturnType<typeof dashboardLayoutSchema.parse>
type DashboardGridItem = ReturnType<typeof dashboardGridItemSchema.parse>
const DRAWER_SLOTS: DrawerSlot[] = ['top', 'right', 'bottom', 'floating', 'statusbar']
const DRAWER_LAYOUT_CURRENT_VERSION = '2'
const DRAWER_SLOT_DEFAULTS: Record<DrawerSlot, Pick<DrawerState, 'contentId' | 'height' | 'open' | 'pinned' | 'scope' | 'size' | 'width' | 'zIndex'>> = {
  top: { contentId: 'notifications.top', height: 80, open: false, pinned: false, scope: 'global', size: 80, zIndex: 2000 },
  right: { contentId: 'monitor.port-detail', open: false, pinned: false, scope: 'monitor', size: 360, width: 360, zIndex: 2010 },
  bottom: { contentId: 'observability', height: 240, open: false, pinned: false, scope: 'global', size: 240, zIndex: 2020 },
  floating: { contentId: 'popout.manager', height: 240, open: false, pinned: false, scope: 'global', size: 320, width: 320, zIndex: 4000 },
  statusbar: { contentId: 'statusbar.aggregate', height: 28, open: false, pinned: false, scope: 'global', size: 28, zIndex: 1500 }
}
const DRAWER_SIZE_LIMITS: Record<DrawerSlot, { min: number; max: number; defaultSize: number }> = {
  top: { min: 40, max: 240, defaultSize: 80 },
  right: { min: 280, max: 800, defaultSize: 360 },
  bottom: { min: 120, max: 600, defaultSize: 240 },
  floating: { min: 240, max: 640, defaultSize: 320 },
  statusbar: { min: 28, max: 96, defaultSize: 28 }
}
const DASHBOARD_PRESETS = ['default', 'minimal', 'monitor-focus', 'ai-focus'] as const
const DASHBOARD_BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl'] as const
const DASHBOARD_COLS = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16 } as const
const DASHBOARD_WIDGET_DRAWER_CONTENT: Partial<Record<DashboardGridItem['widgetId'], string>> = {
  'process-summary': 'monitor.process',
  'port-summary': 'monitor.port',
  'window-summary': 'monitor.window',
  'ai-task-queue': 'monitor.ai-task',
  'system-resource': 'statusbar.aggregate',
  notifications: 'notifications.top',
  'topology-mini': 'topology.global',
  'treemap-mini': 'process.treemap'
}
const COMMAND_THEME_OPTIONS: Array<{ theme: ThemeOption; title: string; keywords: string[] }> = [
  { theme: 'constructivism', title: '切换主题：Constructivism Command', keywords: ['theme', 'palette', '主题', 'constructivism', 'red', 'gold'] },
  { theme: 'modern-light', title: '切换主题：Modern Light', keywords: ['theme', 'palette', '主题', 'light', 'modern'] },
  { theme: 'warm-light', title: '切换主题：Warm Light', keywords: ['theme', 'palette', '主题', 'warm', 'paper'] },
  { theme: 'cyberpunk', title: '切换主题：Cyberpunk', keywords: ['theme', 'palette', '主题', 'dark', 'terminal'] },
  { theme: 'swiss', title: '切换主题：Swiss', keywords: ['theme', 'palette', '主题', 'swiss', 'minimal'] },
  { theme: 'dark', title: '切换主题：Dark', keywords: ['theme', 'palette', '主题', 'dark'] },
  { theme: 'light', title: '切换主题：Light', keywords: ['theme', 'palette', '主题', 'light'] }
]
type BackupBundle = ReturnType<typeof backupBundleSchema.parse>
type DiagnosticScreenshotResult = ReturnType<typeof diagnosticScreenshotResultSchema.parse>
type CliOutputEvent = ReturnType<typeof cliOutputEventSchema.parse>
type FusedSignal = ReturnType<typeof fusedSignalSchema.parse>
type InjectAction = ReturnType<typeof injectActionSchema.parse>
type InjectResult = ReturnType<typeof injectResultSchema.parse>
type TaskRun = ReturnType<typeof taskRunSchema.parse>
type TaskQueueEngine = ReturnType<typeof taskQueueEngineSchema.parse>
type TaskStateTransitionEvent = ReturnType<typeof taskStateStreamPayloadSchema.parse>['transitions'][number]
type CsvLaunchSession = ReturnType<typeof csvLaunchSessionSchema.parse>
type CsvSessionEvent = ReturnType<typeof csvSessionEventSchema.parse>
type ToolDetectResult = ReturnType<typeof toolDetectResultSchema.parse>
type RecordingSession = ReturnType<typeof recordingSessionSchema.parse>
type RecoveryReport = ReturnType<typeof recoveryReportSchema.parse>
type ReplayState = ReturnType<typeof replayStateSchema.parse>
type R8ToolName = ToolDetectResult['tool']

interface PythonExecutable {
  command: string
  prefixArgs: string[]
  version: string
}

interface SkillExecutionTarget {
  skill: Skill
  skillDirectory: string
  scriptPath: string
}

interface SkillExecutionCommand {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
}

interface SkillProcessResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

interface OnFailSkillExecutionResult {
  success: boolean
  skillName: string
  artifactPath: string
  exitCode: number | null
  errorCode: string
  errorMessage: string
}

type ExecFileErrorLike = Error & {
  code?: number | string
  signal?: string | null
  killed?: boolean
}

type WindowTitleSignalLike = {
  instanceId: string
  tool: MonitorTool | 'unknown'
  phase: 'idle' | 'thinking' | 'editing' | 'running' | 'completed' | 'unknown'
  confidence: number
  source: 'window-title'
  rawTitle: string
  titleHash: string
  hwnd: number
  pid: number
  processName: string
  ts: number
}

const MONITOR_TOOLS = ['codex', 'claude', 'gemini', 'cursor', 'copilot'] as const satisfies readonly MonitorTool[]
const MONITOR_SNAPSHOT_STREAM_THROTTLE_MS = 100
const SKILL_LIST_STREAM_THROTTLE_MS = 100
const PERMISSION_EXPIRY_STREAM_THROTTLE_MS = 1000
const SKILL_WATCH_DEPTH = 2
const ON_FAIL_SKILL_MIN_TIMEOUT_MS = 1_000
const ON_FAIL_SKILL_DEFAULT_TIMEOUT_MS = 15_000
const ON_FAIL_SKILL_MAX_TIMEOUT_MS = 60_000
const ON_FAIL_SKILL_MAX_BUFFER_BYTES = 1_048_576
const SKILL_READ_ONLY_PERMISSIONS = new Set(['fs-read'])
const SKILL_READ_WRITE_PERMISSIONS = new Set(['fs-read', 'fs-write'])
const CLI_VERSION_PROBE_TIMEOUT_MS = 10_000
const GEMINI_LOW_MATCH_WARN_MIN_LINES = 5
const GEMINI_LOW_MATCH_WARN_MAX_MATCH_RATIO = 0.5
const GEMINI_STDOUT_TIMEOUT_MS = 30_000
const CLAUDE_STREAM_JSON_RESTART_ACTION_PREFIX = 'claude-stream-json-restart:'
const CLAUDE_STREAM_JSON_RESTART_TIMEOUT_MS = 300_000
const DEFAULT_MONITOR_WINDOW_STATE: MonitorWindowState = monitorWindowStateSchema.parse({
  alwaysOnTop: false,
  opacity: 0.96,
  bounds: { x: 80, y: 80, w: 720, h: 520 }
})
const MONITOR_POPOUT_SIZE = { width: 320, height: 140 } as const
const MONITOR_POPOUT_MIN_SIZE = { width: 200, height: 100 } as const
const MONITOR_PHASE_PROGRESS: Record<WindowTitleSignalLike['phase'], number | null> = {
  idle: 0,
  thinking: 0.15,
  editing: 0.45,
  running: 0.55,
  completed: 1,
  unknown: null
}

const DEFAULT_STATUSBAR_TILE_IDS = [
  'cpu',
  'mem',
  'net',
  'battery',
  'projects',
  'ai-tasks',
  'public-ports',
  'listening-ports',
  'notifications',
  'popouts',
  'theme',
  'cmdk'
] as const satisfies readonly StatusTile['id'][]

const TOOL_DETECT_COMMANDS: Record<R8ToolName, { command: string; args: string[]; parser: ToolDetectResult['recommendedParser']; capabilities: ToolDetectResult['capabilities'] }> = {
  codex: { command: 'codex', args: ['--version'], parser: 'shim', capabilities: ['exec', 'stream-json'] },
  claude: { command: 'claude', args: ['--version'], parser: 'ndjson', capabilities: ['stream-json', 'json-flag', 'mcp', 'permissions'] },
  gemini: { command: 'gemini', args: ['--version'], parser: 'line', capabilities: ['prompt', 'mcp'] },
  cursor: { command: 'cursor', args: ['--version'], parser: 'window-title', capabilities: ['window-only', 'window-title-detect'] },
  copilot: { command: 'gh', args: ['copilot', '--version'], parser: 'line', capabilities: ['window-only', 'gh-copilot'] }
}

function parseAttachedLegacyRootId(rootId: string | undefined): { scope: 'process' | 'port' | 'window' | 'project'; targetId: string | number } | null {
  if (!rootId) return null
  const processMatch = rootId.match(/^process-(\d+)$/)
  if (processMatch) return { scope: 'process', targetId: Number(processMatch[1]) }
  const windowMatch = rootId.match(/^window-(\d+)$/)
  if (windowMatch) return { scope: 'window', targetId: Number(windowMatch[1]) }
  const portMatch = rootId.match(/^port-(\d+)(?:-|$)/)
  if (portMatch) return { scope: 'port', targetId: Number(portMatch[1]) }
  const projectMatch = rootId.match(/^project-(.+)$/)
  if (projectMatch) return { scope: 'project', targetId: projectMatch[1] }
  return null
}

function attachedExpandableNodes(snapshot: GraphSnapshot): string[] {
  return snapshot.nodes
    .filter(node => node.kind === 'process' || node.kind === snapshot.slice.scope)
    .slice(0, 50)
    .map(node => node.id)
}


function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readNumberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeAuditTimestamp(ts: number): number {
  return ts < 10_000_000_000 ? ts * 1000 : ts
}

function readAuditEntry(value: unknown): AuditEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const target = record.target
  if (typeof target !== 'object' || target === null) return null
  const action = readStringValue(record.action)
  const op = readStringValue(record.op) ?? action
  const result = record.result
  const ts = readNumberValue(record.ts)
  const timestamp = readStringValue(record.timestamp) ?? new Date(normalizeAuditTimestamp(ts ?? Date.now())).toISOString()
  if (!action || !op || !ts || (result !== 'success' && result !== 'refused' && result !== 'error')) return null
  return {
    timestamp,
    ts,
    action,
    op,
    target: target as Record<string, unknown>,
    result,
    outcome: readStringValue(record.outcome) ?? result,
    reason: readStringValue(record.reason) ?? undefined
  }
}

function asArray<T>(value: unknown, parser: (item: unknown, index: number) => T): T[] {
  if (!Array.isArray(value)) return []
  const parsed: T[] = []
  for (let index = 0; index < value.length; index += 1) {
    const result = parser(value[index], index)
    parsed.push(result)
  }
  return parsed
}

function redacted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redacted)
  if (typeof value === 'string') return redactBackupText(value, new Set<string>(), 'diagnostic')
  if (!value || typeof value !== 'object') return value
  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password')) {
      output[key] = '[REDACTED]'
    } else {
      output[key] = redacted(child)
    }
  }
  return output
}

const BACKUP_SCHEMA_VERSION = '1.0.0'
const DEFAULT_BACKUP_CATEGORIES = ['settings', 'csv-tasks', 'skills', 'audit-log'] as const satisfies readonly BackupCategory[]
const BACKUP_CATEGORY_FILE_NAMES: Record<BackupCategory, string> = {
  settings: 'store.json',
  'csv-tasks': 'tasks.json',
  skills: 'skills.json',
  'audit-log': 'audit-log.json'
}
const DIAGNOSTIC_SCHEMA_VERSION = '1.0.0'
const DIAGNOSTIC_PREVIEW_SAMPLE_LIMIT = 2000
const DATA_OWNERSHIP_SUMMARY_FILE_LIMIT = 2000
const DATA_OWNERSHIP_ENTRY_LIMIT = 200
const DEFAULT_DIAGNOSTIC_SECTIONS = [
  'observability-snapshot',
  'audit-log',
  'state-machine-ringbuffer',
  'misreport-records',
  'system-info',
  'recovery-report',
  'feature-flags',
  'env-config-redacted'
] as const satisfies readonly DiagnosticSection[]
const SENSITIVE_PERMISSION_OPERATIONS = [
  'inject',
  'shim-install',
  'kill-pid',
  'file-write',
  'fs-elevated',
  'webhook',
  'smtp',
  'store-api-key'
] as const satisfies readonly SensitivePermissionOperation[]
const DEFAULT_RECORDING_RUNTIME_STREAMS = ['stdout', 'stdin', 'screenshot', 'fs', 'git-diff'] as const satisfies readonly RecordingStreamKind[]
const RECORDING_STREAM_FLAGS: Partial<Record<RecordingStreamKind, FeatureFlagName>> = {
  screenshot: 'R8.C.recording.engine.screenshot',
  fs: 'R8.C.recording.engine.fs',
  'git-diff': 'R8.C.recording.engine.git-diff'
}
const BACKUP_SCHEDULE_TASK_NAME = 'devhub-r8-backup-schedule'
const BACKUP_SCHEDULE_DISABLE_FAILURES = 5
const DEFAULT_PERMISSION_TTL_MS = 30 * 60_000
const MAX_PERMISSION_TTL_MS = 24 * 60 * 60_000
const ATTACHED_TOPOLOGY_NODE_LIMIT = 500
const LEGACY_SCOPE_TO_CATEGORY: Record<'settings' | 'csv' | 'skills' | 'audit', BackupCategory> = {
  settings: 'settings',
  csv: 'csv-tasks',
  skills: 'skills',
  audit: 'audit-log'
}
const CATEGORY_TO_LEGACY_SCOPE: Record<BackupCategory, 'settings' | 'csv' | 'skills' | 'audit'> = {
  settings: 'settings',
  'csv-tasks': 'csv',
  skills: 'skills',
  'audit-log': 'audit'
}

interface BackupCategoryPayload {
  category: BackupCategory
  payload: unknown
  fileCount: number
  warnings: string[]
}

interface BackupUserSkillFile {
  relativeDir: string
  sourceRoot: 'skills' | 'r8-skills' | 'codex-skills'
  markdown: string
}

interface DataOwnershipRootDefinition {
  rootId: string
  label: string
  description: string
  category: DataOwnershipPathSummary['category']
  path: string
  sensitive: boolean
  exportable: boolean
}

interface DiagnosticSectionPayload {
  section: DiagnosticSection
  payload: unknown
  fileCount: number
  warnings: string[]
}

interface DiagnosticRedactionResult {
  text: string
  counts: Record<string, number>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function legacyScopeToCategories(scope: readonly ('settings' | 'csv' | 'skills' | 'audit')[] | undefined): BackupCategory[] {
  if (!scope || scope.length === 0) return [...DEFAULT_BACKUP_CATEGORIES]
  return [...new Set(scope.map(item => LEGACY_SCOPE_TO_CATEGORY[item]))]
}

function categoriesToLegacyScope(categories: readonly BackupCategory[]): Array<'settings' | 'csv' | 'skills' | 'audit'> {
  return [...new Set(categories.map(category => CATEGORY_TO_LEGACY_SCOPE[category]))]
}

function safeBackupDirectoryName(name: string): string {
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(name)) throw new Error(`E_VALIDATION:unsafe backup entry name ${name}`)
  return name
}

function redactBackupText(text: string, redactedFields: Set<string>, context: string): string {
  const replacements: Array<{ name: string; pattern: RegExp }> = [
    { name: 'openai-key', pattern: /sk-[A-Za-z0-9_-]{8,}/g },
    { name: 'token-prefix', pattern: /tok-[A-Za-z0-9_-]{6,}/g },
    { name: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g },
    { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
    { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi }
  ]
  let output = text
  for (const replacement of replacements) {
    output = output.replace(replacement.pattern, match => {
      redactedFields.add(`${context}:${replacement.name}`)
      return `[REDACTED:${replacement.name}:${createHash('sha256').update(match).digest('hex').slice(0, 8)}]`
    })
  }
  return output
}

function redactBackupValue(value: unknown, redactedFields: Set<string>, path = 'root'): unknown {
  if (typeof value === 'string') return redactBackupText(value, redactedFields, path)
  if (Array.isArray(value)) return value.map((child, index) => redactBackupValue(child, redactedFields, `${path}.${index}`))
  if (!isRecord(value)) return value
  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`
    if (/(api[-_]?key|token|secret|password|credential|authorization|smtp[-_]?password)/i.test(key)) {
      redactedFields.add(childPath)
      output[key] = '[REDACTED]'
      continue
    }
    output[key] = redactBackupValue(child, redactedFields, childPath)
  }
  return output
}

function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function crc32Buffer(content: Buffer): number {
  let crc = 0xffffffff
  for (const byte of content) {
    crc ^= byte
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(timestamp: number): { dosDate: number; dosTime: number } {
  const date = new Date(timestamp)
  const year = Math.max(1980, Math.min(2107, date.getFullYear()))
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  return { dosDate, dosTime }
}

async function collectZipFiles(rootPath: string, currentPath = rootPath): Promise<Array<{ absolutePath: string; relativePath: string }>> {
  const entries = await readdir(currentPath, { withFileTypes: true })
  const files: Array<{ absolutePath: string; relativePath: string }> = []
  for (const entry of entries) {
    const absolutePath = join(currentPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectZipFiles(rootPath, absolutePath))
      continue
    }
    if (!entry.isFile()) continue
    files.push({
      absolutePath,
      relativePath: relative(rootPath, absolutePath).replace(/\\/g, '/')
    })
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

async function writeZipArchiveFromDirectory(rootPath: string, zipPath: string, timestamp: number): Promise<number> {
  const files = await collectZipFiles(rootPath)
  const { dosDate, dosTime } = dosDateTime(timestamp)
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const rawContent = await readFile(file.absolutePath)
    const compressedContent = deflateRawSync(rawContent, { level: 6 })
    const fileName = Buffer.from(file.relativePath, 'utf8')
    const crc32 = crc32Buffer(rawContent)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0x0800, 6)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(crc32, 14)
    localHeader.writeUInt32LE(compressedContent.byteLength, 18)
    localHeader.writeUInt32LE(rawContent.byteLength, 22)
    localHeader.writeUInt16LE(fileName.byteLength, 26)
    localHeader.writeUInt16LE(0, 28)
    localParts.push(localHeader, fileName, compressedContent)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(crc32, 16)
    centralHeader.writeUInt32LE(compressedContent.byteLength, 20)
    centralHeader.writeUInt32LE(rawContent.byteLength, 24)
    centralHeader.writeUInt16LE(fileName.byteLength, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, fileName)
    offset += localHeader.byteLength + fileName.byteLength + compressedContent.byteLength
  }

  const centralDirectoryOffset = offset
  const centralDirectory = Buffer.concat(centralParts)
  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0)
  endOfCentralDirectory.writeUInt16LE(0, 4)
  endOfCentralDirectory.writeUInt16LE(0, 6)
  endOfCentralDirectory.writeUInt16LE(files.length, 8)
  endOfCentralDirectory.writeUInt16LE(files.length, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectory.byteLength, 12)
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16)
  endOfCentralDirectory.writeUInt16LE(0, 20)
  const archive = Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory])
  await writeFile(zipPath, archive)
  return archive.byteLength
}

function mergeStoredValue(current: unknown, incoming: unknown): unknown {
  if (Array.isArray(current) && Array.isArray(incoming)) {
    const seen = new Set(current.map(item => JSON.stringify(item)))
    const merged = [...current]
    for (const item of incoming) {
      const key = JSON.stringify(item)
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(item)
      }
    }
    return merged
  }
  if (isRecord(current) && isRecord(incoming)) return { ...current, ...incoming }
  return incoming
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function monotonicNowMs(): number {
  return performance.now()
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort((left, right) => left.localeCompare(right)).map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function incrementRedactionCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1
}

function mergeRedactionCounts(target: Record<string, number>, incoming: Record<string, number>): void {
  for (const [key, count] of Object.entries(incoming)) {
    target[key] = (target[key] ?? 0) + count
  }
}

function diagnosticSectionFileName(section: DiagnosticSection): string {
  return `${section}.json`
}

function defaultDiagnosticRedactionRules(): DiagnosticRedactionRule[] {
  const dynamicRules: DiagnosticRedactionRule[] = []
  const username = userInfo().username
  const host = hostname()
  if (username) {
    dynamicRules.push({
      ruleId: 'username',
      pattern: escapeRegExp(username),
      replacement: '[REDACTED:username]',
      enabled: true,
      description: 'Current operating system username',
      category: 'identity'
    })
  }
  if (host) {
    dynamicRules.push({
      ruleId: 'hostname',
      pattern: escapeRegExp(host),
      replacement: '[REDACTED:hostname]',
      enabled: true,
      description: 'Current machine hostname',
      category: 'identity'
    })
  }
  return [
    { ruleId: 'api-key', pattern: 'sk-[A-Za-z0-9_-]{8,}', replacement: '[REDACTED:api-key]', enabled: true, description: 'OpenAI or Anthropic style API keys', category: 'secret' },
    { ruleId: 'token-prefix', pattern: 'tok-[A-Za-z0-9_-]{6,}', replacement: '[REDACTED:token]', enabled: true, description: 'Generic token prefix values', category: 'secret' },
    { ruleId: 'github-token', pattern: 'ghp_[A-Za-z0-9]{20,}', replacement: '[REDACTED:github-token]', enabled: true, description: 'GitHub personal access tokens', category: 'secret' },
    { ruleId: 'aws-access-key', pattern: 'AKIA[0-9A-Z]{16}', replacement: '[REDACTED:aws-key]', enabled: true, description: 'AWS access key ids', category: 'secret' },
    { ruleId: 'jwt', pattern: '\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b', replacement: '[REDACTED:jwt]', enabled: true, description: 'JWT-like bearer payloads', category: 'secret' },
    { ruleId: 'bearer-token', pattern: '\\bBearer\\s+[A-Za-z0-9._~+/=-]{12,}', replacement: '[REDACTED:bearer]', enabled: true, description: 'Bearer authorization headers', category: 'secret' },
    { ruleId: 'windows-path', pattern: '[A-Za-z]:\\\\(?:Users|Desktop|Documents|Downloads|dev|repo|tmp|Temp)\\\\[^"\\r\\n\\t,}]+', replacement: '[REDACTED:windows-path]', enabled: true, description: 'Windows local filesystem paths', category: 'path' },
    { ruleId: 'posix-path', pattern: '/(?:Users|home|tmp|var|opt)/[^"\\r\\n\\t,}]+', replacement: '[REDACTED:posix-path]', enabled: true, description: 'POSIX local filesystem paths', category: 'path' },
    { ruleId: 'email', pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', replacement: '[REDACTED:email]', enabled: true, description: 'Email addresses', category: 'identity' },
    { ruleId: 'ipv4', pattern: '\\b(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}\\b', replacement: '[REDACTED:ipv4]', enabled: true, description: 'IPv4 addresses', category: 'network' },
    ...dynamicRules
  ]
}

function applyDiagnosticRedactions(text: string, rules: readonly DiagnosticRedactionRule[]): DiagnosticRedactionResult {
  let output = text
  const counts: Record<string, number> = {}
  for (const rule of rules) {
    if (!rule.enabled) continue
    let pattern: RegExp
    try {
      pattern = new RegExp(rule.pattern, 'g')
    } catch (error) {
      throw Object.assign(new Error(`E_VALIDATION:invalid diagnostic redaction rule ${rule.ruleId ?? rule.description}: ${error instanceof Error ? error.message : String(error)}`), { code: 'E_VALIDATION' })
    }
    const key = rule.ruleId ?? rule.description
    output = output.replace(pattern, () => {
      incrementRedactionCount(counts, key)
      return rule.replacement
    })
  }
  return { text: output, counts }
}

function parseStoredNotifications(value: unknown): DevhubNotification[] {
  if (!Array.isArray(value)) return []
  const parsed: DevhubNotification[] = []
  for (const item of value) {
    const result = r8NotificationSchema.safeParse(item)
    if (result.success) parsed.push(result.data)
  }
  return parsed
}

export class R8RuntimeService {
  private readonly popoutWindows = new Map<string, BrowserWindow>()
  private readonly popoutSession = session.fromPartition(POPOUT_SESSION_PARTITION)
  private readonly store = new Store<R8RuntimeStoreShape>({ name: 'devhub-r8-runtime' })
  private readonly customSvgStore = new CustomSvgStore()
  private readonly popoutPositionStore = new PopoutPositionStore()
  private readonly firstTimeConfirmRepository = new InjectFirstTimeConfirmRepository({
    dbPath: join(app.getPath('userData'), 'inject-first-time.sqlite')
  })
  private popoutRssMonitorTimer: NodeJS.Timeout | null = null
  private readonly closedPopoutRssChecks = new Map<string, PendingClosedPopoutRssCheck>()
  private readonly nutJsAdapter = new NutJsAdapter()
  private readonly nodeWindowManagerAdapter = new NodeWindowManagerAdapter()
  private readonly injectTargetResolver = new InjectTargetResolver({
    records: () => this.listInjectTargetRecords(),
    whitelistEntries: () => this.listInjectWhitelist(),
    strictMode: () => this.getInjectStrictModeConfig(),
    countdown: () => this.getInjectCountdownConfig()
  })

  private readonly injectService = new InjectService({
    store: this.store as unknown as InjectAuditStore,
    nativeTyper: this.nutJsAdapter,
    auditDbPath: join(app.getPath('userData'), 'inject-audit.sqlite'),
    clipboardBridge: {
      readText: () => clipboard.readText(),
      writeText: text => clipboard.writeText(text),
      paste: () => this.nutJsAdapter.pressPasteShortcut({ flagOverrides: this.getBooleanFeatureOverrides() })
    },
    foregroundWindowProvider: async () => {
      const result = await this.nodeWindowManagerAdapter.getActiveWindow()
      return result.success ? result.data ?? null : null
    },
    focusPollingIntervalMs: 50,
    shimControlBridge: {
      send: async input => {
        const result = await this.shimRegistry.sendControl({
          tool: input.tool,
          text: input.text,
          appendNewline: input.appendNewline,
          verifyEcho: input.verifyEcho,
          echoText: input.echoText,
          echoTimeoutMs: input.echoTimeoutMs
        })
        return result.success
          ? {
              success: true,
              data: {
                characters: input.text.length,
                verifiedContentMatches: result.verifiedContentMatches ?? null,
                verificationError: result.verificationError ?? null
              }
            }
          : { success: false, error: result.error ?? 'E_SHIM_NOT_CONNECTED:SHIM control channel rejected meta-command' }
      }
    },
    screenshotBridge: {
      capture: async input => this.captureInjectScreenshot(input.target, input.phase)
    },
    resolveTarget: action => {
      const result = this.resolveInjectTarget({
        ...(action.target ?? { selector: 'alias' as const, aliasOrId: action.targetAlias }),
        scenario: action.scenario,
        taskId: action.taskId ?? undefined,
        confirmedBy: typeof action.confirmedBy === 'string' ? action.confirmedBy : undefined
      })
      return {
        found: Boolean(result.target),
        ready: result.target?.ready ?? true,
        target: result.target,
        whitelistGate: result.whitelistGate,
        strictModeGate: result.strictModeGate,
        countdownMs: result.countdownMs,
        reason: result.reason
      }
    },
    flagOverrides: () => this.getBooleanFeatureOverrides()
  })
  private readonly cliOutputParser = new CLIOutputParser()
  private aiTaskTrackerCliUnsubscribe: (() => void) | null = null
  private mainWindowCloseDetach: (() => void) | null = null
  private screenWatcherDetach: (() => void) | null = null
  private readonly cursorCopilotDetector = new CursorCopilotDetector()
  private readonly auditedCursorCopilotTitleKeys = new Set<string>()
  private readonly auditedGeminiLowMatchKeys = new Set<string>()
  private readonly auditedGeminiStdoutTimeoutKeys = new Set<string>()
  private readonly auditedWatchdogSupervisorEvidenceKeys = new Set<string>()
  private watchdogSupervisorEventSeq = 0
  private lastWatchdogSupervisorStatusEventKey: string | null = null
  private readonly csvParser = new CsvParser()
  private readonly csvTaskDriver = new CsvTaskDriver()
  private readonly pythonScriptManager = new PythonScriptManager()
  private readonly dagOrchestrator = new DagOrchestrator()
  private readonly csvFileLock = new CsvFileLockService()
  private readonly recordingEngine: RecordingService
  private readonly graphService: GraphService
  private readonly graphSnapshotter: GraphSnapshotter
  private readonly flowBuilder: FlowBuilder
  private readonly signalFusion = new SignalFusion()
  private readonly signalContributionTracker = new SignalContributionTracker()
  private readonly lastFusionStreamAt = new Map<string, number>()
  private lastMonitorSnapshotStreamAt = 0
  private monitorSnapshotStreamTimer: NodeJS.Timeout | null = null
  private cachedPermissionExpiryStreamPayload: PermissionExpiryStreamPayload | null = null
  private lastPermissionExpiryStreamPayloadAt = 0
  private skillWatcher: FSWatcher | null = null
  private skillWatcherRoot: string | null = null
  private geminiPatternWatcher: FSWatcher | null = null
  private geminiPatternWatcherPath: string | null = null
  private skillListStreamTimer: NodeJS.Timeout | null = null
  private lastSkillListStreamAt = 0
  private skillListStreamBaseline: Map<string, string> | null = null
  private csvWatcher: CsvFileWatcher | null = null
  private csvWatcherRoot: string | null = null
  private dagEditorCsvWatcher: CsvFileWatcher | null = null
  private dagEditorCsvWatchPath: string | null = null
  private dagEditorCsvWatchMtimeMs: number | null = null
  private dagEditorCsvWatchTimer: NodeJS.Timeout | null = null
  private dagEditorLastExternalChangeKey: string | null = null
  private csvRowStreamTimer: NodeJS.Timeout | null = null
  private lastCsvRowStreamAt = 0
  private csvRowStreamBaseline: Map<string, string> | null = null
  private taskStateStreamTimer: NodeJS.Timeout | null = null
  private lastTaskStateStreamAt = 0
  private readonly pendingTaskStateTransitions: ReturnType<typeof taskStateStreamPayloadSchema.parse>['transitions'] = []
  private watchdogEventStreamTimer: NodeJS.Timeout | null = null
  private lastWatchdogEventStreamAt = 0
  private readonly pendingWatchdogEvents: WatchdogEventStreamPayload['events'] = []
  private watchdogActionExecutor: WatchdogActionExecutor | null = null
  private readonly executedWatchdogActionEventIds = new Set<string>()
  private pendingCsvRowStreamSource: CsvRowStreamPayload['source'] = 'reload'
  private pendingCsvRowStreamSummary: CsvReloadSummary | null = null
  private skillListStreamSource: SkillListStreamPayload['source'] = 'reload'
  private readonly auditedSkillOverrideKeys = new Set<string>()
  private backupScheduleTask: ScheduledTask | null = null
  private backupScheduleRunning = false
  private backupScheduleConsecutiveFailures = 0
  private readonly stateCoordinator = new StateMachineCoordinator(undefined, (violation, state) => {
    auditLogger.log('ai:state-assertion-violation', {
      instanceId: state.instanceId,
      rule: violation.rule,
      detectedAt: violation.detectedAt,
      system: state.system,
      task: state.task,
      ui: state.ui
    }, 'error')
  })
  private readonly lastStateStreamAt = new Map<string, number>()
  private readonly weightAdjuster = new WeightAdjuster()
  private readonly diagnosticExplainService = new DiagnosticExplainService()
  private readonly misreportLogger: MisreportLogger
  private readonly notificationSystem: UnifiedNotificationService
  private readonly observabilityStore = new RingBufferStore()
  private readonly observabilitySnapshotBuilder = new SnapshotBuilder()
  private readonly observabilitySubscribers = new Map<string, NodeJS.Timeout>()
  private readonly flowEventSubscribers = new Map<string, FlowEventSubscriber>()
  private readonly schemaRegistry = createR8SchemaRegistry()
  private statusAggregator: StatusAggregator | null = null
  private lastStatusAggregateGeneratedAt = 0
  private readonly schemaMigration = new SchemaMigration({
    audit: event => auditLogger.log('zod:schema-migration', event, 'success')
  })
  private readonly backupSchemaMigration = new SchemaMigration({
    steps: [{
      fromVersion: '0.9.0',
      toVersion: BACKUP_SCHEMA_VERSION,
      schemaName: 'BackupManifest',
      transform: 'copy-with-schemaVersion',
      reversible: true
    }],
    audit: event => auditLogger.log('zod:schema-migration', event, 'success')
  })
  private readonly recoveryScanner: DirtyStateScanner
  private readonly recoveryStrategy: RecoveryStrategy
  private readonly recoveryProbe: RecoveryProbe
  private taskQueueSqliteStore: SQLiteTaskQueueStore | null = null
  private taskQueueStorageFallbackError: string | null = null
  private readonly taskQueueStorage = this.createTaskQueueStore()
  private readonly taskQueue = new StoreBackedTaskQueueService(
    this.taskQueueStorage,
    row => this.csvTaskDriver.rowHash(row),
    () => Date.now(),
    { onFailSkillExecutorAvailable: true }
  )
  private readonly taskRecordingStartPromises = new Map<string, Promise<string | null>>()
  private readonly claudeStreamJsonRestartChildren = new Map<string, ChildProcessWithoutNullStreams>()
  private readonly csvPythonChildren = new Map<string, ChildProcessWithoutNullStreams>()
  private readonly csvPythonPipeServers = new Map<string, Server>()
  private readonly csvPythonControlSockets = new Map<string, Socket>()
  private readonly injectSessionStartedAt = Date.now()
  private injectWhitelistCleanupTimer: NodeJS.Timeout | null = null
  private readonly watchdog = new WatchdogEngine(this.store as unknown as WatchdogStore, () => Date.now(), pid => this.probeWatchdogPidLiveness(pid))
  private readonly watchdogCollector = new WatchdogHeartbeatCollector()
  private readonly watchdogSupervisor = new WatchdogSupervisor({
    store: this.store as unknown as WatchdogSupervisorStore,
    markerRoot: this.resolveUserDataPath(),
    parentPid: process.pid,
    childEntryFile: this.resolveWatchdogChildEntryFile()
  })
  private readonly shimRegistry = new ShimRegistry(
    this.store,
    () => this.resolveUserDataPath(),
    tool => this.getToolOverrides()[tool] ?? TOOL_DETECT_COMMANDS[tool].command,
    tool => this.resolvePackagedShimPath(tool)
  )

  constructor(
    private readonly appStore: AppStore,
    private readonly getMainWindow: () => BrowserWindow | null,
    private readonly runtime?: SharedMonitorRuntime
  ) {
    this.installPopoutSessionCsp()
    this.misreportLogger = new MisreportLogger({ dbPath: join(this.resolveUserDataPath(), 'feedback', 'misreports.sqlite') })
    this.notificationSystem = getUnifiedNotificationService(this.getMainWindow())
    this.notificationSystem.hydrate(parseStoredNotifications(this.store.get('notifications', [])))
    void this.ensureShimReconciliation().catch(error => {
      auditLogger.log('shim:ensure', { error: error instanceof Error ? error.message : String(error) }, 'error', 'E_INTERNAL')
    })
    const storedObservabilityConfig = observabilityConfigSchema.safeParse(this.store.get('observabilityConfig', {}))
    if (storedObservabilityConfig.success) {
      this.observabilityStore.configure(storedObservabilityConfig.data)
    }
    this.recordingEngine = new RecordingService({
      userDataRoot: () => app.getPath('userData'),
      getMainWindow: this.getMainWindow,
      emitEvent: payload => this.getMainWindow()?.webContents.send('recording:event-stream', payload),
      audit: (action, target, result, reason) => auditLogger.log(action, target, result, reason)
    })
    this.graphService = new GraphService({
      getProjects: () => this.appStore.getProjects(),
      getSnapshot: () => this.runtime?.scannerCache?.getSnapshot() ?? null,
      getUserDataRoot: () => app.getPath('userData')
    })
    this.graphSnapshotter = new GraphSnapshotter({
      graphService: this.graphService,
      isEnabled: () => this.isFeatureEnabled('R8.C.topology.global'),
      onResult: result => this.auditTopologySnapshotterResult(result)
    })
    const userDataRoot = this.resolveUserDataPath()
    this.flowBuilder = new FlowBuilder(undefined, {
      collectorOptions: {
        dbPath: join(userDataRoot, 'flow', 'flow-events.sqlite')
      }
    })
    const recoveryRoot = join(userDataRoot, 'r8-recovery')
    const lifecycle = new AppLifecycle(
      join(recoveryRoot, 'lifecycle.json'),
      defaultRecoveryBootId(),
      () => Date.now(),
      process.pid,
      this.resolveAppVersion()
    )
    this.recoveryScanner = new DirtyStateScanner({
      userDataRoot,
      recoveryRoot,
      lifecycle,
      auditLogPath: auditLogger.getAuditLogPath(),
      listTasks: () => this.listTasks(),
      getStoreSnapshot: () => this.getRecoveryStoreSnapshot(),
      sqlitePaths: () => this.recoverySqlitePaths()
    })
    this.recoveryStrategy = new RecoveryStrategy({
      snapshotRoot: join(recoveryRoot, 'snapshots'),
      recoverablePaths: () => this.recoverableRecoveryPaths(),
      getFindings: () => this.recoveryScanner.scan(),
      writeAudit: (action, target, success, reason) => auditLogger.log(action, target, success ? 'success' : 'error', reason)
    })
    this.recoveryProbe = new RecoveryProbe({
      scanner: this.recoveryScanner,
      strategy: this.recoveryStrategy,
      persistReport: report => this.persistRecoveryReport(report)
    })
    this.aiTaskTrackerCliUnsubscribe = this.runtime?.aiTaskTracker?.subscribeToCliOutputParser(this.cliOutputParser) ?? null
    this.attachMainWindowClosePolicy()
    this.attachPopoutScreenWatcher()
    this.syncPopoutRssMonitor()
    this.syncBackupScheduleTask(this.getBackupSchedule())
    this.startInjectWhitelistCleanupJob()
  }

  dispose(): void {
    this.recoveryProbe.markCleanShutdown()
    this.stopStatusAggregator()
    this.stopBackupScheduleTask()
    if (this.aiTaskTrackerCliUnsubscribe) {
      this.aiTaskTrackerCliUnsubscribe()
      this.aiTaskTrackerCliUnsubscribe = null
    }
    if (this.mainWindowCloseDetach) {
      this.mainWindowCloseDetach()
      this.mainWindowCloseDetach = null
    }
    if (this.screenWatcherDetach) {
      this.screenWatcherDetach()
      this.screenWatcherDetach = null
    }
    if (this.monitorSnapshotStreamTimer) {
      clearTimeout(this.monitorSnapshotStreamTimer)
      this.monitorSnapshotStreamTimer = null
    }
    this.stopPopoutRssMonitor()
    this.clearClosedPopoutRssReleaseChecks()
    if (this.skillListStreamTimer) {
      clearTimeout(this.skillListStreamTimer)
      this.skillListStreamTimer = null
    }
    if (this.csvRowStreamTimer) {
      clearTimeout(this.csvRowStreamTimer)
      this.csvRowStreamTimer = null
    }
    if (this.taskStateStreamTimer) {
      clearTimeout(this.taskStateStreamTimer)
      this.taskStateStreamTimer = null
    }
    if (this.watchdogEventStreamTimer) {
      clearTimeout(this.watchdogEventStreamTimer)
      this.watchdogEventStreamTimer = null
    }
    this.stopInjectWhitelistCleanupJob()
    void this.watchdogSupervisor.dispose()
    void this.closeSkillWatcher()
    void this.closeGeminiPatternWatcher()
    this.closeCsvWatcher()
    this.closeDagEditorCsvWatcher()
    for (const timer of this.observabilitySubscribers.values()) {
      clearInterval(timer)
    }
    this.observabilitySubscribers.clear()
    for (const subscriber of this.flowEventSubscribers.values()) {
      clearInterval(subscriber.timer)
    }
    this.flowEventSubscribers.clear()
    for (const child of this.csvPythonChildren.values()) {
      if (!child.killed) child.kill()
    }
    this.csvPythonChildren.clear()
    for (const child of this.claudeStreamJsonRestartChildren.values()) {
      if (!child.killed) child.kill()
    }
    this.claudeStreamJsonRestartChildren.clear()
    for (const socket of this.csvPythonControlSockets.values()) {
      socket.destroy()
    }
    this.csvPythonControlSockets.clear()
    for (const server of this.csvPythonPipeServers.values()) {
      server.close()
    }
    this.csvPythonPipeServers.clear()
    this.misreportLogger.close()
    this.stopTopologySnapshotter()
    this.flowBuilder.close()
  }

  listFeatureFlags() {
    return assertFeatureFlagRegistry(R8_FEATURE_FLAGS).map(flag => ({
      ...flag,
      effectiveEnabled: this.isFeatureEnabled(flag.name)
    }))
  }

  getFeatureFlag(flag: FeatureFlagName): boolean {
    return this.isFeatureEnabled(featureFlagNameSchema.parse(flag))
  }

  setFeatureFlag(input: { flag: FeatureFlagName; value: boolean; confirmedBy?: string }) {
    const flag = featureFlagNameSchema.parse(input.flag)
    const overrides = this.getFeatureOverrides()
    overrides[flag] = Boolean(input.value)
    this.store.set('featureOverrides', overrides)
    if (flag === 'R8.C.topology.global') this.syncTopologySnapshotter()
    return { flag, value: overrides[flag], confirmedBy: input.confirmedBy ?? null }
  }

  getTaskQueueStorageStatus() {
    const engine = this.resolveTaskQueueEngine()
    const sqliteReport = this.taskQueueSqliteStore?.report() ?? null
    const backend: QueueStorageBackend = this.taskQueueSqliteStore ? 'sqlite-kv-indexed' : 'electron-store'
    const nativeBetterQueueAvailable = this.isPackageAvailable('better-queue')
    const nativeBetterQueueSqliteAvailable = this.isPackageAvailable('better-queue-sqlite')
    const nativeSqlite3Available = this.isPackageAvailable('sqlite3')
    return taskQueueStorageStatusSchema.parse({
      flag: 'R8.C.task.queue.engine',
      engine,
      allowedEngines: ['better-queue', 'p-queue'],
      backend,
      sqlitePath: sqliteReport?.dbPath ?? null,
      sqliteIntegrity: sqliteReport
        ? {
            status: sqliteReport.status,
            checkedAt: sqliteReport.checkedAt,
            backupPath: sqliteReport.backupPath,
            error: sqliteReport.error
          }
        : {
            status: 'not-applicable',
            checkedAt: null,
            backupPath: null,
            error: null
          },
      nativeBetterQueueAvailable,
      nativeBetterQueueSqliteAvailable,
      nativeSqlite3Available,
      switchRequiresRestart: true,
      warning: this.taskQueueStorageWarning(engine, backend, nativeBetterQueueAvailable, nativeBetterQueueSqliteAvailable, nativeSqlite3Available)
    })
  }

  setTaskQueueEngine(input: { engine: TaskQueueEngine; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const engine = taskQueueEngineSchema.parse(input.engine)
    this.store.set('taskQueueEngine', engine)
    const overrides = this.getFeatureOverrides()
    overrides['R8.C.task.queue.engine'] = engine === 'better-queue'
    this.store.set('featureOverrides', overrides)
    auditLogger.log('task:queue-engine-select', {
      flag: 'R8.C.task.queue.engine',
      engine,
      confirmedBy: input.confirmedBy,
      switchRequiresRestart: true
    }, 'success')
    return this.getTaskQueueStorageStatus()
  }

  healthCheck() {
    const flags = assertFeatureFlagRegistry(R8_FEATURE_FLAGS)
    const channels = assertR8IpcRegistry(R8_IPC_CHANNELS)
    return {
      checkedAt: Date.now(),
      featureFlags: flags.length,
      ipcChannels: channels.length,
      schemas: this.schemaRegistry.count(),
      popouts: this.listPopouts().length,
      stores: ['devhub-config', 'devhub-r8-runtime']
    }
  }

  listIpcChannels(): R8IpcChannelDefinition[] {
    return assertR8IpcRegistry(R8_IPC_CHANNELS)
  }

  listRateLimitChannels() {
    registerR8RateLimitChannels(this.listIpcChannels())
    return listRateLimitChannelRegistrations()
  }

  listSchemas(): ZodListSchemasResponse {
    return zodListSchemasResponseSchema.parse(this.schemaRegistry.listSchemas())
  }


  invokeContractOnlyChannel(input: { channel: string; payload?: unknown; confirmedBy?: string }): R8ContractOnlyResponse {
    const definition = this.listIpcChannels().find(item => item.channel === input.channel)
    const checkedAt = Date.now()

    if (!definition) {
      return r8ContractOnlyResponseSchema.parse({
        success: false,
        status: 'not-registered',
        code: 'E_R8_CHANNEL_NOT_REGISTERED',
        channel: input.channel,
        executable: false,
        checkedAt,
        payload: redacted(input.payload),
        message: 'R8 IPC channel is not registered in the runtime contract.'
      })
    }

    if (definition.confirmedByRequired && (!input.confirmedBy || input.confirmedBy.length < 3)) {
      return r8ContractOnlyResponseSchema.parse({
        success: false,
        status: 'permission-required',
        code: 'E_PERMISSION',
        channel: definition.channel,
        namespace: definition.namespace,
        source: definition.source,
        rateClass: definition.rateClass,
        direction: definition.direction,
        featureFlag: definition.featureFlag ?? null,
        confirmedByRequired: true,
        executable: false,
        checkedAt,
        payload: redacted(input.payload),
        message: 'confirmedBy is required before this R8 contract-only operation can be inspected or promoted to an executable handler.'
      })
    }

    return r8ContractOnlyResponseSchema.parse({
      success: false,
      status: 'contract-only',
      code: 'E_R8_CONTRACT_ONLY',
      channel: definition.channel,
      namespace: definition.namespace,
      source: definition.source,
      rateClass: definition.rateClass,
      direction: definition.direction,
      featureFlag: definition.featureFlag ?? null,
      confirmedByRequired: definition.confirmedByRequired,
      executable: false,
      checkedAt,
      payload: redacted(input.payload),
      message: 'R8 IPC contract is registered, but no executable integration is installed for this channel in the current build.'
    })
  }

  validatePayload(input: { schemaName: R8RuntimeSchemaName; payload: unknown } | unknown): ZodValidatePayloadResponse {
    const request = zodValidatePayloadRequestSchema.parse(input)
    return zodValidatePayloadResponseSchema.parse(this.schemaRegistry.validatePayload(request.schemaName, request.payload))
  }

  migrationStatus(): ZodMigrationStatusResponse {
    return zodMigrationStatusResponseSchema.parse(this.schemaMigration.status())
  }

  async createPopout(input: unknown): Promise<PopoutRecord> {
    const request = popoutCreateRequestSchema.parse(input)
    this.reapStalePopouts()
    this.closeIdlePopouts()
    if (request.mode === 'browserwindow') {
      if (PANEL_POPOUT_SURFACES.has(request.surface)) {
        const existingPanelPopout = this.findLiveBrowserPopout(popout => (
          popout.mode === 'browserwindow'
          && popout.surface === request.surface
          && popout.targetId === request.targetId
        ))
        if (existingPanelPopout) {
          this.focusPopoutWindow(existingPanelPopout.windowId)
          this.touchPopoutInteraction(existingPanelPopout.windowId)
          return this.listPopouts().find(popout => popout.windowId === existingPanelPopout.windowId) ?? existingPanelPopout
        }
      }
      const liveBrowserPopouts = this.listPopouts().filter(popout => popout.mode === 'browserwindow' && this.isLivePopout(popout))
      if (liveBrowserPopouts.length >= BROWSER_POPOUT_LIMIT) throw new Error('E_RATE_LIMITED:popout browserwindow limit reached')
    }

    const createdAt = Date.now()
    const windowId = `popout-${randomUUID()}`
    const title = request.title ?? `DevHub ${request.surface} ${String(request.targetId)}`
    const displayId = request.bounds ? this.resolveDisplayIdForBounds(request.bounds, screen.getAllDisplays()) : null
    let record = browserPopoutSchema.parse({
      windowId,
      surface: request.surface,
      targetId: request.targetId,
      mode: request.mode,
      route: request.route,
      title,
      pinned: false,
      bounds: request.bounds ?? null,
      createdAt,
      lastInteractedAt: createdAt,
      lastHeartbeatAt: request.mode === 'browserwindow' ? createdAt : undefined,
      ...(displayId === null ? {} : { displayId }),
      bridgeState: 'pending'
    })
    const upsertPopoutRecord = (nextRecord: PopoutRecord) => {
      const popouts = this.listPopouts().filter(popout => popout.windowId !== windowId)
      popouts.push(nextRecord)
      this.store.set('popouts', popouts)
    }

    if (request.mode === 'browserwindow') {
      const popoutWindow = this.createBrowserPopout(record)
      this.popoutWindows.set(windowId, popoutWindow)
      popoutWindow.once('closed', () => {
        this.popoutWindows.delete(windowId)
        this.updatePopoutBridgeState(windowId, 'closed')
      })
      upsertPopoutRecord(record)
      try {
        await this.loadPopoutWindow(popoutWindow, record)
        const latestRecord = this.listPopouts().find(popout => popout.windowId === windowId)
        record = browserPopoutSchema.parse({
          ...(latestRecord ?? record),
          bridgeState: 'connected'
        })
        upsertPopoutRecord(record)
      } catch (error) {
        console.error('[popout] createPopout failed loading window', { windowId, surface: request.surface, targetId: request.targetId, mode: request.mode }, error)
        this.popoutWindows.delete(windowId)
        this.store.set('popouts', this.listPopouts().filter(popout => popout.windowId !== windowId))
        if (!popoutWindow.isDestroyed()) popoutWindow.close()
        throw error
      }
    } else {
      upsertPopoutRecord(record)
    }

    this.syncPopoutRssMonitor()
    return record
  }

  closePopout(input: { windowId: string }) {
    const windowId = String(input.windowId)
    const popoutWindow = this.popoutWindows.get(windowId)
    const existingPopout = this.listPopouts().find(popout => popout.windowId === windowId) ?? null
    this.scheduleClosedPopoutRssReleaseCheck(existingPopout, popoutWindow ?? null)
    if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.close()
    this.popoutWindows.delete(windowId)
    this.store.set('popouts', this.listPopouts().map(popout => (
      popout.windowId === windowId ? { ...popout, bridgeState: 'closed' } : popout
    )))
    this.syncPopoutRssMonitor()
    return { success: true, windowId }
  }

  listPopouts(): PopoutRecord[] {
    return asArray(this.store.get('popouts', []), item => browserPopoutSchema.parse(item))
  }

  savePortPopoutPosition(input: unknown) {
    const request = portPopoutPositionSaveRequestSchema.parse(input)
    const record = this.popoutPositionStore.set({
      port: request.port,
      position: request.position,
      size: request.size
    })
    return portPopoutPositionSaveResponseSchema.parse({
      success: true,
      port: request.port,
      position: request.position,
      size: request.size,
      updatedAt: record.updatedAt
    })
  }

  getPortPopoutPosition(input: unknown) {
    const request = portPopoutPositionGetRequestSchema.parse(input)
    const record = this.popoutPositionStore.get(request.port)
    return portPopoutPositionGetResponseSchema.parse({
      success: true,
      port: request.port,
      position: record ? { x: record.x, y: record.y } : null,
      ...(record?.w && record?.h ? { size: { width: record.w, height: record.h } } : {}),
      ...(record ? { updatedAt: record.updatedAt } : {})
    })
  }

  async openPortPopout(input: unknown) {
    const request = portPopoutOpenRequestSchema.parse(input)
    const storedPosition = this.popoutPositionStore.get(request.port)
    const hintPosition = request.hintPosition ?? request.hint_position
    const position = hintPosition ?? (storedPosition ? { x: storedPosition.x, y: storedPosition.y } : { x: 24, y: 24 })
    const size = request.size ?? (
      storedPosition?.w && storedPosition?.h
        ? { width: storedPosition.w, height: storedPosition.h }
        : { width: PORT_POPOUT_LIMITS.CARD_DEFAULT_W, height: PORT_POPOUT_LIMITS.CARD_DEFAULT_H }
    )
    const bounds = {
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: Math.round(size.width),
      height: Math.round(size.height)
    }
    const popout = await this.createPopout({
      surface: 'port',
      targetId: this.formatPortPopoutTarget(request.port, request.pid),
      mode: request.mode,
      route: '/monitor',
      bounds,
      title: `Port ${request.port} / PID ${request.pid}`
    })

    return portPopoutOpenResponseSchema.parse({
      ...this.toPortPopoutRuntimeRecord(popout, {
        pid: request.pid,
        trigger: request.trigger,
        position,
        size
      }),
      success: true
    })
  }

  closePortPopout(input: unknown) {
    const request = portPopoutCloseRequestSchema.parse(input)
    this.requirePortPopoutRecord(request.popoutId)
    this.closePopout({ windowId: request.popoutId })
    return portPopoutCloseResponseSchema.parse({
      success: true,
      popoutId: request.popoutId,
      reason: request.reason,
      closedAt: Date.now()
    })
  }

  listPortPopouts() {
    return portPopoutListResponseSchema.parse({
      success: true,
      popouts: this.getActivePortPopoutRecords().map(({ popout }) => this.toPortPopoutRuntimeRecord(popout)),
      listedAt: Date.now()
    })
  }

  pinPortPopout(input: unknown) {
    const request = portPopoutPinRequestSchema.parse(input)
    this.requirePortPopoutRecord(request.popoutId)
    const popout = this.pinPopout({ windowId: request.popoutId, pinned: request.pinned })
    return portPopoutPinResponseSchema.parse({
      success: true,
      popoutId: request.popoutId,
      pinned: request.pinned,
      popout: popout ? this.toPortPopoutRuntimeRecord(popout) : null,
      updatedAt: Date.now()
    })
  }

  batchPortPopouts(input: unknown) {
    const request = portPopoutBatchRequestSchema.parse(input)
    const results = request.operations.map(operation => {
      try {
        if (operation.action === 'close') {
          this.closePortPopout({ popoutId: operation.popoutId, reason: 'force' })
        } else {
          this.pinPortPopout({ popoutId: operation.popoutId, pinned: operation.action === 'pin' })
        }
        return { popoutId: operation.popoutId, action: operation.action, success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { popoutId: operation.popoutId, action: operation.action, success: false, message }
      }
    })

    return portPopoutBatchResponseSchema.parse({
      success: results.every(result => result.success),
      confirmedBy: request.confirmedBy,
      results,
      completedAt: Date.now()
    })
  }

  syncPortPopout(input: unknown) {
    const request = portPopoutSyncRequestSchema.parse(input)
    this.requirePortPopoutRecord(request.popoutId)
    const message = popoutBridgeMessageSchema.parse({
      windowId: request.popoutId,
      type: 'sync',
      key: request.key,
      value: request.value
    })
    if (message.type !== 'sync') throw new Error('E_VALIDATION:port popout sync message')
    const result = this.broadcastPopoutSyncMessage(message)

    return portPopoutSyncResponseSchema.parse({
      success: true,
      popoutId: request.popoutId,
      key: request.key,
      sentWindowIds: result.sentWindowIds,
      syncedAt: Date.now()
    })
  }

  async demotePortPopout(input: unknown) {
    const request = portPopoutDemoteRequestSchema.parse(input)
    const existing = this.requirePortPopoutRecord(request.popoutId)
    if (existing.popout.mode !== 'browserwindow') {
      throw new Error('E_VALIDATION:port popout is not a BrowserWindow')
    }
    const demoted = await this.demotePopout({ windowId: request.popoutId })

    return portPopoutDemoteResponseSchema.parse({
      success: true,
      popoutId: request.popoutId,
      floatingId: demoted.floatingId,
      popout: this.toPortPopoutRuntimeRecord(demoted.popout),
      demotedAt: Date.now()
    })
  }

  pinPopout(input: { windowId: string; pinned: boolean }) {
    const windowId = String(input.windowId)
    const pinned = Boolean(input.pinned)
    const updatedAt = Date.now()
    const popoutWindow = this.popoutWindows.get(windowId)
    popoutWindow?.setAlwaysOnTop(pinned)
    const popouts = this.listPopouts().map(popout => (
      popout.windowId === windowId ? { ...popout, pinned, lastInteractedAt: updatedAt } : popout
    ))
    this.store.set('popouts', popouts)
    void this.closeRssHeavyPopouts({ now: updatedAt })
    return popouts.find(popout => popout.windowId === windowId) ?? null
  }

  savePopoutBounds(input: { windowId: string; bounds: { x: number; y: number; width: number; height: number } }) {
    const windowId = String(input.windowId)
    const updatedAt = Date.now()
    const bounds = {
      x: Math.round(input.bounds.x),
      y: Math.round(input.bounds.y),
      width: Math.max(280, Math.round(input.bounds.width)),
      height: Math.max(200, Math.round(input.bounds.height))
    }
    const popoutWindow = this.popoutWindows.get(windowId)
    if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.setBounds(bounds)
    const displayId = this.resolveDisplayIdForBounds(bounds, screen.getAllDisplays())
    const popouts = this.listPopouts().map(popout => (
      popout.windowId === windowId
        ? browserPopoutSchema.parse({
          ...popout,
          bounds,
          displayId: displayId ?? undefined,
          pendingRestoreBounds: undefined,
          pendingRestoreDisplayId: undefined,
          displayMigratedAt: undefined,
          lastInteractedAt: updatedAt
        })
        : popout
    ))
    this.store.set('popouts', popouts)
    return { success: true, windowId, bounds }
  }

  movePopoutToMonitor(input: { windowId: string; monitorIndex: number }) {
    const displays = screen.getAllDisplays()
    const display = displays[input.monitorIndex]
    if (!display) throw new Error('E_VALIDATION:monitor index is unavailable')
    const existing = this.listPopouts().find(popout => popout.windowId === input.windowId)
    if (!existing) throw new Error('E_NOT_FOUND:popout')
    const bounds = {
      x: display.workArea.x + 24,
      y: display.workArea.y + 24,
      width: existing.bounds?.width ?? 520,
      height: existing.bounds?.height ?? 640
    }
    const saved = this.savePopoutBounds({ windowId: input.windowId, bounds })
    return { ...saved, monitorIndex: input.monitorIndex }
  }

  async promotePopoutFromFloating(input: { floatingId: string; bounds?: { x: number; y: number; width: number; height: number }; alwaysOnTop?: boolean }) {
    const existing = this.listPopouts().find(popout => popout.windowId === input.floatingId)
    if (existing) this.closePopout({ windowId: existing.windowId })
    const popout = await this.createPopout({
      surface: existing?.surface ?? 'port',
      targetId: existing?.targetId ?? input.floatingId,
      mode: 'browserwindow',
      route: existing?.route ?? '/monitor',
      bounds: input.bounds ?? existing?.bounds ?? undefined,
      title: existing?.title ?? 'DevHub Popout'
    })
    // 0525 R2: "悬浮" always implies setAlwaysOnTop=true
    this.pinPopout({ windowId: popout.windowId, pinned: true })
    return { success: true, browserPopoutId: popout.windowId, popout }
  }

  async demotePopout(input: { windowId: string }) {
    const existing = this.listPopouts().find(popout => popout.windowId === input.windowId)
    if (!existing) throw new Error('E_NOT_FOUND:popout')
    this.closePopout({ windowId: existing.windowId })
    const floating = await this.createPopout({
      surface: existing.surface,
      targetId: existing.targetId,
      mode: 'floating',
      route: existing.route,
      bounds: existing.bounds ?? undefined,
      title: existing.title
    })
    return { success: true, floatingId: floating.windowId, popout: floating }
  }

  handlePopoutBridgeMessage(input: unknown) {
    const message = popoutBridgeMessageSchema.parse(input)

    if (message.type === 'heartbeat') {
      return this.recordPopoutHeartbeat({ windowId: message.windowId, at: message.at })
    }

    if (message.type === 'close-request') {
      this.touchPopoutInteraction(message.windowId)
      return this.closePopout({ windowId: message.windowId })
    }

    if (message.type === 'demote-request') {
      this.touchPopoutInteraction(message.windowId)
      return this.demotePopout({ windowId: message.windowId })
    }

    if (message.type === 'focus-main') {
      this.touchPopoutInteraction(message.windowId)
      const mainWindow = this.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
        return { success: true, windowId: message.windowId, type: message.type }
      }
      return { success: false, windowId: message.windowId, type: message.type }
    }

    if (message.type === 'sync') {
      return this.broadcastPopoutSyncMessage(message)
    }

    const mainWindow = this.getMainWindow()
    this.touchPopoutInteraction(message.windowId)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('popout:bridge-message', message)
      return { success: true, windowId: message.windowId, type: message.type }
    }
    return { success: false, windowId: message.windowId, type: message.type }
  }

  broadcastPopoutThemeSettings(settings: ReturnType<AppStore['getSettings']>, input: { now?: number } = {}) {
    const emittedAt = Math.max(0, Math.round(input.now ?? Date.now()))
    const payload = popoutThemeSyncPayloadSchema.parse({ emittedAt, settings })
    const sentWindowIds: string[] = []

    for (const popout of this.listPopouts()) {
      if (popout.mode !== 'browserwindow' || popout.bridgeState === 'closed') continue
      const popoutWindow = this.popoutWindows.get(popout.windowId)
      if (!popoutWindow || popoutWindow.isDestroyed()) continue
      const message = popoutBridgeMessageSchema.parse({
        windowId: popout.windowId,
        type: 'sync',
        key: 'theme-settings',
        value: payload
      })
      popoutWindow.webContents.send('popout:bridge-message', message)
      sentWindowIds.push(popout.windowId)
    }

    return { success: true, sentWindowIds, emittedAt }
  }

  broadcastPopoutSyncMessage(message: ReturnType<typeof popoutBridgeMessageSchema.parse> & { type: 'sync' }) {
    this.touchPopoutInteraction(message.windowId)
    const knownPopout = this.listPopouts().some(popout => popout.windowId === message.windowId)
    const mainWindow = this.getMainWindow()
    const sentWindowIds: string[] = []

    if (knownPopout && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('popout:bridge-message', message)
      sentWindowIds.push('main')
    }

    for (const popout of this.listPopouts()) {
      if (popout.mode !== 'browserwindow' || popout.bridgeState === 'closed') continue
      if (knownPopout && popout.windowId === message.windowId) continue
      const popoutWindow = this.popoutWindows.get(popout.windowId)
      if (!popoutWindow || popoutWindow.isDestroyed()) continue
      popoutWindow.webContents.send('popout:bridge-message', message)
      sentWindowIds.push(popout.windowId)
    }

    return { success: true, windowId: message.windowId, type: message.type, sentWindowIds }
  }

  recordPopoutHeartbeat(input: { windowId: string; at?: number }) {
    const heartbeatAt = Math.max(0, Math.round(input.at ?? Date.now()))
    const existing = this.listPopouts().find(popout => popout.windowId === input.windowId)
    if (!existing) throw new Error('E_NOT_FOUND:popout')
    if (existing.mode !== 'browserwindow') throw new Error('E_VALIDATION:heartbeat is only valid for browserwindow popouts')
    const updated = browserPopoutSchema.parse({
      ...existing,
      bridgeState: 'connected',
      lastHeartbeatAt: heartbeatAt
    })
    this.store.set('popouts', this.listPopouts().map(popout => (
      popout.windowId === input.windowId ? updated : popout
    )))
    return { success: true, windowId: input.windowId, heartbeatAt, bridgeState: updated.bridgeState }
  }

  reapStalePopouts(input: { now?: number; timeoutMs?: number } = {}) {
    const now = Math.max(0, Math.round(input.now ?? Date.now()))
    const timeoutMs = Math.max(1_000, Math.round(input.timeoutMs ?? BROWSER_POPOUT_HEARTBEAT_TIMEOUT_MS))
    const closedWindowIds: string[] = []
    const popouts = this.listPopouts().map(popout => {
      if (popout.mode !== 'browserwindow' || popout.bridgeState === 'closed' || !popout.lastHeartbeatAt) return popout
      if (now - popout.lastHeartbeatAt <= timeoutMs) return popout

      const popoutWindow = this.popoutWindows.get(popout.windowId)
      if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.close()
      this.popoutWindows.delete(popout.windowId)
      closedWindowIds.push(popout.windowId)
      return browserPopoutSchema.parse({
        ...popout,
        bridgeState: 'closed',
        closedAt: now
      })
    })
    if (closedWindowIds.length > 0) this.store.set('popouts', popouts)
    this.syncPopoutRssMonitor()
    return { success: true, closedWindowIds, closedAt: now, timeoutMs }
  }

  async restorePinnedPopouts(input: { now?: number } = {}) {
    const restoredAt = Math.max(0, Math.round(input.now ?? Date.now()))
    const restoredWindowIds: string[] = []
    const skipped: Array<{ windowId: string; reason: string }> = []

    for (const popout of this.listPopouts()) {
      if (popout.mode !== 'browserwindow' || !popout.pinned || popout.bridgeState === 'closed') continue
      if (this.isLivePopout(popout)) {
        skipped.push({ windowId: popout.windowId, reason: 'already-live' })
        continue
      }

      const restoredRecord = browserPopoutSchema.parse({
        ...popout,
        bridgeState: 'pending',
        restoredAt,
        lastHeartbeatAt: restoredAt
      })
      const popoutWindow = this.createBrowserPopout(restoredRecord)
      this.popoutWindows.set(restoredRecord.windowId, popoutWindow)
      popoutWindow.once('closed', () => {
        this.popoutWindows.delete(restoredRecord.windowId)
        this.updatePopoutBridgeState(restoredRecord.windowId, 'closed')
      })

      try {
        await this.loadPopoutWindow(popoutWindow, restoredRecord)
        this.upsertPopoutRecord(browserPopoutSchema.parse({
          ...restoredRecord,
          bridgeState: 'connected'
        }))
        restoredWindowIds.push(restoredRecord.windowId)
      } catch (error) {
        if (!popoutWindow.isDestroyed()) popoutWindow.close()
        this.upsertPopoutRecord(browserPopoutSchema.parse({
          ...restoredRecord,
          bridgeState: 'closed',
          closedAt: restoredAt
        }))
        skipped.push({ windowId: restoredRecord.windowId, reason: error instanceof Error ? error.message : String(error) })
      }
    }

    this.syncPopoutRssMonitor()
    return { success: true, restoredWindowIds, skipped, restoredAt }
  }

  closeUnpinnedPopoutsForMainWindowClose(input: { now?: number } = {}) {
    const closedAt = Math.max(0, Math.round(input.now ?? Date.now()))
    const closedWindowIds: string[] = []
    const survivingPinnedWindowIds: string[] = []
    const popouts = this.listPopouts().map(popout => {
      if (popout.mode !== 'browserwindow' || popout.bridgeState === 'closed') return popout
      const popoutWindow = this.popoutWindows.get(popout.windowId)
      if (popout.surface === 'monitor' && popout.targetId === 'r8-monitor') return popout
      if (popout.pinned) {
        survivingPinnedWindowIds.push(popout.windowId)
        if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.setAlwaysOnTop(true)
        return popout
      }

      if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.close()
      this.popoutWindows.delete(popout.windowId)
      closedWindowIds.push(popout.windowId)
      return browserPopoutSchema.parse({
        ...popout,
        bridgeState: 'closed',
        closedAt
      })
    })
    if (closedWindowIds.length > 0) this.store.set('popouts', popouts)
    this.syncPopoutRssMonitor()
    return { success: true, closedWindowIds, survivingPinnedWindowIds, closedAt }
  }

  reflowPopoutsForDisplayChange(input: { type: PopoutScreenEvent['type']; now?: number }) {
    const emittedAt = Math.max(0, Math.round(input.now ?? Date.now()))
    const displays = screen.getAllDisplays()
    const primaryDisplay = displays[0] ?? null
    const affectedPopouts: string[] = []
    let migratedCount = 0
    let restoredCount = 0

    if (!primaryDisplay) {
      return popoutScreenEventSchema.parse({
        type: input.type,
        affectedPopouts,
        reflowAction: 'noop',
        emittedAt
      })
    }

    const popouts = this.listPopouts().map(popout => {
      if (popout.mode !== 'browserwindow' || popout.bridgeState === 'closed') return popout
      const restoreBounds = this.resolvePendingRestoreBounds(popout, displays)
      if (restoreBounds) {
        const displayId = this.resolveDisplayIdForBounds(restoreBounds, displays)
        const popoutWindow = this.popoutWindows.get(popout.windowId)
        if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.setBounds(restoreBounds)
        affectedPopouts.push(popout.windowId)
        restoredCount += 1
        return browserPopoutSchema.parse({
          ...popout,
          bounds: restoreBounds,
          displayId: displayId ?? popout.pendingRestoreDisplayId ?? undefined,
          pendingRestoreBounds: undefined,
          pendingRestoreDisplayId: undefined,
          displayMigratedAt: undefined
        })
      }
      if (!this.shouldMigratePopoutToPrimary(popout, displays)) return popout

      const bounds = {
        x: primaryDisplay.workArea.x + 24,
        y: primaryDisplay.workArea.y + 24,
        width: popout.bounds?.width ?? 520,
        height: popout.bounds?.height ?? 640
      }
      const pendingRestoreBounds = popout.pendingRestoreBounds ?? popout.bounds ?? undefined
      const pendingRestoreDisplayId = popout.pendingRestoreDisplayId ?? popout.displayId
      const popoutWindow = this.popoutWindows.get(popout.windowId)
      if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.setBounds(bounds)
      affectedPopouts.push(popout.windowId)
      migratedCount += 1
      return browserPopoutSchema.parse({
        ...popout,
        bounds,
        displayId: primaryDisplay.id,
        pendingRestoreBounds,
        pendingRestoreDisplayId,
        displayMigratedAt: emittedAt
      })
    })

    if (affectedPopouts.length > 0) this.store.set('popouts', popouts)
    const event = popoutScreenEventSchema.parse({
      type: input.type,
      affectedPopouts,
      reflowAction: restoredCount > 0 ? 'restore' : migratedCount > 0 ? 'migrate-to-primary' : 'noop',
      emittedAt
    })
    this.emitPopoutScreenEvent(event)
    return event
  }

  closeIdlePopouts(input: { now?: number; idleMs?: number } = {}) {
    const closedAt = Math.max(0, Math.round(input.now ?? Date.now()))
    const idleMs = Math.max(60_000, Math.round(input.idleMs ?? BROWSER_POPOUT_IDLE_AUTO_CLOSE_MS))
    const closedWindowIds: string[] = []
    const popouts = this.listPopouts().map(popout => {
      if (popout.mode !== 'browserwindow' || popout.bridgeState === 'closed' || popout.pinned) return popout
      const lastInteractedAt = popout.lastInteractedAt ?? popout.createdAt
      if (closedAt - lastInteractedAt <= idleMs) return popout

      const popoutWindow = this.popoutWindows.get(popout.windowId)
      if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.close()
      this.popoutWindows.delete(popout.windowId)
      closedWindowIds.push(popout.windowId)
      return browserPopoutSchema.parse({
        ...popout,
        bridgeState: 'closed',
        closedAt
      })
    })
    if (closedWindowIds.length > 0) this.store.set('popouts', popouts)
    this.syncPopoutRssMonitor()
    return { success: true, closedWindowIds, closedAt, idleMs }
  }

  closeRssHeavyPopouts(input: { now?: number; appMetrics?: readonly ProcessMetric[]; popoutRssByWindowId?: Record<string, number> } = {}) {
    const closedAt = Math.max(0, Math.round(input.now ?? Date.now()))
    const appMetrics = input.appMetrics ?? this.getAppMetricsSnapshot()
    const popouts = this.listPopouts()
      .filter(popout => popout.mode === 'browserwindow' && this.isLivePopout(popout))
      .map(popout => {
        const rssOverride = input.popoutRssByWindowId?.[popout.windowId]
        if (typeof rssOverride === 'number' && Number.isFinite(rssOverride) && rssOverride >= 0) {
          return { popout, rssMb: Math.round(rssOverride) }
        }

        const popoutWindow = this.popoutWindows.get(popout.windowId)
        const pid = this.resolveBrowserWindowProcessId(popoutWindow)
        return { popout, rssMb: pid == null ? 0 : (this.readProcessRssMb(pid, appMetrics) ?? 0) }
      })
      .sort((left, right) => {
        const leftPinned = left.popout.pinned ? 1 : 0
        const rightPinned = right.popout.pinned ? 1 : 0
        if (leftPinned !== rightPinned) return leftPinned - rightPinned
        const leftInteracted = left.popout.lastInteractedAt ?? left.popout.createdAt
        const rightInteracted = right.popout.lastInteractedAt ?? right.popout.createdAt
        if (leftInteracted !== rightInteracted) return leftInteracted - rightInteracted
        return right.rssMb - left.rssMb
      })

    const perPopoutLimitMb = PORT_POPOUT_LIMITS.RSS_PER_POPOUT_MB
    const totalLimitMb = PORT_POPOUT_LIMITS.RSS_TOTAL_MB
    let totalRssMb = popouts.reduce((sum, item) => sum + item.rssMb, 0)
    const closedWindowIds: string[] = []
    const blockedWindowIds: string[] = []
    const degradedWindowIds: string[] = []
    const degradePopoutWindow = (windowId: string): void => {
      if (!degradedWindowIds.includes(windowId)) degradedWindowIds.push(windowId)
      const popoutWindow = this.popoutWindows.get(windowId)
      const canMinimize = popoutWindow
        && !popoutWindow.isDestroyed()
        && typeof popoutWindow.minimize === 'function'
      if (!canMinimize) return
      const isMinimized = typeof popoutWindow.isMinimized === 'function' ? popoutWindow.isMinimized() : false
      if (!isMinimized) popoutWindow.minimize()
    }

    for (const item of popouts) {
      const exceedsPerPopoutLimit = item.rssMb > perPopoutLimitMb
      const exceedsTotalLimit = totalRssMb > totalLimitMb
      const lastInteractedAt = item.popout.lastInteractedAt ?? item.popout.createdAt
      const isFresh = closedAt - lastInteractedAt < BROWSER_POPOUT_RSS_DEGRADE_GRACE_MS

      if (exceedsPerPopoutLimit && !exceedsTotalLimit) {
        if (isFresh) {
          degradedWindowIds.push(item.popout.windowId)
          continue
        }
        degradePopoutWindow(item.popout.windowId)
        continue
      }
      if (!exceedsTotalLimit) continue
      if (item.popout.pinned) {
        blockedWindowIds.push(item.popout.windowId)
        if (!isFresh) degradePopoutWindow(item.popout.windowId)
        continue
      }
      if (isFresh) {
        degradePopoutWindow(item.popout.windowId)
        continue
      }

      this.closePopout({ windowId: item.popout.windowId })
      closedWindowIds.push(item.popout.windowId)
      totalRssMb = Math.max(0, totalRssMb - item.rssMb)
    }

    this.syncPopoutRssMonitor()
    return {
      success: true,
      closedWindowIds,
      blockedWindowIds,
      degradedWindowIds,
      closedAt,
      totalRssMb,
      perPopoutLimitMb,
      totalLimitMb
    }
  }

  private listLiveBrowserPopouts(): PopoutRecord[] {
    return this.listPopouts().filter(popout => popout.mode === 'browserwindow' && this.isLivePopout(popout))
  }

  private startPopoutRssMonitor(): void {
    if (this.popoutRssMonitorTimer) return
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) return
    if (this.listLiveBrowserPopouts().length === 0) return

    this.popoutRssMonitorTimer = setInterval(() => {
      void this.closeRssHeavyPopouts()
      if (this.listLiveBrowserPopouts().length === 0) this.stopPopoutRssMonitor()
    }, BROWSER_POPOUT_RSS_MONITOR_INTERVAL_MS)
    this.popoutRssMonitorTimer.unref?.()
  }

  private stopPopoutRssMonitor(): void {
    if (!this.popoutRssMonitorTimer) return
    clearInterval(this.popoutRssMonitorTimer)
    this.popoutRssMonitorTimer = null
  }

  private syncPopoutRssMonitor(): void {
    if (this.listLiveBrowserPopouts().length > 0) {
      this.startPopoutRssMonitor()
      return
    }

    this.stopPopoutRssMonitor()
  }

  runClosedPopoutRssReleaseCheck(input: { windowId: string; now?: number; appMetrics?: readonly ProcessMetric[] } = {} as { windowId: string }) {
    const checkedAt = Math.max(0, Math.round(input.now ?? Date.now()))
    const pending = this.closedPopoutRssChecks.get(input.windowId)
    if (!pending) {
      return {
        success: false,
        passed: false,
        windowId: input.windowId,
        pid: null,
        status: 'unknown' as const,
        reason: 'not-scheduled',
        rssBeforeMb: null,
        rssAfterMb: null,
        scheduledAt: checkedAt,
        dueAt: checkedAt,
        checkedAt
      }
    }

    if (pending.timer) clearTimeout(pending.timer)
    this.closedPopoutRssChecks.delete(input.windowId)

    const appMetrics = input.appMetrics ?? this.getAppMetricsSnapshot()
    const rssAfterMb = pending.pid == null ? null : this.readProcessRssMb(pending.pid, appMetrics)
    let status: ClosedPopoutRssReleaseStatus = 'unknown'
    let reason = 'no-process-baseline'

    if (pending.pid == null) {
      reason = 'missing-process-id'
    } else if (rssAfterMb == null) {
      status = 'released'
      reason = 'process-closed'
    } else if (pending.rssBeforeMb == null) {
      reason = 'missing-rss-baseline'
    } else if (rssAfterMb < pending.rssBeforeMb) {
      status = 'recovered'
      reason = 'rss-released'
    } else if (this.isProcessSharedByLivePopouts(pending.pid, pending.windowId)) {
      status = 'shared-process'
      reason = 'shared-process'
    } else {
      status = 'retained'
      reason = 'rss-not-released'
    }

    const result: ClosedPopoutRssReleaseResult = {
      success: true,
      passed: status !== 'retained',
      windowId: pending.windowId,
      pid: pending.pid,
      status,
      reason,
      rssBeforeMb: pending.rssBeforeMb,
      rssAfterMb,
      scheduledAt: pending.scheduledAt,
      dueAt: pending.dueAt,
      checkedAt
    }

    auditLogger.log(
      'popout:rss-release-check',
      {
        windowId: result.windowId,
        pid: result.pid,
        status: result.status,
        reason: result.reason,
        rssBeforeMb: result.rssBeforeMb,
        rssAfterMb: result.rssAfterMb,
        scheduledAt: result.scheduledAt,
        dueAt: result.dueAt,
        checkedAt: result.checkedAt
      },
      result.status === 'retained' ? 'error' : result.status === 'unknown' ? 'refused' : 'success',
      result.reason
    )

    return result
  }

  private scheduleClosedPopoutRssReleaseCheck(popout: PopoutRecord | null, popoutWindow: BrowserWindow | null): void {
    if (!popout || popout.mode !== 'browserwindow') return
    if (!this.shouldScheduleClosedPopoutRssReleaseChecks()) return
    if (!popoutWindow || popoutWindow.isDestroyed()) return

    const pid = this.resolveBrowserWindowProcessId(popoutWindow)
    const scheduledAt = Date.now()
    const pending: PendingClosedPopoutRssCheck = {
      windowId: popout.windowId,
      pid,
      rssBeforeMb: pid == null ? null : this.readProcessRssMb(pid),
      scheduledAt,
      dueAt: scheduledAt + BROWSER_POPOUT_RSS_RELEASE_CHECK_DELAY_MS,
      timer: null
    }

    const existing = this.closedPopoutRssChecks.get(popout.windowId)
    if (existing?.timer) clearTimeout(existing.timer)

    pending.timer = setTimeout(() => {
      void this.runClosedPopoutRssReleaseCheck({ windowId: popout.windowId })
    }, BROWSER_POPOUT_RSS_RELEASE_CHECK_DELAY_MS)
    pending.timer.unref?.()
    this.closedPopoutRssChecks.set(popout.windowId, pending)
  }

  private clearClosedPopoutRssReleaseChecks(): void {
    for (const pending of this.closedPopoutRssChecks.values()) {
      if (pending.timer) clearTimeout(pending.timer)
    }
    this.closedPopoutRssChecks.clear()
  }

  private shouldScheduleClosedPopoutRssReleaseChecks(): boolean {
    return process.env.NODE_ENV === 'development'
      || process.env.DEVHUB_R8_POPOUT_RSS_ASSERT === '1'
  }

  private getAppMetricsSnapshot(): readonly ProcessMetric[] {
    if (typeof app.getAppMetrics !== 'function') return []
    return app.getAppMetrics()
  }

  private resolveBrowserWindowProcessId(popoutWindow: BrowserWindow | null | undefined): number | null {
    if (!popoutWindow || popoutWindow.isDestroyed()) return null
    const webContents = popoutWindow.webContents as unknown as {
      getOSProcessId?: () => number
      getProcessId?: () => number
    }
    if (typeof webContents.getOSProcessId === 'function') return webContents.getOSProcessId()
    if (typeof webContents.getProcessId === 'function') return webContents.getProcessId()
    return null
  }

  private readProcessRssMb(pid: number, appMetrics: readonly ProcessMetric[] = this.getAppMetricsSnapshot()): number | null {
    const metric = appMetrics.find(item => item.pid === pid)
    const memory = metric?.memory
    const residentSetKb = typeof memory?.workingSetSize === 'number'
      ? memory.workingSetSize
      : typeof memory?.privateBytes === 'number'
        ? memory.privateBytes
        : null
    if (residentSetKb == null) return null
    return Math.max(0, Math.round(residentSetKb / 1024))
  }

  private isProcessSharedByLivePopouts(pid: number, excludedWindowId: string): boolean {
    return this.listLiveBrowserPopouts().some(popout => {
      if (popout.windowId === excludedWindowId) return false
      const popoutWindow = this.popoutWindows.get(popout.windowId)
      return this.resolveBrowserWindowProcessId(popoutWindow) === pid
    })
  }

  private defaultDrawerState(slot: DrawerSlot, now = Date.now()): DrawerState {
    return this.normalizeDrawerState({
      slot,
      ...DRAWER_SLOT_DEFAULTS[slot],
      updatedAt: now
    })
  }

  private normalizeDrawerState(input: unknown): DrawerState {
    const state = drawerStateSchema.parse(input)
    const limits = DRAWER_SIZE_LIMITS[state.slot]
    const rawSize = state.size ?? state.width ?? state.height ?? limits.defaultSize
    const size = Math.max(limits.min, Math.min(limits.max, Math.round(rawSize)))
    return drawerStateSchema.parse({
      ...state,
      size,
      width: state.slot === 'right' || state.slot === 'floating' ? size : undefined,
      height: state.slot === 'top' || state.slot === 'bottom' || state.slot === 'statusbar' ? size : undefined
    })
  }

  private normalizeDrawerStates(input: unknown): DrawerState[] {
    const rawStates = Array.isArray(input)
      ? input
      : DRAWER_SLOTS.map(slot => (input as Partial<Record<DrawerSlot, unknown>> | null | undefined)?.[slot]).filter(Boolean)
    const parsed = asArray(rawStates, item => this.normalizeDrawerState(item))
    const bySlot = new Map<DrawerSlot, DrawerState>(parsed.map(state => [state.slot, state]))
    return DRAWER_SLOTS.map(slot => bySlot.get(slot) ?? this.defaultDrawerState(slot))
  }

  private migrateDrawerStatesIfNeeded(states: DrawerState[]): DrawerState[] {
    const storedVersion = this.store.get('drawerLayoutVersion')
    if (storedVersion === DRAWER_LAYOUT_CURRENT_VERSION) {
      return states
    }

    const now = Date.now()
    const migrated = states.map(state => this.normalizeDrawerState({
      ...state,
      open: false,
      updatedAt: now
    }))
    this.store.set('drawers', migrated)
    this.store.set('drawerLayoutVersion', DRAWER_LAYOUT_CURRENT_VERSION)
    return migrated
  }

  getDrawerState(): DrawerState[] {
    const existing = asArray(this.store.get('drawers', []), item => this.normalizeDrawerState(item))
    if (existing.length === 0) return this.migrateDrawerStatesIfNeeded(DRAWER_SLOTS.map(slot => this.defaultDrawerState(slot)))
    const bySlot = new Map<DrawerSlot, DrawerState>(existing.map(state => [state.slot, state]))
    return this.migrateDrawerStatesIfNeeded(DRAWER_SLOTS.map(slot => bySlot.get(slot) ?? this.defaultDrawerState(slot)))
  }

  setDrawerState(input: unknown): DrawerState {
    const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
    const slot = drawerSlotSchema.parse(raw.slot)
    const existing = this.getDrawerState().find(drawer => drawer.slot === slot) ?? this.defaultDrawerState(slot)
    const state = this.normalizeDrawerState({
      ...existing,
      ...raw,
      slot,
      updatedAt: Date.now()
    })
    const next = this.getDrawerState().map(drawer => drawer.slot === state.slot ? state : drawer)
    this.store.set('drawers', next)
    return state
  }

  saveDrawerLayout(input: unknown): DrawerLayoutRecord {
    const request = drawerSaveLayoutRequestSchema.parse(input)
    const states = this.normalizeDrawerStates(request.states ?? this.getDrawerState())
    const record = drawerLayoutRecordSchema.parse({ name: request.name, states, savedAt: Date.now() })
    const layouts = { ...(this.store.get('drawerLayouts', {}) as Record<string, unknown>), [record.name]: record }
    this.store.set('drawerLayouts', layouts)
    return record
  }

  loadDrawerLayout(input: unknown): DrawerLayoutRecord {
    const request = drawerLoadLayoutRequestSchema.parse(input)
    const layouts = this.store.get('drawerLayouts', {}) as Record<string, unknown>
    const found = layouts[request.name]
    if (!found) throw new Error(`E_NOT_FOUND:drawer-layout:${request.name}`)
    const record = drawerLayoutRecordSchema.parse(found)
    const states = this.normalizeDrawerStates(record.states)
    this.store.set('drawers', states)
    return drawerLayoutRecordSchema.parse({ ...record, states })
  }

  listDrawerLayouts(): DrawerLayoutRecord[] {
    const layouts = this.store.get('drawerLayouts', {}) as Record<string, unknown>
    return Object.values(layouts).map(layout => drawerLayoutRecordSchema.parse(layout))
  }

  async morphDrawerToPopout(input: unknown) {
    const request = drawerMorphToPopoutRequestSchema.parse(input)
    const current = this.getDrawerState().find(drawer => drawer.slot === request.slot)
    const contentId = request.contentId ?? current?.contentId
    if (!contentId) throw new Error('E_VALIDATION:drawer contentId is required')
    // Tear the drawer out into a REAL, visible BrowserWindow on the dedicated
    // `drawer` surface — the same mechanism the panel detach button uses. The
    // `contentId:<id>` target hydrates DrawerPopoutView inside the window so the
    // content (e.g. notifications.top) actually renders. The previous behaviour
    // created a `mode:'floating'` record with no visible host, so the drawer just
    // vanished ("can't morph to popout").
    const popout = await this.createPopout({
      surface: 'drawer',
      targetId: `contentId:${contentId}`,
      mode: 'browserwindow',
      route: '/panel/drawer',
      title: `Drawer ${contentId}`
    })
    this.setDrawerState({
      ...(current ?? this.defaultDrawerState(request.slot)),
      open: false,
      contentId
    })
    return drawerMorphToPopoutResultSchema.parse({ popoutId: popout.windowId })
  }

  morphPopoutToDrawer(input: unknown) {
    const request = drawerMorphFromPopoutRequestSchema.parse(input)
    const popout = this.listPopouts().find(item => item.windowId === request.popoutId)
    if (!popout) throw new Error('E_NOT_FOUND:popout')
    this.closePopout({ windowId: request.popoutId })
    // The drawer surface encodes its content as `contentId:<id>`; strip the prefix
    // so recalling the popout re-opens the original drawer content (legacy records
    // that stored a bare targetId still resolve to themselves).
    const rawTarget = String(popout.targetId)
    const contentId = rawTarget.startsWith('contentId:') ? rawTarget.slice('contentId:'.length) : rawTarget
    const drawerState = this.setDrawerState({
      slot: request.slot,
      open: true,
      contentId,
      scope: 'global'
    })
    return drawerMorphFromPopoutResultSchema.parse({ drawerState })
  }

  private dashboardPresetItems(name: string): DashboardGridItem[] {
    const defaultItems = dashboardGridItemSchema.array().parse([
      { i: 'widget-process-summary', widgetId: 'process-summary', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
      { i: 'widget-port-summary', widgetId: 'port-summary', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
      { i: 'widget-window-summary', widgetId: 'window-summary', x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
      { i: 'widget-ai-task-queue', widgetId: 'ai-task-queue', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
      { i: 'widget-system-resource', widgetId: 'system-resource', x: 0, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
      { i: 'widget-notifications', widgetId: 'notifications', x: 4, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
      { i: 'widget-topology-mini', widgetId: 'topology-mini', x: 8, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
      { i: 'widget-treemap-mini', widgetId: 'treemap-mini', x: 0, y: 7, w: 6, h: 4, minW: 4, minH: 3 }
    ])
    if (name === 'minimal') return defaultItems.slice(0, 4)
    if (name === 'monitor-focus') return defaultItems.filter(item => item.widgetId !== 'notifications')
    if (name === 'ai-focus') {
      return dashboardGridItemSchema.array().parse([
        { i: 'widget-ai-task-queue', widgetId: 'ai-task-queue', x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'widget-process-summary', widgetId: 'process-summary', x: 4, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
        { i: 'widget-window-summary', widgetId: 'window-summary', x: 8, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
        { i: 'widget-system-resource', widgetId: 'system-resource', x: 0, y: 4, w: 6, h: 4, minW: 3, minH: 3 },
        { i: 'widget-notifications', widgetId: 'notifications', x: 6, y: 4, w: 6, h: 4, minW: 3, minH: 3 }
      ])
    }
    return defaultItems
  }

  private adaptDashboardItems(items: DashboardGridItem[], cols: number): DashboardGridItem[] {
    let cursorX = 0
    let cursorY = 0
    let rowH = 0
    return items.map(item => {
      const w = Math.max(1, Math.min(item.w, cols))
      const h = Math.max(1, item.h)
      if (cursorX + w > cols) {
        cursorX = 0
        cursorY += Math.max(rowH, 1)
        rowH = 0
      }
      const next = dashboardGridItemSchema.parse({ ...item, x: cursorX, y: cursorY, w, h })
      cursorX += w
      rowH = Math.max(rowH, h)
      return next
    })
  }

  private defaultDashboardLayout(name = 'default'): DashboardLayout {
    const items = this.dashboardPresetItems(name)
    const layouts = Object.fromEntries(
      DASHBOARD_BREAKPOINTS.map(breakpoint => [breakpoint, this.adaptDashboardItems(items, DASHBOARD_COLS[breakpoint])])
    )
    return dashboardLayoutSchema.parse({
      name,
      layouts,
      cols: DASHBOARD_COLS,
      rowHeight: 50,
      margin: [8, 8],
      containerPadding: [8, 8],
      updatedAt: Date.now()
    })
  }

  private normalizeDashboardLayout(input: unknown, fallbackName = 'default'): DashboardLayout {
    const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
    const rawLayouts = raw.layouts && typeof raw.layouts === 'object' ? raw.layouts as Record<string, unknown> : {}
    const baseItems = this.dashboardPresetItems(typeof raw.name === 'string' ? raw.name : fallbackName)
    const layouts = Object.fromEntries(
      DASHBOARD_BREAKPOINTS.map(breakpoint => {
        const items = Array.isArray(rawLayouts[breakpoint]) ? rawLayouts[breakpoint] : this.adaptDashboardItems(baseItems, DASHBOARD_COLS[breakpoint])
        return [breakpoint, items]
      })
    )
    const layout = dashboardLayoutSchema.parse({
      ...raw,
      name: typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name : fallbackName,
      layouts,
      cols: raw.cols ?? DASHBOARD_COLS,
      updatedAt: Date.now()
    })
    const widgetCount = new Set(DASHBOARD_BREAKPOINTS.flatMap(breakpoint => layout.layouts[breakpoint].map(item => item.i))).size
    if (widgetCount > 32) throw new Error('E_RATE_LIMITED:dashboard widget limit exceeded')
    return layout
  }

  getDashboardLayout(input?: unknown) {
    const request = dashboardGetLayoutRequestSchema.parse(input ?? {})
    const name = request.name ?? 'default'
    const layouts = this.store.get('dashboardLayouts', {}) as Record<string, unknown>
    const existing = layouts[name]
    const layout = existing ? this.normalizeDashboardLayout(existing, name) : this.defaultDashboardLayout(name)
    return dashboardLayoutResponseSchema.parse({ layout })
  }

  saveDashboardLayout(input: unknown) {
    const layout = this.normalizeDashboardLayout(input)
    const layouts = { ...(this.store.get('dashboardLayouts', {}) as Record<string, unknown>), [layout.name]: layout }
    this.store.set('dashboardLayouts', layouts)
    return dashboardSaveLayoutResultSchema.parse({ success: true, layout })
  }

  listDashboardPresets() {
    const layouts = this.store.get('dashboardLayouts', {}) as Record<string, unknown>
    return dashboardListPresetsResponseSchema.parse({
      names: [...new Set([...DASHBOARD_PRESETS, ...Object.keys(layouts)])].sort()
    })
  }

  deleteDashboardPreset(input: unknown) {
    const request = dashboardDeletePresetRequestSchema.parse(input)
    if ((DASHBOARD_PRESETS as readonly string[]).includes(request.name)) throw new Error(`E_VALIDATION:cannot delete built-in dashboard preset:${request.name}`)
    const layouts = { ...(this.store.get('dashboardLayouts', {}) as Record<string, unknown>) }
    delete layouts[request.name]
    this.store.set('dashboardLayouts', layouts)
    return { success: true, name: request.name }
  }

  resetDashboardLayout(input?: unknown) {
    const request = dashboardResetRequestSchema.parse(input ?? {})
    const layout = this.defaultDashboardLayout(request.preset ?? 'default')
    const layouts = { ...(this.store.get('dashboardLayouts', {}) as Record<string, unknown>), [layout.name]: layout }
    this.store.set('dashboardLayouts', layouts)
    return dashboardLayoutResponseSchema.parse({ layout })
  }

  morphDashboardWidgetToDrawer(input: unknown) {
    const request = dashboardMorphWidgetToDrawerRequestSchema.parse(input)
    const layout = this.getDashboardLayout({ name: 'default' }).layout
    const widget = DASHBOARD_BREAKPOINTS
      .flatMap(breakpoint => layout.layouts[breakpoint])
      .find(item => item.i === request.widgetInstanceId)
    if (!widget) throw new Error(`E_NOT_FOUND:dashboard-widget:${request.widgetInstanceId}`)
    const nextLayout = dashboardLayoutSchema.parse({
      ...layout,
      layouts: Object.fromEntries(
        DASHBOARD_BREAKPOINTS.map(breakpoint => [
          breakpoint,
          layout.layouts[breakpoint].filter(item => item.i !== request.widgetInstanceId)
        ])
      ),
      updatedAt: Date.now()
    })
    this.saveDashboardLayout(nextLayout)
    const drawerState = this.setDrawerState({
      slot: request.slot,
      open: true,
      pinned: true,
      contentId: DASHBOARD_WIDGET_DRAWER_CONTENT[widget.widgetId] ?? `dashboard.${widget.widgetId}`,
      scope: 'global'
    })
    return dashboardMorphWidgetToDrawerResultSchema.parse({ drawerState, layout: nextLayout })
  }

  private processRowsForTree(): Array<Record<string, unknown>> {
    return this.scannerSnapshotRows('processes')
      .filter(row => Number.isFinite(Number(row.pid)))
      .map(row => ({
        ...row,
        pid: Number(row.pid),
        ppid: Number(row.ppid ?? row.parentPid ?? 0),
        exe: String(row.exe ?? row.name ?? row.processName ?? `pid-${row.pid}`),
        cmdline: typeof row.commandLine === 'string' ? row.commandLine : typeof row.command === 'string' ? row.command : undefined,
        rss: Math.max(0, Math.round(Number(row.rss ?? row.memory ?? row.memoryRSS ?? 0))),
        cpu: Number(row.cpu ?? row.cpuPercent ?? 0),
        isAiTool: row.type === 'ai-tool' || Boolean(row.isAiTool)
      }))
  }

  processTree(input?: unknown) {
    const request = processTreeRequestSchema.parse(input ?? {})
    const rows = this.processRowsForTree()
    const byPid = new Map(rows.map(row => [Number(row.pid), row]))
    const childMap = new Map<number, Array<Record<string, unknown>>>()
    for (const row of rows) {
      const ppid = Number(row.ppid)
      if (!childMap.has(ppid)) childMap.set(ppid, [])
      childMap.get(ppid)?.push(row)
    }
    const rootRow = request.rootPid && byPid.has(request.rootPid)
      ? byPid.get(request.rootPid)
      : { pid: 0, ppid: -1, exe: 'root', rss: rows.reduce((sum, row) => sum + Number(row.rss), 0), cpu: rows.reduce((sum, row) => sum + Number(row.cpu), 0), isAiTool: false }
    if (!rootRow) throw new Error('E_NOT_FOUND:process-root')
    const seen = new Set<number>()
    const build = (row: Record<string, unknown>, depth: number): ReturnType<typeof processTreeNodeSchema.parse> => {
      const pid = Number(row.pid)
      if (seen.has(pid) || depth > request.maxDepth) {
        return processTreeNodeSchema.parse({ ...row, children: [], expanded: false, depth })
      }
      seen.add(pid)
      const children = depth >= request.maxDepth
        ? []
        : (childMap.get(pid) ?? []).map(child => build(child, depth + 1))
      seen.delete(pid)
      return processTreeNodeSchema.parse({
        ...row,
        children,
        expanded: depth < 3,
        depth
      })
    }
    return { tree: build(rootRow, 0) }
  }

  processTreeChildren(input: unknown) {
    const request = processTreeChildrenRequestSchema.parse(input)
    const children = this.processRowsForTree()
      .filter(row => Number(row.ppid) === request.pid)
      .map(row => processTreeNodeSchema.parse({ ...row, children: [], expanded: false, depth: 1 }))
    return { children }
  }

  processTreemapData(input?: unknown) {
    const request = processTreemapDataRequestSchema.parse(input ?? {})
    const rows = this.processRowsForTree()
      .filter(row => Number(row.rss) > 0)
      .sort((left, right) => Number(right.rss) - Number(left.rss))
      .slice(0, 500)
    const totalRss = rows.reduce((sum, row) => sum + Number(row.rss), 0)
    let cursorX = 0
    const nodes = rows.map((row, index) => {
      const width = totalRss > 0 ? request.width * (Number(row.rss) / totalRss) : 0
      const node = {
        id: String(row.pid),
        pid: Number(row.pid),
        exe: String(row.exe),
        value: Number(row.rss),
        x0: cursorX,
        y0: 0,
        x1: index === rows.length - 1 ? request.width : cursorX + width,
        y1: request.height,
        depth: 1,
        parent: request.groupBy === 'parent' ? String(row.ppid) : request.groupBy === 'exe' ? String(row.exe) : request.groupBy === 'ai-tool' ? String(Boolean(row.isAiTool)) : undefined,
        color: request.colorBy === 'ai-tool' && row.isAiTool ? 'warning' : undefined
      }
      cursorX = node.x1
      return node
    })
    return {
      nodes,
      totalRss,
      width: request.width,
      height: request.height,
      groupBy: request.groupBy,
      colorBy: request.colorBy,
      truncated: this.processRowsForTree().length > 500
    }
  }

  setProcessViewMode(input: unknown) {
    const request = processViewModeSetRequestSchema.parse(input)
    this.store.set('processViewMode', request.mode)
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('r8:command-event', { type: 'process-view-mode', mode: request.mode })
    }
    return processViewModeSetResultSchema.parse({ success: true, mode: request.mode })
  }

  private scannerSnapshotRows(kind: string): Record<string, unknown>[] {
    const snapshot = this.runtime?.scannerCache?.getSnapshot?.()
    if (!snapshot || typeof snapshot !== 'object') return []
    const record = snapshot as unknown as Record<string, unknown>
    const section = record[kind]
    if (Array.isArray(section)) return section.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    if (!section || typeof section !== 'object') return []
    const data = (section as Record<string, unknown>).data
    return Array.isArray(data) ? data.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : []
  }

  private hasDirectUriTarget(kind: string, id: string): boolean {
    if (kind === 'port') {
      return this.scannerSnapshotRows('ports').some(port => String(port.port) === id)
    }
    if (kind === 'process') {
      return this.scannerSnapshotRows('processes').some(processInfo => String(processInfo.pid) === id)
    }
    if (kind === 'window') {
      return this.scannerSnapshotRows('windows').some(windowInfo => String(windowInfo.hwnd ?? windowInfo.id) === id)
    }
    if (kind === 'project') {
      const projects = this.appStore.getProjects()
      return projects.some(project => String(project.id) === id || project.name === id)
    }
    return false
  }

  private fallbackCandidateCount(kind: string, fallback: Record<string, string>): number {
    if (kind !== 'process') return 0
    const exe = fallback.exe?.toLowerCase()
    const cwd = fallback.cwd?.toLowerCase()
    if (!exe && !cwd) return 0
    return this.scannerSnapshotRows('processes').filter(processInfo => {
      const name = String(processInfo.name ?? processInfo.processName ?? '').toLowerCase()
      const workingDir = String(processInfo.workingDir ?? processInfo.cwd ?? '').toLowerCase()
      return (!exe || name === exe || name.endsWith(`/${exe}`) || name.endsWith(`\\${exe}`)) &&
        (!cwd || workingDir === cwd)
    }).length
  }

  resolveCommandUri(input: unknown) {
    const request = commandResolveUriRequestSchema.parse(input)
    const url = new URL(request.uri)
    const fallbackEntries = (url.searchParams.get('fallback') ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .flatMap(part => {
        const separatorIndex = part.indexOf(':')
        if (separatorIndex <= 0) return []
        return [[part.slice(0, separatorIndex), part.slice(separatorIndex + 1)] as const]
      })
    const parsed = commandParsedUriSchema.parse({
      scheme: url.protocol.slice(0, -1),
      scope: url.hostname,
      id: decodeURIComponent(url.pathname.replace(/^\//, '')),
      host: url.searchParams.get('host') ?? 'local',
      fallback: Object.fromEntries(fallbackEntries)
    })
    const exists = this.hasDirectUriTarget(parsed.scope, parsed.id)
    const candidateCount = exists ? 1 : this.fallbackCandidateCount(parsed.scope, parsed.fallback)
    return commandResolvedUriSchema.parse({
      kind: parsed.scope,
      id: parsed.id,
      uri: parsed,
      monitor: parsed.scope === 'port' || parsed.scope === 'process' || parsed.scope === 'window' ? 'monitor' : null,
      panel: parsed.scope,
      exists,
      fallbackUsed: !exists && candidateCount > 0,
      candidateCount
    })
  }

  registerOsProtocol(input: unknown) {
    const request = commandRegisterOsProtocolRequestSchema.parse(input)
    if (!request.confirmedBy) throw new Error('E_PERMISSION:confirmedBy required')

    const devMode = isElectronDefaultApp()
    const handlerPath = devMode && process.argv[1] ? process.execPath : null
    const handlerArgs = handlerPath ? [resolve(process.argv[1])] : []
    const action = request.register ? 'register' : 'unregister'
    let success = false
    let registered = false
    let message = ''

    try {
      success = request.register
        ? handlerPath
          ? app.setAsDefaultProtocolClient(DEVHUB_OS_PROTOCOL_SCHEME, handlerPath, handlerArgs)
          : app.setAsDefaultProtocolClient(DEVHUB_OS_PROTOCOL_SCHEME)
        : handlerPath
          ? app.removeAsDefaultProtocolClient(DEVHUB_OS_PROTOCOL_SCHEME, handlerPath, handlerArgs)
          : app.removeAsDefaultProtocolClient(DEVHUB_OS_PROTOCOL_SCHEME)

      registered = handlerPath
        ? app.isDefaultProtocolClient(DEVHUB_OS_PROTOCOL_SCHEME, handlerPath, handlerArgs)
        : app.isDefaultProtocolClient(DEVHUB_OS_PROTOCOL_SCHEME)
      message = success
        ? request.register ? 'devhub:// protocol registration requested.' : 'devhub:// protocol unregistration requested.'
        : request.register ? 'Electron did not accept devhub:// protocol registration.' : 'Electron did not accept devhub:// protocol unregistration.'
    } catch (error) {
      success = false
      registered = false
      message = error instanceof Error ? error.message : String(error)
    }

    return commandRegisterOsProtocolResultSchema.parse({
      success,
      registered,
      scheme: DEVHUB_OS_PROTOCOL_SCHEME,
      action,
      checkedAt: Date.now(),
      devMode,
      platform: process.platform,
      handlerPath,
      handlerArgs,
      message
    })
  }

  listCommands() {
    const builtInCommands = [
      commandPaletteEntrySchema.parse({ id: 'monitor.process', title: 'Open process monitor', category: 'navigation', description: 'Show running processes and runtime health' }),
      commandPaletteEntrySchema.parse({ id: 'monitor.port', title: 'Open port monitor', category: 'navigation', description: 'Show listening ports and conflict signals' }),
      commandPaletteEntrySchema.parse({ id: 'monitor.window', title: 'Open window manager', category: 'navigation', description: 'Show tracked windows and layouts' }),
      commandPaletteEntrySchema.parse({ id: 'monitor.ai-task', title: 'Open AI tasks', category: 'monitor', description: 'Review AI task progress and recording state' }),
      commandPaletteEntrySchema.parse({ id: 'monitor.topology', title: 'Open topology tab', category: 'navigation', description: 'Switch the system monitor to its topology tab' }),
      commandPaletteEntrySchema.parse({ id: 'monitor.r8-ops', title: 'Open R8 ops tab', category: 'monitor', description: 'Switch the system monitor to its R8 operations tab' }),
      commandPaletteEntrySchema.parse({ id: 'ai.tasks.open', title: 'Open AI task actions', category: 'ai-action', description: 'Jump to the live AI task monitor from the AI command scope', keywords: ['ai', 'assistant', 'codex', 'claude', 'gemini', 'monitor'], scope: 'monitor' }),
      commandPaletteEntrySchema.parse({ id: 'settings.open', title: 'Open settings', category: 'settings', description: 'Open the DevHub settings dialog', keywords: ['settings', 'preferences', 'advanced'] }),
      commandPaletteEntrySchema.parse({ id: 'popout.port', title: '打开端口 BrowserWindow Popout', category: 'port', description: 'Create a real BrowserWindow popout for a port by number', keywords: ['popout', 'browserwindow', 'floating', 'port'], handler: 'popout:create', scope: 'monitor' }),
      commandPaletteEntrySchema.parse({ id: 'topology.global', title: '打开全局拓扑', category: 'navigation', description: 'Open the fullscreen network, neural, and flow topology view', keywords: ['topology', 'graph', 'relationship', '拓扑', '关系', 'tuopu', 'guanxi'], shortcut: 'Ctrl+T' }),
      commandPaletteEntrySchema.parse({ id: 'topology.flow', title: '打开全局流程图', category: 'navigation', description: 'Open the fullscreen topology view directly in flow graph mode', keywords: ['topology', 'flow', 'graph', 'relationship', '流程图', '全局流程', '拓扑', '关系', 'tuopu', 'guanxi', 'liucheng'] }),
      commandPaletteEntrySchema.parse({ id: 'drawer.notifications', title: '打开通知 Drawer', category: 'navigation', description: 'Open the top notifications drawer' }),
      commandPaletteEntrySchema.parse({ id: 'drawer.observability', title: '打开观测 Drawer', category: 'diagnostics', description: 'Open the bottom observability drawer' }),
      commandPaletteEntrySchema.parse({ id: 'drawer.statusbar', title: '打开状态栏聚合 Drawer', category: 'navigation', description: 'Open the statusbar aggregate drawer' }),
      commandPaletteEntrySchema.parse({ id: 'dashboard.open', title: '打开仪表板', category: 'navigation', description: 'Open the draggable R8 dashboard grid' }),
      commandPaletteEntrySchema.parse({ id: 'dashboard.layout.default', title: '应用布局：default', category: 'navigation', description: 'Apply the default dashboard preset' }),
      commandPaletteEntrySchema.parse({ id: 'dashboard.layout.minimal', title: '应用布局：minimal', category: 'navigation', description: 'Apply the compact dashboard preset' }),
      commandPaletteEntrySchema.parse({ id: 'dashboard.layout.monitor-focus', title: '应用布局：monitor-focus', category: 'navigation', description: 'Apply the monitor-focused dashboard preset' }),
      commandPaletteEntrySchema.parse({ id: 'dashboard.layout.ai-focus', title: '应用布局：ai-focus', category: 'navigation', description: 'Apply the AI-focused dashboard preset' }),
      ...COMMAND_THEME_OPTIONS.map(option => commandPaletteEntrySchema.parse({
        id: `theme.apply.${option.theme}`,
        title: option.title,
        category: 'settings',
        description: `Apply the ${option.theme} theme from the command palette`,
        keywords: option.keywords
      })),
      commandPaletteEntrySchema.parse({ id: 'process.view.tree', title: '切到 Tree 视图', category: 'process', description: 'Switch process monitor to the hierarchy tree view' }),
      commandPaletteEntrySchema.parse({ id: 'process.view.treemap', title: '切到 Treemap 视图', category: 'process', description: 'Switch process monitor to the RSS proportional treemap view' }),
      commandPaletteEntrySchema.parse({ id: 'process.batch.tag', title: '为已选进程设标签', category: 'process', description: 'Open the batch tag dialog for selected process identities', keywords: ['process', 'batch', 'tag', 'label', '进程', '标签', '批量'], handler: 'process:batch-tag-open', scope: 'monitor' }),
      commandPaletteEntrySchema.parse({ id: 'window.batch.focus-filtered', title: '批量聚焦当前过滤窗口', category: 'window', description: 'Focus every window currently visible in the Window monitor filter', keywords: ['window', 'batch', 'focus', 'filter', '窗口', '批量', '聚焦', '过滤'], handler: 'window:batch-focus-filtered', scope: 'monitor' }),
      commandPaletteEntrySchema.parse({ id: 'port.blocklist.add', title: 'Add port to blocklist', category: 'port', description: 'Add a port or bind address to the user security blocklist', requiresConfirmation: true }),
      commandPaletteEntrySchema.parse({ id: 'diagnostics.export', title: 'Export diagnostics', category: 'diagnostics', requiresConfirmation: false })
    ]
    const customCommands = this.listCustomCommands().commands
      .filter(command => command.enabled)
      .map(command => commandPaletteEntrySchema.parse({
        id: command.id,
        title: command.label,
        category: 'settings',
        description: `User custom command: ${command.handlerScript}`,
        handler: 'custom',
        keywords: ['custom', command.handlerScript],
        scope: 'global',
        shortcut: command.shortcut.join('+') || undefined
      }))
    return [...builtInCommands, ...this.listRuntimeObjectCommands(), ...customCommands]
  }

  private listRuntimeObjectCommands(): CommandPaletteEntry[] {
    const commands: CommandPaletteEntry[] = []
    const seen = new Set<string>()
    const pushCommand = (input: unknown) => {
      const parsed = commandPaletteEntrySchema.safeParse(input)
      if (!parsed.success || seen.has(parsed.data.id)) return
      seen.add(parsed.data.id)
      commands.push(parsed.data)
    }
    const readPositiveInteger = (value: unknown): number | null => {
      const numberValue = readNumberValue(value) ?? Number(readStringValue(value))
      return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null
    }
    const compactKeywords = (...values: Array<string | number | null | undefined>): string[] => (
      values
        .map(value => String(value ?? '').trim())
        .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
    )

    for (const row of this.scannerSnapshotRows('processes').slice(0, 80)) {
      const pid = readPositiveInteger(row.pid)
      if (pid === null) continue
      const name = readStringValue(row.name) ?? readStringValue(row.processName) ?? `PID ${pid}`
      const cwd = readStringValue(row.workingDir) ?? readStringValue(row.cwd)
      pushCommand({
        id: `process.open.${pid}`,
        title: `Open process ${name} (${pid})`,
        category: 'process',
        description: cwd ? `Open process detail for ${name} in ${cwd}` : `Open process detail for ${name}`,
        handler: 'uri:open',
        uri: `devhub://process/${pid}`,
        keywords: compactKeywords('process', 'pid', pid, name, cwd),
        scope: 'monitor'
      })
      pushCommand({
        id: `topology.process.${pid}`,
        title: `Open topology for process ${name} (${pid})`,
        category: 'process',
        description: cwd ? `Open global topology focused on ${name} in ${cwd}` : `Open global topology focused on ${name}`,
        handler: 'topology:open',
        uri: `devhub://process/${pid}?node=${encodeURIComponent(`process-${pid}`)}`,
        keywords: compactKeywords('topology', 'relationship', '拓扑', '关系', '图', 'tuopu', 'guanxi', 'process', 'pid', pid, name, cwd),
        scope: 'monitor'
      })
    }

    for (const row of this.scannerSnapshotRows('ports').slice(0, 40)) {
      const port = readPositiveInteger(row.port)
      if (port === null || port > 65535) continue
      const pid = readPositiveInteger(row.pid)
      const protocol = readStringValue(row.protocol) ?? readStringValue(row.type) ?? 'tcp'
      const address = readStringValue(row.address) ?? readStringValue(row.localAddress) ?? readStringValue(row.host)
      pushCommand({
        id: `port.open.${port}.${pid ?? 'unknown'}`,
        title: `Open port ${port}`,
        category: 'port',
        description: `Open ${protocol.toUpperCase()} port ${port}${pid ? ` owned by PID ${pid}` : ''}`,
        handler: 'uri:open',
        uri: `devhub://port/${port}`,
        keywords: compactKeywords('port', port, pid, protocol, address),
        scope: 'monitor'
      })
      if (pid !== null) {
        const portNodeId = `port-${port}-${pid}-${protocol}`
        pushCommand({
          id: `topology.port.${port}.${pid}`,
          title: `Open topology for port ${port}`,
          category: 'port',
          description: `Open global topology focused on ${protocol.toUpperCase()} port ${port} owned by PID ${pid}`,
          handler: 'topology:open',
          uri: `devhub://port/${port}?node=${encodeURIComponent(portNodeId)}`,
          keywords: compactKeywords('topology', 'relationship', '拓扑', '关系', '图', 'tuopu', 'guanxi', 'port', port, pid, protocol, address),
          scope: 'monitor'
        })
      }
    }

    for (const row of this.scannerSnapshotRows('windows').slice(0, 40)) {
      const hwnd = readPositiveInteger(row.hwnd) ?? readPositiveInteger(row.id)
      if (hwnd === null) continue
      const title = readStringValue(row.title) ?? `HWND ${hwnd}`
      const processName = readStringValue(row.processName) ?? readStringValue(row.name)
      pushCommand({
        id: `window.open.${hwnd}`,
        title: `Open window ${title}`,
        category: 'window',
        description: processName ? `Open window detail for ${title} (${processName})` : `Open window detail for ${title}`,
        handler: 'uri:open',
        uri: `devhub://window/${hwnd}`,
        keywords: compactKeywords('window', 'hwnd', hwnd, title, processName),
        scope: 'monitor'
      })
      pushCommand({
        id: `topology.window.${hwnd}`,
        title: `Open topology for window ${title}`,
        category: 'window',
        description: processName ? `Open global topology focused on ${title} (${processName})` : `Open global topology focused on ${title}`,
        handler: 'topology:open',
        uri: `devhub://window/${hwnd}?node=${encodeURIComponent(`window-${hwnd}`)}`,
        keywords: compactKeywords('topology', 'relationship', '拓扑', '关系', '图', 'tuopu', 'guanxi', 'window', 'hwnd', hwnd, title, processName),
        scope: 'monitor'
      })
    }

    return commands
  }

  addCommandHistory(input: { commandId: string; invokedAt: number; confirmedBy?: string | null; useCount: number }): CommandHistoryEntry {
    const nextInput = commandHistoryEntrySchema.parse(input)
    const history = this.listCommandHistory()
    const previous = history.find(item => item.commandId === nextInput.commandId)
    const nextEntry = commandHistoryEntrySchema.parse({
      commandId: nextInput.commandId,
      invokedAt: nextInput.invokedAt,
      confirmedBy: nextInput.confirmedBy ?? previous?.confirmedBy ?? null,
      useCount: (previous?.useCount ?? 0) + nextInput.useCount
    })
    const retained = [nextEntry, ...history.filter(item => item.commandId !== nextEntry.commandId)]
      .sort((left, right) => right.useCount - left.useCount || right.invokedAt - left.invokedAt)
      .slice(0, 50)
      .sort((left, right) => right.invokedAt - left.invokedAt)
    this.store.set('commandHistory', retained)
    return nextEntry
  }

  listCustomCommands() {
    const commands: ReturnType<typeof customCommandSchema.parse>[] = []
    for (const item of asArray(this.store.get('customCommands', []), value => value)) {
      const parsed = customCommandSchema.safeParse(item)
      if (parsed.success) commands.push(parsed.data)
    }
    return customCommandListResponseSchema.parse({
      commands: commands.sort((left, right) => right.savedAt - left.savedAt)
    })
  }

  saveCustomCommand(input: unknown): ReturnType<typeof customCommandSaveResultSchema.parse> {
    const inputRecord = isRecord(input) ? input : {}
    const confirmedBy = typeof inputRecord.confirmedBy === 'string' && inputRecord.confirmedBy.trim().length > 0
      ? inputRecord.confirmedBy.trim()
      : null
    if (!confirmedBy || confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const parsedInput = customCommandSchema.parse({
      ...inputRecord,
      confirmedBy,
      savedAt: Date.now()
    })
    const existing = this.listCustomCommands().commands.filter(command => command.id !== parsedInput.id)
    const next = [parsedInput, ...existing].slice(0, 200)
    this.store.set('customCommands', next)
    return customCommandSaveResultSchema.parse({
      success: true,
      command: parsedInput
    })
  }

  private async invokeCustomCommand(commandId: string, input: { args?: unknown; confirmedBy?: string }): Promise<void> {
    const customCommands = this.listCustomCommands().commands
    const custom = customCommands.find(command => command.id === commandId && command.enabled)
    if (!custom) throw new Error(`E_COMMAND_NOT_FOUND:${commandId}`)
    const handlerScript = custom.handlerScript.trim()
    if (handlerScript.startsWith('command:')) {
      const targetCommandId = handlerScript.slice('command:'.length).trim()
      if (!targetCommandId) throw new Error('E_VALIDATION:custom command target is required')
      if (customCommands.some(command => command.id === targetCommandId)) throw new Error('E_VALIDATION:custom command chaining is not supported')
      await this.invokeCommand({ commandId: targetCommandId, args: input.args, confirmedBy: input.confirmedBy })
      return
    }
    if (/^devhub:\/\/[a-z-]+\/[^?]+(?:\?.*)?$/i.test(handlerScript)) {
      const resolved = this.resolveCommandUri({ uri: handlerScript })
      const mainWindow = this.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('r8:command-event', { type: 'protocol-open', uri: handlerScript, panel: resolved.panel, monitor: resolved.monitor })
      }
      return
    }
    throw new Error('E_UNSUPPORTED_CUSTOM_COMMAND:handlerScript must start with command: or devhub://')
  }


  async invokeCommand(input: { commandId: string; args?: unknown; confirmedBy?: string }) {
    const commandId = String(input.commandId)
    const entry = this.listCommands().find(command => command.id === commandId)
    if (!entry) throw new Error(`E_COMMAND_NOT_FOUND:${commandId}`)

    const mainWindow = this.getMainWindow()
    if (entry.handler === 'custom') {
      await this.invokeCustomCommand(commandId, input)
      this.addCommandHistory({
        commandId,
        invokedAt: Date.now(),
        confirmedBy: input.confirmedBy ?? null,
        useCount: 1
      })
      return { success: true, commandId }
    }
    if (entry.handler === 'uri:open' && entry.uri) {
      const resolved = this.resolveCommandUri({ uri: entry.uri })
      if (!resolved.exists && !resolved.fallbackUsed) throw new Error(`E_NOT_FOUND:command-uri-target:${entry.uri}`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('r8:command-event', {
          type: 'protocol-open',
          uri: entry.uri,
          panel: resolved.panel,
          monitor: resolved.monitor
        })
      }
      this.addCommandHistory({
        commandId,
        invokedAt: Date.now(),
        confirmedBy: input.confirmedBy ?? null,
        useCount: 1
      })
      return { success: true, commandId }
    }
    if (entry.handler === 'topology:open' && entry.uri) {
      const resolved = this.resolveCommandUri({ uri: entry.uri })
      if (!resolved.exists && !resolved.fallbackUsed) throw new Error(`E_NOT_FOUND:command-uri-target:${entry.uri}`)
      const selectedNodeId = new URL(entry.uri).searchParams.get('node') ?? undefined
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('r8:command-event', {
          type: 'topology-navigate',
          selectedNodeId
        })
      }
      this.addCommandHistory({
        commandId,
        invokedAt: Date.now(),
        confirmedBy: input.confirmedBy ?? null,
        useCount: 1
      })
      return { success: true, commandId }
    }
    const tab = commandId.startsWith('monitor.') ? commandId.slice('monitor.'.length) : null
    if (mainWindow && !mainWindow.isDestroyed() && tab) {
      mainWindow.webContents.send('r8:command-event', { type: 'monitor-navigate', tab })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'topology.global') {
      mainWindow.webContents.send('r8:command-event', { type: 'topology-navigate' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'topology.flow') {
      mainWindow.webContents.send('r8:command-event', { type: 'topology-navigate', graphKind: 'flow' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'drawer.notifications') {
      mainWindow.webContents.send('r8:command-event', { type: 'drawer-open', slot: 'top', contentId: 'notifications.top' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'drawer.observability') {
      mainWindow.webContents.send('r8:command-event', { type: 'drawer-open', slot: 'bottom', contentId: 'observability' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'drawer.statusbar') {
      mainWindow.webContents.send('r8:command-event', { type: 'drawer-open', slot: 'statusbar', contentId: 'statusbar.aggregate' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'dashboard.open') {
      mainWindow.webContents.send('r8:command-event', { type: 'dashboard-open' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'ai.tasks.open') {
      mainWindow.webContents.send('r8:command-event', { type: 'monitor-navigate', tab: 'ai-task' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'settings.open') {
      mainWindow.webContents.send('r8:command-event', { type: 'settings-open' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId.startsWith('theme.apply.')) {
      const theme = commandId.slice('theme.apply.'.length)
      mainWindow.webContents.send('r8:command-event', { type: 'theme-apply', theme })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId.startsWith('dashboard.layout.')) {
      mainWindow.webContents.send('r8:command-event', {
        type: 'dashboard-apply-layout',
        layoutName: commandId.slice('dashboard.layout.'.length)
      })
    }
    if (commandId === 'popout.port') {
      const args = isRecord(input.args) ? input.args : {}
      const rawPort = typeof args.port === 'number' ? args.port : typeof args.port === 'string' ? Number(args.port) : NaN
      if (!Number.isInteger(rawPort) || rawPort < 1 || rawPort > 65535) throw new Error('E_VALIDATION:port is required')
      await this.createPopout({
        surface: 'port',
        targetId: rawPort,
        mode: 'browserwindow',
        route: '/monitor',
        title: `DevHub port ${rawPort}`
      })
    }
    if (commandId === 'process.view.tree') {
      this.setProcessViewMode({ mode: 'tree' })
    }
    if (commandId === 'process.view.treemap') {
      this.setProcessViewMode({ mode: 'treemap' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'process.batch.tag') {
      mainWindow.webContents.send('r8:command-event', { type: 'monitor-navigate', tab: 'process' })
      mainWindow.webContents.send('r8:command-event', { type: 'process-batch-tag-open' })
    }
    if (mainWindow && !mainWindow.isDestroyed() && commandId === 'window.batch.focus-filtered') {
      mainWindow.webContents.send('r8:command-event', { type: 'monitor-navigate', tab: 'window' })
      mainWindow.webContents.send('r8:command-event', { type: 'window-batch-focus-filtered' })
    }
    if (commandId === 'port.blocklist.add') {
      const args = isRecord(input.args) ? input.args : {}
      this.addBlocklist({
        port: typeof args.port === 'number' ? args.port : typeof args.port === 'string' ? Number(args.port) : undefined,
        ip: readStringValue(args.ip) ?? undefined,
        reason: readStringValue(args.reason) ?? 'command-palette',
        confirmedBy: input.confirmedBy ?? 'command-palette'
      })
    }
    if (commandId === 'diagnostics.export') {
      await this.exportDiagnosticPack({ includeAudit: true, includeSnapshot: true, redactPII: true })
    }
    this.addCommandHistory({
      commandId,
      invokedAt: Date.now(),
      confirmedBy: input.confirmedBy ?? null,
      useCount: 1
    })
    return { success: true, commandId }
  }

  listCommandHistory(): CommandHistoryEntry[] {
    return asArray(this.store.get('commandHistory', []), item => {
      const record = item as Record<string, unknown>
      const parsed = commandHistoryEntrySchema.safeParse({
        commandId: String(record.commandId ?? ''),
        invokedAt: typeof record.invokedAt === 'number' ? record.invokedAt : 0,
        confirmedBy: typeof record.confirmedBy === 'string' ? record.confirmedBy : null,
        useCount: typeof record.useCount === 'number' ? record.useCount : 1
      })
      return parsed.success ? parsed.data : null
    }).filter((item): item is CommandHistoryEntry => item !== null)
  }

  clearCommandHistory(input: { confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const cleared = this.listCommandHistory().length
    this.store.set('commandHistory', [])
    return { success: true, cleared, clearedAt: Date.now(), confirmedBy: input.confirmedBy }
  }

  private parseStoredStatusbarConfig(): StatusbarConfig | null {
    const result = statusbarConfigSchema.safeParse(this.store.get('statusbarConfig'))
    return result.success ? result.data : null
  }

  private buildStatusbarConfig(tiles: readonly StatusTile[], updatedAt: number): StatusbarConfig {
    return statusbarConfigSchema.parse({
      tiles: [...tiles].sort((left, right) => left.order - right.order),
      updatedAt
    })
  }

  private applyStatusbarConfig(tiles: readonly StatusTile[]): StatusTile[] {
    const config = this.parseStoredStatusbarConfig()
    if (!config) return [...tiles].sort((left, right) => left.order - right.order)

    const configuredById = new Map(config.tiles.map(tile => [tile.id, tile]))
    return tiles
      .map(tile => {
        const configured = configuredById.get(tile.id)
        if (!configured) return tile
        return {
          ...tile,
          visible: configured.visible,
          order: configured.order,
          align: configured.align
        }
      })
      .sort((left, right) => left.order - right.order)
  }

  getStatusbarConfig(): StatusbarConfig {
    const stored = this.parseStoredStatusbarConfig()
    if (stored) return stored
    const aggregate = this.statusAggregate({ applyUserConfig: false })
    return this.buildStatusbarConfig(aggregate.tiles, aggregate.generatedAt)
  }

  setStatusbarConfig(input: StatusbarConfig): StatusbarConfig {
    const parsed = statusbarConfigSchema.parse({
      ...input,
      tiles: [...input.tiles].sort((left, right) => left.order - right.order),
      updatedAt: Date.now()
    })
    this.store.set('statusbarConfig', parsed)
    return parsed
  }

  resetStatusbarConfig(input: StatusbarResetRequest): StatusbarConfig {
    statusbarResetRequestSchema.parse(input)
    this.store.delete('statusbarConfig')
    const aggregate = this.statusAggregate({ applyUserConfig: false })
    return this.buildStatusbarConfig(aggregate.tiles, Date.now())
  }

  listThemeDecorations(): ThemeDecorationListResponse {
    return themeDecorationListResponseSchema.parse({
      kinds: [...THEME_DECORATION_KIND_VALUES],
      customSvgs: this.customSvgStore.list().items
    })
  }

  setThemeDecorationConfig(input: ThemeDecorationConfig): ThemeDecorationConfig {
    const parsed = themeDecorationConfigSchema.parse(input)
    const settings = this.appStore.getSettings()
    this.appStore.updateSettings({
      appearance: {
        ...settings.appearance,
        decoration: parsed
      }
    })
    return parsed
  }

  uploadCustomSvg(input: CustomSvgUploadRequest): CustomSvgUploadResponse {
    return this.customSvgStore.upload(customSvgUploadRequestSchema.parse(input))
  }

  listCustomSvgs(): CustomSvgListResponse {
    return customSvgListResponseSchema.parse(this.customSvgStore.list())
  }

  removeCustomSvg(input: CustomSvgRemoveRequest): CustomSvgRemoveResponse {
    return this.customSvgStore.remove(customSvgRemoveRequestSchema.parse(input))
  }

  getThemeSoundConfig(input: ThemeSoundConfigGetRequest): ThemeSoundConfig {
    const parsed = themeSoundConfigGetRequestSchema.parse(input)
    const record = this.store.get('themeSoundConfigs', {})
    const candidate = record?.[parsed.themeId]
    const fallback = {
      themeId: parsed.themeId,
      enabled: false,
      volume: 0.3,
      events: {}
    }
    const result = themeSoundConfigSchema.safeParse(candidate ?? fallback)
    return result.success ? result.data : themeSoundConfigSchema.parse(fallback)
  }

  setThemeSoundConfig(input: ThemeSoundConfig): ThemeSoundConfigResponse {
    const parsed = themeSoundConfigSchema.parse(input)
    const record = this.store.get('themeSoundConfigs', {})
    this.store.set('themeSoundConfigs', {
      ...record,
      [parsed.themeId]: parsed
    })
    return themeSoundConfigResponseSchema.parse({
      success: true,
      config: parsed
    })
  }

  private createStatusAggregator(): StatusAggregator {
    return new StatusAggregator({
      readAggregate: () => this.statusAggregate(),
      publish: aggregate => {
        const mainWindow = this.getMainWindow()
        if (!mainWindow || mainWindow.isDestroyed()) return
        mainWindow.webContents.send('status:aggregate', aggregate)
      },
      onError: error => {
        auditLogger.log('statusbar:aggregate-push', {
          error: error instanceof Error ? error.message : String(error)
        }, 'error', 'E_INTERNAL')
      }
    })
  }

  private nextStatusAggregateGeneratedAt(): number {
    const now = Date.now()
    this.lastStatusAggregateGeneratedAt = Math.max(now, this.lastStatusAggregateGeneratedAt + 1)
    return this.lastStatusAggregateGeneratedAt
  }

  startStatusAggregator(): void {
    if (this.statusAggregator?.isRunning()) return
    if (!this.statusAggregator) this.statusAggregator = this.createStatusAggregator()
    this.statusAggregator.start()
  }

  stopStatusAggregator(): void {
    this.statusAggregator?.stop()
  }

  publishStatusAggregateNow() {
    if (!this.statusAggregator) this.statusAggregator = this.createStatusAggregator()
    return this.statusAggregator?.publishNow() ?? Promise.resolve({ success: false, error: 'E_STATUSBAR_AGGREGATOR_UNAVAILABLE' })
  }

  startTopologySnapshotter(): void {
    this.syncTopologySnapshotter()
  }

  stopTopologySnapshotter(): void {
    this.graphSnapshotter.stop()
  }

  runTopologySnapshotterOnce(reason = 'manual'): Promise<GraphSnapshotterRunResult> {
    return this.graphSnapshotter.runOnce(reason)
  }

  private syncTopologySnapshotter(): void {
    if (this.isFeatureEnabled('R8.C.topology.global')) {
      this.graphSnapshotter.start()
      return
    }
    this.graphSnapshotter.stop()
  }

  private auditTopologySnapshotterResult(result: GraphSnapshotterRunResult): void {
    const status = result.status === 'saved' ? 'success' : result.status === 'skipped' ? 'refused' : 'error'
    const reason = result.status === 'skipped'
      ? result.skippedReason === 'disabled' ? 'E_FEATURE_DISABLED' : 'E_RUNTIME_BUSY'
      : result.status === 'error'
        ? 'E_RUNTIME'
        : undefined
    auditLogger.log('topology:auto-snapshot', {
      status: result.status,
      reason: result.reason,
      takenAt: result.takenAt,
      saved: result.saved.length,
      pruned: result.pruned.length,
      pruneErrors: result.pruneErrors.length,
      graphKinds: result.saved.map(snapshot => snapshot.graphKind),
      skippedReason: result.skippedReason ?? null,
      error: result.error ?? null
    }, status, reason)
  }

  statusAggregate(options: { applyUserConfig?: boolean } = {}) {
    const snapshot = this.runtime?.scannerCache?.getSnapshot()
    const snapshotRecord: Record<string, unknown> = isRecord(snapshot) ? snapshot : {}
    const summary = isRecord(snapshotRecord.systemSummary) ? snapshotRecord.systemSummary : {}
    const portsEnvelope = isRecord(snapshotRecord.ports) ? snapshotRecord.ports : {}
    const aiTasksEnvelope = isRecord(snapshotRecord.aiTasks) ? snapshotRecord.aiTasks : {}
    const ports: Record<string, unknown>[] = Array.isArray(portsEnvelope.data) ? portsEnvelope.data.filter(isRecord) : []
    const aiTasks: Record<string, unknown>[] = Array.isArray(aiTasksEnvelope.data) ? aiTasksEnvelope.data.filter(isRecord) : []
    const now = this.nextStatusAggregateGeneratedAt()

    const numberField = (record: Record<string, unknown>, key: string, fallback = 0) => {
      const value = record[key]
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback
    }
    const stringField = (record: Record<string, unknown>, key: string, fallback = '') => {
      const value = record[key]
      return typeof value === 'string' ? value : fallback
    }
    const nestedState = (record: Record<string, unknown>) => {
      const status = record.status
      if (typeof status === 'string') return status
      if (isRecord(status)) return stringField(status, 'state')
      return ''
    }
    const blocklistEntries = this.listBlocklist()
    const classifyPortRecord = (record: Record<string, unknown>) => {
      const port = Math.trunc(numberField(record, 'port', 0))
      if (port < 1 || port > 65535) return null
      const endpoint = stringField(record, 'ip')
        || stringField(record, 'address')
        || stringField(record, 'localAddress')
        || stringField(record, 'host')
      return classifyPortSecurity({
        port,
        address: endpoint,
        blocklisted: isPortBlocklisted(port, endpoint, blocklistEntries)
      })
    }

    const cpuPct = Math.round(numberField(summary, 'cpuTotal'))
    const memPct = Math.round(numberField(summary, 'memoryUsedPercent'))
    const listeningPortsCount = ports.length > 0
      ? ports.filter(port => stringField(port, 'state') === 'LISTENING').length
      : numberField(summary, 'activePortCount')
    const portClassifications = ports
      .map(classifyPortRecord)
      .filter((port): port is NonNullable<ReturnType<typeof classifyPortRecord>> => port !== null)
    const publicPortsCount = portClassifications.filter(port => port.tier === 'WAN-Capable').length
    const suspiciousPortsCount = portClassifications.filter(port => port.tier === 'Suspicious').length
    const projectsCount = this.appStore.getProjects().filter(project => project.status === 'running').length
    const aiTasksRunning = aiTasks.length > 0
      ? aiTasks.filter(task => ['running', 'waiting'].includes(nestedState(task))).length
      : numberField(summary, 'aiToolCount')
    const aiTasksFailed = aiTasks.filter(task => ['failed', 'error'].includes(nestedState(task))).length
    const notificationsUnread = this.countUnreadNotifications()
    const popoutsActive = this.listPopouts()
      .filter(popout => popout.mode === 'browserwindow' && this.isLivePopout(popout))
      .length
    const currentTheme = this.appStore.getSettings().appearance?.theme ?? 'constructivism'

    const tile = (id: StatusTile['id'], label: string, value: StatusTile['value'], extras: Partial<StatusTile> = {}): StatusTile => ({
      id,
      label,
      value,
      tone: extras.tone ?? 'neutral',
      source: 'r8-runtime',
      updatedAt: now,
      visible: extras.visible ?? true,
      order: extras.order ?? DEFAULT_STATUSBAR_TILE_IDS.findIndex(tileId => tileId === id),
      align: extras.align ?? 'left',
      badgeType: extras.badgeType,
      badgeValue: extras.badgeValue,
      iconToken: extras.iconToken,
      tooltip: extras.tooltip,
      clickAction: extras.clickAction
    })

    const rawTiles = [
      tile('cpu', 'CPU', cpuPct, {
        tone: cpuPct >= 80 ? 'warning' : 'neutral',
        badgeType: cpuPct >= 80 ? 'warning' : 'number',
        badgeValue: `${cpuPct}%`,
        iconToken: 'MonitorIcon',
        tooltip: 'CPU 使用率',
        clickAction: { type: 'open-drawer', args: { slot: 'bottom', contentId: 'observability' } }
      }),
      tile('mem', 'MEM', memPct, {
        tone: memPct >= 80 ? 'warning' : 'neutral',
        badgeType: memPct >= 80 ? 'warning' : 'number',
        badgeValue: `${memPct}%`,
        iconToken: 'ProcessIcon',
        tooltip: '内存使用率',
        clickAction: { type: 'open-drawer', args: { slot: 'bottom', contentId: 'observability' } }
      }),
      tile('net', 'NET', 0, {
        badgeType: 'experimental',
        badgeValue: 'EXP',
        iconToken: 'NetworkIcon',
        tooltip: '网络速率聚合暂由 R8.C observability 接入',
        clickAction: { type: 'open-drawer', args: { slot: 'bottom', contentId: 'observability' } }
      }),
      tile('battery', 'BAT', 'N/A', {
        visible: false,
        iconToken: 'LightningIcon',
        tooltip: '电池信息不可用时自动隐藏'
      }),
      tile('projects', '项目', projectsCount, {
        tone: projectsCount > 0 ? 'success' : 'neutral',
        badgeType: 'number',
        badgeValue: projectsCount,
        iconToken: 'FolderIcon',
        tooltip: '运行中的项目数',
        clickAction: { type: 'navigate', args: { route: 'projects' } }
      }),
      tile('ai-tasks', 'AI', aiTasksRunning, {
        tone: aiTasksFailed > 0 ? 'danger' : aiTasksRunning > 0 ? 'accent' : 'neutral',
        badgeType: aiTasksFailed > 0 ? 'error' : 'number',
        badgeValue: aiTasksFailed > 0 ? aiTasksFailed : aiTasksRunning,
        iconToken: 'AIIcon',
        tooltip: 'AI 任务运行数',
        clickAction: { type: 'open-drawer', args: { slot: 'right', contentId: 'ai-task.detail', monitorTab: 'ai-task' } }
      }),
      tile('public-ports', '公网端口', publicPortsCount, {
        tone: suspiciousPortsCount > 0 ? 'danger' : publicPortsCount > 0 ? 'warning' : 'success',
        badgeType: suspiciousPortsCount > 0 ? 'error' : publicPortsCount > 0 ? 'warning' : 'number',
        badgeValue: publicPortsCount,
        iconToken: 'GlobeIcon',
        tooltip: `公网可达 ${publicPortsCount} 个，可疑 ${suspiciousPortsCount} 个`,
        clickAction: { type: 'navigate', args: { route: 'monitor', tab: 'port' } }
      }),
      tile('listening-ports', '监听端口', listeningPortsCount, {
        tone: listeningPortsCount > 0 ? 'accent' : 'neutral',
        badgeType: 'number',
        badgeValue: listeningPortsCount,
        iconToken: 'PortIcon',
        tooltip: '监听端口数量',
        clickAction: { type: 'navigate', args: { route: 'monitor', tab: 'port' } }
      }),
      tile('notifications', '通知', notificationsUnread, {
        tone: notificationsUnread > 0 ? 'warning' : 'neutral',
        badgeType: 'unread',
        badgeValue: notificationsUnread,
        iconToken: 'BellIcon',
        tooltip: '通知中心未处理事件',
        clickAction: { type: 'open-drawer', args: { slot: 'top', contentId: 'notifications.top' } }
      }),
      tile('popouts', '浮卡', popoutsActive, {
        tone: popoutsActive > 0 ? 'accent' : 'neutral',
        badgeType: 'number',
        badgeValue: popoutsActive,
        iconToken: 'WindowIcon',
        tooltip: '当前浮卡数量',
        clickAction: { type: 'open-drawer', args: { slot: 'floating', contentId: 'popout.manager' } }
      }),
      tile('theme', '主题', getPaletteDisplayName(currentTheme), {
        tone: 'accent',
        iconToken: 'PaletteIcon',
        tooltip: '当前主题与装饰轴',
        clickAction: { type: 'open-drawer', args: { slot: 'right', contentId: 'settings' } }
      }),
      tile('cmdk', 'CMDK', 'Ctrl+K', {
        tone: 'success',
        badgeType: 'experimental',
        badgeValue: 'CMD',
        iconToken: 'SearchIcon',
        tooltip: '打开命令面板',
        clickAction: { type: 'open-cmdk', args: {} }
      })
    ].sort((left, right) => left.order - right.order)

    const tiles = options.applyUserConfig === false ? rawTiles : this.applyStatusbarConfig(rawTiles)

    const badges = tiles
      .filter(item => item.visible && item.badgeType !== undefined)
      .slice(0, 6)

    return statusAggregateSchema.parse({
      generatedAt: now,
      tiles,
      badges,
      refreshIntervalMs: STATUSBAR_LIMITS.REFRESH_INTERVAL_MS
    })
  }

  classifyPort(input: { ip?: string; port: number }) {
    const port = Math.trunc(Number(input.port))
    const address = input.ip ?? '127.0.0.1'
    const blocklisted = isPortBlocklisted(port, address, this.listBlocklist())
    return securityTierSchema.parse(classifyPortSecurity({ port, address, blocklisted }))
  }

  listBlocklist(): BlocklistEntry[] {
    return [...buildDefaultBlocklistEntries(), ...this.listUserBlocklist()]
  }

  addBlocklist(input: { ip?: string; port?: number; reason?: string; confirmedBy?: string }) {
    const port = typeof input.port === 'number' ? Math.trunc(input.port) : undefined
    const ip = typeof input.ip === 'string' && input.ip.trim().length > 0 ? input.ip.trim() : undefined
    if (!ip && typeof port !== 'number') throw new Error('E_VALIDATION:blocklist requires ip or port')
    if (typeof port === 'number' && (port < 1 || port > 65535)) throw new Error('E_VALIDATION:port must be 1-65535')

    const existing = this.listUserBlocklist()
    const matchIndex = existing.findIndex(entry => (typeof port === 'number' && entry.port === port) || (ip && entry.ip === ip))
    if (matchIndex === -1 && existing.length >= SECURITY_TIER_LIMITS.USER_BLOCKLIST_MAX) {
      throw new Error('E_RATE_LIMITED:blocklist user entry limit exceeded')
    }

    const now = Date.now()
    const entry = blocklistEntrySchema.parse({
      id: matchIndex >= 0 ? existing[matchIndex].id : `block-${randomUUID()}`,
      ip,
      port,
      reason: input.reason?.trim().slice(0, 200) || 'user',
      source: 'user',
      addedAt: matchIndex >= 0 ? existing[matchIndex].addedAt : now,
      createdAt: matchIndex >= 0 ? existing[matchIndex].createdAt : now
    })
    const next = matchIndex >= 0
      ? existing.map((item, index) => index === matchIndex ? entry : item)
      : [...existing, entry]
    this.store.set('blocklist', next)
    return entry
  }

  removeBlocklist(input: { id?: string; ip?: string; port?: number; confirmedBy?: string }) {
    const id = typeof input.id === 'string' ? input.id : undefined
    const ip = typeof input.ip === 'string' && input.ip.trim().length > 0 ? input.ip.trim() : undefined
    const port = typeof input.port === 'number' ? Math.trunc(input.port) : undefined
    if (!id && !ip && typeof port !== 'number') throw new Error('E_VALIDATION:blocklist remove requires id, ip, or port')
    const before = this.listUserBlocklist()
    const next = before.filter(entry => {
      if (id && entry.id === id) return false
      if (typeof port === 'number' && entry.port === port) return false
      if (ip && entry.ip === ip) return false
      return true
    })
    this.store.set('blocklist', next)
    return { success: true, removed: before.length - next.length, remaining: next.length }
  }

  resetBlocklist(_input: { confirmedBy?: string } = {}) {
    const clearedUserEntries = this.listUserBlocklist().length
    this.store.set('blocklist', [])
    return { defaults: buildDefaultBlocklistEntries(), clearedUserEntries, resetAt: Date.now() }
  }

  publicBannerState(input?: { ports?: unknown[] }) {
    const rows = Array.isArray(input?.ports)
      ? input.ports.filter(isRecord)
      : this.scannerSnapshotRows('ports')
    const classifications = rows.flatMap(record => {
      const port = Number(record.port)
      if (!Number.isInteger(port) || port < 1 || port > 65535) return []
      const address = readStringValue(record.ip)
        ?? readStringValue(record.address)
        ?? readStringValue(record.localAddress)
        ?? readStringValue(record.host)
        ?? '127.0.0.1'
      const tier = this.classifyPort({ port, ip: address })
      return [{
        port,
        ip: tier.ip,
        tier: tier.tier,
        processName: readStringValue(record.processName) ?? readStringValue(record.name) ?? undefined
      }]
    })
    return publicBannerStateSchema.parse({
      wanCount: classifications.filter(item => item.tier === 'WAN-Capable').length,
      suspiciousCount: classifications.filter(item => item.tier === 'Suspicious').length,
      totalCount: classifications.length,
      generatedAt: Date.now(),
      ports: classifications.filter(item => item.tier === 'WAN-Capable' || item.tier === 'Suspicious').slice(0, 50)
    })
  }

  private listUserBlocklist(): BlocklistEntry[] {
    const raw = this.store.get('blocklist', [])
    if (!Array.isArray(raw)) {
      this.store.set('blocklist', [])
      return []
    }
    const entries: BlocklistEntry[] = []
    let changed = false
    for (const item of raw) {
      const record = isRecord(item) ? item : {}
      const rawPort = typeof record.port === 'number' ? record.port : typeof record.port === 'string' ? Number(record.port) : undefined
      const port = typeof rawPort === 'number' && Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : undefined
      const ip = readStringValue(record.ip)
      if (!ip && typeof port !== 'number') {
        changed = true
        continue
      }
      const createdAt = typeof record.createdAt === 'number'
        ? record.createdAt
        : typeof record.addedAt === 'number'
          ? record.addedAt
          : Date.now()
      try {
        entries.push(blocklistEntrySchema.parse({
          id: readStringValue(record.id) ?? `block-${randomUUID()}`,
          ip: ip ?? undefined,
          port,
          reason: readStringValue(record.reason)?.slice(0, 200) ?? 'user',
          source: 'user',
          addedAt: typeof record.addedAt === 'number' ? record.addedAt : createdAt,
          createdAt
        }))
      } catch {
        changed = true
      }
    }
    const bounded = entries.slice(0, SECURITY_TIER_LIMITS.USER_BLOCKLIST_MAX)
    if (changed || bounded.length !== raw.length) this.store.set('blocklist', bounded)
    return bounded
  }

  csvSchemaInfo() {
    return csvSchemaInfoSchema.parse({
      schemaName: 'CsvTaskRow18',
      columnCount: CSV_COLUMN_NAMES.length,
      columns: CSV_COLUMN_INFO,
      header: [...CSV_COLUMN_NAMES]
    })
  }

  validateCsvHeader(input: unknown) {
    const header = Array.isArray(input)
      ? input.map(item => String(item))
      : typeof input === 'object' && input !== null && Array.isArray((input as { header?: unknown }).header)
        ? (input as { header: unknown[] }).header.map(item => String(item))
        : []
    return validateCsvHeader(header)
  }

  validateCsvRow(input: unknown) {
    const request = typeof input === 'object' && input !== null && 'row' in input ? (input as { row: unknown }).row : input
    const canonical = csvTaskRow18Schema.safeParse(request)
    if (canonical.success) return { success: true, valid: true, row: canonical.data, mode: '18-col' }
    const legacy = csvTaskRowSchema.safeParse(request)
    if (legacy.success) return { success: true, valid: true, row: legacy.data, mode: 'runtime' }
    return {
      success: false,
      valid: false,
      errors: canonical.error.issues.map(issue => ({ column: issue.path.join('.') || '__row__', message: fromZodIssue(issue, { prefix: undefined }).message })),
      issues: canonical.error.issues
    }
  }

  checkDagReady(input: unknown) {
    const record = this.asRecord(input)
    const legacyGraph = dagGraphSchema.safeParse(input)
    if (legacyGraph.success && !record.taskId && !record.sessionId && !record.snapshot) {
      const cycleReport = this.detectDagCycle(legacyGraph.data)
      const completed = new Set(Array.isArray(record.completedIds) ? record.completedIds.map(String) : [])
      const failed = new Set(Array.isArray(record.failedIds) ? record.failedIds.map(String) : [])
      if (cycleReport.hasCycle) {
        return { ready: false, readyNodeIds: [], blockedNodeIds: legacyGraph.data.nodes.map(node => node.id), cycles: cycleReport.cycles, checkedAt: Date.now() }
      }
      const snapshot = this.dagOrchestrator.build({ graph: legacyGraph.data })
      const readyNodeIds = snapshot.nodes
        .filter(node => this.dagOrchestrator.isReady(snapshot, node.taskId, completed, failed).ready)
        .map(node => node.taskId)
      const blockedNodeIds = snapshot.nodes.map(node => node.taskId).filter(taskId => !readyNodeIds.includes(taskId))
      return { ready: blockedNodeIds.length === 0, readyNodeIds, blockedNodeIds, cycles: [], checkedAt: Date.now() }
    }

    const request = dagReadyRequestSchema.parse(input ?? {})
    const snapshot = request.snapshot ?? (request.graph ? this.dagOrchestrator.build({ graph: request.graph, sessionId: request.sessionId }) : this.getDagSnapshotOrThrow(request.sessionId))
    if (!request.taskId) {
      const completed = new Set(request.completedIds)
      const failed = new Set(request.failedIds)
      const readyNodeIds = snapshot.nodes.filter(node => this.dagOrchestrator.isReady(snapshot, node.taskId, completed, failed).ready).map(node => node.taskId)
      return { ready: true, readyNodeIds, blockedNodeIds: snapshot.nodes.map(node => node.taskId).filter(taskId => !readyNodeIds.includes(taskId)), checkedAt: Date.now() }
    }
    const result = this.dagOrchestrator.isReady(snapshot, request.taskId, new Set(request.completedIds), new Set(request.failedIds))
    return { ...result, taskId: request.taskId, checkedAt: Date.now() }
  }

  detectDagCycle(input: unknown) {
    const cycle = this.dagOrchestrator.detectCycle(this.normalizeDagBuildInput(input))
    return { hasCycle: Boolean(cycle), cycles: cycle?.cyclePaths ?? [], cyclePaths: cycle?.cyclePaths ?? [] }
  }

  buildDag(input: unknown) {
    const snapshot = this.dagOrchestrator.build(this.normalizeDagBuildInput(input))
    this.persistDagSnapshot(snapshot)
    return { ...snapshot, ready: snapshot.layers[0] ?? [], cycle: { hasCycle: false, cycles: [] } }
  }

  exportDag(input: unknown) {
    const request = dagExportRequestSchema.parse(input)
    return dagExportResultSchema.parse(this.dagOrchestrator.export(this.getDagSnapshotOrThrow(request.sessionId), request.format))
  }

  dagLayer(input: unknown) {
    const request = dagLayerRequestSchema.parse(input)
    return { taskIds: this.dagOrchestrator.layer(this.getDagSnapshotOrThrow(request.sessionId), request.layerIndex) }
  }

  listDagAudit(): DagAuditEntry[] {
    return this.listDagAuditEntries()
  }

  private normalizeDagBuildInput(input: unknown): DagOrchestratorBuildInput {
    if (Array.isArray(input)) return { rows: input.map(item => this.asRecord(item)) }
    const record = this.asRecord(input)
    const parsed = dagBuildRequestSchema.safeParse(record)
    if (!parsed.success) {
      const graph = dagGraphSchema.safeParse(input)
      if (graph.success) return { graph: graph.data }
      throw parsed.error
    }
    if (parsed.data.csvPath) return { sessionId: parsed.data.sessionId, rows: this.rowsFromCsvPath(parsed.data.csvPath) }
    if (parsed.data.rows) return { sessionId: parsed.data.sessionId, rows: parsed.data.rows }
    if (parsed.data.graph) return { sessionId: parsed.data.sessionId, graph: parsed.data.graph }
    if (parsed.data.nodes) return { sessionId: parsed.data.sessionId, nodes: parsed.data.nodes }
    throw new Error('E_VALIDATION:dag build requires csvPath, rows, graph, or nodes')
  }

  private rowsFromCsvPath(csvPath: string): CsvTaskRow18[] {
    const content = readFileSync(resolve(csvPath), 'utf8')
    const parsed = this.csvParser.parse(content)
    const errors = [...parsed.errors, ...parsed.rows.flatMap(row => row.errors)]
    if (errors.length > 0) {
      const message = errors.slice(0, 5).map(error => `line ${error.line} ${error.column}: ${error.message}`).join('; ')
      throw new Error(`E_VALIDATION:${message}`)
    }
    return parsed.rows.map(row => {
      if (!row.row) throw new Error(`E_VALIDATION:line ${row.line} has no parsed CSV row`)
      return row.row
    })
  }

  private persistDagSnapshot(snapshot: DagSnapshot): void {
    const snapshots = [snapshot, ...this.listDagSnapshots().filter(item => item.sessionId !== snapshot.sessionId)].slice(0, 100)
    const existingAudit = this.listDagAuditEntries()
    const previousEntry = existingAudit.find(item => item.sessionId === snapshot.sessionId)
    const hash = snapshot.hash ?? createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
    const auditEntry = dagAuditEntrySchema.parse({
      type: 'dag:build',
      sessionId: snapshot.sessionId,
      hash,
      previousHash: previousEntry?.hash ?? null,
      sequence: (previousEntry?.sequence ?? 0) + 1,
      generatedAt: snapshot.generatedAt,
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
      warningCount: snapshot.warnings.length,
      layerCount: snapshot.layers.length,
      criticalPathLength: snapshot.criticalPath.length
    })
    this.store.set('dagSnapshots', snapshots)
    this.store.set('dagAudit', [auditEntry, ...existingAudit].slice(0, 200))
  }

  private listDagSnapshots(): DagSnapshot[] {
    return asArray(this.store.get('dagSnapshots', []), item => dagSnapshotSchema.parse(item))
  }

  private listDagAuditEntries(): DagAuditEntry[] {
    return asArray(this.store.get('dagAudit', []), (item, index) => this.normalizeDagAuditEntry(item, index))
  }

  private normalizeDagAuditEntry(item: unknown, index: number): DagAuditEntry {
    const parsed = dagAuditEntrySchema.safeParse(item)
    if (parsed.success) return parsed.data
    const record = this.asRecord(item)
    const hash = readStringValue(record.hash) ?? createHash('sha256').update(JSON.stringify(record)).digest('hex')
    return dagAuditEntrySchema.parse({
      type: 'dag:build',
      sessionId: readStringValue(record.sessionId) ?? 'unknown-session',
      hash,
      previousHash: readStringValue(record.previousHash),
      sequence: Math.max(1, Math.trunc(readNumberValue(record.sequence) ?? index + 1)),
      generatedAt: Math.max(0, Math.trunc(readNumberValue(record.generatedAt) ?? Date.now())),
      nodeCount: Math.max(0, Math.trunc(readNumberValue(record.nodeCount) ?? 0)),
      edgeCount: Math.max(0, Math.trunc(readNumberValue(record.edgeCount) ?? 0)),
      warningCount: Math.max(0, Math.trunc(readNumberValue(record.warningCount) ?? 0)),
      layerCount: Math.max(0, Math.trunc(readNumberValue(record.layerCount) ?? 0)),
      criticalPathLength: Math.max(0, Math.trunc(readNumberValue(record.criticalPathLength) ?? 0))
    })
  }

  private getDagSnapshotOrThrow(sessionId: string | undefined): DagSnapshot {
    if (!sessionId) throw new Error('E_NOT_FOUND:sessionId is required for stored DAG lookup')
    const snapshot = this.listDagSnapshots().find(item => item.sessionId === sessionId)
    if (!snapshot) throw new Error(`E_NOT_FOUND:DAG session ${sessionId} not found`)
    return snapshot
  }

  private asRecord(input: unknown): Record<string, unknown> {
    return typeof input === 'object' && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : {}
  }

  getWatchdogStatus() {
    return watchdogStatusSchema.parse(this.watchdog.status())
  }

  configureWatchdog(input: unknown) {
    const before = this.getWatchdogHistory()
    const status = watchdogStatusSchema.parse(this.watchdog.configure(input))
    this.queueWatchdogEventsSince(before)
    return status
  }

  registerWatchdogInstance(input: { instanceId: string; pid: number; tool: 'codex' | 'claude' | 'gemini' | 'cursor' | 'copilot'; alias?: string; mode?: 'lenient' | 'strict'; graceMs?: number; phase?: 'receiving-input' | 'thinking' | 'running' | 'awaiting-human'; actionPolicy?: 'restart' | 'fallback-tool' | 'escalate-model' | 'human-intervention' | 'log-only' }) {
    const before = this.getWatchdogHistory()
    const instance = this.watchdog.registerInstance(input)
    this.queueWatchdogEventsSince(before)
    return instance
  }

  recordWatchdogHeartbeat(input: { ts: number; instanceId: string; source: 'marker-file' | 'stdout' | 'cpu-pulse' | 'window-title' | 'http-health' | 'fs-activity' | 'hung-window' | 'network' | 'etw'; weight: number; detail?: Record<string, unknown> }) {
    const before = this.getWatchdogHistory()
    const heartbeat = this.watchdog.recordHeartbeat(input)
    this.queueWatchdogEventsSince(before)
    return heartbeat
  }

  async collectWatchdogHeartbeats(input: { sourceConfigByInstanceId?: Record<string, WatchdogCollectorSourceConfig>; now?: number } = {}) {
    const before = this.getWatchdogHistory()
    const result = await this.watchdogCollector.collect({
      instances: this.getWatchdogStatus().monitoredInstances,
      sourceConfigByInstanceId: input.sourceConfigByInstanceId,
      now: input.now
    })
    for (const beat of result.beats) {
      this.watchdog.recordHeartbeat(beat)
    }
    for (const failure of result.failures) {
      auditLogger.log('watchdog:collector-source', {
        instanceId: failure.instanceId,
        source: failure.source,
        errorCode: failure.errorCode,
        detail: failure.detail ?? null
      }, 'error', failure.message)
    }
    const status = watchdogStatusSchema.parse(this.watchdog.evaluate({ now: result.collectedAt }))
    this.queueWatchdogEventsSince(before)
    return { ...result, status }
  }

  evaluateWatchdog(input: { instanceId?: string; now?: number } = {}) {
    const before = this.getWatchdogHistory()
    const status = watchdogStatusSchema.parse(this.watchdog.evaluate(input))
    this.queueWatchdogEventsSince(before)
    return status
  }

  watchdogSelfCheck() {
    const before = this.getWatchdogHistory()
    const status = watchdogStatusSchema.parse(this.watchdog.selfCheck())
    this.queueWatchdogEventsSince(before)
    return status
  }

  async emitNotification(input: unknown) {
    if (!this.isFeatureEnabled('R8.C.notify.system')) {
      console.warn('R8.C.notify.system disabled; notification suppressed')
      return { id: randomUUID(), suppressed: true, aggregated: false, occurrenceCount: 1, deliveries: [] }
    }
    this.notificationSystem.setMainWindow(this.getMainWindow())
    const response = await this.notificationSystem.emit(input)
    this.store.set('notifications', this.notificationSystem.list({ includeDismissed: true }))
    return response
  }

  listNotifications(input: Partial<NotifyListRequest> = {}): DevhubNotification[] {
    this.notificationSystem.setMainWindow(this.getMainWindow())
    return this.notificationSystem.list(notifyListRequestSchema.parse(input))
  }

  // Single source of truth for the statusbar "通知" tile count. It MUST mirror
  // exactly what the notifications drawer shows (`notify.list()` with the same
  // default filter) so the badge and the drawer can never disagree — i.e. a
  // non-zero count always corresponds to visible drawer content.
  countUnreadNotifications(): number {
    return this.listNotifications().length
  }

  dismissNotification(input: { notificationId?: string; id?: string }) {
    const result = this.notificationSystem.dismiss(input)
    this.store.set('notifications', this.notificationSystem.list({ includeDismissed: true }))
    return result
  }

  configureNotificationChannel(input: ChannelConfig) {
    const config = this.notificationSystem.configureChannel(channelConfigSchema.parse(input))
    return config
  }

  invokeNotificationAction(input: { id: string; actionId: string }) {
    return this.notificationSystem.invokeAction(notifyInvokeActionRequestSchema.parse(input))
  }

  listActivePermissions() {
    const now = Date.now()
    return asArray(this.store.get('permissions', []), item => permissionGrantSchema.parse(item)).filter(item => item.expiresAt > now)
  }

  grantPermission(input: unknown) {
    const grant = permissionGrantSchema.parse(input)
    const next = [...this.listActivePermissions(), grant]
    this.store.set('permissions', next)
    return grant
  }

  listActivePermissionGrants(): PermissionTtlGrant[] {
    const now = Date.now()
    const active = this.readPermissionTtlGrants()
      .filter(grant => !grant.revokedAt && grant.expiresAt > now)
      .sort((left, right) => left.expiresAt - right.expiresAt)
    return permissionListActiveResponseSchema.parse({ grants: active, now }).grants
  }

  getPermissionTtlConfig() {
    const now = Date.now()
    return {
      policies: SENSITIVE_PERMISSION_OPERATIONS.map(op => this.getPermissionPolicy(op)),
      activeGrants: this.listActivePermissionGrants(),
      now,
      defaultTtlMs: DEFAULT_PERMISSION_TTL_MS,
      maxTtlMs: MAX_PERMISSION_TTL_MS
    }
  }

  requestPermission(input: unknown): PermissionTtlGrant {
    const request = permissionRequestSchema.parse(input)
    const policy = this.getPermissionPolicy(request.op)
    const ttlMs = request.ttlMs ?? policy.defaultTtlMs
    if (ttlMs > policy.maxTtlMs) throw Object.assign(new Error('E_VALIDATION:ttl exceeds operation maxTtlMs'), { code: 'E_VALIDATION' })
    if (policy.requireReason && !request.reason?.trim()) throw Object.assign(new Error('E_VALIDATION:reason is required for this permission operation'), { code: 'E_VALIDATION' })
    if (!this.recordPermissionRequestAllowed(request.op, policy)) throw Object.assign(new Error('E_RATE_LIMITED:permission request rate limit exceeded'), { code: 'E_RATE_LIMITED' })

    const now = Date.now()
    const grant = permissionTtlGrantSchema.parse({
      grantId: randomUUID(),
      op: request.op,
      scope: request.scope,
      grantedAt: now,
      ttlMs,
      expiresAt: now + ttlMs,
      monotonicGrantedAt: monotonicNowMs(),
      grantedBy: request.confirmedBy,
      reason: request.reason,
      revokedAt: null,
      usageCount: 0
    })
    this.store.set('permissionTtlGrants', [grant, ...this.readPermissionTtlGrants()].slice(0, 500))
    this.invalidatePermissionExpiryStreamPayload()
    auditLogger.log('permission:request', { op: grant.op, scope: grant.scope, grantId: grant.grantId, ttlMs: grant.ttlMs, confirmedBy: request.confirmedBy }, 'success')
    return grant
  }

  checkPermission(input: unknown): PermissionCheckResult {
    const request = permissionCheckRequestSchema.parse(input)
    const now = Date.now()
    const scopeKey = stableStringify(request.scope)
    const grants = this.readPermissionTtlGrants()
    const matching = grants.filter(grant => grant.op === request.op && stableStringify(grant.scope) === scopeKey)
    const active = matching.find(grant => !grant.revokedAt && grant.expiresAt > now)
    if (active) {
      const updated = grants.map(grant => grant.grantId === active.grantId
        ? permissionTtlGrantSchema.parse({ ...grant, usageCount: grant.usageCount + 1 })
        : grant)
      this.store.set('permissionTtlGrants', updated)
      auditLogger.log('permission:check-active', { op: request.op, scope: request.scope, grantId: active.grantId, remainingMs: Math.max(0, active.expiresAt - now) }, 'success')
      return permissionCheckResultSchema.parse({
        granted: true,
        grantId: active.grantId,
        expiresAt: active.expiresAt,
        remainingMs: Math.max(0, active.expiresAt - now),
        reason: 'active'
      })
    }

    const latest = matching.sort((left, right) => right.grantedAt - left.grantedAt)[0]
    const reason = latest?.revokedAt ? 'revoked' : latest && latest.expiresAt <= now ? 'expired' : 'never-granted'
    auditLogger.log('permission:check-denied', { op: request.op, scope: request.scope, reason }, 'refused', reason)
    return permissionCheckResultSchema.parse({ granted: false, reason })
  }

  revokePermissionGrant(input: unknown) {
    const request = permissionRevokeRequestSchema.parse(input)
    const now = Date.now()
    let revokedCount = 0
    const grants = this.readPermissionTtlGrants().map(grant => {
      if (grant.grantId !== request.grantId || grant.revokedAt) return grant
      revokedCount += 1
      return permissionTtlGrantSchema.parse({ ...grant, revokedAt: now })
    })
    this.store.set('permissionTtlGrants', grants)
    this.invalidatePermissionExpiryStreamPayload()
    auditLogger.log('permission:revoke', { grantId: request.grantId, revokedCount, confirmedBy: request.confirmedBy }, revokedCount > 0 ? 'success' : 'refused')
    return permissionRevokeResponseSchema.parse({ success: revokedCount > 0, revokedCount, revokedAt: now, confirmedBy: request.confirmedBy })
  }

  revokeAllPermissionGrants(input: unknown) {
    const request = permissionRevokeAllRequestSchema.parse(input)
    const now = Date.now()
    let revokedCount = 0
    const grants = this.readPermissionTtlGrants().map(grant => {
      if (grant.revokedAt || grant.expiresAt <= now) return grant
      revokedCount += 1
      return permissionTtlGrantSchema.parse({ ...grant, revokedAt: now })
    })
    this.store.set('permissionTtlGrants', grants)
    this.invalidatePermissionExpiryStreamPayload()
    auditLogger.log('permission:revoke-all', { revokedCount, confirmedBy: request.confirmedBy }, 'success')
    return permissionRevokeResponseSchema.parse({ success: true, revokedCount, revokedAt: now, confirmedBy: request.confirmedBy })
  }

  configurePermissionPolicy(input: unknown) {
    const confirmedBy = isRecord(input) && typeof input.confirmedBy === 'string' ? input.confirmedBy : ''
    if (confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const policyInput = isRecord(input)
      ? Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'confirmedBy'))
      : input
    const policy = permissionPolicySchema.parse(policyInput)
    if (policy.defaultTtlMs > policy.maxTtlMs) throw Object.assign(new Error('E_VALIDATION:defaultTtlMs must be less than or equal to maxTtlMs'), { code: 'E_VALIDATION' })
    const policies = { ...(this.store.get('permissionTtlPolicies', {}) ?? {}) }
    policies[policy.op] = policy
    this.store.set('permissionTtlPolicies', policies)
    auditLogger.log('permission:configure-policy', { op: policy.op, confirmedBy }, 'success')
    return permissionConfigurePolicyResponseSchema.parse({ success: true, policy, updatedAt: Date.now(), confirmedBy })
  }

  permissionExpiryStreamPayload() {
    const now = Date.now()
    const cachedPayload = this.cachedPermissionExpiryStreamPayload
    if (cachedPayload && now - this.lastPermissionExpiryStreamPayloadAt < PERMISSION_EXPIRY_STREAM_THROTTLE_MS) {
      auditLogger.log('permission:expiry-stream', { activeGrantCount: cachedPayload.grants.length, emittedAt: cachedPayload.emittedAt }, 'success')
      return cachedPayload
    }
    const payload = permissionExpiryStreamPayloadSchema.parse({
      emittedAt: now,
      grants: this.listActivePermissionGrants().map(grant => ({
        grantId: grant.grantId,
        op: grant.op,
        remainingMs: Math.max(0, grant.expiresAt - now),
        expiresAt: grant.expiresAt
      }))
    })
    this.cachedPermissionExpiryStreamPayload = payload
    this.lastPermissionExpiryStreamPayloadAt = now
    auditLogger.log('permission:expiry-stream', { activeGrantCount: payload.grants.length, emittedAt: payload.emittedAt }, 'success')
    return payload
  }

  async listDataOwnershipPaths(): Promise<DataOwnershipListPathsResponse> {
    const roots = await Promise.all(this.dataOwnershipRootDefinitions().map(root => this.summarizeDataOwnershipRoot(root)))
    return dataOwnershipListPathsResponseSchema.parse({
      generatedAt: Date.now(),
      roots
    })
  }

  async listDataOwnershipEntries(input: unknown = {}): Promise<DataOwnershipListEntriesResponse> {
    const request = dataOwnershipListEntriesRequestSchema.parse(input ?? {})
    const root = this.requireDataOwnershipRoot(request.rootId)
    const rootPath = resolve(root.path)
    const requestedRelativePath = request.relativePath.trim()
    const absolutePath = requestedRelativePath ? resolve(rootPath, requestedRelativePath) : rootPath
    const relativeFromRoot = relative(rootPath, absolutePath)
    if (relativeFromRoot.startsWith('..') || isAbsolute(relativeFromRoot)) {
      throw new Error('E_DATA_OWNERSHIP_PATH_OUT_OF_SCOPE')
    }

    const targetStat = await this.tryStatDataOwnershipPath(absolutePath)
    const entries: DataOwnershipListEntriesResponse['entries'] = []
    let entriesTruncated = false
    if (targetStat?.isDirectory()) {
      const dirents = await readdir(absolutePath, { withFileTypes: true })
      const sortedDirents = [...dirents].sort((left, right) => left.name.localeCompare(right.name))
      entriesTruncated = sortedDirents.length > DATA_OWNERSHIP_ENTRY_LIMIT
      for (const dirent of sortedDirents.slice(0, DATA_OWNERSHIP_ENTRY_LIMIT)) {
        const entryPath = join(absolutePath, dirent.name)
        const entryStat = await this.tryStatDataOwnershipPath(entryPath)
        if (!entryStat) continue
        entries.push({
          name: dirent.name,
          relativePath: relative(rootPath, entryPath),
          kind: entryStat.isDirectory() ? 'directory' : 'file',
          sizeBytes: entryStat.isDirectory() ? 0 : entryStat.size,
          updatedAt: Math.max(0, Math.floor(entryStat.mtimeMs))
        })
      }
    }

    return dataOwnershipListEntriesResponseSchema.parse({
      rootId: root.rootId,
      rootPath,
      relativePath: relativeFromRoot,
      absolutePath,
      kind: targetStat ? targetStat.isDirectory() ? 'directory' : 'file' : 'missing',
      exists: Boolean(targetStat),
      entries,
      entriesTruncated,
      generatedAt: Date.now()
    })
  }

  async exportDataOwnershipArchive(input: unknown = {}): Promise<BackupBundle> {
    const request: DataOwnershipExportAllRequest = dataOwnershipExportAllRequestSchema.parse(input ?? {})
    return this.createBackup({
      categories: [...DEFAULT_BACKUP_CATEGORIES],
      destPath: request.destPath,
      confirmedBy: request.confirmedBy,
      createdBy: 'user'
    })
  }

  async createBackup(input: unknown = {}): Promise<BackupBundle> {
    const request = backupCreateRequestSchema.parse(input ?? {})
    const categories = request.categories ?? legacyScopeToCategories(request.scope)
    return this.createClassifiedBackup({
      categories,
      destPath: request.destPath,
      createdBy: request.createdBy
    })
  }

  async exportClassifiedBackup(input: unknown): Promise<BackupBundle> {
    const request = backupExportClassifiedRequestSchema.parse(input)
    return this.createClassifiedBackup({
      categories: request.categories,
      destPath: request.destPath,
      createdBy: 'user'
    })
  }

  listBackups(): BackupBundle[] {
    const rawBackups = this.store.get('backups', [])
    if (!Array.isArray(rawBackups)) return []
    const parsed: BackupBundle[] = []
    for (const rawBackup of rawBackups) {
      const result = backupBundleSchema.safeParse(rawBackup)
      if (result.success) parsed.push(result.data)
    }
    return parsed.sort((left, right) => right.createdAt - left.createdAt)
  }

  getBackupSchedule(): BackupSchedule {
    return backupScheduleSchema.parse(this.store.get('backupSchedule', {}))
  }

  configureBackupSchedule(input: unknown) {
    const schedule = backupScheduleSchema.parse(input ?? {})
    this.assertSupportedBackupCron(schedule.cron)
    this.store.set('backupSchedule', schedule)
    this.syncBackupScheduleTask(schedule)
    return backupScheduleResultSchema.parse({ success: true, schedule, updatedAt: Date.now() })
  }

  async exportDiagnosticPack(input: unknown = {}): Promise<DiagnosticPackManifest> {
    const options = this.normalizeDiagnosticPackOptions(input)
    const packId = randomUUID()
    const createdAt = Date.now()
    const artifactPath = this.resolveDiagnosticArtifactPath(options.destPath, packId)
    const sectionsDir = join(artifactPath, 'sections')
    const warnings: string[] = []
    const redactionCounts: Record<string, number> = {}
    const sectionEntries: DiagnosticPackManifest['sections'] = []
    const rules = this.getDiagnosticRedactionRules(options)

    await mkdir(sectionsDir, { recursive: true })
    for (const section of this.effectiveDiagnosticSections(options)) {
      const collected = await this.collectDiagnosticSection(section, options)
      warnings.push(...collected.warnings)
      const rawContent = `${JSON.stringify(collected.payload, null, 2)}\n`
      const redactedContent = applyDiagnosticRedactions(rawContent, rules)
      mergeRedactionCounts(redactionCounts, redactedContent.counts)
      const relativePath = `sections/${diagnosticSectionFileName(section)}`
      const filePath = join(artifactPath, relativePath)
      await writeFile(filePath, redactedContent.text, 'utf8')
      sectionEntries.push({
        section,
        fileCount: collected.fileCount,
        sizeBytes: Buffer.byteLength(redactedContent.text, 'utf8'),
        sha256: sha256Hex(redactedContent.text),
        relativePath,
        redactionCount: Object.values(redactedContent.counts).reduce((total, count) => total + count, 0),
        warnings: collected.warnings
      })
    }

    const sizeBytes = sectionEntries.reduce((total, entry) => total + entry.sizeBytes, 0)
    const redactionsApplied = Object.values(redactionCounts).reduce((total, count) => total + count, 0)
    const manifest = diagnosticPackManifestSchema.parse({
      packId,
      createdAt,
      exportedAt: createdAt,
      artifactPath,
      zipPath: artifactPath,
      path: artifactPath,
      sizeBytes,
      bytes: sizeBytes,
      sectionsIncluded: sectionEntries.map(entry => entry.section),
      sections: sectionEntries,
      redactionsApplied,
      redactionCounts,
      schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
      appVersion: typeof app.getVersion === 'function' ? app.getVersion() : '0.0.0',
      warnings,
      noTelemetry: true
    })
    await writeFile(join(artifactPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    this.store.set('diagnostics', [manifest, ...this.listDiagnostics().filter(item => item.packId !== manifest.packId)].slice(0, 50))
    auditLogger.log('diagnostic:export', {
      packId,
      artifactPath,
      sections: manifest.sectionsIncluded,
      sizeBytes: manifest.sizeBytes,
      redactionsApplied: manifest.redactionsApplied
    }, 'success')
    return manifest
  }

  async previewDiagnosticPack(input: unknown = {}) {
    const options = this.normalizeDiagnosticPackOptions(input)
    const rules = this.getDiagnosticRedactionRules(options)
    const sections = []
    const warnings: string[] = []
    const redactionCounts: Record<string, number> = {}

    for (const section of this.effectiveDiagnosticSections(options)) {
      const collected = await this.collectDiagnosticSection(section, options)
      warnings.push(...collected.warnings)
      const rawContent = `${JSON.stringify(collected.payload, null, 2)}\n`
      const redactedContent = applyDiagnosticRedactions(rawContent, rules)
      mergeRedactionCounts(redactionCounts, redactedContent.counts)
      sections.push({
        section,
        sampleContent: redactedContent.text.slice(0, DIAGNOSTIC_PREVIEW_SAMPLE_LIMIT),
        sizeBytes: Buffer.byteLength(redactedContent.text, 'utf8'),
        redactionCount: Object.values(redactedContent.counts).reduce((total, count) => total + count, 0),
        warnings: collected.warnings
      })
    }

    return diagnosticPreviewSchema.parse({
      sections,
      totalEstimatedSize: sections.reduce((total, section) => total + section.sizeBytes, 0),
      redactionCounts,
      warnings
    })
  }

  listDiagnosticRedactionRules() {
    return diagnosticRedactionRulesResponseSchema.parse({ defaults: defaultDiagnosticRedactionRules(), custom: [] })
  }

  async captureDiagnosticScreenshot(input: unknown = {}): Promise<DiagnosticScreenshotResult> {
    const request = diagnosticScreenshotRequestSchema.parse(input ?? {})
    const capturedAt = Date.now()
    const target = request.mode === 'active-window' ? BrowserWindow.getFocusedWindow() : this.getMainWindow()
    if (!target || target.isDestroyed()) {
      return diagnosticScreenshotResultSchema.parse({
        success: false,
        mode: request.mode,
        sizeBytes: 0,
        warning: 'No live BrowserWindow is available for screenshot capture.',
        capturedAt
      })
    }
    try {
      const image = await target.webContents.capturePage()
      const buffer = image.toPNG()
      return diagnosticScreenshotResultSchema.parse({
        success: true,
        mode: request.mode,
        pngBase64: buffer.toString('base64'),
        sizeBytes: buffer.byteLength,
        warning: null,
        capturedAt
      })
    } catch (error) {
      return diagnosticScreenshotResultSchema.parse({
        success: false,
        mode: request.mode,
        sizeBytes: 0,
        warning: error instanceof Error ? error.message : String(error),
        capturedAt
      })
    }
  }

  listDiagnosticPacks() {
    return diagnosticListPacksResponseSchema.parse({ packs: this.listDiagnostics() })
  }

  listDiagnostics(): DiagnosticPackManifest[] {
    return asArray(this.store.get('diagnostics', []), item => {
      const manifest = diagnosticPackManifestSchema.safeParse(item)
      if (manifest.success) return manifest.data
      const record = item as Record<string, unknown>
      const exportedAt = typeof record.exportedAt === 'number' ? record.exportedAt : 0
      const path = String(record.path ?? '')
      return diagnosticPackManifestSchema.parse({
        packId: randomUUID(),
        createdAt: exportedAt,
        exportedAt,
        artifactPath: path,
        zipPath: path,
        path,
        sizeBytes: typeof record.bytes === 'number' ? record.bytes : 0,
        bytes: typeof record.bytes === 'number' ? record.bytes : 0,
        sectionsIncluded: ['observability-snapshot'],
        sections: [],
        redactionsApplied: 0,
        redactionCounts: {},
        schemaVersion: 'legacy',
        appVersion: 'legacy',
        warnings: ['legacy diagnostic record'],
        noTelemetry: true
      })
    }).filter(item => item.path.length > 0)
  }

  async listSkills(): Promise<{ skills: Skill[]; errors: SkillLoadError[] }> {
    const loadedAt = Date.now()
    const errors: SkillLoadError[] = []
    const byName = new Map<string, Skill>()

    const includeBuiltins = this.isFeatureEnabled('R8.C.skill.builtin')
    const includeUserSkills = this.isFeatureEnabled('R8.C.skill.library')

    if (includeBuiltins) {
      for (const builtin of BUILTIN_SKILLS) {
        byName.set(builtin.name, skillSchema.parse({ ...builtin.skill, loadedAt }))
      }
    }

    if (!includeUserSkills) {
      return { skills: Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name)), errors }
    }

    for (const root of this.skillUserRoots()) {
      if (!existsSync(root)) continue
      try {
        for (const entry of await readdir(root, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          const skillPath = join(root, entry.name, 'SKILL.md')
          if (!existsSync(skillPath)) continue
          const loaded = await this.loadUserSkill(skillPath, loadedAt)
          if ('skill' in loaded) {
            if (byName.has(loaded.skill.name)) this.auditUserSkillOverride(loaded.skill)
            byName.set(loaded.skill.name, loaded.skill)
          } else {
            errors.push(loaded.error)
          }
        }
      } catch (error) {
        errors.push(skillLoadErrorSchema.parse({
          filePath: root,
          errorCode: 'E_PERMISSION',
          message: error instanceof Error ? error.message : String(error),
          details: null
        }))
      }
    }

    return { skills: Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name)), errors }
  }

  cloudSyncDisabled() {
    const result = {
      ...this.triggerCloudSync({ direction: 'bidirectional', conflictPolicy: 'local-wins' }),
      code: 'E_SKILL_CLOUD_SYNC_DEFERRED'
    }
    auditLogger.log('skill:cloud-sync-disabled', { scheduledRelease: result.scheduledRelease, enabled: result.enabled }, 'refused', result.errorCode)
    return result
  }

  cloudSyncStatus(): CloudSyncStatus {
    const status = cloudSyncStatusSchema.parse({
      enabled: false,
      provider: 'none',
      lastSyncAt: null,
      pendingCount: 0,
      scheduledRelease: 'R9',
      errorCode: 'E_FEATURE_DEFERRED'
    })
    auditLogger.log('skill:cloud-sync-status', { scheduledRelease: status.scheduledRelease, enabled: status.enabled }, 'refused', status.errorCode)
    return status
  }

  triggerCloudSync(input: unknown): CloudSyncResult {
    cloudSyncRequestSchema.parse(input ?? { direction: 'bidirectional', conflictPolicy: 'local-wins' })
    const result = cloudSyncResultSchema.parse({
      success: false,
      errorCode: 'E_FEATURE_DEFERRED',
      code: 'E_FEATURE_DEFERRED',
      message: 'Skill cloud sync is deferred to R9 and performs no network calls in R8.',
      scheduledRelease: 'R9',
      enabled: false
    })
    auditLogger.log('skill:cloud-sync-trigger', { scheduledRelease: result.scheduledRelease, enabled: result.enabled }, 'refused', result.errorCode)
    return result
  }

  listRemoteCloudSkills() {
    const response = cloudSyncRemoteListResponseSchema.parse({
      skills: [],
      notice: 'feature deferred to R9',
      scheduledRelease: 'R9',
      enabled: false
    })
    auditLogger.log('skill:cloud-sync-list-remote', { scheduledRelease: response.scheduledRelease, enabled: response.enabled, remoteCount: 0 }, 'refused', 'E_FEATURE_DEFERRED')
    return response
  }

  ocrCapabilities(): OcrCapabilities {
    const capabilities = ocrCapabilitiesSchema.parse({
      enabled: false,
      reason: 'NO-OCR-INTEGRATION constraint',
      futureRelease: null
    })
    auditLogger.log('ocr:capabilities', { enabled: capabilities.enabled, futureRelease: capabilities.futureRelease }, 'refused', 'E_OCR_DISABLED')
    return capabilities
  }

  recognizeOcr(input: unknown): OcrDisabledResponse {
    ocrRecognizeRequestSchema.parse(input ?? {})
    const response = ocrDisabledResponseSchema.parse({
      success: false,
      code: 'E_OCR_DISABLED',
      errorCode: 'E_OCR_DISABLED',
      message: 'OCR is hard-disabled in R8 and no OCR engine, SDK, network call, or image decode is executed.',
      blocks: [],
      notice: 'OCR feature is intentionally disabled in R8; see master section 10 NO-OCR-INTEGRATION'
    })
    auditLogger.log('ocr:recognize', { enabled: false, blockCount: 0 }, 'refused', response.errorCode)
    return response
  }

  listOcrSupportedLanguages() {
    const response = ocrSupportedLanguagesResponseSchema.parse({ languages: [], notice: 'OCR disabled', enabled: false })
    auditLogger.log('ocr:list-supported-languages', { enabled: response.enabled, languageCount: 0 }, 'refused', 'E_OCR_DISABLED')
    return response
  }

  listIntegrationLibraries() {
    return R8A_INTEGRATION_MANIFEST.libraries
  }

  parseCliChunk(input: unknown): CliOutputEvent[] {
    const record = typeof input === 'string'
      ? { chunk: input, tool: 'unknown', stream: 'stdout' }
      : (input as Record<string, unknown>)
    const tool = this.parseToolName(record.tool)
    const stream = typeof record.stream === 'string' && ['stdout', 'stderr', 'title', 'system'].includes(record.stream)
      ? record.stream as CliOutputEvent['stream']
      : 'stdout'
    const chunk = String(record.chunk ?? record.line ?? '')
    const events = this.cliOutputParser.parseChunk({
      chunk,
      tool,
      stream,
      instanceId: typeof record.instanceId === 'string' ? record.instanceId : undefined,
      sessionId: typeof record.sessionId === 'string' ? record.sessionId : undefined,
      strategy: this.resolveParserStrategy(record.strategy, chunk),
      observedAt: Date.now()
    })

    if (events.length > 0) {
      const history = [...this.listCliEvents(), ...events].slice(-500)
      this.store.set('cliEvents', history)
      this.store.set('cliSessions', this.cliOutputParser.listSessions())
      const latest = events.at(-1)
      if (latest) this.getMainWindow()?.webContents.send('cli:event-stream', latest)
      this.queueMonitorSnapshotStream()
      for (const event of events) {
        this.emitClaudeStreamEvent(event)
        this.emitClaudeResultErrorNotification(event)
        this.requestClaudeStreamJsonRestartIfNeeded(record, event)
        void this.recordingEngine.recordStdout({
          tool: event.tool,
          stream: event.stream,
          line: event.line,
          progress: event.progress,
          confidence: event.confidence,
          phase: event.phase,
          observedAt: event.observedAt,
          eventType: event.eventType,
          rawSource: event.rawSource,
          instanceId: event.instanceId,
          sessionId: event.sessionId,
          payload: event.payload
        })
      }
      this.auditGeminiLowMatchRate(events)
    }
    return events
  }

  getClaudeCostSummary(input: { instanceId: string }): ClaudeCostSummary {
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCostUsd = 0
    let durationMs = 0

    for (const event of this.listCliEvents()) {
      if (event.tool !== 'claude' || event.instanceId !== input.instanceId) continue

      const usage = this.usageFromEvent(event)
      if (usage) {
        totalInputTokens = usage.input
        totalOutputTokens = usage.output
      }

      const payloadCost = event.payload?.costUsd
      if (typeof payloadCost === 'number' && payloadCost >= 0) totalCostUsd = payloadCost

      const payloadDurationMs = event.payload?.durationMs
      if (typeof payloadDurationMs === 'number' && Number.isFinite(payloadDurationMs) && payloadDurationMs >= 0) {
        durationMs = Math.trunc(payloadDurationMs)
      }

      const parsed = this.parseJsonLine(event.line)
      if (!parsed || typeof parsed !== 'object') continue
      const record = parsed as Record<string, unknown>
      if (typeof record.total_cost_usd === 'number' && record.total_cost_usd >= 0) totalCostUsd = record.total_cost_usd
      if (typeof record.duration_ms === 'number' && Number.isFinite(record.duration_ms) && record.duration_ms >= 0) durationMs = Math.trunc(record.duration_ms)
    }

    return claudeCostSummarySchema.parse({ totalInputTokens, totalOutputTokens, totalCostUsd, durationMs })
  }

  listClaudeStreamJsonRestarts(): ClaudeStreamJsonRestartRecord[] {
    return asArray(this.store.get('claudeStreamJsonRestarts', []), item => claudeStreamJsonRestartRecordSchema.parse(item))
  }

  requestClaudeStreamJsonRestart(input: unknown): ClaudeStreamJsonRestartRecord {
    const request = claudeStreamJsonRestartRequestSchema.parse(input)
    const restartCommand = this.normalizeClaudeStreamJsonRestartCommand(request)
    const existing = this.listClaudeStreamJsonRestarts().find(item => (
      item.instanceId === request.instanceId
      && item.reason === request.reason
      && (item.status === 'pending-confirmation' || item.status === 'confirmed' || item.status === 'running')
    ))
    if (existing) return existing

    const requestId = randomUUID()
    const actionId = `${CLAUDE_STREAM_JSON_RESTART_ACTION_PREFIX}${requestId}`
    const record = claudeStreamJsonRestartRecordSchema.parse({
      requestId,
      instanceId: request.instanceId,
      sessionId: request.sessionId ?? null,
      reason: request.reason,
      detectedLine: request.detectedLine,
      restartCommand,
      status: 'pending-confirmation',
      actionId,
      notificationId: null,
      confirmedBy: null,
      createdAt: Date.now(),
      confirmedAt: null,
      startedAt: null,
      endedAt: null,
      pid: null,
      exitCode: null,
      signal: null,
      error: null
    })

    this.notificationSystem.registerAction(actionId, async () => {
      await this.confirmClaudeStreamJsonRestart({ requestId, confirmedBy: 'notification-action' })
    })
    this.persistClaudeStreamJsonRestarts([record, ...this.listClaudeStreamJsonRestarts()].slice(0, 100))
    void this.emitNotification({
      level: 'WARN',
      source: 'ai-task',
      instanceId: record.instanceId,
      title: 'Claude stream-json restart requires confirmation',
      body: [
        `instanceId=${record.instanceId}`,
        `reason=${record.reason}`,
        `command=${record.restartCommand.command}`,
        `args=${record.restartCommand.args.join(' ')}`,
        `detected=${record.detectedLine}`
      ].join('\n'),
      channels: ['toast', 'statusbar'],
      actions: [{ label: 'Restart with stream-json', actionId }]
    }).then(response => {
      this.updateClaudeStreamJsonRestartRecord(record.requestId, { notificationId: response.id })
    }).catch(error => {
      auditLogger.log('ai:claude-stream-json-restart-notify', { requestId }, 'error', error instanceof Error ? error.message : String(error))
    })
    auditLogger.log('ai:claude-stream-json-restart-request', {
      requestId,
      instanceId: record.instanceId,
      reason: record.reason,
      command: record.restartCommand.command,
      originalPid: record.restartCommand.originalPid
    }, 'success')
    return record
  }

  async confirmClaudeStreamJsonRestart(input: unknown): Promise<ClaudeStreamJsonRestartRecord> {
    const request = claudeStreamJsonRestartConfirmRequestSchema.parse(input)
    const current = this.listClaudeStreamJsonRestarts().find(item => item.requestId === request.requestId)
    if (!current) throw new Error('E_NOT_FOUND:claude stream-json restart request')
    if (current.status === 'running' || current.status === 'exited') return current
    if (current.status === 'failed') throw new Error('E_VALIDATION:claude stream-json restart request already failed')

    const confirmed = this.updateClaudeStreamJsonRestartRecord(current.requestId, {
      status: 'confirmed',
      confirmedBy: request.confirmedBy,
      confirmedAt: Date.now()
    })
    return this.spawnClaudeStreamJsonRestart(confirmed)
  }

  getCliProgress(input: { tool?: string; limit?: number; instanceId?: string } = {}) {
    const tool = input.tool ? this.parseToolName(input.tool) : null
    const limit = Math.max(1, Math.min(Number(input.limit ?? 50), 200))
    const events = this.listCliEvents().filter(event => !tool || event.tool === tool).slice(-limit)
    return { events, latest: events.at(-1) ?? null, count: events.length, progress: input.instanceId ? this.cliOutputParser.getProgress(input.instanceId) : null }
  }

  getGeminiPatternStat(input: { instanceId?: string } = {}) {
    return this.cliOutputParser.getGeminiPatternStat({ instanceId: input.instanceId })
  }

  checkGeminiStdoutTimeouts(input: { now?: number; timeoutMs?: number } = {}): CliOutputEvent[] {
    const now = Math.max(0, Math.trunc(input.now ?? Date.now()))
    const timeoutMs = Math.max(1_000, Math.trunc(input.timeoutMs ?? GEMINI_STDOUT_TIMEOUT_MS))
    const timeoutEvents: CliOutputEvent[] = []

    for (const session of this.listCliSessions()) {
      if (session.tool !== 'gemini' || session.lastEventAt === null) continue
      const elapsedMs = now - session.lastEventAt
      if (elapsedMs < timeoutMs) continue
      const auditKey = `${session.sessionId}:${session.lastEventAt}:${timeoutMs}`
      if (this.auditedGeminiStdoutTimeoutKeys.has(auditKey)) continue
      this.auditedGeminiStdoutTimeoutKeys.add(auditKey)
      const event = cliOutputEventSchema.parse({
        tool: 'gemini',
        stream: 'system',
        line: `Gemini stdout timeout after ${elapsedMs}ms without a fresh parser event`,
        progress: null,
        confidence: 0.1,
        phase: 'error',
        observedAt: now,
        eventType: 'unknown',
        rawSource: 'heuristic',
        instanceId: session.instanceId,
        sessionId: session.sessionId,
        payload: {
          elapsedMs,
          kind: 'unknown',
          reason: 'no-stdout-timeout',
          timeoutMs
        }
      })
      timeoutEvents.push(event)
      auditLogger.log('ai:gemini-stdout-timeout', {
        elapsedMs,
        instanceId: session.instanceId,
        lastEventAt: session.lastEventAt,
        ruleVersion: this.getGeminiPatternStat({ instanceId: session.instanceId }).ruleVersion,
        sessionId: session.sessionId,
        severity: 'WARN',
        timeoutMs
      }, 'success', 'E_TIMEOUT')
    }

    if (timeoutEvents.length > 0) {
      this.store.set('cliEvents', [...this.listCliEvents(), ...timeoutEvents].slice(-500))
      const latest = timeoutEvents.at(-1)
      if (latest) this.getMainWindow()?.webContents.send('cli:event-stream', latest)
      this.queueMonitorSnapshotStream()
    }
    return timeoutEvents
  }

  reloadGeminiRules(input: { rules: readonly unknown[]; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy is required to reload Gemini parser rules')
    return { ...this.cliOutputParser.reloadGeminiRules(input.rules), confirmedBy: input.confirmedBy }
  }

  async startGeminiRuleWatcher(input: { force?: boolean } = {}): Promise<{ success: boolean; watchedPath: string | null; error: string | null }> {
    if (!this.isFeatureEnabled('R8.C.shim.gemini')) {
      return { success: false, watchedPath: null, error: 'E_FEATURE_DISABLED' }
    }

    const filePath = this.geminiPatternFilePath()
    if (this.geminiPatternWatcher && this.geminiPatternWatcherPath === filePath && !input.force) {
      return { success: true, watchedPath: filePath, error: null }
    }

    await this.closeGeminiPatternWatcher()
    try {
      await mkdir(dirname(filePath), { recursive: true })
      const chokidar = await import('chokidar')
      const watcher = chokidar.watch(filePath, {
        persistent: false,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100
        },
        atomic: true,
        usePolling: false,
        ignorePermissionErrors: true
      })
      watcher.on('add', changedPath => { void this.reloadGeminiRulesFromFile(changedPath, 'add') })
      watcher.on('change', changedPath => { void this.reloadGeminiRulesFromFile(changedPath, 'change') })
      watcher.on('unlink', changedPath => {
        auditLogger.log('ai:gemini-rule-watch', { event: 'unlink', filePath: changedPath }, 'refused', 'E_NOT_FOUND')
      })
      watcher.on('error', error => {
        const message = error instanceof Error ? error.message : String(error)
        auditLogger.log('ai:gemini-rule-watch', { event: 'error', filePath }, 'error', message)
      })
      this.geminiPatternWatcher = watcher
      this.geminiPatternWatcherPath = filePath
      await new Promise<void>(resolveWatcher => {
        let settled = false
        const settle = () => {
          if (settled) return
          settled = true
          resolveWatcher()
        }
        watcher.once('ready', settle)
        watcher.once('error', settle)
        setTimeout(settle, 500)
      })
      if (existsSync(filePath)) void this.reloadGeminiRulesFromFile(filePath, 'initial')
      auditLogger.log('ai:gemini-rule-watch:start', { filePath, polling: false }, 'success')
      return { success: true, watchedPath: filePath, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      auditLogger.log('ai:gemini-rule-watch:start', { filePath }, 'error', message)
      return { success: false, watchedPath: null, error: message }
    }
  }

  listCliSessions() {
    const live = this.cliOutputParser.listSessions()
    if (live.length > 0) return live
    return asArray(this.store.get('cliSessions', []), item => parseSessionSchema.parse(item))
  }

  selectCliStrategy(input: { sessionId?: string; instanceId?: string; strategy: ParserStrategy }) {
    const strategy = parserStrategySchema.parse(input.strategy)
    const previous = this.cliOutputParser.listSessions().find(session => (
      input.sessionId ? session.sessionId === input.sessionId : input.instanceId ? session.instanceId === input.instanceId : false
    ))
    const session = this.cliOutputParser.selectStrategy({ sessionId: input.sessionId, instanceId: input.instanceId, strategy })
    this.store.set('cliSessions', this.cliOutputParser.listSessions())
    this.store.set('cliStrategyAudit', [{
      type: 'cli:select-strategy',
      sessionId: session.sessionId,
      instanceId: session.instanceId,
      fromStrategy: previous?.strategy ?? session.strategy,
      toStrategy: session.strategy,
      changedAt: Date.now()
    }, ...this.listCliStrategyAudit()].slice(0, 200))
    return { success: true, session }
  }

  listCliStrategyAudit(): CliStrategyAuditEntry[] {
    const value = this.store.get('cliStrategyAudit', [])
    if (!Array.isArray(value)) return []
    const entries: CliStrategyAuditEntry[] = []
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      try {
        entries.push({
          type: 'cli:select-strategy',
          sessionId: String(record.sessionId),
          instanceId: String(record.instanceId),
          fromStrategy: parserStrategySchema.parse(record.fromStrategy),
          toStrategy: parserStrategySchema.parse(record.toStrategy),
          changedAt: typeof record.changedAt === 'number' && Number.isFinite(record.changedAt) ? record.changedAt : 0
        })

      } catch {
        continue
      }
    }
    return entries
  }

  async installCliShim(input: { tool: string; confirmedBy?: string }) {
    return this.installShim(input)
  }

  async installShim(input: { tool: string; confirmedBy?: string }) {
    const installed = await this.shimRegistry.install({ tool: this.parseShimTool(input.tool), confirmedBy: input.confirmedBy })
    const pipeServer = await this.shimRegistry.startFrameServer(installed.manifest, (frame, tool) => {
      this.parseCliChunk({
        tool,
        stream: frame.source,
        chunk: frame.line,
        instanceId: `${tool}-${frame.realPid ?? frame.shimPid}`,
        sessionId: `shim-${frame.shimPid}`,
        strategy: tool === 'claude' ? 'ndjson' : tool === 'gemini' ? 'line' : 'shim',
        command: installed.manifest.realExePath,
        args: frame.restartArgs ?? frame.argv ?? [],
        cwd: frame.cwd,
        originalPid: frame.realPid,
        requiresUserConfirmation: frame.requiresUserConfirmation,
        fallbackReason: frame.fallbackReason
      })
    })
    return { ...installed, pipeServer }
  }

  async ensureShimReconciliation() {
    const result = await this.shimRegistry.ensureInstalledShims()
    if (result.removed.length > 0) {
      auditLogger.log('shim:ensure', {
        checkedAt: result.checkedAt,
        kept: result.kept.map(manifest => manifest.toolName),
        removed: result.removed.map(item => ({ toolName: item.manifest.toolName, reason: item.reason }))
      }, 'success')
    }
    return result
  }

  async uninstallShim(input: { tool: string; confirmedBy?: string }) {
    return this.shimRegistry.uninstall({ tool: this.parseShimTool(input.tool), confirmedBy: input.confirmedBy })
  }

  listShimStatus() {
    return this.shimRegistry.status()
  }

  debugCliTitleSample(input: { title: string; tool?: string; instanceId?: string }) {
    return this.parseCliChunk({ tool: input.tool ?? 'cursor', stream: 'title', chunk: input.title, instanceId: input.instanceId, strategy: 'line' })
  }

  async detectTools(input: { force?: boolean } = {}): Promise<ToolDetectionState> {
    const startedAt = performance.now()
    const tools = Object.keys(TOOL_DETECT_COMMANDS) as R8ToolName[]
    const settled = await Promise.allSettled(tools.map(tool => this.detectTool({ tool, force: input.force })))
    const checkedAt = Date.now()
    const results = settled.map((result, index) => result.status === 'fulfilled'
      ? result.value
      : toolDetectResultSchema.parse({
          tool: tools[index],
          found: false,
          version: null,
          path: null,
          detectStrategy: 'not-found',
          recommendedParser: null,
          capabilities: [],
          errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          checkedAt
        }))
    const state = toolDetectionStateSchema.parse({
      results,
      lastFullScanAt: checkedAt,
      scanDurationMs: Math.round(performance.now() - startedAt),
      errors: results.flatMap(result => result.errors)
    })
    this.store.set('toolDetectionState', state)
    auditLogger.log('cli:detect-all', {
      durationMs: state.scanDurationMs,
      tools: state.results.map(result => result.tool),
      found: state.results.filter(result => result.found).map(result => result.tool)
    }, 'success')
    this.emitToolDetectionState(state)
    return state
  }

  async detectTool(input: { tool: string; force?: boolean }): Promise<ToolDetectResult> {
    const tool = this.parseToolName(input.tool)
    const spec = TOOL_DETECT_COMMANDS[tool]
    const override = this.getToolOverrides()[tool]
    const cache = this.store.get('toolDetectCache', {}) ?? {}
    const cached = cache[tool]
    if (!input.force && cached) {
      const parsed = toolDetectResultSchema.safeParse(cached)
      if (parsed.success && Date.now() - parsed.data.checkedAt < 300_000) {
        if (parsed.data.found && (!override || (parsed.data.detectStrategy === 'user-override' && parsed.data.path === override))) {
          return parsed.data
        }
      }
    }

    if (override) {
      const checkedAt = Date.now()
      const result = await this.execVersionProbe(override, spec.args, checkedAt, tool, 'user-override')
      const normalized = toolDetectResultSchema.parse({
        ...result,
        recommendedParser: result.found ? spec.parser : null,
        capabilities: result.found ? spec.capabilities : []
      })
      return this.writeToolDetectCache(tool, normalized)
    }

    const moduleListResult = this.detectToolFromModuleList(tool)
    if (moduleListResult) {
      this.deleteToolDetectCache(tool)
      return moduleListResult
    }

    const command = override ?? spec.command
    const checkedAt = Date.now()
    const result = await this.execVersionProbe(command, spec.args, checkedAt, tool, override ? 'user-override' : 'path-env')
    const normalized = toolDetectResultSchema.parse({
      ...result,
      recommendedParser: result.found ? spec.parser : null,
      capabilities: result.found ? spec.capabilities : []
    })
    return this.writeToolDetectCache(tool, normalized)
  }

  setToolOverride(input: { tool: string; path: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const tool = this.parseToolName(input.tool)
    const path = String(input.path).trim()
    if (!path) throw new Error('E_VALIDATION:tool path required')
    if (!existsSync(path)) throw new Error('E_VALIDATION:tool override path does not exist')
    this.store.set('toolOverrides', { ...this.getToolOverrides(), [tool]: path })
    this.deleteToolDetectCache(tool)
    auditLogger.log('cli:set-tool-override', { tool, path, confirmedBy: input.confirmedBy }, 'success')
    return { tool, path, version: null }
  }

  clearToolOverride(input: { tool: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const tool = this.parseToolName(input.tool)
    const overrides = this.getToolOverrides()
    const previousPath = overrides[tool] ?? null
    const nextOverrides = { ...overrides }
    delete nextOverrides[tool]
    this.store.set('toolOverrides', nextOverrides)
    this.deleteToolDetectCache(tool)
    auditLogger.log('cli:clear-tool-override', { tool, previousPath, confirmedBy: input.confirmedBy }, 'success')
    return { tool, cleared: previousPath !== null, previousPath }
  }

  validateSkillYaml(input: unknown) {
    const request = input as Record<string, unknown>
    const yaml = typeof request.yaml === 'string' ? request.yaml : typeof request.text === 'string' ? request.text : ''
    if (!yaml.trim()) return { success: false, error: 'E_SKILL_YAML_EMPTY', frontmatter: null }
    try {
      const frontmatter = this.extractSkillFrontmatter(yaml)
      const parsed = skillFrontmatterSchema.safeParse(frontmatter)
      if (!parsed.success) return { success: false, error: fromZodError(parsed.error, { prefix: undefined }).message, frontmatter }
      return { success: true, error: null, frontmatter: parsed.data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), frontmatter: null }
    }
  }

  validateSkillEditor(input: unknown): SkillValidationResult {
    const request = input as Record<string, unknown>
    const yaml = typeof request.yaml === 'string' ? request.yaml : typeof request.text === 'string' ? request.text : ''
    if (!yaml.trim()) {
      return skillValidationResultSchema.parse({
        valid: false,
        yamlErrors: [{ line: 0, column: 0, message: 'YAML frontmatter is required', severity: 'error' }],
        schemaErrors: []
      })
    }

    try {
      const frontmatter = this.extractSkillFrontmatter(yaml)
      const parsed = skillFrontmatterSchema.safeParse(frontmatter)
      const schemaErrors = parsed.success
        ? []
        : parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: fromZodIssue(issue, { prefix: undefined }).message }))
      return skillValidationResultSchema.parse({ valid: schemaErrors.length === 0, yamlErrors: [], schemaErrors })
    } catch (error) {
      return skillValidationResultSchema.parse({ valid: false, yamlErrors: [this.toSkillYamlIssue(error)], schemaErrors: [] })
    }
  }

  listBuiltinSkills() {
    if (!this.isFeatureEnabled('R8.C.skill.builtin')) return { names: [], skills: [] }
    return {
      names: BUILTIN_SKILLS.map(skill => skill.name),
      skills: BUILTIN_SKILLS.map(skill => skillSchema.parse({ ...skill.skill, loadedAt: Date.now() }))
    }
  }

  enqueueCsvRow(input: unknown): TaskRun {
    const row = this.toRuntimeCsvRow(input)
    const sessionId = row.group ?? `csv-${randomUUID()}`
    const before = this.listTaskStateTransitions()
    const task = this.taskQueue.enqueueRows({ sessionId, rows: [{ ...row, group: sessionId }] }).tasks[0]
    this.queueTaskStateTransitionsSince(before)
    return task
  }

  listTasks(input: { sessionId?: string } = {}): TaskRun[] {
    return this.taskQueue.listTasks(input)
  }

  async exportTaskResults(input: unknown = {}): Promise<TaskResultExportResult> {
    const request = taskResultExportRequestSchema.parse(input ?? {})
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const scopedTasks = this.listTasks(request.sessionId ? { sessionId: request.sessionId } : {})
    const runIdFilter = request.runIds ? new Set(request.runIds) : null
    const tasks = runIdFilter ? scopedTasks.filter(task => runIdFilter.has(task.runId)) : scopedTasks
    if (runIdFilter && tasks.length !== runIdFilter.size) {
      const found = new Set(tasks.map(task => task.runId))
      const missing = [...runIdFilter].filter(runId => !found.has(runId))
      throw new Error(`E_NOT_FOUND:task run(s) not found: ${missing.join(', ')}`)
    }

    const exportedAt = Date.now()
    const scope = runIdFilter ? 'runs' : request.sessionId ? 'session' : 'all'
    const artifactDir = resolve(request.outputDir ?? join(
      this.resolveUserDataPath(),
      'task-results-exports',
      `${scope}-${this.safeArtifactSegment(request.sessionId ?? 'all')}-${exportedAt}`
    ))
    await mkdir(artifactDir, { recursive: true })

    const payload = taskResultExportPayloadSchema.parse({
      schemaVersion: '1.0.0',
      exportedAt,
      scope,
      sessionId: request.sessionId ?? null,
      taskCount: tasks.length,
      tasks
    })
    const formats = request.format === 'both' ? ['json', 'csv'] as const : [request.format] as const
    const fileBase = `task-results-${scope}-${this.safeArtifactSegment(request.sessionId ?? 'all')}-${exportedAt}`
    const files: TaskResultExportResult['files'] = []

    for (const format of formats) {
      const content = format === 'json'
        ? `${JSON.stringify(payload, null, 2)}\n`
        : this.serializeTaskResultsCsv(tasks)
      const filePath = join(artifactDir, `${fileBase}.${format}`)
      await writeFile(filePath, content, 'utf8')
      files.push({
        format,
        path: filePath,
        bytes: Buffer.byteLength(content, 'utf8'),
        sha256: sha256Hex(content),
        mimeType: format === 'json' ? 'application/json' : 'text/csv'
      })
    }

    const result = taskResultExportResultSchema.parse({
      success: true,
      scope,
      sessionId: request.sessionId ?? null,
      runIds: tasks.map(task => task.runId),
      taskCount: tasks.length,
      exportedAt,
      artifactDir,
      files
    })
    auditLogger.log('task:export-results', {
      scope,
      sessionId: result.sessionId,
      taskCount: result.taskCount,
      artifactDir: result.artifactDir,
      formats: result.files.map(file => file.format),
      confirmedBy: request.confirmedBy
    }, 'success')
    return result
  }

  queueStats(input: { sessionId?: string; concurrent?: number } = {}) {
    return this.taskQueue.getStats(input)
  }

  startReadyTasks(input: { sessionId: string; concurrent?: number; parallelGroupOverrides?: Record<string, number> }) {
    const before = this.listTaskStateTransitions()
    const result = this.taskQueue.startReadyTasks(input)
    this.queueTaskStateTransitionsSince(before)
    this.triggerCsvTaskStartInjects(result.started)
    return result
  }

  completeTaskRun(input: { runId: string; exitCode: number; errorCode?: string | null; errorMessage?: string | null }) {
    const before = this.listTaskStateTransitions()
    const task = this.taskQueue.completeTask(input)
    this.queueTaskStateTransitionsSince(before)
    this.queueOnFailSkillExecution(task, input)
    return task
  }

  private queueOnFailSkillExecution(task: TaskRun, failure: { exitCode: number; errorCode?: string | null; errorMessage?: string | null }): void {
    if (task.status !== 'awaiting-human') return
    if (task.row.on_fail !== 'execute-skill') return
    if (task.errorCode !== 'ON_FAIL_EXECUTE_SKILL_RUNNING') return
    if (!task.row.execute_skill) return
    void this.executeOnFailSkill(task, failure)
      .catch(error => {
        auditLogger.log('task:on-fail-skill', {
          runId: task.runId,
          taskId: task.taskId ?? task.row.id,
          sessionId: task.sessionId ?? null,
          skillName: task.row.execute_skill
        }, 'error', error instanceof Error ? error.message : String(error))
      })
  }

  private triggerCsvTaskStartInjects(tasks: readonly TaskRun[]): void {
    for (const task of tasks) {
      if (task.row.allow_inject !== true) continue
      const actionId = randomUUID()
      const targetAlias = `${task.row.tool}-${task.row.id}`
      void this.executeInject({
        id: actionId,
        scenario: 'csv-task-driven',
        targetAlias,
        target: { selector: 'csv-row-alias', aliasOrId: task.row.id },
        text: task.row.prompt,
        mode: 'pty',
        modeFallback: ['clipboard-paste', 'sendinput'],
        confirmedBy: 'task-queue-start',
        taskId: task.taskId ?? task.row.id
      })
        .then(result => {
          this.taskQueue.attachInjectAction({ runId: task.runId, injectActionId: result.actionId })
        })
        .catch(error => {
          const message = error instanceof Error ? error.message : String(error)
          this.appendInjectHistory({
            injectId: actionId,
            targetAlias,
            status: 'blocked',
            event: 'task-start-inject-error',
            at: Date.now(),
            confirmedBy: 'task-queue-start',
            error: message
          })
          this.taskQueue.attachInjectAction({ runId: task.runId, injectActionId: actionId })
        })
    }
  }

  private async executeOnFailSkill(task: TaskRun, failure: { exitCode: number; errorCode?: string | null; errorMessage?: string | null }): Promise<TaskRun> {
    const result = await this.runOnFailSkill(task, failure)
    const before = this.listTaskStateTransitions()
    const updated = this.taskQueue.recordOnFailSkillResult({
      runId: task.runId,
      success: result.success,
      artifactPath: result.artifactPath,
      exitCode: result.exitCode,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage
    })
    this.queueTaskStateTransitionsSince(before)
    auditLogger.log('task:on-fail-skill', {
      runId: task.runId,
      taskId: task.taskId ?? task.row.id,
      sessionId: task.sessionId ?? null,
      skillName: result.skillName,
      artifactPath: result.artifactPath,
      status: updated.status
    }, result.success ? 'success' : 'error', result.errorCode)
    return updated
  }

  listTaskStateTransitions(input: { sessionId?: string } = {}) {
    return this.taskQueue.listTransitions(input)
  }

  retryTask(input: { runId?: string; taskIds?: string[]; sessionId?: string; confirmedBy?: string }) {
    const before = this.listTaskStateTransitions()
    const updated = this.taskQueue.retry(input)
    this.queueTaskStateTransitionsSince(before)
    if (input.taskIds) return { success: true, scheduled: updated.filter(task => task.status === 'queued').length }
    return updated[0] ?? null
  }

  skipTask(input: { runId?: string; taskIds?: string[]; sessionId?: string; confirmedBy?: string }) {
    const before = this.listTaskStateTransitions()
    const updated = this.taskQueue.skip(input)
    this.queueTaskStateTransitionsSince(before)
    if (input.taskIds) return { success: true, skipped: updated.filter(task => task.status === 'skipped').length }
    return updated[0] ?? null
  }

  private markTaskAwaitingHuman(input: { runId: string; reason: string; confirmedBy?: string }) {
    const before = this.listTaskStateTransitions()
    const updated = this.taskQueue.markAwaitingHuman(input)
    this.queueTaskStateTransitionsSince(before)
    return updated[0] ?? null
  }

  pauseTaskSession(input: { sessionId: string; confirmedBy?: string }) {
    const before = this.listTaskStateTransitions()
    this.taskQueue.pauseSession(input)
    this.queueTaskStateTransitionsSince(before)
    return { success: true, sessionId: input.sessionId }
  }

  resumeTaskSession(input: { sessionId: string; confirmedBy?: string }) {
    const before = this.listTaskStateTransitions()
    this.taskQueue.resumeSession(input)
    this.queueTaskStateTransitionsSince(before)
    return { success: true, sessionId: input.sessionId }
  }

  abortTaskSession(input: { sessionId: string; confirmedBy?: string }) {
    const before = this.listTaskStateTransitions()
    this.taskQueue.abortSession(input)
    this.queueTaskStateTransitionsSince(before)
    return { success: true, sessionId: input.sessionId }
  }


  reloadTitleRules(input: { rules: readonly unknown[]; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy is required to reload title parser rules')
    const detector = this.cursorCopilotDetector.reloadRules(input.rules)
    const parser = this.cliOutputParser.reloadTitleRules(input.rules)
    return { success: true, applied: detector.applied + parser.applied, confirmedBy: input.confirmedBy }
  }

  async getSkill(input: { name: string }) {
    const name = String(input.name ?? '').trim()
    const result = await this.listSkills()
    const skill = result.skills.find(item => item.name === name)
    if (!skill) return { success: false, error: 'E_SKILL_NOT_FOUND', skill: null, text: null }
    const builtin = BUILTIN_SKILLS.find(item => item.name === skill.name)
    const text = skill.source === 'builtin' ? builtin?.markdown ?? null : await readFile(skill.filePath, 'utf8')
    return { success: true, error: null, skill, text }
  }

  async writeSkill(input: { name?: string; text?: string; yaml?: string; body?: string; script?: string; scriptLanguage?: string; filePath?: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const rawYaml = typeof input.yaml === 'string' ? input.yaml : typeof input.text === 'string' ? input.text : ''
    const validation = this.validateSkillYaml({ yaml: rawYaml })
    if (!validation.success || !validation.frontmatter) return { success: false, error: validation.error, path: null }
    const frontmatter = skillFrontmatterSchema.parse(validation.frontmatter)
    const name = String(input.name ?? frontmatter.name).trim() || frontmatter.name
    if (name !== frontmatter.name) throw new Error('E_VALIDATION:skill name must match frontmatter name')
    const directory = this.resolveSkillWriteDirectory(name, input.filePath)
    const scriptPath = this.assertSkillScriptPathForWrite(directory, frontmatter.scriptPath)
    await mkdir(directory, { recursive: true })
    if (typeof input.script === 'string') await writeFile(scriptPath, input.script, 'utf8')
    const path = join(directory, 'SKILL.md')
    const text = typeof input.yaml === 'string'
      ? this.composeSkillDocument(input.yaml, typeof input.body === 'string' ? input.body : '')
      : String(input.text ?? '')
    await writeFile(path, text, 'utf8')
    const loaded = await this.loadUserSkill(path, Date.now())
    if ('error' in loaded) return { success: false, error: loaded.error.message, path }
    auditLogger.log('skill:write', { name: loaded.skill.name, filePath: path, confirmedBy: input.confirmedBy }, 'success')
    this.queueSkillListStream('write')
    return { success: true, error: null, path, filePath: path, skill: loaded.skill, confirmedBy: input.confirmedBy }
  }

  async deleteSkill(input: { name: string; confirmedBy?: string }) {
    return this.uninstallSkill(input)
  }

  async installSkillFromPath(input: { sourcePath: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const sourcePath = resolve(input.sourcePath)
    const skillPath = sourcePath.endsWith('SKILL.md') ? sourcePath : join(sourcePath, 'SKILL.md')
    if (!existsSync(skillPath)) {
      return { success: false, skill: null, error: skillLoadErrorSchema.parse({ filePath: skillPath, errorCode: 'E_NOT_FOUND', message: 'SKILL.md not found', details: null }) }
    }
    const loaded = await this.loadUserSkill(skillPath, Date.now())
    if ('error' in loaded) return { success: false, skill: null, error: loaded.error }
    const targetDir = join(this.userSkillRoot(), loaded.skill.name)
    if (existsSync(targetDir)) {
      return { success: false, skill: null, error: skillLoadErrorSchema.parse({ filePath: targetDir, errorCode: 'E_VALIDATION', message: 'skill target already exists', details: { name: loaded.skill.name } }) }
    }
    await mkdir(this.userSkillRoot(), { recursive: true })
    await cp(dirname(skillPath), targetDir, { recursive: true, errorOnExist: true })
    const installed = await this.loadUserSkill(join(targetDir, 'SKILL.md'), Date.now())
    if ('skill' in installed) {
      auditLogger.log('skill:install-from-path', { name: installed.skill.name, sourcePath, targetDir, confirmedBy: input.confirmedBy }, 'success')
      this.queueSkillListStream('install')
      return { success: true, skill: installed.skill, error: null }
    }
    auditLogger.log('skill:install-from-path', { sourcePath, targetDir, confirmedBy: input.confirmedBy }, 'error', installed.error.message)
    return { success: false, skill: null, error: installed.error }
  }

  async uninstallSkill(input: { name: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const name = String(input.name ?? '').trim()
    const targetDir = this.userSkillDirectory(name)
    if (!targetDir || !existsSync(targetDir)) return { success: false, error: 'E_SKILL_NOT_FOUND' }
    await rm(targetDir, { recursive: true, force: true })
    auditLogger.log('skill:uninstall', { name, path: targetDir, confirmedBy: input.confirmedBy }, 'success')
    this.queueSkillListStream('uninstall')
    return { success: true, deletedAt: Date.now(), path: targetDir }
  }

  async forkBuiltinSkill(input: { name: string; targetName: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    if (!this.isFeatureEnabled('R8.C.skill.builtin')) return { success: false, error: 'E_FEATURE_DISABLED', newSkillPath: null }
    const builtin = BUILTIN_SKILLS.find(item => item.name === input.name)
    if (!builtin) return { success: false, error: 'E_NOT_FOUND', newSkillPath: null }
    const targetName = String(input.targetName ?? '').trim()
    const targetSkill = skillSchema.parse({
      ...builtin.skill,
      name: targetName,
      displayName: `${builtin.skill.displayName} Fork`,
      builtIn: false,
      source: 'user',
      loadedAt: Date.now(),
      filePath: join(this.userSkillRoot(), targetName, 'SKILL.md')
    })
    const targetDir = dirname(targetSkill.filePath)
    if (existsSync(targetDir)) return { success: false, error: 'E_VALIDATION', newSkillPath: null }
    await mkdir(targetDir, { recursive: true })
    await writeFile(targetSkill.filePath, this.renderSkillMarkdown(targetSkill), 'utf8')
    await writeFile(join(targetDir, 'run.js'), builtin.scriptContent, 'utf8')
    await writeFile(join(targetDir, 'README.md'), builtin.readme, 'utf8')
    auditLogger.log('skill:builtin-fork', { name: input.name, targetName, newSkillPath: targetDir, confirmedBy: input.confirmedBy }, 'success')
    this.queueSkillListStream('fork')
    return { success: true, error: null, newSkillPath: targetDir, skill: targetSkill }
  }

  builtinReadme(input: { name: string }) {
    if (!this.isFeatureEnabled('R8.C.skill.builtin')) return { success: false, error: 'E_FEATURE_DISABLED', markdown: null }
    const builtin = BUILTIN_SKILLS.find(item => item.name === input.name)
    if (!builtin) return { success: false, error: 'E_NOT_FOUND', markdown: null }
    return { success: true, error: null, markdown: builtin.readme }
  }

  listSkillTemplates(): SkillTemplate[] {
    return this.buildSkillTemplates()
  }

  async createSkillFromTemplate(input: { templateId: string; name: string; displayName: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const template = this.buildSkillTemplates().find(item => item.templateId === input.templateId)
    if (!template) throw new Error('E_VALIDATION:unknown skill template')
    const name = skillSchema.shape.name.parse(String(input.name ?? '').trim())
    const displayName = String(input.displayName ?? template.defaultName).trim() || template.defaultName
    const yaml = template.yaml
      .replace(/^name: .+$/m, `name: ${name}`)
      .replace(/^displayName: .+$/m, `displayName: ${JSON.stringify(displayName)}`)
    const body = template.body.replaceAll('{{displayName}}', displayName)
    const created = await this.writeSkill({ name, yaml, body, script: template.script, scriptLanguage: 'node', confirmedBy: input.confirmedBy })
    if (!created.success || !created.skill) throw new Error(typeof created.error === 'string' ? created.error : 'E_VALIDATION:template skill creation failed')
    return { filePath: created.filePath, skill: created.skill }
  }

  async reloadSkills(_input: { force?: boolean; watch?: boolean } = {}) {
    if (_input.watch) await this.startSkillWatcher({ force: _input.force })
    const result = await this.listSkills()
    this.queueSkillListStream('reload')
    return { success: true, reloadedAt: Date.now(), count: result.skills.length, errors: result.errors, skills: result.skills }
  }

  async reloadCsvGroups(_input: { force?: boolean; watch?: boolean; streamSource?: CsvRowStreamPayload['source'] } = {}) {
    if (!this.isFeatureEnabled('R8.C.csv.driver')) {
      throw new Error('E_FEATURE_DISABLED:R8.C.csv.driver')
    }
    if (_input.watch) await this.startCsvWatcher({ force: _input.force })
    const state = await this.csvTaskDriver.loadRoot(this.csvTaskRoot(), await this.skillNameSet())
    this.store.set('csvDriverState', state)
    const summary = csvReloadSummarySchema.parse({
      groupCount: state.groups.length,
      totalRows: state.groups.reduce((sum, group) => sum + group.rowCount, 0),
      validRows: state.groups.reduce((sum, group) => sum + group.validRowCount, 0),
      errorCount: state.groups.reduce((sum, group) => sum + group.errors.length, 0),
      groups: state.groups
    })
    auditLogger.log('csv:reload', {
      force: Boolean(_input.force),
      watch: Boolean(_input.watch),
      groupCount: summary.groupCount,
      totalRows: summary.totalRows,
      validRows: summary.validRows,
      errorCount: summary.errorCount
    }, 'success')
    this.queueCsvRowStream(_input.streamSource ?? 'reload', summary)
    return summary
  }

  listCsvGroups(): CsvFileGroup[] {
    const parsed = csvDriverStateSchema.safeParse(this.store.get('csvDriverState'))
    return parsed.success ? parsed.data.groups : []
  }

  getCsvGroup(input: { groupId: string }): CsvFileGroup | null {
    return this.listCsvGroups().find(group => group.groupId === input.groupId) ?? null
  }

  async exportCsvTemplate(input: { savePath: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    return this.csvTaskDriver.exportTemplate(input.savePath)
  }

  async startCsvWatcher(input: { force?: boolean } = {}): Promise<{ success: boolean; watchedRoots: string[]; error: string | null }> {
    if (!this.isFeatureEnabled('R8.C.csv.driver')) {
      return { success: false, watchedRoots: [], error: 'E_FEATURE_DISABLED' }
    }

    const root = this.csvTaskRoot()
    if (this.csvWatcher && this.csvWatcherRoot === root && !input.force) {
      return { success: true, watchedRoots: [root], error: null }
    }

    this.closeCsvWatcher()
    await mkdir(root, { recursive: true })
    try {
      const watcher = new CsvFileWatcher()
      watcher.start(root, event => this.handleCsvWatcherEvent(event))
      this.csvWatcher = watcher
      this.csvWatcherRoot = root
      auditLogger.log('csv:watcher-start', { root, depth: 1, polling: false }, 'success')
      return { success: true, watchedRoots: [root], error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      auditLogger.log('csv:watcher-start', { root }, 'error', message)
      return { success: false, watchedRoots: [], error: message }
    }
  }

  enqueueCsvDriverRow(input: { groupId: string; rowIndex: number }): { taskRunId: string; task: TaskRun } {
    const group = this.getCsvGroup({ groupId: input.groupId })
    if (!group) throw new Error('E_NOT_FOUND:csv group not loaded')
    const row = group.rows.find(item => item.rowIndex === input.rowIndex)
    if (!row || !row.runtimeRow) throw new Error('E_VALIDATION:csv row is not valid')
    const result = this.taskQueue.enqueueRows({ sessionId: group.groupId, rows: [{ ...row.runtimeRow, group: group.groupId }] })
    return { taskRunId: result.taskRunIds[0], task: result.tasks[0] }
  }

  enqueueCsvGroup(input: { groupId: string; filter?: { tags?: string[] }; concurrent?: number; resume?: boolean; forceRerun?: string[]; parallelGroupOverrides?: Record<string, number> }): { taskRunIds: string[]; tasks: TaskRun[]; skipped: number; rerunChanged: number } {
    const group = this.getCsvGroup({ groupId: input.groupId })
    if (!group) throw new Error('E_NOT_FOUND:csv group not loaded')
    const tags = new Set(input.filter?.tags ?? [])
    const rows = group.rows
      .filter(row => row.runtimeRow && (tags.size === 0 || row.runtimeRow.tags?.split(',').some(tag => tags.has(tag.trim()))))
      .map(row => ({ ...(row.runtimeRow as RuntimeCsvTaskRow), group: group.groupId }))
    return this.taskQueue.enqueueRows({
      sessionId: group.groupId,
      rows,
      concurrent: input.concurrent ?? group.metadata.concurrentMax,
      resume: input.resume,
      forceRerun: input.forceRerun,
      parallelGroupOverrides: input.parallelGroupOverrides
    })
  }

  generateCsvCommand(input: unknown) {
    const request = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}
    if (typeof request.csvPath === 'string') {
      const command = this.csvTaskDriver.launchCommand(request.csvPath, {
        runner: request.runner === 'devhub' || request.runner === 'python' || request.runner === 'cli' ? request.runner : undefined,
        concurrent: typeof request.concurrent === 'number' ? request.concurrent : undefined,
        resume: request.resume === true,
        dryRun: request.dryRun === true
      })
      const copyToClipboard = request.copyToClipboard !== false
      if (copyToClipboard) clipboard.writeText(command)
      return {
        command,
        copyToClipboard,
        commandFilePath: this.writeLastCsvCommand(command),
        generatedAt: Date.now()
      }
    }
    const row = this.toRuntimeCsvRow(input)
    const cwd = row.cwd ?? process.cwd()
    const command = row.tool === 'codex'
      ? ['codex', 'exec', row.prompt]
      : row.tool === 'claude'
        ? ['claude', '--print', row.prompt]
        : row.tool === 'gemini'
          ? ['gemini', '-p', row.prompt]
          : [row.tool, row.prompt]
    return { tool: row.tool, cwd, command, dryRun: row.dry_run, generatedAt: Date.now() }
  }

  async launchCsv(input: unknown) {
    if (!this.isFeatureEnabled('R8.C.csv.launch')) throw new Error('E_FEATURE_DISABLED:R8.C.csv.launch')
    const options = csvLaunchOptionsSchema.parse(input)
    if (!options.confirmedBy || options.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const group = await this.csvTaskDriver.loadGroup(options.csvPath, await this.skillNameSet())
    const runner = options.runner ?? group.metadata.runner
    if (group.validRowCount === 0) throw new Error('E_CSV_INVALID:no valid CSV rows to launch')
    if (!options.dryRun) this.assertNoActiveCsvLaunch(group.filePath)
    if (runner === 'python') return this.launchPythonCsvSession(options, group)
    if (runner === 'cli') {
      if (!this.isFeatureEnabled('R8.C.csv.launch.cli')) throw new Error('E_FEATURE_DISABLED:R8.C.csv.launch.cli')
      const commandResult = this.generateCsvCommand({ csvPath: group.filePath, runner, concurrent: options.concurrent, resume: options.resume, dryRun: options.dryRun }) as { command: string; copyToClipboard: boolean; commandFilePath: string; generatedAt: number }
      const session = csvLaunchSessionSchema.parse({
        sessionId: randomUUID(),
        csvPath: group.filePath,
        runner,
        metadata: group.metadata,
        rowCount: group.rowCount,
        enqueued: 0,
        skipped: 0,
        startedAt: Date.now(),
        pid: null,
        status: 'command-generated',
        command: commandResult.command,
        error: null
      })
      this.persistCsvSession(session)
      this.auditCsvLaunch(session, group, options.concurrent)
      this.emitCsvSessionEvent(session.sessionId, 'command-generated', { command: session.command, commandFilePath: commandResult.commandFilePath, copyToClipboard: commandResult.copyToClipboard })
      return { success: true, session, group, command: session.command }
    }

    const rows = group.rows.filter(row => row.runtimeRow).map(row => ({ ...(row.runtimeRow as RuntimeCsvTaskRow), group: '' }))
    const sessionId = randomUUID()
    const dryRunDag = options.dryRun ? this.dagOrchestrator.build({ sessionId, rows }) : null
    const enqueueResult = options.dryRun ? { tasks: [] as TaskRun[], skipped: rows.length, rerunChanged: 0 } : this.taskQueue.enqueueRows({
      sessionId,
      rows: rows.map(row => ({ ...row, group: sessionId })),
      concurrent: options.concurrent ?? group.metadata.concurrentMax,
      resume: options.resume,
      forceRerun: options.forceRerun,
      parallelGroupOverrides: options.parallelGroupOverrides
    })
    const started = options.dryRun ? { started: [] as TaskRun[] } : this.taskQueue.startReadyTasks({
      sessionId,
      concurrent: options.concurrent ?? group.metadata.concurrentMax,
      parallelGroupOverrides: options.parallelGroupOverrides
    })
    const session = csvLaunchSessionSchema.parse({
      sessionId,
      csvPath: group.filePath,
      runner,
      metadata: { ...group.metadata, runner, concurrentMax: options.concurrent ?? group.metadata.concurrentMax },
      rowCount: group.rowCount,
      enqueued: enqueueResult.tasks.length,
      skipped: enqueueResult.skipped,
      startedAt: Date.now(),
      pid: null,
      status: options.dryRun ? 'dry-run' : 'running',
      command: null,
      error: group.errors.length > 0 ? `${group.errors.length} csv validation issue(s)` : enqueueResult.rerunChanged > 0 ? `${enqueueResult.rerunChanged} task(s) queued because rowHash changed` : null
    })
    this.persistCsvSession(session)
    this.auditCsvLaunch(session, group, options.concurrent)
    this.emitCsvSessionEvent(session.sessionId, 'session-start', { runner, rowCount: group.rowCount, dryRun: options.dryRun })
    for (const task of started.started) {
      this.emitCsvSessionEvent(session.sessionId, 'task-start', { taskId: task.taskId, runId: task.runId, tool: task.row.tool, status: task.status })
      this.emitCsvSessionEvent(session.sessionId, 'task-progress', { taskId: task.taskId, runId: task.runId, percent: 0.01 })
    }
    return { success: true, session, group, tasks: started.started.length > 0 ? started.started : enqueueResult.tasks, dryRun: options.dryRun, dag: dryRunDag }
  }

  launchCsvRow(input: { row: unknown; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const task = this.enqueueCsvRow(input.row)
    const command = this.generateCsvCommand(task.row)
    const session = { sessionId: `csv-${randomUUID()}`, taskRunId: task.runId, rowId: task.row.id, command, status: 'queued', createdAt: Date.now(), confirmedBy: input.confirmedBy }
    this.store.set('csvSessions', [session, ...this.listCsvSessions()].slice(0, 500))
    return { success: true, task, session, command, note: 'queued only; external CLI success requires a real executor' }
  }

  listCsvSessions(): Array<CsvLaunchSession | Record<string, unknown>> {
    return asArray(this.store.get('csvSessions', []), item => {
      const parsed = csvLaunchSessionSchema.safeParse(item)
      return parsed.success ? parsed.data : { ...(item as Record<string, unknown>) }
    })
  }

  async getCsvRunnerInfo(input: { kind: 'devhub' | 'python' | 'cli' }) {
    const appVersion = typeof app.getVersion === 'function' ? app.getVersion() : '0.0.0-test'
    if (input.kind === 'devhub') return { available: true, version: appVersion, details: { inProcess: true, featureEnabled: this.isFeatureEnabled('R8.C.csv.launch') } }
    if (input.kind === 'cli') return { available: this.isFeatureEnabled('R8.C.csv.launch.cli'), version: appVersion, details: { bin: 'devhub run-csv', commandFileFallback: join(this.resolveUserDataPath(), 'last-csv-command.txt') } }
    if (!this.isFeatureEnabled('R8.C.csv.launch.python')) return { available: false, version: null, details: { reason: 'E_FEATURE_DISABLED', flag: 'R8.C.csv.launch.python' } }
    const [python, script] = await Promise.all([
      this.probePythonExecutable(),
      this.pythonScriptManager.verifyBatchScript().catch(error => ({ error: error instanceof Error ? error.message : String(error) }))
    ])
    return {
      available: Boolean(python) && !('error' in script),
      version: python?.version ?? null,
      details: python ? { command: python.command, prefixArgs: python.prefixArgs, script } : { reason: 'E_DEPENDENCY_MISSING', script }
    }
  }

  pauseCsvSession(input: { sessionId: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const session = this.requireCsvSession(input.sessionId)
    if (session.runner === 'python' && this.csvPythonChildren.has(session.sessionId)) {
      this.sendPythonCsvControl(session.sessionId, 'pause')
      const next = this.updateCsvSession(input.sessionId, { status: 'paused' })
      this.emitCsvSessionEvent(input.sessionId, 'session-end', { status: 'paused', transport: 'named-pipe' })
      return { success: true, session: next }
    }
    this.taskQueue.pauseSession({ sessionId: input.sessionId, confirmedBy: input.confirmedBy })
    const next = this.updateCsvSession(input.sessionId, { status: 'paused' })
    this.emitCsvSessionEvent(input.sessionId, 'session-end', { status: 'paused' })
    return { success: true, session: next }
  }

  resumeCsvSession(input: { sessionId: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const session = this.requireCsvSession(input.sessionId)
    if (session.runner === 'python' && this.csvPythonChildren.has(session.sessionId)) {
      this.sendPythonCsvControl(session.sessionId, 'resume')
      const next = this.updateCsvSession(input.sessionId, { status: 'running' })
      this.emitCsvSessionEvent(input.sessionId, 'session-start', { status: 'running', transport: 'named-pipe' })
      return { success: true, session: next }
    }
    this.taskQueue.resumeSession({ sessionId: input.sessionId, confirmedBy: input.confirmedBy })
    const next = this.updateCsvSession(input.sessionId, { status: 'running' })
    this.emitCsvSessionEvent(input.sessionId, 'session-start', { status: 'running' })
    return { success: true, session: next }
  }

  private sendPythonCsvControl(sessionId: string, action: 'pause' | 'resume'): void {
    const socket = this.csvPythonControlSockets.get(sessionId)
    if (!socket || socket.destroyed || !socket.writable) {
      throw new Error('E_DEPENDENCY_MISSING:python control pipe is not connected; abort is supported')
    }
    socket.write(JSON.stringify({ type: 'control', action, sessionId, ts: Date.now() }) + '\n')
  }

  abortCsvSession(input: { sessionId: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    this.requireCsvSession(input.sessionId)
    this.taskQueue.abortSession({ sessionId: input.sessionId, confirmedBy: input.confirmedBy })
    const child = this.csvPythonChildren.get(input.sessionId)
    if (child && !child.killed) child.kill()
    this.csvPythonChildren.delete(input.sessionId)
    this.closePythonPipeServer(input.sessionId)
    const next = this.updateCsvSession(input.sessionId, { status: 'aborted', error: 'aborted by confirmed operator' })
    this.emitCsvSessionEvent(input.sessionId, 'session-end', { status: 'aborted' })
    return { success: true, session: next }
  }

  private async launchPythonCsvSession(options: ReturnType<typeof csvLaunchOptionsSchema.parse>, group: CsvFileGroup) {
    if (!this.isFeatureEnabled('R8.C.csv.launch.python')) throw new Error('E_FEATURE_DISABLED:R8.C.csv.launch.python')
    const [python, script] = await Promise.all([this.probePythonExecutable(), this.pythonScriptManager.verifyBatchScript()])
    if (!python) throw new Error('E_DEPENDENCY_MISSING:python executable was not found')
    const sessionId = randomUUID()
    const concurrent = options.concurrent ?? group.metadata.concurrentMax
    const pipeName = process.platform === 'win32' ? `\\\\.\\pipe\\devhub-csv-${sessionId}` : join(tmpdir(), `devhub-csv-${sessionId}.sock`)
    const pipeServer = await this.startPythonCsvPipeServer(sessionId, pipeName).catch(() => null)
    if (pipeServer) this.csvPythonPipeServers.set(sessionId, pipeServer)
    const child = spawn(python.command, [
      ...python.prefixArgs,
      script.scriptPath,
      '--csv',
      group.filePath,
      '--session-id',
      sessionId,
      '--pipe',
      pipeName,
      '--concurrent',
      String(concurrent),
      ...(options.dryRun ? ['--dry-run'] : [])
    ], { windowsHide: true, timeout: Math.max(group.metadata.totalTimeoutMs ?? 30_000, 15_000), killSignal: 'SIGTERM' })
    const session = csvLaunchSessionSchema.parse({
      sessionId,
      csvPath: group.filePath,
      runner: 'python',
      metadata: { ...group.metadata, runner: 'python', concurrentMax: concurrent },
      rowCount: group.rowCount,
      enqueued: 0,
      skipped: 0,
      startedAt: Date.now(),
      pid: child.pid ?? null,
      status: 'running',
      command: `${python.command} ${[...python.prefixArgs, script.scriptPath, '--csv', group.filePath, '--session-id', sessionId].join(' ')}`,
      error: null
    })
    this.csvPythonChildren.set(sessionId, child)
    this.persistCsvSession(session)
    this.auditCsvLaunch(session, group, concurrent, { pythonVersion: python.version, scriptSha256: script.actualSha256, pipeName, pipeServer: Boolean(pipeServer) })
    this.attachPythonCsvBridge(session, child)
    this.emitCsvSessionEvent(sessionId, 'session-start', { runner: 'python', pid: child.pid ?? null, pipeName, transport: pipeServer ? 'named-pipe' : 'stdout-jsonl' })
    return { success: true, session, group, tasks: [], dryRun: options.dryRun }
  }

  private startPythonCsvPipeServer(sessionId: string, pipeName: string): Promise<Server> {
    return new Promise((resolveServer, reject) => {
      const server = createServer(socket => {
        socket.setEncoding('utf8')
        this.csvPythonControlSockets.set(sessionId, socket)
        socket.on('close', () => {
          if (this.csvPythonControlSockets.get(sessionId) === socket) this.csvPythonControlSockets.delete(sessionId)
        })
        socket.on('error', () => {
          if (this.csvPythonControlSockets.get(sessionId) === socket) this.csvPythonControlSockets.delete(sessionId)
        })
        socket.write(JSON.stringify({ type: 'control', action: 'resume', sessionId, ts: Date.now() }) + '\n')
        let buffer = ''
        socket.on('data', chunk => {
          buffer += chunk
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''
          for (const line of lines) this.handlePythonCsvLine(sessionId, line)
        })
        socket.on('end', () => {
          if (buffer.trim()) this.handlePythonCsvLine(sessionId, buffer.trim())
        })
      })
      const timer = setTimeout(() => {
        server.close()
        reject(new Error('E_NOT_FOUND:named pipe listen timeout'))
      }, 1_000)
      server.once('error', error => {
        clearTimeout(timer)
        reject(error)
      })
      server.listen(pipeName, () => {
        clearTimeout(timer)
        resolveServer(server)
      })
    })
  }

  private attachPythonCsvBridge(session: CsvLaunchSession, child: ChildProcessWithoutNullStreams): void {
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
      const lines = stdout.split(/\r?\n/)
      stdout = lines.pop() ?? ''
      for (const line of lines) this.handlePythonCsvLine(session.sessionId, line)
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
      const lines = stderr.split(/\r?\n/)
      stderr = lines.pop() ?? ''
      for (const line of lines.filter(Boolean)) this.emitCsvSessionEvent(session.sessionId, 'session-error', { stderr: line })
    })
    child.once('error', error => {
      this.csvPythonChildren.delete(session.sessionId)
      this.closePythonPipeServer(session.sessionId)
      this.updateCsvSession(session.sessionId, { status: 'failed', error: error.message })
      this.emitCsvSessionEvent(session.sessionId, 'session-error', { error: error.message })
    })
    child.once('close', code => {
      this.csvPythonChildren.delete(session.sessionId)
      this.closePythonPipeServer(session.sessionId)
      if (stdout.trim()) this.handlePythonCsvLine(session.sessionId, stdout.trim())
      if (stderr.trim()) this.emitCsvSessionEvent(session.sessionId, 'session-error', { stderr: stderr.trim() })
      const current = this.requireCsvSession(session.sessionId)
      if (current.status === 'aborted') return
      const status: CsvLaunchSession['status'] = code === 0 ? 'completed' : 'failed'
      this.updateCsvSession(session.sessionId, { status, error: code === 0 ? null : `python exited with code ${code ?? 'unknown'}` })
      this.emitCsvSessionEvent(session.sessionId, code === 0 ? 'session-end' : 'session-error', { status, exitCode: code })
    })
  }

  private handlePythonCsvLine(sessionId: string, line: string): void {
    if (!line.trim()) return
    let parsed: { type?: unknown; payload?: unknown }
    try {
      parsed = JSON.parse(line) as { type?: unknown; payload?: unknown }
    } catch {
      this.emitCsvSessionEvent(sessionId, 'session-error', { line })
      return
    }
    const type = parsed.type === 'task-start' || parsed.type === 'task-progress' || parsed.type === 'task-end' || parsed.type === 'session-end' || parsed.type === 'session-error' || parsed.type === 'session-start' || parsed.type === 'control-ack'
      ? parsed.type
      : 'session-error'
    this.emitCsvSessionEvent(sessionId, type, parsed.payload ?? { line })
  }

  private closePythonPipeServer(sessionId: string): void {
    const socket = this.csvPythonControlSockets.get(sessionId)
    if (socket) socket.destroy()
    this.csvPythonControlSockets.delete(sessionId)
    const server = this.csvPythonPipeServers.get(sessionId)
    if (!server) return
    server.close()
    this.csvPythonPipeServers.delete(sessionId)
  }

  private async probePythonExecutable(): Promise<PythonExecutable | null> {
    const candidates: PythonExecutable[] = [
      ...(process.env.PYTHON ? [{ command: process.env.PYTHON, prefixArgs: [], version: '' }] : []),
      { command: 'python', prefixArgs: [], version: '' },
      { command: 'py', prefixArgs: ['-3'], version: '' }
    ]
    for (const candidate of candidates) {
      const version = await this.execPythonVersion(candidate.command, [...candidate.prefixArgs, '--version'])
      if (version) return { ...candidate, version }
    }
    return null
  }

  private execPythonVersion(command: string, args: string[]): Promise<string | null> {
    return new Promise(resolveProbe => {
      execFile(command, args, { timeout: 3_000, windowsHide: true, shell: process.platform === 'win32' && !existsSync(command) }, (error, stdout, stderr) => {
        if (error) {
          resolveProbe(null)
          return
        }
        resolveProbe(`${stdout ?? ''}${stderr ?? ''}`.trim().split(/\r?\n/).find(Boolean) ?? null)
      })
    })
  }

  private writeLastCsvCommand(command: string): string {
    const filePath = join(this.resolveUserDataPath(), 'last-csv-command.txt')
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, command, 'utf8')
    return filePath
  }

  private assertNoActiveCsvLaunch(csvPath: string): void {
    const absolute = resolve(csvPath)
    const active = this.listCsvSessions().find(item => {
      const parsed = csvLaunchSessionSchema.safeParse(item)
      return parsed.success && resolve(parsed.data.csvPath) === absolute && ['queued', 'running', 'paused', 'preparing'].includes(parsed.data.status)
    })
    if (active) throw new Error('E_VALIDATION:csv batch is already running; abort or resume the active session first')
  }

  private persistCsvSession(session: CsvLaunchSession): void {
    const sessions = this.listCsvSessions().filter(item => {
      const parsed = csvLaunchSessionSchema.safeParse(item)
      return !parsed.success || parsed.data.sessionId !== session.sessionId
    })
    this.store.set('csvSessions', [session, ...sessions].slice(0, 500))
  }

  private requireCsvSession(sessionId: string): CsvLaunchSession {
    const session = this.listCsvSessions()
      .map(item => csvLaunchSessionSchema.safeParse(item))
      .find(item => item.success && item.data.sessionId === sessionId)
    if (!session?.success) throw new Error('E_NOT_FOUND:csv session not found')
    return session.data
  }

  private updateCsvSession(sessionId: string, patch: Partial<CsvLaunchSession>): CsvLaunchSession {
    const session = csvLaunchSessionSchema.parse({ ...this.requireCsvSession(sessionId), ...patch })
    this.persistCsvSession(session)
    return session
  }

  private auditCsvLaunch(session: CsvLaunchSession, group: CsvFileGroup, concurrent?: number, extra: Record<string, unknown> = {}): void {
    auditLogger.log('csv:launch', {
      sessionId: session.sessionId,
      runner: session.runner,
      csvPathSha256: createHash('sha256').update(group.filePath).digest('hex'),
      rowCount: group.rowCount,
      validRows: group.validRowCount,
      concurrent: concurrent ?? group.metadata.concurrentMax,
      ...extra
    }, 'success')
  }

  private emitCsvSessionEvent(sessionId: string, type: CsvSessionEvent['type'], data: unknown): void {
    const event = csvSessionEventSchema.parse({ sessionId, type, emittedAt: Date.now(), data })
    this.getMainWindow()?.webContents.send('csv:session-event-stream', event)
    if (type === 'task-start' || type === 'task-progress' || type === 'task-end' || type === 'session-error') this.emitCsvCliEvent(event)
  }

  private emitCsvCliEvent(event: CsvSessionEvent): void {
    const data = typeof event.data === 'object' && event.data !== null ? event.data as Record<string, unknown> : {}
    const toolValue = typeof data.tool === 'string' ? this.parseToolName(data.tool) : 'unknown'
    const progress = typeof data.percent === 'number' ? Math.min(Math.max(data.percent, 0), 1) : event.type === 'task-start' ? 0.01 : event.type === 'task-end' ? 1 : null
    const cliEvent = cliOutputEventSchema.parse({
      tool: toolValue,
      stream: 'system',
      line: `csv ${event.type} ${typeof data.taskId === 'string' ? data.taskId : event.sessionId}`,
      progress,
      confidence: 0.95,
      phase: event.type === 'session-error' ? 'error' : event.type === 'task-end' ? 'completed' : 'working',
      observedAt: event.emittedAt,
      eventType: event.type === 'task-progress' ? 'progress_pct' : event.type === 'session-error' ? 'error' : event.type === 'task-end' ? 'completion' : 'start',
      rawSource: 'line',
      instanceId: typeof data.runId === 'string' ? data.runId : undefined,
      sessionId: event.sessionId,
      payload: { source: 'csv-launch', kind: event.type, taskId: typeof data.taskId === 'string' ? data.taskId : undefined }
    })
    const history = [...this.listCliEvents(), cliEvent].slice(-500)
    this.store.set('cliEvents', history)
    this.getMainWindow()?.webContents.send('cli:event-stream', cliEvent)
    this.queueMonitorSnapshotStream()
  }

  async lockCsv(input: unknown) {
    const request = csvLockRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const rows = this.rowsFromCsvPath(request.csvPath)
    const result = csvLockResultSchema.parse(await this.csvFileLock.lock(request.csvPath, rows))
    auditLogger.log(result.acquired ? 'csv:dag-editor-open' : 'csv:lock-conflict', {
      csvPath: result.csvPath,
      lockPath: result.lockPath,
      ownerPid: result.ownerPid,
      owner: result.owner,
      rowCount: result.rows.length,
      confirmedBy: request.confirmedBy
    }, result.acquired ? 'success' : 'refused', result.acquired ? undefined : 'E_CSV_LOCKED')
    if (result.acquired) this.startDagEditorCsvWatcher(result.csvPath, result.mtimeMs)
    else this.closeDagEditorCsvWatcher()
    this.emitCsvLockStatus(result)
    return result
  }

  async unlockCsv(input: unknown) {
    const request = csvLockRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const result = await this.csvFileLock.unlock(request.csvPath)
    auditLogger.log('csv:dag-editor-close', {
      csvPath: result.status.csvPath,
      lockPath: result.status.lockPath,
      ownerPid: result.status.ownerPid,
      released: result.released,
      confirmedBy: request.confirmedBy
    }, result.released ? 'success' : 'refused', result.released ? undefined : 'E_CSV_LOCK_NOT_OWNED')
    if (result.released) this.closeDagEditorCsvWatcher()
    this.emitCsvLockStatus(result.status)
    return { released: result.released, ...result.status }
  }

  async csvLockStatus(input: unknown) {
    const request = csvLockStatusRequestSchema.parse(input)
    return this.csvFileLock.status(request.csvPath)
  }

  async saveCsv(input: unknown): Promise<CsvSaveResult> {
    const request = this.parseCsvSaveRequest(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const validationErrors = request.rows.flatMap((row, rowIndex) => {
      const parsed = csvTaskRow18Schema.safeParse(row)
      return parsed.success ? [] : parsed.error.issues.map(issue => ({
        rowIndex,
        field: issue.path.join('.') || '__row__',
        code: issue.code,
        message: fromZodIssue(issue, { prefix: undefined }).message
      }))
    })
    if (validationErrors.length > 0) {
      const failed = csvSaveResultSchema.parse({ success: false, cycleDetected: false, validationErrors, rowCount: request.rows.length, csvPath: resolve(request.csvPath), error: 'E_CSV_INVALID' })
      auditLogger.log('csv:save', { csvPath: failed.csvPath, rowCount: failed.rowCount, validationErrorCount: validationErrors.length, confirmedBy: request.confirmedBy }, 'refused', 'E_CSV_INVALID')
      return failed
    }

    const rows = request.rows.map(row => csvTaskRow18Schema.parse(row))
    await this.csvFileLock.assertOwned(request.csvPath)
    const cycle = this.dagOrchestrator.detectCycle({ rows })
    if (cycle) {
      const failed = csvSaveResultSchema.parse({ success: false, cycleDetected: true, cyclePaths: cycle.cyclePaths, rowCount: rows.length, csvPath: resolve(request.csvPath), error: 'E_DAG_CYCLE' })
      auditLogger.log('csv:cycle-attempt', { csvPath: failed.csvPath, rowCount: failed.rowCount, cyclePathCount: failed.cyclePaths.length, confirmedBy: request.confirmedBy }, 'refused', 'E_DAG_CYCLE')
      return failed
    }

    const csvPath = resolve(request.csvPath)
    const before = await stat(csvPath)
    const actualMtimeMs = Math.trunc(before.mtimeMs)
    if (request.expectedMtimeMs !== undefined && !request.forceWrite && Math.trunc(request.expectedMtimeMs) !== actualMtimeMs) {
      const failed = csvSaveResultSchema.parse({ success: false, cycleDetected: false, rowCount: rows.length, csvPath, error: 'E_INTEGRITY_FAIL' })
      auditLogger.log('csv:save', { csvPath, rowCount: rows.length, expectedMtimeMs: request.expectedMtimeMs, actualMtimeMs, forceWrite: request.forceWrite, confirmedBy: request.confirmedBy }, 'refused', 'E_INTEGRITY_FAIL')
      return failed
    }

    const tempPath = join(dirname(csvPath), `.${basename(csvPath)}.${process.pid}.${Date.now()}.tmp`)
    try {
      await writeFile(tempPath, this.csvParser.stringifyRows(rows), 'utf8')
      await rename(tempPath, csvPath)
    } finally {
      if (existsSync(tempPath)) await rm(tempPath, { force: true })
    }
    const after = await stat(csvPath)
    const status = await this.csvFileLock.status(csvPath)
    this.updateDagEditorCsvWatchMtime(csvPath, Math.trunc(after.mtimeMs))
    this.emitCsvLockStatus(status)
    const saved = csvSaveResultSchema.parse({ success: true, cycleDetected: false, rowCount: rows.length, csvPath, savedAt: Date.now(), mtimeMs: Math.trunc(after.mtimeMs) })
    auditLogger.log('csv:save', { csvPath, rowCount: rows.length, mtimeMs: saved.mtimeMs, forceWrite: request.forceWrite, confirmedBy: request.confirmedBy }, 'success')
    return saved
  }

  listCsvTemplates(input: unknown = {}) {
    const request = csvTemplateListRequestSchema.parse(input) ?? {}
    const userTemplates = asArray(this.store.get('csvTemplates', []), item => this.normalizeCsvTemplate(item))
      .filter((item): item is NodeTemplate => Boolean(item))
    const templates = request.source === 'user'
      ? userTemplates
      : request.source === 'builtin'
        ? BUILTIN_NODE_TEMPLATES
        : [...userTemplates, ...BUILTIN_NODE_TEMPLATES]
    return [...templates].sort((left, right) => right.createdAt - left.createdAt)
  }

  saveCsvTemplate(input: unknown) {
    const request = csvSaveTemplateRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const existing = this.listCsvTemplates({ source: 'user' })
    if (existing.some(template => template.name === request.name)) throw new Error(`E_VALIDATION:CSV template name ${request.name} already exists`)
    const template = nodeTemplateSchema.parse({
      id: randomUUID(),
      name: request.name,
      description: request.description,
      rowTemplate: request.rowTemplate ?? this.toCsvRowTemplate(request.row),
      createdAt: Date.now(),
      source: 'user',
      confirmedBy: request.confirmedBy
    })
    this.store.set('csvTemplates', [template, ...existing].slice(0, 200))
    return { template }
  }

  deleteCsvTemplate(input: unknown) {
    const request = csvDeleteTemplateRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const existing = this.listCsvTemplates({ source: 'user' })
    const next = existing.filter(template => template.id !== request.id)
    this.store.set('csvTemplates', next)
    return csvDeleteTemplateResultSchema.parse({ success: true, deleted: existing.length - next.length, id: request.id })
  }

  private parseCsvSaveRequest(input: unknown): { csvPath: string; rows: unknown[]; expectedMtimeMs?: number; forceWrite?: boolean; confirmedBy?: string } {
    const record = this.asRecord(input)
    if (typeof record.csvPath !== 'string' || record.csvPath.trim().length === 0) throw new Error('E_VALIDATION:csvPath is required')
    if (!Array.isArray(record.rows)) throw new Error('E_VALIDATION:rows must be an array')
    const expectedMtimeMs = typeof record.expectedMtimeMs === 'number' && Number.isFinite(record.expectedMtimeMs) ? Math.trunc(record.expectedMtimeMs) : undefined
    const forceWrite = record.forceWrite === true
    const confirmedBy = typeof record.confirmedBy === 'string' ? record.confirmedBy : undefined
    return { csvPath: record.csvPath, rows: record.rows, expectedMtimeMs, forceWrite, confirmedBy }
  }

  private normalizeCsvTemplate(item: unknown): NodeTemplate | null {
    const parsed = nodeTemplateSchema.safeParse(item)
    if (parsed.success) return parsed.data
    const record = this.asRecord(item)
    if (typeof record.name !== 'string') return null
    return nodeTemplateSchema.parse({
      id: typeof record.id === 'string' ? record.id : randomUUID(),
      name: record.name,
      description: typeof record.description === 'string' ? record.description : undefined,
      rowTemplate: this.toCsvRowTemplate(record.rowTemplate ?? record.row),
      createdAt: typeof record.createdAt === 'number' ? record.createdAt : typeof record.savedAt === 'number' ? record.savedAt : Date.now(),
      source: record.source === 'builtin' ? 'builtin' : 'user',
      confirmedBy: typeof record.confirmedBy === 'string' ? record.confirmedBy : undefined
    })
  }

  private toCsvRowTemplate(input: unknown): Partial<CsvTaskRow18> {
    const parsed = csvTaskRow18Schema.partial().safeParse(input)
    if (parsed.success) return parsed.data
    try {
      const runtimeRow = this.toRuntimeCsvRow(input)
      return {
        taskId: runtimeRow.id,
        taskName: runtimeRow.prompt.slice(0, 200) || runtimeRow.id,
        priority: 'P1',
        status: 'pending',
        tool: runtimeRow.tool,
        skill: 'code-review',
        inputArgs: JSON.stringify({ prompt: runtimeRow.prompt }),
        outputFormat: 'md',
        dependsOn: runtimeRow.dependency ?? '',
        timeoutMs: 60000,
        retries: 1,
        concurrencyKey: runtimeRow.parallel_group ?? '',
        createdAt: new Date().toISOString(),
        scheduledAt: 'now',
        note: runtimeRow.notes ?? ''
      }
    } catch {
      return {}
    }
  }

  private emitCsvLockStatus(status: { csvPath: string; locked: boolean; ownerPid: number | null; expiresAt: number | null; stale: boolean }): void {
    this.getMainWindow()?.webContents.send('csv:lock-status-stream', status)
  }

  listInjectWhitelist(input: { scope?: InjectWhitelistScope } = {}): RuntimeInjectWhitelistEntry[] {
    const storeEntries = asArray(this.store.get('injectWhitelist', []), item => this.normalizeInjectWhitelistEntry(item))
      .filter((entry): entry is RuntimeInjectWhitelistEntry => Boolean(entry))
    const sqliteEntries = this.firstTimeConfirmRepository.listWhitelistEntries({
      sessionStartedAt: this.injectSessionStartedAt
    })
    const byId = new Map<string, RuntimeInjectWhitelistEntry>()
    for (const entry of [...sqliteEntries, ...storeEntries]) {
      if (!input.scope || entry.scope === input.scope) byId.set(entry.id, entry)
    }
    const entries = [...byId.values()]
    return entries.sort((left, right) => right.createdAt - left.createdAt)
  }

  addInjectWhitelist(input: {
    alias?: string
    scope?: InjectWhitelistScope
    pattern?: string
    scenarios?: InjectScenario[]
    duration?: InjectWhitelistDuration
    reason?: string
    createdBy?: InjectWhitelistEntry['createdBy']
    confirmedBy?: string
  }): RuntimeInjectWhitelistEntry {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const scope = input.scope ?? 'instance'
    const pattern = (input.pattern ?? input.alias ?? '').trim()
    if (!pattern) throw new Error('E_VALIDATION:pattern required')
    const scenarios = input.scenarios && input.scenarios.length > 0
      ? input.scenarios
      : ['csv-task-driven', 'watchdog-restart-resume', 'task-chain-next', 'error-recovery', 'user-schedule', 'manual-template']
    const createdAt = Date.now()
    const duration = input.duration ?? '24h'
    const existing = this.listInjectWhitelist().find(entry => entry.scope === scope && entry.pattern === pattern && entry.enabled)
    if (existing) return existing
    const entry = injectWhitelistEntrySchema.parse({
      id: randomUUID(),
      scope,
      pattern,
      patternHash: hashInjectWhitelistPattern(scope, pattern),
      scenarios,
      duration,
      createdAt,
      expiresAt: expiresAtForDuration(duration, createdAt),
      createdBy: input.createdBy ?? 'user-explicit',
      enabled: true,
      reason: input.reason ?? 'operator-approved',
      confirmedBy: input.confirmedBy
    })
    const runtimeEntry = { ...entry, alias: scope === 'instance' ? pattern : pattern }
    this.store.set('injectWhitelist', [runtimeEntry, ...this.listInjectWhitelist()].slice(0, 1000))
    this.appendInjectHistory({
      injectId: `whitelist-add:${entry.id}`,
      targetAlias: runtimeEntry.alias,
      status: 'whitelist-added',
      event: 'whitelist-add',
      whitelistId: entry.id,
      scope: entry.scope,
      patternHash: entry.patternHash,
      at: createdAt,
      confirmedBy: input.confirmedBy,
      reason: input.reason ?? 'operator-approved'
    })
    return runtimeEntry
  }

  confirmInjectFirstTime(input: unknown) {
    const request = injectFirstTimeConfirmRequestSchema.parse(input)
    const targetResult = this.resolveInjectTarget({
      selector: request.selector,
      aliasOrId: request.aliasOrId,
      pid: request.pid,
      hwnd: request.hwnd,
      cwd: request.cwd,
      taskId: request.taskId,
      scenario: request.scenario,
      confirmedBy: request.confirmedBy
    })
    if (!targetResult.target) {
      throw new Error(targetResult.reason ? `E_NOT_FOUND:${targetResult.reason}` : 'E_NOT_FOUND:inject target not found')
    }
    const targetAlias = targetResult.target.resolvedAlias ?? targetResult.target.aliasOrId
    const pattern = this.firstTimePatternForScope(request.scope, targetResult.target)
    const entry = this.firstTimeConfirmRepository.confirm({
      alias: targetAlias,
      scope: request.scope,
      pattern,
      scenarios: [request.scenario],
      duration: request.duration,
      confirmedBy: request.confirmedBy,
      reason: request.reason
    })
    const runtimeEntry = { ...entry, alias: targetAlias }
    this.store.set('injectWhitelist', [
      runtimeEntry,
      ...this.listInjectWhitelist().filter(item => item.id !== entry.id)
    ].slice(0, 1000))
    const confirmedAt = Date.now()
    this.appendInjectHistory({
      injectId: `first-time-confirm:${entry.id}`,
      targetAlias,
      status: 'first-time-confirmed',
      event: 'first-time-confirm',
      whitelistId: entry.id,
      scope: entry.scope,
      patternHash: entry.patternHash,
      at: confirmedAt,
      confirmedBy: request.confirmedBy,
      reason: request.reason
    })
    this.appendInjectHistory({
      injectId: `whitelist-add:${entry.id}:first-time`,
      targetAlias,
      status: 'whitelist-added',
      event: 'whitelist-add',
      whitelistId: entry.id,
      scope: entry.scope,
      patternHash: entry.patternHash,
      at: confirmedAt,
      confirmedBy: request.confirmedBy,
      reason: request.reason
    })
    const entryForResult = { ...entry }
    delete (entryForResult as { alias?: string }).alias
    return injectFirstTimeConfirmResultSchema.parse({
      success: true,
      entry: entryForResult,
      target: targetResult.target,
      confirmedAt
    })
  }

  private firstTimePatternForScope(scope: InjectWhitelistScope, target: NonNullable<InjectResolveTargetResult['target']>): string {
    if (scope === 'instance') return target.resolvedAlias ?? target.aliasOrId
    if (scope === 'tool') {
      if (!target.resolvedTool) throw new Error('E_VALIDATION:first-time tool scope requires resolved tool')
      return target.resolvedTool
    }
    if (!target.cwd) throw new Error('E_VALIDATION:first-time project-cwd scope requires resolved cwd')
    return target.cwd
  }

  dryRunInject(input: unknown): InjectResult {
    const result = injectResultSchema.parse(this.injectService.dryRun(input))
    this.appendInjectHistory({ injectId: result.actionId, targetAlias: result.targetAlias, status: 'dry-run', at: Date.now(), characters: result.characters, error: result.error })
    return result
  }

  async executeInject(input: unknown): Promise<InjectResult> {
    const parsed = injectActionSchema.parse(input)
    if (parsed.dryRun) return this.dryRunInject(parsed)
    const actionId = parsed.id ?? randomUUID()
    const action = injectActionSchema.parse({ ...parsed, id: actionId })
    const confirmedBy = typeof action.confirmedBy === 'string' ? action.confirmedBy : undefined
    const targetAlias = this.injectActionTargetAlias(action)

    if (confirmedBy && confirmedBy.length >= 3) {
      const target = this.resolveInjectTarget({
        ...(action.target ?? { selector: 'alias' as const, aliasOrId: targetAlias }),
        scenario: action.scenario,
        taskId: action.taskId ?? undefined,
        confirmedBy
      })
      if (target.ok && target.countdownMs > 0) {
        const countdown = await this.runInjectCountdown({
          actionId,
          scenario: action.scenario,
          targetAlias: target.target?.resolvedAlias ?? targetAlias,
          totalMs: target.countdownMs
        })
        if (countdown.cancelled) {
          const cancelled = this.cancelledInjectResult(action, actionId, countdown.elapsedMs)
          this.appendInjectHistory({ injectId: cancelled.actionId, targetAlias: cancelled.targetAlias, status: 'cancelled', at: Date.now(), confirmedBy, characters: cancelled.characters, error: cancelled.error })
          return cancelled
        }
      }
    }

    const result = injectResultSchema.parse(await this.injectService.execute(action))
    this.appendInjectHistory({ injectId: result.actionId, targetAlias: result.targetAlias, status: result.success ? 'executed' : 'blocked', at: Date.now(), confirmedBy, characters: result.characters, error: result.error })
    if (result.success) {
      await this.recordingEngine.recordStdin({
        recordingId: action.recordingId,
        sessionId: action.sessionId,
        taskId: action.taskId,
        origin: 'inject',
        injectActionId: result.actionId,
        injectAction: {
          actionId: result.actionId,
          mode: action.mode,
          scenario: action.scenario,
          targetAlias: result.targetAlias
        },
        text: action.text
      })
    }
    return result
  }

  private injectActionTargetAlias(action: InjectAction): string {
    const targetAlias = action.targetAlias ?? action.target?.aliasOrId
    if (!targetAlias) throw new Error('E_VALIDATION:inject target alias missing')
    return targetAlias
  }

  private async captureInjectScreenshot(target: unknown, phase: 'before' | 'after'): Promise<{ success: boolean; path?: string; error?: string }> {
    const windowManager = this.runtime?.windowManager
    if (!windowManager) {
      return { success: true }
    }
    if (typeof target !== 'object' || target === null) {
      return { success: false, error: `E_SCREENSHOT_${phase.toUpperCase()}_FAILED:resolved inject target is unavailable` }
    }
    const record = target as Record<string, unknown>
    const hwnd = Number(record.resolvedHwnd ?? record.hwnd)
    if (!Number.isInteger(hwnd) || hwnd <= 0) {
      return { success: false, error: `E_SCREENSHOT_${phase.toUpperCase()}_FAILED:resolved inject target HWND is unavailable` }
    }
    const result = await windowManager.screenshotWindow(hwnd)
    return result.success && result.data?.path
      ? { success: true, path: result.data.path }
      : { success: false, error: result.error ?? `E_SCREENSHOT_${phase.toUpperCase()}_FAILED:window screenshot capture failed` }
  }

  private async runInjectCountdown(input: {
    actionId: string
    scenario: InjectScenario
    targetAlias: string
    totalMs: number
  }): Promise<{ cancelled: boolean; elapsedMs: number }> {
    const totalMs = Math.max(0, Math.min(30_000, input.totalMs))
    const startedAt = Date.now()
    const canCancel = this.getInjectCountdownConfig().allowEscToCancel

    this.emitInjectCountdownStream({
      actionId: input.actionId,
      scenario: input.scenario,
      targetAlias: input.targetAlias,
      totalMs,
      remainingMs: totalMs,
      elapsedMs: 0,
      emittedAt: startedAt,
      phase: 'scheduled',
      canCancel
    })

    if (this.isInjectCountdownCancelledSince(input.actionId, startedAt)) {
      this.emitInjectCountdownStream({
        actionId: input.actionId,
        scenario: input.scenario,
        targetAlias: input.targetAlias,
        totalMs,
        remainingMs: totalMs,
        elapsedMs: 0,
        phase: 'cancelled',
        canCancel: false
      })
      return { cancelled: true, elapsedMs: 0 }
    }
    if (this.isInjectCountdownCompletedSince(input.actionId, startedAt)) {
      this.emitInjectCountdownStream({
        actionId: input.actionId,
        scenario: input.scenario,
        targetAlias: input.targetAlias,
        totalMs,
        remainingMs: 0,
        elapsedMs: 0,
        phase: 'completed',
        canCancel: false
      })
      return { cancelled: false, elapsedMs: 0 }
    }

    while (Date.now() - startedAt < totalMs) {
      const elapsedBeforeWait = Math.max(0, Date.now() - startedAt)
      const remainingBeforeWait = Math.max(0, totalMs - elapsedBeforeWait)
      await new Promise(resolve => setTimeout(resolve, Math.min(100, remainingBeforeWait)))
      const elapsedMs = Math.min(totalMs, Math.max(0, Date.now() - startedAt))
      const remainingMs = Math.max(0, totalMs - elapsedMs)

      if (this.isInjectCountdownCancelledSince(input.actionId, startedAt)) {
        this.emitInjectCountdownStream({
          actionId: input.actionId,
          scenario: input.scenario,
          targetAlias: input.targetAlias,
          totalMs,
          remainingMs,
          elapsedMs,
          phase: 'cancelled',
          canCancel: false
        })
        return { cancelled: true, elapsedMs }
      }
      if (this.isInjectCountdownCompletedSince(input.actionId, startedAt)) {
        this.emitInjectCountdownStream({
          actionId: input.actionId,
          scenario: input.scenario,
          targetAlias: input.targetAlias,
          totalMs,
          remainingMs: 0,
          elapsedMs,
          phase: 'completed',
          canCancel: false
        })
        return { cancelled: false, elapsedMs }
      }

      if (remainingMs > 0) {
        this.emitInjectCountdownStream({
          actionId: input.actionId,
          scenario: input.scenario,
          targetAlias: input.targetAlias,
          totalMs,
          remainingMs,
          elapsedMs,
          phase: 'tick',
          canCancel
        })
      }
    }

    this.emitInjectCountdownStream({
      actionId: input.actionId,
      scenario: input.scenario,
      targetAlias: input.targetAlias,
      totalMs,
      remainingMs: 0,
      elapsedMs: totalMs,
      phase: 'completed',
      canCancel: false
    })
    return { cancelled: false, elapsedMs: totalMs }
  }

  private isInjectCountdownCancelledSince(actionId: string, startedAt: number): boolean {
    const entries = asArray(this.store.get('injectCountdownCancellations', []), item => ({ ...(item as Record<string, unknown>) }))
    return entries.some(entry => entry.actionId === actionId && typeof entry.cancelledAt === 'number' && entry.cancelledAt >= startedAt)
  }

  private isInjectCountdownCompletedSince(actionId: string, startedAt: number): boolean {
    const entries = asArray(this.store.get('injectCountdownCompletions', []), item => ({ ...(item as Record<string, unknown>) }))
    return entries.some(entry => entry.actionId === actionId && typeof entry.completedAt === 'number' && entry.completedAt >= startedAt)
  }

  private emitInjectCountdownStream(event: Omit<InjectCountdownStreamPayload, 'emittedAt'> & { emittedAt?: number }): void {
    const payload = injectCountdownStreamPayloadSchema.parse({
      ...event,
      emittedAt: event.emittedAt ?? Date.now()
    })
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    if (typeof BrowserWindow.getAllWindows === 'function') {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) targets.add(window)
      }
    }
    for (const window of targets) {
      window.webContents.send('inject:countdown-stream', payload)
    }
  }

  private emitInjectFirstTimeRequired(input: InjectResolveTargetInput, result: InjectResolveTargetResult): void {
    const target = result.target
    if (!target) return
    const payload = injectFirstTimeRequiredPayloadSchema.parse({
      requestId: randomUUID(),
      selector: input.selector,
      aliasOrId: input.aliasOrId,
      pid: input.pid ?? target.resolvedPid ?? null,
      hwnd: input.hwnd ?? target.resolvedHwnd ?? null,
      cwd: input.cwd ?? target.cwd ?? null,
      taskId: input.taskId ?? target.taskId ?? null,
      scenario: input.scenario,
      targetAlias: target.resolvedAlias ?? target.aliasOrId,
      resolvedTool: target.resolvedTool ?? null,
      reason: result.reason ?? null,
      emittedAt: Date.now()
    })
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    if (typeof BrowserWindow.getAllWindows === 'function') {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) targets.add(window)
      }
    }
    for (const window of targets) {
      window.webContents.send('inject:first-time-required', payload)
    }
  }

  private cancelledInjectResult(action: InjectAction, actionId: string, durationMs: number): InjectResult {
    const text = action.text.normalize('NFC')
    const textHash = action.textHash ?? createHash('sha256').update(text).digest('hex')
    return injectResultSchema.parse({
      actionId,
      status: 'cancelled',
      success: false,
      dryRun: false,
      targetAlias: this.injectActionTargetAlias(action),
      failureKind: 'ignored',
      error: 'E_CANCELLED:inject countdown cancelled',
      errorMessage: 'E_CANCELLED:inject countdown cancelled',
      modeUsed: 'disabled',
      attemptCount: 0,
      durationMs,
      characters: text.length,
      injectedLength: 0,
      verifiedContentMatches: false,
      screenshotPathBefore: null,
      screenshotPathAfter: null,
      textHash,
      chunkCount: 1
    })
  }

  removeInjectWhitelist(input: { id: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const entries = this.listInjectWhitelist()
    const removed = entries.filter(entry => entry.id === input.id)
    const next = entries.filter(entry => entry.id !== input.id)
    this.store.set('injectWhitelist', next)
    const removedAt = Date.now()
    this.firstTimeConfirmRepository.disableWhitelistIds([input.id], removedAt)
    for (const entry of removed) {
      this.appendInjectHistory({
        injectId: `whitelist-remove:${entry.id}:${removedAt}`,
        targetAlias: entry.alias,
        status: 'whitelist-removed',
        event: 'whitelist-remove',
        whitelistId: entry.id,
        scope: entry.scope,
        patternHash: entry.patternHash,
        at: removedAt,
        confirmedBy: input.confirmedBy,
        reason: 'operator-removed'
      })
    }
    return { success: true, id: input.id, removedAt }
  }

  cleanupExpiredInjectWhitelist(input: { now?: number; source?: 'startup' | 'hourly' | 'manual'; confirmedBy?: string } = {}) {
    const checkedAt = input.now ?? Date.now()
    const entries = this.listInjectWhitelist()
    const expired = entries.filter(entry => entry.enabled && this.isExpiredInjectWhitelistEntry(entry, checkedAt))
    if (expired.length === 0) {
      return { success: true, checkedAt, disabled: 0, ids: [] as string[] }
    }
    const expiredIds = new Set(expired.map(entry => entry.id))
    const next = entries.map(entry => expiredIds.has(entry.id) ? { ...entry, enabled: false } : entry)
    this.store.set('injectWhitelist', next)
    this.firstTimeConfirmRepository.disableWhitelistIds([...expiredIds], checkedAt)
    for (const entry of expired) {
      this.appendInjectHistory({
        injectId: `whitelist-expire:${entry.id}:${checkedAt}`,
        targetAlias: entry.alias,
        status: 'whitelist-expired',
        event: 'whitelist-expire',
        whitelistId: entry.id,
        scope: entry.scope,
        patternHash: entry.patternHash,
        at: checkedAt,
        confirmedBy: input.confirmedBy,
        reason: input.source ?? 'manual'
      })
    }
    return { success: true, checkedAt, disabled: expired.length, ids: expired.map(entry => entry.id) }
  }

  resolveInjectTarget(input: InjectResolveTargetInput | { targetAlias: string }): InjectResolveTargetResult & { found: boolean } {
    const rawInput = 'targetAlias' in input
      ? { selector: 'alias' as const, aliasOrId: input.targetAlias, scenario: 'manual-template' as const }
      : input
    const parsedInput = injectResolveTargetInputSchema.parse(rawInput)
    const result = this.injectTargetResolver.resolve(parsedInput)
    if (result.strictModeGate === 'requires-explicit-confirm') {
      this.appendInjectHistory({
        injectId: `strict-mode-block:${randomUUID()}`,
        targetAlias: result.target?.resolvedAlias ?? rawInput.aliasOrId,
        status: 'strict-mode-blocked',
        event: 'strict-mode-block',
        at: Date.now(),
        confirmedBy: 'confirmedBy' in rawInput && typeof rawInput.confirmedBy === 'string' ? rawInput.confirmedBy : undefined,
        reason: result.reason ?? null
      })
    }
    if (result.whitelistGate === 'first-time-needed' && result.target) {
      this.emitInjectFirstTimeRequired(parsedInput, result)
    }
    return { ...result, found: Boolean(result.target) }
  }

  getInjectReadyPool() {
    const entries = this.listInjectWhitelist()
    const readyTargets = this.injectTargetResolver.readyPool({ scenario: 'manual-template' }).map(target => {
      const entry = entries.find(item => item.alias === target.resolvedAlias)
      return { ...target, id: entry?.id ?? target.resolvedAlias, alias: target.resolvedAlias, ready: true }
    })
    const seen = new Set(readyTargets.map(item => item.id))
    const whitelistFallback = entries
      .filter(entry => !seen.has(entry.id))
      .map(entry => ({ ...entry, ready: this.isFeatureEnabled('R8.A.libs.nut-js') }))
    return [...readyTargets, ...whitelistFallback]
  }

  getInjectStrictModeConfig(): InjectStrictModeConfig {
    const parsed = injectStrictModeConfigSchema.safeParse(this.store.get('injectStrictModeConfig', {}))
    return parsed.success ? parsed.data : injectStrictModeConfigSchema.parse({})
  }

  configureInjectStrictMode(input: Partial<InjectStrictModeConfig> & { confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const config = injectStrictModeConfigSchema.parse({ ...this.getInjectStrictModeConfig(), ...input, updatedAt: Date.now() })
    this.store.set('injectStrictModeConfig', config)
    return { success: true, config }
  }

  getInjectCountdownConfig(): InjectCountdownConfig {
    const parsed = injectCountdownConfigSchema.safeParse(this.store.get('injectCountdownConfig', {}))
    return parsed.success ? parsed.data : injectCountdownConfigSchema.parse({})
  }

  configureInjectCountdown(input: Partial<InjectCountdownConfig> & { confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const config = injectCountdownConfigSchema.parse({ ...this.getInjectCountdownConfig(), ...input, updatedAt: Date.now() })
    this.store.set('injectCountdownConfig', config)
    return { success: true, config }
  }

  cancelInjectCountdown(input: { actionId: string; confirmedBy?: string }) {
    const request = injectCountdownControlRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const entry = { actionId: request.actionId, status: 'cancelled', cancelledAt: Date.now(), confirmedBy: request.confirmedBy }
    this.store.set('injectCountdownCancellations', [entry, ...asArray(this.store.get('injectCountdownCancellations', []), item => ({ ...(item as Record<string, unknown>) }))].slice(0, 500))
    this.appendInjectHistory({ injectId: request.actionId, status: 'cancelled', at: entry.cancelledAt, confirmedBy: request.confirmedBy })
    return { cancelled: true, ...entry }
  }

  completeInjectCountdown(input: InjectCountdownControlRequest) {
    const request = injectCountdownControlRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const entry = { actionId: request.actionId, status: 'completed', completedAt: Date.now(), confirmedBy: request.confirmedBy }
    this.store.set('injectCountdownCompletions', [entry, ...asArray(this.store.get('injectCountdownCompletions', []), item => ({ ...(item as Record<string, unknown>) }))].slice(0, 500))
    this.appendInjectHistory({ injectId: request.actionId, status: 'countdown-completed', event: 'countdown-complete', at: entry.completedAt, confirmedBy: request.confirmedBy })
    return { completed: true, ...entry }
  }
  private normalizeInjectWhitelistEntry(item: unknown): RuntimeInjectWhitelistEntry | null {
    const record = item as Record<string, unknown>
    const legacyAlias = typeof record.alias === 'string' ? record.alias : null
    const scope = this.asInjectWhitelistScope(record.scope) ?? 'instance'
    const pattern = String(record.pattern ?? legacyAlias ?? '').trim()
    if (!pattern) return null
    const createdAt = typeof record.createdAt === 'number' ? record.createdAt : Date.now()
    const duration = this.asInjectWhitelistDuration(record.duration) ?? '24h'
    const rawId = typeof record.id === 'string' ? record.id : pattern
    const entry = injectWhitelistEntrySchema.parse({
      id: this.injectWhitelistId(rawId),
      scope,
      pattern,
      patternHash: typeof record.patternHash === 'string' && /^[a-f0-9]{64}$/.test(record.patternHash)
        ? record.patternHash
        : hashInjectWhitelistPattern(scope, pattern),
      scenarios: this.asInjectScenarios(record.scenarios),
      duration,
      createdAt,
      expiresAt: typeof record.expiresAt === 'number' || record.expiresAt === null ? record.expiresAt : null,
      createdBy: record.createdBy === 'first-time-modal' || record.createdBy === 'csv-mode-auto' ? record.createdBy : 'user-explicit',
      enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
      reason: typeof record.reason === 'string' ? record.reason : 'operator',
      confirmedBy: typeof record.confirmedBy === 'string' ? record.confirmedBy : null
    })
    return { ...entry, alias: legacyAlias ?? pattern }
  }

  private isExpiredInjectWhitelistEntry(entry: RuntimeInjectWhitelistEntry, checkedAt: number): boolean {
    if (entry.duration === 'session') return entry.createdAt < this.injectSessionStartedAt
    return typeof entry.expiresAt === 'number' && entry.expiresAt <= checkedAt
  }

  private listInjectTargetRecords(): InjectTargetRecord[] {
    const records: InjectTargetRecord[] = []

    for (const task of this.runtime?.aiTaskTracker?.getActiveTasks() ?? []) {
      const record = this.injectRecordFromActiveTask(task)
      if (record) this.upsertInjectTargetRecord(records, record)
    }

    for (const entry of this.listInjectWhitelist()) {
      if (entry.scope === 'instance') this.upsertInjectTargetRecord(records, { alias: entry.alias, tool: this.inferInjectTool(entry.alias) })
      if (entry.scope === 'project-cwd') this.upsertInjectTargetRecord(records, { alias: entry.alias, cwd: entry.pattern })
    }
    for (const state of this.stateCoordinator.listStates()) {
      const recordState = this.normalizeInjectRecordState(state.task)
      this.upsertInjectTargetRecord(records, {
        alias: state.instanceId,
        tool: this.inferInjectTool(state.instanceId),
        state: recordState,
        ready: this.isInjectReadyRecordState(recordState),
        lastReadyAt: this.isInjectReadyRecordState(recordState) ? state.updatedAt : null
      })
    }
    const states = this.store.get('signalStates', {}) ?? {}
    for (const [instanceId, value] of Object.entries(states)) {
      const record = value as { state?: string; fusedProgress?: { observedAt?: number } }
      const state = this.normalizeInjectRecordState(record.state ?? this.stateCoordinator.getState(instanceId).task)
      this.upsertInjectTargetRecord(records, {
        alias: instanceId,
        tool: this.inferInjectTool(instanceId),
        state,
        ready: this.isInjectReadyRecordState(state),
        lastReadyAt: this.isInjectReadyRecordState(state) ? record.fusedProgress?.observedAt ?? Date.now() : null
      })
    }
    for (const task of this.listTasks()) {
      const alias = `${task.row.tool}-${task.row.id}`
      this.upsertInjectTargetRecord(records, { alias, tool: task.row.tool as InjectTool, cwd: task.row.cwd, taskId: task.row.id, rowAlias: task.row.id, ready: task.status === 'queued' })
    }
    return records
  }

  private injectRecordFromActiveTask(task: AITask): InjectTargetRecord | null {
    const alias = (task.alias ?? task.autoName ?? task.id).trim()
    if (!alias) return null
    const state = this.normalizeInjectRecordState(task.monitorState ?? task.status.state)
    const ready = this.isInjectReadyRecordState(state)
    return {
      alias,
      pid: task.pid,
      hwnd: task.windowHwnd ?? null,
      tool: this.injectToolFromAiTool(task.toolType) ?? this.inferInjectTool(alias),
      state,
      ready,
      taskId: task.id,
      lastReadyAt: ready ? task.status.lastActivity : null
    }
  }

  private upsertInjectTargetRecord(records: InjectTargetRecord[], next: InjectTargetRecord): void {
    const index = records.findIndex(record => this.isSameInjectTargetRecord(record, next))
    if (index === -1) {
      records.push(next)
      return
    }
    records[index] = this.mergeInjectTargetRecords(records[index], next)
  }

  private isSameInjectTargetRecord(left: InjectTargetRecord, right: InjectTargetRecord): boolean {
    if (left.alias !== right.alias) return false
    if (left.pid != null && right.pid != null && left.pid !== right.pid) return false
    if (left.hwnd != null && right.hwnd != null && left.hwnd !== right.hwnd) return false
    return true
  }

  private mergeInjectTargetRecords(left: InjectTargetRecord, right: InjectTargetRecord): InjectTargetRecord {
    const leftState = this.normalizeInjectRecordState(left.state)
    const rightState = this.normalizeInjectRecordState(right.state)
    const ready = Boolean(left.ready || right.ready || this.isInjectReadyRecordState(leftState) || this.isInjectReadyRecordState(rightState))
    return {
      alias: left.alias,
      pid: left.pid ?? right.pid ?? null,
      hwnd: left.hwnd ?? right.hwnd ?? null,
      tool: left.tool ?? right.tool ?? null,
      cwd: left.cwd ?? right.cwd ?? null,
      ready,
      state: ready ? 'waiting-input' : leftState ?? rightState,
      taskId: left.taskId ?? right.taskId ?? null,
      rowAlias: left.rowAlias ?? right.rowAlias ?? null,
      lastReadyAt: Math.max(left.lastReadyAt ?? 0, right.lastReadyAt ?? 0) || null
    }
  }

  private normalizeInjectRecordState(value: unknown): string | null {
    if (value === 'awaiting-input') return 'waiting-input'
    return typeof value === 'string' && value.trim().length > 0 ? value : null
  }

  private isInjectReadyRecordState(value: unknown): boolean {
    return this.normalizeInjectRecordState(value) === 'waiting-input'
  }

  private injectToolFromAiTool(value: AIToolType): InjectTool | null {
    if (value === 'codex' || value === 'cursor') return value
    if (value === 'claude-code') return 'claude'
    if (value === 'gemini-cli') return 'gemini'
    return null
  }

  private buildObservabilityContext(collectedAt: number) {
    const runtimeSnapshot = this.runtime?.metricsCollector?.getSnapshot() ?? null
    const rateLimitStats = this.rateLimitStats()
    const notifications = this.listNotifications({ includeDismissed: true })
    const signalSnapshots = this.listStoredContributionSnapshots()
    const stateSnapshots = signalSnapshots.map(snapshot => this.stateCoordinator.getState(snapshot.instanceId))
    const shimStatus = this.listShimStatus()
    const shimValues = Object.values(shimStatus)
    const stats = this.queueStats()
    const injectHistory = this.listInjectHistory()
    const injectAttempts = injectHistory.length
    const injectSuccesses = injectHistory.filter(entry => entry.status === 'executed').length

    return {
      collectedAt,
      config: this.observabilityStore.getConfig(),
      notifications,
      rateLimitStats,
      runtimeSnapshot,
      signalSnapshots,
      stateSnapshots,
      shimInstalledCount: shimValues.filter(Boolean).length,
      shimTotalCount: shimValues.length,
      watchdogStatus: this.getWatchdogStatus(),
      csvThroughputPerMin: stats.throughputPerMin,
      injectAttempts,
      injectSuccesses
    }
  }

  private listStoredContributionSnapshots(): SignalContributionSnapshot[] {
    const raw = this.store.get('signalContributionSnapshots', {}) ?? {}
    if (typeof raw !== 'object' || raw === null) {
      return []
    }

    const snapshots: SignalContributionSnapshot[] = []
    for (const value of Object.values(raw as Record<string, unknown>)) {
      const parsed = signalContributionSnapshotSchema.safeParse(value)
      if (parsed.success) {
        snapshots.push(parsed.data)
      }
    }
    return snapshots
  }

  private resolveObservabilityExportPath(
    format: 'json' | 'csv',
    destPath: string | undefined,
    exportedAt: number
  ): string {
    if (destPath) {
      return isAbsolute(destPath)
        ? destPath
        : resolve(app.getPath('userData'), 'diagnostics', destPath)
    }

    return join(app.getPath('userData'), 'diagnostics', `observability-${this.formatObservabilityTimestamp(exportedAt)}.${format}`)
  }

  private serializeObservabilityCsv(snapshot: ObservabilitySnapshot): string {
    const rows = [
      ['kind', 'ts', 'value', 'labels'],
      ...snapshot.metrics.map((metric): string[] => [
        metric.kind,
        String(metric.ts),
        String(metric.value),
        metric.labels ? JSON.stringify(metric.labels) : ''
      ])
    ]
    return `${rows.map(row => row.map(value => this.escapeCsv(value)).join(',')).join('\n')}\n`
  }

  private escapeCsv(value: string): string {
    if (!/[",\n\r]/.test(value)) {
      return value
    }
    return `"${value.replace(/"/g, '""')}"`
  }

  private formatObservabilityTimestamp(timestamp: number): string {
    const date = new Date(timestamp)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  }

  private asInjectWhitelistScope(value: unknown): InjectWhitelistScope | null {
    return value === 'instance' || value === 'tool' || value === 'project-cwd' ? value : null
  }

  private asInjectWhitelistDuration(value: unknown): InjectWhitelistDuration | null {
    return value === 'session' || value === '24h' || value === '7d' || value === 'permanent' ? value : null
  }

  private asInjectScenarios(value: unknown): InjectScenario[] {
    const fallback: InjectScenario[] = ['csv-task-driven', 'watchdog-restart-resume', 'task-chain-next', 'error-recovery', 'user-schedule', 'manual-template']
    if (!Array.isArray(value)) return fallback
    const allowed = new Set<InjectScenario>(fallback)
    const scenarios = value.filter((item): item is InjectScenario => allowed.has(item as InjectScenario))
    return scenarios.length > 0 ? scenarios : fallback
  }

  private inferInjectTool(value: string): InjectTool | null {
    const lower = value.toLowerCase()
    for (const tool of ['codex', 'claude', 'gemini', 'cursor', 'copilot'] as const) {
      if (lower.includes(tool)) return tool
    }
    return null
  }

  private injectWhitelistId(value: string): string {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value
    const hash = createHash('sha256').update(value).digest('hex')
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
  }
  listInjectHistory(): InjectHistoryEntry[] {
    return asArray(this.store.get('injectHistory', []), item => {
      const record = item as Record<string, unknown>
      return {
        injectId: String(record.injectId ?? ''),
        targetAlias: typeof record.targetAlias === 'string' ? record.targetAlias : undefined,
        status: String(record.status ?? ''),
        at: typeof record.at === 'number' ? record.at : 0,
        confirmedBy: typeof record.confirmedBy === 'string' ? record.confirmedBy : undefined,
        characters: typeof record.characters === 'number' ? record.characters : undefined,
        error: typeof record.error === 'string' ? record.error : null,
        event: typeof record.event === 'string' ? record.event : undefined,
        whitelistId: typeof record.whitelistId === 'string' ? record.whitelistId : undefined,
        scope: this.asInjectWhitelistScope(record.scope) ?? undefined,
        patternHash: typeof record.patternHash === 'string' ? record.patternHash : undefined,
        reason: typeof record.reason === 'string' ? record.reason : null
      }
    }).filter(item => item.injectId.length > 0)
  }

  cancelInject(input: { injectId: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const entry = { injectId: input.injectId, status: 'cancel-requested', at: Date.now(), confirmedBy: input.confirmedBy }
    this.store.set('injectHistory', [entry, ...this.listInjectHistory()].slice(0, 500))
    return { success: true, ...entry }
  }

  getWatchdogHistory(input: { instanceId?: string; sinceTs?: number } = {}) {
    return this.watchdog.history(input).map(event => watchdogEventSchema.parse(event))
  }

  private probeWatchdogPidLiveness(pid: number): PidLivenessState {
    try {
      process.kill(pid, 0)
      return 'alive'
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      if (code === 'ESRCH') return 'dead'
      if (code === 'EPERM') return 'alive'
      return 'unknown'
    }
  }

  overrideWatchdogRestart(input: { reason?: string; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const before = this.getWatchdogHistory()
    const event = this.watchdog.overrideRestart(input)
    this.queueWatchdogEventsSince(before)
    return { ...event, confirmedBy: input.confirmedBy, watchdog: this.getWatchdogStatus() }
  }

  listWatchdogActionResults(input: { instanceId?: string } = {}): WatchdogActionExecutionResult[] {
    return asArray(this.store.get('watchdogActionResults', []), item => this.parseWatchdogActionResult(item))
      .filter(item => !input.instanceId || item.instanceId === input.instanceId)
  }

  watchdogSupervisorStatus() {
    const status = this.watchdogSupervisor.status()
    this.auditWatchdogSupervisorEvidence(status)
    this.emitWatchdogSupervisorStatusIfChanged(status, 'status-query')
    return status
  }

  watchdogSupervisorRespawn(input: WatchdogSupervisorRespawnRequest) {
    const result = this.watchdogSupervisor.requestRespawn(input)
    if (result.success) {
      const heartbeatStatus = this.watchdogSupervisor.startMutualHeartbeat()
      auditLogger.log('watchdog-supervisor:heartbeat-start', this.watchdogSupervisorAuditTarget(heartbeatStatus, {
        reason: input.reason ?? null,
        confirmedBy: input.confirmedBy ?? null,
        pid: result.spawnResult?.pid ?? null
      }), 'success', 'parent-to-inner heartbeat scheduler started')
      this.emitWatchdogSupervisorEvent('heartbeat-start', heartbeatStatus, {
        result: 'success',
        message: 'parent-to-inner heartbeat scheduler started',
        reason: input.reason ?? null
      })
    }
    if (result.spawnResult) {
      const spawnResult = result.spawnResult.started ? 'success' : 'error'
      auditLogger.log('watchdog-supervisor:spawn', this.watchdogSupervisorAuditTarget(result.status, {
        reason: input.reason ?? null,
        confirmedBy: input.confirmedBy ?? null,
        code: result.code,
        success: result.success,
        pid: result.spawnResult.pid,
        command: result.spawnResult.command.command,
        entryFile: result.spawnResult.command.args[0] ?? null
      }), spawnResult, result.spawnResult.error ?? result.message)
      this.emitWatchdogSupervisorEvent('spawn', result.status, {
        result: spawnResult,
        code: result.code,
        message: result.spawnResult.error ?? result.message,
        reason: input.reason ?? null
      })
    }
    const respawnAuditResult = this.watchdogSupervisorRespawnAuditResult(result.code, result.success)
    auditLogger.log('watchdog-supervisor:respawn', this.watchdogSupervisorAuditTarget(result.status, {
      reason: input.reason ?? null,
      confirmedBy: input.confirmedBy ?? null,
      code: result.code,
      success: result.success,
      pid: result.spawnResult?.pid ?? null
    }), respawnAuditResult, result.message)
    this.emitWatchdogSupervisorEvent('respawn', result.status, {
      result: respawnAuditResult,
      code: result.code,
      message: result.message,
      reason: input.reason ?? null
    })
    return result
  }

  async watchdogSupervisorInstallService(input: WatchdogSupervisorServiceRequest) {
    const result = await this.watchdogSupervisor.installService(input)
    auditLogger.log('watchdog-supervisor:install-service', {
      confirmAdmin: input.confirmAdmin,
      confirmedBy: input.confirmedBy ?? null,
      serviceName: result.serviceName,
      requiresElevation: result.requiresElevation,
      elevated: result.elevated,
      code: result.code,
      command: result.command.command,
      args: result.command.args,
      commandLine: result.command.commandLine
    }, result.success ? 'success' : 'refused', result.message)
    this.emitWatchdogSupervisorEvent('install-service', this.watchdogSupervisor.status(), {
      result: result.success ? 'success' : 'refused',
      code: result.code === 'OK' ? null : result.code,
      message: result.message
    })
    return result
  }

  async watchdogSupervisorUninstallService(input: WatchdogSupervisorServiceRequest) {
    const result = await this.watchdogSupervisor.uninstallService(input)
    auditLogger.log('watchdog-supervisor:uninstall-service', {
      confirmAdmin: input.confirmAdmin,
      confirmedBy: input.confirmedBy ?? null,
      serviceName: result.serviceName,
      requiresElevation: result.requiresElevation,
      elevated: result.elevated,
      code: result.code,
      command: result.command.command,
      args: result.command.args,
      commandLine: result.command.commandLine
    }, result.success ? 'success' : 'refused', result.message)
    this.emitWatchdogSupervisorEvent('uninstall-service', this.watchdogSupervisor.status(), {
      result: result.success ? 'success' : 'refused',
      code: result.code === 'OK' ? null : result.code,
      message: result.message
    })
    return result
  }

  acceptWatchdogSupervisorHandshake(input: unknown) {
    try {
      const handshake = this.watchdogSupervisor.acceptHandshake(input)
      const status = this.watchdogSupervisor.status()
      auditLogger.log('watchdog-supervisor:handshake', this.watchdogSupervisorAuditTarget(status, {
        parentPid: handshake.parentPid,
        protocolVersion: handshake.protocolVersion
      }), 'success')
      this.emitWatchdogSupervisorEvent('handshake', status, {
        result: 'success',
        message: 'watchdog supervisor handshake accepted'
      })
      return handshake
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = this.watchdogSupervisor.status()
      auditLogger.log('watchdog-supervisor:handshake-fail', {
        inputType: typeof input,
        errorCode: this.errorCodeFromMessage(message)
      }, message.includes('E_PERMISSION_DENIED') ? 'refused' : 'error', message)
      this.emitWatchdogSupervisorEvent('handshake-fail', status, {
        result: message.includes('E_PERMISSION_DENIED') ? 'refused' : 'error',
        code: this.errorCodeFromMessage(message),
        message
      })
      throw error
    }
  }

  recordWatchdogSupervisorChannel(input: { channel: RpcChannel; at?: number; ok?: boolean; error?: string | null }) {
    const status = this.watchdogSupervisor.recordChannelHeartbeat(input)
    if (input.ok === false || status.status === 'degraded' || status.status === 'dead' || status.status === 'fatal') {
      auditLogger.log('watchdog-supervisor:channel-degrade', this.watchdogSupervisorAuditTarget(status, {
        channel: input.channel,
        ok: input.ok ?? true,
        error: input.error ?? null
      }), status.status === 'dead' || status.status === 'fatal' ? 'error' : 'success', input.error ?? status.note)
      this.emitWatchdogSupervisorEvent('channel-degrade', status, {
        result: status.status === 'dead' || status.status === 'fatal' ? 'error' : 'success',
        message: input.error ?? status.note,
        channel: input.channel
      })
    }
    return status
  }

  evaluateWatchdogSupervisor() {
    const status = this.watchdogSupervisor.evaluate()
    if (status.status === 'dead' || status.status === 'fatal' || status.status === 'orphan') {
      const eventType = status.status === 'orphan' ? 'orphan' : 'evaluate'
      const eventResult = status.status === 'orphan' ? 'refused' : 'error'
      auditLogger.log(status.status === 'orphan' ? 'watchdog-supervisor:orphan' : 'watchdog-supervisor:evaluate', this.watchdogSupervisorAuditTarget(status), eventResult, status.note)
      this.emitWatchdogSupervisorEvent(eventType, status, {
        result: eventResult,
        message: status.note
      })
    }
    return status
  }

  private auditWatchdogSupervisorEvidence(status: WatchdogSupervisorStatus): void {
    for (const evidence of status.evidence) {
      if (!evidence.startsWith('restart takeover adopted existing watchdog session')) continue
      const key = `${status.sessionTokenPrefix}:${evidence}`
      if (this.auditedWatchdogSupervisorEvidenceKeys.has(key)) continue
      this.auditedWatchdogSupervisorEvidenceKeys.add(key)
      auditLogger.log('watchdog-supervisor:orphan', this.watchdogSupervisorAuditTarget(status, {
        evidence
      }), 'refused', evidence)
      auditLogger.log('watchdog-supervisor:takeover', this.watchdogSupervisorAuditTarget(status, {
        evidence
      }), 'success', evidence)
      this.emitWatchdogSupervisorEvent('orphan', status, {
        result: 'refused',
        message: evidence,
        evidence
      })
      this.emitWatchdogSupervisorEvent('takeover', status, {
        result: 'success',
        message: evidence,
        evidence
      })
    }
  }

  private emitWatchdogSupervisorStatusIfChanged(status: WatchdogSupervisorStatus, reason: string): void {
    const statusKey = JSON.stringify({
      status: status.status,
      innerWatchdogPid: status.innerWatchdogPid,
      lastInnerHeartbeatAt: status.lastInnerHeartbeatAt,
      innerHealthy: status.innerHealthy,
      namedPipe: status.channelStates['named-pipe'],
      tcpLocalhost: status.channelStates['tcp-localhost'],
      markerFile: status.channelStates['marker-file'],
      spawnAttempts: status.spawnAttempts,
      lastSpawnError: status.lastSpawnError,
      respawnAllowed: status.respawnAllowed,
      evidence: status.evidence
    })
    if (this.lastWatchdogSupervisorStatusEventKey === statusKey) return
    this.lastWatchdogSupervisorStatusEventKey = statusKey
    this.emitWatchdogSupervisorEvent('status', status, { result: 'info', reason })
  }

  private emitWatchdogSupervisorEvent(
    type: WatchdogSupervisorEventType,
    status: WatchdogSupervisorStatus,
    options: {
      result?: WatchdogSupervisorEventResult
      code?: string | null
      message?: string | null
      reason?: string | null
      channel?: RpcChannel | null
      evidence?: string | null
    } = {}
  ): void {
    if (!this.isFeatureEnabled('R8.C.watchdog.subprocess')) return
    const emittedAt = Date.now()
    this.watchdogSupervisorEventSeq += 1
    const eventId = `watchdog-supervisor:${type}:${emittedAt}:${this.watchdogSupervisorEventSeq}`
    const payload = watchdogSupervisorEventStreamPayloadSchema.parse({
      emittedAt,
      events: [{
        eventId,
        emittedAt,
        type,
        status,
        result: options.result ?? 'info',
        code: options.code ?? null,
        message: options.message ?? null,
        reason: options.reason ?? null,
        channel: options.channel ?? null,
        evidence: options.evidence ?? null
      }]
    })

    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    if (typeof BrowserWindow.getAllWindows === 'function') {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) targets.add(window)
      }
    }
    for (const window of targets) {
      window.webContents.send('watchdog-supervisor:event-stream', payload)
    }
  }

  private watchdogSupervisorAuditTarget(status: WatchdogSupervisorStatus, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      status: status.status,
      innerWatchdogPid: status.innerWatchdogPid,
      innerHealthy: status.innerHealthy,
      sessionTokenPrefix: status.sessionTokenPrefix,
      channelStates: status.channelStates,
      spawnAttempts: status.spawnAttempts,
      respawnAllowed: status.respawnAllowed,
      ...extra
    }
  }

  private watchdogSupervisorRespawnAuditResult(code: string, success: boolean): AuditResult {
    if (success) return 'success'
    if (code === 'E_PERMISSION' || code === 'E_RESTART_STORM') return 'refused'
    return 'error'
  }

  private errorCodeFromMessage(message: string): string {
    const [code] = message.split(':')
    return code && code.startsWith('E_') ? code : 'E_RUNTIME'
  }

  async topologyFullscreen(input: unknown = {}): Promise<GraphSnapshot> {
    const snapshot = await this.graphService.buildGlobal({ scope: 'global', ...(typeof input === 'object' && input !== null ? input : {}) })
    this.auditTopologyTimeCursor(snapshot)
    return snapshot
  }

  async buildGlobalTopology(input: unknown = {}): Promise<GraphSnapshot> {
    const snapshot = await this.graphService.buildGlobal(input)
    this.auditTopologyTimeCursor(snapshot)
    return snapshot
  }

  async getNetworkTopology(input: unknown = {}): Promise<GraphSnapshot> {
    const snapshot = await this.graphService.buildNetwork(input)
    this.auditTopologyTimeCursor(snapshot)
    return snapshot
  }

  async getNeuralTopology(input: unknown = {}): Promise<GraphSnapshot> {
    const snapshot = await this.graphService.buildNeuralRelationship(input)
    this.auditTopologyTimeCursor(snapshot)
    return snapshot
  }

  async saveTopologySnapshot(input: unknown): Promise<{ saved: boolean; path: string }> {
    const request = graphSaveSnapshotRequestSchema.parse(input)
    const result = await this.graphService.saveSnapshot(request)
    auditLogger.log('topology:snapshot-save', {
      snapshotId: request.snapshotId,
      label: request.label,
      path: result.path
    }, result.saved ? 'success' : 'error')
    return result
  }

  async listTopologySnapshots(): Promise<GraphSavedSnapshot[]> {
    return this.graphService.listSavedSnapshots()
  }

  async exportTopology(input: unknown): Promise<GraphExportResult> {
    const request = graphExportRequestSchema.parse(input)
    const result = await this.graphService.exportFormat(request)
    auditLogger.log('topology:export', {
      snapshotId: request.snapshotId,
      format: request.format,
      mimeType: result.mimeType,
      encoding: result.encoding,
      bytes: result.content.length
    }, 'success')
    return result
  }

  async warmTopologyScopes(input: unknown): Promise<{ warmed: number }> {
    return this.graphService.warmScopes(input)
  }

  private auditTopologyTimeCursor(snapshot: GraphSnapshot): void {
    if (snapshot.slice.asOfTs === null) return
    auditLogger.log('topology:time-cursor', {
      snapshotId: snapshot.snapshotId,
      graphKind: snapshot.slice.graphKind,
      scope: snapshot.slice.scope,
      asOfTs: snapshot.slice.asOfTs
    }, 'success')
  }

  async topologyAttachedDeep10(input: unknown = {}): Promise<AttachedTopologyResult> {
    const request = attachedTopologyRequestSchema.parse(input ?? {})
    const legacyRoot = parseAttachedLegacyRootId(request.rootId)
    const scope = request.targetId === undefined && legacyRoot ? legacyRoot.scope : request.scope
    const targetId = request.targetId ?? legacyRoot?.targetId
    const lazy = request.depth >= 8 && request.expandedNodeIds.length === 0
    const buildDepth = lazy ? 7 : request.depth
    const buildStartedAt = performance.now()
    const snapshot = await this.graphService.buildGlobal({
      scope,
      targetIds: targetId === undefined ? [] : [targetId],
      graphKind: request.graphKind,
      depth: buildDepth,
      expandAll: request.expandedNodeIds.length > 0,
      layout: request.layout,
      selectedNodeId: request.selectedNodeId
    })
    const buildMs = Math.round(performance.now() - buildStartedAt)
    if (request.expandedNodeIds.length > 0 && snapshot.nodes.length > ATTACHED_TOPOLOGY_NODE_LIMIT) {
      auditLogger.log('topology:attached-lazy-expand', {
        scope,
        targetId: targetId ?? null,
        graphKind: request.graphKind,
        requestedDepth: request.depth,
        buildDepth,
        buildMs,
        nodeCount: snapshot.nodes.length,
        edgeCount: snapshot.edges.length,
        expandedNodeCount: request.expandedNodeIds.length,
        expandedNodeIds: request.expandedNodeIds.slice(0, 20),
        limit: ATTACHED_TOPOLOGY_NODE_LIMIT
      }, 'refused', 'E_GRAPH_NODE_LIMIT')
      throw new Error(`E_GRAPH_NODE_LIMIT:attached topology expansion would render ${snapshot.nodes.length} nodes; narrow depth or expand fewer nodes`)
    }
    const warning = lazy
      ? [{ code: 'E_ATTACHED_LAZY_REQUIRED', message: `Attached topology depth ${request.depth} requires an explicit node expansion before fetching beyond depth 7.` }]
      : []
    const attachedSnapshot: GraphSnapshot = {
      ...snapshot,
      slice: { ...snapshot.slice, scope, targetIds: targetId === undefined ? [] : [targetId], depth: request.depth },
      warnings: [...snapshot.warnings, ...warning],
      degraded: snapshot.degraded || lazy
    }

    const result = attachedTopologyResultSchema.parse({
      snapshot: attachedSnapshot,
      truncatedAtDepth: lazy ? 7 : null,
      expandableNodes: lazy ? attachedExpandableNodes(snapshot) : [],
      warnings: warning.map(item => item.message),
      lazy,
      thumbnailRecommended: request.thumbnailMode,
      buildMs
    })
    const auditTarget = {
      scope,
      targetId: targetId ?? null,
      graphKind: request.graphKind,
      requestedDepth: request.depth,
      buildDepth,
      nodeCount: result.snapshot.nodes.length,
      edgeCount: result.snapshot.edges.length,
      lazy: result.lazy,
      truncatedAtDepth: result.truncatedAtDepth,
      thumbnailMode: request.thumbnailMode,
      selectedNodeId: request.selectedNodeId,
      expandedNodeCount: request.expandedNodeIds.length,
      buildMs: result.buildMs ?? buildMs
    }
    auditLogger.log('topology:attached-depth', auditTarget, 'success')
    if (request.expandedNodeIds.length > 0) {
      auditLogger.log('topology:attached-lazy-expand', {
        ...auditTarget,
        expandedNodeIds: request.expandedNodeIds.slice(0, 20)
      }, 'success')
    }
    if (request.thumbnailMode) {
      auditLogger.log('topology:attached-mini-thumbnail', auditTarget, 'success')
    }
    return result
  }

  auditAttachedTopologyFavoriteChange(input: unknown): AttachedTopologyFavoriteChangeResult {
    const request = attachedTopologyFavoriteChangeRequestSchema.parse(input)
    const auditedAt = Date.now()
    auditLogger.log('topology:attached-favorite-change', {
      action: request.action,
      scope: request.favorite.scope,
      targetId: request.favorite.targetId,
      graphKind: request.favorite.graphKind,
      label: request.favorite.label,
      pinnedAt: request.favorite.pinnedAt,
      previousFavoriteCount: request.previousFavoriteCount ?? null,
      nextFavoriteCount: request.nextFavoriteCount,
      selectedNodeId: request.selectedNodeId,
      auditedAt
    }, 'success')
    return attachedTopologyFavoriteChangeResultSchema.parse({
      success: true,
      action: request.action,
      favorite: request.favorite,
      auditedAt
    })
  }

  async getAttachedFlow(input: unknown = {}): Promise<FlowSnapshot> {
    const request = flowRequestSchema.parse(input ?? {})
    const snapshot = await this.buildAttachedFlowSnapshot(request)
    auditLogger.log('flow:window', {
      scope: request.scope,
      rootId: request.rootId ?? null,
      targetId: request.targetId ?? null,
      windowMs: request.windowMs,
      fromTs: request.fromTs ?? null,
      toTs: request.toTs ?? null
    }, 'success')
    if (request.cursorTs !== undefined) {
      auditLogger.log('flow:cursor', {
        scope: request.scope,
        rootId: request.rootId ?? null,
        targetId: request.targetId ?? null,
        cursorTs: request.cursorTs,
        visibleNodes: snapshot.nodes.length
      }, 'success')
    }
    return snapshot
  }

  private async buildAttachedFlowSnapshot(request: FlowRequest): Promise<FlowSnapshot> {
    const selectedWindow = this.flowBuilder.selectWindow(request)
    const [recordings, auditEntries] = await Promise.all([
      this.collectFlowRecordings(selectedWindow.fromTs, selectedWindow.toTs),
      this.collectFlowAuditEntries(selectedWindow.fromTs, selectedWindow.toTs)
    ])
    return this.flowBuilder.build(request, {
      tasks: this.listTasks().map(task => ({ ...task, row: task.row as unknown as Record<string, unknown> })),
      csvSessions: this.listCsvSessions().map(session => session as Record<string, unknown>),
      recordings,
      auditEntries
    })
  }

  async filterAttachedFlow(input: unknown = {}): Promise<FlowSnapshot> {
    return this.getAttachedFlow(input)
  }

  async flowScopedStats(input: unknown = {}): Promise<FlowStats> {
    return (await this.getAttachedFlow(input)).stats
  }

  async exportFlowTimeline(input: unknown = {}): Promise<FlowExportResult> {
    const request = flowExportRequestSchema.parse(input ?? {})
    const snapshot = await this.buildAttachedFlowSnapshot(request)
    const exported = this.flowBuilder.exportSnapshot(snapshot, request.format)
    auditLogger.log('flow:export', {
      scope: request.scope,
      rootId: request.rootId ?? null,
      targetId: request.targetId ?? null,
      format: request.format,
      nodeCount: snapshot.nodes.length,
      bytes: Buffer.byteLength(exported.content, 'utf8')
    }, 'success')
    return exported
  }

  subscribeFlowEventStream(sender: WebContents, input?: unknown) {
    const request = flowEventStreamRequestSchema.parse(input ?? {})
    const subscriberId = request.subscriberId ?? `${sender.id}-${randomUUID()}`
    if (this.flowEventSubscribers.has(subscriberId)) {
      return flowEventStreamResponseSchema.parse({ success: true, subscriberId })
    }
    if (this.flowEventSubscribers.size >= 3) {
      throw Object.assign(new Error('E_RATE_LIMITED: flow:event-stream allows at most 3 active subscribers.'), { code: 'E_RATE_LIMITED' })
    }

    const subscriber: FlowEventSubscriber = {
      timer: setInterval(() => undefined, request.intervalMs),
      seenNodeIds: new Set<string>()
    }
    clearInterval(subscriber.timer)

    const sendSnapshot = async (reason: FlowEventStreamPayload['reason']) => {
      if (sender.isDestroyed()) {
        this.unsubscribeFlowEventStream({ subscriberId })
        return
      }
      try {
        const snapshot = await this.buildAttachedFlowSnapshot(request.request)
        const appendedNodes = snapshot.nodes.filter(node => !subscriber.seenNodeIds.has(node.id))
        for (const node of snapshot.nodes) {
          subscriber.seenNodeIds.add(node.id)
        }
        if (reason !== 'initial' && appendedNodes.length === 0) {
          return
        }
        const payload = flowEventStreamPayloadSchema.parse({
          subscriberId,
          emittedAt: Date.now(),
          snapshot,
          appendedNodes,
          reason
        })
        sender.send('flow:event-stream', payload)
      } catch (err) {
        auditLogger.log('flow:event-stream', { subscriberId, scope: request.request.scope, reason: err instanceof Error ? err.message : 'unknown' }, 'error')
      }
    }

    void sendSnapshot('initial')
    subscriber.timer = setInterval(() => { void sendSnapshot('append') }, request.intervalMs)
    subscriber.timer.unref?.()
    this.flowEventSubscribers.set(subscriberId, subscriber)
    sender.once('destroyed', () => {
      this.unsubscribeFlowEventStream({ subscriberId })
    })
    auditLogger.log('flow:event-stream:subscribe', { subscriberId, scope: request.request.scope, intervalMs: request.intervalMs }, 'success')
    return flowEventStreamResponseSchema.parse({ success: true, subscriberId })
  }

  unsubscribeFlowEventStream(input: unknown) {
    const request = flowEventStreamUnsubscribeRequestSchema.parse(input)
    const subscriber = this.flowEventSubscribers.get(request.subscriberId)
    if (subscriber) {
      clearInterval(subscriber.timer)
      this.flowEventSubscribers.delete(request.subscriberId)
      auditLogger.log('flow:event-stream:unsubscribe', { subscriberId: request.subscriberId }, 'success')
    }
    return flowEventStreamResponseSchema.parse({ success: true, subscriberId: request.subscriberId })
  }

  private async collectFlowRecordings(fromTs: number, toTs: number): Promise<Array<{ manifest: RecordingManifest; events: RecordingEvent[] }>> {
    try {
      const manifests = await this.recordingEngine.list({ sinceTs: fromTs })
      const sources: Array<{ manifest: RecordingManifest; events: RecordingEvent[] }> = []
      for (const manifest of manifests.slice(0, 50)) {
        try {
          const events = await this.recordingEngine.getEventsWindow({ recordingId: manifest.recordingId, sinceTs: fromTs, untilTs: toTs })
          sources.push({ manifest, events })
        } catch {
          sources.push({ manifest, events: [] })
        }
      }
      return sources
    } catch {
      return []
    }
  }

  private async collectFlowAuditEntries(fromTs: number, toTs: number): Promise<AuditEntry[]> {
    try {
      const text = await readFile(auditLogger.getAuditLogPath(), 'utf8')
      return text.split(/\r?\n/)
        .map(line => {
          if (line.trim().length === 0) return null
          try { return readAuditEntry(JSON.parse(line)) } catch { return null }
        })
        .filter((entry): entry is AuditEntry => entry !== null)
        .filter(entry => {
          const ts = normalizeAuditTimestamp(entry.ts)
          return ts >= fromTs && ts <= toTs
        })
        .slice(-500)
    } catch {
      return []
    }
  }

  buildScopedFlow(input: { scope?: string; rootId?: string } = {}) {
    const tasks = this.listTasks().map(task => ({ id: task.runId, status: task.status, dependency: task.row.dependency ?? null }))
    const csvSessions = this.listCsvSessions().map(session => ({ sessionId: String(session.sessionId ?? ''), status: session.status ?? null }))
    return {
      scope: input.scope ?? 'runtime',
      rootId: input.rootId ?? null,
      generatedAt: Date.now(),
      nodes: [...tasks, ...csvSessions],
      edges: tasks.filter(task => task.dependency).map(task => ({ from: task.dependency, to: task.id, kind: 'depends-on' }))
    }
  }

  fuseSignals(input: { instanceId: string; samples: unknown[]; now?: number }): FusedSignal {
    const instanceId = String(input.instanceId).trim()
    if (!instanceId) throw new Error('E_VALIDATION:instanceId required')
    const output = this.signalFusion.fuse({
      instanceId,
      samples: input.samples,
      profile: this.getActiveWeightProfile(),
      config: this.getFusionConfig(),
      now: typeof input.now === 'number' ? input.now : undefined
    })
    this.storeSignalState(output.fused, output.contributionSnapshot)
    this.emitFusionStream(output.contributionSnapshot)
    const previousTransition = this.stateCoordinator.getState(instanceId).lastTransitions[0]
    const state = this.stateCoordinator.applySignal(instanceId, output.contributionSnapshot)
    const transition = state.lastTransitions[0]
    if (transition && transition !== previousTransition) this.emitStateTransition(transition)
    return output.fused
  }

  getSignalContributions(input: { instanceId: string }): SignalContributionSnapshot {
    const instanceId = String(input.instanceId).trim()
    if (!instanceId) throw new Error('E_VALIDATION:instanceId required')
    const tracked = this.signalContributionTracker.get(instanceId)
    if (tracked) return tracked
    const stored = this.getStoredContributionSnapshot(instanceId)
    if (stored) {
      this.signalContributionTracker.record(stored)
      return stored
    }
    return this.signalFusion.fuse({
      instanceId,
      samples: [],
      profile: this.getActiveWeightProfile(),
      config: this.getFusionConfig()
    }).contributionSnapshot
  }

  getInstanceState(input: { instanceId: string }): InstanceState {
    return this.stateCoordinator.getState(input.instanceId)
  }

  transitionInstanceState(input: { instanceId: string; layer: StateLayer; event: string; reason?: string }): InstanceState {
    const state = this.stateCoordinator.transition({
      instanceId: input.instanceId,
      layer: input.layer,
      event: input.event as never,
      reason: input.reason ?? 'manual state transition'
    })
    const transition = state.lastTransitions[0]
    if (transition) this.emitStateTransition(transition)
    return state
  }

  listStateRules() {
    return this.stateCoordinator.listRules()
  }

  overrideStateRule(input: StateRuleOverrideRequest) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const result = this.stateCoordinator.overrideRule(input.ruleId, input.enabled)
    auditLogger.log('ai:override-rule', { ruleId: input.ruleId, enabled: input.enabled, confirmedBy: input.confirmedBy }, 'success')
    return result
  }

  reportMisreport(input: unknown): MisreportResponse {
    const request = reportMisreportRequestSchema.parse(input)
    const now = Date.now()
    const latest = this.misreportLogger.latestForInstance(request.instanceId)
    if (latest && now - latest.reportedAt < 60_000) throw new Error('E_RATE_LIMITED:misreport feedback is limited to once per instance per minute')

    const snapshot = this.getSignalContributions({ instanceId: request.instanceId })
    const misreportId = randomUUID()
    const adjustment = this.weightAdjuster.apply({
      misreportId,
      kind: request.kind,
      expectedTaskState: request.expectedTaskState,
      snapshot,
      currentProfile: this.getActiveWeightProfile(),
      cumulativeDeltas: this.misreportLogger.cumulativeDeltas(),
      now
    })
    this.store.set('signalWeights', adjustment.profile.weights)
    this.store.set('signalWeightProfile', adjustment.profile.profileId)

    const record = misreportRecordSchema.parse({
      id: misreportId,
      instanceId: request.instanceId,
      kind: request.kind,
      reportedBy: request.reportedBy ?? request.confirmedBy ?? 'self',
      reportedAt: now,
      signalSnapshot: snapshot,
      userNote: request.userNote,
      expectedTaskState: request.expectedTaskState
    })
    this.misreportLogger.record(record, adjustment.adjustments)
    auditLogger.log('ai:report-misreport', {
      id: record.id,
      instanceId: record.instanceId,
      kind: record.kind,
      expectedTaskState: record.expectedTaskState ?? null,
      userNote: redacted(record.userNote ?? null),
      weightAdjustments: adjustment.adjustments.map(item => ({ source: item.source, delta: item.delta }))
    }, 'success')

    return misreportResponseSchema.parse({
      id: record.id,
      record,
      weightAdjustments: adjustment.adjustments,
      profileId: adjustment.profile.profileId,
      nextWeights: adjustment.profile.weights
    })
  }

  listMisreports(input?: unknown): MisreportRecord[] {
    const request = listMisreportsRequestSchema.parse(input)
    return this.misreportLogger.list({ since: request?.since })
  }

  diagnosticExplain(input: unknown): DiagnosticExplain {
    const request = diagnosticExplainSchema.pick({ instanceId: true }).parse(input)
    return this.diagnosticExplainService.explain({
      state: this.getInstanceState({ instanceId: request.instanceId }),
      snapshot: this.getSignalContributions({ instanceId: request.instanceId })
    })
  }

  resetLearnedWeights(input: unknown): ResetLearnedWeightsResponse {
    const request = resetLearnedWeightsRequestSchema.parse(input)
    this.store.set('signalWeights', DEFAULT_WEIGHT_PROFILES.default.weights)
    this.store.set('signalWeightProfile', 'default')
    this.misreportLogger.clearAdjustments()
    auditLogger.log('ai:reset-learned-weights', { confirmedBy: request.confirmedBy, profileResetTo: 'default' }, 'success')
    return resetLearnedWeightsResponseSchema.parse({ success: true, profileResetTo: 'default' })
  }

  fusionConfig(input?: Partial<FusionConfig>) {
    if (input && Object.keys(input).length > 0) {
      const updated = fusionConfigSchema.parse({ ...this.getFusionConfig(), ...input, updatedAt: Date.now() })
      this.store.set('signalFusionConfig', updated)
    }
    const config = this.getFusionConfig()
    const profile = this.getActiveWeightProfile()
    return { ...config, profile: profile.profileId, profileId: profile.profileId, weights: profile.weights, profiles: this.listWeightProfiles(), updatedAt: config.updatedAt ?? Date.now() }
  }

  setWeightProfile(input: { weights?: Partial<Record<SignalSource, number>>; profile?: string; profileId?: WeightProfileId; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const now = Date.now()
    const requestedProfile = input.profileId ?? input.profile ?? 'default'
    const profileId = input.weights ? 'user-custom' : coerceWeightProfileId(requestedProfile)
    const profile = createWeightProfile(profileId, input.weights, now)
    this.store.set('signalWeights', profile.weights)
    this.store.set('signalWeightProfile', profile.profileId)
    auditLogger.log('ai:set-weight-profile', { profileId: profile.profileId, weights: profile.weights, confirmedBy: input.confirmedBy }, 'success', profile.warning)
    return { success: true, profile: profile.profileId, profileId: profile.profileId, weights: profile.weights, normalizedWeights: profile.weights, updatedAt: profile.updatedAt, validatedSum: profile.validatedSum, warning: profile.warning, confirmedBy: input.confirmedBy }
  }

  listWeightProfiles(): WeightProfile[] {
    const active = this.getActiveWeightProfile()
    return Object.values(DEFAULT_WEIGHT_PROFILES).map(profile => profile.profileId === 'user-custom' ? active : profile)
  }

  configureNotificationAggregation(input: NotificationAggregationConfig & { confirmedBy?: string }) {
    const config = this.notificationSystem.configureAggregation(notificationAggregationConfigSchema.parse(input))
    this.store.set('notifyConfig', { ...config, updatedAt: Date.now(), confirmedBy: input.confirmedBy ?? null })
    return { ...config, updatedAt: Date.now(), confirmedBy: input.confirmedBy ?? null }
  }

  rateLimitStats(): RateLimitStatsResponse {
    registerR8RateLimitChannels(this.listIpcChannels())
    return getRateLimitStats()
  }

  overrideRateClass(input: RateLimitOverrideRequest): RateLimitOverrideResponse {
    if (process.env.NODE_ENV !== 'development') {
      throw Object.assign(new Error('E_VALIDATION: ipc:override-rate-class is only available in development.'), {
        code: 'E_VALIDATION'
      })
    }

    const registration = overrideRateLimitChannelClass(input.channel, input.rateClass)
    const response = rateLimitOverrideResponseSchema.parse({
      success: true,
      channel: registration.channel,
      rateClass: registration.rateClass,
      confirmedBy: input.confirmedBy ?? null
    })
    auditLogger.log('ipc:override-rate-class', {
      channel: response.channel,
      rateClass: response.rateClass,
      confirmedBy: response.confirmedBy
    }, 'success')
    return response
  }

  getObservabilitySnapshot(input?: unknown): ObservabilitySnapshot {
    const request = observabilitySnapshotRequestSchema.parse(input)
    const collectedAt = Date.now()
    const context = this.buildObservabilityContext(collectedAt)
    const currentSamples = this.observabilitySnapshotBuilder
      .deriveCurrentSamples(context)
      .filter(sample => this.observabilityStore.shouldSample(sample.kind, sample.ts))

    this.observabilityStore.addMany(currentSamples)
    const buffered = this.observabilityStore.snapshot(request?.sinceMs, collectedAt)

    return this.observabilitySnapshotBuilder.build({
      ...context,
      existingSamples: buffered.samples,
      windowStart: buffered.windowStart,
      windowEnd: buffered.windowEnd
    })
  }

  configureObservability(input: unknown = {}) {
    const parsed = observabilityConfigSchema.parse(input)
    const snapshot = this.observabilityStore.configure(parsed)
    this.store.set('observabilityConfig', snapshot.config)
    auditLogger.log('obs:configure', {
      ringBufferMinutes: snapshot.config.ringBufferMinutes,
      samplingHz: snapshot.config.samplingHz,
      exportEnabled: snapshot.config.exportEnabled,
      effectiveSamplingHz: snapshot.effectiveSamplingHz
    }, 'success')
    return observabilityConfigureResponseSchema.parse({
      success: true,
      config: snapshot.config,
      effectiveSamplingHz: snapshot.effectiveSamplingHz
    })
  }

  async exportObservabilitySnapshot(input?: unknown): Promise<ObservabilityExportSnapshotResponse> {
    const request = observabilityExportSnapshotRequestSchema.parse(input)
    const config = this.observabilityStore.getConfig()
    if (!config.exportEnabled) {
      throw Object.assign(new Error('E_VALIDATION: observability export is disabled.'), { code: 'E_VALIDATION' })
    }

    const snapshot = this.getObservabilitySnapshot()
    const exportedAt = Date.now()
    const format = request?.format ?? 'json'
    const filePath = this.resolveObservabilityExportPath(format, request?.destPath, exportedAt)
    const content = format === 'csv'
      ? this.serializeObservabilityCsv(snapshot)
      : JSON.stringify(snapshot, null, 2)

    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
    const response = observabilityExportSnapshotResponseSchema.parse({
      success: true,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      filePath,
      format,
      exportedAt
    })
    auditLogger.log('obs:export-snapshot', {
      filePath: response.filePath,
      format: response.format,
      sizeBytes: response.sizeBytes
    }, 'success')
    return response
  }

  async exportObservabilityDiagnosticPack(input?: unknown): Promise<ObservabilityDiagnosticPackResponse> {
    const request = observabilityDiagnosticPackRequestSchema.parse(input)
    const result = await this.exportDiagnosticPack({
      includeAudit: true,
      includeSnapshot: true,
      includeScreenshots: request?.includeScreenshots ?? false,
      redactPII: true
    })
    return observabilityDiagnosticPackResponseSchema.parse({
      zipPath: null,
      path: result.path,
      bytes: result.bytes,
      exportedAt: result.exportedAt
    })
  }

  subscribeObservability(sender: WebContents, input?: unknown) {
    const request = observabilitySubscribeRequestSchema.parse(input)
    const subscriberId = request?.subscriberId ?? `${sender.id}-${randomUUID()}`
    if (this.observabilitySubscribers.has(subscriberId)) {
      return observabilitySubscribeResponseSchema.parse({ success: true, subscriberId })
    }
    if (this.observabilitySubscribers.size >= 3) {
      throw Object.assign(new Error('E_RATE_LIMITED: obs:subscribe allows at most 3 active subscribers.'), { code: 'E_RATE_LIMITED' })
    }

    const sendSnapshot = () => {
      if (sender.isDestroyed()) {
        this.unsubscribeObservability({ subscriberId })
        return
      }
      const snapshot = this.getObservabilitySnapshot()
      const streamWindowStart = snapshot.collectedAt - 500
      const payload = snapshot.metrics.filter(sample => sample.ts >= streamWindowStart)
      sender.send('obs:subscribe', payload)
    }

    sendSnapshot()
    const timer = setInterval(sendSnapshot, 500)
    timer.unref?.()
    this.observabilitySubscribers.set(subscriberId, timer)
    sender.once('destroyed', () => {
      this.unsubscribeObservability({ subscriberId })
    })
    return observabilitySubscribeResponseSchema.parse({ success: true, subscriberId })
  }

  unsubscribeObservability(input: unknown) {
    const request = observabilityUnsubscribeRequestSchema.parse(input)
    const timer = this.observabilitySubscribers.get(request.subscriberId)
    if (timer) {
      clearInterval(timer)
      this.observabilitySubscribers.delete(request.subscriberId)
    }
    return observabilityUnsubscribeResponseSchema.parse({ success: true, subscriberId: request.subscriberId })
  }

  async runStartupRecoveryProbe(): Promise<RecoveryCheckDirtyResponse> {
    try {
      const response = await this.recoveryProbe.runStartupProbe()
      if (response.findings.length > 0) {
        this.getMainWindow()?.webContents.send('recovery:dirty-found', response)
      }
      return response
    } catch (error) {
      const now = Date.now()
      const fallback = recoveryCheckDirtyResponseSchema.parse({
        findings: [{
          kind: 'inconsistent-state-machine',
          severity: 'medium',
          detectedAt: now,
          details: { error: error instanceof Error ? error.message : String(error) },
          recommendedAction: 'manual-review'
        }],
        report: {
          reportId: `recovery-${randomUUID()}`,
          scannedAt: now,
          startedAt: now,
          completedAt: now,
          findings: [{
            kind: 'inconsistent-state-machine',
            severity: 'medium',
            detectedAt: now,
            details: { error: error instanceof Error ? error.message : String(error) },
            recommendedAction: 'manual-review'
          }],
          snapshotsCreated: [],
          userChoice: null,
          appliedActions: [],
          issues: [{ kind: 'inconsistent-state-machine', severity: 'warning', count: 1 }]
        },
        probe: {
          probeId: randomUUID(),
          startedAt: now,
          completedAt: now,
          durationMs: 0,
          timedOut: false,
          findingsCount: 1
        }
      })
      this.persistRecoveryReport(fallback.report)
      return fallback
    }
  }

  async recoveryCheckDirty(input: unknown = {}): Promise<RecoveryCheckDirtyResponse> {
    recoveryCheckDirtyRequestSchema.parse(input)
    return this.recoveryProbe.checkDirty()
  }

  async recoveryScan(): Promise<RecoveryReport> {
    return (await this.recoveryCheckDirty()).report
  }

  recoveryReport(): RecoveryReport[] {
    return asArray(this.store.get('recoveryReports', []), item => this.normalizeRecoveryReport(item))
  }

  async recoveryListSnapshots() {
    return recoveryListSnapshotsResponseSchema.parse({ snapshots: await this.recoveryStrategy.listSnapshots() }).snapshots
  }

  async recoveryCreateCheckpoint(input: unknown = {}) {
    const request = recoveryCreateCheckpointRequestSchema.parse(input)
    return recoverySnapshotSchema.parse(await this.recoveryStrategy.createCheckpoint(request.reason))
  }

  async recoveryRestoreState(input: unknown) {
    const request = recoveryRestoreStateRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const report = await this.recoveryStrategy.applyRecovery({
      kindsToRestore: request.kindsToRestore,
      snapshotId: request.snapshotId,
      userChoice: request.userChoice
    })
    this.persistRecoveryReport(report)
    return report
  }

  dismissRecoveryReport(input: unknown): RecoveryDismissResponse {
    const request = recoveryDismissRequestSchema.parse(input)
    const now = Date.now()
    let reportId: string | null = null
    if (request.reportId) {
      reportId = request.reportId
      const next = this.recoveryReport().filter(report => report.reportId !== request.reportId)
      this.store.set('recoveryReports', next)
    }
    const findingsDismissed = request.findingsToDismiss ?? []
    let dismissedUntil: number | null = null
    if (findingsDismissed.length > 0) {
      dismissedUntil = now + 7 * 24 * 60 * 60 * 1000
      const current = this.store.get('recoveryDismissals', {}) ?? {}
      const dismissals = typeof current === 'object' && current !== null ? { ...(current as Record<string, number>) } : {}
      for (const kind of findingsDismissed) dismissals[kind] = dismissedUntil
      this.store.set('recoveryDismissals', dismissals)
    }
    return recoveryDismissResponseSchema.parse({ success: true, reportId, findingsDismissed, dismissedUntil, dismissedAt: now })
  }

  async restoreBackup(input: unknown) {
    const request = restorePlanSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const backup = this.findBackupBundle(request.backupId ?? request.bundleId)
    if (!backup) throw new Error('E_BACKUP_NOT_FOUND')

    if (!backup.backupId || !backup.artifactPath) {
      return this.restoreLegacyBackup(backup, {
        bundleId: request.bundleId ?? backup.bundleId,
        confirmedBy: request.confirmedBy
      })
    }

    const startedAt = Date.now()
    const manifest = await this.loadBackupManifest(backup)
    const requestedCategories = request.categoriesToRestore ?? (request.scope ? legacyScopeToCategories(request.scope) : manifest.categories.map(category => category.category))
    const categoriesToRestore = requestedCategories.filter(category => manifest.categories.some(entry => entry.category === category))
    const verifiedCategories: Array<{ category: BackupCategory; payload: unknown; fileCount: number }> = []
    for (const category of categoriesToRestore) {
      const categoryFile = await this.readVerifiedBackupCategory(manifest, category)
      verifiedCategories.push({ category, payload: categoryFile.payload, fileCount: categoryFile.fileCount })
    }
    const preRestoreSnapshot = request.preRestoreSnapshot
      ? await this.recoveryStrategy.createCheckpoint('pre-recovery')
      : null
    const restored: RestoreResult['restored'] = []

    for (const categoryFile of verifiedCategories) {
      try {
        const fileCount = await this.restoreBackupCategory(categoryFile.category, categoryFile.payload, request.conflictPolicy)
        restored.push({ category: categoryFile.category, fileCount, success: true, errors: [] })
      } catch (error) {
        restored.push({
          category: categoryFile.category,
          fileCount: 0,
          success: false,
          errors: [error instanceof Error ? error.message : String(error)]
        })
      }
    }

    const finishedAt = Date.now()
    const result = restoreResultSchema.parse({
      startedAt,
      finishedAt,
      restored,
      preRestoreSnapshotId: preRestoreSnapshot?.snapshotId ?? null
    })
    auditLogger.log('backup:restore', {
      backupId: manifest.backupId,
      bundleId: manifest.bundleId,
      categories: categoriesToRestore,
      preRestoreSnapshotId: result.preRestoreSnapshotId,
      confirmedBy: request.confirmedBy
    }, restored.every(item => item.success) ? 'success' : 'error', restored.find(item => !item.success)?.errors[0])
    return {
      ...result,
      success: restored.every(item => item.success),
      backupId: manifest.backupId,
      bundleId: manifest.bundleId,
      skipped: manifest.categories.map(item => item.category).filter(category => !categoriesToRestore.includes(category)),
      restoredAt: finishedAt,
      confirmedBy: request.confirmedBy
    }
  }

  async deleteBackup(input: unknown) {
    const request = backupDeleteRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const backup = this.findBackupBundle(request.backupId ?? request.bundleId)
    if (!backup) return { success: false, error: 'E_BACKUP_NOT_FOUND', backupId: request.backupId ?? null, bundleId: request.bundleId ?? null }
    const backupPath = backup.artifactPath ?? backup.path
    if (existsSync(backupPath)) {
      const backupStat = await stat(backupPath)
      if (backupStat.isDirectory()) await rm(backupPath, { recursive: true, force: true })
      else await unlink(backupPath)
    }
    if (backup.zipPath && backup.zipPath !== backupPath && existsSync(backup.zipPath)) {
      await unlink(backup.zipPath)
    }
    this.store.set('backups', this.listBackups().filter(item => item.bundleId !== backup.bundleId && item.backupId !== backup.backupId))
    auditLogger.log('backup:delete', { backupId: backup.backupId ?? null, bundleId: backup.bundleId, confirmedBy: request.confirmedBy }, 'success')
    return { success: true, backupId: backup.backupId ?? null, bundleId: backup.bundleId, deletedAt: Date.now() }
  }

  async purgeDiagnostics(input: { confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const diagnostics = this.listDiagnostics()
    let deleted = 0
    for (const diagnostic of diagnostics) {
      const path = typeof diagnostic.path === 'string' ? diagnostic.path : null
      if (path && existsSync(path)) {
        const diagnosticStat = await stat(path)
        if (diagnosticStat.isDirectory()) await rm(path, { recursive: true, force: true })
        else await unlink(path)
        deleted += 1
      }
    }
    this.store.set('diagnostics', [])
    return { success: true, deleted, purgedAt: Date.now(), confirmedBy: input.confirmedBy }
  }

  listPermissionAllowlist() {
    return asArray(this.store.get('permissionAllowlist', []), item => ({ ...(item as Record<string, unknown>) }))
  }

  resetPermissions(input: { confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    this.store.set('permissions', [])
    return { success: true, resetAt: Date.now(), confirmedBy: input.confirmedBy }
  }

  startRecording(input: { label?: string; source?: RecordingSession['source']; confirmedBy?: string }): RecordingSession
  startRecording(input: RecordingStartRequest): Promise<RecordingManifest>
  startRecording(input: unknown): RecordingSession | Promise<RecordingManifest> {
    if (!this.isFeatureEnabled('R8.C.recording.engine')) throw new Error('E_FEATURE_DISABLED:R8.C.recording.engine')
    const realRequest = recordingStartRequestSchema.safeParse(input)
    if (realRequest.success) {
      if (!realRequest.data.confirmedBy || realRequest.data.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
      return this.recordingEngine.start(this.applyRecordingStreamFlags(realRequest.data))
    }
    const legacyInput = input as { label?: string; source?: RecordingSession['source']; confirmedBy?: string }
    if (!legacyInput.confirmedBy || legacyInput.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const session = recordingSessionSchema.parse({
      sessionId: `recording-${randomUUID()}`,
      label: legacyInput.label ?? 'R8 recording',
      source: legacyInput.source ?? 'system',
      startedAt: Date.now(),
      stoppedAt: null,
      status: 'recording',
      events: [{ type: 'recording:start', at: Date.now(), payload: { confirmedBy: legacyInput.confirmedBy } }]
    })
    this.store.set('recordingSessions', [session, ...this.listLegacyRecordings()].slice(0, 200))
    return session
  }

  private applyRecordingStreamFlags(request: RecordingStartRequest): RecordingStartRequest {
    const sourceStreams = request.enabledStreams ?? [...DEFAULT_RECORDING_RUNTIME_STREAMS]
    const enabledStreams = Array.from(new Set(sourceStreams.filter(kind => this.isRecordingStreamEnabled(kind))))
    if (enabledStreams.length === 0) throw new Error('E_FEATURE_DISABLED:recording streams disabled')
    return { ...request, enabledStreams }
  }

  private isRecordingStreamEnabled(kind: RecordingStreamKind): boolean {
    const flag = RECORDING_STREAM_FLAGS[kind]
    return flag ? this.isFeatureEnabled(flag) : true
  }

  stopRecording(input: { sessionId: string; confirmedBy?: string }): RecordingSession | null
  stopRecording(input: { recordingId: string; confirmedBy?: string }): Promise<RecordingManifest | null>
  stopRecording(input: { recordingId?: string; sessionId?: string; confirmedBy?: string }): RecordingSession | null | Promise<RecordingManifest | null> {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    if (input.recordingId) return this.recordingEngine.stop(input.recordingId)
    if (!input.sessionId) throw new Error('E_NOT_FOUND:recording')
    const sessions = this.listLegacyRecordings().map(session => session.sessionId === input.sessionId
      ? recordingSessionSchema.parse({
        ...session,
        stoppedAt: Date.now(),
        status: 'stopped',
        events: [...session.events, { type: 'recording:stop', at: Date.now(), payload: { confirmedBy: input.confirmedBy } }]
      })
      : session)
    this.store.set('recordingSessions', sessions)
    return sessions.find(session => session.sessionId === input.sessionId) ?? null
  }

  listRecordings(): RecordingSession[]
  listRecordings(input: { sessionId?: string; taskId?: string; sinceTs?: number }): Promise<RecordingManifest[]>
  listRecordings(input?: { sessionId?: string; taskId?: string; sinceTs?: number }): RecordingSession[] | Promise<RecordingManifest[]> {
    if (input) return this.recordingEngine.list(recordingListRequestSchema.parse(input) ?? {})
    return this.listLegacyRecordings()
  }

  async listRecordingManifests(input?: { sessionId?: string; taskId?: string; sinceTs?: number }): Promise<RecordingManifest[]> {
    return this.recordingEngine.list(recordingListRequestSchema.parse(input) ?? {})
  }

  getRecordingManifest(input: { sessionId: string }): { success: boolean; error: string | null; manifest: RecordingSession | null }
  getRecordingManifest(input: { recordingId: string }): Promise<{ success: boolean; error: string | null; manifest: RecordingManifest | null }>
  getRecordingManifest(input: { recordingId?: string; sessionId?: string }): { success: boolean; error: string | null; manifest: RecordingSession | null } | Promise<{ success: boolean; error: string | null; manifest: RecordingManifest | null }> {
    const realRequest = recordingGetManifestRequestSchema.safeParse(input)
    if (realRequest.success && realRequest.data.recordingId) {
      return this.recordingEngine.getManifest(realRequest.data).then(manifest => ({ success: Boolean(manifest), error: manifest ? null : 'E_RECORDING_NOT_FOUND', manifest }))
    }
    const session = this.listLegacyRecordings().find(item => item.sessionId === input.sessionId)
    if (!session) return { success: false, error: 'E_RECORDING_NOT_FOUND', manifest: null }
    return { success: true, error: null, manifest: session }
  }

  getRecordingEvents(input: unknown) {
    return this.recordingEngine.getEvents(recordingGetEventsRequestSchema.parse(input))
  }

  getRecordingReplayState(input: unknown) {
    return this.recordingEngine.getReplayState(recordingGetReplayStateRequestSchema.parse(input))
  }

  getRecordingEventsWindow(input: unknown) {
    return this.recordingEngine.getEventsWindow(recordingGetEventsWindowRequestSchema.parse(input))
  }

  getRecordingCast(input: unknown) {
    return this.recordingEngine.getCast(recordingGetCastRequestSchema.parse(input))
  }

  listRecordingAnchors(input: unknown) {
    return this.recordingEngine.listAnchors(recordingListAnchorsRequestSchema.parse(input))
  }

  getRecordingScreenshot(input: unknown) {
    return this.recordingEngine.getScreenshot(recordingGetScreenshotRequestSchema.parse(input))
  }

  getRecordingFsSnapshotAt(input: unknown) {
    return this.recordingEngine.getFsSnapshotAt(recordingGetFsSnapshotAtRequestSchema.parse(input))
  }

  exportRecordingAsciinema(input: unknown) {
    const request = recordingExportAsciinemaRequestSchema.parse(input)
    return this.recordingEngine.exportAsciinema(request.recordingId, request.outPath)
  }

  exportRecordingZip(input: unknown) {
    const request = recordingExportZipRequestSchema.parse(input)
    return this.recordingEngine.exportZip(request.recordingId, request.outPath, { redact: request.redact })
  }

  deleteRecording(input: unknown) {
    const request = recordingDeleteRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    return this.recordingEngine.delete(request.recordingId)
  }

  private listLegacyRecordings(): RecordingSession[] {
    return asArray(this.store.get('recordingSessions', []), item => recordingSessionSchema.parse(item))
  }

  startReplay(input: { sessionId: string; confirmedBy?: string }): ReplayState {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const session = this.listRecordings().find(item => item.sessionId === input.sessionId)
    if (!session) throw new Error('E_RECORDING_NOT_FOUND')
    const replay = replayStateSchema.parse({ replayId: `replay-${randomUUID()}`, sessionId: input.sessionId, startedAt: Date.now(), cursorMs: 0, status: 'running' })
    this.store.set('replayStates', [replay, ...this.listReplayStates()].slice(0, 200))
    return replay
  }

  seekReplay(input: { replayId: string; cursorMs: number }) {
    const states = this.listReplayStates().map(replay => replay.replayId === input.replayId
      ? replayStateSchema.parse({ ...replay, cursorMs: Math.max(0, Number(input.cursorMs)), status: 'paused' })
      : replay)
    this.store.set('replayStates', states)
    return states.find(replay => replay.replayId === input.replayId) ?? null
  }

  async exportReplay(input: { replayId: string }) {
    const replay = this.listReplayStates().find(item => item.replayId === input.replayId)
    if (!replay) throw new Error('E_REPLAY_NOT_FOUND')
    const session = this.listRecordings().find(item => item.sessionId === replay.sessionId)
    const directory = join(app.getPath('userData'), 'r8-replays')
    await mkdir(directory, { recursive: true })
    const path = join(directory, `${replay.replayId}.json`)
    const payload = { replay: { ...replay, status: 'exported' }, session, exportedAt: Date.now() }
    await writeFile(path, JSON.stringify(payload, null, 2), 'utf8')
    return { success: true, path, bytes: Buffer.byteLength(JSON.stringify(payload)), exportedAt: payload.exportedAt }
  }

  listReplayStates(): ReplayState[] {
    return asArray(this.store.get('replayStates', []), item => replayStateSchema.parse(item))
  }

  cursorCopilotStatus(input: { instanceId?: string } = {}) {
    const snapshot = this.runtime?.scannerCache?.getSnapshot() as { windows?: { data?: unknown[] }; aiTasks?: { data?: unknown[] } } | undefined
    const status = this.cursorCopilotDetector.status({
      windows: (snapshot?.windows?.data ?? []) as never,
      aiTasks: (snapshot?.aiTasks?.data ?? []) as never,
      instanceId: input.instanceId
    })
    this.auditCursorCopilotTitleSignals(status.signals as WindowTitleSignalLike[])
    return status
  }

  private auditCursorCopilotTitleSignals(signals: readonly WindowTitleSignalLike[]): void {
    for (const signal of signals) {
      const key = `${signal.hwnd}:${signal.pid}:${signal.titleHash}:${signal.tool}:${signal.phase}`
      if (this.auditedCursorCopilotTitleKeys.has(key)) continue
      if (this.auditedCursorCopilotTitleKeys.size > 512) this.auditedCursorCopilotTitleKeys.clear()
      this.auditedCursorCopilotTitleKeys.add(key)
      auditLogger.log('cli:cursor-copilot-title-signal', {
        instanceId: signal.instanceId,
        tool: signal.tool,
        phase: signal.phase,
        confidence: signal.confidence,
        source: signal.source,
        titleHash: signal.titleHash,
        hwnd: signal.hwnd,
        pid: signal.pid,
        processName: signal.processName,
        ts: signal.ts
      }, signal.tool === 'unknown' ? 'refused' : 'success', signal.tool === 'unknown' ? 'exe-whitelist-failed' : undefined)
    }
  }

  monitorSnapshot(): MonitorSnapshot {
    const status = this.cursorCopilotStatus()
    const titleSignals = status.signals.filter((signal: WindowTitleSignalLike) => signal.tool !== 'unknown')
    const events = this.listCliEvents()
    const sessions = this.listCliSessions()
    const cards = MONITOR_TOOLS.map(tool => this.buildMonitorCard(tool, events, sessions, titleSignals))
    return monitorSnapshotSchema.parse({ cards, windowState: this.getMonitorWindowState(), collectedAt: Date.now() })
  }

  async openMonitorWindow() {
    const state = this.getMonitorWindowState()
    const existing = this.findLiveBrowserPopout(popout => popout.surface === 'monitor' && popout.targetId === 'r8-monitor')
    if (existing) {
      this.applyMonitorWindowState(this.popoutWindows.get(existing.windowId), state)
      this.focusPopoutWindow(existing.windowId)
      auditLogger.log('monitor:open', { windowId: existing.windowId, reused: true, alwaysOnTop: state.alwaysOnTop, opacity: state.opacity }, 'success')
      this.queueMonitorSnapshotStream()
      return { success: true, windowId: existing.windowId, popout: existing, windowState: state }
    }
    const popout = await this.createPopout({ surface: 'monitor', targetId: 'r8-monitor', mode: 'browserwindow', route: '/monitor', bounds: this.monitorStateToR8Bounds(state), title: 'DevHub R8 Monitor' })
    this.applyMonitorWindowState(this.popoutWindows.get(popout.windowId), state)
    auditLogger.log('monitor:open', { windowId: popout.windowId, reused: false, alwaysOnTop: state.alwaysOnTop, opacity: state.opacity }, 'success')
    this.queueMonitorSnapshotStream()
    return { success: true, windowId: popout.windowId, popout, windowState: state }
  }

  closeMonitorWindow() {
    const monitorPopouts = this.listPopouts().filter(popout => popout.surface === 'monitor' && popout.targetId === 'r8-monitor')
    for (const popout of monitorPopouts) this.closePopout({ windowId: popout.windowId })
    auditLogger.log('monitor:close', { closed: monitorPopouts.length, windowIds: monitorPopouts.map(popout => popout.windowId) }, 'success')
    this.queueMonitorSnapshotStream()
    return { success: true, closed: monitorPopouts.length, closedAt: Date.now() }
  }

  setMonitorWindowPrefs(input: { alwaysOnTop?: boolean; opacity?: number; bounds?: unknown; confirmedBy?: string }) {
    if (!input.confirmedBy || input.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const current = this.getMonitorWindowState()
    const next = monitorWindowStateSchema.parse({
      alwaysOnTop: input.alwaysOnTop ?? current.alwaysOnTop,
      opacity: input.opacity ?? current.opacity,
      bounds: this.normalizeMonitorBounds(input.bounds, current.bounds)
    })
    this.store.set('monitorWindowPrefs', next)
    for (const popout of this.listPopouts().filter(item => item.surface === 'monitor')) this.applyMonitorWindowState(this.popoutWindows.get(popout.windowId), next)
    auditLogger.log('monitor:set-window-prefs', { alwaysOnTop: next.alwaysOnTop, opacity: next.opacity, bounds: next.bounds, confirmedBy: input.confirmedBy }, 'success')
    this.queueMonitorSnapshotStream()
    return { success: true, windowState: next, updatedAt: Date.now(), confirmedBy: input.confirmedBy }
  }

  focusMonitorInstance(input: { tool: MonitorTool; instanceId: string }) {
    const payload = { ...input, focusedAt: Date.now() }
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('monitor:focus-instance', payload)
    }
    const monitor = this.findLiveBrowserPopout(popout => popout.surface === 'monitor' && popout.targetId === 'r8-monitor')
    if (monitor) this.focusPopoutWindow(monitor.windowId)
    return { success: true, ...payload }
  }

  async openMonitorPopout(input: { tool: MonitorTool; layout?: MonitorPopoutLayout }) {
    if (!this.isFeatureEnabled('R8.C.monitor.popout')) throw new Error('E_FEATURE_DISABLED:R8.C.monitor.popout')
    const monitor = this.findLiveBrowserPopout(popout => popout.surface === 'monitor' && popout.targetId === 'r8-monitor')
    if (!monitor) throw new Error('E_NOT_FOUND:monitor window must be opened before tool popouts')
    const duplicate = this.listMonitorPopouts().find(popout => popout.tool === input.tool)
    if (duplicate) throw new Error('E_VALIDATION:monitor popout already exists for tool')
    const popout = await this.createPopout({
      surface: 'monitor',
      targetId: input.tool,
      mode: 'browserwindow',
      route: `/monitor/popout/${input.tool}`,
      bounds: { x: DEFAULT_MONITOR_WINDOW_STATE.bounds.x + 24, y: DEFAULT_MONITOR_WINDOW_STATE.bounds.y + 24, ...MONITOR_POPOUT_SIZE },
      title: `DevHub ${input.tool} monitor`
    })
    const layout = input.layout ?? 'compact'
    this.setMonitorPopoutLayout(popout.windowId, layout)
    const monitorPopout = this.toMonitorPopout(popout, layout, this.monitorSnapshot())
    auditLogger.log('monitor:popout-open', { popoutId: popout.windowId, tool: input.tool, layout }, 'success')
    this.queueMonitorSnapshotStream()
    return { success: true, popoutId: popout.windowId, popout: monitorPopout }
  }

  closeMonitorPopout(input: { popoutId: string }) {
    this.deleteMonitorPopoutLayout(input.popoutId)
    this.closePopout({ windowId: input.popoutId })
    auditLogger.log('monitor:popout-close', { popoutId: input.popoutId }, 'success')
    this.queueMonitorSnapshotStream()
    return { success: true, popoutId: input.popoutId, closedAt: Date.now() }
  }

  private normalizeDiagnosticPackOptions(input: unknown): DiagnosticPackOptions {
    const record = isRecord(input) ? input : {}
    const legacy = diagnosticExportRequestSchema.safeParse(input ?? {})
    const legacySections = legacy.success
      ? [
          ...(legacy.data.includeSnapshot ? ['observability-snapshot' as const] : []),
          ...(legacy.data.includeAudit ? ['audit-log' as const] : []),
          'state-machine-ringbuffer' as const,
          'misreport-records' as const,
          'system-info' as const,
          'recovery-report' as const,
          'feature-flags' as const,
          'env-config-redacted' as const
        ]
      : [...DEFAULT_DIAGNOSTIC_SECTIONS]
    const includeScreenshots = typeof record.includeScreenshots === 'boolean'
      ? record.includeScreenshots
      : legacy.success ? legacy.data.includeScreenshot : false
    return diagnosticPackOptionsSchema.parse({
      sectionsIncluded: Array.isArray(record.sectionsIncluded) ? record.sectionsIncluded : legacySections,
      includeScreenshots,
      screenshotMode: typeof record.screenshotMode === 'string' ? record.screenshotMode : undefined,
      redactionLevel: typeof record.redactionLevel === 'string'
        ? record.redactionLevel
        : legacy.success && !legacy.data.redactPII ? 'minimal' : 'aggressive',
      customRedactionRules: Array.isArray(record.customRedactionRules) ? record.customRedactionRules : undefined,
      destPath: typeof record.destPath === 'string' ? record.destPath : undefined
    })
  }

  private effectiveDiagnosticSections(options: DiagnosticPackOptions): DiagnosticSection[] {
    const sections: DiagnosticSection[] = options.sectionsIncluded.filter(section => section !== 'screenshots')
    if (options.includeScreenshots) sections.push('screenshots')
    return [...new Set(sections)]
  }

  private getDiagnosticRedactionRules(options: DiagnosticPackOptions): DiagnosticRedactionRule[] {
    const defaults = defaultDiagnosticRedactionRules()
    const filteredDefaults = defaults.filter(rule => {
      if (options.redactionLevel === 'aggressive') return true
      if (options.redactionLevel === 'standard') return rule.category !== 'identity' || rule.ruleId === 'email'
      return rule.category === 'secret'
    })
    return [...filteredDefaults, ...options.customRedactionRules].filter(rule => rule.enabled)
  }

  private async collectDiagnosticSection(section: DiagnosticSection, options: DiagnosticPackOptions): Promise<DiagnosticSectionPayload> {
    if (section === 'observability-snapshot') {
      return { section, fileCount: 1, warnings: [], payload: this.getObservabilitySnapshot() }
    }
    if (section === 'audit-log') {
      const auditPath = auditLogger.getAuditLogPath()
      const content = existsSync(auditPath) ? await readFile(auditPath, 'utf8') : ''
      return {
        section,
        fileCount: content.length > 0 ? 1 : 0,
        warnings: content.length > 0 ? [] : ['audit log file does not exist or is empty'],
        payload: { path: auditPath, content }
      }
    }
    if (section === 'state-machine-ringbuffer') {
      return {
        section,
        fileCount: 1,
        warnings: [],
        payload: {
          taskStateTransitions: this.store.get('taskStateTransitions', []),
          signalStates: this.store.get('signalStates', {}),
          signalContributionSnapshots: this.store.get('signalContributionSnapshots', {})
        }
      }
    }
    if (section === 'misreport-records') {
      return { section, fileCount: 1, warnings: [], payload: { records: this.listMisreports({}) } }
    }
    if (section === 'system-info') {
      return {
        section,
        fileCount: 1,
        warnings: [],
        payload: {
          platform: process.platform,
          arch: process.arch,
          node: process.versions.node,
          electron: process.versions.electron ?? null,
          appVersion: typeof app.getVersion === 'function' ? app.getVersion() : '0.0.0',
          hostname: hostname(),
          username: userInfo().username,
          memory: { total: totalmem(), free: freemem() },
          userDataPath: this.resolveUserDataPath(),
          cwd: process.cwd()
        }
      }
    }
    if (section === 'screenshots') {
      const screenshot = await this.captureDiagnosticScreenshot({ mode: options.screenshotMode })
      return {
        section,
        fileCount: screenshot.success ? 1 : 0,
        warnings: screenshot.warning ? [screenshot.warning] : [],
        payload: { requested: true, mode: options.screenshotMode, screenshot }
      }
    }
    if (section === 'recovery-report') {
      return { section, fileCount: 1, warnings: [], payload: { reports: this.recoveryReport() } }
    }
    if (section === 'feature-flags') {
      return { section, fileCount: 1, warnings: [], payload: { flags: this.listFeatureFlags(), overrides: this.getFeatureOverrides() } }
    }
    return {
      section,
      fileCount: 1,
      warnings: [],
      payload: {
        env: Object.fromEntries(Object.entries(process.env)
          .filter(([key]) => /^(NODE_|npm_|PNPM_|PATH|USERNAME|USER|HOME|USERPROFILE|COMPUTERNAME|DEVHUB_|OPENAI_|ANTHROPIC_|GITHUB_|AWS_)/i.test(key))
          .slice(0, 80)),
        config: {
          userDataPath: this.resolveUserDataPath(),
          cwd: process.cwd(),
          featureOverrides: this.getFeatureOverrides()
        }
      }
    }
  }

  private resolveDiagnosticArtifactPath(destPath: string | undefined, packId: string): string {
    const root = !destPath || !destPath.trim()
      ? join(this.resolveUserDataPath(), 'diagnostic-packs')
      : isAbsolute(destPath) ? destPath : resolve(this.resolveUserDataPath(), destPath)
    const extensionlessRoot = root.endsWith('.zip') || root.endsWith('.json')
      ? root.replace(/\.[^.\\/]+$/, '')
      : root
    return join(extensionlessRoot, `devhub-diagnostic-${packId}`)
  }

  private readPermissionTtlGrants(): PermissionTtlGrant[] {
    return asArray(this.store.get('permissionTtlGrants', []), item => permissionTtlGrantSchema.parse(item))
  }

  private invalidatePermissionExpiryStreamPayload(): void {
    this.cachedPermissionExpiryStreamPayload = null
    this.lastPermissionExpiryStreamPayloadAt = 0
  }

  private getPermissionPolicy(op: SensitivePermissionOperation): PermissionPolicy {
    const policies = this.store.get('permissionTtlPolicies', {}) ?? {}
    const rawPolicy = isRecord(policies) ? policies[op] : undefined
    return permissionPolicySchema.parse({
      op,
      ...(isRecord(rawPolicy) ? rawPolicy : {})
    })
  }

  private recordPermissionRequestAllowed(op: SensitivePermissionOperation, policy: PermissionPolicy): boolean {
    const now = Date.now()
    const windowStart = now - 60 * 60_000
    const requestLog = this.store.get('permissionTtlRequestLog', {}) ?? {}
    const currentLog = isRecord(requestLog) ? requestLog : {}
    const entries = Array.isArray(currentLog[op])
      ? (currentLog[op] as unknown[]).filter(entry => typeof entry === 'number' && entry >= windowStart) as number[]
      : []
    if (entries.length >= policy.rateLimitPerHour) {
      this.store.set('permissionTtlRequestLog', { ...currentLog, [op]: entries })
      return false
    }
    this.store.set('permissionTtlRequestLog', { ...currentLog, [op]: [...entries, now] })
    return true
  }

  private async createClassifiedBackup(input: {
    categories: readonly BackupCategory[]
    destPath?: string
    createdBy: BackupManifest['createdBy']
  }): Promise<BackupBundle> {
    const backupId = randomUUID()
    const createdAt = Date.now()
    const bundleId = `r8-${createdAt}-${backupId.slice(0, 8)}`
    const backupRoot = this.resolveBackupRoot(input.destPath)
    const artifactPath = join(backupRoot, `devhub-backup-${backupId}`)
    const zipPath = `${artifactPath}.zip`
    const redactedFields = new Set<string>()
    const warnings: string[] = []
    const categoryEntries: BackupManifest['categories'] = []

    await mkdir(artifactPath, { recursive: true })
    for (const category of [...new Set(input.categories)]) {
      const collected = await this.collectBackupCategory(category)
      warnings.push(...collected.warnings)
      const sanitizedPayload = redactBackupValue(collected.payload, redactedFields, category)
      const relativePath = `${category}/${BACKUP_CATEGORY_FILE_NAMES[category]}`
      const filePath = join(artifactPath, relativePath)
      const content = `${JSON.stringify(sanitizedPayload, null, 2)}\n`
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, content, 'utf8')
      categoryEntries.push({
        category,
        fileCount: collected.fileCount,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        sha256: sha256Hex(content),
        relativePath
      })
    }

    const totalSizeBytes = categoryEntries.reduce((total, entry) => total + entry.sizeBytes, 0)
    const manifest = backupManifestSchema.parse({
      backupId,
      bundleId,
      createdAt,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      categories: categoryEntries,
      totalSizeBytes,
      artifactPath,
      zipPath,
      createdBy: input.createdBy,
      redactedFields: [...redactedFields].sort((left, right) => left.localeCompare(right)),
      warnings
    })
    await writeFile(join(artifactPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    const zipBytes = await writeZipArchiveFromDirectory(artifactPath, zipPath, createdAt)

    const bundle = backupBundleSchema.parse({
      bundleId,
      backupId,
      scope: categoriesToLegacyScope(manifest.categories.map(entry => entry.category)),
      categories: manifest.categories,
      path: artifactPath,
      artifactPath,
      zipPath,
      bytes: zipBytes,
      totalSizeBytes: manifest.totalSizeBytes,
      createdAt,
      schemaVersion: manifest.schemaVersion,
      createdBy: manifest.createdBy,
      redactedFields: manifest.redactedFields,
      warnings: manifest.warnings
    })
    this.store.set('backups', [bundle, ...this.listBackups().filter(item => item.bundleId !== bundle.bundleId)].slice(0, 50))
    auditLogger.log('backup:create', {
      backupId,
      bundleId,
      categories: manifest.categories.map(entry => entry.category),
      totalSizeBytes: manifest.totalSizeBytes,
      redactedFields: manifest.redactedFields.length
    }, 'success')
    return bundle
  }

  private resolveBackupRoot(destPath?: string): string {
    if (!destPath || !destPath.trim()) return join(this.resolveUserDataPath(), 'r8-backups')
    return isAbsolute(destPath) ? destPath : resolve(this.resolveUserDataPath(), destPath)
  }

  private dataOwnershipRootDefinitions(): DataOwnershipRootDefinition[] {
    const userDataRoot = this.resolveUserDataPath()
    return [
      { rootId: 'user-data', label: 'Electron userData root', description: 'Primary local profile directory used by DevHub.', category: 'core', path: userDataRoot, sensitive: true, exportable: false },
      { rootId: 'settings-store', label: 'Settings and projects store', description: 'electron-store JSON for projects, tools, tags, groups, and settings.', category: 'settings', path: join(userDataRoot, 'devhub-config.json'), sensitive: true, exportable: true },
      { rootId: 'runtime-store', label: 'R8 runtime store', description: 'Local R8 state persisted by electron-store.', category: 'runtime', path: join(userDataRoot, 'devhub-r8-runtime.json'), sensitive: true, exportable: true },
      { rootId: 'task-queue-db', label: 'Task queue SQLite database', description: 'SQLite task queue state used by CSV and DAG execution.', category: 'tasks', path: this.taskQueueSqlitePath(), sensitive: true, exportable: true },
      { rootId: 'csv-tasks', label: 'CSV task files', description: 'Local CSV task templates, locks, and task artifacts.', category: 'tasks', path: this.csvTaskRoot(), sensitive: true, exportable: true },
      { rootId: 'last-csv-command', label: 'Last CSV command fallback', description: 'Last generated CSV launch command file.', category: 'tasks', path: join(userDataRoot, 'last-csv-command.txt'), sensitive: true, exportable: true },
      { rootId: 'skills', label: 'User skills', description: 'User-authored local SKILL.md folders.', category: 'skills', path: join(userDataRoot, 'skills'), sensitive: true, exportable: true },
      { rootId: 'r8-skills', label: 'R8 compatibility skills', description: 'Compatibility skill root loaded by the skill library.', category: 'skills', path: join(userDataRoot, 'r8-skills'), sensitive: true, exportable: true },
      { rootId: 'skill-runtime', label: 'Skill runtime artifacts', description: 'Generated builtin skill scripts and on-fail execution artifacts.', category: 'skills', path: join(userDataRoot, 'skill-runtime'), sensitive: true, exportable: false },
      { rootId: 'recordings', label: 'Task recordings', description: 'Local stdout, stdin, screenshot, fs, and git-diff recording manifests.', category: 'recording', path: join(userDataRoot, 'recordings'), sensitive: true, exportable: true },
      { rootId: 'backup-archives', label: 'Backup archives', description: 'Classified backup artifact directories and ZIP files.', category: 'backup', path: join(userDataRoot, 'r8-backups'), sensitive: true, exportable: false },
      { rootId: 'diagnostic-packs', label: 'Diagnostic packs', description: 'Redacted diagnostic pack artifact directories.', category: 'diagnostics', path: join(userDataRoot, 'diagnostic-packs'), sensitive: true, exportable: false },
      { rootId: 'observability-diagnostics', label: 'Observability diagnostics', description: 'Local observability snapshot export files.', category: 'diagnostics', path: join(userDataRoot, 'diagnostics'), sensitive: true, exportable: false },
      { rootId: 'audit-logs', label: 'Security audit logs', description: 'Structured local security audit logs.', category: 'audit', path: dirname(auditLogger.getAuditLogPath()), sensitive: true, exportable: true },
      { rootId: 'feedback', label: 'Feedback and misreport records', description: 'Local detection feedback database and fallback files.', category: 'runtime', path: join(userDataRoot, 'feedback'), sensitive: true, exportable: true },
      { rootId: 'inject-first-time-db', label: 'Inject first-time confirmations', description: 'SQLite whitelist for injection confirmations.', category: 'runtime', path: join(userDataRoot, 'inject-first-time.sqlite'), sensitive: true, exportable: true },
      { rootId: 'inject-audit-db', label: 'Inject audit database', description: 'SQLite audit rows for injection activity.', category: 'audit', path: join(userDataRoot, 'inject-audit.sqlite'), sensitive: true, exportable: true },
      { rootId: 'recovery', label: 'Recovery checkpoints', description: 'Crash recovery snapshots and dirty-state reports.', category: 'recovery', path: join(userDataRoot, 'r8-recovery'), sensitive: true, exportable: true },
      { rootId: 'restored-audit-review', label: 'Restored audit review files', description: 'Audit records produced during restore review.', category: 'recovery', path: join(userDataRoot, 'r8-restored-audit'), sensitive: true, exportable: false }
    ]
  }

  private requireDataOwnershipRoot(rootId: string): DataOwnershipRootDefinition {
    const root = this.dataOwnershipRootDefinitions().find(item => item.rootId === rootId)
    if (!root) throw new Error(`E_DATA_OWNERSHIP_UNKNOWN_ROOT:${rootId}`)
    return root
  }

  private async summarizeDataOwnershipRoot(root: DataOwnershipRootDefinition): Promise<DataOwnershipPathSummary> {
    const pathStat = await this.tryStatDataOwnershipPath(root.path)
    if (!pathStat) {
      return dataOwnershipPathSummarySchema.parse({
        ...root,
        kind: 'missing',
        exists: false,
        fileCount: 0,
        sizeBytes: 0,
        updatedAt: null,
        truncated: false
      })
    }

    if (!pathStat.isDirectory()) {
      return dataOwnershipPathSummarySchema.parse({
        ...root,
        kind: 'file',
        exists: true,
        fileCount: 1,
        sizeBytes: pathStat.size,
        updatedAt: Math.max(0, Math.floor(pathStat.mtimeMs)),
        truncated: false
      })
    }

    const summary = await this.summarizeDataOwnershipDirectory(root.path)
    return dataOwnershipPathSummarySchema.parse({
      ...root,
      kind: 'directory',
      exists: true,
      ...summary
    })
  }

  private async summarizeDataOwnershipDirectory(rootPath: string): Promise<Pick<DataOwnershipPathSummary, 'fileCount' | 'sizeBytes' | 'updatedAt' | 'truncated'>> {
    const queue = [rootPath]
    let scannedEntries = 0
    let fileCount = 0
    let sizeBytes = 0
    let updatedAt: number | null = null
    let truncated = false

    while (queue.length > 0 && !truncated) {
      const current = queue.shift()
      if (!current) break
      let dirents: Dirent[] = []
      try {
        dirents = await readdir(current, { withFileTypes: true })
      } catch {
        continue
      }
      for (const dirent of dirents) {
        scannedEntries += 1
        if (scannedEntries > DATA_OWNERSHIP_SUMMARY_FILE_LIMIT) {
          truncated = true
          break
        }
        const entryPath = join(current, dirent.name)
        const entryStat = await this.tryStatDataOwnershipPath(entryPath)
        if (!entryStat) continue
        updatedAt = Math.max(updatedAt ?? 0, Math.max(0, Math.floor(entryStat.mtimeMs)))
        if (entryStat.isDirectory()) {
          queue.push(entryPath)
        } else {
          fileCount += 1
          sizeBytes += entryStat.size
        }
      }
    }

    return { fileCount, sizeBytes, updatedAt, truncated }
  }

  private async tryStatDataOwnershipPath(path: string) {
    try {
      return await stat(path)
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(code)) return null
      throw error
    }
  }

  private syncBackupScheduleTask(schedule: BackupSchedule): void {
    this.stopBackupScheduleTask()
    if (!schedule.enabled || !this.isFeatureEnabled('R8.C.backup.restore')) return
    this.assertSupportedBackupCron(schedule.cron)
    const task = cron.createTask(schedule.cron, () => this.runScheduledBackup(schedule), {
      name: BACKUP_SCHEDULE_TASK_NAME,
      noOverlap: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
    task.start()
    this.backupScheduleTask = task
    auditLogger.log('backup:schedule-start', {
      cron: schedule.cron,
      retentionDays: schedule.retentionDays,
      categories: schedule.categoriesIncluded,
      destPath: schedule.destPath ?? null
    }, 'success')
  }

  private stopBackupScheduleTask(): void {
    const tasks = new Set<ScheduledTask>()
    if (this.backupScheduleTask) tasks.add(this.backupScheduleTask)
    for (const task of cron.getTasks().values()) {
      if (task.name === BACKUP_SCHEDULE_TASK_NAME) tasks.add(task)
    }
    this.backupScheduleTask = null
    for (const task of tasks) {
      try {
        task.destroy()
      } catch (error) {
        auditLogger.log('backup:schedule-stop', { taskName: BACKUP_SCHEDULE_TASK_NAME }, 'error', error instanceof Error ? error.message : String(error))
      }
    }
  }

  private async runScheduledBackup(schedule: BackupSchedule): Promise<void> {
    if (this.backupScheduleRunning) {
      auditLogger.log('backup:schedule-skip', { cron: schedule.cron }, 'refused', 'E_BACKUP_SCHEDULE_OVERLAP')
      return
    }
    this.backupScheduleRunning = true
    try {
      const bundle = await this.createClassifiedBackup({
        categories: schedule.categoriesIncluded,
        destPath: schedule.destPath,
        createdBy: 'schedule'
      })
      await this.pruneScheduledBackups(schedule)
      this.backupScheduleConsecutiveFailures = 0
      auditLogger.log('backup:schedule-run', {
        backupId: bundle.backupId ?? null,
        bundleId: bundle.bundleId,
        cron: schedule.cron,
        categories: schedule.categoriesIncluded
      }, 'success')
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      this.backupScheduleConsecutiveFailures += 1
      auditLogger.log('backup:schedule-run', {
        cron: schedule.cron,
        failures: this.backupScheduleConsecutiveFailures,
        categories: schedule.categoriesIncluded
      }, 'error', reason)
      if (this.backupScheduleConsecutiveFailures >= BACKUP_SCHEDULE_DISABLE_FAILURES) {
        const disabled = backupScheduleSchema.parse({ ...schedule, enabled: false })
        this.store.set('backupSchedule', disabled)
        this.stopBackupScheduleTask()
        auditLogger.log('backup:schedule-disable', {
          cron: schedule.cron,
          failures: this.backupScheduleConsecutiveFailures
        }, 'error', 'E_BACKUP_SCHEDULE_AUTO_DISABLED')
      }
    } finally {
      this.backupScheduleRunning = false
    }
  }

  private async pruneScheduledBackups(schedule: BackupSchedule): Promise<void> {
    const cutoff = Date.now() - schedule.retentionDays * 24 * 60 * 60 * 1000
    const retained: BackupBundle[] = []
    let pruned = 0
    for (const backup of this.listBackups()) {
      if (backup.createdBy === 'schedule' && backup.createdAt < cutoff) {
        const backupPath = backup.artifactPath ?? backup.path
        if (existsSync(backupPath)) {
          const backupStat = await stat(backupPath)
          if (backupStat.isDirectory()) await rm(backupPath, { recursive: true, force: true })
          else await unlink(backupPath)
        }
        if (backup.zipPath && backup.zipPath !== backupPath && existsSync(backup.zipPath)) {
          await unlink(backup.zipPath)
        }
        pruned += 1
        continue
      }
      retained.push(backup)
    }
    if (pruned > 0) {
      this.store.set('backups', retained)
      auditLogger.log('backup:schedule-retention', {
        pruned,
        retentionDays: schedule.retentionDays,
        cutoff
      }, 'success')
    }
  }

  private async collectBackupCategory(category: BackupCategory): Promise<BackupCategoryPayload> {
    if (category === 'settings') {
      return {
        category,
        fileCount: 1,
        warnings: [],
        payload: {
          exportedAt: Date.now(),
          settings: this.appStore.getSettings(),
          projects: this.appStore.getProjects(),
          featureOverrides: this.getFeatureOverrides()
        }
      }
    }

    if (category === 'csv-tasks') {
      return {
        category,
        fileCount: 1,
        warnings: [],
        payload: {
          exportedAt: Date.now(),
          tasks: this.store.get('tasks', []),
          csvSessions: this.store.get('csvSessions', []),
          csvTemplates: this.store.get('csvTemplates', []),
          csvDriverState: this.store.get('csvDriverState', {}),
          dagSnapshots: this.store.get('dagSnapshots', []),
          dagAudit: this.store.get('dagAudit', [])
        }
      }
    }

    if (category === 'skills') {
      const userSkills = await this.collectUserSkillBackups()
      const listedSkills = await this.listSkills()
      return {
        category,
        fileCount: userSkills.length,
        warnings: listedSkills.errors.map(error => `${error.errorCode}:${error.filePath}`),
        payload: {
          exportedAt: Date.now(),
          userSkills,
          userSkillCount: userSkills.length,
          loadedSkillCount: listedSkills.skills.length,
          loadErrors: listedSkills.errors
        }
      }
    }

    const auditPath = auditLogger.getAuditLogPath()
    const auditContent = existsSync(auditPath) ? await readFile(auditPath, 'utf8') : ''
    return {
      category,
      fileCount: auditContent.length > 0 ? 1 : 0,
      warnings: auditContent.length > 0 ? [] : ['audit log file does not exist or is empty'],
      payload: {
        exportedAt: Date.now(),
        fileName: basename(auditPath),
        redacted: true,
        content: auditContent
      }
    }
  }

  private async collectUserSkillBackups(): Promise<BackupUserSkillFile[]> {
    const roots = this.skillUserRoots()
    const rootNames = ['skills', 'r8-skills', 'codex-skills'] as const
    const userSkills: BackupUserSkillFile[] = []
    for (const [rootIndex, root] of roots.entries()) {
      if (!existsSync(root)) continue
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const relativeDir = safeBackupDirectoryName(entry.name)
        const skillPath = join(root, relativeDir, 'SKILL.md')
        if (!existsSync(skillPath)) continue
        userSkills.push({
          relativeDir,
          sourceRoot: rootNames[rootIndex] ?? 'skills',
          markdown: await readFile(skillPath, 'utf8')
        })
      }
    }
    return userSkills
  }

  private findBackupBundle(id: string | undefined): BackupBundle | null {
    if (!id) return null
    return this.listBackups().find(item => item.bundleId === id || item.backupId === id) ?? null
  }

  private async loadBackupManifest(backup: BackupBundle): Promise<BackupManifest> {
    const manifestPath = join(backup.artifactPath ?? backup.path, 'manifest.json')
    if (!existsSync(manifestPath)) throw new Error('E_VALIDATION:backup manifest missing')
    const rawManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (!isRecord(rawManifest)) throw new Error('E_VALIDATION:backup manifest must be an object')
    const migrated = this.backupSchemaMigration.migrateRecord('BackupManifest', rawManifest)
    if (migrated.appliedMigrations.length > 0) {
      auditLogger.log('backup:schema-migration', {
        backupId: typeof migrated.value.backupId === 'string' ? migrated.value.backupId : null,
        appliedMigrations: migrated.appliedMigrations
      }, 'success')
    }
    return backupManifestSchema.parse(migrated.value)
  }

  private async readVerifiedBackupCategory(manifest: BackupManifest, category: BackupCategory): Promise<{ payload: unknown; fileCount: number }> {
    const entry = manifest.categories.find(item => item.category === category)
    if (!entry) throw new Error(`E_NOT_FOUND:backup category ${category} not found`)
    const artifactRoot = resolve(manifest.artifactPath)
    const filePath = resolve(artifactRoot, entry.relativePath)
    const relativeToRoot = relative(artifactRoot, filePath)
    if (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) throw new Error('E_VALIDATION:backup category path escapes artifact root')
    const content = await readFile(filePath, 'utf8')
    const actualSha256 = sha256Hex(content)
    if (actualSha256 !== entry.sha256) throw new Error(`E_VALIDATION:sha256 mismatch for ${category}`)
    return { payload: JSON.parse(content), fileCount: entry.fileCount }
  }

  private async restoreBackupCategory(
    category: BackupCategory,
    payload: unknown,
    conflictPolicy: 'overwrite' | 'merge' | 'skip'
  ): Promise<number> {
    if (!isRecord(payload)) throw new Error(`E_VALIDATION:${category} payload must be an object`)
    if (category === 'settings') return this.restoreSettingsBackup(payload, conflictPolicy)
    if (category === 'csv-tasks') return this.restoreCsvTaskBackup(payload, conflictPolicy)
    if (category === 'skills') return this.restoreSkillsBackup(payload, conflictPolicy)
    return this.restoreAuditLogBackup(payload, conflictPolicy)
  }

  private restoreSettingsBackup(payload: Record<string, unknown>, conflictPolicy: 'overwrite' | 'merge' | 'skip'): number {
    if (conflictPolicy === 'skip') return 0
    if (!isRecord(payload.settings)) throw new Error('E_VALIDATION:settings payload missing')
    this.appStore.updateSettings(payload.settings as Partial<ReturnType<AppStore['getSettings']>>)
    if (isRecord(payload.featureOverrides)) {
      this.store.set('featureOverrides', conflictPolicy === 'merge'
        ? mergeStoredValue(this.store.get('featureOverrides', {}), payload.featureOverrides)
        : payload.featureOverrides)
    }
    return 1
  }

  private restoreCsvTaskBackup(payload: Record<string, unknown>, conflictPolicy: 'overwrite' | 'merge' | 'skip'): number {
    const keys = ['tasks', 'csvSessions', 'csvTemplates', 'csvDriverState', 'dagSnapshots', 'dagAudit'] as const
    let restored = 0
    for (const key of keys) {
      if (!(key in payload)) continue
      this.restoreRuntimeStoreKey(key, payload[key], conflictPolicy)
      restored += 1
    }
    return restored
  }

  private async restoreSkillsBackup(payload: Record<string, unknown>, conflictPolicy: 'overwrite' | 'merge' | 'skip'): Promise<number> {
    const userSkills = payload.userSkills
    if (!Array.isArray(userSkills)) throw new Error('E_VALIDATION:skills payload missing userSkills')
    let restored = 0
    for (const rawSkill of userSkills) {
      if (!isRecord(rawSkill) || typeof rawSkill.relativeDir !== 'string' || typeof rawSkill.markdown !== 'string') continue
      const relativeDir = safeBackupDirectoryName(rawSkill.relativeDir)
      let targetDir = join(this.userSkillRoot(), relativeDir)
      let targetPath = join(targetDir, 'SKILL.md')
      if (existsSync(targetPath) && conflictPolicy === 'skip') continue
      if (existsSync(targetPath) && conflictPolicy === 'merge') {
        targetDir = join(this.userSkillRoot(), `${relativeDir}-restored-${sha256Hex(rawSkill.markdown).slice(0, 8)}`)
        targetPath = join(targetDir, 'SKILL.md')
      }
      await mkdir(targetDir, { recursive: true })
      await writeFile(targetPath, rawSkill.markdown, 'utf8')
      restored += 1
    }
    return restored
  }

  private async restoreAuditLogBackup(payload: Record<string, unknown>, conflictPolicy: 'overwrite' | 'merge' | 'skip'): Promise<number> {
    if (conflictPolicy === 'skip') return 0
    const content = typeof payload.content === 'string' ? payload.content : ''
    if (!content) return 0
    const reviewDir = join(this.resolveUserDataPath(), 'r8-restored-audit')
    await mkdir(reviewDir, { recursive: true })
    await writeFile(join(reviewDir, `audit-log-${Date.now()}.log`), content, 'utf8')
    return 1
  }

  private restoreRuntimeStoreKey(key: keyof R8RuntimeStoreShape, incoming: unknown, conflictPolicy: 'overwrite' | 'merge' | 'skip'): void {
    const current = this.store.get(key)
    if (conflictPolicy === 'skip' && this.hasStoredRuntimeValue(current)) return
    this.store.set(key, conflictPolicy === 'merge' ? mergeStoredValue(current, incoming) : incoming)
  }

  private hasStoredRuntimeValue(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0
    if (isRecord(value)) return Object.keys(value).length > 0
    return value !== null && value !== undefined
  }

  private async restoreLegacyBackup(backup: BackupBundle, input: { bundleId: string; confirmedBy: string }) {
    const payload = JSON.parse(await readFile(backup.path, 'utf8')) as Record<string, unknown>
    const restored: string[] = []
    if (backup.scope.includes('settings') && isRecord(payload.settings)) {
      this.appStore.updateSettings(payload.settings as Partial<ReturnType<AppStore['getSettings']>>)
      restored.push('settings')
    }
    return { success: true, bundleId: input.bundleId, restored, skipped: backup.scope.filter(scope => !restored.includes(scope)), restoredAt: Date.now(), confirmedBy: input.confirmedBy }
  }

  private assertSupportedBackupCron(cron: string): void {
    const trimmed = cron.trim()
    if (!/^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) \* \* (\*|[0-6])$/.test(trimmed)) {
      throw new Error('E_VALIDATION:backup schedule supports minute hour * * day-of-week cron only')
    }
  }

  listMonitorPopouts(): MonitorPopout[] {
    const layouts = this.getMonitorPopoutLayouts()
    const toolSet = new Set<string>(MONITOR_TOOLS)
    const snapshot = this.monitorSnapshot()
    return this.listPopouts()
      .filter(popout => popout.surface === 'monitor' && typeof popout.targetId === 'string' && toolSet.has(popout.targetId) && layouts[popout.windowId])
      .map(popout => this.toMonitorPopout(popout, layouts[popout.windowId] ?? 'compact', snapshot))
  }

  returnMonitorPopoutToMain(input: { popoutId: string }) {
    const popout = this.listMonitorPopouts().find(item => item.windowId === input.popoutId)
    if (!popout) throw new Error('E_NOT_FOUND:monitor popout')
    this.closeMonitorPopout(input)
    this.focusMonitorInstance({ tool: popout.tool, instanceId: `${popout.tool}-main` })
    return { success: true, popoutId: input.popoutId, returnedAt: Date.now() }
  }

  setMonitorPopoutLayoutPreference(input: { popoutId: string; layout: MonitorPopoutLayout }) {
    const popout = this.listMonitorPopouts().find(item => item.windowId === input.popoutId)
    if (!popout) throw new Error('E_NOT_FOUND:monitor popout')
    const layout = monitorPopoutLayoutSchema.parse(input.layout)
    this.setMonitorPopoutLayout(input.popoutId, layout)
    const updated = this.listMonitorPopouts().find(item => item.windowId === input.popoutId)
    auditLogger.log('monitor:popout-layout-set', { popoutId: input.popoutId, tool: popout.tool, layout }, 'success')
    this.queueMonitorSnapshotStream()
    return { success: true, popoutId: input.popoutId, layout, popout: updated ?? popout, updatedAt: Date.now() }
  }

  private appendInjectHistory(entry: InjectHistoryEntry): void {
    this.store.set('injectHistory', [entry, ...this.listInjectHistory()].slice(0, 500))
  }

  private startInjectWhitelistCleanupJob(): void {
    this.stopInjectWhitelistCleanupJob()
    this.cleanupExpiredInjectWhitelist({ source: 'startup' })
    this.injectWhitelistCleanupTimer = setInterval(() => {
      this.cleanupExpiredInjectWhitelist({ source: 'hourly' })
    }, 60 * 60 * 1000)
    if (typeof this.injectWhitelistCleanupTimer.unref === 'function') this.injectWhitelistCleanupTimer.unref()
  }

  private stopInjectWhitelistCleanupJob(): void {
    if (!this.injectWhitelistCleanupTimer) return
    clearInterval(this.injectWhitelistCleanupTimer)
    this.injectWhitelistCleanupTimer = null
  }

  private createTaskQueueStore(): TaskQueueStore {
    const engine = this.resolveTaskQueueEngine()
    if (engine === 'p-queue') {
      this.taskQueueStorageFallbackError = null
      return this.store as unknown as TaskQueueStore
    }
    try {
      const sqliteStore = new SQLiteTaskQueueStore({ dbPath: this.taskQueueSqlitePath() })
      this.taskQueueSqliteStore = sqliteStore
      this.migrateLegacyTaskQueueState(sqliteStore)
      this.taskQueueStorageFallbackError = null
      return sqliteStore
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.taskQueueSqliteStore = null
      this.taskQueueStorageFallbackError = errorMessage
      auditLogger.log('task:queue-store-fallback', {
        engine,
        backend: 'electron-store',
        sqlitePath: this.taskQueueSqlitePath(),
        error: errorMessage
      }, 'error', 'E_SQLITE_NATIVE_UNAVAILABLE')
      console.warn('SQLite task queue store unavailable; falling back to Electron Store:', errorMessage)
      return this.store as unknown as TaskQueueStore
    }
  }

  private migrateLegacyTaskQueueState(target: TaskQueueStore): void {
    const existingTasks = target.get('tasks', [])
    const legacyTasks = this.store.get('tasks', [])
    if (Array.isArray(legacyTasks) && legacyTasks.length > 0 && (!Array.isArray(existingTasks) || existingTasks.length === 0)) {
      target.set('tasks', legacyTasks)
    }
    const existingTransitions = target.get('taskStateTransitions', [])
    const legacyTransitions = this.store.get('taskStateTransitions', [])
    if (Array.isArray(legacyTransitions) && legacyTransitions.length > 0 && (!Array.isArray(existingTransitions) || existingTransitions.length === 0)) {
      target.set('taskStateTransitions', legacyTransitions)
    }
  }

  private resolveTaskQueueEngine(): TaskQueueEngine {
    const explicit = taskQueueEngineSchema.safeParse(this.store.get('taskQueueEngine'))
    if (explicit.success) return explicit.data
    return this.isFeatureEnabled('R8.C.task.queue.engine') ? 'better-queue' : 'p-queue'
  }

  private taskQueueSqlitePath(): string {
    return join(this.resolveUserDataPath(), 'queue.sqlite')
  }

  private taskQueueStorageWarning(
    engine: TaskQueueEngine,
    backend: QueueStorageBackend,
    nativeBetterQueueAvailable: boolean,
    nativeBetterQueueSqliteAvailable: boolean,
    nativeSqlite3Available: boolean
  ): string | null {
    if (engine === 'better-queue' && backend === 'electron-store' && this.taskQueueStorageFallbackError) {
      return `SQLite task queue storage is unavailable in this Electron runtime; DevHub is using the existing Electron Store task queue boundary. Cause: ${this.taskQueueStorageFallbackError}`
    }
    if (engine === 'better-queue' && backend === 'sqlite-kv-indexed') {
      if (!nativeBetterQueueAvailable) {
        return 'better-queue package is not installed; DevHub is using the real SQLite-backed store-backed queue and is not claiming native BetterQueueAdapter completion.'
      }
      if (!nativeBetterQueueSqliteAvailable) {
        return `better-queue is installed, but better-queue-sqlite is not available in this build; sqlite3 availability=${nativeSqlite3Available}. The active runtime still uses the StoreBackedTaskQueueService over queue.sqlite, while the native BetterQueueAdapter is only available for integration tests and uses a compatible better-sqlite3-backed store.`
      }
      return 'better-queue and better-queue-sqlite are installed; the active runtime still uses the StoreBackedTaskQueueService over queue.sqlite until a dedicated promotion slice switches the runtime.'
    }
    if (engine === 'p-queue' && backend === 'sqlite-kv-indexed') {
      return 'p-queue selected; restart is required before the runtime switches away from the current SQLite-backed queue store.'
    }
    if (engine === 'p-queue') {
      return 'p-queue fallback is using the existing Electron Store task queue boundary; durable queue.sqlite storage is disabled for this engine until restart with better-queue.'
    }
    return null
  }

  private isPackageAvailable(packageName: string): boolean {
    try {
      nodeRequire.resolve(packageName)
      return true
    } catch {
      return false
    }
  }

  private getFeatureOverrides(): Partial<Record<FeatureFlagName, boolean>> {
    const raw = this.store.get('featureOverrides', {})
    const output: Partial<Record<FeatureFlagName, boolean>> = {}
    for (const [key, value] of Object.entries(raw ?? {})) {
      const parsed = featureFlagNameSchema.safeParse(key)
      if (parsed.success && typeof value === 'boolean') output[parsed.data] = value
    }
    return output
  }

  private isFeatureEnabled(flag: FeatureFlagName): boolean {
    const overrides = this.getFeatureOverrides()
    return overrides[flag] ?? resolveFeatureFlagDefault(flag)
  }

  private installPopoutSessionCsp(): void {
    if (POPOUT_CSP_INSTALLED_SESSIONS.has(this.popoutSession)) return

    this.popoutSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...(details.responseHeaders ?? {}) }
      for (const headerName of Object.keys(responseHeaders)) {
        if (headerName.toLowerCase() === 'content-security-policy') {
          delete responseHeaders[headerName]
        }
      }
      responseHeaders['Content-Security-Policy'] = [this.resolvePopoutContentSecurityPolicy()]
      callback({ responseHeaders })
    })

    POPOUT_CSP_INSTALLED_SESSIONS.add(this.popoutSession)
  }

  private resolvePopoutContentSecurityPolicy(): string {
    return process.env.ELECTRON_RENDERER_URL ? POPOUT_DEV_CSP : POPOUT_PROD_CSP
  }

  private formatPortPopoutTarget(port: number, pid: number): string {
    return `port:${port}:pid:${pid}`
  }

  private parsePortPopoutTarget(targetId: PopoutRecord['targetId']): ParsedPortPopoutTarget | null {
    if (typeof targetId === 'number' && Number.isInteger(targetId) && targetId >= 1 && targetId <= 65535) {
      return { port: targetId, pid: null }
    }

    if (typeof targetId !== 'string') return null
    const trimmedTarget = targetId.trim()
    const directPort = Number(trimmedTarget)
    if (Number.isInteger(directPort) && directPort >= 1 && directPort <= 65535) {
      return { port: directPort, pid: null }
    }

    const match = /^port:(\d{1,5})(?::pid:(\d+))?$/.exec(trimmedTarget)
    if (!match) return null
    const port = Number(match[1])
    const pid = match[2] ? Number(match[2]) : null
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null
    if (pid !== null && (!Number.isInteger(pid) || pid <= 0)) return null
    return { port, pid }
  }

  private getActivePortPopoutRecords(): Array<{ popout: PopoutRecord; target: ParsedPortPopoutTarget }> {
    return this.listPopouts().flatMap(popout => {
      if (popout.surface !== 'port' || popout.bridgeState === 'closed') return []
      const target = this.parsePortPopoutTarget(popout.targetId)
      return target ? [{ popout, target }] : []
    })
  }

  private requirePortPopoutRecord(popoutId: string): { popout: PopoutRecord; target: ParsedPortPopoutTarget } {
    const match = this.getActivePortPopoutRecords().find(record => record.popout.windowId === popoutId)
    if (!match) throw new Error('E_NOT_FOUND:port popout')
    return match
  }

  private toPortPopoutRuntimeRecord(
    popout: PopoutRecord,
    overrides: Partial<Pick<PortPopoutRuntimeRecord, 'pid' | 'trigger' | 'actualPosition' | 'size'>> & {
      position?: PortPopoutRuntimeRecord['actualPosition']
    } = {}
  ): PortPopoutRuntimeRecord {
    const target = this.parsePortPopoutTarget(popout.targetId)
    if (popout.surface !== 'port' || !target) throw new Error('E_VALIDATION:not a port popout')

    const storedPosition = this.popoutPositionStore.get(target.port)
    const actualPosition = overrides.actualPosition ?? overrides.position ?? (
      popout.bounds
        ? { x: popout.bounds.x, y: popout.bounds.y }
        : storedPosition
          ? { x: storedPosition.x, y: storedPosition.y }
          : { x: 24, y: 24 }
    )
    const size = overrides.size ?? (
      popout.bounds
        ? { width: popout.bounds.width, height: popout.bounds.height }
        : storedPosition?.w && storedPosition?.h
          ? { width: storedPosition.w, height: storedPosition.h }
          : { width: PORT_POPOUT_LIMITS.CARD_DEFAULT_W, height: PORT_POPOUT_LIMITS.CARD_DEFAULT_H }
    )
    const activePortPopouts = this.getActivePortPopoutRecords()
    const popoutIndex = Math.max(0, activePortPopouts.findIndex(record => record.popout.windowId === popout.windowId))
    const zIndex = PORT_POPOUT_LIMITS.Z_INDEX_BASE + Math.min(PORT_POPOUT_LIMITS.Z_INDEX_RANGE, popoutIndex)

    return portPopoutRuntimeRecordSchema.parse({
      popoutId: popout.windowId,
      port: target.port,
      pid: overrides.pid ?? target.pid,
      trigger: overrides.trigger ?? null,
      mode: popout.mode,
      actualPosition,
      size,
      zIndex,
      pinned: popout.pinned,
      bridgeState: popout.bridgeState,
      browserPopout: popout
    })
  }

  private createBrowserPopout(record: PopoutRecord): BrowserWindow {
    try {
      return this.createBrowserPopoutWindow(record)
    } catch (error) {
      console.error('[popout] createBrowserPopout failed', { windowId: record.windowId, surface: record.surface, targetId: record.targetId }, error)
      throw error
    }
  }

  private createBrowserPopoutWindow(record: PopoutRecord): BrowserWindow {
    const isMonitorWindow = this.isMonitorWindow(record)
    const isMonitorToolPopout = this.isMonitorToolPopout(record)
    const isPanelPopout = this.isPanelPopout(record)
    const preload = join(__dirname, isPanelPopout ? '../preload/index.cjs' : isMonitorToolPopout ? '../preload/monitor-popout.cjs' : isMonitorWindow ? '../preload/monitor.cjs' : '../preload/port-popout.cjs')
    const isMonitorSurface = record.surface === 'monitor'
    const isPortSurface = record.surface === 'port'
    const browserWindowOptions: BrowserWindowConstructorOptions = {
      width: record.bounds?.width ?? 520,
      height: record.bounds?.height ?? 640,
      minWidth: isMonitorToolPopout ? MONITOR_POPOUT_MIN_SIZE.width : undefined,
      minHeight: isMonitorToolPopout ? MONITOR_POPOUT_MIN_SIZE.height : undefined,
      x: record.bounds?.x,
      y: record.bounds?.y,
      title: record.title,
      show: false,
      backgroundColor: isMonitorSurface ? '#00000000' : '#1A1A1A',
      transparent: isMonitorSurface,
      resizable: true,
      hasShadow: true,
      ...(isMonitorSurface && process.platform === 'darwin' ? { vibrancy: 'sidebar' as const, visualEffectState: 'active' as const } : {}),
      webPreferences: {
        preload,
        session: this.popoutSession,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        ...(isPortSurface ? {
          images: false,
          spellcheck: false,
          v8CacheOptions: 'code' as const,
          webgl: false
        } : {})
      }
    }
    const window = new BrowserWindow(browserWindowOptions)
    if (record.pinned || isPanelPopout) window.setAlwaysOnTop(true)
    window.webContents.setWindowOpenHandler(details => {
      void shell.openExternal(details.url)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, url) => {
      if (process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL)) return
      if (url.startsWith('file://')) return
      event.preventDefault()
    })
    // Robust show: in some environments (a dedicated session partition under the
    // dev server, or a renderer that errors before first paint) `ready-to-show`
    // never fires, which would leave the popout window permanently hidden — the
    // "clicked detach, nothing happened" symptom. Show on EITHER `ready-to-show`
    // or `did-finish-load`, guarded so we only show once.
    let shown = false
    const showOnce = () => {
      if (shown) return
      shown = true
      if (window.isDestroyed()) return
      window.show()
      window.focus()
    }
    window.once('ready-to-show', () => showOnce())
    window.webContents.once('did-finish-load', () => showOnce())
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[popout] did-fail-load', { windowId: record.windowId, surface: record.surface, errorCode, errorDescription, validatedURL })
    })
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error('[popout] render-process-gone', { windowId: record.windowId, surface: record.surface, reason: details.reason, exitCode: details.exitCode })
    })
    return window
  }

  private async loadPopoutWindow(window: BrowserWindow, record: PopoutRecord): Promise<void> {
    const isPanelPopout = this.isPanelPopout(record)
    const query: Record<string, string> = { r8Popout: record.windowId, surface: record.surface, target: String(record.targetId) }
    if (isPanelPopout) query.r8PanelPopout = record.surface
    try {
      if (process.env.ELECTRON_RENDERER_URL) {
        const entry = isPanelPopout ? 'index.html' : this.isMonitorToolPopout(record) ? 'monitor-popout.html' : this.isMonitorWindow(record) ? 'monitor.html' : 'port-popout.html'
        const url = new URL(entry, `${process.env.ELECTRON_RENDERER_URL}/`)
        for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
        await window.loadURL(url.toString())
        return
      }
      const rendererEntry = isPanelPopout ? '../renderer/index.html' : this.isMonitorToolPopout(record) ? '../renderer/monitor-popout.html' : this.isMonitorWindow(record) ? '../renderer/monitor.html' : '../renderer/port-popout.html'
      await window.loadFile(join(__dirname, rendererEntry), { query })
    } catch (error) {
      console.error('[popout] loadPopoutWindow failed', { windowId: record.windowId, surface: record.surface, targetId: record.targetId, dev: Boolean(process.env.ELECTRON_RENDERER_URL) }, error)
      throw error
    }
  }

  private isMonitorWindow(record: PopoutRecord): boolean {
    return record.surface === 'monitor' && record.targetId === 'r8-monitor'
  }

  private isMonitorToolPopout(record: PopoutRecord): boolean {
    return record.surface === 'monitor'
      && typeof record.targetId === 'string'
      && monitorToolSchema.safeParse(record.targetId).success
  }

  private isPanelPopout(record: PopoutRecord): boolean {
    return PANEL_POPOUT_SURFACES.has(record.surface)
  }

  private updatePopoutBridgeState(windowId: string, bridgeState: PopoutRecord['bridgeState']): void {
    this.store.set('popouts', this.listPopouts().map(popout => (
      popout.windowId === windowId ? { ...popout, bridgeState } : popout
    )))
  }

  private upsertPopoutRecord(record: PopoutRecord): void {
    const popouts = this.listPopouts().filter(popout => popout.windowId !== record.windowId)
    popouts.push(browserPopoutSchema.parse(record))
    this.store.set('popouts', popouts)
  }

  private touchPopoutInteraction(windowId: string, interactedAt = Date.now()): void {
    this.store.set('popouts', this.listPopouts().map(popout => (
      popout.windowId === windowId
        ? browserPopoutSchema.parse({ ...popout, lastInteractedAt: Math.max(0, Math.round(interactedAt)) })
        : popout
    )))
  }

  private attachMainWindowClosePolicy(): void {
    if (this.mainWindowCloseDetach) return
    const mainWindow = this.getMainWindow()
    if (!mainWindow || typeof mainWindow.on !== 'function') return

    const closeHandler = () => {
      this.closeUnpinnedPopoutsForMainWindowClose()
    }
    mainWindow.on('close', closeHandler)
    this.mainWindowCloseDetach = () => {
      if (typeof mainWindow.off === 'function') {
        mainWindow.off('close', closeHandler)
        return
      }
      if (typeof mainWindow.removeListener === 'function') {
        mainWindow.removeListener('close', closeHandler)
      }
    }
  }

  private attachPopoutScreenWatcher(): void {
    if (this.screenWatcherDetach) return
    const electronScreen = screen as unknown as {
      on?: (event: PopoutScreenEvent['type'], listener: () => void) => void
      off?: (event: PopoutScreenEvent['type'], listener: () => void) => void
      removeListener?: (event: PopoutScreenEvent['type'], listener: () => void) => void
    }
    if (typeof electronScreen.on !== 'function') return

    const handlers = new Map<PopoutScreenEvent['type'], () => void>()
    const eventTypes: PopoutScreenEvent['type'][] = ['display-added', 'display-removed', 'display-metrics-changed']
    for (const eventType of eventTypes) {
      const handler = () => {
        this.reflowPopoutsForDisplayChange({ type: eventType })
      }
      handlers.set(eventType, handler)
      electronScreen.on(eventType, handler)
    }

    this.screenWatcherDetach = () => {
      for (const [eventType, handler] of handlers) {
        if (typeof electronScreen.off === 'function') {
          electronScreen.off(eventType, handler)
          continue
        }
        if (typeof electronScreen.removeListener === 'function') {
          electronScreen.removeListener(eventType, handler)
        }
      }
    }
  }

  private resolvePendingRestoreBounds(popout: PopoutRecord, displays: R8Display[]): PopoutBounds | null {
    if (!popout.pendingRestoreBounds) return null
    const restoreDisplayId = popout.pendingRestoreDisplayId
    if (restoreDisplayId !== undefined && !displays.some(display => display.id === restoreDisplayId)) return null
    return this.resolveDisplayIdForBounds(popout.pendingRestoreBounds, displays) === null
      ? null
      : popout.pendingRestoreBounds
  }

  private resolveDisplayIdForBounds(bounds: PopoutBounds, displays: R8Display[]): number | null {
    const display = displays.find(item => this.boundsCenterIsInsideDisplay(bounds, item))
    return display?.id ?? null
  }

  private boundsCenterIsInsideDisplay(bounds: PopoutBounds, display: R8Display): boolean {
    const center = {
      x: bounds.x + Math.round(bounds.width / 2),
      y: bounds.y + Math.round(bounds.height / 2)
    }
    return center.x >= display.workArea.x
      && center.x <= display.workArea.x + display.workArea.width
      && center.y >= display.workArea.y
      && center.y <= display.workArea.y + display.workArea.height
  }

  private shouldMigratePopoutToPrimary(popout: PopoutRecord, displays: ReturnType<typeof screen.getAllDisplays>): boolean {
    const bounds = popout.bounds
    if (!bounds) return true
    return !displays.some(display => this.boundsCenterIsInsideDisplay(bounds, display))
  }

  private emitPopoutScreenEvent(event: PopoutScreenEvent): void {
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    for (const popout of this.listPopouts().filter(item => item.mode === 'browserwindow' && item.bridgeState !== 'closed')) {
      const window = this.popoutWindows.get(popout.windowId)
      if (window && !window.isDestroyed()) targets.add(window)
    }
    for (const window of targets) {
      window.webContents.send('popout:screen-event', event)
    }
  }

  private getMonitorWindowState(): MonitorWindowState {
    const parsed = monitorWindowStateSchema.safeParse(this.store.get('monitorWindowPrefs', DEFAULT_MONITOR_WINDOW_STATE))
    return parsed.success ? parsed.data : DEFAULT_MONITOR_WINDOW_STATE
  }

  private normalizeMonitorBounds(value: unknown, fallback: MonitorWindowState['bounds']): MonitorWindowState['bounds'] {
    if (!value || typeof value !== 'object') return fallback
    const record = value as Record<string, unknown>
    const width = typeof record.w === 'number' ? record.w : record.width
    const height = typeof record.h === 'number' ? record.h : record.height
    return monitorWindowStateSchema.shape.bounds.parse({
      x: typeof record.x === 'number' ? record.x : fallback.x,
      y: typeof record.y === 'number' ? record.y : fallback.y,
      w: typeof width === 'number' ? width : fallback.w,
      h: typeof height === 'number' ? height : fallback.h
    })
  }

  private monitorStateToR8Bounds(state: MonitorWindowState) {
    return { x: state.bounds.x, y: state.bounds.y, width: state.bounds.w, height: state.bounds.h }
  }

  private applyMonitorWindowState(window: BrowserWindow | undefined, state: MonitorWindowState): void {
    if (!window || window.isDestroyed()) return
    window.setAlwaysOnTop(state.alwaysOnTop)
    window.setOpacity(state.opacity)
    window.setBounds(this.monitorStateToR8Bounds(state))
  }

  private findLiveBrowserPopout(predicate: (popout: PopoutRecord) => boolean): PopoutRecord | null {
    return this.listPopouts().find(popout => predicate(popout) && this.isLivePopout(popout)) ?? null
  }

  private isLivePopout(popout: PopoutRecord): boolean {
    if (popout.bridgeState === 'closed') return false
    if (popout.mode !== 'browserwindow') return true
    const window = this.popoutWindows.get(popout.windowId)
    return Boolean(window && !window.isDestroyed())
  }

  private focusPopoutWindow(windowId: string): boolean {
    const window = this.popoutWindows.get(windowId)
    if (!window || window.isDestroyed()) return false
    window.show()
    window.focus()
    return true
  }

  private buildMonitorCard(
    tool: MonitorTool,
    events: readonly CliOutputEvent[],
    sessions: readonly ReturnType<typeof parseSessionSchema.parse>[],
    titleSignals: readonly WindowTitleSignalLike[]
  ): ToolMonitorCard {
    const toolEvents = events.filter(event => event.tool === tool)
    const recentEvents = toolEvents.slice(-20)
    const latestEvent = recentEvents.at(-1) ?? null
    const toolSessions = sessions.filter(session => session.tool === tool)
    const titleSignal = titleSignals.find(signal => signal.tool === tool) ?? null
    const useTitleSignal = Boolean(titleSignal && (!latestEvent || titleSignal.ts >= latestEvent.observedAt))
    const progress = useTitleSignal && titleSignal
      ? this.progressFromTitleSignal(titleSignal)
      : this.progressFromEvent(latestEvent)
    const currentPhase = useTitleSignal && titleSignal
      ? this.monitorPhaseFromTitleSignal(titleSignal)
      : this.monitorPhaseFromEvent(latestEvent)
    const instanceIds = new Set<string>()
    for (const session of toolSessions) instanceIds.add(session.instanceId)
    for (const event of toolEvents) if (event.instanceId) instanceIds.add(event.instanceId)
    if (titleSignal?.instanceId) instanceIds.add(titleSignal.instanceId)

    return toolMonitorCardSchema.parse({
      tool,
      active: currentPhase !== 'idle' && currentPhase !== 'completed' && currentPhase !== 'error' && (toolEvents.length > 0 || toolSessions.length > 0 || Boolean(titleSignal)),
      instanceCount: instanceIds.size,
      currentPhase,
      progress,
      tokens: this.tokensFromEvents(toolEvents),
      costUsd: this.costFromEvents(toolEvents),
      lastEventAt: Math.max(latestEvent?.observedAt ?? 0, titleSignal?.ts ?? 0) || null,
      recentEvents
    })
  }

  private progressFromEvent(event: CliOutputEvent | null): ProgressDataPoint | null {
    if (!event || event.progress === null) return null
    return progressDataPointSchema.parse({
      instanceId: event.instanceId ?? `${event.tool}-default`,
      percent: event.progress,
      source: 'cli-real',
      confidence: event.confidence,
      observedAt: event.observedAt,
      message: event.line
    })
  }

  private progressFromTitleSignal(signal: WindowTitleSignalLike): ProgressDataPoint | null {
    const percent = MONITOR_PHASE_PROGRESS[signal.phase]
    if (percent === null) return null
    return progressDataPointSchema.parse({
      instanceId: signal.instanceId,
      percent,
      source: 'heuristic',
      confidence: signal.confidence,
      observedAt: signal.ts,
      message: `window-title:${signal.titleHash}`
    })
  }

  private monitorPhaseFromEvent(event: CliOutputEvent | null): ToolMonitorCard['currentPhase'] {
    if (!event) return 'idle'
    if (event.phase === 'completed') return 'completed'
    if (event.phase === 'error') return 'error'
    if (event.phase === 'thinking') return 'thinking'
    if (event.eventType === 'tool-use' || event.eventType === 'tool_invocation') return 'tool-use'
    if (event.phase === 'working' || event.phase === 'validating' || event.phase === 'waiting-input') return 'running'
    return 'idle'
  }

  private monitorPhaseFromTitleSignal(signal: WindowTitleSignalLike): ToolMonitorCard['currentPhase'] {
    if (signal.phase === 'thinking') return 'thinking'
    if (signal.phase === 'editing') return 'editing'
    if (signal.phase === 'running') return 'running'
    if (signal.phase === 'completed') return 'completed'
    if (signal.phase === 'idle') return 'idle'
    return 'idle'
  }

  private tokensFromEvents(events: readonly CliOutputEvent[]): ToolMonitorCard['tokens'] {
    let latest: ToolMonitorCard['tokens'] = null
    for (const event of events) {
      const usage = this.usageFromEvent(event)
      if (usage) latest = usage
    }
    return latest
  }

  private costFromEvents(events: readonly CliOutputEvent[]): number | null {
    let latest: number | null = null
    for (const event of events) {
      const payloadCost = event.payload?.costUsd
      if (typeof payloadCost === 'number' && payloadCost >= 0) latest = payloadCost
      const parsed = this.parseJsonLine(event.line)
      const rawCost = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).total_cost_usd : undefined
      if (typeof rawCost === 'number' && rawCost >= 0) latest = rawCost
    }
    return latest
  }

  private usageFromEvent(event: CliOutputEvent): ToolMonitorCard['tokens'] {
    const payloadInput = event.payload?.inputTokens
    const payloadOutput = event.payload?.outputTokens
    if (
      typeof payloadInput === 'number'
      && typeof payloadOutput === 'number'
      && payloadInput >= 0
      && payloadOutput >= 0
    ) {
      return { input: Math.trunc(payloadInput), output: Math.trunc(payloadOutput) }
    }

    const parsed = this.parseJsonLine(event.line)
    const usage = parsed && typeof parsed === 'object'
      ? ((parsed as Record<string, unknown>).usage ?? ((parsed as Record<string, unknown>).message as Record<string, unknown> | undefined)?.usage)
      : null
    if (usage && typeof usage === 'object') {
      const record = usage as Record<string, unknown>
      const input = typeof record.input_tokens === 'number' ? record.input_tokens : record.input
      const output = typeof record.output_tokens === 'number' ? record.output_tokens : record.output
      if (typeof input === 'number' && typeof output === 'number' && input >= 0 && output >= 0) {
        return { input: Math.trunc(input), output: Math.trunc(output) }
      }
    }
    const markerValue = event.payload?.field === 'TOKENS' ? event.payload.value : undefined
    if (typeof markerValue === 'string') {
      const input = markerValue.match(/(?:input|in)=(\d+)/i)
      const output = markerValue.match(/(?:output|out)=(\d+)/i)
      if (input && output) return { input: Number(input[1]), output: Number(output[1]) }
    }
    return null
  }

  private parseJsonLine(line: string): unknown | null {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  }

  private requestClaudeStreamJsonRestartIfNeeded(record: Record<string, unknown>, event: CliOutputEvent): void {
    if (event.tool !== 'claude') return
    if (event.eventType !== 'error') return
    if (event.payload?.subtype !== 'invalid_stream_json' && event.payload?.subtype !== 'invalid_claude_stream_schema') return
    const command = readStringValue(record.command)
    const args = this.readStringArray(record.args) ?? this.readStringArray(record.restartArgs)
    if (!command || !args || !this.claudeArgsUsePrint(args)) return
    const originalPid = readNumberValue(record.originalPid)
    try {
      this.requestClaudeStreamJsonRestart({
        instanceId: event.instanceId ?? `claude-${randomUUID()}`,
        sessionId: event.sessionId,
        detectedLine: event.line,
        command,
        args,
        cwd: readStringValue(record.cwd) ?? undefined,
        originalPid: originalPid && originalPid > 0 ? Math.trunc(originalPid) : null,
        reason: record.fallbackReason === 'schema-mismatch' ? 'schema-mismatch' : 'non-stream-json-output'
      })
    } catch (error) {
      auditLogger.log('ai:claude-stream-json-restart-detect', {
        instanceId: event.instanceId ?? null,
        sessionId: event.sessionId ?? null
      }, 'error', error instanceof Error ? error.message : String(error))
    }
  }

  private persistClaudeStreamJsonRestarts(records: readonly ClaudeStreamJsonRestartRecord[]): void {
    this.store.set('claudeStreamJsonRestarts', records.map(record => claudeStreamJsonRestartRecordSchema.parse(record)).slice(0, 100))
  }

  private updateClaudeStreamJsonRestartRecord(
    requestId: string,
    patch: Partial<ClaudeStreamJsonRestartRecord>
  ): ClaudeStreamJsonRestartRecord {
    const records = this.listClaudeStreamJsonRestarts()
    const index = records.findIndex(item => item.requestId === requestId)
    if (index === -1) throw new Error('E_NOT_FOUND:claude stream-json restart request')
    const next = claudeStreamJsonRestartRecordSchema.parse({ ...records[index], ...patch })
    records[index] = next
    this.persistClaudeStreamJsonRestarts(records)
    return next
  }

  private normalizeClaudeStreamJsonRestartCommand(request: {
    command: string
    args: string[]
    cwd?: string
    env?: Record<string, string>
    timeoutMs?: number
    originalPid?: number | null
  }): ClaudeStreamJsonRestartCommand {
    if (!this.claudeArgsUsePrint(request.args)) {
      throw new Error('E_VALIDATION:Claude stream-json restart requires -p or --print args')
    }
    return claudeStreamJsonRestartCommandSchema.parse({
      command: request.command,
      args: this.forceClaudeStreamJsonArgs(request.args),
      cwd: request.cwd,
      env: request.env,
      timeoutMs: request.timeoutMs ?? CLAUDE_STREAM_JSON_RESTART_TIMEOUT_MS,
      originalPid: request.originalPid ?? null
    })
  }

  private readStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null
    const output: string[] = []
    for (const item of value) {
      if (typeof item !== 'string') return null
      output.push(item)
    }
    return output
  }

  private claudeArgsUsePrint(args: readonly string[]): boolean {
    return args.includes('-p') || args.includes('--print')
  }

  private forceClaudeStreamJsonArgs(args: readonly string[]): string[] {
    const next: string[] = []
    let skipNext = false
    for (const arg of args) {
      if (skipNext) {
        skipNext = false
        continue
      }
      if (arg === '--output-format') {
        skipNext = true
        continue
      }
      if (arg.startsWith('--output-format=')) continue
      if (arg === '--include-partial-messages') continue
      next.push(arg)
    }
    next.push('--output-format', 'stream-json')
    next.push('--include-partial-messages')
    return next
  }

  private async spawnClaudeStreamJsonRestart(record: ClaudeStreamJsonRestartRecord): Promise<ClaudeStreamJsonRestartRecord> {
    this.terminateOriginalClaudeProcess(record)
    const child = spawn(record.restartCommand.command, record.restartCommand.args, {
      cwd: record.restartCommand.cwd,
      env: { ...process.env, ...(record.restartCommand.env ?? {}) },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: record.restartCommand.timeoutMs,
      windowsHide: true
    })
    this.claudeStreamJsonRestartChildren.set(record.requestId, child)
    child.stdin.on('error', () => undefined)
    child.stdin.end()
    child.stdout.on('data', chunk => {
      this.parseCliChunk({
        tool: 'claude',
        stream: 'stdout',
        strategy: 'ndjson',
        chunk,
        instanceId: record.instanceId,
        sessionId: record.sessionId ?? undefined
      })
    })
    child.stderr.on('data', chunk => {
      this.parseCliChunk({
        tool: 'claude',
        stream: 'stderr',
        strategy: 'ndjson',
        chunk,
        instanceId: record.instanceId,
        sessionId: record.sessionId ?? undefined
      })
    })
    child.once('exit', (exitCode, signal) => {
      this.claudeStreamJsonRestartChildren.delete(record.requestId)
      this.updateClaudeStreamJsonRestartRecord(record.requestId, {
        status: 'exited',
        endedAt: Date.now(),
        exitCode,
        signal
      })
    })
    return new Promise(resolve => {
      child.once('spawn', () => {
        const started = this.updateClaudeStreamJsonRestartRecord(record.requestId, {
          status: 'running',
          startedAt: Date.now(),
          pid: child.pid ?? null
        })
        auditLogger.log('ai:claude-stream-json-restart-spawn', {
          requestId: record.requestId,
          instanceId: record.instanceId,
          pid: child.pid ?? null
        }, 'success')
        resolve(started)
      })
      child.once('error', error => {
        this.claudeStreamJsonRestartChildren.delete(record.requestId)
        const failed = this.updateClaudeStreamJsonRestartRecord(record.requestId, {
          status: 'failed',
          endedAt: Date.now(),
          error: error.message
        })
        auditLogger.log('ai:claude-stream-json-restart-spawn', {
          requestId: record.requestId,
          instanceId: record.instanceId
        }, 'error', error.message)
        resolve(failed)
      })
    })
  }

  private terminateOriginalClaudeProcess(record: ClaudeStreamJsonRestartRecord): void {
    const originalPid = record.restartCommand.originalPid
    if (!originalPid || originalPid === process.pid) return
    try {
      process.kill(originalPid, 'SIGTERM')
      auditLogger.log('ai:claude-stream-json-restart-terminate-original', {
        requestId: record.requestId,
        originalPid
      }, 'success')
    } catch (error) {
      auditLogger.log('ai:claude-stream-json-restart-terminate-original', {
        requestId: record.requestId,
        originalPid
      }, 'error', error instanceof Error ? error.message : String(error))
    }
  }

  private emitClaudeStreamEvent(event: CliOutputEvent): void {
    if (event.tool !== 'claude' || event.rawSource !== 'ndjson') return
    const parsed = this.parseJsonLine(event.line)
    const streamEvent = claudeStreamEventSchema.safeParse(parsed)
    if (!streamEvent.success) return
    this.getMainWindow()?.webContents.send('ai:claude-stream-event', streamEvent.data)
  }

  private emitClaudeResultErrorNotification(event: CliOutputEvent): void {
    if (
      event.tool !== 'claude'
      || event.rawSource !== 'ndjson'
      || event.eventType !== 'error'
      || event.payload?.rawType !== 'result'
      || event.payload?.isError !== true
    ) {
      return
    }

    const subtype = typeof event.payload.subtype === 'string' ? event.payload.subtype : 'unknown'
    const durationMs = typeof event.payload.durationMs === 'number' && Number.isFinite(event.payload.durationMs)
      ? Math.max(0, Math.trunc(event.payload.durationMs))
      : null
    const costUsd = typeof event.payload.costUsd === 'number' && Number.isFinite(event.payload.costUsd) && event.payload.costUsd >= 0
      ? event.payload.costUsd
      : null
    const tokenSummary = this.usageFromEvent(event)
    const bodyParts = [
      `instanceId=${event.instanceId}`,
      `sessionId=${event.sessionId}`,
      `subtype=${subtype}`
    ]
    if (durationMs !== null) bodyParts.push(`durationMs=${durationMs}`)
    if (costUsd !== null) bodyParts.push(`costUsd=${costUsd}`)
    if (tokenSummary) bodyParts.push(`tokens=input:${tokenSummary.input},output:${tokenSummary.output}`)

    const aggregationKey = createHash('sha256')
      .update(`claude-result-error:${event.instanceId}:${subtype}`)
      .digest('hex')

    void this.emitNotification({
      aggregationKey,
      body: bodyParts.join('\n'),
      channels: ['toast', 'statusbar', 'os-notification'],
      instanceId: event.instanceId,
      level: 'ERROR',
      signalContributions: { 'claude-result-error': 1 },
      source: 'ai-task',
      title: `Claude stream-json error: ${subtype}`
    })
  }

  private auditGeminiLowMatchRate(events: readonly CliOutputEvent[]): void {
    const geminiEvent = events.find(event => event.tool === 'gemini')
    if (!geminiEvent) return

    const stats = this.getGeminiPatternStat({ instanceId: geminiEvent.instanceId })
    if (stats.totalLines < GEMINI_LOW_MATCH_WARN_MIN_LINES) return

    const matchRatio = 1 - stats.unmatchedRatio
    if (matchRatio >= GEMINI_LOW_MATCH_WARN_MAX_MATCH_RATIO) return

    const auditKey = `${geminiEvent.instanceId}:${stats.ruleVersion}`
    if (this.auditedGeminiLowMatchKeys.has(auditKey)) return
    this.auditedGeminiLowMatchKeys.add(auditKey)

    auditLogger.log('ai:gemini-pattern-low-match-rate', {
      appliedRules: stats.appliedRules,
      instanceId: geminiEvent.instanceId,
      lastKind: stats.lastKind,
      matchRatio: Number(matchRatio.toFixed(4)),
      partialBufferBytes: stats.partialBufferBytes,
      ruleVersion: stats.ruleVersion,
      sessionId: geminiEvent.sessionId,
      severity: 'WARN',
      threshold: GEMINI_LOW_MATCH_WARN_MAX_MATCH_RATIO,
      totalLines: stats.totalLines,
      unmatchedLines: stats.unmatchedLines,
      unmatchedRatio: Number(stats.unmatchedRatio.toFixed(4))
    }, 'success', 'E_VALIDATION:gemini-pattern-low-match-rate')
  }

  private queueMonitorSnapshotStream(): void {
    if (!this.isFeatureEnabled('R8.C.monitor.window')) return
    const now = Date.now()
    const elapsedMs = now - this.lastMonitorSnapshotStreamAt
    if (elapsedMs >= MONITOR_SNAPSHOT_STREAM_THROTTLE_MS) {
      this.emitMonitorSnapshotStream()
      return
    }
    if (this.monitorSnapshotStreamTimer) return
    this.monitorSnapshotStreamTimer = setTimeout(() => {
      this.monitorSnapshotStreamTimer = null
      this.emitMonitorSnapshotStream()
    }, MONITOR_SNAPSHOT_STREAM_THROTTLE_MS - elapsedMs)
  }

  private emitMonitorSnapshotStream(): void {
    if (!this.isFeatureEnabled('R8.C.monitor.window')) return
    const targets = this.getMonitorSnapshotStreamTargets()
    const toolSet = new Set<string>(MONITOR_TOOLS)
    const hasToolPopoutTargets = this.listPopouts().some(item => (
      item.surface === 'monitor'
      && typeof item.targetId === 'string'
      && toolSet.has(item.targetId)
      && item.bridgeState !== 'closed'
    ))
    if (targets.size === 0 && !hasToolPopoutTargets) return
    const snapshot = this.monitorSnapshot()
    this.lastMonitorSnapshotStreamAt = Date.now()
    for (const window of targets) {
      window.webContents.send('monitor:snapshot-stream', snapshot)
    }
    this.emitMonitorPopoutSnapshotStream(snapshot)
  }

  private getMonitorSnapshotStreamTargets(): Set<BrowserWindow> {
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    for (const popout of this.listPopouts().filter(item => item.surface === 'monitor' && item.targetId === 'r8-monitor')) {
      const window = this.popoutWindows.get(popout.windowId)
      if (window && !window.isDestroyed()) targets.add(window)
    }
    return targets
  }

  private emitMonitorPopoutSnapshotStream(snapshot: MonitorSnapshot): void {
    if (!this.isFeatureEnabled('R8.C.monitor.popout')) return
    const cardsByTool = new Map(snapshot.cards.map(card => [card.tool, card] as const))
    const toolSet = new Set<string>(MONITOR_TOOLS)
    for (const popout of this.listPopouts().filter(item => item.surface === 'monitor' && typeof item.targetId === 'string' && toolSet.has(item.targetId))) {
      const window = this.popoutWindows.get(popout.windowId)
      if (!window || window.isDestroyed()) continue
      const card = cardsByTool.get(monitorToolSchema.parse(popout.targetId))
      if (card) window.webContents.send('monitor:popout-snapshot-stream', card)
    }
  }

  private getMonitorPopoutLayouts(): Partial<Record<string, MonitorPopoutLayout>> {
    const raw = this.store.get('monitorPopoutLayouts', {}) ?? {}
    const output: Partial<Record<string, MonitorPopoutLayout>> = {}
    for (const [windowId, value] of Object.entries(raw)) {
      const parsed = monitorPopoutLayoutSchema.safeParse(value)
      if (parsed.success) output[windowId] = parsed.data
    }
    return output
  }

  private setMonitorPopoutLayout(windowId: string, layout: MonitorPopoutLayout): void {
    this.store.set('monitorPopoutLayouts', { ...this.getMonitorPopoutLayouts(), [windowId]: layout })
  }

  private deleteMonitorPopoutLayout(windowId: string): void {
    const layouts = this.getMonitorPopoutLayouts()
    delete layouts[windowId]
    this.store.set('monitorPopoutLayouts', layouts)
  }

  private toMonitorPopout(popout: PopoutRecord, layout: MonitorPopoutLayout, snapshot: MonitorSnapshot): MonitorPopout {
    const tool = monitorToolSchema.parse(popout.targetId)
    const card = snapshot.cards.find(item => item.tool === tool) ?? this.buildMonitorCard(tool, [], [], [])
    return monitorPopoutSchema.parse({ ...popout, popoutKind: 'monitor-tool', tool, miniLayout: layout, card })
  }

  private listCliEvents(): CliOutputEvent[] {
    return asArray(this.store.get('cliEvents', []), item => cliOutputEventSchema.parse(item))
  }

  private resolveParserStrategy(inputStrategy: unknown, chunk: string): ParserStrategy {
    if (typeof inputStrategy === 'string') return parserStrategySchema.parse(inputStrategy)
    const firstLine = chunk.split(/\r?\n/).find(line => line.trim().length > 0)?.trim() ?? ''
    if (firstLine.startsWith('data:')) return 'sse'
    if (firstLine.startsWith('{') || firstLine.startsWith('[')) return 'ndjson'
    return 'line'
  }

  private parseToolName(value: unknown): R8ToolName {
    return typeof value === 'string' && value in TOOL_DETECT_COMMANDS ? value as R8ToolName : 'codex'
  }

  private parseShimTool(value: unknown): ShimTool {
    if (value === 'codex' || value === 'claude' || value === 'gemini') return value
    throw new Error('E_VALIDATION:shim supports codex, claude, and gemini')
  }

  private resolvePackagedShimPath(tool: ShimTool): string | null {
    if (tool !== 'codex') return null
    const artifactName = `codex-shim-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`
    const packagedRelativePath = join('shims', 'codex', artifactName)
    const developmentRelativePath = join('resources', packagedRelativePath)
    const electronProcess = process as NodeJS.Process & { resourcesPath?: string }
    const electronApp = app as { getAppPath?: () => string }
    const candidates = [
      electronProcess.resourcesPath ? join(electronProcess.resourcesPath, packagedRelativePath) : null,
      electronApp.getAppPath ? join(electronApp.getAppPath(), developmentRelativePath) : null,
      join(process.cwd(), developmentRelativePath)
    ].filter((candidate): candidate is string => Boolean(candidate))

    return candidates.find(candidate => existsSync(candidate)) ?? null
  }

  private persistRecoveryReport(report: RecoveryReport): void {
    this.store.set('recoveryReports', [report, ...this.recoveryReport().filter(item => item.reportId !== report.reportId)].slice(0, 100))
  }

  private normalizeRecoveryReport(value: unknown): RecoveryReport {
    const parsed = recoveryReportSchema.safeParse(value)
    if (parsed.success) return parsed.data
    if (typeof value !== 'object' || value === null) throw parsed.error
    const record = value as Record<string, unknown>
    const scannedAt = typeof record.scannedAt === 'number' ? record.scannedAt : Date.now()
    const reportId = typeof record.reportId === 'string' ? record.reportId : `recovery-${randomUUID()}`
    const issues = Array.isArray(record.issues) ? record.issues : []
    return recoveryReportSchema.parse({
      reportId,
      scannedAt,
      startedAt: scannedAt,
      completedAt: scannedAt,
      findings: [],
      snapshotsCreated: [],
      userChoice: null,
      appliedActions: [],
      issues
    })
  }

  private getRecoveryStoreSnapshot(): Record<string, unknown> {
    return {
      tasks: this.listTasks(),
      signalStates: this.store.get('signalStates', {}),
      recoveryDismissals: this.store.get('recoveryDismissals', {})
    }
  }

  private recoverySqlitePaths(): string[] {
    const userDataRoot = this.resolveUserDataPath()
    return [
      this.taskQueueSqlitePath(),
      join(userDataRoot, 'tasks', 'tasks.db'),
      join(userDataRoot, 'feedback', 'misreports.sqlite')
    ]
  }

  private recoverableRecoveryPaths(): string[] {
    const userDataRoot = this.resolveUserDataPath()
    return [
      join(userDataRoot, 'devhub-config.json'),
      join(userDataRoot, 'devhub-r8-runtime.json'),
      auditLogger.getAuditLogPath(),
      join(userDataRoot, 'tasks'),
      join(userDataRoot, 'feedback')
    ].filter(path => existsSync(path))
  }

  private resolveAppVersion(): string | null {
    const maybeApp = app as { getVersion?: () => string }
    return typeof maybeApp.getVersion === 'function' ? maybeApp.getVersion() : null
  }

  private resolveUserDataPath(): string {
    return (app as { getPath?: (name: 'userData') => string } | undefined)?.getPath?.('userData') ?? join(process.cwd(), '.tmp', 'devhub-user-data')
  }

  private resolveWatchdogChildEntryFile(): string | null {
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    const candidates = [
      join(process.cwd(), 'out', 'main', 'watchdog-process', 'main.js'),
      resourcesPath ? join(resourcesPath, 'app.asar', 'out', 'main', 'watchdog-process', 'main.js') : null,
      resourcesPath ? join(resourcesPath, 'app', 'out', 'main', 'watchdog-process', 'main.js') : null
    ].filter((item): item is string => typeof item === 'string' && item.length > 0)
    return candidates.find(candidate => existsSync(candidate)) ?? null
  }


  private csvTaskRoot(): string {
    return join(this.resolveUserDataPath(), 'tasks')
  }

  private async skillNameSet(): Promise<Set<string>> {
    const listed = await this.listSkills()
    return new Set(listed.skills.map(skill => skill.name))
  }

  private toRuntimeCsvRow(input: unknown): RuntimeCsvTaskRow {
    const runtime = csvTaskRowSchema.safeParse(input)
    if (runtime.success) return runtime.data
    const canonical = csvTaskRow18Schema.safeParse(input)
    if (canonical.success) return this.csvTaskDriver.toRuntimeRow('adhoc', canonical.data)
    throw runtime.error
  }


  private getBooleanFeatureOverrides(): Record<string, boolean> {
    const flagOverrides: Record<string, boolean> = {}
    for (const [flag, enabled] of Object.entries(this.getFeatureOverrides())) {
      if (typeof enabled === 'boolean') flagOverrides[flag] = enabled
    }
    return flagOverrides
  }

  private getToolOverrides(): Partial<Record<R8ToolName, string>> {
    const raw = this.store.get('toolOverrides', {}) ?? {}
    const output: Partial<Record<R8ToolName, string>> = {}
    for (const [tool, path] of Object.entries(raw)) {
      if (tool in TOOL_DETECT_COMMANDS && typeof path === 'string' && path.trim()) output[tool as R8ToolName] = path
    }
    return output
  }

  private deleteToolDetectCache(tool: R8ToolName): void {
    const cache = this.store.get('toolDetectCache', {}) ?? {}
    if (!(tool in cache)) return
    const nextCache = { ...cache }
    delete nextCache[tool]
    this.store.set('toolDetectCache', nextCache)
  }

  private writeToolDetectCache(tool: R8ToolName, result: ToolDetectResult): ToolDetectResult {
    if (!result.found) {
      this.deleteToolDetectCache(tool)
      return result
    }
    const latestCache = this.store.get('toolDetectCache', {}) ?? {}
    this.store.set('toolDetectCache', { ...latestCache, [tool]: result })
    return result
  }

  private normalizeCliVersion(output: string): string | null {
    const trimmed = output.trim()
    if (!trimmed) return null
    const coerced = coerceSemver(trimmed, { includePrerelease: true })
    if (coerced) return coerced.version
    return trimmed.split(/\r?\n/).find(Boolean)?.trim() ?? null
  }

  private async resolveCliExecutable(command: string, override: boolean): Promise<{ command: string | null; errors: string[] }> {
    if (override || isAbsolute(command) || existsSync(command)) {
      return { command, errors: [] }
    }

    try {
      const resolved = await which(command, { nothrow: true })
      if (typeof resolved === 'string' && resolved.trim()) {
        return { command: resolved, errors: [] }
      }
      return { command: null, errors: [`which could not resolve ${command}`] }
    } catch (error) {
      return { command: null, errors: [error instanceof Error ? error.message : String(error)] }
    }
  }

  private async execVersionProbe(
    command: string,
    args: string[],
    checkedAt: number,
    tool: R8ToolName,
    detectStrategy: ToolDetectResult['detectStrategy']
  ): Promise<Omit<ToolDetectResult, 'recommendedParser' | 'capabilities'>> {
    const resolved = await this.resolveCliExecutable(command, detectStrategy === 'user-override')
    if (!resolved.command) {
      const message = resolved.errors[0] ?? `CLI command not found: ${command}`
      return { tool, found: false, version: null, path: null, detectStrategy: 'not-found', errors: resolved.errors, error: message, checkedAt, detectedAt: checkedAt }
    }

    try {
      const { execa } = await import('execa')
      let timedOut = false
      const subprocess = execa(resolved.command, args, {
        cleanup: true,
        reject: false,
        shell: false,
        stderr: 'pipe',
        stdout: 'pipe',
        windowsHide: true
      })
      const timeout = setTimeout(() => {
        timedOut = true
        subprocess.kill('SIGTERM')
      }, CLI_VERSION_PROBE_TIMEOUT_MS)
      timeout.unref?.()
      const probe = await subprocess.finally(() => clearTimeout(timeout))
      const output = `${probe.stdout ?? ''}${probe.stderr ? `\n${probe.stderr}` : ''}`.trim()
      if (probe.failed || timedOut) {
        const message = timedOut
          ? `CLI version probe timed out after ${CLI_VERSION_PROBE_TIMEOUT_MS}ms`
          : output || probe.shortMessage || `CLI version probe failed for ${resolved.command}`
        return { tool, found: false, version: null, path: resolved.command, detectStrategy: 'not-found', errors: [message], error: message, checkedAt, detectedAt: checkedAt }
      }
      return {
        tool,
        found: true,
        version: this.normalizeCliVersion(output),
        path: resolved.command,
        detectStrategy,
        errors: [],
        error: null,
        checkedAt,
        detectedAt: checkedAt
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (this.isExecaAbortSignalInteropError(message)) {
        return this.execFileVersionProbeFallback(resolved.command, args, checkedAt, tool, detectStrategy)
      }
      return { tool, found: false, version: null, path: resolved.command, detectStrategy: 'not-found', errors: [message], error: message, checkedAt, detectedAt: checkedAt }
    }
  }

  private isExecaAbortSignalInteropError(message: string): boolean {
    return message.includes('AbortSignal') && message.includes('EventEmitter or EventTarget')
  }

  private execFileVersionProbeFallback(
    command: string,
    args: string[],
    checkedAt: number,
    tool: R8ToolName,
    detectStrategy: ToolDetectResult['detectStrategy']
  ): Promise<Omit<ToolDetectResult, 'recommendedParser' | 'capabilities'>> {
    return new Promise(resolveProbe => {
      execFile(command, args, { timeout: CLI_VERSION_PROBE_TIMEOUT_MS, windowsHide: true, shell: false }, (error, stdout, stderr) => {
        const output = `${stdout ?? ''}${stderr ? `\n${stderr}` : ''}`.trim()
        if (error) {
          const message = output || error.message
          resolveProbe({ tool, found: false, version: null, path: command, detectStrategy: 'not-found', errors: [message], error: message, checkedAt, detectedAt: checkedAt })
          return
        }
        resolveProbe({ tool, found: true, version: this.normalizeCliVersion(output), path: command, detectStrategy, errors: [], error: null, checkedAt, detectedAt: checkedAt })
      })
    })
  }

  private detectToolFromModuleList(tool: R8ToolName): ToolDetectResult | null {
    const snapshot = this.runtime?.scannerCache?.getSnapshot() as { windows?: { data?: unknown[] }; aiTasks?: { data?: unknown[] }; processes?: { data?: unknown[] } } | undefined
    const rows = [
      ...(snapshot?.windows?.data ?? []),
      ...(snapshot?.aiTasks?.data ?? []),
      ...(snapshot?.processes?.data ?? [])
    ]
    const match = rows.find(row => this.rowLooksLikeTool(row, tool))
    if (!match) return null
    const record = match as Record<string, unknown>
    const checkedAt = Date.now()
    const recommendedParser = tool === 'cursor' || tool === 'copilot' ? 'window-title' : TOOL_DETECT_COMMANDS[tool].parser
    const capabilities = tool === 'cursor'
      ? ['window-only', 'window-title-detect']
      : tool === 'copilot'
        ? ['window-only', 'gh-copilot']
        : TOOL_DETECT_COMMANDS[tool].capabilities
    return toolDetectResultSchema.parse({
      tool,
      found: true,
      version: null,
      path: readStringValue(record.exe) ?? readStringValue(record.executablePath) ?? readStringValue(record.path) ?? readStringValue(record.processName) ?? readStringValue(record.name),
      detectStrategy: 'module-list',
      recommendedParser,
      capabilities,
      errors: [],
      error: null,
      checkedAt,
      detectedAt: checkedAt
    })
  }

  private rowLooksLikeTool(row: unknown, tool: R8ToolName): boolean {
    if (typeof row !== 'object' || row === null) return false
    const record = row as Record<string, unknown>
    const haystack = [
      readStringValue(record.tool),
      readStringValue(record.exe),
      readStringValue(record.path),
      readStringValue(record.executablePath),
      readStringValue(record.processName),
      readStringValue(record.name),
      readStringValue(record.command),
      readStringValue(record.commandLine),
      readStringValue(record.cmdline),
      readStringValue(record.title)
    ].filter(Boolean).join(' ').toLowerCase()
    if (tool === 'codex') return /\bcodex(?:\.exe|\.cmd|\.ps1)?\b/.test(haystack) || /\b@openai\/codex\b/.test(haystack)
    if (tool === 'claude') return /\bclaude(?:\.exe|\.cmd|\.ps1)?\b/.test(haystack) || /\bclaude-code\b/.test(haystack) || /\b@anthropic-ai\/claude-code\b/.test(haystack)
    if (tool === 'gemini') return /\bgemini(?:\.exe|\.cmd|\.ps1)?\b/.test(haystack) || /\b@google\/gemini-cli\b/.test(haystack)
    if (tool === 'cursor') return /\bcursor(?:\.exe)?\b/.test(haystack)
    if (tool === 'copilot') return /\bcopilot\b/.test(haystack)
    return false
  }

  private emitToolDetectionState(state: ToolDetectionState): void {
    this.getMainWindow()?.webContents.send('cli:detection-event', state)
  }

  private geminiPatternFilePath(): string {
    return join(this.resolveUserDataPath(), 'gemini-pattern.json')
  }

  private async reloadGeminiRulesFromFile(filePath: string, event: 'initial' | 'add' | 'change'): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown
      const rules = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed) && Array.isArray(parsed.rules)
          ? parsed.rules
          : null
      if (!rules) throw new Error('E_VALIDATION:gemini-pattern.json must be an array or an object with a rules array')
      const result = this.reloadGeminiRules({ rules, confirmedBy: 'gemini-pattern-watcher' })
      auditLogger.log('ai:gemini-rule-watch', {
        applied: result.applied,
        event,
        filePath,
        ruleVersion: result.ruleVersion
      }, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      auditLogger.log('ai:gemini-rule-watch', { event, filePath }, 'error', message)
    }
  }

  private async closeGeminiPatternWatcher(): Promise<void> {
    const watcher = this.geminiPatternWatcher
    this.geminiPatternWatcher = null
    this.geminiPatternWatcherPath = null
    if (!watcher) return
    try {
      await watcher.close()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      auditLogger.log('ai:gemini-rule-watch:close', {}, 'error', message)
    }
  }

  private closeCsvWatcher(): void {
    const watcher = this.csvWatcher
    this.csvWatcher = null
    this.csvWatcherRoot = null
    watcher?.close()
  }

  private startDagEditorCsvWatcher(csvPath: string, expectedMtimeMs: number | null): void {
    const resolvedCsvPath = resolve(csvPath)
    if (this.dagEditorCsvWatcher && this.sameCsvPath(this.dagEditorCsvWatchPath, resolvedCsvPath)) {
      this.dagEditorCsvWatchMtimeMs = expectedMtimeMs
      this.dagEditorLastExternalChangeKey = null
      return
    }

    this.closeDagEditorCsvWatcher()
    try {
      const watcher = new CsvFileWatcher()
      watcher.start(resolvedCsvPath, event => this.handleDagEditorCsvWatcherEvent(event))
      this.dagEditorCsvWatcher = watcher
      this.dagEditorCsvWatchPath = resolvedCsvPath
      this.dagEditorCsvWatchMtimeMs = expectedMtimeMs
      this.dagEditorLastExternalChangeKey = null
      auditLogger.log('csv:external-watch-start', { csvPath: resolvedCsvPath, expectedMtimeMs }, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      auditLogger.log('csv:external-watch-start', { csvPath: resolvedCsvPath }, 'error', message)
    }
  }

  private closeDagEditorCsvWatcher(): void {
    if (this.dagEditorCsvWatchTimer) {
      clearTimeout(this.dagEditorCsvWatchTimer)
      this.dagEditorCsvWatchTimer = null
    }
    const watcher = this.dagEditorCsvWatcher
    const csvPath = this.dagEditorCsvWatchPath
    this.dagEditorCsvWatcher = null
    this.dagEditorCsvWatchPath = null
    this.dagEditorCsvWatchMtimeMs = null
    this.dagEditorLastExternalChangeKey = null
    watcher?.close()
    if (csvPath) auditLogger.log('csv:external-watch-close', { csvPath }, 'success')
  }

  private updateDagEditorCsvWatchMtime(csvPath: string, mtimeMs: number): void {
    if (!this.sameCsvPath(this.dagEditorCsvWatchPath, csvPath)) return
    this.dagEditorCsvWatchMtimeMs = Math.trunc(mtimeMs)
    this.dagEditorLastExternalChangeKey = null
  }

  private handleDagEditorCsvWatcherEvent(event: CsvFileWatcherEvent): void {
    if (!this.sameCsvPath(this.dagEditorCsvWatchPath, event.filePath)) return
    if (this.dagEditorCsvWatchTimer) clearTimeout(this.dagEditorCsvWatchTimer)
    this.dagEditorCsvWatchTimer = setTimeout(() => {
      this.dagEditorCsvWatchTimer = null
      void this.emitDagEditorCsvExternalChange(event)
    }, 100)
  }

  private async emitDagEditorCsvExternalChange(event: CsvFileWatcherEvent): Promise<void> {
    const csvPath = this.dagEditorCsvWatchPath
    if (!csvPath) return
    const expectedMtimeMs = this.dagEditorCsvWatchMtimeMs
    let observedMtimeMs: number | null = null
    let sizeBytes: number | null = null
    let kind: CsvExternalChangeEvent['kind'] = event.kind
    if (event.kind !== 'unlink') {
      try {
        const stats = await stat(csvPath)
        observedMtimeMs = Math.trunc(stats.mtimeMs)
        sizeBytes = Math.trunc(stats.size)
      } catch {
        kind = 'unlink'
      }
    }
    if (observedMtimeMs !== null && expectedMtimeMs !== null && observedMtimeMs === expectedMtimeMs) return

    const changeKey = `${kind}:${observedMtimeMs ?? 'missing'}:${sizeBytes ?? 'missing'}`
    if (changeKey === this.dagEditorLastExternalChangeKey) return
    this.dagEditorLastExternalChangeKey = changeKey

    const payload = csvExternalChangeEventSchema.parse({
      csvPath,
      kind,
      observedAt: Date.now(),
      expectedMtimeMs,
      observedMtimeMs,
      sizeBytes
    })
    auditLogger.log('csv:external-modify', {
      csvPath,
      kind,
      expectedMtimeMs,
      observedMtimeMs,
      sizeBytes
    }, 'success')
    this.getMainWindow()?.webContents.send('csv:external-change-stream', payload)
  }

  private sameCsvPath(left: string | null | undefined, right: string | null | undefined): boolean {
    if (!left || !right) return false
    return resolve(left).toLowerCase() === resolve(right).toLowerCase()
  }

  private handleCsvWatcherEvent(event: CsvFileWatcherEvent): void {
    const target = { kind: event.kind, filePath: event.filePath, observedAt: event.observedAt }
    auditLogger.log('csv:watcher-event', target, 'success')
    void this.reloadCsvGroups({ force: true, streamSource: `watch:${event.kind}` as CsvRowStreamPayload['source'] })
      .catch(error => auditLogger.log('csv:watcher-event', target, 'error', error instanceof Error ? error.message : String(error)))
  }

  private queueCsvRowStream(source: CsvRowStreamPayload['source'], summary?: CsvReloadSummary): void {
    if (!this.isFeatureEnabled('R8.C.csv.driver')) return
    this.pendingCsvRowStreamSource = source
    if (summary) this.pendingCsvRowStreamSummary = summary
    const now = Date.now()
    const elapsedMs = now - this.lastCsvRowStreamAt
    if (elapsedMs >= 100) {
      this.emitCsvRowStream()
      return
    }
    if (this.csvRowStreamTimer) return
    this.csvRowStreamTimer = setTimeout(() => {
      this.csvRowStreamTimer = null
      this.emitCsvRowStream()
    }, 100 - elapsedMs)
  }

  private emitCsvRowStream(): void {
    const mainWindow = this.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) return
    const summary = this.pendingCsvRowStreamSummary ?? csvReloadSummarySchema.parse({
      groupCount: this.listCsvGroups().length,
      totalRows: this.listCsvGroups().reduce((sum, group) => sum + group.rowCount, 0),
      validRows: this.listCsvGroups().reduce((sum, group) => sum + group.validRowCount, 0),
      errorCount: this.listCsvGroups().reduce((sum, group) => sum + group.errors.length, 0),
      groups: this.listCsvGroups()
    })
    const nextBaseline = new Map(summary.groups.map(group => [group.groupId, `${group.fileMtime}:${group.rowCount}:${group.validRowCount}:${group.errors.length}`] as const))
    const changedGroupIds = summary.groups
      .filter(group => this.csvRowStreamBaseline?.get(group.groupId) !== nextBaseline.get(group.groupId))
      .map(group => group.groupId)
      .sort((left, right) => left.localeCompare(right))
    const removedGroupIds = this.csvRowStreamBaseline
      ? [...this.csvRowStreamBaseline.keys()].filter(groupId => !nextBaseline.has(groupId)).sort((left, right) => left.localeCompare(right))
      : []
    this.csvRowStreamBaseline = nextBaseline
    const payload = csvRowStreamPayloadSchema.parse({
      source: this.pendingCsvRowStreamSource,
      emittedAt: Date.now(),
      changedGroupIds,
      removedGroupIds,
      summary
    })
    this.lastCsvRowStreamAt = payload.emittedAt
    this.pendingCsvRowStreamSummary = null
    mainWindow.webContents.send('csv:row-stream', payload)
  }

  private queueTaskStateTransitionsSince(previous: readonly ReturnType<typeof taskStateStreamPayloadSchema.parse>['transitions'][number][]): void {
    if (!this.isFeatureEnabled('R8.C.task.queue')) return
    const previousIds = new Set(previous.map(transition => transition.transitionId))
    const transitions = this.listTaskStateTransitions()
      .filter(transition => !previousIds.has(transition.transitionId))
      .reverse()
    if (transitions.length === 0) return
    const retryingRunIds = new Set(transitions.filter(transition => transition.next === 'retrying').map(transition => transition.runId))
    for (const transition of transitions) {
      this.syncTaskRecordingForTransition(transition)
      this.auditTaskStateTransition(transition)
      this.emitTaskRetryProgressReset(transition, retryingRunIds)
    }
    this.pendingTaskStateTransitions.push(...transitions)
    const now = Date.now()
    const elapsedMs = now - this.lastTaskStateStreamAt
    if (elapsedMs >= 100) {
      this.emitTaskStateStream()
      return
    }
    if (this.taskStateStreamTimer) return
    this.taskStateStreamTimer = setTimeout(() => {
      this.taskStateStreamTimer = null
      this.emitTaskStateStream()
    }, 100 - elapsedMs)
  }

  private syncTaskRecordingForTransition(transition: TaskStateTransitionEvent): void {
    if (transition.next === 'running') {
      this.scheduleTaskRecordingStart(transition)
      return
    }
    if (transition.prev === 'running') {
      this.scheduleTaskRecordingStop(transition)
    }
  }

  private scheduleTaskRecordingStart(transition: TaskStateTransitionEvent): void {
    if (!this.isFeatureEnabled('R8.C.recording.engine')) return
    if (!transition.sessionId) return
    if (!this.isRecordingSessionUuid(transition.sessionId)) return
    const task = this.findTaskForTransition(transition)
    if (!task || task.recordingId || this.taskRecordingStartPromises.has(task.runId)) return
    const promise = this.recordingEngine.start(this.applyRecordingStreamFlags({
      sessionId: transition.sessionId,
      taskId: task.taskId ?? task.row.id,
      cwd: task.row.cwd ?? process.cwd(),
      tool: task.row.tool,
      label: `Task queue recording: ${task.taskId ?? task.row.id}`,
      source: 'csv-batch',
      confirmedBy: 'task-queue'
    }))
      .then(manifest => {
        this.taskQueue.attachRecording({ runId: task.runId, recordingId: manifest.recordingId })
        auditLogger.log('recording:task-auto-start', {
          runId: task.runId,
          taskId: task.taskId ?? task.row.id,
          taskSessionId: task.sessionId ?? null,
          recordingId: manifest.recordingId
        }, 'success')
        return manifest.recordingId
      })
      .catch(error => {
        auditLogger.log('recording:task-auto-start', {
          runId: task.runId,
          taskId: task.taskId ?? task.row.id,
          taskSessionId: task.sessionId ?? null
        }, 'error', error instanceof Error ? error.message : String(error))
        return null
      })
    this.taskRecordingStartPromises.set(task.runId, promise)
  }

  private scheduleTaskRecordingStop(transition: TaskStateTransitionEvent): void {
    if (!this.isFeatureEnabled('R8.C.recording.engine')) return
    if (!transition.sessionId || !this.isRecordingSessionUuid(transition.sessionId)) return
    const task = this.findTaskForTransition(transition)
    const pending = this.taskRecordingStartPromises.get(transition.runId)
    const recordingId = task?.recordingId ?? null
    if (!recordingId && !pending) return
    void this.stopTaskRecordingAfterStart(transition, recordingId, pending)
  }

  private async stopTaskRecordingAfterStart(
    transition: TaskStateTransitionEvent,
    currentRecordingId: string | null,
    pending: Promise<string | null> | undefined
  ): Promise<void> {
    try {
      const recordingId = currentRecordingId ?? await pending ?? null
      if (!recordingId) return
      await this.recordingEngine.stop(recordingId)
      auditLogger.log('recording:task-auto-stop', {
        runId: transition.runId,
        taskId: transition.taskId,
        taskSessionId: transition.sessionId,
        recordingId,
        prev: transition.prev,
        next: transition.next,
        reason: transition.reason
      }, transition.next === 'failed' ? 'error' : 'success', transition.reason)
    } catch (error) {
      auditLogger.log('recording:task-auto-stop', {
        runId: transition.runId,
        taskId: transition.taskId,
        taskSessionId: transition.sessionId
      }, 'error', error instanceof Error ? error.message : String(error))
    } finally {
      this.taskRecordingStartPromises.delete(transition.runId)
    }
  }

  private findTaskForTransition(transition: TaskStateTransitionEvent): TaskRun | null {
    const tasks = transition.sessionId ? this.listTasks({ sessionId: transition.sessionId }) : this.listTasks()
    return tasks.find(task => task.runId === transition.runId) ?? null
  }

  private isRecordingSessionUuid(sessionId: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
  }

  private emitTaskStateStream(): void {
    if (this.pendingTaskStateTransitions.length === 0) return
    const payload = taskStateStreamPayloadSchema.parse({
      emittedAt: Date.now(),
      transitions: this.pendingTaskStateTransitions.splice(0, 100)
    })
    this.lastTaskStateStreamAt = payload.emittedAt
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    if (typeof BrowserWindow.getAllWindows === 'function') {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) targets.add(window)
      }
    }
    for (const window of targets) {
      window.webContents.send('task:state-stream', payload)
    }
    if (this.pendingTaskStateTransitions.length > 0 && !this.taskStateStreamTimer) {
      this.taskStateStreamTimer = setTimeout(() => {
        this.taskStateStreamTimer = null
        this.emitTaskStateStream()
      }, 100)
    }
  }

  private auditTaskStateTransition(transition: ReturnType<typeof taskStateStreamPayloadSchema.parse>['transitions'][number]): void {
    const target = {
      transitionId: transition.transitionId,
      runId: transition.runId,
      taskId: transition.taskId,
      sessionId: transition.sessionId,
      prev: transition.prev,
      next: transition.next,
      reason: transition.reason,
      at: transition.at
    }
    const result = transition.next === 'failed' ? 'error' : 'success'
    auditLogger.log(this.taskAuditAction(transition), target, result, transition.reason)
  }

  private emitTaskRetryProgressReset(
    transition: ReturnType<typeof taskStateStreamPayloadSchema.parse>['transitions'][number],
    retryingRunIds: ReadonlySet<string>
  ): void {
    if (!transition.sessionId || !this.canEmitCsvSessionEventFor(transition.sessionId)) return
    const shouldReset = transition.next === 'retrying' ||
      transition.reason === 'on-fail-execute-skill-success' ||
      (transition.prev === 'retrying' && transition.next === 'queued' && !retryingRunIds.has(transition.runId))
    if (!shouldReset) return
    const task = this.listTasks({ sessionId: transition.sessionId }).find(item => item.runId === transition.runId)
    this.emitCsvSessionEvent(transition.sessionId, 'task-progress', {
      taskId: transition.taskId,
      runId: transition.runId,
      tool: task?.row.tool ?? 'codex',
      percent: 0,
      reason: 'task-retry',
      prev: transition.prev,
      next: transition.next,
      transitionId: transition.transitionId,
      attemptCount: task?.attemptCount ?? null
    })
  }

  private canEmitCsvSessionEventFor(sessionId: string): boolean {
    return csvSessionEventSchema.safeParse({
      sessionId,
      type: 'task-progress',
      emittedAt: 0,
      data: null
    }).success
  }

  private taskAuditAction(transition: ReturnType<typeof taskStateStreamPayloadSchema.parse>['transitions'][number]): string {
    if (transition.reason === 'on-fail-fallback-tool') return 'task:tool-switch'
    if (transition.reason.startsWith('on-fail-')) return 'task:on-fail'
    if (transition.next === 'running') return 'task:start'
    if (transition.prev === 'running' && ['succeeded', 'failed', 'skipped', 'cancelled'].includes(transition.next)) return 'task:end'
    if (transition.prev === 'running' && transition.next === 'retrying') return 'task:retry-scheduled'
    if (transition.prev === 'failed' && transition.next === 'retrying') return 'task:retry'
    if (transition.prev === 'retrying' && transition.next === 'queued') return 'task:retry-ready'
    if (transition.next === 'skipped') return 'task:skip'
    if (transition.next === 'paused') return 'task:pause'
    if (transition.prev === 'paused' && transition.next === 'queued') return 'task:resume'
    if (transition.next === 'cancelled') return 'task:cancel'
    if (transition.prev === 'waiting-dependency' && transition.next === 'queued') return 'task:dependency-satisfied'
    return 'task:state-transition'
  }

  private queueWatchdogEventsSince(previous: readonly WatchdogEvent[]): void {
    if (!this.isFeatureEnabled('R8.C.watchdog')) return
    const previousIds = new Set(previous.map(event => event.eventId))
    const events = this.getWatchdogHistory()
      .filter(event => !previousIds.has(event.eventId))
      .reverse()
    if (events.length === 0) return

    this.executeWatchdogActions(events)
    this.pendingWatchdogEvents.push(...events)
    const now = Date.now()
    const elapsedMs = now - this.lastWatchdogEventStreamAt
    if (elapsedMs >= 2000) {
      this.emitWatchdogEventStream()
      return
    }
    if (this.watchdogEventStreamTimer) return
    this.watchdogEventStreamTimer = setTimeout(() => {
      this.watchdogEventStreamTimer = null
      this.emitWatchdogEventStream()
    }, 2000 - elapsedMs)
  }

  private emitWatchdogEventStream(): void {
    if (this.pendingWatchdogEvents.length === 0) return
    const payload = watchdogEventStreamPayloadSchema.parse({
      emittedAt: Date.now(),
      events: this.pendingWatchdogEvents.splice(0, 100)
    })
    this.lastWatchdogEventStreamAt = payload.emittedAt
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    if (typeof BrowserWindow.getAllWindows === 'function') {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) targets.add(window)
      }
    }
    for (const window of targets) {
      window.webContents.send('watchdog:event-stream', payload)
    }
    if (this.pendingWatchdogEvents.length > 0 && !this.watchdogEventStreamTimer) {
      this.watchdogEventStreamTimer = setTimeout(() => {
        this.watchdogEventStreamTimer = null
        this.emitWatchdogEventStream()
    }, 2000)
    }
  }

  private executeWatchdogActions(events: readonly WatchdogEvent[]): void {
    if (!this.isFeatureEnabled('R8.C.watchdog.engine')) return
    const actionEvents = events.filter(event => event.type === 'action-taken' && !this.executedWatchdogActionEventIds.has(event.eventId))
    if (actionEvents.length === 0) return
    const executor = this.getWatchdogActionExecutor()
    const instances = this.getWatchdogStatus().monitoredInstances
    for (const event of actionEvents) {
      this.executedWatchdogActionEventIds.add(event.eventId)
      void executor.execute(event, instances)
        .then(result => this.recordWatchdogActionResult(result))
        .catch(error => {
          auditLogger.log('watchdog:action-executor-error', {
            eventId: event.eventId,
            instanceId: event.instanceId ?? null
          }, 'error', error instanceof Error ? error.message : String(error))
        })
    }
  }

  private getWatchdogActionExecutor(): WatchdogActionExecutor {
    if (!this.watchdogActionExecutor) {
      this.watchdogActionExecutor = new WatchdogActionExecutor({
        listTasks: () => this.listTasks(),
        completeTaskRun: input => this.completeTaskRun(input),
        markTaskAwaitingHuman: input => this.markTaskAwaitingHuman(input),
        executeInject: input => this.executeInject(input),
        emitNotification: input => this.emitNotification(input)
      })
    }
    return this.watchdogActionExecutor
  }

  private recordWatchdogActionResult(result: WatchdogActionExecutionResult): void {
    const current = this.listWatchdogActionResults()
    this.store.set('watchdogActionResults', [result, ...current.filter(item => item.eventId !== result.eventId)].slice(0, 1000))
    auditLogger.log('watchdog:action-executed', {
      eventId: result.eventId,
      instanceId: result.instanceId,
      action: result.action,
      status: result.status,
      taskRunId: result.taskRunId,
      taskStatus: result.taskStatus,
      injectActionId: result.injectActionId,
      notificationId: result.notificationId
    }, result.status === 'failed' ? 'error' : 'success', result.errors[0])
  }

  private parseWatchdogActionResult(input: unknown): WatchdogActionExecutionResult {
    const record = this.asRecord(input)
    const action = String(record.action ?? 'log-only')
    const status = String(record.status ?? 'skipped')
    const taskStatus = typeof record.taskStatus === 'string' ? record.taskStatus : null
    return {
      eventId: String(record.eventId ?? ''),
      instanceId: String(record.instanceId ?? ''),
      action: action === 'restart' || action === 'fallback-tool' || action === 'escalate-model' || action === 'human-intervention' || action === 'log-only' ? action : 'log-only',
      status: status === 'completed' || status === 'partial' || status === 'skipped' || status === 'failed' ? status : 'skipped',
      taskRunId: typeof record.taskRunId === 'string' ? record.taskRunId : null,
      taskStatus: taskStatus === 'pending' || taskStatus === 'queued' || taskStatus === 'running' || taskStatus === 'succeeded' || taskStatus === 'failed' || taskStatus === 'skipped' || taskStatus === 'paused' || taskStatus === 'waiting-dependency' || taskStatus === 'cancelled' || taskStatus === 'awaiting-human' || taskStatus === 'retrying' ? taskStatus : null,
      injectActionId: typeof record.injectActionId === 'string' ? record.injectActionId : null,
      notificationId: typeof record.notificationId === 'string' ? record.notificationId : null,
      steps: Array.isArray(record.steps) ? record.steps.filter((step): step is WatchdogActionExecutionResult['steps'][number] => typeof step === 'object' && step !== null) : [],
      errors: Array.isArray(record.errors) ? record.errors.map(String) : [],
      executedAt: typeof record.executedAt === 'number' ? record.executedAt : 0
    }
  }

  async startSkillWatcher(input: { force?: boolean } = {}): Promise<{ success: boolean; watchedRoots: string[]; error: string | null }> {
    if (!this.isFeatureEnabled('R8.C.skill.library')) {
      return { success: false, watchedRoots: [], error: 'E_FEATURE_DISABLED' }
    }

    const root = this.userSkillRoot()
    if (this.skillWatcher && this.skillWatcherRoot === root && !input.force) {
      return { success: true, watchedRoots: [root], error: null }
    }

    if (this.skillWatcher) await this.closeSkillWatcher()

    try {
      await mkdir(root, { recursive: true })
      const chokidar = await import('chokidar')
      const watcher = chokidar.watch(root, {
        persistent: false,
        ignoreInitial: true,
        depth: SKILL_WATCH_DEPTH,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100
        },
        atomic: true,
        usePolling: false,
        ignorePermissionErrors: true
      })
      watcher.on('add', filePath => this.handleSkillWatcherEvent('add', filePath))
      watcher.on('change', filePath => this.handleSkillWatcherEvent('change', filePath))
      watcher.on('unlink', filePath => this.handleSkillWatcherEvent('unlink', filePath))
      watcher.on('error', error => {
        const message = error instanceof Error ? error.message : String(error)
        auditLogger.log('skill:watcher-error', { root }, 'error', message)
      })
      this.skillWatcher = watcher
      this.skillWatcherRoot = root
      await new Promise<void>(resolveWatcher => {
        let settled = false
        const settle = () => {
          if (settled) return
          settled = true
          resolveWatcher()
        }
        watcher.once('ready', settle)
        watcher.once('error', settle)
        setTimeout(settle, 500)
      })
      auditLogger.log('skill:watcher-start', { root, depth: SKILL_WATCH_DEPTH, polling: false }, 'success')
      return { success: true, watchedRoots: [root], error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      auditLogger.log('skill:watcher-start', { root }, 'error', message)
      return { success: false, watchedRoots: [], error: message }
    }
  }

  private async closeSkillWatcher(): Promise<void> {
    const watcher = this.skillWatcher
    this.skillWatcher = null
    this.skillWatcherRoot = null
    if (!watcher) return
    try {
      await watcher.close()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      auditLogger.log('skill:watcher-close', {}, 'error', message)
    }
  }

  private handleSkillWatcherEvent(event: 'add' | 'change' | 'unlink', filePath: string): void {
    if (basename(filePath) !== 'SKILL.md') return
    auditLogger.log('skill:watcher-event', { event, filePath }, 'success')
    this.queueSkillListStream(event)
  }

  private queueSkillListStream(source: SkillListStreamPayload['source']): void {
    if (!this.isFeatureEnabled('R8.C.skill.library')) return
    this.skillListStreamSource = source
    const now = Date.now()
    const elapsedMs = now - this.lastSkillListStreamAt
    if (elapsedMs >= SKILL_LIST_STREAM_THROTTLE_MS) {
      void this.emitSkillListStream()
      return
    }
    if (this.skillListStreamTimer) return
    this.skillListStreamTimer = setTimeout(() => {
      this.skillListStreamTimer = null
      void this.emitSkillListStream()
    }, SKILL_LIST_STREAM_THROTTLE_MS - elapsedMs)
  }

  private async emitSkillListStream(): Promise<void> {
    const targets = this.getSkillListStreamTargets()
    if (targets.size === 0) return
    const result = await this.listSkills()
    const payload = this.buildSkillListStreamPayload(result, this.skillListStreamSource)
    this.lastSkillListStreamAt = payload.emittedAt
    for (const window of targets) {
      window.webContents.send('skill:list-stream', payload)
    }
  }

  private getSkillListStreamTargets(): Set<BrowserWindow> {
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    for (const window of this.popoutWindows.values()) {
      if (!window.isDestroyed()) targets.add(window)
    }
    return targets
  }

  private buildSkillListStreamPayload(result: { skills: Skill[]; errors: SkillLoadError[] }, source: SkillListStreamPayload['source']): SkillListStreamPayload {
    const nextBaseline = new Map(result.skills.map(skill => [skill.name, this.skillStreamFingerprint(skill)] as const))
    const previousBaseline = this.skillListStreamBaseline
    const added: Skill[] = []
    const updated: Skill[] = []

    for (const skill of result.skills) {
      const previous = previousBaseline?.get(skill.name)
      if (previous === undefined) {
        added.push(skill)
      } else if (previous !== nextBaseline.get(skill.name)) {
        updated.push(skill)
      }
    }

    const removed = previousBaseline
      ? [...previousBaseline.keys()].filter(name => !nextBaseline.has(name)).sort((left, right) => left.localeCompare(right))
      : []

    this.skillListStreamBaseline = nextBaseline
    return skillListStreamPayloadSchema.parse({
      added,
      updated,
      removed,
      skills: result.skills,
      errors: result.errors,
      source,
      emittedAt: Date.now()
    })
  }

  private skillStreamFingerprint(skill: Skill): string {
    const stableSkill = { ...skill, loadedAt: 0 }
    return stableStringify(stableSkill)
  }

  private auditUserSkillOverride(skill: Skill): void {
    const key = `${skill.name}:${skill.filePath}`
    if (this.auditedSkillOverrideKeys.has(key)) return
    this.auditedSkillOverrideKeys.add(key)
    auditLogger.log('skill:user-override-builtin', { name: skill.name, filePath: skill.filePath }, 'success', 'user override builtin')
  }

  private async runOnFailSkill(task: TaskRun, failure: { exitCode: number; errorCode?: string | null; errorMessage?: string | null }): Promise<OnFailSkillExecutionResult> {
    const skillName = task.row.execute_skill ?? ''
    const artifactPath = this.onFailSkillArtifactPath(task)
    await mkdir(artifactPath, { recursive: true })
    const contextPath = join(artifactPath, 'failure-context.json')
    await writeFile(contextPath, JSON.stringify(this.buildOnFailSkillContext(task, failure), null, 2), 'utf8')

    try {
      const target = await this.resolveOnFailSkillExecutionTarget(skillName)
      const command = await this.resolveSkillExecutionCommand(target.skill, target.scriptPath, contextPath)
      const processResult = await this.execSkillCommand(command, target.skillDirectory, this.onFailSkillTimeoutMs(task))
      const stdoutPath = join(artifactPath, 'stdout.txt')
      const stderrPath = join(artifactPath, 'stderr.txt')
      await writeFile(stdoutPath, processResult.stdout, 'utf8')
      await writeFile(stderrPath, processResult.stderr, 'utf8')
      const success = processResult.exitCode === 0 && !processResult.timedOut
      const errorCode = success ? 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED' : processResult.timedOut ? 'E_SKILL_TIMEOUT' : 'E_SKILL_EXECUTION_FAILED'
      const errorMessage = success
        ? `on_fail skill ${skillName} executed successfully; task queued for retry`
        : `on_fail skill ${skillName} failed with exitCode=${processResult.exitCode}${processResult.timedOut ? ' after timeout' : ''}`
      await writeFile(join(artifactPath, 'result.json'), JSON.stringify({
        skillName,
        runtime: target.skill.runtime,
        command: basename(command.command),
        args: command.args.map(arg => arg === contextPath ? 'failure-context.json' : basename(arg)),
        exitCode: processResult.exitCode,
        timedOut: processResult.timedOut,
        success,
        stdoutPath,
        stderrPath
      }, null, 2), 'utf8')
      return { success, skillName, artifactPath, exitCode: processResult.exitCode, errorCode, errorMessage }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await writeFile(join(artifactPath, 'result.json'), JSON.stringify({
        skillName,
        success: false,
        errorCode: this.onFailSkillErrorCode(message),
        message
      }, null, 2), 'utf8')
      return {
        success: false,
        skillName,
        artifactPath,
        exitCode: null,
        errorCode: this.onFailSkillErrorCode(message),
        errorMessage: message
      }
    }
  }

  private buildOnFailSkillContext(task: TaskRun, failure: { exitCode: number; errorCode?: string | null; errorMessage?: string | null }) {
    return {
      schemaVersion: '1.0',
      kind: 'devhub.on_fail.execute_skill',
      generatedAt: Date.now(),
      task: {
        runId: task.runId,
        taskId: task.taskId ?? task.row.id,
        sessionId: task.sessionId ?? null,
        status: task.status,
        attemptCount: task.attemptCount,
        maxRetry: task.maxRetry,
        queuedAt: task.queuedAt,
        startedAt: task.startedAt,
        endedAt: task.endedAt,
        rowHash: task.rowHash ?? null,
        row: task.row
      },
      failure: {
        exitCode: failure.exitCode,
        errorCode: failure.errorCode ?? 'E_RUNTIME',
        errorMessage: failure.errorMessage ?? 'task failed'
      }
    }
  }

  private async resolveOnFailSkillExecutionTarget(skillName: string): Promise<SkillExecutionTarget> {
    const listed = await this.listSkills()
    const skill = listed.skills.find(item => item.name === skillName)
    if (!skill) throw new Error(`E_SKILL_NOT_FOUND:on_fail skill not found: ${skillName}`)
    if (skill.source === 'builtin') {
      const builtin = BUILTIN_SKILLS.find(item => item.name === skill.name)
      if (!builtin) throw new Error(`E_SKILL_NOT_FOUND:builtin skill not found: ${skill.name}`)
      const skillDirectory = join(this.resolveUserDataPath(), 'skill-runtime', 'builtin', skill.name)
      await mkdir(skillDirectory, { recursive: true })
      await writeFile(join(skillDirectory, 'SKILL.md'), builtin.markdown, 'utf8')
      await writeFile(join(skillDirectory, 'run.js'), builtin.scriptContent, 'utf8')
      return { skill, skillDirectory, scriptPath: this.assertSkillScriptPath(skillDirectory, skill.scriptPath) }
    }
    const skillDirectory = dirname(skill.filePath)
    return { skill, skillDirectory, scriptPath: this.assertSkillScriptPath(skillDirectory, skill.scriptPath) }
  }

  private async resolveSkillExecutionCommand(skill: Skill, scriptPath: string, contextPath: string): Promise<SkillExecutionCommand> {
    this.assertSkillSandboxPolicy(skill)
    const env = this.skillExecutionEnv(skill)
    if (skill.runtime === 'node') {
      const preloadPath = await this.ensureSkillSandboxPreload()
      return { command: process.execPath, args: ['--require', preloadPath, scriptPath, contextPath], env }
    }
    if (skill.sandbox !== 'system') {
      throw new Error(`E_PERMISSION:${skill.runtime} skill execution requires system sandbox because DevHub can only enforce read-only/read-write sandboxing for node skills`)
    }
    if (skill.runtime === 'python') {
      const python = await this.probePythonExecutable()
      if (!python) throw new Error('E_DEPENDENCY_MISSING:python executable was not found')
      return { command: python.command, args: [...python.prefixArgs, scriptPath, contextPath], env }
    }
    if (skill.runtime === 'bash') return { command: 'bash', args: [scriptPath, contextPath], env }
    if (skill.runtime === 'powershell') return { command: 'powershell', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, contextPath], env }
    return { command: scriptPath, args: [contextPath], env }
  }

  private execSkillCommand(command: SkillExecutionCommand, cwd: string, timeoutMs: number): Promise<SkillProcessResult> {
    return new Promise(resolveRun => {
      execFile(command.command, command.args, {
        cwd,
        env: command.env,
        timeout: timeoutMs,
        windowsHide: true,
        shell: false,
        maxBuffer: ON_FAIL_SKILL_MAX_BUFFER_BYTES
      }, (error, stdout, stderr) => {
        const failure = error as ExecFileErrorLike | null
        const exitCode = this.skillExitCode(failure)
        resolveRun({
          exitCode,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
          timedOut: Boolean(failure?.killed && failure.signal === 'SIGTERM')
        })
      })
    })
  }

  private skillExecutionEnv(skill: Skill): NodeJS.ProcessEnv {
    const allowedKeys = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'] as const
    const env: NodeJS.ProcessEnv = {}
    for (const key of allowedKeys) {
      const value = process.env[key]
      if (typeof value === 'string') env[key] = value
    }
    env.DEVHUB_SKILL_EXECUTION = 'on_fail'
    env.DEVHUB_SKILL_NAME = skill.name
    env.DEVHUB_SKILL_SANDBOX = skill.sandbox
    env.DEVHUB_SKILL_PERMISSIONS = skill.permissions.join(',')
    env.DEVHUB_MCP_COMPATIBLE = skill.sandbox === 'system' || skill.permissions.includes('exec') ? '1' : '0'
    env.DEVHUB_SKILL_MCP_SERVERS_JSON = JSON.stringify(skill.mcpServers)
    return env
  }

  private assertSkillSandboxPolicy(skill: Skill): void {
    if (skill.mcpServers.length > 0 && skill.sandbox !== 'system') {
      throw new Error('E_PERMISSION:mcpServers require system sandbox')
    }
    if (skill.sandbox === 'read-only') {
      const disallowed = skill.permissions.filter(permission => !SKILL_READ_ONLY_PERMISSIONS.has(permission))
      if (disallowed.length > 0) throw new Error(`E_PERMISSION:read-only skill cannot request ${disallowed.join(', ')}`)
      return
    }
    if (skill.sandbox === 'read-write') {
      const disallowed = skill.permissions.filter(permission => !SKILL_READ_WRITE_PERMISSIONS.has(permission))
      if (disallowed.length > 0) throw new Error(`E_PERMISSION:read-write skill cannot request ${disallowed.join(', ')}`)
    }
  }

  private async ensureSkillSandboxPreload(): Promise<string> {
    const runtimeDirectory = join(this.resolveUserDataPath(), 'skill-runtime')
    await mkdir(runtimeDirectory, { recursive: true })
    const preloadPath = join(runtimeDirectory, 'sandbox-preload.js')
    await writeFile(preloadPath, this.nodeSkillSandboxPreloadSource(), 'utf8')
    return preloadPath
  }

  private nodeSkillSandboxPreloadSource(): string {
    return [
      "'use strict'",
      "const Module = require('node:module')",
      "const sandbox = process.env.DEVHUB_SKILL_SANDBOX || 'read-only'",
      "const permissions = new Set(String(process.env.DEVHUB_SKILL_PERMISSIONS || '').split(',').filter(Boolean))",
      "function deny(capability) {",
      "  const error = new Error(`E_PERMISSION:${sandbox} skill cannot use ${capability}`)",
      "  error.code = 'E_PERMISSION'",
      '  throw error',
      '}',
      "function wrapModule(request, value) {",
      "  if ((request === 'fs' || request === 'node:fs') && !permissions.has('fs-write') && sandbox !== 'system') {",
      "    for (const method of ['appendFile', 'appendFileSync', 'chmod', 'chmodSync', 'chown', 'chownSync', 'copyFile', 'copyFileSync', 'cp', 'cpSync', 'createWriteStream', 'link', 'linkSync', 'mkdir', 'mkdirSync', 'mkdtemp', 'mkdtempSync', 'open', 'openSync', 'rename', 'renameSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync', 'symlink', 'symlinkSync', 'truncate', 'truncateSync', 'unlink', 'unlinkSync', 'utimes', 'utimesSync', 'write', 'writeFile', 'writeFileSync', 'writeSync']) {",
      "      if (typeof value[method] === 'function') value[method] = () => deny(`fs.${method}`)",
      '    }',
      '  }',
      "  if ((request === 'child_process' || request === 'node:child_process') && !permissions.has('exec') && sandbox !== 'system') {",
      "    for (const method of ['exec', 'execFile', 'execFileSync', 'execSync', 'fork', 'spawn', 'spawnSync']) {",
      "      if (typeof value[method] === 'function') value[method] = () => deny(`child_process.${method}`)",
      '    }',
      '  }',
      "  if (['http', 'node:http', 'https', 'node:https', 'net', 'node:net', 'tls', 'node:tls', 'dgram', 'node:dgram'].includes(request) && !permissions.has('net') && sandbox !== 'system') {",
      '    return new Proxy(value, { get() { deny(request); } })',
      '  }',
      '  return value',
      '}',
      'const originalLoad = Module._load',
      'Module._load = function patchedSkillSandboxLoad(request, parent, isMain) {',
      '  return wrapModule(request, originalLoad.apply(this, arguments))',
      '}',
      ''
    ].join('\n')
  }

  private skillExitCode(error: ExecFileErrorLike | null): number {
    if (!error) return 0
    if (typeof error.code === 'number') return error.code
    if (error.killed) return 124
    return 1
  }

  private onFailSkillArtifactPath(task: TaskRun): string {
    const taskId = this.safeArtifactSegment(task.taskId ?? task.row.id)
    const runId = this.safeArtifactSegment(task.runId)
    return join(this.resolveUserDataPath(), 'task-queue', 'on-fail-skills', taskId, `${Date.now()}-${runId}`)
  }

  private safeArtifactSegment(value: string): string {
    const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96)
    return sanitized.length > 0 ? sanitized : 'task'
  }

  private serializeTaskResultsCsv(tasks: readonly TaskRun[]): string {
    const columns = [
      'runId',
      'taskId',
      'sessionId',
      'status',
      'attempts',
      'attemptCount',
      'maxRetry',
      'queuedAt',
      'startedAt',
      'endedAt',
      'exitCode',
      'errorCode',
      'errorMessage',
      'artifactsPath',
      'injectActionId',
      'recordingId',
      'tool',
      'prompt',
      'group',
      'output_path',
      'rowHash'
    ] as const
    const rows = tasks.map(task => ({
      runId: task.runId,
      taskId: task.taskId ?? task.row.id,
      sessionId: task.sessionId ?? null,
      status: task.status,
      attempts: task.attempts,
      attemptCount: task.attemptCount,
      maxRetry: task.maxRetry,
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      endedAt: task.endedAt,
      exitCode: task.exitCode,
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
      artifactsPath: task.artifactsPath,
      injectActionId: task.injectActionId,
      recordingId: task.recordingId,
      tool: task.row.tool,
      prompt: task.row.prompt,
      group: task.row.group ?? null,
      output_path: task.row.output_path ?? null,
      rowHash: task.rowHash ?? null
    }))
    return [
      columns.join(','),
      ...rows.map(row => columns.map(column => this.csvCell(row[column])).join(','))
    ].join('\n') + '\n'
  }

  private csvCell(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) return ''
    const text = String(value)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  private onFailSkillTimeoutMs(task: TaskRun): number {
    const requested = task.row.timeout_ms ?? ON_FAIL_SKILL_DEFAULT_TIMEOUT_MS
    return Math.min(ON_FAIL_SKILL_MAX_TIMEOUT_MS, Math.max(ON_FAIL_SKILL_MIN_TIMEOUT_MS, requested))
  }

  private onFailSkillErrorCode(message: string): string {
    if (message.startsWith('E_SKILL_NOT_FOUND')) return 'E_SKILL_NOT_FOUND'
    if (message.startsWith('E_DEPENDENCY_MISSING')) return 'E_DEPENDENCY_MISSING'
    if (message.startsWith('E_VALIDATION')) return 'E_VALIDATION'
    if (message.startsWith('E_PERMISSION')) return 'E_PERMISSION'
    return 'E_SKILL_EXECUTION_FAILED'
  }

  private userSkillRoot(): string {
    return join(app.getPath('userData'), 'skills')
  }

  private buildSkillTemplates(): SkillTemplate[] {
    const templates = [
      {
        templateId: 'blank',
        defaultName: 'blank-skill',
        yaml: this.renderTemplateYaml('blank-skill', 'Blank Skill', 'Start a local DevHub skill with strict YAML metadata.'),
        body: '# {{displayName}}\n\nDescribe when this skill should be used.\n',
        script: this.defaultNodeSkillScript('blank')
      },
      {
        templateId: 'fork-builtin',
        defaultName: 'forked-builtin',
        yaml: this.renderTemplateYaml('forked-builtin', 'Forked Builtin Skill', 'Fork and customize a built-in DevHub skill locally.'),
        body: '# {{displayName}}\n\nUse builtin fork when you need a customized local variant.\n',
        script: this.defaultNodeSkillScript('fork-builtin')
      },
      {
        templateId: 'prompt-only',
        defaultName: 'prompt-only-skill',
        yaml: this.renderTemplateYaml('prompt-only-skill', 'Prompt Only Skill', 'Create a prompt-only skill that packages local context for downstream execution.'),
        body: '# {{displayName}}\n\nWrite the prompt instructions here.\n',
        script: this.defaultNodeSkillScript('prompt-only')
      },
      {
        templateId: 'script-only',
        defaultName: 'script-only-skill',
        yaml: this.renderTemplateYaml('script-only-skill', 'Script Only Skill', 'Create a local script skill that reads one file and prints JSON.'),
        body: '# {{displayName}}\n\nDocument script arguments and output here.\n',
        script: this.defaultNodeSkillScript('script-only')
      },
      {
        templateId: 'full',
        defaultName: 'full-skill',
        yaml: this.renderTemplateYaml('full-skill', 'Full Skill', 'Create a complete local skill with prompt body and script output.'),
        body: '# {{displayName}}\n\n## Usage\n\nExplain inputs, outputs, and safety constraints.\n',
        script: this.defaultNodeSkillScript('full')
      }
    ]
    return templates.map(template => skillTemplateSchema.parse(template))
  }

  private skillUserRoots(): string[] {
    return [
      this.userSkillRoot(),
      join(app.getPath('userData'), 'r8-skills'),
      resolve(app.getPath('home'), '.codex', 'skills')
    ]
  }

  private userSkillDirectory(name: string): string | null {
    const parsed = skillSchema.shape.name.safeParse(name)
    return parsed.success ? join(this.userSkillRoot(), parsed.data) : null
  }

  private async loadUserSkill(skillPath: string, loadedAt: number): Promise<{ skill: Skill } | { error: SkillLoadError }> {
    try {
      const text = await readFile(skillPath, 'utf8')
      const frontmatter = skillFrontmatterSchema.parse(this.extractSkillFrontmatter(text))
      this.assertSkillScriptPath(dirname(skillPath), frontmatter.scriptPath)
      return {
        skill: skillSchema.parse({
          ...frontmatter,
          builtIn: false,
          source: 'user',
          loadedAt,
          filePath: skillPath
        })
      }
    } catch (error) {
      return { error: this.toSkillLoadError(skillPath, error) }
    }
  }

  private assertSkillScriptPath(skillDirectory: string, scriptPath: string): string {
    if (isAbsolute(scriptPath)) throw new Error('E_VALIDATION:scriptPath must be relative to skill directory')
    const resolved = resolve(skillDirectory, scriptPath)
    const local = relative(skillDirectory, resolved)
    if (local.startsWith('..') || isAbsolute(local)) throw new Error('E_VALIDATION:scriptPath must stay inside skill directory')
    if (!existsSync(resolved)) throw new Error('E_NOT_FOUND:scriptPath does not exist')
    return resolved
  }

  private assertSkillScriptPathForWrite(skillDirectory: string, scriptPath: string): string {
    if (isAbsolute(scriptPath)) throw new Error('E_VALIDATION:scriptPath must be relative to skill directory')
    const resolved = resolve(skillDirectory, scriptPath)
    const local = relative(skillDirectory, resolved)
    if (local.startsWith('..') || isAbsolute(local)) throw new Error('E_VALIDATION:scriptPath must stay inside skill directory')
    return resolved
  }

  private resolveSkillWriteDirectory(name: string, filePath?: string): string {
    const defaultDirectory = join(this.userSkillRoot(), name)
    if (!filePath) return defaultDirectory
    const resolvedFile = resolve(filePath)
    const root = resolve(this.userSkillRoot())
    const local = relative(root, resolvedFile)
    if (local.startsWith('..') || isAbsolute(local)) throw new Error('E_PERMISSION:skill filePath must stay inside user skill root')
    return resolvedFile.endsWith('SKILL.md') ? dirname(resolvedFile) : resolvedFile
  }

  private composeSkillDocument(yaml: string, body: string): string {
    const trimmedYaml = yaml.trim().replace(/^---\s*/, '').replace(/\s*---$/, '')
    return ['---', trimmedYaml, '---', body.trim(), ''].join('\n')
  }

  private renderTemplateYaml(name: string, displayName: string, description: string): string {
    return [
      'schemaVersion: "1.0"',
      `name: ${name}`,
      `displayName: "${displayName}"`,
      'version: "1.0.0"',
      `description: "${description}"`,
      'author: "DevHub"',
      'license: "MIT"',
      'sandbox: read-only',
      'tags: [local]',
      'inputs:',
      '  - name: file',
      '    type: file',
      '    required: true',
      'outputs:',
      '  - name: report',
      '    type: json',
      'scriptPath: "./run.js"',
      'runtime: node',
      'permissions: [fs-read]',
      'mcpServers: []'
    ].join('\n')
  }

  private defaultNodeSkillScript(kind: string): string {
    return [
      "const fs = require('node:fs')",
      "const path = require('node:path')",
      '',
      'const target = process.argv[2]',
      'if (!target) {',
      "  console.error(JSON.stringify({ error: 'E_INPUT_REQUIRED', message: 'A file path argument is required.' }))",
      '  process.exit(2)',
      '}',
      'const resolved = path.resolve(target)',
      "const content = fs.readFileSync(resolved, 'utf8')",
      `console.log(JSON.stringify({ skill: '${kind}', file: resolved, bytes: Buffer.byteLength(content), lineCount: content.split(/\r?\n/).length }))`,
      ''
    ].join('\n')
  }

  private toSkillYamlIssue(error: unknown): { line: number; column: number; message: string; severity: 'error' } {
    const record = error as { mark?: { line?: number; column?: number }; message?: string }
    return {
      line: typeof record.mark?.line === 'number' ? record.mark.line : 0,
      column: typeof record.mark?.column === 'number' ? record.mark.column : 0,
      message: error instanceof Error ? error.message : String(error),
      severity: 'error'
    }
  }

  private toSkillLoadError(filePath: string, error: unknown): SkillLoadError {
    const message = error instanceof Error ? error.message : String(error)
    const errorCode = message.startsWith('E_NOT_FOUND')
      ? 'E_NOT_FOUND'
      : message.startsWith('E_PERMISSION')
        ? 'E_PERMISSION'
        : message.startsWith('E_VALIDATION') || (error instanceof Error && error.name === 'ZodError')
          ? 'E_VALIDATION'
          : 'E_PARSE'
    return skillLoadErrorSchema.parse({ filePath, errorCode, message, details: null })
  }

  private renderSkillMarkdown(skill: Skill): string {
    const tags = skill.tags.length > 0 ? `[${skill.tags.join(', ')}]` : '[]'
    const permissions = skill.permissions.length > 0 ? `[${skill.permissions.join(', ')}]` : '[]'
    const inputs = skill.inputs.length > 0
      ? skill.inputs.flatMap(input => [
          `  - name: ${input.name}`,
          `    type: ${input.type}`,
          `    required: ${input.required}`,
          `    description: ${JSON.stringify(input.description ?? '')}`
        ])
      : ['[]']
    const outputs = skill.outputs.length > 0
      ? skill.outputs.flatMap(output => [
          `  - name: ${output.name}`,
          `    type: ${output.type}`
        ])
      : ['[]']
    return [
      '---',
      'schemaVersion: "1.0"',
      `name: ${skill.name}`,
      `displayName: ${JSON.stringify(skill.displayName)}`,
      `version: "${skill.version}"`,
      `description: ${JSON.stringify(skill.description)}`,
      `author: ${JSON.stringify(skill.author)}`,
      `tags: ${tags}`,
      'inputs:',
      ...inputs,
      'outputs:',
      ...outputs,
      `scriptPath: ${JSON.stringify(skill.scriptPath)}`,
      `runtime: ${skill.runtime}`,
      `permissions: ${permissions}`,
      '---',
      `# ${skill.displayName}`,
      '',
      skill.description,
      ''
    ].join('\n')
  }

  private extractSkillFrontmatter(text: string): unknown {
    const trimmed = text.trimStart()
    if (trimmed.startsWith('---')) {
      return matter(trimmed, {
        language: 'yaml',
        engines: {
          yaml: input => loadYaml(input) as object
        }
      }).data
    }
    return loadYaml(trimmed)
  }

  private getFusionConfig(): FusionConfig {
    const parsed = fusionConfigSchema.safeParse(this.store.get('signalFusionConfig', {}))
    if (parsed.success) return parsed.data
    return fusionConfigSchema.parse({ updatedAt: Date.now() })
  }

  private getActiveWeightProfile(): WeightProfile {
    const profileId = coerceWeightProfileId(this.store.get('signalWeightProfile', 'default'))
    const raw = this.store.get('signalWeights', {}) as Partial<Record<SignalSource, number>>
    return createWeightProfile(profileId, raw, Date.now())
  }

  private storeSignalState(fused: FusedSignal, contributionSnapshot: SignalContributionSnapshot): void {
    const rawStates = this.store.get('signalStates', {}) ?? {}
    const states = typeof rawStates === 'object' && rawStates !== null ? rawStates as Record<string, unknown> : {}
    this.store.set('signalStates', { ...states, [fused.instanceId]: fused })
    const rawSnapshots = this.store.get('signalContributionSnapshots', {}) ?? {}
    const snapshots = typeof rawSnapshots === 'object' && rawSnapshots !== null ? rawSnapshots as Record<string, unknown> : {}
    this.store.set('signalContributionSnapshots', { ...snapshots, [fused.instanceId]: contributionSnapshot })
    this.signalContributionTracker.record(contributionSnapshot)
  }

  private emitFusionStream(snapshot: SignalContributionSnapshot): void {
    const throttleMs = this.getFusionConfig().streamThrottleMs
    const lastAt = this.lastFusionStreamAt.get(snapshot.instanceId) ?? 0
    if (snapshot.fusedAt - lastAt < throttleMs) return
    this.lastFusionStreamAt.set(snapshot.instanceId, snapshot.fusedAt)
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    if (typeof BrowserWindow.getAllWindows === 'function') {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) targets.add(window)
      }
    }
    for (const window of targets) {
      window.webContents.send('ai:fusion-stream', snapshot)
    }
  }

  private emitStateTransition(transition: StateTransitionEvent): void {
    const throttleKey = `${transition.instanceId}:${transition.layer}`
    const lastAt = this.lastStateStreamAt.get(throttleKey) ?? 0
    if (transition.ts - lastAt < 100) return
    this.lastStateStreamAt.set(throttleKey, transition.ts)
    const targets = new Set<BrowserWindow>()
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow)
    if (typeof BrowserWindow.getAllWindows === 'function') {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) targets.add(window)
      }
    }
    for (const window of targets) {
      window.webContents.send('ai:state-stream', transition)
    }
  }

  private getStoredContributionSnapshot(instanceId: string): SignalContributionSnapshot | null {
    const raw = this.store.get('signalContributionSnapshots', {}) ?? {}
    const value = raw[String(instanceId)]
    const parsed = signalContributionSnapshotSchema.safeParse(value)
    return parsed.success ? parsed.data : null
  }
}
