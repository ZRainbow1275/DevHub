import { useCallback, useEffect, useMemo, useState, memo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  Handle,
  Position,
  MarkerType
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'
import { PortTopologyData, TopologyNode } from '@shared/types-extended'
import { ProcessIcon, PortIcon, GlobeIcon, RefreshIcon } from '../icons'
import { LoadingSpinner } from '../ui/LoadingSpinner'

// ============ Dagre Layout ============

const DAGRE_NODE_WIDTH = 200
const DAGRE_NODE_HEIGHT = 80

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 120,
    marginx: 40,
    marginy: 40
  })

  nodes.forEach((node) => {
    g.setNode(node.id, { width: DAGRE_NODE_WIDTH, height: DAGRE_NODE_HEIGHT })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id)
    return {
      ...node,
      position: {
        x: dagreNode.x - DAGRE_NODE_WIDTH / 2,
        y: dagreNode.y - DAGRE_NODE_HEIGHT / 2
      }
    }
  })

  return { nodes: layoutedNodes, edges }
}

// ============ Custom Node Components ============

const ProcessNode = memo(function ProcessNode({ data }: NodeProps) {
  return (
    <div
      className="bg-surface-800 border-2 border-accent px-4 py-3 min-w-[180px] border-l-[4px] border-l-accent"
      style={{ borderRadius: '2px' }}
    >
      <Handle type="source" position={Position.Right} className="!bg-accent !w-2 !h-2 !border-0" style={{ borderRadius: '1px' }} />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 bg-surface-700 flex items-center justify-center" style={{ borderRadius: '2px' }}>
          <ProcessIcon size={14} className="text-accent" />
        </div>
        <span className="text-xs font-bold text-text-primary truncate max-w-[120px]">
          {data.label as string}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
        <span>PID: {data.pid as number}</span>
        {(data.portCount as number) > 0 && (
          <span className="bg-accent/10 text-accent px-1.5 py-0.5" style={{ borderRadius: '2px' }}>
            {data.portCount as number} 端口
          </span>
        )}
      </div>
    </div>
  )
})

const PortNode = memo(function PortNode({ data }: NodeProps) {
  const stateColors: Record<string, { border: string; text: string; bg: string }> = {
    LISTENING: { border: 'border-success', text: 'text-success', bg: 'bg-success' },
    ESTABLISHED: { border: 'border-accent', text: 'text-accent', bg: 'bg-accent' },
    TIME_WAIT: { border: 'border-warning', text: 'text-warning', bg: 'bg-warning' },
    CLOSE_WAIT: { border: 'border-error', text: 'text-error', bg: 'bg-error' }
  }
  const stateColor = stateColors[data.state as string] ?? { border: 'border-surface-500', text: 'text-text-muted', bg: 'bg-surface-500' }

  return (
    <div
      className={`bg-surface-800 border-2 border-surface-600 px-4 py-3 min-w-[160px] border-l-[4px] ${stateColor.border}`}
      style={{ borderRadius: '2px' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-surface-400 !w-2 !h-2 !border-0" style={{ borderRadius: '1px' }} />
      <Handle type="source" position={Position.Right} className="!bg-surface-400 !w-2 !h-2 !border-0" style={{ borderRadius: '1px' }} />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 bg-surface-700 flex items-center justify-center" style={{ borderRadius: '2px' }}>
          <PortIcon size={14} className={stateColor.text} />
        </div>
        <span className="text-sm font-bold text-text-primary font-mono">
          :{data.port as number}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
        <span className="uppercase">{data.protocol as string}</span>
        <span className={`${stateColor.bg} w-1.5 h-1.5`} style={{ borderRadius: '1px' }} />
        <span className={stateColor.text}>{data.state as string}</span>
      </div>
    </div>
  )
})

const ExternalNode = memo(function ExternalNode({ data }: NodeProps) {
  return (
    <div
      className="bg-surface-900 border-2 border-surface-600 border-dashed px-4 py-3 min-w-[160px] border-l-[4px] border-l-warning/60"
      style={{ borderRadius: '2px' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-warning !w-2 !h-2 !border-0" style={{ borderRadius: '1px' }} />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 bg-surface-700 flex items-center justify-center" style={{ borderRadius: '2px' }}>
          <GlobeIcon size={14} className="text-warning" />
        </div>
        <span className="text-xs font-bold text-text-secondary truncate max-w-[120px]">
          {data.label as string}
        </span>
      </div>
      <div className="text-[10px] text-text-muted font-mono">
        External
      </div>
    </div>
  )
})

const nodeTypes: NodeTypes = {
  process: ProcessNode,
  port: PortNode,
  external: ExternalNode
}

// ============ Topology -> ReactFlow Conversion ============

function toReactFlowElements(topology: PortTopologyData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = topology.nodes.map((n: TopologyNode) => ({
    id: n.id,
    type: n.type,
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      pid: n.metadata.pid,
      processName: n.metadata.processName,
      port: n.metadata.port,
      protocol: n.metadata.protocol,
      state: n.metadata.state,
      address: n.metadata.address,
      portCount: n.metadata.portCount
    }
  }))

  const edges: Edge[] = topology.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'default',
    animated: false,
    style: {
      stroke: 'var(--color-surface-500)',
      strokeWidth: 2
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: 'var(--color-surface-500)'
    },
    labelStyle: {
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      fill: 'var(--color-text-muted)'
    }
  }))

  return getLayoutedElements(nodes, edges, 'LR')
}

// ============ Main Component ============

interface PortRelationshipGraphProps {
  getTopology: () => Promise<PortTopologyData>
}

export const PortRelationshipGraph = memo(function PortRelationshipGraph({ getTopology }: PortRelationshipGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ processes: 0, ports: 0, externals: 0 })

  const loadTopology = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const topology = await getTopology()
      if (topology.nodes.length === 0) {
        setNodes([])
        setEdges([])
        setStats({ processes: 0, ports: 0, externals: 0 })
        return
      }

      const { nodes: layoutedNodes, edges: layoutedEdges } = toReactFlowElements(topology)
      setNodes(layoutedNodes)
      setEdges(layoutedEdges)
      setStats({
        processes: topology.nodes.filter(n => n.type === 'process').length,
        ports: topology.nodes.filter(n => n.type === 'port').length,
        externals: topology.nodes.filter(n => n.type === 'external').length
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load topology')
    } finally {
      setIsLoading(false)
    }
  }, [getTopology, setNodes, setEdges])

  useEffect(() => {
    loadTopology()
  }, [loadTopology])

  const minimapNodeColor = useMemo(() => {
    return (node: Node) => {
      switch (node.type) {
        case 'process': return 'var(--color-accent)'
        case 'port': return 'var(--color-success)'
        case 'external': return 'var(--color-warning)'
        default: return 'var(--color-surface-500)'
      }
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in">
        <LoadingSpinner size="md" className="mb-4" />
        <p className="text-text-secondary">Loading topology data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in">
        <div className="w-16 h-16 bg-error/10 flex items-center justify-center mb-4 border-l-3 border-error" style={{ borderRadius: '2px' }}>
          <span className="text-2xl text-error">!</span>
        </div>
        <p className="text-error mb-2 font-bold">Error loading topology</p>
        <p className="text-text-muted text-sm mb-4">{error}</p>
        <button
          onClick={loadTopology}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
        >
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
        <p className="text-text-muted mb-4">Start a service to see port relationships</p>
        <button
          onClick={loadTopology}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
        >
          <RefreshIcon size={14} />
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats Bar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-surface-900/50 border-b border-surface-700/30">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="w-2 h-2 bg-accent" style={{ borderRadius: '1px' }} />
          <span>Processes: <span className="text-text-primary font-bold">{stats.processes}</span></span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="w-2 h-2 bg-success" style={{ borderRadius: '1px' }} />
          <span>Ports: <span className="text-text-primary font-bold">{stats.ports}</span></span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="w-2 h-2 bg-warning" style={{ borderRadius: '1px' }} />
          <span>External: <span className="text-text-primary font-bold">{stats.externals}</span></span>
        </div>
        <div className="ml-auto">
          <button
            onClick={loadTopology}
            className="btn-icon-sm text-text-muted hover:text-text-primary hover:bg-surface-700 transition-all duration-200"
            title="Refresh topology"
          >
            <RefreshIcon size={14} />
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--color-surface-950)' }}
        >
          <Background
            color="var(--color-surface-800)"
            gap={20}
            size={1}
          />
          <Controls
            showInteractive={false}
            className="!bg-surface-800 !border-surface-700 !shadow-none [&>button]:!bg-surface-800 [&>button]:!border-surface-700 [&>button]:!fill-text-muted [&>button:hover]:!bg-surface-700 [&>button:hover]:!fill-text-primary"
            style={{ borderRadius: '2px' }}
          />
          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="rgba(0, 0, 0, 0.7)"
            className="!bg-surface-900 !border-surface-700"
            style={{ borderRadius: '2px' }}
          />
        </ReactFlow>
      </div>
    </div>
  )
})
