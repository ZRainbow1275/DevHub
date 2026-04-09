import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useProcessStore } from '../stores/processStore'
import { usePortStore } from '../stores/portStore'
import { useWindowStore } from '../stores/windowStore'
import type { Node, Edge } from '@xyflow/react'
import type {
  ProcessTopologyNodeData,
  ProcessTopologyEdgeData,
  ProcessInfo,
  PortInfo,
  WindowInfo
} from '@shared/types-extended'

export type TopologyGraphNode = Node<ProcessTopologyNodeData>
export type TopologyGraphEdge = Edge<ProcessTopologyEdgeData>

interface SelectedNodeInfo {
  nodeType: 'project' | 'process' | 'port' | 'window'
  processInfo?: ProcessInfo
  portInfo?: PortInfo
  windowInfo?: WindowInfo
  projectId?: string
  projectName?: string
}

interface ProcessTopologyResult {
  nodes: TopologyGraphNode[]
  edges: TopologyGraphEdge[]
  stats: {
    processCount: number
    portCount: number
    windowCount: number
    projectCount: number
  }
  selectedNode: SelectedNodeInfo | null
  selectNode: (nodeId: string | null) => void
  highlightedNodeIds: Set<string>
  highlightedEdgeIds: Set<string>
  setHoveredNodeId: (nodeId: string | null) => void
}

/**
 * Aggregate hook that joins processStore, portStore, and windowStore
 * to produce a unified topology graph data structure for @xyflow/react.
 *
 * Uses pid as the join key across all three stores.
 * Debounces updates with a 300ms window to avoid layout thrashing.
 */
export function useProcessTopology(): ProcessTopologyResult {
  const processes = useProcessStore((s) => s.processes)
  const ports = usePortStore((s) => s.ports)
  const windows = useWindowStore((s) => s.windows)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // Debounce: track stable snapshots to avoid relayout on every micro-update
  const [stableData, setStableData] = useState<{
    processes: ProcessInfo[]
    ports: PortInfo[]
    windows: WindowInfo[]
  }>({ processes: [], ports: [], windows: [] })

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      setStableData({ processes, ports, windows })
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [processes, ports, windows])

  // Build nodes and edges from stable data
  const { nodes, edges } = useMemo(() => {
    const nodeList: TopologyGraphNode[] = []
    const edgeList: TopologyGraphEdge[] = []

    // Process map for O(1) pid lookup when building port/window edges
    const pMap = new Map<number, ProcessInfo>()

    // Build process map
    for (const proc of stableData.processes) {
      pMap.set(proc.pid, proc)
    }

    // Collect unique project IDs
    const projectIds = new Set<string>()
    for (const proc of stableData.processes) {
      if (proc.projectId) {
        projectIds.add(proc.projectId)
      }
    }

    // Create project nodes
    for (const projectId of projectIds) {
      nodeList.push({
        id: `project-${projectId}`,
        type: 'projectNode',
        position: { x: 0, y: 0 },
        data: {
          label: projectId,
          nodeType: 'project',
          projectId,
          projectName: projectId
        }
      })
    }

    // Create process nodes
    for (const proc of stableData.processes) {
      nodeList.push({
        id: `process-${proc.pid}`,
        type: 'processNode',
        position: { x: 0, y: 0 },
        data: {
          label: proc.name,
          nodeType: 'process',
          pid: proc.pid,
          processInfo: proc,
          projectId: proc.projectId
        }
      })

      // Edge: project -> process
      if (proc.projectId) {
        edgeList.push({
          id: `edge-project-${proc.projectId}-process-${proc.pid}`,
          source: `project-${proc.projectId}`,
          target: `process-${proc.pid}`,
          type: 'topologyEdge',
          data: {
            edgeType: 'project-owns-process'
          }
        })
      }
    }

    // Create port nodes and edges
    for (const port of stableData.ports) {
      nodeList.push({
        id: `port-${port.port}`,
        type: 'portNode',
        position: { x: 0, y: 0 },
        data: {
          label: `:${port.port}`,
          nodeType: 'port',
          portInfo: port,
          pid: port.pid
        }
      })

      // Edge: process -> port (if the process exists in our data)
      if (pMap.has(port.pid)) {
        edgeList.push({
          id: `edge-process-${port.pid}-port-${port.port}`,
          source: `process-${port.pid}`,
          target: `port-${port.port}`,
          type: 'topologyEdge',
          data: {
            edgeType: 'process-binds-port'
          }
        })
      }
    }

    // Create window nodes and edges
    for (const win of stableData.windows) {
      nodeList.push({
        id: `window-${win.hwnd}`,
        type: 'windowNode',
        position: { x: 0, y: 0 },
        data: {
          label: win.title || win.processName,
          nodeType: 'window',
          windowInfo: win,
          pid: win.pid
        }
      })

      // Edge: process -> window (if the process exists in our data)
      if (pMap.has(win.pid)) {
        edgeList.push({
          id: `edge-process-${win.pid}-window-${win.hwnd}`,
          source: `process-${win.pid}`,
          target: `window-${win.hwnd}`,
          type: 'topologyEdge',
          data: {
            edgeType: 'process-owns-window'
          }
        })
      }
    }

    return {
      nodes: nodeList,
      edges: edgeList
    }
  }, [stableData])

  // Stats
  const stats = useMemo(() => {
    const projectIds = new Set<string>()
    for (const proc of stableData.processes) {
      if (proc.projectId) projectIds.add(proc.projectId)
    }
    return {
      processCount: stableData.processes.length,
      portCount: stableData.ports.length,
      windowCount: stableData.windows.length,
      projectCount: projectIds.size
    }
  }, [stableData])

  // Selected node info
  const selectedNode = useMemo((): SelectedNodeInfo | null => {
    if (!selectedNodeId) return null

    const node = nodes.find((n) => n.id === selectedNodeId)
    if (!node) return null

    const data = node.data
    return {
      nodeType: data.nodeType,
      processInfo: data.processInfo,
      portInfo: data.portInfo,
      windowInfo: data.windowInfo,
      projectId: data.projectId,
      projectName: data.projectName
    }
  }, [selectedNodeId, nodes])

  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId)
  }, [])

  // Highlighted nodes/edges (neighbors of hovered node)
  const { highlightedNodeIds, highlightedEdgeIds } = useMemo(() => {
    const nodeIds = new Set<string>()
    const edgeIds = new Set<string>()

    if (!hoveredNodeId) return { highlightedNodeIds: nodeIds, highlightedEdgeIds: edgeIds }

    nodeIds.add(hoveredNodeId)

    for (const edge of edges) {
      if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
        edgeIds.add(edge.id)
        nodeIds.add(edge.source)
        nodeIds.add(edge.target)
      }
    }

    return { highlightedNodeIds: nodeIds, highlightedEdgeIds: edgeIds }
  }, [hoveredNodeId, edges])

  return {
    nodes,
    edges,
    stats,
    selectedNode,
    selectNode,
    highlightedNodeIds,
    highlightedEdgeIds,
    setHoveredNodeId
  }
}
