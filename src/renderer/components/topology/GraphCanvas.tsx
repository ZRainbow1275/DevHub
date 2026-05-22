import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import type { GraphSnapshot } from '@shared/schemas/r8-runtime'
import { DagCanvas, type DagCanvasGraph, type DagCanvasHandle } from '../dag-editor/DagCanvas'

export interface GraphCanvasPngExport {
  content: string
  encoding: 'base64'
  height: number
  mimeType: 'image/png'
  width: number
}

export interface GraphCanvasHandle {
  exportPng: () => Promise<GraphCanvasPngExport>
}

interface GraphCanvasProps {
  snapshot: GraphSnapshot | null
  focusNodeId?: string | null
  onNodeClick?: (node: GraphSnapshot['nodes'][number]) => void
}

function exportNodePosition(index: number, total: number): { x: number; y: number } {
  const radius = Math.max(90, Math.min(210, 70 + total * 8))
  const angle = total <= 1 ? 0 : (Math.PI * 2 * index) / total
  return {
    x: 480 + Math.cos(angle) * radius,
    y: 270 + Math.sin(angle) * radius
  }
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('E_RUNTIME:png svg image decode failed'))
    image.src = url
  })
}

function readExportSize(root: HTMLDivElement, svgElement: SVGSVGElement): { width: number; height: number } {
  const rootRect = root.getBoundingClientRect()
  const svgRect = svgElement.getBoundingClientRect()
  const viewBox = svgElement.viewBox.baseVal
  const width = Math.round(rootRect.width || svgRect.width || viewBox.width || 960)
  const height = Math.round(rootRect.height || svgRect.height || viewBox.height || 540)
  return {
    height: Math.max(1, height),
    width: Math.max(1, width)
  }
}

async function exportSvgAsPng(root: HTMLDivElement | null): Promise<GraphCanvasPngExport> {
  const svgElement = root?.querySelector('svg')
  if (!root || !(svgElement instanceof SVGSVGElement)) throw new Error('E_RUNTIME:png svg source unavailable')
  const { width, height } = readExportSize(root, svgElement)
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clonedSvg.setAttribute('width', String(width))
  clonedSvg.setAttribute('height', String(height))
  clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  clonedSvg.setAttribute('role', 'img')
  const serializedSvg = new XMLSerializer().serializeToString(clonedSvg)
  const blob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadSvgImage(url)
    const canvas = document.createElement('canvas')
    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('E_RUNTIME:png canvas context unavailable')
    context.scale(pixelRatio, pixelRatio)
    context.fillStyle = '#050505'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/png')
    const content = dataUrl.replace(/^data:image\/png;base64,/, '')
    if (!content || content === dataUrl) throw new Error('E_RUNTIME:png canvas encode failed')
    return { content, encoding: 'base64', height, mimeType: 'image/png', width }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toDagCanvasGraph(snapshot: GraphSnapshot | null): DagCanvasGraph {
  return {
    nodes: snapshot?.nodes.map(node => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      meta: { ...node.meta, signalState: node.signals?.state ?? null },
      status: node.signals?.state
    })) ?? [],
    edges: snapshot?.edges.map(edge => ({
      id: edge.id,
      label: edge.type,
      source: edge.source,
      target: edge.target
    })) ?? []
  }
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({ snapshot, focusNodeId, onNodeClick }, ref) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dagCanvasRef = useRef<DagCanvasHandle | null>(null)
  const nodeLookup = useMemo(() => new Map(snapshot?.nodes.map(node => [node.id, node]) ?? []), [snapshot])
  const dagCanvasGraph = useMemo(() => toDagCanvasGraph(snapshot), [snapshot])
  const exportPositions = useMemo(() => new Map(snapshot?.nodes.map((node, index, list) => [node.id, exportNodePosition(index, list.length)]) ?? []), [snapshot])

  useImperativeHandle(ref, () => ({
    exportPng: () => dagCanvasRef.current?.exportPng() ?? exportSvgAsPng(rootRef.current)
  }), [])

  return (
    <div
      ref={rootRef}
      data-testid="graph-canvas"
      data-renderer-engine="cytoscape"
      data-renderer-export="cytoscape-png"
      data-as-of-ts={snapshot?.slice.asOfTs ?? 'current'}
      data-kind={snapshot?.slice.graphKind ?? 'pending'}
      data-node-count={snapshot?.nodes.length ?? 0}
      data-edge-count={snapshot?.edges.length ?? 0}
      data-theme-sync="topology-palette"
      className="relative h-full min-h-[520px] overflow-hidden border border-surface-700 bg-surface-950 radius-md"
    >
      {snapshot && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0"
          data-testid="graph-export-svg"
          height="540"
          role="img"
          viewBox="0 0 960 540"
          width="960"
        >
          <rect width="960" height="540" fill="#050505" />
          {snapshot.edges.map(edge => {
            const source = exportPositions.get(edge.source)
            const target = exportPositions.get(edge.target)
            if (!source || !target) return null
            return (
              <line
                key={edge.id}
                stroke={edge.kind === 'neural-relationship' ? 'var(--topology-edge-neural)' : edge.kind === 'flow' ? 'var(--topology-edge-flow)' : 'var(--topology-edge-network)'}
                strokeOpacity="0.7"
                strokeWidth="2"
                x1={source.x}
                x2={target.x}
                y1={source.y}
                y2={target.y}
              />
            )
          })}
          {snapshot.nodes.map(node => {
            const position = exportPositions.get(node.id) ?? { x: 480, y: 270 }
            return (
              <g key={node.id}>
                <circle cx={position.x} cy={position.y} fill="var(--topology-node-bg)" r="18" stroke="var(--topology-node-process)" strokeWidth="2" />
                <text fill="var(--topology-node-label)" fontFamily="monospace" fontSize="12" textAnchor="middle" x={position.x} y={position.y + 34}>
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <DagCanvas
        ref={dagCanvasRef}
        className="h-full min-h-[520px] w-full"
        fallbackExportPng={() => exportSvgAsPng(rootRef.current)}
        focusNodeId={focusNodeId}
        graph={dagCanvasGraph}
        layout={snapshot?.slice.layout === 'circle' || snapshot?.slice.layout === 'preset' ? 'circle' : 'dagre'}
        onNodeClick={nodeId => {
          const sourceNode = nodeLookup.get(nodeId)
          if (sourceNode) onNodeClick?.(sourceNode)
        }}
        testId="graph-cytoscape-canvas"
      />
      <div className="sr-only" data-testid="graph-node-labels">
        {snapshot?.nodes.map(node => node.label).join(' ')}
      </div>
    </div>
  )
})
