import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowRequest, FlowSnapshot } from '@shared/schemas/r8-runtime'
import { AttachedFlowView } from './AttachedFlowView'

function makeFlowSnapshot(input: Partial<FlowRequest> = {}): FlowSnapshot {
  const toTs = 1713830400000
  const windowMs = input.windowMs ?? 1800000
  return {
    snapshotId: '00000000-0000-4000-8000-000000000026',
    generatedAt: toTs,
    windowMs,
    fromTs: windowMs === -1 ? 0 : toTs - windowMs,
    toTs,
    nodes: [
      { id: 'flow-1', kind: 'task-start', ts: toTs - 1000, label: 'start T1', taskId: 'T1', sessionId: null, instanceId: 'codex', meta: {}, errorCode: null, durationMs: null },
      { id: 'flow-2', kind: 'task-retry', ts: toTs - 500, label: 'retry T1', taskId: 'T1', sessionId: null, instanceId: 'codex', meta: {}, errorCode: null, durationMs: null },
      { id: 'flow-3', kind: 'task-fail', ts: toTs, label: 'failed T1', taskId: 'T1', sessionId: null, instanceId: 'codex', meta: {}, errorCode: 'E_REAL', durationMs: 1000 }
    ],
    edges: [
      { id: 'edge-1', kind: 'happens-before', source: 'flow-1', target: 'flow-2', durationMs: 500 },
      { id: 'edge-2', kind: 'fails', source: 'flow-2', target: 'flow-3', durationMs: 500 }
    ],
    stats: { totalEvents: 3, failCount: 1, retryCount: 1, avgDurationMs: 1000, p95DurationMs: 1000 },
    truncated: false,
    warnings: [],
    speed: input.speed ?? 1,
    source: 'task-queue'
  }
}

function makeLargeFlowSnapshot(count: number, input: Partial<FlowRequest> = {}): FlowSnapshot {
  const toTs = 1713830400000
  const windowMs = input.windowMs ?? 1800000
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `flow-large-${index}`,
    kind: index % 25 === 0 ? 'task-fail' as const : index % 10 === 0 ? 'task-retry' as const : 'task-start' as const,
    ts: toTs - count + index,
    label: `large flow ${index}`,
    taskId: `T-${index}`,
    sessionId: null,
    instanceId: 'codex',
    meta: { source: 'task-queue' },
    errorCode: index % 25 === 0 ? 'E_PERF' : null,
    durationMs: index % 3 === 0 ? 10 : null
  }))
  const edges = nodes.slice(1).map((node, index) => ({
    id: `flow-large-edge-${index}`,
    kind: node.kind === 'task-fail' ? 'fails' as const : node.kind === 'task-retry' ? 'retries' as const : 'happens-before' as const,
    source: nodes[index].id,
    target: node.id,
    durationMs: 1
  }))
  return {
    snapshotId: '00000000-0000-4000-8000-000000000500',
    generatedAt: toTs,
    windowMs,
    fromTs: windowMs === -1 ? 0 : toTs - windowMs,
    toTs,
    nodes,
    edges,
    stats: {
      totalEvents: nodes.length,
      failCount: nodes.filter(node => node.kind === 'task-fail').length,
      retryCount: nodes.filter(node => node.kind === 'task-retry').length,
      avgDurationMs: 10,
      p95DurationMs: 10
    },
    truncated: nodes.length >= 500,
    warnings: nodes.length >= 500 ? [{ code: 'E_GRAPH_NODE_LIMIT', message: 'Flow window was narrowed to the most recent 500 events.' }] : [],
    speed: input.speed ?? 0,
    source: 'task-queue'
  }
}

describe('AttachedFlowView spec-26 controls', () => {
  const attachedFlow = vi.fn(async (input?: Partial<FlowRequest>) => makeFlowSnapshot(input ?? {}))
  const exportFlow = vi.fn(async () => ({ content: 'sequenceDiagram\n    participant T1\n    T1->>T1: failed T1\n', mimeType: 'text/vnd.mermaid', encoding: 'utf8' as const }))
  let flowListener: ((payload: { snapshot: FlowSnapshot }) => void) | null = null
  const subscribeFlowEvents = vi.fn((listener: (payload: { snapshot: FlowSnapshot }) => void) => {
    flowListener = listener
    return vi.fn()
  })

  beforeEach(() => {
    attachedFlow.mockClear()
    exportFlow.mockClear()
    subscribeFlowEvents.mockClear()
    flowListener = null
    Object.assign(window.devhub, {
      r8: {
        topology: { attachedFlow, exportFlow, subscribeFlowEvents }
      }
    })
  })

  it('loads default 30min flow, controls speed, and exports mermaid sequence', async () => {
    render(<AttachedFlowView scope={{ kind: 'process', targetId: 1234, depth: 3 }} />)

    await waitFor(() => expect(attachedFlow).toHaveBeenCalledWith(expect.objectContaining({ windowMs: 1800000, speed: 1 })))
    expect(screen.getByTestId('flow-window-menu').querySelector('[data-active="true"]')).toHaveTextContent('30min')
    expect(screen.getByTestId('flow-stats-badge')).toHaveTextContent('fail 1')

    fireEvent.click(screen.getByTestId('flow-speed-4'))
    await waitFor(() => expect(attachedFlow).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 4 })))
    expect(screen.getByTestId('attached-flow-view')).toHaveAttribute('data-speed', '4')
    expect(screen.getAllByTestId('flow-animation-layer')[0]).toHaveAttribute('data-flow-animation-paused', 'false')

    fireEvent.click(screen.getByTestId('flow-speed-0'))
    await waitFor(() => expect(attachedFlow).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 0 })))
    expect(screen.getByTestId('attached-flow-view')).toHaveAttribute('data-speed', '0')
    expect(screen.getAllByTestId('flow-animation-layer')[0]).toHaveAttribute('data-flow-animation-paused', 'true')

    fireEvent.click(screen.getByTestId('flow-filter-task-fail'))
    await waitFor(() => expect(attachedFlow).toHaveBeenLastCalledWith(expect.objectContaining({ filter: expect.objectContaining({ kinds: ['task-fail'] }) })))
    fireEvent.change(screen.getByTestId('flow-filter-task'), { target: { value: 'T1' } })
    await waitFor(() => expect(attachedFlow).toHaveBeenLastCalledWith(expect.objectContaining({ filter: expect.objectContaining({ taskIds: ['T1'] }) })))
    fireEvent.click(screen.getByTestId('flow-filter-tool-codex'))
    await waitFor(() => expect(attachedFlow).toHaveBeenLastCalledWith(expect.objectContaining({ filter: expect.objectContaining({ tools: ['codex'] }) })))
    fireEvent.click(screen.getByTestId('flow-filter-error'))
    await waitFor(() => expect(attachedFlow).toHaveBeenLastCalledWith(expect.objectContaining({ filter: expect.objectContaining({ minErrorLevel: 'ERROR' }) })))

    const streamed = makeFlowSnapshot({ speed: 4, filter: { kinds: ['task-fail'], taskIds: ['T1'], tools: ['codex'], minErrorLevel: 'ERROR' } })
    streamed.nodes = [
      ...streamed.nodes,
      { id: 'flow-4', kind: 'watchdog-action', ts: streamed.toTs, label: 'watchdog restart', taskId: 'T1', sessionId: null, instanceId: 'codex', meta: {}, errorCode: null, durationMs: null }
    ]
    streamed.stats = { ...streamed.stats, totalEvents: 4 }
    act(() => {
      flowListener?.({ snapshot: streamed })
    })
    await waitFor(() => expect(screen.getAllByTestId('flow-event-row')).toHaveLength(4))
    expect(subscribeFlowEvents).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ intervalMs: 1000 }))

    fireEvent.click(screen.getByTestId('flow-export-mermaid'))
    await waitFor(() => expect(exportFlow).toHaveBeenCalledWith(expect.objectContaining({ format: 'mermaid-sequence' })))
    expect(await screen.findByTestId('flow-export-result')).toHaveTextContent('sequenceDiagram')
  })

  it('renders 500 flow events under budget and appends one realtime event under budget', async () => {
    attachedFlow.mockImplementation(async () => makeLargeFlowSnapshot(499, { speed: 0 }))
    const renderStartedAt = performance.now()

    render(<AttachedFlowView scope={{ kind: 'process', targetId: 26026, depth: 3 }} />)

    await waitFor(() => expect(screen.getAllByTestId('flow-event-row')).toHaveLength(499))
    const renderMs = performance.now() - renderStartedAt
    expect(renderMs).toBeLessThan(1500)

    const appended = makeLargeFlowSnapshot(500, { speed: 0 })
    const appendStartedAt = performance.now()
    act(() => {
      flowListener?.({ snapshot: appended })
    })
    expect(screen.getByTestId('attached-flow-view')).toHaveAttribute('data-flow-node-count', '500')
    const appendMs = performance.now() - appendStartedAt
    expect(appendMs).toBeLessThan(350)
    expect(screen.getAllByTestId('flow-event-row')).toHaveLength(500)
  })
})
