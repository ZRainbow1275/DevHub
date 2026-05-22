import { cliOutputEventSchema, type CliOutputEvent, type ParserDescriptor } from '@shared/schemas/r8-runtime'
import type { IParser, ParseChunkContext } from '../IParser'
import { LineBasedStrategy } from '../strategies/LineBasedStrategy'
import { ShimStrategy } from '../strategies/ShimStrategy'
import { parseCodexMarkerLine, MARKER_PREFIX } from '../../shim/MarkerProtocol'

function phaseFromMarker(field: string, value: string): CliOutputEvent['phase'] {
  const normalized = value.toLowerCase()
  if (field === 'ERROR') return 'error'
  if (field === 'DONE') return 'completed'
  if (normalized.includes('valid') || normalized.includes('test') || normalized.includes('check')) return 'validating'
  if (normalized.includes('think') || normalized.includes('plan')) return 'thinking'
  if (normalized.includes('wait') || normalized.includes('input')) return 'waiting-input'
  return 'working'
}

function eventTypeFromMarker(field: string): CliOutputEvent['eventType'] {
  if (field === 'PHASE') return 'phase_marker'
  if (field === 'PROGRESS' || field === 'TOKENS' || field === 'HEARTBEAT') return 'progress'
  if (field === 'TOOL') return 'tool-use'
  if (field === 'ERROR') return 'error'
  if (field === 'DONE') return 'completion'
  return 'unknown'
}

function progressFromMarker(field: string, value: string): number | null {
  if (field !== 'PROGRESS') return null
  const numeric = Number(value.replace('%', ''))
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(numeric > 1 ? numeric / 100 : numeric, 1))
}

export class CodexParser implements IParser {
  private readonly shim: ShimStrategy
  private readonly line: LineBasedStrategy
  readonly descriptor: ParserDescriptor

  constructor(priority = 98) {
    this.shim = new ShimStrategy('codex', priority)
    this.line = new LineBasedStrategy('codex', 45)
    this.descriptor = this.shim.descriptor
  }

  parseChunk(chunk: Buffer | string, context: ParseChunkContext): CliOutputEvent[] {
    return String(chunk).split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap(line => this.parseLine(line, context))
  }

  estimateProgress(events: readonly CliOutputEvent[], session: Parameters<IParser['estimateProgress']>[1]) {
    return this.shim.estimateProgress(events, session)
  }

  reset(): void {
    this.shim.reset()
    this.line.reset()
  }

  dispose(): void {
    this.shim.dispose()
    this.line.dispose()
  }

  private parseLine(line: string, context: ParseChunkContext): CliOutputEvent[] {
    const marker = parseCodexMarkerLine(line, context.observedAt)
    if (marker) {
      return [cliOutputEventSchema.parse({
        tool: 'codex',
        stream: context.stream,
        line,
        progress: progressFromMarker(marker.field, marker.value),
        confidence: 1,
        phase: phaseFromMarker(marker.field, marker.value),
        observedAt: context.observedAt,
        eventType: eventTypeFromMarker(marker.field),
        rawSource: 'shim',
        instanceId: context.session.instanceId,
        sessionId: context.session.sessionId,
        payload: { field: marker.field, value: marker.value, phase: marker.field === 'PHASE' ? marker.value : undefined }
      })]
    }

    if (line.startsWith(MARKER_PREFIX)) return this.line.parseChunk(line, context)
    if (line.startsWith('{')) return this.shim.parseChunk(line, context)
    return this.line.parseChunk(line, context)
  }
}
