import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Database as DatabaseHandle } from 'better-sqlite3'
import { loadBetterSqlite } from '../sqlite/betterSqliteLoader'
import {
  injectWhitelistEntrySchema,
  type InjectScenario,
  type InjectWhitelistDuration,
  type InjectWhitelistEntry,
  type InjectWhitelistScope
} from '@shared/schemas/inject'
import { expiresAtForDuration, hashInjectWhitelistPattern } from './InjectTargetResolver'

export type RuntimeFirstTimeWhitelistEntry = InjectWhitelistEntry & { alias: string }

export interface InjectFirstTimeConfirmRepositoryOptions {
  dbPath: string
  now?: () => number
}

export interface ConfirmFirstTimeInput {
  alias: string
  scope: InjectWhitelistScope
  pattern: string
  scenarios: InjectScenario[]
  duration: InjectWhitelistDuration
  confirmedBy: string
  reason: string
}

interface FirstTimeRow {
  whitelist_id: string
  alias: string
  payload_json: string
}

export class InjectFirstTimeConfirmRepository {
  private readonly now: () => number

  constructor(private readonly options: InjectFirstTimeConfirmRepositoryOptions) {
    this.now = options.now ?? (() => Date.now())
  }

  confirm(input: ConfirmFirstTimeInput): RuntimeFirstTimeWhitelistEntry {
    const createdAt = this.now()
    const entry = injectWhitelistEntrySchema.parse({
      id: randomUUID(),
      scope: input.scope,
      pattern: input.pattern,
      patternHash: hashInjectWhitelistPattern(input.scope, input.pattern),
      scenarios: input.scenarios,
      duration: input.duration,
      createdAt,
      expiresAt: expiresAtForDuration(input.duration, createdAt),
      createdBy: 'first-time-modal',
      enabled: true,
      reason: input.reason,
      confirmedBy: input.confirmedBy
    })
    const runtimeEntry = { ...entry, alias: input.alias }
    try {
      this.withDatabase(database => {
        this.ensureSchema(database)
        database.prepare(`
          INSERT INTO inject_first_time_confirmations (
            whitelist_id,
            alias,
            alias_hash,
            scenario_hash,
            scenario_list_json,
            scope,
            pattern_hash,
            created_at,
            expires_at,
            enabled,
            confirmed_by,
            payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(
          entry.id,
          input.alias,
          this.hash(input.alias),
          this.hash(input.scenarios[0] ?? 'manual-template'),
          JSON.stringify(input.scenarios),
          entry.scope,
          entry.patternHash,
          entry.createdAt,
          entry.expiresAt,
          entry.confirmedBy,
          JSON.stringify(runtimeEntry)
        )
      })
    } catch (error) {
      this.warnSqliteUnavailable('confirm', error)
    }
    return runtimeEntry
  }

  listWhitelistEntries(input: { sessionStartedAt: number }): RuntimeFirstTimeWhitelistEntry[] {
    try {
      return this.withDatabase(database => {
        this.ensureSchema(database)
        const rows = database.prepare(`
          SELECT whitelist_id, alias, payload_json
          FROM inject_first_time_confirmations
          WHERE enabled = 1
          ORDER BY created_at DESC, rowid DESC
          LIMIT 1000
        `).all() as FirstTimeRow[]
        const output: RuntimeFirstTimeWhitelistEntry[] = []
        for (const row of rows) {
          try {
            const parsed = JSON.parse(row.payload_json) as unknown
            const record = parsed as { alias?: unknown }
            const entryCandidate = { ...(parsed as Record<string, unknown>) }
            delete entryCandidate.alias
            const entry = injectWhitelistEntrySchema.safeParse(entryCandidate)
            if (entry.success) {
              output.push({ ...entry.data, alias: typeof record.alias === 'string' ? record.alias : row.alias })
              continue
            }
            if (typeof parsed === 'object' && parsed !== null) {
              const objectRecord = parsed as Record<string, unknown>
              const normalizedCandidate = { ...objectRecord }
              delete normalizedCandidate.alias
              const normalized = injectWhitelistEntrySchema.safeParse(normalizedCandidate)
              if (normalized.success) output.push({ ...normalized.data, alias: typeof objectRecord.alias === 'string' ? objectRecord.alias : row.alias })
            }
          } catch {
            continue
          }
        }
        return output.filter(entry => entry.duration !== 'session' || entry.createdAt >= input.sessionStartedAt)
      })
    } catch (error) {
      this.warnSqliteUnavailable('list', error)
      return []
    }
  }

  disableWhitelistIds(ids: string[], disabledAt: number): number {
    if (ids.length === 0) return 0
    try {
      return this.withDatabase(database => {
        this.ensureSchema(database)
        const update = database.prepare('UPDATE inject_first_time_confirmations SET enabled = 0, disabled_at = ? WHERE whitelist_id = ?')
        let changed = 0
        const transaction = database.transaction(() => {
          for (const id of ids) {
            changed += update.run(disabledAt, id).changes
          }
        })
        transaction()
        return changed
      })
    } catch (error) {
      this.warnSqliteUnavailable('disable', error)
      return 0
    }
  }

  private withDatabase<T>(operation: (database: DatabaseHandle) => T): T {
    mkdirSync(dirname(this.options.dbPath), { recursive: true })
    const DatabaseConstructor = loadBetterSqlite()
    const database = new DatabaseConstructor(this.options.dbPath)
    try {
      return operation(database)
    } finally {
      database.close()
    }
  }

  private ensureSchema(database: DatabaseHandle): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS inject_first_time_confirmations (
        whitelist_id TEXT PRIMARY KEY,
        alias TEXT NOT NULL,
        alias_hash TEXT NOT NULL,
        scenario_hash TEXT NOT NULL,
        scenario_list_json TEXT NOT NULL,
        scope TEXT NOT NULL,
        pattern_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        disabled_at INTEGER,
        confirmed_by TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inject_first_time_alias_scenario ON inject_first_time_confirmations(alias_hash, scenario_hash);
      CREATE INDEX IF NOT EXISTS idx_inject_first_time_pattern ON inject_first_time_confirmations(pattern_hash);
      CREATE INDEX IF NOT EXISTS idx_inject_first_time_expiry ON inject_first_time_confirmations(expires_at);
    `)
  }

  private hash(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
  }

  private warnSqliteUnavailable(operation: string, error: unknown): void {
    console.warn('InjectFirstTimeConfirmRepository: SQLite unavailable for', operation, error instanceof Error ? error.message : error)
  }
}
