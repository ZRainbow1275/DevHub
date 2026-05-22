import type { ChannelRpmEntry, ChannelRpmReport } from '@shared/observability'

export class IpcChannelCounter {
  private readonly channels = new Map<string, number[]>()
  private readonly totals = new Map<string, number>()

  constructor(
    private readonly windowMs = 60_000,
    private readonly maxTrackedChannels = 256
  ) {}

  track(channel: string, now = Date.now()): void {
    const key = channel.trim()
    if (!key) {
      return
    }

    this.ensureCapacity(key)

    const timestamps = this.channels.get(key) ?? []
    timestamps.push(now)
    this.channels.set(key, timestamps)
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1)

    this.pruneChannel(key, now)
  }

  getReport(windowMs = this.windowMs, limit = 10, now = Date.now()): ChannelRpmReport {
    const rows: ChannelRpmEntry[] = []

    for (const [channel, timestamps] of this.channels) {
      const filtered = timestamps.filter((ts) => now - ts <= windowMs)
      if (filtered.length !== timestamps.length) {
        this.channels.set(channel, filtered)
      }

      const totalSinceBoot = this.totals.get(channel) ?? 0
      const rpm = Math.round((filtered.length / windowMs) * 60_000)

      if (filtered.length > 0 || totalSinceBoot > 0) {
        rows.push({
          channel,
          rpm,
          totalSinceBoot
        })
      }
    }

    rows.sort((left, right) => {
      if (right.rpm !== left.rpm) {
        return right.rpm - left.rpm
      }
      return right.totalSinceBoot - left.totalSinceBoot
    })

    return {
      generatedAt: now,
      windowMs,
      top: rows.slice(0, limit),
      truncated: rows.length > limit
    }
  }

  reset(): void {
    this.channels.clear()
    this.totals.clear()
  }

  private ensureCapacity(channel: string): void {
    if (this.channels.has(channel) || this.channels.size < this.maxTrackedChannels) {
      return
    }

    let evictionCandidate: string | null = null
    let lowestTotal = Number.POSITIVE_INFINITY

    for (const [trackedChannel, total] of this.totals) {
      if (total < lowestTotal) {
        lowestTotal = total
        evictionCandidate = trackedChannel
      }
    }

    if (evictionCandidate) {
      this.channels.delete(evictionCandidate)
      this.totals.delete(evictionCandidate)
    }
  }

  private pruneChannel(channel: string, now: number): void {
    const timestamps = this.channels.get(channel)
    if (!timestamps) {
      return
    }

    while (timestamps.length > 0 && now - timestamps[0] > this.windowMs) {
      timestamps.shift()
    }
  }
}
