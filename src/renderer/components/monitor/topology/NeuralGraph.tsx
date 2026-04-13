/**
 * NeuralGraph — React wrapper for NeuralGraphEngine.
 *
 * Renders a force-directed neural relationship graph with:
 *   - SVG nodes + animated dash edges
 *   - Hover highlight, click focus, drag, zoom
 *   - Enter/exit animations for new/removed nodes
 */

import { useEffect, useRef, useCallback, useState, memo } from 'react'
import { NeuralGraphEngine, type GraphNode, type GraphEdge, type NeuralForceConfig } from './NeuralGraphEngine'
import { SearchIcon, RefreshIcon, CloseIcon } from '../../icons'

// ============ Types ============

export interface NeuralGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Optional force config overrides */
  config?: Partial<NeuralForceConfig>
  /** Called when user clicks a node */
  onNodeClick?: (node: GraphNode) => void
  /** Called when user hovers a node */
  onNodeHover?: (node: GraphNode | null) => void
  /** Called on right-click context menu */
  onContextMenu?: (node: GraphNode, event: MouseEvent) => void
  /** If set, the engine will focus (zoom to) this node */
  focusNodeId?: string | null
  /** Extra class for the container */
  className?: string
}

// ============ Component ============

export const NeuralGraph = memo(function NeuralGraph({
  nodes,
  edges,
  config,
  onNodeClick,
  onNodeHover,
  onContextMenu,
  focusNodeId,
  className = ''
}: NeuralGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<NeuralGraphEngine | null>(null)

  // Initialize engine on mount
  useEffect(() => {
    if (!containerRef.current) return

    const engine = new NeuralGraphEngine(containerRef.current, config)
    engineRef.current = engine

    return () => {
      engine.destroy()
      engineRef.current = null
    }
    // config is an object - use JSON stable key to avoid re-creating engine on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update data when nodes/edges change
  useEffect(() => {
    if (!engineRef.current) return
    engineRef.current.setData(nodes, edges)
  }, [nodes, edges])

  // Wire callbacks
  useEffect(() => {
    if (!engineRef.current) return
    engineRef.current.onNodeClick((node) => onNodeClick?.(node))
  }, [onNodeClick])

  useEffect(() => {
    if (!engineRef.current) return
    engineRef.current.onNodeHover((node) => onNodeHover?.(node))
  }, [onNodeHover])

  useEffect(() => {
    if (!engineRef.current) return
    engineRef.current.onContextMenu((node, event) => onContextMenu?.(node, event))
  }, [onContextMenu])

  // Focus a node
  useEffect(() => {
    if (!engineRef.current || !focusNodeId) return
    engineRef.current.focusNode(focusNodeId)
  }, [focusNodeId])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current || !engineRef.current) return
    const observer = new ResizeObserver(() => {
      engineRef.current?.resize()
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      style={{ minHeight: 200 }}
    />
  )
})

// ============ NeuralGraph With Controls ============

export interface NeuralGraphWithControlsProps extends NeuralGraphProps {
  /** Title displayed in the top-left */
  title?: string
  /** Stats to display */
  stats?: Array<{ label: string; value: number; color: string }>
  /** Show search bar */
  showSearch?: boolean
  /** Empty state message */
  emptyMessage?: string
}

export const NeuralGraphWithControls = memo(function NeuralGraphWithControls({
  title = 'NEURAL GRAPH',
  stats,
  showSearch = true,
  emptyMessage = 'No topology data available',
  nodes,
  edges,
  onNodeClick,
  onNodeHover,
  onContextMenu,
  focusNodeId: externalFocus,
  config,
  className = '',
}: NeuralGraphWithControlsProps) {
  const engineContainerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<NeuralGraphEngine | null>(null)
  const [search, setSearch] = useState('')
  const [focusNodeId, setFocusNodeId] = useState<string | null>(externalFocus ?? null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [legendCollapsed, setLegendCollapsed] = useState(false)

  // Keep latest callbacks in refs to avoid stale closure issues in engine init
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeHoverRef = useRef(onNodeHover)
  const onContextMenuRef = useRef(onContextMenu)
  useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])
  useEffect(() => { onNodeHoverRef.current = onNodeHover }, [onNodeHover])
  useEffect(() => { onContextMenuRef.current = onContextMenu }, [onContextMenu])

  // Latest nodes/edges in ref so tryInit closure can access them without deps
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  // Initialize engine — wait until the container has non-zero dimensions.
  // engineContainerRef is ALWAYS rendered so this effect reliably gets a non-null ref.
  useEffect(() => {
    const container = engineContainerRef.current
    if (!container) return

    let engine: NeuralGraphEngine | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function tryInit(): void {
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        engine = new NeuralGraphEngine(container, config)
        engineRef.current = engine

        // Bind callbacks via refs so they're always current
        engine.onNodeClick((node) => {
          setSelectedNode(node)
          onNodeClickRef.current?.(node)
        })
        engine.onNodeHover((node) => onNodeHoverRef.current?.(node))
        engine.onContextMenu((node, event) => onContextMenuRef.current?.(node, event))

        // Apply current data immediately if available
        const currentNodes = nodesRef.current
        const currentEdges = edgesRef.current
        if (currentNodes.length > 0 || currentEdges.length > 0) {
          engine.setData(currentNodes, currentEdges)
        }
      } else {
        // Container not yet sized — retry via rAF then timeout
        requestAnimationFrame(() => {
          retryTimer = setTimeout(tryInit, 100)
        })
      }
    }

    tryInit()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (engine) {
        engine.destroy()
        engineRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync data when nodes/edges change (after engine is initialized)
  useEffect(() => {
    if (!engineRef.current) return
    engineRef.current.setData(nodes, edges)
  }, [nodes, edges])

  // Focus external
  useEffect(() => {
    if (externalFocus) setFocusNodeId(externalFocus)
  }, [externalFocus])

  useEffect(() => {
    if (!engineRef.current || !focusNodeId) return
    engineRef.current.focusNode(focusNodeId)
  }, [focusNodeId])

  // Resize
  useEffect(() => {
    if (!engineContainerRef.current) return
    const observer = new ResizeObserver(() => engineRef.current?.resize())
    observer.observe(engineContainerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleResetView = useCallback(() => {
    engineRef.current?.resetView()
    setSelectedNode(null)
    setFocusNodeId(null)
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    if (!query.trim()) return
    const q = query.trim().toLowerCase()
    const match = nodes.find(n =>
      n.label.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q) ||
      String(n.metadata?.pid ?? '').includes(q) ||
      String(n.metadata?.port ?? '').includes(q)
    )
    if (match) {
      setFocusNodeId(match.id)
    }
  }, [nodes])

  const isEmpty = nodes.length === 0

  return (
    <div className={`h-full flex flex-col bg-surface-950 ${className}`}>
      {/* Stats Bar */}
      {stats && stats.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-surface-900/50 border-b border-surface-700/30">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-2 h-2 radius-sm" style={{ backgroundColor: s.color }} />
              <span>
                {s.label}: <span className="text-text-primary font-bold">{s.value}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-surface-700/30 bg-surface-900/30">
        <span
          className="text-xs font-bold text-text-secondary uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </span>
        <div className="flex-1" />

        {showSearch && (
          <div className="relative">
            <input
              type="text"
              placeholder="搜索节点..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="input-sm w-40 pl-8 text-xs"
            />
            <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
        )}

        <button
          onClick={handleResetView}
          className="btn-icon-sm text-text-muted hover:text-text-primary hover:bg-surface-700 transition-all duration-200"
          title="重置视图"
        >
          <RefreshIcon size={14} />
        </button>
      </div>

      {/* Graph Area — engineContainerRef div is ALWAYS rendered so the engine
          can initialize on mount. The empty-state overlay is positioned on top. */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '400px' }}>
        {/* Engine canvas — always rendered */}
        <div ref={engineContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />

        {/* Empty state overlay */}
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-surface-950 z-10">
            <div
              className="w-16 h-16 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-surface-600 radius-sm"
            >
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="square" strokeLinejoin="miter" className="text-text-muted">
                <rect x="2" y="2" width="6" height="6" />
                <rect x="16" y="2" width="6" height="6" />
                <rect x="9" y="16" width="6" height="6" />
                <path d="M8 5h8M5 8v5l4 3M19 8v5l-4 3" />
              </svg>
            </div>
            <h3
              className="text-lg font-bold text-text-primary mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {emptyMessage}
            </h3>
            <p className="text-text-muted text-sm">等待系统扫描...</p>
          </div>
        )}

        {/* Mini detail overlay */}
        {!isEmpty && selectedNode && (
          <div
            className="absolute right-2 top-2 w-56 bg-surface-900 border-l-3 border-accent p-3 z-20 text-xs radius-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-text-primary uppercase tracking-wider text-[10px]">
                {selectedNode.nodeType.toUpperCase()}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-primary"
              >
                <CloseIcon size={12} />
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted">标签</span>
                <span className="text-text-primary font-mono truncate ml-2 max-w-[120px]">{selectedNode.label}</span>
              </div>
              {selectedNode.metadata?.pid !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-muted">PID</span>
                  <span className="text-text-primary font-mono">{String(selectedNode.metadata.pid)}</span>
                </div>
              )}
              {selectedNode.metadata?.port !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-muted">端口</span>
                  <span className="text-text-primary font-mono">:{String(selectedNode.metadata.port)}</span>
                </div>
              )}
              {selectedNode.cpu !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-muted">CPU</span>
                  <span className="text-text-primary font-mono">{selectedNode.cpu.toFixed(1)}%</span>
                </div>
              )}
              {selectedNode.metadata?.memory !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-muted">内存</span>
                  <span className="text-text-primary font-mono">{Number(selectedNode.metadata.memory).toFixed(1)}MB</span>
                </div>
              )}
              {selectedNode.metadata?.state !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-muted">状态</span>
                  <span className="text-text-primary font-mono">{String(selectedNode.metadata.state)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend panel */}
        {!isEmpty && (
          <div
            className="absolute left-2 bottom-2 bg-surface-900/90 border-l-3 border-surface-600 p-2.5 z-10 text-[10px] radius-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-text-secondary uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}>
                图例
              </span>
              <button
                type="button"
                onClick={() => setLegendCollapsed((v) => !v)}
                className="text-text-muted hover:text-text-primary px-1 py-0.5 font-mono text-[10px]"
                title={legendCollapsed ? '展开' : '收起'}
              >
                {legendCollapsed ? '+' : '−'}
              </button>
            </div>
            {!legendCollapsed && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 inline-block rounded-full" style={{ backgroundColor: '#d64545' }} />
                  <span className="text-text-muted">项目</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 inline-block rounded-full" style={{ backgroundColor: '#c9a227' }} />
                  <span className="text-text-muted">进程</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block"
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#c9a227',
                      transform: 'rotate(45deg)'
                    }}
                  />
                  <span className="text-text-muted">端口 (LISTENING)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block"
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#3b82f6',
                      transform: 'rotate(45deg)'
                    }}
                  />
                  <span className="text-text-muted">端口 (ESTABLISHED)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block"
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#6b7280',
                      transform: 'rotate(45deg)'
                    }}
                  />
                  <span className="text-text-muted">端口 (TIME_WAIT)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: '#6b7d8a' }} />
                  <span className="text-text-muted">窗口</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 inline-block rounded-full border border-dashed"
                    style={{ borderColor: '#f59e0b', backgroundColor: 'transparent' }}
                  />
                  <span className="text-text-muted">外部连接</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
