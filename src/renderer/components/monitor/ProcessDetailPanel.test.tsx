import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessInfo } from '@shared/types-extended'
import { ToastProvider } from '../ui/Toast'
import { ProcessDetailPanel } from './ProcessDetailPanel'

const basicProcessInfo: ProcessInfo = {
  pid: 1234,
  name: 'node.exe',
  command: 'pnpm dev',
  cpu: 4,
  memory: 128,
  status: 'running',
  projectId: 'project-1',
  startTime: 1,
  type: 'dev-server',
  workingDir: 'D:/repo/devhub'
}

describe('ProcessDetailPanel global topology bridge', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('opens fullscreen topology with the current process node selected', async () => {
    const events: Array<Event> = []
    window.addEventListener('devhub:open-topology-global', event => events.push(event))

    render(
      <ToastProvider>
        <ProcessDetailPanel
          pid={1234}
          basicProcessInfo={basicProcessInfo}
          onClose={vi.fn()}
          onKillProcess={vi.fn(async () => true)}
          fetchRelationship={vi.fn(async () => null)}
          fetchHistory={vi.fn(async () => ({ cpuHistory: [], memoryHistory: [] }))}
        />
      </ToastProvider>
    )

    await waitFor(() => expect(screen.getByTestId('process-global-topology-button')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '全局拓扑' })).toHaveAttribute('title', '打开全局拓扑')
    fireEvent.click(screen.getByTestId('process-global-topology-button'))

    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('process-1234')
    expect(events).toHaveLength(1)
  })

  it('switches from the header button to the attached topology tab', async () => {
    render(
      <ToastProvider>
        <ProcessDetailPanel
          pid={1234}
          basicProcessInfo={basicProcessInfo}
          onClose={vi.fn()}
          onKillProcess={vi.fn(async () => true)}
          fetchRelationship={vi.fn(async () => null)}
          fetchHistory={vi.fn(async () => ({ cpuHistory: [], memoryHistory: [] }))}
        />
      </ToastProvider>
    )

    expect(screen.queryByTestId('attached-graph-view')).not.toBeInTheDocument()
    const lookAtGraphButton = await screen.findByTestId('process-attached-topology-button')
    expect(lookAtGraphButton).toHaveTextContent('看图')
    expect(lookAtGraphButton).toHaveAttribute('title', '看图：查看进程关系视图')
    fireEvent.click(lookAtGraphButton)

    const attachedGraph = await screen.findByTestId('attached-graph-view')
    expect(attachedGraph).toHaveAttribute('data-root-kind', 'process')
    expect(attachedGraph).toHaveAttribute('data-root-id', '1234')
    expect(screen.getByTestId('attached-flow-view')).toHaveAttribute('data-root-kind', 'process')
    expect(screen.getByTestId('attached-flow-view')).toHaveAttribute('data-root-id', '1234')
  })

  it('exposes the required process detail tabs plus relationship entries', async () => {
    render(
      <ToastProvider>
        <ProcessDetailPanel
          pid={1234}
          basicProcessInfo={basicProcessInfo}
          onClose={vi.fn()}
          onKillProcess={vi.fn(async () => true)}
          fetchRelationship={vi.fn(async () => null)}
          fetchHistory={vi.fn(async () => ({ cpuHistory: [], memoryHistory: [] }))}
        />
      </ToastProvider>
    )

    await screen.findByRole('button', { name: '基础' })

    for (const tabName of ['基础', '资源', '网络', '环境', '模块']) {
      expect(screen.getByRole('button', { name: tabName })).toBeInTheDocument()
    }

    expect(screen.getByRole('button', { name: '关联' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关系视图' })).toHaveAttribute('data-graph-entry', 'process-detail-tab')
    expect(screen.getByRole('button', { name: '关系视图' })).toHaveAttribute('data-graph-kind', 'attached')
  })
})
