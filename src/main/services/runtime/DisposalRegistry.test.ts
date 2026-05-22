import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DisposalRegistry, resetDisposalRegistryForTests } from './DisposalRegistry'

describe('DisposalRegistry', () => {
  beforeEach(() => {
    resetDisposalRegistryForTests()
    vi.useFakeTimers()
  })

  afterEach(() => {
    resetDisposalRegistryForTests()
    vi.useRealTimers()
  })

  it('disposes registered entries in order and clears pending state', async () => {
    const order: string[] = []
    const registry = DisposalRegistry.getInstance()

    registry.register({
      name: 'first',
      dispose: () => {
        order.push('first')
      }
    })
    registry.register({
      name: 'second',
      dispose: async () => {
        order.push('second')
      }
    })

    const report = await registry.disposeAll()

    expect(order).toEqual(['first', 'second'])
    expect(report.succeeded).toEqual(['first', 'second'])
    expect(report.failed).toEqual([])
    expect(report.timedOut).toEqual([])
    expect(report.remainingAfter).toEqual([])
    expect(registry.remaining()).toEqual([])
    expect(registry.getLastReport()).toEqual(report)
  })

  it('records failures and timeouts in the disposal report', async () => {
    const registry = DisposalRegistry.getInstance()

    registry.register({
      name: 'throws',
      dispose: () => {
        throw new Error('boom')
      }
    })
    registry.register({
      name: 'hangs',
      dispose: () => new Promise<void>(() => {})
    })

    const reportPromise = registry.disposeAll(25)
    await vi.advanceTimersByTimeAsync(30)
    const report = await reportPromise

    expect(report.succeeded).toEqual([])
    expect(report.failed).toEqual([
      {
        name: 'throws',
        reason: 'boom'
      }
    ])
    expect(report.timedOut).toEqual(['hangs'])
    expect(report.remainingAfter).toEqual([])
  })
})
