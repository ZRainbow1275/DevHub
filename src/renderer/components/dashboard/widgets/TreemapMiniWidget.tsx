import { useMemo } from 'react'
import { useScannerStore } from '../../../stores/scannerStore'
import { EmptyWidgetState } from '../WidgetFrame'
import type { DashboardWidgetProps } from '../WidgetRegistry'
import { dashboardConfigNumber, parseDashboardWidgetConfig } from '../dashboard-widget-config'

export default function TreemapMiniWidget({ item }: DashboardWidgetProps) {
  const config = parseDashboardWidgetConfig(item.widgetId, item.config)
  const maxRows = dashboardConfigNumber(config, 'maxRows', 8)
  const processes = useScannerStore(state => state.processes)
  const rows = useMemo(
    () => [...processes]
      .sort((left, right) => (right.memory + right.cpu * 10) - (left.memory + left.cpu * 10))
      .slice(0, maxRows),
    [maxRows, processes]
  )
  const maxWeight = Math.max(1, ...rows.map(row => row.memory + row.cpu * 10))

  if (rows.length === 0) return <EmptyWidgetState message="暂无进程数据，Treemap 等待 scanner 快照" />

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      {rows.map(row => {
        const weight = row.memory + row.cpu * 10
        return (
          <div className="grid grid-cols-[minmax(0,1fr)_clamp(3rem,15%,5rem)] items-center gap-3 text-xs" key={row.pid}>
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-text-secondary">{row.name}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-text-muted">{row.pid}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-surface-800">
                <div className="h-full bg-accent" style={{ width: `${Math.max(4, (weight / maxWeight) * 100)}%` }} />
              </div>
            </div>
            <div className="shrink-0 whitespace-nowrap text-right tabular-nums text-text-muted">{row.cpu.toFixed(1)}%</div>
          </div>
        )
      })}
    </div>
  )
}
