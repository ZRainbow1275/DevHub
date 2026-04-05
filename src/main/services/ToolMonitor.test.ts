import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { CodingTool } from '@shared/types'

// vi.hoisted ensures this runs before vi.mock factories (which are hoisted)
const { mockExecFileAsync } = vi.hoisted(() => {
  const mockExecFileAsync = vi.fn<(cmd: string, args: string[], opts: object) => Promise<{ stdout: string }>>()
  return { mockExecFileAsync }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('child_process', async (importOriginal: () => Promise<any>) => {
  const mod = await importOriginal()
  return { ...mod, default: mod, execFile: vi.fn() }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('util', async (importOriginal: () => Promise<any>) => {
  const mod = await importOriginal()
  const mockPromisify = (): unknown => mockExecFileAsync
  return {
    ...mod,
    default: { ...mod, promisify: mockPromisify },
    promisify: mockPromisify
  }
})

import { ToolMonitor } from './ToolMonitor'

function createTools(): CodingTool[] {
  return [
    {
      id: 'codex',
      name: 'codex',
      displayName: 'Codex CLI',
      processName: 'codex',
      completionPatterns: ['Done'],
      status: 'idle'
    },
    {
      id: 'claude-code',
      name: 'claude-code',
      displayName: 'Claude Code',
      processName: 'claude',
      completionPatterns: ['Complete'],
      status: 'idle'
    }
  ]
}

describe('ToolMonitor', () => {
  let monitor: ToolMonitor

  beforeEach(() => {
    vi.useFakeTimers()
    monitor = new ToolMonitor()
    vi.clearAllMocks()
  })

  afterEach(() => {
    monitor.stop()
    vi.useRealTimers()
  })

  describe('start/stop', () => {
    it('should initialize tools and begin checking', () => {
      const tools = createTools()
      const onCompletion = vi.fn()

      // Mock: no processes found
      mockExecFileAsync.mockResolvedValue({ stdout: 'INFO: No tasks are running' })

      monitor.start(tools, 3000, onCompletion)

      const statuses = monitor.getAllToolStatus()
      expect(statuses.length).toBe(2)
      expect(statuses[0].id).toBe('codex')
      expect(statuses[1].id).toBe('claude-code')
    })

    it('should stop polling when stop() is called', async () => {
      const tools = createTools()
      mockExecFileAsync.mockResolvedValue({ stdout: 'INFO: No tasks are running' })

      monitor.start(tools, 1000, vi.fn())

      // Let initial check finish
      await vi.advanceTimersByTimeAsync(100)

      monitor.stop()

      // Record call count after stop
      const callCountAfterStop = mockExecFileAsync.mock.calls.length

      // Advance time - no more calls should happen
      await vi.advanceTimersByTimeAsync(5000)

      // No additional calls after stop
      expect(mockExecFileAsync.mock.calls.length).toBe(callCountAfterStop)
    })
  })

  describe('getToolStatus', () => {
    it('should return tool by ID', () => {
      const tools = createTools()
      mockExecFileAsync.mockResolvedValue({ stdout: 'INFO: No tasks are running' })

      monitor.start(tools, 3000, vi.fn())

      const tool = monitor.getToolStatus('codex')
      expect(tool).toBeDefined()
      expect(tool?.displayName).toBe('Codex CLI')
    })

    it('should return undefined for unknown tool ID', () => {
      const tools = createTools()
      mockExecFileAsync.mockResolvedValue({ stdout: '' })

      monitor.start(tools, 3000, vi.fn())

      const tool = monitor.getToolStatus('nonexistent')
      expect(tool).toBeUndefined()
    })
  })

  describe('getAllToolStatus', () => {
    it('should return a copy of all tools', () => {
      const tools = createTools()
      mockExecFileAsync.mockResolvedValue({ stdout: '' })

      monitor.start(tools, 3000, vi.fn())

      const statuses = monitor.getAllToolStatus()
      expect(statuses.length).toBe(2)
      // Should be a copy
      expect(statuses).not.toBe(tools)
    })
  })

  describe('getCurrentInterval', () => {
    it('should return base interval initially', () => {
      const tools = createTools()
      mockExecFileAsync.mockResolvedValue({ stdout: '' })

      monitor.start(tools, 3000, vi.fn())

      // After initial check with no active tools, interval may adjust
      // but should be around the base
      const interval = monitor.getCurrentInterval()
      expect(interval).toBeGreaterThanOrEqual(1000)
      expect(interval).toBeLessThanOrEqual(5000)
    })
  })

  describe('tool status transitions', () => {
    it('should set tool to idle when process is not found', async () => {
      const tools = createTools()
      mockExecFileAsync.mockResolvedValue({ stdout: 'INFO: No tasks are running' })

      monitor.start(tools, 3000, vi.fn())

      // Let the initial check complete
      await vi.advanceTimersByTimeAsync(100)

      const status = monitor.getToolStatus('codex')
      expect(status?.status).toBe('idle')
    })
  })

  describe('unknown tool detection', () => {
    it('should skip unknown tools without error', async () => {
      const tools: CodingTool[] = [
        {
          id: 'unknown-tool',
          name: 'other',
          displayName: 'Unknown',
          processName: 'unknown',
          completionPatterns: [],
          status: 'idle'
        }
      ]

      mockExecFileAsync.mockResolvedValue({ stdout: '' })

      monitor.start(tools, 3000, vi.fn())
      await vi.advanceTimersByTimeAsync(100)

      // Should not crash
      const status = monitor.getToolStatus('unknown-tool')
      expect(status?.status).toBe('idle')
    })
  })

  describe('process list failure handling', () => {
    it('should reset previousStatus when getAllProcessNames fails to prevent stale notifications', async () => {
      const tools = createTools()
      const onCompletion = vi.fn()

      // Call sequence:
      // 1. codex is running
      // 2. process list fails
      // 3. recovery - codex is not running
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: '"codex.exe","1234","Console","1","10,000 K"\n' })
        .mockRejectedValueOnce(new Error('Access denied'))
        .mockResolvedValue({ stdout: '' })

      monitor.start(tools, 1000, onCompletion)

      // Let initial check complete (codex detected as running)
      await vi.advanceTimersByTimeAsync(100)

      // Second check fails
      await vi.advanceTimersByTimeAsync(1100)

      // Third check succeeds - codex not running
      await vi.advanceTimersByTimeAsync(5100)

      // Should NOT trigger completion because previousStatus was reset on failure
      expect(onCompletion).not.toHaveBeenCalled()
    })
  })

  describe('notification deduplication', () => {
    it('should not send duplicate notifications within the dedup window', async () => {
      const tools = createTools()
      const onCompletion = vi.fn()

      // Call sequence:
      // 1. codex is running
      // 2. codex is running
      // 3. codex stopped -> triggers completion
      // 4. codex is running again
      // 5. codex stopped again -> should be deduped
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: '"codex.exe","1234","Console","1","10,000 K"\n' })
        .mockResolvedValueOnce({ stdout: '"codex.exe","1234","Console","1","10,000 K"\n' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '"codex.exe","1234","Console","1","10,000 K"\n' })
        .mockResolvedValue({ stdout: '' })

      monitor.start(tools, 1000, onCompletion)

      // Let first check complete (codex detected as running)
      await vi.advanceTimersByTimeAsync(100)

      // Second check - still running
      await vi.advanceTimersByTimeAsync(1100)

      // Third check - stopped, should trigger notification
      await vi.advanceTimersByTimeAsync(1100)
      expect(onCompletion).toHaveBeenCalledTimes(1)

      // Fourth check - running again
      await vi.advanceTimersByTimeAsync(1100)

      // Fifth check - stopped again within 30s window, should be deduped
      await vi.advanceTimersByTimeAsync(1100)
      expect(onCompletion).toHaveBeenCalledTimes(1)
    })
  })

  describe('stop prevents callbacks', () => {
    it('should not fire completion callbacks after stop() is called', async () => {
      const tools = createTools()
      const onCompletion = vi.fn()

      // First check: codex is running; subsequent: codex not running
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: '"codex.exe","1234","Console","1","10,000 K"\n' })
        .mockResolvedValue({ stdout: '' })

      monitor.start(tools, 1000, onCompletion)

      // Let initial check complete (codex detected as running)
      await vi.advanceTimersByTimeAsync(100)

      // Stop the monitor
      monitor.stop()

      // Even if time advances, no completion should fire
      await vi.advanceTimersByTimeAsync(5000)
      expect(onCompletion).not.toHaveBeenCalled()
    })
  })
})
