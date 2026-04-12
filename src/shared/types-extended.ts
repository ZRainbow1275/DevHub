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

// ============ Extended Process Info ============

export interface ProcessInfoExtended extends ProcessInfo {
  ppid: number
  parentName?: string
  childPids: number[]
  siblingPids: number[]
  threadCount: number
  handleCount: number
  ports: number[]
  relatedWindowHwnds: number[]
  cpuHistory: number[]
  memoryHistory: number[]
  commandLine: string
  userName?: string
  priority?: number
}

export interface ProcessRelationship {
  ancestors: ProcessInfo[]
  self: ProcessInfoExtended
  children: ProcessInfo[]
  descendants: ProcessInfo[]
  siblings: ProcessInfo[]
  relatedPorts: PortInfo[]
  relatedWindows: WindowInfo[]
}

// ============ Process Deep Detail Types ============

export interface ProcessDeepDetail {
  pid: number
  name: string
  executablePath: string
  commandLine: string
  workingDirectory: string
  scriptPath: string | null
  startTime: string
  userName: string
  cpuPercent: number
  cpuHistory: number[]
  memoryRSS: number
  memoryVMS: number
  threadCount: number
  handleCount: number
  ioReadBytes: number
  ioWriteBytes: number
  networkConnections: NetworkConnectionInfo[]
  loadedModules: LoadedModuleInfo[]
  environmentVariables: Record<string, string>
  ancestorChain: ProcessTreeNode[]
  children: ProcessTreeNode[]
  relatedProcesses: RelatedProcessInfo[]
  requiresElevation?: boolean
}

export interface NetworkConnectionInfo {
  protocol: 'TCP' | 'UDP'
  localAddress: string
  localPort: number
  remoteAddress: string
  remotePort: number
  state: string
}

export interface LoadedModuleInfo {
  name: string
  path: string
  sizeKB: number
}

export interface ProcessTreeNode {
  pid: number
  name: string
  cpuPercent: number
  memoryMB: number
  children?: ProcessTreeNode[]
}

export interface RelatedProcessInfo {
  pid: number
  name: string
  relation: 'shared_port' | 'shared_file' | 'pipe' | 'network_peer'
  detail: string
}

export type ProcessPriority = 'Idle' | 'BelowNormal' | 'Normal' | 'AboveNormal' | 'High' | 'RealTime'

// ============ Process Sort/Filter Types ============

export type SortColumn = 'name' | 'pid' | 'cpu' | 'memory' | 'port' | 'startTime' | 'status' | 'type'
export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  column: SortColumn
  direction: SortDirection
}

export interface ProcessFilterState {
  search: string
  status: Set<ProcessStatusType>
  type: Set<ProcessType>
  cpuMin?: number
  memoryMin?: number
  hasPort?: boolean
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
  foreignAddress: string
  projectId?: string
}

// ============ Port Focus Types ============

export interface PortConnection {
  localAddress: string
  foreignAddress: string
  state: string
  foreignProcessName?: string
  direction: 'inbound' | 'outbound'
}

export interface PortFocusData {
  port: PortInfo
  process: ProcessInfoExtended | null
  siblingPorts: PortInfo[]
  connections: PortConnection[]
  processChildren: ProcessInfo[]
}

// ============ Port Topology Types ============

export type TopologyNodeType = 'process' | 'port' | 'external'

export interface TopologyNode {
  id: string
  type: TopologyNodeType
  label: string
  metadata: {
    pid?: number
    processName?: string
    port?: number
    protocol?: PortProtocol
    state?: PortState
    address?: string
    portCount?: number
  }
}

export interface TopologyEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface PortTopologyData {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
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
  isSystemWindow: boolean
}

/** Window class names known to be system/shell windows — filtered by default */
export const SYSTEM_WINDOW_CLASSNAMES: ReadonlySet<string> = new Set([
  'Progman',
  'WorkerW',
  'Windows.UI.Core.CoreWindow',
  'ApplicationFrameWindow',
  'Shell_TrayWnd',
  'Shell_SecondaryTrayWnd'
])

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
      className?: string
      workingDir?: string
      rect: { x: number; y: number; width: number; height: number }
    }[]
  }[]
  createdAt: number
  updatedAt: number
}

// ============ Process Relationship Graph Types ============

export type ProcessTopologyNodeType = 'project' | 'process' | 'port' | 'window'

export type ProcessTopologyEdgeType =
  | 'project-owns-process'
  | 'process-binds-port'
  | 'process-owns-window'

export interface ProcessTopologyNodeData extends Record<string, unknown> {
  label: string
  nodeType: ProcessTopologyNodeType
  pid?: number
  processInfo?: ProcessInfo
  portInfo?: PortInfo
  windowInfo?: WindowInfo
  projectId?: string
  projectName?: string
}

export interface ProcessTopologyEdgeData extends Record<string, unknown> {
  edgeType: ProcessTopologyEdgeType
  animated?: boolean
}

// ============ AI Task Tracking Types ============

export type AIToolType = 'codex' | 'claude-code' | 'gemini-cli' | 'cursor' | 'opencode' | 'other'
export type AITaskState = 'running' | 'waiting' | 'completed' | 'error' | 'idle' | 'thinking' | 'coding' | 'compiling'

export type AITaskPhase =
  | 'initializing'    // Process just created, CPU initializing
  | 'thinking'        // API call, waiting for response, low CPU
  | 'coding'          // File writes detected, moderate CPU
  | 'validating'      // Tests/lint running, high CPU burst
  | 'completed'       // CPU dropped to idle, output completion flag
  | 'error'           // Error detected

export const PHASE_LABELS: Record<AITaskPhase, string> = {
  initializing: '启动中...',
  thinking: '思考中...',
  coding: '编码中...',
  validating: '验证中...',
  completed: '已完成',
  error: '出错',
}

export interface PhaseSignals {
  phase: AITaskPhase
  confidence: number       // 0-1
  indicators: string[]     // detected indicators
}

export interface ProgressEstimate {
  percentage: number           // 0-100 (estimated)
  phase: AITaskPhase
  phaseLabel: string           // "thinking..." / "coding..." / etc.
  elapsed: number              // elapsed time (ms)
  estimatedRemaining?: number  // estimated remaining (ms, based on history)
  confidence: number           // estimate confidence
}

export interface AITaskStatus {
  state: AITaskState
  progress?: number
  lastActivity: number
  currentAction?: string
  phase?: AITaskPhase
  phaseLabel?: string
  progressEstimate?: ProgressEstimate
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
  alias?: string
  aliasColor?: string
  /** Fine-grained 7-state monitor state */
  monitorState?: AIMonitorState
  /** Auto-generated display name (e.g. "Claude Code-1") */
  autoName?: string
  metrics: {
    cpuHistory: number[]
    outputLineCount: number
    lastOutputTime: number
    idleDuration: number
    /** Output rate: lines per second (rolling average) */
    outputRate?: number
  }
}

// ============ AI Window Alias Types ============

export interface AIWindowAlias {
  id: string
  alias: string
  matchCriteria: {
    pid?: number
    commandHash?: string
    titlePrefix?: string
    executablePath?: string
    toolType: AIToolType
    workingDir?: string
  }
  createdAt: number
  lastMatchedAt: number
  color?: string
  /** Whether this alias was auto-generated (vs. user-defined) */
  autoGenerated?: boolean
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

// ============ AI Progress Timeline Types ============

export interface TimelineEntry {
  timestamp: string    // ISO
  status: AITaskState
  duration: number     // seconds this status lasted
  detail?: string      // optional context (e.g. "modifying App.tsx")
}

// ============ AI Tool Detection Config (per-tool) ============

export interface AIToolDetectionConfig {
  toolType: AIToolType
  completionKeywords: string[]
  errorKeywords: string[]
  promptPatterns: string[]      // serializable regex source strings
  cpuBaselineThreshold: number  // CPU % below which is considered idle
  confirmationWindowMs: number  // ms to wait before confirming completion
}

/** Fine-grained AI monitor state for the 7-state state machine */
export type AIMonitorState = 'idle' | 'thinking' | 'coding' | 'compiling' | 'waiting-input' | 'completed' | 'error'

export const AI_MONITOR_STATE_INFO: Record<AIMonitorState, { label: string; color: string; icon: string }> = {
  'idle':          { label: '空闲',     color: 'gray',   icon: 'pause' },
  'thinking':      { label: '思考中',   color: 'blue',   icon: 'brain' },
  'coding':        { label: '编码中',   color: 'green',  icon: 'keyboard' },
  'compiling':     { label: '编译中',   color: 'orange', icon: 'gear' },
  'waiting-input': { label: '等待输入', color: 'yellow', icon: 'hourglass' },
  'completed':     { label: '已完成',   color: 'green',  icon: 'check' },
  'error':         { label: '错误',     color: 'red',    icon: 'x' },
}

/** Default detection configs per AI tool */
export const DEFAULT_AI_TOOL_CONFIGS: Record<Exclude<AIToolType, 'other'>, AIToolDetectionConfig> = {
  'claude-code': {
    toolType: 'claude-code',
    completionKeywords: ['Done', 'Complete', 'Finished', 'finished', 'done', '✓', '✔'],
    errorKeywords: ['Error', 'Failed', 'error:', 'FAILED', 'panic', '✗', '✘'],
    promptPatterns: ['^\\s*[>$%#]\\s*$', '^\\s*❯\\s*$', '^\\s*>>>\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 3000,
  },
  'codex': {
    toolType: 'codex',
    completionKeywords: ['Done', 'Complete', 'Finished', '✓'],
    errorKeywords: ['Error', 'Failed', 'error:'],
    promptPatterns: ['^\\s*[>$%#]\\s*$', '^\\s*❯\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 3000,
  },
  'gemini-cli': {
    toolType: 'gemini-cli',
    completionKeywords: ['Done', 'Complete', 'Finished', '✓'],
    errorKeywords: ['Error', 'Failed', 'error:'],
    promptPatterns: ['^\\s*[>$%#]\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 3000,
  },
  'cursor': {
    toolType: 'cursor',
    completionKeywords: ['Done', 'Complete'],
    errorKeywords: ['Error', 'Failed'],
    promptPatterns: [],
    cpuBaselineThreshold: 5,
    confirmationWindowMs: 5000,
  },
  'opencode': {
    toolType: 'opencode',
    completionKeywords: ['Done', 'Complete', 'Finished', '✓'],
    errorKeywords: ['Error', 'Failed', 'error:'],
    promptPatterns: ['^\\s*[>$%#]\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 3000,
  },
}

/** Notification with additional window context */
export interface TaskCompletionNotification {
  taskId: string
  toolType: AIToolType
  toolName: string
  alias?: string
  pid: number
  windowHwnd?: number
  duration: number
  lastOutputLines?: string[]
  isError: boolean
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
  PROCESS_GET_FULL_RELATIONSHIP: 'process:get-full-relationship',
  PROCESS_GET_DEEP_DETAIL: 'process:get-deep-detail',
  PROCESS_GET_CONNECTIONS: 'process:get-connections',
  PROCESS_GET_ENVIRONMENT: 'process:get-environment',
  PROCESS_KILL_TREE: 'process:kill-tree',
  PROCESS_SET_PRIORITY: 'process:set-priority',
  PROCESS_OPEN_FILE_LOCATION: 'process:open-file-location',
  PROCESS_GET_MODULES: 'process:get-modules',
  PROCESS_UPDATED: 'process:updated',
  PROCESS_ZOMBIE_DETECTED: 'process:zombie-detected',
  PORT_SCAN: 'port:scan',
  PORT_CHECK: 'port:check',
  PORT_RELEASE: 'port:release',
  PORT_TOPOLOGY: 'port:topology',
  PORT_GET_FOCUS_DATA: 'port:get-focus-data',
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
  AI_ALIAS_GET_ALL: 'ai-alias:get-all',
  AI_ALIAS_SET: 'ai-alias:set',
  AI_ALIAS_REMOVE: 'ai-alias:remove',
  AI_TASK_GET_PROGRESS: 'ai-task:get-progress',
  AI_TASK_MARK_FALSE_POSITIVE: 'ai-task:mark-false-positive',
  AI_TASK_SET_DETECTION_CONFIG: 'ai-task:set-detection-config',
  AI_TASK_GET_DETECTION_CONFIG: 'ai-task:get-detection-config',
  WINDOW_RESTORE: 'window:restore-window',
  WINDOW_SET_TOPMOST: 'window:set-topmost',
  WINDOW_SET_OPACITY: 'window:set-opacity',
  WINDOW_SEND_KEYS: 'window:send-keys',
  WINDOW_TILE_LAYOUT: 'window:tile-layout',
  WINDOW_CASCADE_LAYOUT: 'window:cascade-layout',
  WINDOW_MINIMIZE_ALL: 'window:minimize-all',
  WINDOW_RESTORE_ALL: 'window:restore-all',
  WINDOW_ADD_TO_GROUP: 'window:add-to-group',
  WINDOW_RESTORE_GROUP: 'window:restore-group',
  NAVIGATE_TO_TASK: 'navigate-to-task',
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
  'opencode': {
    processPatterns: ['node.exe', 'opencode'],
    windowTitlePatterns: [/opencode/i],
    commandPatterns: [/opencode\s*/i]
  },
  'other': {
    processPatterns: [],
    windowTitlePatterns: [],
    commandPatterns: []
  }
}

/** Characters forbidden in window alias names */
export const ALIAS_FORBIDDEN_CHARS = /[<>:"/\\|?*]/

/** Max alias name length */
export const ALIAS_MAX_LENGTH = 50

/** Validate an alias name */
export function validateAliasName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { valid: false, error: 'Name cannot be empty' }
  if (trimmed.length > ALIAS_MAX_LENGTH) return { valid: false, error: `Name must be at most ${ALIAS_MAX_LENGTH} characters` }
  if (ALIAS_FORBIDDEN_CHARS.test(trimmed)) return { valid: false, error: 'Name contains forbidden characters: < > : " / \\ | ? *' }
  return { valid: true }
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

// ============ Scanner Cache Types (for preload/renderer) ============

export type ScannerType = 'processes' | 'ports' | 'windows' | 'aiTasks'

export interface ScannerDiff<T> {
  hasChanges: boolean
  added: T[]
  removed: T[]
  updated: Array<{ id: string; changes: Partial<T> }>
}

export interface ScannerCacheEntry<T> {
  data: T[]
  lastUpdated: number
  isScanning: boolean
  error: string | null
}

export interface SystemSummary {
  processCount: number
  activePortCount: number
  windowCount: number
  aiToolCount: number
  cpuTotal: number
  memoryUsedPercent: number
}

export interface ScannerCacheSnapshot {
  processes: ScannerCacheEntry<ProcessInfo>
  ports: ScannerCacheEntry<PortInfo>
  windows: ScannerCacheEntry<WindowInfo>
  aiTasks: ScannerCacheEntry<AITask>
  systemSummary: SystemSummary
}

export interface ScannerStatus {
  isActive: boolean
  scanStatus: Record<ScannerType, {
    isScanning: boolean
    lastUpdated: number
    error: string | null
  }>
}
