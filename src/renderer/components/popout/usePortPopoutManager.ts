import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_PORT_POPOUT_SYNC_POLICY, type PortPopoutSyncPolicy } from '@shared/types'
import type { BrowserPopout } from '@shared/schemas/r8-runtime'
import type { PortInfo } from '@shared/types-extended'
import { usePortPopoutStore } from '../../stores/portPopoutStore'
import {
  type PortPopoutMemoryValue,
  readPortPopoutMemory,
  writePortPopoutMemory
} from '../../utils/popoutPositionMemory'
import {
  closePortPopout,
  getPortPopoutMemoryKey,
  isolatePortPopoutTheme,
  minimizePortPopout,
  movePortPopout,
  openPortPopout,
  resizePortPopout,
  syncPortPopoutsWithPorts,
  type PortPopout,
  type PortPopoutPosition,
  type PortPopoutResizeDirection,
  type PortPopoutTrigger
} from './port-popout-model'

interface PromoteResult {
  ok: boolean
  windowId?: string
  reason?: 'unavailable' | 'failed'
}

function toPortPopoutMemoryValue(position: PortPopoutPosition, size?: PortPopout['size']): PortPopoutMemoryValue {
  return size
    ? { position, size }
    : position
}

export function usePortPopoutManager(ports: PortInfo[], defaultSyncPolicy?: PortPopoutSyncPolicy) {
  const popouts = usePortPopoutStore(state => state.popouts)
  const updatePopouts = usePortPopoutStore(state => state.updatePopouts)
  const resetPopouts = usePortPopoutStore(state => state.resetPopoutSlice)
  const [positionMemory, setPositionMemory] = useState<Record<string, PortPopoutMemoryValue>>(() => readPortPopoutMemory())
  const resolvedSyncPolicy = useMemo(() => ({
    ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
    ...defaultSyncPolicy,
  }), [defaultSyncPolicy])

  useEffect(() => {
    updatePopouts(previous => syncPortPopoutsWithPorts(previous, ports))
  }, [ports, updatePopouts])

  useEffect(() => {
    const bridge = window.devhub?.r8?.port?.getPopoutPosition
    if (!bridge || ports.length === 0) return

    let cancelled = false

    void Promise.all(ports.map(async port => {
      const stored = await bridge(port.port)
      if (!stored.position) return null
      return {
        key: getPortPopoutMemoryKey(port),
        memory: stored.size
          ? toPortPopoutMemoryValue(stored.position, stored.size)
          : stored.position
      } as const
    })).then(entries => {
      if (cancelled) return
      setPositionMemory(previous => {
        let changed = false
        const next = { ...previous }
        for (const entry of entries) {
          if (!entry) continue
          const existing = next[entry.key]
          if (!existing) {
            next[entry.key] = entry.memory
            changed = true
            continue
          }
          if ('size' in entry.memory) {
            if ('position' in existing) {
              if (!('size' in existing)) {
                next[entry.key] = {
                  ...existing,
                  size: entry.memory.size
                }
                changed = true
              }
            } else {
              next[entry.key] = {
                position: existing,
                size: entry.memory.size
              }
              changed = true
            }
          }
        }
        if (changed) writePortPopoutMemory(next)
        return changed ? next : previous
      })
    }).catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [ports])

  useEffect(() => {
    return () => {
      resetPopouts()
    }
  }, [resetPopouts])

  const open = useCallback((port: PortInfo, trigger: PortPopoutTrigger, anchor?: PortPopoutPosition) => {
    updatePopouts(previous => openPortPopout(previous, {
      port,
      trigger,
      anchor,
      positionMemory,
      syncPolicy: resolvedSyncPolicy,
    }).popouts)
  }, [positionMemory, resolvedSyncPolicy, updatePopouts])

  const close = useCallback((id: string) => {
    updatePopouts(previous => closePortPopout(previous, id))
  }, [updatePopouts])

  const minimize = useCallback((id: string, minimized: boolean) => {
    updatePopouts(previous => minimizePortPopout(previous, id, minimized))
  }, [updatePopouts])

  const isolateTheme = useCallback((id: string, themeIsolated: boolean) => {
    updatePopouts(previous => isolatePortPopoutTheme(previous, id, themeIsolated, resolvedSyncPolicy))
  }, [resolvedSyncPolicy, updatePopouts])

  const move = useCallback((id: string, position: PortPopoutPosition) => {
    const target = popouts.find(popout => popout.id === id)
    updatePopouts(previous => movePortPopout(previous, id, position))

    if (!target) return
    setPositionMemory(previous => {
      const next = {
        ...previous,
        [getPortPopoutMemoryKey(target.port)]: {
          position,
          size: target.size,
        }
      }
      writePortPopoutMemory(next)
      const savePosition = window.devhub?.r8?.port?.savePopoutPosition
      if (savePosition) {
        void savePosition({
          port: target.port.port,
          position,
          size: target.size,
        }).catch(() => undefined)
      }
      return next
    })
  }, [popouts, updatePopouts])

  const resize = useCallback((
    id: string,
    direction: PortPopoutResizeDirection,
    delta: PortPopoutPosition,
    origin: Pick<PortPopout, 'position' | 'size'>
  ) => {
    const nextPopouts = resizePortPopout(popouts, id, direction, delta, origin)
    updatePopouts(() => nextPopouts)

    const target = nextPopouts.find(popout => popout.id === id)
    if (!target) return
    setPositionMemory(previous => {
      const next = {
        ...previous,
        [getPortPopoutMemoryKey(target.port)]: {
          position: target.position,
          size: target.size,
        }
      }
      writePortPopoutMemory(next)
      const savePosition = window.devhub?.r8?.port?.savePopoutPosition
      if (savePosition) {
        void savePosition({
          port: target.port.port,
          position: target.position,
          size: target.size,
        }).catch(() => undefined)
      }
      return next
    })
  }, [popouts, updatePopouts])

  const promote = useCallback(async (popout: PortPopout): Promise<PromoteResult> => {
    const bridge = window.devhub?.r8?.popout
    if (!bridge) return { ok: false, reason: 'unavailable' }

    try {
      const created: BrowserPopout = await bridge.create({
        surface: 'port',
        targetId: popout.port.port,
        mode: 'browserwindow',
        route: `/monitor?port=${encodeURIComponent(String(popout.port.port))}`,
        bounds: {
          x: popout.position.x,
          y: popout.position.y,
          width: popout.size.width,
          height: popout.size.height
        },
        title: `DevHub Port ${popout.port.port}`
      })
      updatePopouts(previous => closePortPopout(previous, popout.id))
      return { ok: true, windowId: created.windowId }
    } catch {
      return { ok: false, reason: 'failed' }
    }
  }, [updatePopouts])

  const isOpen = useCallback((port: Pick<PortInfo, 'port' | 'pid'>) => {
    return popouts.some(popout => popout.port.port === port.port && popout.port.pid === port.pid)
  }, [popouts])

  return useMemo(() => ({
    popouts,
    open,
    close,
    minimize,
    isolateTheme,
    move,
    resize,
    promote,
    isOpen
  }), [close, isolateTheme, isOpen, minimize, move, open, popouts, promote, resize])
}
