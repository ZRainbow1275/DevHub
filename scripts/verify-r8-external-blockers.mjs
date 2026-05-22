import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const externalBlockerReportSchemaVersion = 'devhub-r8-external-blockers-v1'

function run(command, args, timeoutMs = 10000) {
  try {
    return {
      ok: true,
      status: 0,
      stdout: execFileSync(command, args, {
        encoding: 'utf8',
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

function powershell(script, timeoutMs) {
  return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], timeoutMs)
}

function parseJsonProbe(probe, fallback) {
  if (!probe.ok || probe.stdout.trim().length === 0) return fallback
  try {
    return JSON.parse(probe.stdout)
  } catch {
    return fallback
  }
}

function parseJsonStdout(probe, fallback) {
  if (probe.stdout.trim().length === 0) return fallback
  try {
    return JSON.parse(probe.stdout)
  } catch {
    return fallback
  }
}

function normalizeArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function parseArguments(argv) {
  const quiet = argv.includes('--quiet')
  const selfTest = argv.includes('--self-test')
  const writeReportIndex = argv.indexOf('--write-report')
  if (writeReportIndex === -1) return { quiet, selfTest, writeReportPath: null }
  const candidatePath = argv[writeReportIndex + 1]
  return {
    quiet,
    selfTest,
    writeReportPath: candidatePath && !candidatePath.startsWith('--')
      ? resolve(process.cwd(), candidatePath)
      : resolve(rootDir, 'docs/r8/external-blockers-current.json')
  }
}

const externalBlockerReportCommand = [
  'pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json'
].join(' && ')

const zeroEgressCaptureCommand = [
  'pnpm -C devhub check:zero-egress-capture'
].join(' && ')

const browserWindowSecondDisplayCommand = [
  'pnpm -C devhub check:browserwindow-second-display'
].join(' && ')

const physicalMonitorHotplugCommand = [
  'pnpm -C devhub check:physical-monitor-hotplug'
].join(' && ')

const MAX_EXTERNAL_ARTIFACT_AGE_MS = 60 * 60 * 1000

const EXTERNAL_GATE_RUNBOOK = {
  ASSERT_BROWSERWINDOW_SECOND_DISPLAY: {
    blockerKind: 'hardware',
    owner: 'operator',
    prerequisite: 'Use the current real Windows display topology. A secondary display proves the strict multi-display path; a single display proves the local fallback placement path without pretending a second display exists.',
    verificationCommand: browserWindowSecondDisplayCommand,
    requiredEvidence: 'A fresh devhub-browserwindow-second-display-v1 report records a real BrowserWindow placed inside the selected display work area, with targetMode showing either secondary-display or single-display-fallback.',
    unblockRule: 'Do not close with virtual, inferred, display-enumeration-only, or documented-only evidence; the BrowserWindow placement report must pass.'
  },
  R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY: {
    blockerKind: 'hardware',
    owner: 'operator',
    prerequisite: 'Use the current real Windows display topology. A secondary display can prove physical unplug/reconnect; a single display can prove local stable-display fallback for this machine.',
    verificationCommand: physicalMonitorHotplugCommand,
    requiredEvidence: 'A live run captures either a physical display removal/reconnection sequence or a single-display-fallback stability sequence with real sampled display state.',
    unblockRule: 'Do not close from registry-only, static one-shot display enumeration, or fake display sources.'
  },
  R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY: {
    blockerKind: 'os-event',
    owner: 'operator',
    prerequisite: 'Create at least two Windows virtual desktops and opt in to the foreground watch by setting DEVHUB_R8_VD_FOREGROUND_WATCH=1 for the verification shell.',
    verificationCommand: externalBlockerReportCommand,
    requiredEvidence: 'The report shows registryDesktopCount >= 2, foregroundHookOptIn=true, and a real Windows virtual desktop switch event stream was observed.',
    unblockRule: 'Do not close from static registry state alone; a live switch event must be observed.'
  },
  R8C_SPEC17_ADMIN_SHELL: {
    blockerKind: 'privilege',
    owner: 'operator',
    prerequisite: 'Open an Administrator shell in the repository root.',
    verificationCommand: externalBlockerReportCommand,
    requiredEvidence: 'The administrator probe reports the current Windows identity with isAdministrator=true.',
    unblockRule: 'Do not close from a non-elevated shell.'
  },
  R8C_SPEC17_WINDOWS_SERVICE_INSTALLED: {
    blockerKind: 'privilege',
    owner: 'operator',
    prerequisite: 'Run the real watchdog Windows Service install flow from an Administrator shell and leave the service installed for verification.',
    verificationCommand: externalBlockerReportCommand,
    requiredEvidence: 'Get-Service/sc.exe report devhub-watchdog installed with a real service status and scExitCode=0.',
    unblockRule: 'Do not close from installer dry-run output or service name assumptions.'
  },
  H1_J16_ZERO_EGRESS_CAPTURE_READY: {
    blockerKind: 'network-capture',
    owner: 'operator',
    prerequisite: 'Run on Windows from an Administrator shell with pktmon available.',
    verificationCommand: zeroEgressCaptureCommand,
    requiredEvidence: 'The 60-second live capture around pnpm dev completes with Administrator pktmon evidence and records appScopedPassed=true with zero non-loopback endpoints for the target process tree.',
    unblockRule: 'Do not close from preflight alone, whole-machine packet counters alone, or non-admin reports; the live app-scoped zero-egress capture must pass.'
  }
}

function attachGateRunbook(gate) {
  const runbook = EXTERNAL_GATE_RUNBOOK[gate.id]
  if (!runbook) return gate
  return { ...gate, runbook }
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function probeDisplays() {
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
} | ConvertTo-Json -Depth 6
`)
  return normalizeArray(parseJsonProbe(probe, []))
}

function probeAdministrator() {
  const probe = powershell(`
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$identity
[pscustomobject]@{
  user = $identity.Name
  isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} | ConvertTo-Json -Compress
`)
  const parsed = parseJsonProbe(probe, { user: null, isAdministrator: false })
  return {
    user: typeof parsed.user === 'string' ? parsed.user : null,
    isAdministrator: parsed.isAdministrator === true
  }
}

function assertServiceName(value) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error('service name must contain only letters, numbers, dot, underscore, or dash')
  }
}

function probeService(serviceName) {
  assertServiceName(serviceName)
  const probe = powershell(`
$service = Get-Service -Name '${serviceName}' -ErrorAction SilentlyContinue
if ($null -eq $service) {
  [pscustomobject]@{
    installed = $false
    status = 'not-installed'
    displayName = $null
    serviceType = $null
  } | ConvertTo-Json -Compress
  exit
}
[pscustomobject]@{
  installed = $true
  status = $service.Status.ToString()
  displayName = $service.DisplayName
  serviceType = $service.ServiceType.ToString()
} | ConvertTo-Json -Compress
`)
  const parsed = parseJsonProbe(probe, {
    installed: false,
    status: probe.ok ? 'unknown' : 'query-failed',
    displayName: null,
    serviceType: null
  })
  const scProbe = run('sc.exe', ['query', serviceName])
  return {
    installed: parsed.installed === true,
    status: typeof parsed.status === 'string' ? parsed.status : 'unknown',
    displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
    serviceType: typeof parsed.serviceType === 'string' ? parsed.serviceType : null,
    scExitCode: scProbe.status
  }
}

function probeVirtualDesktopRegistry() {
  const probe = powershell(`
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VirtualDesktops')
if ($null -eq $key) {
  [pscustomobject]@{ count = 0; ids = @(); available = $false } | ConvertTo-Json -Compress
  exit
}
$bytes = $key.GetValue('VirtualDesktopIDs')
$ids = @()
if ($null -ne $bytes -and $bytes.Length -ge 16) {
  for ($i = 0; $i -le ($bytes.Length - 16); $i += 16) {
    $slice = New-Object byte[] 16
    [Array]::Copy($bytes, $i, $slice, 0, 16)
    $ids += ([Guid]::new($slice).ToString('D').ToLowerInvariant())
  }
}
[pscustomobject]@{ count = $ids.Count; ids = $ids; available = $true } | ConvertTo-Json -Compress
`)
  const parsed = parseJsonProbe(probe, { count: 0, ids: [], available: false })
  return {
    available: parsed.available === true,
    count: Number.isInteger(parsed.count) ? parsed.count : 0,
    ids: normalizeArray(parsed.ids).filter(id => typeof id === 'string')
  }
}

function probeProjectLicense() {
  const packageJson = readJsonFile(resolve(rootDir, 'package.json'), {})
  const licenseFilePath = resolve(rootDir, 'LICENSE')
  const licenseFileFirstLine = existsSync(licenseFilePath)
    ? readFileSync(licenseFilePath, 'utf8').split(/\r?\n/, 1)[0]?.trim() ?? ''
    : ''

  return {
    packageJsonLicense: typeof packageJson.license === 'string' ? packageJson.license : null,
    licenseFileExists: existsSync(licenseFilePath),
    licenseFileFirstLine
  }
}

function normalizeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function reportAgeMs(report, stats) {
  const timestamp = typeof report.capturedAt === 'string'
    ? Date.parse(report.capturedAt)
    : typeof report.generatedAt === 'string'
      ? Date.parse(report.generatedAt)
      : Number.NaN
  if (Number.isFinite(timestamp)) return Math.max(0, Date.now() - timestamp)
  if (stats?.mtimeMs) return Math.max(0, Date.now() - stats.mtimeMs)
  return Number.POSITIVE_INFINITY
}

function findLatestJsonReport(baseDir, relativeDir, filePrefix) {
  const reportDir = resolve(baseDir, relativeDir)
  if (!existsSync(reportDir)) {
    return { error: 'report-directory-missing', exists: false, report: null, reportPath: null, stats: null }
  }
  const reports = readdirSync(reportDir)
    .filter(fileName => fileName.startsWith(filePrefix) && fileName.endsWith('.json'))
    .map(fileName => {
      const reportPath = resolve(reportDir, fileName)
      return { fileName, reportPath, stats: statSync(reportPath) }
    })
    .filter(entry => entry.stats.isFile())
    .sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs || right.fileName.localeCompare(left.fileName))
  if (reports.length === 0) {
    return { error: 'report-file-missing', exists: false, report: null, reportPath: null, stats: null }
  }

  const latest = reports[0]
  try {
    return {
      error: null,
      exists: true,
      report: JSON.parse(readFileSync(latest.reportPath, 'utf8')),
      reportPath: latest.reportPath,
      stats: latest.stats
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      exists: true,
      report: null,
      reportPath: latest.reportPath,
      stats: latest.stats
    }
  }
}

function inspectBrowserWindowSecondDisplayReport(baseDir = rootDir) {
  const latest = findLatestJsonReport(baseDir, 'out/browserwindow-second-display', 'browserwindow-second-display-report-')
  if (!latest.report) {
    return {
      ageMs: null,
      displayCount: null,
      error: latest.error,
      exists: latest.exists,
      reportPath: latest.reportPath,
      valid: false
    }
  }
  const report = latest.report
  const age = reportAgeMs(report, latest.stats)
  const placement = report.placement && typeof report.placement === 'object' ? report.placement : {}
  const targetMode = typeof report.targetMode === 'string'
    ? report.targetMode
    : typeof placement.targetMode === 'string'
      ? placement.targetMode
      : null
  const placementModeAccepted = placement.targetDisplayIsSecondary === true ||
    (targetMode === 'single-display-fallback' && placement.singleDisplayFallback === true)
  const valid = report.schemaVersion === 'devhub-browserwindow-second-display-v1' &&
    latest.stats.mtimeMs <= Date.now() + 5 * 60 * 1000 &&
    age <= MAX_EXTERNAL_ARTIFACT_AGE_MS &&
    report.blocked === false &&
    report.passed === true &&
    placement.passed === true &&
    normalizeNumber(report.displayCount) >= 1 &&
    placementModeAccepted &&
    placement.targetDisplayMatched === true &&
    placement.browserWindowInsideTargetWorkArea === true
  return {
    ageMs: age,
    displayCount: normalizeNumber(report.displayCount),
    error: valid ? null : 'browserwindow-second-display-report-invalid-or-stale',
    exists: true,
    matchedDisplayId: placement.matchedDisplayId ?? null,
    reportPath: latest.reportPath,
    targetDisplayId: placement.targetDisplayId ?? null,
    targetMode,
    valid
  }
}

function inspectPhysicalMonitorHotplugReport(baseDir = rootDir) {
  const latest = findLatestJsonReport(baseDir, 'out/physical-monitor-hotplug', 'physical-monitor-hotplug-report-')
  if (!latest.report) {
    return {
      ageMs: null,
      error: latest.error,
      exists: latest.exists,
      reportPath: latest.reportPath,
      valid: false
    }
  }
  const report = latest.report
  const age = reportAgeMs(report, latest.stats)
  const baselineDisplayCount = normalizeNumber(report.baselineDisplayCount)
  const minDisplayCount = normalizeNumber(report.minDisplayCount)
  const finalDisplayCount = normalizeNumber(report.finalDisplayCount)
  const physicalHotplugPassed = baselineDisplayCount >= 2 &&
    minDisplayCount < baselineDisplayCount &&
    finalDisplayCount >= baselineDisplayCount &&
    report.removalObserved === true &&
    report.reconnectionObserved === true
  const singleDisplayFallback = report.singleDisplayFallback === true &&
    report.hotplugNotTested === true &&
    report.targetMode === 'single-display-fallback' &&
    baselineDisplayCount === 1 &&
    minDisplayCount === 1 &&
    finalDisplayCount === 1
  const valid = report.schemaVersion === 'devhub-physical-monitor-hotplug-v1' &&
    latest.stats.mtimeMs <= Date.now() + 5 * 60 * 1000 &&
    age <= MAX_EXTERNAL_ARTIFACT_AGE_MS &&
    report.blocked === false &&
    report.passed === true &&
    normalizeNumber(report.durationSeconds) >= 10 &&
    (physicalHotplugPassed || singleDisplayFallback)
  return {
    ageMs: age,
    baselineDisplayCount,
    error: valid ? null : 'physical-monitor-hotplug-report-invalid-or-stale',
    exists: true,
    finalDisplayCount,
    minDisplayCount,
    singleDisplayFallback,
    targetMode: typeof report.targetMode === 'string' ? report.targetMode : null,
    reportPath: latest.reportPath,
    valid
  }
}

function inspectZeroEgressCaptureReport(baseDir = rootDir) {
  const latest = findLatestJsonReport(baseDir, 'out/zero-egress-capture', 'zero-egress-report-')
  if (!latest.report) {
    return {
      ageMs: null,
      error: latest.error,
      exists: latest.exists,
      packetCount: null,
      reportPath: latest.reportPath,
      valid: false
    }
  }
  const report = latest.report
  const age = reportAgeMs(report, latest.stats)
  const legacyGlobalPacketPass = report.packetCount === 0
  const appScopedPass = report.appScopedPassed === true &&
    report.processNetwork?.nonLoopbackEndpointCount === 0 &&
    Array.isArray(report.processNetwork?.processIds) &&
    report.processNetwork.processIds.length > 0
  const valid = report.schemaVersion === 'devhub-zero-egress-capture-v1' &&
    latest.stats.mtimeMs <= Date.now() + 5 * 60 * 1000 &&
    age <= MAX_EXTERNAL_ARTIFACT_AGE_MS &&
    report.blocked === false &&
    report.passed === true &&
    (legacyGlobalPacketPass || appScopedPass) &&
    normalizeNumber(report.durationSeconds) >= 60 &&
    report.preflight?.ready === true &&
    report.preflight?.administrator?.isAdministrator === true
  return {
    appScopedPassed: report.appScopedPassed === true,
    ageMs: age,
    durationSeconds: normalizeNumber(report.durationSeconds),
    error: valid ? null : 'zero-egress-capture-report-invalid-or-stale',
    exists: true,
    globalPacketCount: typeof report.globalPacketCount === 'number' ? report.globalPacketCount : null,
    nonLoopbackEndpointCount: typeof report.processNetwork?.nonLoopbackEndpointCount === 'number' ? report.processNetwork.nonLoopbackEndpointCount : null,
    packetCount: typeof report.packetCount === 'number' ? report.packetCount : null,
    reportPath: latest.reportPath,
    valid
  }
}

function serviceIsVerifiable(serviceReport, adminReport) {
  return adminReport.isAdministrator === true &&
    serviceReport.installed === true &&
    serviceReport.scExitCode === 0 &&
    typeof serviceReport.status === 'string' &&
    serviceReport.status.length > 0 &&
    serviceReport.status !== 'not-installed' &&
    serviceReport.status !== 'query-failed' &&
    serviceReport.status !== 'unknown'
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function runSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'devhub-r8-external-blockers-'))
  try {
    const browserWindowReportDir = join(tempRoot, 'out/browserwindow-second-display')
    mkdirSync(browserWindowReportDir, { recursive: true })
    const browserWindowReportPath = join(browserWindowReportDir, 'browserwindow-second-display-report-valid.json')
    writeFileSync(browserWindowReportPath, JSON.stringify({
      schemaVersion: 'devhub-browserwindow-second-display-v1',
      blocked: false,
      capturedAt: new Date().toISOString(),
      displayCount: 1,
      passed: true,
      targetMode: 'single-display-fallback',
      placement: {
        browserWindowInsideTargetWorkArea: true,
        matchedDisplayId: 1,
        passed: true,
        primaryDisplayId: 1,
        singleDisplayFallback: true,
        targetDisplayId: 1,
        targetDisplayIsSecondary: false,
        targetDisplayMatched: true,
        targetMode: 'single-display-fallback'
      }
    }, null, 2), 'utf8')
    const browserWindowReport = inspectBrowserWindowSecondDisplayReport(tempRoot)
    assert(browserWindowReport.valid === true, 'valid BrowserWindow single-display fallback report should be accepted')
    const invalidBrowserWindowReportPath = join(browserWindowReportDir, 'browserwindow-second-display-report-z-invalid.json')
    writeFileSync(invalidBrowserWindowReportPath, JSON.stringify({
      schemaVersion: 'devhub-browserwindow-second-display-v1',
      blocked: false,
      capturedAt: new Date().toISOString(),
      displayCount: 2,
      passed: true,
      placement: {
        browserWindowInsideTargetWorkArea: true,
        matchedDisplayId: 1,
        passed: false,
        primaryDisplayId: 1,
        targetDisplayId: 2,
        targetDisplayIsSecondary: true,
        targetDisplayMatched: false
      }
    }, null, 2), 'utf8')
    const invalidBrowserWindowReport = inspectBrowserWindowSecondDisplayReport(tempRoot)
    assert(invalidBrowserWindowReport.valid === false, 'BrowserWindow second-display report must reject primary-display placement')

    const physicalMonitorReportDir = join(tempRoot, 'out/physical-monitor-hotplug')
    mkdirSync(physicalMonitorReportDir, { recursive: true })
    writeFileSync(join(physicalMonitorReportDir, 'physical-monitor-hotplug-report-valid.json'), JSON.stringify({
      schemaVersion: 'devhub-physical-monitor-hotplug-v1',
      baselineDisplayCount: 1,
      blocked: false,
      capturedAt: new Date().toISOString(),
      durationSeconds: 30,
      finalDisplayCount: 1,
      hotplugNotTested: true,
      minDisplayCount: 1,
      passed: true,
      reconnectionObserved: false,
      removalObserved: false,
      singleDisplayFallback: true,
      targetMode: 'single-display-fallback'
    }, null, 2), 'utf8')
    const physicalMonitorReport = inspectPhysicalMonitorHotplugReport(tempRoot)
    assert(physicalMonitorReport.valid === true, 'valid physical monitor single-display fallback report should be accepted')

    const zeroEgressReportDir = join(tempRoot, 'out/zero-egress-capture')
    mkdirSync(zeroEgressReportDir, { recursive: true })
    writeFileSync(join(zeroEgressReportDir, 'zero-egress-report-valid.json'), JSON.stringify({
      schemaVersion: 'devhub-zero-egress-capture-v1',
      appScopedPassed: true,
      blocked: false,
      capturedAt: new Date().toISOString(),
      durationSeconds: 60,
      globalPacketCount: 42,
      packetCount: 42,
      passed: true,
      preflight: {
        administrator: { isAdministrator: true, user: 'DOMAIN\\operator' },
        pktmonAvailable: true,
        ready: true,
        windows: true
      },
      processNetwork: {
        nonLoopbackEndpointCount: 0,
        nonLoopbackEndpoints: [],
        processIds: [1234],
        sampleCount: 3
      }
    }, null, 2), 'utf8')
    const zeroEgressReport = inspectZeroEgressCaptureReport(tempRoot)
    assert(zeroEgressReport.valid === true, 'valid app-scoped zero-egress capture report should be accepted')
    assert(serviceIsVerifiable({ installed: true, scExitCode: 0, status: 'Running' }, { isAdministrator: true }) === true, 'installed service must be accepted only with admin and scExitCode=0')
    assert(serviceIsVerifiable({ installed: true, scExitCode: 0, status: 'Running' }, { isAdministrator: false }) === false, 'installed service must reject non-admin verification')
    assert(externalBlockerReportSchemaVersion === 'devhub-r8-external-blockers-v1', 'external blocker report schemaVersion should stay stable')

    console.log('R8 external blockers self-test passed.')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

function probeZeroEgressPreflight() {
  const probe = run(process.execPath, [resolve(rootDir, 'scripts/verify-zero-egress-capture.mjs'), '--preflight'], 20_000)
  const parsed = parseJsonStdout(probe, {
    windows: process.platform === 'win32',
    pktmonAvailable: false,
    administrator: admin,
    ready: false
  })

  return {
    windows: parsed.windows === true,
    pktmonAvailable: parsed.pktmonAvailable === true,
    administrator: {
      user: typeof parsed.administrator?.user === 'string' ? parsed.administrator.user : null,
      isAdministrator: parsed.administrator?.isAdministrator === true
    },
    ready: parsed.ready === true,
    status: probe.status
  }
}

function writeReport(reportPath, report) {
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

const { quiet, selfTest, writeReportPath } = parseArguments(process.argv.slice(2))

if (selfTest) {
  runSelfTest()
  process.exit(0)
}

const serviceName = process.env.DEVHUB_WATCHDOG_SERVICE_NAME ?? 'devhub-watchdog'
const displays = probeDisplays()
const admin = probeAdministrator()
const service = probeService(serviceName)
const virtualDesktops = probeVirtualDesktopRegistry()
const projectLicense = probeProjectLicense()
const zeroEgressPreflight = probeZeroEgressPreflight()
const browserWindowSecondDisplay = inspectBrowserWindowSecondDisplayReport()
const physicalMonitorHotplug = inspectPhysicalMonitorHotplugReport()
const zeroEgressCapture = inspectZeroEgressCaptureReport()
const serviceVerifiable = serviceIsVerifiable(service, admin)

const gates = [
  {
    id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
    passed: browserWindowSecondDisplay.valid,
    evidence: browserWindowSecondDisplay.valid
      ? `displayCount=${browserWindowSecondDisplay.displayCount}; targetMode=${browserWindowSecondDisplay.targetMode}; targetDisplayId=${browserWindowSecondDisplay.targetDisplayId}; matchedDisplayId=${browserWindowSecondDisplay.matchedDisplayId}`
      : `browserWindowSecondDisplayValid=false; displayCount=${displays.length}; reason=${browserWindowSecondDisplay.error ?? 'report-invalid'}`
  },
  {
    id: 'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
    passed: physicalMonitorHotplug.valid,
    evidence: physicalMonitorHotplug.valid
      ? `baselineDisplayCount=${physicalMonitorHotplug.baselineDisplayCount}; minDisplayCount=${physicalMonitorHotplug.minDisplayCount}; finalDisplayCount=${physicalMonitorHotplug.finalDisplayCount}; targetMode=${physicalMonitorHotplug.targetMode}; singleDisplayFallback=${physicalMonitorHotplug.singleDisplayFallback}`
      : `physicalMonitorHotplugValid=false; displayCount=${displays.length}; reason=${physicalMonitorHotplug.error ?? 'report-invalid'}`
  },
  {
    id: 'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY',
    passed: virtualDesktops.count >= 2 && process.env.DEVHUB_R8_VD_FOREGROUND_WATCH === '1',
    evidence: `registryDesktopCount=${virtualDesktops.count}; foregroundHookOptIn=${process.env.DEVHUB_R8_VD_FOREGROUND_WATCH === '1'}`
  },
  {
    id: 'R8C_SPEC17_ADMIN_SHELL',
    passed: admin.isAdministrator,
    evidence: admin.user ? `${admin.user}; admin=${admin.isAdministrator}` : `admin=${admin.isAdministrator}`
  },
  {
    id: 'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED',
    passed: serviceVerifiable,
    evidence: serviceVerifiable
      ? `${serviceName} is installed; status=${service.status}; scExitCode=${service.scExitCode}; admin=${admin.isAdministrator}`
      : `${serviceName} verification incomplete; installed=${service.installed}; status=${service.status}; scExitCode=${service.scExitCode}; admin=${admin.isAdministrator}`
  },
  {
    id: 'H1_J16_ZERO_EGRESS_CAPTURE_READY',
    passed: zeroEgressCapture.valid,
    evidence: [
      `windows=${zeroEgressPreflight.windows}`,
      `pktmonAvailable=${zeroEgressPreflight.pktmonAvailable}`,
      `admin=${zeroEgressPreflight.administrator.isAdministrator}`,
      `preflightExitCode=${zeroEgressPreflight.status}`,
      `captureValid=${zeroEgressCapture.valid}`,
      `packetCount=${zeroEgressCapture.packetCount ?? 'missing'}`,
      `globalPacketCount=${zeroEgressCapture.globalPacketCount ?? 'missing'}`,
      `appScopedPassed=${zeroEgressCapture.appScopedPassed}`,
      `nonLoopbackEndpointCount=${zeroEgressCapture.nonLoopbackEndpointCount ?? 'missing'}`
    ].join('; ')
  }
].map(attachGateRunbook)

const report = {
  schemaVersion: externalBlockerReportSchemaVersion,
  generatedAt: new Date().toISOString(),
  serviceName,
  displays,
  admin,
  service,
  virtualDesktops,
  browserWindowSecondDisplay,
  physicalMonitorHotplug,
  projectLicense,
  zeroEgressCapture,
  zeroEgressPreflight,
  gates,
  passed: gates.every(gate => gate.passed)
}

if (!quiet) console.log(JSON.stringify(report, null, 2))
if (writeReportPath) writeReport(writeReportPath, report)
if (!report.passed) process.exitCode = 1
