import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT_POPOUT_SYNC_POLICY } from '@shared/types'
import type { PortInfo } from '@shared/types-extended'
import {
  PORT_POPOUT_LIMITS,
  isolatePortPopoutTheme,
  getPortPopoutId,
  minimizePortPopout,
  movePortPopout,
  openPortPopout,
  pinPortPopout,
  resizePortPopout,
  syncPortPopoutsWithPorts
} from './port-popout-model'

function portFixture(port: number, pid = 4000 + port): PortInfo {
  return {
    port,
    pid,
    processName: `process-${port}`,
    state: 'LISTENING',
    protocol: 'TCP',
    localAddress: `127.0.0.1:${port}`,
    foreignAddress: '*:*'
  }
}

describe('R8.B port popout model', () => {
  it('opens floating cards at the R8.B popout z-index tier and reuses an existing port card', () => {
    const first = openPortPopout([], {
      port: portFixture(3000),
      trigger: 'click',
      anchor: { x: 100, y: 120 },
      now: 10
    })

    expect(first.opened?.mode).toBe('floating')
    expect(first.opened?.zIndex).toBe(PORT_POPOUT_LIMITS.Z_INDEX_BASE)
    expect(first.opened?.position).toEqual({ x: 148, y: 0 })
    expect(first.opened?.syncPolicy).toEqual(DEFAULT_PORT_POPOUT_SYNC_POLICY)

    const second = openPortPopout(first.popouts, {
      port: { ...portFixture(3000), processName: 'vite-dev-server' },
      trigger: 'context-menu',
      syncPolicy: {
        ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
        direction: 'isolated',
      },
      now: 20
    })

    expect(second.popouts).toHaveLength(1)
    expect(second.opened?.trigger).toBe('context-menu')
    expect(second.opened?.port.processName).toBe('vite-dev-server')
    expect(second.opened?.zIndex).toBeGreaterThanOrEqual(PORT_POPOUT_LIMITS.Z_INDEX_BASE)
    expect(second.opened?.syncPolicy.direction).toBe('both')
  })

  it('caps floating popouts at five and evicts the oldest unpinned card', () => {
    const filled = [3000, 3001, 3002, 3003, 3004].reduce((popouts, port, index) => (
      openPortPopout(popouts, { port: portFixture(port), trigger: 'api', now: 100 + index }).popouts
    ), [] as ReturnType<typeof openPortPopout>['popouts'])

    const result = openPortPopout(filled, {
      port: portFixture(3005),
      trigger: 'drag',
      now: 200
    })

    expect(result.popouts).toHaveLength(PORT_POPOUT_LIMITS.MAX_FLOATING)
    expect(result.evictedId).toBe(getPortPopoutId(portFixture(3000)))
    expect(result.popouts.some(popout => popout.port.port === 3005)).toBe(true)
  })

  it('blocks the sixth floating popout when every existing card is pinned', () => {
    const pinned = [3100, 3101, 3102, 3103, 3104].reduce((popouts, port, index) => {
      const opened = openPortPopout(popouts, { port: portFixture(port), trigger: 'api', now: 100 + index }).popouts
      return pinPortPopout(opened, getPortPopoutId(portFixture(port)), true)
    }, [] as ReturnType<typeof openPortPopout>['popouts'])

    const result = openPortPopout(pinned, {
      port: portFixture(3105),
      trigger: 'hover',
      now: 200
    })

    expect(result.popouts).toHaveLength(PORT_POPOUT_LIMITS.MAX_FLOATING)
    expect(result.opened).toBeNull()
    expect(result.blockedReason).toBe('all-pinned')
  })

  it('persists movement and synchronizes visible popouts with latest real port rows', () => {
    const basePort = portFixture(3200)
    const opened = openPortPopout([], {
      port: basePort,
      trigger: 'click',
      syncPolicy: {
        ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
        direction: 'main-to-popout',
      },
      now: 10
    }).popouts
    const moved = movePortPopout(opened, getPortPopoutId(basePort), { x: 220.6, y: 88.2 })

    expect(moved[0].position).toEqual({ x: 221, y: 88 })

    const synced = syncPortPopoutsWithPorts(moved, [{ ...basePort, processName: 'node-real-listener' }])
    expect(synced[0].port.processName).toBe('node-real-listener')
    expect(synced[0].syncPolicy.direction).toBe('main-to-popout')
  })

  it('resizes popouts in eight directions while enforcing minimum dimensions', () => {
    const basePort = portFixture(3300)
    const opened = openPortPopout([], {
      port: basePort,
      trigger: 'click',
      anchor: { x: 100, y: 100 },
      now: 10
    }).popouts

    const expanded = resizePortPopout(opened, getPortPopoutId(basePort), 'se', { x: 40, y: 30 })
    expect(expanded[0].size).toEqual({ width: 400, height: 310 })
    expect(expanded[0].position).toEqual({ x: 148, y: 0 })

    const northWest = resizePortPopout(expanded, getPortPopoutId(basePort), 'nw', { x: 500, y: 500 }, expanded[0])
    expect(northWest[0].size).toEqual({
      width: PORT_POPOUT_LIMITS.CARD_MIN_W,
      height: PORT_POPOUT_LIMITS.CARD_MIN_H
    })
    expect(northWest[0].position).toEqual({ x: 268, y: 110 })
  })

  it('restores remembered floating card size with backward-compatible position memory', () => {
    const basePort = portFixture(3400)
    const layoutMemory = {
      [getPortPopoutId(basePort)]: {
        position: { x: 200.4, y: 180.2 },
        size: { width: 512.6, height: 344.3 }
      }
    }

    const restored = openPortPopout([], {
      port: basePort,
      trigger: 'api',
      positionMemory: layoutMemory,
      now: 10
    }).popouts

    expect(restored[0].position).toEqual({ x: 200, y: 180 })
    expect(restored[0].size).toEqual({ width: 513, height: 344 })

    const legacy = openPortPopout([], {
      port: basePort,
      trigger: 'api',
      positionMemory: {
        [getPortPopoutId(basePort)]: { x: 88.8, y: 90.1 }
      },
      now: 20
    }).popouts

    expect(legacy[0].position).toEqual({ x: 89, y: 90 })
    expect(legacy[0].size).toEqual({
      width: PORT_POPOUT_LIMITS.CARD_DEFAULT_W,
      height: PORT_POPOUT_LIMITS.CARD_DEFAULT_H
    })
  })

  it('minimizes and restores a floating popout without removing it from the stack', () => {
    const basePort = portFixture(3500)
    const opened = openPortPopout([], {
      port: basePort,
      trigger: 'click',
      now: 10
    }).popouts

    const minimized = minimizePortPopout(opened, getPortPopoutId(basePort), true)
    expect(minimized[0].minimized).toBe(true)
    expect(minimized[0].port).toEqual(basePort)

    const restored = minimizePortPopout(minimized, getPortPopoutId(basePort), false)
    expect(restored[0].minimized).toBe(false)
    expect(restored[0].id).toBe(opened[0].id)
  })

  it('isolates theme sync and then restores the previous sync direction and theme policy', () => {
    const basePort = portFixture(3501)
    const fallbackSyncPolicy = {
      ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
      direction: 'main-to-popout' as const
    }
    const opened = openPortPopout([], {
      port: basePort,
      trigger: 'api',
      syncPolicy: fallbackSyncPolicy,
      now: 10
    }).popouts

    const isolated = isolatePortPopoutTheme(opened, getPortPopoutId(basePort), true, fallbackSyncPolicy)
    expect(isolated[0].themeIsolated).toBe(true)
    expect(isolated[0].syncPolicy).toMatchObject({
      theme: false,
      direction: 'isolated',
      selection: fallbackSyncPolicy.selection,
      filters: fallbackSyncPolicy.filters,
      sort: fallbackSyncPolicy.sort,
      search: fallbackSyncPolicy.search,
      density: fallbackSyncPolicy.density
    })

    const restored = isolatePortPopoutTheme(isolated, getPortPopoutId(basePort), false, fallbackSyncPolicy)
    expect(restored[0].themeIsolated).toBe(false)
    expect(restored[0].syncPolicy).toMatchObject({
      theme: fallbackSyncPolicy.theme,
      direction: fallbackSyncPolicy.direction,
      selection: fallbackSyncPolicy.selection,
      filters: fallbackSyncPolicy.filters,
      sort: fallbackSyncPolicy.sort,
      search: fallbackSyncPolicy.search,
      density: fallbackSyncPolicy.density
    })
  })
})
