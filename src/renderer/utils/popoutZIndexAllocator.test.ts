import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT_POPOUT_SYNC_POLICY } from '@shared/types'
import { PORT_POPOUT_LIMITS, type PortPopout } from '../components/popout/port-popout-model'
import { allocatePortPopoutZIndex } from './popoutZIndexAllocator'

function popoutFixture(port: number, zIndex: number): PortPopout {
  return {
    id: `port:${port}:pid:${port + 1000}`,
    port: {
      port,
      pid: port + 1000,
      processName: `process-${port}`,
      state: 'LISTENING',
      protocol: 'TCP',
      localAddress: `127.0.0.1:${port}`,
      foreignAddress: '*:*'
    },
    trigger: 'api',
    mode: 'floating',
    position: { x: 0, y: 0 },
    size: {
      width: PORT_POPOUT_LIMITS.CARD_DEFAULT_W,
      height: PORT_POPOUT_LIMITS.CARD_DEFAULT_H
    },
    zIndex,
    pinned: false,
    minimized: false,
    themeIsolated: false,
    syncPolicy: DEFAULT_PORT_POPOUT_SYNC_POLICY,
    createdAt: zIndex,
    lastInteractedAt: zIndex
  }
}

describe('R8.B popout z-index allocator', () => {
  it('starts at the dedicated popout tier base when no cards are open', () => {
    expect(allocatePortPopoutZIndex([], 10)).toBe(PORT_POPOUT_LIMITS.Z_INDEX_BASE)
  })

  it('allocates within the popout band and above the current active maximum', () => {
    const next = allocatePortPopoutZIndex([
      popoutFixture(3000, PORT_POPOUT_LIMITS.Z_INDEX_BASE),
      popoutFixture(3001, PORT_POPOUT_LIMITS.Z_INDEX_BASE + 5)
    ], 100)

    expect(next).toBe(PORT_POPOUT_LIMITS.Z_INDEX_BASE + 15)
    expect(next).toBeGreaterThan(PORT_POPOUT_LIMITS.Z_INDEX_BASE + 5)
    expect(next).toBeLessThanOrEqual(PORT_POPOUT_LIMITS.Z_INDEX_BASE + PORT_POPOUT_LIMITS.Z_INDEX_RANGE)
  })

  it('clamps allocation at the top of the popout z-index segment', () => {
    const maxZIndex = PORT_POPOUT_LIMITS.Z_INDEX_BASE + PORT_POPOUT_LIMITS.Z_INDEX_RANGE
    expect(allocatePortPopoutZIndex([popoutFixture(3000, maxZIndex)], 100)).toBe(maxZIndex)
  })
})
