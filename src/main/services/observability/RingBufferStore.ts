import {
  observabilityConfigSchema,
  type MetricKind,
  type ObservabilityConfig,
  type ObservabilityMetricSample
} from '@shared/schemas/observability'

const METRIC_KIND_COUNT = 11
const DEFAULT_MAX_SAMPLES = 120_000

export interface RingBufferStoreSnapshot {
  readonly config: ObservabilityConfig
  readonly effectiveSamplingHz: number
  readonly samples: readonly ObservabilityMetricSample[]
  readonly windowStart: number
  readonly windowEnd: number
}

export class RingBufferStore {
  private config = observabilityConfigSchema.parse({})
  private effectiveSamplingHz = this.config.samplingHz
  private readonly samples: ObservabilityMetricSample[] = []

  constructor(
    initialConfig: Partial<ObservabilityConfig> = {},
    private readonly maxSamples = DEFAULT_MAX_SAMPLES
  ) {
    this.configure(initialConfig)
  }

  add(sample: ObservabilityMetricSample): void {
    this.samples.push(sample)
    this.prune(sample.ts)
    this.degradeSamplingIfNeeded()
  }

  addMany(samples: readonly ObservabilityMetricSample[]): void {
    for (const sample of samples) {
      this.samples.push(sample)
    }

    const latest = samples.reduce((max, sample) => Math.max(max, sample.ts), Date.now())
    this.prune(latest)
    this.degradeSamplingIfNeeded()
  }

  configure(config: Partial<ObservabilityConfig>): RingBufferStoreSnapshot {
    this.config = observabilityConfigSchema.parse({ ...this.config, ...config })
    this.effectiveSamplingHz = this.config.samplingHz
    this.prune(Date.now())
    this.degradeSamplingIfNeeded()
    return this.snapshot()
  }

  snapshot(sinceMs?: number, now = Date.now()): RingBufferStoreSnapshot {
    const windowStart = typeof sinceMs === 'number'
      ? Math.max(0, sinceMs)
      : Math.max(0, now - this.config.ringBufferMinutes * 60_000)
    const windowEnd = now

    return {
      config: this.config,
      effectiveSamplingHz: this.effectiveSamplingHz,
      samples: this.samples.filter(sample => sample.ts >= windowStart && sample.ts <= windowEnd),
      windowStart,
      windowEnd
    }
  }

  getConfig(): ObservabilityConfig {
    return this.config
  }

  getEffectiveSamplingHz(): number {
    return this.effectiveSamplingHz
  }

  shouldSample(kind: MetricKind, now = Date.now()): boolean {
    if (kind === 'state-transition' || kind === 'rate-limit-reject') {
      return true
    }

    const latest = this.findLatest(kind)
    if (!latest) {
      return true
    }

    const intervalMs = 1000 / this.effectiveSamplingHz
    return now - latest.ts >= intervalMs
  }

  private findLatest(kind: MetricKind): ObservabilityMetricSample | null {
    for (let index = this.samples.length - 1; index >= 0; index -= 1) {
      if (this.samples[index].kind === kind) {
        return this.samples[index]
      }
    }

    return null
  }

  private prune(now: number): void {
    const windowStart = Math.max(0, now - this.config.ringBufferMinutes * 60_000)
    while (this.samples.length > 0 && this.samples[0].ts < windowStart) {
      this.samples.shift()
    }

    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples)
    }
  }

  private degradeSamplingIfNeeded(): void {
    const pressure = this.samples.length / this.maxSamples
    if (pressure >= 0.95) {
      this.effectiveSamplingHz = Math.min(this.config.samplingHz, 0.2)
      return
    }

    if (pressure >= 0.8) {
      this.effectiveSamplingHz = Math.min(this.config.samplingHz, 0.5)
      return
    }

    const defaultTarget = Math.max(0.1, Math.min(this.config.samplingHz, this.maxSamples / (this.config.ringBufferMinutes * 60 * METRIC_KIND_COUNT)))
    this.effectiveSamplingHz = Math.min(this.config.samplingHz, defaultTarget)
  }
}
