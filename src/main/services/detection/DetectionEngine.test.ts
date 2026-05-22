import { describe, expect, it } from 'vitest'
import { AI_MONITOR_STATE_INFO, type AITask, type CalibrationSample, type ToolProfile } from '@shared/types-extended'
import { collectDetectionSignals } from './SignalCollector'
import { rebalanceWeightsFromCalibration } from './ConfidenceEngine'
import { deriveMonitorState, deriveTaskState, shouldCancelConfirmation, stabilizeStateTransition } from './CompletionStateMachine'
import { makeTaskKey, withCollisionSuffix } from './TaskKey'

const baseWeights: ToolProfile['signalWeights'] = {
  terminalKeywords: 0.2,
  cpuIdle: 0.25,
  lowOutputRate: 0.2,
  promptDetected: 0.25,
  childProcessExit: 0.1,
  timeThreshold: 0.1
}

function makeTask(partial: Partial<AITask> = {}): AITask {
  const now = Date.now()
  return {
    id: 'task-1',
    toolType: 'claude-code',
    pid: 1234,
    startTime: now - 10000,
    status: { state: 'running', lastActivity: now - 8000 },
    monitorState: 'thinking',
    metrics: {
      cpuHistory: [0.5, 0.4, 0.3, 0.2, 0.2],
      outputLineCount: 0,
      lastOutputTime: now - 8000,
      idleDuration: 8000,
      outputRate: 0
    },
    ...partial
  }
}

describe('P4.2-b detection modules', () => {
  it('scores real collected signals without adding synthetic indicators', () => {
    const collected = collectDetectionSignals({
      task: makeTask(),
      processCpu: 0.2,
      isComplete: true,
      hasPrompt: true,
      childProcessExited: true,
      now: Date.now(),
      config: {
        outputPatternWeight: 0.2,
        cpuIdleWeight: 0.25,
        cursorWaitWeight: 0.2,
        promptDetectionWeight: 0.25,
        childProcessWeight: 0.1,
        timeThresholdWeight: 0.1,
        idleThresholdMs: 5000,
        completionThreshold: 0.8,
        confirmationWindowMs: 8000
      },
      toolConfig: {
        toolType: 'claude-code',
        completionKeywords: ['Done'],
        errorKeywords: ['Error'],
        promptPatterns: ['^>$'],
        cpuBaselineThreshold: 1,
        confirmationWindowMs: 8000
      }
    })

    expect(collected.completionScore).toBe(1)
    expect(collected.activeIndicators).toEqual([
      'terminal_keywords',
      'cpu_idle',
      'low_output_rate',
      'prompt_detected',
      'child_process_exit'
    ])
    expect(collected.signalContributions).toHaveLength(5)
  })

  it('keeps completion candidates in validating until confirmation logic finalizes', () => {
    const task = makeTask()

    expect(deriveMonitorState({
      task,
      isComplete: true,
      hasPrompt: false,
      isError: false,
      isCompilingAction: false
    })).toBe('validating')

    expect(deriveTaskState({
      task,
      completionScore: 0.85,
      isCompilingAction: false,
      config: { completionThreshold: 0.8, idleThresholdMs: 5000 }
    })).toEqual({ state: 'running', markActivity: false })
  })

  it('classifies the expanded AI monitor taxonomy without collapsing user-wait and stuck states', () => {
    expect(Object.keys(AI_MONITOR_STATE_INFO)).toHaveLength(12)
    const now = Date.now()

    expect(deriveMonitorState({
      task: makeTask({ startTime: now - 2000, status: { state: 'running', lastActivity: now } }),
      isComplete: false,
      hasPrompt: false,
      isError: false,
      isCompilingAction: false
    })).toBe('initializing')

    expect(deriveMonitorState({
      task: makeTask({
        startTime: now - 60000,
        status: { state: 'running', lastActivity: now - 5000, currentAction: 'receiving input from stdin' }
      }),
      isComplete: false,
      hasPrompt: true,
      isError: false,
      isCompilingAction: false
    })).toBe('receiving-input')

    expect(deriveMonitorState({
      task: makeTask({
        startTime: now - 60000,
        status: { state: 'running', lastActivity: now - 5000, currentAction: 'waiting for user approval' }
      }),
      isComplete: false,
      hasPrompt: true,
      isError: false,
      isCompilingAction: false
    })).toBe('awaiting-human')

    expect(deriveMonitorState({
      task: makeTask({
        startTime: now - 900000,
        status: { state: 'running', lastActivity: now - 900000 },
        metrics: {
          cpuHistory: [0, 0, 0, 0, 0],
          outputLineCount: 0,
          lastOutputTime: now - 900000,
          idleDuration: 900000,
          outputRate: 0
        }
      }),
      isComplete: false,
      hasPrompt: false,
      isError: false,
      isCompilingAction: false
    })).toBe('stuck')
  })

  it('requires both stdout silence and sub-1 percent CPU before declaring stuck', () => {
    const now = Date.now()
    const activeCpuLongIdle = makeTask({
      startTime: now - 900000,
      status: { state: 'running', lastActivity: now - 900000 },
      metrics: {
        cpuHistory: [3, 3, 3, 3, 3],
        outputLineCount: 0,
        lastOutputTime: now - 900000,
        idleDuration: 900000,
        outputRate: 0
      }
    })

    expect(deriveMonitorState({
      task: activeCpuLongIdle,
      isComplete: false,
      hasPrompt: false,
      isError: false,
      isCompilingAction: false
    })).not.toBe('stuck')
  })

  it('cancels confirmation when real activity resumes', () => {
    expect(shouldCancelConfirmation({
      recentAverageCpu: 9,
      cpuThreshold: 3,
      outputRate: 0,
      monitorState: 'thinking'
    })).toBe(true)
    expect(shouldCancelConfirmation({
      recentAverageCpu: 0.5,
      cpuThreshold: 3,
      outputRate: 650,
      monitorState: 'thinking'
    })).toBe(true)
    expect(shouldCancelConfirmation({
      recentAverageCpu: 0.5,
      cpuThreshold: 3,
      outputRate: 0,
      monitorState: 'receiving-input'
    })).toBe(true)
  })

  it('debounces single-sample state flips but accepts repeated or terminal evidence', () => {
    const immediateStates = new Set(['completed', 'error'])
    const first = stabilizeStateTransition({
      previousState: 'thinking',
      candidateState: 'coding',
      now: 1000,
      windowMs: 750,
      minObservations: 2,
      immediateStates
    })
    expect(first).toMatchObject({ state: 'thinking', accepted: false })

    const second = stabilizeStateTransition({
      previousState: 'thinking',
      candidateState: 'coding',
      now: 1100,
      pending: first.pending ?? undefined,
      windowMs: 750,
      minObservations: 2,
      immediateStates
    })
    expect(second).toMatchObject({ state: 'coding', accepted: true, pending: null })

    const terminal = stabilizeStateTransition({
      previousState: 'coding',
      candidateState: 'error',
      now: 1110,
      windowMs: 750,
      minObservations: 2,
      immediateStates
    })
    expect(terminal).toMatchObject({ state: 'error', accepted: true, pending: null })
  })

  it('learns calibrated weights only after the minimum real sample count', () => {
    const samples: CalibrationSample[] = Array.from({ length: 10 }, (_, index) => ({
      taskKey: `sample-${index}`,
      toolType: 'claude-code',
      capturedAt: Date.now() + index,
      expected: index < 6 ? 'completed' : 'running',
      observed: index < 6 ? 'completed' : 'running',
      signals: index < 6
        ? { terminal_keywords: 1, prompt_detected: 1, cpu_idle: 1, low_output_rate: 1 }
        : { terminal_keywords: 0, prompt_detected: 0, cpu_idle: 1, low_output_rate: 1 },
      source: 'bench'
    }))

    const insufficient = rebalanceWeightsFromCalibration(baseWeights, samples.slice(0, 9))
    const learned = rebalanceWeightsFromCalibration(baseWeights, samples)

    expect(insufficient).toEqual(baseWeights)
    expect(learned.terminalKeywords).toBeGreaterThan(baseWeights.terminalKeywords)
    expect(learned.promptDetected).toBeGreaterThan(baseWeights.promptDetected)
  })

  it('builds deterministic task keys and resolves collisions without deleting legacy tasks', () => {
    const aliasKey = makeTaskKey({ aliasId: 'alias-a', toolType: 'claude-code', pid: 111, workingDir: 'D:/repo' })
    const fpKey = makeTaskKey({ toolType: 'claude-code', pid: 111, workingDir: 'D:/repo' })

    expect(aliasKey).toBe('alias:alias-a')
    expect(fpKey).toMatch(/^fp:[a-f0-9]{16}$/)
    expect(withCollisionSuffix(aliasKey, new Set([aliasKey, `${aliasKey}:2`]))).toBe(`${aliasKey}:3`)
  })
})
