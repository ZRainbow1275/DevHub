import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const taskDir = dirname(scriptDir)
const repoRoot = join(taskDir, '..', '..', '..')
const devhubRoot = join(repoRoot, 'devhub')
const ledgerScript = join(scriptDir, 'verify-0503-ledgers.mjs')
const acceptancePackScript = join(scriptDir, 'generate-0503-acceptance-pack.mjs')
const evidencePackVerifierScript = join(scriptDir, 'verify-0503-evidence-pack.mjs')
const externalBlockerScript = join(devhubRoot, 'scripts', 'verify-r8-external-blockers.mjs')
const blockerReportPath = '../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json'
const ledgerReportPath = join(taskDir, 'research', '0503-ledger-verification.json')
const strictReportPath = join(taskDir, 'research', '0503-strict-completion-report.md')
const completionAuditPath = join(taskDir, 'research', '0503-completion-audit.json')
const ownerActionQueuePath = join(taskDir, 'research', '0503-owner-action-queue.json')
const shellPortableStrictCommand = 'pnpm --silent check:0503-strict:vd-watch'
function hasArg(flag, args = process.argv) {
  return args.includes(flag)
}

const selfTest = hasArg('--self-test')
const forceVdForegroundWatch = hasArg('--vd-foreground-watch')
const forceExternalRefresh = hasArg('--force-external-refresh')
const maxPreservedExternalReportAgeMs = 8 * 60 * 60 * 1000

if (forceVdForegroundWatch) {
  process.env.DEVHUB_R8_VD_FOREGROUND_WATCH = '1'
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit',
    windowsHide: true,
    ...options
  })
  return typeof result.status === 'number' ? result.status : 1
}

function runCaptured(command, args, options = {}) {
  const { echoOutput = true, ...spawnOptions } = options
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'pipe',
    windowsHide: true,
    ...spawnOptions
  })

  if (echoOutput) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }

  return {
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    status: typeof result.status === 'number' ? result.status : 1
  }
}

function writeCapturedOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

function isExpectedStrictCompletionFailure(status, output) {
  return status === 1 && output.includes('strict completion failed:')
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

function formatCountMap(record, limit = 8) {
  return Object.entries(record ?? {})
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey))
    .slice(0, limit)
    .map(([key, count]) => `${key}=${count}`)
    .join(', ')
}

function buildStrictFailureSummary(report, audit = null, ownerActionQueue = null) {
  const strict = report?.strictCompletion ?? {}
  const taxonomy = audit?.blockerTaxonomy
  const missingOrIncompleteRequirementCount = Array.isArray(audit?.missingOrIncompleteRequirements)
    ? audit.missingOrIncompleteRequirements.length
    : Number.isFinite(Number(taxonomy?.totalTaxonomyRows))
      ? Number(taxonomy.totalTaxonomyRows)
      : null
  const failedExternalGateLines = (strict.failedExternalGateDetails ?? [])
    .map(gate => {
      const id = typeof gate.id === 'string' && gate.id.length > 0 ? gate.id : 'unknown-gate'
      const owner = typeof gate.runbook?.owner === 'string' && gate.runbook.owner.length > 0 ? gate.runbook.owner : 'unknown-owner'
      const kind = typeof gate.runbook?.blockerKind === 'string' && gate.runbook.blockerKind.length > 0 ? gate.runbook.blockerKind : 'unknown-kind'
      const evidence = typeof gate.evidence === 'string' && gate.evidence.length > 0 ? gate.evidence : 'no current evidence'
      return `- ${id}: owner=${owner}; kind=${kind}; evidence=${evidence}`
    })
  const failedExternalGateActionDossierCommands = (strict.failedExternalGateDetails ?? [])
    .map(gate => (typeof gate.id === 'string' && gate.id.length > 0 ? gate.id : null))
    .filter(id => id !== null)
    .map(id => `- ${id}: pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${id}`)
  const ownerActionsById = new Map((ownerActionQueue?.actions ?? [])
    .filter(action => typeof action.actionId === 'string' && action.actionId.length > 0)
    .map(action => [action.actionId, action]))
  const failedExternalGateVerificationNotes = (strict.failedExternalGateDetails ?? [])
    .map(gate => (typeof gate.id === 'string' && gate.id.length > 0 ? gate.id : null))
    .filter(id => id !== null)
    .map(id => {
      const note = ownerActionsById.get(id)?.verificationCommandNote
      return typeof note === 'string' && note.length > 0 ? `- ${id}: ${note}` : null
    })
    .filter(line => line !== null)
  const failedExternalGateOwnerEvidenceCommandSets = (strict.failedExternalGateDetails ?? [])
    .map(gate => (typeof gate.id === 'string' && gate.id.length > 0 ? gate.id : null))
    .filter(id => id !== null)
    .flatMap(id => [
      `- ${id}:`,
      `  - actionDossierCommand: pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${id}`,
      `  - rawEvidenceTemplateCommand: pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${id}`,
      `  - submissionTemplateCommand: pnpm --silent check:0503-owner-evidence -- --print-template --action ${id}`
    ])
  const failedGateOwners = [...new Set((strict.failedExternalGateDetails ?? [])
    .map(gate => gate.runbook?.owner)
    .filter(owner => typeof owner === 'string' && owner.length > 0))]
    .sort((left, right) => left.localeCompare(right))
  const ownerCommandOwners = ['operator', 'legal-product', 'product', 'user-product']
    .filter(owner => failedGateOwners.includes(owner) || Number(taxonomy?.ownerWeightedOpenRows?.[owner] ?? 0) > 0)
  const ownerClosureCommands = ownerCommandOwners
    .map(owner => `- ${owner}: pnpm check:0503-owner-evidence -- --owner-closure-bundles --owner ${owner}`)
  const ownerLaneCommands = ownerCommandOwners
    .map(owner => `- ${owner}: pnpm --silent check:0503-owner-evidence -- --owner-lane-commands --owner ${owner}`)
  const ownerLaneCommandSets = ownerCommandOwners
    .flatMap(owner => [
      `- ${owner}:`,
      `  - listActionsCommand: pnpm --silent check:0503-owner-evidence -- --list-actions --owner ${owner}`,
      `  - ownerReadinessCommand: pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`,
      `  - ownerReadinessWithEvidenceDirCommand: pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`,
      `  - ownerReadinessWithCoverageArtifactsCommand: pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md> --coverage-json <repo-relative-report.json>`,
      `  - ownerSummaryCommand: pnpm --silent check:0503-owner-evidence -- --owner-summary --owner ${owner}`,
      `  - blockerTaxonomyCommand: pnpm check:0503-owner-evidence -- --blocker-taxonomy --owner ${owner}`,
      `  - partialR8DossierCommand: pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner ${owner}`,
      `  - closureBundleCommand: pnpm check:0503-owner-evidence -- --owner-closure-bundles --owner ${owner}`,
      `  - requireCompleteCommand: pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --require-complete`,
      `  - submissionTemplateDirectoryCommand: pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner ${owner}`,
      `  - rawEvidenceTemplateDirectoryCommand: pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner ${owner}`,
      `  - coverageReportCommand: pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --coverage-report <repo-relative-report.md>`,
      `  - coverageJsonCommand: pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --coverage-json <repo-relative-report.json>`
    ])
  const ownerReadinessCommands = ownerCommandOwners
    .map(owner => `- ${owner}: pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`)
  const ownerReadinessWithEvidenceDirCommands = ownerCommandOwners
    .map(owner => `- ${owner}: pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`)
  const partialR8DossierCommands = ownerCommandOwners
    .map(owner => `- ${owner}: pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner ${owner}`)
  const partialR8FileDossierCommands = (audit?.partialR8Dossier ?? [])
    .filter(row => typeof row.file === 'string' && row.file.length > 0 && row.status === 'partial')
    .map(row => `- ${row.file}: pnpm check:0503-owner-evidence -- --partial-r8-dossier --file ${row.file}`)
  const ownerTaxonomyCommands = ownerCommandOwners
    .map(owner => `- ${owner}: pnpm check:0503-owner-evidence -- --blocker-taxonomy --owner ${owner}`)
  return [
    '0503 strict completion remains not complete.',
    ...(missingOrIncompleteRequirementCount === null ? [] : [`- missingOrIncompleteRequirements: ${missingOrIncompleteRequirementCount}`]),
    `- partialRows: ${(strict.partialRows ?? []).length}`,
    `- missingEvidenceRows: ${(strict.missingEvidenceRows ?? []).length}`,
    `- failedExternalGateIds: ${(strict.failedExternalGateIds ?? []).length}`,
    `- surveyAcceptanceRows: ${(strict.surveyAcceptanceRows ?? []).length}`,
    `- externalReportFresh: ${strict.externalReportFresh}`,
    `- strictReport: ${strictReportPath}`,
    `- recommendedStrictCommand: ${shellPortableStrictCommand}`,
    ...(failedExternalGateLines.length > 0
      ? [
          '',
          'Failed external gate snapshot:',
          ...failedExternalGateLines
        ]
      : []),
    ...(failedExternalGateActionDossierCommands.length > 0
      ? [
          '',
          'Failed external gate action dossier commands:',
          ...failedExternalGateActionDossierCommands
        ]
      : []),
    ...(failedExternalGateVerificationNotes.length > 0
      ? [
          '',
          'Failed external gate verification notes:',
          ...failedExternalGateVerificationNotes
        ]
      : []),
    ...(failedExternalGateOwnerEvidenceCommandSets.length > 0
      ? [
          '',
          'Failed external gate owner evidence command sets:',
          ...failedExternalGateOwnerEvidenceCommandSets
        ]
      : []),
    ...(taxonomy
      ? [
          '',
          'Blocker taxonomy:',
          `- taxonomyRows: ${taxonomy.totalTaxonomyRows}`,
          `- weightedOpenRows: ${taxonomy.totalWeightedOpenRows}`,
          `- categories: ${formatCountMap(taxonomy.categoryWeightedOpenRows)}`,
          `- owners: ${formatCountMap(taxonomy.ownerWeightedOpenRows)}`
        ]
      : []),
    '',
    'Owner closure bundle commands:',
    ...ownerClosureCommands,
    '',
    'Owner lane commands:',
    ...ownerLaneCommands,
    '',
    'Owner lane command sets:',
    ...ownerLaneCommandSets,
    '',
    'Owner readiness commands:',
    ...ownerReadinessCommands,
    '',
    'Owner readiness with evidence directory commands:',
    ...ownerReadinessWithEvidenceDirCommands,
    '',
    'Partial R8 dossier commands:',
    ...partialR8DossierCommands,
    ...(partialR8FileDossierCommands.length > 0
      ? [
          '',
          'Partial R8 file dossier commands:',
          ...partialR8FileDossierCommands
        ]
      : []),
    '',
    'Owner blocker taxonomy commands:',
    ...ownerTaxonomyCommands,
    '',
    'Boundary: this summary is diagnostic output only; the command still exits non-zero until real evidence closes every strict blocker.'
  ].join('\n')
}

function printStrictFailureSummary() {
  console.error(buildStrictFailureSummary(
    readJsonIfPresent(ledgerReportPath),
    readJsonIfPresent(completionAuditPath),
    readJsonIfPresent(ownerActionQueuePath)
  ))
}

function runSelfTest() {
  assert(
    isExpectedStrictCompletionFailure(1, 'Error: strict completion failed: partialRows=1'),
    'expected strict completion failure should be recognized'
  )
  assert(
    !isExpectedStrictCompletionFailure(0, '0503 ledger verification ok'),
    'passing strict completion must not be treated as expected failure'
  )
  assert(
    !isExpectedStrictCompletionFailure(1, 'Error: missing prompts/0503-2 ledger rows'),
    'structural ledger failures must not refresh the acceptance pack'
  )
  assert(
    hasArg('--vd-foreground-watch', ['node', 'script', '--vd-foreground-watch']),
    'vd foreground watch flag should be detectable'
  )
  const summary = buildStrictFailureSummary({
    strictCompletion: {
      externalReportFresh: true,
      failedExternalGateDetails: [{
        evidence: '1 display(s) detected',
        id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
        runbook: { blockerKind: 'hardware', owner: 'operator' }
      }],
      failedExternalGateIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
      missingEvidenceRows: [],
      partialRows: ['prompts/0503-2/R8.B/prd.md'],
      surveyAcceptanceRows: [{ file: 'prompts/0503/28-final-acceptance-checklist.md' }]
    }
  }, {
    blockerTaxonomy: {
      categoryWeightedOpenRows: { hardware: 2, 'partial-r8-implementation': 1 },
      ownerWeightedOpenRows: { operator: 2, 'agent-or-operator': 1 },
      totalTaxonomyRows: 2,
      totalWeightedOpenRows: 3
    },
    partialR8Dossier: [
      {
        file: 'prompts/0503-2/R8.B/prd.md',
        status: 'partial'
      }
    ]
  }, {
    actions: [
      {
        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
        verificationCommandNote: 'Second-display evidence must come from a real Windows display topology.'
      }
    ]
  })
  assert(summary.includes('partialRows: 1'), 'strict failure summary should include partial row count')
  assert(summary.includes('missingOrIncompleteRequirements: 2'), 'strict failure summary should include missing requirement count')
  assert(summary.includes('Failed external gate snapshot:'), 'strict failure summary should include failed external gate snapshot')
  assert(summary.includes('ASSERT_BROWSERWINDOW_SECOND_DISPLAY: owner=operator; kind=hardware; evidence=1 display(s) detected'), 'strict failure summary should include failed gate evidence')
  assert(summary.includes('Failed external gate action dossier commands:'), 'strict failure summary should include failed gate action dossier command section')
  assert(summary.includes('--action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'strict failure summary should include failed gate action dossier command')
  assert(summary.includes('Failed external gate verification notes:'), 'strict failure summary should include failed gate verification note section')
  assert(summary.includes('Second-display evidence must come from a real Windows display topology.'), 'strict failure summary should include failed gate verification command note')
  assert(summary.includes('Failed external gate owner evidence command sets:'), 'strict failure summary should include failed gate owner evidence command set section')
  assert(summary.includes('--print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'strict failure summary should include failed gate raw evidence template command')
  assert(summary.includes('--print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'strict failure summary should include failed gate submission template command')
  assert(summary.includes('Blocker taxonomy:'), 'strict failure summary should include blocker taxonomy')
  assert(summary.includes('hardware=2'), 'strict failure summary should include taxonomy category counts')
  assert(summary.includes(`recommendedStrictCommand: ${shellPortableStrictCommand}`), 'strict failure summary should include shell-portable strict command')
  assert(summary.includes('--owner-closure-bundles --owner operator'), 'strict failure summary should include owner closure bundle command')
  assert(summary.includes('--owner-lane-commands --owner operator'), 'strict failure summary should include owner lane command')
  assert(summary.includes('Owner lane command sets:'), 'strict failure summary should include owner lane command set section')
  assert(summary.includes('ownerReadinessWithCoverageArtifactsCommand: pnpm check:0503-owner-evidence -- --owner-readiness --owner operator --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md> --coverage-json <repo-relative-report.json>'), 'strict failure summary should include owner readiness coverage artifacts command')
  assert(summary.includes('rawEvidenceTemplateDirectoryCommand: pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner operator'), 'strict failure summary should include owner raw evidence template directory command')
  assert(summary.includes('coverageJsonCommand: pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --coverage-json <repo-relative-report.json>'), 'strict failure summary should include owner coverage JSON command')
  assert(summary.includes('--owner-readiness --owner operator'), 'strict failure summary should include owner readiness command')
  assert(summary.includes('--owner-readiness --owner operator --evidence-dir <repo-relative-dir>'), 'strict failure summary should include owner readiness evidence-dir command')
  assert(summary.includes('--partial-r8-dossier --owner operator'), 'strict failure summary should include partial R8 dossier command')
  assert(summary.includes('--partial-r8-dossier --file prompts/0503-2/R8.B/prd.md'), 'strict failure summary should include partial R8 file dossier command')
  assert(summary.includes('--blocker-taxonomy --owner operator'), 'strict failure summary should include owner blocker taxonomy command')
  assert(summary.includes('exits non-zero'), 'strict failure summary should preserve the non-zero boundary')
  console.log('0503 strict completion runner self-test passed.')
}

if (selfTest) {
  runSelfTest()
  process.exit(0)
}

const externalReportPath = join(devhubRoot, blockerReportPath)
let externalStatus = 0
const elevated = isCurrentProcessElevated()

if (!forceExternalRefresh && hasFreshPassingExternalReport(externalReportPath)) {
  console.log(`0503 strict: preserving fresh passed external blocker report at ${blockerReportPath}; use --force-external-refresh to refresh.`)
} else if (!forceExternalRefresh && process.platform === 'win32' && !elevated) {
  console.error('0503 strict: refusing to refresh external blocker report from a non-Administrator Windows shell. Run the elevated verification script first, or pass --force-external-refresh to intentionally overwrite the external report.')
  process.exit(1)
} else {
  externalStatus = run(process.execPath, [
    externalBlockerScript,
    '--quiet',
    '--write-report',
    blockerReportPath
  ], { cwd: devhubRoot, shell: false })
}

if (![0, 1].includes(externalStatus)) {
  process.exit(externalStatus)
}

const existingLedgerReport = readJsonIfPresent(ledgerReportPath)

if (existingLedgerReport?.strictCompletion?.checked === true) {
  const statusRefreshResult = runCaptured(process.execPath, [
    acceptancePackScript,
    '--no-refresh'
  ], { echoOutput: false, shell: false })

  if (statusRefreshResult.status !== 0) {
    writeCapturedOutput(statusRefreshResult)
    process.exit(statusRefreshResult.status)
  }
}

const ledgerResult = runCaptured(process.execPath, [
  ledgerScript,
  '--strict-complete',
  '--write-report',
  '--write-strict-report'
], { echoOutput: false, shell: false })

if (ledgerResult.status === 0) {
  writeCapturedOutput(ledgerResult)
}

if (ledgerResult.status !== 0 && !isExpectedStrictCompletionFailure(ledgerResult.status, ledgerResult.output)) {
  writeCapturedOutput(ledgerResult)
  process.exit(ledgerResult.status)
}

if (ledgerResult.status === 0 || isExpectedStrictCompletionFailure(ledgerResult.status, ledgerResult.output)) {
  const packStatus = run(process.execPath, [
    acceptancePackScript,
    '--no-refresh'
  ], { shell: false })

  if (packStatus !== 0) {
    process.exit(packStatus)
  }

  const evidencePackStatus = run(process.execPath, [
    evidencePackVerifierScript
  ], { shell: false })

  if (evidencePackStatus !== 0) {
    process.exit(evidencePackStatus)
  }
}

if (ledgerResult.status !== 0) {
  printStrictFailureSummary()
}

process.exit(ledgerResult.status)
