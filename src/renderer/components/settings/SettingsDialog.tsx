import { useState, useEffect } from 'react'
import { AppSettings } from '@shared/types'
import { CloseIcon, SettingsIcon, FolderIcon, CheckIcon } from '../icons'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [newPath, setNewPath] = useState('')
  const [availableDrives, setAvailableDrives] = useState<string[]>([])

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

  const handleSave = async (updates: Partial<AppSettings>) => {
    const devhub = window.devhub
    if (!devhub?.settings?.update || !settings) return
    try {
      const updated = await devhub.settings.update(updates)
      setSettings(updated)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const handleAddPath = async () => {
    if (!newPath.trim() || !settings) return
    const updatedPaths = [...settings.allowedPaths, newPath.trim()]
    await handleSave({ allowedPaths: updatedPaths })
    setNewPath('')
  }

  const handleBrowsePath = async () => {
    const devhub = window.devhub
    if (!devhub?.dialog?.openDirectory) return
    const selectedPath = await devhub.dialog.openDirectory()
    if (selectedPath) {
      setNewPath(selectedPath)
    }
  }

  const handleRemovePath = async (pathToRemove: string) => {
    if (!settings) return
    const updatedPaths = settings.allowedPaths.filter(p => p !== pathToRemove)
    await handleSave({ allowedPaths: updatedPaths })
  }

  const handleToggleDrive = async (drive: string) => {
    if (!settings) return
    const currentDrives = settings.scanDrives || []
    let updatedDrives: string[]

    if (currentDrives.includes(drive)) {
      if (currentDrives.length > 1) {
        updatedDrives = currentDrives.filter(d => d !== drive)
      } else {
        return
      }
    } else {
      updatedDrives = [...currentDrives, drive].sort()
    }

    await handleSave({ scanDrives: updatedDrives })
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="bg-surface-900 border-2 border-surface-600 w-full max-w-2xl mx-4 shadow-elevated max-h-[80vh] flex flex-col relative"
        style={{ borderRadius: '4px' }}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" style={{ borderRadius: '4px' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-surface-700 relative z-10">
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
                  transformOrigin: 'left center'
                }}
              >
                系统设置
              </h2>
              <p className="text-xs text-text-muted">APPLICATION SETTINGS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon-sm text-text-muted hover:text-text-primary"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
          {!settings ? (
            <div className="text-text-muted text-center py-8">加载中...</div>
          ) : (
            <>
              {/* General Settings */}
              <section>
                <h3
                  className="text-sm font-bold text-text-secondary mb-4 uppercase tracking-wider border-l-3 border-accent pl-3"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  常规设置
                </h3>
                <div className="space-y-2">
                  <SettingToggle
                    label="开机自启动"
                    checked={settings.autoStartOnBoot}
                    onChange={(checked) => handleSave({ autoStartOnBoot: checked })}
                  />
                  <SettingToggle
                    label="关闭时最小化到托盘"
                    checked={settings.minimizeToTray}
                    onChange={(checked) => handleSave({ minimizeToTray: checked })}
                  />
                  <SettingToggle
                    label="启用任务完成通知"
                    checked={settings.notificationEnabled}
                    onChange={(checked) => handleSave({ notificationEnabled: checked })}
                  />

                  {/* Check interval */}
                  <div
                    className="flex items-center justify-between p-3 bg-surface-800 border-l-3 border-surface-600"
                    style={{ borderRadius: '2px' }}
                  >
                    <span className="text-text-secondary text-sm">工具检测间隔</span>
                    <select
                      value={settings.checkInterval}
                      onChange={(e) => handleSave({ checkInterval: Number(e.target.value) })}
                      className="px-3 py-1.5 bg-surface-700 border border-surface-600 text-text-primary text-sm focus:outline-none focus:border-accent"
                      style={{ borderRadius: '2px' }}
                    >
                      <option value={1000}>1 秒</option>
                      <option value={3000}>3 秒</option>
                      <option value={5000}>5 秒</option>
                      <option value={10000}>10 秒</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Drive Scanning */}
              <section>
                <h3
                  className="text-sm font-bold text-text-secondary mb-4 uppercase tracking-wider border-l-3 border-info pl-3"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  扫描盘符
                </h3>
                <p className="text-xs text-text-muted mb-4">
                  选择要扫描项目的磁盘驱动器。扫描时会在这些盘符下查找常见的项目目录。
                </p>

                <div className="flex flex-wrap gap-2">
                  {availableDrives.length === 0 ? (
                    <p className="text-text-muted text-sm italic">正在检测可用盘符...</p>
                  ) : (
                    availableDrives.map((drive) => {
                      const isSelected = (settings.scanDrives || []).includes(drive)
                      const isOnlyOne = (settings.scanDrives || []).length === 1 && isSelected
                      return (
                        <button
                          key={drive}
                          onClick={() => handleToggleDrive(drive)}
                          disabled={isOnlyOne}
                          className={`
                            px-4 py-2 border-2 text-sm font-medium transition-all border-l-3
                            ${isSelected
                              ? 'bg-accent/20 border-accent text-accent'
                              : 'bg-surface-800 border-surface-600 text-text-muted hover:border-surface-500 hover:text-text-secondary'
                            }
                            ${isOnlyOne ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
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

              {/* Allowed Paths */}
              <section>
                <h3
                  className="text-sm font-bold text-text-secondary mb-4 uppercase tracking-wider border-l-3 border-success pl-3"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  允许的项目路径
                </h3>
                <p className="text-xs text-text-muted mb-4">
                  只有位于以下目录中的项目才能被添加。添加新路径后可以添加该目录下的项目。
                </p>

                {/* Existing paths */}
                <div className="space-y-2 mb-4">
                  {settings.allowedPaths.length === 0 ? (
                    <p className="text-text-muted text-sm italic">暂无自定义路径</p>
                  ) : (
                    settings.allowedPaths.map((path) => (
                      <div
                        key={path}
                        className="flex items-center justify-between bg-surface-800 px-4 py-2.5 group border-l-3 border-surface-600"
                        style={{ borderRadius: '2px' }}
                      >
                        <span className="text-text-secondary text-sm font-mono truncate flex-1" title={path}>
                          {path}
                        </span>
                        <button
                          onClick={() => handleRemovePath(path)}
                          className="btn-icon-sm text-text-muted hover:text-error ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="移除"
                        >
                          <CloseIcon size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add new path */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="输入或选择路径..."
                    className="flex-1 px-4 py-2 bg-surface-800 border-2 border-surface-600 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                    style={{ borderRadius: '2px' }}
                  />
                  <button
                    onClick={handleBrowsePath}
                    className="px-4 py-2 bg-surface-800 text-text-secondary hover:bg-surface-700 text-sm transition-colors border-l-2 border-surface-600"
                    style={{ borderRadius: '2px' }}
                  >
                    <FolderIcon size={16} />
                  </button>
                  <button
                    onClick={handleAddPath}
                    disabled={!newPath.trim()}
                    className="px-4 py-2 bg-accent text-white text-sm hover:bg-accent-600 disabled:opacity-50 transition-colors border-l-2 border-accent"
                    style={{ borderRadius: '2px' }}
                  >
                    添加
                  </button>
                </div>
              </section>

              {/* Default paths info */}
              <section>
                <h3
                  className="text-sm font-bold text-text-secondary mb-4 uppercase tracking-wider border-l-3 border-gold pl-3"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  默认扫描路径
                </h3>
                <div
                  className="text-xs text-text-muted space-y-1.5 font-mono bg-surface-800/50 p-4 border-2 border-surface-700"
                  style={{ borderRadius: '2px' }}
                >
                  <p className="text-text-tertiary mb-2">用户目录：</p>
                  <p>• 用户/Desktop</p>
                  <p>• 用户/Documents</p>
                  <p>• 用户/Projects</p>
                  <p>• 用户/workspace</p>
                  <p>• 用户/dev</p>
                  <p>• 用户/code</p>
                  <p className="text-text-tertiary mt-3 mb-2">已选盘符下的目录：</p>
                  {(settings.scanDrives || ['C', 'D']).map(drive => (
                    <p key={drive}>• {drive}:\Projects, {drive}:\Desktop, {drive}:\workspace, {drive}:\dev, {drive}:\code, {drive}:\work</p>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t-2 border-surface-700 relative z-10">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors"
            style={{ borderRadius: '2px' }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper component for toggle settings
function SettingToggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div
      className="flex items-center justify-between p-3 bg-surface-800 hover:bg-surface-700 transition-colors cursor-pointer border-l-3 border-surface-600"
      style={{ borderRadius: '2px' }}
      onClick={() => onChange(!checked)}
    >
      <span className="text-text-secondary text-sm">{label}</span>
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
        className={`
          relative w-10 h-5 transition-colors cursor-pointer
          ${checked ? 'bg-accent' : 'bg-surface-600'}
        `}
        style={{ borderRadius: '2px' }}
      >
        <div
          className={`
            absolute top-0.5 w-4 h-4 bg-white transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
          `}
          style={{ borderRadius: '2px' }}
        />
      </div>
    </div>
  )
}
