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
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
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
import { SearchIcon } from '../icons'

import type { ProcessInfo, PortInfo, WindowInfo } from '@shared/types-extended'

// ============ Node/Edge Types Registration ============

const nodeTypes: NodeTypes = {
  flowPort: FlowPortNode,
  flowProcess: FlowProcessNode,
  flowWindow: FlowWindowNode,
}

const edgeTypes: EdgeTypes = {
  flowEdge: FlowEdge,
}

// ============ Dagre Layout ============

const DAGRE_NODE_WIDTH = 180
const DAGRE_NODE_HEIGHT = 80

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
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
  nodes: Node[]
  edges: Edge[]
  portCount: number
  processCount: number
  windowCount: number
}

function buildFlowData(
  processes: ProcessInfo[],
  ports: PortInfo[],
  windows: WindowInfo[],
  searchQuery: string,
): FlowGraphData {
  const nodes: Node[] = []
  const edges: Edge[] = []

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
  let portCount = 0
  const includedPortKeys = new Set<string>()
  for (const port of ports) {
    const portKey = `port-${port.port}-${port.pid}`
    if (!matchesQuery([
      String(port.port),
      port.processName,
      String(port.pid),
      port.state,
      port.protocol,
    ])) continue

    includedPortKeys.add(portKey)
    portCount++

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
      data: portData,
    })

    // Edge: port -> process
    if (processMap.has(port.pid)) {
      const edgeData: FlowEdgeData = {
        edgeType: 'port-binds-process',
        label: '绑定',
      }
      edges.push({
        id: `edge-${portKey}-process-${port.pid}`,
        source: portKey,
        target: `process-${port.pid}`,
        type: 'flowEdge',
        data: edgeData,
      })
    }
  }

  // 2. Process nodes (center layer) - only those connected to ports or windows
  let processCount = 0
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
    processCount++

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
      data: processData,
    })
  }

  // 3. Window nodes (right layer)
  let windowCount = 0
  for (const win of windows) {
    if (!includedProcessPids.has(win.pid)) continue

    if (lowerQuery && !matchesQuery([
      win.title,
      win.processName,
      String(win.pid),
      win.className,
    ])) continue

    windowCount++

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
      data: windowData,
    })

    // Edge: process -> window
    const edgeData: FlowEdgeData = {
      edgeType: 'process-owns-window',
      label: '拥有',
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

  // Apply dagre layout
  if (nodes.length > 0) {
    const layoutResult = applyDagreLayout(nodes, validEdges)
    return {
      nodes: layoutResult.nodes,
      edges: layoutResult.edges,
      portCount,
      processCount,
      windowCount,
    }
  }

  return { nodes: [], edges: [], portCount, processCount, windowCount }
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[])
  const [stats, setStats] = useState({ portCount: 0, processCount: 0, windowCount: 0 })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce data updates
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const result = buildFlowData(processes, ports, windows, searchQuery)
      setNodes(result.nodes)
      setEdges(result.edges)
      setStats({
        portCount: result.portCount,
        processCount: result.processCount,
        windowCount: result.windowCount,
      })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [processes, ports, windows, searchQuery, setNodes, setEdges])

  // Focus port: fit view to the relevant node
  useEffect(() => {
    if (focusPort === null || focusPort === undefined) return
    const portNode = nodes.find(
      n => n.type === 'flowPort' && (n.data as FlowPortNodeData).port === focusPort
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
      const data = node.data as Record<string, unknown>
      onNodeClick({
        type: node.type ?? 'unknown',
        port: data.port as number | undefined,
        pid: data.pid as number | undefined,
        hwnd: data.hwnd as number | undefined,
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
    <div className="h-full flex flex-col bg-surface-950">
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
        </div>

        <div className="flex-1" />

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
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="square" strokeLinejoin="miter" className="text-text-muted">
                <rect x="2" y="2" width="6" height="6" />
                <rect x="16" y="2" width="6" height="6" />
                <rect x="9" y="16" width="6" height="6" />
                <path d="M8 5h8M5 8v5l4 3M19 8v5l-4 3" />
              </svg>
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
