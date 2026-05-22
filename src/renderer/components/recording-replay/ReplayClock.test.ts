import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReplayClock } from './ReplayClock'

describe('ReplayClock', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('advances cursor by speed-scaled RAF deltas and pauses at the end bound', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const snapshots: Array<{ cursorTs: number; paused: boolean; speed: number }> = []
    const clock = new ReplayClock({ startedAtAbsTs: 1000, endedAtAbsTs: 10000 }, { cursorTs: 1000, paused: true, speed: 4 })
    clock.subscribe(snapshot => snapshots.push(snapshot))

    clock.play()
    callbacks.shift()?.(0)
    callbacks.shift()?.(1000)
    expect(snapshots.at(-1)).toMatchObject({ cursorTs: 5000, paused: false, speed: 4 })

    callbacks.shift()?.(3000)
    expect(snapshots.at(-1)).toMatchObject({ cursorTs: 10000, paused: true, speed: 4 })

    clock.dispose()
  })
})
