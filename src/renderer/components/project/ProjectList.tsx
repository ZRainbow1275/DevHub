import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ProjectCard } from './ProjectCard'
import { TagManagerDialog } from './TagManagerDialog'
import { useProjects } from '../../hooks/useProjects'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useProjectStore } from '../../stores/projectStore'
import { useToast } from '../ui/Toast'
import { Project } from '@shared/types'
import { SearchIcon, PlusIcon, FolderIcon } from '../icons'

interface ProjectListProps {
  onAddProject: () => void
}

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

// 每个项目卡片的预估高度（包含间距）
const ESTIMATED_ITEM_HEIGHT = 120

export function ProjectList({ onAddProject }: ProjectListProps) {
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

  // 虚拟化滚动容器引用
  const parentRef = useRef<HTMLDivElement>(null)

  // 配置虚拟化
  const virtualizer = useVirtualizer({
    count: filteredProjects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 5  // 预渲染5个额外项目以减少滚动闪烁
  })

  const debouncedSearch = useDebouncedCallback((value: string) => {
    useProjectStore.getState().setSearchFilter(value)
  }, 300)

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
            <span className="text-xs text-text-primary font-bold bg-accent/20 px-2 py-0.5 border-l-2 border-accent" style={{ borderRadius: '2px' }}>
              {filteredProjects.length}
            </span>
          </div>
          <button
            onClick={onAddProject}
            className="btn-icon text-accent hover:bg-accent/10 relative z-10"
            title="添加项目"
          >
            <PlusIcon size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-surface-700">
          <div className="relative">
            <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="搜索项目..."
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
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted">
              <div className="w-16 h-16 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-accent" style={{ borderRadius: '4px' }}>
                <FolderIcon size={32} className="text-text-muted" />
              </div>
              <p className="text-sm font-medium">暂无项目</p>
              <button
                onClick={onAddProject}
                className="mt-4 text-sm text-accent hover:text-accent-400 font-bold uppercase tracking-wider transition-colors"
              >
                添加第一个项目
              </button>
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
                const project = filteredProjects[virtualItem.index]
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
