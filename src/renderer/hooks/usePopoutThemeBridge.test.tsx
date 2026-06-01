import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PopoutBridgeMessage } from '@shared/schemas/r8-runtime'
import { DEFAULT_SETTINGS } from '@shared/types'
import { usePopoutThemeBridge } from './usePopoutThemeBridge'

function themePayload(theme: string) {
  return {
    emittedAt: 1700000000000,
    settings: {
      ...DEFAULT_SETTINGS,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        theme
      }
    }
  }
}

describe('usePopoutThemeBridge', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devhub', { configurable: true, value: {} })
    document.documentElement.dataset.theme = 'constructivism'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete document.documentElement.dataset.theme
  })

  it('applies a theme-settings sync message onto the document', () => {
    const handlerRef: { current: ((message: PopoutBridgeMessage) => void) | null } = { current: null }
    const onBridgeMessage = vi.fn((callback: (message: PopoutBridgeMessage) => void) => {
      handlerRef.current = callback
      return () => undefined
    })
    Object.assign(window.devhub, { r8: { popout: { onBridgeMessage } } })

    renderHook(() => usePopoutThemeBridge())
    expect(onBridgeMessage).toHaveBeenCalledTimes(1)

    handlerRef.current?.({ windowId: 'popout-1', type: 'sync', key: 'theme-settings', value: themePayload('cyberpunk') } as PopoutBridgeMessage)
    expect(document.documentElement.dataset.theme).toBe('cyberpunk')
  })

  it('ignores non-theme sync messages', () => {
    const handlerRef: { current: ((message: PopoutBridgeMessage) => void) | null } = { current: null }
    const onBridgeMessage = vi.fn((callback: (message: PopoutBridgeMessage) => void) => {
      handlerRef.current = callback
      return () => undefined
    })
    Object.assign(window.devhub, { r8: { popout: { onBridgeMessage } } })

    renderHook(() => usePopoutThemeBridge())
    handlerRef.current?.({ windowId: 'popout-1', type: 'sync', key: 'something-else', value: { foo: 'bar' } } as unknown as PopoutBridgeMessage)
    expect(document.documentElement.dataset.theme).toBe('constructivism')
  })

  it('applies the persisted theme once on mount so the popout boots themed', async () => {
    const onBridgeMessage = vi.fn(() => () => undefined)
    const get = vi.fn().mockResolvedValue(themePayload('cyberpunk').settings)
    Object.assign(window.devhub, {
      settings: { get },
      r8: { popout: { onBridgeMessage } }
    })

    renderHook(() => usePopoutThemeBridge())

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('cyberpunk'))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('degrades safely when the bridge and settings api are unavailable', () => {
    expect(() => renderHook(() => usePopoutThemeBridge())).not.toThrow()
  })
})
