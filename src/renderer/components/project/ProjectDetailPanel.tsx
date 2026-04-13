import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Project, PROJECT_TYPE_LABELS } from '@shared/types'
import type { GitInfo, ProjectDependencies, DependencyEntry } from '@shared/types-extended'
import { useProjectStore } from '../../stores/projectStore'
import { useToast } from '../ui/Toast'
import {
  CloseIcon,
  PlayIcon,
  StopIcon,
  GitBranchIcon,
  PackageIcon,
  PortIcon,
  LogIcon,
  GearIcon,
  FolderIcon,
  SearchIcon,
  ClockIcon,
  TagIcon,
  CodeIcon
} from '../icons'
import { ProjectTypeBadge } from './ProjectTypeBadge'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

type TabId = 'overview' | 'scripts' | 'dependencies' | 'ports' | 'logs' | 'git' | 'config'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'overview', label: '概览', icon: <FolderIcon size={14} /> },
  { id: 'scripts', label: '脚本', icon: <CodeIcon size={14} /> },
  { id: 'dependencies', label: '依赖', icon: <PackageIcon size={14} /> },
  { id: 'ports', label: '端口', icon: <PortIcon size={14} /> },
  { id: 'logs', label: '日志', icon: <LogIcon size={14} /> },
  { id: 'git', label: 'Git', icon: <GitBranchIcon size={14} /> },
  { id: 'config', label: '配置', icon: <GearIcon size={14} /> },
]

interface ProjectDetailPanelProps {
  project: Project
  onClose: () => void
  onStart: (script: string) => void
  onStop: () => void
}

export const ProjectDetailPanel = memo(function ProjectDetailPanel({
  project,
  onClose,
  onStart,
  onStop
}: ProjectDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [deps, setDeps] = useState<ProjectDependencies | null>(null)
  const [loadingGit, setLoadingGit] = useState(false)
  const [loadingDeps, setLoadingDeps] = useState(false)

  // Fetch git info
  const fetchGitInfo = useCallback(() => {
    if (!isElectron) return
    setLoadingGit(true)
    window.devhub.projects.getGitInfo(project.path)
      .then(setGitInfo)
      .catch(() => setGitInfo(null))
      .finally(() => setLoadingGit(false))
  }, [project.path])

  // Fetch dependencies
  const fetchDeps = useCallback(() => {
    if (!isElectron) return
    setLoadingDeps(true)
    window.devhub.projects.getDependencies(project.path)
      .then(setDeps)
      .catch(() => setDeps(null))
      .finally(() => setLoadingDeps(false))
  }, [project.path])

  useEffect(() => {
    fetchGitInfo()
    fetchDeps()
  }, [fetchGitInfo, fetchDeps])

  // Refresh git info periodically
  useEffect(() => {
    const interval = setInterval(fetchGitInfo, 15000)
    return () => clearInterval(interval)
  }, [fetchGitInfo])

  const isRunning = project.status === 'running'

  return (
    <div className="flex flex-col h-full bg-surface-900 border-l-2 border-surface-700 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-surface-700 relative">
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />
        <div className="flex items-center gap-3 min-w-0 relative z-10">
          <span
            className={`w-3 h-3 flex-shrink-0 ${
              isRunning ? 'bg-success status-dot-running' : project.status === 'error' ? 'bg-error' : 'bg-surface-500'
            }`}
            style={{ borderRadius: '2px' }}
          />
          <h2 className="text-sm font-bold text-text-primary truncate" title={project.name}>
            {project.name}
          </h2>
          <ProjectTypeBadge type={project.projectType} size="sm" />
        </div>
        <button
          onClick={onClose}
          className="btn-icon text-text-muted hover:text-text-primary relative z-10"
          title="关闭"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-surface-700 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-accent border-accent bg-surface-800/50'
                : 'text-text-muted border-transparent hover:text-text-secondary hover:bg-surface-800/30'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <OverviewTab project={project} gitInfo={gitInfo} deps={deps} onStart={onStart} onStop={onStop} />
        )}
        {activeTab === 'scripts' && (
          <ScriptsTab project={project} onStart={onStart} onStop={onStop} />
        )}
        {activeTab === 'dependencies' && (
          <DependenciesTab deps={deps} loading={loadingDeps} onRefresh={fetchDeps} />
        )}
        {activeTab === 'ports' && (
          <PortsTab project={project} />
        )}
        {activeTab === 'logs' && (
          <LogsTab project={project} />
        )}
        {activeTab === 'git' && (
          <GitTab gitInfo={gitInfo} loading={loadingGit} onRefresh={fetchGitInfo} />
        )}
        {activeTab === 'config' && (
          <ConfigTab project={project} />
        )}
      </div>
    </div>
  )
})

// ============ Tab Components ============

function OverviewTab({ project, gitInfo, deps, onStart, onStop }: {
  project: Project
  gitInfo: GitInfo | null
  deps: ProjectDependencies | null
  onStart: (script: string) => void
  onStop: () => void
}) {
  const isRunning = project.status === 'running'
  const totalDeps = deps ? deps.dependencies.length + deps.devDependencies.length : 0
  const typeLabel = PROJECT_TYPE_LABELS[project.projectType] || project.projectType

  return (
    <div className="space-y-4">
      {/* Quick Action */}
      <div className="flex items-center gap-3">
        {isRunning ? (
          <button onClick={onStop} className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error hover:bg-error/20 transition-colors text-sm font-medium" style={{ borderRadius: '2px' }}>
            <StopIcon size={14} />
            停止项目
          </button>
        ) : (
          <button onClick={() => onStart(project.defaultScript)} className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success hover:bg-success/20 transition-colors text-sm font-medium" style={{ borderRadius: '2px' }}>
            <PlayIcon size={14} />
            启动 ({project.defaultScript})
          </button>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCell label="项目类型" value={typeLabel} />
        <InfoCell label="状态" value={isRunning ? '运行中' : project.status === 'error' ? '错误' : '已停止'} />
        {gitInfo && <InfoCell label="Git 分支" value={gitInfo.branch} />}
        {gitInfo && <InfoCell label="未提交更改" value={String(gitInfo.uncommittedCount)} />}
        <InfoCell label="依赖总数" value={totalDeps > 0 ? String(totalDeps) : '无'} />
        {deps && <InfoCell label="锁文件" value={deps.lockfileType === 'none' ? '无' : deps.lockfileType} />}
        {project.port && <InfoCell label="端口" value={`:${project.port}`} />}
        <InfoCell label="脚本数量" value={String(project.scripts.length)} />
      </div>

      {/* Path */}
      <div className="bg-surface-800 p-3 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">项目路径</div>
        <div className="text-xs text-text-secondary font-mono break-all">{project.path}</div>
      </div>

      {/* Tags */}
      {project.tags.length > 0 && (
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">标签</div>
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map(tag => (
              <span key={tag} className="tag tag-default">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-800 p-2.5 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm text-text-primary font-medium mt-0.5 truncate" title={value}>{value}</div>
    </div>
  )
}

function ScriptsTab({ project, onStart, onStop }: {
  project: Project
  onStart: (script: string) => void
  onStop: () => void
}) {
  const isRunning = project.status === 'running'
  const [customArgs, setCustomArgs] = useState('')

  return (
    <div className="space-y-3">
      <div className="text-xs text-text-muted mb-2">
        共 {project.scripts.length} 个脚本
        {isRunning && <span className="text-success ml-2">-- 当前正在运行</span>}
      </div>

      {project.scripts.map(script => {
        const isDefault = script === project.defaultScript
        return (
          <div key={script} className="flex items-center justify-between bg-surface-800 p-3 border-l-2 border-surface-600 hover:border-accent/50 transition-colors" style={{ borderRadius: '2px' }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-mono text-text-primary">{script}</span>
              {isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent border-l-2 border-accent" style={{ borderRadius: '2px' }}>
                  默认
                </span>
              )}
            </div>
            {isRunning ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-3 py-1 text-xs text-error hover:bg-error/10 transition-colors"
                style={{ borderRadius: '2px' }}
              >
                <StopIcon size={12} />
                停止
              </button>
            ) : (
              <button
                onClick={() => onStart(script)}
                className="flex items-center gap-1 px-3 py-1 text-xs text-success hover:bg-success/10 transition-colors"
                style={{ borderRadius: '2px' }}
              >
                <PlayIcon size={12} />
                运行
              </button>
            )}
          </div>
        )
      })}

      {/* Custom script args */}
      {!isRunning && (
        <div className="mt-4">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">自定义参数</div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customArgs}
              onChange={(e) => setCustomArgs(e.target.value)}
              placeholder="-- --port 3001"
              className="input-sm flex-1 font-mono"
            />
          </div>
          <p className="text-[10px] text-text-muted mt-1">参数将附加到所选脚本命令后</p>
        </div>
      )}
    </div>
  )
}

function DependenciesTab({ deps, loading, onRefresh }: {
  deps: ProjectDependencies | null
  loading: boolean
  onRefresh: () => void
}) {
  const [search, setSearch] = useState('')
  const [showDev, setShowDev] = useState(false)

  if (loading) {
    return <div className="text-sm text-text-muted">加载中...</div>
  }

  if (!deps) {
    return <div className="text-sm text-text-muted">此项目没有 package.json，无法解析依赖。</div>
  }

  const items = showDev ? deps.devDependencies : deps.dependencies
  const filtered = search
    ? items.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <div className="space-y-3">
      {/* Header with counts */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDev(false)}
            className={`text-xs px-2 py-1 transition-colors ${!showDev ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary'}`}
            style={{ borderRadius: '2px' }}
          >
            dependencies ({deps.dependencies.length})
          </button>
          <button
            onClick={() => setShowDev(true)}
            className={`text-xs px-2 py-1 transition-colors ${showDev ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary'}`}
            style={{ borderRadius: '2px' }}
          >
            devDependencies ({deps.devDependencies.length})
          </button>
        </div>
        <button onClick={onRefresh} className="btn-icon text-text-muted hover:text-accent" title="刷新">
          <PackageIcon size={14} />
        </button>
      </div>

      {/* Lockfile info */}
      {deps.lockfileType !== 'none' && (
        <div className="text-[10px] text-text-muted">
          锁文件: {deps.lockfileType}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索依赖..."
          className="input-sm w-full pl-9"
        />
      </div>

      {/* List */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {filtered.map(dep => (
          <DepRow key={dep.name} dep={dep} />
        ))}
        {filtered.length === 0 && (
          <div className="text-xs text-text-muted py-4 text-center">
            {search ? '无匹配的依赖' : '无依赖'}
          </div>
        )}
      </div>
    </div>
  )
}

function DepRow({ dep }: { dep: DependencyEntry }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 bg-surface-800/50 hover:bg-surface-800 transition-colors text-xs" style={{ borderRadius: '2px' }}>
      <span className="font-mono text-text-primary truncate flex-1 min-w-0">{dep.name}</span>
      <span className="text-text-muted font-mono ml-2 flex-shrink-0">{dep.version}</span>
    </div>
  )
}

function PortsTab({ project }: { project: Project }) {
  if (!project.port) {
    return <div className="text-sm text-text-muted">此项目当前没有关联端口。项目运行后，绑定的端口将显示在这里。</div>
  }

  return (
    <div className="space-y-3">
      <div className="bg-surface-800 p-3 border-l-2 border-gold" style={{ borderRadius: '2px' }}>
        <div className="flex items-center gap-2">
          <PortIcon size={16} className="text-gold" />
          <span className="text-lg font-mono font-bold text-gold">:{project.port}</span>
        </div>
        <div className="text-xs text-text-muted mt-1">
          协议: TCP | 状态: LISTENING
        </div>
      </div>
      <p className="text-xs text-text-muted">
        更多端口详情请在监控面板的端口视图中查看。
      </p>
    </div>
  )
}

function LogsTab({ project }: { project: Project }) {
  const logs = useProjectStore(s => s.logs)
  const projectLogs = logs.get(project.id) || []
  const [logSearch, setLogSearch] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [projectLogs.length])

  const filteredLogs = logSearch
    ? projectLogs.filter(l => l.message.toLowerCase().includes(logSearch.toLowerCase()))
    : projectLogs

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Log search */}
      <div className="relative">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={logSearch}
          onChange={(e) => setLogSearch(e.target.value)}
          placeholder="搜索日志..."
          className="input-sm w-full pl-9"
        />
      </div>

      {/* Log content */}
      <div className="flex-1 bg-surface-950 p-3 font-mono text-[11px] overflow-y-auto min-h-[200px] max-h-[400px] border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
        {filteredLogs.length === 0 ? (
          <div className="text-text-muted text-center py-8">
            {projectLogs.length === 0 ? '暂无日志。启动项目后日志将显示在这里。' : '无匹配的日志条目。'}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className={`py-0.5 ${log.type === 'stderr' ? 'text-error' : 'text-text-secondary'}`}>
              <span className="text-text-muted mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}

function GitTab({ gitInfo, loading, onRefresh }: {
  gitInfo: GitInfo | null
  loading: boolean
  onRefresh: () => void
}) {
  if (loading) {
    return <div className="text-sm text-text-muted">加载 Git 信息中...</div>
  }

  if (!gitInfo) {
    return <div className="text-sm text-text-muted">此项目不是 Git 仓库，或无法获取 Git 信息。</div>
  }

  return (
    <div className="space-y-4">
      {/* Branch + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranchIcon size={16} className="text-accent" />
          <span className="text-sm font-medium text-text-primary">{gitInfo.branch}</span>
        </div>
        <button onClick={onRefresh} className="btn-icon text-text-muted hover:text-accent" title="刷新">
          <GitBranchIcon size={14} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <InfoCell label="未提交更改" value={String(gitInfo.uncommittedCount)} />
        <InfoCell label="领先远程" value={String(gitInfo.aheadBehind.ahead)} />
        <InfoCell label="落后远程" value={String(gitInfo.aheadBehind.behind)} />
      </div>

      {/* Recent Commits */}
      <div>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
          最近提交 ({gitInfo.recentCommits.length})
        </div>
        <div className="space-y-1">
          {gitInfo.recentCommits.map((commit, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 px-2 bg-surface-800/50 hover:bg-surface-800 transition-colors" style={{ borderRadius: '2px' }}>
              <span className="text-[10px] font-mono text-accent flex-shrink-0 mt-0.5">{commit.hash}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-text-primary truncate">{commit.message}</div>
                <div className="text-[10px] text-text-muted flex items-center gap-2 mt-0.5">
                  <span>{commit.author}</span>
                  <ClockIcon size={10} />
                  <span>{formatRelativeDate(commit.date)}</span>
                </div>
              </div>
            </div>
          ))}
          {gitInfo.recentCommits.length === 0 && (
            <div className="text-xs text-text-muted py-4 text-center">暂无提交记录</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfigTab({ project }: { project: Project }) {
  const { showToast } = useToast()
  const updateProject = useProjectStore(s => s.updateProject)
  const [defaultScript, setDefaultScript] = useState(project.defaultScript)
  const [notes, setNotes] = useState('')

  const handleSaveDefaultScript = async () => {
    if (!isElectron) return
    try {
      await window.devhub.projects.update(project.id, { defaultScript })
      updateProject(project.id, { defaultScript })
      showToast('success', '默认脚本已更新')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '更新失败')
    }
  }

  return (
    <div className="space-y-4">
      {/* Default Script */}
      <div>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">默认脚本</div>
        <div className="flex items-center gap-2">
          <select
            value={defaultScript}
            onChange={(e) => setDefaultScript(e.target.value)}
            className="input-sm flex-1 bg-surface-800"
          >
            {project.scripts.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={handleSaveDefaultScript}
            disabled={defaultScript === project.defaultScript}
            className="px-3 py-1 text-xs bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-30 transition-colors"
            style={{ borderRadius: '2px' }}
          >
            保存
          </button>
        </div>
      </div>

      {/* Tags */}
      <div>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">标签</div>
        <div className="flex flex-wrap gap-1.5">
          {project.tags.length > 0 ? project.tags.map(tag => (
            <span key={tag} className="tag tag-default flex items-center gap-1">
              <TagIcon size={10} />
              {tag}
            </span>
          )) : (
            <span className="text-xs text-text-muted">暂无标签</span>
          )}
        </div>
      </div>

      {/* Project Notes */}
      <div>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">项目备注</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="添加项目备注..."
          className="input-sm w-full h-24 resize-none bg-surface-800 font-mono"
        />
      </div>

      {/* Project Info */}
      <div className="bg-surface-800 p-3 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">项目信息</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">创建时间</span>
            <span className="text-text-secondary">{new Date(project.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">更新时间</span>
            <span className="text-text-secondary">{new Date(project.updatedAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">项目 ID</span>
            <span className="text-text-secondary font-mono">{project.id.substring(0, 8)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Utility ============

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    if (diffHour < 24) return `${diffHour}小时前`
    if (diffDay < 30) return `${diffDay}天前`
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}
