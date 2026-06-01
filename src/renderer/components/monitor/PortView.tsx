import { useEffect, memo, useState, useMemo, useCallback } from 'react'
import { usePorts } from '../../hooks/usePorts'
import { useT } from '../../hooks/useT'
import {
  PortInfo,
  COMMON_DEV_PORTS,
  PORT_POPOUT_FILTER_VALUES,
  PORT_POPOUT_VIEW_MODE_VALUES,
  type PortPopoutFilter,
  type PortPopoutViewMode
} from '@shared/types-extended'
import { APP_SETTINGS_CHANGE_EVENT, DEFAULT_SETTINGS, type AppSettings } from '@shared/types'
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
  NetworkIcon,
  WindowIcon,
  InfoIcon
} from '../icons'
import { PortRelationshipGraph } from './PortRelationshipGraph'
import { PortFocusPanel } from './PortFocusPanel'
import { PanelSplitter } from '../ui/PanelSplitter'
import { getPortLabel } from '../../utils/portLabels'
import { TruncatedText } from '../ui/TruncatedText'
import { PortPopoutHost } from '../popout/PortPopoutHost'
import { PopoutTriggerLayer } from '../popout/PopoutTriggerLayer'
import { PanelDetachButton } from '../popout/PanelDetachButton'
import type { DetachableViewProps } from '../popout/detachable-registry'
import { usePopoutManager } from '../../hooks/usePopoutManager'
import { type PortPopoutPosition, type PortPopoutTrigger } from '../popout/port-popout-model'
import {
  clearPendingPortPopoutRequest,
  isPortPopoutRequestDetail,
  peekPendingPortPopoutRequest,
  PORT_POPOUT_REQUEST_EVENT
} from '../popout/port-popout-events'
import type { BlocklistEntry, SecurityTierClassification } from '@shared/port-security'
import { classifyPortSecurity, isPortBlocklisted } from '@shared/port-security'
import { useBlocklist } from '../../hooks/useBlocklist'
import { usePopoutSync } from '../../hooks/usePopoutSync'
import { usePortStore } from '../../stores/portStore'
import { PublicPortBanner } from './port/PublicPortBanner'
import { SecurityTierBadge } from './port/SecurityTierBadge'
import { PortModuleTour, PORT_MODULE_TOUR_STORAGE_KEY, type PortModuleTourSecuritySummary } from './port/PortModuleTour'
import { CardEdgeGraphBadge } from './CardEdgeGraphBadge'
import { navigateMonitorTab } from '../../utils/navigateMonitorTab'

// ============ Conflict detection helper ============

type PortPopoutSettings = AppSettings['window']['portPopout']
type PortViewMode = PortPopoutViewMode
type PortFilterMode = PortPopoutFilter

const PORT_VIEW_MODE_STORAGE_KEY = 'devhub:port-view-mode'
const PORT_VIEW_MODES: readonly PortViewMode[] = PORT_POPOUT_VIEW_MODE_VALUES
const PORT_FILTER_MODES: readonly PortFilterMode[] = PORT_POPOUT_FILTER_VALUES

function normalizePortViewMode(value: string | null | undefined): PortViewMode {
  return PORT_VIEW_MODES.includes(value as PortViewMode) ? value as PortViewMode : 'cards'
}

function normalizePortFilterMode(value: string | null | undefined): PortFilterMode {
  return PORT_FILTER_MODES.includes(value as PortFilterMode) ? value as PortFilterMode : 'all'
}

function mergePortPopoutSettings(settings: AppSettings | null | undefined): PortPopoutSettings {
  const defaults = DEFAULT_SETTINGS.window.portPopout
  return {
    ...defaults,
    ...settings?.window?.portPopout,
    triggerEnabled: {
      ...defaults.triggerEnabled,
      ...settings?.window?.portPopout?.triggerEnabled,
    },
    syncPolicyDefault: {
      ...defaults.syncPolicyDefault,
      ...settings?.window?.portPopout?.syncPolicyDefault,
    },
  }
}

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
  isPopoutOpen: boolean
  popoutSettings: PortPopoutSettings
  blocklistEntries: readonly BlocklistEntry[]
  onSelect: () => void
  onViewInGraph: () => void
  onRelease: () => void
  onOpenPopout: (trigger: PortPopoutTrigger, anchor?: PortPopoutPosition) => void
}

function classifyPortForView(port: PortInfo, blocklistEntries: readonly BlocklistEntry[]): SecurityTierClassification {
  return classifyPortSecurity({
    port: port.port,
    address: port.localAddress,
    blocklisted: isPortBlocklisted(port.port, port.localAddress, blocklistEntries)
  })
}

const PortCard = memo(function PortCard({ port, index, isCommon, isSelected, hasConflict, isPopoutOpen, popoutSettings, blocklistEntries, onSelect, onViewInGraph, onRelease, onOpenPopout }: PortCardProps) {
  const { t } = useT()
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const portLabel = getPortLabel(port.port)
  const securityTier = classifyPortForView(port, blocklistEntries)

  const stateConfig = {
    LISTENING: { color: 'bg-success', text: '监听中', textColor: 'text-success', borderColor: 'border-success' },
    ESTABLISHED: { color: 'bg-accent', text: '已连接', textColor: 'text-accent', borderColor: 'border-accent' },
    TIME_WAIT: { color: 'bg-warning', text: '等待关闭', textColor: 'text-warning', borderColor: 'border-warning' },
    CLOSE_WAIT: { color: 'bg-error', text: '等待关闭', textColor: 'text-error', borderColor: 'border-error' }
  }[port.state] ?? { color: 'bg-surface-400', text: port.state || 'UNKNOWN', textColor: 'text-text-muted', borderColor: 'border-surface-500' }

  return (
    <>
      <PopoutTriggerLayer
        port={port}
        index={index}
        isSelected={isSelected}
        isPopoutOpen={isPopoutOpen}
        popoutSettings={popoutSettings}
        onSelect={onSelect}
        onOpenPopout={onOpenPopout}
      >
        {({
          isHovered,
          showAdvancedMenu,
          openAdvancedMenuPopout,
          closeAdvancedMenu,
          clearHoverTimer,
          longPressThresholdMs
        }) => (
          <>
            {/* Diagonal decoration */}
            <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />
            <CardEdgeGraphBadge
              testId={`port-card-graph-badge-${port.port}-${port.pid}`}
              graphEntry="port-card-attached-topology"
              scopeKind="port"
              targetId={port.port}
              ariaLabel={`查看端口 ${port.port} 关系图`}
              onClick={() => {
                clearHoverTimer()
                onViewInGraph()
              }}
            />

        {/* Status indicator */}
        {port.state === 'LISTENING' && (
          <div className="absolute top-3 right-12">
            <span className="status-dot status-dot-running" />
          </div>
        )}

        <div className="relative z-10">
          {/* Port Number */}
          <div data-r8a-field-row="port-header" className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`min-w-[max(4.5rem,5ch)] min-h-[3.5rem] h-auto py-1 px-2 bg-surface-700 flex items-center justify-center border-l-3 flex-shrink-0 ${hasConflict ? 'border-error' : stateConfig.borderColor} radius-sm`}>
                <span data-port-field="port" className="text-[clamp(1.1rem,0.9rem+0.4vw,1.5rem)] font-bold text-accent font-mono whitespace-nowrap">:{port.port}</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                  <span data-port-field="state" className={`status-badge ${port.state === 'LISTENING' ? 'status-badge-running' : ''}`}>
                    <span className={`w-1.5 h-1.5 ${stateConfig.color} radius-sm`} />
                    {stateConfig.text}
                  </span>
                  {isCommon && (
                    <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 border-l-2 border-info whitespace-nowrap radius-sm">
                      常用
                    </span>
                  )}
                  {hasConflict && (
                    <span className="text-[10px] bg-error/10 text-error px-2 py-0.5 border-l-2 border-error whitespace-nowrap radius-sm">
                      冲突
                    </span>
                  )}
                  <span data-port-field="securityTier">
                    <SecurityTierBadge tier={securityTier} />
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span data-port-field="protocol" className="text-xs text-text-muted font-mono uppercase whitespace-nowrap">{port.protocol}</span>
                  {portLabel && <span className="text-[9px] text-text-muted whitespace-nowrap">{portLabel}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Process Info */}
          <div data-r8a-field-row="process" className="bg-surface-900 p-3 mb-4 border-l-2 border-surface-600 radius-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-surface-700 flex items-center justify-center radius-sm">
                <ProcessIcon size={16} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <TruncatedText text={port.processName} className="text-sm font-bold text-text-primary" />
                <span data-port-field="pid" className="text-xs text-text-muted font-mono">PID: {port.pid}</span>
              </div>
            </div>
          </div>

          {/* Address */}
          <div data-r8a-field-row="local-address" className="mb-4">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">本地地址</div>
            <div className="bg-surface-800 px-2 py-1 border-l-2 border-surface-600 radius-sm">
              <TruncatedText text={port.localAddress} className="text-xs text-text-secondary font-mono" />
            </div>
          </div>

          {/* Foreign Address - show for ESTABLISHED connections */}
          {port.foreignAddress && port.foreignAddress !== '*:*' && port.foreignAddress !== '0.0.0.0:0' && (
            <div data-r8a-field-row="foreign-address" className="mb-4">
              <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">远程地址</div>
              <div className="bg-surface-800 px-2 py-1 border-l-2 border-warning/40 radius-sm">
                <TruncatedText text={port.foreignAddress} className="text-xs text-warning/80 font-mono" />
              </div>
            </div>
          )}

          {showAdvancedMenu && (
            <div
              data-testid={`port-advanced-menu-${port.port}-${port.pid}`}
              data-long-press-threshold-ms={longPressThresholdMs}
              role="menu"
              aria-label={`端口 ${port.port} 高级操作`}
              className="absolute right-3 bottom-14 z-20 min-w-[11rem] bg-surface-950 border border-surface-600 shadow-xl p-2 space-y-1 radius-sm"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                data-testid={`port-advanced-menu-graph-${port.port}-${port.pid}`}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-text-secondary hover:text-accent hover:bg-surface-800 transition-colors radius-sm"
                onClick={() => {
                  closeAdvancedMenu()
                  clearHoverTimer()
                  onViewInGraph()
                }}
              >
                <NetworkIcon size={12} />
                关系图
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid={`port-advanced-menu-popout-${port.port}-${port.pid}`}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-text-secondary hover:text-accent hover:bg-surface-800 transition-colors radius-sm"
                onClick={openAdvancedMenuPopout}
              >
                <WindowIcon size={12} />
                摘出浮窗
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid={`port-advanced-menu-release-${port.port}-${port.pid}`}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-error/80 hover:text-error hover:bg-error/10 transition-colors radius-sm"
                onClick={() => {
                  closeAdvancedMenu()
                  setShowReleaseConfirm(true)
                }}
              >
                <CloseIcon size={12} />
                释放端口
              </button>
            </div>
          )}

          {/* Action Button */}
          <div className={`
            flex items-center justify-end gap-2
            transition-all duration-300
            ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}>
            <button
              data-testid={`port-popout-click-${port.port}-${port.pid}`}
              disabled={!popoutSettings.triggerEnabled.click}
              onClick={(e) => {
                e.stopPropagation()
                if (!popoutSettings.triggerEnabled.click) return
                clearHoverTimer()
                onOpenPopout('click', { x: e.clientX, y: e.clientY })
              }}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40 flex items-center gap-1.5 text-xs px-3 py-1.5"
              title={t('monitor.port.openFloatingCard', 'Open floating port card')}
            >
              <WindowIcon size={14} />
              {t('monitor.port.popout', 'Popout')}
            </button>
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
          </>
        )}
      </PopoutTriggerLayer>

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
  blocklistEntries: readonly BlocklistEntry[]
  onSelect: () => void
  onRelease: () => void
}

const PortItem = memo(function PortItem({ port, index, isSelected, isCommon, hasConflict, blocklistEntries, onSelect, onRelease }: PortItemProps) {
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const portLabel = getPortLabel(port.port)
  const securityTier = classifyPortForView(port, blocklistEntries)

  const stateConfig = {
    LISTENING: { color: 'bg-success', text: '监听中', textColor: 'text-success' },
    ESTABLISHED: { color: 'bg-accent', text: '已连接', textColor: 'text-accent' },
    TIME_WAIT: { color: 'bg-warning', text: '等待关闭', textColor: 'text-warning' },
    CLOSE_WAIT: { color: 'bg-error', text: '等待关闭', textColor: 'text-error' }
  }[port.state] ?? { color: 'bg-surface-400', text: port.state || 'UNKNOWN', textColor: 'text-text-muted' }

  return (
    <>
      <div
        data-testid={`port-list-item-${port.port}-${port.pid}`}
        data-port-number={port.port}
        data-port-pid={port.pid}
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
              <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                <TruncatedText text={port.processName} className="text-sm font-bold text-text-primary" maxWidth="12rem" />
                <span className="text-xs text-text-muted font-mono bg-surface-700 px-2 py-0.5 whitespace-nowrap radius-sm">
                  PID: {port.pid}
                </span>
                {portLabel && (
                  <span className="text-[9px] text-text-muted bg-surface-700 px-1.5 py-0.5 whitespace-nowrap radius-sm">
                    {portLabel}
                  </span>
                )}
                {isCommon && !portLabel && (
                  <span className="text-[10px] bg-info/10 text-info px-1.5 py-0.5 border-l-2 border-info whitespace-nowrap radius-sm">
                    常用
                  </span>
                )}
                {hasConflict && (
                  <span className="text-[10px] bg-error/10 text-error px-1.5 py-0.5 border-l-2 border-error font-bold uppercase tracking-wider whitespace-nowrap radius-sm">
                    冲突
                  </span>
                )}
                <SecurityTierBadge tier={securityTier} />
              </div>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <p className="text-xs text-text-tertiary font-mono truncate min-w-0">{port.localAddress}</p>
                {port.foreignAddress && port.foreignAddress !== '*:*' && port.foreignAddress !== '0.0.0.0:0' && (
                  <>
                    <span className="text-[10px] text-text-muted whitespace-nowrap">&rarr;</span>
                    <TruncatedText text={port.foreignAddress} className="text-xs text-warning/70 font-mono" maxWidth="12rem" />
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
        relative shrink-0 px-3 py-2 font-mono text-sm font-bold transition-all duration-200
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

export function PortView({ initialTarget }: DetachableViewProps = {}) {
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

  // Hydrate the focused port from a detach target (port-detail popout / drawer)
  // once on mount, reusing the existing selection store rather than a new prop.
  useEffect(() => {
    if (initialTarget?.kind !== 'port') return
    const port = Number.parseInt(initialTarget.value, 10)
    if (Number.isInteger(port) && port > 0) selectPort(port)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [viewMode, setViewModeState] = useState<PortViewMode>(() => normalizePortViewMode(window.localStorage.getItem(PORT_VIEW_MODE_STORAGE_KEY)))
  const [filter, setFilter] = useState<PortFilterMode>('all')
  const [searchPort, setSearchPort] = useState('')
  const [focusedPort, setFocusedPort] = useState<PortInfo | null>(null)
  const [popoutSettings, setPopoutSettings] = useState<PortPopoutSettings>(() => mergePortPopoutSettings(undefined))
  const [isPortTourOpen, setIsPortTourOpen] = useState(() => window.localStorage.getItem(PORT_MODULE_TOUR_STORAGE_KEY) !== 'dismissed')
  const [portTourStep, setPortTourStep] = useState(0)
  const setPortStorePopoutSettings = usePortStore(state => state.setPopoutSettings)
  const portPopoutManager = usePopoutManager(ports, popoutSettings.syncPolicyDefault)
  const { entries: blocklistEntries } = useBlocklist(true)

  const setViewMode = useCallback((mode: PortViewMode) => {
    setViewModeState(mode)
    window.localStorage.setItem(PORT_VIEW_MODE_STORAGE_KEY, mode)
  }, [])

  const handlePopoutSyncStateChange = useCallback((next: {
    selectedPort: number | null
    filter: PortFilterMode
    searchPort: string
    viewMode: PortViewMode
  }) => {
    if (next.selectedPort !== selectedPort) {
      selectPort(next.selectedPort)
    }

    const nextFilter = normalizePortFilterMode(next.filter)
    if (nextFilter !== filter) setFilter(nextFilter)

    if (next.searchPort !== searchPort) setSearchPort(next.searchPort)

    const nextViewMode = normalizePortViewMode(next.viewMode)
    if (nextViewMode !== viewMode) setViewMode(nextViewMode)
  }, [filter, searchPort, selectPort, selectedPort, setViewMode, viewMode])

  usePopoutSync({
    state: {
      selectedPort,
      filter,
      searchPort,
      viewMode
    },
    policy: popoutSettings.syncPolicyDefault,
    onStateChange: handlePopoutSyncStateChange,
  })

  const applyPopoutSettings = useCallback((settings: AppSettings | null | undefined) => {
    const merged = mergePortPopoutSettings(settings)
    setPopoutSettings(merged)
    setPortStorePopoutSettings(merged)
  }, [setPortStorePopoutSettings])

  const tryOpenRequestedPopout = useCallback((detail: { port: number; trigger: PortPopoutTrigger; anchor?: PortPopoutPosition }) => {
    const targetPort = ports.find(port => port.port === detail.port)
    if (!targetPort) return false
    portPopoutManager.open(targetPort, detail.trigger, detail.anchor)
    return true
  }, [portPopoutManager, ports])

  useEffect(() => {
    const handlePopoutRequest = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail
      if (!isPortPopoutRequestDetail(detail)) return
      if (tryOpenRequestedPopout(detail) || ports.length > 0) {
        clearPendingPortPopoutRequest()
      }
    }

    const pendingRequest = peekPendingPortPopoutRequest()
    if (pendingRequest && (tryOpenRequestedPopout(pendingRequest) || ports.length > 0)) {
      clearPendingPortPopoutRequest()
    }

    window.addEventListener(PORT_POPOUT_REQUEST_EVENT, handlePopoutRequest)
    return () => window.removeEventListener(PORT_POPOUT_REQUEST_EVENT, handlePopoutRequest)
  }, [ports.length, tryOpenRequestedPopout])

  useEffect(() => {
    let cancelled = false
    const loadSettings = window.devhub?.settings?.get?.()
    const handleSettingsChange = (event: Event) => {
      const detail = (event as CustomEvent<AppSettings | null | undefined>).detail
      applyPopoutSettings(detail)
    }
    window.addEventListener(APP_SETTINGS_CHANGE_EVENT, handleSettingsChange)
    if (!loadSettings) {
      applyPopoutSettings(undefined)
      return () => {
        cancelled = true
        window.removeEventListener(APP_SETTINGS_CHANGE_EVENT, handleSettingsChange)
      }
    }

    void loadSettings
      .then((settings) => {
        if (!cancelled) {
          applyPopoutSettings(settings)
        }
      })
      .catch(() => {
        if (!cancelled) {
          applyPopoutSettings(undefined)
        }
      })

    return () => {
      cancelled = true
      window.removeEventListener(APP_SETTINGS_CHANGE_EVENT, handleSettingsChange)
    }
  }, [applyPopoutSettings])

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
      case 'exposed': {
        const tier = classifyPortForView(port, blocklistEntries).tier
        return tier === 'WAN-Capable' || tier === 'Suspicious'
      }
      default:
        return true
    }
  })

  const activeConflicts = useMemo(() => getActiveConflicts(), [getActiveConflicts])

  const conflictingPortNumbers = useMemo(() => getConflictingPorts(ports), [ports])

  const portSecuritySummary = useMemo<PortModuleTourSecuritySummary>(() => {
    const summary: PortModuleTourSecuritySummary = {
      total: ports.length,
      local: 0,
      lan: 0,
      wanCapable: 0,
      suspicious: 0,
    }

    for (const port of ports) {
      const tier = classifyPortForView(port, blocklistEntries).tier
      if (tier === 'Local') summary.local += 1
      if (tier === 'LAN') summary.lan += 1
      if (tier === 'WAN-Capable') summary.wanCapable += 1
      if (tier === 'Suspicious') summary.suspicious += 1
    }

    return summary
  }, [blocklistEntries, ports])

  const portsByState = useMemo(() => ({
    listening: ports.filter(p => p.state === 'LISTENING').length,
    established: ports.filter(p => p.state === 'ESTABLISHED').length,
    other: ports.filter(p => !['LISTENING', 'ESTABLISHED'].includes(p.state)).length
  }), [ports])

  const tourTargetPort = useMemo(() => {
    const selected = selectedPort === null ? undefined : ports.find(port => port.port === selectedPort)
    return selected ?? focusedPort ?? filteredPorts[0] ?? ports[0] ?? null
  }, [filteredPorts, focusedPort, ports, selectedPort])

  const dismissPortTour = useCallback(() => {
    window.localStorage.setItem(PORT_MODULE_TOUR_STORAGE_KEY, 'dismissed')
    setIsPortTourOpen(false)
  }, [])

  const openPortTour = useCallback(() => {
    setPortTourStep(0)
    setIsPortTourOpen(true)
  }, [])

  const openTourPopout = useCallback(() => {
    if (!tourTargetPort) return
    selectPort(tourTargetPort.port)
    setFocusedPort(tourTargetPort)
    portPopoutManager.open(tourTargetPort, 'api')
  }, [portPopoutManager, selectPort, tourTargetPort])

  const reviewTourSecurity = useCallback(() => {
    setFilter('all')
    setSearchPort('')
    if (viewMode === 'relationship') {
      setViewMode('cards')
    }
  }, [setViewMode, viewMode])

  const openTourRelationshipGraph = useCallback(() => {
    if (tourTargetPort) {
      selectPort(tourTargetPort.port)
      setFocusedPort(tourTargetPort)
    }
    setViewMode('relationship')
  }, [selectPort, setViewMode, tourTargetPort])

  const renderPortCollection = () => (
    <>
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
                isPopoutOpen={portPopoutManager.isOpen(port)}
                popoutSettings={popoutSettings}
                blocklistEntries={blocklistEntries}
                onSelect={() => {
                  selectPort(port.port)
                  setFocusedPort(port)
                }}
                onViewInGraph={() => {
                  selectPort(port.port)
                  setFocusedPort(port)
                  setViewMode('relationship')
                }}
                onRelease={() => releasePort(port.port)}
                onOpenPopout={(trigger, anchor) => portPopoutManager.open(port, trigger, anchor)}
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
                blocklistEntries={blocklistEntries}
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
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <LoadingSpinner size="md" className="mb-4" />
          <p className="text-text-secondary">正在扫描端口...</p>
        </div>
      )}

      {filteredPorts.length === 0 && !isScanning && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
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
    </>
  )

  return (
    <div
      data-testid="port-view-root"
      data-port-view-mode={viewMode}
      data-port-view-modes={PORT_VIEW_MODES.join(',')}
      className="h-full min-h-0 flex flex-col bg-surface-950"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b-2 border-surface-700 bg-surface-900 relative">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />

        <div className="flex items-center flex-wrap justify-between gap-y-2 relative z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 bg-surface-700 flex items-center justify-center border-l-3 border-accent radius-sm flex-shrink-0">
              <PortIcon size={20} className="text-accent" />
            </div>
            <div className="min-w-0 truncate">
              <h2
                className="text-text-primary font-bold uppercase tracking-wider whitespace-nowrap"
                style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}
              >
                端口监控
              </h2>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="font-mono whitespace-nowrap">{ports.length} 个端口</span>
                <LastScanTime lastScanTime={lastScanTime} />
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="搜索端口..."
                value={searchPort}
                onChange={(e) => setSearchPort(e.target.value)}
                className="input-sm w-40 lg:w-48 pl-9"
              />
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter */}
              <div className="flex items-center bg-surface-800 p-1 border border-surface-700 radius-sm">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'common', label: '常用' },
                  { key: 'listening', label: '监听' }
                  , { key: 'exposed', label: '风险' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key as typeof filter)}
                    className={`
                      px-2.5 py-1.5 text-xs transition-all duration-200
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
                onChange={(mode) => setViewMode(normalizePortViewMode(mode))}
              />
            </div>

            <button
              data-testid="port-module-tour-open-button"
              onClick={openPortTour}
              className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 py-1.5 xl:px-3"
              aria-label="打开端口模块导览"
              title="端口导览"
            >
              <InfoIcon size={14} />
              <span className="hidden xl:inline">导览</span>
            </button>

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

            <PanelDetachButton surface="port-detail" target={selectedPort === null ? null : `port:${selectedPort}`} />
          </div>
        </div>
      </div>

      <PublicPortBanner
        ports={ports}
        blocklistEntries={blocklistEntries}
        onReview={() => {
          setFilter('exposed')
          setSearchPort('')
        }}
      />

      <PortModuleTour
        isOpen={isPortTourOpen}
        stepIndex={portTourStep}
        portCount={ports.length}
        targetPort={tourTargetPort}
        securitySummary={portSecuritySummary}
        onStepChange={setPortTourStep}
        onDismiss={dismissPortTour}
        onOpenPopout={openTourPopout}
        onReviewSecurity={reviewTourSecurity}
        onOpenRelationshipGraph={openTourRelationshipGraph}
      />

      {/* Hero Stats */}
      <div className="flex-shrink-0 px-5 py-2 stat-grid port-stat-grid border-b border-surface-700/50 bg-surface-900/50">
        <StatCard
          compact
          icon={<PortIcon size={16} className="text-accent" />}
          label="活跃端口"
          value={ports.length}
          color="accent"
        />
        <StatCard
          compact
          icon={<PortIcon size={16} className="text-success" />}
          label="监听中"
          value={portsByState.listening}
          color="success"
        />
        <StatCard
          compact
          icon={<PortIcon size={16} className="text-info" />}
          label="已连接"
          value={portsByState.established}
          color="default"
        />
        <StatCard
          compact
          icon={<AlertIcon size={16} className="text-error" />}
          label="端口冲突"
          value={activeConflicts.length}
          color={activeConflicts.length > 0 ? 'error' : 'default'}
        />
      </div>

      {/* Quick Port View */}
      <div className="flex-shrink-0 px-5 py-2 border-b border-surface-700/30 bg-surface-900/30">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-xs text-text-muted font-medium uppercase tracking-wider">常用端口:</span>
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-1 pr-1">
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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">
          <div className="flex-1 min-h-0 min-w-0">
            <PortRelationshipGraph
              focusPort={selectedPort}
              onNodeClick={handleGraphNodeClick}
            />
          </div>
          {focusedPort && (
            <div className="w-full lg:w-[clamp(20rem,30vw,35rem)] lg:min-w-[20rem] h-full min-h-0">
              <PortFocusPanel
                port={focusedPort}
                onClose={closeFocusPanel}
                getPortFocusData={getPortFocusData}
                getPortDetailIncremental={getPortDetailIncremental}
                cancelPortQuery={cancelPortQuery}
                allPorts={ports}
                lastScanTime={lastScanTime}
                blocklistEntries={blocklistEntries}
                onFocusProcess={(pid) => {
                  navigateMonitorTab('process', {
                    detail: { pid, scope: { kind: 'process', targetId: pid, depth: 2 } }
                  })
                }}
                onViewInGraph={(port) => {
                  selectPort(port)
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          {focusedPort ? (
            <PanelSplitter
              direction="horizontal"
              defaultSizes={[70, 30]}
              minSizes={[640, 360]}
              maxSizes={[9999, 560]}
              storageKey="devhub:port-view-split"
              stackBelow={900}
            >
              <div
                data-testid="port-list-scroll"
                role="region"
                aria-label="端口列表滚动区域"
                tabIndex={0}
                className="h-full min-h-0 overflow-y-scroll p-5 pr-3 outline-none"
                style={{ scrollbarGutter: 'stable both-edges' }}
              >
                {renderPortCollection()}
              </div>
              <div className="h-full min-h-0">
                <PortFocusPanel
                  port={focusedPort}
                  onClose={closeFocusPanel}
                  getPortFocusData={getPortFocusData}
                  getPortDetailIncremental={getPortDetailIncremental}
                  cancelPortQuery={cancelPortQuery}
                  allPorts={ports}
                  lastScanTime={lastScanTime}
                  blocklistEntries={blocklistEntries}
                  onFocusProcess={(pid) => {
                    navigateMonitorTab('process', {
                      detail: { pid, scope: { kind: 'process', targetId: pid, depth: 2 } }
                    })
                  }}
                  onViewInGraph={(port) => {
                    setViewMode('relationship')
                    selectPort(port)
                  }}
                />
              </div>
            </PanelSplitter>
          ) : (
            <div
              data-testid="port-list-scroll"
              role="region"
              aria-label="端口列表滚动区域"
              tabIndex={0}
              className="h-full min-h-0 overflow-y-scroll p-5 pr-3 outline-none"
              style={{ scrollbarGutter: 'stable both-edges' }}
            >
              {renderPortCollection()}
            </div>
          )}
        </div>
      )}
      <PortPopoutHost
        popouts={portPopoutManager.popouts}
        onClose={portPopoutManager.close}
        onMinimize={portPopoutManager.minimize}
        onThemeIsolate={portPopoutManager.isolateTheme}
        onMove={portPopoutManager.move}
        onResize={portPopoutManager.resize}
        onPromote={portPopoutManager.promote}
      />
    </div>
  )
}
