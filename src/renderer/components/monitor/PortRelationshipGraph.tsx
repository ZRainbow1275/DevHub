/**
 * PortRelationshipGraph — Neural graph for port topology.
 *
 * Uses NeuralGraphEngine with port-centric visual mapping:
 *   - LISTENING ports: gold pulsing nodes
 *   - ESTABLISHED: blue stable nodes
 *   - TIME_WAIT: grey fading nodes
 *   - Process: red hexagon-sized nodes
 *   - External: dashed diamond nodes
 *
 * Supports:
 *   - Bidirectional linkage with PortView (focus port -> highlight node)
 *   - Click node -> emit event to open PortFocusPanel
 */

import { useCallback, useEffect, useMemo, useState, memo } from 'react'
import { NeuralGraphWithControls } from './topology/NeuralGraph'
import type { GraphNode, GraphEdge } from './topology/NeuralGraphEngine'
import { PortTopologyData } from '@shared/types-extended'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { RefreshIcon, PortIcon } from '../icons'

// ============ Transform topology data to NeuralGraph format ============

function toNeuralGraphData(topology: PortTopologyData): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (const n of topology.nodes) {
    let nodeType: GraphNode['nodeType'] = 'port'
    let resourceWeight = 3
    let depth = 1

    if (n.type === 'process') {
      nodeType = 'process'
      resourceWeight = 8 + (n.metadata.portCount ?? 0) * 2
      depth = 0
    } else if (n.type === 'port') {
      const state = n.metadata.state
      if (state === 'LISTENING') {
        nodeType = 'port-listening'
        resourceWeight = 5
      } else if (state === 'ESTABLISHED') {
        nodeType = 'port-established'
        resourceWeight = 3
      } else if (state === 'TIME_WAIT') {
        nodeType = 'port-timewait'
        resourceWeight = 1
      }
      depth = 1
    } else if (n.type === 'external') {
      nodeType = 'external'
      resourceWeight = 2
      depth = 2
    }

    nodes.push({
      id: n.id,
      label: n.label,
      nodeType,
      resourceWeight,
      depth,
      metadata: {
        pid: n.metadata.pid,
        processName: n.metadata.processName,
        port: n.metadata.port,
        protocol: n.metadata.protocol,
        state: n.metadata.state,
        address: n.metadata.address,
        portCount: n.metadata.portCount
      }
    })
  }

  for (const e of topology.edges) {
    const isEstablished = e.label === 'ESTABLISHED'
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      edgeType: isEstablished ? 'port-connected' : 'process-binds-port',
      weight: isEstablished ? 0.4 : 0.6
    })
  }

  return { nodes, edges }
}

// ============ Component ============

interface PortRelationshipGraphProps {
  getTopology: () => Promise<PortTopologyData>
  /** Port number to focus/highlight in the graph */
  focusPort?: number | null
  /** Called when user clicks a node */
  onNodeClick?: (nodeData: { type: string; port?: number; pid?: number }) => void
}

export const PortRelationshipGraph = memo(function PortRelationshipGraph({
  getTopology,
  focusPort,
  onNodeClick
}: PortRelationshipGraphProps) {
  const [topology, setTopology] = useState<PortTopologyData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTopology = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getTopology()
      setTopology(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load topology')
    } finally {
      setIsLoading(false)
    }
  }, [getTopology])

  useEffect(() => {
    loadTopology()
  }, [loadTopology])

  const { nodes, edges } = useMemo(() => {
    if (!topology) return { nodes: [], edges: [] }
    return toNeuralGraphData(topology)
  }, [topology])

  const stats = useMemo(() => {
    if (!topology) return []
    return [
      { label: 'Processes', value: topology.nodes.filter(n => n.type === 'process').length, color: '#d64545' },
      { label: 'Ports', value: topology.nodes.filter(n => n.type === 'port').length, color: '#22c55e' },
      { label: 'External', value: topology.nodes.filter(n => n.type === 'external').length, color: '#f59e0b' }
    ]
  }, [topology])

  // Compute focus node ID from focusPort
  const focusNodeId = useMemo(() => {
    if (focusPort === null || focusPort === undefined) return null
    const node = nodes.find(n =>
      n.metadata?.port === focusPort && n.nodeType.startsWith('port')
    )
    return node?.id ?? null
  }, [focusPort, nodes])

  const handleNodeClick = useCallback((node: GraphNode) => {
    onNodeClick?.({
      type: node.nodeType,
      port: node.metadata?.port as number | undefined,
      pid: node.metadata?.pid as number | undefined
    })
  }, [onNodeClick])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in">
        <LoadingSpinner size="md" className="mb-4" />
        <p className="text-text-secondary text-sm">Loading topology data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in">
        <div className="w-16 h-16 bg-error/10 flex items-center justify-center mb-4 border-l-3 border-error" style={{ borderRadius: '2px' }}>
          <span className="text-2xl text-error">!</span>
        </div>
        <p className="text-error mb-2 font-bold text-sm">Error loading topology</p>
        <p className="text-text-muted text-xs mb-4">{error}</p>
        <button onClick={loadTopology} className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
          <RefreshIcon size={14} />
          Retry
        </button>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in">
        <div className="w-20 h-20 bg-surface-800 flex items-center justify-center mb-6 border-l-3 border-accent" style={{ borderRadius: '4px' }}>
          <PortIcon size={40} className="text-text-muted" />
        </div>
        <h3
          className="text-lg font-bold text-text-primary mb-2 uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          No topology data
        </h3>
        <p className="text-text-muted mb-4 text-sm">Start a service to see port relationships</p>
        <button onClick={loadTopology} className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
          <RefreshIcon size={14} />
          Refresh
        </button>
      </div>
    )
  }

  return (
    <NeuralGraphWithControls
      title="PORT TOPOLOGY"
      nodes={nodes}
      edges={edges}
      stats={stats}
      onNodeClick={handleNodeClick}
      focusNodeId={focusNodeId}
      emptyMessage="No port topology data"
      config={{
        linkDistanceParentChild: 100,
        linkDistanceOther: 140,
        yLayerGap: 120
      }}
    />
  )
})
