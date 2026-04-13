/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AITaskTracker } from './AITaskTracker'
import { SystemProcessScanner } from './SystemProcessScanner'
import { AITask } from '@shared/types-extended'

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
      expect(config.completionThreshold).toBe(0.7)
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
    it('should return completed when score exceeds threshold', () => {
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
      expect(state).toBe('completed')
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
  })

  describe('calculateCompletionScore', () => {
    it('should return higher score for low CPU', () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now(),
        status: { state: 'running', lastActivity: Date.now() },
        metrics: {
          cpuHistory: [0.1, 0.2, 0.1],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 0
        }
      }

      const score = (tracker as any).calculateCompletionScore(task, 0.1)
      expect(score).toBeGreaterThan(0)
    })

    it('should return higher score for long idle duration', () => {
      const task: AITask = {
        id: 'test',
        toolType: 'claude-code',
        pid: 1234,
        startTime: Date.now(),
        status: { state: 'running', lastActivity: Date.now() - 10000 },
        metrics: {
          cpuHistory: [50, 50, 50],
          outputLineCount: 0,
          lastOutputTime: Date.now(),
          idleDuration: 10000
        }
      }

      const score = (tracker as any).calculateCompletionScore(task, 50)
      expect(score).toBeGreaterThan(0)
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

      expect(config.outputPatternWeight).toBe(0.4)
      expect(config.cpuIdleWeight).toBe(0.25)
      expect(config.cursorWaitWeight).toBe(0.2)
      expect(config.timeThresholdWeight).toBe(0.15)
      expect(config.idleThresholdMs).toBe(5000)
      expect(config.completionThreshold).toBe(0.7)
    })
  })

  describe('refresh interval', () => {
    it('should have default refresh interval', () => {
      expect((tracker as any).refreshInterval).toBe(2000)
    })
  })
})
