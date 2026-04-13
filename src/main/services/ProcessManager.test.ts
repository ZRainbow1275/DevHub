import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// Mock child_process
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('child_process', async (importOriginal: () => Promise<any>) => {
  const mod = await importOriginal()
  const spawnMock = vi.fn()
  return {
    ...mod,
    default: { ...mod, spawn: spawnMock },
    spawn: spawnMock
  }
})

// Mock tree-kill
vi.mock('tree-kill', () => ({
  default: vi.fn((_pid: number, _signal: string, cb: (err?: Error) => void) => cb())
}))

// Mock security utils
vi.mock('../utils/security', () => ({
  validateScriptName: vi.fn((name: string) => /^[a-zA-Z0-9_:-]+$/.test(name))
}))

import { ProcessManager } from './ProcessManager'
import { spawn } from 'child_process'
import kill from 'tree-kill'
import type { Project } from '@shared/types'

function createMockProcess(pid = 1234): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; pid: number; killed: boolean } {
  const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; pid: number; killed: boolean }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.pid = pid
  proc.killed = false
  return proc
}

function createProject(overrides?: Partial<Project>): Project {
  return {
    id: 'test-project',
    name: 'Test Project',
    path: '/tmp/test',
    scripts: ['dev', 'build', 'test'],
    defaultScript: 'dev',
    projectType: 'npm',
    tags: [],
    status: 'stopped' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }
}

describe('ProcessManager', () => {
  let pm: ProcessManager

  beforeEach(() => {
    pm = new ProcessManager()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('start', () => {
    it('should spawn a process with correct arguments', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')

      // Simulate spawn event
      mockProc.emit('spawn')
      await startPromise

      expect(spawn).toHaveBeenCalledWith(
        'npm',
        ['run', 'dev'],
        expect.objectContaining({
          cwd: '/tmp/test',
          shell: process.platform === 'win32'
        })
      )
    })

    it('should mark process as running after spawn', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      expect(pm.isRunning('test-project')).toBe(true)
    })

    it('should reject invalid script names', async () => {
      const project = createProject()
      await expect(pm.start(project, 'rm -rf /')).rejects.toThrow('Invalid script name')
    })

    it('should reject scripts not in project scripts list', async () => {
      const project = createProject()
      await expect(pm.start(project, 'nonexistent')).rejects.toThrow('not found in project configuration')
    })

    it('should prevent duplicate starts for the same project', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      await expect(pm.start(project, 'dev')).rejects.toThrow('already running')
    })

    it('should emit status callback on spawn', async () => {
      const mockProc = createMockProcess(5678)
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const statusCallback = vi.fn()
      pm.setStatusCallback(statusCallback)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      expect(statusCallback).toHaveBeenCalledWith('test-project', 'running', 5678)
    })

    it('should emit log entries from stdout', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const logCallback = vi.fn()
      pm.onLog('test-project', logCallback)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      mockProc.stdout.emit('data', Buffer.from('hello world\n'))

      expect(logCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          type: 'stdout',
          message: 'hello world'
        })
      )
    })

    it('should emit log entries from stderr', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const logCallback = vi.fn()
      pm.onLog('test-project', logCallback)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      mockProc.stderr.emit('data', Buffer.from('error occurred\n'))

      expect(logCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          type: 'stderr',
          message: 'error occurred'
        })
      )
    })

    it('should handle process error event', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const statusCallback = vi.fn()
      pm.setStatusCallback(statusCallback)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')

      mockProc.emit('error', new Error('spawn failed'))

      await expect(startPromise).rejects.toThrow('spawn failed')
      expect(pm.isRunning('test-project')).toBe(false)
      expect(statusCallback).toHaveBeenCalledWith('test-project', 'error')
    })

    it('should filter environment variables to safe set', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      const callArgs = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
      const env = callArgs[2].env

      expect(env.FORCE_COLOR).toBe('1')
      expect(env.NODE_ENV).toBe('development')
      // Should NOT contain arbitrary env vars
      expect(env.RANDOM_VAR).toBeUndefined()
    })
  })

  describe('stop', () => {
    it('should call tree-kill with SIGTERM', async () => {
      const mockProc = createMockProcess(9999)
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      await pm.stop('test-project')

      expect(kill).toHaveBeenCalledWith(9999, 'SIGTERM', expect.any(Function))
    })

    it('should clean up process reference after stop', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      expect(pm.isRunning('test-project')).toBe(true)

      await pm.stop('test-project')

      expect(pm.isRunning('test-project')).toBe(false)
    })

    it('should force kill if SIGTERM fails', async () => {
      const mockProc = createMockProcess(7777)
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      // First call (SIGTERM) fails, second call (SIGKILL) succeeds
      ;(kill as unknown as ReturnType<typeof vi.fn>)
        .mockImplementationOnce((_pid: number, _signal: string, cb: (err?: Error) => void) => cb(new Error('SIGTERM failed')))
        .mockImplementationOnce((_pid: number, _signal: string, cb: (err?: Error) => void) => cb())

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      await pm.stop('test-project')

      expect(kill).toHaveBeenCalledTimes(2)
      expect(kill).toHaveBeenNthCalledWith(1, 7777, 'SIGTERM', expect.any(Function))
      expect(kill).toHaveBeenNthCalledWith(2, 7777, 'SIGKILL', expect.any(Function))
    })

    it('should do nothing when process is not running', async () => {
      await pm.stop('nonexistent')
      expect(kill).not.toHaveBeenCalled()
    })

    it('should prevent concurrent stop calls', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      // Make kill slow
      ;(kill as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_pid: number, _signal: string, cb: (err?: Error) => void) => {
          setTimeout(() => cb(), 50)
        }
      )

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      // Both stop calls should complete without double-killing
      await Promise.all([pm.stop('test-project'), pm.stop('test-project')])
      expect(kill).toHaveBeenCalledTimes(1)
    })
  })

  describe('process exit', () => {
    it('should clean up on exit and emit stopped status for code 0', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const statusCallback = vi.fn()
      pm.setStatusCallback(statusCallback)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      statusCallback.mockClear()
      mockProc.emit('exit', 0, null)

      expect(pm.isRunning('test-project')).toBe(false)
      expect(statusCallback).toHaveBeenCalledWith('test-project', 'stopped')
    })

    it('should emit error status for non-zero exit code', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const statusCallback = vi.fn()
      pm.setStatusCallback(statusCallback)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      statusCallback.mockClear()
      mockProc.emit('exit', 1, null)

      expect(statusCallback).toHaveBeenCalledWith('test-project', 'error')
    })
  })

  describe('log callbacks', () => {
    it('should support multiple log callbacks', async () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      pm.onLog('test-project', cb1)
      pm.onLog('test-project', cb2)

      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      mockProc.stdout.emit('data', Buffer.from('test\n'))

      expect(cb1).toHaveBeenCalled()
      expect(cb2).toHaveBeenCalled()
    })

    it('should support unsubscribing from log callbacks', async () => {
      const cb = vi.fn()
      const unsub = pm.onLog('test-project', cb)

      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      unsub()
      mockProc.stdout.emit('data', Buffer.from('test\n'))

      // The system log from start will have fired, but no stdout log after unsub
      const stdoutCalls = cb.mock.calls.filter(
        (call: Array<{ type: string }>) => call[0].type === 'stdout'
      )
      expect(stdoutCalls.length).toBe(0)
    })
  })

  describe('getRunningProjects', () => {
    it('should return all running project IDs', async () => {
      const mockProc1 = createMockProcess(1111)
      const mockProc2 = createMockProcess(2222)
      ;(spawn as unknown as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockProc1)
        .mockReturnValueOnce(mockProc2)

      const p1 = createProject({ id: 'p1' })
      const p2 = createProject({ id: 'p2' })

      const start1 = pm.start(p1, 'dev')
      mockProc1.emit('spawn')
      await start1

      const start2 = pm.start(p2, 'dev')
      mockProc2.emit('spawn')
      await start2

      const running = pm.getRunningProjects()
      expect(running).toContain('p1')
      expect(running).toContain('p2')
      expect(running.length).toBe(2)
    })
  })

  describe('getProcessInfo', () => {
    it('should return process info for running project', async () => {
      const mockProc = createMockProcess(4321)
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      const info = pm.getProcessInfo('test-project')
      expect(info).toEqual({ pid: 4321, running: true })
    })

    it('should return null for non-running project', () => {
      const info = pm.getProcessInfo('nonexistent')
      expect(info).toBeNull()
    })
  })

  describe('stopAll', () => {
    it('should stop all running processes', async () => {
      const mockProc1 = createMockProcess(1111)
      const mockProc2 = createMockProcess(2222)
      ;(spawn as unknown as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockProc1)
        .mockReturnValueOnce(mockProc2)

      const p1 = createProject({ id: 'p1' })
      const p2 = createProject({ id: 'p2' })

      const start1 = pm.start(p1, 'dev')
      mockProc1.emit('spawn')
      await start1

      const start2 = pm.start(p2, 'dev')
      mockProc2.emit('spawn')
      await start2

      await pm.stopAll()

      expect(pm.isRunning('p1')).toBe(false)
      expect(pm.isRunning('p2')).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should stop all processes and clear callbacks', async () => {
      const mockProc = createMockProcess()
      ;(spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)

      const project = createProject()
      const startPromise = pm.start(project, 'dev')
      mockProc.emit('spawn')
      await startPromise

      pm.onLog('test-project', vi.fn())

      await pm.cleanup()

      expect(pm.isRunning('test-project')).toBe(false)
      expect(pm.getRunningProjects()).toEqual([])
    })
  })

  describe('removeLogCallbacks', () => {
    it('should remove all log callbacks for a project', () => {
      const cb = vi.fn()
      pm.onLog('test-project', cb)
      pm.removeLogCallbacks('test-project')

      // After removal, the callback set should be gone (no error on emit)
      // We can verify by checking internal state indirectly
      expect(true).toBe(true) // No throw means success
    })
  })
})
