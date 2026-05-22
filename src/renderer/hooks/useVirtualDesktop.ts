import { useCallback, useEffect, useState } from 'react'
import type { VirtualDesktop } from '@shared/schemas/r8-runtime'

export function useVirtualDesktop() {
  const [desktops, setDesktops] = useState<VirtualDesktop[]>([])
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const bridge = window.devhub?.windowManager?.listVirtualDesktops
    if (!bridge) {
      setDesktops([])
      setUnavailableReason('E_BRIDGE_UNAVAILABLE')
      return
    }
    try {
      const response = await bridge()
      setDesktops(response.desktops)
      setUnavailableReason(response.unavailableReason ?? null)
    } catch (caught) {
      setDesktops([])
      setUnavailableReason(caught instanceof Error ? caught.message : 'E_VIRTUAL_DESKTOP_QUERY_FAILED')
    }
  }, [])

  const moveToDesktop = useCallback(async (hwnd: number, desktopId: string, confirmedBy = 'renderer') => {
    const bridge = window.devhub?.windowManager?.moveToDesktop
    if (!bridge) return { success: false, error: 'E_BRIDGE_UNAVAILABLE' }
    return bridge({ hwnd, desktopId, confirmedBy })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { desktops, unavailableReason, refresh, moveToDesktop }
}
