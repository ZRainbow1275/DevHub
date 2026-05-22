import { useMemo } from 'react'
import { useScannerStore } from '../../../stores/scannerStore'
import { EmptyWidgetState, MetricValue } from '../WidgetFrame'
import type { DashboardWidgetProps } from '../WidgetRegistry'
import { dashboardConfigBoolean, dashboardConfigNumber, parseDashboardWidgetConfig } from '../dashboard-widget-config'

export default function WindowSummaryWidget({ item }: DashboardWidgetProps) {
  const config = parseDashboardWidgetConfig(item.widgetId, item.config)
  const maxRows = dashboardConfigNumber(config, 'maxRows', 3)
  const visibleOnly = dashboardConfigBoolean(config, 'visibleOnly', true)
  const windows = useScannerStore(state => state.windows)
  const summary = useScannerStore(state => state.summary)
  const visibleCount = useMemo(() => windows.filter(windowInfo => windowInfo.isVisible).length, [windows])
  const minimizedCount = useMemo(() => windows.filter(windowInfo => windowInfo.isMinimized).length, [windows])
  const topWindows = useMemo(
    () => windows.filter(windowInfo => visibleOnly ? windowInfo.isVisible : true).slice(0, maxRows),
    [maxRows, visibleOnly, windows]
  )

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MetricValue label="窗口" value={summary.windowCount || windows.length} />
      <MetricValue label="可见" tone="text-accent" value={visibleCount} />
      <div className="col-span-2 min-h-0 overflow-hidden rounded-md border border-surface-700 bg-surface-950/50">
        {topWindows.length === 0 ? (
          <EmptyWidgetState message={`暂无可见窗口，最小化 ${minimizedCount}`} />
        ) : (
          <ul className="divide-y divide-surface-800 text-xs">
            {topWindows.map(windowInfo => (
              <li className="flex items-center justify-between gap-3 px-3 py-2" key={windowInfo.hwnd}>
                <span className="truncate text-text-secondary">{windowInfo.title || windowInfo.processName}</span>
                <span className="tabular-nums text-text-muted">{windowInfo.pid}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
