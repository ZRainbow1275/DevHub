import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProcessInfo } from '@shared/types-extended'
import { ToastProvider } from '../ui/Toast'
import { ProcessCard, ProcessItem } from './ProcessView'

const baseProcess: ProcessInfo = {
  pid: 4242,
  ppid: 100,
  parentName: 'node.exe',
  name: 'vite.exe',
  command: 'pnpm dev',
  port: 5173,
  cpu: 12.5,
  memory: 256,
  status: 'running',
  startTime: Date.now() - 120_000,
  type: 'dev-server',
  workingDir: 'D:/Desktop/CREATOR ONE/devhub'
}

interface MonitorNavigateDetail {
  tab: string
  scope: {
    kind: string
    targetId: number
    depth: number
  }
}

function isMonitorNavigateEvent(event: Event): event is CustomEvent<MonitorNavigateDetail> {
  return event instanceof CustomEvent
}

function renderProcessCard(processOverrides: Partial<ProcessInfo> = {}) {
  const process = { ...baseProcess, ...processOverrides }
  const onKill = vi.fn()
  const onShowDetail = vi.fn()
  const onShowTree = vi.fn()
  const onEditTag = vi.fn()

  render(
    <ToastProvider>
      <ProcessCard
        process={process}
        index={0}
        maxMemory={1024}
        onKill={onKill}
        onShowDetail={onShowDetail}
        onShowTree={onShowTree}
        onEditTag={onEditTag}
      />
    </ToastProvider>
  )

  return {
    onKill,
    onShowDetail,
    onShowTree,
    onEditTag
  }
}

function renderProcessItem(processOverrides: Partial<ProcessInfo> = {}) {
  const process = { ...baseProcess, ...processOverrides }
  const onSelect = vi.fn()
  const onKill = vi.fn()
  const onShowDetail = vi.fn()
  const onShowTree = vi.fn()
  const onEditTag = vi.fn()

  render(
    <ToastProvider>
      <ProcessItem
        process={process}
        maxMemory={1024}
        isSelected={false}
        onSelect={onSelect}
        onKill={onKill}
        onShowDetail={onShowDetail}
        onShowTree={onShowTree}
        onEditTag={onEditTag}
      />
    </ToastProvider>
  )

  return {
    onSelect,
    onKill,
    onShowDetail,
    onShowTree,
    onEditTag
  }
}

function stubClipboardWrite() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  })
  return writeText
}

function stubProcessPopoutCreate() {
  const create = vi.fn().mockResolvedValue({
    windowId: 'popout-process-4242',
    surface: 'process',
    targetId: 4242,
    mode: 'browserwindow',
    route: '/monitor',
    title: 'Process vite.exe (4242)',
    pinned: false,
    bounds: null,
    createdAt: Date.now(),
    bridgeState: 'connected'
  })
  Object.defineProperty(window, 'devhub', {
    configurable: true,
    value: {
      shell: { openPath: vi.fn() },
      r8: {
        popout: {
          create
        }
      }
    }
  })
  return create
}

describe('ProcessCard detail entrypoints', () => {
  it('opens the process detail drawer when the card surface is double clicked', () => {
    const { onShowDetail } = renderProcessCard()

    const card = screen.getByTestId('process-card-4242')
    expect(card).toHaveAttribute('data-detail-entry', 'process-card-double-click')
    expect(card).toHaveAttribute('data-vm-fields', expect.stringContaining('ppid'))
    expect(within(card).getByText('父: node.exe (100)')).toBeInTheDocument()

    fireEvent.doubleClick(card)

    expect(onShowDetail).toHaveBeenCalledTimes(1)
    expect(onShowDetail).toHaveBeenCalledWith(4242)
  })

  it('keeps the card graph badge isolated from the double click detail shortcut', () => {
    const events: CustomEvent<MonitorNavigateDetail>[] = []
    const onNavigate = (event: Event) => {
      if (isMonitorNavigateEvent(event)) events.push(event)
    }
    window.addEventListener('devhub:monitor-navigate', onNavigate)

    const { onShowDetail } = renderProcessCard()
    const graphBadge = screen.getByTestId('process-card-graph-badge-4242')

    expect(graphBadge).toHaveAttribute('data-graph-entry', 'process-card-attached-topology')
    expect(graphBadge).toHaveAttribute('data-graph-kind', 'attached')
    expect(graphBadge).toHaveAttribute('data-graph-scope', 'process')
    expect(graphBadge).toHaveAttribute('data-graph-target-id', '4242')

    fireEvent.doubleClick(graphBadge)
    expect(onShowDetail).not.toHaveBeenCalled()

    fireEvent.click(graphBadge)

    expect(events).toHaveLength(1)
    expect(events[0].detail).toEqual({
      tab: 'process',
      scope: { kind: 'process', targetId: 4242, depth: 2 }
    })
    expect(onShowDetail).not.toHaveBeenCalled()

    window.removeEventListener('devhub:monitor-navigate', onNavigate)
  })

  it('exposes a real copy PID action from the process card context menu', async () => {
    const writeText = stubClipboardWrite()
    renderProcessCard()

    fireEvent.contextMenu(screen.getByTestId('process-card-4242'), { clientX: 40, clientY: 50 })
    fireEvent.click(screen.getByRole('button', { name: '复制 PID' }))

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('4242')
    await waitFor(() => expect(screen.getByText('PID 已复制到剪贴板')).toBeInTheDocument())
  })

  it('opens a real process BrowserWindow popout from the process card context menu', async () => {
    const createPopout = stubProcessPopoutCreate()
    renderProcessCard()

    fireEvent.contextMenu(screen.getByTestId('process-card-4242'), { clientX: 40, clientY: 50 })
    fireEvent.click(screen.getByRole('button', { name: '弹出进程' }))

    await waitFor(() => expect(createPopout).toHaveBeenCalledTimes(1))
    expect(createPopout).toHaveBeenCalledWith({
      surface: 'process',
      targetId: 4242,
      mode: 'browserwindow',
      route: '/monitor',
      title: 'Process vite.exe (4242)'
    })
    await waitFor(() => expect(screen.getByText('进程已在新窗口打开')).toBeInTheDocument())
  })
})

describe('ProcessItem detail entrypoints', () => {
  it('opens the process detail drawer when the list row is clicked', () => {
    const { onSelect, onShowDetail } = renderProcessItem()

    const row = screen.getByTestId('process-row-4242')
    expect(row).toHaveAttribute('data-detail-entry', 'process-row-click-drawer')
    expect(row).toHaveAttribute('data-vm-fields', expect.stringContaining('ppid'))
    expect(within(row).getByText('父: node.exe (100)')).toBeInTheDocument()

    fireEvent.click(row)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onShowDetail).toHaveBeenCalledTimes(1)
    expect(onShowDetail).toHaveBeenCalledWith(4242)
  })

  it('keeps multi-select list clicks from opening the detail drawer', () => {
    const { onSelect, onShowDetail } = renderProcessItem()

    fireEvent.click(screen.getByTestId('process-row-4242'), { ctrlKey: true })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onShowDetail).not.toHaveBeenCalled()
  })

  it('keeps the explicit detail button isolated from row selection', () => {
    const { onSelect, onShowDetail } = renderProcessItem()

    fireEvent.click(screen.getByTestId('process-detail-button-4242'))

    expect(onSelect).not.toHaveBeenCalled()
    expect(onShowDetail).toHaveBeenCalledTimes(1)
    expect(onShowDetail).toHaveBeenCalledWith(4242)
  })

  it('opens a real process BrowserWindow popout from the process row context menu', async () => {
    const createPopout = stubProcessPopoutCreate()
    renderProcessItem()

    fireEvent.contextMenu(screen.getByTestId('process-row-4242'), { clientX: 40, clientY: 50 })
    fireEvent.click(screen.getByRole('button', { name: '弹出进程' }))

    await waitFor(() => expect(createPopout).toHaveBeenCalledTimes(1))
    expect(createPopout).toHaveBeenCalledWith({
      surface: 'process',
      targetId: 4242,
      mode: 'browserwindow',
      route: '/monitor',
      title: 'Process vite.exe (4242)'
    })
    await waitFor(() => expect(screen.getByText('进程已在新窗口打开')).toBeInTheDocument())
  })
})
