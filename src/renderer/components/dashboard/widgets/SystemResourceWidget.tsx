import { useScannerStore } from '../../../stores/scannerStore'
import { MetricValue } from '../WidgetFrame'
import type { DashboardWidgetProps } from '../WidgetRegistry'
import { dashboardConfigBoolean, parseDashboardWidgetConfig } from '../dashboard-widget-config'

function ResourceBar({ label, value }: { label: string; value: number }) {
  const bounded = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-text-muted">
        <span>{label}</span>
        <span>{bounded.toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-surface-800">
        <div className="h-full bg-accent" style={{ width: `${bounded}%` }} />
      </div>
    </div>
  )
}

export default function SystemResourceWidget({ item }: DashboardWidgetProps) {
  const config = parseDashboardWidgetConfig(item.widgetId, item.config)
  const showBars = dashboardConfigBoolean(config, 'showBars', true)
  const summary = useScannerStore(state => state.summary)

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MetricValue label="CPU" tone="text-accent" value={`${summary.cpuTotal.toFixed(1)}%`} />
      <MetricValue label="内存" value={`${summary.memoryUsedPercent.toFixed(1)}%`} />
      {showBars ? (
        <div className="col-span-2 space-y-3 rounded-md border border-surface-700 bg-surface-950/50 p-3">
          <ResourceBar label="CPU total" value={summary.cpuTotal} />
          <ResourceBar label="Memory used" value={summary.memoryUsedPercent} />
        </div>
      ) : null}
    </div>
  )
}
