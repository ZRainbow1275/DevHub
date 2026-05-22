import { screen } from 'electron'
import { r8MonitorInfoSchema, r8MonitorsResponseSchema, type R8MonitorInfo, type R8MonitorsResponse } from '@shared/schemas/r8-runtime'

type DisplayLike = {
  id: number
  label?: string
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  rotation?: number
  internal?: boolean
}

export type DisplayEvent = 'display-added' | 'display-removed' | 'display-metrics-changed'

type ScreenLike = {
  getAllDisplays(): DisplayLike[]
  getPrimaryDisplay(): DisplayLike
  on(event: DisplayEvent, callback: () => void): void
  removeListener(event: DisplayEvent, callback: () => void): void
}

function hasScreenApi(value: unknown): value is ScreenLike {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ScreenLike>
  return typeof candidate.getAllDisplays === 'function'
    && typeof candidate.getPrimaryDisplay === 'function'
    && typeof candidate.on === 'function'
    && typeof candidate.removeListener === 'function'
}

function normalizeDisplay(display: DisplayLike, primaryId: number): R8MonitorInfo {
  return r8MonitorInfoSchema.parse({
    id: display.id,
    name: display.label && display.label.trim().length > 0 ? display.label : `Display ${display.id}`,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    primary: display.id === primaryId,
    rotation: display.rotation ?? 0,
    internal: display.internal ?? false
  })
}

function getDefaultScreenApi(): ScreenLike | null {
  try {
    return hasScreenApi(screen) ? screen : null
  } catch {
    return null
  }
}

export class MonitorService {
  private readonly screenApi: ScreenLike | null

  constructor(screenApi?: ScreenLike | null) {
    this.screenApi = screenApi === undefined ? getDefaultScreenApi() : screenApi
  }

  list(): R8MonitorsResponse {
    if (!this.screenApi) return r8MonitorsResponseSchema.parse({ monitors: [] })
    const primary = this.screenApi.getPrimaryDisplay()
    return r8MonitorsResponseSchema.parse({
      monitors: this.screenApi.getAllDisplays().map(display => normalizeDisplay(display, primary.id))
    })
  }

  findByIdOrIndex(monitorId: number): R8MonitorInfo | null {
    const monitors = this.list().monitors
    return monitors.find(monitor => monitor.id === monitorId) ?? monitors[monitorId] ?? null
  }

  watch(callback: (event: DisplayEvent) => void): () => void {
    if (!this.screenApi) return () => undefined
    const events: DisplayEvent[] = ['display-added', 'display-removed', 'display-metrics-changed']
    const handlers = new Map<DisplayEvent, () => void>()
    for (const event of events) {
      const handler = () => callback(event)
      handlers.set(event, handler)
      this.screenApi.on(event, handler)
    }
    return () => {
      for (const [event, handler] of handlers) this.screenApi?.removeListener(event, handler)
    }
  }
}
