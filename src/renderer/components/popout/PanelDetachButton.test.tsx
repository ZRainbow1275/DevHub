import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserPopout } from '@shared/schemas/r8-runtime'
import { PanelDetachButton } from './PanelDetachButton'
import { __resetPanelPopoutListStoreForTests } from '../../stores/panelPopoutListStore'

const now = 1700000000000

function panelPopoutFixture(overrides: Partial<BrowserPopout> = {}): BrowserPopout {
  return {
    windowId: 'popout-panel-process',
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

describe('PanelDetachButton', () => {
  beforeEach(() => {
    __resetPanelPopoutListStoreForTests()
    delete (window.devhub as { r8?: unknown }).r8
  })

  afterEach(() => {
    __resetPanelPopoutListStoreForTests()
  })

  it('opens a real panel BrowserWindow through the preload bridge', async () => {
    const openPopout = vi.fn(async () => panelPopoutFixture())
    const listPopouts = vi.fn(async () => [])
    const closePopout = vi.fn(async (windowId: string) => ({ success: true, windowId }))

    Object.assign(window.devhub, {
      r8: {
        panel: {
          openPopout,
          listPopouts,
          closePopout
        }
      }
    })

    render(<PanelDetachButton surface="process" />)

    await waitFor(() => expect(listPopouts).toHaveBeenCalled())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '悬浮' }))
    })

    // Whole-panel surfaces detach without a target (target arg is undefined).
    await waitFor(() => expect(openPopout).toHaveBeenCalledWith('process', undefined))
    expect(closePopout).not.toHaveBeenCalled()
  })

  it('passes a detach target when opening a detail surface popout', async () => {
    const openPopout = vi.fn(async () => panelPopoutFixture({ surface: 'process-detail', targetId: 'pid:4321' }))
    const listPopouts = vi.fn(async () => [])
    const closePopout = vi.fn(async (windowId: string) => ({ success: true, windowId }))

    Object.assign(window.devhub, {
      r8: {
        panel: {
          openPopout,
          listPopouts,
          closePopout
        }
      }
    })

    render(<PanelDetachButton surface="process-detail" target="pid:4321" />)

    await waitFor(() => expect(listPopouts).toHaveBeenCalled())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '悬浮' }))
    })

    await waitFor(() => expect(openPopout).toHaveBeenCalledWith('process-detail', 'pid:4321'))
  })

  it('matches the active detail popout by surface and target for recall', async () => {
    const activePopout = panelPopoutFixture({ surface: 'window-detail', targetId: 'hwnd:99', windowId: 'popout-window-detail' })
    const listPopouts = vi.fn(async () => [activePopout])
    const openPopout = vi.fn(async () => activePopout)
    const closePopout = vi.fn(async (windowId: string) => ({ success: true, windowId }))

    Object.assign(window.devhub, {
      r8: {
        panel: {
          openPopout,
          listPopouts,
          closePopout
        }
      }
    })

    render(<PanelDetachButton surface="window-detail" target="hwnd:99" />)

    const recallButton = await screen.findByRole('button', { name: '已悬浮，点此召回' })
    expect(recallButton).toHaveAttribute('data-r8c-panel-detach', 'window-detail')
  })

  it('recalls any live surface popout when the button has no target (PR3 recall reconciliation)', async () => {
    // A detail popout was opened with target pid:4321, then the selection was
    // cleared so this button now renders with no target. It must still recall the
    // existing window rather than fall back to r8-panel-* and open a duplicate.
    const targetBound = panelPopoutFixture({ surface: 'process-detail', targetId: 'pid:4321', windowId: 'popout-detail-4321' })
    let popouts: BrowserPopout[] = [targetBound]
    const openPopout = vi.fn(async () => targetBound)
    const listPopouts = vi.fn(async () => popouts)
    const closePopout = vi.fn(async (windowId: string) => {
      popouts = [{ ...targetBound, bridgeState: 'closed' }]
      return { success: true, windowId }
    })

    Object.assign(window.devhub, {
      r8: {
        panel: {
          openPopout,
          listPopouts,
          closePopout
        }
      }
    })

    render(<PanelDetachButton surface="process-detail" target={null} />)

    const recallButton = await screen.findByRole('button', { name: '已悬浮，点此召回' })

    await act(async () => {
      fireEvent.click(recallButton)
    })

    await waitFor(() => expect(closePopout).toHaveBeenCalledWith('popout-detail-4321'))
    expect(openPopout).not.toHaveBeenCalled()
  })

  it('opens a new popout when a different target is requested and none matches', async () => {
    // A live popout exists for pid:1, but this button targets pid:2 — it should
    // open a fresh window for its own target rather than recall the other one.
    const other = panelPopoutFixture({ surface: 'process-detail', targetId: 'pid:1', windowId: 'popout-detail-1' })
    const created = panelPopoutFixture({ surface: 'process-detail', targetId: 'pid:2', windowId: 'popout-detail-2' })
    const openPopout = vi.fn(async () => created)
    const listPopouts = vi.fn(async () => [other])
    const closePopout = vi.fn(async (windowId: string) => ({ success: true, windowId }))

    Object.assign(window.devhub, {
      r8: {
        panel: {
          openPopout,
          listPopouts,
          closePopout
        }
      }
    })

    render(<PanelDetachButton surface="process-detail" target="pid:2" />)

    await waitFor(() => expect(listPopouts).toHaveBeenCalled())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '悬浮' }))
    })

    await waitFor(() => expect(openPopout).toHaveBeenCalledWith('process-detail', 'pid:2'))
    expect(closePopout).not.toHaveBeenCalled()
  })

  it('surfaces a notification and logs when opening the popout fails (no silent swallow)', async () => {
    const failure = new Error('E_RATE_LIMITED:popout browserwindow limit reached')
    const openPopout = vi.fn(async () => { throw failure })
    const listPopouts = vi.fn(async () => [])
    const closePopout = vi.fn(async (windowId: string) => ({ success: true, windowId }))
    const emit = vi.fn(async () => ({ success: true, id: 'n1', deduped: false, occurrenceCount: 1 }))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    Object.assign(window.devhub, {
      r8: {
        panel: { openPopout, listPopouts, closePopout },
        notify: { emit }
      }
    })

    render(<PanelDetachButton surface="process" />)

    await waitFor(() => expect(listPopouts).toHaveBeenCalled())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '悬浮' }))
    })

    await waitFor(() => expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      level: 'ERROR',
      source: 'system',
      title: '悬浮窗打开失败'
    })))
    expect(consoleError).toHaveBeenCalledWith('[panel-detach] openPopout failed', expect.objectContaining({ surface: 'process' }), failure)
    // The button recovers to its idle state instead of staying stuck busy.
    expect(screen.getByRole('button', { name: '悬浮' })).not.toBeDisabled()

    consoleError.mockRestore()
  })

  it('warns when the panel popout bridge is unavailable', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // No r8 bridge assigned (beforeEach deletes it): the button must not throw and
    // must warn that the bridge is missing.
    render(<PanelDetachButton surface="process" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '悬浮' }))
    })

    expect(consoleWarn).toHaveBeenCalledWith(
      '[panel-detach] panel popout bridge unavailable; window.devhub.r8.panel.openPopout/closePopout missing',
      expect.objectContaining({ surface: 'process' })
    )
    expect(screen.getByRole('button', { name: '悬浮' })).not.toBeDisabled()

    consoleWarn.mockRestore()
  })

  it('renders an active recall banner and closes the detached panel window', async () => {
    const activePopout = panelPopoutFixture()
    let popouts: BrowserPopout[] = [activePopout]
    const openPopout = vi.fn(async () => activePopout)
    const listPopouts = vi.fn(async () => popouts)
    const closePopout = vi.fn(async (windowId: string) => {
      popouts = [{ ...activePopout, bridgeState: 'closed' }]
      return { success: true, windowId }
    })

    Object.assign(window.devhub, {
      r8: {
        panel: {
          openPopout,
          listPopouts,
          closePopout
        }
      }
    })

    render(<PanelDetachButton surface="process" />)

    const recallButton = await screen.findByRole('button', { name: '已悬浮，点此召回' })
    expect(recallButton).toHaveAttribute('data-r8c-panel-detach-state', 'active')

    await act(async () => {
      fireEvent.click(recallButton)
    })

    await waitFor(() => expect(closePopout).toHaveBeenCalledWith(activePopout.windowId))
    await waitFor(() => expect(screen.getByRole('button', { name: '悬浮' })).toBeInTheDocument())
    expect(openPopout).not.toHaveBeenCalled()
  })
})
