import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState, type ReactNode } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { PortInfo, ProcessInfo, WindowInfo } from '@shared/types-extended'
import { useProcessStore } from '../../stores/processStore'
import { usePortStore } from '../../stores/portStore'
import { useWindowStore } from '../../stores/windowStore'
import { PortRelationshipGraph } from './PortRelationshipGraph'

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="react-flow-provider">{children}</div>
  ),
  ReactFlow: ({
    nodes,
    edges,
    children,
  }: {
    nodes: Node[]
    edges: Edge[]
    children: ReactNode
  }) => (
    <div data-testid="react-flow" data-node-count={nodes.length} data-edge-count={edges.length}>
      {children}
    </div>
  ),
  MiniMap: () => <div data-testid="react-flow-minimap" />,
  Controls: () => <div data-testid="react-flow-controls" />,
  Background: () => <div data-testid="react-flow-background" />,
  BackgroundVariant: { Dots: 'dots' },
  Handle: () => <span data-testid="react-flow-handle" />,
  Position: { Left: 'left', Right: 'right' },
  useNodesState: (initialNodes: Node[]) => {
    const [nodes, setNodes] = useState<Node[]>(initialNodes)
    return [nodes, setNodes, vi.fn()] as const
  },
  useEdgesState: (initialEdges: Edge[]) => {
    const [edges, setEdges] = useState<Edge[]>(initialEdges)
    return [edges, setEdges, vi.fn()] as const
  },
}))

const processFixture: ProcessInfo = {
  pid: 4242,
  name: 'vite',
  command: 'pnpm dev',
  cpu: 3.2,
  memory: 256,
  status: 'running',
  startTime: 1700000000000,
  type: 'dev-server',
}

const portFixture: PortInfo = {
  port: 443,
  pid: 4242,
  processName: 'vite',
  state: 'ESTABLISHED',
  protocol: 'TCP',
  localAddress: '127.0.0.1:51000',
  foreignAddress: '93.184.216.34:443',
}

const windowFixture: WindowInfo = {
  hwnd: 10101,
  title: 'DevHub',
  processName: 'vite',
  pid: 4242,
  className: 'Chrome_WidgetWin_1',
  rect: { x: 0, y: 0, width: 1280, height: 720 },
  isVisible: true,
  isMinimized: false,
  isSystemWindow: false,
}

describe('PortRelationshipGraph relationship depth control', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useProcessStore.setState({ processes: [processFixture] })
    usePortStore.setState({ ports: [portFixture] })
    useWindowStore.setState({ windows: [windowFixture] })
  })

  it('renders the adjustable depth slider and filters visible graph depth', async () => {
    render(<PortRelationshipGraph />)

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.getByTestId('port-relationship-graph-root')).toHaveAttribute('data-relationship-depth', '3')
    expect(screen.getByTestId('port-relationship-graph-root')).toHaveAttribute('data-relationship-scope', 'all-monitored-ports')
    expect(screen.getByTestId('port-relationship-graph-root')).toHaveAttribute('data-focus-port', 'none')
    expect(screen.getByTestId('port-relationship-depth-slider')).toHaveAttribute('aria-label', '关系视图节点深度')
    expect(screen.getByTestId('port-relationship-depth-value')).toHaveTextContent('3')
    expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', '4')

    fireEvent.change(screen.getByTestId('port-relationship-depth-slider'), { target: { value: '2' } })

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.getByTestId('port-relationship-graph-root')).toHaveAttribute('data-relationship-depth', '2')
    expect(screen.getByTestId('port-relationship-depth-value')).toHaveTextContent('2')
    expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', '3')
  })
})
