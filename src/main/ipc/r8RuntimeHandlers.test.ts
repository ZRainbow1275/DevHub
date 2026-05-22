import { beforeEach, describe, expect, it, vi } from 'vitest'
import { R8_IPC_CHANNELS } from '@shared/schemas/r8-runtime'
import { resetRateLimits } from '../utils/rateLimiter'

const { ipcMainMock } = vi.hoisted(() => ({
  ipcMainMock: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => process.cwd())
  },
  ipcMain: ipcMainMock,
  nativeTheme: {
    shouldUseHighContrastColors: false
  },
  systemPreferences: {
    getAnimationSettings: vi.fn(() => ({ prefersReducedMotion: false }))
  }
}))

vi.mock('electron-store', () => {
  class MemoryStore<T extends Record<string, unknown>> {
    private data: T

    constructor(options: { defaults?: T } = {}) {
      this.data = { ...(options.defaults ?? {}) } as T
    }

    get<K extends keyof T>(key: K, fallback?: T[K]): T[K] {
      return this.data[key] ?? (fallback as T[K])
    }

    set<K extends keyof T>(key: K, value: T[K]): void {
      this.data[key] = value
    }
  }

  return { default: MemoryStore }
})

import { cleanupA11yHandlers, setupA11yHandlers } from './a11yHandlers'
import { cleanupProcessHandlers, setupProcessHandlers } from './processHandlers'
import { cleanupR8RuntimeHandlers, setupR8RuntimeHandlers } from './r8RuntimeHandlers'
import { cleanupWindowHandlers, setupWindowHandlers } from './windowHandlers'

function makeContractOnlyService() {
  return {
    invokeContractOnlyChannel: vi.fn(input => ({
      success: false,
      status: 'contract-only',
      code: 'E_R8_CONTRACT_ONLY',
      channel: input.channel,
      executable: false,
      checkedAt: 1,
      message: 'contract-only'
    }))
  }
}

function makeA11yService() {
  return {
    getPrefs: vi.fn(() => ({})),
    setPrefs: vi.fn((input: unknown) => input),
    getOsPrefs: vi.fn(() => ({ reducedMotion: false, highContrast: false, forcedColors: false })),
    runSelfCheck: vi.fn(() => ({
      ts: 1,
      axeExecuted: false,
      axeTarget: null,
      axeViolations: [],
      contrastFailures: [],
      keyboardUnreachable: [],
      warnings: [],
      passed: false
    }))
  }
}

function makeProcessScanner() {
  return {
    onUpdate: vi.fn(),
    onZombieDetected: vi.fn(),
    stopAutoRefresh: vi.fn()
  }
}

function makeMainWindow() {
  return {
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn() }
  }
}

function makeWindowRuntime() {
  return {
    windowManager: {
      scanWindows: vi.fn().mockResolvedValue({ success: true, data: [] }),
      focusWindow: vi.fn(),
      minimizeWindow: vi.fn(),
      restoreWindow: vi.fn(),
      closeWindow: vi.fn(),
      setWindowTopmost: vi.fn(),
      screenshotWindow: vi.fn(),
      setWindowTitle: vi.fn(),
      sendKeysToWindow: vi.fn(),
      sendTextToWindow: vi.fn()
    }
  }
}

function registerAllR8IpcOwners(): void {
  setupR8RuntimeHandlers(makeContractOnlyService() as never)
  setupA11yHandlers(makeA11yService() as never)
  setupProcessHandlers(
    { webContents: { send: vi.fn() } } as never,
    { getProjects: vi.fn(() => []) } as never,
    { processScanner: makeProcessScanner(), portScanner: {} } as never
  )
  setupWindowHandlers(makeMainWindow() as never, makeWindowRuntime() as never)
}

describe('r8RuntimeHandlers', () => {
  beforeEach(() => {
    cleanupA11yHandlers()
    cleanupProcessHandlers()
    cleanupWindowHandlers()
    cleanupR8RuntimeHandlers()
    vi.clearAllMocks()
    resetRateLimits()
  })

  it('registers a handler for every R8 IPC contract channel', () => {
    registerAllR8IpcOwners()

    const expected = R8_IPC_CHANNELS.map(definition => definition.channel)
    const expectedSet = new Set(expected)
    const r8Registrations = ipcMainMock.handle.mock.calls
      .map(([channel]) => String(channel))
      .filter(channel => expectedSet.has(channel))
    const registered = new Set(r8Registrations)
    const missing = expected.filter(channel => !registered.has(channel))
    const duplicates = r8Registrations.filter((channel, index) => r8Registrations.indexOf(channel) !== index)

    expect(missing).toEqual([])
    expect(duplicates).toEqual([])
    expect(r8Registrations).toHaveLength(expected.length)
  })

  it('routes contract-only fallback channels through the runtime service', () => {
    const invokeContractOnlyChannel = vi.fn(input => ({ success: false, status: 'contract-only', code: 'E_R8_CONTRACT_ONLY', channel: input.channel, executable: false, checkedAt: 1, message: 'contract-only' }))
    const service = { invokeContractOnlyChannel } as never

    setupR8RuntimeHandlers(service)

    const handler = ipcMainMock.handle.mock.calls.find(([channel]) => channel === 'audit:query')?.[1]
    expect(handler).toBeTypeOf('function')

    handler({}, { confirmedBy: 'vitest', token: 'secret-value' })

    expect(invokeContractOnlyChannel).toHaveBeenCalledWith({
      channel: 'audit:query',
      payload: { confirmedBy: 'vitest', token: 'secret-value' },
      confirmedBy: 'vitest'
    })
  })

  it('routes statusbar config channels through executable handlers before contract-only fallback', async () => {
    const invokeContractOnlyChannel = vi.fn()
    const statusAggregate = vi.fn(() => ({ generatedAt: 1, tiles: [], badges: [], refreshIntervalMs: 1000 }))
    const getStatusbarConfig = vi.fn(() => ({ tiles: [], updatedAt: 1 }))
    const setStatusbarConfig = vi.fn((input: unknown) => input)
    const resetStatusbarConfig = vi.fn(() => ({ tiles: [], updatedAt: 2 }))
    const startTopologySnapshotter = vi.fn()
    const service = {
      invokeContractOnlyChannel,
      statusAggregate,
      getStatusbarConfig,
      setStatusbarConfig,
      resetStatusbarConfig,
      startStatusAggregator: vi.fn(),
      startTopologySnapshotter,
      dispose: vi.fn()
    } as never

    setupR8RuntimeHandlers(service)

    const handlerFor = (channel: string) => {
      const handler = ipcMainMock.handle.mock.calls.find(([candidate]) => candidate === channel)?.[1]
      if (typeof handler !== 'function') throw new Error(`Missing handler for ${channel}`)
      return handler
    }
    const statusHandler = handlerFor('status:aggregate')
    const getConfigHandler = handlerFor('statusbar:get-config')
    const setConfigHandler = handlerFor('statusbar:set-config')
    const resetHandler = handlerFor('statusbar:reset')

    expect(statusHandler).toBeTypeOf('function')
    expect(getConfigHandler).toBeTypeOf('function')
    expect(setConfigHandler).toBeTypeOf('function')
    expect(resetHandler).toBeTypeOf('function')

    await statusHandler({}, undefined)
    await getConfigHandler({}, undefined)
    await setConfigHandler({}, {
      tiles: [{
        id: 'cpu',
        label: 'CPU',
        value: 1,
        tone: 'neutral',
        source: 'vitest',
        updatedAt: 1,
        visible: true,
        order: 0,
        align: 'left'
      }],
      updatedAt: 1
    })
    await resetHandler({}, { confirmedBy: 'vitest' })

    expect(statusAggregate).toHaveBeenCalledTimes(1)
    expect(getStatusbarConfig).toHaveBeenCalledTimes(1)
    expect(setStatusbarConfig).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: 1 }))
    expect(resetStatusbarConfig).toHaveBeenCalledWith({ confirmedBy: 'vitest' })
    expect(startTopologySnapshotter).toHaveBeenCalledTimes(1)
    expect(invokeContractOnlyChannel).not.toHaveBeenCalled()
  })

  it('routes theme decoration custom SVG and sound channels through executable handlers', async () => {
    const invokeContractOnlyChannel = vi.fn()
    const listThemeDecorations = vi.fn(() => ({ kinds: ['none'], customSvgs: [] }))
    const setThemeDecorationConfig = vi.fn((input: unknown) => input)
    const uploadCustomSvg = vi.fn((input: unknown) => ({ id: '7b83d3ab-a9f0-4d96-95f6-2b1548ebd52a', sanitizedContent: '<svg></svg>', entry: { id: '7b83d3ab-a9f0-4d96-95f6-2b1548ebd52a', name: 'safe.svg', sanitizedContent: '<svg></svg>', uploadedAt: 1, size: 11, hash: 'a'.repeat(64) }, input }))
    const listCustomSvgs = vi.fn(() => ({ items: [] }))
    const removeCustomSvg = vi.fn((input: unknown) => ({ success: true, removed: 1, remaining: 0, input }))
    const setThemeSoundConfig = vi.fn((input: unknown) => ({ success: true, config: input }))
    const getThemeSoundConfig = vi.fn((input: { themeId: string }) => ({ themeId: input.themeId, enabled: false, volume: 0.3, events: {} }))
    const service = {
      invokeContractOnlyChannel,
      listThemeDecorations,
      setThemeDecorationConfig,
      uploadCustomSvg,
      listCustomSvgs,
      removeCustomSvg,
      setThemeSoundConfig,
      getThemeSoundConfig
    } as never

    setupR8RuntimeHandlers(service)

    const handlerFor = (channel: string) => {
      const handler = ipcMainMock.handle.mock.calls.find(([candidate]) => candidate === channel)?.[1]
      if (typeof handler !== 'function') throw new Error(`Missing handler for ${channel}`)
      return handler
    }

    await handlerFor('theme:decoration-list')({}, undefined)
    await handlerFor('theme:decoration-set')({}, { kind: 'grid', opacity: 0.2, positions: ['global-background'], blendMode: 'normal', scale: 1, motionRespect: true })
    await handlerFor('theme:custom-svg-upload')({}, { name: 'safe.svg', content: '<svg></svg>', confirmedBy: 'vitest' })
    await handlerFor('theme:custom-svg-list')({}, undefined)
    await handlerFor('theme:custom-svg-remove')({}, { id: '7b83d3ab-a9f0-4d96-95f6-2b1548ebd52a', confirmedBy: 'vitest' })
    await handlerFor('theme:sound-config')({}, { themeId: 'cyberpunk', enabled: true, volume: 0.3, events: { hover: 'file:///hover.mp3' } })
    await handlerFor('theme:sound-config-get')({}, { themeId: 'cyberpunk' })

    expect(listThemeDecorations).toHaveBeenCalledTimes(1)
    expect(setThemeDecorationConfig).toHaveBeenCalledWith(expect.objectContaining({ kind: 'grid' }))
    expect(uploadCustomSvg).toHaveBeenCalledWith(expect.objectContaining({ name: 'safe.svg' }))
    expect(listCustomSvgs).toHaveBeenCalledTimes(1)
    expect(removeCustomSvg).toHaveBeenCalledWith(expect.objectContaining({ confirmedBy: 'vitest' }))
    expect(setThemeSoundConfig).toHaveBeenCalledWith(expect.objectContaining({ themeId: 'cyberpunk' }))
    expect(getThemeSoundConfig).toHaveBeenCalledWith({ themeId: 'cyberpunk' })
    expect(invokeContractOnlyChannel).not.toHaveBeenCalled()
  })

  it('routes R8.B drawer channels through executable handlers', async () => {
    const getDrawerState = vi.fn(() => [])
    const setDrawerState = vi.fn((input: unknown) => input)
    const saveDrawerLayout = vi.fn((input: { name: string }) => ({ name: input.name, states: [], savedAt: 1 }))
    const loadDrawerLayout = vi.fn((input: { name: string }) => ({ name: input.name, states: [], savedAt: 1 }))
    const listDrawerLayouts = vi.fn(() => [])
    const morphDrawerToPopout = vi.fn(async () => ({ popoutId: 'popout-drawer' }))
    const morphPopoutToDrawer = vi.fn(() => ({ drawerState: { slot: 'bottom', open: true, contentId: 'observability', updatedAt: 1 } }))
    const service = { getDrawerState, setDrawerState, saveDrawerLayout, loadDrawerLayout, listDrawerLayouts, morphDrawerToPopout, morphPopoutToDrawer } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    handler('drawer:get-state')?.({})
    handler('drawer:set-state')?.({}, { slot: 'right', open: true })
    handler('drawer:save-layout')?.({}, { name: 'debug' })
    handler('drawer:load-layout')?.({}, { name: 'debug' })
    handler('drawer:list-layouts')?.({})
    await handler('drawer:morph-to-popout')?.({}, { slot: 'right', contentId: 'monitor.port-detail' })
    handler('drawer:morph-from-popout')?.({}, { popoutId: 'popout-drawer', slot: 'bottom' })

    expect(getDrawerState).toHaveBeenCalledTimes(1)
    expect(setDrawerState).toHaveBeenCalledWith({ slot: 'right', open: true })
    expect(saveDrawerLayout).toHaveBeenCalledWith({ name: 'debug' })
    expect(loadDrawerLayout).toHaveBeenCalledWith({ name: 'debug' })
    expect(listDrawerLayouts).toHaveBeenCalledTimes(1)
    expect(morphDrawerToPopout).toHaveBeenCalledWith({ slot: 'right', contentId: 'monitor.port-detail' })
    expect(morphPopoutToDrawer).toHaveBeenCalledWith({ popoutId: 'popout-drawer', slot: 'bottom' })
  })

  it('routes command URI resolution through an executable handler', () => {
    const resolveCommandUri = vi.fn((input: unknown) => ({ resolved: input }))
    const service = { resolveCommandUri } as never

    setupR8RuntimeHandlers(service)

    const handler = ipcMainMock.handle.mock.calls.find(([registered]) => registered === 'command:resolve-uri')?.[1]
    handler?.({}, { uri: 'devhub://port/3000' })

    expect(resolveCommandUri).toHaveBeenCalledWith({ uri: 'devhub://port/3000' })
  })

  it('routes OS protocol registration through an executable command handler', () => {
    const registerOsProtocol = vi.fn((input: unknown) => ({ success: true, registered: true, input }))
    const service = { registerOsProtocol } as never

    setupR8RuntimeHandlers(service)

    const handler = ipcMainMock.handle.mock.calls.find(([registered]) => registered === 'command:register-os-protocol')?.[1]
    handler?.({}, { register: true, confirmedBy: 'vitest' })

    expect(registerOsProtocol).toHaveBeenCalledWith({ register: true, confirmedBy: 'vitest' })
  })

  it('routes dashboard layout and widget morph channels through executable handlers', () => {
    const getDashboardLayout = vi.fn((input: unknown) => ({ layout: input }))
    const saveDashboardLayout = vi.fn((input: unknown) => ({ success: true, layout: input }))
    const listDashboardPresets = vi.fn(() => ({ names: ['default'] }))
    const deleteDashboardPreset = vi.fn((input: unknown) => ({ success: true, input }))
    const resetDashboardLayout = vi.fn((input: unknown) => ({ layout: input }))
    const morphDashboardWidgetToDrawer = vi.fn((input: unknown) => ({ drawerState: {}, layout: input }))
    const service = {
      getDashboardLayout,
      saveDashboardLayout,
      listDashboardPresets,
      deleteDashboardPreset,
      resetDashboardLayout,
      morphDashboardWidgetToDrawer
    } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    handler('dashboard:get-layout')?.({}, { name: 'default' })
    handler('dashboard:save-layout')?.({}, { name: 'default', layouts: { xs: [], sm: [], md: [], lg: [], xl: [] } })
    handler('dashboard:list-presets')?.({})
    handler('dashboard:delete-preset')?.({}, { name: 'debug', confirmedBy: 'vitest' })
    handler('dashboard:reset')?.({}, { preset: 'minimal', confirmedBy: 'vitest' })
    handler('dashboard:morph-widget-to-drawer')?.({}, { widgetInstanceId: 'widget-process-summary', slot: 'right' })

    expect(getDashboardLayout).toHaveBeenCalledWith({ name: 'default' })
    expect(saveDashboardLayout).toHaveBeenCalledWith({ name: 'default', layouts: { xs: [], sm: [], md: [], lg: [], xl: [] } })
    expect(listDashboardPresets).toHaveBeenCalledTimes(1)
    expect(deleteDashboardPreset).toHaveBeenCalledWith({ name: 'debug', confirmedBy: 'vitest' })
    expect(resetDashboardLayout).toHaveBeenCalledWith({ preset: 'minimal', confirmedBy: 'vitest' })
    expect(morphDashboardWidgetToDrawer).toHaveBeenCalledWith({ widgetInstanceId: 'widget-process-summary', slot: 'right' })
  })

  it('routes process tree and treemap channels through executable handlers', () => {
    const processTree = vi.fn((input: unknown) => ({ tree: input }))
    const processTreeChildren = vi.fn((input: unknown) => ({ children: [input] }))
    const processTreemapData = vi.fn((input: unknown) => ({ nodes: [], totalRss: 0, width: 960, height: 540, groupBy: 'parent', colorBy: 'exe', input }))
    const setProcessViewMode = vi.fn((input: unknown) => ({ success: true, input }))
    const service = { processTree, processTreeChildren, processTreemapData, setProcessViewMode } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    handler('process:tree')?.({}, { maxDepth: 3 })
    handler('process:tree-children')?.({}, { pid: 100 })
    handler('process:treemap-data')?.({}, { groupBy: 'parent', colorBy: 'rss', width: 800, height: 400 })
    handler('process:view-mode-set')?.({}, { mode: 'treemap' })

    expect(processTree).toHaveBeenCalledWith({ maxDepth: 3 })
    expect(processTreeChildren).toHaveBeenCalledWith({ pid: 100 })
    expect(processTreemapData).toHaveBeenCalledWith({ groupBy: 'parent', colorBy: 'rss', width: 800, height: 400 })
    expect(setProcessViewMode).toHaveBeenCalledWith({ mode: 'treemap' })
  })

  it('routes DAG build, cycle, export, layer, and ready channels through executable handlers', () => {
    const buildDag = vi.fn(() => ({ sessionId: 'dag-ipc', layers: [['A']] }))
    const detectDagCycle = vi.fn(() => ({ hasCycle: false, cycles: [] }))
    const exportDag = vi.fn(() => ({ content: 'graph TD', mimeType: 'text/vnd.mermaid' }))
    const dagLayer = vi.fn(() => ({ taskIds: ['A'] }))
    const checkDagReady = vi.fn(() => ({ ready: true, blockers: [] }))
    const service = { buildDag, detectDagCycle, exportDag, dagLayer, checkDagReady } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    handler('dag:build')?.({}, { rows: [{ taskId: 'A' }] })
    handler('dag:detect-cycle')?.({}, { rows: [{ taskId: 'A' }] })
    handler('dag:export')?.({}, { sessionId: 'dag-ipc', format: 'mermaid' })
    handler('dag:layer')?.({}, { sessionId: 'dag-ipc', layerIndex: 0 })
    handler('dag:check-ready')?.({}, { sessionId: 'dag-ipc', taskId: 'A' })

    expect(buildDag).toHaveBeenCalledWith({ rows: [{ taskId: 'A' }] })
    expect(detectDagCycle).toHaveBeenCalledWith({ rows: [{ taskId: 'A' }] })
    expect(exportDag).toHaveBeenCalledWith({ sessionId: 'dag-ipc', format: 'mermaid' })
    expect(dagLayer).toHaveBeenCalledWith({ sessionId: 'dag-ipc', layerIndex: 0 })
    expect(checkDagReady).toHaveBeenCalledWith({ sessionId: 'dag-ipc', taskId: 'A' })
  })


  it('routes R8.C spec-36..39 resilience channels through executable handlers', async () => {
    const previewDiagnosticPack = vi.fn(async () => ({ sections: [], totalEstimatedSize: 0 }))
    const listDiagnosticRedactionRules = vi.fn(() => ({ defaults: [], custom: [] }))
    const captureDiagnosticScreenshot = vi.fn(async () => ({ success: false, mode: 'main-window', sizeBytes: 0, warning: 'no window', capturedAt: 1 }))
    const listDiagnosticPacks = vi.fn(() => ({ packs: [] }))
    const requestPermission = vi.fn(() => ({ grantId: '11111111-1111-4111-8111-111111111111' }))
    const checkPermission = vi.fn(() => ({ granted: true, reason: 'active' }))
    const revokePermissionGrant = vi.fn(() => ({ success: true, revokedCount: 1 }))
    const revokeAllPermissionGrants = vi.fn(() => ({ success: true, revokedCount: 1 }))
    const listActivePermissionGrants = vi.fn(() => [])
    const configurePermissionPolicy = vi.fn(() => ({ success: true }))
    const permissionExpiryStreamPayload = vi.fn(() => ({ grants: [], emittedAt: 1 }))
    const cloudSyncStatus = vi.fn(() => ({ enabled: false, errorCode: 'E_FEATURE_DEFERRED' }))
    const triggerCloudSync = vi.fn(() => ({ success: false, errorCode: 'E_FEATURE_DEFERRED', scheduledRelease: 'R9', enabled: false }))
    const listRemoteCloudSkills = vi.fn(() => ({ skills: [], notice: 'feature deferred to R9' }))
    const ocrCapabilities = vi.fn(() => ({ enabled: false, reason: 'NO-OCR-INTEGRATION constraint', futureRelease: null }))
    const recognizeOcr = vi.fn(() => ({ success: false, code: 'E_OCR_DISABLED', errorCode: 'E_OCR_DISABLED', blocks: [] }))
    const listOcrSupportedLanguages = vi.fn(() => ({ languages: [], notice: 'OCR disabled', enabled: false }))
    const service = {
      previewDiagnosticPack,
      listDiagnosticRedactionRules,
      captureDiagnosticScreenshot,
      listDiagnosticPacks,
      requestPermission,
      checkPermission,
      revokePermissionGrant,
      revokeAllPermissionGrants,
      listActivePermissionGrants,
      configurePermissionPolicy,
      permissionExpiryStreamPayload,
      cloudSyncStatus,
      triggerCloudSync,
      listRemoteCloudSkills,
      ocrCapabilities,
      recognizeOcr,
      listOcrSupportedLanguages
    } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    await handler('diagnostic:preview')?.({}, { sectionsIncluded: ['system-info'], includeScreenshots: false })
    await handler('diagnostic:list-redaction-rules')?.({})
    await handler('diagnostic:capture-screenshot')?.({}, { mode: 'main-window' })
    await handler('diagnostic:list-packs')?.({})
    await handler('permission:request')?.({}, { op: 'inject', scope: {}, confirmedBy: 'vitest' })
    await handler('permission:check')?.({}, { op: 'inject', scope: {} })
    await handler('permission:revoke')?.({}, { grantId: '11111111-1111-4111-8111-111111111111', confirmedBy: 'vitest' })
    await handler('permission:revoke-all')?.({}, { confirmedBy: 'vitest' })
    await handler('permission:list-active')?.({})
    await handler('permission:configure-policy')?.({}, { op: 'inject', confirmedBy: 'vitest' })
    await handler('permission:expiry-stream')?.({})
    await handler('skill:cloud-sync-status')?.({})
    await handler('skill:cloud-sync-trigger')?.({}, { direction: 'push', conflictPolicy: 'local-wins' })
    await handler('skill:cloud-sync-list-remote')?.({})
    await handler('ocr:capabilities')?.({})
    await handler('ocr:recognize')?.({}, { imageBase64: 'abc', languages: ['eng'] })
    await handler('ocr:list-supported-languages')?.({})

    expect(previewDiagnosticPack).toHaveBeenCalledWith({ sectionsIncluded: ['system-info'], includeScreenshots: false, screenshotMode: 'main-window', redactionLevel: 'aggressive', customRedactionRules: [] })
    expect(requestPermission).toHaveBeenCalledWith({ op: 'inject', scope: {}, confirmedBy: 'vitest' })
    expect(triggerCloudSync).toHaveBeenCalledWith({ direction: 'push', conflictPolicy: 'local-wins' })
    expect(recognizeOcr).toHaveBeenCalledWith({ imageBase64: 'abc', languages: ['eng'], rotateAuto: true })
  })


  it('routes recording engine channels through executable handlers', async () => {
    const startRecording = vi.fn(async () => ({ recordingId: '11111111-1111-4111-8111-111111111111' }))
    const stopRecording = vi.fn(async () => ({ status: 'stopped' }))
    const listRecordings = vi.fn(async () => [])
    const getRecordingManifest = vi.fn(async () => ({ success: true, manifest: null }))
    const getRecordingEvents = vi.fn(async () => [])
    const getRecordingReplayState = vi.fn(async () => ({ recordingId }))
    const getRecordingEventsWindow = vi.fn(async () => [])
    const getRecordingCast = vi.fn(async () => ({ cast: { version: 2, width: 120, height: 40, timestamp: 1, events: [] } }))
    const listRecordingAnchors = vi.fn(async () => ({ anchors: [] }))
    const getRecordingScreenshot = vi.fn(async () => ({ filePath: 'shot.png', width: 1, height: 1, eventTs: 1, sizeBytes: 67 }))
    const getRecordingFsSnapshotAt = vi.fn(async () => ({ recordingId, cursorTs: 1, tree: [] }))
    const exportRecordingAsciinema = vi.fn(async () => ({ filePath: 'recording.cast' }))
    const exportRecordingZip = vi.fn(async () => ({ filePath: 'recording.zip' }))
    const deleteRecording = vi.fn(async () => ({ deleted: true }))
    const service = { startRecording, stopRecording, listRecordings, getRecordingManifest, getRecordingEvents, getRecordingReplayState, getRecordingEventsWindow, getRecordingCast, listRecordingAnchors, getRecordingScreenshot, getRecordingFsSnapshotAt, exportRecordingAsciinema, exportRecordingZip, deleteRecording } as never
    const recordingId = '11111111-1111-4111-8111-111111111111'
    const sessionId = '22222222-2222-4222-8222-222222222222'

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    await handler('recording:start')?.({}, { sessionId, taskId: 'task-1', cwd: 'C:/repo', enabledStreams: ['stdout'], confirmedBy: 'vitest' })
    await handler('recording:stop')?.({}, { recordingId, confirmedBy: 'vitest' })
    await handler('recording:list')?.({}, { sessionId })
    await handler('recording:get-manifest')?.({}, { recordingId })
    await handler('recording:get-events')?.({}, { recordingId, kind: 'stdout' })
    await handler('recording:get-replay-state')?.({}, { recordingId, speed: 2 })
    await handler('recording:get-events-window')?.({}, { recordingId, sinceTs: 1, untilTs: 2, kinds: ['stdout'] })
    await handler('recording:get-cast')?.({}, { recordingId })
    await handler('recording:list-anchors')?.({}, { recordingId })
    await handler('recording:get-screenshot')?.({}, { recordingId, ts: 1 })
    await handler('recording:get-fs-snapshot-at')?.({}, { recordingId, ts: 1 })
    await handler('recording:export-asciinema')?.({}, { recordingId, outPath: 'recording.cast' })
    await handler('recording:export-zip')?.({}, { recordingId, outPath: 'recording.zip', redact: true })
    await handler('recording:delete')?.({}, { recordingId, confirmedBy: 'vitest' })

    expect(startRecording).toHaveBeenCalledWith({ sessionId, taskId: 'task-1', cwd: 'C:/repo', enabledStreams: ['stdout'], confirmedBy: 'vitest' })
    expect(stopRecording).toHaveBeenCalledWith({ recordingId, confirmedBy: 'vitest' })
    expect(listRecordings).toHaveBeenCalledWith({ sessionId })
    expect(getRecordingManifest).toHaveBeenCalledWith({ recordingId })
    expect(getRecordingEvents).toHaveBeenCalledWith({ recordingId, kind: 'stdout' })
    expect(getRecordingReplayState).toHaveBeenCalledWith({ recordingId, speed: 2 })
    expect(getRecordingEventsWindow).toHaveBeenCalledWith({ recordingId, sinceTs: 1, untilTs: 2, kinds: ['stdout'] })
    expect(getRecordingCast).toHaveBeenCalledWith({ recordingId })
    expect(listRecordingAnchors).toHaveBeenCalledWith({ recordingId })
    expect(getRecordingScreenshot).toHaveBeenCalledWith({ recordingId, ts: 1 })
    expect(getRecordingFsSnapshotAt).toHaveBeenCalledWith({ recordingId, ts: 1 })
    expect(exportRecordingAsciinema).toHaveBeenCalledWith({ recordingId, outPath: 'recording.cast' })
    expect(exportRecordingZip).toHaveBeenCalledWith({ recordingId, outPath: 'recording.zip', redact: true })
    expect(deleteRecording).toHaveBeenCalledWith({ recordingId, confirmedBy: 'vitest' })
  })

  it('routes spec-24 topology graph channels through executable handlers', async () => {
    const buildGlobalTopology = vi.fn(async () => ({ snapshotId: '11111111-1111-4111-8111-111111111111' }))
    const getNetworkTopology = vi.fn(async () => ({ slice: { graphKind: 'network-topology' } }))
    const getNeuralTopology = vi.fn(async () => ({ slice: { graphKind: 'neural-relationship' } }))
    const saveTopologySnapshot = vi.fn(async () => ({ saved: true, path: 'topology-snapshots/a.json' }))
    const listTopologySnapshots = vi.fn(async () => [])
    const exportTopology = vi.fn(async () => ({ content: 'graph TD', mimeType: 'text/plain', encoding: 'utf8' }))
    const warmTopologyScopes = vi.fn(async () => ({ warmed: 1 }))
    const topologyFullscreen = vi.fn(async () => ({ slice: { scope: 'global' } }))
    const auditAttachedTopologyFavoriteChange = vi.fn(async (input: unknown) => ({ success: true, input }))
    const service = { buildGlobalTopology, getNetworkTopology, getNeuralTopology, saveTopologySnapshot, listTopologySnapshots, exportTopology, warmTopologyScopes, topologyFullscreen, auditAttachedTopologyFavoriteChange } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    await handler('topology:global:get-fullscreen')?.({}, { scope: 'global' })
    await handler('topology:build-global-graph')?.({}, { graphKind: 'flow' })
    await handler('topology:network')?.({}, { scope: 'process', targetIds: [1234] })
    await handler('topology:neural')?.({}, { scope: 'process', targetIds: [1234] })
    await handler('topology:save-snapshot')?.({}, { snapshotId: '11111111-1111-4111-8111-111111111111', label: 'x', confirmedBy: 'vitest' })
    await handler('topology:list-snapshots')?.({})
    await handler('topology:export')?.({}, { snapshotId: '11111111-1111-4111-8111-111111111111', format: 'mermaid' })
    await handler('topology:warm-scope-global')?.({}, { scopes: [{ graphKind: 'network-topology' }] })
    await handler('topology:attached:favorite-change')?.({}, {
      action: 'pin',
      favorite: { label: 'process:1234', scope: 'process', targetId: 1234, graphKind: 'network-topology', pinnedAt: 1713830400000 },
      previousFavoriteCount: 0,
      nextFavoriteCount: 1,
      selectedNodeId: 'process-1234'
    })

    expect(topologyFullscreen).toHaveBeenCalledWith({ scope: 'global' })
    expect(buildGlobalTopology).toHaveBeenCalledWith({ graphKind: 'flow' })
    expect(getNetworkTopology).toHaveBeenCalledWith({ scope: 'process', targetIds: [1234] })
    expect(getNeuralTopology).toHaveBeenCalledWith({ scope: 'process', targetIds: [1234] })
    expect(saveTopologySnapshot).toHaveBeenCalledWith({ snapshotId: '11111111-1111-4111-8111-111111111111', label: 'x', confirmedBy: 'vitest' })
    expect(listTopologySnapshots).toHaveBeenCalledTimes(1)
    expect(exportTopology).toHaveBeenCalledWith({ snapshotId: '11111111-1111-4111-8111-111111111111', format: 'mermaid' })
    expect(warmTopologyScopes).toHaveBeenCalledWith({ scopes: [{ graphKind: 'network-topology' }] })
    expect(auditAttachedTopologyFavoriteChange).toHaveBeenCalledWith({
      action: 'pin',
      favorite: { label: 'process:1234', scope: 'process', targetId: 1234, graphKind: 'network-topology', pinnedAt: 1713830400000 },
      previousFavoriteCount: 0,
      nextFavoriteCount: 1,
      selectedNodeId: 'process-1234'
    })
  })

  it('routes CSV lock, save, and template editor channels through executable handlers', async () => {
    const listCsvTemplates = vi.fn(() => [])
    const saveCsvTemplate = vi.fn(() => ({ template: { id: 'tpl-1', name: 'block' } }))
    const deleteCsvTemplate = vi.fn(() => ({ success: true, deleted: 1, id: 'tpl-1' }))
    const lockCsv = vi.fn(() => ({ acquired: true, csvPath: 'tasks.csv' }))
    const unlockCsv = vi.fn(() => ({ released: true, csvPath: 'tasks.csv' }))
    const saveCsv = vi.fn(() => ({ success: true, cycleDetected: false, rowCount: 1, csvPath: 'tasks.csv' }))
    const csvLockStatus = vi.fn(() => ({ locked: true, csvPath: 'tasks.csv' }))
    const service = { listCsvTemplates, saveCsvTemplate, deleteCsvTemplate, lockCsv, unlockCsv, saveCsv, csvLockStatus } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    handler('csv:list-templates')?.({}, { source: 'user' })
    handler('csv:save-template')?.({}, { name: 'block', rowTemplate: { taskId: 'A' }, confirmedBy: 'vitest' })
    handler('csv:delete-template')?.({}, { id: 'tpl-1', confirmedBy: 'vitest' })
    await handler('csv:lock')?.({}, { csvPath: 'tasks.csv', confirmedBy: 'vitest' })
    await handler('csv:unlock')?.({}, { csvPath: 'tasks.csv', confirmedBy: 'vitest' })
    await handler('csv:save')?.({}, { csvPath: 'tasks.csv', rows: [], confirmedBy: 'vitest' })
    await handler('csv:lock-status-stream')?.({}, { csvPath: 'tasks.csv' })

    expect(listCsvTemplates).toHaveBeenCalledWith({ source: 'user' })
    expect(saveCsvTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: 'block', rowTemplate: expect.objectContaining({ taskId: 'A' }), confirmedBy: 'vitest' }))
    expect(deleteCsvTemplate).toHaveBeenCalledWith({ id: 'tpl-1', confirmedBy: 'vitest' })
    expect(lockCsv).toHaveBeenCalledWith({ csvPath: 'tasks.csv', confirmedBy: 'vitest' })
    expect(unlockCsv).toHaveBeenCalledWith({ csvPath: 'tasks.csv', confirmedBy: 'vitest' })
    expect(saveCsv).toHaveBeenCalledWith({ csvPath: 'tasks.csv', rows: [], confirmedBy: 'vitest' })
    expect(csvLockStatus).toHaveBeenCalledWith({ csvPath: 'tasks.csv' })
  })

  it('routes CSV launch runner and session controls through executable handlers', async () => {
    const getCsvRunnerInfo = vi.fn(() => ({ available: true, version: '1.0.0', details: {} }))
    const launchCsv = vi.fn(() => ({ success: true }))
    const pauseCsvSession = vi.fn(() => ({ success: true }))
    const resumeCsvSession = vi.fn(() => ({ success: true }))
    const abortCsvSession = vi.fn(() => ({ success: true }))
    const service = { getCsvRunnerInfo, launchCsv, pauseCsvSession, resumeCsvSession, abortCsvSession } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    await handler('csv:get-runner-info')?.({}, { kind: 'python' })
    await handler('csv:launch')?.({}, { csvPath: 'tasks.csv', runner: 'devhub', confirmedBy: 'vitest' })
    await handler('csv:pause')?.({}, { sessionId: 'session-1', confirmedBy: 'vitest' })
    await handler('csv:resume')?.({}, { sessionId: 'session-1', confirmedBy: 'vitest' })
    await handler('csv:abort')?.({}, { sessionId: 'session-1', confirmedBy: 'vitest' })

    expect(getCsvRunnerInfo).toHaveBeenCalledWith({ kind: 'python' })
    expect(launchCsv).toHaveBeenCalledWith({ csvPath: 'tasks.csv', runner: 'devhub', confirmedBy: 'vitest' })
    expect(pauseCsvSession).toHaveBeenCalledWith({ sessionId: 'session-1', confirmedBy: 'vitest' })
    expect(resumeCsvSession).toHaveBeenCalledWith({ sessionId: 'session-1', confirmedBy: 'vitest' })
    expect(abortCsvSession).toHaveBeenCalledWith({ sessionId: 'session-1', confirmedBy: 'vitest' })
  })

  it('routes Gemini parser stat and rule reload channels through executable handlers', () => {
    const getGeminiPatternStat = vi.fn(() => ({ totalLines: 0, unmatchedRatio: 0 }))
    const reloadGeminiRules = vi.fn(() => ({ success: true, applied: 1 }))
    const service = { getGeminiPatternStat, reloadGeminiRules } as never

    setupR8RuntimeHandlers(service)

    const statHandler = ipcMainMock.handle.mock.calls.find(([channel]) => channel === 'ai:gemini-pattern-stat')?.[1]
    const reloadHandler = ipcMainMock.handle.mock.calls.find(([channel]) => channel === 'ai:gemini-rule-reload')?.[1]

    expect(statHandler).toBeTypeOf('function')
    expect(reloadHandler).toBeTypeOf('function')
    statHandler({}, { instanceId: 'gemini-ipc' })
    reloadHandler({}, { rules: [{ kind: 'thinking', regex: 'Waiting', confidence: 0.7 }], confirmedBy: 'vitest' })

    expect(getGeminiPatternStat).toHaveBeenCalledWith({ instanceId: 'gemini-ipc' })
    expect(reloadGeminiRules).toHaveBeenCalledWith({ rules: [{ kind: 'thinking', regex: 'Waiting', flags: 'i', confidence: 0.7, ansiStrip: true }], confirmedBy: 'vitest' })
  })

  it('routes Claude cost summary through a concrete executable handler', () => {
    const getClaudeCostSummary = vi.fn(() => ({ totalInputTokens: 10, totalOutputTokens: 8, totalCostUsd: 0.001, durationMs: 1200 }))
    const service = { getClaudeCostSummary } as never

    setupR8RuntimeHandlers(service)

    const handler = ipcMainMock.handle.mock.calls.find(([channel]) => channel === 'ai:claude-cost-summary')?.[1]

    expect(handler).toBeTypeOf('function')
    expect(handler({}, { instanceId: 'claude-ipc' })).toEqual({ totalInputTokens: 10, totalOutputTokens: 8, totalCostUsd: 0.001, durationMs: 1200 })
    expect(getClaudeCostSummary).toHaveBeenCalledWith({ instanceId: 'claude-ipc' })
  })

  it('routes monitor window and popout channels through executable handlers', async () => {
    const openMonitorWindow = vi.fn(async () => ({ success: true, windowId: 'monitor-1' }))
    const closeMonitorWindow = vi.fn(() => ({ success: true }))
    const monitorSnapshot = vi.fn(() => ({ cards: [], collectedAt: 1 }))
    const setMonitorWindowPrefs = vi.fn(() => ({ success: true }))
    const focusMonitorInstance = vi.fn(() => ({ success: true }))
    const openMonitorPopout = vi.fn(async () => ({ success: true, popoutId: 'popout-1' }))
    const closeMonitorPopout = vi.fn(() => ({ success: true }))
    const listMonitorPopouts = vi.fn(() => [])
    const returnMonitorPopoutToMain = vi.fn(() => ({ success: true }))
    const setMonitorPopoutLayoutPreference = vi.fn(() => ({ success: true }))
    const service = {
      openMonitorWindow,
      closeMonitorWindow,
      monitorSnapshot,
      setMonitorWindowPrefs,
      focusMonitorInstance,
      openMonitorPopout,
      closeMonitorPopout,
      listMonitorPopouts,
      returnMonitorPopoutToMain,
      setMonitorPopoutLayoutPreference
    } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    await handler('monitor:open')?.({})
    handler('monitor:snapshot')?.({})
    handler('monitor:set-window-prefs')?.({}, { alwaysOnTop: true, opacity: 0.7, bounds: { x: 1, y: 2, w: 320, h: 220 }, confirmedBy: 'vitest' })
    handler('monitor:focus-instance')?.({}, { tool: 'claude', instanceId: 'claude-ipc' })
    await handler('monitor:popout-open')?.({}, { tool: 'claude', layout: 'compact' })
    handler('monitor:popout-close')?.({}, { popoutId: 'popout-1' })
    handler('monitor:popout-list')?.({})
    handler('monitor:popout-return-to-main')?.({}, { popoutId: 'popout-1' })
    handler('monitor:popout-set-layout')?.({}, { popoutId: 'popout-1', layout: 'events-only' })
    handler('monitor:close')?.({})

    expect(openMonitorWindow).toHaveBeenCalledTimes(1)
    expect(monitorSnapshot).toHaveBeenCalledTimes(1)
    expect(setMonitorWindowPrefs).toHaveBeenCalledWith({ alwaysOnTop: true, opacity: 0.7, bounds: { x: 1, y: 2, w: 320, h: 220 }, confirmedBy: 'vitest' })
    expect(focusMonitorInstance).toHaveBeenCalledWith({ tool: 'claude', instanceId: 'claude-ipc' })
    expect(openMonitorPopout).toHaveBeenCalledWith({ tool: 'claude', layout: 'compact' })
    expect(closeMonitorPopout).toHaveBeenCalledWith({ popoutId: 'popout-1' })
    expect(listMonitorPopouts).toHaveBeenCalledTimes(1)
    expect(returnMonitorPopoutToMain).toHaveBeenCalledWith({ popoutId: 'popout-1' })
    expect(setMonitorPopoutLayoutPreference).toHaveBeenCalledWith({ popoutId: 'popout-1', layout: 'events-only' })
    expect(closeMonitorWindow).toHaveBeenCalledTimes(1)
  })

  it('routes BrowserWindow popout lifecycle channels through executable handlers', async () => {
    const createPopout = vi.fn(async () => ({ windowId: 'popout-1' }))
    const closePopout = vi.fn(() => ({ success: true }))
    const listPopouts = vi.fn(() => [])
    const openPortPopout = vi.fn(async () => ({ success: true, popoutId: 'popout-port-1' }))
    const closePortPopout = vi.fn(() => ({ success: true, popoutId: 'popout-port-1' }))
    const listPortPopouts = vi.fn(() => ({ success: true, popouts: [] }))
    const getPortPopoutPosition = vi.fn(() => ({ success: true, port: 3000, position: { x: 24, y: 48 }, size: { width: 320, height: 240 }, updatedAt: 1 }))
    const savePortPopoutPosition = vi.fn(() => ({ success: true, port: 3000, position: { x: 24, y: 48 }, size: { width: 320, height: 240 }, updatedAt: 1 }))
    const pinPortPopout = vi.fn(() => ({ success: true, popoutId: 'popout-port-1', pinned: true }))
    const batchPortPopouts = vi.fn(() => ({ success: true, results: [] }))
    const syncPortPopout = vi.fn(() => ({ success: true, popoutId: 'popout-port-1', key: 'selection', sentWindowIds: [] }))
    const demotePortPopout = vi.fn(async () => ({ success: true, popoutId: 'popout-port-1', floatingId: 'popout-port-floating' }))
    const pinPopout = vi.fn(() => ({ windowId: 'popout-1', pinned: true }))
    const handlePopoutBridgeMessage = vi.fn(() => ({ success: true, windowId: 'popout-1', heartbeatAt: 1000, bridgeState: 'connected' }))
    const savePopoutBounds = vi.fn(() => ({ success: true }))
    const movePopoutToMonitor = vi.fn(() => ({ success: true }))
    const promotePopoutFromFloating = vi.fn(async () => ({ success: true, browserPopoutId: 'popout-2' }))
    const demotePopout = vi.fn(async () => ({ success: true, floatingId: 'popout-3' }))
    const service = {
      createPopout,
      closePopout,
      listPopouts,
      openPortPopout,
      closePortPopout,
      listPortPopouts,
      getPortPopoutPosition,
      savePortPopoutPosition,
      pinPortPopout,
      batchPortPopouts,
      syncPortPopout,
      demotePortPopout,
      handlePopoutBridgeMessage,
      pinPopout,
      savePopoutBounds,
      movePopoutToMonitor,
      promotePopoutFromFloating,
      demotePopout
    } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    await handler('popout:create')?.({}, { surface: 'port', targetId: 3000, mode: 'browserwindow' })
    handler('popout:close')?.({}, { windowId: 'popout-1' })
    handler('popout:list')?.({})
    await handler('port:popout-open')?.({}, { port: 3000, pid: 1234, trigger: 'click', mode: 'browserwindow' })
    handler('port:popout-close')?.({}, { popoutId: 'popout-port-1', reason: 'user' })
    handler('port:popout-list')?.({})
    handler('port:popout-position-get')?.({}, { port: 3000 })
    handler('port:popout-position-save')?.({}, { port: 3000, position: { x: 24, y: 48 }, size: { width: 320, height: 240 } })
    handler('port:popout-pin')?.({}, { popoutId: 'popout-port-1', pinned: true })
    handler('port:popout-batch')?.({}, { confirmedBy: 'vitest', operations: [{ popoutId: 'popout-port-1', action: 'pin' }] })
    handler('port:popout-sync')?.({}, { popoutId: 'popout-port-1', key: 'selection', value: { port: 3000 } })
    await handler('port:popout-demote')?.({}, { popoutId: 'popout-port-1' })
    handler('popout:bridge-message')?.({}, { windowId: 'popout-1', type: 'heartbeat', at: 1000 })
    handler('popout:pin')?.({}, { windowId: 'popout-1', pinned: true })
    handler('popout:save-bounds')?.({}, { windowId: 'popout-1', bounds: { x: 1, y: 2, width: 320, height: 240 } })
    handler('popout:move-to-monitor')?.({}, { windowId: 'popout-1', monitorIndex: 1 })
    await handler('popout:promote-from-floating')?.({}, { floatingId: 'floating-1', alwaysOnTop: true })
    await handler('popout:demote')?.({}, { windowId: 'popout-2' })

    expect(createPopout).toHaveBeenCalledWith({ surface: 'port', targetId: 3000, mode: 'browserwindow' })
    expect(closePopout).toHaveBeenCalledWith({ windowId: 'popout-1' })
    expect(listPopouts).toHaveBeenCalledTimes(1)
    expect(openPortPopout).toHaveBeenCalledWith({ port: 3000, pid: 1234, trigger: 'click', mode: 'browserwindow' })
    expect(closePortPopout).toHaveBeenCalledWith({ popoutId: 'popout-port-1', reason: 'user' })
    expect(listPortPopouts).toHaveBeenCalledTimes(1)
    expect(getPortPopoutPosition).toHaveBeenCalledWith({ port: 3000 })
    expect(savePortPopoutPosition).toHaveBeenCalledWith({ port: 3000, position: { x: 24, y: 48 }, size: { width: 320, height: 240 } })
    expect(pinPortPopout).toHaveBeenCalledWith({ popoutId: 'popout-port-1', pinned: true })
    expect(batchPortPopouts).toHaveBeenCalledWith({ confirmedBy: 'vitest', operations: [{ popoutId: 'popout-port-1', action: 'pin' }] })
    expect(syncPortPopout).toHaveBeenCalledWith({ popoutId: 'popout-port-1', key: 'selection', value: { port: 3000 } })
    expect(demotePortPopout).toHaveBeenCalledWith({ popoutId: 'popout-port-1' })
    expect(handlePopoutBridgeMessage).toHaveBeenCalledWith({ windowId: 'popout-1', type: 'heartbeat', at: 1000 })
    expect(pinPopout).toHaveBeenCalledWith({ windowId: 'popout-1', pinned: true })
    expect(savePopoutBounds).toHaveBeenCalledWith({ windowId: 'popout-1', bounds: { x: 1, y: 2, width: 320, height: 240 } })
    expect(movePopoutToMonitor).toHaveBeenCalledWith({ windowId: 'popout-1', monitorIndex: 1 })
    expect(promotePopoutFromFloating).toHaveBeenCalledWith({ floatingId: 'floating-1', alwaysOnTop: true })
    expect(demotePopout).toHaveBeenCalledWith({ windowId: 'popout-2' })
  })

  it('routes skill library, builtin, and editor channels through executable handlers', async () => {
    const validateSkillYaml = vi.fn(() => ({ success: true }))
    const validateSkillEditor = vi.fn(() => ({ valid: true, yamlErrors: [], schemaErrors: [] }))
    const listBuiltinSkills = vi.fn(() => ({ names: ['code-review'], skills: [] }))
    const forkBuiltinSkill = vi.fn(async () => ({ success: true, newSkillPath: 'skills/my-review' }))
    const builtinReadme = vi.fn(() => ({ success: true, markdown: '# README' }))
    const getSkill = vi.fn(async () => ({ success: true, skill: null }))
    const writeSkill = vi.fn(async () => ({ success: true }))
    const deleteSkill = vi.fn(async () => ({ success: true }))
    const createSkillFromTemplate = vi.fn(async () => ({ filePath: 'skills/my-skill/SKILL.md', skill: null }))
    const installSkillFromPath = vi.fn(async () => ({ success: true }))
    const uninstallSkill = vi.fn(async () => ({ success: true }))
    const reloadSkills = vi.fn(async () => ({ success: true, count: 1 }))
    const listSkills = vi.fn(async () => ({ skills: [], errors: [] }))
    const service = { validateSkillYaml, validateSkillEditor, listBuiltinSkills, forkBuiltinSkill, builtinReadme, getSkill, writeSkill, deleteSkill, createSkillFromTemplate, installSkillFromPath, uninstallSkill, reloadSkills, listSkills } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    const skillYaml = ['---', 'name: code-review', '---'].join(String.fromCharCode(10))

    handler('skill:validate-yaml')?.({}, { yaml: skillYaml })
    handler('skill:validate')?.({}, { yaml: skillYaml, body: '', script: '' })
    handler('skill:builtin-list')?.({})
    await handler('skill:builtin-fork')?.({}, { name: 'code-review', targetName: 'my-review', confirmedBy: 'vitest' })
    handler('skill:builtin-readme')?.({}, { name: 'code-review' })
    await handler('skill:get')?.({}, { name: 'code-review' })
    await handler('skill:write')?.({}, { name: 'code-review', text: skillYaml, confirmedBy: 'vitest' })
    await handler('skill:delete')?.({}, { name: 'code-review', confirmedBy: 'vitest' })
    await handler('skill:create-from-template')?.({}, { templateId: 'full', name: 'my-skill', displayName: 'My Skill', confirmedBy: 'vitest' })
    await handler('skill:install-from-path')?.({}, { sourcePath: 'C:/skills/code-review', confirmedBy: 'vitest' })
    await handler('skill:uninstall')?.({}, { name: 'code-review', confirmedBy: 'vitest' })
    await handler('skill:reload')?.({}, { force: true, watch: true })
    await handler('skill:list')?.({})

    expect(validateSkillYaml).toHaveBeenCalledTimes(1)
    expect(validateSkillEditor).toHaveBeenCalledWith({ yaml: skillYaml, body: '', script: '' })
    expect(listBuiltinSkills).toHaveBeenCalledTimes(1)
    expect(forkBuiltinSkill).toHaveBeenCalledWith({ name: 'code-review', targetName: 'my-review', confirmedBy: 'vitest' })
    expect(builtinReadme).toHaveBeenCalledWith({ name: 'code-review' })
    expect(getSkill).toHaveBeenCalledWith({ name: 'code-review' })
    expect(writeSkill).toHaveBeenCalledWith({ name: 'code-review', text: skillYaml, confirmedBy: 'vitest' })
    expect(deleteSkill).toHaveBeenCalledWith({ name: 'code-review', confirmedBy: 'vitest' })
    expect(createSkillFromTemplate).toHaveBeenCalledWith({ templateId: 'full', name: 'my-skill', displayName: 'My Skill', confirmedBy: 'vitest' })
    expect(installSkillFromPath).toHaveBeenCalledWith({ sourcePath: 'C:/skills/code-review', confirmedBy: 'vitest' })
    expect(uninstallSkill).toHaveBeenCalledWith({ name: 'code-review', confirmedBy: 'vitest' })
    expect(reloadSkills).toHaveBeenCalledWith({ force: true, watch: true })
    expect(listSkills).toHaveBeenCalledTimes(1)
  })


  it('routes watchdog supervisor control channels through executable handlers', () => {
    const watchdogSupervisorStatus = vi.fn(() => ({ status: 'not-started' }))
    const watchdogSupervisorRespawn = vi.fn(() => ({ success: false, code: 'E_SPAWN_FAILED' }))
    const watchdogSupervisorInstallService = vi.fn(() => ({ success: false, requiresElevation: true }))
    const watchdogSupervisorUninstallService = vi.fn(() => ({ success: false, requiresElevation: true }))
    const service = { watchdogSupervisorStatus, watchdogSupervisorRespawn, watchdogSupervisorInstallService, watchdogSupervisorUninstallService } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    handler('watchdog-supervisor:status')?.({})
    handler('watchdog-supervisor:respawn')?.({}, { reason: 'manual', confirmedBy: 'vitest' })
    handler('watchdog-supervisor:install-service')?.({}, { confirmAdmin: true, confirmedBy: 'vitest' })
    handler('watchdog-supervisor:uninstall-service')?.({}, { confirmAdmin: true, confirmedBy: 'vitest' })

    expect(watchdogSupervisorStatus).toHaveBeenCalledTimes(1)
    expect(watchdogSupervisorRespawn).toHaveBeenCalledWith({ reason: 'manual', confirmedBy: 'vitest' })
    expect(watchdogSupervisorInstallService).toHaveBeenCalledWith({ confirmAdmin: true, confirmedBy: 'vitest' })
    expect(watchdogSupervisorUninstallService).toHaveBeenCalledWith({ confirmAdmin: true, confirmedBy: 'vitest' })
  })

  it('routes spec-26 attached flow channels through executable handlers', async () => {
    const getAttachedFlow = vi.fn(async () => ({ snapshotId: '11111111-1111-4111-8111-111111111111', nodes: [], edges: [], stats: { totalEvents: 0, failCount: 0, retryCount: 0, avgDurationMs: 0, p95DurationMs: 0 } }))
    const filterAttachedFlow = vi.fn(async () => ({ snapshotId: '22222222-2222-4222-8222-222222222222', nodes: [], edges: [], stats: { totalEvents: 0, failCount: 0, retryCount: 0, avgDurationMs: 0, p95DurationMs: 0 } }))
    const flowScopedStats = vi.fn(async () => ({ totalEvents: 0, failCount: 0, retryCount: 0, avgDurationMs: 0, p95DurationMs: 0 }))
    const exportFlowTimeline = vi.fn(async () => ({ content: 'sequenceDiagram', mimeType: 'text/vnd.mermaid', encoding: 'utf8' }))
    const subscribeFlowEventStream = vi.fn(() => ({ success: true, subscriberId: 'flow-vitest' }))
    const unsubscribeFlowEventStream = vi.fn(() => ({ success: true, subscriberId: 'flow-vitest' }))
    const service = { getAttachedFlow, filterAttachedFlow, flowScopedStats, exportFlowTimeline, subscribeFlowEventStream, unsubscribeFlowEventStream } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    const sender = { id: 26026 }
    await handler('flow:get-attached')?.({}, { scope: 'runtime', windowMs: 1800000 })
    await handler('flow:filter-edges')?.({}, { scope: 'runtime', filter: { kinds: ['task-fail'] } })
    await handler('flow:scoped-stats')?.({}, { scope: 'runtime' })
    await handler('flow:export-timeline')?.({}, { scope: 'runtime', format: 'mermaid-sequence' })
    await handler('flow:event-stream')?.({ sender }, { subscriberId: 'flow-vitest', request: { scope: 'runtime' }, intervalMs: 500 })
    await handler('flow:event-stream:unsubscribe')?.({}, { subscriberId: 'flow-vitest' })

    expect(getAttachedFlow).toHaveBeenCalledWith(expect.objectContaining({ scope: 'runtime', windowMs: 1800000 }))
    expect(filterAttachedFlow).toHaveBeenCalledWith(expect.objectContaining({ filter: { kinds: ['task-fail'] } }))
    expect(flowScopedStats).toHaveBeenCalledWith(expect.objectContaining({ scope: 'runtime' }))
    expect(exportFlowTimeline).toHaveBeenCalledWith(expect.objectContaining({ format: 'mermaid-sequence' }))
    expect(subscribeFlowEventStream).toHaveBeenCalledWith(sender, expect.objectContaining({ subscriberId: 'flow-vitest', intervalMs: 500 }))
    expect(unsubscribeFlowEventStream).toHaveBeenCalledWith({ subscriberId: 'flow-vitest' })
  })


  it('routes spec-27 signal fusion channels through executable handlers', async () => {
    const getSignalContributions = vi.fn(() => ({ instanceId: 'ai-1', contributions: {}, fusedAt: 1 }))
    const getInstanceState = vi.fn(() => ({ instanceId: 'ai-1', state: 'working' }))
    const listWeightProfiles = vi.fn(() => [])
    const fusionConfig = vi.fn(() => ({ algorithm: 'weighted-mean' }))
    const setWeightProfile = vi.fn(() => ({ success: true, normalizedWeights: { cli_parse: 1 } }))
    const listStateRules = vi.fn(() => [])
    const overrideStateRule = vi.fn(() => ({ success: true }))
    const service = { getSignalContributions, getInstanceState, listWeightProfiles, fusionConfig, setWeightProfile, listStateRules, overrideStateRule } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    await handler('ai:get-signal-contributions')?.({}, { instanceId: 'ai-1' })
    await handler('ai:get-instance-state')?.({}, { instanceId: 'ai-1' })
    await handler('ai:list-weight-profiles')?.({})
    await handler('ai:fusion-config')?.({}, { decayEnabled: true, minSourcesForFusion: 2 })
    await handler('ai:set-weight-profile')?.({}, { profileId: 'user-custom', weights: { cli_parse: 0.5, window_title: 0.5 }, confirmedBy: 'vitest' })
    await handler('ai:list-state-rules')?.({})
    await handler('ai:override-rule')?.({}, { ruleId: 'system-dead-implies-task-error', enabled: false, confirmedBy: 'vitest' })

    expect(getSignalContributions).toHaveBeenCalledWith({ instanceId: 'ai-1' })
    expect(getInstanceState).toHaveBeenCalledWith({ instanceId: 'ai-1' })
    expect(listWeightProfiles).toHaveBeenCalledTimes(1)
    expect(fusionConfig).toHaveBeenCalledWith(expect.objectContaining({ decayEnabled: true, minSourcesForFusion: 2 }))
    expect(setWeightProfile).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'user-custom', weights: { cli_parse: 0.5, window_title: 0.5 }, confirmedBy: 'vitest' }))
    expect(listStateRules).toHaveBeenCalledTimes(1)
    expect(overrideStateRule).toHaveBeenCalledWith({ ruleId: 'system-dead-implies-task-error', enabled: false, confirmedBy: 'vitest' })
  })


  it('routes spec-29 feedback loop channels through executable handlers', async () => {
    const reportMisreport = vi.fn(() => ({ id: '00000000-0000-4000-8000-000000000004', weightAdjustments: [] }))
    const listMisreports = vi.fn(() => [])
    const diagnosticExplain = vi.fn(() => ({ instanceId: 'ai-1', currentTaskState: 'idle', topReasons: [], recentTransitions: [], suggestedAction: 'report-misreport' }))
    const resetLearnedWeights = vi.fn(() => ({ success: true, profileResetTo: 'default' }))
    const service = { reportMisreport, listMisreports, diagnosticExplain, resetLearnedWeights } as never

    setupR8RuntimeHandlers(service)

    const handler = (channel: string) => ipcMainMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1]
    await handler('ai:report-misreport')?.({}, { instanceId: 'ai-1', kind: 'false-idle', expectedTaskState: 'running' })
    await handler('ai:list-misreports')?.({}, { since: 1 })
    await handler('ai:get-diagnostic-explain')?.({}, { instanceId: 'ai-1' })
    await handler('ai:reset-learned-weights')?.({}, { confirmedBy: 'vitest' })

    expect(reportMisreport).toHaveBeenCalledWith({ instanceId: 'ai-1', kind: 'false-idle', expectedTaskState: 'running' })
    expect(listMisreports).toHaveBeenCalledWith({ since: 1 })
    expect(diagnosticExplain).toHaveBeenCalledWith({ instanceId: 'ai-1' })
    expect(resetLearnedWeights).toHaveBeenCalledWith({ confirmedBy: 'vitest' })
  })

  it('routes title rule reload through executable handler', () => {
    const reloadTitleRules = vi.fn(() => ({ success: true, applied: 1 }))
    const service = { reloadTitleRules } as never

    setupR8RuntimeHandlers(service)

    const handler = ipcMainMock.handle.mock.calls.find(([channel]) => channel === 'cli:title-rule-reload')?.[1]
    expect(handler).toBeTypeOf('function')
    handler({}, { rules: [{ tool: 'cursor', regex: 'Cursor Waiting', phase: 'thinking', confidence: 0.6 }], confirmedBy: 'vitest' })

    expect(reloadTitleRules).toHaveBeenCalledWith({ rules: [{ tool: 'cursor', regex: 'Cursor Waiting', flags: 'i', phase: 'thinking', confidence: 0.6 }], confirmedBy: 'vitest' })
  })
})
