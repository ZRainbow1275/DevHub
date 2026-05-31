import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { APP_SETTINGS_CHANGE_EVENT, DEFAULT_SETTINGS } from '@shared/types'
import type { PopoutBridgeMessage, PortPopoutPositionGetResponse } from '@shared/schemas/r8-runtime'
import type { PortInfo, PortPopoutViewSyncState } from '@shared/types-extended'
import type { PortPopoutPositionSaveRequest } from '@shared/schemas/r8-runtime'
import { usePorts } from '../../hooks/usePorts'
import { resetPortPopoutStore } from '../../stores/portPopoutStore'
import { StatusBar } from '../layout/StatusBar'
import {
  clearPendingPortPopoutRequest,
  createPortPopoutRequestEvent,
  dispatchPortPopoutRequest
} from '../popout/port-popout-events'
import { PortView } from './PortView'

vi.mock('../../hooks/usePorts', () => ({
  usePorts: vi.fn()
}))

vi.mock('./PortRelationshipGraph', () => ({
  PortRelationshipGraph: () => <div data-testid="relationship-graph" />
}))

vi.mock('../ui/PanelSplitter', () => ({
  PanelSplitter: ({ children }: { children: ReactNode }) => <div data-testid="panel-splitter">{children}</div>
}))

const portFixture: PortInfo = {
  port: 3000,
  pid: 4242,
  processName: 'vite',
  state: 'LISTENING',
  protocol: 'TCP',
  localAddress: '127.0.0.1:3000',
  foreignAddress: '*:*'
}

const settingsGetMock = vi.fn(async () => DEFAULT_SETTINGS)
const popoutCreateMock = vi.fn(async () => ({ windowId: 'browser-popout-1' }))
const popoutBridgeMessageMock = vi.fn(async (message: PopoutBridgeMessage) => ({ success: true, windowId: message.windowId }))
const popoutOnBridgeMessageMock = vi.fn((_callback: (message: PopoutBridgeMessage) => void) => vi.fn())
const portPopoutPositionGetMock = vi.fn(async (port: number): Promise<PortPopoutPositionGetResponse> => ({ success: true as const, port, position: null }))
const portPopoutPositionSaveMock = vi.fn(async (input: PortPopoutPositionSaveRequest) => ({
  success: true as const,
  port: input.port,
  position: input.position,
  size: input.size,
  updatedAt: 1700000000000
}))
const releasePortMock = vi.fn(async () => true)
const selectPortMock = vi.fn()

function mockUsePorts(ports: PortInfo[] = [portFixture]) {
  vi.mocked(usePorts).mockReturnValue({
    ports,
    conflicts: [],
    isScanning: false,
    lastScanTime: new Date(1700000000000),
    selectedPort: null,
    scan: vi.fn(async () => ports),
    scanCommon: vi.fn(async () => ports),
    checkPort: vi.fn(async () => null),
    releasePort: releasePortMock,
    findAvailable: vi.fn(async (port: number) => port),
    detectConflicts: vi.fn(async () => []),
    selectPort: selectPortMock,
    getPortByNumber: vi.fn(),
    getCommonPorts: vi.fn(),
    getActiveConflicts: vi.fn(() => []),
    isPortInUse: vi.fn(),
    getTopology: vi.fn(async () => ({ nodes: [], edges: [] })),
    getPortFocusData: vi.fn(async () => null),
    getPortDetailIncremental: vi.fn(async () => ({ data: null, source: 'cache' as const, isStale: true })),
    cancelPortQuery: vi.fn(async () => true)
  })
}

async function renderPortView() {
  render(<PortView />)
  await act(async () => {
    await Promise.resolve()
  })
}

async function renderPortViewWithStatusBar() {
  render(
    <>
      <StatusBar />
      <PortView />
    </>
  )
  await act(async () => {
    await Promise.resolve()
  })
}

describe('PortView R8.B port popout triggers', () => {
  beforeEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
    clearPendingPortPopoutRequest()
    resetPortPopoutStore()
    settingsGetMock.mockResolvedValue(DEFAULT_SETTINGS)
    popoutCreateMock.mockClear()
    popoutBridgeMessageMock.mockReset()
    popoutBridgeMessageMock.mockImplementation(async (message: PopoutBridgeMessage) => ({ success: true, windowId: message.windowId }))
    popoutOnBridgeMessageMock.mockReset()
    popoutOnBridgeMessageMock.mockImplementation((_callback: (message: PopoutBridgeMessage) => void) => vi.fn())
    portPopoutPositionGetMock.mockClear()
    portPopoutPositionGetMock.mockResolvedValue({ success: true, port: 3000, position: null })
    portPopoutPositionSaveMock.mockClear()
    releasePortMock.mockReset()
    releasePortMock.mockResolvedValue(true)
    selectPortMock.mockReset()
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: {
        settings: {
          get: settingsGetMock,
          update: vi.fn(),
        },
        r8: {
          port: {
            getPopoutPosition: portPopoutPositionGetMock,
            savePopoutPosition: portPopoutPositionSaveMock,
          },
          popout: {
            create: popoutCreateMock,
            bridgeMessage: popoutBridgeMessageMock,
            onBridgeMessage: popoutOnBridgeMessageMock,
          },
        },
      },
    })
    mockUsePorts()
  })

  it('opens a floating port card through the explicit click trigger', async () => {
    await renderPortView()

    expect(screen.getByRole('region', { name: '端口列表滚动区域' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))

    const card = screen.getByTestId('port-popout-card-3000-4242')
    expect(card).toBeInTheDocument()
    expect(card).toHaveAttribute('data-r8b-popout-trigger', 'click')
    expect(card).toHaveAttribute('data-r8b-popout-sync-direction', 'both')
    expect(Number(card.getAttribute('data-r8b-popout-z-index'))).toBeGreaterThanOrEqual(4000)
  })

  it('exposes a card edge topology badge that switches to the relationship graph', async () => {
    await renderPortView()

    const graphBadge = screen.getByTestId('port-card-graph-badge-3000-4242')
    expect(graphBadge).toHaveAttribute('data-graph-entry', 'port-card-attached-topology')
    expect(graphBadge).toHaveAttribute('data-graph-kind', 'attached')
    expect(graphBadge).toHaveAttribute('data-graph-scope', 'port')
    expect(graphBadge).toHaveAttribute('data-graph-target-id', '3000')

    fireEvent.click(graphBadge)

    expect(screen.getByTestId('relationship-graph')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('port-attached-topology-section')).toBeInTheDocument())
  })

  it('exposes the required port card fields with security tier evidence', async () => {
    await renderPortView()

    const card = screen.getByTestId('port-card-3000-4242')
    expect(card).toHaveAttribute('data-r8a-fields', 'port,protocol,pid,state,securityTier')

    expect(card.querySelector('[data-port-field="port"]')).toHaveTextContent(':3000')
    expect(card.querySelector('[data-port-field="protocol"]')).toHaveTextContent('TCP')
    expect(card.querySelector('[data-port-field="pid"]')).toHaveTextContent('PID: 4242')
    expect(card.querySelector('[data-port-field="state"]')).toHaveTextContent('监听中')
    expect(card.querySelector('[data-port-field="securityTier"]')).toBeInTheDocument()
    expect(within(card).getByTestId('security-tier-Local')).toBeInTheDocument()
  })

  it('keeps port cards above the R8 breathing-room minimum height', async () => {
    await renderPortView()

    const card = screen.getByTestId('port-card-3000-4242')
    expect(card).toHaveAttribute('data-r8a-density', 'breathing-room')
    expect(card).toHaveAttribute('data-r8a-min-height', '96')
    expect(card.getAttribute('style') ?? '').toContain('min-height: var(--r8a-port-card-min-height, 96px)')
  })

  it('exposes a persisted three-step port module tour', async () => {
    await renderPortView()

    const tour = screen.getByTestId('port-module-tour')
    expect(tour).toHaveAttribute('data-tour-total-steps', '3')
    expect(tour).toHaveAttribute('data-tour-step-id', 'popout')
    expect(tour).toHaveAttribute('data-tour-real-port-count', '1')
    expect(tour).toHaveTextContent(':3000 / PID 4242 / vite')

    fireEvent.click(screen.getByTestId('port-module-tour-next'))
    expect(screen.getByTestId('port-module-tour')).toHaveAttribute('data-tour-step-id', 'security')
    expect(screen.getByTestId('port-module-tour-security-summary')).toHaveTextContent('本机')
    expect(screen.getByTestId('port-module-tour-security-summary')).toHaveTextContent('1')

    fireEvent.click(screen.getByTestId('port-module-tour-next'))
    expect(screen.getByTestId('port-module-tour')).toHaveAttribute('data-tour-step-id', 'relationship')

    fireEvent.click(screen.getByTestId('port-module-tour-done'))
    expect(window.localStorage.getItem('devhub:port-module-tour:v1')).toBe('dismissed')
    expect(screen.queryByTestId('port-module-tour')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('port-module-tour-open-button'))
    expect(screen.getByTestId('port-module-tour')).toHaveAttribute('data-tour-step-id', 'popout')
  })

  it('runs tour actions against the current real port instead of mock examples', async () => {
    await renderPortView()

    fireEvent.click(screen.getByTestId('port-module-tour-action-popout'))
    expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-trigger', 'api')
    await waitFor(() => expect(screen.getByTestId('port-stale-warning')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('port-module-tour-next'))
    fireEvent.click(screen.getByTestId('port-module-tour-action-security'))
    expect(screen.getByTestId('port-view-root')).toHaveAttribute('data-port-view-mode', 'cards')
    expect(screen.getByTestId('port-card-3000-4242')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('port-module-tour-next'))
    fireEvent.click(screen.getByTestId('port-module-tour-action-relationship'))
    await waitFor(() => expect(screen.getByTestId('port-view-root')).toHaveAttribute('data-port-view-mode', 'relationship'))
    expect(screen.getByTestId('relationship-graph')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('port-stale-warning')).toBeInTheDocument())
  })

  it('keeps tour actions disabled when no real ports are scanned', async () => {
    mockUsePorts([])
    await renderPortView()

    const action = screen.getByTestId('port-module-tour-action-popout')
    expect(action).toBeDisabled()
    fireEvent.click(action)

    expect(screen.getByTestId('port-module-tour')).toHaveAttribute('data-tour-real-port-count', '0')
    expect(screen.getByTestId('port-module-tour-no-port')).toHaveTextContent('不创建示例端口')
    expect(document.querySelector('[data-testid^="port-popout-card-"]')).toBeNull()
  })

  it('switches across the three port view modes and persists the choice', async () => {
    await renderPortView()

    const root = screen.getByTestId('port-view-root')
    expect(root).toHaveAttribute('data-port-view-modes', 'cards,list,relationship')
    expect(root).toHaveAttribute('data-port-view-mode', 'cards')
    expect(screen.getByTestId('port-card-3000-4242')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('列表'))
    expect(root).toHaveAttribute('data-port-view-mode', 'list')
    expect(window.localStorage.getItem('devhub:port-view-mode')).toBe('list')
    expect(screen.getByTestId('port-list-item-3000-4242')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('关系图'))
    expect(root).toHaveAttribute('data-port-view-mode', 'relationship')
    expect(window.localStorage.getItem('devhub:port-view-mode')).toBe('relationship')
    expect(screen.getByTestId('relationship-graph')).toBeInTheDocument()
  })

  it('restores the persisted port view mode on mount', async () => {
    window.localStorage.setItem('devhub:port-view-mode', 'list')

    await renderPortView()

    expect(screen.getByTestId('port-view-root')).toHaveAttribute('data-port-view-mode', 'list')
    expect(screen.getByTestId('port-list-item-3000-4242')).toBeInTheDocument()
  })

  it('hydrates remembered popout geometry from the main popout position store bridge', async () => {
    portPopoutPositionGetMock.mockResolvedValueOnce({
      success: true,
      port: 3000,
      position: { x: 220, y: 360 },
      size: { width: 420, height: 340 },
      updatedAt: 1700000000000
    })

    await renderPortView()

    await waitFor(() => {
      expect(portPopoutPositionGetMock).toHaveBeenCalledWith(3000)
      const memory = JSON.parse(window.localStorage.getItem('devhub:r8b:port-popout-position-memory') ?? '{}') as Record<string, unknown>
      expect(memory['port:3000:pid:4242']).toMatchObject({
        position: { x: 220, y: 360 },
        size: { width: 420, height: 340 }
      })
    })

    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))

    await waitFor(() => {
      expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveStyle({
        left: '220px',
        top: '360px',
        width: '420px',
        height: '340px'
      })
    })
  })

  it('requires confirmation before releasing a port from the card', async () => {
    await renderPortView()

    fireEvent.click(screen.getByRole('button', { name: '释放端口' }))

    expect(releasePortMock).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '释放端口' })).toBeInTheDocument()
    expect(screen.getByText('确定要释放端口 3000 吗？这将终止进程 "vite" (PID: 4242)。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(releasePortMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '释放端口' }))
    fireEvent.click(screen.getByRole('button', { name: '释放' }))

    expect(releasePortMock).toHaveBeenCalledTimes(1)
    expect(releasePortMock).toHaveBeenCalledWith(3000)
  })

  it('opens an advanced menu after a long press on the port card', async () => {
    await renderPortView()
    vi.useFakeTimers()

    try {
      const source = screen.getByTestId('port-card-3000-4242')
      fireEvent.pointerDown(source, { clientX: 12, clientY: 12 })

      act(() => {
        vi.advanceTimersByTime(1500)
      })

      const menu = screen.getByTestId('port-advanced-menu-3000-4242')
      expect(menu).toHaveAttribute('data-long-press-threshold-ms', '1500')
      expect(within(menu).getByTestId('port-advanced-menu-graph-3000-4242')).toBeInTheDocument()
      expect(within(menu).getByTestId('port-advanced-menu-popout-3000-4242')).toBeInTheDocument()
      expect(within(menu).getByTestId('port-advanced-menu-release-3000-4242')).toBeInTheDocument()

      fireEvent.click(within(menu).getByTestId('port-advanced-menu-popout-3000-4242'))

      expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-trigger', 'api')
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens a floating port card through context menu and drag threshold triggers', async () => {
    await renderPortView()
    const source = screen.getByTestId('port-card-3000-4242')

    fireEvent.contextMenu(source, { clientX: 240, clientY: 120 })
    expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-trigger', 'context-menu')

    fireEvent.pointerDown(source, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(source, { clientX: 30, clientY: 10 })
    fireEvent.pointerUp(source, { clientX: 30, clientY: 10 })
    expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-trigger', 'drag')
  })

  it('opens a floating port card after the one-second hover trigger delay', async () => {
    vi.useFakeTimers()
    await renderPortView()

    fireEvent.mouseEnter(screen.getByTestId('port-card-3000-4242'), { clientX: 160, clientY: 96 })

    expect(screen.queryByTestId('port-popout-card-3000-4242')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-trigger', 'hover')
  })

  it('opens a real floating port card from the cmdk popout request event', async () => {
    await renderPortView()

    act(() => {
      window.dispatchEvent(createPortPopoutRequestEvent({ port: 3000, trigger: 'cmdk' }))
    })

    const card = screen.getByTestId('port-popout-card-3000-4242')
    expect(card).toBeInTheDocument()
    expect(card).toHaveAttribute('data-r8b-popout-trigger', 'cmdk')
  })

  it('replays a pending cmdk popout request after PortView mounts on the real port list', async () => {
    act(() => {
      dispatchPortPopoutRequest({ port: 3000, trigger: 'cmdk' })
    })

    await renderPortView()

    const card = screen.getByTestId('port-popout-card-3000-4242')
    expect(card).toBeInTheDocument()
    expect(card).toHaveAttribute('data-r8b-popout-trigger', 'cmdk')
  })

  it('ignores cmdk popout requests for unknown ports instead of creating fake popouts', async () => {
    await renderPortView()

    act(() => {
      window.dispatchEvent(createPortPopoutRequestEvent({ port: 3999, trigger: 'cmdk' }))
    })

    expect(document.querySelector('[data-testid^="port-popout-card-"]')).toBeNull()
    expect(screen.getByTestId('port-card-3000-4242')).toBeInTheDocument()
  })

  it('drops a pending unknown-port request on mount instead of replaying a fake popout later', async () => {
    act(() => {
      dispatchPortPopoutRequest({ port: 3999, trigger: 'cmdk' })
    })

    await renderPortView()

    expect(document.querySelector('[data-testid^="port-popout-card-"]')).toBeNull()
    expect(screen.getByTestId('port-card-3000-4242')).toBeInTheDocument()
  })

  it('respects disabled hover and click triggers from persisted settings', async () => {
    vi.useFakeTimers()
    settingsGetMock.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      window: {
        ...DEFAULT_SETTINGS.window,
        portPopout: {
          ...DEFAULT_SETTINGS.window.portPopout,
          triggerEnabled: {
            ...DEFAULT_SETTINGS.window.portPopout.triggerEnabled,
            hover: false,
            click: false,
          },
        },
      },
    })

    await renderPortView()

    const source = screen.getByTestId('port-card-3000-4242')
    const button = screen.getByTestId('port-popout-click-3000-4242')
    expect(button).toBeDisabled()

    fireEvent.mouseEnter(source, { clientX: 160, clientY: 96 })
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.queryByTestId('port-popout-card-3000-4242')).not.toBeInTheDocument()

    fireEvent.contextMenu(source, { clientX: 240, clientY: 120 })
    expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-trigger', 'context-menu')
  })

  it('uses persisted hover delay and drag threshold overrides', async () => {
    vi.useFakeTimers()
    settingsGetMock.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      window: {
        ...DEFAULT_SETTINGS.window,
        portPopout: {
          ...DEFAULT_SETTINGS.window.portPopout,
          hoverDelayMs: 1500,
          dragThresholdPx: 24,
        },
      },
    })

    await renderPortView()

    const source = screen.getByTestId('port-card-3000-4242')
    fireEvent.mouseEnter(source, { clientX: 160, clientY: 96 })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByTestId('port-popout-card-3000-4242')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-trigger', 'hover')

    fireEvent.click(screen.getByTestId('port-popout-close-3000-4242'))
    expect(screen.queryByTestId('port-popout-card-3000-4242')).not.toBeInTheDocument()

    fireEvent.pointerDown(source, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(source, { clientX: 26, clientY: 10 })
    fireEvent.pointerUp(source, { clientX: 26, clientY: 10 })
    expect(screen.queryByTestId('port-popout-card-3000-4242')).not.toBeInTheDocument()

    fireEvent.pointerDown(source, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(source, { clientX: 40, clientY: 10 })
    fireEvent.pointerUp(source, { clientX: 40, clientY: 10 })
    expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-trigger', 'drag')
  })

  it('applies saved popout setting changes in the same renderer session', async () => {
    vi.useFakeTimers()
    await renderPortView()

    act(() => {
      window.dispatchEvent(new CustomEvent(APP_SETTINGS_CHANGE_EVENT, {
        detail: {
          ...DEFAULT_SETTINGS,
          window: {
            ...DEFAULT_SETTINGS.window,
            portPopout: {
              ...DEFAULT_SETTINGS.window.portPopout,
              triggerEnabled: {
                ...DEFAULT_SETTINGS.window.portPopout.triggerEnabled,
                click: false,
              },
              hoverDelayMs: 1500,
              syncPolicyDefault: {
                ...DEFAULT_SETTINGS.window.portPopout.syncPolicyDefault,
                direction: 'isolated',
              },
            },
          },
        },
      }))
    })

    const source = screen.getByTestId('port-card-3000-4242')
    const button = screen.getByTestId('port-popout-click-3000-4242')
    expect(button).toBeDisabled()

    fireEvent.mouseEnter(source, { clientX: 160, clientY: 96 })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByTestId('port-popout-card-3000-4242')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    const card = screen.getByTestId('port-popout-card-3000-4242')
    expect(card).toHaveAttribute('data-r8b-popout-trigger', 'hover')
    expect(card).toHaveAttribute('data-r8b-popout-sync-direction', 'isolated')
  })

  it('uses persisted sync policy defaults for new popouts after settings load', async () => {
    settingsGetMock.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      window: {
        ...DEFAULT_SETTINGS.window,
        portPopout: {
          ...DEFAULT_SETTINGS.window.portPopout,
          syncPolicyDefault: {
            ...DEFAULT_SETTINGS.window.portPopout.syncPolicyDefault,
            direction: 'main-to-popout',
          },
        },
      },
    })

    await renderPortView()

    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))
    expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveAttribute('data-r8b-popout-sync-direction', 'main-to-popout')
  })

  it('syncs port view state through the real popout bridge key with debounce', async () => {
    vi.useFakeTimers()
    let bridgeCallback: ((message: PopoutBridgeMessage) => void) | null = null
    popoutOnBridgeMessageMock.mockImplementation((callback: (message: PopoutBridgeMessage) => void) => {
      bridgeCallback = callback
      return vi.fn()
    })

    try {
      await renderPortView()

      fireEvent.change(screen.getByPlaceholderText('搜索端口...'), { target: { value: '3000' } })
      fireEvent.click(screen.getByTitle('列表'))

      act(() => {
        vi.advanceTimersByTime(130)
      })

      const lastCall = popoutBridgeMessageMock.mock.calls.at(-1)?.[0]
      expect(lastCall).toMatchObject({
        type: 'sync',
        key: 'port-view-state',
        value: expect.objectContaining({
          selectedPort: null,
          filter: 'all',
          searchPort: '3000',
          viewMode: 'list'
        })
      })

      act(() => {
        bridgeCallback?.({
          windowId: 'browser-popout-1',
          type: 'sync',
          key: 'port-view-state',
          value: {
            selectedPort: 3000,
            filter: 'exposed',
            searchPort: '42',
            viewMode: 'relationship'
          } satisfies PortPopoutViewSyncState
        })
      })

      expect(screen.getByTestId('port-view-root')).toHaveAttribute('data-port-view-mode', 'relationship')
      expect(screen.getByPlaceholderText('搜索端口...')).toHaveValue('42')
      expect(selectPortMock).toHaveBeenCalledWith(3000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('isolates and restores popout theme sync from the real titlebar action', async () => {
    settingsGetMock.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      window: {
        ...DEFAULT_SETTINGS.window,
        portPopout: {
          ...DEFAULT_SETTINGS.window.portPopout,
          syncPolicyDefault: {
            ...DEFAULT_SETTINGS.window.portPopout.syncPolicyDefault,
            direction: 'main-to-popout',
          },
        },
      },
    })

    await renderPortView()

    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))
    const card = screen.getByTestId('port-popout-card-3000-4242')
    const isolateButton = screen.getByTestId('port-popout-theme-isolate-3000-4242')
    expect(card).toHaveAttribute('data-r8b-popout-theme-isolated', 'false')
    expect(card).toHaveAttribute('data-r8b-popout-sync-direction', 'main-to-popout')
    expect(card).toHaveAttribute('data-r8b-popout-sync-theme', 'true')
    expect(isolateButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(isolateButton)
    expect(card).toHaveAttribute('data-r8b-popout-theme-isolated', 'true')
    expect(card).toHaveAttribute('data-r8b-popout-sync-direction', 'isolated')
    expect(card).toHaveAttribute('data-r8b-popout-sync-theme', 'false')
    expect(isolateButton).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(isolateButton)
    expect(card).toHaveAttribute('data-r8b-popout-theme-isolated', 'false')
    expect(card).toHaveAttribute('data-r8b-popout-sync-direction', 'main-to-popout')
    expect(card).toHaveAttribute('data-r8b-popout-sync-theme', 'true')
    expect(isolateButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('closes floating port cards without removing the source port card', async () => {
    await renderPortView()

    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))
    expect(screen.getByTestId('port-popout-card-3000-4242')).toBeInTheDocument()
    expect(screen.queryByTestId('port-popout-pin-3000-4242')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('port-popout-close-3000-4242'))
    expect(screen.queryByTestId('port-popout-card-3000-4242')).not.toBeInTheDocument()
    expect(screen.getByTestId('port-card-3000-4242')).toBeInTheDocument()
  })

  it('minimizes floating port card content while preserving the active statusbar count', async () => {
    await renderPortViewWithStatusBar()

    const popoutTile = () => screen.getByTestId('status-tile-popouts')
    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))
    await waitFor(() => {
      expect(popoutTile()).toHaveAttribute('data-status-value', '1')
    })

    const card = screen.getByTestId('port-popout-card-3000-4242')
    const minimizeButton = screen.getByTestId('port-popout-minimize-3000-4242')
    expect(card).toHaveAttribute('data-r8b-popout-state', 'expanded')
    expect(screen.getByTestId('port-popout-body-3000-4242')).toBeInTheDocument()
    expect(minimizeButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(minimizeButton)
    expect(card).toHaveAttribute('data-r8b-popout-state', 'minimized')
    expect(card).toHaveAttribute('data-r8b-popout-minimized', 'true')
    expect(screen.queryByTestId('port-popout-body-3000-4242')).not.toBeInTheDocument()
    expect(popoutTile()).toHaveAttribute('data-status-value', '1')
    expect(popoutTile()).toHaveAttribute('data-status-badge-value', '1')
    expect(minimizeButton).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(minimizeButton)
    expect(card).toHaveAttribute('data-r8b-popout-state', 'expanded')
    expect(screen.getByTestId('port-popout-body-3000-4242')).toBeInTheDocument()
    expect(popoutTile()).toHaveAttribute('data-status-value', '1')
    expect(minimizeButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('resizes a floating port card and restores the same-port size on reopen', async () => {
    await renderPortView()

    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))
    expect(screen.getByTestId('port-popout-titlebar-3000-4242')).toBeInTheDocument()

    const resizeHandle = screen.getByTestId('port-popout-resize-se-3000-4242')
    fireEvent.pointerDown(resizeHandle, { clientX: 360, clientY: 280 })
    fireEvent.pointerMove(window, { clientX: 420, clientY: 340 })
    fireEvent.pointerUp(window)

    await waitFor(() => {
      expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveStyle({
        width: '420px',
        height: '340px',
      })
      expect(portPopoutPositionSaveMock).toHaveBeenCalledWith(expect.objectContaining({
        port: 3000,
        position: expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number)
        }),
        size: expect.objectContaining({
          width: 420,
          height: 340
        })
      }))
    })

    fireEvent.click(screen.getByTestId('port-popout-close-3000-4242'))
    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))

    await waitFor(() => {
      expect(screen.getByTestId('port-popout-card-3000-4242')).toHaveStyle({
        width: '420px',
        height: '340px',
      })
    })
  })

  it('closes the renderer floating card after BrowserWindow promotion succeeds', async () => {
    await renderPortView()

    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))
    expect(screen.getByTestId('port-popout-card-3000-4242')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('port-popout-promote-3000-4242'))

    await waitFor(() => {
      expect(popoutCreateMock).toHaveBeenCalledWith(expect.objectContaining({
        surface: 'port',
        targetId: 3000,
        mode: 'browserwindow',
      }))
      expect(screen.queryByTestId('port-popout-card-3000-4242')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('port-card-3000-4242')).toBeInTheDocument()
  })

  it('updates the statusbar popout tile when floating cards open and close', async () => {
    await renderPortViewWithStatusBar()

    const popoutTile = () => screen.getByTestId('status-tile-popouts')
    expect(popoutTile()).toHaveAttribute('data-status-value', '0')

    fireEvent.click(screen.getByTestId('port-popout-click-3000-4242'))
    await waitFor(() => {
      expect(popoutTile()).toHaveAttribute('data-status-value', '1')
      expect(popoutTile()).toHaveAttribute('data-status-badge-value', '1')
    })

    fireEvent.click(screen.getByTestId('port-popout-close-3000-4242'))
    await waitFor(() => {
      expect(popoutTile()).toHaveAttribute('data-status-value', '0')
      expect(popoutTile()).toHaveAttribute('data-status-badge-value', '0')
    })
  })
})
