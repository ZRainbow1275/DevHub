import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BroadcastBatcher } from './BroadcastBatcher'

describe('BroadcastBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('coalesces enqueues within the same window into one flush', async () => {
    const onFlush = vi.fn()
    const batcher = new BroadcastBatcher<number>({
      channel: 'test',
      maxBatchSize: 10,
      maxBufferBytes: 1024,
      windowMs: 100
    })

    batcher.onFlush(onFlush)
    batcher.enqueue(1)
    batcher.enqueue(2)
    batcher.enqueue(3)

    expect(onFlush).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([1, 2, 3], 1, { truncated: false })
  })

  it('flushes immediately when maxBatchSize is reached', () => {
    const onFlush = vi.fn()
    const batcher = new BroadcastBatcher<number>({
      channel: 'test',
      maxBatchSize: 3,
      maxBufferBytes: 1024,
      windowMs: 1000
    })

    batcher.onFlush(onFlush)
    batcher.enqueue(1)
    batcher.enqueue(2)
    batcher.enqueue(3)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([1, 2, 3], 1, { truncated: false })
  })

  it('marks the next flush as truncated when oversized items are dropped', async () => {
    const onFlush = vi.fn()
    const batcher = new BroadcastBatcher<string>({
      channel: 'test',
      maxBatchSize: 10,
      maxBufferBytes: 16,
      windowMs: 100
    })

    batcher.onFlush(onFlush)
    batcher.enqueue('x'.repeat(32))
    batcher.enqueue('ok')

    await vi.advanceTimersByTimeAsync(100)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith(['ok'], 1, { truncated: true })
    expect(batcher.getStats().dropped).toBe(1)
  })
})
