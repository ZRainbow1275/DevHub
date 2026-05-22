/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AITaskTracker } from './AITaskTracker'
import { SystemProcessScanner } from './SystemProcessScanner'
import { AITask, AICompletionOracleEvent } from '@shared/types-extended'
import { CLIOutputParser } from './cli-parser'

describe('AITaskTracker', () => {
  let tracker: AITaskTracker
  let mockProcessScanner: SystemProcessScanner

  beforeEach(() => {
    vi.clearAllMocks()
    mockProcessScanner = {
      getAll: vi.fn().mockResolvedValue([])
    } as unknown as SystemProcessScanner
    tracker = new AITaskTracker(mockProcessScanner)
  })

  afterEach(() => {
    tracker.stopTracking()
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with empty tasks and history', () => {
      expect(tracker.getActiveTasks()).toEqual([])
      expect(tracker.getHistory()).toEqual([])
    })
  })

  describe('setConfig', () => {
    it('should update configuration partially', () => {
      tracker.setConfig({ idleThresholdMs: 10000 })

      const config = (tracker as any).config
      expect(config.idleThresholdMs).toBe(10000)
      expect(config.completionThreshold).toBe(0.80)
    })

    it('should update multiple config values', () => {
      tracker.setConfig({
        completionThreshold: 0.8,
        cpuIdleWeight: 0.3
      })

      const config = (tracker as any).config
      expect(config.completionThreshold).toBe(0.8)
      expect(config.cpuIdleWeight).toBe(0.3)
    })
  })

  describe('startTracking / stopTracking', () => {
    it('should start and stop tracking', () => {
      expect((tracker as any).refreshTimer).toBeNull()

      tracker.startTracking()
      expect((tracker as any).refreshTimer).not.toBeNull()

      tracker.stopTracking()
      expect((tracker as any).refreshTimer).toBeNull()
    })

    it('should not create multiple timers on repeated starts', () => {
      tracker.startTracking()
      const firstTimer = (tracker as any).refreshTimer

      tracker.startTracking()
      const secondTimer = (tracker as any).refreshTimer

      expect(firstTimer).toBe(secondTimer)
    })
  })

  describe('scanForAITasks', () => {
    it('should ignore non-AI tool processes', async () => {
      const mockProcesses = [{
        pid: 5678,
        name: 'notepad.exe',
        command: 'notepad.exe file.txt',
        cpu: 1,
        memory: 50,
        startTime: Date.now()
      }]

      ;(mockProcessScanner.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockProcesses)

      const newTasks = await tracker.scanForAITasks()

      expect(newTasks.length).toBe(0)
      expect(mockProcessScanner.getAll).toHaveBeenCalledWith({ refresh: true })
    })

    it('should return empty array when no processes', async () => {
      ;(mockProcessScanner.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([])

      const newTasks = await tracker.scanForAITasks()

      expect(newTasks).toEqual([])
    })
  })

  describe('detectAIToolType', () => {
    it('should detect claude-code tool with matching patterns', () => {
      // The pattern requires /claude\s+/ in command
      const toolType = (tracker as any).detectAIToolType('node.exe', 'claude run')
      expect(toolType).toBe('claude-code')
    })

    it('should detect codex tool with matching patterns', () => {
      const toolType = (tracker as any).detectAIToolType('node.exe', 'codex run')
      expect(toolType).toBe('codex')
    })

    it('should detect gemini-cli tool with matching patterns', () => {
      const toolType = (tracker as any).detectAIToolType('node.exe', 'gemini run')
      expect(toolType).toBe('gemini-cli')
    })

    it('should return other for unknown processes', () => {
      const toolType = (tracker as any).detectAIToolType('random.exe', 'random command')
      expect(toolType).toBe('other')
    })

    it('should return other when process matches but command does not', () => {
      const toolType = (tracker as any).detectAIToolType('node.exe', 'npm start')
      expect(toolType).toBe('other')
    })
  })

  describe('getActiveTasks', () => {
    it('should return empty array initially', () => {
      expect(tracker.getActiveTasks()).toEqual([])
    })
  })

  describe('CLI parser subscription', () => {
    it('feeds real parser progress into SignalCollector without replacing legacy signals', () => {
      const parser = new CLIOutputParser()
      const now = Date.now()
      const task: AITask = {
        id: 'codex-cli-real',
        toolType: 'codex',
        pid: 4321,
        startTime: now - 10_000,
        status: { state: 'running', lastActivity: now - 5_000 },
        monitorState: 'thinking',
        metrics: {
          cpuHistory: [3, 2, 1],
          outputLineCount: 0,
          lastOutputTime: now - 5_000,
          idleDuration: 5_000,
          outputRate: 0
        }
      }
      ;(tracker as any).tasks.set(task.id, task)

      tracker.subscribeToCliOutputParser(parser)
      parser.parseChunk({
        tool: 'codex',
        stream: 'stdout',
        instanceId: task.id,
        strategy: 'line',
        chunk: 'Step 3/4 running typecheck',
        observedAt: now
      })

      const updated = tracker.getTaskById(task.id)
      expect(updated?.detectionSignals?.activeIndicators).toContain('cli_parse')
      expect(updated?.detectionSignals?.signalContributions?.map(signal => signal.name)).toContain('terminal_keywords')
      expect(updated?.status.progressEstimate).toMatchObject({
        percentage: 75,
        phase: 'validating',
        confidence: 0.82
      })
      expect(tracker.getProgress(task.id)?.percentage).toBeGreaterThanOrEqual(75)
    })

    it('allows real retry progress events to reset an active task to zero percent', () => {
      const now = Date.now()
      const task: AITask = {
        id: 'codex-retry-reset',
        toolType: 'codex',
        pid: 9876,
        startTime: now - 20_000,
        status: {
          state: 'running',
          lastActivity: now - 1_000,
          progressEstimate: {
            percentage: 82,
            phase: 'coding',
            phaseLabel: '编码中...',
            elapsed: 19_000,
            confidence: 0.8
          }
        },
        monitorState: 'coding',
        metrics: {
          cpuHistory: [8, 6, 4],
          outputLineCount: 18,
          lastOutputTime: now - 1_000,
          idleDuration: 1_000,
          outputRate: 1.5
        }
      }
      ;(tracker as any).tasks.set(task.id, task)

      const updated = tracker.ingestCliOutputEvent({
        tool: 'codex',
        stream: 'system',
        line: 'csv task-progress codex-retry-reset',
        progress: 0,
        confidence: 0.95,
        phase: 'working',
        observedAt: now,
        eventType: 'progress_pct',
        rawSource: 'line',
        instanceId: task.id,
        sessionId: 'retry-reset-session',
        payload: {
          source: 'csv-launch',
          kind: 'task-progress',
          taskId: task.id,
          reason: 'task-retry'
        }
      })

      expect(updated?.status.progressEstimate).toMatchObject({
        percentage: 0,
        phase: 'coding',
        confidence: 0.95
      })
      expect(tracker.getProgress(task.id)?.percentage).toBe(0)
    })

    it('feeds Gemini stdout parser state into the SignalCollector cli_parse channel', () => {
      const parser = new CLIOutputParser()
      const now = Date.now()
      const task: AITask = {
        id: 'gemini-cli-real',
        toolType: 'gemini-cli',
        pid: 5432,
        startTime: now - 8_000,
        status: { state: 'running', lastActivity: now - 4_000 },
        monitorState: 'thinking',
        metrics: {
          cpuHistory: [4, 3, 2],
          outputLineCount: 0,
          lastOutputTime: now - 4_000,
          idleDuration: 4_000,
          outputRate: 0
        }
      }
      ;(tracker as any).tasks.set(task.id, task)

      tracker.subscribeToCliOutputParser(parser)
      parser.parseChunk({
        tool: 'gemini',
        stream: 'stdout',
        instanceId: task.id,
        strategy: 'line',
        chunk: 'Thinking...',
        observedAt: now
      })

      const updated = tracker.getTaskById(task.id)
      expect(updated?.detectionSignals?.activeIndicators).toContain('cli_parse')
      expect(updated?.detectionSignals?.signalContributions?.map(signal => signal.name)).toContain('terminal_keywords')
      expect(updated?.status.currentAction).toBe('Thinking...')
      expect(updated?.status.progressEstimate).toMatchObject({
        percentage: 25,
        confidence: 0.85
      })
      expect(tracker.getProgress(task.id)?.percentage).toBeGreaterThanOrEqual(25)
    })
  })

  describe('getTaskById', () => {
    it('should return undefined for non-existent task', () => {
      const task = tracker.getTaskById('non-existent-id')
      expect(task).toBeUndefined()
    })
  })

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      expect(tracker.getHistory()).toEqual([])
    })

    it('should respect limit parameter with empty history', () => {
      expect(tracker.getHistory(5)).toEqual([])
    })

    it('should persist alias and window handle in history when a task completes', () => {
      const now = Date.now()
      ;(tracker as any).tasks.set('task-1', {
        id: 'task-1',
        toolType: 'codex',
        pid: 4321,
        alias: '前端',
        windowHwnd: 2048,
        startTime: now - 1000,
        status: { state: 'running', lastActivity: now },
        monitorState: 'thinking',
        metrics: {
          cpuHistory: [],
          outputLineCount: 0,
          lastOutputTime: now,
          idleDuration: 0
        }
      } satisfies Partial<AITask>)

      ;(tracker as any).completeTask('task-1', 'completed')

      expect(tracker.getHistory()[0]).toMatchObject({
        id: 'task-1',
        taskAlias: '前端',
        windowHwnd: 2048,
        status: 'completed'
      })
    })
  })

  describe('getStatistics', () => {
    it('should return correct initial statistics', () => {
      const stats = tracker.getStatistics()

      expect(stats.totalTasks).toBe(0)
      expect(stats.completedTasks).toBe(0)
      expect(stats.errorTasks).toBe(0)
      expect(stats.avgDuration).toBe(0)
      expect(stats.byTool).toBeDefined()
      expect(stats.byTool['codex']).toBe(0)
      expect(stats.byTool['claude-code']).toBe(0)
      expect(stats.byTool['gemini-cli']).toBe(0)
    })
  })

  describe('calculateVariance', () => {
    it('should calculate variance correctly', () => {
      const values = [1, 2, 3, 4, 5]
      const variance = (tracker as any).calculateVariance(values)
      expect(variance).toBe(2)
    })

    it('should return 0 for empty array', () => {
      const variance = (tracker as any).calculateVariance([])
      expect(variance).toBe(0)
    })

    it('should return 0 for single value', () => {
      const variance = (tracker as any).calculateVariance([5])
      expect(variance).toBe(0)
    })

    it('should return 0 for uniform values', () => {
      const variance = (tracker as any).calculateVariance([5, 5, 5, 5])
      expect(variance).toBe(0)
    })
  })

  describe('determineState', () => {
    it('should keep the current state when score exceeds threshold before confirmation', () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now(),
        status: { state: 'running', lastActivity: Date.now() },
        metrics: {
          cpuHistory: [0.5, 0.3, 0.2],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 0
        }
      }

      const state = (tracker as any).determineState(task, 0.8)
      expect(state).toBe('running')
    })

    it('should move idle high-confidence candidates back to waiting during confirmation', () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now(),
        status: { state: 'idle', lastActivity: Date.now() - 60000 },
        metrics: {
          cpuHistory: [0.2, 0.1, 0.2],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 60000
        }
      }

      const state = (tracker as any).determineState(task, 0.8)
      expect(state).toBe('waiting')
    })

    it('should return coding when CPU is high with variance', () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now(),
        status: { state: 'running', lastActivity: Date.now() },
        metrics: {
          cpuHistory: [50, 60, 70],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 0
        }
      }

      // cpuHistory [50,60,70] → recentAvg=60 > 5, variance=66.67 > 2 → coding
      const state = (tracker as any).determineState(task, 0.3)
      expect(state).toBe('coding')
    })

    it('should return waiting when idle for too long', () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now(),
        status: { state: 'running', lastActivity: Date.now() - 10000 },
        metrics: {
          cpuHistory: [1, 1, 1],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 10000
        }
      }

      const state = (tracker as any).determineState(task, 0.3)
      expect(state).toBe('waiting')
    })

    it('should return waiting when CPU is low and idle duration is short', () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now(),
        status: { state: 'running', lastActivity: Date.now() },
        metrics: {
          cpuHistory: [1, 1, 1],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 1000
        }
      }

      const state = (tracker as any).determineState(task, 0.3)
      expect(state).toBe('waiting')
    })

    it('should only score child process exits after a real child was observed', () => {
      const now = Date.now()

      expect((tracker as any).updateChildProcessEvidence('task', new Set<number>(), now)).toBe(false)
      expect((tracker as any).hasRecentChildProcessExit('task', now)).toBe(false)
      expect((tracker as any).updateChildProcessEvidence('task', new Set<number>([2222]), now + 1)).toBe(false)
      expect((tracker as any).updateChildProcessEvidence('task', new Set<number>(), now + 2)).toBe(true)
      expect((tracker as any).hasRecentChildProcessExit('task', now + 1000)).toBe(true)
      expect((tracker as any).hasRecentChildProcessExit('task', now + 20000)).toBe(false)
    })

    it('should use a missing-process grace window and cancel exits without completion evidence', () => {
      vi.useFakeTimers()
      try {
        const now = new Date('2026-04-25T00:00:00.000Z')
        vi.setSystemTime(now)
        const task: AITask = {
          id: 'missing-task',
          toolType: 'claude-code',
          pid: 1234,
          startTime: Date.now() - 10000,
          status: { state: 'running', lastActivity: Date.now() - 1000 },
          metrics: {
            cpuHistory: [1, 1, 1],
            outputLineCount: 0,
            lastOutputTime: Date.now() - 1000,
            idleDuration: 1000,
            outputRate: 0
          }
        }

        ;(tracker as any).tasks.set(task.id, task)

        expect((tracker as any).finalizeMissingTaskIfStable(task.id, task, Date.now())).toBe(false)
        expect(tracker.getActiveTasks()).toHaveLength(1)
        expect((tracker as any).finalizeMissingTaskIfStable(task.id, task, Date.now() + 5000)).toBe(true)
        expect(tracker.getHistory()[0].status).toBe('cancelled')
      } finally {
        vi.useRealTimers()
      }
    })

    it('should complete missing processes only when completion evidence was already captured', () => {
      const task: AITask = {
        id: 'completed-missing-task',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now() - 10000,
        status: { state: 'running', lastActivity: Date.now() - 10000 },
        monitorState: 'validating',
        metrics: {
          cpuHistory: [0.5, 0.3, 0.2],
          outputLineCount: 0,
          lastOutputTime: Date.now() - 10000,
          idleDuration: 10000,
          outputRate: 0
        },
        detectionSignals: {
          completionScore: 0.85,
          phaseConfidence: 0.9,
          activeIndicators: ['cpu_idle', 'low_output_rate', 'prompt_detected'],
          inConfirmationWindow: true,
          confirmationRemainingMs: 1000
        }
      }

      ;(tracker as any).tasks.set(task.id, task)
      ;(tracker as any)._missingProcessEvidence.set(task.id, { missingSince: Date.now() - 5000 })

      expect((tracker as any).finalizeMissingTaskIfStable(task.id, task, Date.now())).toBe(true)
      expect(tracker.getHistory()[0].status).toBe('completed')
    })
  })

  describe('observability contracts', () => {
    it('should return null confidence reports for unknown tasks', () => {
      expect(tracker.getConfidenceReport('missing-task')).toBeNull()
    })

    it('should expose confidence report details for active tasks', () => {
      const now = Date.now()
      const task: AITask = {
        id: 'confidence-task',
        toolType: 'codex',
        pid: 1234,
        startTime: now - 10000,
        status: { state: 'waiting', lastActivity: now - 5000 },
        monitorState: 'validating',
        metrics: {
          cpuHistory: [0.2, 0.1, 0.2],
          outputLineCount: 12,
          lastOutputTime: now - 5000,
          idleDuration: 5000,
          outputRate: 0
        },
        detectionSignals: {
          completionScore: 0.82,
          phaseConfidence: 0.71,
          activeIndicators: ['cpu_idle', 'prompt_detected'],
          inConfirmationWindow: true,
          confirmationRemainingMs: 2500
        }
      }

      ;(tracker as any).tasks.set(task.id, task)

      const report = tracker.getConfidenceReport(task.id)

      expect(report).toMatchObject({
        taskKey: task.id,
        taskId: task.id,
        toolType: 'codex',
        state: 'waiting',
        monitorState: 'validating',
        completionScore: 0.82,
        threshold: 0.80,
        phaseConfidence: 0.71,
        activeIndicators: ['cpu_idle', 'prompt_detected'],
        inConfirmationWindow: true,
        confirmationRemainingMs: 2500
      })
      expect(report?.narrative).toContain('cpu_idle, prompt_detected')
      expect(report?.updatedAt).toBeGreaterThanOrEqual(now)
    })

    it('should expose bounded state history with task keys and monitor state', () => {
      const now = Date.now()
      const task: AITask = {
        id: 'history-task',
        toolType: 'claude-code',
        pid: 1234,
        startTime: now - 10000,
        status: { state: 'running', lastActivity: now },
        monitorState: 'validating',
        metrics: {
          cpuHistory: [],
          outputLineCount: 0,
          lastOutputTime: now,
          idleDuration: 0
        }
      }

      ;(tracker as any).tasks.set(task.id, task)
      ;(tracker as any).recordTimelineEntry(task.id, 'running', 'started')
      ;(tracker as any).recordTimelineEntry(task.id, 'waiting', 'idle evidence')
      ;(tracker as any).recordTimelineEntry(task.id, 'completed', 'confirmed')

      const history = tracker.getStateHistory(task.id, 2)

      expect(history).toHaveLength(2)
      expect(history.map(entry => entry.status)).toEqual(['waiting', 'completed'])
      expect(history.every(entry => entry.taskKey === task.id)).toBe(true)
      expect(history.every(entry => entry.monitorState === 'validating')).toBe(true)
    })

    it('should round-trip tool profile thresholds and signal weights', () => {
      const signalWeights = {
        terminalKeywords: 0.31,
        cpuIdle: 0.21,
        lowOutputRate: 0.16,
        promptDetected: 0.11,
        childProcessExit: 0.17,
        timeThreshold: 0.04
      }

      const updated = tracker.setToolProfile('codex', {
        completionKeywords: ['Task done'],
        errorKeywords: ['Task failed'],
        promptPatterns: ['^ready$'],
        cpuBaselineThreshold: 7,
        confirmationWindowMs: 12000,
        signalWeights,
        minHoldMs: { validating: 12000 }
      })

      expect(updated).toBe(true)
      expect(tracker.getToolProfile('codex')).toMatchObject({
        toolType: 'codex',
        completionKeywords: ['Task done'],
        errorKeywords: ['Task failed'],
        promptPatterns: ['^ready$'],
        cpuBaselineThreshold: 7,
        confirmationWindowMs: 12000,
        signalWeights,
        minHoldMs: { validating: 12000 }
      })

      const config = (tracker as any).config
      expect(config.outputPatternWeight).toBe(signalWeights.terminalKeywords)
      expect(config.cpuIdleWeight).toBe(signalWeights.cpuIdle)
      expect(config.cursorWaitWeight).toBe(signalWeights.lowOutputRate)
      expect(config.promptDetectionWeight).toBe(signalWeights.promptDetected)
      expect(config.childProcessWeight).toBe(signalWeights.childProcessExit)
      expect(config.timeThresholdWeight).toBe(signalWeights.timeThreshold)
    })

    it('should reject unregistered tool profiles without changing global weights', () => {
      const before = tracker.getToolProfile('codex')?.signalWeights

      const updated = tracker.setToolProfile('other', {
        signalWeights: {
          terminalKeywords: 0.9,
          cpuIdle: 0.9,
          lowOutputRate: 0.9,
          promptDetected: 0.9,
          childProcessExit: 0.9,
          timeThreshold: 0.9
        }
      })

      expect(updated).toBe(false)
      expect(tracker.getToolProfile('codex')?.signalWeights).toEqual(before)
      expect(tracker.getToolProfile('other')).toBeNull()
    })
  })
  describe('recordCompletionOracleEvent', () => {
    it('should record a real Claude hook completion into history and confidence reports', () => {
      const event: AICompletionOracleEvent = {
        alias: 'p4-active',
        completedAt: Date.now(),
        hookEventName: 'Stop',
        source: 'claude-code-hook',
        cwd: 'D:/Desktop/CREATOR ONE/devhub',
        sessionId: 'session-real-1',
        taskKey: 'task-real-1',
        transcriptPath: 'D:/Desktop/CREATOR ONE/devhub/.claude/transcript.jsonl'
      }

      const record = tracker.recordCompletionOracleEvent(event)

      expect(record).not.toBeNull()
      expect(record?.history).toMatchObject({
        id: 'oracle:p4-active:session-real-1',
        toolType: 'claude-code',
        status: 'completed',
        taskAlias: 'p4-active',
        endTime: event.completedAt
      })
      expect(tracker.getHistory()).toHaveLength(1)

      const report = tracker.getConfidenceReport(record?.history.id ?? '')
      expect(report).not.toBeNull()
      expect(report?.completionScore).toBe(1)
      expect(report?.signalContributions?.filter(item => item.weightedContribution > 0)).toHaveLength(3)
      expect(report?.activeIndicators).toEqual(['terminal_keywords', 'child_process_exit', 'time_threshold'])
    })

    it('should deduplicate oracle completions by alias and session id', () => {
      const event: AICompletionOracleEvent = {
        alias: 'p4-active',
        completedAt: Date.now(),
        hookEventName: 'Stop',
        source: 'claude-code-hook',
        sessionId: 'session-real-2'
      }

      const first = tracker.recordCompletionOracleEvent(event)
      const second = tracker.recordCompletionOracleEvent({ ...event, completedAt: event.completedAt + 1000 })

      expect(first?.history.id).toBe('oracle:p4-active:session-real-2')
      expect(second?.history.id).toBe(first?.history.id)
      expect(tracker.getHistory()).toHaveLength(1)
      expect(tracker.getConfidenceReport('oracle:session-real-2')).toBe(first?.confidenceReport)
    })

    it('should reject malformed oracle events without mutating history', () => {
      expect(tracker.recordCompletionOracleEvent({
        alias: '   ',
        completedAt: Date.now(),
        hookEventName: 'Stop',
        source: 'claude-code-hook'
      })).toBeNull()

      expect(tracker.getHistory()).toEqual([])
    })
  })

  describe('detectWindowTitlePattern', () => {
    it('should return false results when no windowHwnd', async () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now(),
        status: { state: 'running', lastActivity: Date.now() },
        metrics: {
          cpuHistory: [],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 0
        }
      }

      const result = await tracker.detectWindowTitlePattern(task)

      expect(result.isComplete).toBe(false)
      expect(result.isError).toBe(false)
    })

    it('should return false results for invalid hwnd', async () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        windowHwnd: -1,
        startTime: Date.now(),
        status: { state: 'running', lastActivity: Date.now() },
        metrics: {
          cpuHistory: [],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 0
        }
      }

      const result = await tracker.detectWindowTitlePattern(task)

      expect(result.isComplete).toBe(false)
      expect(result.isError).toBe(false)
    })
  })

  describe('config defaults', () => {
    it('should have reasonable default values', () => {
      const config = (tracker as any).config

      expect(config.outputPatternWeight).toBe(0.20)
      expect(config.cpuIdleWeight).toBe(0.25)
      expect(config.cursorWaitWeight).toBe(0.20)
      expect(config.timeThresholdWeight).toBe(0.10)
      expect(config.idleThresholdMs).toBe(5000)
      expect(config.completionThreshold).toBe(0.80)
    })
  })

  describe('refresh interval', () => {
    it('should have default refresh interval', () => {
      expect((tracker as any).refreshInterval).toBe(2000)
    })
  })
})
