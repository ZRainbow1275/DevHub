import { diagnosticExplainSchema, type DiagnosticExplain } from '@shared/schemas/misreport'
import type { SignalContributionSnapshot } from '@shared/schemas/signal-fusion'
import type { InstanceState } from '@shared/schemas/state-machine'

const SOURCE_LABELS: Record<string, string> = {
  cli_parse: 'CLI parser signal',
  window_title: 'Window title signal',
  process_cpu_io: 'Process CPU and IO signal',
  task_queue: 'Task queue signal',
  watchdog: 'Watchdog signal',
  user_feedback: 'Local user feedback signal'
}

export class DiagnosticExplainService {
  explain(input: { state: InstanceState; snapshot: SignalContributionSnapshot }): DiagnosticExplain {
    const topReasons = Object.entries(input.snapshot.contributions)
      .sort((left, right) => right[1].contributionPct - left[1].contributionPct)
      .slice(0, 5)
      .map(([source, contribution]) => ({
        sourceCitation: source,
        contributionPct: contribution.contributionPct,
        reasonText: `${SOURCE_LABELS[source] ?? source} contributed ${(contribution.contributionPct * 100).toFixed(1)}% with confidence ${(contribution.decayedConfidence * 100).toFixed(1)}%.`
      }))
    const suggestedAction = input.state.assertionViolations.some(violation => violation.resolvedAt === null)
      ? 'report-misreport'
      : input.snapshot.sampleCount === 0
        ? 'toggle-shim'
        : input.state.task === 'idle'
          ? 'wait'
          : 'adjust-weights'

    return diagnosticExplainSchema.parse({
      instanceId: input.state.instanceId,
      currentTaskState: input.state.task,
      topReasons,
      recentTransitions: input.state.lastTransitions.slice(0, 10),
      suggestedAction
    })
  }
}
