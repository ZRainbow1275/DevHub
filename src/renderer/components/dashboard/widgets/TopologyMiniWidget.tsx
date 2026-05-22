import { useScannerStore } from '../../../stores/scannerStore'
import type { DashboardWidgetProps } from '../WidgetRegistry'
import { dashboardConfigNumber, parseDashboardWidgetConfig } from '../dashboard-widget-config'

export default function TopologyMiniWidget({ item }: DashboardWidgetProps) {
  const config = parseDashboardWidgetConfig(item.widgetId, item.config)
  const maxNodes = dashboardConfigNumber(config, 'maxNodes', 8)
  const processes = useScannerStore(state => state.processes)
  const ports = useScannerStore(state => state.ports)
  const windows = useScannerStore(state => state.windows)
  const linkedPorts = ports.filter(port => processes.some(processInfo => processInfo.pid === port.pid)).length
  const linkedWindows = windows.filter(windowInfo => processes.some(processInfo => processInfo.pid === windowInfo.pid)).length
  const nodeCount = processes.length + ports.length + windows.length
  const edgeCount = linkedPorts + linkedWindows
  const displayedNodeCount = Math.min(nodeCount, maxNodes)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded border border-surface-700 bg-surface-950/60 p-2">
          <div className="text-lg font-bold text-text-primary">{processes.length}</div>
          <div className="text-text-muted">进程</div>
        </div>
        <div className="rounded border border-surface-700 bg-surface-950/60 p-2">
          <div className="text-lg font-bold text-accent">{ports.length}</div>
          <div className="text-text-muted">端口</div>
        </div>
        <div className="rounded border border-surface-700 bg-surface-950/60 p-2">
          <div className="text-lg font-bold text-text-primary">{windows.length}</div>
          <div className="text-text-muted">窗口</div>
        </div>
      </div>
      <svg className="min-h-0 flex-1 rounded border border-surface-700 bg-surface-950/50" viewBox="0 0 320 120" role="img" aria-label="dashboard topology mini graph" data-theme-sync="topology-palette">
        <line x1="72" x2="160" y1="60" y2="30" stroke="var(--topology-edge-default)" strokeWidth="2" />
        <line x1="72" x2="160" y1="60" y2="90" stroke="var(--topology-edge-default)" strokeWidth="2" />
        <line x1="160" x2="248" y1="30" y2="60" stroke="var(--topology-edge-default)" strokeWidth="2" />
        <line x1="160" x2="248" y1="90" y2="60" stroke="var(--topology-edge-default)" strokeWidth="2" />
        <rect x="42" y="42" width="60" height="36" rx="4" fill="var(--topology-node-process)" stroke="var(--topology-node-bg)" strokeWidth="2" />
        <rect x="130" y="12" width="60" height="36" rx="4" fill="var(--topology-node-port)" stroke="var(--topology-node-bg)" strokeWidth="2" />
        <rect x="130" y="72" width="60" height="36" rx="4" fill="var(--topology-node-window)" stroke="var(--topology-node-bg)" strokeWidth="2" />
        <rect x="218" y="42" width="60" height="36" rx="4" fill="var(--topology-node-ai)" stroke="var(--topology-node-bg)" strokeWidth="2" />
        <text x="72" y="64" textAnchor="middle" fill="var(--topology-node-label)" className="text-[11px]">{displayedNodeCount}</text>
        <text x="248" y="64" textAnchor="middle" fill="var(--topology-node-label)" className="text-[11px]">{edgeCount}</text>
      </svg>
    </div>
  )
}
