// Shared type definitions for DevHub

// Multi-ecosystem project type detection
export type ProjectType =
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'venv'
  | 'conda'
  | 'poetry'
  | 'rust'
  | 'go'
  | 'java-maven'
  | 'java-gradle'
  | 'unknown'

export type ProjectOpenTarget = 'vscode' | 'cursor' | 'explorer' | 'terminal'

export interface Project {
  id: string
  name: string
  path: string
  scripts: string[]
  defaultScript: string
  projectType: ProjectType
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
  name: 'codex' | 'claude-code' | 'gemini-cli' | 'cursor' | 'opencode' | 'aider' | 'windsurf' | 'continue-dev' | 'cline' | 'other'
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

export type ThemeOption = 'constructivism' | 'modern-light' | 'warm-light' | 'cyberpunk' | 'swiss' | 'dark' | 'light'
export type FontSize = 'small' | 'medium' | 'large'
export type SidebarPosition = 'left' | 'right'
export const LAYOUT_MODE_VALUES = ['auto', 'split', 'stacked'] as const
export type LayoutMode = typeof LAYOUT_MODE_VALUES[number]
export const LAYOUT_MODE_STORAGE_KEY = 'devhub:layout-mode'
export const LAYOUT_MODE_CHANGE_EVENT = 'devhub:layout-mode-change'
export const APP_SETTINGS_CHANGE_EVENT = 'devhub:settings-change'
export type InformationDensity = 'compact' | 'standard' | 'comfortable'
export type RadiusFamily = 'sharp' | 'soft' | 'round'
export type MotionLevel = 'reduced' | 'balanced' | 'expressive'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export const THEME_DECORATION_KIND_VALUES = [
  'none',
  'soviet-geo',
  'diagonals',
  'paper',
  'scanline',
  'grid',
  'golden',
  'noise',
  'blocks',
  'custom-svg'
] as const
export type ThemeDecorationKind = typeof THEME_DECORATION_KIND_VALUES[number]
export const THEME_DECORATION_POSITION_VALUES = [
  'card-background',
  'detail-panel-background',
  'global-background',
  'statusbar-background',
  'empty-state',
  'header'
] as const
export type ThemeDecorationPosition = typeof THEME_DECORATION_POSITION_VALUES[number]
export type ThemeDecorationBlendMode = 'normal' | 'multiply' | 'overlay' | 'screen'

export interface ThemeDecorationConfig {
  kind: ThemeDecorationKind
  customSvgId?: string
  opacity: number
  positions: ThemeDecorationPosition[]
  blendMode: ThemeDecorationBlendMode
  scale: number
  motionRespect: boolean
}

export interface CustomSvgEntry {
  id: string
  name: string
  sanitizedContent: string
  uploadedAt: number
  size: number
  hash: string
}

export interface ThemeSoundConfig {
  themeId: ThemeOption
  enabled: boolean
  volume: number
  events: {
    hover?: string
    click?: string
    notify?: string
    error?: string
    success?: string
  }
}

export interface AppearanceSettings {
  theme: ThemeOption
  followSystemTheme: boolean
  fontSize: FontSize
  sidebarPosition: SidebarPosition
  compactMode: boolean
  enableAnimations: boolean
  holidayDecorationsEnabled: boolean
  holidayAutoPromptEnabled: boolean
  holidayFocusMode: boolean
  layoutMode: LayoutMode
  informationDensity: InformationDensity
  radiusFamily: RadiusFamily
  motionLevel: MotionLevel
  decoration?: ThemeDecorationConfig
}

export interface ScanSettings {
  scanDrives: string[]
  allowedPaths: string[]
  excludePaths: string[]
  checkInterval: number
  maxScanDepth: number
  fileTypeFilters: string[]
}

export interface ProcessSettings {
  enabled: boolean
  scanInterval: number
  autoCleanZombies: boolean
  zombieThresholdMinutes: number
  cpuWarningThreshold: number
  memoryWarningThresholdMB: number
  whitelist: string[]
  blacklist: string[]
}

export interface NotificationSettings {
  enabled: boolean
  typeToggles: Record<string, boolean>
  sound: boolean
  persistent: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string  // HH:mm format
  quietHoursEnd: string    // HH:mm format
}

export interface PortPopoutTriggerSettings {
  hover: boolean
  click: boolean
  drag: boolean
  contextMenu: boolean
}

export const PORT_POPOUT_SYNC_DIRECTION_VALUES = ['both', 'main-to-popout', 'popout-to-main', 'isolated'] as const
export type PortPopoutSyncDirection = typeof PORT_POPOUT_SYNC_DIRECTION_VALUES[number]

export interface PortPopoutSyncPolicy {
  selection: boolean
  filters: boolean
  sort: boolean
  search: boolean
  theme: boolean
  density: boolean
  hover: boolean
  scroll: boolean
  direction: PortPopoutSyncDirection
}

export const DEFAULT_PORT_POPOUT_SYNC_POLICY: PortPopoutSyncPolicy = {
  selection: true,
  filters: true,
  sort: true,
  search: true,
  theme: true,
  density: true,
  hover: false,
  scroll: false,
  direction: 'both',
}

export interface PortPopoutSettings {
  triggerEnabled: PortPopoutTriggerSettings
  hoverDelayMs: number
  dragThresholdPx: number
  syncPolicyDefault: PortPopoutSyncPolicy
}

export interface WindowSettings {
  enabled: boolean
  autoGroupStrategy: 'none' | 'by-project' | 'by-type'
  saveLayoutOnExit: boolean
  snapToEdges: boolean
  portPopout: PortPopoutSettings
}

export interface AdvancedSettings {
  autoStartOnBoot: boolean  // TODO: 后端实际未实现，暂保留 UI
  minimizeToTray: boolean
  dataStoragePath: string
  logLevel: LogLevel
  developerMode: boolean
}

export interface AppSettings {
  appearance: AppearanceSettings
  scan: ScanSettings
  process: ProcessSettings
  notification: NotificationSettings
  window: WindowSettings
  advanced: AdvancedSettings
  firstLaunchDone: boolean
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

  // Project watcher
  PROJECTS_WATCHER_START: 'projects:watcher-start',
  PROJECTS_WATCHER_STOP: 'projects:watcher-stop',
  PROJECTS_WATCHER_STATUS: 'projects:watcher-status',
  PROJECTS_WATCHER_DETECTED: 'projects:watcher-detected',

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
  appearance: {
    theme: 'constructivism',
    followSystemTheme: false,
    fontSize: 'medium',
    sidebarPosition: 'left',
    compactMode: false,
    enableAnimations: true,
    holidayDecorationsEnabled: true,
    holidayAutoPromptEnabled: true,
    holidayFocusMode: false,
    layoutMode: 'auto',
    informationDensity: 'standard',
    radiusFamily: 'sharp',
    motionLevel: 'balanced',
    decoration: {
      kind: 'soviet-geo',
      opacity: 0.25,
      positions: ['card-background', 'header'],
      blendMode: 'normal',
      scale: 1,
      motionRespect: true,
    },
  },
  scan: {
    scanDrives: ['C', 'D'],
    allowedPaths: [],
    excludePaths: [],
    checkInterval: 3000,
    maxScanDepth: 5,
    fileTypeFilters: [],
  },
  process: {
    enabled: true,
    scanInterval: 5000,
    autoCleanZombies: false,
    zombieThresholdMinutes: 30,
    cpuWarningThreshold: 80,
    memoryWarningThresholdMB: 1024,
    whitelist: [],
    blacklist: [],
  },
  notification: {
    enabled: true,
    typeToggles: {
      'task-complete': true,
      'port-conflict': true,
      'zombie-process': true,
      'high-resource': true,
      'project-error': true,
    },
    sound: true,
    persistent: false,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  },
  window: {
    enabled: true,
    autoGroupStrategy: 'by-project',
    saveLayoutOnExit: false,
    snapToEdges: true,
    portPopout: {
      triggerEnabled: {
        hover: true,
        click: true,
        drag: true,
        contextMenu: true,
      },
      hoverDelayMs: 1000,
      dragThresholdPx: 8,
      syncPolicyDefault: {
        ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
      },
    },
  },
  advanced: {
    autoStartOnBoot: false,  // TODO: 后端实际未实现，暂保留 UI
    minimizeToTray: false,
    dataStoragePath: '',
    logLevel: 'info',
    developerMode: false,
  },
  firstLaunchDone: false,
}

/**
 * Migrate legacy flat AppSettings to the new nested structure.
 * Returns the migrated settings if old format is detected, otherwise returns the input as-is.
 */
export function migrateSettings(raw: Record<string, unknown>): AppSettings {
  // Detect old flat format: has 'theme' at top level as a string
  if (typeof raw.theme === 'string' && raw.appearance === undefined) {
    const defaults = DEFAULT_SETTINGS
    return {
      appearance: {
        ...defaults.appearance,
        theme: (raw.theme as AppSettings['appearance']['theme']) || defaults.appearance.theme,
      },
      scan: {
        ...defaults.scan,
        scanDrives: Array.isArray(raw.scanDrives) ? raw.scanDrives as string[] : defaults.scan.scanDrives,
        allowedPaths: Array.isArray(raw.allowedPaths) ? raw.allowedPaths as string[] : defaults.scan.allowedPaths,
        checkInterval: typeof raw.checkInterval === 'number' ? raw.checkInterval : defaults.scan.checkInterval,
      },
      process: { ...defaults.process },
      notification: {
        ...defaults.notification,
        enabled: typeof raw.notificationEnabled === 'boolean' ? raw.notificationEnabled : defaults.notification.enabled,
      },
      window: { ...defaults.window },
      advanced: {
        ...defaults.advanced,
        autoStartOnBoot: typeof raw.autoStartOnBoot === 'boolean' ? raw.autoStartOnBoot : defaults.advanced.autoStartOnBoot,
        minimizeToTray: typeof raw.minimizeToTray === 'boolean' ? raw.minimizeToTray : defaults.advanced.minimizeToTray,
      },
      firstLaunchDone: typeof raw.firstLaunchDone === 'boolean' ? raw.firstLaunchDone : defaults.firstLaunchDone,
    }
  }
  // Already in new format or close enough — fill in any missing fields with defaults.
  // The double-cast is required because AppSettings lacks an index signature;
  // at runtime AppSettings is a plain object assignable to Record<string, unknown>.
  // The inverse cast is safe because deepMergeSettingsImpl starts from
  // DEFAULT_SETTINGS and only overwrites keys with values from raw (which has
  // already passed the isSettingsObject gate in AppStore.getSettings).
  const defaultsAsRecord = DEFAULT_SETTINGS as unknown as Record<string, unknown>
  const merged = deepMergeSettingsImpl(defaultsAsRecord, raw)
  return merged as unknown as AppSettings
}

/**
 * Deep merge utility for settings: recursively merges source into target.
 * Arrays are replaced, not merged.
 * Operates on plain objects to avoid TypeScript index signature issues.
 */
function deepMergeSettingsImpl(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    const sourceVal = source[key]
    const targetVal = target[key]
    if (
      sourceVal !== undefined &&
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== undefined &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMergeSettingsImpl(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      )
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal
    }
  }
  return result
}

/**
 * Public deep merge wrapper that accepts AppSettings or partial updates.
 * The double-casts through unknown are required because AppSettings lacks
 * an index signature. Runtime safety: both target and source are typed
 * AppSettings / Partial<AppSettings>, so they are guaranteed plain objects
 * without symbol keys or class instances; the merge preserves every key
 * from target, so the returned object retains the AppSettings shape.
 */
export function deepMergeSettings(target: AppSettings, source: Partial<AppSettings>): AppSettings {
  const targetAsRecord = target as unknown as Record<string, unknown>
  const sourceAsRecord = source as unknown as Record<string, unknown>
  const merged = deepMergeSettingsImpl(targetAsRecord, sourceAsRecord)
  return merged as unknown as AppSettings
}

// ============ Project Type Display Info ============

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  npm: 'npm',
  pnpm: 'pnpm',
  yarn: 'Yarn',
  venv: 'Python venv',
  conda: 'Conda',
  poetry: 'Poetry',
  rust: 'Rust',
  go: 'Go',
  'java-maven': 'Maven',
  'java-gradle': 'Gradle',
  unknown: 'Unknown'
}

export const PROJECT_TYPE_COLORS: Record<ProjectType, string> = {
  npm: '#CB3837',
  pnpm: '#F69220',
  yarn: '#2C8EBB',
  venv: '#3776AB',
  conda: '#44A833',
  poetry: '#60A5FA',
  rust: '#DEA584',
  go: '#00ADD8',
  'java-maven': '#C71A36',
  'java-gradle': '#02303A',
  unknown: '#6B7280'
}

/**
 * Ensure backward compatibility: if a Project lacks projectType, default to 'npm'.
 */
export function ensureProjectType(project: Partial<Project> & Omit<Project, 'projectType'>): Project {
  return {
    ...project,
    projectType: project.projectType || 'npm'
  } as Project
}
