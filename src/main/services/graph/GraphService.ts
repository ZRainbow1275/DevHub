import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Project } from '@shared/types'
import type { AITask, PortInfo, ProcessInfo, ScannerCacheSnapshot, WindowInfo } from '@shared/types-extended'
import { NetworkTopologyBuilder } from './NetworkTopologyBuilder'
import {
  graphExportRequestSchema,
  graphExportResultSchema,
  graphSaveSnapshotRequestSchema,
  graphSavedSnapshotSchema,
  graphSliceSchema,
  graphSnapshotSchema,
  graphWarmScopeRequestSchema,
  type GraphEdge,
  type GraphKind,
  type GraphNode,
  type GraphSavedSnapshot,
  type GraphSlice,
  type GraphSnapshot
} from '@shared/schemas/graph'

interface GraphServiceOptions {
  getSnapshot: () => ScannerCacheSnapshot | null | undefined
  getProjects: () => Project[]
  getUserDataRoot: () => string
  now?: () => number
}

interface GraphSourceData {
  processes: ProcessInfo[]
  ports: PortInfo[]
  windows: WindowInfo[]
  projects: Project[]
  aiTasks: AITask[]
}

interface GraphBuildOptions {
  refresh?: boolean
}

interface ProjectGraphMatch {
  projectId: string
  label: string
  path: string | undefined
  source: 'explicit-project-id' | 'working-directory' | 'command-line'
}

const DEFAULT_NODE_LIMIT = 500
const EXPANDED_NODE_LIMIT = 2000
const CACHE_LIMIT = 20
const PROCESS_ALIAS_PATTERNS: Array<{ id: string; label: string; patterns: RegExp[] }> = [
  { id: 'alias-claude', label: 'Claude Code', patterns: [/\bclaude(?:\.exe)?\b/i, /@anthropic-ai\/claude-code/i] },
  { id: 'alias-codex', label: 'Codex', patterns: [/\bcodex(?:\.exe)?\b/i, /openai.*codex/i] },
  { id: 'alias-gemini', label: 'Gemini CLI', patterns: [/\bgemini(?:\.exe)?\b/i, /google.*gemini/i] },
  { id: 'alias-cursor', label: 'Cursor', patterns: [/\bcursor(?:\.exe)?\b/i] },
  { id: 'alias-node-runtime', label: 'Node Runtime', patterns: [/\bnode(?:\.exe)?\b/i, /\bpnpm\b/i, /\bnpm\b/i, /\byarn\b/i] },
  { id: 'alias-python-runtime', label: 'Python Runtime', patterns: [/\bpython(?:3)?(?:\.exe)?\b/i, /\bpy(?:\.exe)?\b/i] }
]

export class GraphService {
  private readonly cache = new Map<string, GraphSnapshot>()
  private readonly networkTopologyBuilder = new NetworkTopologyBuilder()

  constructor(private readonly options: GraphServiceOptions) {}

  async buildGlobal(input: unknown = {}, options: GraphBuildOptions = {}): Promise<GraphSnapshot> {
    const slice = graphSliceSchema.parse(input ?? {})
    const cacheKey = JSON.stringify(slice)
    const cached = this.cache.get(cacheKey)
    if (cached && options.refresh !== true) return cached

    const data = this.applySlice(this.readSourceData(), slice)
    const built = slice.graphKind === 'neural-relationship'
      ? this.buildNeural(data, slice)
      : slice.graphKind === 'flow'
        ? this.buildFlow(data, slice)
        : this.networkTopologyBuilder.build(data, slice)
    const historical = slice.asOfTs !== null
    const snapshot = this.limitSnapshot(graphSnapshotSchema.parse({
      snapshotId: randomUUID(),
      generatedAt: this.now(),
      slice,
      nodes: historical ? built.nodes.map(markHistoricalNode) : built.nodes,
      edges: built.edges,
      warnings: historical
        ? [...built.warnings, { code: 'E_GRAPH_HISTORICAL_CURSOR', message: `Rendering current scanner-cache data with historical cursor ${slice.asOfTs}.` }]
        : built.warnings,
      degraded: false,
      source: 'scanner-cache'
    }))
    this.remember(cacheKey, snapshot)
    return snapshot
  }

  async buildNetwork(input: unknown = {}): Promise<GraphSnapshot> {
    return this.buildGlobal({ ...(input as object), graphKind: 'network-topology' })
  }

  async buildNeuralRelationship(input: unknown = {}): Promise<GraphSnapshot> {
    return this.buildGlobal({ ...(input as object), graphKind: 'neural-relationship' })
  }

  async saveSnapshot(input: unknown): Promise<{ saved: boolean; path: string }> {
    const request = graphSaveSnapshotRequestSchema.parse(input)
    if (!request.confirmedBy || request.confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const snapshot = this.findSnapshot(request.snapshotId)
    if (!snapshot) throw new Error('E_NOT_FOUND:topology snapshot')
    const dir = this.snapshotDir()
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, `${request.snapshotId}.json`)
    await writeFile(filePath, JSON.stringify({ id: request.snapshotId, label: request.label, savedAt: this.now(), snapshot }, null, 2), 'utf-8')
    return { saved: true, path: filePath }
  }

  async listSavedSnapshots(): Promise<GraphSavedSnapshot[]> {
    const dir = this.snapshotDir()
    await mkdir(dir, { recursive: true })
    const entries = await readdir(dir, { withFileTypes: true })
    const rows: GraphSavedSnapshot[] = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const path = join(dir, entry.name)
      try {
        const parsed = JSON.parse(await readFile(path, 'utf-8')) as { id?: unknown; label?: unknown; savedAt?: unknown }
        rows.push(graphSavedSnapshotSchema.parse({ id: parsed.id, label: parsed.label, savedAt: parsed.savedAt, path }))
      } catch {
        continue
      }
    }
    return rows.sort((left, right) => right.savedAt - left.savedAt)
  }

  async exportFormat(input: unknown): Promise<{ content: string; mimeType: string; encoding: 'utf8' | 'base64' }> {
    const request = graphExportRequestSchema.parse(input)
    const snapshot = this.findSnapshot(request.snapshotId)
    if (!snapshot) throw new Error('E_NOT_FOUND:topology snapshot')
    if (request.format === 'png') throw new Error('E_RUNTIME:png export requires renderer canvas')
    const content = request.format === 'dot'
      ? this.toDot(snapshot)
      : request.format === 'svg'
        ? this.toSvg(snapshot)
        : this.toMermaid(snapshot)
    const mimeType = request.format === 'svg' ? 'image/svg+xml' : 'text/plain'
    return graphExportResultSchema.parse({ content, mimeType, encoding: 'utf8' })
  }

  async warmScopes(input: unknown): Promise<{ warmed: number }> {
    const request = graphWarmScopeRequestSchema.parse(input)
    for (const scope of request.scopes) await this.buildGlobal(scope)
    return { warmed: request.scopes.length }
  }

  private readSourceData(): GraphSourceData {
    const snapshot = this.options.getSnapshot()
    return {
      aiTasks: snapshot?.aiTasks?.data ?? [],
      ports: snapshot?.ports?.data ?? [],
      processes: snapshot?.processes?.data ?? [],
      projects: this.options.getProjects(),
      windows: snapshot?.windows?.data ?? []
    }
  }

  private applySlice(data: GraphSourceData, slice: GraphSlice): GraphSourceData {
    if (slice.scope === 'global' || slice.targetIds.length === 0) return data

    const targets = new Set(slice.targetIds.map(String))
    const processIds = new Set<number>()
    const explicitProjectIds = new Set<string>()

    if (slice.scope === 'process') {
      for (const id of targets) {
        const pid = Number(id)
        if (Number.isFinite(pid)) processIds.add(pid)
      }
    }

    if (slice.scope === 'port') {
      for (const port of data.ports) {
        if (targets.has(String(port.port))) processIds.add(port.pid)
      }
    }

    if (slice.scope === 'window') {
      for (const windowInfo of data.windows) {
        if (targets.has(String(windowInfo.hwnd))) processIds.add(windowInfo.pid)
      }
    }

    if (slice.scope === 'project') {
      for (const id of targets) explicitProjectIds.add(id)
      for (const process of data.processes) {
        if (process.projectId && targets.has(process.projectId)) processIds.add(process.pid)
      }
    }

    const boundedDepth = Math.max(1, Math.min(slice.depth, 10))
    for (let depth = 0; depth < boundedDepth; depth++) {
      const before = processIds.size
      for (const process of data.processes) {
        const parentPid = readNumber(process, 'ppid')
        if (processIds.has(process.pid) && parentPid !== null) processIds.add(parentPid)
        if (parentPid !== null && processIds.has(parentPid)) processIds.add(process.pid)
      }
      if (processIds.size === before) break
    }

    const processes = data.processes.filter(process => processIds.has(process.pid))
    const ports = data.ports.filter(port => processIds.has(port.pid) || (slice.scope === 'port' && targets.has(String(port.port))))
    const windows = data.windows.filter(windowInfo => processIds.has(windowInfo.pid) || (slice.scope === 'window' && targets.has(String(windowInfo.hwnd))))
    const projectIds = new Set<string>(explicitProjectIds)
    for (const process of processes) if (process.projectId) projectIds.add(process.projectId)
    for (const port of ports) if (port.projectId) projectIds.add(port.projectId)
    const projects = data.projects.filter(project => projectIds.has(project.id))
    const aiTasks = data.aiTasks.filter(task => processIds.has(task.pid) || (task.projectId !== undefined && projectIds.has(task.projectId)))

    return { aiTasks, ports, processes, projects, windows }
  }

  private buildNeural(data: GraphSourceData, slice: GraphSlice): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: Array<{ code: string; message: string }> } {
    const nodes = new Map<string, GraphNode>()
    const edges = new Map<string, GraphEdge>()
    const cwdBuckets = new Map<string, ProcessInfo[]>()
    for (const project of data.projects) nodes.set(projectNodeId(project.id), graphNode('project', projectNodeId(project.id), project.name || project.path || project.id, { path: project.path, projectId: project.id }))
    for (const process of data.processes) {
      nodes.set(processNodeId(process.pid), graphNode('process', processNodeId(process.pid), process.name || `PID ${process.pid}`, { command: process.command, pid: process.pid, status: process.status, type: process.type, workingDir: process.workingDir }))
      const tagId = tagNodeId(process.type || 'other')
      nodes.set(tagId, graphNode('tag', tagId, process.type || 'other', { source: 'process.type' }))
      setEdge(edges, slice.graphKind, 'has-tag', processNodeId(process.pid), tagId, 0.8)
      const projectMatch = findProjectMatch(process, data.projects)
      if (projectMatch) {
        const projectId = projectMatch.projectId
        nodes.set(projectNodeId(projectId), nodes.get(projectNodeId(projectId)) ?? graphNode('project', projectNodeId(projectId), projectMatch.label, { path: projectMatch.path, projectId }))
        setEdge(edges, slice.graphKind, 'belongs-to-project', processNodeId(process.pid), projectNodeId(projectId), projectMatch.source === 'explicit-project-id' ? 0.9 : 0.72)
      }
      for (const alias of inferProcessAliases(process)) {
        const aliasTagId = tagNodeId(alias.id)
        nodes.set(aliasTagId, graphNode('tag', aliasTagId, alias.label, { source: 'cmdline-alias-map', aliasId: alias.id }))
        setEdge(edges, slice.graphKind, 'has-tag', processNodeId(process.pid), aliasTagId, 0.72)
      }
      const cwd = normalizePath(process.workingDir)
      if (cwd) cwdBuckets.set(cwd, [...(cwdBuckets.get(cwd) ?? []), process])
    }
    for (const processes of cwdBuckets.values()) {
      if (processes.length < 2) continue
      for (let index = 1; index < processes.length; index++) setEdge(edges, slice.graphKind, 'shares-cwd', processNodeId(processes[0].pid), processNodeId(processes[index].pid), 0.75)
    }
    for (const task of data.aiTasks) {
      const taskRecord = task as unknown as Record<string, unknown>
      const id = aiTaskNodeId(String(taskRecord.id ?? taskRecord.taskId ?? randomUUID()))
      nodes.set(id, graphNode('ai-task', id, String(taskRecord.name ?? taskRecord.title ?? taskRecord.id ?? 'AI task'), { status: taskRecord.status ?? null, tool: taskRecord.tool ?? null }))
      const pid = readNumber(taskRecord, 'pid')
      if (pid) setEdge(edges, slice.graphKind, 'ai-session-of', id, processNodeId(pid), 0.7)
    }
    return finalizeBuild(nodes, edges)
  }

  private buildFlow(data: GraphSourceData, slice: GraphSlice): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: Array<{ code: string; message: string }> } {
    const nodes = data.aiTasks.map(task => {
      const record = task as unknown as Record<string, unknown>
      return graphNode('ai-task', aiTaskNodeId(String(record.id ?? record.taskId ?? randomUUID())), String(record.name ?? record.title ?? record.id ?? 'AI task'), { status: record.status ?? null, tool: record.tool ?? null })
    })
    const edges: GraphEdge[] = []
    for (let index = 1; index < nodes.length; index++) edges.push({ id: `edge-${nodes[index - 1].id}-${nodes[index].id}`, kind: slice.graphKind, source: nodes[index - 1].id, target: nodes[index].id, type: 'happens-before' })
    return { nodes, edges: filterEdgesToKnownNodes(nodes, edges), warnings: [] }
  }

  private limitSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
    const limit = snapshot.slice.expandAll ? EXPANDED_NODE_LIMIT : DEFAULT_NODE_LIMIT
    if (snapshot.nodes.length <= limit) return snapshot
    const nodes = snapshot.nodes.slice(0, limit)
    const nodeIds = new Set(nodes.map(node => node.id))
    return graphSnapshotSchema.parse({
      ...snapshot,
      degraded: true,
      nodes,
      edges: snapshot.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
      warnings: [...snapshot.warnings, { code: 'E_GRAPH_NODE_LIMIT', message: `Node count ${snapshot.nodes.length} exceeds ${limit}; narrow the slice or expand explicitly.` }]
    })
  }

  private remember(cacheKey: string, snapshot: GraphSnapshot): void {
    if (this.cache.has(cacheKey)) this.cache.delete(cacheKey)
    this.cache.set(cacheKey, snapshot)
    while (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value as string)
  }

  private findSnapshot(snapshotId: string): GraphSnapshot | null {
    for (const snapshot of this.cache.values()) if (snapshot.snapshotId === snapshotId) return snapshot
    return null
  }

  private snapshotDir(): string {
    return join(this.options.getUserDataRoot(), 'topology-snapshots')
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  private toMermaid(snapshot: GraphSnapshot): string {
    return ['graph TD', ...snapshot.nodes.map(node => `  ${safeId(node.id)}["${escapeLabel(node.label)}"]`), ...snapshot.edges.map(edge => `  ${safeId(edge.source)} -->|${edge.type}| ${safeId(edge.target)}`)].join('\n')
  }

  private toDot(snapshot: GraphSnapshot): string {
    return ['digraph DevHubTopology {', ...snapshot.nodes.map(node => `  "${node.id}" [label="${escapeLabel(node.label)}"];`), ...snapshot.edges.map(edge => `  "${edge.source}" -> "${edge.target}" [label="${edge.type}"];`), '}'].join('\n')
  }

  private toSvg(snapshot: GraphSnapshot): string {
    const height = Math.max(120, snapshot.nodes.length * 18 + 40)
    const rows = snapshot.nodes.slice(0, 80).map((node, index) => `<text x="20" y="${30 + index * 18}" fill="#d8f7df" font-size="12">${escapeXml(node.label)} (${node.kind})</text>`).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}"><rect width="100%" height="100%" fill="#050505"/>${rows}</svg>`
  }
}


function finalizeBuild(nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>): { nodes: GraphNode[]; edges: GraphEdge[]; warnings: Array<{ code: string; message: string }> } {
  const nodeList = [...nodes.values()]
  return { nodes: nodeList, edges: filterEdgesToKnownNodes(nodeList, [...edges.values()]), warnings: [] }
}

function filterEdgesToKnownNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] {
  const nodeIds = new Set(nodes.map(node => node.id))
  return edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
}

function markHistoricalNode(node: GraphNode): GraphNode {
  return {
    ...node,
    signals: {
      ...node.signals,
      state: node.signals?.state ?? 'historical'
    }
  }
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
function tagNodeId(tag: string): string { return `tag-${tag}` }
function aiTaskNodeId(id: string): string { return `ai-task-${id}` }
function normalizePath(value: string | undefined): string { return (value ?? '').replace(/\\/g, '/').toLowerCase() }
function normalizeRoot(value: string | undefined): string { return normalizePath(value).replace(/\/+$/g, '') }
function findProjectMatch(process: ProcessInfo, projects: Project[]): ProjectGraphMatch | null {
  if (process.projectId) {
    const explicit = projects.find(project => project.id === process.projectId)
    if (explicit) return toProjectGraphMatch(explicit, 'explicit-project-id')
    return { projectId: process.projectId, label: process.projectId, path: process.workingDir, source: 'explicit-project-id' }
  }
  const byCwd = findProjectByPath(process.workingDir, projects)
  if (byCwd) return toProjectGraphMatch(byCwd, 'working-directory')
  const byCommand = findProjectByCommand(process.command, projects)
  if (byCommand) return toProjectGraphMatch(byCommand, 'command-line')
  return null
}
function toProjectGraphMatch(project: Project, source: ProjectGraphMatch['source']): ProjectGraphMatch {
  return { projectId: project.id, label: project.name || project.path || project.id, path: project.path, source }
}
function findProjectByPath(value: string | undefined, projects: Project[]): Project | null {
  const candidate = normalizeRoot(value)
  if (!candidate) return null
  return orderedProjectsByRoot(projects).find(project => {
    const root = normalizeRoot(project.path)
    return root.length > 0 && (candidate === root || candidate.startsWith(`${root}/`))
  }) ?? null
}
function findProjectByCommand(value: string | undefined, projects: Project[]): Project | null {
  const command = normalizePath(value)
  if (!command) return null
  return orderedProjectsByRoot(projects).find(project => {
    const root = normalizeRoot(project.path)
    if (!root) return false
    const index = command.indexOf(root)
    if (index < 0) return false
    const next = command[index + root.length]
    return next === undefined || next === '/' || next === ' ' || next === '"' || next === "'"
  }) ?? null
}
function orderedProjectsByRoot(projects: Project[]): Project[] {
  return [...projects].sort((left, right) => normalizeRoot(right.path).length - normalizeRoot(left.path).length)
}
function inferProcessAliases(process: ProcessInfo): Array<{ id: string; label: string }> {
  const haystack = [process.name, process.command, process.type, process.workingDir].filter(Boolean).join(' ')
  return PROCESS_ALIAS_PATTERNS.filter(alias => alias.patterns.some(pattern => pattern.test(haystack))).map(alias => ({ id: alias.id, label: alias.label }))
}
function readNumber(value: unknown, key: string): number | null {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined
  const next = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  return Number.isFinite(next) ? next : null
}
function safeId(value: string): string { return value.replace(/[^a-zA-Z0-9_]/g, '_') }
function escapeLabel(value: string): string { return value.replace(/"/g, '\\"') }
function escapeXml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
