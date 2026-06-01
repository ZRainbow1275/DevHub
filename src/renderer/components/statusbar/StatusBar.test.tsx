import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessHistory } from '@shared/schemas/r8-runtime'
import type { ProcessInfo } from '@shared/types-extended'
import { useProcessStore } from '../../stores/processStore'
import { StatusBar } from './StatusBar'

const lowCpuProcess: ProcessInfo = {
  pid: 12,
  name: 'helper.exe',
  command: 'helper.exe',
  cpu: 1,
  memory: 64,
  status: 'running',
  startTime: 1713830400000,
  type: 'other',
  workingDir: 'D:/tools'
}

const highCpuProcess: ProcessInfo = {
  pid: 42,
  name: 'node.exe',
  command: 'node server.js',
  cpu: 21.4,
  memory: 512,
  status: 'running',
  startTime: 1713830400000,
  type: 'dev-server',
  workingDir: 'D:/repo'
}

const processHistory24h: ProcessHistory = {
  key: 'node-key',
  exe: 'node.exe',
  cwd: 'D:/repo',
  windowMs: 86_400_000,
  points: [
    { ts: 1713830400000, cpu: 10, rssMb: 256, missing: false },
    { ts: 1713830460000, cpu: 21, rssMb: 512, missing: false }
  ]
}

describe('R8.B StatusBar', () => {
  beforeEach(() => {
    useProcessStore.getState().setProcesses([])
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: undefined
    })
  })

  it('renders seven-plus aggregate tiles and the theme tile drops the stale NEW badge', () => {
    render(<StatusBar />)

    expect(screen.getByTestId('statusbar')).toHaveAttribute('data-r8b-statusbar-tiles')
    expect(screen.getAllByTestId(/^status-tile-/).length).toBeGreaterThanOrEqual(7)
    expect(screen.getByTestId('status-tile-cmdk')).toHaveAttribute('data-status-badge-type', 'experimental')
    // R2.3: the theme tile no longer carries the hard-coded decorative NEW badge.
    expect(screen.getByTestId('status-tile-theme')).toHaveAttribute('data-status-badge-type', 'none')
  })

  it('dispatches the command palette event from the cmdk tile', () => {
    const listener = vi.fn()
    window.addEventListener('devhub:open-command-palette', listener)

    render(<StatusBar />)
    fireEvent.click(screen.getByTestId('status-tile-cmdk'))

    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener('devhub:open-command-palette', listener)
  })

  it('keeps the redundant topology entrypoint functional', () => {
    const onTopologyClick = vi.fn()
    useProcessStore.getState().setProcesses([lowCpuProcess, highCpuProcess])
    render(<StatusBar onTopologyClick={onTopologyClick} />)

    const badge = screen.getByTestId('topology-status-badge')
    expect(badge).toHaveAttribute('data-active-process-count', '2')
    expect(screen.getByTestId('topology-status-active-process-count')).toHaveTextContent('2')

    fireEvent.click(badge)
    expect(onTopologyClick).toHaveBeenCalledTimes(1)
  })

  it('renders the independent process 24h sparkline widget from the real history bridge', async () => {
    const getProcessHistory24h = vi.fn().mockResolvedValue(processHistory24h)
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: {
        systemProcess: {
          getProcessHistory24h
        }
      }
    })
    const openMonitor = vi.fn()
    const monitorNavigate = vi.fn()
    window.addEventListener('devhub:open-monitor', openMonitor)
    window.addEventListener('devhub:monitor-navigate', monitorNavigate)

    useProcessStore.getState().setProcesses([lowCpuProcess, highCpuProcess])
    render(<StatusBar />)

    const widget = screen.getByTestId('statusbar-process-history-widget')
    expect(widget).toHaveAttribute('data-process-pid', '42')
    expect(widget).toHaveAttribute('data-process-name', 'node.exe')

    await waitFor(() => {
      expect(getProcessHistory24h).toHaveBeenCalledWith({ exe: 'node.exe', cwd: 'D:/repo' })
    })
    await waitFor(() => {
      expect(screen.getByTestId('statusbar-process-history-sparkline')).toHaveAttribute('data-latest', '21')
    })

    fireEvent.click(widget)
    expect(openMonitor).toHaveBeenCalledTimes(1)
    expect(monitorNavigate).toHaveBeenCalledWith(expect.objectContaining({
      detail: { tab: 'process', scope: { kind: 'process', targetId: 42, depth: 2 } }
    }))

    window.removeEventListener('devhub:open-monitor', openMonitor)
    window.removeEventListener('devhub:monitor-navigate', monitorNavigate)
  })
})
