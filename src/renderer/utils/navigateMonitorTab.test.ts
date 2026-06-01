import { afterEach, describe, expect, it, vi } from 'vitest'
import { isInsidePanelPopout, isMonitorTab, navigateMonitorTab } from './navigateMonitorTab'

const ORIGINAL_SEARCH = window.location.search

function setSearch(search: string): void {
  window.history.replaceState(null, '', `${window.location.pathname}${search}`)
}

describe('navigateMonitorTab', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setSearch(ORIGINAL_SEARCH)
    delete (window as { devhub?: unknown }).devhub
  })

  it('classifies known monitor tabs', () => {
    expect(isMonitorTab('process')).toBe(true)
    expect(isMonitorTab('ai-task')).toBe(true)
    expect(isMonitorTab('r8-ops')).toBe(true)
    expect(isMonitorTab('nope')).toBe(false)
    expect(isMonitorTab(undefined)).toBe(false)
  })

  it('reports popout context from the r8PanelPopout query param', () => {
    expect(isInsidePanelPopout()).toBe(false)
    setSearch('?r8PanelPopout=process-detail')
    expect(isInsidePanelPopout()).toBe(true)
  })

  it('dispatches local navigate (and open-monitor) when running in the main window', () => {
    const navigate = vi.fn()
    const openMonitor = vi.fn()
    window.addEventListener('devhub:monitor-navigate', navigate)
    window.addEventListener('devhub:open-monitor', openMonitor)

    navigateMonitorTab('process', { detail: { pid: 4242 } })

    expect(openMonitor).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledTimes(1)
    const event = navigate.mock.calls[0][0] as CustomEvent<{ tab?: string; pid?: number }>
    expect(event.detail?.tab).toBe('process')
    expect(event.detail?.pid).toBe(4242)

    window.removeEventListener('devhub:monitor-navigate', navigate)
    window.removeEventListener('devhub:open-monitor', openMonitor)
  })

  it('can suppress the open-monitor event', () => {
    const openMonitor = vi.fn()
    window.addEventListener('devhub:open-monitor', openMonitor)

    navigateMonitorTab('port', { openMonitor: false })

    expect(openMonitor).not.toHaveBeenCalled()
    window.removeEventListener('devhub:open-monitor', openMonitor)
  })

  it('routes through the command bridge when detached in a popout', () => {
    setSearch('?r8PanelPopout=process-detail')
    const invoke = vi.fn().mockResolvedValue({ success: true, commandId: 'monitor.process' })
    ;(window as { devhub?: unknown }).devhub = { r8: { command: { invoke } } }
    const localListener = vi.fn()
    window.addEventListener('devhub:monitor-navigate', localListener)

    navigateMonitorTab('process', { detail: { pid: 99 } })

    expect(invoke).toHaveBeenCalledWith('monitor.process')
    // The local event would be trapped inside the popout and never reach the main
    // window, so it must NOT be used on the happy path.
    expect(localListener).not.toHaveBeenCalled()

    window.removeEventListener('devhub:monitor-navigate', localListener)
  })

  it('falls back to the local event when detached and the bridge is absent', () => {
    setSearch('?r8PanelPopout=window-detail')
    const localListener = vi.fn()
    window.addEventListener('devhub:monitor-navigate', localListener)

    navigateMonitorTab('window')

    expect(localListener).toHaveBeenCalledTimes(1)
    const event = localListener.mock.calls[0][0] as CustomEvent<{ tab?: string }>
    expect(event.detail?.tab).toBe('window')

    window.removeEventListener('devhub:monitor-navigate', localListener)
  })

  it('falls back to the local event when detached and the bridge invoke rejects', async () => {
    setSearch('?r8PanelPopout=port-detail')
    const invoke = vi.fn().mockRejectedValue(new Error('E_COMMAND_NOT_FOUND'))
    ;(window as { devhub?: unknown }).devhub = { r8: { command: { invoke } } }
    const localListener = vi.fn()
    window.addEventListener('devhub:monitor-navigate', localListener)

    navigateMonitorTab('process', { detail: { pid: 7 } })

    expect(invoke).toHaveBeenCalledWith('monitor.process')
    // The catch() degrades to the local event so the action never silently dies.
    await vi.waitFor(() => expect(localListener).toHaveBeenCalledTimes(1))
    const event = localListener.mock.calls[0][0] as CustomEvent<{ tab?: string; pid?: number }>
    expect(event.detail?.tab).toBe('process')
    expect(event.detail?.pid).toBe(7)

    window.removeEventListener('devhub:monitor-navigate', localListener)
  })
})
