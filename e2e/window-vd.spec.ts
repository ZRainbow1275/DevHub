import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import type { MoveWindowToDesktopResponse, MoveWindowToMonitorResponse, ThumbnailBatchResponse, WindowVdInfoResponse } from '@shared/schemas/r8-runtime'

const APP_MAIN = 'out/main/index.js'
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface LaunchResult {
  electronApp: ElectronApplication
  window: Page
}

interface WindowTarget {
  hwnd: number
  pid: number
  title: string
}

interface WindowProbe {
  directory: string
  process: ChildProcess
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
  try {
    await electronApp.evaluate(({ app }) => {
      app.quit()
    })
  } catch {
    // The app may already be closing.
  }

  await Promise.race([
    electronApp.close(),
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 8_000)
      timer.unref?.()
    })
  ]).catch(() => undefined)
}

function startWindowProbe(title: string): WindowProbe {
  const directory = join(tmpdir(), `devhub-r8b-spec11-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(directory, { recursive: true })
  const scriptPath = join(directory, 'probe.ps1')
  writeFileSync(scriptPath, [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    '$form = New-Object System.Windows.Forms.Form',
    `$form.Text = ${JSON.stringify(title)}`,
    '$form.Width = 560',
    '$form.Height = 360',
    '$form.StartPosition = "Manual"',
    '$form.Left = 160',
    '$form.Top = 160',
    '$label = New-Object System.Windows.Forms.Label',
    '$label.Dock = [System.Windows.Forms.DockStyle]::Fill',
    `$label.Text = ${JSON.stringify(`ASSERT_WINDOW_VD_NATIVE_COM ${title}`)}`,
    "$label.TextAlign = 'MiddleCenter'",
    "$label.Font = New-Object System.Drawing.Font('Consolas', 14)",
    '$form.Controls.Add($label)',
    '$form.Add_Shown({ $form.Activate() })',
    '[System.Windows.Forms.Application]::Run($form)',
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
    timeout: 120_000,
    windowsHide: false
  })
  return { directory, process: child, title }
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

async function stopWindowProbe(probe: WindowProbe | null): Promise<void> {
  if (!probe) return
  await stopChildProcess(probe.process)
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      rmSync(probe.directory, { recursive: true, force: true })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
}

async function scanWindowTarget(page: Page, title: string): Promise<WindowTarget | null> {
  return page.evaluate(async (windowTitle): Promise<WindowTarget | null> => {
    const scan = await window.devhub.windowManager.scan(false)
    return scan.data?.find(row => row.title === windowTitle) ?? null
  }, title)
}

test('R8.B spec-11 queries real Windows virtual desktop ids and returns truthful move responses', async () => {
  test.setTimeout(120_000)
  const title = `DevHub ASSERT_WINDOW_VD_NATIVE_COM probe ${Date.now()}`
  let electronApp: ElectronApplication | null = null
  let probe: WindowProbe | null = null

  try {
    probe = startWindowProbe(title)
    const launched = await launchApp()
    electronApp = launched.electronApp
    const { window } = launched

    let target: WindowTarget | null = null
    await expect.poll(async () => {
      target = await scanWindowTarget(window, title)
      return Boolean(target && target.hwnd > 0 && target.pid > 100)
    }, {
      message: 'wait for real virtual desktop probe window to enter WindowManager scan',
      timeout: 30_000,
      intervals: [500, 750, 1000]
    }).toBe(true)

    if (!target) {
      throw new Error('ASSERT_WINDOW_VD_NATIVE_COM target window was not resolved')
    }

    const monitors = await window.evaluate(async () => window.devhub.windowManager.getR8Monitors!())
    expect(monitors.monitors.length).toBeGreaterThan(0)
    expect(monitors.monitors.some(monitor => monitor.primary)).toBe(true)

    const vdInfo = await window.evaluate(async (hwnd): Promise<WindowVdInfoResponse> => {
      return window.devhub.windowManager.getWindowVdInfo!({ hwnds: [hwnd] })
    }, target.hwnd)
    expect(vdInfo.unavailableReason).toBeUndefined()
    expect(vdInfo.info).toHaveLength(1)
    expect(vdInfo.info[0]?.desktopId).toMatch(GUID_PATTERN)
    expect(vdInfo.info[0]?.monitorId).toBeGreaterThanOrEqual(0)

    const batch = await window.evaluate(async (hwnd): Promise<ThumbnailBatchResponse> => {
      return window.devhub.windowManager.getThumbnailsBatch!({
        hwnds: [hwnd],
        maxAgeMs: 0,
        thumbnailSize: { width: 240, height: 160 }
      })
    }, target.hwnd)
    expect(batch.entries[0]?.desktopId).toBe(vdInfo.info[0]?.desktopId)

    const monitorMove = await window.evaluate(async ({ hwnd, monitorId }): Promise<MoveWindowToMonitorResponse> => {
      return window.devhub.windowManager.moveToMonitor!({ hwnd, monitorId, confirmedBy: 'ASSERT_WINDOW_VD_NATIVE_COM' })
    }, { hwnd: target.hwnd, monitorId: monitors.monitors[0]?.id ?? 0 })
    expect(monitorMove.success).toBe(true)

    const desktopMove = await window.evaluate(async ({ hwnd, desktopId }): Promise<MoveWindowToDesktopResponse> => {
      return window.devhub.windowManager.moveToDesktop!({ hwnd, desktopId, confirmedBy: 'ASSERT_WINDOW_VD_NATIVE_COM' })
    }, { hwnd: target.hwnd, desktopId: vdInfo.info[0]?.desktopId ?? '' })
    if (!desktopMove.success) {
      expect(desktopMove.error).toMatch(/E_|HRESULT|Exception/)
    } else {
      expect(desktopMove.data?.desktopId).toBe(vdInfo.info[0]?.desktopId)
    }
  } finally {
    await stopWindowProbe(probe)
    if (electronApp) await closeElectronApp(electronApp)
  }
})
