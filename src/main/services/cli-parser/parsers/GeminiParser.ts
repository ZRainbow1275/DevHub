import { cliOutputEventSchema, type CliOutputEvent, type ParseSession, type ParserDescriptor, type ProgressDataPoint } from '@shared/schemas/r8-runtime'
import {
  GEMINI_PATTERN_KINDS,
  geminiPatternRuleInputSchema,
  geminiPatternStatSchema,
  type GeminiPatternKind,
  type GeminiPatternRuleInput,
  type GeminiPatternStat
} from '@shared/schemas/gemini-pattern'
import type { IParser, ParseChunkContext } from '../IParser'
import { LineBasedStrategy } from '../strategies/LineBasedStrategy'

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27, 91)}[0-?]*[ -/]*[@-~]`, 'g')
const MAX_GEMINI_LINE_CHARS = 16_000

interface GeminiRule extends GeminiPatternRuleInput {
  regexObject: RegExp
}

interface GeminiParseState {
  kindCounts: Record<GeminiPatternKind, number>
  totalLines: number
  unmatchedLines: number
  lastKind: GeminiPatternKind | null
  toolStack: string[]
  partialBuffer: string
}

const DEFAULT_RULE_INPUTS: readonly GeminiPatternRuleInput[] = [
  { kind: 'thinking', regex: '\\bthinking\\b|思考中|reasoning', flags: 'i', confidence: 0.85, ansiStrip: true },
  { kind: 'tool_call', regex: '\\[tool:\\s*([^\\]]+)\\]', flags: 'i', confidence: 0.9, ansiStrip: true },
  { kind: 'tool_call', regex: '\\b(?:calling|running)\\s+tool[:\\s]+([A-Za-z0-9_.:-]+)', flags: 'i', confidence: 0.88, ansiStrip: true },
  { kind: 'tool_result', regex: 'tool result|工具结果', flags: 'i', confidence: 0.82, ansiStrip: true },
  { kind: 'completion', regex: '\\b(done|completed|finished)\\b|完成', flags: 'i', confidence: 0.8, ansiStrip: true },
  { kind: 'rate_limit', regex: 'rate limit|quota|429', flags: 'i', confidence: 0.86, ansiStrip: true },
  { kind: 'safety_block', regex: 'safety|blocked|policy', flags: 'i', confidence: 0.84, ansiStrip: true },
  { kind: 'partial_text', regex: '.', flags: '', confidence: 0.42, ansiStrip: true }
]

function stripAnsi(line: string): string {
  try {
    return line.replace(ANSI_PATTERN, '')
  } catch {
    return line
  }
}

function boundLine(line: string): string {
  if (line.length <= MAX_GEMINI_LINE_CHARS) return line
  return `${line.slice(0, MAX_GEMINI_LINE_CHARS)} [truncated:${line.length - MAX_GEMINI_LINE_CHARS}]`
}

function extractToolName(line: string): string | undefined {
  const bracketTool = /\[tool:\s*([^\]]+)\]/i.exec(line)?.[1]
  if (bracketTool) return bracketTool.trim()
  const proseTool = /\b(?:calling|running)\s+tool[:\s]+([A-Za-z0-9_.:-]+)/i.exec(line)?.[1]
  return proseTool?.trim()
}

function phaseForKind(kind: GeminiPatternKind): CliOutputEvent['phase'] {
  if (kind === 'thinking') return 'thinking'
  if (kind === 'completion') return 'completed'
  if (kind === 'rate_limit' || kind === 'safety_block') return 'error'
  if (kind === 'tool_call' || kind === 'tool_result') return 'working'
  return 'working'
}

function eventTypeForKind(kind: GeminiPatternKind): CliOutputEvent['eventType'] {
  if (kind === 'tool_call' || kind === 'tool_result') return 'tool-use'
  if (kind === 'completion') return 'completion'
  if (kind === 'rate_limit' || kind === 'safety_block') return 'error'
  if (kind === 'thinking') return 'progress'
  if (kind === 'partial_text') return 'message-out'
  return 'unknown'
}

function emptyCounts(): Record<GeminiPatternKind, number> {
  return Object.fromEntries(GEMINI_PATTERN_KINDS.map(kind => [kind, 0])) as Record<GeminiPatternKind, number>
}

function compileRules(inputs: readonly unknown[]): GeminiRule[] {
  return inputs.map((input, index) => {
    const rule = geminiPatternRuleInputSchema.parse(input)
    try {
      return { ...rule, regexObject: new RegExp(rule.regex, rule.flags) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`E_VALIDATION:invalid Gemini regex at index ${index}: ${message}`)
    }
  })
}

export class GeminiParser implements IParser {
  private readonly fallback = new LineBasedStrategy('gemini', 45)
  private readonly stateByInstance = new Map<string, GeminiParseState>()
  private rules = compileRules(DEFAULT_RULE_INPUTS)
  private ruleVersion = 1
  readonly descriptor: ParserDescriptor = { tool: 'gemini', strategy: 'line', priority: 92, enabled: true }

  parseChunk(chunk: Buffer | string, context: ParseChunkContext): CliOutputEvent[] {
    return String(chunk).split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => this.parseLine(line, context))
  }

  estimateProgress(events: readonly CliOutputEvent[], session: ParseSession): ProgressDataPoint | null {
    return this.fallback.estimateProgress(events, session)
  }

  reloadRules(inputs: readonly unknown[]): { success: true; applied: number; ruleVersion: number; kinds: GeminiPatternKind[] } {
    const rules = compileRules(inputs)
    if (rules.length === 0) throw new Error('E_VALIDATION:at least one Gemini pattern rule is required')
    this.rules = rules
    this.ruleVersion += 1
    this.reset()
    return { success: true, applied: rules.length, ruleVersion: this.ruleVersion, kinds: rules.map(rule => rule.kind) }
  }

  getStats(instanceId?: string): GeminiPatternStat {
    if (instanceId) return this.toStats(instanceId, this.stateByInstance.get(instanceId) ?? this.createState())
    const aggregate = this.createState()
    for (const state of this.stateByInstance.values()) {
      aggregate.totalLines += state.totalLines
      aggregate.unmatchedLines += state.unmatchedLines
      aggregate.lastKind = state.lastKind ?? aggregate.lastKind
      aggregate.toolStack.push(...state.toolStack)
      aggregate.partialBuffer += state.partialBuffer
      for (const kind of GEMINI_PATTERN_KINDS) aggregate.kindCounts[kind] += state.kindCounts[kind]
    }
    return this.toStats(null, aggregate)
  }

  reset(): void {
    this.stateByInstance.clear()
    this.fallback.reset()
  }

  dispose(): void {
    this.stateByInstance.clear()
    this.fallback.dispose()
  }

  private parseLine(rawLine: string, context: ParseChunkContext): CliOutputEvent {
    const match = this.matchRule(boundLine(rawLine))
    const line = match.line
    const state = this.stateFor(context.session.instanceId)
    const kind = match.rule?.kind ?? 'unknown'
    state.totalLines += 1
    state.kindCounts[kind] += 1
    state.lastKind = kind
    if (!match.rule || kind === 'unknown' || kind === 'partial_text') state.unmatchedLines += 1

    if (!match.rule || kind === 'partial_text' || kind === 'unknown') {
      state.partialBuffer = (state.partialBuffer + line).slice(-4096)
      const fallbackEvent = this.fallback.parseChunk(line, context)[0]
      return { ...fallbackEvent, payload: { ...fallbackEvent.payload, kind, ruleVersion: this.ruleVersion } }
    }

    state.partialBuffer = ''
    const tool = extractToolName(line)
    if (kind === 'tool_call' && tool) state.toolStack.push(tool)
    if (kind === 'tool_result' && state.toolStack.length > 0) state.toolStack.pop()

    return cliOutputEventSchema.parse({
      tool: 'gemini',
      stream: context.stream,
      line,
      progress: kind === 'thinking' ? 0.25 : kind === 'completion' ? 1 : null,
      confidence: match.rule.confidence,
      phase: phaseForKind(kind),
      observedAt: context.observedAt,
      eventType: eventTypeForKind(kind),
      rawSource: 'line',
      instanceId: context.session.instanceId,
      sessionId: context.session.sessionId,
      payload: { kind, tool, ruleVersion: this.ruleVersion }
    })
  }

  private matchRule(rawLine: string): { rule: GeminiRule | null; line: string } {
    for (const rule of this.rules) {
      rule.regexObject.lastIndex = 0
      const line = rule.ansiStrip ? stripAnsi(rawLine) : rawLine
      if (rule.regexObject.test(line)) return { rule, line }
    }
    return { rule: null, line: stripAnsi(rawLine) }
  }

  private stateFor(instanceId: string): GeminiParseState {
    const current = this.stateByInstance.get(instanceId)
    if (current) return current
    const created = this.createState()
    this.stateByInstance.set(instanceId, created)
    return created
  }

  private createState(): GeminiParseState {
    return { kindCounts: emptyCounts(), totalLines: 0, unmatchedLines: 0, lastKind: null, toolStack: [], partialBuffer: '' }
  }

  private toStats(instanceId: string | null, state: GeminiParseState): GeminiPatternStat {
    return geminiPatternStatSchema.parse({
      instanceId,
      kindCounts: state.kindCounts,
      totalLines: state.totalLines,
      unmatchedLines: state.unmatchedLines,
      unmatchedRatio: state.totalLines === 0 ? 0 : state.unmatchedLines / state.totalLines,
      lastKind: state.lastKind,
      toolStack: state.toolStack,
      partialBufferBytes: Buffer.byteLength(state.partialBuffer),
      ruleVersion: this.ruleVersion,
      appliedRules: this.rules.length,
      observedAt: Date.now()
    })
  }
}
