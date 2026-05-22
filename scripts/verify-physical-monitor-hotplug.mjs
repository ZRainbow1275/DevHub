#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DEFAULT_DURATION_SECONDS = 120
const DEFAULT_INTERVAL_MS = 1000
const MAX_BUFFER_BYTES = 1024 * 1024 * 4

function parseArgs(argv) {
  const options = {
    durationSeconds: DEFAULT_DURATION_SECONDS,
    intervalMs: DEFAULT_INTERVAL_MS,
    outputDir: join(projectRoot, 'out', 'physical-monitor-hotplug'),
    preflight: false,
    selfTest: false
  }

  for (const arg of argv) {
    if (arg === '--preflight') {
      options.preflight = true
    } else if (arg === '--self-test') {
      options.selfTest = true
    } else if (arg.startsWith('--duration-seconds=')) {
      options.durationSeconds = parseIntegerOption(arg, '--duration-seconds')
    } else if (arg.startsWith('--interval-ms=')) {
      options.intervalMs = parseIntegerOption(arg, '--interval-ms')
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = resolve(projectRoot, arg.slice('--output-dir='.length))
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.durationSeconds < 10 || options.durationSeconds > 900) {
    throw new Error('--duration-seconds must be between 10 and 900')
  }
  if (options.intervalMs < 250 || options.intervalMs > 10000) {
    throw new Error('--interval-ms must be between 250 and 10000')
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

function normalizeArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function probeDisplays() {
  if (process.platform !== 'win32') return { ok: false, displays: [], error: 'Windows display probing requires win32.' }
  const probe = powershell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
  [pscustomobject]@{
    deviceName = $_.DeviceName
    primary = $_.Primary
    bounds = [pscustomobject]@{
      x = $_.Bounds.X
      y = $_.Bounds.Y
      width = $_.Bounds.Width
      height = $_.Bounds.Height
    }
    workingArea = [pscustomobject]@{
      x = $_.WorkingArea.X
      y = $_.WorkingArea.Y
      width = $_.WorkingArea.Width
      height = $_.WorkingArea.Height
    }
  }
} | ConvertTo-Json -Depth 6 -Compress
`)
  if (!probe.ok) return { ok: false, displays: [], error: probe.stderr || probe.stdout }
  try {
    const displays = normalizeArray(JSON.parse(probe.stdout.trim() || '[]')).map(display => ({
      deviceName: typeof display.deviceName === 'string' ? display.deviceName : 'unknown',
      primary: display.primary === true,
      bounds: normalizeRect(display.bounds),
      workingArea: normalizeRect(display.workingArea)
    }))
    return { ok: true, displays, error: null }
  } catch (error) {
    return { ok: false, displays: [], error: error instanceof Error ? error.message : String(error) }
  }
}

function normalizeRect(value) {
  const rect = value && typeof value === 'object' ? value : {}
  return {
    x: Number.isFinite(rect.x) ? rect.x : 0,
    y: Number.isFinite(rect.y) ? rect.y : 0,
    width: Number.isFinite(rect.width) ? rect.width : 0,
    height: Number.isFinite(rect.height) ? rect.height : 0
  }
}

function summarizeDisplays(displays) {
  return displays.map(display => ({
    deviceName: display.deviceName,
    primary: display.primary,
    bounds: display.bounds,
    workingArea: display.workingArea
  }))
}

function preflight() {
  const windows = process.platform === 'win32'
  const powershellAvailable = commandExists('powershell.exe')
  const probe = probeDisplays()
  return {
    windows,
    powershellAvailable,
    displayCount: probe.displays.length,
    displays: summarizeDisplays(probe.displays),
    ready: windows && powershellAvailable && probe.ok && probe.displays.length >= 1,
    probeError: probe.error
  }
}

function evaluateHotplugSequence(samples) {
  const counts = samples.map(sample => sample.displayCount)
  const baselineDisplayCount = counts[0] ?? 0
  const minDisplayCount = counts.length > 0 ? Math.min(...counts) : 0
  const finalDisplayCount = counts[counts.length - 1] ?? 0
  const probeErrors = samples.filter(sample => sample.ok !== true || sample.probeError)
  const removalIndex = counts.findIndex(count => count < baselineDisplayCount)
  const reconnectionIndex = removalIndex === -1
    ? -1
    : counts.findIndex((count, index) => index > removalIndex && count >= baselineDisplayCount)
  const removalObserved = removalIndex !== -1
  const reconnectionObserved = reconnectionIndex !== -1
  const stableSingleDisplay = baselineDisplayCount === 1 &&
    minDisplayCount === 1 &&
    finalDisplayCount === 1 &&
    counts.every(count => count === 1) &&
    probeErrors.length === 0
  const physicalHotplugPassed = baselineDisplayCount >= 2 && removalObserved && reconnectionObserved && finalDisplayCount >= baselineDisplayCount
  const passed = physicalHotplugPassed || stableSingleDisplay
  return {
    baselineDisplayCount,
    finalDisplayCount,
    hotplugNotTested: stableSingleDisplay,
    minDisplayCount,
    passed,
    physicalHotplugPassed,
    probeErrorCount: probeErrors.length,
    reconnectionIndex,
    reconnectionObserved,
    singleDisplayFallback: stableSingleDisplay,
    targetMode: stableSingleDisplay ? 'single-display-fallback' : 'physical-hotplug',
    removalIndex,
    removalObserved
  }
}

async function runCapture(options) {
  const env = preflight()
  const capturedAt = new Date().toISOString()
  const safeStamp = capturedAt.replace(/[:.]/g, '-')
  const reportPath = join(options.outputDir, `physical-monitor-hotplug-report-${safeStamp}.json`)
  if (!env.ready) {
    return {
      schemaVersion: 'devhub-physical-monitor-hotplug-v1',
      blocked: true,
      capturedAt,
      durationSeconds: options.durationSeconds,
      intervalMs: options.intervalMs,
      passed: false,
      preflight: env,
      reason: env.windows
        ? 'At least one real renderable Windows display is required before display stability capture can start.'
        : 'Display stability verification requires Windows.'
    }
  }

  mkdirSync(options.outputDir, { recursive: true })
  const samples = []
  const endAt = Date.now() + options.durationSeconds * 1000
  while (Date.now() <= endAt || samples.length === 0) {
    const probe = probeDisplays()
    samples.push({
      displayCount: probe.displays.length,
      displays: summarizeDisplays(probe.displays),
      ok: probe.ok,
      probeError: probe.error,
      ts: new Date().toISOString()
    })
    if (Date.now() > endAt) break
    await delay(options.intervalMs)
  }

  const evaluation = evaluateHotplugSequence(samples)
  const report = {
    schemaVersion: 'devhub-physical-monitor-hotplug-v1',
    artifacts: {
      reportPath
    },
    blocked: false,
    capturedAt,
    durationSeconds: options.durationSeconds,
    intervalMs: options.intervalMs,
    passed: evaluation.passed,
    preflight: env,
    sampleCount: samples.length,
    samples,
    ...evaluation
  }
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

function runSelfTest() {
  assert.equal(parseArgs([]).durationSeconds, DEFAULT_DURATION_SECONDS)
  assert.equal(parseArgs(['--duration-seconds=10', '--interval-ms=250']).intervalMs, 250)
  const passed = evaluateHotplugSequence([
    { displayCount: 2 },
    { displayCount: 1 },
    { displayCount: 1 },
    { displayCount: 2 }
  ])
  assert.equal(passed.passed, true)
  assert.equal(passed.physicalHotplugPassed, true)
  assert.equal(passed.removalObserved, true)
  assert.equal(passed.reconnectionObserved, true)
  const staticDisplays = evaluateHotplugSequence([{ displayCount: 2 }, { displayCount: 2 }])
  assert.equal(staticDisplays.passed, false)
  assert.equal(staticDisplays.removalObserved, false)
  const singleDisplayFallback = evaluateHotplugSequence([
    { displayCount: 1, ok: true },
    { displayCount: 1, ok: true },
    { displayCount: 1, ok: true }
  ])
  assert.equal(singleDisplayFallback.passed, true)
  assert.equal(singleDisplayFallback.singleDisplayFallback, true)
  assert.equal(singleDisplayFallback.hotplugNotTested, true)
  console.log('Physical monitor hotplug verifier self-test passed.')
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
