import {
  signalContributionSnapshotSchema,
  type SignalContributionSnapshot
} from '@shared/schemas/signal-fusion'

export class SignalContributionTracker {
  private readonly snapshots = new Map<string, SignalContributionSnapshot>()

  constructor(private readonly maxEntries = 1_000) {}

  record(snapshot: SignalContributionSnapshot): SignalContributionSnapshot {
    const parsed = signalContributionSnapshotSchema.parse(snapshot)
    this.snapshots.set(parsed.instanceId, parsed)
    this.pruneOldest()
    return parsed
  }

  get(instanceId: string): SignalContributionSnapshot | null {
    return this.snapshots.get(instanceId) ?? null
  }

  list(): SignalContributionSnapshot[] {
    return Array.from(this.snapshots.values()).sort((left, right) => right.fusedAt - left.fusedAt)
  }

  private pruneOldest(): void {
    if (this.snapshots.size <= this.maxEntries) return
    const oldest = this.list().at(-1)
    if (oldest) this.snapshots.delete(oldest.instanceId)
  }
}
