#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DEFAULT_OUTPUT_DIR = join(projectRoot, 'out', 'browserwindow-second-display')
const DEFAULT_WIDTH = 480
const DEFAULT_HEIGHT = 320
const ELECTRON_PROBE_TIMEOUT_MS = 45_000

function parseArgs(argv) {
  const options = {
    height: DEFAULT_HEIGHT,
    outputDir: DEFAULT_OUTPUT_DIR,
    preflight: false,
    selfTest: false,
    width: DEFAULT_WIDTH
  }

  for (const arg of argv) {
    if (arg === '--preflight') {
      options.preflight = true
    } else if (arg === '--self-test') {
      options.selfTest = true
    } else if (arg.startsWith('--height=')) {
      options.height = parseIntegerOption(arg, '--height')
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = resolve(projectRoot, arg.slice('--output-dir='.length))
    } else if (arg.startsWith('--width=')) {
      options.width = parseIntegerOption(arg, '--width')
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.width < 100 || options.width > 2400) {
    throw new Error('--width must be between 100 and 2400')
  }
  if (options.height < 100 || options.height > 1600) {
    throw new Error('--height must be between 100 and 1600')
  }
  return options
}

function parseIntegerOption(arg, name) {
  const raw = arg.slice(`${name}=`.length)
  const value = Number(raw)
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`)
  return value
}

function normalizeRect(value) {
  const rect = value && typeof value === 'object' ? value : {}
  return {
    height: Number.isFinite(rect.height) ? rect.height : 0,
    width: Number.isFinite(rect.width) ? rect.width : 0,
    x: Number.isFinite(rect.x) ? rect.x : 0,
    y: Number.isFinite(rect.y) ? rect.y : 0
  }
}

function rectInside(innerValue, outerValue) {
  const inner = normalizeRect(innerValue)
  const outer = normalizeRect(outerValue)
  return inner.width > 0 &&
    inner.height > 0 &&
    outer.width > 0 &&
    outer.height > 0 &&
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
}

function evaluateBrowserWindowPlacement(input) {
  const displays = Array.isArray(input.displays) ? input.displays : []
  const targetMode = input.targetMode === 'single-display-fallback' ? 'single-display-fallback' : 'secondary-display'
  const targetDisplay = input.targetDisplay ?? null
  const primaryDisplay = input.primaryDisplay ?? null
  const matchedDisplay = input.matchedDisplay ?? null
  const browserWindowBounds = normalizeRect(input.browserWindowBounds)
  const targetWorkArea = normalizeRect(targetDisplay?.workArea ?? targetDisplay?.bounds)
  const targetDisplayId = targetDisplay?.id ?? null
  const primaryDisplayId = primaryDisplay?.id ?? null
  const matchedDisplayId = matchedDisplay?.id ?? null
  const targetDisplayIsSecondary = targetDisplayId !== null &&
    primaryDisplayId !== null &&
    targetDisplayId !== primaryDisplayId
  const targetDisplayMatched = targetDisplayId !== null &&
    matchedDisplayId !== null &&
    targetDisplayId === matchedDisplayId
  const browserWindowInsideTargetWorkArea = rectInside(browserWindowBounds, targetWorkArea)
  const singleDisplayFallback = targetMode === 'single-display-fallback' &&
    displays.length === 1 &&
    targetDisplayId !== null &&
    primaryDisplayId !== null &&
    targetDisplayId === primaryDisplayId
  const targetDisplayAccepted = targetMode === 'secondary-display'
    ? targetDisplayIsSecondary
    : singleDisplayFallback
  return {
    browserWindowInsideTargetWorkArea,
    displayCount: displays.length,
    matchedDisplayId,
    passed: displays.length >= 1 &&
      targetDisplayAccepted &&
      targetDisplayMatched &&
      browserWindowInsideTargetWorkArea,
    primaryDisplayId,
    singleDisplayFallback,
    targetDisplayId,
    targetDisplayIsSecondary,
    targetDisplayMatched,
    targetMode
  }
}

function getElectronExecutablePath() {
  const require = createRequire(import.meta.url)
  const electronPath = require('electron')
  assert.equal(typeof electronPath, 'string', 'electron package must resolve to an executable path')
  return electronPath
}

function buildElectronProbeSource(options) {
  return `
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs')

const options = ${JSON.stringify(options)}
const normalizeRect = ${normalizeRect.toString()}
const rectInside = ${rectInside.toString()}
const evaluateBrowserWindowPlacement = ${evaluateBrowserWindowPlacement.toString()}

function summarizeDisplay(display) {
  return {
    bounds: normalizeRect(display.bounds),
    id: display.id,
    internal: display.internal === true,
    label: typeof display.label === 'string' ? display.label : '',
    primary: false,
    scaleFactor: Number.isFinite(display.scaleFactor) ? display.scaleFactor : null,
    workArea: normalizeRect(display.workArea)
  }
}

function markPrimary(displays, primaryDisplayId) {
  return displays.map(display => ({
    ...display,
    primary: display.id === primaryDisplayId
  }))
}

function writeReport(report) {
  fs.mkdirSync(require('node:path').dirname(options.reportPath), { recursive: true })
  fs.writeFileSync(options.reportPath, JSON.stringify(report, null, 2) + '\\n', 'utf8')
  console.log(JSON.stringify(report, null, 2))
}

function buildBlockedReport(capturedAt, reason, extra = {}) {
  return {
    schemaVersion: 'devhub-browserwindow-second-display-v1',
    blocked: true,
    capturedAt,
    passed: false,
    reason,
    ...extra
  }
}

async function main() {
  const capturedAt = new Date().toISOString()
  await app.whenReady()
  const rawDisplays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const displays = markPrimary(rawDisplays.map(summarizeDisplay), primary.id)
  const primaryDisplay = displays.find(display => display.id === primary.id) ?? null
  const secondary = displays.find(display => display.id !== primary.id) ?? null
  const targetDisplay = secondary ?? primaryDisplay
  const targetMode = secondary ? 'secondary-display' : 'single-display-fallback'

  if (options.preflight) {
    const report = {
      schemaVersion: 'devhub-browserwindow-second-display-v1',
      blocked: displays.length < 1,
      capturedAt,
      displayCount: displays.length,
      displays,
      passed: false,
      preflightOnly: true,
      primaryDisplay,
      ready: displays.length >= 1,
      targetMode,
      reason: displays.length >= 2
        ? 'At least two renderable Electron displays are available; secondary-display verification can run.'
        : displays.length === 1
          ? 'One renderable Electron display is available; single-display fallback placement verification can run.'
          : 'At least one renderable Electron display is required before BrowserWindow placement can run.'
    }
    writeReport(report)
    app.quit()
    process.exit(report.ready ? 0 : 2)
  }

  if (!targetDisplay || !primaryDisplay) {
    writeReport(buildBlockedReport(
      capturedAt,
      'At least one renderable Electron display is required before BrowserWindow placement can run.',
      {
        displayCount: displays.length,
        displays,
        primaryDisplay,
        targetDisplay: null
      }
    ))
    app.quit()
    process.exit(2)
  }

  const targetWorkArea = normalizeRect(targetDisplay.workArea)
  const width = Math.min(options.width, Math.max(100, targetWorkArea.width - 40))
  const height = Math.min(options.height, Math.max(100, targetWorkArea.height - 40))
  const windowOptions = {
    backgroundColor: '#111111',
    frame: false,
    height,
    show: false,
    title: 'DevHub R8 BrowserWindow Second Display Verification',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    width,
    x: targetWorkArea.x + 20,
    y: targetWorkArea.y + 20
  }
  const window = new BrowserWindow(windowOptions)
  await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><meta charset="utf-8"><title>DevHub R8 verification</title><main>BrowserWindow second-display verification</main>'))
  const browserWindowBounds = normalizeRect(window.getBounds())
  const matchedDisplay = summarizeDisplay(screen.getDisplayMatching(browserWindowBounds))
  const placement = evaluateBrowserWindowPlacement({
    browserWindowBounds,
    displays,
    matchedDisplay,
    primaryDisplay,
    targetDisplay,
    targetMode
  })
  const report = {
    schemaVersion: 'devhub-browserwindow-second-display-v1',
    blocked: false,
    browserWindowBounds,
    capturedAt,
    displayCount: displays.length,
    displays,
    matchedDisplay,
    passed: placement.passed,
    placement,
    primaryDisplay,
    targetDisplay,
    targetMode,
    windowOptions
  }
  writeReport(report)
  window.destroy()
  app.quit()
  process.exit(report.passed ? 0 : 1)
}

main().catch(error => {
  writeReport(buildBlockedReport(new Date().toISOString(), error instanceof Error ? error.message : String(error)))
  app.quit()
  process.exit(1)
})
`
}

function runElectronProbe(options) {
  mkdirSync(options.outputDir, { recursive: true })
  const capturedAt = new Date().toISOString()
  const safeStamp = capturedAt.replace(/[:.]/g, '-')
  const reportPath = join(options.outputDir, `browserwindow-second-display-report-${safeStamp}.json`)
  const tempRoot = mkdtempSync(join(tmpdir(), 'devhub-browserwindow-second-display-'))
  const probePath = join(tempRoot, 'probe.cjs')
  try {
    writeFileSync(probePath, buildElectronProbeSource({ ...options, reportPath }), 'utf8')
    const result = spawnSync(getElectronExecutablePath(), [probePath], {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: ELECTRON_PROBE_TIMEOUT_MS,
      windowsHide: true
    })
    const stdout = result.stdout ?? ''
    const stderr = result.stderr ?? ''
    const status = typeof result.status === 'number' ? result.status : 1
    let report = null
    try {
      report = JSON.parse(readFileSync(reportPath, 'utf8'))
    } catch {
      report = {
        schemaVersion: 'devhub-browserwindow-second-display-v1',
        blocked: true,
        capturedAt,
        passed: false,
        reason: stderr || stdout || 'Electron BrowserWindow verifier did not produce a report.'
      }
    }
    return { report, status }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

function runSelfTest() {
  assert.equal(parseArgs([]).width, DEFAULT_WIDTH)
  assert.equal(parseArgs(['--width=320', '--height=240']).height, 240)
  const primaryDisplay = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }
  const targetDisplay = { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, workArea: { x: 1920, y: 0, width: 1920, height: 1040 } }
  const pass = evaluateBrowserWindowPlacement({
    browserWindowBounds: { x: 1940, y: 20, width: 480, height: 320 },
    displays: [primaryDisplay, targetDisplay],
    matchedDisplay: targetDisplay,
    primaryDisplay,
    targetDisplay
  })
  assert.equal(pass.passed, true)
  assert.equal(pass.targetDisplayMatched, true)
  assert.equal(pass.browserWindowInsideTargetWorkArea, true)
  const wrongDisplay = evaluateBrowserWindowPlacement({
    browserWindowBounds: { x: 20, y: 20, width: 480, height: 320 },
    displays: [primaryDisplay, targetDisplay],
    matchedDisplay: primaryDisplay,
    primaryDisplay,
    targetDisplay
  })
  assert.equal(wrongDisplay.passed, false)
  assert.equal(wrongDisplay.targetDisplayMatched, false)
  const oneDisplay = evaluateBrowserWindowPlacement({
    browserWindowBounds: { x: 20, y: 20, width: 480, height: 320 },
    displays: [primaryDisplay],
    matchedDisplay: primaryDisplay,
    primaryDisplay,
    targetDisplay: primaryDisplay,
    targetMode: 'single-display-fallback'
  })
  assert.equal(oneDisplay.passed, true)
  assert.equal(oneDisplay.singleDisplayFallback, true)
  assert.equal(rectInside({ x: 5, y: 5, width: 10, height: 10 }, { x: 0, y: 0, width: 20, height: 20 }), true)
  assert.equal(rectInside({ x: 15, y: 15, width: 10, height: 10 }, { x: 0, y: 0, width: 20, height: 20 }), false)
  console.log('BrowserWindow second-display verifier self-test passed.')
}

const options = parseArgs(process.argv.slice(2))
if (options.selfTest) {
  runSelfTest()
} else {
  const { report } = runElectronProbe(options)
  if (!report.blocked) {
    process.exit(report.passed ? 0 : 1)
  }
  process.exit(report.ready ? 0 : 2)
}
