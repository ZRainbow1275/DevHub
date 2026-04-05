import { ipcRenderer } from 'electron'
import {
  IPC_CHANNELS_EXT,
  ProcessInfo,
  ProcessGroup,
  PortInfo,
  PortTopologyData,
  WindowInfo,
  WindowGroup,
  WindowLayout,
  AITask,
  AITaskHistory,
  TaskRecord,
  TaskStatistics,
  NotificationConfig,
  AppNotification,
  TaskType,
  TaskRecordStatus,
  ServiceResult
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

  saveLayout: (name: string, description?: string): Promise<WindowLayout> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SAVE_LAYOUT, name, description),

  restoreLayout: (layoutId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_RESTORE_LAYOUT, layoutId),

  getLayouts: (): Promise<WindowLayout[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_GET_LAYOUTS),

  removeLayout: (layoutId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_REMOVE_LAYOUT, layoutId),

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

  onTaskComplete: (callback: (task: AITask) => void) => {
    const handler = (_: unknown, task: AITask) => callback(task)
    ipcRenderer.on(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.AI_TASK_COMPLETED, handler)
  },

  onTaskUpdated: (callback: (task: AITask) => void) => {
    const handler = (_: unknown, task: AITask) => callback(task)
    ipcRenderer.on('ai-task:updated', handler)
    return () => ipcRenderer.removeListener('ai-task:updated', handler)
  }
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
