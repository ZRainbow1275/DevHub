import { useState, useEffect, useCallback, useRef } from 'react'
import type { DrawerSlot } from '@shared/schemas/r8-runtime'
import { useProjectStore } from '../../stores/projectStore'
import { useDrawerStore } from '../../stores/drawerStore'
import { useProjects } from '../../hooks/useProjects'
import { useWindowSize } from '../../hooks/useWindowSize'
import { useT } from '../../hooks/useT'
import { useToast } from '../ui/Toast'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ContextMenu } from '../ui/ContextMenu'
import { DRAWER_CONTENT_REGISTRY, DRAWER_SLOTS } from '../drawer/drawer-model'
import { FolderIcon, TagIcon, GroupIcon, GearIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon, StopIcon, TopologyIcon, PlusIcon, InfoIcon, TrashIcon, MenuIcon, BellIcon, TerminalIcon, WindowIcon, GridIcon } from '../icons'

const PROJECT_DRAG_MIME = 'application/x-devhub-project'

const SIDEBAR_STORAGE_KEY = 'devhub:sidebar-collapsed'
const SIDEBAR_WIDTH_KEY = 'devhub:sidebar-width'
// Sidebar widths in rem so the rail scales with browser/OS zoom.
// Matches the CSS custom property values (--sidebar-w) maintained in globals.css.
const MIN_SIDEBAR_WIDTH = 12.5 // rem (200px @ 16px root)
const MAX_SIDEBAR_WIDTH = 25 // rem (400px @ 16px root)
const DEFAULT_SIDEBAR_WIDTH = 14 // rem (224px @ 16px root)
const COLLAPSED_WIDTH = 3.5 // rem (56px @ 16px root)

/** Read the root font size so we can translate pointer-pixel deltas into rem. */
function rootFontSizePx(): number {
  if (typeof window === 'undefined') return 16
  const parsed = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16
}

/**
 * Parse a persisted sidebar width into rem.
 * Legacy builds stored raw pixels (e.g. "224"); newer builds store rem (e.g. "14").
 * Heuristic: any stored value above the rem MAX is treated as a legacy px value.
 */
function parseStoredSidebarWidth(stored: string | null): number | null {
  if (!stored) return null
  const value = parseFloat(stored)
  if (!Number.isFinite(value)) return null
  const remValue = value > MAX_SIDEBAR_WIDTH ? value / rootFontSizePx() : value
  if (remValue >= MIN_SIDEBAR_WIDTH && remValue <= MAX_SIDEBAR_WIDTH) return remValue
  return null
}

interface SidebarProps {
  onSettingsClick: () => void
  onTopologyClick: () => void
}

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function Sidebar({ onSettingsClick, onTopologyClick }: SidebarProps) {
  const [tags, setTags] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return parseStoredSidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_KEY)) ?? DEFAULT_SIDEBAR_WIDTH
  })
  const [isDragging, setIsDragging] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  const filter = useProjectStore(s => s.filter)
  const setTagFilter = useProjectStore(s => s.setTagFilter)
  const setGroupFilter = useProjectStore(s => s.setGroupFilter)
  const projects = useProjectStore(s => s.projects)
  const updateProjectInStore = useProjectStore(s => s.updateProject)
  const { startGroup, stopGroup, startByTag, stopByTag, getGroupStats, getTagStats } = useProjects()
  const { width } = useWindowSize()
  const { showToast } = useToast()

  // Group management state
  const [groupCreatorOpen, setGroupCreatorOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingGroupDraft, setEditingGroupDraft] = useState('')
  const [groupContextMenu, setGroupContextMenu] = useState<{ x: number; y: number; group: string } | null>(null)
  const [groupDeleteConfirm, setGroupDeleteConfirm] = useState<string | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  const editingInputRef = useRef<HTMLInputElement>(null)

  // Auto-collapse on narrow windows and auto-expand again when there is room.
  // The auto state is kept separate from user-driven toggles (handleToggleCollapse)
  // and is NOT persisted, so a brief narrow window never permanently sticks the
  // sidebar collapsed once the window grows back.
  const autoCollapsedRef = useRef(false)
  useEffect(() => {
    if (width < 1000) {
      if (!collapsed) {
        autoCollapsedRef.current = true
        setCollapsed(true)
      }
    } else if (width >= 1000 && autoCollapsedRef.current) {
      autoCollapsedRef.current = false
      setCollapsed(false)
    }
  }, [width]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isElectron || !window.devhub.tags || !window.devhub.groups) return

    const refresh = () => {
      window.devhub.tags.list().then(setTags).catch(() => setTags([]))
      window.devhub.groups.list().then(setGroups).catch(() => setGroups([]))
    }

    refresh()
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [])

  // Drag handle for width adjustment
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (collapsed) return
    e.preventDefault()
    setIsDragging(true)

    const startX = e.clientX
    const startWidth = sidebarWidth // rem
    const remPx = rootFontSizePx()

    const onPointerMove = (moveEvent: PointerEvent) => {
      // Pointer deltas are CSS pixels; convert to rem so the model stays zoom-stable.
      const deltaRem = (moveEvent.clientX - startX) / remPx
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + deltaRem))
      setSidebarWidth(newWidth)
    }

    const onPointerUp = () => {
      setIsDragging(false)
      // Persist width (rem) once the drag settles.
      setSidebarWidth(current => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(current))
        return current
      })
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }, [collapsed, sidebarWidth])

  // Persist width when it changes during drag
  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
    }
  }, [sidebarWidth, isDragging])

  const handleToggleCollapse = useCallback(() => {
    const next = !collapsed
    // A manual toggle is user intent: clear the auto-collapse flag so the
    // responsive effect does not later override the user's choice.
    autoCollapsedRef.current = false
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
  }, [collapsed])

  const isAllActive = !filter.tag && !filter.group

  const handleStartTag = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation()
    startByTag(tag)
  }

  const handleStopTag = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation()
    stopByTag(tag)
  }

  const handleStartGroup = (e: React.MouseEvent, group: string) => {
    e.stopPropagation()
    startGroup(group)
  }

  const handleStopGroup = (e: React.MouseEvent, group: string) => {
    e.stopPropagation()
    stopGroup(group)
  }

  // ---------------- Group create / rename / delete ----------------

  const refreshGroups = useCallback(async () => {
    if (!isElectron || !window.devhub.groups) return
    try {
      const list = await window.devhub.groups.list()
      setGroups(list)
    } catch {
      // ignore
    }
  }, [])

  const handleOpenGroupCreator = useCallback(() => {
    setGroupCreatorOpen(true)
    setNewGroupName('')
    setTimeout(() => newGroupInputRef.current?.focus(), 0)
  }, [])

  const handleCancelCreateGroup = useCallback(() => {
    setGroupCreatorOpen(false)
    setNewGroupName('')
  }, [])

  const handleConfirmCreateGroup = useCallback(async () => {
    const name = newGroupName.trim()
    if (!name) {
      setGroupCreatorOpen(false)
      return
    }
    if (!isElectron || !window.devhub.groups) {
      setGroupCreatorOpen(false)
      return
    }
    if (groups.includes(name)) {
      showToast('warning', `分组 "${name}" 已存在`)
      return
    }
    try {
      await window.devhub.groups.add(name)
      await refreshGroups()
      showToast('success', `分组 "${name}" 已创建`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '创建分组失败')
    } finally {
      setGroupCreatorOpen(false)
      setNewGroupName('')
    }
  }, [newGroupName, groups, refreshGroups, showToast])

  const handleStartRenameGroup = useCallback((group: string) => {
    setEditingGroup(group)
    setEditingGroupDraft(group)
    setTimeout(() => editingInputRef.current?.focus(), 0)
  }, [])

  const handleCancelRename = useCallback(() => {
    setEditingGroup(null)
    setEditingGroupDraft('')
  }, [])

  const handleCommitRename = useCallback(async (originalGroup: string) => {
    const next = editingGroupDraft.trim()
    if (!next || next === originalGroup) {
      handleCancelRename()
      return
    }
    if (groups.includes(next)) {
      showToast('warning', `分组 "${next}" 已存在`)
      return
    }
    if (!isElectron || !window.devhub.groups) {
      handleCancelRename()
      return
    }
    // No native rename IPC -> emulate via add + remove + bulk update projects
    try {
      await window.devhub.groups.add(next)
      const affected = projects.filter(p => p.group === originalGroup)
      await Promise.all(
        affected.map(p =>
          window.devhub.projects.update(p.id, { group: next }).then(() => {
            updateProjectInStore(p.id, { group: next })
          })
        )
      )
      await window.devhub.groups.remove(originalGroup)
      await refreshGroups()
      // Keep filter consistent if it pointed to the renamed group
      if (filter.group === originalGroup) {
        setGroupFilter(next)
      }
      showToast('success', `分组已重命名为 "${next}"`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '重命名分组失败')
    } finally {
      handleCancelRename()
    }
  }, [editingGroupDraft, groups, projects, updateProjectInStore, refreshGroups, filter.group, setGroupFilter, showToast, handleCancelRename])

  const handleRequestDeleteGroup = useCallback((group: string) => {
    setGroupDeleteConfirm(group)
    setGroupContextMenu(null)
  }, [])

  const handleConfirmDeleteGroup = useCallback(async () => {
    const target = groupDeleteConfirm
    if (!target) return
    if (!isElectron || !window.devhub.groups) {
      setGroupDeleteConfirm(null)
      return
    }
    try {
      const affected = projects.filter(p => p.group === target)
      // Clear group on affected projects first so list view stays consistent
      await Promise.all(
        affected.map(p =>
          window.devhub.projects.update(p.id, { group: undefined }).then(() => {
            updateProjectInStore(p.id, { group: undefined })
          })
        )
      )
      await window.devhub.groups.remove(target)
      await refreshGroups()
      if (filter.group === target) {
        setGroupFilter(null)
      }
      showToast('success', `分组 "${target}" 已删除`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '删除分组失败')
    } finally {
      setGroupDeleteConfirm(null)
    }
  }, [groupDeleteConfirm, projects, updateProjectInStore, refreshGroups, filter.group, setGroupFilter, showToast])

  const handleGroupContextMenu = useCallback((e: React.MouseEvent, group: string) => {
    e.preventDefault()
    e.stopPropagation()
    setGroupContextMenu({ x: e.clientX, y: e.clientY, group })
  }, [])

  // ---------------- Drag and drop (project card -> group) ----------------

  const handleGroupDragOver = useCallback((e: React.DragEvent, group: string) => {
    if (!e.dataTransfer.types.includes(PROJECT_DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverGroup(group)
  }, [])

  const handleGroupDragLeave = useCallback((e: React.DragEvent, group: string) => {
    // Only clear if the relatedTarget is outside this group container
    const currentTarget = e.currentTarget as HTMLElement
    const next = e.relatedTarget as Node | null
    if (next && currentTarget.contains(next)) return
    setDragOverGroup(current => (current === group ? null : current))
  }, [])

  const handleGroupDrop = useCallback(async (e: React.DragEvent, group: string) => {
    if (!e.dataTransfer.types.includes(PROJECT_DRAG_MIME)) return
    e.preventDefault()
    const projectId = e.dataTransfer.getData(PROJECT_DRAG_MIME)
    setDragOverGroup(null)
    if (!projectId || !isElectron) return
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    if (project.group === group) return
    try {
      await window.devhub.projects.update(projectId, { group })
      updateProjectInStore(projectId, { group })
      showToast('success', `已将 "${project.name}" 分配到 "${group}"`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '分配分组失败')
    }
  }, [projects, updateProjectInStore, showToast])

  const handleGroupKeyDown = useCallback((e: React.KeyboardEvent, group: string) => {
    if (e.key === 'F2') {
      e.preventDefault()
      handleStartRenameGroup(group)
    }
  }, [handleStartRenameGroup])

  // ---- Drawer launcher (moved from DrawerSystemHost) ----
  const { t } = useT()
  const drawerSetContent = useDrawerStore(store => store.setContent)
  const drawerSetOpen = useDrawerStore(store => store.setOpen)
  const [drawerMenuOpen, setDrawerMenuOpen] = useState(false)
  const drawerMenuRef = useRef<HTMLDivElement | null>(null)
  const drawerToggleRef = useRef<HTMLButtonElement | null>(null)
  const [flyoutPos, setFlyoutPos] = useState<{ left: number; bottom: number } | null>(null)
  const drawerSlotLabels: Record<DrawerSlot, string> = {
    top: t('drawer.axis.top', 'TOP'),
    right: t('drawer.axis.right', 'RIGHT'),
    bottom: t('drawer.axis.bottom', 'BOTTOM'),
    floating: t('drawer.axis.floating', 'FLOAT'),
    statusbar: t('drawer.axis.statusbar', 'STATUS')
  }

  const drawerSlotIcon = useCallback((slot: DrawerSlot) => {
    if (slot === 'top') return <BellIcon size={12} />
    if (slot === 'right') return <InfoIcon size={12} />
    if (slot === 'bottom') return <TerminalIcon size={12} />
    if (slot === 'floating') return <WindowIcon size={12} />
    return <GridIcon size={12} />
  }, [])

  const getDefaultContentId = useCallback((slot: DrawerSlot): string => {
    return DRAWER_CONTENT_REGISTRY.find(d => d.defaultSlot === slot)?.id ?? 'statusbar.aggregate'
  }, [])

  const openDrawerMenu = useCallback(() => {
    const btn = drawerToggleRef.current
    if (btn) {
      const rect = btn.getBoundingClientRect()
      setFlyoutPos({ left: rect.right + 8, bottom: window.innerHeight - rect.bottom })
    }
    setDrawerMenuOpen(true)
  }, [])

  useEffect(() => {
    if (!drawerMenuOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerMenuOpen(false)
    }
    const handlePointer = (event: PointerEvent) => {
      const node = drawerMenuRef.current
      if (!node) return
      if (event.target instanceof Node && node.contains(event.target)) return
      const toggleBtn = drawerToggleRef.current
      if (toggleBtn && event.target instanceof Node && toggleBtn.contains(event.target)) return
      setDrawerMenuOpen(false)
    }
    // The flyout is anchored at fixed coords captured on open; if the window or
    // rail is resized while it is open the coords go stale, so close it to avoid
    // a detached menu floating away from the toggle.
    const handleResize = () => setDrawerMenuOpen(false)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handlePointer)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handlePointer)
      window.removeEventListener('resize', handleResize)
    }
  }, [drawerMenuOpen])

  const handleSelectDrawerSlot = useCallback((slot: DrawerSlot) => {
    void drawerSetContent(slot, getDefaultContentId(slot))
    setDrawerMenuOpen(false)
  }, [drawerSetContent, getDefaultContentId])

  const handleCloseAllDrawers = useCallback(() => {
    for (const slot of DRAWER_SLOTS) {
      void drawerSetOpen(slot, false)
    }
    setDrawerMenuOpen(false)
  }, [drawerSetOpen])

  const actualWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth

  return (
    <aside
      ref={sidebarRef}
      className={`
        bg-surface-900 border-r-2 border-surface-700 flex flex-col h-full relative
        sidebar-transition animate-sidebar-enter
      `}
      style={{
        width: `${actualWidth}rem`,
        minWidth: `${actualWidth}rem`,
        userSelect: isDragging ? 'none' : undefined
      }}
    >
      {/* Collapse Toggle Button */}
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        onClick={handleToggleCollapse}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 bg-surface-800 border border-surface-600 flex items-center justify-center text-text-muted hover:text-accent hover:border-accent transition-all duration-200 radius-sm"
      >
        {collapsed ? <ChevronRightIcon size={14} /> : <ChevronLeftIcon size={14} />}
      </button>

      {/* Drag Handle on right edge */}
      {!collapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-accent/30 transition-colors"
          style={{
            background: isDragging ? 'var(--accent)' : undefined,
            opacity: isDragging ? 0.5 : undefined
          }}
          onPointerDown={handleDragStart}
        />
      )}

      {/* Header Decoration */}
      {!collapsed && (
        <div className="px-4 py-4 relative overflow-visible">
          <div
            className="text-accent-300 font-bold uppercase tracking-wider text-sm whitespace-nowrap overflow-visible"
            style={{
              fontFamily: 'var(--font-display)',
              transform: 'rotate(-8deg)',
              transformOrigin: 'left center'
            }}
          >
            工程控制台
          </div>
          <div className="mt-3 divider-diagonal" />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="px-2 mb-2">
          <button
            type="button"
            onClick={onTopologyClick}
            className="nav-item nav-item-animate border-l-2 border-accent/70 bg-accent/10 text-text-primary"
            style={{ animationDelay: '25ms' }}
            title="全局拓扑 (Ctrl+T)"
            aria-label="全局拓扑 (Ctrl+T)"
            aria-keyshortcuts="Control+T"
            data-activity-bar-icon="topology-global"
          >
            <TopologyIcon size={18} className="text-accent flex-shrink-0" />
            {!collapsed && <span className="font-medium truncate whitespace-nowrap min-w-0 flex-1 text-left">全局拓扑</span>}
          </button>
        </div>

        {/* All Projects */}
        <div className="px-2 mb-2">
          <button
            onClick={() => {
              setTagFilter(null)
              setGroupFilter(null)
            }}
            className={`nav-item nav-item-animate ${isAllActive ? 'nav-item-active' : ''}`}
            style={{ animationDelay: '50ms' }}
            title={collapsed ? '全部项目' : undefined}
          >
            <FolderIcon size={18} className={`flex-shrink-0 ${isAllActive ? 'text-accent' : ''}`} />
            {!collapsed && <span className="font-medium truncate whitespace-nowrap min-w-0 flex-1 text-left">全部项目</span>}
          </button>
        </div>

        {/* Tags Section */}
        {tags.length > 0 && (
          <div className="mt-4 px-2">
            {!collapsed && (
              <h3 className="section-header section-header-bar mb-3 nav-item-animate flex items-center gap-1.5" style={{ animationDelay: '100ms' }}>
                <TagIcon size={14} />
                <span>标签</span>
                <span
                  className="text-text-muted hover:text-accent cursor-help inline-flex"
                  title="标签 (Tags)：多对多属性筛选，一个项目可拥有多个标签。"
                  aria-label="标签说明"
                >
                  <InfoIcon size={11} />
                </span>
              </h3>
            )}
            <div className="space-y-0.5">
              {tags.map((tag, index) => {
                const isActive = filter.tag === tag
                const stats = getTagStats(tag)
                return (
                  <div
                    key={tag}
                    className={`nav-item nav-item-animate group ${isActive ? 'nav-item-active' : ''}`}
                    style={{ animationDelay: `${150 + index * 50}ms` }}
                  >
                    <button
                      onClick={() => setTagFilter(isActive ? null : tag)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                      title={collapsed ? tag : undefined}
                    >
                      <span className={`w-2 h-2 ${isActive ? 'bg-accent' : 'bg-surface-500'} radius-sm`} />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-left">{tag}</span>
                          <span className="text-xs text-text-muted">{stats.running}/{stats.total}</span>
                        </>
                      )}
                    </button>
                    {!collapsed && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartTag(e, tag)}
                          className="p-1 hover:text-green-400 transition-colors"
                          title="启动全部"
                        >
                          <PlayIcon size={12} />
                        </button>
                        <button
                          onClick={(e) => handleStopTag(e, tag)}
                          className="p-1 hover:text-red-400 transition-colors"
                          title="停止全部"
                        >
                          <StopIcon size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Groups Section */}
        <div className="mt-4 px-2">
          {!collapsed && (
            <div
              className="section-header section-header-bar mb-3 nav-item-animate flex items-center gap-1.5"
              style={{ animationDelay: `${150 + tags.length * 50}ms` }}
            >
              <GroupIcon size={14} />
              <span>分组</span>
              <span
                className="text-text-muted hover:text-accent cursor-help inline-flex"
                title="分组 (Groups)：互斥分类，一个项目只能属于一个分组。"
                aria-label="分组说明"
              >
                <InfoIcon size={11} />
              </span>
              <button
                type="button"
                onClick={handleOpenGroupCreator}
                className="ml-auto p-1 text-text-muted hover:text-accent transition-colors"
                title="创建分组"
                aria-label="创建分组"
                data-testid="sidebar-group-add-button"
              >
                <PlusIcon size={12} />
              </button>
            </div>
          )}

          {/* Inline creator */}
          {!collapsed && groupCreatorOpen && (
            <div className="mb-2 px-1">
              <input
                ref={newGroupInputRef}
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleConfirmCreateGroup()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    handleCancelCreateGroup()
                  }
                }}
                onBlur={handleConfirmCreateGroup}
                placeholder="分组名称"
                maxLength={64}
                className="input-sm w-full text-xs"
                data-testid="sidebar-group-add-input"
              />
            </div>
          )}

          {groups.length === 0 && !collapsed && !groupCreatorOpen && (
            <div className="text-xs text-text-muted px-2 py-1 whitespace-nowrap">
              暂无分组。点击 + 创建。
            </div>
          )}

          <div className="space-y-0.5">
            {groups.map((group, index) => {
              const isActive = filter.group === group
              const stats = getGroupStats(group)
              const isEditing = editingGroup === group
              const isDragOver = dragOverGroup === group
              return (
                <div
                  key={group}
                  className={`nav-item nav-item-animate group ${isActive ? 'nav-item-active' : ''} ${isDragOver ? 'bg-accent/15 border-l-2 border-accent' : ''}`}
                  style={{ animationDelay: `${200 + (tags.length + index) * 50}ms` }}
                  onContextMenu={(e) => handleGroupContextMenu(e, group)}
                  onDragOver={(e) => handleGroupDragOver(e, group)}
                  onDragLeave={(e) => handleGroupDragLeave(e, group)}
                  onDrop={(e) => handleGroupDrop(e, group)}
                  onKeyDown={(e) => handleGroupKeyDown(e, group)}
                  onDoubleClick={(e) => {
                    if (collapsed) return
                    e.stopPropagation()
                    handleStartRenameGroup(group)
                  }}
                  tabIndex={0}
                  data-testid="sidebar-group-item"
                  data-group={group}
                >
                  {isEditing && !collapsed ? (
                    <input
                      ref={editingInputRef}
                      type="text"
                      value={editingGroupDraft}
                      onChange={(e) => setEditingGroupDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCommitRename(group)
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          handleCancelRename()
                        }
                      }}
                      onBlur={() => handleCommitRename(group)}
                      maxLength={64}
                      className="input-sm flex-1 text-xs"
                      data-testid="sidebar-group-rename-input"
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => setGroupFilter(isActive ? null : group)}
                        className="flex items-center gap-2 flex-1 min-w-0"
                        title={collapsed ? group : `${group} (双击重命名 / F2 / 右键更多)`}
                      >
                        <span className={`w-2 h-2 ${isActive ? 'bg-accent' : 'bg-surface-500'}`} />
                        {!collapsed && (
                          <>
                            <span className="truncate flex-1 text-left">{group}</span>
                            <span className="text-xs text-text-muted">{stats.running}/{stats.total}</span>
                          </>
                        )}
                      </button>
                      {!collapsed && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleStartGroup(e, group)}
                            className="p-1 hover:text-green-400 transition-colors"
                            title="启动全部"
                          >
                            <PlayIcon size={12} />
                          </button>
                          <button
                            onClick={(e) => handleStopGroup(e, group)}
                            className="p-1 hover:text-red-400 transition-colors"
                            title="停止全部"
                          >
                            <StopIcon size={12} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="border-t-2 border-surface-700 p-2">
        {/* Diagonal decoration */}
        <div className="divider-diagonal mb-2" />

        {/* Drawer launcher button */}
        <div
          data-testid="drawer-launcher-rail"
        >
          <button
            ref={drawerToggleRef}
            type="button"
            title={t('drawer.launchers.toggle', 'Drawer launchers')}
            aria-label={t('drawer.launchers.toggle', 'Drawer launchers')}
            aria-expanded={drawerMenuOpen}
            aria-haspopup="menu"
            className="btn-icon flex-shrink-0 w-9 h-9 border border-surface-700 bg-surface-800 hover:border-surface-600 hover:bg-surface-700 hover:text-text-primary group"
            onClick={openDrawerMenu}
            onFocus={openDrawerMenu}
            onMouseEnter={openDrawerMenu}
            data-testid="drawer-launcher-toggle"
          >
            <MenuIcon size={18} />
          </button>
          {drawerMenuOpen && (
            <nav
              ref={drawerMenuRef}
              aria-label={t('drawer.launchers.aria', 'R8 drawer launchers')}
              role="menu"
              className="fixed flex w-44 flex-col gap-1 border border-surface-600 bg-surface-950/95 p-2 shadow-elevated radius-sm z-[2100]"
              style={flyoutPos ? { left: flyoutPos.left, bottom: flyoutPos.bottom } : undefined}
              data-testid="drawer-launcher-panel"
              data-open="true"
            >
              {DRAWER_SLOTS.map(slot => (
                <button
                  key={slot}
                  type="button"
                  role="menuitem"
                  data-testid={`open-drawer-${slot}`}
                  title={drawerSlotLabels[slot]}
                  aria-label={drawerSlotLabels[slot]}
                  className="flex items-center gap-2 border border-surface-600 bg-surface-900 px-2 py-1 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-text-secondary hover:border-accent hover:text-accent radius-sm"
                  onClick={() => handleSelectDrawerSlot(slot)}
                >
                  {drawerSlotIcon(slot)}
                  {drawerSlotLabels[slot]}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                data-testid="drawer-launcher-close-all"
                className="mt-1 border border-surface-600 bg-surface-900 px-2 py-1 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-text-secondary hover:border-accent hover:text-accent radius-sm"
                onClick={handleCloseAllDrawers}
              >
                {t('drawer.launchers.closeAll', 'Close all')}
              </button>
            </nav>
          )}
        </div>

        <button
          onClick={onSettingsClick}
          className="nav-item hover:text-text-primary group"
          title={collapsed ? '设置' : undefined}
          aria-label="设置"
          data-testid="sidebar-settings-button"
        >
          <GearIcon size={18} className="group-hover:animate-gear-spin flex-shrink-0" style={{ animationDuration: '2s' }} />
          {!collapsed && <span className="font-medium truncate whitespace-nowrap min-w-0 flex-1 text-left">设置</span>}
        </button>
      </div>

      {/* Group context menu */}
      <ContextMenu
        items={groupContextMenu ? [
          {
            label: '重命名分组',
            icon: <GroupIcon size={16} />,
            onClick: () => {
              const g = groupContextMenu.group
              setGroupContextMenu(null)
              handleStartRenameGroup(g)
            }
          },
          { label: '', onClick: () => {}, divider: true },
          {
            label: '删除分组',
            icon: <TrashIcon size={16} />,
            danger: true,
            onClick: () => handleRequestDeleteGroup(groupContextMenu.group)
          }
        ] : []}
        position={groupContextMenu ? { x: groupContextMenu.x, y: groupContextMenu.y } : null}
        onClose={() => setGroupContextMenu(null)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={groupDeleteConfirm !== null}
        title="删除分组"
        message={(() => {
          if (!groupDeleteConfirm) return ''
          const count = projects.filter(p => p.group === groupDeleteConfirm).length
          return count > 0
            ? `删除分组 "${groupDeleteConfirm}" 将解除其中 ${count} 个项目的归属（不会删除项目本身）。确认？`
            : `确定删除分组 "${groupDeleteConfirm}" 吗？`
        })()}
        confirmText="删除"
        variant="danger"
        onConfirm={handleConfirmDeleteGroup}
        onCancel={() => setGroupDeleteConfirm(null)}
      />
    </aside>
  )
}
