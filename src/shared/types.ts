// Shared type definitions for DevHub

export interface Project {
  id: string
  name: string
  path: string
  scripts: string[]
  defaultScript: string
  tags: string[]
  group?: string
  status: 'stopped' | 'running' | 'error'
  port?: number
  pid?: number
  createdAt: number
  updatedAt: number
}

export interface CodingTool {
  id: string
  name: 'codex' | 'claude-code' | 'gemini-cli' | 'cursor' | 'other'
  displayName: string
  processName: string
  completionPatterns: string[]
  status: 'idle' | 'running' | 'completed'
  lastRunAt?: number
  lastCompletedAt?: number
}

export interface LogEntry {
  projectId: string
  timestamp: number
  type: 'stdout' | 'stderr' | 'system'
  message: string
}

export interface AppConfig {
  projects: Project[]
  tools: CodingTool[]
  tags: string[]
  groups: string[]
  settings: AppSettings
}

export interface AppSettings {
  autoStartOnBoot: boolean
  minimizeToTray: boolean
  notificationEnabled: boolean
  checkInterval: number
  allowedPaths: string[]
  scanDrives: string[]  // 自定义扫描盘符，如 ['C', 'D', 'E']
  theme: 'dark' | 'light'
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Project management
  PROJECTS_LIST: 'projects:list',
  PROJECTS_GET: 'projects:get',
  PROJECTS_ADD: 'projects:add',
  PROJECTS_REMOVE: 'projects:remove',
  PROJECTS_UPDATE: 'projects:update',

  // Process management
  PROCESS_START: 'process:start',
  PROCESS_STOP: 'process:stop',
  PROCESS_STATUS: 'process:status',

  // Log events
  LOG_ENTRY: 'log:entry',
  LOG_CLEAR: 'log:clear',

  // Tool monitoring
  TOOL_STATUS: 'tool:status',
  TOOL_COMPLETE: 'tool:complete',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Window controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_CLOSE_CONFIRM: 'window:close-confirm',
  WINDOW_HIDE_TO_TRAY: 'window:hide-to-tray',
  WINDOW_FORCE_CLOSE: 'window:force-close'
} as const

// Default coding tools configuration
export const DEFAULT_TOOLS: CodingTool[] = [
  {
    id: 'codex',
    name: 'codex',
    displayName: 'Codex CLI',
    processName: 'codex',
    completionPatterns: ['Done', 'Completed', 'Finished'],
    status: 'idle'
  },
  {
    id: 'claude-code',
    name: 'claude-code',
    displayName: 'Claude Code',
    processName: 'claude',
    completionPatterns: ['Done', 'Complete'],
    status: 'idle'
  },
  {
    id: 'gemini-cli',
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    processName: 'gemini',
    completionPatterns: ['Done', 'Finished'],
    status: 'idle'
  }
]

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  autoStartOnBoot: false,
  minimizeToTray: false,  // 默认关闭时直接退出，不最小化到托盘
  notificationEnabled: true,
  checkInterval: 3000,
  allowedPaths: [],
  scanDrives: ['C', 'D'],  // 默认扫描 C 和 D 盘
  theme: 'dark'
}
