/* global window */

import process from 'node:process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'
const REPORT_SCHEMA_VERSION = 'devhub-r8-thumbnail-capture-benchmark-v1'
const TARGET_WINDOW_COUNT = Number.parseInt(process.env.THUMBNAIL_CAPTURE_WINDOWS ?? '3', 10)
const CAPTURE_MODE = process.env.THUMBNAIL_CAPTURE_MODE ?? 'per-window'
const DEFAULT_SAMPLE_COUNT = CAPTURE_MODE === 'per-window' ? '1' : '3'
const SAMPLE_COUNT = Number.parseInt(process.env.THUMBNAIL_CAPTURE_SAMPLES ?? DEFAULT_SAMPLE_COUNT, 10)
const CAPTURE_BUDGET_MS = Number.parseFloat(process.env.THUMBNAIL_CAPTURE_P95_BUDGET_MS ?? '200')
const WINDOWS_PER_HOST = Number.parseInt(process.env.THUMBNAIL_CAPTURE_WINDOWS_PER_HOST ?? '10', 10)
const PER_WINDOW_WARMUP = process.env.THUMBNAIL_CAPTURE_PER_WINDOW_WARMUP !== '0'
const POST_WARMUP_SETTLE_MS = Number.parseInt(process.env.THUMBNAIL_CAPTURE_POST_WARMUP_SETTLE_MS ?? '250', 10)
const REPORT_PATH = process.env.THUMBNAIL_CAPTURE_REPORT_PATH

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

function psSingleQuoted(value) {
  return `'${value.replace(/'/g, "''")}'`
}

function probeWindowScript(titles, startIndex) {
  const titleArray = `@(${titles.map(psSingleQuoted).join(',')})`
  return [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    '$context = New-Object System.Windows.Forms.ApplicationContext',
    `$titles = ${titleArray}`,
    `$index = ${startIndex}`,
    'foreach ($title in $titles) {',
    '  $form = New-Object System.Windows.Forms.Form',
    '  $form.Text = $title',
    '  $form.Width = 180',
    '  $form.Height = 110',
    "  $form.StartPosition = 'Manual'",
    '  $form.Left = 30 + (($index % 10) * 185)',
    '  $form.Top = 30 + ([Math]::Floor($index / 10) * 100)',
    "  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedToolWindow",
    '  $form.BackColor = [System.Drawing.Color]::FromArgb(245, 247, 250)',
    '  $form.Show()',
    '  $index += 1',
    '}',
    '[System.Windows.Forms.Application]::Run($context)',
    ''
  ].join('\n')
}

function startProbeWindow(title, index) {
  const directory = join(tmpdir(), `devhub-r8b-thumb-bench-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(directory, { recursive: true })
  const scriptPath = join(directory, 'probe.ps1')
  writeFileSync(scriptPath, [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    '$form = New-Object System.Windows.Forms.Form',
    `$form.Text = ${JSON.stringify(title)}`,
    '$form.Width = 520',
    '$form.Height = 360',
    "$form.StartPosition = 'Manual'",
    `$form.Left = ${80 + index * 48}`,
    `$form.Top = ${80 + index * 48}`,
    '$form.BackColor = [System.Drawing.Color]::FromArgb(245, 247, 250)',
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
  return { child, directory, windowCount: 1 }
}

function startProbeWindowHost(titles, startIndex = 0) {
  const directory = join(tmpdir(), `devhub-r8b-thumb-bench-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(directory, { recursive: true })
  const scriptPath = join(directory, 'probe.ps1')
  writeFileSync(scriptPath, probeWindowScript(titles, startIndex), 'utf8')
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
  return { child, directory, windowCount: titles.length }
}

function createProbeHosts(titles) {
  if (WINDOWS_PER_HOST < 1) throw new Error('THUMBNAIL_CAPTURE_WINDOWS_PER_HOST must be at least 1')
  const hosts = []
  for (let startIndex = 0; startIndex < titles.length; startIndex += WINDOWS_PER_HOST) {
    hosts.push(startProbeWindowHost(titles.slice(startIndex, startIndex + WINDOWS_PER_HOST), startIndex))
  }
  return hosts
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
  throw new Error(`Timed out while scanning ${titles.length} thumbnail benchmark windows`)
}

async function runCaptureSample(page, hwnds) {
  return page.evaluate(async (targetHwnds) => {
    const startedAt = performance.now()
    const response = await window.devhub.windowManager.getThumbnailsBatch({
      hwnds: targetHwnds,
      maxAgeMs: 0,
      thumbnailSize: { width: 240, height: 160 }
    })
    return {
      durationMs: performance.now() - startedAt,
      captured: response.captured,
      failed: response.failed,
      source: response.source
    }
  }, hwnds)
}

async function runPerWindowCaptureSamples(page, hwnds) {
  const samples = []
  const sourceCounts = new Map()
  const batchWarmup = await runCaptureSample(page, hwnds)
  if (batchWarmup.failed > 0 || batchWarmup.captured < hwnds.length) {
    throw new Error(`Thumbnail warmup did not capture all windows: ${JSON.stringify(batchWarmup)}`)
  }
  let perWindowWarmupCaptured = 0
  if (PER_WINDOW_WARMUP) {
    for (const hwnd of hwnds) {
      const warmup = await runCaptureSample(page, [hwnd])
      if (warmup.failed > 0 || warmup.captured !== 1) {
        throw new Error(`Thumbnail per-window warmup did not capture hwnd ${hwnd}: ${JSON.stringify(warmup)}`)
      }
      perWindowWarmupCaptured += warmup.captured
    }
  }
  if (POST_WARMUP_SETTLE_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, POST_WARMUP_SETTLE_MS))
  }
  for (const hwnd of hwnds) {
    const sample = await runCaptureSample(page, [hwnd])
    if (sample.failed > 0 || sample.captured !== 1) {
      throw new Error(`Thumbnail per-window sample did not capture hwnd ${hwnd}: ${JSON.stringify(sample)}`)
    }
    samples.push(sample.durationMs)
    sourceCounts.set(sample.source, (sourceCounts.get(sample.source) ?? 0) + 1)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return { samples, sourceCounts, warmupCaptured: batchWarmup.captured + perWindowWarmupCaptured }
}

async function main() {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build first.`)
  }
  if (TARGET_WINDOW_COUNT < 1) throw new Error('THUMBNAIL_CAPTURE_WINDOWS must be at least 1')
  if (SAMPLE_COUNT < 1) throw new Error('THUMBNAIL_CAPTURE_SAMPLES must be at least 1')

  const electronApp = await electron.launch({ args: [APP_MAIN] })
  if (process.env.DEVHUB_THUMBNAIL_DEBUG === '1') {
    const electronProcess = electronApp.process()
    electronProcess?.stdout?.on('data', (chunk) => process.stdout.write(chunk))
    electronProcess?.stderr?.on('data', (chunk) => process.stderr.write(chunk))
  }
  let probes = []
  try {
    const page = await waitForMainWindow(electronApp)
    const titles = Array.from({ length: TARGET_WINDOW_COUNT }, (_, index) => `DevHub thumbnail bench ${Date.now()} ${index}`)
    probes = TARGET_WINDOW_COUNT > 10
      ? createProbeHosts(titles)
      : titles.map((title, index) => startProbeWindow(title, index))
    const hwnds = await scanProbeHwnds(page, titles)
    const samples = []
    const captureCounts = []
    const sourceCounts = new Map()
    if (CAPTURE_MODE === 'per-window') {
      if (SAMPLE_COUNT !== 1) {
        throw new Error('THUMBNAIL_CAPTURE_MODE=per-window requires THUMBNAIL_CAPTURE_SAMPLES=1 to keep release-scale resource usage bounded')
      }
      const perWindow = await runPerWindowCaptureSamples(page, hwnds)
      samples.push(...perWindow.samples)
      captureCounts.push(perWindow.samples.length)
      captureCounts.push(perWindow.warmupCaptured)
      for (const [source, count] of perWindow.sourceCounts.entries()) {
        sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + count)
      }
    } else if (CAPTURE_MODE === 'batch') {
      for (let index = 0; index < SAMPLE_COUNT; index += 1) {
        const sample = await runCaptureSample(page, hwnds)
        if (sample.failed > 0 || sample.captured < TARGET_WINDOW_COUNT) {
          throw new Error(`Thumbnail sample ${index} did not capture all windows: ${JSON.stringify(sample)}`)
        }
        samples.push(sample.durationMs)
        captureCounts.push(sample.captured)
        sourceCounts.set(sample.source, (sourceCounts.get(sample.source) ?? 0) + 1)
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    } else {
      throw new Error(`Unsupported THUMBNAIL_CAPTURE_MODE: ${CAPTURE_MODE}`)
    }

	    const stats = summarize(samples)
	    const report = {
	      schemaVersion: REPORT_SCHEMA_VERSION,
	      label: 'BENCH-THUMBNAIL-CAPTURE',
      budgetMs: CAPTURE_BUDGET_MS,
      captureMode: CAPTURE_MODE,
      hostProcessCount: probes.length,
      passed: stats.p95 <= CAPTURE_BUDGET_MS,
      measuredCaptured: samples.length,
      postWarmupSettleMs: CAPTURE_MODE === 'per-window' ? POST_WARMUP_SETTLE_MS : 0,
      sampleCount: SAMPLE_COUNT,
      sourceCounts: Object.fromEntries(sourceCounts.entries()),
      stats,
      targetWindowCount: TARGET_WINDOW_COUNT,
      uniqueHwndCount: new Set(hwnds).size,
      totalCaptured: captureCounts.reduce((sum, value) => sum + value, 0)
    }
    console.log(JSON.stringify(report, null, 2))
    if (REPORT_PATH) {
      mkdirSync(dirname(REPORT_PATH), { recursive: true })
      writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    }
    if (!report.passed) {
      throw new Error(`Thumbnail capture p95 ${stats.p95}ms exceeded budget ${CAPTURE_BUDGET_MS}ms`)
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
