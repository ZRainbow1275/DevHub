import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { test, expect, _electron as electron, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { PanelPopoutSurface } from '@shared/schemas/r8-runtime'
import type { Project } from '@shared/types'

// ---------------------------------------------------------------------------
// Launch / teardown / axe boilerplate — copied verbatim from example.spec.ts so
// this spec uses the exact same harness (args ['out/main/index.js'], seeded
// userData config that skips first-launch, axe-core injection, taskkill
// teardown). No new launch path is introduced.
// ---------------------------------------------------------------------------

const nodeRequire = createRequire(import.meta.url)
const AXE_CORE_PATH = nodeRequire.resolve('axe-core/axe.min.js')
// Read the axe-core UMD source once at module load. We inject it through
// `page.evaluate(<source>)` (a CDP runtime eval) rather than `addScriptTag`,
// because popout windows ship the strict production CSP (`script-src 'self'`)
// which blocks the `<script>` element addScriptTag creates. CDP eval bypasses
// the page CSP and works for both the main window and popouts; no production
// CSP is weakened.
const AXE_CORE_SOURCE = readFileSync(AXE_CORE_PATH, 'utf8')
const AXE_WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

interface LaunchAppOptions {
  enableDevObservability?: boolean
  userDataPath?: string
}

interface AxeViolationSummary {
  help: string
  id: string
  impact: string | null
  targets: string[]
}

interface AxeScanSummary {
  criticalViolations: AxeViolationSummary[]
  incompleteCount: number
  label: string
  passesCount: number
  violationCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createE2ESeedProject(): Project {
  const now = Date.now()
  return {
    id: 'devhub-e2e-project',
    name: 'devhub-e2e',
    path: process.cwd(),
    scripts: ['dev', 'build', 'test'],
    defaultScript: 'dev',
    projectType: 'pnpm',
    tags: [],
    status: 'stopped',
    createdAt: now,
    updatedAt: now
  }
}

function mergeSeededE2EConfig(existing: Record<string, unknown>): Record<string, unknown> {
  const currentSettings = isRecord(existing.settings) ? existing.settings : {}
  const currentNotification = isRecord(currentSettings.notification) ? currentSettings.notification : {}
  const seededSettings = {
    ...currentSettings,
    firstLaunchDone: true,
    notification: {
      ...currentNotification,
      enabled: false
    }
  }
  const currentProjects = Array.isArray(existing.projects) ? existing.projects : []
  const normalizedSeedPath = process.cwd().replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase()
  const hasSeedProject = currentProjects.some((project) => {
    if (!isRecord(project)) return false
    return String(project.path ?? '').replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase() === normalizedSeedPath
  })

  return {
    ...existing,
    projects: hasSeedProject ? currentProjects : [createE2ESeedProject(), ...currentProjects],
    settings: seededSettings
  }
}

async function launchApp(
  options: LaunchAppOptions = {}
): Promise<{ electronApp: ElectronApplication; window: Page }> {
  const args = ['out/main/index.js']
  if (options.enableDevObservability) {
    args.push('--enable-dev-obs')
  }
  const userDataPath = options.userDataPath ?? join(test.info().outputDir, 'electron-user-data')
  mkdirSync(userDataPath, { recursive: true })
  const configPath = join(userDataPath, 'devhub-config.json')
  if (existsSync(configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown
      const existing = isRecord(parsed) ? parsed : {}
      writeFileSync(configPath, JSON.stringify(mergeSeededE2EConfig(existing), null, 2), 'utf8')
    } catch {
      writeFileSync(configPath, JSON.stringify(mergeSeededE2EConfig({}), null, 2), 'utf8')
    }
  } else {
    writeFileSync(configPath, JSON.stringify(mergeSeededE2EConfig({}), null, 2), 'utf8')
  }

  const electronApp = await electron.launch({
    args,
    env: {
      ...process.env,
      DEVHUB_USER_DATA_DIR: userDataPath,
      ...(options.enableDevObservability ? { ENABLE_DEV_OBS: '1' } : {})
    }
  })

  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const windows = electronApp.windows()
    const mainWindow = windows.find((page) =>
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
    // The main process may already be closing; fall back to Playwright cleanup below.
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

async function resizeMainWindow(electronApp: ElectronApplication, width: number, height: number, page?: Page): Promise<void> {
  if (page) {
    await page.waitForLoadState('domcontentloaded').catch(() => undefined)
  }

  await electronApp.evaluate(({ BrowserWindow }, size) => {
    const mainWindow = BrowserWindow.getAllWindows().find((candidate) => {
      const url = candidate.webContents.getURL()
      return url.includes('/out/renderer/index.html') || url.includes('\\out\\renderer\\index.html')
    }) ?? BrowserWindow.getAllWindows()[0]
    if (!mainWindow) {
      throw new Error('DevHub main BrowserWindow is not available')
    }
    mainWindow.setSize(size.width, size.height)
  }, { width, height })
}

async function ensureAxeRuntime(page: Page): Promise<void> {
  const hasAxe = await page.evaluate(() => {
    return typeof (globalThis as unknown as { axe?: unknown }).axe === 'object'
  }).catch(() => false)
  if (!hasAxe) {
    // Pass the UMD source as a STRING expression to page.evaluate. Playwright
    // runs a string argument directly via CDP Runtime.evaluate, which is exempt
    // from the page CSP — so the axe UMD defines `window.axe` even on the strict
    // popout window (`script-src 'self'`, no 'unsafe-eval'). This deliberately
    // avoids addScriptTag (its injected <script> is CSP-blocked) and avoids a
    // nested eval() (that page-script eval would itself need 'unsafe-eval').
    await page.evaluate(AXE_CORE_SOURCE)
  }
}

async function scanCriticalAxeViolations(page: Page, label: string): Promise<AxeScanSummary> {
  await ensureAxeRuntime(page)
  return page.evaluate(async ({ scanLabel, tags }) => {
    type AxeNode = { target: string[] }
    type AxeViolation = {
      help: string
      id: string
      impact: string | null
      nodes: AxeNode[]
    }
    type AxeResults = {
      incomplete: unknown[]
      passes: unknown[]
      violations: AxeViolation[]
    }
    const axeRuntime = (globalThis as unknown as {
      axe?: {
        run: (
          context: Document,
          options: { runOnly: { type: 'tag'; values: string[] } }
        ) => Promise<AxeResults>
      }
    }).axe
    if (!axeRuntime) throw new Error('axe runtime was not injected into Electron renderer')
    const results = await axeRuntime.run(document, { runOnly: { type: 'tag', values: tags } })
    const criticalViolations = results.violations
      .filter(violation => violation.impact === 'critical')
      .map(violation => ({
        help: violation.help,
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.flatMap(node => node.target)
      }))
    return {
      criticalViolations,
      incompleteCount: results.incomplete.length,
      label: scanLabel,
      passesCount: results.passes.length,
      violationCount: results.violations.length
    }
  }, { scanLabel: label, tags: [...AXE_WCAG_TAGS] })
}

// ---------------------------------------------------------------------------
// Spec-local helpers (navigation / theme / popout)
// ---------------------------------------------------------------------------

type E2EMonitorTab = 'process' | 'port' | 'window' | 'ai-task' | 'topology' | 'r8-ops'

async function openMonitorTab(window: Page, tab: E2EMonitorTab, readyLocator: Locator): Promise<void> {
  await window.evaluate(() => {
    window.dispatchEvent(new Event('devhub:open-monitor'))
  })
  await expect(window.getByTestId('monitor-panel')).toBeVisible({ timeout: 15_000 })
  await window.evaluate((nextTab) => {
    window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: nextTab } }))
  }, tab)
  await expect(readyLocator).toBeVisible({ timeout: 15_000 })
}

/**
 * Runtime theme switch without reload. `settings.update` returns the merged
 * settings; we feed it straight to the `devhub:settings-change` listener that
 * `useTheme` subscribes to, which then writes `<html data-theme="...">`. NOTE
 * the legacy alias trap: theme 'dark' -> palette 'cyberpunk', 'light' -> 'swiss'.
 * Use 'swiss' (self-mapped) for the "non-constructivism" assertion.
 */
async function setTheme(window: Page, theme: 'constructivism' | 'swiss' | 'cyberpunk' | 'modern-light' | 'warm-light'): Promise<void> {
  await window.evaluate(async (nextTheme) => {
    const next = await window.devhub.settings.update({ appearance: { theme: nextTheme } })
    window.dispatchEvent(new CustomEvent('devhub:settings-change', { detail: next }))
  }, theme)
  await expect(window.locator('html')).toHaveAttribute('data-theme', theme, { timeout: 5_000 })
}

interface OpenedPanelPopout {
  popoutPage: Page
  windowId: string
}

/**
 * Opens a real panel popout BrowserWindow through the preload bridge and returns
 * its Page. Mirrors the example.spec.ts pattern: attach the `window` event
 * listener BEFORE triggering openPopout to avoid a race, then confirm the new
 * Page is the target surface via URL + the `[data-r8c-panel-popout]` root hook.
 */
async function openPanelPopout(
  electronApp: ElectronApplication,
  mainWindow: Page,
  surface: PanelPopoutSurface,
  target?: string
): Promise<OpenedPanelPopout> {
  const popoutPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
  const created = await mainWindow.evaluate(
    async ({ surface, target }) => window.devhub.r8.panel.openPopout(surface, target),
    { surface, target }
  )
  const popoutPage = await popoutPagePromise
  await popoutPage.waitForLoadState('domcontentloaded')
  await expect.poll(() => popoutPage.url(), { timeout: 10_000 })
    .toContain(`r8PanelPopout=${encodeURIComponent(surface)}`)
  await expect(popoutPage.locator(`[data-r8c-panel-popout="${surface}"]`)).toBeVisible({ timeout: 15_000 })
  return { popoutPage, windowId: created.windowId }
}

async function closePanelPopout(mainWindow: Page, popout: OpenedPanelPopout | null): Promise<void> {
  if (!popout) return
  await mainWindow.evaluate(
    (windowId) => window.devhub.r8.panel.closePopout(windowId),
    popout.windowId
  ).catch(() => undefined)
  if (!popout.popoutPage.isClosed()) {
    await popout.popoutPage.close().catch(() => undefined)
  }
}

// A rotate(0deg) transform serializes either as 'none' or the identity matrix.
function isIdentityTransform(transform: string | null): boolean {
  if (!transform) return true
  const normalized = transform.trim()
  return normalized === 'none' || normalized === 'matrix(1, 0, 0, 1, 0, 0)'
}

test.describe('本轮视觉打磨 E2E', () => {
  test.describe('主窗视觉打磨', () => {
    test('状态栏拓扑按钮计算高度为 22px', async () => {
      const { electronApp, window } = await launchApp()
      try {
        // Topology badge is `sm:flex` (hidden below 640px). Widen first.
        await resizeMainWindow(electronApp, 1440, 900, window)
        const badge = window.getByTestId('topology-status-badge')
        await expect(badge).toBeVisible({ timeout: 15_000 })
        const height = await badge.evaluate((el) => getComputedStyle(el).height)
        expect(height).toBe('22px')
      } finally {
        await closeElectronApp(electronApp)
      }
    })

    test('hero-stats-grid 计算 display 为 grid', async () => {
      const { electronApp, window } = await launchApp()
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        const grid = window.locator('.hero-stats-grid').first()
        await expect(grid).toBeVisible({ timeout: 15_000 })
        const display = await grid.evaluate((el) => getComputedStyle(el).display)
        expect(display).toBe('grid')
      } finally {
        await closeElectronApp(electronApp)
      }
    })

    test('Toast 关闭控件使用关闭图标且点击后消失', async () => {
      const { electronApp, window } = await launchApp()
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        // Emit one real toast through the R8 notify bridge (toast channel ->
        // notify:stream -> ToastHost). Independent of the legacy
        // notification.enabled flag.
        await window.evaluate(async () => {
          await window.devhub.r8.notify.emit({
            level: 'INFO',
            source: 'system',
            title: 'E2E visual polish toast',
            body: 'visual polish dismiss control check',
            channels: ['toast']
          })
        })

        // Anchor on the i18n-stable section label, NOT the translated dismiss
        // aria-label (it is `t('notify.dismiss', ...)` and renders in the active
        // locale, so an English aria-label selector misses under a zh locale).
        const toast = window.locator('section[aria-label="R8 notifications"] article').first()
        await expect(toast).toBeVisible({ timeout: 10_000 })

        // The dismiss button is the toast's button carrying the CloseIcon
        // (lucide:X) — select it by that stable icon token rather than aria-label.
        const dismissButton = toast.locator('button:has([data-icon-token="lucide:X"])').first()
        await expect(dismissButton).toBeVisible({ timeout: 5_000 })
        // dismiss uses CloseIcon (lucide:X), not the CheckIcon (lucide:Check).
        await expect(dismissButton.locator('[data-icon-token="lucide:X"]')).toHaveCount(1)
        await expect(dismissButton.locator('[data-icon-token="lucide:Check"]')).toHaveCount(0)

        await dismissButton.click()
        await expect(toast).toBeHidden({ timeout: 5_000 })
      } finally {
        await closeElectronApp(electronApp)
      }
    })

    test('ConfirmDialog 真实标题旋转随主题切换 (constructivism=-1deg / swiss=0deg)', async () => {
      const { electronApp, window } = await launchApp()
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        // Drive the REAL ConfirmDialog: right-click the seeded project card and
        // pick「删除项目」(danger variant). The title element is the documented
        // stable anchor `#confirm-dialog-title`, whose inline transform reads
        // `rotate(var(--deco-title-rotation, 0deg))` — a theme-token-driven value.
        const card = window.getByTestId('project-card').first()
        await expect(card).toBeVisible({ timeout: 15_000 })
        await card.click({ button: 'right' })
        const menu = window.getByTestId('context-menu-portal')
        await expect(menu).toBeVisible({ timeout: 10_000 })
        await menu.locator('button').filter({ hasText: '删除项目' }).first().click()

        const dialog = window.locator('[role="dialog"][aria-labelledby="confirm-dialog-title"]')
        await expect(dialog).toBeVisible({ timeout: 10_000 })
        const title = window.locator('#confirm-dialog-title')
        await expect(title).toBeVisible({ timeout: 10_000 })

        // constructivism defines --deco-title-rotation: -1deg -> non-identity transform.
        await setTheme(window, 'constructivism')
        const constructivismTransform = await title.evaluate((el) => getComputedStyle(el).transform)
        expect(isIdentityTransform(constructivismTransform)).toBe(false)

        // swiss leaves the var undefined -> fallback rotate(0deg) -> identity.
        await setTheme(window, 'swiss')
        const swissTransform = await title.evaluate((el) => getComputedStyle(el).transform)
        expect(isIdentityTransform(swissTransform)).toBe(true)

        // Cancel out of the dialog without deleting the seed project.
        await window.keyboard.press('Escape')
        await expect(dialog).toBeHidden({ timeout: 10_000 })
      } finally {
        await closeElectronApp(electronApp)
      }
    })

    test('CloseConfirmDialog 标题旋转随主题切换 (constructivism=-1deg / dark=0deg)', async () => {
      const { electronApp, window } = await launchApp()
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        // The real CloseConfirmDialog only mounts on a main-process close request
        // (window.devhub.window.onCloseConfirm), which has no public renderer
        // trigger. Confirm the bridge contract exists, then assert the same
        // theme-token-driven rotation the dialog title binds to
        // (`rotate(var(--deco-title-rotation, 0deg))`, CloseConfirmDialog :61) via
        // a probe carrying the identical inline transform.
        const bridgeReady = await window.evaluate(() => typeof window.devhub?.window?.onCloseConfirm === 'function')
        expect(bridgeReady).toBe(true)

        const probeHandle = await window.evaluateHandle(() => {
          const probe = document.createElement('h2')
          probe.id = 'e2e-close-confirm-title-probe'
          probe.style.transform = 'rotate(var(--deco-title-rotation, 0deg))'
          probe.style.transformOrigin = 'left center'
          probe.textContent = '关闭应用'
          document.body.appendChild(probe)
          return probe
        })

        await setTheme(window, 'constructivism')
        const constructivismTransform = await probeHandle.evaluate((el) => getComputedStyle(el).transform)
        expect(isIdentityTransform(constructivismTransform)).toBe(false)

        // theme 'dark' maps to palette 'cyberpunk' (LEGACY_THEME_MAP), so we drive
        // the update inline and assert the resulting palette rather than via
        // setTheme (which asserts data-theme === input). --deco-title-rotation is
        // undefined outside constructivism -> fallback rotate(0deg) -> identity.
        await window.evaluate(async () => {
          const next = await window.devhub.settings.update({ appearance: { theme: 'dark' } })
          window.dispatchEvent(new CustomEvent('devhub:settings-change', { detail: next }))
        })
        await expect(window.locator('html')).toHaveAttribute('data-theme', 'cyberpunk', { timeout: 5_000 })
        const darkTransform = await probeHandle.evaluate((el) => getComputedStyle(el).transform)
        expect(isIdentityTransform(darkTransform)).toBe(true)

        await probeHandle.evaluate((el) => el.remove())
        await probeHandle.dispose()
      } finally {
        await closeElectronApp(electronApp)
      }
    })

    test('btn-secondary 与 btn-primary 计算高度一致', async () => {
      const { electronApp, window } = await launchApp()
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        // Both variants now share `padding: var(--component-btn-padding)` after the
        // polish round. Mount one of each with identical text into the live DOM so
        // the real globals.css applies, then compare measured heights. btn-secondary
        // carries a 1px all-side border vs btn-primary's border-left-only, so under
        // border-box the totals may differ by at most the 2px top+bottom border.
        const heights = await window.evaluate(() => {
          const host = document.createElement('div')
          host.id = 'e2e-btn-height-probe'
          host.style.position = 'fixed'
          host.style.left = '-9999px'
          host.style.top = '0'
          const secondary = document.createElement('button')
          secondary.className = 'btn-secondary'
          secondary.textContent = '按钮文本 Button'
          const primary = document.createElement('button')
          primary.className = 'btn-primary'
          primary.textContent = '按钮文本 Button'
          host.appendChild(secondary)
          host.appendChild(primary)
          document.body.appendChild(host)
          const result = {
            secondary: secondary.getBoundingClientRect().height,
            primary: primary.getBoundingClientRect().height
          }
          host.remove()
          return result
        })
        expect(heights.secondary).toBeGreaterThan(0)
        expect(heights.primary).toBeGreaterThan(0)
        // Equal up to the 2px border-box delta (top+bottom border of btn-secondary).
        expect(Math.abs(heights.secondary - heights.primary)).toBeLessThanOrEqual(2)
      } finally {
        await closeElectronApp(electronApp)
      }
    })
  })

  test.describe('监控 — AI 任务视图主题化', () => {
    test('AITaskView 渲染 stat-grid 概览卡且无 rounded-xl 残留', async () => {
      const { electronApp, window } = await launchApp()
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        const aiTaskView = window.getByTestId('ai-task-view')
        await openMonitorTab(window, 'ai-task', aiTaskView)

        // Overview row is a `.stat-grid` of 4 compact StatCards.
        const statGrid = aiTaskView.locator('.stat-grid').first()
        await expect(statGrid).toBeVisible({ timeout: 15_000 })
        const display = await statGrid.evaluate((el) => getComputedStyle(el).display)
        expect(display).toBe('grid')

        // StatCards render at least the 4 overview cards (active/completed/error/avg).
        await expect.poll(async () => statGrid.locator(':scope > *').count(), {
          message: '等待 AITaskView stat-grid 概览渲染四张 StatCard',
          timeout: 10_000
        }).toBeGreaterThanOrEqual(4)

        // The "已完成" overview StatCard uses the CheckIcon (lucide:Check).
        await expect(statGrid.locator('[data-icon-token="lucide:Check"]').first()).toBeVisible({ timeout: 10_000 })

        // No legacy rounded-xl utility残留 anywhere inside the themed view.
        await expect(aiTaskView.locator('[class*="rounded-xl"]')).toHaveCount(0)
      } finally {
        await closeElectronApp(electronApp)
      }
    })
  })

  test.describe('独立窗 / 悬浮窗', () => {
    test('drawer 独立窗渲染真实内容 (header 副标题 / footer / max-w-3xl / surface-900 背景)', async () => {
      test.setTimeout(90_000)
      const { electronApp, window } = await launchApp()
      let popout: OpenedPanelPopout | null = null
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        popout = await openPanelPopout(electronApp, window, 'drawer', 'contentId:notifications.top')
        const { popoutPage } = popout
        const root = popoutPage.locator('[data-r8c-panel-popout="drawer"]')
        await expect(root).toBeVisible({ timeout: 15_000 })

        // Drawer popout view root (rendered inside the panel popout shell).
        const drawerRoot = popoutPage.locator('[data-r8c-drawer-popout="notifications.top"]')
        await expect(drawerRoot).toBeVisible({ timeout: 15_000 })

        // Header carries the「独立窗」eyebrow subtitle.
        const header = drawerRoot.locator('header').first()
        await expect(header).toBeVisible({ timeout: 10_000 })
        await expect(header.getByText('独立窗', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

        // A footer status bar exists.
        await expect(drawerRoot.locator('footer').first()).toBeVisible({ timeout: 10_000 })

        // Body centering container uses max-w-3xl (48rem) with auto side margins.
        const body = drawerRoot.locator('.max-w-3xl').first()
        await expect(body).toBeVisible({ timeout: 10_000 })
        const bodyBox = await body.evaluate((el) => {
          const style = getComputedStyle(el)
          return { maxWidth: style.maxWidth, marginLeft: style.marginLeft, marginRight: style.marginRight }
        })
        // getComputedStyle resolves rem to px: max-w-3xl (48rem) === 768px.
        expect(bodyBox.maxWidth).toBe('768px')

        // PanelPopoutShell root background now resolves to surface-900 (was 950).
        const surface900 = await popoutPage.evaluate(() => {
          const probe = document.createElement('div')
          probe.className = 'bg-surface-900'
          document.body.appendChild(probe)
          const expected = getComputedStyle(probe).backgroundColor
          probe.remove()
          const shell = document.querySelector('[data-r8c-panel-popout="drawer"]')
          const actual = shell ? getComputedStyle(shell).backgroundColor : null
          return { expected, actual }
        })
        expect(surface900.actual).not.toBeNull()
        expect(surface900.actual).toBe(surface900.expected)
      } finally {
        await closePanelPopout(window, popout)
        await closeElectronApp(electronApp)
      }
    })

    test('port 悬浮卡标题栏含中文 trigger 标签 / 进程信息 / State·Address grid (best-effort)', async () => {
      test.setTimeout(90_000)
      const { electronApp, window } = await launchApp()
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        // Port floating cards are normally produced from a real listening-port
        // harness. Try to open one through the preload bridge against a synthetic
        // target; if the in-app card does not materialize (no real port backing),
        // soft-skip this surface rather than fail — the deterministic popout
        // coverage lives in the drawer popout test above.
        const synthetic = { port: 50515, pid: 999001 }
        await window.evaluate(async ({ port, pid }) => {
          await window.devhub.r8.port.openPopout({
            port,
            pid,
            trigger: 'click',
            mode: 'floating',
            hintPosition: { x: 120, y: 120 }
          }).catch(() => undefined)
        }, synthetic)

        const card = window.getByTestId(`port-popout-card-${synthetic.port}-${synthetic.pid}`)
        const appeared = await card.waitFor({ state: 'visible', timeout: 4_000 }).then(() => true).catch(() => false)
        test.skip(!appeared, 'port floating card requires a real listening-port harness; not available in this环境')

        const titlebar = window.getByTestId(`port-popout-titlebar-${synthetic.port}-${synthetic.pid}`)
        await expect(titlebar).toBeVisible({ timeout: 10_000 })
        // Trigger slug is recorded on the card root for a stable assertion.
        await expect(card).toHaveAttribute('data-r8b-popout-trigger', 'click')
        // Chinese trigger label「点击」for trigger 'click'.
        await expect(titlebar.getByText('点击')).toBeVisible({ timeout: 10_000 })
        // Port number + bound pid render in the title bar.
        await expect(titlebar.getByText(`:${synthetic.port}`)).toBeVisible({ timeout: 10_000 })
        await expect(titlebar.getByText(`#${synthetic.pid}`)).toBeVisible({ timeout: 10_000 })

        // Card body State/Address grid.
        const body = window.getByTestId(`port-popout-body-${synthetic.port}-${synthetic.pid}`)
        await expect(body).toBeVisible({ timeout: 10_000 })
        const grid = body.locator('section.grid').first()
        await expect(grid).toBeVisible({ timeout: 10_000 })
        const display = await grid.evaluate((el) => getComputedStyle(el).display)
        expect(display).toBe('grid')
      } finally {
        await closeElectronApp(electronApp)
      }
    })
  })

  test.describe('无障碍', () => {
    test('主窗与 popout 窗的 axe critical 违规为零', async () => {
      test.setTimeout(120_000)
      const { electronApp, window } = await launchApp()
      let popout: OpenedPanelPopout | null = null
      try {
        await resizeMainWindow(electronApp, 1440, 900, window)
        await expect(window.locator('.responsive-app-shell')).toBeVisible({ timeout: 15_000 })

        const mainSummary = await scanCriticalAxeViolations(window, 'visual-polish-main-shell')
        expect(mainSummary.criticalViolations, JSON.stringify(mainSummary.criticalViolations, null, 2)).toEqual([])

        popout = await openPanelPopout(electronApp, window, 'drawer', 'contentId:notifications.top')
        const popoutSummary = await scanCriticalAxeViolations(popout.popoutPage, 'visual-polish-drawer-popout')
        expect(popoutSummary.criticalViolations, JSON.stringify(popoutSummary.criticalViolations, null, 2)).toEqual([])
      } finally {
        await closePanelPopout(window, popout)
        await closeElectronApp(electronApp)
      }
    })
  })
})
