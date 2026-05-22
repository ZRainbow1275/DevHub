import { memo } from 'react'
import type { ScopedTopologyGraph, TopologyScope } from '@shared/topology/scope'
import { RefreshIcon } from '../../icons'

interface ScopeControlsProps {
  scope: TopologyScope
  graph: ScopedTopologyGraph | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}

const SCOPE_LABELS: Record<TopologyScope['kind'], string> = {
  project: '项目范围',
  process: '进程范围',
  port: '端口范围',
  window: '窗口范围',
}

export const ScopeControls = memo(function ScopeControls({ scope, graph, loading, error, onRefresh }: ScopeControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-surface-700 bg-surface-900/70 px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-accent" style={{ fontFamily: 'var(--font-display)' }}>
        关系视图
      </span>
      <span className="text-[10px] text-text-muted">
        {SCOPE_LABELS[scope.kind]} - ID {scope.targetId} - depth={scope.depth}
      </span>
      {graph && (
        <span className="text-[10px] text-text-muted">
          {graph.nodes.length} 节点 - {graph.edges.length} 关系 - {graph.source}
        </span>
      )}
      {error && <span className="text-[10px] text-warning">{error}</span>}
      <button type="button" onClick={onRefresh} disabled={loading} className="ml-auto btn-icon-sm text-text-muted hover:text-text-primary disabled:opacity-50" title="刷新关系视图">
        <RefreshIcon size={13} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  )
})