import {
  cliOutputEventSchema,
  parserDescriptorSchema,
  progressDataPointSchema,
  type CliOutputEvent,
  type ParseSession,
  type ParserDescriptor,
  type ProgressDataPoint
} from '@shared/schemas/r8-runtime'
import type { IParser, ParseChunkContext } from '../IParser'

type JsonRecord = Record<string, unknown>

function textField(record: JsonRecord): string {
  for (const key of ['message', 'text', 'content', 'line', 'summary']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return JSON.stringify(record)
}

function eventType(record: JsonRecord): CliOutputEvent['eventType'] {
  const raw = String(record.type ?? record.event ?? record.kind ?? '').toLowerCase()
  if (raw.includes('start')) return 'start'
  if (raw.includes('progress') || raw.includes('delta')) return 'progress'
  if (raw.includes('tool')) return 'tool-use'
  if (raw.includes('complete') || raw.includes('done') || raw.includes('result')) return 'completion'
  if (raw.includes('error')) return 'error'
  if (raw.includes('message') || raw.includes('assistant')) return 'message-out'
  return 'unknown'
}

function payloadFrom(record: JsonRecord): CliOutputEvent['payload'] {
  const payload: Record<string, unknown> = {}
  if (typeof record.step === 'number') payload.step = record.step
  if (typeof record.total === 'number') payload.total = record.total
  const rawType = record.type ?? record.event ?? record.kind
  if (typeof rawType === 'string' && rawType.trim()) payload.rawType = rawType
  return Object.keys(payload).length > 0 ? payload : undefined
}

function progressFrom(record: JsonRecord): number | null {
  const progress = record.progress ?? record.percent ?? record.percentage
  if (typeof progress === 'number') return progress > 1 ? Math.min(progress / 100, 1) : Math.max(progress, 0)
  const step = record.step
  const total = record.total
  if (typeof step === 'number' && typeof total === 'number' && total > 0) return Math.max(0, Math.min(step / total, 1))
  return null
}

function phaseFrom(type: CliOutputEvent['eventType'], progress: number | null): CliOutputEvent['phase'] {
  if (type === 'completion') return 'completed'
  if (type === 'error') return 'error'
  if (type === 'waiting-input') return 'waiting-input'
  if (type === 'start') return 'working'
  if (progress !== null && progress >= 0.85) return 'validating'
  if (type === 'progress' || type === 'tool-use') return 'working'
  return 'thinking'
}

export class NdjsonStrategy implements IParser {
  readonly descriptor: ParserDescriptor
  private readonly rawSource: 'ndjson' | 'shim'

  constructor(tool: ParserDescriptor['tool'] = 'unknown', priority = 80, rawSource: 'ndjson' | 'shim' = 'ndjson') {
    this.rawSource = rawSource
    this.descriptor = parserDescriptorSchema.parse({ tool, strategy: rawSource === 'shim' ? 'shim' : 'ndjson', priority, enabled: true })
  }

  parseChunk(chunk: Buffer | string, context: ParseChunkContext): CliOutputEvent[] {
    return String(chunk).split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0).map(line => this.parseLine(line, context))
  }

  estimateProgress(events: readonly CliOutputEvent[], session: ParseSession): ProgressDataPoint | null {
    const latest = [...events].reverse().find(event => event.progress !== null)
    if (!latest || latest.progress === null) return null
    return progressDataPointSchema.parse({ instanceId: session.instanceId, percent: latest.progress, source: 'cli-real', confidence: latest.confidence, observedAt: latest.observedAt, message: latest.line })
  }

  reset(): void {}
  dispose(): void {}

  private parseLine(line: string, context: ParseChunkContext): CliOutputEvent {
    try {
      const record = JSON.parse(line) as JsonRecord
      const parsedType = eventType(record)
      const progress = progressFrom(record)
      return cliOutputEventSchema.parse({
        tool: context.session.tool,
        stream: context.stream,
        line: textField(record),
        progress,
        confidence: parsedType === 'unknown' ? 0.35 : 0.88,
        phase: phaseFrom(parsedType, progress),
        observedAt: context.observedAt,
        eventType: parsedType,
        rawSource: this.rawSource,
        payload: payloadFrom(record),
        instanceId: context.session.instanceId,
        sessionId: context.session.sessionId
      })
    } catch {
      return cliOutputEventSchema.parse({
        tool: context.session.tool,
        stream: context.stream,
        line,
        progress: null,
        confidence: 0.1,
        phase: 'working',
        observedAt: context.observedAt,
        eventType: 'unknown',
        rawSource: this.rawSource,
        instanceId: context.session.instanceId,
        sessionId: context.session.sessionId
      })
    }
  }
}
