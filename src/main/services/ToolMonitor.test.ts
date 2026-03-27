import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock child_process.execFile
vi.mock('child_process', () => ({
  execFile: vi.fn()
}))

vi.mock('util', () => ({
  promisify: vi.fn((fn: (...args: unknown[]) => void) => {
    return (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err: Error | null, result: unknown) => {
          if (err) reject(err)
          else resolve(result)
        })
      })
    }
  })
}))

import { ToolMonitor } from './ToolMonitor'
import { execFile } from 'child_process'
import type { CodingTool } from '@shared/types'

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

      // Mock execFile to return empty (no processes found)
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, result: unknown) => void) => {
          cb(null, { stdout: 'INFO: No tasks are running' })
        }
      )

      monitor.start(tools, 3000, onCompletion)

      const statuses = monitor.getAllToolStatus()
      expect(statuses.length).toBe(2)
      expect(statuses[0].id).toBe('codex')
      expect(statuses[1].id).toBe('claude-code')
    })

    it('should stop polling when stop() is called', () => {
      const tools = createTools()
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, result: unknown) => void) => {
          cb(null, { stdout: 'INFO: No tasks are running' })
        }
      )

      monitor.start(tools, 1000, vi.fn())
      monitor.stop()

      // Advance time - no more calls should happen
      const callCountAfterStop = (execFile as unknown as ReturnType<typeof vi.fn>).mock.calls.length
      vi.advanceTimersByTime(5000)

      // No additional calls after stop
      expect((execFile as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountAfterStop)
    })
  })

  describe('getToolStatus', () => {
    it('should return tool by ID', () => {
      const tools = createTools()
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, result: unknown) => void) => {
          cb(null, { stdout: 'INFO: No tasks are running' })
        }
      )

      monitor.start(tools, 3000, vi.fn())

      const tool = monitor.getToolStatus('codex')
      expect(tool).toBeDefined()
      expect(tool?.displayName).toBe('Codex CLI')
    })

    it('should return undefined for unknown tool ID', () => {
      const tools = createTools()
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, result: unknown) => void) => {
          cb(null, { stdout: '' })
        }
      )

      monitor.start(tools, 3000, vi.fn())

      const tool = monitor.getToolStatus('nonexistent')
      expect(tool).toBeUndefined()
    })
  })

  describe('getAllToolStatus', () => {
    it('should return a copy of all tools', () => {
      const tools = createTools()
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, result: unknown) => void) => {
          cb(null, { stdout: '' })
        }
      )

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
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, result: unknown) => void) => {
          cb(null, { stdout: '' })
        }
      )

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
      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, result: unknown) => void) => {
          cb(null, { stdout: 'INFO: No tasks are running' })
        }
      )

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

      ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, result: unknown) => void) => {
          cb(null, { stdout: '' })
        }
      )

      monitor.start(tools, 3000, vi.fn())
      await vi.advanceTimersByTimeAsync(100)

      // Should not crash
      const status = monitor.getToolStatus('unknown-tool')
      expect(status?.status).toBe('idle')
    })
  })
})
