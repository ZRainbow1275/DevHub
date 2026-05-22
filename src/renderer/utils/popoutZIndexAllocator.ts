import type { PortPopout } from '../components/popout/port-popout-model'
import { PORT_POPOUT_LIMITS } from '../components/popout/port-popout-model'

export function allocatePortPopoutZIndex(popouts: PortPopout[], now = Date.now()): number {
  if (popouts.length === 0) return PORT_POPOUT_LIMITS.Z_INDEX_BASE
  const activeMax = Math.max(...popouts.map(popout => popout.zIndex))
  const next = Math.max(PORT_POPOUT_LIMITS.Z_INDEX_BASE + (now % 17), activeMax + 1)
  return Math.min(PORT_POPOUT_LIMITS.Z_INDEX_BASE + PORT_POPOUT_LIMITS.Z_INDEX_RANGE, next)
}
