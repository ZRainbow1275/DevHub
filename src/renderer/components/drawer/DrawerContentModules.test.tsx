import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserPopout } from '@shared/schemas/r8-runtime'
import type { PortInfo } from '@shared/types-extended'
import { DEFAULT_PORT_POPOUT_SYNC_POLICY } from '@shared/types'
import {
  LogsDrawerContent,
  PopoutManagerDrawerContent,
  TerminalDrawerContent,
  VersionBannerDrawerContent,
  RegisteredBoundaryDrawerContent
} from './DrawerContentModules'
import { getDrawerContentDefinition } from './drawer-model'
import { useProjectStore } from '../../stores/projectStore'
import { usePortPopoutStore } from '../../stores/portPopoutStore'
import type { PortPopout } from '../popout/port-popout-model'

function portCardFixture(overrides: Partial<PortPopout> = {}): PortPopout {
  const now = 1700000000000
  return {
    id: 'card-1',
    port: { port: 8080, pid: 4321 } as PortInfo,
    trigger: 'hover',
    mode: 'floating',
    position: { x: 0, y: 0 },
    size: { width: 320, height: 240 },
    zIndex: 1,
    pinned: false,
    minimized: false,
    themeIsolated: false,
    syncPolicy: DEFAULT_PORT_POPOUT_SYNC_POLICY,
    createdAt: now,
    lastInteractedAt: now,
    ...overrides
  }
}

function browserPopoutFixture(overrides: Partial<BrowserPopout> = {}): BrowserPopout {
  const now = 1700000000000
  return {
    windowId: 'popout-process',
    surface: 'process',
    targetId: 'r8-panel-process',
    mode: 'browserwindow',
    route: '/panel/process',
    title: 'DevHub process',
    pinned: false,
    bounds: null,
    createdAt: now,
    lastInteractedAt: now,
    lastHeartbeatAt: now,
    bridgeState: 'connected',
    ...overrides
  }
}

describe('R8.B drawer real content renderers', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devhub', { configurable: true, value: {} })
    useProjectStore.setState({ projects: [], selectedProjectId: null })
    usePortPopoutStore.getState().resetPopoutSlice()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    usePortPopoutStore.getState().resetPopoutSlice()
  })

  it('version banner reads system.getVersion and shows the app version', async () => {
    Object.assign(window.devhub, {
      system: {
        getVersion: vi.fn(async () => ({ name: 'DevHub', version: '9.9.9', electron: '30.0.0' }))
      }
    })

    render(<VersionBannerDrawerContent />)

    expect(await screen.findByText(/9\.9\.9/)).toBeInTheDocument()
    expect(screen.getByText('DevHub')).toBeInTheDocument()
  })

  it('version banner degrades to unknown when the bridge is absent', async () => {
    render(<VersionBannerDrawerContent />)
    await waitFor(() => expect(screen.getAllByText('unknown').length).toBeGreaterThan(0))
  })

  it('logs drawer shows a friendly empty state when no project is selected', () => {
    render(<LogsDrawerContent />)
    expect(screen.getByText(/请选择一个项目/)).toBeInTheDocument()
  })

  it('terminal drawer seeds from cli.getProgress and renders streamed lines', async () => {
    const sample = {
      tool: 'codex' as const,
      stream: 'stdout' as const,
      line: 'building project',
      progress: null,
      confidence: 1,
      phase: 'working' as const,
      observedAt: 1700000000000
    }
    Object.assign(window.devhub, {
      r8: {
        cli: {
          getProgress: vi.fn(async () => ({ events: [sample], latest: sample, count: 1, progress: null })),
          onEvent: vi.fn(() => () => undefined)
        }
      }
    })

    render(<TerminalDrawerContent />)

    expect(await screen.findByText('building project')).toBeInTheDocument()
  })

  it('terminal drawer degrades when no cli bridge is present', async () => {
    render(<TerminalDrawerContent />)
    expect(await screen.findByText(/未提供 CLI \/ 任务输出流/)).toBeInTheDocument()
  })

  it('neutral boundary avoids dev-time placeholder phrasing', () => {
    // RIGHT detail surfaces now render real embedded views; the neutral boundary
    // only backs unknown / not-yet-bound contentIds (the registry fallback path).
    render(
      <RegisteredBoundaryDrawerContent
        slot="right"
        contentId={'unknown.contentId' as never}
        definition={getDrawerContentDefinition('unknown.contentId')}
      />
    )
    expect(screen.getByText(/该内容暂不可用/)).toBeInTheDocument()
    expect(screen.queryByText(/该状态不会生成模拟数据/)).not.toBeInTheDocument()
    expect(screen.queryByText(/尚未暴露该内容源的专用渲染器/)).not.toBeInTheDocument()
    expect(screen.queryByText(/保留给下游/)).not.toBeInTheDocument()
  })

  it('exposes a stable test handle so a missing version bridge does not throw', async () => {
    Object.assign(window.devhub, {
      system: {
        getVersion: vi.fn(async () => { throw new Error('boom') })
      }
    })
    render(<VersionBannerDrawerContent />)
    await waitFor(() => expect(screen.getAllByText('unknown').length).toBeGreaterThan(0))
  })
})

describe('R3.5 unified popout manager', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devhub', { configurable: true, value: {} })
    usePortPopoutStore.getState().resetPopoutSlice()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    usePortPopoutStore.getState().resetPopoutSlice()
  })

  it('lists every popout family (in-app card + browser window + drawer morph) under one model', async () => {
    act(() => {
      usePortPopoutStore.getState().setPopouts([portCardFixture()])
    })
    Object.assign(window.devhub, {
      r8: {
        popout: {
          list: vi.fn(async () => [
            browserPopoutFixture({ windowId: 'popout-process', mode: 'browserwindow', surface: 'process' }),
            browserPopoutFixture({ windowId: 'popout-morph', mode: 'floating', surface: 'port', targetId: 'monitor.port-detail', title: 'Drawer morph' })
          ]),
          close: vi.fn(async (windowId: string) => ({ success: true, windowId })),
          create: vi.fn(async () => browserPopoutFixture())
        }
      }
    })

    render(<PopoutManagerDrawerContent />)

    // In-app floating card.
    expect(await screen.findByText('端口 8080')).toBeInTheDocument()
    expect(screen.getByText('浮卡')).toBeInTheDocument()
    // BrowserWindow panel popout exposes focus / recall / close.
    expect(screen.getByTestId('popout-focus-popout-process')).toBeInTheDocument()
    expect(screen.getByTestId('popout-return-drawer-popout-process')).toBeInTheDocument()
    expect(screen.getByTestId('popout-close-popout-process')).toBeInTheDocument()
    // Drawer morph record recalls but has no live window to focus / close.
    expect(screen.getByText('Drawer morph')).toBeInTheDocument()
    expect(screen.getByText('抽屉 morph')).toBeInTheDocument()
    expect(screen.getByTestId('popout-return-drawer-popout-morph')).toBeInTheDocument()
    expect(screen.queryByTestId('popout-focus-popout-morph')).not.toBeInTheDocument()
  })

  it('omits the focus action for legacy non-panel BrowserWindow popouts so re-create cannot spawn a duplicate', async () => {
    const create = vi.fn(async () => browserPopoutFixture())
    Object.assign(window.devhub, {
      r8: {
        popout: {
          // A legacy `port` BrowserWindow popout is not deduped by createPopout,
          // so it must not expose a focus button (which re-creates the surface).
          list: vi.fn(async () => [
            browserPopoutFixture({ windowId: 'popout-port', mode: 'browserwindow', surface: 'port', targetId: 8080, title: 'DevHub port 8080' })
          ]),
          close: vi.fn(async (windowId: string) => ({ success: true, windowId })),
          create
        }
      }
    })

    render(<PopoutManagerDrawerContent />)

    expect(await screen.findByText('DevHub port 8080')).toBeInTheDocument()
    // Recall / close are still offered; focus is suppressed for the legacy surface.
    expect(screen.getByTestId('popout-return-drawer-popout-port')).toBeInTheDocument()
    expect(screen.getByTestId('popout-close-popout-port')).toBeInTheDocument()
    expect(screen.queryByTestId('popout-focus-popout-port')).not.toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('closes an in-app floating card from the manager', async () => {
    act(() => {
      usePortPopoutStore.getState().setPopouts([portCardFixture({ id: 'card-close' })])
    })
    Object.assign(window.devhub, {
      r8: { popout: { list: vi.fn(async () => []) } }
    })

    render(<PopoutManagerDrawerContent />)

    const closeButton = await screen.findByTestId('popout-close-card-close')
    await act(async () => {
      fireEvent.click(closeButton)
    })

    await waitFor(() => expect(usePortPopoutStore.getState().popouts).toHaveLength(0))
  })
})
