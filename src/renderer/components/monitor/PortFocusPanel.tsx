/**
 * PortFocusPanel — Detailed focus view for a single port.
 *
 * Displays: basic info, owning process, sibling ports, active connections,
 * a mini neural graph, and action buttons.
 */

import { memo, useEffect, useState, useCallback } from 'react'
import type { PortFocusData, PortInfo } from '@shared/types-extended'
import { CloseIcon, ProcessIcon, PortIcon, GlobeIcon, RefreshIcon } from '../icons'
import { LoadingSpinner } from '../ui/LoadingSpinner'

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
  getPortFocusData: (port: number) => Promise<PortFocusData | null>
}

export const PortFocusPanel = memo(function PortFocusPanel({
  port,
  onClose,
  onFocusProcess,
  onViewInGraph,
  getPortFocusData
}: PortFocusPanelProps) {
  const [focusData, setFocusData] = useState<PortFocusData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getPortFocusData(port.port)
      setFocusData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load port data')
    } finally {
      setIsLoading(false)
    }
  }, [port.port, getPortFocusData])

  useEffect(() => {
    loadData()
  }, [loadData])

  const stateColor = STATE_COLORS[port.state] ?? { text: 'text-text-muted', bg: 'bg-surface-500' }

  return (
    <div
      className="w-80 bg-surface-900 border-l-2 border-surface-600 flex flex-col overflow-hidden"
      style={{ borderRadius: '0' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b-2 border-surface-700 border-l-3 border-l-accent">
        <div className="flex items-center gap-2">
          <PortIcon size={14} className="text-accent" />
          <span className="text-sm font-bold text-accent font-mono">:{port.port}</span>
          <span className={`text-[10px] ${stateColor.text} uppercase`}>{port.state}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadData}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors"
            style={{ borderRadius: '2px' }}
            title="Refresh"
          >
            <RefreshIcon size={12} />
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors"
            style={{ borderRadius: '2px' }}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <LoadingSpinner size="sm" className="mb-2" />
            <p className="text-xs text-text-muted">Loading port data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-xs text-error mb-2">{error}</p>
            <button onClick={loadData} className="btn-primary text-xs px-3 py-1">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Basic Info */}
            <section>
              <h4
                className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                BASIC INFO
              </h4>
              <div className="bg-surface-800 p-2 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
                <DetailRow label="Port" value={port.port} />
                <DetailRow label="Protocol" value={port.protocol} />
                <DetailRow label="State" value={port.state} color={stateColor.text} />
                <DetailRow label="Local" value={port.localAddress} />
                <DetailRow label="Process" value={port.processName} />
                <DetailRow label="PID" value={port.pid} />
              </div>
            </section>

            {/* Process Details (extended) */}
            {focusData?.process && (
              <section>
                <h4
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  PROCESS DETAILS
                </h4>
                <div className="bg-surface-800 p-2 border-l-2 border-gold/50" style={{ borderRadius: '2px' }}>
                  <DetailRow label="CPU" value={`${focusData.process.cpu.toFixed(1)}%`} />
                  <DetailRow label="Memory" value={`${focusData.process.memory.toFixed(1)} MB`} />
                  <DetailRow label="Threads" value={focusData.process.threadCount} />
                  <DetailRow label="Handles" value={focusData.process.handleCount} />
                  {focusData.process.userName && <DetailRow label="User" value={focusData.process.userName} />}
                  {focusData.process.commandLine && (
                    <div className="mt-1.5 pt-1.5 border-t border-surface-700/50">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Command</span>
                      <p className="text-[10px] text-text-secondary font-mono break-all leading-relaxed">
                        {focusData.process.commandLine}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Sibling Ports */}
            {focusData && focusData.siblingPorts.length > 0 && (
              <section>
                <h4
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  SIBLING PORTS ({focusData.siblingPorts.length})
                </h4>
                <div className="space-y-1">
                  {focusData.siblingPorts.map((sp) => {
                    const sc = STATE_COLORS[sp.state] ?? { text: 'text-text-muted', bg: 'bg-surface-500' }
                    return (
                      <div
                        key={`${sp.port}-${sp.pid}`}
                        className="flex items-center gap-2 bg-surface-800 px-2 py-1.5 border-l-2 border-surface-600"
                        style={{ borderRadius: '2px' }}
                      >
                        <span className={`w-1.5 h-1.5 ${sc.bg}`} style={{ borderRadius: '1px' }} />
                        <span className="text-xs font-bold text-accent font-mono">:{sp.port}</span>
                        <span className={`text-[10px] ${sc.text} uppercase`}>{sp.state}</span>
                        <span className="text-[10px] text-text-muted ml-auto font-mono">{sp.protocol}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Connections */}
            {focusData && focusData.connections.length > 0 && (
              <section>
                <h4
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  CONNECTIONS ({focusData.connections.length})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {focusData.connections.map((conn, i) => {
                    const cs = STATE_COLORS[conn.state] ?? { text: 'text-text-muted', bg: 'bg-surface-500' }
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-surface-800 px-2 py-1 border-l-2 border-surface-600 text-[10px]"
                        style={{ borderRadius: '2px' }}
                      >
                        <span className={`w-1.5 h-1.5 ${cs.bg}`} style={{ borderRadius: '1px' }} />
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
            )}

            {/* Child Processes */}
            {focusData && focusData.processChildren.length > 0 && (
              <section>
                <h4
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  CHILD PROCESSES ({focusData.processChildren.length})
                </h4>
                <div className="space-y-1">
                  {focusData.processChildren.map((child) => (
                    <div
                      key={child.pid}
                      className="flex items-center gap-2 bg-surface-800 px-2 py-1 border-l-2 border-surface-600 text-[10px]"
                      style={{ borderRadius: '2px' }}
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
          </>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-surface-700 bg-surface-900/80 flex items-center gap-2">
        {onFocusProcess && (
          <button
            onClick={() => onFocusProcess(port.pid)}
            className="btn-sm text-[10px] flex items-center gap-1 px-2 py-1 bg-surface-800 hover:bg-surface-700 text-text-secondary hover:text-text-primary border border-surface-600 transition-colors"
            style={{ borderRadius: '2px' }}
          >
            <ProcessIcon size={10} />
            Focus Process
          </button>
        )}
        {onViewInGraph && (
          <button
            onClick={() => onViewInGraph(port.port)}
            className="btn-sm text-[10px] flex items-center gap-1 px-2 py-1 bg-surface-800 hover:bg-surface-700 text-text-secondary hover:text-text-primary border border-surface-600 transition-colors"
            style={{ borderRadius: '2px' }}
          >
            <GlobeIcon size={10} />
            View in Graph
          </button>
        )}
      </div>
    </div>
  )
})
