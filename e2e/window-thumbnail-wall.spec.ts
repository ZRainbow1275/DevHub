import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import type { ThumbnailBatchResponse, ThumbnailGroupsResponse, ThumbnailWindowAliasResponse } from '@shared/schemas/r8-runtime'

const APP_MAIN = 'out/main/index.js'

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

function startWindowProbe(title: string): WindowProbe {
  const directory = join(tmpdir(), `devhub-r8b-spec09-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(directory, { recursive: true })
  const scriptPath = join(directory, 'probe.ps1')
  writeFileSync(scriptPath, [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    '$form = New-Object System.Windows.Forms.Form',
    `$form.Text = ${JSON.stringify(title)}`,
    '$form.Width = 640',
    '$form.Height = 420',
    '$label = New-Object System.Windows.Forms.Label',
    '$label.Dock = [System.Windows.Forms.DockStyle]::Fill',
    `$label.Text = ${JSON.stringify(`ASSERT_THUMBNAIL_WALL_GROUP_KEY ${title}`)}`,
    "$label.TextAlign = 'MiddleCenter'",
    "$label.Font = New-Object System.Drawing.Font('Consolas', 16)",
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

test('R8.B spec-09 ASSERT_THUMBNAIL_WALL_GROUP_KEY captures real window thumbnails and groups aliases', async () => {
  test.setTimeout(120_000)
  const suffix = String(Date.now())
  const title = `DevHub ASSERT_THUMBNAIL_WALL_GROUP_KEY probe ${suffix}`
  const alias = `Thumbnail Probe ${suffix}`
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
      message: 'wait for real thumbnail probe window to enter WindowManager scan',
      timeout: 30_000,
      intervals: [500, 750, 1000]
    }).toBe(true)

    if (!target) {
      throw new Error('ASSERT_THUMBNAIL_WALL_GROUP_KEY target window was not resolved')
    }

    const batch = await window.evaluate(async (hwnd): Promise<ThumbnailBatchResponse> => {
      return window.devhub.windowManager.getThumbnailsBatch!({
        hwnds: [hwnd],
        maxAgeMs: 0,
        thumbnailSize: { width: 240, height: 160 }
      })
    }, target.hwnd)

    expect(batch.source).toBe('win32-printwindow')
    expect(batch.captured).toBe(1)
    expect(batch.failed).toBe(0)
    expect(batch.entries[0]?.thumbnailDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(batch.entries[0]?.capturedAt).toBeGreaterThan(0)
    expect(batch.entries[0]?.groupId).toBe(batch.entries[0]?.fingerprintHash)

    const aliasResponse = await window.evaluate(async ({ hwnd, nextAlias }): Promise<ThumbnailWindowAliasResponse> => {
      return window.devhub.windowManager.setThumbnailAlias!({
        hwnd,
        alias: nextAlias,
        confirmedBy: 'ASSERT_THUMBNAIL_WALL_GROUP_KEY'
      })
    }, { hwnd: target.hwnd, nextAlias: alias })
    expect(aliasResponse).toMatchObject({ success: true, hwnd: target.hwnd, alias })

    const groups = await window.evaluate(async (): Promise<ThumbnailGroupsResponse> => {
      return window.devhub.windowManager.getThumbnailGroups!()
    })
    expect(groups.groups.some(group => group.alias === alias && group.members.includes(target!.hwnd))).toBe(true)
  } finally {
    await stopWindowProbe(probe)
    if (electronApp) await closeElectronApp(electronApp)
  }
})
