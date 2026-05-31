import { dagCycleErrorSchema, type DagCycleError } from '@shared/schemas/dag'
import type { DagGraph } from './DagTypes'

export class CycleDetector {
  detect(graph: DagGraph): DagCycleError | null {
    const tarjanCycles = this.findTarjanCycles(graph)
    const unique = this.uniqueCyclePaths(tarjanCycles)
    return unique.length === 0 ? null : dagCycleErrorSchema.parse({ cyclePaths: unique })
  }

  private findTarjanCycles(graph: DagGraph): string[][] {
    let index = 0
    const stack: string[] = []
    const onStack = new Set<string>()
    const indexByNode = new Map<string, number>()
    const lowlinkByNode = new Map<string, number>()
    const cycles: string[][] = []

    const strongConnect = (nodeId: string): void => {
      indexByNode.set(nodeId, index)
      lowlinkByNode.set(nodeId, index)
      index += 1
      stack.push(nodeId)
      onStack.add(nodeId)

      for (const successor of graph.successors(nodeId) ?? []) {
        if (!indexByNode.has(successor)) {
          strongConnect(successor)
          lowlinkByNode.set(nodeId, Math.min(lowlinkByNode.get(nodeId) ?? 0, lowlinkByNode.get(successor) ?? 0))
        } else if (onStack.has(successor)) {
          lowlinkByNode.set(nodeId, Math.min(lowlinkByNode.get(nodeId) ?? 0, indexByNode.get(successor) ?? 0))
        }
      }

      if (lowlinkByNode.get(nodeId) !== indexByNode.get(nodeId)) return
      const component: string[] = []
      let current: string | undefined
      do {
        current = stack.pop()
        if (current) {
          onStack.delete(current)
          component.push(current)
        }
      } while (current && current !== nodeId)

      if (component.length > 1) cycles.push(this.pathInsideComponent(graph, component))
      if (component.length === 1 && this.hasSelfLoop(graph, component[0])) cycles.push([component[0], component[0]])
    }

    for (const nodeId of graph.nodes()) {
      if (!indexByNode.has(nodeId)) strongConnect(nodeId)
    }
    return cycles
  }

  private pathInsideComponent(graph: DagGraph, component: readonly string[]): string[] {
    const allowed = new Set(component)
    const start = [...component].sort((left, right) => left.localeCompare(right))[0]
    const path = this.findClosingPath(graph, start, start, allowed, new Set(), [start])
    return path ?? this.closeCycle([...component].sort((left, right) => left.localeCompare(right)))
  }

  private findClosingPath(graph: DagGraph, current: string, target: string, allowed: ReadonlySet<string>, visited: Set<string>, path: string[]): string[] | null {
    visited.add(current)
    const successors = [...(graph.successors(current) ?? [])].filter(nodeId => allowed.has(nodeId)).sort((left, right) => left.localeCompare(right))
    for (const successor of successors) {
      if (successor === target && path.length > 1) return [...path, target]
      if (!visited.has(successor)) {
        const found = this.findClosingPath(graph, successor, target, allowed, visited, [...path, successor])
        if (found) return found
      }
    }
    visited.delete(current)
    return null
  }

  private hasSelfLoop(graph: DagGraph, nodeId: string): boolean {
    return (graph.outEdges(nodeId, nodeId) ?? []).length > 0
  }

  private closeCycle(cycle: readonly string[]): string[] {
    if (cycle.length === 0) return []
    return cycle[0] === cycle[cycle.length - 1] ? [...cycle] : [...cycle, cycle[0]]
  }

  private uniqueCyclePaths(paths: readonly string[][]): string[][] {
    const seen = new Set<string>()
    const unique: string[][] = []
    for (const path of paths) {
      if (path.length < 2) continue
      const normalized = this.normalize(path)
      const key = normalized.join('>')
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(normalized)
      }
    }
    return unique
  }

  private normalize(path: readonly string[]): string[] {
    const open = path[0] === path[path.length - 1] ? path.slice(0, -1) : [...path]
    if (open.length === 0) return []
    let best = open
    for (let index = 1; index < open.length; index += 1) {
      const rotated = [...open.slice(index), ...open.slice(0, index)]
      if (rotated.join('\u0000') < best.join('\u0000')) best = rotated
    }
    return [...best, best[0]]
  }
}
