import { ScenarioBase, type InjectScenarioBuildOptions } from './ScenarioBase'

export class WatchdogRestartResumeScenario extends ScenarioBase {
  readonly scenario = 'watchdog-restart-resume' as const
  protected readonly defaultMode = 'pty' as const
  protected readonly defaultModeFallback = ['uia', 'sendinput'] as const
  protected readonly defaultConfirmedBy = 'auto-policy' as const

  protected override resolveText(options: InjectScenarioBuildOptions): string {
    const text = super.resolveText(options)
    if (text.includes('[continue]')) return text
    return `${text}\n\n[continue]`
  }
}
