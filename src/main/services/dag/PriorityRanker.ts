import type { NormalizedDagTask } from './DagTypes'

export class PriorityRanker {
  sortTasks(tasks: readonly NormalizedDagTask[]): NormalizedDagTask[] {
    return [...tasks].sort((left, right) => this.compare(left, right))
  }

  compare(left: NormalizedDagTask, right: NormalizedDagTask): number {
    const groupCompare = this.groupKey(left).localeCompare(this.groupKey(right))
    if (groupCompare !== 0) return groupCompare
    const priorityCompare = right.priority - left.priority
    if (priorityCompare !== 0) return priorityCompare
    return left.sourceIndex - right.sourceIndex || left.taskId.localeCompare(right.taskId)
  }

  private groupKey(task: NormalizedDagTask): string {
    return task.parallelGroup ?? '\uffff'
  }
}
