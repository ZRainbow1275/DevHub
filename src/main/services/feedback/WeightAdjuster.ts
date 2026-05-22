import { weightAdjustmentSchema, type MisreportKind, type WeightAdjustment } from '@shared/schemas/misreport'
import { SIGNAL_SOURCES, type SignalContributionSnapshot, type SignalSource, type WeightProfile } from '@shared/schemas/signal-fusion'
import type { TaskState } from '@shared/schemas/state-machine'
import { createWeightProfile } from '../detection/WeightProfile'

const SINGLE_DELTA_LIMIT = 0.05
const CUMULATIVE_DELTA_LIMIT = 0.2

type DeltaMap = Partial<Record<SignalSource, number>>

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function topSource(snapshot: SignalContributionSnapshot): SignalSource {
  const [source] = Object.entries(snapshot.contributions).sort((left, right) => right[1].contributionPct - left[1].contributionPct)[0] ?? ['cli_parse']
  return source as SignalSource
}

function deltaPlan(kind: MisreportKind, expectedTaskState: TaskState | undefined, snapshot: SignalContributionSnapshot): DeltaMap {
  if (kind === 'correct-detection') return { user_feedback: 0.01 }
  if (kind === 'false-idle' && (expectedTaskState === 'thinking' || expectedTaskState === 'running' || expectedTaskState === 'awaiting-input')) {
    return { cli_parse: 0.03, task_queue: 0.01, window_title: -0.02, process_cpu_io: -0.01 }
  }
  if (kind === 'false-thinking' && (!expectedTaskState || expectedTaskState === 'idle')) {
    return { cli_parse: -0.03, window_title: 0.02, process_cpu_io: 0.01 }
  }
  if (kind === 'false-progress') {
    const source = topSource(snapshot)
    return source === 'user_feedback' ? { user_feedback: 0.03, cli_parse: -0.02 } : { user_feedback: 0.03, [source]: -0.03 }
  }
  if (kind === 'false-completion') return { cli_parse: 0.02, task_queue: 0.02, window_title: -0.02 }
  if (kind === 'false-error') return { watchdog: -0.03, user_feedback: 0.02, cli_parse: 0.01 }
  return { user_feedback: 0.02 }
}

export class WeightAdjuster {
  apply(input: {
    misreportId: string
    kind: MisreportKind
    expectedTaskState?: TaskState
    snapshot: SignalContributionSnapshot
    currentProfile: WeightProfile
    cumulativeDeltas?: Partial<Record<SignalSource, number>>
    now?: number
  }): { profile: WeightProfile; adjustments: WeightAdjustment[] } {
    const now = input.now ?? Date.now()
    const planned = deltaPlan(input.kind, input.expectedTaskState, input.snapshot)
    const proposed = { ...input.currentProfile.weights }
    const adjustments: WeightAdjustment[] = []

    for (const source of SIGNAL_SOURCES) {
      const plannedDelta = planned[source] ?? 0
      if (plannedDelta === 0) continue
      const cumulative = input.cumulativeDeltas?.[source] ?? 0
      const remaining = plannedDelta > 0
        ? Math.max(0, CUMULATIVE_DELTA_LIMIT - cumulative)
        : Math.min(0, -CUMULATIVE_DELTA_LIMIT - cumulative)
      const boundedDelta = plannedDelta > 0
        ? Math.min(SINGLE_DELTA_LIMIT, plannedDelta, remaining)
        : Math.max(-SINGLE_DELTA_LIMIT, plannedDelta, remaining)
      if (boundedDelta === 0) continue
      const oldWeight = proposed[source]
      const newWeight = clamp(oldWeight + boundedDelta, 0, 1)
      const actualDelta = newWeight - oldWeight
      if (actualDelta === 0) continue
      proposed[source] = newWeight
      adjustments.push(weightAdjustmentSchema.parse({
        source,
        oldWeight,
        newWeight,
        delta: actualDelta,
        triggeredByMisreportId: input.misreportId,
        appliedAt: now
      }))
    }

    return { profile: createWeightProfile('user-custom', proposed, now), adjustments }
  }
}
