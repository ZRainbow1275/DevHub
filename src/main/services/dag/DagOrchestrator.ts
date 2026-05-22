import { createHash, randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import {
  dagEdgeSchema,
  dagInputNodeSchema,
  dagSnapshotSchema,
  type DagCycleError,
  type DagExportFormat,
  type DagGraphInput,
  type DagInputNode,
  type DagSnapshot,
  type DagWarning,
  type DependencyClause
} from '@shared/schemas/dag'
import { csvPriorityToNumber, type CsvTaskRow18 } from '@shared/schemas/csv-task-row'
import type { RuntimeCsvTaskRow } from '../csv'
import { DependencyDslParser } from './DependencyDslParser'
import { CycleDetector } from './CycleDetector'
import { TopoSorter } from './TopoSorter'
import { CriticalPathAnalyzer } from './CriticalPathAnalyzer'
import { DagSerializer } from './DagSerializer'
import type { DagBuildArtifacts, DagGraph, DagGraphEdgeLabel, NormalizedDagTask } from './DagTypes'
import { graphlib } from './dagreGraphlib'

export interface DagOrchestratorBuildInput {
  sessionId?: string
  rows?: readonly DagRowLike[]
  graph?: DagGraphInput
  nodes?: readonly DagInputNode[]
}

export type DagRowLike = CsvTaskRow18 | RuntimeCsvTaskRow | DagInputNode | Record<string, unknown>

export interface DagBuildMetrics {
  nodeCount: number
  edgeCount: number
  artifactBuildMs: number
  cycleDetectMs: number
  topoSortMs: number
  criticalPathMs: number
  warningBuildMs: number
  snapshotFinalizeMs: number
  totalBuildMs: number
}

export interface DagBuildResultWithMetrics {
  snapshot: DagSnapshot
  metrics: DagBuildMetrics
}

const NODE_MAX = 1000
const EDGE_MAX = 5000
const LONG_CRITICAL_PATH_NODE_MAX = 100

export class DagOrchestrator {
  constructor(
    private readonly parser = new DependencyDslParser(),
    private readonly cycleDetector = new CycleDetector(),
    private readonly topoSorter = new TopoSorter(),
    private readonly criticalPathAnalyzer = new CriticalPathAnalyzer(),
    private readonly serializer = new DagSerializer(),
    private readonly now: () => number = () => Date.now()
  ) {}

  build(input: DagOrchestratorBuildInput): DagSnapshot {
    return this.buildWithMetrics(input).snapshot
  }

  buildWithMetrics(input: DagOrchestratorBuildInput): DagBuildResultWithMetrics {
    const totalStartedAt = performance.now()
    const sessionId = input.sessionId ?? randomUUID()
    const artifactsStartedAt = performance.now()
    const artifacts = this.toArtifacts(input, sessionId)
    const artifactBuildMs = performance.now() - artifactsStartedAt
    const cycleStartedAt = performance.now()
    const cycle = this.cycleDetector.detect(artifacts.graph)
    const cycleDetectMs = performance.now() - cycleStartedAt
    if (cycle) throw new Error(`E_DAG_CYCLE:${cycle.cyclePaths.map(path => path.join('->')).join(';')}`)

    const topoStartedAt = performance.now()
    const layers = this.topoSorter.layer(artifacts)
    const topoSortMs = performance.now() - topoStartedAt
    const criticalStartedAt = performance.now()
    const critical = this.criticalPathAnalyzer.analyze(artifacts, layers)
    const criticalPathMs = performance.now() - criticalStartedAt
    const criticalSet = new Set(critical.path)
    const warningsStartedAt = performance.now()
    const warnings = this.buildWarnings(artifacts, layers, critical.path)
    const warningBuildMs = performance.now() - warningsStartedAt

    const finalizeStartedAt = performance.now()
    const layerByTaskId = new Map<string, number>()
    layers.forEach((layer, layerIndex) => {
      for (const taskId of layer) layerByTaskId.set(taskId, layerIndex)
    })

    const nodes = artifacts.tasks.map(task => dagSnapshotSchema.shape.nodes.element.parse({
      taskId: task.taskId,
      layer: layerByTaskId.get(task.taskId) ?? 0,
      parallelGroup: task.parallelGroup,
      parallelGroupMax: task.parallelGroupMax,
      priority: task.priority,
      estimatedDurationMs: task.estimatedDurationMs,
      isCriticalPath: criticalSet.has(task.taskId),
      inDegree: (artifacts.graph.predecessors(task.taskId) ?? []).length,
      outDegree: (artifacts.graph.successors(task.taskId) ?? []).length
    }))

    const snapshot = dagSnapshotSchema.parse({
      sessionId,
      generatedAt: this.now(),
      nodes,
      edges: artifacts.edges.map(edge => dagEdgeSchema.parse({ from: edge.from, to: edge.to, condition: edge.condition, combinator: edge.combinator })),
      layers,
      totalLayers: layers.length,
      criticalPath: critical.path,
      estimatedTotalMs: critical.estimatedTotalMs,
      warnings
    })
    const snapshotWithHash = dagSnapshotSchema.parse({ ...snapshot, hash: this.hashSnapshot(snapshot) })
    const snapshotFinalizeMs = performance.now() - finalizeStartedAt
    return {
      snapshot: snapshotWithHash,
      metrics: {
        nodeCount: artifacts.tasks.length,
        edgeCount: artifacts.edges.length,
        artifactBuildMs,
        cycleDetectMs,
        topoSortMs,
        criticalPathMs,
        warningBuildMs,
        snapshotFinalizeMs,
        totalBuildMs: performance.now() - totalStartedAt
      }
    }
  }

  detectCycle(input: DagOrchestratorBuildInput): DagCycleError | null {
    const artifacts = this.toArtifacts(input, input.sessionId ?? 'cycle-detect')
    return this.cycleDetector.detect(artifacts.graph)
  }

  layer(snapshot: DagSnapshot, layerIndex: number): string[] {
    return this.topoSorter.layerOf(snapshot, layerIndex)
  }

  serialize(snapshot: DagSnapshot, format: DagExportFormat): string {
    return this.serializer.serialize(snapshot, format)
  }

  export(snapshot: DagSnapshot, format: DagExportFormat) {
    return {
      content: this.serializer.serialize(snapshot, format),
      mimeType: this.serializer.mimeType(format),
      format,
      sessionId: snapshot.sessionId
    }
  }

  isReady(snapshot: DagSnapshot, taskId: string, completedTaskIds: ReadonlySet<string>, failedTaskIds: ReadonlySet<string>): { ready: boolean; blockers: string[] } {
    if (!snapshot.nodes.some(node => node.taskId === taskId)) return { ready: false, blockers: [taskId] }
    const incoming = snapshot.edges.filter(edge => edge.to === taskId)
    const groups = new Map<string, typeof incoming>()
    for (const edge of incoming) {
      const key = `${edge.condition}:${edge.combinator}`
      groups.set(key, [...(groups.get(key) ?? []), edge])
    }

    const blockers: string[] = []
    for (const edges of groups.values()) {
      const combinator = edges[0]?.combinator ?? 'all'
      const unsatisfied = edges.filter(edge => !this.isEdgeSatisfied(edge.from, edge.condition, completedTaskIds, failedTaskIds)).map(edge => edge.from)
      if (combinator === 'any') {
        if (unsatisfied.length === edges.length) blockers.push(...unsatisfied)
      } else {
        blockers.push(...unsatisfied)
      }
    }
    return { ready: blockers.length === 0, blockers }
  }

  private toArtifacts(input: DagOrchestratorBuildInput, sessionId: string): DagBuildArtifacts {
    const inputNodes = input.graph?.nodes ?? input.nodes
    const tasks = inputNodes
      ? inputNodes.map((node, index) => this.fromInputNode(dagInputNodeSchema.parse(node), index))
      : (input.rows ?? []).map((row, index) => this.fromRow(row, index))

    if (tasks.length === 0) throw new Error('E_VALIDATION:DAG requires at least one task row or graph node')
    if (tasks.length > NODE_MAX) throw new Error('E_VALIDATION:DAG node count exceeds 1000; split the batch before launch')

    const tasksById = new Map<string, NormalizedDagTask>()
    for (const task of tasks) {
      if (tasksById.has(task.taskId)) throw new Error(`E_VALIDATION:duplicate taskId ${task.taskId}`)
      tasksById.set(task.taskId, task)
    }

    const graph = new graphlib.Graph({ directed: true, multigraph: false, compound: false }) as DagGraph
    graph.setGraph({ sessionId })
    for (const task of tasks) graph.setNode(task.taskId, { task })

    const edges: DagGraphEdgeLabel[] = []
    const forwardEdgesByTaskId = new Map<string, DagGraphEdgeLabel[]>()
    const reverseEdgesByTaskId = new Map<string, DagGraphEdgeLabel[]>()
    for (const task of tasks) {
      forwardEdgesByTaskId.set(task.taskId, [])
      reverseEdgesByTaskId.set(task.taskId, [])
    }

    for (const task of tasks) {
      task.dependency.clauses.forEach((clause, clauseIndex) => {
        for (const ref of clause.refs) {
          if (!tasksById.has(ref)) throw new Error(`E_NOT_FOUND:dependency ${ref} referenced by ${task.taskId} does not exist`)
          const edge = { from: ref, to: task.taskId, condition: clause.condition, combinator: clause.combinator, clauseIndex }
          graph.setEdge(ref, task.taskId, edge)
          edges.push(edge)
          forwardEdgesByTaskId.get(ref)?.push(edge)
          reverseEdgesByTaskId.get(task.taskId)?.push(edge)
        }
      })
    }
    if (edges.length > EDGE_MAX) throw new Error('E_VALIDATION:DAG edge count exceeds 5000; split the batch before launch')

    return {
      graph,
      tasks,
      tasksById,
      edges,
      forwardEdgesByTaskId,
      reverseEdgesByTaskId,
      inputNodes: tasks.map(task => ({
        id: task.taskId,
        dependencyIds: task.dependency.clauses.flatMap(clause => clause.refs),
        priority: task.priority,
        parallelGroup: task.parallelGroup,
        parallelGroupMax: task.parallelGroupMax,
        estimatedDurationMs: task.estimatedDurationMs
      }))
    }
  }

  private fromInputNode(node: DagInputNode, sourceIndex: number): NormalizedDagTask {
    return {
      taskId: node.id,
      dependency: this.parser.fromDependencyIds(node.dependencyIds),
      priority: node.priority,
      parallelGroup: node.parallelGroup,
      parallelGroupMax: node.parallelGroupMax,
      estimatedDurationMs: node.estimatedDurationMs,
      sourceIndex
    }
  }

  private fromRow(row: DagRowLike, sourceIndex: number): NormalizedDagTask {
    const record = row as Record<string, unknown>
    const taskId = this.stringField(record, 'taskId') ?? this.stringField(record, 'id')
    if (!taskId) throw new Error(`E_VALIDATION:row ${sourceIndex + 1} is missing taskId/id`)
    const dependency = this.dependencyFromRecord(record)
    const parallel = this.parseParallelGroup(this.stringField(record, 'parallel_group') ?? this.stringField(record, 'parallelGroup') ?? this.stringField(record, 'concurrencyKey'))
    return {
      taskId,
      dependency,
      priority: this.priorityFromRecord(record),
      parallelGroup: parallel.group,
      parallelGroupMax: parallel.max,
      estimatedDurationMs: this.durationFromRecord(record),
      sourceIndex
    }
  }

  private dependencyFromRecord(record: Record<string, unknown>) {
    const dependencyIds = Array.isArray(record.dependencyIds) ? record.dependencyIds.map(item => String(item)) : []
    if (dependencyIds.length > 0) return this.parser.fromDependencyIds(dependencyIds)
    return this.parser.parse(this.stringField(record, 'dependsOn') ?? this.stringField(record, 'dependency') ?? '')
  }

  private priorityFromRecord(record: Record<string, unknown>): number {
    const raw = record.priority
    if (typeof raw === 'number' && Number.isFinite(raw)) return this.clampPriority(Math.trunc(raw))
    if (typeof raw === 'string') {
      if (raw === 'P0' || raw === 'P1' || raw === 'P2' || raw === 'P3') return csvPriorityToNumber(raw)
      const numeric = Number.parseInt(raw, 10)
      if (Number.isFinite(numeric)) return this.clampPriority(numeric)
    }
    return 50
  }

  private durationFromRecord(record: Record<string, unknown>): number | null {
    for (const key of ['estimatedDurationMs', 'timeoutMs', 'timeout_ms']) {
      const raw = record[key]
      if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.trunc(raw)
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = Number.parseInt(raw, 10)
        if (Number.isFinite(parsed) && parsed >= 0) return parsed
      }
    }
    return null
  }

  private parseParallelGroup(raw: string | null | undefined): { group: string | null; max: number | null } {
    const value = raw?.trim()
    if (!value) return { group: null, max: null }
    const match = /^(?<group>[^:]+)(?::max=(?<max>\d+))?$/.exec(value)
    if (!match?.groups) return { group: value, max: null }
    return {
      group: match.groups.group.trim() || null,
      max: match.groups.max ? Number.parseInt(match.groups.max, 10) : null
    }
  }

  private buildWarnings(artifacts: DagBuildArtifacts, layers: readonly string[][], criticalPath: readonly string[]): DagWarning[] {
    const warnings: DagWarning[] = []
    const orphanIds = artifacts.tasks
      .filter(task => (artifacts.graph.predecessors(task.taskId) ?? []).length === 0 && (artifacts.graph.successors(task.taskId) ?? []).length === 0 && artifacts.tasks.length > 1)
      .map(task => task.taskId)
    if (orphanIds.length > 0) warnings.push({ kind: 'orphan-node', taskIds: orphanIds, message: `孤立 DAG 节点: ${orphanIds.join(', ')}` })

    for (const layer of layers) {
      const grouped = new Map<string, string[]>()
      for (const taskId of layer) {
        const task = artifacts.tasksById.get(taskId)
        if (task?.parallelGroup) grouped.set(task.parallelGroup, [...(grouped.get(task.parallelGroup) ?? []), taskId])
      }
      for (const [group, taskIds] of grouped) {
        const max = taskIds.map(taskId => artifacts.tasksById.get(taskId)?.parallelGroupMax ?? null).find(value => value !== null) ?? null
        if (max !== null && taskIds.length > max) warnings.push({ kind: 'parallel-group-conflict', taskIds, message: `parallel_group ${group} 同层任务数 ${taskIds.length} 超过 max=${max}` })
      }
    }

    if (criticalPath.length > LONG_CRITICAL_PATH_NODE_MAX) warnings.push({ kind: 'long-critical-path', taskIds: [...criticalPath], message: `关键路径超过 ${LONG_CRITICAL_PATH_NODE_MAX} 个节点` })
    return warnings
  }

  private isEdgeSatisfied(taskId: string, condition: DependencyClause['condition'], completedTaskIds: ReadonlySet<string>, failedTaskIds: ReadonlySet<string>): boolean {
    if (condition === 'success') return completedTaskIds.has(taskId)
    if (condition === 'failure') return failedTaskIds.has(taskId)
    return completedTaskIds.has(taskId) || failedTaskIds.has(taskId)
  }

  private stringField(record: Record<string, unknown>, key: string): string | null {
    const value = record[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private clampPriority(value: number): number {
    return Math.min(Math.max(value, 0), 100)
  }

  private hashSnapshot(snapshot: DagSnapshot): string {
    const stable = JSON.stringify({ nodes: snapshot.nodes, edges: snapshot.edges, layers: snapshot.layers, criticalPath: snapshot.criticalPath })
    return createHash('sha256').update(stable).digest('hex')
  }
}
