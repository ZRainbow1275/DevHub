import { create } from 'zustand'
import type { DashboardLayout } from '@shared/schemas/r8-runtime'
import { createDashboardLayout, mergeReactGridLayouts, updateDashboardWidgetConfig } from '../components/dashboard/dashboard-model'
import type { DashboardWidgetConfig } from '../components/dashboard/dashboard-widget-config'
import type { DashboardBreakpoint } from '@shared/schemas/r8-runtime'
import type { ResponsiveLayouts } from 'react-grid-layout'

interface DashboardState {
  layout: DashboardLayout
  presets: string[]
  loading: boolean
  error: string | null
  loadLayout: (name?: string) => Promise<void>
  saveLayout: (layout: DashboardLayout) => Promise<void>
  updateFromGrid: (layouts: ResponsiveLayouts<DashboardBreakpoint>) => Promise<void>
  updateWidgetConfig: (widgetInstanceId: string, config: DashboardWidgetConfig) => Promise<void>
  applyPreset: (name: string) => Promise<void>
  morphWidgetToDrawer: (widgetInstanceId: string, slot: 'right' | 'bottom') => Promise<void>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  layout: createDashboardLayout(),
  presets: ['default', 'minimal', 'monitor-focus', 'ai-focus'],
  loading: false,
  error: null,

  loadLayout: async (name) => {
    set({ loading: true, error: null })
    try {
      const bridge = window.devhub?.r8?.dashboard
      const response = bridge ? await bridge.getLayout(name) : { layout: createDashboardLayout(name ?? 'default') }
      const presets = bridge ? await bridge.listPresets() : { names: ['default', 'minimal', 'monitor-focus', 'ai-focus'] }
      set({ layout: response.layout, presets: presets.names, loading: false })
    } catch (error) {
      set({ error: errorMessage(error), loading: false })
    }
  },

  saveLayout: async (layout) => {
    set({ layout, error: null })
    try {
      const response = await window.devhub?.r8?.dashboard?.saveLayout(layout)
      if (response?.layout) set({ layout: response.layout })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  updateFromGrid: async (layouts) => {
    const next = mergeReactGridLayouts(get().layout, layouts)
    await get().saveLayout(next)
  },

  updateWidgetConfig: async (widgetInstanceId, config) => {
    const next = updateDashboardWidgetConfig(get().layout, widgetInstanceId, config)
    await get().saveLayout(next)
  },

  applyPreset: async (name) => {
    set({ loading: true, error: null })
    try {
      const response = await window.devhub?.r8?.dashboard?.reset(name, 'dashboard-ui')
      set({ layout: response?.layout ?? createDashboardLayout(name), loading: false })
    } catch (error) {
      set({ error: errorMessage(error), loading: false })
    }
  },

  morphWidgetToDrawer: async (widgetInstanceId, slot) => {
    set({ error: null })
    try {
      const response = await window.devhub?.r8?.dashboard?.morphWidgetToDrawer(widgetInstanceId, slot)
      if (response?.layout) set({ layout: response.layout })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  }
}))
