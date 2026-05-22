/* global window */

import process from 'node:process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'
const REPORT_SCHEMA_VERSION = 'devhub-r8-popout-bw-rss-benchmark-v1'
const TARGET_WINDOW_COUNT = positiveInteger(process.env.POPOUT_BW_RSS_WINDOWS, 8)
const PER_WINDOW_BUDGET_MB = positiveNumber(process.env.POPOUT_BW_RSS_PER_WINDOW_BUDGET_MB, 80)
const THREE_WINDOW_BUDGET_MB = positiveNumber(process.env.POPOUT_BW_RSS_THREE_WINDOW_BUDGET_MB, 200)
const TOTAL_BUDGET_MB = positiveNumber(process.env.POPOUT_BW_RSS_TOTAL_BUDGET_MB, 500)
const SETTLE_MS = positiveInteger(process.env.POPOUT_BW_RSS_SETTLE_MS, 1000)
const REPORT_PATH = process.env.POPOUT_BW_RSS_REPORT_PATH
const TITLE_PREFIX = `R8.B spec-02 RSS bench ${Date.now()} `

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function positiveNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function roundMetric(value) {
  return Math.round(value * 100) / 100
}

function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })
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
    await sleep(250)
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

async function collectMetrics(electronApp) {
  let lastError = null
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await electronApp.evaluate(({ app }) => {
        return app.getAppMetrics()
      })
    } catch (error) {
      lastError = error
      await sleep(250)
    }
  }
  throw lastError ?? new Error('Unable to collect Electron app metrics')
}

function metricMemoryMb(metric) {
  const memory = metric?.memory
  const value = typeof memory?.workingSetSize === 'number'
    ? memory.workingSetSize
    : typeof memory?.privateBytes === 'number'
      ? memory.privateBytes
      : null
  if (value == null || !Number.isFinite(value)) return null
  return Math.max(0, value > 10_000_000 ? value / 1024 / 1024 : value / 1024)
}

function totalRssMb(metrics) {
  return roundMetric(metrics.reduce((sum, metric) => sum + (metricMemoryMb(metric) ?? 0), 0))
}

function metricsByPid(metrics) {
  const rows = new Map()
  for (const metric of metrics) {
    if (typeof metric.pid !== 'number') continue
    const rssMb = metricMemoryMb(metric)
    if (rssMb == null) continue
    rows.set(metric.pid, roundMetric(rssMb))
  }
  return rows
}

async function cleanupBenchPopouts(page) {
  await page.evaluate(async (prefix) => {
    const popouts = await window.devhub.r8.popout.list()
    for (const popout of popouts) {
      if (popout.title.startsWith(prefix)) {
        await window.devhub.r8.popout.close(popout.windowId).catch(() => undefined)
      }
    }
  }, TITLE_PREFIX)
}

async function createPopout(electronApp, page, index) {
  const title = `${TITLE_PREFIX}${String(index + 1).padStart(2, '0')}`
  const popoutPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
  const created = await page.evaluate(async ({ request }) => {
    return window.devhub.r8.popout.create(request)
  }, {
    request: {
      surface: 'port',
      targetId: 49300 + index,
      mode: 'browserwindow',
      route: '/monitor',
      bounds: {
        x: 64 + (index % 4) * 24,
        y: 64 + Math.floor(index / 4) * 24,
        width: 430,
        height: 360
      },
      title
    }
  })

  const popoutPage = await popoutPagePromise
  await popoutPage.waitForLoadState('domcontentloaded')
  await waitForPopoutUrl(popoutPage, created.windowId)
  const nativeInfo = await waitForNativeWindowVisible(electronApp, popoutPage, created.windowId)
  return {
    page: popoutPage,
    windowId: created.windowId,
    pid: nativeInfo.pid,
    title,
    bounds: nativeInfo.bounds
  }
}

async function readNativeWindowInfo(nativeWindow) {
  return nativeWindow.evaluate((browserWindow) => {
    const webContents = browserWindow.webContents
    const pid = typeof webContents.getOSProcessId === 'function'
      ? webContents.getOSProcessId()
      : typeof webContents.getProcessId === 'function'
        ? webContents.getProcessId()
        : null
    return {
      bounds: browserWindow.getBounds(),
      isDestroyed: browserWindow.isDestroyed(),
      isVisible: browserWindow.isVisible(),
      pid
    }
  })
}

async function waitForNativeWindowVisible(electronApp, popoutPage, windowId) {
  const deadline = Date.now() + 10_000
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const nativeWindow = await electronApp.browserWindow(popoutPage)
      const nativeInfo = await readNativeWindowInfo(nativeWindow)
      if (nativeInfo.pid == null) throw new Error(`Popout ${windowId} did not expose an OS process id`)
      if (nativeInfo.isVisible) return nativeInfo
    } catch (error) {
      lastError = error
    }
    await sleep(100)
  }
  if (lastError) throw lastError
  throw new Error(`Popout ${windowId} was not visible after creation`)
}

async function waitForPopoutUrl(page, windowId) {
  const encodedWindowId = encodeURIComponent(windowId)
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const url = page.url()
    if (url.includes('port-popout.html') && url.includes(`r8Popout=${encodedWindowId}`)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for popout URL carrying r8Popout=${windowId}`)
}

function summarizePopoutRss(popouts, metrics) {
  const pidToRss = metricsByPid(metrics)
  const pidShareCount = new Map()
  for (const popout of popouts) {
    pidShareCount.set(popout.pid, (pidShareCount.get(popout.pid) ?? 0) + 1)
  }
  const rows = popouts.map((popout) => {
    const rssMb = pidToRss.get(popout.pid) ?? null
    const shareCount = pidShareCount.get(popout.pid) ?? 1
    return {
      bounds: popout.bounds,
      effectiveRssMb: rssMb == null ? null : roundMetric(rssMb / shareCount),
      pid: popout.pid,
      rssMb,
      shareCount,
      title: popout.title,
      windowId: popout.windowId
    }
  })
  const uniquePidToRss = new Map()
  for (const row of rows) {
    if (row.rssMb == null) continue
    uniquePidToRss.set(row.pid, row.rssMb)
  }
  const rssValues = rows.map((row) => row.rssMb).filter((value) => typeof value === 'number')
  const effectiveRssValues = rows.map((row) => row.effectiveRssMb).filter((value) => typeof value === 'number')
  return {
    maxEffectivePerWindowRssMb: effectiveRssValues.length > 0 ? roundMetric(Math.max(...effectiveRssValues)) : null,
    maxPerWindowRssMb: rssValues.length > 0 ? roundMetric(Math.max(...rssValues)) : null,
    missingMetricWindowIds: rows.filter((row) => row.rssMb == null).map((row) => row.windowId),
    rows,
    totalUniquePopoutRssMb: roundMetric([...uniquePidToRss.values()].reduce((sum, rssMb) => sum + rssMb, 0)),
    uniqueProcessCount: uniquePidToRss.size
  }
}

function buildReport(input) {
  const finalSummary = summarizePopoutRss(input.popouts, input.finalMetrics)
  const firstThreeSummary = input.firstThreeMetrics
    ? summarizePopoutRss(input.popouts.slice(0, Math.min(3, input.popouts.length)), input.firstThreeMetrics)
    : null
  const baselineTotalAppRssMb = totalRssMb(input.baselineMetrics)
  const finalTotalAppRssMb = totalRssMb(input.finalMetrics)
  const firstThreeTotalAppRssMb = input.firstThreeMetrics ? totalRssMb(input.firstThreeMetrics) : null
  const appRssIncrementMb = roundMetric(finalTotalAppRssMb - baselineTotalAppRssMb)
  const firstThreeAppRssIncrementMb = firstThreeTotalAppRssMb == null
    ? null
    : roundMetric(firstThreeTotalAppRssMb - baselineTotalAppRssMb)
  const firstThreePassed = TARGET_WINDOW_COUNT < 3 || (
    firstThreeSummary !== null
    && firstThreeSummary.missingMetricWindowIds.length === 0
    && firstThreeSummary.totalUniquePopoutRssMb < THREE_WINDOW_BUDGET_MB
    && firstThreeAppRssIncrementMb !== null
    && firstThreeAppRssIncrementMb < THREE_WINDOW_BUDGET_MB
  )
  const finalPassed = input.popouts.length === TARGET_WINDOW_COUNT
    && finalSummary.missingMetricWindowIds.length === 0
    && finalSummary.maxEffectivePerWindowRssMb !== null
    && finalSummary.maxEffectivePerWindowRssMb < PER_WINDOW_BUDGET_MB
    && finalSummary.totalUniquePopoutRssMb < TOTAL_BUDGET_MB
	  return {
	    schemaVersion: REPORT_SCHEMA_VERSION,
	    appRssIncrementMb,
    baselineTotalAppRssMb,
    budgets: {
      perWindowMb: PER_WINDOW_BUDGET_MB,
      threeWindowIncrementMb: THREE_WINDOW_BUDGET_MB,
      totalUniquePopoutMb: TOTAL_BUDGET_MB
    },
    final: finalSummary,
    finalTotalAppRssMb,
    firstThree: firstThreeSummary,
    firstThreeAppRssIncrementMb,
    firstThreeTotalAppRssMb,
    label: 'BENCH-POPOUT-BW-RSS',
    passed: firstThreePassed && finalPassed,
    processReuse: 'process-per-site',
    sampleSource: 'Electron app.getAppMetrics() + BrowserWindow webContents OS process ids',
    settleMs: SETTLE_MS,
    targetWindowCount: TARGET_WINDOW_COUNT
  }
}

async function main() {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build first.`)
  }

  const electronApp = await electron.launch({
    args: [APP_MAIN],
    env: {
      ...process.env,
      DEVHUB_R8_POPOUT_PROCESS_REUSE: '1',
      DEVHUB_R8_POPOUT_RSS_ASSERT: '1'
    }
  })
  const popouts = []
  let page = null

  try {
    page = await waitForMainWindow(electronApp)
    await cleanupBenchPopouts(page)
    await sleep(SETTLE_MS)
    const baselineMetrics = await collectMetrics(electronApp)
    let firstThreeMetrics = null

    for (let index = 0; index < TARGET_WINDOW_COUNT; index += 1) {
      popouts.push(await createPopout(electronApp, page, index))
      await sleep(250)
      if (index === 2) {
        await sleep(SETTLE_MS)
        firstThreeMetrics = await collectMetrics(electronApp)
      }
    }

    await sleep(SETTLE_MS)
    const finalMetrics = await collectMetrics(electronApp)
    const report = buildReport({ baselineMetrics, finalMetrics, firstThreeMetrics, popouts })
    const serialized = JSON.stringify(report, null, 2)
    console.log(serialized)
    if (REPORT_PATH) {
      mkdirSync(dirname(REPORT_PATH), { recursive: true })
      writeFileSync(REPORT_PATH, `${serialized}\n`, 'utf8')
    }
    if (!report.passed) process.exitCode = 1
  } finally {
    if (page && !page.isClosed()) {
      await page.evaluate(async (windowIds) => {
        for (const windowId of windowIds) {
          await window.devhub.r8.popout.close(windowId).catch(() => undefined)
        }
      }, popouts.map((popout) => popout.windowId)).catch(() => undefined)
    }
    for (const popout of popouts) {
      if (!popout.page.isClosed()) await popout.page.close().catch(() => undefined)
    }
    await closeElectronApp(electronApp)
  }
}

await main()
