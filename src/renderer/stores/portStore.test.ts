import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { PortInfo } from '@shared/types-extended'
import { openPortPopout, PORT_POPOUT_LIMITS, type PortPopout } from '../components/popout/port-popout-model'
import { resetPortPopoutStore, usePortPopoutStore } from './portPopoutStore'
import { getDefaultPortPopoutSliceState, usePortStore } from './portStore'

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

function popoutFixture(port: number): PortPopout {
  const result = openPortPopout([], {
    port: portFixture(port),
    trigger: 'api',
    now: port
  })

  if (!result.opened) {
    throw new Error(`Expected popout fixture for port ${port} to open`)
  }

  return result.opened
}

function resetPortStore() {
  usePortStore.setState({
    ports: [],
    conflicts: [],
    isScanning: false,
    lastScanTime: null,
    selectedPort: null,
    portDetails: new Map(),
    ...getDefaultPortPopoutSliceState()
  })
}

describe('portStore R8.B popout slice', () => {
  beforeEach(() => {
    resetPortStore()
  })

  it('exposes popout state through the legacy portPopoutStore selector bridge', () => {
    const popout = popoutFixture(3010)

    usePortPopoutStore.getState().setPopouts([popout])

    expect(usePortStore.getState().getOpenPopoutCount()).toBe(1)
    expect(usePortStore.getState().getPopoutById(popout.id)?.port.port).toBe(3010)

    usePortStore.getState().updatePopouts(current => current.map(entry => ({
      ...entry,
      pinned: true
    })))

    expect(usePortPopoutStore.getState().popouts[0]?.pinned).toBe(true)

    resetPortPopoutStore()

    expect(usePortStore.getState().popouts).toEqual([])
  })

  it('mirrors persisted trigger timing settings with defensive bounds', () => {
    usePortStore.getState().setPopoutSettings({
      triggerEnabled: {
        hover: false,
        contextMenu: false
      },
      hoverDelayMs: 50,
      dragThresholdPx: 80
    })

    expect(usePortStore.getState().triggerEnabled).toEqual({
      ...DEFAULT_SETTINGS.window.portPopout.triggerEnabled,
      hover: false,
      contextMenu: false
    })
    expect(usePortStore.getState().hoverDelayMs).toBe(200)
    expect(usePortStore.getState().dragThresholdPx).toBe(32)

    usePortStore.getState().setPopoutTriggerEnabled('drag', false)
    usePortStore.getState().setPopoutTiming({
      hoverDelayMs: 1250.6,
      dragThresholdPx: 7.4
    })

    expect(usePortStore.getState().triggerEnabled.drag).toBe(false)
    expect(usePortStore.getState().hoverDelayMs).toBe(1251)
    expect(usePortStore.getState().dragThresholdPx).toBe(7)
  })

  it('stores bounded named layout presets without sharing mutable popout objects', () => {
    const popouts = Array.from({ length: PORT_POPOUT_LIMITS.MAX_TOTAL + 2 }, (_, index) => popoutFixture(3100 + index))

    expect(usePortStore.getState().savePopoutLayoutPreset('  incident-triage  ', popouts)).toBe(true)

    const preset = usePortStore.getState().layoutPresets['incident-triage']
    expect(preset).toHaveLength(PORT_POPOUT_LIMITS.MAX_TOTAL)
    expect(preset).not.toBe(popouts)
    expect(preset?.[0]?.position).not.toBe(popouts[0]?.position)

    usePortStore.getState().setPopouts([])
    expect(usePortStore.getState().applyPopoutLayoutPreset('incident-triage')).toBe(true)
    expect(usePortStore.getState().popouts).toHaveLength(PORT_POPOUT_LIMITS.MAX_TOTAL)

    usePortStore.getState().deletePopoutLayoutPreset('incident-triage')
    expect(usePortStore.getState().applyPopoutLayoutPreset('incident-triage')).toBe(false)
  })
})
