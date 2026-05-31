import { describe, expect, it } from 'vitest'
import {
  clampLayoutsForBreakpoint,
  clampTileWidth,
  createDashboardLayout,
  DASHBOARD_BREAKPOINTS,
  DEFAULT_WIDGET_IDS,
  mergeReactGridLayouts,
  toReactGridLayouts,
  updateDashboardWidgetConfig
} from './dashboard-model'
import { parseDashboardWidgetConfig } from './dashboard-widget-config'

describe('R8.B dashboard model', () => {
  it('creates a responsive default layout with eight real widget ids', () => {
    const layout = createDashboardLayout()

    expect(layout.layouts.md).toHaveLength(8)
    expect(layout.layouts.md.map(item => item.widgetId)).toEqual(DEFAULT_WIDGET_IDS)
    for (const breakpoint of DASHBOARD_BREAKPOINTS) {
      expect(layout.layouts[breakpoint].length).toBeGreaterThanOrEqual(6)
      expect(layout.cols[breakpoint]).toBeGreaterThan(0)
    }
  })

  it('merges react-grid-layout positions without losing widget identity', () => {
    const layout = createDashboardLayout()
    const gridLayouts = toReactGridLayouts(layout)
    const first = gridLayouts.md?.[0]
    if (!first) throw new Error('missing md layout item')
    const next = mergeReactGridLayouts(layout, {
      ...gridLayouts,
      md: [{ ...first, x: 5, y: 6, w: 4, h: 3 }]
    })

    expect(next.layouts.md[0]).toMatchObject({
      i: first.i,
      widgetId: 'process-summary',
      x: 5,
      y: 6,
      w: 4,
      h: 3
    })
  })

  it('persists widget config across every responsive breakpoint', () => {
    const layout = createDashboardLayout()
    const next = updateDashboardWidgetConfig(layout, 'widget-process-summary', { maxRows: 7 })

    for (const breakpoint of DASHBOARD_BREAKPOINTS) {
      const item = next.layouts[breakpoint].find(candidate => candidate.i === 'widget-process-summary')
      expect(item?.config).toEqual({ maxRows: 7 })
    }
  })

  it('normalizes widget config values through widget-specific schemas', () => {
    expect(parseDashboardWidgetConfig('notifications', { maxRows: '3', minTone: 'danger' })).toEqual({
      maxRows: 3,
      minTone: 'danger'
    })
    expect(() => parseDashboardWidgetConfig('treemap-mini', { maxRows: 99 })).toThrow()
  })

  it('clampTileWidth returns w when within cols and shrinks otherwise', () => {
    expect(clampTileWidth(3, 8)).toBe(3)
    expect(clampTileWidth(12, 4)).toBe(4)
    expect(clampTileWidth(1, 4)).toBe(1)
    expect(clampTileWidth(0, 4)).toBe(1)
  })

  it('clampLayoutsForBreakpoint clamps x when x+w overflows cols', () => {
    const layout = createDashboardLayout()
    const gridLayouts = toReactGridLayouts(layout)
    const xsItems = gridLayouts.xs ?? []
    // tile at x:7 w:3 in a cols=4 breakpoint: w clamps to 3 (<=4), but x+w=10>4
    const overflowX = { ...xsItems[0], w: 3, x: 7 }
    const next = clampLayoutsForBreakpoint({ ...gridLayouts, xs: [overflowX, ...xsItems.slice(1)] }, 'xs')
    // cols=4, w=3 => x should be max(0, 4-3) = 1
    expect(next.xs?.[0].w).toBe(3)
    expect(next.xs?.[0].x).toBe(1)
  })

  it('clampLayoutsForBreakpoint shrinks tiles wider than current breakpoint cols', () => {
    const layout = createDashboardLayout()
    const gridLayouts = toReactGridLayouts(layout)
    const xsItems = gridLayouts.xs ?? []
    const oversized = { ...xsItems[0], w: 10, x: 0 }
    const next = clampLayoutsForBreakpoint({ ...gridLayouts, xs: [oversized, ...xsItems.slice(1)] }, 'xs')
    expect(next.xs?.[0].w).toBe(4)
    expect(next.xs?.[0].x).toBe(0)
  })
})
