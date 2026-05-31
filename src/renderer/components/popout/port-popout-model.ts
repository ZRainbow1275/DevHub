import { DEFAULT_PORT_POPOUT_SYNC_POLICY, type PortPopoutSyncPolicy } from '@shared/types'
import {
  PORT_POPOUT_LIMITS,
  type PortInfo,
  type PortPopoutPosition,
  type PortPopoutSize,
  type PortPopoutTrigger
} from '@shared/types-extended'
import { allocatePortPopoutZIndex } from '../../utils/popoutZIndexAllocator'

export { PORT_POPOUT_LIMITS }
export type { PortPopoutPosition, PortPopoutSize, PortPopoutTrigger }

export interface PortPopoutLayoutMemory {
  position: PortPopoutPosition
  size?: PortPopoutSize
}

export interface PortPopout {
  id: string
  port: PortInfo
  trigger: PortPopoutTrigger
  mode: 'floating'
  position: PortPopoutPosition
  size: PortPopoutSize
  zIndex: number
  pinned: boolean
  minimized: boolean
  themeIsolated: boolean
  syncPolicy: PortPopoutSyncPolicy
  createdAt: number
  lastInteractedAt: number
}

export interface OpenPortPopoutRequest {
  port: PortInfo
  trigger: PortPopoutTrigger
  anchor?: PortPopoutPosition
  positionMemory?: Record<string, PortPopoutPosition | PortPopoutLayoutMemory>
  syncPolicy?: PortPopoutSyncPolicy
  now?: number
}

export interface OpenPortPopoutResult {
  popouts: PortPopout[]
  opened: PortPopout | null
  evictedId?: string
  blockedReason?: 'all-pinned'
}

export type PortPopoutResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export function getPortPopoutId(port: Pick<PortInfo, 'port' | 'pid'>): string {
  return `port:${port.port}:pid:${port.pid}`
}

export function getPortPopoutMemoryKey(port: Pick<PortInfo, 'port' | 'pid'>): string {
  return `port:${port.port}:pid:${port.pid}`
}

export function getNextPortPopoutZIndex(popouts: PortPopout[], now = Date.now()): number {
  return allocatePortPopoutZIndex(popouts, now)
}

export function normalizePortPopoutPosition(position: PortPopoutPosition): PortPopoutPosition {
  return {
    x: Math.max(0, Math.round(position.x)),
    y: Math.max(0, Math.round(position.y))
  }
}

export function normalizePortPopoutSize(size: PortPopoutSize): PortPopoutSize {
  return {
    width: Math.max(PORT_POPOUT_LIMITS.CARD_MIN_W, Math.round(size.width)),
    height: Math.max(PORT_POPOUT_LIMITS.CARD_MIN_H, Math.round(size.height))
  }
}

function isLayoutMemory(value: PortPopoutPosition | PortPopoutLayoutMemory | undefined): value is PortPopoutLayoutMemory {
  return !!value && 'position' in value
}

const ANCHOR_POPOUT_GAP_PX = 48

export function getDefaultPortPopoutPosition(
  port: Pick<PortInfo, 'port' | 'pid'>,
  index: number,
  anchor?: PortPopoutPosition,
  positionMemory: Record<string, PortPopoutPosition | PortPopoutLayoutMemory> = {}
): PortPopoutPosition {
  const remembered = positionMemory[getPortPopoutMemoryKey(port)]
  if (isLayoutMemory(remembered)) return normalizePortPopoutPosition(remembered.position)
  if (remembered) return normalizePortPopoutPosition(remembered)
  if (anchor) {
    return normalizePortPopoutPosition({
      x: anchor.x + ANCHOR_POPOUT_GAP_PX,
      y: anchor.y - PORT_POPOUT_LIMITS.CARD_DEFAULT_H - ANCHOR_POPOUT_GAP_PX
    })
  }
  return { x: 48 + index * 28, y: 96 + index * 28 }
}

export function getDefaultPortPopoutSize(
  port: Pick<PortInfo, 'port' | 'pid'>,
  positionMemory: Record<string, PortPopoutPosition | PortPopoutLayoutMemory> = {}
): PortPopoutSize {
  const remembered = positionMemory[getPortPopoutMemoryKey(port)]
  if (isLayoutMemory(remembered) && remembered.size) return normalizePortPopoutSize(remembered.size)
  return {
    width: PORT_POPOUT_LIMITS.CARD_DEFAULT_W,
    height: PORT_POPOUT_LIMITS.CARD_DEFAULT_H
  }
}

function resolvePortPopoutSyncPolicy(syncPolicy?: Partial<PortPopoutSyncPolicy> | null): PortPopoutSyncPolicy {
  return {
    ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
    ...syncPolicy,
  }
}

export function openPortPopout(current: PortPopout[], request: OpenPortPopoutRequest): OpenPortPopoutResult {
  const now = request.now ?? Date.now()
  const id = getPortPopoutId(request.port)
  const existing = current.find(popout => popout.id === id)
  const zIndex = getNextPortPopoutZIndex(current, now)

  if (existing) {
    const updated = {
      ...existing,
      port: request.port,
      trigger: request.trigger,
      zIndex,
      syncPolicy: existing.syncPolicy ?? resolvePortPopoutSyncPolicy(request.syncPolicy),
      lastInteractedAt: now
    }
    return {
      popouts: current.map(popout => popout.id === id ? updated : popout),
      opened: updated
    }
  }

  let base = current
  let evictedId: string | undefined
  if (base.length >= PORT_POPOUT_LIMITS.MAX_FLOATING) {
    const evictable = [...base]
      .filter(popout => !popout.pinned)
      .sort((left, right) => left.lastInteractedAt - right.lastInteractedAt)[0]

    if (!evictable) {
      return {
        popouts: current,
        opened: null,
        blockedReason: 'all-pinned'
      }
    }

    evictedId = evictable.id
    base = base.filter(popout => popout.id !== evictedId)
  }

  const opened: PortPopout = {
    id,
    port: request.port,
    trigger: request.trigger,
    mode: 'floating',
    position: getDefaultPortPopoutPosition(request.port, base.length, request.anchor, request.positionMemory),
    size: getDefaultPortPopoutSize(request.port, request.positionMemory),
    zIndex: getNextPortPopoutZIndex(base, now),
    pinned: false,
    minimized: false,
    themeIsolated: false,
    syncPolicy: resolvePortPopoutSyncPolicy(request.syncPolicy),
    createdAt: now,
    lastInteractedAt: now
  }

  return {
    popouts: [...base, opened],
    opened,
    evictedId
  }
}

export function closePortPopout(current: PortPopout[], id: string): PortPopout[] {
  return current.filter(popout => popout.id !== id)
}

/** @internal Floating popout in-DOM pin flag. UI surface removed in 0525 R2; retained for tests/internal flows. */
export function pinPortPopout(current: PortPopout[], id: string, pinned: boolean): PortPopout[] {
  return current.map(popout => popout.id === id ? { ...popout, pinned, lastInteractedAt: Date.now() } : popout)
}

export function minimizePortPopout(current: PortPopout[], id: string, minimized: boolean): PortPopout[] {
  return current.map(popout => popout.id === id ? { ...popout, minimized, lastInteractedAt: Date.now() } : popout)
}

export function isolatePortPopoutTheme(
  current: PortPopout[],
  id: string,
  themeIsolated: boolean,
  fallbackSyncPolicy: PortPopoutSyncPolicy = DEFAULT_PORT_POPOUT_SYNC_POLICY
): PortPopout[] {
  return current.map(popout => {
    if (popout.id !== id) return popout
    return {
      ...popout,
      themeIsolated,
      syncPolicy: themeIsolated
        ? {
            ...popout.syncPolicy,
            theme: false,
            direction: 'isolated',
          }
        : {
            ...popout.syncPolicy,
            theme: fallbackSyncPolicy.theme,
            direction: fallbackSyncPolicy.direction,
          },
      lastInteractedAt: Date.now()
    }
  })
}

export function movePortPopout(current: PortPopout[], id: string, position: PortPopoutPosition): PortPopout[] {
  const normalized = normalizePortPopoutPosition(position)
  return current.map(popout => popout.id === id ? { ...popout, position: normalized, lastInteractedAt: Date.now() } : popout)
}

export function resizePortPopoutGeometry(
  popout: Pick<PortPopout, 'position' | 'size'>,
  direction: PortPopoutResizeDirection,
  delta: PortPopoutPosition
): Pick<PortPopout, 'position' | 'size'> {
  const growsEast = direction.includes('e')
  const growsSouth = direction.includes('s')
  const growsWest = direction.includes('w')
  const growsNorth = direction.includes('n')

  const requestedWidth = popout.size.width + (growsEast ? delta.x : 0) - (growsWest ? delta.x : 0)
  const requestedHeight = popout.size.height + (growsSouth ? delta.y : 0) - (growsNorth ? delta.y : 0)
  const size = normalizePortPopoutSize({ width: requestedWidth, height: requestedHeight })

  const widthDelta = popout.size.width - size.width
  const heightDelta = popout.size.height - size.height
  const position = normalizePortPopoutPosition({
    x: growsWest ? popout.position.x + widthDelta : popout.position.x,
    y: growsNorth ? popout.position.y + heightDelta : popout.position.y
  })

  return { position, size }
}

export function resizePortPopout(
  current: PortPopout[],
  id: string,
  direction: PortPopoutResizeDirection,
  delta: PortPopoutPosition,
  origin?: Pick<PortPopout, 'position' | 'size'>
): PortPopout[] {
  return current.map(popout => {
    if (popout.id !== id) return popout
    const geometry = resizePortPopoutGeometry(origin ?? popout, direction, delta)
    return {
      ...popout,
      ...geometry,
      lastInteractedAt: Date.now()
    }
  })
}

export function syncPortPopoutsWithPorts(current: PortPopout[], ports: PortInfo[]): PortPopout[] {
  const portMap = new Map(ports.map(port => [getPortPopoutId(port), port]))
  return current.flatMap(popout => {
    const latest = portMap.get(popout.id)
    return latest ? [{ ...popout, port: latest }] : (popout.pinned ? [popout] : [])
  })
}
