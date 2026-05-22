import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortInfo, ProcessInfo } from '@shared/types-extended'
import { ToastProvider } from '../ui/Toast'
import { ProcessView } from './ProcessView'
import { PortView } from './PortView'

const useSystemProcessesMock = vi.hoisted(() => vi.fn())
const useProcessSelectionMock = vi.hoisted(() => vi.fn())
const useProcessTagRegistryMock = vi.hoisted(() => vi.fn())
const useProcessHistory24hMock = vi.hoisted(() => vi.fn())
const usePortsMock = vi.hoisted(() => vi.fn())
const useBlocklistMock = vi.hoisted(() => vi.fn())
const usePortPopoutManagerMock = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/useSystemProcesses', () => ({
  useSystemProcesses: useSystemProcessesMock
}))

vi.mock('../../hooks/useProcessSelection', () => ({
  useProcessSelection: useProcessSelectionMock
}))

vi.mock('../../hooks/useProcessTag', () => ({
  useProcessTagRegistry: useProcessTagRegistryMock
}))

vi.mock('../../hooks/useProcessHistory', () => ({
  useProcessHistory24h: useProcessHistory24hMock
}))

vi.mock('../../hooks/usePorts', () => ({
  usePorts: usePortsMock
}))

vi.mock('../../hooks/useBlocklist', () => ({
  useBlocklist: useBlocklistMock
}))

vi.mock('../popout/usePortPopoutManager', () => ({
  usePortPopoutManager: usePortPopoutManagerMock
}))

vi.mock('../popout/PortPopoutHost', () => ({
  PortPopoutHost: () => null
}))

vi.mock('./PortRelationshipGraph', () => ({
  PortRelationshipGraph: ({ focusPort }: { focusPort?: number | null }) => (
    <div data-testid="port-relationship-graph" data-focus-port={String(focusPort ?? '')} />
  )
}))

vi.mock('./PortFocusPanel', () => ({
  PortFocusPanel: ({ port }: { port: PortInfo }) => (
    <div data-testid="port-focus-panel" data-port={String(port.port)} />
  )
}))

const processInfo: ProcessInfo = {
  pid: 1234,
  name: 'node.exe',
  command: 'pnpm dev',
  cpu: 4,
  memory: 128,
  status: 'running',
  projectId: 'project-1',
  startTime: 1,
  type: 'dev-server',
  workingDir: 'D:/repo/devhub',
  port: 3000
}

const portInfo: PortInfo = {
  port: 3000,
  pid: 1234,
  processName: 'node.exe',
  state: 'LISTENING',
  protocol: 'TCP',
  localAddress: '127.0.0.1',
  foreignAddress: '*:*'
}

function configureProcessView(processRows: ProcessInfo[] = [processInfo], options: { resolveHistory?: boolean } = {}) {
  const selectProcess = vi.fn()
  const pendingHistory = new Promise<{ cpuHistory: number[]; memoryHistory: number[] }>(() => undefined)
  window.localStorage.setItem('devhub:process-view-mode', 'card')
  useSystemProcessesMock.mockReturnValue({
    processes: processRows,
    groups: [],
    zombies: [],
    isScanning: false,
    lastScanTime: new Date(1),
    selectedPid: null,
    sortConfigs: [],
    searchQuery: '',
    statusFilters: new Set<string>(),
    typeFilters: new Set<string>(),
    scan: vi.fn().mockResolvedValue(processRows),
    getGroups: vi.fn().mockResolvedValue([]),
    killProcess: vi.fn().mockResolvedValue(true),
    cleanupZombies: vi.fn().mockResolvedValue(0),
    selectProcess,
    getTotalResources: vi.fn(() => ({ cpu: 4, memory: 128 })),
    getFullRelationship: vi.fn().mockResolvedValue(null),
    getProcessHistory: options.resolveHistory
      ? vi.fn().mockResolvedValue({ cpuHistory: [], memoryHistory: [] })
      : vi.fn(() => pendingHistory),
    getBasicInfo: vi.fn().mockResolvedValue(processInfo),
    getDeepDetail: vi.fn().mockResolvedValue(null),
    probeAccess: vi.fn().mockResolvedValue(null),
    getConnections: vi.fn().mockResolvedValue([]),
    getEnvironment: vi.fn().mockResolvedValue({ variables: {}, requiresElevation: false }),
    killProcessTree: vi.fn().mockResolvedValue(true),
    setProcessPriority: vi.fn().mockResolvedValue(true),
    openFileLocation: vi.fn().mockResolvedValue(true),
    getModules: vi.fn().mockResolvedValue({ modules: [], requiresElevation: false }),
    relaunchAsAdmin: vi.fn().mockResolvedValue({ ok: true }),
    toggleSort: vi.fn(),
    clearSort: vi.fn(),
    setSearchQuery: vi.fn(),
    toggleStatusFilter: vi.fn(),
    toggleTypeFilter: vi.fn(),
    clearFilters: vi.fn(),
    getFilteredAndSortedProcesses: vi.fn(() => processRows)
  })
  useProcessSelectionMock.mockReturnValue({
    selectedPids: new Set<number>(),
    selectedPidList: [],
    selectedCount: 0,
    clearSelection: vi.fn(),
    pruneSelection: vi.fn(),
    selectAll: vi.fn(),
    selectPid: vi.fn()
  })
  useProcessTagRegistryMock.mockReturnValue({
    getTag: vi.fn(() => undefined),
    setTag: vi.fn().mockResolvedValue(undefined),
    removeTag: vi.fn().mockResolvedValue(undefined)
  })
  useProcessHistory24hMock.mockReturnValue({
    getHistory: vi.fn(() => undefined),
    loadHistories: vi.fn().mockResolvedValue(undefined)
  })

  return { selectProcess }
}

function configurePortView() {
  const selectPort = vi.fn()
  usePortsMock.mockReturnValue({
    ports: [portInfo],
    conflicts: [],
    isScanning: false,
    lastScanTime: new Date(1),
    selectedPort: null,
    scan: vi.fn().mockResolvedValue([portInfo]),
    releasePort: vi.fn().mockResolvedValue(true),
    selectPort,
    getActiveConflicts: vi.fn(() => []),
    getPortFocusData: vi.fn().mockResolvedValue(null),
    getPortDetailIncremental: vi.fn().mockResolvedValue({ data: null, source: 'cache', isStale: true }),
    cancelPortQuery: vi.fn().mockResolvedValue(true)
  })
  useBlocklistMock.mockReturnValue({
    entries: [],
    isLoading: false,
    error: null,
    reload: vi.fn().mockResolvedValue(undefined),
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    resetDefaults: vi.fn()
  })
  usePortPopoutManagerMock.mockReturnValue({
    popouts: [],
    open: vi.fn(),
    close: vi.fn(),
    pin: vi.fn(),
    move: vi.fn(),
    promote: vi.fn().mockResolvedValue({ ok: false, reason: 'unavailable' }),
    isOpen: vi.fn(() => false)
  })

  return { selectPort }
}

describe('monitor card edge graph badges', () => {
  beforeEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
    configureProcessView()
    configurePortView()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispatches a real process topology navigation event from the process card badge', () => {
    const events: Array<CustomEvent> = []
    const listener = (event: Event) => events.push(event as CustomEvent)
    window.addEventListener('devhub:monitor-navigate', listener)

    render(
      <ToastProvider>
        <ProcessView />
      </ToastProvider>
    )

    const badge = screen.getByTestId('process-card-graph-badge-1234')
    expect(badge).toHaveAttribute('title', '查看关系图')
    expect(badge).toHaveAttribute('data-graph-entry', 'process-card-attached-topology')
    expect(badge).toHaveAttribute('data-graph-kind', 'attached')

    fireEvent.click(badge)

    expect(events).toHaveLength(1)
    expect(events[0].detail).toEqual({
      tab: 'process',
      scope: { kind: 'process', targetId: 1234, depth: 2 }
    })

    window.removeEventListener('devhub:monitor-navigate', listener)
  })

  it('exposes a persisted three-step process module tour', () => {
    render(
      <ToastProvider>
        <ProcessView />
      </ToastProvider>
    )

    const tour = screen.getByTestId('process-module-tour')
    expect(tour).toHaveAttribute('data-tour-total-steps', '3')
    expect(tour).toHaveAttribute('data-tour-step-id', 'view-switch')
    expect(tour).toHaveAttribute('data-tour-real-process-count', '1')
    expect(tour).toHaveTextContent('PID 1234 / node.exe')

    fireEvent.click(screen.getByTestId('process-module-tour-next'))
    expect(screen.getByTestId('process-module-tour')).toHaveAttribute('data-tour-step-id', 'relationship')

    fireEvent.click(screen.getByTestId('process-module-tour-next'))
    expect(screen.getByTestId('process-module-tour')).toHaveAttribute('data-tour-step-id', 'operation-menu')

    fireEvent.click(screen.getByTestId('process-module-tour-done'))
    expect(window.localStorage.getItem('devhub:process-module-tour:v1')).toBe('dismissed')
    expect(screen.queryByTestId('process-module-tour')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('process-module-tour-open-button'))
    expect(screen.getByTestId('process-module-tour')).toHaveAttribute('data-tour-step-id', 'view-switch')
  })

  it('runs process tour actions through real view, relationship, and menu paths', async () => {
    const { selectProcess } = configureProcessView()
    const events: Array<CustomEvent> = []
    const listener = (event: Event) => events.push(event as CustomEvent)
    window.addEventListener('devhub:monitor-navigate', listener)

    render(
      <ToastProvider>
        <ProcessView />
      </ToastProvider>
    )

    fireEvent.click(screen.getByTestId('process-module-tour-action-view-switch'))
    expect(screen.getByTestId('process-module-tour')).toHaveAttribute('data-tour-current-view', 'list')
    expect(selectProcess).toHaveBeenCalledWith(1234)

    fireEvent.click(screen.getByTestId('process-module-tour-next'))
    fireEvent.click(screen.getByTestId('process-module-tour-action-relationship'))
    expect(selectProcess).toHaveBeenCalledWith(1234)
    expect(events).toContainEqual(expect.objectContaining({
      detail: {
        tab: 'process',
        scope: { kind: 'process', targetId: 1234, depth: 2 }
      }
    }))

    fireEvent.click(screen.getByTestId('process-module-tour-next'))
    fireEvent.click(screen.getByTestId('process-module-tour-action-operation-menu'))
    expect(await screen.findByTestId('process-card-1234')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '复制 PID' })).toBeInTheDocument()

    window.removeEventListener('devhub:monitor-navigate', listener)
  })

  it('keeps process tour actions disabled when no real processes are scanned', () => {
    configureProcessView([])

    render(
      <ToastProvider>
        <ProcessView />
      </ToastProvider>
    )

    const action = screen.getByTestId('process-module-tour-action-view-switch')
    expect(action).toBeDisabled()
    fireEvent.click(action)

    expect(screen.getByTestId('process-module-tour')).toHaveAttribute('data-tour-real-process-count', '0')
    expect(screen.getByTestId('process-module-tour-no-process')).toHaveTextContent('不创建示例进程')
    expect(screen.queryByTestId('process-card-1234')).not.toBeInTheDocument()
  })

  it('shows the process module NEW badge only during the R8 thirty-day release window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T00:00:00+08:00'))

    const activeRender = render(
      <ToastProvider>
        <ProcessView />
      </ToastProvider>
    )

    const badge = screen.getByTestId('process-module-new-badge')
    expect(badge).toHaveTextContent('NEW')
    expect(badge).toHaveAttribute('data-r8-release-window-status', 'active')
    expect(badge).toHaveAttribute('data-release-window-days', '30')
    expect(Number(badge.getAttribute('data-release-window-remaining-days'))).toBeGreaterThan(0)

    activeRender.unmount()
    vi.setSystemTime(new Date('2026-06-20T00:00:00+08:00'))

    render(
      <ToastProvider>
        <ProcessView />
      </ToastProvider>
    )

    expect(screen.queryByTestId('process-module-new-badge')).not.toBeInTheDocument()
  })

  it('opens process module contextual help from F1 and the header help entry', () => {
    render(
      <ToastProvider>
        <ProcessView />
      </ToastProvider>
    )

    fireEvent.keyDown(window, { key: 'F1' })

    const dialog = screen.getByTestId('process-module-help-dialog')
    expect(dialog).toHaveAttribute('data-help-scope', 'process')
    expect(dialog).toHaveAttribute('data-help-shortcut', 'F1')
    expect(dialog).toHaveAttribute('data-real-process-count', '1')
    expect(dialog).toHaveAttribute('data-current-view', 'card')
    expect(dialog).toHaveTextContent('SystemProcessScanner')
    expect(dialog).toHaveTextContent('PID 1234 / node.exe')
    expect(dialog).toHaveTextContent('不会创建示例进程')

    fireEvent.click(screen.getByTestId('process-module-help-close'))
    expect(screen.queryByTestId('process-module-help-dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('process-module-help-open-button'))
    expect(screen.getByTestId('process-module-help-dialog')).toHaveAttribute('data-help-shortcut', 'F1')
  })

  it('keeps process module help honest when no real processes exist', () => {
    configureProcessView([])

    render(
      <ToastProvider>
        <ProcessView />
      </ToastProvider>
    )

    fireEvent.keyDown(window, { key: 'F1' })

    const dialog = screen.getByTestId('process-module-help-dialog')
    expect(dialog).toHaveAttribute('data-real-process-count', '0')
    expect(dialog).toHaveTextContent('当前没有真实进程目标')
    expect(dialog).toHaveTextContent('不生成样例数据')
    expect(screen.queryByTestId('process-card-1234')).not.toBeInTheDocument()
  })

  it('opens the real port relationship surface from the port card badge', async () => {
    const { selectPort } = configurePortView()
    render(<PortView />)

    const badge = screen.getByTestId('port-card-graph-badge-3000-1234')
    expect(badge).toHaveAttribute('title', '查看关系图')
    expect(badge).toHaveAttribute('data-graph-entry', 'port-card-attached-topology')
    expect(badge).toHaveAttribute('data-graph-kind', 'attached')

    fireEvent.click(badge)

    expect(selectPort).toHaveBeenCalledWith(3000)
    expect(await screen.findByTestId('port-relationship-graph')).toBeInTheDocument()
    expect(screen.getByTestId('port-focus-panel')).toHaveAttribute('data-port', '3000')
  })
})
