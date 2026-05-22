import { app, BrowserWindow, shell, Tray, Menu, nativeImage, session } from 'electron'
import type { AIMonitorState, AITask, AIWindowAlias, PortInfo, ProcessInfo, ScannerCacheSnapshot, WindowInfo } from '@shared/types-extended'
import type { CliOutputEvent, GraphKind, ParserStrategy } from '@shared/schemas/r8-runtime'
import { mkdirSync } from 'fs'
import { isAbsolute, join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, cleanupIpcHandlers, getR8RuntimeServiceForTests } from './ipc'
import { AppStore } from './store/AppStore'
import { ProcessManager } from './services/ProcessManager'
import { ToolMonitor } from './services/ToolMonitor'
import { ProjectScanner } from './services/ProjectScanner'
import { getNotificationService } from './services/NotificationService'
import { BackgroundScannerManager } from './services/BackgroundScannerManager'
import { ScannerCache } from './services/ScannerCache'
import { SystemProcessScanner } from './services/SystemProcessScanner'
import { PortScanner } from './services/PortScanner'
import { WindowManager as WindowManagerService } from './services/WindowManager'
import { AITaskTracker } from './services/AITaskTracker'
import { AIAliasManager } from './services/AIAliasManager'
import { getDisposalRegistry, type DisposalReport } from './services/runtime/DisposalRegistry'
import { getPowerShellGateway, shutdownPowerShellGateway } from './services/runtime/PowerShellGateway'
import { getScannerRegistry, type ScannerRegistrySnapshotRow } from './services/runtime/ScannerRegistry'
import { MetricsCollector } from './services/observability/MetricsCollector'
import { setRateLimitObserver } from './utils/rateLimiter'
import { installSafeConsole } from './utils/safeConsole'
import type { StatusAggregatorPublishResult } from './services/StatusAggregator'
import { GraphService } from './services/graph/GraphService'

installSafeConsole()

if (process.env.DEVHUB_R8_POPOUT_PROCESS_REUSE === '1') {
  app.commandLine.appendSwitch('process-per-site')
}

const explicitUserDataPath = process.env.DEVHUB_USER_DATA_DIR?.trim()
if (explicitUserDataPath) {
  const userDataPath = isAbsolute(explicitUserDataPath) ? explicitUserDataPath : resolve(explicitUserDataPath)
  mkdirSync(userDataPath, { recursive: true })
  app.setPath('userData', userDataPath)
}

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let tray: Tray | null = null
const pendingProtocolUris: string[] = []
const DEVHUB_PROTOCOL_SCHEME = 'devhub'

interface MainProcessShutdownResult {
  killedChildren: number
  report: DisposalReport
}

interface PowerShellConcurrencyProbeOptions {
  count?: number
  sampleIntervalMs?: number
  sleepMs?: number
  timeoutMs?: number
}

interface PowerShellHoldProbeState {
  activeCount: number
  count: number
  queuedCount: number
  runningPids: number[]
  sleepMs: number
  timeoutMs: number
}

interface PowerShellConcurrencyProbeResult {
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
}

interface AITaskProgressProbeStepResult {
  monitorState: AIMonitorState
  task: AITask
}

interface AITaskProgressProbeResult {
  pid: number
  steps: AITaskProgressProbeStepResult[]
  taskId: string
}

interface CliChunkFeedForTestsInput {
  chunk: string
  instanceId?: string
  sessionId?: string
  strategy?: ParserStrategy
  stream?: CliOutputEvent['stream']
  tool?: CliOutputEvent['tool']
}

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

interface DevhubRuntimeTestHooks {
  buildGlobalTopologyFixtureForTests: (input: TopologyFixtureForTestsInput) => Promise<TopologyFixtureForTestsResult>
  disposeRuntimeForTests: () => Promise<MainProcessShutdownResult>
  driveAITaskProgressScenarioForTests: (options: {
    finalizeCompletedAfterMs?: number
    pid: number
    settleMs?: number
    states: AIMonitorState[]
  }) => Promise<AITaskProgressProbeResult>
  feedCliChunkForTests: (input: CliChunkFeedForTestsInput) => CliOutputEvent[]
  publishStatusAggregateNowForTests: () => Promise<StatusAggregatorPublishResult>
  setStatusAggregatorRunningForTests: (running: boolean) => boolean
  emitTaskCompleteNotificationForTests: (options: {
    alias?: string
    durationMs?: number
    pid?: number
    taskId?: string
    toolName?: string
    windowHwnd?: number
  }) => Promise<unknown>
  getDisposalRegistryState: () => {
    lastReport: DisposalReport | null
    remaining: string[]
  }
  listAliasesForTests: () => AIWindowAlias[]
  getScannerRegistrySnapshot: () => ScannerRegistrySnapshotRow[]
  scanWindowsIntoCacheForTests: () => Promise<{
    count: number
    data: WindowInfo[]
    error?: string
    success: boolean
  }>
  runPowerShellConcurrencyProbeForTests: (
    options?: PowerShellConcurrencyProbeOptions
  ) => Promise<PowerShellConcurrencyProbeResult>
  startPowerShellHoldProbeForTests: (
    options?: PowerShellConcurrencyProbeOptions
  ) => Promise<PowerShellHoldProbeState>
}

type DevhubGlobal = typeof globalThis & {
  __DEVHUB_TEST_HOOKS__?: DevhubRuntimeTestHooks
}

function isTopologyFixtureGraphKind(value: unknown): value is GraphKind {
  return value === 'network-topology' || value === 'neural-relationship' || value === 'flow'
}

function createTopologyFixtureProcessForTests(index: number): ProcessInfo {
  const pid = 70_000 + index
  const base: ProcessInfo = {
    pid,
    name: `spec24-proc-${index}`,
    command: '',
    cpu: index % 17,
    memory: 64 + (index % 31),
    status: 'running',
    startTime: index,
    type: 'other',
    workingDir: ''
  }
  return index === 0 ? base : { ...base, ppid: pid - 1 }
}

function createTopologyFixtureTaskForTests(index: number): AITask {
  return {
    id: `spec24-task-${index}`,
    toolType: 'codex',
    pid: 80_000 + index,
    startTime: index,
    status: { state: 'running', lastActivity: index },
    metrics: { cpuHistory: [], outputLineCount: index, lastOutputTime: index, idleDuration: 0 }
  }
}

function createTopologyFixtureSnapshotForTests(graphKind: GraphKind, nodeCount: number): ScannerCacheSnapshot {
  const timestamp = Date.now()
  const processes = graphKind === 'flow'
    ? []
    : Array.from(
      { length: graphKind === 'neural-relationship' ? nodeCount - 1 : nodeCount },
      (_, index) => createTopologyFixtureProcessForTests(index)
    )
  const aiTasks = graphKind === 'flow'
    ? Array.from({ length: nodeCount }, (_, index) => createTopologyFixtureTaskForTests(index))
    : []
  const ports: PortInfo[] = []
  const windows: WindowInfo[] = []
  return {
    processes: { data: processes, error: null, isScanning: false, lastUpdated: timestamp },
    ports: { data: ports, error: null, isScanning: false, lastUpdated: timestamp },
    windows: { data: windows, error: null, isScanning: false, lastUpdated: timestamp },
    aiTasks: { data: aiTasks, error: null, isScanning: false, lastUpdated: timestamp },
    systemSummary: {
      activePortCount: 0,
      aiToolCount: aiTasks.length,
      cpuTotal: processes.reduce((total, processInfo) => total + processInfo.cpu, 0),
      memoryUsedPercent: Math.round(processes.reduce((total, processInfo) => total + processInfo.memory, 0)),
      processCount: processes.length,
      windowCount: 0
    }
  }
}

async function buildGlobalTopologyFixtureForTests(input: TopologyFixtureForTestsInput): Promise<TopologyFixtureForTestsResult> {
  if (!isTopologyFixtureGraphKind(input.graphKind)) throw new Error('Invalid topology fixture graphKind')
  if (!Number.isInteger(input.nodeCount) || input.nodeCount < 2 || input.nodeCount > 800) throw new Error('Invalid topology fixture nodeCount')
  const graphService = new GraphService({
    getSnapshot: () => createTopologyFixtureSnapshotForTests(input.graphKind, input.nodeCount),
    getProjects: () => [],
    getUserDataRoot: () => app.getPath('userData')
  })
  const startedAt = Date.now()
  const snapshot = await graphService.buildGlobal({
    asOfTs: input.asOfTs ?? null,
    expandAll: input.expandAll ?? input.nodeCount > 500,
    graphKind: input.graphKind
  })
  return {
    asOfTs: snapshot.slice.asOfTs,
    degraded: snapshot.degraded,
    durationMs: Date.now() - startedAt,
    edgeCount: snapshot.edges.length,
    graphKind: snapshot.slice.graphKind,
    historicalNodeCount: snapshot.nodes.filter(node => node.signals?.state === 'historical').length,
    nodeCount: snapshot.nodes.length,
    requestedNodeCount: input.nodeCount,
    source: snapshot.source,
    warningCodes: snapshot.warnings.map(warning => warning.code)
  }
}

// 单实例锁：防止启动多个窗口
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

function isDevhubProtocolUri(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === `${DEVHUB_PROTOCOL_SCHEME}:`
  } catch {
    return false
  }
}

function extractDevhubProtocolUri(argv: readonly string[]): string | null {
  return argv.find(isDevhubProtocolUri) ?? null
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function emitDevhubProtocolUri(uri: string): void {
  if (!isDevhubProtocolUri(uri)) return
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingProtocolUris.push(uri)
    return
  }
  focusMainWindow()
  mainWindow.webContents.send('r8:command-event', { type: 'protocol-open', uri })
}

function flushPendingProtocolUris(): void {
  const queued = pendingProtocolUris.splice(0)
  for (const uri of queued) emitDevhubProtocolUri(uri)
}

// Initialize services
const appStore = new AppStore()
const processManager = new ProcessManager()
const toolMonitor = new ToolMonitor()
let metricsCollector: MetricsCollector | null = null

// Initialize background scanner infrastructure
const scannerCache = new ScannerCache()
const scannerPortScanner = new PortScanner()
const scannerProcessScanner = new SystemProcessScanner(scannerPortScanner)
const scannerWindowManager = new WindowManagerService()
const scannerAliasManager = new AIAliasManager()
const scannerAITaskTracker = new AITaskTracker(scannerProcessScanner, scannerAliasManager)

const scannerManager = new BackgroundScannerManager(scannerCache)
scannerManager.setScanners({
  processScanner: scannerProcessScanner,
  portScanner: scannerPortScanner,
  windowManager: scannerWindowManager,
  aiTaskTracker: scannerAITaskTracker
})

const scannerRegistry = getScannerRegistry()
scannerRegistry.register('scannerCache', scannerCache)
scannerRegistry.register('port', scannerPortScanner)
scannerRegistry.register('process', scannerProcessScanner)
scannerRegistry.register('window', scannerWindowManager)
scannerRegistry.register('aiTask', scannerAITaskTracker)
scannerRegistry.register('toolMonitor', toolMonitor)
scannerRegistry.register('backgroundScannerManager', scannerManager)

const disposalRegistry = getDisposalRegistry()
disposalRegistry.register({
  name: 'background-scanner-manager',
  dispose: () => {
    scannerManager.stopAll()
  }
})
disposalRegistry.register({
  name: 'tool-monitor',
  dispose: () => {
    toolMonitor.stop()
  }
})
disposalRegistry.register({
  name: 'ai-task-tracker',
  dispose: () => {
    scannerAITaskTracker.cleanup()
  }
})
disposalRegistry.register({
  name: 'process-scanner',
  dispose: () => {
    scannerProcessScanner.cleanup()
  }
})
disposalRegistry.register({
  name: 'window-manager',
  dispose: () => {
    scannerWindowManager.cleanup()
  }
})
disposalRegistry.register({
  name: 'scanner-cache',
  dispose: () => {
    scannerCache.cleanup()
  }
})
disposalRegistry.register({
  name: 'process-manager',
  dispose: () => processManager.stopAll()
})
disposalRegistry.register({
  name: 'ipc-handlers',
  dispose: () => cleanupIpcHandlers()
})

const shouldExposeRuntimeTestHooks = !app.isPackaged
  || process.env.ENABLE_DEV_OBS === '1'
  || process.argv.includes('--enable-dev-obs')

async function disposeMainProcessRuntime(): Promise<MainProcessShutdownResult> {
  // 停止新的观测写入，再执行统一 disposal 链，避免退出阶段继续产生噪音。
  setRateLimitObserver(null)
  metricsCollector?.stop()
  metricsCollector = null

  // Keep app quit bounded even when Windows process tools stall behind scanner cleanup.
  const report = await disposalRegistry.disposeAll(1000)
  console.warn('Main process disposal report:', report)

  const killedChildren = await shutdownPowerShellGateway()
  if (killedChildren > 0) {
    console.warn(`Main process shutdown reclaimed ${killedChildren} PowerShell child process(es)`)
  }

  return {
    killedChildren,
    report
  }
}

async function runPowerShellConcurrencyProbeForTests(
  options: PowerShellConcurrencyProbeOptions = {}
): Promise<PowerShellConcurrencyProbeResult> {
  const count = Math.max(1, Math.trunc(options.count ?? 10))
  const sleepMs = Math.max(100, Math.trunc(options.sleepMs ?? 400))
  const timeoutMs = Math.max(sleepMs + 1000, Math.trunc(options.timeoutMs ?? sleepMs + 3000))
  const sampleIntervalMs = Math.max(10, Math.trunc(options.sampleIntervalMs ?? 25))
  const gateway = getPowerShellGateway()
  const baselineStats = gateway.getStats()
  let maxActiveCount = 0
  let maxQueuedCount = 0
  let maxRunningPids = 0
  let sampleCount = 0

  const sample = (): void => {
    const stats = gateway.getStats()
    maxActiveCount = Math.max(maxActiveCount, stats.activeCount)
    maxQueuedCount = Math.max(maxQueuedCount, stats.queuedCount)
    maxRunningPids = Math.max(maxRunningPids, stats.runningPids.length)
    sampleCount += 1
  }

  sample()

  const sampler = setInterval(sample, sampleIntervalMs)
  sampler.unref?.()
  const startedAt = Date.now()

  try {
    const probeTasks = Array.from({ length: count }, (_, index) =>
      gateway.execute(
        `Start-Sleep -Milliseconds ${sleepMs}; Write-Output "probe-${index}"`,
        {
          killOnTimeout: true,
          label: `probe-${index}`,
          timeoutMs
        }
      )
    )

    const settled = await Promise.allSettled(probeTasks)
    sample()

    const finalStats = gateway.getStats()
    const fulfilledCount = settled.filter((result) => result.status === 'fulfilled').length
    const rejectedCount = settled.length - fulfilledCount

    return {
      abortedCount: Math.max(0, finalStats.abortedCount - baselineStats.abortedCount),
      completedCount: Math.max(0, finalStats.completedCount - baselineStats.completedCount),
      count,
      durationMs: Date.now() - startedAt,
      failedCount: Math.max(0, finalStats.failedCount - baselineStats.failedCount),
      finalActiveCount: finalStats.activeCount,
      finalQueuedCount: finalStats.queuedCount,
      fulfilledCount,
      maxActiveCount,
      maxQueuedCount,
      maxRunningPids,
      rejectedCount,
      sampleCount,
      sleepMs,
      timedOutCount: Math.max(0, finalStats.timedOutCount - baselineStats.timedOutCount),
      timeoutMs
    }
  } finally {
    clearInterval(sampler)
  }
}

async function startPowerShellHoldProbeForTests(
  options: PowerShellConcurrencyProbeOptions = {}
): Promise<PowerShellHoldProbeState> {
  const count = Math.max(1, Math.trunc(options.count ?? 4))
  const sleepMs = Math.max(250, Math.trunc(options.sleepMs ?? 8000))
  const timeoutMs = Math.max(sleepMs + 1000, Math.trunc(options.timeoutMs ?? sleepMs + 4000))
  const gateway = getPowerShellGateway()

  const probeTasks = Array.from({ length: count }, (_, index) =>
    gateway.execute(
      `Start-Sleep -Milliseconds ${sleepMs}; Write-Output "hold-${index}"`,
      {
        killOnTimeout: true,
        label: `hold-${index}`,
        timeoutMs
      }
    )
  )

  void Promise.allSettled(probeTasks)

  const deadline = Date.now() + 1500
  while (Date.now() < deadline) {
    const stats = gateway.getStats()
    if (stats.activeCount > 0 || stats.queuedCount > 0) {
      return {
        activeCount: stats.activeCount,
        count,
        queuedCount: stats.queuedCount,
        runningPids: [...stats.runningPids],
        sleepMs,
        timeoutMs
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  const stats = gateway.getStats()
  return {
    activeCount: stats.activeCount,
    count,
    queuedCount: stats.queuedCount,
    runningPids: [...stats.runningPids],
    sleepMs,
    timeoutMs
  }
}

if (shouldExposeRuntimeTestHooks) {
  ;(globalThis as DevhubGlobal).__DEVHUB_TEST_HOOKS__ = {
    buildGlobalTopologyFixtureForTests,
    disposeRuntimeForTests: () => disposeMainProcessRuntime(),
    driveAITaskProgressScenarioForTests: async (options) => {
      await scannerAITaskTracker.scanForAITasks()
      const target = scannerAITaskTracker.getActiveTasks().find((task) => task.pid === options.pid)
      if (!target) {
        throw new Error('AI progress probe target PID was not detected by AITaskTracker: ' + options.pid)
      }

      const steps: AITaskProgressProbeStepResult[] = []
      const settleMs = Math.min(Math.max(Math.trunc(options.settleMs ?? 80), 0), 1000)
      for (const monitorState of options.states) {
        const task = scannerAITaskTracker.applyProgressProbeStateForTests({
          detail: 'P4.2-d/P5.1 probe: ' + monitorState,
          finalizeAfterMs: monitorState === 'completed' ? options.finalizeCompletedAfterMs : undefined,
          monitorState,
          taskId: target.id
        })
        if (!task) {
          throw new Error('AI progress probe task disappeared before state ' + monitorState)
        }
        steps.push({ monitorState, task })
        if (settleMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, settleMs))
        }
      }

      return { pid: target.pid, steps, taskId: target.id }
    },
    emitTaskCompleteNotificationForTests: async (options) => {
      const notificationService = getNotificationService()
      notificationService.notifyTaskComplete(
        options.toolName ?? 'Claude Code',
        options.durationMs ?? 120_000,
        options.alias,
        options.taskId,
        options.windowHwnd,
        options.pid
      )
      return notificationService.getHistory(1)[0] ?? null
    },
    feedCliChunkForTests: (input) => {
      const service = getR8RuntimeServiceForTests()
      if (!service) {
        throw new Error('R8 runtime service is not initialized')
      }
      return service.parseCliChunk(input)
    },
    publishStatusAggregateNowForTests: async () => {
      const service = getR8RuntimeServiceForTests()
      if (!service) {
        throw new Error('R8 runtime service is not initialized')
      }
      return new Promise<StatusAggregatorPublishResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          void service.publishStatusAggregateNow().then(resolve, reject)
        }, 0)
        timer.unref?.()
      })
    },
    setStatusAggregatorRunningForTests: (running) => {
      const service = getR8RuntimeServiceForTests()
      if (!service) {
        throw new Error('R8 runtime service is not initialized')
      }
      if (running) {
        service.startStatusAggregator()
      } else {
        service.stopStatusAggregator()
      }
      return running
    },
    getDisposalRegistryState: () => ({
      lastReport: disposalRegistry.getLastReport(),
      remaining: disposalRegistry.remaining()
    }),
    listAliasesForTests: () => scannerAliasManager.getAll(),
    getScannerRegistrySnapshot: () => scannerRegistry.snapshot(),
    scanWindowsIntoCacheForTests: async () => {
      const result = await scannerWindowManager.scanWindows(false)
      if (result.success && result.data) {
        scannerCache.updateWindows(result.data)
      }
      return {
        count: result.data?.length ?? 0,
        data: result.data ?? [],
        error: result.error,
        success: result.success
      }
    },
    startPowerShellHoldProbeForTests: (options) =>
      startPowerShellHoldProbeForTests(options),
    runPowerShellConcurrencyProbeForTests: (options) =>
      runPowerShellConcurrencyProbeForTests(options)
  }
}

// ============ Splash Window ============

function sendSplashProgress(percent: number, text: string): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:progress', { percent, text })
  }
}

function createSplashWindow(): void {
  const splashPreloadPath = join(__dirname, '../../resources/splash-preload.js')
  const splashHtmlPath = join(__dirname, '../../resources/splash.html')

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: splashPreloadPath
    }
  })

  splashWindow.loadFile(splashHtmlPath)
  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
  })
}

function closeSplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:fadeOut')
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy()
      }
      splashWindow = null
    }, 250)
  }
}

// ============ Main Window ============

function createWindow(): void {
  const preloadPath = join(__dirname, '../preload/index.cjs')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false, // Custom title bar
    backgroundColor: '#1A1A1A',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Note: show is handled by the splash→main transition in app.whenReady()
  // mainWindow.show() is called after splash closes

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        shell.openExternal(details.url)
      }
    } catch {
      // Invalid URL, ignore
    }
    return { action: 'deny' }
  })

  // Prevent navigation to untrusted origins
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow dev server in development
    if (is.dev && (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'))) {
      return
    }
    // Allow file:// for production
    if (url.startsWith('file://')) {
      return
    }
    event.preventDefault()
  })

  let revealScheduled = false
  const revealMainWindow = (): void => {
    if (revealScheduled) return
    revealScheduled = true
    sendSplashProgress(100, 'Ready')
    // Small delay so the user sees "Ready" before transition
    setTimeout(() => {
      closeSplashWindow()
      mainWindow?.show()
    }, 300)
  }

  mainWindow.once('ready-to-show', revealMainWindow)
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!mainWindow?.isVisible()) {
        revealMainWindow()
      }
    }, 300)
  })

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 窗口关闭行为 - 直接关闭，不最小化到托盘
  mainWindow.on('close', () => {
    const currentSettings = appStore.getSettings()
    if (currentSettings.window.saveLayoutOnExit && !mainWindow!.isMinimized()) {
      const bounds = mainWindow!.getBounds()
      // Persist bounds so next launch can restore window position/size
      appStore.saveBounds(bounds)
    }
  })
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 DevHub',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('DevHub - 开发项目管理器')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// 第二实例尝试启动时聚焦已有窗口，并接收 devhub:// 外部 URI
app.on('second-instance', (_event, argv) => {
  const uri = extractDevhubProtocolUri(argv)
  if (uri) {
    emitDevhubProtocolUri(uri)
    return
  }
  focusMainWindow()
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  emitDevhubProtocolUri(url)
})

// App lifecycle
app.whenReady().then(async () => {
  // Set app user model id for windows notifications
  electronApp.setAppUserModelId('com.devhub.app')

  // Stage 1: Show splash immediately
  createSplashWindow()
  sendSplashProgress(10, 'Initializing application...')

  // Optimize shortcuts
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Set Content Security Policy headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = is.dev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  // Stage 2: Load configuration
  sendSplashProgress(25, 'Loading configuration...')
  const settings = appStore.getSettings()

  // Stage 3: Create main window (hidden) and init scanners
  sendSplashProgress(40, 'Starting scan engine...')
  createWindow()
  metricsCollector = new MetricsCollector({
    getMainWindow: () => mainWindow,
    scannerManager
  })
  setRateLimitObserver((channel) => metricsCollector?.trackIpcChannel(channel))
  metricsCollector.start()

  // Only create tray if minimizeToTray is enabled
  if (settings.advanced.minimizeToTray) {
    createTray()
  }

  // Register IPC handlers AFTER window is created
  scannerManager.setMainWindowGetter(() => mainWindow)
  registerIpcHandlers(
    appStore,
    processManager,
    toolMonitor,
    () => mainWindow,
    scannerManager,
    {
      processScanner: scannerProcessScanner,
      portScanner: scannerPortScanner,
      windowManager: scannerWindowManager,
      aiTaskTracker: scannerAITaskTracker,
      aliasManager: scannerAliasManager,
      metricsCollector: metricsCollector ?? undefined,
      scannerCache
    }
  )
  mainWindow?.webContents.once('did-finish-load', () => {
    setTimeout(flushPendingProtocolUris, 250)
  })
  flushPendingProtocolUris()

  // Wire up splash progress reporting from scanner manager (MUST be before startAll)
  scannerManager.onProgress((_stage: string, percent: number, text: string) => {
    sendSplashProgress(percent, text)
  })

  // Start background scanners (non-blocking) — onProgress registered above before this call
  scannerManager.startAll().catch((err) => {
    console.error('Failed to start background scanners:', err)
  })

  // Auto-discover projects on first launch
  if (appStore.getProjects().length === 0 && !settings.firstLaunchDone) {
    const projectScanner = new ProjectScanner()
    mainWindow!.webContents.once('did-finish-load', () => {
      // 延迟发送，确保 React useEffect listener 已挂载
      setTimeout(() => {
        projectScanner.scanCommonLocations(settings.scan.scanDrives).then((results) => {
          if (results.length > 0 && mainWindow) {
            mainWindow.webContents.send('projects:auto-discovered', results)
          }
          appStore.updateSettings({ firstLaunchDone: true })
        }).catch((err) => {
          console.error('Auto-discovery failed:', err)
          appStore.updateSettings({ firstLaunchDone: true })
        })
      }, 1000)
    })
  }

  if (settings.notification.enabled) {
    toolMonitor.start(appStore.getTools(), settings.scan.checkInterval, (tool) => {
      // 通过 NotificationService 发送通知（自动去重，与 AITaskTracker 协调）
      const notificationService = getNotificationService()
      notificationService.notify(
        'task-complete',
        'DevHub',
        `${tool.displayName} 任务已完成`,
        {
          icon: join(__dirname, '../../resources/icon.png'),
          dedupKey: `task-complete:${tool.displayName}`
        }
      )

      // Notify renderer
      mainWindow?.webContents.send('tool:complete', tool)
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up on quit
let isQuitting = false
app.on('before-quit', (event) => {
  if (isQuitting) return
  isQuitting = true
  event.preventDefault()

  const forceExitTimer = setTimeout(() => {
    console.error('Main process shutdown exceeded force-exit timeout')
    app.exit(0)
  }, 6000)
  forceExitTimer.unref?.()

  void disposeMainProcessRuntime()
    .catch((error) => {
      console.error('Main process shutdown failed:', error)
    })
    .finally(() => {
      clearTimeout(forceExitTimer)
      app.exit(0)
    })
})
