#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DEFAULT_COMMAND = 'pnpm dev'
const DEFAULT_DURATION_SECONDS = 60
const DEFAULT_MAX_PACKETS = 0
const DEFAULT_PROCESS_SAMPLE_INTERVAL_MS = 2000
const MAX_BUFFER_BYTES = 1024 * 1024 * 16

function parseArgs(argv) {
  const options = {
    durationSeconds: DEFAULT_DURATION_SECONDS,
    maxPackets: DEFAULT_MAX_PACKETS,
    processSampleIntervalMs: DEFAULT_PROCESS_SAMPLE_INTERVAL_MS,
    command: DEFAULT_COMMAND,
    outputDir: join(projectRoot, 'out', 'zero-egress-capture'),
    preflight: false,
    selfTest: false,
    noCommand: false
  }

  for (const arg of argv) {
    if (arg === '--preflight') {
      options.preflight = true
    } else if (arg === '--self-test') {
      options.selfTest = true
    } else if (arg === '--no-command') {
      options.noCommand = true
      options.command = ''
    } else if (arg.startsWith('--duration-seconds=')) {
      options.durationSeconds = parseIntegerOption(arg, '--duration-seconds')
    } else if (arg.startsWith('--max-packets=')) {
      options.maxPackets = parseIntegerOption(arg, '--max-packets')
    } else if (arg.startsWith('--process-sample-interval-ms=')) {
      options.processSampleIntervalMs = parseIntegerOption(arg, '--process-sample-interval-ms')
    } else if (arg.startsWith('--command=')) {
      options.command = arg.slice('--command='.length).trim()
      options.noCommand = options.command.length === 0
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = resolve(projectRoot, arg.slice('--output-dir='.length))
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.durationSeconds < 1 || options.durationSeconds > 600) {
    throw new Error('--duration-seconds must be between 1 and 600')
  }
  if (options.maxPackets < 0) {
    throw new Error('--max-packets must be greater than or equal to 0')
  }
  if (options.processSampleIntervalMs < 250 || options.processSampleIntervalMs > 30_000) {
    throw new Error('--process-sample-interval-ms must be between 250 and 30000')
  }
  return options
}

function parseIntegerOption(arg, name) {
  const raw = arg.slice(`${name}=`.length)
  const value = Number(raw)
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`)
  return value
}

function run(command, args, timeoutMs = 10_000) {
  try {
    return {
      ok: true,
      status: 0,
      stdout: execFileSync(command, args, {
        cwd: projectRoot,
        encoding: 'utf8',
        maxBuffer: MAX_BUFFER_BYTES,
        timeout: timeoutMs,
        windowsHide: true
      }),
      stderr: ''
    }
  } catch (error) {
    return {
      ok: false,
      status: typeof error.status === 'number' ? error.status : 1,
      stdout: typeof error.stdout === 'string' ? error.stdout : '',
      stderr: typeof error.stderr === 'string' ? error.stderr : error instanceof Error ? error.message : String(error)
    }
  }
}

function powershell(script, timeoutMs = 10_000) {
  return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], timeoutMs)
}

function commandExists(command) {
  if (process.platform !== 'win32') return false
  return run('where.exe', [command]).ok
}

function probeAdministrator() {
  if (process.platform !== 'win32') return { user: null, isAdministrator: false }
  const probe = powershell(`
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$identity
[pscustomobject]@{
  user = $identity.Name
  isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} | ConvertTo-Json -Compress
`)
  if (!probe.ok || probe.stdout.trim().length === 0) {
    return { user: null, isAdministrator: false }
  }
  try {
    const parsed = JSON.parse(probe.stdout)
    return {
      user: typeof parsed.user === 'string' ? parsed.user : null,
      isAdministrator: parsed.isAdministrator === true
    }
  } catch {
    return { user: null, isAdministrator: false }
  }
}

function preflight() {
  const admin = probeAdministrator()
  const windows = process.platform === 'win32'
  const pktmonAvailable = commandExists('pktmon.exe')
  return {
    windows,
    pktmonAvailable,
    administrator: admin,
    ready: windows && pktmonAvailable && admin.isAdministrator
  }
}

function collectPacketFields(value, path = '$', fields = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectPacketFields(entry, `${path}[${index}]`, fields))
    return fields
  }
  if (value === null || typeof value !== 'object') return fields
  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${path}.${key}`
    if (typeof child === 'number' && /packets?/iu.test(key)) {
      fields.push({ path: nextPath, value: child })
    } else {
      collectPacketFields(child, nextPath, fields)
    }
  }
  return fields
}

function parsePktmonPacketMetrics(rawJson) {
  const parsed = JSON.parse(rawJson)
  const fields = collectPacketFields(parsed)
  if (fields.length === 0) {
    throw new Error('pktmon counters JSON did not contain packet fields')
  }
  const packetCount = fields.reduce((total, field) => total + field.value, 0)
  return { packetCount, fields }
}

function appendLimited(buffer, chunk) {
  const next = buffer + chunk
  return next.length > 16_000 ? next.slice(next.length - 16_000) : next
}

function spawnTarget(command) {
  if (!command) return null
  const child = spawn(command, {
    cwd: projectRoot,
    env: { ...process.env, DEVHUB_ZERO_EGRESS_CAPTURE: '1' },
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const log = { stdout: '', stderr: '', exitCode: null, signal: null }
  child.stdout?.on('data', chunk => {
    log.stdout = appendLimited(log.stdout, chunk.toString('utf8'))
  })
  child.stderr?.on('data', chunk => {
    log.stderr = appendLimited(log.stderr, chunk.toString('utf8'))
  })
  child.on('exit', (code, signal) => {
    log.exitCode = code
    log.signal = signal
  })
  return { child, log }
}

function killProcessTree(pid) {
  if (!pid) return
  run('taskkill.exe', ['/PID', String(pid), '/T', '/F'], 15_000)
}

function isLoopbackOrUnspecifiedAddress(value) {
  const address = String(value ?? '').trim().toLowerCase()
  return address.length === 0 ||
    address === '0.0.0.0' ||
    address === '::' ||
    address === '::0' ||
    address === '::1' ||
    address === 'localhost' ||
    address.startsWith('127.') ||
    address.startsWith('::ffff:127.')
}

function collectTargetProcessNetworkSample(rootPid) {
  if (!rootPid || process.platform !== 'win32') {
    return {
      error: rootPid ? 'process network sampling requires win32' : 'target process pid is missing',
      nonLoopbackEndpoints: [],
      nonLoopbackEndpointCount: 0,
      processIds: [],
      rootPid: rootPid ?? null,
      tcpConnections: [],
      ts: new Date().toISOString(),
      udpEndpoints: []
    }
  }

  const probe = powershell(`
$rootPid = ${Number(rootPid)}
$all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine)
$ids = New-Object 'System.Collections.Generic.HashSet[int]'
$root = $all | Where-Object { [int]$_.ProcessId -eq $rootPid } | Select-Object -First 1
if ($null -ne $root) {
  [void]$ids.Add($rootPid)
  do {
    $added = $false
    foreach ($process in $all) {
      $pidValue = [int]$process.ProcessId
      $parentPidValue = [int]$process.ParentProcessId
      if (-not $ids.Contains($pidValue) -and $ids.Contains($parentPidValue)) {
        [void]$ids.Add($pidValue)
        $added = $true
      }
    }
  } while ($added)
}
$tcp = @()
if ($ids.Count -gt 0) {
  $tcp = @(Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $ids.Contains([int]$_.OwningProcess) } | ForEach-Object {
    [pscustomobject]@{
      localAddress = $_.LocalAddress
      localPort = $_.LocalPort
      remoteAddress = $_.RemoteAddress
      remotePort = $_.RemotePort
      state = $_.State.ToString()
      owningProcess = $_.OwningProcess
    }
  })
}
$udp = @()
if ($ids.Count -gt 0) {
  $udp = @(Get-NetUDPEndpoint -ErrorAction SilentlyContinue | Where-Object { $ids.Contains([int]$_.OwningProcess) } | ForEach-Object {
    [pscustomobject]@{
      localAddress = $_.LocalAddress
      localPort = $_.LocalPort
      owningProcess = $_.OwningProcess
    }
  })
}
[pscustomobject]@{
  processIds = @($ids | Sort-Object)
  tcpConnections = $tcp
  udpEndpoints = $udp
} | ConvertTo-Json -Depth 6 -Compress
`, 20_000)

  const sample = {
    error: null,
    nonLoopbackEndpoints: [],
    nonLoopbackEndpointCount: 0,
    processIds: [],
    rootPid,
    tcpConnections: [],
    ts: new Date().toISOString(),
    udpEndpoints: []
  }

  if (!probe.ok || probe.stdout.trim().length === 0) {
    sample.error = probe.stderr || probe.stdout || 'process network sampling failed'
    return sample
  }

  try {
    const parsed = JSON.parse(probe.stdout)
    const tcpConnections = Array.isArray(parsed.tcpConnections)
      ? parsed.tcpConnections
      : parsed.tcpConnections
        ? [parsed.tcpConnections]
        : []
    const udpEndpoints = Array.isArray(parsed.udpEndpoints)
      ? parsed.udpEndpoints
      : parsed.udpEndpoints
        ? [parsed.udpEndpoints]
        : []
    sample.processIds = Array.isArray(parsed.processIds)
      ? parsed.processIds.filter(pid => Number.isInteger(Number(pid))).map(pid => Number(pid))
      : []
    sample.tcpConnections = tcpConnections
    sample.udpEndpoints = udpEndpoints
    sample.nonLoopbackEndpoints = tcpConnections.filter(connection => {
      const state = String(connection.state ?? '').toLowerCase()
      return state !== 'listen' && !isLoopbackOrUnspecifiedAddress(connection.remoteAddress)
    })
    sample.nonLoopbackEndpointCount = sample.nonLoopbackEndpoints.length
    return sample
  } catch (error) {
    sample.error = error instanceof Error ? error.message : String(error)
    return sample
  }
}

function summarizeProcessNetworkSamples(samples) {
  const nonLoopbackEndpoints = []
  const processIds = new Set()
  const errors = []
  for (const sample of samples) {
    for (const pid of sample.processIds ?? []) processIds.add(pid)
    for (const endpoint of sample.nonLoopbackEndpoints ?? []) {
      nonLoopbackEndpoints.push({ ...endpoint, observedAt: sample.ts })
    }
    if (sample.error) errors.push({ ts: sample.ts, error: sample.error })
  }
  return {
    errors,
    nonLoopbackEndpointCount: nonLoopbackEndpoints.length,
    nonLoopbackEndpoints,
    processIds: Array.from(processIds).sort((left, right) => left - right),
    sampleCount: samples.length
  }
}

async function waitAndSampleTargetNetwork(target, options) {
  const samples = []
  const endAt = Date.now() + options.durationSeconds * 1000
  while (Date.now() < endAt) {
    if (target?.child.pid) {
      samples.push(collectTargetProcessNetworkSample(target.child.pid))
    }
    const remainingMs = endAt - Date.now()
    if (remainingMs <= 0) break
    await delay(Math.min(options.processSampleIntervalMs, remainingMs))
  }
  if (target?.child.pid) {
    samples.push(collectTargetProcessNetworkSample(target.child.pid))
  }
  return samples
}

async function runCapture(options) {
  const env = preflight()
  if (!env.ready) {
    return {
      passed: false,
      blocked: true,
      reason: env.windows
        ? 'Administrator shell with pktmon access is required for a real 60-second packet capture.'
        : 'Windows pktmon capture is required for this verifier.',
      preflight: env
    }
  }

  mkdirSync(options.outputDir, { recursive: true })
  const capturedAt = new Date().toISOString()
  const safeStamp = capturedAt.replace(/[:.]/g, '-')
  const countersPath = join(options.outputDir, `pktmon-counters-${safeStamp}.json`)
  const reportPath = join(options.outputDir, `zero-egress-report-${safeStamp}.json`)
  let startedPktmon = false
  let target = null

  try {
    const reset = run('pktmon.exe', ['reset'], 15_000)
    if (!reset.ok) throw new Error(`pktmon reset failed: ${reset.stderr || reset.stdout}`)

    const start = run('pktmon.exe', ['start', '--counters-only', '--comp', 'nics'], 15_000)
    if (!start.ok) throw new Error(`pktmon start failed: ${start.stderr || start.stdout}`)
    startedPktmon = true

    target = spawnTarget(options.command)
    const processNetworkSamples = await waitAndSampleTargetNetwork(target, options)

    const counters = run('pktmon.exe', ['counters', '--json'], 30_000)
    if (!counters.ok) throw new Error(`pktmon counters failed: ${counters.stderr || counters.stdout}`)
    writeFileSync(countersPath, counters.stdout)

    const metrics = parsePktmonPacketMetrics(counters.stdout)
    const packetCount = metrics.packetCount
    const globalPassed = packetCount <= options.maxPackets
    const processNetwork = summarizeProcessNetworkSamples(processNetworkSamples)
    const targetExitedEarly = target !== null && target.log.exitCode !== null
    const appScopedPassed = options.noCommand
      ? globalPassed
      : target !== null &&
        !targetExitedEarly &&
        processNetwork.errors.length === 0 &&
        processNetwork.processIds.length > 0 &&
        processNetwork.nonLoopbackEndpointCount === 0
    const passed = options.noCommand ? globalPassed : appScopedPassed
    const report = {
      schemaVersion: 'devhub-zero-egress-capture-v1',
      appScopedPassed,
      capturedAt,
      durationSeconds: options.durationSeconds,
      command: options.command || null,
      globalPacketCount: packetCount,
      globalPassed,
      maxPackets: options.maxPackets,
      packetCount,
      passed,
      blocked: false,
      preflight: env,
      artifacts: {
        countersPath,
        reportPath
      },
      target: target
        ? {
            pid: target.child.pid ?? null,
            exitCode: target.log.exitCode,
            signal: target.log.signal,
            stdoutTail: target.log.stdout,
            stderrTail: target.log.stderr
          }
        : null,
      processNetwork,
      processNetworkSamples,
      processSampleIntervalMs: options.processSampleIntervalMs,
      packetFields: metrics.fields
    }
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    return report
  } finally {
    if (startedPktmon) run('pktmon.exe', ['stop'], 30_000)
    if (target?.child.pid) killProcessTree(target.child.pid)
  }
}

function runSelfTest() {
  assert.equal(parseArgs([]).durationSeconds, 60)
  assert.equal(parseArgs(['--duration-seconds=2', '--max-packets=0', '--no-command']).command, '')
  assert.equal(parseArgs(['--process-sample-interval-ms=250']).processSampleIntervalMs, 250)
  assert.deepEqual(
    parsePktmonPacketMetrics(JSON.stringify({ adapters: [{ counters: { Packets: 0, Bytes: 128, DroppedPackets: 0 } }] })).fields.map(field => field.value),
    [0, 0]
  )
  assert.equal(
    parsePktmonPacketMetrics(JSON.stringify({ adapters: [{ counters: { RxPackets: 2, TxPackets: 3 } }] })).packetCount,
    5
  )
  assert.equal(isLoopbackOrUnspecifiedAddress('127.0.0.1'), true)
  assert.equal(isLoopbackOrUnspecifiedAddress('::1'), true)
  assert.equal(isLoopbackOrUnspecifiedAddress('0.0.0.0'), true)
  assert.equal(isLoopbackOrUnspecifiedAddress('8.8.8.8'), false)
  assert.equal(
    summarizeProcessNetworkSamples([
      {
        error: null,
        nonLoopbackEndpoints: [],
        processIds: [10, 11],
        ts: '2026-01-01T00:00:00.000Z'
      },
      {
        error: null,
        nonLoopbackEndpoints: [{ remoteAddress: '203.0.113.1', remotePort: 443 }],
        processIds: [11, 12],
        ts: '2026-01-01T00:00:01.000Z'
      }
    ]).nonLoopbackEndpointCount,
    1
  )
  console.log('Zero-egress capture verifier self-test passed.')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.selfTest) {
    runSelfTest()
    return
  }

  if (options.preflight) {
    const result = preflight()
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.ready ? 0 : 2)
  }

  const report = await runCapture(options)
  console.log(JSON.stringify(report, null, 2))
  if (report.blocked) process.exit(2)
  process.exit(report.passed ? 0 : 1)
}

await main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
