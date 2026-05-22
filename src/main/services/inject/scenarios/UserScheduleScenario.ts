import { ScenarioBase } from './ScenarioBase'

export class UserScheduleScenario extends ScenarioBase {
  readonly scenario = 'user-schedule' as const
  protected readonly defaultMode = 'clipboard-paste' as const
  protected readonly defaultModeFallback = ['uia', 'sendinput'] as const
  protected readonly defaultConfirmedBy = 'user-explicit' as const
}
