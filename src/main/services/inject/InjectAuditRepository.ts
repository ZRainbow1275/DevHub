import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { Database as DatabaseHandle } from 'better-sqlite3'
import { loadBetterSqlite } from '../sqlite/betterSqliteLoader'
import { injectAuditRecordSchema, type InjectActionV2, type InjectAuditRecord, type InjectFailureKind, type InjectMode } from '@shared/schemas/inject'

export interface InjectAuditStore {
  get(key: string, defaultValue?: unknown): unknown
  set(key: string, value: unknown): void
}

const AUDIT_KEY = 'injectAuditRecords'

export class InjectAuditRepository {
  constructor(
    private readonly store: InjectAuditStore,
    private readonly now: () => number = () => Date.now(),
    private readonly sqlitePath: string | null = null
  ) {}

  append(input: {
    action: InjectActionV2
    status: InjectAuditRecord['status']
    modeUsed: InjectMode | 'disabled'
    failureKind: InjectFailureKind | null
    confirmedBy: string | null
    verifiedContentMatches?: boolean | null
    verificationError?: string | null
    screenshotPathBefore?: string | null
    screenshotPathAfter?: string | null
  }): InjectAuditRecord {
    const record = injectAuditRecordSchema.parse({
      auditId: randomUUID(),
      actionId: input.action.id,
      scenario: input.action.scenario,
      targetAlias: input.action.targetAlias,
      text: input.action.text,
      textHash: input.action.textHash,
      textLength: input.action.textLength,
      modeRequested: input.action.mode,
      modeUsed: input.modeUsed,
      status: input.status,
      failureKind: input.failureKind,
      verifiedContentMatches: input.verifiedContentMatches ?? null,
      verificationError: input.verificationError ?? null,
      screenshotPathBefore: input.screenshotPathBefore ?? null,
      screenshotPathAfter: input.screenshotPathAfter ?? null,
      createdAt: this.now(),
      confirmedBy: input.confirmedBy
    })
    this.store.set(AUDIT_KEY, [record, ...this.list()].slice(0, 2000))
    try {
      this.appendSqlite(record)
    } catch (error) {
      this.warnSqliteUnavailable('append', error)
    }
    return record
  }

  list(): InjectAuditRecord[] {
    let sqliteRecords: InjectAuditRecord[] = []
    try {
      sqliteRecords = this.listSqlite()
    } catch (error) {
      this.warnSqliteUnavailable('list', error)
    }
    if (sqliteRecords.length > 0) return sqliteRecords
    const value = this.store.get(AUDIT_KEY, [])
    if (!Array.isArray(value)) return []
    const output: InjectAuditRecord[] = []
    for (const item of value) {
      const parsed = injectAuditRecordSchema.safeParse(item)
      if (parsed.success) output.push(parsed.data)
    }
    return output
  }

  private appendSqlite(record: InjectAuditRecord): void {
    if (!this.sqlitePath) return
    this.withDatabase(database => {
      this.ensureSchema(database)
      database.prepare(`
        INSERT INTO inject_audit_records (
          audit_id,
          action_id,
          scenario,
          target_alias,
          text,
          text_hash,
          text_length,
          mode_requested,
          mode_used,
          status,
          failure_kind,
          created_at,
          confirmed_by,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.auditId,
        record.actionId,
        record.scenario,
        record.targetAlias,
        record.text,
        record.textHash,
        record.textLength,
        record.modeRequested,
        record.modeUsed,
        record.status,
        record.failureKind,
        record.createdAt,
        record.confirmedBy,
        JSON.stringify(record)
      )
    })
  }

  private listSqlite(): InjectAuditRecord[] {
    if (!this.sqlitePath) return []
    return this.withDatabase(database => {
      this.ensureSchema(database)
      const rows = database.prepare('SELECT payload_json FROM inject_audit_records ORDER BY created_at DESC, rowid DESC LIMIT 2000').all() as Array<{ payload_json: string }>
      const output: InjectAuditRecord[] = []
      for (const row of rows) {
        try {
          const parsed = injectAuditRecordSchema.safeParse(JSON.parse(row.payload_json))
          if (parsed.success) output.push(parsed.data)
        } catch {
          continue
        }
      }
      return output
    })
  }

  private withDatabase<T>(operation: (database: DatabaseHandle) => T): T {
    if (!this.sqlitePath) throw new Error('E_VALIDATION:sqlite path is not configured')
    mkdirSync(dirname(this.sqlitePath), { recursive: true })
    const DatabaseConstructor = loadBetterSqlite()
    const database = new DatabaseConstructor(this.sqlitePath)
    try {
      return operation(database)
    } finally {
      database.close()
    }
  }

  private ensureSchema(database: DatabaseHandle): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS inject_audit_records (
        audit_id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL,
        scenario TEXT NOT NULL,
        target_alias TEXT NOT NULL,
        text TEXT NOT NULL,
        text_hash TEXT NOT NULL,
        text_length INTEGER NOT NULL,
        mode_requested TEXT NOT NULL,
        mode_used TEXT NOT NULL,
        status TEXT NOT NULL,
        failure_kind TEXT,
        created_at INTEGER NOT NULL,
        confirmed_by TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inject_audit_text_hash ON inject_audit_records(text_hash);
      CREATE INDEX IF NOT EXISTS idx_inject_audit_created_at ON inject_audit_records(created_at);
      CREATE INDEX IF NOT EXISTS idx_inject_audit_action_id ON inject_audit_records(action_id);
    `)
  }

  private warnSqliteUnavailable(operation: string, error: unknown): void {
    console.warn('InjectAuditRepository: SQLite unavailable for', operation, error instanceof Error ? error.message : error)
  }
}
