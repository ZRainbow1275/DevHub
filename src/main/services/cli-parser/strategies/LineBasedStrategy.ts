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

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 1))
}

function classifyLine(line: string): Pick<CliOutputEvent, 'phase' | 'progress' | 'confidence' | 'eventType' | 'payload'> {
  const lower = line.toLowerCase()
  const stepMatch = line.match(/\bStep\s+(\d+)\s*\/\s*(\d+)\b/i)
  if (stepMatch) {
    const current = Number(stepMatch[1])
    const total = Number(stepMatch[2])
    return { phase: lower.includes('validat') || lower.includes('typecheck') || lower.includes('lint') || lower.includes('check') || lower.includes('test') ? 'validating' : 'working', progress: clampProgress(current / total), confidence: 0.82, eventType: 'progress', payload: { step: current, total } }
  }

  const percentMatch = line.match(/(\d{1,3}(?:\.\d+)?)\s*%/)
  if (percentMatch) {
    return { phase: lower.includes('validat') || lower.includes('typecheck') || lower.includes('lint') || lower.includes('check') || lower.includes('test') ? 'validating' : 'working', progress: clampProgress(Number(percentMatch[1]) / 100), confidence: 0.78, eventType: 'progress' }
  }

  if (/\b(waiting|input required|permission|confirm)\b/i.test(line)) return { phase: 'waiting-input', progress: null, confidence: 0.74, eventType: 'waiting-input' }
  if (/\b(error|failed|exception|traceback)\b/i.test(line)) return { phase: 'error', progress: null, confidence: 0.8, eventType: 'error' }
  if (/\b(done|complete|completed|success|passed)\b/i.test(line)) return { phase: 'completed', progress: 1, confidence: 0.76, eventType: 'completion' }
  if (/\b(thinking|reasoning|planning)\b/i.test(line)) return { phase: 'thinking', progress: 0.25, confidence: 0.58, eventType: 'message-out' }
  if (/\b(start|launch|begin)\b/i.test(line)) return { phase: 'working', progress: 0.05, confidence: 0.56, eventType: 'start' }
  return { phase: 'working', progress: null, confidence: 0.45, eventType: 'message-out' }
}

export class LineBasedStrategy implements IParser {
  readonly descriptor: ParserDescriptor

  constructor(tool: ParserDescriptor['tool'] = 'unknown', priority = 50) {
    this.descriptor = parserDescriptorSchema.parse({ tool, strategy: 'line', priority, enabled: true })
  }

  parseChunk(chunk: Buffer | string, context: ParseChunkContext): CliOutputEvent[] {
    return String(chunk).split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0).map(line => cliOutputEventSchema.parse({
      tool: context.session.tool,
      stream: context.stream,
      line,
      ...classifyLine(line),
      observedAt: context.observedAt,
      rawSource: 'line',
      instanceId: context.session.instanceId,
      sessionId: context.session.sessionId
    }))
  }

  estimateProgress(events: readonly CliOutputEvent[], session: ParseSession): ProgressDataPoint | null {
    const latest = [...events].reverse().find(event => event.progress !== null)
    if (!latest || latest.progress === null) return null
    return progressDataPointSchema.parse({ instanceId: session.instanceId, percent: latest.progress, source: 'cli-real', confidence: latest.confidence, observedAt: latest.observedAt, message: latest.line })
  }

  reset(): void {}
  dispose(): void {}
}
