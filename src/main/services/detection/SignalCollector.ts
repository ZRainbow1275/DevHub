import type {
  AITask,
  AIToolDetectionConfig,
  SignalContribution,
  SignalResult,
  ToolProfile
} from '@shared/types-extended'
import { activeSignalNames, clamp01, scoreSignals } from './ConfidenceEngine'

export interface DetectionWeightConfig {
  outputPatternWeight: number
  cpuIdleWeight: number
  cursorWaitWeight: number
  timeThresholdWeight: number
  promptDetectionWeight: number
  childProcessWeight: number
  idleThresholdMs: number
  completionThreshold: number
  confirmationWindowMs: number
}

export interface SignalCollectionInput {
  task: AITask
  processCpu: number
  isComplete: boolean
  hasPrompt: boolean
  childProcessExited: boolean
  now: number
  config: DetectionWeightConfig
  toolConfig?: AIToolDetectionConfig
  cliParse?: {
    progress: number
    confidence: number
    observedAt: number
    line: string
    phase: string
    eventType?: string
    rawSource?: string
    weight?: number
  }
}

export interface CollectedDetectionSignals {
  completionScore: number
  activeIndicators: string[]
  signalResults: SignalResult[]
  signalContributions: SignalContribution[]
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function signal(input: SignalResult): SignalResult {
  return {
    ...input,
    normalized: clamp01(input.normalized),
    confidence: clamp01(input.confidence)
  }
}

function weightsFromConfig(config: DetectionWeightConfig, cliParseWeight = 0): ToolProfile['signalWeights'] {
  return {
    cliParse: cliParseWeight,
    terminalKeywords: config.outputPatternWeight,
    cpuIdle: config.cpuIdleWeight,
    lowOutputRate: config.cursorWaitWeight,
    promptDetected: config.promptDetectionWeight,
    childProcessExit: config.childProcessWeight,
    timeThreshold: config.timeThresholdWeight
  }
}

export function collectDetectionSignals(input: SignalCollectionInput): CollectedDetectionSignals {
  const { task, processCpu, isComplete, hasPrompt, childProcessExited, now, config, toolConfig, cliParse } = input
  const recentCpu = task.metrics.cpuHistory.slice(-5)
  const recentAvg = average(recentCpu)
  const cpuThreshold = toolConfig?.cpuBaselineThreshold ?? 3
  const outputRate = task.metrics.outputRate ?? 0
  const idleDuration = task.metrics.idleDuration
  const enoughCpuSamples = recentCpu.length >= 3

  const signalResults: SignalResult[] = []

  if (cliParse) {
    const normalizedProgress = cliParse.phase === 'completed' || cliParse.eventType === 'completion'
      ? 1
      : cliParse.progress
    signalResults.push(signal({
      name: 'cli_parse',
      kind: 'event',
      raw: cliParse.rawSource ?? cliParse.eventType ?? cliParse.phase,
      normalized: normalizedProgress,
      confidence: cliParse.confidence,
      triggeredAt: cliParse.observedAt,
      reason: `CLI parser ${cliParse.phase} ${Math.round(normalizedProgress * 100)}% from ${cliParse.rawSource ?? 'unknown'}: ${cliParse.line}`
    }))
  }

  signalResults.push(
    signal({
      name: 'terminal_keywords',
      kind: 'textual',
      raw: isComplete,
      normalized: isComplete ? 1 : 0,
      confidence: isComplete ? 1 : 0.8,
      triggeredAt: isComplete ? now : undefined,
      reason: isComplete ? 'completion keyword matched current window title' : 'no completion keyword matched'
    }),
    signal({
      name: 'cpu_idle',
      kind: 'numeric',
      raw: recentAvg,
      normalized: enoughCpuSamples && recentAvg < cpuThreshold && processCpu < cpuThreshold ? 1 : 0,
      confidence: enoughCpuSamples ? 1 : 0.4,
      triggeredAt: enoughCpuSamples && recentAvg < cpuThreshold && processCpu < cpuThreshold ? now : undefined,
      reason: `recent avg ${recentAvg.toFixed(2)}%, current ${processCpu.toFixed(2)}%, threshold ${cpuThreshold}%`
    }),
    signal({
      name: 'low_output_rate',
      kind: 'numeric',
      raw: outputRate,
      normalized: outputRate < 100 && idleDuration > config.idleThresholdMs ? 1 : 0,
      confidence: idleDuration > config.idleThresholdMs ? 1 : 0.5,
      triggeredAt: outputRate < 100 && idleDuration > config.idleThresholdMs ? now : undefined,
      reason: `output ${outputRate.toFixed(2)} Bps, idle ${idleDuration}ms`
    }),
    signal({
      name: 'prompt_detected',
      kind: 'textual',
      raw: hasPrompt,
      normalized: hasPrompt ? 1 : 0,
      confidence: hasPrompt ? 1 : 0.8,
      triggeredAt: hasPrompt ? now : undefined,
      reason: hasPrompt ? 'prompt pattern matched current window title' : 'no prompt pattern matched'
    }),
    signal({
      name: 'child_process_exit',
      kind: 'event',
      raw: childProcessExited,
      normalized: childProcessExited ? 1 : 0,
      confidence: childProcessExited ? 1 : 0.7,
      triggeredAt: childProcessExited ? now : undefined,
      reason: childProcessExited ? 'observed child process exit evidence' : 'no recent child process exit evidence'
    })
  )

  const scored = scoreSignals(signalResults, weightsFromConfig(config, cliParse ? cliParse.weight ?? 0.8 : 0))

  return {
    completionScore: scored.totalScore,
    activeIndicators: activeSignalNames(scored.contributions),
    signalResults,
    signalContributions: scored.contributions
  }
}
