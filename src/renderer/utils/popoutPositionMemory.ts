import type { PortPopoutPosition, PortPopoutSize } from '../components/popout/port-popout-model'

export interface PortPopoutLayoutMemory {
  position: PortPopoutPosition
  size?: PortPopoutSize
}

export type PortPopoutMemoryValue = PortPopoutPosition | PortPopoutLayoutMemory

export const PORT_POPOUT_POSITION_MEMORY_STORAGE_KEY = 'devhub:r8b:port-popout-position-memory'

export function isPortPopoutPosition(value: unknown): value is PortPopoutPosition {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PortPopoutPosition>
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y)
}

export function isPortPopoutSize(value: unknown): value is PortPopoutSize {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PortPopoutSize>
  return Number.isFinite(candidate.width) && Number.isFinite(candidate.height)
}

export function isPortPopoutLayoutMemory(value: unknown): value is PortPopoutLayoutMemory {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PortPopoutLayoutMemory>
  return isPortPopoutPosition(candidate.position) && (!candidate.size || isPortPopoutSize(candidate.size))
}

export function normalizePortPopoutMemoryValue(value: unknown): PortPopoutMemoryValue | null {
  if (isPortPopoutPosition(value)) return value
  if (!isPortPopoutLayoutMemory(value)) return null
  const candidate = value
  return {
    position: candidate.position,
    ...(candidate.size ? { size: candidate.size } : {})
  }
}

export function readPortPopoutMemory(storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): Record<string, PortPopoutMemoryValue> {
  if (!storage) return {}
  try {
    const raw = storage.getItem(PORT_POPOUT_POSITION_MEMORY_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        const normalized = normalizePortPopoutMemoryValue(value)
        return normalized ? [[key, normalized]] : []
      })
    )
  } catch {
    return {}
  }
}

export function writePortPopoutMemory(
  memory: Record<string, PortPopoutMemoryValue>,
  storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined
): void {
  if (!storage) return
  storage.setItem(PORT_POPOUT_POSITION_MEMORY_STORAGE_KEY, JSON.stringify(memory))
}
