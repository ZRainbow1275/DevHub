export interface BroadcastBatcherOptions<T> {
  channel: string
  maxBatchSize: number
  maxBufferBytes: number
  windowMs: number
  estimateSize?: (item: T) => number
}

export interface BatcherStats {
  enqueued: number
  flushed: number
  dropped: number
  currentBufferBytes: number
  currentBufferItems: number
  lastFlushAt: number | null
  avgBatchSize: number
}

interface FlushMeta {
  truncated: boolean
}

type FlushHandler<T> = (batch: T[], seq: number, meta: FlushMeta) => void

function defaultEstimateSize<T>(item: T): number {
  try {
    return Buffer.byteLength(JSON.stringify(item), 'utf8')
  } catch {
    return 0
  }
}

export class BroadcastBatcher<T> {
  private buffer: T[] = []
  private currentBufferBytes = 0
  private dropped = 0
  private enqueued = 0
  private flushCount = 0
  private handlers = new Set<FlushHandler<T>>()
  private lastFlushAt: number | null = null
  private seq = 0
  private timer: NodeJS.Timeout | null = null
  private totalBatchItems = 0
  private truncatedSinceLastFlush = false

  constructor(private readonly options: BroadcastBatcherOptions<T>) {}

  enqueue(item: T): void {
    const itemSize = (this.options.estimateSize ?? defaultEstimateSize)(item)
    this.enqueued += 1

    if (itemSize > this.options.maxBufferBytes) {
      this.dropped += 1
      this.truncatedSinceLastFlush = true
      return
    }

    if (this.buffer.length > 0 && this.currentBufferBytes + itemSize > this.options.maxBufferBytes) {
      this.flush()
    }

    this.buffer.push(item)
    this.currentBufferBytes += itemSize

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush()
      }, this.options.windowMs)
      this.timer.unref?.()
    }

    if (this.buffer.length >= this.options.maxBatchSize) {
      this.flush()
    }
  }

  flush(): void {
    if (this.buffer.length === 0) {
      this.clearTimer()
      return
    }

    const batch = this.buffer
    const truncated = this.truncatedSinceLastFlush

    this.buffer = []
    this.currentBufferBytes = 0
    this.truncatedSinceLastFlush = false
    this.clearTimer()

    this.seq += 1
    this.flushCount += 1
    this.totalBatchItems += batch.length
    this.lastFlushAt = Date.now()

    for (const handler of this.handlers) {
      handler(batch, this.seq, { truncated })
    }
  }

  async close(): Promise<void> {
    this.flush()
    this.clearTimer()
    this.handlers.clear()
  }

  onFlush(handler: FlushHandler<T>): { dispose: () => void } {
    this.handlers.add(handler)
    return {
      dispose: () => {
        this.handlers.delete(handler)
      }
    }
  }

  getStats(): BatcherStats {
    return {
      enqueued: this.enqueued,
      flushed: this.flushCount,
      dropped: this.dropped,
      currentBufferBytes: this.currentBufferBytes,
      currentBufferItems: this.buffer.length,
      lastFlushAt: this.lastFlushAt,
      avgBatchSize: this.flushCount > 0 ? this.totalBatchItems / this.flushCount : 0
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
