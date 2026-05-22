import { graphKindSchema, type GraphKind } from '@shared/schemas/r8-runtime'

export const SELECTED_GLOBAL_TOPOLOGY_NODE_KEY = 'devhub:topology:global:selected-node'
export const GLOBAL_TOPOLOGY_GRAPH_KIND_KEY = 'devhub:topology:global:graph-kind'
export const OPEN_GLOBAL_TOPOLOGY_EVENT = 'devhub:open-topology-global'

interface PortTopologyNodeRef {
  port: number
  pid: number
  protocol: string
}

export function toProcessTopologyNodeId(pid: number): string {
  return `process-${pid}`
}

export function toPortTopologyNodeId(port: PortTopologyNodeRef): string {
  return `port-${port.port}-${port.pid}-${port.protocol}`
}

export function toWindowTopologyNodeId(hwnd: number): string {
  return `window-${hwnd}`
}

export function toProjectTopologyNodeId(projectId: string): string {
  return `project-${projectId}`
}

export function parseGlobalTopologyGraphKind(value: unknown): GraphKind | null {
  const parsed = graphKindSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function readPendingGlobalTopologyGraphKind(): GraphKind | null {
  if (typeof window === 'undefined') return null
  const storedGraphKind = window.sessionStorage.getItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY)
  if (storedGraphKind !== null) window.sessionStorage.removeItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY)
  return parseGlobalTopologyGraphKind(storedGraphKind)
}

export function readPendingGlobalTopologyNodeId(): string | null {
  if (typeof window === 'undefined') return null
  const storedNodeId = window.sessionStorage.getItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY)
  if (storedNodeId) window.sessionStorage.removeItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY)
  return storedNodeId || null
}

export function openGlobalTopologyKind(graphKind: GraphKind): void {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY, graphKind)
  window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_TOPOLOGY_EVENT, { detail: { graphKind } }))
}

export function openGlobalTopologyNode(nodeId: string): void {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY, nodeId)
  window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_TOPOLOGY_EVENT))
}

export function openProcessInGlobalTopology(pid: number): void {
  openGlobalTopologyNode(toProcessTopologyNodeId(pid))
}

export function openPortInGlobalTopology(port: PortTopologyNodeRef): void {
  openGlobalTopologyNode(toPortTopologyNodeId(port))
}

export function openWindowInGlobalTopology(hwnd: number): void {
  openGlobalTopologyNode(toWindowTopologyNodeId(hwnd))
}

export function openProjectInGlobalTopology(projectId: string): void {
  openGlobalTopologyNode(toProjectTopologyNodeId(projectId))
}
