import { createHash } from 'node:crypto'
import {
  cursorCopilotSignalSchema,
  cursorCopilotStatusSchema,
  parseSessionSchema,
  titleRuleReloadRequestSchema,
  type CliOutputEvent,
  type CursorCopilotSignal,
  type TitlePatternRule,
  type TitleTool
} from '@shared/schemas/r8-runtime'
import type { WindowInfo, AITask } from '@shared/types-extended'
import { CursorTitleParser } from './parsers/CursorTitleParser'
import { CopilotTitleParser } from './parsers/CopilotTitleParser'

export type WindowTitleSignal = CursorCopilotSignal

const MAX_SCAN_HZ = 5
const MIN_SCAN_INTERVAL_MS = Math.ceil(1000 / MAX_SCAN_HZ)
const SAME_HWND_THROTTLE_MS = 5_000
const CURSOR_PROCESS_NAMES = new Set(['cursor.exe'])
const COPILOT_PROCESS_NAMES = new Set(['code.exe', 'gh.exe'])

function hashTitle(title: string): string {
  return createHash('sha256').update(title).digest('hex').slice(0, 16)
}

function processBasename(processName: string): string {
  const basename = processName.trim().split(/[\\/]/).pop()?.toLowerCase() ?? ''
  if (!basename || basename.endsWith('.exe')) return basename
  return `${basename}.exe`
}

function processAllowed(tool: TitleTool, processName: string): boolean {
  const normalized = processBasename(processName)
  if (tool === 'cursor') return CURSOR_PROCESS_NAMES.has(normalized)
  return COPILOT_PROCESS_NAMES.has(normalized)
}

function titleTool(title: string): TitleTool | null {
  if (/\bcursor\b/i.test(title)) return 'cursor'
  if (/\bcopilot\b/i.test(title)) return 'copilot'
  return null
}

export class CursorCopilotDetector {
  private readonly cursorParser = new CursorTitleParser()
  private readonly copilotParser = new CopilotTitleParser()
  private readonly lastSignalByHwnd = new Map<number, WindowTitleSignal>()
  private lastScanAt = 0
  private lastScanSignals: readonly WindowTitleSignal[] = []

  scanWindows(windows: readonly WindowInfo[] = [], observedAt = Date.now()): WindowTitleSignal[] {
    if (this.lastScanAt > 0 && observedAt >= this.lastScanAt && observedAt - this.lastScanAt < MIN_SCAN_INTERVAL_MS) {
      return [...this.lastScanSignals]
    }

    const signals: WindowTitleSignal[] = []
    const seen = new Set<number>()
    for (const window of windows) {
      if (!window.title.trim() || seen.has(window.hwnd)) continue
      seen.add(window.hwnd)
      const cached = this.throttledSignal(window, observedAt)
      if (cached) {
        signals.push(cached)
        continue
      }
      const tool = titleTool(window.title)
      if (!tool) continue
      const event = processAllowed(tool, window.processName)
        ? this.parseTitle(tool, window, observedAt)
        : null
      const signal = this.toSignal(window, tool, event, observedAt)
      this.lastSignalByHwnd.set(window.hwnd, signal)
      signals.push(signal)
    }
    const sorted = signals.sort((left, right) => right.confidence - left.confidence)
    this.lastScanAt = observedAt
    this.lastScanSignals = sorted
    return [...sorted]
  }

  status(input: { windows?: readonly WindowInfo[]; aiTasks?: readonly AITask[]; instanceId?: string } = {}) {
    const signals = this.scanWindows(input.windows ?? [])
    const filtered = input.instanceId ? signals.filter(signal => signal.instanceId === input.instanceId) : signals
    const latest = filtered[0] ?? null
    const aiTasks = input.aiTasks ?? []
    const cursorTasks = aiTasks.filter(task => String((task as unknown as Record<string, unknown>).tool ?? '').toLowerCase().includes('cursor')).length
    const copilotTasks = aiTasks.filter(task => String((task as unknown as Record<string, unknown>).tool ?? '').toLowerCase().includes('copilot')).length
    return cursorCopilotStatusSchema.parse({
      checkedAt: Date.now(),
      cursorTasks,
      copilotTasks,
      totalAiTasks: aiTasks.length,
      phase: latest?.phase ?? 'unknown',
      confidence: latest?.confidence ?? 0,
      rawTitle: latest?.rawTitle ?? null,
      titleHash: latest?.titleHash ?? null,
      ts: latest?.ts ?? Date.now(),
      signals: filtered
    })
  }

  reloadRules(rules: readonly unknown[]) {
    const parsed = titleRuleReloadRequestSchema.parse({ rules }).rules
    const cursorRules = parsed.filter(rule => rule.tool === 'cursor')
    const copilotRules = parsed.filter(rule => rule.tool === 'copilot')
    const results = []
    if (cursorRules.length > 0) results.push(this.cursorParser.reloadRules(cursorRules))
    if (copilotRules.length > 0) results.push(this.copilotParser.reloadRules(copilotRules))
    if (results.length === 0) throw new Error('E_VALIDATION:title rules must target cursor or copilot')
    return { success: true, applied: results.reduce((total, result) => total + result.applied, 0), tools: results.map(result => result.tool) }
  }

  private parseTitle(tool: TitleTool, window: WindowInfo, observedAt: number): CliOutputEvent {
    const session = parseSessionSchema.parse({
      sessionId: `title-${tool}-${window.hwnd}`,
      instanceId: `${tool}-${window.hwnd}`,
      tool,
      strategy: 'line',
      startedAt: observedAt,
      bytesProcessed: 0,
      eventsEmitted: 0,
      lastEventAt: null
    })
    const parser = tool === 'cursor' ? this.cursorParser : this.copilotParser
    return parser.parseChunk(window.title, { session, stream: 'title', observedAt })[0]
  }

  private throttledSignal(window: WindowInfo, observedAt: number): WindowTitleSignal | null {
    const cached = this.lastSignalByHwnd.get(window.hwnd)
    if (!cached) return null
    if (observedAt < cached.ts || observedAt - cached.ts >= SAME_HWND_THROTTLE_MS) return null
    if (cached.titleHash !== hashTitle(window.title)) return null
    if (cached.processName !== window.processName || cached.pid !== window.pid) return null
    return cached
  }

  private toSignal(window: WindowInfo, tool: TitleTool, event: CliOutputEvent | null, observedAt: number): WindowTitleSignal {
    const titlePhase = typeof event?.payload?.titlePhase === 'string' ? event.payload.titlePhase : 'unknown'
    const phase = ['idle', 'thinking', 'editing', 'running', 'completed'].includes(titlePhase) ? titlePhase : 'unknown'
    return cursorCopilotSignalSchema.parse({
      instanceId: `${tool}-${window.hwnd}`,
      tool: event ? tool : 'unknown',
      phase,
      confidence: event ? Math.min(event.confidence, 0.7) : 0.1,
      source: 'window-title',
      rawTitle: window.title,
      titleHash: hashTitle(window.title),
      hwnd: window.hwnd,
      pid: window.pid,
      processName: window.processName,
      ts: observedAt
    })
  }
}

export type { TitlePatternRule }
