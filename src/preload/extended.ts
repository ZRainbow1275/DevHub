import { ipcRenderer } from 'electron'
import {
  IPC_CHANNELS_EXT,
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
  WindowFavoriteRecord,
  WindowFavoriteToggleResult,
  WindowOpenDirectoryResult,
  WindowScreenshotResult,
  AITask,
  AITaskHistory,
  AIToolType,
  AIWindowAlias,
  AIRenameAndApplyRequest,
  AIRenameAndApplyResult,
  AIToolDetectionConfig,
  CalibrationResult,
  CalibrationSample,
  ConfidenceReport,
  StateTransition,
  ToolProfile,
  AICompletionOracleEvent,
  AICompletionOracleRecord,
  ProgressEstimate,
  TimelineEntry,
  TaskRecord,
  TaskStatistics,
  NotificationConfig,
  AppNotification,
  TaskType,
  TaskRecordStatus,
  ServiceResult,
  ScannerCacheSnapshot,
  ScannerAckRequest,
  ScannerChannelSeqMap,
  ScannerDiff,
  ScannerResyncResponse,
  ScannerSnapshotPushPayload,
  IPCEnvelope,
  SystemSummary,
  ScannerStatus
} from '@shared/types-extended'
import type { ScopedFlow, ScopedTopologyGraph, TopologyScope } from '@shared/topology/scope'
import type {
  ProcessBatchCancelResponse,
  ProcessBatchProgress,
  ProcessBatchRequest,
  ProcessBatchStartResponse,
  ProcessBatchUndoResponse,
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
  WindowBatchCancelResponse,
  WindowBatchProgress,
  WindowBatchRequest,
  WindowBatchStartResponse,
  WindowBatchUndoResponse,
  WindowVdInfoRequest,
  WindowVdInfoResponse
} from '@shared/schemas/r8-runtime'

function isIPCEnvelope<T>(payload: unknown): payload is IPCEnvelope<T> {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<IPCEnvelope<T>>
  return typeof candidate.channel === 'string'
    && typeof candidate.seq === 'number'
    && typeof candidate.timestamp === 'number'
    && typeof candidate.batch === 'boolean'
    && typeof candidate.partial === 'boolean'
    && 'payload' in candidate
}

function isScannerSnapshotPushPayload(payload: unknown): payload is ScannerSnapshotPushPayload {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<ScannerSnapshotPushPayload>
  return 'snapshot' in candidate
}

const SCANNER_ACK_FLUSH_MS = 8_000
const scannerChannelSeqs = new Map<string, number>()
const scannerResyncInFlight = new Map<string, Promise<void>>()
const pendingScannerAcks = new Map<string, ScannerAckRequest>()
let scannerAckTimer: ReturnType<typeof setTimeout> | null = null

interface NormalizedScannerDiffResult<T> {
  ackSeq: number | null
  diffs: ScannerDiff<T>[]
}

function applyScannerChannelSeqs(channelSeqs?: ScannerChannelSeqMap): void {
  if (!channelSeqs) {
    return
  }

  for (const [channel, seq] of Object.entries(channelSeqs)) {
    if (typeof seq === 'number') {
      scannerChannelSeqs.set(channel, seq)
    }
  }
}

function flushScannerAcks(): void {
  const requests = Array.from(pendingScannerAcks.values())
  pendingScannerAcks.clear()
  scannerAckTimer = null

  if (requests.length === 0) {
    return
  }

  void ipcRenderer.invoke('ipc:ack-seq', requests.length === 1 ? requests[0] : requests).catch(() => {
    // ACK telemetry is best-effort and must never block renderer updates.
  })
}

function emitScannerAck(request: ScannerAckRequest): void {
  const existing = pendingScannerAcks.get(request.channel)
  if (!existing || request.seq >= existing.seq) {
    pendingScannerAcks.set(request.channel, request)
  }

  if (scannerAckTimer === null) {
    scannerAckTimer = setTimeout(flushScannerAcks, SCANNER_ACK_FLUSH_MS)
  }
}

function ackScannerSnapshotBaselines(channelSeqs?: ScannerChannelSeqMap): void {
  if (!channelSeqs) {
    return
  }

  for (const [channel, seq] of Object.entries(channelSeqs)) {
    if (typeof seq === 'number') {
      emitScannerAck({ channel, seq, source: 'snapshot' })
    }
  }
}

async function requestScannerResync(channel: string): Promise<void> {
  const existing = scannerResyncInFlight.get(channel)
  if (existing) {
    await existing
    return
  }

  const request = ipcRenderer
    .invoke('ipc:request-resync', channel)
    .then((response: ScannerResyncResponse) => {
      if (!response.accepted) {
        throw new Error(`SCANNER_RESYNC_REJECTED:${channel}`)
      }
    })
    .finally(() => {
      scannerResyncInFlight.delete(channel)
    })

  scannerResyncInFlight.set(channel, request)
  await request
}

function normalizeScannerDiffPayload<T>(
  channel: string,
  payload: ScannerDiff<T> | IPCEnvelope<ScannerDiff<T> | ScannerDiff<T>[]>
): NormalizedScannerDiffResult<T> {
  if (!isIPCEnvelope<ScannerDiff<T> | ScannerDiff<T>[]>(payload)) {
    return {
      ackSeq: null,
      diffs: [payload]
    }
  }

  if (scannerResyncInFlight.has(channel)) {
    return {
      ackSeq: null,
      diffs: []
    }
  }

  const lastSeq = scannerChannelSeqs.get(channel)
  if (typeof lastSeq === 'number') {
    const expectedSeq = lastSeq + 1

    if (payload.seq > expectedSeq) {
      void requestScannerResync(channel)
      return {
        ackSeq: null,
        diffs: []
      }
    }

    if (payload.seq < expectedSeq) {
      return {
        ackSeq: null,
        diffs: []
      }
    }
  }

  scannerChannelSeqs.set(channel, payload.seq)
  return {
    ackSeq: payload.seq,
    diffs: Array.isArray(payload.payload) ? payload.payload : [payload.payload]
  }
}

export const systemProcessApi = {
  scan: (): Promise<ServiceResult<ProcessInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_SCAN),

  getBasicInfo: (pid: number): Promise<ProcessInfo | null> =>
    ipcRenderer.invoke('process:get-basic-info', pid),

  kill: (pid: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_KILL, pid),

  cleanupZombies: (): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES),

  getGroups: (): Promise<ProcessGroup[]> =>
    ipcRenderer.invoke('process:get-groups'),

  getProcessTree: (pid: number): Promise<ProcessInfo[]> =>
    ipcRenderer.invoke('process:get-tree', pid),

  getFullRelationship: (pid: number): Promise<ProcessRelationship | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_FULL_RELATIONSHIP, pid),

  getProcessHistory: (pid: number): Promise<{ cpuHistory: number[]; memoryHistory: number[] }> =>
    ipcRenderer.invoke('process:get-history', pid),

  listProcessTags: () =>
    ipcRenderer.invoke('process:tags-list'),

  setProcessTag: (input: { exe: string; cwd?: string; tag: string; color?: string; pinned?: boolean }) =>
    ipcRenderer.invoke('process:tags-set', input),

  removeProcessTag: (input: { exe: string; cwd?: string }) =>
    ipcRenderer.invoke('process:tags-remove', input),

  exportProcessTags: () =>
    ipcRenderer.invoke('process:tags-export'),

  importProcessTags: (json: string) =>
    ipcRenderer.invoke('process:tags-import', { json }),

  getProcessHistory24h: (input: { exe: string; cwd?: string }) =>
    ipcRenderer.invoke('process:history-24h', input),

  getProcessHistoryBatch: (keys: string[]) =>
    ipcRenderer.invoke('process:history-batch', { keys }),

  batchOp: (request: ProcessBatchRequest): Promise<ProcessBatchStartResponse> =>
    ipcRenderer.invoke('process:batch-op', request),

  batchCancel: (jobId: string, confirmedBy?: string): Promise<ProcessBatchCancelResponse> =>
    ipcRenderer.invoke('process:batch-cancel', { jobId, confirmedBy }),

  batchUndo: (jobId: string, confirmedBy?: string): Promise<ProcessBatchUndoResponse> =>
    ipcRenderer.invoke('process:batch-undo', { jobId, confirmedBy }),

  onBatchProgress: (callback: (progress: ProcessBatchProgress) => void) => {
    const handler = (_: unknown, progress: ProcessBatchProgress) => callback(progress)
    ipcRenderer.on('process:batch-progress', handler)
    return () => ipcRenderer.removeListener('process:batch-progress', handler)
  },

  getDeepDetail: (pid: number): Promise<ProcessDeepDetail | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_DEEP_DETAIL, pid),

  probeAccess: (pid: number): Promise<AccessReport> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_PROBE_ACCESS, pid),

  getConnections: (pid: number): Promise<NetworkConnectionInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_CONNECTIONS, pid),

  getEnvironment: (pid: number): Promise<{ variables: Record<string, string>; requiresElevation: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_ENVIRONMENT, pid),

  killTree: (pid: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_KILL_TREE, pid),

  setPriority: (pid: number, priority: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_SET_PRIORITY, pid, priority),

  openFileLocation: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_OPEN_FILE_LOCATION, filePath),

  getModules: (pid: number): Promise<{ modules: LoadedModuleInfo[]; requiresElevation: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_MODULES, pid),

  relaunchAsAdmin: (): Promise<{ ok: boolean; reason?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.APP_RELAUNCH_AS_ADMIN),

  onUpdated: (callback: (processes: ProcessInfo[]) => void) => {
    const handler = (_: unknown, processes: ProcessInfo[]) => callback(processes)
    ipcRenderer.on(IPC_CHANNELS_EXT.PROCESS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.PROCESS_UPDATED, handler)
  },

  onZombieDetected: (callback: (zombies: ProcessInfo[]) => void) => {
    const handler = (_: unknown, zombies: ProcessInfo[]) => callback(zombies)
    ipcRenderer.on(IPC_CHANNELS_EXT.PROCESS_ZOMBIE_DETECTED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.PROCESS_ZOMBIE_DETECTED, handler)
  }
}

export const portApi = {
  scan: (): Promise<PortInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_SCAN),

  scanCommon: (): Promise<PortInfo[]> =>
    ipcRenderer.invoke('port:scan-common'),

  check: (port: number): Promise<PortInfo | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_CHECK, port),

  release: (port: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_RELEASE, port),

  isAvailable: (port: number): Promise<boolean> =>
    ipcRenderer.invoke('port:is-available', port),

  findAvailable: (startPort: number): Promise<number> =>
    ipcRenderer.invoke('port:find-available', startPort),

  detectConflicts: (ports: number[]): Promise<PortInfo[]> =>
    ipcRenderer.invoke('port:detect-conflicts', ports),

  getTopology: (): Promise<PortTopologyData> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_TOPOLOGY),

  getPortFocusData: (port: number): Promise<PortFocusData | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_GET_FOCUS_DATA, port),

  getPortDetailIncremental: (port: number): Promise<PortDetailIncrementalResult> =>
    ipcRenderer.invoke('port:get-detail-incremental', port),

  cancelPortQuery: (port: number): Promise<boolean> =>
    ipcRenderer.invoke('port:cancel-query', port),

  onConflict: (callback: (data: { port: number; resolved: boolean }) => void) => {
    const handler = (_: unknown, data: { port: number; resolved: boolean }) => callback(data)
    ipcRenderer.on(IPC_CHANNELS_EXT.PORT_CONFLICT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.PORT_CONFLICT, handler)
  }
}

export const topologyApi = {
  buildScopedGraph: (scope: TopologyScope): Promise<ScopedTopologyGraph> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TOPOLOGY_BUILD_SCOPED_GRAPH, scope),

  buildScopedFlow: (scope: TopologyScope): Promise<ScopedFlow> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.FLOW_BUILD_SCOPED_FLOW, scope),

  warmScope: (scope: TopologyScope): Promise<{ ok: boolean; nodeCount: number; edgeCount: number; source: ScopedTopologyGraph['source'] }> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TOPOLOGY_WARM_SCOPE, scope),
}

export const windowApi = {
  scan: (includeSystemWindows?: boolean): Promise<ServiceResult<WindowInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SCAN, includeSystemWindows ?? false),

  focus: (hwnd: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_FOCUS, hwnd),

  move: (hwnd: number, x: number, y: number, width: number, height: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MOVE, hwnd, x, y, width, height),

  minimize: (hwnd: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MINIMIZE, hwnd),

  maximize: (hwnd: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MAXIMIZE, hwnd),

  close: (hwnd: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_CLOSE, hwnd),

  focusGroup: (groupId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_FOCUS_GROUP, groupId),

  createGroup: (name: string, windowHwnds: number[], projectId?: string): Promise<WindowGroup> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_CREATE_GROUP, name, windowHwnds, projectId),

  getGroups: (): Promise<WindowGroup[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_GET_GROUPS),

  removeGroup: (groupId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_REMOVE_GROUP, groupId),

  renameGroup: (groupId: string, newName: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RENAME_GROUP, groupId, newName),

  minimizeGroup: (groupId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke('window:minimize-group', groupId),

  closeGroup: (groupId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke('window:close-group', groupId),

  saveLayout: (name: string, description?: string): Promise<WindowLayout> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SAVE_LAYOUT, name, description),

  restoreLayout: (layoutId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE_LAYOUT, layoutId),

  getLayouts: (): Promise<WindowLayout[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_GET_LAYOUTS),

  removeLayout: (layoutId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_REMOVE_LAYOUT, layoutId),

  applyLayout: (intent: ApplyLayoutIntent): Promise<ApplyLayoutResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_APPLY_LAYOUT, intent),

  saveSnapshot: (name: string, description: string | undefined, hwnds: number[], monitorId?: number): Promise<ServiceResult<WindowLayoutSnapshot>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SAVE_SNAPSHOT, { name, description, hwnds, monitorId }),

  updateSnapshot: (id: string, patch: { name?: string; description?: string }): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_UPDATE_SNAPSHOT, { id, ...patch }),

  deleteSnapshot: (id: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_DELETE_SNAPSHOT, id),

  restoreSnapshot: (id: string): Promise<ApplyLayoutResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE_SNAPSHOT, id),

  listSnapshots: (): Promise<WindowLayoutSnapshot[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_LIST_SNAPSHOTS),

  previewLayout: (preset: TilePreset, count: number, monitorId?: number): Promise<WindowInfo['rect'][]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_PREVIEW_LAYOUT, { preset, count, monitorId }),

  restorePrevious: (restorePointId?: string): Promise<ApplyLayoutResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE_PREVIOUS, restorePointId),

  getMonitorInfo: (): Promise<MonitorInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_GET_MONITOR_INFO),

  getR8Monitors: (): Promise<R8MonitorsResponse> =>
    ipcRenderer.invoke('window:monitors'),

  listVirtualDesktops: (): Promise<VirtualDesktopListResponse> =>
    ipcRenderer.invoke('window:vd-list'),

  getWindowVdInfo: (request: WindowVdInfoRequest): Promise<WindowVdInfoResponse> =>
    ipcRenderer.invoke('window:vd-info', request),

  onVdWatch: (callback: (payload: WindowVdWatchPayload) => void) => {
    const handler = (_: unknown, payload: WindowVdWatchPayload) => callback(payload)
    ipcRenderer.on('window:vd-watch', handler)
    return () => ipcRenderer.removeListener('window:vd-watch', handler)
  },

  moveToDesktop: (request: MoveWindowToDesktopRequest): Promise<MoveWindowToDesktopResponse> =>
    ipcRenderer.invoke('window:move-to-desktop', request),

  moveToMonitor: (request: MoveWindowToMonitorRequest): Promise<MoveWindowToMonitorResponse> =>
    ipcRenderer.invoke('window:move-to-monitor', request),

  saveR8LayoutPreset: (request: WindowLayoutSaveRequest): Promise<WindowLayoutSaveResponse> =>
    ipcRenderer.invoke('window:layout-save', request),

  listR8LayoutPresets: (): Promise<WindowLayoutListResponse> =>
    ipcRenderer.invoke('window:layout-list'),

  applyR8LayoutPreset: (request: WindowLayoutApplyRequest): Promise<WindowLayoutApplyResponse> =>
    ipcRenderer.invoke('window:layout-apply', request),

  tileGroup: (groupId: string, preset: TilePreset = 'tile-auto'): Promise<ApplyLayoutResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_TILE_GROUP, { groupId, preset }),
  // New window operations
  restore: (hwnd: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE, hwnd),

  setTopmost: (hwnd: number, topmost: boolean): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SET_TOPMOST, hwnd, topmost),

  setAlwaysOnTop: (hwnd: number, topmost: boolean): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_ALWAYS_ON_TOP, hwnd, topmost),

  getTopmost: (hwnd: number): Promise<ServiceResult<{ hwnd: number; topmost: boolean }>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_GET_TOPMOST, hwnd),

  listTopmost: (): Promise<ServiceResult<{ hwnds: number[] }>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_LIST_TOPMOST),

  setOpacity: (hwnd: number, opacity: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SET_OPACITY, hwnd, opacity),

  setTitle: (hwnd: number, title: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SET_TITLE, hwnd, title),

  sendKeys: (hwnd: number, keys: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SEND_KEYS, hwnd, keys),

  tileLayout: (hwnds: number[]): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_TILE_LAYOUT, hwnds),

  cascadeLayout: (hwnds: number[]): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_CASCADE_LAYOUT, hwnds),

  stackLayout: (hwnds: number[]): Promise<ServiceResult> =>
    ipcRenderer.invoke('window:stack-layout', hwnds),

  minimizeAll: (): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MINIMIZE_ALL),

  restoreAll: (): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE_ALL),

  addToGroup: (groupId: string, hwnd: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_ADD_TO_GROUP, groupId, hwnd),

  restoreGroup: (groupId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE_GROUP, groupId),

  screenshot: (hwnd: number): Promise<ServiceResult<WindowScreenshotResult>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SCREENSHOT, hwnd),

  toggleFavorite: (hwnd: number): Promise<ServiceResult<WindowFavoriteToggleResult>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_TOGGLE_FAVORITE, hwnd),

  getFavorites: (): Promise<WindowFavoriteRecord[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_GET_FAVORITES),

  openWorkingDir: (hwnd: number): Promise<ServiceResult<WindowOpenDirectoryResult>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_OPEN_WORKING_DIR, hwnd),

  getThumbnailsBatch: (request: ThumbnailBatchRequest): Promise<ThumbnailBatchResponse> =>
    ipcRenderer.invoke('window:thumbnails-batch', request),

  refreshThumbnail: (request: ThumbnailRefreshRequest): Promise<ServiceResult> =>
    ipcRenderer.invoke('window:thumbnail-refresh', request),

  getThumbnailGroups: (): Promise<ThumbnailGroupsResponse> =>
    ipcRenderer.invoke('window:groups'),

  setThumbnailAlias: (request: ThumbnailWindowAliasRequest): Promise<ThumbnailWindowAliasResponse> =>
    ipcRenderer.invoke('window:set-alias', request),

  saveThumbnailViewport: (viewport: ThumbnailWallViewport): Promise<ThumbnailViewportConfigResponse> =>
    ipcRenderer.invoke('window:viewport-config', viewport),

  batchOp: (request: WindowBatchRequest): Promise<WindowBatchStartResponse> =>
    ipcRenderer.invoke('window:batch-op', request),

  batchCancel: (jobId: string, confirmedBy?: string): Promise<WindowBatchCancelResponse> =>
    ipcRenderer.invoke('window:batch-cancel', { jobId, confirmedBy }),

  batchUndo: (jobId: string, confirmedBy?: string): Promise<WindowBatchUndoResponse> =>
    ipcRenderer.invoke('window:batch-undo', { jobId, confirmedBy }),

  onBatchProgress: (callback: (progress: WindowBatchProgress) => void) => {
    const handler = (_: unknown, progress: WindowBatchProgress) => callback(progress)
    ipcRenderer.on('window:batch-progress', handler)
    return () => ipcRenderer.removeListener('window:batch-progress', handler)
  },

  onUpdated: (callback: (windows: WindowInfo[]) => void) => {
    const handler = (_: unknown, windows: WindowInfo[]) => callback(windows)
    ipcRenderer.on('window:updated', handler)
    return () => ipcRenderer.removeListener('window:updated', handler)
  }
}

export const aiTaskApi = {
  scan: (): Promise<AITask[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_SCAN),

  getActive: (): Promise<AITask[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_ACTIVE),

  getHistory: (limit?: number): Promise<AITaskHistory[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_HISTORY, limit),

  startTracking: (pid: number): Promise<AITask | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_START_TRACKING, pid),

  stopTracking: (pid: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_STOP_TRACKING, pid),

  getProgress: (taskId: string): Promise<ProgressEstimate | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_PROGRESS, taskId),

  getTimeline: (taskId: string): Promise<TimelineEntry[]> =>
    ipcRenderer.invoke('ai-task:get-timeline', taskId),

  getStatistics: (): Promise<unknown> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_STATISTICS),

  getAll: (): Promise<AITask[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_ALL),

  getById: (taskId: string): Promise<AITask | undefined> =>
    ipcRenderer.invoke('ai-task:get-by-id', taskId),

  markFalsePositive: (taskId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_MARK_FALSE_POSITIVE, taskId),

  setDetectionConfig: (toolType: AIToolType, config: Partial<AIToolDetectionConfig>): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_SET_DETECTION_CONFIG, toolType, config),

  getDetectionConfig: (toolType: AIToolType): Promise<AIToolDetectionConfig | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_DETECTION_CONFIG, toolType),

  getConfidenceReport: (taskKey: string): Promise<ConfidenceReport | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_CONFIDENCE_REPORT, taskKey),

  recordCompletionOracle: (event: AICompletionOracleEvent): Promise<AICompletionOracleRecord | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_RECORD_COMPLETION_ORACLE, event),

  getStateHistory: (taskKey: string, limit?: number): Promise<StateTransition[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_STATE_HISTORY, taskKey, limit),

  getProfile: (toolType: AIToolType): Promise<ToolProfile | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_PROFILE, toolType),

  setProfile: (toolType: AIToolType, profile: Partial<ToolProfile>): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_SET_PROFILE, toolType, profile),

  calibrate: (toolType: AIToolType, sample: CalibrationSample): Promise<CalibrationResult | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_CALIBRATE, toolType, sample),

  onStarted: (callback: (task: AITask) => void) => {
    const handler = (_: unknown, task: AITask) => callback(task)
    ipcRenderer.on('ai-task:started', handler)
    return () => ipcRenderer.removeListener('ai-task:started', handler)
  },

  onStatusChanged: (callback: (task: AITask) => void) => {
    const handler = (_: unknown, task: AITask) => callback(task)
    ipcRenderer.on(IPC_CHANNELS_EXT.AI_TASK_STATUS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.AI_TASK_STATUS_CHANGED, handler)
  },

  onCompleted: (callback: (entry: AITaskHistory) => void) => {
    const handler = (_: unknown, entry: AITaskHistory) => callback(entry)
    ipcRenderer.on(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, handler)
  },

  /** @deprecated Use onCompleted instead — the channel sends AITaskHistory, not AITask */
  onTaskComplete: (callback: (entry: AITaskHistory) => void) => {
    const handler = (_: unknown, entry: AITaskHistory) => callback(entry)
    ipcRenderer.on(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, handler)
  },

  onTaskUpdated: (callback: (task: AITask) => void) => {
    const handler = (_: unknown, task: AITask) => callback(task)
    ipcRenderer.on('ai-task:updated', handler)
    return () => ipcRenderer.removeListener('ai-task:updated', handler)
  },

  onNavigateToTask: (callback: (taskId: string) => void) => {
    const handler = (_: unknown, taskId: string) => callback(taskId)
    ipcRenderer.on(IPC_CHANNELS_EXT.NAVIGATE_TO_TASK, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.NAVIGATE_TO_TASK, handler)
  }
}

export const aiAliasApi = {
  getAll: (): Promise<AIWindowAlias[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_ALIAS_GET_ALL),

  set: (alias: AIWindowAlias): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_ALIAS_SET, alias),

  remove: (aliasId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_ALIAS_REMOVE, aliasId),

  rename: (aliasId: string, newName: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_ALIAS_RENAME, aliasId, newName),

  renameAndApply: (request: AIRenameAndApplyRequest): Promise<AIRenameAndApplyResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_ALIAS_RENAME_AND_APPLY, request),
}

export const notificationApi = {
  getConfig: (): Promise<NotificationConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_GET_CONFIG),

  setConfig: (config: Partial<NotificationConfig>): Promise<NotificationConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_SET_CONFIG, config),

  getHistory: (limit?: number): Promise<AppNotification[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_GET_HISTORY, limit),

  markRead: (notificationId: string): Promise<void> =>
    ipcRenderer.invoke('notification:mark-read', notificationId),

  markAllRead: (): Promise<void> =>
    ipcRenderer.invoke('notification:mark-all-read'),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('notification:clear-history'),

  getUnreadCount: (): Promise<number> =>
    ipcRenderer.invoke('notification:get-unread-count'),

  onNotification: (callback: (notification: AppNotification) => void) => {
    const handler = (_: unknown, notification: AppNotification) => callback(notification)
    ipcRenderer.on('notification:new', handler)
    return () => ipcRenderer.removeListener('notification:new', handler)
  }
}

export const taskHistoryApi = {
  add: (record: Omit<TaskRecord, 'id'>): Promise<TaskRecord> =>
    ipcRenderer.invoke('task-history:add', record),

  update: (id: string, updates: Partial<TaskRecord>): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke('task-history:update', id, updates),

  complete: (id: string, status?: TaskRecordStatus): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke('task-history:complete', id, status),

  get: (id: string): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke('task-history:get', id),

  list: (options?: {
    type?: TaskType
    projectId?: string
    status?: TaskRecordStatus
    limit?: number
    offset?: number
    startDate?: string
    endDate?: string
  }): Promise<TaskRecord[]> =>
    ipcRenderer.invoke('task-history:list', options),

  getStatistics: (options?: {
    projectId?: string
    startDate?: string
    endDate?: string
  }): Promise<TaskStatistics | null> =>
    ipcRenderer.invoke('task-history:statistics', options),

  clearOld: (beforeDate: string): Promise<number> =>
    ipcRenderer.invoke('task-history:clear-old', beforeDate),

  onRecordAdded: (callback: (record: TaskRecord) => void) => {
    const handler = (_: unknown, record: TaskRecord) => callback(record)
    ipcRenderer.on('task-history:record-added', handler)
    return () => ipcRenderer.removeListener('task-history:record-added', handler)
  },

  onRecordUpdated: (callback: (record: TaskRecord) => void) => {
    const handler = (_: unknown, record: TaskRecord) => callback(record)
    ipcRenderer.on('task-history:record-updated', handler)
    return () => ipcRenderer.removeListener('task-history:record-updated', handler)
  }
}

// ==================== Scanner API ====================

export const scannerApi = {
  subscribe: (): void => {
    ipcRenderer.send('scanner:subscribe')
  },

  getSnapshot: (): Promise<ScannerCacheSnapshot | null> =>
    ipcRenderer.invoke('scanner:snapshot'),

  getStatus: (): Promise<ScannerStatus | null> =>
    ipcRenderer.invoke('scanner:status'),

  onProcessesDiff: (callback: (diff: ScannerDiff<ProcessInfo>) => void) => {
    const handler = (
      _: unknown,
      payload: ScannerDiff<ProcessInfo> | IPCEnvelope<ScannerDiff<ProcessInfo> | ScannerDiff<ProcessInfo>[]>
    ) => {
      const normalized = normalizeScannerDiffPayload('scanner:processes:diff', payload)
      for (const diff of normalized.diffs) {
        callback(diff)
      }
      if (normalized.ackSeq !== null) {
        emitScannerAck({ channel: 'scanner:processes:diff', seq: normalized.ackSeq, source: 'diff' })
      }
    }
    ipcRenderer.on('scanner:processes:diff', handler)
    return () => ipcRenderer.removeListener('scanner:processes:diff', handler)
  },

  onPortsDiff: (callback: (diff: ScannerDiff<PortInfo>) => void) => {
    const handler = (
      _: unknown,
      payload: ScannerDiff<PortInfo> | IPCEnvelope<ScannerDiff<PortInfo> | ScannerDiff<PortInfo>[]>
    ) => {
      const normalized = normalizeScannerDiffPayload('scanner:ports:diff', payload)
      for (const diff of normalized.diffs) {
        callback(diff)
      }
      if (normalized.ackSeq !== null) {
        emitScannerAck({ channel: 'scanner:ports:diff', seq: normalized.ackSeq, source: 'diff' })
      }
    }
    ipcRenderer.on('scanner:ports:diff', handler)
    return () => ipcRenderer.removeListener('scanner:ports:diff', handler)
  },

  onWindowsDiff: (callback: (diff: ScannerDiff<WindowInfo>) => void) => {
    const handler = (
      _: unknown,
      payload: ScannerDiff<WindowInfo> | IPCEnvelope<ScannerDiff<WindowInfo> | ScannerDiff<WindowInfo>[]>
    ) => {
      const normalized = normalizeScannerDiffPayload('scanner:windows:diff', payload)
      for (const diff of normalized.diffs) {
        callback(diff)
      }
      if (normalized.ackSeq !== null) {
        emitScannerAck({ channel: 'scanner:windows:diff', seq: normalized.ackSeq, source: 'diff' })
      }
    }
    ipcRenderer.on('scanner:windows:diff', handler)
    return () => ipcRenderer.removeListener('scanner:windows:diff', handler)
  },

  onAiTasksDiff: (callback: (diff: ScannerDiff<AITask>) => void) => {
    const handler = (
      _: unknown,
      payload: ScannerDiff<AITask> | IPCEnvelope<ScannerDiff<AITask> | ScannerDiff<AITask>[]>
    ) => {
      const normalized = normalizeScannerDiffPayload('scanner:aiTasks:diff', payload)
      for (const diff of normalized.diffs) {
        callback(diff)
      }
      if (normalized.ackSeq !== null) {
        emitScannerAck({ channel: 'scanner:aiTasks:diff', seq: normalized.ackSeq, source: 'diff' })
      }
    }
    ipcRenderer.on('scanner:aiTasks:diff', handler)
    return () => ipcRenderer.removeListener('scanner:aiTasks:diff', handler)
  },

  onSummaryUpdate: (callback: (summary: SystemSummary) => void) => {
    const handler = (_: unknown, summary: SystemSummary) => callback(summary)
    ipcRenderer.on('scanner:summary:update', handler)
    return () => ipcRenderer.removeListener('scanner:summary:update', handler)
  },

  onSnapshotPush: (callback: (snapshot: ScannerCacheSnapshot) => void) => {
    const handler = (
      _: unknown,
      payload: ScannerCacheSnapshot | ScannerSnapshotPushPayload
    ) => {
      if (isScannerSnapshotPushPayload(payload)) {
        applyScannerChannelSeqs(payload.channelSeqs)
        callback(payload.snapshot)
        ackScannerSnapshotBaselines(payload.channelSeqs)
        return
      }

      callback(payload)
    }
    ipcRenderer.on('scanner:snapshot:push', handler)
    return () => ipcRenderer.removeListener('scanner:snapshot:push', handler)
  },

  retryScanner: (type: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('scanner:retry', type),

  requestResync: (channel: string): Promise<ScannerResyncResponse> =>
    ipcRenderer.invoke('ipc:request-resync', channel),

  onScannerFailed: (callback: (data: { type: string; retries: number }) => void) => {
    const handler = (_: unknown, data: { type: string; retries: number }) => callback(data)
    ipcRenderer.on('scanner:failed', handler)
    return () => ipcRenderer.removeListener('scanner:failed', handler)
  }
}
