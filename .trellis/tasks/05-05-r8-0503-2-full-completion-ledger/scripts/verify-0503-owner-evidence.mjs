import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const taskDir = dirname(scriptDir)
const repoRoot = join(taskDir, '..', '..', '..')
const researchDir = join(taskDir, 'research')
const ownerActionQueueJsonPath = join(researchDir, '0503-owner-action-queue.json')
const ownerClosureBundlesJsonPath = join(researchDir, '0503-owner-closure-bundles.json')
const completionStatusJsonPath = join(researchDir, '0503-completion-status.json')
const completionAuditJsonPath = join(researchDir, '0503-completion-audit.json')
const ownerEvidenceSubmissionSchemaVersion = 'devhub-0503-owner-evidence-submission-v1'
const ownerEvidenceCoverageReportSchemaVersion = 'devhub-0503-owner-evidence-coverage-v1'
const blockerTaxonomyQuerySchemaVersion = 'devhub-0503-blocker-taxonomy-query-v1'
const nextOwnerCommandsQuerySchemaVersion = 'devhub-0503-next-owner-commands-v1'
const ownerClosureBundlesQuerySchemaVersion = 'devhub-0503-owner-closure-bundles-query-v2'
const ownerClosureBundlesSchemaVersion = 'devhub-0503-owner-closure-bundles-v2'
const ownerActionListSchemaVersion = 'devhub-0503-owner-action-list-v1'
const ownerLaneCommandsSchemaVersion = 'devhub-0503-owner-lane-commands-v1'
const ownerSummarySchemaVersion = 'devhub-0503-owner-summary-v1'
const ownerReadinessSchemaVersion = 'devhub-0503-owner-readiness-v1'
const ownerActionDossierSchemaVersion = 'devhub-0503-owner-action-dossier-v1'
const partialR8DossierQuerySchemaVersion = 'devhub-0503-partial-r8-dossier-query-v1'
const sourceFileDossierQuerySchemaVersion = 'devhub-0503-source-file-dossier-query-v1'
const ownerOutputMatrixSchemaVersion = 'devhub-0503-owner-output-matrix-v1'
const ownerEvidenceHashSchemaVersion = 'devhub-0503-owner-evidence-hash-v1'
const ownerEvidenceValidationSchemaVersion = 'devhub-0503-owner-evidence-validation-v1'
const ownerEvidenceDirectoryValidationSchemaVersion = 'devhub-0503-owner-evidence-directory-validation-v1'
const ownerSubmissionTemplateDirectorySchemaVersion = 'devhub-0503-owner-submission-template-directory-v1'
const ownerRawEvidenceTemplateDirectorySchemaVersion = 'devhub-0503-owner-raw-evidence-template-directory-v1'
const ownerRawEvidenceTemplateSchemaVersion = 'devhub-0503-owner-raw-evidence-template-v1'
const strictCompletionCommand = 'pnpm check:0503-strict'
const shellPortableStrictCompletionCommand = 'pnpm --silent check:0503-strict:vd-watch'

function buildWindowsServiceVerificationCommandNote() {
  return `Windows Service evidence must come from a real elevated DevHub service flow: run DevHub from an Administrator Windows session, invoke window.devhub.watchdog.supervisorInstallService(true, '<real operator identity>') through the preload bridge or equivalent application control path, accept the UAC prompt, then rerun pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json and preserve admin.isAdministrator=true, service.installed=true, service.scExitCode=0, and service.status. Do not close from a dry-run command plan, service-name assumption, or non-admin report. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
}

const requiredSubmissionFields = [
  'schemaVersion',
  'owner',
	  'actionId',
	  'evidenceFilePath',
	  'evidenceSha256',
	  'hashAlgorithm',
	  'verificationCommand',
  'resultSummary',
  'evidenceTimestamp',
  'approverOrOperatorIdentity',
  'boundaryStatement'
]
const optionalSubmissionFields = [
  'currentEvidence',
  'evidenceModifiedAt',
  'evidenceSizeBytes',
  'requiredEvidence',
  'recommendedStrictCompletionCommand',
  'strictCompletionCommand',
  'templateOnly',
  'unblockRule',
  'verificationCommandNote'
]
const knownSubmissionFields = new Set([...requiredSubmissionFields, ...optionalSubmissionFields])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readText(filePath) {
  assert(existsSync(filePath), `missing file: ${filePath}`)
  return readFileSync(filePath, 'utf8')
}

function readBytes(filePath) {
  assert(existsSync(filePath), `missing file: ${filePath}`)
  const stats = statSync(filePath)
  assert(stats.isFile(), `evidence path is not a file: ${filePath}`)
  return readFileSync(filePath)
}

function readJson(filePath) {
  return JSON.parse(readText(filePath))
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function parseArgs(argv) {
  const args = {
    actionDossier: false,
    actionFilter: null,
    blockerTaxonomy: false,
    evidenceDirPath: null,
    evidencePath: null,
    coverageJsonPath: null,
    coverageReportPath: null,
    fileFilter: null,
    hashEvidencePath: null,
    listActions: false,
    nextOwnerCommands: false,
    ownerClosureBundles: false,
    ownerLaneCommands: false,
    ownerOutputMatrix: false,
    ownerFilter: null,
    partialR8Dossier: false,
    ownerReadiness: false,
    ownerSummary: false,
    printEvidenceTemplate: false,
    printEvidenceTemplateDirPath: null,
    printTemplate: false,
    printTemplateDirPath: null,
    requireComplete: false,
    selfTest: false,
    sourceFileDossier: false
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--') {
      continue
    } else if (arg === '--action') {
      args.actionFilter = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--action-dossier') {
      args.actionDossier = true
    } else if (arg === '--blocker-taxonomy') {
      args.blockerTaxonomy = true
    } else if (arg === '--owner') {
      args.ownerFilter = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--file') {
      args.fileFilter = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--self-test') {
      args.selfTest = true
    } else if (arg === '--list-actions') {
      args.listActions = true
    } else if (arg === '--next-owner-commands') {
      args.nextOwnerCommands = true
    } else if (arg === '--owner-summary') {
      args.ownerSummary = true
    } else if (arg === '--owner-closure-bundles') {
      args.ownerClosureBundles = true
    } else if (arg === '--owner-lane-commands') {
      args.ownerLaneCommands = true
    } else if (arg === '--owner-output-matrix') {
      args.ownerOutputMatrix = true
    } else if (arg === '--partial-r8-dossier') {
      args.partialR8Dossier = true
    } else if (arg === '--source-file-dossier') {
      args.sourceFileDossier = true
    } else if (arg === '--owner-readiness') {
      args.ownerReadiness = true
    } else if (arg === '--print-template') {
      args.printTemplate = true
    } else if (arg === '--print-template-dir') {
      args.printTemplateDirPath = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--print-evidence-template') {
      args.printEvidenceTemplate = true
    } else if (arg === '--print-evidence-template-dir') {
      args.printEvidenceTemplateDirPath = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--require-complete') {
      args.requireComplete = true
    } else if (arg === '--coverage-report') {
      args.coverageReportPath = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--coverage-json') {
      args.coverageJsonPath = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--hash-evidence') {
      args.hashEvidencePath = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--evidence') {
      args.evidencePath = argv[index + 1] ?? null
      index += 1
    } else if (arg === '--evidence-dir') {
      args.evidenceDirPath = argv[index + 1] ?? null
      index += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  return args
}

function assertNonEmptyString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`)
}

function assertObject(value, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`)
}

function getUnknownSubmissionFields(submission) {
  return Object.keys(submission)
    .filter(field => !knownSubmissionFields.has(field))
    .sort((left, right) => left.localeCompare(right))
}

function assertNoUnknownSubmissionFields(submission) {
  const unknownSubmissionFields = getUnknownSubmissionFields(submission)
  assert(
    unknownSubmissionFields.length === 0,
    `owner evidence submission contains unknown field(s): ${unknownSubmissionFields.join(', ')}`
  )
  return unknownSubmissionFields
}

function normalizeRelativeRepoPath(value) {
  assertNonEmptyString(value, 'repo-relative evidence file path')
  const normalized = value.replaceAll('\\', '/').replace(/^\.\/+/, '')
  assert(!normalized.startsWith('/'), `evidenceFilePath must be repo-relative: ${value}`)
  assert(!/^[A-Za-z]:\//.test(normalized), `evidenceFilePath must not be an absolute Windows path: ${value}`)
  assert(!normalized.split('/').includes('..'), `evidenceFilePath must not contain parent traversal: ${value}`)
  return normalized
}

function normalizePartialR8FileFilter(value) {
  assertNonEmptyString(value, 'partial R8 file filter')
  const normalized = value.replaceAll('\\', '/').replace(/^\.\/+/, '')
  assert(!normalized.startsWith('/'), `partial R8 file filter must be repo-relative: ${value}`)
  assert(!/^[A-Za-z]:\//.test(normalized), `partial R8 file filter must not be an absolute Windows path: ${value}`)
  assert(!normalized.split('/').includes('..'), `partial R8 file filter must not contain parent traversal: ${value}`)
  assert(normalized.startsWith('prompts/0503-2/'), `partial R8 file filter must target prompts/0503-2: ${value}`)
  assert(normalized.endsWith('.md'), `partial R8 file filter must target a Markdown document: ${value}`)
  return normalized
}

function resolveRepoPath(rootDir, repoRelativePath) {
  const normalized = normalizeRelativeRepoPath(repoRelativePath)
  const resolved = resolve(rootDir, normalized)
  const relativeToRoot = relative(rootDir, resolved)
  assert(relativeToRoot !== '' && !relativeToRoot.startsWith('..') && !isAbsolute(relativeToRoot), `resolved path escapes repository root: ${repoRelativePath}`)
  return resolved
}

function getActionIdentifier(action) {
  assertObject(action, 'owner action')
  if (typeof action.gateId === 'string' && action.gateId.trim().length > 0) {
    return action.gateId.trim()
  }
  assertNonEmptyString(action.closureKind, 'owner action closureKind')
  return action.closureKind.trim()
}

function buildActionDossierCommand(actionOrId) {
  const actionId = typeof actionOrId === 'string' ? actionOrId : getActionIdentifier(actionOrId)
  assertNonEmptyString(actionId, 'owner action dossier command actionId')
  return `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${actionId}`
}

function buildSourceFileDossierCommand(actionOrId, filePath) {
  const actionId = typeof actionOrId === 'string' ? actionOrId : getActionIdentifier(actionOrId)
  assertNonEmptyString(actionId, 'source file dossier command actionId')
  assertNonEmptyString(filePath, 'source file dossier command filePath')
  return `pnpm --silent check:0503-owner-evidence -- --source-file-dossier --action ${actionId} --file ${filePath}`
}

function buildActionCommandSet(actionOrId) {
  const actionId = typeof actionOrId === 'string' ? actionOrId : getActionIdentifier(actionOrId)
  const action = typeof actionOrId === 'string' ? {} : actionOrId
  return {
    actionDossierCommand: action.actionDossierCommand ?? buildActionDossierCommand(actionId),
    rawEvidenceTemplateCommand: action.rawEvidenceTemplateCommand ?? `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${actionId}`,
    submissionTemplateCommand: action.submissionTemplateCommand ?? `pnpm --silent check:0503-owner-evidence -- --print-template --action ${actionId}`
  }
}

function withSourceFileCommandSet(sourceFiles, actionOrId) {
  if (!sourceFiles || !Array.isArray(sourceFiles.files)) return sourceFiles ?? null
  const actionId = typeof actionOrId === 'string' ? actionOrId : getActionIdentifier(actionOrId)
  const actionCommands = buildActionCommandSet(actionOrId)
  return {
    ...sourceFiles,
    files: sourceFiles.files.map(row => ({
      ...row,
      ...actionCommands,
      sourceFileDossierCommand: row.sourceFileDossierCommand ?? buildSourceFileDossierCommand(actionId, row.file)
    }))
  }
}

function validateActionQueue(queue) {
  assertObject(queue, 'owner action queue')
  const actions = Array.isArray(queue.actions) ? queue.actions : []

  const seen = new Set()
  for (const action of actions) {
    const actionId = getActionIdentifier(action)
    assert(!seen.has(actionId), `duplicate owner action identifier in queue: ${actionId}`)
    seen.add(actionId)
    assertNonEmptyString(action.owner, `owner action ${actionId} owner`)
    assertNonEmptyString(action.currentEvidence, `owner action ${actionId} currentEvidence`)
    assertNonEmptyString(action.requiredEvidence, `owner action ${actionId} requiredEvidence`)
    assertNonEmptyString(action.verificationCommand, `owner action ${actionId} verificationCommand`)
  }

  return actions
}

function findAction(actions, submission) {
  assertNonEmptyString(submission.actionId, 'actionId')
  const actionId = submission.actionId.trim()
  const matches = actions.filter(action => getActionIdentifier(action) === actionId)
  assert(matches.length <= 1, `owner action identifier collision: ${actionId}`)
  return matches[0] ?? null
}

function assertNoPlaceholderLanguage(submission) {
  const combined = [
    submission.resultSummary,
    submission.boundaryStatement,
    submission.approverOrOperatorIdentity
  ].join('\n')
  const forbidden = /\b(mocked?|simulated?|fake|placeholder|dry[- ]?run|template only)\b/i
  assert(!forbidden.test(combined), 'submission text contains placeholder, mock, simulated, fake, or dry-run language')
}

function assertBoundaryStatementHonest(value) {
  assertNonEmptyString(value, 'boundaryStatement')
  const forbiddenCompletionClaims = /\b(none|nothing remains|no remaining|fully complete|completed|all complete|all done|goal complete|strict completion passed|100% complete|unblocked)\b/i
  assert(!forbiddenCompletionClaims.test(value), 'boundaryStatement must not claim completion, no remaining work, or unblock status; strict completion remains authoritative')
}

function normalizeCommand(value) {
  assertNonEmptyString(value, 'verificationCommand')
  return value.replace(/\s+/g, ' ').trim()
}

function assertVerificationCommandMatches(submissionCommand, expectedCommand, actionId) {
  const submitted = normalizeCommand(submissionCommand)
  const expected = normalizeCommand(expectedCommand)
  assert(!submitted.includes('<') && !submitted.includes('>'), `verificationCommand for ${actionId} must not contain template placeholders`)

  assert(submitted === expected, `verificationCommand mismatch for ${actionId}: expected "${expected}", got "${submitted}"`)
}

function assertTimestamp(value, now = new Date()) {
  assertNonEmptyString(value, 'evidenceTimestamp')
  const parsed = new Date(value)
  assert(!Number.isNaN(parsed.getTime()), `evidenceTimestamp must be a valid ISO timestamp: ${value}`)
  assert(value.includes('T'), `evidenceTimestamp must include date and time: ${value}`)
  assert(parsed.getTime() <= now.getTime() + 5 * 60 * 1000, `evidenceTimestamp is more than five minutes in the future: ${value}`)
  return parsed
}

function assertEvidenceTimestampIsFresh(parsedTimestamp, queue) {
  if (typeof queue.generatedAt !== 'string' || queue.generatedAt.trim().length === 0) return
  const generatedAt = new Date(queue.generatedAt)
  if (Number.isNaN(generatedAt.getTime())) return
  const skewAllowanceMs = 60 * 1000
  assert(
    parsedTimestamp.getTime() + skewAllowanceMs >= generatedAt.getTime(),
    `evidenceTimestamp predates owner action queue generatedAt ${queue.generatedAt}; rerun the real verification after the current queue is generated`
  )
}

function assertEvidenceFileNotSelfReferential(evidencePath, submissionRelativePath) {
  if (typeof submissionRelativePath !== 'string' || submissionRelativePath.trim().length === 0) return
  const normalizedSubmissionPath = normalizeRelativeRepoPath(submissionRelativePath)
  assert(
    evidencePath.toLowerCase() !== normalizedSubmissionPath.toLowerCase(),
    'evidenceFilePath must not point to the owner evidence submission JSON itself'
  )
}

function assertEvidenceFileIsFresh(evidenceAbsPath, queue, now = new Date()) {
  const stats = statSync(evidenceAbsPath)
  assert(stats.isFile(), `evidence path is not a file: ${evidenceAbsPath}`)
  assert(stats.mtimeMs <= now.getTime() + 5 * 60 * 1000, `evidence file mtime is more than five minutes in the future: ${stats.mtime.toISOString()}`)

  if (typeof queue.generatedAt === 'string' && queue.generatedAt.trim().length > 0) {
    const generatedAt = new Date(queue.generatedAt)
    if (!Number.isNaN(generatedAt.getTime())) {
      const skewAllowanceMs = 60 * 1000
      assert(
        stats.mtimeMs + skewAllowanceMs >= generatedAt.getTime(),
        `evidence file mtime predates owner action queue generatedAt ${queue.generatedAt}; rerun or recopy the real evidence after the current queue is generated`
      )
    }
  }

  return {
    evidenceModifiedAt: stats.mtime.toISOString(),
    evidenceSizeBytes: stats.size
  }
}

function assertReportTimestampIsFresh(value, queue, label) {
  assertNonEmptyString(value, `${label} timestamp`)
  const parsedTimestamp = assertTimestamp(value)
  assertEvidenceTimestampIsFresh(parsedTimestamp, queue)
}

function parseStructuredEvidenceJson(evidenceBytes, evidencePath, label) {
  try {
    return JSON.parse(evidenceBytes.toString('utf8'))
  } catch {
    throw new Error(`${label} evidence must be JSON produced by the listed verification command: ${evidencePath}`)
  }
}

function assertEvidenceTextIsNotTemplate(text, label) {
  const forbidden = /templateOnly|template only|replace with|<[^>]+>|placeholder/i
  assert(!forbidden.test(text), `${label} must not contain template markers or placeholders`)
}

function validateExternalBlockerReportEvidence(actionId, evidencePath, evidenceBytes, queue) {
  const report = parseStructuredEvidenceJson(evidenceBytes, evidencePath, 'external blocker')
  assertReportTimestampIsFresh(report.generatedAt, queue, 'external blocker report generatedAt')
  assert(Array.isArray(report.gates), 'external blocker evidence report must contain a gates array')
  const matchingGate = report.gates.find(gate => gate?.id === actionId)
  assert(matchingGate, `external blocker evidence report does not contain gate ${actionId}`)
  assert(matchingGate.passed === true, `external blocker evidence report gate ${actionId} must have passed=true`)
  if (actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY') {
    assert(report.browserWindowSecondDisplay?.valid === true, 'external blocker evidence must include browserWindowSecondDisplay.valid=true')
    assert(Number(report.browserWindowSecondDisplay?.displayCount) >= 2, `external blocker BrowserWindow evidence must report at least two displays, got ${report.browserWindowSecondDisplay?.displayCount}`)
    assert(report.browserWindowSecondDisplay?.targetDisplayId !== null && report.browserWindowSecondDisplay?.targetDisplayId !== undefined, 'external blocker BrowserWindow evidence must include targetDisplayId')
    assert(report.browserWindowSecondDisplay?.matchedDisplayId === report.browserWindowSecondDisplay?.targetDisplayId, 'external blocker BrowserWindow evidence must match the target secondary display')
  }
  if (actionId === 'R8C_SPEC17_ADMIN_SHELL') {
    assert(report.admin?.isAdministrator === true, 'external blocker admin evidence must report admin.isAdministrator=true')
    assertNonEmptyString(report.admin?.user, 'external blocker admin user')
  }
  if (actionId === 'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED') {
    assert(report.admin?.isAdministrator === true, 'external blocker Windows Service evidence must be captured from an Administrator session')
    assert(report.service?.installed === true, 'external blocker Windows Service evidence must report service.installed=true')
    assert(report.service?.scExitCode === 0, `external blocker Windows Service evidence must report scExitCode=0, got ${report.service?.scExitCode}`)
    assertNonEmptyString(report.service?.status, 'external blocker Windows Service status')
    assert(!['not-installed', 'query-failed', 'unknown'].includes(report.service.status), `external blocker Windows Service status is not verifiable: ${report.service.status}`)
  }
  return {
    gateEvidence: matchingGate.evidence ?? null,
    gateId: actionId,
    reportGeneratedAt: report.generatedAt,
    type: 'r8-external-blocker-report'
  }
}

function validateBrowserWindowSecondDisplayEvidence(evidencePath, evidenceBytes, queue) {
  const report = parseStructuredEvidenceJson(evidenceBytes, evidencePath, 'BrowserWindow second-display')
  assert(report.schemaVersion === 'devhub-browserwindow-second-display-v1', 'BrowserWindow second-display report must use schemaVersion devhub-browserwindow-second-display-v1')
  assertReportTimestampIsFresh(report.capturedAt, queue, 'BrowserWindow second-display report capturedAt')
  assert(report.blocked === false, 'BrowserWindow second-display report must not be blocked')
  assert(report.passed === true, 'BrowserWindow second-display report must have passed=true')
  assert(Number(report.displayCount) >= 1, `BrowserWindow placement report must include at least one display, got ${report.displayCount}`)
  assert(report.placement?.passed === true, 'BrowserWindow second-display placement must have passed=true')
  const singleDisplayFallback = report.targetMode === 'single-display-fallback' && report.placement?.singleDisplayFallback === true
  const secondaryDisplayPlacement = report.placement?.targetDisplayIsSecondary === true
  assert(secondaryDisplayPlacement || singleDisplayFallback, 'BrowserWindow placement target must be a secondary display or explicit single-display fallback')
  assert(report.placement?.targetDisplayMatched === true, 'BrowserWindow second-display matched display must equal the target display')
  assert(report.placement?.browserWindowInsideTargetWorkArea === true, 'BrowserWindow bounds must be inside the target display work area')
  return {
    displayCount: report.displayCount,
    matchedDisplayId: report.placement?.matchedDisplayId ?? null,
    targetDisplayId: report.placement?.targetDisplayId ?? null,
    targetMode: report.targetMode ?? report.placement?.targetMode ?? null,
    type: 'browserwindow-second-display-report'
  }
}

function validateZeroEgressEvidence(evidencePath, evidenceBytes, queue) {
  const report = parseStructuredEvidenceJson(evidenceBytes, evidencePath, 'zero-egress capture')
  assertReportTimestampIsFresh(report.capturedAt, queue, 'zero-egress report capturedAt')
  assert(report.blocked === false, 'zero-egress evidence report must not be blocked')
  assert(report.passed === true, 'zero-egress evidence report must have passed=true')
  const legacyGlobalPacketPass = report.packetCount === 0
  const appScopedPass = report.appScopedPassed === true &&
    report.processNetwork?.nonLoopbackEndpointCount === 0 &&
    Array.isArray(report.processNetwork?.processIds) &&
    report.processNetwork.processIds.length > 0
  assert(legacyGlobalPacketPass || appScopedPass, `zero-egress evidence report must have packetCount=0 or appScopedPassed=true with zero non-loopback endpoints, got packetCount=${report.packetCount}`)
  assert(Number(report.durationSeconds) >= 60, `zero-egress evidence report must cover at least 60 seconds, got ${report.durationSeconds}`)
  return {
    appScopedPassed: report.appScopedPassed === true,
    capturedAt: report.capturedAt,
    durationSeconds: report.durationSeconds,
    globalPacketCount: report.globalPacketCount ?? null,
    nonLoopbackEndpointCount: report.processNetwork?.nonLoopbackEndpointCount ?? null,
    packetCount: report.packetCount,
    type: 'zero-egress-capture-report'
  }
}

function validatePhysicalMonitorHotplugEvidence(evidencePath, evidenceBytes, queue) {
  const report = parseStructuredEvidenceJson(evidenceBytes, evidencePath, 'physical monitor hotplug')
  assert(report.schemaVersion === 'devhub-physical-monitor-hotplug-v1', 'physical monitor evidence report must use schemaVersion devhub-physical-monitor-hotplug-v1')
  assertReportTimestampIsFresh(report.capturedAt, queue, 'physical monitor hotplug report capturedAt')
  assert(report.blocked === false, 'physical monitor hotplug report must not be blocked')
  assert(report.passed === true, 'physical monitor hotplug report must have passed=true')
  assert(Number(report.durationSeconds) >= 10, `physical monitor hotplug report must cover at least 10 seconds, got ${report.durationSeconds}`)
  const physicalHotplugPass = Number(report.baselineDisplayCount) >= 2 &&
    report.removalObserved === true &&
    report.reconnectionObserved === true &&
    Number(report.minDisplayCount) < Number(report.baselineDisplayCount) &&
    Number(report.finalDisplayCount) >= Number(report.baselineDisplayCount)
  const singleDisplayFallback = report.singleDisplayFallback === true &&
    report.hotplugNotTested === true &&
    report.targetMode === 'single-display-fallback' &&
    Number(report.baselineDisplayCount) === 1 &&
    Number(report.minDisplayCount) === 1 &&
    Number(report.finalDisplayCount) === 1
  assert(physicalHotplugPass || singleDisplayFallback, 'physical monitor report must prove real hotplug or explicit single-display fallback stability')
  assert(Number(report.finalDisplayCount) >= Number(report.baselineDisplayCount), 'physical monitor hotplug report finalDisplayCount must return to baselineDisplayCount or higher')
  return {
    baselineDisplayCount: report.baselineDisplayCount,
    durationSeconds: report.durationSeconds,
    finalDisplayCount: report.finalDisplayCount,
    minDisplayCount: report.minDisplayCount,
    sampleCount: report.sampleCount ?? null,
    type: 'physical-monitor-hotplug-report'
  }
}

function normalizeJsonForComparison(value) {
  return JSON.stringify(value)
}

function validateCheckboxClosureEvidence(action, actionId, evidencePath, evidenceBytes, queue) {
  const report = parseStructuredEvidenceJson(evidenceBytes, evidencePath, 'checkbox closure')
  assert(report.templateOnly !== true, 'checkbox closure evidence must not be a templateOnly document')
  assert(report.schemaVersion === 'devhub-0503-checkbox-closure-evidence-v1', 'checkbox closure evidence must use schemaVersion devhub-0503-checkbox-closure-evidence-v1')
  assert(report.actionId === actionId, `checkbox closure evidence actionId mismatch: expected ${actionId}, got ${report.actionId}`)
  assert(report.closureKind === action.closureKind, `checkbox closure evidence closureKind mismatch: expected ${action.closureKind}, got ${report.closureKind}`)
  assert(report.owner === action.owner, `checkbox closure evidence owner mismatch: expected ${action.owner}, got ${report.owner}`)
  assert(report.rowCount === action.count, `checkbox closure evidence rowCount mismatch: expected ${action.count}, got ${report.rowCount}`)
  assertReportTimestampIsFresh(report.decidedAt, queue, 'checkbox closure evidence decidedAt')
  assertNonEmptyString(report.decision, 'checkbox closure evidence decision')
  assertEvidenceTextIsNotTemplate(report.decision, 'checkbox closure evidence decision')
  assert(/decision|approval|approved|accepted|confirmed|reviewed|决策|批准|确认|接受|审查/.test(report.decision), 'checkbox closure evidence decision must contain an explicit review or approval statement')
  assert(
    normalizeJsonForComparison(report.sourceFiles) === normalizeJsonForComparison(action.sourceFiles),
    'checkbox closure evidence sourceFiles must match the current owner action queue sourceFiles exactly'
  )
  return {
    closureKind: action.closureKind,
    owner: action.owner,
    rowCount: report.rowCount,
    type: 'checkbox-closure-evidence'
  }
}

function validateStructuredEvidence(action, actionId, evidencePath, evidenceBytes, queue) {
  const command = normalizeCommand(action.verificationCommand)
  if (action.actionType === 'checkbox-closure-class') {
    return validateCheckboxClosureEvidence(action, actionId, evidencePath, evidenceBytes, queue)
  }
  if (command.includes('check:r8-external-blockers')) {
    return validateExternalBlockerReportEvidence(actionId, evidencePath, evidenceBytes, queue)
  }
  if (command.includes('check:browserwindow-second-display')) {
    return validateBrowserWindowSecondDisplayEvidence(evidencePath, evidenceBytes, queue)
  }
  if (command.includes('check:zero-egress-capture')) {
    return validateZeroEgressEvidence(evidencePath, evidenceBytes, queue)
  }
  if (command.includes('check:physical-monitor-hotplug')) {
    return validatePhysicalMonitorHotplugEvidence(evidencePath, evidenceBytes, queue)
  }
  return null
}

function validateSubmission(submission, queue, options = {}) {
  const rootDir = options.repoRoot ?? repoRoot
  assertObject(submission, 'owner evidence submission')
  assertObject(queue, 'owner action queue')
  assert(submission.templateOnly !== true, 'owner evidence submission must not be a templateOnly document')
  const unknownSubmissionFields = assertNoUnknownSubmissionFields(submission)

  for (const field of requiredSubmissionFields) {
    assertNonEmptyString(submission[field], field)
  }
	  assert(submission.schemaVersion === ownerEvidenceSubmissionSchemaVersion, `owner evidence submission schemaVersion must be ${ownerEvidenceSubmissionSchemaVersion}`)
	  assert(/^[a-f0-9]{64}$/i.test(submission.evidenceSha256), 'evidenceSha256 must be a 64-character hex digest')
	  assert(submission.hashAlgorithm === 'sha256', 'hashAlgorithm must be sha256')

  const actions = validateActionQueue(queue)
  const action = findAction(actions, submission)
  assert(action, 'submission does not match any current owner action by canonical actionId')
  const actionId = getActionIdentifier(action)
  assert(submission.owner === action.owner, `owner mismatch for ${actionId}: expected ${action.owner}, got ${submission.owner}`)
  assertVerificationCommandMatches(submission.verificationCommand, action.verificationCommand, actionId)

  const evidencePath = normalizeRelativeRepoPath(submission.evidenceFilePath)
  assertEvidenceFileNotSelfReferential(evidencePath, options.submissionRelativePath)
  const evidenceAbsPath = resolveRepoPath(rootDir, evidencePath)
  const evidenceFileInfo = assertEvidenceFileIsFresh(evidenceAbsPath, queue, options.now)
  assertNonEmptyString(submission.evidenceModifiedAt, 'evidenceModifiedAt')
  assert(submission.evidenceModifiedAt === evidenceFileInfo.evidenceModifiedAt, `evidenceModifiedAt mismatch for ${evidencePath}: expected ${submission.evidenceModifiedAt}, got ${evidenceFileInfo.evidenceModifiedAt}`)
  assert(Number.isSafeInteger(submission.evidenceSizeBytes) && submission.evidenceSizeBytes >= 0, 'evidenceSizeBytes must be a non-negative safe integer')
  assert(submission.evidenceSizeBytes === evidenceFileInfo.evidenceSizeBytes, `evidenceSizeBytes mismatch for ${evidencePath}: expected ${submission.evidenceSizeBytes}, got ${evidenceFileInfo.evidenceSizeBytes}`)
  const evidenceBytes = readBytes(evidenceAbsPath)
  const actualSha256 = sha256(evidenceBytes)
  assert(actualSha256 === submission.evidenceSha256.toLowerCase(), `evidenceSha256 mismatch for ${evidencePath}: expected ${submission.evidenceSha256}, got ${actualSha256}`)
  const structuredEvidence = validateStructuredEvidence(action, actionId, evidencePath, evidenceBytes, queue)

  const evidenceTimestamp = assertTimestamp(submission.evidenceTimestamp, options.now)
  assertEvidenceTimestampIsFresh(evidenceTimestamp, queue)
  assertNoPlaceholderLanguage(submission)
  assertBoundaryStatementHonest(submission.boundaryStatement)

  return {
    actionId,
    currentEvidence: action.currentEvidence,
	    evidenceFilePath: evidencePath,
	    evidenceModifiedAt: evidenceFileInfo.evidenceModifiedAt,
	    hashAlgorithm: 'sha256',
	    evidenceSha256: actualSha256,
	    evidenceSizeBytes: evidenceFileInfo.evidenceSizeBytes,
    owner: action.owner,
    requiredEvidence: action.requiredEvidence,
    strictCompletionCommand,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    strictCompletionStillRequired: true,
    structuredEvidence,
    unblockRule: action.unblockRule,
    unknownSubmissionFields,
    verificationCommand: submission.verificationCommand
  }
}

function validateEvidenceDirectory(rootDir, queue, evidenceDirPath, options = {}) {
  const evidenceDirAbsPath = resolveRepoPath(rootDir, evidenceDirPath)
  assert(statSync(evidenceDirAbsPath).isDirectory(), `evidence directory is not a directory: ${evidenceDirPath}`)
  const submissionFiles = readdirSync(evidenceDirAbsPath)
    .filter(fileName => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
  assert(submissionFiles.length > 0, `evidence directory contains no JSON submissions: ${evidenceDirPath}`)

  const seenActionIds = new Set()
  const summaries = []
  for (const fileName of submissionFiles) {
    const submissionRelativePath = normalizeRelativeRepoPath(`${evidenceDirPath.replaceAll('\\', '/')}/${fileName}`)
    const submission = readJson(resolveRepoPath(rootDir, submissionRelativePath))
    const summary = validateSubmission(submission, queue, {
      ...options,
      submissionRelativePath
    })
    assert(!seenActionIds.has(summary.actionId), `duplicate owner evidence submission for actionId: ${summary.actionId}`)
    seenActionIds.add(summary.actionId)
    summaries.push({
      ...summary,
      submissionFilePath: submissionRelativePath
    })
  }

  return summaries
}

function summarizeEvidenceDirectoryCoverage(queue, summaries, requireComplete = false) {
  return summarizeEvidenceDirectoryCoverageForOwner(queue, summaries, requireComplete, null)
}

function filterActionsByOwner(actions, ownerFilter) {
  if (ownerFilter === null) return actions
  assertNonEmptyString(ownerFilter, 'owner filter')
  const filteredActions = actions.filter(action => action.owner === ownerFilter)
  assert(filteredActions.length > 0, `owner action queue has no actions for owner: ${ownerFilter}`)
  return filteredActions
}

function summarizeEvidenceDirectoryCoverageForOwner(queue, summaries, requireComplete = false, ownerFilter = null) {
  const actions = filterActionsByOwner(validateActionQueue(queue), ownerFilter)
  const actionIds = actions.map(action => getActionIdentifier(action))
  const ownerSummaries = ownerFilter === null
    ? summaries
    : summaries.filter(summary => summary.owner === ownerFilter)
  const submittedActionIds = [...new Set(ownerSummaries.map(summary => summary.actionId))].sort((left, right) => left.localeCompare(right))
  const submittedSet = new Set(submittedActionIds)
  const missingActionIds = actionIds.filter(actionId => !submittedSet.has(actionId))
  const actionById = new Map(actions.map(action => [getActionIdentifier(action), action]))
  const missingByOwner = {}
  const submittedByOwner = {}
  for (const actionId of missingActionIds) {
    const owner = actionById.get(actionId)?.owner ?? 'unassigned'
    missingByOwner[owner] = [...(missingByOwner[owner] ?? []), actionId]
  }
  for (const actionId of submittedActionIds) {
    const owner = actionById.get(actionId)?.owner ?? 'unassigned'
    submittedByOwner[owner] = [...(submittedByOwner[owner] ?? []), actionId]
  }
  if (requireComplete) {
    assert(missingActionIds.length === 0, `owner evidence directory is incomplete; missing actionIds: ${missingActionIds.join(', ')}`)
  }
  return {
    complete: missingActionIds.length === 0,
    missingActionIds,
    missingByOwner,
    ownerFilter,
    submittedActionCount: submittedActionIds.length,
    submittedActionIds,
    submittedByOwner,
    totalActionCount: actionIds.length
  }
}

function summarizeEvidenceDirectoryValidationError(queue, evidenceDirPath, error, ownerFilter = null) {
  const actions = filterActionsByOwner(validateActionQueue(queue), ownerFilter)
  const actionIds = actions.map(action => getActionIdentifier(action)).sort((left, right) => left.localeCompare(right))
  const missingByOwner = {}
  for (const action of actions) {
    const actionId = getActionIdentifier(action)
    missingByOwner[action.owner] = [...(missingByOwner[action.owner] ?? []), actionId]
  }
  return {
    complete: false,
    evidenceDirPath: normalizeRelativeRepoPath(evidenceDirPath),
    missingActionIds: actionIds,
    missingByOwner,
    ownerFilter,
    submittedActionCount: 0,
    submittedActionIds: [],
    submittedByOwner: {},
    totalActionCount: actionIds.length,
    validationError: error instanceof Error ? error.message : String(error),
    validationStatus: 'invalid-evidence-directory'
  }
}

function findActionForTemplate(queue, actionFilter) {
  assertNonEmptyString(actionFilter, 'template action filter')
  const actions = validateActionQueue(queue)
  const matches = actions.filter(action => getActionIdentifier(action) === actionFilter || action.closureKind === actionFilter)
  assert(matches.length > 0, `no owner action matches template action filter: ${actionFilter}`)
  assert(matches.length === 1, `template action filter is ambiguous: ${actionFilter}; use the exact canonical actionId`)
  return matches[0]
}

function buildSubmissionTemplate(action = null) {
  const template = {
    schemaVersion: ownerEvidenceSubmissionSchemaVersion,
    templateOnly: true,
    owner: action?.owner ?? '<operator | legal-product | product | user-product>',
	    actionId: action ? getActionIdentifier(action) : '<exact canonical actionId from --list-actions>',
	    evidenceFilePath: '<repo-relative path to the real evidence file>',
	    evidenceModifiedAt: '<evidence file mtime from --hash-evidence output>',
	    evidenceSizeBytes: '<evidence file byte size from --hash-evidence output>',
	    evidenceSha256: '<sha256 of evidenceFilePath contents>',
	    hashAlgorithm: 'sha256',
	    verificationCommand: action?.verificationCommand ?? '<real command that produced the evidence; must match the listed action command>',
    strictCompletionCommand,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    resultSummary: '<pass/fail and measured values from the real run>',
    evidenceTimestamp: '<ISO timestamp after the current owner action queue was generated>',
    approverOrOperatorIdentity: '<real Windows identity, product owner, or legal owner>',
    boundaryStatement: '<what remains unclaimed; do not claim completion because strict completion remains authoritative>'
  }
  if (action) {
    template.currentEvidence = action.currentEvidence
    template.requiredEvidence = action.requiredEvidence
    template.unblockRule = action.unblockRule
    if (typeof action.verificationCommandNote === 'string' && action.verificationCommandNote.trim().length > 0) template.verificationCommandNote = action.verificationCommandNote
  }
  return template
}

function printTemplate(queue = null, actionFilter = null) {
  const action = queue && actionFilter ? findActionForTemplate(queue, actionFilter) : null
  console.log(JSON.stringify(buildSubmissionTemplate(action), null, 2))
}

function buildRawEvidenceTemplate(action) {
  const actionId = getActionIdentifier(action)
  if (action.actionType === 'checkbox-closure-class') {
    return {
      schemaVersion: 'devhub-0503-checkbox-closure-evidence-v1',
      templateOnly: true,
      actionId,
      closureKind: action.closureKind,
      owner: action.owner,
      rowCount: action.count,
      sourceFiles: withSourceFileCommandSet(action.sourceFiles, action),
      strictCompletionCommand,
      recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
      decidedAt: '<ISO timestamp after current owner action queue generatedAt>',
      decision: '<replace with real external owner review or approval decision>',
      ...(typeof action.verificationCommandNote === 'string' && action.verificationCommandNote.trim().length > 0 ? { verificationCommandNote: action.verificationCommandNote } : {})
    }
  }
  const template = {
    schemaVersion: ownerRawEvidenceTemplateSchemaVersion,
    templateOnly: true,
    actionId,
    note: 'Do not submit this template as evidence. Run the listed verification command and submit its real output or report.',
    expectedVerificationCommand: action.verificationCommand,
    strictCompletionCommand,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    requiredEvidence: action.requiredEvidence,
    unblockRule: action.unblockRule
  }
  if (typeof action.verificationCommandNote === 'string' && action.verificationCommandNote.trim().length > 0) template.verificationCommandNote = action.verificationCommandNote
  return template
}

function printEvidenceTemplate(queue, actionFilter) {
  const action = findActionForTemplate(queue, actionFilter)
  console.log(JSON.stringify(buildRawEvidenceTemplate(action), null, 2))
}

function toSafeTemplateFileName(actionId) {
  return `${actionId.replace(/[^A-Za-z0-9._-]/g, '_')}.raw-evidence-template.json`
}

function toSafeSubmissionTemplateFileName(actionId) {
  return `${actionId.replace(/[^A-Za-z0-9._-]/g, '_')}.submission-template.json`
}

function removeStaleTemplateFiles(outputDirAbsPath, suffix) {
  for (const fileName of readdirSync(outputDirAbsPath)) {
    if (fileName.endsWith(`.${suffix}.json`)) {
      rmSync(join(outputDirAbsPath, fileName), { force: true })
    }
  }
}

function writeTemplateDirectoryReadme(rootDir, normalizedOutputDir, title, note, directorySchemaVersion) {
  const readmePath = `${normalizedOutputDir}/README.md`.replaceAll('\\', '/')
  writeFileSync(resolveRepoPath(rootDir, readmePath), [
    `# ${title}`,
    '',
    note,
    '',
    `Directory command output schema: \`${directorySchemaVersion}\`.`,
    '',
    `These files are \`templateOnly\` scaffolds. They are not owner evidence, do not close any 0503 gate, and do not waive \`${strictCompletionCommand}\`. Final closure should rerun \`${shellPortableStrictCompletionCommand}\`.`,
    '',
    'Do not validate this template directory directly as evidence. Copy the needed JSON files into a separate owner evidence directory, then replace every placeholder with real evidence metadata and remove `templateOnly` from each submitted JSON file.',
    '',
    'Owner submission JSON is a strict schema boundary: unknown fields are rejected. Put free-form evidence context into the referenced raw evidence file, not into the submission wrapper.',
    '',
    'Recommended workflow:',
    '',
    '1. Print the owner lane commands with `pnpm --silent check:0503-owner-evidence -- --next-owner-commands --owner <owner>`.',
    '2. Copy only the relevant template files into a new repo-relative evidence directory.',
    '3. Attach real command output, environment evidence paths, timestamps, and owner identity in that copied directory.',
    '4. Run `pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>` for every raw evidence file and copy `evidenceSha256`, `hashAlgorithm`, `evidenceModifiedAt`, and `evidenceSizeBytes` into the submission JSON.',
    '5. Validate the copied directory with `pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>`.',
    '6. Require completeness with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner <owner> --require-complete`.',
    `7. Rerun final strict completion with \`${shellPortableStrictCompletionCommand}\`.`,
    ''
  ].join('\n'))
  return readmePath
}

function writeSubmissionTemplateDirectory(rootDir, queue, outputDirPath, ownerFilter = null) {
  assertNonEmptyString(outputDirPath, 'submission template output directory')
  const normalizedOutputDir = normalizeRelativeRepoPath(outputDirPath)
  const outputDirAbsPath = resolveRepoPath(rootDir, normalizedOutputDir)
  mkdirSync(outputDirAbsPath, { recursive: true })
  removeStaleTemplateFiles(outputDirAbsPath, 'submission-template')
  const readmePath = writeTemplateDirectoryReadme(rootDir, normalizedOutputDir, '0503 Owner Submission Templates', 'This directory contains owner submission template JSON files for the remaining 0503 owner actions.', ownerSubmissionTemplateDirectorySchemaVersion)
  const actions = filterActionsByOwner(validateActionQueue(queue), ownerFilter)
  const templates = actions.map(action => {
    const actionId = getActionIdentifier(action)
    const fileName = toSafeSubmissionTemplateFileName(actionId)
    const templateRelativePath = `${normalizedOutputDir}/${fileName}`.replaceAll('\\', '/')
    writeFileSync(resolveRepoPath(rootDir, templateRelativePath), `${JSON.stringify(buildSubmissionTemplate(action), null, 2)}\n`)
    return {
      actionId,
      filePath: templateRelativePath,
      owner: action.owner,
      templateOnly: true
    }
  })
  return {
    schemaVersion: ownerSubmissionTemplateDirectorySchemaVersion,
    boundary: `Submission template directory output is scaffolding only. It does not close evidence and does not waive ${strictCompletionCommand}.`,
    count: templates.length,
    note: 'These files are non-passable templateOnly owner submission shapes. Remove templateOnly and replace every placeholder with real evidence metadata before validation.',
    outputDirPath: normalizedOutputDir,
    ownerFilter,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    readmePath,
    strictCompletionCommand,
    templateOnly: true,
    templates
  }
}

function writeEvidenceTemplateDirectory(rootDir, queue, outputDirPath, ownerFilter = null) {
  assertNonEmptyString(outputDirPath, 'raw evidence template output directory')
  const normalizedOutputDir = normalizeRelativeRepoPath(outputDirPath)
  const outputDirAbsPath = resolveRepoPath(rootDir, normalizedOutputDir)
  mkdirSync(outputDirAbsPath, { recursive: true })
  removeStaleTemplateFiles(outputDirAbsPath, 'raw-evidence-template')
  const readmePath = writeTemplateDirectoryReadme(rootDir, normalizedOutputDir, '0503 Raw Evidence Templates', 'This directory contains raw evidence template JSON files for the remaining 0503 owner actions.', ownerRawEvidenceTemplateDirectorySchemaVersion)
  const actions = filterActionsByOwner(validateActionQueue(queue), ownerFilter)
  const templates = actions.map(action => {
    const actionId = getActionIdentifier(action)
    const fileName = toSafeTemplateFileName(actionId)
    const templateRelativePath = `${normalizedOutputDir}/${fileName}`.replaceAll('\\', '/')
    writeFileSync(resolveRepoPath(rootDir, templateRelativePath), `${JSON.stringify(buildRawEvidenceTemplate(action), null, 2)}\n`)
    return {
      actionId,
      filePath: templateRelativePath,
      owner: action.owner,
      templateOnly: true
    }
  })
  return {
    schemaVersion: ownerRawEvidenceTemplateDirectorySchemaVersion,
    boundary: `Raw evidence template directory output is scaffolding only. It does not close evidence and does not waive ${strictCompletionCommand}.`,
    count: templates.length,
    note: 'These files are non-passable templateOnly raw evidence shapes. They are not completion evidence.',
    outputDirPath: normalizedOutputDir,
    ownerFilter,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    readmePath,
    strictCompletionCommand,
    templateOnly: true,
    templates
  }
}

function printEvidenceHash(rootDir, evidenceFilePath) {
  const normalizedPath = normalizeRelativeRepoPath(evidenceFilePath)
  const evidenceAbsPath = resolveRepoPath(rootDir, normalizedPath)
  const evidenceStats = statSync(evidenceAbsPath)
  assert(evidenceStats.isFile(), `evidence path is not a file: ${evidenceFilePath}`)
  const evidenceBytes = readBytes(evidenceAbsPath)
  console.log(JSON.stringify({
    schemaVersion: ownerEvidenceHashSchemaVersion,
    boundary: `Evidence hash output is a digest helper only. It does not close evidence and does not waive ${strictCompletionCommand}.`,
    evidenceFilePath: normalizedPath,
    evidenceModifiedAt: evidenceStats.mtime.toISOString(),
    evidenceSha256: sha256(evidenceBytes),
    evidenceSizeBytes: evidenceStats.size,
    hashAlgorithm: 'sha256',
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    strictCompletionCommand
  }, null, 2))
}

function buildOwnerEvidenceValidationOutput(summary) {
  return {
    schemaVersion: ownerEvidenceValidationSchemaVersion,
    boundary: `This validates one submission structure and evidence file integrity only. It does not close evidence and does not waive ${strictCompletionCommand}.`,
    status: 'owner-evidence-format-verified',
    note: 'This validates submission structure and evidence file integrity only. Strict completion remains authoritative.',
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    strictCompletionCommand,
    summary
  }
}

function buildOwnerEvidenceDirectoryValidationOutput(summaries, coverage, coverageReportPath, coverageJsonPath) {
  return {
    schemaVersion: ownerEvidenceDirectoryValidationSchemaVersion,
    boundary: `This validates submission structures and evidence file integrity only. It does not close evidence and does not waive ${strictCompletionCommand}.`,
    count: summaries.length,
    coverage,
    coverageJsonPath,
    coverageReportPath,
    note: 'This validates submission structures and evidence file integrity only. Strict completion remains authoritative.',
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    status: 'owner-evidence-directory-format-verified',
    strictCompletionCommand,
    summaries
  }
}

function printActions(queue, actionFilter = null, ownerFilter = null) {
  const ownerActions = filterActionsByOwner(validateActionQueue(queue), ownerFilter)
  const actions = actionFilter === null
    ? ownerActions
    : ownerActions.filter(action => getActionIdentifier(action) === actionFilter || action.closureKind === actionFilter)
  console.log(JSON.stringify({
    actions: actions.map(action => {
      const actionId = getActionIdentifier(action)
      return {
        ...buildActionCommandSet(action),
        actionId,
        closureKind: action.closureKind,
        currentEvidence: action.currentEvidence,
        owner: action.owner,
        recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
        requiredEvidence: action.requiredEvidence,
        sourceFiles: withSourceFileCommandSet(action.sourceFiles, action),
        strictCompletionCommand,
        verificationCommand: action.verificationCommand,
        verificationCommandNote: action.verificationCommandNote ?? ''
      }
    }),
    boundary: `Owner action list is an intake aid only. It does not close evidence and does not waive ${strictCompletionCommand}.`,
    count: actions.length,
    filter: actionFilter,
    ownerFilter,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    schemaVersion: ownerActionListSchemaVersion,
    strictCompletionCommand
  }, null, 2))
}

function countValues(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function countWeightedValues(rows, keySelector, weightSelector = () => 1) {
  const counts = {}
  for (const row of rows) {
    const key = keySelector(row)
    counts[key] = (counts[key] ?? 0) + weightSelector(row)
  }
  return counts
}

function withRecommendedStrictCompletionCommand(row) {
  return {
    ...row,
    recommendedStrictCompletionCommand: row.recommendedStrictCompletionCommand ?? shellPortableStrictCompletionCommand
  }
}

function getTaxonomyRowActionId(row) {
  const actionIds = getTaxonomyRowActionIds(row)
  return actionIds.length === 1 ? actionIds[0] : null
}

function getTaxonomyRowActionIds(row) {
  if (Array.isArray(row.ownerActionIds)) {
    return row.ownerActionIds
      .filter(actionId => typeof actionId === 'string' && actionId.trim().length > 0)
      .map(actionId => actionId.trim())
  }
  if (typeof row.ownerActionId === 'string' && row.ownerActionId.trim().length > 0) {
    return [row.ownerActionId.trim()]
  }
  return []
}

function getOwnerActionVerificationNote(actionId, actionsById) {
  const note = actionsById.get(actionId)?.verificationCommandNote
  return typeof note === 'string' && note.trim().length > 0 ? note : ''
}

function withOwnerActionCommands(row, actionsById = new Map()) {
  const decoratedRow = withRecommendedStrictCompletionCommand(row)
  const actionIds = getTaxonomyRowActionIds(decoratedRow)
  if (actionIds.length === 0) return decoratedRow
  const commandSets = actionIds.map(actionId => buildActionCommandSet(actionId))
  const singleActionCommands = actionIds.length === 1 ? commandSets[0] : null
  const expectedVerificationCommandNotes = actionIds.map(actionId => getOwnerActionVerificationNote(actionId, actionsById))
  const existingVerificationCommandNotes = Array.isArray(decoratedRow.verificationCommandNotes) && decoratedRow.verificationCommandNotes.length === actionIds.length
    ? decoratedRow.verificationCommandNotes
    : null
  const singleVerificationCommandNote = actionIds.length === 1 ? expectedVerificationCommandNotes[0] : null
  return {
    ...decoratedRow,
    actionDossierCommand: singleActionCommands === null
      ? decoratedRow.actionDossierCommand ?? null
      : decoratedRow.actionDossierCommand ?? singleActionCommands.actionDossierCommand,
    actionDossierCommands: Array.isArray(decoratedRow.actionDossierCommands) && decoratedRow.actionDossierCommands.length === actionIds.length
      ? decoratedRow.actionDossierCommands
      : commandSets.map(commandSet => commandSet.actionDossierCommand),
    rawEvidenceTemplateCommand: singleActionCommands === null
      ? decoratedRow.rawEvidenceTemplateCommand ?? null
      : decoratedRow.rawEvidenceTemplateCommand ?? singleActionCommands.rawEvidenceTemplateCommand,
    rawEvidenceTemplateCommands: Array.isArray(decoratedRow.rawEvidenceTemplateCommands) && decoratedRow.rawEvidenceTemplateCommands.length === actionIds.length
      ? decoratedRow.rawEvidenceTemplateCommands
      : commandSets.map(commandSet => commandSet.rawEvidenceTemplateCommand),
    submissionTemplateCommand: singleActionCommands === null
      ? decoratedRow.submissionTemplateCommand ?? null
      : decoratedRow.submissionTemplateCommand ?? singleActionCommands.submissionTemplateCommand,
    submissionTemplateCommands: Array.isArray(decoratedRow.submissionTemplateCommands) && decoratedRow.submissionTemplateCommands.length === actionIds.length
      ? decoratedRow.submissionTemplateCommands
      : commandSets.map(commandSet => commandSet.submissionTemplateCommand),
    verificationCommandNote: singleVerificationCommandNote === null
      ? decoratedRow.verificationCommandNote ?? null
      : decoratedRow.verificationCommandNote ?? singleVerificationCommandNote,
    verificationCommandNotes: existingVerificationCommandNotes ?? expectedVerificationCommandNotes
  }
}

function summarizeOwnerActions(queue, ownerFilter = null) {
  const actions = filterActionsByOwner(validateActionQueue(queue), ownerFilter)
  const grouped = new Map()
  for (const action of actions) {
    const owner = action.owner ?? 'unassigned'
    grouped.set(owner, [...(grouped.get(owner) ?? []), action])
  }
  const owners = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([owner, ownerActions]) => {
      const actionIds = ownerActions.map(action => getActionIdentifier(action)).sort((left, right) => left.localeCompare(right))
      const actionSummaries = ownerActions
        .map(action => {
          const actionId = getActionIdentifier(action)
          return {
            actionDossierCommand: `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${actionId}`,
            actionId,
            closureKind: action.closureKind,
            currentEvidence: action.currentEvidence,
            rawEvidenceTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${actionId}`,
            recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
            requiredEvidence: action.requiredEvidence,
            sourceFiles: withSourceFileCommandSet(action.sourceFiles, action),
            strictCompletionCommand,
            submissionTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-template --action ${actionId}`,
            verificationCommand: action.verificationCommand,
            verificationCommandNote: action.verificationCommandNote ?? ''
          }
        })
        .sort((left, right) => left.actionId.localeCompare(right.actionId))
      return {
        actionCount: ownerActions.length,
        actionIds,
        actions: actionSummaries,
        closureKindCounts: countValues(ownerActions.map(action => action.closureKind)),
        owner,
        verificationCommands: [...new Set(ownerActions.map(action => action.verificationCommand))].sort((left, right) => left.localeCompare(right))
      }
    })
  return {
    boundary: 'Owner summary is an intake planning aid only. Strict completion remains authoritative.',
    ownerCount: owners.length,
    ownerFilter,
    owners,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    schemaVersion: ownerSummarySchemaVersion,
    strictCompletionCommand,
    totalActionCount: actions.length
  }
}

function printOwnerSummary(queue, ownerFilter = null) {
  console.log(JSON.stringify(summarizeOwnerActions(queue, ownerFilter), null, 2))
}

function summarizeOwnerLaneCommands(queue, ownerFilter = null) {
  assertObject(queue, 'owner action queue')
  const expectedOwners = [...new Set(filterActionsByOwner(validateActionQueue(queue), ownerFilter).map(action => action.owner))]
    .sort((left, right) => left.localeCompare(right))
  const lanes = Array.isArray(queue.ownerLaneCommands) ? queue.ownerLaneCommands : []
  const selectedLanes = expectedOwners.map(owner => {
    const lane = lanes.find(row => row.owner === owner)
    assert(lane, `ownerLaneCommands missing lane for owner: ${owner}`)
    return lane
  })
  return {
    schemaVersion: ownerLaneCommandsSchemaVersion,
    boundary: `Owner lane commands are intake helpers only. They do not close evidence and do not waive ${strictCompletionCommand}. Use ${shellPortableStrictCompletionCommand} when foreground-watch opt-in must be injected inside the Node runner.`,
    laneCount: selectedLanes.length,
    lanes: selectedLanes.map(lane => ({
      ...lane,
      recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
      strictCompletionCommand
    })),
    ownerFilter,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    strictCompletionCommand
  }
}

function printOwnerLaneCommands(queue, ownerFilter = null) {
  console.log(JSON.stringify(summarizeOwnerLaneCommands(queue, ownerFilter), null, 2))
}

function buildExpectedNextOwnerCommands(queue) {
  assertObject(queue, 'owner action queue')
  const actions = validateActionQueue(queue)
  const ownerCounts = Object.keys(queue.ownerCounts ?? {}).length > 0
    ? queue.ownerCounts
    : countValues(actions.map(action => action.owner))
  const ownerLaneCommands = queue.ownerLaneCommands ?? []
  const lanesByOwner = new Map(ownerLaneCommands.map(lane => [lane.owner, lane]))
  const laneIndexByOwner = new Map(ownerLaneCommands.map((lane, index) => [lane.owner, index]))
  return Object.keys(ownerCounts)
    .sort((left, right) => left.localeCompare(right))
    .map(owner => {
      const lane = lanesByOwner.get(owner) ?? {}
      const laneIndex = laneIndexByOwner.get(owner)
      return {
        actionCount: ownerCounts[owner],
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
        sourceEvidencePath: laneIndex === undefined ? `${normalizeRelativeRepoPath(relative(repoRoot, ownerActionQueueJsonPath))}#/ownerCounts/${owner}` : `${normalizeRelativeRepoPath(relative(repoRoot, ownerActionQueueJsonPath))}#/ownerLaneCommands/${laneIndex}`,
        submissionTemplateDirectoryCommand: lane.submissionTemplateDirectoryCommand ?? `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner ${owner}`
      }
    })
}

function summarizeNextOwnerCommands(queue, completionStatus, ownerFilter = null) {
  assertObject(completionStatus, 'completion status')
  const expectedCommands = buildExpectedNextOwnerCommands(queue)
  const statusCommands = Array.isArray(completionStatus.nextOwnerCommands) ? completionStatus.nextOwnerCommands : []
  assert(JSON.stringify(statusCommands) === JSON.stringify(expectedCommands), 'completion status next owner commands mismatch')
  const selectedCommands = ownerFilter === null
    ? statusCommands
    : statusCommands.filter(row => row.owner === ownerFilter)
  if (ownerFilter !== null) assert(selectedCommands.length === 1, `next owner commands missing requested owner: ${ownerFilter}`)
  return {
    schemaVersion: nextOwnerCommandsQuerySchemaVersion,
    boundary: `Next owner commands are execution aids only. They do not close evidence and do not waive ${strictCompletionCommand}. Use ${shellPortableStrictCompletionCommand} when foreground-watch opt-in must be injected inside the Node runner.`,
    complete: completionStatus.complete === true,
    ownerCount: selectedCommands.length,
    ownerFilter,
    owners: selectedCommands,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    sourceEvidence: [
      '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-status.json',
      '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-owner-action-queue.json'
    ],
    status: completionStatus.acceptanceStatus,
    totalActionCount: selectedCommands.reduce((total, row) => total + row.actionCount, 0)
  }
}

function printNextOwnerCommands(queue, completionStatus, ownerFilter = null) {
  console.log(JSON.stringify(summarizeNextOwnerCommands(queue, completionStatus, ownerFilter), null, 2))
}

function taxonomyRowKey(row) {
  return `${row.requirementType}:${row.id}`
}

function validateClosureBundleTaxonomyRow(row, context) {
  assertObject(row, context)
  assertNonEmptyString(row.category, `${context} category`)
  assertNonEmptyString(row.id, `${context} id`)
  assert(Array.isArray(row.ownerActionIds), `${context} ownerActionIds must be an array`)
  assertNonEmptyString(row.requirementType, `${context} requirementType`)
  assertNonEmptyString(row.source, `${context} source`)
  assert(row.strictCompletionCommand === 'pnpm check:0503-strict', `${context} strictCompletionCommand mismatch`)
  assertNonEmptyString(row.verificationCommand, `${context} verificationCommand`)
  assert(Number.isInteger(row.weightedOpenRows) && row.weightedOpenRows >= 1, `${context} weightedOpenRows must be a positive integer`)
}

function validateOwnerClosureBundles(queue, closureBundles) {
  const actions = validateActionQueue(queue)
  assertObject(closureBundles, 'owner closure bundles')
  assert(closureBundles.schemaVersion === ownerClosureBundlesSchemaVersion, `owner closure bundles schemaVersion must be ${ownerClosureBundlesSchemaVersion}`)
  const owners = Array.isArray(closureBundles.owners) ? closureBundles.owners : []
  const expectedOwners = [...new Set(actions.map(action => action.owner))].sort((left, right) => left.localeCompare(right))
  assert(closureBundles.ownerCount === expectedOwners.length, `owner closure bundles ownerCount mismatch: expected ${expectedOwners.length}, got ${closureBundles.ownerCount}`)
  assert(closureBundles.totalActionCount === actions.length, `owner closure bundles totalActionCount mismatch: expected ${actions.length}, got ${closureBundles.totalActionCount}`)

  const actionById = new Map(actions.map(action => [getActionIdentifier(action), action]))
  const seenOwnerNames = new Set()
  const seenActionIds = new Set()

  for (const ownerBundle of owners) {
    assertObject(ownerBundle, 'owner closure bundle owner row')
    assertNonEmptyString(ownerBundle.owner, 'owner closure bundle owner')
    assert(!seenOwnerNames.has(ownerBundle.owner), `duplicate owner closure bundle owner: ${ownerBundle.owner}`)
    seenOwnerNames.add(ownerBundle.owner)
    assert(expectedOwners.includes(ownerBundle.owner), `owner closure bundle contains unexpected owner: ${ownerBundle.owner}`)
    assertNonEmptyString(ownerBundle.requireCompleteCommand, `owner closure bundle ${ownerBundle.owner} requireCompleteCommand`)
    assert(ownerBundle.requireCompleteCommand.includes(`--owner ${ownerBundle.owner}`), `owner closure bundle ${ownerBundle.owner} requireCompleteCommand must include owner filter`)
    assert(ownerBundle.requireCompleteCommand.includes('--require-complete'), `owner closure bundle ${ownerBundle.owner} requireCompleteCommand must require complete evidence coverage`)
    assertNonEmptyString(ownerBundle.summaryCommand, `owner closure bundle ${ownerBundle.owner} summaryCommand`)
    assertNonEmptyString(ownerBundle.readinessCommand, `owner closure bundle ${ownerBundle.owner} readinessCommand`)
    assert(ownerBundle.readinessCommand.includes(`--owner-readiness --owner ${ownerBundle.owner}`), `owner closure bundle ${ownerBundle.owner} readinessCommand must include owner readiness filter`)
    const bundleActions = Array.isArray(ownerBundle.actions) ? ownerBundle.actions : []
    const expectedOwnerActionCount = actions.filter(action => action.owner === ownerBundle.owner).length
    assert(ownerBundle.actionCount === expectedOwnerActionCount, `owner closure bundle ${ownerBundle.owner} actionCount mismatch: expected ${expectedOwnerActionCount}, got ${ownerBundle.actionCount}`)
    assert(bundleActions.length === ownerBundle.actionCount, `owner closure bundle ${ownerBundle.owner} action list length mismatch`)
    const actionTaxonomyRows = bundleActions.flatMap(action => Array.isArray(action.blockingTaxonomyRows) ? action.blockingTaxonomyRows : [])
    const ownerTaxonomyRows = Array.isArray(ownerBundle.blockingTaxonomyRows) && ownerBundle.blockingTaxonomyRows.length > 0
      ? ownerBundle.blockingTaxonomyRows
      : actionTaxonomyRows
    assert(ownerBundle.blockingTaxonomyRowCount === ownerTaxonomyRows.length, `owner closure bundle ${ownerBundle.owner} blockingTaxonomyRowCount mismatch`)
    const ownerWeightedOpenRows = ownerTaxonomyRows.reduce((sum, row) => sum + (Number.isInteger(row.weightedOpenRows) ? row.weightedOpenRows : 0), 0)
    assert(ownerBundle.weightedOpenRows === ownerWeightedOpenRows, `owner closure bundle ${ownerBundle.owner} weightedOpenRows mismatch`)
    assertObject(ownerBundle.categoryWeightedOpenRows ?? {}, `owner closure bundle ${ownerBundle.owner} categoryWeightedOpenRows`)
    for (const row of ownerTaxonomyRows) {
      validateClosureBundleTaxonomyRow(row, `owner closure bundle ${ownerBundle.owner} taxonomy row ${row.id ?? ''}`)
    }

    for (const action of bundleActions) {
      assertObject(action, `owner closure bundle ${ownerBundle.owner} action`)
      assertNonEmptyString(action.actionId, `owner closure bundle ${ownerBundle.owner} actionId`)
      assert(!seenActionIds.has(action.actionId), `duplicate owner closure bundle actionId: ${action.actionId}`)
      seenActionIds.add(action.actionId)
      const queuedAction = actionById.get(action.actionId)
      assert(queuedAction, `owner closure bundle action not found in queue: ${action.actionId}`)
      assert(queuedAction.owner === ownerBundle.owner, `owner closure bundle action ${action.actionId} owner mismatch: expected ${queuedAction.owner}, got ${ownerBundle.owner}`)
      assert(action.closureKind === queuedAction.closureKind, `owner closure bundle action ${action.actionId} closureKind mismatch`)
      assert(action.currentEvidence === queuedAction.currentEvidence, `owner closure bundle action ${action.actionId} currentEvidence mismatch`)
      assert(action.requiredEvidence === queuedAction.requiredEvidence, `owner closure bundle action ${action.actionId} requiredEvidence mismatch`)
      assert(action.unblockRule === queuedAction.unblockRule, `owner closure bundle action ${action.actionId} unblockRule mismatch`)
      assert(action.verificationCommand === queuedAction.verificationCommand, `owner closure bundle action ${action.actionId} verificationCommand mismatch`)
      assert(JSON.stringify(action.sourceFiles ?? null) === JSON.stringify(queuedAction.sourceFiles ?? null), `owner closure bundle action ${action.actionId} sourceFiles mismatch`)
      assertNonEmptyString(action.actionDossierCommand, `owner closure bundle action ${action.actionId} actionDossierCommand`)
      assert(action.actionDossierCommand.includes(`--action ${action.actionId}`), `owner closure bundle action ${action.actionId} dossier command must use the canonical actionId`)
      assertNonEmptyString(action.rawEvidenceTemplateCommand, `owner closure bundle action ${action.actionId} rawEvidenceTemplateCommand`)
      assert(action.rawEvidenceTemplateCommand.includes(`--action ${action.actionId}`), `owner closure bundle action ${action.actionId} raw evidence command must use the canonical actionId`)
      assertNonEmptyString(action.submissionTemplateCommand, `owner closure bundle action ${action.actionId} submissionTemplateCommand`)
      assert(action.submissionTemplateCommand.includes(`--action ${action.actionId}`), `owner closure bundle action ${action.actionId} submission command must use the canonical actionId`)
      for (const sourceFile of action.sourceFiles?.files ?? []) {
        assertNonEmptyString(sourceFile.sourceFileDossierCommand, `owner closure bundle action ${action.actionId} sourceFileDossierCommand`)
        assert(sourceFile.sourceFileDossierCommand.includes(`--source-file-dossier --action ${action.actionId} --file ${sourceFile.file}`), `owner closure bundle action ${action.actionId} source file dossier command must use the canonical actionId and file path`)
      }
      assert(action.strictCompletionCommand === 'pnpm check:0503-strict', `owner closure bundle action ${action.actionId} strictCompletionCommand mismatch`)
      const actionTaxonomyRows = Array.isArray(action.blockingTaxonomyRows) ? action.blockingTaxonomyRows : []
      assert(JSON.stringify(action.blockingTaxonomyRowIds ?? []) === JSON.stringify(actionTaxonomyRows.map(row => row.id)), `owner closure bundle action ${action.actionId} blocking taxonomy row ids mismatch`)
      for (const row of actionTaxonomyRows) {
        validateClosureBundleTaxonomyRow(row, `owner closure bundle action ${action.actionId} taxonomy row ${row.id ?? ''}`)
        assert(row.ownerActionId === action.actionId || row.ownerActionIds.includes(action.actionId), `owner closure bundle action ${action.actionId} taxonomy row ${row.id} must link back to the action`)
      }
    }
    const ownerTaxonomyKeys = new Set(ownerTaxonomyRows.map(row => taxonomyRowKey(row)))
    const actionTaxonomyKeys = new Set(bundleActions.flatMap(action => (action.blockingTaxonomyRows ?? []).map(row => taxonomyRowKey(row))))
    assert(JSON.stringify([...ownerTaxonomyKeys].sort()) === JSON.stringify([...actionTaxonomyKeys].sort()), `owner closure bundle ${ownerBundle.owner} taxonomy rows must match action taxonomy row union`)
  }

  const missingOwners = expectedOwners.filter(owner => !seenOwnerNames.has(owner))
  assert(missingOwners.length === 0, `owner closure bundles missing owners: ${missingOwners.join(', ')}`)
  const expectedActionIds = [...actionById.keys()].sort((left, right) => left.localeCompare(right))
  const actualActionIds = [...seenActionIds].sort((left, right) => left.localeCompare(right))
  assert(JSON.stringify(actualActionIds) === JSON.stringify(expectedActionIds), `owner closure bundle action coverage mismatch: expected ${expectedActionIds.join(',')}, got ${actualActionIds.join(',')}`)
  return owners
}

function summarizeOwnerClosureBundles(queue, closureBundles, ownerFilter = null) {
  const actions = validateActionQueue(queue)
  const actionsById = new Map(actions.map(action => [getActionIdentifier(action), action]))
  const owners = validateOwnerClosureBundles(queue, closureBundles)
  const selectedOwners = ownerFilter === null
    ? owners
    : owners.filter(ownerBundle => ownerBundle.owner === ownerFilter)
  if (ownerFilter !== null) assert(selectedOwners.length === 1, `owner closure bundles missing requested owner: ${ownerFilter}`)
  const decoratedOwners = selectedOwners.map(ownerBundle => ({
    ...ownerBundle,
    actions: (ownerBundle.actions ?? []).map(action => ({
      ...action,
      blockingTaxonomyRows: (action.blockingTaxonomyRows ?? []).map(row => withOwnerActionCommands(row, actionsById))
    })),
    blockingTaxonomyRows: (ownerBundle.blockingTaxonomyRows ?? []).map(row => withOwnerActionCommands(row, actionsById))
  }))
  return {
    schemaVersion: ownerClosureBundlesQuerySchemaVersion,
    acceptanceStatus: closureBundles.acceptanceStatus,
    boundary: 'Owner closure bundles are execution aids only. They do not close evidence, do not replace owner submissions, and do not waive pnpm check:0503-strict.',
    ownerCount: decoratedOwners.length,
    ownerFilter,
    owners: decoratedOwners,
    sourceEvidence: closureBundles.sourceEvidence,
    status: closureBundles.status,
    totalActionCount: decoratedOwners.reduce((total, ownerBundle) => total + ownerBundle.actionCount, 0)
  }
}

function printOwnerClosureBundles(queue, closureBundles, ownerFilter = null) {
  console.log(JSON.stringify(summarizeOwnerClosureBundles(queue, closureBundles, ownerFilter), null, 2))
}

function validateBlockerTaxonomy(audit) {
  assertObject(audit, 'completion audit')
  assertObject(audit.blockerTaxonomy, 'completion audit blockerTaxonomy')
  const taxonomy = audit.blockerTaxonomy
  const rows = Array.isArray(taxonomy.rows) ? taxonomy.rows : []
  assert(Number.isInteger(taxonomy.totalTaxonomyRows), 'blocker taxonomy totalTaxonomyRows must be an integer')
  assert(Number.isInteger(taxonomy.totalWeightedOpenRows), 'blocker taxonomy totalWeightedOpenRows must be an integer')
  assert(taxonomy.totalTaxonomyRows === rows.length, `blocker taxonomy totalTaxonomyRows mismatch: expected ${rows.length}, got ${taxonomy.totalTaxonomyRows}`)
  const weightedTotal = rows.reduce((sum, row) => sum + (Number.isInteger(row.weightedOpenRows) ? row.weightedOpenRows : 0), 0)
  assert(taxonomy.totalWeightedOpenRows === weightedTotal, `blocker taxonomy totalWeightedOpenRows mismatch: expected ${weightedTotal}, got ${taxonomy.totalWeightedOpenRows}`)
  for (const row of rows) {
    assertNonEmptyString(row.category, 'blocker taxonomy row category')
    assertNonEmptyString(row.id, 'blocker taxonomy row id')
    assertNonEmptyString(row.owner, 'blocker taxonomy row owner')
    assertNonEmptyString(row.requirementType, 'blocker taxonomy row requirementType')
    assertNonEmptyString(row.source, 'blocker taxonomy row source')
    assertNonEmptyString(row.strictCompletionCommand, 'blocker taxonomy row strictCompletionCommand')
    assert(row.strictCompletionCommand === 'pnpm check:0503-strict', `blocker taxonomy row ${row.id} strict command mismatch`)
    assertNonEmptyString(row.verificationCommand, 'blocker taxonomy row verificationCommand')
    assert(Number.isInteger(row.weightedOpenRows) && row.weightedOpenRows >= 1, `blocker taxonomy row ${row.id} weightedOpenRows must be a positive integer`)
  }
  return rows
}

function summarizeBlockerTaxonomy(queue, audit, ownerFilter = null) {
  const actions = validateActionQueue(queue)
  const actionsById = new Map(actions.map(action => [getActionIdentifier(action), action]))
  const actionOwnerById = new Map(actions.map(action => [getActionIdentifier(action), action.owner]))
  const rows = validateBlockerTaxonomy(audit)
  const selectedRows = ownerFilter === null
    ? rows
    : rows.filter(row => row.owner === ownerFilter || getTaxonomyRowActionIds(row).some(actionId => actionOwnerById.get(actionId) === ownerFilter))
  if (ownerFilter !== null) assert(selectedRows.length > 0, `blocker taxonomy has no rows for owner: ${ownerFilter}`)
  const decoratedRows = selectedRows.map(row => withOwnerActionCommands(row, actionsById))
  return {
    schemaVersion: blockerTaxonomyQuerySchemaVersion,
    boundary: 'Blocker taxonomy is a diagnostic execution aid only. It does not close evidence and does not waive pnpm check:0503-strict.',
    categoryCounts: countValues(decoratedRows.map(row => row.category)),
    categoryWeightedOpenRows: countWeightedValues(decoratedRows, row => row.category, row => row.weightedOpenRows),
    ownerFilter,
    ownerCounts: countValues(decoratedRows.map(row => row.owner)),
    ownerWeightedOpenRows: countWeightedValues(decoratedRows, row => row.owner, row => row.weightedOpenRows),
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    rows: decoratedRows,
    sourceEvidence: ['.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-audit.json'],
    strictCompletionCommand,
    totalTaxonomyRows: decoratedRows.length,
    totalWeightedOpenRows: decoratedRows.reduce((sum, row) => sum + row.weightedOpenRows, 0)
  }
}

function printBlockerTaxonomy(queue, audit, ownerFilter = null) {
  console.log(JSON.stringify(summarizeBlockerTaxonomy(queue, audit, ownerFilter), null, 2))
}

function validatePartialR8Dossier(audit) {
  assertObject(audit, 'completion audit')
  const rows = Array.isArray(audit.partialR8Dossier) ? audit.partialR8Dossier : []
  for (const row of rows) {
    assertNonEmptyString(row.file, 'partial R8 dossier row file')
    assert(Array.isArray(row.ownerActionIds), `partial R8 dossier ${row.file} ownerActionIds must be an array`)
    assert(Array.isArray(row.ownerActionDossierCommands), `partial R8 dossier ${row.file} ownerActionDossierCommands must be an array`)
    assert(Array.isArray(row.ownerActionVerificationCommands), `partial R8 dossier ${row.file} ownerActionVerificationCommands must be an array`)
    assertNonEmptyString(row.sourceEvidencePath, `partial R8 dossier ${row.file} sourceEvidencePath`)
    assert(row.status === 'partial', `partial R8 dossier ${row.file} status must remain partial until real evidence closes it`)
    assertNonEmptyString(row.strictCompletionCommand, `partial R8 dossier ${row.file} strictCompletionCommand`)
    assert(row.strictCompletionCommand === 'pnpm check:0503-strict', `partial R8 dossier ${row.file} strict command mismatch`)
    assertNonEmptyString(row.verificationCommand, `partial R8 dossier ${row.file} verificationCommand`)
  }
  return rows
}

function summarizePartialR8Dossier(queue, audit, ownerFilter = null, fileFilter = null) {
  const actions = validateActionQueue(queue)
  const actionById = new Map(actions.map(action => [getActionIdentifier(action), action]))
  const rows = validatePartialR8Dossier(audit)
  const normalizedFileFilter = fileFilter === null ? null : normalizePartialR8FileFilter(fileFilter)
  const enrichedRows = rows.map(row => {
    const linkedOwnerActions = row.ownerActionIds
      .map(actionId => actionById.get(actionId))
      .filter(action => action !== undefined)
      .map(action => ({
        actionDossierCommand: `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ${getActionIdentifier(action)}`,
        actionId: getActionIdentifier(action),
        closureKind: action.closureKind,
        currentEvidence: action.currentEvidence,
        owner: action.owner,
        rawEvidenceTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ${getActionIdentifier(action)}`,
        recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
        requiredEvidence: action.requiredEvidence,
        strictCompletionCommand,
        submissionTemplateCommand: `pnpm --silent check:0503-owner-evidence -- --print-template --action ${getActionIdentifier(action)}`,
        verificationCommand: action.verificationCommand,
        verificationCommandNote: action.verificationCommandNote ?? ''
      }))
    const owners = [...new Set(linkedOwnerActions.map(action => action.owner))]
      .sort((left, right) => left.localeCompare(right))
    const singleLinkedOwnerAction = linkedOwnerActions.length === 1 ? linkedOwnerActions[0] : null
    const verificationCommandNotes = linkedOwnerActions.map(action => action.verificationCommandNote ?? '')
    return {
      actionDossierCommand: singleLinkedOwnerAction?.actionDossierCommand ?? null,
      actionDossierCommands: linkedOwnerActions.map(action => action.actionDossierCommand),
      file: row.file,
      linkedOwnerActions,
      nextAction: row.nextAction ?? '',
      ownerActionDossierCommands: row.ownerActionDossierCommands,
      ownerActionIds: row.ownerActionIds,
      ownerActionVerificationCommands: row.ownerActionVerificationCommands,
      rawEvidenceTemplateCommand: singleLinkedOwnerAction?.rawEvidenceTemplateCommand ?? null,
      rawEvidenceTemplateCommands: linkedOwnerActions.map(action => action.rawEvidenceTemplateCommand),
      ownerRawEvidenceTemplateCommands: linkedOwnerActions.map(action => action.rawEvidenceTemplateCommand),
      ownerReadinessCommands: owners.map(owner => `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`),
      ownerReadinessWithEvidenceDirCommands: owners.map(owner => `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir>`),
      submissionTemplateCommand: singleLinkedOwnerAction?.submissionTemplateCommand ?? null,
      submissionTemplateCommands: linkedOwnerActions.map(action => action.submissionTemplateCommand),
      ownerSubmissionTemplateCommands: linkedOwnerActions.map(action => action.submissionTemplateCommand),
      owners,
      partialR8FileDossierCommand: `pnpm check:0503-owner-evidence -- --partial-r8-dossier --file ${row.file}`,
      partialR8OwnerFileDossierCommands: owners.map(owner => `pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner ${owner} --file ${row.file}`),
      recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
      sourceEvidencePath: row.sourceEvidencePath,
      status: row.status,
      strictCompletionCommand: row.strictCompletionCommand,
      verificationCommand: row.verificationCommand,
      verificationCommandNote: singleLinkedOwnerAction?.verificationCommandNote ?? null,
      verificationCommandNotes
    }
  })
  const selectedRows = ownerFilter === null
    ? enrichedRows
    : enrichedRows.filter(row => row.owners.includes(ownerFilter))
  const selectedRowsByFile = normalizedFileFilter === null
    ? selectedRows
    : selectedRows.filter(row => row.file === normalizedFileFilter)
  if (normalizedFileFilter !== null && selectedRows.length > 0) assert(selectedRowsByFile.length > 0, `partial R8 dossier has no row for file: ${normalizedFileFilter}`)
  return {
    schemaVersion: partialR8DossierQuerySchemaVersion,
    boundary: 'Partial R8 dossier is a diagnostic map only. It does not close partial rows, does not replace owner evidence submissions, and does not waive pnpm check:0503-strict.',
    fileFilter: normalizedFileFilter,
    ownerFilter,
    rowCount: selectedRowsByFile.length,
    rows: selectedRowsByFile,
    sourceEvidence: [
      '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-audit.json',
      '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-owner-action-queue.json'
    ],
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    status: selectedRowsByFile.length === 0 ? 'no-partial-r8-rows' : 'partial-r8-rows-open',
    strictCompletionCommand,
    totalLinkedOwnerActions: selectedRowsByFile.reduce((sum, row) => sum + row.linkedOwnerActions.length, 0)
  }
}

function printPartialR8Dossier(queue, audit, ownerFilter = null, fileFilter = null) {
  console.log(JSON.stringify(summarizePartialR8Dossier(queue, audit, ownerFilter, fileFilter), null, 2))
}

function summarizeOwnerReadiness(queue, completionStatus, closureBundles, audit, ownerFilter = null, evidenceCoverage = null, coverageArtifacts = {}) {
  assertObject(completionStatus, 'completion status')
  if (evidenceCoverage !== null) assertObject(evidenceCoverage, 'owner readiness evidence coverage')
  const actions = validateActionQueue(queue)
  const actionsById = new Map(actions.map(action => [getActionIdentifier(action), action]))
  const actionOwnerById = new Map(actions.map(action => [getActionIdentifier(action), action.owner]))
  const taxonomyRows = validateBlockerTaxonomy(audit)
  const ownerSummary = summarizeOwnerActions(queue, ownerFilter)
  const laneCommands = summarizeOwnerLaneCommands(queue, ownerFilter)
  const nextOwnerCommands = summarizeNextOwnerCommands(queue, completionStatus, ownerFilter)
  const closureSummary = summarizeOwnerClosureBundles(queue, closureBundles, ownerFilter)
  const selectedOwners = ownerSummary.owners.map(ownerRow => {
    const owner = ownerRow.owner
    const lane = laneCommands.lanes.find(row => row.owner === owner)
    const nextCommands = nextOwnerCommands.owners.find(row => row.owner === owner)
    const closureBundle = closureSummary.owners.find(row => row.owner === owner)
    assert(lane, `owner readiness missing lane commands for owner: ${owner}`)
    assert(nextCommands, `owner readiness missing next owner commands for owner: ${owner}`)
    assert(closureBundle, `owner readiness missing closure bundle for owner: ${owner}`)
    const ownerTaxonomyRows = taxonomyRows.filter(row => row.owner === owner || getTaxonomyRowActionIds(row).some(actionId => actionOwnerById.get(actionId) === owner))
    const weightedOpenRows = ownerTaxonomyRows.reduce((sum, row) => sum + row.weightedOpenRows, 0)
    const ownerCoverage = evidenceCoverage === null
      ? null
      : {
          complete: !(evidenceCoverage.missingByOwner?.[owner]?.length > 0),
          missingActionIds: evidenceCoverage.missingByOwner?.[owner] ?? [],
          submittedActionCount: evidenceCoverage.submittedByOwner?.[owner]?.length ?? 0,
          submittedActionIds: evidenceCoverage.submittedByOwner?.[owner] ?? [],
          totalActionCount: ownerRow.actionCount,
          validationError: evidenceCoverage.validationError ?? null,
          validationStatus: evidenceCoverage.validationStatus ?? null
        }
    const submittedActionIds = new Set(ownerCoverage?.submittedActionIds ?? [])
    const missingActionIds = new Set(ownerCoverage?.missingActionIds ?? [])
    const blockingActions = ownerRow.actions.map(action => ({
      actionDossierCommand: action.actionDossierCommand,
      actionId: action.actionId,
      closureKind: action.closureKind,
      currentEvidence: action.currentEvidence,
      evidenceCoverageStatus: evidenceCoverage === null
        ? 'not-evaluated'
        : submittedActionIds.has(action.actionId)
          ? 'submitted'
          : missingActionIds.has(action.actionId)
            ? 'missing'
            : 'not-required-for-owner-filter',
      recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
      rawEvidenceTemplateCommand: action.rawEvidenceTemplateCommand,
      requiredEvidence: action.requiredEvidence,
      sourceFiles: withSourceFileCommandSet(action.sourceFiles, action),
      strictCompletionCommand: 'pnpm check:0503-strict',
      submissionTemplateCommand: action.submissionTemplateCommand,
      verificationCommand: action.verificationCommand,
      verificationCommandNote: action.verificationCommandNote ?? ''
    }))
    const blockingTaxonomyRows = ownerTaxonomyRows.map(row => {
      const decoratedRow = withOwnerActionCommands(row, actionsById)
      return {
        actionDossierCommand: decoratedRow.actionDossierCommand,
        actionDossierCommands: decoratedRow.actionDossierCommands,
        category: decoratedRow.category,
        currentEvidence: decoratedRow.currentEvidence ?? '',
        id: decoratedRow.id,
        owner: decoratedRow.owner,
        ownerActionId: decoratedRow.ownerActionId ?? null,
        ownerActionIds: decoratedRow.ownerActionIds ?? [],
        requirementType: decoratedRow.requirementType,
        recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
        rawEvidenceTemplateCommand: decoratedRow.rawEvidenceTemplateCommand,
        rawEvidenceTemplateCommands: decoratedRow.rawEvidenceTemplateCommands,
        source: decoratedRow.source,
        strictCompletionCommand: decoratedRow.strictCompletionCommand,
        submissionTemplateCommand: decoratedRow.submissionTemplateCommand,
        submissionTemplateCommands: decoratedRow.submissionTemplateCommands,
        verificationCommand: decoratedRow.verificationCommand,
        verificationCommandNote: decoratedRow.verificationCommandNote,
        verificationCommandNotes: decoratedRow.verificationCommandNotes,
        weightedOpenRows: decoratedRow.weightedOpenRows
      }
    })
    return {
      actionCount: ownerRow.actionCount,
      actionIds: ownerRow.actionIds,
      blockingActions,
      blockingTaxonomyRows,
      categoryWeightedOpenRows: countWeightedValues(ownerTaxonomyRows, row => row.category, row => row.weightedOpenRows),
      closureKindCounts: ownerRow.closureKindCounts,
      commands: {
        blockerTaxonomyCommand: nextCommands.blockerTaxonomyCommand,
        closureBundleCommand: nextCommands.closureBundleCommand,
        coverageJsonCommand: lane.coverageJsonCommand,
        coverageReportCommand: lane.coverageReportCommand,
        listActionsCommand: nextCommands.listActionsCommand,
        nextEvidenceDirectoryCommand: nextCommands.ownerReadinessWithEvidenceDirCommand,
        nextOwnerCommandsCommand: `pnpm check:0503-owner-evidence -- --next-owner-commands --owner ${owner}`,
        ownerLaneCommandsCommand: `pnpm check:0503-owner-evidence -- --owner-lane-commands --owner ${owner}`,
        ownerReadinessWithCoverageArtifactsCommand: lane.ownerReadinessWithCoverageArtifactsCommand ?? `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner} --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md> --coverage-json <repo-relative-report.json>`,
        ownerReadinessWithEvidenceDirCommand: nextCommands.ownerReadinessWithEvidenceDirCommand,
        ownerReadinessCommand: `pnpm check:0503-owner-evidence -- --owner-readiness --owner ${owner}`,
        ownerSummaryCommand: nextCommands.ownerSummaryCommand,
        partialR8DossierCommand: nextCommands.partialR8DossierCommand,
        rawEvidenceTemplateDirectoryCommand: lane.rawEvidenceTemplateDirectoryCommand,
        recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
        requireCompleteCommand: nextCommands.requireCompleteCommand,
        submissionTemplateDirectoryCommand: nextCommands.submissionTemplateDirectoryCommand
      },
      evidenceCoverage: ownerCoverage,
      evidenceCoverageEvaluated: evidenceCoverage !== null,
      evidenceCoverageNote: evidenceCoverage === null
        ? 'No evidence directory is evaluated by owner readiness. Use nextEvidenceDirectoryCommand against real owner submissions before requireCompleteCommand and strict completion.'
        : evidenceCoverage.validationStatus === 'invalid-evidence-directory'
          ? 'Evidence directory was rejected by the owner evidence verifier. Replace templateOnly or invalid files with real owner submissions before strict completion.'
        : 'Evidence directory coverage was evaluated with the owner evidence verifier. Strict completion is still required.',
      owner,
      readinessStatus: ownerRow.actionCount === 0
        ? 'no-open-owner-actions'
        : ownerCoverage?.complete === true
          ? 'owner-evidence-covered-strict-still-required'
          : 'blocked-by-required-evidence',
      taxonomyRowCount: ownerTaxonomyRows.length,
      weightedOpenRows
    }
  })
  const topLevelBlockingActions = selectedOwners.flatMap(ownerRow =>
    ownerRow.blockingActions.map(action => ({
      owner: ownerRow.owner,
      ...action
    }))
  )
  const topLevelBlockingTaxonomyRows = selectedOwners.flatMap(ownerRow => ownerRow.blockingTaxonomyRows)
  return {
    schemaVersion: ownerReadinessSchemaVersion,
    acceptanceStatus: completionStatus.acceptanceStatus,
    boundary: `Owner readiness is a diagnostic execution aid only. It does not close evidence and does not waive ${strictCompletionCommand}. Use ${shellPortableStrictCompletionCommand} when foreground-watch opt-in must be injected inside the Node runner. When an evidence directory is supplied, it only reports owner evidence coverage.`,
    actionIds: selectedOwners.flatMap(owner => owner.actionIds),
    blockingActionCount: topLevelBlockingActions.length,
    blockingActions: topLevelBlockingActions,
    blockingTaxonomyRowCount: topLevelBlockingTaxonomyRows.length,
    blockingTaxonomyRows: topLevelBlockingTaxonomyRows,
    coverageArtifacts,
    evidenceCoverage,
    evidenceCoverageEvaluated: evidenceCoverage !== null,
    complete: completionStatus.complete === true,
    ownerCount: selectedOwners.length,
    ownerFilter,
    owners: selectedOwners,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    sourceEvidence: [
      '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-owner-action-queue.json',
      '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-owner-closure-bundles.json',
      '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-audit.json',
      '.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-status.json'
    ],
    status: completionStatus.acceptanceStatus,
    strictCompletionCommand,
    totalActionCount: selectedOwners.reduce((sum, owner) => sum + owner.actionCount, 0),
    totalTaxonomyRows: selectedOwners.reduce((sum, owner) => sum + owner.taxonomyRowCount, 0),
    totalWeightedOpenRows: selectedOwners.reduce((sum, owner) => sum + owner.weightedOpenRows, 0)
  }
}

function printOwnerReadiness(queue, completionStatus, closureBundles, audit, ownerFilter = null, evidenceCoverage = null, coverageArtifacts = {}) {
  console.log(JSON.stringify(summarizeOwnerReadiness(queue, completionStatus, closureBundles, audit, ownerFilter, evidenceCoverage, coverageArtifacts), null, 2))
}

function visitObjectTree(value, path, visitor) {
  if (value === null || typeof value !== 'object') return
  visitor(value, path)
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitObjectTree(item, `${path}[${index}]`, visitor))
    return
  }
  for (const [key, child] of Object.entries(value)) {
    visitObjectTree(child, `${path}.${key}`, visitor)
  }
}

function isOwnerEvidenceCommand(value) {
  return typeof value === 'string' && value.includes('check:0503-owner-evidence')
}

function addOwnerOutputCommandGaps(gaps, context, objectPath, ownerActionIds) {
  for (const [arrayKey, singleKey] of [
    ['actionDossierCommands', 'actionDossierCommand'],
    ['rawEvidenceTemplateCommands', 'rawEvidenceTemplateCommand'],
    ['submissionTemplateCommands', 'submissionTemplateCommand']
  ]) {
    const arrayValue = context.value[arrayKey]
    if (!Array.isArray(arrayValue) || arrayValue.length !== ownerActionIds.length || arrayValue.some(command => !isOwnerEvidenceCommand(command))) {
      gaps.push({
        ...context.label,
        ids: ownerActionIds,
        missing: arrayKey,
        path: objectPath
      })
    }
    const singleValue = context.value[singleKey]
    if (ownerActionIds.length === 1 && !isOwnerEvidenceCommand(singleValue)) {
      gaps.push({
        ...context.label,
        ids: ownerActionIds,
        missing: singleKey,
        path: objectPath
      })
    }
  }
}

function summarizeOwnerOutputMatrix(queue, completionStatus, closureBundles, audit, ownerFilter = null) {
  const actions = validateActionQueue(queue)
  const actionsById = new Map(actions.map(action => [getActionIdentifier(action), action]))
  const owners = [...new Set(filterActionsByOwner(actions, ownerFilter).map(action => action.owner))]
    .sort((left, right) => left.localeCompare(right))
  const ownerActionCounts = new Map(owners.map(owner => [owner, filterActionsByOwner(actions, owner).length]))
  const noteRequiredModes = new Set(['owner-closure-bundles', 'owner-readiness', 'owner-summary'])
  const modes = [
    {
      name: 'blocker-taxonomy',
      summarize: owner => summarizeBlockerTaxonomy(queue, audit, owner)
    },
    {
      name: 'owner-readiness',
      summarize: owner => summarizeOwnerReadiness(queue, completionStatus, closureBundles, audit, owner)
    },
    {
      name: 'owner-summary',
      summarize: owner => summarizeOwnerActions(queue, owner)
    },
    {
      name: 'owner-closure-bundles',
      summarize: owner => summarizeOwnerClosureBundles(queue, closureBundles, owner)
    },
    {
      name: 'partial-r8-dossier',
      summarize: owner => summarizePartialR8Dossier(queue, audit, owner)
    }
  ]
  const gaps = []
  const results = []
  for (const owner of owners) {
    for (const mode of modes) {
      const payload = mode.summarize(owner)
      let checkedObjectCount = 0
      let checkedVerificationNoteCount = 0
      const requiredVerificationNoteCount = noteRequiredModes.has(mode.name) ? ownerActionCounts.get(owner) ?? 0 : 0
      visitObjectTree(payload, '$', (value, path) => {
        const ownerActionIds = Array.isArray(value.ownerActionIds)
          ? value.ownerActionIds
          : typeof value.ownerActionId === 'string'
            ? [value.ownerActionId]
            : null
        if (Array.isArray(ownerActionIds) && ownerActionIds.length > 0) {
          checkedObjectCount += 1
          addOwnerOutputCommandGaps(gaps, {
            label: { mode: mode.name, owner },
            value
          }, path, ownerActionIds)
          const expectedVerificationCommandNotes = ownerActionIds.map(actionId => getOwnerActionVerificationNote(actionId, actionsById))
          if (expectedVerificationCommandNotes.some(note => note.length > 0)) {
            checkedVerificationNoteCount += expectedVerificationCommandNotes.filter(note => note.length > 0).length
            const notes = Array.isArray(value.verificationCommandNotes) ? value.verificationCommandNotes : []
            if (notes.length !== expectedVerificationCommandNotes.length || notes.some((note, index) => note !== expectedVerificationCommandNotes[index])) {
              gaps.push({
                mode: mode.name,
                missing: 'verificationCommandNotes',
                owner,
                path,
                value: Array.isArray(value.verificationCommandNotes) ? value.verificationCommandNotes : null
              })
            }
            if (ownerActionIds.length === 1 && value.verificationCommandNote !== expectedVerificationCommandNotes[0]) {
              gaps.push({
                mode: mode.name,
                missing: 'verificationCommandNote',
                owner,
                path,
                value: value.verificationCommandNote ?? null
              })
            }
          }
          if (value.recommendedStrictCompletionCommand !== shellPortableStrictCompletionCommand) {
            gaps.push({
              mode: mode.name,
              missing: 'recommendedStrictCompletionCommand',
              owner,
              path,
              value: value.recommendedStrictCompletionCommand
            })
          }
        }
        for (const collectionKey of ['actions', 'blockingActions', 'linkedOwnerActions']) {
          if (!Array.isArray(value[collectionKey])) continue
          value[collectionKey].forEach((action, index) => {
            const actionId = action.actionId ?? action.id ?? null
            for (const commandKey of ['actionDossierCommand', 'rawEvidenceTemplateCommand', 'submissionTemplateCommand']) {
              if (!isOwnerEvidenceCommand(action[commandKey])) {
                gaps.push({
                  action: actionId,
                  mode: mode.name,
                  missing: commandKey,
                  owner,
                  path: `${path}.${collectionKey}[${index}]`
                })
              }
            }
            const expectedVerificationCommandNote = typeof actionId === 'string'
              ? actionsById.get(actionId)?.verificationCommandNote ?? ''
              : ''
            if (expectedVerificationCommandNote) {
              checkedVerificationNoteCount += 1
              if (action.verificationCommandNote !== expectedVerificationCommandNote) {
                gaps.push({
                  action: actionId,
                  mode: mode.name,
                  missing: 'verificationCommandNote',
                  owner,
                  path: `${path}.${collectionKey}[${index}]`,
                  value: action.verificationCommandNote ?? null
                })
              }
            }
            if (action.recommendedStrictCompletionCommand !== shellPortableStrictCompletionCommand) {
              gaps.push({
                action: actionId,
                mode: mode.name,
                missing: 'recommendedStrictCompletionCommand',
                owner,
                path: `${path}.${collectionKey}[${index}]`,
                value: action.recommendedStrictCompletionCommand
              })
            }
          })
        }
        if (Array.isArray(value.sourceFiles?.files)) {
          value.sourceFiles.files.forEach((sourceFile, index) => {
            for (const commandKey of ['sourceFileDossierCommand', 'actionDossierCommand', 'rawEvidenceTemplateCommand', 'submissionTemplateCommand']) {
              if (!isOwnerEvidenceCommand(sourceFile[commandKey])) {
                gaps.push({
                  file: sourceFile.file ?? null,
                  mode: mode.name,
                  missing: commandKey,
                  owner,
                  path: `${path}.sourceFiles.files[${index}]`
                })
              }
            }
          })
        }
      })
      if (checkedVerificationNoteCount < requiredVerificationNoteCount) {
        gaps.push({
          checkedVerificationNoteCount,
          mode: mode.name,
          missing: 'verificationCommandNoteCoverage',
          owner,
          requiredVerificationNoteCount
        })
      }
      results.push({
        checkedObjectCount,
        checkedVerificationNoteCount,
        mode: mode.name,
        requiredVerificationNoteCount,
        owner,
        rowCount: payload.rowCount ?? payload.ownerCount ?? payload.totalTaxonomyRows ?? payload.totalActionCount ?? null,
        status: payload.status ?? payload.acceptanceStatus ?? null
      })
    }
  }
  return {
    schemaVersion: ownerOutputMatrixSchemaVersion,
    boundary: 'Owner output matrix is a verifier for command discoverability only. It does not close owner evidence and does not waive strict completion.',
    gapCount: gaps.length,
    gaps,
    ok: gaps.length === 0,
    ownerCount: owners.length,
    ownerFilter,
    owners,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    results,
    strictCompletionCommand
  }
}

function printOwnerOutputMatrix(queue, completionStatus, closureBundles, audit, ownerFilter = null) {
  const matrix = summarizeOwnerOutputMatrix(queue, completionStatus, closureBundles, audit, ownerFilter)
  console.log(JSON.stringify(matrix, null, 2))
  assert(matrix.ok, `owner output matrix has ${matrix.gapCount} command gap(s)`)
}

function buildOwnerActionDossier(queue, actionFilter) {
  const action = findActionForTemplate(queue, actionFilter)
  const actionId = getActionIdentifier(action)
  const actionCommands = buildActionCommandSet(action)
  const ownerLane = summarizeOwnerLaneCommands(queue, action.owner).lanes[0]
  return {
    schemaVersion: ownerActionDossierSchemaVersion,
    ...actionCommands,
    boundary: 'This dossier is an intake helper only. Strict completion remains authoritative.',
    action: {
      ...actionCommands,
      actionId,
      actionType: action.actionType ?? 'external-gate',
      closureKind: action.closureKind,
      currentEvidence: action.currentEvidence,
      owner: action.owner,
      prerequisite: action.prerequisite ?? null,
      recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
      requiredEvidence: action.requiredEvidence,
      source: action.source ?? null,
      sourceFiles: withSourceFileCommandSet(action.sourceFiles, action),
      strictCompletionCommand,
      unblockRule: action.unblockRule,
      verificationCommand: action.verificationCommand,
      verificationCommandNote: action.verificationCommandNote ?? ''
    },
    ownerLaneCommands: ownerLane,
    rawEvidenceTemplate: buildRawEvidenceTemplate(action),
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    strictCompletionCommand,
    submissionTemplate: buildSubmissionTemplate(action)
  }
}

function printOwnerActionDossier(queue, actionFilter) {
  console.log(JSON.stringify(buildOwnerActionDossier(queue, actionFilter), null, 2))
}

function actionMatchesFilter(action, actionFilter) {
  if (actionFilter === null) return true
  const actionId = getActionIdentifier(action)
  return actionId === actionFilter || action.closureKind === actionFilter
}

function buildSourceFileDossier(queue, fileFilter, actionFilter = null, ownerFilter = null) {
  assertNonEmptyString(fileFilter, 'argument --file for --source-file-dossier')
  const normalizedFileFilter = normalizeRelativeRepoPath(fileFilter)
  const actions = validateActionQueue(queue)
  const rows = []
  actions.forEach((action, actionIndex) => {
    if (ownerFilter !== null && action.owner !== ownerFilter) return
    if (!actionMatchesFilter(action, actionFilter)) return
    const actionId = getActionIdentifier(action)
    const sourceFiles = withSourceFileCommandSet(action.sourceFiles, action)
    const files = Array.isArray(sourceFiles?.files) ? sourceFiles.files : []
    files.forEach((sourceFile, sourceFileIndex) => {
      if (normalizeRelativeRepoPath(sourceFile.file) !== normalizedFileFilter) return
      rows.push({
        actionDossierCommand: sourceFile.actionDossierCommand,
        actionId,
        actionType: action.actionType ?? 'checkbox-closure-class',
        closureKind: action.closureKind,
        count: sourceFile.count,
        currentEvidence: action.currentEvidence,
        file: sourceFile.file,
        owner: action.owner,
        rawEvidenceTemplateCommand: sourceFile.rawEvidenceTemplateCommand,
        recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
        requiredEvidence: action.requiredEvidence,
        sourceEvidencePath: `${normalizeRelativeRepoPath(relative(repoRoot, ownerActionQueueJsonPath))}#/actions/${actionIndex}/sourceFiles/files/${sourceFileIndex}`,
        sourceFileDossierCommand: sourceFile.sourceFileDossierCommand,
        strictCompletionCommand,
        submissionTemplateCommand: sourceFile.submissionTemplateCommand,
        unblockRule: action.unblockRule,
        verificationCommand: action.verificationCommand,
        verificationCommandNote: action.verificationCommandNote ?? ''
      })
    })
  })
  return {
    schemaVersion: sourceFileDossierQuerySchemaVersion,
    actionFilter,
    boundary: 'Source file dossier output is an intake helper only. It does not close evidence and does not waive strict completion.',
    file: normalizedFileFilter,
    ownerFilter,
    recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
    rowCount: rows.length,
    rows,
    status: rows.length === 0 ? 'no-source-file-rows' : 'open-source-file-rows',
    strictCompletionCommand
  }
}

function printSourceFileDossier(queue, fileFilter, actionFilter = null, ownerFilter = null) {
  console.log(JSON.stringify(buildSourceFileDossier(queue, fileFilter, actionFilter, ownerFilter), null, 2))
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim()
}

function renderOwnerActionList(groups) {
  const owners = Object.keys(groups).sort((left, right) => left.localeCompare(right))
  if (owners.length === 0) return '- None'
  return owners.flatMap(owner => {
    const actionIds = [...groups[owner]].sort((left, right) => left.localeCompare(right))
    return [
      `### ${owner}`,
      '',
      ...actionIds.map(actionId => `- ${actionId}`)
    ]
  }).join('\n')
}

function renderEvidenceCoverageMarkdown(coverage, summaries, generatedAt = new Date()) {
  const rows = summaries
    .slice()
    .sort((left, right) => left.actionId.localeCompare(right.actionId))
    .map(summary => [
      summary.actionId,
      summary.owner,
      summary.submissionFilePath ?? '',
	      summary.evidenceFilePath,
	      summary.evidenceModifiedAt,
	      summary.hashAlgorithm,
	      summary.evidenceSha256,
	      summary.evidenceSizeBytes,
      summary.recommendedStrictCompletionCommand,
      summary.strictCompletionStillRequired,
      summary.unknownSubmissionFields?.join(', ') ?? ''
    ])
  return [
    '# 0503 Owner Evidence Coverage Report',
    '',
    `Generated at: ${generatedAt.toISOString()}`,
    '',
    '## Boundary',
    '',
    '- This report validates owner evidence submission coverage only.',
    `- This report is not completion evidence and does not waive \`${strictCompletionCommand}\`.`,
    `- Final closure should rerun \`${shellPortableStrictCompletionCommand}\` after every real evidence item is present.`,
    '- Raw evidence files, owner identities, evidence timestamps, SHA-256 digests, and strict completion remain authoritative.',
    '',
    '## Summary',
    '',
    `- Complete: ${coverage.complete}`,
    `- Owner filter: ${coverage.ownerFilter ?? 'all'}`,
    `- Submitted action count: ${coverage.submittedActionCount}`,
    `- Total action count: ${coverage.totalActionCount}`,
    ...(coverage.validationStatus ? [`- Validation status: ${coverage.validationStatus}`] : []),
    ...(coverage.validationError ? [`- Validation error: ${coverage.validationError}`] : []),
    '',
    '## Missing By Owner',
    '',
    renderOwnerActionList(coverage.missingByOwner),
    '',
    '## Submitted By Owner',
    '',
    renderOwnerActionList(coverage.submittedByOwner),
    '',
    '## Submissions',
    '',
	    '| Action id | Owner | Submission file | Evidence file | Evidence modified at | Hash algorithm | Evidence SHA-256 | Evidence size bytes | Recommended strict command | Strict completion still required | Unknown submission fields |',
	    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
	    ...(rows.length > 0
	      ? rows.map(row => `| ${row.map(markdownCell).join(' | ')} |`)
	      : ['| None |  |  |  |  |  |  |  |  |  |  |']),
    ''
  ].join('\n')
}

function writeCoverageReport(rootDir, reportPath, coverage, summaries, generatedAt = new Date()) {
  assertNonEmptyString(reportPath, 'coverage report path')
  const normalizedReportPath = normalizeRelativeRepoPath(reportPath)
  assert(normalizedReportPath.endsWith('.md'), `coverage report path must end with .md: ${reportPath}`)
  const reportAbsPath = resolveRepoPath(rootDir, normalizedReportPath)
  mkdirSync(dirname(reportAbsPath), { recursive: true })
  writeFileSync(reportAbsPath, renderEvidenceCoverageMarkdown(coverage, summaries, generatedAt))
  return normalizedReportPath
}

function buildEvidenceCoverageJson(coverage, summaries, generatedAt = new Date()) {
  return {
    schemaVersion: ownerEvidenceCoverageReportSchemaVersion,
    generatedAt: generatedAt.toISOString(),
    boundary: {
      strictCompletionCommand,
      recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
      strictCompletionStillRequired: true,
      statement: `This report validates owner evidence submission coverage only. Strict completion remains authoritative. Final closure should rerun ${shellPortableStrictCompletionCommand}.`
    },
    coverage,
    submissions: summaries
      .slice()
      .sort((left, right) => left.actionId.localeCompare(right.actionId))
      .map(summary => ({
        actionId: summary.actionId,
	        evidenceFilePath: summary.evidenceFilePath,
	        evidenceModifiedAt: summary.evidenceModifiedAt,
	        hashAlgorithm: summary.hashAlgorithm,
	        evidenceSha256: summary.evidenceSha256,
        evidenceSizeBytes: summary.evidenceSizeBytes,
        owner: summary.owner,
        recommendedStrictCompletionCommand: summary.recommendedStrictCompletionCommand,
        strictCompletionCommand: summary.strictCompletionCommand,
        strictCompletionStillRequired: summary.strictCompletionStillRequired,
        submissionFilePath: summary.submissionFilePath ?? null,
        unknownSubmissionFields: summary.unknownSubmissionFields ?? []
      }))
  }
}

function writeCoverageJsonReport(rootDir, reportPath, coverage, summaries, generatedAt = new Date()) {
  assertNonEmptyString(reportPath, 'coverage JSON report path')
  const normalizedReportPath = normalizeRelativeRepoPath(reportPath)
  assert(normalizedReportPath.endsWith('.json'), `coverage JSON report path must end with .json: ${reportPath}`)
  const reportAbsPath = resolveRepoPath(rootDir, normalizedReportPath)
  mkdirSync(dirname(reportAbsPath), { recursive: true })
  writeFileSync(reportAbsPath, `${JSON.stringify(buildEvidenceCoverageJson(coverage, summaries, generatedAt), null, 2)}\n`)
  return normalizedReportPath
}

function runSelfTest() {
  const root = mkdtempSync(join(tmpdir(), '0503-owner-evidence-'))
  try {
	    const evidenceText = `${JSON.stringify({
	      generatedAt: '2026-05-19T00:00:30.000Z',
	      browserWindowSecondDisplay: {
	        displayCount: 2,
	        matchedDisplayId: 2,
	        targetDisplayId: 2,
	        valid: true
	      },
	      gates: [
	        {
	          id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	          passed: true,
	          evidence: 'displayCount=2; targetDisplayId=2; matchedDisplayId=2'
	        }
	      ],
	      passed: true
    }, null, 2)}\n`
	    const evidenceMtime = new Date('2026-05-19T00:00:30.000Z')
	    const evidenceSubmissionMetadata = evidenceContent => ({
	      evidenceModifiedAt: evidenceMtime.toISOString(),
	      evidenceSizeBytes: Buffer.byteLength(evidenceContent)
	    })
	    const evidencePath = join(root, 'evidence.txt')
    writeFileSync(evidencePath, evidenceText)
    utimesSync(evidencePath, evidenceMtime, evidenceMtime)
	    const queue = {
	      generatedAt: '2026-05-19T00:00:00.000Z',
	      ownerLaneCommands: [
	        {
	          coverageJsonCommand: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --coverage-json <repo-relative-report.json>',
	          coverageReportCommand: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --coverage-report <repo-relative-report.md>',
	          listActionsCommand: 'pnpm --silent check:0503-owner-evidence -- --list-actions --owner operator',
	          owner: 'operator',
	          ownerReadinessWithCoverageArtifactsCommand: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner operator --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md> --coverage-json <repo-relative-report.json>',
	          ownerReadinessWithEvidenceDirCommand: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner operator --evidence-dir <repo-relative-dir>',
	          ownerReadinessCommand: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner operator',
	          ownerSummaryCommand: 'pnpm --silent check:0503-owner-evidence -- --owner-summary --owner operator',
	          partialR8DossierCommand: 'pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner operator',
	          rawEvidenceTemplateDirectoryCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner operator',
	          requireCompleteCommand: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --require-complete',
	          submissionTemplateDirectoryCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner operator'
	        }
	      ],
	      actions: [
	        {
	          closureKind: 'hardware',
	          currentEvidence: '1 display(s) detected',
	          gateId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	          owner: 'operator',
	          requiredEvidence: 'A live BrowserWindow second-display placement report.',
	          sourceFiles: {
	            files: [
	              {
	                actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                count: 1,
	                file: 'prompts/0503/example-survey.md',
	                rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                sourceFileDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --source-file-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY --file prompts/0503/example-survey.md',
	                submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'
	              }
	            ],
	            omittedFileCount: 0,
	            totalFileCount: 1
	          },
	          unblockRule: 'Do not close with virtual evidence.',
	          verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	          verificationCommandNote: 'Second-display closure must preserve real BrowserWindow placement evidence.'
	        }
	      ]
	    }
	    const summary = validateSubmission({
	      schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	      owner: 'operator',
	      actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	      evidenceFilePath: 'evidence.txt',
	      ...evidenceSubmissionMetadata(evidenceText),
	      evidenceSha256: sha256(evidenceText),
	      hashAlgorithm: 'sha256',
	      verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
      resultSummary: 'pass: screens=2 from real Windows display enumeration',
      evidenceTimestamp: '2026-05-19T00:00:00.000Z',
      approverOrOperatorIdentity: 'DOMAIN\\operator',
      boundaryStatement: 'strict completion must still pass before closure',
    }, queue, {
      now: new Date('2026-05-19T00:01:00.000Z'),
      repoRoot: root
    })
	    assert(summary.owner === 'operator', 'self-test should return expected owner')
	    assert(summary.evidenceSha256 === sha256(evidenceText), 'self-test should return evidence hash')
	    assert(summary.evidenceModifiedAt === evidenceMtime.toISOString(), 'self-test should return evidence file mtime')
	    assert(summary.hashAlgorithm === 'sha256', 'self-test should return evidence hash algorithm')
	    assert(summary.unknownSubmissionFields.length === 0, 'self-test should return no unknown submission fields for a valid submission')
	    let unknownSubmissionFieldRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'operator',
	        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	        evidenceFilePath: 'evidence.txt',
	        ...evidenceSubmissionMetadata(evidenceText),
	        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure',
	        operatorNote: 'unknown fields must not be accepted as evidence metadata'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      unknownSubmissionFieldRejected = String(error.message).includes('unknown field')
	    }
	    assert(unknownSubmissionFieldRejected, 'self-test should reject owner evidence submissions with unknown fields')
    const validationOutput = buildOwnerEvidenceValidationOutput(summary)
    assert(validationOutput.schemaVersion === ownerEvidenceValidationSchemaVersion, 'self-test should build owner evidence validation schemaVersion')
    assert(validationOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in owner evidence validation output')
    assert(validationOutput.boundary.includes('does not close evidence'), 'self-test should keep owner evidence validation boundary explicit')
    const binaryEvidence = Buffer.from([0, 1, 2, 3, 255])
    const binaryEvidencePath = join(root, 'evidence.bin')
    writeFileSync(binaryEvidencePath, binaryEvidence)
    utimesSync(binaryEvidencePath, evidenceMtime, evidenceMtime)
    const hashCapture = []
    const originalLog = console.log
    try {
      console.log = value => hashCapture.push(value)
      printEvidenceHash(root, 'evidence.txt')
    } finally {
      console.log = originalLog
    }
    const hashOutput = JSON.parse(hashCapture.join('\n'))
    assert(hashOutput.schemaVersion === ownerEvidenceHashSchemaVersion, 'self-test should print evidence hash schemaVersion')
    assert(hashOutput.evidenceFilePath === 'evidence.txt', 'self-test should print normalized evidence path')
    assert(hashOutput.evidenceModifiedAt === evidenceMtime.toISOString(), 'self-test should print evidence hash file mtime')
    assert(hashOutput.evidenceSha256 === sha256(evidenceText), 'self-test should print evidence hash')
    assert(hashOutput.evidenceSizeBytes === Buffer.byteLength(evidenceText), 'self-test should print evidence hash file size')
    assert(hashOutput.hashAlgorithm === 'sha256', 'self-test should print evidence hash algorithm')
    assert(hashOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in evidence hash output')
    assert(hashOutput.boundary.includes('digest helper only'), 'self-test should keep evidence hash boundary explicit')
    hashCapture.length = 0
    try {
      console.log = value => hashCapture.push(value)
      printEvidenceHash(root, 'evidence.bin')
    } finally {
      console.log = originalLog
    }
    const binaryHashOutput = JSON.parse(hashCapture.join('\n'))
    assert(binaryHashOutput.evidenceSha256 === sha256(binaryEvidence), 'self-test should hash binary evidence bytes')
    assert(binaryHashOutput.evidenceSizeBytes === binaryEvidence.length, 'self-test should print binary evidence byte length')
    const failedGateEvidenceText = `${JSON.stringify({
      generatedAt: '2026-05-19T00:00:30.000Z',
      gates: [
        {
          id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
          passed: false,
          evidence: '1 display(s) detected'
        }
      ],
      passed: false
    }, null, 2)}\n`
    const failedGateEvidencePath = join(root, 'failed-gate-evidence.json')
    writeFileSync(failedGateEvidencePath, failedGateEvidenceText)
    utimesSync(failedGateEvidencePath, evidenceMtime, evidenceMtime)
    let failedStructuredGateRejected = false
    try {
      validateSubmission({
        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'operator',
	        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	        evidenceFilePath: 'failed-gate-evidence.json',
	        ...evidenceSubmissionMetadata(failedGateEvidenceText),
	        evidenceSha256: sha256(failedGateEvidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
        resultSummary: 'fail: screens=1 from real Windows display enumeration',
        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
        approverOrOperatorIdentity: 'DOMAIN\\operator',
        boundaryStatement: 'strict completion must still pass before closure'
      }, queue, {
        now: new Date('2026-05-19T00:01:00.000Z'),
        repoRoot: root
      })
    } catch (error) {
      failedStructuredGateRejected = String(error.message).includes('passed=true')
    }
	    assert(failedStructuredGateRejected, 'self-test should reject external blocker reports where the target gate did not pass')
	    const browserWindowSecondDisplayEvidenceText = `${JSON.stringify({
	      schemaVersion: 'devhub-browserwindow-second-display-v1',
	      blocked: false,
	      browserWindowBounds: { x: 1940, y: 20, width: 480, height: 320 },
	      capturedAt: '2026-05-19T00:00:30.000Z',
	      displayCount: 2,
	      passed: true,
	      placement: {
	        browserWindowInsideTargetWorkArea: true,
	        displayCount: 2,
	        matchedDisplayId: 2,
	        passed: true,
	        primaryDisplayId: 1,
	        targetDisplayId: 2,
	        targetDisplayIsSecondary: true,
	        targetDisplayMatched: true
	      }
	    }, null, 2)}\n`
	    const browserWindowSecondDisplayEvidencePath = join(root, 'browserwindow-second-display-evidence.json')
	    writeFileSync(browserWindowSecondDisplayEvidencePath, browserWindowSecondDisplayEvidenceText)
	    utimesSync(browserWindowSecondDisplayEvidencePath, evidenceMtime, evidenceMtime)
	    const browserWindowSecondDisplaySummary = validateSubmission({
	      schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	      owner: 'operator',
	      actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	      evidenceFilePath: 'browserwindow-second-display-evidence.json',
	      ...evidenceSubmissionMetadata(browserWindowSecondDisplayEvidenceText),
	      evidenceSha256: sha256(browserWindowSecondDisplayEvidenceText),
	      hashAlgorithm: 'sha256',
	      verificationCommand: 'pnpm -C devhub check:browserwindow-second-display',
	      resultSummary: 'pass: BrowserWindow bounds matched the non-primary display',
	      evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	      approverOrOperatorIdentity: 'DOMAIN\\operator',
	      boundaryStatement: 'strict completion must still pass before closure'
	    }, {
	      generatedAt: queue.generatedAt,
	      actions: [
	        {
	          closureKind: 'hardware',
	          currentEvidence: 'BrowserWindow second-display report not provided',
	          gateId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	          owner: 'operator',
	          requiredEvidence: 'A live BrowserWindow second-display placement report.',
	          unblockRule: 'Do not close with display enumeration alone.',
	          verificationCommand: 'pnpm -C devhub check:browserwindow-second-display'
	        }
	      ]
	    }, {
	      now: new Date('2026-05-19T00:01:00.000Z'),
	      repoRoot: root
	    })
	    assert(browserWindowSecondDisplaySummary.structuredEvidence?.type === 'browserwindow-second-display-report', 'self-test should validate structured BrowserWindow second-display evidence')
	    let weakBrowserWindowSecondDisplayRejected = false
	    const weakBrowserWindowSecondDisplayEvidenceText = `${JSON.stringify({
	      schemaVersion: 'devhub-browserwindow-second-display-v1',
	      blocked: false,
	      capturedAt: '2026-05-19T00:00:30.000Z',
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
	    }, null, 2)}\n`
	    const weakBrowserWindowSecondDisplayEvidencePath = join(root, 'weak-browserwindow-second-display-evidence.json')
	    writeFileSync(weakBrowserWindowSecondDisplayEvidencePath, weakBrowserWindowSecondDisplayEvidenceText)
	    utimesSync(weakBrowserWindowSecondDisplayEvidencePath, evidenceMtime, evidenceMtime)
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'operator',
	        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	        evidenceFilePath: 'weak-browserwindow-second-display-evidence.json',
	        ...evidenceSubmissionMetadata(weakBrowserWindowSecondDisplayEvidenceText),
	        evidenceSha256: sha256(weakBrowserWindowSecondDisplayEvidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:browserwindow-second-display',
	        resultSummary: 'pass: BrowserWindow report exists',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure'
	      }, {
	        generatedAt: queue.generatedAt,
	        actions: [
	          {
	            closureKind: 'hardware',
	            currentEvidence: 'BrowserWindow second-display report not provided',
	            gateId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	            owner: 'operator',
	            requiredEvidence: 'A live BrowserWindow second-display placement report.',
	            unblockRule: 'Do not close with display enumeration alone.',
	            verificationCommand: 'pnpm -C devhub check:browserwindow-second-display'
	          }
	        ]
	      }, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      weakBrowserWindowSecondDisplayRejected = String(error.message).includes('placement must have passed')
	    }
	    assert(weakBrowserWindowSecondDisplayRejected, 'self-test should reject BrowserWindow second-display evidence that does not match the target display')
	    const zeroEgressEvidenceText = `${JSON.stringify({
      capturedAt: '2026-05-19T00:00:30.000Z',
      blocked: false,
      passed: true,
      packetCount: 0,
      durationSeconds: 60
    }, null, 2)}\n`
    const zeroEgressEvidencePath = join(root, 'zero-egress-evidence.json')
    writeFileSync(zeroEgressEvidencePath, zeroEgressEvidenceText)
    utimesSync(zeroEgressEvidencePath, evidenceMtime, evidenceMtime)
    const zeroEgressSummary = validateSubmission({
      schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	      owner: 'operator',
	      actionId: 'H1_J16_ZERO_EGRESS_CAPTURE_READY',
	      evidenceFilePath: 'zero-egress-evidence.json',
	      ...evidenceSubmissionMetadata(zeroEgressEvidenceText),
	      evidenceSha256: sha256(zeroEgressEvidenceText),
	      hashAlgorithm: 'sha256',
	      verificationCommand: 'pnpm -C devhub check:zero-egress-capture',
      resultSummary: 'pass: packetCount=0 over 60 seconds',
      evidenceTimestamp: '2026-05-19T00:00:00.000Z',
      approverOrOperatorIdentity: 'DOMAIN\\operator',
      boundaryStatement: 'strict completion must still pass before closure'
    }, {
      generatedAt: queue.generatedAt,
      actions: [
        {
          closureKind: 'network-capture',
          currentEvidence: 'pktmon capture not provided',
          gateId: 'H1_J16_ZERO_EGRESS_CAPTURE_READY',
          owner: 'operator',
          requiredEvidence: 'A live pktmon zero-egress capture.',
          unblockRule: 'Do not close from preflight alone.',
          verificationCommand: 'pnpm -C devhub check:zero-egress-capture'
        }
      ]
    }, {
      now: new Date('2026-05-19T00:01:00.000Z'),
      repoRoot: root
    })
    assert(zeroEgressSummary.structuredEvidence?.packetCount === 0, 'self-test should validate structured zero-egress evidence')
    const physicalMonitorEvidenceText = `${JSON.stringify({
      schemaVersion: 'devhub-physical-monitor-hotplug-v1',
      capturedAt: '2026-05-19T00:00:30.000Z',
      blocked: false,
      passed: true,
      durationSeconds: 30,
      baselineDisplayCount: 2,
      minDisplayCount: 1,
      finalDisplayCount: 2,
      removalObserved: true,
      reconnectionObserved: true,
      sampleCount: 4
    }, null, 2)}\n`
    const physicalMonitorEvidencePath = join(root, 'physical-monitor-hotplug-evidence.json')
    writeFileSync(physicalMonitorEvidencePath, physicalMonitorEvidenceText)
    utimesSync(physicalMonitorEvidencePath, evidenceMtime, evidenceMtime)
    const physicalMonitorSummary = validateSubmission({
      schemaVersion: ownerEvidenceSubmissionSchemaVersion,
      owner: 'operator',
      actionId: 'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
      evidenceFilePath: 'physical-monitor-hotplug-evidence.json',
      ...evidenceSubmissionMetadata(physicalMonitorEvidenceText),
      evidenceSha256: sha256(physicalMonitorEvidenceText),
      hashAlgorithm: 'sha256',
      verificationCommand: 'pnpm -C devhub check:physical-monitor-hotplug',
      resultSummary: 'pass: display count dropped from 2 to 1 and returned to 2',
      evidenceTimestamp: '2026-05-19T00:00:00.000Z',
      approverOrOperatorIdentity: 'DOMAIN\\operator',
      boundaryStatement: 'strict completion must still pass before closure'
    }, {
      generatedAt: queue.generatedAt,
      actions: [
        {
          closureKind: 'hardware',
          currentEvidence: 'physical monitor hotplug capture not provided',
          gateId: 'R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY',
          owner: 'operator',
          requiredEvidence: 'A live monitor unplug/replug trace.',
          unblockRule: 'Do not close with static enumeration.',
          verificationCommand: 'pnpm -C devhub check:physical-monitor-hotplug'
        }
      ]
    }, {
      now: new Date('2026-05-19T00:01:00.000Z'),
      repoRoot: root
    })
    assert(physicalMonitorSummary.structuredEvidence?.type === 'physical-monitor-hotplug-report', 'self-test should validate structured physical monitor hotplug evidence')
    assert(physicalMonitorSummary.structuredEvidence?.minDisplayCount === 1, 'self-test should preserve physical monitor hotplug min display count')
    const checkboxSourceFiles = {
      files: [
        {
          count: 2,
          file: 'prompts/0503/example-survey.md'
        }
      ],
      omittedFileCount: 0,
      totalFileCount: 1
    }
    const checkboxClosureEvidenceText = `${JSON.stringify({
      schemaVersion: 'devhub-0503-checkbox-closure-evidence-v1',
      actionId: 'survey-context',
      closureKind: 'survey-context',
      owner: 'product',
      rowCount: 2,
      sourceFiles: checkboxSourceFiles,
      decidedAt: '2026-05-19T00:00:30.000Z',
      decision: 'Product reviewed and approved this closure class against the current checkbox manifest.'
    }, null, 2)}\n`
    const checkboxClosureEvidencePath = join(root, 'checkbox-closure-evidence.json')
    writeFileSync(checkboxClosureEvidencePath, checkboxClosureEvidenceText)
    utimesSync(checkboxClosureEvidencePath, evidenceMtime, evidenceMtime)
    const checkboxClosureVerificationCommandNote = 'Survey-context closure must use real product-owner evidence and must not be closed from template-only files.'
    const checkboxClosureQueue = {
      generatedAt: queue.generatedAt,
      actions: [
        {
          actionType: 'checkbox-closure-class',
          closureKind: 'survey-context',
          count: 2,
          currentEvidence: '2 open checkbox row(s) classified as survey-context',
          gateId: null,
          owner: 'product',
          requiredEvidence: 'Rows closed by external product owner evidence.',
          sourceFiles: checkboxSourceFiles,
          unblockRule: 'Do not mark source checkboxes complete from generated inventory alone.',
          verificationCommand: 'pnpm check:0503-checkbox-manifest',
          verificationCommandNote: checkboxClosureVerificationCommandNote
        }
      ]
    }
    const checkboxClosureSummary = validateSubmission({
      schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	      owner: 'product',
	      actionId: 'survey-context',
	      evidenceFilePath: 'checkbox-closure-evidence.json',
	      ...evidenceSubmissionMetadata(checkboxClosureEvidenceText),
	      evidenceSha256: sha256(checkboxClosureEvidenceText),
	      hashAlgorithm: 'sha256',
      verificationCommand: 'pnpm check:0503-checkbox-manifest',
      verificationCommandNote: checkboxClosureVerificationCommandNote,
      resultSummary: 'pass: product reviewed 2 survey-context rows',
      evidenceTimestamp: '2026-05-19T00:00:00.000Z',
      approverOrOperatorIdentity: 'product-owner',
      boundaryStatement: 'strict completion must still pass before closure'
    }, checkboxClosureQueue, {
      now: new Date('2026-05-19T00:01:00.000Z'),
      repoRoot: root
    })
    assert(checkboxClosureSummary.structuredEvidence?.rowCount === 2, 'self-test should validate checkbox closure evidence row count')
    assert(!checkboxClosureSummary.unknownSubmissionFields.includes('verificationCommandNote'), 'self-test should treat verificationCommandNote as a known submission metadata field')
    const checkboxRawEvidenceTemplate = buildRawEvidenceTemplate(checkboxClosureQueue.actions[0])
    assert(checkboxRawEvidenceTemplate.verificationCommandNote === checkboxClosureVerificationCommandNote, 'self-test should copy checkbox closure verificationCommandNote into raw evidence templates')
    assert(buildSubmissionTemplate(checkboxClosureQueue.actions[0]).verificationCommandNote === checkboxClosureVerificationCommandNote, 'self-test should copy checkbox closure verificationCommandNote into submission templates')
    const checkboxTemplateEvidenceText = `${JSON.stringify(checkboxRawEvidenceTemplate, null, 2)}\n`
    const checkboxTemplateEvidencePath = join(root, 'checkbox-closure-template.json')
    writeFileSync(checkboxTemplateEvidencePath, checkboxTemplateEvidenceText)
    utimesSync(checkboxTemplateEvidencePath, evidenceMtime, evidenceMtime)
    let checkboxTemplateRejected = false
    try {
      validateSubmission({
        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'product',
	        actionId: 'survey-context',
	        evidenceFilePath: 'checkbox-closure-template.json',
	        ...evidenceSubmissionMetadata(checkboxTemplateEvidenceText),
	        evidenceSha256: sha256(checkboxTemplateEvidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm check:0503-checkbox-manifest',
        resultSummary: 'pass: product reviewed survey-context rows',
        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
        approverOrOperatorIdentity: 'product-owner',
        boundaryStatement: 'strict completion must still pass before closure'
      }, checkboxClosureQueue, {
        now: new Date('2026-05-19T00:01:00.000Z'),
        repoRoot: root
      })
    } catch (error) {
      checkboxTemplateRejected = String(error.message).includes('templateOnly')
    }
    assert(checkboxTemplateRejected, 'self-test should reject checkbox closure raw evidence templates')
    const mismatchedCheckboxClosureEvidenceText = checkboxClosureEvidenceText.replace('"rowCount": 2', '"rowCount": 1')
    const mismatchedCheckboxClosureEvidencePath = join(root, 'checkbox-closure-evidence-mismatch.json')
    writeFileSync(mismatchedCheckboxClosureEvidencePath, mismatchedCheckboxClosureEvidenceText)
    utimesSync(mismatchedCheckboxClosureEvidencePath, evidenceMtime, evidenceMtime)
    let mismatchedCheckboxClosureRejected = false
    try {
      validateSubmission({
        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
        owner: 'product',
        actionId: 'survey-context',
        evidenceFilePath: 'checkbox-closure-evidence-mismatch.json',
        ...evidenceSubmissionMetadata(mismatchedCheckboxClosureEvidenceText),
        evidenceSha256: sha256(mismatchedCheckboxClosureEvidenceText),
        hashAlgorithm: 'sha256',
        verificationCommand: 'pnpm check:0503-checkbox-manifest',
        resultSummary: 'pass: product reviewed survey-context rows',
        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
        approverOrOperatorIdentity: 'product-owner',
        boundaryStatement: 'strict completion must still pass before closure'
      }, checkboxClosureQueue, {
        now: new Date('2026-05-19T00:01:00.000Z'),
        repoRoot: root
      })
    } catch (error) {
      mismatchedCheckboxClosureRejected = String(error.message).includes('rowCount mismatch')
    }
    assert(mismatchedCheckboxClosureRejected, 'self-test should reject checkbox closure evidence with mismatched row counts')
    hashCapture.length = 0
    try {
      console.log = value => hashCapture.push(value)
      printActions(queue)
    } finally {
      console.log = originalLog
    }
	    const actionOutput = JSON.parse(hashCapture.join('\n'))
	    assert(actionOutput.count === 1, 'self-test should print one owner action')
	    assert(actionOutput.actions[0].actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose gateId as actionId')
	    assert(actionOutput.actions[0].actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose action dossier command in list-actions output')
	    assert(actionOutput.actions[0].rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose raw evidence template command in list-actions output')
	    assert(actionOutput.actions[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose submission template command in list-actions output')
	    assert(actionOutput.actions[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in list-actions output')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printTemplate(queue, 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY')
	    } finally {
	      console.log = originalLog
	    }
	    const specificTemplateOutput = JSON.parse(hashCapture.join('\n'))
	    assert(specificTemplateOutput.schemaVersion === ownerEvidenceSubmissionSchemaVersion, 'self-test should print submission template schemaVersion')
	    assert(specificTemplateOutput.actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should print action-specific template actionId')
	    assert(specificTemplateOutput.owner === 'operator', 'self-test should print action-specific template owner')
	    assert(specificTemplateOutput.templateOnly === true, 'self-test should mark submission templates as templateOnly')
	    assert(specificTemplateOutput.verificationCommand === 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json', 'self-test should print action-specific template command')
	    assert(specificTemplateOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should print shell-portable strict command in submission templates')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printEvidenceTemplate(queue, 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY')
	    } finally {
	      console.log = originalLog
	    }
	    const rawEvidenceTemplateOutput = JSON.parse(hashCapture.join('\n'))
	    assert(rawEvidenceTemplateOutput.schemaVersion === ownerRawEvidenceTemplateSchemaVersion, 'self-test should print raw evidence template schemaVersion')
	    assert(rawEvidenceTemplateOutput.templateOnly === true, 'self-test should mark raw evidence templates as templateOnly')
	    assert(rawEvidenceTemplateOutput.actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should print raw evidence template actionId')
	    assert(rawEvidenceTemplateOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should print shell-portable strict command in raw evidence templates')
    mkdirSync(join(root, 'raw-evidence-templates'), { recursive: true })
    writeFileSync(join(root, 'raw-evidence-templates', 'STALE.raw-evidence-template.json'), '{}\n')
    const templateDirectoryOutput = writeEvidenceTemplateDirectory(root, queue, 'raw-evidence-templates', 'operator')
	    assert(templateDirectoryOutput.schemaVersion === ownerRawEvidenceTemplateDirectorySchemaVersion, 'self-test should write raw evidence template directory schemaVersion')
	    assert(templateDirectoryOutput.templateOnly === true, 'self-test should mark raw evidence template directory output as templateOnly')
	    assert(templateDirectoryOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in raw evidence template directory output')
	    assert(templateDirectoryOutput.boundary.includes('scaffolding only'), 'self-test should keep raw evidence template directory boundary explicit')
	    assert(templateDirectoryOutput.count === 1, 'self-test should write one owner-filtered raw evidence template')
	    assert(templateDirectoryOutput.ownerFilter === 'operator', 'self-test should echo raw evidence template owner filter')
	    assert(templateDirectoryOutput.readmePath === 'raw-evidence-templates/README.md', 'self-test should write raw evidence template README')
	    assert(templateDirectoryOutput.templates[0].filePath === 'raw-evidence-templates/ASSERT_BROWSERWINDOW_SECOND_DISPLAY.raw-evidence-template.json', 'self-test should use stable raw evidence template file names')
    assert(!existsSync(join(root, 'raw-evidence-templates', 'STALE.raw-evidence-template.json')), 'self-test should remove stale raw evidence template files')
		    const writtenRawEvidenceTemplate = readJson(join(root, templateDirectoryOutput.templates[0].filePath))
		    assert(writtenRawEvidenceTemplate.schemaVersion === ownerRawEvidenceTemplateSchemaVersion, 'self-test should write raw evidence template schemaVersion')
		    assert(writtenRawEvidenceTemplate.templateOnly === true, 'self-test should write non-passable raw evidence template files')
		    assert(writtenRawEvidenceTemplate.actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should write action-specific raw evidence templates')
    assert(writtenRawEvidenceTemplate.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should write shell-portable strict command into raw evidence template files')
    const rawTemplateReadme = readText(join(root, templateDirectoryOutput.readmePath))
    assert(rawTemplateReadme.includes('templateOnly'), 'self-test should write explicit raw evidence template README boundary text')
    assert(rawTemplateReadme.includes(ownerRawEvidenceTemplateDirectorySchemaVersion), 'self-test should write raw evidence template directory schemaVersion into README')
	    assert(rawTemplateReadme.includes('Do not validate this template directory directly as evidence.'), 'self-test should prevent direct raw template directory validation')
	    assert(rawTemplateReadme.includes('Recommended workflow:'), 'self-test should write raw template README workflow')
	    assert(rawTemplateReadme.includes('--hash-evidence <repo-relative-evidence-file>'), 'self-test should write raw template hash evidence workflow command')
	    assert(rawTemplateReadme.includes('evidenceSha256'), 'self-test should write raw template evidenceSha256 copy guidance')
	    assert(rawTemplateReadme.includes('hashAlgorithm'), 'self-test should write raw template hashAlgorithm copy guidance')
	    assert(rawTemplateReadme.includes('evidenceModifiedAt'), 'self-test should write raw template evidenceModifiedAt copy guidance')
    assert(rawTemplateReadme.includes('evidenceSizeBytes'), 'self-test should write raw template evidenceSizeBytes copy guidance')
	    assert(rawTemplateReadme.includes('unknown fields are rejected'), 'self-test should write raw template strict submission schema guidance')
	    assert(rawTemplateReadme.includes('--owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>'), 'self-test should write raw template owner-readiness workflow command')
    assert(rawTemplateReadme.includes('--require-complete'), 'self-test should write raw template require-complete workflow command')
    mkdirSync(join(root, 'submission-templates'), { recursive: true })
    writeFileSync(join(root, 'submission-templates', 'STALE.submission-template.json'), '{}\n')
    const submissionTemplateDirectoryOutput = writeSubmissionTemplateDirectory(root, queue, 'submission-templates', 'operator')
	    assert(submissionTemplateDirectoryOutput.schemaVersion === ownerSubmissionTemplateDirectorySchemaVersion, 'self-test should write submission template directory schemaVersion')
	    assert(submissionTemplateDirectoryOutput.templateOnly === true, 'self-test should mark submission template directory output as templateOnly')
	    assert(submissionTemplateDirectoryOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in submission template directory output')
	    assert(submissionTemplateDirectoryOutput.boundary.includes('scaffolding only'), 'self-test should keep submission template directory boundary explicit')
	    assert(submissionTemplateDirectoryOutput.count === 1, 'self-test should write one owner-filtered submission template')
	    assert(submissionTemplateDirectoryOutput.ownerFilter === 'operator', 'self-test should echo submission template owner filter')
	    assert(submissionTemplateDirectoryOutput.readmePath === 'submission-templates/README.md', 'self-test should write submission template README')
	    assert(submissionTemplateDirectoryOutput.templates[0].filePath === 'submission-templates/ASSERT_BROWSERWINDOW_SECOND_DISPLAY.submission-template.json', 'self-test should use stable submission template file names')
    assert(!existsSync(join(root, 'submission-templates', 'STALE.submission-template.json')), 'self-test should remove stale submission template files')
	    const writtenSubmissionTemplate = readJson(join(root, submissionTemplateDirectoryOutput.templates[0].filePath))
	    assert(writtenSubmissionTemplate.templateOnly === true, 'self-test should write non-passable submission template files')
	    assert(writtenSubmissionTemplate.schemaVersion === ownerEvidenceSubmissionSchemaVersion, 'self-test should write submission template schemaVersion')
	    assert(writtenSubmissionTemplate.actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should write action-specific submission templates')
	    assert(writtenSubmissionTemplate.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should write shell-portable strict command into submission template files')
    const submissionTemplateReadme = readText(join(root, submissionTemplateDirectoryOutput.readmePath))
    assert(submissionTemplateReadme.includes('templateOnly'), 'self-test should write explicit submission template README boundary text')
    assert(submissionTemplateReadme.includes(ownerSubmissionTemplateDirectorySchemaVersion), 'self-test should write submission template directory schemaVersion into README')
    assert(submissionTemplateReadme.includes(shellPortableStrictCompletionCommand), 'self-test should write shell-portable strict command into submission template README')
	    assert(submissionTemplateReadme.includes('Do not validate this template directory directly as evidence.'), 'self-test should prevent direct submission template directory validation')
	    assert(submissionTemplateReadme.includes('Recommended workflow:'), 'self-test should write submission template README workflow')
	    assert(submissionTemplateReadme.includes('--hash-evidence <repo-relative-evidence-file>'), 'self-test should write submission template hash evidence workflow command')
	    assert(submissionTemplateReadme.includes('evidenceSha256'), 'self-test should write submission template evidenceSha256 copy guidance')
	    assert(submissionTemplateReadme.includes('hashAlgorithm'), 'self-test should write submission template hashAlgorithm copy guidance')
	    assert(submissionTemplateReadme.includes('evidenceModifiedAt'), 'self-test should write submission template evidenceModifiedAt copy guidance')
	    assert(submissionTemplateReadme.includes('evidenceSizeBytes'), 'self-test should write submission template evidenceSizeBytes copy guidance')
	    assert(submissionTemplateReadme.includes('unknown fields are rejected'), 'self-test should write submission template strict schema guidance')
	    assert(submissionTemplateReadme.includes('--owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>'), 'self-test should write submission template owner-readiness workflow command')
    assert(submissionTemplateReadme.includes('--require-complete'), 'self-test should write submission template require-complete workflow command')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
      printActions(queue, 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY')
    } finally {
      console.log = originalLog
    }
	    const filteredActionOutput = JSON.parse(hashCapture.join('\n'))
	    assert(filteredActionOutput.schemaVersion === ownerActionListSchemaVersion, 'self-test should print owner action list schemaVersion')
	    assert(filteredActionOutput.count === 1, 'self-test should filter owner actions by gateId')
	    assert(filteredActionOutput.filter === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should echo action filter')
	    assert(filteredActionOutput.actions[0].actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should keep action dossier command in filtered list-actions output')
	    assert(filteredActionOutput.actions[0].rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should keep raw evidence template command in filtered list-actions output')
	    assert(filteredActionOutput.actions[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should keep submission template command in filtered list-actions output')
	    assert(filteredActionOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in action list output')
	    assert(filteredActionOutput.boundary.includes('intake aid only'), 'self-test should keep owner action list boundary explicit')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printActions({
	        generatedAt: queue.generatedAt,
	        actions: [
	          ...queue.actions,
	          {
	            actionType: 'checkbox-closure-class',
	            closureKind: 'survey-context',
	            count: 2,
	            currentEvidence: '2 open checkbox row(s) classified as survey-context',
	            owner: 'product',
	            requiredEvidence: 'Rows closed by external product owner evidence.',
	            sourceFiles: checkboxSourceFiles,
	            unblockRule: 'Do not mark source checkboxes complete from generated inventory alone.',
	            verificationCommand: 'pnpm check:0503-checkbox-manifest'
	          }
	        ]
	      }, null, 'product')
	    } finally {
	      console.log = originalLog
	    }
	    const ownerFilteredActionOutput = JSON.parse(hashCapture.join('\n'))
	    assert(ownerFilteredActionOutput.count === 1, 'self-test should filter owner actions by owner')
	    assert(ownerFilteredActionOutput.ownerFilter === 'product', 'self-test should echo owner filter')
	    assert(ownerFilteredActionOutput.schemaVersion === ownerActionListSchemaVersion, 'self-test should print owner-filtered action list schemaVersion')
	    assert(ownerFilteredActionOutput.actions[0].actionId === 'survey-context', 'self-test should return product owner action')
	    assert(ownerFilteredActionOutput.actions[0].actionDossierCommand === buildActionDossierCommand('survey-context'), 'self-test should keep action dossier command in owner-filtered list-actions output')
	    assert(ownerFilteredActionOutput.actions[0].rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action survey-context', 'self-test should keep raw evidence template command in owner-filtered list-actions output')
	    assert(ownerFilteredActionOutput.actions[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action survey-context', 'self-test should keep submission template command in owner-filtered list-actions output')
	    assert(ownerFilteredActionOutput.actions[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should keep shell-portable strict command in owner-filtered list-actions output')
	    assert(ownerFilteredActionOutput.actions[0].sourceFiles.files[0].sourceFileDossierCommand === buildSourceFileDossierCommand('survey-context', 'prompts/0503/example-survey.md'), 'self-test should keep source-file dossier command in owner-filtered list-actions output')
	    assert(ownerFilteredActionOutput.actions[0].sourceFiles.files[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action survey-context', 'self-test should keep source-file submission template command in owner-filtered list-actions output')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printOwnerSummary({
	        generatedAt: queue.generatedAt,
	        actions: [
	          ...queue.actions,
	          {
	            actionType: 'checkbox-closure-class',
	            closureKind: 'survey-context',
	            count: 2,
	            currentEvidence: '2 open checkbox row(s) classified as survey-context',
	            owner: 'product',
	            requiredEvidence: 'Rows closed by external product owner evidence.',
	            sourceFiles: checkboxSourceFiles,
	            unblockRule: 'Do not mark source checkboxes complete from generated inventory alone.',
	            verificationCommand: 'pnpm check:0503-checkbox-manifest'
	          }
	        ]
	      })
	    } finally {
	      console.log = originalLog
	    }
	    const ownerSummaryOutput = JSON.parse(hashCapture.join('\n'))
	    assert(ownerSummaryOutput.schemaVersion === ownerSummarySchemaVersion, 'self-test should print owner summary schemaVersion')
	    assert(ownerSummaryOutput.totalActionCount === 2, 'self-test should summarize all owner actions')
	    assert(ownerSummaryOutput.ownerCount === 2, 'self-test should summarize owner count')
	    assert(ownerSummaryOutput.owners.find(owner => owner.owner === 'operator')?.closureKindCounts.hardware === 1, 'self-test should count closure kinds by owner')
	    assert(ownerSummaryOutput.owners.find(owner => owner.owner === 'product')?.actions[0].sourceFiles.files[0].file === 'prompts/0503/example-survey.md', 'self-test should expose owner summary source files')
	    assert(ownerSummaryOutput.owners.find(owner => owner.owner === 'product')?.actions[0].sourceFiles.files[0].sourceFileDossierCommand === buildSourceFileDossierCommand('survey-context', 'prompts/0503/example-survey.md'), 'self-test should expose owner summary source-file dossier command')
	    assert(ownerSummaryOutput.owners.find(owner => owner.owner === 'product')?.actions[0].actionDossierCommand.includes('--action survey-context'), 'self-test should expose owner summary action dossier command')
	    assert(ownerSummaryOutput.owners.find(owner => owner.owner === 'product')?.actions[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in owner summary action rows')
	    assert(ownerSummaryOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in owner summary output')
	    assert(ownerSummaryOutput.boundary.includes('Strict completion remains authoritative'), 'self-test should keep owner summary boundary explicit')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printSourceFileDossier({
	        generatedAt: queue.generatedAt,
	        actions: [
	          ...queue.actions,
	          {
	            actionType: 'checkbox-closure-class',
	            closureKind: 'survey-context',
	            count: 2,
	            currentEvidence: '2 open checkbox row(s) classified as survey-context',
	            owner: 'product',
	            requiredEvidence: 'Rows closed by external product owner evidence.',
	            sourceFiles: checkboxSourceFiles,
	            unblockRule: 'Do not mark source checkboxes complete from generated inventory alone.',
	            verificationCommand: 'pnpm check:0503-checkbox-manifest',
	            verificationCommandNote: 'Source-file dossier self-test note must be preserved.'
	          }
	        ]
	      }, 'prompts/0503/example-survey.md', 'survey-context', 'product')
	    } finally {
	      console.log = originalLog
	    }
	    const sourceFileDossierOutput = JSON.parse(hashCapture.join('\n'))
	    assert(sourceFileDossierOutput.schemaVersion === sourceFileDossierQuerySchemaVersion, 'self-test should print source-file dossier schemaVersion')
	    assert(sourceFileDossierOutput.status === 'open-source-file-rows', 'self-test should find source-file dossier rows')
	    assert(sourceFileDossierOutput.rowCount === 1, 'self-test should return one source-file dossier row')
	    assert(sourceFileDossierOutput.rows[0].sourceFileDossierCommand === buildSourceFileDossierCommand('survey-context', 'prompts/0503/example-survey.md'), 'self-test should expose source-file dossier command')
	    assert(sourceFileDossierOutput.rows[0].rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action survey-context', 'self-test should expose source-file raw evidence template command')
	    assert(sourceFileDossierOutput.rows[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action survey-context', 'self-test should expose source-file submission template command')
	    assert(sourceFileDossierOutput.rows[0].verificationCommandNote === 'Source-file dossier self-test note must be preserved.', 'self-test should expose source-file verification command note')
	    assert(sourceFileDossierOutput.boundary.includes('intake helper only'), 'self-test should keep source-file dossier boundary explicit')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printOwnerSummary({
	        generatedAt: queue.generatedAt,
	        actions: [
	          ...queue.actions,
	          {
	            actionType: 'checkbox-closure-class',
	            closureKind: 'survey-context',
	            count: 2,
	            currentEvidence: '2 open checkbox row(s) classified as survey-context',
	            owner: 'product',
	            requiredEvidence: 'Rows closed by external product owner evidence.',
	            sourceFiles: checkboxSourceFiles,
	            unblockRule: 'Do not mark source checkboxes complete from generated inventory alone.',
	            verificationCommand: 'pnpm check:0503-checkbox-manifest'
	          }
	        ]
	      }, 'product')
	    } finally {
	      console.log = originalLog
	    }
	    const ownerFilteredSummaryOutput = JSON.parse(hashCapture.join('\n'))
	    assert(ownerFilteredSummaryOutput.schemaVersion === ownerSummarySchemaVersion, 'self-test should print owner-filtered summary schemaVersion')
	    assert(ownerFilteredSummaryOutput.totalActionCount === 1, 'self-test should summarize one filtered owner action')
	    assert(ownerFilteredSummaryOutput.ownerFilter === 'product', 'self-test should echo owner summary filter')
	    assert(ownerFilteredSummaryOutput.owners[0].actionIds[0] === 'survey-context', 'self-test should expose owner summary action ids')
	    assert(ownerFilteredSummaryOutput.owners[0].actions[0].submissionTemplateCommand.includes('--print-template --action survey-context'), 'self-test should expose owner summary submission template command')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printOwnerLaneCommands(queue, 'operator')
	    } finally {
	      console.log = originalLog
	    }
	    const ownerLaneCommandsOutput = JSON.parse(hashCapture.join('\n'))
	    assert(ownerLaneCommandsOutput.schemaVersion === ownerLaneCommandsSchemaVersion, 'self-test should print owner lane command schemaVersion')
	    assert(ownerLaneCommandsOutput.laneCount === 1, 'self-test should print one filtered owner lane')
	    assert(ownerLaneCommandsOutput.lanes[0].ownerReadinessWithEvidenceDirCommand.includes('--owner-readiness --owner operator --evidence-dir <repo-relative-dir>'), 'self-test should expose owner lane readiness evidence-dir command')
	    assert(ownerLaneCommandsOutput.lanes[0].partialR8DossierCommand.includes('--partial-r8-dossier --owner operator'), 'self-test should expose owner lane partial R8 dossier command')
	    assert(ownerLaneCommandsOutput.lanes[0].coverageJsonCommand.includes('--coverage-json'), 'self-test should expose coverage JSON command')
	    assert(ownerLaneCommandsOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in owner lane command output')
	    assert(ownerLaneCommandsOutput.lanes[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in owner lane rows')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printNextOwnerCommands(queue, {
	        acceptanceStatus: 'not-complete',
	        complete: false,
	        nextOwnerCommands: buildExpectedNextOwnerCommands(queue)
	      }, 'operator')
	    } finally {
	      console.log = originalLog
	    }
	    const nextOwnerCommandsOutput = JSON.parse(hashCapture.join('\n'))
	    assert(nextOwnerCommandsOutput.schemaVersion === nextOwnerCommandsQuerySchemaVersion, 'self-test should print next owner command schemaVersion')
	    assert(nextOwnerCommandsOutput.ownerFilter === 'operator', 'self-test should echo next owner command filter')
	    assert(nextOwnerCommandsOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable next owner strict command')
	    assert(nextOwnerCommandsOutput.owners[0].ownerReadinessCommand.includes('--owner-readiness --owner operator'), 'self-test should expose owner readiness command')
	    assert(nextOwnerCommandsOutput.owners[0].ownerReadinessWithEvidenceDirCommand.includes('--owner-readiness --owner operator --evidence-dir <repo-relative-dir>'), 'self-test should expose owner readiness evidence-dir command')
	    assert(nextOwnerCommandsOutput.owners[0].blockerTaxonomyCommand.includes('--blocker-taxonomy --owner operator'), 'self-test should expose blocker taxonomy command')
	    assert(nextOwnerCommandsOutput.owners[0].partialR8DossierCommand.includes('--partial-r8-dossier --owner operator'), 'self-test should expose owner partial R8 dossier command')
	    assert(nextOwnerCommandsOutput.owners[0].requireCompleteCommand.includes('--require-complete'), 'self-test should expose require-complete command')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printOwnerClosureBundles(queue, {
	        acceptanceStatus: 'not-complete',
	        ownerCount: 1,
	        owners: [
	          {
	            actionCount: 1,
	            actions: [
	              {
	                actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                blockingTaxonomyRowIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	                blockingTaxonomyRows: [
	                  {
	                    category: 'hardware',
	                    currentEvidence: '1 display(s) detected',
	                    id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                    ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                    ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	                    requirementType: 'failed-external-gate',
	                    source: 'external.json',
	                    strictCompletionCommand: 'pnpm check:0503-strict',
	                    verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	                    weightedOpenRows: 1
	                  }
	                ],
	                blockers: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	                closureKind: 'hardware',
	                currentEvidence: '1 display(s) detected',
	                guardsBlocked: ['failedExternalGatesClosed', 'ownerActionQueueClosed'],
	                rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                requiredEvidence: 'A live BrowserWindow second-display placement report.',
	                sourceFiles: {
	                  files: [
	                    {
	                      actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                      count: 1,
	                      file: 'prompts/0503/example-survey.md',
	                      rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                      sourceFileDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --source-file-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY --file prompts/0503/example-survey.md',
	                      submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'
	                    }
	                  ],
	                  omittedFileCount: 0,
	                  totalFileCount: 1
	                },
	                strictCompletionCommand: 'pnpm check:0503-strict',
	                submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                unblockRule: 'Do not close with virtual evidence.',
	                verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	                verificationCommandNote: 'Second-display closure must preserve real BrowserWindow placement evidence.'
	              }
	            ],
	            blockingTaxonomyRowCount: 1,
	            blockingTaxonomyRows: [
	              {
	                category: 'hardware',
	                currentEvidence: '1 display(s) detected',
	                id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	                requirementType: 'failed-external-gate',
	                source: 'external.json',
	                strictCompletionCommand: 'pnpm check:0503-strict',
	                verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	                weightedOpenRows: 1
	              }
	            ],
	            categoryWeightedOpenRows: { hardware: 1 },
	            owner: 'operator',
	            readinessCommand: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner operator',
	            requireCompleteCommand: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --require-complete',
	            summaryCommand: 'pnpm --silent check:0503-owner-evidence -- --owner-summary --owner operator',
	            weightedOpenRows: 1
	          }
	            ],
	            blockingTaxonomyRowCount: 1,
	            blockingTaxonomyRows: [
	              {
	                category: 'hardware',
	                currentEvidence: '1 display(s) detected',
	                id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	                requirementType: 'failed-external-gate',
	                source: 'external.json',
	                strictCompletionCommand: 'pnpm check:0503-strict',
	                verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	                weightedOpenRows: 1
	              }
	            ],
	            categoryWeightedOpenRows: { hardware: 1 },
	            schemaVersion: ownerClosureBundlesSchemaVersion,
	            sourceEvidence: ['queue.json', 'audit.json'],
	            status: 'not-complete',
	            totalActionCount: 1,
	            weightedOpenRows: 1
	      }, 'operator')
	    } finally {
	      console.log = originalLog
	    }
	    const ownerClosureBundlesOutput = JSON.parse(hashCapture.join('\n'))
	    assert(ownerClosureBundlesOutput.schemaVersion === ownerClosureBundlesQuerySchemaVersion, 'self-test should print owner closure bundle query schemaVersion')
	    assert(ownerClosureBundlesOutput.ownerFilter === 'operator', 'self-test should echo owner closure bundle owner filter')
	    assert(ownerClosureBundlesOutput.owners[0].readinessCommand.includes('--owner-readiness --owner operator'), 'self-test should expose owner closure bundle readiness command')
	    assert(ownerClosureBundlesOutput.owners[0].actions[0].actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner closure bundle action ids')
	    assert(ownerClosureBundlesOutput.owners[0].actions[0].verificationCommandNote === 'Second-display closure must preserve real BrowserWindow placement evidence.', 'self-test should expose owner closure bundle action verification notes')
	    assert(ownerClosureBundlesOutput.owners[0].actions[0].sourceFiles.files[0].sourceFileDossierCommand === buildSourceFileDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'prompts/0503/example-survey.md'), 'self-test should expose owner closure bundle source-file dossier commands')
	    assert(ownerClosureBundlesOutput.owners[0].blockingTaxonomyRows[0].id === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner closure bundle taxonomy row ids')
	    assert(ownerClosureBundlesOutput.owners[0].blockingTaxonomyRows[0].actionDossierCommands[0] === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose owner closure bundle taxonomy action dossier command arrays')
	    assert(ownerClosureBundlesOutput.owners[0].blockingTaxonomyRows[0].rawEvidenceTemplateCommands[0] === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner closure bundle taxonomy raw evidence template command arrays')
	    assert(ownerClosureBundlesOutput.owners[0].blockingTaxonomyRows[0].submissionTemplateCommands[0] === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner closure bundle taxonomy submission template command arrays')
	    assert(ownerClosureBundlesOutput.owners[0].blockingTaxonomyRows[0].verificationCommandNote === 'Second-display closure must preserve real BrowserWindow placement evidence.', 'self-test should expose owner closure bundle taxonomy verification notes')
	    assert(ownerClosureBundlesOutput.owners[0].blockingTaxonomyRows[0].verificationCommandNotes[0] === 'Second-display closure must preserve real BrowserWindow placement evidence.', 'self-test should expose owner closure bundle taxonomy verification note arrays')
	    assert(ownerClosureBundlesOutput.owners[0].actions[0].blockingTaxonomyRowIds[0] === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose action-level closure bundle taxonomy row ids')
	    assert(ownerClosureBundlesOutput.owners[0].actions[0].blockingTaxonomyRows[0].actionDossierCommands[0] === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose action-level closure bundle taxonomy action dossier command arrays')
	    assert(ownerClosureBundlesOutput.boundary.includes('execution aids only'), 'self-test should keep owner closure bundle boundary explicit')
	    const matrixActionNote = 'Matrix self-test note must be present in all action-facing owner surfaces.'
	    const matrixQueue = {
	      ...queue,
	      actions: queue.actions.map(action => ({
	        ...action,
	        verificationCommandNote: matrixActionNote
	      }))
	    }
	    const matrixCompletionStatus = {
	      acceptanceStatus: 'not-complete',
	      complete: false,
	      nextOwnerCommands: buildExpectedNextOwnerCommands(matrixQueue)
	    }
	    const matrixAudit = {
	      blockerTaxonomy: {
	        rows: [
	          {
	            category: 'hardware',
	            currentEvidence: '1 display(s) detected',
	            id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	            owner: 'operator',
	            ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	            ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	            requirementType: 'failed-external-gate',
	            source: 'external.json',
	            strictCompletionCommand: 'pnpm check:0503-strict',
	            verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	            weightedOpenRows: 1
	          }
	        ],
	        totalTaxonomyRows: 1,
	        totalWeightedOpenRows: 1
	      },
	      partialR8Dossier: []
	    }
	    const matrixClosureBundles = {
	      acceptanceStatus: 'not-complete',
	      ownerCount: 1,
	      owners: [
	        {
	          actionCount: 1,
	          actions: [
	            {
	              ...ownerClosureBundlesOutput.owners[0].actions[0],
	              blockingTaxonomyRows: ownerClosureBundlesOutput.owners[0].actions[0].blockingTaxonomyRows.map(row => ({
	                ...row,
	                verificationCommandNote: matrixActionNote,
	                verificationCommandNotes: [matrixActionNote]
	              })),
	              recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
	              verificationCommandNote: matrixActionNote
	            }
	          ],
	          blockingTaxonomyRowCount: 1,
	          blockingTaxonomyRows: ownerClosureBundlesOutput.owners[0].blockingTaxonomyRows.map(row => ({
	            ...row,
	            verificationCommandNote: matrixActionNote,
	            verificationCommandNotes: [matrixActionNote]
	          })),
	          categoryWeightedOpenRows: { hardware: 1 },
	          owner: 'operator',
	          readinessCommand: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner operator',
	          requireCompleteCommand: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --require-complete',
	          summaryCommand: 'pnpm --silent check:0503-owner-evidence -- --owner-summary --owner operator',
	          weightedOpenRows: 1
	        }
	      ],
	      recommendedStrictCompletionCommand: shellPortableStrictCompletionCommand,
	      schemaVersion: ownerClosureBundlesSchemaVersion,
	      sourceEvidence: ['queue.json', 'audit.json'],
	      status: 'not-complete',
	      totalActionCount: 1,
	      weightedOpenRows: 1
	    }
	    const outputMatrix = summarizeOwnerOutputMatrix(matrixQueue, matrixCompletionStatus, matrixClosureBundles, matrixAudit, 'operator')
	    assert(outputMatrix.ok, `self-test should accept complete owner output matrix verification note coverage: ${JSON.stringify(outputMatrix.gaps)}`)
	    const ownerSummaryMatrixRow = outputMatrix.results.find(row => row.mode === 'owner-summary')
	    assert(ownerSummaryMatrixRow?.checkedVerificationNoteCount === 1, 'self-test should count owner-summary verification notes')
	    assert(ownerSummaryMatrixRow?.requiredVerificationNoteCount === 1, 'self-test should expose owner-summary required verification note floor')
	    const blockerTaxonomyMatrixRow = outputMatrix.results.find(row => row.mode === 'blocker-taxonomy')
	    assert(blockerTaxonomyMatrixRow?.checkedVerificationNoteCount >= 1, 'self-test should count blocker taxonomy row verification notes')
	    const brokenMatrixClosureBundles = JSON.parse(JSON.stringify(matrixClosureBundles))
	    delete brokenMatrixClosureBundles.owners[0].actions[0].verificationCommandNote
	    const brokenOutputMatrix = summarizeOwnerOutputMatrix(matrixQueue, matrixCompletionStatus, brokenMatrixClosureBundles, matrixAudit, 'operator')
	    assert(!brokenOutputMatrix.ok, 'self-test should reject owner output matrix when action-facing verification notes are missing')
	    assert(brokenOutputMatrix.gaps.some(gap => gap.missing === 'verificationCommandNote' || gap.missing === 'verificationCommandNoteCoverage'), 'self-test should report verification note coverage gaps')
	    const brokenMatrixAudit = JSON.parse(JSON.stringify(matrixAudit))
	    brokenMatrixAudit.blockerTaxonomy.rows[0].verificationCommandNote = 'wrong taxonomy row note'
	    const brokenTaxonomyOutputMatrix = summarizeOwnerOutputMatrix(matrixQueue, matrixCompletionStatus, matrixClosureBundles, brokenMatrixAudit, 'operator')
	    assert(!brokenTaxonomyOutputMatrix.ok, 'self-test should reject owner output matrix when taxonomy row verification notes drift')
	    assert(brokenTaxonomyOutputMatrix.gaps.some(gap => gap.missing === 'verificationCommandNote' && gap.mode === 'blocker-taxonomy'), 'self-test should report blocker taxonomy verification note drift')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printBlockerTaxonomy(queue, {
	        blockerTaxonomy: {
	          rows: [
	            {
	              category: 'hardware',
	              currentEvidence: '1 display(s) detected',
	              id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              owner: 'operator',
	              ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              requirementType: 'failed-external-gate',
	              source: 'r8-external-blockers-current.json',
	              strictCompletionCommand: 'pnpm check:0503-strict',
	              verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	              weightedOpenRows: 1
	            },
	            {
	              category: 'survey-context',
	              currentEvidence: '948 open checkbox row(s) classified as survey-context',
	              id: 'survey-context',
	              owner: 'product',
	              ownerActionId: 'survey-context',
	              requirementType: 'open-checkbox-closure-class',
	              source: '0503-checkbox-manifest.json',
	              strictCompletionCommand: 'pnpm check:0503-strict',
	              verificationCommand: 'pnpm check:0503-checkbox-manifest',
	              weightedOpenRows: 948
	            }
	          ],
	          totalTaxonomyRows: 2,
	          totalWeightedOpenRows: 949
	        }
	      }, 'operator')
	    } finally {
	      console.log = originalLog
	    }
	    const blockerTaxonomyOutput = JSON.parse(hashCapture.join('\n'))
	    assert(blockerTaxonomyOutput.schemaVersion === blockerTaxonomyQuerySchemaVersion, 'self-test should print blocker taxonomy query schemaVersion')
	    assert(blockerTaxonomyOutput.ownerFilter === 'operator', 'self-test should echo blocker taxonomy owner filter')
	    assert(blockerTaxonomyOutput.totalTaxonomyRows === 1, 'self-test should filter blocker taxonomy rows by owner')
	    assert(blockerTaxonomyOutput.categoryWeightedOpenRows.hardware === 1, 'self-test should preserve blocker taxonomy weighted counts')
	    assert(blockerTaxonomyOutput.rows[0].actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose blocker taxonomy action dossier command')
	    assert(blockerTaxonomyOutput.rows[0].rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose blocker taxonomy raw evidence template command')
	    assert(blockerTaxonomyOutput.rows[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose blocker taxonomy submission template command')
	    assert(blockerTaxonomyOutput.rows[0].verificationCommandNote === 'Second-display closure must preserve real BrowserWindow placement evidence.', 'self-test should expose blocker taxonomy verification command note')
	    assert(blockerTaxonomyOutput.rows[0].verificationCommandNotes[0] === 'Second-display closure must preserve real BrowserWindow placement evidence.', 'self-test should expose blocker taxonomy verification command note arrays')
	    assert(blockerTaxonomyOutput.boundary.includes('diagnostic execution aid only'), 'self-test should keep blocker taxonomy boundary explicit')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printOwnerReadiness(queue, {
	        acceptanceStatus: 'not-complete',
	        complete: false,
	        nextOwnerCommands: buildExpectedNextOwnerCommands(queue)
	      }, {
	        acceptanceStatus: 'not-complete',
        ownerCount: 1,
        owners: [
          {
            actionCount: 1,
            actions: [
              {
                actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
                actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
                blockingTaxonomyRowIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
                blockingTaxonomyRows: [
                  {
                    category: 'hardware',
                    currentEvidence: '1 display(s) detected',
                    id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
                    ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
                    ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
                    requirementType: 'failed-external-gate',
                    source: 'r8-external-blockers-current.json',
                    strictCompletionCommand: 'pnpm check:0503-strict',
                    verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
                    weightedOpenRows: 1
                  }
                ],
                blockers: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
                closureKind: 'hardware',
                currentEvidence: '1 display(s) detected',
	                guardsBlocked: ['failedExternalGatesClosed', 'ownerActionQueueClosed'],
	                rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                requiredEvidence: 'A live BrowserWindow second-display placement report.',
	                sourceFiles: {
	                  files: [
	                    {
	                      actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                      count: 1,
	                      file: 'prompts/0503/example-survey.md',
	                      rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                      sourceFileDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --source-file-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY --file prompts/0503/example-survey.md',
	                      submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'
	                    }
	                  ],
	                  omittedFileCount: 0,
	                  totalFileCount: 1
	                },
	                strictCompletionCommand: 'pnpm check:0503-strict',
	                submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                unblockRule: 'Do not close with virtual evidence.',
	                verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json'
	              }
	            ],
            owner: 'operator',
            blockingTaxonomyRowCount: 1,
            blockingTaxonomyRows: [
              {
                category: 'hardware',
                currentEvidence: '1 display(s) detected',
                id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
                ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
                ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
                requirementType: 'failed-external-gate',
                source: 'r8-external-blockers-current.json',
                strictCompletionCommand: 'pnpm check:0503-strict',
                verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
                weightedOpenRows: 1
              }
            ],
            categoryWeightedOpenRows: { hardware: 1 },
            readinessCommand: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner operator',
            requireCompleteCommand: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --require-complete',
            summaryCommand: 'pnpm --silent check:0503-owner-evidence -- --owner-summary --owner operator',
            weightedOpenRows: 1
          }
        ],
	        schemaVersion: ownerClosureBundlesSchemaVersion,
	        sourceEvidence: ['queue.json', 'audit.json'],
	        status: 'not-complete',
	        totalActionCount: 1
	      }, {
	        blockerTaxonomy: {
	          rows: [
	            {
	              category: 'hardware',
	              currentEvidence: '1 display(s) detected',
	              id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              owner: 'operator',
	              ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              requirementType: 'failed-external-gate',
	              source: 'r8-external-blockers-current.json',
	              strictCompletionCommand: 'pnpm check:0503-strict',
	              verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	              weightedOpenRows: 1
	            }
	          ],
	          totalTaxonomyRows: 1,
	          totalWeightedOpenRows: 1
	        }
	      }, 'operator')
	    } finally {
	      console.log = originalLog
	    }
	    const ownerReadinessOutput = JSON.parse(hashCapture.join('\n'))
	    assert(ownerReadinessOutput.schemaVersion === ownerReadinessSchemaVersion, 'self-test should print owner readiness schemaVersion')
	    assert(ownerReadinessOutput.ownerFilter === 'operator', 'self-test should echo owner readiness owner filter')
	    assert(ownerReadinessOutput.blockingActionCount === 1, 'self-test should expose owner readiness top-level blocking action count')
	    assert(ownerReadinessOutput.blockingActions[0].owner === 'operator', 'self-test should expose owner readiness top-level blocking action owner')
	    assert(ownerReadinessOutput.blockingActions[0].actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness top-level blocking action ids')
	    assert(ownerReadinessOutput.blockingTaxonomyRowCount === 1, 'self-test should expose owner readiness top-level taxonomy row count')
	    assert(ownerReadinessOutput.blockingTaxonomyRows[0].id === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness top-level taxonomy row ids')
	    assert(ownerReadinessOutput.blockingTaxonomyRows[0].actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose owner readiness top-level taxonomy action dossier command')
	    assert(ownerReadinessOutput.blockingTaxonomyRows[0].actionDossierCommands[0] === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose owner readiness top-level taxonomy action dossier command arrays')
	    assert(ownerReadinessOutput.blockingTaxonomyRows[0].rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness top-level taxonomy raw evidence template command')
	    assert(ownerReadinessOutput.blockingTaxonomyRows[0].rawEvidenceTemplateCommands[0] === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness top-level taxonomy raw evidence template command arrays')
	    assert(ownerReadinessOutput.blockingTaxonomyRows[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness top-level taxonomy submission template command')
	    assert(ownerReadinessOutput.blockingTaxonomyRows[0].submissionTemplateCommands[0] === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness top-level taxonomy submission template command arrays')
	    assert(ownerReadinessOutput.owners[0].blockingActions[0].actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness blocking action ids')
	    assert(ownerReadinessOutput.owners[0].blockingActions[0].currentEvidence === '1 display(s) detected', 'self-test should expose owner readiness current evidence')
	    assert(ownerReadinessOutput.owners[0].blockingActions[0].evidenceCoverageStatus === 'not-evaluated', 'self-test should keep unevaluated owner readiness action coverage explicit')
	    assert(ownerReadinessOutput.owners[0].blockingActions[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command for owner readiness blocking actions')
	    assert(ownerReadinessOutput.owners[0].blockingTaxonomyRows[0].id === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness taxonomy row ids')
	    assert(ownerReadinessOutput.owners[0].blockingTaxonomyRows[0].actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose owner readiness taxonomy action dossier command')
	    assert(ownerReadinessOutput.owners[0].blockingTaxonomyRows[0].actionDossierCommands[0] === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose owner readiness taxonomy action dossier command arrays')
	    assert(ownerReadinessOutput.owners[0].blockingTaxonomyRows[0].rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness taxonomy raw evidence template command')
	    assert(ownerReadinessOutput.owners[0].blockingTaxonomyRows[0].rawEvidenceTemplateCommands[0] === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness taxonomy raw evidence template command arrays')
	    assert(ownerReadinessOutput.owners[0].blockingTaxonomyRows[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness taxonomy submission template command')
	    assert(ownerReadinessOutput.owners[0].blockingTaxonomyRows[0].submissionTemplateCommands[0] === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose owner readiness taxonomy submission template command arrays')
	    assert(ownerReadinessOutput.owners[0].blockingTaxonomyRows[0].weightedOpenRows === 1, 'self-test should expose owner readiness taxonomy weights')
	    assert(ownerReadinessOutput.owners[0].commands.ownerReadinessCommand.includes('--owner-readiness --owner operator'), 'self-test should expose owner readiness command')
	    assert(ownerReadinessOutput.owners[0].commands.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable owner readiness strict command')
	    assert(ownerReadinessOutput.owners[0].commands.nextEvidenceDirectoryCommand.includes('--owner-readiness --owner operator --evidence-dir <repo-relative-dir>'), 'self-test should expose owner readiness evidence-dir next command')
	    assert(ownerReadinessOutput.owners[0].commands.ownerReadinessWithCoverageArtifactsCommand.includes('--coverage-report <repo-relative-report.md> --coverage-json <repo-relative-report.json>'), 'self-test should expose owner readiness coverage artifact command')
	    assert(ownerReadinessOutput.owners[0].commands.partialR8DossierCommand.includes('--partial-r8-dossier --owner operator'), 'self-test should expose owner readiness partial R8 dossier command')
	    assert(ownerReadinessOutput.owners[0].evidenceCoverageEvaluated === false, 'self-test should keep owner readiness separate from evidence coverage validation')
	    assert(ownerReadinessOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable owner readiness top-level strict command')
	    assert(ownerReadinessOutput.boundary.includes('diagnostic execution aid only'), 'self-test should keep owner readiness boundary explicit')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printPartialR8Dossier(queue, {
	        partialR8Dossier: [
	          {
	            file: 'prompts/0503-2/R8.B/spec-02-port-floating-window.md',
	            nextAction: 'close with real display evidence',
	            ownerActionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	            ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	            ownerActionVerificationCommands: ['pnpm -C devhub check:r8-external-blockers -- --write-report report.json'],
	            sourceEvidencePath: '0503-ledger-verification.json#/strictCompletion/partialRowDetails/0',
	            status: 'partial',
	            strictCompletionCommand: 'pnpm check:0503-strict',
	            verificationCommand: 'pnpm check:0503-ledgers'
	          }
	        ]
	      }, 'operator', 'prompts/0503-2/R8.B/spec-02-port-floating-window.md')
	    } finally {
	      console.log = originalLog
	    }
	    const partialR8DossierOutput = JSON.parse(hashCapture.join('\n'))
	    assert(partialR8DossierOutput.schemaVersion === partialR8DossierQuerySchemaVersion, 'self-test should print partial R8 dossier schemaVersion')
	    assert(partialR8DossierOutput.fileFilter === 'prompts/0503-2/R8.B/spec-02-port-floating-window.md', 'self-test should echo partial R8 dossier file filter')
	    assert(partialR8DossierOutput.rowCount === 1, 'self-test should print one filtered partial R8 dossier row')
	    assert(partialR8DossierOutput.rows[0].partialR8FileDossierCommand.includes('--partial-r8-dossier --file prompts/0503-2/R8.B/spec-02-port-floating-window.md'), 'self-test should expose partial R8 file dossier command')
	    assert(partialR8DossierOutput.rows[0].partialR8OwnerFileDossierCommands[0].includes('--partial-r8-dossier --owner operator --file prompts/0503-2/R8.B/spec-02-port-floating-window.md'), 'self-test should expose owner-scoped partial R8 file dossier command')
	    assert(partialR8DossierOutput.rows[0].actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose partial R8 action dossier command')
	    assert(partialR8DossierOutput.rows[0].actionDossierCommands[0] === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose partial R8 action dossier command arrays')
	    assert(partialR8DossierOutput.rows[0].rawEvidenceTemplateCommand.includes('--print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose partial R8 raw evidence template command')
	    assert(partialR8DossierOutput.rows[0].rawEvidenceTemplateCommands[0].includes('--print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose partial R8 raw evidence template command arrays')
	    assert(partialR8DossierOutput.rows[0].submissionTemplateCommand.includes('--print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose partial R8 submission template command')
	    assert(partialR8DossierOutput.rows[0].submissionTemplateCommands[0].includes('--print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose partial R8 submission template command arrays')
	    assert(partialR8DossierOutput.rows[0].ownerSubmissionTemplateCommands[0].includes('--print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose partial R8 submission template commands')
	    assert(partialR8DossierOutput.rows[0].ownerRawEvidenceTemplateCommands[0].includes('--print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose partial R8 raw evidence template commands')
	    assert(partialR8DossierOutput.rows[0].linkedOwnerActions[0].submissionTemplateCommand.includes('--print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should enrich linked owner actions with submission template command')
	    assert(partialR8DossierOutput.rows[0].linkedOwnerActions[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in partial R8 linked owner actions')
	    assert(partialR8DossierOutput.rows[0].ownerReadinessWithEvidenceDirCommands[0].includes('--owner-readiness --owner operator --evidence-dir <repo-relative-dir>'), 'self-test should expose partial R8 readiness evidence-dir command')
	    assert(partialR8DossierOutput.boundary.includes('diagnostic map only'), 'self-test should keep partial R8 dossier boundary explicit')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printPartialR8Dossier(queue, {
	        partialR8Dossier: [
	          {
	            file: 'prompts/0503-2/R8.B/spec-02-port-floating-window.md',
	            nextAction: 'close with real display evidence',
	            ownerActionDossierCommands: ['pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	            ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	            ownerActionVerificationCommands: ['pnpm -C devhub check:r8-external-blockers -- --write-report report.json'],
	            sourceEvidencePath: '0503-ledger-verification.json#/strictCompletion/partialRowDetails/0',
	            status: 'partial',
	            strictCompletionCommand: 'pnpm check:0503-strict',
	            verificationCommand: 'pnpm check:0503-ledgers'
	          }
	        ]
	      }, 'legal-product')
	    } finally {
	      console.log = originalLog
	    }
	    const emptyOwnerPartialR8DossierOutput = JSON.parse(hashCapture.join('\n'))
	    assert(emptyOwnerPartialR8DossierOutput.ownerFilter === 'legal-product', 'self-test should echo empty-owner partial R8 dossier owner filter')
	    assert(emptyOwnerPartialR8DossierOutput.rowCount === 0, 'self-test should return zero rows for owners without partial R8 rows')
	    assert(emptyOwnerPartialR8DossierOutput.status === 'no-partial-r8-rows', 'self-test should return no-partial-r8-rows status for owners without partial R8 rows')
	    assert(emptyOwnerPartialR8DossierOutput.totalLinkedOwnerActions === 0, 'self-test should return zero linked actions for empty-owner partial R8 dossier')
	    assert(emptyOwnerPartialR8DossierOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should keep strict rerun command on empty-owner partial R8 dossier')
	    hashCapture.length = 0
	    try {
	      console.log = value => hashCapture.push(value)
	      printOwnerActionDossier(queue, 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY')
	    } finally {
	      console.log = originalLog
	    }
	    const ownerActionDossierOutput = JSON.parse(hashCapture.join('\n'))
	    assert(ownerActionDossierOutput.schemaVersion === ownerActionDossierSchemaVersion, 'self-test should print owner action dossier schemaVersion')
	    assert(ownerActionDossierOutput.actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose top-level owner action dossier command')
	    assert(ownerActionDossierOutput.action.actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should print selected owner action dossier')
	    assert(ownerActionDossierOutput.action.actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose action dossier command in owner action dossier action payload')
	    assert(ownerActionDossierOutput.action.rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose raw evidence template command in owner action dossier action payload')
	    assert(ownerActionDossierOutput.action.submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose submission template command in owner action dossier action payload')
	    assert(ownerActionDossierOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in owner action dossier')
	    assert(ownerActionDossierOutput.action.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in owner action dossier action payload')
	    assert(ownerActionDossierOutput.rawEvidenceTemplate.actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should include raw evidence template in dossier')
	    assert(ownerActionDossierOutput.submissionTemplate.templateOnly, 'self-test should include non-passable submission template in dossier')
	    const serviceActionDossierOutput = buildOwnerActionDossier({
	      generatedAt: '2026-05-19T00:00:00.000Z',
	      ownerLaneCommands: [{ owner: 'operator' }],
	      actions: [
	        {
	          actionType: 'external-gate',
	          closureKind: 'privilege',
	          currentEvidence: 'devhub-watchdog is not installed',
	          gateId: 'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED',
	          owner: 'operator',
	          requiredEvidence: 'Get-Service/sc.exe report devhub-watchdog installed with a real service status and scExitCode=0.',
	          unblockRule: 'Do not close from installer dry-run output or service name assumptions.',
	          verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	          verificationCommandNote: buildWindowsServiceVerificationCommandNote()
	        }
	      ]
	    }, 'R8C_SPEC17_WINDOWS_SERVICE_INSTALLED')
	    assert(serviceActionDossierOutput.action.verificationCommandNote === buildWindowsServiceVerificationCommandNote(), 'self-test should expose Windows Service verification note in owner action dossier action payload')
	    assert(serviceActionDossierOutput.rawEvidenceTemplate.verificationCommandNote === buildWindowsServiceVerificationCommandNote(), 'self-test should expose Windows Service verification note in owner action dossier raw evidence template')
	    assert(serviceActionDossierOutput.submissionTemplate.verificationCommandNote === buildWindowsServiceVerificationCommandNote(), 'self-test should expose Windows Service verification note in owner action dossier submission template')
	    const submissionsDir = join(root, 'submissions')
	    mkdirSync(submissionsDir)
	    const secondDisplaySubmissionPath = join(submissionsDir, 'second-display.json')
	    writeFileSync(secondDisplaySubmissionPath, JSON.stringify({
	      schemaVersion: ownerEvidenceSubmissionSchemaVersion,
		      owner: 'operator',
		      actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
		      evidenceFilePath: 'evidence.txt',
		      ...evidenceSubmissionMetadata(evidenceText),
		      evidenceSha256: sha256(evidenceText),
	      hashAlgorithm: 'sha256',
	      verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	      resultSummary: 'pass: screens=2 from real Windows display enumeration',
	      evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	      approverOrOperatorIdentity: 'DOMAIN\\operator',
	      boundaryStatement: 'strict completion must still pass before closure'
	    }, null, 2))
	    utimesSync(secondDisplaySubmissionPath, evidenceMtime, evidenceMtime)
	    const directorySummaries = validateEvidenceDirectory(root, queue, 'submissions', {
	      now: new Date('2026-05-19T00:01:00.000Z'),
	      repoRoot: root
	    })
	    assert(directorySummaries.length === 1, 'self-test should validate one owner evidence directory submission')
	    assert(directorySummaries[0].submissionFilePath === 'submissions/second-display.json', 'self-test should include submission file path in directory summary')
	    assert(directorySummaries[0].unknownSubmissionFields.length === 0, 'self-test should keep directory summaries free of unknown submission fields')
	    const completeCoverage = summarizeEvidenceDirectoryCoverage(queue, directorySummaries, true)
	    assert(completeCoverage.complete, 'self-test should mark the one-action evidence directory complete')
	    assert(completeCoverage.submittedByOwner.operator?.includes('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should group submitted evidence by owner')
	    const coverageReportPath = writeCoverageReport(root, 'reports/operator-coverage.md', completeCoverage, directorySummaries, new Date('2026-05-19T00:02:00.000Z'))
	    const coverageReportText = readText(join(root, coverageReportPath))
	    assert(coverageReportText.includes('0503 Owner Evidence Coverage Report'), 'self-test should write coverage report title')
	    assert(coverageReportText.includes('This report is not completion evidence'), 'self-test should keep coverage report boundary explicit')
	    assert(coverageReportText.includes(shellPortableStrictCompletionCommand), 'self-test should include shell-portable strict command in coverage report')
	    assert(coverageReportText.includes('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should include submitted action in coverage report')
	    assert(coverageReportText.includes(evidenceMtime.toISOString()), 'self-test should include evidence mtime in coverage report')
	    assert(coverageReportText.includes('sha256'), 'self-test should include evidence hash algorithm in coverage report')
	    assert(coverageReportText.includes(String(Buffer.byteLength(evidenceText))), 'self-test should include evidence file size in coverage report')
	    assert(!coverageReportText.includes('operatorNote'), 'self-test should not include rejected unknown fields in coverage report')
	    const coverageJsonPath = writeCoverageJsonReport(root, 'reports/operator-coverage.json', completeCoverage, directorySummaries, new Date('2026-05-19T00:02:00.000Z'))
	    const directoryValidationOutput = buildOwnerEvidenceDirectoryValidationOutput(directorySummaries, completeCoverage, coverageReportPath, coverageJsonPath)
	    assert(directoryValidationOutput.schemaVersion === ownerEvidenceDirectoryValidationSchemaVersion, 'self-test should build owner evidence directory validation schemaVersion')
	    assert(directoryValidationOutput.count === 1, 'self-test should expose owner evidence directory validation submission count')
	    assert(directoryValidationOutput.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should expose shell-portable strict command in owner evidence directory validation output')
	    assert(directoryValidationOutput.boundary.includes('does not close evidence'), 'self-test should keep owner evidence directory validation boundary explicit')
	    const coverageJson = readJson(join(root, coverageJsonPath))
	    assert(coverageJson.schemaVersion === ownerEvidenceCoverageReportSchemaVersion, 'self-test should write coverage JSON schemaVersion')
	    assert(coverageJson.boundary.strictCompletionStillRequired, 'self-test should keep coverage JSON boundary explicit')
	    assert(coverageJson.boundary.recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should write shell-portable strict command into coverage JSON boundary')
	    assert(coverageJson.submissions[0].actionId === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should include submitted action in coverage JSON')
	    assert(coverageJson.submissions[0].evidenceModifiedAt === evidenceMtime.toISOString(), 'self-test should include evidence mtime in coverage JSON')
	    assert(coverageJson.submissions[0].hashAlgorithm === 'sha256', 'self-test should include evidence hash algorithm in coverage JSON')
	    assert(coverageJson.submissions[0].evidenceSizeBytes === Buffer.byteLength(evidenceText), 'self-test should include evidence file size in coverage JSON')
	    assert(coverageJson.submissions[0].recommendedStrictCompletionCommand === shellPortableStrictCompletionCommand, 'self-test should write shell-portable strict command into coverage JSON submissions')
	    assert(coverageJson.submissions[0].unknownSubmissionFields.length === 0, 'self-test should keep coverage JSON free of unknown submission fields')
	    const readinessWithCoverage = summarizeOwnerReadiness(queue, {
	      acceptanceStatus: 'not-complete',
	      complete: false,
	      nextOwnerCommands: buildExpectedNextOwnerCommands(queue)
	    }, {
	      acceptanceStatus: 'not-complete',
	      ownerCount: 1,
	      owners: [
	        {
	          actionCount: 1,
	          actions: [
	            {
	              actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              blockingTaxonomyRowIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	              blockingTaxonomyRows: [
	                {
	                  category: 'hardware',
	                  currentEvidence: '1 display(s) detected',
	                  id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                  ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                  ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	                  requirementType: 'failed-external-gate',
	                  source: 'r8-external-blockers-current.json',
	                  strictCompletionCommand: 'pnpm check:0503-strict',
	                  verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	                  weightedOpenRows: 1
	                }
	              ],
	              blockers: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	              closureKind: 'hardware',
	              currentEvidence: '1 display(s) detected',
	              guardsBlocked: ['failedExternalGatesClosed', 'ownerActionQueueClosed'],
	              rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              requiredEvidence: 'A live BrowserWindow second-display placement report.',
	              sourceFiles: {
	                files: [
	                  {
	                    actionDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                    count: 1,
	                    file: 'prompts/0503/example-survey.md',
	                    rawEvidenceTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	                    sourceFileDossierCommand: 'pnpm --silent check:0503-owner-evidence -- --source-file-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY --file prompts/0503/example-survey.md',
	                    submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY'
	                  }
	                ],
	                omittedFileCount: 0,
	                totalFileCount: 1
	              },
	              strictCompletionCommand: 'pnpm check:0503-strict',
	              submissionTemplateCommand: 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              unblockRule: 'Do not close with virtual evidence.',
	              verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json'
	            }
	          ],
	          owner: 'operator',
	          blockingTaxonomyRowCount: 1,
	          blockingTaxonomyRows: [
	            {
	              category: 'hardware',
	              currentEvidence: '1 display(s) detected',
	              id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	              ownerActionIds: ['ASSERT_BROWSERWINDOW_SECOND_DISPLAY'],
	              requirementType: 'failed-external-gate',
	              source: 'r8-external-blockers-current.json',
	              strictCompletionCommand: 'pnpm check:0503-strict',
	              verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	              weightedOpenRows: 1
	            }
	          ],
	          categoryWeightedOpenRows: { hardware: 1 },
	          readinessCommand: 'pnpm check:0503-owner-evidence -- --owner-readiness --owner operator',
	          requireCompleteCommand: 'pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner operator --require-complete',
	          summaryCommand: 'pnpm --silent check:0503-owner-evidence -- --owner-summary --owner operator',
	          weightedOpenRows: 1
	        }
	      ],
	      schemaVersion: ownerClosureBundlesSchemaVersion,
	      sourceEvidence: ['queue.json', 'audit.json'],
	      status: 'not-complete',
	      totalActionCount: 1
	    }, {
	      blockerTaxonomy: {
	        rows: [
	          {
	            category: 'hardware',
	            currentEvidence: '1 display(s) detected',
	            id: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	            owner: 'operator',
	            ownerActionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	            requirementType: 'failed-external-gate',
	            source: 'r8-external-blockers-current.json',
	            strictCompletionCommand: 'pnpm check:0503-strict',
	            verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	            weightedOpenRows: 1
	          }
	        ],
	        totalTaxonomyRows: 1,
	        totalWeightedOpenRows: 1
	      }
	    }, 'operator', completeCoverage, {
	      coverageJsonPath,
	      coverageReportPath,
	      evidenceDirPath: 'submissions',
	      submissionCount: directorySummaries.length
	    })
	    assert(readinessWithCoverage.evidenceCoverageEvaluated === true, 'self-test should let owner readiness evaluate evidence directory coverage')
	    assert(readinessWithCoverage.coverageArtifacts.coverageJsonPath === coverageJsonPath, 'self-test should include readiness coverage JSON path')
	    assert(readinessWithCoverage.owners[0].commands.nextEvidenceDirectoryCommand.includes('--evidence-dir <repo-relative-dir>'), 'self-test should preserve readiness evidence-dir command when coverage is evaluated')
	    assert(readinessWithCoverage.blockingActionCount === 1, 'self-test should expose covered owner readiness top-level blocking action count')
	    assert(readinessWithCoverage.blockingActions[0].owner === 'operator', 'self-test should expose covered owner readiness top-level action owner')
	    assert(readinessWithCoverage.blockingActions[0].evidenceCoverageStatus === 'submitted', 'self-test should mark submitted top-level owner readiness actions')
	    assert(readinessWithCoverage.blockingTaxonomyRowCount === 1, 'self-test should expose covered owner readiness top-level taxonomy row count')
	    assert(readinessWithCoverage.blockingTaxonomyRows[0].id === 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose covered owner readiness top-level taxonomy ids')
	    assert(readinessWithCoverage.blockingTaxonomyRows[0].actionDossierCommand === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose covered owner readiness taxonomy action dossier command')
	    assert(readinessWithCoverage.blockingTaxonomyRows[0].actionDossierCommands[0] === buildActionDossierCommand('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should expose covered owner readiness taxonomy action dossier command arrays')
	    assert(readinessWithCoverage.blockingTaxonomyRows[0].rawEvidenceTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose covered owner readiness taxonomy raw evidence template command')
	    assert(readinessWithCoverage.blockingTaxonomyRows[0].rawEvidenceTemplateCommands[0] === 'pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose covered owner readiness taxonomy raw evidence template command arrays')
	    assert(readinessWithCoverage.blockingTaxonomyRows[0].submissionTemplateCommand === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose covered owner readiness taxonomy submission template command')
	    assert(readinessWithCoverage.blockingTaxonomyRows[0].submissionTemplateCommands[0] === 'pnpm --silent check:0503-owner-evidence -- --print-template --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY', 'self-test should expose covered owner readiness taxonomy submission template command arrays')
	    assert(readinessWithCoverage.owners[0].blockingActions[0].evidenceCoverageStatus === 'submitted', 'self-test should mark submitted owner readiness actions')
	    assert(readinessWithCoverage.owners[0].evidenceCoverage.complete === true, 'self-test should include owner readiness coverage status')
	    assert(readinessWithCoverage.owners[0].readinessStatus === 'owner-evidence-covered-strict-still-required', 'self-test should keep strict completion required after readiness coverage')
	    const mixedOwnerCoverage = summarizeEvidenceDirectoryCoverageForOwner({
	      generatedAt: queue.generatedAt,
	      actions: [
	        ...queue.actions,
	        {
	          actionType: 'checkbox-closure-class',
	          closureKind: 'survey-context',
	          count: 2,
	          currentEvidence: '2 open checkbox row(s) classified as survey-context',
	          owner: 'product',
	          requiredEvidence: 'Rows closed by external product owner evidence.',
	          sourceFiles: checkboxSourceFiles,
	          unblockRule: 'Do not mark source checkboxes complete from generated inventory alone.',
	          verificationCommand: 'pnpm check:0503-checkbox-manifest'
	        }
	      ]
	    }, directorySummaries, true, 'operator')
	    assert(mixedOwnerCoverage.complete, 'self-test should allow owner-scoped complete coverage')
	    assert(mixedOwnerCoverage.ownerFilter === 'operator', 'self-test should echo coverage owner filter')
	    let incompleteCoverageRejected = false
	    const twoActionQueue = {
	      generatedAt: queue.generatedAt,
	      actions: [
	        ...queue.actions,
	        {
	          closureKind: 'network-capture',
	          currentEvidence: 'pktmon capture not provided',
	          gateId: 'H1_J16_ZERO_EGRESS_CAPTURE_READY',
	          owner: 'operator',
	          requiredEvidence: 'A live pktmon zero-egress capture.',
	          unblockRule: 'Do not close from preflight alone.',
	          verificationCommand: 'pnpm -C devhub check:zero-egress-capture'
	        }
	      ]
	    }
	    const incompleteCoverage = summarizeEvidenceDirectoryCoverage(twoActionQueue, directorySummaries, false)
	    assert(incompleteCoverage.missingByOwner.operator?.includes('H1_J16_ZERO_EGRESS_CAPTURE_READY'), 'self-test should group missing actionIds by owner')
	    try {
	      summarizeEvidenceDirectoryCoverage(twoActionQueue, directorySummaries, true)
	    } catch (error) {
	      incompleteCoverageRejected = String(error.message).includes('owner evidence directory is incomplete')
	    }
	    assert(incompleteCoverageRejected, 'self-test should reject require-complete evidence directories with missing actionIds')
	    writeFileSync(join(submissionsDir, 'second-display-copy.json'), readText(join(submissionsDir, 'second-display.json')))
	    let duplicateDirectorySubmissionRejected = false
	    try {
	      validateEvidenceDirectory(root, queue, 'submissions', {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      duplicateDirectorySubmissionRejected = String(error.message).includes('duplicate owner evidence submission')
	    }
	    assert(duplicateDirectorySubmissionRejected, 'self-test should reject duplicate actionIds in owner evidence directories')
	    let selfReferentialEvidenceRejected = false
	    const selfReferenceSubmissionPath = join(submissionsDir, 'self-reference.json')
	    const selfReferenceRelativePath = 'submissions/self-reference.json'
	    writeFileSync(selfReferenceSubmissionPath, JSON.stringify({
	      schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	      owner: 'operator',
	      actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	      evidenceFilePath: selfReferenceRelativePath,
	      evidenceSha256: sha256('{}'),
	      hashAlgorithm: 'sha256',
	      verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	      resultSummary: 'pass: screens=2 from real Windows display enumeration',
	      evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	      approverOrOperatorIdentity: 'DOMAIN\\operator',
	      boundaryStatement: 'strict completion must still pass before closure'
	    }, null, 2))
	    utimesSync(selfReferenceSubmissionPath, evidenceMtime, evidenceMtime)
	    try {
	      validateSubmission(readJson(selfReferenceSubmissionPath), queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root,
	        submissionRelativePath: selfReferenceRelativePath
	      })
	    } catch (error) {
	      selfReferentialEvidenceRejected = String(error.message).includes('submission JSON itself')
	    }
	    assert(selfReferentialEvidenceRejected, 'self-test should reject evidence paths that point at the submission JSON itself')
	    let gateIdAliasRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'operator',
	        gateId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	        evidenceFilePath: 'evidence.txt',
	        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      gateIdAliasRejected = String(error.message).includes('actionId') || String(error.message).includes('unknown field(s): gateId')
	    }
	    assert(gateIdAliasRejected, 'self-test should require canonical actionId instead of gateId aliases')
	    let templateOnlySubmissionRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        templateOnly: true,
			        owner: 'operator',
			        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
			        evidenceFilePath: 'evidence.txt',
			        ...evidenceSubmissionMetadata(evidenceText),
			        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      templateOnlySubmissionRejected = String(error.message).includes('templateOnly')
	    }
	    assert(templateOnlySubmissionRejected, 'self-test should reject templateOnly submission files')
	    const templateOnlyDirectoryCoverage = summarizeEvidenceDirectoryValidationError(queue, 'template-submissions', new Error('owner evidence submission must not be a templateOnly document'), 'operator')
	    assert(templateOnlyDirectoryCoverage.validationStatus === 'invalid-evidence-directory', 'self-test should convert templateOnly evidence-dir validation into invalid coverage status')
	    assert(templateOnlyDirectoryCoverage.validationError.includes('templateOnly'), 'self-test should preserve templateOnly validation error in owner readiness coverage')
	    assert(templateOnlyDirectoryCoverage.missingByOwner.operator.includes('ASSERT_BROWSERWINDOW_SECOND_DISPLAY'), 'self-test should keep all owner actions missing when evidence-dir validation fails')
	    const templateOnlyCoverageMarkdown = renderEvidenceCoverageMarkdown(templateOnlyDirectoryCoverage, [], new Date('2026-05-19T00:02:00.000Z'))
	    assert(templateOnlyCoverageMarkdown.includes('invalid-evidence-directory'), 'self-test should render invalid evidence-dir status in coverage Markdown')
	    assert(templateOnlyCoverageMarkdown.includes('templateOnly'), 'self-test should render templateOnly validation error in coverage Markdown')
	    const invalidCoverageReportPath = writeCoverageReport(root, 'reports/template-only-coverage.md', templateOnlyDirectoryCoverage, [], new Date('2026-05-19T00:02:00.000Z'))
	    const invalidCoverageReportText = readText(join(root, invalidCoverageReportPath))
	    assert(invalidCoverageReportText.includes('Validation status: invalid-evidence-directory'), 'self-test should write invalid evidence-dir status into coverage report')
	    assert(invalidCoverageReportText.includes('templateOnly'), 'self-test should write templateOnly validation error into coverage report')
	    const invalidCoverageJsonPath = writeCoverageJsonReport(root, 'reports/template-only-coverage.json', templateOnlyDirectoryCoverage, [], new Date('2026-05-19T00:02:00.000Z'))
	    const invalidCoverageJson = readJson(join(root, invalidCoverageJsonPath))
	    assert(invalidCoverageJson.coverage.validationStatus === 'invalid-evidence-directory', 'self-test should write invalid evidence-dir status into coverage JSON')
	    assert(invalidCoverageJson.coverage.validationError.includes('templateOnly'), 'self-test should write templateOnly validation error into coverage JSON')
	    const mixedOwnerTemplateCoverage = summarizeEvidenceDirectoryValidationError({
	      generatedAt: queue.generatedAt,
	      actions: queue.actions
	    }, 'template-submissions', new Error('owner evidence submission must not be a templateOnly document'), 'operator')
	    assert(mixedOwnerTemplateCoverage.totalActionCount === 1, 'self-test should keep invalid evidence-dir coverage scoped to the owner filter')
	    assert(Object.keys(mixedOwnerTemplateCoverage.missingByOwner).join(',') === 'operator', 'self-test should not mix other owners into owner-scoped invalid coverage')
	    let missingSchemaVersionRejected = false
	    try {
	      validateSubmission({
			        owner: 'operator',
			        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
			        evidenceFilePath: 'evidence.txt',
			        ...evidenceSubmissionMetadata(evidenceText),
			        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      missingSchemaVersionRejected = String(error.message).includes('schemaVersion')
	    }
	    assert(missingSchemaVersionRejected, 'self-test should reject missing owner evidence submission schemaVersion')
	    let wrongSchemaVersionRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: 'devhub-0503-owner-evidence-submission-v0',
		        owner: 'operator',
		        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
		        evidenceFilePath: 'evidence.txt',
		        ...evidenceSubmissionMetadata(evidenceText),
		        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      wrongSchemaVersionRejected = String(error.message).includes(ownerEvidenceSubmissionSchemaVersion)
		    }
		    assert(wrongSchemaVersionRejected, 'self-test should reject wrong owner evidence submission schemaVersion')
		    let missingHashAlgorithmRejected = false
		    try {
		      validateSubmission({
		        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
		        owner: 'operator',
		        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
		        evidenceFilePath: 'evidence.txt',
		        ...evidenceSubmissionMetadata(evidenceText),
		        evidenceSha256: sha256(evidenceText),
		        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
		        resultSummary: 'pass: screens=2 from real Windows display enumeration',
		        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
		        approverOrOperatorIdentity: 'DOMAIN\\operator',
		        boundaryStatement: 'strict completion must still pass before closure'
		      }, queue, {
		        now: new Date('2026-05-19T00:01:00.000Z'),
		        repoRoot: root
		      })
		    } catch (error) {
		      missingHashAlgorithmRejected = String(error.message).includes('hashAlgorithm')
		    }
		    assert(missingHashAlgorithmRejected, 'self-test should reject missing owner evidence submission hashAlgorithm')
		    let wrongHashAlgorithmRejected = false
		    try {
		      validateSubmission({
		        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
		        owner: 'operator',
		        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
		        evidenceFilePath: 'evidence.txt',
		        ...evidenceSubmissionMetadata(evidenceText),
		        evidenceSha256: sha256(evidenceText),
		        hashAlgorithm: 'sha1',
		        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
		        resultSummary: 'pass: screens=2 from real Windows display enumeration',
		        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
		        approverOrOperatorIdentity: 'DOMAIN\\operator',
		        boundaryStatement: 'strict completion must still pass before closure'
		      }, queue, {
		        now: new Date('2026-05-19T00:01:00.000Z'),
		        repoRoot: root
		      })
		    } catch (error) {
		      wrongHashAlgorithmRejected = String(error.message).includes('hashAlgorithm must be sha256')
		    }
		    assert(wrongHashAlgorithmRejected, 'self-test should reject wrong owner evidence submission hashAlgorithm')
		    let missingEvidenceModifiedAtRejected = false
		    try {
		      validateSubmission({
		        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
		        owner: 'operator',
		        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
		        evidenceFilePath: 'evidence.txt',
		        evidenceSizeBytes: Buffer.byteLength(evidenceText),
		        evidenceSha256: sha256(evidenceText),
		        hashAlgorithm: 'sha256',
		        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
		        resultSummary: 'pass: screens=2 from real Windows display enumeration',
		        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
		        approverOrOperatorIdentity: 'DOMAIN\\operator',
		        boundaryStatement: 'strict completion must still pass before closure'
		      }, queue, {
		        now: new Date('2026-05-19T00:01:00.000Z'),
		        repoRoot: root
		      })
		    } catch (error) {
		      missingEvidenceModifiedAtRejected = String(error.message).includes('evidenceModifiedAt')
		    }
		    assert(missingEvidenceModifiedAtRejected, 'self-test should reject missing owner evidence submission evidenceModifiedAt')
		    let wrongEvidenceModifiedAtRejected = false
		    try {
		      validateSubmission({
		        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
		        owner: 'operator',
		        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
		        evidenceFilePath: 'evidence.txt',
		        evidenceModifiedAt: '2026-05-19T00:00:31.000Z',
		        evidenceSizeBytes: Buffer.byteLength(evidenceText),
		        evidenceSha256: sha256(evidenceText),
		        hashAlgorithm: 'sha256',
		        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
		        resultSummary: 'pass: screens=2 from real Windows display enumeration',
		        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
		        approverOrOperatorIdentity: 'DOMAIN\\operator',
		        boundaryStatement: 'strict completion must still pass before closure'
		      }, queue, {
		        now: new Date('2026-05-19T00:01:00.000Z'),
		        repoRoot: root
		      })
		    } catch (error) {
		      wrongEvidenceModifiedAtRejected = String(error.message).includes('evidenceModifiedAt mismatch')
		    }
		    assert(wrongEvidenceModifiedAtRejected, 'self-test should reject mismatched owner evidence submission evidenceModifiedAt')
		    let wrongEvidenceSizeRejected = false
		    try {
		      validateSubmission({
		        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
		        owner: 'operator',
		        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
		        evidenceFilePath: 'evidence.txt',
		        evidenceModifiedAt: evidenceMtime.toISOString(),
		        evidenceSizeBytes: Buffer.byteLength(evidenceText) + 1,
		        evidenceSha256: sha256(evidenceText),
		        hashAlgorithm: 'sha256',
		        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
		        resultSummary: 'pass: screens=2 from real Windows display enumeration',
		        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
		        approverOrOperatorIdentity: 'DOMAIN\\operator',
		        boundaryStatement: 'strict completion must still pass before closure'
		      }, queue, {
		        now: new Date('2026-05-19T00:01:00.000Z'),
		        repoRoot: root
		      })
		    } catch (error) {
		      wrongEvidenceSizeRejected = String(error.message).includes('evidenceSizeBytes mismatch')
		    }
		    assert(wrongEvidenceSizeRejected, 'self-test should reject mismatched owner evidence submission evidenceSizeBytes')
		    let traversalRejected = false
	    try {
	      printEvidenceHash(root, '../outside.txt')
    } catch (error) {
      traversalRejected = String(error.message).includes('parent traversal')
    }
	    assert(traversalRejected, 'self-test should reject parent traversal paths')
	    let duplicateRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
		        owner: 'operator',
		        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
		        evidenceFilePath: 'evidence.txt',
		        ...evidenceSubmissionMetadata(evidenceText),
		        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
        resultSummary: 'pass: screens=2 from real Windows display enumeration',
        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
        approverOrOperatorIdentity: 'DOMAIN\\operator',
        boundaryStatement: 'strict completion must still pass before closure'
	      }, {
	        generatedAt: '2026-05-19T00:00:00.000Z',
	        actions: [
	          ...queue.actions,
	          {
	            closureKind: 'hardware',
	            currentEvidence: 'physical unplug/replug not verified',
	            gateId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	            owner: 'operator',
	            requiredEvidence: 'A live monitor unplug/replug trace.',
	            unblockRule: 'Do not close with static enumeration.',
	            verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json'
	          }
	        ]
	      }, {
        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      duplicateRejected = String(error.message).includes('duplicate owner action identifier')
	    }
	    assert(duplicateRejected, 'self-test should reject duplicate queue action identifiers')
	    let commandMismatchRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'operator',
	        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	        evidenceFilePath: 'evidence.txt',
	        ...evidenceSubmissionMetadata(evidenceText),
	        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm check:0503-checkbox-manifest',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      commandMismatchRejected = String(error.message).includes('verificationCommand mismatch')
	    }
	    assert(commandMismatchRejected, 'self-test should reject verificationCommand mismatches')
	    const staleEvidencePath = join(root, 'stale-evidence.txt')
	    writeFileSync(staleEvidencePath, evidenceText)
	    const staleEvidenceMtime = new Date('2026-05-18T23:58:00.000Z')
	    utimesSync(staleEvidencePath, staleEvidenceMtime, staleEvidenceMtime)
	    let staleEvidenceFileRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'operator',
	        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	        evidenceFilePath: 'stale-evidence.txt',
	        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      staleEvidenceFileRejected = String(error.message).includes('evidence file mtime predates owner action queue')
	    }
	    assert(staleEvidenceFileRejected, 'self-test should reject evidence files older than the current owner action queue')
	    let staleTimestampRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'operator',
	        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	        evidenceFilePath: 'evidence.txt',
	        ...evidenceSubmissionMetadata(evidenceText),
	        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-18T23:58:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'strict completion must still pass before closure'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      staleTimestampRejected = String(error.message).includes('predates owner action queue')
	    }
	    assert(staleTimestampRejected, 'self-test should reject stale owner evidence timestamps')
	    let boundaryClaimRejected = false
	    try {
	      validateSubmission({
	        schemaVersion: ownerEvidenceSubmissionSchemaVersion,
	        owner: 'operator',
	        actionId: 'ASSERT_BROWSERWINDOW_SECOND_DISPLAY',
	        evidenceFilePath: 'evidence.txt',
	        ...evidenceSubmissionMetadata(evidenceText),
	        evidenceSha256: sha256(evidenceText),
	        hashAlgorithm: 'sha256',
	        verificationCommand: 'pnpm -C devhub check:r8-external-blockers -- --write-report report.json',
	        resultSummary: 'pass: screens=2 from real Windows display enumeration',
	        evidenceTimestamp: '2026-05-19T00:00:00.000Z',
	        approverOrOperatorIdentity: 'DOMAIN\\operator',
	        boundaryStatement: 'completed with no remaining blockers'
	      }, queue, {
	        now: new Date('2026-05-19T00:01:00.000Z'),
	        repoRoot: root
	      })
	    } catch (error) {
	      boundaryClaimRejected = String(error.message).includes('must not claim completion')
	    }
	    assert(boundaryClaimRejected, 'self-test should reject completion claims in boundaryStatement')
	    console.log('0503 owner evidence verifier self-test passed.')
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.selfTest) {
    runSelfTest()
    return
  }
  if (args.printTemplate) {
	    printTemplate(args.actionFilter ? readJson(ownerActionQueueJsonPath) : null, args.actionFilter)
	    return
	  }
  if (args.actionDossier) {
    assertNonEmptyString(args.actionFilter, 'argument --action for --action-dossier')
    printOwnerActionDossier(readJson(ownerActionQueueJsonPath), args.actionFilter)
    return
  }
  if (args.printTemplateDirPath !== null) {
    const result = writeSubmissionTemplateDirectory(repoRoot, readJson(ownerActionQueueJsonPath), args.printTemplateDirPath, args.ownerFilter)
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (args.printEvidenceTemplate) {
    assertNonEmptyString(args.actionFilter, 'argument --action for --print-evidence-template')
    printEvidenceTemplate(readJson(ownerActionQueueJsonPath), args.actionFilter)
    return
  }
  if (args.printEvidenceTemplateDirPath !== null) {
    const result = writeEvidenceTemplateDirectory(repoRoot, readJson(ownerActionQueueJsonPath), args.printEvidenceTemplateDirPath, args.ownerFilter)
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (args.listActions) {
    printActions(readJson(ownerActionQueueJsonPath), args.actionFilter, args.ownerFilter)
    return
  }
  if (args.ownerSummary) {
    printOwnerSummary(readJson(ownerActionQueueJsonPath), args.ownerFilter)
    return
  }
  if (args.blockerTaxonomy) {
    printBlockerTaxonomy(readJson(ownerActionQueueJsonPath), readJson(completionAuditJsonPath), args.ownerFilter)
    return
  }
  if (args.ownerClosureBundles) {
    printOwnerClosureBundles(readJson(ownerActionQueueJsonPath), readJson(ownerClosureBundlesJsonPath), args.ownerFilter)
    return
  }
  if (args.ownerLaneCommands) {
    printOwnerLaneCommands(readJson(ownerActionQueueJsonPath), args.ownerFilter)
    return
  }
  if (args.ownerOutputMatrix) {
    printOwnerOutputMatrix(readJson(ownerActionQueueJsonPath), readJson(completionStatusJsonPath), readJson(ownerClosureBundlesJsonPath), readJson(completionAuditJsonPath), args.ownerFilter)
    return
  }
  if (args.partialR8Dossier) {
    printPartialR8Dossier(readJson(ownerActionQueueJsonPath), readJson(completionAuditJsonPath), args.ownerFilter, args.fileFilter)
    return
  }
  if (args.sourceFileDossier) {
    assertNonEmptyString(args.fileFilter, 'argument --file for --source-file-dossier')
    printSourceFileDossier(readJson(ownerActionQueueJsonPath), args.fileFilter, args.actionFilter, args.ownerFilter)
    return
  }
  if (args.ownerReadiness) {
    const queue = readJson(ownerActionQueueJsonPath)
    let coverage = null
    let coverageArtifacts = {}
    if (args.evidenceDirPath !== null) {
      let summaries = []
      try {
        summaries = validateEvidenceDirectory(repoRoot, queue, args.evidenceDirPath)
      } catch (error) {
        if (args.requireComplete) throw error
        coverage = summarizeEvidenceDirectoryValidationError(queue, args.evidenceDirPath, error, args.ownerFilter)
      }
      if (coverage === null) {
        coverage = summarizeEvidenceDirectoryCoverageForOwner(queue, summaries, args.requireComplete, args.ownerFilter)
      }
      const coverageReportPath = args.coverageReportPath === null
        ? null
        : writeCoverageReport(repoRoot, args.coverageReportPath, coverage, summaries)
      const coverageJsonPath = args.coverageJsonPath === null
        ? null
        : writeCoverageJsonReport(repoRoot, args.coverageJsonPath, coverage, summaries)
      coverageArtifacts = {
        coverageJsonPath,
        coverageReportPath,
        evidenceDirPath: normalizeRelativeRepoPath(args.evidenceDirPath),
        validationError: coverage.validationError ?? null,
        validationStatus: coverage.validationStatus ?? 'validated',
        submissionCount: summaries.length
      }
    }
    printOwnerReadiness(queue, readJson(completionStatusJsonPath), readJson(ownerClosureBundlesJsonPath), readJson(completionAuditJsonPath), args.ownerFilter, coverage, coverageArtifacts)
    return
  }
  if (args.nextOwnerCommands) {
    printNextOwnerCommands(readJson(ownerActionQueueJsonPath), readJson(completionStatusJsonPath), args.ownerFilter)
    return
  }
  if (args.hashEvidencePath !== null) {
    assertNonEmptyString(args.hashEvidencePath, 'argument --hash-evidence')
    printEvidenceHash(repoRoot, args.hashEvidencePath)
    return
  }
  if (args.evidenceDirPath !== null) {
    assertNonEmptyString(args.evidenceDirPath, 'argument --evidence-dir')
    const queue = readJson(ownerActionQueueJsonPath)
    const summaries = validateEvidenceDirectory(repoRoot, queue, args.evidenceDirPath)
    const coverage = summarizeEvidenceDirectoryCoverageForOwner(queue, summaries, args.requireComplete, args.ownerFilter)
    const coverageReportPath = args.coverageReportPath === null
      ? null
      : writeCoverageReport(repoRoot, args.coverageReportPath, coverage, summaries)
    const coverageJsonPath = args.coverageJsonPath === null
      ? null
      : writeCoverageJsonReport(repoRoot, args.coverageJsonPath, coverage, summaries)
    console.log(JSON.stringify(buildOwnerEvidenceDirectoryValidationOutput(summaries, coverage, coverageReportPath, coverageJsonPath), null, 2))
    return
  }
  assertNonEmptyString(args.evidencePath, 'argument --evidence')
  const queue = readJson(ownerActionQueueJsonPath)
  const submissionRelativePath = normalizeRelativeRepoPath(args.evidencePath)
  const submission = readJson(resolveRepoPath(repoRoot, submissionRelativePath))
  const summary = validateSubmission(submission, queue, { submissionRelativePath })
  console.log(JSON.stringify(buildOwnerEvidenceValidationOutput(summary), null, 2))
}

main()
