import { useCallback, useEffect, useState } from 'react'
import type { R8MonitorInfo } from '@shared/schemas/r8-runtime'

export function useMonitors() {
  const [monitors, setMonitors] = useState<R8MonitorInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const bridge = window.devhub?.windowManager?.getR8Monitors
    if (!bridge) {
      setMonitors([])
      setError('E_BRIDGE_UNAVAILABLE')
      return
    }
    try {
      const response = await bridge()
      setMonitors(response.monitors)
      setError(null)
    } catch (caught) {
      setMonitors([])
      setError(caught instanceof Error ? caught.message : 'E_MONITOR_QUERY_FAILED')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { monitors, error, refresh }
}
