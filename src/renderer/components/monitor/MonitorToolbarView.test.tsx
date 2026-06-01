import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MonitorToolbarView, monitorToolbarTitle } from './MonitorToolbarView'

const ORIGINAL_SEARCH = window.location.search

function setSearch(search: string): void {
  window.history.replaceState(null, '', `${window.location.pathname}${search}`)
}

describe('MonitorToolbarView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setSearch(ORIGINAL_SEARCH)
    delete (window as { devhub?: unknown }).devhub
  })

  it('dispatches a local navigate event when rendered inline in the main window', () => {
    const listener = vi.fn()
    window.addEventListener('devhub:monitor-navigate', listener)

    render(<MonitorToolbarView initialTarget={{ kind: 'toolbarId', value: 'monitor-quick' }} />)

    expect(screen.getByTestId('monitor-toolbar-view')).toHaveAttribute('data-r8c-toolbar', 'monitor-quick')

    fireEvent.click(screen.getByTestId('monitor-toolbar-action-port'))

    expect(listener).toHaveBeenCalledTimes(1)
    const event = listener.mock.calls[0][0] as CustomEvent<{ tab?: string }>
    expect(event.detail?.tab).toBe('port')

    window.removeEventListener('devhub:monitor-navigate', listener)
  })

  it('routes through the main-process command bridge when detached in a popout', () => {
    setSearch('?r8PanelPopout=monitor-toolbar')
    const invoke = vi.fn().mockResolvedValue({ success: true, commandId: 'monitor.port' })
    ;(window as { devhub?: unknown }).devhub = { r8: { command: { invoke } } }
    const localListener = vi.fn()
    window.addEventListener('devhub:monitor-navigate', localListener)

    render(<MonitorToolbarView initialTarget={{ kind: 'toolbarId', value: 'monitor-quick' }} />)
    fireEvent.click(screen.getByTestId('monitor-toolbar-action-port'))

    // Cross-process hop: the command bridge is used, NOT a local event that would
    // be trapped inside the popout window and never reach the main window.
    expect(invoke).toHaveBeenCalledWith('monitor.port')
    expect(localListener).not.toHaveBeenCalled()

    window.removeEventListener('devhub:monitor-navigate', localListener)
  })

  it('falls back to the local navigate event when detached but the command bridge is absent', () => {
    setSearch('?r8PanelPopout=monitor-toolbar')
    const localListener = vi.fn()
    window.addEventListener('devhub:monitor-navigate', localListener)

    render(<MonitorToolbarView initialTarget={{ kind: 'toolbarId', value: 'monitor-quick' }} />)
    fireEvent.click(screen.getByTestId('monitor-toolbar-action-topology'))

    expect(localListener).toHaveBeenCalledTimes(1)
    const event = localListener.mock.calls[0][0] as CustomEvent<{ tab?: string }>
    expect(event.detail?.tab).toBe('topology')

    window.removeEventListener('devhub:monitor-navigate', localListener)
  })

  it('defaults to the monitor-quick toolbar when no target is provided', () => {
    render(<MonitorToolbarView initialTarget={null} />)
    expect(screen.getByTestId('monitor-toolbar-view')).toHaveAttribute('data-r8c-toolbar', 'monitor-quick')
  })

  it('degrades to an honest notice for an unknown toolbar id', () => {
    render(<MonitorToolbarView initialTarget={{ kind: 'toolbarId', value: 'nope' }} />)
    expect(screen.getByTestId('monitor-toolbar-view')).toHaveTextContent('未知功能栏 nope')
  })

  it('resolves localized toolbar titles', () => {
    expect(monitorToolbarTitle('monitor-quick')).toBe('监控快捷栏')
    expect(monitorToolbarTitle('unknown')).toBe('监控功能栏')
    expect(monitorToolbarTitle(null)).toBe('监控功能栏')
  })
})
