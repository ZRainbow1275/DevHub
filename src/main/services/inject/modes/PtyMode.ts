import type { IInjectMode, InjectModeExecutionContext, InjectModeExecutionResult } from './IInjectMode'

const SHIM_TOOLS = ['codex', 'claude', 'gemini'] as const

export class PtyMode implements IInjectMode {
  readonly mode = 'pty' as const

  async execute(context: InjectModeExecutionContext): Promise<InjectModeExecutionResult> {
    const bridge = context.shimControlBridge
    if (!bridge) {
      return {
        mode: this.mode,
        success: false,
        error: context.action.isMetaCommand
          ? 'E_SHIM_NOT_CONNECTED:pty meta-command requires an active SHIM control channel'
          : 'E_SHIM_NOT_INSTALLED:pty inject requires an installed SHIM channel'
      }
    }

    const tool = this.resolveTool(context)
    if (!tool) {
      return {
        mode: this.mode,
        success: false,
        error: context.action.isMetaCommand
          ? 'E_SHIM_NOT_CONNECTED:unable to resolve SHIM tool for pty meta-command'
          : 'E_SHIM_NOT_INSTALLED:unable to resolve SHIM tool for pty inject'
      }
    }

    const verifyEcho = !context.action.isMetaCommand
    const sent = await bridge.send({
      tool,
      text: context.action.text,
      appendNewline: true,
      verifyEcho,
      echoText: context.action.text
    })
    if (!sent.success) {
      return {
        mode: this.mode,
        success: false,
        error: sent.error ?? (context.action.isMetaCommand
          ? 'E_SHIM_NOT_CONNECTED:SHIM control channel rejected meta-command'
          : 'E_SHIM_NOT_INSTALLED:SHIM control channel rejected pty inject')
      }
    }

    return {
      mode: this.mode,
      success: true,
      data: {
        characters: sent.data?.characters ?? context.action.text.length,
        verifiedContentMatches: sent.data?.verifiedContentMatches ?? (verifyEcho ? false : null),
        verificationError: sent.data?.verificationError ?? null
      }
    }
  }

  private resolveTool(context: InjectModeExecutionContext): typeof SHIM_TOOLS[number] | null {
    const targetTool = this.readTool(context.target)
    if (targetTool) return targetTool
    const actionTool = this.readTool(context.action.target)
    if (actionTool) return actionTool
    const alias = context.action.targetAlias.toLowerCase()
    return SHIM_TOOLS.find(tool => alias.includes(tool)) ?? null
  }

  private readTool(value: unknown): typeof SHIM_TOOLS[number] | null {
    if (typeof value !== 'object' || value === null) return null
    const record = value as Record<string, unknown>
    const candidate = String(record.resolvedTool ?? record.tool ?? record.toolName ?? '').toLowerCase()
    return SHIM_TOOLS.find(tool => tool === candidate) ?? null
  }
}
