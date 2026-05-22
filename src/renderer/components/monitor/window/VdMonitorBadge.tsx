import { memo } from 'react'

interface VdMonitorBadgeProps {
  hwnd: number
  desktopId: string | null
  monitorId: number
  isOnCurrentDesktop?: boolean
}

export const VdMonitorBadge = memo(function VdMonitorBadge({
  hwnd,
  desktopId,
  monitorId,
  isOnCurrentDesktop = true
}: VdMonitorBadgeProps) {
  const desktopLabel = desktopId ? `VD ${desktopId}` : 'VD current'
  const monitorLabel = `Mon ${monitorId + 1}`
  return (
    <span
      data-testid={`vd-monitor-badge-${hwnd}`}
      data-desktop-id={desktopId ?? 'current'}
      data-monitor-id={monitorId}
      data-current-desktop={isOnCurrentDesktop ? 'true' : 'false'}
      className={`absolute bottom-2 right-2 border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider radius-sm ${
        isOnCurrentDesktop
          ? 'border-info/40 bg-info/15 text-info'
          : 'border-warning/40 bg-warning/15 text-warning'
      }`}
    >
      {desktopLabel} / {monitorLabel}
    </span>
  )
})
