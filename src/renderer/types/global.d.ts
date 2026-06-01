/**
 * Global type declarations for renderer process
 * Declares the window.devhub API exposed by preload script
 *
 * NOTE: This file mirrors the API structure from src/preload/index.ts
 * and src/preload/extended.ts. Keep them in sync when adding new APIs.
 */
import type {
  Project,
  LogEntry,
  CodingTool,
  AppSettings,
  ProjectType,
  ProjectOpenTarget,
  ThemeOption
} from '@shared/types'

import type {
  GitInfo,
  ProjectDependencies
} from '@shared/types-extended'
import type {
  ExportDiagnosticBundleRequest,
  ExportDiagnosticBundleResponse,
  IpcThrottleReport,
  ResetRuntimeMetricsResponse,
  RuntimeMetricsResetScope,
  RuntimeMetricsSnapshot
} from '@shared/observability'
import type { ScopedFlow, ScopedTopologyGraph, TopologyScope } from '@shared/topology/scope'
import type {
  BrowserPopout,
  ClaudeCostSummary,
  ClaudeStreamEvent,
  CliOutputEvent,
  CsvLockResult,
  CsvLockStatus,
  CsvSaveResult,
  CommandHistoryEntry,
  CommandPaletteEntry,
  CommandRegisterOsProtocolResult,
  CommandResolvedUri,
  CustomCommand,
  CustomCommandListResponse,
  CustomCommandSaveResult,
  DashboardLayout,
  DashboardLayoutResponse,
  DashboardListPresetsResponse,
  DashboardMorphWidgetToDrawerResult,
  DashboardSaveLayoutResult,
  CsvFileGroup,
  CsvLaunchSession,
  CsvRowStreamPayload,
  CsvSessionEvent,
  CsvTaskRow18,
  DrawerLayoutRecord,
  DrawerState,
  FlowEventStreamPayload,
  FlowExportResult,
  FlowRequest,
  FlowSnapshot,
  FlowStats,
  GraphExportFormat,
  GraphExportResult,
  GraphKind,
  GraphSavedSnapshot,
  GraphSlice,
  GraphSnapshot,
  GeminiPatternRuleInput,
  GeminiPatternStat,
  GeminiRuleReloadResponse,
  AttachedTopologyRequest,
  AttachedTopologyResult,
  InjectCountdownStreamPayload,
  InjectFirstTimeRequiredPayload,
  InjectResult,
  NodeTemplate,
  QueueStats,
  R8IpcChannelDefinition,
  ChannelRegistration,
  RateLimitOverrideResponse,
  RateLimitStatsResponse,
  AsciinemaCast,
  RecordingEvent,
  RecordingFsSnapshotResult,
  RecordingManifest,
  RecordingReplayState,
  RecordingScreenshotResult,
  RecordingStreamKind,
  RecordingSession,
  RecordingStartRequest,
  RecoveryCheckDirtyResponse,
  RecoveryDismissResponse,
  RecoveryReport,
  RecoverySnapshot,
  ReplayState,
  BlocklistEntry,
  PublicBannerState,
  AppVersionInfo,
  SkillListStreamPayload,
  Skill,
  SkillLoadError,
  SkillTemplate,
  SkillValidationResult,
  SecurityTier,
  ShimManifest,
  SignalContributionSnapshot,
  FusionConfig,
  WeightProfile,
  InstanceState,
  DiagnosticExplain,
  MisreportRecord,
  MisreportResponse,
  MonitorPopout,
  MonitorPopoutLayout,
  MonitorSnapshot,
  MonitorTool,
  MonitorWindowState,
  PanelPopoutSurface,
  ResetLearnedWeightsResponse,
  StateAssertionRule,
  StateTransitionEvent,
  StatusAggregate,
  StatusbarConfig,
  CustomSvgEntry,
  CustomSvgListResponse,
  CustomSvgRemoveResponse,
  CustomSvgUploadResponse,
  ThemeDecorationConfig,
  ThemeDecorationListResponse,
  ThemeSoundConfig,
  ThemeSoundConfigResponse,
  TaskStateStreamPayload,
  TaskResultExportRequest,
  TaskResultExportResult,
  TaskRun,
  ToolMonitorCard,
  ToolDetectResult,
  ToolDetectionState,
  ToolClearOverrideResponse,
  ToolOverrideResponse,
  WatchdogSupervisorEventStreamPayload,
  WatchdogStatus,
  WatchdogEventStreamPayload,
  ChannelConfig,
  DevhubNotification,
  NotificationAggregationConfig,
  NotificationLevel,
  NotifyEmitResponse,
  ObservabilityConfig,
  ObservabilityDiagnosticPackResponse,
  ObservabilityExportSnapshotResponse,
  ObservabilityMetricSample,
  ObservabilitySnapshot,
  Locale,
  LocaleGetResponse,
  LocaleListResponse,
  LocaleReloadResponse,
  LocaleSetResponse,
  ParseSession,
  ParserStrategy,
  ProgressDataPoint,
  A11yOsPrefs,
  A11yPrefs,
  A11ySelfCheckResult,
  IconLibrary,
  IconListLibrariesResponse,
  IconResolveResponse,
  CloudSyncResult,
  CloudSyncStatus,
  BackupBundle,
  DataOwnershipExportAllRequest,
  DataOwnershipListEntriesRequest,
  DataOwnershipListEntriesResponse,
  DataOwnershipListPathsResponse,
  CsvExternalChangeEvent,
  DiagnosticPackManifest,
  DiagnosticPreview,
  OcrCapabilities,
  OcrDisabledResponse,
  PermissionCheckResult,
  PermissionExpiryStreamPayload,
  PermissionTtlGrant,
  PopoutBridgeMessage,
  PopoutScreenEvent,
  PortPopoutBatchRequest,
  PortPopoutBatchResponse,
  PortPopoutCloseRequest,
  PortPopoutCloseResponse,
  PortPopoutDemoteRequest,
  PortPopoutDemoteResponse,
  PortPopoutListResponse,
  PortPopoutOpenRequest,
  PortPopoutOpenResponse,
  PortPopoutPinRequest,
  PortPopoutPinResponse,
  PortPopoutPositionGetResponse,
  PortPopoutPositionSaveRequest,
  PortPopoutPositionSaveResponse,
  PortPopoutSyncRequest,
  PortPopoutSyncResponse,
  ProcessHistory,
  ProcessHistoryBatchResponse,
  ProcessBatchCancelResponse,
  ProcessBatchProgress,
  ProcessBatchRequest,
  ProcessBatchStartResponse,
  ProcessBatchUndoResponse,
  ProcessTag,
  ProcessTagColor,
  ProcessTagsImportResponse,
  ProcessTagsListResponse,
  ProcessTreeNode,
  ProcessViewMode,
  ThumbnailBatchRequest,
  ThumbnailBatchResponse,
  ThumbnailGroupsResponse,
  ThumbnailRefreshRequest,
  ThumbnailViewportConfigResponse,
  ThumbnailWallViewport,
  ThumbnailWindowAliasRequest,
  ThumbnailWindowAliasResponse,
  MoveWindowToDesktopRequest,
  MoveWindowToDesktopResponse,
  MoveWindowToMonitorRequest,
  MoveWindowToMonitorResponse,
  R8MonitorsResponse,
  VirtualDesktopListResponse,
  WindowVdWatchPayload,
  WindowLayoutApplyRequest,
  WindowLayoutApplyResponse,
  WindowLayoutListResponse,
  WindowLayoutSaveRequest,
  WindowLayoutSaveResponse,
  AttachedTopologyFavoriteChangeRequest,
  AttachedTopologyFavoriteChangeResult,
  TreemapLayout,
  WindowBatchCancelResponse,
  WindowBatchProgress,
  WindowBatchRequest,
  WindowBatchStartResponse,
  WindowBatchUndoResponse,
  WindowVdInfoRequest,
  WindowVdInfoResponse,
  ZodListSchemasResponse,
  ZodMigrationStatusResponse,
  ZodValidatePayloadResponse
} from '@shared/schemas/r8-runtime'

import type {
  ProcessInfo,
  ProcessGroup,
  ProcessRelationship,
  ProcessDeepDetail,
  AccessReport,
  NetworkConnectionInfo,
  LoadedModuleInfo,
  PortInfo,
  PortTopologyData,
  PortFocusData,
  PortDetailIncrementalResult,
  WindowInfo,
  WindowGroup,
  WindowLayout,
  WindowLayoutSnapshot,
  ApplyLayoutIntent,
  ApplyLayoutResult,
  TilePreset,
  MonitorInfo,
  AITask,
  AITaskHistory,
  AIToolType,
  AIToolDetectionConfig,
  CalibrationResult,
  CalibrationSample,
  ConfidenceReport,
  StateTransition,
  ToolProfile,
  AICompletionOracleEvent,
  AICompletionOracleRecord,
  AIWindowAlias,
  AIRenameAndApplyRequest,
  AIRenameAndApplyResult,
  ProgressEstimate,
  TimelineEntry,
  TaskStatistics,
  TaskRecord,
  TaskType,
  TaskRecordStatus,
  NotificationConfig,
  AppNotification,
  ServiceResult,
  ScannerCacheSnapshot,
  ScannerDiff,
  ScannerResyncResponse,
  SystemSummary,
  ScannerStatus,
  WindowFavoriteRecord,
  WindowFavoriteToggleResult,
  WindowOpenDirectoryResult,
  WindowScreenshotResult
} from '@shared/types-extended'

/** AI task-specific statistics (active/completed/error counts by tool).
 *  Distinct from TaskStatistics in types-extended.ts which tracks historical duration metrics. */
interface AITaskStatistics {
  totalTasks: number
  completedTasks: number
  errorTasks: number
  avgDuration: number
  byTool: Record<AIToolType, number>
}

declare global {
  interface Window {
    devhub: {
      // ==================== Projects ====================
      projects: {
        list: () => Promise<Project[]>
        get: (id: string) => Promise<Project | undefined>
        add: (path: string) => Promise<Project>
        remove: (id: string) => Promise<boolean>
        update: (id: string, updates: Partial<Project>) => Promise<Project | undefined>
        scan: (scanPath?: string) => Promise<Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>>
        scanDirectory: (dirPath: string) => Promise<Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>>
        discover: () => Promise<Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>>
        onAutoDiscovered: (callback: (projects: Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>) => void) => () => void
        getGitInfo: (projectPath: string, options?: { force?: boolean }) => Promise<GitInfo | null>
        getDependencies: (projectPath: string) => Promise<ProjectDependencies | null>
        openIn: (projectPath: string, target: ProjectOpenTarget) => Promise<boolean>
        watcher?: {
          start: (watchPaths?: string[]) => Promise<{ running: boolean }>
          stop: () => Promise<{ running: boolean }>
          status: () => Promise<{ running: boolean }>
          onDetected: (callback: (events: Array<{ type: 'added' | 'removed'; dirPath: string; detections: Array<{ projectType: ProjectType; name: string; scripts: string[] }> }>) => void) => () => void
        }
      }

      // ==================== Process ====================
      process: {
        start: (projectId: string, script: string) => Promise<boolean>
        stop: (projectId: string) => Promise<boolean>
        isRunning: (projectId: string) => Promise<boolean>
        onStatusChange: (
          callback: (data: { projectId: string; status: string; pid?: number }) => void
        ) => () => void
      }

      // ==================== Logs ====================
      logs: {
        subscribe: (projectId: string) => void
        onEntry: (callback: (entry: LogEntry) => void) => () => void
        clear: (projectId: string) => void
      }

      // ==================== Tools ====================
      tools: {
        getStatus: () => Promise<CodingTool[]>
        onComplete: (callback: (tool: CodingTool) => void) => () => void
      }

      // ==================== Settings ====================
      settings: {
        get: () => Promise<AppSettings>
        update: (updates: Partial<AppSettings>) => Promise<AppSettings>
      }

      // ==================== i18n ====================
      i18n: {
        getLocale: () => Promise<LocaleGetResponse>
        setLocale: (locale: Locale) => Promise<LocaleSetResponse>
        listLocales: () => Promise<LocaleListResponse>
        reloadResources: () => Promise<LocaleReloadResponse>
      }

      // ==================== Tags & Groups ====================
      tags: {
        list: () => Promise<string[]>
        add: (tag: string) => Promise<void>
        remove: (tag: string) => Promise<void>
      }

      groups: {
        list: () => Promise<string[]>
        add: (group: string) => Promise<void>
        remove: (group: string) => Promise<void>
      }

      // ==================== Dialog ====================
      dialog: {
        openDirectory: () => Promise<string | null>
      }

      // ==================== Shell ====================
      shell: {
        openPath: (path: string) => Promise<string>
      }

      // ==================== System ====================
      system: {
        getDrives: () => Promise<string[]>
        getVersion: () => Promise<AppVersionInfo>
      }

      // ==================== Window Controls ====================
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
        hideToTray: () => void
        forceClose: () => void
        onCloseConfirm: (callback: () => void) => () => void
      }

      // ==================== Extended APIs ====================

      // System Process API
      systemProcess: {
        scan: () => Promise<ServiceResult<ProcessInfo[]>>
        getBasicInfo: (pid: number) => Promise<ProcessInfo | null>
        kill: (pid: number) => Promise<boolean>
        cleanupZombies: () => Promise<number>
        getGroups: () => Promise<ProcessGroup[]>
        getProcessTree: (pid: number) => Promise<ProcessInfo[]>
        getFullRelationship: (pid: number) => Promise<ProcessRelationship | null>
        getProcessHistory: (pid: number) => Promise<{ cpuHistory: number[]; memoryHistory: number[] }>
        listProcessTags: () => Promise<ProcessTagsListResponse>
        setProcessTag: (input: { exe: string; cwd?: string; tag: string; color?: ProcessTagColor; pinned?: boolean }) => Promise<ProcessTag>
        removeProcessTag: (input: { exe: string; cwd?: string }) => Promise<{ success: boolean; removed: number; key: string }>
        exportProcessTags: () => Promise<{ json: string }>
        importProcessTags: (json: string) => Promise<ProcessTagsImportResponse>
        getProcessHistory24h: (input: { exe: string; cwd?: string }) => Promise<ProcessHistory>
        getProcessHistoryBatch: (keys: string[]) => Promise<ProcessHistoryBatchResponse>
        batchOp: (request: ProcessBatchRequest) => Promise<ProcessBatchStartResponse>
        batchCancel: (jobId: string, confirmedBy?: string) => Promise<ProcessBatchCancelResponse>
        batchUndo: (jobId: string, confirmedBy?: string) => Promise<ProcessBatchUndoResponse>
        onBatchProgress: (callback: (progress: ProcessBatchProgress) => void) => () => void
        getDeepDetail: (pid: number) => Promise<ProcessDeepDetail | null>
        probeAccess: (pid: number) => Promise<AccessReport>
        getConnections: (pid: number) => Promise<NetworkConnectionInfo[]>
        getEnvironment: (pid: number) => Promise<{ variables: Record<string, string>; requiresElevation: boolean }>
        killTree: (pid: number) => Promise<boolean>
        setPriority: (pid: number, priority: string) => Promise<boolean>
        openFileLocation: (filePath: string) => Promise<void>
        getModules: (pid: number) => Promise<{ modules: LoadedModuleInfo[]; requiresElevation: boolean }>
        relaunchAsAdmin: () => Promise<{ ok: boolean; reason?: string }>
        onUpdated: (callback: (processes: ProcessInfo[]) => void) => () => void
        onZombieDetected: (callback: (zombies: ProcessInfo[]) => void) => () => void
      }

      // Port API
      port: {
        scan: () => Promise<PortInfo[]>
        scanCommon: () => Promise<PortInfo[]>
        check: (port: number) => Promise<PortInfo | null>
        release: (port: number) => Promise<boolean>
        isAvailable: (port: number) => Promise<boolean>
        findAvailable: (startPort: number) => Promise<number>
        detectConflicts: (ports: number[]) => Promise<PortInfo[]>
        getTopology: () => Promise<PortTopologyData>
        getPortFocusData: (port: number) => Promise<PortFocusData | null>
        getPortDetailIncremental: (port: number) => Promise<PortDetailIncrementalResult>
        cancelPortQuery: (port: number) => Promise<boolean>
        onConflict: (callback: (data: { port: number; resolved: boolean }) => void) => () => void
      }

      // Scoped Topology API
      topology: {
        buildScopedGraph: (scope: TopologyScope) => Promise<ScopedTopologyGraph>
        buildScopedFlow: (scope: TopologyScope) => Promise<ScopedFlow>
        warmScope: (scope: TopologyScope) => Promise<{ ok: boolean; nodeCount: number; edgeCount: number; source: ScopedTopologyGraph['source'] }>
      }

      // Window Manager API
      windowManager: {
        scan: (includeSystemWindows?: boolean) => Promise<ServiceResult<WindowInfo[]>>
        focus: (hwnd: number) => Promise<ServiceResult>
        move: (hwnd: number, x: number, y: number, width: number, height: number) => Promise<ServiceResult>
        minimize: (hwnd: number) => Promise<ServiceResult>
        maximize: (hwnd: number) => Promise<ServiceResult>
        close: (hwnd: number) => Promise<ServiceResult>
        restore: (hwnd: number) => Promise<ServiceResult>
        setTopmost: (hwnd: number, topmost: boolean) => Promise<ServiceResult>
        setAlwaysOnTop: (hwnd: number, topmost: boolean) => Promise<ServiceResult>
        getTopmost: (hwnd: number) => Promise<ServiceResult<{ hwnd: number; topmost: boolean }>>
        listTopmost: () => Promise<ServiceResult<{ hwnds: number[] }>>
        setOpacity: (hwnd: number, opacity: number) => Promise<ServiceResult>
        setTitle: (hwnd: number, title: string) => Promise<ServiceResult>
        sendKeys: (hwnd: number, keys: string) => Promise<ServiceResult>
        tileLayout: (hwnds: number[]) => Promise<ServiceResult>
        cascadeLayout: (hwnds: number[]) => Promise<ServiceResult>
        stackLayout: (hwnds: number[]) => Promise<ServiceResult>
        minimizeAll: () => Promise<ServiceResult>
        restoreAll: () => Promise<ServiceResult>
        addToGroup: (groupId: string, hwnd: number) => Promise<ServiceResult>
        restoreGroup: (groupId: string) => Promise<ServiceResult>
        createGroup: (name: string, windowHwnds: number[], projectId?: string) => Promise<WindowGroup>
        getGroups: () => Promise<WindowGroup[]>
        removeGroup: (groupId: string) => Promise<boolean>
        renameGroup?: (groupId: string, newName: string) => Promise<ServiceResult>
        minimizeGroup?: (groupId: string) => Promise<ServiceResult>
        closeGroup?: (groupId: string) => Promise<ServiceResult>
        saveLayout: (name: string, description?: string) => Promise<WindowLayout>
        restoreLayout: (layoutId: string) => Promise<ServiceResult>
        getLayouts: () => Promise<WindowLayout[]>
        removeLayout: (layoutId: string) => Promise<boolean>
        applyLayout?: (intent: ApplyLayoutIntent) => Promise<ApplyLayoutResult>
        saveSnapshot?: (name: string, description: string | undefined, hwnds: number[], monitorId?: number) => Promise<ServiceResult<WindowLayoutSnapshot>>
        updateSnapshot?: (id: string, patch: { name?: string; description?: string }) => Promise<ServiceResult>
        deleteSnapshot?: (id: string) => Promise<ServiceResult>
        restoreSnapshot?: (id: string) => Promise<ApplyLayoutResult>
        listSnapshots?: () => Promise<WindowLayoutSnapshot[]>
        previewLayout?: (preset: TilePreset, count: number, monitorId?: number) => Promise<WindowInfo['rect'][]>
        restorePrevious?: (restorePointId?: string) => Promise<ApplyLayoutResult>
        getMonitorInfo?: () => Promise<MonitorInfo[]>
        getR8Monitors?: () => Promise<R8MonitorsResponse>
        listVirtualDesktops?: () => Promise<VirtualDesktopListResponse>
        getWindowVdInfo?: (request: WindowVdInfoRequest) => Promise<WindowVdInfoResponse>
        onVdWatch?: (callback: (payload: WindowVdWatchPayload) => void) => () => void
        moveToDesktop?: (request: MoveWindowToDesktopRequest) => Promise<MoveWindowToDesktopResponse>
        moveToMonitor?: (request: MoveWindowToMonitorRequest) => Promise<MoveWindowToMonitorResponse>
        saveR8LayoutPreset?: (request: WindowLayoutSaveRequest) => Promise<WindowLayoutSaveResponse>
        listR8LayoutPresets?: () => Promise<WindowLayoutListResponse>
        applyR8LayoutPreset?: (request: WindowLayoutApplyRequest) => Promise<WindowLayoutApplyResponse>
        tileGroup?: (groupId: string, preset?: TilePreset) => Promise<ApplyLayoutResult>
        screenshot?: (hwnd: number) => Promise<ServiceResult<WindowScreenshotResult>>
        toggleFavorite?: (hwnd: number) => Promise<ServiceResult<WindowFavoriteToggleResult>>
        getFavorites?: () => Promise<WindowFavoriteRecord[]>
        openWorkingDir?: (hwnd: number) => Promise<ServiceResult<WindowOpenDirectoryResult>>
        getThumbnailsBatch?: (request: ThumbnailBatchRequest) => Promise<ThumbnailBatchResponse>
        refreshThumbnail?: (request: ThumbnailRefreshRequest) => Promise<ServiceResult>
        getThumbnailGroups?: () => Promise<ThumbnailGroupsResponse>
        setThumbnailAlias?: (request: ThumbnailWindowAliasRequest) => Promise<ThumbnailWindowAliasResponse>
        saveThumbnailViewport?: (viewport: ThumbnailWallViewport) => Promise<ThumbnailViewportConfigResponse>
        batchOp?: (request: WindowBatchRequest) => Promise<WindowBatchStartResponse>
        batchCancel?: (jobId: string, confirmedBy?: string) => Promise<WindowBatchCancelResponse>
        batchUndo?: (jobId: string, confirmedBy?: string) => Promise<WindowBatchUndoResponse>
        onBatchProgress?: (callback: (progress: WindowBatchProgress) => void) => () => void
        onUpdated: (callback: (windows: WindowInfo[]) => void) => () => void
        focusGroup: (groupId: string) => Promise<ServiceResult>
      }

      // AI Task API
      aiTask: {
        scan: () => Promise<AITask[]>
        getActive: () => Promise<AITask[]>
        getHistory: (limit?: number) => Promise<AITaskHistory[]>
        startTracking: (pid: number) => Promise<AITask | null>
        stopTracking: (pid: number) => Promise<boolean>
        getProgress: (taskId: string) => Promise<ProgressEstimate | null>
        getTimeline?: (taskId: string) => Promise<TimelineEntry[]>
        getConfidenceReport?: (taskKey: string) => Promise<ConfidenceReport | null>
        recordCompletionOracle?: (event: AICompletionOracleEvent) => Promise<AICompletionOracleRecord | null>
        getStateHistory?: (taskKey: string, limit?: number) => Promise<StateTransition[]>
        getProfile?: (toolType: AIToolType) => Promise<ToolProfile | null>
        setProfile?: (toolType: AIToolType, profile: Partial<ToolProfile>) => Promise<boolean>
        calibrate?: (toolType: AIToolType, sample: CalibrationSample) => Promise<CalibrationResult | null>
        setDetectionConfig?: (toolType: AIToolType, config: Partial<AIToolDetectionConfig>) => Promise<boolean>
        getDetectionConfig?: (toolType: AIToolType) => Promise<AIToolDetectionConfig | null>
        /** @deprecated Use onCompleted — channel sends AITaskHistory, not AITask */
        onTaskComplete: (callback: (entry: AITaskHistory) => void) => () => void
        onTaskUpdated: (callback: (task: AITask) => void) => () => void
        onNavigateToTask: (callback: (taskId: string) => void) => () => void
        // Extended methods used by hooks (optional - may not be implemented)
        getAll?: () => Promise<AITask[]>
        getStatistics?: () => Promise<AITaskStatistics | null>
        getById?: (taskId: string) => Promise<AITask | undefined>
        onStarted?: (callback: (task: AITask) => void) => () => void
        onStatusChanged?: (callback: (task: AITask) => void) => () => void
        onCompleted?: (callback: (entry: AITaskHistory) => void) => () => void
      }

      // AI Alias API
      aiAlias: {
        getAll: () => Promise<AIWindowAlias[]>
        set: (alias: AIWindowAlias) => Promise<boolean>
        remove: (aliasId: string) => Promise<boolean>
        rename: (aliasId: string, newName: string) => Promise<boolean>
        renameAndApply: (request: AIRenameAndApplyRequest) => Promise<AIRenameAndApplyResult>
      }

      // Notification API
      notification: {
        getConfig: () => Promise<NotificationConfig>
        setConfig: (config: Partial<NotificationConfig>) => Promise<NotificationConfig>
        getHistory: (limit?: number) => Promise<AppNotification[]>
        markRead: (notificationId: string) => Promise<void>
        markAllRead: () => Promise<void>
        clearHistory: () => Promise<void>
        getUnreadCount: () => Promise<number>
        onNotification: (callback: (notification: AppNotification) => void) => () => void
      }

      // Task History API
      taskHistory: {
        add: (record: Omit<TaskRecord, 'id'>) => Promise<TaskRecord>
        update: (id: string, updates: Partial<TaskRecord>) => Promise<TaskRecord | undefined>
        complete: (id: string, status?: TaskRecordStatus) => Promise<TaskRecord | undefined>
        get: (id: string) => Promise<TaskRecord | undefined>
        list: (options?: {
          type?: TaskType
          projectId?: string
          status?: TaskRecordStatus
          limit?: number
          offset?: number
          startDate?: string
          endDate?: string
        }) => Promise<TaskRecord[]>
        getStatistics: (options?: {
          projectId?: string
          startDate?: string
          endDate?: string
        }) => Promise<TaskStatistics | null>
        clearOld: (beforeDate: string) => Promise<number>
        onRecordAdded: (callback: (record: TaskRecord) => void) => () => void
        onRecordUpdated: (callback: (record: TaskRecord) => void) => () => void
      }

      // Scanner API (background probing)
      scanner: {
        subscribe: () => void
        getSnapshot: () => Promise<ScannerCacheSnapshot | null>
        getStatus: () => Promise<ScannerStatus | null>
        retryScanner: (type: string) => Promise<{ success: boolean; error?: string }>
        requestResync: (channel: string) => Promise<ScannerResyncResponse>
        onProcessesDiff: (callback: (diff: ScannerDiff<ProcessInfo>) => void) => () => void
        onPortsDiff: (callback: (diff: ScannerDiff<PortInfo>) => void) => () => void
        onWindowsDiff: (callback: (diff: ScannerDiff<WindowInfo>) => void) => () => void
        onAiTasksDiff: (callback: (diff: ScannerDiff<AITask>) => void) => () => void
        onSummaryUpdate: (callback: (summary: SystemSummary) => void) => () => void
        onSnapshotPush: (callback: (snapshot: ScannerCacheSnapshot) => void) => () => void
        onScannerFailed: (callback: (data: { type: string; retries: number }) => void) => () => void
      }

      r8: {
        integrations: {
          listLibraries: () => Promise<unknown[]>
          getFlag: (flag: string) => Promise<boolean>
          setFlag: (flag: string, value: boolean, confirmedBy?: string) => Promise<{ flag: string; value: boolean; confirmedBy: string | null }>
          healthCheck: () => Promise<{ checkedAt: number; featureFlags: number; ipcChannels: number; schemas: number; popouts: number; stores: string[] }>
        }
        ipc: {
          listChannels: () => Promise<ChannelRegistration[]>
          rateLimitStats: () => Promise<RateLimitStatsResponse>
          overrideRateClass: (channel: string, rateClass: R8IpcChannelDefinition['rateClass'], confirmedBy?: string) => Promise<RateLimitOverrideResponse>
        }
        obs: {
          getSnapshot: (input?: { sinceMs?: number }) => Promise<ObservabilitySnapshot>
          configure: (config: Partial<ObservabilityConfig>) => Promise<{ success: boolean; config: ObservabilityConfig; effectiveSamplingHz: number }>
          exportSnapshot: (input?: { format?: 'json' | 'csv'; destPath?: string }) => Promise<ObservabilityExportSnapshotResponse>
          exportDiagnosticPack: (input?: { includeScreenshots?: boolean }) => Promise<ObservabilityDiagnosticPackResponse>
          subscribe: (listener: (payload: ObservabilityMetricSample[]) => void) => () => void
        }
        cli: {
          getProgress: (input?: { tool?: string; instanceId?: string; limit?: number }) => Promise<{ events: CliOutputEvent[]; latest: CliOutputEvent | null; count: number; progress: ProgressDataPoint | null }>
          getSessions: () => Promise<ParseSession[]>
          installShim: (tool: string, confirmedBy?: string) => Promise<unknown>
          uninstallShim: (tool: string, confirmedBy?: string) => Promise<{ success: boolean; tool: string }>
          shimStatus: () => Promise<Record<'codex' | 'claude' | 'gemini', ShimManifest | null>>
          selectStrategy: (input: { sessionId?: string; instanceId?: string; strategy: ParserStrategy }) => Promise<{ success: boolean; session: ParseSession }>
          detectAll: (input?: { force?: boolean }) => Promise<ToolDetectionState>
          detectOne: (tool: string, force?: boolean) => Promise<ToolDetectResult>
          setToolOverride: (tool: string, path: string, confirmedBy?: string) => Promise<ToolOverrideResponse>
          clearToolOverride: (tool: string, confirmedBy?: string) => Promise<ToolClearOverrideResponse>
          cursorCopilotStatus: (instanceId?: string) => Promise<unknown>
          reloadTitleRules: (rules: unknown[], confirmedBy?: string) => Promise<unknown>
          onDetectionEvent: (callback: (state: ToolDetectionState) => void) => () => void
          onEvent: (callback: (event: CliOutputEvent) => void) => () => void
        }
        monitor: {
          open: () => Promise<{ success: boolean; windowId: string; windowState: MonitorWindowState }>
          close: () => Promise<{ success: boolean; closed: number; closedAt: number }>
          snapshot: () => Promise<MonitorSnapshot>
          setWindowPrefs: (input: { alwaysOnTop?: boolean; opacity?: number; bounds?: MonitorWindowState['bounds']; confirmedBy?: string }) => Promise<{ success: boolean; windowState: MonitorWindowState; updatedAt: number; confirmedBy?: string }>
          focusInstance: (tool: MonitorTool, instanceId: string) => Promise<{ success: boolean; tool: MonitorTool; instanceId: string; focusedAt: number }>
          openPopout: (tool: MonitorTool, layout?: MonitorPopoutLayout) => Promise<{ success: boolean; popoutId: string; popout: MonitorPopout }>
          closePopout: (popoutId: string) => Promise<{ success: boolean; popoutId: string; closedAt: number }>
          listPopouts: () => Promise<MonitorPopout[]>
          returnPopoutToMain: (popoutId: string) => Promise<{ success: boolean; popoutId: string; returnedAt: number }>
          setPopoutLayout: (popoutId: string, layout: MonitorPopoutLayout) => Promise<{ success: boolean; popoutId: string; layout: MonitorPopoutLayout; popout: MonitorPopout; updatedAt: number }>
          onSnapshotStream: (callback: (snapshot: MonitorSnapshot) => void) => () => void
          onPopoutSnapshotStream: (callback: (card: ToolMonitorCard) => void) => () => void
        }
        zod: {
          listSchemas: () => Promise<ZodListSchemasResponse>
          validatePayload: (schemaName: string, payload: unknown) => Promise<ZodValidatePayloadResponse>
          migrationStatus: () => Promise<ZodMigrationStatusResponse>
        }
        port?: {
          openPopout: (input: PortPopoutOpenRequest) => Promise<PortPopoutOpenResponse>
          closePopout: (input: PortPopoutCloseRequest) => Promise<PortPopoutCloseResponse>
          listPopouts: () => Promise<PortPopoutListResponse>
          getPopoutPosition: (port: number) => Promise<PortPopoutPositionGetResponse>
          savePopoutPosition: (input: PortPopoutPositionSaveRequest) => Promise<PortPopoutPositionSaveResponse>
          pinPopout: (input: PortPopoutPinRequest) => Promise<PortPopoutPinResponse>
          batchPopouts: (input: PortPopoutBatchRequest) => Promise<PortPopoutBatchResponse>
          syncPopout: (input: PortPopoutSyncRequest) => Promise<PortPopoutSyncResponse>
          demotePopout: (input: PortPopoutDemoteRequest) => Promise<PortPopoutDemoteResponse>
        }
        popout: {
          create: (request: unknown) => Promise<BrowserPopout>
          close: (windowId: string) => Promise<{ success: boolean; windowId: string }>
          list: () => Promise<BrowserPopout[]>
          bridgeMessage: (message: PopoutBridgeMessage) => Promise<{ success: boolean; windowId: string; type?: string; heartbeatAt?: number; bridgeState?: BrowserPopout['bridgeState'] }>
          onBridgeMessage: (callback: (message: PopoutBridgeMessage) => void) => () => void
          onScreenEvent: (callback: (event: PopoutScreenEvent) => void) => () => void
          pin: (windowId: string, pinned: boolean) => Promise<BrowserPopout | null>
          saveBounds: (windowId: string, bounds: { x: number; y: number; width: number; height: number }) => Promise<{ success: boolean; windowId: string; bounds: { x: number; y: number; width: number; height: number } }>
          moveToMonitor: (windowId: string, monitorIndex: number) => Promise<{ success: boolean; windowId: string; monitorIndex: number; bounds: { x: number; y: number; width: number; height: number } }>
          promoteFromFloating: (floatingId: string, input?: { bounds?: { x: number; y: number; width: number; height: number }; alwaysOnTop?: boolean }) => Promise<{ success: boolean; browserPopoutId: string; popout: BrowserPopout }>
          demote: (windowId: string) => Promise<{ success: boolean; floatingId: string; popout: BrowserPopout }>
        }
        panel: {
          openPopout: (surface: PanelPopoutSurface, target?: string) => Promise<BrowserPopout>
          listPopouts: () => Promise<BrowserPopout[]>
          closePopout: (windowId: string) => Promise<{ success: boolean; windowId: string }>
        }
        drawer: {
          getState: () => Promise<DrawerState[]>
          setState: (state: unknown) => Promise<DrawerState>
          saveLayout: (name: string, states?: unknown) => Promise<DrawerLayoutRecord>
          loadLayout: (name: string) => Promise<DrawerLayoutRecord>
          listLayouts: () => Promise<DrawerLayoutRecord[]>
          morphToPopout: (slot: string, contentId?: string) => Promise<{ popoutId: string }>
          morphFromPopout: (popoutId: string, slot: string) => Promise<{ drawerState: DrawerState }>
        }
        command: {
          list: () => Promise<CommandPaletteEntry[]>
          invoke: (commandId: string, args?: unknown, confirmedBy?: string) => Promise<{ success: boolean; commandId: string }>
          resolveUri: (uri: string) => Promise<CommandResolvedUri>
          registerOsProtocol: (register: boolean, confirmedBy: string) => Promise<CommandRegisterOsProtocolResult>
          history: () => Promise<CommandHistoryEntry[]>
          addHistory: (entry: CommandHistoryEntry) => Promise<CommandHistoryEntry>
          clearHistory: (confirmedBy: string) => Promise<{ success: boolean }>
          listCustom: () => Promise<CustomCommandListResponse>
          saveCustom: (command: Pick<CustomCommand, 'id' | 'label' | 'handlerScript'> & Partial<Pick<CustomCommand, 'enabled' | 'shortcut' | 'confirmedBy'>>) => Promise<CustomCommandSaveResult>
          onEvent: (callback: (event: { type: string; tab?: string; slot?: string; contentId?: string; layoutName?: string; mode?: string; uri?: string; graphKind?: GraphKind; selectedNodeId?: string; theme?: ThemeOption }) => void) => () => void
        }
        dashboard: {
          getLayout: (name?: string) => Promise<DashboardLayoutResponse>
          saveLayout: (layout: DashboardLayout) => Promise<DashboardSaveLayoutResult>
          listPresets: () => Promise<DashboardListPresetsResponse>
          deletePreset: (name: string, confirmedBy?: string) => Promise<{ success: boolean; name: string }>
          reset: (preset?: string, confirmedBy?: string) => Promise<DashboardLayoutResponse>
          morphWidgetToDrawer: (widgetInstanceId: string, slot: 'right' | 'bottom') => Promise<DashboardMorphWidgetToDrawerResult>
        }
        status: {
          aggregate: () => Promise<StatusAggregate>
          onAggregate: (callback: (aggregate: StatusAggregate) => void) => () => void
        }
        statusbar: {
          getConfig: () => Promise<StatusbarConfig>
          setConfig: (config: StatusbarConfig) => Promise<StatusbarConfig>
          reset: (confirmedBy: string) => Promise<StatusbarConfig>
        }
        themeDecoration: {
          list: () => Promise<ThemeDecorationListResponse>
          set: (config: ThemeDecorationConfig) => Promise<ThemeDecorationConfig>
          uploadCustomSvg: (name: string, content: string, confirmedBy?: string) => Promise<CustomSvgUploadResponse>
          listCustomSvg: () => Promise<CustomSvgListResponse>
          removeCustomSvg: (id: string, confirmedBy?: string) => Promise<CustomSvgRemoveResponse>
          getSoundConfig: (themeId: ThemeSoundConfig['themeId']) => Promise<ThemeSoundConfig>
          setSoundConfig: (config: ThemeSoundConfig) => Promise<ThemeSoundConfigResponse>
          getCustomSvgContent: (id: string) => Promise<CustomSvgEntry | null>
        }
        a11y: {
          getPrefs: () => Promise<A11yPrefs>
          setPrefs: (prefs: A11yPrefs) => Promise<A11yPrefs>
          osPrefs: () => Promise<A11yOsPrefs>
          runSelfCheck: () => Promise<A11ySelfCheckResult>
        }
        icon: {
          listLibraries: () => Promise<IconListLibrariesResponse>
          resolveToken: (token: `${IconLibrary}:${string}`) => Promise<IconResolveResponse>
        }
        portSecurity: {
          classify: (port: number, ip?: string) => Promise<SecurityTier>
          listBlocklist: () => Promise<BlocklistEntry[]>
          addBlocklist: (entry: { ip?: string; port?: number; reason?: string; confirmedBy?: string }) => Promise<BlocklistEntry>
          removeBlocklist: (entry: { id?: string; ip?: string; port?: number; confirmedBy?: string }) => Promise<{ success: boolean; removed: number; remaining: number }>
          resetBlocklist: (confirmedBy?: string) => Promise<{ defaults: BlocklistEntry[]; clearedUserEntries: number; resetAt: number }>
          publicBannerState: () => Promise<PublicBannerState>
        }
        processViews: {
          tree: (input?: { rootPid?: number; maxDepth?: number }) => Promise<{ tree: ProcessTreeNode }>
          treeChildren: (pid: number) => Promise<{ children: ProcessTreeNode[] }>
          treemapData: (input?: { groupBy?: 'none' | 'parent' | 'exe' | 'ai-tool'; colorBy?: 'exe' | 'rss' | 'cpu' | 'ai-tool' | 'tag'; width?: number; height?: number }) => Promise<TreemapLayout>
          setViewMode: (mode: ProcessViewMode) => Promise<{ success: boolean; mode: ProcessViewMode }>
        }
        csv: {
          schemaInfo: () => Promise<{ schemaName: string; columnCount: number; columns: unknown[]; header: string[] }>
          validateHeader: (header: string[]) => Promise<{ valid: boolean; missing: string[]; extra: string[]; orderErrors: unknown[] }>
          validateRow: (row: unknown) => Promise<{ success: boolean; valid: boolean; row?: CsvTaskRow18 | unknown; errors?: unknown[]; issues?: unknown[]; mode?: string }>
          listGroups: () => Promise<{ groups: CsvFileGroup[] }>
          getGroup: (groupId: string) => Promise<CsvFileGroup | null>
          reload: (force?: boolean, watch?: boolean) => Promise<{ groupCount: number; totalRows: number; validRows: number; errorCount: number; groups: CsvFileGroup[] }>
          enqueueRow: (row: unknown) => Promise<TaskRun | { taskRunId: string; task: TaskRun }>
          enqueueGroup: (groupId: string, options?: { filter?: { tags?: string[] }; concurrent?: number; resume?: boolean; forceRerun?: string[]; parallelGroupOverrides?: Record<string, number> }) => Promise<{ taskRunIds: string[]; tasks: TaskRun[]; skipped: number; rerunChanged: number }>
          generateCommand: (rowOrOptions: unknown) => Promise<unknown>
          getRunnerInfo: (kind: 'devhub' | 'python' | 'cli') => Promise<{ available: boolean; version: string | null; details: Record<string, unknown> }>
          launch: (rowOrOptions: unknown, confirmedBy?: string) => Promise<{ success: boolean; session?: CsvLaunchSession; group?: CsvFileGroup; tasks?: TaskRun[]; command?: string | null; dryRun?: boolean } | unknown>
          pause: (sessionId: string, confirmedBy?: string) => Promise<{ success: boolean; session: CsvLaunchSession }>
          resume: (sessionId: string, confirmedBy?: string) => Promise<{ success: boolean; session: CsvLaunchSession }>
          abort: (sessionId: string, confirmedBy?: string) => Promise<{ success: boolean; session: CsvLaunchSession }>
          exportTemplate: (savePath: string, confirmedBy?: string) => Promise<{ success: boolean; filePath: string; columns: number }>
          listSessions: () => Promise<unknown[]>
          listTemplates: (source?: 'builtin' | 'user') => Promise<NodeTemplate[]>
          saveTemplate: (name: string, row: unknown, confirmedBy?: string, description?: string) => Promise<{ template: NodeTemplate }>
          deleteTemplate: (id: string, confirmedBy?: string) => Promise<{ success: boolean; deleted: number; id: string }>
          lock: (csvPath: string, confirmedBy?: string) => Promise<CsvLockResult>
          unlock: (csvPath: string, confirmedBy?: string) => Promise<{ released: boolean } & CsvLockStatus>
          save: (input: { csvPath: string; rows: unknown[]; expectedMtimeMs?: number; forceWrite?: boolean; confirmedBy?: string }) => Promise<CsvSaveResult>
          onLockStatus: (callback: (status: CsvLockStatus) => void) => () => void
          onExternalChange: (callback: (payload: CsvExternalChangeEvent) => void) => () => void
          onRowStream: (callback: (payload: CsvRowStreamPayload) => void) => () => void
          onSessionEvent: (callback: (payload: CsvSessionEvent) => void) => () => void
        }
        task: {
          list: (sessionId?: string) => Promise<TaskRun[]>
          stats: (sessionId?: string) => Promise<QueueStats>
          exportResults: (request: TaskResultExportRequest) => Promise<TaskResultExportResult>
          retry: (runId: string, confirmedBy?: string) => Promise<TaskRun | null | { success: boolean; scheduled: number }>
          skip: (runId: string, confirmedBy?: string) => Promise<TaskRun | null | { success: boolean; skipped: number }>
          pauseSession: (sessionId: string, confirmedBy?: string) => Promise<{ success: boolean; sessionId: string }>
          resumeSession: (sessionId: string, confirmedBy?: string) => Promise<{ success: boolean; sessionId: string }>
          abortSession: (sessionId: string, confirmedBy?: string) => Promise<{ success: boolean; sessionId: string }>
          onStateStream: (callback: (payload: TaskStateStreamPayload) => void) => () => void
        }
        dag: {
          build: (graph: unknown) => Promise<unknown>
          detectCycle: (graph: unknown) => Promise<{ hasCycle: boolean; cycles: string[][]; cyclePaths?: string[][] }>
          export: (sessionId: string, format: 'dot' | 'mermaid' | 'cytoscape') => Promise<{ content: string; mimeType: string; format: 'dot' | 'mermaid' | 'cytoscape'; sessionId: string }>
          layer: (sessionId: string, layerIndex: number) => Promise<{ taskIds: string[] }>
          checkReady: (graph: unknown) => Promise<unknown>
        }
        watchdog: {
          status: () => Promise<WatchdogStatus>
          configure: (config: Partial<WatchdogStatus>) => Promise<WatchdogStatus>
          history: () => Promise<unknown[]>
          overrideRestart: (reason?: string, confirmedBy?: string) => Promise<unknown>
          onEventStream: (callback: (payload: WatchdogEventStreamPayload) => void) => () => void
          supervisorStatus: () => Promise<unknown>
          supervisorRespawn: (reason?: string, confirmedBy?: string) => Promise<unknown>
          supervisorInstallService: (confirmAdmin: boolean, confirmedBy?: string) => Promise<unknown>
          supervisorUninstallService: (confirmAdmin: boolean, confirmedBy?: string) => Promise<unknown>
          onSupervisorEventStream: (callback: (payload: WatchdogSupervisorEventStreamPayload) => void) => () => void
        }
        inject: {
          dryRun: (action: unknown) => Promise<InjectResult>
          execute: (action: unknown) => Promise<InjectResult>
          whitelist: (input?: { scope?: 'instance' | 'tool' | 'project-cwd' }) => Promise<Array<{ id: string; alias: string; pattern: string; scope: string; createdAt: number; reason?: string }>>
          addWhitelist: (entry: { alias?: string; scope?: 'instance' | 'tool' | 'project-cwd'; pattern?: string; scenarios?: string[]; duration?: 'session' | '24h' | '7d' | 'permanent'; reason?: string; confirmedBy?: string }) => Promise<{ id: string; alias: string; pattern: string; createdAt: number; reason?: string }>
          removeWhitelist: (id: string, confirmedBy?: string) => Promise<unknown>
          resolveTarget: (input: string | { selector?: string; aliasOrId?: string; targetAlias?: string; pid?: number; hwnd?: number; cwd?: string; scenario?: string; taskId?: string; confirmedBy?: string }) => Promise<unknown>
          readyPool: () => Promise<unknown[]>
          history: () => Promise<unknown[]>
          cancel: (injectId: string, confirmedBy?: string) => Promise<unknown>
          configureStrictMode: (config: { enabled?: boolean; applyToScenarios?: string[]; bypassForCsvMode?: boolean; confirmedBy?: string }) => Promise<unknown>
          configureCountdown: (config: { defaultMs?: number; perScenarioMs?: Record<string, number>; showProgressBar?: boolean; allowEscToCancel?: boolean; confirmedBy?: string }) => Promise<unknown>
          cancelCountdown: (actionId: string, confirmedBy?: string) => Promise<unknown>
          completeCountdown: (actionId: string, confirmedBy?: string) => Promise<unknown>
          confirmFirstTime: (input: { requestId?: string; selector?: string; aliasOrId: string; pid?: number; hwnd?: number; cwd?: string; taskId?: string; scenario?: string; scope?: 'instance' | 'tool' | 'project-cwd'; duration?: 'session' | '24h' | '7d' | 'permanent'; confirmedBy: string; reason?: string }) => Promise<unknown>
          onCountdownStream: (callback: (payload: InjectCountdownStreamPayload) => void) => () => void
          onFirstTimeRequired: (callback: (payload: InjectFirstTimeRequiredPayload) => void) => () => void
        }
        topology: {
          fullscreen: (slice?: Partial<GraphSlice>) => Promise<GraphSnapshot>
          buildGlobalGraph: (slice?: Partial<GraphSlice>) => Promise<GraphSnapshot>
          network: (slice?: Partial<GraphSlice>) => Promise<GraphSnapshot>
          neural: (slice?: Partial<GraphSlice>) => Promise<GraphSnapshot>
          saveSnapshot: (snapshotId: string, label: string, confirmedBy?: string) => Promise<{ saved: boolean; path: string }>
          listSnapshots: () => Promise<GraphSavedSnapshot[]>
          export: (snapshotId: string, format: GraphExportFormat) => Promise<GraphExportResult>
          warmGlobalScopes: (scopes: GraphSlice[]) => Promise<{ warmed: number }>
          attachedDeep10: (input?: Partial<AttachedTopologyRequest>) => Promise<AttachedTopologyResult>
          favoriteChange: (input: AttachedTopologyFavoriteChangeRequest) => Promise<AttachedTopologyFavoriteChangeResult>
          scopedFlow: (input?: { scope?: string; rootId?: string }) => Promise<unknown>
          attachedFlow: (input?: Partial<FlowRequest>) => Promise<FlowSnapshot>
          filterFlow: (input?: Partial<FlowRequest>) => Promise<FlowSnapshot>
          flowStats: (input?: Partial<FlowRequest>) => Promise<FlowStats>
          exportFlow: (input?: Partial<FlowRequest> & { format?: 'mermaid-sequence' | 'svg' }) => Promise<FlowExportResult>
          subscribeFlowEvents: (listener: (payload: FlowEventStreamPayload) => void, input?: { subscriberId?: string; request?: Partial<FlowRequest>; intervalMs?: number }) => () => void
        }
        ai: {
          signalContributions: (instanceId: string) => Promise<SignalContributionSnapshot>
          instanceState: (instanceId: string) => Promise<InstanceState>
          reportMisreport: (record: { instanceId: string; kind: string; userNote?: string; expectedTaskState?: string; reportedBy?: string; confirmedBy?: string }) => Promise<MisreportResponse>
          listMisreports: (input?: { since?: number }) => Promise<MisreportRecord[]>
          diagnosticExplain: (instanceId: string) => Promise<DiagnosticExplain>
          resetLearnedWeights: (input: { confirmedBy: string }) => Promise<ResetLearnedWeightsResponse>
          listWeightProfiles: () => Promise<WeightProfile[]>
          listStateRules: () => Promise<StateAssertionRule[]>
          overrideRule: (input: { ruleId: string; enabled: boolean; confirmedBy?: string }) => Promise<unknown>
          fusionConfig: (input?: Partial<FusionConfig>) => Promise<unknown>
          setWeightProfile: (input: { weights?: Record<string, number>; profile?: string; profileId?: string; confirmedBy?: string }) => Promise<unknown>
          claudeCostSummary: (instanceId: string) => Promise<ClaudeCostSummary>
          geminiPatternStat: (instanceId?: string) => Promise<GeminiPatternStat>
          reloadGeminiRules: (rules: GeminiPatternRuleInput[], confirmedBy?: string) => Promise<GeminiRuleReloadResponse>
          onClaudeStreamEvent: (listener: (payload: ClaudeStreamEvent) => void) => () => void
          onFusionStream: (listener: (payload: SignalContributionSnapshot) => void) => () => void
          onStateStream: (listener: (payload: StateTransitionEvent) => void) => () => void
        }
        notify: {
          emit: (notification: unknown) => Promise<NotifyEmitResponse>
          list: (input?: { since?: number; level?: NotificationLevel; includeDismissed?: boolean }) => Promise<DevhubNotification[]>
          dismiss: (notificationId: string) => Promise<{ success: boolean; notificationId: string }>
          configureAggregation: (input: NotificationAggregationConfig & { confirmedBy?: string }) => Promise<NotificationAggregationConfig & { updatedAt?: number; confirmedBy?: string | null }>
          configureChannel: (input: ChannelConfig) => Promise<ChannelConfig>
          invokeAction: (input: { id: string; actionId: string }) => Promise<{ success: boolean; id: string; actionId: string }>
          onStream: (listener: (payload: DevhubNotification) => void) => () => void
          onStatusbar: (listener: (payload: DevhubNotification) => void) => () => void
          onDesktopBell: (listener: (payload: { id: string; level: NotificationLevel; title: string }) => void) => () => void
        }
        permission: {
          ttlConfig: () => Promise<unknown[]>
          confirm: (grant: unknown) => Promise<unknown>
          allowlist: () => Promise<unknown[]>
          reset: (confirmedBy?: string) => Promise<unknown>
          request: (input: unknown) => Promise<PermissionTtlGrant>
          check: (input: unknown) => Promise<PermissionCheckResult>
          revoke: (grantId: string, confirmedBy?: string) => Promise<unknown>
          revokeAll: (confirmedBy?: string) => Promise<unknown>
          listActive: () => Promise<PermissionTtlGrant[]>
          configurePolicy: (input: unknown) => Promise<unknown>
          expiryStream: () => Promise<PermissionExpiryStreamPayload>
        }
        backup: {
          create: (request?: unknown) => Promise<BackupBundle>
          list: () => Promise<BackupBundle[]>
          restore: (inputOrBundleId: unknown, confirmedBy?: string) => Promise<unknown>
          delete: (inputOrBundleId: unknown, confirmedBy?: string) => Promise<unknown>
          configureSchedule: (request?: unknown) => Promise<unknown>
          scheduleConfig: () => Promise<unknown>
          exportClassified: (request: unknown) => Promise<unknown>
        }
        dataOwnership: {
          listPaths: () => Promise<DataOwnershipListPathsResponse>
          listEntries: (request: DataOwnershipListEntriesRequest) => Promise<DataOwnershipListEntriesResponse>
          exportAll: (request?: DataOwnershipExportAllRequest) => Promise<BackupBundle>
        }
        diagnostic: {
          export: (request?: unknown) => Promise<DiagnosticPackManifest>
          list: () => Promise<unknown[]>
          purge: (confirmedBy?: string) => Promise<unknown>
          preview: (request?: unknown) => Promise<DiagnosticPreview>
          listRedactionRules: () => Promise<unknown>
          captureScreenshot: (request?: unknown) => Promise<unknown>
          listPacks: () => Promise<unknown>
        }
        skill: {
          list: () => Promise<{ skills: Skill[]; errors: SkillLoadError[] }>
          validateYaml: (input: { yaml: string }) => Promise<unknown>
          validate: (input: { yaml: string; body?: string; script?: string }) => Promise<SkillValidationResult>
          builtinList: () => Promise<{ names: string[]; skills: Skill[] }>
          builtinFork: (name: string, targetName: string, confirmedBy?: string) => Promise<unknown>
          builtinReadme: (name: string) => Promise<{ success: boolean; error: string | null; markdown: string | null }>
          get: (name: string) => Promise<{ success: boolean; error: string | null; skill: Skill | null; text: string | null }>
          write: (input: { name?: string; text?: string; yaml?: string; body?: string; script?: string; scriptLanguage?: string; filePath?: string; confirmedBy?: string }) => Promise<unknown>
          delete: (name: string, confirmedBy?: string) => Promise<unknown>
          createFromTemplate: (input: { templateId: string; name: string; displayName: string; confirmedBy?: string }) => Promise<{ filePath: string; skill: Skill }>
          installFromPath: (sourcePath: string, confirmedBy?: string) => Promise<unknown>
          uninstall: (name: string, confirmedBy?: string) => Promise<unknown>
          templateList: () => Promise<SkillTemplate[]>
          reload: (force?: boolean, watch?: boolean) => Promise<unknown>
          onListStream: (callback: (payload: SkillListStreamPayload) => void) => () => void
          cloudSyncDisabled: () => Promise<{ success: false; code: string; message: string }>
          cloudSyncStatus: () => Promise<CloudSyncStatus>
          cloudSyncTrigger: (input: unknown) => Promise<CloudSyncResult>
          cloudSyncListRemote: () => Promise<unknown>
        }
        recovery: {
          scan: () => Promise<RecoveryReport>
          checkDirty: () => Promise<RecoveryCheckDirtyResponse>
          restoreState: (input: { snapshotId?: string; kindsToRestore: Array<RecoveryReport['findings'][number]['kind']>; confirmedBy?: string; userChoice?: 'restore-all' | 'restore-selected' | 'skip-all' | 'cancel' }) => Promise<RecoveryReport>
          listSnapshots: () => Promise<RecoverySnapshot[]>
          createCheckpoint: (reason?: RecoverySnapshot['reason']) => Promise<RecoverySnapshot>
          report: () => Promise<RecoveryReport[]>
          dismiss: (input: string | { reportId?: string; findingsToDismiss?: Array<RecoveryReport['findings'][number]['kind']> }) => Promise<RecoveryDismissResponse>
        }
        recording: {
          start: (input?: { label?: string; source?: RecordingSession['source']; confirmedBy?: string } | RecordingStartRequest) => Promise<RecordingSession | RecordingManifest>
          stop: (sessionIdOrInput: string | { recordingId?: string; sessionId?: string; confirmedBy?: string }, confirmedBy?: string) => Promise<RecordingSession | RecordingManifest | null>
          list: {
            (): Promise<RecordingSession[]>
            (filter: { sessionId?: string; taskId?: string; sinceTs?: number }): Promise<RecordingManifest[]>
          }
          manifest: (sessionIdOrInput: string | { recordingId?: string; sessionId?: string }) => Promise<unknown>
          getEvents: (input: { recordingId: string; kind?: RecordingEvent['kind'] | 'git-diff'; sinceTs?: number; limit?: number }) => Promise<RecordingEvent[]>
          getReplayState: (input: { recordingId: string; cursorTs?: number; speed?: number; paused?: boolean; enabledTracks?: RecordingStreamKind[] }) => Promise<RecordingReplayState>
          getEventsWindow: (input: { recordingId: string; sinceTs: number; untilTs: number; kinds?: RecordingStreamKind[] }) => Promise<RecordingEvent[]>
          getCast: (recordingId: string) => Promise<{ cast: AsciinemaCast }>
          listAnchors: (recordingId: string) => Promise<{ anchors: RecordingReplayState['anchors'] }>
          getScreenshot: (input: { recordingId: string; ts: number }) => Promise<RecordingScreenshotResult>
          getFsSnapshotAt: (input: { recordingId: string; ts: number }) => Promise<RecordingFsSnapshotResult>
          exportAsciinema: (recordingId: string, outPath: string) => Promise<{ filePath: string }>
          exportZip: (recordingId: string, outPath: string, redact?: boolean) => Promise<{ filePath: string }>
          delete: (recordingId: string, confirmedBy?: string) => Promise<{ deleted: boolean }>
          onEvent: (callback: (event: RecordingEvent & { recordingId: string }) => void) => () => void
          replayStart: (sessionId: string, confirmedBy?: string) => Promise<ReplayState>
          replaySeek: (replayId: string, cursorMs: number) => Promise<ReplayState | null>
          replayExport: (replayId: string) => Promise<unknown>
        }
        ocr: {
          capabilities: () => Promise<OcrCapabilities>
          recognize: (request?: unknown) => Promise<OcrDisabledResponse>
          listSupportedLanguages: () => Promise<unknown>
        }
      }

      devObs?: {
        getRuntimeMetrics: () => Promise<RuntimeMetricsSnapshot>
        getThrottleReport: () => Promise<IpcThrottleReport>
        resetMetrics: (scopes?: readonly RuntimeMetricsResetScope[]) => Promise<ResetRuntimeMetricsResponse>
        exportDiagnosticBundle: (
          request?: ExportDiagnosticBundleRequest
        ) => Promise<ExportDiagnosticBundleResponse>
      }
    }
  }
}

export {}
