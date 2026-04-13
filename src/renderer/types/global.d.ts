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
  ProjectType
} from '@shared/types'

import type {
  GitInfo,
  ProjectDependencies
} from '@shared/types-extended'

import type {
  ProcessInfo,
  ProcessGroup,
  ProcessRelationship,
  ProcessDeepDetail,
  NetworkConnectionInfo,
  LoadedModuleInfo,
  PortInfo,
  PortTopologyData,
  PortFocusData,
  PortDetailIncrementalResult,
  WindowInfo,
  WindowGroup,
  WindowLayout,
  AITask,
  AITaskHistory,
  AIToolType,
  AIWindowAlias,
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
  SystemSummary,
  ScannerStatus
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
        getGitInfo: (projectPath: string) => Promise<GitInfo | null>
        getDependencies: (projectPath: string) => Promise<ProjectDependencies | null>
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
        kill: (pid: number) => Promise<boolean>
        cleanupZombies: () => Promise<number>
        getGroups: () => Promise<ProcessGroup[]>
        getProcessTree: (pid: number) => Promise<ProcessInfo[]>
        getFullRelationship: (pid: number) => Promise<ProcessRelationship | null>
        getProcessHistory: (pid: number) => Promise<{ cpuHistory: number[]; memoryHistory: number[] }>
        getDeepDetail: (pid: number) => Promise<ProcessDeepDetail | null>
        getConnections: (pid: number) => Promise<NetworkConnectionInfo[]>
        getEnvironment: (pid: number) => Promise<{ variables: Record<string, string>; requiresElevation: boolean }>
        killTree: (pid: number) => Promise<boolean>
        setPriority: (pid: number, priority: string) => Promise<boolean>
        openFileLocation: (filePath: string) => Promise<void>
        getModules: (pid: number) => Promise<{ modules: LoadedModuleInfo[]; requiresElevation: boolean }>
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
        setOpacity: (hwnd: number, opacity: number) => Promise<ServiceResult>
        sendKeys: (hwnd: number, keys: string) => Promise<ServiceResult>
        tileLayout: (hwnds: number[]) => Promise<ServiceResult>
        cascadeLayout: (hwnds: number[]) => Promise<ServiceResult>
        minimizeAll: () => Promise<ServiceResult>
        restoreAll: () => Promise<ServiceResult>
        addToGroup: (groupId: string, hwnd: number) => Promise<ServiceResult>
        restoreGroup: (groupId: string) => Promise<ServiceResult>
        createGroup: (name: string, windowHwnds: number[], projectId?: string) => Promise<WindowGroup>
        getGroups: () => Promise<WindowGroup[]>
        removeGroup: (groupId: string) => Promise<boolean>
        minimizeGroup?: (groupId: string) => Promise<ServiceResult>
        closeGroup?: (groupId: string) => Promise<ServiceResult>
        saveLayout: (name: string, description?: string) => Promise<WindowLayout>
        restoreLayout: (layoutId: string) => Promise<ServiceResult>
        getLayouts: () => Promise<WindowLayout[]>
        removeLayout: (layoutId: string) => Promise<boolean>
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
        onProcessesDiff: (callback: (diff: ScannerDiff<ProcessInfo>) => void) => () => void
        onPortsDiff: (callback: (diff: ScannerDiff<PortInfo>) => void) => () => void
        onWindowsDiff: (callback: (diff: ScannerDiff<WindowInfo>) => void) => () => void
        onAiTasksDiff: (callback: (diff: ScannerDiff<AITask>) => void) => () => void
        onSummaryUpdate: (callback: (summary: SystemSummary) => void) => () => void
        onSnapshotPush: (callback: (snapshot: ScannerCacheSnapshot) => void) => () => void
        onScannerFailed: (callback: (data: { type: string; retries: number }) => void) => () => void
      }
    }
  }
}

export {}
