import type { DagBuildArtifacts } from './DagTypes'

export interface CriticalPathResult {
  path: string[]
  estimatedTotalMs: number | null
  timings: CriticalPathTiming[]
}

export interface CriticalPathTiming {
  taskId: string
  durationMs: number
  earliestStartMs: number
  earliestFinishMs: number
  latestStartMs: number
  latestFinishMs: number
  slackMs: number
  isCritical: boolean
}

export class CriticalPathAnalyzer {
  analyze(artifacts: DagBuildArtifacts, layers: readonly string[][]): CriticalPathResult {
    const durationById = new Map(artifacts.tasks.map(task => [task.taskId, task.estimatedDurationMs ?? 0]))
    const hasEstimate = artifacts.tasks.some(task => task.estimatedDurationMs !== null)
    if (!hasEstimate) return { path: [], estimatedTotalMs: null, timings: [] }

    const earliestStartById = new Map<string, number>()
    const earliestFinishById = new Map<string, number>()
    const predecessorById = new Map<string, string | null>()

    for (const layer of layers) {
      for (const taskId of layer) {
        const predecessors = (artifacts.reverseEdgesByTaskId.get(taskId) ?? []).map(edge => edge.from)
        let bestPredecessor: string | null = null
        let bestFinish = 0
        for (const predecessor of predecessors) {
          const predecessorFinish = earliestFinishById.get(predecessor) ?? 0
          if (predecessorFinish > bestFinish || (predecessorFinish === bestFinish && predecessor.localeCompare(bestPredecessor ?? '\uffff') < 0)) {
            bestFinish = predecessorFinish
            bestPredecessor = predecessor
          }
        }
        earliestStartById.set(taskId, bestFinish)
        earliestFinishById.set(taskId, bestFinish + (durationById.get(taskId) ?? 0))
        predecessorById.set(taskId, bestPredecessor)
      }
    }

    const sinks = artifacts.tasks.filter(task => (artifacts.forwardEdgesByTaskId.get(task.taskId) ?? []).length === 0)
    let endTaskId: string | null = null
    let estimatedTotalMs = 0
    for (const sink of sinks) {
      const finish = earliestFinishById.get(sink.taskId) ?? 0
      if (finish > estimatedTotalMs || (finish === estimatedTotalMs && sink.taskId.localeCompare(endTaskId ?? '\uffff') < 0)) {
        estimatedTotalMs = finish
        endTaskId = sink.taskId
      }
    }

    const latestFinishById = new Map<string, number>()
    const latestStartById = new Map<string, number>()
    for (const layer of [...layers].reverse()) {
      for (const taskId of [...layer].sort().reverse()) {
        const successors = (artifacts.forwardEdgesByTaskId.get(taskId) ?? []).map(edge => edge.to)
        const duration = durationById.get(taskId) ?? 0
        const latestFinish = successors.length === 0
          ? estimatedTotalMs
          : Math.min(...successors.map(successor => latestStartById.get(successor) ?? estimatedTotalMs))
        latestFinishById.set(taskId, latestFinish)
        latestStartById.set(taskId, latestFinish - duration)
      }
    }

    const path: string[] = []
    let cursor = endTaskId
    while (cursor) {
      path.unshift(cursor)
      cursor = predecessorById.get(cursor) ?? null
    }
    const criticalSet = new Set(path)
    const timings = artifacts.tasks
      .map(task => {
        const earliestStartMs = earliestStartById.get(task.taskId) ?? 0
        const earliestFinishMs = earliestFinishById.get(task.taskId) ?? earliestStartMs
        const latestStartMs = latestStartById.get(task.taskId) ?? earliestStartMs
        const latestFinishMs = latestFinishById.get(task.taskId) ?? earliestFinishMs
        const slackMs = Math.max(0, latestStartMs - earliestStartMs)
        return {
          taskId: task.taskId,
          durationMs: durationById.get(task.taskId) ?? 0,
          earliestStartMs,
          earliestFinishMs,
          latestStartMs,
          latestFinishMs,
          slackMs,
          isCritical: criticalSet.has(task.taskId) && slackMs === 0
        }
      })
      .sort((left, right) => left.earliestStartMs - right.earliestStartMs || left.taskId.localeCompare(right.taskId))

    return { path, estimatedTotalMs, timings }
  }
}
