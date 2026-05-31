import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserPopout, DrawerSlot, DrawerState } from '@shared/schemas/r8-runtime'
import { DrawerProvider } from './DrawerProvider'
import { DrawerSystemHost } from './DrawerSystemHost'
import { BUILTIN_DRAWER_CONTENTS, createDefaultDrawerStateMap } from './drawer-model'
import { useDrawerStore } from '../../stores/drawerStore'

describe('R8.B drawer host', () => {
  beforeEach(() => {
    delete (window.devhub as { r8?: unknown }).r8
    useDrawerStore.setState({
      states: createDefaultDrawerStateMap(1700000000000),
      hydrated: false,
      error: null
    })
  })

  it('opens top, right, bottom, floating, and statusbar slots simultaneously', async () => {
    render(
      <DrawerProvider>
        <DrawerSystemHost>
          <main data-testid="drawer-main">main</main>
        </DrawerSystemHost>
      </DrawerProvider>
    )

    // DrawerLauncherRail was moved to Sidebar (S1); open drawers via store directly
    for (const slot of ['top', 'right', 'bottom', 'floating', 'statusbar'] as const) {
      await act(async () => {
        await useDrawerStore.getState().setOpen(slot as DrawerSlot, true)
      })
    }

    expect(screen.getByTestId('drawer-top')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-right')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-bottom')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-floating')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-statusbar')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-right')).toHaveAttribute('data-r8b-drawer-z-index', '2010')
  })

  it('resizes and persists a right drawer through the renderer store bridge', async () => {
    const setState = vi.fn(async (state: unknown) => state)
    Object.assign(window.devhub, {
      r8: {
        drawer: {
          getState: vi.fn(async () => []),
          setState
        },
      command: {
        onEvent: vi.fn()
      },
      processViews: {
        treeChildren: vi.fn()
      }
    }
  })

    render(
      <DrawerProvider>
        <DrawerSystemHost>
          <main data-testid="drawer-main">main</main>
        </DrawerSystemHost>
      </DrawerProvider>
    )

    // DrawerLauncherRail was moved to Sidebar (S1); open drawer via store directly
    await act(async () => {
      await useDrawerStore.getState().setOpen('right', true)
    })
    const handle = screen.getByTestId('drawer-right-resize-handle')

    await act(async () => {
      fireEvent.pointerDown(handle, { clientX: 400, clientY: 10, pointerId: 1 })
    })
    await act(async () => {
      fireEvent.pointerMove(window, { clientX: 300, clientY: 10 })
      fireEvent.pointerUp(window)
    })

    await waitFor(() => expect(setState).toHaveBeenCalled())
    const lastCall = setState.mock.calls.at(-1)?.[0] as { width?: number; size?: number }
    expect(lastCall.size).toBe(460)
    expect(lastCall.width).toBe(460)
  })

  it('lazy loads registered drawer content from the runtime bridge', async () => {
    const listNotifications = vi.fn(async () => [{
      id: 'notification-real-1',
      level: 'INFO',
      source: 'runtime',
      title: '真实通知',
      body: '来自 devhub bridge 的通知记录'
    }])
    Object.assign(window.devhub, {
      r8: {
        drawer: {
          getState: vi.fn(async () => []),
          setState: vi.fn(async (state: unknown) => state)
        },
        notify: {
          list: listNotifications
        },
        command: {
          onEvent: vi.fn()
        },
        processViews: {
          treeChildren: vi.fn()
        }
      }
    })

    render(
      <DrawerProvider>
        <DrawerSystemHost>
          <main data-testid="drawer-main">main</main>
        </DrawerSystemHost>
      </DrawerProvider>
    )

    // DrawerLauncherRail was moved to Sidebar (S1); open drawer via store directly
    await act(async () => {
      await useDrawerStore.getState().setOpen('top', true)
    })

    expect(await screen.findByText('真实通知')).toBeInTheDocument()
    expect(listNotifications).toHaveBeenCalledTimes(1)
    expect(screen.getByText('来自 devhub bridge 的通知记录')).toBeInTheDocument()
    expect(screen.getByText('真实通知').closest('[data-r8b-drawer-lazy-content]')).toHaveAttribute(
      'data-r8b-drawer-lazy-content',
      BUILTIN_DRAWER_CONTENTS.TOP_NOTIFICATIONS
    )
  })

  it('renders a truthful lazy boundary for registered content without a dedicated renderer', async () => {
    render(
      <DrawerProvider>
        <DrawerSystemHost>
          <main data-testid="drawer-main">main</main>
        </DrawerSystemHost>
      </DrawerProvider>
    )

    await act(async () => {
      await useDrawerStore.getState().setContent('right', BUILTIN_DRAWER_CONTENTS.RIGHT_SETTINGS)
    })

    expect(await screen.findByText(/该状态不会生成模拟数据/)).toBeInTheDocument()
    const boundary = screen.getByText(/该状态不会生成模拟数据/).closest('[data-r8b-drawer-content-status]')
    expect(boundary).toHaveAttribute('data-r8b-drawer-content-status', 'registered-boundary')
  })

  it('returns an active BrowserWindow popout into a real drawer slot through the bridge', async () => {
    const now = 1700000000000
    const popout = {
      windowId: 'popout-drawer-return',
      surface: 'port',
      targetId: BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_PORT,
      mode: 'browserwindow',
      route: '/monitor',
      title: 'Port detail BrowserWindow',
      pinned: false,
      bounds: { x: 10, y: 20, width: 420, height: 320 },
      createdAt: now,
      lastInteractedAt: now,
      lastHeartbeatAt: now,
      bridgeState: 'connected'
    } satisfies BrowserPopout
    const drawerState = {
      slot: 'right',
      open: true,
      pinned: false,
      size: 360,
      width: 360,
      contentId: BUILTIN_DRAWER_CONTENTS.RIGHT_DETAIL_PORT,
      scope: 'global',
      updatedAt: now + 1
    } satisfies DrawerState
    const listPopouts = vi.fn()
      .mockResolvedValueOnce([popout])
      .mockResolvedValueOnce([{ ...popout, bridgeState: 'closed' } satisfies BrowserPopout])
    const morphFromPopout = vi.fn(async () => ({ drawerState }))

    Object.assign(window.devhub, {
      r8: {
        drawer: {
          getState: vi.fn(async () => []),
          setState: vi.fn(async (state: unknown) => state),
          morphFromPopout
        },
        popout: {
          list: listPopouts
        },
        command: {
          onEvent: vi.fn()
        },
        processViews: {
          treeChildren: vi.fn()
        }
      }
    })

    render(
      <DrawerProvider>
        <DrawerSystemHost>
          <main data-testid="drawer-main">main</main>
        </DrawerSystemHost>
      </DrawerProvider>
    )

    // DrawerLauncherRail was moved to Sidebar (S1); open drawer via store directly
    await act(async () => {
      await useDrawerStore.getState().setOpen('floating', true)
    })

    expect(await screen.findByText('Port detail BrowserWindow')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByTestId('popout-return-drawer-popout-drawer-return'))
    })

    await waitFor(() => expect(morphFromPopout).toHaveBeenCalledWith('popout-drawer-return', 'right'))
    expect(await screen.findByTestId('drawer-right')).toBeInTheDocument()
    expect(screen.getAllByText('端口详情').length).toBeGreaterThan(0)
    expect(screen.queryByText('Port detail BrowserWindow')).not.toBeInTheDocument()
  })
})
