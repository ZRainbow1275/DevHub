import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import type { Database as DatabaseHandle } from 'better-sqlite3'
import { loadBetterSqlite } from './sqlite/betterSqliteLoader'
import {
  processHistoryPointSchema,
  processHistorySchema,
  TAG_HISTORY_LIMITS,
  type ProcessHistory,
  type ProcessHistoryPoint,
} from '@shared/schemas/r8-runtime'
import { makeProcessTagKey } from './ProcessTagStore'

interface HistoryRow {
  ts: number
  cpu: number | null
  rss_mb: number | null
  handles: number | null
  threads: number | null
  missing?: number
}

const HISTORY_WINDOW_MS = TAG_HISTORY_LIMITS.HISTORY_WINDOW_HOURS * 60 * 60 * 1000
const SAMPLE_INTERVAL_MS = TAG_HISTORY_LIMITS.SAMPLE_INTERVAL_S * 1000
const RETENTION_MS = TAG_HISTORY_LIMITS.SQLITE_RETENTION_DAYS * 24 * 60 * 60 * 1000

function defaultDbPath(): string {
  return path.join(app.getPath('userData'), 'process-history.sqlite3')
}

function rowToPoint(row: HistoryRow): ProcessHistoryPoint {
  return processHistoryPointSchema.parse({
    ts: row.ts,
    cpu: row.cpu,
    rssMb: row.rss_mb,
    handles: row.handles ?? undefined,
    threads: row.threads ?? undefined,
    missing: row.missing === 1,
  })
}

export class ProcessHistoryStore {
  private readonly db: DatabaseHandle | null
  private readonly fallback = new Map<string, ProcessHistoryPoint[]>()

  constructor(dbPath: string = defaultDbPath()) {
    let database: DatabaseHandle | null = null
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true })
      const DatabaseConstructor = loadBetterSqlite()
      database = new DatabaseConstructor(dbPath)
      database.exec(`
        CREATE TABLE IF NOT EXISTS process_history (
          key TEXT NOT NULL,
          ts INTEGER NOT NULL,
          cpu REAL,
          rss_mb REAL,
          handles INTEGER,
          threads INTEGER,
          missing INTEGER DEFAULT 0,
          PRIMARY KEY(key, ts)
        );
        CREATE INDEX IF NOT EXISTS idx_process_history_ts ON process_history(ts);
      `)
    } catch (error) {
      console.warn('ProcessHistoryStore: SQLite unavailable, using in-memory history:', error instanceof Error ? error.message : error)
      database = null
    }
    this.db = database
  }

  insert(key: string, point: ProcessHistoryPoint): void {
    const parsed = processHistoryPointSchema.parse(point)
    if (this.db) {
      this.db.prepare(`
        INSERT OR REPLACE INTO process_history (key, ts, cpu, rss_mb, handles, threads, missing)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        key,
        parsed.ts,
        parsed.cpu,
        parsed.rssMb,
        parsed.handles ?? null,
        parsed.threads ?? null,
        parsed.missing ? 1 : 0,
      )
      return
    }

    const points = this.fallback.get(key) ?? []
    points.push(parsed)
    const cutoff = Date.now() - RETENTION_MS
    this.fallback.set(key, points.filter(item => item.ts >= cutoff).slice(-TAG_HISTORY_LIMITS.MAX_POINTS_PER_KEY * TAG_HISTORY_LIMITS.SQLITE_RETENTION_DAYS))
  }

  historyFor(exe: string, cwd?: string, now: number = Date.now()): ProcessHistory {
    const key = makeProcessTagKey(exe, cwd)
    return processHistorySchema.parse({
      key,
      exe,
      cwd,
      windowMs: HISTORY_WINDOW_MS,
      points: this.withGapMarkers(this.queryByKey(key, now - HISTORY_WINDOW_MS)),
    })
  }

  batchByKeys(keys: string[], now: number = Date.now()): ProcessHistory[] {
    const since = now - HISTORY_WINDOW_MS
    return keys.map(key => processHistorySchema.parse({
      key,
      exe: '',
      windowMs: HISTORY_WINDOW_MS,
      points: this.withGapMarkers(this.queryByKey(key, since)),
    }))
  }

  cleanup(now: number = Date.now()): number {
    const cutoff = now - RETENTION_MS
    if (this.db) {
      const result = this.db.prepare('DELETE FROM process_history WHERE ts < ?').run(cutoff)
      return Number(result.changes)
    }
    let removed = 0
    for (const [key, points] of this.fallback.entries()) {
      const retained = points.filter(point => point.ts >= cutoff)
      removed += points.length - retained.length
      this.fallback.set(key, retained)
    }
    return removed
  }

  close(): void {
    this.db?.close()
  }

  private queryByKey(key: string, sinceMs: number): ProcessHistoryPoint[] {
    if (this.db) {
      const rows = this.db.prepare(`
        SELECT ts, cpu, rss_mb, handles, threads, missing
        FROM process_history
        WHERE key = ? AND ts >= ?
        ORDER BY ts ASC
      `).all(key, sinceMs) as HistoryRow[]
      return rows.map(rowToPoint)
    }
    return (this.fallback.get(key) ?? []).filter(point => point.ts >= sinceMs).sort((left, right) => left.ts - right.ts)
  }

  private withGapMarkers(points: ProcessHistoryPoint[]): ProcessHistoryPoint[] {
    if (points.length < 2) return points
    const result: ProcessHistoryPoint[] = []
    for (const point of points) {
      const previous = result[result.length - 1]
      if (previous) {
        let missingTs = previous.ts + SAMPLE_INTERVAL_MS
        while (missingTs < point.ts - SAMPLE_INTERVAL_MS / 2 && result.length < TAG_HISTORY_LIMITS.MAX_POINTS_PER_KEY + 60) {
          result.push(processHistoryPointSchema.parse({
            ts: missingTs,
            cpu: null,
            rssMb: null,
            missing: true,
          }))
          missingTs += SAMPLE_INTERVAL_MS
        }
      }
      result.push(point)
    }
    return result.slice(-TAG_HISTORY_LIMITS.MAX_POINTS_PER_KEY - 60)
  }
}
