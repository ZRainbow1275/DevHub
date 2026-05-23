import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AttachedTopologyFavorite, AttachedTopologyFavoriteChangeRequest, AttachedTopologyGraphKind, AttachedTopologyResult, GraphSnapshot } from '@shared/schemas/r8-runtime'
import type { ScopedTopologyEdge, ScopedTopologyGraph, ScopedTopologyNode, TopologyScope } from '@shared/topology/scope'
import { useScopedTopology } from '../../../hooks/useScopedTopology'
import { NeuralGraphWithControls } from '../topology/NeuralGraph'
import type { GraphEdge, GraphNode, NeuralNodeType } from '../topology/NeuralGraphEngine'
import { CheckIcon, RefreshIcon, TopologyIcon } from '../../icons'
import { GraphCanvas } from '../../topology/GraphCanvas'
import { SELECTED_GLOBAL_TOPOLOGY_NODE_KEY, openGlobalTopologyNode } from '../../../utils/globalTopologyNavigation'
import { useT } from '../../../hooks/useT'

interface AttachedGraphViewProps { scope: TopologyScope; className?: string; minHeight?: number }

const FAVORITES_KEY = 'devhub:attached-topology:favorites'
const GRAPH_KINDS: AttachedTopologyGraphKind[] = ['network-topology', 'neural-relationship']
const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

function toNeuralNode(node: ScopedTopologyNode): GraphNode {
  const cpu = typeof node.metadata.cpu === 'number' ? node.metadata.cpu : 0
  const memory = typeof node.metadata.memory === 'number' ? node.metadata.memory : 0
  const nodeType: NeuralNodeType = node.kind === 'port'
    ? node.metadata.state === 'LISTENING' ? 'port-listening' : node.metadata.state === 'ESTABLISHED' ? 'port-established' : 'port'
    : node.kind
  return { id: node.id, label: node.label, nodeType, depth: node.depth, cpu, resourceWeight: node.kind === 'process' ? Math.max(1, memory / 64 + cpu / 10) : 2, metadata: { ...node.metadata, root: node.root } }
}

function toNeuralEdge(edge: ScopedTopologyEdge): GraphEdge {
  return { id: edge.id, source: edge.source, target: edge.target, edgeType: edge.kind, weight: edge.weight }
}

function toStats(graph: ScopedTopologyGraph | null): Array<{ label: string; value: number; color: string }> {
  if (!graph) return []
  return [{ label: 'nodes', value: graph.nodes.length, color: '#c9a227' }, { label: 'edges', value: graph.edges.length, color: '#22c55e' }, { label: 'depth', value: graph.scope.depth, color: '#6b7d8a' }]
}

function readFavorites(): AttachedTopologyFavorite[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(0, 50) as AttachedTopologyFavorite[] : []
  } catch { return [] }
}

function writeFavorites(favorites: AttachedTopologyFavorite[]): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.slice(0, 50)))
}

function favoriteKey(favorite: Pick<AttachedTopologyFavorite, 'scope' | 'targetId' | 'graphKind'>): string {
  return `${favorite.scope}:${String(favorite.targetId)}:${favorite.graphKind}`
}

function statsLabel(snapshot: GraphSnapshot | null, graph: ScopedTopologyGraph | null): string {
  if (snapshot) return `${snapshot.nodes.length} nodes / ${snapshot.edges.length} edges / depth ${snapshot.slice.depth}`
  if (graph) return `${graph.nodes.length} nodes / ${graph.edges.length} edges / depth ${graph.scope.depth}`
  return 'pending'
}

interface LazyExpanderProps {
  expandableNodeIds: string[]
  onExpand: (nodeId: string) => void
}

function LazyExpander({ expandableNodeIds, onExpand }: LazyExpanderProps) {
  const { t } = useT()
  if (expandableNodeIds.length === 0) return null

  return (
    <div data-testid="attached-lazy-expander" className="flex flex-wrap items-center gap-2 border-b border-warning/20 bg-surface-950 px-3 py-2">
      <span className="text-[10px] text-warning">{t('monitor.attached.lazyHint', '+{{count}} more lazy node(s) available. Double-click a placeholder to expand.').replace('{{count}}', String(expandableNodeIds.length))}</span>
      {expandableNodeIds.slice(0, 6).map(nodeId => (
        <button
          key={nodeId}
          type="button"
          data-testid="attached-lazy-placeholder"
          data-node-id={nodeId}
          onDoubleClick={() => onExpand(nodeId)}
          className="btn-secondary px-2 py-1 text-[10px] text-warning"
          title={`Double-click to expand ${nodeId}`}
        >
          +1 more: {nodeId}
        </button>
      ))}
    </div>
  )
}

export const AttachedGraphView = memo(function AttachedGraphView({ scope, className = '', minHeight = 360 }: AttachedGraphViewProps) {
  const { t } = useT()
  const [depth, setDepth] = useState(() => Math.max(3, Math.min(10, scope.depth)))
  const [graphKind, setGraphKind] = useState<AttachedTopologyGraphKind>('network-topology')
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [attached, setAttached] = useState<AttachedTopologyResult | null>(null)
  const [attachedLoading, setAttachedLoading] = useState(false)
  const [attachedError, setAttachedError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<AttachedTopologyFavorite[]>(() => readFavorites())
  const [thumbnailMode, setThumbnailMode] = useState(false)
  const [miniFloatingOpen, setMiniFloatingOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const favoriteAuditVersionRef = useRef(0)
  const legacyScope = useMemo<TopologyScope>(() => ({ ...scope, depth: Math.min(depth, 4) }), [depth, scope])
  const { graph, loading, error, refresh } = useScopedTopology(legacyScope)
  const bridgeAvailable = Boolean(isElectron && window.devhub.r8?.topology?.attachedDeep10)
  const favoriteAuditAvailable = Boolean(isElectron && window.devhub.r8?.topology?.favoriteChange)
  const nodes = useMemo(() => graph?.nodes.map(toNeuralNode) ?? [], [graph])
  const edges = useMemo(() => graph?.edges.map(toNeuralEdge) ?? [], [graph])
  const activeKey = favoriteKey({ scope: scope.kind, targetId: scope.targetId, graphKind })
  const isFavorite = favorites.some(item => favoriteKey(item) === activeKey)

  const loadAttached = useCallback(async () => {
    if (!bridgeAvailable) return
    setAttachedLoading(true)
    setAttachedError(null)
    try {
      const result = await window.devhub.r8.topology.attachedDeep10({ scope: scope.kind, targetId: scope.targetId, graphKind, depth, expandedNodeIds, selectedNodeId, thumbnailMode })
      setAttached(result)
    } catch (err) {
      setAttached(null)
      setAttachedError(err instanceof Error ? err.message : 'attached topology failed')
    } finally { setAttachedLoading(false) }
  }, [bridgeAvailable, depth, expandedNodeIds, graphKind, scope.kind, scope.targetId, selectedNodeId, thumbnailMode])

  useEffect(() => { void loadAttached() }, [loadAttached])
  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => setThumbnailMode((entries[0]?.contentRect.width ?? element.clientWidth) < 480))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!thumbnailMode) setMiniFloatingOpen(false)
  }, [thumbnailMode])

  const recordFavoriteChange = useCallback((request: AttachedTopologyFavoriteChangeRequest) => {
    if (!favoriteAuditAvailable) return
    const version = favoriteAuditVersionRef.current + 1
    favoriteAuditVersionRef.current = version
    void window.devhub.r8.topology.favoriteChange(request).catch(err => {
      if (favoriteAuditVersionRef.current !== version) return
      setAttachedError(err instanceof Error ? err.message : 'attached favorite audit failed')
    })
  }, [favoriteAuditAvailable])

  const toggleFavorite = useCallback(() => {
    const existingFavorite = favorites.find(item => favoriteKey(item) === activeKey)
    const favorite = existingFavorite ?? { label: `${scope.kind}:${String(scope.targetId)}`, scope: scope.kind, targetId: scope.targetId, graphKind, pinnedAt: Date.now() }
    const action = isFavorite ? 'unpin' : 'pin'
    const next = isFavorite ? favorites.filter(item => favoriteKey(item) !== activeKey) : [favorite, ...favorites].slice(0, 50)
    setFavorites(next)
    writeFavorites(next)
    recordFavoriteChange({
      action,
      favorite,
      previousFavoriteCount: favorites.length,
      nextFavoriteCount: next.length,
      selectedNodeId
    })
  }, [activeKey, favorites, graphKind, isFavorite, recordFavoriteChange, scope.kind, scope.targetId, selectedNodeId])

  const openSelectedInGlobalTopology = useCallback(() => {
    if (!selectedNodeId) return
    openGlobalTopologyNode(selectedNodeId)
  }, [selectedNodeId])

  const applyFavorite = useCallback((favorite: AttachedTopologyFavorite) => {
    setGraphKind(favorite.graphKind)
    if (favorite.scope === scope.kind && String(favorite.targetId) === String(scope.targetId)) {
      setDepth(current => Math.max(3, current))
    }
  }, [scope.kind, scope.targetId])

  const expandLazyNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    window.sessionStorage.setItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY, nodeId)
    setExpandedNodeIds(current => current.includes(nodeId) ? current : [...current, nodeId])
  }, [])

  const snapshot = attached?.snapshot ?? null
  const activeLoading = bridgeAvailable ? attachedLoading : loading
  const activeError = bridgeAvailable ? attachedError : error
  const expandableNodeIds = attached?.expandableNodes.filter(nodeId => !expandedNodeIds.includes(nodeId)) ?? []

  return (
    <div ref={containerRef} data-testid="attached-graph-view" data-root-kind={scope.kind} data-root-id={String(scope.targetId)} data-source={snapshot?.source ?? graph?.source ?? 'pending'} data-node-count={snapshot?.nodes.length ?? graph?.nodes.length ?? 0} data-edge-count={snapshot?.edges.length ?? graph?.edges.length ?? 0} data-depth={depth} data-lazy={attached?.lazy ? 'true' : 'false'} className={`overflow-hidden border border-surface-700 bg-surface-950 radius-sm ${className}`} style={{ minHeight }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-700 bg-surface-900/70 px-3 py-2">
        <TopologyIcon size={13} className="text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent" style={{ fontFamily: 'var(--font-display)' }}>{t('monitor.attached.title', 'Attached topology')}</span>
        <span className="text-[10px] text-text-muted">{scope.kind} ID {String(scope.targetId)}</span>
        <span className="text-[10px] text-text-muted">{statsLabel(snapshot, graph)}</span>
        {activeError && <span className="text-[10px] text-warning">{activeError}</span>}
        <button type="button" onClick={() => { if (bridgeAvailable) { void loadAttached() } else { void refresh() } }} disabled={activeLoading} className="ml-auto btn-icon-sm text-text-muted hover:text-text-primary disabled:opacity-50" title="Refresh attached topology">
          <RefreshIcon size={13} className={activeLoading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-surface-800 bg-surface-950 px-3 py-2">
        {GRAPH_KINDS.map(kind => (
          <button key={kind} type="button" data-testid={`attached-kind-${kind}`} onClick={() => setGraphKind(kind)} className={`btn-secondary px-2 py-1 text-[10px] ${graphKind === kind ? 'border-accent text-accent' : ''}`}>{kind === 'network-topology' ? 'Network' : 'Neural'}</button>
        ))}
        <label className="flex min-w-[220px] items-center gap-2 text-[10px] text-text-muted">
          depth
          <input data-testid="attached-depth-slider" type="range" min={1} max={10} value={depth} onChange={event => setDepth(Number(event.currentTarget.value))} className="flex-1 accent-[var(--accent)]" />
          <span className="w-5 text-right text-accent">{depth}</span>
        </label>
        <span className="text-[9px] uppercase tracking-wider text-text-muted">1 / 3 / 7 / 10</span>
        <button type="button" data-testid="attached-open-global-button" onClick={openSelectedInGlobalTopology} disabled={!selectedNodeId} className="btn-secondary ml-auto px-2 py-1 text-[10px] disabled:opacity-40">
          View selected globally
        </button>
        <button type="button" data-testid="attached-favorite-button" onClick={toggleFavorite} className={`btn-secondary flex items-center gap-1 px-2 py-1 text-[10px] ${isFavorite ? 'border-accent text-accent' : ''}`}>
          <CheckIcon size={12} />{isFavorite ? 'Pinned' : 'Pin view'}
        </button>
      </div>
      {favorites.length > 0 && (
        <div data-testid="attached-favorites-menu" className="flex flex-wrap gap-2 border-b border-surface-800 bg-surface-950 px-3 py-2">
          {favorites.slice(0, 6).map(favorite => (
            <button key={favoriteKey(favorite)} type="button" className="btn-secondary px-2 py-1 text-[10px]" onClick={() => applyFavorite(favorite)}>
              {favorite.label} / {favorite.graphKind === 'network-topology' ? 'Network' : 'Neural'}
            </button>
          ))}
        </div>
      )}
      {thumbnailMode && (
        <details data-testid="attached-mini-thumbnail" className="border-b border-surface-800 bg-surface-900/60 px-3 py-2 text-[10px] text-text-muted">
          <summary className="cursor-pointer text-text-secondary">Mini thumbnail mode is active below 480px. Expand attached card.</summary>
          <div data-testid="attached-mini-expanded-card" className="mt-2 flex items-center justify-between gap-2 border border-surface-700 bg-surface-950 p-2 text-text-muted radius-sm">
            <span>{statsLabel(snapshot, graph)}</span>
            <button
              type="button"
              data-testid="attached-mini-popout-button"
              aria-label="Expand attached mini topology floating card"
              onClick={() => setMiniFloatingOpen(true)}
              className="btn-secondary px-2 py-1 text-[10px]"
            >
              Expand floating card
            </button>
          </div>
        </details>
      )}
      {miniFloatingOpen && (
        <div
          role="dialog"
          aria-label="Attached mini topology floating card"
          data-testid="attached-mini-floating-card"
          className="fixed bottom-6 right-6 z-50 w-[min(420px,calc(100vw-48px))] border border-accent/50 bg-surface-950 p-3 text-[10px] text-text-muted shadow-elevated radius-sm"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TopologyIcon size={13} className="text-accent" />
              <span className="truncate font-bold uppercase tracking-wider text-accent" style={{ fontFamily: 'var(--font-display)' }}>{t('monitor.attached.miniTitle', 'Attached mini graph')}</span>
            </div>
            <button
              type="button"
              data-testid="attached-mini-floating-close"
              aria-label="Close attached mini topology floating card"
              onClick={() => setMiniFloatingOpen(false)}
              className="btn-secondary px-2 py-1 text-[10px]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border-l-2 border-accent bg-surface-900 px-2 py-1 radius-sm">scope: {scope.kind}</div>
            <div className="border-l-2 border-surface-600 bg-surface-900 px-2 py-1 radius-sm">target: {String(scope.targetId)}</div>
            <div className="border-l-2 border-info bg-surface-900 px-2 py-1 radius-sm">{graphKind === 'network-topology' ? 'Network' : 'Neural'}</div>
            <div className="border-l-2 border-warning bg-surface-900 px-2 py-1 radius-sm">{statsLabel(snapshot, graph)}</div>
          </div>
        </div>
      )}
      {depth >= 8 && <div data-testid="attached-lazy-banner" className="border-b border-warning/30 bg-warning/10 px-3 py-2 text-[10px] text-warning">Lazy mode is active for depth 8-10. {attached?.truncatedAtDepth ? `Current fetch is truncated at depth ${attached.truncatedAtDepth}.` : 'Click a node to expand its subtree.'}</div>}
      <LazyExpander expandableNodeIds={expandableNodeIds} onExpand={expandLazyNode} />
      {bridgeAvailable ? (
        <div style={{ height: Math.max(minHeight - 124, 280), minHeight: 280 }}>
          <GraphCanvas snapshot={snapshot} focusNodeId={selectedNodeId} onNodeClick={node => expandLazyNode(node.id)} />
        </div>
      ) : (
        <div style={{ height: minHeight - 86, minHeight: 260 }}>
          <NeuralGraphWithControls title={loading ? 'SCOPED GRAPH - LOADING' : 'SCOPED GRAPH'} nodes={nodes} edges={edges} stats={toStats(graph)} emptyMessage="No relationships for the current scope" config={{ centerStrength: 0.06, chargeStrength: -90, linkDistanceOther: 100 }} />
        </div>
      )}
    </div>
  )
})
