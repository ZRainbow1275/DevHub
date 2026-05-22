import {
  cliOutputEventSchema,
  progressDataPointSchema,
  type CliOutputEvent,
  type ParseSession,
  type ParserDescriptor,
  type ProgressDataPoint
} from '@shared/schemas/r8-runtime'
import {
  CLAUDE_STREAM_SCHEMA_VERSION,
  claudeStreamEventSchema,
  type ClaudeAssistantContentBlock,
  type ClaudeStreamEvent,
  type ClaudeUsage
} from '@shared/schemas/claude-stream'
import type { IParser, ParseChunkContext } from '../IParser'

const PARTIAL_THROTTLE_MS = 100

interface PartialAssistantWindow {
  readonly lastEmittedAt: number
  readonly bufferedText: string
  readonly suppressedCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function usageProgress(event: ClaudeStreamEvent): number | null {
  const usage = usageFromEvent(event)
  const input = usage?.input_tokens ?? 0
  const output = usage?.output_tokens ?? 0
  if (input + output <= 0) return null
  return Math.max(0.1, Math.min(0.85, output / Math.max(input + output + 20, 1)))
}

function usageFromEvent(event: ClaudeStreamEvent): ClaudeUsage | null {
  if (event.type === 'assistant') return event.message.usage ?? null
  if (event.type === 'result') return event.usage
  return null
}

function findToolUse(content: readonly ClaudeAssistantContentBlock[]): Extract<ClaudeAssistantContentBlock, { type: 'tool_use' }> | null {
  return content.find((item): item is Extract<ClaudeAssistantContentBlock, { type: 'tool_use' }> => item.type === 'tool_use') ?? null
}

function toolResultIds(content: readonly ClaudeAssistantContentBlock[]): string[] {
  return content
    .filter((item): item is Extract<ClaudeAssistantContentBlock, { type: 'tool_result' }> => item.type === 'tool_result')
    .map(item => item.tool_use_id)
}

function textFromPartialContent(content: readonly unknown[]): string {
  const parts: string[] = []
  for (const item of content) {
    if (typeof item === 'string') {
      parts.push(item)
      continue
    }
    if (isRecord(item) && typeof item.text === 'string') parts.push(item.text)
  }
  return parts.join('')
}

export class ClaudeParser implements IParser {
  readonly descriptor: ParserDescriptor = { tool: 'claude', strategy: 'ndjson', priority: 99, enabled: true }
  private readonly partialAssistantWindows = new Map<string, PartialAssistantWindow>()

  parseChunk(chunk: Buffer | string, context: ParseChunkContext): CliOutputEvent[] {
    const events: CliOutputEvent[] = []
    for (const line of String(chunk).split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
      events.push(...this.parseLine(line, context))
    }
    return events
  }

  estimateProgress(events: readonly CliOutputEvent[], session: ParseSession): ProgressDataPoint | null {
    const latest = [...events].reverse().find(event => event.progress !== null)
    if (!latest || latest.progress === null) return null
    return progressDataPointSchema.parse({ instanceId: session.instanceId, percent: latest.progress, source: 'cli-real', confidence: latest.confidence, observedAt: latest.observedAt, message: latest.line })
  }

  reset(): void {
    this.partialAssistantWindows.clear()
  }

  dispose(): void {
    this.partialAssistantWindows.clear()
  }

  private parseLine(line: string, context: ParseChunkContext): CliOutputEvent[] {
    let raw: unknown
    try {
      raw = JSON.parse(line)
    } catch {
      return [this.errorEvent(line, context, 'invalid_stream_json')]
    }

    const parsed = claudeStreamEventSchema.safeParse(raw)
    if (!parsed.success) {
      return [this.errorEvent(line, context, 'invalid_claude_stream_schema', parsed.error.issues.length)]
    }

    const event = this.toCliEvent(parsed.data, line, context)
    return event ? [event] : []
  }

  private errorEvent(line: string, context: ParseChunkContext, subtype: string, issueCount?: number): CliOutputEvent {
    return cliOutputEventSchema.parse({
      tool: 'claude',
      stream: context.stream,
      line,
      progress: null,
      confidence: 0.1,
      phase: 'error',
      observedAt: context.observedAt,
      eventType: 'error',
      rawSource: 'ndjson',
      instanceId: context.session.instanceId,
      sessionId: context.session.sessionId,
      payload: { subtype, issueCount, expectedSchemaVersion: CLAUDE_STREAM_SCHEMA_VERSION }
    })
  }

  private toCliEvent(event: ClaudeStreamEvent, line: string, context: ParseChunkContext): CliOutputEvent | null {
    if (event.type === 'system') {
      return cliOutputEventSchema.parse({
        tool: 'claude',
        stream: context.stream,
        line,
        progress: 0.1,
        confidence: 1,
        phase: 'thinking',
        observedAt: context.observedAt,
        eventType: 'phase_marker',
        rawSource: 'ndjson',
        instanceId: context.session.instanceId,
        sessionId: context.session.sessionId,
        payload: { phase: 'thinking', subtype: event.subtype, claudeSessionId: event.session_id, model: event.model, schemaVersion: event.schemaVersion }
      })
    }

    if (event.type === 'assistant') {
      const toolUse = findToolUse(event.message.content)
      const resultIds = toolResultIds(event.message.content)
      const progress = usageProgress(event)
      const usage = usageFromEvent(event)
      return cliOutputEventSchema.parse({
        tool: 'claude',
        stream: context.stream,
        line,
        progress,
        confidence: toolUse ? 0.95 : 0.7,
        phase: toolUse || resultIds.length > 0 ? 'working' : 'thinking',
        observedAt: context.observedAt,
        eventType: toolUse ? 'tool_invocation' : 'progress_pct',
        rawSource: 'ndjson',
        instanceId: context.session.instanceId,
        sessionId: context.session.sessionId,
        payload: {
          tool: toolUse?.name,
          toolInput: toolUse?.input,
          toolUseId: toolUse?.id,
          toolResultIds: resultIds,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
          model: event.message.model,
          rawType: event.type,
          schemaVersion: event.schemaVersion
        }
      })
    }

    if (event.type === 'result') {
      return cliOutputEventSchema.parse({
        tool: 'claude',
        stream: context.stream,
        line,
        progress: event.is_error ? null : 1,
        confidence: 1,
        phase: event.is_error ? 'error' : 'completed',
        observedAt: context.observedAt,
        eventType: event.is_error ? 'error' : 'completion',
        rawSource: 'ndjson',
        instanceId: context.session.instanceId,
        sessionId: context.session.sessionId,
        payload: {
          subtype: event.subtype,
          isError: event.is_error,
          rawType: event.type,
          durationMs: event.duration_ms,
          costUsd: event.total_cost_usd,
          inputTokens: event.usage.input_tokens,
          outputTokens: event.usage.output_tokens,
          schemaVersion: event.schemaVersion
        }
      })
    }

    if (event.type === 'partial_assistant') {
      return this.partialAssistantEvent(event, line, context)
    }

    return cliOutputEventSchema.parse({
      tool: 'claude',
      stream: context.stream,
      line,
      progress: null,
      confidence: 0.2,
      phase: 'working',
      observedAt: context.observedAt,
      eventType: 'unknown',
      rawSource: 'ndjson',
      instanceId: context.session.instanceId,
      sessionId: context.session.sessionId,
      payload: { rawType: event.type }
    })
  }

  private partialAssistantEvent(event: ClaudeStreamEvent, line: string, context: ParseChunkContext): CliOutputEvent | null {
    if (event.type !== 'partial_assistant') return null
    const instanceId = context.session.instanceId
    const previous = this.partialAssistantWindows.get(instanceId) ?? {
      lastEmittedAt: 0,
      bufferedText: '',
      suppressedCount: 0
    }
    const nextText = `${previous.bufferedText}${textFromPartialContent(event.message.content)}`
    const shouldEmit = previous.lastEmittedAt === 0 || context.observedAt - previous.lastEmittedAt >= PARTIAL_THROTTLE_MS

    if (!shouldEmit) {
      this.partialAssistantWindows.set(instanceId, {
        lastEmittedAt: previous.lastEmittedAt,
        bufferedText: nextText,
        suppressedCount: previous.suppressedCount + 1
      })
      return null
    }

    this.partialAssistantWindows.set(instanceId, {
      lastEmittedAt: context.observedAt,
      bufferedText: '',
      suppressedCount: 0
    })

    return cliOutputEventSchema.parse({
      tool: 'claude',
      stream: context.stream,
      line,
      progress: null,
      confidence: 0.65,
      phase: 'thinking',
      observedAt: context.observedAt,
      eventType: 'message-out',
      rawSource: 'ndjson',
      instanceId,
      sessionId: context.session.sessionId,
      payload: {
        rawType: event.type,
        text: nextText,
        throttledPartialCount: previous.suppressedCount,
        throttleWindowMs: PARTIAL_THROTTLE_MS,
        schemaVersion: event.schemaVersion
      }
    })
  }
}
