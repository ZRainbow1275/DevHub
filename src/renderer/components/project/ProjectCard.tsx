import { memo, useState, useEffect } from 'react'
import { Project, ProjectOpenTarget } from '@shared/types'
import type { ThemeDecorationConfig } from '@shared/types'
import type { GitInfo } from '@shared/types-extended'
import { ScriptSelector } from '../ui/ScriptSelector'
import { ContextMenu } from '../ui/ContextMenu'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ThemeDecoration } from '../ui/ThemeDecoration'
import { ProjectTypeBadge } from './ProjectTypeBadge'
import { PlayIcon, StopIcon, FolderIcon, CopyIcon, TagIcon, TrashIcon, GitBranchIcon, EyeIcon, CodeIcon, ExternalLinkIcon, TerminalIcon, ChevronDownIcon, GroupIcon } from '../icons'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined
const PROJECT_DRAG_MIME = 'application/x-devhub-project'

interface ProjectCardProps {
  project: Project
  isSelected: boolean
  onSelect: () => void
  onStart: (script: string) => void
  onStop: () => void
  onRemove: () => void
  onOpenFolder: () => void
  onOpenIn: (target: ProjectOpenTarget) => void
  onCopyPath: () => void
  onManageTags: () => void
  onShowDetail?: () => void
  onAssignGroup?: (group: string | undefined) => void
  availableGroups?: string[]
  decorationConfig?: ThemeDecorationConfig
}

export const ProjectCard = memo(function ProjectCard({
  project,
  isSelected,
  onSelect,
  onStart,
  onStop,
  onRemove,
  onOpenFolder,
  onOpenIn,
  onCopyPath,
  onManageTags,
  onShowDetail,
  onAssignGroup,
  availableGroups,
  decorationConfig
}: ProjectCardProps) {
  const isRunning = project.status === 'running'
  const isError = project.status === 'error'
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [openMenuPos, setOpenMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [assignGroupPos, setAssignGroupPos] = useState<{ x: number; y: number } | null>(null)
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
    const interval = setInterval(fetchGitInfo, 120000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [project.path])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setOpenMenuPos(null)
    setAssignGroupPos(null)
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(PROJECT_DRAG_MIME, project.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()

    setContextMenuPos(null)
    setOpenMenuPos((current) =>
      current
        ? null
        : {
            x: Math.max(8, rect.right - 180),
            y: rect.bottom + 6
          }
    )
  }

  const handleOpenFolderClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenFolder()
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

  const projectOpenMenuItems = [
    {
      label: '在 VS Code 打开',
      icon: <CodeIcon size={16} />,
      onClick: () => onOpenIn('vscode' satisfies ProjectOpenTarget)
    },
    {
      label: '在 Cursor 打开',
      icon: <CodeIcon size={16} />,
      onClick: () => onOpenIn('cursor' satisfies ProjectOpenTarget)
    },
    {
      label: '在资源管理器打开',
      icon: <FolderIcon size={16} />,
      onClick: onOpenFolder
    },
    {
      label: '在终端打开',
      icon: <TerminalIcon size={16} />,
      onClick: () => onOpenIn('terminal' satisfies ProjectOpenTarget)
    },
    {
      label: '复制路径',
      icon: <CopyIcon size={16} />,
      onClick: onCopyPath
    }
  ]

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
    { label: '', onClick: () => {}, divider: true },
    ...projectOpenMenuItems,
    {
      label: '管理标签',
      icon: <TagIcon size={16} />,
      onClick: onManageTags
    },
    ...(onAssignGroup ? [{
      label: project.group ? `分配到分组... (当前: ${project.group})` : '分配到分组...',
      icon: <GroupIcon size={16} />,
      onClick: () => {
        // Reopen at the same anchor as the parent context menu
        const anchor = contextMenuPos
        if (anchor) {
          setAssignGroupPos({ x: anchor.x, y: anchor.y })
        }
      }
    }] : []),
    { label: '', onClick: () => {}, divider: true },
    {
      label: '删除项目',
      icon: <TrashIcon size={16} />,
      onClick: () => setShowDeleteConfirm(true),
      danger: true,
      disabled: isRunning
    }
  ]

  const assignGroupMenuItems = onAssignGroup
    ? [
        {
          label: '无 (移出分组)',
          icon: <GroupIcon size={16} />,
          onClick: () => onAssignGroup(undefined),
          disabled: !project.group
        },
        ...((availableGroups ?? []).length > 0
          ? [{ label: '', onClick: () => {}, divider: true }]
          : []),
        ...(availableGroups ?? []).map((groupName) => ({
          label: groupName === project.group ? `${groupName} (当前)` : groupName,
          icon: <GroupIcon size={16} />,
          onClick: () => onAssignGroup(groupName),
          disabled: groupName === project.group
        }))
      ]
    : []

  // Determine quick action scripts from project scripts
  const quickScripts = project.scripts.filter(s =>
    ['dev', 'build', 'test', 'start', 'serve', 'lint'].includes(s)
  ).slice(0, 3)

  return (
    <>
      <div
        role="button"
        aria-label={`${project.name} 项目卡片${isRunning ? '，运行中' : isError ? '，异常' : '，已停止'}`}
        tabIndex={0}
        draggable
        onDragStart={handleDragStart}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
        onContextMenu={handleContextMenu}
        className={`
          monitor-card project-card cursor-pointer
          ${isSelected ? 'monitor-card-selected' : ''}
          ${isRunning ? 'card-running' : ''}
          ${isError ? 'card-error' : ''}
        `}
        style={{ minWidth: 'var(--project-card-min-width, 240px)' }}
        data-testid="project-card"
        data-project-status={project.status}
      >
        <ThemeDecoration config={decorationConfig} position="card-background" />
        <div className="project-card-layout relative z-10 flex items-start justify-between gap-4">
          {/* Left: Project Info */}
          <div className="project-card-main flex-1 min-w-0">
            <div className="project-card-title-row flex items-center gap-3">
              {/* Status indicator */}
              <span
                className={`project-card-status-dot w-2.5 h-2.5 flex-shrink-0 ${
                  isRunning
                    ? 'bg-success status-dot-running'
                    : isError
                    ? 'bg-error'
                    : 'bg-surface-500'
                } radius-sm`}
              />
              <h3
                className="project-card-title text-sm font-semibold text-text-primary truncate"
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
            <p className="project-card-path text-xs text-text-muted mt-1.5 truncate font-mono" title={project.path}>
              {project.path}
            </p>

            {/* Git branch + Port info row */}
            {(gitInfo || project.port) && (
              <div className="project-card-meta-row flex items-center gap-3 mt-1.5 flex-wrap">
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
              <div className="project-card-tags flex flex-wrap gap-1.5 mt-2" title={project.tags.join(', ')}>
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
              <div className="project-card-quick-actions flex items-center gap-1.5 mt-2">
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
          <div className="project-card-actions flex items-center gap-2 action-group flex-shrink-0">
            <div className="project-card-open-split inline-flex items-stretch radius-sm overflow-hidden">
              <button
                onClick={handleOpenFolderClick}
                className="px-3 py-1.5 text-xs font-medium bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-text-primary transition-colors border-l-2 border-accent/60"
                title="在资源管理器打开"
                data-testid="project-open-button"
              >
                <span className="project-card-open-label inline-flex items-center gap-1.5">
                  <ExternalLinkIcon size={14} />
                  打开
                </span>
              </button>
              <button
                onClick={handleOpenMenu}
                className="px-1.5 py-1.5 text-xs font-medium bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-text-primary transition-colors border-l border-surface-700"
                title="更多打开方式"
                aria-label="更多打开方式"
                data-testid="project-open-chevron"
              >
                <ChevronDownIcon size={12} />
              </button>
            </div>

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

      <ContextMenu
        items={projectOpenMenuItems}
        position={openMenuPos}
        onClose={() => setOpenMenuPos(null)}
      />

      <ContextMenu
        items={assignGroupMenuItems}
        position={assignGroupPos}
        onClose={() => setAssignGroupPos(null)}
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
