import { ipcRenderer } from 'electron'
import {
  IPC_CHANNELS_EXT,
  ProcessInfo,
  ProcessGroup,
  ProcessRelationship,
  ProcessDeepDetail,
  NetworkConnectionInfo,
  LoadedModuleInfo,
  PortInfo,
  PortTopologyData,
  PortFocusData,
  WindowInfo,
  WindowGroup,
  WindowLayout,
  AITask,
  AITaskHistory,
  AIToolType,
  AIWindowAlias,
  AIToolDetectionConfig,
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
  ScannerDiff,
  SystemSummary,
  ScannerStatus
} from '@shared/types-extended'

export const systemProcessApi = {
  scan: (): Promise<ServiceResult<ProcessInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_SCAN),

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

  getDeepDetail: (pid: number): Promise<ProcessDeepDetail | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_DEEP_DETAIL, pid),

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

  onConflict: (callback: (data: { port: number; resolved: boolean }) => void) => {
    const handler = (_: unknown, data: { port: number; resolved: boolean }) => callback(data)
    ipcRenderer.on(IPC_CHANNELS_EXT.PORT_CONFLICT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.PORT_CONFLICT, handler)
  }
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

  // New window operations
  restore: (hwnd: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE, hwnd),

  setTopmost: (hwnd: number, topmost: boolean): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SET_TOPMOST, hwnd, topmost),

  setOpacity: (hwnd: number, opacity: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SET_OPACITY, hwnd, opacity),

  sendKeys: (hwnd: number, keys: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SEND_KEYS, hwnd, keys),

  tileLayout: (hwnds: number[]): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_TILE_LAYOUT, hwnds),

  cascadeLayout: (hwnds: number[]): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_CASCADE_LAYOUT, hwnds),

  minimizeAll: (): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MINIMIZE_ALL),

  restoreAll: (): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE_ALL),

  addToGroup: (groupId: string, hwnd: number): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_ADD_TO_GROUP, groupId, hwnd),

  restoreGroup: (groupId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE_GROUP, groupId),

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
    ipcRenderer.invoke('ai-alias:rename', aliasId, newName),
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
    const handler = (_: unknown, diff: ScannerDiff<ProcessInfo>) => callback(diff)
    ipcRenderer.on('scanner:processes:diff', handler)
    return () => ipcRenderer.removeListener('scanner:processes:diff', handler)
  },

  onPortsDiff: (callback: (diff: ScannerDiff<PortInfo>) => void) => {
    const handler = (_: unknown, diff: ScannerDiff<PortInfo>) => callback(diff)
    ipcRenderer.on('scanner:ports:diff', handler)
    return () => ipcRenderer.removeListener('scanner:ports:diff', handler)
  },

  onWindowsDiff: (callback: (diff: ScannerDiff<WindowInfo>) => void) => {
    const handler = (_: unknown, diff: ScannerDiff<WindowInfo>) => callback(diff)
    ipcRenderer.on('scanner:windows:diff', handler)
    return () => ipcRenderer.removeListener('scanner:windows:diff', handler)
  },

  onAiTasksDiff: (callback: (diff: ScannerDiff<AITask>) => void) => {
    const handler = (_: unknown, diff: ScannerDiff<AITask>) => callback(diff)
    ipcRenderer.on('scanner:aiTasks:diff', handler)
    return () => ipcRenderer.removeListener('scanner:aiTasks:diff', handler)
  },

  onSummaryUpdate: (callback: (summary: SystemSummary) => void) => {
    const handler = (_: unknown, summary: SystemSummary) => callback(summary)
    ipcRenderer.on('scanner:summary:update', handler)
    return () => ipcRenderer.removeListener('scanner:summary:update', handler)
  },

  onSnapshotPush: (callback: (snapshot: ScannerCacheSnapshot) => void) => {
    const handler = (_: unknown, snapshot: ScannerCacheSnapshot) => callback(snapshot)
    ipcRenderer.on('scanner:snapshot:push', handler)
    return () => ipcRenderer.removeListener('scanner:snapshot:push', handler)
  }
}
