import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MonitorPanel } from './MonitorPanel'

vi.mock('./ProcessView', () => ({ ProcessView: () => <div>process-view</div> }))
vi.mock('./PortView', () => ({ PortView: () => <div>port-view</div> }))
vi.mock('./WindowView', () => ({ WindowView: () => <div>window-view</div> }))
vi.mock('./AITaskView', () => ({ AITaskView: () => <div>ai-task-view</div> }))
vi.mock('../topology/FullScreenTopologyView', () => ({ FullScreenTopologyView: () => <div>topology-view</div> }))

describe('MonitorPanel navigation', () => {
  it('exposes process, port, window, AI task, and topology as top-level monitor entries', () => {
    render(<MonitorPanel />)

    const tabList = screen.getByTestId('monitor-tab-list')
    const processTab = within(tabList).getByTestId('monitor-tab-process')
    const topologyTab = within(tabList).getByTestId('monitor-tab-topology')

    expect(screen.getByTestId('monitor-panel')).toBeInTheDocument()
    expect(processTab).toHaveAttribute('data-active', 'true')
    expect(processTab).toHaveAccessibleName('进程')
    expect(within(tabList).getByTestId('monitor-tab-r8-ops')).toHaveAccessibleName('R8 运营')
    expect(screen.getByRole('button', { name: /进程/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /端口/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /窗口/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AI 任务/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /拓扑/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /流程图/ })).not.toBeInTheDocument()

    fireEvent.click(topologyTab)
    expect(topologyTab).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('topology-view')).toBeInTheDocument()
  })
})
