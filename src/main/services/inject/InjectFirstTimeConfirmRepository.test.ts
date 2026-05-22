import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DatabaseConstructor from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { InjectFirstTimeConfirmRepository } from './InjectFirstTimeConfirmRepository'

describe('InjectFirstTimeConfirmRepository', () => {
  it('persists first-time confirmations in SQLite with hashed alias and scenario indexes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-inject-first-time-'))
    const dbPath = join(root, 'inject-first-time.sqlite')
    try {
      const now = 1_800_000_000_000
      const repository = new InjectFirstTimeConfirmRepository({ dbPath, now: () => now })
      const entry = repository.confirm({
        alias: 'codex-first-time',
        scope: 'instance',
        pattern: 'codex-first-time',
        scenarios: ['manual-template'],
        duration: '24h',
        confirmedBy: 'vitest',
        reason: 'vitest-first-time'
      })
      const listed = repository.listWhitelistEntries({ sessionStartedAt: now - 1 })
      const database = new DatabaseConstructor(dbPath, { readonly: true, fileMustExist: true })
      try {
        const row = database.prepare('SELECT alias_hash, scenario_hash, pattern_hash, enabled FROM inject_first_time_confirmations WHERE whitelist_id = ?').get(entry.id) as {
          alias_hash: string
          scenario_hash: string
          pattern_hash: string
          enabled: number
        }
        expect(row.alias_hash).toMatch(/^[a-f0-9]{64}$/)
        expect(row.scenario_hash).toMatch(/^[a-f0-9]{64}$/)
        expect(row.pattern_hash).toBe(entry.patternHash)
        expect(row.enabled).toBe(1)
      } finally {
        database.close()
      }
      expect(listed).toEqual([expect.objectContaining({ id: entry.id, alias: 'codex-first-time', createdBy: 'first-time-modal' })])

      expect(repository.disableWhitelistIds([entry.id], now + 1)).toBe(1)
      expect(repository.listWhitelistEntries({ sessionStartedAt: now - 1 })).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not carry session-duration confirmations across runtime sessions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-inject-first-time-session-'))
    try {
      const dbPath = join(root, 'inject-first-time.sqlite')
      const repository = new InjectFirstTimeConfirmRepository({ dbPath, now: () => 1_800_000_000_000 })
      repository.confirm({
        alias: 'codex-session',
        scope: 'instance',
        pattern: 'codex-session',
        scenarios: ['manual-template'],
        duration: 'session',
        confirmedBy: 'vitest',
        reason: 'vitest-session'
      })

      expect(repository.listWhitelistEntries({ sessionStartedAt: 1_799_999_999_999 })).toHaveLength(1)
      expect(repository.listWhitelistEntries({ sessionStartedAt: 1_800_000_000_001 })).toHaveLength(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
