import { STATUSBAR_LIMITS, statusAggregateSchema, type StatusAggregate } from '@shared/schemas/r8-runtime'

export interface StatusAggregatorOptions {
  readonly intervalMs?: number
  readonly readAggregate: () => StatusAggregate | Promise<StatusAggregate>
  readonly publish: (aggregate: StatusAggregate) => void
  readonly onError?: (error: unknown) => void
}

export interface StatusAggregatorPublishResult {
  readonly success: boolean
  readonly aggregate?: StatusAggregate
  readonly error?: string
}

export class StatusAggregator {
  private interval: NodeJS.Timeout | null = null
  private publishing = false

  constructor(private readonly options: StatusAggregatorOptions) {}

  start(): void {
    if (this.interval) return
    void this.publishNow()
    this.interval = setInterval(() => {
      void this.publishNow()
    }, this.options.intervalMs ?? STATUSBAR_LIMITS.REFRESH_INTERVAL_MS)
    this.interval.unref?.()
  }

  stop(): void {
    if (!this.interval) return
    clearInterval(this.interval)
    this.interval = null
  }

  isRunning(): boolean {
    return this.interval !== null
  }

  async publishNow(): Promise<StatusAggregatorPublishResult> {
    if (this.publishing) return { success: false, error: 'E_STATUSBAR_AGGREGATE_IN_FLIGHT' }
    this.publishing = true
    try {
      const aggregate = statusAggregateSchema.parse(await this.options.readAggregate())
      this.options.publish(aggregate)
      return { success: true, aggregate }
    } catch (error) {
      this.options.onError?.(error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    } finally {
      this.publishing = false
    }
  }
}
