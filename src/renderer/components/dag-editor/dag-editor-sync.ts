import type { CsvTaskRow18, DagSnapshot } from '@shared/schemas/r8-runtime'
import type { DagCanvasGraph } from './DagCanvas'

export interface DagDependencyEdgeChange {
  fromTaskId: string
  kind: 'add' | 'remove'
  toTaskId: string
}

export function parseDependencyRefs(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  const normalized = trimmed
    .replace(/^after:/, '')
    .replace(/\s+if=[a-z]+$/i, '')
    .replaceAll('|', ',')
  return normalized.split(',').map(item => item.trim()).filter(Boolean)
}

export function formatDependencyRefs(refs: readonly string[]): string {
  const values = [...new Set(refs.map(ref => ref.trim()).filter(Boolean))]
  if (values.length === 0) return ''
  return values.length === 1 ? `after:${values[0]}` : `after:${values.join('|')}`
}

export function applyDependencyEdgeChange(rows: readonly CsvTaskRow18[], change: DagDependencyEdgeChange): CsvTaskRow18[] {
  if (change.fromTaskId === change.toTaskId) return [...rows]
  let changed = false
  const nextRows = rows.map(row => {
    if (row.taskId !== change.toTaskId) return row
    const refs = new Set(parseDependencyRefs(row.dependsOn))
    const before = formatDependencyRefs([...refs])
    if (change.kind === 'add') refs.add(change.fromTaskId)
    else refs.delete(change.fromTaskId)
    const after = formatDependencyRefs([...refs])
    if (before === after) return row
    changed = true
    return { ...row, dependsOn: after }
  })
  return changed ? nextRows : [...rows]
}

export function deriveCycleEdgeKeys(cyclePaths: readonly string[][]): Set<string> {
  const keys = new Set<string>()
  for (const path of cyclePaths) {
    for (let index = 0; index < path.length - 1; index += 1) keys.add(`${path[index]}->${path[index + 1]}`)
  }
  return keys
}

export function deriveDagCanvasGraph(rows: readonly CsvTaskRow18[], snapshot: DagSnapshot | null, cyclePaths: readonly string[][]): DagCanvasGraph {
  const cycleKeys = deriveCycleEdgeKeys(cyclePaths)
  const edges = snapshot?.edges ?? rows.flatMap(row => parseDependencyRefs(row.dependsOn).map(ref => ({ from: ref, to: row.taskId })))
  return {
    nodes: rows.map(row => ({
      id: row.taskId,
      kind: 'task',
      label: row.taskName || row.taskId,
      meta: { priority: row.priority, taskId: row.taskId },
      status: row.status
    })),
    edges: edges.map(edge => {
      const edgeKey = `${edge.from}->${edge.to}`
      return {
        id: edgeKey,
        inCycle: cycleKeys.has(edgeKey),
        label: 'depends',
        source: edge.from,
        target: edge.to
      }
    })
  }
}
