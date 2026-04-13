import { memo, useState, useEffect } from 'react'
import { Project } from '@shared/types'
import type { GitInfo } from '@shared/types-extended'
import { ScriptSelector } from '../ui/ScriptSelector'
import { ContextMenu } from '../ui/ContextMenu'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ProjectTypeBadge } from './ProjectTypeBadge'
import { PlayIcon, StopIcon, FolderIcon, CopyIcon, TagIcon, TrashIcon, GitBranchIcon, EyeIcon } from '../icons'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

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
  onShowDetail?: () => void
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
  onManageTags,
  onShowDetail
}: ProjectCardProps) {
  const isRunning = project.status === 'running'
  const isError = project.status === 'error'
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)

  // Fetch git info on mount and periodically
  useEffect(() => {
    if (!isElectron) return

    let active = true
    const fetchGitInfo = () => {
      window.devhub.projects.getGitInfo(project.path)
        .then(info => { if (active) setGitInfo(info) })
        .catch(() => { /* ignore */ })
    }

    fetchGitInfo()
    const interval = setInterval(fetchGitInfo, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [project.path])

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

  // Quick action: run a specific common script
  const handleQuickScript = (e: React.MouseEvent, script: string) => {
    e.stopPropagation()
    onStart(script)
  }

  const contextMenuItems = [
    {
      label: isRunning ? '停止' : '启动',
      icon: isRunning ? <StopIcon size={16} /> : <PlayIcon size={16} />,
      onClick: () => isRunning ? onStop() : onStart(project.defaultScript)
    },
    ...(onShowDetail ? [{
      label: '项目详情',
      icon: <EyeIcon size={16} />,
      onClick: onShowDetail
    }] : []),
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

  // Determine quick action scripts from project scripts
  const quickScripts = project.scripts.filter(s =>
    ['dev', 'build', 'test', 'start', 'serve', 'lint'].includes(s)
  ).slice(0, 3)

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
        style={{ minWidth: '240px' }}
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
                } radius-sm`}
              />
              <h3
                className="text-sm font-semibold text-text-primary truncate"
                style={{ minWidth: '9rem', maxWidth: '100%' }}
                title={project.name}
              >
                {project.name}
              </h3>
              <ProjectTypeBadge type={project.projectType} />
              {isRunning && (
                <span className="status-badge status-badge-running">
                  运行中
                </span>
              )}
            </div>

            {/* Path with tooltip */}
            <p className="text-xs text-text-muted mt-1.5 truncate font-mono" title={project.path}>
              {project.path}
            </p>

            {/* Git branch + Port info row */}
            {(gitInfo || project.port) && (
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {gitInfo && (
                  <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                    <GitBranchIcon size={12} className="text-accent flex-shrink-0" />
                    <span className="truncate max-w-[120px]" title={gitInfo.branch}>{gitInfo.branch}</span>
                    {gitInfo.uncommittedCount > 0 && (
                      <span className="text-warning">+{gitInfo.uncommittedCount}</span>
                    )}
                  </span>
                )}
                {project.port && (
                  <span className="text-[11px] text-gold font-mono bg-gold/10 px-1.5 py-0.5 border-l-2 border-gold radius-sm">
                    :{project.port}
                  </span>
                )}
              </div>
            )}

            {/* Tags */}
            {project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
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

            {/* Quick action buttons for common scripts */}
            {!isRunning && quickScripts.length > 1 && (
              <div className="flex items-center gap-1.5 mt-2">
                {quickScripts.map(script => (
                  <button
                    key={script}
                    onClick={(e) => handleQuickScript(e, script)}
                    className="text-[10px] px-2 py-0.5 font-mono bg-surface-700 text-text-secondary hover:bg-surface-600 hover:text-text-primary transition-colors border-l-2 border-surface-500 radius-sm"
                    title={`运行 ${script}`}
                  >
                    {script}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 action-group flex-shrink-0">
            {/* Detail button */}
            {onShowDetail && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowDetail()
                }}
                className="btn-icon text-text-muted hover:text-accent"
                title="项目详情"
              >
                <EyeIcon size={16} />
              </button>
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
