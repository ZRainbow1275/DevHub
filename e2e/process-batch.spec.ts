import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import type { ProcessBatchProgress, ProcessBatchRequest, ProcessBatchUndoResponse } from '@shared/schemas/r8-runtime'

const APP_MAIN = 'out/main/index.js'
const PROCESS_BATCH_TIMEOUT_MS = 30_000

interface LaunchResult {
  electronApp: ElectronApplication
  window: Page
}

interface RuntimeTestHooks {
  scanWindowsIntoCacheForTests: () => Promise<{
    data: Array<{
      hwnd: number
      pid: number
      title: string
    }>
    success: boolean
  }>
}

interface ProcessBatchWindowTarget {
  hwnd: number
  pid: number
  title: string
}

interface ProcessBatchWindowProbe {
  directory: string
  injectedPath: string
  process: ChildProcess
  resetPath: string
  title: string
}

async function launchApp(): Promise<LaunchResult> {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build before Electron E2E.`)
  }

  const electronApp = await electron.launch({ args: [APP_MAIN] })
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const mainWindow = electronApp.windows().find((page) =>
      page.url().includes('/out/renderer/index.html')
      || page.url().includes('/out/renderer/index.html'.replace(/\//g, '\\'))
    )
    if (mainWindow) {
      await mainWindow.waitForLoadState('domcontentloaded')
      return { electronApp, window: mainWindow }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  await closeElectronApp(electronApp)
  throw new Error('Timed out while waiting for DevHub main window')
}

async function closeElectronApp(electronApp: ElectronApplication): Promise<void> {
  const closePromise = new Promise<void>((resolve) => {
    electronApp.once('close', () => {
      resolve()
    })
  })

  const waitForClose = async (timeoutMs: number): Promise<boolean> => {
    const timeoutPromise = new Promise<false>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs)
      timer.unref?.()
    })

    return Promise.race([
      closePromise.then(() => true),
      timeoutPromise
    ])
  }

  try {
    await electronApp.evaluate(({ app }) => {
      app.quit()
    })
  } catch {
    // The main process may already be closing; fall back to process cleanup below.
  }

  if (await waitForClose(8_000)) {
    return
  }

  const electronProcess = electronApp.process()
  if (electronProcess.exitCode !== null || electronProcess.signalCode !== null) {
    return
  }

  const processExitPromise = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 8_000)
    timer.unref?.()
    electronProcess.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })

  if (electronProcess.pid && process.platform === 'win32') {
    try {
      execFileSync('taskkill.exe', ['/PID', String(electronProcess.pid), '/T', '/F'], {
        stdio: 'ignore',
        timeout: 5_000,
        windowsHide: true
      })
    } catch {
      try {
        electronProcess.kill()
      } catch {
        // The process may already be gone; fall through to the final wait.
      }
    }
  } else {
    try {
      electronProcess.kill()
    } catch {
      // The process may already be gone; fall through to the final wait.
    }
  }

  if (await Promise.race([waitForClose(8_000), processExitPromise])) {
    return
  }

  throw new Error('Timed out while closing Electron app process')
}

function startWindowProbe(title: string): ProcessBatchWindowProbe {
  const directory = join(tmpdir(), `devhub-r8b-spec12-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(directory, { recursive: true })
  const injectedPath = join(directory, 'injected.txt')
  const resetPath = join(directory, 'reset.txt')
  const scriptPath = join(directory, 'probe.ps1')
  writeFileSync(scriptPath, [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    `[System.Windows.Forms.Application]::EnableVisualStyles()`,
    `$form = New-Object System.Windows.Forms.Form`,
    `$form.Text = ${JSON.stringify(title)}`,
    `$form.Width = 560`,
    `$form.Height = 320`,
    `$form.ImeMode = [System.Windows.Forms.ImeMode]::Disable`,
    `$text = New-Object System.Windows.Forms.TextBox`,
    `$text.Multiline = $true`,
    `$text.Dock = [System.Windows.Forms.DockStyle]::Fill`,
    `$text.Font = New-Object System.Drawing.Font('Consolas', 12)`,
    `$text.AcceptsReturn = $true`,
    `$text.ImeMode = [System.Windows.Forms.ImeMode]::Disable`,
    `$text.ShortcutsEnabled = $true`,
    `$out = ${JSON.stringify(injectedPath)}`,
    `$reset = ${JSON.stringify(resetPath)}`,
    `$text.Add_TextChanged({ [System.IO.File]::WriteAllText($out, $text.Text, [System.Text.Encoding]::UTF8) })`,
    `$timer = New-Object System.Windows.Forms.Timer`,
    `$timer.Interval = 100`,
    `$timer.Add_Tick({`,
    `  if ([System.IO.File]::Exists($reset)) {`,
    `    [System.IO.File]::Delete($reset)`,
    `    $text.Clear()`,
    `    [System.IO.File]::WriteAllText($out, $text.Text, [System.Text.Encoding]::UTF8)`,
    `  }`,
    `})`,
    `$timer.Start()`,
    `$form.Controls.Add($text)`,
    `$form.Add_Shown({ $form.Activate(); $text.Focus() })`,
    `[System.Windows.Forms.Application]::Run($form)`,
    ''
  ].join('\n'), 'utf8')

  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-Sta',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath
  ], {
    cwd: directory,
    stdio: 'ignore',
    windowsHide: false
  })
  return { directory, injectedPath, process: child, resetPath, title }
}

function spawnKillProbe(label: string): ChildProcess {
  return spawn(process.execPath, [
    '-e',
    'setInterval(() => {}, 1000)',
    label
  ], {
    stdio: 'ignore',
    windowsHide: true
  })
}

async function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

async function stopChildProcess(child: ChildProcess | null): Promise<void> {
  if (!child) return
  const pid = child.pid
  if (child.exitCode === null && child.signalCode === null) {
    child.kill()
    await waitForChildExit(child, 2_000)
  }
  if (pid && child.exitCode === null && child.signalCode === null && process.platform === 'win32') {
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        timeout: 5_000,
        windowsHide: true
      })
      await waitForChildExit(child, 2_000)
    } catch {
      // The process may have exited between the bounded wait and taskkill.
    }
  }
}

function isRetryableRemoveError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  const code = String((error as { code?: unknown }).code)
  return code === 'EBUSY' || code === 'ENOTEMPTY' || code === 'EPERM'
}

async function removeDirectoryWithRetry(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      rmSync(directory, { recursive: true, force: true })
      return
    } catch (error) {
      if (!isRetryableRemoveError(error) || attempt === 5) return
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
}

async function stopWindowProbe(probe: ProcessBatchWindowProbe | null): Promise<void> {
  if (!probe) return
  await stopChildProcess(probe.process)
  await removeDirectoryWithRetry(probe.directory)
}

async function resetWindowProbeText(probe: ProcessBatchWindowProbe): Promise<void> {
  writeFileSync(probe.resetPath, String(Date.now()), 'utf8')
  await expect.poll(async () => existsSync(probe.resetPath), {
    message: 'wait for WinForms probe reset marker to be consumed',
    timeout: 5_000,
    intervals: [100, 150, 250]
  }).toBe(false)
  await expect.poll(async () => {
    return existsSync(probe.injectedPath)
      ? readFileSync(probe.injectedPath, 'utf8').replace(/^\uFEFF/, '')
      : ''
  }, {
    message: 'wait for WinForms probe textbox to be empty before process batch injection',
    timeout: 5_000,
    intervals: [100, 150, 250]
  }).toBe('')
}

async function scanWindowTarget(electronApp: ElectronApplication, title: string): Promise<ProcessBatchWindowTarget | null> {
  return electronApp.evaluate(async (_, windowTitle): Promise<ProcessBatchWindowTarget | null> => {
    const hooks = (globalThis as typeof globalThis & {
      __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
    }).__DEVHUB_TEST_HOOKS__
    if (!hooks) {
      throw new Error('Runtime test hooks are not available for ASSERT_PROCESS_BATCH_6_OPS')
    }
    const scan = await hooks.scanWindowsIntoCacheForTests()
    return scan.data.find(row => row.title === windowTitle) ?? null
  }, title)
}

async function runProcessBatch(page: Page, request: ProcessBatchRequest): Promise<ProcessBatchProgress> {
  return page.evaluate(async ({ batchRequest, timeoutMs }): Promise<ProcessBatchProgress> => {
    const extractJobId = (value: unknown): string => {
      if (typeof value === 'object' && value !== null) {
        const directJobId = (value as { jobId?: unknown }).jobId
        if (typeof directJobId === 'string' && directJobId.length > 0) return directJobId
        const data = (value as { data?: unknown }).data
        if (typeof data === 'object' && data !== null) {
          const nestedJobId = (data as { jobId?: unknown }).jobId
          if (typeof nestedJobId === 'string' && nestedJobId.length > 0) return nestedJobId
        }
      }
      throw new Error(`Process batch start response did not include jobId: ${JSON.stringify(value)}`)
    }
    const progressEvents: ProcessBatchProgress[] = []
    const unsubscribe = window.devhub.systemProcess.onBatchProgress((progress) => {
      progressEvents.push(progress)
    })

    try {
      const started = await window.devhub.systemProcess.batchOp(batchRequest)
      const jobId = extractJobId(started)
      return await new Promise<ProcessBatchProgress>((resolve, reject) => {
        const handles: { interval?: number; timeout?: number } = {}
        handles.timeout = window.setTimeout(() => {
          if (handles.interval !== undefined) window.clearInterval(handles.interval)
          reject(new Error(`Timed out waiting for process batch ${jobId}`))
        }, timeoutMs)
        handles.interval = window.setInterval(() => {
          const latest = [...progressEvents].reverse().find(progress => progress.jobId === jobId)
          if (latest && latest.state !== 'running') {
            if (handles.timeout !== undefined) window.clearTimeout(handles.timeout)
            if (handles.interval !== undefined) window.clearInterval(handles.interval)
            resolve(latest)
          }
        }, 50)
      })
    } finally {
      unsubscribe()
    }
  }, { batchRequest: request, timeoutMs: PROCESS_BATCH_TIMEOUT_MS })
}

async function undoProcessBatch(page: Page, jobId: string): Promise<ProcessBatchUndoResponse> {
  return page.evaluate(async (batchJobId): Promise<ProcessBatchUndoResponse> => {
    return window.devhub.systemProcess.batchUndo(batchJobId, 'ASSERT_PROCESS_BATCH_6_OPS')
  }, jobId)
}

function expectSingleSuccess(progress: ProcessBatchProgress): void {
  const diagnostic = JSON.stringify(progress, null, 2)
  if (
    progress.state !== 'completed'
    || progress.completed !== 1
    || progress.failed !== 0
    || progress.results.length !== 1
    || progress.results[0]?.status !== 'ok'
  ) {
    throw new Error(`Expected one successful process batch result, received:\n${diagnostic}`)
  }
  expect(progress.state).toBe('completed')
  expect(progress.completed).toBe(1)
  expect(progress.failed).toBe(0)
  expect(progress.results).toHaveLength(1)
  expect(progress.results[0]?.status).toBe('ok')
}

test('R8.B spec-12 ASSERT_PROCESS_BATCH_6_OPS covers real process batch IPC paths', async () => {
  test.setTimeout(180_000)
  const suffix = String(Date.now())
  const title = `DevHub ASSERT_PROCESS_BATCH_6_OPS probe ${suffix}`
  const injectedText = `ASSERT_PROCESS_BATCH_6_OPS_TEXT_${suffix}`
  let electronApp: ElectronApplication | null = null
  let windowProbe: ProcessBatchWindowProbe | null = null
  let killProbe: ChildProcess | null = null

  try {
    windowProbe = startWindowProbe(title)
    killProbe = spawnKillProbe(`devhub-process-batch-kill-${suffix}`)
    const killPid = killProbe.pid ?? 0
    expect(killPid).toBeGreaterThan(100)

    const launched = await launchApp()
    electronApp = launched.electronApp
    const { window } = launched

    let target: ProcessBatchWindowTarget | null = null
    await expect.poll(async () => {
      target = await scanWindowTarget(electronApp!, title)
      return Boolean(target && target.pid > 100 && target.hwnd > 0)
    }, {
      message: 'wait for real process batch probe window to enter WindowManager scan',
      timeout: 30_000,
      intervals: [500, 750, 1000]
    }).toBe(true)

    await expect.poll(async () => {
      return window.evaluate(async (pid) => {
        const scan = await window.devhub.systemProcess.scan()
        return Boolean(scan.data?.some(processInfo => processInfo.pid === pid))
      }, killPid)
    }, {
      message: 'wait for real kill probe PID to enter SystemProcessScanner scan',
      timeout: 30_000,
      intervals: [500, 750, 1000]
    }).toBe(true)

    if (!target) {
      throw new Error('ASSERT_PROCESS_BATCH_6_OPS target window was not resolved')
    }

    const focusProgress = await runProcessBatch(window, {
      action: 'focus',
      args: { hwnd: target.hwnd },
      confirmed: true,
      pids: [target.pid]
    })
    expectSingleSuccess(focusProgress)
    await resetWindowProbeText(windowProbe)
    const injectProgress = await runProcessBatch(window, {
      action: 'inject-text',
      args: { hwnd: target.hwnd, text: injectedText },
      confirmed: true,
      pids: [target.pid]
    })
    expectSingleSuccess(injectProgress)
    await expect.poll(async () => {
      return existsSync(windowProbe!.injectedPath)
        ? readFileSync(windowProbe!.injectedPath, 'utf8').replace(/^\uFEFF/, '')
        : ''
    }, {
      message: 'wait for real WinForms textbox to receive process batch injected text',
      timeout: 15_000,
      intervals: [250, 500, 750]
    }).toBe(injectedText)

    const tagProgress = await runProcessBatch(window, {
      action: 'tag',
      args: { color: 'accent', pinned: true, tag: `spec12-${suffix}` },
      confirmed: true,
      pids: [target.pid]
    })
    const undo = await undoProcessBatch(window, tagProgress.jobId)
    const watchdogProgress = await runProcessBatch(window, {
      action: 'add-watchdog',
      args: { actionPolicy: 'log-only', mode: 'lenient', tool: 'codex' },
      confirmed: true,
      pids: [target.pid]
    })
    const diagnosticProgress = await runProcessBatch(window, {
      action: 'export-diag',
      confirmed: true,
      pids: [target.pid]
    })
    const killProgress = await runProcessBatch(window, {
      action: 'kill',
      confirmed: true,
      pids: [killPid]
    })

    expectSingleSuccess(tagProgress)
    expect(undo.undone).toBe(1)
    expect(undo.results[0]?.status).toBe('rolled-back')
    expectSingleSuccess(watchdogProgress)
    expectSingleSuccess(diagnosticProgress)
    expectSingleSuccess(killProgress)
    expect(await waitForChildExit(killProbe, 10_000)).toBe(true)
    killProbe = null

    const actionSummary = [
      focusProgress,
      injectProgress,
      tagProgress,
      watchdogProgress,
      diagnosticProgress,
      killProgress
    ].map(progress => progress.results[0]?.status)
    expect(actionSummary).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok'])
  } finally {
    await stopChildProcess(killProbe)
    await stopWindowProbe(windowProbe)
    if (electronApp) {
      await closeElectronApp(electronApp)
    }
  }
})
