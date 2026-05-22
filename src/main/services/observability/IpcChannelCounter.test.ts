import { describe, expect, it } from 'vitest'
import { IpcChannelCounter } from './IpcChannelCounter'

describe('IpcChannelCounter', () => {
  it('should aggregate rpm and total counts within the active window', () => {
    const counter = new IpcChannelCounter(60_000)

    counter.track('scanner:retry', 1_000)
    counter.track('scanner:retry', 31_000)
    counter.track('window:minimize', 45_000)

    const report = counter.getReport(60_000, 10, 61_000)

    expect(report.top).toEqual([
      {
        channel: 'scanner:retry',
        rpm: 2,
        totalSinceBoot: 2
      },
      {
        channel: 'window:minimize',
        rpm: 1,
        totalSinceBoot: 1
      }
    ])
    expect(report.truncated).toBe(false)
  })

  it('should keep totalSinceBoot while pruning expired timestamps', () => {
    const counter = new IpcChannelCounter(60_000)

    counter.track('log:subscribe', 0)
    counter.track('log:subscribe', 1_000)

    const report = counter.getReport(60_000, 10, 120_000)

    expect(report.top).toEqual([
      {
        channel: 'log:subscribe',
        rpm: 0,
        totalSinceBoot: 2
      }
    ])
  })

  it('should truncate report output to the requested limit', () => {
    const counter = new IpcChannelCounter(60_000)

    counter.track('channel:a', 1_000)
    counter.track('channel:b', 1_000)
    counter.track('channel:c', 1_000)

    const report = counter.getReport(60_000, 2, 2_000)

    expect(report.top).toHaveLength(2)
    expect(report.truncated).toBe(true)
  })

  it('should evict the lowest-volume channel when capacity is exceeded', () => {
    const counter = new IpcChannelCounter(60_000, 2)

    counter.track('channel:a', 1_000)
    counter.track('channel:b', 2_000)
    counter.track('channel:b', 3_000)
    counter.track('channel:c', 4_000)

    const report = counter.getReport(60_000, 10, 5_000)

    expect(report.top.map((entry) => entry.channel)).toEqual(['channel:b', 'channel:c'])
  })

  it('should reset all counters', () => {
    const counter = new IpcChannelCounter(60_000)

    counter.track('channel:a', 1_000)
    counter.reset()

    const report = counter.getReport(60_000, 10, 2_000)

    expect(report.top).toEqual([])
    expect(report.truncated).toBe(false)
  })
})
