import { useMemo } from 'react'
import { useScannerStore } from '../../../stores/scannerStore'
import { EmptyWidgetState, MetricValue } from '../WidgetFrame'
import type { DashboardWidgetProps } from '../WidgetRegistry'
import { dashboardConfigNumber, parseDashboardWidgetConfig } from '../dashboard-widget-config'

export default function ProcessSummaryWidget({ item }: DashboardWidgetProps) {
  const config = parseDashboardWidgetConfig(item.widgetId, item.config)
  const maxRows = dashboardConfigNumber(config, 'maxRows', 4)
  const processes = useScannerStore(state => state.processes)
  const summary = useScannerStore(state => state.summary)
  const topProcesses = useMemo(
    () => [...processes].sort((left, right) => right.cpu - left.cpu).slice(0, maxRows),
    [maxRows, processes]
  )

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MetricValue label="进程" value={summary.processCount || processes.length} />
      <MetricValue label="CPU" tone="text-accent" value={`${summary.cpuTotal.toFixed(1)}%`} />
      <div className="col-span-2 min-h-0 overflow-hidden rounded-md border border-surface-700 bg-surface-950/50">
        {topProcesses.length === 0 ? (
          <EmptyWidgetState message="暂无实时进程数据" />
        ) : (
          <ul className="divide-y divide-surface-800 text-xs">
            {topProcesses.map(processInfo => (
              <li className="flex items-center justify-between gap-3 px-3 py-2" key={processInfo.pid}>
                <span className="truncate text-text-secondary">{processInfo.name}</span>
                <span className="tabular-nums text-text-muted">{processInfo.cpu.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
