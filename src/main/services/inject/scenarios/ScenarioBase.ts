import type { z } from 'zod'
import {
  injectActionSchemaV2,
  type InjectFailureKind,
  type InjectMode,
  type InjectResultV2,
  type InjectScenario,
  type InjectTarget
} from '@shared/schemas/inject'

export type InjectScenarioAction = z.output<typeof injectActionSchemaV2>

export interface InjectScenarioBuildOptions {
  text: string
  targetAlias?: string
  target?: InjectTarget
  mode?: InjectMode
  modeFallback?: InjectMode[]
  isMetaCommand?: boolean
  countdownMs?: number
  strictModeRequiresExplicitConfirm?: boolean
  confirmedBy?: InjectScenarioAction['confirmedBy']
  taskId?: string | null
  sessionId?: string | null
  recordingId?: string | null
}

export interface PreparedInjectScenario {
  scenario: InjectScenario
  text: string
  targetAlias: string
  preparedAt: number
}

export interface InjectScenarioHookContext {
  action: InjectScenarioAction
  preparedAt?: number
}

export interface InjectScenarioHookResult {
  scenario: InjectScenario
  actionId: string
  status: InjectResultV2['status']
  failureKind: InjectFailureKind | null
  handledAt: number
}

export abstract class ScenarioBase<TOptions extends InjectScenarioBuildOptions = InjectScenarioBuildOptions> {
  abstract readonly scenario: InjectScenario
  protected abstract readonly defaultMode: InjectMode
  protected readonly defaultModeFallback: readonly InjectMode[] = []
  protected readonly defaultConfirmedBy: InjectScenarioAction['confirmedBy'] = 'auto-policy'

  constructor(private readonly now: () => number = () => Date.now()) {}

  prepare(options: TOptions): PreparedInjectScenario {
    const text = this.resolveText(options)
    const targetAlias = this.resolveTargetAlias(options)
    return {
      scenario: this.scenario,
      text,
      targetAlias,
      preparedAt: this.now()
    }
  }

  buildAction(options: TOptions): InjectScenarioAction {
    const prepared = this.prepare(options)
    return injectActionSchemaV2.parse({
      scenario: this.scenario,
      target: options.target ?? { selector: 'alias', aliasOrId: prepared.targetAlias },
      targetAlias: prepared.targetAlias,
      text: prepared.text,
      mode: options.mode ?? this.defaultMode,
      modeFallback: [...(options.modeFallback ?? this.defaultModeFallback)],
      isMetaCommand: options.isMetaCommand ?? false,
      countdownMs: options.countdownMs ?? 3000,
      strictModeRequiresExplicitConfirm: options.strictModeRequiresExplicitConfirm ?? false,
      confirmedBy: options.confirmedBy ?? this.defaultConfirmedBy,
      taskId: options.taskId ?? null,
      sessionId: options.sessionId ?? null,
      recordingId: options.recordingId ?? null
    })
  }

  onSuccess(result: InjectResultV2, _context: InjectScenarioHookContext): InjectScenarioHookResult {
    return this.hookResult(result, null)
  }

  onFailure(result: InjectResultV2, _context: InjectScenarioHookContext): InjectScenarioHookResult {
    return this.hookResult(result, result.failureKind)
  }

  protected resolveText(options: TOptions): string {
    const text = options.text.trim()
    if (text.length === 0) throw new Error(`E_VALIDATION:${this.scenario} text is required`)
    return options.text
  }

  private resolveTargetAlias(options: TOptions): string {
    const targetAlias = options.target?.aliasOrId ?? options.targetAlias
    if (!targetAlias || targetAlias.trim().length === 0) throw new Error(`E_VALIDATION:${this.scenario} targetAlias is required`)
    return targetAlias
  }

  private hookResult(result: InjectResultV2, failureKind: InjectFailureKind | null): InjectScenarioHookResult {
    return {
      scenario: this.scenario,
      actionId: result.actionId,
      status: result.status,
      failureKind,
      handledAt: this.now()
    }
  }
}
