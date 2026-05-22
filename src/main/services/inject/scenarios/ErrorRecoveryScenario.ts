import { ScenarioBase } from './ScenarioBase'

export class ErrorRecoveryScenario extends ScenarioBase {
  readonly scenario = 'error-recovery' as const
  protected readonly defaultMode = 'clipboard-paste' as const
  protected readonly defaultModeFallback = ['uia', 'sendinput'] as const
  protected readonly defaultConfirmedBy = 'auto-policy' as const
}
