import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GraphExportFormat, GraphKind, GraphLayout, GraphSavedSnapshot, GraphSlice, GraphSnapshot } from '@shared/schemas/r8-runtime'
import { AlertIcon, NetworkIcon, RefreshIcon } from '../icons'
import { GraphCanvas, type GraphCanvasHandle } from './GraphCanvas'
import { GraphExportMenu } from './GraphExportMenu'
import { GraphKindSwitcher } from './GraphKindSwitcher'
import { GraphLayoutMenu } from './GraphLayoutMenu'
import { GraphSliceMenu } from './GraphSliceMenu'
import { GraphTimeCursor } from './GraphTimeCursor'
import {
  OPEN_GLOBAL_TOPOLOGY_EVENT,
  parseGlobalTopologyGraphKind,
  readPendingGlobalTopologyGraphKind,
  readPendingGlobalTopologyNodeId
} from '../../utils/globalTopologyNavigation'
import { useT } from '../../hooks/useT'

type ScopeValue = GraphSlice['scope']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function graphKindFromOpenEvent(event: Event): GraphKind | null {
  if (!(event instanceof CustomEvent) || !isRecord(event.detail)) return null
  return parseGlobalTopologyGraphKind(event.detail.graphKind)
}

function parseTargetIds(value: string): Array<string | number> {
  return value.split(',').map(part => part.trim()).filter(Boolean).map(part => /^\d+$/.test(part) ? Number(part) : part)
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function nodePid(node: GraphSnapshot['nodes'][number] | null): number | null {
  const value = node?.meta.pid
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
      <span className="text-text-muted">{label}</span>
      <span className="truncate font-mono text-text-primary" title={String(value)}>{value}</span>
    </div>
  )
}

export function FullScreenTopologyView() {
  const { t } = useT()
  const [graphKind, setGraphKind] = useState<GraphKind>(() => readPendingGlobalTopologyGraphKind() ?? 'network-topology')
  const [layout, setLayout] = useState<GraphLayout>('dagre')
  const [scope, setScope] = useState<ScopeValue>('global')
  const [targetIdsText, setTargetIdsText] = useState('')
  const [depth, setDepth] = useState(3)
  const [asOfTs, setAsOfTs] = useState<number | null>(null)
  const [expandAll, setExpandAll] = useState(false)
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null)
  const [savedSnapshots, setSavedSnapshots] = useState<GraphSavedSnapshot[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => readPendingGlobalTopologyNodeId())
  const [selectedNode, setSelectedNode] = useState<GraphSnapshot['nodes'][number] | null>(null)
  const [saveLabel, setSaveLabel] = useState('')
  const [confirmedBy, setConfirmedBy] = useState('operator')
  const [exportResult, setExportResult] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const graphCanvasRef = useRef<GraphCanvasHandle | null>(null)

  const slice = useMemo<GraphSlice>(() => ({ scope, targetIds: parseTargetIds(targetIdsText), graphKind, depth, asOfTs, expandAll, layout, selectedNodeId }), [asOfTs, depth, expandAll, graphKind, layout, scope, selectedNodeId, targetIdsText])

  const refreshSnapshots = useCallback(async () => {
    setSavedSnapshots(await window.devhub.r8.topology.listSnapshots())
  }, [])

  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const nextSnapshot = graphKind === 'network-topology'
        ? await window.devhub.r8.topology.network(slice)
        : graphKind === 'neural-relationship'
          ? await window.devhub.r8.topology.neural(slice)
          : await window.devhub.r8.topology.buildGlobalGraph(slice)
      setSnapshot(nextSnapshot)
      const nextSelectedNodeId = nextSnapshot.slice.selectedNodeId ?? selectedNodeId
      setSelectedNode(nextSelectedNodeId ? nextSnapshot.nodes.find(node => node.id === nextSelectedNodeId) ?? null : null)
      setError(null)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [graphKind, selectedNodeId, slice])

  useEffect(() => { void loadGraph() }, [loadGraph])
  useEffect(() => { void refreshSnapshots().catch(() => undefined) }, [refreshSnapshots])
  useEffect(() => {
    const handleGlobalTopologyOpen = (event: Event) => {
      const eventGraphKind = graphKindFromOpenEvent(event)
      const pendingGraphKind = readPendingGlobalTopologyGraphKind()
      const nextGraphKind = eventGraphKind ?? pendingGraphKind
      if (nextGraphKind) setGraphKind(nextGraphKind)
      const nextSelectedNodeId = readPendingGlobalTopologyNodeId()
      if (nextSelectedNodeId) {
        setSelectedNodeId(nextSelectedNodeId)
        setSelectedNode(null)
      }
    }
    window.addEventListener(OPEN_GLOBAL_TOPOLOGY_EVENT, handleGlobalTopologyOpen)
    return () => window.removeEventListener(OPEN_GLOBAL_TOPOLOGY_EVENT, handleGlobalTopologyOpen)
  }, [])

  const saveSnapshot = async () => {
    if (!snapshot) return
    const label = saveLabel.trim() || `topology-${snapshot.slice.graphKind}-${snapshot.generatedAt}`
    await window.devhub.r8.topology.saveSnapshot(snapshot.snapshotId, label, confirmedBy)
    setSaveLabel(label)
    await refreshSnapshots()
  }

  const exportSnapshot = async (format: GraphExportFormat) => {
    if (!snapshot) return
    try {
      const result = format === 'png'
        ? await graphCanvasRef.current?.exportPng()
        : await window.devhub.r8.topology.export(snapshot.snapshotId, format)
      if (!result) throw new Error('E_RUNTIME:png renderer canvas unavailable')
      setExportResult(result.content)
      setExportError(null)
    } catch (reason) {
      setExportError(errorMessage(reason))
      setExportResult(null)
    }
  }

  const openProcessDetail = () => {
    const pid = nodePid(selectedNode)
    if (pid === null) return
    window.dispatchEvent(new CustomEvent('devhub:open-monitor'))
    window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'process', scope: { kind: 'process', targetId: pid, depth: 2 } } }))
  }

  const selectGraphNode = useCallback((node: GraphSnapshot['nodes'][number]) => {
    setSelectedNodeId(node.id)
    setSelectedNode(node)
  }, [])

  const warnings = snapshot?.warnings ?? []
  const isLimited = snapshot?.degraded || warnings.some(warning => warning.code === 'E_GRAPH_NODE_LIMIT')

  return (
    <div data-testid="full-screen-topology-view" className="h-full overflow-hidden bg-surface-950 text-text-primary">
      <div className="flex h-full flex-col">
        <header className="flex-shrink-0 border-b-2 border-surface-700 bg-surface-900/90 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <NetworkIcon size={20} className="text-accent" />
              <div>
                <h2 className="text-gold font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>全局拓扑</h2>
                <p className="text-xs text-text-muted">本地 scanner cache / process / port / window / project / AI task 关系图，不外发数据。</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { void loadGraph() }} disabled={loading}>
                <RefreshIcon size={14} />刷新
              </button>
              <GraphExportMenu disabled={!snapshot} onExport={format => { void exportSnapshot(format) }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GraphKindSwitcher value={graphKind} onChange={setGraphKind} />
            <GraphLayoutMenu value={layout} onChange={setLayout} />
            <GraphSliceMenu scope={scope} targetIdsText={targetIdsText} depth={depth} onScopeChange={setScope} onTargetIdsTextChange={setTargetIdsText} onDepthChange={setDepth} />
            <GraphTimeCursor value={asOfTs} onChange={setAsOfTs} />
          </div>
        </header>
        {(error || isLimited || exportError) && (
          <div className="flex-shrink-0 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
            <div className="flex flex-wrap items-center gap-2">
              <AlertIcon size={14} />
              {error && <span>{error}</span>}
              {isLimited && <span>节点数超限，请按 process/port/project 切片；确需全量可展开全部。</span>}
              {exportError && <span>{exportError}</span>}
              {isLimited && !expandAll && (
                <button type="button" className="btn-secondary px-2 py-1 text-[10px]" onClick={() => { setExpandAll(true); setLayout('cose-bilkent') }}>展开全部</button>
              )}
            </div>
          </div>
        )}
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-4 p-4">
          <GraphCanvas ref={graphCanvasRef} snapshot={snapshot} focusNodeId={selectedNodeId ?? selectedNode?.id ?? null} onNodeClick={selectGraphNode} />
          <aside className="min-h-0 overflow-y-auto border border-surface-700 bg-surface-900/70 p-4 radius-md">
            <section className="mb-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-accent">当前快照</div>
              <div className="space-y-2 text-xs">
                <Fact label="Snapshot" value={snapshot?.snapshotId ?? 'pending'} />
                <Fact label="GraphKind" value={snapshot?.slice.graphKind ?? graphKind} />
                <Fact label="Nodes" value={snapshot?.nodes.length ?? 0} />
                <Fact label="Edges" value={snapshot?.edges.length ?? 0} />
                <Fact label="Source" value={snapshot?.source ?? 'scanner-cache'} />
                <Fact label="Historical" value={asOfTs === null ? 'current' : String(asOfTs)} />
              </div>
            </section>
            <section className="mb-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-accent">节点详情</div>
              {selectedNode ? (
                <div className="space-y-2 text-xs" data-testid="topology-node-detail">
                  <Fact label="ID" value={selectedNode.id} />
                  <Fact label="Kind" value={selectedNode.kind} />
                  <Fact label="Label" value={selectedNode.label} />
                  <Fact label="Signal" value={selectedNode.signals?.state ?? 'live'} />
                  <button type="button" className="btn-secondary w-full" disabled={nodePid(selectedNode) === null} onClick={openProcessDetail}>open in process detail</button>
                </div>
              ) : (
                <p className="text-xs text-text-muted">点击图中节点查看详情。</p>
              )}
            </section>
            <section className="mb-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-accent">保存快照</div>
              <div className="space-y-2">
                <input data-testid="graph-save-label" className="input-sm w-full bg-surface-950" placeholder={t('topology.placeholder.snapshotLabel', 'snapshot label')} value={saveLabel} onChange={event => setSaveLabel(event.target.value)} />
                <input data-testid="graph-confirmed-by" className="input-sm w-full bg-surface-950" placeholder={t('topology.placeholder.confirmedBy', 'confirmedBy')} value={confirmedBy} onChange={event => setConfirmedBy(event.target.value)} />
                <button type="button" className="btn-secondary w-full" disabled={!snapshot} onClick={() => { void saveSnapshot() }}>保存当前快照</button>
              </div>
            </section>
            <section className="mb-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-accent">最近快照</div>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs" data-testid="graph-snapshot-list">
                {savedSnapshots.length === 0 ? <span className="text-text-muted">暂无保存记录</span> : savedSnapshots.map(item => (
                  <div key={item.id} className="border border-surface-800 bg-surface-950 p-2 radius-sm">
                    <div className="truncate text-text-primary">{item.label}</div>
                    <div className="font-mono text-[10px] text-text-muted">{item.id}</div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-accent">导出结果</div>
              <textarea data-testid="graph-export-output" className="h-32 w-full resize-none bg-surface-950 p-2 font-mono text-[10px] text-text-secondary radius-sm" readOnly value={exportResult ?? ''} />
            </section>
          </aside>
        </main>
      </div>
    </div>
  )
}
