/* global document */

import process from 'node:process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { _electron as electron } from 'playwright'

const nodeRequire = createRequire(import.meta.url)
const AXE_CORE_PATH = nodeRequire.resolve('axe-core/axe.min.js')
const APP_MAIN = 'out/main/index.js'
const AXE_WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const SCAN_BUDGET_MS = Number.parseFloat(process.env.A11Y_AXE_BUDGET_MS ?? '1500')
const SURFACE_LABELS = [
  'home-main-shell',
  'monitor-process-surface',
  'dashboard-route',
  'settings-dialog',
  'command-palette'
]

function roundMetric(value) {
  return Math.round(value * 100) / 100
}

function percentile(values, percentileRank) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil((percentileRank / 100) * sorted.length) - 1)
  return sorted[index]
}

function summarize(samples) {
  return {
    max: roundMetric(Math.max(...samples)),
    min: roundMetric(Math.min(...samples)),
    p50: roundMetric(percentile(samples, 50)),
    p95: roundMetric(percentile(samples, 95)),
    p99: roundMetric(percentile(samples, 99)),
    samples: samples.length
  }
}

async function waitForMainWindow(electronApp) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const mainWindow = electronApp.windows().find((page) =>
      page.url().includes('/out/renderer/index.html')
      || page.url().includes('/out/renderer/index.html'.replace(/\//g, '\\'))
    )

    if (mainWindow) {
      await mainWindow.waitForLoadState('domcontentloaded')
      return mainWindow
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Timed out while waiting for DevHub main window')
}

async function closeElectronApp(electronApp) {
  try {
    await electronApp.evaluate(({ app }) => {
      app.quit()
    })
  } catch {
    // The process may already be closing.
  }

  await Promise.race([
    electronApp.close(),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, 8000)
      timer.unref?.()
    })
  ]).catch(() => undefined)
}

async function dismissAutoDiscoveryIfPresent(page) {
  const skipButton = page.locator('button').filter({ hasText: '跳过' }).first()
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click()
  }
}

async function clickButtonByText(page, text) {
  const button = page.locator('button').filter({ hasText: text }).first()
  await button.waitFor({ state: 'visible', timeout: 15_000 })
  await button.click()
}

async function ensureAxeRuntime(page) {
  const hasAxe = await page.evaluate(() => {
    return typeof globalThis.axe === 'object'
  }).catch(() => false)
  if (!hasAxe) {
    await page.addScriptTag({ path: AXE_CORE_PATH })
  }
}

async function scanSurface(page, label) {
  await ensureAxeRuntime(page)
  const result = await page.evaluate(async ({ scanLabel, tags }) => {
    const axeRuntime = globalThis.axe
    if (!axeRuntime) throw new Error('axe runtime was not injected into Electron renderer')
    const startedAt = performance.now()
    const axeResults = await axeRuntime.run(document, { runOnly: { type: 'tag', values: tags } })
    const durationMs = performance.now() - startedAt
    const criticalViolations = axeResults.violations
      .filter((violation) => violation.impact === 'critical')
      .map((violation) => ({
        help: violation.help,
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.flatMap((node) => node.target)
      }))

    return {
      criticalViolations,
      durationMs,
      incompleteCount: axeResults.incomplete.length,
      label: scanLabel,
      passesCount: axeResults.passes.length,
      violationCount: axeResults.violations.length
    }
  }, { scanLabel: label, tags: AXE_WCAG_TAGS })

  return {
    ...result,
    durationMs: roundMetric(result.durationMs)
  }
}

async function runSurfaceScans(page) {
  const scans = []
  scans.push(await scanSurface(page, 'home-main-shell'))

  await clickButtonByText(page, '监控')
  await page.getByText('系统监控').waitFor({ state: 'visible', timeout: 15_000 })
  scans.push(await scanSurface(page, 'monitor-process-surface'))

  await page.getByTestId('nav-dashboard').click()
  await page.locator('[data-testid="dashboard-page"], [data-testid="dashboard-disabled-page"]').waitFor({
    state: 'visible',
    timeout: 15_000
  })
  scans.push(await scanSurface(page, 'dashboard-route'))

  await page.getByTestId('sidebar-settings-button').click()
  const settingsDialog = page.getByRole('dialog', { name: '系统设置' })
  await settingsDialog.waitFor({ state: 'visible', timeout: 10_000 })
  scans.push(await scanSurface(page, 'settings-dialog'))

  await page.keyboard.press('Escape')
  await settingsDialog.waitFor({ state: 'hidden', timeout: 10_000 })
  await page.keyboard.press('Control+K')
  await page.getByTestId('command-palette').waitFor({ state: 'visible', timeout: 10_000 })
  scans.push(await scanSurface(page, 'command-palette'))

  return scans
}

async function main() {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build first.`)
  }

  const electronApp = await electron.launch({ args: [APP_MAIN] })

  try {
    const page = await waitForMainWindow(electronApp)
    await dismissAutoDiscoveryIfPresent(page)
    const scans = await runSurfaceScans(page)
    const durations = scans.map((scan) => scan.durationMs)
    const criticalViolations = scans.flatMap((scan) => scan.criticalViolations)
    const overBudget = scans.filter((scan) => scan.durationMs > SCAN_BUDGET_MS)
    const missingSurfaces = SURFACE_LABELS.filter((label) => !scans.some((scan) => scan.label === label))
    const passed = missingSurfaces.length === 0 && criticalViolations.length === 0 && overBudget.length === 0
    const payload = {
      budgetMs: SCAN_BUDGET_MS,
      criticalViolationCount: criticalViolations.length,
      criticalViolations,
      durationStats: summarize(durations),
      label: 'BENCH-A11Y-AXE',
      measurement: 'real Electron renderer multi-surface axe-core WCAG A/AA scan duration and critical violation gate',
      missingSurfaces,
      passed,
      scans,
      tags: AXE_WCAG_TAGS
    }

    console.log(JSON.stringify(payload, null, 2))
    if (!passed) process.exitCode = 1
  } finally {
    await closeElectronApp(electronApp)
  }
}

await main()
