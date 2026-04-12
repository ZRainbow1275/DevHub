import { useState, useEffect } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { useProjects } from '../../hooks/useProjects'
import { useWindowSize } from '../../hooks/useWindowSize'
import { FolderIcon, TagIcon, GroupIcon, GearIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon, StopIcon } from '../icons'

const SIDEBAR_STORAGE_KEY = 'devhub:sidebar-collapsed'

interface SidebarProps {
  onSettingsClick: () => void
}

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function Sidebar({ onSettingsClick }: SidebarProps) {
  const [tags, setTags] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })
  const { filter, setTagFilter, setGroupFilter } = useProjectStore()
  const { startGroup, stopGroup, startByTag, stopByTag, getGroupStats, getTagStats } = useProjects()
  const { width } = useWindowSize()

  // Auto-collapse on narrow windows
  useEffect(() => {
    if (width < 1024 && !collapsed) {
      setCollapsed(true)
      localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true')
    }
  }, [width]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isElectron) return

    const refresh = () => {
      window.devhub.tags.list().then(setTags)
      window.devhub.groups.list().then(setGroups)
    }

    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

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

  return (
    <aside
      className={`
        bg-surface-900 border-r-2 border-surface-700 flex flex-col h-full relative
        sidebar-transition animate-sidebar-enter
        ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}
      `}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 bg-surface-800 border border-surface-600 flex items-center justify-center text-text-muted hover:text-accent hover:border-accent transition-all duration-200"
        style={{ borderRadius: '2px' }}
      >
        {collapsed ? <ChevronRightIcon size={14} /> : <ChevronLeftIcon size={14} />}
      </button>

      {/* Header Decoration */}
      {!collapsed && (
        <div className="px-4 py-4 relative">
          <div
            className="text-accent-300 font-bold uppercase tracking-wider"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
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
            <FolderIcon size={18} className={isAllActive ? 'text-accent' : ''} />
            {!collapsed && <span className="font-medium">全部项目</span>}
          </button>
        </div>

        {/* Tags Section */}
        {tags.length > 0 && (
          <div className="mt-4 px-2">
            {!collapsed && (
              <h3 className="section-header section-header-bar mb-3 nav-item-animate" style={{ animationDelay: '100ms' }}>
                <TagIcon size={14} />
                标签
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
                      <span className={`w-2 h-2 ${isActive ? 'bg-accent' : 'bg-surface-500'}`} style={{ borderRadius: '1px' }} />
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
        {groups.length > 0 && (
          <div className="mt-4 px-2">
            {!collapsed && (
              <h3 className="section-header section-header-bar mb-3 nav-item-animate" style={{ animationDelay: `${150 + tags.length * 50}ms` }}>
                <GroupIcon size={14} />
                分组
              </h3>
            )}
            <div className="space-y-0.5">
              {groups.map((group, index) => {
                const isActive = filter.group === group
                const stats = getGroupStats(group)
                return (
                  <div
                    key={group}
                    className={`nav-item nav-item-animate group ${isActive ? 'nav-item-active' : ''}`}
                    style={{ animationDelay: `${200 + (tags.length + index) * 50}ms` }}
                  >
                    <button
                      onClick={() => setGroupFilter(isActive ? null : group)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                      title={collapsed ? group : undefined}
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
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="border-t-2 border-surface-700 p-2">
        {/* Diagonal decoration */}
        <div className="divider-diagonal mb-2" />

        <button
          onClick={onSettingsClick}
          className="nav-item hover:text-text-primary group"
          title={collapsed ? '设置' : undefined}
        >
          <GearIcon size={18} className="group-hover:animate-gear-spin" style={{ animationDuration: '2s' }} />
          {!collapsed && <span className="font-medium">设置</span>}
        </button>
      </div>
    </aside>
  )
}
