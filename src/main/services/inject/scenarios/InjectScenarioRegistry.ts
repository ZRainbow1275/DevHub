import type { InjectScenario } from '@shared/schemas/inject'
import { CsvTaskDrivenScenario } from './CsvTaskDrivenScenario'
import { ErrorRecoveryScenario } from './ErrorRecoveryScenario'
import { ManualTemplateScenario } from './ManualTemplateScenario'
import { ScenarioBase, type InjectScenarioAction, type InjectScenarioBuildOptions } from './ScenarioBase'
import { TaskChainNextScenario } from './TaskChainNextScenario'
import { UserScheduleScenario } from './UserScheduleScenario'
import { WatchdogRestartResumeScenario } from './WatchdogRestartResumeScenario'

const SCENARIOS = [
  new CsvTaskDrivenScenario(),
  new WatchdogRestartResumeScenario(),
  new TaskChainNextScenario(),
  new ErrorRecoveryScenario(),
  new UserScheduleScenario(),
  new ManualTemplateScenario()
]

export class InjectScenarioRegistry {
  private readonly scenarios = new Map<InjectScenario, ScenarioBase>(
    SCENARIOS.map(scenario => [scenario.scenario, scenario])
  )

  list(): InjectScenario[] {
    return [...this.scenarios.keys()]
  }

  get(scenario: InjectScenario): ScenarioBase {
    const handler = this.scenarios.get(scenario)
    if (!handler) throw new Error(`E_VALIDATION:unsupported inject scenario ${scenario}`)
    return handler
  }

  buildAction(scenario: InjectScenario, options: InjectScenarioBuildOptions): InjectScenarioAction {
    return this.get(scenario).buildAction(options)
  }
}
