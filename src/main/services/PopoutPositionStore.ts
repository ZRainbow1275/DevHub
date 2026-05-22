import Store from 'electron-store'
import { portPopoutPositionRecordSchema, type PortPopoutPositionRecord } from '@shared/schemas/r8-runtime'

interface PopoutPositionStoreShape {
  positions: Record<string, unknown>
}

export interface SavePopoutPositionInput {
  port: number
  position: { x: number; y: number }
  size?: { width: number; height: number }
}

const DEFAULT_STORE: PopoutPositionStoreShape = { positions: {} }

function makePositionKey(port: number): string {
  return `port:${port}`
}

function readPositionMap(store: Store<PopoutPositionStoreShape>): Record<string, unknown> {
  const raw = store.get('positions', {})
  return typeof raw === 'object' && raw !== null ? { ...(raw as Record<string, unknown>) } : {}
}

function normalizePositionRecord(input: SavePopoutPositionInput): PortPopoutPositionRecord {
  return portPopoutPositionRecordSchema.parse({
    x: Math.round(input.position.x),
    y: Math.round(input.position.y),
    ...(input.size ? {
      w: Math.round(input.size.width),
      h: Math.round(input.size.height)
    } : {}),
    updatedAt: Date.now()
  })
}

export class PopoutPositionStore {
  private readonly store: Store<PopoutPositionStoreShape>

  constructor(store?: Store<PopoutPositionStoreShape>) {
    this.store = store ?? new Store<PopoutPositionStoreShape>({
      name: 'popout-positions',
      defaults: DEFAULT_STORE,
    })
  }

  get(port: number): PortPopoutPositionRecord | null {
    const key = makePositionKey(port)
    const parsed = portPopoutPositionRecordSchema.safeParse(readPositionMap(this.store)[key])
    return parsed.success ? parsed.data : null
  }

  list(): Record<string, PortPopoutPositionRecord> {
    const positions = readPositionMap(this.store)
    return Object.fromEntries(
      Object.entries(positions).flatMap(([key, value]) => {
        const parsed = portPopoutPositionRecordSchema.safeParse(value)
        return parsed.success ? [[key, parsed.data]] : []
      })
    )
  }

  set(input: SavePopoutPositionInput): PortPopoutPositionRecord {
    const record = normalizePositionRecord(input)
    const positions = readPositionMap(this.store)
    positions[makePositionKey(input.port)] = record
    this.store.set('positions', positions)
    return record
  }

  remove(port: number): boolean {
    const positions = readPositionMap(this.store)
    const key = makePositionKey(port)
    if (!(key in positions)) return false
    delete positions[key]
    this.store.set('positions', positions)
    return true
  }
}
