import { unlink } from 'node:fs/promises'
import type { GraphKind, GraphSavedSnapshot, GraphSnapshot } from '@shared/schemas/graph'

interface GraphSnapshotterGraphService {
  buildGlobal(input?: unknown, options?: { refresh?: boolean }): Promise<GraphSnapshot>
  saveSnapshot(input: unknown): Promise<{ saved: boolean; path: string }>
  listSavedSnapshots(): Promise<GraphSavedSnapshot[]>
}

export interface GraphSnapshotterSavedSnapshot {
  snapshotId: string
  graphKind: GraphKind
  label: string
  path: string
  generatedAt: number
  nodeCount: number
  edgeCount: number
}

export interface GraphSnapshotterPrunedSnapshot {
  snapshotId: string
  label: string
  path: string
  savedAt: number
}

export interface GraphSnapshotterPruneError {
  snapshotId: string
  path: string
  error: string
}

export interface GraphSnapshotterRunResult {
  status: 'saved' | 'skipped' | 'error'
  reason: string
  takenAt: number
  saved: GraphSnapshotterSavedSnapshot[]
  pruned: GraphSnapshotterPrunedSnapshot[]
  pruneErrors: GraphSnapshotterPruneError[]
  skippedReason?: 'disabled' | 'already-running'
  error?: string
}

export interface GraphSnapshotterOptions {
  graphService: GraphSnapshotterGraphService
  isEnabled?: () => boolean
  graphKinds?: GraphKind[]
  intervalMs?: number
  retentionMs?: number
  now?: () => number
  onResult?: (result: GraphSnapshotterRunResult) => void
}

const DEFAULT_INTERVAL_MS = 300_000
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000
const AUTO_SNAPSHOT_PREFIX = 'auto-topology'
const AUTO_SNAPSHOT_CONFIRMATION = 'graph-snapshotter'
const DEFAULT_GRAPH_KINDS: GraphKind[] = ['network-topology', 'neural-relationship', 'flow']

export class GraphSnapshotter {
  private timer: NodeJS.Timeout | null = null
  private active = false
  private running = false

  constructor(private readonly options: GraphSnapshotterOptions) {}

  start(): void {
    if (this.active) return
    this.active = true
    this.schedule()
  }

  stop(): void {
    this.active = false
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
  }

  async runOnce(reason = 'manual'): Promise<GraphSnapshotterRunResult> {
    const takenAt = this.now()
    if (this.options.isEnabled?.() === false) {
      return this.emitResult({
        status: 'skipped',
        reason,
        takenAt,
        saved: [],
        pruned: [],
        pruneErrors: [],
        skippedReason: 'disabled'
      })
    }
    if (this.running) {
      return this.emitResult({
        status: 'skipped',
        reason,
        takenAt,
        saved: [],
        pruned: [],
        pruneErrors: [],
        skippedReason: 'already-running'
      })
    }

    this.running = true
    try {
      const saved: GraphSnapshotterSavedSnapshot[] = []
      for (const graphKind of this.graphKinds()) {
        const snapshot = await this.options.graphService.buildGlobal({ scope: 'global', graphKind }, { refresh: true })
        const label = this.labelFor(graphKind, takenAt)
        const result = await this.options.graphService.saveSnapshot({
          snapshotId: snapshot.snapshotId,
          label,
          confirmedBy: AUTO_SNAPSHOT_CONFIRMATION
        })
        saved.push({
          snapshotId: snapshot.snapshotId,
          graphKind,
          label,
          path: result.path,
          generatedAt: snapshot.generatedAt,
          nodeCount: snapshot.nodes.length,
          edgeCount: snapshot.edges.length
        })
      }
      const retention = await this.pruneExpired(takenAt)
      return this.emitResult({
        status: 'saved',
        reason,
        takenAt,
        saved,
        pruned: retention.pruned,
        pruneErrors: retention.pruneErrors
      })
    } catch (error) {
      return this.emitResult({
        status: 'error',
        reason,
        takenAt,
        saved: [],
        pruned: [],
        pruneErrors: [],
        error: errorMessage(error)
      })
    } finally {
      this.running = false
    }
  }

  private schedule(): void {
    if (!this.active || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.runOnce('scheduled').finally(() => {
        if (this.active) this.schedule()
      })
    }, this.intervalMs())
    this.timer.unref?.()
  }

  private async pruneExpired(takenAt: number): Promise<{ pruned: GraphSnapshotterPrunedSnapshot[]; pruneErrors: GraphSnapshotterPruneError[] }> {
    const rows = await this.options.graphService.listSavedSnapshots()
    const pruned: GraphSnapshotterPrunedSnapshot[] = []
    const pruneErrors: GraphSnapshotterPruneError[] = []
    for (const row of rows) {
      if (!isAutoSnapshot(row)) continue
      if (takenAt - row.savedAt <= this.retentionMs()) continue
      try {
        await unlink(row.path)
        pruned.push({ snapshotId: row.id, label: row.label, path: row.path, savedAt: row.savedAt })
      } catch (error) {
        pruneErrors.push({ snapshotId: row.id, path: row.path, error: errorMessage(error) })
      }
    }
    return { pruned, pruneErrors }
  }

  private emitResult(result: GraphSnapshotterRunResult): GraphSnapshotterRunResult {
    try {
      this.options.onResult?.(result)
    } catch {
      return result
    }
    return result
  }

  private graphKinds(): GraphKind[] {
    return this.options.graphKinds ?? DEFAULT_GRAPH_KINDS
  }

  private intervalMs(): number {
    return this.options.intervalMs ?? DEFAULT_INTERVAL_MS
  }

  private retentionMs(): number {
    return this.options.retentionMs ?? DEFAULT_RETENTION_MS
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  private labelFor(graphKind: GraphKind, takenAt: number): string {
    return `${AUTO_SNAPSHOT_PREFIX}:${graphKind}:${new Date(takenAt).toISOString()}`
  }
}

function isAutoSnapshot(row: GraphSavedSnapshot): boolean {
  return row.label.startsWith(`${AUTO_SNAPSHOT_PREFIX}:`)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
