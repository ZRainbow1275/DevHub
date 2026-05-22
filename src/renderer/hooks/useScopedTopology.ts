import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildScopedFlow, buildScopedTopologyGraph, type ScopedFlow, type ScopedTopologyGraph, type TopologyScope } from '@shared/topology/scope'
import { usePortStore } from '../stores/portStore'
import { useProcessStore } from '../stores/processStore'
import { useWindowStore } from '../stores/windowStore'
import { useProjectStore } from '../stores/projectStore'

interface UseScopedTopologyResult {
  graph: ScopedTopologyGraph | null
  flow: ScopedFlow | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useScopedTopology(scope: TopologyScope): UseScopedTopologyResult {
  const processes = useProcessStore((state) => state.processes)
  const ports = usePortStore((state) => state.ports)
  const windows = useWindowStore((state) => state.windows)
  const projects = useProjectStore((state) => state.projects)
  const [graph, setGraph] = useState<ScopedTopologyGraph | null>(null)
  const [flow, setFlow] = useState<ScopedFlow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stableScope = useMemo(() => ({ kind: scope.kind, targetId: scope.targetId, depth: scope.depth }), [scope.depth, scope.kind, scope.targetId])
  const localSnapshot = useMemo(() => ({ projects, processes, ports, windows }), [ports, processes, projects, windows])

  const buildFromRendererStore = useCallback(() => {
    const localGraph = buildScopedTopologyGraph(stableScope, localSnapshot, 'renderer-store')
    return { graph: localGraph, flow: buildScopedFlow(localGraph) }
  }, [localSnapshot, stableScope])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (isElectron && window.devhub.topology?.buildScopedGraph && window.devhub.topology?.buildScopedFlow) {
        const [remoteGraph, remoteFlow] = await Promise.all([
          window.devhub.topology.buildScopedGraph(stableScope),
          window.devhub.topology.buildScopedFlow(stableScope),
        ])

        if (remoteGraph.nodes.length > 0 || remoteFlow.steps.length > 0) {
          setGraph(remoteGraph)
          setFlow(remoteFlow)
          return
        }
      }

      const local = buildFromRendererStore()
      setGraph(local.graph)
      setFlow(local.flow)
    } catch (err) {
      const local = buildFromRendererStore()
      setGraph(local.graph)
      setFlow(local.flow)
      setError(err instanceof Error ? err.message : '关系视图构建失败，已使用渲染层快照降级')
    } finally {
      setLoading(false)
    }
  }, [buildFromRendererStore, stableScope])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { graph, flow, loading, error, refresh }
}
