import { randomUUID } from 'node:crypto'
import {
  parseSessionSchema,
  type CliOutputEvent,
  type ParseSession,
  type ParserStrategy,
  type ProgressDataPoint
} from '@shared/schemas/r8-runtime'
import { ParserRegistry } from './ParserRegistry'
import { CopilotTitleParser, CursorTitleParser, GeminiParser } from './parsers'
import { StreamMultiplexer } from './StreamMultiplexer'
import type { CliStreamName, CliToolName } from './IParser'

export interface ParseCliChunkInput {
  chunk: Buffer | string
  tool?: CliToolName
  stream?: CliStreamName
  instanceId?: string
  sessionId?: string
  strategy?: ParserStrategy
  observedAt?: number
}

export class CLIOutputParser {
  private readonly registry = new ParserRegistry()
  private readonly multiplexer = new StreamMultiplexer()
  private readonly sessions = new Map<string, ParseSession>()
  private readonly events: CliOutputEvent[] = []
  private readonly subscribers = new Set<(events: readonly CliOutputEvent[]) => void>()

  parseChunk(input: ParseCliChunkInput): CliOutputEvent[] {
    const observedAt = input.observedAt ?? Date.now()
    const session = this.resolveSession(input, observedAt)
    const parser = this.registry.get({ tool: session.tool, strategy: input.strategy ?? session.strategy })
    const parsed = parser.parseChunk(input.chunk, { session, stream: input.stream ?? 'stdout', observedAt })
    const updated = parseSessionSchema.parse({
      ...session,
      strategy: parser.descriptor.strategy,
      bytesProcessed: session.bytesProcessed + Buffer.byteLength(String(input.chunk)),
      eventsEmitted: session.eventsEmitted + parsed.length,
      lastEventAt: parsed.length > 0 ? observedAt : session.lastEventAt
    })
    this.sessions.set(updated.sessionId, updated)
    this.events.push(...parsed)
    if (this.events.length > 1000) this.events.splice(0, this.events.length - 1000)
    if (parsed.length > 0) this.notifySubscribers(parsed)
    return parsed
  }

  subscribe(listener: (events: readonly CliOutputEvent[]) => void): () => void {
    this.subscribers.add(listener)
    return () => {
      this.subscribers.delete(listener)
    }
  }

  listSessions(): ParseSession[] {
    return Array.from(this.sessions.values()).sort((left, right) => right.startedAt - left.startedAt)
  }

  listEvents(): CliOutputEvent[] {
    return [...this.events]
  }

  getProgress(instanceId: string): ProgressDataPoint | null {
    const session = this.listSessions().find(item => item.instanceId === instanceId)
    if (!session) return null
    return this.multiplexer.fuse(this.events, session)
  }

  selectStrategy(input: { sessionId?: string; instanceId?: string; strategy: ParserStrategy }): ParseSession {
    const session = this.findSession(input)
    if (!session) throw new Error('E_NOT_FOUND:parse session not found')
    const parser = this.registry.get({ tool: session.tool, strategy: input.strategy })
    const updated = parseSessionSchema.parse({ ...session, strategy: parser.descriptor.strategy })
    this.sessions.set(updated.sessionId, updated)
    return updated
  }

  descriptors() {
    return this.registry.descriptors()
  }

  reloadGeminiRules(rules: readonly unknown[]) {
    return this.geminiParser().reloadRules(rules)
  }

  getGeminiPatternStat(input: { instanceId?: string } = {}) {
    return this.geminiParser().getStats(input.instanceId)
  }

  reloadTitleRules(rules: readonly unknown[]) {
    const cursorRules = rules.filter(rule => rule && typeof rule === 'object' && (rule as { tool?: unknown }).tool === 'cursor')
    const copilotRules = rules.filter(rule => rule && typeof rule === 'object' && (rule as { tool?: unknown }).tool === 'copilot')
    let applied = 0
    if (cursorRules.length > 0) applied += this.cursorTitleParser().reloadRules(cursorRules).applied
    if (copilotRules.length > 0) applied += this.copilotTitleParser().reloadRules(copilotRules).applied
    if (applied === 0) throw new Error('E_VALIDATION:title rules must target cursor or copilot')
    return { success: true, applied }
  }
  private geminiParser(): GeminiParser {
    const parser = this.registry.get({ tool: 'gemini', strategy: 'line' })
    if (parser instanceof GeminiParser) return parser
    throw new Error('E_INTERNAL:Gemini parser is not registered')
  }

  private cursorTitleParser(): CursorTitleParser {
    const parser = this.registry.get({ tool: 'cursor', strategy: 'line' })
    if (parser instanceof CursorTitleParser) return parser
    throw new Error('E_INTERNAL:Cursor title parser is not registered')
  }

  private copilotTitleParser(): CopilotTitleParser {
    const parser = this.registry.get({ tool: 'copilot', strategy: 'line' })
    if (parser instanceof CopilotTitleParser) return parser
    throw new Error('E_INTERNAL:Copilot title parser is not registered')
  }
  private resolveSession(input: ParseCliChunkInput, observedAt: number): ParseSession {
    const existing = this.findSession(input)
    if (existing) return existing
    const tool = input.tool ?? 'unknown'
    const strategy = input.strategy ?? this.registry.get({ tool }).descriptor.strategy
    const session = parseSessionSchema.parse({
      sessionId: input.sessionId ?? randomUUID(),
      instanceId: input.instanceId ?? `${tool}-${randomUUID()}`,
      tool,
      strategy,
      startedAt: observedAt,
      bytesProcessed: 0,
      eventsEmitted: 0,
      lastEventAt: null
    })
    this.sessions.set(session.sessionId, session)
    return session
  }

  private findSession(input: { sessionId?: string; instanceId?: string }): ParseSession | null {
    if (input.sessionId && this.sessions.has(input.sessionId)) return this.sessions.get(input.sessionId) ?? null
    if (input.instanceId) return this.listSessions().find(session => session.instanceId === input.instanceId) ?? null
    return null
  }

  private notifySubscribers(events: readonly CliOutputEvent[]): void {
    for (const subscriber of this.subscribers) {
      subscriber(events)
    }
  }
}
