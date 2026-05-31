import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Database as DatabaseHandle } from 'better-sqlite3'
import { loadBetterSqlite } from '../sqlite/betterSqliteLoader'
import type { TaskRun } from '@shared/schemas/r8-runtime'
import type { TaskStateTransition } from './TaskQueueService'

const nodeRequire = createRequire(import.meta.url)

export interface BetterQueueTask {
  id: string
  priority?: number
  payload: unknown
}

export interface BetterQueueTaskStateMetadata {
  taskId: string
  sessionId: string | null
}

export interface BetterQueueAdapterOptions {
  dbPath: string
  concurrent?: number
  maxRetries?: number
  retryDelay?: number
  autoResume?: boolean
  processor: (task: BetterQueueTask) => Promise<unknown>
}

export type BetterQueueAdapterEvent =
  | 'task_accepted'
  | 'task_queued'
  | 'task_started'
  | 'task_finish'
  | 'task_failed'
  | 'task_retry'
  | 'empty'
  | 'drain'
  | 'error'

type NodeCallback<T = unknown> = (error?: unknown, value?: T) => void

interface BetterQueueConstructor {
  new(processor: (task: BetterQueueTask, callback: NodeCallback) => void, options: Record<string, unknown>): BetterQueueInstance
}

interface BetterQueueInstance extends EventEmitter {
  push(task: BetterQueueTask, callback?: NodeCallback): EventEmitter
  destroy(callback?: () => void): void
  pause(): void
  resume(): void
}

interface StoredBetterQueueRow {
  id: string
  task: string
}

interface LockRow {
  lock: string
}

export class BetterQueueAdapter extends EventEmitter {
  private readonly queue: BetterQueueInstance
  private readonly store: BetterSqliteQueueStore
  private readonly taskMetadataByQueueId = new Map<string, BetterQueueTaskStateMetadata>()
  private readonly nativeStatusByQueueId = new Map<string, TaskRun['status']>()

  constructor(options: BetterQueueAdapterOptions) {
    super()
    this.store = new BetterSqliteQueueStore(options.dbPath)
    const Queue = nodeRequire('better-queue') as BetterQueueConstructor
    this.queue = new Queue((task, callback) => {
      options.processor(task)
        .then(result => callback(null, result))
        .catch(error => callback(error))
    }, {
      store: this.store,
      id: 'id',
      concurrent: options.concurrent ?? 3,
      maxRetries: options.maxRetries ?? 0,
      retryDelay: options.retryDelay ?? 0,
      autoResume: options.autoResume ?? false,
      priority: (task: BetterQueueTask, callback: NodeCallback<number>) => callback(null, task.priority ?? 0)
    })
    this.forwardEvents()
  }

  push(task: BetterQueueTask, callback?: NodeCallback): EventEmitter {
    this.taskMetadataByQueueId.set(task.id, this.metadataForTask(task))
    return this.queue.push(task, callback)
  }

  pause(): void {
    this.queue.pause()
  }

  resume(): void {
    this.queue.resume()
  }

  destroy(): Promise<void> {
    return new Promise(resolve => this.queue.destroy(resolve))
  }

  private forwardEvents(): void {
    for (const eventName of ['task_accepted', 'task_queued', 'task_started', 'task_finish', 'task_failed', 'task_retry', 'empty', 'drain', 'error'] as const) {
      this.queue.on(eventName, (...args: unknown[]) => this.emit(eventName, ...args))
    }
  }

  subscribeTaskStateTransitions(listener: (transition: TaskStateTransition) => void, now: () => number = () => Date.now()): () => void {
    const handlers = [
      this.onNativeTaskEvent('task_accepted', 'queued', 'better-queue:task_accepted', listener, now),
      this.onNativeTaskEvent('task_queued', 'queued', 'better-queue:task_queued', listener, now),
      this.onNativeTaskEvent('task_started', 'running', 'better-queue:task_started', listener, now),
      this.onNativeTaskEvent('task_retry', 'retrying', 'better-queue:task_retry', listener, now),
      this.onNativeTaskEvent('task_finish', 'succeeded', 'better-queue:task_finish', listener, now),
      this.onNativeTaskEvent('task_failed', 'failed', 'better-queue:task_failed', listener, now)
    ]
    return () => {
      for (const handler of handlers) this.off(handler.eventName, handler.listener)
    }
  }

  private onNativeTaskEvent(
    eventName: BetterQueueAdapterEvent,
    next: TaskRun['status'],
    reason: string,
    sink: (transition: TaskStateTransition) => void,
    now: () => number
  ): { eventName: BetterQueueAdapterEvent; listener: (...args: unknown[]) => void } {
    const listener = (...args: unknown[]): void => {
      const queueTaskId = this.queueTaskIdFromEvent(args[0])
      if (!queueTaskId) return
      const transition = this.buildNativeTransition(queueTaskId, next, reason, now)
      if (transition) sink(transition)
    }
    this.on(eventName, listener)
    return { eventName, listener }
  }

  private buildNativeTransition(queueTaskId: string, next: TaskRun['status'], reason: string, now: () => number): TaskStateTransition | null {
    const prev = this.nativeStatusByQueueId.get(queueTaskId) ?? this.initialPreviousStatus(next)
    if (prev === next) return null
    this.nativeStatusByQueueId.set(queueTaskId, next)
    const metadata = this.taskMetadataByQueueId.get(queueTaskId) ?? { taskId: queueTaskId, sessionId: null }
    if (['succeeded', 'failed', 'skipped', 'cancelled'].includes(next)) {
      this.taskMetadataByQueueId.delete(queueTaskId)
      this.nativeStatusByQueueId.delete(queueTaskId)
    }
    return {
      transitionId: `better-queue-transition-${randomUUID()}`,
      runId: queueTaskId,
      taskId: metadata.taskId,
      sessionId: metadata.sessionId,
      prev,
      next,
      at: now(),
      reason
    }
  }

  private initialPreviousStatus(next: TaskRun['status']): TaskRun['status'] {
    if (next === 'queued') return 'pending'
    if (next === 'running') return 'queued'
    if (next === 'retrying') return 'running'
    return 'running'
  }

  private queueTaskIdFromEvent(value: unknown): string | null {
    if (typeof value === 'string' && value.length > 0) return value
    if (typeof value === 'object' && value !== null && 'id' in value) {
      const id = (value as { id?: unknown }).id
      return typeof id === 'string' && id.length > 0 ? id : null
    }
    return null
  }

  private metadataForTask(task: BetterQueueTask): BetterQueueTaskStateMetadata {
    const payload = task.payload
    const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
    return {
      taskId: typeof record.taskId === 'string' && record.taskId.length > 0 ? record.taskId : task.id,
      sessionId: typeof record.sessionId === 'string' && record.sessionId.length > 0 ? record.sessionId : null
    }
  }
}

class BetterSqliteQueueStore {
  private db: DatabaseHandle | null = null

  constructor(private readonly dbPath: string) {}

  connect(callback: NodeCallback<number>): void {
    this.run(callback, db => {
      this.ensureSchema(db)
      const row = db.prepare('SELECT COUNT(*) AS count FROM better_queue_tasks WHERE lock = ?').get('') as { count: number }
      return row.count
    })
  }

  getTask(taskId: string, callback: NodeCallback<BetterQueueTask | undefined>): void {
    this.run(callback, db => {
      const row = db.prepare('SELECT task FROM better_queue_tasks WHERE id = ? AND lock = ?').get(taskId, '') as StoredBetterQueueRow | undefined
      return row ? this.parseTask(row.task) : undefined
    })
  }

  deleteTask(taskId: string, callback: NodeCallback<void>): void {
    this.run(callback, db => {
      db.prepare('DELETE FROM better_queue_tasks WHERE id = ?').run(taskId)
      return undefined
    })
  }

  putTask(taskId: string, task: BetterQueueTask, priority: number | undefined, callback: NodeCallback<void>): void {
    this.run(callback, db => {
      const added = this.nextAdded(db)
      db.prepare(`
        INSERT INTO better_queue_tasks (id, lock, task, priority, added)
        VALUES (@id, '', @task, @priority, @added)
        ON CONFLICT(id) DO UPDATE SET
          lock = '',
          task = excluded.task,
          priority = excluded.priority
      `).run({
        id: taskId,
        task: JSON.stringify(task),
        priority: priority ?? 0,
        added
      })
      return undefined
    })
  }

  takeFirstN(count: number, callback: NodeCallback<string | undefined>): void {
    this.takeN(count, 'priority DESC, added ASC', callback)
  }

  takeLastN(count: number, callback: NodeCallback<string | undefined>): void {
    this.takeN(count, 'priority ASC, added DESC', callback)
  }

  getLock(lockId: string, callback: NodeCallback<Record<string, BetterQueueTask>>): void {
    this.run(callback, db => this.tasksForLock(db, lockId))
  }

  getRunningTasks(callback: NodeCallback<Record<string, Record<string, BetterQueueTask>>>): void {
    this.run(callback, db => {
      const locks = db.prepare('SELECT DISTINCT lock FROM better_queue_tasks WHERE lock != ?').all('') as LockRow[]
      return Object.fromEntries(locks.map(row => [row.lock, this.tasksForLock(db, row.lock)]))
    })
  }

  releaseLock(lockId: string, callback: NodeCallback<void>): void {
    this.run(callback, db => {
      db.prepare('DELETE FROM better_queue_tasks WHERE lock = ?').run(lockId)
      return undefined
    })
  }

  close(callback?: () => void): void {
    if (this.db?.open) this.db.close()
    this.db = null
    callback?.()
  }

  private takeN(count: number, orderBy: string, callback: NodeCallback<string | undefined>): void {
    this.run(callback, db => {
      const rows = db.prepare(`SELECT id FROM better_queue_tasks WHERE lock = ? ORDER BY ${orderBy} LIMIT ?`).all('', count) as Array<{ id: string }>
      if (rows.length === 0) return undefined
      const lockId = `lock-${randomUUID()}`
      const update = db.prepare('UPDATE better_queue_tasks SET lock = ? WHERE id = ?')
      const transaction = db.transaction(() => {
        for (const row of rows) update.run(lockId, row.id)
      })
      transaction()
      return lockId
    })
  }

  private tasksForLock(db: DatabaseHandle, lockId: string): Record<string, BetterQueueTask> {
    const rows = db.prepare('SELECT id, task FROM better_queue_tasks WHERE lock = ? ORDER BY added ASC').all(lockId) as StoredBetterQueueRow[]
    return Object.fromEntries(rows.map(row => [row.id, this.parseTask(row.task)]))
  }

  private parseTask(serialized: string): BetterQueueTask {
    const parsed = JSON.parse(serialized) as BetterQueueTask
    return {
      id: String(parsed.id),
      priority: typeof parsed.priority === 'number' ? parsed.priority : undefined,
      payload: parsed.payload
    }
  }

  private nextAdded(db: DatabaseHandle): number {
    const row = db.prepare('SELECT COALESCE(MAX(added), 0) + 1 AS nextAdded FROM better_queue_tasks').get() as { nextAdded: number }
    return row.nextAdded
  }

  private run<T>(callback: NodeCallback<T>, operation: (db: DatabaseHandle) => T): void {
    try {
      callback(null, operation(this.database()))
    } catch (error) {
      callback(error)
    }
  }

  private database(): DatabaseHandle {
    if (this.db?.open) return this.db
    mkdirSync(dirname(this.dbPath), { recursive: true })
    const DatabaseConstructor = loadBetterSqlite()
    const db = new DatabaseConstructor(this.dbPath)
    db.pragma('journal_mode = WAL')
    this.ensureSchema(db)
    this.db = db
    return db
  }

  private ensureSchema(db: DatabaseHandle): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS better_queue_tasks (
        id TEXT PRIMARY KEY,
        lock TEXT NOT NULL DEFAULT '',
        task TEXT NOT NULL,
        priority REAL NOT NULL DEFAULT 0,
        added INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_better_queue_tasks_lock_priority_added
        ON better_queue_tasks(lock, priority DESC, added ASC);
    `)
  }
}
