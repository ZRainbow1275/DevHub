import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetBetterSqliteLoaderForTests,
  isBetterSqliteAvailable,
  loadBetterSqlite
} from './betterSqliteLoader'

describe('betterSqliteLoader', () => {
  afterEach(() => {
    __resetBetterSqliteLoaderForTests()
  })

  it('reports the native binding as available on this machine', () => {
    expect(isBetterSqliteAvailable()).toBe(true)
  })

  it('returns a constructor that can open an in-memory database and run a query', () => {
    const DatabaseConstructor = loadBetterSqlite()
    const db = new DatabaseConstructor(':memory:')
    try {
      const row = db.prepare('SELECT 1 + 1 AS sum').get() as { sum: number }
      expect(row.sum).toBe(2)
    } finally {
      db.close()
    }
  })

  it('memoizes the constructor so repeated loads return the same reference', () => {
    const first = loadBetterSqlite()
    const second = loadBetterSqlite()
    expect(second).toBe(first)
  })
})

describe('ProcessHistoryStore fallback when SQLite is unavailable', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('./betterSqliteLoader')
  })

  it('degrades to in-memory history instead of throwing when the loader fails', async () => {
    vi.resetModules()
    vi.doMock('./betterSqliteLoader', () => ({
      loadBetterSqlite: () => {
        throw new Error('better-sqlite3 native binding unavailable')
      },
      isBetterSqliteAvailable: () => false,
      __resetBetterSqliteLoaderForTests: () => undefined
    }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ProcessHistoryStore } = await import('../ProcessHistoryStore')
    const { processHistoryPointSchema } = await import('@shared/schemas/r8-runtime')
    const { makeProcessTagKey } = await import('../ProcessTagStore')

    const now = Date.now()
    expect(() => {
      const store = new ProcessHistoryStore(':memory:')
      const key = makeProcessTagKey('node.exe', 'D:/repo/devhub')
      store.insert(key, processHistoryPointSchema.parse({ ts: now, cpu: 5, rssMb: 64 }))
      const history = store.historyFor('node.exe', 'D:/repo/devhub', now)
      expect(history.points).toEqual([
        expect.objectContaining({ ts: now, cpu: 5, rssMb: 64, missing: false })
      ])
      store.close()
    }).not.toThrow()

    // The constructor logs a single warning when the binding is unavailable.
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
