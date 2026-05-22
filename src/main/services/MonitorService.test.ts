import { describe, expect, it, vi } from 'vitest'
import { MonitorService, type DisplayEvent } from './MonitorService'

describe('MonitorService', () => {
  it('normalizes Electron display metadata into R8 monitor contracts', () => {
    const callback = vi.fn()
    const service = new MonitorService({
      getPrimaryDisplay: () => ({
        id: 10,
        label: 'Primary Panel',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
        rotation: 0,
        internal: true
      }),
      getAllDisplays: () => [{
        id: 10,
        label: 'Primary Panel',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
        rotation: 0,
        internal: true
      }],
      on: callback,
      removeListener: vi.fn()
    })

    expect(service.list().monitors).toEqual([{
      id: 10,
      name: 'Primary Panel',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      primary: true,
      rotation: 0,
      internal: true
    }])
  })

  it('supports display-id and zero-based-index lookup', () => {
    const service = new MonitorService({
      getPrimaryDisplay: () => ({
        id: 20,
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        workArea: { x: 0, y: 0, width: 100, height: 100 },
        scaleFactor: 1
      }),
      getAllDisplays: () => [
        {
          id: 20,
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          workArea: { x: 0, y: 0, width: 100, height: 100 },
          scaleFactor: 1
        },
        {
          id: 42,
          bounds: { x: 100, y: 0, width: 100, height: 100 },
          workArea: { x: 100, y: 0, width: 100, height: 100 },
          scaleFactor: 1
        }
      ],
      on: vi.fn(),
      removeListener: vi.fn()
    })

    expect(service.findByIdOrIndex(42)?.id).toBe(42)
    expect(service.findByIdOrIndex(1)?.id).toBe(42)
  })

  it('emits typed display watch events and detaches listeners', () => {
    const listeners = new Map<DisplayEvent, () => void>()
    const on = vi.fn((event: DisplayEvent, callback: () => void) => {
      listeners.set(event, callback)
    })
    const removeListener = vi.fn((event: DisplayEvent, callback: () => void) => {
      expect(callback).toBe(listeners.get(event))
      listeners.delete(event)
    })
    const service = new MonitorService({
      getPrimaryDisplay: () => ({
        id: 20,
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        workArea: { x: 0, y: 0, width: 100, height: 100 },
        scaleFactor: 1
      }),
      getAllDisplays: () => [],
      on,
      removeListener
    })
    const callback = vi.fn()

    const unsubscribe = service.watch(callback)
    listeners.get('display-removed')?.()
    unsubscribe()

    expect(on).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenCalledWith('display-removed')
    expect(removeListener).toHaveBeenCalledTimes(3)
    expect(listeners.size).toBe(0)
  })
})
