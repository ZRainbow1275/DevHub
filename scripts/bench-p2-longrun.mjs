import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'
const MB_RATIO_LIMIT = 1.5
const PS_CHILD_LIMIT = 2
const CPU_5M_LIMIT = 5
const IPC_RPM_LIMIT = 10

function optionNumber(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`))
  const envName = name.replace(/^--/, 'DEVHUB_').replace(/-/g, '_').toUpperCase()
  const raw = arg ? arg.slice(name.length + 1) : process.env[envName]
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function latest(series) {
  const items = Array.isArray(series?.items) ? series.items : []
  return Number(items.at(-1)?.v ?? 0)
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function maximum(values) {
  return values.length ? Math.max(...values) : 0
}

function ipcTop(snapshot) {
  return (snapshot.ipcRpm?.top ?? []).map((row) => ({
    channel: row.channel,
    rpm: Number(row.rpm ?? 0),
    totalSinceBoot: Number(row.totalSinceBoot ?? 0)
  }))
}

function ipcMax(snapshot) {
  return ipcTop(snapshot).reduce((max, row) => Math.max(max, row.rpm), 0)
}

function check(pass, message, details = {}) {
  return { details, message, pass: Boolean(pass) }
}

function countPowerShellChildren(parentPid) {
  if (!parentPid) return 0
  try {
    const stdout = execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process -Filter "ParentProcessId = ${parentPid}" | Where-Object { $_.Name -in @('powershell.exe','pwsh.exe') } | Measure-Object | Select-Object -ExpandProperty Count`
    ], { encoding: 'utf8', timeout: 15000 })
    return Number.parseInt(stdout.trim(), 10) || 0
  } catch {
    return -1
  }
}

async function waitForMainWindow(electronApp) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const page = electronApp.windows().find((candidate) => candidate.url().includes('/out/renderer/index.html'))
    if (page) {
      await page.waitForLoadState('domcontentloaded')
      return page
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Timed out while waiting for DevHub main window')
}

async function prepareMonitor(window) {
  const skip = window.locator('button').filter({ hasText: '跳过' }).first()
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await window.locator('button').filter({ hasText: '监控' }).first().click({ timeout: 15000 }).catch(() => {})
  await window.evaluate(async () => {
    window.devhub?.scanner?.subscribe?.()
    await window.devhub?.scanner?.getSnapshot?.().catch(() => null)
  })
}

async function readMetrics(window) {
  return window.evaluate(async () => {
    if (!window.devhub?.devObs) throw new Error('devObs API is not available')
    return window.devhub.devObs.getRuntimeMetrics()
  })
}

function summarize(samples, baselineMs) {
  const baseline = samples.filter((sample) => sample.elapsedMs <= baselineMs)
  const steady = samples.filter((sample) => sample.elapsedMs > baselineMs)
  const compare = steady.length ? steady : samples
  const baselineMain = average(baseline.map((sample) => sample.mainRssMb)) || average(samples.map((sample) => sample.mainRssMb))
  const baselineRenderer = average(baseline.map((sample) => sample.rendererRssMb)) || average(samples.map((sample) => sample.rendererRssMb))
  const maxMain = maximum(compare.map((sample) => sample.mainRssMb))
  const maxRenderer = maximum(compare.map((sample) => sample.rendererRssMb))
  return {
    baselineMain,
    baselineRenderer,
    mainRatio: baselineMain > 0 ? maxMain / baselineMain : 0,
    maxCpu5m: maximum(samples.map((sample) => sample.cpu5mAvg)),
    maxIpcRpm: maximum(samples.map((sample) => sample.maxIpcRpm)),
    worstIpcTop: samples.reduce((worst, sample) => (sample.maxIpcRpm > (worst?.maxIpcRpm ?? -1) ? sample : worst), null)?.ipcTop ?? [],
    maxMain,
    maxPsChildren: maximum(samples.map((sample) => sample.psChildCount)),
    maxRenderer,
    rendererRatio: baselineRenderer > 0 ? maxRenderer / baselineRenderer : 0,
    sampleCount: samples.length
  }
}

async function main() {
  const durationMinutes = optionNumber('--duration-minutes', 60)
  const sampleIntervalMs = optionNumber('--sample-interval-ms', 10000)
  const baselineMinutes = optionNumber('--baseline-minutes', 10)
  const allowShort = hasFlag('--allow-short') || process.env.DEVHUB_P2_ALLOW_SHORT === '1'
  const durationMs = durationMinutes * 60000
  const baselineMs = baselineMinutes * 60000
  const acceptanceEligible = durationMinutes >= 60 && baselineMinutes >= 10
  const startedAt = Date.now()
  const samples = []
  let disposeResult = null

  if (!existsSync(APP_MAIN)) throw new Error(`Missing ${APP_MAIN}. Run pnpm build first.`)

  const electronApp = await electron.launch({
    args: [APP_MAIN, '--enable-dev-obs'],
    env: { ...process.env, ENABLE_DEV_OBS: '1' }
  })
  const parentPid = electronApp.process()?.pid ?? 0

  try {
    const window = await waitForMainWindow(electronApp)
    await prepareMonitor(window)
    while (Date.now() - startedAt < durationMs) {
      const snapshot = await readMetrics(window)
      samples.push({
        cpu5mAvg: Number(snapshot.cpu5mAvg ?? 0),
        cpuNow: Number(snapshot.cpuNow ?? 0),
        elapsedMs: Date.now() - startedAt,
        mainRssMb: latest(snapshot.mainRss),
        ipcTop: ipcTop(snapshot),
        maxIpcRpm: ipcMax(snapshot),
        psChildCount: Number(snapshot.psChildCount ?? 0),
        rendererRssMb: latest(snapshot.rendererRss),
        ts: Date.now()
      })
      await new Promise((resolve) => setTimeout(resolve, sampleIntervalMs))
    }
    disposeResult = await electronApp.evaluate(async () => globalThis.__DEVHUB_TEST_HOOKS__?.disposeRuntimeForTests?.() ?? null)
  } finally {
    await electronApp.close().catch(() => {})
  }

  await new Promise((resolve) => setTimeout(resolve, 2000))
  const summary = summarize(samples, baselineMs)
  const psChildrenAfterExit = countPowerShellChildren(parentPid)
  const checks = [
    check(acceptanceEligible || allowShort, '60 分钟验收时长或显式 allow-short', { acceptanceEligible, durationMinutes }),
    check(summary.mainRatio <= MB_RATIO_LIMIT, '主进程 RSS 不超过基线 1.5x', { ratio: summary.mainRatio }),
    check(summary.rendererRatio <= MB_RATIO_LIMIT, '渲染进程 RSS 不超过基线 1.5x', { ratio: summary.rendererRatio }),
    check(summary.maxPsChildren <= PS_CHILD_LIMIT, '运行期 PowerShell 子进程不超过 2', { max: summary.maxPsChildren }),
    check(psChildrenAfterExit === 0, '退出后无 PowerShell 子进程残留', { psChildrenAfterExit }),
    check(summary.maxCpu5m <= CPU_5M_LIMIT, 'CPU 5 分钟均值不超过 5%', { maxCpu5m: summary.maxCpu5m }),
    check(summary.maxIpcRpm <= IPC_RPM_LIMIT, '任一 IPC channel RPM 不超过 10', { maxIpcRpm: summary.maxIpcRpm }),
    check(!disposeResult || disposeResult.report.remainingAfter.length === 0, 'DisposalRegistry 无 remaining entry', { remainingAfter: disposeResult?.report?.remainingAfter ?? [] })
  ]
  const passed = checks.every((item) => item.pass)
  const report = { acceptanceEligible, baselineMinutes, checks, disposeResult, durationMinutes, label: 'BENCH-P2.1', passed, sampleIntervalMs, samples, summary }
  const reportDir = join(process.cwd(), 'perf-reports')
  mkdirSync(reportDir, { recursive: true })
  const reportPath = join(reportDir, `bench-p2-longrun-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify({ ...report, reportPath, samples: `[${samples.length} samples omitted from console]` }, null, 2))
  if (!passed) process.exitCode = 1
}

await main()
