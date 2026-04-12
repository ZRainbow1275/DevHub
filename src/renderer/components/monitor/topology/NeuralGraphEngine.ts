/**
 * NeuralGraphEngine — d3-force powered neural relationship graph engine.
 *
 * Renders a live, force-directed graph where:
 *   - Nodes are "neurons": size ∝ resource weight, color ∝ type, pulse ∝ CPU
 *   - Edges are "axons": thickness ∝ strength, animated dash = data flow
 *
 * Rendering strategy: SVG for nodes/edges (crisp & interactive), optional
 * Canvas overlay for high-count particle effects (not implemented in v1).
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum
} from 'd3-force'
import { select, type Selection } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { drag as d3Drag, type DragBehavior, type SubjectPosition } from 'd3-drag'
import 'd3-transition' // side-effect import — augments Selection with .transition()

// ============ Public Types ============

export type NeuralNodeType =
  | 'process'
  | 'port'
  | 'window'
  | 'project'
  | 'external'
  | 'port-listening'
  | 'port-established'
  | 'port-timewait'

export interface GraphNode extends SimulationNodeDatum {
  id: string
  label: string
  nodeType: NeuralNodeType
  /** Combined CPU + memory weight — drives visual radius & charge */
  resourceWeight: number
  /** Tree depth (0 = root project, 1 = process, 2 = port/window) */
  depth: number
  /** CPU% for pulse speed */
  cpu?: number
  /** Extra metadata rendered in tooltips / detail panel */
  metadata?: Record<string, unknown>
  /** Visual radius computed from resourceWeight */
  visualRadius?: number
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  id: string
  edgeType: string
  /** 0–1 normalized strength for thickness/particles */
  weight: number
}

export interface NeuralForceConfig {
  centerStrength: number
  chargeStrength: number
  chargeDistanceMax: number
  linkDistanceParentChild: number
  linkDistanceOther: number
  collisionPadding: number
  yStrength: number
  yLayerGap: number
}

const DEFAULT_CONFIG: NeuralForceConfig = {
  centerStrength: 0.03,
  chargeStrength: -100,
  chargeDistanceMax: 300,
  linkDistanceParentChild: 80,
  linkDistanceOther: 120,
  collisionPadding: 5,
  yStrength: 0.05,
  yLayerGap: 150
}

// ============ Visual Constants ============

const NODE_COLOR_MAP: Record<string, { base: string; glow: string }> = {
  'ai-tool':          { base: '#d64545', glow: '#ff6b6b' },
  'dev-server':       { base: '#c9a227', glow: '#ffd700' },
  'build':            { base: '#3b82f6', glow: '#60a5fa' },
  'database':         { base: '#8b5cf6', glow: '#a78bfa' },
  'other':            { base: '#6b7d8a', glow: '#94a3b8' },
  'process':          { base: '#c9a227', glow: '#ffd700' },
  'port':             { base: '#22c55e', glow: '#4ade80' },
  'port-listening':   { base: '#c9a227', glow: '#ffd700' },
  'port-established': { base: '#3b82f6', glow: '#60a5fa' },
  'port-timewait':    { base: '#6b7280', glow: '#9ca3af' },
  'window':           { base: '#6b7d8a', glow: '#94a3b8' },
  'project':          { base: '#d64545', glow: '#ff6b6b' },
  'external':         { base: '#f59e0b', glow: '#fbbf24' }
}

const EDGE_COLOR_MAP: Record<string, string> = {
  'parent-child':          '#c9a227',
  'project-owns-process':  '#d64545',
  'process-binds-port':    '#22c55e',
  'process-owns-window':   '#6b7d8a',
  'port-connected':        '#3b82f6',
  'default':               '#475569'
}

function clamp(min: number, val: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function computeVisualRadius(node: GraphNode): number {
  // CPU-proportional: higher CPU -> larger node
  const cpuFactor = (node.cpu ?? 0) / 100 // 0-1
  const baseSqrt = Math.sqrt(node.resourceWeight * 2 + 10) * 5
  // Scale up by up to 40% for high-CPU processes
  const cpuBoost = 1 + cpuFactor * 0.4
  return clamp(15, baseSqrt * cpuBoost, 60)
}

/**
 * Interpolate a hex color from `from` toward `to` by ratio (0-1).
 */
function lerpColor(from: string, to: string, ratio: number): string {
  const r = Math.round(parseInt(from.slice(1, 3), 16) * (1 - ratio) + parseInt(to.slice(1, 3), 16) * ratio)
  const g = Math.round(parseInt(from.slice(3, 5), 16) * (1 - ratio) + parseInt(to.slice(3, 5), 16) * ratio)
  const b = Math.round(parseInt(from.slice(5, 7), 16) * (1 - ratio) + parseInt(to.slice(5, 7), 16) * ratio)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function getNodeColor(node: GraphNode): { base: string; glow: string } {
  // Check metadata.processType first (for process nodes)
  const processType = node.metadata?.processType as string | undefined
  let colors = NODE_COLOR_MAP[node.nodeType] ?? NODE_COLOR_MAP['other']
  if (processType && NODE_COLOR_MAP[processType]) {
    colors = NODE_COLOR_MAP[processType]
  }

  // Memory-based tint: high memory shifts color toward red/warning
  const memoryMB = Number(node.metadata?.memory ?? 0)
  if (memoryMB > 0 && (node.nodeType === 'process' || processType)) {
    // 0-500MB normal, 500-2000MB warm, 2000+ hot
    const memRatio = clamp(0, memoryMB / 2000, 1)
    if (memRatio > 0.2) {
      const hotBase = '#d64545'
      const hotGlow = '#ff6b6b'
      return {
        base: lerpColor(colors.base, hotBase, memRatio * 0.6),
        glow: lerpColor(colors.glow, hotGlow, memRatio * 0.4),
      }
    }
  }

  return colors
}

function getEdgeColor(edge: GraphEdge): string {
  return EDGE_COLOR_MAP[edge.edgeType] ?? EDGE_COLOR_MAP['default']
}

function pulseSpeed(cpu: number | undefined): number {
  if (cpu === undefined || cpu < 1) return 3000
  // CPU 0→100 maps to 3000ms→500ms
  return clamp(500, 3000 - (cpu / 100) * 2500, 3000)
}

// ============ Engine ============

export class NeuralGraphEngine {
  private container: HTMLElement
  private svg!: Selection<SVGSVGElement, unknown, null, undefined>
  private mainGroup!: Selection<SVGGElement, unknown, null, undefined>
  private edgeGroup!: Selection<SVGGElement, unknown, null, undefined>
  private nodeGroup!: Selection<SVGGElement, unknown, null, undefined>
  private simulation!: Simulation<GraphNode, GraphEdge>
  private zoomBehavior!: ZoomBehavior<SVGSVGElement, unknown>
  private dragBehavior!: DragBehavior<SVGGElement, GraphNode, GraphNode | SubjectPosition>

  private nodes: GraphNode[] = []
  private edges: GraphEdge[] = []
  private config: NeuralForceConfig

  private hoverCallback: ((node: GraphNode | null) => void) | null = null
  private clickCallback: ((node: GraphNode) => void) | null = null
  private contextMenuCallback: ((node: GraphNode, event: MouseEvent) => void) | null = null

  private hoveredNodeId: string | null = null
  private animationFrameId: number | null = null
  private destroyed = false
  private width = 0
  private height = 0

  constructor(container: HTMLElement, config?: Partial<NeuralForceConfig>) {
    this.container = container
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.init()
  }

  // ---- Lifecycle ----

  private init(): void {
    const rect = this.container.getBoundingClientRect()
    this.width = rect.width || 800
    this.height = rect.height || 600

    // Create SVG
    this.svg = select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('overflow', 'hidden')
      .style('background', 'transparent')

    // Defs for glow filter and arrow markers
    const defs = this.svg.append('defs')

    // Glow filter
    const filter = defs.append('filter').attr('id', 'neural-glow')
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Pulse animation styles (injected as <style>)
    defs.append('style').text(`
      @keyframes neural-pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      @keyframes neural-flow {
        to { stroke-dashoffset: -20; }
      }
      .neural-edge-flow {
        animation: neural-flow 1s linear infinite;
      }
      .neural-node-pulse {
        animation: neural-pulse var(--pulse-speed, 3000ms) ease-in-out infinite;
      }
      .neural-node-enter {
        animation: neural-node-grow 0.5s ease-out forwards;
      }
      @keyframes neural-node-grow {
        from { transform: scale(0.1); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .neural-node-exit {
        animation: neural-node-shrink 0.5s ease-in forwards;
      }
      @keyframes neural-node-shrink {
        from { transform: scale(1); opacity: 1; }
        to { transform: scale(0.1); opacity: 0; }
      }
    `)

    // Main group for zoom/pan
    this.mainGroup = this.svg.append('g').attr('class', 'neural-main')
    this.edgeGroup = this.mainGroup.append('g').attr('class', 'neural-edges')
    this.nodeGroup = this.mainGroup.append('g').attr('class', 'neural-nodes')

    // Zoom
    this.zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        this.mainGroup.attr('transform', event.transform.toString())
      })
    this.svg.call(this.zoomBehavior)

    // Click on background clears hover
    this.svg.on('click', (event) => {
      if (event.target === this.svg.node()) {
        this.setHoveredNode(null)
      }
    })

    // Drag behavior
    this.dragBehavior = d3Drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.1).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    // Simulation
    this.simulation = forceSimulation<GraphNode, GraphEdge>()
      .alphaDecay(0.02)
      .on('tick', () => this.tick())
  }

  setData(nodes: GraphNode[], edges: GraphEdge[]): void {
    if (this.destroyed) return

    // Compute visual radii
    for (const n of nodes) {
      n.visualRadius = computeVisualRadius(n)
    }

    // Detect new & removed nodes for enter/exit animations
    const oldIds = new Set(this.nodes.map(n => n.id))
    const newIds = new Set(nodes.map(n => n.id))
    const enterIds = new Set<string>()
    for (const id of newIds) {
      if (!oldIds.has(id)) enterIds.add(id)
    }

    // Preserve positions from old nodes
    const oldPositions = new Map<string, { x: number; y: number }>()
    for (const n of this.nodes) {
      if (n.x !== undefined && n.y !== undefined) {
        oldPositions.set(n.id, { x: n.x, y: n.y })
      }
    }
    for (const n of nodes) {
      const old = oldPositions.get(n.id)
      if (old) {
        n.x = old.x
        n.y = old.y
      }
    }

    this.nodes = nodes
    this.edges = edges

    // Rebuild simulation
    this.simulation.nodes(this.nodes)
    this.simulation
      .force('center', forceCenter(this.width / 2, this.height / 2).strength(this.config.centerStrength))
      .force('charge', forceManyBody<GraphNode>()
        .strength((d) => -(d.resourceWeight + 1) * this.config.chargeStrength / -100 * 100)
        .distanceMax(this.config.chargeDistanceMax)
      )
      .force('link', forceLink<GraphNode, GraphEdge>(this.edges)
        .id((d) => d.id)
        .distance((d) => {
          if (d.edgeType === 'parent-child' || d.edgeType === 'project-owns-process') {
            return this.config.linkDistanceParentChild
          }
          return this.config.linkDistanceOther
        })
        .strength((d) => d.weight * 0.8)
      )
      .force('collide', forceCollide<GraphNode>()
        .radius((d) => (d.visualRadius ?? 20) + this.config.collisionPadding)
      )
      .force('y', forceY<GraphNode>()
        .y((d) => (d.depth ?? 0) * this.config.yLayerGap + this.height / 4)
        .strength(this.config.yStrength)
      )
      .alpha(0.4)
      .restart()

    this.renderEdges()
    this.renderNodes(enterIds)
  }

  // ---- Rendering ----

  private renderEdges(): void {
    const edgeSel = this.edgeGroup
      .selectAll<SVGLineElement, GraphEdge>('line.neural-edge')
      .data(this.edges, (d) => d.id)

    edgeSel.exit().remove()

    const enter = edgeSel.enter()
      .append('line')
      .attr('class', 'neural-edge neural-edge-flow')
      .attr('stroke-dasharray', '8 4')

    enter.merge(edgeSel as Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>)
      .attr('stroke', (d) => getEdgeColor(d))
      .attr('stroke-width', (d) => clamp(1, d.weight * 4, 6))
      .attr('stroke-opacity', (d) => clamp(0.3, d.weight * 0.7, 0.8))
      // Higher weight = faster flow animation
      .style('animation-duration', (d) => `${clamp(0.3, 1.5 - d.weight, 1.5)}s`)
  }

  private renderNodes(enterIds: Set<string>): void {
    const nodeSel = this.nodeGroup
      .selectAll<SVGGElement, GraphNode>('g.neural-node')
      .data(this.nodes, (d) => d.id)

    // Exit: shrink animation then remove
    nodeSel.exit()
      .classed('neural-node-exit', true)
      .transition()
      .duration(500)
      .style('opacity', 0)
      .remove()

    // Enter
    const enter = nodeSel.enter()
      .append('g')
      .attr('class', (d) => `neural-node ${enterIds.has(d.id) ? 'neural-node-enter' : ''}`)
      .style('cursor', 'pointer')

    // Glow circle (behind main circle)
    enter.append('circle')
      .attr('class', 'neural-glow-ring')
      .attr('r', (d) => (d.visualRadius ?? 20) + 4)
      .attr('fill', 'none')
      .attr('stroke', (d) => getNodeColor(d).glow)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.3)
      .attr('filter', 'url(#neural-glow)')

    // Main circle
    enter.append('circle')
      .attr('class', 'neural-main-circle')
      .attr('r', (d) => d.visualRadius ?? 20)
      .attr('fill', (d) => getNodeColor(d).base)
      .attr('stroke', (d) => getNodeColor(d).glow)
      .attr('stroke-width', 1.5)
      .style('--pulse-speed', (d) => `${pulseSpeed(d.cpu)}ms`)
      .classed('neural-node-pulse', true)

    // Label
    enter.append('text')
      .attr('class', 'neural-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.visualRadius ?? 20) + 14)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono, monospace)')
      .text((d) => {
        const maxLen = 14
        return d.label.length > maxLen ? d.label.slice(0, maxLen) + '...' : d.label
      })

    // Interactions
    enter
      .on('mouseenter', (_event, d) => {
        this.setHoveredNode(d.id)
        this.hoverCallback?.(d)
      })
      .on('mouseleave', () => {
        this.setHoveredNode(null)
        this.hoverCallback?.(null)
      })
      .on('click', (event, d) => {
        event.stopPropagation()
        this.clickCallback?.(d)
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuCallback?.(d, event)
      })

    // Apply drag
    enter.call(this.dragBehavior)

    // Merge: update existing node visuals
    const merged = enter.merge(nodeSel as Selection<SVGGElement, GraphNode, SVGGElement, unknown>)

    merged.select('circle.neural-main-circle')
      .attr('r', (d) => d.visualRadius ?? 20)
      .attr('fill', (d) => getNodeColor(d).base)
      .attr('stroke', (d) => getNodeColor(d).glow)
      .style('--pulse-speed', (d) => `${pulseSpeed(d.cpu)}ms`)

    merged.select('circle.neural-glow-ring')
      .attr('r', (d) => (d.visualRadius ?? 20) + 4)
      .attr('stroke', (d) => getNodeColor(d).glow)
  }

  private tick(): void {
    if (this.destroyed) return

    // Update edge positions
    this.edgeGroup.selectAll<SVGLineElement, GraphEdge>('line.neural-edge')
      .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
      .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
      .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
      .attr('y2', (d) => (d.target as GraphNode).y ?? 0)

    // Update node positions
    this.nodeGroup.selectAll<SVGGElement, GraphNode>('g.neural-node')
      .attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

    // Highlight logic
    this.applyHighlight()
  }

  private applyHighlight(): void {
    if (!this.hoveredNodeId) {
      // Reset all opacities
      this.nodeGroup.selectAll('g.neural-node').style('opacity', 1)
      this.edgeGroup.selectAll('line.neural-edge').style('opacity', 0.6)
      return
    }

    const hoveredId = this.hoveredNodeId
    const connectedIds = new Set<string>([hoveredId])
    const connectedEdgeIds = new Set<string>()

    for (const e of this.edges) {
      const srcId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source as string
      const tgtId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target as string
      if (srcId === hoveredId || tgtId === hoveredId) {
        connectedIds.add(srcId)
        connectedIds.add(tgtId)
        connectedEdgeIds.add(e.id)
      }
    }

    this.nodeGroup.selectAll<SVGGElement, GraphNode>('g.neural-node')
      .style('opacity', (d) => connectedIds.has(d.id) ? 1 : 0.2)

    this.edgeGroup.selectAll<SVGLineElement, GraphEdge>('line.neural-edge')
      .style('opacity', (d) => connectedEdgeIds.has(d.id) ? 0.9 : 0.1)
  }

  private setHoveredNode(id: string | null): void {
    this.hoveredNodeId = id
    this.applyHighlight()
  }

  // ---- Public API ----

  onNodeHover(callback: (node: GraphNode | null) => void): void {
    this.hoverCallback = callback
  }

  onNodeClick(callback: (node: GraphNode) => void): void {
    this.clickCallback = callback
  }

  onContextMenu(callback: (node: GraphNode, event: MouseEvent) => void): void {
    this.contextMenuCallback = callback
  }

  focusNode(nodeId: string): void {
    const node = this.nodes.find(n => n.id === nodeId)
    if (!node || node.x === undefined || node.y === undefined) return

    const scale = 1.5
    const x = this.width / 2 - node.x * scale
    const y = this.height / 2 - node.y * scale

    this.svg
      .transition()
      .duration(500)
      .call(
        this.zoomBehavior.transform,
        zoomIdentity.translate(x, y).scale(scale)
      )

    // Highlight the focused node
    this.setHoveredNode(nodeId)
  }

  resetView(): void {
    this.svg
      .transition()
      .duration(400)
      .call(this.zoomBehavior.transform, zoomIdentity)
    this.setHoveredNode(null)
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect()
    this.width = rect.width || 800
    this.height = rect.height || 600
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`)

    // Re-center the force
    this.simulation.force('center', forceCenter(this.width / 2, this.height / 2).strength(this.config.centerStrength))
    this.simulation.alpha(0.1).restart()
  }

  destroy(): void {
    this.destroyed = true
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
    this.simulation.stop()
    this.svg.remove()
  }

  /** Get current node list (with positions) */
  getNodes(): GraphNode[] {
    return this.nodes
  }

  /** Get current edge list */
  getEdges(): GraphEdge[] {
    return this.edges
  }
}
