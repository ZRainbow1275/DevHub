import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RangeTuple } from 'fuse.js'
import { Command } from '../../integrations/cmdk-bridge'
import { Icon } from '../icon'
import { KeyboardNavGroup } from '../a11y/KeyboardNavGroup'
import type { CommandHistoryEntry, CommandPaletteEntry } from '@shared/schemas/r8-runtime'
import { dispatchPortPopoutRequest } from '../popout/port-popout-events'
import { useT } from '../../hooks/useT'
import {
  buildCommandItemValue,
  buildCommandSearchText,
  buildRecentCommandEntries,
  searchCommandEntries,
  type CommandRenderEntry
} from './command-search'

interface R8CommandPaletteProps {
  open: boolean
  onClose: () => void
  returnFocusTo?: HTMLElement | null
}

const CATEGORY_LABELS: Record<CommandPaletteEntry['category'], string> = {
  'ai-action': 'AI 动作',
  diagnostics: '诊断',
  history: '最近',
  monitor: '命令',
  navigation: '跳转',
  port: '端口',
  process: '进程',
  settings: '设置',
  window: '窗口'
}

const CATEGORY_ICONS: Record<CommandPaletteEntry['category'], string> = {
  'ai-action': 'lucide:Bot',
  diagnostics: 'lucide:AlertTriangle',
  history: 'lucide:List',
  monitor: 'lucide:Terminal',
  navigation: 'lucide:ExternalLink',
  port: 'lucide:Globe',
  process: 'lucide:Cpu',
  settings: 'lucide:Settings',
  window: 'lucide:AppWindow'
}

type CommandScopePrefix = '>' | '@' | '#' | '!'

interface CommandScopeFilter {
  label: string
  description: string
  matches: (entry: CommandPaletteEntry) => boolean
}

interface ParsedCommandScopePrefix {
  prefix: CommandScopePrefix
  search: string
  filter: CommandScopeFilter
}

const COMMAND_OBJECT_CATEGORIES = new Set<CommandPaletteEntry['category']>(['port', 'process', 'window'])
const COMMAND_ACTION_CATEGORIES = new Set<CommandPaletteEntry['category']>(['diagnostics', 'monitor', 'navigation'])
const AI_COMMAND_KEYWORDS = /\b(ai|assistant|codex|claude|copilot|cursor|gemini|llm|model)\b/i

function isAiCommandEntry(entry: CommandPaletteEntry): boolean {
  return entry.category === 'ai-action' || AI_COMMAND_KEYWORDS.test(buildCommandSearchText(entry))
}

const COMMAND_SCOPE_FILTERS: Record<CommandScopePrefix, CommandScopeFilter> = {
  '>': {
    label: '动作范围',
    description: '导航、监控与诊断命令',
    matches: (entry) => COMMAND_ACTION_CATEGORIES.has(entry.category)
  },
  '@': {
    label: 'AI 范围',
    description: 'AI、模型与代理相关命令',
    matches: isAiCommandEntry
  },
  '#': {
    label: '对象范围',
    description: '端口、进程与窗口对象命令',
    matches: (entry) => COMMAND_OBJECT_CATEGORIES.has(entry.category)
  },
  '!': {
    label: '确认范围',
    description: '需要确认的高风险命令',
    matches: (entry) => entry.requiresConfirmation
  }
}

function parsePortPopoutCommand(query: string): number | null {
  const match = query.trim().match(/^popout\s+(\d{1,5})$/i)
  if (!match) return null
  const port = Number(match[1])
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null
}

function parseCommandScopePrefix(query: string): ParsedCommandScopePrefix | null {
  const trimmed = query.trimStart()
  const prefix = trimmed.slice(0, 1)
  if (prefix !== '>' && prefix !== '@' && prefix !== '#' && prefix !== '!') return null
  return {
    prefix,
    search: trimmed.slice(1).trimStart(),
    filter: COMMAND_SCOPE_FILTERS[prefix]
  }
}

function commandMatchesScopePrefix(entry: CommandPaletteEntry, scopePrefix: ParsedCommandScopePrefix | null): boolean {
  return scopePrefix ? scopePrefix.filter.matches(entry) : true
}

function normalizeMatchRanges(title: string, ranges: readonly RangeTuple[]): RangeTuple[] {
  const clipped = ranges
    .map(([start, end]) => [
      Math.max(0, Math.min(title.length - 1, start)),
      Math.max(0, Math.min(title.length - 1, end))
    ] as RangeTuple)
    .filter(([start, end]) => start <= end)
    .sort(([leftStart, leftEnd], [rightStart, rightEnd]) => leftStart - rightStart || leftEnd - rightEnd)

  const merged: RangeTuple[] = []
  for (const [start, end] of clipped) {
    const previous = merged.at(-1)
    if (previous && start <= previous[1] + 1) {
      previous[1] = Math.max(previous[1], end)
      continue
    }
    merged.push([start, end])
  }
  return merged
}

function HighlightedCommandTitle({ title, ranges }: { title: string; ranges: readonly RangeTuple[] }) {
  const normalized = normalizeMatchRanges(title, ranges)
  if (normalized.length === 0) return <>{title}</>

  const chunks: ReactNode[] = []
  let cursor = 0
  for (const [start, end] of normalized) {
    if (cursor < start) chunks.push(title.slice(cursor, start))
    chunks.push(
      <mark key={`${start}-${end}`} className="bg-accent/20 px-0.5 text-accent radius-sm" data-testid="cmdk-match-highlight">
        {title.slice(start, end + 1)}
      </mark>
    )
    cursor = end + 1
  }
  if (cursor < title.length) chunks.push(title.slice(cursor))
  return <>{chunks}</>
}

function CommandGroupHeading({ category, count }: { category: CommandPaletteEntry['category']; count: number }) {
  const label = CATEGORY_LABELS[category]
  return (
    <span className="flex items-center justify-between gap-3 text-xs text-text-muted" data-testid={`cmdk-group-${category}-heading`}>
      <span className="inline-flex min-w-0 items-center gap-2">
        <Icon token={CATEGORY_ICONS[category]} decorative size={13} className="text-accent" />
        <span className="truncate">{label}</span>
      </span>
      <span
        className="shrink-0 border border-surface-600 px-1.5 py-0.5 text-[10px] tabular-nums text-text-muted radius-sm"
        data-testid={`cmdk-group-${category}-count`}
      >
        {count}
      </span>
    </span>
  )
}

export function R8CommandPalette({ open, onClose, returnFocusTo = null }: R8CommandPaletteProps) {
  const { t } = useT()
  const [entries, setEntries] = useState<CommandPaletteEntry[]>([])
  const [historyEntries, setHistoryEntries] = useState<CommandHistoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const uriQuery = query.trim()
  const canResolveUri = /^devhub:\/\/[a-z-]+\/[^?]+(?:\?.*)?$/i.test(uriQuery)
  const cmdkPopoutPort = useMemo(() => parsePortPopoutCommand(uriQuery), [uriQuery])
  const scopePrefix = useMemo(() => parseCommandScopePrefix(query), [query])
  const grouped = useMemo(() => {
    const groups = new Map<CommandPaletteEntry['category'], CommandRenderEntry[]>()
    const scopedEntries = scopePrefix ? entries.filter(entry => commandMatchesScopePrefix(entry, scopePrefix)) : entries
    const searchedEntries = searchCommandEntries(scopedEntries, scopePrefix?.search ?? query, historyEntries)
    for (const item of [...buildRecentCommandEntries(searchedEntries, historyEntries), ...searchedEntries]) {
      groups.set(item.entry.category, [...(groups.get(item.entry.category) ?? []), item])
    }
    return Array.from(groups.entries())
  }, [entries, historyEntries, query, scopePrefix])

  const closePalette = useCallback(() => {
    onClose()
    if (returnFocusTo?.isConnected) {
      window.setTimeout(() => returnFocusTo.focus({ preventScroll: true }), 0)
    }
  }, [onClose, returnFocusTo])

  useEffect(() => {
    if (!open) return
    let disposed = false
    void Promise.all([
      window.devhub.r8.command.list(),
      window.devhub.r8.command.history().catch(() => [])
    ])
      .then(([nextEntries, nextHistory]) => {
        if (!disposed) {
          setEntries(nextEntries)
          setHistoryEntries(nextHistory)
          setError(null)
        }
      })
      .catch((reason) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      disposed = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePalette()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePalette, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      const list = document.querySelector<HTMLElement>('[data-testid="command-palette"] [cmdk-list]')
      if (list) {
        list.setAttribute('role', 'presentation')
        list.removeAttribute('aria-label')
      }
      const sizer = document.querySelector<HTMLElement>('[data-testid="command-palette"] [cmdk-list-sizer]')
      if (!sizer) return
      sizer.setAttribute('role', 'group')
      sizer.setAttribute('aria-label', 'R8 command suggestion groups')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [grouped.length, open, query])

  if (!open) return null

  const invoke = async (entry: CommandPaletteEntry) => {
    await window.devhub.r8.command.invoke(entry.id)
    closePalette()
  }

  const resolveUri = async () => {
    if (!canResolveUri) return
    await window.devhub.r8.command.resolveUri(uriQuery)
    closePalette()
  }

  const requestPortPopout = async () => {
    if (cmdkPopoutPort === null) return
    try {
      await window.devhub.r8.command.invoke('popout.port', { port: cmdkPopoutPort })
      closePalette()
      return
    } catch {
      await window.devhub.r8.command.invoke('monitor.port').catch(() => undefined)
    }
    window.setTimeout(() => {
      dispatchPortPopoutRequest({
        port: cmdkPopoutPort,
        trigger: 'cmdk'
      })
    }, 0)
    closePalette()
  }

  return (
    <div className="fixed inset-0 z-[6000] bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="R8 命令面板" data-testid="command-palette">
      <div className="mx-auto mt-24 w-[min(760px,calc(100vw-32px))] border border-surface-600 bg-surface-950 shadow-2xl radius-md overflow-hidden">
        <Command className="bg-surface-950 text-text-primary" shouldFilter={false}>
          <div className="flex items-center gap-3 border-b border-surface-700 px-4 py-3">
            <Icon token="lucide:Search" decorative size={16} className="text-accent" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
              placeholder={t('cmdk.placeholder')}
            />
            {scopePrefix && (
              <span
                className="shrink-0 border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-wider text-accent radius-sm"
                data-testid="cmdk-scope-filter"
                title={scopePrefix.filter.description}
              >
                {scopePrefix.prefix} {scopePrefix.filter.label}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Ctrl+K</span>
          </div>
          <Command.List role="presentation" className="max-h-[420px] overflow-y-auto p-3">
            {error && <div className="px-3 py-2 text-sm text-warning">{error}</div>}
            {canResolveUri && (
              <Command.Item
                key="uri-resolve"
                value={uriQuery}
                onSelect={() => { void resolveUri() }}
                className="mb-3 flex cursor-pointer items-center gap-3 border-l-2 border-accent bg-accent/10 px-3 py-2 text-sm text-text-primary hover:bg-accent/20 data-[selected=true]:bg-accent/20 radius-sm"
              >
                <Icon token="lucide:Terminal" decorative size={14} className="text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-text-primary">解析并跳转 URI</div>
                  <div className="truncate text-xs text-text-muted">{uriQuery}</div>
                </div>
              </Command.Item>
            )}
            {cmdkPopoutPort !== null && (
              <Command.Item
                key={`port-popout-${cmdkPopoutPort}`}
                value={`popout ${cmdkPopoutPort}`}
                onSelect={() => { void requestPortPopout() }}
                data-testid="cmdk-port-popout-trigger"
                className="mb-3 flex cursor-pointer items-center gap-3 border-l-2 border-accent bg-accent/10 px-3 py-2 text-sm text-text-primary hover:bg-accent/20 data-[selected=true]:bg-accent/20 radius-sm"
              >
                <Icon token="lucide:ExternalLink" decorative size={14} className="text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-text-primary">打开端口 {cmdkPopoutPort} 浮卡</div>
                  <div className="truncate text-xs text-text-muted">仅当当前 renderer 端口列表存在该端口时才会创建真实 floating popout</div>
                </div>
              </Command.Item>
            )}
            {grouped.length === 0 && <div className="px-3 py-6 text-center text-sm text-text-muted">没有匹配命令</div>}
            {grouped.map(([category, items]) => (
              <Command.Group key={category} heading={<CommandGroupHeading category={category} count={items.length} />} className="mb-3 text-xs text-text-muted" data-testid={`cmdk-group-${category}`}>
                <KeyboardNavGroup
                  ariaLabel={`${CATEGORY_LABELS[category]} commands`}
                  role="listbox"
                  orientation="vertical"
                  className="space-y-1"
                >
                  {items.map(({ entry, titleMatchRanges }) => (
                    <Command.Item
                      key={entry.id}
                      value={buildCommandItemValue(entry)}
                      keywords={entry.keywords ?? []}
                      onSelect={() => { void invoke(entry) }}
                      className="flex cursor-pointer items-center gap-3 border-l-2 border-transparent px-3 py-2 text-sm text-text-secondary hover:border-accent hover:bg-surface-800 hover:text-text-primary data-[selected=true]:border-accent data-[selected=true]:bg-surface-800 data-[selected=true]:text-text-primary radius-sm"
                    >
                      <Icon token="lucide:Terminal" decorative size={14} className="text-accent" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-text-primary">
                          <HighlightedCommandTitle title={entry.title} ranges={titleMatchRanges} />
                        </div>
                        {entry.description && <div className="truncate text-xs text-text-muted">{entry.description}</div>}
                      </div>
                      {entry.requiresConfirmation && <span className="text-[10px] text-warning">确认</span>}
                    </Command.Item>
                  ))}
                </KeyboardNavGroup>
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
