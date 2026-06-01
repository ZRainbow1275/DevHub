import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readPanelPopoutSurface, readPanelPopoutTarget } from './PanelPopoutShell'

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { search } as Location
  })
}

describe('PanelPopoutShell query-param reading', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('reads registered panel + detail surfaces from r8PanelPopout', () => {
    setSearch('?r8PanelPopout=process')
    expect(readPanelPopoutSurface()).toBe('process')

    setSearch('?r8PanelPopout=process-detail')
    expect(readPanelPopoutSurface()).toBe('process-detail')

    setSearch('?r8PanelPopout=port-detail&target=port:8080')
    expect(readPanelPopoutSurface()).toBe('port-detail')
  })

  it('reads the PR3 widget and toolbar surfaces with their targets', () => {
    setSearch('?r8PanelPopout=dashboard-widget&target=widgetId:widget-process-summary')
    expect(readPanelPopoutSurface()).toBe('dashboard-widget')
    expect(readPanelPopoutTarget()).toEqual({ kind: 'widgetId', value: 'widget-process-summary' })

    setSearch('?r8PanelPopout=monitor-toolbar&target=toolbarId:monitor-quick')
    expect(readPanelPopoutSurface()).toBe('monitor-toolbar')
    expect(readPanelPopoutTarget()).toEqual({ kind: 'toolbarId', value: 'monitor-quick' })
  })

  it('returns null for unregistered surfaces', () => {
    setSearch('?r8PanelPopout=port')
    expect(readPanelPopoutSurface()).toBeNull()

    setSearch('')
    expect(readPanelPopoutSurface()).toBeNull()
  })

  it('parses the detach target from the target query param', () => {
    setSearch('?r8PanelPopout=process-detail&target=pid:1234')
    expect(readPanelPopoutTarget()).toEqual({ kind: 'pid', value: '1234' })

    setSearch('?r8PanelPopout=process')
    expect(readPanelPopoutTarget()).toBeNull()
  })
})
