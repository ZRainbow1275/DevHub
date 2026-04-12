import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  AppSettings,
  AppearanceSettings,
  ScanSettings,
  ProcessSettings,
  NotificationSettings,
  WindowSettings,
  AdvancedSettings,
  ThemeOption,
  FontSize,
  SidebarPosition,
  LogLevel,
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
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
import { useTheme, type ThemeName } from '../../hooks/useTheme'

// ============ Types ============

type SettingsCategory = 'appearance' | 'scan' | 'process' | 'notification' | 'window' | 'advanced'

interface CategoryDef {
  key: SettingsCategory
  label: string
  sublabel: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const CATEGORIES: CategoryDef[] = [
  { key: 'appearance', label: '外观', sublabel: 'APPEARANCE', icon: PaletteIcon },
  { key: 'scan', label: '扫描', sublabel: 'SCAN', icon: ScanIcon },
  { key: 'process', label: '进程', sublabel: 'PROCESS', icon: ProcessIcon },
  { key: 'notification', label: '通知', sublabel: 'NOTIFICATION', icon: BellIcon },
  { key: 'window', label: '窗口', sublabel: 'WINDOW', icon: LayoutIcon },
  { key: 'advanced', label: '高级', sublabel: 'ADVANCED', icon: WrenchIcon },
]

const THEMES: { key: ThemeName; name: string; desc: string; colors: [string, string, string] }[] = [
  { key: 'constructivism', name: '构成主义', desc: '暗色·红金·工业·紧凑', colors: ['#1a1814', '#d64545', '#c9a227'] },
  { key: 'cyberpunk', name: '赛博朋克', desc: '暗色·霓虹·发光·未来', colors: ['#0a0a12', '#00ffff', '#ff00aa'] },
  { key: 'swiss', name: '瑞士极简', desc: '亮色·黑白·方角·克制', colors: ['#ffffff', '#1a1a1a', '#ff0000'] },
  { key: 'modern-light', name: '现代明亮', desc: '亮色·蓝白·圆角·专业', colors: ['#f8f9fa', '#3b82f6', '#f59e0b'] },
  { key: 'warm-light', name: '暖光', desc: '亮色·铜金·柔和·温暖', colors: ['#faf8f5', '#b85c38', '#c9a227'] },
]

// ============ Props ============

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

// ============ Main Component ============

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance')
  const [availableDrives, setAvailableDrives] = useState<string[]>([])
  const { theme, setTheme } = useTheme()
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      const devhub = window.devhub
      const loadSettings = devhub?.settings?.get?.() || Promise.resolve(null)
      const loadDrives = devhub?.system?.getDrives?.() || Promise.resolve([])

      Promise.all([loadSettings, loadDrives])
        .then(([s, drives]) => {
          if (s) setSettings(s)
          if (drives) setAvailableDrives(drives)
        })
        .catch((e: Error) => {
          console.error('[SettingsDialog] Error fetching data:', e)
        })
    }
  }, [isOpen])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdatesRef = useRef<Partial<AppSettings>>({})
  const handleSave = useCallback(async (updates: Partial<AppSettings>): Promise<void> => {
    const devhub = window.devhub
    if (!devhub?.settings?.update) return
    // Merge pending updates to avoid lost writes when debouncing
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    return new Promise<void>((resolve) => {
      saveTimerRef.current = setTimeout(async () => {
        const merged = pendingUpdatesRef.current
        pendingUpdatesRef.current = {}
        try {
          const updated = await devhub.settings.update(merged)
          setSettings(updated)
        } catch (error) {
          console.error('Failed to save settings:', error)
        } finally {
          resolve()
        }
      }, 300)
    })
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
      // Also reset theme in DOM
      setTheme(DEFAULT_SETTINGS.appearance.theme as ThemeName)
    } catch (error) {
      console.error('Failed to reset settings:', error)
    }
  }, [setTheme])

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
        // Apply theme
        if (updated?.appearance?.theme) {
          setTheme(updated.appearance.theme as ThemeName)
        }
      } catch (error) {
        console.error('Failed to import settings:', error)
      }
    }
    input.click()
  }, [setTheme])

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="bg-surface-900 border-2 border-surface-600 w-full max-w-4xl mx-4 shadow-elevated flex flex-col relative"
        style={{ borderRadius: '4px', height: '80vh', maxHeight: '700px' }}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" style={{ borderRadius: '4px' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-surface-700 relative z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 bg-gold/20 flex items-center justify-center border-l-3 border-gold"
              style={{ borderRadius: '2px' }}
            >
              <SettingsIcon size={20} className="text-gold" />
            </div>
            <div>
              <h2
                id="settings-dialog-title"
                className="text-gold font-bold uppercase tracking-wider"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  transform: 'rotate(-1deg)',
                  transformOrigin: 'left center',
                }}
              >
                系统设置
              </h2>
              <p className="text-xs text-text-muted">APPLICATION SETTINGS</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon-sm text-text-muted hover:text-text-primary">
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Body: Left Nav + Right Panel */}
        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Left Navigation */}
          <nav
            ref={navRef}
            className="w-48 flex-shrink-0 border-r-2 border-surface-700 overflow-y-auto py-2"
            aria-label="Settings categories"
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
                  <Icon size={16} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{cat.label}</span>
                    <span className="text-[10px] text-text-muted tracking-wider">{cat.sublabel}</span>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* Right Panel */}
          <div className="flex-1 overflow-y-auto p-6">
            {!settings ? (
              <div className="text-text-muted text-center py-8">加载中...</div>
            ) : (
              <>
                {activeCategory === 'appearance' && (
                  <AppearancePanel settings={settings} onSave={handleSave} theme={theme} setTheme={setTheme} />
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
            className="px-4 py-2 text-text-secondary hover:bg-surface-800 transition-colors"
            style={{ borderRadius: '2px' }}
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
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div
      className="flex items-center justify-between p-3 bg-surface-800 hover:bg-surface-700 transition-colors cursor-pointer border-l-3 border-surface-600"
      style={{ borderRadius: '2px' }}
      onClick={() => onChange(!checked)}
    >
      <div className="flex flex-col">
        <span className="text-text-secondary text-sm">{label}</span>
        {description && <span className="text-text-muted text-xs mt-0.5">{description}</span>}
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
        className={`relative w-10 h-5 transition-colors cursor-pointer flex-shrink-0 ${checked ? 'bg-accent' : 'bg-surface-600'}`}
        style={{ borderRadius: '2px' }}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
          style={{ borderRadius: '2px' }}
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
      className="p-3 bg-surface-800 border-l-3 border-surface-600"
      style={{ borderRadius: '2px' }}
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
        className="w-full h-1.5 bg-surface-600 appearance-none cursor-pointer accent-accent"
        style={{ borderRadius: '0' }}
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
      className="flex items-center justify-between p-3 bg-surface-800 border-l-3 border-surface-600"
      style={{ borderRadius: '2px' }}
    >
      <span className="text-text-secondary text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-3 py-1.5 bg-surface-700 border border-surface-600 text-text-primary text-sm focus:outline-none focus:border-accent"
        style={{ borderRadius: '2px' }}
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
              className="flex items-center justify-between bg-surface-800 px-4 py-2 group border-l-3 border-surface-600"
              style={{ borderRadius: '2px' }}
            >
              <span className="text-text-secondary text-sm font-mono truncate flex-1" title={item}>
                {item}
              </span>
              <button
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
          className="flex-1 px-4 py-2 bg-surface-800 border-2 border-surface-600 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          style={{ borderRadius: '2px' }}
        />
        {allowBrowse && (
          <button
            onClick={handleBrowse}
            className="px-3 py-2 bg-surface-800 text-text-secondary hover:bg-surface-700 text-sm transition-colors border-l-2 border-surface-600"
            style={{ borderRadius: '2px' }}
            title="浏览文件夹"
          >
            <FolderIcon size={16} />
          </button>
        )}
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="px-3 py-2 bg-accent text-white text-sm hover:bg-accent-600 disabled:opacity-50 transition-colors"
          style={{ borderRadius: '2px' }}
        >
          <PlusIcon size={16} />
        </button>
      </div>
    </div>
  )
}

// ============ Appearance Panel ============

function AppearancePanel({
  settings,
  onSave,
  theme,
  setTheme,
}: {
  settings: AppSettings
  onSave: (updates: Partial<AppSettings>) => Promise<void>
  theme: ThemeName
  setTheme: (name: ThemeName) => void
}) {
  const appearance = settings.appearance

  const updateAppearance = (updates: Partial<AppearanceSettings>) => {
    onSave({ appearance: { ...appearance, ...updates } })
  }

  return (
    <div className="space-y-6">
      {/* Theme Selector */}
      <section>
        <SectionHeader title="主题风格" />
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const isActive = theme === t.key
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTheme(t.key)
                  updateAppearance({ theme: t.key as ThemeOption })
                }}
                className={`relative p-3 border-2 transition-all text-left ${
                  isActive ? 'border-accent bg-surface-800' : 'border-surface-600 bg-surface-800/50 hover:border-surface-500'
                }`}
                style={{ borderRadius: '4px' }}
              >
                {isActive && (
                  <div className="absolute top-1.5 right-1.5">
                    <CheckIcon size={14} className="text-accent" />
                  </div>
                )}
                <div className="flex gap-1.5 mb-2">
                  {t.colors.map((c, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 border border-surface-600"
                      style={{ backgroundColor: c, borderRadius: '2px' }}
                    />
                  ))}
                </div>
                <div className="text-sm font-medium text-text-primary">{t.name}</div>
                <div className="text-xs text-text-muted">{t.desc}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Font Size */}
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
          <SettingToggle
            label="紧凑模式"
            description="减少间距，显示更多内容"
            checked={appearance.compactMode}
            onChange={(v) => updateAppearance({ compactMode: v })}
          />
          <SettingToggle
            label="动画效果"
            description="禁用可减少视觉干扰并提升性能"
            checked={appearance.enableAnimations}
            onChange={(v) => updateAppearance({ enableAnimations: v })}
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
                  } ${isOnlyOne ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ borderRadius: '2px' }}
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
          className="text-xs text-text-muted space-y-1.5 font-mono bg-surface-800/50 p-4 border-2 border-surface-700"
          style={{ borderRadius: '2px' }}
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
            <p key={drive}>
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
              className="flex items-center gap-3 p-3 bg-surface-800 border-l-3 border-surface-600"
              style={{ borderRadius: '2px' }}
            >
              <span className="text-text-secondary text-sm">时间段</span>
              <input
                type="time"
                value={notif.quietHoursStart}
                onChange={(e) => updateNotification({ quietHoursStart: e.target.value })}
                className="px-2 py-1 bg-surface-700 border border-surface-600 text-text-primary text-sm focus:outline-none focus:border-accent"
                style={{ borderRadius: '2px' }}
              />
              <span className="text-text-muted text-sm">至</span>
              <input
                type="time"
                value={notif.quietHoursEnd}
                onChange={(e) => updateNotification({ quietHoursEnd: e.target.value })}
                className="px-2 py-1 bg-surface-700 border border-surface-600 text-text-primary text-sm focus:outline-none focus:border-accent"
                style={{ borderRadius: '2px' }}
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

  const updateWindow = (updates: Partial<WindowSettings>) => {
    onSave({ window: { ...win, ...updates } })
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
    </div>
  )
}

// ============ Advanced Panel ============

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

  const updateAdvanced = (updates: Partial<AdvancedSettings>) => {
    onSave({ advanced: { ...adv, ...updates } })
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
        <SectionHeader title="数据管理" borderColor="border-gold" />
        <div className="space-y-3">
          {/* Export / Import */}
          <div className="flex gap-3">
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 border-2 border-surface-600 text-text-secondary hover:border-surface-500 hover:text-text-primary transition-all text-sm"
              style={{ borderRadius: '2px' }}
            >
              <DownloadIcon size={16} />
              导出设置
            </button>
            <button
              onClick={onImport}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 border-2 border-surface-600 text-text-secondary hover:border-surface-500 hover:text-text-primary transition-all text-sm"
              style={{ borderRadius: '2px' }}
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
                className="flex items-center gap-2 px-4 py-2.5 text-error border-2 border-error/30 hover:bg-error hover:text-white transition-all text-sm"
                style={{ borderRadius: '2px' }}
              >
                <TrashIcon size={16} />
                重置为默认设置
              </button>
            ) : (
              <div
                className="p-4 bg-error/10 border-2 border-error/30"
                style={{ borderRadius: '2px' }}
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
                    className="px-4 py-2 bg-error text-white text-sm hover:bg-error/80 transition-colors"
                    style={{ borderRadius: '2px' }}
                  >
                    确认重置
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 bg-surface-700 text-text-secondary text-sm hover:bg-surface-600 transition-colors"
                    style={{ borderRadius: '2px' }}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
