import type { InjectMode, InjectActionV2 } from '@shared/schemas/inject'

const CLI_ALIASES = ['codex', 'claude', 'gemini']
const GUI_ALIASES = ['cursor', 'vscode', 'copilot']

export class InjectModeSelector {
  select(action: InjectActionV2): { mode: InjectMode; fallback: InjectMode[] } {
    if (action.isMetaCommand) return { mode: 'pty', fallback: [] }
    if (action.modeFallback.length > 0) return { mode: action.mode, fallback: action.modeFallback }
    const alias = action.targetAlias.toLowerCase()
    if (CLI_ALIASES.some(tool => alias.includes(tool))) return { mode: action.mode === 'sendinput' ? 'pty' : action.mode, fallback: ['clipboard-paste', 'sendinput'] }
    if (GUI_ALIASES.some(tool => alias.includes(tool))) {
      if (action.mode === 'sendinput') return { mode: 'clipboard-paste', fallback: ['uia', 'sendinput'] }
      return { mode: action.mode, fallback: ['uia', 'sendinput'].filter(mode => mode !== action.mode) as InjectMode[] }
    }
    return { mode: action.mode, fallback: [] }
  }
}
