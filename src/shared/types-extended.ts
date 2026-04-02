// Extended type definitions for DevHub Pro

// ============ Shared Service Result Type ============

export interface ServiceResult<T = undefined> {
  success: boolean
  data?: T
  error?: string
}

// ============ Process Monitoring Types ============

export type ProcessType = 'dev-server' | 'ai-tool' | 'build' | 'database' | 'other'
export type ProcessStatusType = 'running' | 'idle' | 'waiting'

export interface ProcessInfo {
  pid: number
  name: string
  command: string
  port?: number
  cpu: number
  memory: number
  status: ProcessStatusType
  projectId?: string
  startTime: number
  type: ProcessType
  workingDir?: string
}

export interface ProcessGroup {
  projectId: string
  projectName: string
  processes: ProcessInfo[]
  totalCpu: number
  totalMemory: number
}

// ============ Port Management Types ============

export type PortState = 'LISTENING' | 'ESTABLISHED' | 'TIME_WAIT' | 'CLOSE_WAIT'
export type PortProtocol = 'TCP' | 'UDP'

export interface PortInfo {
  port: number
  pid: number
  processName: string
  state: PortState
  protocol: PortProtocol
  localAddress: string
  projectId?: string
}

export const COMMON_DEV_PORTS = [
  3000, 3001, 4000, 5000, 5173, 5174,
  8000, 8080, 8888, 9000, 4200, 4321
] as const

// ============ Window Management Types ============

export interface WindowInfo {
  hwnd: number
  title: string
  processName: string
  pid: number
  className: string
  rect: { x: number; y: number; width: number; height: number }
  isVisible: boolean
  isMinimized: boolean
}

export interface WindowGroup {
  id: string
  name: string
  projectId?: string
  windows: WindowInfo[]
  createdAt: number
}

export interface WindowLayout {
  id: string
  name: string
  description?: string
  groups: {
    groupId: string
    windows: {
      processName: string
      titlePattern: string
      rect: { x: number; y: number; width: number; height: number }
    }[]
  }[]
  createdAt: number
  updatedAt: number
}

// ============ AI Task Tracking Types ============

export type AIToolType = 'codex' | 'claude-code' | 'gemini-cli' | 'cursor' | 'other'
export type AITaskState = 'running' | 'waiting' | 'completed' | 'error' | 'idle'

export interface AITaskStatus {
  state: AITaskState
  progress?: number
  lastActivity: number
  currentAction?: string
}

export interface AITask {
  id: string
  toolType: AIToolType
  pid: number
  windowHwnd?: number
  startTime: number
  endTime?: number
  status: AITaskStatus
  projectId?: string
  metrics: {
    cpuHistory: number[]
    outputLineCount: number
    lastOutputTime: number
    idleDuration: number
  }
}

export interface AITaskHistory {
  id: string
  toolType: AIToolType
  projectId?: string
  startTime: number
  endTime: number
  duration: number
  status: 'completed' | 'error' | 'cancelled'
  summary?: string
}

// ============ Notification Types ============

export type NotificationType =
  | 'task-complete'
  | 'port-conflict'
  | 'zombie-process'
  | 'high-resource'
  | 'project-error'

export interface NotificationConfig {
  enabled: boolean
  types: Record<NotificationType, boolean>
  sound: boolean
  persistent: boolean
}

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  icon?: string
  actions?: { label: string; action: string }[]
  createdAt: number
  read: boolean
}

// ============ Task History Types ============

export type TaskType = 'ai-task' | 'dev-server' | 'build' | 'test'
export type TaskRecordStatus = 'running' | 'completed' | 'error' | 'cancelled'

export interface TaskRecord {
  id: string
  type: TaskType
  toolOrCommand: string
  projectId?: string
  projectName?: string
  startTime: number
  endTime?: number
  duration?: number
  status: TaskRecordStatus
  metadata?: Record<string, unknown>
}

export interface TaskStatistics {
  totalTasks: number
  totalDuration: number
  avgDuration: number
  byType: Record<string, { count: number; avgDuration: number }>
  byProject: Record<string, { count: number; avgDuration: number }>
  byDay: { date: string; count: number }[]
}

// ============ Extended IPC Channels ============

export const IPC_CHANNELS_EXT = {
  PROCESS_SCAN: 'process:scan',
  PROCESS_KILL: 'process:kill',
  PROCESS_CLEANUP_ZOMBIES: 'process:cleanup-zombies',
  PROCESS_UPDATED: 'process:updated',
  PROCESS_ZOMBIE_DETECTED: 'process:zombie-detected',
  PORT_SCAN: 'port:scan',
  PORT_CHECK: 'port:check',
  PORT_RELEASE: 'port:release',
  PORT_CONFLICT: 'port:conflict',
  WINDOW_SCAN: 'window:scan',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_MOVE: 'window:move',
  WINDOW_MINIMIZE: 'window:minimize-window',
  WINDOW_MAXIMIZE: 'window:maximize-window',
  WINDOW_CLOSE: 'window:close-window',
  WINDOW_CREATE_GROUP: 'window:create-group',
  WINDOW_GET_GROUPS: 'window:get-groups',
  WINDOW_REMOVE_GROUP: 'window:remove-group',
  WINDOW_FOCUS_GROUP: 'window:focus-group',
  WINDOW_SAVE_LAYOUT: 'window:save-layout',
  WINDOW_RESTORE_LAYOUT: 'window:restore-layout',
  WINDOW_GET_LAYOUTS: 'window:get-layouts',
  WINDOW_REMOVE_LAYOUT: 'window:remove-layout',
  WINDOW_UPDATED: 'window:updated',
  AI_TASK_SCAN: 'ai-task:scan',
  AI_TASK_GET_ACTIVE: 'ai-task:get-active',
  AI_TASK_GET_ALL: 'ai-task:get-all',
  AI_TASK_GET_HISTORY: 'ai-task:get-history',
  AI_TASK_START_TRACKING: 'ai-task:start-tracking',
  AI_TASK_STOP_TRACKING: 'ai-task:stop-tracking',
  AI_TASK_GET_STATISTICS: 'ai-task:get-statistics',
  AI_TASK_STATUS_CHANGED: 'ai-task:status-changed',
  AI_TASK_COMPLETE: 'ai-task:complete',
  AI_TASK_COMPLETED: 'ai-task:completed',
  NOTIFICATION_GET_CONFIG: 'notification:get-config',
  NOTIFICATION_SET_CONFIG: 'notification:set-config',
  NOTIFICATION_GET_HISTORY: 'notification:get-history',
  NOTIFICATION_ACTION: 'notification:action'
} as const

// AI Tool Signatures for Detection
export const AI_TOOL_SIGNATURES: Record<AIToolType, {
  processPatterns: string[]
  windowTitlePatterns: RegExp[]
  commandPatterns: RegExp[]
}> = {
  'codex': {
    processPatterns: ['node.exe', 'codex'],
    windowTitlePatterns: [/codex/i, /openai/i],
    commandPatterns: [/codex\s+/i]
  },
  'claude-code': {
    processPatterns: ['node.exe', 'claude'],
    windowTitlePatterns: [/claude/i, /anthropic/i],
    commandPatterns: [/\bclaude\b/i, /@anthropic-ai\/claude-code/i, /claude-code/i]
  },
  'gemini-cli': {
    processPatterns: ['node.exe', 'gemini'],
    windowTitlePatterns: [/gemini/i, /google/i],
    commandPatterns: [/gemini\s+/i]
  },
  'cursor': {
    processPatterns: ['Cursor.exe'],
    windowTitlePatterns: [/cursor/i],
    commandPatterns: []
  },
  'other': {
    processPatterns: [],
    windowTitlePatterns: [],
    commandPatterns: []
  }
}

// Protected system processes — never kill these
export const PROTECTED_PROCESSES: ReadonlySet<string> = new Set([
  'csrss.exe', 'lsass.exe', 'smss.exe', 'wininit.exe', 'winlogon.exe',
  'services.exe', 'svchost.exe', 'dwm.exe', 'system', 'registry',
  'explorer.exe', 'runtimebroker.exe', 'taskhostw.exe', 'conhost.exe',
  'msmpeng.exe', 'searchindexer.exe', 'spoolsv.exe', 'audiodg.exe',
  'fontdrvhost.exe', 'sihost.exe', 'ctfmon.exe',
  'electron.exe', 'devhub.exe' // self-protection
])

export function isProtectedProcess(name: string): boolean {
  return PROTECTED_PROCESSES.has(name.toLowerCase())
}

// Dev process patterns for filtering
// 注意: 不包含数据库服务（postgres/mysql/mongo/redis），它们不是开发工具进程
export const DEV_PROCESS_PATTERNS = [
  // JS/TS 运行时
  'node.exe', 'deno.exe', 'bun.exe',
  // Python
  'python.exe', 'python3.exe',
  // 其他运行时
  'java.exe', 'go.exe', 'cargo.exe', 'rustc.exe', 'ruby.exe',
  'php.exe', 'dotnet.exe',
  // IDE & 编辑器
  'code.exe', 'Cursor.exe', 'windsurf.exe',
  'idea64.exe', 'pycharm64.exe', 'webstorm64.exe',
  // AI 编程工具
  'codex', 'claude', 'gemini',
  // 容器
  'docker.exe'
] as const
