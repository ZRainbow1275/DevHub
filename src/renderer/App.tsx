import { Profiler, useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { TitleBar } from './components/layout/TitleBar'
import { Sidebar } from './components/layout/Sidebar'
import { StatusBar } from './components/layout/StatusBar'
import { ProjectList } from './components/project/ProjectList'
import { AddProjectDialog } from './components/project/AddProjectDialog'
import { AutoDiscoveryDialog } from './components/project/AutoDiscoveryDialog'
import { LogPanel } from './components/log/LogPanel'
import { MonitorPanel } from './components/monitor'
import { Dashboard } from './components/dashboard/Dashboard'
import { FullScreenTopologyView } from './components/topology/FullScreenTopologyView'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { CloseConfirmDialog } from './components/ui/CloseConfirmDialog'
import { PanelSplitter } from './components/ui/PanelSplitter'
import { ToastProvider, useToast } from './components/ui/Toast'
import { ToastHost } from './components/notify/ToastHost'
import { InjectCountdownHost } from './components/inject/InjectCountdownModal'
import { InjectFirstTimeHost } from './components/inject/InjectFirstTimeModal'
import { HeroStats } from './components/ui/HeroStats'
import { InitializationScreen } from './components/ui/InitializationScreen'
import { ThemeDecoration } from './components/ui/ThemeDecoration'
import { ErrorBoundary } from './components/ErrorBoundary'
import { KeyboardNavGroup } from './components/a11y/KeyboardNavGroup'
import { SkipLink } from './components/a11y/SkipLink'
import { useProjects } from './hooks/useProjects'
import { useTheme } from './hooks/useTheme'
import { useA11yRuntime } from './hooks/useA11yRuntime'
import { useBreakpoint } from './hooks/useBreakpoint'
import { useDensity } from './hooks/useDensity'
import { useContainerSize } from './hooks/useContainerSize'
import { useWindowSize } from './hooks/useWindowSize'
import { useReactCommitProfiler } from './hooks/useReactCommitProfiler'
import { useRuntimeMetrics } from './hooks/useRuntimeMetrics'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { useThemeSound } from './hooks/useThemeSound'
import { useDecoration } from './hooks/useDecoration'
import { useScannerStore } from './stores/scannerStore'
import { GridIcon, LogIcon, MonitorIcon } from './components/icons'
import { DevObservabilityPanel } from './components/dev/DevObservabilityPanel'
import { R8CommandPalette } from './components/command/R8CommandPalette'
import { DrawerProvider } from './components/drawer/DrawerProvider'
import { DrawerSystemHost } from './components/drawer/DrawerSystemHost'
import { openGlobalTopologyKind, openGlobalTopologyNode } from './utils/globalTopologyNavigation'
import { paletteNameSchema } from './theme/theme-language'
import {
  LAYOUT_MODE_CHANGE_EVENT,
  LAYOUT_MODE_STORAGE_KEY,
  LAYOUT_MODE_VALUES,
  type LayoutMode
} from '@shared/types'

/** Default split percentages: left panel (project list) / right panel (content) */
const SPLIT_STORAGE_KEY = 'devhub:split-sizes'
const DEFAULT_SPLIT = [25, 75]
const PANEL_MIN_PX = 280

type MainView = 'logs' | 'monitor' | 'dashboard' | 'topology'

function initialMainView(): MainView {
  const params = new URLSearchParams(window.location.search)
  if (params.get('surface') === 'monitor' || window.location.pathname.endsWith('/monitor')) return 'monitor'
  if (window.location.hash === '#/dashboard' || window.location.pathname.endsWith('/dashboard')) return 'dashboard'
  if (window.location.hash === '#/topology/global' || window.location.pathname.endsWith('/topology/global')) return 'topology'
  return 'logs'
}

function normalizeLayoutMode(value: unknown): LayoutMode {
  return LAYOUT_MODE_VALUES.includes(value as LayoutMode) ? value as LayoutMode : 'auto'
}

function CommitTelemetryProbe({
  id,
  recordCommit
}: {
  id: string
  recordCommit: (id: string, phase?: 'mount' | 'update') => void
}) {
  const hasMountedRef = useRef(false)

  useLayoutEffect(() => {
    const phase = hasMountedRef.current ? 'update' : 'mount'
    hasMountedRef.current = true
    recordCommit(id, phase)
  })

  return null
}

function AppContent() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showAutoDiscovery, setShowAutoDiscovery] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [discoveredProjects, setDiscoveredProjects] = useState<Array<{ path: string; name: string; scripts: string[] }>>([])
  const [mainView, setMainView] = useState<MainView>(() => initialMainView())
  const [pendingMonitorTab, setPendingMonitorTab] = useState<string | null>(null)
  const [pendingProcessBatchTagOpen, setPendingProcessBatchTagOpen] = useState(false)
  const [pendingWindowBatchFocusFiltered, setPendingWindowBatchFocusFiltered] = useState(false)
  const [layoutModePreference, setLayoutModePreference] = useState<LayoutMode>(() => normalizeLayoutMode(localStorage.getItem(LAYOUT_MODE_STORAGE_KEY)))
  const [initDismissed, setInitDismissed] = useState(false)
  const commandPaletteReturnFocusRef = useRef<HTMLElement | null>(null)
  const { selectedProject, selectedProjectId, addProject } = useProjects()
  const { showToast } = useToast()
  const { theme, setTheme } = useTheme()
  const themeDecoration = useDecoration()
  useThemeSound(theme)
  useBreakpoint() // Set data-breakpoint on <html> based on window width
  useDensity() // Set data-density on <html> from settings
  useA11yRuntime() // Set data-a11y-* on <html> from persisted prefs and OS media queries
  const shellRef = useRef<HTMLDivElement>(null)
  const shellSize = useContainerSize(shellRef)
  const windowSize = useWindowSize()
  const responsiveWidth = shellSize.width > 0 ? shellSize.width : windowSize.width
  const automaticShellMode = responsiveWidth < 900 ? 'stacked' : 'split'
  const shellMode = layoutModePreference === 'auto' ? automaticShellMode : layoutModePreference
  const openTopologyGlobal = useCallback(() => {
    setMainView('topology')
    if (window.location.hash !== '#/topology/global') {
      window.history.replaceState(null, '', '#/topology/global')
    }
  }, [])

  const openDashboard = useCallback(() => {
    setMainView('dashboard')
    if (window.location.hash !== '#/dashboard') {
      window.history.replaceState(null, '', '#/dashboard')
    }
  }, [])

  const rememberCommandPaletteFocus = useCallback(() => {
    commandPaletteReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [])

  const restoreCommandPaletteFocus = useCallback(() => {
    const target = commandPaletteReturnFocusRef.current
    if (target?.isConnected) {
      window.setTimeout(() => target.focus({ preventScroll: true }), 0)
    }
  }, [])

  const openCommandPalette = useCallback(() => {
    rememberCommandPaletteFocus()
    setShowCommandPalette(true)
  }, [rememberCommandPaletteFocus])

  const hideCommandPalette = useCallback(() => {
    setShowCommandPalette(false)
  }, [])

  const toggleCommandPalette = useCallback(() => {
    if (showCommandPalette) {
      hideCommandPalette()
      restoreCommandPaletteFocus()
      return
    }
    openCommandPalette()
  }, [hideCommandPalette, openCommandPalette, restoreCommandPaletteFocus, showCommandPalette])

  const globalShortcuts = useMemo(() => [
    {
      id: 'command.palette.toggle',
      keys: ['Ctrl+K', 'Meta+K'],
      handler: toggleCommandPalette
    },
    {
      id: 'topology.global.open',
      keys: ['Ctrl+T', 'Meta+T'],
      handler: openTopologyGlobal
    }
  ], [openTopologyGlobal, toggleCommandPalette])
  useGlobalShortcuts(globalShortcuts)

  useEffect(() => {
    const applyLayoutMode = (mode: LayoutMode) => {
      setLayoutModePreference(mode)
      localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode)
    }

    let disposed = false
    const storedMode = normalizeLayoutMode(localStorage.getItem(LAYOUT_MODE_STORAGE_KEY))
    applyLayoutMode(storedMode)

    void window.devhub?.settings?.get?.()
      .then((settings) => {
        if (!disposed) {
          applyLayoutMode(normalizeLayoutMode(settings?.appearance.layoutMode))
        }
      })
      .catch(() => undefined)

    const handleLayoutModeChange = (event: Event) => {
      applyLayoutMode(normalizeLayoutMode((event as CustomEvent<unknown>).detail))
    }
    window.addEventListener(LAYOUT_MODE_CHANGE_EVENT, handleLayoutModeChange)

    return () => {
      disposed = true
      window.removeEventListener(LAYOUT_MODE_CHANGE_EVENT, handleLayoutModeChange)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.responsiveDensity = shellSize.density
  }, [shellSize.density])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const popoutWindowId = params.get('r8Popout')
    if (!popoutWindowId || !window.devhub?.r8?.popout?.bridgeMessage) return

    let disposed = false
    const sendHeartbeat = () => {
      void window.devhub.r8.popout.bridgeMessage({
        windowId: popoutWindowId,
        type: 'heartbeat',
        at: Date.now()
      }).catch(() => {
        if (!disposed) {
          window.clearInterval(timer)
        }
      })
    }
    const timer = window.setInterval(sendHeartbeat, 5_000)
    sendHeartbeat()

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const openMonitor = () => setMainView('monitor')
    const openDashboardEvent = () => openDashboard()
    const openTopology = () => openTopologyGlobal()
    const applyHashRoute = () => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('surface') === 'monitor' || window.location.pathname.endsWith('/monitor')) setMainView('monitor')
      if (window.location.hash === '#/dashboard' || window.location.pathname.endsWith('/dashboard')) openDashboard()
      if (window.location.hash === '#/topology/global' || window.location.pathname.endsWith('/topology/global')) openTopologyGlobal()
    }
    const unsubscribeCommandEvents = window.devhub?.r8?.command?.onEvent?.((event) => {
      if (event.type === 'monitor-navigate') {
        setPendingMonitorTab(event.tab ?? null)
        setMainView('monitor')
      }
      if (event.type === 'topology-navigate') {
        if (event.selectedNodeId) openGlobalTopologyNode(event.selectedNodeId)
        if (event.graphKind) openGlobalTopologyKind(event.graphKind)
        openTopologyGlobal()
      }
      if (event.type === 'dashboard-open') openDashboard()
      if (event.type === 'settings-open') setShowSettings(true)
      if (event.type === 'theme-apply') {
        const parsedTheme = paletteNameSchema.safeParse(event.theme)
        if (parsedTheme.success) {
          void setTheme(parsedTheme.data).catch(() => undefined)
        }
      }
      if (event.type === 'dashboard-apply-layout') {
        openDashboard()
        window.dispatchEvent(new CustomEvent('devhub:dashboard-apply-layout', { detail: { layoutName: event.layoutName } }))
      }
      if (event.type === 'protocol-open' && event.uri) {
        void window.devhub.r8.command.resolveUri(event.uri)
          .then((resolved) => {
            if (resolved.monitor === 'monitor') {
              setPendingMonitorTab(resolved.panel ?? null)
              setMainView('monitor')
            }
          })
          .catch(() => undefined)
      }
      if (event.type === 'process-view-mode') {
        setMainView('monitor')
        window.dispatchEvent(new CustomEvent('devhub:process-view-mode', { detail: { mode: event.mode } }))
      }
      if (event.type === 'process-batch-tag-open') {
        setPendingMonitorTab('process')
        setPendingProcessBatchTagOpen(true)
        setMainView('monitor')
      }
      if (event.type === 'window-batch-focus-filtered') {
        setPendingMonitorTab('window')
        setPendingWindowBatchFocusFiltered(true)
        setMainView('monitor')
      }
    })

    applyHashRoute()
    window.addEventListener('hashchange', applyHashRoute)
    window.addEventListener('devhub:open-monitor', openMonitor)
    window.addEventListener('devhub:open-dashboard', openDashboardEvent)
    window.addEventListener('devhub:open-topology-global', openTopology)
    window.addEventListener('devhub:open-command-palette', openCommandPalette)
    return () => {
      unsubscribeCommandEvents?.()
      window.removeEventListener('hashchange', applyHashRoute)
      window.removeEventListener('devhub:open-monitor', openMonitor)
      window.removeEventListener('devhub:open-dashboard', openDashboardEvent)
      window.removeEventListener('devhub:open-topology-global', openTopology)
      window.removeEventListener('devhub:open-command-palette', openCommandPalette)
    }
  }, [openCommandPalette, openDashboard, openTopologyGlobal, setTheme])

  useEffect(() => {
    if (mainView !== 'monitor' || !pendingMonitorTab) return
    window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: pendingMonitorTab } }))
    setPendingMonitorTab(null)
  }, [mainView, pendingMonitorTab])

  useEffect(() => {
    if (mainView !== 'monitor' || !pendingProcessBatchTagOpen) return
    window.dispatchEvent(new CustomEvent('devhub:process-batch-tag-open'))
    setPendingProcessBatchTagOpen(false)
  }, [mainView, pendingProcessBatchTagOpen])

  useEffect(() => {
    if (mainView !== 'monitor' || !pendingWindowBatchFocusFiltered) return
    window.dispatchEvent(new CustomEvent('devhub:window-batch-focus-filtered'))
    setPendingWindowBatchFocusFiltered(false)
  }, [mainView, pendingWindowBatchFocusFiltered])

  // Scanner initialization
  const scannerInitialize = useScannerStore(s => s.initialize)
  const scannerInitStatus = useScannerStore(s => s.initStatus)
  const applySnapshot = useScannerStore(s => s.applySnapshot)
  const applyProcessesDiff = useScannerStore(s => s.applyProcessesDiff)
  const applyPortsDiff = useScannerStore(s => s.applyPortsDiff)
  const applyWindowsDiff = useScannerStore(s => s.applyWindowsDiff)
  const applyAiTasksDiff = useScannerStore(s => s.applyAiTasksDiff)
  const updateSummary = useScannerStore(s => s.updateSummary)

  // Store refs to avoid stale closures in IPC listeners
  const applyProcessesDiffRef = useRef(applyProcessesDiff)
  const applyPortsDiffRef = useRef(applyPortsDiff)
  const applyWindowsDiffRef = useRef(applyWindowsDiff)
  const applyAiTasksDiffRef = useRef(applyAiTasksDiff)
  const applySnapshotRef = useRef(applySnapshot)
  const updateSummaryRef = useRef(updateSummary)
  applyProcessesDiffRef.current = applyProcessesDiff
  applyPortsDiffRef.current = applyPortsDiff
  applyWindowsDiffRef.current = applyWindowsDiff
  applyAiTasksDiffRef.current = applyAiTasksDiff
  applySnapshotRef.current = applySnapshot
  updateSummaryRef.current = updateSummary

  // Initialize scanner and wire up diff listeners
  useEffect(() => {
    if (!window.devhub?.scanner) return

    // Wire up diff listeners
    const unsubProcesses = window.devhub.scanner.onProcessesDiff((diff) => {
      applyProcessesDiffRef.current(diff)
    })
    const unsubPorts = window.devhub.scanner.onPortsDiff((diff) => {
      applyPortsDiffRef.current(diff)
    })
    const unsubWindows = window.devhub.scanner.onWindowsDiff((diff) => {
      applyWindowsDiffRef.current(diff)
    })
    const unsubAiTasks = window.devhub.scanner.onAiTasksDiff((diff) => {
      applyAiTasksDiffRef.current(diff)
    })
    const unsubSummary = window.devhub.scanner.onSummaryUpdate((summary) => {
      updateSummaryRef.current(summary)
    })
    const unsubSnapshotPush = window.devhub.scanner.onSnapshotPush((snapshot) => {
      applySnapshotRef.current(snapshot)
    })

    // Initialize: subscribe + fetch snapshot
    void scannerInitialize()

    return () => {
      unsubProcesses()
      unsubPorts()
      unsubWindows()
      unsubAiTasks()
      unsubSummary()
      unsubSnapshotPush()
    }
  }, [scannerInitialize])

  // Auto-dismiss init screen after a timeout (max 5 seconds)
  useEffect(() => {
    if (scannerInitStatus === 'ready' || initDismissed) return
    const timer = setTimeout(() => {
      setInitDismissed(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [scannerInitStatus, initDismissed])

  // Show init screen only during initial loading (not after first ready)
  const showInitScreen = scannerInitStatus === 'loading' && !initDismissed

  const handleAddProject = useCallback(async (path: string) => {
    try {
      await addProject(path)
      showToast('success', '项目添加成功')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '添加项目失败')
      throw error
    }
  }, [addProject, showToast])

  // 监听首次启动项目自动发现
  useEffect(() => {
    if (!window.devhub?.projects?.onAutoDiscovered) return

    const unsubscribe = window.devhub.projects.onAutoDiscovered((projects) => {
      if (projects.length > 0) {
        setDiscoveredProjects(projects)
        setShowAutoDiscovery(true)
      }
    })
    return unsubscribe
  }, [])

  const handleAutoDiscoveryImport = useCallback(async (projects: Array<{ path: string; name: string; scripts: string[] }>) => {
    let successCount = 0
    for (const project of projects) {
      try {
        await addProject(project.path)
        successCount++
      } catch {
        // Skip projects that fail to add
      }
    }
    if (successCount > 0) {
      showToast('success', `已导入 ${successCount} 个项目${successCount < projects.length ? `（${projects.length - successCount} 个失败）` : ''}`)
    } else {
      showToast('error', '导入失败，请手动添加项目')
    }
    setShowAutoDiscovery(false)
    setDiscoveredProjects([])
  }, [addProject, showToast])

  // 监听窗口关闭确认事件 - window.devhub 在非 Electron 环境下不存在
  useEffect(() => {
    if (!window.devhub?.window?.onCloseConfirm) return

    const unsubscribe = window.devhub.window.onCloseConfirm(() => {
      setShowCloseConfirm(true)
    })
    return unsubscribe
  }, [])

  if (showInitScreen) {
    return (
      <div className="h-screen flex flex-col bg-surface-950 text-text-primary overflow-hidden">
        <TitleBar decorationConfig={themeDecoration.config} />
        <div className="flex-1 overflow-hidden">
          <InitializationScreen onReady={() => setInitDismissed(true)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-surface-950 text-text-primary overflow-hidden">
      <SkipLink />
      <ThemeDecoration config={themeDecoration.config} position="global-background" />
      <DrawerProvider>
        {/* Title Bar */}
        <TitleBar decorationConfig={themeDecoration.config} />

        <DrawerSystemHost>
          {/* Main Content */}
          <div
            ref={shellRef}
            className="h-full w-full flex overflow-hidden responsive-app-shell responsive-container"
            data-layout-mode={shellMode}
            data-layout-preference={layoutModePreference}
            data-layout-breakpoint={shellSize.breakpoint}
            data-layout-density={shellSize.density}
          >
            {/* Sidebar */}
            <Sidebar onSettingsClick={() => setShowSettings(true)} onTopologyClick={openTopologyGlobal} />

            {/* Main Area */}
            <div id="main-content" role="main" tabIndex={-1} className="flex-1 flex flex-col overflow-hidden main-content">
              {/* Split View -- PanelSplitter handles the resize bar */}
              <div className="flex-1 flex overflow-hidden">
                <PanelSplitter
                  direction="horizontal"
                  defaultSizes={DEFAULT_SPLIT}
                  minSizes={[PANEL_MIN_PX, 400]}
                  storageKey={SPLIT_STORAGE_KEY}
                  stackBelow={900}
                >
                  {/* Left Pane: Project List */}
                  <div className="h-full border-r-2 border-surface-700 overflow-hidden bg-surface-900/50 relative flex flex-col panel-container">
                    {/* Diagonal decoration */}
                    <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />
                    {/* Hero Stats */}
                    <HeroStats />
                    {/* Project List */}
                    <div className="flex-1 overflow-hidden">
                      <ProjectList
                        onAddProject={() => setShowAddDialog(true)}
                        decorationConfig={themeDecoration.config}
                      />
                    </div>
                  </div>

                  {/* Right Pane: Log / Monitor */}
                  <div className="h-full overflow-hidden flex flex-col relative panel-container">
                    {/* View Toggle Header */}
                    <div className="flex-shrink-0 px-4 py-2 border-b-2 border-surface-700 bg-surface-900 flex items-center gap-1 relative z-10">
                      {/* Diagonal decoration */}
                      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />
                      <ThemeDecoration config={themeDecoration.config} position="header" />

                      <KeyboardNavGroup ariaLabel="Main view navigation" className="flex items-center gap-1 relative z-10">
                        <ViewToggleButton
                          active={mainView === 'logs'}
                          onClick={() => setMainView('logs')}
                          icon={<LogIcon size={16} />}
                          label="日志"
                        />
                        <ViewToggleButton
                          active={mainView === 'monitor'}
                          onClick={() => setMainView('monitor')}
                          icon={<MonitorIcon size={16} />}
                          label="监控"
                        />
                        <ViewToggleButton
                          active={mainView === 'dashboard'}
                          onClick={openDashboard}
                          icon={<GridIcon size={16} />}
                          label="仪表板"
                          testId="nav-dashboard"
                        />
                      </KeyboardNavGroup>

                      {/* Active indicator line */}
                      <div
                        className="absolute bottom-0 h-0.5 bg-accent transition-all duration-300"
                        style={{
                          left: mainView === 'logs' ? '16px' : mainView === 'monitor' ? '92px' : '168px',
                          width: '64px'
                        }}
                      />
                    </div>

                    {/* View Content */}
                    <div className="flex-1 overflow-hidden relative">
                      {/* Diagonal decoration */}
                      <div className="absolute inset-0 deco-diagonal opacity-3 pointer-events-none" />
                      <ThemeDecoration config={themeDecoration.config} position="detail-panel-background" />

                      {mainView === 'logs' ? (
                        <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-text-muted">日志面板出错，请刷新</div>}>
                          <LogPanel
                            projectId={selectedProjectId}
                            projectName={selectedProject?.name || ''}
                          />
                        </ErrorBoundary>
                      ) : mainView === 'monitor' ? (
                        <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-text-muted">监控面板出错，请刷新</div>}>
                          <MonitorPanel />
                        </ErrorBoundary>
                      ) : mainView === 'dashboard' ? (
                        <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-text-muted">仪表板出错，请刷新</div>}>
                          <Dashboard />
                        </ErrorBoundary>
                      ) : (
                        <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-text-muted">拓扑面板出错，请刷新</div>}>
                          <FullScreenTopologyView />
                        </ErrorBoundary>
                      )}
                    </div>
                  </div>
                </PanelSplitter>
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <StatusBar onTopologyClick={openTopologyGlobal} decorationConfig={themeDecoration.config} />
        </DrawerSystemHost>
      </DrawerProvider>
      <ToastHost />
      <InjectCountdownHost />
      <InjectFirstTimeHost />

      <R8CommandPalette
        open={showCommandPalette}
        onClose={hideCommandPalette}
        returnFocusTo={commandPaletteReturnFocusRef.current}
      />

      {/* Add Project Dialog */}
      <AddProjectDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddProject}
      />

      {/* Settings Panel */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Auto Discovery Dialog */}
      <AutoDiscoveryDialog
        isOpen={showAutoDiscovery}
        projects={discoveredProjects}
        onImport={handleAutoDiscoveryImport}
        onClose={() => {
          setShowAutoDiscovery(false)
          setDiscoveredProjects([])
        }}
      />

      {/* Close Confirm Dialog */}
      <CloseConfirmDialog
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
      />
    </div>
  )
}

// View Toggle Button Component with Soviet styling
function ViewToggleButton({
  active,
  onClick,
  icon,
  label,
  testId,
  ...buttonProps
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  testId?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick' | 'type'>) {
  return (
    <button
      {...buttonProps}
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={`
        flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 relative z-10
        border-l-2
        ${active
          ? 'bg-accent/15 text-accent border-accent'
          : 'text-text-secondary hover:bg-surface-800 hover:text-text-primary border-transparent hover:border-surface-500'
        }
       radius-sm`}
    >
      <span className={active ? 'text-accent' : 'text-text-muted'}>{icon}</span>
      <span
        className="uppercase tracking-wide"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '12px'
        }}
      >
        {label}
      </span>
    </button>
  )
}

function AppWithDevObservability() {
  const { showToast } = useToast()
  const [showDevObservability, setShowDevObservability] = useState(false)
  const observabilityEnabled = Boolean(window.devhub?.devObs || window.devhub?.r8?.obs)
  const reactCommitProfiler = useReactCommitProfiler()
  const runtimeMetrics = useRuntimeMetrics({
    enabled: observabilityEnabled,
    getReactCommitReport: reactCommitProfiler.getReport,
    resetReactCommitReport: reactCommitProfiler.reset
  })

  useEffect(() => {
    if (!observabilityEnabled) {
      setShowDevObservability(false)
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const lowerKey = event.key.toLowerCase()
      const pressedPrimary = event.ctrlKey && event.shiftKey && lowerKey === 'd'
      const pressedFallback = event.ctrlKey && event.altKey && lowerKey === 'd'

      if (!pressedPrimary && !pressedFallback) {
        if (event.key === 'Escape') {
          setShowDevObservability(false)
        }
        return
      }

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (tagName && ['input', 'textarea', 'select'].includes(tagName)) {
        return
      }

      event.preventDefault()
      setShowDevObservability((current) => !current)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [observabilityEnabled])

  useEffect(() => {
    if (!observabilityEnabled) {
      return
    }

    const applyHashRoute = () => {
      if (window.location.hash === '#/observability' || window.location.pathname.endsWith('/observability')) {
        setShowDevObservability(true)
      }
    }

    applyHashRoute()
    window.addEventListener('hashchange', applyHashRoute)
    return () => window.removeEventListener('hashchange', applyHashRoute)
  }, [observabilityEnabled])

  const handleExport = useCallback(async () => {
    try {
      const result = await runtimeMetrics.exportBundle()
      showToast('success', `诊断包已导出到 ${result.path}`)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '诊断包导出失败')
    }
  }, [runtimeMetrics, showToast])

  const handleReset = useCallback(async () => {
    try {
      await runtimeMetrics.resetMetrics()
      showToast('success', '开发者观测数据已重置')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '开发者观测重置失败')
    }
  }, [runtimeMetrics, showToast])

  const handleObservationExport = useCallback(async (format: 'json' | 'csv') => {
    try {
      const result = await runtimeMetrics.exportSnapshot(format)
      showToast('success', `Observability ${format.toUpperCase()} exported to ${result.filePath}`)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Observability export failed')
    }
  }, [runtimeMetrics, showToast])

  const profiledContent = observabilityEnabled ? (
    <Profiler id="app-root" onRender={reactCommitProfiler.onRender}>
      <CommitTelemetryProbe id="app-root" recordCommit={reactCommitProfiler.recordCommit} />
      <AppContent />
    </Profiler>
  ) : (
    <AppContent />
  )

  return (
    <>
      {profiledContent}
      <DevObservabilityPanel
        error={runtimeMetrics.error}
        hotkeyLabel="Ctrl+Shift+D / Ctrl+Alt+D"
        isRefreshing={runtimeMetrics.isRefreshing}
        onClose={() => setShowDevObservability(false)}
        onExport={() => { void handleExport() }}
        onExportObservationCsv={() => { void handleObservationExport('csv') }}
        onExportObservationJson={() => { void handleObservationExport('json') }}
        onRefresh={() => { void runtimeMetrics.refresh() }}
        onReset={() => { void handleReset() }}
        observabilitySnapshot={runtimeMetrics.observabilitySnapshot}
        open={observabilityEnabled && showDevObservability}
        snapshot={runtimeMetrics.snapshot}
        subscribeObservability={runtimeMetrics.subscribeObservability}
        throttleReport={runtimeMetrics.throttleReport}
      />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppWithDevObservability />
      </ToastProvider>
    </ErrorBoundary>
  )
}
