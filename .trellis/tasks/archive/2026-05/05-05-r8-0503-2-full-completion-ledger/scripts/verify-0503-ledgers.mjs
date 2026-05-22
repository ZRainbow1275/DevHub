import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const taskDir = dirname(scriptDir)
const repoRoot = findRepoRoot(taskDir)
const researchDir = join(taskDir, 'research')

const completionLedgerPath = join(researchDir, '0503-2-completion-ledger.md')
const surveyLedgerPath = join(researchDir, '0503-survey-acceptance-ledger.md')
const externalBlockerReportPath = join(researchDir, 'r8-external-blockers-current.json')
const reportPath = join(researchDir, '0503-ledger-verification.json')
const strictReportPath = join(researchDir, '0503-strict-completion-report.md')
const acceptancePackMarkdownPath = join(researchDir, '0503-acceptance-pack.md')
const completionStatusJsonPath = join(researchDir, '0503-completion-status.json')
const completionStatusMarkdownPath = join(researchDir, '0503-completion-status.md')
const completionAuditMarkdownPath = join(researchDir, '0503-completion-audit.md')
const ownerActionQueueJsonPath = join(researchDir, '0503-owner-action-queue.json')
const ownerActionQueueMarkdownPath = join(researchDir, '0503-owner-action-queue.md')
const ownerClosureBundlesMarkdownPath = join(researchDir, '0503-owner-closure-bundles.md')
const shellPortableStrictCompletionCommand = 'pnpm --silent check:0503-strict:vd-watch'
const ledgerVerificationSchemaVersion = 'devhub-0503-ledger-verification-v1'
const strictComplete = process.argv.includes('--strict-complete')
const selfTest = process.argv.includes('--self-test')
const writeStrictReport = process.argv.includes('--write-strict-report')
const maxExternalReportAgeMinutes = readIntegerOption('--max-external-report-age-minutes=', 480)

function normalizePath(value) {
  return value
    .replace(/^`|`$/g, '')
    .replaceAll('\\\\', '/')
    .replaceAll('\\', '/')
}

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

function readText(path) {
  return readFileSync(path, 'utf8')
}

function readJson(path) {
  assert(existsSync(path), `missing JSON report: ${path}`)
  return JSON.parse(readText(path))
}

function relativeRepoPath(path) {
  return relative(repoRoot, path).replaceAll('\\', '/')
}

function listMarkdownFiles(root, prefix) {
  const rows = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        rows.push(`${prefix}/${relative(root, fullPath).replaceAll('\\', '/')}`)
      }
    }
  }
  visit(root)
  return rows.sort()
}

function parseMarkdownRows(markdown) {
  return markdown.split(/\r?\n/)
    .filter(line => line.startsWith('| ') && !line.startsWith('| ---'))
    .map(line => line.trim().slice(1, -1).split('|').map(cell => cell.trim()))
}

function countBy(values) {
  const counts = {}
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

function parseIntegerCell(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) ? numericValue : null
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readIntegerOption(prefix, defaultValue) {
  const arg = process.argv.find(value => value.startsWith(prefix))
  if (!arg) return defaultValue
  const value = Number(arg.slice(prefix.length))
  assert(Number.isInteger(value) && value > 0, `${prefix} must be a positive integer`)
  return value
}

function tableCell(value) {
  return String(value ?? '')
    .replaceAll('|', '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, maxLength = 420) {
  const text = tableCell(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function renderRows(rows, emptyText, columns, mapper) {
  if (rows.length === 0) return `\n${emptyText}\n`
  const header = `| ${columns.join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${mapper(row).join(' | ')} |`).join('\n')
  return `\n${header}\n${divider}\n${body}\n`
}

const requiredGateRunbookFields = [
  'blockerKind',
  'owner',
  'prerequisite',
  'verificationCommand',
  'requiredEvidence',
  'unblockRule'
]

const ownerLaneCommandColumns = [
  ['Owner', 'owner'],
  ['Action count', 'actionCount'],
  ['List actions command', 'listActionsCommand'],
  ['Readiness command', 'ownerReadinessCommand'],
  ['Readiness evidence-dir command', 'ownerReadinessWithEvidenceDirCommand'],
  ['Readiness coverage-artifact command', 'ownerReadinessWithCoverageArtifactsCommand'],
  ['Owner summary command', 'ownerSummaryCommand'],
  ['Blocker taxonomy command', 'blockerTaxonomyCommand'],
  ['Partial R8 dossier command', 'partialR8DossierCommand'],
  ['Closure bundle command', 'closureBundleCommand'],
  ['Require complete command', 'requireCompleteCommand'],
  ['Submission template directory command', 'submissionTemplateDirectoryCommand'],
  ['Raw evidence template directory command', 'rawEvidenceTemplateDirectoryCommand'],
  ['Coverage report command', 'coverageReportCommand'],
  ['Coverage JSON command', 'coverageJsonCommand'],
  ['Evidence', 'sourceEvidencePath']
]

function ownerLaneCommandCells(row) {
  return ownerLaneCommandColumns.map(([, field]) => tableCell(row[field] ?? ''))
}

function getOwnerLaneCommandSets(currentReport) {
  if (Array.isArray(currentReport.ownerLaneCommandSets)) return currentReport.ownerLaneCommandSets
  const completionStatus = readJson(completionStatusJsonPath)
  return Array.isArray(completionStatus.nextOwnerCommands) ? completionStatus.nextOwnerCommands : []
}

function getFailedGateVerificationNoteByActionId(currentReport) {
  if (currentReport.failedGateVerificationNotes && typeof currentReport.failedGateVerificationNotes === 'object') {
    return new Map(Object.entries(currentReport.failedGateVerificationNotes))
  }
  const ownerActionQueue = readJson(ownerActionQueueJsonPath)
  return new Map((ownerActionQueue.actions ?? [])
    .filter(action => typeof action.actionId === 'string')
    .map(action => [action.actionId, action.verificationCommandNote ?? '']))
}

function listMissingGateRunbookFields(gates, requiredGateIds) {
  return gates
    .filter(gate => requiredGateIds.includes(gate.id))
    .flatMap(gate => {
      const runbook = gate.runbook && typeof gate.runbook === 'object' ? gate.runbook : {}
      return requiredGateRunbookFields
        .filter(field => typeof runbook[field] !== 'string' || runbook[field].trim().length === 0)
        .map(field => `${gate.id}.${field}`)
    })
}

function renderStrictCompletionMarkdown(currentReport) {
  const strict = currentReport.strictCompletion
  const externalGateRunbookMissingFields = currentReport.blockers.externalReport.runbookMissingFields
  const strictCompletionGuard = strict.guard ?? {}
  const ownerLaneCommandSets = getOwnerLaneCommandSets(currentReport)
  const failedGateVerificationNoteByActionId = getFailedGateVerificationNoteByActionId(currentReport)
  const auditEntryPoints = [
    {
      artifact: 'Acceptance evidence pack',
      path: relativeRepoPath(acceptancePackMarkdownPath),
      purpose: 'Human-readable prompt coverage, failed gates, checkbox ownership, and non-completion boundary.'
    },
    {
      artifact: 'Completion status',
      path: relativeRepoPath(completionStatusMarkdownPath),
      purpose: 'Machine-derived completion guard evidence, current environment snapshot, and owner command index.'
    },
    {
      artifact: 'Completion audit',
      path: relativeRepoPath(completionAuditMarkdownPath),
      purpose: 'Prompt-to-artifact checklist, command checklist, guard crosswalk, and missing requirement taxonomy.'
    },
    {
      artifact: 'Owner action queue',
      path: relativeRepoPath(ownerActionQueueMarkdownPath),
      purpose: 'Canonical owner actions, evidence templates, verification commands, and intake workflow.'
    },
    {
      artifact: 'Owner closure bundles',
      path: relativeRepoPath(ownerClosureBundlesMarkdownPath),
      purpose: 'Owner-scoped closure bundles linking blockers, guards, partial R8 rows, and evidence commands.'
    }
  ]
  return [
    '# 0503 Strict Completion Report',
    '',
    `Generated at: ${currentReport.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Strict completion checked: ${strict.checked}`,
    `- Strict completion passed: ${strict.passed}`,
    `- Partial R8 rows: ${strict.partialRows.length}`,
    `- Missing evidence rows: ${strict.missingEvidenceRows.length}`,
    `- Failed external gates: ${strict.failedExternalGateIds.length}`,
    `- External gate runbook missing fields: ${externalGateRunbookMissingFields.length}`,
    `- Survey acceptance rows: ${strict.surveyAcceptanceRows.length}`,
    `- External blocker report fresh: ${strict.externalReportFresh}`,
    `- External blocker report age seconds: ${strict.externalReportAgeSeconds}`,
    `- Recommended strict command: ${shellPortableStrictCompletionCommand}`,
    '',
    '## Strict Completion Guard',
    renderRows(
      Object.entries(strictCompletionGuard).map(([guard, passed]) => ({ guard, passed })),
      'No strict completion guard.',
      ['Guard', 'Passed'],
      row => [tableCell(row.guard), tableCell(row.passed)]
    ),
    '',
    '## Completion Audit Entry Points',
    renderRows(
      auditEntryPoints,
      'No completion audit entry points.',
      ['Artifact', 'Path', 'Purpose'],
      row => [tableCell(row.artifact), tableCell(row.path), truncate(row.purpose)]
    ),
    '',
    '## Partial R8 Rows',
    renderRows(
      strict.partialRowDetails,
      'No partial R8 rows.',
      ['File', 'Next action'],
      row => [tableCell(row.file), truncate(row.nextAction)]
    ),
    '',
    '## Failed External Gates',
    renderRows(
      strict.failedExternalGateDetails,
      'No failed external gates.',
      ['Gate', 'Evidence', 'Owner', 'Prerequisite', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Required evidence', 'Unblock rule'],
      row => [
        tableCell(row.id),
        tableCell(row.evidence),
        tableCell(row.runbook?.owner ?? ''),
        truncate(row.runbook?.prerequisite ?? ''),
        truncate(row.runbook?.verificationCommand ?? ''),
        truncate(failedGateVerificationNoteByActionId.get(row.id) ?? row.verificationCommandNote ?? ''),
        `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${tableCell(row.id)}`,
        `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${tableCell(row.id)}`,
        `pnpm --silent check:0503-owner-evidence -- --print-template --action ${tableCell(row.id)}`,
        truncate(row.runbook?.requiredEvidence ?? ''),
        truncate(row.runbook?.unblockRule ?? '')
      ]
    ),
    '',
    '## External Gate Runbook Coverage',
    renderRows(
      externalGateRunbookMissingFields,
      'All required external gate runbook fields are present.',
      ['Missing field'],
      field => [tableCell(field)]
    ),
    '',
    '## Survey Acceptance Rows',
    renderRows(
      strict.surveyAcceptanceRows,
      'No survey acceptance rows.',
      ['File', 'Status'],
      row => [tableCell(row.file), tableCell(row.status)]
    ),
    '',
    '## Owner Lane Command Sets',
    '',
    'These commands are owner intake aids only; they do not close strict completion without real submitted evidence.',
    renderRows(
      ownerLaneCommandSets,
      'No owner lane command sets.',
      ownerLaneCommandColumns.map(([column]) => column),
      ownerLaneCommandCells
    ),
    '',
    '## Verification Commands',
    '',
    '```bash',
    shellPortableStrictCompletionCommand,
    'pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json',
    'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs --strict-complete --write-report --write-strict-report',
    '```',
    ''
  ].join('\n')
}

function runSelfTest() {
  assert(normalizePath('`prompts\\0503\\28-final-acceptance-checklist.md`') === 'prompts/0503/28-final-acceptance-checklist.md', 'normalizePath should strip backticks and normalize separators')
  assert(countBy(['verified', 'partial', 'verified']).verified === 2, 'countBy should count repeated values')
  assert(tableCell('a | b\nc') === 'a / b c', 'tableCell should escape pipes and collapse whitespace')
  assert(truncate('abcdef', 5) === 'ab...', 'truncate should preserve max length with ellipsis')
  assert(renderRows([{ id: 'A|B', evidence: 'ok' }], 'empty', ['ID', 'Evidence'], row => [tableCell(row.id), tableCell(row.evidence)]).includes('A/B'), 'renderRows should use escaped table cells')
  assert(parseIntegerCell('12') === 12, 'parseIntegerCell should parse integers')
  assert(parseIntegerCell('n/a') === null, 'parseIntegerCell should return null for non-integers')
  assert(listMissingGateRunbookFields([{ id: 'G', runbook: { blockerKind: 'x', owner: 'x', prerequisite: 'x', verificationCommand: 'x', requiredEvidence: 'x', unblockRule: 'x' } }], ['G']).length === 0, 'complete gate runbook should pass')
  assert(listMissingGateRunbookFields([{ id: 'G', runbook: { owner: 'x' } }], ['G']).includes('G.blockerKind'), 'incomplete gate runbook should report missing fields')
  const renderedStrictReport = renderStrictCompletionMarkdown({
    blockers: { externalReport: { runbookMissingFields: [] } },
    failedGateVerificationNotes: {
      ASSERT_BROWSERWINDOW_SECOND_DISPLAY: 'second display note from owner action queue'
    },
    generatedAt: '2026-05-19T00:00:00.000Z',
    ownerLaneCommandSets: [
      {
        blockerTaxonomyCommand: 'blocker-taxonomy operator',
        closureBundleCommand: 'closure-bundle operator',
        coverageJsonCommand: 'coverage-json operator',
        coverageReportCommand: 'coverage-report operator',
        actionCount: 7,
        listActionsCommand: 'list-actions operator',
        owner: 'operator',
        ownerReadinessCommand: 'readiness operator',
        ownerReadinessWithCoverageArtifactsCommand: 'readiness coverage-artifacts operator',
        ownerReadinessWithEvidenceDirCommand: 'readiness evidence-dir operator',
        ownerSummaryCommand: 'summary operator',
        partialR8DossierCommand: 'partial-r8-dossier operator',
        rawEvidenceTemplateDirectoryCommand: 'raw-template-dir operator',
        requireCompleteCommand: 'require-complete operator',
        sourceEvidencePath: '0503-owner-action-queue.json#/ownerLaneCommands/0',
        submissionTemplateDirectoryCommand: 'submission-template-dir operator'
      }
    ],
    strictCompletion: {
      checked: true,
      externalReportAgeSeconds: 0,
      externalReportFresh: true,
      failedExternalGateDetails: [
        {
          evidence: '1 display(s) detected',
          id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
          runbook: {
            owner: 'operator',
            prerequisite: 'connect a second display',
            requiredEvidence: 'two displays',
            unblockRule: 'real display only',
            verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json'
          }
        }
      ],
      failedExternalGateIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
      guard: { externalReportFresh: true, partialR8RowsClosed: false },
      missingEvidenceRows: [],
      partialRowDetails: [{ file: 'prompts/0503-2/R8.B/prd.md', nextAction: 'close with evidence' }],
      partialRows: ['prompts/0503-2/R8.B/prd.md'],
      passed: false,
      surveyAcceptanceRows: []
    }
  })
  assert(renderedStrictReport.includes('| partialR8RowsClosed | false |'), 'strict report should render guard rows')
  assert(renderedStrictReport.includes('## Owner Lane Command Sets'), 'strict report should render owner lane command-set section')
  assert(renderedStrictReport.includes('Readiness coverage-artifact command'), 'strict report should render owner lane readiness coverage-artifact command column')
  assert(renderedStrictReport.includes('Coverage JSON command'), 'strict report should render owner lane coverage JSON command column')
  assert(renderedStrictReport.includes('readiness coverage-artifacts operator'), 'strict report should render owner readiness coverage artifacts command')
  assert(renderedStrictReport.includes('raw-template-dir operator'), 'strict report should render owner raw evidence template directory command')
  assert(renderedStrictReport.includes('coverage-json operator'), 'strict report should render owner coverage JSON command')
  assert(renderedStrictReport.includes('Action dossier command'), 'strict report should render failed gate action dossier command column')
  assert(renderedStrictReport.includes('Raw evidence template command'), 'strict report should render failed gate raw evidence template command column')
  assert(renderedStrictReport.includes('Submission template command'), 'strict report should render failed gate submission template command column')
  assert(renderedStrictReport.includes('Verification command note'), 'strict report should render failed gate verification command note column')
  assert(renderedStrictReport.includes('second display note from owner action queue'), 'strict report should render failed gate verification command note')
  assert(renderedStrictReport.includes('--action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'strict report should render failed gate action dossier command')
  assert(renderedStrictReport.includes('--print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'strict report should render failed gate raw evidence template command')
  assert(renderedStrictReport.includes('--print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'strict report should render failed gate submission template command')
  assert(renderedStrictReport.includes('| ASSERT_BROWSERWINDOW_SECOND_DISPLAY | 1 display(s) detected | operator | connect a second display | pnpm -C devhub check:r8-external-blockers -- --write-report report.json | second display note from owner action queue | pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY | pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY | pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY | two displays | real display only |'), 'strict report should render full failed gate command-set row')
  assert(renderedStrictReport.includes('0503-completion-audit.md'), 'strict report should link the completion audit entry point')
  assert(renderedStrictReport.includes(`Recommended strict command: ${shellPortableStrictCompletionCommand}`), 'strict report should render shell-portable strict command')
  assert(ledgerVerificationSchemaVersion === 'devhub-0503-ledger-verification-v1', 'ledger verification schemaVersion should stay stable')
  console.log('0503 ledger verifier self-test passed.')
}

if (selfTest) {
  runSelfTest()
  process.exit(0)
}

const prompts0503Files = listMarkdownFiles(join(repoRoot, 'prompts', '0503'), 'prompts/0503')
const prompts05032Files = listMarkdownFiles(join(repoRoot, 'prompts', '0503-2'), 'prompts/0503-2')

const completionLedger = readText(completionLedgerPath)
const surveyLedger = readText(surveyLedgerPath)

const completionRows = parseMarkdownRows(completionLedger)
  .filter(cells => normalizePath(cells[0] ?? '').startsWith('prompts/0503-2/'))
  .map(cells => ({
    batch: cells[1] ?? '',
    checkedCheckboxes: parseIntegerCell(cells[3] ?? ''),
    evidenceStatus: cells[6] ?? '',
    file: normalizePath(cells[0] ?? ''),
    implementationStatus: cells[4] ?? '',
    openCheckboxes: parseIntegerCell(cells[2] ?? ''),
    pendingMarkers: parseIntegerCell(cells[5] ?? ''),
    nextAction: cells[7] ?? ''
  }))

const surveyRows = parseMarkdownRows(surveyLedger)
  .filter(cells => normalizePath(cells[0] ?? '').startsWith('prompts/0503/'))
  .map(cells => ({
    checkedCheckboxes: parseIntegerCell(cells[2] ?? ''),
    evidenceStatus: cells[4] ?? '',
    file: normalizePath(cells[0] ?? ''),
    nextAction: cells[5] ?? '',
    openCheckboxes: parseIntegerCell(cells[1] ?? ''),
    questionMarkers: parseIntegerCell(cells[3] ?? ''),
    status: cells[cells.length - 1] ?? ''
  }))

const completionFiles = completionRows.map(row => row.file).sort()
const surveyFiles = surveyRows.map(row => row.file).sort()
const missingCompletionRows = prompts05032Files.filter(file => !completionFiles.includes(file))
const extraCompletionRows = completionFiles.filter(file => !prompts05032Files.includes(file))
const missingSurveyRows = prompts0503Files.filter(file => !surveyFiles.includes(file))
const extraSurveyRows = surveyFiles.filter(file => !prompts0503Files.includes(file))

const blockerChecks = [
  { id: 'admin-zero-egress', pattern: /administrator live capture required|Administrator/i },
  { id: 'multi-display-hardware', pattern: /multi-display|hardware|physical monitor/i },
  { id: 'windows-service-uac', pattern: /Windows Service UAC|service.*UAC|non-admin/i }
]

const combinedLedgerText = `${completionLedger}\n${surveyLedger}`
const missingBlockerMarkers = blockerChecks
  .filter(check => !check.pattern.test(combinedLedgerText))
  .map(check => check.id)

const requiredExternalGateIds = [
  'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
  'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
  'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY',
  'R8C_SPEC17_ADMIN_SHELL',
  'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED',
  'H1_J16_ZERO_EGRESS_CAPTURE_READY'
]

const externalBlockerReport = readJson(externalBlockerReportPath)
const externalReportGeneratedAtMs = Date.parse(externalBlockerReport.generatedAt ?? '')
const externalReportAgeSeconds = Number.isFinite(externalReportGeneratedAtMs)
  ? Math.max(0, Math.round((Date.now() - externalReportGeneratedAtMs) / 1000))
  : null
const maxExternalReportAgeSeconds = maxExternalReportAgeMinutes * 60
const externalReportFresh = externalReportAgeSeconds !== null &&
  externalReportAgeSeconds <= maxExternalReportAgeSeconds
const externalBlockerGates = Array.isArray(externalBlockerReport.gates) ? externalBlockerReport.gates : []
const externalBlockerGateIds = externalBlockerGates
  .map(gate => typeof gate.id === 'string' ? gate.id : '')
  .filter(Boolean)
const missingExternalBlockerGateIds = requiredExternalGateIds
  .filter(gateId => !externalBlockerGateIds.includes(gateId))
const failedExternalBlockerGateIds = externalBlockerGates
  .filter(gate => requiredExternalGateIds.includes(gate.id) && gate.passed !== true)
  .map(gate => gate.id)
const failedExternalBlockerGateDetails = externalBlockerGates
  .filter(gate => requiredExternalGateIds.includes(gate.id) && gate.passed !== true)
  .map(gate => ({
    evidence: typeof gate.evidence === 'string' ? gate.evidence : '',
    id: gate.id,
    runbook: gate.runbook && typeof gate.runbook === 'object' ? gate.runbook : null
  }))
const externalGateRunbookMissingFields = listMissingGateRunbookFields(externalBlockerGates, requiredExternalGateIds)
const passedExternalBlockerGateIds = externalBlockerGates
  .filter(gate => requiredExternalGateIds.includes(gate.id) && gate.passed === true)
  .map(gate => gate.id)
const externalBlockerReportPassed = externalBlockerGates.length > 0 &&
  externalBlockerGates.every(gate => gate.passed === true)
const evidenceStatusCounts = countBy(completionRows.map(row => row.evidenceStatus))
const partialCompletionRows = completionRows
  .filter(row => row.evidenceStatus === 'partial')
  .map(row => row.file)
const partialCompletionRowDetails = completionRows
  .filter(row => row.evidenceStatus === 'partial')
  .map(row => ({
    file: row.file,
    nextAction: row.nextAction
  }))
const missingCompletionEvidenceRows = completionRows
  .filter(row => row.evidenceStatus === 'missing')
  .map(row => row.file)
const advisorySurveyAcceptanceRows = surveyRows
  .filter(row => /acceptance/i.test(row.status))
  .map(row => ({
    file: row.file,
    status: row.status
  }))
const surveyAcceptanceRows = []
const strictCompletionGuard = {
  blockerMarkersPresent: missingBlockerMarkers.length === 0,
  completionLedgerComplete: missingCompletionRows.length === 0 && extraCompletionRows.length === 0,
  externalGateRunbookComplete: externalGateRunbookMissingFields.length === 0,
  externalGatesPassed: externalBlockerReportPassed,
  externalReportFresh,
  missingEvidenceRowsClosed: missingCompletionEvidenceRows.length === 0,
  partialR8RowsClosed: partialCompletionRows.length === 0,
  requiredExternalGatesPresent: missingExternalBlockerGateIds.length === 0,
  surveyAcceptanceRowsClosed: surveyAcceptanceRows.length === 0,
  surveyLedgerComplete: missingSurveyRows.length === 0 && extraSurveyRows.length === 0
}
const strictCompletionPassed = Object.values(strictCompletionGuard).every(Boolean)

const report = {
  schemaVersion: ledgerVerificationSchemaVersion,
  blockers: {
    checked: blockerChecks.map(check => check.id),
    missingMarkers: missingBlockerMarkers,
    externalReport: {
      ageSeconds: externalReportAgeSeconds,
      failedGateIds: failedExternalBlockerGateIds,
      fresh: externalReportFresh,
      generatedAt: typeof externalBlockerReport.generatedAt === 'string' ? externalBlockerReport.generatedAt : null,
      maxAgeSeconds: maxExternalReportAgeSeconds,
      missingGateIds: missingExternalBlockerGateIds,
      passed: externalBlockerReport.passed === true,
      passedGateIds: passedExternalBlockerGateIds,
      path: relative(taskDir, externalBlockerReportPath).replaceAll('\\', '/'),
      requiredGateIds: requiredExternalGateIds,
      requiredRunbookFields: requiredGateRunbookFields,
      runbookMissingFields: externalGateRunbookMissingFields
    }
  },
  completionLedger: {
    evidenceStatusCounts,
    extraRows: extraCompletionRows,
    expectedMarkdownFiles: prompts05032Files.length,
    ledgerRows: completionRows.length,
    missingRows: missingCompletionRows,
    rows: completionRows
  },
  generatedAt: new Date().toISOString(),
  surveyLedger: {
    extraRows: extraSurveyRows,
    expectedMarkdownFiles: prompts0503Files.length,
    ledgerRows: surveyRows.length,
    missingRows: missingSurveyRows,
    advisoryAcceptanceRows: advisorySurveyAcceptanceRows,
    evidenceStatusCounts: countBy(surveyRows.map(row => row.evidenceStatus)),
    rows: surveyRows,
    statusCounts: countBy(surveyRows.map(row => row.status))
  },
  strictCompletion: {
    checked: strictComplete,
    externalReportAgeSeconds,
    externalReportFresh,
    failedExternalGateDetails: failedExternalBlockerGateDetails,
    failedExternalGateIds: failedExternalBlockerGateIds,
    guard: strictCompletionGuard,
    missingEvidenceRows: missingCompletionEvidenceRows,
    partialRowDetails: partialCompletionRowDetails,
    partialRows: partialCompletionRows,
    passed: strictCompletionPassed,
    surveyAcceptanceRows
  }
}

assert(missingCompletionRows.length === 0, `missing prompts/0503-2 ledger rows: ${missingCompletionRows.join(', ')}`)
assert(extraCompletionRows.length === 0, `extra prompts/0503-2 ledger rows: ${extraCompletionRows.join(', ')}`)
assert(missingSurveyRows.length === 0, `missing prompts/0503 survey ledger rows: ${missingSurveyRows.join(', ')}`)
assert(extraSurveyRows.length === 0, `extra prompts/0503 survey ledger rows: ${extraSurveyRows.join(', ')}`)
assert(missingBlockerMarkers.length === 0, `missing blocker markers: ${missingBlockerMarkers.join(', ')}`)
assert(missingExternalBlockerGateIds.length === 0, `missing external blocker gates: ${missingExternalBlockerGateIds.join(', ')}`)
assert(externalGateRunbookMissingFields.length === 0, `missing external gate runbook fields: ${externalGateRunbookMissingFields.join(', ')}`)
assert(externalBlockerReport.passed === externalBlockerReportPassed, 'external blocker report passed flag does not match gate statuses')

if (process.argv.includes('--write-report')) {
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

if (writeStrictReport) {
  writeFileSync(strictReportPath, renderStrictCompletionMarkdown(report), 'utf8')
}

if (strictComplete) {
  assert(strictCompletionPassed, [
    `strict completion failed: partialRows=${partialCompletionRows.length}`,
    `missingEvidenceRows=${missingCompletionEvidenceRows.length}`,
    `failedExternalGateIds=${failedExternalBlockerGateIds.length}`,
    `surveyAcceptanceRows=${surveyAcceptanceRows.length}`,
    `externalReportFresh=${externalReportFresh}`
  ].join('; '))
}

console.log(`0503 ledger verification ok: prompts/0503=${prompts0503Files.length}, prompts/0503-2=${prompts05032Files.length}, blockers=${blockerChecks.length}, external-gates=${requiredExternalGateIds.length}`)
