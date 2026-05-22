import { ScenarioBase } from './ScenarioBase'

export class ManualTemplateScenario extends ScenarioBase {
  readonly scenario = 'manual-template' as const
  protected readonly defaultMode = 'sendinput' as const
  protected readonly defaultModeFallback = [] as const
  protected readonly defaultConfirmedBy = 'user-explicit' as const
}
