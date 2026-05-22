import type { IInjectMode, InjectModeExecutionContext, InjectModeExecutionResult } from './IInjectMode'

export class ClipboardPasteMode implements IInjectMode {
  readonly mode = 'clipboard-paste' as const

  async execute(context: InjectModeExecutionContext): Promise<InjectModeExecutionResult> {
    if (!context.clipboardBridge) {
      return {
        mode: this.mode,
        success: false,
        error: 'E_RUNTIME:clipboard-paste requires clipboard ownership integration'
      }
    }

    let originalText = ''
    try {
      originalText = context.clipboardBridge.readText()
      context.clipboardBridge.writeText(context.action.text)
      const pasted = await context.clipboardBridge.paste()
      try {
        context.clipboardBridge.writeText(originalText)
      } catch (restoreError) {
        return {
          mode: this.mode,
          success: false,
          error: `E_CLIPBOARD_RESTORE_FAILED:${restoreError instanceof Error ? restoreError.message : String(restoreError)}`
        }
      }
      if (!pasted.success) {
        return {
          mode: this.mode,
          success: false,
          error: pasted.error ?? 'E_CLIPBOARD_PASTE_FAILED:paste shortcut failed'
        }
      }
      return {
        mode: this.mode,
        success: true,
        data: { characters: context.action.text.length }
      }
    } catch (error) {
      try {
        context.clipboardBridge.writeText(originalText)
      } catch {
        return {
          mode: this.mode,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
      return {
        mode: this.mode,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
