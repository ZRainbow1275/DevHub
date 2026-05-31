import { useMemo } from 'react'
import { useScannerStore } from '../../../stores/scannerStore'
import { EmptyWidgetState, MetricValue } from '../WidgetFrame'
import type { DashboardWidgetProps } from '../WidgetRegistry'
import { dashboardConfigNumber, parseDashboardWidgetConfig } from '../dashboard-widget-config'

export default function PortSummaryWidget({ item }: DashboardWidgetProps) {
  const config = parseDashboardWidgetConfig(item.widgetId, item.config)
  const maxRows = dashboardConfigNumber(config, 'maxRows', 4)
  const ports = useScannerStore(state => state.ports)
  const summary = useScannerStore(state => state.summary)
  const byProtocol = useMemo(() => {
    const counts = new Map<string, number>()
    for (const port of ports) counts.set(port.protocol, (counts.get(port.protocol) ?? 0) + 1)
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, maxRows)
  }, [maxRows, ports])

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MetricValue label="监听端口" tone="text-accent" value={summary.activePortCount || ports.length} />
      <MetricValue label="协议" value={byProtocol.length} />
      <div className="col-span-2 min-h-0 overflow-hidden rounded-md border border-surface-700 bg-surface-950/50">
        {byProtocol.length === 0 ? (
          <EmptyWidgetState message="暂无实时端口数据" />
        ) : (
          <ul className="divide-y divide-surface-800 text-xs">
            {byProtocol.map(([protocol, count]) => (
              <li className="flex items-center justify-between gap-3 px-3 py-2" key={protocol}>
                <span className="min-w-0 flex-1 truncate uppercase tracking-[0.14em] text-text-secondary">{protocol}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-text-muted">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
