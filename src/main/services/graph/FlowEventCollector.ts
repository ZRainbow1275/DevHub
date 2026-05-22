import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import DatabaseConstructor, { type Database as DatabaseHandle } from 'better-sqlite3'
import type { RecordingEvent, RecordingManifest } from '@shared/schemas/recording'
import { flowNodeSchema, type FlowNode } from '@shared/schemas/flow'
import type { AuditEntry } from '../AuditLogger'

export interface FlowTaskLike {
  runId: string
  taskId?: string
  sessionId?: string
  row: Record<string, unknown>
  status: string
  attempts: number
  queuedAt: number
  startedAt: number | null
  endedAt: number | null
  errorCode?: string | null
  error?: string | null
  errorMessage?: string | null
}

export interface FlowRecordingSource {
  manifest: RecordingManifest
  events: RecordingEvent[]
}

export interface FlowEventCollectorOptions {
  dbPath?: string
  retentionMs?: number
}

interface FlowEventIndexRow {
  payload: string
}

const FLOW_INDEX_RETENTION_MS = 24 * 60 * 60 * 1000

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeAuditTs(ts: number): number {
  return ts < 10_000_000_000 ? ts * 1000 : ts
}

function recordingKindToFlowKind(event: RecordingEvent): FlowNode['kind'] {
  if (event.kind === 'stdin') return event.origin === 'inject' ? 'inject' : 'cli-event'
  if (event.kind === 'fs') return 'fs-burst'
  if (event.kind === 'git-diff') return 'state-flip'
  if (event.kind === 'screenshot') return 'recording-rotate'
  return 'cli-event'
}

function auditActionToFlowKind(entry: AuditEntry): FlowNode['kind'] {
  const action = `${entry.action} ${entry.op}`.toLowerCase()
  if (action.includes('inject')) return 'inject'
  if (action.includes('watchdog')) return 'watchdog-action'
  if (action.includes('record') || action.includes('rotate')) return 'recording-rotate'
  return entry.result === 'error' ? 'task-fail' : 'state-flip'
}

export class FlowEventCollector {
  private readonly memoryIndex = new Map<string, FlowNode>()
  private db: DatabaseHandle | null = null
  private databaseAttempted = false

  constructor(private readonly options: FlowEventCollectorOptions = {}) {}

  indexNodes(nodes: FlowNode[], now: number): void {
    const retentionMs = this.options.retentionMs ?? FLOW_INDEX_RETENTION_MS
    const cutoff = Math.max(0, now - retentionMs)
    const parsedNodes = nodes.map(node => flowNodeSchema.parse(node))
    for (const node of parsedNodes) {
      if (node.ts >= cutoff) this.memoryIndex.set(node.id, node)
    }
    for (const [id, node] of this.memoryIndex.entries()) {
      if (node.ts < cutoff) this.memoryIndex.delete(id)
    }

    const db = this.database()
    if (!db) return
    const insert = db.prepare(`
      INSERT OR REPLACE INTO flow_event_index (id, ts, kind, task_id, session_id, instance_id, payload)
      VALUES (@id, @ts, @kind, @taskId, @sessionId, @instanceId, @payload)
    `)
    const transaction = db.transaction((items: FlowNode[]) => {
      for (const node of items) {
        if (node.ts < cutoff) continue
        insert.run({
          id: node.id,
          ts: node.ts,
          kind: node.kind,
          taskId: node.taskId,
          sessionId: node.sessionId,
          instanceId: node.instanceId,
          payload: JSON.stringify(node)
        })
      }
      db.prepare('DELETE FROM flow_event_index WHERE ts < ?').run(cutoff)
    })
    transaction(parsedNodes)
  }

  queryIndexedNodes(fromTs: number, toTs: number): FlowNode[] {
    const byId = new Map<string, FlowNode>()
    const addNode = (node: FlowNode) => {
      if (node.ts >= fromTs && node.ts <= toTs) byId.set(node.id, flowNodeSchema.parse(node))
    }
    for (const node of this.memoryIndex.values()) {
      addNode(node)
    }

    const db = this.database()
    if (db) {
      const rows = db.prepare(`
        SELECT payload
        FROM flow_event_index
        WHERE ts >= ? AND ts <= ?
        ORDER BY ts ASC, id ASC
      `).all(fromTs, toTs) as FlowEventIndexRow[]
      for (const row of rows) {
        try {
          addNode(flowNodeSchema.parse(JSON.parse(row.payload)))
        } catch {
          continue
        }
      }
    }

    return [...byId.values()].sort((left, right) => left.ts - right.ts || left.id.localeCompare(right.id))
  }

  close(): void {
    if (this.db?.open) this.db.close()
    this.db = null
  }

  collectTaskNodes(tasks: FlowTaskLike[]): FlowNode[] {
    return tasks.flatMap((task): FlowNode[] => {
      const startedAt = task.startedAt ?? task.queuedAt
      const endedAt = task.endedAt ?? startedAt
      const taskId = task.taskId ?? readString(task.row.id) ?? task.runId
      const tool = readString(task.row.tool)
      const base = {
        taskId,
        sessionId: task.sessionId ?? null,
        instanceId: tool,
        meta: { runId: task.runId, status: task.status, tool, source: 'task-queue' },
        errorCode: task.errorCode ?? task.error ?? task.errorMessage ?? null
      }
      const nodes: FlowNode[] = [{ id: `flow-${task.runId}-start`, kind: 'task-start', ts: startedAt, label: `start ${taskId}`, durationMs: null, ...base }]
      if (task.status === 'retrying' || task.attempts > 0) {
        nodes.push({ id: `flow-${task.runId}-retry`, kind: 'task-retry', ts: Math.max(startedAt, endedAt - 1), label: `retry ${taskId}`, durationMs: null, ...base })
      }
      if (task.endedAt !== null || task.status === 'failed' || task.status === 'succeeded') {
        nodes.push({ id: `flow-${task.runId}-end`, kind: task.status === 'failed' ? 'task-fail' : 'task-end', ts: endedAt, label: `${task.status} ${taskId}`, durationMs: Math.max(0, endedAt - startedAt), ...base })
      }
      return nodes
    })
  }

  collectCsvNodes(sessions: Record<string, unknown>[], fallbackTs: number): FlowNode[] {
    return sessions.map((session): FlowNode => {
      const sessionId = readString(session.sessionId) ?? `legacy-${JSON.stringify(session).length}-${fallbackTs}`
      const startedAt = readNumber(session.startedAt) ?? readNumber(session.createdAt) ?? fallbackTs
      const status = readString(session.status) ?? 'unknown'
      const runner = readString(session.runner)
      return {
        id: `flow-csv-${sessionId}`,
        kind: 'cli-event',
        ts: Math.max(0, Math.trunc(startedAt)),
        label: `csv ${status}`,
        taskId: readString(session.taskRunId) ?? readString(session.rowId),
        sessionId,
        instanceId: runner,
        meta: { csvPath: readString(session.csvPath), runner, rowCount: readNumber(session.rowCount), command: readString(session.command), source: 'csv-session' },
        errorCode: readString(session.error),
        durationMs: null
      }
    })
  }

  collectRecordingNodes(sources: FlowRecordingSource[]): FlowNode[] {
    return sources.flatMap(source => {
      const manifest = source.manifest
      const manifestNodes: FlowNode[] = manifest.events.map((event, index) => ({
        id: `flow-recording-${manifest.recordingId}-manifest-${index}`,
        kind: event.type.includes('stop') ? 'recording-rotate' : 'state-flip',
        ts: event.at,
        label: event.type,
        taskId: manifest.taskId,
        sessionId: manifest.sessionId,
        instanceId: manifest.tool ?? null,
        meta: { recordingId: manifest.recordingId, source: manifest.source, cwd: manifest.cwd, payload: event.payload ?? null },
        errorCode: null,
        durationMs: null
      }))
      const eventNodes: FlowNode[] = source.events.map((event, index) => ({
        id: `flow-recording-${manifest.recordingId}-${event.kind}-${event.ts}-${index}`,
        kind: recordingKindToFlowKind(event),
        ts: event.ts,
        label: `${event.kind} ${manifest.taskId}`,
        taskId: manifest.taskId,
        sessionId: manifest.sessionId,
        instanceId: manifest.tool ?? null,
        meta: { recordingId: manifest.recordingId, event, source: 'recording' },
        errorCode: event.kind === 'stdout' && event.stream === 'stderr' ? 'STDERR' : null,
        durationMs: null
      }))
      return [...manifestNodes, ...eventNodes]
    })
  }

  collectAuditNodes(entries: AuditEntry[]): FlowNode[] {
    return entries.map((entry, index) => ({
      id: `flow-audit-${normalizeAuditTs(entry.ts)}-${index}`,
      kind: auditActionToFlowKind(entry),
      ts: normalizeAuditTs(entry.ts),
      label: entry.action,
      taskId: readString(entry.target.taskId),
      sessionId: readString(entry.target.sessionId),
      instanceId: readString(entry.target.instanceId) ?? readString(entry.target.tool),
      meta: { target: entry.target, outcome: entry.outcome, reason: entry.reason ?? null, source: 'audit' },
      errorCode: entry.result === 'error' ? (entry.reason ?? 'E_AUDIT_ERROR') : null,
      durationMs: null
    }))
  }

  private database(): DatabaseHandle | null {
    if (this.db?.open) return this.db
    if (this.databaseAttempted) return null
    this.databaseAttempted = true
    if (!this.options.dbPath) return null
    try {
      mkdirSync(dirname(this.options.dbPath), { recursive: true })
      const db = new DatabaseConstructor(this.options.dbPath)
      db.pragma('journal_mode = WAL')
      db.exec(`
        CREATE TABLE IF NOT EXISTS flow_event_index (
          id TEXT PRIMARY KEY,
          ts INTEGER NOT NULL,
          kind TEXT NOT NULL,
          task_id TEXT,
          session_id TEXT,
          instance_id TEXT,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_flow_event_index_ts ON flow_event_index(ts);
        CREATE INDEX IF NOT EXISTS idx_flow_event_index_scope ON flow_event_index(task_id, session_id, instance_id);
      `)
      this.db = db
      return db
    } catch {
      this.db = null
      return null
    }
  }
}
