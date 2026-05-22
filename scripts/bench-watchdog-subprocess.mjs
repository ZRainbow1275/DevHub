import { spawn, execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const args = new Map(process.argv.slice(2).map(item => {
  const [key, value = 'true'] = item.split('=')
  return [key, value]
}))

const entryFile = resolve(repoRoot, args.get('--entry') ?? 'out/main/watchdog-process/main.js')
const durationMs = positiveInt(args.get('--duration-ms'), 2000)
const heartbeatIntervalMs = positiveInt(args.get('--heartbeat-interval-ms'), 5000)
const handshakeTimeoutMs = positiveInt(args.get('--handshake-timeout-ms'), 25)
const rssBudgetMb = positiveNumber(args.get('--rss-budget-mb'), 80)
const cpuBudgetPercent = positiveNumber(args.get('--cpu-budget-percent'), 0.5)

if (!existsSync(entryFile)) {
  throw new Error(`E_BENCH_ENTRY_MISSING: watchdog entry not found at ${entryFile}; run pnpm -C devhub build first`)
}

const tempRoot = mkdtempSync(join(tmpdir(), 'devhub-watchdog-bench-'))
const token = randomBytes(32).toString('hex')
const tokenPrefix = token.slice(0, 8)
const markerFilePath = join(tempRoot, 'marker.json')
const marker = {
  tokenPrefix,
  parentPid: process.pid,
  childPidExpected: null,
  writer: 'parent-supervisor',
  protocolVersion: '1.0',
  namedPipePath: `\\\\.\\pipe\\devhub-watchdog-${tokenPrefix}`,
  eventPipePath: `\\\\.\\pipe\\devhub-watchdog-event-${tokenPrefix}`,
  tcpPort: null,
  updatedAt: Date.now()
}

writeFileSync(markerFilePath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8')

const child = spawn(process.execPath, [
  entryFile,
  `--token=${token}`,
  `--marker=${markerFilePath}`,
  `--heartbeat-interval-ms=${heartbeatIntervalMs}`,
  `--handshake-timeout-ms=${handshakeTimeoutMs}`
], {
  windowsHide: true,
  stdio: 'ignore',
  timeout: durationMs + 10_000,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})

try {
  await waitForInnerMarker(markerFilePath, tokenPrefix, 3000)
  await sleep(500)
  const before = await sampleProcessStats(child.pid)
  await sleep(durationMs)
  const after = await sampleProcessStats(child.pid)
  const cpuPercent = Math.max(0, ((after.cpuSeconds - before.cpuSeconds) / (durationMs / 1000) / Math.max(cpus().length, 1)) * 100)
  const rssMb = after.rssBytes / 1024 / 1024
  const result = {
    ok: rssMb < rssBudgetMb && cpuPercent < cpuBudgetPercent,
    entryFile,
    pid: child.pid,
    durationMs,
    rssMb: Number(rssMb.toFixed(3)),
    rssBudgetMb,
    cpuPercent: Number(cpuPercent.toFixed(6)),
    cpuBudgetPercent,
    markerWriter: JSON.parse(readFileSync(markerFilePath, 'utf8')).writer
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.ok) {
    throw new Error(`E_BENCH_FAILED: rssMb=${result.rssMb}/${rssBudgetMb} cpuPercent=${result.cpuPercent}/${cpuBudgetPercent}`)
  }
  process.stdout.write(`BENCH-WATCHDOG-SUBPROCESS PASS rssMb=${result.rssMb} cpuPercent=${result.cpuPercent}\n`)
} finally {
  await stopChild(child)
  rmSync(tempRoot, { recursive: true, force: true })
}

function positiveInt(value, fallback) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function positiveNumber(value, fallback) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function waitForInnerMarker(filePath, expectedPrefix, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
      if (parsed.writer === 'inner-watchdog' && parsed.tokenPrefix === expectedPrefix) return
    }
    await sleep(50)
  }
  throw new Error('E_TIMEOUT:inner watchdog did not write a real marker heartbeat')
}

async function sampleProcessStats(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('E_BENCH_PID_MISSING: child pid is unavailable')
  if (process.platform === 'win32') return await sampleWindowsProcessStats(pid)
  return sampleProcfsProcessStats(pid)
}

async function sampleWindowsProcessStats(pid) {
  const command = [
    `$p=Get-Process -Id ${pid} -ErrorAction Stop`,
    '[Console]::WriteLine(($p.WorkingSet64).ToString()+","+([double]$p.CPU).ToString([Globalization.CultureInfo]::InvariantCulture))'
  ].join('; ')
  const output = await execFileText('powershell.exe', ['-NoProfile', '-Command', command], 15000)
  const [rssValue, cpuValue] = output.trim().split(',')
  const rssBytes = Number(rssValue)
  const cpuSeconds = Number(cpuValue)
  if (!Number.isFinite(rssBytes) || !Number.isFinite(cpuSeconds)) throw new Error(`E_BENCH_SAMPLE_INVALID:${output.trim()}`)
  return { rssBytes, cpuSeconds }
}

function sampleProcfsProcessStats(pid) {
  const statm = readFileSync(`/proc/${pid}/statm`, 'utf8').trim().split(/\s+/)
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').trim().split(/\s+/)
  const pageSize = 4096
  const rssBytes = Number(statm[1]) * pageSize
  const clockTicksPerSecond = 100
  const userTicks = Number(stat[13])
  const systemTicks = Number(stat[14])
  const cpuSeconds = (userTicks + systemTicks) / clockTicksPerSecond
  if (!Number.isFinite(rssBytes) || !Number.isFinite(cpuSeconds)) throw new Error('E_BENCH_SAMPLE_INVALID:procfs')
  return { rssBytes, cpuSeconds }
}

async function execFileText(command, commandArgs, timeout) {
  return await new Promise((resolvePromise, rejectPromise) => {
    execFile(command, commandArgs, { windowsHide: true, timeout }, (error, stdout, stderr) => {
      if (error) {
        rejectPromise(new Error(`${error.message}${stderr ? `: ${stderr}` : ''}`))
        return
      }
      resolvePromise(stdout)
    })
  })
}

async function stopChild(childProcess) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) return
  await new Promise(resolvePromise => {
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolvePromise()
    }
    const timeout = setTimeout(() => {
      if (Number.isInteger(childProcess.pid)) childProcess.kill('SIGKILL')
      settle()
    }, 1500)
    childProcess.once('exit', settle)
    childProcess.kill('SIGTERM')
  })
}

function sleep(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms))
}
