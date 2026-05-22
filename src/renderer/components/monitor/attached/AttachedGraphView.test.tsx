import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttachedTopologyRequest, AttachedTopologyResult, GraphSnapshot } from '@shared/schemas/r8-runtime'
import { AttachedGraphView } from './AttachedGraphView'

const makeSnapshot = (depth: number, lazy: boolean): GraphSnapshot => ({
  snapshotId: '00000000-0000-4000-8000-000000000025',
  generatedAt: 1713830400000,
  slice: { scope: 'process', targetIds: [1234], graphKind: 'network-topology', depth, asOfTs: null, expandAll: false, layout: 'dagre' },
  nodes: [{ id: 'process-1234', kind: 'process', label: 'node.exe', meta: { pid: 1234 } }],
  edges: [],
  warnings: lazy ? [{ code: 'E_ATTACHED_LAZY_REQUIRED', message: 'lazy depth requires expansion' }] : [],
  degraded: lazy,
  source: 'scanner-cache'
})

function makeResult(input: Partial<AttachedTopologyRequest>): AttachedTopologyResult {
  const depth = input.depth ?? 3
  const lazy = depth >= 8 && (input.expandedNodeIds?.length ?? 0) === 0
  return {
    snapshot: makeSnapshot(depth, lazy),
    truncatedAtDepth: lazy ? 7 : null,
    expandableNodes: lazy ? ['process-1234'] : [],
    warnings: lazy ? ['lazy depth requires expansion'] : [],
    lazy,
    thumbnailRecommended: false
  }
}

describe('AttachedGraphView spec-25 controls', () => {
  const attachedDeep10 = vi.fn(async (input?: Partial<AttachedTopologyRequest>) => makeResult(input ?? {}))
  const favoriteChange = vi.fn(async () => ({ success: true, action: 'pin' as const, favorite: { label: 'process:1234', scope: 'process' as const, targetId: 1234, graphKind: 'network-topology' as const, pinnedAt: 1713830400000 }, auditedAt: 1713830400000 }))
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  const originalResizeObserver = globalThis.ResizeObserver

  beforeEach(() => {
    attachedDeep10.mockClear()
    favoriteChange.mockClear()
    window.localStorage.clear()
    window.sessionStorage.clear()
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 640,
      height: 360,
      top: 0,
      right: 640,
      bottom: 360,
      left: 0,
      toJSON: () => ({})
    }))
    globalThis.ResizeObserver = originalResizeObserver
    Object.assign(window.devhub, {
      r8: {
        topology: { attachedDeep10, favoriteChange }
      }
    })
  })

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    globalThis.ResizeObserver = originalResizeObserver
  })

  it('loads real attached topology bridge with depth 10 lazy mode and pinning', async () => {
    render(<AttachedGraphView scope={{ kind: 'process', targetId: 1234, depth: 3 }} minHeight={320} />)

    await waitFor(() => expect(attachedDeep10).toHaveBeenCalledWith(expect.objectContaining({ scope: 'process', targetId: 1234, depth: 3 })))

    fireEvent.change(screen.getByTestId('attached-depth-slider'), { target: { value: '10' } })

    await waitFor(() => expect(attachedDeep10).toHaveBeenLastCalledWith(expect.objectContaining({ depth: 10 })))
    expect(screen.getByTestId('attached-lazy-banner')).toBeInTheDocument()
    expect(screen.getByTestId('attached-graph-view')).toHaveAttribute('data-lazy', 'true')
    expect(screen.getByTestId('attached-lazy-expander')).toHaveTextContent('+1 more lazy node available')

    fireEvent.doubleClick(screen.getByTestId('attached-lazy-placeholder'))
    await waitFor(() => expect(attachedDeep10).toHaveBeenLastCalledWith(expect.objectContaining({
      depth: 10,
      expandedNodeIds: ['process-1234'],
      selectedNodeId: 'process-1234'
    })))
    await waitFor(() => expect(screen.getByTestId('attached-graph-view')).toHaveAttribute('data-lazy', 'false'))
    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('process-1234')

    fireEvent.click(screen.getByTestId('attached-favorite-button'))
    expect(window.localStorage.getItem('devhub:attached-topology:favorites')).toContain('process:1234')
    expect(screen.getByTestId('attached-favorites-menu')).toHaveTextContent('process:1234 / Network')
    await waitFor(() => expect(favoriteChange).toHaveBeenCalledWith(expect.objectContaining({
      action: 'pin',
      previousFavoriteCount: 0,
      nextFavoriteCount: 1,
      selectedNodeId: 'process-1234',
      favorite: expect.objectContaining({ scope: 'process', targetId: 1234, graphKind: 'network-topology', label: 'process:1234' })
    })))

    fireEvent.click(screen.getByTestId('attached-favorite-button'))
    await waitFor(() => expect(favoriteChange).toHaveBeenLastCalledWith(expect.objectContaining({
      action: 'unpin',
      previousFavoriteCount: 1,
      nextFavoriteCount: 0,
      selectedNodeId: 'process-1234',
      favorite: expect.objectContaining({ scope: 'process', targetId: 1234, graphKind: 'network-topology', label: 'process:1234' })
    })))
  })

  it('syncs selected attached nodes with global topology navigation', async () => {
    const openGlobal = vi.fn()
    window.addEventListener('devhub:open-topology-global', openGlobal)
    render(<AttachedGraphView scope={{ kind: 'process', targetId: 1234, depth: 3 }} minHeight={320} />)

    await waitFor(() => expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-node-count', '1'))
    const attachedNode = await screen.findByRole('option', { name: '节点 node.exe (process-1234)' })

    const globalButton = screen.getByTestId('attached-open-global-button')
    expect(globalButton).toBeDisabled()

    fireEvent.click(attachedNode)

    await waitFor(() => expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('process-1234'))
    await waitFor(() => expect(attachedDeep10).toHaveBeenLastCalledWith(expect.objectContaining({
      selectedNodeId: 'process-1234',
      expandedNodeIds: ['process-1234']
    })))
    expect(globalButton).toBeEnabled()

    fireEvent.click(globalButton)
    expect(openGlobal).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('process-1234')
    window.removeEventListener('devhub:open-topology-global', openGlobal)
  })

  it('collapses to a mini thumbnail card when the attached panel is narrow', async () => {
    class NarrowResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element): void {
        this.callback([{
          target,
          contentRect: {
            x: 0,
            y: 0,
            width: 420,
            height: 320,
            top: 0,
            right: 420,
            bottom: 320,
            left: 0,
            toJSON: () => ({})
          } as DOMRectReadOnly,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: []
        }], this as unknown as ResizeObserver)
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = NarrowResizeObserver as unknown as typeof ResizeObserver

    render(<AttachedGraphView scope={{ kind: 'process', targetId: 1234, depth: 3 }} minHeight={320} />)

    await waitFor(() => expect(screen.getByTestId('attached-mini-thumbnail')).toBeInTheDocument())
    expect(screen.getByTestId('attached-mini-expanded-card')).toHaveTextContent('1 nodes / 0 edges / depth 3')
    fireEvent.click(screen.getByTestId('attached-mini-popout-button'))
    expect(screen.getByTestId('attached-mini-floating-card')).toHaveTextContent('scope: process')
    expect(screen.getByTestId('attached-mini-floating-card')).toHaveTextContent('target: 1234')
    fireEvent.click(screen.getByTestId('attached-mini-floating-close'))
    expect(screen.queryByTestId('attached-mini-floating-card')).not.toBeInTheDocument()
    await waitFor(() => expect(attachedDeep10).toHaveBeenLastCalledWith(expect.objectContaining({ thumbnailMode: true })))
  })
})
