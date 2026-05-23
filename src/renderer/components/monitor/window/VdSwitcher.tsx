import { memo, useCallback } from 'react'
import { Monitor } from 'lucide-react'
import { useVirtualDesktop } from '../../../hooks/useVirtualDesktop'
import { useT } from '../../../hooks/useT'

interface VdSwitcherProps {
  hwnd: number
  onMoved?: () => void
}

function shortDesktopId(desktopId: string): string {
  return desktopId.slice(0, 8)
}

export const VdSwitcher = memo(function VdSwitcher({ hwnd, onMoved }: VdSwitcherProps) {
  const { t } = useT()
  const { desktops, unavailableReason, moveToDesktop, refresh } = useVirtualDesktop()

  const handleMove = useCallback(async (desktopId: string) => {
    const result = await moveToDesktop(hwnd, desktopId, 'vd-switcher')
    if (result.success) {
      onMoved?.()
      await refresh()
    }
  }, [hwnd, moveToDesktop, onMoved, refresh])

  if (desktops.length === 0) {
    return (
      <div className="rounded-md border border-surface-700 bg-surface-900 p-3 text-xs text-text-muted" data-testid={`vd-switcher-${hwnd}`}>
        {unavailableReason ?? t('monitor.window.vdSwitcher.unavailable', 'Virtual desktop data is not available on this host.')}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-surface-700 bg-surface-900 p-2" data-testid={`vd-switcher-${hwnd}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-text-primary">
        <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t('monitor.window.vdSwitcher.title', 'Virtual desktops')}</span>
      </div>
      <div className="flex flex-col gap-1">
        {desktops.map(desktop => (
          <button
            className="rounded px-2 py-1 text-left text-xs text-text-muted hover:bg-surface-800 hover:text-text-primary"
            data-current={desktop.current ? 'true' : 'false'}
            data-testid={`vd-switcher-option-${hwnd}-${desktop.id}`}
            key={desktop.id}
            onClick={() => { void handleMove(desktop.id) }}
            type="button"
          >
            {desktop.name ?? `VD ${desktop.index + 1}`} <span className="text-text-subtle">{shortDesktopId(desktop.id)}</span>
          </button>
        ))}
      </div>
    </div>
  )
})
