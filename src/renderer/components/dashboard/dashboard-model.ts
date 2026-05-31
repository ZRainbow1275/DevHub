import type { LayoutItem, ResponsiveLayouts } from 'react-grid-layout'
import {
  dashboardGridItemSchema,
  dashboardLayoutSchema,
  type DashboardBreakpoint,
  type DashboardGridItem,
  type DashboardLayout,
  type DashboardWidgetId
} from '@shared/schemas/r8-runtime'
import { parseDashboardWidgetConfig, type DashboardWidgetConfig } from './dashboard-widget-config'

export const DASHBOARD_BREAKPOINTS: DashboardBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl']

export const DASHBOARD_BREAKPOINT_WIDTHS: Record<DashboardBreakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 960,
  lg: 1280,
  xl: 1600
}

export const DASHBOARD_COLS: Record<DashboardBreakpoint, number> = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16
}

export function clampTileWidth(w: number, cols: number): number {
  return Math.min(Math.max(1, w), Math.max(1, cols))
}

function clampLayoutForCols(
  items: readonly LayoutItem[],
  cols: number
): { items: LayoutItem[]; changed: boolean } {
  let changed = false
  const next = items.map(item => {
    const w = clampTileWidth(item.w, cols)
    let x = item.x
    if (x + w > cols) {
      x = Math.max(0, cols - w)
      changed = true
    }
    if (w !== item.w) {
      changed = true
    }
    if (w === item.w && x === item.x) return item
    return { ...item, w, x }
  })
  return { items: next, changed }
}

export function clampLayoutsForBreakpoint(
  layouts: ResponsiveLayouts<DashboardBreakpoint>,
  _breakpoint: DashboardBreakpoint
): ResponsiveLayouts<DashboardBreakpoint> {
  let anyChanged = false
  const result = { ...layouts } as Record<string, LayoutItem[]>
  for (const bp of DASHBOARD_BREAKPOINTS) {
    const source = layouts[bp]
    if (!source) continue
    const cols = DASHBOARD_COLS[bp]
    const { items, changed } = clampLayoutForCols(source, cols)
    if (changed) {
      anyChanged = true
      result[bp] = items
    }
  }
  if (!anyChanged) return layouts
  return result as ResponsiveLayouts<DashboardBreakpoint>
}

export const DEFAULT_WIDGET_IDS: DashboardWidgetId[] = [
  'process-summary',
  'port-summary',
  'window-summary',
  'ai-task-queue',
  'system-resource',
  'notifications',
  'topology-mini',
  'treemap-mini'
]

export function createDashboardGridItem(
  widgetId: DashboardWidgetId,
  index: number,
  overrides: Partial<DashboardGridItem> = {}
): DashboardGridItem {
  return dashboardGridItemSchema.parse({
    i: overrides.i ?? `widget-${widgetId}`,
    widgetId,
    x: overrides.x ?? (index % 4) * 3,
    y: overrides.y ?? Math.floor(index / 4) * 3,
    w: overrides.w ?? (widgetId === 'treemap-mini' ? 6 : 3),
    h: overrides.h ?? (widgetId === 'treemap-mini' || widgetId === 'system-resource' ? 4 : 3),
    minW: overrides.minW ?? 2,
    minH: overrides.minH ?? 2,
    maxW: overrides.maxW,
    maxH: overrides.maxH,
    static: overrides.static ?? false,
    config: overrides.config ?? {}
  })
}

export function flowDashboardItems(items: DashboardGridItem[], cols: number): DashboardGridItem[] {
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0
  return items.map(item => {
    const width = Math.max(1, Math.min(item.w, cols))
    const height = Math.max(1, item.h)
    if (cursorX + width > cols) {
      cursorX = 0
      cursorY += Math.max(rowHeight, 1)
      rowHeight = 0
    }
    const next = dashboardGridItemSchema.parse({ ...item, x: cursorX, y: cursorY, w: width, h: height })
    cursorX += width
    rowHeight = Math.max(rowHeight, height)
    return next
  })
}

export function createDashboardLayout(name = 'default', widgetIds: DashboardWidgetId[] = DEFAULT_WIDGET_IDS): DashboardLayout {
  const items = widgetIds.map((widgetId, index) => createDashboardGridItem(widgetId, index))
  return dashboardLayoutSchema.parse({
    name,
    layouts: Object.fromEntries(
      DASHBOARD_BREAKPOINTS.map(breakpoint => [breakpoint, flowDashboardItems(items, DASHBOARD_COLS[breakpoint])])
    ),
    cols: DASHBOARD_COLS,
    rowHeight: 50,
    margin: [8, 8],
    containerPadding: [8, 8],
    updatedAt: Date.now()
  })
}

export function toReactGridLayouts(layout: DashboardLayout): ResponsiveLayouts<DashboardBreakpoint> {
  return Object.fromEntries(
    DASHBOARD_BREAKPOINTS.map(breakpoint => [
      breakpoint,
      layout.layouts[breakpoint].map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
        maxW: item.maxW,
        maxH: item.maxH,
        static: item.static
      }))
    ])
  ) as ResponsiveLayouts<DashboardBreakpoint>
}

export function mergeReactGridLayouts(layout: DashboardLayout, layouts: ResponsiveLayouts<DashboardBreakpoint>): DashboardLayout {
  const byBreakpoint = Object.fromEntries(
    DASHBOARD_BREAKPOINTS.map(breakpoint => {
      const existing = new Map(layout.layouts[breakpoint].map(item => [item.i, item]))
      const nextItems = (layouts[breakpoint] ?? []).map((item: LayoutItem) => {
        const previous = existing.get(item.i)
        if (!previous) return null
        return dashboardGridItemSchema.parse({
          ...previous,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: item.minW ?? previous.minW,
          minH: item.minH ?? previous.minH,
          maxW: item.maxW ?? previous.maxW,
          maxH: item.maxH ?? previous.maxH,
          static: item.static ?? previous.static
        })
      }).filter((item): item is DashboardGridItem => Boolean(item))
      return [breakpoint, nextItems.length > 0 ? nextItems : layout.layouts[breakpoint]]
    })
  )
  return dashboardLayoutSchema.parse({ ...layout, layouts: byBreakpoint, updatedAt: Date.now() })
}

export function updateDashboardWidgetConfig(
  layout: DashboardLayout,
  widgetInstanceId: string,
  config: DashboardWidgetConfig
): DashboardLayout {
  let matched = false
  const layouts = Object.fromEntries(
    DASHBOARD_BREAKPOINTS.map(breakpoint => [
      breakpoint,
      layout.layouts[breakpoint].map(item => {
        if (item.i !== widgetInstanceId) return item
        matched = true
        return dashboardGridItemSchema.parse({
          ...item,
          config: parseDashboardWidgetConfig(item.widgetId, config)
        })
      })
    ])
  )

  if (!matched) throw new Error(`E_NOT_FOUND:dashboard-widget:${widgetInstanceId}`)
  return dashboardLayoutSchema.parse({ ...layout, layouts, updatedAt: Date.now() })
}
