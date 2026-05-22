import { useEffect } from 'react'
import { useDashboardStore } from '../stores/dashboardStore'

export function useDashboardLayout(name = 'default') {
  const layout = useDashboardStore(state => state.layout)
  const presets = useDashboardStore(state => state.presets)
  const loading = useDashboardStore(state => state.loading)
  const error = useDashboardStore(state => state.error)
  const loadLayout = useDashboardStore(state => state.loadLayout)
  const updateFromGrid = useDashboardStore(state => state.updateFromGrid)
  const updateWidgetConfig = useDashboardStore(state => state.updateWidgetConfig)
  const applyPreset = useDashboardStore(state => state.applyPreset)
  const morphWidgetToDrawer = useDashboardStore(state => state.morphWidgetToDrawer)

  useEffect(() => {
    void loadLayout(name)
  }, [loadLayout, name])

  return {
    layout,
    presets,
    loading,
    error,
    updateFromGrid,
    updateWidgetConfig,
    applyPreset,
    morphWidgetToDrawer
  }
}
