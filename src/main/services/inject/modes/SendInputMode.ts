import type { IInjectMode, InjectModeExecutionContext, InjectModeExecutionResult } from './IInjectMode'

export class SendInputMode implements IInjectMode {
  readonly mode = 'sendinput' as const

  async execute(context: InjectModeExecutionContext): Promise<InjectModeExecutionResult> {
    const result = await context.typeSendInputChunks(context.chunks)
    return {
      mode: this.mode,
      ...result
    }
  }
}
