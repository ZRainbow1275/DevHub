import { z } from 'zod'

import { DEFAULT_PORT_POPOUT_SYNC_POLICY } from './types'

// Extended type definitions for DevHub Pro

// ============ Shared Service Result Type ============

export interface ServiceResult<T = undefined> {
  success: boolean
  data?: T
  error?: string
}

// ============ Process Monitoring Types ============

export type ProcessType = 'dev-server' | 'ai-tool' | 'build' | 'database' | 'other'
export type ProcessStatusType = 'running' | 'idle' | 'waiting' | 'unknown'

export interface ProcessInfo {
  pid: number
  ppid?: number
  parentName?: string
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
  ancestorChain: LegacyProcessTreeNode[]
  children: LegacyProcessTreeNode[]
  relatedProcesses: RelatedProcessInfo[]
  requiresElevation?: boolean
}

export interface AccessReport {
  pid: number
  elevationRequired: boolean
  scanAttempted: boolean
  scanResult: 'ok' | 'access-denied' | 'not-found' | 'timeout' | 'wmi-error'
  currentUser: string
  targetProcessUser?: string
  suggestion: 'relaunch-as-admin' | 'retry' | 'none'
  triedAt: number
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

export interface LegacyProcessTreeNode {
  pid: number
  name: string
  cpuPercent: number
  memoryMB: number
  children?: LegacyProcessTreeNode[]
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
  source?: 'systeminformation' | 'netstat' | 'scanner-cache'
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

/** Response from the incremental port detail query (cache-first strategy). */
export interface PortDetailIncrementalResult {
  data: PortFocusData | null
  source: 'cache' | 'incremental' | 'timeout'
  isStale: boolean
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

// ============ Port Popout Contracts ============

export const ZIndexTier = {
  BASE: 0,
  HOVER: 100,
  TOOLBAR: 1000,
  DRAWER: 2000,
  MODAL: 3000,
  POPOUT: 4000,
  TOAST: 5000,
  COMMAND_PALETTE: 6000,
  WATCHDOG_ALERT: 7000,
  DEVTOOLS: 8000,
  SYSTEM_OVERLAY: 9000
} as const

export const POPOUT_TRIGGER_VALUES = ['hover', 'click', 'drag', 'context-menu', 'cmdk', 'api'] as const
export const PopoutTriggerSchema = z.enum(POPOUT_TRIGGER_VALUES)
export const PortPopoutTriggerSchema = PopoutTriggerSchema
export type PortPopoutTrigger = z.infer<typeof PopoutTriggerSchema>

export const POPOUT_SYNC_DIRECTION_VALUES = ['both', 'main-to-popout', 'popout-to-main', 'isolated'] as const
export const PopoutSyncDirectionSchema = z.enum(POPOUT_SYNC_DIRECTION_VALUES)

export const PortPopoutPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
})
export type PortPopoutPosition = z.infer<typeof PortPopoutPositionSchema>

export const PortPopoutSizeSchema = z.object({
  width: z.number().finite().min(280),
  height: z.number().finite().min(200)
})
export type PortPopoutSize = z.infer<typeof PortPopoutSizeSchema>

export const PopoutSyncPolicySchema = z.object({
  selection: z.boolean().default(true),
  filters: z.boolean().default(true),
  sort: z.boolean().default(true),
  search: z.boolean().default(true),
  theme: z.boolean().default(true),
  density: z.boolean().default(true),
  hover: z.boolean().default(false),
  scroll: z.boolean().default(false),
  direction: PopoutSyncDirectionSchema.default('both')
})

export type PopoutSyncPolicyContract = z.infer<typeof PopoutSyncPolicySchema>

export const PORT_POPOUT_VIEW_MODE_VALUES = ['cards', 'list', 'relationship'] as const
export const PortPopoutViewModeSchema = z.enum(PORT_POPOUT_VIEW_MODE_VALUES)
export type PortPopoutViewMode = z.infer<typeof PortPopoutViewModeSchema>

export const PORT_POPOUT_FILTER_VALUES = ['all', 'common', 'listening', 'exposed'] as const
export const PortPopoutFilterSchema = z.enum(PORT_POPOUT_FILTER_VALUES)
export type PortPopoutFilter = z.infer<typeof PortPopoutFilterSchema>

export const PortPopoutViewSyncStateSchema = z.object({
  selectedPort: z.number().int().nullable(),
  filter: PortPopoutFilterSchema,
  searchPort: z.string().max(128),
  viewMode: PortPopoutViewModeSchema
}).strict()

export type PortPopoutViewSyncState = z.infer<typeof PortPopoutViewSyncStateSchema>

export const POPOUT_LIMITS = {
  MAX_FLOATING: 5,
  MAX_TOTAL: 8,
  DRAG_DISTANCE_THRESHOLD_PX: 8,
  HOVER_DELAY_MS: 1000,
  CARD_MIN_W: 280,
  CARD_MIN_H: 200,
  CARD_DEFAULT_W: 360,
  CARD_DEFAULT_H: 280,
  RSS_PER_POPOUT_MB: 100,
  RSS_TOTAL_MB: 500,
  AUTO_EVICT_IDLE_MIN: 30,
  Z_INDEX_BASE: ZIndexTier.POPOUT,
  Z_INDEX_RANGE: 999
} as const

export const PORT_POPOUT_LIMITS = POPOUT_LIMITS

export const PortPopoutSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('port-detail').default('port-detail'),
  port: z.number().int().min(1).max(65535),
  pid: z.number().int().nonnegative(),
  trigger: PopoutTriggerSchema,
  mode: z.enum(['floating', 'browserwindow']),
  position: PortPopoutPositionSchema,
  size: PortPopoutSizeSchema,
  zIndex: z.number().int().min(POPOUT_LIMITS.Z_INDEX_BASE).max(POPOUT_LIMITS.Z_INDEX_BASE + POPOUT_LIMITS.Z_INDEX_RANGE),
  pinned: z.boolean().default(false),
  minimized: z.boolean().default(false),
  alwaysOnTop: z.boolean().default(false),
  syncPolicy: PopoutSyncPolicySchema.default(DEFAULT_PORT_POPOUT_SYNC_POLICY),
  createdAt: z.number().int().nonnegative(),
  lastInteractedAt: z.number().int().nonnegative(),
  monitorId: z.number().int().optional(),
  themeOverride: z.string().optional()
})

export type PortPopoutContract = z.infer<typeof PortPopoutSchema>

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

export type WindowOperationKind =
  | 'focus'
  | 'minimize'
  | 'maximize'
  | 'restore'
  | 'move-resize'
  | 'toggle-always-on-top'
  | 'set-opacity'
  | 'screenshot'
  | 'close'
  | 'kill-process'
  | 'jump-process'
  | 'jump-port'
  | 'jump-ai-task'
  | 'toggle-favorite'
  | 'open-working-dir'
  | 'open-project'
  | 'copy-title'
  | 'set-title'
  | 'send-safe-keys'

export type WindowOperationCategory = 'state' | 'capture' | 'navigation' | 'metadata' | 'danger'

export interface WindowOperationCatalogItem {
  kind: WindowOperationKind
  label: string
  description: string
  category: WindowOperationCategory
  requires?: Array<'pid' | 'port' | 'ai-task' | 'project' | 'clipboard'>
  danger?: boolean
}

export interface WindowFavoriteRecord {
  id: string
  fingerprintHash: string
  hwnd: number
  title: string
  processName: string
  pid: number
  className?: string
  createdAt: number
  updatedAt: number
}

export interface WindowFavoriteToggleResult {
  favorite: boolean
  record: WindowFavoriteRecord
}

export interface WindowScreenshotResult {
  hwnd: number
  path: string
  directory: string
  width: number
  height: number
  createdAt: number
  source: 'win32-copy-from-screen' | 'electron-capture-page'
}

export interface WindowOpenDirectoryResult {
  hwnd: number
  pid: number
  directory: string
  source: 'process-executable-directory'
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

export type GroupColorTag = 'red' | 'amber' | 'yellow' | 'green' | 'teal' | 'blue' | 'indigo' | 'violet' | 'slate'

export type WindowGroupKind = 'user' | 'auto-ai-cli' | 'auto-browser' | 'auto-editor' | 'auto-terminal'

export interface WindowFingerprint {
  processName: string
  titlePattern: {
    kind: 'exact' | 'prefix' | 'regex'
    value: string
  }
  classNameHint?: string
  workingDirHint?: string
  toolTypeHint?: AIToolType
  hashKey: string
  createdAt: number
}

export interface WindowGroupMembership {
  groupId: string
  hwnd: number
  resolvedFromFingerprintHash: string
  lastResolvedAt: number
  confidence: number
}

export interface HwndResolutionReport {
  groupId: string
  resolvedAt: number
  matched: Array<{ fingerprintHash: string; hwnd: number; confidence: number }>
  unmatched: string[]
  ambiguous: Array<{ fingerprintHash: string; candidates: number[] }>
}

export interface WindowGroup {
  id: string
  name: string
  projectId?: string
  windows: WindowInfo[]
  createdAt: number
  updatedAt?: number
  colorTag?: GroupColorTag
  kind?: WindowGroupKind
  memberFingerprints?: WindowFingerprint[]
  resolvedMembership?: WindowGroupMembership[]
  resolutionReport?: HwndResolutionReport
}

export type LayoutWindowState = 'normal' | 'minimized' | 'maximized'

export type TilePreset =
  | 'tile-2x2'
  | 'tile-3x3'
  | 'tile-3x2'
  | 'tile-horizontal'
  | 'tile-vertical'
  | 'tile-auto'
  | 'cascade'
  | 'stack-center'

export type LayoutErrorCode =
  | 'WINDOW_NOT_FOUND'
  | 'WIN32_SETPOS_FAILED'
  | 'MONITOR_OUT_OF_RANGE'
  | 'MINIMIZED_CANNOT_REPOSITION'
  | 'PRESET_REQUIRES_HWNDS'
  | 'SNAPSHOT_NOT_FOUND'
  | 'SNAPSHOT_MEMBERS_ALL_GONE'
  | 'MULTI_DPI_FACTOR_UNKNOWN'
  | 'RESTORE_POINT_EXPIRED'
  | 'LAYOUT_MULTI_MONITOR_MISMATCH'

export interface WindowLayoutSnapshotItem {
  fingerprintHash: string
  windowFingerprint?: WindowFingerprint
  hwnd?: number
  processName: string
  titlePattern: string
  className?: string
  rect: WindowInfo['rect']
  zOrderIdx: number
  state: LayoutWindowState
}

export interface WindowLayoutSnapshot {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  monitorId?: number
  items: WindowLayoutSnapshotItem[]
  restorePoint?: boolean
}

export interface ApplyLayoutIntent {
  preset?: TilePreset
  snapshotId?: string
  customRects?: Array<{ hwnd: number; rect: WindowInfo['rect'] }>
  hwnds?: number[]
  monitorId?: number
  saveRestorePoint?: boolean
}

export interface ApplyLayoutResult {
  ok: boolean
  applied: Array<{ hwnd: number; prevRect: WindowInfo['rect']; newRect: WindowInfo['rect'] }>
  failed: Array<{ hwnd: number; error: LayoutErrorCode; message?: string }>
  restorePointId?: string
  snapshotId?: string
}

export interface MonitorInfo {
  id: number
  label: string
  bounds: WindowInfo['rect']
  workArea: WindowInfo['rect']
  scaleFactor: number
  primary: boolean
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

export type AIToolType = 'codex' | 'claude-code' | 'gemini-cli' | 'cursor' | 'opencode' | 'aider' | 'windsurf' | 'continue-dev' | 'cline' | 'other'
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
  /** Fine-grained 12-state monitor state */
  monitorState?: AIMonitorState
  /** Auto-generated display name (e.g. "Claude Code-1") */
  autoName?: string
  metrics: {
    cpuHistory: number[]
    outputLineCount: number
    lastOutputTime: number
    idleDuration: number
    /** Output rate: bytes per second from I/O counter delta */
    outputRate?: number
  }
  /** Detection signal details for frontend display */
  detectionSignals?: {
    /** 0-1, combined completion score from all signals */
    completionScore: number
    /** 0-1, confidence in current phase detection */
    phaseConfidence: number
    /** Names of currently active detection indicators */
    activeIndicators: string[]
    /** Per-signal weighted contributions captured for observability/calibration */
    signalContributions?: SignalContribution[]
    /** Whether the task is in a confirmation window before final completion */
    inConfirmationWindow: boolean
    /** Remaining milliseconds in confirmation window, if active */
    confirmationRemainingMs?: number
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
  /** Last external title applied through Win32 SetWindowText. */
  appliedExternalTitle?: {
    hwnd: number
    originalTitle: string
    appliedTitle: string
    appliedAt: number
  }
}

export interface AIRenameAndApplyRequest {
  alias: AIWindowAlias
  newName: string
  hwnd: number
  pid: number
  toolType: AIToolType
  toolDisplayName: string
  originalTitle: string
  applyToExternalWindow?: boolean
  requestedAt: number
}

export interface AIRenameAndApplyResult {
  success: boolean
  alias?: AIWindowAlias
  titleApplied: boolean
  appliedTitle?: string
  error?: string
  code?:
    | 'ALIAS_NAME_INVALID'
    | 'ALIAS_SCHEMA_INVALID'
    | 'ALIAS_PERSIST_WRITE_FAILED'
    | 'WINDOW_MANAGER_UNAVAILABLE'
    | 'WINDOW_SET_TITLE_FAILED'
    | 'ROLLBACK_FAILED'
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
  taskAlias?: string
  windowHwnd?: number
}

export interface AICompletionOracleEvent {
  alias: string
  completedAt: number
  hookEventName: string
  source: 'claude-code-hook' | 'bench' | 'runtime'
  cwd?: string
  sessionId?: string
  taskKey?: string
  transcriptPath?: string
}

export interface AICompletionOracleRecord {
  history: AITaskHistory
  confidenceReport: ConfidenceReport
}

// ============ AI Progress Timeline Types ============

export interface TimelineEntry {
  timestamp: string    // ISO
  status: AITaskState
  /** Fine-grained monitor state at this timeline point. */
  monitorState?: AIMonitorState
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

export interface ToolProfile extends AIToolDetectionConfig {
  signalWeights: {
    cliParse?: number
    terminalKeywords: number
    cpuIdle: number
    lowOutputRate: number
    promptDetected: number
    childProcessExit: number
    timeThreshold: number
  }
  minHoldMs?: Partial<Record<AIMonitorState, number>>
}

export type DetectionSignalName =
  | 'cli_parse'
  | 'terminal_keywords'
  | 'cpu_idle'
  | 'low_output_rate'
  | 'prompt_detected'
  | 'child_process_exit'
  | 'time_threshold'

export type DetectionSignalKind = 'textual' | 'numeric' | 'event'

export interface SignalResult<V = number | boolean | string> {
  name: DetectionSignalName
  kind: DetectionSignalKind
  raw: V
  normalized: number
  confidence: number
  triggeredAt?: number
  reason: string
}

export interface SignalContribution {
  name: DetectionSignalName
  result: SignalResult
  weight: number
  weightedContribution: number
}

export interface CalibrationSample {
  taskKey: string
  toolType: AIToolType
  capturedAt: number
  expected: 'completed' | 'running' | 'error' | 'cancelled'
  observed: AITaskState | 'cancelled'
  signals: Partial<Record<DetectionSignalName, number>>
  completionDelayMs?: number
  source: 'manual' | 'bench' | 'runtime'
  notes?: string
}

export interface CalibrationResult {
  accepted: boolean
  toolType: AIToolType
  sampleCount: number
  updated: boolean
  weights: ToolProfile['signalWeights']
  reason?: string
}

export interface ConfidenceReport {
  taskKey: string
  taskId: string
  toolType: AIToolType
  state: AITaskState
  monitorState?: AIMonitorState
  completionScore: number
  threshold: number
  phaseConfidence: number
  activeIndicators: string[]
  signalContributions?: SignalContribution[]
  inConfirmationWindow: boolean
  confirmationRemainingMs?: number
  updatedAt: number
  narrative: string
}

export interface StateTransition extends TimelineEntry {
  taskKey: string
  monitorState?: AIMonitorState
}

/** Fine-grained AI monitor state for the 12-state state machine */
export type AIMonitorState =
  | 'initializing'
  | 'idle'
  | 'thinking'
  | 'receiving-input'
  | 'coding'
  | 'compiling'
  | 'validating'
  | 'waiting-input'
  | 'awaiting-human'
  | 'stuck'
  | 'completed'
  | 'error'

export const AI_MONITOR_STATE_INFO: Record<AIMonitorState, { label: string; color: string; icon: string }> = {
  'initializing':  { label: '初始化',   color: 'blue',   icon: 'loader' },
  'idle':          { label: '空闲',     color: 'gray',   icon: 'pause' },
  'thinking':      { label: '思考中',   color: 'blue',   icon: 'brain' },
  'receiving-input': { label: '接收输入', color: 'blue',   icon: 'inbox' },
  'coding':        { label: '编码中',   color: 'green',  icon: 'keyboard' },
  'compiling':     { label: '编译中',   color: 'orange', icon: 'gear' },
  'validating':    { label: '确认中',   color: 'blue',   icon: 'check' },
  'waiting-input': { label: '等待输入', color: 'yellow', icon: 'hourglass' },
  'awaiting-human': { label: '等待人工', color: 'yellow', icon: 'user-check' },
  'stuck':         { label: '疑似卡死', color: 'red',    icon: 'alert' },
  'completed':     { label: '已完成',   color: 'green',  icon: 'check' },
  'error':         { label: '错误',     color: 'red',    icon: 'x' },
}

/** Default detection configs per AI tool */
export const DEFAULT_AI_TOOL_CONFIGS: Record<Exclude<AIToolType, 'other'>, AIToolDetectionConfig> = {
  'claude-code': {
    toolType: 'claude-code',
    completionKeywords: ['Done', 'Complete', 'Finished', 'finished', 'done', '\u2713', '\u2714'],
    errorKeywords: ['Error', 'Failed', 'error:', 'FAILED', 'panic', '\u2717', '\u2718'],
    promptPatterns: ['^\\s*[>$%#]\\s*$', '^\\s*\u276f\\s*$', '^\\s*>>>\\s*$'],
    cpuBaselineThreshold: 1,
    confirmationWindowMs: 8000,
  },
  'codex': {
    toolType: 'codex',
    completionKeywords: ['Done', 'Complete', 'Finished', 'Ready', '\u2713'],
    errorKeywords: ['Error', 'Failed', 'error:'],
    promptPatterns: ['^\\s*[>$%#]\\s*$', '^\\s*\u276f\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 8000,
  },
  'gemini-cli': {
    toolType: 'gemini-cli',
    completionKeywords: ['Done', 'Complete', 'Finished', '\u2713'],
    errorKeywords: ['Error', 'Failed', 'error:'],
    promptPatterns: ['^\\s*[>$%#]\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 8000,
  },
  'cursor': {
    toolType: 'cursor',
    completionKeywords: ['Done', 'Complete'],
    errorKeywords: ['Error', 'Failed'],
    promptPatterns: [],
    cpuBaselineThreshold: 5,
    confirmationWindowMs: 8000,
  },
  'opencode': {
    toolType: 'opencode',
    completionKeywords: ['Done', 'Complete', 'Finished', '\u2713'],
    errorKeywords: ['Error', 'Failed', 'error:'],
    promptPatterns: ['^\\s*[>$%#]\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 8000,
  },
  'aider': {
    toolType: 'aider',
    completionKeywords: ['Done', 'Complete', 'Finished', '\u2713', 'aider>'],
    errorKeywords: ['Error', 'Failed', 'error:', 'Traceback'],
    promptPatterns: ['^\\s*aider>\\s*$', '^\\s*[>$%#]\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 8000,
  },
  'windsurf': {
    toolType: 'windsurf',
    completionKeywords: ['Done', 'Complete'],
    errorKeywords: ['Error', 'Failed'],
    promptPatterns: [],
    cpuBaselineThreshold: 5,
    confirmationWindowMs: 8000,
  },
  'continue-dev': {
    toolType: 'continue-dev',
    completionKeywords: ['Done', 'Complete', 'Finished', '\u2713'],
    errorKeywords: ['Error', 'Failed', 'error:'],
    promptPatterns: ['^\\s*[>$%#]\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 8000,
  },
  'cline': {
    toolType: 'cline',
    completionKeywords: ['Done', 'Complete', 'Finished', 'Task completed', '\u2713'],
    errorKeywords: ['Error', 'Failed', 'error:'],
    promptPatterns: ['^\\s*[>$%#]\\s*$'],
    cpuBaselineThreshold: 3,
    confirmationWindowMs: 8000,
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
  | 'task-error'
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
  metadata?: Record<string, unknown>
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

export interface AITaskStatistics {
  totalTasks: number
  completedTasks: number
  errorTasks: number
  avgDuration: number
  byTool: Record<AIToolType, number>
}

// ============ Extended IPC Channels ============

export const IPC_CHANNELS_EXT = {
  PROCESS_SCAN: 'process:scan',
  PROCESS_KILL: 'process:kill',
  PROCESS_CLEANUP_ZOMBIES: 'process:cleanup-zombies',
  PROCESS_GET_FULL_RELATIONSHIP: 'process:get-full-relationship',
  PROCESS_GET_DEEP_DETAIL: 'process:get-deep-detail',
  PROCESS_PROBE_ACCESS: 'process:probe-access',
  PROCESS_GET_CONNECTIONS: 'process:get-connections',
  PROCESS_GET_ENVIRONMENT: 'process:get-environment',
  PROCESS_KILL_TREE: 'process:kill-tree',
  PROCESS_SET_PRIORITY: 'process:set-priority',
  PROCESS_OPEN_FILE_LOCATION: 'process:open-file-location',
  PROCESS_GET_MODULES: 'process:get-modules',
  APP_RELAUNCH_AS_ADMIN: 'app:relaunch-as-admin',
  PROCESS_UPDATED: 'process:updated',
  PROCESS_ZOMBIE_DETECTED: 'process:zombie-detected',
  PORT_SCAN: 'port:scan',
  PORT_CHECK: 'port:check',
  PORT_RELEASE: 'port:release',
  PORT_TOPOLOGY: 'port:topology',
  PORT_GET_FOCUS_DATA: 'port:get-focus-data',
  PORT_CONFLICT: 'port:conflict',
  TOPOLOGY_BUILD_SCOPED_GRAPH: 'topology:build-scoped-graph',
  TOPOLOGY_WARM_SCOPE: 'topology:warm-scope',
  FLOW_BUILD_SCOPED_FLOW: 'flow:build-scoped-flow',
  WINDOW_SCAN: 'window:scan',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_MOVE: 'window:move',
  WINDOW_MINIMIZE: 'window:minimize-window',
  WINDOW_MAXIMIZE: 'window:maximize-window',
  WINDOW_CLOSE: 'window:close-window',
  WINDOW_CREATE_GROUP: 'window:create-group',
  WINDOW_GET_GROUPS: 'window:get-groups',
  WINDOW_REMOVE_GROUP: 'window:remove-group',
  WINDOW_RENAME_GROUP: 'window:rename-group',
  WINDOW_FOCUS_GROUP: 'window:focus-group',
  WINDOW_SAVE_LAYOUT: 'window:save-layout',
  WINDOW_RESTORE_LAYOUT: 'window:restore-layout',
  WINDOW_GET_LAYOUTS: 'window:get-layouts',
  WINDOW_REMOVE_LAYOUT: 'window:remove-layout',
  WINDOW_APPLY_LAYOUT: 'window:apply-layout',
  WINDOW_SAVE_SNAPSHOT: 'window:save-snapshot',
  WINDOW_UPDATE_SNAPSHOT: 'window:update-snapshot',
  WINDOW_DELETE_SNAPSHOT: 'window:delete-snapshot',
  WINDOW_RESTORE_SNAPSHOT: 'window:restore-snapshot',
  WINDOW_LIST_SNAPSHOTS: 'window:list-snapshots',
  WINDOW_PREVIEW_LAYOUT: 'window:preview-layout',
  WINDOW_RESTORE_PREVIOUS: 'window:restore-previous',
  WINDOW_GET_MONITOR_INFO: 'window:get-monitor-info',
  WINDOW_TILE_GROUP: 'window:tile-group',
  WINDOW_SCREENSHOT: 'window:screenshot',
  WINDOW_TOGGLE_FAVORITE: 'window:toggle-favorite',
  WINDOW_GET_FAVORITES: 'window:get-favorites',
  WINDOW_OPEN_WORKING_DIR: 'window:open-working-dir',
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
  AI_ALIAS_RENAME: 'ai-alias:rename',
  AI_ALIAS_RENAME_AND_APPLY: 'ai-alias:rename-and-apply',
  AI_TASK_GET_PROGRESS: 'ai-task:get-progress',
  AI_TASK_MARK_FALSE_POSITIVE: 'ai-task:mark-false-positive',
  AI_TASK_SET_DETECTION_CONFIG: 'ai-task:set-detection-config',
  AI_TASK_GET_DETECTION_CONFIG: 'ai-task:get-detection-config',
  AI_TASK_GET_CONFIDENCE_REPORT: 'ai-task:get-confidence-report',
  AI_TASK_RECORD_COMPLETION_ORACLE: 'ai-task:record-completion-oracle',
  AI_TASK_GET_STATE_HISTORY: 'ai-task:get-state-history',
  AI_TASK_GET_PROFILE: 'ai-task:get-profile',
  AI_TASK_SET_PROFILE: 'ai-task:set-profile',
  AI_TASK_CALIBRATE: 'ai-task:calibrate',
  WINDOW_RESTORE: 'window:restore-window',
  WINDOW_SET_TOPMOST: 'window:set-topmost',
  WINDOW_ALWAYS_ON_TOP: 'window:always-on-top',
  WINDOW_GET_TOPMOST: 'window:get-topmost',
  WINDOW_LIST_TOPMOST: 'window:list-topmost',
  WINDOW_SET_OPACITY: 'window:set-opacity',
  WINDOW_SET_TITLE: 'window:set-title',
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
  NOTIFICATION_ACTION: 'notification:action',
  PROJECT_GET_GIT_INFO: 'project:get-git-info',
  PROJECT_GET_DEPENDENCIES: 'project:get-dependencies'
} as const

// AI Tool Signatures for Detection
export const AI_TOOL_SIGNATURES: Record<AIToolType, {
  processPatterns: string[]
  windowTitlePatterns: RegExp[]
  commandPatterns: RegExp[]
}> = {
  'codex': {
    processPatterns: ['codex.exe', 'node.exe'],
    windowTitlePatterns: [/codex/i, /openai/i],
    commandPatterns: [/@openai\/codex/i, /codex\s+/i]
  },
  'claude-code': {
    processPatterns: ['claude.exe', 'node.exe'],
    windowTitlePatterns: [/claude/i, /anthropic/i],
    commandPatterns: [/@anthropic-ai\/claude-code/i, /\bclaude-code\b/i, /\bclaude\b/i]
  },
  'gemini-cli': {
    processPatterns: ['gemini.exe', 'node.exe'],
    windowTitlePatterns: [/gemini/i, /google/i],
    commandPatterns: [/@google\/gemini-cli/i, /gemini-cli/i, /gemini\s+/i]
  },
  'cursor': {
    processPatterns: ['Cursor.exe'],
    windowTitlePatterns: [/cursor/i],
    commandPatterns: []
  },
  'opencode': {
    processPatterns: ['opencode.exe', 'node.exe'],
    windowTitlePatterns: [/opencode/i],
    commandPatterns: [/\bopencode\b/i]
  },
  'aider': {
    processPatterns: ['aider.exe', 'python.exe', 'python3.exe'],
    windowTitlePatterns: [/aider/i],
    commandPatterns: [/\baider\b/i]
  },
  'windsurf': {
    processPatterns: ['Windsurf.exe'],
    windowTitlePatterns: [/windsurf/i],
    commandPatterns: []
  },
  'continue-dev': {
    processPatterns: ['node.exe'],
    windowTitlePatterns: [/continue/i],
    commandPatterns: [/\bcontinue\b/i, /@continue\/extension/i]
  },
  'cline': {
    processPatterns: ['node.exe'],
    windowTitlePatterns: [/cline/i],
    commandPatterns: [/\bcline\b/i]
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
export const ALIAS_MAX_LENGTH = 64

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
  'codex', 'claude', 'gemini', 'opencode', 'aider',
  'Windsurf.exe',
  // 容器
  'docker.exe'
] as const

// ============ Project Git Info Types ============

export interface GitInfo {
  branch: string
  uncommittedCount: number
  recentCommits: GitCommitSummary[]
  aheadBehind: { ahead: number; behind: number }
}

export interface GitCommitSummary {
  hash: string
  message: string
  author: string
  date: string
}

// ============ Project Dependency Types ============

export type LockfileType = 'npm' | 'yarn' | 'pnpm' | 'none'

export interface DependencyEntry {
  name: string
  version: string
}

export interface ProjectDependencies {
  dependencies: DependencyEntry[]
  devDependencies: DependencyEntry[]
  lockfileType: LockfileType
}

// ============ Project Sort Types ============

export type ProjectSortField = 'name' | 'status' | 'type' | 'recentRun' | 'createdAt'
export type ProjectSortDirection = 'asc' | 'desc'

export interface ProjectSortConfig {
  field: ProjectSortField
  direction: ProjectSortDirection
}

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

export type ScannerDiffChannel =
  | 'scanner:processes:diff'
  | 'scanner:ports:diff'
  | 'scanner:windows:diff'
  | 'scanner:aiTasks:diff'

export type ScannerChannelSeqMap = Partial<Record<ScannerDiffChannel, number>>

export interface ScannerSnapshotPushPayload {
  snapshot: ScannerCacheSnapshot
  channelSeqs?: ScannerChannelSeqMap
}

export interface ScannerResyncResponse {
  accepted: boolean
  channel: string
  snapshotPushed: boolean
}

export type ScannerAckSource = 'diff' | 'snapshot'

export interface ScannerAckRequest {
  channel: string
  seq: number
  source?: ScannerAckSource
}

export interface ScannerAckResponse {
  accepted: boolean
  channel: string
  ackedSeq: number
  lastSentSeq: number | null
  pendingSeq: number | null
}

export interface IPCEnvelopeMeta {
  causedBy?: string
  truncated?: boolean
}

export interface IPCEnvelope<TPayload> {
  channel: string
  seq: number
  timestamp: number
  batch: boolean
  partial: boolean
  payload: TPayload
  meta?: IPCEnvelopeMeta
}

// ============ Type Guards ============

/**
 * Runtime type guard for AIWindowAlias. Validates required fields:
 * id (string), alias (string), matchCriteria (non-null object).
 * Optional fields (createdAt, lastMatchedAt, color, autoGenerated) are not
 * enforced here — upstream validators handle numeric/format checks.
 */
export function isAIWindowAlias(v: unknown): v is AIWindowAlias {
  if (!v || typeof v !== 'object') return false
  const a = v as Record<string, unknown>
  return typeof a.id === 'string'
    && typeof a.alias === 'string'
    && !!a.matchCriteria
    && typeof a.matchCriteria === 'object'
    && !Array.isArray(a.matchCriteria)
}
