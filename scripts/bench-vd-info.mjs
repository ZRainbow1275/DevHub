/* global window */

import process from 'node:process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'
const TARGET_WINDOW_COUNT = Number.parseInt(process.env.VD_INFO_WINDOWS ?? '2', 10)
const SAMPLE_COUNT = Number.parseInt(process.env.VD_INFO_SAMPLES ?? '3', 10)
const VD_INFO_BUDGET_MS = Number.parseFloat(process.env.VD_INFO_P95_BUDGET_MS ?? '2000')

function percentile(values, percentileRank) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil((percentileRank / 100) * sorted.length) - 1)
  return sorted[index]
}

function roundMetric(value) {
  return Math.round(value * 100) / 100
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
    // The app may already be closing.
  }

  await Promise.race([
    electronApp.close(),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, 8000)
      timer.unref?.()
    })
  ]).catch(() => undefined)
}

function startProbeWindow(title, index) {
  const directory = join(tmpdir(), `devhub-r8b-vd-bench-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(directory, { recursive: true })
  const scriptPath = join(directory, 'probe.ps1')
  writeFileSync(scriptPath, [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    '$form = New-Object System.Windows.Forms.Form',
    `$form.Text = ${JSON.stringify(title)}`,
    '$form.Width = 500',
    '$form.Height = 320',
    '$form.StartPosition = "Manual"',
    `$form.Left = ${120 + index * 40}`,
    `$form.Top = ${120 + index * 40}`,
    '$label = New-Object System.Windows.Forms.Label',
    '$label.Dock = [System.Windows.Forms.DockStyle]::Fill',
    `$label.Text = ${JSON.stringify(`BENCH-VD-INFO ${title}`)}`,
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
  return { child, directory }
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

async function stopProbeWindow(probe) {
  if (!probe) return
  const pid = probe.child.pid
  if (probe.child.exitCode === null && probe.child.signalCode === null) {
    probe.child.kill()
    await waitForChildExit(probe.child, 2000)
  }
  if (pid && probe.child.exitCode === null && probe.child.signalCode === null && process.platform === 'win32') {
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        timeout: 5000,
        windowsHide: true
      })
      await waitForChildExit(probe.child, 2000)
    } catch {
      // The process may have exited between the bounded wait and taskkill.
    }
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      rmSync(probe.directory, { recursive: true, force: true })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
}

async function scanProbeHwnds(page, titles) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const hwnds = await page.evaluate(async (probeTitles) => {
      const scan = await window.devhub.windowManager.scan(false)
      return (scan.data ?? [])
        .filter((row) => probeTitles.includes(row.title))
        .sort((left, right) => left.title.localeCompare(right.title))
        .map((row) => row.hwnd)
    }, titles)
    if (hwnds.length === titles.length) return hwnds
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out while scanning ${titles.length} VD benchmark windows`)
}

async function runVdInfoSample(page, hwnds) {
  return page.evaluate(async (targetHwnds) => {
    const startedAt = performance.now()
    const response = await window.devhub.windowManager.getWindowVdInfo({ hwnds: targetHwnds })
    return {
      durationMs: performance.now() - startedAt,
      resolved: response.info.filter((item) => typeof item.desktopId === 'string' && item.desktopId.length > 0).length,
      unavailableReason: response.unavailableReason ?? null
    }
  }, hwnds)
}

async function main() {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build first.`)
  }
  if (TARGET_WINDOW_COUNT < 1) throw new Error('VD_INFO_WINDOWS must be at least 1')
  if (SAMPLE_COUNT < 1) throw new Error('VD_INFO_SAMPLES must be at least 1')

  const electronApp = await electron.launch({ args: [APP_MAIN] })
  let probes = []
  try {
    const page = await waitForMainWindow(electronApp)
    const titles = Array.from({ length: TARGET_WINDOW_COUNT }, (_, index) => `DevHub vd bench ${Date.now()} ${index}`)
    probes = titles.map((title, index) => startProbeWindow(title, index))
    const hwnds = await scanProbeHwnds(page, titles)
    const samples = []
    const resolvedCounts = []
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const sample = await runVdInfoSample(page, hwnds)
      if (sample.unavailableReason) {
        throw new Error(`VD info sample ${index} returned unavailableReason: ${sample.unavailableReason}`)
      }
      if (sample.resolved < TARGET_WINDOW_COUNT) {
        throw new Error(`VD info sample ${index} did not resolve all desktops: ${JSON.stringify(sample)}`)
      }
      samples.push(sample.durationMs)
      resolvedCounts.push(sample.resolved)
      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    const stats = summarize(samples)
    const report = {
      label: 'BENCH-VD-INFO',
      budgetMs: VD_INFO_BUDGET_MS,
      passed: stats.p95 <= VD_INFO_BUDGET_MS,
      sampleCount: SAMPLE_COUNT,
      stats,
      targetWindowCount: TARGET_WINDOW_COUNT,
      totalResolved: resolvedCounts.reduce((sum, value) => sum + value, 0)
    }
    console.log(JSON.stringify(report, null, 2))
    if (!report.passed) {
      throw new Error(`VD info p95 ${stats.p95}ms exceeded budget ${VD_INFO_BUDGET_MS}ms`)
    }
  } finally {
    await Promise.all(probes.map((probe) => stopProbeWindow(probe)))
    await closeElectronApp(electronApp)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
