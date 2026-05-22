import { useCallback, useEffect, useState } from 'react'
import type { InjectWhitelistDuration, InjectWhitelistScope } from '@shared/schemas/inject'
import { AlertIcon, PlusIcon, RefreshIcon, TerminalIcon, TrashIcon } from '../icons'
import { dispatchInjectWhitelistChanged, INJECT_WHITELIST_CHANGED_EVENT } from './inject-events'

interface WhitelistEntryLike {
  id: string
  alias?: string
  pattern: string
  scope: InjectWhitelistScope
  duration: InjectWhitelistDuration
  scenarios?: string[]
  createdAt: number
  expiresAt?: number | null
  enabled?: boolean
  reason?: string
}

const CONFIRMED_BY = 'inject-whitelist-drawer'
const DEFAULT_SCENARIOS = ['manual-template', 'csv-task-driven']

function normalizeEntry(value: unknown): WhitelistEntryLike | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.pattern !== 'string') return null
  const scope = record.scope === 'tool' || record.scope === 'project-cwd' ? record.scope : 'instance'
  const duration = record.duration === 'session' || record.duration === '7d' || record.duration === 'permanent' ? record.duration : '24h'
  return {
    id: record.id,
    alias: typeof record.alias === 'string' ? record.alias : undefined,
    pattern: record.pattern,
    scope,
    duration,
    scenarios: Array.isArray(record.scenarios) ? record.scenarios.filter((item): item is string => typeof item === 'string') : [],
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : 0,
    expiresAt: typeof record.expiresAt === 'number' || record.expiresAt === null ? record.expiresAt : null,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
    reason: typeof record.reason === 'string' ? record.reason : undefined
  }
}

function isExpired(entry: WhitelistEntryLike, now: number): boolean {
  return typeof entry.expiresAt === 'number' && entry.expiresAt <= now
}

export function InjectWhitelistDrawer() {
  const [entries, setEntries] = useState<WhitelistEntryLike[]>([])
  const [scope, setScope] = useState<InjectWhitelistScope>('instance')
  const [duration, setDuration] = useState<InjectWhitelistDuration>('24h')
  const [pattern, setPattern] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = Date.now()

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const nextEntries = await window.devhub?.r8?.inject?.whitelist?.()
      setEntries((nextEntries ?? []).map(normalizeEntry).filter((entry): entry is WhitelistEntryLike => entry !== null))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const handleWhitelistChanged = () => {
      void refresh()
    }
    window.addEventListener(INJECT_WHITELIST_CHANGED_EVENT, handleWhitelistChanged)
    return () => {
      window.removeEventListener(INJECT_WHITELIST_CHANGED_EVENT, handleWhitelistChanged)
    }
  }, [refresh])

  const addEntry = async () => {
    const cleanPattern = pattern.trim()
    if (!cleanPattern) {
      setError('pattern is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.devhub?.r8?.inject?.addWhitelist?.({
        scope,
        pattern: cleanPattern,
        duration,
        scenarios: DEFAULT_SCENARIOS,
        reason: 'inject-whitelist-drawer',
        confirmedBy: CONFIRMED_BY
      })
      setPattern('')
      await refresh()
      dispatchInjectWhitelistChanged(CONFIRMED_BY)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const removeEntry = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await window.devhub?.r8?.inject?.removeWhitelist?.(id, CONFIRMED_BY)
      await refresh()
      dispatchInjectWhitelistChanged(CONFIRMED_BY)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3" data-r8c-inject-whitelist-drawer data-testid="inject-whitelist-drawer">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <TerminalIcon size={15} className="text-accent" />
          注入白名单
        </div>
        <button
          className="flex items-center gap-1 border border-surface-700 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary hover:border-accent hover:text-accent disabled:opacity-60 radius-sm"
          data-testid="inject-whitelist-refresh"
          disabled={busy}
          onClick={() => { void refresh() }}
          type="button"
        >
          <RefreshIcon size={12} />
          Refresh
        </button>
      </div>

      <div className="grid gap-2 border border-surface-800 bg-surface-950 p-3 radius-sm">
        <label className="text-xs text-text-muted">
          Pattern
          <input
            className="mt-1 w-full border border-surface-700 bg-surface-900 px-2 py-1 text-text-primary radius-sm"
            data-testid="inject-whitelist-pattern"
            onChange={event => setPattern(event.target.value)}
            placeholder="codex-1 / codex / D:/Projects/app"
            value={pattern}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-text-muted">
            Scope
            <select
              className="mt-1 w-full border border-surface-700 bg-surface-900 px-2 py-1 text-text-primary radius-sm"
              data-testid="inject-whitelist-scope"
              onChange={event => setScope(event.target.value as InjectWhitelistScope)}
              value={scope}
            >
              <option value="instance">instance</option>
              <option value="tool">tool</option>
              <option value="project-cwd">project-cwd</option>
            </select>
          </label>
          <label className="text-xs text-text-muted">
            Duration
            <select
              className="mt-1 w-full border border-surface-700 bg-surface-900 px-2 py-1 text-text-primary radius-sm"
              data-testid="inject-whitelist-duration"
              onChange={event => setDuration(event.target.value as InjectWhitelistDuration)}
              value={duration}
            >
              <option value="session">session</option>
              <option value="24h">24h</option>
              <option value="7d">7d</option>
              <option value="permanent">permanent</option>
            </select>
          </label>
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 border-l-2 border-accent bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60 radius-sm"
          data-testid="inject-whitelist-add"
          disabled={busy}
          onClick={() => { void addEntry() }}
          type="button"
        >
          <PlusIcon size={14} />
          添加白名单
        </button>
      </div>

      {error && <div className="border border-warning/50 bg-warning/10 p-2 text-xs text-warning radius-sm">{error}</div>}

      <div className="grid gap-2">
        {entries.length === 0 ? (
          <div className="border-l-2 border-surface-700 bg-surface-950 p-3 text-xs text-text-muted radius-sm">当前没有注入白名单记录。</div>
        ) : entries.map(entry => {
          const expired = isExpired(entry, now)
          const disabled = entry.enabled === false
          return (
            <article key={entry.id} className="border-l-2 border-surface-600 bg-surface-950 p-3 radius-sm" data-testid={`inject-whitelist-entry-${entry.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-text-primary">{entry.pattern}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                    <span>{entry.scope}</span>
                    <span>{entry.duration}</span>
                    <span>{entry.scenarios?.join(', ') || 'all'}</span>
                  </div>
                </div>
                <button
                  className="flex items-center gap-1 border border-surface-700 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary hover:border-warning hover:text-warning disabled:opacity-60 radius-sm"
                  data-testid={`inject-whitelist-remove-${entry.id}`}
                  disabled={busy}
                  onClick={() => { void removeEntry(entry.id) }}
                  type="button"
                >
                  <TrashIcon size={12} />
                  删除
                </button>
              </div>
              {(expired || disabled) && (
                <div className="mt-2 flex items-center gap-2 border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning radius-sm">
                  <AlertIcon size={12} />
                  {disabled ? '已禁用' : '已过期，需要重新授权'}
                </div>
              )}
              {entry.expiresAt && !expired && (
                <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-text-muted">expires {new Date(entry.expiresAt).toLocaleString()}</div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
