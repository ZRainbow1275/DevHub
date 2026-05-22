import { NdjsonStrategy } from './NdjsonStrategy'
import type { IParser, ParseChunkContext } from '../IParser'
import type { CliOutputEvent, ParseSession, ParserDescriptor, ProgressDataPoint } from '@shared/schemas/r8-runtime'

export class SseStrategy implements IParser {
  private readonly ndjson: NdjsonStrategy
  readonly descriptor: ParserDescriptor

  constructor(tool: ParserDescriptor['tool'] = 'unknown', priority = 60) {
    this.ndjson = new NdjsonStrategy(tool, priority, 'ndjson')
    this.descriptor = { ...this.ndjson.descriptor, strategy: 'sse' }
  }

  parseChunk(chunk: Buffer | string, context: ParseChunkContext): CliOutputEvent[] {
    const payload = String(chunk).split(/\r?\n/).map(line => line.trim()).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).filter(line => line.length > 0 && line !== '[DONE]').join('\n')
    if (!payload) return []
    return this.ndjson.parseChunk(payload, context).map(event => ({ ...event, rawSource: 'sse' }))
  }

  estimateProgress(events: readonly CliOutputEvent[], session: ParseSession): ProgressDataPoint | null {
    return this.ndjson.estimateProgress(events, session)
  }

  reset(): void { this.ndjson.reset() }
  dispose(): void { this.ndjson.dispose() }
}
