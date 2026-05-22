import { ScenarioBase } from './ScenarioBase'

export class TaskChainNextScenario extends ScenarioBase {
  readonly scenario = 'task-chain-next' as const
  protected readonly defaultMode = 'pty' as const
  protected readonly defaultModeFallback = ['clipboard-paste', 'sendinput'] as const
  protected readonly defaultConfirmedBy = 'auto-policy' as const
}
