import { ScenarioBase } from './ScenarioBase'

export class CsvTaskDrivenScenario extends ScenarioBase {
  readonly scenario = 'csv-task-driven' as const
  protected readonly defaultMode = 'pty' as const
  protected readonly defaultModeFallback = ['clipboard-paste', 'sendinput'] as const
  protected readonly defaultConfirmedBy = 'csv-mode' as const
}
