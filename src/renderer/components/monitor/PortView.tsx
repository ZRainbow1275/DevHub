import { useEffect, memo, useState, useMemo, useCallback } from 'react'
import { usePorts } from '../../hooks/usePorts'
import { PortInfo, COMMON_DEV_PORTS } from '@shared/types-extended'
import { ProcessCardErrorBoundary } from './ProcessCardErrorBoundary'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { StatCard } from '../ui/StatCard'
import { ViewModeToggle } from '../ui/ViewModeToggle'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { LastScanTime } from '../ui/LastScanTime'
import {
  PortIcon,
  ProcessIcon,
  CloseIcon,
  RefreshIcon,
  SearchIcon,
  GridIcon,
  ListIcon,
  AlertIcon,
  NetworkIcon
} from '../icons'
import { PortRelationshipGraph } from './PortRelationshipGraph'
import { PortFocusPanel } from './PortFocusPanel'
import { getPortLabel } from '../../utils/portLabels'
import { TruncatedText } from '../ui/TruncatedText'

// ============ Conflict detection helper ============

/** Find ports where multiple distinct PIDs are LISTENING on the same port number. */
function getConflictingPorts(ports: PortInfo[]): Set<number> {
  const listenMap = new Map<number, Set<number>>()
  for (const p of ports) {
    if (p.state !== 'LISTENING') continue
    const pids = listenMap.get(p.port)
    if (pids) {
      pids.add(p.pid)
    } else {
      listenMap.set(p.port, new Set([p.pid]))
    }
  }
  const conflicting = new Set<number>()
  for (const [port, pids] of listenMap) {
    if (pids.size > 1) conflicting.add(port)
  }
  return conflicting
}

// 端口卡片组件
interface PortCardProps {
  port: PortInfo
  index: number
  isCommon: boolean
  isSelected: boolean
  hasConflict: boolean
  onSelect: () => void
  onRelease: () => void
}

const PortCard = memo(function PortCard({ port, index, isCommon, isSelected, hasConflict, onSelect, onRelease }: PortCardProps) {
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const portLabel = getPortLabel(port.port)

  const stateConfig = {
    LISTENING: { color: 'bg-success', text: '监听中', textColor: 'text-success', borderColor: 'border-success' },
    ESTABLISHED: { color: 'bg-accent', text: '已连接', textColor: 'text-accent', borderColor: 'border-accent' },
    TIME_WAIT: { color: 'bg-warning', text: '等待关闭', textColor: 'text-warning', borderColor: 'border-warning' },
    CLOSE_WAIT: { color: 'bg-error', text: '等待关闭', textColor: 'text-error', borderColor: 'border-error' }
  }[port.state] ?? { color: 'bg-surface-400', text: port.state || 'UNKNOWN', textColor: 'text-text-muted', borderColor: 'border-surface-500' }

  return (
    <>
      <div
        onClick={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          monitor-card group cursor-pointer relative overflow-hidden animate-card-stagger
          ${isSelected ? 'monitor-card-selected' : ''}
          ${port.state === 'LISTENING' ? 'card-running' : ''}
        `}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />

        {/* Status indicator */}
        {port.state === 'LISTENING' && (
          <div className="absolute top-3 right-3">
            <span className="status-dot status-dot-running" />
          </div>
        )}

        <div className="relative z-10">
          {/* Port Number */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`min-w-[4.5rem] h-14 px-2 bg-surface-700 flex items-center justify-center border-l-3 ${hasConflict ? 'border-error' : stateConfig.borderColor} radius-sm`}>
                <span className="text-2xl font-bold text-accent font-mono whitespace-nowrap">:{port.port}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`status-badge ${port.state === 'LISTENING' ? 'status-badge-running' : ''}`}>
                    <span className={`w-1.5 h-1.5 ${stateConfig.color} radius-sm`} />
                    {stateConfig.text}
                  </span>
                  {isCommon && (
                    <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 border-l-2 border-info radius-sm">
                      常用
                    </span>
                  )}
                  {hasConflict && (
                    <span className="text-[10px] bg-error/10 text-error px-2 py-0.5 border-l-2 border-error radius-sm">
                      冲突
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-mono uppercase">{port.protocol}</span>
                  {portLabel && <span className="text-[9px] text-text-muted">{portLabel}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Process Info */}
          <div className="bg-surface-900 p-3 mb-4 border-l-2 border-surface-600 radius-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-surface-700 flex items-center justify-center radius-sm">
                <ProcessIcon size={16} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <TruncatedText text={port.processName} className="text-sm font-bold text-text-primary" />
                <span className="text-xs text-text-muted font-mono">PID: {port.pid}</span>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="mb-4">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">本地地址</div>
            <div className="bg-surface-800 px-2 py-1 border-l-2 border-surface-600 radius-sm">
              <TruncatedText text={port.localAddress} className="text-xs text-text-secondary font-mono" />
            </div>
          </div>

          {/* Foreign Address - show for ESTABLISHED connections */}
          {port.foreignAddress && port.foreignAddress !== '*:*' && port.foreignAddress !== '0.0.0.0:0' && (
            <div className="mb-4">
              <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">远程地址</div>
              <div className="bg-surface-800 px-2 py-1 border-l-2 border-warning/40 radius-sm">
                <TruncatedText text={port.foreignAddress} className="text-xs text-warning/80 font-mono" />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className={`
            flex items-center justify-end gap-2
            transition-all duration-300
            ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowReleaseConfirm(true)
              }}
              className="btn-danger flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <CloseIcon size={14} />
              释放端口
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showReleaseConfirm}
        title="释放端口"
        message={`确定要释放端口 ${port.port} 吗？这将终止进程 "${port.processName}" (PID: ${port.pid})。`}
        confirmText="释放"
        variant="danger"
        onConfirm={() => {
          setShowReleaseConfirm(false)
          onRelease()
        }}
        onCancel={() => setShowReleaseConfirm(false)}
      />
    </>
  )
})

// 端口列表项组件
interface PortItemProps {
  port: PortInfo
  index: number
  isSelected: boolean
  isCommon: boolean
  hasConflict: boolean
  onSelect: () => void
  onRelease: () => void
}

const PortItem = memo(function PortItem({ port, index, isSelected, isCommon, hasConflict, onSelect, onRelease }: PortItemProps) {
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const portLabel = getPortLabel(port.port)

  const stateConfig = {
    LISTENING: { color: 'bg-success', text: '监听中', textColor: 'text-success' },
    ESTABLISHED: { color: 'bg-accent', text: '已连接', textColor: 'text-accent' },
    TIME_WAIT: { color: 'bg-warning', text: '等待关闭', textColor: 'text-warning' },
    CLOSE_WAIT: { color: 'bg-error', text: '等待关闭', textColor: 'text-error' }
  }[port.state] ?? { color: 'bg-surface-400', text: port.state || 'UNKNOWN', textColor: 'text-text-muted' }

  return (
    <>
      <div
        onClick={onSelect}
        className={`
          animate-card-stagger group p-4 cursor-pointer transition-all duration-200
          border-l-3 bg-surface-800
          ${isSelected
            ? 'border-accent bg-accent/10'
            : hasConflict
              ? 'border-error bg-error/5'
              : 'border-transparent hover:border-surface-500 hover:bg-surface-700'
          }
        `}
        style={{ borderRadius: '2px', animationDelay: `${index * 40}ms` }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="relative">
              <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${hasConflict ? 'bg-error' : stateConfig.color} ${port.state === 'LISTENING' && !hasConflict ? 'status-dot-running' : ''} radius-sm`} />
              <div className={`min-w-[3.5rem] h-12 px-1 bg-surface-700 flex items-center justify-center border-l-2 ${hasConflict ? 'border-error' : 'border-accent'} radius-sm`}>
                <span className="text-lg font-bold text-accent font-mono whitespace-nowrap">:{port.port}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TruncatedText text={port.processName} className="text-sm font-bold text-text-primary" maxWidth="180px" />
                <span className="text-xs text-text-muted font-mono bg-surface-700 px-2 py-0.5 radius-sm">
                  PID: {port.pid}
                </span>
                {portLabel && (
                  <span className="text-[9px] text-text-muted bg-surface-700 px-1.5 py-0.5 radius-sm">
                    {portLabel}
                  </span>
                )}
                {isCommon && !portLabel && (
                  <span className="text-[10px] bg-info/10 text-info px-1.5 py-0.5 border-l-2 border-info radius-sm">
                    常用
                  </span>
                )}
                {hasConflict && (
                  <span className="text-[10px] bg-error/10 text-error px-1.5 py-0.5 border-l-2 border-error font-bold uppercase tracking-wider radius-sm">
                    冲突
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-text-tertiary font-mono">{port.localAddress}</p>
                {port.foreignAddress && port.foreignAddress !== '*:*' && port.foreignAddress !== '0.0.0.0:0' && (
                  <>
                    <span className="text-[10px] text-text-muted">&rarr;</span>
                    <TruncatedText text={port.foreignAddress} className="text-xs text-warning/70 font-mono" maxWidth="200px" />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <span className={`status-badge ${port.state === 'LISTENING' ? 'status-badge-running' : ''}`}>
              <span className={`w-1.5 h-1.5 ${stateConfig.color} radius-sm`} />
              {stateConfig.text}
            </span>
            <span className="text-xs text-text-muted font-mono uppercase">{port.protocol}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowReleaseConfirm(true)
              }}
              className="btn-icon-sm text-error/60 hover:text-error hover:bg-error/20 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="释放端口"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showReleaseConfirm}
        title="释放端口"
        message={`确定要释放端口 ${port.port} 吗？这将终止进程 "${port.processName}" (PID: ${port.pid})。`}
        confirmText="释放"
        variant="danger"
        onConfirm={() => {
          setShowReleaseConfirm(false)
          onRelease()
        }}
        onCancel={() => setShowReleaseConfirm(false)}
      />
    </>
  )
})

// 快速端口状态指示器
interface QuickPortIndicatorProps {
  portNum: number
  portInfo: PortInfo | undefined
  onSelect: () => void
}

const QuickPortIndicator = memo(function QuickPortIndicator({ portNum, portInfo, onSelect }: QuickPortIndicatorProps) {
  const isInUse = !!portInfo
  const label = getPortLabel(portNum)

  return (
    <button
      onClick={onSelect}
      disabled={!isInUse}
      className={`
        relative px-3 py-2 font-mono text-sm font-bold transition-all duration-200
        ${isInUse
          ? 'bg-error/10 text-error border-l-2 border-error hover:bg-error/20 cursor-pointer'
          : 'bg-success/5 text-success/60 border-l-2 border-success/30 cursor-default'
        }
       radius-sm`}
      title={isInUse ? `${label ? label + ' - ' : ''}被 ${portInfo.processName ?? 'unknown'} 占用` : `${label ?? ''} 可用`}
    >
      <span>:{portNum}</span>
      {label && <span className="text-[8px] ml-1 opacity-60 font-normal">{label}</span>}
      {isInUse && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-error status-dot-running radius-sm" />
      )}
    </button>
  )
})

export function PortView() {
  const {
    ports,
    isScanning,
    lastScanTime,
    selectedPort,
    scan,
    releasePort,
    selectPort,
    getActiveConflicts,
    getPortFocusData,
    getPortDetailIncremental,
    cancelPortQuery
  } = usePorts()

  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'relationship'>('cards')
  const [filter, setFilter] = useState<'all' | 'common' | 'listening'>('all')
  const [searchPort, setSearchPort] = useState('')
  const [focusedPort, setFocusedPort] = useState<PortInfo | null>(null)

  // Handle graph node click -> open focus panel for port nodes
  const handleGraphNodeClick = useCallback((nodeData: { type: string; port?: number; pid?: number; hwnd?: number }) => {
    // Match the new ReactFlow node types: 'flowPort' / 'flowProcess' / 'flowWindow' (legacy lower-case accepted)
    if ((nodeData.type === 'flowPort' || nodeData.type.startsWith('port')) && nodeData.port !== undefined) {
      const portInfo = ports.find(p => p.port === nodeData.port)
      if (portInfo) {
        setFocusedPort(portInfo)
        selectPort(portInfo.port)
      }
    }
  }, [ports, selectPort])

  // Close focus panel
  const closeFocusPanel = useCallback(() => {
    setFocusedPort(null)
  }, [])

  useEffect(() => {
    scan()
    const interval = setInterval(scan, 10000)
    return () => clearInterval(interval)
  }, [scan])

  const filteredPorts = ports.filter((port) => {
    if (searchPort) {
      return port.port.toString().includes(searchPort)
    }
    switch (filter) {
      case 'common':
        return COMMON_DEV_PORTS.includes(port.port as typeof COMMON_DEV_PORTS[number])
      case 'listening':
        return port.state === 'LISTENING'
      default:
        return true
    }
  })

  const activeConflicts = useMemo(() => getActiveConflicts(), [getActiveConflicts])

  const conflictingPortNumbers = useMemo(() => getConflictingPorts(ports), [ports])

  const portsByState = useMemo(() => ({
    listening: ports.filter(p => p.state === 'LISTENING').length,
    established: ports.filter(p => p.state === 'ESTABLISHED').length,
    other: ports.filter(p => !['LISTENING', 'ESTABLISHED'].includes(p.state)).length
  }), [ports])

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b-2 border-surface-700 bg-surface-900 relative">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-surface-700 flex items-center justify-center border-l-3 border-accent radius-sm">
              <PortIcon size={20} className="text-accent" />
            </div>
            <div>
              <h2
                className="text-text-primary font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}
              >
                端口监控
              </h2>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="font-mono">{ports.length} 个端口</span>
                <LastScanTime lastScanTime={lastScanTime} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="搜索端口..."
                value={searchPort}
                onChange={(e) => setSearchPort(e.target.value)}
                className="input-sm w-36 pl-9"
              />
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>

            {/* Filter */}
            <div className="flex items-center bg-surface-800 p-1 border border-surface-700 radius-sm">
              {[
                { key: 'all', label: '全部' },
                { key: 'common', label: '常用' },
                { key: 'listening', label: '监听' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`
                    px-3 py-1.5 text-xs transition-all duration-200
                    ${filter === key
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-700'
                    }
                   radius-sm`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <ViewModeToggle
              modes={[
                { key: 'cards', icon: <GridIcon size={16} />, label: '卡片' },
                { key: 'list', icon: <ListIcon size={16} />, label: '列表' },
                { key: 'relationship', icon: <NetworkIcon size={16} />, label: '关系图' }
              ]}
              current={viewMode}
              onChange={(mode) => setViewMode(mode as typeof viewMode)}
            />

            <button
              onClick={scan}
              disabled={isScanning}
              className={`
                btn-icon bg-surface-800 border border-surface-700
                ${isScanning ? 'opacity-50' : 'hover:bg-surface-700 hover:border-surface-600'}
              `}
              title="刷新"
            >
              <RefreshIcon size={18} className={`text-text-secondary ${isScanning ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="flex-shrink-0 px-5 py-4 stat-grid border-b border-surface-700/50 bg-surface-900/50">
        <StatCard
          icon={<PortIcon size={20} className="text-accent" />}
          label="活跃端口"
          value={ports.length}
          color="accent"
        />
        <StatCard
          icon={<PortIcon size={20} className="text-success" />}
          label="监听中"
          value={portsByState.listening}
          color="success"
        />
        <StatCard
          icon={<PortIcon size={20} className="text-info" />}
          label="已连接"
          value={portsByState.established}
          color="default"
        />
        <StatCard
          icon={<AlertIcon size={20} className="text-error" />}
          label="端口冲突"
          value={activeConflicts.length}
          color={activeConflicts.length > 0 ? 'error' : 'default'}
        />
      </div>

      {/* Quick Port View */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-surface-700/30 bg-surface-900/30">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-medium uppercase tracking-wider">常用端口:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {COMMON_DEV_PORTS.map((portNum) => {
              const portInfo = ports.find(p => p.port === portNum)
              return (
                <QuickPortIndicator
                  key={portNum}
                  portNum={portNum}
                  portInfo={portInfo}
                  onSelect={() => portInfo && selectPort(portNum)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'relationship' ? (
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1">
            <PortRelationshipGraph
              focusPort={selectedPort}
              onNodeClick={handleGraphNodeClick}
            />
          </div>
          {focusedPort && (
            <PortFocusPanel
              port={focusedPort}
              onClose={closeFocusPanel}
              getPortFocusData={getPortFocusData}
              getPortDetailIncremental={getPortDetailIncremental}
              cancelPortQuery={cancelPortQuery}
              allPorts={ports}
              onFocusProcess={(pid) => {
                // Navigate to process view (placeholder — could emit event)
                // TODO: Navigate to process view when cross-tab navigation is implemented
void pid
              }}
              onViewInGraph={(port) => {
                selectPort(port)
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex">
          <div className="flex-1 overflow-y-auto p-5">
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPorts.map((port, index) => (
                  <ProcessCardErrorBoundary key={`${port.port}-${port.pid}`} pid={port.pid} processName={port.processName}>
                    <PortCard
                      port={port}
                      index={index}
                      isCommon={COMMON_DEV_PORTS.includes(port.port as typeof COMMON_DEV_PORTS[number])}
                      isSelected={selectedPort === port.port}
                      hasConflict={conflictingPortNumbers.has(port.port)}
                      onSelect={() => {
                        selectPort(port.port)
                        setFocusedPort(port)
                      }}
                      onRelease={() => releasePort(port.port)}
                    />
                  </ProcessCardErrorBoundary>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPorts.map((port, index) => (
                  <ProcessCardErrorBoundary key={`${port.port}-${port.pid}`} pid={port.pid} processName={port.processName}>
                    <PortItem
                      port={port}
                      index={index}
                      isSelected={selectedPort === port.port}
                      isCommon={COMMON_DEV_PORTS.includes(port.port as typeof COMMON_DEV_PORTS[number])}
                      hasConflict={conflictingPortNumbers.has(port.port)}
                      onSelect={() => {
                        selectPort(port.port)
                        setFocusedPort(port)
                      }}
                      onRelease={() => releasePort(port.port)}
                    />
                  </ProcessCardErrorBoundary>
                ))}
              </div>
            )}

            {isScanning && filteredPorts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <LoadingSpinner size="md" className="mb-4" />
                <p className="text-text-secondary">正在扫描端口...</p>
              </div>
            )}

            {filteredPorts.length === 0 && !isScanning && (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 bg-surface-800 flex items-center justify-center mb-6 border-l-3 border-accent radius-md">
                  <PortIcon size={40} className="text-text-muted" />
                </div>
                <h3
                  className="text-lg font-bold text-text-primary mb-2 uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {searchPort ? '未找到匹配的端口' : '没有检测到使用中的端口'}
                </h3>
                <p className="text-text-muted">
                  {searchPort ? '尝试其他搜索关键词' : '启动开发服务器后将在此显示'}
                </p>
              </div>
            )}
          </div>

          {/* Focus Panel for card/list modes */}
          {focusedPort && (
            <PortFocusPanel
              port={focusedPort}
              onClose={closeFocusPanel}
              getPortFocusData={getPortFocusData}
              getPortDetailIncremental={getPortDetailIncremental}
              cancelPortQuery={cancelPortQuery}
              allPorts={ports}
              onFocusProcess={(pid) => {
                // TODO: Navigate to process view when cross-tab navigation is implemented
void pid
              }}
              onViewInGraph={(port) => {
                setViewMode('relationship')
                selectPort(port)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
