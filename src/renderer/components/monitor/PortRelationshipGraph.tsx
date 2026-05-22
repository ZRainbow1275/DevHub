/**
 * PortRelationshipGraph -- Hierarchical flow chart for Port -> Process -> Window relationships.
 *
 * Uses @xyflow/react (ReactFlow) with @dagrejs/dagre for automatic left-to-right layout.
 * Three layers: Ports (left) -> Processes (center) -> Windows (right)
 *
 * Supports:
 *   - Click node to show detail (emit event)
 *   - Hover to highlight connected paths
 *   - Zoom and pan controls
 *   - MiniMap for overview
 *   - Search/filter by PID, port number, window title
 */

import { useCallback, useEffect, useState, useRef, memo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'

import { useProcessStore } from '../../stores/processStore'
import { usePortStore } from '../../stores/portStore'
import { useWindowStore } from '../../stores/windowStore'
import { FlowPortNode, type FlowPortNodeData } from './topology/FlowPortNode'
import { FlowProcessNode, type FlowProcessNodeData } from './topology/FlowProcessNode'
import { FlowWindowNode, type FlowWindowNodeData } from './topology/FlowWindowNode'
import { FlowEdge, type FlowEdgeData } from './topology/FlowEdge'
import { NetworkIcon, SearchIcon } from '../icons'

import type { ProcessInfo, PortInfo, WindowInfo } from '@shared/types-extended'

// ============ Relationship Types ============

export const PORT_RELATIONSHIP_DEPTH_MIN = 1
export const PORT_RELATIONSHIP_DEPTH_MAX = 3

type PortRelationshipDepth = 1 | 2 | 3
type RelationshipKind = 'owns' | 'connects'

interface RelationshipMetadata extends Record<string, unknown> {
  relationshipDepth: PortRelationshipDepth
  relationshipKind?: RelationshipKind
  port?: number
  pid?: number
  hwnd?: number
  remoteAddress?: string
}

export interface FlowRemoteNodeData extends RelationshipMetadata {
  label: string
  remoteAddress: string
  protocol: string
  state: string
  port: number
  pid: number
  processName: string
}

type PortRelationshipNodeData =
  | (FlowPortNodeData & RelationshipMetadata)
  | (FlowProcessNodeData & RelationshipMetadata)
  | (FlowWindowNodeData & RelationshipMetadata)
  | FlowRemoteNodeData

type PortRelationshipEdgeData = FlowEdgeData & {
  relationshipKind: RelationshipKind
  relationshipDepth: PortRelationshipDepth
  sourceKind: 'port' | 'process'
  targetKind: 'process' | 'window' | 'remote'
  port?: number
  pid?: number
  hwnd?: number
  remoteAddress?: string
}

type PortRelationshipNode = Node<PortRelationshipNodeData>
type PortRelationshipEdge = Edge<PortRelationshipEdgeData>

function FlowRemoteNode({ data, selected }: NodeProps<Node<FlowRemoteNodeData>>) {
  return (
    <div
      className={`
        relative bg-surface-800 border-l-3 p-2.5 min-w-[170px] transition-all duration-150 radius-sm
        ${selected ? 'border-accent bg-accent/10 shadow-lg' : 'border-warning hover:bg-surface-700'}
      `}
      data-relationship-kind="connects"
      data-remote-address={data.remoteAddress}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-warning !border-0 radius-sm"
      />

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-warning/10 flex items-center justify-center border-l-2 border-warning flex-shrink-0 radius-sm">
          <NetworkIcon size={12} className="text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-bold text-text-primary font-mono truncate"
            title={data.remoteAddress}
          >
            {data.remoteAddress}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-text-muted">{data.protocol}</span>
            <span className="text-[10px] text-warning">{data.state}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Node/Edge Types Registration ============

const nodeTypes: NodeTypes = {
  flowPort: FlowPortNode,
  flowProcess: FlowProcessNode,
  flowWindow: FlowWindowNode,
  flowRemote: FlowRemoteNode,
}

const edgeTypes: EdgeTypes = {
  flowEdge: FlowEdge,
}

// ============ Dagre Layout ============

const DAGRE_NODE_WIDTH = 180
const DAGRE_NODE_HEIGHT = 80

function applyDagreLayout(
  nodes: PortRelationshipNode[],
  edges: PortRelationshipEdge[],
): { nodes: PortRelationshipNode[]; edges: PortRelationshipEdge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'LR',
    nodesep: 30,
    ranksep: 100,
    marginx: 40,
    marginy: 40,
  })

  for (const node of nodes) {
    g.setNode(node.id, { width: DAGRE_NODE_WIDTH, height: DAGRE_NODE_HEIGHT })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const laidOutNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - DAGRE_NODE_WIDTH / 2,
        y: nodeWithPosition.y - DAGRE_NODE_HEIGHT / 2,
      },
    }
  })

  return { nodes: laidOutNodes, edges }
}

// ============ Data Transformation ============

interface FlowGraphData {
  nodes: PortRelationshipNode[]
  edges: PortRelationshipEdge[]
  portCount: number
  processCount: number
  windowCount: number
  remoteCount: number
}

function clampRelationshipDepth(value: number): PortRelationshipDepth {
  if (value <= PORT_RELATIONSHIP_DEPTH_MIN) return 1
  if (value >= PORT_RELATIONSHIP_DEPTH_MAX) return 3
  return 2
}

export function isConcreteRemoteAddress(foreignAddress: string | undefined): boolean {
  const normalized = foreignAddress?.trim().toLowerCase()
  if (!normalized) return false

  return ![
    '*',
    '*:*',
    '0.0.0.0',
    '0.0.0.0:0',
    '::',
    ':::0',
    '[::]',
    '[::]:0',
  ].includes(normalized)
}

function buildRemoteNodeId(foreignAddress: string): string {
  const normalized = foreignAddress
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `remote-${normalized || 'unknown'}`
}

function countNodesByType(nodes: PortRelationshipNode[]): Omit<FlowGraphData, 'nodes' | 'edges'> {
  return {
    portCount: nodes.filter((node) => node.type === 'flowPort').length,
    processCount: nodes.filter((node) => node.type === 'flowProcess').length,
    windowCount: nodes.filter((node) => node.type === 'flowWindow').length,
    remoteCount: nodes.filter((node) => node.type === 'flowRemote').length,
  }
}

function getNumericNodeData(node: Node, key: 'port' | 'pid' | 'hwnd'): number | undefined {
  const value = node.data?.[key]
  return typeof value === 'number' ? value : undefined
}

export function filterFlowDataByDepth(
  nodes: PortRelationshipNode[],
  edges: PortRelationshipEdge[],
  maxDepth: number,
): FlowGraphData {
  const relationshipDepth = clampRelationshipDepth(maxDepth)
  const visibleNodes = nodes.filter((node) => node.data.relationshipDepth <= relationshipDepth)
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = edges.filter((edge) => {
    const data = edge.data
    return (
      data !== undefined &&
      data.relationshipDepth <= relationshipDepth &&
      visibleNodeIds.has(edge.source) &&
      visibleNodeIds.has(edge.target)
    )
  })

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    ...countNodesByType(visibleNodes),
  }
}

export function buildFlowData(
  processes: ProcessInfo[],
  ports: PortInfo[],
  windows: WindowInfo[],
  searchQuery: string,
  maxDepth: number = PORT_RELATIONSHIP_DEPTH_MAX,
): FlowGraphData {
  const nodes: PortRelationshipNode[] = []
  const edges: PortRelationshipEdge[] = []

  const processMap = new Map<number, ProcessInfo>()
  for (const proc of processes) {
    processMap.set(proc.pid, proc)
  }

  // Determine which PIDs have ports or windows (to filter connected data)
  const pidsWithPorts = new Set<number>()
  for (const port of ports) {
    pidsWithPorts.add(port.pid)
  }

  const pidsWithWindows = new Set<number>()
  for (const win of windows) {
    pidsWithWindows.add(win.pid)
  }

  // Build connected PIDs: processes that have ports or windows
  const connectedPids = new Set<number>()
  for (const pid of pidsWithPorts) {
    if (processMap.has(pid)) connectedPids.add(pid)
  }
  for (const pid of pidsWithWindows) {
    if (processMap.has(pid)) connectedPids.add(pid)
  }

  const lowerQuery = searchQuery.trim().toLowerCase()

  // Filter function
  function matchesQuery(fields: string[]): boolean {
    if (!lowerQuery) return true
    return fields.some(f => f.toLowerCase().includes(lowerQuery))
  }

  // 1. Port nodes (left layer)
  const includedPortKeys = new Set<string>()
  const includedRemoteNodeIds = new Set<string>()
  for (const port of ports) {
    const portKey = `port-${port.port}-${port.pid}`
    if (!matchesQuery([
      String(port.port),
      port.processName,
      String(port.pid),
      port.state,
      port.protocol,
      port.foreignAddress,
    ])) continue

    includedPortKeys.add(portKey)

    const portData: FlowPortNodeData = {
      label: `:${port.port}`,
      port: port.port,
      protocol: port.protocol,
      state: port.state,
      pid: port.pid,
      processName: port.processName,
      localAddress: port.localAddress,
      foreignAddress: port.foreignAddress,
    }

    nodes.push({
      id: portKey,
      type: 'flowPort',
      position: { x: 0, y: 0 },
      data: {
        ...portData,
        relationshipDepth: 1,
        relationshipKind: 'owns',
      },
    })

    // Edge: port -> process
    if (processMap.has(port.pid)) {
      const edgeData: PortRelationshipEdgeData = {
        edgeType: 'port-binds-process',
        label: 'owns',
        relationshipKind: 'owns',
        relationshipDepth: 1,
        sourceKind: 'port',
        targetKind: 'process',
        port: port.port,
        pid: port.pid,
      }
      edges.push({
        id: `edge-${portKey}-process-${port.pid}`,
        source: portKey,
        target: `process-${port.pid}`,
        type: 'flowEdge',
        data: edgeData,
      })
    }

    if (isConcreteRemoteAddress(port.foreignAddress)) {
      const remoteNodeId = buildRemoteNodeId(port.foreignAddress)
      if (!includedRemoteNodeIds.has(remoteNodeId)) {
        includedRemoteNodeIds.add(remoteNodeId)
        const remoteData: FlowRemoteNodeData = {
          label: port.foreignAddress,
          remoteAddress: port.foreignAddress,
          protocol: port.protocol,
          state: port.state,
          port: port.port,
          pid: port.pid,
          processName: port.processName,
          relationshipKind: 'connects',
          relationshipDepth: 3,
        }
        nodes.push({
          id: remoteNodeId,
          type: 'flowRemote',
          position: { x: 0, y: 0 },
          data: remoteData,
        })
      }

      const edgeData: PortRelationshipEdgeData = {
        edgeType: 'port-external',
        label: 'connects',
        relationshipKind: 'connects',
        relationshipDepth: 3,
        sourceKind: 'port',
        targetKind: 'remote',
        port: port.port,
        pid: port.pid,
        remoteAddress: port.foreignAddress,
      }
      edges.push({
        id: `edge-${portKey}-${remoteNodeId}`,
        source: portKey,
        target: remoteNodeId,
        type: 'flowEdge',
        data: edgeData,
      })
    }
  }

  // 2. Process nodes (center layer) - only those connected to ports or windows
  const includedProcessPids = new Set<number>()
  for (const pid of connectedPids) {
    const proc = processMap.get(pid)
    if (!proc) continue

    if (lowerQuery && !matchesQuery([
      proc.name,
      String(proc.pid),
      proc.command ?? '',
      String(proc.port ?? ''),
    ])) {
      // If there's a search query, check if this process has any matching ports/windows
      const hasMatchingPort = ports.some(
        p => p.pid === pid && includedPortKeys.has(`port-${p.port}-${p.pid}`)
      )
      if (!hasMatchingPort && !matchesQuery([proc.name, String(proc.pid)])) continue
    }

    includedProcessPids.add(pid)

    const processData: FlowProcessNodeData = {
      label: proc.name,
      pid: proc.pid,
      cpu: proc.cpu,
      memory: proc.memory,
      type: proc.type,
      status: proc.status,
      command: proc.command,
    }

    nodes.push({
      id: `process-${proc.pid}`,
      type: 'flowProcess',
      position: { x: 0, y: 0 },
      data: {
        ...processData,
        relationshipDepth: 1,
        relationshipKind: 'owns',
      },
    })
  }

  // 3. Window nodes (right layer)
  for (const win of windows) {
    if (!includedProcessPids.has(win.pid)) continue

    if (lowerQuery && !matchesQuery([
      win.title,
      win.processName,
      String(win.pid),
      win.className,
    ])) continue

    const windowData: FlowWindowNodeData = {
      label: win.title || win.processName,
      title: win.title,
      processName: win.processName,
      pid: win.pid,
      hwnd: win.hwnd,
      isVisible: win.isVisible,
      isMinimized: win.isMinimized,
    }

    nodes.push({
      id: `window-${win.hwnd}`,
      type: 'flowWindow',
      position: { x: 0, y: 0 },
      data: {
        ...windowData,
        relationshipDepth: 2,
        relationshipKind: 'owns',
      },
    })

    // Edge: process -> window
    const edgeData: PortRelationshipEdgeData = {
      edgeType: 'process-owns-window',
      label: '拥有',
      relationshipKind: 'owns',
      relationshipDepth: 2,
      sourceKind: 'process',
      targetKind: 'window',
      pid: win.pid,
      hwnd: win.hwnd,
    }
    edges.push({
      id: `edge-process-${win.pid}-window-${win.hwnd}`,
      source: `process-${win.pid}`,
      target: `window-${win.hwnd}`,
      type: 'flowEdge',
      data: edgeData,
    })
  }

  // Remove edges pointing to non-existent nodes
  const nodeIds = new Set(nodes.map(n => n.id))
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
  const filteredData = filterFlowDataByDepth(nodes, validEdges, maxDepth)

  // Apply dagre layout
  if (filteredData.nodes.length > 0) {
    const layoutResult = applyDagreLayout(filteredData.nodes, filteredData.edges)
    return {
      nodes: layoutResult.nodes,
      edges: layoutResult.edges,
      portCount: filteredData.portCount,
      processCount: filteredData.processCount,
      windowCount: filteredData.windowCount,
      remoteCount: filteredData.remoteCount,
    }
  }

  return {
    nodes: [],
    edges: [],
    portCount: 0,
    processCount: 0,
    windowCount: 0,
    remoteCount: 0,
  }
}

// ============ Component ============

interface PortRelationshipGraphProps {
  /** Optional: Port number to focus/highlight */
  focusPort?: number | null
  /** Called when user clicks a node */
  onNodeClick?: (nodeData: { type: string; port?: number; pid?: number; hwnd?: number }) => void
}

const PortRelationshipGraphInner = memo(function PortRelationshipGraphInner({
  focusPort,
  onNodeClick,
}: PortRelationshipGraphProps) {
  const processes = useProcessStore((s) => s.processes)
  const ports = usePortStore((s) => s.ports)
  const windows = useWindowStore((s) => s.windows)

  const [searchQuery, setSearchQuery] = useState('')
  const [relationshipDepth, setRelationshipDepth] = useState<PortRelationshipDepth>(PORT_RELATIONSHIP_DEPTH_MAX)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[])
  const [stats, setStats] = useState({ portCount: 0, processCount: 0, windowCount: 0, remoteCount: 0 })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce data updates
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const result = buildFlowData(processes, ports, windows, searchQuery, relationshipDepth)
      setNodes(result.nodes)
      setEdges(result.edges)
      setStats({
        portCount: result.portCount,
        processCount: result.processCount,
        windowCount: result.windowCount,
        remoteCount: result.remoteCount,
      })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [processes, ports, windows, searchQuery, relationshipDepth, setNodes, setEdges])

  // Focus port: fit view to the relevant node
  useEffect(() => {
    if (focusPort === null || focusPort === undefined) return
    const portNode = nodes.find(
      n => n.type === 'flowPort' && getNumericNodeData(n, 'port') === focusPort
    )
    if (portNode) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === portNode.id,
        }))
      )
    }
  }, [focusPort, nodes, setNodes])

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!onNodeClick) return
      onNodeClick({
        type: node.type ?? 'unknown',
        port: getNumericNodeData(node, 'port'),
        pid: getNumericNodeData(node, 'pid'),
        hwnd: getNumericNodeData(node, 'hwnd'),
      })
    },
    [onNodeClick]
  )

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => onNodesChange(changes),
    [onNodesChange]
  )

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => onEdgesChange(changes),
    [onEdgesChange]
  )

  const isEmpty = nodes.length === 0

  return (
    <div
      className="h-full flex flex-col bg-surface-950"
      data-testid="port-relationship-graph-root"
      data-relationship-scope="all-monitored-ports"
      data-focus-port={focusPort ?? 'none'}
      data-relationship-depth={relationshipDepth}
      data-relationship-depth-range={`${PORT_RELATIONSHIP_DEPTH_MIN}-${PORT_RELATIONSHIP_DEPTH_MAX}`}
    >
      {/* Stats + Search Bar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-surface-900/50 border-b border-surface-700/30">
        <span
          className="text-xs font-bold text-text-secondary uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          流程图
        </span>

        <div className="flex items-center gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 radius-sm" style={{ backgroundColor: '#22c55e' }} />
            <span>端口: <span className="text-text-primary font-bold">{stats.portCount}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 radius-sm" style={{ backgroundColor: '#c9a227' }} />
            <span>进程: <span className="text-text-primary font-bold">{stats.processCount}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 radius-sm" style={{ backgroundColor: '#6b7d8a' }} />
            <span>窗口: <span className="text-text-primary font-bold">{stats.windowCount}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 radius-sm" style={{ backgroundColor: '#f59e0b' }} />
            <span>远端: <span className="text-text-primary font-bold">{stats.remoteCount}</span></span>
          </div>
        </div>

        <div className="flex-1" />

        <label className="flex items-center gap-2 text-xs text-text-muted">
          <span>深度</span>
          <input
            type="range"
            min={PORT_RELATIONSHIP_DEPTH_MIN}
            max={PORT_RELATIONSHIP_DEPTH_MAX}
            step={1}
            value={relationshipDepth}
            onChange={(event) => setRelationshipDepth(clampRelationshipDepth(Number(event.target.value)))}
            aria-label="关系视图节点深度"
            data-testid="port-relationship-depth-slider"
            className="w-24 accent-[var(--color-accent)]"
          />
          <span
            className="font-mono text-text-primary min-w-4 text-right"
            data-testid="port-relationship-depth-value"
          >
            {relationshipDepth}
          </span>
        </label>

        <div className="relative">
          <input
            type="text"
            placeholder="搜索 PID/端口/窗口标题..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-sm w-48 pl-8 text-xs"
          />
          <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Flow Chart Area */}
      <div className="flex-1 relative" style={{ minHeight: '300px' }}>
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div
              className="w-16 h-16 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-surface-600 radius-sm"
            >
              <NetworkIcon className="text-text-muted" size={32} />
            </div>
            <h3
              className="text-lg font-bold text-text-primary mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              暂无流程数据
            </h3>
            <p className="text-text-muted text-sm">
              {searchQuery
                ? '未找到匹配结果,请调整搜索条件'
                : '启动服务后可查看端口关系图'}
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            className="bg-surface-950"
          >
            <Controls
              showInteractive={false}
              className="!bg-surface-800 !border-surface-600 !shadow-none [&>button]:!bg-surface-700 [&>button]:!border-surface-600 [&>button]:!fill-text-muted [&>button:hover]:!bg-surface-600 radius-sm"
            />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'flowPort') return '#22c55e'
                if (node.type === 'flowProcess') return '#c9a227'
                if (node.type === 'flowWindow') return '#6b7d8a'
                return '#475569'
              }}
              maskColor="rgba(15, 23, 42, 0.7)"
              className="!bg-surface-900 !border-surface-600 radius-sm"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#1e293b"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
})

/**
 * Public wrapper — provides ReactFlow context so the component can be mounted
 * in any part of the tree (e.g., a tab content) without manual provider setup.
 */
export const PortRelationshipGraph = memo(function PortRelationshipGraph(
  props: PortRelationshipGraphProps
) {
  return (
    <ReactFlowProvider>
      <PortRelationshipGraphInner {...props} />
    </ReactFlowProvider>
  )
})
