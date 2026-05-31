import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import type {
  AppSettings,
  AppearanceSettings,
  ScanSettings,
  ProcessSettings,
  NotificationSettings,
  PortPopoutSettings,
  PortPopoutSyncDirection,
  WindowSettings,
  AdvancedSettings,
  ThemeOption,
  FontSize,
  SidebarPosition,
  LayoutMode,
  InformationDensity,
  LogLevel,
  ThemeDecorationConfig,
  ThemeDecorationKind,
  ThemeDecorationPosition,
} from '@shared/types'
import type { FeatureFlagName } from '@shared/feature-flags'
import type {
  A11yPrefs,
  A11ySelfCheckResult,
  BackupBundle,
  CommandRegisterOsProtocolResult,
  CustomCommand,
  CustomSvgEntry,
  DataOwnershipListEntriesResponse,
  DataOwnershipListPathsResponse,
  DataOwnershipPathSummary,
  StatusbarConfig,
  StatusTile,
  ThemeSoundConfig
} from '@shared/schemas/r8-runtime'
import { statusbarConfigSchema } from '@shared/schemas/r8-runtime'
import { THEME_DECORATION_I18N_KEYS, THEME_DECORATION_POSITION_I18N_KEYS } from '@shared/theme-decorations'
import {
  APP_SETTINGS_CHANGE_EVENT,
  DEFAULT_SETTINGS,
  LAYOUT_MODE_CHANGE_EVENT,
  LAYOUT_MODE_STORAGE_KEY,
  THEME_DECORATION_KIND_VALUES,
  THEME_DECORATION_POSITION_VALUES,
  deepMergeSettings
} from '@shared/types'
import {
  CloseIcon,
  SettingsIcon,
  FolderIcon,
  CheckIcon,
  PaletteIcon,
  ScanIcon,
  ProcessIcon,
  BellIcon,
  LayoutIcon,
  WrenchIcon,
  DownloadIcon,
  UploadIcon,
  PlusIcon,
  TrashIcon,
} from '../icons'
import { useTheme, type MotionLevel, type RadiusFamily, type ThemeName, type ThemeState } from '../../hooks/useTheme'
import { HOLIDAY_THEME_DEFINITIONS, THEME_DECORATION_CHANGE_EVENT, THEME_DECORATION_BUILTIN_COUNT, THEME_PRESETS, getPaletteDesignState, normalizeThemeDecorationConfig } from '../../theme/theme-language'
import { svgSanitizer } from '../../services/SvgSanitizer'
import { defaultThemeSoundConfig } from '../../services/ThemeSounds'
import { buildThemePack, serializeThemePack, type ThemePackTokens } from '../../theme/theme-pack'
import { SignalWeightPanel } from '../../views/settings/SignalWeightPanel'
import { ToolDetectPanel } from '../../views/settings/ToolDetectPanel'
import { BlocklistEditor } from './BlocklistEditor'
import { LocaleSwitcher } from '../i18n/LocaleSwitcher'
import { useA11yRuntime } from '../../hooks/useA11yRuntime'
import { useAnnounce } from '../../hooks/useAnnounce'
import { useT } from '../../hooks/useT'
import { STATUSBAR_CONFIG_CHANGE_EVENT } from '../statusbar/statusbar-model'

// ============ Types ============

type SettingsCategory = 'appearance' | 'scan' | 'process' | 'notification' | 'window' | 'signal' | 'data' | 'advanced'

const DASHBOARD_GRID_FLAG: FeatureFlagName = 'R8.B.dashboard.grid'

interface CategoryDef {
  key: SettingsCategory
  label: string
  sublabel: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

function isPlainSettingsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergePendingSettingsUpdates(
  base: Partial<AppSettings>,
  updates: Partial<AppSettings>
): Partial<AppSettings> {
  const merge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
    const result = { ...target }
    for (const key of Object.keys(source)) {
      const sourceValue = source[key]
      const targetValue = result[key]
      result[key] = isPlainSettingsObject(sourceValue) && isPlainSettingsObject(targetValue)
        ? merge(targetValue, sourceValue)
        : sourceValue
    }
    return result
  }

  return merge(
    base as Record<string, unknown>,
    updates as Record<string, unknown>
  ) as Partial<AppSettings>
}

const CATEGORIES: CategoryDef[] = [
  { key: 'appearance', label: '外观', sublabel: 'APPEARANCE', icon: PaletteIcon },
  { key: 'scan', label: '扫描', sublabel: 'SCAN', icon: ScanIcon },
  { key: 'process', label: '进程', sublabel: 'PROCESS', icon: ProcessIcon },
  { key: 'notification', label: '通知', sublabel: 'NOTIFICATION', icon: BellIcon },
  { key: 'window', label: '窗口', sublabel: 'WINDOW', icon: LayoutIcon },
  { key: 'signal', label: '信号', sublabel: 'SIGNAL', icon: ProcessIcon },
  { key: 'data', label: '数据', sublabel: 'OWNERSHIP', icon: FolderIcon },
  { key: 'advanced', label: '高级', sublabel: 'ADVANCED', icon: WrenchIcon },
]

interface ThemeDef {
  key: ThemeName
  name: string
  desc: string
  colors: [string, string, string]
  previewBg: string
  previewBorder: string
  previewRadius: string
  previewFont: string
}

const THEMES: ThemeDef[] = [
  {
    key: 'constructivism',
    name: '构成主义',
    desc: '暗色·红金·工业·紧凑',
    colors: ['#1a1814', '#d64545', '#c9a227'],
    previewBg: '#1a1814',
    previewBorder: '2px solid #d64545',
    previewRadius: '2px',
    previewFont: 'uppercase',
  },
  {
    key: 'cyberpunk',
    name: '赛博朋克',
    desc: '暗色·霓虹·发光·未来',
    colors: ['#0a0a12', '#00ffff', '#ff00aa'],
    previewBg: '#0a0a12',
    previewBorder: '1px solid rgba(0, 255, 255, 0.4)',
    previewRadius: '8px',
    previewFont: 'uppercase',
  },
  {
    key: 'swiss',
    name: '瑞士极简',
    desc: '亮色·黑白·方角·克制',
    colors: ['#ffffff', '#1a1a1a', '#ff0000'],
    previewBg: '#ffffff',
    previewBorder: '1px solid #e8e8e8',
    previewRadius: '0px',
    previewFont: 'none',
  },
  {
    key: 'modern-light',
    name: '现代明亮',
    desc: '亮色·蓝白·圆角·专业',
    colors: ['#f8f9fa', '#3b82f6', '#f59e0b'],
    previewBg: '#f8f9fa',
    previewBorder: 'none',
    previewRadius: '16px',
    previewFont: 'none',
  },
  {
    key: 'warm-light',
    name: '暖光',
    desc: '亮色·铜金·柔和·温暖',
    colors: ['#faf8f5', '#b85c38', '#c9a227'],
    previewBg: '#faf8f5',
    previewBorder: '1px dashed #b85c38',
    previewRadius: '6px',
    previewFont: 'none',
  },
  {
    key: 'dark',
    name: '暗色控制台',
    desc: '暗色·钴蓝·柔边·稳态',
    colors: ['#0b1120', '#3b82f6', '#8b5cf6'],
    previewBg: '#0b1120',
    previewBorder: '1px solid rgba(255,255,255,0.08)',
    previewRadius: '10px',
    previewFont: 'none',
  },
  {
    key: 'light',
    name: '浅色控制台',
    desc: '亮色·靛蓝·柔边·清爽',
    colors: ['#f8fafc', '#6366f1', '#10b981'],
    previewBg: '#f8fafc',
    previewBorder: '1px solid rgba(79,70,229,0.14)',
    previewRadius: '14px',
    previewFont: 'none',
  },
]

const DECORATION_LABELS: Record<ThemeDecorationKind, string> = {
  none: '无装饰',
  'soviet-geo': '苏维埃几何',
  diagonals: '对角线',
  paper: '纸纹',
  scanline: '扫描线',
  grid: '网格',
  golden: '黄金分割',
  noise: '噪点',
  blocks: '色块',
  'custom-svg': '自定义 SVG',
}

const DECORATION_POSITION_LABELS: Record<ThemeDecorationPosition, string> = {
  'card-background': '卡片背景',
  'detail-panel-background': '详情面板',
  'global-background': '全局背景',
  'statusbar-background': '状态栏',
  'empty-state': '空状态',
  header: '头部',
}

const STATUSBAR_TILE_LABELS: Record<StatusTile['id'], string> = {
  cpu: 'CPU',
  mem: '内存',
  net: '网络',
  battery: '电池',
  projects: '项目',
  'ai-tasks': 'AI 任务',
  'public-ports': '公网端口',
  'listening-ports': '监听端口',
  notifications: '通知',
  popouts: '浮卡',
  theme: '主题',
  cmdk: '命令面板',
  time: '时间'
}

function isStatusbarTileId(value: string): value is StatusTile['id'] {
  return Object.prototype.hasOwnProperty.call(STATUSBAR_TILE_LABELS, value)
}

// ============ Props ============

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

// ============ Main Component ============

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { t } = useT()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance')
  const [availableDrives, setAvailableDrives] = useState<string[]>([])
  const [statusbarConfig, setStatusbarConfig] = useState<StatusbarConfig | null>(null)
  const [statusbarConfigError, setStatusbarConfigError] = useState<string | null>(null)
  const { theme, themeState, setTheme, setDensity, setRadiusFamily, setMotionLevel, applyPreset } = useTheme()
  const navRef = useRef<HTMLDivElement>(null)
  const emitSettingsChange = useCallback((nextSettings: AppSettings) => {
    window.dispatchEvent(new CustomEvent<AppSettings>(APP_SETTINGS_CHANGE_EVENT, { detail: nextSettings }))
  }, [])

  useEffect(() => {
    if (isOpen) {
      const devhub = window.devhub
      const loadSettings = devhub?.settings?.get?.() || Promise.resolve(null)
      const loadDrives = devhub?.system?.getDrives?.() || Promise.resolve([])
      const loadStatusbarConfig = devhub?.r8?.statusbar?.getConfig?.() || Promise.resolve(null)

      Promise.all([loadSettings, loadDrives, loadStatusbarConfig])
        .then(([s, drives, config]) => {
          if (s) setSettings(s)
          if (drives) setAvailableDrives(drives)
          if (config) setStatusbarConfig(statusbarConfigSchema.parse(config))
          setStatusbarConfigError(null)
        })
        .catch((e: Error) => {
          console.error('[SettingsDialog] Error fetching data:', e)
          setStatusbarConfigError(e.message)
        })
    }
  }, [isOpen])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdatesRef = useRef<Partial<AppSettings>>({})
  const handleSave = useCallback(async (updates: Partial<AppSettings>): Promise<void> => {
    const devhub = window.devhub
    if (!devhub?.settings?.update) return
    pendingUpdatesRef.current = mergePendingSettingsUpdates(pendingUpdatesRef.current, updates)
    setSettings((current) => (current ? deepMergeSettings(current, updates) : current))
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    return new Promise<void>((resolve) => {
      saveTimerRef.current = setTimeout(async () => {
        const merged = pendingUpdatesRef.current
        pendingUpdatesRef.current = {}
        try {
          const updated = await devhub.settings.update(merged)
          setSettings(updated)
          emitSettingsChange(updated)
        } catch (error) {
          console.error('Failed to save settings:', error)
          try {
            const restored = await devhub.settings.get?.()
            if (restored) setSettings(restored)
          } catch (restoreError) {
            console.error('Failed to restore settings after save error:', restoreError)
          }
        } finally {
          resolve()
        }
      }, 300)
    })
  }, [emitSettingsChange])

  const saveStatusbarConfig = useCallback(async (config: StatusbarConfig): Promise<void> => {
    const api = window.devhub?.r8?.statusbar
    if (!api?.setConfig) {
      setStatusbarConfigError('Statusbar config bridge unavailable')
      return
    }
    try {
      const saved = statusbarConfigSchema.parse(await api.setConfig(config))
      setStatusbarConfig(saved)
      setStatusbarConfigError(null)
      window.dispatchEvent(new CustomEvent<StatusbarConfig>(STATUSBAR_CONFIG_CHANGE_EVENT, { detail: saved }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to save statusbar config:', error)
      setStatusbarConfigError(message)
      throw error
    }
  }, [])

  const resetStatusbarConfig = useCallback(async (): Promise<void> => {
    const api = window.devhub?.r8?.statusbar
    if (!api?.reset) {
      setStatusbarConfigError('Statusbar reset bridge unavailable')
      return
    }
    try {
      const reset = statusbarConfigSchema.parse(await api.reset('settings-dialog'))
      setStatusbarConfig(reset)
      setStatusbarConfigError(null)
      window.dispatchEvent(new CustomEvent<StatusbarConfig>(STATUSBAR_CONFIG_CHANGE_EVENT, { detail: reset }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to reset statusbar config:', error)
      setStatusbarConfigError(message)
      throw error
    }
  }, [])

  const handleResetDefaults = useCallback(async () => {
    const devhub = window.devhub
    if (!devhub?.settings?.update) return
    try {
      // Reset all categories but preserve firstLaunchDone
      const resetSettings: Partial<AppSettings> = {
        appearance: { ...DEFAULT_SETTINGS.appearance },
        scan: { ...DEFAULT_SETTINGS.scan },
        process: { ...DEFAULT_SETTINGS.process },
        notification: { ...DEFAULT_SETTINGS.notification },
        window: { ...DEFAULT_SETTINGS.window },
        advanced: { ...DEFAULT_SETTINGS.advanced },
      }
      const updated = await devhub.settings.update(resetSettings)
      setSettings(updated)
      emitSettingsChange(updated)
      // Also reset theme in DOM
      setTheme(DEFAULT_SETTINGS.appearance.theme as ThemeName)
    } catch (error) {
      console.error('Failed to reset settings:', error)
    }
  }, [emitSettingsChange, setTheme])

  const handleExportSettings = useCallback(() => {
    if (!settings) return
    const json = JSON.stringify(settings, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `devhub-settings-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [settings])

  const handleImportSettings = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const imported = JSON.parse(text)
        if (typeof imported !== 'object' || imported === null) {
          throw new Error('Invalid settings file')
        }
        // Apply imported settings
        const devhub = window.devhub
        if (!devhub?.settings?.update) return
        const updated = await devhub.settings.update(imported)
        setSettings(updated)
        emitSettingsChange(updated)
        // Apply theme
        if (updated?.appearance?.theme) {
          setTheme(updated.appearance.theme as ThemeName)
        }
      } catch (error) {
        console.error('Failed to import settings:', error)
      }
    }
    input.click()
  }, [emitSettingsChange, setTheme])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Arrow keys for category navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const currentIndex = CATEGORIES.findIndex((c) => c.key === activeCategory)
        if (currentIndex === -1) return
        e.preventDefault()
        const nextIndex =
          e.key === 'ArrowDown'
            ? (currentIndex + 1) % CATEGORIES.length
            : (currentIndex - 1 + CATEGORIES.length) % CATEGORIES.length
        setActiveCategory(CATEGORIES[nextIndex].key)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, activeCategory])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center animate-fade-in" style={{ zIndex: 'var(--z-tier-modal, 3000)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="bg-surface-900 border-2 border-surface-600 w-full max-w-4xl mx-4 shadow-elevated flex flex-col relative radius-md h-[min(85vh,56rem)] max-h-[92vh] min-h-[480px]"
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-surface-700 relative z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 bg-gold/20 flex items-center justify-center border-l-3 border-gold radius-sm"
            >
              <SettingsIcon size={20} className="text-gold" />
            </div>
            <div>
              <h2
                id="settings-dialog-title"
                className="text-gold font-bold uppercase tracking-wider text-sm"
                style={{
                  fontFamily: 'var(--font-display)',
                  transform: 'rotate(-1deg)',
                  transformOrigin: 'left center',
                }}
              >
                {t('settings.title', 'Application Settings')}
              </h2>
              <p className="text-xs text-text-muted">{t('settings.eyebrow', 'APPLICATION SETTINGS')}</p>
            </div>
          </div>
          <button
            aria-label={t('settings.close', 'Close settings')}
            onClick={onClose}
            className="btn-icon-sm text-text-muted hover:text-text-primary"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Body: Left Nav + Right Panel */}
        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Left Navigation */}
          <nav
            ref={navRef}
            className="w-44 lg:w-52 xl:w-56 flex-shrink-0 border-r-2 border-surface-700 overflow-y-auto py-2"
            aria-label={t('settings.nav', 'Settings categories')}
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const isActive = activeCategory === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{cat.label}</span>
                    <span className="text-[10px] text-text-muted tracking-wider truncate">{cat.sublabel}</span>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* Right Panel */}
          <div className="flex-1 overflow-y-auto p-6">
            {!settings ? (
              <div className="text-text-muted text-center py-8">{t('settings.loading', 'Loading...')}</div>
            ) : (
              <>
                {activeCategory === 'appearance' && (
                  <AppearancePanel
                    settings={settings}
                    onSave={handleSave}
                    theme={theme}
                    themeState={themeState}
                    setTheme={setTheme}
                    setDensity={setDensity}
                    setRadiusFamily={setRadiusFamily}
                    setMotionLevel={setMotionLevel}
                    applyPreset={applyPreset}
                    statusbarConfig={statusbarConfig}
                    statusbarConfigError={statusbarConfigError}
                    onStatusbarConfigChange={saveStatusbarConfig}
                    onStatusbarConfigReset={resetStatusbarConfig}
                  />
                )}
                {activeCategory === 'scan' && (
                  <ScanPanel settings={settings} onSave={handleSave} availableDrives={availableDrives} />
                )}
                {activeCategory === 'process' && (
                  <ProcessPanel settings={settings} onSave={handleSave} />
                )}
                {activeCategory === 'notification' && (
                  <NotificationPanel settings={settings} onSave={handleSave} />
                )}
                {activeCategory === 'window' && (
                  <WindowPanel settings={settings} onSave={handleSave} />
                )}
                {activeCategory === 'signal' && (
                  <SignalWeightPanel />
                )}
                {activeCategory === 'data' && (
                  <DataOwnershipPanel />
                )}
                {activeCategory === 'advanced' && (
                  <AdvancedPanel
                    settings={settings}
                    onSave={handleSave}
                    onExport={handleExportSettings}
                    onImport={handleImportSettings}
                    onReset={handleResetDefaults}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-3 border-t-2 border-surface-700 relative z-10 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-surface-800 transition-colors radius-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Section Header ============

function SectionHeader({ title, borderColor = 'border-accent' }: { title: string; borderColor?: string }) {
  return (
    <h3
      className={`text-sm font-bold text-text-secondary mb-4 uppercase tracking-wider border-l-3 ${borderColor} pl-3`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {title}
    </h3>
  )
}

// ============ Toggle ============

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  testId?: string
}) {
  return (
    <div
      className="flex items-center justify-between p-3 bg-surface-800 hover:bg-surface-700 transition-colors cursor-pointer border-l-3 border-surface-600 radius-sm"
      data-testid={testId}
      onClick={() => onChange(!checked)}
    >
      <div className="flex flex-col min-w-0 flex-1 mr-3">
        <span className="text-text-secondary text-sm truncate">{label}</span>
        {description && <span className="text-text-muted text-xs mt-0.5 line-clamp-2">{description}</span>}
      </div>
      <div
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-10 h-5 transition-colors cursor-pointer flex-shrink-0 ${checked ? 'bg-accent' : 'bg-surface-600'} radius-sm`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'} radius-sm`}
        />
      </div>
    </div>
  )
}

// ============ Slider ============

function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  displayValue,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  displayValue?: string
  onChange: (value: number) => void
}) {
  return (
    <div
      className="p-3 bg-surface-800 border-l-3 border-surface-600 radius-sm"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-secondary text-sm">{label}</span>
        <span className="text-accent text-sm font-mono">
          {displayValue ?? value}{unit && ` ${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-surface-600 appearance-none cursor-pointer accent-accent radius-none"
      />
      <div className="flex justify-between text-[10px] text-text-muted mt-1">
        <span>{min}{unit && ` ${unit}`}</span>
        <span>{max}{unit && ` ${unit}`}</span>
      </div>
    </div>
  )
}

// ============ Select ============

function SettingSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 p-3 bg-surface-800 border-l-3 border-surface-600 radius-sm"
    >
      <span className="text-text-secondary text-sm truncate min-w-0 flex-1">{label}</span>
      <select
        aria-label={label}
        data-testid={`setting-select-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-3 py-1.5 bg-surface-700 border border-surface-600 text-text-primary text-sm focus:outline-none focus:border-accent radius-sm max-w-[60%] flex-shrink-0"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ============ String List Editor ============

function StringListEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
  allowBrowse,
}: {
  items: string[]
  onAdd: (item: string) => void
  onRemove: (item: string) => void
  placeholder?: string
  allowBrowse?: boolean
}) {
  const [newItem, setNewItem] = useState('')

  const handleAdd = () => {
    if (!newItem.trim()) return
    onAdd(newItem.trim())
    setNewItem('')
  }

  const handleBrowse = async () => {
    const devhub = window.devhub
    if (!devhub?.dialog?.openDirectory) return
    const selectedPath = await devhub.dialog.openDirectory()
    if (selectedPath) {
      setNewItem(selectedPath)
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <p className="text-text-muted text-sm italic px-1">暂无条目</p>
        ) : (
          items.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between gap-2 bg-surface-800 px-4 py-2 group border-l-3 border-surface-600 radius-sm"
            >
              <span className="text-text-secondary text-sm font-mono truncate flex-1 min-w-0" title={item}>
                {item}
              </span>
              <button
                aria-label={`移除 ${item}`}
                onClick={() => onRemove(item)}
                className="btn-icon-sm text-text-muted hover:text-error ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                title="移除"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder={placeholder ?? '输入新条目...'}
          className="flex-1 px-4 py-2 bg-surface-800 border-2 border-surface-600 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent radius-sm"
        />
        {allowBrowse && (
          <button
            onClick={handleBrowse}
            className="px-3 py-2 bg-surface-800 text-text-secondary hover:bg-surface-700 text-sm transition-colors border-l-2 border-surface-600 radius-sm"
            title="浏览文件夹"
          >
            <FolderIcon size={16} />
          </button>
        )}
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="px-3 py-2 bg-accent text-white text-sm hover:bg-accent-600 disabled:opacity-50 transition-colors radius-sm"
        >
          <PlusIcon size={16} />
        </button>
      </div>
    </div>
  )
}

function StatusbarTilesSettings({
  config,
  error,
  onChange,
  onReset,
}: {
  config: StatusbarConfig | null
  error: string | null
  onChange: (config: StatusbarConfig) => Promise<void>
  onReset: () => Promise<void>
}) {
  const [savingTileId, setSavingTileId] = useState<StatusTile['id'] | null>(null)
  const [draggingTileId, setDraggingTileId] = useState<StatusTile['id'] | null>(null)
  const sortedTiles = config ? [...config.tiles].sort((left, right) => left.order - right.order) : []

  const persistConfig = (nextConfig: StatusbarConfig, tileId: StatusTile['id']) => {
    setSavingTileId(tileId)
    void onChange(nextConfig).finally(() => setSavingTileId(null))
  }

  const updateTileVisibility = (tileId: StatusTile['id'], visible: boolean) => {
    if (!config) return
    const nextConfig = statusbarConfigSchema.parse({
      ...config,
      tiles: config.tiles.map((tile) => tile.id === tileId ? { ...tile, visible } : tile),
      updatedAt: Date.now()
    })
    persistConfig(nextConfig, tileId)
  }

  const updateTileOrder = (sourceTileId: StatusTile['id'], targetTileId: StatusTile['id']) => {
    if (!config || sourceTileId === targetTileId) return
    const ordered = [...config.tiles].sort((left, right) => left.order - right.order)
    const sourceIndex = ordered.findIndex(tile => tile.id === sourceTileId)
    const targetIndex = ordered.findIndex(tile => tile.id === targetTileId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const [movedTile] = ordered.splice(sourceIndex, 1)
    if (!movedTile) return
    ordered.splice(targetIndex, 0, movedTile)
    const nextConfig = statusbarConfigSchema.parse({
      ...config,
      tiles: ordered.map((tile, index) => ({ ...tile, order: index })),
      updatedAt: Date.now()
    })
    persistConfig(nextConfig, sourceTileId)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="状态栏磁贴" borderColor="border-success" />
        <button
          type="button"
          data-testid="statusbar-config-reset"
          onClick={() => { void onReset() }}
          className="px-3 py-1.5 text-xs bg-surface-800 border border-surface-600 text-text-muted hover:text-text-primary hover:border-accent transition-colors radius-sm"
        >
          重置
        </button>
      </div>
      <p className="text-xs text-text-muted mb-3">
        这些开关直接写入本地状态栏配置，状态栏会在保存后立即应用可见性。
      </p>
      {error && (
        <div className="mb-3 text-xs text-error bg-error/10 border border-error/30 p-2 radius-sm" data-testid="statusbar-config-error">
          {error}
        </div>
      )}
      {!config ? (
        <div className="text-xs text-text-muted bg-surface-800/50 border border-surface-700 p-3 radius-sm">
          正在读取状态栏配置。
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2" data-testid="statusbar-tile-settings">
          {sortedTiles.map((tile) => (
            <div
              key={tile.id}
              data-testid={`statusbar-setting-tile-${tile.id}`}
              draggable
              data-statusbar-dragging={draggingTileId === tile.id ? 'true' : 'false'}
              onDragStart={(event) => {
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', tile.id)
                }
                setDraggingTileId(tile.id)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const sourceTileId = event.dataTransfer?.getData('text/plain') ?? ''
                if (isStatusbarTileId(sourceTileId)) {
                  updateTileOrder(sourceTileId, tile.id)
                } else if (draggingTileId) {
                  updateTileOrder(draggingTileId, tile.id)
                }
                setDraggingTileId(null)
              }}
              onDragEnd={() => setDraggingTileId(null)}
            >
              <SettingToggle
                label={STATUSBAR_TILE_LABELS[tile.id]}
                description={`order ${tile.order} / drag to reorder / ${savingTileId === tile.id ? 'saving' : tile.source}`}
                checked={tile.visible}
                onChange={(visible) => updateTileVisibility(tile.id, visible)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ============ Appearance Panel ============

function AppearancePanel({
  settings,
  onSave,
  theme,
  themeState,
  setTheme,
  setDensity,
  setRadiusFamily,
  setMotionLevel,
  applyPreset,
  statusbarConfig,
  statusbarConfigError,
  onStatusbarConfigChange,
  onStatusbarConfigReset,
}: {
  settings: AppSettings
  onSave: (updates: Partial<AppSettings>) => Promise<void>
  theme: ThemeName
  themeState: ThemeState
  setTheme: (name: ThemeName) => Promise<void>
  setDensity: (density: InformationDensity | 'normal') => Promise<void>
  setRadiusFamily: (radiusFamily: RadiusFamily) => Promise<void>
  setMotionLevel: (motionLevel: MotionLevel) => Promise<void>
  applyPreset: (presetId: string) => Promise<void>
  statusbarConfig: StatusbarConfig | null
  statusbarConfigError: string | null
  onStatusbarConfigChange: (config: StatusbarConfig) => Promise<void>
  onStatusbarConfigReset: () => Promise<void>
}) {
  const { t } = useT()
  const appearance = settings.appearance
  const activeDensity = appearance.informationDensity ?? themeState.density
  const activeLayoutMode = appearance.layoutMode ?? 'auto'
  const activeRadiusFamily = appearance.radiusFamily ?? themeState.radiusFamily
  const activeMotionLevel = appearance.motionLevel ?? themeState.motionLevel
  const activeDecoration = normalizeThemeDecorationConfig(appearance.decoration, theme)
  const svgInputRef = useRef<HTMLInputElement | null>(null)
  const [customSvgs, setCustomSvgs] = useState<CustomSvgEntry[]>([])
  const [customSvgStatus, setCustomSvgStatus] = useState<string | null>(null)
  const [customSvgError, setCustomSvgError] = useState<string | null>(null)
  const [themeSoundConfig, setThemeSoundConfig] = useState<ThemeSoundConfig>(() => defaultThemeSoundConfig(theme))
  const [themeSoundError, setThemeSoundError] = useState<string | null>(null)
  const activeThemeDefinition = THEMES.find(item => item.key === theme) ?? THEMES[0]
  const [editorAccentColor, setEditorAccentColor] = useState(activeThemeDefinition.colors[1])
  const [editorCardRadiusPx, setEditorCardRadiusPx] = useState(Number.parseInt(activeThemeDefinition.previewRadius, 10) || 8)
  const [editorSpacingBasePx, setEditorSpacingBasePx] = useState(activeDensity === 'compact' ? 4 : activeDensity === 'comfortable' ? 10 : 6)
  const [editorMotionNormalMs, setEditorMotionNormalMs] = useState(activeMotionLevel === 'reduced' ? 0 : activeMotionLevel === 'expressive' ? 240 : 200)

  useEffect(() => {
    setEditorAccentColor(activeThemeDefinition.colors[1])
    setEditorCardRadiusPx(Number.parseInt(activeThemeDefinition.previewRadius, 10) || 8)
    setEditorSpacingBasePx(activeDensity === 'compact' ? 4 : activeDensity === 'comfortable' ? 10 : 6)
    setEditorMotionNormalMs(activeMotionLevel === 'reduced' ? 0 : activeMotionLevel === 'expressive' ? 240 : 200)
  }, [activeDensity, activeMotionLevel, activeThemeDefinition])

  const loadCustomSvgs = useCallback(async () => {
    const response = await window.devhub?.r8?.themeDecoration?.listCustomSvg?.()
    setCustomSvgs(response?.items ?? [])
  }, [])

  useEffect(() => {
    void loadCustomSvgs().catch(error => {
      setCustomSvgError(error instanceof Error ? error.message : String(error))
    })
  }, [loadCustomSvgs])

  useEffect(() => {
    let cancelled = false
    const fallback = defaultThemeSoundConfig(theme)
    const soundConfigPromise = window.devhub?.r8?.themeDecoration?.getSoundConfig?.(theme)
    if (!soundConfigPromise) {
      setThemeSoundConfig(fallback)
      return () => {
        cancelled = true
      }
    }

    void soundConfigPromise.then(config => {
        if (cancelled) return
        setThemeSoundConfig({
          ...fallback,
          ...config,
          themeId: theme,
          events: { ...fallback.events, ...config.events }
        })
        setThemeSoundError(null)
      })
      .catch(error => {
        if (cancelled) return
        setThemeSoundConfig(fallback)
        setThemeSoundError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [theme])

  const updateAppearance = (updates: Partial<AppearanceSettings>) => {
    void onSave({ appearance: { ...appearance, ...updates } })
  }

  const updateLayoutMode = (layoutMode: LayoutMode) => {
    updateAppearance({ layoutMode })
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, layoutMode)
    window.dispatchEvent(new CustomEvent<LayoutMode>(LAYOUT_MODE_CHANGE_EVENT, { detail: layoutMode }))
  }

  const updateDecoration = (updates: Partial<ThemeDecorationConfig>) => {
    const next = normalizeThemeDecorationConfig({ ...activeDecoration, ...updates }, theme)
    updateAppearance({ decoration: next })
    window.dispatchEvent(new CustomEvent<ThemeDecorationConfig>(THEME_DECORATION_CHANGE_EVENT, { detail: next }))
    const decorationSetPromise = window.devhub?.r8?.themeDecoration?.set?.(next)
    if (decorationSetPromise) {
      void decorationSetPromise.catch(error => {
        setCustomSvgError(error instanceof Error ? error.message : String(error))
      })
    }
  }

  const handleSvgUpload = async (file: File | undefined) => {
    if (!file) return
    setCustomSvgError(null)
    setCustomSvgStatus('正在校验 SVG')

    try {
      const raw = await file.text()
      const sanitized = svgSanitizer.sanitize(raw)
      const result = await window.devhub?.r8?.themeDecoration?.uploadCustomSvg?.(file.name, sanitized.sanitizedContent, 'theme-decoration-upload')
      if (!result) throw new Error('E_INTERNAL:theme decoration bridge unavailable')
      await loadCustomSvgs()
      const positions = activeDecoration.positions.length > 0 ? activeDecoration.positions : ['global-background' as const]
      updateDecoration({ kind: 'custom-svg', customSvgId: result.id, positions })
      setCustomSvgStatus(`已保存 ${result.entry.name}`)
    } catch (error) {
      setCustomSvgStatus(null)
      setCustomSvgError(error instanceof Error ? error.message : String(error))
    } finally {
      if (svgInputRef.current) svgInputRef.current.value = ''
    }
  }

  const removeCustomSvg = async (entry: CustomSvgEntry) => {
    setCustomSvgError(null)
    try {
      await window.devhub?.r8?.themeDecoration?.removeCustomSvg?.(entry.id, 'theme-decoration-remove')
      await loadCustomSvgs()
      if (activeDecoration.customSvgId === entry.id) {
        updateDecoration({ kind: 'none', customSvgId: undefined })
      }
      setCustomSvgStatus(`已删除 ${entry.name}`)
    } catch (error) {
      setCustomSvgError(error instanceof Error ? error.message : String(error))
    }
  }

  const updateThemeSound = async (updates: Partial<ThemeSoundConfig>) => {
    const fallback = defaultThemeSoundConfig(theme)
    const next: ThemeSoundConfig = {
      ...fallback,
      ...themeSoundConfig,
      ...updates,
      themeId: theme,
      events: {
        ...fallback.events,
        ...themeSoundConfig.events,
        ...updates.events
      }
    }
    setThemeSoundConfig(next)
    try {
      await window.devhub?.r8?.themeDecoration?.setSoundConfig?.(next)
      setThemeSoundError(null)
    } catch (error) {
      setThemeSoundError(error instanceof Error ? error.message : String(error))
    }
  }

  const editorTokens: ThemePackTokens = {
    accentColor: editorAccentColor,
    cardRadiusPx: editorCardRadiusPx,
    spacingBasePx: editorSpacingBasePx,
    motionNormalMs: editorMotionNormalMs
  }

  const exportThemePack = () => {
    const pack = buildThemePack({
      name: `${theme}-theme-pack`,
      exportedAt: new Date().toISOString(),
      themeState,
      tokens: editorTokens,
      decoration: activeDecoration
    })
    const blob = new Blob([serializeThemePack(pack)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${theme}-${new Date().toISOString().slice(0, 10)}.devhub-theme.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="设计语言" />
        <SettingToggle
          label="跟随系统主题"
          description="启用后按系统 light / dark 外观自动选择 DevHub light 或 dark palette"
          checked={appearance.followSystemTheme}
          onChange={(v) => updateAppearance({ followSystemTheme: v })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 settings-theme-grid">
          {THEMES.map((t) => {
            const isActive = theme === t.key
            const designState = getPaletteDesignState(t.key, activeDensity)
            return (
              <button
                key={t.key}
                data-testid={`palette-option-${t.key}`}
                onClick={() => {
                  const nextDecoration = normalizeThemeDecorationConfig(undefined, t.key)
                  void setTheme(t.key)
                  updateAppearance({
                    theme: t.key as ThemeOption,
                    followSystemTheme: false,
                    radiusFamily: designState.radiusFamily,
                    motionLevel: designState.motionLevel,
                    decoration: nextDecoration
                  })
                  window.dispatchEvent(new CustomEvent<ThemeDecorationConfig>(THEME_DECORATION_CHANGE_EVENT, { detail: nextDecoration }))
                }}
                className={`relative p-3 border-2 transition-all text-left ${
                  isActive ? 'border-accent bg-surface-800' : 'border-surface-600 bg-surface-800/50 hover:border-surface-500'
                } radius-md`}
              >
                {isActive && (
                  <div className="absolute top-1.5 right-1.5">
                    <CheckIcon size={14} className="text-accent" />
                  </div>
                )}
                <div
                  style={{
                    width: '100%',
                    height: '3.25rem',
                    marginBottom: '0.5rem',
                    background: t.previewBg,
                    border: t.previewBorder,
                    borderRadius: t.previewRadius,
                    boxShadow: isActive ? '0 0 0 2px var(--accent)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    padding: '0.375rem 0.5rem',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    height: '0.4375rem',
                    width: '60%',
                    background: t.colors[1],
                    borderRadius: t.previewRadius,
                    opacity: 0.9,
                  }} />
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <div style={{
                      height: '0.3125rem',
                      width: '30%',
                      background: t.colors[2],
                      borderRadius: t.previewRadius,
                      opacity: 0.7,
                    }} />
                    <div style={{
                      height: '0.3125rem',
                      width: '20%',
                      background: t.colors[1],
                      borderRadius: t.previewRadius,
                      opacity: 0.4,
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.1875rem', marginTop: 'auto' }}>
                    {t.colors.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          width: '0.75rem',
                          height: '0.75rem',
                          background: c,
                          borderRadius: t.previewRadius,
                          border: '1px solid rgba(128,128,128,0.2)',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-sm font-medium text-text-primary truncate">{t.name}</div>
                <div className="text-xs text-text-muted truncate">{t.desc}</div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="预设组合" borderColor="border-gold" />
        <div className="grid grid-cols-2 gap-3 settings-preset-grid">
          {THEME_PRESETS.map((preset) => {
            const isActive = themeState.palette === preset.state.palette &&
              activeDensity === preset.state.density &&
              activeRadiusFamily === preset.state.radiusFamily &&
              activeMotionLevel === preset.state.motionLevel
            return (
              <button
                key={preset.id}
                data-testid={`theme-preset-${preset.id}`}
                onClick={() => {
                  const nextDecoration = normalizeThemeDecorationConfig(undefined, preset.state.palette)
                  void applyPreset(preset.id)
                  updateAppearance({
                    theme: preset.state.palette,
                    informationDensity: preset.state.density,
                    radiusFamily: preset.state.radiusFamily,
                    motionLevel: preset.state.motionLevel,
                    decoration: nextDecoration
                  })
                  window.dispatchEvent(new CustomEvent<ThemeDecorationConfig>(THEME_DECORATION_CHANGE_EVENT, { detail: nextDecoration }))
                  localStorage.setItem('devhub:density', preset.state.density)
                }}
                className={`p-3 border text-left transition-all ${
                  isActive ? 'border-accent bg-accent/10' : 'border-surface-700 bg-surface-850 hover:border-surface-500'
                } radius-md`}
              >
                <div className="text-sm font-bold text-text-primary uppercase tracking-wide">{preset.name}</div>
                <div className="text-xs text-text-muted mt-1">{preset.description}</div>
                <div className="text-[10px] text-text-muted mt-2 font-mono uppercase">
                  {preset.state.density} / {preset.state.radiusFamily} / {preset.state.motionLevel}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section data-testid="theme-preview-editor">
        <SectionHeader title="主题预览与编辑器" borderColor="border-info" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-4">
          <div
            className="p-4 bg-surface-850 border border-surface-700 radius-md min-w-0"
            data-testid="theme-live-preview"
            data-accent-color={editorAccentColor}
            style={{
              '--theme-editor-accent': editorAccentColor,
              '--theme-editor-radius': `${editorCardRadiusPx}px`,
              '--theme-editor-spacing': `${editorSpacingBasePx}px`,
              '--theme-editor-motion': `${editorMotionNormalMs}ms`
            } as CSSProperties}
          >
            <div
              data-testid="theme-preview-card"
              className="bg-surface-900 border border-surface-700"
              style={{
                borderRadius: 'var(--theme-editor-radius)',
                padding: 'calc(var(--theme-editor-spacing) * 2)',
                transitionDuration: 'var(--theme-editor-motion)'
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-text-primary">{t('settings.themeEditor.previewCard', 'Preview card')}</div>
                  <div className="text-xs text-text-muted">{t('settings.themeEditor.previewCardDesc', 'Real button, card, table, and chart tokens')}</div>
                </div>
                <button
                  type="button"
                  data-testid="theme-preview-button"
                  className="px-3 py-1.5 text-xs text-white"
                  style={{ background: 'var(--theme-editor-accent)', borderRadius: 'var(--theme-editor-radius)' }}
                >
                  {t('settings.themeEditor.action', 'Action')}
                </button>
              </div>
              <div className="mt-4 overflow-hidden border border-surface-700" style={{ borderRadius: 'var(--theme-editor-radius)' }}>
                <table className="w-full text-xs" data-testid="theme-preview-table">
                  <tbody>
                    {[
                      [t('settings.themeEditor.processLabel', 'Process'), t('settings.themeEditor.processStatus', 'running'), '42%'],
                      [t('settings.themeEditor.portLabel', 'Port'), t('settings.themeEditor.portStatus', 'listening'), '5173']
                    ].map(([label, status, value]) => (
                      <tr key={label} className="border-b border-surface-700 last:border-b-0">
                        <td className="px-3 py-2 text-text-secondary">{label}</td>
                        <td className="px-3 py-2 text-text-muted">{status}</td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-end gap-2 h-20" data-testid="theme-preview-chart">
                {[36, 58, 44, 72, 64].map((height, index) => (
                  <div
                    key={height}
                    className="flex-1"
                    style={{
                      height,
                      background: index % 2 === 0 ? 'var(--theme-editor-accent)' : activeThemeDefinition.colors[2],
                      borderRadius: 'var(--theme-editor-radius)',
                      opacity: 0.75 + index * 0.04
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3 min-w-0">
            <label className="block p-3 bg-surface-800 border border-surface-700 radius-sm">
              <span className="block text-xs text-text-muted mb-2">{t('settings.themeEditor.accentToken', 'Accent token')}</span>
              <input
                data-testid="theme-editor-accent"
                type="color"
                value={editorAccentColor}
                onChange={(event) => setEditorAccentColor(event.currentTarget.value)}
                className="w-full h-9 bg-transparent"
              />
            </label>
            <SettingSlider label={t('settings.themeEditor.cardRadiusToken', 'Card radius token')} value={editorCardRadiusPx} min={0} max={32} step={1} unit="px" onChange={setEditorCardRadiusPx} />
            <SettingSlider label={t('settings.themeEditor.spacingBaseToken', 'Spacing base token')} value={editorSpacingBasePx} min={2} max={16} step={1} unit="px" onChange={setEditorSpacingBasePx} />
            <SettingSlider label={t('settings.themeEditor.motionNormalToken', 'Motion normal token')} value={editorMotionNormalMs} min={0} max={500} step={10} unit="ms" onChange={setEditorMotionNormalMs} />
            <button
              type="button"
              data-testid="theme-pack-export"
              onClick={exportThemePack}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent text-white text-sm hover:bg-accent-600 transition-colors radius-sm whitespace-nowrap"
            >
              <DownloadIcon size={14} />
              导出 .devhub-theme.json
            </button>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="主题装饰" borderColor="border-accent" />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SettingSelect<ThemeDecorationKind>
              label="装饰几何"
              value={activeDecoration.kind}
              options={THEME_DECORATION_KIND_VALUES.map((kind) => ({
                value: kind,
                label: t(THEME_DECORATION_I18N_KEYS[kind], DECORATION_LABELS[kind]),
              }))}
              onChange={(kind) => updateDecoration({ kind })}
            />
            <SettingSelect<ThemeDecorationConfig['blendMode']>
              label="混合模式"
              value={activeDecoration.blendMode}
              options={[
                { value: 'normal', label: '正常' },
                { value: 'multiply', label: '正片叠底' },
                { value: 'overlay', label: '叠加' },
                { value: 'screen', label: '滤色' },
              ]}
              onChange={(blendMode) => updateDecoration({ blendMode })}
            />
          </div>
          <SettingSlider
            label="装饰透明度"
            value={Math.round(activeDecoration.opacity * 100)}
            min={0}
            max={50}
            step={1}
            unit="%"
            onChange={(value) => updateDecoration({ opacity: value / 100 })}
          />
          <SettingSlider
            label="装饰缩放"
            value={activeDecoration.scale}
            min={0.5}
            max={4}
            step={0.1}
            displayValue={`${activeDecoration.scale.toFixed(1)}x`}
            onChange={(scale) => updateDecoration({ scale })}
          />
          <div className="grid grid-cols-2 gap-2">
            {THEME_DECORATION_POSITION_VALUES.map((position) => {
              const checked = activeDecoration.positions.includes(position)
              return (
                <SettingToggle
                  key={position}
                  label={t(THEME_DECORATION_POSITION_I18N_KEYS[position], DECORATION_POSITION_LABELS[position])}
                  checked={checked}
                  onChange={(nextChecked) => {
                    const positions = nextChecked
                      ? [...activeDecoration.positions, position]
                      : activeDecoration.positions.filter((item) => item !== position)
                    updateDecoration({ positions })
                  }}
                />
              )
            })}
          </div>
          <div className="p-3 bg-surface-800 border-l-3 border-accent radius-sm" data-testid="custom-svg-uploader">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-text-secondary">自定义 SVG 装饰</div>
                <div className="mt-1 text-xs text-text-muted">
                  上传前使用 DOMPurify SVG profile 清洗，主进程再次校验禁止标签、事件属性、外链和 200KB 限制。
                </div>
              </div>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 text-xs text-text-secondary hover:bg-surface-600 hover:text-text-primary transition-colors radius-sm flex-shrink-0 whitespace-nowrap"
                onClick={() => svgInputRef.current?.click()}
              >
                <UploadIcon size={14} />
                上传 SVG
              </button>
              <input
                ref={svgInputRef}
                data-testid="svg-upload"
                type="file"
                accept=".svg,image/svg+xml"
                className="hidden"
                onChange={(event) => {
                  void handleSvgUpload(event.currentTarget.files?.[0])
                }}
              />
            </div>
            {customSvgs.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {customSvgs.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 border border-surface-700 bg-surface-900/70 px-3 py-2 radius-sm">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => updateDecoration({ kind: 'custom-svg', customSvgId: entry.id })}
                      data-testid={`decoration-option-custom-svg-${entry.id}`}
                    >
                      <div className="truncate text-xs font-medium text-text-secondary">{entry.name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{Math.round(entry.size / 1024)}KB / {entry.hash.slice(0, 8)}</div>
                    </button>
                    <button
                      type="button"
                      aria-label={`删除 SVG ${entry.name}`}
                      className="btn-icon-sm text-text-muted hover:text-error"
                      onClick={() => { void removeCustomSvg(entry) }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {customSvgStatus && <div className="mt-2 text-xs text-success">{customSvgStatus}</div>}
            {customSvgError && <div className="mt-2 text-xs text-error">{customSvgError}</div>}
          </div>
          <div className="p-3 bg-surface-800 border-l-3 border-gold radius-sm" data-testid="theme-sound-settings">
            <div className="space-y-2">
              <SettingToggle
                label="启用主题独立音色"
                description={`当前主题：${themeSoundConfig.themeId}`}
                checked={themeSoundConfig.enabled}
                onChange={(enabled) => { void updateThemeSound({ enabled }) }}
              />
              <SettingSlider
                label="主题音量"
                value={Math.round(themeSoundConfig.volume * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(volume) => { void updateThemeSound({ volume: volume / 100 }) }}
              />
              <div className="text-[10px] text-text-muted font-mono uppercase">
                HOWLER ENABLED / HOVER CLICK NOTIFY ERROR SUCCESS EVENTS / LOCAL DATA-URI TONES
              </div>
              {themeSoundError && <div className="text-xs text-error">{themeSoundError}</div>}
            </div>
          </div>
          <div className="text-[10px] text-text-muted font-mono uppercase">
            BUILTINS {THEME_DECORATION_BUILTIN_COUNT} / CUSTOM SVG {customSvgs.length} / ASSERT_THEME_DECORATION_8_PLUS_CUSTOM READY
          </div>
        </div>
      </section>

      <section data-testid="holiday-theme-settings">
        <SectionHeader title={t('settings.holiday.section', 'Holiday Themes')} borderColor="border-gold" />
        <div className="space-y-3">
          <SettingToggle
            label={t('settings.holiday.enable', 'Enable seasonal themes')}
            description={t('settings.holiday.enableDesc', 'Applies Spring Festival, Christmas, and Halloween decoration packs during their local date windows.')}
            checked={appearance.holidayDecorationsEnabled ?? true}
            onChange={(holidayDecorationsEnabled) => updateAppearance({ holidayDecorationsEnabled })}
          />
          <SettingToggle
            label={t('settings.holiday.ask', 'Ask before seasonal themes')}
            description={t('settings.holiday.askDesc', 'Before each holiday date, DevHub asks once per year before enabling the seasonal pack.')}
            checked={appearance.holidayAutoPromptEnabled ?? true}
            onChange={(holidayAutoPromptEnabled) => updateAppearance({ holidayAutoPromptEnabled })}
          />
          <SettingToggle
            label={t('settings.holiday.focus', 'Focus work mode')}
            description={t('settings.holiday.focusDesc', 'Suppresses all seasonal decoration layers without changing the saved theme palette.')}
            checked={appearance.holidayFocusMode ?? false}
            onChange={(holidayFocusMode) => updateAppearance({ holidayFocusMode })}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2" data-testid="holiday-theme-list">
            {HOLIDAY_THEME_DEFINITIONS.map(holiday => (
              <div key={holiday.id} className="border border-surface-700 bg-surface-850 px-3 py-2 radius-sm min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide text-text-primary truncate">{holiday.name}</div>
                <div className="mt-1 text-[10px] font-mono uppercase text-text-muted truncate">{holiday.id}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-text-muted font-mono uppercase" data-testid="holiday-theme-contract">
            HOLIDAY THEMES {HOLIDAY_THEME_DEFINITIONS.length} / AUTO PROMPT / FOCUS SUPPRESS / NO EMOJI ASSETS
          </div>
        </div>
      </section>

      <StatusbarTilesSettings
        config={statusbarConfig}
        error={statusbarConfigError}
        onChange={onStatusbarConfigChange}
        onReset={onStatusbarConfigReset}
      />

      <section>
        <SectionHeader title="显示设置" borderColor="border-info" />
        <div className="space-y-2">
          <SettingSelect<FontSize>
            label="字体大小"
            value={appearance.fontSize}
            options={[
              { value: 'small', label: '小' },
              { value: 'medium', label: '中' },
              { value: 'large', label: '大' },
            ]}
            onChange={(v) => updateAppearance({ fontSize: v })}
          />
          <SettingSelect<SidebarPosition>
            label="侧边栏位置"
            value={appearance.sidebarPosition}
            options={[
              { value: 'left', label: '左侧' },
              { value: 'right', label: '右侧' },
            ]}
            onChange={(v) => updateAppearance({ sidebarPosition: v })}
          />
          <SettingSelect<LayoutMode>
            label="布局模式"
            value={activeLayoutMode}
            options={[
              { value: 'auto', label: '自动 - 跟随窗口宽度' },
              { value: 'split', label: '固定分栏' },
              { value: 'stacked', label: '固定堆叠' },
            ]}
            onChange={updateLayoutMode}
          />
          <SettingSelect<InformationDensity>
            label="信息密度"
            value={activeDensity}
            options={[
              { value: 'compact', label: '紧凑 - 更多内容' },
              { value: 'standard', label: '标准' },
              { value: 'comfortable', label: '舒适 - 更大间距' },
            ]}
            onChange={(v) => {
              void setDensity(v)
              updateAppearance({ informationDensity: v })
              localStorage.setItem('devhub:density', v)
            }}
          />
          <SettingSelect<RadiusFamily>
            label="圆角风格"
            value={activeRadiusFamily}
            options={[
              { value: 'sharp', label: '锐利 - 工具感' },
              { value: 'soft', label: '柔和 - 专业感' },
              { value: 'round', label: '圆润 - 低压力' },
            ]}
            onChange={(v) => {
              void setRadiusFamily(v)
              updateAppearance({ radiusFamily: v })
            }}
          />
          <SettingSelect<MotionLevel>
            label="动效水平"
            value={activeMotionLevel}
            options={[
              { value: 'reduced', label: '减少 - 无非必要动画' },
              { value: 'balanced', label: '均衡 - 标准反馈' },
              { value: 'expressive', label: '强调 - 更强反馈' },
            ]}
            onChange={(v) => {
              void setMotionLevel(v)
              updateAppearance({ motionLevel: v })
            }}
          />
          <SettingToggle
            label="紧凑模式"
            description="减少间距，显示更多内容"
            checked={appearance.compactMode}
            onChange={(v) => updateAppearance({ compactMode: v })}
          />
          <SettingToggle
            label="动画效果"
            description="关闭时会强制使用 reduced motion 轴"
            checked={appearance.enableAnimations}
            onChange={(v) => {
              if (!v) {
                void setMotionLevel('reduced')
                updateAppearance({ enableAnimations: false, motionLevel: 'reduced' })
              } else {
                updateAppearance({ enableAnimations: true })
              }
            }}
          />
        </div>
      </section>
    </div>
  )
}

// ============ Scan Panel ============

function ScanPanel({
  settings,
  onSave,
  availableDrives,
}: {
  settings: AppSettings
  onSave: (updates: Partial<AppSettings>) => Promise<void>
  availableDrives: string[]
}) {
  const scan = settings.scan

  const updateScan = (updates: Partial<ScanSettings>) => {
    onSave({ scan: { ...scan, ...updates } })
  }

  const handleToggleDrive = (drive: string) => {
    const currentDrives = scan.scanDrives || []
    if (currentDrives.includes(drive)) {
      if (currentDrives.length > 1) {
        updateScan({ scanDrives: currentDrives.filter((d) => d !== drive) })
      }
    } else {
      updateScan({ scanDrives: [...currentDrives, drive].sort() })
    }
  }

  return (
    <div className="space-y-6">
      {/* Drive Scanning */}
      <section>
        <SectionHeader title="扫描盘符" borderColor="border-info" />
        <p className="text-xs text-text-muted mb-4">
          选择要扫描项目的磁盘驱动器。扫描时会在这些盘符下查找常见的项目目录。
        </p>
        <div className="flex flex-wrap gap-2">
          {availableDrives.length === 0 ? (
            <p className="text-text-muted text-sm italic">正在检测可用盘符...</p>
          ) : (
            availableDrives.map((drive) => {
              const isSelected = (scan.scanDrives || []).includes(drive)
              const isOnlyOne = (scan.scanDrives || []).length === 1 && isSelected
              return (
                <button
                  key={drive}
                  onClick={() => handleToggleDrive(drive)}
                  disabled={isOnlyOne}
                  className={`px-4 py-2 border-2 text-sm font-medium transition-all border-l-3 ${
                    isSelected
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-surface-800 border-surface-600 text-text-muted hover:border-surface-500 hover:text-text-secondary'
                  } ${isOnlyOne ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} radius-sm`}
                  title={isOnlyOne ? '至少需要保留一个盘符' : isSelected ? '点击取消选择' : '点击选择此盘符'}
                >
                  {drive}:
                  {isSelected && <CheckIcon size={14} className="ml-1.5 inline-block" />}
                </button>
              )
            })
          )}
        </div>
      </section>

      {/* Check interval */}
      <section>
        <SectionHeader title="检测设置" borderColor="border-gold" />
        <div className="space-y-2">
          <SettingSlider
            label="工具检测间隔"
            value={scan.checkInterval}
            min={1000}
            max={30000}
            step={500}
            displayValue={`${(scan.checkInterval / 1000).toFixed(1)}`}
            unit="秒"
            onChange={(v) => updateScan({ checkInterval: v })}
          />
          <SettingSlider
            label="最大扫描深度"
            value={scan.maxScanDepth}
            min={1}
            max={15}
            step={1}
            unit="层"
            onChange={(v) => updateScan({ maxScanDepth: v })}
          />
        </div>
      </section>

      {/* Allowed Paths */}
      <section>
        <SectionHeader title="允许的项目路径" borderColor="border-success" />
        <p className="text-xs text-text-muted mb-3">
          只有位于以下目录中的项目才能被添加。
        </p>
        <StringListEditor
          items={scan.allowedPaths}
          onAdd={(path) => updateScan({ allowedPaths: [...scan.allowedPaths, path] })}
          onRemove={(path) => updateScan({ allowedPaths: scan.allowedPaths.filter((p) => p !== path) })}
          placeholder="输入或选择路径..."
          allowBrowse
        />
      </section>

      {/* Exclude Paths */}
      <section>
        <SectionHeader title="排除路径" borderColor="border-error" />
        <p className="text-xs text-text-muted mb-3">
          扫描时将跳过以下目录（如 node_modules、.git 等已内置排除）。
        </p>
        <StringListEditor
          items={scan.excludePaths}
          onAdd={(path) => updateScan({ excludePaths: [...scan.excludePaths, path] })}
          onRemove={(path) => updateScan({ excludePaths: scan.excludePaths.filter((p) => p !== path) })}
          placeholder="输入排除路径..."
          allowBrowse
        />
      </section>

      {/* Default paths info */}
      <section>
        <SectionHeader title="默认扫描路径" borderColor="border-gold" />
        <div
          className="text-xs text-text-muted space-y-1.5 font-mono bg-surface-800/50 p-4 border-2 border-surface-700 radius-sm"
        >
          <p className="text-text-tertiary mb-2">用户目录：</p>
          <p>- 用户/Desktop</p>
          <p>- 用户/Documents</p>
          <p>- 用户/Projects</p>
          <p>- 用户/workspace</p>
          <p>- 用户/dev</p>
          <p>- 用户/code</p>
          <p className="text-text-tertiary mt-3 mb-2">已选盘符下的目录：</p>
          {(scan.scanDrives || ['C', 'D']).map((drive) => (
            <p key={drive} className="break-all">
              - {drive}:\Projects, {drive}:\Desktop, {drive}:\workspace, {drive}:\dev, {drive}:\code, {drive}:\work
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}

// ============ Process Panel ============

function ProcessPanel({
  settings,
  onSave,
}: {
  settings: AppSettings
  onSave: (updates: Partial<AppSettings>) => Promise<void>
}) {
  const proc = settings.process

  const updateProcess = (updates: Partial<ProcessSettings>) => {
    onSave({ process: { ...proc, ...updates } })
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="进程监控" />
        <div className="space-y-2">
          <SettingToggle
            label="启用进程监控"
            description="监控系统中与开发相关的进程"
            checked={proc.enabled}
            onChange={(v) => updateProcess({ enabled: v })}
          />
          <SettingSlider
            label="进程扫描间隔"
            value={proc.scanInterval}
            min={2000}
            max={60000}
            step={1000}
            displayValue={`${(proc.scanInterval / 1000).toFixed(0)}`}
            unit="秒"
            onChange={(v) => updateProcess({ scanInterval: v })}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="僵尸进程" borderColor="border-error" />
        <div className="space-y-2">
          <SettingToggle
            label="自动清理僵尸进程"
            description="超过阈值时间的空闲进程将被自动终止"
            checked={proc.autoCleanZombies}
            onChange={(v) => updateProcess({ autoCleanZombies: v })}
          />
          <SettingSlider
            label="僵尸进程判定阈值"
            value={proc.zombieThresholdMinutes}
            min={5}
            max={120}
            step={5}
            unit="分钟"
            onChange={(v) => updateProcess({ zombieThresholdMinutes: v })}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="资源警告" borderColor="border-gold" />
        <div className="space-y-2">
          <SettingSlider
            label="CPU 使用率警告阈值"
            value={proc.cpuWarningThreshold}
            min={20}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => updateProcess({ cpuWarningThreshold: v })}
          />
          <SettingSlider
            label="内存使用警告阈值"
            value={proc.memoryWarningThresholdMB}
            min={256}
            max={8192}
            step={256}
            unit="MB"
            onChange={(v) => updateProcess({ memoryWarningThresholdMB: v })}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="进程白名单" borderColor="border-success" />
        <p className="text-xs text-text-muted mb-3">
          白名单中的进程名将不会被标记为僵尸进程或触发警告。
        </p>
        <StringListEditor
          items={proc.whitelist}
          onAdd={(item) => updateProcess({ whitelist: [...proc.whitelist, item] })}
          onRemove={(item) => updateProcess({ whitelist: proc.whitelist.filter((i) => i !== item) })}
          placeholder="输入进程名，如 node.exe..."
        />
      </section>

      <section>
        <SectionHeader title="进程黑名单" borderColor="border-error" />
        <p className="text-xs text-text-muted mb-3">
          黑名单中的进程将被优先标记和处理。
        </p>
        <StringListEditor
          items={proc.blacklist}
          onAdd={(item) => updateProcess({ blacklist: [...proc.blacklist, item] })}
          onRemove={(item) => updateProcess({ blacklist: proc.blacklist.filter((i) => i !== item) })}
          placeholder="输入进程名..."
        />
      </section>
    </div>
  )
}

// ============ Notification Panel ============

function NotificationPanel({
  settings,
  onSave,
}: {
  settings: AppSettings
  onSave: (updates: Partial<AppSettings>) => Promise<void>
}) {
  const notif = settings.notification

  const updateNotification = (updates: Partial<NotificationSettings>) => {
    onSave({ notification: { ...notif, ...updates } })
  }

  const NOTIFICATION_TYPES: { key: string; label: string }[] = [
    { key: 'task-complete', label: '任务完成' },
    { key: 'port-conflict', label: '端口冲突' },
    { key: 'zombie-process', label: '僵尸进程' },
    { key: 'high-resource', label: '资源占用过高' },
    { key: 'project-error', label: '项目错误' },
  ]

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="通知设置" />
        <div className="space-y-2">
          <SettingToggle
            label="启用通知"
            description="关闭后将不会收到任何通知"
            checked={notif.enabled}
            onChange={(v) => updateNotification({ enabled: v })}
          />
          <SettingToggle
            label="声音通知"
            description="收到通知时播放系统提示音"
            checked={notif.sound}
            onChange={(v) => updateNotification({ sound: v })}
          />
          <SettingToggle
            label="持久通知"
            description="通知不会自动消失，需要手动关闭"
            checked={notif.persistent}
            onChange={(v) => updateNotification({ persistent: v })}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="通知类型控制" borderColor="border-info" />
        <p className="text-xs text-text-muted mb-3">
          可以分别控制每种通知类型的开关。
        </p>
        <div className="space-y-2">
          {NOTIFICATION_TYPES.map((type) => (
            <SettingToggle
              key={type.key}
              label={type.label}
              checked={notif.typeToggles[type.key] ?? true}
              onChange={(v) =>
                updateNotification({
                  typeToggles: { ...notif.typeToggles, [type.key]: v },
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="免打扰" borderColor="border-gold" />
        <div className="space-y-2">
          <SettingToggle
            label="启用免打扰时间段"
            description="在指定时间段内不会显示通知"
            checked={notif.quietHoursEnabled}
            onChange={(v) => updateNotification({ quietHoursEnabled: v })}
          />
          {notif.quietHoursEnabled && (
            <div
              className="flex flex-wrap items-center gap-3 p-3 bg-surface-800 border-l-3 border-surface-600 radius-sm"
            >
              <span className="text-text-secondary text-sm">时间段</span>
              <input
                type="time"
                value={notif.quietHoursStart}
                onChange={(e) => updateNotification({ quietHoursStart: e.target.value })}
                className="px-2 py-1 bg-surface-700 border border-surface-600 text-text-primary text-sm focus:outline-none focus:border-accent radius-sm min-w-[110px] flex-shrink"
              />
              <span className="text-text-muted text-sm">至</span>
              <input
                type="time"
                value={notif.quietHoursEnd}
                onChange={(e) => updateNotification({ quietHoursEnd: e.target.value })}
                className="px-2 py-1 bg-surface-700 border border-surface-600 text-text-primary text-sm focus:outline-none focus:border-accent radius-sm min-w-[110px] flex-shrink"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// ============ Window Panel ============

function WindowPanel({
  settings,
  onSave,
}: {
  settings: AppSettings
  onSave: (updates: Partial<AppSettings>) => Promise<void>
}) {
  const win = settings.window
  const portPopout = win.portPopout ?? DEFAULT_SETTINGS.window.portPopout

  const updateWindow = (updates: Partial<WindowSettings>) => {
    onSave({ window: { ...win, ...updates } })
  }

  const updatePortPopout = (updates: Partial<PortPopoutSettings>) => {
    updateWindow({
      portPopout: {
        ...portPopout,
        ...updates,
        triggerEnabled: {
          ...portPopout.triggerEnabled,
          ...updates.triggerEnabled,
        },
        syncPolicyDefault: {
          ...portPopout.syncPolicyDefault,
          ...updates.syncPolicyDefault,
        },
      },
    })
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="窗口管理" />
        <div className="space-y-2">
          <SettingToggle
            label="启用窗口管理"
            description="允许 DevHub 管理开发相关窗口"
            checked={win.enabled}
            onChange={(v) => updateWindow({ enabled: v })}
          />
          <SettingSelect<'none' | 'by-project' | 'by-type'>
            label="自动分组策略"
            value={win.autoGroupStrategy}
            options={[
              { value: 'none', label: '不自动分组' },
              { value: 'by-project', label: '按项目分组' },
              { value: 'by-type', label: '按类型分组' },
            ]}
            onChange={(v) => updateWindow({ autoGroupStrategy: v })}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="布局与行为" borderColor="border-info" />
        <div className="space-y-2">
          <SettingToggle
            label="退出时保存布局"
            description="关闭应用时自动保存窗口布局，下次启动时恢复"
            checked={win.saveLayoutOnExit}
            onChange={(v) => updateWindow({ saveLayoutOnExit: v })}
          />
          <SettingToggle
            label="窗口边缘吸附"
            description="拖动窗口到屏幕边缘时自动对齐"
            checked={win.snapToEdges}
            onChange={(v) => updateWindow({ snapToEdges: v })}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="端口 Popout" borderColor="border-warning" />
        <div className="space-y-2">
          <SettingToggle
            label="悬停 1 秒触发"
            description="鼠标停留到达阈值后自动打开浮卡"
            checked={portPopout.triggerEnabled.hover}
            onChange={(value) => updatePortPopout({
              triggerEnabled: { ...portPopout.triggerEnabled, hover: value },
            })}
          />
          <SettingToggle
            label="按钮点击触发"
            description="保留端口卡片上的 Popout 显式按钮"
            checked={portPopout.triggerEnabled.click}
            onChange={(value) => updatePortPopout({
              triggerEnabled: { ...portPopout.triggerEnabled, click: value },
            })}
          />
          <SettingToggle
            label="拖拽阈值触发"
            description="拖动端口卡片超过阈值时创建浮卡"
            checked={portPopout.triggerEnabled.drag}
            onChange={(value) => updatePortPopout({
              triggerEnabled: { ...portPopout.triggerEnabled, drag: value },
            })}
          />
          <SettingToggle
            label="右键菜单触发"
            description="允许通过上下文菜单打开浮卡"
            checked={portPopout.triggerEnabled.contextMenu}
            onChange={(value) => updatePortPopout({
              triggerEnabled: { ...portPopout.triggerEnabled, contextMenu: value },
            })}
          />
          <SettingSlider
            label="悬停延迟"
            value={portPopout.hoverDelayMs}
            min={200}
            max={3000}
            step={100}
            unit="ms"
            onChange={(value) => updatePortPopout({ hoverDelayMs: value })}
          />
          <SettingSlider
            label="拖拽阈值"
            value={portPopout.dragThresholdPx}
            min={4}
            max={32}
            step={1}
            unit="px"
            onChange={(value) => updatePortPopout({ dragThresholdPx: value })}
          />
          <SettingSelect<PortPopoutSyncDirection>
            label="默认同步方向"
            value={portPopout.syncPolicyDefault.direction}
            options={[
              { value: 'both', label: '双向同步' },
              { value: 'main-to-popout', label: '仅主窗到浮卡' },
              { value: 'popout-to-main', label: '仅浮卡到主窗' },
              { value: 'isolated', label: '独立模式' },
            ]}
            onChange={(value) => updatePortPopout({
              syncPolicyDefault: { ...portPopout.syncPolicyDefault, direction: value },
            })}
          />
        </div>
      </section>
    </div>
  )
}

// ============ A11y Settings Panel ============

function A11ySettingsPanel() {
  const { prefs, osPrefs, savePrefs } = useA11yRuntime()
  const announce = useAnnounce()
  const [selfCheck, setSelfCheck] = useState<A11ySelfCheckResult | null>(null)
  const [checking, setChecking] = useState(false)

  const updateA11yPrefs = (updates: Partial<A11yPrefs>) => {
    const nextPrefs: A11yPrefs = { ...prefs, ...updates }
    void savePrefs(nextPrefs)
      .then(() => announce('无障碍设置已保存'))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '无障碍设置保存失败'
        announce(message, 'assertive')
      })
  }

  const runSelfCheck = async () => {
    const api = window.devhub?.r8?.a11y
    if (!api) {
      announce('当前环境未暴露无障碍自检通道', 'assertive')
      return
    }

    setChecking(true)
    try {
      const result = await api.runSelfCheck()
      setSelfCheck(result)
      announce(result.passed ? '无障碍自检通过' : '无障碍自检需要补充审计')
    } catch (error) {
      const message = error instanceof Error ? error.message : '无障碍自检失败'
      announce(message, 'assertive')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <SettingToggle
          label="跟随系统无障碍设置"
          description="同步 reduced-motion、forced-colors 与高对比度偏好"
          checked={prefs.followOsSettings}
          onChange={(value) => updateA11yPrefs({ followOsSettings: value })}
        />
        <SettingToggle
          label="减弱动效"
          description="关闭长动画、滚动动画和视图转场"
          checked={prefs.reducedMotion}
          onChange={(value) => updateA11yPrefs({ reducedMotion: value })}
        />
        <SettingToggle
          label="高对比度"
          description="提高焦点环和关键控件可见性"
          checked={prefs.highContrast}
          onChange={(value) => updateA11yPrefs({ highContrast: value })}
        />
        <SettingToggle
          label="大文本"
          description="全局字号放大 20%"
          checked={prefs.largeText}
          onChange={(value) => updateA11yPrefs({ largeText: value })}
        />
        <SettingToggle
          label="屏幕阅读器优化"
          description="保留更多 aria-live 与语义标签提示"
          checked={prefs.screenReaderOptimized}
          onChange={(value) => updateA11yPrefs({ screenReaderOptimized: value })}
        />
        <SettingToggle
          label="强制色适配"
          description="与 Windows forced-colors 模式保持一致"
          checked={prefs.forcedColors}
          onChange={(value) => updateA11yPrefs({ forcedColors: value })}
        />
      </div>

      <SettingSelect<A11yPrefs['focusRingThickness']>
        label="焦点环粗细"
        value={prefs.focusRingThickness}
        options={[
          { value: 'thin', label: '细' },
          { value: 'normal', label: '标准' },
          { value: 'thick', label: '粗' },
        ]}
        onChange={(value) => updateA11yPrefs({ focusRingThickness: value })}
      />

      <div className="p-3 bg-surface-800 border-l-3 border-surface-600 text-xs text-text-muted radius-sm">
        OS: reduced-motion={String(osPrefs.reducedMotion)} / high-contrast={String(osPrefs.highContrast)} / forced-colors={String(osPrefs.forcedColors)}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => { void runSelfCheck() }}
          disabled={checking}
          className="px-4 py-2.5 bg-surface-800 border-2 border-surface-600 text-text-secondary hover:border-surface-500 hover:text-text-primary disabled:opacity-50 transition-all text-sm radius-sm"
        >
          {checking ? '自检中...' : '运行无障碍自检'}
        </button>

        {selfCheck && (
          <div className="p-3 bg-surface-800 border-l-3 border-warning radius-sm" role="status" aria-live="polite">
            <div className="text-sm text-text-primary">
              状态：{selfCheck.passed ? '通过' : '需要补充审计'} / axe={selfCheck.axeExecuted ? '已执行' : '未执行'}
            </div>
            <div className="text-xs text-text-muted mt-1">
              critical/serious: {selfCheck.axeViolations.length} / contrast: {selfCheck.contrastFailures.length} / keyboard: {selfCheck.keyboardUnreachable.length}
            </div>
            {selfCheck.warnings.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-xs text-text-muted space-y-1">
                {selfCheck.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function parseShortcutInput(input: string): string[] {
  return input
    .split('+')
    .map(part => part.trim())
    .filter(Boolean)
}

function CustomCommandManager() {
  const [commands, setCommands] = useState<CustomCommand[]>([])
  const [form, setForm] = useState({
    id: 'custom.open-settings',
    label: 'Open Settings',
    handlerScript: 'command:settings.open',
    shortcut: '',
    enabled: true
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const loadCommands = useCallback(async () => {
    const bridge = window.devhub?.r8?.command
    if (!bridge?.listCustom) {
      setError('当前运行环境未暴露自定义命令列表桥接。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await bridge.listCustom()
      setCommands(result.commands)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void loadCommands()
  }, [loadCommands])

  const saveCommand = async (nextEnabled = form.enabled, source = form) => {
    const bridge = window.devhub?.r8?.command
    if (!bridge?.saveCustom) {
      setError('当前运行环境未暴露自定义命令保存桥接。')
      return
    }
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const result = await bridge.saveCustom({
        id: source.id.trim(),
        label: source.label.trim(),
        handlerScript: source.handlerScript.trim(),
        shortcut: parseShortcutInput(source.shortcut),
        enabled: nextEnabled,
        confirmedBy: 'settings-dialog'
      })
      setStatus(result.command.enabled ? `已保存 ${result.command.id}` : `已禁用 ${result.command.id}`)
      await loadCommands()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setBusy(false)
    }
  }

  const editCommand = (command: CustomCommand) => {
    setForm({
      id: command.id,
      label: command.label,
      handlerScript: command.handlerScript,
      shortcut: command.shortcut.join('+'),
      enabled: command.enabled
    })
    setStatus(`正在编辑 ${command.id}`)
  }

  const disableCommand = async (command: CustomCommand) => {
    setForm({
      id: command.id,
      label: command.label,
      handlerScript: command.handlerScript,
      shortcut: command.shortcut.join('+'),
      enabled: false
    })
    await saveCommand(false, {
      id: command.id,
      label: command.label,
      handlerScript: command.handlerScript,
      shortcut: command.shortcut.join('+'),
      enabled: false
    })
  }

  return (
    <div className="space-y-4 p-4 bg-surface-800 border-l-3 border-surface-600 radius-sm" data-testid="custom-command-manager">
      <div>
        <div className="text-sm text-text-secondary">自定义命令注册表</div>
        <div className="mt-1 text-xs text-text-muted">
          仅支持安全声明式 handler：`command:&lt;id&gt;` 或 `devhub://...`。不会执行 shell、JavaScript、eval 或 SKILL 字符串。
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs text-text-muted">
          命令 ID
          <input
            data-testid="custom-command-id"
            className="w-full bg-surface-900 border border-surface-600 px-3 py-2 text-sm text-text-primary radius-sm"
            value={form.id}
            onChange={(event) => setForm(prev => ({ ...prev, id: event.target.value }))}
          />
        </label>
        <label className="space-y-1 text-xs text-text-muted">
          显示名称
          <input
            data-testid="custom-command-label"
            className="w-full bg-surface-900 border border-surface-600 px-3 py-2 text-sm text-text-primary radius-sm"
            value={form.label}
            onChange={(event) => setForm(prev => ({ ...prev, label: event.target.value }))}
          />
        </label>
        <label className="space-y-1 text-xs text-text-muted md:col-span-2">
          Handler
          <input
            data-testid="custom-command-handler"
            className="w-full bg-surface-900 border border-surface-600 px-3 py-2 text-sm text-text-primary radius-sm"
            value={form.handlerScript}
            onChange={(event) => setForm(prev => ({ ...prev, handlerScript: event.target.value }))}
          />
        </label>
        <label className="space-y-1 text-xs text-text-muted">
          快捷键
          <input
            data-testid="custom-command-shortcut"
            className="w-full bg-surface-900 border border-surface-600 px-3 py-2 text-sm text-text-primary radius-sm"
            placeholder="Ctrl+Shift+P"
            value={form.shortcut}
            onChange={(event) => setForm(prev => ({ ...prev, shortcut: event.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input
            data-testid="custom-command-enabled"
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm(prev => ({ ...prev, enabled: event.target.checked }))}
          />
          启用
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="custom-command-save"
          disabled={busy}
          onClick={() => { void saveCommand() }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-surface-950 text-sm hover:bg-accent/80 disabled:opacity-60 transition-colors radius-sm"
        >
          <CheckIcon size={16} />
          保存命令
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => { void loadCommands() }}
          className="px-4 py-2 bg-surface-700 text-text-secondary text-sm hover:bg-surface-600 disabled:opacity-60 transition-colors radius-sm"
        >
          重新加载
        </button>
      </div>

      {status && <div className="text-xs text-success" data-testid="custom-command-status">{status}</div>}
      {error && <div className="text-xs text-warning" data-testid="custom-command-error">{error}</div>}

      <div className="space-y-2" data-testid="custom-command-list">
        {commands.length === 0 ? (
          <div className="text-xs text-text-muted">暂无自定义命令。</div>
        ) : commands.map(command => (
          <div
            key={command.id}
            className="flex flex-wrap items-center justify-between gap-3 border border-surface-700 bg-surface-900 p-3 radius-sm"
            data-testid={`custom-command-row-${command.id}`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-text-primary truncate">{command.label}</div>
              <div className="mt-1 text-[11px] text-text-muted break-all">{command.id} · {command.handlerScript}</div>
              <div className="mt-1 text-[11px] text-text-muted truncate">状态：{command.enabled ? '启用' : '禁用'}；快捷键：{command.shortcut.join('+') || '未设置'}</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => editCommand(command)}
                className="px-3 py-1.5 bg-surface-700 text-text-secondary text-xs hover:bg-surface-600 radius-sm"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => { void disableCommand(command) }}
                className="px-3 py-1.5 border border-warning/50 text-warning text-xs hover:bg-warning/10 radius-sm"
              >
                禁用
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ Advanced Panel ============

function DashboardFeatureFlagControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    const bridge = window.devhub?.r8?.integrations
    if (!bridge?.getFlag) {
      setEnabled(true)
      return
    }
    void bridge.getFlag(DASHBOARD_GRID_FLAG)
      .then(value => {
        if (!disposed) setEnabled(value)
      })
      .catch(reason => {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : String(reason))
          setEnabled(true)
        }
      })
    return () => {
      disposed = true
    }
  }, [])

  const updateFlag = async (value: boolean) => {
    const bridge = window.devhub?.r8?.integrations
    if (!bridge?.setFlag) {
      setEnabled(value)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await bridge.setFlag(DASHBOARD_GRID_FLAG, value, 'settings-dialog')
      setEnabled(result.value)
      window.dispatchEvent(new CustomEvent('devhub:dashboard-feature-flag-change', { detail: { enabled: result.value } }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <SettingToggle
        checked={enabled ?? false}
        description="关闭后 Dashboard 路由只显示禁用说明，不挂载 grid 或 widget。"
        label="启用 Dashboard Grid"
        onChange={(value) => { void updateFlag(value) }}
        testId="settings-dashboard-grid-flag"
      />
      <div className="text-xs text-text-muted">
        当前 flag：{DASHBOARD_GRID_FLAG}；状态：{enabled === null ? '读取中' : enabled ? 'enabled' : 'disabled'}{busy ? '；保存中' : ''}
      </div>
      {error ? <div className="text-xs text-warning" data-testid="settings-dashboard-grid-flag-error">{error}</div> : null}
    </div>
  )
}

const DATA_OWNERSHIP_CATEGORY_LABELS: Record<DataOwnershipPathSummary['category'], string> = {
  audit: 'Audit',
  backup: 'Backup',
  core: 'Core',
  diagnostics: 'Diagnostics',
  recording: 'Recording',
  recovery: 'Recovery',
  runtime: 'Runtime',
  settings: 'Settings',
  skills: 'Skills',
  tasks: 'Tasks'
}

function formatDataOwnershipBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDataOwnershipTimestamp(value: number | null): string {
  if (value === null) return 'Never'
  return new Date(value).toLocaleString()
}

function DataOwnershipPanel() {
  const { t } = useT()
  const [paths, setPaths] = useState<DataOwnershipListPathsResponse | null>(null)
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null)
  const [entries, setEntries] = useState<DataOwnershipListEntriesResponse | null>(null)
  const [loadingPaths, setLoadingPaths] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportBundle, setExportBundle] = useState<BackupBundle | null>(null)

  const loadEntries = useCallback(async (rootId: string, relativePath = '') => {
    const bridge = window.devhub?.r8?.dataOwnership
    if (!bridge?.listEntries) {
      setError('Data ownership entry bridge unavailable')
      return
    }
    setLoadingEntries(true)
    setError(null)
    try {
      const nextEntries = await bridge.listEntries({ rootId, relativePath })
      setSelectedRootId(rootId)
      setEntries(nextEntries)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoadingEntries(false)
    }
  }, [])

  const loadPaths = useCallback(async () => {
    const bridge = window.devhub?.r8?.dataOwnership
    if (!bridge?.listPaths) {
      setError('Data ownership path bridge unavailable')
      return
    }
    setLoadingPaths(true)
    setError(null)
    try {
      const response = await bridge.listPaths()
      setPaths(response)
      const firstRoot = response.roots.find(root => root.exists) ?? response.roots[0]
      if (firstRoot) {
        await loadEntries(firstRoot.rootId)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoadingPaths(false)
    }
  }, [loadEntries])

  useEffect(() => {
    void loadPaths()
  }, [loadPaths])

  const openPath = async (path: string) => {
    const bridge = window.devhub?.shell?.openPath
    if (!bridge) {
      setError('Shell open bridge unavailable')
      return
    }
    try {
      const result = await bridge(path)
      if (result) setError(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const exportAll = async () => {
    const bridge = window.devhub?.r8?.dataOwnership
    if (!bridge?.exportAll) {
      setError('Data ownership export bridge unavailable')
      return
    }
    setExporting(true)
    setError(null)
    try {
      const bundle = await bridge.exportAll({ confirmedBy: 'data-ownership-panel' })
      setExportBundle(bundle)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setExporting(false)
    }
  }

  const selectedRoot = paths?.roots.find(root => root.rootId === selectedRootId) ?? null

  return (
    <div className="space-y-6" data-testid="data-ownership-panel">
      <section>
        <SectionHeader title={t('settings.dataOwnership.section', 'Data Ownership')} borderColor="border-gold" />
        <div className="space-y-3 p-4 bg-surface-800 border-l-3 border-gold radius-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-secondary">
                {t('settings.dataOwnership.intro', 'Local data inventory is generated from the live Electron userData directory and related runtime stores.')}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t('settings.dataOwnership.introHint', 'Sensitive paths are listed for transparency; export uses the classified backup pipeline with redaction.')}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => { void loadPaths() }}
                disabled={loadingPaths}
                className="px-3 py-2 bg-surface-700 text-text-secondary text-xs hover:bg-surface-600 disabled:opacity-60 transition-colors radius-sm whitespace-nowrap flex-shrink-0"
                data-testid="data-ownership-refresh"
              >
                {loadingPaths ? t('settings.dataOwnership.refreshing', 'Refreshing') : t('settings.dataOwnership.refresh', 'Refresh')}
              </button>
              <button
                type="button"
                onClick={() => { void exportAll() }}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 bg-accent text-surface-950 text-xs hover:bg-accent/80 disabled:opacity-60 transition-colors radius-sm whitespace-nowrap flex-shrink-0"
                data-testid="data-ownership-export"
              >
                <DownloadIcon size={14} />
                {exporting ? t('settings.dataOwnership.exporting', 'Exporting') : t('settings.dataOwnership.exportAll', 'Export all local data')}
              </button>
            </div>
          </div>

          {error ? (
            <div className="text-xs text-warning" data-testid="data-ownership-error">{error}</div>
          ) : null}

          {exportBundle ? (
            <div className="p-3 bg-surface-900 border border-surface-600 radius-sm" data-testid="data-ownership-export-result">
              <div className="text-sm text-text-secondary">{t('settings.dataOwnership.exportCompleted', 'Export completed')}</div>
              <div className="mt-1 text-xs text-text-muted break-all">{exportBundle.zipPath ?? exportBundle.path}</div>
              <button
                type="button"
                onClick={() => { void openPath(exportBundle.zipPath ?? exportBundle.path) }}
                className="mt-2 px-3 py-1.5 bg-surface-700 text-text-secondary text-xs hover:bg-surface-600 transition-colors radius-sm"
              >
                {t('settings.dataOwnership.openExport', 'Open export')}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <SectionHeader title={t('settings.dataOwnership.localStoragePaths', 'Local Storage Paths')} borderColor="border-info" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {(paths?.roots ?? []).map(root => {
            const active = root.rootId === selectedRootId
            return (
              <button
                type="button"
                key={root.rootId}
                onClick={() => { void loadEntries(root.rootId) }}
                className={`text-left p-3 bg-surface-800 border-l-3 transition-colors radius-sm ${active ? 'border-accent' : 'border-surface-600 hover:border-surface-500'}`}
                data-testid={`data-ownership-root-${root.rootId}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text-secondary truncate">{root.label}</div>
                    <div className="mt-1 text-[11px] text-text-muted truncate">{DATA_OWNERSHIP_CATEGORY_LABELS[root.category]} · {root.kind} · {root.exists ? t('settings.dataOwnership.exists', 'exists') : t('settings.dataOwnership.missing', 'missing')}</div>
                  </div>
                  <div className={`text-[10px] uppercase tracking-wider whitespace-nowrap flex-shrink-0 ${root.exportable ? 'text-accent' : 'text-text-muted'}`}>
                    {root.exportable ? t('settings.dataOwnership.exportable', 'exportable') : t('settings.dataOwnership.inspectOnly', 'inspect only')}
                  </div>
                </div>
                <div className="mt-2 text-xs text-text-muted break-all">{root.path}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-muted">
                  <span>{root.fileCount} {t('settings.dataOwnership.filesUnit', 'files')}</span>
                  <span>{formatDataOwnershipBytes(root.sizeBytes)}</span>
                  <span>{formatDataOwnershipTimestamp(root.updatedAt)}</span>
                  {root.truncated ? <span className="text-warning">{t('settings.dataOwnership.truncated', 'truncated')}</span> : null}
                  {root.sensitive ? <span className="text-warning">{t('settings.dataOwnership.sensitive', 'sensitive')}</span> : null}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <SectionHeader title={t('settings.dataViewer.section', 'Data Viewer')} borderColor="border-accent" />
        <div className="space-y-3 p-4 bg-surface-800 border-l-3 border-surface-600 radius-sm" data-testid="data-ownership-viewer">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-text-secondary">{selectedRoot?.label ?? t('settings.dataViewer.noRootSelected', 'No root selected')}</div>
              <div className="mt-1 text-xs text-text-muted break-all">{entries?.absolutePath ?? selectedRoot?.path ?? t('settings.dataViewer.selectRootHint', 'Select a storage root to inspect entries.')}</div>
            </div>
            {entries?.absolutePath ? (
              <button
                type="button"
                onClick={() => { void openPath(entries.absolutePath) }}
                className="flex items-center gap-2 px-3 py-2 bg-surface-700 text-text-secondary text-xs hover:bg-surface-600 transition-colors radius-sm"
              >
                <FolderIcon size={14} />
                {t('settings.dataViewer.openPath', 'Open path')}
              </button>
            ) : null}
          </div>

          {loadingEntries ? <div className="text-xs text-text-muted">{t('settings.dataViewer.loadingEntries', 'Loading entries')}</div> : null}
          {entries?.entriesTruncated ? <div className="text-xs text-warning">{t('settings.dataViewer.entryListTruncated', 'Entry list is truncated to keep the UI responsive.')}</div> : null}

          <div className="space-y-2">
            {(entries?.entries ?? []).map(entry => (
              <div
                key={entry.relativePath}
                className="flex items-center justify-between gap-3 p-2 bg-surface-900 border border-surface-700 radius-sm"
                data-testid={`data-ownership-entry-${entry.name}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text-secondary truncate">{entry.name}</div>
                  <div className="text-[11px] text-text-muted truncate">{entry.relativePath} · {entry.kind} · {formatDataOwnershipBytes(entry.sizeBytes)} · {formatDataOwnershipTimestamp(entry.updatedAt)}</div>
                </div>
                {entry.kind === 'directory' && selectedRootId ? (
                  <button
                    type="button"
                    onClick={() => { void loadEntries(selectedRootId, entry.relativePath) }}
                    className="px-2 py-1 bg-surface-700 text-text-secondary text-[11px] hover:bg-surface-600 transition-colors radius-sm flex-shrink-0 whitespace-nowrap"
                  >
                    {t('settings.dataViewer.inspect', 'Inspect')}
                  </button>
                ) : null}
              </div>
            ))}
            {entries && entries.entries.length === 0 ? (
              <div className="text-xs text-text-muted">{t('settings.dataViewer.noEntries', 'No entries in this path.')}</div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}

function AdvancedPanel({
  settings,
  onSave,
  onExport,
  onImport,
  onReset,
}: {
  settings: AppSettings
  onSave: (updates: Partial<AppSettings>) => Promise<void>
  onExport: () => void
  onImport: () => void
  onReset: () => void
}) {
  const adv = settings.advanced
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [protocolBusy, setProtocolBusy] = useState(false)
  const [protocolResult, setProtocolResult] = useState<CommandRegisterOsProtocolResult | null>(null)
  const [protocolError, setProtocolError] = useState<string | null>(null)

  const updateAdvanced = (updates: Partial<AdvancedSettings>) => {
    onSave({ advanced: { ...adv, ...updates } })
  }

  const updateOsProtocolRegistration = async (register: boolean) => {
    const bridge = window.devhub?.r8?.command?.registerOsProtocol
    if (!bridge) {
      setProtocolError('当前运行环境未暴露 OS 协议注册桥接。')
      return
    }
    setProtocolBusy(true)
    setProtocolError(null)
    try {
      const result = await bridge(register, 'settings-dialog')
      setProtocolResult(result)
      if (!result.success) setProtocolError(result.message)
    } catch (error) {
      setProtocolError(error instanceof Error ? error.message : String(error))
    } finally {
      setProtocolBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="启动与托盘" />
        <div className="space-y-2">
          {/* TODO: autoStartOnBoot 后端实际未实现，UI 保留但标注说明 */}
          <SettingToggle
            label="开机自启动"
            description="(暂未实现) 登录系统时自动启动 DevHub"
            checked={adv.autoStartOnBoot}
            onChange={(v) => updateAdvanced({ autoStartOnBoot: v })}
          />
          <SettingToggle
            label="关闭时最小化到托盘"
            description="点击关闭按钮时隐藏到系统托盘而非退出"
            checked={adv.minimizeToTray}
            onChange={(v) => updateAdvanced({ minimizeToTray: v })}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="R8 功能开关" borderColor="border-warning" />
        <DashboardFeatureFlagControl />
      </section>

      <section>
        <SectionHeader title="外部 URI 协议" borderColor="border-info" />
        <div className="space-y-3 p-4 bg-surface-800 border-l-3 border-surface-600 radius-sm">
          <div>
            <div className="text-sm text-text-secondary">devhub:// 协议处理</div>
            <div className="mt-1 text-xs text-text-muted">
              注册后，外部应用打开 `devhub://port/3000` 会唤起 DevHub 并交给命令 URI 解析链路处理。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={protocolBusy}
              onClick={() => { void updateOsProtocolRegistration(true) }}
              className="px-4 py-2 bg-accent text-surface-950 text-sm hover:bg-accent/80 disabled:opacity-60 transition-colors radius-sm"
            >
              注册 devhub://
            </button>
            <button
              type="button"
              disabled={protocolBusy}
              onClick={() => { void updateOsProtocolRegistration(false) }}
              className="px-4 py-2 bg-surface-700 text-text-secondary text-sm hover:bg-surface-600 disabled:opacity-60 transition-colors radius-sm"
            >
              取消注册
            </button>
          </div>
          {protocolResult && (
            <div className="text-xs text-text-muted" data-testid="os-protocol-status">
              当前状态：{protocolResult.registered ? '已注册' : '未注册'}；平台：{protocolResult.platform}；处理程序：{protocolResult.handlerPath ?? '当前打包应用'}
            </div>
          )}
          {protocolError && <div className="text-xs text-warning" data-testid="os-protocol-error">{protocolError}</div>}
        </div>
      </section>

      <section>
        <SectionHeader title="命令面板自定义命令" borderColor="border-accent" />
        <CustomCommandManager />
      </section>

      <section>
        <SectionHeader title="日志与调试" borderColor="border-info" />
        <div className="space-y-2">
          <SettingSelect<LogLevel>
            label="日志级别"
            value={adv.logLevel}
            options={[
              { value: 'debug', label: 'Debug' },
              { value: 'info', label: 'Info' },
              { value: 'warn', label: 'Warn' },
              { value: 'error', label: 'Error' },
            ]}
            onChange={(v) => updateAdvanced({ logLevel: v })}
          />
          <SettingToggle
            label="开发者模式"
            description="启用后显示额外调试信息和开发工具"
            checked={adv.developerMode}
            onChange={(v) => updateAdvanced({ developerMode: v })}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="AI CLI 检测" borderColor="border-info" />
        <ToolDetectPanel />
      </section>

      <section>
        <SectionHeader title="语言与区域" borderColor="border-accent" />
        <LocaleSwitcher />
      </section>

      <section>
        <SectionHeader title="无障碍" borderColor="border-warning" />
        <A11ySettingsPanel />
      </section>

      <section data-testid="settings-about-fair-use">
        <SectionHeader title="关于与商标声明" borderColor="border-info" />
        <div className="space-y-3 p-4 bg-surface-800 border-l-3 border-surface-600 radius-sm">
          <div>
            <div className="text-sm text-text-secondary">DevHub</div>
            <div className="mt-1 text-xs text-text-muted">
              本应用用于本机开发工作台、窗口治理、任务运行与诊断观测；项目许可证为 AGPL-3.0，第三方依赖许可证以 NOTICE 与 CycloneDX SBOM 为准。
            </div>
          </div>
          <div className="text-xs text-text-muted leading-relaxed">
            厂商名称与 logo 仅用于识别对应工具、服务或集成目标。OpenAI、Anthropic、Google、GitHub、Microsoft 及其他第三方名称和标识归各自权利人所有；在 DevHub 中出现不表示赞助、背书、授权代理或商业从属关系。
          </div>
          <div className="text-xs text-text-muted leading-relaxed">
            README 中的 trademark and fair-use notice 是本声明的公开版本；应用内关于页保留相同边界，便于离线安装包和本地运行环境查看。
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="数据管理" borderColor="border-gold" />
        <div className="space-y-3">
          {/* Export / Import */}
          <div className="flex gap-3">
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 border-2 border-surface-600 text-text-secondary hover:border-surface-500 hover:text-text-primary transition-all text-sm radius-sm"
            >
              <DownloadIcon size={16} />
              导出设置
            </button>
            <button
              onClick={onImport}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 border-2 border-surface-600 text-text-secondary hover:border-surface-500 hover:text-text-primary transition-all text-sm radius-sm"
            >
              <UploadIcon size={16} />
              导入设置
            </button>
          </div>

          {/* Reset */}
          <div>
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-error border-2 border-error/30 hover:bg-error hover:text-white transition-all text-sm radius-sm"
              >
                <TrashIcon size={16} />
                重置为默认设置
              </button>
            ) : (
              <div
                className="p-4 bg-error/10 border-2 border-error/30 radius-sm"
              >
                <p className="text-sm text-text-secondary mb-3">
                  确定要将所有设置恢复为默认值吗？此操作无法撤销。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onReset()
                      setShowResetConfirm(false)
                    }}
                    className="px-4 py-2 bg-error text-white text-sm hover:bg-error/80 transition-colors radius-sm"
                  >
                    确认重置
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 bg-surface-700 text-text-secondary text-sm hover:bg-surface-600 transition-colors radius-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="端口安全" borderColor="border-warning" />
        <BlocklistEditor />
      </section>
    </div>
  )
}
