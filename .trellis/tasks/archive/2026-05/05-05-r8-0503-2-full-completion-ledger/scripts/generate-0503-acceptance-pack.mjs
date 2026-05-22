import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const taskDir = dirname(scriptDir)
const repoRoot = findRepoRoot(taskDir)
const researchDir = join(taskDir, 'research')

const rootPackageJsonPath = join(repoRoot, 'package.json')
const rootPnpmLockPath = join(repoRoot, 'pnpm-lock.yaml')
const devhubPackageJsonPath = join(repoRoot, 'devhub', 'package.json')
const devhubElectronViteConfigPath = join(repoRoot, 'devhub', 'electron.vite.config.ts')
const devhubManualTestingChecklistPath = join(repoRoot, 'devhub', 'docs', 'manual-testing-checklist.md')
const ledgerVerificationPath = join(researchDir, '0503-ledger-verification.json')
const externalBlockerReportPath = join(researchDir, 'r8-external-blockers-current.json')
const strictCompletionReportPath = join(researchDir, '0503-strict-completion-report.md')
const completionLedgerPath = join(researchDir, '0503-2-completion-ledger.md')
const surveyAcceptanceLedgerPath = join(researchDir, '0503-survey-acceptance-ledger.md')
const acceptancePackJsonPath = join(researchDir, '0503-acceptance-pack.json')
const acceptancePackMarkdownPath = join(researchDir, '0503-acceptance-pack.md')
const completionStatusJsonPath = join(researchDir, '0503-completion-status.json')
const completionStatusMarkdownPath = join(researchDir, '0503-completion-status.md')
const completionAuditJsonPath = join(researchDir, '0503-completion-audit.json')
const completionAuditMarkdownPath = join(researchDir, '0503-completion-audit.md')
const ownerActionQueueJsonPath = join(researchDir, '0503-owner-action-queue.json')
const ownerActionQueueMarkdownPath = join(researchDir, '0503-owner-action-queue.md')
const ownerClosureBundlesJsonPath = join(researchDir, '0503-owner-closure-bundles.json')
const ownerClosureBundlesMarkdownPath = join(researchDir, '0503-owner-closure-bundles.md')
const ownerSubmissionTemplatesCurrentDirPath = join(researchDir, '0503-owner-submission-templates-current')
const ownerRawEvidenceTemplatesCurrentDirPath = join(researchDir, '0503-owner-raw-evidence-templates-current')
const checkboxManifestGeneratorPath = join(scriptDir, 'generate-0503-checkbox-manifest.mjs')
const ledgerVerifierPath = join(scriptDir, 'verify-0503-ledgers.mjs')
const noEmojiVerifierPath = join(scriptDir, 'verify-0503-no-emoji.mjs')
const ownerEvidenceVerifierPath = join(scriptDir, 'verify-0503-owner-evidence.mjs')
const strictRunnerPath = join(scriptDir, 'run-0503-strict-completion.mjs')
const checkboxManifestJsonPath = join(researchDir, '0503-checkbox-manifest.json')
const checkboxManifestMarkdownPath = join(researchDir, '0503-checkbox-manifest.md')
const externalBlockerReportArgument = '../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json'
const strictCompletionCommand = 'pnpm check:0503-strict'
const shellPortableStrictCompletionCommand = 'pnpm --silent check:0503-strict:vd-watch'
const acceptancePackSchemaVersion = 'devhub-0503-acceptance-pack-v1'
const completionStatusSchemaVersion = 'devhub-0503-completion-status-v1'
const completionAuditSchemaVersion = 'devhub-0503-completion-audit-v1'
const ownerActionQueueSchemaVersion = 'devhub-0503-owner-action-queue-v1'
const ownerClosureBundleSchemaVersion = 'devhub-0503-owner-closure-bundles-v2'
const evidencePackVerifierRequirement = 'Verify schemaVersion guards, pack hashes, source hashes, prompt manifests with filesystem-count parity, task context JSONL coverage, external blocker report JSON, ledger verification JSON, completion ledger markdown, survey acceptance ledger markdown, acceptance pack markdown including failed gate verification notes, prompt-to-artifact machine evidence fields and JSON pointer targets, checkbox totals, checkbox manifest markdown, owner actions, owner action queue markdown rows, owner verification command notes across queue/raw/submission templates, current owner template JSON files, raw owner evidence template schemaVersion, owner closure bundles with verification command notes, owner closure bundles with source-file dossier commands plus action/raw/submission command columns and verification command notes in markdown rows, benchmark evidence schemas, completion status, completion status markdown sections, completion status owner lane command sets, completion status failed external gate command sets with verification notes, manual testing dual-running-surface docs, startup config dual-running-surface contract, completion audit startup source evidence paths, temporary owner template artifact absence, HANDOFF current summary, strict completion report rows, strict completion report failed gate verification notes, strict completion report owner lane command sets, completion audit alignment, completion audit open requirement external/owner boundary, completion audit markdown including source evidence rows, partial R8 linked owner attribution, current owner template README workflow guidance, and referenced evidence file paths with repo-root containment.'

function findRepoRoot(startDir) {
  let current = resolve(startDir)
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'prompts', '0503')) && existsSync(join(current, 'prompts', '0503-2'))) {
      return current
    }
    current = dirname(current)
  }
  throw new Error(`Unable to locate repository root from ${startDir}`)
}

function buildWindowsServiceVerificationCommandNote() {
  return `Windows Service evidence must come from a real elevated DevHub service flow: run DevHub from an Administrator Windows session, invoke window.devhub.watchdog.supervisorInstallService(true, '<real operator identity>') through the preload bridge or equivalent application control path, accept the UAC prompt, then rerun pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json and preserve admin.isAdministrator=true, service.installed=true, service.scExitCode=0, and service.status. Do not close from a dry-run command plan, service-name assumption, or non-admin report. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function buildZeroEgressVerificationCommandNote() {
  return `Zero-egress evidence must come from a real Administrator Windows shell with pktmon.exe available: run pnpm -C devhub check:zero-egress-capture without --preflight, preserve the generated devhub-zero-egress-capture-v1 JSON report with blocked=false, passed=true, durationSeconds>=60, preflight.ready=true, and either packetCount=0 or appScopedPassed=true with processNetwork.nonLoopbackEndpointCount=0. Whole-machine globalPacketCount may be nonzero when unrelated background traffic exists, but it must be retained in the report. Do not close from preflight output, packet-count assumptions, hidden global counter edits, or non-admin reports. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function buildSecondDisplayVerificationCommandNote() {
  return `BrowserWindow placement evidence must come from the real current Windows display topology: run pnpm -C devhub check:browserwindow-second-display, preserve the generated devhub-browserwindow-second-display-v1 JSON report with blocked=false, passed=true, displayCount>=1, targetMode as secondary-display or single-display-fallback, placement.targetDisplayMatched=true, and placement.browserWindowInsideTargetWorkArea=true, then rerun pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json. Do not close from virtual-display notes, registry-only monitor counts, screenshots without the BrowserWindow report, display enumeration alone, or stale reports. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function buildPhysicalMonitorVerificationCommandNote() {
  return `Display continuity evidence must use the real current Windows display topology: run pnpm -C devhub check:physical-monitor-hotplug, preserve the generated devhub-physical-monitor-hotplug-v1 JSON report with blocked=false, passed=true, durationSeconds>=10, and either physical hotplug fields proving baselineDisplayCount>=2 with removal/reconnection or targetMode=single-display-fallback with stable baseline/min/final displayCount=1. Do not close from registry-only evidence, fake display sources, screenshots without generated JSON, or stale reports. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function buildTrueVdSwitchVerificationCommandNote() {
  return `Virtual desktop switch evidence must come from the real Windows virtual desktop watch path in the same shell: set DEVHUB_R8_VD_FOREGROUND_WATCH=1 or run ${shellPortableStrictCompletionCommand}, keep at least two registry-backed Windows virtual desktops, perform a real foreground desktop switch during the verification window, and preserve the fresh r8-external-blockers-current.json row with registryDesktopCount>=2 and foregroundHookOptIn=true. Do not close from registry count alone, static desktop IDs, screenshots, or a report generated without foreground-watch opt-in.`
}

function buildAdminShellVerificationCommandNote() {
  return `Administrator evidence must come from the same real Windows shell/session used for the privileged R8.C checks: rerun pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json and preserve admin.user plus admin.isAdministrator=true in the fresh report. Do not close from a non-elevated shell, copied username, or UAC prompt screenshot without the probe report. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function buildSurveyContextVerificationCommandNote() {
  return `Survey-context evidence must come from a real product owner review of prompts/0503/14-three-graph-systems-survey.md and its linked survey rows: submit a dated decision file that identifies the reviewer, source rows, accepted scope, and remaining blockers. Do not close from generated ledger counts, agent summaries, or template-only intake files. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function buildUserProductAcceptanceVerificationCommandNote() {
  return `User-product acceptance evidence must be an actual acceptance record from the user/product owner after reviewing current runtime artifacts: include reviewer identity, date, accepted scope, known blockers, and explicit approval or rejection. Do not close from internal QA notes, screenshots alone, generated reports without reviewer sign-off, or unreviewed checklist rows. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function buildHardwareVerificationCommandNote() {
  return `Hardware-verification checkbox closure evidence must link every hardware-dependent open checkbox row to real hardware run artifacts, including second-display or physical hotplug reports where applicable. Do not close from capability assumptions, static inventory, virtual display notes, screenshots without generated verifier JSON, or stale checklist rows. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function buildAdminServiceVerificationCommandNote() {
  return `Admin-service checkbox closure evidence must be collected in a real elevated Windows session and link every admin/service open checkbox row to the administrator and Windows Service reports. Do not close from dry-run service command plans, non-elevated shell output, copied service names, or generic operator intent. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

function verificationCommandNoteForAction(actionId) {
  if (actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY') return buildSecondDisplayVerificationCommandNote()
  if (actionId === 'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY') return buildPhysicalMonitorVerificationCommandNote()
  if (actionId === 'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY') return buildTrueVdSwitchVerificationCommandNote()
  if (actionId === 'R8C_SPEC17_ADMIN_SHELL') return buildAdminShellVerificationCommandNote()
  if (actionId === 'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED') return buildWindowsServiceVerificationCommandNote()
  if (actionId === 'H1_J16_ZERO_EGRESS_CAPTURE_READY') return buildZeroEgressVerificationCommandNote()
  if (actionId === 'survey-context') return buildSurveyContextVerificationCommandNote()
  if (actionId === 'user-product-acceptance') return buildUserProductAcceptanceVerificationCommandNote()
  if (actionId === 'hardware-verification') return buildHardwareVerificationCommandNote()
  if (actionId === 'admin-service-verification') return buildAdminServiceVerificationCommandNote()
  return null
}

const selfTest = process.argv.includes('--self-test')
const noRefresh = process.argv.includes('--no-refresh')
const forceExternalRefresh = process.argv.includes('--force-external-refresh')
const maxPreservedExternalReportAgeMs = 8 * 60 * 60 * 1000
const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEvidencePackVerifierRequirementText(requirement) {
  assert(requirement === evidencePackVerifierRequirement, 'completion audit evidence pack verifier requirement mismatch')
}

function readText(filePath) {
  assert(existsSync(filePath), `missing evidence file: ${filePath}`)
  return readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(readText(filePath))
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function relativePath(filePath) {
  return relative(repoRoot, filePath).replaceAll('\\', '/')
}

function describeEvidenceFile(filePath) {
  const text = readText(filePath)
  const stats = statSync(filePath)
  return {
    path: relativePath(filePath),
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    sha256: sha256(text)
  }
}

function tableCell(value) {
  return String(value ?? '')
    .replace(emojiPattern, '')
    .replaceAll('|', '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, maxLength = 300) {
  const text = tableCell(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function renderRows(rows, emptyText, columns, mapper) {
  if (rows.length === 0) return `\n${emptyText}\n`
  const header = `| ${columns.join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${mapper(row).map(tableCell).join(' | ')} |`).join('\n')
  return `\n${header}\n${divider}\n${body}\n`
}

function countBy(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function sortedObject(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)))
}

function weightedCountBy(rows, keySelector, weightSelector = () => 1) {
  const counts = {}
  for (const row of rows) {
    const key = keySelector(row)
    counts[key] = (counts[key] ?? 0) + weightSelector(row)
  }
  return sortedObject(counts)
}

function withRecommendedStrictCompletionCommand(row) {
  return {
    ...row,
    recommendedStrictCompletionCommand: row.recommendedStrictCompletionCommand ?? shellPortableStrictCompletionCommand
  }
}

function summarizeOpenCheckboxSourceFiles(checkboxManifest, closureKind, limit = 8, scopePrefix = '') {
  const rows = Array.isArray(checkboxManifest.rows) ? checkboxManifest.rows : []
  const matchingRows = rows.filter(row =>
    row.checked === false &&
    row.closureKind === closureKind &&
    (scopePrefix.length === 0 || String(row.file ?? '').startsWith(scopePrefix))
  )
  const fileCounts = countBy(matchingRows.map(row => row.file))
  const allFiles = Object.entries(fileCounts)
    .map(([file, count]) => ({ count, file }))
    .sort((left, right) => right.count - left.count || left.file.localeCompare(right.file))
  return {
    files: allFiles.slice(0, limit),
    omittedFileCount: Math.max(0, allFiles.length - limit),
    totalFileCount: allFiles.length
  }
}

function countOpenClosureKindsForScope(checkboxManifest, scopePrefix) {
  const rows = Array.isArray(checkboxManifest.rows) ? checkboxManifest.rows : []
  return countBy(rows
    .filter(row => row.checked === false && String(row.file ?? '').startsWith(scopePrefix))
    .map(row => row.closureKind))
}

function ownerForClosureKind(closureKind) {
  const ownerByClosureKind = {
    'admin-service-verification': 'operator',
    'hardware-verification': 'operator',
    'process-instruction': 'operator'
  }
  return ownerByClosureKind[closureKind] ?? 'agent'
}

function countOpenOwnersForScope(checkboxManifest, scopePrefix) {
  const rows = Array.isArray(checkboxManifest.rows) ? checkboxManifest.rows : []
  return countBy(rows
    .filter(row => row.checked === false && String(row.file ?? '').startsWith(scopePrefix))
    .map(row => ownerForClosureKind(row.closureKind)))
}

function formatSourceFileSummary(summary) {
  if (!summary || summary.files.length === 0) return ''
  const base = summary.files.map(row => `${row.file} (${row.count})`).join('; ')
  return summary.omittedFileCount > 0 ? `${base}; +${summary.omittedFileCount} more file(s)` : base
}

function deriveAcceptanceStatus(strictCompletion) {
  return strictCompletion?.passed === true ? 'complete' : 'not-complete'
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
}

function hasFreshPassingExternalReport(filePath) {
  const report = readJsonIfPresent(filePath)
  const generatedAtMs = Date.parse(report?.generatedAt ?? '')
  const gates = Array.isArray(report?.gates) ? report.gates : []

  return report?.passed === true &&
    Number.isFinite(generatedAtMs) &&
    Date.now() - generatedAtMs <= maxPreservedExternalReportAgeMs &&
    gates.length === 6 &&
    gates.every(gate => gate?.passed === true)
}

function isCurrentProcessElevated() {
  if (process.platform !== 'win32') return true

  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    "$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { 'true' } else { 'false' }"
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    windowsHide: true
  })

  return result.status === 0 && result.stdout.trim() === 'true'
}

function refreshStrictEvidence() {
  const elevated = isCurrentProcessElevated()

  if (!forceExternalRefresh && hasFreshPassingExternalReport(externalBlockerReportPath)) {
    console.log(`0503 acceptance pack: preserving fresh passed external blocker report at ${relativePath(externalBlockerReportPath)}; use --force-external-refresh to refresh.`)
  } else if (!forceExternalRefresh && process.platform === 'win32' && !elevated) {
    throw new Error('0503 acceptance pack: refusing to refresh external blocker report from a non-Administrator Windows shell. Run .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/run-r8-local-elevated-verification.ps1 first, or pass --force-external-refresh to intentionally overwrite the external report.')
  } else {
    const externalResult = spawnSync('pnpm', [
      '-C',
      'devhub',
      'check:r8-external-blockers',
      '--',
      '--quiet',
      '--write-report',
      externalBlockerReportArgument
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: 'pipe',
      windowsHide: true
    })
    const externalStatus = typeof externalResult.status === 'number' ? externalResult.status : 1
    assert([0, 1].includes(externalStatus), `external blocker refresh failed with exit code ${externalStatus}\n${externalResult.stdout}\n${externalResult.stderr}`)
  }

  const ledgerResult = spawnSync(process.execPath, [
    ledgerVerifierPath,
    '--strict-complete',
    '--write-report',
    '--write-strict-report'
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    windowsHide: true
  })
  const ledgerStatus = typeof ledgerResult.status === 'number' ? ledgerResult.status : 1
  assert([0, 1].includes(ledgerStatus), `strict ledger refresh failed with exit code ${ledgerStatus}\n${ledgerResult.stdout}\n${ledgerResult.stderr}`)
  console.log(`0503 strict evidence refreshed: status=${ledgerStatus === 0 ? 'complete' : 'not-complete'}`)
}

function refreshCheckboxManifest() {
  const result = spawnSync(process.execPath, [checkboxManifestGeneratorPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    stdio: 'inherit',
    windowsHide: true
  })
  const status = typeof result.status === 'number' ? result.status : 1
  assert(status === 0, `checkbox manifest refresh failed with exit code ${status}`)
}

function refreshCurrentOwnerTemplateDirectories() {
  const commands = [
    ['--print-template-dir', relativePath(ownerSubmissionTemplatesCurrentDirPath)],
    ['--print-evidence-template-dir', relativePath(ownerRawEvidenceTemplatesCurrentDirPath)]
  ]
  for (const args of commands) {
    const result = spawnSync(process.execPath, [ownerEvidenceVerifierPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
      stdio: 'pipe',
      windowsHide: true
    })
    const status = typeof result.status === 'number' ? result.status : 1
    assert(status === 0, `owner template directory refresh failed for ${args.join(' ')} with exit code ${status}\n${result.stdout}\n${result.stderr}`)
  }
}

function buildFailedGateRows(externalReport) {
  const gates = Array.isArray(externalReport.gates) ? externalReport.gates : []
  return gates
    .filter(gate => gate.passed !== true)
    .map(gate => {
      const id = typeof gate.id === 'string' ? gate.id : 'unknown'
      const verificationCommandNote = verificationCommandNoteForAction(id)
      return {
        evidence: typeof gate.evidence === 'string' ? gate.evidence : '',
        id,
        runbook: gate.runbook && typeof gate.runbook === 'object' ? gate.runbook : {},
        ...(verificationCommandNote ? { verificationCommandNote } : {})
      }
    })
}

function buildAcceptancePack() {
  const ledgerVerification = readJson(ledgerVerificationPath)
  const externalReport = readJson(externalBlockerReportPath)
  const checkboxManifest = readJson(checkboxManifestJsonPath)
  const strictCompletion = ledgerVerification.strictCompletion ?? {}
  assert(strictCompletion.checked === true, 'acceptance pack requires a strict ledger report; rerun without --no-refresh or run pnpm check:0503-strict before packing')
  const externalReportSummary = ledgerVerification.blockers?.externalReport ?? {}
  const failedExternalGates = buildFailedGateRows(externalReport)
  const failedGateOwnerCounts = countBy(failedExternalGates.map(gate => gate.runbook.owner ?? 'unassigned'))
  const failedGateKindCounts = countBy(failedExternalGates.map(gate => gate.runbook.blockerKind ?? 'unknown'))
  const sourceEvidence = [
    describeEvidenceFile(ledgerVerificationPath),
    describeEvidenceFile(externalBlockerReportPath),
    describeEvidenceFile(strictCompletionReportPath),
    describeEvidenceFile(completionLedgerPath),
    describeEvidenceFile(surveyAcceptanceLedgerPath),
    describeEvidenceFile(checkboxManifestJsonPath),
    describeEvidenceFile(checkboxManifestMarkdownPath)
  ]

  return {
    acceptanceStatus: deriveAcceptanceStatus(strictCompletion),
    generatedAt: new Date().toISOString(),
    schemaVersion: acceptancePackSchemaVersion,
    sourceEvidence,
    summary: {
      externalReportFresh: strictCompletion.externalReportFresh === true,
      failedExternalGateCount: failedExternalGates.length,
      missingEvidenceRowCount: Array.isArray(strictCompletion.missingEvidenceRows) ? strictCompletion.missingEvidenceRows.length : 0,
      partialR8RowCount: Array.isArray(strictCompletion.partialRows) ? strictCompletion.partialRows.length : 0,
      prompt0503LedgerRows: ledgerVerification.surveyLedger?.ledgerRows ?? null,
      prompt0503MarkdownFiles: ledgerVerification.surveyLedger?.expectedMarkdownFiles ?? null,
      prompt05032LedgerRows: ledgerVerification.completionLedger?.ledgerRows ?? null,
      prompt05032MarkdownFiles: ledgerVerification.completionLedger?.expectedMarkdownFiles ?? null,
      promptCheckboxCheckedRows: checkboxManifest.totalChecked,
      promptCheckboxLocalClosureBlockedOpenRows: checkboxManifest.localClosureBlockedOpenRows,
      promptCheckboxLocalClosurePossibleOpenRows: checkboxManifest.localClosurePossibleOpenRows,
      promptCheckboxOpenRows: checkboxManifest.totalOpen,
      promptCheckboxRows: checkboxManifest.totalRows,
      strictCompletionChecked: strictCompletion.checked === true,
      strictCompletionPassed: strictCompletion.passed === true,
      surveyAcceptanceRowCount: Array.isArray(strictCompletion.surveyAcceptanceRows) ? strictCompletion.surveyAcceptanceRows.length : 0
    },
    externalGateRunbookCoverage: {
      missingFields: Array.isArray(externalReportSummary.runbookMissingFields) ? externalReportSummary.runbookMissingFields : [],
      requiredFields: Array.isArray(externalReportSummary.requiredRunbookFields) ? externalReportSummary.requiredRunbookFields : []
    },
    currentEnvironment: {
      adminUser: typeof externalReport.admin?.user === 'string' ? externalReport.admin.user : null,
      displayCount: Array.isArray(externalReport.displays) ? externalReport.displays.length : null,
      isAdministrator: externalReport.admin?.isAdministrator === true,
      serviceInstalled: externalReport.service?.installed === true,
      serviceStatus: typeof externalReport.service?.status === 'string' ? externalReport.service.status : null,
      virtualDesktopCount: Number.isInteger(externalReport.virtualDesktops?.count) ? externalReport.virtualDesktops.count : null,
      zeroEgressPreflightReady: externalReport.zeroEgressPreflight?.ready === true
    },
    failedGateKindCounts,
    failedGateOwnerCounts,
    failedExternalGates,
    partialR8Rows: Array.isArray(strictCompletion.partialRowDetails) ? strictCompletion.partialRowDetails : [],
    promptArtifactManifest: {
      prompt0503Rows: Array.isArray(ledgerVerification.surveyLedger?.rows) ? ledgerVerification.surveyLedger.rows : [],
      prompt05032Rows: Array.isArray(ledgerVerification.completionLedger?.rows) ? ledgerVerification.completionLedger.rows : []
    },
    promptCheckboxManifest: {
      jsonPath: relativePath(checkboxManifestJsonPath),
      localClosureBlockedOpenRows: checkboxManifest.localClosureBlockedOpenRows,
      localClosurePossibleOpenRows: checkboxManifest.localClosurePossibleOpenRows,
	      markdownPath: relativePath(checkboxManifestMarkdownPath),
	      openClosureKindCounts: checkboxManifest.openClosureKindCounts,
	      open05032ClosureKindCounts: countOpenClosureKindsForScope(checkboxManifest, 'prompts/0503-2/'),
	      openOwnerCounts: checkboxManifest.openOwnerCounts,
	      open05032OwnerCounts: countOpenOwnersForScope(checkboxManifest, 'prompts/0503-2/'),
	      openSourceFilesByClosureKind: Object.fromEntries(
	        Object.keys(checkboxManifest.openClosureKindCounts ?? {}).map(closureKind => [
	          closureKind,
	          summarizeOpenCheckboxSourceFiles(checkboxManifest, closureKind, 1000)
	        ])
	      ),
	      open05032SourceFilesByClosureKind: Object.fromEntries(
	        Object.keys(countOpenClosureKindsForScope(checkboxManifest, 'prompts/0503-2/')).map(closureKind => [
	          closureKind,
	          summarizeOpenCheckboxSourceFiles(checkboxManifest, closureKind, 1000, 'prompts/0503-2/')
	        ])
	      ),
	      scopeCounts: checkboxManifest.scopeCounts,
      totalChecked: checkboxManifest.totalChecked,
      totalOpen: checkboxManifest.totalOpen,
      totalRows: checkboxManifest.totalRows
    },
    surveyAcceptanceRows: Array.isArray(strictCompletion.surveyAcceptanceRows) ? strictCompletion.surveyAcceptanceRows : [],
    nonCompletionBoundary: [
      'Do not claim final completion while strictCompletionPassed=false.',
      'Do not close hardware gates without real display, monitor, or virtual desktop event evidence.',
      'Do not close Administrator or Windows Service gates from a non-elevated shell.',
      'Do not close zero-egress acceptance from preflight alone; the live pktmon capture must pass.',
      'Do not treat legacy prompts/0503 survey rows as R8 0503-2 implementation blockers unless the user explicitly asks to run that older survey scope.'
    ]
  }
}

function buildSourceFileDossierCommand(actionId, filePath) {
  return `pnpm --silent check:0503-owner-evidence -- --source-file-dossier --action ${actionId} --file ${filePath}`
}

function withSourceFileCommands(sourceFiles, actionId) {
  if (!sourceFiles || !Array.isArray(sourceFiles.files)) return sourceFiles
  const commandSet = {
    actionDossierCommand: `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${actionId}`,
    rawEvidenceTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${actionId}`,
    submissionTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-template --action ${actionId}`
  }
  return {
    ...sourceFiles,
    files: sourceFiles.files.map(row => ({
      ...row,
      ...commandSet,
      sourceFileDossierCommand: buildSourceFileDossierCommand(actionId, row.file)
    }))
  }
}

function buildOwnerActionQueue(pack) {
  const externalGateActions = pack.failedExternalGates.map(gate => ({
    actionType: 'external-gate',
    closureKind: gate.runbook.blockerKind ?? 'unknown',
    currentEvidence: gate.evidence,
    gateId: gate.id,
    owner: gate.runbook.owner ?? 'unassigned',
    prerequisite: gate.runbook.prerequisite ?? '',
    requiredEvidence: gate.runbook.requiredEvidence ?? '',
    source: 'r8-external-blockers-current.json',
    unblockRule: gate.runbook.unblockRule ?? '',
    verificationCommand: gate.runbook.verificationCommand ?? ''
  }))

  const r8OpenClosureKindCounts = pack.promptCheckboxManifest.open05032ClosureKindCounts ?? {}
  const checkboxClosureActions = Object.entries(r8OpenClosureKindCounts).map(([closureKind, count]) => {
    return {
      actionType: 'checkbox-closure-class',
      closureKind,
      count,
      currentEvidence: `${count} open checkbox row(s) classified as ${closureKind}`,
      gateId: null,
      owner: ownerForClosureKind(closureKind),
      prerequisite: 'Review the checkbox manifest rows for this closure class.',
	      requiredEvidence: 'Rows must either be converted into executable PRD/spec work or closed by the required external owner with explicit evidence.',
	      source: '0503-checkbox-manifest.json',
	      sourceFiles: pack.promptCheckboxManifest.open05032SourceFilesByClosureKind?.[closureKind] ?? { files: [], omittedFileCount: 0, totalFileCount: 0 },
	      unblockRule: 'Do not mark source checkboxes complete from generated inventory alone.',
	      verificationCommand: 'pnpm check:0503-checkbox-manifest'
	    }
  })

  const actions = [...externalGateActions, ...checkboxClosureActions].map(action => {
    const actionId = action.gateId ?? action.closureKind
    const verificationCommandNote = verificationCommandNoteForAction(actionId)
    return {
      ...action,
      actionId,
      actionDossierCommand: `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${actionId}`,
      rawEvidenceTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${actionId}`,
      sourceFiles: withSourceFileCommands(action.sourceFiles, actionId),
      submissionTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-template --action ${actionId}`,
      ...(verificationCommandNote ? { verificationCommandNote } : {})
    }
  })
  const ownerCounts = countBy(actions.map(action => action.owner))
  const ownerLaneCommands = Object.keys(ownerCounts)
    .sort((left, right) => left.localeCompare(right))
    .map(owner => ({
      coverageJsonCommand: `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --coverage-json <repo-relative-report.json>`,
      coverageReportCommand: `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --coverage-report <repo-relative-report.md>`,
      listActionsCommand: `pnpm --silent check:0503-owner-evidence -- --list-actions --owner ${owner}`,
      owner,
      ownerReadinessWithCoverageArtifactsCommand: `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md> --coverage-json <repo-relative-report.json>`,
      ownerReadinessWithEvidenceDirCommand: `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`,
      ownerReadinessCommand: `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`,
      ownerSummaryCommand: `pnpm --silent check:0503-owner-evidence -- --owner-summary --owner ${owner}`,
      partialR8DossierCommand: `pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner ${owner}`,
      rawEvidenceTemplateDirectoryCommand: `pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner ${owner}`,
      requireCompleteCommand: `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --require-complete`,
      submissionTemplateDirectoryCommand: `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner ${owner}`
    }))
  return {
    acceptanceStatus: pack.acceptanceStatus,
    actions,
    currentEnvironment: pack.currentEnvironment,
    generatedAt: new Date().toISOString(),
    ownerCounts,
    ownerLaneCommands,
    schemaVersion: ownerActionQueueSchemaVersion,
    sourceEvidence: [
      relativePath(acceptancePackJsonPath),
      pack.promptCheckboxManifest.jsonPath,
      'devhub/docs/r8bc-implementation-report.md'
    ]
  }
}

function buildNextOwnerCommands(ownerActionQueue) {
  const ownerLaneCommands = ownerActionQueue.ownerLaneCommands ?? []
  const lanesByOwner = new Map(ownerLaneCommands.map(lane => [lane.owner, lane]))
  const laneIndexByOwner = new Map(ownerLaneCommands.map((lane, index) => [lane.owner, index]))
  return Object.keys(ownerActionQueue.ownerCounts ?? {})
    .sort((left, right) => left.localeCompare(right))
    .map(owner => {
      const lane = lanesByOwner.get(owner) ?? {}
      const laneIndex = laneIndexByOwner.get(owner)
      return {
        actionCount: ownerActionQueue.ownerCounts[owner],
        blockerTaxonomyCommand: `pnpm check:0503-owner-evidence -- --blocker-taxonomy --owner ${owner}`,
        closureBundleCommand: `pnpm check:0503-owner-evidence -- --owner-closure-bundles --owner ${owner}`,
        coverageJsonCommand: lane.coverageJsonCommand ?? `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --coverage-json <repo-relative-report.json>`,
        coverageReportCommand: lane.coverageReportCommand ?? `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --coverage-report <repo-relative-report.md>`,
        listActionsCommand: lane.listActionsCommand ?? `pnpm --silent check:0503-owner-evidence -- --list-actions --owner ${owner}`,
        owner,
        partialR8DossierCommand: `pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner ${owner}`,
        rawEvidenceTemplateDirectoryCommand: lane.rawEvidenceTemplateDirectoryCommand ?? `pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner ${owner}`,
        ownerReadinessWithCoverageArtifactsCommand: lane.ownerReadinessWithCoverageArtifactsCommand ?? `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md> --coverage-json <repo-relative-report.json>`,
        ownerReadinessWithEvidenceDirCommand: lane.ownerReadinessWithEvidenceDirCommand ?? `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`,
        ownerReadinessCommand: lane.ownerReadinessCommand ?? `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`,
        ownerSummaryCommand: lane.ownerSummaryCommand ?? `pnpm --silent check:0503-owner-evidence -- --owner-summary --owner ${owner}`,
        requireCompleteCommand: lane.requireCompleteCommand ?? `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --require-complete`,
        sourceEvidencePath: laneIndex === undefined ? `${relativePath(ownerActionQueueJsonPath)}#/ownerCounts/${owner}` : `${relativePath(ownerActionQueueJsonPath)}#/ownerLaneCommands/${laneIndex}`,
        submissionTemplateDirectoryCommand: lane.submissionTemplateDirectoryCommand ?? `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner ${owner}`
      }
    })
}

function buildCompletionStatus(pack, ownerActionQueue) {
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const strictBlockerCrosswalkRowCount = pack.partialR8Rows.length +
    pack.failedExternalGates.length +
    pack.surveyAcceptanceRows.length +
    Object.keys(pack.promptCheckboxManifest?.open05032ClosureKindCounts ?? {}).length
  const completionGuard = {
    acceptanceStatusComplete: pack.acceptanceStatus === 'complete',
    failedExternalGatesClosed: pack.summary.failedExternalGateCount === 0,
    localClosurePossibleExhausted: pack.promptCheckboxManifest.localClosurePossibleOpenRows === 0,
    ownerActionQueueClosed: ownerActionQueue.actions.length === 0,
    partialR8RowsClosed: pack.summary.partialR8RowCount === 0,
    strictCompletionPassed: pack.summary.strictCompletionPassed === true,
    surveyAcceptanceRowsClosed: pack.summary.surveyAcceptanceRowCount === 0
  }
  const complete = Object.values(completionGuard).every(Boolean)
  const completionGuardEvidence = [
    {
      blockers: completionGuard.acceptanceStatusComplete ? [] : [`acceptanceStatus=${pack.acceptanceStatus}`, 'pnpm check:0503-strict'],
      evidence: `acceptanceStatus=${pack.acceptanceStatus}`,
      guard: 'acceptanceStatusComplete',
      passed: completionGuard.acceptanceStatusComplete,
      verificationCommand: 'pnpm check:0503-strict'
    },
    {
      blockers: completionGuard.failedExternalGatesClosed ? [] : pack.failedExternalGates.map(gate => gate.id),
      evidence: `failedExternalGates=${pack.summary.failedExternalGateCount}`,
      guard: 'failedExternalGatesClosed',
      passed: completionGuard.failedExternalGatesClosed,
      verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json'
    },
    {
      blockers: completionGuard.localClosurePossibleExhausted ? [] : [`localClosurePossibleOpenRows=${pack.promptCheckboxManifest.localClosurePossibleOpenRows}`, 'pnpm check:0503-checkbox-manifest'],
      evidence: `localClosurePossibleOpenRows=${pack.promptCheckboxManifest.localClosurePossibleOpenRows}`,
      guard: 'localClosurePossibleExhausted',
      passed: completionGuard.localClosurePossibleExhausted,
      verificationCommand: 'pnpm check:0503-checkbox-manifest'
    },
    {
      blockers: completionGuard.ownerActionQueueClosed ? [] : ownerActionQueue.actions.map(action => action.actionId),
      evidence: `ownerActionCount=${ownerActionQueue.actions.length}`,
      guard: 'ownerActionQueueClosed',
      passed: completionGuard.ownerActionQueueClosed,
      verificationCommand: 'pnpm check:0503-owner-evidence -- --owner-summary'
    },
    {
      blockers: completionGuard.partialR8RowsClosed ? [] : pack.partialR8Rows.map(row => row.file),
      evidence: `partialR8Rows=${pack.summary.partialR8RowCount}`,
      guard: 'partialR8RowsClosed',
      passed: completionGuard.partialR8RowsClosed,
      verificationCommand: 'pnpm check:0503-ledgers'
    },
    {
      blockers: completionGuard.strictCompletionPassed ? [] : [
        `partialR8Rows=${pack.summary.partialR8RowCount}`,
        `failedExternalGates=${pack.summary.failedExternalGateCount}`,
        `surveyAcceptanceRows=${pack.summary.surveyAcceptanceRowCount}`,
        'pnpm check:0503-strict'
      ],
      evidence: `strictCompletionPassed=${pack.summary.strictCompletionPassed}`,
      guard: 'strictCompletionPassed',
      passed: completionGuard.strictCompletionPassed,
      verificationCommand: 'pnpm check:0503-strict'
    },
    {
      blockers: completionGuard.surveyAcceptanceRowsClosed ? [] : pack.surveyAcceptanceRows.map(row => row.file),
      evidence: `surveyAcceptanceRows=${pack.summary.surveyAcceptanceRowCount}`,
      guard: 'surveyAcceptanceRowsClosed',
      passed: completionGuard.surveyAcceptanceRowsClosed,
      verificationCommand: 'pnpm check:0503-checkbox-manifest'
    }
  ].map(row => withRecommendedStrictCompletionCommand({ ...row, blockerCount: row.blockers.length }))
  const blockedSuccessCriteriaOwnerLinks = [
    {
      actual: pack.summary.failedExternalGateCount,
      evidencePath: relativePath(externalBlockerReportPath),
      expected: 0,
      id: 'EXTERNAL_GATE_CLOSURE',
      status: pack.summary.failedExternalGateCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.partialR8RowCount,
      evidencePath: `${relativePath(ledgerVerificationPath)}#/strictCompletion/partialRows`,
      expected: 0,
      id: 'R8_PARTIAL_ROW_CLOSURE',
      status: pack.summary.partialR8RowCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.surveyAcceptanceRowCount,
      evidencePath: `${relativePath(ledgerVerificationPath)}#/strictCompletion/surveyAcceptanceRows`,
      expected: 0,
      id: 'SURVEY_ACCEPTANCE_CLOSURE',
      status: pack.summary.surveyAcceptanceRowCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: ownerActionQueue.actions.length,
      evidencePath: relativePath(ownerActionQueueJsonPath),
      expected: 0,
      id: 'OWNER_ACTION_QUEUE_CLOSURE',
      status: ownerActionQueue.actions.length === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.strictCompletionPassed,
      evidencePath: relativePath(strictCompletionReportPath),
      expected: true,
      id: 'STRICT_COMPLETION_GATE',
      status: pack.summary.strictCompletionPassed === true ? 'verified' : 'blocked'
    }
  ]
    .filter(row => row.status !== 'verified')
    .map(row => ({
      ...row,
      ...ownerCommandLinksForActionIds(ownerActionIdsForSuccessCriterion(row.id, pack, ownerActionQueue), actionsById)
    }))
  return {
    acceptanceStatus: pack.acceptanceStatus,
    artifacts: {
      acceptancePack: relativePath(acceptancePackJsonPath),
      checkboxManifest: pack.promptCheckboxManifest.jsonPath,
      completionAudit: relativePath(completionAuditJsonPath),
      ownerActionQueue: relativePath(ownerActionQueueJsonPath),
      ownerClosureBundles: relativePath(ownerClosureBundlesJsonPath),
      strictReport: relativePath(strictCompletionReportPath)
    },
    blockedSuccessCriteriaOwnerLinks,
    complete,
    completionGuard,
    completionGuardEvidence,
    continuationCommands: {
      acceptancePack: 'pnpm check:0503-acceptance-pack',
      localGate: 'pnpm check:0503-local',
      nextOwnerCommands: 'pnpm check:0503-owner-evidence -- --next-owner-commands --owner <owner>',
      ownerBlockerTaxonomy: 'pnpm check:0503-owner-evidence -- --blocker-taxonomy --owner <owner>',
      ownerClosureBundleQuery: 'pnpm check:0503-owner-evidence -- --owner-closure-bundles --owner <owner>',
      ownerClosureBundles: relativePath(ownerClosureBundlesMarkdownPath),
      ownerReadiness: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>',
      ownerReadinessWithEvidenceDir: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>',
      ownerSourceFileDossier: 'pnpm check:0503-owner-evidence -- --source-file-dossier --action <actionId> --file <prompt-file>',
      ownerSummary: 'pnpm check:0503-owner-evidence -- --owner-summary',
      recommendedStrictGate: shellPortableStrictCompletionCommand,
      strictGate: 'pnpm check:0503-strict'
    },
    currentEnvironment: pack.currentEnvironment,
    failedExternalGateCommandSets: buildFailedExternalGateCommandSets(pack, actionsById),
    failedExternalGateCount: pack.summary.failedExternalGateCount,
    generatedAt: new Date().toISOString(),
    nextRequiredOwners: ownerActionQueue.ownerCounts,
    nextOwnerCommands: buildNextOwnerCommands(ownerActionQueue),
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    nonCompletionReasons: [
      `missingOrIncompleteRequirements=${strictBlockerCrosswalkRowCount}`,
      `partialR8Rows=${pack.summary.partialR8RowCount}`,
      `failedExternalGates=${pack.summary.failedExternalGateCount}`,
      `surveyAcceptanceRows=${pack.summary.surveyAcceptanceRowCount}`,
      `strictBlockerCrosswalkRows=${strictBlockerCrosswalkRowCount}`,
      `displayCount=${pack.currentEnvironment.displayCount}`,
      `isAdministrator=${pack.currentEnvironment.isAdministrator}`,
      `serviceInstalled=${pack.currentEnvironment.serviceInstalled}`,
      `zeroEgressPreflightReady=${pack.currentEnvironment.zeroEgressPreflightReady}`
    ],
    missingOrIncompleteRequirementCount: strictBlockerCrosswalkRowCount,
    ownerActionCount: ownerActionQueue.actions.length,
    partialR8RowCount: pack.summary.partialR8RowCount,
    promptCheckboxLocalClosureBlockedOpenRows: pack.promptCheckboxManifest.localClosureBlockedOpenRows,
    promptCheckboxLocalClosurePossibleOpenRows: pack.promptCheckboxManifest.localClosurePossibleOpenRows,
    promptArtifactRows: pack.promptArtifactManifest.prompt0503Rows.length + pack.promptArtifactManifest.prompt05032Rows.length,
    promptCheckboxOpenRows: pack.promptCheckboxManifest.totalOpen,
    promptCheckboxRows: pack.promptCheckboxManifest.totalRows,
    promptCheckboxScopeCounts: pack.promptCheckboxManifest.scopeCounts,
    schemaVersion: completionStatusSchemaVersion,
    strictBlockerCrosswalkRowCount,
    strictCompletionPassed: pack.summary.strictCompletionPassed,
    surveyAcceptanceRowCount: pack.summary.surveyAcceptanceRowCount
  }
}

function buildPromptToArtifactChecklist(pack) {
  const surveyRows = pack.promptArtifactManifest.prompt0503Rows.map((row, index) => withRecommendedStrictCompletionCommand({
    artifactManifestEvidencePath: `${relativePath(acceptancePackJsonPath)}#/promptArtifactManifest/prompt0503Rows/${index}`,
    checkboxManifestEvidencePath: pack.promptCheckboxManifest.jsonPath,
    checkboxVerificationCommand: 'pnpm check:0503-checkbox-manifest',
    checkedCheckboxes: row.checkedCheckboxes,
    evidenceStatus: row.evidenceStatus,
    file: row.file,
    localVerificationCommand: 'pnpm check:0503-ledgers',
    nextAction: row.nextAction ?? row.status ?? '',
    openCheckboxes: row.openCheckboxes,
    scope: 'prompts/0503',
    sourceLedgerPath: relativePath(surveyAcceptanceLedgerPath),
    sourceLedgerVerificationPath: `${relativePath(ledgerVerificationPath)}#/surveyLedger/rows/${index}`,
    sourcePromptPath: row.file,
    strictCompletionCommand: 'pnpm check:0503-strict',
    status: row.status ?? ''
  }))
  const r8Rows = pack.promptArtifactManifest.prompt05032Rows.map((row, index) => {
    const ownerActionIds = relatedOwnerActionIdsForPartialR8File(row.file)
    return withRecommendedStrictCompletionCommand({
      artifactManifestEvidencePath: `${relativePath(acceptancePackJsonPath)}#/promptArtifactManifest/prompt05032Rows/${index}`,
      batch: row.batch,
      checkboxManifestEvidencePath: pack.promptCheckboxManifest.jsonPath,
      checkboxVerificationCommand: 'pnpm check:0503-checkbox-manifest',
      checkedCheckboxes: row.checkedCheckboxes,
      evidenceStatus: row.evidenceStatus,
      file: row.file,
      implementationStatus: row.implementationStatus,
      localVerificationCommand: 'pnpm check:0503-ledgers',
      nextAction: row.nextAction ?? '',
      openCheckboxes: row.openCheckboxes,
      ownerActionDossierCommands: ownerActionIds.map(actionId => `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${actionId}`),
      ownerActionIds,
      ownerReadinessWithEvidenceDirCommands: [...new Set(ownerActionIds.map(actionId => ownerForOwnerActionId(actionId)).filter(Boolean))]
        .map(owner => `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`),
      pendingMarkers: row.pendingMarkers,
      rawEvidenceTemplateCommands: ownerActionIds.map(actionId => `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${actionId}`),
      scope: 'prompts/0503-2',
      sourceLedgerPath: relativePath(completionLedgerPath),
      sourceLedgerVerificationPath: `${relativePath(ledgerVerificationPath)}#/completionLedger/rows/${index}`,
      sourcePromptPath: row.file,
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommands: ownerActionIds.map(actionId => `pnpm --silent check:0503-owner-evidence -- --print-template --action ${actionId}`)
    })
  })
  return [...surveyRows, ...r8Rows]
}

function relatedOwnerActionIdsForPartialR8File(file) {
  const ownerActionIdsByFile = {
    'prompts/0503-2/R8.B/prd.md': [
      'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
      'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
      'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY',
      'hardware-verification'
    ],
    'prompts/0503-2/R8.B/spec-02-port-floating-window.md': [
      'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
      'hardware-verification'
    ],
    'prompts/0503-2/R8.B/spec-11-window-virtual-desktop.md': [
      'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
      'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY'
    ],
    'prompts/0503-2/R8.C/prd.md': [
      'R8C_SPEC17_ADMIN_SHELL',
      'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED',
      'H1_J16_ZERO_EGRESS_CAPTURE_READY'
    ],
    'prompts/0503-2/R8.C/spec-17-watchdog-subprocess.md': [
      'R8C_SPEC17_ADMIN_SHELL',
      'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED'
    ]
  }
  return ownerActionIdsByFile[file] ?? []
}

function ownerForOwnerActionId(actionId) {
  const ownerByActionId = {
    'ASSERT_BROWSERWINDOW_SECOND_DISPLAY': 'operator',
    'H1_J16_ZERO_EGRESS_CAPTURE_READY': 'operator',
    'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY': 'operator',
    'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY': 'operator',
    'R8C_SPEC17_ADMIN_SHELL': 'operator',
    'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED': 'operator',
    'admin-service-verification': 'operator',
    'hardware-verification': 'operator',
    'legal-product-acceptance': 'legal-product',
    'survey-context': 'product',
    'user-product-acceptance': 'user-product'
  }
  return ownerByActionId[actionId] ?? null
}

function ownerActionCommandForAction(actionsById, actionId, field, commandFlag) {
  const action = actionsById.get(actionId)
  return action?.[field] ?? `pnpm --silent check:0503-owner-evidence -- --${commandFlag} --action ${actionId}`
}

function uniqueStrings(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))]
}

function ownerActionIdsForSuccessCriterion(criterionId, pack, ownerActionQueue) {
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  if (criterionId === 'EXTERNAL_GATE_CLOSURE') {
    return uniqueStrings((pack.failedExternalGates ?? []).map(row => row.id)).filter(actionId => actionsById.has(actionId))
  }
  if (criterionId === 'R8_PARTIAL_ROW_CLOSURE') {
    return uniqueStrings((pack.partialR8Rows ?? []).flatMap(row => relatedOwnerActionIdsForPartialR8File(row.file))).filter(actionId => actionsById.has(actionId))
  }
  if (criterionId === 'SURVEY_ACCEPTANCE_CLOSURE') {
    return uniqueStrings((pack.surveyAcceptanceRows ?? []).map(row => ownerActionIdForSurveyFile(row.file))).filter(actionId => actionsById.has(actionId))
  }
  if (criterionId === 'OWNER_ACTION_QUEUE_CLOSURE' || criterionId === 'STRICT_COMPLETION_GATE') {
    return uniqueStrings((ownerActionQueue.actions ?? []).map(action => action.actionId))
  }
  return []
}

function ownerCommandLinksForActionIds(ownerActionIds, actionsById) {
  const owners = ownerActionOwnersForIds(ownerActionIds, actionsById)
  return {
    actionDossierCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'actionDossierCommand', 'action-dossier')),
    ownerActionIds,
    ownerActionOwners: owners,
    ownerReadinessWithEvidenceDirCommands: owners.map(owner => `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`),
    rawEvidenceTemplateCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template')),
    submissionTemplateCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'submissionTemplateCommand', 'print-template'))
  }
}

function buildFailedExternalGateCommandSets(pack, actionsById) {
  return (pack.failedExternalGates ?? []).map((gate, index) => ({
    actionDossierCommand: ownerActionCommandForAction(actionsById, gate.id, 'actionDossierCommand', 'action-dossier'),
    blockerKind: gate.runbook?.blockerKind ?? 'unknown',
    currentEvidence: gate.evidence,
    gateId: gate.id,
    owner: gate.runbook?.owner ?? 'unassigned',
    rawEvidenceTemplateCommand: ownerActionCommandForAction(actionsById, gate.id, 'rawEvidenceTemplateCommand', 'print-evidence-template'),
    sourceEvidencePath: `${relativePath(acceptancePackJsonPath)}#/failedExternalGates/${index}`,
    submissionTemplateCommand: ownerActionCommandForAction(actionsById, gate.id, 'submissionTemplateCommand', 'print-template'),
    verificationCommand: gate.runbook?.verificationCommand ?? '',
    verificationCommandNote: actionsById.get(gate.id)?.verificationCommandNote ?? gate.verificationCommandNote ?? ''
  }))
}

function ownerActionOwnersForIds(ownerActionIds, actionsById) {
  return uniqueStrings(ownerActionIds
    .map(actionId => actionsById.get(actionId)?.owner)
  )
}

function ownerForActionOwners(ownerActionOwners) {
  if (ownerActionOwners.length === 1) return ownerActionOwners[0]
  if (ownerActionOwners.length > 1) return ownerActionOwners.slice().sort().join('+')
  return 'unassigned'
}

function ownerForLinkedOwnerActions(ownerActionIds, actionsById) {
  return ownerForActionOwners(ownerActionOwnersForIds(ownerActionIds, actionsById))
}

function ownerActionIdForSurveyFile(file) {
  if (file.includes('legal')) return 'legal-product-acceptance'
  if (file.includes('final-acceptance')) return 'user-product-acceptance'
  return 'survey-context'
}

function categoryForRequirement(requirement, ownerAction) {
  if (requirement.requirementType === 'partial-r8-row') return 'partial-r8-implementation'
  if (ownerAction?.closureKind) return ownerAction.closureKind
  if (requirement.requirementType === 'survey-acceptance-row') return ownerActionIdForSurveyFile(requirement.id)
  return requirement.requirementType
}

function openRowWeightForRequirement(requirement, ownerAction) {
  if (requirement.requirementType === 'open-checkbox-closure-class' && Number.isInteger(ownerAction?.count)) {
    return ownerAction.count
  }
  return 1
}

function buildBlockerTaxonomy(missingOrIncompleteRequirements, strictBlockerCrosswalk, ownerActionQueue) {
  const actionsById = new Map(ownerActionQueue.actions.map(action => [action.actionId, action]))
  const crosswalkByRequirement = new Map(strictBlockerCrosswalk.map(row => [`${row.requirementType}:${row.id}`, row]))
  const rows = missingOrIncompleteRequirements.map(requirement => {
    const crosswalk = crosswalkByRequirement.get(`${requirement.requirementType}:${requirement.id}`) ?? {}
    const ownerAction = crosswalk.ownerActionId ? actionsById.get(crosswalk.ownerActionId) : null
    const category = categoryForRequirement(requirement, ownerAction)
    const weightedOpenRows = openRowWeightForRequirement(requirement, ownerAction)
    return withRecommendedStrictCompletionCommand({
      actionDossierCommand: crosswalk.actionDossierCommand ?? null,
      actionDossierCommands: Array.isArray(crosswalk.actionDossierCommands) ? crosswalk.actionDossierCommands : [],
      category,
      currentEvidence: requirement.evidence,
      id: requirement.id,
      owner: requirement.owner,
      ownerActionId: crosswalk.ownerActionId ?? null,
      ownerActionIds: Array.isArray(crosswalk.ownerActionIds) ? crosswalk.ownerActionIds : [],
      rawEvidenceTemplateCommand: crosswalk.rawEvidenceTemplateCommand ?? null,
      rawEvidenceTemplateCommands: Array.isArray(crosswalk.rawEvidenceTemplateCommands) ? crosswalk.rawEvidenceTemplateCommands : [],
      requirementType: requirement.requirementType,
      source: requirement.source,
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommand: crosswalk.submissionTemplateCommand ?? null,
      submissionTemplateCommands: Array.isArray(crosswalk.submissionTemplateCommands) ? crosswalk.submissionTemplateCommands : [],
      verificationCommand: crosswalk.verificationCommand ?? 'pnpm check:0503-strict',
      weightedOpenRows
    })
  })
  return {
    boundary: [
      'Blocker taxonomy is derived from current incomplete requirements and owner action queue rows.',
      'Taxonomy rows and weighted counts are diagnostic execution aids only; they are not completion evidence.',
      'Final completion still requires every referenced real evidence item and a passing pnpm check:0503-strict run.'
    ],
    categoryCounts: weightedCountBy(rows, row => row.category),
    categoryWeightedOpenRows: weightedCountBy(rows, row => row.category, row => row.weightedOpenRows),
    ownerCounts: weightedCountBy(rows, row => row.owner),
    ownerWeightedOpenRows: weightedCountBy(rows, row => row.owner, row => row.weightedOpenRows),
    requirementTypeCounts: weightedCountBy(rows, row => row.requirementType),
    rows,
    sourceCounts: weightedCountBy(rows, row => row.source),
    totalTaxonomyRows: rows.length,
    totalWeightedOpenRows: rows.reduce((sum, row) => sum + row.weightedOpenRows, 0)
  }
}

function ownerActionIdsForGuardBlocker(guard, blocker, partialR8Dossier, actionsById) {
  if ((guard === 'failedExternalGatesClosed' || guard === 'ownerActionQueueClosed') && actionsById.has(blocker)) {
    return [blocker]
  }
  if (guard === 'partialR8RowsClosed') {
    const dossierRow = partialR8Dossier.find(row => row.file === blocker)
    return dossierRow?.ownerActionIds ?? []
  }
  if (guard === 'surveyAcceptanceRowsClosed') {
    const actionId = ownerActionIdForSurveyFile(blocker)
    return actionsById.has(actionId) ? [actionId] : []
  }
  return []
}

function buildCompletionGuardOwnerCrosswalk(completionGuardEvidence, partialR8Dossier, ownerActionQueue) {
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const ownerActionCommand = (actionId, field, commandFlag) => {
    const action = actionsById.get(actionId)
    return action?.[field] ?? `pnpm --silent check:0503-owner-evidence -- --${commandFlag} --action ${actionId}`
  }
  return completionGuardEvidence.flatMap(guardRow => {
    const blockers = guardRow.passed ? [] : guardRow.blockers ?? []
    return blockers.map(blocker => {
      const ownerActionIds = ownerActionIdsForGuardBlocker(guardRow.guard, blocker, partialR8Dossier, actionsById)
      const ownerActionId = ownerActionIds.length === 1 ? ownerActionIds[0] : null
      return withRecommendedStrictCompletionCommand({
        actionDossierCommand: ownerActionId === null ? null : ownerActionCommand(ownerActionId, 'actionDossierCommand', 'action-dossier'),
        actionDossierCommands: ownerActionIds.map(actionId => ownerActionCommand(actionId, 'actionDossierCommand', 'action-dossier')),
        blocker,
        blockerType: ownerActionIds.length > 0 ? 'owner-action-linked' : 'strict-only',
        guard: guardRow.guard,
        guardEvidencePath: guardRow.auditEvidencePath,
        ownerActionIds,
        owners: [...new Set(ownerActionIds.map(actionId => actionsById.get(actionId)?.owner ?? 'unassigned'))],
        rawEvidenceTemplateCommand: ownerActionId === null ? null : ownerActionCommand(ownerActionId, 'rawEvidenceTemplateCommand', 'print-evidence-template'),
        rawEvidenceTemplateCommands: ownerActionIds.map(actionId => ownerActionCommand(actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template')),
        strictCompletionCommand: 'pnpm check:0503-strict',
        submissionTemplateCommand: ownerActionId === null ? null : ownerActionCommand(ownerActionId, 'submissionTemplateCommand', 'print-template'),
        submissionTemplateCommands: ownerActionIds.map(actionId => ownerActionCommand(actionId, 'submissionTemplateCommand', 'print-template')),
        verificationCommands: ownerActionIds.length > 0
          ? ownerActionIds.map(actionId => actionsById.get(actionId)?.verificationCommand ?? guardRow.verificationCommand)
          : [guardRow.verificationCommand]
      })
    })
  })
}

function buildOwnerActionGuardBacklinks(completionGuardOwnerCrosswalk, ownerActionQueue) {
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const backlinksByActionId = new Map()
  for (const crosswalkRow of completionGuardOwnerCrosswalk) {
    for (const actionId of crosswalkRow.ownerActionIds ?? []) {
      const action = actionsById.get(actionId)
      if (!action) continue
      const existing = backlinksByActionId.get(actionId) ?? withRecommendedStrictCompletionCommand({
        actionDossierCommand: ownerActionCommandForAction(actionsById, actionId, 'actionDossierCommand', 'action-dossier'),
        actionDossierCommands: [ownerActionCommandForAction(actionsById, actionId, 'actionDossierCommand', 'action-dossier')],
        actionId,
        blockers: [],
        guardsBlocked: [],
        owner: action.owner ?? 'unassigned',
        rawEvidenceTemplateCommand: ownerActionCommandForAction(actionsById, actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template'),
        rawEvidenceTemplateCommands: [ownerActionCommandForAction(actionsById, actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template')],
        strictCompletionCommand: 'pnpm check:0503-strict',
        submissionTemplateCommand: ownerActionCommandForAction(actionsById, actionId, 'submissionTemplateCommand', 'print-template'),
        submissionTemplateCommands: [ownerActionCommandForAction(actionsById, actionId, 'submissionTemplateCommand', 'print-template')],
        verificationCommand: action.verificationCommand ?? ''
      })
      if (!existing.guardsBlocked.includes(crosswalkRow.guard)) existing.guardsBlocked.push(crosswalkRow.guard)
      if (!existing.blockers.includes(crosswalkRow.blocker)) existing.blockers.push(crosswalkRow.blocker)
      backlinksByActionId.set(actionId, existing)
    }
  }
  return [...backlinksByActionId.values()].sort((left, right) => {
    const ownerCompare = left.owner.localeCompare(right.owner)
    return ownerCompare === 0 ? left.actionId.localeCompare(right.actionId) : ownerCompare
  })
}

function buildPartialR8DossierLinksForAction(actionId, owner, completionAudit) {
  return (completionAudit.partialR8Dossier ?? [])
    .filter(row => Array.isArray(row.ownerActionIds) && row.ownerActionIds.includes(actionId))
    .map(row => ({
      file: row.file,
      partialR8FileDossierCommand: `pnpm check:0503-owner-evidence -- --partial-r8-dossier --file ${row.file}`,
      partialR8OwnerFileDossierCommand: `pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner ${owner} --file ${row.file}`,
      sourceEvidencePath: row.sourceEvidencePath,
      status: row.status
    }))
}

function normalizeBlockingTaxonomyRow(row) {
  return withRecommendedStrictCompletionCommand({
    actionDossierCommand: row.actionDossierCommand ?? null,
    actionDossierCommands: Array.isArray(row.actionDossierCommands) ? row.actionDossierCommands : [],
    category: row.category,
    currentEvidence: row.currentEvidence,
    id: row.id,
    ownerActionId: row.ownerActionId ?? null,
    ownerActionIds: Array.isArray(row.ownerActionIds) ? row.ownerActionIds : [],
    rawEvidenceTemplateCommand: row.rawEvidenceTemplateCommand ?? null,
    rawEvidenceTemplateCommands: Array.isArray(row.rawEvidenceTemplateCommands) ? row.rawEvidenceTemplateCommands : [],
    requirementType: row.requirementType,
    source: row.source,
    strictCompletionCommand: row.strictCompletionCommand,
    submissionTemplateCommand: row.submissionTemplateCommand ?? null,
    submissionTemplateCommands: Array.isArray(row.submissionTemplateCommands) ? row.submissionTemplateCommands : [],
    verificationCommand: row.verificationCommand,
    weightedOpenRows: Number.isFinite(row.weightedOpenRows) ? row.weightedOpenRows : 1
  })
}

function taxonomyRowKey(row) {
  return `${row.requirementType}:${row.id}`
}

function buildBlockingTaxonomyRowsForAction(actionId, completionAudit) {
  return (completionAudit.blockerTaxonomy?.rows ?? [])
    .filter(row => row.ownerActionId === actionId || (Array.isArray(row.ownerActionIds) && row.ownerActionIds.includes(actionId)))
    .map(row => normalizeBlockingTaxonomyRow(row))
}

function dedupeBlockingTaxonomyRows(rows) {
  const rowsByKey = new Map()
  for (const row of rows) {
    rowsByKey.set(taxonomyRowKey(row), row)
  }
  return [...rowsByKey.values()].sort((left, right) => taxonomyRowKey(left).localeCompare(taxonomyRowKey(right)))
}

function buildOwnerClosureBundles(ownerActionQueue, completionAudit) {
  const backlinksByActionId = new Map((completionAudit.ownerActionGuardBacklinks ?? []).map(row => [row.actionId, row]))
  const actionsByOwner = new Map()
  for (const action of ownerActionQueue.actions ?? []) {
    const backlink = backlinksByActionId.get(action.actionId)
    const owner = action.owner ?? 'unassigned'
    const partialR8DossierLinks = buildPartialR8DossierLinksForAction(action.actionId, owner, completionAudit)
    const blockingTaxonomyRows = buildBlockingTaxonomyRowsForAction(action.actionId, completionAudit)
    const ownerActions = actionsByOwner.get(owner) ?? []
    ownerActions.push({
      actionDossierCommand: action.actionDossierCommand,
      actionId: action.actionId,
      blockingTaxonomyRowIds: blockingTaxonomyRows.map(row => row.id),
      blockingTaxonomyRows,
      blockers: backlink?.blockers ?? [],
      closureKind: action.closureKind,
      currentEvidence: action.currentEvidence,
      guardsBlocked: backlink?.guardsBlocked ?? [],
      partialR8DossierLinks,
      partialR8Files: partialR8DossierLinks.map(row => row.file),
      prerequisite: action.prerequisite,
      rawEvidenceTemplateCommand: action.rawEvidenceTemplateCommand,
      requiredEvidence: action.requiredEvidence,
      ...(action.sourceFiles ? { sourceFiles: action.sourceFiles } : {}),
      strictCompletionCommand,
      recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
      submissionTemplateCommand: action.submissionTemplateCommand,
      unblockRule: action.unblockRule,
      verificationCommand: action.verificationCommand,
      verificationCommandNote: action.verificationCommandNote ?? ''
    })
    actionsByOwner.set(owner, ownerActions)
  }
  const owners = [...actionsByOwner.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([owner, actions]) => {
      const blockingTaxonomyRows = dedupeBlockingTaxonomyRows(actions.flatMap(action => action.blockingTaxonomyRows ?? []))
      return {
        actionCount: actions.length,
        actions: actions.sort((left, right) => left.actionId.localeCompare(right.actionId)),
        blockingTaxonomyRowCount: blockingTaxonomyRows.length,
        blockingTaxonomyRows,
        categoryWeightedOpenRows: weightedCountBy(blockingTaxonomyRows, row => row.category, row => row.weightedOpenRows),
        owner,
        recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
        readinessCommand: `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`,
        requireCompleteCommand: `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --require-complete`,
        summaryCommand: `pnpm --silent check:0503-owner-evidence -- --owner-summary --owner ${owner}`,
        weightedOpenRows: blockingTaxonomyRows.reduce((sum, row) => sum + row.weightedOpenRows, 0)
      }
    })
  return {
    acceptanceStatus: completionAudit.acceptanceStatus,
    generatedAt: new Date().toISOString(),
    ownerCount: owners.length,
    owners,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    schemaVersion: ownerClosureBundleSchemaVersion,
    sourceEvidence: [
      relativePath(ownerActionQueueJsonPath),
      relativePath(completionAuditJsonPath)
    ],
    status: completionAudit.status,
    totalActionCount: owners.reduce((sum, owner) => sum + owner.actionCount, 0)
  }
}

function buildCompletionAudit(pack, ownerActionQueue, completionStatus) {
  const checkboxClosureActions = ownerActionQueue.actions.filter(action => action.actionType === 'checkbox-closure-class')
  const promptToArtifactChecklist = buildPromptToArtifactChecklist(pack)
  const completionGuardEvidence = (completionStatus.completionGuardEvidence ?? []).map((row, index) => withRecommendedStrictCompletionCommand({
    ...row,
    auditEvidencePath: `${relativePath(completionStatusJsonPath)}#/completionGuardEvidence/${index}`,
    strictCompletionCommand: 'pnpm check:0503-strict'
  }))
  const actionsById = new Map(ownerActionQueue.actions.map(action => [action.actionId, action]))
  const partialR8Dossier = pack.partialR8Rows.map((row, index) => {
    const ownerActionIds = relatedOwnerActionIdsForPartialR8File(row.file).filter(actionId => actionsById.has(actionId))
    return withRecommendedStrictCompletionCommand({
      file: row.file,
      nextAction: row.nextAction ?? '',
      ownerActionDossierCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'actionDossierCommand', 'action-dossier')),
      ownerActionIds,
      ownerActionVerificationCommands: ownerActionIds.map(actionId => actionsById.get(actionId)?.verificationCommand ?? 'pnpm check:0503-owner-evidence -- --owner-summary'),
      rawEvidenceTemplateCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template')),
      sourceEvidencePath: `${relativePath(ledgerVerificationPath)}#/strictCompletion/partialRowDetails/${index}`,
      status: 'partial',
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'submissionTemplateCommand', 'print-template')),
      verificationCommand: 'pnpm check:0503-ledgers'
    })
  })
  const completionGuardOwnerCrosswalk = buildCompletionGuardOwnerCrosswalk(completionGuardEvidence, partialR8Dossier, ownerActionQueue)
  const ownerActionGuardBacklinks = buildOwnerActionGuardBacklinks(completionGuardOwnerCrosswalk, ownerActionQueue)
  const rootPackageJson = readJson(rootPackageJsonPath)
  const rootDependencyNames = Object.keys(rootPackageJson.dependencies ?? {})
  const rootDependencyCount = rootDependencyNames.length
  const rootLockText = readText(rootPnpmLockPath)
  const rootLockDependencyMatchCount = rootDependencyNames.filter(dependencyName => {
    return rootLockText.includes(`      '${dependencyName}':`) && rootLockText.includes(`  '${dependencyName}@`)
  }).length
  const successCriterionOwnerLinks = criterionId => {
    return ownerCommandLinksForActionIds(ownerActionIdsForSuccessCriterion(criterionId, pack, ownerActionQueue), actionsById)
  }
  const successCriteria = [
    {
      actual: pack.promptArtifactManifest.prompt0503Rows.length,
      evidencePath: `${relativePath(acceptancePackJsonPath)}#/promptArtifactManifest/prompt0503Rows`,
      expected: 34,
      id: 'PROMPTS_0503_LEDGER_COVERAGE',
      requirement: 'Every Markdown document under prompts/0503 is represented in the survey acceptance ledger.',
      status: pack.promptArtifactManifest.prompt0503Rows.length === 34 ? 'verified' : 'missing'
    },
    {
      actual: pack.promptArtifactManifest.prompt05032Rows.length,
      evidencePath: `${relativePath(acceptancePackJsonPath)}#/promptArtifactManifest/prompt05032Rows`,
      expected: 81,
      id: 'PROMPTS_0503_2_LEDGER_COVERAGE',
      requirement: 'Every Markdown development document under prompts/0503-2 is represented in the R8 completion ledger.',
      status: pack.promptArtifactManifest.prompt05032Rows.length === 81 ? 'verified' : 'missing'
    },
    {
      actual: pack.promptCheckboxManifest.totalRows,
      evidencePath: pack.promptCheckboxManifest.jsonPath,
      expected: pack.promptCheckboxManifest.totalRows,
      id: 'PROMPT_CHECKBOX_MANIFEST_COVERAGE',
      requirement: 'Every source checkbox is inventoried with checked/open state, owner class, and closure kind.',
      status: 'verified'
    },
    {
      actual: pack.promptCheckboxManifest.localClosurePossibleOpenRows,
      evidencePath: `${pack.promptCheckboxManifest.jsonPath}#/localClosurePossibleOpenRows`,
      expected: 0,
      id: 'LOCAL_CLOSURE_EXHAUSTED',
      requirement: 'No remaining open checkbox row is locally closeable by code-only work in the current environment.',
      status: pack.promptCheckboxManifest.localClosurePossibleOpenRows === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.failedExternalGateCount,
      evidencePath: relativePath(externalBlockerReportPath),
      expected: 0,
      id: 'EXTERNAL_GATE_CLOSURE',
      requirement: 'All external hardware, administrator, and network-capture gates pass with real evidence.',
      status: pack.summary.failedExternalGateCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.partialR8RowCount,
      evidencePath: `${relativePath(ledgerVerificationPath)}#/strictCompletion/partialRows`,
      expected: 0,
      id: 'R8_PARTIAL_ROW_CLOSURE',
      requirement: 'No prompts/0503-2 row remains partial.',
      status: pack.summary.partialR8RowCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.surveyAcceptanceRowCount,
      evidencePath: `${relativePath(ledgerVerificationPath)}#/strictCompletion/surveyAcceptanceRows`,
      expected: 0,
      id: 'SURVEY_ACCEPTANCE_CLOSURE',
      requirement: 'No prompts/0503 survey row remains dependent on product, legal, or user acceptance evidence.',
      status: pack.summary.surveyAcceptanceRowCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: ownerActionQueue.actions.length,
      evidencePath: relativePath(ownerActionQueueJsonPath),
      expected: 0,
      id: 'OWNER_ACTION_QUEUE_CLOSURE',
      requirement: 'No owner action remains before final completion is claimed.',
      status: ownerActionQueue.actions.length === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.strictCompletionPassed,
      evidencePath: relativePath(strictCompletionReportPath),
      expected: true,
      id: 'STRICT_COMPLETION_GATE',
      requirement: 'The strict completion gate passes after all prompt, checkbox, external, and acceptance evidence is complete.',
      status: pack.summary.strictCompletionPassed === true ? 'verified' : 'blocked'
    },
    {
      actual: rootDependencyCount,
      evidencePath: relativePath(rootPackageJsonPath),
      expected: 8,
      id: 'ROOT_PACKAGE_DEPENDENCY_PRESERVATION',
      requirement: 'The 0503 completion tooling preserves the pre-existing root font dependencies instead of replacing package.json with scripts only.',
      status: rootDependencyCount === 8 ? 'verified' : 'missing'
    },
    {
      actual: rootLockDependencyMatchCount,
      evidencePath: relativePath(rootPnpmLockPath),
      expected: rootDependencyCount,
      id: 'ROOT_LOCKFILE_DEPENDENCY_SYNC',
      requirement: 'The root pnpm lockfile remains synchronized with the preserved root font dependencies.',
      status: rootLockDependencyMatchCount === rootDependencyCount ? 'verified' : 'missing'
    }
  ].map(row => ({
    ...row,
    ...successCriterionOwnerLinks(row.id)
  }))

  const commandChecklist = [
    {
      command: 'pnpm check:0503-acceptance-pack',
      evidencePath: relativePath(acceptancePackJsonPath),
      id: 'GENERATE_AND_VERIFY_ACCEPTANCE_PACK',
      requirement: 'Regenerate the acceptance pack and verify evidence-pack integrity.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-local',
      evidencePath: relativePath(rootPackageJsonPath),
      id: 'LOCAL_0503_VERIFICATION_SUITE',
      requirement: 'Run all locally actionable 0503 self-tests, devhub low-resource implementation checks, re-render and verify the acceptance pack from an already audited strict report without refreshing env-sensitive gates, then verify prompt/report no-emoji compliance.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-strict',
      evidencePath: relativePath(strictCompletionReportPath),
      id: 'STRICT_COMPLETION_COMMAND',
      requirement: 'Fail until strict completion is genuinely satisfied; pass only when complete.',
      status: pack.summary.strictCompletionPassed === true ? 'verified' : 'blocked'
    },
    {
      command: shellPortableStrictCompletionCommand,
      evidencePath: relativePath(strictRunnerPath),
      id: 'STRICT_COMPLETION_VD_WATCH_COMMAND',
      requirement: 'Run strict completion through a shell-portable Node flag that sets DEVHUB_R8_VD_FOREGROUND_WATCH=1 before external blocker probes, avoiding WSL/bash environment-prefix drift.',
      status: pack.summary.strictCompletionPassed === true ? 'verified' : 'blocked'
    },
    {
      command: 'pnpm check:0503-strict',
      evidencePath: relativePath(strictRunnerPath),
      id: 'STRICT_RUNNER_FAILURE_SUMMARY_COMMAND',
    requirement: 'When strict completion is not yet satisfied, print a concise non-stack blocker summary with failed external gate evidence snapshots, failed external gate action dossier commands, failed external gate verification notes, failed external gate raw evidence template commands, failed external gate submission template commands, blocker taxonomy, owner lane command-set details, owner readiness commands, owner readiness evidence-dir commands, owner readiness coverage-artifact commands, raw and submission template directory commands, coverage report and coverage JSON commands, partial R8 dossier commands, owner blocker taxonomy commands, and owner closure bundle commands while preserving the non-zero exit code.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-strict:self-test',
      evidencePath: relativePath(strictRunnerPath),
      id: 'STRICT_RUNNER_SELF_TEST_COMMAND',
      requirement: 'Verify the strict runner refreshes and verifies the acceptance pack after expected strict-completion failures while refusing structural ledger failures.',
      status: 'verified'
    },
    {
      command: 'pnpm -C devhub typecheck',
      evidencePath: relativePath(devhubPackageJsonPath),
      id: 'DEVHUB_TYPECHECK_COMMAND',
      requirement: 'Run the DevHub TypeScript no-emit gate as a named local implementation verification command.',
      status: 'verified'
    },
    {
      command: 'pnpm -C devhub lint',
      evidencePath: relativePath(devhubPackageJsonPath),
      id: 'DEVHUB_LINT_COMMAND',
      requirement: 'Run the DevHub lint gate as a named local implementation verification command.',
      status: 'verified'
    },
    {
      command: 'git -C devhub diff --check',
      evidencePath: relativePath(devhubPackageJsonPath),
      id: 'DEVHUB_DIFF_CHECK_COMMAND',
      requirement: 'Run the DevHub whitespace/conflict-marker diff gate named in the 0503 verification plan.',
      status: 'verified'
    },
    {
      command: 'git diff --check',
      evidencePath: relativePath(rootPackageJsonPath),
      id: 'ROOT_DIFF_CHECK_COMMAND',
      requirement: 'Run the root whitespace/conflict-marker diff gate named in the 0503 verification plan.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-checkbox-manifest',
      evidencePath: pack.promptCheckboxManifest.jsonPath,
      id: 'CHECKBOX_MANIFEST_COMMAND',
      requirement: 'Regenerate checkbox inventory for prompts/0503 and prompts/0503-2.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-evidence-pack',
      evidencePath: relativePath(acceptancePackJsonPath),
      id: 'EVIDENCE_PACK_VERIFIER_COMMAND',
      requirement: evidencePackVerifierRequirement,
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-no-emoji',
      evidencePath: relativePath(noEmojiVerifierPath),
      id: 'NO_EMOJI_PROMPT_REPORT_COMMAND',
      requirement: 'Verify prompts/0503, prompts/0503-2, and active task Markdown/JSON/JSONL artifacts contain no emoji glyphs.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-no-emoji:self-test',
      evidencePath: relativePath(noEmojiVerifierPath),
      id: 'NO_EMOJI_VERIFIER_SELF_TEST_COMMAND',
      requirement: 'Verify the no-emoji verifier accepts clean Markdown and rejects emoji glyphs in Markdown, JSON, and JSONL fixtures before scanning real prompt and task artifacts.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --evidence <submission.json>',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_EVIDENCE_INTAKE_VERIFIER_COMMAND',
      requirement: 'Validate owner-submitted external/product evidence metadata, required schemaVersion, hashAlgorithm, evidenceModifiedAt, and evidenceSizeBytes matching, canonical actionId matching, command alignment, evidence timestamp and file mtime freshness, file existence, binary-safe SHA-256 integrity with explicit hashAlgorithm reporting, self-referential evidence rejection, structured checkbox closure evidence, structured external blocker or zero-egress semantic pass evidence, and versioned non-completion boundary output before rerunning strict completion.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence:self-test',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_EVIDENCE_VERIFIER_SELF_TEST_COMMAND',
      requirement: 'Verify the owner evidence intake verifier rejects missing or wrong submission schemaVersion, missing or wrong submission hashAlgorithm, missing or mismatched submission evidenceModifiedAt/evidenceSizeBytes, ambiguous action ids, stale timestamps, stale evidence file mtimes, self-referential evidence paths, failed structured gate reports, mismatched checkbox closure evidence, command mismatches, path traversal, and false completion boundary claims while hashing binary evidence bytes; verifies evidence hash schemaVersion, hashAlgorithm, boundary, file size, and file mtime metadata plus validation summary hashAlgorithm, coverage report hashAlgorithm, validation schemaVersion boundaries, owner action list action/template commands, owner summary schemaVersion boundaries, template directory schemaVersion boundaries, owner readiness top-level blocking action/taxonomy aggregates with action/template command arrays in both normal and evidence-dir coverage modes, owner closure bundle taxonomy command arrays, owner closure bundle source-file dossier commands, source-file dossier verification command notes, owner closure bundle action verification command notes, owner output matrix verification note coverage floors including blocker taxonomy row notes, and no-partial-r8-rows owner output; and locks template README workflow guidance plus owner action dossier command payloads, owner template verification command notes, and owner action dossier shell-boundary notes for direct-template-validation refusal, owner-readiness evidence-dir validation, require-complete, and final strict rerun.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --print-template --action <actionId>',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_EVIDENCE_ACTION_TEMPLATE_COMMAND',
      requirement: 'Generate an action-specific owner evidence submission template with the canonical actionId, owner, evidenceModifiedAt/evidenceSizeBytes placeholders, hashAlgorithm=sha256, verification command, verification command note, current evidence, required evidence, and unblock rule prefilled.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner <owner>',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_EVIDENCE_TEMPLATE_DIRECTORY_COMMAND',
      requirement: 'Generate non-passable templateOnly owner evidence submission templates with evidenceModifiedAt/evidenceSizeBytes placeholders, hashAlgorithm=sha256, and verification command notes for a selected owner lane so owners can prepare every required submission without copying JSON from chat output.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --print-evidence-template --action <actionId>',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_EVIDENCE_RAW_TEMPLATE_COMMAND',
      requirement: 'Generate a non-passable templateOnly raw evidence shape for the selected action, including action-specific verification command notes when applicable, so owners know the required evidence schema without allowing the template itself to close the action.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --list-actions',
      evidencePath: relativePath(ownerActionQueueJsonPath),
      id: 'OWNER_ACTION_LIST_COMMAND',
      requirement: 'List and validate the current owner action queue canonical ids, owners, current evidence, required evidence, action dossier commands, raw evidence template commands, submission template commands, verification commands, and verification command notes before any external evidence submission is accepted.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --owner-summary',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_ACTION_SUMMARY_COMMAND',
      requirement: 'Summarize owner evidence responsibility lanes, per-owner action ids, closure-kind counts, required verification commands, and verification command notes without changing strict completion status.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --next-owner-commands --owner <owner>',
      evidencePath: relativePath(completionStatusJsonPath),
      id: 'NEXT_OWNER_COMMANDS_QUERY_COMMAND',
      requirement: 'Query the generated next-owner command index for an owner lane, including readiness, readiness evidence-dir, summary, blocker taxonomy, partial R8 dossier, closure bundle, require-complete, action list, and template directory commands without treating the command index as evidence.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_READINESS_QUERY_COMMAND',
      requirement: 'Summarize one owner lane across blocking action details including verification command notes, top-level machine-readable blocking action and taxonomy aggregates, action dossier commands, raw evidence template commands, submission template commands, taxonomy command arrays, next-owner commands, blocker taxonomy rows, closure bundle commands, weighted open rows, require-complete evidence intake commands, and optional evidence-dir coverage without treating readiness as completion evidence.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_READINESS_EVIDENCE_DIR_QUERY_COMMAND',
      requirement: 'Summarize one owner lane with verification command notes, top-level machine-readable blocking action and taxonomy aggregates plus action dossier commands, raw evidence template commands, submission template commands, and taxonomy command arrays while evaluating real submitted evidence-dir coverage and still treating strict completion as the authoritative final gate.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner <owner>',
      evidencePath: relativePath(completionAuditJsonPath),
      id: 'PARTIAL_R8_DOSSIER_QUERY_COMMAND',
      requirement: 'Query remaining partial R8 rows with linked owner action ids, action dossier command arrays, raw evidence template command arrays, submission template command arrays, verification command notes and arrays, owner readiness evidence-dir commands, no-partial-r8-rows owner output, and strict completion boundaries without treating the dossier as closure evidence.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner <owner> --file <prompt-file>',
      evidencePath: relativePath(completionAuditJsonPath),
      id: 'PARTIAL_R8_DOSSIER_FILE_QUERY_COMMAND',
      requirement: 'Query one remaining partial R8 PRD/spec row with linked owner action ids, action dossier command arrays, raw evidence template command arrays, submission template command arrays, verification command notes and arrays, owner readiness evidence-dir commands, and strict completion boundaries without treating the dossier or templates as closure evidence.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --source-file-dossier --action <actionId> --file <prompt-file>',
      evidencePath: relativePath(ownerActionQueueJsonPath),
      id: 'OWNER_SOURCE_FILE_DOSSIER_COMMAND',
      requirement: 'Query one owner action source prompt file with its row count, owner, action dossier command, raw evidence template command, submission template command, verification command, verification command note, required evidence, and strict completion boundary without treating the source-file dossier as closure evidence.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --blocker-taxonomy --owner <owner>',
      evidencePath: relativePath(completionAuditJsonPath),
      id: 'OWNER_BLOCKER_TAXONOMY_COMMAND',
      requirement: 'Query owner-filtered blocker taxonomy rows, category counts, weighted open rows, sources, action dossier commands and arrays, raw evidence template commands and arrays, submission template commands and arrays, verification command notes and arrays, and strict commands as diagnostic execution aids without treating taxonomy as completion evidence.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --owner-output-matrix',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_OUTPUT_MATRIX_COMMAND',
      requirement: 'Verify all current owner-facing JSON query surfaces expose source-file dossier, action dossier, raw evidence template, submission template, recommended strict commands, owner action verification command notes with per-owner coverage floors, and blocker taxonomy row verification notes across every owner lane without treating discoverability as completion evidence.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --owner-closure-bundles --owner <owner>',
      evidencePath: relativePath(ownerClosureBundlesJsonPath),
      id: 'OWNER_CLOSURE_BUNDLE_QUERY_COMMAND',
      requirement: 'Query owner-scoped closure bundles that link current blockers, blocker taxonomy rows, guard backlinks, source-file dossier commands, action dossier commands and arrays, raw evidence template commands and arrays, submission template commands and arrays, verification command notes, and strict completion commands without treating the bundle as evidence.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir>',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_EVIDENCE_BATCH_VERIFIER_COMMAND',
      requirement: 'Validate a directory of owner evidence submission JSON files, reject duplicate actionIds, report submitted and missing actionIds by owner, and keep strict completion as the authoritative final gate.',
      status: 'verified'
    },
    {
      command: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --require-complete',
      evidencePath: relativePath(ownerEvidenceVerifierPath),
      id: 'OWNER_EVIDENCE_COMPLETE_BATCH_VERIFIER_COMMAND',
      requirement: 'Require a directory of owner evidence submission JSON files to cover every current owner action before final strict completion is attempted.',
      status: 'verified'
    }
  ]

  const rawMissingOrIncompleteRequirements = [
    ...pack.partialR8Rows.map(row => {
      const ownerActionIds = relatedOwnerActionIdsForPartialR8File(row.file).filter(actionId => actionsById.has(actionId))
      return {
        evidence: row.nextAction ?? '',
        id: row.file,
        owner: ownerForLinkedOwnerActions(ownerActionIds, actionsById),
        ownerActionIds,
        requirementType: 'partial-r8-row',
        source: '0503-ledger-verification.json'
      }
    }),
    ...pack.failedExternalGates.map(gate => ({
      evidence: gate.evidence,
      id: gate.id,
      owner: gate.runbook.owner ?? 'unassigned',
      requirementType: 'failed-external-gate',
      source: 'r8-external-blockers-current.json'
    })),
    ...pack.surveyAcceptanceRows.map(row => ({
      evidence: row.status,
      id: row.file,
      owner: row.file.includes('legal') ? 'legal-product' : 'product-or-user',
      requirementType: 'survey-acceptance-row',
      source: '0503-survey-acceptance-ledger.md'
    })),
    ...checkboxClosureActions.map(action => ({
      evidence: action.currentEvidence,
      id: action.closureKind,
      owner: action.owner,
      requirementType: 'open-checkbox-closure-class',
      source: '0503-checkbox-manifest.json'
    }))
  ]
  const ownerActionIdsForRequirement = requirement => {
    if (requirement.requirementType === 'failed-external-gate' || requirement.requirementType === 'open-checkbox-closure-class') {
      return [requirement.id]
    }
    if (requirement.requirementType === 'survey-acceptance-row') {
      return [ownerActionIdForSurveyFile(requirement.id)]
    }
    if (requirement.requirementType === 'partial-r8-row' && Array.isArray(requirement.ownerActionIds)) {
      return requirement.ownerActionIds
    }
    return []
  }
  const ownerActionCommand = (actionId, field, commandFlag) => {
    const action = actionsById.get(actionId)
    return action?.[field] ?? `pnpm --silent check:0503-owner-evidence -- --${commandFlag} --action ${actionId}`
  }
  const withOwnerIntakeCommands = requirement => {
    const ownerActionIds = ownerActionIdsForRequirement(requirement).filter(actionId => actionsById.has(actionId))
    const ownerActions = ownerActionIds.map(actionId => actionsById.get(actionId)).filter(action => action !== undefined)
    const ownerActionId = ownerActions.length === 1 ? ownerActions[0].actionId : null
    const verificationCommands = ownerActions.length > 0
      ? [...new Set(ownerActions.map(action => action.verificationCommand ?? 'pnpm check:0503-strict'))]
      : ['pnpm check:0503-strict']
    return withRecommendedStrictCompletionCommand({
      ...requirement,
      actionDossierCommand: ownerActionId === null ? null : ownerActionCommand(ownerActionId, 'actionDossierCommand', 'action-dossier'),
      actionDossierCommands: ownerActionIds.map(actionId => ownerActionCommand(actionId, 'actionDossierCommand', 'action-dossier')),
      ownerActionId,
      ownerActionIds,
      ownerActionOwner: ownerActions.length === 1 ? ownerActions[0].owner ?? null : null,
      ownerActionOwners: ownerActionOwnersForIds(ownerActionIds, actionsById),
      rawEvidenceTemplateCommand: ownerActionId === null ? null : ownerActionCommand(ownerActionId, 'rawEvidenceTemplateCommand', 'print-evidence-template'),
      rawEvidenceTemplateCommands: ownerActionIds.map(actionId => ownerActionCommand(actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template')),
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommand: ownerActionId === null ? null : ownerActionCommand(ownerActionId, 'submissionTemplateCommand', 'print-template'),
      submissionTemplateCommands: ownerActionIds.map(actionId => ownerActionCommand(actionId, 'submissionTemplateCommand', 'print-template')),
      verificationCommand: verificationCommands.join('; '),
      verificationCommands
    })
  }
  const missingOrIncompleteRequirements = rawMissingOrIncompleteRequirements.map(withOwnerIntakeCommands)
  const strictBlockerCrosswalk = missingOrIncompleteRequirements.map(requirement => {
    const ownerActionIds = Array.isArray(requirement.ownerActionIds) ? requirement.ownerActionIds : []
    const ownerActions = ownerActionIds.map(actionId => actionsById.get(actionId)).filter(action => action !== undefined)
    const ownerActionId = requirement.ownerActionId ?? (ownerActions.length === 1 ? ownerActions[0].actionId : null)
    const verificationCommands = Array.isArray(requirement.verificationCommands) && requirement.verificationCommands.length > 0
      ? requirement.verificationCommands
      : ['pnpm check:0503-strict']
    return withRecommendedStrictCompletionCommand({
      actionDossierCommand: requirement.actionDossierCommand ?? null,
      actionDossierCommands: requirement.actionDossierCommands ?? [],
      currentEvidence: requirement.evidence,
      id: requirement.id,
      owner: requirement.owner,
      ownerActionId,
      ownerActionIds,
      ownerActionOwners: ownerActionOwnersForIds(ownerActionIds, actionsById),
      ownerActionOwner: ownerActions.length === 1 ? ownerActions[0].owner ?? null : null,
      rawEvidenceTemplateCommand: requirement.rawEvidenceTemplateCommand ?? null,
      rawEvidenceTemplateCommands: requirement.rawEvidenceTemplateCommands ?? [],
      requirementType: requirement.requirementType,
      source: requirement.source,
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommand: requirement.submissionTemplateCommand ?? null,
      submissionTemplateCommands: requirement.submissionTemplateCommands ?? [],
      verificationCommand: verificationCommands.join('; '),
      verificationCommands
    })
  })
  const blockerTaxonomy = buildBlockerTaxonomy(missingOrIncompleteRequirements, strictBlockerCrosswalk, ownerActionQueue)

  return {
    acceptanceStatus: pack.acceptanceStatus,
    blockerTaxonomy,
    commandChecklist,
    completionGuardEvidence,
    completionGuardOwnerCrosswalk,
    completionStatusPath: relativePath(completionStatusJsonPath),
    currentEnvironment: pack.currentEnvironment,
    generatedAt: new Date().toISOString(),
    missingOrIncompleteRequirements,
    objective: 'Complete prompts/0503-2 R8 development objectives with real implementation evidence, no mock data, and strict completion gates.',
    ownerActionGuardBacklinks,
    partialR8Dossier,
    promptToArtifactChecklist,
    sourceEvidence: [
      relativePath(acceptancePackJsonPath),
      relativePath(checkboxManifestJsonPath),
      relativePath(ownerActionQueueJsonPath),
      relativePath(completionStatusJsonPath),
      relativePath(ledgerVerificationPath),
      relativePath(externalBlockerReportPath),
      relativePath(devhubManualTestingChecklistPath),
      relativePath(devhubPackageJsonPath),
      relativePath(devhubElectronViteConfigPath),
      relativePath(rootPackageJsonPath),
      relativePath(rootPnpmLockPath)
    ],
    schemaVersion: completionAuditSchemaVersion,
    status: completionStatus.complete === true ? 'complete' : 'not-complete',
    strictBlockerCrosswalk,
    successCriteria
  }
}

function renderCompletionStatusMarkdown(status) {
  return [
    '# 0503 Completion Status',
    '',
    `Generated at: ${status.generatedAt}`,
    `Schema version: ${status.schemaVersion}`,
    `Complete: ${status.complete}`,
    `Acceptance status: ${status.acceptanceStatus}`,
    '',
    '## Artifacts',
    renderRows(
      Object.entries(status.artifacts ?? {}).map(([artifact, path]) => ({ artifact, path })),
      'No artifacts.',
      ['Artifact', 'Path'],
      row => [row.artifact, row.path]
    ),
    '',
    '## Continuation Commands',
    '',
    `- Local gate: \`${status.continuationCommands?.localGate ?? ''}\``,
    `- Acceptance pack: \`${status.continuationCommands?.acceptancePack ?? ''}\``,
    `- Strict gate: \`${status.continuationCommands?.strictGate ?? ''}\``,
    `- Recommended strict gate: \`${status.continuationCommands?.recommendedStrictGate ?? status.recommendedStrictCompletionCommand ?? ''}\``,
    `- Owner summary: \`${status.continuationCommands?.ownerSummary ?? ''}\``,
    `- Next owner commands: \`${status.continuationCommands?.nextOwnerCommands ?? ''}\``,
    `- Owner readiness: \`${status.continuationCommands?.ownerReadiness ?? ''}\``,
    `- Owner readiness with evidence dir: \`${status.continuationCommands?.ownerReadinessWithEvidenceDir ?? ''}\``,
    `- Owner source file dossier: \`${status.continuationCommands?.ownerSourceFileDossier ?? ''}\``,
    `- Owner blocker taxonomy: \`${status.continuationCommands?.ownerBlockerTaxonomy ?? ''}\``,
    `- Owner closure bundle query: \`${status.continuationCommands?.ownerClosureBundleQuery ?? ''}\``,
    `- Owner closure bundles: \`${status.continuationCommands?.ownerClosureBundles ?? ''}\``,
    '',
    '## Completion Guard',
    renderRows(
      Object.entries(status.completionGuard ?? {}).map(([guard, passed]) => ({ guard, passed })),
      'No completion guard.',
      ['Guard', 'Passed'],
      row => [row.guard, row.passed]
    ),
    '',
    '## Completion Guard Evidence',
    renderRows(
      status.completionGuardEvidence ?? [],
      'No completion guard evidence.',
      ['Guard', 'Passed', 'Evidence', 'Verification command', 'Blockers'],
      row => [row.guard, row.passed, row.evidence, row.verificationCommand, truncate((row.blockers ?? []).join('; '))]
	    ),
	    '',
	    '## Blocked Success Criteria Owner Links',
	    renderRows(
	      status.blockedSuccessCriteriaOwnerLinks ?? [],
	      'No blocked success criteria.',
	      ['ID', 'Actual', 'Expected', 'Status', 'Owners', 'Owner actions', 'Owner readiness evidence-dir commands', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Evidence'],
	      row => [
	        row.id,
	        row.actual,
	        row.expected,
	        row.status,
	        truncate((row.ownerActionOwners ?? []).join('; ')),
	        truncate((row.ownerActionIds ?? []).join('; ')),
	        truncate((row.ownerReadinessWithEvidenceDirCommands ?? []).join('; ')),
	        truncate((row.actionDossierCommands ?? []).join('; ')),
	        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
	        truncate((row.submissionTemplateCommands ?? []).join('; ')),
	        row.evidencePath
	      ]
	    ),
    '',
    '## Failed External Gate Command Sets',
    renderRows(
      status.failedExternalGateCommandSets ?? [],
      'No failed external gates.',
      ['Gate', 'Owner', 'Kind', 'Current evidence', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Evidence'],
      row => [
        row.gateId,
        row.owner,
        row.blockerKind,
        truncate(row.currentEvidence),
        row.verificationCommand,
        truncate(row.verificationCommandNote),
        row.actionDossierCommand,
        row.rawEvidenceTemplateCommand,
        row.submissionTemplateCommand,
        row.sourceEvidencePath
      ]
    ),
    '',
    '## Counts',
    '',
    `- Prompt artifact rows: ${status.promptArtifactRows}`,
    `- Prompt checkbox rows: ${status.promptCheckboxRows}`,
    `- Open prompt checkbox rows: ${status.promptCheckboxOpenRows}`,
    `- Local-closure possible open rows: ${status.promptCheckboxLocalClosurePossibleOpenRows}`,
    `- Local-closure blocked open rows: ${status.promptCheckboxLocalClosureBlockedOpenRows}`,
    `- Missing or incomplete requirements: ${status.missingOrIncompleteRequirementCount}`,
    `- Partial R8 rows: ${status.partialR8RowCount}`,
    `- Failed external gates: ${status.failedExternalGateCount}`,
    `- Survey acceptance rows: ${status.surveyAcceptanceRowCount}`,
    `- Strict blocker crosswalk rows: ${status.strictBlockerCrosswalkRowCount}`,
    `- Owner actions: ${status.ownerActionCount}`,
    '',
    '## Current Environment',
    renderRows(
      Object.entries(status.currentEnvironment ?? {}).map(([key, value]) => ({ key, value })),
      'No current environment snapshot.',
      ['Signal', 'Value'],
      row => [row.key, row.value]
    ),
    '',
    '## Required Owners',
    renderRows(
      Object.entries(status.nextRequiredOwners ?? {}).map(([owner, count]) => ({ owner, count })),
      'No required owners.',
      ['Owner', 'Actions'],
      row => [row.owner, row.count]
    ),
    '',
    '## Next Owner Commands',
    renderRows(
      status.nextOwnerCommands ?? [],
      'No owner commands.',
      ['Owner', 'Actions', 'Readiness', 'Readiness + evidence dir', 'Readiness + coverage artifacts', 'Summary', 'List actions', 'Blocker taxonomy', 'Partial R8 dossier', 'Closure bundle', 'Require complete', 'Submission templates', 'Raw evidence templates', 'Coverage report', 'Coverage JSON', 'Evidence'],
      row => [
        row.owner,
        row.actionCount,
        row.ownerReadinessCommand,
        row.ownerReadinessWithEvidenceDirCommand,
        row.ownerReadinessWithCoverageArtifactsCommand,
        row.ownerSummaryCommand,
        row.listActionsCommand,
        row.blockerTaxonomyCommand,
        row.partialR8DossierCommand,
        row.closureBundleCommand,
        row.requireCompleteCommand,
        row.submissionTemplateDirectoryCommand,
        row.rawEvidenceTemplateDirectoryCommand,
        row.coverageReportCommand,
        row.coverageJsonCommand,
        row.sourceEvidencePath
      ]
    ),
    '',
    '## Non-Completion Reasons',
    '',
    ...status.nonCompletionReasons.map(reason => `- ${reason}`),
    '',
    '## Checkbox Scope Counts',
    renderRows(
      Object.entries(status.promptCheckboxScopeCounts ?? {}).map(([scope, counts]) => ({ scope, ...counts })),
      'No checkbox scope counts.',
      ['Scope', 'Files', 'Total', 'Open', 'Checked'],
      row => [row.scope, row.files, row.total, row.open, row.checked]
    ),
    ''
  ].join('\n')
}

function renderCompletionAuditMarkdown(audit) {
  return [
    '# 0503 Completion Audit',
    '',
    `Generated at: ${audit.generatedAt}`,
    `Schema version: ${audit.schemaVersion}`,
    `Status: ${audit.status}`,
    `Acceptance status: ${audit.acceptanceStatus}`,
    '',
    '## Objective',
    '',
    audit.objective,
    '',
    '## Source Evidence',
    renderRows(
      audit.sourceEvidence ?? [],
      'No source evidence.',
      ['Evidence path'],
      row => [row]
    ),
    '',
    '## Prompt-to-Artifact Checklist',
    '',
    'This checklist maps each explicit prompt requirement, named file, command, test, gate, and deliverable to concrete evidence.',
    '',
    '### Requirement Coverage',
    renderRows(
      audit.successCriteria,
      'No success criteria.',
      ['ID', 'Requirement', 'Expected', 'Actual', 'Status', 'Owner actions', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Evidence'],
      row => [
        row.id,
        truncate(row.requirement),
        row.expected,
        row.actual,
        row.status,
        truncate((row.ownerActionIds ?? []).join('; ')),
        truncate((row.actionDossierCommands ?? []).join('; ')),
        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncate((row.submissionTemplateCommands ?? []).join('; ')),
        row.evidencePath
      ]
    ),
    '',
    '### Named Commands, Tests, and Gates',
    renderRows(
      audit.commandChecklist,
      'No command checklist.',
      ['ID', 'Command', 'Status', 'Evidence', 'Requirement'],
      row => [row.id, row.command, row.status, row.evidencePath, truncate(row.requirement)]
    ),
    '',
    '## Completion Guard Evidence',
    renderRows(
      audit.completionGuardEvidence ?? [],
      'No completion guard evidence.',
      ['Guard', 'Passed', 'Evidence', 'Verification command', 'Blocker count', 'Blockers', 'Source'],
      row => [row.guard, row.passed, row.evidence, row.verificationCommand, row.blockerCount, truncate((row.blockers ?? []).join('; ')), row.auditEvidencePath]
    ),
    '',
    '## Completion Guard Owner Crosswalk',
    renderRows(
      audit.completionGuardOwnerCrosswalk ?? [],
      'No completion guard owner crosswalk rows.',
      ['Guard', 'Blocker', 'Type', 'Owner actions', 'Owners', 'Verification commands', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Source'],
      row => [
        row.guard,
        row.blocker,
        row.blockerType,
        (row.ownerActionIds ?? []).join('; '),
        (row.owners ?? []).join('; '),
        truncate((row.verificationCommands ?? []).join('; ')),
        truncate((row.actionDossierCommands ?? []).join('; ')),
        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncate((row.submissionTemplateCommands ?? []).join('; ')),
        row.guardEvidencePath
      ]
    ),
    '',
    '## Owner Action Guard Backlinks',
    renderRows(
      audit.ownerActionGuardBacklinks ?? [],
      'No owner action guard backlinks.',
      ['Action id', 'Owner', 'Guards blocked', 'Blockers', 'Verification command', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands'],
      row => [
        row.actionId,
        row.owner,
        (row.guardsBlocked ?? []).join('; '),
        truncate((row.blockers ?? []).join('; ')),
        truncate(row.verificationCommand),
        truncate((row.actionDossierCommands ?? []).join('; ')),
        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncate((row.submissionTemplateCommands ?? []).join('; '))
      ]
    ),
    '',
    '## Blocker Taxonomy',
    '',
    `- Total taxonomy rows: ${audit.blockerTaxonomy?.totalTaxonomyRows ?? 0}`,
    `- Total weighted open rows: ${audit.blockerTaxonomy?.totalWeightedOpenRows ?? 0}`,
    '',
    '### Category Counts',
    renderRows(
      Object.entries(audit.blockerTaxonomy?.categoryCounts ?? {}).map(([category, count]) => ({ category, count, weightedOpenRows: audit.blockerTaxonomy?.categoryWeightedOpenRows?.[category] ?? 0 })),
      'No blocker categories.',
      ['Category', 'Taxonomy rows', 'Weighted open rows'],
      row => [row.category, row.count, row.weightedOpenRows]
    ),
    '',
    '### Owner Counts',
    renderRows(
      Object.entries(audit.blockerTaxonomy?.ownerCounts ?? {}).map(([owner, count]) => ({ owner, count, weightedOpenRows: audit.blockerTaxonomy?.ownerWeightedOpenRows?.[owner] ?? 0 })),
      'No blocker owners.',
      ['Owner', 'Taxonomy rows', 'Weighted open rows'],
      row => [row.owner, row.count, row.weightedOpenRows]
    ),
    '',
    '### Taxonomy Rows',
    renderRows(
      audit.blockerTaxonomy?.rows ?? [],
      'No blocker taxonomy rows.',
      ['Category', 'Type', 'ID', 'Owner', 'Owner actions', 'Weighted rows', 'Verification command', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Source'],
      row => [
        row.category,
        row.requirementType,
        row.id,
        row.owner,
        (row.ownerActionIds ?? []).join('; '),
        row.weightedOpenRows,
        truncate(row.verificationCommand),
        truncate((row.actionDossierCommands ?? []).join('; ')),
        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncate((row.submissionTemplateCommands ?? []).join('; ')),
        row.source
      ]
    ),
    '',
    '## Prompt-To-Artifact Checklist',
    '',
    `- Total rows: ${audit.promptToArtifactChecklist.length}`,
    `- prompts/0503 rows: ${audit.promptToArtifactChecklist.filter(row => row.scope === 'prompts/0503').length}`,
    `- prompts/0503-2 rows: ${audit.promptToArtifactChecklist.filter(row => row.scope === 'prompts/0503-2').length}`,
    '- Full row details are written to `0503-completion-audit.json` under `promptToArtifactChecklist`.',
    '',
    '## Partial R8 Dossier',
    renderRows(
      audit.partialR8Dossier ?? [],
      'No partial R8 rows.',
      ['File', 'Status', 'Owner actions', 'Verification command', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Strict command', 'Source', 'Next action'],
      row => [
        row.file,
        row.status,
        (row.ownerActionIds ?? []).join('; '),
        row.verificationCommand,
        truncate((row.ownerActionDossierCommands ?? []).join('; ')),
        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncate((row.submissionTemplateCommands ?? []).join('; ')),
        row.strictCompletionCommand,
        row.sourceEvidencePath,
        truncate(row.nextAction)
      ]
    ),
    '',
    '## Missing Or Incomplete Requirements',
    renderRows(
      audit.missingOrIncompleteRequirements,
      'No missing or incomplete requirements.',
      ['Type', 'ID', 'Owner', 'Owner actions', 'Verification command', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Strict command', 'Current evidence', 'Source'],
      row => [
        row.requirementType,
        row.id,
        row.owner,
        (row.ownerActionIds ?? []).join('; '),
        truncate(row.verificationCommand),
        truncate((row.actionDossierCommands ?? []).join('; ')),
        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncate((row.submissionTemplateCommands ?? []).join('; ')),
        row.strictCompletionCommand,
        truncate(row.evidence),
        row.source
      ]
    ),
    '',
    '## Strict Blocker Crosswalk',
    renderRows(
      audit.strictBlockerCrosswalk ?? [],
      'No strict blockers.',
      ['Type', 'ID', 'Owner actions', 'Verification command', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Strict command'],
      row => [
        row.requirementType,
        row.id,
        (row.ownerActionIds ?? []).join('; '),
        truncate(row.verificationCommand),
        truncate((row.actionDossierCommands ?? []).join('; ')),
        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncate((row.submissionTemplateCommands ?? []).join('; ')),
        row.strictCompletionCommand
      ]
    ),
    '',
    '## Boundary',
    '',
    '- This audit is generated evidence, not a waiver.',
    '- A blocked row remains blocked until the referenced real evidence exists and the strict completion command passes.',
    ''
  ].join('\n')
}

function renderOwnerClosureBundlesMarkdown(bundles) {
  const ownerSections = bundles.owners.flatMap(ownerBundle => [
    `## ${ownerBundle.owner}`,
    '',
    `- Action count: ${ownerBundle.actionCount}`,
    `- Blocking taxonomy rows: ${ownerBundle.blockingTaxonomyRowCount}`,
    `- Weighted open rows: ${ownerBundle.weightedOpenRows}`,
    `- Readiness command: \`${ownerBundle.readinessCommand}\``,
    `- Summary command: \`${ownerBundle.summaryCommand}\``,
    `- Require complete command: \`${ownerBundle.requireCompleteCommand}\``,
    '',
    renderRows(
      ownerBundle.blockingTaxonomyRows ?? [],
      'No blocking taxonomy rows.',
      ['Category', 'ID', 'Owner actions', 'Weight', 'Verification command', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Current evidence'],
      row => [
        row.category,
        row.id,
        (row.ownerActionIds ?? []).join('; '),
        row.weightedOpenRows,
        truncate(row.verificationCommand),
        truncate((row.actionDossierCommands ?? []).join('; ')),
        truncate((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncate((row.submissionTemplateCommands ?? []).join('; ')),
        truncate(row.currentEvidence)
      ]
    ),
    '',
      renderRows(
        ownerBundle.actions,
        'No owner actions.',
      ['Action id', 'Guards blocked', 'Blockers', 'Blocking taxonomy rows', 'Partial R8 files', 'Partial R8 file dossier commands', 'Source files', 'Source file dossier commands', 'Current evidence', 'Required evidence', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command'],
      action => [
        action.actionId,
        (action.guardsBlocked ?? []).join('; '),
        truncate((action.blockers ?? []).join('; ')),
        truncate((action.blockingTaxonomyRowIds ?? []).join('; ')),
        truncate((action.partialR8Files ?? []).join('; ')),
        truncate((action.partialR8DossierLinks ?? []).map(row => row.partialR8OwnerFileDossierCommand).join('; ')),
        truncate(formatSourceFileSummary(action.sourceFiles)),
        truncate((action.sourceFiles?.files ?? []).map(row => row.sourceFileDossierCommand).join('; ')),
        truncate(action.currentEvidence),
        truncate(action.requiredEvidence),
        truncate(action.verificationCommand),
        truncate(action.verificationCommandNote),
        action.actionDossierCommand,
        action.rawEvidenceTemplateCommand,
        action.submissionTemplateCommand
      ]
    ),
    ''
  ])
  return [
    '# 0503 Owner Closure Bundles',
    '',
    `Generated at: ${bundles.generatedAt}`,
    `Schema version: ${bundles.schemaVersion}`,
    `Status: ${bundles.status}`,
    `Acceptance status: ${bundles.acceptanceStatus}`,
    '',
    '## Summary',
    '',
    `- Owner count: ${bundles.ownerCount}`,
    `- Total action count: ${bundles.totalActionCount}`,
    '- These bundles are owner execution aids, not completion evidence by themselves.',
    `- Submit real evidence through the listed verifier commands, then rerun \`${shellPortableStrictCompletionCommand}\`.`,
    `- Legacy \`${strictCompletionCommand}\` fields remain compatibility references; use the shell-portable command when foreground-watch opt-in must be injected inside the Node runner.`,
    '',
    ...ownerSections
  ].join('\n')
}

function renderOwnerActionQueueMarkdown(queue) {
  const actionsByOwner = new Map()
  for (const action of queue.actions) {
    const owner = action.owner ?? 'unassigned'
    actionsByOwner.set(owner, [...(actionsByOwner.get(owner) ?? []), action])
  }
  const ownerExecutionSections = [...actionsByOwner.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([owner, actions]) => [
      `### ${owner}`,
      '',
      renderRows(
        actions,
        'No actions for this owner.',
        ['Action id', 'Closure kind', 'Current evidence', 'Submission template', 'Raw evidence template', 'Action dossier', 'Verification command', 'Verification command note'],
        action => {
          return [
            action.actionId,
            action.closureKind,
            truncate(action.currentEvidence),
            action.submissionTemplateCommand,
            action.rawEvidenceTemplateCommand,
            action.actionDossierCommand,
            truncate(action.verificationCommand),
            truncate(action.verificationCommandNote)
          ]
        }
      ),
      ''
    ])

  const checkboxClosureSourceSections = queue.actions
    .filter(action => action.actionType === 'checkbox-closure-class' && action.sourceFiles?.files?.length > 0)
    .flatMap(action => [
      `### ${action.closureKind}`,
      '',
      renderRows(
        action.sourceFiles.files,
        'No source files.',
        ['File', 'Open rows', 'Source file dossier command', 'Action dossier command', 'Raw evidence template command', 'Submission template command'],
        row => [row.file, row.count, row.sourceFileDossierCommand, row.actionDossierCommand, row.rawEvidenceTemplateCommand, row.submissionTemplateCommand]
      ),
      ''
    ])

  return [
    '# 0503 Owner Action Queue',
    '',
    `Generated at: ${queue.generatedAt}`,
    `Schema version: ${queue.schemaVersion}`,
    `Acceptance status: ${queue.acceptanceStatus}`,
    '',
    '## Owner Counts',
    renderRows(
      Object.entries(queue.ownerCounts).map(([owner, count]) => ({ owner, count })),
      'No owner actions.',
      ['Owner', 'Actions'],
      row => [row.owner, row.count]
    ),
    '',
    '## Owner Lane Commands',
    renderRows(
      queue.ownerLaneCommands ?? [],
      'No owner lane commands.',
      ['Owner', 'Readiness', 'Readiness + evidence dir', 'Readiness + coverage artifacts', 'Summary', 'List actions', 'Partial R8 dossier', 'Submission templates', 'Raw evidence templates', 'Require complete', 'Coverage report', 'Coverage JSON'],
      row => [
        row.owner,
        row.ownerReadinessCommand,
        row.ownerReadinessWithEvidenceDirCommand,
        row.ownerReadinessWithCoverageArtifactsCommand,
        row.ownerSummaryCommand,
        row.listActionsCommand,
        row.partialR8DossierCommand,
        row.submissionTemplateDirectoryCommand,
        row.rawEvidenceTemplateDirectoryCommand,
        row.requireCompleteCommand,
        row.coverageReportCommand,
        row.coverageJsonCommand
      ]
    ),
    '',
    '## Owner Execution Plan',
    '',
    ownerExecutionSections.length > 0
      ? ownerExecutionSections.join('\n')
      : 'No owner execution plan.',
    '',
    '## Current Environment Readiness',
    renderRows(
      Object.entries(queue.currentEnvironment ?? {}).map(([key, value]) => ({ key, value })),
      'No current environment readiness snapshot.',
      ['Signal', 'Value'],
      row => [row.key, row.value]
    ),
    '',
    '## Actions',
    renderRows(
      queue.actions,
      'No remaining actions.',
      ['Owner', 'Type', 'Closure kind', 'Gate', 'Current evidence', 'Source files', 'Prerequisite', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Required evidence', 'Unblock rule'],
      row => [
        row.owner,
        row.actionType,
        row.closureKind,
        row.gateId ?? '',
        truncate(row.currentEvidence),
        truncate(formatSourceFileSummary(row.sourceFiles)),
        truncate(row.prerequisite),
        truncate(row.verificationCommand),
        truncate(row.verificationCommandNote),
        row.actionDossierCommand,
        row.rawEvidenceTemplateCommand,
        row.submissionTemplateCommand,
        truncate(row.requiredEvidence),
        truncate(row.unblockRule)
      ]
    ),
    '',
    '## Checkbox Closure Source Files',
    '',
    checkboxClosureSourceSections.length > 0
      ? checkboxClosureSourceSections.join('\n')
      : 'No checkbox closure source files.',
    '',
    '## Boundary',
    '',
    '- This queue is an ownership map, not completion evidence.',
    '- Actions are complete only when their required evidence exists and the strict completion gate passes.',
    '',
    '## Evidence Intake Workflow',
    '',
    '1. Summarize owner responsibility lanes with `pnpm --silent check:0503-owner-evidence -- --owner-summary`; add `--owner <owner>` when an operator owner is preparing only their own lane.',
    '2. List current canonical action ids with `pnpm --silent check:0503-owner-evidence -- --list-actions`; filter a responsibility lane with `--owner <owner>` when detailed current evidence and command text are needed.',
    '3. Inspect owner readiness with `pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>` to see `blockingActions`, blocker taxonomy rows, closure bundle commands, weighted open rows, and require-complete intake commands in one diagnostic output; when real owner submissions already exist, run `pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>` or copy the `nextEvidenceDirectoryCommand` field from readiness output to coverage-check them without treating readiness as completion evidence.',
    '4. Query partial R8 dossier rows with `pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner <owner>` when a partial PRD/spec row needs its linked action ids, owner readiness evidence-dir commands, and strict boundary in one JSON output; add `--file <prompt-file>` to narrow this to one exact partial row and expose the action dossier, raw evidence template, and submission template commands for that row.',
    '5. Inspect owner lane commands directly with `pnpm --silent check:0503-owner-evidence -- --owner-lane-commands --owner <owner>`.',
    '6. Export a one-action dossier with `pnpm --silent check:0503-owner-evidence -- --action-dossier --action <actionId>` when an owner needs the action row, lane commands, verification command note, raw evidence template, and submission template in one JSON output.',
    '7. Generate an action-specific submission template with `pnpm --silent check:0503-owner-evidence -- --print-template --action <actionId>`, or generate all non-passable submission templates for one owner lane with `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner <owner>`; directory output is versioned scaffolding and remains `templateOnly`.',
    '8. Optionally generate non-passable raw evidence shape files with `pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner <owner>` so each owner can prepare their lane without copying templates from chat output; directory output is versioned scaffolding and remains `templateOnly`.',
    '9. Run the action row verification command in the required real environment and save its raw output, binary capture, screenshot, or decision file under a repo-relative evidence path.',
    '10. Keep the raw evidence file separate from the JSON submission file; `evidenceFilePath` must not point to the submission JSON itself.',
    '11. Ensure the raw evidence file is regenerated or recopied after this owner action queue `Generated at` timestamp so file mtime freshness can be verified.',
    '12. Calculate the binary-safe evidence digest with `pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>`; the hash output includes `devhub-0503-owner-evidence-hash-v1`, `hashAlgorithm=sha256`, evidence file path, file size, file mtime, a strict boundary, and the shell-portable strict command so the digest cannot be confused with completion evidence.',
    '13. Fill the JSON submission with the real owner identity, result summary, timestamp, evidence path, and SHA-256 digest; remove `templateOnly` before validation because the verifier rejects template files as evidence.',
    '14. Validate one submission with `pnpm check:0503-owner-evidence -- --evidence <submission.json>` or a directory with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir>`; validation output includes schema and boundary fields, checkbox closure evidence must use `devhub-0503-checkbox-closure-evidence-v1` and match the current row count/source files, and structured external blocker or zero-egress reports must show semantic pass values for the submitted action.',
    '15. Review `unknownSubmissionFields` in the verifier output; extra fields are reported for audit hygiene but are not treated as evidence contract fields.',
    '16. Optionally write a Markdown coverage summary with `--coverage-report <repo-relative-report.md>` and a machine-readable coverage JSON report with `--coverage-json <repo-relative-report.json>`; these reports include evidence file mtime, file size, and hashAlgorithm metadata for audit traceability, but remain intake checklists only and are not completion evidence.',
    '17. Before final closure, require directory coverage for every current owner action with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --require-complete`.',
    `18. Rerun \`${shellPortableStrictCompletionCommand}\`; completion can only be claimed if strict completion passes. Legacy \`${strictCompletionCommand}\` command text remains a compatibility field for submissions that explicitly control the shell environment.`,
    '19. If you only want to re-render the acceptance pack from an already audited strict report, use `--no-refresh`; otherwise the pack refreshes strict evidence in the current shell and env-sensitive gates may change with the invocation environment.',
    '',
    '## Evidence Submission Template',
    '',
    '- Schema version: `devhub-0503-owner-evidence-submission-v1` when using generated submission templates.',
    '- Owner: `<operator>` for current R8 0503-2 strict owner lanes.',
    '- Action id: exact canonical `actionId` from `--list-actions`; use the gate id when present, otherwise the closure kind.',
    '- Evidence file path: `<repo-relative path to real evidence>`; must be raw evidence, not the submission JSON file.',
    '- Evidence modified at: exact `evidenceModifiedAt` from `--hash-evidence`; mismatched file mtime is rejected.',
    '- Evidence size bytes: exact `evidenceSizeBytes` from `--hash-evidence`; mismatched file size is rejected.',
    '- Evidence SHA-256: `<binary-safe sha256 digest of the evidence file>`',
    '- Hash algorithm: `sha256`; owner submissions with missing or different `hashAlgorithm` are rejected.',
    `- Verification command: exact listed command for the action; final closure should rerun \`${shellPortableStrictCompletionCommand}\`.`,
    '- Result summary: `<pass/fail plus key measured values>`',
    '- Evidence timestamp: `<ISO timestamp>` from after the current owner action queue was generated; the evidence file mtime must also be fresh.',
    '- Checkbox closure evidence schema: `devhub-0503-checkbox-closure-evidence-v1` with matching `actionId`, `closureKind`, `owner`, `rowCount`, and `sourceFiles` from this queue.',
    '- Approver or operator identity: `<real person or Windows identity>`',
    '- Boundary statement: `<what is still not claimed>`; do not claim completion, no remaining work, or unblock status because strict completion remains authoritative.',
    '- Unknown submission fields: reported as `unknownSubmissionFields` for audit hygiene, but not accepted as required evidence fields.',
    '',
    'Summarize owner responsibility lanes with `pnpm --silent check:0503-owner-evidence -- --owner-summary`, or filter one lane with `pnpm --silent check:0503-owner-evidence -- --owner-summary --owner <owner>`.',
    'Inspect owner readiness with `pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>` to see `blockingActions`; add `--evidence-dir <repo-relative-dir>` to include real submission coverage, but this remains diagnostic and does not waive strict completion.',
    'Export owner lane commands with `pnpm --silent check:0503-owner-evidence -- --owner-lane-commands`, or filter one lane with `pnpm --silent check:0503-owner-evidence -- --owner-lane-commands --owner <owner>`.',
    'Export one action dossier with `pnpm --silent check:0503-owner-evidence -- --action-dossier --action <actionId>`; each current R8 0503-2 dossier includes the verification command note on the main action row and both templates.',
    'List current canonical action ids with `pnpm --silent check:0503-owner-evidence -- --list-actions`, filter one with `--action <actionId-or-closureKind>`, or filter one responsibility lane with `--owner <owner>`.',
    'Generate a generic JSON template with `pnpm --silent check:0503-owner-evidence -- --print-template`, an action-specific template with `pnpm --silent check:0503-owner-evidence -- --print-template --action <actionId>`, or one owner lane of non-passable templates with `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner <owner>`.',
    'Generate a non-passable raw evidence shape with `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action <actionId>`.',
    'Generate non-passable raw evidence shape files with `pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner <owner>`.',
    'Calculate the binary-safe evidence file digest with `pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>`; require the `devhub-0503-owner-evidence-hash-v1` schema, `hashAlgorithm=sha256`, boundary, evidence file path, file size, and file mtime fields in the copied digest output.',
    'Validate a submitted JSON file with `pnpm check:0503-owner-evidence -- --evidence <submission.json>`.',
    'Validate multiple submitted JSON files with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir>`.',
    'Validate owner-scoped directory coverage with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner <owner> --require-complete` when one owner is submitting only their lane.',
    'Write a Markdown coverage summary with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md>`; the coverage report includes evidence mtime, file size, and hashAlgorithm metadata.',
    'Require a directory to cover every current owner action with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --require-complete`.',
    '',
    'Do not use this template as evidence by itself. It is only the required structure for future real evidence submission.',
    ''
  ].join('\n')
}

function renderAcceptancePackMarkdown(pack) {
  return [
    '# 0503 Acceptance Evidence Pack',
    '',
    `Generated at: ${pack.generatedAt}`,
    `Schema version: ${pack.schemaVersion}`,
    `Acceptance status: ${pack.acceptanceStatus}`,
    '',
    '## Summary',
    '',
    `- Strict completion checked: ${pack.summary.strictCompletionChecked}`,
    `- Strict completion passed: ${pack.summary.strictCompletionPassed}`,
    `- prompts/0503 coverage: ${pack.summary.prompt0503LedgerRows}/${pack.summary.prompt0503MarkdownFiles}`,
    `- prompts/0503-2 coverage: ${pack.summary.prompt05032LedgerRows}/${pack.summary.prompt05032MarkdownFiles}`,
    `- Partial R8 rows: ${pack.summary.partialR8RowCount}`,
    `- Missing evidence rows: ${pack.summary.missingEvidenceRowCount}`,
    `- Failed external gates: ${pack.summary.failedExternalGateCount}`,
    `- Survey acceptance rows: ${pack.summary.surveyAcceptanceRowCount}`,
    `- External report fresh: ${pack.summary.externalReportFresh}`,
    `- External gate runbook missing fields: ${pack.externalGateRunbookCoverage.missingFields.length}`,
    `- Machine-readable prompt artifact rows: ${pack.promptArtifactManifest.prompt0503Rows.length + pack.promptArtifactManifest.prompt05032Rows.length}`,
    `- Prompt checkbox rows: ${pack.promptCheckboxManifest.totalRows}`,
    `- Open prompt checkbox rows: ${pack.promptCheckboxManifest.totalOpen}`,
    `- Checked prompt checkbox rows: ${pack.promptCheckboxManifest.totalChecked}`,
    `- Local-closure possible open rows: ${pack.promptCheckboxManifest.localClosurePossibleOpenRows}`,
    `- Local-closure blocked open rows: ${pack.promptCheckboxManifest.localClosureBlockedOpenRows}`,
    '',
    '## Source Evidence',
    renderRows(
      pack.sourceEvidence,
      'No source evidence files were captured.',
      ['Path', 'Size bytes', 'Modified at', 'SHA256'],
      row => [row.path, row.sizeBytes, row.modifiedAt, row.sha256]
    ),
    '',
    '## Failed External Gate Actions',
    renderRows(
      pack.failedExternalGates,
      'No failed external gates.',
      ['Gate', 'Kind', 'Owner', 'Current evidence', 'Prerequisite', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Required evidence', 'Unblock rule'],
      row => [
        row.id,
        row.runbook.blockerKind ?? '',
        row.runbook.owner ?? '',
        truncate(row.evidence),
        truncate(row.runbook.prerequisite ?? ''),
        truncate(row.runbook.verificationCommand ?? ''),
        truncate(row.verificationCommandNote ?? ''),
        `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${row.id}`,
        `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${row.id}`,
        `pnpm --silent check:0503-owner-evidence -- --print-template --action ${row.id}`,
        truncate(row.runbook.requiredEvidence ?? ''),
        truncate(row.runbook.unblockRule ?? '')
      ]
    ),
    '',
    '## Failed Gate Owner Counts',
    renderRows(
      Object.entries(pack.failedGateOwnerCounts).map(([owner, count]) => ({ owner, count })),
      'No failed gate owners.',
      ['Owner', 'Failed gates'],
      row => [row.owner, row.count]
    ),
    '',
    '## Failed Gate Kind Counts',
    renderRows(
      Object.entries(pack.failedGateKindCounts).map(([kind, count]) => ({ kind, count })),
      'No failed gate kinds.',
      ['Kind', 'Failed gates'],
      row => [row.kind, row.count]
    ),
    '',
    '## Open R8 0503-2 Checkbox Closure Kinds',
    renderRows(
      Object.entries(pack.promptCheckboxManifest.open05032ClosureKindCounts ?? {}).map(([closureKind, count]) => ({ closureKind, count })),
      'No open R8 0503-2 checkbox closure kinds.',
      ['Closure kind', 'Open rows'],
      row => [row.closureKind, row.count]
    ),
    '',
    '## Open R8 0503-2 Checkbox Owner Counts',
    renderRows(
      Object.entries(pack.promptCheckboxManifest.open05032OwnerCounts ?? {}).map(([owner, count]) => ({ owner, count })),
      'No open R8 0503-2 checkbox owners.',
      ['Required owner', 'Open rows'],
      row => [row.owner, row.count]
    ),
    '',
    '## Prompt Artifact Manifest',
    '',
    `- Machine-readable rows for prompts/0503: ${pack.promptArtifactManifest.prompt0503Rows.length}`,
    `- Machine-readable rows for prompts/0503-2: ${pack.promptArtifactManifest.prompt05032Rows.length}`,
    '- Full per-prompt row details are embedded in `0503-acceptance-pack.json` under `promptArtifactManifest`.',
    `- Full checkbox row details are written to \`${pack.promptCheckboxManifest.jsonPath}\`.`,
    '',
    '## Partial R8 Rows',
    renderRows(
      pack.partialR8Rows,
      'No partial R8 rows.',
      ['File', 'Next action'],
      row => [row.file, truncate(row.nextAction)]
    ),
    '',
    '## Survey Acceptance Rows',
    renderRows(
      pack.surveyAcceptanceRows,
      'No survey acceptance rows.',
      ['File', 'Status'],
      row => [row.file, truncate(row.status)]
    ),
    '',
    '## Non-Completion Boundary',
    '',
    ...pack.nonCompletionBoundary.map(item => `- ${item}`),
    ''
  ].join('\n')
}

function runSelfTest() {
  assert(tableCell('a | b\nc') === 'a / b c', 'tableCell should escape pipes and collapse whitespace')
  assert(tableCell('🟡协商 [Should]') === '协商 [Should]', 'tableCell should remove emoji from markdown output')
  assert(truncate('abcdef', 5) === 'ab...', 'truncate should cap long values')
  const sourceSummary = summarizeOpenCheckboxSourceFiles({
    rows: [
      { checked: false, closureKind: 'survey-context', file: 'prompts/0503/a.md' },
      { checked: false, closureKind: 'survey-context', file: 'prompts/0503/a.md' },
      { checked: false, closureKind: 'survey-context', file: 'prompts/0503/b.md' },
      { checked: true, closureKind: 'survey-context', file: 'prompts/0503/c.md' }
    ]
  }, 'survey-context', 1)
  assert(sourceSummary.files.length === 1 && sourceSummary.files[0].file === 'prompts/0503/a.md' && sourceSummary.files[0].count === 2, 'source summary should rank open checkbox files by count')
  assert(sourceSummary.omittedFileCount === 1, 'source summary should report omitted files')
  assert(deriveAcceptanceStatus({ passed: true }) === 'complete', 'passed strict completion should be complete')
  assert(deriveAcceptanceStatus({ passed: false }) === 'not-complete', 'failed strict completion should be not-complete')
  const failed = buildFailedGateRows({ gates: [{ id: 'A', passed: false, evidence: 'no', runbook: { owner: 'operator', blockerKind: 'hardware' } }, { id: 'B', passed: true }] })
  assert(failed.length === 1 && failed[0].id === 'A', 'failed gate rows should include only failed gates')
  const renderedAcceptancePack = renderAcceptancePackMarkdown({
    acceptanceStatus: 'not-complete',
    externalGateRunbookCoverage: { missingFields: [] },
    failedExternalGates: [],
    failedGateKindCounts: {},
    failedGateOwnerCounts: {},
    generatedAt: '2026-05-21T00:00:00.000Z',
    nonCompletionBoundary: [],
    partialR8Rows: [],
    promptArtifactManifest: { prompt0503Rows: [], prompt05032Rows: [] },
    promptCheckboxManifest: {
      jsonPath: 'checkbox.json',
      localClosureBlockedOpenRows: 0,
      localClosurePossibleOpenRows: 0,
      openClosureKindCounts: {},
      openOwnerCounts: {},
      totalChecked: 0,
      totalOpen: 0,
      totalRows: 0
    },
    schemaVersion: acceptancePackSchemaVersion,
    sourceEvidence: [],
    summary: {
      externalReportFresh: true,
      failedExternalGateCount: 0,
      missingEvidenceRowCount: 0,
      partialR8RowCount: 0,
      prompt05032LedgerRows: 81,
      prompt05032MarkdownFiles: 81,
      prompt0503LedgerRows: 34,
      prompt0503MarkdownFiles: 34,
      strictCompletionChecked: true,
      strictCompletionPassed: false,
      surveyAcceptanceRowCount: 0
    },
    surveyAcceptanceRows: []
  })
  assert(renderedAcceptancePack.includes(`Schema version: ${acceptancePackSchemaVersion}`), 'acceptance pack markdown should render schema version')
  const audit = buildCompletionAudit({
    acceptanceStatus: 'not-complete',
    currentEnvironment: {},
    failedExternalGates: failed,
    partialR8Rows: [{ file: 'prompts/0503-2/R8.B/prd.md', nextAction: 'close with evidence' }],
    promptArtifactManifest: { prompt0503Rows: Array.from({ length: 34 }, (_, index) => ({ file: `prompts/0503/${index}.md` })), prompt05032Rows: Array.from({ length: 81 }, (_, index) => ({ file: `prompts/0503-2/${index}.md` })) },
    promptCheckboxManifest: { jsonPath: 'checkbox.json', totalRows: 115 },
    summary: { failedExternalGateCount: 1, partialR8RowCount: 1, strictCompletionPassed: false, surveyAcceptanceRowCount: 0 },
    surveyAcceptanceRows: []
  }, { actions: [{ actionId: 'A', actionType: 'external-gate', closureKind: 'hardware', owner: 'operator' }] }, { complete: false })
  assert(audit.promptToArtifactChecklist.length === 115, 'completion audit should include all prompt artifact rows')
  assert(audit.schemaVersion === completionAuditSchemaVersion, 'completion audit should include schema version')
  assert(audit.completionGuardEvidence.length === 0, 'completion audit should mirror empty guard evidence when status fixture has no guard evidence')
  assert(audit.partialR8Dossier.length === 1 && audit.partialR8Dossier[0].file === 'prompts/0503-2/R8.B/prd.md', 'completion audit should include a partial R8 dossier row')
  const evidencePackVerifierCommand = audit.commandChecklist.find(row => row.id === 'EVIDENCE_PACK_VERIFIER_COMMAND')
  assertEvidencePackVerifierRequirementText(evidencePackVerifierCommand?.requirement)
  let staleEvidencePackVerifierRequirementRejected = false
  try {
    assertEvidencePackVerifierRequirementText(evidencePackVerifierRequirement.replace('HANDOFF current summary, ', ''))
  } catch (error) {
    staleEvidencePackVerifierRequirementRejected = String(error.message).includes('completion audit evidence pack verifier requirement mismatch')
  }
  assert(staleEvidencePackVerifierRequirementRejected, 'acceptance pack self-test should reject stale evidence-pack verifier requirement text')
  assert(audit.partialR8Dossier[0].sourceEvidencePath.endsWith('#/strictCompletion/partialRowDetails/0'), 'partial R8 dossier should point to ledger partial row details')
  assert(audit.missingOrIncompleteRequirements.length === 2, 'completion audit should include partial and failed gate requirements')
  assert(audit.strictBlockerCrosswalk.length === audit.missingOrIncompleteRequirements.length, 'completion audit should crosswalk every missing requirement')
  assert(audit.blockerTaxonomy.totalTaxonomyRows === audit.missingOrIncompleteRequirements.length, 'completion audit blocker taxonomy should cover every missing requirement')
  assert(audit.blockerTaxonomy.categoryCounts.hardware === 1, 'completion audit blocker taxonomy should classify failed hardware gates')
  assert(audit.blockerTaxonomy.categoryCounts['partial-r8-implementation'] === 1, 'completion audit blocker taxonomy should classify partial R8 rows')
  const renderedAudit = renderCompletionAuditMarkdown(audit)
  assert(renderedAudit.includes('## Prompt-to-Artifact Checklist'), 'completion audit markdown should render prompt-to-artifact checklist')
  assert(renderedAudit.includes(`Schema version: ${completionAuditSchemaVersion}`), 'completion audit markdown should render schema version')
  assert(renderedAudit.includes('## Blocker Taxonomy'), 'completion audit markdown should render blocker taxonomy')
  const completeStatus = buildCompletionStatus({
    acceptanceStatus: 'complete',
    currentEnvironment: {},
    failedExternalGates: [],
    partialR8Rows: [],
    promptArtifactManifest: { prompt0503Rows: Array.from({ length: 34 }, (_, index) => ({ file: `prompts/0503/${index}.md` })), prompt05032Rows: Array.from({ length: 81 }, (_, index) => ({ file: `prompts/0503-2/${index}.md` })) },
    promptCheckboxManifest: { jsonPath: 'checkbox.json', localClosureBlockedOpenRows: 0, localClosurePossibleOpenRows: 0, scopeCounts: {}, totalOpen: 0, totalRows: 0 },
    summary: { failedExternalGateCount: 0, partialR8RowCount: 0, strictCompletionPassed: true, surveyAcceptanceRowCount: 0 },
    surveyAcceptanceRows: []
  }, { actions: [], ownerCounts: {} })
  assert(completeStatus.complete === true, 'completion status should pass only when every guard passes')
  assert(completeStatus.schemaVersion === completionStatusSchemaVersion, 'completion status should include schema version')
  assert(completeStatus.completionGuardEvidence.every(row => row.blockerCount === 0), 'complete status should have no guard blockers')
  assert(Array.isArray(completeStatus.nextOwnerCommands) && completeStatus.nextOwnerCommands.length === 0, 'complete status should expose an empty owner command list')
  const guardAudit = buildCompletionAudit({
    acceptanceStatus: 'complete',
    currentEnvironment: {},
    failedExternalGates: [],
    partialR8Rows: [],
    promptArtifactManifest: { prompt0503Rows: Array.from({ length: 34 }, (_, index) => ({ file: `prompts/0503/${index}.md` })), prompt05032Rows: Array.from({ length: 81 }, (_, index) => ({ file: `prompts/0503-2/${index}.md` })) },
    promptCheckboxManifest: { jsonPath: 'checkbox.json', localClosureBlockedOpenRows: 0, localClosurePossibleOpenRows: 0, openClosureKindCounts: {}, scopeCounts: {}, totalOpen: 0, totalRows: 0 },
    summary: { failedExternalGateCount: 0, partialR8RowCount: 0, strictCompletionPassed: true, surveyAcceptanceRowCount: 0 },
    surveyAcceptanceRows: []
  }, { actions: [], ownerCounts: {} }, completeStatus)
  assert(guardAudit.completionGuardEvidence.length === completeStatus.completionGuardEvidence.length, 'completion audit should mirror completion guard evidence rows')
  assert(guardAudit.completionGuardEvidence.every((row, index) => row.auditEvidencePath === `${relativePath(completionStatusJsonPath)}#/completionGuardEvidence/${index}`), 'completion audit guard evidence should point back to completion status rows')
  const guardOwnerCrosswalk = buildCompletionGuardOwnerCrosswalk([
    { auditEvidencePath: 'status.json#/completionGuardEvidence/1', blockers: ['ACTION_ONE'], guard: 'failedExternalGatesClosed', passed: false, verificationCommand: 'fallback-command' }
  ], [], {
    actions: [{ actionId: 'ACTION_ONE', owner: 'operator', verificationCommand: 'verify-action-one' }]
  })
  assert(guardOwnerCrosswalk.length === 1 && guardOwnerCrosswalk[0].ownerActionIds[0] === 'ACTION_ONE', 'completion guard owner crosswalk should link action blockers')
  assert(guardOwnerCrosswalk[0].verificationCommands[0] === 'verify-action-one', 'completion guard owner crosswalk should prefer owner action verification command')
  const ownerBacklinks = buildOwnerActionGuardBacklinks(guardOwnerCrosswalk, {
    actions: [{ actionId: 'ACTION_ONE', owner: 'operator', verificationCommand: 'verify-action-one' }]
  })
  assert(ownerBacklinks.length === 1 && ownerBacklinks[0].guardsBlocked[0] === 'failedExternalGatesClosed', 'owner action guard backlinks should preserve blocked guards')
  assert(ownerBacklinks[0].actionDossierCommand.includes('ACTION_ONE'), 'owner action guard backlinks should include action dossier command')
  const ownerClosureBundles = buildOwnerClosureBundles({
    actions: [{
      actionId: 'ACTION_ONE',
      closureKind: 'hardware',
      currentEvidence: 'not ready',
      owner: 'operator',
      prerequisite: 'real machine',
      actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
      rawEvidenceTemplateCommand: 'raw-template',
      requiredEvidence: 'real evidence',
      sourceFiles: withSourceFileCommands({
        files: [{ count: 3, file: 'prompts/0503/example-survey.md' }],
        omittedFileCount: 0,
        totalFileCount: 1
      }, 'ACTION_ONE'),
      submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
      unblockRule: 'no template',
      verificationCommand: 'verify-action-one'
    }]
  }, {
    acceptanceStatus: 'not-complete',
    blockerTaxonomy: {
      rows: [
        {
          category: 'hardware',
          currentEvidence: 'not ready',
          id: 'ACTION_ONE',
          ownerActionId: 'ACTION_ONE',
          ownerActionIds: ['ACTION_ONE'],
          requirementType: 'failed-external-gate',
          source: 'external.json',
          strictCompletionCommand: 'pnpm check:0503-strict',
          verificationCommand: 'verify-action-one',
          weightedOpenRows: 1
        },
        {
          category: 'partial-r8-implementation',
          currentEvidence: 'partial',
          id: 'prompts/0503-2/R8.B/prd.md',
          ownerActionId: 'ACTION_ONE',
          ownerActionIds: ['ACTION_ONE'],
          requirementType: 'partial-r8-row',
          source: 'ledger.json',
          strictCompletionCommand: 'pnpm check:0503-strict',
          verificationCommand: 'verify-action-one',
          weightedOpenRows: 1
        }
      ]
    },
    ownerActionGuardBacklinks: ownerBacklinks,
    partialR8Dossier: [
      {
        file: 'prompts/0503-2/R8.B/prd.md',
        ownerActionIds: ['ACTION_ONE'],
        sourceEvidencePath: 'ledger.json#/strictCompletion/partialRowDetails/0',
        status: 'partial'
      }
    ],
    status: 'not-complete'
  })
  assert(ownerClosureBundles.schemaVersion === ownerClosureBundleSchemaVersion, 'owner closure bundle should include schema version')
  assert(ownerClosureBundles.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'owner closure bundle should expose top-level recommended strict command')
  assert(ownerClosureBundles.totalActionCount === 1 && ownerClosureBundles.owners[0].actions[0].guardsBlocked[0] === 'failedExternalGatesClosed', 'owner closure bundle should group action backlinks by owner')
  assert(ownerClosureBundles.owners[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'owner closure bundle should expose owner-level recommended strict command')
  assert(ownerClosureBundles.owners[0].actions[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'owner closure bundle should expose action-level recommended strict command')
  assert(ownerClosureBundles.owners[0].readinessCommand.includes('--owner-readiness --owner operator'), 'owner closure bundle should expose owner readiness command')
  assert(ownerClosureBundles.owners[0].blockingTaxonomyRowCount === 2, 'owner closure bundle should expose owner-level blocking taxonomy rows')
  assert(ownerClosureBundles.owners[0].weightedOpenRows === 2, 'owner closure bundle should expose owner-level weighted open rows')
  assert(ownerClosureBundles.owners[0].actions[0].blockingTaxonomyRowIds.includes('ACTION_ONE'), 'owner closure bundle should expose action-level blocking taxonomy row ids')
  assert(ownerClosureBundles.owners[0].actions[0].partialR8Files[0] === 'prompts/0503-2/R8.B/prd.md', 'owner closure bundle should include linked partial R8 files')
  assert(ownerClosureBundles.owners[0].actions[0].partialR8DossierLinks[0].partialR8OwnerFileDossierCommand.includes('--partial-r8-dossier --owner operator --file prompts/0503-2/R8.B/prd.md'), 'owner closure bundle should expose owner-scoped partial R8 file dossier commands')
  assert(ownerClosureBundles.owners[0].actions[0].sourceFiles.files[0].sourceFileDossierCommand.includes('--source-file-dossier --action ACTION_ONE --file prompts/0503/example-survey.md'), 'owner closure bundle should expose source-file dossier commands for checkbox source rows')
  const incompleteStatus = buildCompletionStatus({
    acceptanceStatus: 'complete',
    currentEnvironment: {},
    failedExternalGates: [],
    partialR8Rows: [{ file: 'prompts/0503-2/R8.B/prd.md' }],
    promptArtifactManifest: { prompt0503Rows: [], prompt05032Rows: [] },
    promptCheckboxManifest: { jsonPath: 'checkbox.json', localClosureBlockedOpenRows: 0, localClosurePossibleOpenRows: 0, scopeCounts: {}, totalOpen: 0, totalRows: 0 },
    summary: { failedExternalGateCount: 0, partialR8RowCount: 1, strictCompletionPassed: false, surveyAcceptanceRowCount: 0 },
    surveyAcceptanceRows: []
  }, { actions: [], ownerCounts: {} })
  assert(incompleteStatus.complete === false && incompleteStatus.completionGuard.acceptanceStatusComplete === true && incompleteStatus.completionGuard.partialR8RowsClosed === false, 'completion status must not trust acceptanceStatus alone')
  assert(incompleteStatus.completionGuardEvidence.some(row => row.guard === 'partialR8RowsClosed' && row.blockerCount === 1), 'incomplete status should map false guard to blockers')
  const ownerCommandStatus = buildCompletionStatus({
    acceptanceStatus: 'not-complete',
    currentEnvironment: {},
    failedExternalGates: [],
    partialR8Rows: [],
    promptArtifactManifest: { prompt0503Rows: [], prompt05032Rows: [] },
    promptCheckboxManifest: { jsonPath: 'checkbox.json', localClosureBlockedOpenRows: 0, localClosurePossibleOpenRows: 0, scopeCounts: {}, totalOpen: 0, totalRows: 0 },
    summary: { failedExternalGateCount: 0, partialR8RowCount: 0, strictCompletionPassed: false, surveyAcceptanceRowCount: 0 },
    surveyAcceptanceRows: []
  }, {
    actions: [{ actionId: 'ACTION_ONE', owner: 'operator' }],
    ownerCounts: { operator: 1 },
    ownerLaneCommands: [{
      coverageJsonCommand: 'coverage-json operator',
      coverageReportCommand: 'coverage-report operator',
      listActionsCommand: 'list-actions operator',
      owner: 'operator',
      ownerReadinessWithCoverageArtifactsCommand: 'readiness-coverage-artifacts operator',
      ownerReadinessWithEvidenceDirCommand: 'readiness-evidence-dir operator',
      ownerReadinessCommand: 'readiness operator',
      ownerSummaryCommand: 'summary operator',
      rawEvidenceTemplateDirectoryCommand: 'raw-evidence-templates operator',
      requireCompleteCommand: 'require-complete operator',
      submissionTemplateDirectoryCommand: 'templates operator'
    }]
  })
  assert(ownerCommandStatus.nextOwnerCommands[0].coverageJsonCommand === 'coverage-json operator', 'completion status should expose owner coverage JSON command')
  assert(ownerCommandStatus.nextOwnerCommands[0].coverageReportCommand === 'coverage-report operator', 'completion status should expose owner coverage report command')
  assert(ownerCommandStatus.nextOwnerCommands[0].listActionsCommand === 'list-actions operator', 'completion status should expose owner list actions command')
  assert(ownerCommandStatus.nextOwnerCommands[0].sourceEvidencePath === `${relativePath(ownerActionQueueJsonPath)}#/ownerLaneCommands/0`, 'completion status should expose owner lane source evidence path')
  assert(ownerCommandStatus.nextOwnerCommands[0].blockerTaxonomyCommand.includes('--blocker-taxonomy --owner operator'), 'completion status should expose owner blocker taxonomy command')
  assert(ownerCommandStatus.nextOwnerCommands[0].partialR8DossierCommand.includes('--partial-r8-dossier --owner operator'), 'completion status should expose owner partial R8 dossier command')
  assert(ownerCommandStatus.nextOwnerCommands[0].rawEvidenceTemplateDirectoryCommand === 'raw-evidence-templates operator', 'completion status should expose owner raw evidence template dir command')
  assert(ownerCommandStatus.nextOwnerCommands[0].ownerReadinessWithCoverageArtifactsCommand === 'readiness-coverage-artifacts operator', 'completion status should expose owner readiness coverage artifacts command')
  assert(ownerCommandStatus.nextOwnerCommands[0].ownerReadinessCommand === 'readiness operator', 'completion status should expose owner readiness command')
  assert(ownerCommandStatus.nextOwnerCommands[0].ownerReadinessWithEvidenceDirCommand === 'readiness-evidence-dir operator', 'completion status should expose owner readiness evidence-dir command')
  assert(renderCompletionStatusMarkdown(ownerCommandStatus).includes(`Schema version: ${completionStatusSchemaVersion}`), 'completion status markdown should render schema version')
  assert(renderCompletionStatusMarkdown(ownerCommandStatus).includes('Partial R8 dossier'), 'completion status markdown should render partial R8 dossier column')
  assert(renderCompletionStatusMarkdown(ownerCommandStatus).includes('--partial-r8-dossier --owner operator'), 'completion status markdown should render owner partial R8 dossier command')
  assert(renderCompletionStatusMarkdown(ownerCommandStatus).includes('Readiness + coverage artifacts'), 'completion status markdown should render owner readiness coverage column')
  assert(renderCompletionStatusMarkdown(ownerCommandStatus).includes('Raw evidence templates'), 'completion status markdown should render owner raw template column')
  assert(renderCompletionStatusMarkdown(ownerCommandStatus).includes('coverage-json operator'), 'completion status markdown should render owner coverage JSON command')
  assert(renderCompletionStatusMarkdown(ownerCommandStatus).includes('## Next Owner Commands'), 'completion status markdown should render owner command section')
  console.log('0503 acceptance pack self-test passed.')
}

if (selfTest) {
  runSelfTest()
  process.exit(0)
}

if (!noRefresh) {
  refreshCheckboxManifest()
  refreshStrictEvidence()
}
const pack = buildAcceptancePack()
const ownerActionQueue = buildOwnerActionQueue(pack)
const completionStatus = buildCompletionStatus(pack, ownerActionQueue)
const completionAudit = buildCompletionAudit(pack, ownerActionQueue, completionStatus)
const ownerClosureBundles = buildOwnerClosureBundles(ownerActionQueue, completionAudit)
mkdirSync(researchDir, { recursive: true })
writeFileSync(acceptancePackJsonPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
writeFileSync(acceptancePackMarkdownPath, renderAcceptancePackMarkdown(pack), 'utf8')
writeFileSync(completionStatusJsonPath, `${JSON.stringify(completionStatus, null, 2)}\n`, 'utf8')
writeFileSync(completionStatusMarkdownPath, `${renderCompletionStatusMarkdown(completionStatus).trimEnd()}\n`, 'utf8')
writeFileSync(completionAuditJsonPath, `${JSON.stringify(completionAudit, null, 2)}\n`, 'utf8')
writeFileSync(completionAuditMarkdownPath, renderCompletionAuditMarkdown(completionAudit), 'utf8')
writeFileSync(ownerActionQueueJsonPath, `${JSON.stringify(ownerActionQueue, null, 2)}\n`, 'utf8')
writeFileSync(ownerActionQueueMarkdownPath, renderOwnerActionQueueMarkdown(ownerActionQueue), 'utf8')
writeFileSync(ownerClosureBundlesJsonPath, `${JSON.stringify(ownerClosureBundles, null, 2)}\n`, 'utf8')
writeFileSync(ownerClosureBundlesMarkdownPath, renderOwnerClosureBundlesMarkdown(ownerClosureBundles), 'utf8')
refreshCurrentOwnerTemplateDirectories()
console.log(`0503 acceptance pack generated: ${relativePath(acceptancePackMarkdownPath)}; status=${pack.acceptanceStatus}; missingOrIncompleteRequirements=${completionStatus.missingOrIncompleteRequirementCount}; failedExternalGates=${pack.summary.failedExternalGateCount}`)
