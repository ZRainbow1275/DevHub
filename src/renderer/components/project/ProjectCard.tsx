import { memo, useState } from 'react'
import { Project } from '@shared/types'
import { ScriptSelector } from '../ui/ScriptSelector'
import { ContextMenu } from '../ui/ContextMenu'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ProjectTypeBadge } from './ProjectTypeBadge'
import { PlayIcon, StopIcon, FolderIcon, CopyIcon, TagIcon, TrashIcon } from '../icons'

interface ProjectCardProps {
  project: Project
  isSelected: boolean
  onSelect: () => void
  onStart: (script: string) => void
  onStop: () => void
  onRemove: () => void
  onOpenFolder: () => void
  onCopyPath: () => void
  onManageTags: () => void
}

export const ProjectCard = memo(function ProjectCard({
  project,
  isSelected,
  onSelect,
  onStart,
  onStop,
  onRemove,
  onOpenFolder,
  onCopyPath,
  onManageTags
}: ProjectCardProps) {
  const isRunning = project.status === 'running'
  const isError = project.status === 'error'
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRunning) {
      onStop()
    } else {
      onStart(project.defaultScript)
    }
  }

  const contextMenuItems = [
    {
      label: isRunning ? '停止' : '启动',
      icon: isRunning ? <StopIcon size={16} /> : <PlayIcon size={16} />,
      onClick: () => isRunning ? onStop() : onStart(project.defaultScript)
    },
    {
      label: '打开文件夹',
      icon: <FolderIcon size={16} />,
      onClick: onOpenFolder
    },
    {
      label: '复制路径',
      icon: <CopyIcon size={16} />,
      onClick: onCopyPath
    },
    {
      label: '管理标签',
      icon: <TagIcon size={16} />,
      onClick: onManageTags
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: '删除项目',
      icon: <TrashIcon size={16} />,
      onClick: () => setShowDeleteConfirm(true),
      danger: true,
      disabled: isRunning
    }
  ]

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
        onContextMenu={handleContextMenu}
        className={`
          monitor-card cursor-pointer
          ${isSelected ? 'monitor-card-selected' : ''}
          ${isRunning ? 'card-running' : ''}
          ${isError ? 'card-error' : ''}
        `}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Project Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {/* Status indicator */}
              <span
                className={`w-2.5 h-2.5 flex-shrink-0 ${
                  isRunning
                    ? 'bg-success status-dot-running'
                    : isError
                    ? 'bg-error'
                    : 'bg-surface-500'
                }`}
                style={{ borderRadius: '2px' }}
              />
              <h3 className="text-sm font-semibold text-text-primary truncate">
                {project.name}
              </h3>
              <ProjectTypeBadge type={project.projectType} />
              {isRunning && (
                <span className="status-badge status-badge-running">
                  运行中
                </span>
              )}
            </div>

            <p className="text-xs text-text-muted mt-1.5 truncate font-mono" title={project.path}>
              {project.path}
            </p>

            {/* Tags */}
            {project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="tag tag-default"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 action-group">
            {/* Port indicator */}
            {project.port && (
              <span className="text-xs text-gold font-mono bg-gold/10 px-2 py-1 border-l-2 border-gold" style={{ borderRadius: '2px' }}>
                :{project.port}
              </span>
            )}

            {/* Play/Stop button */}
            {isRunning ? (
              <button
                onClick={handleToggle}
                className="btn-icon text-error hover:bg-error/10"
                title="停止"
              >
                <StopIcon size={18} />
              </button>
            ) : (
              <ScriptSelector
                scripts={project.scripts}
                defaultScript={project.defaultScript}
                onSelect={onStart}
              />
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        items={contextMenuItems}
        position={contextMenuPos}
        onClose={() => setContextMenuPos(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除项目"
        message={`确定要从列表中移除 "${project.name}" 吗？这不会删除项目文件。`}
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
