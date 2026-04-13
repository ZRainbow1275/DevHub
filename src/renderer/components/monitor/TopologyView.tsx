/**
 * TopologyView — Process/Port/Window neural relationship graph.
 *
 * Replaces the previous dagre + ReactFlow implementation with a d3-force
 * powered NeuralGraph that shows live, animated relationships.
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { useProcessStore } from '../../stores/processStore'
import { usePortStore } from '../../stores/portStore'
import { useWindowStore } from '../../stores/windowStore'
import { NeuralGraphWithControls } from './topology/NeuralGraph'
import { TopologyDetailPanel } from './topology/TopologyDetailPanel'
import type { GraphNode, GraphEdge } from './topology/NeuralGraphEngine'
import type { ProcessInfo, PortInfo, WindowInfo } from '@shared/types-extended'

// ============ Data Transform ============

function clampResource(cpu: number, memMB: number): number {
  return Math.sqrt(cpu * 2 + memMB / 50) * 5
}

interface SelectedNodeInfo {
  nodeType: 'project' | 'process' | 'port' | 'window'
  processInfo?: ProcessInfo
  portInfo?: PortInfo
  windowInfo?: WindowInfo
  projectId?: string
  projectName?: string
}

/**
 * Build NeuralGraph nodes and edges from process/port/window data.
 */
function buildGraphData(
  processes: ProcessInfo[],
  ports: PortInfo[],
  windows: WindowInfo[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const processMap = new Map<number, ProcessInfo>()

  for (const proc of processes) {
    processMap.set(proc.pid, proc)
  }

  // 1. Project nodes
  const projectIds = new Set<string>()
  for (const proc of processes) {
    if (proc.projectId) projectIds.add(proc.projectId)
  }
  for (const pid of projectIds) {
    nodes.push({
      id: `project-${pid}`,
      label: pid,
      nodeType: 'project',
      resourceWeight: 10,
      depth: 0,
      metadata: { projectId: pid, projectName: pid }
    })
  }

  // 2. Process nodes
  for (const proc of processes) {
    nodes.push({
      id: `process-${proc.pid}`,
      label: proc.name,
      nodeType: 'process',
      resourceWeight: clampResource(proc.cpu, proc.memory),
      depth: 1,
      cpu: proc.cpu,
      metadata: {
        pid: proc.pid,
        processType: proc.type,
        memory: proc.memory,
        status: proc.status,
        command: proc.command,
        workingDir: proc.workingDir,
        startTime: proc.startTime,
        port: proc.port,
        projectId: proc.projectId
      }
    })

    // Edge: project -> process
    if (proc.projectId) {
      edges.push({
        id: `edge-project-${proc.projectId}-process-${proc.pid}`,
        source: `project-${proc.projectId}`,
        target: `process-${proc.pid}`,
        edgeType: 'project-owns-process',
        weight: 0.8
      })
    }
  }

  // 3. Port nodes + edges
  for (const port of ports) {
    nodes.push({
      id: `port-${port.port}-${port.pid}`,
      label: `:${port.port}`,
      nodeType: port.state === 'LISTENING' ? 'port-listening'
        : port.state === 'ESTABLISHED' ? 'port-established'
        : port.state === 'TIME_WAIT' ? 'port-timewait'
        : 'port',
      resourceWeight: 3,
      depth: 2,
      metadata: {
        port: port.port,
        pid: port.pid,
        processName: port.processName,
        state: port.state,
        protocol: port.protocol,
        localAddress: port.localAddress,
        foreignAddress: port.foreignAddress
      }
    })

    if (processMap.has(port.pid)) {
      edges.push({
        id: `edge-process-${port.pid}-port-${port.port}`,
        source: `process-${port.pid}`,
        target: `port-${port.port}-${port.pid}`,
        edgeType: 'process-binds-port',
        weight: 0.6
      })
    }

    // External connection node for ESTABLISHED
    if (
      port.state === 'ESTABLISHED' &&
      port.foreignAddress &&
      port.foreignAddress !== '*:*' &&
      port.foreignAddress !== '0.0.0.0:0'
    ) {
      const extId = `external-${port.foreignAddress.replace(/[:.]/g, '-')}`
      if (!nodes.find(n => n.id === extId)) {
        nodes.push({
          id: extId,
          label: port.foreignAddress,
          nodeType: 'external',
          resourceWeight: 2,
          depth: 3,
          metadata: { address: port.foreignAddress }
        })
      }
      edges.push({
        id: `edge-port-${port.port}-${port.pid}-ext-${port.foreignAddress.replace(/[:.]/g, '-')}`,
        source: `port-${port.port}-${port.pid}`,
        target: extId,
        edgeType: 'port-connected',
        weight: 0.4
      })
    }
  }

  // 4. Window nodes + edges
  for (const win of windows) {
    nodes.push({
      id: `window-${win.hwnd}`,
      label: win.title || win.processName,
      nodeType: 'window',
      resourceWeight: 2,
      depth: 2,
      metadata: {
        hwnd: win.hwnd,
        title: win.title,
        processName: win.processName,
        pid: win.pid,
        className: win.className
      }
    })

    if (processMap.has(win.pid)) {
      edges.push({
        id: `edge-process-${win.pid}-window-${win.hwnd}`,
        source: `process-${win.pid}`,
        target: `window-${win.hwnd}`,
        edgeType: 'process-owns-window',
        weight: 0.4
      })
    }
  }

  return { nodes, edges }
}

// ============ Component ============

export function TopologyView() {
  const processes = useProcessStore((s) => s.processes)
  const processesLastScan = useProcessStore((s) => s.lastScanTime)
  const ports = usePortStore((s) => s.ports)
  const portsLastScan = usePortStore((s) => s.lastScanTime)
  const windows = useWindowStore((s) => s.windows)

  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null)

  // Initial sync detection — all three stores have never reported a scan
  const hasInitialSync = processesLastScan !== null || portsLastScan !== null

  // Debounce data to avoid thrashing
  const [stableData, setStableData] = useState({ processes: [] as ProcessInfo[], ports: [] as PortInfo[], windows: [] as WindowInfo[] })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setStableData({ processes, ports, windows })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [processes, ports, windows])

  // Build graph data
  const { nodes, edges } = useMemo(
    () => buildGraphData(stableData.processes, stableData.ports, stableData.windows),
    [stableData]
  )

  // Stats
  const stats = useMemo(() => {
    const projectIds = new Set<string>()
    for (const p of stableData.processes) {
      if (p.projectId) projectIds.add(p.projectId)
    }
    return [
      { label: '进程', value: stableData.processes.length, color: '#c9a227' },
      { label: '端口', value: stableData.ports.length, color: '#22c55e' },
      { label: '窗口', value: stableData.windows.length, color: '#6b7d8a' },
      { label: '项目', value: projectIds.size, color: '#d64545' }
    ]
  }, [stableData])

  const handleNodeClick = useCallback((node: GraphNode) => {
    const meta = node.metadata ?? {}
    if (node.nodeType === 'process' || node.nodeType === 'port' || node.nodeType.startsWith('port-')) {
      // Map to SelectedNodeInfo
      if (node.nodeType === 'process') {
        const proc = stableData.processes.find(p => p.pid === meta.pid)
        if (proc) {
          setSelectedNode({ nodeType: 'process', processInfo: proc })
          return
        }
      } else if (node.nodeType.startsWith('port')) {
        const port = stableData.ports.find(p => p.port === meta.port && p.pid === meta.pid)
        if (port) {
          setSelectedNode({ nodeType: 'port', portInfo: port })
          return
        }
      }
    }
    if (node.nodeType === 'window') {
      const win = stableData.windows.find(w => w.hwnd === meta.hwnd)
      if (win) {
        setSelectedNode({ nodeType: 'window', windowInfo: win })
        return
      }
    }
    if (node.nodeType === 'project') {
      setSelectedNode({
        nodeType: 'project',
        projectId: meta.projectId as string,
        projectName: meta.projectName as string
      })
      return
    }
    setSelectedNode(null)
  }, [stableData])

  const isLoading = !hasInitialSync && nodes.length === 0
  const emptyMessage = isLoading ? '加载中...' : '暂无拓扑数据'

  return (
    <div className="h-full relative" style={{ minHeight: '400px' }}>
      <NeuralGraphWithControls
        title="系统拓扑"
        nodes={nodes}
        edges={edges}
        stats={stats}
        onNodeClick={handleNodeClick}
        emptyMessage={emptyMessage}
      />

      {/* Detail Panel (reuse existing) */}
      {selectedNode && (
        <TopologyDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  )
}
