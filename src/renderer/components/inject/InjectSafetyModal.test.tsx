import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InjectCountdownStreamPayload, InjectFirstTimeRequiredPayload } from '@shared/schemas/inject'
import { InjectCountdownHost } from './InjectCountdownModal'
import { InjectFirstTimeModal } from './InjectFirstTimeModal'
import { InjectWhitelistDrawer } from './InjectWhitelistDrawer'
import { INJECT_WHITELIST_CHANGED_EVENT } from './inject-events'

function installInjectBridge() {
  const countdownHandlers: Array<(payload: InjectCountdownStreamPayload) => void> = []
  const completeCountdown = vi.fn(async () => ({ completed: true }))
  const cancelCountdown = vi.fn(async () => ({ cancelled: true }))
  const confirmFirstTime = vi.fn(async () => ({ success: true }))
  const whitelist = vi.fn(async () => [{
    id: '00000000-0000-4000-8000-000000000001',
    alias: 'codex-1',
    pattern: 'codex-1',
    scope: 'instance',
    duration: '24h',
    scenarios: ['manual-template'],
    createdAt: 1_800_000_000_000,
    expiresAt: 1,
    enabled: true,
    reason: 'vitest'
  }])
  const addWhitelist = vi.fn(async () => ({ id: '00000000-0000-4000-8000-000000000002' }))
  const removeWhitelist = vi.fn(async () => ({ success: true }))

  ;(window as unknown as { devhub: unknown }).devhub = {
    r8: {
      inject: {
        addWhitelist,
        cancelCountdown,
        completeCountdown,
        confirmFirstTime,
        onCountdownStream: vi.fn((callback: (payload: InjectCountdownStreamPayload) => void) => {
          countdownHandlers.push(callback)
          return () => {
            const index = countdownHandlers.indexOf(callback)
            if (index >= 0) countdownHandlers.splice(index, 1)
          }
        }),
        removeWhitelist,
        whitelist
      }
    }
  }

  return {
    addWhitelist,
    cancelCountdown,
    completeCountdown,
    confirmFirstTime,
    emitCountdown: (payload: InjectCountdownStreamPayload) => {
      for (const handler of countdownHandlers) handler(payload)
    },
    removeWhitelist,
    whitelist
  }
}

const countdownPayload: InjectCountdownStreamPayload = {
  actionId: '00000000-0000-4000-8000-000000000010',
  scenario: 'manual-template',
  targetAlias: 'codex-1',
  totalMs: 3000,
  remainingMs: 1500,
  elapsedMs: 1500,
  emittedAt: 1_800_000_000_000,
  phase: 'tick',
  canCancel: true
}

const firstTimePayload: InjectFirstTimeRequiredPayload = {
  requestId: '00000000-0000-4000-8000-000000000011',
  selector: 'alias',
  aliasOrId: 'codex-1',
  pid: null,
  hwnd: null,
  cwd: 'D:/Projects/app',
  taskId: null,
  scenario: 'manual-template',
  targetAlias: 'codex-1',
  resolvedTool: 'codex',
  reason: 'first-time confirmation required',
  emittedAt: 1_800_000_000_000
}

describe('inject safety UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows countdown stream payload and supports immediate injection', async () => {
    const bridge = installInjectBridge()
    render(<InjectCountdownHost />)

    act(() => {
      bridge.emitCountdown(countdownPayload)
    })

    expect(await screen.findByTestId('inject-countdown-modal')).toBeInTheDocument()
    expect(screen.getByTestId('inject-countdown-remaining')).toHaveTextContent('1500ms')
    fireEvent.click(screen.getByTestId('inject-countdown-now'))

    await waitFor(() => expect(bridge.completeCountdown).toHaveBeenCalledWith(countdownPayload.actionId, 'inject-countdown-modal'))
  })

  it('writes first-time confirmation with selected duration and scope', async () => {
    const bridge = installInjectBridge()
    render(<InjectFirstTimeModal payload={firstTimePayload} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('inject-first-time-duration-7d'))
    fireEvent.click(screen.getByTestId('inject-first-time-scope-project-cwd'))
    fireEvent.click(screen.getByTestId('inject-first-time-confirm'))

    await waitFor(() => expect(bridge.confirmFirstTime).toHaveBeenCalledWith(expect.objectContaining({
      aliasOrId: 'codex-1',
      confirmedBy: 'inject-first-time-modal',
      duration: '7d',
      scope: 'project-cwd'
    })))
  })

  it('renders whitelist drawer with add, delete, and expired status through the real preload bridge', async () => {
    const bridge = installInjectBridge()
    render(<InjectWhitelistDrawer />)

    expect(await screen.findByTestId('inject-whitelist-drawer')).toBeInTheDocument()
    expect(await screen.findByText('已过期，需要重新授权')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('inject-whitelist-pattern'), { target: { value: 'codex-2' } })
    fireEvent.click(screen.getByTestId('inject-whitelist-add'))
    await waitFor(() => expect(bridge.addWhitelist).toHaveBeenCalledWith(expect.objectContaining({
      confirmedBy: 'inject-whitelist-drawer',
      pattern: 'codex-2',
      scope: 'instance'
    })))

    fireEvent.click(screen.getByTestId('inject-whitelist-remove-00000000-0000-4000-8000-000000000001'))
    await waitFor(() => expect(bridge.removeWhitelist).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', 'inject-whitelist-drawer'))
  })

  it('refreshes a mounted whitelist drawer when first-time confirmation changes entries', async () => {
    const bridge = installInjectBridge()
    bridge.whitelist
      .mockResolvedValueOnce([])
      .mockResolvedValue([{
        id: '00000000-0000-4000-8000-000000000003',
        alias: 'codex-refreshed',
        pattern: 'codex-refreshed',
        scope: 'instance',
        duration: '24h',
        scenarios: ['manual-template'],
        createdAt: 1_800_000_000_001,
        expiresAt: 1_800_086_400_001,
        enabled: true,
        reason: 'first-time-confirm-modal'
      }])
    render(<InjectWhitelistDrawer />)

    expect(await screen.findByText('当前没有注入白名单记录。')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new CustomEvent(INJECT_WHITELIST_CHANGED_EVENT))
    })

    expect(await screen.findByText('codex-refreshed')).toBeInTheDocument()
    expect(bridge.whitelist).toHaveBeenCalledTimes(2)
  })
})
