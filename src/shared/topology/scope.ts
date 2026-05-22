import { z } from 'zod'
import type { Project } from '../types'
import type { PortInfo, ProcessInfo, WindowInfo } from '../types-extended'

export const topologyScopeKindSchema = z.enum(['project', 'process', 'port', 'window'])

export const topologyScopeSchema = z.object({
  kind: topologyScopeKindSchema,
  targetId: z.union([z.number().int().positive(), z.string().min(1)]),
  depth: z.number().int().min(1).max(4).default(2),
})

export type TopologyScopeKind = z.infer<typeof topologyScopeKindSchema>
export type TopologyScope = z.infer<typeof topologyScopeSchema>

export interface ScopedTopologySnapshot {
  projects?: Project[]
  processes: ProcessInfo[]
  ports: PortInfo[]
  windows: WindowInfo[]
}

export type ScopedTopologyNodeKind = 'project' | 'process' | 'port' | 'window'
export type ScopedTopologyEdgeKind =
  | 'project-owns-process'
  | 'process-binds-port'
  | 'process-owns-window'
  | 'port-owned-by-process'
  | 'window-owned-by-process'

export interface ScopedTopologyNode {
  id: string
  kind: ScopedTopologyNodeKind
  label: string
  depth: number
  root: boolean
  metadata: Record<string, string | number | boolean | null | undefined>
}

export interface ScopedTopologyEdge {
  id: string
  source: string
  target: string
  kind: ScopedTopologyEdgeKind
  weight: number
}

export interface ScopedTopologyGraph {
  scope: TopologyScope
  nodes: ScopedTopologyNode[]
  edges: ScopedTopologyEdge[]
  generatedAt: number
  source: 'cache' | 'scan' | 'renderer-store'
}

export interface ScopedFlowStep {
  id: string
  label: string
  kind: ScopedTopologyNodeKind
  depth: number
  nodeId: string
}

export interface ScopedFlowLink {
  id: string
  fromStepId: string
  toStepId: string
  kind: ScopedTopologyEdgeKind
}

export interface ScopedFlow {
  scope: TopologyScope
  steps: ScopedFlowStep[]
  links: ScopedFlowLink[]
  generatedAt: number
  source: ScopedTopologyGraph['source']
}

function processNodeId(pid: number): string {
  return `process-${pid}`
}

function projectNodeId(projectId: string): string {
  return `project-${projectId}`
}

function portNodeId(port: PortInfo): string {
  return `port-${port.port}-${port.pid}-${port.protocol}`
}

function windowNodeId(hwnd: number): string {
  return `window-${hwnd}`
}

function addNode(nodes: Map<string, ScopedTopologyNode>, node: ScopedTopologyNode): void {
  const existing = nodes.get(node.id)
  if (!existing || node.depth < existing.depth || node.root) {
    nodes.set(node.id, node)
  }
}

function addEdge(edges: Map<string, ScopedTopologyEdge>, edge: ScopedTopologyEdge): void {
  edges.set(edge.id, edge)
}

function normalizePath(value: string | undefined): string {
  return (value ?? '').replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase()
}

function processBelongsToProject(process: ProcessInfo, project: Project): boolean {
  if (process.projectId === project.id) return true
  if (project.pid !== undefined && process.pid === project.pid) return true

  const processPath = normalizePath(process.workingDir)
  const projectPath = normalizePath(project.path)
  return Boolean(processPath && projectPath && (processPath === projectPath || processPath.startsWith(`${projectPath}/`)))
}

function findOwningProject(process: ProcessInfo, projects: readonly Project[] = []): Project | undefined {
  return projects.find(project => processBelongsToProject(process, project))
}

function toProjectNode(project: Project, depth: number, root = false): ScopedTopologyNode {
  return {
    id: projectNodeId(project.id),
    kind: 'project',
    label: project.name || project.path || project.id,
    depth,
    root,
    metadata: {
      projectId: project.id,
      projectName: project.name,
      path: project.path,
      projectType: project.projectType,
      status: project.status,
      pid: project.pid,
      port: project.port,
    },
  }
}

function toProcessNode(process: ProcessInfo, depth: number, root = false): ScopedTopologyNode {
  return {
    id: processNodeId(process.pid),
    kind: 'process',
    label: process.name || `PID ${process.pid}`,
    depth,
    root,
    metadata: {
      pid: process.pid,
      command: process.command,
      cpu: process.cpu,
      memory: process.memory,
      status: process.status,
      type: process.type,
      projectId: process.projectId,
      workingDir: process.workingDir,
    },
  }
}

function toPortNode(port: PortInfo, depth: number, root = false): ScopedTopologyNode {
  return {
    id: portNodeId(port),
    kind: 'port',
    label: `:${port.port}`,
    depth,
    root,
    metadata: {
      port: port.port,
      pid: port.pid,
      protocol: port.protocol,
      state: port.state,
      processName: port.processName,
      localAddress: port.localAddress,
      foreignAddress: port.foreignAddress,
    },
  }
}

function toWindowNode(windowInfo: WindowInfo, depth: number, root = false): ScopedTopologyNode {
  return {
    id: windowNodeId(windowInfo.hwnd),
    kind: 'window',
    label: windowInfo.title || windowInfo.processName || `HWND ${windowInfo.hwnd}`,
    depth,
    root,
    metadata: {
      hwnd: windowInfo.hwnd,
      pid: windowInfo.pid,
      processName: windowInfo.processName,
      className: windowInfo.className,
      isVisible: windowInfo.isVisible,
      isMinimized: windowInfo.isMinimized,
      isSystemWindow: windowInfo.isSystemWindow,
    },
  }
}

function addProcessNeighborhood(
  nodes: Map<string, ScopedTopologyNode>,
  edges: Map<string, ScopedTopologyEdge>,
  process: ProcessInfo,
  snapshot: ScopedTopologySnapshot,
  depth: number,
  root = false
): void {
  addNode(nodes, toProcessNode(process, depth, root))
  const project = findOwningProject(process, snapshot.projects)
  if (project) {
    addNode(nodes, toProjectNode(project, depth + 1))
    addEdge(edges, {
      id: `edge-${projectNodeId(project.id)}-${processNodeId(process.pid)}`,
      source: projectNodeId(project.id),
      target: processNodeId(process.pid),
      kind: 'project-owns-process',
      weight: process.projectId === project.id ? 0.95 : 0.7,
    })
  }
  if (depth >= 2) return

  for (const port of snapshot.ports.filter(candidate => candidate.pid === process.pid)) {
    addNode(nodes, toPortNode(port, depth + 1))
    addEdge(edges, {
      id: `edge-${processNodeId(process.pid)}-${portNodeId(port)}`,
      source: processNodeId(process.pid),
      target: portNodeId(port),
      kind: 'process-binds-port',
      weight: port.state === 'LISTENING' ? 0.9 : 0.55,
    })
  }

  for (const windowInfo of snapshot.windows.filter(candidate => candidate.pid === process.pid)) {
    addNode(nodes, toWindowNode(windowInfo, depth + 1))
    addEdge(edges, {
      id: `edge-${processNodeId(process.pid)}-${windowNodeId(windowInfo.hwnd)}`,
      source: processNodeId(process.pid),
      target: windowNodeId(windowInfo.hwnd),
      kind: 'process-owns-window',
      weight: windowInfo.isVisible ? 0.8 : 0.45,
    })
  }
}

export function buildScopedTopologyGraph(
  scopeInput: TopologyScope,
  snapshotInput: ScopedTopologySnapshot,
  source: ScopedTopologyGraph['source'] = 'cache'
): ScopedTopologyGraph {
  const scope = topologyScopeSchema.parse(scopeInput)
  const snapshot = snapshotInput
  const nodes = new Map<string, ScopedTopologyNode>()
  const edges = new Map<string, ScopedTopologyEdge>()

  if (scope.kind === 'project') {
    const targetId = String(scope.targetId)
    const project = snapshot.projects?.find(candidate => candidate.id === targetId)
    if (project) {
      addNode(nodes, toProjectNode(project, 0, true))
      for (const process of snapshot.processes.filter(candidate => processBelongsToProject(candidate, project))) {
        addNode(nodes, toProcessNode(process, 1))
        addEdge(edges, {
          id: `edge-${projectNodeId(project.id)}-${processNodeId(process.pid)}`,
          source: projectNodeId(project.id),
          target: processNodeId(process.pid),
          kind: 'project-owns-process',
          weight: process.projectId === project.id ? 0.95 : 0.7,
        })
        if (scope.depth >= 2) addProcessNeighborhood(nodes, edges, process, snapshot, 1)
      }
    }
  }

  if (scope.kind === 'process') {
    const process = snapshot.processes.find(candidate => candidate.pid === Number(scope.targetId))
    if (process) addProcessNeighborhood(nodes, edges, process, snapshot, 0, true)
  }

  if (scope.kind === 'port') {
    const ports = snapshot.ports.filter(candidate => candidate.port === Number(scope.targetId))
    const rootPort = ports.find(candidate => candidate.state === 'LISTENING') ?? ports[0]
    if (rootPort) {
      addNode(nodes, toPortNode(rootPort, 0, true))
      const owner = snapshot.processes.find(candidate => candidate.pid === rootPort.pid)
      if (owner) {
        addNode(nodes, toProcessNode(owner, 1))
        addEdge(edges, {
          id: `edge-${portNodeId(rootPort)}-${processNodeId(owner.pid)}`,
          source: portNodeId(rootPort),
          target: processNodeId(owner.pid),
          kind: 'port-owned-by-process',
          weight: 0.9,
        })
        if (scope.depth >= 2) addProcessNeighborhood(nodes, edges, owner, snapshot, 1)
      }
      for (const extraPort of ports.filter(candidate => candidate !== rootPort)) {
        addNode(nodes, toPortNode(extraPort, 1))
      }
    }
  }

  if (scope.kind === 'window') {
    const windowInfo = snapshot.windows.find(candidate => candidate.hwnd === Number(scope.targetId))
    if (windowInfo) {
      addNode(nodes, toWindowNode(windowInfo, 0, true))
      const owner = snapshot.processes.find(candidate => candidate.pid === windowInfo.pid)
      if (owner) {
        addNode(nodes, toProcessNode(owner, 1))
        addEdge(edges, {
          id: `edge-${windowNodeId(windowInfo.hwnd)}-${processNodeId(owner.pid)}`,
          source: windowNodeId(windowInfo.hwnd),
          target: processNodeId(owner.pid),
          kind: 'window-owned-by-process',
          weight: 0.9,
        })
        if (scope.depth >= 2) addProcessNeighborhood(nodes, edges, owner, snapshot, 1)
      }
    }
  }

  return {
    scope,
    nodes: Array.from(nodes.values()).sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id)),
    edges: Array.from(edges.values()).sort((a, b) => a.id.localeCompare(b.id)),
    generatedAt: Date.now(),
    source,
  }
}

export function buildScopedFlow(graph: ScopedTopologyGraph): ScopedFlow {
  const steps = graph.nodes.map((node): ScopedFlowStep => ({
    id: `step-${node.id}`,
    label: node.label,
    kind: node.kind,
    depth: node.depth,
    nodeId: node.id,
  }))
  const stepIds = new Set(steps.map(step => step.id))

  return {
    scope: graph.scope,
    steps,
    links: graph.edges
      .map((edge): ScopedFlowLink => ({
        id: `flow-${edge.id}`,
        fromStepId: `step-${edge.source}`,
        toStepId: `step-${edge.target}`,
        kind: edge.kind,
      }))
      .filter(link => stepIds.has(link.fromStepId) && stepIds.has(link.toStepId)),
    generatedAt: graph.generatedAt,
    source: graph.source,
  }
}
