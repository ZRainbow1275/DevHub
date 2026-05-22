import { beforeEach, describe, expect, it } from 'vitest'
import {
  PORT_POPOUT_POSITION_MEMORY_STORAGE_KEY,
  normalizePortPopoutMemoryValue,
  readPortPopoutMemory,
  writePortPopoutMemory
} from './popoutPositionMemory'

describe('R8.B popout position memory', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('normalizes both legacy position-only memory and current position-plus-size memory', () => {
    expect(normalizePortPopoutMemoryValue({ x: 12, y: 24 })).toEqual({ x: 12, y: 24 })
    expect(normalizePortPopoutMemoryValue({
      position: { x: 32, y: 48 },
      size: { width: 420, height: 300 }
    })).toEqual({
      position: { x: 32, y: 48 },
      size: { width: 420, height: 300 }
    })
    expect(normalizePortPopoutMemoryValue({ position: { x: 'bad', y: 0 } })).toBeNull()
  })

  it('reads only valid real storage entries and ignores corrupt payloads safely', () => {
    window.localStorage.setItem(PORT_POPOUT_POSITION_MEMORY_STORAGE_KEY, JSON.stringify({
      'port:3000:pid:4242': { x: 12, y: 24 },
      'port:3001:pid:4243': {
        position: { x: 32, y: 48 },
        size: { width: 420, height: 300 }
      },
      'port:bad': { position: { x: 0, y: Number.NaN } }
    }))

    expect(readPortPopoutMemory()).toEqual({
      'port:3000:pid:4242': { x: 12, y: 24 },
      'port:3001:pid:4243': {
        position: { x: 32, y: 48 },
        size: { width: 420, height: 300 }
      }
    })

    window.localStorage.setItem(PORT_POPOUT_POSITION_MEMORY_STORAGE_KEY, '{')
    expect(readPortPopoutMemory()).toEqual({})
  })

  it('persists position and size memory under the stable R8.B storage key', () => {
    writePortPopoutMemory({
      'port:3000:pid:4242': {
        position: { x: 120, y: 96 },
        size: { width: 480, height: 360 }
      }
    })

    expect(JSON.parse(window.localStorage.getItem(PORT_POPOUT_POSITION_MEMORY_STORAGE_KEY) ?? '{}')).toEqual({
      'port:3000:pid:4242': {
        position: { x: 120, y: 96 },
        size: { width: 480, height: 360 }
      }
    })
  })
})
