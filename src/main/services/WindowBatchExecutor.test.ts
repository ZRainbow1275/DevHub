import { describe, expect, it, vi } from 'vitest'
import type { AIWindowAlias, ServiceResult, WindowInfo, WindowScreenshotResult } from '@shared/types-extended'
import {
  WINDOW_BATCH_LIMITS,
  windowBatchRequestSchema,
  type WindowBatchRequest
} from '@shared/schemas/r8-runtime'
import {
  WindowBatchExecutor,
  type WindowBatchWindowManager
} from './WindowBatchExecutor'

function createRequest(input: {
  action: WindowBatchRequest['action']
  hwnds: number[]
  args?: Record<string, unknown>
  confirmed?: boolean
  dryRun?: boolean
}): WindowBatchRequest {
  return windowBatchRequestSchema.parse({
    args: {},
    confirmed: false,
    dryRun: false,
    ...input
  })
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
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (condition()) return
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  throw new Error('Condition was not reached in time')
}

class FakeWindowManager implements WindowBatchWindowManager {
  readonly calls: string[] = []
  readonly failures = new Set<string>()
  windows: WindowInfo[] = []
  minimizeGate: Promise<void> | null = null

  async scanWindows(): Promise<ServiceResult<WindowInfo[]>> {
    this.calls.push('scan-windows')
    if (this.failures.has('scan-windows')) {
      return { success: false, error: 'scan failed' }
    }
    return { success: true, data: this.windows }
  }

  async focusWindow(hwnd: number): Promise<ServiceResult> {
    return this.record('focus', hwnd)
  }

  async minimizeWindow(hwnd: number): Promise<ServiceResult> {
    this.calls.push(`minimize:${hwnd}`)
    if (this.minimizeGate) {
      await this.minimizeGate
    }
    return this.result('minimize', hwnd)
  }

  async restoreWindow(hwnd: number): Promise<ServiceResult> {
    return this.record('restore', hwnd)
  }

  async closeWindow(hwnd: number): Promise<ServiceResult> {
    return this.record('close', hwnd)
  }

  async setWindowTopmost(hwnd: number, topmost: boolean): Promise<ServiceResult> {
    this.calls.push(`topmost:${hwnd}:${String(topmost)}`)
    return this.result('topmost', hwnd)
  }

  async screenshotWindow(hwnd: number): Promise<ServiceResult<WindowScreenshotResult>> {
    this.calls.push(`screenshot:${hwnd}`)
    if (this.failures.has(`screenshot:${hwnd}`)) {
      return { success: false, error: `screenshot failed ${hwnd}` }
    }
    return {
      success: true,
      data: {
        hwnd,
        path: `C:/tmp/window-${hwnd}.png`,
        directory: 'C:/tmp',
        width: 100,
        height: 80,
        createdAt: 1,
        source: 'win32-copy-from-screen'
      }
    }
  }

  async setWindowTitle(hwnd: number, title: string): Promise<ServiceResult> {
    this.calls.push(`title:${hwnd}:${title}`)
    return this.result('title', hwnd)
  }

  async sendKeysToWindow(hwnd: number, keys: string): Promise<ServiceResult> {
    this.calls.push(`keys:${hwnd}:${keys}`)
    return this.result('keys', hwnd)
  }

  async sendTextToWindow(hwnd: number, text: string): Promise<ServiceResult<{ characters: number; mode: 'sendinput' | 'wm-char' }>> {
    this.calls.push(`text:${hwnd}:${text}`)
    if (this.failures.has(`text:${hwnd}`)) {
      return { success: false, error: `text failed ${hwnd}` }
    }
    return { success: true, data: { characters: Array.from(text).length, mode: 'sendinput' } }
  }

  private record(action: string, hwnd: number): ServiceResult {
    this.calls.push(`${action}:${hwnd}`)
    return this.result(action, hwnd)
  }

  private result(action: string, hwnd: number): ServiceResult {
    if (this.failures.has(`${action}:${hwnd}`)) {
      return { success: false, error: `${action} failed ${hwnd}` }
    }
    return { success: true }
  }
}

class FakeAliasManager {
  readonly aliases: AIWindowAlias[] = []

  getAll(): AIWindowAlias[] {
    return [...this.aliases]
  }

  set(alias: AIWindowAlias): boolean {
    const index = this.aliases.findIndex(item => item.id === alias.id)
    if (index >= 0) this.aliases[index] = alias
    else this.aliases.push(alias)
    return true
  }

  remove(aliasId: string): boolean {
    const before = this.aliases.length
    const remaining = this.aliases.filter(alias => alias.id !== aliasId)
    this.aliases.splice(0, this.aliases.length, ...remaining)
    return remaining.length !== before
  }
}

class BatchedFocusWindowManager extends FakeWindowManager {
  async focusWindows(hwnds: readonly number[], intervalMs?: number): Promise<Array<{ hwnd: number; result: ServiceResult }>> {
    this.calls.push(`focus-batch:${hwnds.join(',')}:${String(intervalMs)}`)
    return hwnds.map(hwnd => ({ hwnd, result: this.failures.has(`focus:${hwnd}`) ? { success: false, error: `focus failed ${hwnd}` } : { success: true } }))
  }
}

function makeWindowInfo(patch: Partial<WindowInfo> = {}): WindowInfo {
  return {
    hwnd: 51,
    title: 'DevHub',
    processName: 'devhub.exe',
    pid: 5151,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 0, y: 0, width: 100, height: 80 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false,
    ...patch
  }
}

describe('WindowBatchExecutor', () => {
  it('runs HWND operations through a bounded queue and publishes real progress', async () => {
    const fakeWindowManager = new FakeWindowManager()
    fakeWindowManager.failures.add('minimize:12')
    const events = vi.fn()
    const executor = new WindowBatchExecutor(fakeWindowManager, events)

    const { jobId } = executor.run(createRequest({
      action: 'minimize',
      hwnds: [11, 12, 13],
      confirmed: true
    }))
    const progress = await executor.waitForIdle(jobId)

    expect(fakeWindowManager.calls).toEqual(['minimize:11', 'minimize:12', 'minimize:13'])
    expect(progress).toMatchObject({ total: 3, completed: 3, failed: 1, state: 'completed' })
    expect(progress.results.map(result => result.status)).toEqual(['ok', 'failed', 'ok'])
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ jobId, state: 'running' }))
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ jobId, state: 'completed' }))
  })

  it('rejects destructive close and inject requests until confirmed', () => {
    const executor = new WindowBatchExecutor(new FakeWindowManager(), vi.fn())

    expect(() => executor.run(createRequest({
      action: 'close',
      hwnds: [1, 2, 3, 4, 5, 6]
    }))).toThrow(/E_NEEDS_CONFIRM/)

    expect(() => executor.run(createRequest({
      action: 'inject-text',
      hwnds: [7],
      args: { keys: 'Enter' }
    }))).toThrow(/E_NEEDS_CONFIRM/)
  })

  it('uses the single batched focus bridge when available', async () => {
    const fakeWindowManager = new BatchedFocusWindowManager()
    fakeWindowManager.failures.add('focus:42')
    const events = vi.fn()
    const executor = new WindowBatchExecutor(fakeWindowManager, events)

    const { jobId } = executor.run(createRequest({
      action: 'focus',
      hwnds: [41, 42, 43],
      confirmed: true
    }))
    const progress = await executor.waitForIdle(jobId)

    expect(fakeWindowManager.calls).toEqual([`focus-batch:41,42,43:${WINDOW_BATCH_LIMITS.FOCUS_INTERVAL_MS}`])
    expect(progress).toMatchObject({ total: 3, completed: 3, failed: 1, state: 'completed' })
    expect(progress.results.map(result => result.status)).toEqual(['ok', 'failed', 'ok'])
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ jobId, state: 'completed' }))
  })

  it('cancels queued HWNDs without claiming running native calls were killed', async () => {
    const fakeWindowManager = new FakeWindowManager()
    const gate = createDeferred()
    fakeWindowManager.minimizeGate = gate.promise
    const executor = new WindowBatchExecutor(fakeWindowManager, vi.fn())

    const { jobId } = executor.run(createRequest({
      action: 'minimize',
      hwnds: [1, 2, 3, 4, 5, 6],
      confirmed: true
    }))

    await waitForCondition(() => fakeWindowManager.calls.filter(call => call.startsWith('minimize:')).length === 4)
    const cancelled = executor.cancel(jobId)
    gate.resolve()
    const progress = await executor.waitForIdle(jobId)

    expect(cancelled).toEqual({ jobId, cancelled: true, skipped: 2 })
    expect(progress.state).toBe('cancelled')
    expect(progress.results.filter(result => result.status === 'skipped')).toHaveLength(2)
    expect(progress.results.filter(result => result.status === 'ok')).toHaveLength(4)
  })

  it('restores minimized windows during the five-second undo window', async () => {
    const fakeWindowManager = new FakeWindowManager()
    const executor = new WindowBatchExecutor(fakeWindowManager, vi.fn())
    const { jobId } = executor.run(createRequest({
      action: 'minimize',
      hwnds: [21, 22],
      confirmed: true
    }))

    await executor.waitForIdle(jobId)
    const undo = await executor.undo(jobId)
    const progress = executor.getProgress(jobId)

    expect(undo.undone).toBe(2)
    expect(fakeWindowManager.calls).toEqual(['minimize:21', 'minimize:22', 'restore:21', 'restore:22'])
    expect(progress.results.map(result => result.status)).toEqual(['rolled-back', 'rolled-back'])
  })

  it('executes confirmed arbitrary text injection and safe key combos through real bridges', async () => {
    const fakeWindowManager = new FakeWindowManager()
    const executor = new WindowBatchExecutor(fakeWindowManager, vi.fn())
    const text = executor.run(createRequest({
      action: 'inject-text',
      hwnds: [31],
      args: { text: 'hello' },
      confirmed: true
    }))
    const safeKeys = executor.run(createRequest({
      action: 'inject-text',
      hwnds: [32],
      args: { keys: 'Enter' },
      confirmed: true
    }))

    const textProgress = await executor.waitForIdle(text.jobId)
    const safeKeysProgress = await executor.waitForIdle(safeKeys.jobId)

    expect(textProgress.results[0]).toMatchObject({ hwnd: 31, status: 'ok' })
    expect(safeKeysProgress.results[0]).toMatchObject({ hwnd: 32, status: 'ok' })
    expect(fakeWindowManager.calls).toContain('text:31:hello')
    expect(fakeWindowManager.calls).toContain('keys:32:Enter')
  })

  it('persists batch alias rename before applying the real window title', async () => {
    const fakeWindowManager = new FakeWindowManager()
    const aliasManager = new FakeAliasManager()
    fakeWindowManager.windows = [makeWindowInfo()]
    const executor = new WindowBatchExecutor(fakeWindowManager, vi.fn(), { aliasManager })

    const { jobId } = executor.run(createRequest({
      action: 'rename',
      hwnds: [51],
      args: { alias: 'Frontend', toolType: 'codex' },
      confirmed: true
    }))
    const progress = await executor.waitForIdle(jobId)

    expect(progress.results[0]).toMatchObject({ hwnd: 51, status: 'ok' })
    expect(fakeWindowManager.calls).toEqual(['scan-windows', 'title:51:Frontend'])
    expect(aliasManager.aliases).toHaveLength(1)
    expect(aliasManager.aliases[0]).toMatchObject({
      alias: 'Frontend',
      matchCriteria: {
        pid: 5151,
        titlePrefix: 'DevHub',
        executablePath: 'devhub.exe',
        toolType: 'codex'
      },
      autoGenerated: false,
      appliedExternalTitle: {
        hwnd: 51,
        originalTitle: 'DevHub',
        appliedTitle: 'Frontend'
      }
    })
  })

  it('rolls back persisted aliases when batch rename cannot apply the window title', async () => {
    const fakeWindowManager = new FakeWindowManager()
    const aliasManager = new FakeAliasManager()
    fakeWindowManager.windows = [makeWindowInfo({ hwnd: 52, pid: 5252 })]
    fakeWindowManager.failures.add('title:52')
    const executor = new WindowBatchExecutor(fakeWindowManager, vi.fn(), { aliasManager })

    const { jobId } = executor.run(createRequest({
      action: 'rename',
      hwnds: [52],
      args: { alias: 'Backend' },
      confirmed: true
    }))
    const progress = await executor.waitForIdle(jobId)

    expect(progress.results[0]).toMatchObject({
      hwnd: 52,
      status: 'failed',
      error: expect.stringContaining('E_WINDOW_SET_TITLE_FAILED')
    })
    expect(fakeWindowManager.calls).toEqual(['scan-windows', 'title:52:Backend'])
    expect(aliasManager.aliases).toEqual([])
  })

  it('requires explicit topmost target state instead of guessing OS toggle state', async () => {
    const fakeWindowManager = new FakeWindowManager()
    const updateTopmostState = vi.fn()
    const executor = new WindowBatchExecutor(fakeWindowManager, vi.fn(), { updateTopmostState })
    const missingState = executor.run(createRequest({
      action: 'aot-toggle',
      hwnds: [41],
      confirmed: true
    }))
    const explicitState = executor.run(createRequest({
      action: 'aot-toggle',
      hwnds: [42],
      args: { topmost: true },
      confirmed: true
    }))

    const missingProgress = await executor.waitForIdle(missingState.jobId)
    const explicitProgress = await executor.waitForIdle(explicitState.jobId)

    expect(missingProgress.results[0]).toMatchObject({
      hwnd: 41,
      status: 'failed',
      error: expect.stringContaining('args.topmost')
    })
    expect(explicitProgress.results[0]).toMatchObject({ hwnd: 42, status: 'ok' })
    expect(fakeWindowManager.calls).toContain('topmost:42:true')
    expect(updateTopmostState).toHaveBeenCalledWith(42, true)
  })

  it('moves selected HWNDs to a real virtual desktop through the registered adapter', async () => {
    const moveToDesktop = vi.fn(async (): Promise<ServiceResult<unknown>> => ({ success: true, data: { desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0' } }))
    const executor = new WindowBatchExecutor(new FakeWindowManager(), vi.fn(), { moveToDesktop })

    const { jobId } = executor.run(createRequest({
      action: 'move-to-desktop',
      hwnds: [501],
      args: { desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0' },
      confirmed: true
    }))
    const progress = await executor.waitForIdle(jobId)

    expect(progress.results[0]).toMatchObject({ hwnd: 501, status: 'ok' })
    expect(moveToDesktop).toHaveBeenCalledWith(501, '2439fd36-4943-43b0-aa9a-61dbf165add0')
  })
})
