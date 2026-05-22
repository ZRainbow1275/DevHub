import type { InjectActionV2, InjectMode } from '@shared/schemas/inject'
import type { InjectChunk } from '../InjectChunker'

export type ShimControlTool = 'codex' | 'claude' | 'gemini'

export interface ShimControlBridge {
  send: (input: {
    tool: ShimControlTool
    text: string
    appendNewline?: boolean
    verifyEcho?: boolean
    echoText?: string
    echoTimeoutMs?: number
  }) => Promise<{
    success: boolean
    data?: {
      characters: number
      verifiedContentMatches?: boolean | null
      verificationError?: string | null
    }
    error?: string
  }>
}

export interface InjectModeExecutionContext {
  action: InjectActionV2
  chunks: InjectChunk[]
  target?: unknown
  typeSendInputChunks: (chunks: InjectChunk[]) => Promise<{ success: boolean; data?: { characters: number }; error?: string }>
  shimControlBridge?: ShimControlBridge
  clipboardBridge?: {
    readText: () => string
    writeText: (text: string) => void
    paste: () => Promise<{ success: boolean; error?: string }>
  }
}

export interface InjectModeExecutionResult {
  mode: InjectMode
  success: boolean
  data?: {
    characters: number
    verifiedContentMatches?: boolean | null
    verificationError?: string | null
  }
  error?: string
}

export interface IInjectMode {
  readonly mode: InjectMode
  execute(context: InjectModeExecutionContext): Promise<InjectModeExecutionResult>
}
