import { useEffect, memo, useState, useCallback } from 'react'
import { useWindows } from '../../hooks/useWindows'
import { WindowInfo, WindowGroup, WindowLayout } from '@shared/types-extended'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { StatCard } from '../ui/StatCard'
import { ViewModeToggle } from '../ui/ViewModeToggle'
import {
  WindowIcon,
  FolderIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  RefreshIcon,
  PlusIcon,
  CloseIcon,
  EyeIcon,
  TrashIcon,
  ChevronIcon,
  CheckIcon,
  CodeIcon,
  GlobeIcon,
  TerminalIcon,
  AlertIcon
} from '../icons'

// ============================================
// Window Type Icon Mapping
// ============================================
const getWindowTypeInfo = (processName: string): { icon: React.ReactNode; borderColor: string } => {
  const name = processName.toLowerCase()
  if (name.includes('code') || name.includes('ide')) {
    return { icon: <CodeIcon size={20} className="text-info" />, borderColor: 'border-info' }
  }
  if (name.includes('chrome') || name.includes('firefox') || name.includes('edge')) {
    return { icon: <GlobeIcon size={20} className="text-gold" />, borderColor: 'border-gold' }
  }
  if (name.includes('terminal') || name.includes('cmd') || name.includes('powershell')) {
    return { icon: <TerminalIcon size={20} className="text-success" />, borderColor: 'border-success' }
  }
  if (name.includes('explorer')) {
    return { icon: <FolderIcon size={20} className="text-warning" />, borderColor: 'border-warning' }
  }
  return { icon: <WindowIcon size={20} className="text-text-secondary" />, borderColor: 'border-surface-600' }
}

// ============================================
// Window Card - Cards View (Soviet Style)
// ============================================
interface WindowCardProps {
  window: WindowInfo
  isSelected: boolean
  isChecked: boolean
  onSelect: () => void
  onFocus: () => void
  onToggleCheck: () => void
  index: number
}

const WindowCard = memo(function WindowCard({
  window,
  isSelected,
  isChecked,
  onSelect,
  onFocus,
  onToggleCheck,
  index
}: WindowCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const typeInfo = getWindowTypeInfo(window.processName)

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onFocus}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        monitor-card group relative p-4 cursor-pointer animate-card-stagger
        ${isSelected
          ? 'ring-1 ring-accent/50 border-l-accent'
          : ''
        }
      `}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Diagonal decoration */}
      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" style={{ borderRadius: '2px' }} />

      {/* Checkbox */}
      <div
        className="absolute top-3 left-3 z-10"
        onClick={(e) => {
          e.stopPropagation()
          onToggleCheck()
        }}
      >
        <div
          className={`
            w-5 h-5 flex items-center justify-center border-2 transition-all cursor-pointer
            ${isChecked
              ? 'bg-accent border-accent'
              : 'border-surface-500 hover:border-accent'
            }
          `}
          style={{ borderRadius: '2px' }}
        >
          {isChecked && <CheckIcon size={12} className="text-white" />}
        </div>
      </div>

      <div className="flex items-start gap-4 ml-6">
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-12 h-12 bg-surface-700 flex items-center justify-center border-l-3 ${typeInfo.borderColor}`}
          style={{ borderRadius: '2px' }}
        >
          {typeInfo.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2 h-2 flex-shrink-0 ${
                window.isMinimized ? 'bg-warning animate-pulse' : 'bg-success'
              }`}
              style={{ borderRadius: '1px' }}
            />
            <h3
              className="text-sm font-semibold text-text-primary truncate"
              title={window.title}
            >
              {window.title.length > 50 ? window.title.slice(0, 50) + '...' : window.title}
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span
              className="font-mono bg-surface-800 px-2 py-0.5 border-l-2 border-surface-600"
              style={{ borderRadius: '2px' }}
            >
              {window.processName}
            </span>
            <span className="text-text-tertiary font-mono">PID: {window.pid}</span>
          </div>

          {/* Size Info */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-xs text-text-tertiary font-mono bg-surface-800/50 px-2 py-0.5 border-l-2 border-surface-600"
              style={{ borderRadius: '2px' }}
            >
              {window.rect.width} × {window.rect.height}
            </span>
            {window.isMinimized && (
              <span className="status-badge bg-warning/20 text-warning border-warning/30">
                最小化
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={`
          flex items-center gap-1 transition-all duration-200
          ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
        `}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onFocus()
            }}
            className="btn-icon-sm bg-accent/20 text-accent hover:bg-accent hover:text-white"
            title="聚焦窗口"
          >
            <EyeIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  )
})

// ============================================
// Window Item - List View (Soviet Style)
// ============================================
interface WindowItemProps {
  window: WindowInfo
  isSelected: boolean
  isChecked: boolean
  onSelect: () => void
  onFocus: () => void
  onToggleCheck: () => void
  index: number
}

const WindowItem = memo(function WindowItem({
  window,
  isSelected,
  isChecked,
  onSelect,
  onFocus,
  onToggleCheck,
  index
}: WindowItemProps) {
  const typeInfo = getWindowTypeInfo(window.processName)

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onFocus}
      className={`
        group flex items-center gap-3 p-3 cursor-pointer
        border-l-3 transition-all duration-200 animate-card-stagger
        ${isSelected
          ? 'bg-surface-800 border-l-accent'
          : 'border-transparent hover:bg-surface-800/50 hover:border-l-surface-600'
        }
      `}
      style={{ borderRadius: '2px', animationDelay: `${index * 20}ms` }}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <div
          onClick={onToggleCheck}
          className={`
            w-4 h-4 flex items-center justify-center border-2 transition-all cursor-pointer
            ${isChecked
              ? 'bg-accent border-accent'
              : 'border-surface-500 hover:border-accent'
            }
          `}
          style={{ borderRadius: '2px' }}
        >
          {isChecked && <CheckIcon size={10} className="text-white" />}
        </div>
      </div>

      {/* Status */}
      <span
        className={`w-2 h-2 flex-shrink-0 ${
          window.isMinimized ? 'bg-warning' : 'bg-success'
        }`}
        style={{ borderRadius: '1px' }}
      />

      {/* Icon */}
      <div className={`w-8 h-8 bg-surface-700 flex items-center justify-center border-l-2 ${typeInfo.borderColor}`} style={{ borderRadius: '2px' }}>
        {typeInfo.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate" title={window.title}>
            {window.title.length > 40 ? window.title.slice(0, 40) + '...' : window.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-muted">{window.processName}</span>
          <span className="text-xs text-text-tertiary font-mono">PID: {window.pid}</span>
        </div>
      </div>

      {/* Size & Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-text-tertiary font-mono">
          {window.rect.width}×{window.rect.height}
        </span>
        {window.isMinimized && (
          <span className="status-badge bg-warning/10 text-warning text-xs">
            最小化
          </span>
        )}
      </div>

      {/* Focus Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onFocus()
        }}
        className="btn-icon-sm opacity-0 group-hover:opacity-100 transition-opacity"
        title="聚焦窗口"
      >
        <EyeIcon size={16} />
      </button>
    </div>
  )
})

// ============================================
// Window Group Card (Soviet Style)
// ============================================
interface WindowGroupCardProps {
  group: WindowGroup
  isSelected: boolean
  onSelect: () => void
  onFocusGroup: () => void
  onRemove: () => void
  index: number
}

const WindowGroupCard = memo(function WindowGroupCard({
  group,
  isSelected,
  onSelect,
  onFocusGroup,
  onRemove,
  index
}: WindowGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <>
      <div
        className={`
          monitor-card relative overflow-hidden animate-card-stagger
          ${isSelected ? 'ring-1 ring-accent/50 border-l-accent' : 'border-l-purple-500'}
        `}
        style={{ animationDelay: `${index * 50}ms` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

        {/* Header */}
        <div
          onClick={onSelect}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-800/30 transition-colors cursor-pointer relative z-10"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="p-1 hover:bg-surface-700/50 transition-colors"
              style={{ borderRadius: '2px' }}
            >
              <ChevronIcon
                size={16}
                className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>

            <div
              className="w-10 h-10 bg-purple-500/20 flex items-center justify-center border-l-3 border-purple-500"
              style={{ borderRadius: '2px' }}
            >
              <FolderIcon size={20} className="text-purple-400" />
            </div>

            <div>
              <span className="text-sm font-semibold text-text-primary">{group.name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs text-text-muted bg-surface-800 px-2 py-0.5 border-l-2 border-purple-500"
                  style={{ borderRadius: '2px' }}
                >
                  {group.windows.length} 个窗口
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className={`
            flex items-center gap-2 transition-all duration-200
            ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
          `}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFocusGroup()
              }}
              className="btn-icon-sm bg-accent/20 text-accent hover:bg-accent hover:text-white"
              title="聚焦全部"
            >
              <GridIcon size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteConfirm(true)
              }}
              className="btn-icon-sm bg-error/10 text-error/70 hover:bg-error hover:text-white"
              title="删除分组"
            >
              <TrashIcon size={16} />
            </button>
          </div>
        </div>

        {/* Windows List */}
        {isExpanded && group.windows.length > 0 && (
          <div className="px-4 pb-4 space-y-1.5">
            {group.windows.map((window) => (
              <div
                key={window.hwnd}
                className="flex items-center gap-2 p-2 bg-surface-800/30 hover:bg-surface-800/50 transition-colors border-l-2 border-surface-600"
                style={{ borderRadius: '2px' }}
              >
                <span className="w-1.5 h-1.5 bg-success" style={{ borderRadius: '1px' }} />
                <span className="text-xs text-text-secondary truncate flex-1" title={window.title}>
                  {window.title}
                </span>
                <span className="text-xs text-text-muted font-mono">
                  {window.processName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除分组"
        message={`确定要删除窗口分组 "${group.name}" 吗？`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          onRemove()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
})

// ============================================
// Layout Card (Soviet Style)
// ============================================
interface LayoutCardProps {
  layout: WindowLayout
  onRestore: () => void
  onRemove: () => void
  index: number
}

const LayoutCard = memo(function LayoutCard({ layout, onRestore, onRemove, index }: LayoutCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <>
      <div
        className="monitor-card group p-4 border-l-cyan-500 animate-card-stagger"
        style={{ animationDelay: `${index * 50}ms` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" style={{ borderRadius: '2px' }} />

        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 bg-cyan-500/20 flex items-center justify-center border-l-3 border-cyan-500"
              style={{ borderRadius: '2px' }}
            >
              <GridIcon size={24} className="text-cyan-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary">{layout.name}</h4>
              {layout.description && (
                <p className="text-xs text-text-muted mt-0.5 max-w-xs">{layout.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="text-xs bg-surface-800 text-text-tertiary px-2 py-0.5 border-l-2 border-cyan-500"
                  style={{ borderRadius: '2px' }}
                >
                  {layout.groups.length} 个分组
                </span>
                <span className="text-xs text-text-muted">
                  创建于 {new Date(layout.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className={`
            flex items-center gap-2 transition-all duration-200
            ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
          `}>
            <button
              onClick={onRestore}
              className="px-3 py-1.5 text-xs font-medium bg-success/20 text-success hover:bg-success hover:text-white transition-all duration-200"
              style={{ borderRadius: '2px' }}
            >
              恢复布局
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-icon-sm bg-error/10 text-error/70 hover:bg-error hover:text-white"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除布局"
        message={`确定要删除布局 "${layout.name}" 吗？`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          onRemove()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
})

// ============================================
// Empty State (Soviet Style)
// ============================================
const EmptyState = memo(function EmptyState({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center relative">
      {/* Diagonal decoration */}
      <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />

      <div
        className="w-20 h-20 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-surface-600"
        style={{ borderRadius: '4px' }}
      >
        {icon}
      </div>
      <p
        className="text-text-secondary font-bold uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)', fontSize: '14px' }}
      >
        {title}
      </p>
      <p className="text-xs text-text-muted mt-1">{description}</p>
    </div>
  )
})

// ============================================
// Main WindowView Component
// ============================================
export function WindowView() {
  const {
    windows,
    groups,
    layouts,
    isScanning,
    selectedHwnd,
    selectedGroupId,
    scan,
    focusWindow,
    focusGroup,
    createGroup,
    fetchGroups,
    removeGroup,
    saveLayout,
    restoreLayout,
    fetchLayouts,
    removeLayout,
    selectWindow,
    selectGroup
  } = useWindows()

  const [viewTab, setViewTab] = useState<'windows' | 'groups' | 'layouts'>('windows')
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showSaveLayout, setShowSaveLayout] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newLayoutName, setNewLayoutName] = useState('')
  const [newLayoutDesc, setNewLayoutDesc] = useState('')
  const [selectedWindows, setSelectedWindows] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    scan()
    fetchGroups()
    fetchLayouts()
  }, [scan, fetchGroups, fetchLayouts])

  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim() || selectedWindows.size === 0) return
    await createGroup(newGroupName, Array.from(selectedWindows))
    setNewGroupName('')
    setSelectedWindows(new Set())
    setShowCreateGroup(false)
  }, [newGroupName, selectedWindows, createGroup])

  const handleSaveLayout = useCallback(async () => {
    if (!newLayoutName.trim()) return
    await saveLayout(newLayoutName, newLayoutDesc || undefined)
    setNewLayoutName('')
    setNewLayoutDesc('')
    setShowSaveLayout(false)
  }, [newLayoutName, newLayoutDesc, saveLayout])

  const toggleWindowSelection = (hwnd: number) => {
    const newSet = new Set(selectedWindows)
    if (newSet.has(hwnd)) {
      newSet.delete(hwnd)
    } else {
      newSet.add(hwnd)
    }
    setSelectedWindows(newSet)
  }

  // Filter windows
  const filteredWindows = windows.filter(w =>
    searchQuery === '' ||
    w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.processName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Statistics
  const stats = {
    total: windows.length,
    minimized: windows.filter(w => w.isMinimized).length,
    active: windows.filter(w => !w.isMinimized).length,
    groups: groups.length
  }

  // Tab items
  const tabItems: { key: 'windows' | 'groups' | 'layouts'; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'windows', label: '窗口', icon: <WindowIcon size={16} />, count: windows.length },
    { key: 'groups', label: '分组', icon: <FolderIcon size={16} />, count: groups.length },
    { key: 'layouts', label: '布局', icon: <GridIcon size={16} />, count: layouts.length }
  ]

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b-2 border-surface-700 bg-surface-900 relative">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 bg-surface-700 flex items-center justify-center border-l-3 border-accent"
              style={{ borderRadius: '2px' }}
            >
              <WindowIcon size={20} className="text-accent" />
            </div>
            <div>
              <h2
                className="text-gold font-bold uppercase tracking-wider"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  transform: 'rotate(-2deg)',
                  transformOrigin: 'left center'
                }}
              >
                窗口管理
              </h2>
              <p className="text-xs text-text-muted">WINDOW MANAGER</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            {viewTab === 'windows' && (
              <ViewModeToggle
                modes={[
                  { key: 'cards', icon: <GridIcon size={16} />, label: '卡片视图' },
                  { key: 'list', icon: <ListIcon size={16} />, label: '列表视图' }
                ]}
                current={viewMode}
                onChange={(mode) => setViewMode(mode as typeof viewMode)}
              />
            )}

            {/* Create Group Button */}
            {viewTab === 'windows' && selectedWindows.size > 0 && (
              <button
                onClick={() => setShowCreateGroup(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-accent/20 text-accent hover:bg-accent hover:text-white transition-all duration-200 border-l-2 border-accent"
                style={{ borderRadius: '2px' }}
              >
                <PlusIcon size={14} />
                创建分组 ({selectedWindows.size})
              </button>
            )}

            {/* Save Layout Button */}
            {viewTab === 'groups' && groups.length > 0 && (
              <button
                onClick={() => setShowSaveLayout(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-success/20 text-success hover:bg-success hover:text-white transition-all duration-200 border-l-2 border-success"
                style={{ borderRadius: '2px' }}
              >
                <FolderIcon size={14} />
                保存布局
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={scan}
              disabled={isScanning}
              className={`
                btn-icon-sm transition-all duration-200
                ${isScanning
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-text-primary'
                }
              `}
              title="刷新"
            >
              <RefreshIcon size={16} className={isScanning ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1">
            {tabItems.map((tab, index) => (
              <button
                key={tab.key}
                onClick={() => setViewTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200
                  ${viewTab === tab.key
                    ? 'bg-accent/15 text-accent border-l-2 border-accent'
                    : 'text-text-secondary hover:bg-surface-800 hover:text-text-primary border-l-2 border-transparent'
                  }
                `}
                style={{ borderRadius: '2px', animationDelay: `${index * 50}ms` }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={`
                    text-xs px-1.5 py-0.5 font-mono
                    ${viewTab === tab.key ? 'bg-accent/20' : 'bg-surface-700'}
                  `}
                  style={{ borderRadius: '2px' }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search (only for windows tab) */}
          {viewTab === 'windows' && (
            <div className="relative">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="搜索窗口..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-56 bg-surface-800 border border-surface-700 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50"
                style={{ borderRadius: '2px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Statistics (only for windows tab) */}
      {viewTab === 'windows' && (
        <div className="flex-shrink-0 px-5 py-4 border-b border-surface-700/50">
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={<WindowIcon size={20} className="text-info" />}
              label="总窗口数"
              value={stats.total}
              color="info"
            />
            <StatCard
              icon={<CheckIcon size={20} className="text-success" />}
              label="活动窗口"
              value={stats.active}
              color="success"
            />
            <StatCard
              icon={<AlertIcon size={20} className="text-warning" />}
              label="最小化"
              value={stats.minimized}
              color="warning"
            />
            <StatCard
              icon={<FolderIcon size={20} className="text-accent" />}
              label="分组数量"
              value={stats.groups}
              color="accent"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {viewTab === 'windows' && (
          viewMode === 'cards' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredWindows.map((window, index) => (
                <WindowCard
                  key={window.hwnd}
                  window={window}
                  isSelected={selectedHwnd === window.hwnd}
                  isChecked={selectedWindows.has(window.hwnd)}
                  onSelect={() => selectWindow(window.hwnd)}
                  onFocus={() => focusWindow(window.hwnd)}
                  onToggleCheck={() => toggleWindowSelection(window.hwnd)}
                  index={index}
                />
              ))}
              {filteredWindows.length === 0 && (
                <div className="col-span-full">
                  <EmptyState
                    icon={<SearchIcon size={40} className="text-text-muted" />}
                    title="未找到窗口"
                    description={searchQuery ? '尝试其他搜索关键词' : '系统中没有可用窗口'}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredWindows.map((window, index) => (
                <WindowItem
                  key={window.hwnd}
                  window={window}
                  isSelected={selectedHwnd === window.hwnd}
                  isChecked={selectedWindows.has(window.hwnd)}
                  onSelect={() => selectWindow(window.hwnd)}
                  onFocus={() => focusWindow(window.hwnd)}
                  onToggleCheck={() => toggleWindowSelection(window.hwnd)}
                  index={index}
                />
              ))}
              {filteredWindows.length === 0 && (
                <EmptyState
                  icon={<SearchIcon size={40} className="text-text-muted" />}
                  title="未找到窗口"
                  description={searchQuery ? '尝试其他搜索关键词' : '系统中没有可用窗口'}
                />
              )}
            </div>
          )
        )}

        {viewTab === 'groups' && (
          <div className="space-y-4">
            {groups.map((group, index) => (
              <WindowGroupCard
                key={group.id}
                group={group}
                isSelected={selectedGroupId === group.id}
                onSelect={() => selectGroup(group.id)}
                onFocusGroup={() => focusGroup(group.id)}
                onRemove={() => removeGroup(group.id)}
                index={index}
              />
            ))}
            {groups.length === 0 && (
              <EmptyState
                icon={<FolderIcon size={40} className="text-text-muted" />}
                title="暂无窗口分组"
                description="在窗口列表中选择窗口并创建分组"
              />
            )}
          </div>
        )}

        {viewTab === 'layouts' && (
          <div className="space-y-4">
            {layouts.map((layout, index) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onRestore={() => restoreLayout(layout.id)}
                onRemove={() => removeLayout(layout.id)}
                index={index}
              />
            ))}
            {layouts.length === 0 && (
              <EmptyState
                icon={<GridIcon size={40} className="text-text-muted" />}
                title="暂无保存的布局"
                description="创建分组后可保存为布局"
              />
            )}
          </div>
        )}
      </div>

      {/* Create Group Dialog */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div
            className="bg-surface-900 p-6 w-[420px] border-2 border-surface-700 shadow-2xl relative"
            style={{ borderRadius: '4px' }}
          >
            {/* Diagonal decoration */}
            <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" style={{ borderRadius: '4px' }} />

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div
                className="w-10 h-10 bg-accent/20 flex items-center justify-center border-l-3 border-accent"
                style={{ borderRadius: '2px' }}
              >
                <FolderIcon size={20} className="text-accent" />
              </div>
              <div>
                <h3
                  className="text-gold font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    transform: 'rotate(-1deg)',
                    transformOrigin: 'left center'
                  }}
                >
                  创建窗口分组
                </h3>
                <p className="text-xs text-text-muted">将选中的窗口添加到新分组</p>
              </div>
            </div>

            <input
              type="text"
              placeholder="输入分组名称..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-surface-800 border-2 border-surface-600 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent relative z-10"
              style={{ borderRadius: '2px' }}
            />

            <div
              className="flex items-center gap-2 mt-3 p-3 bg-surface-800/50 border-l-3 border-success relative z-10"
              style={{ borderRadius: '2px' }}
            >
              <CheckIcon size={18} className="text-success" />
              <span className="text-sm text-text-secondary">
                已选择 <span className="font-bold text-accent">{selectedWindows.size}</span> 个窗口
              </span>
            </div>

            <div className="flex justify-end gap-3 mt-6 relative z-10">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="px-5 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors"
                style={{ borderRadius: '2px' }}
              >
                取消
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="px-5 py-2.5 bg-accent text-white font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-l-2 border-accent-400"
                style={{ borderRadius: '2px' }}
              >
                创建分组
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Layout Dialog */}
      {showSaveLayout && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div
            className="bg-surface-900 p-6 w-[420px] border-2 border-surface-700 shadow-2xl relative"
            style={{ borderRadius: '4px' }}
          >
            {/* Diagonal decoration */}
            <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" style={{ borderRadius: '4px' }} />

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div
                className="w-10 h-10 bg-success/20 flex items-center justify-center border-l-3 border-success"
                style={{ borderRadius: '2px' }}
              >
                <GridIcon size={20} className="text-success" />
              </div>
              <div>
                <h3
                  className="text-gold font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    transform: 'rotate(-1deg)',
                    transformOrigin: 'left center'
                  }}
                >
                  保存窗口布局
                </h3>
                <p className="text-xs text-text-muted">保存当前分组配置以便稍后恢复</p>
              </div>
            </div>

            <input
              type="text"
              placeholder="布局名称..."
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-surface-800 border-2 border-surface-600 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent mb-3 relative z-10"
              style={{ borderRadius: '2px' }}
            />

            <textarea
              placeholder="描述（可选）..."
              value={newLayoutDesc}
              onChange={(e) => setNewLayoutDesc(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-surface-800 border-2 border-surface-600 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none relative z-10"
              style={{ borderRadius: '2px' }}
            />

            <div
              className="flex items-center gap-2 mt-3 p-3 bg-surface-800/50 border-l-3 border-info relative z-10"
              style={{ borderRadius: '2px' }}
            >
              <AlertIcon size={18} className="text-info" />
              <span className="text-sm text-text-secondary">
                将保存 <span className="font-bold text-accent">{groups.length}</span> 个分组
              </span>
            </div>

            <div className="flex justify-end gap-3 mt-6 relative z-10">
              <button
                onClick={() => setShowSaveLayout(false)}
                className="px-5 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors"
                style={{ borderRadius: '2px' }}
              >
                取消
              </button>
              <button
                onClick={handleSaveLayout}
                disabled={!newLayoutName.trim()}
                className="px-5 py-2.5 bg-success text-white font-medium hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-l-2 border-success"
                style={{ borderRadius: '2px' }}
              >
                保存布局
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
