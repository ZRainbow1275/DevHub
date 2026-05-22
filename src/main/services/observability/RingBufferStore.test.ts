import { describe, expect, it } from 'vitest'
import { RingBufferStore } from './RingBufferStore'

describe('RingBufferStore', () => {
  it('keeps samples inside the configured local time window', () => {
    const store = new RingBufferStore({ ringBufferMinutes: 5, samplingHz: 1 }, 100)
    const now = 1_000_000

    store.add({ kind: 'cpu-pct', ts: now - 6 * 60_000, value: 10 })
    store.add({ kind: 'cpu-pct', ts: now - 60_000, value: 20 })

    const snapshot = store.snapshot(undefined, now)

    expect(snapshot.samples).toEqual([{ kind: 'cpu-pct', ts: now - 60_000, value: 20 }])
    expect(snapshot.config.ringBufferMinutes).toBe(5)
  })

  it('degrades effective sampling under bounded-buffer pressure', () => {
    const store = new RingBufferStore({ ringBufferMinutes: 30, samplingHz: 10 }, 10)
    const now = 2_000_000

    for (let index = 0; index < 10; index += 1) {
      store.add({ kind: 'memory-rss', ts: now + index, value: index })
    }

    expect(store.getEffectiveSamplingHz()).toBeLessThanOrEqual(0.2)
    expect(store.snapshot(undefined, now + 10).samples.length).toBeLessThanOrEqual(10)
  })
})
