import type { DagSnapshot } from '@shared/schemas/dag'
import type { DagBuildArtifacts, NormalizedDagTask } from './DagTypes'
import { PriorityRanker } from './PriorityRanker'

export class TopoSorter {
  constructor(private readonly ranker = new PriorityRanker()) {}

  layer(artifacts: DagBuildArtifacts): string[][] {
    const inDegree = new Map<string, number>()
    for (const task of artifacts.tasks) inDegree.set(task.taskId, 0)
    for (const edge of artifacts.edges) inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)

    const layers: string[][] = []
    let current = this.ranker.sortTasks(artifacts.tasks.filter(task => (inDegree.get(task.taskId) ?? 0) === 0))
    const processed = new Set<string>()

    while (current.length > 0) {
      const currentIds = current.map(task => task.taskId)
      layers.push(currentIds)
      const nextCandidates = new Map<string, NormalizedDagTask>()

      for (const task of current) {
        processed.add(task.taskId)
        for (const edge of artifacts.forwardEdgesByTaskId.get(task.taskId) ?? []) {
          const successorId = edge.to
          const nextInDegree = (inDegree.get(successorId) ?? 0) - 1
          inDegree.set(successorId, nextInDegree)
          if (nextInDegree === 0) {
            const successor = artifacts.tasksById.get(successorId)
            if (successor) nextCandidates.set(successorId, successor)
          }
        }
      }

      current = this.ranker.sortTasks([...nextCandidates.values()].filter(task => !processed.has(task.taskId)))
    }

    if (processed.size !== artifacts.tasks.length) throw new Error('E_DAG_CYCLE:topological layering stopped before all nodes were processed')
    return layers
  }

  layerOf(snapshot: DagSnapshot, layerIndex: number): string[] {
    return snapshot.layers[layerIndex] ? [...snapshot.layers[layerIndex]] : []
  }
}
