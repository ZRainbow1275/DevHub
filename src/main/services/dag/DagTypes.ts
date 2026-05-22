import type { graphlib } from '@dagrejs/dagre'
import type { DagEdge, DagInputNode, ParsedDependency } from '@shared/schemas/dag'

export interface NormalizedDagTask {
  taskId: string
  dependency: ParsedDependency
  priority: number
  parallelGroup: string | null
  parallelGroupMax: number | null
  estimatedDurationMs: number | null
  sourceIndex: number
}

export interface DagGraphLabel {
  sessionId: string
}

export interface DagGraphNodeLabel {
  task: NormalizedDagTask
}

export interface DagGraphEdgeLabel extends DagEdge {
  clauseIndex: number
}

export type DagGraph = graphlib.Graph<DagGraphLabel, DagGraphNodeLabel, DagGraphEdgeLabel>

export interface DagBuildArtifacts {
  graph: DagGraph
  tasks: NormalizedDagTask[]
  tasksById: Map<string, NormalizedDagTask>
  edges: DagGraphEdgeLabel[]
  forwardEdgesByTaskId: Map<string, DagGraphEdgeLabel[]>
  reverseEdgesByTaskId: Map<string, DagGraphEdgeLabel[]>
  inputNodes: DagInputNode[]
}
