import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChildProcess } from 'child_process'

const { mockExecFile, mockKill } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockKill: vi.fn((_pid: number, _signal: string, callback?: () => void) => callback?.())
}))

vi.mock('child_process', () => ({
  default: { execFile: mockExecFile },
  execFile: mockExecFile
}))

vi.mock('tree-kill', () => ({
  default: mockKill
}))

import { PowerShellGateway, PowerShellGatewayQueueFullError, PowerShellGatewayTimeoutError } from './PowerShellGateway'

function createChild(pid: number): ChildProcess {
  return {
    pid,
    once: vi.fn()
  } as unknown as ChildProcess
}

describe('PowerShellGateway', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should execute and parse stdout', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      callback?.(null, '{"ok":true}', '')
      return createChild(101)
    })

    const gateway = new PowerShellGateway({ concurrency: 1 })
    const result = await gateway.execute('Write-Output ok', {
      parser: (stdout) => JSON.parse(stdout) as { ok: boolean }
    })

    expect(result.ok).toBe(true)
    expect(gateway.getStats().completedCount).toBe(1)
  })

  it('should abort and kill the process tree on timeout', async () => {
    mockExecFile.mockImplementation((_cmd, _args, opts, callback) => {
      opts.signal?.addEventListener('abort', () => {
        const abortError = new Error('aborted')
        abortError.name = 'AbortError'
        callback?.(abortError, '', '')
      })
      return createChild(202)
    })

    const gateway = new PowerShellGateway({ concurrency: 1, defaultTimeoutMs: 25 })
    const promise = gateway.execute('Start-Sleep 10', { label: 'timeout-case' })
    const rejection = expect(promise).rejects.toBeInstanceOf(PowerShellGatewayTimeoutError)

    await vi.advanceTimersByTimeAsync(30)

    await rejection
    expect(mockKill).toHaveBeenCalledWith(202, 'SIGTERM', expect.any(Function))
    expect(gateway.getStats().timedOutCount).toBe(1)
  })

  it('should not hang shutdown when tree-kill does not call back', async () => {
    mockKill.mockImplementationOnce(() => undefined)
    mockExecFile.mockImplementation((_cmd, _args, opts, callback) => {
      opts.signal?.addEventListener('abort', () => {
        const abortError = new Error('aborted')
        abortError.name = 'AbortError'
        callback?.(abortError, '', '')
      })
      return createChild(404)
    })

    const gateway = new PowerShellGateway({ concurrency: 1, defaultTimeoutMs: 1000 })
    const activePromise = gateway.execute('Start-Sleep 10', { label: 'shutdown-case' }).catch(() => undefined)

    const shutdownPromise = gateway.shutdown()
    await vi.advanceTimersByTimeAsync(1600)

    await expect(shutdownPromise).resolves.toBe(1)
    await activePromise
    expect(gateway.getStats().activeCount).toBe(0)
  })

  it('should reject when queue capacity is exhausted', async () => {
    mockExecFile.mockImplementation((_cmd, _args, opts, callback) => {
      opts.signal?.addEventListener('abort', () => {
        const abortError = new Error('aborted')
        abortError.name = 'AbortError'
        callback?.(abortError, '', '')
      })
      return createChild(303)
    })

    const gateway = new PowerShellGateway({ concurrency: 1, maxQueue: 1, defaultTimeoutMs: 1000 })

    const activePromise = gateway.execute('first', { label: 'first' })
    const queuedPromise = gateway.execute('second', { label: 'second' })
    const activeRejection = expect(activePromise).rejects.toBeDefined()
    const queuedRejection = expect(queuedPromise).rejects.toBeDefined()

    await expect(gateway.execute('third', { label: 'third' })).rejects.toBeInstanceOf(PowerShellGatewayQueueFullError)

    await gateway.shutdown()
    await activeRejection
    await queuedRejection
  })
})
