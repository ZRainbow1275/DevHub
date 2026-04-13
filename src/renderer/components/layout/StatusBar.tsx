import { useToolStatus } from '../../hooks/useToolStatus'
import { useProjectStore } from '../../stores/projectStore'
import { GearIcon, LightningIcon } from '../icons'

export function StatusBar() {
  const { tools } = useToolStatus()
  const projects = useProjectStore(s => s.projects)

  const runningProjects = projects.filter(p => p.status === 'running')
  const runningCount = runningProjects.length
  const runningTools = tools.filter(t => t.status === 'running')
  const completedTools = tools.filter(t => t.status === 'completed')

  const MAX_SHOW = 2
  const projectNames = runningProjects.map(p => p.name)
  const projectDisplay = projectNames.length <= MAX_SHOW
    ? projectNames.join(', ')
    : `${projectNames.slice(0, MAX_SHOW).join(', ')} +${projectNames.length - MAX_SHOW} more`

  return (
    <footer className="h-8 bg-surface-900 border-t-2 border-surface-700 flex items-center justify-between px-4 text-xs relative">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-gold to-accent" />

      {/* Diagonal decoration */}
      <div className="absolute inset-0 deco-diagonal opacity-30 pointer-events-none" />

      {/* Left: Status */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="flex items-center gap-2 text-text-tertiary">
          <span className="status-dot status-dot-running" />
          <span className="font-medium uppercase tracking-wider" style={{ fontSize: '11px' }}>
            就绪
          </span>
        </div>

        {runningCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-px bg-surface-600" />
            <GearIcon size={14} className="text-success animate-gear-spin" style={{ animationDuration: '2s' }} />
            <span className="text-success font-bold tabular-nums">{runningCount}</span>
            <span className="text-text-muted">个项目运行中</span>
            <span className="text-accent-300 truncate max-w-[180px] lg:max-w-[300px] font-medium" title={projectNames.join(', ')}>
              {projectDisplay}
            </span>
          </div>
        )}
      </div>

      {/* Right: Tool Status */}
      <div className="flex items-center gap-3 relative z-10">
        {/* Running tools badge */}
        {runningTools.length > 0 && (
          <div className="status-badge status-badge-running">
            <LightningIcon size={12} className="animate-lightning" />
            <span className="font-bold tabular-nums">{runningTools.length}</span>
            <span>AI 工具运行中</span>
          </div>
        )}

        {/* Recently completed */}
        {completedTools.length > 0 && runningTools.length === 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-steel/10 border-l-2 border-steel text-steel-300 radius-sm">
            <span style={{ fontSize: '11px' }}>
              {completedTools[0].displayName} 已完成
            </span>
          </div>
        )}

        {/* Tool status indicators */}
        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className={`
                flex items-center gap-1 px-2 py-0.5 transition-all duration-200
                ${tool.status === 'running'
                  ? 'bg-success/10 text-success border-l-2 border-success'
                  : tool.status === 'completed'
                    ? 'bg-steel/10 text-steel-300 border-l-2 border-steel'
                    : 'text-text-muted hover:bg-surface-800'
                }
               radius-sm`}
              title={`${tool.displayName}: ${tool.status === 'running' ? '运行中' : tool.status === 'completed' ? '已完成' : '空闲'}`}
            >
              <span className={`
                w-1.5 h-1.5
                ${tool.status === 'running'
                  ? 'bg-success animate-pulse'
                  : tool.status === 'completed'
                    ? 'bg-steel'
                    : 'bg-surface-500'
                }
               radius-sm`} />
              <span style={{ fontSize: '11px' }} className="font-medium">
                {tool.displayName}
              </span>
            </div>
          ))}
        </div>

        <div className="h-4 w-px bg-surface-600" />

        {/* Version */}
        <span className="text-text-muted font-mono" style={{ fontSize: '10px' }}>
          DEVHUB v1.0
        </span>
      </div>
    </footer>
  )
}
