import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import cytoscape, { type Core, type ElementDefinition, type EventObject } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { useT } from '../../hooks/useT'

export interface DagCanvasPngExport {
  content: string
  encoding: 'base64'
  height: number
  mimeType: 'image/png'
  width: number
}

export interface DagCanvasHandle {
  exportPng: () => Promise<DagCanvasPngExport>
}

export interface DagCanvasNode {
  id: string
  kind: string
  label: string
  meta?: Record<string, unknown>
  status?: string
}

export interface DagCanvasEdge {
  id: string
  inCycle?: boolean
  label?: string
  source: string
  target: string
}

export interface DagCanvasGraph {
  edges: DagCanvasEdge[]
  nodes: DagCanvasNode[]
}

interface DagCanvasProps {
  className?: string
  fallbackExportPng?: () => Promise<DagCanvasPngExport>
  focusNodeId?: string | null
  graph: DagCanvasGraph
  layout?: 'circle' | 'dagre' | 'grid'
  onNodeClick?: (nodeId: string) => void
  testId?: string
}

let dagreRegistered = false

function ensureDagreRegistered(): void {
  if (dagreRegistered) return
  cytoscape.use(dagre)
  dagreRegistered = true
}

function nodeClass(node: DagCanvasNode, focusNodeId: string | null | undefined): string {
  return [
    `kind-${node.kind}`,
    node.status ? `status-${node.status}` : '',
    node.id === focusNodeId ? 'focused' : ''
  ].filter(Boolean).join(' ')
}

function toElements(graph: DagCanvasGraph, focusNodeId: string | null | undefined): ElementDefinition[] {
  const nodes = graph.nodes.map(node => ({
    classes: nodeClass(node, focusNodeId),
    data: {
      id: node.id,
      kind: node.kind,
      label: node.label,
      status: node.status ?? '',
      ...node.meta
    },
    group: 'nodes' as const
  }))
  const edges = graph.edges.map(edge => ({
    classes: edge.inCycle ? 'in-cycle' : '',
    data: {
      id: edge.id,
      label: edge.label ?? '',
      source: edge.source,
      target: edge.target
    },
    group: 'edges' as const
  }))
  return [...nodes, ...edges]
}

function cytoscapeLayoutName(layout: DagCanvasProps['layout']): string {
  return layout === 'circle' || layout === 'grid' ? layout : 'dagre'
}

function cssToken(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

function readExportSize(container: HTMLDivElement | null): { height: number; width: number } {
  const rect = container?.getBoundingClientRect()
  return {
    height: Math.max(1, Math.round(rect?.height || 540)),
    width: Math.max(1, Math.round(rect?.width || 960))
  }
}

function nextNodeId(nodes: readonly DagCanvasNode[], currentNodeId: string | null, delta: number): string | null {
  if (nodes.length === 0) return null
  const currentIndex = Math.max(0, nodes.findIndex(node => node.id === currentNodeId))
  const nextIndex = (currentIndex + delta + nodes.length) % nodes.length
  return nodes[nextIndex]?.id ?? nodes[0]?.id ?? null
}

function nodeAnnouncement(node: DagCanvasNode | undefined): string {
  return node ? `当前节点 ${node.label} (${node.id})` : '当前画布没有节点'
}

function isUsableCanvas2dContext(value: unknown): value is CanvasRenderingContext2D {
  return typeof value === 'object' && value !== null
    && typeof (value as { measureText?: unknown }).measureText === 'function'
    && typeof (value as { setTransform?: unknown }).setTransform === 'function'
}

function canUseCytoscapeRenderer(): boolean {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  return isUsableCanvas2dContext(canvas.getContext('2d'))
}

async function exportCytoscapePng(
  cy: Core | null,
  container: HTMLDivElement | null,
  fallbackExportPng?: () => Promise<DagCanvasPngExport>
): Promise<DagCanvasPngExport> {
  if (cy) {
    try {
      const content = cy.png({ bg: '#050505', full: true, output: 'base64', scale: 2 })
      const { height, width } = readExportSize(container)
      if (content) return { content, encoding: 'base64', height, mimeType: 'image/png', width }
    } catch {
      // Some non-browser test DOMs do not expose a canvas backend; fall back to the caller's renderer export.
    }
  }
  if (fallbackExportPng) return fallbackExportPng()
  throw new Error('E_RUNTIME:cytoscape png export unavailable')
}

export const DagCanvas = forwardRef<DagCanvasHandle, DagCanvasProps>(function DagCanvas({
  className,
  fallbackExportPng,
  focusNodeId,
  graph,
  layout = 'dagre',
  onNodeClick,
  testId = 'dag-cytoscape-canvas'
}, ref) {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const onNodeClickRef = useRef(onNodeClick)
  const nodeButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const previousFocusNodeIdRef = useRef(focusNodeId)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(() => focusNodeId ?? graph.nodes[0]?.id ?? null)
  const elements = useMemo(() => toElements(graph, focusNodeId), [focusNodeId, graph])
  const activeNode = graph.nodes.find(node => node.id === activeNodeId)
  const activeOptionId = activeNodeId ? `${testId}-node-option-${activeNodeId}` : undefined

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  useEffect(() => {
    if (focusNodeId !== previousFocusNodeIdRef.current) {
      previousFocusNodeIdRef.current = focusNodeId
      if (focusNodeId && graph.nodes.some(node => node.id === focusNodeId)) {
        setActiveNodeId(focusNodeId)
      }
      return
    }
    if (!activeNodeId || !graph.nodes.some(node => node.id === activeNodeId)) {
      setActiveNodeId(graph.nodes[0]?.id ?? null)
    }
  }, [activeNodeId, focusNodeId, graph.nodes])

  useEffect(() => {
    ensureDagreRegistered()
    const container = containerRef.current
    if (!container) return undefined
    if (!canUseCytoscapeRenderer()) return undefined
    const graphTokens = getComputedStyle(container)
    const cy = cytoscape({
      container,
      elements,
      layout: {
        name: cytoscapeLayoutName(layout)
      },
      maxZoom: 2.5,
      minZoom: 0.2,
      style: [
        { selector: 'node', style: { 'background-color': cssToken(graphTokens, '--topology-node-process', '#c9a227'), 'border-color': cssToken(graphTokens, '--topology-node-bg', '#111827'), 'border-width': 2, color: cssToken(graphTokens, '--topology-node-label', '#f8fafc'), 'font-family': 'monospace', 'font-size': '10px', height: '34px', label: 'data(label)', 'overlay-opacity': 0, 'text-max-width': '96px', 'text-valign': 'bottom', 'text-wrap': 'ellipsis', width: '34px' } },
        { selector: 'node.focused', style: { 'background-color': cssToken(graphTokens, '--topology-node-focus-bg', '#c9a227'), color: cssToken(graphTokens, '--topology-node-focus-text', '#050505'), height: '44px', width: '44px' } },
        { selector: 'node.kind-port', style: { 'background-color': cssToken(graphTokens, '--topology-node-port', '#22c55e'), 'border-color': cssToken(graphTokens, '--topology-node-bg', '#111827') } },
        { selector: 'node.kind-window', style: { 'background-color': cssToken(graphTokens, '--topology-node-window', '#38bdf8'), 'border-color': cssToken(graphTokens, '--topology-node-bg', '#111827') } },
        { selector: 'node.kind-project', style: { 'background-color': cssToken(graphTokens, '--topology-node-project', '#f59e0b'), 'border-color': cssToken(graphTokens, '--topology-node-bg', '#111827') } },
        { selector: 'node.kind-tag, node.kind-ai-task, node.kind-event', style: { 'background-color': cssToken(graphTokens, '--topology-node-ai', '#a78bfa'), 'border-color': cssToken(graphTokens, '--topology-node-bg', '#111827') } },
        { selector: 'edge', style: { 'curve-style': 'bezier', 'font-size': '8px', label: 'data(label)', 'line-color': cssToken(graphTokens, '--topology-edge-default', '#64748b'), 'target-arrow-color': cssToken(graphTokens, '--topology-edge-default', '#64748b'), 'target-arrow-shape': 'triangle', width: 1.4 } },
        { selector: 'edge.in-cycle', style: { 'line-color': cssToken(graphTokens, '--topology-edge-danger', '#ef4444'), 'target-arrow-color': cssToken(graphTokens, '--topology-edge-danger', '#ef4444'), width: 3 } }
      ]
    })
    cyRef.current = cy
    cy.on('tap', 'node', (event: EventObject) => {
      onNodeClickRef.current?.(event.target.id())
    })
    return () => {
      cy.destroy()
      if (cyRef.current === cy) cyRef.current = null
    }
  }, [elements, layout])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('focused')
    if (!focusNodeId) return
    const selected = cy.getElementById(focusNodeId)
    if (selected.length === 0) return
    selected.addClass('focused')
    cy.animate({ fit: { eles: selected, padding: 120 } }, { duration: 160 })
  }, [focusNodeId])

  useImperativeHandle(ref, () => ({
    exportPng: () => exportCytoscapePng(cyRef.current, containerRef.current, fallbackExportPng)
  }), [fallbackExportPng])

  const focusNodeButton = (nodeId: string | null): void => {
    if (!nodeId) return
    setActiveNodeId(nodeId)
    onNodeClickRef.current?.(nodeId)
    window.setTimeout(() => nodeButtonRefs.current.get(nodeId)?.focus(), 0)
  }

  const handleRovingKeyDown = (event: KeyboardEvent<HTMLButtonElement>, nodeId: string): void => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusNodeButton(nextNodeId(graph.nodes, nodeId, 1))
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusNodeButton(nextNodeId(graph.nodes, nodeId, -1))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusNodeButton(graph.nodes[0]?.id ?? null)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusNodeButton(graph.nodes.at(-1)?.id ?? null)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      focusNodeButton(nodeId)
    }
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        aria-hidden="true"
        className={className ?? 'h-full min-h-[320px] w-full'}
        data-cytoscape-engine="cytoscape"
        data-edge-count={graph.edges.length}
        data-node-count={graph.nodes.length}
        data-testid={testId}
      />
      <div
        aria-activedescendant={activeOptionId}
        aria-label={t('dag.canvas.nodes', 'DAG canvas nodes')}
        className="absolute bottom-2 left-2 right-2 z-10 flex max-h-24 flex-wrap gap-1 overflow-auto border border-surface-800 bg-surface-950/90 p-2 radius-sm"
        role="listbox"
      >
        {graph.nodes.map(node => {
          const isActive = node.id === activeNodeId
          return (
            <button
              key={node.id}
              ref={element => {
                if (element) nodeButtonRefs.current.set(node.id, element)
                else nodeButtonRefs.current.delete(node.id)
              }}
              aria-label={`节点 ${node.label} (${node.id})`}
              aria-selected={isActive}
              className={isActive ? 'status-badge border-accent text-text-primary' : 'status-badge text-text-muted'}
              id={`${testId}-node-option-${node.id}`}
              onClick={() => focusNodeButton(node.id)}
              onFocus={() => setActiveNodeId(node.id)}
              onKeyDown={event => handleRovingKeyDown(event, node.id)}
              role="option"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {node.label}
            </button>
          )
        })}
      </div>
      <div aria-live="polite" className="sr-only" data-testid={`${testId}-a11y-status`}>
        {nodeAnnouncement(activeNode)}
      </div>
    </div>
  )
})
