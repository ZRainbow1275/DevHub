import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import DatabaseConstructor, { type Database as DatabaseHandle } from 'better-sqlite3'
import {
  misreportRecordSchema,
  weightAdjustmentSchema,
  type MisreportRecord,
  type WeightAdjustment
} from '@shared/schemas/misreport'
import type { SignalSource } from '@shared/schemas/signal-fusion'

interface MisreportRow {
  payload: string
}

interface AdjustmentSummaryRow {
  source: SignalSource
  delta: number | null
}

export interface MisreportLoggerOptions {
  dbPath: string
  fallbackJsonlPath?: string
}

export class MisreportLogger {
  private db: DatabaseHandle | null = null

  constructor(private readonly options: MisreportLoggerOptions) {}

  record(record: MisreportRecord, adjustments: WeightAdjustment[]): void {
    const parsedRecord = misreportRecordSchema.parse(record)
    const parsedAdjustments = adjustments.map(adjustment => weightAdjustmentSchema.parse(adjustment))
    try {
      const db = this.database()
      const insertRecord = db.prepare(`
        INSERT INTO misreports (id, instance_id, kind, reported_by, reported_at, expected_task_state, user_note, payload)
        VALUES (@id, @instanceId, @kind, @reportedBy, @reportedAt, @expectedTaskState, @userNote, @payload)
      `)
      const insertAdjustment = db.prepare(`
        INSERT INTO weight_adjustments (id, misreport_id, source, old_weight, new_weight, delta, applied_at, payload)
        VALUES (@id, @misreportId, @source, @oldWeight, @newWeight, @delta, @appliedAt, @payload)
      `)
      const transaction = db.transaction(() => {
        insertRecord.run({
          id: parsedRecord.id,
          instanceId: parsedRecord.instanceId,
          kind: parsedRecord.kind,
          reportedBy: parsedRecord.reportedBy,
          reportedAt: parsedRecord.reportedAt,
          expectedTaskState: parsedRecord.expectedTaskState ?? null,
          userNote: parsedRecord.userNote ?? null,
          payload: JSON.stringify(parsedRecord)
        })
        for (const adjustment of parsedAdjustments) {
          insertAdjustment.run({
            id: `${adjustment.triggeredByMisreportId}:${adjustment.source}`,
            misreportId: adjustment.triggeredByMisreportId,
            source: adjustment.source,
            oldWeight: adjustment.oldWeight,
            newWeight: adjustment.newWeight,
            delta: adjustment.delta,
            appliedAt: adjustment.appliedAt,
            payload: JSON.stringify(adjustment)
          })
        }
      })
      transaction()
    } catch (error) {
      this.writeFallback(parsedRecord, parsedAdjustments, error)
    }
  }

  list(input: { since?: number } = {}): MisreportRecord[] {
    try {
      const rows = this.database().prepare('SELECT payload FROM misreports WHERE reported_at >= ? ORDER BY reported_at DESC LIMIT 500').all(input.since ?? 0) as MisreportRow[]
      return rows.map(row => misreportRecordSchema.parse(JSON.parse(row.payload)))
    } catch {
      return []
    }
  }

  latestForInstance(instanceId: string): MisreportRecord | null {
    try {
      const row = this.database().prepare('SELECT payload FROM misreports WHERE instance_id = ? ORDER BY reported_at DESC LIMIT 1').get(instanceId) as MisreportRow | undefined
      return row ? misreportRecordSchema.parse(JSON.parse(row.payload)) : null
    } catch {
      return null
    }
  }

  cumulativeDeltas(): Partial<Record<SignalSource, number>> {
    try {
      const rows = this.database().prepare('SELECT source, SUM(delta) AS delta FROM weight_adjustments GROUP BY source').all() as AdjustmentSummaryRow[]
      return rows.reduce<Partial<Record<SignalSource, number>>>((totals, row) => {
        totals[row.source] = Number(row.delta) || 0
        return totals
      }, {})
    } catch {
      return {}
    }
  }

  clearAdjustments(): void {
    try {
      this.database().prepare('DELETE FROM weight_adjustments').run()
    } catch {
      return
    }
  }

  close(): void {
    if (this.db?.open) this.db.close()
    this.db = null
  }

  private database(): DatabaseHandle {
    if (this.db?.open) return this.db
    mkdirSync(dirname(this.options.dbPath), { recursive: true })
    const db = new DatabaseConstructor(this.options.dbPath)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS misreports (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        reported_by TEXT NOT NULL,
        reported_at INTEGER NOT NULL,
        expected_task_state TEXT,
        user_note TEXT,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_misreports_instance_time ON misreports(instance_id, reported_at DESC);
      CREATE INDEX IF NOT EXISTS idx_misreports_reported_at ON misreports(reported_at DESC);
      CREATE TABLE IF NOT EXISTS weight_adjustments (
        id TEXT PRIMARY KEY,
        misreport_id TEXT NOT NULL,
        source TEXT NOT NULL,
        old_weight REAL NOT NULL,
        new_weight REAL NOT NULL,
        delta REAL NOT NULL,
        applied_at INTEGER NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY(misreport_id) REFERENCES misreports(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_weight_adjustments_source ON weight_adjustments(source);
    `)
    this.db = db
    return db
  }

  private writeFallback(record: MisreportRecord, adjustments: WeightAdjustment[], error: unknown): void {
    const fallbackPath = this.options.fallbackJsonlPath ?? join(dirname(this.options.dbPath), 'misreports-fallback.jsonl')
    mkdirSync(dirname(fallbackPath), { recursive: true })
    appendFileSync(fallbackPath, `${JSON.stringify({ record, adjustments, error: error instanceof Error ? error.message : String(error), fallbackAt: Date.now() })}
`, 'utf8')
  }
}
