import { useState, useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ProjectCard } from './ProjectCard'
import { TagManagerDialog } from './TagManagerDialog'
import { useProjects } from '../../hooks/useProjects'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useProjectStore } from '../../stores/projectStore'
import { useToast } from '../ui/Toast'
import { Project } from '@shared/types'
import type { ProjectSortField, ProjectSortDirection } from '@shared/types-extended'
import { SearchIcon, PlusIcon, FolderIcon, RefreshIcon, SortIcon, ChevronUpIcon, ChevronDownIcon } from '../icons'

interface ProjectListProps {
  onAddProject: () => void
  onShowProjectDetail?: (project: Project) => void
}

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

// Sort options with labels
const SORT_OPTIONS: Array<{ field: ProjectSortField; label: string }> = [
  { field: 'name', label: '名称' },
  { field: 'status', label: '状态' },
  { field: 'type', label: '类型' },
  { field: 'recentRun', label: '最近运行' },
  { field: 'createdAt', label: '创建时间' },
]

// Status priority for sorting (running first, then error, then stopped)
const STATUS_PRIORITY: Record<string, number> = {
  running: 0,
  error: 1,
  stopped: 2
}

// Each project card estimated height (with padding)
const ESTIMATED_ITEM_HEIGHT = 120

const SORT_STORAGE_KEY = 'devhub:project-sort'

export function ProjectList({ onAddProject, onShowProjectDetail }: ProjectListProps) {
  const {
    filteredProjects,
    selectedProjectId,
    selectProject,
    startProject,
    stopProject,
    removeProject,
    updateProject
  } = useProjects()
  const { showToast } = useToast()
  const [tagManagerProject, setTagManagerProject] = useState<Project | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Sort state with persistence
  const [sortConfig, setSortConfig] = useState<{ field: ProjectSortField; direction: ProjectSortDirection }>(() => {
    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.field && parsed.direction) return parsed
      }
    } catch { /* fallback */ }
    return { field: 'name', direction: 'asc' }
  })

  // Virtual scroll container ref
  const parentRef = useRef<HTMLDivElement>(null)

  // Project statistics derived from filteredProjects
  const projectStats = useMemo(() => {
    const total = filteredProjects.length
    const running = filteredProjects.filter(p => p.status === 'running').length
    const error = filteredProjects.filter(p => p.status === 'error').length
    const withPorts = filteredProjects.filter(p => p.port).length
    return { total, running, error, withPorts }
  }, [filteredProjects])

  // Apply sorting to filtered projects
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects]
    const { field, direction } = sortConfig
    const dir = direction === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      switch (field) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'status':
          return dir * ((STATUS_PRIORITY[a.status] ?? 2) - (STATUS_PRIORITY[b.status] ?? 2))
        case 'type':
          return dir * a.projectType.localeCompare(b.projectType)
        case 'recentRun':
          return dir * ((b.updatedAt || 0) - (a.updatedAt || 0))
        case 'createdAt':
          return dir * ((b.createdAt || 0) - (a.createdAt || 0))
        default:
          return 0
      }
    })

    return sorted
  }, [filteredProjects, sortConfig])

  // Configure virtualizer
  const virtualizer = useVirtualizer({
    count: sortedProjects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 5
  })

  const debouncedSearch = useDebouncedCallback((value: string) => {
    useProjectStore.getState().setSearchFilter(value)
  }, 300)

  const handleSort = useCallback((field: ProjectSortField) => {
    setSortConfig(prev => {
      const newConfig = {
        field,
        direction: (prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc') as ProjectSortDirection
      }
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(newConfig))
      return newConfig
    })
    setShowSortMenu(false)
  }, [])

  const handleOpenFolder = async (path: string) => {
    if (isElectron) {
      try {
        await window.devhub.shell.openPath(path)
      } catch (error) {
        showToast('error', error instanceof Error ? error.message : '打开文件夹失败')
      }
    }
  }

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      showToast('success', '路径已复制到剪贴板')
    } catch {
      showToast('error', '复制失败')
    }
  }

  const handleRemove = async (id: string, name: string) => {
    try {
      await removeProject(id)
      showToast('success', `已移除项目 "${name}"`)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '删除失败')
    }
  }

  const [isDiscovering, setIsDiscovering] = useState(false)

  const handleDiscover = useCallback(async () => {
    if (!isElectron) return
    setIsDiscovering(true)
    try {
      const results = await window.devhub.projects.discover()
      if (results.length === 0) {
        showToast('info', '未发现新项目')
        return
      }
      let imported = 0
      for (const project of results) {
        try {
          await window.devhub.projects.add(project.path)
          imported++
        } catch {
          // Skip existing or invalid projects
        }
      }
      if (imported > 0) {
        const list = await window.devhub.projects.list()
        useProjectStore.getState().setProjects(list)
        showToast('success', `已导入 ${imported} 个项目（发现 ${results.length} 个）`)
      } else {
        showToast('info', `发现 ${results.length} 个项目，但均已存在`)
      }
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '扫描失败')
    } finally {
      setIsDiscovering(false)
    }
  }, [showToast])

  const handleStart = async (id: string, script: string) => {
    try {
      await startProject(id, script)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '启动失败')
    }
  }

  const handleStop = async (id: string) => {
    try {
      await stopProject(id)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '停止失败')
    }
  }

  const handleSaveTags = async (projectId: string, tags: string[]) => {
    try {
      await updateProject(projectId, { tags })
      showToast('success', '标签已更新')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '更新标签失败')
    }
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-surface-700 relative">
          {/* Diagonal decoration */}
          <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10">
            <h2
              className="text-accent font-bold uppercase tracking-wider"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                transform: 'rotate(-4deg)',
                transformOrigin: 'left center'
              }}
            >
              项目列表
            </h2>
            <span className="text-xs text-text-primary font-bold bg-accent/20 px-2 py-0.5 border-l-2 border-accent radius-sm">
              {sortedProjects.length}
            </span>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            {/* Sort button */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="btn-icon text-text-muted hover:text-accent"
                title="排序"
              >
                <SortIcon size={18} />
              </button>
              {showSortMenu && (
                <div
                  className="absolute right-0 top-full mt-1 bg-surface-900 border-2 border-surface-600 shadow-elevated py-1.5 min-w-36 z-50 animate-fade-in radius-md"
                >
                  {SORT_OPTIONS.map(option => (
                    <button
                      key={option.field}
                      onClick={() => handleSort(option.field)}
                      className={`w-full px-4 py-2 text-left text-sm transition-all duration-150 flex items-center justify-between ${
                        sortConfig.field === option.field
                          ? 'text-accent bg-surface-800'
                          : 'text-text-secondary hover:bg-surface-700 hover:text-text-primary'
                      }`}
                    >
                      <span>{option.label}</span>
                      {sortConfig.field === option.field && (
                        sortConfig.direction === 'asc'
                          ? <ChevronUpIcon size={14} />
                          : <ChevronDownIcon size={14} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onAddProject}
              className="btn-icon text-accent hover:bg-accent/10"
              title="添加项目"
            >
              <PlusIcon size={20} />
            </button>
          </div>
        </div>

        {/* Stats Dashboard Row */}
        {filteredProjects.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-surface-700 bg-surface-950/40">
            <span className="text-[11px] text-text-muted">
              共 <span className="text-text-primary font-bold">{projectStats.total}</span> 个
            </span>
            {projectStats.running > 0 && (
              <span className="text-[11px] text-success">
                <span className="font-bold">{projectStats.running}</span> 运行中
              </span>
            )}
            {projectStats.error > 0 && (
              <span className="text-[11px] text-error">
                <span className="font-bold">{projectStats.error}</span> 错误
              </span>
            )}
            {projectStats.withPorts > 0 && (
              <span className="text-[11px] text-text-muted">
                <span className="text-gold font-bold">{projectStats.withPorts}</span> 有端口
              </span>
            )}
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-3 border-b border-surface-700">
          <div className="relative">
            <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="搜索项目名称、路径、标签..."
              className="input-sm w-full pl-10"
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Project List - Virtualized */}
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto px-4 pb-4 pt-2"
        >
          {sortedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <div className="w-16 h-16 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-accent radius-md">
                <FolderIcon size={32} className="text-text-muted" />
              </div>
              <p className="text-sm font-medium">暂无项目</p>
              <div className="flex flex-col items-center gap-2 mt-4">
                <button
                  onClick={handleDiscover}
                  disabled={isDiscovering}
                  className="flex items-center gap-2 text-sm text-accent hover:text-accent-400 font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  <RefreshIcon size={14} className={isDiscovering ? 'animate-spin' : ''} />
                  {isDiscovering ? '扫描中...' : '自动扫描项目'}
                </button>
                <button
                  onClick={onAddProject}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  或手动添加项目
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const project = sortedProjects[virtualItem.index]
                return (
                  <div
                    key={project.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`
                    }}
                  >
                    <div className="pb-2">
                      <ProjectCard
                        project={project}
                        isSelected={project.id === selectedProjectId}
                        onSelect={() => selectProject(project.id)}
                        onStart={(script) => handleStart(project.id, script)}
                        onStop={() => handleStop(project.id)}
                        onRemove={() => handleRemove(project.id, project.name)}
                        onOpenFolder={() => handleOpenFolder(project.path)}
                        onCopyPath={() => handleCopyPath(project.path)}
                        onManageTags={() => setTagManagerProject(project)}
                        onShowDetail={onShowProjectDetail ? () => onShowProjectDetail(project) : undefined}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tag Manager Dialog */}
      {tagManagerProject && (
        <TagManagerDialog
          isOpen={true}
          onClose={() => setTagManagerProject(null)}
          projectName={tagManagerProject.name}
          currentTags={tagManagerProject.tags}
          onSave={(tags) => handleSaveTags(tagManagerProject.id, tags)}
        />
      )}
    </>
  )
}
