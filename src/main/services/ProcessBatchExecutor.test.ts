import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { ProcessInfo, ServiceResult, WindowInfo } from '@shared/types-extended'
import {
  PROCESS_BATCH_LIMITS,
  processBatchRequestSchema,
  type ProcessBatchRequest,
  type ProcessTag
} from '@shared/schemas/r8-runtime'
import {
  ProcessBatchExecutor,
  type ProcessBatchScanner,
  type ProcessBatchRuntimeService,
  type ProcessBatchWindowManager
} from './ProcessBatchExecutor'

function createRequest(input: {
  action: ProcessBatchRequest['action']
  pids: number[]
  args?: Record<string, unknown>
  confirmed?: boolean
  dryRun?: boolean
}): ProcessBatchRequest {
  return processBatchRequestSchema.parse({
    args: {},
    confirmed: false,
    dryRun: false,
    ...input
  })
}

function createProcessInfo(patch: Partial<ProcessInfo> = {}): ProcessInfo {
  return {
    pid: 4201,
    ppid: 1,
    name: 'codex.exe',
    command: 'codex',
    cpu: 1,
    memory: 64,
    status: 'running',
    startTime: Date.now(),
    type: 'ai-tool',
    workingDir: 'D:/Desktop/CREATOR ONE',
    ...patch
  }
}

function createWindowInfo(patch: Partial<WindowInfo> = {}): WindowInfo {
  return {
    hwnd: 9001,
    title: 'Codex',
    processName: 'codex.exe',
    pid: 4201,
    className: 'ConsoleWindowClass',
    rect: { x: 0, y: 0, width: 800, height: 600 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false,
    ...patch
  }
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise: (() => void) | null = null
  const promise = new Promise<void>(resolve => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve: () => {
      resolvePromise?.()
    }
  }
}

async function waitForCondition(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (condition()) return
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  throw new Error('Condition was not reached in time')
}

async function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  await once(child, 'exit')
}

class LocalScanner implements ProcessBatchScanner {
  readonly calls: string[] = []
  readonly processes = new Map<number, ProcessInfo>()
  readonly killGate = new Map<number, Promise<void>>()

  async getAll(): Promise<ProcessInfo[]> {
    this.calls.push('get-all')
    return [...this.processes.values()]
  }

  async lookupProcessByPid(pid: number): Promise<ProcessInfo | null> {
    this.calls.push(`lookup:${pid}`)
    return this.processes.get(pid) ?? null
  }

  async killProcess(pid: number): Promise<boolean> {
    this.calls.push(`kill:${pid}`)
    const gate = this.killGate.get(pid)
    if (gate) await gate
    try {
      process.kill(pid)
      return true
    } catch {
      return false
    }
  }
}

class LocalWindowManager implements ProcessBatchWindowManager {
  readonly calls: string[] = []
  windows: WindowInfo[] = []

  async scanWindows(includeSystemWindows = false): Promise<ServiceResult<WindowInfo[]>> {
    this.calls.push(`scan-windows:${includeSystemWindows}`)
    return { success: true, data: [...this.windows] }
  }

  async focusWindow(hwnd: number): Promise<ServiceResult> {
    this.calls.push(`focus:${hwnd}`)
    return { success: true }
  }

  async sendTextToWindow(hwnd: number, text: string): Promise<ServiceResult<{ characters: number; mode: string }>> {
    this.calls.push(`inject:${hwnd}:${text}`)
    return { success: true, data: { characters: Array.from(text).length, mode: 'sendinput' } }
  }
}

class InMemoryTagStore {
  readonly tags = new Map<string, ProcessTag>()

  get(exe: string, cwd?: string): ProcessTag | null {
    return this.tags.get(`${exe}|${cwd ?? ''}`) ?? null
  }

  set(input: { exe: string; cwd?: string; tag: string; color?: ProcessTag['color']; pinned?: boolean }): ProcessTag {
    const key = `${input.exe}|${input.cwd ?? ''}`
    const existing = this.tags.get(key)
    const tag: ProcessTag = {
      key,
      exe: input.exe,
      cwd: input.cwd,
      tag: input.tag,
      color: input.color,
      pinned: input.pinned ?? existing?.pinned ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now()
    }
    this.tags.set(key, tag)
    return tag
  }

  remove(exe: string, cwd?: string): { success: boolean; removed: number; key: string } {
    const key = `${exe}|${cwd ?? ''}`
    const success = this.tags.delete(key)
    return { success, removed: success ? 1 : 0, key }
  }
}

class LocalRuntimeService implements ProcessBatchRuntimeService {
  readonly calls: string[] = []

  async exportDiagnosticPack(input: unknown): Promise<unknown> {
    this.calls.push('diagnostic')
    return { packId: 'diagnostic-pack', input }
  }

  registerWatchdogInstance(input: Parameters<ProcessBatchRuntimeService['registerWatchdogInstance']>[0]): unknown {
    this.calls.push(`watchdog:${input.pid}:${input.tool}`)
    return { instanceId: input.instanceId, pid: input.pid, tool: input.tool }
  }
}

describe('ProcessBatchExecutor', () => {
  it('rejects destructive process actions until confirmed', () => {
    const scanner = new LocalScanner()
    const executor = new ProcessBatchExecutor(scanner, vi.fn())

    expect(() => executor.run(createRequest({
      action: 'kill',
      pids: [101, 102, 103, 104, 105, 106]
    }))).toThrow(/E_NEEDS_CONFIRM/)

    expect(() => executor.run(createRequest({
      action: 'inject-text',
      pids: [201],
      args: { text: 'hello' }
    }))).toThrow(/E_NEEDS_CONFIRM/)

    expect(() => executor.run(createRequest({
      action: 'add-watchdog',
      pids: [301]
    }))).toThrow(/E_NEEDS_CONFIRM/)
  })

  it('dispatches all six process actions through real adapters and publishes progress', async () => {
    const scanner = new LocalScanner()
    const windowManager = new LocalWindowManager()
    const tagStore = new InMemoryTagStore()
    const runtimeService = new LocalRuntimeService()
    const events = vi.fn()

    scanner.processes.set(4201, createProcessInfo({ pid: 4201, name: 'codex.exe', command: 'codex' }))
    windowManager.windows = [createWindowInfo({ pid: 4201, hwnd: 9001 })]

    const executor = new ProcessBatchExecutor(scanner, events, {
      windowManager,
      tagStore,
      runtimeService
    })

    const focus = executor.run(createRequest({ action: 'focus', pids: [4201] }))
    expect(await executor.waitForIdle(focus.jobId)).toMatchObject({ completed: 1, failed: 0, state: 'completed' })

    const inject = executor.run(createRequest({ action: 'inject-text', pids: [4201], args: { text: 'hello' }, confirmed: true }))
    expect(await executor.waitForIdle(inject.jobId)).toMatchObject({ completed: 1, failed: 0, state: 'completed' })

    const tag = executor.run(createRequest({ action: 'tag', pids: [4201], args: { tag: 'R8', color: 'info', pinned: true } }))
    expect(await executor.waitForIdle(tag.jobId)).toMatchObject({ completed: 1, failed: 0, state: 'completed' })

    const watchdog = executor.run(createRequest({ action: 'add-watchdog', pids: [4201], confirmed: true }))
    expect(await executor.waitForIdle(watchdog.jobId)).toMatchObject({ completed: 1, failed: 0, state: 'completed' })

    const diagnostic = executor.run(createRequest({ action: 'export-diag', pids: [4201] }))
    expect(await executor.waitForIdle(diagnostic.jobId)).toMatchObject({ completed: 1, failed: 0, state: 'completed' })

    const protectedKill = executor.run(createRequest({ action: 'kill', pids: [4], confirmed: true }))
    const protectedProgress = await executor.waitForIdle(protectedKill.jobId)
    expect(protectedProgress.results[0]).toMatchObject({ pid: 4, status: 'failed' })

    expect(windowManager.calls).toEqual(['scan-windows:false', 'focus:9001', 'scan-windows:false', 'inject:9001:hello'])
    expect(runtimeService.calls).toEqual(['watchdog:4201:codex', 'diagnostic'])
    expect(tagStore.get('codex.exe', 'D:/Desktop/CREATOR ONE')).toMatchObject({ tag: 'R8', pinned: true })
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ state: 'running' }))
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ state: 'completed' }))
  })

  it('uses an explicit hwnd to disambiguate multi-window process actions', async () => {
    const scanner = new LocalScanner()
    const windowManager = new LocalWindowManager()
    scanner.processes.set(4201, createProcessInfo({ pid: 4201 }))
    windowManager.windows = [
      createWindowInfo({ hwnd: 9001, pid: 4201, title: 'Main window' }),
      createWindowInfo({ hwnd: 9002, pid: 4201, title: 'Inject target' })
    ]

    const executor = new ProcessBatchExecutor(scanner, vi.fn(), { windowManager })
    const focus = executor.run(createRequest({ action: 'focus', args: { hwnd: 9002 }, pids: [4201] }))
    expect(await executor.waitForIdle(focus.jobId)).toMatchObject({ completed: 1, failed: 0, state: 'completed' })

    const inject = executor.run(createRequest({
      action: 'inject-text',
      args: { hwnd: 9002, text: 'hello' },
      confirmed: true,
      pids: [4201]
    }))
    expect(await executor.waitForIdle(inject.jobId)).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
    expect(windowManager.calls).toEqual(['scan-windows:false', 'focus:9002', 'scan-windows:false', 'inject:9002:hello'])
  })

  it('trusts an explicit hwnd when live scanning misses the target window', async () => {
    const scanner = new LocalScanner()
    const windowManager = new LocalWindowManager()
    scanner.processes.set(4201, createProcessInfo({ pid: 4201 }))
    windowManager.windows = []

    const executor = new ProcessBatchExecutor(scanner, vi.fn(), { windowManager })
    const inject = executor.run(createRequest({
      action: 'inject-text',
      args: { hwnd: 9003, text: 'hello' },
      confirmed: true,
      pids: [4201]
    }))

    const progress = await executor.waitForIdle(inject.jobId)

    expect(progress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
    expect(progress.results[0]).toMatchObject({ pid: 4201, status: 'ok' })
    expect(windowManager.calls).toEqual(['scan-windows:false', 'scan-windows:true', 'inject:9003:hello'])
  })

  it('terminates a real child process by PID without killing by process name', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'pipe'
    })

    if (typeof child.pid !== 'number') {
      throw new Error('child PID unavailable')
    }

    const scanner = new LocalScanner()
    scanner.processes.set(child.pid, createProcessInfo({
      pid: child.pid,
      name: 'node.exe',
      command: `${process.execPath} -e setInterval`,
      type: 'other'
    }))

    const executor = new ProcessBatchExecutor(scanner, vi.fn())
    const { jobId } = executor.run(createRequest({
      action: 'kill',
      pids: [child.pid],
      confirmed: true
    }))
    const progress = await executor.waitForIdle(jobId)
    await waitForExit(child)

    expect(progress).toMatchObject({ total: 1, completed: 1, failed: 0, state: 'completed' })
    expect(scanner.calls).toContain(`kill:${child.pid}`)
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true)
  })

  it('cancels queued PIDs without pretending running process kills were interrupted', async () => {
    const scanner = new LocalScanner()
    const gate = createDeferred()
    const events = vi.fn()
    for (let pid = 501; pid <= 506; pid += 1) {
      scanner.processes.set(pid, createProcessInfo({ pid, name: `node-${pid}.exe`, command: 'node', type: 'other' }))
      scanner.killGate.set(pid, gate.promise)
    }

    const executor = new ProcessBatchExecutor(scanner, events)
    const { jobId } = executor.run(createRequest({
      action: 'kill',
      pids: [501, 502, 503, 504, 505, 506],
      confirmed: true
    }))

    await waitForCondition(() => scanner.calls.filter(call => call.startsWith('kill:')).length === PROCESS_BATCH_LIMITS.PARALLEL)
    const cancelled = executor.cancel({ jobId, confirmedBy: 'test' })
    gate.resolve()
    const progress = await executor.waitForIdle(jobId)

    expect(cancelled).toEqual({ jobId, cancelled: true, skipped: 2 })
    expect(progress.state).toBe('cancelled')
    expect(progress.results.filter(result => result.status === 'skipped')).toHaveLength(2)
  })

  it('rolls back process tags during the five-second undo window', async () => {
    const scanner = new LocalScanner()
    const tagStore = new InMemoryTagStore()
    scanner.processes.set(7001, createProcessInfo({ pid: 7001, name: 'codex.exe' }))
    tagStore.set({ exe: 'codex.exe', cwd: 'D:/Desktop/CREATOR ONE', tag: 'old', color: 'steel' })

    const executor = new ProcessBatchExecutor(scanner, vi.fn(), { tagStore })
    const { jobId } = executor.run(createRequest({
      action: 'tag',
      pids: [7001],
      args: { tag: 'new', color: 'success' }
    }))
    await executor.waitForIdle(jobId)
    const undo = await executor.undo({ jobId, confirmedBy: 'test' })

    expect(undo).toMatchObject({ jobId, undone: 1 })
    expect(tagStore.get('codex.exe', 'D:/Desktop/CREATOR ONE')).toMatchObject({ tag: 'old', color: 'steel' })
  })
})
