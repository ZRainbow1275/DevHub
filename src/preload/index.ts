import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, Project, LogEntry, CodingTool, AppSettings, ProjectType } from '@shared/types'
import {
  systemProcessApi,
  portApi,
  windowApi,
  aiTaskApi,
  aiAliasApi,
  notificationApi,
  taskHistoryApi
} from './extended'

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
      ipcRenderer.invoke(IPC_CHANNELS.TOOL_STATUS),

    onComplete: (callback: (tool: CodingTool) => void) => {
      const handler = (_: unknown, tool: CodingTool) => callback(tool)
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

  // ==================== Tags & Groups ====================
  tags: {
    list: (): Promise<string[]> => ipcRenderer.invoke('tags:list'),
    add: (tag: string): Promise<void> => ipcRenderer.invoke('tags:add', tag),
    remove: (tag: string): Promise<void> => ipcRenderer.invoke('tags:remove', tag)
  },

  groups: {
    list: (): Promise<string[]> => ipcRenderer.invoke('groups:list'),
    add: (group: string): Promise<void> => ipcRenderer.invoke('groups:add', group),
    remove: (group: string): Promise<void> => ipcRenderer.invoke('groups:remove', group)
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
  aiTask: aiTaskApi,
  aiAlias: aiAliasApi,
  notification: notificationApi,
  taskHistory: taskHistoryApi
})
