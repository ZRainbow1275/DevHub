import {
  cliOutputEventSchema,
  progressDataPointSchema,
  titlePatternRuleSchema,
  type CliOutputEvent,
  type ParseSession,
  type ParserDescriptor,
  type ProgressDataPoint,
  type TitlePatternRule,
  type TitleTool
} from '@shared/schemas/r8-runtime'
import type { IParser, ParseChunkContext } from '../IParser'
import titleRulesConfig from '../title-rules.json'

interface CompiledTitleRule extends TitlePatternRule {
  regexObject: RegExp
}

const DEFAULT_CURSOR_RULES: readonly TitlePatternRule[] = titleRulesConfig.cursor.map(rule => titlePatternRuleSchema.parse(rule))

function compileTitleRules(rules: readonly unknown[], tool: TitleTool): CompiledTitleRule[] {
  return rules.map((input, index) => {
    const rule = titlePatternRuleSchema.parse(input)
    if (rule.tool !== tool) throw new Error(`E_VALIDATION:title rule tool mismatch at index ${index}`)
    try {
      return { ...rule, regexObject: new RegExp(rule.regex, rule.flags) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`E_VALIDATION:invalid title regex at index ${index}: ${message}`)
    }
  })
}

function eventPhase(phase: TitlePatternRule['phase']): CliOutputEvent['phase'] {
  if (phase === 'idle') return 'idle'
  if (phase === 'thinking') return 'thinking'
  if (phase === 'completed') return 'completed'
  return 'working'
}

function eventType(phase: TitlePatternRule['phase']): CliOutputEvent['eventType'] {
  if (phase === 'completed') return 'completion'
  if (phase === 'idle') return 'unknown'
  return 'progress'
}

function progress(phase: TitlePatternRule['phase']): number | null {
  if (phase === 'thinking') return 0.25
  if (phase === 'editing' || phase === 'running') return 0.55
  if (phase === 'completed') return 1
  return null
}

export class CursorTitleParser implements IParser {
  private rules = compileTitleRules(DEFAULT_CURSOR_RULES, 'cursor')
  readonly descriptor: ParserDescriptor = { tool: 'cursor', strategy: 'line', priority: 94, enabled: true }

  parseChunk(chunk: Buffer | string, context: ParseChunkContext): CliOutputEvent[] {
    return String(chunk).split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => this.parseTitle(line, context))
  }

  estimateProgress(events: readonly CliOutputEvent[], session: ParseSession): ProgressDataPoint | null {
    const latest = [...events].reverse().find(event => event.progress !== null)
    if (!latest || latest.progress === null) return null
    return progressDataPointSchema.parse({ instanceId: session.instanceId, percent: latest.progress, source: 'heuristic', confidence: latest.confidence, observedAt: latest.observedAt, message: latest.line })
  }

  reloadRules(rules: readonly unknown[]) {
    this.rules = compileTitleRules(rules, 'cursor')
    return { success: true, tool: 'cursor' as const, applied: this.rules.length }
  }

  reset(): void {}
  dispose(): void {}

  private parseTitle(title: string, context: ParseChunkContext): CliOutputEvent {
    const rule = this.rules.find(candidate => {
      candidate.regexObject.lastIndex = 0
      return candidate.regexObject.test(title)
    })
    return cliOutputEventSchema.parse({
      tool: 'cursor',
      stream: 'title',
      line: title,
      progress: rule ? progress(rule.phase) : null,
      confidence: rule?.confidence ?? 0.1,
      phase: rule ? eventPhase(rule.phase) : 'working',
      observedAt: context.observedAt,
      eventType: rule ? eventType(rule.phase) : 'unknown',
      rawSource: 'window-title',
      instanceId: context.session.instanceId,
      sessionId: context.session.sessionId,
      payload: { titlePhase: rule?.phase ?? 'unknown', rawTitle: title }
    })
  }
}

export { DEFAULT_CURSOR_RULES }
