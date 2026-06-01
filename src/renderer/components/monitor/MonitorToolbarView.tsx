import { useCallback } from 'react'
import type { DetachableViewProps } from '../popout/detachable-registry'
import { navigateMonitorTab, type MonitorTab } from '../../utils/navigateMonitorTab'
import {
  AIIcon,
  GearIcon,
  PortIcon,
  ProcessIcon,
  TopologyIcon,
  WindowIcon,
  WrenchIcon
} from '../icons'

const QUICK_ACTIONS: Array<{ tab: MonitorTab; label: string; icon: React.ReactNode }> = [
  { tab: 'process', label: '进程', icon: <ProcessIcon size={16} /> },
  { tab: 'port', label: '端口', icon: <PortIcon size={16} /> },
  { tab: 'window', label: '窗口', icon: <WindowIcon size={16} /> },
  { tab: 'ai-task', label: 'AI 任务', icon: <AIIcon size={16} /> },
  { tab: 'topology', label: '拓扑', icon: <TopologyIcon size={16} /> },
  { tab: 'r8-ops', label: 'R8 运营', icon: <GearIcon size={16} /> }
]

/**
 * The supported detachable toolbars. Adding another self-sufficient toolbar is a
 * matter of registering it here plus a render branch below. Toolbars that depend
 * heavily on parent selection state (e.g. ProcessBatchToolbar) are intentionally
 * not yet detachable — see the parent task PR3 notes.
 */
const TOOLBAR_TITLES: Record<string, string> = {
  'monitor-quick': '监控快捷栏'
}

export function monitorToolbarTitle(toolbarId: string | null | undefined): string {
  if (!toolbarId) return '监控功能栏'
  return TOOLBAR_TITLES[toolbarId] ?? '监控功能栏'
}

/**
 * Self-contained monitor quick-action toolbar. It drives the main window's
 * Monitor tabs without any parent context or serialized state.
 *
 * Cross-process navigation is delegated to {@link navigateMonitorTab}: a detached
 * toolbar runs in its OWN render process, so the helper hops through the main
 * process command bridge when detached (and degrades to the local event when the
 * bridge is unavailable). Unknown toolbar ids degrade to an honest notice rather
 * than crashing.
 */
export function MonitorToolbarView({ initialTarget }: DetachableViewProps): React.JSX.Element {
  const toolbarId = initialTarget?.kind === 'toolbarId' ? initialTarget.value : 'monitor-quick'

  const navigate = useCallback((tab: MonitorTab) => {
    navigateMonitorTab(tab, { openMonitor: false })
  }, [])

  if (toolbarId !== 'monitor-quick') {
    return (
      <div className="flex h-full items-center justify-center bg-surface-950 p-4 text-xs text-text-muted" data-testid="monitor-toolbar-view">
        未知功能栏 {toolbarId}。
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-surface-950 p-4" data-testid="monitor-toolbar-view" data-r8c-toolbar={toolbarId}>
      <div className="mb-3 flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
        <WrenchIcon size={15} className="shrink-0 text-accent" />
        <span className="truncate">{monitorToolbarTitle(toolbarId)}</span>
      </div>
      <p className="mb-3 text-xs leading-5 text-text-muted">
        点击切换主窗口监控视图。功能栏作为独立悬浮窗运行，操作通过事件驱动主窗口。
      </p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.tab}
            type="button"
            data-testid={`monitor-toolbar-action-${action.tab}`}
            onClick={() => navigate(action.tab)}
            className="flex items-center gap-1.5 border border-surface-700 bg-surface-800 px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent/50 hover:text-accent radius-sm"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default MonitorToolbarView
