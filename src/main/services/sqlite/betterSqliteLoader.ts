import { createRequire } from 'node:module'
import type BetterSqlite3 from 'better-sqlite3'

export type BetterSqliteConstructor = typeof BetterSqlite3

const nodeRequire = createRequire(import.meta.url)
let cached: BetterSqliteConstructor | undefined
let cachedError: Error | undefined

/**
 * Lazily load the better-sqlite3 native constructor.
 * Throws if the native binding is unavailable in this runtime (missing/ABI-mismatched .node).
 * Callers MUST wrap usage in try/catch and degrade gracefully.
 */
export function loadBetterSqlite(): BetterSqliteConstructor {
  if (cached) return cached
  if (cachedError) throw cachedError
  try {
    const required = nodeRequire('better-sqlite3') as unknown
    const ctor = (typeof required === 'function'
      ? required
      : (required as { default?: unknown }).default) as BetterSqliteConstructor
    if (typeof ctor !== 'function') {
      throw new Error('better-sqlite3 module did not export a constructor')
    }
    cached = ctor
    return ctor
  } catch (error) {
    cachedError = error instanceof Error ? error : new Error(String(error))
    throw cachedError
  }
}

/** Returns true if the better-sqlite3 native binding can be loaded in this runtime. */
export function isBetterSqliteAvailable(): boolean {
  try {
    loadBetterSqlite()
    return true
  } catch {
    return false
  }
}

/** Test-only: reset memoized loader state so a test can simulate availability changes. */
export function __resetBetterSqliteLoaderForTests(): void {
  cached = undefined
  cachedError = undefined
}
