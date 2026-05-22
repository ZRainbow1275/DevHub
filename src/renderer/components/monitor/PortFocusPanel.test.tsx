import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortDetailIncrementalResult, PortInfo } from '@shared/types-extended'
import { PortFocusPanel } from './PortFocusPanel'

const basePort: PortInfo = {
  port: 3000,
  pid: 4242,
  processName: 'vite',
  state: 'LISTENING',
  protocol: 'TCP',
  localAddress: '127.0.0.1',
  foreignAddress: '*:*'
}

const siblingPort: PortInfo = {
  port: 5173,
  pid: 4242,
  processName: 'vite',
  state: 'LISTENING',
  protocol: 'TCP',
  localAddress: '127.0.0.1',
  foreignAddress: '*:*'
}

function renderPanel(result: PortDetailIncrementalResult) {
  const getPortFocusData = vi.fn().mockResolvedValue(null)
  const getPortDetailIncremental = vi.fn().mockResolvedValue(result)
  const cancelPortQuery = vi.fn().mockResolvedValue(true)

  render(
    <PortFocusPanel
      port={basePort}
      onClose={vi.fn()}
      getPortFocusData={getPortFocusData}
      getPortDetailIncremental={getPortDetailIncremental}
      cancelPortQuery={cancelPortQuery}
      allPorts={[basePort, siblingPort]}
      lastScanTime={new Date(Date.now() - 5000)}
    />
  )

  return {
    getPortFocusData,
    getPortDetailIncremental,
    cancelPortQuery
  }
}

describe('PortFocusPanel', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('超时时显示完整降级文案，并允许重试', async () => {
    const { getPortDetailIncremental } = renderPanel({
      data: null,
      source: 'timeout',
      isStale: true
    })

    expect(await screen.findByText(/查询超时/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    await waitFor(() => {
      expect(getPortDetailIncremental).toHaveBeenCalledTimes(2)
    })
  })

  it('切换轻量模式后显示轻量模式提示并保留快照数据', async () => {
    renderPanel({
      data: null,
      source: 'timeout',
      isStale: true
    })

    const checkbox = await screen.findByRole('checkbox')
    fireEvent.click(checkbox)

    expect(await screen.findByText(/已切换到轻量模式/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByText(/关联端口/)).toBeInTheDocument()
  })

  it('缓存优先返回 stale 数据时顶部显示 warning 且不空白', async () => {
    renderPanel({
      data: null,
      source: 'cache',
      isStale: true
    })

    const staleWarning = await screen.findByTestId('port-stale-warning')
    expect(staleWarning).toHaveAttribute('data-stale-source', 'cache')
    expect(staleWarning).toHaveAttribute('data-stale-position', 'top')
    expect(staleWarning).toHaveTextContent('显示缓存数据')
    expect(screen.getByText(/关联端口/)).toBeInTheDocument()
    expect(screen.getByTestId('port-attached-topology-section')).toBeInTheDocument()
  })

  it('exposes a header attached graph button that focuses the real relation section', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    })

    renderPanel({
      data: null,
      source: 'incremental',
      isStale: false
    })

    fireEvent.click(await screen.findByTestId('port-attached-topology-button'))

    const relationSection = screen.getByTestId('port-attached-topology-section')
    expect(relationSection).toHaveAttribute('data-graph-entry', 'port-focus-attached-panel')
    expect(relationSection).toHaveAttribute('data-graph-kind', 'attached')
    expect(screen.getByTestId('attached-graph-view')).toHaveAttribute('data-root-kind', 'port')
    expect(screen.getByTestId('attached-graph-view')).toHaveAttribute('data-root-id', '3000')
    expect(screen.getByTestId('attached-flow-view')).toHaveAttribute('data-root-kind', 'port')
    expect(screen.getByTestId('attached-flow-view')).toHaveAttribute('data-root-id', '3000')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(relationSection).toHaveFocus()
  })

  it('opens the global topology with the selected real port node id', async () => {
    const events: Event[] = []
    const openGlobal = (event: Event) => events.push(event)
    window.addEventListener('devhub:open-topology-global', openGlobal)

    renderPanel({
      data: null,
      source: 'incremental',
      isStale: false
    })

    fireEvent.click(await screen.findByTestId('port-global-topology-button'))

    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('port-3000-4242-TCP')
    expect(events).toHaveLength(1)

    window.removeEventListener('devhub:open-topology-global', openGlobal)
  })

  it('detaches the focus panel through the real popout bridge contract', async () => {
    const createPopout = vi.fn().mockResolvedValue({
      windowId: 'port-focus-popout-1',
      surface: 'port',
      targetId: 3000,
      mode: 'browserwindow',
      route: '/monitor?view=ports&port=3000&panel=focus',
      title: 'DevHub Port 3000 Focus',
      pinned: false,
      bounds: null,
      createdAt: 1700000000000,
    })

    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: {
        r8: {
          popout: {
            create: createPopout,
          },
        },
      },
    })

    renderPanel({
      data: null,
      source: 'incremental',
      isStale: false
    })

    const panel = await screen.findByTestId('port-focus-panel')
    expect(panel).toHaveAttribute('data-detach-capability', 'browserwindow-popout')

    const detachButton = screen.getByTestId('port-focus-detach-popout-button')
    expect(detachButton).toHaveAttribute('data-r8b-detach-surface', 'browserwindow')

    fireEvent.click(detachButton)

    await waitFor(() => {
      expect(createPopout).toHaveBeenCalledWith({
        surface: 'port',
        targetId: 3000,
        mode: 'browserwindow',
        route: '/monitor?view=ports&port=3000&panel=focus',
        bounds: {
          x: 96,
          y: 96,
          width: 520,
          height: 720,
        },
        title: 'DevHub Port 3000 Focus',
      })
    })

    expect(await screen.findByTestId('port-focus-detach-state')).toHaveAttribute('data-detach-state', 'detached')
  })
})
