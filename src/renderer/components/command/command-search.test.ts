import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import type { CommandHistoryEntry, CommandPaletteEntry } from '@shared/schemas/r8-runtime'
import { searchCommandEntries } from './command-search'

function buildBenchmarkEntries(total: number): CommandPaletteEntry[] {
  const categories: CommandPaletteEntry['category'][] = [
    'navigation',
    'monitor',
    'window',
    'process',
    'port',
    'settings',
    'diagnostics',
    'ai-action'
  ]
  return Array.from({ length: total }, (_, index) => {
    const category = categories[index % categories.length]
    const port = 3000 + index
    return {
      id: `bench.${category}.${index}`,
      title: `Open ${category} port ${port}`,
      type: 'command',
      category,
      description: `Benchmark command ${index} for ${category} registry search`,
      keywords: [category, `port-${port}`, index % 2 === 0 ? 'ai' : 'runtime'],
      scope: index % 3 === 0 ? 'monitor' : 'global',
      requiresConfirmation: index % 17 === 0
    }
  })
}

describe('command search benchmark', () => {
  it('orders equal text matches by usage and recency decay history boost', () => {
    const entries: CommandPaletteEntry[] = [
      { id: 'command.old', title: 'Open AI command old', type: 'command', category: 'monitor', keywords: ['ai'], scope: 'global', requiresConfirmation: false },
      { id: 'command.recent', title: 'Open AI command recent', type: 'command', category: 'monitor', keywords: ['ai'], scope: 'global', requiresConfirmation: false }
    ]
    const history: CommandHistoryEntry[] = [
      { commandId: 'command.old', invokedAt: 1_700_000_000_000, confirmedBy: null, useCount: 4 },
      { commandId: 'command.recent', invokedAt: 1_700_604_800_000, confirmedBy: null, useCount: 4 }
    ]

    expect(searchCommandEntries(entries, 'open ai command', history).map(item => item.entry.id)).toEqual([
      'command.recent',
      'command.old'
    ])
  })

  it('keeps 1000-entry fuzzy search p99 under 16ms', () => {
    const entries = buildBenchmarkEntries(1000)
    const samples: number[] = []

    for (let index = 0; index < 6; index += 1) {
      searchCommandEntries(entries, 'port 30 ai', [])
    }

    for (let index = 0; index < 40; index += 1) {
      const startedAt = performance.now()
      const result = searchCommandEntries(entries, 'port 30 ai', [])
      samples.push(performance.now() - startedAt)
      expect(result[0]?.entry.title.toLowerCase()).toContain('port')
      expect(result[0]?.titleMatchRanges.length).toBeGreaterThan(0)
    }

    const sorted = [...samples].sort((left, right) => left - right)
    const p99 = sorted[Math.ceil(sorted.length * 0.99) - 1] ?? Number.POSITIVE_INFINITY
    expect(p99).toBeLessThan(16)
  })
})
