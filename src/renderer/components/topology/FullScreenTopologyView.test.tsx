import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphSavedSnapshot, GraphSnapshot } from '@shared/schemas/r8-runtime'
import { FullScreenTopologyView } from './FullScreenTopologyView'
import { GLOBAL_TOPOLOGY_GRAPH_KIND_KEY, openGlobalTopologyKind } from '../../utils/globalTopologyNavigation'

const snapshotId = '11111111-1111-4111-8111-111111111111'

function graph(kind: GraphSnapshot['slice']['graphKind'], overrides: Partial<GraphSnapshot> = {}): GraphSnapshot {
  return {
    snapshotId,
    generatedAt: 1_900_000,
    slice: { scope: 'global', targetIds: [], graphKind: kind, depth: 3, asOfTs: null, expandAll: false, layout: 'dagre' },
    nodes: [
      { id: 'process-1234', kind: 'process', label: 'node.exe', meta: { pid: 1234, cpu: 2, memory: 128 } },
      { id: 'port-5173-1234-TCP', kind: 'port', label: ':5173', meta: { pid: 1234, port: 5173, state: 'LISTENING' } }
    ],
    edges: [{ id: 'edge-process-1234-port-5173-1234-TCP-listens', kind, source: 'process-1234', target: 'port-5173-1234-TCP', type: kind === 'flow' ? 'happens-before' : 'listens' }],
    warnings: [],
    degraded: false,
    source: 'scanner-cache',
    ...overrides
  }
}

describe('FullScreenTopologyView', () => {
  const savedRows: GraphSavedSnapshot[] = []
  const api = {
    buildGlobalGraph: vi.fn(async () => graph('flow')),
    network: vi.fn(async () => graph('network-topology')),
    neural: vi.fn(async () => graph('neural-relationship', { edges: [{ id: 'edge-process-1234-tag-dev-server-has-tag', kind: 'neural-relationship', source: 'process-1234', target: 'tag-dev-server', type: 'has-tag' }] })),
    saveSnapshot: vi.fn(async (_snapshotId: string, label: string) => {
      savedRows.unshift({ id: snapshotId, label, savedAt: 1_900_010, path: 'D:/userData/topology-snapshots/a.json' })
      return { saved: true, path: 'D:/userData/topology-snapshots/a.json' }
    }),
    listSnapshots: vi.fn(async () => [...savedRows]),
    export: vi.fn(async (_snapshotId: string, format: string) => {
      return { content: format === 'mermaid' ? 'graph TD\nprocess-->port' : '<svg/>', mimeType: format === 'svg' ? 'image/svg+xml' : 'text/plain', encoding: 'utf8' as const }
    }),
    warmGlobalScopes: vi.fn(async () => ({ warmed: 1 }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    savedRows.length = 0
    window.sessionStorage.clear()
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: { r8: { topology: api } }
    })
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:topology-export') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      scale: vi.fn(),
      fillStyle: ''
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,UE5HREFUQQ==')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads network topology, switches graph kinds, saves snapshots, and exports PNG from the renderer canvas', async () => {
    render(<FullScreenTopologyView />)

    expect(await screen.findByText('全局拓扑')).toBeInTheDocument()
    await waitFor(() => expect(api.network).toHaveBeenCalledWith(expect.objectContaining({ graphKind: 'network-topology', scope: 'global' })))
    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-kind', 'network-topology')
    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-renderer-engine', 'cytoscape')
    expect(screen.getByTestId('graph-cytoscape-canvas')).toHaveAttribute('data-cytoscape-engine', 'cytoscape')
    expect(screen.getByTestId('graph-node-labels')).toHaveTextContent('node.exe')

    fireEvent.click(screen.getByTestId('graph-kind-neural-relationship'))
    await waitFor(() => expect(api.neural).toHaveBeenCalledWith(expect.objectContaining({ graphKind: 'neural-relationship' })))
    await waitFor(() => expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-kind', 'neural-relationship'))

    fireEvent.click(screen.getByTestId('graph-kind-flow'))
    await waitFor(() => expect(api.buildGlobalGraph).toHaveBeenCalledWith(expect.objectContaining({ graphKind: 'flow' })))
    await waitFor(() => expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-kind', 'flow'))

    fireEvent.change(screen.getByTestId('graph-scope-menu'), { target: { value: 'process' } })
    fireEvent.change(screen.getByTestId('graph-target-ids'), { target: { value: '1234' } })
    await waitFor(() => expect(api.buildGlobalGraph).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'process', targetIds: [1234] })))

    fireEvent.change(screen.getByTestId('graph-save-label'), { target: { value: 'claude-debug-2026-05-03' } })
    fireEvent.click(screen.getByText('保存当前快照'))
    await waitFor(() => expect(api.saveSnapshot).toHaveBeenCalledWith(snapshotId, 'claude-debug-2026-05-03', 'operator'))
    expect(await screen.findByText('claude-debug-2026-05-03')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('graph-export-mermaid'))
    await waitFor(() => expect((screen.getByTestId('graph-export-output') as HTMLTextAreaElement).value).toMatch(/^graph TD/))

    fireEvent.click(screen.getByTestId('graph-export-png'))
    await waitFor(() => expect((screen.getByTestId('graph-export-output') as HTMLTextAreaElement).value).toBe('UE5HREFUQQ=='))
    expect(api.export.mock.calls.some(([, format]) => format === 'png')).toBe(false)
  })

  it('shows node-limit degradation and expands explicitly', async () => {
    api.network.mockResolvedValueOnce(graph('network-topology', { degraded: true, warnings: [{ code: 'E_GRAPH_NODE_LIMIT', message: 'too many nodes' }] }))
    render(<FullScreenTopologyView />)

    expect(await screen.findByText(/节点数超限/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('展开全部'))
    await waitFor(() => expect(api.network).toHaveBeenLastCalledWith(expect.objectContaining({ expandAll: true, layout: 'cose-bilkent' })))
  })

  it('opens directly in flow mode from pending and live global navigation intents', async () => {
    window.sessionStorage.setItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY, 'flow')
    render(<FullScreenTopologyView />)

    await waitFor(() => expect(api.buildGlobalGraph).toHaveBeenCalledWith(expect.objectContaining({ graphKind: 'flow', scope: 'global' })))
    expect(window.sessionStorage.getItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY)).toBeNull()
    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-kind', 'flow')

    fireEvent.click(screen.getByTestId('graph-kind-network-topology'))
    await waitFor(() => expect(api.network).toHaveBeenCalledWith(expect.objectContaining({ graphKind: 'network-topology' })))

    act(() => {
      openGlobalTopologyKind('flow')
    })
    await waitFor(() => expect(api.buildGlobalGraph).toHaveBeenLastCalledWith(expect.objectContaining({ graphKind: 'flow' })))
    expect(window.sessionStorage.getItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY)).toBeNull()
  })

  it('restores a process node selected from process detail and opens it back in monitor detail', async () => {
    const events: Array<CustomEvent<unknown>> = []
    window.sessionStorage.setItem('devhub:topology:global:selected-node', 'process-1234')
    window.addEventListener('devhub:monitor-navigate', event => events.push(event as CustomEvent<unknown>))

    render(<FullScreenTopologyView />)

    expect(await screen.findByTestId('topology-node-detail')).toHaveTextContent('process-1234')
    await waitFor(() => expect(api.network).toHaveBeenCalledWith(expect.objectContaining({ selectedNodeId: 'process-1234' })))
    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBeNull()

    fireEvent.click(screen.getByText('open in process detail'))

    expect(events.at(-1)?.detail).toEqual({ tab: 'process', scope: { kind: 'process', targetId: 1234, depth: 2 } })
  })
})
