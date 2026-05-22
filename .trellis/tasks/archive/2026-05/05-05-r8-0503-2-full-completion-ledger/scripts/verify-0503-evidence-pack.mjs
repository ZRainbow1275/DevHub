import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const taskDir = dirname(scriptDir)
const repoRoot = join(taskDir, '..', '..', '..')
const resolvedRepoRoot = resolve(repoRoot)
const researchDir = join(taskDir, 'research')

const rootPackageJsonPath = join(repoRoot, 'package.json')
const devhubPackageJsonPath = join(repoRoot, 'devhub', 'package.json')
const devhubElectronViteConfigPath = join(repoRoot, 'devhub', 'electron.vite.config.ts')
const devhubManualTestingChecklistPath = join(repoRoot, 'devhub', 'docs', 'manual-testing-checklist.md')
const acceptancePackJsonPath = join(researchDir, '0503-acceptance-pack.json')
const acceptancePackMarkdownPath = join(researchDir, '0503-acceptance-pack.md')
const checkboxManifestJsonPath = join(researchDir, '0503-checkbox-manifest.json')
const checkboxManifestMarkdownPath = join(researchDir, '0503-checkbox-manifest.md')
const ledgerVerificationJsonPath = join(researchDir, '0503-ledger-verification.json')
const completionLedgerMarkdownPath = join(researchDir, '0503-2-completion-ledger.md')
const surveyAcceptanceLedgerMarkdownPath = join(researchDir, '0503-survey-acceptance-ledger.md')
const completionAuditJsonPath = join(researchDir, '0503-completion-audit.json')
const completionAuditMarkdownPath = join(researchDir, '0503-completion-audit.md')
const completionStatusJsonPath = join(researchDir, '0503-completion-status.json')
const completionStatusMarkdownPath = join(researchDir, '0503-completion-status.md')
const externalBlockerReportPath = join(researchDir, 'r8-external-blockers-current.json')
const handoffPath = join(taskDir, 'HANDOFF.md')
const implementContextJsonlPath = join(taskDir, 'implement.jsonl')
const checkContextJsonlPath = join(taskDir, 'check.jsonl')
const strictCompletionReportMarkdownPath = join(researchDir, '0503-strict-completion-report.md')
const ownerActionQueueJsonPath = join(researchDir, '0503-owner-action-queue.json')
const ownerActionQueueMarkdownPath = join(researchDir, '0503-owner-action-queue.md')
const ownerClosureBundlesJsonPath = join(researchDir, '0503-owner-closure-bundles.json')
const ownerClosureBundlesMarkdownPath = join(researchDir, '0503-owner-closure-bundles.md')
const ownerSubmissionTemplatesDirPath = join(researchDir, '0503-owner-submission-templates-current')
const ownerRawEvidenceTemplatesDirPath = join(researchDir, '0503-owner-raw-evidence-templates-current')
const ownerSubmissionTemplatesReadmePath = join(ownerSubmissionTemplatesDirPath, 'README.md')
const ownerRawEvidenceTemplatesReadmePath = join(ownerRawEvidenceTemplatesDirPath, 'README.md')
const noEmojiVerifierPath = join(scriptDir, 'verify-0503-no-emoji.mjs')
const ownerEvidenceVerifierPath = join(scriptDir, 'verify-0503-owner-evidence.mjs')
const strictRunnerPath = join(scriptDir, 'run-0503-strict-completion.mjs')
const acceptancePackSchemaVersion = 'devhub-0503-acceptance-pack-v1'
const checkboxManifestSchemaVersion = 'devhub-0503-checkbox-manifest-v1'
const ledgerVerificationSchemaVersion = 'devhub-0503-ledger-verification-v1'
const externalBlockerReportSchemaVersion = 'devhub-r8-external-blockers-v1'
const completionStatusSchemaVersion = 'devhub-0503-completion-status-v1'
const completionAuditSchemaVersion = 'devhub-0503-completion-audit-v1'
const ownerActionQueueSchemaVersion = 'devhub-0503-owner-action-queue-v1'
const ownerClosureBundleSchemaVersion = 'devhub-0503-owner-closure-bundles-v2'
const ownerRawEvidenceTemplateSchemaVersion = 'devhub-0503-owner-raw-evidence-template-v1'
const popoutBwRssBenchmarkSchemaVersion = 'devhub-r8-popout-bw-rss-benchmark-v1'
const thumbnailCaptureBenchmarkSchemaVersion = 'devhub-r8-thumbnail-capture-benchmark-v1'
const evidencePackVerifierRequirement = 'Verify schemaVersion guards, pack hashes, source hashes, prompt manifests with filesystem-count parity, task context JSONL coverage, external blocker report JSON, ledger verification JSON, completion ledger markdown, survey acceptance ledger markdown, acceptance pack markdown including failed gate verification notes, prompt-to-artifact machine evidence fields and JSON pointer targets, checkbox totals, checkbox manifest markdown, owner actions, owner action queue markdown rows, owner verification command notes across queue/raw/submission templates, current owner template JSON files, raw owner evidence template schemaVersion, owner closure bundles with verification command notes, owner closure bundles with source-file dossier commands plus action/raw/submission command columns and verification command notes in markdown rows, benchmark evidence schemas, completion status, completion status markdown sections, completion status owner lane command sets, completion status failed external gate command sets with verification notes, manual testing dual-running-surface docs, startup config dual-running-surface contract, completion audit startup source evidence paths, temporary owner template artifact absence, HANDOFF current summary, strict completion report rows, strict completion report failed gate verification notes, strict completion report owner lane command sets, completion audit alignment, completion audit open requirement external/owner boundary, completion audit markdown including source evidence rows, partial R8 linked owner attribution, current owner template README workflow guidance, and referenced evidence file paths with repo-root containment.'
const evidencePackVerifierSuccessCoverageItems = [
  'acceptance pack schemaVersion',
  'checkbox manifest schemaVersion',
  'ledger verification schemaVersion',
  'external blocker report schemaVersion',
  'completion status schemaVersion',
  'completion audit schemaVersion',
  'source hashes',
  'prompt manifests with filesystem-count parity',
  'task context JSONL coverage',
  'external blocker report JSON',
  'ledger verification JSON',
  'completion ledger markdown',
  'survey acceptance ledger markdown',
  'acceptance pack markdown including failed gate verification notes',
  'prompt-to-artifact machine evidence fields and JSON pointer targets',
  'checkbox manifest',
  'checkbox manifest markdown',
  'owner action queue',
  'owner action queue markdown rows',
  'owner verification command notes across queue/raw/submission templates',
  'current owner template JSON files',
  'raw owner evidence template schemaVersion',
  'owner closure bundles with verification command notes',
  'benchmark evidence schemas',
  'completion status',
  'completion status markdown sections',
  'completion status owner lane command sets',
  'completion status failed external gate command sets with verification notes',
  'manual testing dual-running-surface docs',
  'startup config dual-running-surface contract',
  'completion audit startup source evidence paths',
  'temporary owner template artifact absence',
  'HANDOFF current summary',
  'strict completion report rows',
  'strict completion report failed gate verification notes',
  'strict completion report owner lane command sets',
  'completion audit',
  'completion audit open requirement external/owner boundary',
  'completion audit markdown source evidence rows',
  'owner template README workflow',
  'referenced evidence file paths with repo-root containment'
]
const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu
const windowsServiceVerificationCommandNote = "Windows Service evidence must come from a real elevated DevHub service flow: run DevHub from an Administrator Windows session, invoke window.devhub.watchdog.supervisorInstallService(true, '<real operator identity>') through the preload bridge or equivalent application control path, accept the UAC prompt, then rerun pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json and preserve admin.isAdministrator=true, service.installed=true, service.scExitCode=0, and service.status. Do not close from a dry-run command plan, service-name assumption, or non-admin report. Final closure should rerun pnpm --silent check:0503-strict:vd-watch."
const zeroEgressVerificationCommandNote = 'Zero-egress evidence must come from a real Administrator Windows shell with pktmon.exe available: run pnpm -C devhub check:zero-egress-capture without --preflight, preserve the generated devhub-zero-egress-capture-v1 JSON report with blocked=false, passed=true, durationSeconds>=60, preflight.ready=true, and either packetCount=0 or appScopedPassed=true with processNetwork.nonLoopbackEndpointCount=0. Whole-machine globalPacketCount may be nonzero when unrelated background traffic exists, but it must be retained in the report. Do not close from preflight output, packet-count assumptions, hidden global counter edits, or non-admin reports. Final closure should rerun pnpm --silent check:0503-strict:vd-watch.'
const secondDisplayVerificationCommandNote = 'BrowserWindow placement evidence must come from the real current Windows display topology: run pnpm -C devhub check:browserwindow-second-display, preserve the generated devhub-browserwindow-second-display-v1 JSON report with blocked=false, passed=true, displayCount>=1, targetMode as secondary-display or single-display-fallback, placement.targetDisplayMatched=true, and placement.browserWindowInsideTargetWorkArea=true, then rerun pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json. Do not close from virtual-display notes, registry-only monitor counts, screenshots without the BrowserWindow report, display enumeration alone, or stale reports. Final closure should rerun pnpm --silent check:0503-strict:vd-watch.'
const physicalMonitorVerificationCommandNote = 'Display continuity evidence must use the real current Windows display topology: run pnpm -C devhub check:physical-monitor-hotplug, preserve the generated devhub-physical-monitor-hotplug-v1 JSON report with blocked=false, passed=true, durationSeconds>=10, and either physical hotplug fields proving baselineDisplayCount>=2 with removal/reconnection or targetMode=single-display-fallback with stable baseline/min/final displayCount=1. Do not close from registry-only evidence, fake display sources, screenshots without generated JSON, or stale reports. Final closure should rerun pnpm --silent check:0503-strict:vd-watch.'
const trueVdSwitchVerificationCommandNote = 'Virtual desktop switch evidence must come from the real Windows virtual desktop watch path in the same shell: set DEVHUB_R8_VD_FOREGROUND_WATCH=1 or run pnpm --silent check:0503-strict:vd-watch, keep at least two registry-backed Windows virtual desktops, perform a real foreground desktop switch during the verification window, and preserve the fresh r8-external-blockers-current.json row with registryDesktopCount>=2 and foregroundHookOptIn=true. Do not close from registry count alone, static desktop IDs, screenshots, or a report generated without foreground-watch opt-in.'
const adminShellVerificationCommandNote = 'Administrator evidence must come from the same real Windows shell/session used for the privileged R8.C checks: rerun pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json and preserve admin.user plus admin.isAdministrator=true in the fresh report. Do not close from a non-elevated shell, copied username, or UAC prompt screenshot without the probe report. Final closure should rerun pnpm --silent check:0503-strict:vd-watch.'
const surveyContextVerificationCommandNote = 'Survey-context evidence must come from a real product owner review of prompts/0503/14-three-graph-systems-survey.md and its linked survey rows: submit a dated decision file that identifies the reviewer, source rows, accepted scope, and remaining blockers. Do not close from generated ledger counts, agent summaries, or template-only intake files. Final closure should rerun pnpm --silent check:0503-strict:vd-watch.'
const userProductAcceptanceVerificationCommandNote = 'User-product acceptance evidence must be an actual acceptance record from the user/product owner after reviewing current runtime artifacts: include reviewer identity, date, accepted scope, known blockers, and explicit approval or rejection. Do not close from internal QA notes, screenshots alone, generated reports without reviewer sign-off, or unreviewed checklist rows. Final closure should rerun pnpm --silent check:0503-strict:vd-watch.'
const hardwareVerificationCommandNote = 'Hardware-verification checkbox closure evidence must link every hardware-dependent open checkbox row to real hardware run artifacts, including second-display or physical hotplug reports where applicable. Do not close from capability assumptions, static inventory, virtual display notes, screenshots without generated verifier JSON, or stale checklist rows. Final closure should rerun pnpm --silent check:0503-strict:vd-watch.'
const adminServiceVerificationCommandNote = 'Admin-service checkbox closure evidence must be collected in a real elevated Windows session and link every admin/service open checkbox row to the administrator and Windows Service reports. Do not close from dry-run service command plans, non-elevated shell output, copied service names, or generic operator intent. Final closure should rerun pnpm --silent check:0503-strict:vd-watch.'
const manualTestingDualRunningSurfaceRequiredTexts = [
  '- [ ] Development mode `pnpm dev` starts two expected surfaces: the `electron-vite dev` renderer dev server and the Electron main desktop process; this is not a duplicate backend.',
  '- [ ] If DevHub starts a managed project, the log panel shows that child process stdout/stderr; using open terminal can additionally launch a separate `powershell.exe -NoExit` window.',
  '- [ ] Record port ownership only after checking the owning process; for example local `127.0.0.1:3001` can be owned by Docker Desktop and must not be attributed to DevHub without process evidence.'
]
const devhubStartupDualRunningSurfaceConfigTexts = [
  'main: {',
  'preload: {',
  'renderer: {',
  'server: {',
  "host: '127.0.0.1'"
]
const requiredCompletionAuditSourceEvidencePaths = [
  relativeRepoPath(devhubManualTestingChecklistPath),
  relativeRepoPath(devhubPackageJsonPath),
  relativeRepoPath(devhubElectronViteConfigPath)
]
const temporaryOwnerTemplateArtifactPaths = [
  '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/_tmp-submission-templates',
  '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/_tmp-raw-evidence-templates'
]
const requiredTaskContextFiles = [
  'prompts/0503-2/00-r8-implementation-quickstart.md',
  'prompts/0503-2/00-r8-master-prd.md',
  '.trellis/tasks/archive/2026-05/05-03-r8-prd-spec-batches/HANDOFF.md',
  'prompts/0503-2/_shared/testing-strategy.md',
  'prompts/0503-2/_shared/zod-schemas.md',
  'prompts/0503-2/R8.A/prd.md',
  'prompts/0503-2/R8.B/prd.md',
  'prompts/0503-2/R8.C/prd.md',
  '.trellis/spec/backend/quality-guidelines.md',
  '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md'
]

const selfTest = process.argv.includes('--self-test')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEvidencePackVerifierRequirement(row) {
  assert(row?.requirement === evidencePackVerifierRequirement, 'completion audit evidence pack verifier requirement mismatch')
}

function formatCoverageItems(items) {
  assert(Array.isArray(items) && items.length > 1, 'coverage item list must contain at least two entries')
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function buildEvidencePackVerificationPassedMessage(pathLikeJsonPointerCount) {
  return `0503 evidence pack verification passed: ${formatCoverageItems([...evidencePackVerifierSuccessCoverageItems, `${pathLikeJsonPointerCount} path-like JSON pointer targets are consistent`])}.`
}

function deepSortValue(value) {
  if (Array.isArray(value)) return value.map(deepSortValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, deepSortValue(value[key])]))
  }
  return value
}

function normalizedJson(value) {
  return JSON.stringify(deepSortValue(value))
}

function renderedMarkdownCell(value) {
  return String(value ?? '')
    .replace(emojiPattern, '')
    .replaceAll('|', '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateMarkdownValue(value, maxLength = 300) {
  const text = renderedMarkdownCell(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function renderedMarkdownRow(cells) {
  return `| ${cells.map(renderedMarkdownCell).join(' | ')} |`
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function readText(filePath) {
  assert(existsSync(filePath), `missing evidence artifact: ${filePath}`)
  return readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(readText(filePath))
}

function readJsonl(filePath) {
  return readText(filePath)
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`${filePath} line ${index + 1} is not valid JSON: ${error.message}`)
      }
    })
}

function verifyTaskContextRows(label, rows, options = {}) {
  const verifyPaths = options.verifyPaths !== false
  assert(Array.isArray(rows) && rows.length > 0, `${label} must contain JSONL context rows`)
  const seenFiles = new Set()
  for (const [index, row] of rows.entries()) {
    assert(typeof row.file === 'string' && row.file.length > 0, `${label} row ${index + 1} missing file`)
    assert(typeof row.reason === 'string' && row.reason.length > 0, `${label} row ${index + 1} missing reason`)
    assert(!seenFiles.has(row.file), `${label} duplicate context file: ${row.file}`)
    seenFiles.add(row.file)
    if (verifyPaths) {
      const resolvedPath = resolve(repoRoot, row.file)
      assert(resolvedPath.startsWith(resolve(repoRoot)), `${label} context file escapes repo root: ${row.file}`)
      assert(existsSync(resolvedPath), `${label} context file does not exist: ${row.file}`)
    }
  }
  for (const requiredFile of requiredTaskContextFiles) {
    assert(seenFiles.has(requiredFile), `${label} missing required context file: ${requiredFile}`)
  }
}

function verifyTaskContextJsonl() {
  verifyTaskContextRows('implement.jsonl', readJsonl(implementContextJsonlPath))
  verifyTaskContextRows('check.jsonl', readJsonl(checkContextJsonlPath))
}

function assertOwnerTemplateReadmeWorkflowText(readme, label) {
  assert(readme.includes('These files are `templateOnly` scaffolds.'), `${label} README missing templateOnly boundary`)
  assert(readme.includes('Do not validate this template directory directly as evidence.'), `${label} README missing direct-validation refusal`)
  assert(readme.includes('Recommended workflow:'), `${label} README missing recommended workflow`)
  assert(readme.includes('pnpm --silent check:0503-owner-evidence -- --next-owner-commands --owner <owner>'), `${label} README missing next-owner command`)
  assert(readme.includes('pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>'), `${label} README missing evidence hash command`)
  assert(readme.includes('unknown fields are rejected'), `${label} README missing strict submission schema guidance`)
  assert(readme.includes('evidenceSha256'), `${label} README missing evidenceSha256 copy guidance`)
  assert(readme.includes('hashAlgorithm'), `${label} README missing hashAlgorithm copy guidance`)
  assert(readme.includes('evidenceModifiedAt'), `${label} README missing evidenceModifiedAt copy guidance`)
  assert(readme.includes('evidenceSizeBytes'), `${label} README missing evidenceSizeBytes copy guidance`)
  assert(readme.includes('pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>'), `${label} README missing readiness evidence-dir command`)
  assert(readme.includes('pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner <owner> --require-complete'), `${label} README missing require-complete command`)
  assert(readme.includes('pnpm --silent check:0503-strict:vd-watch'), `${label} README missing strict vd-watch rerun`)
}

function assertOwnerTemplateReadmeWorkflow(readmePath, label) {
  assertOwnerTemplateReadmeWorkflowText(readText(readmePath), label)
}

function expectedTemplateFileName(actionId, suffix) {
  assert(typeof actionId === 'string' && actionId.length > 0, 'owner template actionId must be a non-empty string')
  assert(!/[\\/]/.test(actionId), `owner template actionId must not contain path separators: ${actionId}`)
  return `${actionId}.${suffix}.json`
}

function readOwnerTemplateDirectory(dirPath, suffix) {
  assert(existsSync(dirPath), `missing owner template directory: ${dirPath}`)
  const fileNames = readdirSync(dirPath)
    .filter(fileName => fileName.endsWith(`.${suffix}.json`))
    .sort((left, right) => left.localeCompare(right))
  const templatesByActionId = new Map()
  for (const fileName of fileNames) {
    const actionId = fileName.slice(0, -`.${suffix}.json`.length)
    assert(!templatesByActionId.has(actionId), `duplicate owner template actionId in ${dirPath}: ${actionId}`)
    templatesByActionId.set(actionId, readJson(join(dirPath, fileName)))
  }
  return { fileNames, templatesByActionId }
}

function verifyOwnerTemplateDirectoryData(ownerActionQueue, submissionTemplatesByActionId, rawTemplatesByActionId, submissionFileNames, rawFileNames) {
  const actions = Array.isArray(ownerActionQueue.actions) ? ownerActionQueue.actions : []
  const expectedActionIds = actions.map(action => action.actionId).sort((left, right) => left.localeCompare(right))
  const expectedSubmissionFileNames = expectedActionIds.map(actionId => expectedTemplateFileName(actionId, 'submission-template'))
  const expectedRawFileNames = expectedActionIds.map(actionId => expectedTemplateFileName(actionId, 'raw-evidence-template'))
  assert(JSON.stringify(submissionFileNames) === JSON.stringify(expectedSubmissionFileNames), `current owner submission template files mismatch: expected ${expectedSubmissionFileNames.join(', ')}, got ${submissionFileNames.join(', ')}`)
  assert(JSON.stringify(rawFileNames) === JSON.stringify(expectedRawFileNames), `current owner raw evidence template files mismatch: expected ${expectedRawFileNames.join(', ')}, got ${rawFileNames.join(', ')}`)
  for (const action of actions) {
    const actionId = action.actionId
    const submissionTemplate = submissionTemplatesByActionId.get(actionId)
    const rawTemplate = rawTemplatesByActionId.get(actionId)
    assert(submissionTemplate, `missing current owner submission template for ${actionId}`)
    assert(rawTemplate, `missing current owner raw evidence template for ${actionId}`)
    assert(submissionTemplate.schemaVersion === 'devhub-0503-owner-evidence-submission-v1', `submission template schemaVersion mismatch for ${actionId}`)
    assert(submissionTemplate.templateOnly === true, `submission template must remain non-passable templateOnly for ${actionId}`)
    assert(submissionTemplate.owner === action.owner, `submission template owner mismatch for ${actionId}`)
	    assert(submissionTemplate.actionId === actionId, `submission template actionId mismatch for ${actionId}`)
	    assert(submissionTemplate.evidenceFilePath === '<repo-relative path to the real evidence file>', `submission template evidenceFilePath placeholder mismatch for ${actionId}`)
	    assert(submissionTemplate.evidenceModifiedAt === '<evidence file mtime from --hash-evidence output>', `submission template evidenceModifiedAt placeholder mismatch for ${actionId}`)
	    assert(submissionTemplate.evidenceSizeBytes === '<evidence file byte size from --hash-evidence output>', `submission template evidenceSizeBytes placeholder mismatch for ${actionId}`)
	    assert(submissionTemplate.evidenceSha256 === '<sha256 of evidenceFilePath contents>', `submission template evidenceSha256 placeholder mismatch for ${actionId}`)
	    assert(submissionTemplate.hashAlgorithm === 'sha256', `submission template hashAlgorithm mismatch for ${actionId}`)
	    assert(submissionTemplate.verificationCommand === action.verificationCommand, `submission template verificationCommand mismatch for ${actionId}`)
    assert(submissionTemplate.strictCompletionCommand === 'pnpm check:0503-strict', `submission template strictCompletionCommand mismatch for ${actionId}`)
    assert(submissionTemplate.recommendedStrictCompletionCommand === 'pnpm --silent check:0503-strict:vd-watch', `submission template recommended strict command mismatch for ${actionId}`)
    assert(submissionTemplate.resultSummary === '<pass/fail and measured values from the real run>', `submission template resultSummary placeholder mismatch for ${actionId}`)
    assert(submissionTemplate.evidenceTimestamp === '<ISO timestamp after the current owner action queue was generated>', `submission template evidenceTimestamp placeholder mismatch for ${actionId}`)
    assert(submissionTemplate.approverOrOperatorIdentity === '<real Windows identity, product owner, or legal owner>', `submission template approver placeholder mismatch for ${actionId}`)
    assert(submissionTemplate.boundaryStatement === '<what remains unclaimed; do not claim completion because strict completion remains authoritative>', `submission template boundary placeholder mismatch for ${actionId}`)
    assert(submissionTemplate.currentEvidence === action.currentEvidence, `submission template currentEvidence mismatch for ${actionId}`)
    assert(submissionTemplate.requiredEvidence === action.requiredEvidence, `submission template requiredEvidence mismatch for ${actionId}`)
    assert(submissionTemplate.unblockRule === action.unblockRule, `submission template unblockRule mismatch for ${actionId}`)
    assert((submissionTemplate.verificationCommandNote ?? '') === (action.verificationCommandNote ?? ''), `submission template verificationCommandNote mismatch for ${actionId}`)
    assert(rawTemplate.templateOnly === true, `raw evidence template must remain non-passable templateOnly for ${actionId}`)
    assert(rawTemplate.actionId === actionId, `raw evidence template actionId mismatch for ${actionId}`)
	    if (action.actionType === 'checkbox-closure-class') {
      assert(rawTemplate.schemaVersion === 'devhub-0503-checkbox-closure-evidence-v1', `checkbox raw evidence template schemaVersion mismatch for ${actionId}`)
      assert(rawTemplate.closureKind === action.closureKind, `checkbox raw evidence template closureKind mismatch for ${actionId}`)
      assert(rawTemplate.owner === action.owner, `checkbox raw evidence template owner mismatch for ${actionId}`)
      assert(rawTemplate.rowCount === action.count, `checkbox raw evidence template rowCount mismatch for ${actionId}`)
      assert(normalizedJson(rawTemplate.sourceFiles ?? {}) === normalizedJson(action.sourceFiles ?? {}), `checkbox raw evidence template sourceFiles mismatch for ${actionId}`)
      assert(rawTemplate.strictCompletionCommand === 'pnpm check:0503-strict', `checkbox raw evidence template strictCompletionCommand mismatch for ${actionId}`)
      assert(rawTemplate.recommendedStrictCompletionCommand === 'pnpm --silent check:0503-strict:vd-watch', `checkbox raw evidence template recommended strict command mismatch for ${actionId}`)
      assert(rawTemplate.decidedAt === '<ISO timestamp after current owner action queue generatedAt>', `checkbox raw evidence template decidedAt placeholder mismatch for ${actionId}`)
      assert(rawTemplate.decision === '<replace with real external owner review or approval decision>', `checkbox raw evidence template decision placeholder mismatch for ${actionId}`)
	      continue
	    }
	    assert(rawTemplate.schemaVersion === ownerRawEvidenceTemplateSchemaVersion, `raw evidence template schemaVersion mismatch for ${actionId}`)
	    assert(rawTemplate.note === 'Do not submit this template as evidence. Run the listed verification command and submit its real output or report.', `raw evidence template note mismatch for ${actionId}`)
    assert(rawTemplate.expectedVerificationCommand === action.verificationCommand, `raw evidence template expectedVerificationCommand mismatch for ${actionId}`)
    assert(rawTemplate.strictCompletionCommand === 'pnpm check:0503-strict', `raw evidence template strictCompletionCommand mismatch for ${actionId}`)
    assert(rawTemplate.recommendedStrictCompletionCommand === 'pnpm --silent check:0503-strict:vd-watch', `raw evidence template recommended strict command mismatch for ${actionId}`)
    assert(rawTemplate.requiredEvidence === action.requiredEvidence, `raw evidence template requiredEvidence mismatch for ${actionId}`)
    assert(rawTemplate.unblockRule === action.unblockRule, `raw evidence template unblockRule mismatch for ${actionId}`)
    assert((rawTemplate.verificationCommandNote ?? '') === (action.verificationCommandNote ?? ''), `raw evidence template verificationCommandNote mismatch for ${actionId}`)
  }
}

function verifyCurrentOwnerTemplateDirectories(ownerActionQueue) {
  assertOwnerTemplateReadmeWorkflow(ownerSubmissionTemplatesReadmePath, 'owner submission template')
  assertOwnerTemplateReadmeWorkflow(ownerRawEvidenceTemplatesReadmePath, 'raw evidence template')
  const submissionTemplates = readOwnerTemplateDirectory(ownerSubmissionTemplatesDirPath, 'submission-template')
  const rawTemplates = readOwnerTemplateDirectory(ownerRawEvidenceTemplatesDirPath, 'raw-evidence-template')
  verifyOwnerTemplateDirectoryData(
    ownerActionQueue,
    submissionTemplates.templatesByActionId,
    rawTemplates.templatesByActionId,
    submissionTemplates.fileNames,
    rawTemplates.fileNames
  )
}

function resolveRepoPath(relativePath) {
  assert(typeof relativePath === 'string' && relativePath.trim().length > 0, 'repo path must be a non-empty string')
  assert(!isAbsolute(relativePath), `repo path must be repo-relative: ${relativePath}`)
  const resolvedPath = resolve(resolvedRepoRoot, relativePath)
  const repoRelativePath = relative(resolvedRepoRoot, resolvedPath)
  assert(repoRelativePath === '' || (!repoRelativePath.startsWith('..') && !isAbsolute(repoRelativePath)), `repo path escapes repo root: ${relativePath}`)
  return resolvedPath
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

function assertCountMapEqual(actual, expected, label) {
  const actualKeys = Object.keys(actual ?? {}).sort()
  const expectedKeys = Object.keys(expected ?? {}).sort()
  assert(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), `${label} keys mismatch: expected ${expectedKeys.join(',')}, got ${actualKeys.join(',')}`)
  for (const key of expectedKeys) {
    assert(actual[key] === expected[key], `${label} count mismatch for ${key}: expected ${expected[key]}, got ${actual[key]}`)
  }
}

function expectedOwnerActionCommandSet(actionId) {
  return {
    actionDossierCommand: `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${actionId}`,
    rawEvidenceTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${actionId}`,
    submissionTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-template --action ${actionId}`
  }
}

function expectedSourceFileDossierCommand(actionId, filePath) {
  return `pnpm --silent check:0503-owner-evidence -- --source-file-dossier --action ${actionId} --file ${filePath}`
}

function withExpectedSourceFileCommands(sourceFiles, actionId) {
  if (!sourceFiles || !Array.isArray(sourceFiles.files)) return sourceFiles
  const commandSet = expectedOwnerActionCommandSet(actionId)
  return {
    ...sourceFiles,
    files: sourceFiles.files.map(row => ({
      ...row,
      ...commandSet,
      sourceFileDossierCommand: expectedSourceFileDossierCommand(actionId, row.file)
    }))
  }
}

function ownerForClosureKind(closureKind) {
  const ownerByClosureKind = {
    'admin-service-verification': 'operator',
    'hardware-verification': 'operator',
    'process-instruction': 'operator'
  }
  return ownerByClosureKind[closureKind] ?? 'agent'
}

function r8OpenClosureKindCounts(checkboxManifest) {
  if (checkboxManifest && typeof checkboxManifest.open05032ClosureKindCounts === 'object' && checkboxManifest.open05032ClosureKindCounts !== null) {
    return checkboxManifest.open05032ClosureKindCounts
  }
  const rows = Array.isArray(checkboxManifest.rows) ? checkboxManifest.rows : []
  return countBy(rows
    .filter(row => row.checked === false && String(row.file ?? '').startsWith('prompts/0503-2/'))
    .map(row => row.closureKind))
}

function r8OpenOwnerCounts(checkboxManifest) {
  if (checkboxManifest && typeof checkboxManifest.open05032OwnerCounts === 'object' && checkboxManifest.open05032OwnerCounts !== null) {
    return checkboxManifest.open05032OwnerCounts
  }
  const rows = Array.isArray(checkboxManifest.rows) ? checkboxManifest.rows : []
  return countBy(rows
    .filter(row => row.checked === false && String(row.file ?? '').startsWith('prompts/0503-2/'))
    .map(row => ownerForClosureKind(row.closureKind)))
}

function relativeRepoPath(filePath) {
  return relative(repoRoot, filePath).replaceAll('\\', '/')
}

function stripJsonPointerFromPath(evidencePath) {
  assert(typeof evidencePath === 'string' && evidencePath.trim().length > 0, 'evidence path must be a non-empty string')
  return evidencePath.split('#')[0]
}

function splitEvidencePointer(evidencePath) {
  assert(typeof evidencePath === 'string' && evidencePath.trim().length > 0, 'evidence path must be a non-empty string')
  const hashIndex = evidencePath.indexOf('#')
  if (hashIndex === -1) {
    return { filePath: evidencePath, jsonPointer: null }
  }
  return {
    filePath: evidencePath.slice(0, hashIndex),
    jsonPointer: evidencePath.slice(hashIndex + 1)
  }
}

function decodeJsonPointerToken(token) {
  return token.replaceAll('~1', '/').replaceAll('~0', '~')
}

function resolveJsonPointerValue(rootValue, jsonPointer, label) {
  if (jsonPointer === '') return rootValue
  assert(jsonPointer.startsWith('/'), `${label} JSON pointer must start with /`)
  let currentValue = rootValue
  for (const rawToken of jsonPointer.slice(1).split('/')) {
    const token = decodeJsonPointerToken(rawToken)
    if (Array.isArray(currentValue)) {
      assert(/^(0|[1-9]\d*)$/.test(token), `${label} JSON pointer array token is not a non-negative integer: ${token}`)
      const index = Number(token)
      assert(index < currentValue.length, `${label} JSON pointer array index out of range: ${token}`)
      currentValue = currentValue[index]
      continue
    }
    assert(currentValue !== null && typeof currentValue === 'object', `${label} JSON pointer cannot descend into non-object value at token: ${token}`)
    assert(Object.hasOwn(currentValue, token), `${label} JSON pointer missing token: ${token}`)
    currentValue = currentValue[token]
  }
  return currentValue
}

function verifyEvidencePathExists(evidencePath, label) {
  const { filePath, jsonPointer } = splitEvidencePointer(evidencePath)
  const absolutePath = resolveRepoPath(filePath)
  assert(existsSync(absolutePath), `${label} references missing evidence path: ${filePath}`)
  if (jsonPointer !== null) {
    assert(filePath.endsWith('.json'), `${label} references JSON pointer evidence in a non-JSON artifact: ${filePath}`)
    resolveJsonPointerValue(readJson(absolutePath), jsonPointer, label)
  }
}

function isPathLikeJsonPointerString(value) {
  return /^[-._/A-Za-z0-9]+\.json#(\/|$)/.test(value)
}

function collectPathLikeJsonPointerStrings(value, artifactLabel, objectPath = '$', output = []) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectPathLikeJsonPointerStrings(item, artifactLabel, `${objectPath}/${index}`, output)
    }
    return output
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = `${objectPath}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`
      if (typeof item === 'string' && isPathLikeJsonPointerString(item)) {
        output.push({ artifactLabel, evidencePath: item, objectPath: nextPath })
      }
      collectPathLikeJsonPointerStrings(item, artifactLabel, nextPath, output)
    }
  }
  return output
}

function verifyPathLikeJsonPointerStrings(artifacts) {
  const entries = artifacts.flatMap(({ label, value }) => collectPathLikeJsonPointerStrings(value, label))
  for (const entry of entries) {
    verifyEvidencePathExists(entry.evidencePath, `${entry.artifactLabel} ${entry.objectPath}`)
  }
  return entries.length
}

function verifyAcceptancePackSchemaVersion(pack) {
  assert(pack.schemaVersion === acceptancePackSchemaVersion, `acceptance pack schemaVersion must be ${acceptancePackSchemaVersion}`)
}

function verifyCheckboxManifestSchemaVersion(checkboxManifest) {
  assert(checkboxManifest.schemaVersion === checkboxManifestSchemaVersion, `checkbox manifest schemaVersion must be ${checkboxManifestSchemaVersion}`)
}

function verifyLedgerVerificationSchemaVersion(ledgerVerification) {
  assert(ledgerVerification.schemaVersion === ledgerVerificationSchemaVersion, `ledger verification schemaVersion must be ${ledgerVerificationSchemaVersion}`)
}

function verifyExternalBlockerReportSchemaVersion(externalReport) {
  assert(externalReport.schemaVersion === externalBlockerReportSchemaVersion, `external blocker report schemaVersion must be ${externalBlockerReportSchemaVersion}`)
}

function verifySourceEvidenceHashes(pack) {
  const sourceEvidence = Array.isArray(pack.sourceEvidence) ? pack.sourceEvidence : []
  assert(sourceEvidence.length > 0, 'acceptance pack has no sourceEvidence entries')
  const mismatches = []
  for (const source of sourceEvidence) {
    const filePath = resolveRepoPath(source.path)
    const currentHash = sha256(readText(filePath))
    if (currentHash !== source.sha256) {
      mismatches.push(`${source.path}: expected ${source.sha256}, got ${currentHash}`)
    }
  }
  assert(mismatches.length === 0, `stale sourceEvidence hashes:\n${mismatches.join('\n')}`)
}

function verifyPromptManifests(pack, checkboxManifest) {
  const prompt0503Rows = pack.promptArtifactManifest?.prompt0503Rows
  const prompt05032Rows = pack.promptArtifactManifest?.prompt05032Rows
  assert(Array.isArray(prompt0503Rows) && prompt0503Rows.length === 34, 'pack must contain 34 prompts/0503 promptArtifact rows')
  assert(Array.isArray(prompt05032Rows) && prompt05032Rows.length === 81, 'pack must contain 81 prompts/0503-2 promptArtifact rows')
  assert(pack.promptCheckboxManifest?.totalRows === checkboxManifest.totalRows, 'checkbox totalRows mismatch between pack and checkbox manifest')
  assert(pack.promptCheckboxManifest?.totalOpen === checkboxManifest.totalOpen, 'checkbox totalOpen mismatch between pack and checkbox manifest')
  assert(pack.promptCheckboxManifest?.totalChecked === checkboxManifest.totalChecked, 'checkbox totalChecked mismatch between pack and checkbox manifest')
  assert(pack.promptCheckboxManifest?.localClosurePossibleOpenRows === checkboxManifest.localClosurePossibleOpenRows, 'checkbox localClosurePossibleOpenRows mismatch between pack and checkbox manifest')
  assert(pack.promptCheckboxManifest?.localClosureBlockedOpenRows === checkboxManifest.localClosureBlockedOpenRows, 'checkbox localClosureBlockedOpenRows mismatch between pack and checkbox manifest')
  assert(JSON.stringify(r8OpenClosureKindCounts(pack.promptCheckboxManifest ?? {})) === JSON.stringify(r8OpenClosureKindCounts(checkboxManifest)), 'checkbox prompts/0503-2 open closure kind counts mismatch')
  assert(JSON.stringify(r8OpenOwnerCounts(pack.promptCheckboxManifest ?? {})) === JSON.stringify(r8OpenOwnerCounts(checkboxManifest)), 'checkbox prompts/0503-2 open owner counts mismatch')
}

function verifyExternalBlockerReport(pack, externalReport) {
  const sourcePath = relativeRepoPath(externalBlockerReportPath)
  assert((pack.sourceEvidence ?? []).some(source => source.path === sourcePath), 'acceptance pack sourceEvidence missing external blocker report')
  assert(typeof externalReport.generatedAt === 'string' && !Number.isNaN(Date.parse(externalReport.generatedAt)), 'external blocker report generatedAt must be an ISO timestamp')
  assert(externalReport.serviceName === 'devhub-watchdog', 'external blocker report serviceName mismatch')
  assert(Array.isArray(externalReport.displays), 'external blocker report displays must be an array')
  assert(externalReport.displays.length === pack.currentEnvironment?.displayCount, 'external blocker report display count must match acceptance pack currentEnvironment')
  assert(externalReport.admin?.user === pack.currentEnvironment?.adminUser, 'external blocker report admin user must match currentEnvironment')
  assert(externalReport.admin?.isAdministrator === pack.currentEnvironment?.isAdministrator, 'external blocker report administrator flag must match currentEnvironment')
  assert(externalReport.service?.installed === pack.currentEnvironment?.serviceInstalled, 'external blocker report service installed flag must match currentEnvironment')
  assert(externalReport.service?.status === pack.currentEnvironment?.serviceStatus, 'external blocker report service status must match currentEnvironment')
  assert(externalReport.virtualDesktops?.count === pack.currentEnvironment?.virtualDesktopCount, 'external blocker report virtual desktop count must match currentEnvironment')
  assert(typeof externalReport.projectLicense?.packageJsonLicense === 'string' || externalReport.projectLicense?.packageJsonLicense === null, 'external blocker report project license package field must be present')
  assert(typeof externalReport.projectLicense?.licenseFileExists === 'boolean', 'external blocker report project license file flag must be boolean')
	  assert(externalReport.zeroEgressPreflight?.ready === pack.currentEnvironment?.zeroEgressPreflightReady, 'external blocker report zero-egress preflight flag must match currentEnvironment')
	  assert(externalReport.zeroEgressPreflight?.administrator?.isAdministrator === pack.currentEnvironment?.isAdministrator, 'external blocker report zero-egress admin flag must match currentEnvironment')
	  assert(typeof externalReport.browserWindowSecondDisplay?.valid === 'boolean', 'external blocker report BrowserWindow second-display validity must be boolean')
	  assert(typeof externalReport.physicalMonitorHotplug?.valid === 'boolean', 'external blocker report physical monitor hotplug validity must be boolean')
	  assert(typeof externalReport.zeroEgressCapture?.valid === 'boolean', 'external blocker report zero-egress capture validity must be boolean')
	  if (externalReport.browserWindowSecondDisplay.valid === true) {
	    assert(Number(externalReport.browserWindowSecondDisplay.displayCount) >= 1, 'valid BrowserWindow placement report must include displayCount>=1')
	    assert(
	      externalReport.browserWindowSecondDisplay.targetMode === 'secondary-display' ||
	      externalReport.browserWindowSecondDisplay.targetMode === 'single-display-fallback',
	      'valid BrowserWindow placement report must include secondary-display or single-display-fallback targetMode'
	    )
	    assert(externalReport.browserWindowSecondDisplay.matchedDisplayId === externalReport.browserWindowSecondDisplay.targetDisplayId, 'valid BrowserWindow second-display report must match the target display')
	  }
	  if (externalReport.physicalMonitorHotplug.valid === true) {
	    const physicalHotplugPass = Number(externalReport.physicalMonitorHotplug.baselineDisplayCount) >= 2 &&
	      Number(externalReport.physicalMonitorHotplug.minDisplayCount) < Number(externalReport.physicalMonitorHotplug.baselineDisplayCount) &&
	      Number(externalReport.physicalMonitorHotplug.finalDisplayCount) >= Number(externalReport.physicalMonitorHotplug.baselineDisplayCount)
	    const singleDisplayFallback = externalReport.physicalMonitorHotplug.singleDisplayFallback === true &&
	      externalReport.physicalMonitorHotplug.targetMode === 'single-display-fallback' &&
	      Number(externalReport.physicalMonitorHotplug.baselineDisplayCount) === 1 &&
	      Number(externalReport.physicalMonitorHotplug.minDisplayCount) === 1 &&
	      Number(externalReport.physicalMonitorHotplug.finalDisplayCount) === 1
	    assert(physicalHotplugPass || singleDisplayFallback, 'valid physical monitor report must include real hotplug evidence or single-display fallback stability')
	  }
	  if (externalReport.zeroEgressCapture.valid === true) {
	    const legacyGlobalPacketPass = externalReport.zeroEgressCapture.packetCount === 0
	    const appScopedPass = externalReport.zeroEgressCapture.appScopedPassed === true &&
	      externalReport.zeroEgressCapture.nonLoopbackEndpointCount === 0
	    assert(legacyGlobalPacketPass || appScopedPass, 'valid zero-egress capture report must include packetCount=0 or appScopedPassed=true with zero non-loopback endpoints')
	    assert(Number(externalReport.zeroEgressCapture.durationSeconds) >= 60, 'valid zero-egress capture report must include durationSeconds>=60')
	  }
	  const expectedGateIds = [
    'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
    'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
    'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY',
    'R8C_SPEC17_ADMIN_SHELL',
    'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED',
    'H1_J16_ZERO_EGRESS_CAPTURE_READY'
  ]
  const gates = Array.isArray(externalReport.gates) ? externalReport.gates : []
  const actualGateIds = gates.map(gate => gate.id).sort((left, right) => left.localeCompare(right))
  assert(JSON.stringify(actualGateIds) === JSON.stringify([...expectedGateIds].sort((left, right) => left.localeCompare(right))), `external blocker report gate ids mismatch: expected ${expectedGateIds.join(',')}, got ${actualGateIds.join(',')}`)
  const gatesById = new Map(gates.map(gate => [gate.id, gate]))
  const trueVdSwitchGate = gatesById.get('R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY')
  const trueVdSwitchEvidence = String(trueVdSwitchGate?.evidence ?? '')
  const trueVdSwitchEvidenceMatch = trueVdSwitchEvidence.match(/^registryDesktopCount=(\d+); foregroundHookOptIn=(true|false)$/)
  assert(trueVdSwitchEvidenceMatch, 'external blocker report true VD switch evidence must expose registryDesktopCount and foregroundHookOptIn')
  const trueVdSwitchRegistryCount = Number(trueVdSwitchEvidenceMatch[1])
  const trueVdSwitchForegroundOptIn = trueVdSwitchEvidenceMatch[2] === 'true'
  assert(trueVdSwitchRegistryCount === externalReport.virtualDesktops?.count, 'external blocker report true VD switch count must match virtualDesktops.count')
  assert(trueVdSwitchGate?.passed === (trueVdSwitchRegistryCount >= 2 && trueVdSwitchForegroundOptIn), 'external blocker report true VD switch passed flag must match current environment evidence')
  assert(gatesById.get('ASSERT_BROWSERWINDOW_SECOND_DISPLAY')?.runbook?.verificationCommand === 'pnpm -C devhub check:browserwindow-second-display', 'external blocker report second-display gate must use BrowserWindow verifier command')
  const browserWindowGateEvidence = String(gatesById.get('ASSERT_BROWSERWINDOW_SECOND_DISPLAY')?.evidence ?? '')
  assert(
    browserWindowGateEvidence.includes(`targetMode=${externalReport.browserWindowSecondDisplay.targetMode}`) &&
    browserWindowGateEvidence.includes(`targetDisplayId=${externalReport.browserWindowSecondDisplay.targetDisplayId}`) &&
    browserWindowGateEvidence.includes(`matchedDisplayId=${externalReport.browserWindowSecondDisplay.matchedDisplayId}`),
    'external blocker report second-display gate evidence must include BrowserWindow targetMode and display ids'
  )
  const physicalMonitorGateEvidence = String(gatesById.get('R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY')?.evidence ?? '')
  assert(
    physicalMonitorGateEvidence.includes(`targetMode=${externalReport.physicalMonitorHotplug.targetMode}`) &&
    physicalMonitorGateEvidence.includes(`baselineDisplayCount=${externalReport.physicalMonitorHotplug.baselineDisplayCount}`) &&
    physicalMonitorGateEvidence.includes(`minDisplayCount=${externalReport.physicalMonitorHotplug.minDisplayCount}`) &&
    physicalMonitorGateEvidence.includes(`finalDisplayCount=${externalReport.physicalMonitorHotplug.finalDisplayCount}`),
    'external blocker report physical hotplug gate evidence must include targetMode and sampled display counts'
  )
  assert(String(gatesById.get('R8C_SPEC17_WINDOWS_SERVICE_INSTALLED')?.evidence ?? '').includes(`scExitCode=${externalReport.service.scExitCode}`), 'external blocker report service gate evidence must include scExitCode')
  assert(String(gatesById.get('H1_J16_ZERO_EGRESS_CAPTURE_READY')?.evidence ?? '').includes(`captureValid=${externalReport.zeroEgressCapture.valid}`), 'external blocker report zero-egress gate evidence must include capture validity')
  for (const gate of gates) {
    assert(typeof gate.passed === 'boolean', `external blocker gate ${gate.id} passed must be boolean`)
    assert(typeof gate.evidence === 'string' && gate.evidence.length > 0, `external blocker gate ${gate.id} evidence must be non-empty`)
    const runbook = gate.runbook ?? {}
    for (const field of ['blockerKind', 'owner', 'prerequisite', 'verificationCommand', 'requiredEvidence', 'unblockRule']) {
      assert(typeof runbook[field] === 'string' && runbook[field].length > 0, `external blocker gate ${gate.id} runbook.${field} must be non-empty`)
    }
  }
  const failedReportGates = gates.filter(gate => gate.passed === false).map(gate => ({
    evidence: gate.evidence,
    id: gate.id,
    runbook: gate.runbook
  }))
  const failedPackGates = (pack.failedExternalGates ?? []).map(gate => ({
    evidence: gate.evidence,
    id: gate.id,
    runbook: gate.runbook
  }))
  assert(normalizedJson(failedReportGates) === normalizedJson(failedPackGates), 'external blocker report failed gates must match acceptance pack failedExternalGates external-report fields')
  for (const gate of pack.failedExternalGates ?? []) {
    assert(typeof gate.verificationCommandNote === 'string' && gate.verificationCommandNote.length > 0, `acceptance pack failed gate verificationCommandNote missing: ${gate.id}`)
  }
  assert(externalReport.passed === gates.every(gate => gate.passed === true), 'external blocker report passed flag must equal all gate pass result')
}

function countRowsBy(rows, key) {
  return countBy((rows ?? []).map(row => row[key]))
}

function sumRowsBy(rows, key) {
  return (rows ?? []).reduce((sum, row) => sum + (Number.isFinite(row[key]) ? row[key] : 0), 0)
}

function displayPromptPath(filePath) {
  return String(filePath ?? '').replaceAll('/', '\\')
}

function verifyLedgerVerificationReport(pack, externalReport, ledgerVerification) {
  const sourcePath = relativeRepoPath(ledgerVerificationJsonPath)
  assert((pack.sourceEvidence ?? []).some(source => source.path === sourcePath), 'acceptance pack sourceEvidence missing ledger verification report')
  assert(typeof ledgerVerification.generatedAt === 'string' && !Number.isNaN(Date.parse(ledgerVerification.generatedAt)), 'ledger verification generatedAt must be an ISO timestamp')
  const completionLedger = ledgerVerification.completionLedger ?? {}
  assert(completionLedger.expectedMarkdownFiles === 81, 'ledger verification completionLedger expectedMarkdownFiles must be 81')
  assert(completionLedger.ledgerRows === 81, 'ledger verification completionLedger ledgerRows must be 81')
  assert(Array.isArray(completionLedger.rows) && completionLedger.rows.length === 81, 'ledger verification completionLedger rows must contain 81 rows')
  assert((completionLedger.missingRows ?? []).length === 0, 'ledger verification completionLedger missingRows must be empty')
  assert((completionLedger.extraRows ?? []).length === 0, 'ledger verification completionLedger extraRows must be empty')
  assert(normalizedJson(countRowsBy(completionLedger.rows, 'evidenceStatus')) === normalizedJson(completionLedger.evidenceStatusCounts ?? {}), 'ledger verification completionLedger evidenceStatusCounts must match rows')
  assert(completionLedger.ledgerRows === pack.summary.prompt05032LedgerRows, 'ledger verification completion ledger rows must match acceptance pack summary')
  assert(completionLedger.expectedMarkdownFiles === pack.summary.prompt05032MarkdownFiles, 'ledger verification completion markdown count must match acceptance pack summary')
  assert(normalizedJson(completionLedger.rows) === normalizedJson(pack.promptArtifactManifest?.prompt05032Rows ?? []), 'ledger verification completion rows must match acceptance pack prompt05032Rows')

  const surveyLedger = ledgerVerification.surveyLedger ?? {}
  assert(surveyLedger.expectedMarkdownFiles === 34, 'ledger verification surveyLedger expectedMarkdownFiles must be 34')
  assert(surveyLedger.ledgerRows === 34, 'ledger verification surveyLedger ledgerRows must be 34')
  assert(Array.isArray(surveyLedger.rows) && surveyLedger.rows.length === 34, 'ledger verification surveyLedger rows must contain 34 rows')
  assert((surveyLedger.missingRows ?? []).length === 0, 'ledger verification surveyLedger missingRows must be empty')
  assert((surveyLedger.extraRows ?? []).length === 0, 'ledger verification surveyLedger extraRows must be empty')
  assert(normalizedJson(countRowsBy(surveyLedger.rows, 'evidenceStatus')) === normalizedJson(surveyLedger.evidenceStatusCounts ?? {}), 'ledger verification surveyLedger evidenceStatusCounts must match rows')
  assert(normalizedJson(countRowsBy(surveyLedger.rows, 'status')) === normalizedJson(surveyLedger.statusCounts ?? {}), 'ledger verification surveyLedger statusCounts must match rows')
  assert(surveyLedger.ledgerRows === pack.summary.prompt0503LedgerRows, 'ledger verification survey ledger rows must match acceptance pack summary')
  assert(surveyLedger.expectedMarkdownFiles === pack.summary.prompt0503MarkdownFiles, 'ledger verification survey markdown count must match acceptance pack summary')
  assert(normalizedJson(surveyLedger.rows) === normalizedJson(pack.promptArtifactManifest?.prompt0503Rows ?? []), 'ledger verification survey rows must match acceptance pack prompt0503Rows')

  const externalGates = Array.isArray(externalReport.gates) ? externalReport.gates : []
  const externalReportSummary = ledgerVerification.blockers?.externalReport ?? {}
  assert(externalReportSummary.path === 'research/r8-external-blockers-current.json', 'ledger verification external report path mismatch')
  assert(externalReportSummary.fresh === pack.summary.externalReportFresh, 'ledger verification external report freshness mismatch')
  assert(externalReportSummary.passed === externalReport.passed, 'ledger verification external report passed mismatch')
  assert(normalizedJson(externalReportSummary.failedGateIds ?? []) === normalizedJson(externalGates.filter(gate => !gate.passed).map(gate => gate.id)), 'ledger verification external failedGateIds mismatch')
  assert(normalizedJson(externalReportSummary.passedGateIds ?? []) === normalizedJson(externalGates.filter(gate => gate.passed).map(gate => gate.id)), 'ledger verification external passedGateIds mismatch')
  assert((externalReportSummary.missingGateIds ?? []).length === 0, 'ledger verification external missingGateIds must be empty')
  assert((externalReportSummary.runbookMissingFields ?? []).length === 0, 'ledger verification external runbookMissingFields must be empty')

  const strictCompletion = ledgerVerification.strictCompletion ?? {}
  assert(strictCompletion.checked === pack.summary.strictCompletionChecked, 'ledger verification strictCompletion checked mismatch')
  assert(strictCompletion.passed === pack.summary.strictCompletionPassed, 'ledger verification strictCompletion passed mismatch')
  assert(strictCompletion.externalReportFresh === pack.summary.externalReportFresh, 'ledger verification strictCompletion externalReportFresh mismatch')
  assert((strictCompletion.missingEvidenceRows ?? []).length === pack.summary.missingEvidenceRowCount, 'ledger verification strictCompletion missing evidence row count mismatch')
  const packFailedExternalGateReportFields = (pack.failedExternalGates ?? []).map(gate => ({
    evidence: gate.evidence,
    id: gate.id,
    runbook: gate.runbook
  }))
  assert(normalizedJson(strictCompletion.failedExternalGateDetails ?? []) === normalizedJson(packFailedExternalGateReportFields), 'ledger verification strictCompletion failedExternalGateDetails mismatch')
  assert(normalizedJson(strictCompletion.failedExternalGateIds ?? []) === normalizedJson((pack.failedExternalGates ?? []).map(gate => gate.id)), 'ledger verification strictCompletion failedExternalGateIds mismatch')
  assert(normalizedJson(strictCompletion.partialRowDetails ?? []) === normalizedJson(pack.partialR8Rows ?? []), 'ledger verification strictCompletion partialRowDetails mismatch')
  assert(normalizedJson(strictCompletion.partialRows ?? []) === normalizedJson((pack.partialR8Rows ?? []).map(row => row.file)), 'ledger verification strictCompletion partialRows mismatch')
  assert(normalizedJson(strictCompletion.surveyAcceptanceRows ?? []) === normalizedJson(pack.surveyAcceptanceRows ?? []), 'ledger verification strictCompletion surveyAcceptanceRows mismatch')
  const guard = strictCompletion.guard ?? {}
  assert(guard.completionLedgerComplete === true, 'ledger verification strict guard completionLedgerComplete must be true')
  assert(guard.surveyLedgerComplete === true, 'ledger verification strict guard surveyLedgerComplete must be true')
  assert(guard.requiredExternalGatesPresent === true, 'ledger verification strict guard requiredExternalGatesPresent must be true')
  assert(guard.externalGateRunbookComplete === true, 'ledger verification strict guard externalGateRunbookComplete must be true')
  assert(guard.externalGatesPassed === (pack.summary.failedExternalGateCount === 0), 'ledger verification strict guard externalGatesPassed mismatch')
  assert(guard.partialR8RowsClosed === (pack.summary.partialR8RowCount === 0), 'ledger verification strict guard partialR8RowsClosed mismatch')
  assert(guard.surveyAcceptanceRowsClosed === (pack.summary.surveyAcceptanceRowCount === 0), 'ledger verification strict guard surveyAcceptanceRowsClosed mismatch')
  assert(guard.missingEvidenceRowsClosed === (pack.summary.missingEvidenceRowCount === 0), 'ledger verification strict guard missingEvidenceRowsClosed mismatch')
}

function verifyCompletionLedgerMarkdownText(markdown, pack, ledgerVerification) {
  const sourcePath = relativeRepoPath(completionLedgerMarkdownPath)
  assert((pack.sourceEvidence ?? []).some(source => source.path === sourcePath), 'acceptance pack sourceEvidence missing completion ledger markdown')
  const completionLedger = ledgerVerification.completionLedger ?? {}
  const rows = Array.isArray(completionLedger.rows) ? completionLedger.rows : []
  assert(rows.length === 81, 'completion ledger markdown verifier expected 81 rows')
  const requiredTexts = [
    '# prompts/0503-2 Completion Ledger',
    '## Current Open Blocker Audit',
    'owner template README hash workflow',
    '`pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>`',
    '`evidenceSha256`',
    '`hashAlgorithm`',
    '`evidenceModifiedAt`',
    '`evidenceSizeBytes`',
    'owner-readiness, require-complete, and strict completion reruns',
    'This only hardens owner evidence collection instructions and does not close any strict external gate.'
  ]
  for (const requiredText of requiredTexts) {
    assert(markdown.includes(requiredText), `completion ledger markdown missing required text: ${requiredText}`)
  }
  assert(completionLedger.ledgerRows === rows.length, 'completion ledger markdown row count mismatch')
  assert(completionLedger.expectedMarkdownFiles === pack.summary.prompt05032MarkdownFiles, 'completion ledger markdown count mismatch')
  for (const row of rows) {
    assert(
      markdown.includes(renderedMarkdownRow([`\`${displayPromptPath(row.file)}\``, row.batch, row.openCheckboxes, row.checkedCheckboxes, row.implementationStatus, row.pendingMarkers, row.evidenceStatus, row.nextAction])),
      `completion ledger markdown missing file row: ${row.file}`
    )
  }
}

function verifyCompletionLedgerMarkdown(pack, ledgerVerification) {
  verifyCompletionLedgerMarkdownText(readText(completionLedgerMarkdownPath), pack, ledgerVerification)
}

function verifySurveyAcceptanceLedgerMarkdownText(markdown, pack, ledgerVerification) {
  const sourcePath = relativeRepoPath(surveyAcceptanceLedgerMarkdownPath)
  assert((pack.sourceEvidence ?? []).some(source => source.path === sourcePath), 'acceptance pack sourceEvidence missing survey acceptance ledger')
  const surveyLedger = ledgerVerification.surveyLedger ?? {}
  const rows = Array.isArray(surveyLedger.rows) ? surveyLedger.rows : []
  assert(rows.length === 34, 'survey acceptance ledger verifier expected 34 rows')
  const openTotal = sumRowsBy(rows, 'openCheckboxes')
  const checkedTotal = sumRowsBy(rows, 'checkedCheckboxes')
  const questionTotal = sumRowsBy(rows, 'questionMarkers')
  const requiredTexts = [
    '# prompts/0503 Survey and Acceptance Ledger',
    '## Objective',
    '## Summary',
    '## Contract Interpretation',
    '## File Ledger',
    '## Prompt To Artifact Checklist',
    '## Acceptance Evidence Bridges',
    'This file does not mark `prompts/0503` complete.',
    'Audit `prompts/0503` separately from the active `prompts/0503-2` R8 implementation ledger.',
    '`0503-2-completion-ledger.md` remains the implementation ledger',
    'Do not close final user acceptance by proxy',
    'Do not claim hardware/admin/zero-egress/license-gated requirements',
    renderedMarkdownRow(['`prompts/0503`', surveyLedger.expectedMarkdownFiles, openTotal, checkedTotal, questionTotal, 'Upstream survey plus final user acceptance context'])
  ]
  for (const requiredText of requiredTexts) {
    assert(markdown.includes(requiredText), `survey acceptance ledger markdown missing required text: ${requiredText}`)
  }
  assert(surveyLedger.ledgerRows === rows.length, 'survey acceptance ledger row count mismatch')
  assert(surveyLedger.expectedMarkdownFiles === pack.summary.prompt0503MarkdownFiles, 'survey acceptance ledger markdown count mismatch')
  assert(openTotal === 1301, `survey acceptance ledger open checkbox total drift: ${openTotal}`)
  assert(checkedTotal === 104, `survey acceptance ledger checked checkbox total drift: ${checkedTotal}`)
  assert(questionTotal === 1003, `survey acceptance ledger question marker total drift: ${questionTotal}`)
  assert(normalizedJson(countRowsBy(rows, 'evidenceStatus')) === normalizedJson(surveyLedger.evidenceStatusCounts ?? {}), 'survey acceptance ledger evidenceStatusCounts mismatch')
  assert(normalizedJson(countRowsBy(rows, 'status')) === normalizedJson(surveyLedger.statusCounts ?? {}), 'survey acceptance ledger statusCounts mismatch')
  const acceptanceRows = rows
    .filter(row => /acceptance/i.test(row.status))
    .map(row => ({ file: row.file, status: row.status }))
  assert(normalizedJson(acceptanceRows) === normalizedJson(surveyLedger.advisoryAcceptanceRows ?? []), 'survey acceptance ledger advisory acceptance rows mismatch')
  assert((pack.surveyAcceptanceRows ?? []).length === 0, 'legacy prompts/0503 survey rows must not block the active prompts/0503-2 R8 strict pack')
  for (const row of rows) {
    assert(
      markdown.includes(renderedMarkdownRow([`\`${displayPromptPath(row.file)}\``, row.openCheckboxes, row.checkedCheckboxes, row.questionMarkers, row.evidenceStatus, row.nextAction])),
      `survey acceptance ledger markdown missing file row: ${row.file}`
    )
  }
}

function verifySurveyAcceptanceLedgerMarkdown(pack, ledgerVerification) {
  verifySurveyAcceptanceLedgerMarkdownText(readText(surveyAcceptanceLedgerMarkdownPath), pack, ledgerVerification)
}

function verifyAcceptancePackMarkdownText(markdown, pack) {
  const summary = pack.summary ?? {}
  const promptArtifactManifest = pack.promptArtifactManifest ?? { prompt0503Rows: [], prompt05032Rows: [] }
  const promptCheckboxManifest = pack.promptCheckboxManifest ?? {}
  const requiredTexts = [
    '# 0503 Acceptance Evidence Pack',
    '## Summary',
    '## Source Evidence',
    '## Failed External Gate Actions',
    '## Failed Gate Owner Counts',
    '## Failed Gate Kind Counts',
    '## Open R8 0503-2 Checkbox Closure Kinds',
    '## Open R8 0503-2 Checkbox Owner Counts',
    '## Prompt Artifact Manifest',
    '## Partial R8 Rows',
    '## Survey Acceptance Rows',
    '## Non-Completion Boundary',
    `Schema version: ${acceptancePackSchemaVersion}`,
    `Acceptance status: ${pack.acceptanceStatus}`,
    `- Strict completion checked: ${summary.strictCompletionChecked}`,
    `- Strict completion passed: ${summary.strictCompletionPassed}`,
    `- prompts/0503 coverage: ${summary.prompt0503LedgerRows}/${summary.prompt0503MarkdownFiles}`,
    `- prompts/0503-2 coverage: ${summary.prompt05032LedgerRows}/${summary.prompt05032MarkdownFiles}`,
    `- Partial R8 rows: ${summary.partialR8RowCount}`,
    `- Missing evidence rows: ${summary.missingEvidenceRowCount}`,
    `- Failed external gates: ${summary.failedExternalGateCount}`,
    `- Survey acceptance rows: ${summary.surveyAcceptanceRowCount}`,
    `- External report fresh: ${summary.externalReportFresh}`,
    `- External gate runbook missing fields: ${(pack.externalGateRunbookCoverage?.missingFields ?? []).length}`,
    `- Machine-readable prompt artifact rows: ${(promptArtifactManifest.prompt0503Rows ?? []).length + (promptArtifactManifest.prompt05032Rows ?? []).length}`,
    `- Prompt checkbox rows: ${promptCheckboxManifest.totalRows}`,
    `- Open prompt checkbox rows: ${promptCheckboxManifest.totalOpen}`,
    `- Checked prompt checkbox rows: ${promptCheckboxManifest.totalChecked}`,
    `- Local-closure possible open rows: ${promptCheckboxManifest.localClosurePossibleOpenRows}`,
    `- Local-closure blocked open rows: ${promptCheckboxManifest.localClosureBlockedOpenRows}`,
    `- Machine-readable rows for prompts/0503: ${(promptArtifactManifest.prompt0503Rows ?? []).length}`,
    `- Machine-readable rows for prompts/0503-2: ${(promptArtifactManifest.prompt05032Rows ?? []).length}`,
    '- Full per-prompt row details are embedded in `0503-acceptance-pack.json` under `promptArtifactManifest`.',
    `- Full checkbox row details are written to \`${promptCheckboxManifest.jsonPath}\`.`
  ]
  for (const requiredText of requiredTexts) {
    assert(markdown.includes(requiredText), `acceptance pack markdown missing required text: ${requiredText}`)
  }
  if ((pack.failedExternalGates ?? []).length === 0) {
    assert(markdown.includes('No failed external gates.'), 'acceptance pack markdown must state no failed external gates when all external gates pass')
  } else {
    const failedExternalGateHeader = renderedMarkdownRow(['Gate', 'Kind', 'Owner', 'Current evidence', 'Prerequisite', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Required evidence', 'Unblock rule'])
    assert(markdown.includes(failedExternalGateHeader), `acceptance pack markdown missing required text: ${failedExternalGateHeader}`)
  }
  for (const row of pack.sourceEvidence ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([row.path, row.sizeBytes, row.modifiedAt, row.sha256])),
      `acceptance pack markdown missing source evidence row: ${row.path}`
    )
  }
  for (const gate of pack.failedExternalGates ?? []) {
    const runbook = gate.runbook ?? {}
    assert(markdown.includes(renderedMarkdownCell(gate.id)), `acceptance pack markdown missing failed gate id: ${gate.id}`)
    assert(markdown.includes(renderedMarkdownCell(runbook.owner)), `acceptance pack markdown missing failed gate owner: ${gate.id}`)
    assert(markdown.includes(renderedMarkdownCell(runbook.blockerKind)), `acceptance pack markdown missing failed gate kind: ${gate.id}`)
    assert(markdown.includes(truncateMarkdownValue(runbook.verificationCommand)), `acceptance pack markdown missing failed gate verification command: ${gate.id}`)
    assert(typeof gate.verificationCommandNote === 'string' && gate.verificationCommandNote.length > 0, `acceptance pack failed gate verification command note missing: ${gate.id}`)
    assert(markdown.includes(truncateMarkdownValue(gate.verificationCommandNote)), `acceptance pack markdown missing failed gate verification command note: ${gate.id}`)
    assert(markdown.includes(`pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${gate.id}`), `acceptance pack markdown missing failed gate action dossier command: ${gate.id}`)
    assert(markdown.includes(`pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${gate.id}`), `acceptance pack markdown missing failed gate raw evidence template command: ${gate.id}`)
    assert(markdown.includes(`pnpm --silent check:0503-owner-evidence -- --print-template --action ${gate.id}`), `acceptance pack markdown missing failed gate submission template command: ${gate.id}`)
    assert(markdown.includes(truncateMarkdownValue(runbook.requiredEvidence)), `acceptance pack markdown missing failed gate required evidence: ${gate.id}`)
    assert(markdown.includes(truncateMarkdownValue(runbook.unblockRule)), `acceptance pack markdown missing failed gate unblock rule: ${gate.id}`)
    assertMarkdownHasRow(
      markdown,
      [
        gate.id,
        runbook.blockerKind ?? '',
        runbook.owner ?? '',
        truncateMarkdownValue(gate.evidence),
        truncateMarkdownValue(runbook.prerequisite ?? ''),
        truncateMarkdownValue(runbook.verificationCommand ?? ''),
        truncateMarkdownValue(gate.verificationCommandNote),
        `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${gate.id}`,
        `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${gate.id}`,
        `pnpm --silent check:0503-owner-evidence -- --print-template --action ${gate.id}`,
        truncateMarkdownValue(runbook.requiredEvidence ?? ''),
        truncateMarkdownValue(runbook.unblockRule ?? '')
      ],
      `acceptance pack failed gate action row ${gate.id}`
    )
  }
  for (const [owner, count] of Object.entries(pack.failedGateOwnerCounts ?? {})) {
    assert(markdown.includes(renderedMarkdownRow([owner, count])), `acceptance pack markdown missing failed gate owner count: ${owner}`)
  }
  for (const [kind, count] of Object.entries(pack.failedGateKindCounts ?? {})) {
    assert(markdown.includes(renderedMarkdownRow([kind, count])), `acceptance pack markdown missing failed gate kind count: ${kind}`)
  }
  for (const [closureKind, count] of Object.entries(r8OpenClosureKindCounts(promptCheckboxManifest))) {
    assert(markdown.includes(renderedMarkdownRow([closureKind, count])), `acceptance pack markdown missing prompts/0503-2 open closure kind count: ${closureKind}`)
  }
  for (const [owner, count] of Object.entries(r8OpenOwnerCounts(promptCheckboxManifest))) {
    assert(markdown.includes(renderedMarkdownRow([owner, count])), `acceptance pack markdown missing prompts/0503-2 open owner count: ${owner}`)
  }
  for (const row of pack.partialR8Rows ?? []) {
    assert(markdown.includes(renderedMarkdownCell(row.file)), `acceptance pack markdown missing partial R8 row: ${row.file}`)
    assert(markdown.includes(truncateMarkdownValue(row.nextAction)), `acceptance pack markdown missing partial R8 next action: ${row.file}`)
  }
  for (const row of pack.surveyAcceptanceRows ?? []) {
    assert(markdown.includes(renderedMarkdownCell(row.file)), `acceptance pack markdown missing survey acceptance row: ${row.file}`)
    assert(markdown.includes(truncateMarkdownValue(row.status)), `acceptance pack markdown missing survey acceptance status: ${row.file}`)
  }
  for (const boundary of pack.nonCompletionBoundary ?? []) {
    assert(markdown.includes(`- ${boundary}`), `acceptance pack markdown missing non-completion boundary: ${boundary}`)
  }
}

function verifyAcceptancePackMarkdown(pack) {
  verifyAcceptancePackMarkdownText(readText(acceptancePackMarkdownPath), pack)
}

function verifyCheckboxManifestMarkdownText(markdown, checkboxManifest) {
  const scopeCounts = checkboxManifest.scopeCounts ?? {}
  const requiredTexts = [
    '# 0503 Checkbox Manifest',
    `Schema version: ${checkboxManifestSchemaVersion}`,
    '## Summary',
    '## Open Closure Classification',
    '## Open Owner Counts',
    '## Top Open Files',
    '## Operator Exact Open Rows',
    '## Legal-Product Exact Open Rows',
    '## Product And User Acceptance File Index',
    '## Non-Completion Boundary',
    '## Machine-Readable Details',
    `- Total checkbox rows: ${checkboxManifest.totalRows}`,
    `- Open checkbox rows: ${checkboxManifest.totalOpen}`,
    `- Checked checkbox rows: ${checkboxManifest.totalChecked}`,
    `- Local-closure possible open rows: ${checkboxManifest.localClosurePossibleOpenRows}`,
    `- Local-closure blocked open rows: ${checkboxManifest.localClosureBlockedOpenRows}`,
    `- prompts/0503 rows: ${scopeCounts['prompts/0503']?.total}`,
    `- prompts/0503 open rows: ${scopeCounts['prompts/0503']?.open}`,
    `- prompts/0503 checked rows: ${scopeCounts['prompts/0503']?.checked}`,
    `- prompts/0503-2 rows: ${scopeCounts['prompts/0503-2']?.total}`,
    `- prompts/0503-2 open rows: ${scopeCounts['prompts/0503-2']?.open}`,
    `- prompts/0503-2 checked rows: ${scopeCounts['prompts/0503-2']?.checked}`,
    '- Full checkbox rows are written to `0503-checkbox-manifest.json` under `rows`.',
    '- Each row includes `scope`, `file`, `line`, `heading`, `status`, `checked`, `text`, `textHash`, `closureKind`, `requiredOwner`, `localClosurePossible`, and `closureRationale`.',
    '- `openActionIndex` groups remaining rows by required owner, exact operator/legal rows, and product/user acceptance file counts.'
  ]
  for (const requiredText of requiredTexts) {
    assert(markdown.includes(requiredText), `checkbox manifest markdown missing required text: ${requiredText}`)
  }
  for (const [closureKind, count] of Object.entries(checkboxManifest.openClosureKindCounts ?? {})) {
    assert(markdown.includes(renderedMarkdownRow([closureKind, count])), `checkbox manifest markdown missing closure kind count: ${closureKind}`)
  }
  for (const [owner, count] of Object.entries(checkboxManifest.openOwnerCounts ?? {})) {
    assert(markdown.includes(renderedMarkdownRow([owner, count])), `checkbox manifest markdown missing owner count: ${owner}`)
  }
  for (const row of checkboxManifest.topOpenFiles ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([row.file, row.scope, row.open, row.checked, row.total])),
      `checkbox manifest markdown missing top open file row: ${row.file}`
    )
  }
  for (const row of checkboxManifest.openActionIndex?.operatorRows ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([row.file, row.line, row.closureKind, truncateMarkdownValue(row.text, 180), truncateMarkdownValue(row.closureRationale, 180)])),
      `checkbox manifest markdown missing operator exact row: ${row.file}:${row.line}`
    )
  }
  for (const row of checkboxManifest.openActionIndex?.legalProductRows ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([row.file, row.line, row.heading, truncateMarkdownValue(row.text, 180)])),
      `checkbox manifest markdown missing legal-product exact row: ${row.file}:${row.line}`
    )
  }
  for (const row of [
    ...(checkboxManifest.openActionIndex?.productFileCounts ?? []),
    ...(checkboxManifest.openActionIndex?.userProductFileCounts ?? [])
  ]) {
    assert(
      markdown.includes(renderedMarkdownRow([row.requiredOwner, row.closureKind, row.file, row.open])),
      `checkbox manifest markdown missing product/user file index row: ${row.requiredOwner}:${row.file}`
    )
  }
  for (const boundary of checkboxManifest.nonCompletionBoundary ?? []) {
    assert(markdown.includes(`- ${boundary}`), `checkbox manifest markdown missing non-completion boundary: ${boundary}`)
  }
}

function verifyCheckboxManifestMarkdown(checkboxManifest) {
  verifyCheckboxManifestMarkdownText(readText(checkboxManifestMarkdownPath), checkboxManifest)
}

function verifyCheckboxLocalClosureCounts(checkboxManifest) {
  const rows = Array.isArray(checkboxManifest.rows) ? checkboxManifest.rows : []
  const openRows = rows.filter(row => !row.checked)
  const expectedPossible = openRows.filter(row => row.localClosurePossible).length
  const expectedBlocked = openRows.filter(row => !row.localClosurePossible).length
  assert(Number.isInteger(checkboxManifest.localClosurePossibleOpenRows), 'checkbox manifest localClosurePossibleOpenRows must be an integer')
  assert(Number.isInteger(checkboxManifest.localClosureBlockedOpenRows), 'checkbox manifest localClosureBlockedOpenRows must be an integer')
  assert(checkboxManifest.localClosurePossibleOpenRows === expectedPossible, `checkbox manifest localClosurePossibleOpenRows mismatch: expected ${expectedPossible}, got ${checkboxManifest.localClosurePossibleOpenRows}`)
  assert(checkboxManifest.localClosureBlockedOpenRows === expectedBlocked, `checkbox manifest localClosureBlockedOpenRows mismatch: expected ${expectedBlocked}, got ${checkboxManifest.localClosureBlockedOpenRows}`)
  assert(checkboxManifest.localClosurePossibleOpenRows + checkboxManifest.localClosureBlockedOpenRows === checkboxManifest.totalOpen, 'checkbox manifest local closure counts must sum to totalOpen')
}

function summarizeOpenRowsByOwnerFile(rows) {
  const counts = new Map()
  for (const row of rows.filter(item => !item.checked)) {
    const key = `${row.requiredOwner}\u0000${row.closureKind}\u0000${row.file}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function summarizeOpenCheckboxSourceFiles(checkboxManifest, closureKind) {
  const rows = Array.isArray(checkboxManifest.rows) ? checkboxManifest.rows : []
  const fileCounts = countBy(rows
    .filter(row => !row.checked && row.closureKind === closureKind)
    .map(row => row.file))
  const files = Object.entries(fileCounts)
    .map(([file, count]) => ({ count, file }))
    .sort((left, right) => right.count - left.count || left.file.localeCompare(right.file))
  return {
    files,
    omittedFileCount: 0,
    totalFileCount: files.length
  }
}

function verifyCheckboxOpenActionIndex(checkboxManifest) {
  const rows = Array.isArray(checkboxManifest.rows) ? checkboxManifest.rows : []
  const openRows = rows.filter(row => !row.checked)
  const index = checkboxManifest.openActionIndex
  assert(index && typeof index === 'object', 'checkbox manifest missing openActionIndex')
  assert(Array.isArray(index.operatorRows), 'checkbox manifest openActionIndex.operatorRows must be an array')
  assert(Array.isArray(index.legalProductRows), 'checkbox manifest openActionIndex.legalProductRows must be an array')
  assert(Array.isArray(index.ownerFileCounts), 'checkbox manifest openActionIndex.ownerFileCounts must be an array')
  assert(Array.isArray(index.productFileCounts), 'checkbox manifest openActionIndex.productFileCounts must be an array')
  assert(Array.isArray(index.userProductFileCounts), 'checkbox manifest openActionIndex.userProductFileCounts must be an array')

  const expectedOperatorRows = openRows.filter(row => row.requiredOwner === 'operator').length
  const expectedLegalRows = openRows.filter(row => row.requiredOwner === 'legal-product').length
  assert(index.operatorRows.length === expectedOperatorRows, `operator openActionIndex mismatch: expected ${expectedOperatorRows}, got ${index.operatorRows.length}`)
  assert(index.legalProductRows.length === expectedLegalRows, `legal-product openActionIndex mismatch: expected ${expectedLegalRows}, got ${index.legalProductRows.length}`)

  const ownerFileCounts = summarizeOpenRowsByOwnerFile(rows)
  const indexedOpenTotal = index.ownerFileCounts.reduce((sum, row) => sum + row.open, 0)
  assert(indexedOpenTotal === checkboxManifest.totalOpen, `openActionIndex ownerFileCounts should sum to totalOpen: expected ${checkboxManifest.totalOpen}, got ${indexedOpenTotal}`)
  for (const row of index.ownerFileCounts) {
    const key = `${row.requiredOwner}\u0000${row.closureKind}\u0000${row.file}`
    assert(ownerFileCounts.get(key) === row.open, `openActionIndex ownerFileCounts mismatch for ${row.file} (${row.requiredOwner}/${row.closureKind})`)
  }
}

function verifyOwnerActionQueue(pack, checkboxManifest, ownerActionQueue) {
  assert(ownerActionQueue.acceptanceStatus === pack.acceptanceStatus, 'owner action queue acceptanceStatus does not match pack')
  assert(ownerActionQueue.schemaVersion === ownerActionQueueSchemaVersion, `owner action queue schemaVersion must be ${ownerActionQueueSchemaVersion}`)
  assert(JSON.stringify(ownerActionQueue.currentEnvironment) === JSON.stringify(pack.currentEnvironment), 'owner action queue currentEnvironment does not match pack')
  const actions = Array.isArray(ownerActionQueue.actions) ? ownerActionQueue.actions : []
  const failedGateOwners = (Array.isArray(pack.failedExternalGates) ? pack.failedExternalGates : []).map(gate => gate.runbook?.owner ?? 'unassigned')
  const checkboxClosureOwners = Object.keys(r8OpenClosureKindCounts(pack.promptCheckboxManifest ?? {})).map(ownerForClosureKind)
  const expectedOwnerCounts = countBy([...failedGateOwners, ...checkboxClosureOwners])
  const expectedActionCount = failedGateOwners.length + checkboxClosureOwners.length
  assert(actions.length === expectedActionCount, `owner action queue should contain ${expectedActionCount} actions, found ${actions.length}`)
  assertCountMapEqual(ownerActionQueue.ownerCounts ?? {}, expectedOwnerCounts, 'owner action queue ownerCounts')
  const ownerLaneCommands = Array.isArray(ownerActionQueue.ownerLaneCommands) ? ownerActionQueue.ownerLaneCommands : []
  const expectedOwners = Object.keys(expectedOwnerCounts).sort((left, right) => left.localeCompare(right))
  const actualLaneOwners = ownerLaneCommands.map(row => row.owner).sort((left, right) => left.localeCompare(right))
  assert(JSON.stringify(actualLaneOwners) === JSON.stringify(expectedOwners), `owner action queue ownerLaneCommands owners mismatch: expected ${expectedOwners.join(',')}, got ${actualLaneOwners.join(',')}`)
  for (const owner of expectedOwners) {
    const lane = ownerLaneCommands.find(row => row.owner === owner)
    assert(lane?.ownerReadinessCommand === `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`, `owner lane readiness command mismatch for ${owner}`)
    assert(lane?.ownerReadinessWithEvidenceDirCommand === `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`, `owner lane readiness evidence-dir command mismatch for ${owner}`)
    assert(lane?.ownerReadinessWithCoverageArtifactsCommand === `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md> --coverage-json <repo-relative-report.json>`, `owner lane readiness coverage artifacts command mismatch for ${owner}`)
    assert(lane?.ownerSummaryCommand === `pnpm --silent check:0503-owner-evidence -- --owner-summary --owner ${owner}`, `owner lane summary command mismatch for ${owner}`)
    assert(lane?.listActionsCommand === `pnpm --silent check:0503-owner-evidence -- --list-actions --owner ${owner}`, `owner lane list command mismatch for ${owner}`)
    assert(lane?.partialR8DossierCommand === `pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner ${owner}`, `owner lane partial R8 dossier command mismatch for ${owner}`)
    assert(lane?.submissionTemplateDirectoryCommand === `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner ${owner}`, `owner lane submission template dir command mismatch for ${owner}`)
    assert(lane?.rawEvidenceTemplateDirectoryCommand === `pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner ${owner}`, `owner lane raw evidence template dir command mismatch for ${owner}`)
    assert(lane?.requireCompleteCommand === `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --require-complete`, `owner lane require complete command mismatch for ${owner}`)
    assert(lane?.coverageReportCommand === `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --coverage-report <repo-relative-report.md>`, `owner lane coverage report command mismatch for ${owner}`)
    assert(lane?.coverageJsonCommand === `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --coverage-json <repo-relative-report.json>`, `owner lane coverage JSON command mismatch for ${owner}`)
  }
  for (const action of actions) {
    const expectedActionId = action.gateId ?? action.closureKind
    const expectedCommandSet = expectedOwnerActionCommandSet(expectedActionId)
    assert(action.actionId === expectedActionId, `owner action queue actionId mismatch for ${expectedActionId}`)
    assert(action.actionDossierCommand === expectedCommandSet.actionDossierCommand, `owner action queue actionDossierCommand mismatch for ${expectedActionId}`)
    assert(action.submissionTemplateCommand === expectedCommandSet.submissionTemplateCommand, `owner action queue submissionTemplateCommand mismatch for ${expectedActionId}`)
    assert(action.rawEvidenceTemplateCommand === expectedCommandSet.rawEvidenceTemplateCommand, `owner action queue rawEvidenceTemplateCommand mismatch for ${expectedActionId}`)
    const noteByActionId = {
      ASSERT_BROWSERWINDOW_SECOND_DISPLAY: secondDisplayVerificationCommandNote,
      'admin-service-verification': adminServiceVerificationCommandNote,
      H1_J16_ZERO_EGRESS_CAPTURE_READY: zeroEgressVerificationCommandNote,
      'hardware-verification': hardwareVerificationCommandNote,
      R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY: physicalMonitorVerificationCommandNote,
      R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY: trueVdSwitchVerificationCommandNote,
      R8C_SPEC17_ADMIN_SHELL: adminShellVerificationCommandNote,
      R8C_SPEC17_WINDOWS_SERVICE_INSTALLED: windowsServiceVerificationCommandNote,
      'survey-context': surveyContextVerificationCommandNote,
      'user-product-acceptance': userProductAcceptanceVerificationCommandNote
    }
    const expectedVerificationCommandNote = noteByActionId[expectedActionId] ?? ''
    assert((action.verificationCommandNote ?? '') === expectedVerificationCommandNote, `owner action queue verificationCommandNote mismatch for ${expectedActionId}`)
  }

  const checkboxActions = actions.filter(action => action.actionType === 'checkbox-closure-class')
  for (const action of checkboxActions) {
    const expectedCount = pack.promptCheckboxManifest?.openClosureKindCounts?.[action.closureKind]
    assert(action.count === expectedCount, `owner action queue checkbox count mismatch for ${action.closureKind}: expected ${expectedCount}, got ${action.count}`)
    const expectedSourceFiles = withExpectedSourceFileCommands(summarizeOpenCheckboxSourceFiles(checkboxManifest, action.closureKind), action.actionId)
    assert(JSON.stringify(action.sourceFiles ?? {}) === JSON.stringify(expectedSourceFiles), `owner action queue sourceFiles mismatch for ${action.closureKind}`)
    assert(JSON.stringify(pack.promptCheckboxManifest?.openSourceFilesByClosureKind?.[action.closureKind] ?? {}) === JSON.stringify(summarizeOpenCheckboxSourceFiles(checkboxManifest, action.closureKind)), `acceptance pack openSourceFilesByClosureKind mismatch for ${action.closureKind}`)
  }
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').trim()
}

function formatSourceFileSummaryForMarkdown(summary) {
  if (!summary || !Array.isArray(summary.files) || summary.files.length === 0) return ''
  const base = summary.files.map(row => `${row.file} (${row.count})`).join('; ')
  return summary.omittedFileCount > 0 ? `${base}; +${summary.omittedFileCount} more file(s)` : base
}

function verifyOwnerActionQueueMarkdownText(markdown, ownerActionQueue) {
  for (const requiredText of [
    '## Owner Execution Plan',
    '## Owner Lane Commands',
    ownerActionQueueSchemaVersion,
    'Keep the raw evidence file separate from the JSON submission file',
	    '`evidenceFilePath` must not point to the submission JSON itself',
	    'file mtime freshness can be verified',
	    'Evidence modified at',
	    'Evidence size bytes',
	    'binary-safe evidence digest',
	    'hashAlgorithm=sha256',
    'devhub-0503-checkbox-closure-evidence-v1',
    'devhub-0503-owner-evidence-submission-v1',
    '--owner-readiness',
    '`blockingActions`',
    '--owner-summary',
    '--owner <owner>',
    '--coverage-report <repo-relative-report.md>',
    'nextEvidenceDirectoryCommand',
    'pnpm --silent check:0503-owner-evidence -- --print-template-dir',
    'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action',
    'pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir',
    'remove `templateOnly` before validation',
    'pnpm --silent check:0503-strict:vd-watch',
    'semantic pass values for the submitted action',
    'unknownSubmissionFields'
  ]) {
    assert(markdown.includes(requiredText), `owner action queue markdown missing evidence intake rule: ${requiredText}`)
  }
  for (const [owner, count] of Object.entries(ownerActionQueue.ownerCounts ?? {})) {
    assertMarkdownHasRow(markdown, [owner, count], `owner action queue owner count ${owner}`)
  }
  for (const [key, value] of Object.entries(ownerActionQueue.currentEnvironment ?? {})) {
    assertMarkdownHasRow(markdown, [key, value], `owner action queue current environment ${key}`)
  }
  const actions = Array.isArray(ownerActionQueue.actions) ? ownerActionQueue.actions : []
  const ownerLaneCommands = Array.isArray(ownerActionQueue.ownerLaneCommands) ? ownerActionQueue.ownerLaneCommands : []
  if (actions.length === 0) {
    assert(markdown.includes('No owner actions.'), 'owner action queue markdown must state no owner actions when queue is empty')
    assert(markdown.includes('No remaining actions.'), 'owner action queue markdown must state no remaining actions when queue is empty')
  } else {
    assert(
      markdown.includes(renderedMarkdownRow(['Owner', 'Type', 'Closure kind', 'Gate', 'Current evidence', 'Source files', 'Prerequisite', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Required evidence', 'Unblock rule'])),
      'owner action queue markdown missing global action command-set header'
    )
  }
  for (const lane of ownerLaneCommands) {
    for (const command of [
      lane.ownerReadinessCommand,
      lane.ownerReadinessWithEvidenceDirCommand,
      lane.ownerReadinessWithCoverageArtifactsCommand,
      lane.ownerSummaryCommand,
      lane.listActionsCommand,
      lane.partialR8DossierCommand,
      lane.submissionTemplateDirectoryCommand,
      lane.rawEvidenceTemplateDirectoryCommand,
      lane.requireCompleteCommand,
      lane.coverageReportCommand,
      lane.coverageJsonCommand
    ]) {
      assert(typeof command === 'string' && command.length > 0, `owner lane command missing for ${lane.owner}`)
      assert(markdown.includes(command), `owner action queue markdown missing owner lane command for ${lane.owner}: ${command}`)
    }
    assertMarkdownHasRow(
      markdown,
      [
        lane.owner,
        lane.ownerReadinessCommand,
        lane.ownerReadinessWithEvidenceDirCommand,
        lane.ownerReadinessWithCoverageArtifactsCommand,
        lane.ownerSummaryCommand,
        lane.listActionsCommand,
        lane.partialR8DossierCommand,
        lane.submissionTemplateDirectoryCommand,
        lane.rawEvidenceTemplateDirectoryCommand,
        lane.requireCompleteCommand,
        lane.coverageReportCommand,
        lane.coverageJsonCommand
      ],
      `owner action queue lane command row ${lane.owner}`
    )
  }
  for (const action of actions) {
    assert(typeof action.actionId === 'string' && action.actionId.length > 0, 'owner action queue action is missing actionId')
    assert(markdown.includes(`### ${action.owner}`), `owner action queue markdown missing owner execution section for ${action.owner}`)
    const ownerExecutionRowPrefix = `| ${markdownCell(action.actionId)} | ${markdownCell(action.closureKind)} |`
    assert(markdown.includes(ownerExecutionRowPrefix), `owner action queue markdown missing Owner Execution Plan row for ${action.actionId}`)
    assertMarkdownHasRow(
      markdown,
      [
        action.actionId,
        action.closureKind,
        truncateMarkdownValue(action.currentEvidence),
        action.submissionTemplateCommand,
        action.rawEvidenceTemplateCommand,
        action.actionDossierCommand,
        truncateMarkdownValue(action.verificationCommand),
        truncateMarkdownValue(action.verificationCommandNote)
      ],
      `owner action queue owner execution row ${action.actionId}`
    )
    assertMarkdownHasRow(
      markdown,
      [
        action.owner,
        action.actionType,
        action.closureKind,
        action.gateId ?? '',
        truncateMarkdownValue(action.currentEvidence),
        truncateMarkdownValue(formatSourceFileSummaryForMarkdown(action.sourceFiles)),
        truncateMarkdownValue(action.prerequisite),
        truncateMarkdownValue(action.verificationCommand),
        truncateMarkdownValue(action.verificationCommandNote),
        action.actionDossierCommand,
        action.rawEvidenceTemplateCommand,
        action.submissionTemplateCommand,
        truncateMarkdownValue(action.requiredEvidence),
        truncateMarkdownValue(action.unblockRule)
      ],
      `owner action queue action row ${action.actionId}`
    )
    assert(markdown.includes(action.submissionTemplateCommand), `owner action queue markdown missing submission template command for ${action.actionId}`)
    assert(markdown.includes(action.rawEvidenceTemplateCommand), `owner action queue markdown missing raw evidence template command for ${action.actionId}`)
    assert(markdown.includes(action.actionDossierCommand), `owner action queue markdown missing action dossier command for ${action.actionId}`)
    if (action.actionType === 'checkbox-closure-class' && action.sourceFiles?.files?.length > 0) {
      assert(markdown.includes(`### ${action.closureKind}`), `owner action queue markdown missing checkbox source section for ${action.actionId}`)
      for (const sourceFile of action.sourceFiles.files) {
        assertMarkdownHasRow(markdown, [sourceFile.file, sourceFile.count, sourceFile.sourceFileDossierCommand, sourceFile.actionDossierCommand, sourceFile.rawEvidenceTemplateCommand, sourceFile.submissionTemplateCommand], `owner action queue checkbox source row ${action.actionId}:${sourceFile.file}`)
      }
    }
  }
}

function verifyOwnerActionQueueMarkdown(ownerActionQueue) {
  verifyOwnerActionQueueMarkdownText(readText(ownerActionQueueMarkdownPath), ownerActionQueue)
}

function buildExpectedCompletionGuard(pack, checkboxManifest, ownerActionQueue) {
  return {
    acceptanceStatusComplete: pack.acceptanceStatus === 'complete',
    failedExternalGatesClosed: pack.summary.failedExternalGateCount === 0,
    localClosurePossibleExhausted: checkboxManifest.localClosurePossibleOpenRows === 0,
    ownerActionQueueClosed: ownerActionQueue.actions.length === 0,
    partialR8RowsClosed: pack.summary.partialR8RowCount === 0,
    strictCompletionPassed: pack.summary.strictCompletionPassed === true,
    surveyAcceptanceRowsClosed: pack.summary.surveyAcceptanceRowCount === 0
  }
}

function buildExpectedCompletionGuardEvidence(pack, checkboxManifest, ownerActionQueue, completionGuard) {
  return [
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
      blockers: completionGuard.localClosurePossibleExhausted ? [] : [`localClosurePossibleOpenRows=${checkboxManifest.localClosurePossibleOpenRows}`, 'pnpm check:0503-checkbox-manifest'],
      evidence: `localClosurePossibleOpenRows=${checkboxManifest.localClosurePossibleOpenRows}`,
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
  ].map(row => ({ ...row, blockerCount: row.blockers.length }))
}

function buildExpectedNextOwnerCommands(ownerActionQueue) {
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
        sourceEvidencePath: laneIndex === undefined ? `${relativeRepoPath(ownerActionQueueJsonPath)}#/ownerCounts/${owner}` : `${relativeRepoPath(ownerActionQueueJsonPath)}#/ownerLaneCommands/${laneIndex}`,
        submissionTemplateDirectoryCommand: lane.submissionTemplateDirectoryCommand ?? `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner ${owner}`
      }
    })
}

function verifyCompletionStatus(pack, checkboxManifest, ownerActionQueue, completionStatus) {
  assert(completionStatus.schemaVersion === completionStatusSchemaVersion, `completion status schemaVersion must be ${completionStatusSchemaVersion}`)
  assert(completionStatus.acceptanceStatus === pack.acceptanceStatus, 'completion status acceptanceStatus does not match pack')
  assert(JSON.stringify(completionStatus.continuationCommands ?? {}) === JSON.stringify({
    acceptancePack: 'pnpm check:0503-acceptance-pack',
    localGate: 'pnpm check:0503-local',
    nextOwnerCommands: 'pnpm check:0503-owner-evidence -- --next-owner-commands --owner <owner>',
    ownerBlockerTaxonomy: 'pnpm check:0503-owner-evidence -- --blocker-taxonomy --owner <owner>',
	    ownerClosureBundleQuery: 'pnpm check:0503-owner-evidence -- --owner-closure-bundles --owner <owner>',
	    ownerClosureBundles: relativeRepoPath(ownerClosureBundlesMarkdownPath),
	    ownerReadiness: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>',
	    ownerReadinessWithEvidenceDir: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>',
	    ownerSourceFileDossier: 'pnpm check:0503-owner-evidence -- --source-file-dossier --action <actionId> --file <prompt-file>',
	    ownerSummary: 'pnpm check:0503-owner-evidence -- --owner-summary',
    recommendedStrictGate: 'pnpm --silent check:0503-strict:vd-watch',
    strictGate: 'pnpm check:0503-strict'
  }), 'completion status continuation commands mismatch')
  assert(completionStatus.recommendedStrictCompletionCommand === 'pnpm --silent check:0503-strict:vd-watch', 'completion status recommended strict command mismatch')
  assert(completionStatus.promptArtifactRows === 115, 'completion status should report 115 prompt artifact rows')
  assert(completionStatus.promptCheckboxRows === checkboxManifest.totalRows, 'completion status checkbox row count does not match checkbox manifest')
  assert(completionStatus.promptCheckboxLocalClosurePossibleOpenRows === checkboxManifest.localClosurePossibleOpenRows, 'completion status localClosurePossibleOpenRows does not match checkbox manifest')
  assert(completionStatus.promptCheckboxLocalClosureBlockedOpenRows === checkboxManifest.localClosureBlockedOpenRows, 'completion status localClosureBlockedOpenRows does not match checkbox manifest')
  assert(JSON.stringify(completionStatus.promptCheckboxScopeCounts ?? {}) === JSON.stringify(checkboxManifest.scopeCounts ?? {}), 'completion status checkbox scope counts do not match checkbox manifest')
  const checkboxClosureClassCount = Object.keys(r8OpenClosureKindCounts(pack.promptCheckboxManifest ?? {})).length
  const expectedStrictBlockerCrosswalkRows = pack.partialR8Rows.length + pack.failedExternalGates.length + pack.surveyAcceptanceRows.length + checkboxClosureClassCount
  assert(completionStatus.missingOrIncompleteRequirementCount === expectedStrictBlockerCrosswalkRows, `completion status missingOrIncompleteRequirementCount mismatch: expected ${expectedStrictBlockerCrosswalkRows}, got ${completionStatus.missingOrIncompleteRequirementCount}`)
  assert(completionStatus.strictBlockerCrosswalkRowCount === expectedStrictBlockerCrosswalkRows, `completion status strictBlockerCrosswalkRowCount mismatch: expected ${expectedStrictBlockerCrosswalkRows}, got ${completionStatus.strictBlockerCrosswalkRowCount}`)
  assert(completionStatus.ownerActionCount === ownerActionQueue.actions.length, 'completion status owner action count does not match owner action queue')
  assert(JSON.stringify(completionStatus.currentEnvironment) === JSON.stringify(pack.currentEnvironment), 'completion status currentEnvironment does not match pack')
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const expectedFailedExternalGateCommandSets = buildExpectedFailedExternalGateCommandSets(pack, actionsById)
  assert(JSON.stringify(completionStatus.failedExternalGateCommandSets ?? []) === JSON.stringify(expectedFailedExternalGateCommandSets), 'completion status failedExternalGateCommandSets mismatch')
  const expectedCompletionGuard = buildExpectedCompletionGuard(pack, checkboxManifest, ownerActionQueue)
  const completionGuard = completionStatus.completionGuard ?? {}
  const expectedGuardKeys = Object.keys(expectedCompletionGuard).sort()
  const actualGuardKeys = Object.keys(completionGuard).sort()
  assert(JSON.stringify(actualGuardKeys) === JSON.stringify(expectedGuardKeys), `completion status guard keys mismatch: expected ${expectedGuardKeys.join(',')}, got ${actualGuardKeys.join(',')}`)
  for (const key of expectedGuardKeys) {
    assert(typeof completionGuard[key] === 'boolean', `completion status guard ${key} must be boolean`)
    assert(completionGuard[key] === expectedCompletionGuard[key], `completion status guard ${key} mismatch: expected ${expectedCompletionGuard[key]}, got ${completionGuard[key]}`)
  }
  const expectedComplete = Object.values(expectedCompletionGuard).every(Boolean)
  assert(completionStatus.complete === expectedComplete, `completion status complete flag does not match guard result: expected ${expectedComplete}, got ${completionStatus.complete}`)
  const expectedCompletionGuardEvidence = buildExpectedCompletionGuardEvidence(pack, checkboxManifest, ownerActionQueue, expectedCompletionGuard)
  const completionGuardEvidence = Array.isArray(completionStatus.completionGuardEvidence) ? completionStatus.completionGuardEvidence : []
  assert(completionGuardEvidence.length === expectedCompletionGuardEvidence.length, `completion status guard evidence row count mismatch: expected ${expectedCompletionGuardEvidence.length}, got ${completionGuardEvidence.length}`)
  const evidenceByGuard = new Map(completionGuardEvidence.map(row => [row.guard, row]))
  for (const expectedRow of expectedCompletionGuardEvidence) {
    const actualRow = evidenceByGuard.get(expectedRow.guard)
    assert(actualRow, `completion status guard evidence missing ${expectedRow.guard}`)
    assert(actualRow.passed === expectedRow.passed, `completion status guard evidence passed mismatch for ${expectedRow.guard}`)
    assert(actualRow.evidence === expectedRow.evidence, `completion status guard evidence source mismatch for ${expectedRow.guard}`)
    assert(actualRow.verificationCommand === expectedRow.verificationCommand, `completion status guard evidence verification command mismatch for ${expectedRow.guard}`)
    assert(actualRow.blockerCount === expectedRow.blockerCount, `completion status guard evidence blocker count mismatch for ${expectedRow.guard}`)
    assert(JSON.stringify(actualRow.blockers ?? []) === JSON.stringify(expectedRow.blockers), `completion status guard evidence blockers mismatch for ${expectedRow.guard}`)
    if (actualRow.passed === false) {
      assert((actualRow.blockers ?? []).length > 0, `completion status guard evidence ${expectedRow.guard} must name blockers when false`)
    }
  }
  const expectedBlockedSuccessCriteriaOwnerLinks = [
    {
      actual: pack.summary.failedExternalGateCount,
      evidencePath: relativeRepoPath(externalBlockerReportPath),
      expected: 0,
      id: 'EXTERNAL_GATE_CLOSURE',
      status: pack.summary.failedExternalGateCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.partialR8RowCount,
      evidencePath: `${relativeRepoPath(ledgerVerificationJsonPath)}#/strictCompletion/partialRows`,
      expected: 0,
      id: 'R8_PARTIAL_ROW_CLOSURE',
      status: pack.summary.partialR8RowCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.surveyAcceptanceRowCount,
      evidencePath: `${relativeRepoPath(ledgerVerificationJsonPath)}#/strictCompletion/surveyAcceptanceRows`,
      expected: 0,
      id: 'SURVEY_ACCEPTANCE_CLOSURE',
      status: pack.summary.surveyAcceptanceRowCount === 0 ? 'verified' : 'blocked'
    },
    {
      actual: ownerActionQueue.actions.length,
      evidencePath: relativeRepoPath(ownerActionQueueJsonPath),
      expected: 0,
      id: 'OWNER_ACTION_QUEUE_CLOSURE',
      status: ownerActionQueue.actions.length === 0 ? 'verified' : 'blocked'
    },
    {
      actual: pack.summary.strictCompletionPassed,
      evidencePath: relativeRepoPath(strictCompletionReportMarkdownPath),
      expected: true,
      id: 'STRICT_COMPLETION_GATE',
      status: pack.summary.strictCompletionPassed === true ? 'verified' : 'blocked'
    }
  ]
    .filter(row => row.status !== 'verified')
    .map(row => {
      const ownerActionIds = expectedSuccessCriterionOwnerActionIds(row.id, pack, ownerActionQueue)
      const ownerActionOwners = ownerActionOwnersForIds(ownerActionIds, actionsById)
      return {
        ...row,
        actionDossierCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'actionDossierCommand', 'action-dossier')),
        ownerActionIds,
        ownerActionOwners,
        ownerReadinessWithEvidenceDirCommands: ownerActionOwners.map(owner => `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`),
        rawEvidenceTemplateCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template')),
        submissionTemplateCommands: ownerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'submissionTemplateCommand', 'print-template'))
      }
    })
  assert(JSON.stringify(completionStatus.blockedSuccessCriteriaOwnerLinks ?? []) === JSON.stringify(expectedBlockedSuccessCriteriaOwnerLinks), 'completion status blockedSuccessCriteriaOwnerLinks mismatch')
  const expectedNextOwnerCommands = buildExpectedNextOwnerCommands(ownerActionQueue)
  assert(Array.isArray(completionStatus.nextOwnerCommands), 'completion status nextOwnerCommands must be an array')
  assert(JSON.stringify(completionStatus.nextOwnerCommands) === JSON.stringify(expectedNextOwnerCommands), 'completion status next owner commands mismatch')
}

function assertMarkdownHasRow(markdown, cells, label) {
  const row = renderedMarkdownRow(cells)
  assert(markdown.includes(row), `${label} missing markdown row: ${row}`)
}

function assertCompletionStatusMarkdownText(markdown, completionStatus) {
  assert(markdown.includes('# 0503 Completion Status'), 'completion status markdown missing title')
  assert(markdown.includes(`Schema version: ${completionStatusSchemaVersion}`), 'completion status markdown schema version drift')
  assert(markdown.includes(`Complete: ${completionStatus.complete}`), 'completion status markdown complete flag drift')
  assert(markdown.includes(`Acceptance status: ${completionStatus.acceptanceStatus}`), 'completion status markdown acceptance status drift')
  assert(markdown.includes('## Artifacts'), 'completion status markdown missing Artifacts section')
  for (const [artifact, artifactPath] of Object.entries(completionStatus.artifacts ?? {})) {
    assertMarkdownHasRow(markdown, [artifact, artifactPath], `completion status artifact ${artifact}`)
  }
  assert(markdown.includes('## Continuation Commands'), 'completion status markdown missing Continuation Commands section')
  assert(markdown.includes(`- Local gate: \`${completionStatus.continuationCommands?.localGate}\``), 'completion status markdown missing local gate command')
  assert(markdown.includes(`- Acceptance pack: \`${completionStatus.continuationCommands?.acceptancePack}\``), 'completion status markdown missing acceptance pack command')
  assert(markdown.includes(`- Strict gate: \`${completionStatus.continuationCommands?.strictGate}\``), 'completion status markdown missing strict gate command')
  assert(markdown.includes(`- Recommended strict gate: \`${completionStatus.continuationCommands?.recommendedStrictGate}\``), 'completion status markdown missing recommended strict gate command')
	  assert(markdown.includes(`- Owner summary: \`${completionStatus.continuationCommands?.ownerSummary}\``), 'completion status markdown missing owner summary command')
	  assert(markdown.includes(`- Next owner commands: \`${completionStatus.continuationCommands?.nextOwnerCommands}\``), 'completion status markdown missing next owner commands query')
	  assert(markdown.includes(`- Owner readiness: \`${completionStatus.continuationCommands?.ownerReadiness}\``), 'completion status markdown missing owner readiness query')
	  assert(markdown.includes(`- Owner readiness with evidence dir: \`${completionStatus.continuationCommands?.ownerReadinessWithEvidenceDir}\``), 'completion status markdown missing owner readiness evidence-dir query')
	  assert(markdown.includes(`- Owner source file dossier: \`${completionStatus.continuationCommands?.ownerSourceFileDossier}\``), 'completion status markdown missing owner source file dossier query')
  assert(markdown.includes(`- Owner blocker taxonomy: \`${completionStatus.continuationCommands?.ownerBlockerTaxonomy}\``), 'completion status markdown missing owner blocker taxonomy query')
  assert(markdown.includes(`- Owner closure bundle query: \`${completionStatus.continuationCommands?.ownerClosureBundleQuery}\``), 'completion status markdown missing owner closure bundle query')
  assert(markdown.includes(`- Owner closure bundles: \`${completionStatus.continuationCommands?.ownerClosureBundles}\``), 'completion status markdown missing owner closure bundle artifact')
  assert(markdown.includes('## Completion Guard'), 'completion status markdown missing Completion Guard section')
  for (const [guard, passed] of Object.entries(completionStatus.completionGuard ?? {})) {
    assertMarkdownHasRow(markdown, [guard, passed], `completion status guard ${guard}`)
  }
  assert(markdown.includes('## Completion Guard Evidence'), 'completion status markdown missing Completion Guard Evidence section')
  for (const row of completionStatus.completionGuardEvidence ?? []) {
    assertMarkdownHasRow(
      markdown,
      [row.guard, row.passed, row.evidence, row.verificationCommand, truncateMarkdownValue((row.blockers ?? []).join('; '))],
      `completion status guard evidence ${row.guard}`
    )
	  }
	  assert(markdown.includes('## Blocked Success Criteria Owner Links'), 'completion status markdown missing Blocked Success Criteria Owner Links section')
  if ((completionStatus.blockedSuccessCriteriaOwnerLinks ?? []).length === 0) {
    assert(markdown.includes('No blocked success criteria.'), 'completion status markdown must state no blocked success criteria when complete')
  } else {
    assert(markdown.includes(renderedMarkdownRow(['ID', 'Actual', 'Expected', 'Status', 'Owners', 'Owner actions', 'Owner readiness evidence-dir commands', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Evidence'])), 'completion status markdown missing blocked success criteria owner links command-set header')
  }
  for (const row of completionStatus.blockedSuccessCriteriaOwnerLinks ?? []) {
    assertMarkdownHasRow(
      markdown,
      [
        row.id,
	        row.actual,
	        row.expected,
	        row.status,
	        truncateMarkdownValue((row.ownerActionOwners ?? []).join('; ')),
	        truncateMarkdownValue((row.ownerActionIds ?? []).join('; ')),
	        truncateMarkdownValue((row.ownerReadinessWithEvidenceDirCommands ?? []).join('; ')),
	        truncateMarkdownValue((row.actionDossierCommands ?? []).join('; ')),
	        truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
	        truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; ')),
        row.evidencePath
      ],
      `completion status blocked success criterion ${row.id}`
    )
  }
  assert(markdown.includes('## Failed External Gate Command Sets'), 'completion status markdown missing Failed External Gate Command Sets section')
  if ((completionStatus.failedExternalGateCommandSets ?? []).length === 0) {
    assert(markdown.includes('No failed external gates.'), 'completion status markdown must state no failed external gates when all external gates pass')
  } else {
    assert(markdown.includes(renderedMarkdownRow(['Gate', 'Owner', 'Kind', 'Current evidence', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Evidence'])), 'completion status markdown missing failed external gate command-set header')
  }
  for (const row of completionStatus.failedExternalGateCommandSets ?? []) {
    assert(typeof row.verificationCommandNote === 'string' && row.verificationCommandNote.length > 0, `completion status failed external gate verification command note missing: ${row.gateId}`)
    assertMarkdownHasRow(
      markdown,
      [
        row.gateId,
        row.owner,
        row.blockerKind,
        truncateMarkdownValue(row.currentEvidence),
        row.verificationCommand,
        truncateMarkdownValue(row.verificationCommandNote),
        row.actionDossierCommand,
        row.rawEvidenceTemplateCommand,
        row.submissionTemplateCommand,
        row.sourceEvidencePath
      ],
      `completion status failed external gate command set ${row.gateId}`
    )
  }
  const countFields = [
    ['Prompt artifact rows', 'promptArtifactRows'],
    ['Prompt checkbox rows', 'promptCheckboxRows'],
    ['Open prompt checkbox rows', 'promptCheckboxOpenRows'],
    ['Local-closure possible open rows', 'promptCheckboxLocalClosurePossibleOpenRows'],
    ['Local-closure blocked open rows', 'promptCheckboxLocalClosureBlockedOpenRows'],
    ['Missing or incomplete requirements', 'missingOrIncompleteRequirementCount'],
    ['Partial R8 rows', 'partialR8RowCount'],
    ['Failed external gates', 'failedExternalGateCount'],
    ['Survey acceptance rows', 'surveyAcceptanceRowCount'],
    ['Strict blocker crosswalk rows', 'strictBlockerCrosswalkRowCount'],
    ['Owner actions', 'ownerActionCount']
  ]
  assert(markdown.includes('## Counts'), 'completion status markdown missing Counts section')
  for (const [label, key] of countFields) {
    assert(markdown.includes(`- ${label}: ${completionStatus[key]}`), `completion status markdown count drift for ${key}`)
  }
  assert(markdown.includes('## Current Environment'), 'completion status markdown missing Current Environment section')
  for (const [key, value] of Object.entries(completionStatus.currentEnvironment ?? {})) {
    assertMarkdownHasRow(markdown, [key, value], `completion status current environment ${key}`)
  }
  assert(markdown.includes('## Required Owners'), 'completion status markdown missing Required Owners section')
  for (const [owner, count] of Object.entries(completionStatus.nextRequiredOwners ?? {})) {
    assertMarkdownHasRow(markdown, [owner, count], `completion status required owner ${owner}`)
  }
  assert(markdown.includes('## Next Owner Commands'), 'completion status markdown missing Next Owner Commands section')
  for (const ownerCommand of completionStatus.nextOwnerCommands ?? []) {
    assert(markdown.includes(ownerCommand.owner), `completion status markdown missing owner command owner: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.ownerReadinessCommand), `completion status markdown missing owner readiness command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.ownerReadinessWithEvidenceDirCommand), `completion status markdown missing owner readiness evidence-dir command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.ownerReadinessWithCoverageArtifactsCommand), `completion status markdown missing owner readiness coverage artifacts command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.ownerSummaryCommand), `completion status markdown missing owner summary command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.listActionsCommand), `completion status markdown missing owner list actions command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.blockerTaxonomyCommand), `completion status markdown missing blocker taxonomy command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.partialR8DossierCommand), `completion status markdown missing partial R8 dossier command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.closureBundleCommand), `completion status markdown missing closure bundle command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.requireCompleteCommand), `completion status markdown missing require complete command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.submissionTemplateDirectoryCommand), `completion status markdown missing submission template command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.rawEvidenceTemplateDirectoryCommand), `completion status markdown missing raw evidence template command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.coverageReportCommand), `completion status markdown missing coverage report command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.coverageJsonCommand), `completion status markdown missing coverage JSON command: ${ownerCommand.owner}`)
    assert(markdown.includes(ownerCommand.sourceEvidencePath), `completion status markdown missing owner lane source evidence path: ${ownerCommand.owner}`)
    assertMarkdownHasRow(
      markdown,
      [
        ownerCommand.owner,
        ownerCommand.actionCount,
        ownerCommand.ownerReadinessCommand,
        ownerCommand.ownerReadinessWithEvidenceDirCommand,
        ownerCommand.ownerReadinessWithCoverageArtifactsCommand,
        ownerCommand.ownerSummaryCommand,
        ownerCommand.listActionsCommand,
        ownerCommand.blockerTaxonomyCommand,
        ownerCommand.partialR8DossierCommand,
        ownerCommand.closureBundleCommand,
        ownerCommand.requireCompleteCommand,
        ownerCommand.submissionTemplateDirectoryCommand,
        ownerCommand.rawEvidenceTemplateDirectoryCommand,
        ownerCommand.coverageReportCommand,
        ownerCommand.coverageJsonCommand,
        ownerCommand.sourceEvidencePath
      ],
      `completion status next owner command ${ownerCommand.owner}`
    )
  }
  assert(markdown.includes('## Non-Completion Reasons'), 'completion status markdown missing Non-Completion Reasons section')
  for (const reason of completionStatus.nonCompletionReasons ?? []) {
    assert(markdown.includes(`- ${reason}`), `completion status markdown missing non-completion reason: ${reason}`)
  }
  assert(markdown.includes('## Checkbox Scope Counts'), 'completion status markdown missing Checkbox Scope Counts section')
  for (const [scope, counts] of Object.entries(completionStatus.promptCheckboxScopeCounts ?? {})) {
    assertMarkdownHasRow(markdown, [scope, counts.files, counts.total, counts.open, counts.checked], `completion status checkbox scope ${scope}`)
  }
}

function verifyCompletionStatusMarkdown(completionStatus) {
  assertCompletionStatusMarkdownText(readText(completionStatusMarkdownPath), completionStatus)
}

function assertHandoffCurrentSummaryText(markdown, pack, completionStatus, ownerActionQueue) {
  assert(markdown.includes('## Current Conclusion'), 'HANDOFF missing current conclusion section')
  assert(markdown.includes('Latest real gate command: `pnpm --silent check:0503-strict:vd-watch`.'), 'HANDOFF missing recommended strict command')
  if (completionStatus.complete === true) {
    assert(markdown.includes('Target complete; `pnpm --silent check:0503-strict:vd-watch` passed.'), 'HANDOFF missing completion boundary')
    assert(markdown.includes('Latest result exits zero while evidence pack consistency passes.'), 'HANDOFF missing strict zero/evidence-pack boundary')
  } else {
    assert(markdown.includes('Target remains incomplete; do not call `update_goal complete`.'), 'HANDOFF missing non-completion/update_goal boundary')
    assert(markdown.includes('Latest result remains non-zero while evidence pack consistency passes.'), 'HANDOFF missing strict non-zero/evidence-pack boundary')
  }
  assert(markdown.includes(`partialRows=${pack.summary.partialR8RowCount}`), 'HANDOFF partialRows summary drift')
  assert(markdown.includes(`missingEvidenceRows=${pack.summary.missingEvidenceRowCount ?? 0}`), 'HANDOFF missingEvidenceRows summary drift')
  assert(markdown.includes(`failedExternalGateIds=${pack.summary.failedExternalGateCount}`), 'HANDOFF failedExternalGateIds summary drift')
  assert(markdown.includes(`surveyAcceptanceRows=${pack.summary.surveyAcceptanceRowCount}`), 'HANDOFF surveyAcceptanceRows summary drift')
  assert(markdown.includes(`externalReportFresh=${String(pack.summary.externalReportFresh === true)}`), 'HANDOFF externalReportFresh summary drift')
  assert(markdown.includes('## Current Remaining External Gates'), 'HANDOFF missing external gate section')
  if ((pack.failedExternalGates ?? []).length === 0) {
    assert(markdown.includes('No remaining external gates.'), 'HANDOFF must state no remaining external gates when all external gates pass')
  }
  for (const gate of pack.failedExternalGates ?? []) {
    assert(markdown.includes(`\`${gate.id}\``), `HANDOFF missing failed external gate ${gate.id}`)
  }
  assert(markdown.includes('## Current Remaining Owner Lanes'), 'HANDOFF missing owner lane section')
  if (Object.keys(ownerActionQueue.ownerCounts ?? {}).length === 0) {
    assert(markdown.includes('No remaining owner lanes.'), 'HANDOFF must state no remaining owner lanes when owner action queue is empty')
  }
  for (const [owner, count] of Object.entries(ownerActionQueue.ownerCounts ?? {})) {
    assert(markdown.includes(`\`${owner}\`: ${count}`), `HANDOFF owner lane count drift for ${owner}`)
  }
  assert(completionStatus.complete === (pack.acceptanceStatus === 'complete'), 'completion status complete flag must match acceptance status')
}

function verifyHandoffCurrentSummary(pack, completionStatus, ownerActionQueue) {
  assertHandoffCurrentSummaryText(readText(handoffPath), pack, completionStatus, ownerActionQueue)
}

function verifyStrictCompletionReportMarkdown(pack, completionStatus, ownerActionQueue) {
  const markdown = readText(strictCompletionReportMarkdownPath)
  assert(markdown.includes('# 0503 Strict Completion Report'), 'strict completion report missing title')
  assert(markdown.includes('## Summary'), 'strict completion report missing Summary section')
  assert(markdown.includes(`- Strict completion checked: ${String(pack.summary.strictCompletionChecked === true)}`), 'strict completion report checked summary drift')
  assert(markdown.includes(`- Strict completion passed: ${String(pack.summary.strictCompletionPassed === true)}`), 'strict completion report passed summary drift')
  assert(markdown.includes(`- Partial R8 rows: ${pack.summary.partialR8RowCount}`), 'strict completion report partial rows drift')
  assert(markdown.includes(`- Missing evidence rows: ${pack.summary.missingEvidenceRowCount}`), 'strict completion report missing evidence rows drift')
  assert(markdown.includes(`- Failed external gates: ${pack.summary.failedExternalGateCount}`), 'strict completion report failed external gates drift')
  assert(markdown.includes(`- Survey acceptance rows: ${pack.summary.surveyAcceptanceRowCount}`), 'strict completion report survey acceptance rows drift')
  assert(markdown.includes(`- External blocker report fresh: ${String(pack.summary.externalReportFresh === true)}`), 'strict completion report freshness drift')
  assert(markdown.includes('- Recommended strict command: pnpm --silent check:0503-strict:vd-watch'), 'strict completion report missing recommended strict command')
  assert(markdown.includes('## Strict Completion Guard'), 'strict completion report missing guard section')
  assert(markdown.includes('## Completion Audit Entry Points'), 'strict completion report missing entry points section')
  const entryPointRows = [
    ['Acceptance evidence pack', relativeRepoPath(acceptancePackMarkdownPath), 'Human-readable prompt coverage, failed gates, checkbox ownership, and non-completion boundary.'],
    ['Completion status', relativeRepoPath(completionStatusMarkdownPath), 'Machine-derived completion guard evidence, current environment snapshot, and owner command index.'],
    ['Completion audit', relativeRepoPath(completionAuditMarkdownPath), 'Prompt-to-artifact checklist, command checklist, guard crosswalk, and missing requirement taxonomy.'],
    ['Owner action queue', relativeRepoPath(ownerActionQueueMarkdownPath), 'Canonical owner actions, evidence templates, verification commands, and intake workflow.'],
    ['Owner closure bundles', relativeRepoPath(ownerClosureBundlesMarkdownPath), 'Owner-scoped closure bundles linking blockers, guards, partial R8 rows, and evidence commands.']
  ]
  for (const row of entryPointRows) {
    assertMarkdownHasRow(markdown, [row[0], row[1], truncateMarkdownValue(row[2], 420)], `strict completion report entry point ${row[0]}`)
  }
  assert(markdown.includes('## Partial R8 Rows'), 'strict completion report missing partial R8 section')
  for (const row of pack.partialR8Rows ?? []) {
    assert(markdown.includes(`| ${row.file} |`), `strict completion report missing partial row ${row.file}`)
    assertMarkdownHasRow(markdown, [row.file, truncateMarkdownValue(row.nextAction, 420)], `strict completion report partial row ${row.file}`)
  }
  assert(markdown.includes('## Failed External Gates'), 'strict completion report missing failed external gates section')
  const failedExternalGates = pack.failedExternalGates ?? []
  if (failedExternalGates.length === 0) {
    assert(markdown.includes('No failed external gates.'), 'strict completion report missing no failed external gates text')
  } else {
    assert(
      markdown.includes(renderedMarkdownRow(['Gate', 'Evidence', 'Owner', 'Prerequisite', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Required evidence', 'Unblock rule'])),
      'strict completion report missing failed external gates command-set header'
    )
  }
  const ownerActionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  for (const gate of failedExternalGates) {
    const ownerAction = ownerActionsById.get(gate.id)
    const verificationCommandNote = ownerAction?.verificationCommandNote ?? ''
    assert(markdown.includes(`| ${gate.id} |`), `strict completion report missing failed external gate ${gate.id}`)
    assert(markdown.includes(`pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${gate.id}`), `strict completion report missing failed gate raw evidence template command: ${gate.id}`)
    assert(markdown.includes(`pnpm --silent check:0503-owner-evidence -- --print-template --action ${gate.id}`), `strict completion report missing failed gate submission template command: ${gate.id}`)
    assert(typeof verificationCommandNote === 'string' && verificationCommandNote.length > 0, `owner action verificationCommandNote missing for strict failed gate ${gate.id}`)
    assert(markdown.includes(truncateMarkdownValue(verificationCommandNote, 420)), `strict completion report missing failed gate verification command note: ${gate.id}`)
    assertMarkdownHasRow(
      markdown,
      [
        gate.id,
        gate.evidence,
        gate.runbook?.owner ?? '',
        truncateMarkdownValue(gate.runbook?.prerequisite ?? '', 420),
        truncateMarkdownValue(gate.runbook?.verificationCommand ?? '', 420),
        truncateMarkdownValue(verificationCommandNote, 420),
        `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${gate.id}`,
        `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${gate.id}`,
        `pnpm --silent check:0503-owner-evidence -- --print-template --action ${gate.id}`,
        truncateMarkdownValue(gate.runbook?.requiredEvidence ?? '', 420),
        truncateMarkdownValue(gate.runbook?.unblockRule ?? '', 420)
      ],
      `strict completion report failed external gate ${gate.id}`
    )
  }
  assert(markdown.includes('## External Gate Runbook Coverage'), 'strict completion report missing runbook coverage section')
  assert(markdown.includes('All required external gate runbook fields are present.'), 'strict completion report missing runbook coverage pass text')
  assert(markdown.includes('## Survey Acceptance Rows'), 'strict completion report missing survey acceptance section')
  for (const row of pack.surveyAcceptanceRows ?? []) {
    assert(markdown.includes(`| ${row.file} |`), `strict completion report missing survey acceptance row ${row.file}`)
    assertMarkdownHasRow(markdown, [row.file, row.status], `strict completion report survey acceptance row ${row.file}`)
  }
  assert(markdown.includes('## Owner Lane Command Sets'), 'strict completion report missing owner lane command-set section')
  assert(markdown.includes('These commands are owner intake aids only; they do not close strict completion without real submitted evidence.'), 'strict completion report missing owner lane non-completion boundary')
  const ownerCommands = Array.isArray(completionStatus.nextOwnerCommands) ? completionStatus.nextOwnerCommands : []
  if (ownerCommands.length === 0) {
    assert(markdown.includes('No owner lane command sets.'), 'strict completion report missing no owner lane command sets text')
  } else {
    assert(
      markdown.includes(renderedMarkdownRow(['Owner', 'Action count', 'List actions command', 'Readiness command', 'Readiness evidence-dir command', 'Readiness coverage-artifact command', 'Owner summary command', 'Blocker taxonomy command', 'Partial R8 dossier command', 'Closure bundle command', 'Require complete command', 'Submission template directory command', 'Raw evidence template directory command', 'Coverage report command', 'Coverage JSON command', 'Evidence'])),
      'strict completion report missing owner lane command-set header'
    )
  }
  for (const ownerCommand of ownerCommands) {
    for (const command of [
      ownerCommand.listActionsCommand,
      ownerCommand.ownerReadinessCommand,
      ownerCommand.ownerReadinessWithEvidenceDirCommand,
      ownerCommand.ownerReadinessWithCoverageArtifactsCommand,
      ownerCommand.ownerSummaryCommand,
      ownerCommand.blockerTaxonomyCommand,
      ownerCommand.partialR8DossierCommand,
      ownerCommand.closureBundleCommand,
      ownerCommand.requireCompleteCommand,
      ownerCommand.submissionTemplateDirectoryCommand,
      ownerCommand.rawEvidenceTemplateDirectoryCommand,
      ownerCommand.coverageReportCommand,
      ownerCommand.coverageJsonCommand,
      ownerCommand.sourceEvidencePath
    ]) {
      assert(typeof command === 'string' && command.length > 0, `strict completion report owner lane command missing for ${ownerCommand.owner}`)
      assert(markdown.includes(command), `strict completion report missing owner lane command for ${ownerCommand.owner}: ${command}`)
    }
    assertMarkdownHasRow(
      markdown,
      [
        ownerCommand.owner,
        ownerCommand.actionCount,
        ownerCommand.listActionsCommand,
        ownerCommand.ownerReadinessCommand,
        ownerCommand.ownerReadinessWithEvidenceDirCommand,
        ownerCommand.ownerReadinessWithCoverageArtifactsCommand,
        ownerCommand.ownerSummaryCommand,
        ownerCommand.blockerTaxonomyCommand,
        ownerCommand.partialR8DossierCommand,
        ownerCommand.closureBundleCommand,
        ownerCommand.requireCompleteCommand,
        ownerCommand.submissionTemplateDirectoryCommand,
        ownerCommand.rawEvidenceTemplateDirectoryCommand,
        ownerCommand.coverageReportCommand,
        ownerCommand.coverageJsonCommand,
        ownerCommand.sourceEvidencePath
      ],
      `strict completion report owner lane command-set row ${ownerCommand.owner}`
    )
  }
  assert(markdown.includes('## Verification Commands'), 'strict completion report missing verification commands section')
  assert(markdown.includes('pnpm --silent check:0503-strict:vd-watch'), 'strict completion report missing vd-watch verification command')
  assert(markdown.includes('pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json'), 'strict completion report missing external blocker verification command')
  assert(markdown.includes('node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs --strict-complete --write-report --write-strict-report'), 'strict completion report missing ledger verification command')
}

function verifyCompletionAuditGuardEvidence(completionStatus, completionAudit, options = {}) {
  const verifyPaths = options.verifyPaths !== false
  const statusRows = Array.isArray(completionStatus.completionGuardEvidence) ? completionStatus.completionGuardEvidence : []
  const auditRows = Array.isArray(completionAudit.completionGuardEvidence) ? completionAudit.completionGuardEvidence : []
  assert(auditRows.length === statusRows.length, `completion audit guard evidence row count mismatch: expected ${statusRows.length}, found ${auditRows.length}`)
  for (const [index, statusRow] of statusRows.entries()) {
    const auditRow = auditRows[index]
    assert(auditRow, `completion audit guard evidence missing row ${index}`)
    assert(auditRow.guard === statusRow.guard, `completion audit guard evidence guard mismatch at row ${index}`)
    assert(auditRow.passed === statusRow.passed, `completion audit guard evidence passed mismatch for ${statusRow.guard}`)
    assert(auditRow.evidence === statusRow.evidence, `completion audit guard evidence source mismatch for ${statusRow.guard}`)
    assert(auditRow.verificationCommand === statusRow.verificationCommand, `completion audit guard evidence verification command mismatch for ${statusRow.guard}`)
    assert(auditRow.blockerCount === statusRow.blockerCount, `completion audit guard evidence blocker count mismatch for ${statusRow.guard}`)
    assert(JSON.stringify(auditRow.blockers ?? []) === JSON.stringify(statusRow.blockers ?? []), `completion audit guard evidence blockers mismatch for ${statusRow.guard}`)
    assert(auditRow.auditEvidencePath === `${relativeRepoPath(completionStatusJsonPath)}#/completionGuardEvidence/${index}`, `completion audit guard evidence source pointer mismatch for ${statusRow.guard}`)
    assert(auditRow.strictCompletionCommand === 'pnpm check:0503-strict', `completion audit guard evidence strict command mismatch for ${statusRow.guard}`)
    if (verifyPaths) verifyEvidencePathExists(auditRow.auditEvidencePath, `completion audit guard evidence ${statusRow.guard}`)
  }
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

function ownerActionCommandForAction(actionsById, actionId, field, commandFlag) {
  const action = actionsById.get(actionId)
  return action?.[field] ?? `pnpm --silent check:0503-owner-evidence -- --${commandFlag} --action ${actionId}`
}

function uniqueStrings(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))]
}

function ownerActionOwnersForIds(ownerActionIds, actionsById) {
  return uniqueStrings(ownerActionIds
    .map(actionId => actionsById.get(actionId)?.owner)
  )
}

function buildExpectedFailedExternalGateCommandSets(pack, actionsById) {
  return (pack.failedExternalGates ?? []).map((gate, index) => ({
    actionDossierCommand: ownerActionCommandForAction(actionsById, gate.id, 'actionDossierCommand', 'action-dossier'),
    blockerKind: gate.runbook?.blockerKind ?? 'unknown',
    currentEvidence: gate.evidence,
    gateId: gate.id,
    owner: gate.runbook?.owner ?? 'unassigned',
    rawEvidenceTemplateCommand: ownerActionCommandForAction(actionsById, gate.id, 'rawEvidenceTemplateCommand', 'print-evidence-template'),
    sourceEvidencePath: `${relativeRepoPath(acceptancePackJsonPath)}#/failedExternalGates/${index}`,
    submissionTemplateCommand: ownerActionCommandForAction(actionsById, gate.id, 'submissionTemplateCommand', 'print-template'),
    verificationCommand: gate.runbook?.verificationCommand ?? '',
    verificationCommandNote: actionsById.get(gate.id)?.verificationCommandNote ?? gate.verificationCommandNote ?? ''
  }))
}

function ownerForActionOwners(ownerActionOwners) {
  if (ownerActionOwners.length === 1) return ownerActionOwners[0]
  if (ownerActionOwners.length > 1) return ownerActionOwners.slice().sort().join('+')
  return 'unassigned'
}

function ownerForLinkedOwnerActions(ownerActionIds, actionsById) {
  return ownerForActionOwners(ownerActionOwnersForIds(ownerActionIds, actionsById))
}

function verifyPartialR8Dossier(pack, ownerActionQueue, completionAudit, options = {}) {
  const verifyPaths = options.verifyPaths !== false
  const partialRows = Array.isArray(pack.partialR8Rows) ? pack.partialR8Rows : []
  const dossierRows = Array.isArray(completionAudit.partialR8Dossier) ? completionAudit.partialR8Dossier : []
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  assert(dossierRows.length === partialRows.length, `completion audit partial R8 dossier row count mismatch: expected ${partialRows.length}, found ${dossierRows.length}`)
  for (const [index, partialRow] of partialRows.entries()) {
    const dossierRow = dossierRows[index]
    assert(dossierRow, `completion audit partial R8 dossier missing row ${index}`)
    assert(dossierRow.file === partialRow.file, `completion audit partial R8 dossier file mismatch at row ${index}`)
    assert(dossierRow.nextAction === (partialRow.nextAction ?? ''), `completion audit partial R8 dossier nextAction mismatch for ${partialRow.file}`)
    assert(dossierRow.status === 'partial', `completion audit partial R8 dossier status mismatch for ${partialRow.file}`)
    assert(dossierRow.sourceEvidencePath === `${relativeRepoPath(join(researchDir, '0503-ledger-verification.json'))}#/strictCompletion/partialRowDetails/${index}`, `completion audit partial R8 dossier source mismatch for ${partialRow.file}`)
    assert(dossierRow.verificationCommand === 'pnpm check:0503-ledgers', `completion audit partial R8 dossier verification command mismatch for ${partialRow.file}`)
    assert(dossierRow.strictCompletionCommand === 'pnpm check:0503-strict', `completion audit partial R8 dossier strict command mismatch for ${partialRow.file}`)
    const expectedOwnerActionIds = relatedOwnerActionIdsForPartialR8File(partialRow.file).filter(actionId => actionsById.has(actionId))
    assert(JSON.stringify(dossierRow.ownerActionIds ?? []) === JSON.stringify(expectedOwnerActionIds), `completion audit partial R8 dossier owner action ids mismatch for ${partialRow.file}`)
    assert(JSON.stringify(dossierRow.ownerActionDossierCommands ?? []) === JSON.stringify(expectedOwnerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'actionDossierCommand', 'action-dossier'))), `completion audit partial R8 dossier owner action dossier commands mismatch for ${partialRow.file}`)
    assert(JSON.stringify(dossierRow.rawEvidenceTemplateCommands ?? []) === JSON.stringify(expectedOwnerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template'))), `completion audit partial R8 dossier raw evidence template commands mismatch for ${partialRow.file}`)
    assert(JSON.stringify(dossierRow.submissionTemplateCommands ?? []) === JSON.stringify(expectedOwnerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'submissionTemplateCommand', 'print-template'))), `completion audit partial R8 dossier submission template commands mismatch for ${partialRow.file}`)
    assert(JSON.stringify(dossierRow.ownerActionVerificationCommands ?? []) === JSON.stringify(expectedOwnerActionIds.map(actionId => actionsById.get(actionId)?.verificationCommand ?? 'pnpm check:0503-owner-evidence -- --owner-summary')), `completion audit partial R8 dossier owner action verification commands mismatch for ${partialRow.file}`)
    if (verifyPaths) verifyEvidencePathExists(dossierRow.sourceEvidencePath, `completion audit partial R8 dossier ${partialRow.file}`)
  }
}

function verifyPartialR8RequirementOwners(ownerActionQueue, completionAudit) {
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const requirements = Array.isArray(completionAudit.missingOrIncompleteRequirements) ? completionAudit.missingOrIncompleteRequirements : []
  const strictBlockerCrosswalk = Array.isArray(completionAudit.strictBlockerCrosswalk) ? completionAudit.strictBlockerCrosswalk : []
  const crosswalkByRequirement = new Map(strictBlockerCrosswalk.map(row => [`${row.requirementType}:${row.id}`, row]))
  for (const requirement of requirements.filter(row => row.requirementType === 'partial-r8-row')) {
    const expectedOwnerActionIds = relatedOwnerActionIdsForPartialR8File(requirement.id).filter(actionId => actionsById.has(actionId))
    const expectedOwnerActionOwners = ownerActionOwnersForIds(expectedOwnerActionIds, actionsById)
    const expectedOwner = ownerForActionOwners(expectedOwnerActionOwners)
    assert(JSON.stringify(requirement.ownerActionIds ?? []) === JSON.stringify(expectedOwnerActionIds), `completion audit partial R8 requirement ownerActionIds mismatch for ${requirement.id}`)
    assert(requirement.owner === expectedOwner, `completion audit partial R8 requirement owner mismatch for ${requirement.id}: expected ${expectedOwner}, got ${requirement.owner}`)
    assert(requirement.owner !== 'agent-or-operator', `completion audit partial R8 requirement ${requirement.id} must use linked owner attribution instead of agent-or-operator`)
    const crosswalk = crosswalkByRequirement.get(`${requirement.requirementType}:${requirement.id}`)
    assert(crosswalk, `completion audit partial R8 strict blocker crosswalk missing ${requirement.id}`)
    assert(JSON.stringify(crosswalk.ownerActionIds ?? []) === JSON.stringify(expectedOwnerActionIds), `completion audit partial R8 strict blocker ownerActionIds mismatch for ${requirement.id}`)
    assert(JSON.stringify(crosswalk.ownerActionOwners ?? []) === JSON.stringify(expectedOwnerActionOwners), `completion audit partial R8 strict blocker ownerActionOwners mismatch for ${requirement.id}`)
  }
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

function buildExpectedBlockerTaxonomy(completionAudit, ownerActionQueue) {
  const missingOrIncompleteRequirements = Array.isArray(completionAudit.missingOrIncompleteRequirements) ? completionAudit.missingOrIncompleteRequirements : []
  const strictBlockerCrosswalk = Array.isArray(completionAudit.strictBlockerCrosswalk) ? completionAudit.strictBlockerCrosswalk : []
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const crosswalkByRequirement = new Map(strictBlockerCrosswalk.map(row => [`${row.requirementType}:${row.id}`, row]))
  const rows = missingOrIncompleteRequirements.map(requirement => {
    const crosswalk = crosswalkByRequirement.get(`${requirement.requirementType}:${requirement.id}`) ?? {}
    const ownerAction = crosswalk.ownerActionId ? actionsById.get(crosswalk.ownerActionId) : null
    const category = categoryForRequirement(requirement, ownerAction)
    const weightedOpenRows = openRowWeightForRequirement(requirement, ownerAction)
    return {
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
      weightedOpenRows,
      recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
    }
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

function verifyBlockerTaxonomy(completionAudit, ownerActionQueue) {
  const expectedTaxonomy = buildExpectedBlockerTaxonomy(completionAudit, ownerActionQueue)
  assert(normalizedJson(completionAudit.blockerTaxonomy ?? {}) === normalizedJson(expectedTaxonomy), 'completion audit blocker taxonomy mismatch')
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

function buildExpectedCompletionGuardOwnerCrosswalk(completionAudit, ownerActionQueue) {
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const ownerActionCommand = (actionId, field, commandFlag) => {
    const action = actionsById.get(actionId)
    return action?.[field] ?? `pnpm --silent check:0503-owner-evidence -- --${commandFlag} --action ${actionId}`
  }
  const guardEvidenceRows = Array.isArray(completionAudit.completionGuardEvidence) ? completionAudit.completionGuardEvidence : []
  const partialR8Dossier = Array.isArray(completionAudit.partialR8Dossier) ? completionAudit.partialR8Dossier : []
  return guardEvidenceRows.flatMap(guardRow => {
    const blockers = guardRow.passed ? [] : guardRow.blockers ?? []
    return blockers.map(blocker => {
      const ownerActionIds = ownerActionIdsForGuardBlocker(guardRow.guard, blocker, partialR8Dossier, actionsById)
      const ownerActionId = ownerActionIds.length === 1 ? ownerActionIds[0] : null
      return {
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
          : [guardRow.verificationCommand],
        recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
      }
    })
  })
}

function verifyCompletionGuardOwnerCrosswalk(ownerActionQueue, completionAudit) {
  const expectedRows = buildExpectedCompletionGuardOwnerCrosswalk(completionAudit, ownerActionQueue)
  const actualRows = Array.isArray(completionAudit.completionGuardOwnerCrosswalk) ? completionAudit.completionGuardOwnerCrosswalk : []
  assert(actualRows.length === expectedRows.length, `completion audit guard owner crosswalk row count mismatch: expected ${expectedRows.length}, found ${actualRows.length}`)
  for (const [index, expectedRow] of expectedRows.entries()) {
    const actualRow = actualRows[index]
    assert(normalizedJson(actualRow) === normalizedJson(expectedRow), `completion audit guard owner crosswalk mismatch at row ${index}`)
  }
}

function buildExpectedOwnerActionGuardBacklinks(completionAudit, ownerActionQueue) {
  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const crosswalkRows = Array.isArray(completionAudit.completionGuardOwnerCrosswalk) ? completionAudit.completionGuardOwnerCrosswalk : []
  const backlinksByActionId = new Map()
  for (const crosswalkRow of crosswalkRows) {
    for (const actionId of crosswalkRow.ownerActionIds ?? []) {
      const action = actionsById.get(actionId)
      if (!action) continue
      const existing = backlinksByActionId.get(actionId) ?? {
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
        verificationCommand: action.verificationCommand ?? '',
        recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
      }
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

function verifyOwnerActionGuardBacklinks(ownerActionQueue, completionAudit) {
  const expectedRows = buildExpectedOwnerActionGuardBacklinks(completionAudit, ownerActionQueue)
  const actualRows = Array.isArray(completionAudit.ownerActionGuardBacklinks) ? completionAudit.ownerActionGuardBacklinks : []
  assert(actualRows.length === expectedRows.length, `completion audit owner action guard backlink count mismatch: expected ${expectedRows.length}, found ${actualRows.length}`)
  for (const [index, expectedRow] of expectedRows.entries()) {
    const actualRow = actualRows[index]
    assert(normalizedJson(actualRow) === normalizedJson(expectedRow), `completion audit owner action guard backlink mismatch at row ${index}`)
  }
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
  return {
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
    weightedOpenRows: Number.isFinite(row.weightedOpenRows) ? row.weightedOpenRows : 1,
    recommendedStrictCompletionCommand: row.recommendedStrictCompletionCommand ?? 'pnpm --silent check:0503-strict:vd-watch'
  }
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

function verifyOwnerClosureBundles(ownerActionQueue, completionAudit, ownerClosureBundles) {
  assert(ownerClosureBundles.schemaVersion === ownerClosureBundleSchemaVersion, `owner closure bundles schemaVersion must be ${ownerClosureBundleSchemaVersion}`)
  assert(ownerClosureBundles.status === completionAudit.status, 'owner closure bundles status does not match completion audit')
  assert(ownerClosureBundles.acceptanceStatus === completionAudit.acceptanceStatus, 'owner closure bundles acceptanceStatus does not match completion audit')
  assert(JSON.stringify(ownerClosureBundles.sourceEvidence ?? []) === JSON.stringify([relativeRepoPath(ownerActionQueueJsonPath), relativeRepoPath(completionAuditJsonPath)]), 'owner closure bundles sourceEvidence mismatch')
  const actions = ownerActionQueue.actions ?? []
  const backlinksByActionId = new Map((completionAudit.ownerActionGuardBacklinks ?? []).map(row => [row.actionId, row]))
  const expectedOwners = new Map()
  for (const action of actions) {
    const owner = action.owner ?? 'unassigned'
    const backlink = backlinksByActionId.get(action.actionId)
    const partialR8DossierLinks = buildPartialR8DossierLinksForAction(action.actionId, owner, completionAudit)
    const blockingTaxonomyRows = buildBlockingTaxonomyRowsForAction(action.actionId, completionAudit)
    const ownerActions = expectedOwners.get(owner) ?? []
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
      strictCompletionCommand: 'pnpm check:0503-strict',
      recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
      submissionTemplateCommand: action.submissionTemplateCommand,
      unblockRule: action.unblockRule,
      verificationCommand: action.verificationCommand,
      verificationCommandNote: action.verificationCommandNote ?? ''
    })
    expectedOwners.set(owner, ownerActions)
  }
  const expectedOwnerBundles = [...expectedOwners.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([owner, ownerActions]) => {
      const blockingTaxonomyRows = dedupeBlockingTaxonomyRows(ownerActions.flatMap(action => action.blockingTaxonomyRows ?? []))
      return {
        actionCount: ownerActions.length,
        actions: ownerActions.sort((left, right) => left.actionId.localeCompare(right.actionId)),
        blockingTaxonomyRowCount: blockingTaxonomyRows.length,
        blockingTaxonomyRows,
        categoryWeightedOpenRows: weightedCountBy(blockingTaxonomyRows, row => row.category, row => row.weightedOpenRows),
        owner,
        recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
        readinessCommand: `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`,
        requireCompleteCommand: `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner ${owner} --require-complete`,
        summaryCommand: `pnpm --silent check:0503-owner-evidence -- --owner-summary --owner ${owner}`,
        weightedOpenRows: blockingTaxonomyRows.reduce((sum, row) => sum + row.weightedOpenRows, 0)
      }
    })
  assert(ownerClosureBundles.ownerCount === expectedOwnerBundles.length, `owner closure bundle ownerCount mismatch: expected ${expectedOwnerBundles.length}, got ${ownerClosureBundles.ownerCount}`)
  assert(ownerClosureBundles.totalActionCount === actions.length, `owner closure bundle totalActionCount mismatch: expected ${actions.length}, got ${ownerClosureBundles.totalActionCount}`)
  assert(ownerClosureBundles.recommendedStrictCompletionCommand === 'pnpm --silent check:0503-strict:vd-watch', 'owner closure bundle recommended strict command mismatch')
  assert(normalizedJson(ownerClosureBundles.owners ?? []) === normalizedJson(expectedOwnerBundles), 'owner closure bundle owners mismatch')
}

function verifyOwnerClosureBundlesMarkdown(ownerClosureBundles) {
  const markdown = readText(ownerClosureBundlesMarkdownPath)
  for (const requiredText of [
    '# 0503 Owner Closure Bundles',
    ownerClosureBundleSchemaVersion,
    `Status: ${ownerClosureBundles.status}`,
    `Acceptance status: ${ownerClosureBundles.acceptanceStatus}`,
    `- Owner count: ${ownerClosureBundles.ownerCount}`,
    `- Total action count: ${ownerClosureBundles.totalActionCount}`,
    'These bundles are owner execution aids, not completion evidence by themselves',
    'pnpm check:0503-strict',
    'pnpm --silent check:0503-strict:vd-watch'
  ]) {
    assert(markdown.includes(requiredText), `owner closure bundle markdown missing required text: ${requiredText}`)
  }
  if ((ownerClosureBundles.owners ?? []).length > 0) {
    assert(markdown.includes('Blocking taxonomy rows'), 'owner closure bundle markdown missing required text: Blocking taxonomy rows')
  }
  for (const ownerBundle of ownerClosureBundles.owners ?? []) {
    assert(markdown.includes(`## ${ownerBundle.owner}`), `owner closure bundle markdown missing owner section: ${ownerBundle.owner}`)
    assert(markdown.includes(`- Action count: ${ownerBundle.actionCount}`), `owner closure bundle markdown missing action count: ${ownerBundle.owner}`)
    assert(markdown.includes(`- Blocking taxonomy rows: ${ownerBundle.blockingTaxonomyRowCount}`), `owner closure bundle markdown missing taxonomy row count: ${ownerBundle.owner}`)
    assert(markdown.includes(`- Weighted open rows: ${ownerBundle.weightedOpenRows}`), `owner closure bundle markdown missing weighted rows: ${ownerBundle.owner}`)
    assert(markdown.includes(ownerBundle.readinessCommand), `owner closure bundle markdown missing readiness command: ${ownerBundle.owner}`)
    assert(markdown.includes(ownerBundle.summaryCommand), `owner closure bundle markdown missing owner summary command: ${ownerBundle.owner}`)
    assert(markdown.includes(ownerBundle.requireCompleteCommand), `owner closure bundle markdown missing require complete command: ${ownerBundle.owner}`)
    for (const taxonomyRow of ownerBundle.blockingTaxonomyRows ?? []) {
      assert(
        markdown.includes(renderedMarkdownRow([
          taxonomyRow.category,
          taxonomyRow.id,
          (taxonomyRow.ownerActionIds ?? []).join('; '),
          taxonomyRow.weightedOpenRows,
          truncateMarkdownValue(taxonomyRow.verificationCommand),
          truncateMarkdownValue((taxonomyRow.actionDossierCommands ?? []).join('; ')),
          truncateMarkdownValue((taxonomyRow.rawEvidenceTemplateCommands ?? []).join('; ')),
          truncateMarkdownValue((taxonomyRow.submissionTemplateCommands ?? []).join('; ')),
          truncateMarkdownValue(taxonomyRow.currentEvidence)
        ])),
        `owner closure bundle markdown missing taxonomy row: ${ownerBundle.owner}:${taxonomyRow.id}`
      )
    }
    for (const action of ownerBundle.actions ?? []) {
      assert(
        markdown.includes(renderedMarkdownRow([
          action.actionId,
          (action.guardsBlocked ?? []).join('; '),
          truncateMarkdownValue((action.blockers ?? []).join('; ')),
          truncateMarkdownValue((action.blockingTaxonomyRowIds ?? []).join('; ')),
          truncateMarkdownValue((action.partialR8Files ?? []).join('; ')),
          truncateMarkdownValue((action.partialR8DossierLinks ?? []).map(row => row.partialR8OwnerFileDossierCommand).join('; ')),
          truncateMarkdownValue(formatSourceFileSummaryForMarkdown(action.sourceFiles)),
          truncateMarkdownValue((action.sourceFiles?.files ?? []).map(row => row.sourceFileDossierCommand).join('; ')),
          truncateMarkdownValue(action.currentEvidence),
          truncateMarkdownValue(action.requiredEvidence),
          truncateMarkdownValue(action.verificationCommand),
          truncateMarkdownValue(action.verificationCommandNote),
          action.actionDossierCommand,
          action.rawEvidenceTemplateCommand,
          action.submissionTemplateCommand
        ])),
        `owner closure bundle markdown missing action row: ${ownerBundle.owner}:${action.actionId}`
      )
      for (const partialR8Link of action.partialR8DossierLinks ?? []) {
        assert(markdown.includes(partialR8Link.file), `owner closure bundle markdown missing partial R8 file: ${partialR8Link.file}`)
        assert(markdown.includes(partialR8Link.partialR8OwnerFileDossierCommand), `owner closure bundle markdown missing partial R8 file dossier command: ${partialR8Link.file}`)
      }
    }
  }
}

function buildExpectedStatusArtifacts(pack) {
  return {
    acceptancePack: relativeRepoPath(acceptancePackJsonPath),
    checkboxManifest: pack.promptCheckboxManifest.jsonPath,
    completionAudit: relativeRepoPath(completionAuditJsonPath),
    ownerActionQueue: relativeRepoPath(ownerActionQueueJsonPath),
    ownerClosureBundles: relativeRepoPath(ownerClosureBundlesJsonPath),
    strictReport: '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-strict-completion-report.md'
  }
}

function verifyCompletionStatusArtifactIndex(pack, completionStatus, options = {}) {
  const verifyPaths = options.verifyPaths !== false
  const statusArtifacts = completionStatus.artifacts ?? {}
  const expectedStatusArtifacts = buildExpectedStatusArtifacts(pack)
  const actualKeys = Object.keys(statusArtifacts).sort()
  const expectedKeys = Object.keys(expectedStatusArtifacts).sort()
  assert(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), `completion status artifact keys mismatch: expected ${expectedKeys.join(',')}, got ${actualKeys.join(',')}`)
  for (const [key, expectedPath] of Object.entries(expectedStatusArtifacts)) {
    assert(statusArtifacts[key] === expectedPath, `completion status artifact ${key} should be ${expectedPath}`)
    if (verifyPaths) verifyEvidencePathExists(expectedPath, `completion status artifact ${key}`)
  }
}

function expectedSuccessCriterionOwnerActionIds(criterionId, pack, ownerActionQueue) {
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

function verifyOpenRequirementExternalOwnerBoundary(openRequirements, ownerActionQueue) {
  const ownerActionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const allowedOpenRequirementTypes = new Set([
    'partial-r8-row',
    'failed-external-gate',
    'survey-acceptance-row',
    'open-checkbox-closure-class'
  ])
  const expectedOpenRequirementSources = {
    'partial-r8-row': '0503-ledger-verification.json',
    'failed-external-gate': 'r8-external-blockers-current.json',
    'survey-acceptance-row': '0503-survey-acceptance-ledger.md',
    'open-checkbox-closure-class': '0503-checkbox-manifest.json'
  }
  const allowedOpenRequirementCommands = new Set([
    'pnpm -C devhub check:browserwindow-second-display',
    'pnpm -C devhub check:physical-monitor-hotplug',
    'pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json',
    'pnpm -C devhub check:zero-egress-capture',
    'pnpm check:0503-checkbox-manifest'
  ])
  for (const requirement of openRequirements) {
    assert(allowedOpenRequirementTypes.has(requirement.requirementType), `completion audit open requirement has unclassified local-closure type: ${requirement.requirementType}:${requirement.id}`)
    assert(requirement.source === expectedOpenRequirementSources[requirement.requirementType], `completion audit open requirement source mismatch for ${requirement.requirementType}:${requirement.id}`)
    assert(typeof requirement.evidence === 'string' && requirement.evidence.length > 0, `completion audit open requirement evidence must be non-empty for ${requirement.id}`)
    const requirementOwnerActionIds = Array.isArray(requirement.ownerActionIds) ? requirement.ownerActionIds : []
    assert(requirementOwnerActionIds.length > 0, `completion audit open requirement must link owner actions for ${requirement.id}`)
    for (const actionId of requirementOwnerActionIds) {
      assert(ownerActionsById.has(actionId), `completion audit open requirement ${requirement.id} references unknown owner action ${actionId}`)
    }
    const expectedOwnerActionOwners = uniqueStrings(requirementOwnerActionIds.map(actionId => ownerActionsById.get(actionId)?.owner).filter(Boolean))
    assert(JSON.stringify(requirement.ownerActionOwners ?? []) === JSON.stringify(expectedOwnerActionOwners), `completion audit open requirement ownerActionOwners mismatch for ${requirement.id}`)
    if (requirement.owner === 'product-or-user') {
      assert(expectedOwnerActionOwners.every(owner => owner === 'product' || owner === 'user-product'), `completion audit product-or-user requirement must link product/user owners for ${requirement.id}`)
    } else {
      assert(expectedOwnerActionOwners.includes(requirement.owner), `completion audit open requirement owner mismatch for ${requirement.id}`)
    }
    for (const verificationCommand of requirement.verificationCommands ?? []) {
      assert(
        allowedOpenRequirementCommands.has(verificationCommand) || verificationCommand.startsWith('PowerShell: '),
        `completion audit open requirement has non-owner/external verification command for ${requirement.id}: ${verificationCommand}`
      )
    }
  }
}

function verifyCompletionAudit(pack, checkboxManifest, ownerActionQueue, completionStatus, completionAudit) {
  assert(completionAudit.schemaVersion === completionAuditSchemaVersion, `completion audit schemaVersion must be ${completionAuditSchemaVersion}`)
  assert(completionAudit.acceptanceStatus === pack.acceptanceStatus, 'completion audit acceptanceStatus does not match pack')
  assert(completionAudit.status === (completionStatus.complete === true ? 'complete' : 'not-complete'), 'completion audit status does not match completion status')
  assert(JSON.stringify(completionAudit.currentEnvironment) === JSON.stringify(pack.currentEnvironment), 'completion audit currentEnvironment does not match pack')
  verifyCompletionAuditGuardEvidence(completionStatus, completionAudit)
  verifyPartialR8Dossier(pack, ownerActionQueue, completionAudit)
  verifyPartialR8RequirementOwners(ownerActionQueue, completionAudit)
  verifyCompletionGuardOwnerCrosswalk(ownerActionQueue, completionAudit)
  verifyOwnerActionGuardBacklinks(ownerActionQueue, completionAudit)
  verifyBlockerTaxonomy(completionAudit, ownerActionQueue)

  const actionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
  const promptRows = Array.isArray(completionAudit.promptToArtifactChecklist) ? completionAudit.promptToArtifactChecklist : []
  const prompt0503Rows = promptRows.filter(row => row.scope === 'prompts/0503')
  const prompt05032Rows = promptRows.filter(row => row.scope === 'prompts/0503-2')
  assert(promptRows.length === 115, `completion audit should contain 115 prompt-to-artifact rows, found ${promptRows.length}`)
  assert(prompt0503Rows.length === 34, `completion audit should contain 34 prompts/0503 rows, found ${prompt0503Rows.length}`)
  assert(prompt05032Rows.length === 81, `completion audit should contain 81 prompts/0503-2 rows, found ${prompt05032Rows.length}`)
  for (const [index, row] of prompt0503Rows.entries()) {
    assert(row.sourcePromptPath === row.file, `completion audit prompts/0503 row ${row.file} must expose sourcePromptPath`)
    assert(row.sourceLedgerPath === relativeRepoPath(join(researchDir, '0503-survey-acceptance-ledger.md')), `completion audit prompts/0503 row ${row.file} sourceLedgerPath mismatch`)
    assert(row.sourceLedgerVerificationPath === `${relativeRepoPath(join(researchDir, '0503-ledger-verification.json'))}#/surveyLedger/rows/${index}`, `completion audit prompts/0503 row ${row.file} sourceLedgerVerificationPath mismatch`)
    assert(row.artifactManifestEvidencePath === `${relativeRepoPath(acceptancePackJsonPath)}#/promptArtifactManifest/prompt0503Rows/${index}`, `completion audit prompts/0503 row ${row.file} artifactManifestEvidencePath mismatch`)
    assert(row.checkboxManifestEvidencePath === relativeRepoPath(checkboxManifestJsonPath), `completion audit prompts/0503 row ${row.file} checkboxManifestEvidencePath mismatch`)
    assert(row.localVerificationCommand === 'pnpm check:0503-ledgers', `completion audit prompts/0503 row ${row.file} localVerificationCommand mismatch`)
    assert(row.checkboxVerificationCommand === 'pnpm check:0503-checkbox-manifest', `completion audit prompts/0503 row ${row.file} checkboxVerificationCommand mismatch`)
    assert(row.strictCompletionCommand === 'pnpm check:0503-strict', `completion audit prompts/0503 row ${row.file} strictCompletionCommand mismatch`)
    assert(row.recommendedStrictCompletionCommand === 'pnpm --silent check:0503-strict:vd-watch', `completion audit prompts/0503 row ${row.file} recommendedStrictCompletionCommand mismatch`)
    verifyEvidencePathExists(row.sourcePromptPath, `completion audit prompt row ${row.file}`)
    verifyEvidencePathExists(row.sourceLedgerPath, `completion audit prompt row ${row.file} source ledger`)
    verifyEvidencePathExists(row.sourceLedgerVerificationPath, `completion audit prompt row ${row.file} ledger verification`)
    verifyEvidencePathExists(row.artifactManifestEvidencePath, `completion audit prompt row ${row.file} artifact manifest`)
    verifyEvidencePathExists(row.checkboxManifestEvidencePath, `completion audit prompt row ${row.file} checkbox manifest`)
  }
  for (const [index, row] of prompt05032Rows.entries()) {
    assert(row.sourcePromptPath === row.file, `completion audit prompts/0503-2 row ${row.file} must expose sourcePromptPath`)
    assert(row.sourceLedgerPath === relativeRepoPath(join(researchDir, '0503-2-completion-ledger.md')), `completion audit prompts/0503-2 row ${row.file} sourceLedgerPath mismatch`)
    assert(row.sourceLedgerVerificationPath === `${relativeRepoPath(join(researchDir, '0503-ledger-verification.json'))}#/completionLedger/rows/${index}`, `completion audit prompts/0503-2 row ${row.file} sourceLedgerVerificationPath mismatch`)
    assert(row.artifactManifestEvidencePath === `${relativeRepoPath(acceptancePackJsonPath)}#/promptArtifactManifest/prompt05032Rows/${index}`, `completion audit prompts/0503-2 row ${row.file} artifactManifestEvidencePath mismatch`)
    assert(row.checkboxManifestEvidencePath === relativeRepoPath(checkboxManifestJsonPath), `completion audit prompts/0503-2 row ${row.file} checkboxManifestEvidencePath mismatch`)
    assert(row.localVerificationCommand === 'pnpm check:0503-ledgers', `completion audit prompts/0503-2 row ${row.file} localVerificationCommand mismatch`)
    assert(row.checkboxVerificationCommand === 'pnpm check:0503-checkbox-manifest', `completion audit prompts/0503-2 row ${row.file} checkboxVerificationCommand mismatch`)
    assert(row.strictCompletionCommand === 'pnpm check:0503-strict', `completion audit prompts/0503-2 row ${row.file} strictCompletionCommand mismatch`)
    assert(row.recommendedStrictCompletionCommand === 'pnpm --silent check:0503-strict:vd-watch', `completion audit prompts/0503-2 row ${row.file} recommendedStrictCompletionCommand mismatch`)
    assert(Array.isArray(row.ownerActionIds), `completion audit prompts/0503-2 row ${row.file} ownerActionIds must be present`)
    assert(Array.isArray(row.ownerActionDossierCommands), `completion audit prompts/0503-2 row ${row.file} ownerActionDossierCommands must be present`)
    assert(Array.isArray(row.rawEvidenceTemplateCommands), `completion audit prompts/0503-2 row ${row.file} rawEvidenceTemplateCommands must be present`)
    assert(Array.isArray(row.submissionTemplateCommands), `completion audit prompts/0503-2 row ${row.file} submissionTemplateCommands must be present`)
    assert(Array.isArray(row.ownerReadinessWithEvidenceDirCommands), `completion audit prompts/0503-2 row ${row.file} ownerReadinessWithEvidenceDirCommands must be present`)
    const expectedOwnerActionIds = relatedOwnerActionIdsForPartialR8File(row.file)
    assert(JSON.stringify(row.ownerActionIds) === JSON.stringify(expectedOwnerActionIds), `completion audit prompts/0503-2 row ${row.file} ownerActionIds mismatch`)
    assert(JSON.stringify(row.ownerActionDossierCommands) === JSON.stringify(expectedOwnerActionIds.map(actionId => `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${actionId}`)), `completion audit prompts/0503-2 row ${row.file} ownerActionDossierCommands mismatch`)
    assert(JSON.stringify(row.rawEvidenceTemplateCommands) === JSON.stringify(expectedOwnerActionIds.map(actionId => `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${actionId}`)), `completion audit prompts/0503-2 row ${row.file} rawEvidenceTemplateCommands mismatch`)
    assert(JSON.stringify(row.submissionTemplateCommands) === JSON.stringify(expectedOwnerActionIds.map(actionId => `pnpm --silent check:0503-owner-evidence -- --print-template --action ${actionId}`)), `completion audit prompts/0503-2 row ${row.file} submissionTemplateCommands mismatch`)
    const passedHistoricalOwnerGateIds = new Set([
      'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
      'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
      'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY',
      'R8C_SPEC17_ADMIN_SHELL',
      'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED',
      'H1_J16_ZERO_EGRESS_CAPTURE_READY',
      'hardware-verification',
      'admin-service-verification'
    ])
    assert(row.ownerActionIds.every(actionId => actionsById.has(actionId) || passedHistoricalOwnerGateIds.has(actionId)), `completion audit prompts/0503-2 row ${row.file} ownerActionIds must be known or a passed historical owner gate`)
    verifyEvidencePathExists(row.sourcePromptPath, `completion audit prompt row ${row.file}`)
    verifyEvidencePathExists(row.sourceLedgerPath, `completion audit prompt row ${row.file} source ledger`)
    verifyEvidencePathExists(row.sourceLedgerVerificationPath, `completion audit prompt row ${row.file} ledger verification`)
    verifyEvidencePathExists(row.artifactManifestEvidencePath, `completion audit prompt row ${row.file} artifact manifest`)
    verifyEvidencePathExists(row.checkboxManifestEvidencePath, `completion audit prompt row ${row.file} checkbox manifest`)
  }

  const criteria = Array.isArray(completionAudit.successCriteria) ? completionAudit.successCriteria : []
  const criteriaById = new Map(criteria.map(row => [row.id, row]))
  assert(criteria.length === criteriaById.size, 'completion audit successCriteria ids must be unique')
  for (const row of criteria) {
    assert(typeof row.id === 'string' && row.id.length > 0, 'completion audit successCriteria row missing id')
    assert(typeof row.requirement === 'string' && row.requirement.length > 0, `completion audit successCriteria ${row.id} missing requirement`)
    assert(typeof row.evidencePath === 'string' && row.evidencePath.length > 0, `completion audit successCriteria ${row.id} missing evidencePath`)
    assert(Object.prototype.hasOwnProperty.call(row, 'actual'), `completion audit successCriteria ${row.id} missing actual`)
    assert(Object.prototype.hasOwnProperty.call(row, 'expected'), `completion audit successCriteria ${row.id} missing expected`)
    assert(['blocked', 'missing', 'verified'].includes(row.status), `completion audit successCriteria ${row.id} has invalid status: ${row.status}`)
    const expectedOwnerActionIds = expectedSuccessCriterionOwnerActionIds(row.id, pack, ownerActionQueue)
    const expectedOwnerActionOwners = ownerActionOwnersForIds(expectedOwnerActionIds, actionsById)
    assert(JSON.stringify(row.ownerActionIds ?? []) === JSON.stringify(expectedOwnerActionIds), `completion audit successCriteria ${row.id} ownerActionIds mismatch`)
    assert(JSON.stringify(row.ownerActionOwners ?? []) === JSON.stringify(expectedOwnerActionOwners), `completion audit successCriteria ${row.id} ownerActionOwners mismatch`)
    assert(JSON.stringify(row.actionDossierCommands ?? []) === JSON.stringify(expectedOwnerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'actionDossierCommand', 'action-dossier'))), `completion audit successCriteria ${row.id} actionDossierCommands mismatch`)
    assert(JSON.stringify(row.rawEvidenceTemplateCommands ?? []) === JSON.stringify(expectedOwnerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template'))), `completion audit successCriteria ${row.id} rawEvidenceTemplateCommands mismatch`)
    assert(JSON.stringify(row.submissionTemplateCommands ?? []) === JSON.stringify(expectedOwnerActionIds.map(actionId => ownerActionCommandForAction(actionsById, actionId, 'submissionTemplateCommand', 'print-template'))), `completion audit successCriteria ${row.id} submissionTemplateCommands mismatch`)
    assert(JSON.stringify(row.ownerReadinessWithEvidenceDirCommands ?? []) === JSON.stringify(expectedOwnerActionOwners.map(owner => `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`)), `completion audit successCriteria ${row.id} ownerReadinessWithEvidenceDirCommands mismatch`)
    verifyEvidencePathExists(row.evidencePath, `completion audit successCriteria ${row.id}`)
  }
  for (const id of [
    'PROMPTS_0503_LEDGER_COVERAGE',
    'PROMPTS_0503_2_LEDGER_COVERAGE',
    'PROMPT_CHECKBOX_MANIFEST_COVERAGE',
    'LOCAL_CLOSURE_EXHAUSTED',
    'EXTERNAL_GATE_CLOSURE',
    'R8_PARTIAL_ROW_CLOSURE',
    'SURVEY_ACCEPTANCE_CLOSURE',
    'OWNER_ACTION_QUEUE_CLOSURE',
    'STRICT_COMPLETION_GATE',
    'ROOT_PACKAGE_DEPENDENCY_PRESERVATION',
    'ROOT_LOCKFILE_DEPENDENCY_SYNC'
  ]) {
    assert(criteriaById.has(id), `completion audit missing success criterion ${id}`)
  }
  assert(criteriaById.get('PROMPTS_0503_LEDGER_COVERAGE')?.actual === 34, 'completion audit prompts/0503 coverage mismatch')
  assert(criteriaById.get('PROMPTS_0503_2_LEDGER_COVERAGE')?.actual === 81, 'completion audit prompts/0503-2 coverage mismatch')
  assert(criteriaById.get('PROMPT_CHECKBOX_MANIFEST_COVERAGE')?.actual === checkboxManifest.totalRows, 'completion audit checkbox coverage mismatch')
  assert(criteriaById.get('LOCAL_CLOSURE_EXHAUSTED')?.actual === checkboxManifest.localClosurePossibleOpenRows, 'completion audit local closure exhausted mismatch')
  assert(criteriaById.get('EXTERNAL_GATE_CLOSURE')?.actual === pack.summary.failedExternalGateCount, 'completion audit failed gate count mismatch')
  assert(criteriaById.get('R8_PARTIAL_ROW_CLOSURE')?.actual === pack.summary.partialR8RowCount, 'completion audit partial R8 count mismatch')
  assert(criteriaById.get('SURVEY_ACCEPTANCE_CLOSURE')?.actual === pack.summary.surveyAcceptanceRowCount, 'completion audit survey acceptance count mismatch')
  assert(criteriaById.get('OWNER_ACTION_QUEUE_CLOSURE')?.actual === ownerActionQueue.actions.length, 'completion audit owner action count mismatch')
  assert(criteriaById.get('STRICT_COMPLETION_GATE')?.actual === pack.summary.strictCompletionPassed, 'completion audit strict completion value mismatch')
  assert(criteriaById.get('ROOT_PACKAGE_DEPENDENCY_PRESERVATION')?.actual === 8, 'completion audit root package dependency preservation mismatch')
  assert(criteriaById.get('ROOT_LOCKFILE_DEPENDENCY_SYNC')?.actual === 8, 'completion audit root lockfile dependency sync mismatch')

  const commands = Array.isArray(completionAudit.commandChecklist) ? completionAudit.commandChecklist : []
  const commandIds = new Set(commands.map(row => row.id))
  assert(commands.length === commandIds.size, 'completion audit command checklist ids must be unique')
  for (const row of commands) {
    assert(typeof row.id === 'string' && row.id.length > 0, 'completion audit command checklist row missing id')
    assert(typeof row.command === 'string' && row.command.length > 0, `completion audit command checklist ${row.id} missing command`)
    assert(typeof row.evidencePath === 'string' && row.evidencePath.length > 0, `completion audit command checklist ${row.id} missing evidencePath`)
    assert(typeof row.requirement === 'string' && row.requirement.length > 0, `completion audit command checklist ${row.id} missing requirement`)
    assert(row.status === 'verified' || row.status === 'blocked', `completion audit command checklist ${row.id} has invalid status: ${row.status}`)
    verifyEvidencePathExists(row.evidencePath, `completion audit command checklist ${row.id}`)
  }
  for (const id of [
    'GENERATE_AND_VERIFY_ACCEPTANCE_PACK',
    'LOCAL_0503_VERIFICATION_SUITE',
    'STRICT_COMPLETION_COMMAND',
    'STRICT_COMPLETION_VD_WATCH_COMMAND',
    'STRICT_RUNNER_FAILURE_SUMMARY_COMMAND',
    'STRICT_RUNNER_SELF_TEST_COMMAND',
    'DEVHUB_TYPECHECK_COMMAND',
    'DEVHUB_LINT_COMMAND',
    'DEVHUB_DIFF_CHECK_COMMAND',
    'ROOT_DIFF_CHECK_COMMAND',
    'CHECKBOX_MANIFEST_COMMAND',
    'EVIDENCE_PACK_VERIFIER_COMMAND',
    'NO_EMOJI_PROMPT_REPORT_COMMAND',
    'NO_EMOJI_VERIFIER_SELF_TEST_COMMAND',
    'OWNER_EVIDENCE_INTAKE_VERIFIER_COMMAND',
    'OWNER_EVIDENCE_VERIFIER_SELF_TEST_COMMAND',
    'OWNER_EVIDENCE_ACTION_TEMPLATE_COMMAND',
    'OWNER_EVIDENCE_TEMPLATE_DIRECTORY_COMMAND',
    'OWNER_EVIDENCE_RAW_TEMPLATE_COMMAND',
    'OWNER_ACTION_LIST_COMMAND',
    'OWNER_ACTION_SUMMARY_COMMAND',
    'NEXT_OWNER_COMMANDS_QUERY_COMMAND',
    'OWNER_READINESS_QUERY_COMMAND',
    'OWNER_READINESS_EVIDENCE_DIR_QUERY_COMMAND',
    'PARTIAL_R8_DOSSIER_QUERY_COMMAND',
    'PARTIAL_R8_DOSSIER_FILE_QUERY_COMMAND',
    'OWNER_SOURCE_FILE_DOSSIER_COMMAND',
    'OWNER_CLOSURE_BUNDLE_QUERY_COMMAND',
    'OWNER_BLOCKER_TAXONOMY_COMMAND',
    'OWNER_OUTPUT_MATRIX_COMMAND',
    'OWNER_EVIDENCE_BATCH_VERIFIER_COMMAND',
    'OWNER_EVIDENCE_COMPLETE_BATCH_VERIFIER_COMMAND'
  ]) {
    assert(commandIds.has(id), `completion audit missing command checklist item ${id}`)
  }
  const localCommand = commands.find(row => row.id === 'LOCAL_0503_VERIFICATION_SUITE')
  assert(localCommand?.command === 'pnpm check:0503-local', 'completion audit local verification command mismatch')
  assert(localCommand?.evidencePath === relativeRepoPath(rootPackageJsonPath), 'completion audit local verification evidencePath mismatch')
  const noEmojiCommand = commands.find(row => row.id === 'NO_EMOJI_PROMPT_REPORT_COMMAND')
  assert(noEmojiCommand?.command === 'pnpm check:0503-no-emoji', 'completion audit no-emoji command mismatch')
  assert(noEmojiCommand?.evidencePath === relativeRepoPath(noEmojiVerifierPath), 'completion audit no-emoji evidencePath mismatch')
  assert(noEmojiCommand?.requirement === 'Verify prompts/0503, prompts/0503-2, and active task Markdown/JSON/JSONL artifacts contain no emoji glyphs.', 'completion audit no-emoji requirement mismatch')
  const noEmojiSelfTestCommand = commands.find(row => row.id === 'NO_EMOJI_VERIFIER_SELF_TEST_COMMAND')
  assert(noEmojiSelfTestCommand?.command === 'pnpm check:0503-no-emoji:self-test', 'completion audit no-emoji self-test command mismatch')
  assert(noEmojiSelfTestCommand?.evidencePath === relativeRepoPath(noEmojiVerifierPath), 'completion audit no-emoji self-test evidencePath mismatch')
  assert(noEmojiSelfTestCommand?.requirement === 'Verify the no-emoji verifier accepts clean Markdown and rejects emoji glyphs in Markdown, JSON, and JSONL fixtures before scanning real prompt and task artifacts.', 'completion audit no-emoji self-test requirement mismatch')
  const ownerEvidenceCommand = commands.find(row => row.id === 'OWNER_EVIDENCE_INTAKE_VERIFIER_COMMAND')
  const evidencePackCommand = commands.find(row => row.id === 'EVIDENCE_PACK_VERIFIER_COMMAND')
  assertEvidencePackVerifierRequirement(evidencePackCommand)
  assert(ownerEvidenceCommand?.command === 'pnpm check:0503-owner-evidence -- --evidence <submission.json>', 'completion audit owner evidence command mismatch')
  assert(ownerEvidenceCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner evidence verifier evidencePath mismatch')
  assert(ownerEvidenceCommand?.requirement === 'Validate owner-submitted external/product evidence metadata, required schemaVersion, hashAlgorithm, evidenceModifiedAt, and evidenceSizeBytes matching, canonical actionId matching, command alignment, evidence timestamp and file mtime freshness, file existence, binary-safe SHA-256 integrity with explicit hashAlgorithm reporting, self-referential evidence rejection, structured checkbox closure evidence, structured external blocker or zero-egress semantic pass evidence, and versioned non-completion boundary output before rerunning strict completion.', 'completion audit owner evidence requirement mismatch')
  const ownerEvidenceSelfTestCommand = commands.find(row => row.id === 'OWNER_EVIDENCE_VERIFIER_SELF_TEST_COMMAND')
  assert(ownerEvidenceSelfTestCommand?.command === 'pnpm check:0503-owner-evidence:self-test', 'completion audit owner evidence self-test command mismatch')
  assert(ownerEvidenceSelfTestCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner evidence self-test evidencePath mismatch')
  assert(ownerEvidenceSelfTestCommand?.requirement === 'Verify the owner evidence intake verifier rejects missing or wrong submission schemaVersion, missing or wrong submission hashAlgorithm, missing or mismatched submission evidenceModifiedAt/evidenceSizeBytes, ambiguous action ids, stale timestamps, stale evidence file mtimes, self-referential evidence paths, failed structured gate reports, mismatched checkbox closure evidence, command mismatches, path traversal, and false completion boundary claims while hashing binary evidence bytes; verifies evidence hash schemaVersion, hashAlgorithm, boundary, file size, and file mtime metadata plus validation summary hashAlgorithm, coverage report hashAlgorithm, validation schemaVersion boundaries, owner action list action/template commands, owner summary schemaVersion boundaries, template directory schemaVersion boundaries, owner readiness top-level blocking action/taxonomy aggregates with action/template command arrays in both normal and evidence-dir coverage modes, owner closure bundle taxonomy command arrays, owner closure bundle source-file dossier commands, source-file dossier verification command notes, owner closure bundle action verification command notes, owner output matrix verification note coverage floors including blocker taxonomy row notes, and no-partial-r8-rows owner output; and locks template README workflow guidance plus owner action dossier command payloads, owner template verification command notes, and owner action dossier shell-boundary notes for direct-template-validation refusal, owner-readiness evidence-dir validation, require-complete, and final strict rerun.', 'completion audit owner evidence self-test requirement mismatch')
  assertOwnerTemplateReadmeWorkflow(ownerSubmissionTemplatesReadmePath, 'owner submission template')
  assertOwnerTemplateReadmeWorkflow(ownerRawEvidenceTemplatesReadmePath, 'raw evidence template')
  const strictCompletionVdWatchCommand = commands.find(row => row.id === 'STRICT_COMPLETION_VD_WATCH_COMMAND')
  assert(strictCompletionVdWatchCommand?.command === 'pnpm --silent check:0503-strict:vd-watch', 'completion audit strict vd-watch command mismatch')
  assert(strictCompletionVdWatchCommand?.evidencePath === relativeRepoPath(strictRunnerPath), 'completion audit strict vd-watch evidencePath mismatch')
  assert(strictCompletionVdWatchCommand?.requirement === 'Run strict completion through a shell-portable Node flag that sets DEVHUB_R8_VD_FOREGROUND_WATCH=1 before external blocker probes, avoiding WSL/bash environment-prefix drift.', 'completion audit strict vd-watch requirement mismatch')
  const ownerEvidenceTemplateCommand = commands.find(row => row.id === 'OWNER_EVIDENCE_ACTION_TEMPLATE_COMMAND')
  assert(ownerEvidenceTemplateCommand?.command === 'pnpm check:0503-owner-evidence -- --print-template --action <actionId>', 'completion audit owner evidence action template command mismatch')
  assert(ownerEvidenceTemplateCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner evidence action template evidencePath mismatch')
  assert(ownerEvidenceTemplateCommand?.requirement === 'Generate an action-specific owner evidence submission template with the canonical actionId, owner, evidenceModifiedAt/evidenceSizeBytes placeholders, hashAlgorithm=sha256, verification command, verification command note, current evidence, required evidence, and unblock rule prefilled.', 'completion audit owner evidence action template requirement mismatch')
  const ownerEvidenceTemplateDirectoryCommand = commands.find(row => row.id === 'OWNER_EVIDENCE_TEMPLATE_DIRECTORY_COMMAND')
  assert(ownerEvidenceTemplateDirectoryCommand?.command === 'pnpm check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner <owner>', 'completion audit owner evidence template directory command mismatch')
  assert(ownerEvidenceTemplateDirectoryCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner evidence template directory evidencePath mismatch')
  assert(ownerEvidenceTemplateDirectoryCommand?.requirement === 'Generate non-passable templateOnly owner evidence submission templates with evidenceModifiedAt/evidenceSizeBytes placeholders, hashAlgorithm=sha256, and verification command notes for a selected owner lane so owners can prepare every required submission without copying JSON from chat output.', 'completion audit owner evidence template directory requirement mismatch')
  const ownerEvidenceRawTemplateCommand = commands.find(row => row.id === 'OWNER_EVIDENCE_RAW_TEMPLATE_COMMAND')
  assert(ownerEvidenceRawTemplateCommand?.command === 'pnpm check:0503-owner-evidence -- --print-evidence-template --action <actionId>', 'completion audit owner evidence raw template command mismatch')
  assert(ownerEvidenceRawTemplateCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner evidence raw template evidencePath mismatch')
  assert(ownerEvidenceRawTemplateCommand?.requirement === 'Generate a non-passable templateOnly raw evidence shape for the selected action, including action-specific verification command notes when applicable, so owners know the required evidence schema without allowing the template itself to close the action.', 'completion audit owner evidence raw template requirement mismatch')
  const ownerActionListCommand = commands.find(row => row.id === 'OWNER_ACTION_LIST_COMMAND')
  assert(ownerActionListCommand?.command === 'pnpm check:0503-owner-evidence -- --list-actions', 'completion audit owner action list command mismatch')
  assert(ownerActionListCommand?.evidencePath === relativeRepoPath(ownerActionQueueJsonPath), 'completion audit owner action list evidencePath mismatch')
  assert(ownerActionListCommand?.requirement === 'List and validate the current owner action queue canonical ids, owners, current evidence, required evidence, action dossier commands, raw evidence template commands, submission template commands, verification commands, and verification command notes before any external evidence submission is accepted.', 'completion audit owner action list requirement mismatch')
  const ownerActionSummaryCommand = commands.find(row => row.id === 'OWNER_ACTION_SUMMARY_COMMAND')
  assert(ownerActionSummaryCommand?.command === 'pnpm check:0503-owner-evidence -- --owner-summary', 'completion audit owner action summary command mismatch')
  assert(ownerActionSummaryCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner action summary evidencePath mismatch')
  assert(ownerActionSummaryCommand?.requirement === 'Summarize owner evidence responsibility lanes, per-owner action ids, closure-kind counts, required verification commands, and verification command notes without changing strict completion status.', 'completion audit owner action summary requirement mismatch')
  const nextOwnerCommandsCommand = commands.find(row => row.id === 'NEXT_OWNER_COMMANDS_QUERY_COMMAND')
  assert(nextOwnerCommandsCommand?.command === 'pnpm check:0503-owner-evidence -- --next-owner-commands --owner <owner>', 'completion audit next owner commands query command mismatch')
  assert(nextOwnerCommandsCommand?.evidencePath === relativeRepoPath(completionStatusJsonPath), 'completion audit next owner commands query evidencePath mismatch')
  assert(nextOwnerCommandsCommand?.requirement === 'Query the generated next-owner command index for an owner lane, including readiness, readiness evidence-dir, summary, blocker taxonomy, partial R8 dossier, closure bundle, require-complete, action list, and template directory commands without treating the command index as evidence.', 'completion audit next owner commands query requirement mismatch')
  const ownerReadinessCommand = commands.find(row => row.id === 'OWNER_READINESS_QUERY_COMMAND')
  assert(ownerReadinessCommand?.command === 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>', 'completion audit owner readiness query command mismatch')
  assert(ownerReadinessCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner readiness query evidencePath mismatch')
  assert(ownerReadinessCommand?.requirement === 'Summarize one owner lane across blocking action details including verification command notes, top-level machine-readable blocking action and taxonomy aggregates, action dossier commands, raw evidence template commands, submission template commands, taxonomy command arrays, next-owner commands, blocker taxonomy rows, closure bundle commands, weighted open rows, require-complete evidence intake commands, and optional evidence-dir coverage without treating readiness as completion evidence.', 'completion audit owner readiness query requirement mismatch')
  const ownerReadinessEvidenceDirCommand = commands.find(row => row.id === 'OWNER_READINESS_EVIDENCE_DIR_QUERY_COMMAND')
  assert(ownerReadinessEvidenceDirCommand?.command === 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>', 'completion audit owner readiness evidence-dir query command mismatch')
  assert(ownerReadinessEvidenceDirCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner readiness evidence-dir query evidencePath mismatch')
  assert(ownerReadinessEvidenceDirCommand?.requirement === 'Summarize one owner lane with verification command notes, top-level machine-readable blocking action and taxonomy aggregates plus action dossier commands, raw evidence template commands, submission template commands, and taxonomy command arrays while evaluating real submitted evidence-dir coverage and still treating strict completion as the authoritative final gate.', 'completion audit owner readiness evidence-dir query requirement mismatch')
  const partialR8DossierCommand = commands.find(row => row.id === 'PARTIAL_R8_DOSSIER_QUERY_COMMAND')
  assert(partialR8DossierCommand?.command === 'pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner <owner>', 'completion audit partial R8 dossier query command mismatch')
  assert(partialR8DossierCommand?.evidencePath === relativeRepoPath(completionAuditJsonPath), 'completion audit partial R8 dossier query evidencePath mismatch')
  assert(partialR8DossierCommand?.requirement === 'Query remaining partial R8 rows with linked owner action ids, action dossier command arrays, raw evidence template command arrays, submission template command arrays, verification command notes and arrays, owner readiness evidence-dir commands, no-partial-r8-rows owner output, and strict completion boundaries without treating the dossier as closure evidence.', 'completion audit partial R8 dossier query requirement mismatch')
  const partialR8DossierFileCommand = commands.find(row => row.id === 'PARTIAL_R8_DOSSIER_FILE_QUERY_COMMAND')
  assert(partialR8DossierFileCommand?.command === 'pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner <owner> --file <prompt-file>', 'completion audit partial R8 dossier file query command mismatch')
  assert(partialR8DossierFileCommand?.evidencePath === relativeRepoPath(completionAuditJsonPath), 'completion audit partial R8 dossier file query evidencePath mismatch')
  assert(partialR8DossierFileCommand?.requirement === 'Query one remaining partial R8 PRD/spec row with linked owner action ids, action dossier command arrays, raw evidence template command arrays, submission template command arrays, verification command notes and arrays, owner readiness evidence-dir commands, and strict completion boundaries without treating the dossier or templates as closure evidence.', 'completion audit partial R8 dossier file query requirement mismatch')
  const ownerSourceFileDossierCommand = commands.find(row => row.id === 'OWNER_SOURCE_FILE_DOSSIER_COMMAND')
  assert(ownerSourceFileDossierCommand?.command === 'pnpm check:0503-owner-evidence -- --source-file-dossier --action <actionId> --file <prompt-file>', 'completion audit owner source-file dossier command mismatch')
  assert(ownerSourceFileDossierCommand?.evidencePath === relativeRepoPath(ownerActionQueueJsonPath), 'completion audit owner source-file dossier evidencePath mismatch')
  assert(ownerSourceFileDossierCommand?.requirement === 'Query one owner action source prompt file with its row count, owner, action dossier command, raw evidence template command, submission template command, verification command, verification command note, required evidence, and strict completion boundary without treating the source-file dossier as closure evidence.', 'completion audit owner source-file dossier requirement mismatch')
  const ownerBlockerTaxonomyCommand = commands.find(row => row.id === 'OWNER_BLOCKER_TAXONOMY_COMMAND')
  assert(ownerBlockerTaxonomyCommand?.command === 'pnpm check:0503-owner-evidence -- --blocker-taxonomy --owner <owner>', 'completion audit owner blocker taxonomy command mismatch')
  assert(ownerBlockerTaxonomyCommand?.evidencePath === relativeRepoPath(completionAuditJsonPath), 'completion audit owner blocker taxonomy evidencePath mismatch')
  assert(ownerBlockerTaxonomyCommand?.requirement === 'Query owner-filtered blocker taxonomy rows, category counts, weighted open rows, sources, action dossier commands and arrays, raw evidence template commands and arrays, submission template commands and arrays, verification command notes and arrays, and strict commands as diagnostic execution aids without treating taxonomy as completion evidence.', 'completion audit owner blocker taxonomy requirement mismatch')
  const ownerOutputMatrixCommand = commands.find(row => row.id === 'OWNER_OUTPUT_MATRIX_COMMAND')
  assert(ownerOutputMatrixCommand?.command === 'pnpm check:0503-owner-evidence -- --owner-output-matrix', 'completion audit owner output matrix command mismatch')
  assert(ownerOutputMatrixCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner output matrix evidencePath mismatch')
  assert(ownerOutputMatrixCommand?.requirement === 'Verify all current owner-facing JSON query surfaces expose source-file dossier, action dossier, raw evidence template, submission template, recommended strict commands, owner action verification command notes with per-owner coverage floors, and blocker taxonomy row verification notes across every owner lane without treating discoverability as completion evidence.', 'completion audit owner output matrix requirement mismatch')
  const ownerClosureBundleQueryCommand = commands.find(row => row.id === 'OWNER_CLOSURE_BUNDLE_QUERY_COMMAND')
  assert(ownerClosureBundleQueryCommand?.command === 'pnpm check:0503-owner-evidence -- --owner-closure-bundles --owner <owner>', 'completion audit owner closure bundle query command mismatch')
  assert(ownerClosureBundleQueryCommand?.evidencePath === relativeRepoPath(ownerClosureBundlesJsonPath), 'completion audit owner closure bundle query evidencePath mismatch')
  assert(ownerClosureBundleQueryCommand?.requirement === 'Query owner-scoped closure bundles that link current blockers, blocker taxonomy rows, guard backlinks, source-file dossier commands, action dossier commands and arrays, raw evidence template commands and arrays, submission template commands and arrays, verification command notes, and strict completion commands without treating the bundle as evidence.', 'completion audit owner closure bundle query requirement mismatch')
  const ownerEvidenceBatchCommand = commands.find(row => row.id === 'OWNER_EVIDENCE_BATCH_VERIFIER_COMMAND')
  assert(ownerEvidenceBatchCommand?.command === 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir>', 'completion audit owner evidence batch command mismatch')
  assert(ownerEvidenceBatchCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner evidence batch evidencePath mismatch')
  assert(ownerEvidenceBatchCommand?.requirement === 'Validate a directory of owner evidence submission JSON files, reject duplicate actionIds, report submitted and missing actionIds by owner, and keep strict completion as the authoritative final gate.', 'completion audit owner evidence batch requirement mismatch')
  const ownerEvidenceCompleteBatchCommand = commands.find(row => row.id === 'OWNER_EVIDENCE_COMPLETE_BATCH_VERIFIER_COMMAND')
  assert(ownerEvidenceCompleteBatchCommand?.command === 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --require-complete', 'completion audit owner evidence complete batch command mismatch')
  assert(ownerEvidenceCompleteBatchCommand?.evidencePath === relativeRepoPath(ownerEvidenceVerifierPath), 'completion audit owner evidence complete batch evidencePath mismatch')
  assert(ownerEvidenceCompleteBatchCommand?.requirement === 'Require a directory of owner evidence submission JSON files to cover every current owner action before final strict completion is attempted.', 'completion audit owner evidence complete batch requirement mismatch')
  const strictRunnerSelfTestCommand = commands.find(row => row.id === 'STRICT_RUNNER_SELF_TEST_COMMAND')
  assert(strictRunnerSelfTestCommand?.command === 'pnpm check:0503-strict:self-test', 'completion audit strict runner self-test command mismatch')
  assert(strictRunnerSelfTestCommand?.evidencePath === relativeRepoPath(strictRunnerPath), 'completion audit strict runner self-test evidencePath mismatch')
  const strictRunnerFailureSummaryCommand = commands.find(row => row.id === 'STRICT_RUNNER_FAILURE_SUMMARY_COMMAND')
  assert(strictRunnerFailureSummaryCommand?.command === 'pnpm check:0503-strict', 'completion audit strict runner failure summary command mismatch')
  assert(strictRunnerFailureSummaryCommand?.evidencePath === relativeRepoPath(strictRunnerPath), 'completion audit strict runner failure summary evidencePath mismatch')
  assert(strictRunnerFailureSummaryCommand?.requirement === 'When strict completion is not yet satisfied, print a concise non-stack blocker summary with failed external gate evidence snapshots, failed external gate action dossier commands, failed external gate verification notes, failed external gate raw evidence template commands, failed external gate submission template commands, blocker taxonomy, owner lane command-set details, owner readiness commands, owner readiness evidence-dir commands, owner readiness coverage-artifact commands, raw and submission template directory commands, coverage report and coverage JSON commands, partial R8 dossier commands, owner blocker taxonomy commands, and owner closure bundle commands while preserving the non-zero exit code.', 'completion audit strict runner failure summary requirement mismatch')
  const devhubTypecheckCommand = commands.find(row => row.id === 'DEVHUB_TYPECHECK_COMMAND')
  assert(devhubTypecheckCommand?.command === 'pnpm -C devhub typecheck', 'completion audit devhub typecheck command mismatch')
  assert(devhubTypecheckCommand?.evidencePath === relativeRepoPath(devhubPackageJsonPath), 'completion audit devhub typecheck evidencePath mismatch')
  const devhubLintCommand = commands.find(row => row.id === 'DEVHUB_LINT_COMMAND')
  assert(devhubLintCommand?.command === 'pnpm -C devhub lint', 'completion audit devhub lint command mismatch')
  assert(devhubLintCommand?.evidencePath === relativeRepoPath(devhubPackageJsonPath), 'completion audit devhub lint evidencePath mismatch')
  const devhubDiffCheckCommand = commands.find(row => row.id === 'DEVHUB_DIFF_CHECK_COMMAND')
  assert(devhubDiffCheckCommand?.command === 'git -C devhub diff --check', 'completion audit devhub diff check command mismatch')
  assert(devhubDiffCheckCommand?.evidencePath === relativeRepoPath(devhubPackageJsonPath), 'completion audit devhub diff check evidencePath mismatch')
  const rootDiffCheckCommand = commands.find(row => row.id === 'ROOT_DIFF_CHECK_COMMAND')
  assert(rootDiffCheckCommand?.command === 'git diff --check', 'completion audit root diff check command mismatch')
  assert(rootDiffCheckCommand?.evidencePath === relativeRepoPath(rootPackageJsonPath), 'completion audit root diff check evidencePath mismatch')

  const checkboxClosureClassCount = Object.keys(r8OpenClosureKindCounts(pack.promptCheckboxManifest ?? {})).length
	  const expectedOpenRequirementCount = pack.partialR8Rows.length + pack.failedExternalGates.length + pack.surveyAcceptanceRows.length + checkboxClosureClassCount
	  const openRequirements = Array.isArray(completionAudit.missingOrIncompleteRequirements) ? completionAudit.missingOrIncompleteRequirements : []
	  assert(openRequirements.length === expectedOpenRequirementCount, `completion audit open requirement count mismatch: expected ${expectedOpenRequirementCount}, found ${openRequirements.length}`)
	  verifyOpenRequirementExternalOwnerBoundary(openRequirements, ownerActionQueue)
	  const strictBlockerCrosswalk = Array.isArray(completionAudit.strictBlockerCrosswalk) ? completionAudit.strictBlockerCrosswalk : []
	  assert(strictBlockerCrosswalk.length === openRequirements.length, `completion audit strict blocker crosswalk count mismatch: expected ${openRequirements.length}, found ${strictBlockerCrosswalk.length}`)
	  const crosswalkById = new Map(strictBlockerCrosswalk.map(row => [`${row.requirementType}:${row.id}`, row]))
		  const ownerActionsById = new Map((ownerActionQueue.actions ?? []).map(action => [action.actionId, action]))
		  const expectedOwnerCommand = (actionId, field, commandFlag) => {
		    const action = ownerActionsById.get(actionId)
		    return action?.[field] ?? `pnpm --silent check:0503-owner-evidence -- --${commandFlag} --action ${actionId}`
		  }
	  for (const requirement of openRequirements) {
    const row = crosswalkById.get(`${requirement.requirementType}:${requirement.id}`)
    assert(row, `completion audit strict blocker crosswalk missing ${requirement.requirementType}:${requirement.id}`)
	    assert(row.strictCompletionCommand === 'pnpm check:0503-strict', `completion audit strict blocker crosswalk strict command mismatch for ${requirement.id}`)
		    assert(requirement.strictCompletionCommand === 'pnpm check:0503-strict', `completion audit missing requirement strict command mismatch for ${requirement.id}`)
		    assert(requirement.recommendedStrictCompletionCommand === 'pnpm --silent check:0503-strict:vd-watch', `completion audit missing requirement recommended strict command mismatch for ${requirement.id}`)
		    const requirementOwnerActionIds = Array.isArray(requirement.ownerActionIds) ? requirement.ownerActionIds : []
	    const expectedActionDossierCommands = requirementOwnerActionIds.map(actionId => expectedOwnerCommand(actionId, 'actionDossierCommand', 'action-dossier'))
    const expectedRawEvidenceTemplateCommands = requirementOwnerActionIds.map(actionId => expectedOwnerCommand(actionId, 'rawEvidenceTemplateCommand', 'print-evidence-template'))
    const expectedSubmissionTemplateCommands = requirementOwnerActionIds.map(actionId => expectedOwnerCommand(actionId, 'submissionTemplateCommand', 'print-template'))
    assert(JSON.stringify(requirement.actionDossierCommands ?? []) === JSON.stringify(expectedActionDossierCommands), `completion audit missing requirement dossier commands mismatch for ${requirement.id}`)
    assert(JSON.stringify(requirement.rawEvidenceTemplateCommands ?? []) === JSON.stringify(expectedRawEvidenceTemplateCommands), `completion audit missing requirement raw template commands mismatch for ${requirement.id}`)
    assert(JSON.stringify(requirement.submissionTemplateCommands ?? []) === JSON.stringify(expectedSubmissionTemplateCommands), `completion audit missing requirement submission template commands mismatch for ${requirement.id}`)
    assert(JSON.stringify(row.actionDossierCommands ?? []) === JSON.stringify(expectedActionDossierCommands), `completion audit crosswalk dossier commands mismatch for ${requirement.id}`)
    assert(JSON.stringify(row.rawEvidenceTemplateCommands ?? []) === JSON.stringify(expectedRawEvidenceTemplateCommands), `completion audit crosswalk raw template commands mismatch for ${requirement.id}`)
    assert(JSON.stringify(row.submissionTemplateCommands ?? []) === JSON.stringify(expectedSubmissionTemplateCommands), `completion audit crosswalk submission template commands mismatch for ${requirement.id}`)
    if (requirementOwnerActionIds.length === 1) {
      assert(requirement.actionDossierCommand === expectedActionDossierCommands[0], `completion audit missing requirement dossier command mismatch for ${requirement.id}`)
      assert(requirement.rawEvidenceTemplateCommand === expectedRawEvidenceTemplateCommands[0], `completion audit missing requirement raw template command mismatch for ${requirement.id}`)
      assert(requirement.submissionTemplateCommand === expectedSubmissionTemplateCommands[0], `completion audit missing requirement submission template command mismatch for ${requirement.id}`)
      assert(row.actionDossierCommand === expectedActionDossierCommands[0], `completion audit crosswalk dossier command mismatch for ${requirement.id}`)
      assert(row.rawEvidenceTemplateCommand === expectedRawEvidenceTemplateCommands[0], `completion audit crosswalk raw template command mismatch for ${requirement.id}`)
      assert(row.submissionTemplateCommand === expectedSubmissionTemplateCommands[0], `completion audit crosswalk submission template command mismatch for ${requirement.id}`)
    } else {
      assert(requirement.actionDossierCommand === null, `completion audit missing requirement singular dossier command should be null for ${requirement.id}`)
      assert(requirement.rawEvidenceTemplateCommand === null, `completion audit missing requirement singular raw template command should be null for ${requirement.id}`)
      assert(requirement.submissionTemplateCommand === null, `completion audit missing requirement singular submission template command should be null for ${requirement.id}`)
      assert(row.actionDossierCommand === null, `completion audit crosswalk singular dossier command should be null for ${requirement.id}`)
      assert(row.rawEvidenceTemplateCommand === null, `completion audit crosswalk singular raw template command should be null for ${requirement.id}`)
      assert(row.submissionTemplateCommand === null, `completion audit crosswalk singular submission template command should be null for ${requirement.id}`)
    }
    if (requirement.requirementType === 'failed-external-gate' || requirement.requirementType === 'open-checkbox-closure-class') {
      assert(row.ownerActionId === requirement.id, `completion audit owner action crosswalk mismatch for ${requirement.id}`)
      assert(row.actionDossierCommand === `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${requirement.id}`, `completion audit dossier command mismatch for ${requirement.id}`)
    }
  }
}

function verifyCompletionAuditMarkdownText(markdown, completionAudit) {
  assert(completionAudit.schemaVersion === completionAuditSchemaVersion, `completion audit schemaVersion must be ${completionAuditSchemaVersion}`)
  const promptRows = completionAudit.promptToArtifactChecklist ?? []
  const blockerTaxonomy = completionAudit.blockerTaxonomy ?? {}
  const requiredTexts = [
    '# 0503 Completion Audit',
    `Schema version: ${completionAudit.schemaVersion}`,
    `Status: ${completionAudit.status}`,
    `Acceptance status: ${completionAudit.acceptanceStatus}`,
    '## Objective',
    completionAudit.objective,
    '## Source Evidence',
    '## Prompt-to-Artifact Checklist',
    'This checklist maps each explicit prompt requirement, named file, command, test, gate, and deliverable to concrete evidence.',
    '### Requirement Coverage',
    '### Named Commands, Tests, and Gates',
    '## Completion Guard Evidence',
    '## Completion Guard Owner Crosswalk',
    '## Owner Action Guard Backlinks',
    '## Blocker Taxonomy',
    `- Total taxonomy rows: ${blockerTaxonomy.totalTaxonomyRows ?? 0}`,
    `- Total weighted open rows: ${blockerTaxonomy.totalWeightedOpenRows ?? 0}`,
    '### Category Counts',
    '### Owner Counts',
    '### Taxonomy Rows',
    '## Prompt-To-Artifact Checklist',
    `- Total rows: ${promptRows.length}`,
    `- prompts/0503 rows: ${promptRows.filter(row => row.scope === 'prompts/0503').length}`,
    `- prompts/0503-2 rows: ${promptRows.filter(row => row.scope === 'prompts/0503-2').length}`,
    '- Full row details are written to `0503-completion-audit.json` under `promptToArtifactChecklist`.',
    '## Partial R8 Dossier',
    '## Missing Or Incomplete Requirements',
    '## Strict Blocker Crosswalk',
    '## Boundary',
    '- This audit is generated evidence, not a waiver.',
    '- A blocked row remains blocked until the referenced real evidence exists and the strict completion command passes.'
  ]
  for (const requiredText of requiredTexts) {
    assert(markdown.includes(requiredText), `completion audit markdown missing required text: ${requiredText}`)
  }
  for (const evidencePath of completionAudit.sourceEvidence ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([evidencePath])),
      `completion audit markdown missing source evidence row: ${evidencePath}`
    )
  }
  for (const row of completionAudit.successCriteria ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([
        row.id,
        truncateMarkdownValue(row.requirement),
        row.expected,
        row.actual,
        row.status,
        truncateMarkdownValue((row.ownerActionIds ?? []).join('; ')),
        truncateMarkdownValue((row.actionDossierCommands ?? []).join('; ')),
        truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; ')),
        row.evidencePath
      ])),
      `completion audit markdown missing success criterion row: ${row.id}`
    )
  }
  for (const row of completionAudit.commandChecklist ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([row.id, row.command, row.status, row.evidencePath, truncateMarkdownValue(row.requirement)])),
      `completion audit markdown missing command checklist row: ${row.id}`
    )
  }
  for (const row of completionAudit.completionGuardEvidence ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([row.guard, row.passed, row.evidence, row.verificationCommand, row.blockerCount, truncateMarkdownValue((row.blockers ?? []).join('; ')), row.auditEvidencePath])),
      `completion audit markdown missing guard evidence row: ${row.guard}`
    )
  }
  for (const row of completionAudit.completionGuardOwnerCrosswalk ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([
        row.guard,
        row.blocker,
        row.blockerType,
        (row.ownerActionIds ?? []).join('; '),
        (row.owners ?? []).join('; '),
        truncateMarkdownValue((row.verificationCommands ?? []).join('; ')),
        truncateMarkdownValue((row.actionDossierCommands ?? []).join('; ')),
        truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; ')),
        row.guardEvidencePath
      ])),
      `completion audit markdown missing guard owner crosswalk row: ${row.guard}:${row.blocker}`
    )
  }
  for (const row of completionAudit.ownerActionGuardBacklinks ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([
        row.actionId,
        row.owner,
        (row.guardsBlocked ?? []).join('; '),
        truncateMarkdownValue((row.blockers ?? []).join('; ')),
        truncateMarkdownValue(row.verificationCommand),
        truncateMarkdownValue((row.actionDossierCommands ?? []).join('; ')),
        truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; '))
      ])),
      `completion audit markdown missing owner action backlink row: ${row.actionId}`
    )
  }
  for (const [category, count] of Object.entries(blockerTaxonomy.categoryCounts ?? {})) {
    assert(
      markdown.includes(renderedMarkdownRow([category, count, blockerTaxonomy.categoryWeightedOpenRows?.[category] ?? 0])),
      `completion audit markdown missing category count row: ${category}`
    )
  }
  for (const [owner, count] of Object.entries(blockerTaxonomy.ownerCounts ?? {})) {
    assert(
      markdown.includes(renderedMarkdownRow([owner, count, blockerTaxonomy.ownerWeightedOpenRows?.[owner] ?? 0])),
      `completion audit markdown missing owner count row: ${owner}`
    )
  }
  for (const row of blockerTaxonomy.rows ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([
        row.category,
        row.requirementType,
        row.id,
        row.owner,
        (row.ownerActionIds ?? []).join('; '),
        row.weightedOpenRows,
        truncateMarkdownValue(row.verificationCommand),
        truncateMarkdownValue((row.actionDossierCommands ?? []).join('; ')),
        truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; ')),
        row.source
      ])),
      `completion audit markdown missing taxonomy row: ${row.requirementType}:${row.id}`
    )
  }
  for (const row of completionAudit.partialR8Dossier ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([
        row.file,
        row.status,
        (row.ownerActionIds ?? []).join('; '),
        row.verificationCommand,
        truncateMarkdownValue((row.ownerActionDossierCommands ?? []).join('; ')),
        truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; ')),
        row.strictCompletionCommand,
        row.sourceEvidencePath,
        truncateMarkdownValue(row.nextAction)
      ])),
      `completion audit markdown missing partial R8 dossier row: ${row.file}`
    )
  }
  for (const row of completionAudit.missingOrIncompleteRequirements ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([
        row.requirementType,
        row.id,
        row.owner,
        (row.ownerActionIds ?? []).join('; '),
        truncateMarkdownValue(row.verificationCommand),
        truncateMarkdownValue((row.actionDossierCommands ?? []).join('; ')),
        truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; ')),
        row.strictCompletionCommand,
        truncateMarkdownValue(row.evidence),
        row.source
      ])),
      `completion audit markdown missing missing/incomplete row: ${row.requirementType}:${row.id}`
    )
  }
  for (const row of completionAudit.strictBlockerCrosswalk ?? []) {
    assert(
      markdown.includes(renderedMarkdownRow([
        row.requirementType,
        row.id,
        (row.ownerActionIds ?? []).join('; '),
        truncateMarkdownValue(row.verificationCommand),
        truncateMarkdownValue((row.actionDossierCommands ?? []).join('; ')),
        truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
        truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; ')),
        row.strictCompletionCommand
      ])),
      `completion audit markdown missing strict blocker crosswalk row: ${row.requirementType}:${row.id}`
    )
  }
}

function verifyCompletionAuditMarkdown(completionAudit) {
  verifyCompletionAuditMarkdownText(readText(completionAuditMarkdownPath), completionAudit)
}

function verifyRootPackageScripts() {
  const packageJson = readJson(rootPackageJsonPath)
  const scripts = packageJson.scripts ?? {}
  assert(
    scripts['check:0503-acceptance-pack:no-refresh'] === 'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/generate-0503-acceptance-pack.mjs --no-refresh && node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-evidence-pack.mjs',
    'root package.json missing check:0503-acceptance-pack:no-refresh script'
  )
  assert(scripts['check:0503-local'] === 'pnpm check:0503-checkbox-manifest:self-test && pnpm check:0503-ledgers:self-test && pnpm check:0503-acceptance-pack:self-test && pnpm check:0503-evidence-pack:self-test && pnpm check:0503-no-emoji:self-test && pnpm check:0503-owner-evidence:self-test && pnpm check:0503-acceptance-pack:no-refresh && pnpm check:0503-owner-evidence -- --owner-summary && pnpm check:0503-owner-evidence -- --owner-output-matrix && pnpm check:0503-owner-evidence -- --list-actions && pnpm check:0503-owner-evidence -- --next-owner-commands && pnpm check:0503-strict:self-test && pnpm -C devhub check:browserwindow-second-display:self-test && pnpm -C devhub check:r8-external-blockers:self-test && pnpm -C devhub check:no-emoji && pnpm -C devhub check:zod-sot && pnpm -C devhub check:no-cloud-deps && pnpm -C devhub check:no-ocr-deps && pnpm -C devhub typecheck && pnpm -C devhub lint && git -C devhub diff --check && git diff --check && pnpm check:0503-acceptance-pack:no-refresh && pnpm check:0503-no-emoji', 'root package.json missing check:0503-local script')
  assert(scripts['check:0503-no-emoji'] === 'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-no-emoji.mjs', 'root package.json missing check:0503-no-emoji script')
  assert(scripts['check:0503-no-emoji:self-test'] === 'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-no-emoji.mjs --self-test', 'root package.json missing check:0503-no-emoji:self-test script')
  assert(scripts['check:0503-owner-evidence'] === 'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-owner-evidence.mjs', 'root package.json missing check:0503-owner-evidence script')
  assert(scripts['check:0503-owner-evidence:self-test'] === 'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-owner-evidence.mjs --self-test', 'root package.json missing check:0503-owner-evidence:self-test script')
  assert(scripts['check:0503-strict'] === 'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/run-0503-strict-completion.mjs', 'root package.json missing check:0503-strict script')
  assert(scripts['check:0503-strict:vd-watch'] === 'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/run-0503-strict-completion.mjs --vd-foreground-watch', 'root package.json missing check:0503-strict:vd-watch script')
  assert(scripts['check:0503-strict:self-test'] === 'node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/run-0503-strict-completion.mjs --self-test', 'root package.json missing check:0503-strict:self-test script')
}

function verifyReferencedArtifacts(pack, completionStatus, completionAudit) {
  verifyEvidencePathExists(relativeRepoPath(ownerClosureBundlesJsonPath), 'owner closure bundles json')
  verifyEvidencePathExists(relativeRepoPath(ownerClosureBundlesMarkdownPath), 'owner closure bundles markdown')
  verifyCompletionStatusArtifactIndex(pack, completionStatus)

  const auditSourceEvidence = Array.isArray(completionAudit.sourceEvidence) ? completionAudit.sourceEvidence : []
  assert(auditSourceEvidence.length > 0, 'completion audit sourceEvidence must not be empty')
  verifyCompletionAuditRequiredSourceEvidenceRows(auditSourceEvidence)
  for (const evidencePath of auditSourceEvidence) {
    verifyEvidencePathExists(evidencePath, 'completion audit sourceEvidence')
  }

  for (const criterion of completionAudit.successCriteria ?? []) {
    verifyEvidencePathExists(criterion.evidencePath, `completion audit success criterion ${criterion.id}`)
  }
	  for (const command of completionAudit.commandChecklist ?? []) {
	    verifyEvidencePathExists(command.evidencePath, `completion audit command checklist ${command.id}`)
	  }
	  verifyBenchmarkReportSchemaVersions()
}

function verifyCompletionAuditRequiredSourceEvidenceRows(sourceEvidenceRows) {
  for (const requiredPath of requiredCompletionAuditSourceEvidencePaths) {
    assert(sourceEvidenceRows.includes(requiredPath), `completion audit sourceEvidence missing required startup evidence path: ${requiredPath}`)
  }
}

function verifyNoTemporaryOwnerTemplateArtifacts(paths = temporaryOwnerTemplateArtifactPaths, exists = existsSync) {
  for (const artifactPath of paths) {
    assert(!exists(resolveRepoPath(artifactPath)), `temporary owner template artifact must be removed before verification: ${artifactPath}`)
  }
}

function verifyBenchmarkReportSchemaVersions() {
  const benchmarkReports = [
	    {
	      label: 'popout 3-BrowserWindow RSS benchmark',
	      path: '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/popout-bw-rss-3bw-2026-05-19.json',
	      requirePassed: true,
	      schemaVersion: popoutBwRssBenchmarkSchemaVersion
	    },
	    {
	      label: 'popout 3-BrowserWindow RSS debug benchmark',
	      path: '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/popout-bw-rss-3bw-debug-2026-05-19.json',
	      requirePassed: false,
	      schemaVersion: popoutBwRssBenchmarkSchemaVersion
	    },
	    {
	      label: 'popout 8-BrowserWindow RSS benchmark',
	      path: '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/popout-bw-rss-8bw-2026-05-19.json',
	      requirePassed: true,
	      schemaVersion: popoutBwRssBenchmarkSchemaVersion
	    },
	    {
	      label: 'thumbnail 100-HWND capture benchmark',
	      path: '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/thumbnail-capture-100hwnd-2026-05-19.json',
	      requirePassed: true,
	      schemaVersion: thumbnailCaptureBenchmarkSchemaVersion
	    }
  ]
  for (const report of benchmarkReports) {
	    verifyEvidencePathExists(report.path, report.label)
	    const artifact = readJson(resolveRepoPath(report.path))
	    assert(artifact.schemaVersion === report.schemaVersion, `${report.label} schemaVersion must be ${report.schemaVersion}`)
	    if (report.requirePassed) assert(artifact.passed === true, `${report.label} must remain a passing real benchmark artifact`)
  }
}

function assertManualTestingDualRunningSurfaceText(markdown) {
  for (const requiredText of manualTestingDualRunningSurfaceRequiredTexts) {
    assert(markdown.includes(requiredText), `manual testing checklist missing dual-running-surface guidance: ${requiredText}`)
  }
}

function assertDevhubStartupDualRunningSurfaceConfig(packageJson, electronViteConfigText) {
  assert(packageJson.scripts?.dev === 'electron-vite dev', 'DevHub dev script must remain electron-vite dev for the documented dual-running surface')
  for (const requiredText of devhubStartupDualRunningSurfaceConfigTexts) {
    assert(electronViteConfigText.includes(requiredText), `electron.vite.config.ts missing dual-running-surface config text: ${requiredText}`)
  }
}

function verifyManualTestingDualRunningSurfaceDocs() {
  assertManualTestingDualRunningSurfaceText(readText(devhubManualTestingChecklistPath))
}

function verifyDevhubStartupDualRunningSurfaceContract() {
  assertDevhubStartupDualRunningSurfaceConfig(readJson(devhubPackageJsonPath), readText(devhubElectronViteConfigPath))
}

function runSelfTest() {
  assert(sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256 should match known digest')
  assert(stripJsonPointerFromPath('a/b.json#/x/y') === 'a/b.json', 'stripJsonPointerFromPath should remove JSON pointer suffix')
  assert(resolveJsonPointerValue({ items: [{ 'a/b': 1, '~key': 2 }] }, '/items/0/a~1b', 'self-test pointer') === 1, 'JSON pointer resolver should decode slash tokens')
  assert(resolveJsonPointerValue({ items: [{ 'a/b': 1, '~key': 2 }] }, '/items/0/~0key', 'self-test pointer') === 2, 'JSON pointer resolver should decode tilde tokens')
  verifyEvidencePathExists('package.json#/scripts/check:0503-evidence-pack', 'self-test package script pointer')
  let missingJsonPointerRejected = false
  try {
    verifyEvidencePathExists('package.json#/scripts/not-real', 'self-test missing pointer')
  } catch (error) {
    missingJsonPointerRejected = String(error.message).includes('JSON pointer missing token')
  }
  assert(missingJsonPointerRejected, 'evidence path verifier should reject missing JSON pointer targets')
  let pathTraversalRejected = false
  try {
    verifyEvidencePathExists('../outside.json', 'self-test path traversal')
  } catch (error) {
    pathTraversalRejected = String(error.message).includes('repo path escapes repo root')
  }
  assert(pathTraversalRejected, 'evidence path verifier should reject paths outside the repository root')
  const auditedPointerCount = verifyPathLikeJsonPointerStrings([
    {
      label: 'self-test artifact pointers',
      value: {
        notes: '@/#/! is plain command-palette prose, not an evidence pointer',
        pointer: 'package.json#/scripts/check:0503-evidence-pack'
      }
    }
  ])
  assert(auditedPointerCount === 1, `path-like JSON pointer collector should ignore prose with #, got ${auditedPointerCount}`)
  let missingPathLikePointerRejected = false
  try {
    verifyPathLikeJsonPointerStrings([{ label: 'self-test bad artifact pointers', value: { pointer: 'package.json#/scripts/not-real' } }])
  } catch (error) {
    missingPathLikePointerRejected = String(error.message).includes('JSON pointer missing token')
  }
  assert(missingPathLikePointerRejected, 'path-like JSON pointer audit should reject missing targets')
  assert(ownerForClosureKind('hardware-verification') === 'operator', 'ownerForClosureKind should route R8 hardware verification')
  assertCountMapEqual({ b: 2, a: 1 }, { a: 1, b: 2 }, 'count map self-test')
  const validTemplateReadme = [
    'These files are `templateOnly` scaffolds.',
    'Do not validate this template directory directly as evidence.',
    'Recommended workflow:',
    'pnpm --silent check:0503-owner-evidence -- --next-owner-commands --owner <owner>',
    'pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>',
    'unknown fields are rejected',
    'evidenceSha256',
	    'hashAlgorithm',
	    'evidenceModifiedAt',
	    'evidenceSizeBytes',
	    'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>',
    'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner <owner> --require-complete',
    'pnpm --silent check:0503-strict:vd-watch'
  ].join('\n')
  assertOwnerTemplateReadmeWorkflowText(validTemplateReadme, 'self-test valid template')
  let weakTemplateReadmeRejected = false
  try {
    assertOwnerTemplateReadmeWorkflowText(validTemplateReadme.replace('Do not validate this template directory directly as evidence.', ''), 'self-test weak template')
	  } catch (error) {
	    weakTemplateReadmeRejected = String(error.message).includes('direct-validation refusal')
	  }
  assert(weakTemplateReadmeRejected, 'template README workflow self-test should reject direct-validation guidance drift')
	  let weakTemplateStrictSchemaRejected = false
	  try {
	    assertOwnerTemplateReadmeWorkflowText(validTemplateReadme.replace('unknown fields are rejected', 'unknown fields are ignored'), 'self-test weak strict-schema template')
	  } catch (error) {
	    weakTemplateStrictSchemaRejected = String(error.message).includes('strict submission schema guidance')
	  }
	  assert(weakTemplateStrictSchemaRejected, 'template README workflow self-test should reject strict submission schema guidance drift')
	  const boundaryOwnerQueue = {
	    actions: [
	      { actionId: 'GATE', owner: 'operator' },
	      { actionId: 'survey-context', owner: 'product' }
	    ]
	  }
	  const validOpenRequirementBoundaryRows = [
	    {
	      evidence: 'real external gate remains blocked',
	      id: 'GATE',
	      owner: 'operator',
	      ownerActionIds: ['GATE'],
	      ownerActionOwners: ['operator'],
	      requirementType: 'failed-external-gate',
	      source: 'r8-external-blockers-current.json',
	      verificationCommands: ['pnpm -C devhub check:browserwindow-second-display']
	    },
	    {
	      evidence: 'product acceptance remains blocked',
	      id: 'prompts/0503/example.md',
	      owner: 'product-or-user',
	      ownerActionIds: ['survey-context'],
	      ownerActionOwners: ['product'],
	      requirementType: 'survey-acceptance-row',
	      source: '0503-survey-acceptance-ledger.md',
	      verificationCommands: ['pnpm check:0503-checkbox-manifest']
	    }
	  ]
	  verifyOpenRequirementExternalOwnerBoundary(validOpenRequirementBoundaryRows, boundaryOwnerQueue)
	  let localCommandBoundaryRejected = false
	  try {
	    verifyOpenRequirementExternalOwnerBoundary([
	      { ...validOpenRequirementBoundaryRows[0], verificationCommands: ['pnpm test'] }
	    ], boundaryOwnerQueue)
	  } catch (error) {
	    localCommandBoundaryRejected = String(error.message).includes('non-owner/external verification command')
	  }
	  assert(localCommandBoundaryRejected, 'open requirement boundary self-test should reject local-only verification commands')
	  let unknownTypeBoundaryRejected = false
	  try {
	    verifyOpenRequirementExternalOwnerBoundary([
	      { ...validOpenRequirementBoundaryRows[0], requirementType: 'local-code-gap' }
	    ], boundaryOwnerQueue)
	  } catch (error) {
	    unknownTypeBoundaryRejected = String(error.message).includes('unclassified local-closure type')
	  }
	  assert(unknownTypeBoundaryRejected, 'open requirement boundary self-test should reject unclassified local closure types')
	  const templateAction = {
    actionId: 'ACTION_ONE',
    currentEvidence: 'not ready',
    owner: 'operator',
    requiredEvidence: 'real evidence',
    unblockRule: 'do not fake evidence',
    verificationCommand: 'pnpm verify-action'
  }
  const templateSubmission = {
    actionId: 'ACTION_ONE',
    approverOrOperatorIdentity: '<real Windows identity, product owner, or legal owner>',
    boundaryStatement: '<what remains unclaimed; do not claim completion because strict completion remains authoritative>',
	    currentEvidence: 'not ready',
	    evidenceFilePath: '<repo-relative path to the real evidence file>',
	    evidenceModifiedAt: '<evidence file mtime from --hash-evidence output>',
	    evidenceSizeBytes: '<evidence file byte size from --hash-evidence output>',
	    evidenceSha256: '<sha256 of evidenceFilePath contents>',
	    hashAlgorithm: 'sha256',
	    evidenceTimestamp: '<ISO timestamp after the current owner action queue was generated>',
    owner: 'operator',
    recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
    requiredEvidence: 'real evidence',
    resultSummary: '<pass/fail and measured values from the real run>',
    schemaVersion: 'devhub-0503-owner-evidence-submission-v1',
    strictCompletionCommand: 'pnpm check:0503-strict',
    templateOnly: true,
    unblockRule: 'do not fake evidence',
    verificationCommand: 'pnpm verify-action'
  }
	  const templateRaw = {
	    schemaVersion: ownerRawEvidenceTemplateSchemaVersion,
	    actionId: 'ACTION_ONE',
    expectedVerificationCommand: 'pnpm verify-action',
    note: 'Do not submit this template as evidence. Run the listed verification command and submit its real output or report.',
    recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
    requiredEvidence: 'real evidence',
    strictCompletionCommand: 'pnpm check:0503-strict',
    templateOnly: true,
    unblockRule: 'do not fake evidence'
  }
  verifyOwnerTemplateDirectoryData(
    { actions: [templateAction] },
    new Map([['ACTION_ONE', templateSubmission]]),
    new Map([['ACTION_ONE', templateRaw]]),
    ['ACTION_ONE.submission-template.json'],
    ['ACTION_ONE.raw-evidence-template.json']
  )
  let staleTemplateRejected = false
  try {
    verifyOwnerTemplateDirectoryData(
      { actions: [templateAction] },
      new Map([['ACTION_ONE', { ...templateSubmission, verificationCommand: 'pnpm stale' }]]),
      new Map([['ACTION_ONE', templateRaw]]),
      ['ACTION_ONE.submission-template.json'],
      ['ACTION_ONE.raw-evidence-template.json']
    )
  } catch (error) {
    staleTemplateRejected = String(error.message).includes('verificationCommand mismatch')
  }
  assert(staleTemplateRejected, 'current owner template directory self-test should reject stale submission templates')
  verifyCheckboxLocalClosureCounts({
    localClosureBlockedOpenRows: 1,
    localClosurePossibleOpenRows: 1,
    rows: [
      { checked: false, localClosurePossible: true },
      { checked: false, localClosurePossible: false },
      { checked: true, localClosurePossible: true }
    ],
    totalOpen: 2
  })
  const markdownQueue = {
    actions: [
      {
        actionId: 'ACTION_ONE',
        actionType: 'external-gate',
        closureKind: 'hardware',
        currentEvidence: 'evidence',
        gateId: 'GATE_ONE',
        owner: 'operator',
        prerequisite: 'precondition',
        actionDossierCommand: 'action-dossier-command ACTION_ONE',
        rawEvidenceTemplateCommand: 'raw-template-command ACTION_ONE',
	        requiredEvidence: 'required evidence',
	        submissionTemplateCommand: 'submission-template-command ACTION_ONE',
	        unblockRule: 'unblock rule',
	        verificationCommand: 'command',
	        verificationCommandNote: secondDisplayVerificationCommandNote
	      }
    ],
    currentEnvironment: {
      displayCount: 1
    },
    ownerCounts: {
      operator: 1
    },
    ownerLaneCommands: [
      {
        coverageJsonCommand: 'coverage-json-command operator',
        coverageReportCommand: 'coverage-command operator',
        listActionsCommand: 'list-command operator',
        owner: 'operator',
        ownerReadinessWithCoverageArtifactsCommand: 'readiness-coverage-artifacts-command operator',
        ownerReadinessWithEvidenceDirCommand: 'readiness-evidence-dir-command operator',
        ownerReadinessCommand: 'readiness-command operator',
        ownerSummaryCommand: 'summary-command operator',
        partialR8DossierCommand: 'partial-r8-dossier-command operator',
        rawEvidenceTemplateDirectoryCommand: 'raw-dir-command operator',
        requireCompleteCommand: 'require-complete-command operator',
        submissionTemplateDirectoryCommand: 'submission-dir-command operator'
      }
    ]
  }
  const ownerQueueMarkdown = [
    ownerActionQueueSchemaVersion,
    '## Owner Execution Plan',
    '## Owner Lane Commands',
    renderedMarkdownRow(['operator', 1]),
    renderedMarkdownRow(['displayCount', 1]),
    renderedMarkdownRow([
      'operator',
      'readiness-command operator',
      'readiness-evidence-dir-command operator',
      'readiness-coverage-artifacts-command operator',
      'summary-command operator',
      'list-command operator',
      'partial-r8-dossier-command operator',
      'submission-dir-command operator',
      'raw-dir-command operator',
      'require-complete-command operator',
      'coverage-command operator',
      'coverage-json-command operator'
    ]),
    '### operator',
    'readiness-command operator',
    'readiness-evidence-dir-command operator',
    'readiness-coverage-artifacts-command operator',
    'summary-command operator',
    'list-command operator',
    'partial-r8-dossier-command operator',
    'submission-dir-command operator',
    'raw-dir-command operator',
    'require-complete-command operator',
    'coverage-command operator',
    'coverage-json-command operator',
    '| Action id | Closure kind | Current evidence | Submission template | Raw evidence template | Action dossier | Verification command | Verification command note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    renderedMarkdownRow(['ACTION_ONE', 'hardware', 'evidence', 'submission-template-command ACTION_ONE', 'raw-template-command ACTION_ONE', 'action-dossier-command ACTION_ONE', 'command', truncateMarkdownValue(secondDisplayVerificationCommandNote)]),
    renderedMarkdownRow(['Owner', 'Type', 'Closure kind', 'Gate', 'Current evidence', 'Source files', 'Prerequisite', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Required evidence', 'Unblock rule']),
    renderedMarkdownRow(['operator', 'external-gate', 'hardware', 'GATE_ONE', 'evidence', '', 'precondition', 'command', truncateMarkdownValue(secondDisplayVerificationCommandNote), 'action-dossier-command ACTION_ONE', 'raw-template-command ACTION_ONE', 'submission-template-command ACTION_ONE', 'required evidence', 'unblock rule']),
    'Keep the raw evidence file separate from the JSON submission file',
    '`evidenceFilePath` must not point to the submission JSON itself',
	    'file mtime freshness can be verified',
	    'Evidence modified at',
	    'Evidence size bytes',
	    'binary-safe evidence digest',
	    'hashAlgorithm=sha256',
	    'devhub-0503-checkbox-closure-evidence-v1',
    'devhub-0503-owner-evidence-submission-v1',
    '--owner-readiness',
    '`blockingActions`',
    '--owner-summary',
    '--owner <owner>',
    '--owner-lane-commands',
    '--partial-r8-dossier',
    '--file <prompt-file>',
    '--action-dossier',
    '--coverage-report <repo-relative-report.md>',
    '--coverage-json <repo-relative-report.json>',
    'nextEvidenceDirectoryCommand',
    'pnpm --silent check:0503-owner-evidence -- --print-template-dir',
    'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action',
    'pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir',
    'remove `templateOnly` before validation',
    'pnpm --silent check:0503-strict:vd-watch',
    'semantic pass values for the submitted action',
    'unknownSubmissionFields',
    'AGPL-3.0-or-later posture'
  ].join('\n')
  verifyOwnerActionQueueMarkdownText(ownerQueueMarkdown, markdownQueue)
  let missingActionMarkdownRejected = false
  try {
    verifyOwnerActionQueueMarkdownText(ownerQueueMarkdown.replaceAll('raw-template-command ACTION_ONE', ''), markdownQueue)
  } catch (error) {
    const message = String(error.message)
    missingActionMarkdownRejected = message.includes('owner action queue') && message.includes('ACTION_ONE')
  }
  assert(missingActionMarkdownRejected, 'owner action queue markdown self-test should reject missing per-action raw template commands')
  const markdownPack = {
    acceptanceStatus: 'not-complete',
    externalGateRunbookCoverage: { missingFields: [] },
    failedExternalGates: [
      {
        evidence: 'one display',
        id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
        runbook: {
          blockerKind: 'hardware',
          owner: 'operator',
          prerequisite: 'attach monitor',
          requiredEvidence: 'two displays',
          unblockRule: 'real display only',
          verificationCommand: 'pnpm -C devhub check:r8-external-blockers'
        },
        verificationCommandNote: 'real BrowserWindow second-display report required'
      }
    ],
    failedGateKindCounts: { hardware: 1 },
    failedGateOwnerCounts: { operator: 1 },
    nonCompletionBoundary: ['Do not claim final completion while strictCompletionPassed=false.'],
    partialR8Rows: [{ file: 'prompts/0503-2/R8.B/prd.md', nextAction: 'Need real external evidence.' }],
    promptArtifactManifest: { prompt0503Rows: [{ file: 'a' }], prompt05032Rows: [{ file: 'b' }] },
    promptCheckboxManifest: {
      jsonPath: 'checkbox.json',
      localClosureBlockedOpenRows: 2,
      localClosurePossibleOpenRows: 0,
      open05032ClosureKindCounts: { 'hardware-verification': 1 },
      open05032OwnerCounts: { operator: 1 },
      openClosureKindCounts: { 'hardware-verification': 1 },
      openOwnerCounts: { operator: 1 },
      totalChecked: 1,
      totalOpen: 2,
      totalRows: 3
    },
    schemaVersion: acceptancePackSchemaVersion,
    sourceEvidence: [{ modifiedAt: '2026-05-20T00:00:00.000Z', path: 'source.json', sha256: 'abc123', sizeBytes: 12 }],
    summary: {
      externalReportFresh: true,
      failedExternalGateCount: 1,
      missingEvidenceRowCount: 0,
      partialR8RowCount: 1,
      prompt05032LedgerRows: 1,
      prompt05032MarkdownFiles: 1,
      prompt0503LedgerRows: 1,
      prompt0503MarkdownFiles: 1,
      strictCompletionChecked: true,
      strictCompletionPassed: false,
      surveyAcceptanceRowCount: 1
    },
    surveyAcceptanceRows: [{ file: 'prompts/0503/28-final-acceptance-checklist.md', status: 'Needs user acceptance.' }]
  }
  verifyAcceptancePackSchemaVersion(markdownPack)
  let missingAcceptanceSchemaRejected = false
  try {
    verifyAcceptancePackSchemaVersion({ ...markdownPack, schemaVersion: 'legacy' })
  } catch (error) {
    missingAcceptanceSchemaRejected = String(error.message).includes('acceptance pack schemaVersion')
  }
  assert(missingAcceptanceSchemaRejected, 'acceptance pack schema self-test should reject wrong schemaVersion')
  verifyLedgerVerificationSchemaVersion({ schemaVersion: ledgerVerificationSchemaVersion })
  let weakLedgerVerificationSchemaRejected = false
  try {
    verifyLedgerVerificationSchemaVersion({ schemaVersion: 'legacy' })
  } catch (error) {
    weakLedgerVerificationSchemaRejected = String(error.message).includes('ledger verification schemaVersion')
  }
  assert(weakLedgerVerificationSchemaRejected, 'ledger verification self-test should reject wrong schemaVersion')
  verifyExternalBlockerReportSchemaVersion({ schemaVersion: externalBlockerReportSchemaVersion })
  let weakExternalBlockerSchemaRejected = false
  try {
    verifyExternalBlockerReportSchemaVersion({ schemaVersion: 'legacy' })
  } catch (error) {
    weakExternalBlockerSchemaRejected = String(error.message).includes('external blocker report schemaVersion')
  }
  assert(weakExternalBlockerSchemaRejected, 'external blocker report self-test should reject wrong schemaVersion')
  const acceptanceMarkdown = [
    '# 0503 Acceptance Evidence Pack',
    `Schema version: ${acceptancePackSchemaVersion}`,
    'Acceptance status: not-complete',
    '## Summary',
    '- Strict completion checked: true',
    '- Strict completion passed: false',
    '- prompts/0503 coverage: 1/1',
    '- prompts/0503-2 coverage: 1/1',
    '- Partial R8 rows: 1',
    '- Missing evidence rows: 0',
    '- Failed external gates: 1',
    '- Survey acceptance rows: 1',
    '- External report fresh: true',
    '- External gate runbook missing fields: 0',
    '- Machine-readable prompt artifact rows: 2',
    '- Prompt checkbox rows: 3',
    '- Open prompt checkbox rows: 2',
    '- Checked prompt checkbox rows: 1',
    '- Local-closure possible open rows: 0',
    '- Local-closure blocked open rows: 2',
    '## Source Evidence',
    renderedMarkdownRow(['source.json', 12, '2026-05-20T00:00:00.000Z', 'abc123']),
    '## Failed External Gate Actions',
    renderedMarkdownRow(['Gate', 'Kind', 'Owner', 'Current evidence', 'Prerequisite', 'Verification command', 'Verification command note', 'Action dossier command', 'Raw evidence template command', 'Submission template command', 'Required evidence', 'Unblock rule']),
    renderedMarkdownRow([
      'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
      'hardware',
      'operator',
      'one display',
      'attach monitor',
      'pnpm -C devhub check:r8-external-blockers',
      'real BrowserWindow second-display report required',
      'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
      'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
      'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
      'two displays',
      'real display only'
    ]),
    '## Failed Gate Owner Counts',
    renderedMarkdownRow(['operator', 1]),
    '## Failed Gate Kind Counts',
    renderedMarkdownRow(['hardware', 1]),
    '## Open R8 0503-2 Checkbox Closure Kinds',
    renderedMarkdownRow(['hardware-verification', 1]),
    '## Open R8 0503-2 Checkbox Owner Counts',
    renderedMarkdownRow(['operator', 1]),
    '## Prompt Artifact Manifest',
    '- Machine-readable rows for prompts/0503: 1',
    '- Machine-readable rows for prompts/0503-2: 1',
    '- Full per-prompt row details are embedded in `0503-acceptance-pack.json` under `promptArtifactManifest`.',
    '- Full checkbox row details are written to `checkbox.json`.',
    '## Partial R8 Rows',
    'prompts/0503-2/R8.B/prd.md',
    'Need real external evidence.',
    '## Survey Acceptance Rows',
    'prompts/0503/28-final-acceptance-checklist.md',
    'Needs user acceptance.',
    '## Non-Completion Boundary',
    '- Do not claim final completion while strictCompletionPassed=false.'
  ].join('\n')
  verifyAcceptancePackMarkdownText(acceptanceMarkdown, markdownPack)
  let weakAcceptanceMarkdownRejected = false
  try {
    verifyAcceptancePackMarkdownText(acceptanceMarkdown.replace('- Failed external gates: 1', ''), markdownPack)
  } catch (error) {
    weakAcceptanceMarkdownRejected = String(error.message).includes('Failed external gates')
  }
  assert(weakAcceptanceMarkdownRejected, 'acceptance pack markdown self-test should reject missing summary rows')
  let missingAcceptanceGateNoteRejected = false
  try {
    verifyAcceptancePackMarkdownText(acceptanceMarkdown.replace('real BrowserWindow second-display report required', ''), markdownPack)
  } catch (error) {
    missingAcceptanceGateNoteRejected = String(error.message).includes('verification command note')
  }
  assert(missingAcceptanceGateNoteRejected, 'acceptance pack markdown self-test should reject missing failed gate verification command note')
  const completionRows = Array.from({ length: 81 }, (_value, index) => ({
    batch: index === 0 ? 'root' : 'R8.C',
    checkedCheckboxes: index === 0 ? 0 : 1,
    evidenceStatus: index === 0 ? 'not-applicable' : 'verified',
    file: index === 0 ? 'prompts/0503-2/00-r8-implementation-quickstart.md' : `prompts/0503-2/R8.C/spec-${String(index).padStart(2, '0')}.md`,
    implementationStatus: index === 0 ? 'no' : 'yes',
    nextAction: index === 0 ? 'Reference/process document; no implementation checkbox closure by itself.' : 'Keep evidence current; rerun targeted gate before final closure.',
    openCheckboxes: index === 0 ? 9 : 0,
    pendingMarkers: 0
  }))
  const completionLedgerVerification = {
    completionLedger: {
      expectedMarkdownFiles: 81,
      ledgerRows: 81,
      rows: completionRows
    }
  }
  const completionLedgerPack = {
    sourceEvidence: [{ path: relativeRepoPath(completionLedgerMarkdownPath) }],
    summary: { prompt05032MarkdownFiles: 81 }
  }
  const completionLedgerMarkdown = [
    '# prompts/0503-2 Completion Ledger',
    '## Summary',
    '## Current Open Blocker Audit',
    '- 2026-05-21 owner template README hash workflow now explicitly tells owners to run `pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>` for each raw evidence file before filling submission JSON, then copy `evidenceSha256`, `hashAlgorithm`, `evidenceModifiedAt`, and `evidenceSizeBytes` into the submission before owner-readiness, require-complete, and strict completion reruns. This only hardens owner evidence collection instructions and does not close any strict external gate.',
    '## File Ledger',
    ...completionRows.map(row => renderedMarkdownRow([`\`${displayPromptPath(row.file)}\``, row.batch, row.openCheckboxes, row.checkedCheckboxes, row.implementationStatus, row.pendingMarkers, row.evidenceStatus, row.nextAction]))
  ].join('\n')
  verifyCompletionLedgerMarkdownText(completionLedgerMarkdown, completionLedgerPack, completionLedgerVerification)
  let weakCompletionLedgerRejected = false
  try {
    verifyCompletionLedgerMarkdownText(
      completionLedgerMarkdown.replace('`pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>`', '`pnpm --silent check:0503-owner-evidence -- --hash-evidence <missing-file>`'),
      completionLedgerPack,
      completionLedgerVerification
    )
  } catch (error) {
    weakCompletionLedgerRejected = String(error.message).includes('hash-evidence <repo-relative-evidence-file>')
  }
  assert(weakCompletionLedgerRejected, 'completion ledger markdown self-test should reject missing hash-evidence workflow')
  const surveyRows = Array.from({ length: 34 }, (_value, index) => ({
    checkedCheckboxes: index === 0 ? 104 : 0,
    evidenceStatus: index === 0 ? 'user-acceptance-open' : 'reference',
    file: index === 0 ? 'prompts/0503/28-final-acceptance-checklist.md' : `prompts/0503/ref-${String(index).padStart(2, '0')}.md`,
    nextAction: index === 0 ? 'Requires real user-facing acceptance after R8.A/B/C completion. Do not mark by local tests alone.' : 'Preserve as research context.',
    openCheckboxes: index === 0 ? 1301 : 0,
    questionMarkers: index === 0 ? 1003 : 0,
    status: index === 0 ? 'Requires real user-facing acceptance after R8.A/B/C completion. Do not mark by local tests alone.' : 'Preserve as research context.'
  }))
  const surveyLedgerVerification = {
    surveyLedger: {
      advisoryAcceptanceRows: [{ file: surveyRows[0].file, status: surveyRows[0].status }],
      evidenceStatusCounts: countRowsBy(surveyRows, 'evidenceStatus'),
      expectedMarkdownFiles: 34,
      ledgerRows: 34,
      rows: surveyRows,
      statusCounts: countRowsBy(surveyRows, 'status')
    }
  }
  const surveyMarkdownPack = {
    sourceEvidence: [{ path: relativeRepoPath(surveyAcceptanceLedgerMarkdownPath) }],
    summary: { prompt0503MarkdownFiles: 34 },
    surveyAcceptanceRows: []
  }
  const surveyLedgerMarkdown = [
    '# prompts/0503 Survey and Acceptance Ledger',
    '## Objective',
    'This file does not mark `prompts/0503` complete.',
    'Audit `prompts/0503` separately from the active `prompts/0503-2` R8 implementation ledger.',
    '## Summary',
    renderedMarkdownRow(['`prompts/0503`', 34, 1301, 104, 1003, 'Upstream survey plus final user acceptance context']),
    '## Contract Interpretation',
    '`0503-2-completion-ledger.md` remains the implementation ledger',
    '## File Ledger',
    ...surveyRows.map(row => renderedMarkdownRow([`\`${displayPromptPath(row.file)}\``, row.openCheckboxes, row.checkedCheckboxes, row.questionMarkers, row.evidenceStatus, row.nextAction])),
    '## Prompt To Artifact Checklist',
    'Do not close final user acceptance by proxy',
    'Do not claim hardware/admin/zero-egress/license-gated requirements',
    '## Acceptance Evidence Bridges'
  ].join('\n')
  verifySurveyAcceptanceLedgerMarkdownText(surveyLedgerMarkdown, surveyMarkdownPack, surveyLedgerVerification)
  let weakSurveyLedgerRejected = false
  try {
    verifySurveyAcceptanceLedgerMarkdownText(
      surveyLedgerMarkdown.replace(renderedMarkdownRow([`\`${displayPromptPath(surveyRows[0].file)}\``, surveyRows[0].openCheckboxes, surveyRows[0].checkedCheckboxes, surveyRows[0].questionMarkers, surveyRows[0].evidenceStatus, surveyRows[0].nextAction]), ''),
      surveyMarkdownPack,
      surveyLedgerVerification
    )
  } catch (error) {
    weakSurveyLedgerRejected = String(error.message).includes('missing file row')
  }
  assert(weakSurveyLedgerRejected, 'survey acceptance ledger markdown self-test should reject missing file rows')
  const markdownCheckboxManifest = {
    localClosureBlockedOpenRows: 2,
    localClosurePossibleOpenRows: 0,
    nonCompletionBoundary: ['Checkbox inventory is not completion evidence by itself.'],
    openActionIndex: {
      legalProductRows: [{ file: 'prompts/0503/24-legal-compliance-survey.md', heading: 'License', line: 10, text: 'AGPL-3.0' }],
      operatorRows: [{ closureKind: 'hardware-verification', closureRationale: 'Need real monitor evidence.', file: 'prompts/0503-2/R8.B/spec-02-port-floating-window.md', line: 20, text: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY' }],
      productFileCounts: [{ closureKind: 'survey-context', file: 'prompts/0503/07-ai-task-orchestration-survey.md', open: 3, requiredOwner: 'product' }],
      userProductFileCounts: [{ closureKind: 'user-product-acceptance', file: 'prompts/0503/28-final-acceptance-checklist.md', open: 4, requiredOwner: 'user-product' }]
    },
    openClosureKindCounts: { 'hardware-verification': 1 },
    openOwnerCounts: { operator: 1 },
    scopeCounts: {
      'prompts/0503': { checked: 1, open: 7, total: 8 },
      'prompts/0503-2': { checked: 2, open: 1, total: 3 }
    },
    schemaVersion: checkboxManifestSchemaVersion,
    topOpenFiles: [{ checked: 0, file: 'prompts/0503/28-final-acceptance-checklist.md', open: 4, scope: 'prompts/0503', total: 4 }],
    totalChecked: 3,
    totalOpen: 8,
    totalRows: 11
  }
  const checkboxMarkdown = [
    '# 0503 Checkbox Manifest',
    `Schema version: ${checkboxManifestSchemaVersion}`,
    '## Summary',
    '- Total checkbox rows: 11',
    '- Open checkbox rows: 8',
    '- Checked checkbox rows: 3',
    '- Local-closure possible open rows: 0',
    '- Local-closure blocked open rows: 2',
    '- prompts/0503 rows: 8',
    '- prompts/0503 open rows: 7',
    '- prompts/0503 checked rows: 1',
    '- prompts/0503-2 rows: 3',
    '- prompts/0503-2 open rows: 1',
    '- prompts/0503-2 checked rows: 2',
    '## Open Closure Classification',
    renderedMarkdownRow(['hardware-verification', 1]),
    '## Open Owner Counts',
    renderedMarkdownRow(['operator', 1]),
    '## Top Open Files',
    renderedMarkdownRow(['prompts/0503/28-final-acceptance-checklist.md', 'prompts/0503', 4, 0, 4]),
    '## Operator Exact Open Rows',
    renderedMarkdownRow(['prompts/0503-2/R8.B/spec-02-port-floating-window.md', 20, 'hardware-verification', 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'Need real monitor evidence.']),
    '## Legal-Product Exact Open Rows',
    renderedMarkdownRow(['prompts/0503/24-legal-compliance-survey.md', 10, 'License', 'AGPL-3.0']),
    '## Product And User Acceptance File Index',
    renderedMarkdownRow(['product', 'survey-context', 'prompts/0503/07-ai-task-orchestration-survey.md', 3]),
    renderedMarkdownRow(['user-product', 'user-product-acceptance', 'prompts/0503/28-final-acceptance-checklist.md', 4]),
    '## Non-Completion Boundary',
    '- Checkbox inventory is not completion evidence by itself.',
    '## Machine-Readable Details',
    '- Full checkbox rows are written to `0503-checkbox-manifest.json` under `rows`.',
    '- Each row includes `scope`, `file`, `line`, `heading`, `status`, `checked`, `text`, `textHash`, `closureKind`, `requiredOwner`, `localClosurePossible`, and `closureRationale`.',
    '- `openActionIndex` groups remaining rows by required owner, exact operator/legal rows, and product/user acceptance file counts.'
  ].join('\n')
  verifyCheckboxManifestSchemaVersion(markdownCheckboxManifest)
  let weakCheckboxSchemaRejected = false
  try {
    verifyCheckboxManifestSchemaVersion({ ...markdownCheckboxManifest, schemaVersion: 'legacy' })
  } catch (error) {
    weakCheckboxSchemaRejected = String(error.message).includes('checkbox manifest schemaVersion')
  }
  assert(weakCheckboxSchemaRejected, 'checkbox manifest self-test should reject wrong schemaVersion')
  verifyCheckboxManifestMarkdownText(checkboxMarkdown, markdownCheckboxManifest)
  let weakCheckboxMarkdownRejected = false
  try {
    verifyCheckboxManifestMarkdownText(checkboxMarkdown.replace('## Operator Exact Open Rows', ''), markdownCheckboxManifest)
  } catch (error) {
    weakCheckboxMarkdownRejected = String(error.message).includes('Operator Exact Open Rows')
  }
  assert(weakCheckboxMarkdownRejected, 'checkbox manifest markdown self-test should reject missing operator section')
  const markdownCompletionAudit = {
    acceptanceStatus: 'not-complete',
    blockerTaxonomy: {
      categoryCounts: { hardware: 1 },
      categoryWeightedOpenRows: { hardware: 1 },
      ownerCounts: { operator: 1 },
      ownerWeightedOpenRows: { operator: 1 },
      rows: [{
        actionDossierCommands: ['pnpm dossier'],
        category: 'hardware',
        id: 'GATE',
        owner: 'operator',
        ownerActionId: 'GATE',
        ownerActionIds: ['GATE'],
        rawEvidenceTemplateCommands: ['pnpm raw'],
        requirementType: 'failed-external-gate',
        source: 'r8-external-blockers-current.json',
        submissionTemplateCommands: ['pnpm submit'],
        verificationCommand: 'pnpm verify-gate',
        weightedOpenRows: 1
      }],
      totalTaxonomyRows: 1,
      totalWeightedOpenRows: 1
    },
    commandChecklist: [{ command: 'pnpm verify', evidencePath: 'package.json', id: 'VERIFY_COMMAND', requirement: 'Run verifier.', status: 'verified' }],
    completionGuardEvidence: [{ auditEvidencePath: 'status.json#/completionGuardEvidence/0', blockerCount: 1, blockers: ['GATE'], evidence: 'failedExternalGates=1', guard: 'failedExternalGatesClosed', passed: false, verificationCommand: 'pnpm verify-gate' }],
    completionGuardOwnerCrosswalk: [{
      actionDossierCommand: 'pnpm dossier',
      actionDossierCommands: ['pnpm dossier'],
      blocker: 'GATE',
      blockerType: 'owner-action-linked',
      guard: 'failedExternalGatesClosed',
      guardEvidencePath: 'status.json#/completionGuardEvidence/0',
      ownerActionIds: ['GATE'],
      owners: ['operator'],
      rawEvidenceTemplateCommand: 'pnpm raw',
      rawEvidenceTemplateCommands: ['pnpm raw'],
      submissionTemplateCommand: 'pnpm submit',
      submissionTemplateCommands: ['pnpm submit'],
      verificationCommands: ['pnpm verify-gate']
    }],
    generatedAt: '2026-05-20T00:00:00.000Z',
    missingOrIncompleteRequirements: [{
      actionDossierCommand: 'pnpm dossier',
      actionDossierCommands: ['pnpm dossier'],
      evidence: 'not enough displays',
      id: 'GATE',
      owner: 'operator',
      ownerActionId: 'GATE',
      ownerActionIds: ['GATE'],
      rawEvidenceTemplateCommand: 'pnpm raw',
      rawEvidenceTemplateCommands: ['pnpm raw'],
      recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
      requirementType: 'failed-external-gate',
      source: 'r8-external-blockers-current.json',
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommand: 'pnpm submit',
      submissionTemplateCommands: ['pnpm submit'],
      verificationCommand: 'pnpm verify-gate',
      verificationCommands: ['pnpm verify-gate']
    }],
    objective: 'Complete all prompts/0503 and prompts/0503-2 development objectives with real implementation evidence, no mock data, and strict completion gates.',
    ownerActionGuardBacklinks: [{
      actionDossierCommand: 'pnpm dossier',
      actionDossierCommands: ['pnpm dossier'],
      actionId: 'GATE',
      blockers: ['GATE'],
      guardsBlocked: ['failedExternalGatesClosed'],
      owner: 'operator',
      rawEvidenceTemplateCommand: 'pnpm raw',
      rawEvidenceTemplateCommands: ['pnpm raw'],
      submissionTemplateCommand: 'pnpm submit',
      submissionTemplateCommands: ['pnpm submit'],
      verificationCommand: 'pnpm verify-gate'
    }],
    partialR8Dossier: [{
      file: 'prompts/0503-2/R8.B/prd.md',
      nextAction: 'Need real evidence.',
      ownerActionDossierCommands: ['pnpm dossier'],
      ownerActionIds: ['GATE'],
      rawEvidenceTemplateCommands: ['pnpm raw'],
      sourceEvidencePath: 'ledger.json#/strictCompletion/partialRows/0',
      status: 'partial',
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommands: ['pnpm submit'],
      verificationCommand: 'pnpm verify-gate'
    }],
    promptToArtifactChecklist: [{ scope: 'prompts/0503', file: 'prompts/0503/a.md' }, { scope: 'prompts/0503-2', file: 'prompts/0503-2/a.md' }],
    schemaVersion: completionAuditSchemaVersion,
    sourceEvidence: ['pack.json', 'devhub/docs/manual-testing-checklist.md'],
    status: 'not-complete',
    strictBlockerCrosswalk: [{
      actionDossierCommand: 'pnpm dossier',
      actionDossierCommands: ['pnpm dossier'],
      id: 'GATE',
      ownerActionId: 'GATE',
      ownerActionIds: ['GATE'],
      rawEvidenceTemplateCommand: 'pnpm raw',
      rawEvidenceTemplateCommands: ['pnpm raw'],
      requirementType: 'failed-external-gate',
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommand: 'pnpm submit',
      submissionTemplateCommands: ['pnpm submit'],
      verificationCommand: 'pnpm verify-gate'
    }],
    successCriteria: [{ actual: 1, evidencePath: 'pack.json#/summary', expected: 0, id: 'CRITERION', requirement: 'All gates pass.', status: 'blocked' }]
  }
  const completionAuditMarkdown = [
    '# 0503 Completion Audit',
    `Schema version: ${completionAuditSchemaVersion}`,
    'Status: not-complete',
    'Acceptance status: not-complete',
    '## Objective',
    markdownCompletionAudit.objective,
    '## Source Evidence',
    renderedMarkdownRow(['pack.json']),
    renderedMarkdownRow(['devhub/docs/manual-testing-checklist.md']),
    '## Prompt-to-Artifact Checklist',
    'This checklist maps each explicit prompt requirement, named file, command, test, gate, and deliverable to concrete evidence.',
    '### Requirement Coverage',
    renderedMarkdownRow(['CRITERION', 'All gates pass.', 0, 1, 'blocked', '', '', '', '', 'pack.json#/summary']),
    '### Named Commands, Tests, and Gates',
    renderedMarkdownRow(['VERIFY_COMMAND', 'pnpm verify', 'verified', 'package.json', 'Run verifier.']),
    '## Completion Guard Evidence',
    renderedMarkdownRow(['failedExternalGatesClosed', false, 'failedExternalGates=1', 'pnpm verify-gate', 1, 'GATE', 'status.json#/completionGuardEvidence/0']),
    '## Completion Guard Owner Crosswalk',
    renderedMarkdownRow(['failedExternalGatesClosed', 'GATE', 'owner-action-linked', 'GATE', 'operator', 'pnpm verify-gate', 'pnpm dossier', 'pnpm raw', 'pnpm submit', 'status.json#/completionGuardEvidence/0']),
    '## Owner Action Guard Backlinks',
    renderedMarkdownRow(['GATE', 'operator', 'failedExternalGatesClosed', 'GATE', 'pnpm verify-gate', 'pnpm dossier', 'pnpm raw', 'pnpm submit']),
    '## Blocker Taxonomy',
    '- Total taxonomy rows: 1',
    '- Total weighted open rows: 1',
    '### Category Counts',
    renderedMarkdownRow(['hardware', 1, 1]),
    '### Owner Counts',
    renderedMarkdownRow(['operator', 1, 1]),
    '### Taxonomy Rows',
    renderedMarkdownRow(['hardware', 'failed-external-gate', 'GATE', 'operator', 'GATE', 1, 'pnpm verify-gate', 'pnpm dossier', 'pnpm raw', 'pnpm submit', 'r8-external-blockers-current.json']),
    '## Prompt-To-Artifact Checklist',
    '- Total rows: 2',
    '- prompts/0503 rows: 1',
    '- prompts/0503-2 rows: 1',
    '- Full row details are written to `0503-completion-audit.json` under `promptToArtifactChecklist`.',
    '## Partial R8 Dossier',
    renderedMarkdownRow(['prompts/0503-2/R8.B/prd.md', 'partial', 'GATE', 'pnpm verify-gate', 'pnpm dossier', 'pnpm raw', 'pnpm submit', 'pnpm check:0503-strict', 'ledger.json#/strictCompletion/partialRows/0', 'Need real evidence.']),
    '## Missing Or Incomplete Requirements',
    renderedMarkdownRow(['failed-external-gate', 'GATE', 'operator', 'GATE', 'pnpm verify-gate', 'pnpm dossier', 'pnpm raw', 'pnpm submit', 'pnpm check:0503-strict', 'not enough displays', 'r8-external-blockers-current.json']),
    '## Strict Blocker Crosswalk',
    renderedMarkdownRow(['failed-external-gate', 'GATE', 'GATE', 'pnpm verify-gate', 'pnpm dossier', 'pnpm raw', 'pnpm submit', 'pnpm check:0503-strict']),
    '## Boundary',
    '- This audit is generated evidence, not a waiver.',
    '- A blocked row remains blocked until the referenced real evidence exists and the strict completion command passes.'
  ].join('\n')
  verifyCompletionAuditMarkdownText(completionAuditMarkdown, markdownCompletionAudit)
  let weakCompletionAuditSchemaRejected = false
  try {
    verifyCompletionAuditMarkdownText(completionAuditMarkdown, { ...markdownCompletionAudit, schemaVersion: 'legacy' })
  } catch (error) {
    weakCompletionAuditSchemaRejected = String(error.message).includes('completion audit schemaVersion')
  }
  assert(weakCompletionAuditSchemaRejected, 'completion audit markdown self-test should reject wrong schemaVersion')
  let weakCompletionAuditMarkdownRejected = false
  try {
    verifyCompletionAuditMarkdownText(completionAuditMarkdown.replace('## Strict Blocker Crosswalk', ''), markdownCompletionAudit)
  } catch (error) {
    weakCompletionAuditMarkdownRejected = String(error.message).includes('Strict Blocker Crosswalk')
  }
  assert(weakCompletionAuditMarkdownRejected, 'completion audit markdown self-test should reject missing strict blocker section')
  const completionPack = {
    acceptanceStatus: 'not-complete',
    currentEnvironment: { displayCount: 1 },
    failedExternalGates: [],
    partialR8Rows: [{ file: 'prompts/0503-2/R8.B/prd.md' }],
    promptCheckboxManifest: { jsonPath: 'checkbox.json', openClosureKindCounts: {} },
    summary: { failedExternalGateCount: 0, partialR8RowCount: 1, strictCompletionPassed: false, surveyAcceptanceRowCount: 0 },
    surveyAcceptanceRows: []
  }
  const externalGateRunbook = {
    blockerKind: 'hardware',
    owner: 'operator',
    prerequisite: 'real prerequisite',
    verificationCommand: 'pnpm verify-external',
    requiredEvidence: 'real evidence',
    unblockRule: 'no fake evidence'
  }
  const externalReportGates = [
    'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
    'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
    'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY',
    'R8C_SPEC17_ADMIN_SHELL',
    'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED',
    'H1_J16_ZERO_EGRESS_CAPTURE_READY'
	  ].map(id => ({
	    evidence: id === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY'
	      ? 'browserWindowSecondDisplayValid=false; displayCount=1; targetMode=single-display-fallback; targetDisplayId=null; matchedDisplayId=null; reason=report-file-missing'
	      : id === 'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY'
	        ? 'physicalMonitorHotplugValid=false; baselineDisplayCount=1; minDisplayCount=1; finalDisplayCount=1; targetMode=single-display-fallback; reason=report-file-missing'
	        : id === 'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY'
	          ? 'registryDesktopCount=2; foregroundHookOptIn=true'
	          : id === 'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED'
	            ? 'devhub-watchdog verification incomplete; installed=false; status=not-installed; scExitCode=1060; admin=false'
	            : id === 'H1_J16_ZERO_EGRESS_CAPTURE_READY'
	              ? 'windows=true; pktmonAvailable=true; admin=false; preflightExitCode=2; captureValid=false; packetCount=missing'
	              : `${id} evidence`,
	    id,
	    passed: id === 'R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY',
	    runbook: id === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY'
	      ? { ...externalGateRunbook, verificationCommand: 'pnpm -C devhub check:browserwindow-second-display' }
	      : externalGateRunbook
	  }))
  const externalPack = {
    currentEnvironment: {
      adminUser: 'DOMAIN\\User',
      displayCount: 1,
      isAdministrator: false,
      serviceInstalled: false,
      serviceStatus: 'not-installed',
      virtualDesktopCount: 2,
      zeroEgressPreflightReady: false
    },
    failedExternalGates: externalReportGates
      .filter(gate => !gate.passed)
      .map(gate => ({
        evidence: gate.evidence,
        id: gate.id,
        runbook: gate.runbook,
        verificationCommandNote: `${gate.id} owner verification note`
      })),
    sourceEvidence: [{ path: relativeRepoPath(externalBlockerReportPath) }]
  }
	  const externalReport = {
	    admin: { isAdministrator: false, user: 'DOMAIN\\User' },
	    browserWindowSecondDisplay: {
	      displayCount: null,
	      matchedDisplayId: null,
	      targetMode: 'single-display-fallback',
	      targetDisplayId: null,
	      valid: false
	    },
	    displays: [{ deviceName: 'DISPLAY1' }],
	    gates: externalReportGates,
	    generatedAt: '2026-05-21T00:00:00.000Z',
	    passed: false,
	    physicalMonitorHotplug: { baselineDisplayCount: 1, finalDisplayCount: 1, minDisplayCount: 1, targetMode: 'single-display-fallback', valid: false },
	    projectLicense: { packageJsonLicense: 'AGPL-3.0-or-later', licenseFileExists: true },
	    service: { installed: false, scExitCode: 1060, status: 'not-installed' },
	    serviceName: 'devhub-watchdog',
	    virtualDesktops: { count: 2 },
	    zeroEgressCapture: { durationSeconds: null, packetCount: null, valid: false },
	    zeroEgressPreflight: { administrator: { isAdministrator: false }, ready: false }
	  }
  verifyExternalBlockerReport(externalPack, externalReport)
  let externalEnvironmentDriftRejected = false
  try {
    verifyExternalBlockerReport(externalPack, { ...externalReport, displays: [] })
  } catch (error) {
    externalEnvironmentDriftRejected = String(error.message).includes('display count')
  }
  assert(externalEnvironmentDriftRejected, 'external blocker report verifier should reject environment drift')
  let externalLicenseSchemaRejected = false
  try {
    verifyExternalBlockerReport(externalPack, {
      ...externalReport,
      projectLicense: { packageJsonLicense: null }
    })
  } catch (error) {
    externalLicenseSchemaRejected = String(error.message).includes('project license file flag')
  }
  assert(externalLicenseSchemaRejected, 'external blocker report verifier should reject missing project license metadata fields')
  const artifactStatus = { artifacts: buildExpectedStatusArtifacts(completionPack) }
  verifyCompletionStatusArtifactIndex(completionPack, artifactStatus, { verifyPaths: false })
  let missingOwnerClosureArtifactRejected = false
  try {
    const incompleteArtifacts = { ...artifactStatus.artifacts }
    delete incompleteArtifacts.ownerClosureBundles
    verifyCompletionStatusArtifactIndex(completionPack, { artifacts: incompleteArtifacts }, { verifyPaths: false })
  } catch (error) {
    missingOwnerClosureArtifactRejected = String(error.message).includes('artifact keys mismatch')
  }
  assert(missingOwnerClosureArtifactRejected, 'completion status artifact verifier should reject missing owner closure bundle artifact')
  const completionCheckboxManifest = {
    localClosureBlockedOpenRows: 0,
    localClosurePossibleOpenRows: 0,
    scopeCounts: { r8: { checked: 2, files: 1, open: 0, total: 2 } },
    totalRows: 2
  }
  const completionOwnerQueue = { actions: [] }
  const guardedCompletionStatus = {
    acceptanceStatus: 'not-complete',
    artifacts: artifactStatus.artifacts,
    complete: false,
    completionGuard: {
      acceptanceStatusComplete: false,
      failedExternalGatesClosed: true,
      localClosurePossibleExhausted: true,
      ownerActionQueueClosed: true,
      partialR8RowsClosed: false,
      strictCompletionPassed: false,
      surveyAcceptanceRowsClosed: true
    },
	    completionGuardEvidence: [
	      { blockerCount: 2, blockers: ['acceptanceStatus=not-complete', 'pnpm check:0503-strict'], evidence: 'acceptanceStatus=not-complete', guard: 'acceptanceStatusComplete', passed: false, verificationCommand: 'pnpm check:0503-strict' },
	      { blockerCount: 0, blockers: [], evidence: 'failedExternalGates=0', guard: 'failedExternalGatesClosed', passed: true, verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json' },
	      { blockerCount: 0, blockers: [], evidence: 'localClosurePossibleOpenRows=0', guard: 'localClosurePossibleExhausted', passed: true, verificationCommand: 'pnpm check:0503-checkbox-manifest' },
      { blockerCount: 0, blockers: [], evidence: 'ownerActionCount=0', guard: 'ownerActionQueueClosed', passed: true, verificationCommand: 'pnpm check:0503-owner-evidence -- --owner-summary' },
      { blockerCount: 1, blockers: ['prompts/0503-2/R8.B/prd.md'], evidence: 'partialR8Rows=1', guard: 'partialR8RowsClosed', passed: false, verificationCommand: 'pnpm check:0503-ledgers' },
	      { blockerCount: 4, blockers: ['partialR8Rows=1', 'failedExternalGates=0', 'surveyAcceptanceRows=0', 'pnpm check:0503-strict'], evidence: 'strictCompletionPassed=false', guard: 'strictCompletionPassed', passed: false, verificationCommand: 'pnpm check:0503-strict' },
	      { blockerCount: 0, blockers: [], evidence: 'surveyAcceptanceRows=0', guard: 'surveyAcceptanceRowsClosed', passed: true, verificationCommand: 'pnpm check:0503-checkbox-manifest' }
	    ],
	    blockedSuccessCriteriaOwnerLinks: [
	      {
	        actual: 1,
	        evidencePath: `${relativeRepoPath(ledgerVerificationJsonPath)}#/strictCompletion/partialRows`,
	        expected: 0,
	        id: 'R8_PARTIAL_ROW_CLOSURE',
	        status: 'blocked',
	        actionDossierCommands: [],
	        ownerActionIds: [],
	        ownerActionOwners: [],
	        ownerReadinessWithEvidenceDirCommands: [],
	        rawEvidenceTemplateCommands: [],
	        submissionTemplateCommands: []
	      },
	      {
	        actual: false,
	        evidencePath: relativeRepoPath(strictCompletionReportMarkdownPath),
	        expected: true,
	        id: 'STRICT_COMPLETION_GATE',
	        status: 'blocked',
	        actionDossierCommands: [],
	        ownerActionIds: [],
	        ownerActionOwners: [],
	        ownerReadinessWithEvidenceDirCommands: [],
	        rawEvidenceTemplateCommands: [],
	        submissionTemplateCommands: []
	      }
	    ],
	    continuationCommands: {
	      acceptancePack: 'pnpm check:0503-acceptance-pack',
	      localGate: 'pnpm check:0503-local',
	      nextOwnerCommands: 'pnpm check:0503-owner-evidence -- --next-owner-commands --owner <owner>',
      ownerBlockerTaxonomy: 'pnpm check:0503-owner-evidence -- --blocker-taxonomy --owner <owner>',
	      ownerClosureBundleQuery: 'pnpm check:0503-owner-evidence -- --owner-closure-bundles --owner <owner>',
	      ownerClosureBundles: relativeRepoPath(ownerClosureBundlesMarkdownPath),
	      ownerReadiness: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>',
	      ownerReadinessWithEvidenceDir: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>',
	      ownerSourceFileDossier: 'pnpm check:0503-owner-evidence -- --source-file-dossier --action <actionId> --file <prompt-file>',
	      ownerSummary: 'pnpm check:0503-owner-evidence -- --owner-summary',
      recommendedStrictGate: 'pnpm --silent check:0503-strict:vd-watch',
      strictGate: 'pnpm check:0503-strict'
    },
    currentEnvironment: completionPack.currentEnvironment,
    failedExternalGateCommandSets: [],
    failedExternalGateCount: 0,
    nextOwnerCommands: [],
    nextRequiredOwners: {},
    missingOrIncompleteRequirementCount: 1,
    nonCompletionReasons: ['missingOrIncompleteRequirements=1', 'partialR8Rows=1'],
    ownerActionCount: 0,
    partialR8RowCount: 1,
    promptArtifactRows: 115,
    promptCheckboxLocalClosureBlockedOpenRows: 0,
    promptCheckboxLocalClosurePossibleOpenRows: 0,
    promptCheckboxOpenRows: 0,
    promptCheckboxRows: 2,
    promptCheckboxScopeCounts: { r8: { checked: 2, files: 1, open: 0, total: 2 } },
    recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
    schemaVersion: completionStatusSchemaVersion,
    strictBlockerCrosswalkRowCount: 1,
    surveyAcceptanceRowCount: 0
  }
  verifyCompletionStatus(completionPack, completionCheckboxManifest, completionOwnerQueue, guardedCompletionStatus)
  let weakCompletionStatusSchemaRejected = false
  try {
    verifyCompletionStatus(completionPack, completionCheckboxManifest, completionOwnerQueue, { ...guardedCompletionStatus, schemaVersion: 'legacy' })
  } catch (error) {
    weakCompletionStatusSchemaRejected = String(error.message).includes('completion status schemaVersion')
  }
  assert(weakCompletionStatusSchemaRejected, 'completion status self-test should reject wrong schemaVersion')
  const validCompletionStatusMarkdown = [
    '# 0503 Completion Status',
    `Schema version: ${completionStatusSchemaVersion}`,
    `Complete: ${guardedCompletionStatus.complete}`,
    `Acceptance status: ${guardedCompletionStatus.acceptanceStatus}`,
    '## Artifacts',
    ...Object.entries(guardedCompletionStatus.artifacts).map(([artifact, artifactPath]) => renderedMarkdownRow([artifact, artifactPath])),
    '## Continuation Commands',
    ...Object.entries({
      'Local gate': guardedCompletionStatus.continuationCommands.localGate,
      'Acceptance pack': guardedCompletionStatus.continuationCommands.acceptancePack,
      'Strict gate': guardedCompletionStatus.continuationCommands.strictGate,
      'Recommended strict gate': guardedCompletionStatus.continuationCommands.recommendedStrictGate,
	      'Owner summary': guardedCompletionStatus.continuationCommands.ownerSummary,
	      'Next owner commands': guardedCompletionStatus.continuationCommands.nextOwnerCommands,
	      'Owner readiness': guardedCompletionStatus.continuationCommands.ownerReadiness,
	      'Owner readiness with evidence dir': guardedCompletionStatus.continuationCommands.ownerReadinessWithEvidenceDir,
	      'Owner source file dossier': guardedCompletionStatus.continuationCommands.ownerSourceFileDossier,
      'Owner blocker taxonomy': guardedCompletionStatus.continuationCommands.ownerBlockerTaxonomy,
      'Owner closure bundle query': guardedCompletionStatus.continuationCommands.ownerClosureBundleQuery,
      'Owner closure bundles': guardedCompletionStatus.continuationCommands.ownerClosureBundles
    }).map(([label, command]) => `- ${label}: \`${command}\``),
    '## Completion Guard',
    ...Object.entries(guardedCompletionStatus.completionGuard).map(([guard, passed]) => renderedMarkdownRow([guard, passed])),
	    '## Completion Guard Evidence',
	    ...guardedCompletionStatus.completionGuardEvidence.map(row => renderedMarkdownRow([row.guard, row.passed, row.evidence, row.verificationCommand, truncateMarkdownValue((row.blockers ?? []).join('; '))])),
	    '## Blocked Success Criteria Owner Links',
	    renderedMarkdownRow(['ID', 'Actual', 'Expected', 'Status', 'Owners', 'Owner actions', 'Owner readiness evidence-dir commands', 'Action dossier commands', 'Raw evidence template commands', 'Submission template commands', 'Evidence']),
	    ...guardedCompletionStatus.blockedSuccessCriteriaOwnerLinks.map(row => renderedMarkdownRow([
	      row.id,
	      row.actual,
	      row.expected,
	      row.status,
	      truncateMarkdownValue((row.ownerActionOwners ?? []).join('; ')),
	      truncateMarkdownValue((row.ownerActionIds ?? []).join('; ')),
	      truncateMarkdownValue((row.ownerReadinessWithEvidenceDirCommands ?? []).join('; ')),
	      truncateMarkdownValue((row.actionDossierCommands ?? []).join('; ')),
	      truncateMarkdownValue((row.rawEvidenceTemplateCommands ?? []).join('; ')),
	      truncateMarkdownValue((row.submissionTemplateCommands ?? []).join('; ')),
	      row.evidencePath
	    ])),
	    '## Failed External Gate Command Sets',
	    'No failed external gates.',
	    '## Counts',
	    `- Prompt artifact rows: ${guardedCompletionStatus.promptArtifactRows}`,
    `- Prompt checkbox rows: ${guardedCompletionStatus.promptCheckboxRows}`,
    `- Open prompt checkbox rows: ${guardedCompletionStatus.promptCheckboxOpenRows}`,
    `- Local-closure possible open rows: ${guardedCompletionStatus.promptCheckboxLocalClosurePossibleOpenRows}`,
    `- Local-closure blocked open rows: ${guardedCompletionStatus.promptCheckboxLocalClosureBlockedOpenRows}`,
    `- Missing or incomplete requirements: ${guardedCompletionStatus.missingOrIncompleteRequirementCount}`,
    `- Partial R8 rows: ${guardedCompletionStatus.partialR8RowCount}`,
    `- Failed external gates: ${guardedCompletionStatus.failedExternalGateCount}`,
    `- Survey acceptance rows: ${guardedCompletionStatus.surveyAcceptanceRowCount}`,
    `- Strict blocker crosswalk rows: ${guardedCompletionStatus.strictBlockerCrosswalkRowCount}`,
    `- Owner actions: ${guardedCompletionStatus.ownerActionCount}`,
    '## Current Environment',
    ...Object.entries(guardedCompletionStatus.currentEnvironment).map(([key, value]) => renderedMarkdownRow([key, value])),
    '## Required Owners',
    '## Next Owner Commands',
    '## Non-Completion Reasons',
    ...guardedCompletionStatus.nonCompletionReasons.map(reason => `- ${reason}`),
    '## Checkbox Scope Counts',
    ...Object.entries(guardedCompletionStatus.promptCheckboxScopeCounts).map(([scope, counts]) => renderedMarkdownRow([scope, counts.files, counts.total, counts.open, counts.checked]))
  ].join('\n')
  assertCompletionStatusMarkdownText(validCompletionStatusMarkdown, guardedCompletionStatus)
  let weakCompletionStatusMarkdownRejected = false
  try {
    assertCompletionStatusMarkdownText(validCompletionStatusMarkdown.replace('## Counts', '## Count Snapshot'), guardedCompletionStatus)
  } catch (error) {
    weakCompletionStatusMarkdownRejected = String(error.message).includes('Counts section')
  }
  assert(weakCompletionStatusMarkdownRejected, 'completion status markdown self-test should reject missing counts section')
  const validHandoffSummary = [
    '## Current Conclusion',
    'Target remains incomplete; do not call `update_goal complete`.',
    'Latest real gate command: `pnpm --silent check:0503-strict:vd-watch`.',
    'Latest result remains non-zero while evidence pack consistency passes.',
    `partialRows=${completionPack.summary.partialR8RowCount}`,
    `missingEvidenceRows=${completionPack.summary.missingEvidenceRowCount ?? 0}`,
    `failedExternalGateIds=${completionPack.summary.failedExternalGateCount}`,
    `surveyAcceptanceRows=${completionPack.summary.surveyAcceptanceRowCount}`,
    `externalReportFresh=${String(completionPack.summary.externalReportFresh === true)}`,
    '## Current Remaining External Gates',
    'No remaining external gates.',
    ...(completionPack.failedExternalGates ?? []).map(gate => `\`${gate.id}\``),
    '## Current Remaining Owner Lanes',
    'No remaining owner lanes.',
    ...Object.entries(completionOwnerQueue.ownerCounts ?? {}).map(([owner, count]) => `\`${owner}\`: ${count}`)
  ].join('\n')
  assertHandoffCurrentSummaryText(validHandoffSummary, completionPack, guardedCompletionStatus, completionOwnerQueue)
  let weakHandoffSummaryRejected = false
  try {
    assertHandoffCurrentSummaryText(validHandoffSummary.replace('pnpm --silent check:0503-strict:vd-watch', 'pnpm check:0503-strict'), completionPack, guardedCompletionStatus, completionOwnerQueue)
  } catch (error) {
    weakHandoffSummaryRejected = String(error.message).includes('recommended strict command')
  }
  assert(weakHandoffSummaryRejected, 'HANDOFF verifier self-test should reject stale strict command guidance')
  const guardedCompletionAudit = {
    completionGuardEvidence: guardedCompletionStatus.completionGuardEvidence.map((row, index) => ({
      ...row,
      auditEvidencePath: `${relativeRepoPath(completionStatusJsonPath)}#/completionGuardEvidence/${index}`,
      strictCompletionCommand: 'pnpm check:0503-strict'
    }))
  }
  verifyCompletionAuditGuardEvidence(guardedCompletionStatus, guardedCompletionAudit, { verifyPaths: false })
  let wrongAuditGuardEvidenceRejected = false
  try {
    verifyCompletionAuditGuardEvidence(guardedCompletionStatus, {
      completionGuardEvidence: guardedCompletionAudit.completionGuardEvidence.map(row => row.guard === 'partialR8RowsClosed' ? { ...row, blockers: [] } : row)
    }, { verifyPaths: false })
  } catch (error) {
    wrongAuditGuardEvidenceRejected = String(error.message).includes('blockers mismatch')
  }
  assert(wrongAuditGuardEvidenceRejected, 'completion audit verifier should reject guard evidence drift from completion status')
  let wrongAuditGuardEvidenceSourceRejected = false
  try {
    verifyCompletionAuditGuardEvidence(guardedCompletionStatus, {
      completionGuardEvidence: guardedCompletionAudit.completionGuardEvidence.map(row => row.guard === 'partialR8RowsClosed' ? { ...row, auditEvidencePath: 'wrong.json#/completionGuardEvidence/4' } : row)
    }, { verifyPaths: false })
  } catch (error) {
    wrongAuditGuardEvidenceSourceRejected = String(error.message).includes('source pointer mismatch')
  }
  assert(wrongAuditGuardEvidenceSourceRejected, 'completion audit verifier should reject guard evidence source pointer drift')
  const partialR8Audit = {
    partialR8Dossier: [
      {
        file: 'prompts/0503-2/R8.B/prd.md',
        nextAction: '',
        ownerActionDossierCommands: [],
        ownerActionIds: [],
        ownerActionVerificationCommands: [],
        rawEvidenceTemplateCommands: [],
        sourceEvidencePath: `${relativeRepoPath(join(researchDir, '0503-ledger-verification.json'))}#/strictCompletion/partialRowDetails/0`,
        status: 'partial',
        strictCompletionCommand: 'pnpm check:0503-strict',
        submissionTemplateCommands: [],
        verificationCommand: 'pnpm check:0503-ledgers'
      }
    ]
  }
  verifyPartialR8Dossier(completionPack, completionOwnerQueue, partialR8Audit, { verifyPaths: false })
  let wrongPartialR8DossierRejected = false
  try {
    verifyPartialR8Dossier(completionPack, completionOwnerQueue, {
      partialR8Dossier: partialR8Audit.partialR8Dossier.map(row => ({ ...row, verificationCommand: 'pnpm test' }))
    }, { verifyPaths: false })
  } catch (error) {
    wrongPartialR8DossierRejected = String(error.message).includes('verification command mismatch')
  }
  assert(wrongPartialR8DossierRejected, 'completion audit verifier should reject partial R8 dossier command drift')
  const partialR8OwnerQueue = {
    actions: [
      { actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', owner: 'operator' },
      { actionId: 'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY', owner: 'operator' }
    ]
  }
  const partialR8OwnerAudit = {
    missingOrIncompleteRequirements: [
      {
        evidence: 'partial',
        id: 'prompts/0503-2/R8.B/prd.md',
        owner: 'operator',
        ownerActionIds: [
          'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
          'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY'
        ],
        requirementType: 'partial-r8-row',
        source: 'ledger.json'
      }
    ],
    strictBlockerCrosswalk: [
      {
        id: 'prompts/0503-2/R8.B/prd.md',
        ownerActionIds: [
          'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
          'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY'
        ],
        ownerActionOwners: ['operator'],
        requirementType: 'partial-r8-row'
      }
    ]
  }
  verifyPartialR8RequirementOwners(partialR8OwnerQueue, partialR8OwnerAudit)
  let wrongPartialR8OwnerRejected = false
  try {
    verifyPartialR8RequirementOwners(partialR8OwnerQueue, {
      ...partialR8OwnerAudit,
      missingOrIncompleteRequirements: partialR8OwnerAudit.missingOrIncompleteRequirements.map(row => ({ ...row, owner: 'agent-or-operator' }))
    })
  } catch (error) {
    wrongPartialR8OwnerRejected = String(error.message).includes('owner mismatch')
  }
  assert(wrongPartialR8OwnerRejected, 'completion audit verifier should reject partial R8 owner attribution fallback')
  const guardOwnerQueue = {
    actions: [{ actionId: 'ACTION_ONE', owner: 'operator', verificationCommand: 'verify-action-one' }]
  }
  const guardOwnerAudit = {
    completionGuardEvidence: [
      { auditEvidencePath: 'status.json#/completionGuardEvidence/1', blockers: ['ACTION_ONE'], guard: 'failedExternalGatesClosed', passed: false, verificationCommand: 'fallback-command' }
    ],
    completionGuardOwnerCrosswalk: [
      {
        actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
        actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
        blocker: 'ACTION_ONE',
        blockerType: 'owner-action-linked',
        guard: 'failedExternalGatesClosed',
        guardEvidencePath: 'status.json#/completionGuardEvidence/1',
        ownerActionIds: ['ACTION_ONE'],
        owners: ['operator'],
        rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE',
        rawEvidenceTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE'],
        strictCompletionCommand: 'pnpm check:0503-strict',
        submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
        submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
        verificationCommands: ['verify-action-one'],
        recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
      }
    ],
    ownerActionGuardBacklinks: [
      {
        actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
        actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
        actionId: 'ACTION_ONE',
        blockers: ['ACTION_ONE'],
        guardsBlocked: ['failedExternalGatesClosed'],
        owner: 'operator',
        rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE',
        rawEvidenceTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE'],
        strictCompletionCommand: 'pnpm check:0503-strict',
        submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
        submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
        verificationCommand: 'verify-action-one',
        recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
      }
    ],
    partialR8Dossier: []
  }
  verifyCompletionGuardOwnerCrosswalk(guardOwnerQueue, guardOwnerAudit)
  verifyOwnerActionGuardBacklinks(guardOwnerQueue, guardOwnerAudit)
  let wrongGuardOwnerCrosswalkRejected = false
  try {
    verifyCompletionGuardOwnerCrosswalk(guardOwnerQueue, {
      ...guardOwnerAudit,
      completionGuardOwnerCrosswalk: guardOwnerAudit.completionGuardOwnerCrosswalk.map(row => ({ ...row, verificationCommands: ['fallback-command'] }))
    })
  } catch (error) {
    wrongGuardOwnerCrosswalkRejected = String(error.message).includes('guard owner crosswalk mismatch')
  }
  assert(wrongGuardOwnerCrosswalkRejected, 'completion audit verifier should reject guard owner crosswalk drift')
  let wrongOwnerActionBacklinkRejected = false
  try {
    verifyOwnerActionGuardBacklinks(guardOwnerQueue, {
      ...guardOwnerAudit,
      ownerActionGuardBacklinks: guardOwnerAudit.ownerActionGuardBacklinks.map(row => ({ ...row, guardsBlocked: [] }))
    })
  } catch (error) {
    wrongOwnerActionBacklinkRejected = String(error.message).includes('owner action guard backlink mismatch')
  }
  assert(wrongOwnerActionBacklinkRejected, 'completion audit verifier should reject owner action guard backlink drift')
  const taxonomyQueue = {
    actions: [{ actionId: 'ACTION_ONE', closureKind: 'hardware', count: 3, owner: 'operator', verificationCommand: 'verify-action-one' }]
  }
  const taxonomyAudit = {
    blockerTaxonomy: {
      boundary: [
        'Blocker taxonomy is derived from current incomplete requirements and owner action queue rows.',
        'Taxonomy rows and weighted counts are diagnostic execution aids only; they are not completion evidence.',
        'Final completion still requires every referenced real evidence item and a passing pnpm check:0503-strict run.'
      ],
      categoryCounts: { hardware: 1, 'partial-r8-implementation': 1 },
      categoryWeightedOpenRows: { hardware: 3, 'partial-r8-implementation': 1 },
      ownerCounts: { operator: 2 },
      ownerWeightedOpenRows: { operator: 4 },
      requirementTypeCounts: { 'open-checkbox-closure-class': 1, 'partial-r8-row': 1 },
      rows: [
        {
          actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
          actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
          category: 'hardware',
          currentEvidence: '3 open checkbox row(s) classified as hardware',
          id: 'ACTION_ONE',
          owner: 'operator',
          ownerActionId: 'ACTION_ONE',
          ownerActionIds: ['ACTION_ONE'],
          rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE',
          rawEvidenceTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE'],
          requirementType: 'open-checkbox-closure-class',
          source: 'checkbox.json',
          strictCompletionCommand: 'pnpm check:0503-strict',
          submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
          submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
          verificationCommand: 'verify-action-one',
          weightedOpenRows: 3,
          recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
        },
        {
          actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
          actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
          category: 'partial-r8-implementation',
          currentEvidence: 'partial',
          id: 'prompts/0503-2/R8.B/prd.md',
          owner: 'operator',
          ownerActionId: 'ACTION_ONE',
          ownerActionIds: ['ACTION_ONE'],
          rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE',
          rawEvidenceTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE'],
          requirementType: 'partial-r8-row',
          source: 'ledger.json',
          strictCompletionCommand: 'pnpm check:0503-strict',
          submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
          submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
          verificationCommand: 'verify-action-one',
          weightedOpenRows: 1,
          recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
        }
      ],
      sourceCounts: { 'checkbox.json': 1, 'ledger.json': 1 },
      totalTaxonomyRows: 2,
      totalWeightedOpenRows: 4
    },
    missingOrIncompleteRequirements: [
      { evidence: '3 open checkbox row(s) classified as hardware', id: 'ACTION_ONE', owner: 'operator', requirementType: 'open-checkbox-closure-class', source: 'checkbox.json' },
      { evidence: 'partial', id: 'prompts/0503-2/R8.B/prd.md', owner: 'operator', ownerActionIds: ['ACTION_ONE'], requirementType: 'partial-r8-row', source: 'ledger.json' }
    ],
    strictBlockerCrosswalk: [
      {
        actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
        actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
        id: 'ACTION_ONE',
        ownerActionId: 'ACTION_ONE',
        ownerActionIds: ['ACTION_ONE'],
        rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE',
        rawEvidenceTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE'],
        requirementType: 'open-checkbox-closure-class',
        submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
        submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
        verificationCommand: 'verify-action-one'
      },
      {
        actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
        actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
        id: 'prompts/0503-2/R8.B/prd.md',
        ownerActionId: 'ACTION_ONE',
        ownerActionIds: ['ACTION_ONE'],
        rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE',
        rawEvidenceTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ACTION_ONE'],
        requirementType: 'partial-r8-row',
        submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
        submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
        verificationCommand: 'verify-action-one'
      }
    ]
  }
  verifyBlockerTaxonomy(taxonomyAudit, taxonomyQueue)
  let wrongTaxonomyRejected = false
  try {
    verifyBlockerTaxonomy({
      ...taxonomyAudit,
      blockerTaxonomy: { ...taxonomyAudit.blockerTaxonomy, totalWeightedOpenRows: 2 }
    }, taxonomyQueue)
  } catch (error) {
    wrongTaxonomyRejected = String(error.message).includes('blocker taxonomy mismatch')
  }
  assert(wrongTaxonomyRejected, 'completion audit verifier should reject blocker taxonomy drift')
  const closureBundleQueue = {
    actions: [{
      actionId: 'ACTION_ONE',
      closureKind: 'hardware',
      currentEvidence: 'not ready',
      owner: 'operator',
      prerequisite: 'real machine',
      actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
      rawEvidenceTemplateCommand: 'raw-template',
      requiredEvidence: 'real evidence',
      submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
      unblockRule: 'no template',
      verificationCommand: 'verify-action-one'
    }]
  }
  const closureBundleAudit = {
    acceptanceStatus: 'not-complete',
    blockerTaxonomy: {
      rows: [
        {
          actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
          actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
          category: 'hardware',
          currentEvidence: 'not ready',
          id: 'ACTION_ONE',
          ownerActionId: 'ACTION_ONE',
          ownerActionIds: ['ACTION_ONE'],
          rawEvidenceTemplateCommand: 'raw-template',
          rawEvidenceTemplateCommands: ['raw-template'],
          requirementType: 'failed-external-gate',
          source: 'external.json',
          strictCompletionCommand: 'pnpm check:0503-strict',
          submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
          submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
          verificationCommand: 'verify-action-one',
          weightedOpenRows: 1
        },
        {
          actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
          actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
          category: 'partial-r8-implementation',
          currentEvidence: 'partial',
          id: 'prompts/0503-2/R8.B/prd.md',
          ownerActionId: 'ACTION_ONE',
          ownerActionIds: ['ACTION_ONE'],
          rawEvidenceTemplateCommand: 'raw-template',
          rawEvidenceTemplateCommands: ['raw-template'],
          requirementType: 'partial-r8-row',
          source: 'ledger.json',
          strictCompletionCommand: 'pnpm check:0503-strict',
          submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
          submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
          verificationCommand: 'verify-action-one',
          weightedOpenRows: 1
        }
      ]
    },
    ownerActionGuardBacklinks: guardOwnerAudit.ownerActionGuardBacklinks,
    partialR8Dossier: [
      {
        file: 'prompts/0503-2/R8.B/prd.md',
        ownerActionIds: ['ACTION_ONE'],
        sourceEvidencePath: 'ledger.json#/strictCompletion/partialRowDetails/0',
        status: 'partial'
      }
    ],
    status: 'not-complete'
  }
  const ownerClosureBundles = {
    acceptanceStatus: 'not-complete',
    ownerCount: 1,
    owners: [
      {
        actionCount: 1,
        actions: [
          {
            actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
            actionId: 'ACTION_ONE',
            blockingTaxonomyRowIds: ['ACTION_ONE', 'prompts/0503-2/R8.B/prd.md'],
            blockingTaxonomyRows: [
              {
                actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
                actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
                category: 'hardware',
                currentEvidence: 'not ready',
                id: 'ACTION_ONE',
                ownerActionId: 'ACTION_ONE',
                ownerActionIds: ['ACTION_ONE'],
                rawEvidenceTemplateCommand: 'raw-template',
                rawEvidenceTemplateCommands: ['raw-template'],
                requirementType: 'failed-external-gate',
                source: 'external.json',
                strictCompletionCommand: 'pnpm check:0503-strict',
                submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
                submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
                verificationCommand: 'verify-action-one',
                weightedOpenRows: 1,
                recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
              },
              {
                actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
                actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
                category: 'partial-r8-implementation',
                currentEvidence: 'partial',
                id: 'prompts/0503-2/R8.B/prd.md',
                ownerActionId: 'ACTION_ONE',
                ownerActionIds: ['ACTION_ONE'],
                rawEvidenceTemplateCommand: 'raw-template',
                rawEvidenceTemplateCommands: ['raw-template'],
                requirementType: 'partial-r8-row',
                source: 'ledger.json',
                strictCompletionCommand: 'pnpm check:0503-strict',
                submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
                submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
                verificationCommand: 'verify-action-one',
                weightedOpenRows: 1,
                recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
              }
            ],
            blockers: ['ACTION_ONE'],
            closureKind: 'hardware',
            currentEvidence: 'not ready',
            guardsBlocked: ['failedExternalGatesClosed'],
            partialR8DossierLinks: [
              {
                file: 'prompts/0503-2/R8.B/prd.md',
                partialR8FileDossierCommand: 'pnpm check:0503-owner-evidence -- --partial-r8-dossier --file prompts/0503-2/R8.B/prd.md',
                partialR8OwnerFileDossierCommand: 'pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner operator --file prompts/0503-2/R8.B/prd.md',
                sourceEvidencePath: 'ledger.json#/strictCompletion/partialRowDetails/0',
                status: 'partial'
              }
            ],
            partialR8Files: ['prompts/0503-2/R8.B/prd.md'],
            prerequisite: 'real machine',
            actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
            rawEvidenceTemplateCommand: 'raw-template',
            requiredEvidence: 'real evidence',
            strictCompletionCommand: 'pnpm check:0503-strict',
            recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
            submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
            unblockRule: 'no template',
            verificationCommand: 'verify-action-one',
            verificationCommandNote: ''
          }
        ],
        blockingTaxonomyRowCount: 2,
        blockingTaxonomyRows: [
          {
            actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
            actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
            category: 'hardware',
            currentEvidence: 'not ready',
            id: 'ACTION_ONE',
            ownerActionId: 'ACTION_ONE',
            ownerActionIds: ['ACTION_ONE'],
            rawEvidenceTemplateCommand: 'raw-template',
            rawEvidenceTemplateCommands: ['raw-template'],
            requirementType: 'failed-external-gate',
            source: 'external.json',
            strictCompletionCommand: 'pnpm check:0503-strict',
            submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
            submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
            verificationCommand: 'verify-action-one',
            weightedOpenRows: 1,
            recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
          },
          {
            actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE',
            actionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ACTION_ONE'],
            category: 'partial-r8-implementation',
            currentEvidence: 'partial',
            id: 'prompts/0503-2/R8.B/prd.md',
            ownerActionId: 'ACTION_ONE',
            ownerActionIds: ['ACTION_ONE'],
            rawEvidenceTemplateCommand: 'raw-template',
            rawEvidenceTemplateCommands: ['raw-template'],
            requirementType: 'partial-r8-row',
            source: 'ledger.json',
            strictCompletionCommand: 'pnpm check:0503-strict',
            submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE',
            submissionTemplateCommands: ['pnpm --silent check:0503-owner-evidence -- --print-template --action ACTION_ONE'],
            verificationCommand: 'verify-action-one',
            weightedOpenRows: 1,
            recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch'
          }
        ],
        categoryWeightedOpenRows: { hardware: 1, 'partial-r8-implementation': 1 },
        owner: 'operator',
        recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
        readinessCommand: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner operator',
        requireCompleteCommand: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --require-complete',
        summaryCommand: 'pnpm --silent check:0503-owner-evidence -- --owner-summary --owner operator',
        weightedOpenRows: 2
      }
    ],
    schemaVersion: ownerClosureBundleSchemaVersion,
    sourceEvidence: [relativeRepoPath(ownerActionQueueJsonPath), relativeRepoPath(completionAuditJsonPath)],
    status: 'not-complete',
    recommendedStrictCompletionCommand: 'pnpm --silent check:0503-strict:vd-watch',
    totalActionCount: 1
  }
  verifyOwnerClosureBundles(closureBundleQueue, closureBundleAudit, ownerClosureBundles)
  let wrongOwnerClosureBundleRejected = false
  try {
    verifyOwnerClosureBundles(closureBundleQueue, closureBundleAudit, { ...ownerClosureBundles, totalActionCount: 0 })
  } catch (error) {
    wrongOwnerClosureBundleRejected = String(error.message).includes('totalActionCount mismatch')
  }
  assert(wrongOwnerClosureBundleRejected, 'owner closure bundle verifier should reject action count drift')
  let proxyCompletionRejected = false
  try {
    verifyCompletionStatus(completionPack, completionCheckboxManifest, completionOwnerQueue, { ...guardedCompletionStatus, complete: true })
  } catch (error) {
    proxyCompletionRejected = String(error.message).includes('complete flag does not match guard result')
  }
  assert(proxyCompletionRejected, 'completion status verifier should reject acceptanceStatus-only completion')
  let missingGuardBlockersRejected = false
  try {
    verifyCompletionStatus(completionPack, completionCheckboxManifest, completionOwnerQueue, {
      ...guardedCompletionStatus,
      completionGuardEvidence: guardedCompletionStatus.completionGuardEvidence.map(row => row.guard === 'partialR8RowsClosed' ? { ...row, blockerCount: 0, blockers: [] } : row)
    })
  } catch (error) {
    missingGuardBlockersRejected = String(error.message).includes('blocker count mismatch')
  }
  assert(missingGuardBlockersRejected, 'completion status verifier should reject false guard rows without blockers')
  let wrongGuardCommandRejected = false
  try {
    verifyCompletionStatus(completionPack, completionCheckboxManifest, completionOwnerQueue, {
      ...guardedCompletionStatus,
      completionGuardEvidence: guardedCompletionStatus.completionGuardEvidence.map(row => row.guard === 'partialR8RowsClosed' ? { ...row, verificationCommand: 'pnpm test' } : row)
    })
  } catch (error) {
    wrongGuardCommandRejected = String(error.message).includes('verification command mismatch')
  }
  assert(wrongGuardCommandRejected, 'completion status verifier should reject guard rows with wrong verification commands')
  const manualTestingDualSurfaceFixture = manualTestingDualRunningSurfaceRequiredTexts.join('\n')
  assertManualTestingDualRunningSurfaceText(manualTestingDualSurfaceFixture)
  let weakManualTestingDualSurfaceDocsRejected = false
  try {
    assertManualTestingDualRunningSurfaceText(manualTestingDualSurfaceFixture.replace(manualTestingDualRunningSurfaceRequiredTexts[1], ''))
  } catch (error) {
    weakManualTestingDualSurfaceDocsRejected = String(error.message).includes('manual testing checklist missing dual-running-surface guidance')
  }
  assert(weakManualTestingDualSurfaceDocsRejected, 'manual testing dual-running-surface verifier should reject missing managed-project terminal boundary')
  assertDevhubStartupDualRunningSurfaceConfig({ scripts: { dev: 'electron-vite dev' } }, devhubStartupDualRunningSurfaceConfigTexts.join('\n'))
  let wrongDevhubStartupConfigRejected = false
  try {
    assertDevhubStartupDualRunningSurfaceConfig({ scripts: { dev: 'vite dev' } }, devhubStartupDualRunningSurfaceConfigTexts.join('\n'))
  } catch (error) {
    wrongDevhubStartupConfigRejected = String(error.message).includes('DevHub dev script must remain electron-vite dev')
  }
  assert(wrongDevhubStartupConfigRejected, 'startup dual-running-surface verifier should reject a non-electron-vite dev script')
  verifyCompletionAuditRequiredSourceEvidenceRows(requiredCompletionAuditSourceEvidencePaths)
  let missingStartupSourceEvidenceRejected = false
  try {
    verifyCompletionAuditRequiredSourceEvidenceRows(requiredCompletionAuditSourceEvidencePaths.filter(row => row !== relativeRepoPath(devhubElectronViteConfigPath)))
  } catch (error) {
    missingStartupSourceEvidenceRejected = String(error.message).includes('completion audit sourceEvidence missing required startup evidence path')
  }
  assert(missingStartupSourceEvidenceRejected, 'completion audit source evidence verifier should reject missing startup config evidence path')
  verifyNoTemporaryOwnerTemplateArtifacts(['tmp/clean'], () => false)
  let temporaryArtifactRejected = false
  try {
    verifyNoTemporaryOwnerTemplateArtifacts(['tmp/leaked'], () => true)
  } catch (error) {
    temporaryArtifactRejected = String(error.message).includes('temporary owner template artifact must be removed')
  }
  assert(temporaryArtifactRejected, 'evidence pack verifier should reject leftover temporary owner template artifacts')
  assertEvidencePackVerifierRequirement({ requirement: evidencePackVerifierRequirement })
  let wrongEvidencePackVerifierRequirementRejected = false
  try {
    assertEvidencePackVerifierRequirement({
      requirement: evidencePackVerifierRequirement.replace('HANDOFF current summary, ', '')
    })
  } catch (error) {
    wrongEvidencePackVerifierRequirementRejected = String(error.message).includes('completion audit evidence pack verifier requirement mismatch')
  }
  assert(wrongEvidencePackVerifierRequirementRejected, 'evidence pack verifier self-test should reject stale command checklist requirement text')
  const successMessageFixture = buildEvidencePackVerificationPassedMessage(289)
  for (const coverageItem of evidencePackVerifierSuccessCoverageItems) {
    assert(successMessageFixture.includes(coverageItem), `evidence pack verifier success output missing coverage item: ${coverageItem}`)
  }
  assert(successMessageFixture.includes('289 path-like JSON pointer targets are consistent'), 'evidence pack verifier success output missing pointer target count')
  const completeTaskContextRows = requiredTaskContextFiles.map(file => ({ file, reason: `fixture context for ${file}` }))
  verifyTaskContextRows('fixture-context.jsonl', completeTaskContextRows, { verifyPaths: false })
  let missingTaskContextRejected = false
  try {
    verifyTaskContextRows(
      'fixture-context.jsonl',
      completeTaskContextRows.filter(row => row.file !== '.trellis/tasks/archive/2026-05/05-03-r8-prd-spec-batches/HANDOFF.md'),
      { verifyPaths: false }
    )
  } catch (error) {
    missingTaskContextRejected = String(error.message).includes('missing required context file')
  }
  assert(missingTaskContextRejected, 'evidence pack verifier self-test should reject missing archived handoff context')
  console.log('0503 evidence pack verifier self-test passed.')
}

if (selfTest) {
  runSelfTest()
  process.exit(0)
}

const acceptancePack = readJson(acceptancePackJsonPath)
const checkboxManifest = readJson(checkboxManifestJsonPath)
const completionAudit = readJson(completionAuditJsonPath)
const completionStatus = readJson(completionStatusJsonPath)
const externalBlockerReport = readJson(externalBlockerReportPath)
const ledgerVerification = readJson(ledgerVerificationJsonPath)
const ownerActionQueue = readJson(ownerActionQueueJsonPath)
const ownerClosureBundles = readJson(ownerClosureBundlesJsonPath)

verifyAcceptancePackSchemaVersion(acceptancePack)
verifyCheckboxManifestSchemaVersion(checkboxManifest)
verifyLedgerVerificationSchemaVersion(ledgerVerification)
verifyExternalBlockerReportSchemaVersion(externalBlockerReport)
verifySourceEvidenceHashes(acceptancePack)
verifyPromptManifests(acceptancePack, checkboxManifest)
verifyTaskContextJsonl()
verifyExternalBlockerReport(acceptancePack, externalBlockerReport)
verifyLedgerVerificationReport(acceptancePack, externalBlockerReport, ledgerVerification)
verifyCompletionLedgerMarkdown(acceptancePack, ledgerVerification)
verifySurveyAcceptanceLedgerMarkdown(acceptancePack, ledgerVerification)
verifyAcceptancePackMarkdown(acceptancePack)
verifyCheckboxLocalClosureCounts(checkboxManifest)
verifyCheckboxOpenActionIndex(checkboxManifest)
verifyCheckboxManifestMarkdown(checkboxManifest)
verifyOwnerActionQueue(acceptancePack, checkboxManifest, ownerActionQueue)
verifyOwnerActionQueueMarkdown(ownerActionQueue)
verifyCurrentOwnerTemplateDirectories(ownerActionQueue)
verifyCompletionStatus(acceptancePack, checkboxManifest, ownerActionQueue, completionStatus)
verifyCompletionStatusMarkdown(completionStatus)
verifyHandoffCurrentSummary(acceptancePack, completionStatus, ownerActionQueue)
verifyStrictCompletionReportMarkdown(acceptancePack, completionStatus, ownerActionQueue)
verifyCompletionAudit(acceptancePack, checkboxManifest, ownerActionQueue, completionStatus, completionAudit)
verifyCompletionAuditMarkdown(completionAudit)
verifyOwnerClosureBundles(ownerActionQueue, completionAudit, ownerClosureBundles)
verifyOwnerClosureBundlesMarkdown(ownerClosureBundles)
verifyReferencedArtifacts(acceptancePack, completionStatus, completionAudit)
verifyRootPackageScripts()
verifyManualTestingDualRunningSurfaceDocs()
verifyDevhubStartupDualRunningSurfaceContract()
verifyNoTemporaryOwnerTemplateArtifacts()
const pathLikeJsonPointerCount = verifyPathLikeJsonPointerStrings([
  { label: '0503 acceptance pack', value: acceptancePack },
  { label: '0503 checkbox manifest', value: checkboxManifest },
  { label: '0503 completion audit', value: completionAudit },
  { label: '0503 completion status', value: completionStatus },
  { label: '0503 owner action queue', value: ownerActionQueue },
  { label: '0503 owner closure bundles', value: ownerClosureBundles }
])

console.log(buildEvidencePackVerificationPassedMessage(pathLikeJsonPointerCount))
