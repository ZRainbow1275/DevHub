import { useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant
} from '@xyflow/react'
import type { NodeMouseHandler } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'

import { useProcessTopology } from '../../hooks/useProcessTopology'
import type { TopologyGraphNode, TopologyGraphEdge } from '../../hooks/useProcessTopology'
import { ProcessNode } from './topology/ProcessNode'
import { PortNode } from './topology/PortNode'
import { WindowNode } from './topology/WindowNode'
import { ProjectNode } from './topology/ProjectNode'
import { TopologyEdge } from './topology/TopologyEdge'
import { TopologyDetailPanel } from './topology/TopologyDetailPanel'
import { StatCard } from '../ui/StatCard'
import { ProcessIcon, PortIcon, WindowIcon, FolderIcon } from '../icons'

// Custom node types registration
const nodeTypes = {
  processNode: ProcessNode,
  portNode: PortNode,
  windowNode: WindowNode,
  projectNode: ProjectNode
}

// Custom edge types registration
const edgeTypes = {
  topologyEdge: TopologyEdge
}

// Layout constants
const NODE_WIDTH = 180
const NODE_HEIGHT = 70
const RANK_SEP = 80
const NODE_SEP = 40

/**
 * Apply dagre layout algorithm to position nodes hierarchically.
 * Project nodes at top, Process in middle, Port/Window at bottom.
 */
function applyDagreLayout(
  nodes: TopologyGraphNode[],
  edges: TopologyGraphEdge[]
): TopologyGraphNode[] {
  if (nodes.length === 0) return nodes

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40
  })

  // Add nodes with dimension hints
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  // Add edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const dagreNode = g.node(node.id)
    if (!dagreNode) return node
    return {
      ...node,
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2
      }
    }
  })
}

export function TopologyView() {
  const {
    nodes: rawNodes,
    edges: rawEdges,
    stats,
    selectedNode,
    selectNode,
    highlightedNodeIds,
    highlightedEdgeIds,
    setHoveredNodeId
  } = useProcessTopology()

  // Apply layout to raw nodes
  const layoutedNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    [rawNodes, rawEdges]
  )

  // Apply highlight styling to nodes
  const styledNodes = useMemo(() => {
    if (highlightedNodeIds.size === 0) return layoutedNodes
    return layoutedNodes.map((node) => ({
      ...node,
      style: {
        ...node.style,
        opacity: highlightedNodeIds.has(node.id) ? 1 : 0.3,
        transition: 'opacity 150ms ease'
      }
    }))
  }, [layoutedNodes, highlightedNodeIds])

  // Apply highlight styling to edges
  const styledEdges = useMemo(() => {
    if (highlightedEdgeIds.size === 0) return rawEdges
    return rawEdges.map((edge) => ({
      ...edge,
      selected: highlightedEdgeIds.has(edge.id)
    }))
  }, [rawEdges, highlightedEdgeIds])

  const [nodes, setNodes, onNodesChange] = useNodesState(styledNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges)

  // Track previous layout to only update positions when structure changes
  const prevStructureRef = useRef<string>('')

  useEffect(() => {
    // Compute a structure key based on node ids and edge ids
    const structureKey = [
      ...styledNodes.map((n) => n.id).sort(),
      '|',
      ...styledEdges.map((e) => e.id).sort()
    ].join(',')

    if (structureKey !== prevStructureRef.current) {
      // Structure changed: full update with new layout positions
      prevStructureRef.current = structureKey
      setNodes(styledNodes)
      setEdges(styledEdges)
    } else {
      // Only style changes (highlight): update in-place without resetting positions
      setNodes((prev) =>
        prev.map((n) => {
          const updated = styledNodes.find((sn) => sn.id === n.id)
          if (!updated) return n
          return { ...n, style: updated.style, data: updated.data }
        })
      )
      setEdges((prev) =>
        prev.map((e) => {
          const updated = styledEdges.find((se) => se.id === e.id)
          if (!updated) return e
          return { ...e, selected: updated.selected }
        })
      )
    }
  }, [styledNodes, styledEdges, setNodes, setEdges])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectNode(node.id)
    },
    [selectNode]
  )

  const onNodeMouseEnter: NodeMouseHandler = useCallback(
    (_event, node) => {
      setHoveredNodeId(node.id)
    },
    [setHoveredNodeId]
  )

  const onNodeMouseLeave: NodeMouseHandler = useCallback(
    () => {
      setHoveredNodeId(null)
    },
    [setHoveredNodeId]
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const isEmpty = rawNodes.length === 0

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Stats Bar */}
      <div className="flex-shrink-0 px-4 py-3 border-b-2 border-surface-700">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          <StatCard
            icon={<ProcessIcon size={16} className="text-gold" />}
            label="PROCESSES"
            value={stats.processCount}
            color="gold"
          />
          <StatCard
            icon={<PortIcon size={16} className="text-info" />}
            label="PORTS"
            value={stats.portCount}
            color="info"
          />
          <StatCard
            icon={<WindowIcon size={16} className="text-steel" />}
            label="WINDOWS"
            value={stats.windowCount}
            color="steel"
          />
          <StatCard
            icon={<FolderIcon size={16} className="text-accent" />}
            label="PROJECTS"
            value={stats.projectCount}
            color="accent"
          />
        </div>
      </div>

      {/* Graph Area */}
      <div className="flex-1 relative overflow-hidden">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div
              className="w-16 h-16 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-surface-600"
              style={{ borderRadius: '2px' }}
            >
              <ProcessIcon size={32} className="text-text-muted" />
            </div>
            <h3
              className="text-lg font-bold text-text-primary mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              NO TOPOLOGY DATA
            </h3>
            <p className="text-sm text-text-muted max-w-sm text-center">
              No process data available. Start scanning processes to view the relationship topology.
            </p>
          </div>
        ) : (
          <>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              style={{ background: 'transparent' }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="var(--color-surface-700, #334155)"
              />
              <Controls
                showInteractive={false}
                style={{
                  borderRadius: '2px',
                  border: '1px solid var(--color-surface-600, #475569)',
                  backgroundColor: 'var(--color-surface-800, #1e293b)'
                }}
              />
            </ReactFlow>

            {/* Detail Panel */}
            {selectedNode && (
              <TopologyDetailPanel
                node={selectedNode}
                onClose={() => selectNode(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
