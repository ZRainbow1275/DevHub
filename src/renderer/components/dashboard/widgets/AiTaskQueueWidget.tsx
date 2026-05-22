import { useMemo } from 'react'
import { useScannerStore } from '../../../stores/scannerStore'
import { EmptyWidgetState, MetricValue } from '../WidgetFrame'
import type { DashboardWidgetProps } from '../WidgetRegistry'
import { dashboardConfigNumber, parseDashboardWidgetConfig } from '../dashboard-widget-config'

export default function AiTaskQueueWidget({ item }: DashboardWidgetProps) {
  const config = parseDashboardWidgetConfig(item.widgetId, item.config)
  const maxRows = dashboardConfigNumber(config, 'maxRows', 4)
  const aiTasks = useScannerStore(state => state.aiTasks)
  const summary = useScannerStore(state => state.summary)
  const activeTasks = useMemo(
    () => aiTasks.filter(task => !task.endTime && task.status.state !== 'completed' && task.status.state !== 'error'),
    [aiTasks]
  )
  const byTool = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of aiTasks) counts.set(task.toolType, (counts.get(task.toolType) ?? 0) + 1)
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, maxRows)
  }, [aiTasks, maxRows])

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MetricValue label="AI 工具" value={summary.aiToolCount || byTool.length} />
      <MetricValue label="活跃任务" tone="text-accent" value={activeTasks.length} />
      <div className="col-span-2 min-h-0 overflow-hidden rounded-md border border-surface-700 bg-surface-950/50">
        {byTool.length === 0 ? (
          <EmptyWidgetState message="暂无实时 AI 任务数据" />
        ) : (
          <ul className="divide-y divide-surface-800 text-xs">
            {byTool.map(([tool, count]) => (
              <li className="flex items-center justify-between gap-3 px-3 py-2" key={tool}>
                <span className="truncate text-text-secondary">{tool}</span>
                <span className="tabular-nums text-text-muted">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
