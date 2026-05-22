import type { ParserDescriptor, ParserStrategy } from '@shared/schemas/r8-runtime'
import type { CliToolName, IParser, ParserSelection } from './IParser'
import { LineBasedStrategy } from './strategies/LineBasedStrategy'
import { NdjsonStrategy } from './strategies/NdjsonStrategy'
import { ShimStrategy } from './strategies/ShimStrategy'
import { SseStrategy } from './strategies/SseStrategy'
import { ClaudeParser, CodexParser, CopilotTitleParser, CursorTitleParser, GeminiParser } from './parsers'

export class ParserRegistry {
  private readonly parsers = new Map<string, IParser>()

  constructor() {
    for (const tool of ['codex', 'claude', 'gemini', 'cursor', 'copilot', 'unknown'] as const) {
      this.register(new LineBasedStrategy(tool, tool === 'unknown' ? 20 : 40))
      this.register(new NdjsonStrategy(tool, tool === 'claude' ? 95 : 70))
      this.register(new ShimStrategy(tool, tool === 'codex' ? 88 : 65))
      this.register(new SseStrategy(tool, 55))
    }
    this.register(new ClaudeParser())
    this.register(new CodexParser())
    this.register(new GeminiParser())
    this.register(new CursorTitleParser())
    this.register(new CopilotTitleParser())
  }

  register(parser: IParser): void {
    this.parsers.set(this.key(parser.descriptor.tool, parser.descriptor.strategy), parser)
  }

  get(selection: ParserSelection): IParser {
    if (selection.strategy) {
      const direct = this.parsers.get(this.key(selection.tool, selection.strategy))
      if (direct) return direct
    }
    return this.list(selection.tool).sort((left, right) => right.descriptor.priority - left.descriptor.priority)[0]
      ?? this.parsers.get(this.key('unknown', 'line'))
      ?? new LineBasedStrategy('unknown')
  }

  list(tool?: CliToolName): IParser[] {
    return Array.from(this.parsers.values()).filter(parser => parser.descriptor.enabled && (!tool || parser.descriptor.tool === tool))
  }

  descriptors(): ParserDescriptor[] {
    return this.list().map(parser => parser.descriptor)
  }

  private key(tool: CliToolName, strategy: ParserStrategy): string {
    return `${tool}:${strategy}`
  }
}
