import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserPopout } from '@shared/schemas/r8-runtime'
import { PanelDetachButton } from './PanelDetachButton'

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
    delete (window.devhub as { r8?: unknown }).r8
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

    await waitFor(() => expect(openPopout).toHaveBeenCalledWith('process'))
    expect(closePopout).not.toHaveBeenCalled()
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
