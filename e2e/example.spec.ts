import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { createServer, type Server } from 'node:net'
import { test, expect, _electron as electron, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { CommandHistoryEntry, GraphKind, StatusbarConfig, WindowBatchAction, WindowBatchProgress } from '@shared/schemas/r8-runtime'
import type { AIWindowAlias } from '@shared/types-extended'

const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
const nodeRequire = createRequire(import.meta.url)
const AXE_CORE_PATH = nodeRequire.resolve('axe-core/axe.min.js')
const ELECTRON_BINARY_PATH = String(nodeRequire('electron'))
const AXE_WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const
const EXPECTED_RUNTIME_SINGLETON_KINDS = [
  'aiTask',
  'backgroundScannerManager',
  'port',
  'process',
  'scannerCache',
  'toolMonitor',
  'window'
] as const
const EXPECTED_DISPOSAL_ENTRIES = [
  'background-scanner-manager',
  'tool-monitor',
  'ai-task-tracker',
  'process-scanner',
  'window-manager',
  'scanner-cache',
  'process-manager',
  'ipc-handlers'
] as const
const EXPECTED_PRELOAD_TOP_LEVEL_KEYS = [
  'aiAlias',
  'aiTask',
  'dialog',
  'groups',
  'logs',
  'notification',
  'port',
  'process',
  'projects',
  'scanner',
  'settings',
  'shell',
  'system',
  'systemProcess',
  'tags',
  'taskHistory',
  'tools',
  'topology',
  'window',
  'windowManager'
] as const
const EXPECTED_PRELOAD_METHODS = [
  'aiAlias.getAll',
  'aiTask.scan',
  'dialog.openDirectory',
  'groups.list',
  'logs.clear',
  'notification.getConfig',
  'port.getPortDetailIncremental',
  'process.start',
  'projects.openIn',
  'projects.watcher.start',
  'scanner.getStatus',
  'settings.get',
  'shell.openPath',
  'system.getDrives',
  'systemProcess.probeAccess',
  'tags.list',
  'taskHistory.list',
  'tools.getStatus',
  'topology.buildScopedFlow',
  'topology.buildScopedGraph',
  'topology.warmScope',
  'window.close',
  'windowManager.scan'
] as const
const OPTIONAL_DEV_OBS_METHODS = [
  'devObs.exportDiagnosticBundle',
  'devObs.getRuntimeMetrics',
  'devObs.getThrottleReport',
  'devObs.resetMetrics'
] as const
const FORBIDDEN_PRELOAD_PATHS = [
  'ipcRenderer',
  'invoke',
  'send',
  'on',
  'devhub.ipcRenderer',
  'scanner.emitScannerAck',
  'scanner.applyScannerChannelSeqs'
] as const

interface RuntimeRegistrySnapshotRow {
  kind: string
  instanceType: string
}

interface SecurityAuditEntry {
  timestamp: string
  ts: number
  action: string
  op: string
  target: Record<string, unknown>
  result: 'success' | 'refused' | 'error'
  outcome: string
  reason?: string
}

interface PortSecurityRestartReport {
  defaultCount: number
  reasons: string[]
  tier: string
  userEntryCount: number
}

interface DashboardRestartReport {
  itemId: string
  savedH: number
  widgetCount: number
}

interface ExternalElectronProbe {
  directory: string
  executablePath: string
  removeExecutable: boolean
  process: ChildProcess
}

interface CursorCopilotE2ESignal {
  instanceId: string
  tool: string
  phase: string
  confidence: number
  source: string
  rawTitle: string
  titleHash: string
  hwnd: number
  pid: number
  processName: string
  ts: number
}

interface CursorCopilotE2EStatus {
  checkedAt: number
  cursorTasks: number
  copilotTasks: number
  totalAiTasks: number
  phase: string
  confidence: number
  rawTitle: string | null
  titleHash: string | null
  ts: number
  signals: CursorCopilotE2ESignal[]
}

interface R8Spec05WindowDetectionReport {
  scannerRetrySuccess: boolean
  windowHwnd: number
  windowPid: number
  windowProcessName: string
  status: CursorCopilotE2EStatus
  matchingSignal: CursorCopilotE2ESignal | null
}

type ProcessTagE2EColor = 'accent' | 'info' | 'success' | 'warning' | 'gold' | 'steel' | 'error'

interface ProcessTagE2ERestore {
  color?: ProcessTagE2EColor
  pinned: boolean
  tag: string
}

interface ProcessTagRestartReport {
  cwd: string | null
  exe: string
  exportContainsLabel: boolean
  historyPointCount: number
  historyWindowMs: number
  key: string
  originalTag: ProcessTagE2ERestore | null
  pid: number
  pinned: boolean
  scanCount: number
  tag: string
}

interface DrawerRestartReport {
  contentId?: string
  open: boolean
  pinned: boolean
  size?: number
  slot: string
}

interface ProcessTreemapE2EReport {
  containerHeight: number
  containerWidth: number
  labelProcessCount: number
  labelTileCount: number
  persistedMode: string | null
  scanProcessCount: number
  tileCount: number
  tileHeight: number
  tilePid: number
  tileWidth: number
  viewBoxHeight: number
  viewBoxWidth: number
}

interface RuntimeDisposalFailure {
  name: string
  reason: string
}

interface RuntimeDisposalReport {
  completedAt: number
  durationMs: number
  failed: RuntimeDisposalFailure[]
  remainingAfter: string[]
  startedAt: number
  succeeded: string[]
  timedOut: string[]
  total: number
}

interface RuntimeShutdownResult {
  killedChildren: number
  report: RuntimeDisposalReport
}

interface RuntimeMetricSample {
  ts: number
  v: number
}

interface RuntimeMetricSeries {
  items: RuntimeMetricSample[]
}

interface RuntimeIpcChannelTopEntry {
  channel: string
  rpm: number
  totalSinceBoot: number
}

interface RuntimeReactCommitEntry {
  avgActualMs: number
  commits: number
  id: string
  lastCommitTime: number | null
  lastPhase: string | null
}

interface RuntimeIpcThrottleReport {
  channels: Record<string, unknown>
}

interface RuntimeDevObsSnapshot {
  cpu5mAvg: number
  cpuNow: number
  extended: {
    scannerBackpressure: Array<{
      droppedEnvelopes: number
      kind: string
      pendingSeq: number
      queuedEnvelopes: number
      suspended: boolean
    }>
  }
  ipcRpm: {
    top: RuntimeIpcChannelTopEntry[]
  }
  mainRss: RuntimeMetricSeries
  psChildCount: number
  reactCommits: {
    top: RuntimeReactCommitEntry[]
  }
  rendererRss: RuntimeMetricSeries
}

interface RuntimeDevObsExportResult {
  bytes: number
  path: string
}

interface RuntimeDevObsApi {
  exportDiagnosticBundle: () => Promise<RuntimeDevObsExportResult>
  getRuntimeMetrics: () => Promise<RuntimeDevObsSnapshot>
  getThrottleReport: () => Promise<RuntimeIpcThrottleReport>
}

interface RuntimeDiagnosticManifest {
  artifactPath: string
  noTelemetry: boolean
  redactionsApplied: number
  sections: Array<{
    redactionCount: number
    relativePath: string
    section: string
  }>
  sectionsIncluded: string[]
}

interface RuntimeMonacoWorkerProbe {
  constructorName: string
  hasTerminate: boolean
  label: string
}

interface RuntimePreloadSurfaceSnapshot {
  hasDevObs: boolean
  topLevelKeys: string[]
  typeMap: Record<string, string>
}

interface SystemProcessDescriptor {
  name: string
  pid: number
}

type RuntimeMonitorState = 'idle' | 'thinking' | 'coding' | 'compiling' | 'validating' | 'waiting-input' | 'completed' | 'error'

interface RuntimeProgressProbeResult {
  pid: number
  steps: Array<{ monitorState: RuntimeMonitorState; task: { id: string; pid: number } }>
  taskId: string
}

interface ProjectOpenProbeResult {
  error: string | null
  ok: boolean
  target: 'vscode' | 'cursor' | 'explorer' | 'terminal'
}

interface AttachedFlowE2EReport {
  appendedNodeIds: string[]
  appendedTaskIds: Array<string | null>
  defaultWindowMs: number
  exportedStartsWithSequence: boolean
  filteredNodeCount: number
  realtimeAppendMs: number
  streamReasons: string[]
  window24hMs: number
}

interface AttachedTopologySpec25Report {
  ipcDepth: number
  ipcLazy: boolean
  ipcNodeCount: number
  ipcTruncatedAtDepth: number | null
  port: number
  portPid: number
  processPid: number
  windowHwnd: number
  windowTitle: string
}

interface ProcessProbeSnapshot {
  name: string
  pid: number
}

type E2ECliToolName = 'codex' | 'claude' | 'gemini' | 'cursor' | 'copilot' | 'unknown'
type E2ECliStreamName = 'stdout' | 'stderr' | 'title' | 'system'
type E2EParserStrategy = 'ndjson' | 'shim' | 'line' | 'sse'
type E2ECliPhase = 'idle' | 'thinking' | 'working' | 'validating' | 'waiting-input' | 'completed' | 'error'
type E2ECliEventType = 'start' | 'progress' | 'tool-use' | 'tool_invocation' | 'progress_pct' | 'message-out' | 'completion' | 'waiting-input' | 'phase_marker' | 'error' | 'unknown'

interface E2ECliOutputEvent {
  confidence: number
  eventType?: E2ECliEventType
  instanceId?: string
  line: string
  payload?: Record<string, unknown>
  phase: E2ECliPhase
  progress: number | null
  rawSource?: E2EParserStrategy | 'heuristic' | 'window-title'
  sessionId?: string
  stream: E2ECliStreamName
  tool: E2ECliToolName
}

interface E2ECliFeedInput {
  chunk: string
  instanceId?: string
  sessionId?: string
  strategy?: E2EParserStrategy
  stream?: E2ECliStreamName
  tool?: E2ECliToolName
}

interface E2EParseSession {
  bytesProcessed: number
  eventsEmitted: number
  instanceId: string
  lastEventAt: number | null
  sessionId: string
  startedAt: number
  strategy: E2EParserStrategy
  tool: E2ECliToolName
}

interface E2EProgressDataPoint {
  confidence: number
  instanceId: string
  message?: string
  observedAt: number
  percent: number
  source: 'cli-real' | 'heuristic' | 'fusion'
}

interface E2ECliProgressReport {
  count: number
  events: E2ECliOutputEvent[]
  latest: E2ECliOutputEvent | null
  progress: E2EProgressDataPoint | null
}

interface E2EShimManifest {
  installedAt: number
  ipcPipe: string
  realExePath: string
  shimExePath: string
  shimVersion: string
  toolName: 'codex' | 'claude' | 'gemini'
}

interface E2EShimInstallResult {
  artifactKind: 'node-script' | 'packaged-executable'
  env: Record<string, string>
  manifest: E2EShimManifest
  pathUpdated: boolean
  pipeServer: {
    error: string | null
    listening: boolean
    pipeName: string
    tool: 'codex' | 'claude' | 'gemini'
  }
  requiresPathRefresh: boolean
  shimDirectory: string
  shimManifestPath: string | null
  shimPath: string
  success: boolean
}

interface Spec01CliEventWindow {
  __r8Spec01CliCleanup?: () => void
  __r8Spec01CliEvents?: E2ECliOutputEvent[]
}

interface Spec02ShimEventWindow {
  __r8Spec02ShimCleanup?: () => void
  __r8Spec02ShimEvents?: E2ECliOutputEvent[]
}

interface Spec03ClaudeStreamWindow {
  __r8Spec03ClaudeCleanup?: () => void
  __r8Spec03ClaudeEvents?: Record<string, unknown>[]
  __r8Spec03CliCleanup?: () => void
  __r8Spec03CliEvents?: E2ECliOutputEvent[]
}

interface Spec10WindowBatchReport {
  batchJobId: string
  completed: number
  failed: number
  resultStatuses: string[]
  state: WindowBatchProgress['state']
  targetHwnds: number[]
  undoUndone: number
}

interface Spec10AssertionProbeIds {
  aot: number
  close: number
  focus: number
  inject: number
  minimize: number
  rename: number
  screenshot: number
}

interface Spec10AssertionProbeHwnds {
  aot: number
  close: number
  focus: number
  inject: number
  minimize: number
  rename: number
  screenshot: number
}

interface Spec10AssertionProbeTitles {
  aot: string
  close: string
  focus: string
  inject: string
  minimize: string
  rename: string
  screenshot: string
}

interface Spec10AssertionState {
  closedProbeGone: boolean
  injectedValue: string
  minimizedAfterUndo: boolean
}

interface Spec10BatchRequestForE2E {
  action: WindowBatchAction
  args?: Record<string, unknown>
  hwnds: number[]
}

interface Spec10BatchAssertionSummary {
  action: WindowBatchAction
  completed: number
  failed: number
  jobId: string
  statuses: string[]
}

interface Spec04GeminiShimEventWindow {
  __r8Spec04GeminiShimCleanup?: () => void
  __r8Spec04GeminiShimEvents?: E2ECliOutputEvent[]
}

interface Spec04CommandProtocolWindow {
  __r8Spec04ProtocolCleanup?: () => void
  __r8Spec04ProtocolEvents?: Array<{ type: string; uri?: string }>
}

interface RuntimeTestHooks {
  buildGlobalTopologyFixtureForTests: (input: TopologyFixtureForTestsInput) => Promise<TopologyFixtureForTestsResult>
  disposeRuntimeForTests: () => Promise<RuntimeShutdownResult>
  driveAITaskProgressScenarioForTests: (options: {
    finalizeCompletedAfterMs?: number
    pid: number
    settleMs?: number
    states: RuntimeMonitorState[]
  }) => Promise<RuntimeProgressProbeResult>
  feedCliChunkForTests: (input: E2ECliFeedInput) => E2ECliOutputEvent[]
  emitTaskCompleteNotificationForTests: (options: {
    alias?: string
    durationMs?: number
    pid?: number
    taskId?: string
    toolName?: string
    windowHwnd?: number
  }) => Promise<unknown>
  getDisposalRegistryState: () => {
    lastReport: RuntimeDisposalReport | null
    remaining: string[]
  }
  listAliasesForTests: () => AIWindowAlias[]
  getScannerRegistrySnapshot: () => RuntimeRegistrySnapshotRow[]
  scanWindowsIntoCacheForTests: () => Promise<{
    count: number
    data: Array<{
      hwnd: number
      pid: number
      processName: string
      title: string
    }>
    error?: string
    success: boolean
  }>
  runPowerShellConcurrencyProbeForTests: (options?: {
    count?: number
    sampleIntervalMs?: number
    sleepMs?: number
    timeoutMs?: number
  }) => Promise<{
    abortedCount: number
    completedCount: number
    count: number
    durationMs: number
    failedCount: number
    finalActiveCount: number
    finalQueuedCount: number
    fulfilledCount: number
    maxActiveCount: number
    maxQueuedCount: number
    maxRunningPids: number
    rejectedCount: number
    sampleCount: number
    sleepMs: number
    timedOutCount: number
    timeoutMs: number
  }>
}


type P6ScopeKind = 'project' | 'process' | 'port' | 'window'

interface TopologyFixtureForTestsInput {
  asOfTs?: number | null
  expandAll?: boolean
  graphKind: GraphKind
  nodeCount: number
}

interface TopologyFixtureForTestsResult {
  asOfTs: number | null
  degraded: boolean
  durationMs: number
  edgeCount: number
  graphKind: GraphKind
  historicalNodeCount: number
  nodeCount: number
  requestedNodeCount: number
  source: string
  warningCodes: string[]
}

const SPEC24_TOPOLOGY_FIXTURE_NODE_COUNTS = [100, 500, 800] as const
const SPEC24_TOPOLOGY_FIXTURE_GRAPH_KINDS = ['network-topology', 'neural-relationship', 'flow'] as const satisfies readonly GraphKind[]
const SPEC24_TOPOLOGY_FIXTURE_CURSOR = 1_800_024
const SPEC24_TOPOLOGY_FIXTURE_BUDGET_MS = 2_500

interface GraphNodeDistribution {
  count: number
  spreadX: number
  spreadY: number
  viewBoxHeight: number
  viewBoxWidth: number
  containerHeight: number
  containerWidth: number
}

interface LaunchAppOptions {
  enableDevObservability?: boolean
}

interface AxeViolationSummary {
  help: string
  id: string
  impact: string | null
  targets: string[]
}

interface AxeScanSummary {
  criticalViolations: AxeViolationSummary[]
  incompleteCount: number
  label: string
  passesCount: number
  violationCount: number
}

async function launchApp(
  options: LaunchAppOptions = {}
): Promise<{ electronApp: ElectronApplication; window: Page }> {
  const args = ['out/main/index.js']
  if (options.enableDevObservability) {
    args.push('--enable-dev-obs')
  }

  const electronApp = await electron.launch({
    args,
    env: {
      ...process.env,
      ...(options.enableDevObservability ? { ENABLE_DEV_OBS: '1' } : {})
    }
  })

  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const windows = electronApp.windows()
    const mainWindow = windows.find((page) =>
      page.url().includes('/out/renderer/index.html')
      || page.url().includes('/out/renderer/index.html'.replace(/\//g, '\\'))
    )

    if (mainWindow) {
      await mainWindow.waitForLoadState('domcontentloaded')
      return { electronApp, window: mainWindow }
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  await closeElectronApp(electronApp)
  throw new Error('Timed out while waiting for DevHub main window')
}

async function closeElectronApp(electronApp: ElectronApplication): Promise<void> {
  const closePromise = new Promise<void>((resolve) => {
    electronApp.once('close', () => {
      resolve()
    })
  })

  const waitForClose = async (timeoutMs: number): Promise<boolean> => {
    const timeoutPromise = new Promise<false>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs)
      timer.unref?.()
    })

    return Promise.race([
      closePromise.then(() => true),
      timeoutPromise
    ])
  }

  try {
    await electronApp.evaluate(({ app }) => {
      app.quit()
    })
  } catch {
    // The main process may already be closing; fall back to Playwright cleanup below.
  }

  if (await waitForClose(8_000)) {
    return
  }

  const electronProcess = electronApp.process()
  if (electronProcess.exitCode !== null || electronProcess.signalCode !== null) {
    return
  }

  const processExitPromise = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 8_000)
    timer.unref?.()
    electronProcess.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })

  electronProcess.kill()
  if (await Promise.race([waitForClose(8_000), processExitPromise])) {
    return
  }

  throw new Error('Timed out while closing Electron app process')
}

async function ensureAxeRuntime(page: Page): Promise<void> {
  const hasAxe = await page.evaluate(() => {
    return typeof (globalThis as unknown as { axe?: unknown }).axe === 'object'
  }).catch(() => false)
  if (!hasAxe) {
    await page.addScriptTag({ path: AXE_CORE_PATH })
  }
}

async function scanCriticalAxeViolations(page: Page, label: string): Promise<AxeScanSummary> {
  await ensureAxeRuntime(page)
  return page.evaluate(async ({ scanLabel, tags }) => {
    type AxeNode = { target: string[] }
    type AxeViolation = {
      help: string
      id: string
      impact: string | null
      nodes: AxeNode[]
    }
    type AxeResults = {
      incomplete: unknown[]
      passes: unknown[]
      violations: AxeViolation[]
    }
    const axeRuntime = (globalThis as unknown as {
      axe?: {
        run: (
          context: Document,
          options: { runOnly: { type: 'tag'; values: string[] } }
        ) => Promise<AxeResults>
      }
    }).axe
    if (!axeRuntime) throw new Error('axe runtime was not injected into Electron renderer')
    const results = await axeRuntime.run(document, { runOnly: { type: 'tag', values: tags } })
    const criticalViolations = results.violations
      .filter(violation => violation.impact === 'critical')
      .map(violation => ({
        help: violation.help,
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.flatMap(node => node.target)
      }))
    return {
      criticalViolations,
      incompleteCount: results.incomplete.length,
      label: scanLabel,
      passesCount: results.passes.length,
      violationCount: results.violations.length
    }
  }, { scanLabel: label, tags: [...AXE_WCAG_TAGS] })
}

async function resizeMainWindow(electronApp: ElectronApplication, width: number, height: number): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }, size) => {
    const [mainWindow] = BrowserWindow.getAllWindows()
    if (!mainWindow) {
      throw new Error('DevHub main BrowserWindow is not available')
    }
    mainWindow.setSize(size.width, size.height)
  }, { width, height })
}

async function createRealBrowserWindowWithTitle(electronApp: ElectronApplication, title: string): Promise<number> {
  return electronApp.evaluate(async ({ BrowserWindow }, windowTitle) => {
    const probeWindow = new BrowserWindow({
      width: 520,
      height: 280,
      show: true,
      title: windowTitle
    })
    const body = '<html><head><title>' + windowTitle + '</title></head><body><h1>' + windowTitle + '</h1></body></html>'
    await probeWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(body))
    probeWindow.setTitle(windowTitle)
    return probeWindow.id
  }, title)
}

async function closeRealBrowserWindowById(electronApp: ElectronApplication, id: number | null): Promise<void> {
  if (id === null) return
  await electronApp.evaluate(({ BrowserWindow }, windowId) => {
    const probeWindow = BrowserWindow.fromId(windowId)
    if (probeWindow && !probeWindow.isDestroyed()) {
      probeWindow.destroy()
    }
  }, id).catch(() => undefined)
}

async function createSpec10AssertionProbeWindows(
  electronApp: ElectronApplication,
  titles: Spec10AssertionProbeTitles
): Promise<Spec10AssertionProbeIds> {
  return electronApp.evaluate(async ({ BrowserWindow }, probeTitles) => {
    const createProbe = async (title: string, body: string): Promise<number> => {
      const probeWindow = new BrowserWindow({
        width: 520,
        height: 280,
        show: true,
        title
      })
      const html = '<!doctype html><html><head><title>' + title + '</title></head><body>' + body + '</body></html>'
      await probeWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      probeWindow.setTitle(title)
      return probeWindow.id
    }

    return {
      aot: await createProbe(probeTitles.aot, '<h1>AOT probe</h1>'),
      close: await createProbe(probeTitles.close, '<h1>Close probe</h1>'),
      focus: await createProbe(probeTitles.focus, '<h1>Focus probe</h1>'),
      inject: await createProbe(
        probeTitles.inject,
        '<textarea id="spec10-inject-target" autofocus style="width:420px;height:120px"></textarea><script>document.getElementById("spec10-inject-target").focus()</script>'
      ),
      minimize: await createProbe(probeTitles.minimize, '<h1>Minimize probe</h1>'),
      rename: await createProbe(probeTitles.rename, '<h1>Rename probe</h1>'),
      screenshot: await createProbe(probeTitles.screenshot, '<h1>Screenshot probe</h1>')
    }
  }, titles)
}

async function scanSpec10AssertionHwnds(
  electronApp: ElectronApplication,
  titles: Spec10AssertionProbeTitles
): Promise<Spec10AssertionProbeHwnds> {
  const entries = Object.entries(titles) as Array<[keyof Spec10AssertionProbeTitles, string]>
  const expectedTitles = entries.map(([, title]) => title)
  await expect.poll(async () => {
    const found = await electronApp.evaluate(async (_, probeTitles) => {
      const hooks = (globalThis as typeof globalThis & {
        __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
      }).__DEVHUB_TEST_HOOKS__
      if (!hooks) {
        throw new Error('Runtime test hooks are not available for ASSERT_WINDOW_BATCH_7_OPS')
      }
      const scan = await hooks.scanWindowsIntoCacheForTests()
      return scan.data.filter(row => probeTitles.includes(row.title)).length
    }, expectedTitles)
    return found
  }, {
    message: 'wait for ASSERT_WINDOW_BATCH_7_OPS probe HWNDs',
    timeout: 30_000,
    intervals: [500, 750, 1000]
  }).toBe(expectedTitles.length)

  const rows = await electronApp.evaluate(async (_, probeTitles) => {
    const hooks = (globalThis as typeof globalThis & {
      __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
    }).__DEVHUB_TEST_HOOKS__
    if (!hooks) {
      throw new Error('Runtime test hooks are not available for ASSERT_WINDOW_BATCH_7_OPS')
    }
    const scan = await hooks.scanWindowsIntoCacheForTests()
    return scan.data.filter(row => probeTitles.includes(row.title))
  }, expectedTitles)
  const hwndByTitle = new Map(rows.map(row => [row.title, row.hwnd]))
  return Object.fromEntries(entries.map(([role, title]) => {
    const hwnd = hwndByTitle.get(title)
    if (typeof hwnd !== 'number') {
      throw new Error(`Missing HWND for ${role}:${title}`)
    }
    return [role, hwnd]
  })) as unknown as Spec10AssertionProbeHwnds
}

async function runSpec10Batch(
  page: Page,
  request: Spec10BatchRequestForE2E
): Promise<WindowBatchProgress> {
  return page.evaluate(async (batchRequest): Promise<WindowBatchProgress> => {
    const batchOp = window.devhub.windowManager.batchOp
    const onBatchProgress = window.devhub.windowManager.onBatchProgress
    if (!batchOp || !onBatchProgress) {
      throw new Error('Window batch preload API is unavailable')
    }

    const progressEvents: WindowBatchProgress[] = []
    const unsubscribe = onBatchProgress(progress => {
      progressEvents.push(progress)
    })
    try {
      const started = await batchOp({
        action: batchRequest.action,
        args: batchRequest.args ?? {},
        confirmed: true,
        hwnds: batchRequest.hwnds
      })
      return await new Promise<WindowBatchProgress>((resolve, reject) => {
        const handles: { interval?: number; timeout?: number } = {}
        handles.timeout = window.setTimeout(() => {
          if (handles.interval !== undefined) window.clearInterval(handles.interval)
          reject(new Error(`Timed out waiting for ASSERT_WINDOW_BATCH_7_OPS batch ${started.jobId}`))
        }, 30_000)
        handles.interval = window.setInterval(() => {
          const latest = [...progressEvents].reverse().find(progress => progress.jobId === started.jobId)
          if (latest && latest.state !== 'running') {
            if (handles.timeout !== undefined) window.clearTimeout(handles.timeout)
            if (handles.interval !== undefined) window.clearInterval(handles.interval)
            resolve(latest)
          }
        }, 50)
      })
    } finally {
      unsubscribe()
    }
  }, request)
}

async function undoSpec10Batch(page: Page, jobId: string): Promise<number> {
  return page.evaluate(async (batchJobId): Promise<number> => {
    const batchUndo = window.devhub.windowManager.batchUndo
    if (!batchUndo) throw new Error('Window batch undo preload API is unavailable')
    const undo = await batchUndo(batchJobId, 'ASSERT_WINDOW_BATCH_7_OPS')
    return undo.undone
  }, jobId)
}

async function closeLiveR8MonitorPopouts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const monitorTools = new Set(['codex', 'claude', 'gemini', 'cursor', 'copilot'])
    if (Reflect.has(window.devhub.r8, 'popout')) {
      const popouts = await window.devhub.r8.popout.list()
      for (const popout of popouts) {
        if (popout.surface !== 'monitor' || popout.bridgeState === 'closed') continue
        if (typeof popout.targetId === 'string' && monitorTools.has(popout.targetId)) {
          await window.devhub.r8.monitor.closePopout(popout.windowId).catch(() => undefined)
          continue
        }
        await window.devhub.r8.popout.close(popout.windowId).catch(() => undefined)
      }
      return
    }
    for (const popout of await window.devhub.r8.monitor.listPopouts()) {
      await window.devhub.r8.monitor.closePopout(popout.windowId).catch(() => undefined)
    }
    if (typeof window.devhub.r8.monitor.close === 'function') await window.devhub.r8.monitor.close().catch(() => undefined)
  })
}

async function navigateMonitorPageToR8Ops(page: Page): Promise<void> {
  if (await page.locator('[data-r8c-monitor-window="true"]').isVisible({ timeout: 1_000 }).catch(() => false)) return
  await expect(page.getByText('SYSTEM MONITOR')).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'r8-ops' } }))
  })
  if (!await page.getByText('R8 OPERATIONS').isVisible({ timeout: 1_000 }).catch(() => false)) {
    const r8OpsTab = page.locator('button').filter({ hasText: 'R8' }).last()
    await expect(r8OpsTab).toBeVisible({ timeout: 15_000 })
    await r8OpsTab.click({ force: true })
  }
  await expect(page.getByText('R8 OPERATIONS')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-r8c-monitor-window="true"]')).toBeVisible({ timeout: 15_000 })
}

async function waitForDedicatedMonitorPopout(page: Page, tool: string, layout: string): Promise<void> {
  await expect(page.locator(`[data-r8c-monitor-popout="true"][data-target="${tool}"]`)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(`[data-tool="${tool}"][data-layout="${layout}"]`)).toBeVisible({ timeout: 15_000 })
}

function startExternalElectronProbe(executableName: 'cursor.exe' | 'Code.exe' | 'gh.exe', title: string): ExternalElectronProbe {
  const directory = join(tmpdir(), `devhub-r8c-spec05-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(directory, { recursive: true })
  const executablePath = join(dirname(ELECTRON_BINARY_PATH), executableName)
  const scriptPath = join(directory, 'main.js')
  const removeExecutable = !existsSync(executablePath)
  if (removeExecutable) {
    copyFileSync(ELECTRON_BINARY_PATH, executablePath)
  }
  writeFileSync(scriptPath, [
    "const { app, BrowserWindow } = require('electron')",
    `const title = ${JSON.stringify(title)}`,
    "app.whenReady().then(async () => {",
    "  const win = new BrowserWindow({ width: 560, height: 320, show: true, title })",
    "  const html = '<html><head><title>' + title + '</title></head><body><h1>' + title + '</h1></body></html>'",
    "  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))",
    "  win.setTitle(title)",
    "})",
    "app.on('window-all-closed', () => app.quit())",
    ''
  ].join('\n'), 'utf8')
  const child = spawn(executablePath, [scriptPath], {
    cwd: directory,
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    stdio: 'ignore',
    windowsHide: false
  })
  return { directory, executablePath, removeExecutable, process: child }
}

async function waitForChildProcessExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

async function removeDirectoryWithRetry(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      rmSync(directory, { recursive: true, force: true })
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
}

async function stopExternalElectronProbe(probe: ExternalElectronProbe | null): Promise<void> {
  if (!probe) return
  const pid = probe.process.pid
  if (probe.process.exitCode === null && probe.process.signalCode === null) {
    probe.process.kill()
    await waitForChildProcessExit(probe.process, 2_000)
  }
  if (pid && probe.process.exitCode === null && probe.process.signalCode === null) {
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 5_000, windowsHide: true })
      await waitForChildProcessExit(probe.process, 2_000)
    } catch {
      // The process may have exited between the bounded wait and taskkill.
    }
  }
  if (probe.removeExecutable) {
    try {
      rmSync(probe.executablePath, { force: true })
    } catch {
      // A delayed Windows handle can keep the temporary executable locked briefly.
    }
  }
  await removeDirectoryWithRetry(probe.directory)
}

async function listenOnEphemeralPort(): Promise<{ port: number; server: Server }> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('Unable to allocate an ephemeral TCP port for spec-25 E2E')
  }

  return { port: address.port, server }
}

async function closeServer(server: Server | null): Promise<void> {
  if (!server) return
  if (!server.listening) return

  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
}

type R8PortPopoutListener = {
  port: number
  server: Server
}

type R8PortPopoutProbe = {
  localAddress: string
  pid: number
  port: number
}

type R8PortPopoutHarness = {
  electronApp: ElectronApplication
  listeners: R8PortPopoutListener[]
  ports: R8PortPopoutProbe[]
  window: Page
}

async function listenOnEphemeralPorts(count: number): Promise<R8PortPopoutListener[]> {
  const listeners: R8PortPopoutListener[] = []
  try {
    for (let index = 0; index < count; index += 1) {
      listeners.push(await listenOnEphemeralPort())
    }
    return listeners
  } catch (error) {
    await Promise.all(listeners.map(async listener => closeServer(listener.server).catch(() => undefined)))
    throw error
  }
}

async function openPortMonitorView(window: Page): Promise<void> {
  await dismissAutoDiscoveryIfPresent(window)
  await window.evaluate(() => {
    window.localStorage.setItem('devhub:port-view-mode', 'cards')
  })
  await buttonByText(window, '监控').click()
  await buttonByText(window, '端口').click()
  await expect(window.getByText('端口监控')).toBeVisible({ timeout: 15_000 })
  const cardsMode = window.getByTitle('卡片')
  if (await cardsMode.isVisible().catch(() => false)) {
    await cardsMode.click()
  }
}

async function launchR8PortPopoutHarness(listenerCount: number): Promise<R8PortPopoutHarness> {
  const listeners = await listenOnEphemeralPorts(listenerCount)
  try {
    const listenerPorts = listeners.map(listener => listener.port)
    const launch = await launchApp()
    await resizeMainWindow(launch.electronApp, 1440, 900)
    await launch.window.setViewportSize({ width: 1440, height: 900 })
    await openPortMonitorView(launch.window)

    await expect.poll(async () => {
      return launch.window.evaluate((targetPorts) => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-r8a-port-card="true"]'))
        const renderedPorts = new Set(
          cards
            .map(card => Number(card.getAttribute('data-port-number')))
            .filter(port => Number.isInteger(port) && port > 0)
        )
        return targetPorts.filter(port => renderedPorts.has(port)).length
      }, listenerPorts)
    }, {
      message: '等待本测试进程创建的真实监听端口进入端口视图',
      timeout: 30_000
    }).toBe(listenerCount)

    const ports = await launch.window.evaluate(({ targetPid, targetPorts }) => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-r8a-port-card="true"]'))
      const resolved = targetPorts.map((targetPort) => {
        const candidates = cards
          .map((card) => {
            const localAddress = card
              .querySelector('[data-r8a-field-row="local-address"]')
              ?.textContent
              ?.replace('本地地址', '')
              .trim()
            const port = Number(card.getAttribute('data-port-number'))
            const pid = Number(card.getAttribute('data-port-pid'))
            if (!Number.isInteger(port) || port <= 0) return null
            if (!Number.isInteger(pid) || pid <= 0) return null
            if (typeof localAddress !== 'string' || localAddress.length === 0) return null
            return { localAddress, pid, port }
          })
          .filter((card): card is { localAddress: string; pid: number; port: number } => card !== null)
          .filter(card => card.port === targetPort)
        const exactPid = candidates.find(card => card.pid === targetPid)
        const loopback = candidates.find(card => card.localAddress.includes(`127.0.0.1:${targetPort}`))
        const resolvedCard = exactPid ?? loopback ?? candidates[0]
        if (!resolvedCard) {
          throw new Error(`R8.B spec-01 未找到测试监听端口 ${targetPort} 的真实端口卡片`)
        }
        return resolvedCard
      })
      return resolved
    }, { targetPid: process.pid, targetPorts: listenerPorts })

    if (ports.length < listenerCount) {
      throw new Error(`R8.B spec-01 需要 ${listenerCount} 个真实端口卡片，当前只有 ${ports.length}`)
    }

    return {
      electronApp: launch.electronApp,
      listeners,
      ports,
      window: launch.window
    }
  } catch (error) {
    await Promise.all(listeners.map(async listener => closeServer(listener.server).catch(() => undefined)))
    throw error
  }
}

async function closeR8PortPopoutHarness(harness: R8PortPopoutHarness | null): Promise<void> {
  if (!harness) return
  await closeElectronApp(harness.electronApp).catch(() => undefined)
  await Promise.all(harness.listeners.map(async listener => closeServer(listener.server).catch(() => undefined)))
}

async function showR8PortCard(window: Page, target: R8PortPopoutProbe): Promise<Locator> {
  await window.getByPlaceholder('搜索端口...').fill(String(target.port))
  const card = window
    .locator(`[data-r8a-port-card="true"][data-port-number="${target.port}"][data-port-pid="${target.pid}"]`)
    .filter({ hasText: target.localAddress })
  await expect(card).toHaveCount(1, { timeout: 15_000 })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await window.getByTestId('port-list-scroll').evaluate((container, selector) => {
    const targetCard = container.querySelector<HTMLElement>(selector)
    if (!targetCard) return
    const nextScrollTop = Math.max(0, targetCard.offsetTop - (container.clientHeight / 2) + (targetCard.clientHeight / 2))
    container.scrollTop = nextScrollTop
  }, `[data-r8a-port-card="true"][data-port-number="${target.port}"][data-port-pid="${target.pid}"]`)
  await card.evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest' })
  })
  await card.scrollIntoViewIfNeeded()
  return card
}

async function readSecurityAuditEntries(electronApp: ElectronApplication): Promise<SecurityAuditEntry[]> {
  const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const auditPath = join(userDataPath, 'logs', 'security-audit.log')
  try {
    return readFileSync(auditPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SecurityAuditEntry)
  } catch {
    return []
  }
}

function writeRecoveryLifecycleMarker(userDataPath: string, bootId: string): void {
  const recoveryRoot = join(userDataPath, 'r8-recovery')
  mkdirSync(recoveryRoot, { recursive: true })
  writeFileSync(join(recoveryRoot, 'lifecycle.json'), `${JSON.stringify({
    status: 'running',
    pid: 987_654_321,
    bootId,
    updatedAt: Date.now(),
    appVersion: 'e2e-spec-34'
  }, null, 2)}\n`, 'utf8')
}

function writeDirtyRuntimeStoreMarker(userDataPath: string, markerId: string): string {
  const dirtyStorePath = join(userDataPath, 'devhub-r8-runtime.json.tmp')
  writeFileSync(dirtyStorePath, `${JSON.stringify({
    markerId,
    reason: 'R8.C spec-34 Playwright dirty store fixture',
    writtenAt: Date.now()
  })}\n`, 'utf8')
  return dirtyStorePath
}
async function dismissAutoDiscoveryIfPresent(window: Page): Promise<void> {
  const skipButton = window.locator('button').filter({ hasText: '跳过' }).first()
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click()
  }
}

function listWindowsProcessNames(names: string[]): ProcessProbeSnapshot[] {
  const script = [
    '$names = @(' + names.map((name) => "'" + name.replace(/'/g, "''") + "'").join(',') + ')',
    'Get-Process -ErrorAction SilentlyContinue | Where-Object { $names -contains $_.ProcessName } | Select-Object Id,ProcessName | ConvertTo-Json -Compress'
  ].join('; ')

  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).trim()
  if (!output) return []

  const parsed = JSON.parse(output) as Array<{ Id: number; ProcessName: string }> | { Id: number; ProcessName: string }
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows.map((row) => ({ name: row.ProcessName, pid: row.Id }))
}

function killWindowsProcessTree(pid: number): void {
  try {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    // External apps can exit by themselves or hand off to an existing instance.
  }
}

function processDelta(before: ProcessProbeSnapshot[], after: ProcessProbeSnapshot[], name: string): ProcessProbeSnapshot[] {
  const beforePids = new Set(before.filter((row) => row.name.toLowerCase() === name.toLowerCase()).map((row) => row.pid))
  return after.filter((row) => row.name.toLowerCase() === name.toLowerCase() && !beforePids.has(row.pid))
}

async function openProjectInTargetsThroughPreload(window: Page, projectPath: string): Promise<ProjectOpenProbeResult[]> {
  return window.evaluate(async (pathToOpen) => {
    const targets = ['vscode', 'cursor', 'explorer', 'terminal'] as const
    const results: ProjectOpenProbeResult[] = []

    for (const target of targets) {
      try {
        const ok = await window.devhub.projects.openIn(pathToOpen, target)
        results.push({ error: null, ok: Boolean(ok), target })
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : String(error),
          ok: false,
          target
        })
      }
    }

    return results
  }, projectPath)
}

function spawnRealAIProgressProbe(label: string): ChildProcess {
  const child = spawn(process.execPath, [
    '-e',
    'setInterval(() => {}, 1000)',
    'codex',
    'run',
    label
  ], {
    stdio: 'ignore',
    windowsHide: true
  })
  child.unref()
  return child
}

function stopRealAIProgressProbe(child: ChildProcess): void {
  if (!child.pid || child.killed) return
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      return
    } catch {
      // Fall through to ChildProcess.kill below.
    }
  }
  child.kill('SIGTERM')
}

async function runNodeShimPassthrough(
  shimPath: string,
  markerLine: string,
  scriptSource?: string
): Promise<{ exitCode: number | null; stderr: string; stdout: string }> {
  const env = { ...process.env, NO_COLOR: '1' }
  delete env.FORCE_COLOR
  const script = scriptSource ?? `console.log(${JSON.stringify(markerLine)})`
  const runsThroughNode = /\.(cjs|js|mjs)$/i.test(shimPath)
  const child = spawn(runsThroughNode ? process.execPath : shimPath, runsThroughNode ? [
    shimPath,
    '-e',
    script
  ] : [
    '-e',
    script
  ], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })

  let stderr = ''
  let stdout = ''
  child.stdout?.on('data', chunk => {
    stdout += String(chunk)
  })
  child.stderr?.on('data', chunk => {
    stderr += String(chunk)
  })

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (child.pid) killWindowsProcessTree(child.pid)
      reject(new Error('Timed out while running generated DevHub shim'))
    }, 15_000)
    timer.unref?.()

    child.once('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', exitCode => {
      clearTimeout(timer)
      resolve({ exitCode, stderr, stdout })
    })
  })
}

async function driveAIProgressProbe(
  electronApp: ElectronApplication,
  options: { finalizeCompletedAfterMs?: number; pid: number; settleMs?: number; states: RuntimeMonitorState[] }
): Promise<RuntimeProgressProbeResult> {
  return electronApp.evaluate(async (_electron, probeOptions) => {
    const hooks = (globalThis as typeof globalThis & {
      __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
    }).__DEVHUB_TEST_HOOKS__
    if (!hooks) {
      throw new Error('Runtime test hooks are not available')
    }
    return hooks.driveAITaskProgressScenarioForTests(probeOptions)
  }, options)
}

function parseProgressPct(raw: string | null): number | undefined {
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function buttonByText(window: Page, text: string) {
  return window.locator('button').filter({ hasText: text }).first()
}

function settingsDialogByContract(window: Page): Locator {
  return window.locator('[role="dialog"][aria-labelledby="settings-dialog-title"]').first()
}

function settingsCategoryButton(dialog: Locator, label: RegExp): Locator {
  return dialog.locator('nav button').filter({ hasText: label }).first()
}

interface ThemeRuntimeSnapshot {
  density?: string
  durationTheme: string
  motionLevel?: string
  motionScale: string
  palette?: string
  radiusDefault: string
  radiusFamily?: string
  surface900: string
  theme?: string
  topologyEdgeNetwork: string
  topologyNodeLabel: string
  topologyNodeProcess: string
}

interface ThemeVisualContinuityFrame {
  bodyTextLength: number
  frame: number
  rootBackground: string
  rootPalette?: string
  rootTheme?: string
  shellArea: number
  shellDisplay: string
  shellOpacity: string
  shellVisibility: string
  surface900: string
}

async function readThemeRuntimeSnapshot(window: Page): Promise<ThemeRuntimeSnapshot> {
  return window.evaluate(() => {
    const root = document.documentElement
    const style = getComputedStyle(root)
    return {
      density: root.dataset.density,
      durationTheme: style.getPropertyValue('--duration-theme').trim(),
      motionLevel: root.dataset.motionLevel,
      motionScale: style.getPropertyValue('--motion-scale').trim(),
      palette: root.dataset.palette,
      radiusDefault: style.getPropertyValue('--radius-default').trim(),
      radiusFamily: root.dataset.radiusFamily,
      surface900: style.getPropertyValue('--surface-900').trim(),
      theme: root.dataset.theme,
      topologyEdgeNetwork: style.getPropertyValue('--topology-edge-network').trim(),
      topologyNodeLabel: style.getPropertyValue('--topology-node-label').trim(),
      topologyNodeProcess: style.getPropertyValue('--topology-node-process').trim()
    }
  })
}

async function collectThemeVisualContinuityFrames(window: Page, frameCount: number): Promise<ThemeVisualContinuityFrame[]> {
  return window.evaluate((framesToCollect) => {
    return new Promise<ThemeVisualContinuityFrame[]>((resolve) => {
      const frames: ThemeVisualContinuityFrame[] = []

      const sample = (frame: number): void => {
        const root = document.documentElement
        const rootStyle = getComputedStyle(root)
        const shell = document.querySelector<HTMLElement>('.responsive-app-shell')
        const shellRect = shell?.getBoundingClientRect()
        const shellStyle = shell ? getComputedStyle(shell) : null

        frames.push({
          bodyTextLength: (document.body.textContent ?? '').trim().length,
          frame,
          rootBackground: rootStyle.backgroundColor,
          rootPalette: root.dataset.palette,
          rootTheme: root.dataset.theme,
          shellArea: shellRect ? Math.round(shellRect.width * shellRect.height) : 0,
          shellDisplay: shellStyle?.display ?? 'missing',
          shellOpacity: shellStyle?.opacity ?? 'missing',
          shellVisibility: shellStyle?.visibility ?? 'missing',
          surface900: rootStyle.getPropertyValue('--surface-900').trim()
        })

        if (frames.length >= framesToCollect) {
          resolve(frames)
          return
        }

        requestAnimationFrame(() => sample(frame + 1))
      }

      requestAnimationFrame(() => sample(0))
    })
  }, frameCount)
}

async function resetAppearanceSettings(window: Page): Promise<void> {
  await window.evaluate(async () => {
    await window.devhub.settings.update({
      appearance: {
        theme: 'constructivism',
        layoutMode: 'auto',
        informationDensity: 'standard',
        radiusFamily: 'sharp',
        motionLevel: 'balanced',
        enableAnimations: true
      }
    })
    localStorage.setItem('devhub:layout-mode', 'auto')
    window.dispatchEvent(new CustomEvent('devhub:layout-mode-change', { detail: 'auto' }))
  })
}

async function seedAppearanceSettings(window: Page): Promise<void> {
  await window.evaluate(async () => {
    await window.devhub.settings.update({
      appearance: {
        theme: 'modern-light',
        layoutMode: 'auto',
        informationDensity: 'standard',
        radiusFamily: 'soft',
        motionLevel: 'balanced',
        enableAnimations: true
      }
    })
    localStorage.setItem('devhub:layout-mode', 'auto')
    window.dispatchEvent(new CustomEvent('devhub:layout-mode-change', { detail: 'auto' }))
  })
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
}

async function getRuntimePreloadSurfaceSnapshot(window: Page): Promise<RuntimePreloadSurfaceSnapshot> {
  return window.evaluate(() => {
    function flatten(
      value: Record<string, unknown> | null | undefined,
      prefix = '',
      collector: Record<string, string> = {}
    ): Record<string, string> {
      if (!value || typeof value !== 'object') {
        return collector
      }

      for (const key of Object.keys(value).sort()) {
        const nextPath = prefix ? `${prefix}.${key}` : key
        const child = value[key]
        collector[nextPath] = typeof child

        if (child && typeof child === 'object') {
          flatten(child as Record<string, unknown>, nextPath, collector)
        }
      }

      return collector
    }

    const devhub = window.devhub as Record<string, unknown> | undefined
    return {
      hasDevObs: Boolean(devhub?.devObs),
      topLevelKeys: Object.keys(devhub ?? {})
        .filter((key) => key !== 'devObs')
        .sort(),
      typeMap: flatten(devhub)
    }
  })
}

async function assertDevObservabilityReady(window: Page, panel: Locator): Promise<void> {
  await expect.poll(async () => {
    return window.evaluate(async () => {
      const api = (window as typeof window & {
        devhub?: {
          devObs?: RuntimeDevObsApi
        }
      }).devhub?.devObs

      if (!api) {
        return null
      }

      const [snapshot, throttleReport] = await Promise.all([
        api.getRuntimeMetrics(),
        api.getThrottleReport()
      ])

      return {
        backpressureRows: snapshot.extended.scannerBackpressure.length,
        cpuReady: Number.isFinite(snapshot.cpuNow) && Number.isFinite(snapshot.cpu5mAvg),
        ipcChannels: Object.keys(throttleReport.channels).length,
        ipcTop: snapshot.ipcRpm.top.length,
        mainSamples: snapshot.mainRss.items.length,
        psChildCountReady: Number.isFinite(snapshot.psChildCount),
        rendererSamples: snapshot.rendererRss.items.length
      }
    })
  }, {
    message: '等待 DevObservabilityPanel 完成首次真实采样',
    timeout: 15000
  }).toMatchObject({
    cpuReady: true,
    ipcChannels: expect.any(Number),
    ipcTop: expect.any(Number),
    mainSamples: expect.any(Number),
    psChildCountReady: true,
    rendererSamples: expect.any(Number)
  })

  await expect.poll(async () => {
    const apiReady = await window.evaluate(async () => {
      const api = (window as typeof window & {
        devhub?: {
          devObs?: RuntimeDevObsApi
        }
      }).devhub?.devObs

      if (!api) {
        return false
      }

      const snapshot = await api.getRuntimeMetrics()
      return (
        snapshot.ipcRpm.top.length >= 1
        && snapshot.mainRss.items.length >= 1
        && snapshot.rendererRss.items.length >= 1
      )
    })

    const reactCommitsText = await panel.getByTestId('metric-react-commits').innerText()
    const hasReactCommitRows = !reactCommitsText.includes('暂无 React commit 采样')

    return apiReady && hasReactCommitRows
  }, {
    message: '等待 6 项核心指标进入非空状态',
    timeout: 15000
  }).toBe(true)
}

function getPreferredSystemProcessDescriptors(): SystemProcessDescriptor[] {
  const stdout = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `
      + `Get-CimInstance Win32_Process `
      + `| Select-Object ProcessId,Name `
      + `| ConvertTo-Json -Compress`
    ],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    }
  )

  const raw = JSON.parse(stdout) as Array<{ Name?: string; ProcessId?: number }> | { Name?: string; ProcessId?: number } | null
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : []
  const preferredNames = [
    'system',
    'registry',
    'lsass.exe',
    'csrss.exe',
    'winlogon.exe',
    'services.exe',
    'svchost.exe'
  ]

  const normalizedRows = rows
    .map((row) => ({
      name: String(row.Name ?? ''),
      pid: Number(row.ProcessId ?? 0)
    }))
    .filter((row) => row.name && Number.isInteger(row.pid) && row.pid > 0)

  const preferred: SystemProcessDescriptor[] = []
  for (const preferredName of preferredNames) {
    const match = normalizedRows.find((row) => row.name.toLowerCase() === preferredName)
    if (match) {
      preferred.push(match)
    }
  }

  return preferred
}

test.describe('DevHub E2E Tests', () => {
  test('应用应该正常启动并显示主窗口', async () => {
    const { electronApp, window } = await launchApp()
    try {
      await expect(buttonByText(window, '日志')).toBeVisible({ timeout: 15000 })
      await expect(buttonByText(window, '监控')).toBeVisible()
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('P1.1 脚本下拉菜单通过 Portal 渲染且可键盘关闭', async () => {
    const { electronApp, window } = await launchApp()
    try {
      const trigger = window.getByTestId('script-selector-trigger').first()
      await expect(trigger).toBeVisible({ timeout: 15000 })
      await trigger.click()

      const menu = window.getByTestId('script-selector-menu')
      await expect(menu).toBeVisible({ timeout: 5000 })
      await expect.poll(async () => menu.getByTestId('script-selector-option').count(), {
        message: '等待脚本下拉菜单渲染多个真实脚本选项',
        timeout: 5000
      }).toBeGreaterThan(1)

      const geometry = await menu.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return {
          bottom: rect.bottom,
          left: rect.left,
          parentIsBody: element.parentElement === document.body,
          position: style.position,
          right: rect.right,
          top: rect.top,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          zIndex: Number(style.zIndex)
        }
      })

      expect(geometry.parentIsBody).toBe(true)
      expect(geometry.position).toBe('fixed')
      expect(geometry.zIndex).toBeGreaterThanOrEqual(1000)
      expect(geometry.left).toBeGreaterThanOrEqual(0)
      expect(geometry.top).toBeGreaterThanOrEqual(0)
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight)

      await menu.getByTestId('script-selector-option').first().focus()
      await window.keyboard.press('Escape')
      await expect(menu).toBeHidden({ timeout: 5000 })
      await expect(trigger).toBeFocused()
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('P1.2-a 项目列表密度可从设置切换并同步虚拟行高', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()
    try {
      await dismissAutoDiscoveryIfPresent(window)

      const projectList = window.getByTestId('project-list-scroll')
      await expect(projectList).toBeVisible({ timeout: 15000 })
      await expect.poll(async () => projectList.getAttribute('data-estimated-row-height'), {
        message: '等待项目列表虚拟化容器暴露真实行高',
        timeout: 5000
      }).not.toBeNull()

      const projectCount = await window.evaluate(() => {
        const api = (window as typeof window & {
          devhub?: {
            projects?: {
              list?: () => Promise<unknown[]>
            }
          }
        }).devhub

        return api?.projects?.list?.().then((projects) => projects.length) ?? Promise.resolve(0)
      })
      expect(projectCount).toBeGreaterThanOrEqual(0)

      await window.getByTestId('sidebar-settings-button').click()
      await expect(settingsDialogByContract(window)).toBeVisible({ timeout: 5000 })

      const densitySelect = window.getByLabel('信息密度')
      await expect(densitySelect).toBeVisible({ timeout: 5000 })

      await densitySelect.selectOption('compact')
      await expect.poll(async () => window.evaluate(() => document.documentElement.dataset.density), {
        message: '等待 compact 信息密度写入 html dataset',
        timeout: 5000
      }).toBe('compact')
      await expect(projectList).toHaveAttribute('data-density', 'compact')
      await expect(projectList).toHaveAttribute('data-estimated-row-height', '64')

      await densitySelect.selectOption('comfortable')
      await expect.poll(async () => window.evaluate(() => document.documentElement.dataset.density), {
        message: '等待 comfortable 信息密度写入 html dataset',
        timeout: 5000
      }).toBe('comfortable')
      await expect(projectList).toHaveAttribute('data-density', 'comfortable')
      await expect(projectList).toHaveAttribute('data-estimated-row-height', '144')

      const savedDensity = await window.evaluate(async () => {
        const settings = await window.devhub.settings.get()
        return settings.appearance.informationDensity
      })
      expect(savedDensity).toBe('comfortable')

      await window.getByRole('button', { name: '关闭', exact: true }).click()
      await expect(settingsDialogByContract(window)).toBeHidden({ timeout: 5000 })
      await expect(projectList).toBeVisible()
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('P1.2-b 项目打开入口可真实调用 VS Code Cursor 资源管理器和终端', async () => {
    test.setTimeout(120_000)
    const { electronApp, window } = await launchApp()
    const processNames = ['Code', 'Cursor', 'powershell']
    const before = listWindowsProcessNames(processNames)
    let after: ProcessProbeSnapshot[] = []

    try {
      await dismissAutoDiscoveryIfPresent(window)

      const projectPath = process.cwd()
      const results = await openProjectInTargetsThroughPreload(window, projectPath)
      expect(results).toEqual([
        { error: null, ok: true, target: 'vscode' },
        { error: null, ok: true, target: 'cursor' },
        { error: null, ok: true, target: 'explorer' },
        { error: null, ok: true, target: 'terminal' }
      ])

      await expect.poll(() => {
        after = listWindowsProcessNames(processNames)
        return processDelta(before, after, 'powershell').length
      }, {
        message: '等待真实终端入口打开新的 PowerShell 进程',
        timeout: 15000
      }).toBeGreaterThan(0)

      after = listWindowsProcessNames(processNames)
      const codeSeen = after.some((row) => row.name.toLowerCase() === 'code')
      const cursorSeen = after.some((row) => row.name.toLowerCase() === 'cursor')
      expect(codeSeen, 'VS Code 入口应打开或复用真实 Code.exe 进程').toBe(true)
      expect(cursorSeen, 'Cursor 入口应打开或复用真实 Cursor.exe 进程').toBe(true)
    } finally {
      after = listWindowsProcessNames(processNames)
      for (const row of [...processDelta(before, after, 'powershell'), ...processDelta(before, after, 'Code'), ...processDelta(before, after, 'Cursor')]) {
        killWindowsProcessTree(row.pid)
      }
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-01 packaged CLI parser emits real stream and progress through preload', async () => {
    test.setTimeout(60_000)
    const { electronApp, window } = await launchApp()
    const instanceId = `r8c-spec01-${Date.now()}`

    try {
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate((id) => {
        const host = window as typeof window & Spec01CliEventWindow
        host.__r8Spec01CliCleanup?.()
        host.__r8Spec01CliEvents = []
        host.__r8Spec01CliCleanup = window.devhub.r8.cli.onEvent((event) => {
          if (event.instanceId === id) {
            host.__r8Spec01CliEvents?.push(event)
          }
        })
      }, instanceId)

      const feedReport = await electronApp.evaluate((_electron, id) => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        if (!hooks) {
          throw new Error('Runtime test hooks are not available for R8.C spec-01')
        }
        const progressEvents = hooks.feedCliChunkForTests({
          chunk: JSON.stringify({
            type: 'assistant',
            message: {
              id: 'msg-r8c-spec01-e2e',
              role: 'assistant',
              model: 'claude-sonnet-4',
              content: [{ type: 'text', text: 'Step 2/4 running validation' }],
              usage: { input_tokens: 60, output_tokens: 20 }
            }
          }),
          instanceId: id,
          strategy: 'ndjson',
          stream: 'stdout',
          tool: 'claude'
        })
        return {
          eventTypes: progressEvents.map(event => event.eventType),
          rawSources: progressEvents.map(event => event.rawSource),
          total: progressEvents.length
        }
      }, instanceId)

      expect(feedReport).toMatchObject({
        eventTypes: ['progress_pct'],
        rawSources: ['ndjson'],
        total: 1
      })

      await expect.poll(async () => window.evaluate((id) => {
        const host = window as typeof window & Spec01CliEventWindow
        return (host.__r8Spec01CliEvents ?? []).filter(event => event.instanceId === id).length
      }, instanceId), {
        message: '等待 packaged Electron renderer 通过 preload 收到 cli:event-stream',
        timeout: 10_000
      }).toBeGreaterThanOrEqual(1)

      const streamedEvents = await window.evaluate((id) => {
        const host = window as typeof window & Spec01CliEventWindow
        return (host.__r8Spec01CliEvents ?? []).filter(event => event.instanceId === id)
      }, instanceId)
      expect(streamedEvents.map(event => event.eventType)).toEqual(['progress_pct'])
      expect(streamedEvents.every(event => event.tool === 'claude' && event.rawSource === 'ndjson')).toBe(true)

      const progressReport = await window.evaluate(async (id): Promise<E2ECliProgressReport> => {
        const report = await window.devhub.r8.cli.getProgress({ instanceId: id, limit: 20, tool: 'claude' })
        return {
          count: report.count,
          events: report.events.filter(event => event.instanceId === id),
          latest: report.latest?.instanceId === id ? report.latest : null,
          progress: report.progress
        }
      }, instanceId)
      expect(progressReport.events.map(event => event.eventType)).toEqual(['progress_pct'])
      expect(progressReport.latest?.eventType).toBe('progress_pct')
      expect(progressReport.progress?.confidence).toBe(0.7)
      expect(progressReport.progress?.instanceId).toBe(instanceId)
      expect(progressReport.progress?.percent).toBeCloseTo(0.2, 5)
      expect(progressReport.progress?.source).toBe('cli-real')

      const sessions = await window.evaluate(async (id): Promise<E2EParseSession[]> => {
        const allSessions = await window.devhub.r8.cli.getSessions()
        return allSessions.filter(session => session.instanceId === id)
      }, instanceId)
      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toMatchObject({
        eventsEmitted: 1,
        instanceId,
        strategy: 'ndjson',
        tool: 'claude'
      })
    } finally {
      await window.evaluate(() => {
        const host = window as typeof window & Spec01CliEventWindow
        host.__r8Spec01CliCleanup?.()
        delete host.__r8Spec01CliCleanup
        delete host.__r8Spec01CliEvents
      }).catch(() => undefined)
      await electronApp.evaluate(async () => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        await hooks?.disposeRuntimeForTests()
      }).catch(() => undefined)
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-03 Claude stream-json lifecycle reaches preload stream and cost summary', async () => {
    test.setTimeout(60_000)
    const { electronApp, window } = await launchApp()
    const instanceId = `r8c-spec03-${Date.now()}`

    try {
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate((id) => {
        const host = window as typeof window & Spec03ClaudeStreamWindow
        host.__r8Spec03ClaudeCleanup?.()
        host.__r8Spec03CliCleanup?.()
        host.__r8Spec03ClaudeEvents = []
        host.__r8Spec03CliEvents = []
        host.__r8Spec03ClaudeCleanup = window.devhub.r8.ai.onClaudeStreamEvent((payload) => {
          const event = payload as unknown as Record<string, unknown>
          if (event.type === 'system' || event.type === 'assistant' || event.type === 'result') {
            host.__r8Spec03ClaudeEvents?.push(event)
          }
        })
        host.__r8Spec03CliCleanup = window.devhub.r8.cli.onEvent((event) => {
          if (event.instanceId === id) {
            host.__r8Spec03CliEvents?.push(event)
          }
        })
      }, instanceId)

      const feedReport = await electronApp.evaluate((_electron, id) => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        if (!hooks) {
          throw new Error('Runtime test hooks are not available for R8.C spec-03')
        }
        const lines = [
          {
            type: 'system',
            subtype: 'init',
            cwd: process.cwd(),
            session_id: `${id}-session`,
            tools: ['Read'],
            model: 'claude-sonnet-4'
          },
          {
            type: 'assistant',
            message: {
              id: `${id}-message`,
              role: 'assistant',
              model: 'claude-sonnet-4',
              content: [{ type: 'tool_use', id: `${id}-tool`, name: 'Read', input: { file_path: 'README.md' } }],
              usage: { input_tokens: 10, output_tokens: 2 }
            },
            parent_tool_use_id: null
          },
          {
            type: 'result',
            subtype: 'success',
            is_error: false,
            duration_ms: 1200,
            total_cost_usd: 0.001,
            usage: { input_tokens: 10, output_tokens: 2 },
            result: 'done'
          }
        ]
        const events = lines.flatMap((line) => hooks.feedCliChunkForTests({
          chunk: JSON.stringify(line),
          instanceId: id,
          sessionId: `${id}-session`,
          strategy: 'ndjson',
          stream: 'stdout',
          tool: 'claude'
        }))
        return {
          eventTypes: events.map(event => event.eventType),
          rawSources: events.map(event => event.rawSource),
          total: events.length
        }
      }, instanceId)

      expect(feedReport).toMatchObject({
        eventTypes: ['phase_marker', 'tool_invocation', 'completion'],
        rawSources: ['ndjson', 'ndjson', 'ndjson'],
        total: 3
      })

      await expect.poll(async () => window.evaluate((id) => {
        const host = window as typeof window & Spec03ClaudeStreamWindow
        return {
          claude: (host.__r8Spec03ClaudeEvents ?? []).length,
          cli: (host.__r8Spec03CliEvents ?? []).filter(event => event.instanceId === id).length
        }
      }, instanceId), {
        message: '等待 packaged Electron renderer 收到 Claude stream-json 和 cli:event-stream',
        timeout: 10_000
      }).toMatchObject({ claude: 3, cli: 3 })

      const streamTypes = await window.evaluate(() => {
        const host = window as typeof window & Spec03ClaudeStreamWindow
        return (host.__r8Spec03ClaudeEvents ?? []).map(event => ({
          schemaVersion: event.schemaVersion,
          type: event.type
        }))
      })
      expect(streamTypes).toEqual([
        { schemaVersion: 1, type: 'system' },
        { schemaVersion: 1, type: 'assistant' },
        { schemaVersion: 1, type: 'result' }
      ])

      const progressReport = await window.evaluate(async (id): Promise<E2ECliProgressReport> => {
        const report = await window.devhub.r8.cli.getProgress({ instanceId: id, limit: 20, tool: 'claude' })
        return {
          count: report.count,
          events: report.events.filter(event => event.instanceId === id),
          latest: report.latest?.instanceId === id ? report.latest : null,
          progress: report.progress
        }
      }, instanceId)
      expect(progressReport.events.map(event => event.eventType)).toEqual(['phase_marker', 'tool_invocation', 'completion'])
      expect(progressReport.latest?.eventType).toBe('completion')
      expect(progressReport.events[1].payload?.tool).toBe('Read')

      const costSummary = await window.evaluate(async (id) => window.devhub.r8.ai.claudeCostSummary(id), instanceId)
      expect(costSummary).toEqual({
        durationMs: 1200,
        totalCostUsd: 0.001,
        totalInputTokens: 10,
        totalOutputTokens: 2
      })
    } finally {
      await window.evaluate(() => {
        const host = window as typeof window & Spec03ClaudeStreamWindow
        host.__r8Spec03ClaudeCleanup?.()
        host.__r8Spec03CliCleanup?.()
        delete host.__r8Spec03ClaudeCleanup
        delete host.__r8Spec03ClaudeEvents
        delete host.__r8Spec03CliCleanup
        delete host.__r8Spec03CliEvents
      }).catch(() => undefined)
      await electronApp.evaluate(async () => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        await hooks?.disposeRuntimeForTests()
      }).catch(() => undefined)
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-02 packaged Codex shim transparently passes marker stdout into parser stream', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()
    const markerLine = 'DEVHUB::MARKER::v=1::PHASE=coding'
    let previousOverridePath: string | null = null

    try {
      await dismissAutoDiscoveryIfPresent(window)
      previousOverridePath = await window.evaluate(async () => {
        const state = await window.devhub.r8.cli.detectAll({ force: true })
        const codex = state.results.find(result => result.tool === 'codex')
        return codex?.detectStrategy === 'user-override' && codex.path ? codex.path : null
      })
      await window.evaluate(async (nodePath) => {
        await window.devhub.r8.cli.setToolOverride('codex', nodePath, 'e2e-shim')
        const host = window as typeof window & Spec02ShimEventWindow
        host.__r8Spec02ShimCleanup?.()
        host.__r8Spec02ShimEvents = []
        host.__r8Spec02ShimCleanup = window.devhub.r8.cli.onEvent((event) => {
          if (event.tool === 'codex') {
            host.__r8Spec02ShimEvents?.push(event)
          }
        })
      }, process.execPath)

      const installed = await window.evaluate(async (): Promise<E2EShimInstallResult> => {
        const response = await window.devhub.r8.cli.installShim('codex', 'e2e-shim')
        return response as E2EShimInstallResult
      })
      expect(installed.success).toBe(true)
      expect(installed.manifest.realExePath).toBe(process.execPath)
      expect(installed.pipeServer).toMatchObject({ error: null, listening: true, tool: 'codex' })
      expect(existsSync(installed.shimPath)).toBe(true)
      expect(installed.artifactKind).toBe('packaged-executable')
      expect(installed.shimPath.toLowerCase()).toMatch(process.platform === 'win32' ? /codex\.exe$/ : /codex$/)
      expect(installed.shimManifestPath).toBe(`${installed.shimPath}.json`)
      expect(existsSync(installed.shimManifestPath as string)).toBe(true)

      const passthrough = await runNodeShimPassthrough(installed.shimPath, markerLine)
      expect(passthrough.exitCode).toBe(0)
      expect(passthrough.stderr).toBe('')
      expect(passthrough.stdout).toContain(markerLine)

      await expect.poll(async () => window.evaluate((line) => {
        const host = window as typeof window & Spec02ShimEventWindow
        return (host.__r8Spec02ShimEvents ?? []).some(event => event.rawSource === 'shim' && event.line === line && event.eventType === 'phase_marker')
      }, markerLine), {
        message: '等待 generated shim 通过命名管道进入 CodexParser 并转发 cli:event-stream',
        timeout: 10_000
      }).toBe(true)

      const report = await window.evaluate(async (line) => {
        const host = window as typeof window & Spec02ShimEventWindow
        const matching = (host.__r8Spec02ShimEvents ?? []).filter(event => event.rawSource === 'shim' && event.line === line)
        const status = await window.devhub.r8.cli.shimStatus()
        return {
          events: matching,
          manifest: status.codex
        }
      }, markerLine)

      expect(report.events.some(event => event.phase === 'working' && event.payload?.field === 'PHASE' && event.payload?.phase === 'coding')).toBe(true)
      expect(report.manifest).toMatchObject({
        realExePath: process.execPath,
        shimExePath: installed.shimPath,
        toolName: 'codex'
      })
    } finally {
      await window.evaluate(async (path) => {
        const host = window as typeof window & Spec02ShimEventWindow
        host.__r8Spec02ShimCleanup?.()
        delete host.__r8Spec02ShimCleanup
        delete host.__r8Spec02ShimEvents
        await window.devhub.r8.cli.uninstallShim('codex', 'e2e-restore').catch(() => undefined)
        if (path) {
          await window.devhub.r8.cli.setToolOverride('codex', path, 'e2e-restore')
          return
        }
        await window.devhub.r8.cli.clearToolOverride('codex', 'e2e-restore')
      }, previousOverridePath).catch(() => undefined)
      await electronApp.evaluate(async () => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        await hooks?.disposeRuntimeForTests()
      }).catch(() => undefined)
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-04 packaged Gemini shim captures stdout parsing and env injection', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()
    let previousOverridePath: string | null = null
    const scriptSource = [
      'setTimeout(() => {',
      'console.log("Thinking...")',
      'console.log("Running tool: read_file")',
      'console.log(`${process.env.GEMINI_OUTPUT_FORMAT}:${process.env.DEVHUB_SHIM_MARKER_PROTOCOL}`)',
      '}, 250)'
    ].join(';')

    try {
      await dismissAutoDiscoveryIfPresent(window)
      previousOverridePath = await window.evaluate(async () => {
        const state = await window.devhub.r8.cli.detectAll({ force: true })
        const gemini = state.results.find(result => result.tool === 'gemini')
        return gemini?.detectStrategy === 'user-override' && gemini.path ? gemini.path : null
      })
      await window.evaluate(async (nodePath) => {
        await window.devhub.r8.cli.setToolOverride('gemini', nodePath, 'e2e-shim')
        const host = window as typeof window & Spec04GeminiShimEventWindow
        host.__r8Spec04GeminiShimCleanup?.()
        host.__r8Spec04GeminiShimEvents = []
        host.__r8Spec04GeminiShimCleanup = window.devhub.r8.cli.onEvent((event) => {
          if (event.tool === 'gemini') {
            host.__r8Spec04GeminiShimEvents?.push(event)
          }
        })
      }, process.execPath)

      const installed = await window.evaluate(async (): Promise<E2EShimInstallResult> => {
        const response = await window.devhub.r8.cli.installShim('gemini', 'e2e-shim')
        return response as E2EShimInstallResult
      })
      expect(installed.success).toBe(true)
      expect(installed.manifest.realExePath).toBe(process.execPath)
      expect(installed.pipeServer).toMatchObject({ error: null, listening: true, tool: 'gemini' })
      expect(existsSync(installed.shimPath)).toBe(true)

      const passthrough = await runNodeShimPassthrough(installed.shimPath, 'Thinking...', scriptSource)
      expect(passthrough.exitCode).toBe(0)
      expect(passthrough.stderr).toBe('')
      expect(passthrough.stdout).toContain('Thinking...')
      expect(passthrough.stdout).toContain('Running tool: read_file')
      expect(passthrough.stdout).toContain('json:v1')

      await expect.poll(async () => window.evaluate(() => {
        const host = window as typeof window & Spec04GeminiShimEventWindow
        const events = host.__r8Spec04GeminiShimEvents ?? []
        return {
          envLine: events.some(event => event.rawSource === 'line' && event.line.includes('json:v1') && event.eventType === 'message-out'),
          thinking: events.some(event => event.rawSource === 'line' && event.line.includes('Thinking...') && event.eventType === 'progress'),
          toolCall: events.some(event => event.rawSource === 'line' && event.line.includes('Running tool: read_file') && event.eventType === 'tool-use')
        }
      }), {
        message: '等待 generated gemini shim 通过命名管道进入 GeminiParser 并转发 cli:event-stream',
        timeout: 10_000
      }).toMatchObject({ envLine: true, thinking: true, toolCall: true })

      const report = await window.evaluate(async () => {
        const host = window as typeof window & Spec04GeminiShimEventWindow
        const status = await window.devhub.r8.cli.shimStatus()
        return {
          events: host.__r8Spec04GeminiShimEvents ?? [],
          manifest: status.gemini
        }
      })

      expect(report.events.some(event => event.line.includes('Thinking...') && event.phase === 'thinking')).toBe(true)
      expect(report.events.some(event => event.line.includes('Running tool: read_file') && event.eventType === 'tool-use')).toBe(true)
      expect(report.manifest).toMatchObject({
        realExePath: process.execPath,
        shimExePath: installed.shimPath,
        toolName: 'gemini'
      })
    } finally {
      await window.evaluate(async (path) => {
        const host = window as typeof window & Spec04GeminiShimEventWindow
        host.__r8Spec04GeminiShimCleanup?.()
        delete host.__r8Spec04GeminiShimCleanup
        delete host.__r8Spec04GeminiShimEvents
        await window.devhub.r8.cli.uninstallShim('gemini', 'e2e-restore').catch(() => undefined)
        if (path) {
          await window.devhub.r8.cli.setToolOverride('gemini', path, 'e2e-restore')
          return
        }
        await window.devhub.r8.cli.clearToolOverride('gemini', 'e2e-restore')
      }, previousOverridePath).catch(() => undefined)
      await electronApp.evaluate(async () => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        await hooks?.disposeRuntimeForTests()
      }).catch(() => undefined)
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-20 packaged DAG orchestrator builds layers exports and readiness through real IPC', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()
    try {
      await dismissAutoDiscoveryIfPresent(window)
      const report = await window.evaluate(async () => {
        const sessionId = `e2e-dag-${Date.now()}`
        const snapshot = await window.devhub.r8.dag.build({
          sessionId,
          nodes: [
            { id: 'A', dependencyIds: [], priority: 90, parallelGroup: null, parallelGroupMax: null, estimatedDurationMs: 1000 },
            { id: 'B', dependencyIds: ['A'], priority: 70, parallelGroup: 'frontend', parallelGroupMax: 2, estimatedDurationMs: 1500 },
            { id: 'C', dependencyIds: ['A'], priority: 60, parallelGroup: 'frontend', parallelGroupMax: 2, estimatedDurationMs: 500 },
            { id: 'D', dependencyIds: ['B', 'C'], priority: 50, parallelGroup: null, parallelGroupMax: null, estimatedDurationMs: 250 }
          ]
        }) as { hash?: string; layers: string[][]; ready: string[]; sessionId: string; totalLayers: number }
        const secondLayer = await window.devhub.r8.dag.layer(sessionId, 1)
        const exported = await window.devhub.r8.dag.export(sessionId, 'mermaid')
        const readyB = await window.devhub.r8.dag.checkReady({ sessionId, taskId: 'B', completedIds: ['A'] }) as { ready: boolean; blockers: string[] }
        const readyD = await window.devhub.r8.dag.checkReady({ sessionId, taskId: 'D', completedIds: ['A', 'B'] }) as { ready: boolean; blockers: string[] }
        const cycle = await window.devhub.r8.dag.detectCycle({
          nodes: [
            { id: 'X', dependencyIds: ['Y'] },
            { id: 'Y', dependencyIds: ['X'] }
          ]
        })
        return {
          cycle,
          exported,
          readyB,
          readyD,
          secondLayer,
          snapshot
        }
      })

      expect(report.snapshot.sessionId).toMatch(/^e2e-dag-/)
      expect(report.snapshot.hash).toBeTruthy()
      expect(report.snapshot.layers).toEqual([['A'], ['B', 'C'], ['D']])
      expect(report.snapshot.ready).toEqual(['A'])
      expect(report.snapshot.totalLayers).toBe(3)
      expect(report.secondLayer).toEqual({ taskIds: ['B', 'C'] })
      expect(report.exported).toMatchObject({ format: 'mermaid', mimeType: 'text/vnd.mermaid', sessionId: report.snapshot.sessionId })
      expect(report.exported.content).toContain('graph TD')
      expect(report.exported.content).toContain('A --> B')
      expect(report.readyB).toMatchObject({ ready: true, blockers: [] })
      expect(report.readyD.ready).toBe(false)
      expect(report.readyD.blockers).toEqual(['C'])
      expect(report.cycle.hasCycle).toBe(true)
      expect(report.cycle.cyclePaths?.flat()).toEqual(expect.arrayContaining(['X', 'Y']))
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-19 inject targets covers first-time whitelist drawer and countdown cancel fixture', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()
    const taskId = `spec19-${Date.now()}`
    const targetAlias = `codex-${taskId}`

    try {
      await resizeMainWindow(electronApp, 1440, 900)
      await window.setViewportSize({ width: 1440, height: 900 })
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate(async ({ cwd, taskId }) => {
        await window.devhub.r8.csv.enqueueRow({
          id: taskId,
          group: 'r8c-spec19-e2e',
          tool: 'codex',
          prompt: 'R8.C spec-19 verifies real renderer inject target controls',
          cwd,
          dry_run: true
        })
        await window.devhub.r8.inject.configureCountdown({
          defaultMs: 3_000,
          confirmedBy: 'e2e-spec19'
        })
        window.dispatchEvent(new Event('devhub:open-monitor'))
      }, { cwd: process.cwd(), taskId })

      await expect(window.getByText('SYSTEM MONITOR')).toBeVisible({ timeout: 15_000 })
      await window.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'r8-ops' } }))
      })
      await expect(window.getByText('R8 OPERATIONS')).toBeVisible({ timeout: 15_000 })

      const firstTimeResult = await window.evaluate(async (alias) => {
        const result = await window.devhub.r8.inject.resolveTarget({
          selector: 'alias',
          aliasOrId: alias,
          scenario: 'manual-template'
        })
        return result as { ok: boolean; whitelistGate: string; countdownMs: number; target: { resolvedAlias: string | null } | null }
      }, targetAlias)
      expect(firstTimeResult).toMatchObject({
        ok: false,
        whitelistGate: 'first-time-needed',
        target: { resolvedAlias: targetAlias }
      })
      expect(firstTimeResult.countdownMs).toBeGreaterThan(0)

      const firstTimeModal = window.getByTestId('inject-first-time-modal')
      await expect(firstTimeModal).toBeVisible({ timeout: 15_000 })
      await firstTimeModal.getByTestId('inject-first-time-duration-24h').check()
      await firstTimeModal.getByTestId('inject-first-time-scope-instance').check()
      await firstTimeModal.getByTestId('inject-first-time-confirm').click()
      await expect(firstTimeModal).toBeHidden({ timeout: 15_000 })

      await expect.poll(async () => window.evaluate(async (alias) => {
        const entries = await window.devhub.r8.inject.whitelist({ scope: 'instance' }) as Array<{ pattern: string; scope: string; duration?: string; enabled?: boolean }>
        return entries.some(entry => entry.pattern === alias && entry.scope === 'instance' && entry.duration === '24h' && entry.enabled !== false)
      }, targetAlias), {
        message: 'waiting for first-time modal to persist a real whitelist entry',
        timeout: 15_000
      }).toBe(true)

      await window.getByTestId('open-inject-whitelist-drawer').scrollIntoViewIfNeeded()
      await window.getByTestId('open-inject-whitelist-drawer').click()
      const whitelistDrawer = window.getByTestId('inject-whitelist-drawer')
      await expect(whitelistDrawer).toBeVisible({ timeout: 15_000 })
      await expect(whitelistDrawer.getByText(targetAlias)).toBeVisible({ timeout: 15_000 })

      await window.evaluate((alias) => {
        const host = window as typeof window & {
          __r8Spec19InjectResult?: Promise<unknown>
        }
        host.__r8Spec19InjectResult = window.devhub.r8.inject.execute({
          targetAlias: alias,
          target: { selector: 'alias', aliasOrId: alias },
          scenario: 'manual-template',
          mode: 'clipboard-paste',
          text: 'R8.C spec-19 countdown cancellation proof',
          confirmedBy: 'e2e-spec19'
        })
      }, targetAlias)

      const countdownModal = window.getByTestId('inject-countdown-modal')
      await expect(countdownModal).toBeVisible({ timeout: 15_000 })
      await expect(countdownModal.getByTestId('inject-countdown-remaining')).toHaveText(/\d+ms/)
      await window.keyboard.press('Escape')
      await expect(countdownModal).toBeHidden({ timeout: 15_000 })

      const cancelledResult = await window.evaluate(async () => {
        const host = window as typeof window & {
          __r8Spec19InjectResult?: Promise<unknown>
        }
        const result = await host.__r8Spec19InjectResult
        delete host.__r8Spec19InjectResult
        return result as { status: string; success: boolean; targetAlias: string; error: string | null }
      })
      expect(cancelledResult).toMatchObject({
        status: 'cancelled',
        success: false,
        targetAlias,
        error: 'E_CANCELLED:inject countdown cancelled'
      })
    } finally {
      await window.evaluate(async (alias) => {
        const host = window as typeof window & {
          __r8Spec19InjectResult?: Promise<unknown>
        }
        delete host.__r8Spec19InjectResult
        const entries = await window.devhub.r8.inject.whitelist({ scope: 'instance' }) as Array<{ id: string; pattern: string }>
        for (const entry of entries.filter(item => item.pattern === alias)) {
          await window.devhub.r8.inject.removeWhitelist(entry.id, 'e2e-spec19-cleanup').catch(() => undefined)
        }
        await window.devhub.r8.inject.configureCountdown({
          defaultMs: 3_000,
          confirmedBy: 'e2e-spec19-cleanup'
        }).catch(() => undefined)
      }, targetAlias).catch(() => undefined)
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-21 DAG editor covers edit cycle views undo and external modify fixture', async () => {
    test.setTimeout(120_000)
    const csvDir = join(tmpdir(), `devhub-r8c-spec21-${Date.now()}`)
    const csvPath = join(csvDir, 'tasks.csv')
    const csvHeader = [
      'taskId',
      'taskName',
      'priority',
      'status',
      'tool',
      'skill',
      'inputFile',
      'inputArgs',
      'outputDir',
      'outputFormat',
      'tags',
      'dependsOn',
      'timeoutMs',
      'retries',
      'concurrencyKey',
      'createdAt',
      'scheduledAt',
      'note'
    ]
    const csvEscape = (value: string): string => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
    const csvDocument = (rows: Array<Record<string, string>>): string => [
      '# devhub-csv-version=1.0; runner=devhub; concurrentMax=2',
      csvHeader.join(','),
      ...rows.map(row => csvHeader.map(column => csvEscape(row[column] ?? '')).join(','))
    ].join('\n') + '\n'
    const baseRows = [
      {
        taskId: 'A',
        taskName: 'Root A',
        priority: 'P1',
        status: 'pending',
        tool: 'codex',
        skill: 'code-review',
        inputFile: 'src/app.ts',
        inputArgs: '{}',
        outputDir: 'out',
        outputFormat: 'md',
        tags: 'spec21',
        dependsOn: '',
        timeoutMs: '60000',
        retries: '1',
        concurrencyKey: 'spec21',
        createdAt: '2026-05-18T08:00:00Z',
        scheduledAt: 'now',
        note: 'spec21 e2e root'
      },
      {
        taskId: 'B',
        taskName: 'Child B',
        priority: 'P1',
        status: 'pending',
        tool: 'codex',
        skill: 'write-tests',
        inputFile: 'src/app.ts',
        inputArgs: '{}',
        outputDir: 'out',
        outputFormat: 'md',
        tags: 'spec21',
        dependsOn: '',
        timeoutMs: '60000',
        retries: '1',
        concurrencyKey: 'spec21',
        createdAt: '2026-05-18T08:01:00Z',
        scheduledAt: 'now',
        note: 'spec21 e2e child'
      }
    ]
    mkdirSync(csvDir, { recursive: true })
    writeFileSync(csvPath, csvDocument(baseRows), 'utf8')

    const { electronApp, window } = await launchApp()
    try {
      await resizeMainWindow(electronApp, 1440, 900)
      await window.setViewportSize({ width: 1440, height: 900 })
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate(() => {
        window.dispatchEvent(new Event('devhub:open-monitor'))
      })
      await expect(window.getByText('SYSTEM MONITOR')).toBeVisible({ timeout: 15_000 })
      await window.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'r8-ops' } }))
      })
      await expect(window.getByText('R8 OPERATIONS')).toBeVisible({ timeout: 15_000 })

      const panel = window.getByTestId('dag-editor-panel')
      await expect(panel).toBeVisible({ timeout: 20_000 })
      await panel.getByPlaceholder('D:/path/tasks.csv').fill(csvPath)
      await panel.getByRole('button', { name: '锁定并载入' }).click()
      await expect(panel.locator('[data-cy-id="A"]')).toBeVisible({ timeout: 20_000 })
      await expect(panel.getByTestId('dag-editor-cytoscape-canvas')).toHaveAttribute('data-cytoscape-engine', 'cytoscape')

      await panel.getByRole('button', { name: 'List' }).click()
      await panel.getByLabel('B dependsOn').fill('after:A')
      await expect(panel.getByLabel('B dependsOn')).toHaveValue('after:A')
      await panel.getByRole('button', { name: 'Canvas' }).click()
      await expect(panel.getByText('A -> B')).toBeVisible({ timeout: 10_000 })

      await panel.getByRole('button', { name: 'Undo' }).click()
      await panel.getByRole('button', { name: 'List' }).click()
      await expect(panel.getByLabel('B dependsOn')).toHaveValue('')

      await panel.getByLabel('A dependsOn').fill('after:B')
      await panel.getByLabel('B dependsOn').fill('after:A')
      await expect(panel.getByTestId('csv-save-btn')).toBeDisabled()
      await expect(panel.getByText('A -> B -> A')).toBeVisible({ timeout: 10_000 })

      await panel.getByRole('button', { name: 'Gantt' }).click()
      await expect(panel.getByText('等待无环 DAG snapshot')).toBeVisible()
      await panel.getByRole('button', { name: 'Kanban' }).click()
      await expect(panel.getByTestId('kanban-column-pending')).toBeVisible()
      await expect(panel.getByTestId('kanban-card-A')).toBeVisible()

      writeFileSync(csvPath, csvDocument([{ ...baseRows[0], taskName: 'Externally edited A' }]), 'utf8')
      const externalModal = panel.getByTestId('external-change-modal')
      await expect(externalModal).toBeVisible({ timeout: 20_000 })
      await expect(externalModal.getByRole('button', { name: '重新加载外部版本' })).toBeVisible()
      await expect(externalModal.getByRole('button', { name: '覆盖保存本地版本' })).toBeVisible()
      await externalModal.getByRole('button', { name: '继续本地编辑' }).click()
      await expect(externalModal).toBeHidden({ timeout: 10_000 })
    } finally {
      await closeElectronApp(electronApp)
      rmSync(csvDir, { recursive: true, force: true })
    }
  })

  test('R8.C spec-06 Settings 面板可保存真实 CLI 路径覆盖并重扫', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()
    let previousOverridePath: string | null = null
    try {
      await dismissAutoDiscoveryIfPresent(window)
      previousOverridePath = await window.evaluate(async () => {
        const state = await window.devhub.r8.cli.detectAll({ force: true })
        const codex = state.results.find(result => result.tool === 'codex')
        return codex?.detectStrategy === 'user-override' && codex.path ? codex.path : null
      })
      await window.getByTestId('sidebar-settings-button').click()
      const dialog = settingsDialogByContract(window)
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await expect(dialog.getByText('加载中...')).toBeHidden({ timeout: 15000 })
      await settingsCategoryButton(dialog, /高级|ADVANCED/i).click()
      await expect(dialog.getByRole('heading', { name: 'AI CLI 检测' })).toBeVisible({ timeout: 15000 })

      const input = dialog.getByTestId('tool-detect-path-codex')
      await expect(input).toBeVisible({ timeout: 15000 })
      await input.fill('Z:/definitely-missing/codex.exe')
      await dialog.getByTestId('tool-detect-save-codex').click()
      await expect(dialog.getByTestId('tool-detect-message-codex')).toContainText('E_VALIDATION', { timeout: 5000 })

      await input.fill(process.execPath)
      await dialog.getByTestId('tool-detect-save-codex').click()
      await expect(dialog.getByTestId('tool-detect-message-codex')).toContainText('已保存覆盖路径', { timeout: 15000 })

      const report = await window.evaluate(async () => {
        const state = await window.devhub.r8.cli.detectAll({ force: false })
        const codex = state.results.find(result => result.tool === 'codex')
        return {
          found: codex?.found ?? false,
          path: codex?.path ?? null,
          strategy: codex?.detectStrategy ?? null,
          version: codex?.version ?? null
        }
      })

      expect(report).toMatchObject({
        found: true,
        path: process.execPath,
        strategy: 'user-override'
      })
      expect(report.version).toMatch(/^\d+\.\d+\.\d+/)
    } finally {
      await window.evaluate(async (path) => {
        if (path) {
          await window.devhub.r8.cli.setToolOverride('codex', path, 'e2e-restore')
          return
        }
        await window.devhub.r8.cli.clearToolOverride('codex', 'e2e-restore')
      }, previousOverridePath).catch(() => undefined)
      await closeElectronApp(electronApp)
    }
  })

  test('P8.1 布局模式设置可驱动真实 shell reflow 并跨重启持久化', async () => {
    test.setTimeout(120_000)
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let firstWindow: Page | null = null
    let secondWindow: Page | null = null

    try {
      const launched = await launchApp()
      firstApp = launched.electronApp
      firstWindow = launched.window
      await resetAppearanceSettings(firstWindow)
      await firstWindow.reload()
      await firstWindow.waitForLoadState('domcontentloaded')
      await dismissAutoDiscoveryIfPresent(firstWindow)

      const shell = firstWindow.locator('.responsive-app-shell')
      await expect(shell).toBeVisible({ timeout: 15000 })

      await resizeMainWindow(firstApp, 1180, 760)
      await expect(shell).toHaveAttribute('data-layout-preference', 'auto')
      await expect(shell).toHaveAttribute('data-layout-mode', 'split')

      await resizeMainWindow(firstApp, 760, 620)
      await expect(shell).toHaveAttribute('data-layout-mode', 'stacked')
      await resizeMainWindow(firstApp, 1180, 760)
      await expect(shell).toHaveAttribute('data-layout-mode', 'split')

      await firstWindow.getByTestId('sidebar-settings-button').click()
      await expect(settingsDialogByContract(firstWindow)).toBeVisible({ timeout: 5000 })
      await firstWindow.getByLabel('布局模式').selectOption('stacked')
      await expect(shell).toHaveAttribute('data-layout-preference', 'stacked')
      await expect(shell).toHaveAttribute('data-layout-mode', 'stacked')

      await resizeMainWindow(firstApp, 1180, 760)
      await expect(shell).toHaveAttribute('data-layout-mode', 'stacked')
      await expect.poll(async () => firstWindow!.evaluate(async () => {
        const settings = await window.devhub.settings.get()
        return settings.appearance.layoutMode
      }), {
        message: '等待布局模式持久化为 stacked',
        timeout: 5000
      }).toBe('stacked')

      await closeElectronApp(firstApp)
      firstApp = null
      firstWindow = null

      const relaunched = await launchApp()
      secondApp = relaunched.electronApp
      secondWindow = relaunched.window
      await dismissAutoDiscoveryIfPresent(secondWindow)
      const relaunchedShell = secondWindow.locator('.responsive-app-shell')
      await expect(relaunchedShell).toBeVisible({ timeout: 15000 })
      await resizeMainWindow(secondApp, 1180, 760)
      await expect(relaunchedShell).toHaveAttribute('data-layout-preference', 'stacked')
      await expect(relaunchedShell).toHaveAttribute('data-layout-mode', 'stacked')

      await secondWindow.getByTestId('sidebar-settings-button').click()
      await expect(settingsDialogByContract(secondWindow)).toBeVisible({ timeout: 5000 })
      await secondWindow.getByLabel('布局模式').selectOption('auto')
      await expect(relaunchedShell).toHaveAttribute('data-layout-preference', 'auto')
      await resizeMainWindow(secondApp, 1180, 760)
      await expect(relaunchedShell).toHaveAttribute('data-layout-mode', 'split')
      await resizeMainWindow(secondApp, 760, 620)
      await expect(relaunchedShell).toHaveAttribute('data-layout-mode', 'stacked')
    } finally {
      if (secondWindow) {
        await resetAppearanceSettings(secondWindow).catch(() => undefined)
      } else if (firstWindow) {
        await resetAppearanceSettings(firstWindow).catch(() => undefined)
      }
      if (secondApp) await closeElectronApp(secondApp)
      if (firstApp) await closeElectronApp(firstApp)
    }
  })

  test('P8.2 外观四轴设置可真实应用并跨重启持久化', async () => {
    test.setTimeout(120_000)
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let firstWindow: Page | null = null
    let secondWindow: Page | null = null

    try {
      const launched = await launchApp()
      firstApp = launched.electronApp
      firstWindow = launched.window
      await seedAppearanceSettings(firstWindow)
      await dismissAutoDiscoveryIfPresent(firstWindow)

      await expect.poll(async () => readThemeRuntimeSnapshot(firstWindow!), {
        message: '等待 seeded 四轴主题写入 html dataset',
        timeout: 5000
      }).toMatchObject({
        density: 'standard',
        motionLevel: 'balanced',
        palette: 'modern-light',
        radiusFamily: 'soft',
        theme: 'modern-light'
      })

      const seededSnapshot = await readThemeRuntimeSnapshot(firstWindow)
      expect(seededSnapshot.surface900).toBe('#f1f3f5')

      await firstWindow.getByTestId('sidebar-settings-button').click()
      await expect(settingsDialogByContract(firstWindow)).toBeVisible({ timeout: 5000 })
      await expect(firstWindow.getByTestId('theme-preview-editor')).toBeVisible({ timeout: 5000 })
      await expect(firstWindow.getByTestId('theme-preview-card')).toBeVisible()
      await expect(firstWindow.getByTestId('theme-preview-button')).toBeVisible()
      await expect(firstWindow.getByTestId('theme-preview-table')).toBeVisible()
      await expect(firstWindow.getByTestId('theme-preview-chart')).toBeVisible()

      await firstWindow.getByTestId('theme-editor-accent').fill('#112233')
      await expect(firstWindow.getByTestId('theme-live-preview')).toHaveAttribute('data-accent-color', '#112233')
      expect((await readThemeRuntimeSnapshot(firstWindow)).palette).toBe('modern-light')

      await firstWindow.getByLabel('信息密度').selectOption('compact')
      await expect.poll(async () => readThemeRuntimeSnapshot(firstWindow!), {
        message: '等待信息密度独立切换为 compact',
        timeout: 5000
      }).toMatchObject({
        density: 'compact',
        motionLevel: 'balanced',
        palette: 'modern-light',
        radiusFamily: 'soft'
      })
      expect((await readThemeRuntimeSnapshot(firstWindow)).surface900).toBe(seededSnapshot.surface900)

      await firstWindow.getByLabel('圆角风格').selectOption('round')
      await expect.poll(async () => readThemeRuntimeSnapshot(firstWindow!), {
        message: '等待圆角族独立切换为 round',
        timeout: 5000
      }).toMatchObject({
        density: 'compact',
        palette: 'modern-light',
        radiusFamily: 'round'
      })
      expect((await readThemeRuntimeSnapshot(firstWindow)).radiusDefault).toBe('16px')

      await firstWindow.getByLabel('动效水平').selectOption('reduced')
      await expect.poll(async () => readThemeRuntimeSnapshot(firstWindow!), {
        message: '等待 reduced motion 写入 token',
        timeout: 5000
      }).toMatchObject({
        motionLevel: 'reduced',
        motionScale: '0',
        durationTheme: '0ms'
      })

      await firstWindow.getByTestId('palette-option-cyberpunk').scrollIntoViewIfNeeded()
      const themeContinuityFramesPromise = collectThemeVisualContinuityFrames(firstWindow, 40)
      await firstWindow.getByTestId('palette-option-cyberpunk').click()
      const themeContinuityFrames = await themeContinuityFramesPromise
      const blankFrames = themeContinuityFrames.filter((frame) => {
        return frame.shellArea <= 0 ||
          frame.shellDisplay === 'none' ||
          frame.shellVisibility === 'hidden' ||
          frame.shellOpacity === '0' ||
          frame.bodyTextLength < 100
      })
      expect(blankFrames).toEqual([])
      expect(themeContinuityFrames.some((frame) => frame.rootPalette === 'cyberpunk')).toBe(true)

      await expect.poll(async () => readThemeRuntimeSnapshot(firstWindow!), {
        message: '等待 cyberpunk 色板同步语义 token',
        timeout: 5000
      }).toMatchObject({
        density: 'compact',
        palette: 'cyberpunk',
        radiusFamily: 'sharp',
        motionLevel: 'expressive'
      })
      const cyberpunkSnapshot = await readThemeRuntimeSnapshot(firstWindow)
      expect(cyberpunkSnapshot.surface900).toBe('#101020')
      expect(cyberpunkSnapshot.surface900).not.toBe(seededSnapshot.surface900)
      expect(cyberpunkSnapshot.topologyNodeProcess).toBe('#00ffff')
      expect(cyberpunkSnapshot.topologyEdgeNetwork).toBe('#39ff14')
      expect(cyberpunkSnapshot.topologyNodeLabel).toBe('#ffffff')
      expect(cyberpunkSnapshot.topologyNodeProcess).not.toBe(seededSnapshot.topologyNodeProcess)
      expect(cyberpunkSnapshot.topologyEdgeNetwork).not.toBe(seededSnapshot.topologyEdgeNetwork)
      expect(cyberpunkSnapshot.topologyNodeLabel).not.toBe(seededSnapshot.topologyNodeLabel)

      await firstWindow.getByTestId('theme-preset-paper-zen').scrollIntoViewIfNeeded()
      await firstWindow.getByTestId('theme-preset-paper-zen').click()
      await expect.poll(async () => readThemeRuntimeSnapshot(firstWindow!), {
        message: '等待 Paper Zen 预设组合一次性应用四轴',
        timeout: 5000
      }).toMatchObject({
        density: 'comfortable',
        motionLevel: 'reduced',
        palette: 'warm-light',
        radiusFamily: 'round'
      })

      await expect.poll(async () => firstWindow!.evaluate(async () => {
        const settings = await window.devhub.settings.get()
        return {
          density: settings.appearance.informationDensity,
          motionLevel: settings.appearance.motionLevel,
          radiusFamily: settings.appearance.radiusFamily,
          theme: settings.appearance.theme
        }
      }), {
        message: '等待四轴外观设置真实持久化到 settings store',
        timeout: 5000
      }).toEqual({
        density: 'comfortable',
        motionLevel: 'reduced',
        radiusFamily: 'round',
        theme: 'warm-light'
      })

      await closeElectronApp(firstApp)
      firstApp = null
      firstWindow = null

      const relaunched = await launchApp()
      secondApp = relaunched.electronApp
      secondWindow = relaunched.window
      await dismissAutoDiscoveryIfPresent(secondWindow)
      await expect.poll(async () => readThemeRuntimeSnapshot(secondWindow!), {
        message: '等待重启后从 electron-store 恢复四轴主题',
        timeout: 5000
      }).toMatchObject({
        density: 'comfortable',
        motionLevel: 'reduced',
        palette: 'warm-light',
        radiusFamily: 'round'
      })
    } finally {
      if (secondWindow) {
        await resetAppearanceSettings(secondWindow).catch(() => undefined)
      } else if (firstWindow) {
        await resetAppearanceSettings(firstWindow).catch(() => undefined)
      }
      if (secondApp) await closeElectronApp(secondApp)
      if (firstApp) await closeElectronApp(firstApp)
    }
  })

  test('AI 任务面板在真实环境下无 Emoji 且品牌标识结构合法', async () => {
    const { electronApp, window } = await launchApp()
    try {
      await dismissAutoDiscoveryIfPresent(window)

      await buttonByText(window, '监控').click()
      await buttonByText(window, 'AI 任务').click()
      await expect(window.getByText('AI 任务追踪')).toBeVisible({ timeout: 15000 })

      const panelText = await window.locator('body').innerText()
      expect(panelText).not.toMatch(EMOJI_PATTERN)

      const logos = await window.locator('[data-tool-logo]').evaluateAll((elements) =>
        elements.map((element) => ({
          hasImg: element.querySelector('img') !== null,
          hasSvg: element.querySelector('svg') !== null,
          toolType: element.getAttribute('data-tool-logo')
        }))
      )

      if (logos.length > 0) {
        expect(logos.length).toBeGreaterThan(0)
        for (const logo of logos) {
          expect(logo.toolType).toBeTruthy()
          expect(logo.hasImg || logo.hasSvg).toBe(true)
        }
      } else {
        const emptyStateVisible = await window.getByText('没有检测到运行中的 AI 编程工具').isVisible().catch(() => false)
        const emptyHistoryVisible = await window.getByText('暂无任务历史').isVisible().catch(() => false)
        const emptyStatsVisible = await window.getByText('暂无统计数据').isVisible().catch(() => false)

        expect(emptyStateVisible || emptyHistoryVisible || emptyStatsVisible).toBe(true)
      }
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('R8.B spec-17 icon tokens cover command palette brand logo and no emoji', async () => {
    test.setTimeout(90_000)
    const unique = 'devhub-icon-token-probe-' + Date.now()
    const probeProcess = spawnRealAIProgressProbe(unique)
    const { electronApp, window } = await launchApp()

    try {
      if (!probeProcess.pid) {
        throw new Error('Failed to start real icon token AI probe process')
      }

      await dismissAutoDiscoveryIfPresent(window)
      await buttonByText(window, '监控').click()
      await buttonByText(window, 'AI 任务').click()
      await expect(window.getByText('AI 任务追踪')).toBeVisible({ timeout: 15_000 })

      await expect.poll(async () => {
        return window.evaluate(async (pid) => {
          await window.devhub.aiTask.scan()
          const tasks = await window.devhub.aiTask.getAll()
          return tasks.some((task) => task.pid === pid && task.toolType === 'codex')
        }, probeProcess.pid)
      }, {
        message: '等待真实 codex-like 子进程进入 AI 任务列表并映射品牌 token',
        timeout: 30_000
      }).toBe(true)

      const card = window.locator('[data-testid="ai-task-card"]').filter({ hasText: 'PID: ' + probeProcess.pid }).first()
      await expect(card).toBeVisible({ timeout: 15_000 })
      const logo = card.locator('[data-tool-logo="codex"]').first()
      await expect(logo).toBeVisible()
      await expect(logo.locator('[data-icon-token="brand:OpenAI"]').first()).toBeVisible()

      await window.keyboard.press('Control+K')
      const commandPalette = window.getByTestId('command-palette')
      await expect(commandPalette).toBeVisible({ timeout: 5_000 })
      await expect(commandPalette.locator('[data-icon-token="lucide:Search"]').first()).toBeVisible()

      const bodyText = await window.locator('body').innerText()
      expect(bodyText).not.toMatch(EMOJI_PATTERN)
    } finally {
      stopRealAIProgressProbe(probeProcess)
      await closeElectronApp(electronApp)
    }
  })

  test.describe('R8.B spec-01 port popout system real UI matrix', () => {
    test('R8.B spec-01 hover trigger opens a real port floating card', async () => {
      test.setTimeout(90_000)
      let harness: R8PortPopoutHarness | null = null
      try {
        harness = await launchR8PortPopoutHarness(1)
        const [target] = harness.ports
        if (!target) throw new Error('R8.B spec-01 hover trigger requires one real listening port')

        const card = await showR8PortCard(harness.window, target)
        await card.hover()

        const popout = harness.window.getByTestId(`port-popout-card-${target.port}-${target.pid}`)
        await expect(popout).toBeVisible({ timeout: 10_000 })
        await expect(popout).toHaveAttribute('data-r8b-popout-trigger', 'hover')

        const zIndex = await popout.evaluate((element) => {
          const token = element.getAttribute('data-r8b-popout-z-index')
          return Number(token ?? window.getComputedStyle(element).zIndex)
        })
        expect(zIndex).toBeGreaterThanOrEqual(4000)
        expect(zIndex).toBeLessThan(5000)
      } finally {
        await closeR8PortPopoutHarness(harness)
      }
    })

    test('R8.B spec-01 click trigger opens a real port floating card', async () => {
      test.setTimeout(90_000)
      let harness: R8PortPopoutHarness | null = null
      try {
        harness = await launchR8PortPopoutHarness(1)
        const [target] = harness.ports
        if (!target) throw new Error('R8.B spec-01 click trigger requires one real listening port')

        await showR8PortCard(harness.window, target)
        await harness.window.getByTestId(`port-popout-click-${target.port}-${target.pid}`).click()

        const popout = harness.window.getByTestId(`port-popout-card-${target.port}-${target.pid}`)
        await expect(popout).toBeVisible({ timeout: 10_000 })
        await expect(popout).toHaveAttribute('data-r8b-popout-trigger', 'click')
      } finally {
        await closeR8PortPopoutHarness(harness)
      }
    })

    test('R8.B spec-01 context-menu trigger opens a real port floating card', async () => {
      test.setTimeout(90_000)
      let harness: R8PortPopoutHarness | null = null
      try {
        harness = await launchR8PortPopoutHarness(1)
        const [target] = harness.ports
        if (!target) throw new Error('R8.B spec-01 context-menu trigger requires one real listening port')

        const card = await showR8PortCard(harness.window, target)
        await card.click({ button: 'right', position: { x: 24, y: 24 } })

        const popout = harness.window.getByTestId(`port-popout-card-${target.port}-${target.pid}`)
        await expect(popout).toBeVisible({ timeout: 10_000 })
        await expect(popout).toHaveAttribute('data-r8b-popout-trigger', 'context-menu')
      } finally {
        await closeR8PortPopoutHarness(harness)
      }
    })

    test('R8.B spec-01 drag trigger opens a real port floating card after threshold movement', async () => {
      test.setTimeout(90_000)
      let harness: R8PortPopoutHarness | null = null
      try {
        harness = await launchR8PortPopoutHarness(1)
        const [target] = harness.ports
        if (!target) throw new Error('R8.B spec-01 drag trigger requires one real listening port')

        const card = await showR8PortCard(harness.window, target)
        const box = await card.boundingBox()
        if (!box) throw new Error('R8.B spec-01 port card has no measurable box')

        await harness.window.mouse.move(box.x + 28, box.y + 28)
        await harness.window.mouse.down()
        await harness.window.mouse.move(box.x + 52, box.y + 28, { steps: 6 })
        await harness.window.mouse.up()

        const popout = harness.window.getByTestId(`port-popout-card-${target.port}-${target.pid}`)
        await expect(popout).toBeVisible({ timeout: 10_000 })
        await expect(popout).toHaveAttribute('data-r8b-popout-trigger', 'drag')
      } finally {
        await closeR8PortPopoutHarness(harness)
      }
    })

    test('R8.B spec-01 floating cap keeps real port popouts at five and evicts oldest unpinned card', async () => {
      test.setTimeout(120_000)
      let harness: R8PortPopoutHarness | null = null
      try {
        harness = await launchR8PortPopoutHarness(6)
        if (harness.ports.length < 6) throw new Error('R8.B spec-01 cap test requires six real listening ports')
        const first = harness.ports[0]

        for (const target of harness.ports.slice(0, 6)) {
          await showR8PortCard(harness.window, target)
          await harness.window.getByTestId(`port-popout-click-${target.port}-${target.pid}`).click()
          await expect(harness.window.getByTestId(`port-popout-card-${target.port}-${target.pid}`)).toBeVisible({ timeout: 10_000 })
        }

        await expect.poll(async () => harness.window.locator('[data-testid^="port-popout-card-"]').count(), {
          message: '等待第 6 个真实端口浮卡触发 soft cap 后保留 5 个',
          timeout: 10_000
        }).toBe(5)
        await expect(harness.window.getByTestId(`port-popout-card-${first.port}-${first.pid}`)).toHaveCount(0)
      } finally {
        await closeR8PortPopoutHarness(harness)
      }
    })

    test('R8.B spec-01 position memory restores moved and resized real port popout geometry', async () => {
      test.setTimeout(120_000)
      let harness: R8PortPopoutHarness | null = null
      try {
        harness = await launchR8PortPopoutHarness(1)
        const [target] = harness.ports
        if (!target) throw new Error('R8.B spec-01 position memory requires one real listening port')

        await showR8PortCard(harness.window, target)
        await harness.window.getByTestId(`port-popout-click-${target.port}-${target.pid}`).click()
        const popout = harness.window.getByTestId(`port-popout-card-${target.port}-${target.pid}`)
        await expect(popout).toBeVisible({ timeout: 10_000 })
        await popout.waitFor({ state: 'visible', timeout: 10_000 })

        const titlebar = popout.locator('[data-testid^="port-popout-titlebar-"]').first()
        await expect(titlebar).toBeVisible({ timeout: 10_000 })
        const titlebarBox = await titlebar.boundingBox()
        if (!titlebarBox) throw new Error('R8.B spec-01 popout titlebar has no measurable box')

        await harness.window.mouse.move(titlebarBox.x + 40, titlebarBox.y + titlebarBox.height / 2)
        await harness.window.mouse.down()
        await harness.window.mouse.move(titlebarBox.x + 130, titlebarBox.y + titlebarBox.height / 2 + 64, { steps: 10 })
        await harness.window.mouse.up()

        const resizeHandle = harness.window.getByTestId(`port-popout-resize-se-${target.port}-${target.pid}`)
        const resizeBox = await resizeHandle.boundingBox()
        if (!resizeBox) throw new Error('R8.B spec-01 popout resize handle has no measurable box')

        await harness.window.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
        await harness.window.mouse.down()
        await harness.window.mouse.move(resizeBox.x + resizeBox.width / 2 + 56, resizeBox.y + resizeBox.height / 2 + 44, { steps: 8 })
        await harness.window.mouse.up()

        const savedGeometry = await popout.boundingBox()
        if (!savedGeometry) throw new Error('R8.B spec-01 popout geometry was not measurable after drag and resize')

        await expect.poll(async () => harness.window!.evaluate((memoryKey) => {
          const raw = window.localStorage.getItem('devhub:r8b:port-popout-position-memory')
          if (!raw) return false
          const parsed = JSON.parse(raw) as Record<string, unknown>
          return memoryKey in parsed
        }, `port:${target.port}:pid:${target.pid}`), {
          message: '等待真实浮卡位置写入 port popout position memory',
          timeout: 5_000
        }).toBe(true)

        await harness.window.getByTestId(`port-popout-close-${target.port}-${target.pid}`).evaluate((element) => {
          ;(element as HTMLButtonElement).click()
        })
        await expect(popout).toHaveCount(0)

        await harness.window.getByTestId(`port-popout-click-${target.port}-${target.pid}`).click()
        await expect(popout).toBeVisible({ timeout: 10_000 })
        const restoredGeometry = await popout.boundingBox()
        if (!restoredGeometry) throw new Error('R8.B spec-01 restored popout geometry was not measurable')

        expect(Math.abs(restoredGeometry.x - savedGeometry.x)).toBeLessThanOrEqual(5)
        expect(Math.abs(restoredGeometry.y - savedGeometry.y)).toBeLessThanOrEqual(5)
        expect(Math.abs(restoredGeometry.width - savedGeometry.width)).toBeLessThanOrEqual(5)
        expect(Math.abs(restoredGeometry.height - savedGeometry.height)).toBeLessThanOrEqual(5)
      } finally {
        await closeR8PortPopoutHarness(harness)
      }
    })

    test('R8.B spec-01 sync sends main port view state to a real BrowserWindow popout', async () => {
      test.setTimeout(120_000)
    let harness: R8PortPopoutHarness | null = null
    let popoutPage: Page | null = null
    let popoutWindowId: string | null = null
    const resolveLivePopoutPage = async (): Promise<Page> => {
      if (popoutPage && !popoutPage.isClosed()) return popoutPage
      if (!harness) throw new Error('R8.B spec-01 popout harness is unavailable')
      const reopened = harness.electronApp.windows().find(page => {
        try {
          return page.url().includes('r8Popout=')
        } catch {
          return false
        }
      })
      if (reopened) {
        popoutPage = reopened
        return reopened
      }
      throw new Error(`R8.B spec-01 BrowserWindow popout is not available; current windows: ${harness.electronApp.windows().map(page => page.url()).join(', ')}`)
    }
    try {
      harness = await launchR8PortPopoutHarness(1)
      const [target] = harness.ports
      if (!target) throw new Error('R8.B spec-01 sync test requires one real listening port')

        const popoutPagePromise = harness.electronApp.waitForEvent('window', { timeout: 20_000 })
        const created = await harness.window.evaluate(async ({ port, title }) => {
          return window.devhub.r8.popout.create({
            surface: 'port',
            targetId: port,
            mode: 'browserwindow',
            route: '/monitor',
            bounds: { x: 96, y: 96, width: 1180, height: 780 },
            title
          })
        }, { port: target.port, title: `R8.B spec-01 sync ${Date.now()}` })
        popoutWindowId = created.windowId
        await harness.window.evaluate(async (windowId) => {
          await window.devhub.r8.popout.pin(windowId, true)
        }, popoutWindowId)
        popoutPage = await popoutPagePromise
        await popoutPage.waitForLoadState('domcontentloaded')
        await dismissAutoDiscoveryIfPresent(popoutPage)
        await popoutPage.evaluate(() => {
          window.dispatchEvent(new CustomEvent('devhub:open-monitor'))
        })
        await expect(popoutPage.getByText('系统监控')).toBeVisible({ timeout: 15_000 })
        await popoutPage.evaluate(() => {
          window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'port' } }))
        })
        await expect(popoutPage.getByTestId('port-view-root')).toBeVisible({ timeout: 15_000 })
        await expect(popoutPage.getByPlaceholder('搜索端口...')).toBeVisible({ timeout: 15_000 })
        const nativePopoutWindow = await harness.electronApp.browserWindow(popoutPage)
        await expect.poll(async () => nativePopoutWindow.evaluate(browserWindow => browserWindow.isVisible()), {
          message: '等待 real BrowserWindow popout ready-to-show 后可见',
          timeout: 10_000
        }).toBe(true)
        await popoutPage.waitForTimeout(2_000)

        await harness.window.getByPlaceholder('搜索端口...').fill(String(target.port))
        await harness.window.getByTitle('列表').click()

        const livePopoutPage = await resolveLivePopoutPage()

        await expect.poll(async () => livePopoutPage.getByPlaceholder('搜索端口...').inputValue(), {
          message: '等待 main port view search 状态经真实 popout bridge 同步到 BrowserWindow',
          timeout: 15_000
        }).toBe(String(target.port))
        await expect(livePopoutPage.getByTestId('port-view-root')).toHaveAttribute('data-port-view-mode', 'list')
      } finally {
        if (harness && popoutWindowId && !harness.window.isClosed()) {
          await harness.window.evaluate(async (windowId) => {
            await window.devhub.r8.popout.close(windowId)
          }, popoutWindowId).catch(() => undefined)
        }
        if (popoutPage && !popoutPage.isClosed()) {
          await popoutPage.close().catch(() => undefined)
        }
        await closeR8PortPopoutHarness(harness)
      }
    })
  })

  test('R8.B spec-02 BrowserWindow popout lifecycle uses real IPC bridge', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null
    let popoutPage: Page | null = null
    let popoutWindowId: string | null = null
    const titlePrefix = 'R8.B spec-02 BrowserWindow popout '
    const title = titlePrefix + Date.now()
    const bounds = { x: 72, y: 72, width: 430, height: 360 }

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)

      await window.evaluate(async (prefix) => {
        const popouts = await window.devhub.r8.popout.list()
        for (const popout of popouts) {
          if (popout.title.startsWith(prefix)) {
            await window.devhub.r8.popout.close(popout.windowId)
          }
        }
      }, titlePrefix)

      const popoutPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const created = await window.evaluate(async (request) => {
        return window.devhub.r8.popout.create(request)
      }, {
        surface: 'port',
        targetId: 49231,
        mode: 'browserwindow',
        route: '/monitor',
        bounds,
        title
      })
      popoutWindowId = created.windowId
      expect(created.mode).toBe('browserwindow')
      expect(created.surface).toBe('port')
      expect(created.targetId).toBe(49231)
      expect(created.bridgeState).toBe('connected')

      popoutPage = await popoutPagePromise
      await popoutPage.waitForLoadState('domcontentloaded')
      await expect.poll(() => popoutPage?.url() ?? '', {
        message: '等待 spec-02 BrowserWindow popout 真实 renderer URL 携带 r8Popout 查询参数',
        timeout: 10_000
      }).toContain(`r8Popout=${encodeURIComponent(popoutWindowId)}`)
      expect(popoutPage.url()).toContain('port-popout.html')
      await expect(popoutPage.getByTestId('port-popout-shell')).toBeVisible({ timeout: 10_000 })
      await expect(popoutPage.getByTestId('port-popout-port')).toContainText('49231')

      const nativePopoutWindow = await electronApp.browserWindow(popoutPage)
      await expect.poll(async () => nativePopoutWindow.evaluate(browserWindow => browserWindow.isVisible()), {
        message: '等待 spec-02 BrowserWindow popout ready-to-show 后可见',
        timeout: 10_000
      }).toBe(true)

      const listedAfterCreate = await window.evaluate(async (windowId) => {
        return (await window.devhub.r8.popout.list()).find(popout => popout.windowId === windowId) ?? null
      }, popoutWindowId)
      expect(listedAfterCreate?.mode).toBe('browserwindow')
      expect(listedAfterCreate?.bridgeState).toBe('connected')

      const savedBounds = await window.evaluate(async ({ windowId, nextBounds }) => {
        return window.devhub.r8.popout.saveBounds(windowId, nextBounds)
      }, {
        windowId: popoutWindowId,
        nextBounds: { x: 96, y: 104, width: 460, height: 390 }
      })
      expect(savedBounds.bounds).toEqual({ x: 96, y: 104, width: 460, height: 390 })
      await expect.poll(async () => nativePopoutWindow.evaluate(browserWindow => browserWindow.getBounds().width), {
        message: '等待 spec-02 BrowserWindow 原生 bounds 响应 save-bounds IPC',
        timeout: 10_000
      }).toBe(460)

      const heartbeatAt = Date.now()
      const heartbeat = await window.evaluate(async ({ windowId, at }) => {
        return window.devhub.r8.popout.bridgeMessage({ windowId, type: 'heartbeat', at })
      }, { windowId: popoutWindowId, at: heartbeatAt })
      expect(heartbeat.success).toBe(true)
      expect(heartbeat.heartbeatAt).toBe(heartbeatAt)
      expect(heartbeat.bridgeState).toBe('connected')

      const pinned = await window.evaluate(async (windowId) => {
        return window.devhub.r8.popout.pin(windowId, true)
      }, popoutWindowId)
      expect(pinned?.pinned).toBe(true)
      await expect.poll(async () => nativePopoutWindow.evaluate(browserWindow => browserWindow.isAlwaysOnTop()), {
        message: '等待 spec-02 pin IPC 真实切换 BrowserWindow always-on-top',
        timeout: 10_000
      }).toBe(true)

      const listedAfterBridge = await window.evaluate(async (windowId) => {
        return (await window.devhub.r8.popout.list()).find(popout => popout.windowId === windowId) ?? null
      }, popoutWindowId)
      expect(listedAfterBridge?.bounds).toEqual({ x: 96, y: 104, width: 460, height: 390 })
      expect(listedAfterBridge?.lastHeartbeatAt).toBe(heartbeatAt)
      expect(listedAfterBridge?.pinned).toBe(true)

      const closeObserved = popoutPage.waitForEvent('close', { timeout: 10_000 })
      const closeResult = await window.evaluate(async (windowId) => {
        return window.devhub.r8.popout.close(windowId)
      }, popoutWindowId)
      expect(closeResult.success).toBe(true)
      await closeObserved
      popoutPage = null

      const listedAfterClose = await window.evaluate(async (windowId) => {
        return (await window.devhub.r8.popout.list()).find(popout => popout.windowId === windowId) ?? null
      }, popoutWindowId)
      expect(listedAfterClose?.bridgeState).toBe('closed')
      popoutWindowId = null
    } finally {
      if (window && !window.isClosed() && popoutWindowId) {
        await window.evaluate(async (windowId) => {
          await window.devhub.r8.popout.close(windowId)
        }, popoutWindowId).catch(() => undefined)
      }
      if (popoutPage && !popoutPage.isClosed()) {
        await popoutPage.close().catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-02 BrowserWindow popout main-window close keeps pinned windows alive', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let mainWindow: Page | null = null
    let pinnedPage: Page | null = null
    let unpinnedPage: Page | null = null
    let pinnedWindowId: string | null = null
    let unpinnedWindowId: string | null = null
    const titlePrefix = 'R8.B spec-02 main-close '
    const runId = Date.now()

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      mainWindow = launch.window
      await dismissAutoDiscoveryIfPresent(mainWindow)

      await mainWindow.evaluate(async (prefix) => {
        const popouts = await window.devhub.r8.popout.list()
        for (const popout of popouts) {
          if (popout.title.startsWith(prefix)) {
            await window.devhub.r8.popout.close(popout.windowId)
          }
        }
      }, titlePrefix)

      const unpinnedPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const unpinnedCreated = await mainWindow.evaluate(async (request) => {
        return window.devhub.r8.popout.create(request)
      }, {
        surface: 'port',
        targetId: 49321,
        mode: 'browserwindow',
        route: '/monitor',
        bounds: { x: 64, y: 64, width: 420, height: 320 },
        title: `${titlePrefix}unpinned ${runId}`
      })
      unpinnedWindowId = unpinnedCreated.windowId
      unpinnedPage = await unpinnedPagePromise
      await unpinnedPage.waitForLoadState('domcontentloaded')
      await expect(unpinnedPage.getByTestId('port-popout-shell')).toBeVisible({ timeout: 10_000 })

      const pinnedPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const pinnedCreated = await mainWindow.evaluate(async (request) => {
        return window.devhub.r8.popout.create(request)
      }, {
        surface: 'port',
        targetId: 49322,
        mode: 'browserwindow',
        route: '/monitor',
        bounds: { x: 112, y: 96, width: 440, height: 340 },
        title: `${titlePrefix}pinned ${runId}`
      })
      pinnedWindowId = pinnedCreated.windowId
      pinnedPage = await pinnedPagePromise
      await pinnedPage.waitForLoadState('domcontentloaded')
      await expect(pinnedPage.getByTestId('port-popout-shell')).toBeVisible({ timeout: 10_000 })

      const pinnedRecord = await mainWindow.evaluate(async (windowId) => {
        return window.devhub.r8.popout.pin(windowId, true)
      }, pinnedWindowId)
      expect(pinnedRecord?.pinned).toBe(true)
      const pinnedNativeWindow = await electronApp.browserWindow(pinnedPage)
      await expect.poll(async () => pinnedNativeWindow.evaluate(browserWindow => browserWindow.isAlwaysOnTop()), {
        message: '等待 pinned BrowserWindow main-close 前真实切换 always-on-top',
        timeout: 10_000
      }).toBe(true)

      const nativeMainWindow = await electronApp.browserWindow(mainWindow)
      const unpinnedCloseObserved = unpinnedPage.waitForEvent('close', { timeout: 15_000 })
      const mainCloseObserved = mainWindow.waitForEvent('close', { timeout: 15_000 })
      await nativeMainWindow.evaluate(browserWindow => browserWindow.close())
      await mainCloseObserved
      mainWindow = null
      await unpinnedCloseObserved
      unpinnedPage = null

      expect(pinnedPage.isClosed()).toBe(false)
      await expect.poll(async () => pinnedNativeWindow.evaluate(browserWindow => ({
        alwaysOnTop: browserWindow.isAlwaysOnTop(),
        visible: browserWindow.isVisible()
      })), {
        message: '等待主窗口关闭后 pinned BrowserWindow 仍作为真实原生窗口存活',
        timeout: 10_000
      }).toEqual({ alwaysOnTop: true, visible: true })

      const survivalReport = await pinnedPage.evaluate(async ({ pinnedId, unpinnedId }) => {
        const popouts = await window.devhub.r8.popout.list()
        const pinned = popouts.find(popout => popout.windowId === pinnedId) ?? null
        const unpinned = popouts.find(popout => popout.windowId === unpinnedId) ?? null
        return {
          pinnedBridgeState: pinned?.bridgeState ?? null,
          pinnedPinned: pinned?.pinned ?? false,
          unpinnedBridgeState: unpinned?.bridgeState ?? null
        }
      }, {
        pinnedId: pinnedWindowId,
        unpinnedId: unpinnedWindowId
      })
      expect(survivalReport).toEqual({
        pinnedBridgeState: 'connected',
        pinnedPinned: true,
        unpinnedBridgeState: 'closed'
      })
    } finally {
      if (pinnedPage && !pinnedPage.isClosed() && pinnedWindowId) {
        await pinnedPage.evaluate(async (windowId) => {
          await window.devhub.r8.popout.close(windowId)
        }, pinnedWindowId).catch(() => undefined)
      } else if (mainWindow && !mainWindow.isClosed() && pinnedWindowId) {
        await mainWindow.evaluate(async (windowId) => {
          await window.devhub.r8.popout.close(windowId)
        }, pinnedWindowId).catch(() => undefined)
      }
      if (mainWindow && !mainWindow.isClosed() && unpinnedWindowId) {
        await mainWindow.evaluate(async (windowId) => {
          await window.devhub.r8.popout.close(windowId)
        }, unpinnedWindowId).catch(() => undefined)
      }
      if (unpinnedPage && !unpinnedPage.isClosed()) {
        await unpinnedPage.close().catch(() => undefined)
      }
      if (pinnedPage && !pinnedPage.isClosed()) {
        await pinnedPage.close().catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-02 BrowserWindow popout demotes back to a floating record through real UI', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let mainWindow: Page | null = null
    let popoutPage: Page | null = null
    let browserWindowId: string | null = null
    let floatingWindowId: string | null = null
    const titlePrefix = 'R8.B spec-02 demote '
    const title = `${titlePrefix}${Date.now()}`
    const targetId = 49341

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      mainWindow = launch.window
      await dismissAutoDiscoveryIfPresent(mainWindow)

      await mainWindow.evaluate(async (prefix) => {
        const popouts = await window.devhub.r8.popout.list()
        for (const popout of popouts) {
          if (popout.title.startsWith(prefix)) {
            await window.devhub.r8.popout.close(popout.windowId)
          }
        }
      }, titlePrefix)

      const popoutPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const created = await mainWindow.evaluate(async (request) => {
        return window.devhub.r8.popout.create(request)
      }, {
        surface: 'port',
        targetId,
        mode: 'browserwindow',
        route: '/monitor',
        bounds: { x: 88, y: 88, width: 450, height: 340 },
        title
      })
      browserWindowId = created.windowId
      popoutPage = await popoutPagePromise
      await popoutPage.waitForLoadState('domcontentloaded')
      await expect(popoutPage.getByTestId('port-popout-shell')).toBeVisible({ timeout: 10_000 })
      await expect(popoutPage.getByTestId('port-popout-demote-action')).toBeVisible({ timeout: 10_000 })

      const popoutCloseObserved = popoutPage.waitForEvent('close', { timeout: 15_000 })
      await popoutPage.getByTestId('port-popout-demote-action').click()
      await popoutCloseObserved
      popoutPage = null

      const demoteReport = await mainWindow.evaluate(async ({ originalWindowId, expectedTargetId, expectedTitle }) => {
        const popouts = await window.devhub.r8.popout.list()
        const closedBrowser = popouts.find(popout => popout.windowId === originalWindowId) ?? null
        const floating = popouts.find(popout =>
          popout.windowId !== originalWindowId
          && popout.mode === 'floating'
          && popout.surface === 'port'
          && popout.targetId === expectedTargetId
          && popout.title === expectedTitle
        ) ?? null
        return {
          closedBrowserState: closedBrowser?.bridgeState ?? null,
          floatingId: floating?.windowId ?? null,
          floatingMode: floating?.mode ?? null,
          floatingSurface: floating?.surface ?? null,
          floatingTargetId: floating?.targetId ?? null,
          floatingTitle: floating?.title ?? null
        }
      }, {
        originalWindowId: browserWindowId,
        expectedTargetId: targetId,
        expectedTitle: title
      })

      expect(demoteReport.closedBrowserState).toBe('closed')
      expect(demoteReport.floatingId).toMatch(/^popout-/)
      expect(demoteReport.floatingId).not.toBe(browserWindowId)
      expect(demoteReport).toMatchObject({
        floatingMode: 'floating',
        floatingSurface: 'port',
        floatingTargetId: targetId,
        floatingTitle: title
      })
      floatingWindowId = demoteReport.floatingId
      browserWindowId = null
    } finally {
      if (mainWindow && !mainWindow.isClosed() && floatingWindowId) {
        await mainWindow.evaluate(async (windowId) => {
          await window.devhub.r8.popout.close(windowId)
        }, floatingWindowId).catch(() => undefined)
      }
      if (mainWindow && !mainWindow.isClosed() && browserWindowId) {
        await mainWindow.evaluate(async (windowId) => {
          await window.devhub.r8.popout.close(windowId)
        }, browserWindowId).catch(() => undefined)
      }
      if (popoutPage && !popoutPage.isClosed()) {
        await popoutPage.close().catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-04 command palette scopes history URI and settings command use real IPC', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null
    let originalHistory: CommandHistoryEntry[] = []
    let protocolRegisteredByTest = false

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)

      originalHistory = await window.evaluate(async () => window.devhub.r8.command.history())
      await window.evaluate(async () => {
        await window.devhub.r8.command.clearHistory('e2e-command-palette')
        await window.devhub.r8.command.addHistory({
          commandId: 'monitor.ai-task',
          confirmedBy: 'e2e-command-palette',
          invokedAt: Date.now() - 2000,
          useCount: 3
        })
      })
      await expect.poll(async () => window?.evaluate(async () => (await window.devhub.r8.command.list()).length) ?? 0, {
        message: '等待真实 scanner-backed command registry 达到 100+ entries',
        timeout: 20_000
      }).toBeGreaterThanOrEqual(100)
      const registryStats = await window.evaluate(async () => {
        const commands = await window.devhub.r8.command.list()
        return {
          total: commands.length,
          runtimeObjectCommands: commands.filter(command => command.handler === 'uri:open' && /^(process|port|window)\.open\./.test(command.id)).length
        }
      })
      expect(registryStats.total).toBeGreaterThanOrEqual(100)
      expect(registryStats.runtimeObjectCommands).toBeGreaterThan(0)

      await window.keyboard.press('Control+K')
      await expect(window.getByTestId('command-palette')).toBeVisible({ timeout: 10_000 })
      const commandInput = window.getByPlaceholder(/命令|command/i)
      await expect(commandInput).toBeFocused({ timeout: 5_000 })

      for (const groupId of ['history', 'monitor', 'navigation', 'ai-action', 'settings']) {
        await expect(window.getByTestId(`cmdk-group-${groupId}`)).toBeVisible({ timeout: 10_000 })
        await expect(window.getByTestId(`cmdk-group-${groupId}-count`)).toHaveText(/^[1-9]\d*$/)
      }
      await expect(window.getByTestId('cmdk-group-history')).toContainText('Open AI tasks')

      await commandInput.fill('@')
      await expect(window.getByTestId('cmdk-scope-filter')).toContainText('AI 范围')
      await expect(window.getByTestId('cmdk-group-ai-action')).toBeVisible()

      await commandInput.fill('#')
      await expect(window.getByTestId('cmdk-scope-filter')).toContainText('对象范围')
      await expect(window.getByTestId('cmdk-group-port')).toBeVisible()

      await commandInput.fill('!')
      await expect(window.getByTestId('cmdk-scope-filter')).toContainText('确认范围')
      await expect(window.getByText('Add port to blocklist')).toBeVisible()

      await commandInput.fill('devhub://port/3000')
      await expect(window.getByText('解析并跳转 URI')).toBeVisible()
      await window.getByText('解析并跳转 URI').click()
      await expect(window.getByTestId('command-palette')).toHaveCount(0, { timeout: 10_000 })

      await window.keyboard.press('Control+K')
      await expect(window.getByTestId('command-palette')).toBeVisible({ timeout: 10_000 })
      await window.getByPlaceholder(/命令|command/i).fill('settings')
      await window.getByText('Open settings').click()
      const settingsDialog = settingsDialogByContract(window)
      await expect(settingsDialog).toBeVisible({ timeout: 10_000 })
      await settingsCategoryButton(settingsDialog, /高级|ADVANCED/i).click()
      await expect(window.getByTestId('custom-command-manager')).toBeVisible({ timeout: 10_000 })
      await window.getByTestId('custom-command-id').fill('custom.e2e.open-dashboard')
      await window.getByTestId('custom-command-label').fill('E2E Open Dashboard')
      await window.getByTestId('custom-command-handler').fill('command:dashboard.open')
      await window.getByTestId('custom-command-shortcut').fill('Ctrl+Shift+D')
      await window.getByTestId('custom-command-save').click()
      await expect(window.getByTestId('custom-command-status')).toContainText('custom.e2e.open-dashboard', { timeout: 10_000 })
      const customCommand = await window.evaluate(async () => {
        return (await window.devhub.r8.command.listCustom()).commands.find(command => command.id === 'custom.e2e.open-dashboard') ?? null
      })
      expect(customCommand).toMatchObject({
        enabled: true,
        handlerScript: 'command:dashboard.open',
        label: 'E2E Open Dashboard',
        shortcut: ['Ctrl', 'Shift', 'D']
      })

      const protocolUri = await window.evaluate(async () => {
        const commands = await window.devhub.r8.command.list()
        const processCommand = commands.find(command =>
          command.id.startsWith('process.open.')
          && typeof command.uri === 'string'
          && command.uri.startsWith('devhub://process/')
        )
        if (!processCommand?.uri) {
          throw new Error('R8.B spec-04 could not find a scanner-backed process URI command')
        }
        return processCommand.uri
      })

      await window.evaluate(() => {
        const host = window as typeof window & Spec04CommandProtocolWindow
        host.__r8Spec04ProtocolCleanup?.()
        host.__r8Spec04ProtocolEvents = []
        host.__r8Spec04ProtocolCleanup = window.devhub.r8.command.onEvent((event) => {
          if (event.type === 'protocol-open') {
            host.__r8Spec04ProtocolEvents?.push(event)
          }
        })
      })

      const protocolWasRegistered = await electronApp.evaluate(({ app }) => app.isDefaultProtocolClient('devhub'))
      if (!protocolWasRegistered) {
        const protocolRegistration = await window.evaluate(async () => {
          return window.devhub.r8.command.registerOsProtocol(true, 'e2e-command-palette')
        })
        expect(protocolRegistration).toMatchObject({
          action: 'register',
          registered: true,
          scheme: 'devhub',
          success: true
        })
        protocolRegisteredByTest = true
      }

      await electronApp.evaluate(async ({ shell }, uri) => {
        await shell.openExternal(uri)
      }, protocolUri)
      await expect.poll(async () => {
        return window?.evaluate((uri) => {
          const host = window as typeof window & Spec04CommandProtocolWindow
          return host.__r8Spec04ProtocolEvents?.some(event => event.uri === uri) ?? false
        }, protocolUri) ?? false
      }, {
        message: '等待系统 devhub:// 协议通过 second-instance 转发到 renderer command event',
        timeout: 20_000
      }).toBe(true)
    } finally {
      if (window && !window.isClosed()) {
        await window.evaluate(async (history) => {
          const host = window as typeof window & Spec04CommandProtocolWindow
          host.__r8Spec04ProtocolCleanup?.()
          delete host.__r8Spec04ProtocolCleanup
          delete host.__r8Spec04ProtocolEvents
          await window.devhub.r8.command.clearHistory('e2e-command-palette-restore')
          for (const entry of history) {
            await window.devhub.r8.command.addHistory(entry)
          }
          await window.devhub.r8.command.saveCustom({
            id: 'custom.e2e.open-dashboard',
            label: 'E2E Open Dashboard',
            handlerScript: 'command:dashboard.open',
            shortcut: [],
            enabled: false,
            confirmedBy: 'e2e-command-palette-cleanup'
          })
        }, originalHistory).catch(() => undefined)
        if (protocolRegisteredByTest) {
          await window.evaluate(async () => {
            await window.devhub.r8.command.registerOsProtocol(false, 'e2e-command-palette-cleanup')
          }).catch(() => undefined)
        }
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-08 statusbar settings persist through real IPC and live UI', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null
    let originalConfig: StatusbarConfig | null = null

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)

      originalConfig = await window.evaluate(async () => window.devhub.r8.statusbar.getConfig())
      await window.evaluate(async () => {
        await window.devhub.r8.statusbar.reset('e2e-statusbar')
      })

      await expect(window.getByTestId('statusbar')).toBeVisible({ timeout: 15_000 })
      await expect(window.getByTestId('status-tile-cpu')).toBeVisible({ timeout: 15_000 })

      const pushedAggregate = await window.evaluate(async () => {
        return new Promise<{ tileCount: number; badgeCount: number; generatedAt: number } | null>((resolve) => {
          const timer = window.setTimeout(() => {
            unsubscribe()
            resolve(null)
          }, 5_000)
          const unsubscribe = window.devhub.r8.status.onAggregate((aggregate) => {
            window.clearTimeout(timer)
            unsubscribe()
            resolve({
              tileCount: aggregate.tiles.length,
              badgeCount: aggregate.badges.length,
              generatedAt: aggregate.generatedAt
            })
          })
        })
      })
      expect(pushedAggregate).not.toBeNull()
      expect(pushedAggregate?.tileCount).toBeGreaterThanOrEqual(12)
      expect(pushedAggregate?.badgeCount).toBeGreaterThanOrEqual(6)

      await window.getByTestId('sidebar-settings-button').click()
      const dialog = settingsDialogByContract(window)
      await expect(dialog).toBeVisible({ timeout: 5_000 })
      const cpuSetting = dialog.getByTestId('statusbar-setting-tile-cpu')
      await expect(cpuSetting).toBeVisible({ timeout: 15_000 })

      await window.evaluate(() => {
        const source = document.querySelector('[data-testid="statusbar-setting-tile-cmdk"]')
        const target = document.querySelector('[data-testid="statusbar-setting-tile-cpu"]')
        if (!source || !target) throw new Error('R8.B spec-08 statusbar drag targets not found')
        const dataTransfer = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }))
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }))
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }))
      })
      await expect.poll(async () => window!.evaluate(async () => {
        const config = await window.devhub.r8.statusbar.getConfig()
        return [...config.tiles].sort((left, right) => left.order - right.order).map(tile => tile.id).slice(0, 2)
      }), {
        message: '等待 SettingsDialog 拖拽顺序通过 statusbar:set-config 持久化',
        timeout: 10_000
      }).toEqual(['cmdk', 'cpu'])

      await cpuSetting.click()
      await expect.poll(async () => window!.evaluate(async () => {
        const config = await window.devhub.r8.statusbar.getConfig()
        return config.tiles.find(tile => tile.id === 'cpu')?.visible ?? null
      }), {
        message: '等待 SettingsDialog tile 隐藏开关通过 statusbar:set-config 持久化',
        timeout: 10_000
      }).toBe(false)

      await expect(window.getByTestId('status-tile-cpu')).toHaveCount(0, { timeout: 10_000 })
      const aggregateAfterHide = await window.evaluate(async () => window.devhub.r8.status.aggregate())
      expect(aggregateAfterHide.tiles.find(tile => tile.id === 'cpu')).toMatchObject({ visible: false })
    } finally {
      if (window && !window.isClosed() && originalConfig) {
        await window.evaluate(async (config) => {
          await window.devhub.r8.statusbar.setConfig(config)
        }, originalConfig).catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.C spec-07 monitor BrowserWindow covers packaged five-GWT lifecycle', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null
    let monitorPage: Page | null = null
    let monitorWindowId: string | null = null

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)
      await closeLiveR8MonitorPopouts(window)

      const monitorPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const opened = await window.evaluate(async () => {
        return window.devhub.r8.monitor.open()
      })
      monitorWindowId = opened.windowId
      expect(opened.success).toBe(true)
      expect(opened.windowState.bounds.w).toBeGreaterThanOrEqual(640)

      monitorPage = await monitorPagePromise
      await monitorPage.waitForLoadState('domcontentloaded')
      await expect.poll(() => monitorPage?.url() ?? '', {
        message: '等待 spec-07 独立 monitor BrowserWindow 携带 r8Popout 查询参数',
        timeout: 10_000
      }).toContain(`r8Popout=${encodeURIComponent(monitorWindowId)}`)
      await expect.poll(() => monitorPage?.url() ?? '', {
        message: 'wait for spec-07 monitor BrowserWindow dedicated renderer entry',
        timeout: 10_000
      }).toContain('monitor.html')
      await navigateMonitorPageToR8Ops(monitorPage)
      await expect.poll(async () => monitorPage?.locator('[data-r8c-monitor-window="true"] [data-tool]').count() ?? 0, {
        message: '等待 monitor BrowserWindow 渲染五个真实 ToolCard',
        timeout: 15_000
      }).toBe(5)

      const monitorBridgeSurface = await monitorPage.evaluate(() => ({
        hasCliApi: Reflect.has(window.devhub.r8, 'cli'),
        hasDevhub: Boolean(window.devhub),
        hasMonitorApi: Boolean(window.devhub.r8.monitor),
        hasPopoutApi: Reflect.has(window.devhub.r8, 'popout'),
        hasProjectsApi: Reflect.has(window.devhub, 'projects'),
        hasSystemProcessApi: Reflect.has(window.devhub, 'systemProcess'),
        monitorKeys: Object.keys(window.devhub.r8.monitor).sort(),
        r8Keys: Object.keys(window.devhub.r8).sort()
      }))
      expect(monitorBridgeSurface).toEqual({
        hasCliApi: false,
        hasDevhub: true,
        hasMonitorApi: true,
        hasPopoutApi: false,
        hasProjectsApi: false,
        hasSystemProcessApi: false,
        monitorKeys: ['close', 'closePopout', 'focusInstance', 'listPopouts', 'onPopoutSnapshotStream', 'onSnapshotStream', 'openPopout', 'returnPopoutToMain', 'setPopoutLayout', 'setWindowPrefs', 'snapshot'],
        r8Keys: ['monitor']
      })
      expect(existsSync(join(process.cwd(), 'out/preload/monitor.cjs'))).toBe(true)
      expect(existsSync(join(process.cwd(), 'out/renderer/monitor.html'))).toBe(true)

      const snapshot = await monitorPage.evaluate(async () => {
        return window.devhub.r8.monitor.snapshot()
      })
      expect(snapshot.cards.map(card => card.tool).sort()).toEqual(['claude', 'codex', 'copilot', 'cursor', 'gemini'])
      expect(snapshot.cards).toHaveLength(5)

      const streamReport = await monitorPage.evaluate(async () => {
        const startedAt = performance.now()
        return new Promise<{ alwaysOnTop: boolean; cardCount: number; elapsedMs: number; opacity: number; timeout: boolean }>((resolve) => {
          let unsubscribe = (): void => undefined
          const timeout = window.setTimeout(() => {
            unsubscribe()
            resolve({ alwaysOnTop: false, cardCount: 0, elapsedMs: performance.now() - startedAt, opacity: 0, timeout: true })
          }, 5_000)
          unsubscribe = window.devhub.r8.monitor.onSnapshotStream(nextSnapshot => {
            window.clearTimeout(timeout)
            unsubscribe()
            resolve({
              alwaysOnTop: nextSnapshot.windowState.alwaysOnTop,
              cardCount: nextSnapshot.cards.length,
              elapsedMs: performance.now() - startedAt,
              opacity: nextSnapshot.windowState.opacity,
              timeout: false
            })
          })
          void window.devhub.r8.monitor.setWindowPrefs({
            alwaysOnTop: true,
            confirmedBy: 'e2e-spec07',
            opacity: 0.82
          })
        })
      })
      expect(streamReport.timeout).toBe(false)
      expect(streamReport.cardCount).toBe(5)
      expect(streamReport.alwaysOnTop).toBe(true)
      expect(Math.round(streamReport.opacity * 100)).toBe(82)
      expect(streamReport.elapsedMs).toBeLessThan(5_000)

      const nativeMonitorWindow = await electronApp.browserWindow(monitorPage)
      await expect.poll(async () => nativeMonitorWindow.evaluate(browserWindow => browserWindow.isAlwaysOnTop()), {
        message: '等待 spec-07 always-on-top 偏好真实应用到 monitor BrowserWindow',
        timeout: 10_000
      }).toBe(true)
      await expect.poll(async () => nativeMonitorWindow.evaluate(browserWindow => Math.round(browserWindow.getOpacity() * 100)), {
        message: '等待 spec-07 opacity 偏好真实应用到 monitor BrowserWindow',
        timeout: 10_000
      }).toBe(82)

      const nativeMainWindow = await electronApp.browserWindow(window)
      await nativeMainWindow.evaluate(browserWindow => browserWindow.close())
      await expect.poll(() => monitorPage?.isClosed() ?? true, {
        message: '主窗关闭后 monitor BrowserWindow 必须继续存活',
        timeout: 10_000
      }).toBe(false)
      await expect(monitorPage.locator('[data-r8c-monitor-dedicated="true"]')).toBeVisible({ timeout: 10_000 })
      const snapshotAfterMainClose = await monitorPage.evaluate(async () => {
        return window.devhub.r8.monitor.snapshot()
      })
      expect(snapshotAfterMainClose.cards).toHaveLength(5)
    } finally {
      if (window && !window.isClosed()) {
        await closeLiveR8MonitorPopouts(window).catch(() => undefined)
      } else if (monitorPage && !monitorPage.isClosed()) {
        await closeLiveR8MonitorPopouts(monitorPage).catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-07 theme decoration custom SVG and sound config use real IPC', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null
    let uploadedId: string | null = null
    let originalAppearance: unknown = null

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)

      originalAppearance = await window.evaluate(async () => {
        return (await window.devhub.settings.get()).appearance
      })

      await window.getByTestId('sidebar-settings-button').click()
      const dialog = settingsDialogByContract(window)
      await expect(dialog).toBeVisible({ timeout: 10_000 })
      await expect(dialog.getByTestId('custom-svg-uploader')).toBeVisible({ timeout: 10_000 })
      const decorationList = await window.evaluate(async () => window.devhub.r8.themeDecoration.list())
      expect(decorationList.kinds.filter(kind => kind !== 'none' && kind !== 'custom-svg')).toHaveLength(8)

      await dialog.getByTestId('svg-upload').setInputFiles(join('e2e', 'fixtures', 'theme-safe.svg'))
      await expect(dialog.getByText(/已保存 theme-safe\.svg/)).toBeVisible({ timeout: 10_000 })

      const uploadState = await window.evaluate(async () => {
        const list = await window.devhub.r8.themeDecoration.listCustomSvg()
        const entry = list.items.find(item => item.name === 'theme-safe.svg') ?? null
        return {
          entry,
          listCount: list.items.length,
          settingsDecoration: (await window.devhub.settings.get()).appearance.decoration
        }
      })
      expect(uploadState.entry).not.toBeNull()
      uploadedId = uploadState.entry?.id ?? null
      expect(uploadState.entry?.sanitizedContent).toContain('<svg')
      expect(uploadState.settingsDecoration).toMatchObject({ kind: 'custom-svg', customSvgId: uploadedId })

      await window.evaluate(async (customSvgId) => {
        if (!customSvgId) throw new Error('customSvgId missing')
        const settings = await window.devhub.settings.get()
        const config = {
          kind: 'custom-svg',
          customSvgId,
          opacity: 0.22,
          positions: ['global-background', 'card-background', 'detail-panel-background', 'statusbar-background', 'empty-state', 'header'],
          blendMode: 'normal',
          scale: 1,
          motionRespect: true
        }
        await window.devhub.r8.themeDecoration.set(config)
        await window.devhub.settings.update({ appearance: { ...settings.appearance, decoration: config } })
        window.dispatchEvent(new CustomEvent('devhub:theme-decoration-change', { detail: config }))
      }, uploadedId)
      await expect(window.getByTestId('theme-decoration-custom-svg')).toBeVisible({ timeout: 10_000 })
      await expect.poll(async () => {
        return window.evaluate(() => {
          const positions = Array.from(document.querySelectorAll<HTMLElement>('[data-decoration-position]'))
            .map(element => element.dataset.decorationPosition)
            .filter((value): value is string => typeof value === 'string')
          return {
            positions,
            hasCardOrEmpty: positions.includes('card-background') || positions.includes('empty-state')
          }
        })
      }, { timeout: 10_000 }).toMatchObject({
        positions: expect.arrayContaining(['global-background', 'detail-panel-background', 'statusbar-background', 'header']),
        hasCardOrEmpty: true
      })

      await dialog.getByTestId('svg-upload').setInputFiles(join('e2e', 'fixtures', 'theme-malicious.svg'))
      await expect(dialog.getByText(/禁止标签：script/)).toBeVisible({ timeout: 10_000 })
      const postRejectCount = await window.evaluate(async () => {
        return (await window.devhub.r8.themeDecoration.listCustomSvg()).items.length
      })
      expect(postRejectCount).toBe(uploadState.listCount)

      const soundConfig = await window.evaluate(async () => {
        const config = {
          themeId: 'cyberpunk',
          enabled: true,
          volume: 0.25,
          events: {
            hover: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
          }
        }
        await window.devhub.r8.themeDecoration.setSoundConfig(config)
        return window.devhub.r8.themeDecoration.getSoundConfig('cyberpunk')
      })
      expect(soundConfig).toMatchObject({ themeId: 'cyberpunk', enabled: true, volume: 0.25 })
      expect(soundConfig.events.hover).toMatch(/^data:audio\/wav;base64,/)
    } finally {
      if (window && !window.isClosed()) {
        await window.evaluate(async ({ appearance, customSvgId }) => {
          if (customSvgId) await window.devhub.r8.themeDecoration.removeCustomSvg(customSvgId, 'theme-decoration-e2e-cleanup')
          if (appearance) {
            await window.devhub.settings.update({ appearance })
            window.dispatchEvent(new CustomEvent('devhub:theme-decoration-change', { detail: appearance.decoration }))
          }
        }, { appearance: originalAppearance, customSvgId: uploadedId }).catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.C spec-08 monitor tool popouts cover packaged five-GWT layout return and stream survival', async () => {
    test.setTimeout(150_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null
    let monitorPage: Page | null = null
    let claudePage: Page | null = null
    let codexPage: Page | null = null
    let claudePopoutId: string | null = null
    let codexPopoutId: string | null = null

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)
      await closeLiveR8MonitorPopouts(window)

      const monitorPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const openedMonitor = await window.evaluate(async () => {
        return window.devhub.r8.monitor.open()
      })
      expect(openedMonitor.success).toBe(true)
      monitorPage = await monitorPagePromise
      await monitorPage.waitForLoadState('domcontentloaded')
      await navigateMonitorPageToR8Ops(monitorPage)

      const claudePagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const openedClaude = await monitorPage.evaluate(async () => {
        return window.devhub.r8.monitor.openPopout('claude', 'compact')
      })
      claudePopoutId = openedClaude.popoutId
      expect(openedClaude.success).toBe(true)
      expect(openedClaude.popout.tool).toBe('claude')
      expect(openedClaude.popout.miniLayout).toBe('compact')

      claudePage = await claudePagePromise
      await claudePage.waitForLoadState('domcontentloaded')
      await expect.poll(() => claudePage?.url() ?? '', {
        message: '等待 claude monitor tool popout 使用独立 BrowserWindow route',
        timeout: 10_000
      }).toContain('target=claude')
      await expect.poll(() => claudePage?.url() ?? '', {
        message: 'wait for claude monitor tool popout dedicated renderer entry',
        timeout: 10_000
      }).toContain('monitor-popout.html')
      await waitForDedicatedMonitorPopout(claudePage, 'claude', 'compact')

      const claudeBridgeSurface = await claudePage.evaluate(() => ({
        hasCliApi: Reflect.has(window.devhub.r8, 'cli'),
        hasDevhub: Boolean(window.devhub),
        hasMonitorApi: Boolean(window.devhub.r8.monitor),
        hasPopoutApi: Reflect.has(window.devhub.r8, 'popout'),
        hasProjectsApi: Reflect.has(window.devhub, 'projects'),
        hasSystemProcessApi: Reflect.has(window.devhub, 'systemProcess'),
        monitorKeys: Object.keys(window.devhub.r8.monitor).sort(),
        r8Keys: Object.keys(window.devhub.r8).sort()
      }))
      expect(claudeBridgeSurface).toEqual({
        hasCliApi: false,
        hasDevhub: true,
        hasMonitorApi: true,
        hasPopoutApi: false,
        hasProjectsApi: false,
        hasSystemProcessApi: false,
        monitorKeys: ['closePopout', 'focusInstance', 'listPopouts', 'onPopoutSnapshotStream', 'returnPopoutToMain', 'setPopoutLayout', 'snapshot'],
        r8Keys: ['monitor']
      })
      expect(existsSync(join(process.cwd(), 'out/preload/monitor-popout.cjs'))).toBe(true)
      expect(existsSync(join(process.cwd(), 'out/renderer/monitor-popout.html'))).toBe(true)

      const codexPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const openedCodex = await monitorPage.evaluate(async () => {
        return window.devhub.r8.monitor.openPopout('codex', 'compact')
      })
      codexPopoutId = openedCodex.popoutId
      expect(openedCodex.success).toBe(true)
      expect(openedCodex.popout.tool).toBe('codex')

      codexPage = await codexPagePromise
      await codexPage.waitForLoadState('domcontentloaded')
      await waitForDedicatedMonitorPopout(codexPage, 'codex', 'compact')

      const activeToolPopouts = await monitorPage.evaluate(async () => {
        return (await window.devhub.r8.monitor.listPopouts()).map(popout => ({
          bridgeState: popout.bridgeState,
          layout: popout.miniLayout,
          tool: popout.tool,
          windowId: popout.windowId
        }))
      })
      expect(activeToolPopouts.filter(popout => popout.bridgeState !== 'closed').map(popout => popout.tool).sort()).toEqual(['claude', 'codex'])

      await claudePage.locator('[data-tool="claude"]').getByRole('button', { name: '布局' }).click()
      await claudePage.getByRole('menuitem', { name: '仅事件' }).click()
      await expect(claudePage.locator('[data-tool="claude"][data-layout="events-only"]')).toBeVisible({ timeout: 10_000 })
      await expect(claudePage.locator('[data-monitor-popout-events="claude"]')).toBeVisible({ timeout: 10_000 })
      await expect(claudePage.locator('[data-tool="claude"] [role="progressbar"]')).toHaveCount(0)
      const claudeLayout = await claudePage.evaluate(async (popoutId) => {
        return (await window.devhub.r8.monitor.listPopouts()).find(popout => popout.windowId === popoutId)?.miniLayout ?? null
      }, claudePopoutId)
      expect(claudeLayout).toBe('events-only')

      const claudeClose = claudePage.waitForEvent('close', { timeout: 10_000 })
      await claudePage.locator('[data-tool="claude"]').dispatchEvent('dblclick')
      await claudeClose
      claudePage = null
      const afterReturn = await monitorPage.evaluate(async () => {
        return (await window.devhub.r8.monitor.listPopouts()).map(popout => ({ bridgeState: popout.bridgeState, tool: popout.tool }))
      })
      expect(afterReturn.some(popout => popout.tool === 'claude' && popout.bridgeState !== 'closed')).toBe(false)
      expect(afterReturn.some(popout => popout.tool === 'codex' && popout.bridgeState !== 'closed')).toBe(true)

      const monitorClose = monitorPage.waitForEvent('close', { timeout: 10_000 })
      await window.evaluate(async () => {
        await window.devhub.r8.monitor.close()
      })
      await monitorClose
      monitorPage = null

      const streamAfterMainMonitorClose = await codexPage.evaluate(async (popoutId) => {
        return new Promise<{ timeout: boolean; tool: string | null }>((resolve) => {
          let unsubscribe = (): void => undefined
          const timeout = window.setTimeout(() => {
            unsubscribe()
            resolve({ timeout: true, tool: null })
          }, 5_000)
          unsubscribe = window.devhub.r8.monitor.onPopoutSnapshotStream(card => {
            window.clearTimeout(timeout)
            unsubscribe()
            resolve({
              timeout: false,
              tool: card.tool
            })
          })
          void window.devhub.r8.monitor.setPopoutLayout(popoutId, 'progress-only')
        })
      }, codexPopoutId)
      expect(streamAfterMainMonitorClose.timeout).toBe(false)
      expect(streamAfterMainMonitorClose.tool).toBe('codex')
      await expect(codexPage.locator('[data-tool="codex"][data-layout="progress-only"]')).toBeVisible({ timeout: 10_000 })
    } finally {
      if (window && !window.isClosed()) {
        await closeLiveR8MonitorPopouts(window).catch(() => undefined)
      } else if (codexPage && !codexPage.isClosed()) {
        await closeLiveR8MonitorPopouts(codexPage).catch(() => undefined)
      }
      if (claudePage && !claudePage.isClosed()) {
        await claudePage.close().catch(() => undefined)
      }
      if (codexPage && !codexPage.isClosed()) {
        await codexPage.close().catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-10 window batch minimizes real BrowserWindows and undoes them', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let firstProbeId: number | null = null
    let secondProbeId: number | null = null
    const firstTitle = `DevHub spec-10 batch probe A ${Date.now()}`
    const secondTitle = `DevHub spec-10 batch probe B ${Date.now()}`

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      const { window } = launch
      await dismissAutoDiscoveryIfPresent(window)
      firstProbeId = await createRealBrowserWindowWithTitle(electronApp, firstTitle)
      secondProbeId = await createRealBrowserWindowWithTitle(electronApp, secondTitle)

      let targetHwnds: number[] = []
      await expect.poll(async () => {
        targetHwnds = await electronApp.evaluate(async (_, titles) => {
          const hooks = (globalThis as typeof globalThis & {
            __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
          }).__DEVHUB_TEST_HOOKS__
          if (!hooks) {
            throw new Error('Runtime test hooks are not available for R8.B spec-10')
          }
          const scan = await hooks.scanWindowsIntoCacheForTests()
          const rows = scan.data
          return rows
            .filter(row => titles.includes(row.title))
            .sort((left, right) => left.title.localeCompare(right.title))
            .map(row => row.hwnd)
        }, [firstTitle, secondTitle])
        return targetHwnds.length
      }, {
        message: 'wait for real probe BrowserWindows to be visible to WindowManager',
        timeout: 30_000,
        intervals: [500, 750, 1000]
      }).toBe(2)

      const report = await window.evaluate(async (hwnds): Promise<Spec10WindowBatchReport> => {
        const batchOp = window.devhub.windowManager.batchOp
        const batchUndo = window.devhub.windowManager.batchUndo
        const onBatchProgress = window.devhub.windowManager.onBatchProgress
        if (!batchOp || !batchUndo || !onBatchProgress) {
          throw new Error('Window batch preload API is unavailable')
        }

        const progressEvents: WindowBatchProgress[] = []
        const unsubscribe = onBatchProgress(progress => {
          progressEvents.push(progress)
        })

        try {
          const started = await batchOp({
            action: 'minimize',
            confirmed: true,
            hwnds
          })
          const finalProgress = await new Promise<WindowBatchProgress>((resolve, reject) => {
            const handles: { interval?: number; timeout?: number } = {}
            handles.timeout = window.setTimeout(() => {
              if (handles.interval !== undefined) window.clearInterval(handles.interval)
              reject(new Error(`Timed out waiting for window batch progress ${started.jobId}`))
            }, 20_000)
            handles.interval = window.setInterval(() => {
              const latest = [...progressEvents].reverse().find(progress => progress.jobId === started.jobId)
              if (latest && latest.state !== 'running') {
                if (handles.timeout !== undefined) window.clearTimeout(handles.timeout)
                if (handles.interval !== undefined) window.clearInterval(handles.interval)
                resolve(latest)
              }
            }, 100)
          })
          const undo = await batchUndo(started.jobId, 'e2e-spec-10')
          return {
            batchJobId: started.jobId,
            completed: finalProgress.completed,
            failed: finalProgress.failed,
            resultStatuses: finalProgress.results.map(result => result.status),
            state: finalProgress.state,
            targetHwnds: hwnds,
            undoUndone: undo.undone
          }
        } finally {
          unsubscribe()
        }
      }, targetHwnds)

      expect(report.batchJobId).toMatch(/^[0-9a-f-]{36}$/)
      expect(report.state).toBe('completed')
      expect(report.completed).toBe(targetHwnds.length)
      expect(report.failed).toBe(0)
      expect(report.resultStatuses).toEqual(['ok', 'ok'])
      expect(report.undoUndone).toBe(targetHwnds.length)
    } finally {
      if (electronApp) {
        await closeRealBrowserWindowById(electronApp, firstProbeId)
        await closeRealBrowserWindowById(electronApp, secondProbeId)
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('ASSERT_WINDOW_BATCH_7_OPS covers real focus minimize close aot screenshot rename and inject paths', async () => {
    test.setTimeout(180_000)
    let electronApp: ElectronApplication | null = null
    let probeIds: Spec10AssertionProbeIds | null = null
    const suffix = Date.now()
    const titles: Spec10AssertionProbeTitles = {
      aot: `DevHub ASSERT_WINDOW_BATCH_7_OPS aot ${suffix}`,
      close: `DevHub ASSERT_WINDOW_BATCH_7_OPS close ${suffix}`,
      focus: `DevHub ASSERT_WINDOW_BATCH_7_OPS focus ${suffix}`,
      inject: `DevHub ASSERT_WINDOW_BATCH_7_OPS inject ${suffix}`,
      minimize: `DevHub ASSERT_WINDOW_BATCH_7_OPS minimize ${suffix}`,
      rename: `DevHub ASSERT_WINDOW_BATCH_7_OPS rename ${suffix}`,
      screenshot: `DevHub ASSERT_WINDOW_BATCH_7_OPS screenshot ${suffix}`
    }
    const renamedTitle = `DevHub ASSERT_WINDOW_BATCH_7_OPS renamed ${suffix}`
    const aliasName = `assert-window-batch-${suffix}`
    const injectedText = `ASSERT_WINDOW_BATCH_7_OPS_TEXT_${suffix}`

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      const { window } = launch
      await dismissAutoDiscoveryIfPresent(window)
      probeIds = await createSpec10AssertionProbeWindows(electronApp, titles)
      const hwnds = await scanSpec10AssertionHwnds(electronApp, titles)

      await electronApp.evaluate(({ BrowserWindow }, injectProbeId) => {
        const probeWindow = BrowserWindow.fromId(injectProbeId)
        if (!probeWindow || probeWindow.isDestroyed()) throw new Error('Inject probe BrowserWindow is unavailable')
        probeWindow.focus()
        probeWindow.webContents.focus()
      }, probeIds.inject)

      const focusProgress = await runSpec10Batch(window, { action: 'focus', hwnds: [hwnds.focus] })
      const focusedWindowId = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id ?? null)

      const minimizeProgress = await runSpec10Batch(window, { action: 'minimize', hwnds: [hwnds.minimize] })
      const undone = await undoSpec10Batch(window, minimizeProgress.jobId)

      const aotOnProgress = await runSpec10Batch(window, { action: 'aot-toggle', args: { topmost: true }, hwnds: [hwnds.aot] })
      const aotOffProgress = await runSpec10Batch(window, { action: 'aot-toggle', args: { topmost: false }, hwnds: [hwnds.aot] })
      const screenshotProgress = await runSpec10Batch(window, { action: 'screenshot', hwnds: [hwnds.screenshot] })
      const renameProgress = await runSpec10Batch(window, {
        action: 'rename',
        args: { alias: aliasName, title: renamedTitle, toolType: 'other' },
        hwnds: [hwnds.rename]
      })
      await expect.poll(async () => {
        return electronApp.evaluate((_, { alias, appliedTitle, hwnd }) => {
          const hooks = (globalThis as typeof globalThis & {
            __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
          }).__DEVHUB_TEST_HOOKS__
          if (!hooks) {
            throw new Error('Runtime test hooks are not available for ASSERT_WINDOW_BATCH_7_OPS alias persistence')
          }
          const aliases = hooks.listAliasesForTests()
          return aliases.some(item =>
            item.alias === alias
            && item.appliedExternalTitle?.hwnd === hwnd
            && item.appliedExternalTitle.appliedTitle === appliedTitle
          )
        }, { alias: aliasName, appliedTitle: renamedTitle, hwnd: hwnds.rename })
      }, {
        message: 'wait for ASSERT_WINDOW_BATCH_7_OPS alias persistence',
        timeout: 10_000,
        intervals: [250, 500, 750]
      }).toBe(true)
      await electronApp.evaluate(async ({ BrowserWindow }, injectProbeId) => {
        const probeWindow = BrowserWindow.fromId(injectProbeId)
        if (!probeWindow || probeWindow.isDestroyed()) throw new Error('Inject probe BrowserWindow is unavailable before inject-text')
        probeWindow.show()
        probeWindow.focus()
        probeWindow.webContents.focus()
        await probeWindow.webContents.executeJavaScript('const target = document.getElementById("spec10-inject-target"); target.focus(); target.value = ""; true')
      }, probeIds.inject)
      const injectProgress = await runSpec10Batch(window, { action: 'inject-text', args: { text: injectedText }, hwnds: [hwnds.inject] })
      const closeProgress = await runSpec10Batch(window, { action: 'close', hwnds: [hwnds.close] })

      await expect.poll(async (): Promise<Spec10AssertionState> => {
        if (!electronApp || !probeIds) throw new Error('Electron app is not available')
        return electronApp.evaluate(async ({ BrowserWindow }, ids): Promise<Spec10AssertionState> => {
          const closeProbe = BrowserWindow.fromId(ids.close)
          const injectProbe = BrowserWindow.fromId(ids.inject)
          const minimizeProbe = BrowserWindow.fromId(ids.minimize)
          return {
            closedProbeGone: !closeProbe || closeProbe.isDestroyed(),
            injectedValue: injectProbe && !injectProbe.isDestroyed()
              ? await injectProbe.webContents.executeJavaScript('document.getElementById("spec10-inject-target")?.value ?? ""')
              : '',
            minimizedAfterUndo: Boolean(minimizeProbe && !minimizeProbe.isDestroyed() && minimizeProbe.isMinimized())
          }
        }, probeIds)
      }, {
        message: 'wait for ASSERT_WINDOW_BATCH_7_OPS observable window effects',
        timeout: 15_000,
        intervals: [250, 500, 750]
      }).toMatchObject({
        closedProbeGone: true,
        injectedValue: injectedText,
        minimizedAfterUndo: false
      })

      const screenshotPath = screenshotProgress.results[0]?.output && typeof screenshotProgress.results[0].output === 'object'
        && 'path' in screenshotProgress.results[0].output
        ? String((screenshotProgress.results[0].output as { path: unknown }).path)
        : ''
      const summaries: Spec10BatchAssertionSummary[] = [
        { action: 'focus' as const, progress: focusProgress },
        { action: 'minimize' as const, progress: minimizeProgress },
        { action: 'aot-toggle' as const, progress: aotOnProgress },
        { action: 'aot-toggle' as const, progress: aotOffProgress },
        { action: 'screenshot' as const, progress: screenshotProgress },
        { action: 'rename' as const, progress: renameProgress },
        { action: 'inject-text' as const, progress: injectProgress },
        { action: 'close' as const, progress: closeProgress }
      ].map(({ action, progress }) => ({
        action,
        completed: progress.completed,
        failed: progress.failed,
        jobId: progress.jobId,
        statuses: progress.results.map(result => result.status)
      }))

      expect(focusProgress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
      expect(focusedWindowId).toBe(probeIds.focus)
      expect(minimizeProgress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
      expect(undone).toBe(1)
      expect(aotOnProgress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
      expect(aotOffProgress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
      expect(screenshotProgress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
      expect(screenshotPath).not.toBe('')
      expect(existsSync(screenshotPath)).toBe(true)
      expect(renameProgress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
      expect(injectProgress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
      expect(closeProgress).toMatchObject({ completed: 1, failed: 0, state: 'completed' })
      expect(summaries.every(summary => /^[0-9a-f-]{36}$/.test(summary.jobId))).toBe(true)
      expect(summaries.map(summary => summary.action)).toEqual(['focus', 'minimize', 'aot-toggle', 'aot-toggle', 'screenshot', 'rename', 'inject-text', 'close'])
      expect(summaries.flatMap(summary => summary.statuses)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'])
    } finally {
      if (electronApp && probeIds) {
        for (const id of Object.values(probeIds)) {
          await closeRealBrowserWindowById(electronApp, id)
        }
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-15 locale switch persists and updates command palette copy', async () => {
    test.setTimeout(120_000)
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let cleanupWindow: Page | null = null

    try {
      const firstLaunch = await launchApp()
      firstApp = firstLaunch.electronApp
      cleanupWindow = firstLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)
      await cleanupWindow.evaluate(async () => {
        await window.devhub.i18n.setLocale('zh-CN')
      })
      await cleanupWindow.reload({ waitUntil: 'domcontentloaded' })
      await dismissAutoDiscoveryIfPresent(cleanupWindow)
      await expect.poll(async () => cleanupWindow?.evaluate(() => document.documentElement.getAttribute('lang') ?? '') ?? '', {
        message: '等待 spec-15 默认 zh-CN locale 应用到 html lang',
        timeout: 10_000
      }).toBe('zh-CN')

      await cleanupWindow.getByTestId('sidebar-settings-button').click()
      const settingsDialog = settingsDialogByContract(cleanupWindow)
      await expect(settingsDialog).toBeVisible({ timeout: 10_000 })
      await settingsCategoryButton(settingsDialog, /高级|ADVANCED/i).click()
      const localeSwitcher = cleanupWindow.getByTestId('locale-switcher')
      await expect(localeSwitcher).toBeVisible({ timeout: 10_000 })
      await expect(localeSwitcher).toContainText('语言与区域')

      await cleanupWindow.locator('#locale-switcher-select').selectOption('en-US')
      await expect.poll(async () => cleanupWindow?.evaluate(() => document.documentElement.getAttribute('lang') ?? '') ?? '', {
        message: '等待 en-US locale 热切换到 html lang',
        timeout: 10_000
      }).toBe('en-US')
      await expect(localeSwitcher).toContainText('Language and Region')

      await cleanupWindow.keyboard.press('Escape')
      await cleanupWindow.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:open-command-palette'))
      })
      const commandPalette = cleanupWindow.getByTestId('command-palette')
      await expect(commandPalette).toBeVisible({ timeout: 10_000 })
      await expect(commandPalette.getByPlaceholder('Type a command, URI, or search...')).toBeVisible()

      const firstStoredLocale = await cleanupWindow.evaluate(async () => {
        return window.devhub.i18n.getLocale()
      })
      expect(firstStoredLocale.locale).toBe('en-US')

      await closeElectronApp(firstApp)
      firstApp = null
      cleanupWindow = null

      const secondLaunch = await launchApp()
      secondApp = secondLaunch.electronApp
      cleanupWindow = secondLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)

      await expect.poll(async () => cleanupWindow?.evaluate(() => document.documentElement.getAttribute('lang') ?? '') ?? '', {
        message: '等待重启后 en-US locale 从 LocaleStore 恢复',
        timeout: 10_000
      }).toBe('en-US')
      const secondStoredLocale = await cleanupWindow.evaluate(async () => {
        return window.devhub.i18n.getLocale()
      })
      expect(secondStoredLocale.locale).toBe('en-US')
    } finally {
      if (cleanupWindow && !cleanupWindow.isClosed()) {
        await cleanupWindow.evaluate(async () => {
          await window.devhub.i18n.setLocale('zh-CN')
        }).catch(() => undefined)
      }
      if (secondApp) {
        await closeElectronApp(secondApp).catch(() => undefined)
      }
      if (firstApp) {
        await closeElectronApp(firstApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-16 a11y runtime exposes real IPC keyboard path and zero critical axe violations', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)

      await expect.poll(async () => window?.evaluate(async () => {
        try {
          const prefs = await window.devhub.r8.a11y.getPrefs()
          return typeof prefs.largeText === 'boolean'
        } catch {
          return false
        }
      }) ?? false, {
        message: '等待 a11y concrete IPC handler 注册完成',
        timeout: 15_000
      }).toBe(true)

      await window.evaluate(async () => {
        await window.devhub.i18n.setLocale('zh-CN')
        const prefs = await window.devhub.r8.a11y.getPrefs()
        await window.devhub.r8.a11y.setPrefs({
          ...prefs,
          largeText: true,
          focusRingThickness: 'thick',
          screenReaderOptimized: true
        })
        window.dispatchEvent(new Event('devhub:a11y-prefs-changed'))
      })

      await expect.poll(async () => window?.evaluate(() => document.documentElement.dataset.a11yLargeText) ?? '', {
        message: '等待 a11y prefs 通过真实 IPC 持久化并应用到 html dataset',
        timeout: 10_000
      }).toBe('true')
      await expect.poll(async () => window?.evaluate(() => document.documentElement.dataset.a11yFocusRing) ?? '', {
        message: '等待 focus ring thickness 应用到 html dataset',
        timeout: 10_000
      }).toBe('thick')

      await expect(window.locator('#main-content[role="main"]')).toBeVisible()
      await expect(window.getByTestId('a11y-live-polite')).toHaveAttribute('aria-live', 'polite')
      await expect(window.getByTestId('a11y-live-assertive')).toHaveAttribute('aria-live', 'assertive')

      await window.keyboard.press('Tab')
      await expect(window.getByText('跳到主内容')).toBeVisible()

      await window.keyboard.press('Control+K')
      const commandPalette = window.getByTestId('command-palette')
      await expect(commandPalette).toBeVisible({ timeout: 10_000 })
      await expect(commandPalette.getByPlaceholder('输入命令、URI 或搜索词...')).toBeFocused()
      await window.keyboard.press('Escape')
      await expect(commandPalette).toBeHidden({ timeout: 10_000 })

      const runtime = await window.evaluate(async () => ({
        prefs: await window.devhub.r8.a11y.getPrefs(),
        osPrefs: await window.devhub.r8.a11y.osPrefs(),
        selfCheck: await window.devhub.r8.a11y.runSelfCheck()
      }))
      expect(runtime.prefs.largeText).toBe(true)
      expect(runtime.prefs.focusRingThickness).toBe('thick')
      expect(typeof runtime.osPrefs.reducedMotion).toBe('boolean')
      expect(runtime.selfCheck.axeExecuted).toBe(false)
      expect(runtime.selfCheck.warnings.some((warning: string) => warning.includes('pnpm a11y:audit'))).toBe(true)

      const axeSummary = await scanCriticalAxeViolations(window, 'main-shell')
      expect(axeSummary.criticalViolations).toEqual([])
    } finally {
      if (window && !window.isClosed()) {
        await window.evaluate(async () => {
          const prefs = await window.devhub.r8.a11y.getPrefs()
          await window.devhub.r8.a11y.setPrefs({
            ...prefs,
            largeText: false,
            focusRingThickness: 'normal',
            screenReaderOptimized: false
          })
        }).catch(() => undefined)
        await window.evaluate(async () => {
          await window.devhub.i18n.setLocale('zh-CN')
        }).catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-16 multi-surface live axe critical violations stay zero', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)

      const scans: AxeScanSummary[] = []
      scans.push(await scanCriticalAxeViolations(window, 'home-main-shell'))

      await buttonByText(window, '监控').click()
      await expect(window.getByText('系统监控')).toBeVisible({ timeout: 15_000 })
      scans.push(await scanCriticalAxeViolations(window, 'monitor-process-surface'))

      await window.getByTestId('nav-dashboard').click()
      await expect(
        window.locator('[data-testid="dashboard-page"], [data-testid="dashboard-disabled-page"]')
      ).toBeVisible({ timeout: 15_000 })
      scans.push(await scanCriticalAxeViolations(window, 'dashboard-route'))

      await window.getByTestId('sidebar-settings-button').click()
      const settingsDialog = settingsDialogByContract(window)
      await expect(settingsDialog).toBeVisible({ timeout: 10_000 })
      scans.push(await scanCriticalAxeViolations(window, 'settings-dialog'))

      await window.keyboard.press('Escape')
      await expect(settingsDialog).toBeHidden({ timeout: 10_000 })
      await window.keyboard.press('Control+K')
      const commandPalette = window.getByTestId('command-palette')
      await expect(commandPalette).toBeVisible({ timeout: 10_000 })
      scans.push(await scanCriticalAxeViolations(window, 'command-palette'))

      expect(scans.map(scan => scan.label)).toEqual([
        'home-main-shell',
        'monitor-process-surface',
        'dashboard-route',
        'settings-dialog',
        'command-palette'
      ])
      expect(scans.flatMap(scan => scan.criticalViolations)).toEqual([])
    } finally {
      if (window && !window.isClosed()) {
        await window.keyboard.press('Escape').catch(() => undefined)
        await window.evaluate(async () => {
          await window.devhub.i18n.setLocale('zh-CN')
        }).catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })

  test('P4.1 真实窗口长标题可截断、tooltip 与 marquee 且不撑破卡片', async () => {
    test.setTimeout(90_000)
    const longTitle = ('DevHub P4.1 Real Long Title ' + Date.now() + ' - ' + 'Nested terminal / pnpm build / electron-vite / attached topology verification '.repeat(3)).trim()
    const truncatedTitle = longTitle.slice(0, 40) + '…'
    const stableTitlePrefix = longTitle.slice(0, 32)
    const { electronApp, window } = await launchApp()
    let probeWindowId: number | null = null

    try {
      probeWindowId = await createRealBrowserWindowWithTitle(electronApp, longTitle)
      await dismissAutoDiscoveryIfPresent(window)

      await buttonByText(window, '监控').click()
      await buttonByText(window, '窗口').click()
      await expect(window.getByText('窗口管理')).toBeVisible({ timeout: 15000 })

      await expect.poll(async () => window.evaluate(async (title) => {
        const result = await window.devhub.windowManager.scan(false)
        return result.data?.some((item) => item.title === title) ?? false
      }, longTitle), {
        message: '等待真实 BrowserWindow 进入 WindowManager 扫描结果',
        timeout: 15000
      }).toBe(true)

      await window.locator('button[title="刷新"]').click()
      await window.getByPlaceholder('搜索窗口...').fill(longTitle.slice(0, 52))

      const titleCell = window.locator('[data-testid="window-title-cell"]').filter({ hasText: stableTitlePrefix }).first()
      await expect(titleCell).toBeVisible({ timeout: 15000 })
      await expect(titleCell).toHaveAttribute('title', longTitle)
      await expect(titleCell).toHaveText(truncatedTitle)

      const layoutBefore = await titleCell.evaluate((element) => {
        const card = element.closest('.monitor-card') as HTMLElement | null
        const titleRect = (element as HTMLElement).getBoundingClientRect()
        const cardRect = card?.getBoundingClientRect()
        return {
          cardHeight: cardRect?.height ?? 0,
          cardWidth: cardRect?.width ?? 0,
          titleHeight: titleRect.height
        }
      })
      expect(layoutBefore.cardHeight).toBeGreaterThanOrEqual(86)
      expect(layoutBefore.cardWidth).toBeGreaterThan(250)
      expect(layoutBefore.titleHeight).toBeLessThanOrEqual(28)

      await titleCell.click()
      await window.waitForTimeout(80)
      await titleCell.click()
      await expect(titleCell).toHaveAttribute('data-marquee-active', 'true')
      await expect(titleCell).toHaveText(longTitle)
      const marqueeHeight = await titleCell.evaluate((element) => (element as HTMLElement).getBoundingClientRect().height)
      expect(Math.abs(marqueeHeight - layoutBefore.titleHeight)).toBeLessThanOrEqual(6)

      await titleCell.click()
      await window.waitForTimeout(80)
      await titleCell.click()
      await expect(titleCell).toHaveAttribute('data-marquee-active', 'false')
      await expect(titleCell).toHaveText(truncatedTitle)
      await expect(titleCell).toHaveAttribute('title', longTitle)
    } finally {
      await closeRealBrowserWindowById(electronApp, probeWindowId)
      await closeElectronApp(electronApp)
    }
  })

  test('P4.2-a AI 窗口别名可真实应用外部标题并跨重启恢复', async () => {
    test.setTimeout(120_000)
    const unique = Date.now()
    const originalTitle = ('DevHub P4 Alias Window ' + unique).trim()
    const aliasName = ('验收别名 ' + unique).trim()
    const aliasId = 'e2e-p42a-' + unique
    const expectedAppliedTitle = '[Claude Code-' + aliasName + '] ' + originalTitle
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let firstWindow: Page | null = null
    let secondWindow: Page | null = null
    let probeWindowId: number | null = null
    let targetHwnd = 0
    let targetPid = 0

    try {
      const launched = await launchApp()
      firstApp = launched.electronApp
      firstWindow = launched.window
      probeWindowId = await createRealBrowserWindowWithTitle(firstApp, originalTitle)
      await dismissAutoDiscoveryIfPresent(firstWindow)

      await expect.poll(async () => {
        const match = await firstWindow!.evaluate(async (title) => {
          const result = await window.devhub.windowManager.scan(false)
          const item = result.data?.find((row) => row.title === title)
          return item ? { hwnd: item.hwnd, pid: item.pid, title: item.title } : null
        }, originalTitle)
        targetHwnd = match?.hwnd ?? 0
        targetPid = match?.pid ?? 0
        return targetHwnd > 0 && targetPid > 0
      }, {
        message: '等待真实 AI 别名目标窗口进入 WindowManager 扫描结果',
        timeout: 15000
      }).toBe(true)

      const renameReport = await firstWindow.evaluate(async ({ aliasId, aliasName, hwnd, originalTitle, pid }) => {
        await window.devhub.aiAlias.remove(aliasId).catch(() => false)
        const alias = {
          id: aliasId,
          alias: aliasName,
          matchCriteria: {
            pid,
            titlePrefix: originalTitle.slice(0, 30),
            toolType: 'claude-code' as const,
            workingDir: 'D:/Desktop/CREATOR ONE/devhub'
          },
          createdAt: Date.now(),
          lastMatchedAt: Date.now(),
          autoGenerated: false
        }
        const result = await window.devhub.aiAlias.renameAndApply({
          alias,
          newName: aliasName,
          hwnd,
          pid,
          toolType: 'claude-code',
          toolDisplayName: 'Claude Code',
          originalTitle,
          applyToExternalWindow: true,
          requestedAt: Date.now()
        })
        const aliases = await window.devhub.aiAlias.getAll()
        const savedAlias = aliases.find((item) => item.id === aliasId) ?? null
        const scan = await window.devhub.windowManager.scan(false)
        const renamedWindow = scan.data?.find((item) => item.hwnd === hwnd) ?? null
        return { result, savedAlias, renamedWindow }
      }, { aliasId, aliasName, hwnd: targetHwnd, originalTitle, pid: targetPid })

      expect(renameReport.result.success).toBe(true)
      expect(renameReport.result.titleApplied).toBe(true)
      expect(renameReport.result.appliedTitle).toBe(expectedAppliedTitle)
      expect(renameReport.savedAlias?.alias).toBe(aliasName)
      expect(renameReport.savedAlias?.autoGenerated).toBe(false)
      expect(renameReport.savedAlias?.appliedExternalTitle?.hwnd).toBe(targetHwnd)
      expect(renameReport.savedAlias?.appliedExternalTitle?.appliedTitle).toBe(expectedAppliedTitle)
      expect(renameReport.savedAlias?.matchCriteria.pid).toBeUndefined()
      expect(renameReport.savedAlias?.matchCriteria.toolType).toBe('claude-code')
      expect(renameReport.savedAlias?.matchCriteria.titlePrefix).toBe(originalTitle.slice(0, 30))
      expect(renameReport.renamedWindow?.title).toBe(expectedAppliedTitle)

      await closeRealBrowserWindowById(firstApp, probeWindowId)
      probeWindowId = null
      await closeElectronApp(firstApp)
      firstApp = null

      const relaunched = await launchApp()
      secondApp = relaunched.electronApp
      secondWindow = relaunched.window
      await dismissAutoDiscoveryIfPresent(secondWindow)

      const restoredAlias = await secondWindow.evaluate(async (aliasId) => {
        const aliases = await window.devhub.aiAlias.getAll()
        return aliases.find((item) => item.id === aliasId) ?? null
      }, aliasId)

      expect(restoredAlias?.alias).toBe(aliasName)
      expect(restoredAlias?.autoGenerated).toBe(false)
      expect(restoredAlias?.appliedExternalTitle?.appliedTitle).toBe(expectedAppliedTitle)
      expect(restoredAlias?.matchCriteria.pid).toBeUndefined()

      const removed = await secondWindow.evaluate(async (aliasId) => window.devhub.aiAlias.remove(aliasId), aliasId)
      expect(removed).toBe(true)
    } finally {
      if (firstApp) {
        await closeRealBrowserWindowById(firstApp, probeWindowId)
        await closeElectronApp(firstApp).catch(() => undefined)
      }
      if (secondApp) {
        if (secondWindow) {
          await secondWindow.evaluate(async (aliasId) => window.devhub.aiAlias.remove(aliasId), aliasId).catch(() => undefined)
        }
        await closeElectronApp(secondApp).catch(() => undefined)
      }
    }
  })

  test('P4.2-c-2 窗口布局可真实保存快照恢复快照并撤销', async () => {
    test.setTimeout(120_000)
    const unique = Date.now()
    const titles = [
      'DevHub P4 Layout Window A ' + unique,
      'DevHub P4 Layout Window B ' + unique
    ]
    const snapshotName = 'E2E P4 Layout Snapshot ' + unique
    const { electronApp, window } = await launchApp()
    const probeWindowIds: number[] = []

    const rectDistance = (
      actual: { x: number; y: number; width: number; height: number },
      expected: { x: number; y: number; width: number; height: number }
    ) => Math.max(
      Math.abs(actual.x - expected.x),
      Math.abs(actual.y - expected.y),
      Math.abs(actual.width - expected.width),
      Math.abs(actual.height - expected.height)
    )

    try {
      for (const title of titles) {
        probeWindowIds.push(await createRealBrowserWindowWithTitle(electronApp, title))
      }
      await dismissAutoDiscoveryIfPresent(window)

      let targets: Array<{
        hwnd: number
        title: string
        rect: { x: number; y: number; width: number; height: number }
      }> = []
      await expect.poll(async () => {
        const rows = await window.evaluate(async (titles) => {
          const result = await window.devhub.windowManager.scan(false)
          return titles
            .map((title) => result.data?.find((row) => row.title === title) ?? null)
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
            .map((row) => ({ hwnd: row.hwnd, title: row.title, rect: row.rect }))
        }, titles)
        targets = rows
        return rows.length
      }, {
        message: '等待真实布局目标窗口进入 WindowManager 扫描结果',
        timeout: 15000
      }).toBe(titles.length)

      const hwnds = targets.map((target) => target.hwnd)
      const initialRects = targets.map((target) => target.rect)
      const targetRects = [
        { x: 80, y: 90, width: 420, height: 320 },
        { x: 540, y: 90, width: 420, height: 320 }
      ]

      const report = await window.evaluate(async ({ hwnds, snapshotName, targetRects }) => {
        const snapshot = await window.devhub.windowManager.saveSnapshot(snapshotName, 'real e2e snapshot', hwnds)
        if (!snapshot.success || !snapshot.data) {
          throw new Error('saveSnapshot failed: ' + (snapshot.error ?? 'missing data'))
        }

        const firstApply = await window.devhub.windowManager.applyLayout?.({
          customRects: hwnds.map((hwnd, index) => ({ hwnd, rect: targetRects[index] })),
          saveRestorePoint: true
        })
        if (!firstApply?.ok) {
          throw new Error('first applyLayout failed: ' + JSON.stringify(firstApply?.failed ?? []))
        }
        const afterMove = await window.devhub.windowManager.scan(false)

        const restoreSnapshot = await window.devhub.windowManager.restoreSnapshot?.(snapshot.data.id)
        if (!restoreSnapshot?.ok) {
          throw new Error('restoreSnapshot failed: ' + JSON.stringify(restoreSnapshot?.failed ?? []))
        }
        const afterSnapshotRestore = await window.devhub.windowManager.scan(false)

        const secondApply = await window.devhub.windowManager.applyLayout?.({
          customRects: hwnds.map((hwnd, index) => ({ hwnd, rect: targetRects[index] })),
          saveRestorePoint: true
        })
        if (!secondApply?.ok || !secondApply.restorePointId) {
          throw new Error('second applyLayout failed: ' + JSON.stringify(secondApply?.failed ?? []))
        }

        const undo = await window.devhub.windowManager.restorePrevious?.(secondApply.restorePointId)
        if (!undo?.ok) {
          throw new Error('restorePrevious failed: ' + JSON.stringify(undo?.failed ?? []))
        }
        const afterUndo = await window.devhub.windowManager.scan(false)
        await window.devhub.windowManager.deleteSnapshot?.(snapshot.data.id)

        const pickRects = (rows?: Array<{ hwnd: number; rect: { x: number; y: number; width: number; height: number } }>) =>
          hwnds.map((hwnd) => rows?.find((row) => row.hwnd === hwnd)?.rect ?? null)

        return {
          firstApply,
          restoreSnapshot,
          secondApply,
          undo,
          afterMove: pickRects(afterMove.data),
          afterSnapshotRestore: pickRects(afterSnapshotRestore.data),
          afterUndo: pickRects(afterUndo.data),
          snapshotId: snapshot.data.id
        }
      }, { hwnds, snapshotName, targetRects })

      expect(report.firstApply.applied.map((item) => item.hwnd).sort()).toEqual([...hwnds].sort())
      expect(report.restoreSnapshot.applied.map((item) => item.hwnd).sort()).toEqual([...hwnds].sort())
      expect(report.secondApply.restorePointId).toBeTruthy()
      expect(report.undo.applied.map((item) => item.hwnd).sort()).toEqual([...hwnds].sort())
      expect(report.snapshotId).toContain('snapshot_')

      for (let index = 0; index < hwnds.length; index += 1) {
        expect(report.afterMove[index]).not.toBeNull()
        expect(report.afterSnapshotRestore[index]).not.toBeNull()
        expect(report.afterUndo[index]).not.toBeNull()
        expect(rectDistance(report.afterMove[index]!, targetRects[index])).toBeLessThanOrEqual(80)
        expect(rectDistance(report.afterSnapshotRestore[index]!, initialRects[index])).toBeLessThanOrEqual(100)
        expect(rectDistance(report.afterUndo[index]!, report.afterSnapshotRestore[index]!)).toBeLessThanOrEqual(80)
      }
    } finally {
      for (const id of probeWindowIds) {
        await closeRealBrowserWindowById(electronApp, id)
      }
      await closeElectronApp(electronApp)
    }
  })

  test('P4.2-e 窗口操作目录对真实窗口执行关键操作', async () => {
    test.setTimeout(120_000)
    const originalTitle = ('DevHub P4 Operation Window ' + Date.now()).trim()
    const renamedTitle = originalTitle + ' Renamed'
    const { electronApp, window } = await launchApp()
    let probeWindowId: number | null = null
    let targetHwnd = 0

    try {
      probeWindowId = await createRealBrowserWindowWithTitle(electronApp, originalTitle)
      await dismissAutoDiscoveryIfPresent(window)

      await expect.poll(async () => {
        const match = await window.evaluate(async (title) => {
          const result = await window.devhub.windowManager.scan(false)
          const item = result.data?.find((row) => row.title === title)
          return item ? { hwnd: item.hwnd, title: item.title } : null
        }, originalTitle)
        targetHwnd = match?.hwnd ?? 0
        return targetHwnd
      }, {
        message: '等待真实窗口操作目标进入 WindowManager 扫描结果',
        timeout: 15000
      }).toBeGreaterThan(0)

      const report = await window.evaluate(async ({ hwnd, renamedTitle }) => {
        const focus = await window.devhub.windowManager.focus(hwnd)
        const minimize = await window.devhub.windowManager.minimize(hwnd)
        const restoreFromMinimize = await window.devhub.windowManager.restore(hwnd)
        const maximize = await window.devhub.windowManager.maximize(hwnd)
        const restoreFromMaximize = await window.devhub.windowManager.restore(hwnd)
        const topmostOn = await window.devhub.windowManager.setTopmost(hwnd, true)
        const topmostOff = await window.devhub.windowManager.setTopmost(hwnd, false)
        const opacity = await window.devhub.windowManager.setOpacity(hwnd, 92)
        const favoriteOn = await window.devhub.windowManager.toggleFavorite?.(hwnd)
        const favoritesAfterOn = await window.devhub.windowManager.getFavorites?.()
        const favoriteOff = await window.devhub.windowManager.toggleFavorite?.(hwnd)
        const screenshot = await window.devhub.windowManager.screenshot?.(hwnd)
        const setTitle = await window.devhub.windowManager.setTitle(hwnd, renamedTitle)
        const afterRename = await window.devhub.windowManager.scan(false)
        const close = await window.devhub.windowManager.close(hwnd)
        return {
          focus,
          minimize,
          restoreFromMinimize,
          maximize,
          restoreFromMaximize,
          topmostOn,
          topmostOff,
          opacity,
          favoriteOn,
          favoritesAfterOn,
          favoriteOff,
          screenshot,
          setTitle,
          renamed: afterRename.data?.find((row) => row.hwnd === hwnd)?.title ?? null,
          close
        }
      }, { hwnd: targetHwnd, renamedTitle })

      for (const result of [
        report.focus,
        report.minimize,
        report.restoreFromMinimize,
        report.maximize,
        report.restoreFromMaximize,
        report.topmostOn,
        report.topmostOff,
        report.opacity,
        report.setTitle,
        report.close
      ]) {
        expect(result.success).toBe(true)
      }
      expect(report.favoriteOn?.success).toBe(true)
      expect(report.favoriteOn?.data?.favorite).toBe(true)
      expect(report.favoritesAfterOn?.some((record) => record.hwnd === targetHwnd)).toBe(true)
      expect(report.favoriteOff?.success).toBe(true)
      expect(report.favoriteOff?.data?.favorite).toBe(false)
      expect(report.screenshot?.success).toBe(true)
      expect(report.screenshot?.data?.hwnd).toBe(targetHwnd)
      expect(report.screenshot?.data?.width).toBeGreaterThan(0)
      expect(report.screenshot?.data?.height).toBeGreaterThan(0)
      expect(report.screenshot?.data?.source).toBe('win32-copy-from-screen')
      expect(report.screenshot?.data?.path && existsSync(report.screenshot.data.path)).toBe(true)
      expect(report.renamed).toBe(renamedTitle)

      await expect.poll(async () => {
        const stillVisible = await window.evaluate(async (title) => {
          const result = await window.devhub.windowManager.scan(false)
          return Boolean(result.data?.some((row) => row.title === title))
        }, renamedTitle)
        return stillVisible
      }, {
        message: '等待 window:close 关闭真实临时窗口',
        timeout: 15000
      }).toBe(false)
      probeWindowId = null
    } finally {
      await closeRealBrowserWindowById(electronApp, probeWindowId)
      await closeElectronApp(electronApp)
    }
  })

  test('P4.2-a-3 AI 完成通知在真实 Electron 历史中携带别名 metadata', async () => {
    test.setTimeout(90_000)
    const unique = Date.now()
    const aliasName = '验收通知别名 ' + unique
    const taskId = 'e2e-task-' + unique
    const { electronApp, window } = await launchApp()
    let probeWindowId: number | null = null
    let targetHwnd = 0
    let targetPid = 0

    try {
      probeWindowId = await createRealBrowserWindowWithTitle(electronApp, 'DevHub P4 Notification Window ' + unique)
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate(async () => window.devhub.notification.clearHistory())

      await expect.poll(async () => {
        const match = await window.evaluate(async (windowId) => {
          const result = await window.devhub.windowManager.scan(false)
          const item = result.data?.find((row) => row.title.includes(String(windowId)))
          return item ? { hwnd: item.hwnd, pid: item.pid } : null
        }, unique)
        targetHwnd = match?.hwnd ?? 0
        targetPid = match?.pid ?? 0
        return targetHwnd > 0 && targetPid > 0
      }, {
        message: '等待真实通知目标窗口进入 WindowManager 扫描结果',
        timeout: 15000
      }).toBe(true)

      const expectedDisplayName = 'Claude Code-' + aliasName
      const expectedTitle = '[' + expectedDisplayName + '] 任务完成'
      const emitted = await electronApp.evaluate(async (_electron, options) => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        if (!hooks) {
          throw new Error('Runtime test hooks are not available')
        }
        return hooks.emitTaskCompleteNotificationForTests(options)
      }, {
        alias: aliasName,
        durationMs: 185_000,
        pid: targetPid,
        taskId,
        toolName: 'Claude Code',
        windowHwnd: targetHwnd
      }) as {
        body?: string
        metadata?: Record<string, unknown>
        title?: string
        type?: string
      } | null

      expect(emitted?.type).toBe('task-complete')
      expect(emitted?.title).toBe(expectedTitle)
      expect(emitted?.body).toContain('PID:' + targetPid)
      expect(emitted?.metadata).toMatchObject({
        aliasOrToolName: aliasName,
        displayName: expectedDisplayName,
        taskId,
        windowHwnd: targetHwnd
      })

      await expect.poll(async () => {
        const history = await window.evaluate(async () => window.devhub.notification.getHistory(5))
        return history.find((entry) => entry.metadata?.taskId === taskId) ?? null
      }, {
        message: '等待 renderer IPC notification history 读到 alias metadata',
        timeout: 10000
      }).toMatchObject({
        metadata: {
          aliasOrToolName: aliasName,
          displayName: expectedDisplayName,
          taskId,
          windowHwnd: targetHwnd
        },
        title: expectedTitle,
        type: 'task-complete'
      })
    } finally {
      await closeRealBrowserWindowById(electronApp, probeWindowId)
      await closeElectronApp(electronApp)
    }
  })

  test('P4.2-d/P5.1 AI 进度状态由真实 tracker 派生且无矛盾组合', async () => {
    test.setTimeout(180_000)
    const unique = 'devhub-progress-probe-' + Date.now()
    const probeProcess = spawnRealAIProgressProbe(unique)
    const { electronApp, window } = await launchApp()
    let taskId = ''

    try {
      if (!probeProcess.pid) {
        throw new Error('Failed to start real AI progress probe process')
      }

      await dismissAutoDiscoveryIfPresent(window)
      await buttonByText(window, '监控').click()
      await expect(window.getByText('系统监控')).toBeVisible({ timeout: 15000 })
      await buttonByText(window, 'AI 任务').click()

      await expect.poll(async () => {
        return window.evaluate(async (pid) => {
          await window.devhub.aiTask.scan()
          const tasks = await window.devhub.aiTask.getAll()
          return tasks.find((task) => task.pid === pid)?.id ?? ''
        }, probeProcess.pid)
      }, {
        message: '等待真实 codex-like 子进程被 AITaskTracker 扫描为 AI 任务',
        timeout: 30_000
      }).not.toBe('')

      taskId = await window.evaluate(async (pid) => {
        const tasks = await window.devhub.aiTask.getAll()
        return tasks.find((task) => task.pid === pid)?.id ?? ''
      }, probeProcess.pid)
      expect(taskId).toBeTruthy()

      const card = window.locator('[data-testid="ai-task-card"]').filter({ hasText: 'PID: ' + probeProcess.pid }).first()
      await expect(card).toBeVisible()

      const readCardSnapshot = async () => card.evaluate((element) => {
        const progress = element.querySelector('[data-testid="ai-progress-bar"]') as HTMLElement | null
        const progressbar = element.querySelector('[role="progressbar"]')
        return {
          ariaValueNow: progressbar?.getAttribute('aria-valuenow') ?? null,
          barDisplay: progress ? getComputedStyle(progress).display : null,
          mode: element.getAttribute('data-progress-mode'),
          pct: element.getAttribute('data-progress-pct'),
          state: element.getAttribute('data-state'),
          text: element.textContent ?? ''
        }
      })

      const expected: Record<RuntimeMonitorState, { mode: string; pct?: number; label: string }> = {
        idle: { mode: 'hidden', label: '空闲' },
        thinking: { mode: 'indeterminate', label: '思考中' },
        coding: { mode: 'determinate', label: '编码中' },
        compiling: { mode: 'determinate', pct: 78, label: '编译中' },
        validating: { mode: 'determinate', pct: 92, label: '确认中' },
        'waiting-input': { mode: 'determinate', pct: 98, label: '等待输入' },
        completed: { mode: 'determinate', pct: 100, label: '已完成' },
        error: { mode: 'determinate', pct: 100, label: '错误' }
      }

      const sampledStates: RuntimeMonitorState[] = ['idle', 'thinking', 'coding', 'validating', 'waiting-input', 'error']
      const samples: Array<{ mode: string | null; pct: number | undefined; state: string | null }> = []
      for (let round = 0; round < 10; round += 1) {
        for (const state of sampledStates) {
          await driveAIProgressProbe(electronApp, { pid: probeProcess.pid, settleMs: 25, states: [state] })
          await expect.poll(async () => (await readCardSnapshot()).state, { timeout: 5000 }).toBe(state)
          const contract = expected[state]
          const stateSnapshot = await readCardSnapshot()
          expect(stateSnapshot.mode).toBe(contract.mode)
          expect(stateSnapshot.text).toContain(contract.label)
          if (state === 'idle') {
            expect(stateSnapshot.barDisplay).toBe('none')
            expect(parseProgressPct(stateSnapshot.pct)).toBeUndefined()
          }
          if (state === 'thinking') {
            expect(stateSnapshot.ariaValueNow).toBeNull()
            expect(parseProgressPct(stateSnapshot.pct)).toBeUndefined()
          }
          if (state === 'coding') {
            const pct = parseProgressPct(stateSnapshot.pct)
            expect(pct).toBeGreaterThanOrEqual(40)
            expect(pct).toBeLessThanOrEqual(75)
          }
          if (contract.pct !== undefined) {
            expect(parseProgressPct(stateSnapshot.pct)).toBe(contract.pct)
          }

          for (let i = 0; i < 17; i += 1) {
            const snapshot = await readCardSnapshot()
            samples.push({
              mode: snapshot.mode,
              pct: parseProgressPct(snapshot.pct),
              state: snapshot.state
            })
            await window.waitForTimeout(5)
          }
        }
      }

      expect(samples.length).toBeGreaterThanOrEqual(1000)
      for (const sample of samples) {
        expect(sample.state === 'idle' && sample.mode !== 'hidden').toBe(false)
        expect(sample.state === 'idle' && sample.pct !== undefined).toBe(false)
        expect(sample.state === 'completed' && sample.pct !== 100).toBe(false)
        expect(sample.state === 'thinking' && sample.mode === 'determinate').toBe(false)
      }

      await card.getByRole('button', { name: /Timeline/ }).click()
      const timeline = card.getByTestId('ai-progress-timeline')
      await expect(timeline).toBeVisible()
      await expect.poll(async () => timeline.getAttribute('data-timeline-states'), { timeout: 5000 })
        .toContain('waiting-input')
      const timelineStates = (await timeline.getAttribute('data-timeline-states')) ?? ''
      for (const state of sampledStates) {
        expect(timelineStates).toContain(state)
      }
      await expect(timeline).toContainText('确认中')
      await expect(timeline).toContainText('等待输入')

      await driveAIProgressProbe(electronApp, { pid: probeProcess.pid, settleMs: 50, states: ['coding'] })
      await expect.poll(async () => parseProgressPct((await readCardSnapshot()).pct), { timeout: 5000 })
        .toBeGreaterThanOrEqual(40)
      const beforeComplete = await readCardSnapshot()
      const beforeCompletePct = parseProgressPct(beforeComplete.pct)
      expect(beforeComplete.state).toBe('coding')
      expect(beforeCompletePct).toBeGreaterThanOrEqual(40)
      expect(beforeCompletePct).toBeLessThanOrEqual(75)

      await driveAIProgressProbe(electronApp, {
        finalizeCompletedAfterMs: 900,
        pid: probeProcess.pid,
        settleMs: 50,
        states: ['completed']
      })
      const completedSnapshot = await readCardSnapshot()
      expect(completedSnapshot.state).toBe('completed')
      expect(parseProgressPct(completedSnapshot.pct)).toBe(100)
      expect(completedSnapshot.text).toContain('已完成')

      await expect.poll(async () => {
        const tasks = await window.evaluate(async () => window.devhub.aiTask.getAll())
        return tasks.some((task) => task.id === taskId)
      }, {
        message: '等待完成任务通过真实 task-completed IPC 折叠到 history',
        timeout: 5000
      }).toBe(false)

      const historyHit = await window.evaluate(async (id) => {
        const history = await window.devhub.aiTask.getHistory(10)
        return history.find((entry) => entry.id === id) ?? null
      }, taskId)
      expect(historyHit).toMatchObject({ id: taskId, status: 'completed' })
    } finally {
      stopRealAIProgressProbe(probeProcess)
      await closeElectronApp(electronApp)
    }
  })

  test('P4.2-c-1 窗口分组可对真实窗口完成 CRUD 与运行时解析', async () => {
    test.setTimeout(120_000)
    const unique = Date.now()
    const titles = [
      'DevHub P4 Group Window A ' + unique,
      'DevHub P4 Group Window B ' + unique
    ]
    const groupName = 'E2E AI 工作组 ' + unique
    const renamedGroupName = 'E2E 前端组 ' + unique
    const { electronApp, window } = await launchApp()
    const probeWindowIds: number[] = []
    let groupId: string | null = null

    try {
      for (const title of titles) {
        probeWindowIds.push(await createRealBrowserWindowWithTitle(electronApp, title))
      }
      await dismissAutoDiscoveryIfPresent(window)

      let targets: Array<{ hwnd: number; title: string }> = []
      await expect.poll(async () => {
        const rows = await window.evaluate(async (titles) => {
          const result = await window.devhub.windowManager.scan(false)
          return titles
            .map((title) => result.data?.find((row) => row.title === title) ?? null)
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
            .map((row) => ({ hwnd: row.hwnd, title: row.title }))
        }, titles)
        targets = rows
        return rows.length
      }, {
        message: '等待真实分组目标窗口进入 WindowManager 扫描结果',
        timeout: 15000
      }).toBe(titles.length)

      const hwnds = targets.map((target) => target.hwnd)
      const report = await window.evaluate(async ({ groupName, hwnds, renamedGroupName, titles }) => {
        const created = await window.devhub.windowManager.createGroup(groupName, hwnds)
        const listedAfterCreate = await window.devhub.windowManager.getGroups()
        const createdFromList = listedAfterCreate.find((group) => group.id === created.id) ?? null
        const rename = await window.devhub.windowManager.renameGroup?.(created.id, renamedGroupName)
        const listedAfterRename = await window.devhub.windowManager.getGroups()
        const renamed = listedAfterRename.find((group) => group.id === created.id) ?? null
        const removed = await window.devhub.windowManager.removeGroup(created.id)
        const listedAfterRemove = await window.devhub.windowManager.getGroups()
        const scanAfterRemove = await window.devhub.windowManager.scan(false)
        const windowsStillLive = titles.every((title) => scanAfterRemove.data?.some((row) => row.title === title))
        return {
          created,
          createdFromList,
          rename,
          renamed,
          removed,
          remaining: listedAfterRemove.some((group) => group.id === created.id),
          windowsStillLive
        }
      }, { groupName, hwnds, renamedGroupName, titles })
      groupId = report.created.id

      expect(report.created.id).toMatch(/^group_/)
      expect(report.created.name).toBe(groupName)
      expect(report.created.windows.map((item) => item.hwnd).sort()).toEqual([...hwnds].sort())
      expect(report.created.memberFingerprints?.length).toBe(hwnds.length)
      expect(report.created.resolvedMembership?.map((item) => item.hwnd).sort()).toEqual([...hwnds].sort())
      expect(report.created.resolutionReport?.matched.length).toBe(hwnds.length)
      expect(report.createdFromList?.memberFingerprints?.length).toBe(hwnds.length)
      expect(report.createdFromList?.resolvedMembership?.length).toBe(hwnds.length)
      expect(report.rename?.success).toBe(true)
      expect(report.renamed?.name).toBe(renamedGroupName)
      expect(report.removed).toBe(true)
      expect(report.remaining).toBe(false)
      expect(report.windowsStillLive).toBe(true)
      groupId = null
    } finally {
      if (groupId) {
        await window.evaluate(async (groupId) => window.devhub.windowManager.removeGroup(groupId), groupId).catch(() => undefined)
      }
      for (const id of probeWindowIds) {
        await closeRealBrowserWindowById(electronApp, id)
      }
      await closeElectronApp(electronApp)
    }
  })

  test('X3 审计日志记录真实窗口敏感操作成功与失败结果', async () => {
    test.setTimeout(90_000)
    const originalTitle = ('DevHub X3 Audit Window ' + Date.now()).trim()
    const nextTitle = ('DevHub X3 Audit Renamed ' + Date.now()).trim()
    const { electronApp, window } = await launchApp()
    let probeWindowId: number | null = null
    let targetHwnd = 0

    try {
      probeWindowId = await createRealBrowserWindowWithTitle(electronApp, originalTitle)
      await dismissAutoDiscoveryIfPresent(window)

      await expect.poll(async () => {
        const match = await window.evaluate(async (title) => {
          const result = await window.devhub.windowManager.scan(false)
          const item = result.data?.find((row) => row.title === title)
          return item ? { hwnd: item.hwnd, title: item.title } : null
        }, originalTitle)
        targetHwnd = match?.hwnd ?? 0
        return targetHwnd
      }, {
        message: '等待真实审计目标窗口进入 WindowManager 扫描结果',
        timeout: 15000
      }).toBeGreaterThan(0)

      const beforeEntries = await readSecurityAuditEntries(electronApp)
      const beforeCount = beforeEntries.length

      const successResult = await window.evaluate(async ({ hwnd, title }) => {
        return window.devhub.windowManager.setTitle(hwnd, title)
      }, { hwnd: targetHwnd, title: nextTitle })
      expect(successResult.success).toBe(true)

      const failureResult = await window.evaluate(async (hwnd) => {
        return window.devhub.windowManager.setTitle(hwnd, '')
      }, targetHwnd)
      expect(failureResult.success).toBe(false)

      await expect.poll(async () => {
        const entries = (await readSecurityAuditEntries(electronApp)).slice(beforeCount)
        const successEntry = entries.find((entry) =>
          entry.op === 'window:set-title'
          && entry.result === 'success'
          && Number(entry.target.hwnd) === targetHwnd
          && entry.target.newTitlePreview === nextTitle
        )
        const failureEntry = entries.find((entry) =>
          entry.op === 'window:set-title'
          && entry.result === 'error'
          && Number(entry.target.hwnd) === targetHwnd
          && typeof entry.reason === 'string'
          && entry.reason.includes('Validation error')
        )
        const shapeOk = [successEntry, failureEntry].every((entry) => Boolean(
          entry
          && typeof entry.timestamp === 'string'
          && Number.isFinite(entry.ts)
          && entry.action === entry.op
          && typeof entry.outcome === 'string'
          && entry.target
        ))
        return {
          failure: Boolean(failureEntry),
          shape: shapeOk,
          success: Boolean(successEntry)
        }
      }, {
        message: '等待 security-audit.log 写入真实窗口 set-title 成功与失败审计记录',
        timeout: 15000
      }).toEqual({ failure: true, shape: true, success: true })
    } finally {
      await closeRealBrowserWindowById(electronApp, probeWindowId)
      await closeElectronApp(electronApp)
    }
  })

  test('P2.2 受限进程详情会降级显示基础信息并保留提权入口', async () => {
    test.setTimeout(60_000)
    const { electronApp, window } = await launchApp()
    try {
      await dismissAutoDiscoveryIfPresent(window)

      await buttonByText(window, '监控').click()
      await expect(buttonByText(window, '进程')).toBeVisible({ timeout: 15000 })

      await expect.poll(async () => {
        const snapshot = await window.evaluate(async () => {
          const current = await window.devhub.scanner.getSnapshot()
          return current?.processes.data.length ?? 0
        })
        return snapshot
      }, {
        message: '等待进程扫描快照进入可用状态',
        timeout: 15000
      }).toBeGreaterThan(0)

      const preferredProcesses = getPreferredSystemProcessDescriptors()
      expect(preferredProcesses.length).toBeGreaterThan(0)
      const searchInput = window.getByPlaceholder('搜索进程... (pid:1234)')
      let matchedCandidate: SystemProcessDescriptor | null = null

      for (const preferredProcess of preferredProcesses) {
        await searchInput.fill(`pid:${preferredProcess.pid}`)

        const row = window.getByTestId(`process-row-${preferredProcess.pid}`)
        await row.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined)
        const rowVisible = await row.isVisible().catch(() => false)
        if (!rowVisible) {
          continue
        }

        await row.hover()

        const detailButton = window.getByTestId(`process-detail-button-${preferredProcess.pid}`)
        await detailButton.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined)
        if (!await detailButton.isVisible().catch(() => false)) {
          continue
        }

        await detailButton.click()

        const detailPanel = window.getByTestId('process-detail-panel')
        await expect(detailPanel).toBeVisible({ timeout: 15000 })
        await window.waitForTimeout(1500)

        const permissionNotice = window.getByTestId('permission-notice')
        const relaunchButton = window.getByRole('button', { name: '以管理员身份重启' })
        await permissionNotice.waitFor({ state: 'visible', timeout: 6000 }).catch(() => undefined)
        await relaunchButton.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined)
        const permissionVisible = await permissionNotice.isVisible().catch(() => false)
        const relaunchVisible = await relaunchButton.isVisible().catch(() => false)

        if (permissionVisible && relaunchVisible) {
          matchedCandidate = preferredProcess
          await expect(detailPanel.getByTestId('detail-field-pid')).toContainText(String(preferredProcess.pid))
          await expect(detailPanel).toContainText(preferredProcess.name)
          await expect(permissionNotice).toBeVisible()
          await expect(relaunchButton).toBeVisible()
          await expect(window.getByTestId('detail-error-only')).toHaveCount(0)
          break
        }

        await window.keyboard.press('Escape')
        await expect(detailPanel).toBeHidden({ timeout: 5000 }).catch(() => {})
      }

      expect(matchedCandidate).not.toBeNull()
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('P3.1-a/b 端口列表滚动条与详情分栏可用真实端口验证', async () => {
    test.setTimeout(90_000)
    const listeners = await listenOnEphemeralPorts(30)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null
    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await resizeMainWindow(electronApp, 1366, 768)
      await window.setViewportSize({ width: 1366, height: 768 })
      await window.waitForTimeout(250)
      await window.evaluate(() => localStorage.removeItem('devhub:port-view-split'))
      await openPortMonitorView(window)

      await expect.poll(async () => {
        return window.evaluate(async () => {
          const ports = await window.devhub.port.scan()
          return ports.length
        })
      }, {
        message: '等待真实端口扫描达到 P3.1-a 的 30 条以上前置条件',
        timeout: 20000
      }).toBeGreaterThanOrEqual(30)

      const scrollContainer = window.getByTestId('port-list-scroll')
      await expect(scrollContainer).toBeVisible({ timeout: 15000 })
      await expect.poll(async () => scrollContainer.evaluate((element) => ({
        clientHeight: element.clientHeight,
        overflowY: window.getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop
      })), {
        message: '等待端口列表真实渲染成可滚动容器',
        timeout: 15000
      }).toMatchObject({ overflowY: 'scroll' })

      const initialScrollMetrics = await scrollContainer.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight
      }))
      expect(initialScrollMetrics.scrollHeight).toBeGreaterThan(initialScrollMetrics.clientHeight)

      await scrollContainer.evaluate((element) => {
        element.scrollTop = 0
      })
      await scrollContainer.hover()
      await window.mouse.wheel(0, 720)
      await expect.poll(async () => scrollContainer.evaluate((element) => element.scrollTop), {
        message: '等待鼠标滚轮真实推动端口列表滚动',
        timeout: 5000
      }).toBeGreaterThan(0)

      await resizeMainWindow(electronApp, 1800, 900)
      await window.setViewportSize({ width: 1800, height: 900 })
      await window.waitForTimeout(250)

      const firstPortCard = window.locator('[data-testid^="port-card-"]').first()
      await expect(firstPortCard).toBeVisible({ timeout: 15000 })
      await firstPortCard.click()

      const focusPanel = window.getByTestId('port-focus-panel')
      await expect(focusPanel).toBeVisible({ timeout: 15000 })
      const splitterRoot = window.locator('[data-splitter-storage-key="devhub:port-view-split"]').filter({ has: focusPanel }).first()
      await expect(splitterRoot).toHaveAttribute('data-panel-mode', 'split')

      const getSplitMetrics = async () => window.evaluate(() => {
        const list = document.querySelector('[data-testid="port-list-scroll"]')
        const focus = document.querySelector('[data-testid="port-focus-panel"]')
        if (!list || !focus) {
          throw new Error('Port split panes are not mounted')
        }
        return {
          focusWidth: focus.getBoundingClientRect().width,
          listWidth: list.getBoundingClientRect().width
        }
      })

      const beforeDrag = await getSplitMetrics()
      expect(beforeDrag.listWidth).toBeGreaterThanOrEqual(640)
      expect(beforeDrag.focusWidth).toBeGreaterThanOrEqual(360)
      expect(beforeDrag.focusWidth).toBeLessThanOrEqual(560)

      const splitterHandle = splitterRoot.getByTestId('panel-splitter-handle-0')
      await expect(splitterHandle).toBeVisible()
      const handleBox = await splitterHandle.boundingBox()
      if (!handleBox) {
        throw new Error('Panel splitter handle has no bounding box')
      }

      await window.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await window.mouse.down()
      await window.mouse.move(handleBox.x - 120, handleBox.y + handleBox.height / 2, { steps: 8 })
      await window.mouse.up()

      const afterDrag = await getSplitMetrics()
      expect(Math.abs(afterDrag.focusWidth - beforeDrag.focusWidth)).toBeGreaterThan(20)
      expect(afterDrag.listWidth).toBeGreaterThanOrEqual(640)
      expect(afterDrag.focusWidth).toBeGreaterThanOrEqual(360)
      expect(afterDrag.focusWidth).toBeLessThanOrEqual(560)

      await splitterHandle.dblclick()
      await expect.poll(async () => {
        const current = await getSplitMetrics()
        return Math.abs(current.focusWidth - beforeDrag.focusWidth) < 16
      }, {
        message: '等待双击 splitter 后恢复默认面板比例',
        timeout: 5000
      }).toBe(true)
    } finally {
      if (electronApp) await closeElectronApp(electronApp).catch(() => undefined)
      await Promise.all(listeners.map(async listener => closeServer(listener.server).catch(() => undefined)))
    }
  })

  test('P3.1-c 端口详情真实超时后显示缓存降级与轻量模式', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()
    try {
      await resizeMainWindow(electronApp, 1366, 768)
      await window.setViewportSize({ width: 1366, height: 768 })
      await window.waitForTimeout(250)
      await window.evaluate(() => localStorage.removeItem('devhub:port-view-split'))
      await dismissAutoDiscoveryIfPresent(window)

      await buttonByText(window, '监控').click()
      await buttonByText(window, '端口').click()
      await expect(window.getByText('端口监控')).toBeVisible({ timeout: 15000 })

      const timeoutCandidate = await window.evaluate(async () => {
        const ports = await window.devhub.port.scan()
        for (const port of ports.slice(0, 24)) {
          const result = await window.devhub.port.getPortDetailIncremental(port.port)
          if (result.source === 'timeout' && result.data) {
            return { pid: port.pid, port: port.port }
          }
        }
        return null
      })

      if (!timeoutCandidate) {
        throw new Error('当前真实端口环境未触发 port detail timeout，不能将 P3.1-c 标记为通过')
      }

      await window.getByPlaceholder('搜索端口...').fill(String(timeoutCandidate.port))
      const portCard = window.locator('[data-port-number="' + timeoutCandidate.port + '"]').first()
      await expect(portCard).toBeVisible({ timeout: 15000 })
      await portCard.click()

      const timeoutBanner = window.getByTestId('port-timeout-banner')
      await expect(timeoutBanner).toBeVisible({ timeout: 7000 })
      await expect(timeoutBanner).toContainText(/查询超时 - 当前显示 [0-9]+ 秒前的缓存数据/)

      await window.getByTestId('port-timeout-retry-button').click()
      await expect(timeoutBanner).toBeVisible({ timeout: 7000 })

      const lightModeToggle = window.getByTestId('port-light-mode-toggle')
      await lightModeToggle.check()
      await expect(lightModeToggle).toBeChecked()
      await expect(timeoutBanner).toContainText('已切换到轻量模式 - 当前仅显示最近一次扫描快照')
    } finally {
      await closeElectronApp(electronApp)
    }
  })


  test('R8.B spec-03 drawer right slot persists across real Electron restart', async () => {
    test.setTimeout(90_000)
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let cleanupWindow: Page | null = null

    try {
      const firstLaunch = await launchApp()
      firstApp = firstLaunch.electronApp
      cleanupWindow = firstLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)

      await cleanupWindow.getByTestId('open-drawer-right').click()
      await expect(cleanupWindow.getByTestId('drawer-right')).toBeVisible({ timeout: 15_000 })

      const firstReport = await cleanupWindow.evaluate(async (): Promise<DrawerRestartReport> => {
        const states = await window.devhub.r8.drawer.getState()
        const rightState = states.find(state => state.slot === 'right')
        if (!rightState) {
          throw new Error('R8.B spec-03 right drawer state was not persisted after UI open')
        }
        return {
          contentId: rightState.contentId,
          open: rightState.open,
          pinned: rightState.pinned,
          size: rightState.size,
          slot: rightState.slot
        }
      })

      expect(firstReport).toMatchObject({
        contentId: 'monitor.port-detail',
        open: true,
        slot: 'right'
      })
      expect(firstReport.pinned).toBe(false)
      expect(firstReport.size).toBeGreaterThanOrEqual(280)

      await closeElectronApp(firstApp)
      firstApp = null
      cleanupWindow = null

      const secondLaunch = await launchApp()
      secondApp = secondLaunch.electronApp
      cleanupWindow = secondLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)

      const secondReport = await cleanupWindow.evaluate(async (): Promise<DrawerRestartReport> => {
        const states = await window.devhub.r8.drawer.getState()
        const rightState = states.find(state => state.slot === 'right')
        if (!rightState) {
          throw new Error('R8.B spec-03 right drawer state was not restored')
        }
        return {
          contentId: rightState.contentId,
          open: rightState.open,
          pinned: rightState.pinned,
          size: rightState.size,
          slot: rightState.slot
        }
      })

      expect(secondReport).toEqual(firstReport)
      const restoredDrawer = cleanupWindow.getByTestId('drawer-right')
      await expect(restoredDrawer).toBeVisible({ timeout: 15_000 })
      await expect(restoredDrawer).toHaveAttribute('data-r8b-drawer-slot', 'right')
    } finally {
      if (cleanupWindow && !cleanupWindow.isClosed()) {
        await cleanupWindow.evaluate(async () => {
          await window.devhub.r8.drawer.setState({
            open: false,
            pinned: false,
            size: 360,
            slot: 'right'
          })
        }).catch(() => undefined)
      }
      if (secondApp) {
        await closeElectronApp(secondApp).catch(() => undefined)
      }
      if (firstApp) {
        await closeElectronApp(firstApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-03 BrowserWindow popout returns to drawer through real manager UI', async () => {
    test.setTimeout(120_000)
    let electronApp: ElectronApplication | null = null
    let window: Page | null = null
    let popoutPage: Page | null = null
    let popoutWindowId: string | null = null
    const titlePrefix = 'R8.B spec-03 drawer return '
    const title = titlePrefix + Date.now()

    try {
      const launch = await launchApp()
      electronApp = launch.electronApp
      window = launch.window
      await dismissAutoDiscoveryIfPresent(window)

      await window.evaluate(async (prefix) => {
        const popouts = await window.devhub.r8.popout.list()
        for (const popout of popouts) {
          if (popout.title.startsWith(prefix) && popout.bridgeState !== 'closed') {
            await window.devhub.r8.popout.close(popout.windowId)
          }
        }
        await window.devhub.r8.drawer.setState({
          open: false,
          pinned: false,
          size: 360,
          slot: 'right'
        })
        await window.devhub.r8.drawer.setState({
          open: false,
          pinned: false,
          size: 320,
          slot: 'floating'
        })
      }, titlePrefix)

      const popoutPagePromise = electronApp.waitForEvent('window', { timeout: 20_000 })
      const created = await window.evaluate(async (request) => {
        return window.devhub.r8.popout.create(request)
      }, {
        surface: 'port',
        targetId: 'monitor.port-detail',
        mode: 'browserwindow',
        route: '/monitor',
        bounds: { x: 80, y: 80, width: 420, height: 320 },
        title
      })
      popoutWindowId = created.windowId
      expect(created.mode).toBe('browserwindow')
      expect(created.bridgeState).toBe('connected')

      popoutPage = await popoutPagePromise
      await popoutPage.waitForLoadState('domcontentloaded')
      await expect.poll(() => popoutPage?.url() ?? '', {
        message: '等待 spec-03 BrowserWindow popout 真实 renderer URL 携带 r8Popout 查询参数',
        timeout: 10_000
      }).toContain(`r8Popout=${encodeURIComponent(popoutWindowId)}`)

      await window.getByTestId('open-drawer-floating').click()
      await expect(window.getByTestId('drawer-floating')).toBeVisible({ timeout: 15_000 })
      await expect(window.getByText(title)).toBeVisible({ timeout: 15_000 })

      const closeObserved = popoutPage.waitForEvent('close', { timeout: 15_000 })
      await window.getByTestId(`popout-return-drawer-${popoutWindowId}`).click()
      await closeObserved
      popoutPage = null

      await expect(window.getByTestId('drawer-right')).toBeVisible({ timeout: 15_000 })
      await expect(window.getByTestId('drawer-right')).toHaveAttribute('data-r8b-drawer-slot', 'right')
      await expect(window.getByTestId('drawer-right').getByRole('heading', { name: '端口详情' })).toBeVisible({ timeout: 15_000 })

      const report = await window.evaluate(async (windowId) => {
        const [rightState, listed] = await Promise.all([
          window.devhub.r8.drawer.getState().then(states => states.find(state => state.slot === 'right') ?? null),
          window.devhub.r8.popout.list().then(popouts => popouts.find(popout => popout.windowId === windowId) ?? null)
        ])
        return {
          rightContentId: rightState?.contentId ?? null,
          rightOpen: rightState?.open ?? false,
          popoutBridgeState: listed?.bridgeState ?? null
        }
      }, popoutWindowId)

      expect(report).toEqual({
        rightContentId: 'monitor.port-detail',
        rightOpen: true,
        popoutBridgeState: 'closed'
      })
      popoutWindowId = null
    } finally {
      if (window && !window.isClosed()) {
        await window.evaluate(async (windowId) => {
          if (windowId) await window.devhub.r8.popout.close(windowId).catch(() => undefined)
          await window.devhub.r8.drawer.setState({
            open: false,
            pinned: false,
            size: 360,
            slot: 'right'
          }).catch(() => undefined)
          await window.devhub.r8.drawer.setState({
            open: false,
            pinned: false,
            size: 320,
            slot: 'floating'
          }).catch(() => undefined)
        }, popoutWindowId).catch(() => undefined)
      }
      if (popoutPage && !popoutPage.isClosed()) {
        await popoutPage.close().catch(() => undefined)
      }
      if (electronApp) {
        await closeElectronApp(electronApp).catch(() => undefined)
      }
    }
  })


  test('R8.B spec-05 dashboard default layout persists across real Electron restart', async () => {
    test.setTimeout(90_000)
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let cleanupWindow: Page | null = null

    try {
      const firstLaunch = await launchApp()
      firstApp = firstLaunch.electronApp
      cleanupWindow = firstLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)

      const firstReport = await cleanupWindow.evaluate(async (): Promise<DashboardRestartReport> => {
        const response = await window.devhub.r8.dashboard.reset('default', 'e2e-spec05-prep')
        const [firstItem] = response.layout.layouts.md
        if (!firstItem) {
          throw new Error('R8.B spec-05 expected at least one dashboard widget in default layout')
        }
        const resizedItem = { ...firstItem, h: firstItem.h + 1 }
        const nextLayout = {
          ...response.layout,
          layouts: Object.fromEntries(
            Object.entries(response.layout.layouts).map(([breakpoint, items]) => [
              breakpoint,
              items.map(item => item.i === resizedItem.i ? { ...item, h: item.h + 1 } : item)
            ])
          ) as typeof response.layout.layouts
        }
        const saved = await window.devhub.r8.dashboard.saveLayout(nextLayout)
        return {
          itemId: resizedItem.i,
          savedH: saved.layout.layouts.md.find(item => item.i === resizedItem.i)?.h ?? -1,
          widgetCount: saved.layout.layouts.md.length
        }
      })

      expect(firstReport.widgetCount).toBeGreaterThanOrEqual(6)
      expect(firstReport.savedH).toBeGreaterThanOrEqual(4)

      await cleanupWindow.getByTestId('nav-dashboard').click()
      await expect(cleanupWindow.getByTestId('dashboard-page')).toBeVisible({ timeout: 15_000 })
      await expect(cleanupWindow.getByTestId(`dashboard-grid-item-${firstReport.itemId}`)).toBeVisible({ timeout: 15_000 })

      await closeElectronApp(firstApp)
      firstApp = null
      cleanupWindow = null

      const secondLaunch = await launchApp()
      secondApp = secondLaunch.electronApp
      cleanupWindow = secondLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)

      const secondReport = await cleanupWindow.evaluate(async (itemId): Promise<DashboardRestartReport> => {
        const response = await window.devhub.r8.dashboard.getLayout('default')
        const restoredItem = response.layout.layouts.md.find(item => item.i === itemId)
        if (!restoredItem) {
          throw new Error(`R8.B spec-05 persisted widget ${itemId} was not restored`)
        }
        return {
          itemId,
          savedH: restoredItem.h,
          widgetCount: response.layout.layouts.md.length
        }
      }, firstReport.itemId)

      expect(secondReport.widgetCount).toBe(firstReport.widgetCount)
      expect(secondReport.savedH).toBe(firstReport.savedH)

      await cleanupWindow.getByTestId('nav-dashboard').click()
      await expect(cleanupWindow.getByTestId('dashboard-page')).toBeVisible({ timeout: 15_000 })
      await expect(cleanupWindow.getByTestId(`dashboard-grid-item-${firstReport.itemId}`)).toBeVisible({ timeout: 15_000 })
    } finally {
      if (cleanupWindow && !cleanupWindow.isClosed()) {
        await cleanupWindow.evaluate(async () => {
          await window.devhub.r8.dashboard.reset('default', 'e2e-spec05-cleanup')
        }).catch(() => undefined)
      }
      if (secondApp) {
        await closeElectronApp(secondApp).catch(() => undefined)
      }
      if (firstApp) {
        await closeElectronApp(firstApp).catch(() => undefined)
      }
    }
  })

  test('R8.B spec-05 dashboard config editor and feature flag disable use real IPC', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()

    try {
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate(async () => {
        await window.devhub.r8.integrations.setFlag('R8.B.dashboard.grid', true, 'e2e-spec05-prep')
        await window.devhub.r8.dashboard.reset('default', 'e2e-spec05-prep')
      })

      await window.getByTestId('nav-dashboard').click()
      await expect(window.getByTestId('dashboard-page')).toBeVisible({ timeout: 15_000 })
      await window.getByTestId('widget-configure-widget-process-summary').click()
      await expect(window.getByTestId('dashboard-widget-config-editor')).toBeVisible({ timeout: 15_000 })
      await window.getByTestId('dashboard-config-maxRows').fill('6')
      await window.getByTestId('dashboard-config-save').click()

      await expect.poll(async () => {
        return window.evaluate(async () => {
          const response = await window.devhub.r8.dashboard.getLayout('default')
          return response.layout.layouts.md.find(item => item.i === 'widget-process-summary')?.config?.maxRows ?? null
        })
      }, {
        message: 'dashboard widget config persists through dashboard:save-layout',
        timeout: 10_000
      }).toBe(6)

      await window.getByTestId('dashboard-feature-disable').click()
      await expect(window.getByTestId('dashboard-disabled-page')).toBeVisible({ timeout: 15_000 })
      await expect.poll(async () => {
        return window.evaluate(() => window.devhub.r8.integrations.getFlag('R8.B.dashboard.grid'))
      }, {
        message: 'dashboard feature flag disabled through integrations bridge',
        timeout: 10_000
      }).toBe(false)

      await window.getByTestId('dashboard-feature-enable').click()
      await expect(window.getByTestId('dashboard-page')).toBeVisible({ timeout: 15_000 })
    } finally {
      if (!window.isClosed()) {
        await window.evaluate(async () => {
          await window.devhub.r8.integrations.setFlag('R8.B.dashboard.grid', true, 'e2e-spec05-cleanup')
          await window.devhub.r8.dashboard.reset('default', 'e2e-spec05-cleanup')
        }).catch(() => undefined)
      }
      await closeElectronApp(electronApp).catch(() => undefined)
    }
  })


  test('R8.B spec-06 process treemap renders real process scan with d3 layout', async () => {
    test.setTimeout(90_000)
    const { electronApp, window } = await launchApp()

    try {
      await resizeMainWindow(electronApp, 1440, 900)
      await window.setViewportSize({ width: 1440, height: 900 })
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate(() => {
        window.localStorage.removeItem('devhub:process-view-mode')
      })

      await buttonByText(window, '监控').click()
      await expect(buttonByText(window, '进程')).toBeVisible({ timeout: 15_000 })
      await buttonByText(window, '进程').click()
      await window.getByPlaceholder('搜索进程... (pid:1234)').fill('')
      await window.locator('button[title="刷新"]').click()

      await expect.poll(async () => {
        return window.evaluate(async () => {
          const result = await window.devhub.systemProcess.scan()
          return result?.data.length ?? 0
        })
      }, {
        message: '等待 spec-06 真实进程扫描快照可用',
        timeout: 20_000
      }).toBeGreaterThan(0)

      await window.locator('[data-view-mode="treemap"]').click()
      const treemap = window.getByTestId('process-treemap')
      await expect(treemap).toBeVisible({ timeout: 15_000 })
      await treemap.locator('select').first().selectOption('exe')
      await treemap.locator('select').nth(1).selectOption('rss')

      await expect.poll(async () => window.locator('[data-testid^="treemap-tile-"]').count(), {
        message: '等待真实进程 Treemap SVG tile 渲染',
        timeout: 20_000
      }).toBeGreaterThan(0)

      const report = await window.evaluate(async (): Promise<ProcessTreemapE2EReport> => {
        const root = document.querySelector('[data-testid="process-treemap"]')
        if (!root) {
          throw new Error('process-treemap root is not mounted')
        }

        const svg = root.querySelector('svg')
        if (!svg) {
          throw new Error('process-treemap svg is not mounted')
        }

        const labelMatch = (root.textContent ?? '').match(/RSS proportional tiles:\s*(\d+)\s*\/\s*(\d+)/)
        if (!labelMatch) {
          throw new Error('process-treemap count label is missing')
        }

        const tiles = Array.from(root.querySelectorAll('[data-testid^="treemap-tile-"]'))
        const visibleTile = tiles.find((tile) => {
          const rect = tile.querySelector('rect')
          if (!rect) return false
          const width = Number(rect.getAttribute('width') ?? '0')
          const height = Number(rect.getAttribute('height') ?? '0')
          return width > 0 && height > 0
        })

        if (!visibleTile) {
          throw new Error('process-treemap rendered no visible process tile')
        }

        const rect = visibleTile.querySelector('rect')
        if (!rect) {
          throw new Error('process-treemap visible tile has no rect')
        }

        const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? []
        const testId = visibleTile.getAttribute('data-testid') ?? ''
        const tilePid = Number(testId.replace('treemap-tile-', ''))
        const scanResult = await window.devhub.systemProcess.scan()

        return {
          containerHeight: root.getBoundingClientRect().height,
          containerWidth: root.getBoundingClientRect().width,
          labelProcessCount: Number(labelMatch[2]),
          labelTileCount: Number(labelMatch[1]),
          persistedMode: window.localStorage.getItem('devhub:process-view-mode'),
          scanProcessCount: scanResult?.data.length ?? 0,
          tileCount: tiles.length,
          tileHeight: Number(rect.getAttribute('height') ?? '0'),
          tilePid,
          tileWidth: Number(rect.getAttribute('width') ?? '0'),
          viewBoxHeight: viewBox[3] ?? 0,
          viewBoxWidth: viewBox[2] ?? 0
        }
      })

      expect(report.scanProcessCount).toBeGreaterThan(0)
      expect(report.labelProcessCount).toBeGreaterThan(0)
      expect(report.labelTileCount).toBeGreaterThan(0)
      expect(report.tileCount).toBeGreaterThan(0)
      expect(report.tileCount).toBeLessThanOrEqual(500)
      expect(report.tilePid).toBeGreaterThan(0)
      expect(report.tileWidth).toBeGreaterThan(0)
      expect(report.tileHeight).toBeGreaterThan(0)
      expect(report.containerWidth).toBeGreaterThan(320)
      expect(report.containerHeight).toBeGreaterThan(240)
      expect(report.viewBoxWidth).toBeGreaterThan(0)
      expect(report.viewBoxHeight).toBeGreaterThan(0)
      expect(report.persistedMode).toBe('treemap')
    } finally {
      await closeElectronApp(electronApp)
    }
  })


  test('R8.B spec-13 port security blocklist persists across real Electron restart', async () => {
    test.setTimeout(120_000)
    const listener = await listenOnEphemeralPort()
    const reason = `e2e-spec13-${Date.now()}`
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let cleanupWindow: Page | null = null

    try {
      const firstLaunch = await launchApp()
      firstApp = firstLaunch.electronApp
      cleanupWindow = firstLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)
      await cleanupWindow.evaluate(async () => {
        await window.devhub.r8.portSecurity.resetBlocklist('e2e-spec13-prep')
      })
      const createdEntry = await cleanupWindow.evaluate(async ({ port, reason }) => {
        return window.devhub.r8.portSecurity.addBlocklist({
          confirmedBy: 'e2e-spec13',
          port,
          reason
        })
      }, { port: listener.port, reason })
      expect(createdEntry.port).toBe(listener.port)
      expect(createdEntry.reason).toBe(reason)
      expect(createdEntry.source).toBe('user')

      const firstReport = await cleanupWindow.evaluate(async (port): Promise<PortSecurityRestartReport> => {
        const entries = await window.devhub.r8.portSecurity.listBlocklist()
        const tier = await window.devhub.r8.portSecurity.classify(port, '127.0.0.1')
        return {
          defaultCount: entries.filter(entry => entry.source === 'default').length,
          reasons: tier.reasons,
          tier: tier.tier,
          userEntryCount: entries.filter(entry => entry.source === 'user' && entry.port === port).length
        }
      }, listener.port)

      expect(firstReport.defaultCount).toBeGreaterThanOrEqual(30)
      expect(firstReport.userEntryCount).toBe(1)
      expect(firstReport.tier).toBe('Suspicious')
      expect(firstReport.reasons).toContain('user-blocklist')

      await closeElectronApp(firstApp)
      firstApp = null
      cleanupWindow = null

      const secondLaunch = await launchApp()
      secondApp = secondLaunch.electronApp
      cleanupWindow = secondLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)

      const secondReport = await cleanupWindow.evaluate(async (port): Promise<PortSecurityRestartReport> => {
        const entries = await window.devhub.r8.portSecurity.listBlocklist()
        const tier = await window.devhub.r8.portSecurity.classify(port, '127.0.0.1')
        return {
          defaultCount: entries.filter(entry => entry.source === 'default').length,
          reasons: tier.reasons,
          tier: tier.tier,
          userEntryCount: entries.filter(entry => entry.source === 'user' && entry.port === port).length
        }
      }, listener.port)

      expect(secondReport.defaultCount).toBeGreaterThanOrEqual(30)
      expect(secondReport.userEntryCount).toBe(1)
      expect(secondReport.tier).toBe('Suspicious')
      expect(secondReport.reasons).toContain('user-blocklist')

      await expect.poll(async () => {
        return cleanupWindow?.evaluate(async (port) => {
          const ports = await window.devhub.port.scan()
          return ports.some(item => item.port === port && item.state === 'LISTENING')
        }, listener.port) ?? false
      }, {
        message: '等待 spec-13 真实监听端口进入端口扫描结果',
        timeout: 20_000
      }).toBe(true)

      await buttonByText(cleanupWindow, '监控').click()
      await buttonByText(cleanupWindow, '端口').click()
      await expect(cleanupWindow.getByText('端口监控')).toBeVisible({ timeout: 15_000 })
      await cleanupWindow.getByPlaceholder('搜索端口...').fill(String(listener.port))

      const portCard = cleanupWindow.locator(`[data-port-number="${listener.port}"]`).first()
      await expect(portCard).toBeVisible({ timeout: 15_000 })
      await expect(portCard.getByTestId('security-tier-Suspicious')).toBeVisible()
      await expect(cleanupWindow.getByTestId('public-port-banner')).toContainText('可疑端口')
    } finally {
      if (cleanupWindow && !cleanupWindow.isClosed()) {
        await cleanupWindow.evaluate(async () => {
          await window.devhub.r8.portSecurity.resetBlocklist('e2e-spec13-cleanup')
        }).catch(() => undefined)
      }
      if (secondApp) {
        await closeElectronApp(secondApp).catch(() => undefined)
      }
      if (firstApp) {
        await closeElectronApp(firstApp).catch(() => undefined)
      }
      await closeServer(listener.server)
    }
  })

  test('R8.B spec-14 process tag persists across real Electron restart', async () => {
    test.setTimeout(120_000)
    const label = `r8-spec14-${Date.now()}`
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let cleanupWindow: Page | null = null
    let cleanupReport: ProcessTagRestartReport | null = null

    const restoreTag = async (page: Page, report: ProcessTagRestartReport): Promise<void> => {
      await page.evaluate(async ({ cwd, exe, originalTag }) => {
        const processIdentity = { exe, cwd: cwd ?? undefined }
        if (originalTag) {
          await window.devhub.systemProcess.setProcessTag({
            ...processIdentity,
            color: originalTag.color,
            pinned: originalTag.pinned,
            tag: originalTag.tag
          })
          return
        }
        await window.devhub.systemProcess.removeProcessTag(processIdentity)
      }, report)
    }

    try {
      const firstLaunch = await launchApp()
      firstApp = firstLaunch.electronApp
      cleanupWindow = firstLaunch.window
      await resizeMainWindow(firstApp, 1440, 900)
      await cleanupWindow.setViewportSize({ width: 1440, height: 900 })
      await dismissAutoDiscoveryIfPresent(cleanupWindow)
      const firstMainPid = await firstApp.evaluate(() => process.pid)

      const firstReport = await cleanupWindow.evaluate(async ({ label, mainPid }): Promise<ProcessTagRestartReport> => {
        type RuntimeProcessTag = {
          color?: ProcessTagE2EColor
          cwd?: string
          exe: string
          key: string
          pinned: boolean
          tag: string
        }
        const unwrapData = (value: unknown): unknown => {
          return typeof value === 'object' && value !== null && 'data' in value
            ? (value as { data?: unknown }).data
            : value
        }
        const normalizeTags = (value: unknown): RuntimeProcessTag[] => {
          const unwrapped = unwrapData(value)
          const payload = typeof unwrapped === 'object' && unwrapped !== null && 'tags' in unwrapped
            ? (unwrapped as { tags?: unknown }).tags
            : unwrapped
          if (!Array.isArray(payload)) return []
          return payload.filter((item): item is RuntimeProcessTag => {
            return typeof item === 'object'
              && item !== null
              && 'exe' in item
              && 'key' in item
              && 'tag' in item
              && typeof (item as { exe?: unknown }).exe === 'string'
              && typeof (item as { key?: unknown }).key === 'string'
              && typeof (item as { tag?: unknown }).tag === 'string'
          })
        }
        const scanResult = await window.devhub.systemProcess.scan()
        const processes = scanResult.data ?? []
        const target = processes.find(process => process.pid === mainPid) ?? processes.find(process => process.pid > 0 && process.name.trim().length > 0)
        if (!target) {
          throw new Error('R8.B spec-14 could not find a real process identity to tag')
        }

        const currentTags = await window.devhub.systemProcess.listProcessTags()
        const original = normalizeTags(currentTags).find(tag => tag.exe === target.name && (tag.cwd ?? null) === (target.workingDir ?? null)) ?? null
        await window.devhub.systemProcess.setProcessTag({
          exe: target.name,
          cwd: target.workingDir,
          color: 'accent',
          pinned: true,
          tag: label
        })
        const saved = normalizeTags(await window.devhub.systemProcess.listProcessTags())
          .find(tag => tag.exe === target.name && (tag.cwd ?? null) === (target.workingDir ?? null) && tag.tag === label)
        if (!saved) {
          throw new Error('R8.B spec-14 process tag write was not visible through listProcessTags')
        }
        const history = await window.devhub.systemProcess.getProcessHistory24h({ exe: target.name, cwd: target.workingDir })
        const historyPayload = typeof history === 'object' && history !== null ? history as { points?: unknown; windowMs?: unknown } : {}
        const historyPoints = Array.isArray(historyPayload.points) ? historyPayload.points.length : 0
        const historyWindowMs = typeof historyPayload.windowMs === 'number' ? historyPayload.windowMs : 86_400_000
        const exported = await window.devhub.systemProcess.exportProcessTags()

        return {
          cwd: saved.cwd ?? null,
          exe: saved.exe,
          exportContainsLabel: exported.json.includes(label),
          historyPointCount: historyPoints,
          historyWindowMs,
          key: saved.key,
          originalTag: original ? { color: original.color, pinned: original.pinned, tag: original.tag } : null,
          pid: target.pid,
          pinned: saved.pinned,
          scanCount: processes.length,
          tag: saved.tag
        }
      }, { label, mainPid: firstMainPid })
      cleanupReport = firstReport

      expect(firstReport.scanCount).toBeGreaterThan(0)
      expect(firstReport.tag).toBe(label)
      expect(firstReport.pinned).toBe(true)
      expect(firstReport.exportContainsLabel).toBe(true)
      expect(firstReport.historyWindowMs).toBe(86_400_000)
      expect(firstReport.historyPointCount).toBeGreaterThanOrEqual(0)

      await cleanupWindow.evaluate(() => {
        window.localStorage.setItem('devhub:process-view-mode', 'list')
      })
      await buttonByText(cleanupWindow, '监控').click()
      await expect(buttonByText(cleanupWindow, '进程')).toBeVisible({ timeout: 15_000 })
      await buttonByText(cleanupWindow, '进程').click()
      await cleanupWindow.getByPlaceholder('搜索进程... (pid:1234)').fill(`pid:${firstReport.pid}`)
      await cleanupWindow.locator('button[title="刷新"]').click()
      await expect(cleanupWindow.getByTestId(`process-row-${firstReport.pid}`)).toBeVisible({ timeout: 20_000 })
      await expect(cleanupWindow.getByTestId(`process-tag-${firstReport.key}`)).toContainText(label, { timeout: 20_000 })

      await closeElectronApp(firstApp)
      firstApp = null
      cleanupWindow = null

      const secondLaunch = await launchApp()
      secondApp = secondLaunch.electronApp
      cleanupWindow = secondLaunch.window
      await dismissAutoDiscoveryIfPresent(cleanupWindow)

      const secondReport = await cleanupWindow.evaluate(async ({ cwd, exe, key, label }): Promise<Pick<ProcessTagRestartReport, 'exportContainsLabel' | 'key' | 'pinned' | 'tag'>> => {
        type RuntimeProcessTag = {
          cwd?: string
          exe: string
          key: string
          pinned: boolean
          tag: string
        }
        const unwrapData = (value: unknown): unknown => {
          return typeof value === 'object' && value !== null && 'data' in value
            ? (value as { data?: unknown }).data
            : value
        }
        const normalizeTags = (value: unknown): RuntimeProcessTag[] => {
          const unwrapped = unwrapData(value)
          const payload = typeof unwrapped === 'object' && unwrapped !== null && 'tags' in unwrapped
            ? (unwrapped as { tags?: unknown }).tags
            : unwrapped
          if (!Array.isArray(payload)) return []
          return payload.filter((item): item is RuntimeProcessTag => {
            return typeof item === 'object'
              && item !== null
              && 'exe' in item
              && 'key' in item
              && 'tag' in item
              && typeof (item as { exe?: unknown }).exe === 'string'
              && typeof (item as { key?: unknown }).key === 'string'
              && typeof (item as { tag?: unknown }).tag === 'string'
          })
        }
        const tags = await window.devhub.systemProcess.listProcessTags()
        const restored = normalizeTags(tags).find(tag => tag.key === key && tag.exe === exe && (tag.cwd ?? null) === cwd)
        if (!restored) {
          throw new Error('R8.B spec-14 persisted process tag was not restored after restart')
        }
        const exported = await window.devhub.systemProcess.exportProcessTags()
        return {
          exportContainsLabel: exported.json.includes(label),
          key: restored.key,
          pinned: restored.pinned,
          tag: restored.tag
        }
      }, {
        cwd: firstReport.cwd,
        exe: firstReport.exe,
        key: firstReport.key,
        label
      })

      expect(secondReport.key).toBe(firstReport.key)
      expect(secondReport.tag).toBe(label)
      expect(secondReport.pinned).toBe(true)
      expect(secondReport.exportContainsLabel).toBe(true)
    } finally {
      if (cleanupWindow && !cleanupWindow.isClosed() && cleanupReport) {
        await restoreTag(cleanupWindow, cleanupReport).catch(() => undefined)
      }
      if (secondApp) {
        await closeElectronApp(secondApp).catch(() => undefined)
      }
      if (firstApp) {
        await closeElectronApp(firstApp).catch(() => undefined)
      }
    }
  })


  test('R8.C spec-26 attached flow covers 30min 24h filter export and realtime IPC', async () => {
    test.setTimeout(60_000)
    const { electronApp, window } = await launchApp()
    const sessionId = `e2e-flow-${Date.now()}`

    try {
      await dismissAutoDiscoveryIfPresent(window)
      const report = await window.evaluate(async (runtimeSessionId): Promise<AttachedFlowE2EReport> => {
        const defaultSnapshot = await window.devhub.r8.topology.attachedFlow({ scope: 'runtime' })
        const window24h = await window.devhub.r8.topology.attachedFlow({ scope: 'runtime', windowMs: 86_400_000 })
        const exported = await window.devhub.r8.topology.exportFlow({ scope: 'runtime', format: 'mermaid-sequence' })
        const streamPayloads: Array<{ appendedNodeIds: string[]; appendedTaskIds: Array<string | null>; reason: string }> = []
        const unsubscribe = window.devhub.r8.topology.subscribeFlowEvents((payload) => {
          streamPayloads.push({
            appendedNodeIds: payload.appendedNodes.map((node) => node.id),
            appendedTaskIds: payload.appendedNodes.map((node) => node.taskId),
            reason: payload.reason
          })
        }, { subscriberId: runtimeSessionId, request: { scope: 'runtime' }, intervalMs: 500 })
        let appendStartedAt = performance.now()

        try {
          await new Promise<void>((resolve, reject) => {
            const deadline = performance.now() + 10_000
            const timer = window.setInterval(() => {
              if (streamPayloads.some((payload) => payload.reason === 'initial')) {
                window.clearInterval(timer)
                resolve()
                return
              }
              if (performance.now() > deadline) {
                window.clearInterval(timer)
                reject(new Error('Timed out waiting for initial flow:event-stream payload'))
              }
            }, 100)
          })
          appendStartedAt = performance.now()
          await window.devhub.r8.csv.enqueueRow({
            id: `${runtimeSessionId}-failed`,
            group: runtimeSessionId,
            tool: 'codex',
            prompt: 'R8.C spec-26 e2e realtime flow failure',
            retries: 0
          })
          await new Promise<void>((resolve, reject) => {
            const deadline = performance.now() + 10_000
            const timer = window.setInterval(async () => {
              const tasks = await window.devhub.r8.task.list(runtimeSessionId)
              if (tasks.some((task) => task.status === 'failed' || task.status === 'queued')) {
                window.clearInterval(timer)
                resolve()
                return
              }
              if (performance.now() > deadline) {
                window.clearInterval(timer)
                reject(new Error('Timed out waiting for real queued task to enter attached flow source state'))
              }
            }, 250)
          })
          await new Promise<void>((resolve, reject) => {
            const deadline = performance.now() + 10_000
            const timer = window.setInterval(() => {
              if (streamPayloads.some((payload) => payload.appendedTaskIds.includes(`${runtimeSessionId}-failed`))) {
                window.clearInterval(timer)
                resolve()
                return
              }
              if (performance.now() > deadline) {
                window.clearInterval(timer)
                reject(new Error('Timed out waiting for flow:event-stream append payload'))
              }
            }, 250)
          })
        } finally {
          unsubscribe()
        }

        const filtered = await window.devhub.r8.topology.attachedFlow({
          scope: 'runtime',
          windowMs: 1_800_000,
          filter: { kinds: ['task-start'], taskIds: [`${runtimeSessionId}-failed`] }
        })

        return {
          appendedNodeIds: streamPayloads.flatMap((payload) => payload.appendedNodeIds),
          appendedTaskIds: streamPayloads.flatMap((payload) => payload.appendedTaskIds),
          defaultWindowMs: defaultSnapshot.windowMs,
          exportedStartsWithSequence: exported.content.startsWith('sequenceDiagram'),
          filteredNodeCount: filtered.nodes.length,
          realtimeAppendMs: performance.now() - appendStartedAt,
          streamReasons: streamPayloads.map((payload) => payload.reason),
          window24hMs: window24h.windowMs
        }
      }, sessionId)

      expect(report.defaultWindowMs).toBe(1_800_000)
      expect(report.window24hMs).toBeLessThanOrEqual(86_400_000)
      expect(report.exportedStartsWithSequence).toBe(true)
      expect(report.streamReasons).toContain('initial')
      expect(report.streamReasons).toContain('append')
      expect(report.appendedTaskIds).toContain(`${sessionId}-failed`)
      expect(report.filteredNodeCount).toBeGreaterThanOrEqual(1)
      expect(report.realtimeAppendMs).toBeLessThan(10_000)
    } finally {
      await window.evaluate(async (runtimeSessionId) => {
        await window.devhub.r8.task.abortSession(runtimeSessionId, 'e2e-spec26-cleanup').catch(() => undefined)
      }, sessionId).catch(() => undefined)
      await closeElectronApp(electronApp)
    }
  })


  test('P6.1/P6.2/P7.1 scoped topology 与 flow 使用真实 IPC 和真实系统数据', async () => {
    test.setTimeout(120_000)
    const { electronApp, window } = await launchApp()
    let createdProjectId: string | null = null

    try {
      await resizeMainWindow(electronApp, 1440, 860)
      await window.setViewportSize({ width: 1440, height: 860 })
      await dismissAutoDiscoveryIfPresent(window)

      const report = await window.evaluate(async (repoPath) => {
        const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase()
        const [processResult, ports, windowResult] = await Promise.all([
          window.devhub.systemProcess.scan(),
          window.devhub.port.scan(),
          window.devhub.windowManager.scan(false)
        ])
        let projects = await window.devhub.projects.list()
        let project = projects.find((candidate) => normalizePath(candidate.path) === normalizePath(repoPath)) ?? projects[0] ?? null
        let createdProjectId: string | null = null
        if (!project) {
          project = await window.devhub.projects.add(repoPath)
          createdProjectId = project.id
          projects = await window.devhub.projects.list()
        }

        const processes = processResult.data ?? []
        const windows = windowResult.data ?? []
        const processCandidate = processes.find((candidate) => ports.some((port) => port.pid === candidate.pid) || windows.some((win) => win.pid === candidate.pid)) ?? processes[0]
        const portCandidate = ports.find((candidate) => processes.some((process) => process.pid === candidate.pid)) ?? ports[0]
        const windowCandidate = windows.find((candidate) => processes.some((process) => process.pid === candidate.pid)) ?? windows[0]
        if (!processCandidate || !portCandidate || !windowCandidate || !project) {
          throw new Error('真实 process/port/window/project 数据不足，不能验证 P6/P7')
        }

        const scopes = [
          { kind: 'process' as P6ScopeKind, targetId: processCandidate.pid, rootKind: 'process', rootId: `process-${processCandidate.pid}` },
          { kind: 'port' as P6ScopeKind, targetId: portCandidate.port, rootKind: 'port', rootId: `port-${portCandidate.port}-${portCandidate.pid}-${portCandidate.protocol}` },
          { kind: 'window' as P6ScopeKind, targetId: windowCandidate.hwnd, rootKind: 'window', rootId: `window-${windowCandidate.hwnd}` },
          { kind: 'project' as P6ScopeKind, targetId: project.id, rootKind: 'project', rootId: `project-${project.id}` }
        ]

        const results = []
        for (const descriptor of scopes) {
          const scope = { kind: descriptor.kind, targetId: descriptor.targetId, depth: 2 }
          const [graph, flow, warm] = await Promise.all([
            window.devhub.topology.buildScopedGraph(scope),
            window.devhub.topology.buildScopedFlow(scope),
            window.devhub.topology.warmScope(scope)
          ])
          const root = graph.nodes.find((node) => node.root) ?? null
          results.push({
            edgeCount: graph.edges.length,
            expectedRootId: descriptor.rootId,
            expectedRootKind: descriptor.rootKind,
            kind: descriptor.kind,
            linkCount: flow.links.length,
            nodeCount: graph.nodes.length,
            rootId: root?.id ?? null,
            rootKind: root?.kind ?? null,
            source: graph.source,
            stepCount: flow.steps.length,
            warmEdgeCount: warm.edgeCount,
            warmNodeCount: warm.nodeCount,
            warmOk: warm.ok,
            warmSource: warm.source
          })
        }
        return { createdProjectId, portTarget: portCandidate.port, projectCount: projects.length, processCount: processes.length, results }
      }, process.cwd())
      createdProjectId = report.createdProjectId


      expect(report.processCount).toBeGreaterThan(0)
      expect(report.projectCount).toBeGreaterThan(0)
      expect(report.results.map((result) => result.kind).sort()).toEqual(['port', 'process', 'project', 'window'])
      for (const result of report.results) {
        expect(['cache', 'scan']).toContain(result.source)
        expect(['cache', 'scan']).toContain(result.warmSource)
        expect(result.nodeCount).toBeGreaterThan(0)
        expect(result.stepCount).toBe(result.nodeCount)
        expect(result.linkCount).toBe(result.edgeCount)
        expect(result.rootKind).toBe(result.expectedRootKind)
        expect(result.rootId).toBe(result.expectedRootId)
        expect(result.warmOk).toBe(true)
        expect(result.warmNodeCount).toBe(result.nodeCount)
        expect(result.warmEdgeCount).toBe(result.edgeCount)
      }

      await buttonByText(window, '监控').click()
      await expect(buttonByText(window, '进程')).toBeVisible({ timeout: 15000 })
      await expect(buttonByText(window, '端口')).toBeVisible()
      await expect(buttonByText(window, '窗口')).toBeVisible()
      await expect(buttonByText(window, 'AI 任务')).toBeVisible()
      await expect(window.locator('button').filter({ hasText: '拓扑' })).toHaveCount(0)
      await expect(window.locator('button').filter({ hasText: '流程图' })).toHaveCount(0)

      await buttonByText(window, '端口').click()
      await expect(window.getByText('端口监控')).toBeVisible({ timeout: 15000 })
      await window.getByPlaceholder('搜索端口...').fill(String(report.portTarget))
      const portCard = window.locator(`[data-port-number="${report.portTarget}"]`).first()
      await expect(portCard).toBeVisible({ timeout: 15000 })
      await portCard.click()

      const graphView = window.getByTestId('attached-graph-view').first()
      await expect(graphView).toBeVisible({ timeout: 15000 })
      await expect(graphView).toHaveAttribute('data-root-kind', 'port')
      await expect(graphView).not.toHaveAttribute('data-source', 'renderer-store')
      await expect.poll(async () => Number(await graphView.getAttribute('data-node-count') ?? '0'), { timeout: 15000 }).toBeGreaterThan(1)

      const flowView = window.getByTestId('attached-flow-view').first()
      await expect(flowView).toHaveAttribute('data-root-kind', 'port')
      await expect(flowView).not.toHaveAttribute('data-source', 'renderer-store')
      await expect.poll(async () => Number(await flowView.getAttribute('data-step-count') ?? '0'), { timeout: 15000 }).toBeGreaterThan(1)
      await expect.poll(async () => window.locator('[data-testid="graph-node"]').count(), { timeout: 15000 }).toBeGreaterThan(1)


      const collectDistribution = async (): Promise<GraphNodeDistribution> => window.evaluate(() => {
        const graph = document.querySelector('[data-testid="attached-graph-view"]')
        const nodes = Array.from(graph?.querySelectorAll<SVGGElement>('[data-testid="graph-node"]') ?? [])
        const svg = nodes[0]?.ownerSVGElement ?? null
        const svgContainer = svg?.parentElement ?? null
        if (!graph || !svg || !svgContainer || nodes.length < 2) throw new Error('Graph DOM is not ready')
        const graphRect = svgContainer.getBoundingClientRect()
        const centers = nodes.map((node) => {
          const transform = node.getAttribute('transform') ?? ''
          const match = /translate\(([-0-9.]+),([-0-9.]+)\)/.exec(transform)
          if (!match) throw new Error(`Graph node missing translate transform: ${transform}`)
          return { x: Number(match[1]), y: Number(match[2]) }
        })
        const xs = centers.map((center) => center.x)
        const ys = centers.map((center) => center.y)
        return {
          count: nodes.length,
          spreadX: Math.max(...xs) - Math.min(...xs),
          spreadY: Math.max(...ys) - Math.min(...ys),
          viewBoxHeight: svg.viewBox.baseVal.height,
          viewBoxWidth: svg.viewBox.baseVal.width,
          containerHeight: graphRect.height,
          containerWidth: graphRect.width
        }
      })

      await expect.poll(async () => {
        const distribution = await collectDistribution()
        return distribution.spreadX + distribution.spreadY
      }, {
        message: '等待 force layout 将真实节点从初始中心点分散',
        timeout: 15000
      }).toBeGreaterThan(40)
      const beforeResize = await collectDistribution()
      expect(beforeResize.viewBoxWidth).toBeGreaterThan(0)
      expect(Math.abs(beforeResize.viewBoxWidth - beforeResize.containerWidth)).toBeLessThanOrEqual(2)
      await resizeMainWindow(electronApp, 1760, 980)
      await window.setViewportSize({ width: 1760, height: 980 })
      await window.waitForTimeout(1000)
      await expect.poll(async () => {
        const distribution = await collectDistribution()
        const delta = Math.abs(distribution.viewBoxWidth - beforeResize.viewBoxWidth) + Math.abs(distribution.viewBoxHeight - beforeResize.viewBoxHeight)
        const widthSynced = Math.abs(distribution.viewBoxWidth - distribution.containerWidth) <= 2
        const heightSynced = Math.abs(distribution.viewBoxHeight - distribution.containerHeight) <= 2
        return delta > 1 && widthSynced && heightSynced
      }, {
        message: '等待 resize observer 将 SVG viewBox 同步到真实容器尺寸',
        timeout: 15000
      }).toBe(true)
      const afterResize = await collectDistribution()
      expect(afterResize.count).toBe(beforeResize.count)
      expect(afterResize.viewBoxWidth).toBeGreaterThan(0)
      expect(afterResize.viewBoxHeight).toBeGreaterThan(0)
      expect(Math.abs(afterResize.viewBoxWidth - afterResize.containerWidth)).toBeLessThanOrEqual(2)
      expect(Math.abs(afterResize.viewBoxHeight - afterResize.containerHeight)).toBeLessThanOrEqual(2)
      expect(afterResize.spreadX + afterResize.spreadY).toBeGreaterThan(40)
    } finally {
      if (createdProjectId) {
        await window.evaluate(async (projectId) => { await window.devhub.projects.remove(projectId) }, createdProjectId).catch(() => undefined)
      }
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-05 detects a real Cursor-named Electron window through scanner cache', async () => {
    test.setTimeout(120_000)
    const title = `Cursor - Editing main.ts DevHub R8C spec05 ${Date.now()}`
    let electronApp: ElectronApplication | null = null
    let externalProbe: ExternalElectronProbe | null = null

    try {
      externalProbe = startExternalElectronProbe('cursor.exe', title)
      const launched = await launchApp()
      electronApp = launched.electronApp
      const { window } = launched
      await dismissAutoDiscoveryIfPresent(window)
      const externalPid = externalProbe.process.pid ?? 0
      expect(externalPid).toBeGreaterThan(0)

      let report: R8Spec05WindowDetectionReport | null = null
      await expect.poll(async () => {
        const hookScan = await electronApp.evaluate(async () => {
          const hooks = (globalThis as typeof globalThis & {
            __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
          }).__DEVHUB_TEST_HOOKS__
          if (!hooks) {
            throw new Error('Runtime test hooks are not available for R8.C spec-05')
          }
          return hooks.scanWindowsIntoCacheForTests()
        })
        if (!hookScan.success) return false
        const scannedWindow = hookScan.data.find(row => row.title === title) ?? null
        report = await window.evaluate(async (expectedTitle): Promise<R8Spec05WindowDetectionReport | null> => {
          const status = await window.devhub.r8.cli.cursorCopilotStatus() as CursorCopilotE2EStatus
          const matchingSignal = status.signals.find(signal => signal.rawTitle === expectedTitle) ?? null
          if (!matchingSignal) return null
          return {
            scannerRetrySuccess: true,
            windowHwnd: 0,
            windowPid: 0,
            windowProcessName: '',
            status,
            matchingSignal
          }
        }, title)
        if (report && scannedWindow) {
          report = {
            ...report,
            windowHwnd: scannedWindow.hwnd,
            windowPid: scannedWindow.pid,
            windowProcessName: scannedWindow.processName
          }
        } else {
          report = null
        }
        return report !== null
      }, {
        message: '等待真实 cursor.exe Electron 窗口经 WindowManager 扫描进入 R8.C spec-05 detector',
        timeout: 30_000,
        intervals: [750, 1000, 1500]
      }).toBe(true)

      if (!report) throw new Error('R8.C spec-05 did not produce a real Cursor/Copilot detection report')
      expect(report.scannerRetrySuccess).toBe(true)
      expect(report.windowHwnd).toBeGreaterThan(0)
      expect(report.windowPid).toBe(externalPid)
      expect(['cursor', 'cursor.exe']).toContain(report.windowProcessName.toLowerCase())
      expect(report.matchingSignal).toMatchObject({
        tool: 'cursor',
        phase: 'editing',
        confidence: 0.6,
        source: 'window-title',
        rawTitle: title
      })
      expect(report.matchingSignal.titleHash).toMatch(/^[a-f0-9]{16}$/)
      expect(['cursor', 'cursor.exe']).toContain(report.matchingSignal.processName.toLowerCase())
      expect(report.status.rawTitle).toBe(title)
      expect(report.status.phase).toBe('editing')
      expect(report.status.confidence).toBeGreaterThanOrEqual(0.6)
    } finally {
      await stopExternalElectronProbe(externalProbe)
      if (electronApp) {
        await closeElectronApp(electronApp)
      }
    }
  })

  test('R8.C spec-24 global topology covers 100 500 800 fixtures graph kind switching and time cursor', async () => {
    test.setTimeout(120_000)
    const { electronApp, window } = await launchApp()
    try {
      await resizeMainWindow(electronApp, 1440, 860)
      await window.setViewportSize({ width: 1440, height: 860 })
      await dismissAutoDiscoveryIfPresent(window)

      const fixtureRows = await electronApp.evaluate(async (_, config): Promise<TopologyFixtureForTestsResult[]> => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        if (!hooks) {
          throw new Error('Runtime test hooks are not available for R8.C spec-24')
        }
        const rows: TopologyFixtureForTestsResult[] = []
        for (const graphKind of config.graphKinds) {
          for (const nodeCount of config.nodeCounts) {
            rows.push(await hooks.buildGlobalTopologyFixtureForTests({
              asOfTs: config.cursor,
              expandAll: nodeCount > 500,
              graphKind,
              nodeCount
            }))
          }
        }
        return rows
      }, {
        cursor: SPEC24_TOPOLOGY_FIXTURE_CURSOR,
        graphKinds: [...SPEC24_TOPOLOGY_FIXTURE_GRAPH_KINDS],
        nodeCounts: [...SPEC24_TOPOLOGY_FIXTURE_NODE_COUNTS]
      })

      expect(fixtureRows).toHaveLength(SPEC24_TOPOLOGY_FIXTURE_GRAPH_KINDS.length * SPEC24_TOPOLOGY_FIXTURE_NODE_COUNTS.length)
      for (const row of fixtureRows) {
        expect(SPEC24_TOPOLOGY_FIXTURE_GRAPH_KINDS).toContain(row.graphKind)
        expect(SPEC24_TOPOLOGY_FIXTURE_NODE_COUNTS).toContain(row.requestedNodeCount as 100 | 500 | 800)
        expect(row.asOfTs).toBe(SPEC24_TOPOLOGY_FIXTURE_CURSOR)
        expect(row.nodeCount).toBe(row.requestedNodeCount)
        expect(row.historicalNodeCount).toBe(row.nodeCount)
        expect(row.source).toBe('scanner-cache')
        expect(row.durationMs).toBeLessThan(SPEC24_TOPOLOGY_FIXTURE_BUDGET_MS)
        expect(row.warningCodes).not.toContain('E_GRAPH_NODE_LIMIT')
      }

      const guardedRows = await electronApp.evaluate(async (_, config): Promise<TopologyFixtureForTestsResult[]> => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__
        if (!hooks) {
          throw new Error('Runtime test hooks are not available for R8.C spec-24 guard')
        }
        const rows: TopologyFixtureForTestsResult[] = []
        for (const graphKind of config.graphKinds) {
          rows.push(await hooks.buildGlobalTopologyFixtureForTests({
            expandAll: false,
            graphKind,
            nodeCount: 800
          }))
        }
        return rows
      }, { graphKinds: [...SPEC24_TOPOLOGY_FIXTURE_GRAPH_KINDS] })
      for (const row of guardedRows) {
        expect(row.degraded).toBe(true)
        expect(row.nodeCount).toBe(500)
        expect(row.warningCodes).toContain('E_GRAPH_NODE_LIMIT')
      }

      await window.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:open-topology-global'))
      })
      const topologyView = window.getByTestId('full-screen-topology-view')
      const graphCanvas = window.getByTestId('graph-canvas')
      await expect(topologyView).toBeVisible({ timeout: 15_000 })
      await expect(graphCanvas).toHaveAttribute('data-kind', 'network-topology', { timeout: 15_000 })

      await window.getByTestId('graph-kind-neural-relationship').click()
      await expect(graphCanvas).toHaveAttribute('data-kind', 'neural-relationship', { timeout: 15_000 })
      await window.getByTestId('graph-kind-flow').click()
      await expect(graphCanvas).toHaveAttribute('data-kind', 'flow', { timeout: 15_000 })
      await window.getByTestId('graph-kind-network-topology').click()
      await expect(graphCanvas).toHaveAttribute('data-kind', 'network-topology', { timeout: 15_000 })

      await window.getByTestId('graph-time-cursor').fill('2026-05-17T08:00')
      await expect.poll(async () => graphCanvas.getAttribute('data-as-of-ts'), {
        message: 'wait for global topology time cursor render',
        timeout: 15_000
      }).not.toBe('current')
      const renderedCursor = Number(await graphCanvas.getAttribute('data-as-of-ts'))
      expect(Number.isFinite(renderedCursor)).toBe(true)
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-25 attached topology covers real entries depth10 favorites and mini mode', async () => {
    test.setTimeout(150_000)
    let listener: { port: number; server: Server } | null = null
    let electronApp: ElectronApplication | null = null
    let probeWindowId: number | null = null
    const probeTitle = `DevHub spec-25 topology window ${Date.now()}`

    try {
      listener = await listenOnEphemeralPort()
      const launched = await launchApp()
      electronApp = launched.electronApp
      const { window } = launched
      probeWindowId = await createRealBrowserWindowWithTitle(electronApp, probeTitle)

      await resizeMainWindow(electronApp, 1440, 860)
      await window.setViewportSize({ width: 1440, height: 860 })
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate(() => {
        window.localStorage.removeItem('devhub:attached-topology:favorites')
        window.dispatchEvent(new Event('devhub:open-monitor'))
      })

      const report = await window.evaluate(async ({ expectedPort, titlePrefix }): Promise<AttachedTopologySpec25Report> => {
        const [processResult, ports, windowResult] = await Promise.all([
          window.devhub.systemProcess.scan(),
          window.devhub.port.scan(),
          window.devhub.windowManager.scan(false)
        ])
        const processes = processResult.data ?? []
        const windows = windowResult.data ?? []
        const portCandidate = ports.find(port => port.port === expectedPort)
          ?? ports.find(port => port.state === 'LISTENING')
          ?? ports[0]
        const processCandidate = processes.find(process => process.pid === portCandidate?.pid)
          ?? processes.find(process => windows.some(win => win.pid === process.pid))
          ?? processes[0]
        const windowCandidate = windows.find(win => win.title.includes(titlePrefix))
          ?? windows.find(win => win.pid === processCandidate?.pid)
          ?? windows[0]
        if (!processCandidate || !portCandidate || !windowCandidate) {
          throw new Error('Real process/port/window data is insufficient for R8.C spec-25 E2E')
        }

        const ipcGraph = await window.devhub.r8.topology.attachedDeep10({
          scope: 'port',
          targetId: portCandidate.port,
          graphKind: 'network-topology',
          depth: 10,
          expandedNodeIds: [],
          selectedNodeId: null,
          thumbnailMode: false
        })

        return {
          ipcDepth: ipcGraph.snapshot.slice.depth ?? 0,
          ipcLazy: ipcGraph.lazy,
          ipcNodeCount: ipcGraph.snapshot.nodes.length,
          ipcTruncatedAtDepth: ipcGraph.truncatedAtDepth,
          port: portCandidate.port,
          portPid: portCandidate.pid,
          processPid: processCandidate.pid,
          windowHwnd: windowCandidate.hwnd,
          windowTitle: windowCandidate.title
        }
      }, { expectedPort: listener.port, titlePrefix: probeTitle })

      expect(report.processPid).toBeGreaterThan(0)
      expect(report.port).toBeGreaterThan(0)
      expect(report.windowHwnd).toBeGreaterThan(0)
      expect(report.ipcDepth).toBe(10)
      expect(report.ipcLazy).toBe(true)
      expect(report.ipcNodeCount).toBeGreaterThan(0)
      expect(report.ipcTruncatedAtDepth === null || report.ipcTruncatedAtDepth >= 7).toBe(true)

      await window.evaluate(() => {
        window.dispatchEvent(new Event('devhub:open-monitor'))
      })
      await expect(window.locator('.monitor-content')).toBeVisible({ timeout: 15000 })
      await window.evaluate(() => {
        window.localStorage.setItem('devhub:process-view-mode', 'card')
      })
      await buttonByText(window, '进程').click()
      await window.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:process-view-mode', { detail: { mode: 'card' } }))
      })
      await window.locator('input[placeholder*="pid:1234"]').first().fill(`pid:${report.processPid}`)
      const processBadge = window.getByTestId(`process-card-graph-badge-${report.processPid}`)
      await expect(processBadge).toBeVisible({ timeout: 15000 })
      await expect(processBadge).toHaveAttribute('data-graph-entry', 'process-card-attached-topology')
      await expect(processBadge).toHaveAttribute('data-graph-scope', 'process')

      await window.evaluate(() => {
        window.dispatchEvent(new Event('devhub:open-monitor'))
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'port' } }))
      })
      await expect(window.getByTestId('port-list-scroll').first()).toBeVisible({ timeout: 15000 })
      await window.locator('input.input-sm').first().fill(String(report.port))
      const portCard = window.getByTestId(`port-card-${report.port}-${report.portPid}`)
      await expect(portCard).toBeVisible({ timeout: 15000 })
      const portBadge = window.getByTestId(`port-card-graph-badge-${report.port}-${report.portPid}`)
      await expect(portBadge).toHaveAttribute('data-graph-entry', 'port-card-attached-topology')
      await expect(portBadge).toHaveAttribute('data-graph-scope', 'port')
      await portCard.click()
      await expect(window.getByTestId('port-attached-topology-button')).toHaveAttribute('data-graph-entry', 'port-focus-attached-topology')

      const graphView = window.getByTestId('attached-graph-view').first()
      await expect(graphView).toBeVisible({ timeout: 15000 })
      await expect(graphView).toHaveAttribute('data-root-kind', 'port')
      await expect(graphView).not.toHaveAttribute('data-source', 'renderer-store')
      await expect.poll(async () => Number(await graphView.getAttribute('data-node-count') ?? '0'), { timeout: 15000 }).toBeGreaterThan(0)
      await window.getByTestId('attached-depth-slider').first().fill('10')
      await expect(graphView).toHaveAttribute('data-depth', '10')
      await expect(window.getByTestId('attached-lazy-banner').first()).toBeVisible({ timeout: 15000 })
      await expect.poll(async () => await graphView.getAttribute('data-lazy'), { timeout: 15000 }).toBe('true')

      await window.getByTestId('attached-favorite-button').first().click()
      await expect(window.getByTestId('attached-favorites-menu').first()).toBeVisible({ timeout: 15000 })
      const favoriteState = await window.evaluate(() => {
        const raw = window.localStorage.getItem('devhub:attached-topology:favorites')
        const favorites = raw ? JSON.parse(raw) as Array<{ scope: string; targetId: number | string; graphKind: string }> : []
        return {
          count: favorites.length,
          graphKind: favorites[0]?.graphKind ?? null,
          scope: favorites[0]?.scope ?? null,
          targetId: favorites[0]?.targetId !== undefined ? String(favorites[0].targetId) : null
        }
      })
      expect(favoriteState.count).toBeGreaterThan(0)
      expect(favoriteState.scope).toBe('port')
      expect(favoriteState.targetId).toBe(String(report.port))
      expect(favoriteState.graphKind).toBe('network-topology')

      await resizeMainWindow(electronApp, 430, 760)
      await window.setViewportSize({ width: 430, height: 760 })
      const miniThumbnail = window.getByTestId('attached-mini-thumbnail').first()
      await expect(miniThumbnail).toBeVisible({ timeout: 15000 })
      await miniThumbnail.evaluate((element) => {
        if (!(element instanceof HTMLDetailsElement)) throw new Error('spec-25 mini thumbnail is not details')
        element.open = true
      })
      await expect(window.getByTestId('attached-mini-expanded-card').first()).toBeVisible({ timeout: 15000 })
      await window.getByTestId('attached-mini-popout-button').first().click()
      await expect(window.getByTestId('attached-mini-floating-card').first()).toBeVisible({ timeout: 15000 })

      await resizeMainWindow(electronApp, 1440, 860)
      await window.setViewportSize({ width: 1440, height: 860 })
      await window.evaluate(() => {
        window.dispatchEvent(new Event('devhub:open-monitor'))
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'window' } }))
      })
      await expect(window.locator('input.w-56').first()).toBeVisible({ timeout: 15000 })
      await window.locator('input.w-56').first().fill(report.windowTitle)
      const windowBadge = window.getByTestId(`window-card-graph-badge-${report.windowHwnd}`).first()
      await expect(windowBadge).toBeVisible({ timeout: 15000 })
      await expect(windowBadge).toHaveAttribute('data-graph-entry', 'window-card-attached-topology')
      await expect(windowBadge).toHaveAttribute('data-graph-scope', 'window')
      await windowBadge.click()
      await expect(window.getByTestId('window-attached-topology-button')).toHaveAttribute('data-graph-entry', 'window-header-attached-topology')
      await expect(window.getByTestId('window-relationship-panel')).toHaveAttribute('data-graph-kind', 'attached')
    } finally {
      await closeServer(listener?.server ?? null)
      if (electronApp) {
        await closeRealBrowserWindowById(electronApp, probeWindowId)
        await closeElectronApp(electronApp)
      }
    }
  })

  test('X5 ScannerRegistry 在真实主进程中保持单例映射', async () => {
    const { electronApp } = await launchApp()
    try {
      const snapshot = await electronApp.evaluate(() => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__

        if (!hooks) {
          throw new Error('Runtime test hooks are not available')
        }

        return hooks.getScannerRegistrySnapshot()
      })

      expect(snapshot.map((row) => row.kind).sort()).toEqual(
        [...EXPECTED_RUNTIME_SINGLETON_KINDS].sort()
      )
      expect(new Set(snapshot.map((row) => row.kind)).size).toBe(snapshot.length)

      for (const row of snapshot) {
        expect(row.instanceType).toBeTruthy()
      }
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('X2 preload 白名单在 renderer world 中形成真实可调用 surface', async () => {
    const { electronApp, window } = await launchApp()
    try {
      await dismissAutoDiscoveryIfPresent(window)

      const surface = await getRuntimePreloadSurfaceSnapshot(window)

      expect(surface.topLevelKeys).toEqual([...EXPECTED_PRELOAD_TOP_LEVEL_KEYS])

      for (const methodPath of EXPECTED_PRELOAD_METHODS) {
        expect(surface.typeMap[methodPath]).toBe('function')
      }

      if (surface.hasDevObs) {
        for (const methodPath of OPTIONAL_DEV_OBS_METHODS) {
          expect(surface.typeMap[methodPath]).toBe('function')
        }
      }

      for (const forbiddenPath of FORBIDDEN_PRELOAD_PATHS) {
        expect(surface.typeMap[forbiddenPath]).toBeUndefined()
      }

      const runtimeCalls = await window.evaluate(async () => {
        const drives = await window.devhub.system.getDrives()
        const groups = await window.devhub.groups.list()
        const notifications = await window.devhub.notification.getUnreadCount()
        const projects = await window.devhub.projects.list()
        const scannerStatus = await window.devhub.scanner.getStatus()
        const settings = await window.devhub.settings.get()
        const tags = await window.devhub.tags.list()
        const taskHistory = await window.devhub.taskHistory.list({ limit: 5 })
        const tools = await window.devhub.tools.getStatus()
        const watcherStatus = await window.devhub.projects.watcher?.status?.()

        window.devhub.logs.clear('__codex_autoresearch_x2__')
        window.devhub.scanner.subscribe()

        return {
          drivesCount: drives.length,
          groupsCount: groups.length,
          notifications,
          projectsCount: projects.length,
          scannerStatusType: scannerStatus === null ? 'null' : typeof scannerStatus,
          settingsType: typeof settings,
          tagsCount: tags.length,
          taskHistoryCount: taskHistory.length,
          toolsCount: tools.length,
          watcherRunningType: watcherStatus ? typeof watcherStatus.running : 'undefined'
        }
      })

      expect(runtimeCalls.drivesCount).toBeGreaterThanOrEqual(0)
      expect(runtimeCalls.groupsCount).toBeGreaterThanOrEqual(0)
      expect(runtimeCalls.notifications).toBeGreaterThanOrEqual(0)
      expect(runtimeCalls.projectsCount).toBeGreaterThanOrEqual(0)
      expect(['null', 'object']).toContain(runtimeCalls.scannerStatusType)
      expect(runtimeCalls.settingsType).toBe('object')
      expect(runtimeCalls.tagsCount).toBeGreaterThanOrEqual(0)
      expect(runtimeCalls.taskHistoryCount).toBeGreaterThanOrEqual(0)
      expect(runtimeCalls.toolsCount).toBeGreaterThanOrEqual(0)
      expect(runtimeCalls.watcherRunningType).toBe('boolean')
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('X6 PowerShellGateway 在真实主进程中对并发 PowerShell 调用施加 semaphore', async () => {
    const { electronApp } = await launchApp()
    try {
      const result = await electronApp.evaluate(async () => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__

        if (!hooks) {
          throw new Error('Runtime test hooks are not available')
        }

        return hooks.runPowerShellConcurrencyProbeForTests({
          count: 10,
          sampleIntervalMs: 20,
          sleepMs: 400,
          timeoutMs: 4000
        })
      })

      expect(result.count).toBe(10)
      expect(result.fulfilledCount).toBe(10)
      expect(result.rejectedCount).toBe(0)
      expect(result.maxActiveCount).toBeLessThanOrEqual(2)
      expect(result.maxRunningPids).toBeLessThanOrEqual(2)
      expect(result.maxQueuedCount).toBeGreaterThanOrEqual(8)
      expect(result.completedCount).toBeGreaterThanOrEqual(10)
      expect(result.failedCount).toBe(0)
      expect(result.timedOutCount).toBe(0)
      expect(result.abortedCount).toBe(0)
      expect(result.durationMs).toBeGreaterThanOrEqual(1500)
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('X7 统一退出清理链能够产出结构化 disposal report', async () => {
    const { electronApp } = await launchApp()
    try {
      const result = await electronApp.evaluate(async () => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__

        if (!hooks) {
          throw new Error('Runtime test hooks are not available')
        }

        return hooks.disposeRuntimeForTests()
      })

      expect(result.killedChildren).toBeGreaterThanOrEqual(0)
      expect(result.report.total).toBe(EXPECTED_DISPOSAL_ENTRIES.length)
      expect(result.report.failed).toEqual([])
      expect(result.report.timedOut).toEqual([])
      expect(result.report.remainingAfter).toEqual([])
      expect(result.report.succeeded).toEqual(expect.arrayContaining(EXPECTED_DISPOSAL_ENTRIES as unknown as string[]))

      const disposalState = await electronApp.evaluate(() => {
        const hooks = (globalThis as typeof globalThis & {
          __DEVHUB_TEST_HOOKS__?: RuntimeTestHooks
        }).__DEVHUB_TEST_HOOKS__

        if (!hooks) {
          throw new Error('Runtime test hooks are not available')
        }

        return hooks.getDisposalRegistryState()
      })

      expect(disposalState.remaining).toEqual([])
      expect(disposalState.lastReport?.remainingAfter).toEqual([])
      expect(disposalState.lastReport?.failed ?? []).toEqual([])
      expect(disposalState.lastReport?.timedOut ?? []).toEqual([])
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('X8 DevObservabilityPanel 可通过真实热键打开并暴露核心指标', async () => {
    const { electronApp, window } = await launchApp({
      enableDevObservability: true
    })

    try {
      await dismissAutoDiscoveryIfPresent(window)
      await window.bringToFront()

      const devObsAvailable = await window.evaluate(() =>
        Boolean((window as typeof window & {
          devhub?: {
            devObs?: RuntimeDevObsApi
          }
        }).devhub?.devObs)
      )
      expect(devObsAvailable).toBe(true)

      await window.keyboard.press('Control+Shift+D')

      const panel = window.getByTestId('dev-obs-panel')
      await expect(panel).toBeVisible({ timeout: 5000 })

      for (const metricId of [
        'metric-main-rss',
        'metric-renderer-rss',
        'metric-ps-children',
        'metric-cpu',
        'metric-ipc-rpm',
        'metric-react-commits'
      ] as const) {
        await expect(panel.getByTestId(metricId)).toBeVisible()
      }

      await assertDevObservabilityReady(window, panel)

      await panel.getByRole('button', { name: 'IPC' }).click()
      await expect(panel.getByText('Throttle Snapshot')).toBeVisible()
      await expect(panel.getByTestId('metric-ipc-throttle')).toBeVisible()

      await panel.getByRole('button', { name: '扫描器' }).click()
      await expect(panel.getByText('Renderer ACK Backpressure')).toBeVisible()
      await expect(panel.getByText('PowerShell Pool')).toBeVisible()
      await expect.poll(async () => {
        return window.evaluate(async () => {
          const api = (window as typeof window & {
            devhub?: {
              devObs?: RuntimeDevObsApi
            }
          }).devhub?.devObs

          if (!api) {
            return false
          }

          const snapshot = await api.getRuntimeMetrics()
          return snapshot.extended.scannerBackpressure.length >= 1
        })
      }, {
        message: '等待 Renderer ACK Backpressure 进入可观测状态',
        timeout: 15000
      }).toBe(true)

      const exportResult = await window.evaluate(async () => {
        const api = (window as typeof window & {
          devhub?: {
            devObs?: RuntimeDevObsApi
          }
        }).devhub?.devObs

        if (!api) {
          throw new Error('devObs API is not available')
        }

        return api.exportDiagnosticBundle()
      })

      expect(exportResult.bytes).toBeGreaterThan(0)
      expect(existsSync(exportResult.path)).toBe(true)

      await panel.getByRole('button', { name: '关闭' }).click()
      await expect(panel).toBeHidden()

      await window.keyboard.press('Control+Alt+D')
      await expect(panel).toBeVisible({ timeout: 5000 })
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-11 skill editor renders real Monaco workers in R8 Ops', async () => {
    test.setTimeout(60_000)
    const { electronApp, window } = await launchApp()

    try {
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate(() => {
        window.dispatchEvent(new Event('devhub:open-monitor'))
      })
      await expect(window.getByText('SYSTEM MONITOR')).toBeVisible({ timeout: 15_000 })
      await window.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'r8-ops' } }))
      })

      await expect(window.getByText('R8 OPERATIONS')).toBeVisible({ timeout: 15_000 })
      const skillEditor = window.getByTestId('skill-editor-panel')
      await expect(skillEditor).toBeVisible({ timeout: 30_000 })
      await skillEditor.scrollIntoViewIfNeeded()

      await expect(skillEditor.locator('select[aria-label="Skill selector"] option').first()).toBeAttached({ timeout: 15_000 })
      await expect(skillEditor.getByTestId('skill-monaco-frame').locator('.monaco-editor')).toBeVisible({ timeout: 30_000 })
      await expect(skillEditor.locator('textarea[aria-label="Skill editor loading"]')).toHaveCount(0)

      await skillEditor.getByRole('button', { name: 'SCRIPT' }).click()
      await skillEditor.locator('select[aria-label="Script language"]').selectOption('python')
      await expect(skillEditor.getByTestId('skill-monaco-frame').locator('.monaco-editor')).toBeVisible({ timeout: 15_000 })

      const workerProbe = await window.evaluate(() => {
        const monacoEnvironment = (globalThis as typeof globalThis & {
          MonacoEnvironment?: {
            getWorker: (workerId: string, label: string) => Worker
          }
        }).MonacoEnvironment
        if (!monacoEnvironment) {
          throw new Error('MonacoEnvironment is not available after loading SkillEditorPanel')
        }

        return ['editor', 'json', 'typescript', 'yaml'].map((label): RuntimeMonacoWorkerProbe => {
          const worker = monacoEnvironment.getWorker(`e2e-${label}`, label)
          const result = {
            constructorName: worker.constructor.name,
            hasTerminate: typeof worker.terminate === 'function',
            label
          }
          worker.terminate()
          return result
        })
      })

      expect(workerProbe.map(worker => worker.label)).toEqual(['editor', 'json', 'typescript', 'yaml'])
      for (const worker of workerProbe) {
        expect(worker.constructorName.length).toBeGreaterThan(0)
        expect(worker.hasTerminate).toBe(true)
      }
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-34 recovery detects dirty relaunch and creates a pre-recovery snapshot', async () => {
    test.setTimeout(120_000)
    const sessionId = `e2e-spec34-${Date.now()}`
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    let secondWindow: Page | null = null
    let userDataPath = ''
    let dirtyStorePath = ''

    try {
      const firstLaunch = await launchApp()
      firstApp = firstLaunch.electronApp
      await dismissAutoDiscoveryIfPresent(firstLaunch.window)
      userDataPath = await firstApp.evaluate(({ app }) => app.getPath('userData'))
      await closeElectronApp(firstApp)
      firstApp = null

      dirtyStorePath = writeDirtyRuntimeStoreMarker(userDataPath, sessionId)
      writeRecoveryLifecycleMarker(userDataPath, sessionId)

      const secondLaunch = await launchApp()
      secondApp = secondLaunch.electronApp
      secondWindow = secondLaunch.window
      await dismissAutoDiscoveryIfPresent(secondWindow)

      await secondWindow.evaluate(async (runtimeSessionId) => {
        const task = await window.devhub.r8.csv.enqueueRow({
          id: `${runtimeSessionId}-row`,
          group: runtimeSessionId,
          tool: 'codex',
          prompt: 'R8.C spec-34 relaunch recovery verifies real queued work',
          dry_run: true
        })
        if (task.status !== 'queued') {
          throw new Error(`R8.C spec-34 expected a queued task, got ${task.status}`)
        }
      }, sessionId)

      dirtyStorePath = writeDirtyRuntimeStoreMarker(userDataPath, sessionId)
      writeRecoveryLifecycleMarker(userDataPath, sessionId)

      const dirtyResponse = await secondWindow.evaluate(async () => window.devhub.r8.recovery.checkDirty())
      expect(dirtyResponse.findings.map(finding => finding.kind).sort()).toEqual([
        'pending-tasks-in-queue',
        'unclean-shutdown',
        'unsaved-store'
      ])
      expect(JSON.stringify(dirtyResponse.findings.find(finding => finding.kind === 'pending-tasks-in-queue')?.details ?? {})).toContain(sessionId)
      expect(JSON.stringify(dirtyResponse.findings.find(finding => finding.kind === 'unsaved-store')?.details ?? {})).toContain('devhub-r8-runtime.json.tmp')

      await secondWindow.evaluate(() => {
        window.dispatchEvent(new Event('devhub:open-monitor'))
      })
      await expect(secondWindow.getByText('SYSTEM MONITOR')).toBeVisible({ timeout: 15_000 })
      await secondWindow.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'r8-ops' } }))
      })
      await expect(secondWindow.getByText('R8 OPERATIONS')).toBeVisible({ timeout: 15_000 })
      const recoveryDialog = secondWindow.getByTestId('recovery-dialog')
      await expect(recoveryDialog).toBeVisible({ timeout: 15_000 })
      await expect(recoveryDialog.getByText('unclean-shutdown')).toBeVisible()
      await expect(recoveryDialog.getByText('pending-tasks-in-queue')).toBeVisible()
      await expect(recoveryDialog.getByText('unsaved-store')).toBeVisible()

      const restoreReport = await secondWindow.evaluate(async (kindsToRestore) => {
        return window.devhub.r8.recovery.restoreState({
          kindsToRestore,
          confirmedBy: 'e2e-spec34',
          userChoice: 'restore-all'
        })
      }, dirtyResponse.findings.map(finding => finding.kind))

      expect(restoreReport?.snapshotsCreated[0]).toMatchObject({
        reason: 'pre-recovery'
      })
      expect(restoreReport?.appliedActions.some(action => action.finding === 'pending-tasks-in-queue')).toBe(true)
    } finally {
      if (secondWindow) {
        await secondWindow.evaluate(async (runtimeSessionId) => {
          await window.devhub.r8.task.abortSession(runtimeSessionId, 'e2e-spec34-cleanup').catch(() => undefined)
          const reports = await window.devhub.r8.recovery.report()
          const targetReports = reports.filter(item => JSON.stringify(item).includes(runtimeSessionId))
          for (const report of targetReports) {
            await window.devhub.r8.recovery.dismiss({ reportId: report.reportId }).catch(() => undefined)
          }
        }, sessionId).catch(() => undefined)
      }
      if (dirtyStorePath) {
        rmSync(dirtyStorePath, { force: true })
      }
      if (secondApp) {
        await closeElectronApp(secondApp)
      }
      if (firstApp) {
        await closeElectronApp(firstApp)
      }
    }
  })

  test('R8.C spec-35 RestoreWizard restores selected backup categories through real IPC', async () => {
    test.setTimeout(60_000)
    const { electronApp, window } = await launchApp()
    let createdBundleId = ''

    try {
      await dismissAutoDiscoveryIfPresent(window)
      const created = await window.evaluate(async () => window.devhub.r8.backup.create({
        categories: ['settings', 'csv-tasks', 'skills', 'audit-log'],
        confirmedBy: 'e2e-spec35'
      }))
      const createdRecord = created as { backupId?: string; bundleId?: string }
      if (!createdRecord.backupId || !createdRecord.bundleId) {
        throw new Error('R8.C spec-35 backup:create did not return backupId and bundleId')
      }
      createdBundleId = createdRecord.bundleId

      await window.evaluate(() => {
        window.dispatchEvent(new Event('devhub:open-monitor'))
      })
      await expect(window.getByText('SYSTEM MONITOR')).toBeVisible({ timeout: 15_000 })
      await window.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'r8-ops' } }))
      })

      await expect(window.getByText('R8 OPERATIONS')).toBeVisible({ timeout: 15_000 })
      const wizard = window.getByTestId('backup-restore-wizard')
      await expect(wizard).toBeVisible({ timeout: 15_000 })
      await wizard.scrollIntoViewIfNeeded()
      await expect(window.getByTestId('backup-count')).toHaveText(/[1-9]\d*/, { timeout: 15_000 })
      await window.getByTestId('backup-restore-select').selectOption(createdRecord.backupId)

      await expect(window.getByTestId('backup-category-settings')).toBeChecked()
      await expect(window.getByTestId('backup-category-csv-tasks')).toBeChecked()
      await expect(window.getByTestId('backup-category-skills')).toBeChecked()
      await expect(window.getByTestId('backup-category-audit-log')).toBeChecked()
      await window.getByTestId('backup-category-csv-tasks').click()
      await window.getByTestId('backup-category-audit-log').click()
      await window.getByTestId('backup-restore-confirm').click()
      await window.getByTestId('backup-restore-button').click()

      await expect(window.getByTestId('backup-restore-status')).toHaveText('2/2', { timeout: 30_000 })
      await expect(window.getByTestId('backup-pre-snapshot-id')).toHaveText(/[0-9a-f-]{36}/)

      const backupCount = await window.evaluate(async () => (await window.devhub.r8.backup.list()).length)
      expect(backupCount).toBeGreaterThan(0)
    } finally {
      if (createdBundleId) {
        await window.evaluate(async (bundleId) => {
          await window.devhub.r8.backup.delete({ bundleId, confirmedBy: 'e2e-spec35-cleanup' }).catch(() => undefined)
        }, createdBundleId).catch(() => undefined)
      }
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-36 diagnostic pack exports a redacted local artifact from R8 Ops', async () => {
    test.setTimeout(60_000)
    const { electronApp, window } = await launchApp()
    const seededSecret = 'sk-ant-e2e-spec36-1234567890abcdef'

    try {
      await dismissAutoDiscoveryIfPresent(window)
      const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
      const auditDir = join(userDataPath, 'logs')
      mkdirSync(auditDir, { recursive: true })
      appendFileSync(join(auditDir, 'security-audit.log'), `${JSON.stringify({
        timestamp: new Date().toISOString(),
        ts: Math.floor(Date.now() / 1000),
        action: 'e2e:diagnostic-redaction',
        op: 'e2e:diagnostic-redaction',
        target: {
          note: 'R8.C spec-36 Playwright fixture',
          token: seededSecret
        },
        result: 'success',
        outcome: 'success'
      })}\n`, 'utf8')

      await window.evaluate(() => {
        window.dispatchEvent(new Event('devhub:open-monitor'))
      })
      await expect(window.getByText('SYSTEM MONITOR')).toBeVisible({ timeout: 15_000 })
      await window.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'r8-ops' } }))
      })

      await expect(window.getByText('R8 OPERATIONS')).toBeVisible({ timeout: 15_000 })
      await expect(window.getByTestId('diagnostic-pack-panel')).toBeVisible({ timeout: 15_000 })
      await window.getByTestId('diagnostic-pack-export-button').click()

      await expect(window.getByTestId('diagnostic-pack-export-status')).toHaveText('exported', { timeout: 30_000 })
      await expect(window.getByTestId('diagnostic-pack-section-count')).toHaveText('4')
      await expect(window.getByTestId('diagnostic-pack-screenshots')).toHaveText('excluded')
      await expect(window.getByTestId('diagnostic-pack-preview-redactions')).toHaveText(/[1-9]\d*/)
      await expect(window.getByTestId('diagnostic-pack-artifact-path')).toHaveText(/\S/)

      const artifactPathText = await window.getByTestId('diagnostic-pack-artifact-path').textContent()
      if (!artifactPathText) {
        throw new Error('R8.C spec-36 diagnostic artifact path was not rendered')
      }
      const artifactPath = artifactPathText.trim()
      expect(existsSync(artifactPath)).toBe(true)

      const manifestPath = join(artifactPath, 'manifest.json')
      expect(existsSync(manifestPath)).toBe(true)
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RuntimeDiagnosticManifest
      expect(manifest.artifactPath).toBe(artifactPath)
      expect(manifest.noTelemetry).toBe(true)
      expect(manifest.redactionsApplied).toBeGreaterThan(0)
      expect(manifest.sectionsIncluded).toEqual([
        'observability-snapshot',
        'audit-log',
        'system-info',
        'env-config-redacted'
      ])
      expect(manifest.sectionsIncluded).not.toContain('screenshots')

      const auditSection = manifest.sections.find(section => section.section === 'audit-log')
      if (!auditSection) {
        throw new Error('R8.C spec-36 diagnostic manifest did not include audit-log section metadata')
      }
      expect(auditSection.redactionCount).toBeGreaterThan(0)
      const auditSectionText = readFileSync(join(artifactPath, auditSection.relativePath), 'utf8')
      expect(auditSectionText).not.toContain(seededSecret)
      expect(auditSectionText).toContain('[REDACTED')
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('R8.C spec-37 permission TTL countdown renders real IPC grants in R8 Ops', async () => {
    test.setTimeout(60_000)
    const { electronApp, window } = await launchApp()

    try {
      await dismissAutoDiscoveryIfPresent(window)
      await window.evaluate(async () => {
        await window.devhub.r8.permission.revokeAll('e2e-spec37')
        await window.devhub.r8.permission.request({
          op: 'inject',
          scope: { instanceId: 'e2e-spec37' },
          ttlMs: 65_000,
          confirmedBy: 'e2e-spec37'
        })
        window.dispatchEvent(new Event('devhub:open-monitor'))
      })

      await expect(window.getByText('SYSTEM MONITOR')).toBeVisible({ timeout: 15_000 })
      await window.evaluate(() => {
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'r8-ops' } }))
      })

      await expect(window.getByText('R8 OPERATIONS')).toBeVisible({ timeout: 15_000 })
      await expect(window.getByText('Permission TTL')).toBeVisible({ timeout: 15_000 })

      const countdownList = window.getByTestId('permission-countdown-list')
      const countdown = countdownList.locator('[data-testid^="permission-countdown-"]').first()
      await expect(countdown).toBeVisible({ timeout: 15_000 })
      await expect(countdown).toHaveAttribute('data-expiry-critical', 'false')
      await expect(countdown).toHaveText(/\d{2}:\d{2}/)

      await expect.poll(async () => countdown.getAttribute('data-expiry-critical'), {
        message: 'waiting for real TTL countdown to enter the red under-one-minute state',
        timeout: 12_000
      }).toBe('true')
      await expect(countdown).toHaveText(/00:[0-5]\d/)
    } finally {
      await window.evaluate(async () => {
        await window.devhub.r8.permission.revokeAll('e2e-spec37')
      }).catch(() => undefined)
      await closeElectronApp(electronApp)
    }
  })
})
