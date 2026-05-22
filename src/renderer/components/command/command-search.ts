import Fuse from 'fuse.js'
import type { FuseResultMatch, IFuseOptions, RangeTuple } from 'fuse.js'
import type { CommandHistoryEntry, CommandPaletteEntry } from '@shared/schemas/r8-runtime'

interface CommandHistoryStats {
  latestInvokedAt: number
  rank: number
  recencyBoost: number
  useCount: number
}

interface CommandSearchRecord {
  category: CommandPaletteEntry['category']
  description: string
  entry: CommandPaletteEntry
  id: string
  keywords: string
  label: string
  scope: CommandPaletteEntry['scope']
  title: string
  uri: string
}

export interface CommandRenderEntry {
  entry: CommandPaletteEntry
  titleMatchRanges: RangeTuple[]
}

const COMMAND_FUSE_OPTIONS: IFuseOptions<CommandSearchRecord> = {
  ignoreLocation: true,
  includeMatches: true,
  includeScore: true,
  keys: [
    { name: 'title', weight: 0.38 },
    { name: 'keywords', weight: 0.22 },
    { name: 'id', weight: 0.16 },
    { name: 'description', weight: 0.14 },
    { name: 'category', weight: 0.04 },
    { name: 'label', weight: 0.03 },
    { name: 'scope', weight: 0.02 },
    { name: 'uri', weight: 0.01 }
  ],
  shouldSort: true,
  threshold: 0.42
}

const COMMAND_FUSE_CACHE = new WeakMap<CommandPaletteEntry[], Fuse<CommandSearchRecord>>()
const COMMAND_FUSE_PREFILTER_MIN = 300
const COMMAND_FUSE_PREFILTER_MIN_RESULTS = 10
const COMMAND_HISTORY_DECAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function buildCommandSearchText(entry: CommandPaletteEntry): string {
  return [
    entry.id,
    entry.title,
    entry.label ?? '',
    entry.description ?? '',
    entry.category,
    entry.scope,
    entry.uri ?? '',
    ...(entry.keywords ?? [])
  ].join(' ')
}

export function buildCommandItemValue(entry: CommandPaletteEntry): string {
  return `${entry.category}:${buildCommandSearchText(entry)}`
}

function buildCommandSearchRecord(entry: CommandPaletteEntry): CommandSearchRecord {
  return {
    category: entry.category,
    description: entry.description ?? '',
    entry,
    id: entry.id,
    keywords: (entry.keywords ?? []).join(' '),
    label: entry.label ?? '',
    scope: entry.scope,
    title: entry.title,
    uri: entry.uri ?? ''
  }
}

function buildHistoryStats(history: CommandHistoryEntry[]): Map<string, CommandHistoryStats> {
  const stats = new Map<string, CommandHistoryStats>()
  const latestHistoryTime = Math.max(0, ...history.map(item => item.invokedAt))
  for (const item of history) {
    const previous = stats.get(item.commandId)
    stats.set(item.commandId, {
      latestInvokedAt: Math.max(previous?.latestInvokedAt ?? 0, item.invokedAt),
      rank: 0,
      recencyBoost: 0,
      useCount: Math.max(previous?.useCount ?? 0, item.useCount)
    })
  }

  const ranked = [...stats.entries()].sort(([, left], [, right]) => {
    if (right.useCount !== left.useCount) return right.useCount - left.useCount
    return right.latestInvokedAt - left.latestInvokedAt
  })
  ranked.forEach(([, value], index) => {
    value.rank = index
    const ageMs = Math.max(0, latestHistoryTime - value.latestInvokedAt)
    value.recencyBoost = Math.exp(-ageMs / COMMAND_HISTORY_DECAY_WINDOW_MS) * 0.06
  })

  return stats
}

function getHistoryBoost(commandId: string, historyStats: Map<string, CommandHistoryStats>): number {
  const stats = historyStats.get(commandId)
  if (!stats) return 0
  const useCountBoost = Math.min(stats.useCount, 10) / 10 * 0.12
  const rankBoost = Math.max(0, 1 - stats.rank / 10) * 0.08
  return useCountBoost + rankBoost + stats.recencyBoost
}

function collectTitleMatchRanges(matches: readonly FuseResultMatch[] | undefined): RangeTuple[] {
  return matches
    ?.filter(match => match.key === 'title')
    .flatMap(match => match.indices)
    ?? []
}

function getCommandFuse(entries: CommandPaletteEntry[]): Fuse<CommandSearchRecord> {
  const cached = COMMAND_FUSE_CACHE.get(entries)
  if (cached) return cached
  const fuse = new Fuse(entries.map(buildCommandSearchRecord), COMMAND_FUSE_OPTIONS)
  COMMAND_FUSE_CACHE.set(entries, fuse)
  return fuse
}

function prefilterLargeCommandSet(entries: CommandPaletteEntry[], searchTerm: string): CommandPaletteEntry[] {
  if (entries.length < COMMAND_FUSE_PREFILTER_MIN) return entries
  const terms = searchTerm
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.trim())
    .filter(term => term.length >= 2)
  if (terms.length === 0) return entries

  const candidates = entries.filter(entry => {
    const text = buildCommandSearchText(entry).toLowerCase()
    return terms.every(term => text.includes(term))
  })
  return candidates.length >= COMMAND_FUSE_PREFILTER_MIN_RESULTS ? candidates : entries
}

export function searchCommandEntries(
  entries: CommandPaletteEntry[],
  searchTerm: string,
  history: CommandHistoryEntry[]
): CommandRenderEntry[] {
  const trimmed = searchTerm.trim()
  if (!trimmed) return entries.map(entry => ({ entry, titleMatchRanges: [] }))

  const historyStats = buildHistoryStats(history)
  const candidateEntries = prefilterLargeCommandSet(entries, trimmed)
  const fuse = getCommandFuse(candidateEntries)
  return fuse.search(trimmed)
    .map(result => ({
      entry: result.item.entry,
      titleMatchRanges: collectTitleMatchRanges(result.matches),
      score: Math.max(0, result.score ?? 1) - getHistoryBoost(result.item.entry.id, historyStats)
    }))
    .sort((left, right) => left.score - right.score)
}

export function buildRecentCommandEntries(entries: CommandRenderEntry[], history: CommandHistoryEntry[]): CommandRenderEntry[] {
  const byId = new Map(entries.map(item => [item.entry.id, item]))
  const seen = new Set<string>()
  const recent: CommandRenderEntry[] = []

  for (const historyEntry of [...history].sort((left, right) => right.invokedAt - left.invokedAt)) {
    if (seen.has(historyEntry.commandId)) continue
    const renderEntry = byId.get(historyEntry.commandId)
    if (!renderEntry) continue
    seen.add(historyEntry.commandId)
    recent.push({
      entry: {
        ...renderEntry.entry,
        category: 'history',
        description: `最近使用 ${historyEntry.useCount} 次，最后一次 ${new Date(historyEntry.invokedAt).toLocaleString()}`
      },
      titleMatchRanges: renderEntry.titleMatchRanges
    })
    if (recent.length >= 10) break
  }

  return recent
}
