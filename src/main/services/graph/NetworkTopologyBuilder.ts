import type { Project } from '@shared/types'
import type { PortInfo, ProcessInfo, WindowInfo } from '@shared/types-extended'
import type { GraphEdge, GraphKind, GraphNode, GraphSlice } from '@shared/schemas/graph'

export interface NetworkTopologySourceData {
  ports: PortInfo[]
  processes: ProcessInfo[]
  projects: Project[]
  windows: WindowInfo[]
}

export interface NetworkTopologyBuildResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  warnings: Array<{ code: string; message: string }>
}

export class NetworkTopologyBuilder {
  build(data: NetworkTopologySourceData, slice: GraphSlice): NetworkTopologyBuildResult {
    const nodes = new Map<string, GraphNode>()
    const edges = new Map<string, GraphEdge>()
    for (const project of data.projects) nodes.set(projectNodeId(project.id), graphNode('project', projectNodeId(project.id), project.name || project.path || project.id, { path: project.path, projectId: project.id }))
    for (const processInfo of data.processes) {
      nodes.set(processNodeId(processInfo.pid), graphNode('process', processNodeId(processInfo.pid), processInfo.name || `PID ${processInfo.pid}`, {
        command: processInfo.command,
        cpu: processInfo.cpu,
        handleCount: readNumber(processInfo, 'handleCount'),
        memory: processInfo.memory,
        pid: processInfo.pid,
        projectId: processInfo.projectId,
        source: 'process-scanner',
        status: processInfo.status,
        type: processInfo.type,
        workingDir: processInfo.workingDir
      }))
      if (processInfo.projectId) {
        nodes.set(projectNodeId(processInfo.projectId), nodes.get(projectNodeId(processInfo.projectId)) ?? graphNode('project', projectNodeId(processInfo.projectId), processInfo.projectId, { projectId: processInfo.projectId }))
        setEdge(edges, slice.graphKind, 'owns', projectNodeId(processInfo.projectId), processNodeId(processInfo.pid), 0.9)
      }
      const parentPid = readNumber(processInfo, 'ppid')
      if (parentPid && parentPid > 0) setEdge(edges, slice.graphKind, 'parent-of', processNodeId(parentPid), processNodeId(processInfo.pid), 0.65)
    }
    for (const port of data.ports) {
      const id = portNodeId(port)
      nodes.set(id, graphNode('port', id, `:${port.port}`, {
        foreignAddress: port.foreignAddress,
        localAddress: port.localAddress,
        pid: port.pid,
        port: port.port,
        processName: port.processName,
        protocol: port.protocol,
        source: port.source ?? 'scanner-cache',
        state: port.state
      }))
      setEdge(edges, slice.graphKind, port.state === 'LISTENING' ? 'listens' : 'connects', processNodeId(port.pid), id, port.state === 'LISTENING' ? 0.95 : 0.7)
    }
    for (const windowInfo of data.windows) {
      const id = windowNodeId(windowInfo.hwnd)
      nodes.set(id, graphNode('window', id, windowInfo.title || windowInfo.processName || `HWND ${windowInfo.hwnd}`, {
        className: windowInfo.className,
        hwnd: windowInfo.hwnd,
        isMinimized: windowInfo.isMinimized,
        isVisible: windowInfo.isVisible,
        pid: windowInfo.pid,
        processName: windowInfo.processName,
        source: 'window-scanner'
      }))
      setEdge(edges, slice.graphKind, 'owns', processNodeId(windowInfo.pid), id, windowInfo.isVisible ? 0.85 : 0.5)
    }
    return finalizeBuild(nodes, edges)
  }
}

function finalizeBuild(nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>): NetworkTopologyBuildResult {
  const nodeList = [...nodes.values()]
  const nodeIds = new Set(nodeList.map(node => node.id))
  return { nodes: nodeList, edges: [...edges.values()].filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)), warnings: [] }
}

function graphNode(kind: GraphNode['kind'], id: string, label: string, meta: Record<string, unknown>): GraphNode {
  return { id, kind, label, meta }
}

function setEdge(edges: Map<string, GraphEdge>, kind: GraphKind, type: GraphEdge['type'], source: string, target: string, inferenceConfidence?: number): void {
  if (source === target) return
  const id = `edge-${source}-${target}-${type}`
  edges.set(id, { id, kind, source, target, type, inferenceConfidence })
}

function processNodeId(pid: number): string { return `process-${pid}` }
function projectNodeId(id: string): string { return `project-${id}` }
function portNodeId(port: PortInfo): string { return `port-${port.port}-${port.pid}-${port.protocol}` }
function windowNodeId(hwnd: number): string { return `window-${hwnd}` }

function readNumber(value: unknown, key: string): number | null {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined
  const next = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  return Number.isFinite(next) ? next : null
}
