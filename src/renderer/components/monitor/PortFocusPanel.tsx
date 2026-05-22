/**
 * PortFocusPanel — Detailed focus view for a single port.
 *
 * Features:
 * - Cache-first progressive rendering (instant basic data, then incremental detail)
 * - Skeleton loading (mimics final layout with placeholder blocks)
 * - Stale data warning badge when data comes from cache/timeout
 * - Common port auto-labeling (80=HTTP, 443=HTTPS, etc.)
 * - Port conflict detection highlighting
 */

import { memo, useEffect, useState, useCallback, useRef } from 'react'
import type { PortFocusData, PortInfo, PortDetailIncrementalResult } from '@shared/types-extended'
import type { BlocklistEntry } from '@shared/port-security'
import { buildDefaultBlocklistEntries, classifyPortSecurity, isPortBlocklisted } from '@shared/port-security'
import { CloseIcon, ProcessIcon, PortIcon, GlobeIcon, RefreshIcon, AlertIcon, NetworkIcon, WindowIcon } from '../icons'
import { getPortLabel, getPortSecurityInfo, type PortSecurityInfo } from '../../utils/portLabels'
import { openPortInGlobalTopology } from '../../utils/globalTopologyNavigation'
import { AttachedGraphView } from './attached/AttachedGraphView'
import { AttachedFlowView } from './attached/AttachedFlowView'
import { SecurityTierBadge } from './port/SecurityTierBadge'

// ============ Sub-Components ============

function DetailRow({ label, value, color }: { label: string; value: string | number | undefined; color?: string }) {
  if (value === undefined || value === '') return null
  return (
    <div className="flex items-start justify-between py-1 border-b border-surface-700/50 last:border-0">
      <span className="text-[10px] text-text-muted uppercase tracking-wider flex-shrink-0 mr-3">
        {label}
      </span>
      <span className={`text-[11px] font-mono text-right break-all ${color ?? 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  )
}

/** Skeleton placeholder block that mimics a detail row. */
function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-surface-700/50 last:border-0 animate-pulse">
      <span className="h-2.5 w-12 bg-surface-600 radius-sm" />
      <span className="h-2.5 w-20 bg-surface-600 radius-sm" />
    </div>
  )
}

/** Skeleton placeholder for a section. */
function SkeletonSection({ title, rows = 4 }: { title: string; rows?: number }) {
  return (
    <section>
      <h4
        className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h4>
      <div className="bg-surface-800 p-2 border-l-2 border-surface-600 animate-pulse radius-sm">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </section>
  )
}

/** Stale data warning badge. */
function StaleWarning({ source }: { source: 'cache' | 'timeout' }) {
  const message = source === 'timeout'
    ? '查询超时 - 显示缓存数据'
    : '显示缓存数据'
  return (
    <div
      data-testid="port-stale-warning"
      data-stale-source={source}
      data-stale-position="top"
      className="flex items-center gap-1.5 px-2 py-1 bg-warning/10 border-l-2 border-warning text-[10px] text-warning radius-sm"
    >
      <AlertIcon size={10} />
      <span>{message}</span>
    </div>
  )
}

function TimeoutBanner({
  ageSec,
  lightModeEnabled,
  onRetry,
  onToggleLightMode
}: {
  ageSec: number | null
  lightModeEnabled: boolean
  onRetry: () => void
  onToggleLightMode: (enabled: boolean) => void
}) {
  const description = lightModeEnabled
    ? '已切换到轻量模式 - 当前仅显示最近一次扫描快照'
    : `查询超时 - 当前显示${ageSec !== null ? ` ${ageSec} 秒前的` : ''}缓存数据`

  return (
    <div
      data-testid="port-timeout-banner"
      className="flex flex-col gap-2 px-2.5 py-2 bg-warning/10 border-l-2 border-warning text-[10px] text-warning radius-sm"
    >
      <div className="flex items-start gap-1.5">
        <AlertIcon size={10} className="mt-0.5 flex-shrink-0" />
        <span>{description}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          data-testid="port-timeout-retry-button"
          onClick={onRetry}
          className="px-2 py-1 bg-surface-800 hover:bg-surface-700 text-text-primary border border-surface-600 transition-colors radius-sm"
        >
          重试
        </button>
        <label className="flex items-center gap-1.5 text-text-secondary">
          <input
            data-testid="port-light-mode-toggle"
            aria-label="切换到轻量模式"
            type="checkbox"
            checked={lightModeEnabled}
            onChange={(event) => onToggleLightMode(event.target.checked)}
          />
          <span>切换到轻量模式</span>
        </label>
      </div>
    </div>
  )
}

const STATE_COLORS: Record<string, { text: string; bg: string }> = {
  LISTENING:    { text: 'text-success', bg: 'bg-success' },
  ESTABLISHED:  { text: 'text-accent', bg: 'bg-accent' },
  TIME_WAIT:    { text: 'text-warning', bg: 'bg-warning' },
  CLOSE_WAIT:   { text: 'text-error', bg: 'bg-error' }
}

// ============ Main Component ============

interface PortFocusPanelProps {
  port: PortInfo
  onClose: () => void
  onFocusProcess?: (pid: number) => void
  onViewInGraph?: (port: number) => void
  /** Original full-scan focus data API (kept for compatibility). */
  getPortFocusData: (port: number) => Promise<PortFocusData | null>
  /** Incremental cache-first API (preferred when available). */
  getPortDetailIncremental?: (port: number) => Promise<PortDetailIncrementalResult>
  /** Cancel ongoing query for a port. */
  cancelPortQuery?: (port: number) => Promise<boolean>
  /** All ports for conflict detection. */
  allPorts?: PortInfo[]
  /** Last successful port list scan time, used to explain stale cache age. */
  lastScanTime?: Date | null
  blocklistEntries?: readonly BlocklistEntry[]
}

export const PortFocusPanel = memo(function PortFocusPanel({
  port,
  onClose,
  onFocusProcess,
  onViewInGraph,
  getPortFocusData,
  getPortDetailIncremental,
  cancelPortQuery,
  allPorts,
  lastScanTime = null,
  blocklistEntries = buildDefaultBlocklistEntries()
}: PortFocusPanelProps) {
  const [focusData, setFocusData] = useState<PortFocusData | null>(null)
  const [isLoadingFull, setIsLoadingFull] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'cache' | 'incremental' | 'timeout' | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [cachedAgeSec, setCachedAgeSec] = useState<number | null>(null)
  const [queryMode, setQueryMode] = useState<'full' | 'light'>('full')
  const [detachState, setDetachState] = useState<'idle' | 'working' | 'detached' | 'unavailable' | 'failed'>('idle')
  const portRef = useRef(port.port)
  const attachedTopologySectionRef = useRef<HTMLElement | null>(null)

  // Detect conflicts: multiple processes listening on same port
  const conflictingProcesses = allPorts
    ?.filter(p => p.port === port.port && p.state === 'LISTENING')
    .filter((p, i, arr) => arr.findIndex(x => x.pid === p.pid) === i) ?? []
  const hasConflict = conflictingProcesses.length > 1

  const buildLightweightFocusData = useCallback((): PortFocusData => ({
    port,
    process: null,
    siblingPorts: (allPorts ?? []).filter((candidate) => candidate.pid === port.pid && candidate.port !== port.port),
    connections: [],
    processChildren: []
  }), [allPorts, port])

  const loadData = useCallback(async () => {
    const currentPort = port.port
    portRef.current = currentPort
    setError(null)
    setIsLoadingFull(true)
    setDataSource(null)
    setIsStale(false)
    setCachedAgeSec(lastScanTime ? Math.max(0, Math.floor((Date.now() - lastScanTime.getTime()) / 1000)) : null)

    if (queryMode === 'light') {
      setFocusData(buildLightweightFocusData())
      setDataSource('cache')
      setIsStale(true)
      setIsLoadingFull(false)
      return
    }

    try {
      if (getPortDetailIncremental) {
        // Cache-first incremental strategy
        const result = await getPortDetailIncremental(currentPort)
        // Check if user already switched to a different port
        if (portRef.current !== currentPort) return

        setFocusData(result.data ?? buildLightweightFocusData())
        setDataSource(result.source)
        setIsStale(result.isStale)
      } else {
        // Fallback to original full-scan API
        const data = await getPortFocusData(currentPort)
        if (portRef.current !== currentPort) return
        setFocusData(data)
        setDataSource('incremental')
        setIsStale(false)
      }
    } catch (err) {
      if (portRef.current !== currentPort) return
      setError(err instanceof Error ? err.message : 'Failed to load port data')
    } finally {
      if (portRef.current === currentPort) {
        setIsLoadingFull(false)
      }
    }
  }, [port.port, lastScanTime, queryMode, buildLightweightFocusData, getPortFocusData, getPortDetailIncremental])

  useEffect(() => {
    loadData()
    return () => {
      // Cancel query when unmounting or switching port
      if (cancelPortQuery) {
        cancelPortQuery(portRef.current)
      }
    }
  }, [loadData, cancelPortQuery])

  const stateColor = STATE_COLORS[port.state] ?? { text: 'text-text-muted', bg: 'bg-surface-500' }
  const portLabel = getPortLabel(port.port)
  const showTimeoutBanner = dataSource === 'timeout' || queryMode === 'light'

  const handleRetry = useCallback(() => {
    if (queryMode === 'full') {
      void loadData()
      return
    }

    setQueryMode('full')
  }, [loadData, queryMode])

  const handleToggleLightMode = useCallback((enabled: boolean) => {
    setQueryMode(enabled ? 'light' : 'full')
  }, [])

  // Port security classification
  const isExternalFacing = port.localAddress
    ? !port.localAddress.startsWith('127.0.0.1') && !port.localAddress.startsWith('localhost') && !port.localAddress.startsWith('[::1]')
    : false
  const portSecurity: PortSecurityInfo = getPortSecurityInfo(port.port, isExternalFacing)
  const securityTier = classifyPortSecurity({
    port: port.port,
    address: port.localAddress,
    blocklisted: isPortBlocklisted(port.port, port.localAddress, blocklistEntries)
  })

  // Show skeleton for sections that need incremental data, but always show basic info from port prop
  const showProcessSkeleton = isLoadingFull && !focusData?.process
  const showConnectionsSkeleton = isLoadingFull && (!focusData || focusData.connections.length === 0)

  const openAttachedTopology = useCallback(() => {
    attachedTopologySectionRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    attachedTopologySectionRef.current?.focus({ preventScroll: true })
  }, [])

  const openInGlobalTopology = useCallback(() => {
    openPortInGlobalTopology(port)
  }, [port])

  const detachToPopout = useCallback(async () => {
    const bridge = window.devhub?.r8?.popout
    if (!bridge) {
      setDetachState('unavailable')
      return
    }

    setDetachState('working')
    try {
      await bridge.create({
        surface: 'port',
        targetId: port.port,
        mode: 'browserwindow',
        route: `/monitor?view=ports&port=${encodeURIComponent(String(port.port))}&panel=focus`,
        bounds: {
          x: 96,
          y: 96,
          width: 520,
          height: 720,
        },
        title: `DevHub Port ${port.port} Focus`,
      })
      setDetachState('detached')
    } catch {
      setDetachState('failed')
    }
  }, [port.port])

  return (
    <div
      data-testid="port-focus-panel"
      data-detach-capability="browserwindow-popout"
      className="h-full w-full max-w-full bg-surface-900 border-l-2 border-surface-600 flex flex-col overflow-hidden radius-none"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b-2 border-surface-700 border-l-3 border-l-accent">
        <div className="flex items-center gap-2 min-w-0">
          <PortIcon size={14} className="text-accent flex-shrink-0" />
          <span className="text-sm font-bold text-accent font-mono">:{port.port}</span>
          {portLabel && (
            <span className="text-[9px] text-text-muted bg-surface-700 px-1.5 py-0.5 truncate radius-sm">
              {portLabel}
            </span>
          )}
          <span className={`text-[10px] ${stateColor.text} uppercase flex-shrink-0`}>{port.state}</span>
          <SecurityTierBadge tier={securityTier} />
          {portSecurity.category !== 'normal' && (
            <span
              className={`text-[8px] px-1 py-0.5 flex-shrink-0 ${
                portSecurity.category === 'external' ? 'bg-error/15 text-error border-l-2 border-error' :
                portSecurity.category === 'privileged' ? 'bg-warning/15 text-warning border-l-2 border-warning' :
                'bg-surface-600 text-text-muted border-l-2 border-surface-500'
              } radius-sm`}
            >
              {portSecurity.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            data-testid="port-attached-topology-button"
            data-graph-entry="port-focus-attached-topology"
            data-graph-kind="attached"
            aria-label="查看端口关系图"
            title="查看关系图"
            onClick={openAttachedTopology}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-700 transition-colors radius-sm"
          >
            <NetworkIcon size={12} />
          </button>
          <button
            type="button"
            data-testid="port-global-topology-button"
            data-graph-entry="port-focus-global-topology"
            data-graph-kind="global"
            aria-label="在全局拓扑中查看端口"
            title="在全局拓扑中查看"
            onClick={openInGlobalTopology}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-700 transition-colors radius-sm"
          >
            <GlobeIcon size={12} />
          </button>
          <button
            type="button"
            data-testid="port-focus-detach-popout-button"
            data-r8b-detach-surface="browserwindow"
            aria-label="摘出端口焦点面板为浮窗"
            title="摘出为浮窗"
            onClick={() => void detachToPopout()}
            disabled={detachState === 'working'}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-700 disabled:opacity-60 transition-colors radius-sm"
          >
            <WindowIcon size={12} />
          </button>
          <button
            onClick={loadData}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors radius-sm"
            title="刷新"
          >
            <RefreshIcon size={12} />
          </button>
          <button
            data-testid="port-focus-close-button"
            aria-label="关闭端口详情"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors radius-sm"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Stale data warning */}
        {showTimeoutBanner ? (
          <TimeoutBanner
            ageSec={cachedAgeSec}
            lightModeEnabled={queryMode === 'light'}
            onRetry={handleRetry}
            onToggleLightMode={handleToggleLightMode}
          />
        ) : isStale && dataSource ? (
          <StaleWarning source="cache" />
        ) : null}

        {/* External-facing security warning */}
        {portSecurity.category === 'external' && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 bg-error/10 border-l-2 border-error text-[10px] text-error radius-sm"
          >
            <AlertIcon size={10} />
            <span>外部可访问端口 - 非本地绑定，存在安全风险</span>
          </div>
        )}

        {/* Port conflict warning */}
        {hasConflict && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 bg-error/10 border-l-2 border-error text-[10px] text-error radius-sm"
          >
            <AlertIcon size={10} />
            <span>端口冲突: {conflictingProcesses.length} 个进程监听 :{port.port}</span>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-xs text-error mb-2">{error}</p>
            <button onClick={loadData} className="btn-primary text-xs px-3 py-1">
              重试
            </button>
          </div>
        ) : (
          <>
            {/* Basic Info — always visible immediately from port prop */}
            <section>
              <h4
                className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                基本信息
              </h4>
              <div className="bg-surface-800 p-2 border-l-2 border-surface-600 radius-sm">
                <DetailRow label="端口" value={port.port} />
                <DetailRow label="协议" value={port.protocol} />
                <DetailRow label="状态" value={port.state} color={stateColor.text} />
                <DetailRow label="本地地址" value={port.localAddress} />
                <DetailRow label="进程" value={port.processName} />
                <DetailRow label="进程 ID" value={port.pid} />
                {portLabel && <DetailRow label="服务" value={portLabel} color="text-info" />}
                <DetailRow label="安全分级" value={`${securityTier.label} / ${securityTier.tier}`} color={securityTier.tier === 'Suspicious' ? 'text-error' : securityTier.tier === 'WAN-Capable' ? 'text-warning' : 'text-success'} />
                {portSecurity.category !== 'normal' && (
                  <DetailRow
                    label="安全"
                    value={portSecurity.label}
                    color={portSecurity.category === 'external' ? 'text-error' : portSecurity.category === 'privileged' ? 'text-warning' : 'text-text-muted'}
                  />
                )}
              </div>
            </section>

            {/* Process Details — skeleton while loading, then real data */}
            {showProcessSkeleton ? (
              <SkeletonSection title="进程详情" rows={5} />
            ) : focusData?.process ? (
              <section>
                <h4
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  进程详情
                </h4>
                <div className="bg-surface-800 p-2 border-l-2 border-gold/50 radius-sm">
                  <DetailRow label="CPU" value={`${focusData.process.cpu.toFixed(1)}%`} />
                  <DetailRow label="内存" value={`${focusData.process.memory.toFixed(1)} MB`} />
                  <DetailRow label="线程数" value={focusData.process.threadCount} />
                  <DetailRow label="句柄数" value={focusData.process.handleCount} />
                  {focusData.process.userName && <DetailRow label="用户" value={focusData.process.userName} />}
                  {focusData.process.commandLine && (
                    <div className="mt-1.5 pt-1.5 border-t border-surface-700/50">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">命令</span>
                      <p className="text-[10px] text-text-secondary font-mono break-all leading-relaxed">
                        {focusData.process.commandLine}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {/* Sibling Ports */}
            {focusData && focusData.siblingPorts.length > 0 && (
              <section>
                <h4
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  关联端口 ({focusData.siblingPorts.length})
                </h4>
                <div className="space-y-1">
                  {focusData.siblingPorts.map((sp) => {
                    const sc = STATE_COLORS[sp.state] ?? { text: 'text-text-muted', bg: 'bg-surface-500' }
                    const spLabel = getPortLabel(sp.port)
                    return (
                      <div
                        key={`${sp.port}-${sp.pid}`}
                        className="flex items-center gap-2 bg-surface-800 px-2 py-1.5 border-l-2 border-surface-600 radius-sm"
                      >
                        <span className={`w-1.5 h-1.5 ${sc.bg} radius-sm`} />
                        <span className="text-xs font-bold text-accent font-mono">:{sp.port}</span>
                        {spLabel && <span className="text-[9px] text-text-muted">{spLabel}</span>}
                        <span className={`text-[10px] ${sc.text} uppercase`}>{sp.state}</span>
                        <span className="text-[10px] text-text-muted ml-auto font-mono">{sp.protocol}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Connections — skeleton while loading */}
            {showConnectionsSkeleton ? (
              <SkeletonSection title="网络连接" rows={3} />
            ) : focusData && focusData.connections.length > 0 ? (
              <section>
                <h4
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  网络连接 ({focusData.connections.length})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {focusData.connections.map((conn, i) => {
                    const cs = STATE_COLORS[conn.state] ?? { text: 'text-text-muted', bg: 'bg-surface-500' }
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-surface-800 px-2 py-1 border-l-2 border-surface-600 text-[10px] radius-sm"
                      >
                        <span className={`w-1.5 h-1.5 ${cs.bg} radius-sm`} />
                        <span className={cs.text}>{conn.state}</span>
                        <span className="text-text-muted font-mono truncate flex-1" title={conn.foreignAddress}>
                          {conn.direction === 'inbound' ? '<-' : '->'} {conn.foreignAddress}
                        </span>
                        {conn.foreignProcessName && (
                          <span className="text-text-secondary">{conn.foreignProcessName}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {/* Child Processes */}
            {focusData && focusData.processChildren.length > 0 && (
              <section>
                <h4
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  子进程 ({focusData.processChildren.length})
                </h4>
                <div className="space-y-1">
                  {focusData.processChildren.map((child) => (
                    <div
                      key={child.pid}
                      className="flex items-center gap-2 bg-surface-800 px-2 py-1 border-l-2 border-surface-600 text-[10px] radius-sm"
                    >
                      <ProcessIcon size={10} className="text-text-muted" />
                      <span className="text-text-primary font-mono">{child.name}</span>
                      <span className="text-text-muted">PID:{child.pid}</span>
                      <span className="text-text-muted ml-auto">{child.cpu.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Conflict detail when multiple processes listen on same port */}
            {hasConflict && (
              <section>
                <h4
                  className="text-[10px] font-bold text-error uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  冲突进程 ({conflictingProcesses.length})
                </h4>
                <div className="space-y-1">
                  {conflictingProcesses.map((cp) => (
                    <div
                      key={cp.pid}
                      className="flex items-center gap-2 bg-error/5 px-2 py-1.5 border-l-2 border-error radius-sm"
                    >
                      <ProcessIcon size={10} className="text-error" />
                      <span className="text-xs text-text-primary font-mono">{cp.processName}</span>
                      <span className="text-[10px] text-text-muted">PID:{cp.pid}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <section
          ref={attachedTopologySectionRef}
          data-testid="port-attached-topology-section"
          data-graph-entry="port-focus-attached-panel"
          data-graph-kind="attached"
          tabIndex={-1}
          className="space-y-2 outline-none"
        >
          <h4
            className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            关系视图
          </h4>
          <AttachedGraphView scope={{ kind: 'port', targetId: port.port, depth: 2 }} minHeight={320} />
          <AttachedFlowView scope={{ kind: 'port', targetId: port.port, depth: 2 }} />
        </section>
      </div>

      {/* Action Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-surface-700 bg-surface-900/80 flex items-center gap-2">
        {onFocusProcess && (
          <button
            onClick={() => onFocusProcess(port.pid)}
            className="btn-sm text-[10px] flex items-center gap-1 px-2 py-1 bg-surface-800 hover:bg-surface-700 text-text-secondary hover:text-text-primary border border-surface-600 transition-colors radius-sm"
          >
            <ProcessIcon size={10} />
            聚焦进程
          </button>
        )}
        {onViewInGraph && (
          <button
            data-graph-entry="port-focus-action"
            data-graph-kind="attached"
            onClick={() => onViewInGraph(port.port)}
            className="btn-sm text-[10px] flex items-center gap-1 px-2 py-1 bg-surface-800 hover:bg-surface-700 text-text-secondary hover:text-text-primary border border-surface-600 transition-colors radius-sm"
          >
            <GlobeIcon size={10} />
            在图中查看
          </button>
        )}
        <button
          data-testid="port-global-topology-action-button"
          data-graph-entry="port-focus-global-topology-action"
          data-graph-kind="global"
          onClick={openInGlobalTopology}
          className="btn-sm text-[10px] flex items-center gap-1 px-2 py-1 bg-surface-800 hover:bg-surface-700 text-text-secondary hover:text-text-primary border border-surface-600 transition-colors radius-sm"
        >
          <GlobeIcon size={10} />
          全局拓扑
        </button>
        {detachState !== 'idle' && (
          <span
            data-testid="port-focus-detach-state"
            data-detach-state={detachState}
            className="ml-auto text-[10px] text-text-muted uppercase tracking-wider"
          >
            detach: {detachState}
          </span>
        )}
      </div>
    </div>
  )
})
