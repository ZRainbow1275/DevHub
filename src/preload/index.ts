import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, Project, LogEntry, CodingTool, AppSettings, ProjectType, ProjectOpenTarget, type ThemeOption } from '@shared/types'
import type { GitInfo, ProjectDependencies } from '@shared/types-extended'
import type { FeatureFlagDefinition } from '@shared/feature-flags'
import type {
  BrowserPopout,
  ClaudeCostSummary,
  ClaudeStreamEvent,
  CliOutputEvent,
  CsvExternalChangeEvent,
  CsvLockResult,
  CsvLockStatus,
  CsvRowStreamPayload,
  CsvSaveResult,
  CsvSessionEvent,
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
  DrawerLayoutRecord,
  DrawerState,
  FlowEventStreamPayload,
  FlowEventStreamResponse,
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
  AttachedTopologyRequest,
  AttachedTopologyFavoriteChangeRequest,
  AttachedTopologyFavoriteChangeResult,
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
  RecordingEvent,
  RecordingFsSnapshotResult,
  RecordingManifest,
  RecordingReplayState,
  RecordingScreenshotResult,
  RecordingStreamKind,
  AsciinemaCast,
  RecordingSession,
  RecordingStartRequest,
  RecoveryCheckDirtyResponse,
  RecoveryDismissResponse,
  RecoveryReport,
  RecoverySnapshot,
  ReplayState,
  BlocklistEntry,
  PublicBannerState,
  SkillListStreamPayload,
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
  ToolMonitorCard,
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
  ObservabilitySubscribeResponse,
  CloudSyncResult,
  CloudSyncStatus,
  BackupBundle,
  DataOwnershipExportAllRequest,
  DataOwnershipListEntriesRequest,
  DataOwnershipListEntriesResponse,
  DataOwnershipListPathsResponse,
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
  ProcessTreeNode,
  ProcessViewMode,
  TreemapLayout,
  ZodListSchemasResponse,
  ZodMigrationStatusResponse,
  ZodValidatePayloadResponse
} from '@shared/schemas/r8-runtime'
import type {
  ExportDiagnosticBundleRequest,
  ExportDiagnosticBundleResponse,
  IpcThrottleReport,
  ResetRuntimeMetricsResponse,
  RuntimeMetricsResetScope,
  RuntimeMetricsSnapshot
} from '@shared/observability'
import { DEV_OBS_CHANNELS } from '@shared/observability'
import {
  systemProcessApi,
  portApi,
  windowApi,
  aiTaskApi,
  aiAliasApi,
  notificationApi,
  taskHistoryApi,
  scannerApi,
  topologyApi
} from './extended'

let observabilitySubscriberSeq = 0
let observabilityLocalSubscribers = 0
let flowEventSubscriberSeq = 0
let flowEventLocalSubscribers = 0

type R8CommandEvent = {
  type: string
  tab?: string
  slot?: string
  contentId?: string
  layoutName?: string
  mode?: string
  uri?: string
  graphKind?: GraphKind
  selectedNodeId?: string
  theme?: ThemeOption
}

function subscribeObservability(listener: (payload: ObservabilityMetricSample[]) => void): () => void {
  if (observabilityLocalSubscribers >= 3) {
    throw Object.assign(new Error('E_RATE_LIMITED: obs:subscribe allows at most 3 local subscribers.'), { code: 'E_RATE_LIMITED' })
  }

  observabilitySubscriberSeq += 1
  observabilityLocalSubscribers += 1
  const subscriberId = `renderer-${Date.now()}-${observabilitySubscriberSeq}`
  let disposed = false
  const wrapped = (_event: Electron.IpcRendererEvent, payload: ObservabilityMetricSample[]) => {
    listener(payload)
  }
  const cleanup = () => {
    if (disposed) {
      return
    }
    disposed = true
    observabilityLocalSubscribers = Math.max(0, observabilityLocalSubscribers - 1)
    ipcRenderer.removeListener('obs:subscribe', wrapped)
    void ipcRenderer.invoke('obs:unsubscribe', { subscriberId })
  }

  ipcRenderer.on('obs:subscribe', wrapped)
  void ipcRenderer.invoke('obs:subscribe', { subscriberId })
    .then((_response: ObservabilitySubscribeResponse) => undefined)
    .catch(() => cleanup())

  return cleanup
}

function subscribeFlowEventStream(listener: (payload: FlowEventStreamPayload) => void, input?: { subscriberId?: string; request?: Partial<FlowRequest>; intervalMs?: number }): () => void {
  if (flowEventLocalSubscribers >= 3) {
    throw Object.assign(new Error('E_RATE_LIMITED: flow:event-stream allows at most 3 local subscribers.'), { code: 'E_RATE_LIMITED' })
  }

  flowEventSubscriberSeq += 1
  flowEventLocalSubscribers += 1
  const subscriberId = `flow-renderer-${Date.now()}-${flowEventSubscriberSeq}`
  let disposed = false
  const wrapped = (_event: Electron.IpcRendererEvent, payload: FlowEventStreamPayload) => {
    if (payload.subscriberId === subscriberId) {
      listener(payload)
    }
  }
  const cleanup = () => {
    if (disposed) {
      return
    }
    disposed = true
    flowEventLocalSubscribers = Math.max(0, flowEventLocalSubscribers - 1)
    ipcRenderer.removeListener('flow:event-stream', wrapped)
    void ipcRenderer.invoke('flow:event-stream:unsubscribe', { subscriberId })
  }

  ipcRenderer.on('flow:event-stream', wrapped)
  void ipcRenderer.invoke('flow:event-stream', { ...(input ?? {}), subscriberId })
    .then((_response: FlowEventStreamResponse) => undefined)
    .catch(() => cleanup())

  return cleanup
}

const r8Api = {
  integrations: {
    listLibraries: () => ipcRenderer.invoke('integrations:list-libraries'),
    getFlag: (flag: string): Promise<boolean> => ipcRenderer.invoke('integrations:flag-get', { flag }),
    setFlag: (flag: string, value: boolean, confirmedBy?: string) => ipcRenderer.invoke('integrations:flag-set', { flag, value, confirmedBy }),
    healthCheck: () => ipcRenderer.invoke('integrations:health-check')
  },
  ipc: {
    listChannels: (): Promise<ChannelRegistration[]> => ipcRenderer.invoke('ipc:rate-limit-channel-list'),
    rateLimitStats: (): Promise<RateLimitStatsResponse> => ipcRenderer.invoke('ipc:rate-limit-stats'),
    overrideRateClass: (channel: string, rateClass: R8IpcChannelDefinition['rateClass'], confirmedBy?: string): Promise<RateLimitOverrideResponse> => ipcRenderer.invoke('ipc:override-rate-class', { channel, rateClass, confirmedBy })
  },
  obs: {
    getSnapshot: (input?: { sinceMs?: number }): Promise<ObservabilitySnapshot> => ipcRenderer.invoke('obs:get-snapshot', input),
    configure: (config: Partial<ObservabilityConfig>): Promise<{ success: boolean; config: ObservabilityConfig; effectiveSamplingHz: number }> => ipcRenderer.invoke('obs:configure', config),
    exportSnapshot: (input?: { format?: 'json' | 'csv'; destPath?: string }): Promise<ObservabilityExportSnapshotResponse> => ipcRenderer.invoke('obs:export-snapshot', input),
    exportDiagnosticPack: (input?: { includeScreenshots?: boolean }): Promise<ObservabilityDiagnosticPackResponse> => ipcRenderer.invoke('obs:export-diagnostic-pack', input),
    subscribe: subscribeObservability
  },
  cli: {
    getProgress: (input?: { tool?: string; instanceId?: string; limit?: number }): Promise<{ events: CliOutputEvent[]; latest: CliOutputEvent | null; count: number; progress: ProgressDataPoint | null }> => ipcRenderer.invoke('cli:get-progress', input),
    getSessions: (): Promise<ParseSession[]> => ipcRenderer.invoke('cli:get-sessions'),
    installShim: (tool: string, confirmedBy?: string): Promise<unknown> => ipcRenderer.invoke('cli:install-shim', { tool, confirmedBy }),
    uninstallShim: (tool: string, confirmedBy?: string): Promise<{ success: boolean; tool: string }> => ipcRenderer.invoke('shim:uninstall', { tool, confirmedBy }),
    shimStatus: (): Promise<Record<'codex' | 'claude' | 'gemini', ShimManifest | null>> => ipcRenderer.invoke('shim:status'),
    selectStrategy: (input: { sessionId?: string; instanceId?: string; strategy: ParserStrategy }): Promise<{ success: boolean; session: ParseSession }> => ipcRenderer.invoke('cli:select-strategy', input),
    detectAll: (input?: { force?: boolean }): Promise<ToolDetectionState> => ipcRenderer.invoke('cli:detect-all', input),
    detectOne: (tool: string, force?: boolean): Promise<ToolDetectResult> => ipcRenderer.invoke('cli:detect-one', { tool, force }),
    setToolOverride: (tool: string, path: string, confirmedBy?: string): Promise<ToolOverrideResponse> => ipcRenderer.invoke('cli:set-tool-override', { tool, path, confirmedBy }),
    clearToolOverride: (tool: string, confirmedBy?: string): Promise<ToolClearOverrideResponse> => ipcRenderer.invoke('cli:clear-tool-override', { tool, confirmedBy }),
    cursorCopilotStatus: (instanceId?: string) => ipcRenderer.invoke('cli:cursor-copilot-status', instanceId ? { instanceId } : undefined),
    reloadTitleRules: (rules: unknown[], confirmedBy?: string) => ipcRenderer.invoke('cli:title-rule-reload', { rules, confirmedBy }),
    onDetectionEvent: (callback: (state: ToolDetectionState) => void) => {
      const handler = (_: unknown, state: ToolDetectionState) => callback(state)
      ipcRenderer.on('cli:detection-event', handler)
      return () => ipcRenderer.removeListener('cli:detection-event', handler)
    },
    onEvent: (callback: (event: CliOutputEvent) => void) => {
      const handler = (_: unknown, event: CliOutputEvent) => callback(event)
      ipcRenderer.on('cli:event-stream', handler)
      return () => ipcRenderer.removeListener('cli:event-stream', handler)
    }
  },
  monitor: {
    open: () => ipcRenderer.invoke('monitor:open'),
    close: () => ipcRenderer.invoke('monitor:close'),
    snapshot: (): Promise<MonitorSnapshot> => ipcRenderer.invoke('monitor:snapshot'),
    setWindowPrefs: (input: { alwaysOnTop?: boolean; opacity?: number; bounds?: MonitorWindowState['bounds']; confirmedBy?: string }) => ipcRenderer.invoke('monitor:set-window-prefs', input),
    focusInstance: (tool: MonitorTool, instanceId: string) => ipcRenderer.invoke('monitor:focus-instance', { tool, instanceId }),
    openPopout: (tool: MonitorTool, layout?: MonitorPopoutLayout): Promise<{ success: boolean; popoutId: string; popout: MonitorPopout }> => ipcRenderer.invoke('monitor:popout-open', { tool, layout }),
    closePopout: (popoutId: string) => ipcRenderer.invoke('monitor:popout-close', { popoutId }),
    listPopouts: (): Promise<MonitorPopout[]> => ipcRenderer.invoke('monitor:popout-list'),
    returnPopoutToMain: (popoutId: string) => ipcRenderer.invoke('monitor:popout-return-to-main', { popoutId }),
    setPopoutLayout: (popoutId: string, layout: MonitorPopoutLayout) => ipcRenderer.invoke('monitor:popout-set-layout', { popoutId, layout }),
    onSnapshotStream: (callback: (snapshot: MonitorSnapshot) => void) => {
      const handler = (_: unknown, snapshot: MonitorSnapshot) => callback(snapshot)
      ipcRenderer.on('monitor:snapshot-stream', handler)
      return () => ipcRenderer.removeListener('monitor:snapshot-stream', handler)
    },
    onPopoutSnapshotStream: (callback: (card: ToolMonitorCard) => void) => {
      const handler = (_: unknown, card: ToolMonitorCard) => callback(card)
      ipcRenderer.on('monitor:popout-snapshot-stream', handler)
      return () => ipcRenderer.removeListener('monitor:popout-snapshot-stream', handler)
    }
  },
  zod: {
    listSchemas: (): Promise<ZodListSchemasResponse> => ipcRenderer.invoke('zod:list-schemas'),
    validatePayload: (schemaName: string, payload: unknown): Promise<ZodValidatePayloadResponse> => ipcRenderer.invoke('zod:validate-payload', { schemaName, payload }),
    migrationStatus: (): Promise<ZodMigrationStatusResponse> => ipcRenderer.invoke('zod:migration-status')
  },
  port: {
    openPopout: (input: PortPopoutOpenRequest): Promise<PortPopoutOpenResponse> => ipcRenderer.invoke('port:popout-open', input),
    closePopout: (input: PortPopoutCloseRequest): Promise<PortPopoutCloseResponse> => ipcRenderer.invoke('port:popout-close', input),
    listPopouts: (): Promise<PortPopoutListResponse> => ipcRenderer.invoke('port:popout-list'),
    getPopoutPosition: (port: number): Promise<PortPopoutPositionGetResponse> => ipcRenderer.invoke('port:popout-position-get', { port }),
    savePopoutPosition: (input: PortPopoutPositionSaveRequest): Promise<PortPopoutPositionSaveResponse> => ipcRenderer.invoke('port:popout-position-save', input),
    pinPopout: (input: PortPopoutPinRequest): Promise<PortPopoutPinResponse> => ipcRenderer.invoke('port:popout-pin', input),
    batchPopouts: (input: PortPopoutBatchRequest): Promise<PortPopoutBatchResponse> => ipcRenderer.invoke('port:popout-batch', input),
    syncPopout: (input: PortPopoutSyncRequest): Promise<PortPopoutSyncResponse> => ipcRenderer.invoke('port:popout-sync', input),
    demotePopout: (input: PortPopoutDemoteRequest): Promise<PortPopoutDemoteResponse> => ipcRenderer.invoke('port:popout-demote', input)
  },
  popout: {
    create: (request: unknown): Promise<BrowserPopout> => ipcRenderer.invoke('popout:create', request),
    close: (windowId: string) => ipcRenderer.invoke('popout:close', { windowId }),
    list: (): Promise<BrowserPopout[]> => ipcRenderer.invoke('popout:list'),
    bridgeMessage: (message: PopoutBridgeMessage) => ipcRenderer.invoke('popout:bridge-message', message),
    onBridgeMessage: (callback: (message: PopoutBridgeMessage) => void) => {
      const handler = (_: unknown, message: PopoutBridgeMessage) => callback(message)
      ipcRenderer.on('popout:bridge-message', handler)
      return () => ipcRenderer.removeListener('popout:bridge-message', handler)
    },
    onScreenEvent: (callback: (event: PopoutScreenEvent) => void) => {
      const handler = (_: unknown, event: PopoutScreenEvent) => callback(event)
      ipcRenderer.on('popout:screen-event', handler)
      return () => ipcRenderer.removeListener('popout:screen-event', handler)
    },
    pin: (windowId: string, pinned: boolean) => ipcRenderer.invoke('popout:pin', { windowId, pinned }),
    saveBounds: (windowId: string, bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('popout:save-bounds', { windowId, bounds }),
    moveToMonitor: (windowId: string, monitorIndex: number) => ipcRenderer.invoke('popout:move-to-monitor', { windowId, monitorIndex }),
    promoteFromFloating: (floatingId: string, input?: { bounds?: { x: number; y: number; width: number; height: number }; alwaysOnTop?: boolean }) => ipcRenderer.invoke('popout:promote-from-floating', { floatingId, ...input }),
    demote: (windowId: string) => ipcRenderer.invoke('popout:demote', { windowId })
  },
  drawer: {
    getState: (): Promise<DrawerState[]> => ipcRenderer.invoke('drawer:get-state'),
    setState: (state: unknown): Promise<DrawerState> => ipcRenderer.invoke('drawer:set-state', state),
    saveLayout: (name: string, states?: unknown): Promise<DrawerLayoutRecord> => ipcRenderer.invoke('drawer:save-layout', { name, states }),
    loadLayout: (name: string): Promise<DrawerLayoutRecord> => ipcRenderer.invoke('drawer:load-layout', { name }),
    listLayouts: (): Promise<DrawerLayoutRecord[]> => ipcRenderer.invoke('drawer:list-layouts'),
    morphToPopout: (slot: string, contentId?: string): Promise<{ popoutId: string }> => ipcRenderer.invoke('drawer:morph-to-popout', { slot, contentId }),
    morphFromPopout: (popoutId: string, slot: string): Promise<{ drawerState: DrawerState }> => ipcRenderer.invoke('drawer:morph-from-popout', { popoutId, slot })
  },
  command: {
    list: (): Promise<CommandPaletteEntry[]> => ipcRenderer.invoke('command:list'),
    invoke: (commandId: string, args?: unknown, confirmedBy?: string) => ipcRenderer.invoke('command:invoke', { commandId, args, confirmedBy }),
    resolveUri: (uri: string): Promise<CommandResolvedUri> => ipcRenderer.invoke('command:resolve-uri', { uri }),
    registerOsProtocol: (register: boolean, confirmedBy: string): Promise<CommandRegisterOsProtocolResult> => ipcRenderer.invoke('command:register-os-protocol', { register, confirmedBy }),
    history: (): Promise<CommandHistoryEntry[]> => ipcRenderer.invoke('command:history-list'),
    addHistory: (entry: CommandHistoryEntry): Promise<CommandHistoryEntry> => ipcRenderer.invoke('command:history-add', entry),
    clearHistory: (confirmedBy: string) => ipcRenderer.invoke('command:history-clear', { confirmedBy }),
    listCustom: (): Promise<CustomCommandListResponse> => ipcRenderer.invoke('command:list-custom'),
    saveCustom: (command: Pick<CustomCommand, 'id' | 'label' | 'handlerScript'> & Partial<Pick<CustomCommand, 'enabled' | 'shortcut' | 'confirmedBy'>>): Promise<CustomCommandSaveResult> => ipcRenderer.invoke('command:save-custom', command),
    onEvent: (callback: (event: R8CommandEvent) => void) => {
      const handler = (_: unknown, event: R8CommandEvent) => callback(event)
      ipcRenderer.on('r8:command-event', handler)
      return () => ipcRenderer.removeListener('r8:command-event', handler)
    }
  },
  dashboard: {
    getLayout: (name?: string): Promise<DashboardLayoutResponse> => ipcRenderer.invoke('dashboard:get-layout', { name }),
    saveLayout: (layout: DashboardLayout): Promise<DashboardSaveLayoutResult> => ipcRenderer.invoke('dashboard:save-layout', layout),
    listPresets: (): Promise<DashboardListPresetsResponse> => ipcRenderer.invoke('dashboard:list-presets'),
    deletePreset: (name: string, confirmedBy?: string): Promise<{ success: boolean; name: string }> => ipcRenderer.invoke('dashboard:delete-preset', { name, confirmedBy }),
    reset: (preset?: string, confirmedBy?: string): Promise<DashboardLayoutResponse> => ipcRenderer.invoke('dashboard:reset', { preset, confirmedBy }),
    morphWidgetToDrawer: (widgetInstanceId: string, slot: 'right' | 'bottom'): Promise<DashboardMorphWidgetToDrawerResult> => ipcRenderer.invoke('dashboard:morph-widget-to-drawer', { widgetInstanceId, slot })
  },
  status: {
    aggregate: (): Promise<StatusAggregate> => ipcRenderer.invoke('status:aggregate'),
    onAggregate: (callback: (aggregate: StatusAggregate) => void) => {
      const handler = (_: unknown, aggregate: StatusAggregate) => callback(aggregate)
      ipcRenderer.on('status:aggregate', handler)
      return () => ipcRenderer.removeListener('status:aggregate', handler)
    }
  },
  statusbar: {
    getConfig: (): Promise<StatusbarConfig> => ipcRenderer.invoke('statusbar:get-config'),
    setConfig: (config: StatusbarConfig): Promise<StatusbarConfig> => ipcRenderer.invoke('statusbar:set-config', config),
    reset: (confirmedBy: string): Promise<StatusbarConfig> => ipcRenderer.invoke('statusbar:reset', { confirmedBy })
  },
  themeDecoration: {
    list: (): Promise<ThemeDecorationListResponse> => ipcRenderer.invoke('theme:decoration-list'),
    set: (config: ThemeDecorationConfig): Promise<ThemeDecorationConfig> => ipcRenderer.invoke('theme:decoration-set', config),
    uploadCustomSvg: (name: string, content: string, confirmedBy?: string): Promise<CustomSvgUploadResponse> => ipcRenderer.invoke('theme:custom-svg-upload', { name, content, confirmedBy }),
    listCustomSvg: (): Promise<CustomSvgListResponse> => ipcRenderer.invoke('theme:custom-svg-list'),
    removeCustomSvg: (id: string, confirmedBy?: string): Promise<CustomSvgRemoveResponse> => ipcRenderer.invoke('theme:custom-svg-remove', { id, confirmedBy }),
    getSoundConfig: (themeId: ThemeSoundConfig['themeId']): Promise<ThemeSoundConfig> => ipcRenderer.invoke('theme:sound-config-get', { themeId }),
    setSoundConfig: (config: ThemeSoundConfig): Promise<ThemeSoundConfigResponse> => ipcRenderer.invoke('theme:sound-config', config),
    getCustomSvgContent: async (id: string): Promise<CustomSvgEntry | null> => {
      const response = await ipcRenderer.invoke('theme:custom-svg-list') as CustomSvgListResponse
      return response.items.find(item => item.id === id) ?? null
    }
  },
  a11y: {
    getPrefs: (): Promise<A11yPrefs> => ipcRenderer.invoke('a11y:get-prefs'),
    setPrefs: (prefs: A11yPrefs): Promise<A11yPrefs> => ipcRenderer.invoke('a11y:set-prefs', prefs),
    osPrefs: (): Promise<A11yOsPrefs> => ipcRenderer.invoke('a11y:os-prefs'),
    runSelfCheck: (): Promise<A11ySelfCheckResult> => ipcRenderer.invoke('a11y:run-self-check')
  },
  icon: {
    listLibraries: (): Promise<IconListLibrariesResponse> => ipcRenderer.invoke('icon:list-libraries'),
    resolveToken: (token: `${IconLibrary}:${string}`): Promise<IconResolveResponse> => ipcRenderer.invoke('icon:resolve-token', { token })
  },
  portSecurity: {
    classify: (port: number, ip?: string): Promise<SecurityTier> => ipcRenderer.invoke('port:security-tier', { port, ip }),
    listBlocklist: (): Promise<BlocklistEntry[]> => ipcRenderer.invoke('port:blocklist-list'),
    addBlocklist: (entry: { ip?: string; port?: number; reason?: string; confirmedBy?: string }): Promise<BlocklistEntry> => ipcRenderer.invoke('port:blocklist-add', entry),
    removeBlocklist: (entry: { id?: string; ip?: string; port?: number; confirmedBy?: string }): Promise<{ success: boolean; removed: number; remaining: number }> => ipcRenderer.invoke('port:blocklist-remove', entry),
    resetBlocklist: (confirmedBy?: string): Promise<{ defaults: BlocklistEntry[]; clearedUserEntries: number; resetAt: number }> => ipcRenderer.invoke('port:blocklist-reset', { confirmedBy }),
    publicBannerState: (): Promise<PublicBannerState> => ipcRenderer.invoke('port:public-banner-state')
  },
  processViews: {
    tree: (input?: { rootPid?: number; maxDepth?: number }): Promise<{ tree: ProcessTreeNode }> => ipcRenderer.invoke('process:tree', input),
    treeChildren: (pid: number): Promise<{ children: ProcessTreeNode[] }> => ipcRenderer.invoke('process:tree-children', { pid }),
    treemapData: (input?: { groupBy?: 'none' | 'parent' | 'exe' | 'ai-tool'; colorBy?: 'exe' | 'rss' | 'cpu' | 'ai-tool' | 'tag'; width?: number; height?: number }): Promise<TreemapLayout> => ipcRenderer.invoke('process:treemap-data', input),
    setViewMode: (mode: ProcessViewMode): Promise<{ success: boolean; mode: ProcessViewMode }> => ipcRenderer.invoke('process:view-mode-set', { mode })
  },
  csv: {
    schemaInfo: () => ipcRenderer.invoke('csv:schema-info'),
    validateHeader: (header: string[]) => ipcRenderer.invoke('csv:validate-header', { header }),
    validateRow: (row: unknown) => ipcRenderer.invoke('csv:validate-row', row),
    listGroups: () => ipcRenderer.invoke('csv:list-groups'),
    getGroup: (groupId: string) => ipcRenderer.invoke('csv:get-group', { groupId }),
    reload: (force?: boolean, watch?: boolean) => ipcRenderer.invoke('csv:reload', { force, watch }),
    enqueueRow: (row: unknown): Promise<TaskRun> => ipcRenderer.invoke('csv:enqueue-row', row),
    enqueueGroup: (groupId: string, options?: { filter?: { tags?: string[] }; concurrent?: number; resume?: boolean; forceRerun?: string[]; parallelGroupOverrides?: Record<string, number> }) => ipcRenderer.invoke('csv:enqueue-group', { groupId, ...options }),
    generateCommand: (rowOrOptions: unknown) => ipcRenderer.invoke('csv:generate-cli-command', rowOrOptions),
    getRunnerInfo: (kind: 'devhub' | 'python' | 'cli') => ipcRenderer.invoke('csv:get-runner-info', { kind }),
    launch: (rowOrOptions: unknown, confirmedBy?: string) => {
      const value = typeof rowOrOptions === 'object' && rowOrOptions !== null && 'csvPath' in rowOrOptions
        ? { ...(rowOrOptions as Record<string, unknown>), confirmedBy }
        : { row: rowOrOptions, confirmedBy }
      return ipcRenderer.invoke('csv:launch', value)
    },
    pause: (sessionId: string, confirmedBy?: string) => ipcRenderer.invoke('csv:pause', { sessionId, confirmedBy }),
    resume: (sessionId: string, confirmedBy?: string) => ipcRenderer.invoke('csv:resume', { sessionId, confirmedBy }),
    abort: (sessionId: string, confirmedBy?: string) => ipcRenderer.invoke('csv:abort', { sessionId, confirmedBy }),
    exportTemplate: (savePath: string, confirmedBy?: string) => ipcRenderer.invoke('csv:export-template', { savePath, confirmedBy }),
    listSessions: () => ipcRenderer.invoke('csv:list-sessions'),
    listTemplates: (source?: 'builtin' | 'user'): Promise<NodeTemplate[]> => ipcRenderer.invoke('csv:list-templates', { source }),
    saveTemplate: (name: string, row: unknown, confirmedBy?: string, description?: string) => ipcRenderer.invoke('csv:save-template', { name, row, confirmedBy, description }),
    deleteTemplate: (id: string, confirmedBy?: string) => ipcRenderer.invoke('csv:delete-template', { id, confirmedBy }),
    lock: (csvPath: string, confirmedBy?: string): Promise<CsvLockResult> => ipcRenderer.invoke('csv:lock', { csvPath, confirmedBy }),
    unlock: (csvPath: string, confirmedBy?: string) => ipcRenderer.invoke('csv:unlock', { csvPath, confirmedBy }),
    save: (input: { csvPath: string; rows: unknown[]; expectedMtimeMs?: number; forceWrite?: boolean; confirmedBy?: string }): Promise<CsvSaveResult> => ipcRenderer.invoke('csv:save', input),
    onLockStatus: (callback: (status: CsvLockStatus) => void) => {
      const handler = (_: unknown, status: CsvLockStatus) => callback(status)
      ipcRenderer.on('csv:lock-status-stream', handler)
      return () => ipcRenderer.removeListener('csv:lock-status-stream', handler)
    },
    onExternalChange: (callback: (payload: CsvExternalChangeEvent) => void) => {
      const handler = (_: unknown, payload: CsvExternalChangeEvent) => callback(payload)
      ipcRenderer.on('csv:external-change-stream', handler)
      return () => ipcRenderer.removeListener('csv:external-change-stream', handler)
    },
    onRowStream: (callback: (payload: CsvRowStreamPayload) => void) => {
      const handler = (_: unknown, payload: CsvRowStreamPayload) => callback(payload)
      ipcRenderer.on('csv:row-stream', handler)
      return () => ipcRenderer.removeListener('csv:row-stream', handler)
    },
    onSessionEvent: (callback: (payload: CsvSessionEvent) => void) => {
      const handler = (_: unknown, payload: CsvSessionEvent) => callback(payload)
      ipcRenderer.on('csv:session-event-stream', handler)
      return () => ipcRenderer.removeListener('csv:session-event-stream', handler)
    }
  },
  task: {
    list: (sessionId?: string): Promise<TaskRun[]> => ipcRenderer.invoke('task:list', { sessionId }),
    stats: (sessionId?: string): Promise<QueueStats> => ipcRenderer.invoke('task:get-stats', { sessionId }),
    exportResults: (request: TaskResultExportRequest): Promise<TaskResultExportResult> => ipcRenderer.invoke('task:export-results', request),
    retry: (runId: string, confirmedBy?: string) => ipcRenderer.invoke('task:retry', { runId, confirmedBy }),
    skip: (runId: string, confirmedBy?: string) => ipcRenderer.invoke('task:skip', { runId, confirmedBy }),
    pauseSession: (sessionId: string, confirmedBy?: string) => ipcRenderer.invoke('task:pause-session', { sessionId, confirmedBy }),
    resumeSession: (sessionId: string, confirmedBy?: string) => ipcRenderer.invoke('task:resume-session', { sessionId, confirmedBy }),
    abortSession: (sessionId: string, confirmedBy?: string) => ipcRenderer.invoke('task:abort-session', { sessionId, confirmedBy }),
    onStateStream: (callback: (payload: TaskStateStreamPayload) => void) => {
      const handler = (_: unknown, payload: TaskStateStreamPayload) => callback(payload)
      ipcRenderer.on('task:state-stream', handler)
      return () => ipcRenderer.removeListener('task:state-stream', handler)
    }
  },
  dag: {
    build: (graph: unknown) => ipcRenderer.invoke('dag:build', graph),
    detectCycle: (graph: unknown) => ipcRenderer.invoke('dag:detect-cycle', graph),
    export: (sessionId: string, format: 'dot' | 'mermaid' | 'cytoscape') => ipcRenderer.invoke('dag:export', { sessionId, format }),
    layer: (sessionId: string, layerIndex: number) => ipcRenderer.invoke('dag:layer', { sessionId, layerIndex }),
    checkReady: (graph: unknown) => ipcRenderer.invoke('dag:check-ready', graph)
  },
  watchdog: {
    status: (): Promise<WatchdogStatus> => ipcRenderer.invoke('watchdog:status'),
    configure: (config: Partial<WatchdogStatus>) => ipcRenderer.invoke('watchdog:configure', config),
    history: () => ipcRenderer.invoke('watchdog:get-history'),
    overrideRestart: (reason?: string, confirmedBy?: string) => ipcRenderer.invoke('watchdog:override-restart', { reason, confirmedBy }),
    onEventStream: (callback: (payload: WatchdogEventStreamPayload) => void) => {
      const handler = (_: unknown, payload: WatchdogEventStreamPayload) => callback(payload)
      ipcRenderer.on('watchdog:event-stream', handler)
      return () => ipcRenderer.removeListener('watchdog:event-stream', handler)
    },
    supervisorStatus: () => ipcRenderer.invoke('watchdog-supervisor:status'),
    supervisorRespawn: (reason?: string, confirmedBy?: string) => ipcRenderer.invoke('watchdog-supervisor:respawn', { reason, confirmedBy }),
    supervisorInstallService: (confirmAdmin: boolean, confirmedBy?: string) => ipcRenderer.invoke('watchdog-supervisor:install-service', { confirmAdmin, confirmedBy }),
    supervisorUninstallService: (confirmAdmin: boolean, confirmedBy?: string) => ipcRenderer.invoke('watchdog-supervisor:uninstall-service', { confirmAdmin, confirmedBy }),
    onSupervisorEventStream: (callback: (payload: WatchdogSupervisorEventStreamPayload) => void) => {
      const handler = (_: unknown, payload: WatchdogSupervisorEventStreamPayload) => callback(payload)
      ipcRenderer.on('watchdog-supervisor:event-stream', handler)
      return () => ipcRenderer.removeListener('watchdog-supervisor:event-stream', handler)
    }
  },
  inject: {
    dryRun: (action: unknown): Promise<InjectResult> => ipcRenderer.invoke('inject:dry-run', action),
    execute: (action: unknown): Promise<InjectResult> => ipcRenderer.invoke('inject:execute', action),
    whitelist: (input?: { scope?: 'instance' | 'tool' | 'project-cwd' }) => ipcRenderer.invoke('inject:get-whitelist', input),
    addWhitelist: (entry: { alias?: string; scope?: 'instance' | 'tool' | 'project-cwd'; pattern?: string; scenarios?: string[]; duration?: 'session' | '24h' | '7d' | 'permanent'; reason?: string; confirmedBy?: string }) => ipcRenderer.invoke('inject:add-whitelist', entry),
    removeWhitelist: (id: string, confirmedBy?: string) => ipcRenderer.invoke('inject:remove-whitelist', { id, confirmedBy }),
    resolveTarget: (input: string | { selector?: string; aliasOrId?: string; targetAlias?: string; pid?: number; hwnd?: number; cwd?: string; scenario?: string; taskId?: string; confirmedBy?: string }) => ipcRenderer.invoke('inject:resolve-target', typeof input === 'string' ? { targetAlias: input } : input),
    readyPool: () => ipcRenderer.invoke('inject:get-ready-pool'),
    history: () => ipcRenderer.invoke('inject:history'),
    cancel: (injectId: string, confirmedBy?: string) => ipcRenderer.invoke('inject:cancel', { injectId, confirmedBy }),
    configureStrictMode: (config: { enabled?: boolean; applyToScenarios?: string[]; bypassForCsvMode?: boolean; confirmedBy?: string }) => ipcRenderer.invoke('inject:configure-strict-mode', config),
    configureCountdown: (config: { defaultMs?: number; perScenarioMs?: Record<string, number>; showProgressBar?: boolean; allowEscToCancel?: boolean; confirmedBy?: string }) => ipcRenderer.invoke('inject:configure-countdown', config),
    cancelCountdown: (actionId: string, confirmedBy?: string) => ipcRenderer.invoke('inject:countdown-cancel', { actionId, confirmedBy }),
    completeCountdown: (actionId: string, confirmedBy?: string) => ipcRenderer.invoke('inject:countdown-complete', { actionId, confirmedBy }),
    confirmFirstTime: (input: { requestId?: string; selector?: string; aliasOrId: string; pid?: number; hwnd?: number; cwd?: string; taskId?: string; scenario?: string; scope?: 'instance' | 'tool' | 'project-cwd'; duration?: 'session' | '24h' | '7d' | 'permanent'; confirmedBy: string; reason?: string }) => ipcRenderer.invoke('inject:first-time-confirm', input),
    onCountdownStream: (callback: (payload: InjectCountdownStreamPayload) => void) => {
      const handler = (_: unknown, payload: InjectCountdownStreamPayload) => callback(payload)
      ipcRenderer.on('inject:countdown-stream', handler)
      return () => ipcRenderer.removeListener('inject:countdown-stream', handler)
    },
    onFirstTimeRequired: (callback: (payload: InjectFirstTimeRequiredPayload) => void) => {
      const handler = (_: unknown, payload: InjectFirstTimeRequiredPayload) => callback(payload)
      ipcRenderer.on('inject:first-time-required', handler)
      return () => ipcRenderer.removeListener('inject:first-time-required', handler)
    }
  },
  topology: {
    fullscreen: (slice?: Partial<GraphSlice>): Promise<GraphSnapshot> => ipcRenderer.invoke('topology:global:get-fullscreen', slice),
    buildGlobalGraph: (slice?: Partial<GraphSlice>): Promise<GraphSnapshot> => ipcRenderer.invoke('topology:build-global-graph', slice),
    network: (slice?: Partial<GraphSlice>): Promise<GraphSnapshot> => ipcRenderer.invoke('topology:network', slice),
    neural: (slice?: Partial<GraphSlice>): Promise<GraphSnapshot> => ipcRenderer.invoke('topology:neural', slice),
    saveSnapshot: (snapshotId: string, label: string, confirmedBy?: string): Promise<{ saved: boolean; path: string }> => ipcRenderer.invoke('topology:save-snapshot', { snapshotId, label, confirmedBy }),
    listSnapshots: (): Promise<GraphSavedSnapshot[]> => ipcRenderer.invoke('topology:list-snapshots'),
    export: (snapshotId: string, format: GraphExportFormat): Promise<GraphExportResult> => ipcRenderer.invoke('topology:export', { snapshotId, format }),
    warmGlobalScopes: (scopes: GraphSlice[]): Promise<{ warmed: number }> => ipcRenderer.invoke('topology:warm-scope-global', { scopes }),
    attachedDeep10: (input?: Partial<AttachedTopologyRequest>): Promise<AttachedTopologyResult> => ipcRenderer.invoke('topology:attached:get-deep10', input),
    favoriteChange: (input: AttachedTopologyFavoriteChangeRequest): Promise<AttachedTopologyFavoriteChangeResult> => ipcRenderer.invoke('topology:attached:favorite-change', input),
    scopedFlow: (input?: { scope?: string; rootId?: string }) => ipcRenderer.invoke('flow:build-scoped-flow', input),
    attachedFlow: (input?: Partial<FlowRequest>): Promise<FlowSnapshot> => ipcRenderer.invoke('flow:get-attached', input),
    filterFlow: (input?: Partial<FlowRequest>): Promise<FlowSnapshot> => ipcRenderer.invoke('flow:filter-edges', input),
    flowStats: (input?: Partial<FlowRequest>): Promise<FlowStats> => ipcRenderer.invoke('flow:scoped-stats', input),
    exportFlow: (input?: Partial<FlowRequest> & { format?: 'mermaid-sequence' | 'svg' }): Promise<FlowExportResult> => ipcRenderer.invoke('flow:export-timeline', input),
    subscribeFlowEvents: subscribeFlowEventStream
  },
  ai: {
    signalContributions: (instanceId: string): Promise<SignalContributionSnapshot> => ipcRenderer.invoke('ai:get-signal-contributions', { instanceId }),
    instanceState: (instanceId: string): Promise<InstanceState> => ipcRenderer.invoke('ai:get-instance-state', { instanceId }),
    reportMisreport: (record: { instanceId: string; kind: string; userNote?: string; expectedTaskState?: string; reportedBy?: string; confirmedBy?: string }): Promise<MisreportResponse> => ipcRenderer.invoke('ai:report-misreport', record),
    listMisreports: (input?: { since?: number }): Promise<MisreportRecord[]> => ipcRenderer.invoke('ai:list-misreports', input),
    diagnosticExplain: (instanceId: string): Promise<DiagnosticExplain> => ipcRenderer.invoke('ai:get-diagnostic-explain', { instanceId }),
    resetLearnedWeights: (input: { confirmedBy: string }): Promise<ResetLearnedWeightsResponse> => ipcRenderer.invoke('ai:reset-learned-weights', input),
    listWeightProfiles: (): Promise<WeightProfile[]> => ipcRenderer.invoke('ai:list-weight-profiles'),
    listStateRules: (): Promise<StateAssertionRule[]> => ipcRenderer.invoke('ai:list-state-rules'),
    overrideRule: (input: { ruleId: string; enabled: boolean; confirmedBy?: string }) => ipcRenderer.invoke('ai:override-rule', input),
    fusionConfig: (input?: Partial<FusionConfig>) => ipcRenderer.invoke('ai:fusion-config', input),
    setWeightProfile: (input: { weights?: Record<string, number>; profile?: string; profileId?: string; confirmedBy?: string }) => ipcRenderer.invoke('ai:set-weight-profile', input),
    claudeCostSummary: (instanceId: string): Promise<ClaudeCostSummary> => ipcRenderer.invoke('ai:claude-cost-summary', { instanceId }),
    geminiPatternStat: (instanceId?: string): Promise<GeminiPatternStat> => ipcRenderer.invoke('ai:gemini-pattern-stat', instanceId ? { instanceId } : {}),
    reloadGeminiRules: (rules: GeminiPatternRuleInput[], confirmedBy?: string): Promise<GeminiRuleReloadResponse> => ipcRenderer.invoke('ai:gemini-rule-reload', { rules, confirmedBy }),
    onClaudeStreamEvent: (listener: (payload: ClaudeStreamEvent) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: ClaudeStreamEvent) => listener(payload)
      ipcRenderer.on('ai:claude-stream-event', wrapped)
      return () => ipcRenderer.removeListener('ai:claude-stream-event', wrapped)
    },
    onFusionStream: (listener: (payload: SignalContributionSnapshot) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: SignalContributionSnapshot) => listener(payload)
      ipcRenderer.on('ai:fusion-stream', wrapped)
      return () => ipcRenderer.removeListener('ai:fusion-stream', wrapped)
    },
    onStateStream: (listener: (payload: StateTransitionEvent) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: StateTransitionEvent) => listener(payload)
      ipcRenderer.on('ai:state-stream', wrapped)
      return () => ipcRenderer.removeListener('ai:state-stream', wrapped)
    }
  },
  notify: {
    emit: (notification: unknown): Promise<NotifyEmitResponse> => ipcRenderer.invoke('notify:emit', notification),
    list: (input?: { since?: number; level?: NotificationLevel; includeDismissed?: boolean }): Promise<DevhubNotification[]> => ipcRenderer.invoke('notify:list', input),
    dismiss: (notificationId: string) => ipcRenderer.invoke('notify:dismiss', { notificationId }),
    configureAggregation: (input: NotificationAggregationConfig & { confirmedBy?: string }) => ipcRenderer.invoke('notify:configure-aggregation', input),
    configureChannel: (input: ChannelConfig): Promise<ChannelConfig> => ipcRenderer.invoke('notify:configure-channel', input),
    invokeAction: (input: { id: string; actionId: string }) => ipcRenderer.invoke('notify:invoke-action', input),
    onStream: (listener: (payload: DevhubNotification) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: DevhubNotification) => listener(payload)
      ipcRenderer.on('notify:stream', wrapped)
      return () => ipcRenderer.removeListener('notify:stream', wrapped)
    },
    onStatusbar: (listener: (payload: DevhubNotification) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: DevhubNotification) => listener(payload)
      ipcRenderer.on('notify:statusbar', wrapped)
      return () => ipcRenderer.removeListener('notify:statusbar', wrapped)
    },
    onDesktopBell: (listener: (payload: { id: string; level: NotificationLevel; title: string }) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: { id: string; level: NotificationLevel; title: string }) => listener(payload)
      ipcRenderer.on('notify:desktop-bell', wrapped)
      return () => ipcRenderer.removeListener('notify:desktop-bell', wrapped)
    }
  },
  permission: {
    ttlConfig: () => ipcRenderer.invoke('permission:ttl-config'),
    confirm: (grant: unknown) => ipcRenderer.invoke('permission:confirm', grant),
    allowlist: () => ipcRenderer.invoke('permission:allowlist'),
    reset: (confirmedBy?: string) => ipcRenderer.invoke('permission:reset', { confirmedBy }),
    request: (input: unknown): Promise<PermissionTtlGrant> => ipcRenderer.invoke('permission:request', input),
    check: (input: unknown): Promise<PermissionCheckResult> => ipcRenderer.invoke('permission:check', input),
    revoke: (grantId: string, confirmedBy?: string) => ipcRenderer.invoke('permission:revoke', { grantId, confirmedBy }),
    revokeAll: (confirmedBy?: string) => ipcRenderer.invoke('permission:revoke-all', { confirmedBy }),
    listActive: (): Promise<PermissionTtlGrant[]> => ipcRenderer.invoke('permission:list-active'),
    configurePolicy: (input: unknown) => ipcRenderer.invoke('permission:configure-policy', input),
    expiryStream: (): Promise<PermissionExpiryStreamPayload> => ipcRenderer.invoke('permission:expiry-stream')
  },
  backup: {
    create: (request?: unknown): Promise<BackupBundle> => ipcRenderer.invoke('backup:create', request),
    list: (): Promise<BackupBundle[]> => ipcRenderer.invoke('backup:list'),
    restore: (inputOrBundleId: unknown, confirmedBy?: string) => ipcRenderer.invoke(
      'backup:restore',
      typeof inputOrBundleId === 'string' ? { bundleId: inputOrBundleId, confirmedBy } : inputOrBundleId
    ),
    delete: (inputOrBundleId: unknown, confirmedBy?: string) => ipcRenderer.invoke(
      'backup:delete',
      typeof inputOrBundleId === 'string' ? { bundleId: inputOrBundleId, confirmedBy } : inputOrBundleId
    ),
    configureSchedule: (request?: unknown) => ipcRenderer.invoke('backup:configure-schedule', request),
    scheduleConfig: () => ipcRenderer.invoke('backup:schedule-config'),
    exportClassified: (request: unknown) => ipcRenderer.invoke('backup:export-classified', request)
  },
  dataOwnership: {
    listPaths: (): Promise<DataOwnershipListPathsResponse> => ipcRenderer.invoke('data-ownership:list-paths'),
    listEntries: (request: DataOwnershipListEntriesRequest): Promise<DataOwnershipListEntriesResponse> => ipcRenderer.invoke('data-ownership:list-entries', request),
    exportAll: (request?: DataOwnershipExportAllRequest): Promise<BackupBundle> => ipcRenderer.invoke('data-ownership:export-all', request)
  },
  diagnostic: {
    export: (request?: unknown): Promise<DiagnosticPackManifest> => ipcRenderer.invoke('diagnostic:export', request),
    list: () => ipcRenderer.invoke('diagnostic:list'),
    purge: (confirmedBy?: string) => ipcRenderer.invoke('diagnostic:purge', { confirmedBy }),
    preview: (request?: unknown): Promise<DiagnosticPreview> => ipcRenderer.invoke('diagnostic:preview', request),
    listRedactionRules: () => ipcRenderer.invoke('diagnostic:list-redaction-rules'),
    captureScreenshot: (request?: unknown) => ipcRenderer.invoke('diagnostic:capture-screenshot', request),
    listPacks: () => ipcRenderer.invoke('diagnostic:list-packs')
  },
  skill: {
    list: () => ipcRenderer.invoke('skill:list'),
    validateYaml: (input: { yaml: string }) => ipcRenderer.invoke('skill:validate-yaml', input),
    validate: (input: { yaml: string; body?: string; script?: string }) => ipcRenderer.invoke('skill:validate', input),
    builtinList: () => ipcRenderer.invoke('skill:builtin-list'),
    builtinFork: (name: string, targetName: string, confirmedBy?: string) => ipcRenderer.invoke('skill:builtin-fork', { name, targetName, confirmedBy }),
    builtinReadme: (name: string) => ipcRenderer.invoke('skill:builtin-readme', { name }),
    get: (name: string) => ipcRenderer.invoke('skill:get', { name }),
    write: (input: { name?: string; text?: string; yaml?: string; body?: string; script?: string; scriptLanguage?: string; filePath?: string; confirmedBy?: string }) => ipcRenderer.invoke('skill:write', input),
    delete: (name: string, confirmedBy?: string) => ipcRenderer.invoke('skill:delete', { name, confirmedBy }),
    createFromTemplate: (input: { templateId: string; name: string; displayName: string; confirmedBy?: string }) => ipcRenderer.invoke('skill:create-from-template', input),
    installFromPath: (sourcePath: string, confirmedBy?: string) => ipcRenderer.invoke('skill:install-from-path', { sourcePath, confirmedBy }),
    uninstall: (name: string, confirmedBy?: string) => ipcRenderer.invoke('skill:uninstall', { name, confirmedBy }),
    templateList: () => ipcRenderer.invoke('skill:template-list'),
    reload: (force?: boolean, watch?: boolean) => ipcRenderer.invoke('skill:reload', { force, watch }),
    onListStream: (callback: (payload: SkillListStreamPayload) => void) => {
      const handler = (_: unknown, payload: SkillListStreamPayload) => callback(payload)
      ipcRenderer.on('skill:list-stream', handler)
      return () => ipcRenderer.removeListener('skill:list-stream', handler)
    },
    cloudSyncDisabled: () => ipcRenderer.invoke('skill:cloud-sync-disabled'),
    cloudSyncStatus: (): Promise<CloudSyncStatus> => ipcRenderer.invoke('skill:cloud-sync-status'),
    cloudSyncTrigger: (input: unknown): Promise<CloudSyncResult> => ipcRenderer.invoke('skill:cloud-sync-trigger', input),
    cloudSyncListRemote: () => ipcRenderer.invoke('skill:cloud-sync-list-remote')
  },
  recovery: {
    scan: (): Promise<RecoveryReport> => ipcRenderer.invoke('recovery:scan'),
    checkDirty: (): Promise<RecoveryCheckDirtyResponse> => ipcRenderer.invoke('recovery:check-dirty', {}),
    restoreState: (input: { snapshotId?: string; kindsToRestore: Array<RecoveryReport['findings'][number]['kind']>; confirmedBy?: string; userChoice?: 'restore-all' | 'restore-selected' | 'skip-all' | 'cancel' }): Promise<RecoveryReport> => ipcRenderer.invoke('recovery:restore-state', input),
    listSnapshots: (): Promise<RecoverySnapshot[]> => ipcRenderer.invoke('recovery:list-snapshots'),
    createCheckpoint: (reason?: RecoverySnapshot['reason']): Promise<RecoverySnapshot> => ipcRenderer.invoke('recovery:create-checkpoint', { reason }),
    report: (): Promise<RecoveryReport[]> => ipcRenderer.invoke('recovery:report'),
    dismiss: (input: string | { reportId?: string; findingsToDismiss?: Array<RecoveryReport['findings'][number]['kind']> }): Promise<RecoveryDismissResponse> => ipcRenderer.invoke('recovery:dismiss', typeof input === 'string' ? { reportId: input } : input)
  },
  recording: {
    start: (input?: ({ label?: string; source?: RecordingSession['source']; confirmedBy?: string } | RecordingStartRequest)): Promise<RecordingSession | RecordingManifest> => ipcRenderer.invoke('recording:start', input),
    stop: (sessionIdOrInput: string | { recordingId?: string; sessionId?: string; confirmedBy?: string }, confirmedBy?: string): Promise<RecordingSession | RecordingManifest | null> => {
      const input = typeof sessionIdOrInput === 'string' ? { sessionId: sessionIdOrInput, confirmedBy } : sessionIdOrInput
      return ipcRenderer.invoke('recording:stop', input)
    },
    list: (filter?: { sessionId?: string; taskId?: string; sinceTs?: number }): Promise<RecordingSession[] | RecordingManifest[]> => ipcRenderer.invoke('recording:list', filter),
    manifest: (sessionIdOrInput: string | { recordingId?: string; sessionId?: string }) => {
      const input = typeof sessionIdOrInput === 'string' ? { sessionId: sessionIdOrInput } : sessionIdOrInput
      return ipcRenderer.invoke('recording:get-manifest', input)
    },
    getEvents: (input: { recordingId: string; kind?: RecordingEvent['kind'] | 'git-diff'; sinceTs?: number; limit?: number }): Promise<RecordingEvent[]> => ipcRenderer.invoke('recording:get-events', input),
    getReplayState: (input: { recordingId: string; cursorTs?: number; speed?: number; paused?: boolean; enabledTracks?: RecordingStreamKind[] }): Promise<RecordingReplayState> => ipcRenderer.invoke('recording:get-replay-state', input),
    getEventsWindow: (input: { recordingId: string; sinceTs: number; untilTs: number; kinds?: RecordingStreamKind[] }): Promise<RecordingEvent[]> => ipcRenderer.invoke('recording:get-events-window', input),
    getCast: (recordingId: string): Promise<{ cast: AsciinemaCast }> => ipcRenderer.invoke('recording:get-cast', { recordingId }),
    listAnchors: (recordingId: string): Promise<{ anchors: RecordingReplayState['anchors'] }> => ipcRenderer.invoke('recording:list-anchors', { recordingId }),
    getScreenshot: (input: { recordingId: string; ts: number }): Promise<RecordingScreenshotResult> => ipcRenderer.invoke('recording:get-screenshot', input),
    getFsSnapshotAt: (input: { recordingId: string; ts: number }): Promise<RecordingFsSnapshotResult> => ipcRenderer.invoke('recording:get-fs-snapshot-at', input),
    exportAsciinema: (recordingId: string, outPath: string): Promise<{ filePath: string }> => ipcRenderer.invoke('recording:export-asciinema', { recordingId, outPath }),
    exportZip: (recordingId: string, outPath: string, redact = true): Promise<{ filePath: string }> => ipcRenderer.invoke('recording:export-zip', { recordingId, outPath, redact }),
    delete: (recordingId: string, confirmedBy?: string): Promise<{ deleted: boolean }> => ipcRenderer.invoke('recording:delete', { recordingId, confirmedBy }),
    onEvent: (callback: (event: RecordingEvent & { recordingId: string }) => void) => {
      const handler = (_: unknown, event: RecordingEvent & { recordingId: string }) => callback(event)
      ipcRenderer.on('recording:event-stream', handler)
      return () => ipcRenderer.removeListener('recording:event-stream', handler)
    },
    replayStart: (sessionId: string, confirmedBy?: string): Promise<ReplayState> => ipcRenderer.invoke('recording:replay-start', { sessionId, confirmedBy }),
    replaySeek: (replayId: string, cursorMs: number): Promise<ReplayState | null> => ipcRenderer.invoke('recording:replay-seek', { replayId, cursorMs }),
    replayExport: (replayId: string) => ipcRenderer.invoke('recording:replay-export', { replayId })
  },
  ocr: {
    capabilities: (): Promise<OcrCapabilities> => ipcRenderer.invoke('ocr:capabilities'),
    recognize: (request?: unknown): Promise<OcrDisabledResponse> => ipcRenderer.invoke('ocr:recognize', request),
    listSupportedLanguages: () => ipcRenderer.invoke('ocr:list-supported-languages')
  }
}

type R8Api = typeof r8Api

export type { FeatureFlagDefinition, R8Api }

const isDevObservabilityEnabled = process.env.NODE_ENV !== 'production'
  || process.env.ENABLE_DEV_OBS === '1'
  || process.argv.includes('--enable-dev-obs')

const PROJECT_GIT_INFO_TTL_MS = 60_000
const PROJECT_GIT_INFO_BATCH_DELAY_MS = 100
const TAGS_LIST_TTL_MS = 15_000
const GROUPS_LIST_TTL_MS = 15_000
const TOOL_STATUS_TTL_MS = 10_000

interface AsyncCacheEntry<T> {
  expiresAt: number
  promise: Promise<T> | null
  value: T | undefined
}

interface GitInfoRequestOptions {
  force?: boolean
}

interface GitInfoBatchResult {
  path: string
  info: GitInfo | null
}

interface PendingGitInfoRequest {
  path: string
  reject: (reason?: unknown) => void
  resolve: (value: GitInfo | null) => void
}

const projectGitInfoCache = new Map<string, AsyncCacheEntry<GitInfo | null>>()
const sharedListCache = new Map<string, AsyncCacheEntry<string[]>>()
const toolStatusCache = new Map<string, AsyncCacheEntry<CodingTool[]>>()
const pendingGitInfoBatch = new Map<string, PendingGitInfoRequest>()
let gitInfoBatchTimer: ReturnType<typeof setTimeout> | null = null

function getCacheKey(input: string): string {
  return input.trim().toLowerCase()
}

function getAsyncCacheEntry<T>(
  cache: Map<string, AsyncCacheEntry<T>>,
  key: string
): AsyncCacheEntry<T> | undefined {
  return cache.get(key)
}

function setAsyncCacheValue<T>(
  cache: Map<string, AsyncCacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
): void {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    promise: null,
    value
  })
}

function updateCachedStringList(
  key: string,
  updater: (current: string[]) => string[]
): void {
  const current = sharedListCache.get(key)
  if (!current?.value) {
    return
  }

  setAsyncCacheValue(
    sharedListCache,
    key,
    updater([...current.value]),
    key === 'tags' ? TAGS_LIST_TTL_MS : GROUPS_LIST_TTL_MS
  )
}

function flushGitInfoBatch(): void {
  const requests = Array.from(pendingGitInfoBatch.values())
  pendingGitInfoBatch.clear()
  gitInfoBatchTimer = null

  if (requests.length === 0) {
    return
  }

  void ipcRenderer.invoke('project:get-git-info-batch', requests.map((request) => request.path))
    .then((results: GitInfoBatchResult[]) => {
      const resultsByKey = new Map(
        results.map((result) => [getCacheKey(result.path), result.info] as const)
      )

      for (const request of requests) {
        request.resolve(resultsByKey.get(getCacheKey(request.path)) ?? null)
      }
    })
    .catch((error: unknown) => {
      for (const request of requests) {
        request.reject(error)
      }
    })
}

function loadBatchedGitInfo(projectPath: string): Promise<GitInfo | null> {
  const key = getCacheKey(projectPath)

  return new Promise((resolve, reject) => {
    pendingGitInfoBatch.set(key, {
      path: projectPath,
      reject,
      resolve
    })

    if (gitInfoBatchTimer === null) {
      gitInfoBatchTimer = setTimeout(flushGitInfoBatch, PROJECT_GIT_INFO_BATCH_DELAY_MS)
    }
  })
}

async function loadCachedValue<T>(
  cache: Map<string, AsyncCacheEntry<T>>,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  force = false
): Promise<T> {
  const now = Date.now()
  const current = getAsyncCacheEntry(cache, key)

  if (!force && current?.value !== undefined && current.expiresAt > now) {
    return current.value
  }

  if (current?.promise) {
    return current.promise
  }

  const pending = loader()
    .then((value) => {
      setAsyncCacheValue(cache, key, value, ttlMs)
      return value
    })
    .catch((error) => {
      if (current?.value !== undefined) {
        cache.set(key, {
          ...current,
          promise: null
        })
      } else {
        cache.delete(key)
      }
      throw error
    })

  cache.set(key, {
    expiresAt: current?.expiresAt ?? 0,
    promise: pending,
    value: current?.value
  })

  return pending
}

const devObsApi = {
  getRuntimeMetrics: (): Promise<RuntimeMetricsSnapshot> =>
    ipcRenderer.invoke(DEV_OBS_CHANNELS.GET_RUNTIME_METRICS),

  getThrottleReport: (): Promise<IpcThrottleReport> =>
    ipcRenderer.invoke(DEV_OBS_CHANNELS.GET_THROTTLE_REPORT),

  resetMetrics: (scopes?: readonly RuntimeMetricsResetScope[]): Promise<ResetRuntimeMetricsResponse> =>
    ipcRenderer.invoke(DEV_OBS_CHANNELS.RESET_RUNTIME_METRICS, scopes),

  exportDiagnosticBundle: (
    request?: ExportDiagnosticBundleRequest
  ): Promise<ExportDiagnosticBundleResponse> =>
    ipcRenderer.invoke(DEV_OBS_CHANNELS.EXPORT_DIAGNOSTIC_BUNDLE, request)
}

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('devhub', {
  // ==================== Projects ====================
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_LIST),

    get: (id: string): Promise<Project | undefined> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_GET, id),

    add: (path: string): Promise<Project> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_ADD, path),

    remove: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_REMOVE, id),

    update: (id: string, updates: Partial<Project>): Promise<Project | undefined> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_UPDATE, id, updates),

    scan: (scanPath?: string): Promise<Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>> =>
      ipcRenderer.invoke('projects:scan', scanPath),

    scanDirectory: (dirPath: string): Promise<Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>> =>
      ipcRenderer.invoke('projects:scan-directory', dirPath),

    // 智能项目发现（包括 VSCode 最近打开、pnpm/npm 链接等）
    discover: (): Promise<Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>> =>
      ipcRenderer.invoke('projects:discover'),

    // Git info and dependency parsing
    getGitInfo: (
      projectPath: string,
      options?: GitInfoRequestOptions
    ): Promise<GitInfo | null> =>
      loadCachedValue(
        projectGitInfoCache,
        getCacheKey(projectPath),
        PROJECT_GIT_INFO_TTL_MS,
        () => options?.force === true
          ? ipcRenderer.invoke('project:get-git-info', projectPath)
          : loadBatchedGitInfo(projectPath),
        options?.force === true
      ),

    getDependencies: (projectPath: string): Promise<ProjectDependencies | null> =>
      ipcRenderer.invoke('project:get-dependencies', projectPath),

    openIn: (projectPath: string, target: ProjectOpenTarget): Promise<boolean> =>
      ipcRenderer.invoke('project:open-in-editor', { projectPath, target }),

    // 监听首次启动自动发现结果
    onAutoDiscovered: (callback: (projects: Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>) => void) => {
      const handler = (_: unknown, projects: Array<{ path: string; name: string; scripts: string[]; projectType: ProjectType }>) => callback(projects)
      ipcRenderer.on('projects:auto-discovered', handler)
      return () => ipcRenderer.removeListener('projects:auto-discovered', handler)
    },

    // Project watcher API
    watcher: {
      start: (watchPaths?: string[]): Promise<{ running: boolean }> =>
        ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_WATCHER_START, watchPaths),

      stop: (): Promise<{ running: boolean }> =>
        ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_WATCHER_STOP),

      status: (): Promise<{ running: boolean }> =>
        ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_WATCHER_STATUS),

      onDetected: (callback: (events: Array<{ type: 'added' | 'removed'; dirPath: string; detections: Array<{ projectType: ProjectType; name: string; scripts: string[] }> }>) => void) => {
        const handler = (_: unknown, events: Array<{ type: 'added' | 'removed'; dirPath: string; detections: Array<{ projectType: ProjectType; name: string; scripts: string[] }> }>) => callback(events)
        ipcRenderer.on(IPC_CHANNELS.PROJECTS_WATCHER_DETECTED, handler)
        return () => ipcRenderer.removeListener(IPC_CHANNELS.PROJECTS_WATCHER_DETECTED, handler)
      }
    }
  },

  // ==================== Process ====================
  process: {
    start: (projectId: string, script: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROCESS_START, projectId, script),

    stop: (projectId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROCESS_STOP, projectId),

    isRunning: (projectId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROCESS_STATUS, projectId),

    onStatusChange: (
      callback: (data: { projectId: string; status: string; pid?: number }) => void
    ) => {
      const handler = (_: unknown, data: { projectId: string; status: string; pid?: number }) =>
        callback(data)
      ipcRenderer.on('process:status-change', handler)
      return () => ipcRenderer.removeListener('process:status-change', handler)
    }
  },

  // ==================== Logs ====================
  logs: {
    subscribe: (projectId: string): void => {
      ipcRenderer.send('log:subscribe', projectId)
    },

    onEntry: (callback: (entry: LogEntry) => void) => {
      const handler = (_: unknown, entry: LogEntry) => callback(entry)
      ipcRenderer.on(IPC_CHANNELS.LOG_ENTRY, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_ENTRY, handler)
    },

    clear: (projectId: string): void => {
      ipcRenderer.send(IPC_CHANNELS.LOG_CLEAR, projectId)
    }
  },

  // ==================== Tools ====================
  tools: {
    getStatus: (): Promise<CodingTool[]> =>
      loadCachedValue(
        toolStatusCache,
        'status',
        TOOL_STATUS_TTL_MS,
        () => ipcRenderer.invoke(IPC_CHANNELS.TOOL_STATUS)
      ),

    onComplete: (callback: (tool: CodingTool) => void) => {
      const handler = (_: unknown, tool: CodingTool) => {
        toolStatusCache.delete('status')
        callback(tool)
      }
      ipcRenderer.on(IPC_CHANNELS.TOOL_COMPLETE, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TOOL_COMPLETE, handler)
    }
  },

  // ==================== Settings ====================
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

    update: (updates: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, updates)
  },

  // ==================== i18n ====================
  i18n: {
    getLocale: (): Promise<LocaleGetResponse> => ipcRenderer.invoke('i18n:get-locale'),
    setLocale: (locale: Locale): Promise<LocaleSetResponse> => ipcRenderer.invoke('i18n:set-locale', { locale }),
    listLocales: (): Promise<LocaleListResponse> => ipcRenderer.invoke('i18n:list-locales'),
    reloadResources: (): Promise<LocaleReloadResponse> => ipcRenderer.invoke('i18n:reload-resources')
  },

  // ==================== Tags & Groups ====================
  tags: {
    list: (): Promise<string[]> =>
      loadCachedValue(
        sharedListCache,
        'tags',
        TAGS_LIST_TTL_MS,
        () => ipcRenderer.invoke('tags:list')
      ),
    add: async (tag: string): Promise<void> => {
      await ipcRenderer.invoke('tags:add', tag)
      updateCachedStringList('tags', (current) => current.includes(tag) ? current : [...current, tag])
    },
    remove: async (tag: string): Promise<void> => {
      await ipcRenderer.invoke('tags:remove', tag)
      updateCachedStringList('tags', (current) => current.filter((item) => item !== tag))
    }
  },

  groups: {
    list: (): Promise<string[]> =>
      loadCachedValue(
        sharedListCache,
        'groups',
        GROUPS_LIST_TTL_MS,
        () => ipcRenderer.invoke('groups:list')
      ),
    add: async (group: string): Promise<void> => {
      await ipcRenderer.invoke('groups:add', group)
      updateCachedStringList('groups', (current) => current.includes(group) ? current : [...current, group])
    },
    remove: async (group: string): Promise<void> => {
      await ipcRenderer.invoke('groups:remove', group)
      updateCachedStringList('groups', (current) => current.filter((item) => item !== group))
    }
  },

  // ==================== Dialog ====================
  dialog: {
    openDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-directory')
  },

  // ==================== Shell ====================
  shell: {
    openPath: (path: string): Promise<string> => ipcRenderer.invoke('shell:open-path', path)
  },

  // ==================== System ====================
  system: {
    getDrives: (): Promise<string[]> => ipcRenderer.invoke('system:get-drives')
  },

  // ==================== Window Controls ====================
  window: {
    minimize: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
    hideToTray: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_HIDE_TO_TRAY),
    forceClose: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_FORCE_CLOSE),
    onCloseConfirm: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on(IPC_CHANNELS.WINDOW_CLOSE_CONFIRM, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_CLOSE_CONFIRM, handler)
    }
  },

  // ==================== Extended APIs ====================
  systemProcess: systemProcessApi,
  port: portApi,
  windowManager: windowApi,
  topology: topologyApi,
  aiTask: aiTaskApi,
  aiAlias: aiAliasApi,
  notification: notificationApi,
  taskHistory: taskHistoryApi,
  scanner: scannerApi,
  r8: r8Api,
  ...(isDevObservabilityEnabled ? { devObs: devObsApi } : {})
})
