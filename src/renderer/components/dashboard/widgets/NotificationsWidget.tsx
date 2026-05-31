import { useEffect, useState } from 'react'
import { EmptyWidgetState, MetricValue } from '../WidgetFrame'
import type { DashboardWidgetProps } from '../WidgetRegistry'
import type { StatusAggregate } from '@shared/schemas/r8-runtime'
import { dashboardConfigNumber, dashboardConfigString, parseDashboardWidgetConfig } from '../dashboard-widget-config'

const toneRank = { info: 0, warning: 1, danger: 2 } as const

function notificationToneRank(tone: StatusAggregate['badges'][number]['tone']): number {
  if (tone === 'danger') return toneRank.danger
  if (tone === 'warning') return toneRank.warning
  return toneRank.info
}

export default function NotificationsWidget({ item }: DashboardWidgetProps) {
  const config = parseDashboardWidgetConfig(item.widgetId, item.config)
  const maxRows = dashboardConfigNumber(config, 'maxRows', 4)
  const minTone = dashboardConfigString(config, 'minTone', 'warning') as keyof typeof toneRank
  const [aggregate, setAggregate] = useState<StatusAggregate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    void window.devhub?.r8?.status?.aggregate?.()
      .then(result => {
        if (!disposed) setAggregate(result)
      })
      .catch(reason => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      disposed = true
    }
  }, [])

  const notificationTile = aggregate?.tiles.find(tile => tile.id === 'notifications')
  const warningBadges = aggregate?.badges.filter(badge => notificationToneRank(badge.tone) >= toneRank[minTone]).slice(0, maxRows) ?? []

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MetricValue label="通知" value={notificationTile ? String(notificationTile.value) : 0} />
      <MetricValue label="告警" tone={warningBadges.length > 0 ? 'text-warning' : 'text-accent'} value={warningBadges.length} />
      <div className="col-span-2 min-h-0 overflow-hidden rounded-md border border-surface-700 bg-surface-950/50">
        {error ? (
          <EmptyWidgetState message={`status aggregate 不可用：${error}`} />
        ) : warningBadges.length === 0 ? (
          <EmptyWidgetState message="暂无 warning/danger 状态徽章" />
        ) : (
          <ul className="divide-y divide-surface-800 text-xs">
            {warningBadges.slice(0, 4).map(badge => (
              <li className="flex items-center justify-between gap-3 px-3 py-2" key={badge.id}>
                <span className="min-w-0 flex-1 truncate text-text-secondary">{badge.label}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-text-muted">{String(badge.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
