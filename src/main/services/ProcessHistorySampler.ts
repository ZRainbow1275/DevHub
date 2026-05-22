import type { ProcessInfo } from '@shared/types-extended'
import { processHistoryPointSchema, TAG_HISTORY_LIMITS, type ProcessHistory } from '@shared/schemas/r8-runtime'
import { makeProcessTagKey } from './ProcessTagStore'
import { ProcessHistoryStore } from './ProcessHistoryStore'

const SAMPLE_INTERVAL_MS = TAG_HISTORY_LIMITS.SAMPLE_INTERVAL_S * 1000
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000

export class ProcessHistorySampler {
  private readonly lastSampleByKey = new Map<string, number>()
  private lastCleanupAt = 0

  constructor(
    private readonly store: ProcessHistoryStore = new ProcessHistoryStore(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  sampleProcess(process: ProcessInfo): boolean {
    const exe = process.name
    const key = makeProcessTagKey(exe, process.workingDir)
    const ts = this.now()
    const previous = this.lastSampleByKey.get(key) ?? 0
    if (previous > 0 && ts - previous < SAMPLE_INTERVAL_MS) {
      return false
    }

    this.store.insert(key, processHistoryPointSchema.parse({
      ts,
      cpu: Number.isFinite(process.cpu) ? Math.max(0, process.cpu) : null,
      rssMb: Number.isFinite(process.memory) ? Math.max(0, process.memory) : null,
      missing: false,
    }))
    this.lastSampleByKey.set(key, ts)
    this.cleanupIfDue(ts)
    return true
  }

  historyFor(exe: string, cwd?: string): ProcessHistory {
    return this.store.historyFor(exe, cwd, this.now())
  }

  batchByKeys(keys: string[]): ProcessHistory[] {
    return this.store.batchByKeys(keys, this.now())
  }

  cleanupIfDue(ts: number = this.now()): void {
    if (ts - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return
    this.store.cleanup(ts)
    this.lastCleanupAt = ts
  }

  close(): void {
    this.store.close()
  }
}
