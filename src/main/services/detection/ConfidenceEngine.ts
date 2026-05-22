import type {
  AITask,
  ConfidenceReport,
  DetectionSignalName,
  SignalContribution,
  SignalResult,
  ToolProfile,
  CalibrationSample
} from '@shared/types-extended'

const SIGNAL_WEIGHT_KEYS: Record<DetectionSignalName, keyof ToolProfile['signalWeights']> = {
  cli_parse: 'cliParse',
  terminal_keywords: 'terminalKeywords',
  cpu_idle: 'cpuIdle',
  low_output_rate: 'lowOutputRate',
  prompt_detected: 'promptDetected',
  child_process_exit: 'childProcessExit',
  time_threshold: 'timeThreshold'
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function signalWeight(
  name: DetectionSignalName,
  weights: ToolProfile['signalWeights']
): number {
  return Math.max(0, Number(weights[SIGNAL_WEIGHT_KEYS[name]] ?? 0))
}

export function scoreSignals(
  signalResults: SignalResult[],
  weights: ToolProfile['signalWeights']
): { contributions: SignalContribution[]; totalScore: number } {
  const contributions = signalResults.map((result) => {
    const weight = signalWeight(result.name, weights)
    return {
      name: result.name,
      result,
      weight,
      weightedContribution: clamp01(result.normalized) * clamp01(result.confidence) * weight
    }
  })

  const totalScore = clamp01(
    contributions.reduce((sum, contribution) => sum + contribution.weightedContribution, 0)
  )

  return { contributions, totalScore }
}

export function activeSignalNames(contributions: SignalContribution[]): DetectionSignalName[] {
  return contributions
    .filter((contribution) => contribution.result.normalized > 0 && contribution.weightedContribution > 0)
    .map((contribution) => contribution.name)
}

export function buildConfidenceNarrative(contributions: SignalContribution[], score: number): string {
  const active = contributions.filter((contribution) => contribution.weightedContribution > 0)
  if (active.length === 0) return `no active completion indicators => ${Math.round(score * 100)}%`

  return `${active
    .map((contribution) => `${contribution.name} ${Math.round(contribution.result.normalized * 100)}% x ${contribution.weight.toFixed(2)}`)
    .join(' + ')} => ${Math.round(score * 100)}%`
}

export function buildConfidenceReport(input: {
  task: AITask
  taskKey: string
  threshold: number
  phaseConfidence: number
  inConfirmationWindow: boolean
  confirmationRemainingMs?: number
  signalContributions: SignalContribution[]
  completionScore: number
  updatedAt?: number
}): ConfidenceReport {
  const activeIndicators = activeSignalNames(input.signalContributions)
  return {
    taskKey: input.taskKey,
    taskId: input.task.id,
    toolType: input.task.toolType,
    state: input.task.status.state,
    monitorState: input.task.monitorState,
    completionScore: input.completionScore,
    threshold: input.threshold,
    phaseConfidence: input.phaseConfidence,
    activeIndicators,
    signalContributions: input.signalContributions,
    inConfirmationWindow: input.inConfirmationWindow,
    confirmationRemainingMs: input.confirmationRemainingMs,
    updatedAt: input.updatedAt ?? Date.now(),
    narrative: buildConfidenceNarrative(input.signalContributions, input.completionScore)
  }
}

export function rebalanceWeightsFromCalibration(
  current: ToolProfile['signalWeights'],
  samples: CalibrationSample[]
): ToolProfile['signalWeights'] {
  if (samples.length < 10) return current

  const signalNames = Object.keys(SIGNAL_WEIGHT_KEYS) as DetectionSignalName[]
  const rawScores = new Map<DetectionSignalName, number>()

  for (const name of signalNames) {
    let positiveSum = 0
    let positiveCount = 0
    let negativeSum = 0
    let negativeCount = 0

    for (const sample of samples) {
      const signalValue = clamp01(Number(sample.signals[name] ?? 0))
      if (sample.expected === 'completed') {
        positiveSum += signalValue
        positiveCount++
      } else {
        negativeSum += signalValue
        negativeCount++
      }
    }

    const positiveMean = positiveCount > 0 ? positiveSum / positiveCount : 0
    const negativeMean = negativeCount > 0 ? negativeSum / negativeCount : 0
    const separation = Math.max(positiveMean - negativeMean, 0)
    rawScores.set(name, Math.max(separation, 0.01))
  }

  const total = Array.from(rawScores.values()).reduce((sum, value) => sum + value, 0)
  if (total <= 0) return current

  const next: ToolProfile['signalWeights'] = { ...current }
  for (const name of signalNames) {
    const key = SIGNAL_WEIGHT_KEYS[name]
    const learned = (rawScores.get(name) ?? 0) / total
    const bounded = Math.max(0.03, Math.min(0.45, learned))
    const currentWeight = Number(current[key] ?? 0)
    next[key] = Number((currentWeight * 0.65 + bounded * 0.35).toFixed(4))
  }

  return next
}
