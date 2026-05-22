import type {
  CliOutputEvent,
  ParseSession,
  ParserDescriptor,
  ParserStrategy,
  ProgressDataPoint
} from '@shared/schemas/r8-runtime'

export type CliToolName = ParserDescriptor['tool']
export type CliStreamName = CliOutputEvent['stream']

export interface ParseChunkContext {
  session: ParseSession
  stream: CliStreamName
  observedAt: number
}

export interface IParser {
  readonly descriptor: ParserDescriptor
  parseChunk(chunk: Buffer | string, context: ParseChunkContext): CliOutputEvent[]
  estimateProgress(events: readonly CliOutputEvent[], session: ParseSession): ProgressDataPoint | null
  reset(): void
  dispose(): void
}

export interface ParserSelection {
  tool: CliToolName
  strategy?: ParserStrategy
}
