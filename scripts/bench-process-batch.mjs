/* global window */

import process from 'node:process'
import { existsSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'
const TARGET_PROCESS_COUNT = Number.parseInt(process.env.PROCESS_BATCH_BENCH_PROCESSES ?? '4', 10)
const SAMPLE_COUNT = Number.parseInt(process.env.PROCESS_BATCH_BENCH_SAMPLES ?? '3', 10)
const BATCH_BUDGET_MS = Number.parseFloat(process.env.PROCESS_BATCH_KILL_P95_BUDGET_MS ?? '10000')
const PROGRESS_TIMEOUT_MS = Number.parseInt(process.env.PROCESS_BATCH_PROGRESS_TIMEOUT_MS ?? '30000', 10)

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

function spawnKillProbe(label) {
  return spawn(process.execPath, [
    '-e',
    'setInterval(() => {}, 1000)',
    label
  ], {
    stdio: 'ignore',
    timeout: 120_000,
    windowsHide: true
  })
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

async function stopChildProcess(child) {
  if (!child) return
  const pid = child.pid
  if (child.exitCode === null && child.signalCode === null) {
    child.kill()
    await waitForChildExit(child, 2000)
  }
  if (pid && child.exitCode === null && child.signalCode === null && process.platform === 'win32') {
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        timeout: 5000,
        windowsHide: true
      })
      await waitForChildExit(child, 2000)
    } catch {
      // The process may have exited between the bounded wait and taskkill.
    }
  }
}

async function waitForProcessScan(page, pids) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const found = await page.evaluate(async (targetPids) => {
      const scan = await window.devhub.systemProcess.scan()
      const seen = new Set((scan.data ?? []).map((row) => row.pid))
      return targetPids.filter((pid) => seen.has(pid)).length
    }, pids)
    if (found === pids.length) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out while waiting for ${pids.length} process batch benchmark PIDs`)
}

async function runKillBatch(page, pids) {
  return page.evaluate(async ({ targetPids, timeoutMs }) => {
    const extractJobId = (value) => {
      if (typeof value === 'object' && value !== null) {
        if (typeof value.jobId === 'string' && value.jobId.length > 0) return value.jobId
        if (typeof value.data === 'object' && value.data !== null && typeof value.data.jobId === 'string') return value.data.jobId
      }
      throw new Error(`Process batch start response did not include jobId: ${JSON.stringify(value)}`)
    }
    const progressEvents = []
    const unsubscribe = window.devhub.systemProcess.onBatchProgress((progress) => {
      progressEvents.push(progress)
    })
    const startedAt = performance.now()
    try {
      const started = await window.devhub.systemProcess.batchOp({
        action: 'kill',
        confirmed: true,
        pids: targetPids
      })
      const jobId = extractJobId(started)
      const finalProgress = await new Promise((resolve, reject) => {
        const handles = {}
        handles.timeout = window.setTimeout(() => {
          if (handles.interval !== undefined) window.clearInterval(handles.interval)
          reject(new Error(`Timed out waiting for process kill batch ${jobId}`))
        }, timeoutMs)
        handles.interval = window.setInterval(() => {
          const latest = [...progressEvents].reverse().find((progress) => progress.jobId === jobId)
          if (latest && latest.state !== 'running') {
            if (handles.timeout !== undefined) window.clearTimeout(handles.timeout)
            if (handles.interval !== undefined) window.clearInterval(handles.interval)
            resolve(latest)
          }
        }, 25)
      })
      return {
        durationMs: performance.now() - startedAt,
        finalProgress,
        jobId
      }
    } finally {
      unsubscribe()
    }
  }, { targetPids: pids, timeoutMs: PROGRESS_TIMEOUT_MS })
}

async function runSample(page, sampleIndex) {
  const children = Array.from({ length: TARGET_PROCESS_COUNT }, (_, index) =>
    spawnKillProbe(`devhub-process-batch-bench-${sampleIndex}-${index}-${Date.now()}`)
  )
  const pids = children.map((child) => child.pid).filter((pid) => Number.isInteger(pid) && pid > 100)
  try {
    if (pids.length !== TARGET_PROCESS_COUNT) {
      throw new Error(`Expected ${TARGET_PROCESS_COUNT} probe PIDs but got ${pids.length}`)
    }
    await waitForProcessScan(page, pids)
    const run = await runKillBatch(page, pids)
    const exited = await Promise.all(children.map((child) => waitForChildExit(child, 10_000)))
    return {
      durationMs: run.durationMs,
      exitedCount: exited.filter(Boolean).length,
      finalProgress: run.finalProgress,
      jobId: run.jobId,
      pids
    }
  } finally {
    await Promise.all(children.map((child) => stopChildProcess(child)))
  }
}

async function main() {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build first.`)
  }
  if (TARGET_PROCESS_COUNT < 1) {
    throw new Error('PROCESS_BATCH_BENCH_PROCESSES must be at least 1')
  }
  if (SAMPLE_COUNT < 1) {
    throw new Error('PROCESS_BATCH_BENCH_SAMPLES must be at least 1')
  }

  const electronApp = await electron.launch({ args: [APP_MAIN] })
  try {
    const page = await waitForMainWindow(electronApp)
    const samples = []
    const jobIds = []
    for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
      const sample = await runSample(page, sampleIndex)
      if (sample.finalProgress.failed > 0) {
        throw new Error(`Process batch ${sample.jobId} failed ${sample.finalProgress.failed} PID operations`)
      }
      if (sample.finalProgress.completed !== TARGET_PROCESS_COUNT) {
        throw new Error(`Process batch ${sample.jobId} completed ${sample.finalProgress.completed}/${TARGET_PROCESS_COUNT}`)
      }
      if (sample.exitedCount !== TARGET_PROCESS_COUNT) {
        throw new Error(`Process batch ${sample.jobId} terminated ${sample.exitedCount}/${TARGET_PROCESS_COUNT} child processes`)
      }
      samples.push(sample.durationMs)
      jobIds.push(sample.jobId)
    }

    const stats = summarize(samples)
    const passed = samples.length === SAMPLE_COUNT && stats.p95 < BATCH_BUDGET_MS
    const payload = {
      budgetMs: BATCH_BUDGET_MS,
      jobIds,
      label: 'BENCH-PROCESS-BATCH-KILL',
      measurement: 'real Electron process batch kill job duration through public preload bridge',
      passed,
      processCount: TARGET_PROCESS_COUNT,
      sampleCount: SAMPLE_COUNT,
      stats
    }

    console.log(JSON.stringify(payload, null, 2))
    if (!passed) process.exitCode = 1
  } finally {
    await closeElectronApp(electronApp)
  }
}

await main()
