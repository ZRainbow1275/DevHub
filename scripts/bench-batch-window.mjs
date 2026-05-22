/* global window */

import process from 'node:process'
import { existsSync } from 'node:fs'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'
const TARGET_WINDOW_COUNT = Number.parseInt(process.env.WINDOW_BATCH_BENCH_WINDOWS ?? '20', 10)
const SAMPLE_COUNT = Number.parseInt(process.env.WINDOW_BATCH_BENCH_SAMPLES ?? '5', 10)
const BATCH_BUDGET_MS = Number.parseFloat(process.env.WINDOW_BATCH_FOCUS_P95_BUDGET_MS ?? '5000')
const PROGRESS_TIMEOUT_MS = Number.parseInt(process.env.WINDOW_BATCH_PROGRESS_TIMEOUT_MS ?? '30000', 10)

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

async function createProbeWindows(electronApp, titles) {
  return electronApp.evaluate(async ({ BrowserWindow }, probeTitles) => {
    const created = []
    for (const [index, title] of probeTitles.entries()) {
      const probeWindow = new BrowserWindow({
        height: 180,
        show: true,
        title,
        width: 320,
        x: 40 + (index % 5) * 34,
        y: 40 + Math.floor(index / 5) * 34
      })
      const body = '<html><head><title>' + title + '</title></head><body><h1>' + title + '</h1></body></html>'
      await probeWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(body))
      probeWindow.setTitle(title)
      created.push(probeWindow.id)
    }
    return created
  }, titles)
}

async function closeProbeWindows(electronApp, ids) {
  await electronApp.evaluate(({ BrowserWindow }, windowIds) => {
    for (const id of windowIds) {
      const probeWindow = BrowserWindow.fromId(id)
      if (probeWindow && !probeWindow.isDestroyed()) {
        probeWindow.destroy()
      }
    }
  }, ids).catch(() => undefined)
}

async function showProbeWindows(electronApp, ids) {
  await electronApp.evaluate(({ BrowserWindow }, windowIds) => {
    for (const id of windowIds) {
      const probeWindow = BrowserWindow.fromId(id)
      if (probeWindow && !probeWindow.isDestroyed()) {
        probeWindow.show()
      }
    }
  }, ids)
}

async function scanProbeHwnds(electronApp, titles) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const hwnds = await electronApp.evaluate(async (_, probeTitles) => {
      const hooks = globalThis.__DEVHUB_TEST_HOOKS__
      if (!hooks) {
        throw new Error('Runtime test hooks are not available')
      }
      const scan = await hooks.scanWindowsIntoCacheForTests()
      return scan.data
        .filter((row) => probeTitles.includes(row.title))
        .sort((left, right) => left.title.localeCompare(right.title))
        .map((row) => row.hwnd)
    }, titles)

    if (hwnds.length === titles.length) return hwnds
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out while scanning ${titles.length} real probe HWNDs`)
}

async function runFocusBenchmark(page, hwnds) {
  return page.evaluate(async ({ budgetMs, progressTimeoutMs, sampleCount, targetHwnds }) => {
    const batchOp = window.devhub.windowManager.batchOp
    const onBatchProgress = window.devhub.windowManager.onBatchProgress
    if (!batchOp || !onBatchProgress) {
      throw new Error('Window batch preload API is unavailable')
    }

    const samples = []
    const jobIds = []
    for (let index = 0; index < sampleCount; index += 1) {
      const progressEvents = []
      const unsubscribe = onBatchProgress((progress) => {
        progressEvents.push(progress)
      })
      const startedAt = performance.now()
      try {
        const started = await batchOp({
          action: 'focus',
          confirmed: true,
          hwnds: targetHwnds
        })
        jobIds.push(started.jobId)
        const finalProgress = await new Promise((resolve, reject) => {
          const handles = {}
          handles.timeout = window.setTimeout(() => {
            if (handles.interval !== undefined) window.clearInterval(handles.interval)
            reject(new Error(`Timed out waiting for focus batch ${started.jobId}`))
          }, progressTimeoutMs)
          handles.interval = window.setInterval(() => {
            const latest = [...progressEvents].reverse().find((progress) => progress.jobId === started.jobId)
            if (latest && latest.state !== 'running') {
              if (handles.timeout !== undefined) window.clearTimeout(handles.timeout)
              if (handles.interval !== undefined) window.clearInterval(handles.interval)
              resolve(latest)
            }
          }, 25)
        })
        const durationMs = performance.now() - startedAt
        if (finalProgress.failed > 0) {
          throw new Error(`Focus batch ${started.jobId} failed ${finalProgress.failed} HWND operations`)
        }
        if (finalProgress.completed !== targetHwnds.length) {
          throw new Error(`Focus batch ${started.jobId} completed ${finalProgress.completed}/${targetHwnds.length}`)
        }
        samples.push(durationMs)
      } finally {
        unsubscribe()
      }
    }

    const sorted = [...samples].sort((left, right) => left - right)
    const p95Index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)
    const p95 = sorted[p95Index] ?? 0
    return {
      budgetMs,
      jobIds,
      passed: samples.length === sampleCount && p95 < budgetMs,
      samples
    }
  }, {
    budgetMs: BATCH_BUDGET_MS,
    progressTimeoutMs: PROGRESS_TIMEOUT_MS,
    sampleCount: SAMPLE_COUNT,
    targetHwnds: hwnds
  })
}

async function main() {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build first.`)
  }
  if (TARGET_WINDOW_COUNT < 1) {
    throw new Error('WINDOW_BATCH_BENCH_WINDOWS must be at least 1')
  }
  if (SAMPLE_COUNT < 1) {
    throw new Error('WINDOW_BATCH_BENCH_SAMPLES must be at least 1')
  }

  const electronApp = await electron.launch({ args: [APP_MAIN] })
  const probeIds = []
  try {
    const page = await waitForMainWindow(electronApp)
    const prefix = `DevHub window batch bench ${Date.now()}`
    const titles = Array.from({ length: TARGET_WINDOW_COUNT }, (_, index) => `${prefix} ${String(index + 1).padStart(2, '0')}`)
    probeIds.push(...await createProbeWindows(electronApp, titles))
    const hwnds = await scanProbeHwnds(electronApp, titles)
    await showProbeWindows(electronApp, probeIds)
    const run = await runFocusBenchmark(page, hwnds)
    const stats = summarize(run.samples)
    const passed = run.passed && hwnds.length === TARGET_WINDOW_COUNT && stats.p95 < BATCH_BUDGET_MS
    const payload = {
      budgetMs: BATCH_BUDGET_MS,
      hwndCount: hwnds.length,
      jobIds: run.jobIds,
      label: 'BENCH-WINDOW-BATCH-FOCUS',
      measurement: 'real Electron BrowserWindow HWND batch focus job duration through public preload bridge',
      passed,
      sampleCount: SAMPLE_COUNT,
      stats,
      targetWindowCount: TARGET_WINDOW_COUNT
    }

    console.log(JSON.stringify(payload, null, 2))
    if (!passed) process.exitCode = 1
  } finally {
    await closeProbeWindows(electronApp, probeIds)
    await closeElectronApp(electronApp)
  }
}

await main()
