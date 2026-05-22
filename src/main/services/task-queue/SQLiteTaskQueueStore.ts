import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import DatabaseConstructor, { type Database as DatabaseHandle } from 'better-sqlite3'
import {
  taskRunSchema,
  taskStateTransitionSchema,
  type TaskRun,
  type TaskStateTransition
} from '@shared/schemas/r8-runtime'
import type { TaskQueueStore } from './TaskQueueService'

export type QueueStorageBackend = 'sqlite-kv-indexed' | 'electron-store'
export type QueueIntegrityStatus = 'ok' | 'recovered'

export interface SQLiteQueueIntegrityReport {
  status: QueueIntegrityStatus
  checkedAt: number
  dbPath: string
  backupPath: string | null
  error: string | null
}

export interface SQLiteTaskQueueStoreOptions {
  dbPath: string
  now?: () => number
}

interface QueueKvRow {
  payload: string
}

export class SQLiteTaskQueueStore implements TaskQueueStore {
  private readonly now: () => number
  private integrityChecked = false
  private integrityReport: SQLiteQueueIntegrityReport

  constructor(private readonly options: SQLiteTaskQueueStoreOptions) {
    this.now = options.now ?? (() => Date.now())
    this.integrityReport = {
      status: 'ok',
      checkedAt: 0,
      dbPath: options.dbPath,
      backupPath: null,
      error: null
    }
  }

  get(key: string, defaultValue?: unknown): unknown {
    return this.withDatabase(db => {
      const row = db.prepare('SELECT payload FROM queue_kv WHERE key = ?').get(key) as QueueKvRow | undefined
      if (!row) return defaultValue
      try {
        return JSON.parse(row.payload) as unknown
      } catch {
        return defaultValue
      }
    })
  }

  set(key: string, value: unknown): void {
    this.withDatabase(db => {
      const payload = JSON.stringify(value)
      const transaction = db.transaction(() => {
        db.prepare(`
          INSERT INTO queue_kv (key, payload, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
        `).run(key, payload, this.now())
        if (key === 'tasks') this.replaceTaskIndex(db, value)
        if (key === 'taskStateTransitions') this.replaceTransitionIndex(db, value)
      })
      transaction()
    })
  }

  report(): SQLiteQueueIntegrityReport {
    return { ...this.integrityReport }
  }

  private withDatabase<T>(operation: (db: DatabaseHandle) => T): T {
    const db = this.openDatabase()
    try {
      return operation(db)
    } finally {
      db.close()
    }
  }

  private openDatabase(): DatabaseHandle {
    mkdirSync(dirname(this.options.dbPath), { recursive: true })
    if (!this.integrityChecked) this.checkIntegrityOrRecover()
    const db = new DatabaseConstructor(this.options.dbPath)
    db.pragma('journal_mode = WAL')
    this.ensureSchema(db)
    return db
  }

  private checkIntegrityOrRecover(): void {
    this.integrityChecked = true
    const checkedAt = this.now()
    if (!existsSync(this.options.dbPath)) {
      this.integrityReport = {
        status: 'ok',
        checkedAt,
        dbPath: this.options.dbPath,
        backupPath: null,
        error: null
      }
      return
    }

    try {
      const db = new DatabaseConstructor(this.options.dbPath, { readonly: true, fileMustExist: true })
      try {
        const integrity = db.pragma('integrity_check', { simple: true }) as unknown
        if (integrity !== 'ok') throw new Error(`E_INTEGRITY_FAIL:${String(integrity).slice(0, 500)}`)
        this.integrityReport = {
          status: 'ok',
          checkedAt,
          dbPath: this.options.dbPath,
          backupPath: null,
          error: null
        }
      } finally {
        db.close()
      }
    } catch (error) {
      this.backupCorruptDatabase(checkedAt, error)
    }
  }

  private backupCorruptDatabase(checkedAt: number, error: unknown): void {
    const backupPath = `${this.options.dbPath}.bak.${checkedAt}`
    this.renameIfExists(this.options.dbPath, backupPath)
    this.renameIfExists(`${this.options.dbPath}-wal`, `${backupPath}-wal`)
    this.renameIfExists(`${this.options.dbPath}-shm`, `${backupPath}-shm`)
    this.integrityReport = {
      status: 'recovered',
      checkedAt,
      dbPath: this.options.dbPath,
      backupPath,
      error: error instanceof Error ? error.message : String(error)
    }
  }

  private renameIfExists(source: string, target: string): void {
    if (existsSync(source)) renameSync(source, target)
  }

  private ensureSchema(db: DatabaseHandle): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS queue_kv (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_runs (
        run_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        session_id TEXT,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        row_hash TEXT,
        queued_at INTEGER NOT NULL,
        started_at INTEGER,
        ended_at INTEGER,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_runs_session_status ON task_runs(session_id, status);
      CREATE INDEX IF NOT EXISTS idx_task_runs_task_hash ON task_runs(task_id, row_hash);
      CREATE TABLE IF NOT EXISTS task_state_transitions (
        transition_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        session_id TEXT,
        prev_status TEXT NOT NULL,
        next_status TEXT NOT NULL,
        at INTEGER NOT NULL,
        reason TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_state_transitions_session_at ON task_state_transitions(session_id, at);
      CREATE INDEX IF NOT EXISTS idx_task_state_transitions_task_at ON task_state_transitions(task_id, at);
    `)
  }

  private replaceTaskIndex(db: DatabaseHandle, value: unknown): void {
    db.prepare('DELETE FROM task_runs').run()
    if (!Array.isArray(value)) return
    const insert = db.prepare(`
      INSERT INTO task_runs (
        run_id, task_id, session_id, status, attempt_count, row_hash,
        queued_at, started_at, ended_at, payload
      ) VALUES (
        @runId, @taskId, @sessionId, @status, @attemptCount, @rowHash,
        @queuedAt, @startedAt, @endedAt, @payload
      )
    `)
    for (const item of value) {
      const parsed = taskRunSchema.safeParse(item)
      if (!parsed.success) continue
      const task = parsed.data
      insert.run(this.toTaskIndexRow(task))
    }
  }

  private replaceTransitionIndex(db: DatabaseHandle, value: unknown): void {
    db.prepare('DELETE FROM task_state_transitions').run()
    if (!Array.isArray(value)) return
    const insert = db.prepare(`
      INSERT INTO task_state_transitions (
        transition_id, run_id, task_id, session_id, prev_status,
        next_status, at, reason, payload
      ) VALUES (
        @transitionId, @runId, @taskId, @sessionId, @prevStatus,
        @nextStatus, @at, @reason, @payload
      )
    `)
    for (const item of value) {
      const parsed = taskStateTransitionSchema.safeParse(item)
      if (!parsed.success) continue
      insert.run(this.toTransitionIndexRow(parsed.data))
    }
  }

  private toTaskIndexRow(task: TaskRun): Record<string, string | number | null> {
    return {
      runId: task.runId,
      taskId: task.taskId ?? task.row.id,
      sessionId: task.sessionId ?? null,
      status: task.status,
      attemptCount: task.attemptCount,
      rowHash: task.rowHash ?? null,
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      endedAt: task.endedAt,
      payload: JSON.stringify(task)
    }
  }

  private toTransitionIndexRow(transition: TaskStateTransition): Record<string, string | number | null> {
    return {
      transitionId: transition.transitionId,
      runId: transition.runId,
      taskId: transition.taskId,
      sessionId: transition.sessionId,
      prevStatus: transition.prev,
      nextStatus: transition.next,
      at: transition.at,
      reason: transition.reason,
      payload: JSON.stringify(transition)
    }
  }
}
