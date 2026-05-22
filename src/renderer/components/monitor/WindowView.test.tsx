import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WindowInfo } from '@shared/types-extended'
import { ToastProvider } from '../ui/Toast'
import { WindowView } from './WindowView'

const useWindowsMock = vi.hoisted(() => vi.fn())
const useAITasksMock = vi.hoisted(() => vi.fn())
const useAliasStoreMock = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/useWindows', () => ({
  useWindows: useWindowsMock
}))

vi.mock('../../hooks/useAITasks', () => ({
  useAITasks: useAITasksMock
}))

vi.mock('../../stores/aliasStore', () => ({
  useAliasStore: useAliasStoreMock
}))

vi.mock('../../stores/portStore', () => ({
  usePortStore: (selector: (state: { ports: [] }) => unknown) => selector({ ports: [] })
}))

vi.mock('./attached/AttachedGraphView', () => ({
  AttachedGraphView: ({ scope }: { scope: { kind: string; targetId: string | number } }) => (
    <div data-testid="attached-graph-view" data-root-kind={scope.kind} data-root-id={String(scope.targetId)} />
  )
}))

vi.mock('./attached/AttachedFlowView', () => ({
  AttachedFlowView: ({ scope }: { scope: { kind: string; targetId: string | number } }) => (
    <div data-testid="attached-flow-view" data-root-kind={scope.kind} data-root-id={String(scope.targetId)} />
  )
}))

const selectedWindow: WindowInfo = {
  hwnd: 9001,
  title: 'DevHub',
  processName: 'devhub.exe',
  pid: 1234,
  className: 'Chrome_WidgetWin_1',
  rect: { x: 0, y: 0, width: 1024, height: 768 },
  isVisible: true,
  isMinimized: false,
  isSystemWindow: false
}

function configureHooks(windowRows: WindowInfo[] = [selectedWindow], options: { sendKeysResult?: boolean; topmostHwnds?: number[] } = {}) {
  const selectWindow = vi.fn()
  const focusWindow = vi.fn().mockResolvedValue(true)
  const setWindowTopmost = vi.fn().mockResolvedValue(true)
  const sendKeysToWindow = vi.fn().mockResolvedValue(options.sendKeysResult ?? true)
  const closeWindow = vi.fn().mockResolvedValue(true)
  const moveWindow = vi.fn().mockResolvedValue(true)
  const minimizeWindow = vi.fn().mockResolvedValue(true)
  const maximizeWindow = vi.fn().mockResolvedValue(true)
  const setWindowOpacity = vi.fn().mockResolvedValue(true)
  useWindowsMock.mockReturnValue({
    windows: windowRows,
    groups: [],
    layouts: [],
    isScanning: false,
    selectedHwnd: windowRows[0]?.hwnd ?? null,
    selectedGroupId: null,
    scan: vi.fn().mockResolvedValue(windowRows),
    focusWindow,
    focusGroup: vi.fn().mockResolvedValue(true),
    createGroup: vi.fn().mockResolvedValue(null),
    fetchGroups: vi.fn().mockResolvedValue([]),
    removeGroup: vi.fn().mockResolvedValue(true),
    renameGroup: vi.fn().mockResolvedValue(true),
    minimizeGroup: vi.fn().mockResolvedValue(true),
    closeGroup: vi.fn().mockResolvedValue(true),
    saveLayout: vi.fn().mockResolvedValue(null),
    saveSnapshot: vi.fn().mockResolvedValue(null),
    restoreLayout: vi.fn().mockResolvedValue(true),
    fetchLayouts: vi.fn().mockResolvedValue([]),
    removeLayout: vi.fn().mockResolvedValue(true),
    restorePreviousLayout: vi.fn().mockResolvedValue(true),
    screenshotWindow: vi.fn().mockResolvedValue({ success: true }),
    toggleFavoriteWindow: vi.fn().mockResolvedValue({ success: true }),
    getFavoriteWindows: vi.fn().mockResolvedValue([]),
    openWorkingDir: vi.fn().mockResolvedValue({ success: true }),
    selectWindow,
    selectGroup: vi.fn(),
    moveWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow: vi.fn().mockResolvedValue(true),
    closeWindow,
    setWindowTopmost,
    listTopmostWindows: vi.fn().mockResolvedValue(options.topmostHwnds ?? []),
    setWindowOpacity,
    setWindowTitle: vi.fn().mockResolvedValue(true),
    sendKeysToWindow,
    tileWindows: vi.fn().mockResolvedValue({ ok: true }),
    cascadeWindows: vi.fn().mockResolvedValue({ ok: true }),
    stackWindows: vi.fn().mockResolvedValue({ ok: true })
  })

  useAITasksMock.mockReturnValue({
    activeTasks: [],
    fetchActiveTasks: vi.fn().mockResolvedValue([])
  })

  useAliasStoreMock.mockReturnValue({
    aliases: [],
    fetchAliases: vi.fn().mockResolvedValue(undefined),
    renameAndApply: vi.fn().mockResolvedValue({ success: true, titleApplied: false })
  })

  return { selectWindow, focusWindow, setWindowTopmost, sendKeysToWindow, closeWindow, moveWindow, minimizeWindow, maximizeWindow, setWindowOpacity }
}

function setElementRect(element: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => ({})
    })
  })
}

describe('WindowView attached topology header button', () => {
  beforeEach(() => {
    configureHooks()
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('focuses the selected window relationship panel from the top action bar', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    const relationPanel = await screen.findByTestId('window-relationship-panel')
    fireEvent.click(screen.getByTestId('window-attached-topology-button'))

    expect(relationPanel).toHaveAttribute('data-graph-entry', 'window-detail-panel')
    expect(relationPanel).toHaveAttribute('data-graph-kind', 'attached')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(relationPanel).toHaveFocus()
    expect(screen.getByTestId('attached-graph-view')).toHaveAttribute('data-root-id', String(selectedWindow.hwnd))
    expect(screen.getByTestId('attached-flow-view')).toHaveAttribute('data-root-id', String(selectedWindow.hwnd))
  })

  it('opens the global topology with the selected window node id', async () => {
    const events: Event[] = []
    const openGlobal = (event: Event) => events.push(event)
    window.addEventListener('devhub:open-topology-global', openGlobal)

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    fireEvent.click(await screen.findByTestId('window-global-topology-button'))

    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe(`window-${selectedWindow.hwnd}`)
    expect(events).toHaveLength(1)

    window.removeEventListener('devhub:open-topology-global', openGlobal)
  })

  it('exposes a card edge graph badge that focuses the real relationship panel', async () => {
    const { selectWindow } = configureHooks()
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    const relationPanel = await screen.findByTestId('window-relationship-panel')
    const badge = await screen.findByTestId(`window-card-graph-badge-${selectedWindow.hwnd}`)

    expect(badge).toHaveAttribute('title', '查看关系图')
    expect(badge).toHaveAttribute('data-graph-entry', 'window-card-attached-topology')
    expect(badge).toHaveAttribute('data-graph-kind', 'attached')

    fireEvent.click(badge)

    expect(selectWindow).toHaveBeenCalledWith(selectedWindow.hwnd)
    await vi.waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    })
    expect(relationPanel).toHaveFocus()
  })

  it('routes card focus quick action through visible success feedback', async () => {
    const { focusWindow } = configureHooks()

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    const focusButtons = await screen.findAllByTitle('聚焦窗口')
    await act(async () => {
      fireEvent.click(focusButtons[0])
      await Promise.resolve()
    })

    expect(focusWindow).toHaveBeenCalledWith(selectedWindow.hwnd)
    expect(await screen.findByText('窗口已前置')).toBeInTheDocument()
  })

  it('exposes a persisted three-step window module tour', async () => {
    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    const tour = await screen.findByTestId('window-module-tour')
    expect(tour).toHaveAttribute('data-tour-total-steps', '3')
    expect(tour).toHaveAttribute('data-tour-step-id', 'identity')
    expect(tour).toHaveAttribute('data-tour-real-window-count', '1')
    expect(tour).toHaveTextContent('HWND 9001 / PID 1234 / devhub.exe')

    fireEvent.click(screen.getByTestId('window-module-tour-next'))
    expect(screen.getByTestId('window-module-tour')).toHaveAttribute('data-tour-step-id', 'operations')
    expect(Number(screen.getByTestId('window-module-tour').getAttribute('data-tour-operation-count'))).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId('window-module-tour-next'))
    expect(screen.getByTestId('window-module-tour')).toHaveAttribute('data-tour-step-id', 'topmost')

    fireEvent.click(screen.getByTestId('window-module-tour-done'))
    expect(window.localStorage.getItem('devhub:window-module-tour:v1')).toBe('dismissed')
    expect(screen.queryByTestId('window-module-tour')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('window-module-tour-open-button'))
    expect(screen.getByTestId('window-module-tour')).toHaveAttribute('data-tour-step-id', 'identity')
  })

  it('runs window tour actions through the selected real window paths', async () => {
    const { selectWindow, setWindowTopmost } = configureHooks()
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    const relationPanel = await screen.findByTestId('window-relationship-panel')
    fireEvent.click(screen.getByTestId('window-module-tour-action-identity'))

    expect(selectWindow).toHaveBeenCalledWith(selectedWindow.hwnd)
    await vi.waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    })
    expect(relationPanel).toHaveFocus()

    fireEvent.click(screen.getByTestId('window-module-tour-next'))
    fireEvent.click(screen.getByTestId('window-module-tour-action-operations'))
    expect(screen.getByTestId(`window-operation-panel-${selectedWindow.hwnd}`)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('window-module-tour-next'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('window-module-tour-action-topmost'))
      await Promise.resolve()
    })

    await vi.waitFor(() => {
      expect(setWindowTopmost).toHaveBeenCalledWith(selectedWindow.hwnd, true)
    })
    expect(await screen.findByText('窗口已置顶')).toBeInTheDocument()
  })

  it('keeps window tour actions disabled when no real windows are scanned', async () => {
    configureHooks([])

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    const action = await screen.findByTestId('window-module-tour-action-identity')
    expect(action).toBeDisabled()
    fireEvent.click(action)

    expect(screen.getByTestId('window-module-tour')).toHaveAttribute('data-tour-real-window-count', '0')
    expect(screen.getByTestId('window-module-tour-no-window')).toHaveTextContent('不创建示例窗口')
    expect(screen.queryByTestId(`window-operation-panel-${selectedWindow.hwnd}`)).not.toBeInTheDocument()
  })

  it('shows hwnd, process identity, pid, and always-on-top state on cards and list rows', async () => {
    configureHooks([selectedWindow], { topmostHwnds: [selectedWindow.hwnd] })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    const card = await screen.findByTestId(`window-card-${selectedWindow.hwnd}`)
    expect(card).toHaveAttribute('data-window-instance-key', 'devhub.exe:1234:9001')
    expect(card).toHaveTextContent('DevHub')
    expect(card).toHaveTextContent('devhub.exe')
    expect(card).toHaveTextContent('PID: 1234')
    expect(card).toHaveTextContent('HWND: 9001')

    await vi.waitFor(() => {
      expect(screen.getByTestId(`window-card-topmost-${selectedWindow.hwnd}`)).toHaveAttribute('data-window-topmost', 'true')
    })
    expect(screen.getByTestId(`window-card-topmost-${selectedWindow.hwnd}`)).toHaveTextContent('置顶')

    fireEvent.click(document.querySelector('[data-view-mode="list"]') as HTMLElement)

    const row = await screen.findByTestId(`window-list-row-${selectedWindow.hwnd}`)
    expect(row).toHaveAttribute('data-window-instance-key', 'devhub.exe:1234:9001')
    expect(row).toHaveTextContent('devhub.exe')
    expect(row).toHaveTextContent('PID: 1234')
    expect(row).toHaveTextContent('HWND: 9001')
    expect(screen.getByTestId(`window-list-topmost-${selectedWindow.hwnd}`)).toHaveTextContent('置顶')
  })

  it('redacts sensitive values from rendered window titles', async () => {
    const sensitiveWindow: WindowInfo = {
      ...selectedWindow,
      title: 'DevHub token=tok-secret123456 api_key=sk-live123456789',
    }
    configureHooks([sensitiveWindow])

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    const card = await screen.findByTestId(`window-card-${sensitiveWindow.hwnd}`)
    expect(card).toHaveTextContent('DevHub token=[REDACTED]')
    expect(card).toHaveTextContent('api_key=[REDACTE')
    expect(card).not.toHaveTextContent('tok-secret123456')
    expect(card).not.toHaveTextContent('sk-live123456789')

    fireEvent.click(document.querySelector('[data-view-mode="list"]') as HTMLElement)

    const row = await screen.findByTestId(`window-list-row-${sensitiveWindow.hwnd}`)
    expect(row).toHaveTextContent('DevHub token=[REDACTED]')
    expect(row).toHaveTextContent('api_key=[REDACTE')
    expect(row).not.toHaveTextContent('tok-secret123456')
    expect(row).not.toHaveTextContent('sk-live123456789')
  })

  it('focuses only the current filtered windows from the command palette event', async () => {
    const otherWindow: WindowInfo = {
      ...selectedWindow,
      hwnd: 9002,
      title: 'Terminal',
      processName: 'WindowsTerminal.exe',
      pid: 2234
    }
    const { focusWindow } = configureHooks([selectedWindow, otherWindow])

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    fireEvent.change(await screen.findByPlaceholderText('搜索窗口...'), { target: { value: 'DevHub' } })
    expect(await screen.findByTestId(`window-card-${selectedWindow.hwnd}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`window-card-${otherWindow.hwnd}`)).not.toBeInTheDocument()

    await act(async () => {
      window.dispatchEvent(new CustomEvent('devhub:window-batch-focus-filtered'))
      await Promise.resolve()
    })

    await vi.waitFor(() => {
      expect(focusWindow).toHaveBeenCalledWith(selectedWindow.hwnd)
    })
    expect(focusWindow).not.toHaveBeenCalledWith(otherWindow.hwnd)
  })

  it('selects only current filtered windows with Ctrl+A before batch focus', async () => {
    const otherWindow: WindowInfo = {
      ...selectedWindow,
      hwnd: 9002,
      title: 'Terminal',
      processName: 'WindowsTerminal.exe',
      pid: 2234
    }
    const { focusWindow } = configureHooks([selectedWindow, otherWindow])

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    fireEvent.change(await screen.findByPlaceholderText('搜索窗口...'), { target: { value: 'DevHub' } })
    expect(await screen.findByTestId(`window-card-${selectedWindow.hwnd}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`window-card-${otherWindow.hwnd}`)).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'a', code: 'KeyA', ctrlKey: true })
      await Promise.resolve()
    })
    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-batch-action-focus'))
      await Promise.resolve()
    })

    await vi.waitFor(() => {
      expect(focusWindow).toHaveBeenCalledWith(selectedWindow.hwnd)
    })
    expect(focusWindow).not.toHaveBeenCalledWith(otherWindow.hwnd)
  })

  it('lasso-selects real rendered window cards and executes batch focus for the hit HWNDs', async () => {
    const windowRows = Array.from({ length: 3 }, (_, index): WindowInfo => ({
      ...selectedWindow,
      hwnd: 9201 + index,
      title: `DevHub ${index + 1}`,
      pid: 3201 + index
    }))
    const { focusWindow } = configureHooks(windowRows)

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    setElementRect(await screen.findByTestId('window-card-9201'), { left: 20, top: 20, width: 120, height: 80 })
    setElementRect(await screen.findByTestId('window-card-9202'), { left: 160, top: 20, width: 120, height: 80 })
    setElementRect(await screen.findByTestId('window-card-9203'), { left: 320, top: 20, width: 120, height: 80 })

    const lassoRegion = await screen.findByTestId('window-lasso-region')
    await act(async () => {
      fireEvent.pointerDown(lassoRegion, { button: 0, clientX: 0, clientY: 0 })
      await Promise.resolve()
    })
    await act(async () => {
      fireEvent.pointerMove(window, { clientX: 290, clientY: 130 })
      fireEvent.pointerUp(window, { clientX: 290, clientY: 130 })
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-batch-action-focus'))
      await Promise.resolve()
    })

    await vi.waitFor(() => {
      expect(focusWindow).toHaveBeenCalledWith(9201)
      expect(focusWindow).toHaveBeenCalledWith(9202)
    })
    expect(focusWindow).not.toHaveBeenCalledWith(9203)
  })

  it('retries only failed HWNDs from the last completed window batch', async () => {
    const failedWindow: WindowInfo = {
      ...selectedWindow,
      hwnd: 9002,
      title: 'Terminal',
      processName: 'WindowsTerminal.exe',
      pid: 2234
    }
    const { focusWindow } = configureHooks([selectedWindow, failedWindow])
    let failedOnce = false
    focusWindow.mockImplementation(async (hwnd: number) => {
      if (hwnd === failedWindow.hwnd && !failedOnce) {
        failedOnce = true
        return false
      }
      return true
    })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    fireEvent.click(await screen.findByTestId(`window-card-checkbox-${selectedWindow.hwnd}`))
    fireEvent.click(await screen.findByTestId(`window-card-checkbox-${failedWindow.hwnd}`))

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-batch-action-focus'))
      await Promise.resolve()
    })

    expect(await screen.findByTestId(`window-batch-result-${failedWindow.hwnd}`)).toHaveTextContent('operation returned false')

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-batch-progress-retry-failed'))
      await Promise.resolve()
    })

    await vi.waitFor(() => {
      expect(focusWindow).toHaveBeenCalledTimes(3)
    })
    expect(focusWindow).toHaveBeenNthCalledWith(1, selectedWindow.hwnd)
    expect(focusWindow).toHaveBeenNthCalledWith(2, failedWindow.hwnd)
    expect(focusWindow).toHaveBeenNthCalledWith(3, failedWindow.hwnd)
  })

  it('confirms the target window before sending safe keyboard events', async () => {
    const { sendKeysToWindow } = configureHooks()
    const promptSpy = vi.fn(() => 'Escape')
    const confirmSpy = vi.fn(() => true)
    Object.defineProperty(window, 'prompt', { configurable: true, value: promptSpy })
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirmSpy })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-op-send-safe-keys'))
      await Promise.resolve()
    })

    expect(promptSpy).toHaveBeenCalledWith('输入要发送的安全按键（Ctrl+C、Ctrl+D、Ctrl+Z、Enter、Escape）', 'Escape')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(await screen.findByTestId('window-batch-confirm-dialog')).toHaveTextContent('确认键盘注入')
    expect(screen.getByTestId('window-batch-confirm-dialog')).toHaveTextContent('HWND 9001 / DevHub / Escape')

    await act(async () => {
      fireEvent.click(screen.getByTestId('window-batch-confirm-ok'))
      await Promise.resolve()
    })

    expect(sendKeysToWindow).toHaveBeenCalledWith(selectedWindow.hwnd, 'Escape')
    expect(await screen.findByText('将向窗口 HWND 9001 / DevHub 发送键盘事件: Escape')).toBeInTheDocument()
    expect(await screen.findByText('键盘事件已发送到窗口 HWND 9001 / DevHub: Escape')).toBeInTheDocument()
  })

  it('shows a concrete failure message when safe keyboard injection fails', async () => {
    const { sendKeysToWindow } = configureHooks([selectedWindow], { sendKeysResult: false })
    const promptSpy = vi.fn(() => 'Ctrl+D')
    const confirmSpy = vi.fn(() => true)
    Object.defineProperty(window, 'prompt', { configurable: true, value: promptSpy })
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirmSpy })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-op-send-safe-keys'))
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-batch-confirm-ok'))
      await Promise.resolve()
    })

    expect(sendKeysToWindow).toHaveBeenCalledWith(selectedWindow.hwnd, 'Ctrl+D')
    expect(await screen.findByText('键盘事件注入失败: 窗口 HWND 9001 / DevHub / Ctrl+D')).toBeInTheDocument()
  })

  it('uses the custom batch confirm dialog before closing more than five selected windows', async () => {
    const windowRows = Array.from({ length: 6 }, (_, index): WindowInfo => ({
      ...selectedWindow,
      hwnd: 9101 + index,
      title: `DevHub ${index + 1}`,
      pid: 2000 + index
    }))
    const { closeWindow } = configureHooks(windowRows)
    const confirmSpy = vi.fn(() => true)
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirmSpy })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    for (const windowInfo of windowRows) {
      fireEvent.click(await screen.findByTestId(`window-card-checkbox-${windowInfo.hwnd}`))
    }

    fireEvent.click(await screen.findByTestId('window-batch-action-close'))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(await screen.findByTestId('window-batch-confirm-dialog')).toHaveTextContent('确认批量关闭')
    expect(screen.getByTestId('window-batch-confirm-dialog')).toHaveTextContent('目标 HWND: 9101, 9102, 9103, 9104, 9105, 9106')

    await act(async () => {
      fireEvent.click(screen.getByTestId('window-batch-confirm-ok'))
      await Promise.resolve()
    })

    await vi.waitFor(() => {
      expect(closeWindow).toHaveBeenCalledTimes(6)
    })
    expect(closeWindow).toHaveBeenNthCalledWith(1, 9101)
    expect(closeWindow).toHaveBeenNthCalledWith(6, 9106)
  })

  it('runs move and opacity operations through real window hooks', async () => {
    const { moveWindow, setWindowOpacity } = configureHooks()
    const promptSpy = vi.fn()
      .mockReturnValueOnce('10,20,800,600')
      .mockReturnValueOnce('85')
    const confirmSpy = vi.fn(() => true)
    Object.defineProperty(window, 'prompt', { configurable: true, value: promptSpy })
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirmSpy })

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-op-move-resize'))
      await Promise.resolve()
    })

    expect(promptSpy).toHaveBeenCalledWith('输入窗口位置和大小：x,y,width,height', '0,0,1024,768')
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('将移动窗口 HWND 9001 / DevHub 到 x=10, y=20, width=800, height=600'))
    expect(moveWindow).toHaveBeenCalledWith(selectedWindow.hwnd, 10, 20, 800, 600)
    expect(await screen.findByText('窗口已移动: HWND 9001 / DevHub')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-op-set-opacity'))
      await Promise.resolve()
    })

    expect(setWindowOpacity).toHaveBeenCalledWith(selectedWindow.hwnd, 85)
    expect(await screen.findByText('窗口透明度已设置为 85%')).toBeInTheDocument()
  })

  it('runs minimize and maximize operations through real window hooks with visible feedback', async () => {
    const { minimizeWindow, maximizeWindow } = configureHooks()

    render(
      <ToastProvider>
        <WindowView />
      </ToastProvider>
    )

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-op-minimize'))
      await Promise.resolve()
    })

    expect(minimizeWindow).toHaveBeenCalledWith(selectedWindow.hwnd)
    expect(await screen.findByText('窗口已最小化')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(await screen.findByTestId('window-op-maximize'))
      await Promise.resolve()
    })

    expect(maximizeWindow).toHaveBeenCalledWith(selectedWindow.hwnd)
    expect(await screen.findByText('窗口已最大化')).toBeInTheDocument()
  })
})
