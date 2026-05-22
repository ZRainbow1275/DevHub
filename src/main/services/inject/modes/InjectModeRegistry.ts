import type { InjectMode } from '@shared/schemas/inject'
import { ClipboardPasteMode } from './ClipboardPasteMode'
import type { IInjectMode, InjectModeExecutionContext, InjectModeExecutionResult } from './IInjectMode'
import { PtyMode } from './PtyMode'
import { SendInputMode } from './SendInputMode'
import { UiaMode } from './UiaMode'

const MODES: IInjectMode[] = [
  new SendInputMode(),
  new PtyMode(),
  new UiaMode(),
  new ClipboardPasteMode()
]

export class InjectModeRegistry {
  private readonly modes = new Map<InjectMode, IInjectMode>(
    MODES.map(mode => [mode.mode, mode])
  )

  list(): InjectMode[] {
    return [...this.modes.keys()]
  }

  get(mode: InjectMode): IInjectMode {
    const handler = this.modes.get(mode)
    if (!handler) throw new Error(`E_VALIDATION:unsupported inject mode ${mode}`)
    return handler
  }

  execute(mode: InjectMode, context: InjectModeExecutionContext): Promise<InjectModeExecutionResult> {
    return this.get(mode).execute(context)
  }
}
