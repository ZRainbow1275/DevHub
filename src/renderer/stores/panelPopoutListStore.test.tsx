import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserPopout } from '@shared/schemas/r8-runtime'
import { PanelDetachButton } from '../components/popout/PanelDetachButton'
import {
  __resetPanelPopoutListStoreForTests,
  acquirePanelPopoutPolling,
  refreshPanelPopoutList,
  usePanelPopoutListStore
} from './panelPopoutListStore'

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

describe('panelPopoutListStore', () => {
  beforeEach(() => {
    __resetPanelPopoutListStoreForTests()
    delete (window.devhub as { r8?: unknown }).r8
  })

  afterEach(() => {
    __resetPanelPopoutListStoreForTests()
    vi.useRealTimers()
  })

  it('shares ONE poller across many detach buttons (call count does not scale with button count)', async () => {
    vi.useFakeTimers()
    const listPopouts = vi.fn(async () => [] as BrowserPopout[])
    const openPopout = vi.fn(async () => panelPopoutFixture())
    const closePopout = vi.fn(async (windowId: string) => ({ success: true, windowId }))
    Object.assign(window.devhub, { r8: { panel: { openPopout, listPopouts, closePopout } } })

    // Mount many buttons (mirrors the real app: tabs + detail views + every widget).
    render(
      <>
        {Array.from({ length: 12 }, (_, index) => (
          <PanelDetachButton key={index} surface="process" />
        ))}
      </>
    )

    // Initial fetch fires once for the whole group, not once per button.
    await act(async () => { await Promise.resolve() })
    expect(listPopouts.mock.calls.length).toBe(1)

    // Advancing one poll interval adds exactly one more call regardless of count.
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(listPopouts.mock.calls.length).toBe(2)

    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(listPopouts.mock.calls.length).toBe(3)

    // 12 buttons over 2 intervals would be 36 calls under per-button polling; the
    // shared poller keeps it at 3.
    expect(listPopouts.mock.calls.length).toBeLessThan(12)
  })

  it('a failing list poll never emits a failure notification (silent recovery)', async () => {
    const listPopouts = vi.fn(async () => { throw new Error('RateLimitError: Rate limit exceeded') })
    const emit = vi.fn(async () => ({ success: true, id: 'n1', deduped: false, occurrenceCount: 1 }))
    Object.assign(window.devhub, { r8: { panel: { listPopouts }, notify: { emit } } })

    await act(async () => { await refreshPanelPopoutList() })

    expect(emit).not.toHaveBeenCalled()
    expect(usePanelPopoutListStore.getState().popouts).toEqual([])
  })

  it('stops polling once the last subscriber releases (reference counting)', async () => {
    vi.useFakeTimers()
    const listPopouts = vi.fn(async () => [] as BrowserPopout[])
    Object.assign(window.devhub, { r8: { panel: { listPopouts } } })

    const releaseA = acquirePanelPopoutPolling()
    const releaseB = acquirePanelPopoutPolling()
    await act(async () => { await Promise.resolve() })
    const afterStart = listPopouts.mock.calls.length

    releaseA()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    const stillPolling = listPopouts.mock.calls.length
    expect(stillPolling).toBeGreaterThan(afterStart)

    releaseB()
    const beforeIdle = listPopouts.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(listPopouts.mock.calls.length).toBe(beforeIdle)
  })
})
