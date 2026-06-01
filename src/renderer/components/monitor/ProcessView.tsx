import React, { useEffect, memo, useState, useCallback, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PanelDetachButton } from '../popout/PanelDetachButton'
import type { DetachableViewProps } from '../popout/detachable-registry'
import { useSystemProcesses } from '../../hooks/useSystemProcesses'
import { ProcessInfo, ProcessGroup, SortColumn } from '@shared/types-extended'
import { PROCESS_BATCH_LIMITS, processBatchTagArgsSchema } from '@shared/schemas/r8-runtime'
import type {
  ProcessBatchAction,
  ProcessBatchProgress as ProcessBatchProgressState,
  ProcessBatchRequest,
  ProcessHistory,
  ProcessTag,
  ProcessTagColor,
  ProcessViewMode
} from '@shared/schemas/r8-runtime'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ContextMenu } from '../ui/ContextMenu'
import { useToast } from '../ui/Toast'
import { StatCard } from '../ui/StatCard'
import { ViewModeToggle } from '../ui/ViewModeToggle'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { LastScanTime } from '../ui/LastScanTime'
import { formatBytes } from '../../utils/formatNumber'
import { navigateMonitorTab } from '../../utils/navigateMonitorTab'
import { ProcessFilterBar, SortIndicator } from './ProcessFilterBar'
import { ProcessDetailPanel } from './ProcessDetailPanel'
import { ProcessDetailDrawer } from './ProcessDetailDrawer'
import { ProcessCardErrorBoundary } from './ProcessCardErrorBoundary'
import { ProcessModuleTour, PROCESS_MODULE_TOUR_STORAGE_KEY } from './process/ProcessModuleTour'
import { ProcessModuleHelp } from './process/ProcessModuleHelp'
import { getProcessModuleNewBadgeState, PROCESS_MODULE_NEW_BADGE_WINDOW_DAYS } from './process/processModuleRelease'
import { Sparkline } from './Sparkline'
import { TruncatedText } from '../ui/TruncatedText'
import { PROCESS_VM_FIELD_LIST } from './process-vm-contract'
import { ProcessTreeView } from './process/ProcessTreeView'
import { ProcessTreemapView } from './process/ProcessTreemapView'
import { ProcessBatchProgress } from './process/ProcessBatchProgress'
import { ProcessBatchToolbar } from './process/ProcessBatchToolbar'
import { ProcessBatchTagDialog } from './process/ProcessBatchTagDialog'
import { ProcessTagBadge } from './process/ProcessTagBadge'
import { ProcessTagEditor } from './process/ProcessTagEditor'
import { ProcessSparkline } from './process/ProcessSparkline'
import { CardEdgeGraphBadge } from './CardEdgeGraphBadge'
import {
  buildProcessBatchConfirmMessage,
  createProcessBatchRequest,
  getBlockedSystemKillPids,
  PROCESS_BATCH_ACTION_LABELS,
  requiresProcessBatchConfirmation,
  runSequentialProcessBatch,
  summarizeProcessBatchProgress
} from './process/processBatchModel'
import { useProcessSelection, type ProcessSelectionGesture } from '../../hooks/useProcessSelection'
import { useProcessTagRegistry } from '../../hooks/useProcessTag'
import { useProcessHistory24h } from '../../hooks/useProcessHistory'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import {
  ProcessIcon,
  GearIcon,
  LightningIcon,
  RefreshIcon,
  CloseIcon,
  AlertIcon,
  ChevronDownIcon,
  GridIcon,
  ListIcon,
  GroupIcon,
  EyeIcon,
  FolderIcon,
  CopyIcon,
  TreeIcon,
  TagIcon,
  InfoIcon,
  WindowIcon
} from '../icons'

// ============ Utility Functions ============

function getResourceColor(percent: number): { text: string; bg: string } {
  if (percent > 80) return { text: 'text-error', bg: 'bg-error' }
  if (percent > 50) return { text: 'text-warning', bg: 'bg-warning' }
  if (percent > 25) return { text: 'text-gold', bg: 'bg-gold' }
  return { text: 'text-accent', bg: 'bg-accent' }
}

function runProcessBatchViaIpc(
  request: ProcessBatchRequest,
  onProgress: (progress: ProcessBatchProgressState) => void
): Promise<ProcessBatchProgressState> {
  return new Promise((resolve, reject) => {
    let jobId: string | null = null
    let settled = false
    let unsubscribe: (() => void) | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
    }

    timeout = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('E_TIMEOUT: process batch did not finish within 120 seconds'))
    }, 120_000)

    unsubscribe = window.devhub.systemProcess.onBatchProgress((progress) => {
      if (!jobId || progress.jobId !== jobId || settled) return
      onProgress(progress)
      if (progress.state === 'completed' || progress.state === 'cancelled') {
        settled = true
        cleanup()
        resolve(progress)
      }
    })

    window.devhub.systemProcess.batchOp(request)
      .then(response => {
        jobId = response.jobId
      })
      .catch((error: unknown) => {
        if (settled) return
        settled = true
        cleanup()
        reject(error instanceof Error ? error : new Error('process batch IPC failed'))
      })
  })
}

type ProcessToast = ReturnType<typeof useToast>['showToast']

async function openProcessBrowserPopout(input: { pid: number; name: string; showToast: ProcessToast }) {
  try {
    await window.devhub.r8.popout.create({
      surface: 'process',
      targetId: input.pid,
      mode: 'browserwindow',
      route: '/monitor',
      title: `Process ${input.name} (${input.pid})`
    })
    input.showToast('success', '进程已在新窗口打开')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    input.showToast('error', `进程弹出失败：${message}`)
  }
}

function getMemoryResourceColor(percent: number): { text: string; bg: string } {
  if (percent > 80) return { text: 'text-error', bg: 'bg-error' }
  if (percent > 50) return { text: 'text-warning', bg: 'bg-warning' }
  if (percent > 25) return { text: 'text-gold', bg: 'bg-gold' }
  return { text: 'text-info', bg: 'bg-info' }
}

function calcMemoryPercent(memory: number, maxMemory: number): number {
  if (maxMemory <= 0) return 0
  return Math.min((memory / maxMemory) * 100, 100)
}

function formatStartTime(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚启动'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d`
}

function isInteractiveProcessSurfaceTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, select, [role="button"]'))
}

function isProcessMultiSelectGesture(gesture: ProcessSelectionGesture): boolean {
  return Boolean(gesture.ctrlKey || gesture.metaKey || gesture.shiftKey)
}

function getProcessParentLabel(process: ProcessInfo): string {
  const parentPid = typeof process.ppid === 'number' && Number.isFinite(process.ppid) ? Math.trunc(process.ppid) : 0
  if (parentPid <= 0) return '父进程: -'
  if (typeof process.parentName === 'string' && process.parentName.length > 0) {
    return `父: ${process.parentName} (${parentPid})`
  }
  return `PPID: ${parentPid}`
}

// Process type icon config
const TYPE_ICONS: Record<string, { icon: React.ReactNode; label: string; borderColor: string }> = {
  'dev-server': {
    icon: <LightningIcon size={20} className="text-accent" />,
    label: '开发服务',
    borderColor: 'border-accent'
  },
  'ai-tool': {
    icon: <GearIcon size={20} className="text-steel" />,
    label: 'AI 工具',
    borderColor: 'border-steel'
  },
  'build': {
    icon: <ProcessIcon size={20} className="text-gold" />,
    label: '构建',
    borderColor: 'border-gold'
  },
  'database': {
    icon: <ProcessIcon size={20} className="text-info" />,
    label: '数据库',
    borderColor: 'border-info'
  },
  'other': {
    icon: <GearIcon size={20} className="text-text-muted" />,
    label: '其他',
    borderColor: 'border-surface-500'
  }
}

// ============ Sortable Table Header ============

interface SortableHeaderProps {
  column: SortColumn
  label: string
  className?: string
  sortConfigs: import('@shared/types-extended').SortConfig[]
  onSort: (column: SortColumn, append: boolean) => void
}

const SortableHeader = memo(function SortableHeader({ column, label, className = '', sortConfigs, onSort }: SortableHeaderProps) {
  return (
    <button
      className={`flex items-center gap-0.5 text-[10px] text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors select-none ${className}`}
      onClick={(e) => onSort(column, e.shiftKey)}
      title={`点击排序，Shift+点击添加次级排序`}
    >
      {label}
      <SortIndicator column={column} sortConfigs={sortConfigs} />
    </button>
  )
})

// ============ Process Card (Card View with Sparklines) ============

interface ProcessCardProps {
  process: ProcessInfo
  index: number
  maxMemory: number
  cpuHistory?: number[]
  memoryHistory?: number[]
  processTag?: ProcessTag
  history24h?: ProcessHistory
  onKill: () => void
  onShowDetail: (pid: number) => void
  onShowTree: (pid: number) => void
  onEditTag: (process: ProcessInfo) => void
  showOperationMenu?: boolean
}

interface BatchTagUndoItem {
  pid: number
  process: Pick<ProcessInfo, 'name' | 'workingDir'>
  previousTag?: ProcessTag
}

interface BatchTagUndoState {
  label: string
  expiresAt: number
  items: BatchTagUndoItem[]
}

interface PendingProcessBatchConfirm {
  request: ProcessBatchRequest
  tagUndoSnapshot: BatchTagUndoItem[]
  tagUndoLabel?: string
}

export const ProcessCard = memo(function ProcessCard({ process, index, maxMemory, cpuHistory, memoryHistory, processTag, history24h, onKill, onShowDetail, onShowTree, onEditTag, showOperationMenu = false }: ProcessCardProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [commandExpanded, setCommandExpanded] = useState(false)
  const { showToast } = useToast()

  // Defensive: safely access process fields with fallbacks
  const pName = process?.name ?? 'Unknown'
  const pPid = process?.pid ?? 0
  const pCpu = Number.isFinite(process?.cpu) ? process.cpu : 0
  const pMemory = Number.isFinite(process?.memory) ? process.memory : 0
  const pStatus = process?.status ?? 'running'
  const pType = process?.type ?? 'other'
  const pCommand = process?.command ?? ''
  const pPort = process?.port
  const pWorkingDir = process?.workingDir
  const pStartTime = process?.startTime ?? 0
  const pParentLabel = getProcessParentLabel(process)

  const typeConfig = TYPE_ICONS[pType] || TYPE_ICONS['other']

  const statusConfig = {
    running: { color: 'bg-success', text: '运行中', textColor: 'text-success' },
    idle: { color: 'bg-warning', text: '空闲', textColor: 'text-warning' },
    waiting: { color: 'bg-surface-400', text: '等待中', textColor: 'text-text-muted' },
    unknown: { color: 'bg-surface-400', text: '未知', textColor: 'text-text-muted' }
  }[pStatus] ?? { color: 'bg-surface-400', text: pStatus || 'unknown', textColor: 'text-text-muted' }

  const cpuColor = getResourceColor(pCpu)
  const memPercent = calcMemoryPercent(pMemory, maxMemory)
  const memColor = getMemoryResourceColor(memPercent)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    if (!showOperationMenu) return
    setContextMenuPos({ x: 320, y: 180 })
  }, [showOperationMenu])

  const handleCopyCommand = async () => {
    if (pCommand) {
      await navigator.clipboard.writeText(pCommand)
      showToast('success', '命令已复制到剪贴板')
    }
  }

  const handleCopyPid = async () => {
    await navigator.clipboard.writeText(String(pPid))
    showToast('success', 'PID 已复制到剪贴板')
  }

  const handleOpenDir = () => {
    if (pWorkingDir) {
      window.devhub.shell.openPath(pWorkingDir)
    } else {
      showToast('warning', '该进程没有工作目录信息')
    }
  }

  const handleOpenProcessPopout = () => openProcessBrowserPopout({ pid: pPid, name: pName, showToast })

  const contextMenuItems = [
    { label: '查看详情', icon: <EyeIcon size={16} />, onClick: () => onShowDetail(pPid) },
    { label: '弹出进程', icon: <WindowIcon size={16} />, onClick: () => { void handleOpenProcessPopout() } },
    { label: '打开目录', icon: <FolderIcon size={16} />, onClick: handleOpenDir, disabled: !pWorkingDir },
    { label: '复制 PID', icon: <CopyIcon size={16} />, onClick: handleCopyPid },
    { label: '复制命令', icon: <CopyIcon size={16} />, onClick: handleCopyCommand, disabled: !pCommand },
    { label: '进程树', icon: <TreeIcon size={16} />, onClick: () => onShowTree(pPid) },
    { label: processTag ? '编辑标签' : '添加标签', icon: <TagIcon size={16} />, onClick: () => onEditTag(process) },
    { label: '', onClick: () => {}, divider: true },
    { label: '终止进程', icon: <CloseIcon size={16} />, onClick: () => setShowKillConfirm(true), danger: true }
  ]

  const openProcessCardGraph = () => {
    navigateMonitorTab('process', {
      detail: { scope: { kind: 'process', targetId: pPid, depth: 2 } }
    })
  }

  const handleCardDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isInteractiveProcessSurfaceTarget(event.target)) return
    event.preventDefault()
    onShowDetail(pPid)
  }

  return (
    <>
      <div
        data-testid={`process-card-${pPid}`}
        data-detail-entry="process-card-double-click"
        data-vm-surface="card"
        data-vm-pid={pPid}
        data-vm-fields={PROCESS_VM_FIELD_LIST}
        className="monitor-card group relative overflow-hidden animate-card-stagger cursor-pointer"
        style={{ animationDelay: `${Math.min(index, 20) * 50}ms` }}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleCardDoubleClick}
        title="双击打开详情"
      >
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />
        <CardEdgeGraphBadge
          testId={`process-card-graph-badge-${pPid}`}
          graphEntry="process-card-attached-topology"
          scopeKind="process"
          targetId={pPid}
          ariaLabel={`查看进程 ${pPid} 关系图`}
          onClick={openProcessCardGraph}
        />

        {pStatus === 'running' && (
          <div className="absolute top-3 right-12">
            <span className="status-dot status-dot-running" />
          </div>
        )}

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div
              data-vm-field="type"
              data-vm-status="ok"
              data-vm-source="ProcessInfo"
              className={`w-9 h-9 bg-surface-800 flex items-center justify-center border-l-3 ${typeConfig.borderColor} radius-sm`}
            >
              {typeConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span data-vm-field="name" data-vm-status="ok" data-vm-source="ProcessInfo">
                <TruncatedText text={pName} className="text-sm font-bold text-text-primary" />
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span data-vm-field="status" data-vm-status="ok" data-vm-source="ProcessInfo" className={`status-badge ${pStatus === 'running' ? 'status-badge-running' : ''}`}>
                  <span className={`w-1.5 h-1.5 ${statusConfig.color} radius-sm`} />
                  {statusConfig.text}
                </span>
                <span data-vm-field="pid" data-vm-status="ok" data-vm-source="ProcessInfo" className="text-[10px] text-text-muted font-mono">PID: {pPid}</span>
                <span data-vm-field="ppid" data-vm-status={process.ppid ? 'ok' : 'data_missing'} data-vm-source="ProcessInfo" className="text-[10px] text-text-muted font-mono">{pParentLabel}</span>
                <ProcessTagBadge compact onClick={() => onEditTag(process)} showEmpty tag={processTag} />
              </div>
            </div>
          </div>

          {/* Ports (multi-port display) */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {pPort ? (
              <span data-vm-field="port" data-vm-status="ok" data-vm-source="ProcessInfo" className="text-xs font-bold font-mono bg-gold/10 text-gold px-2 py-0.5 border-l-2 border-gold radius-sm">
                :{pPort}
              </span>
            ) : (
              <span data-vm-field="port" data-vm-status="data_missing" data-vm-source="ProcessInfo" className="text-xs text-text-muted font-mono px-2 py-0.5 bg-surface-900 radius-sm">
                无端口
              </span>
            )}
            <span data-vm-field="startTime" data-vm-status="ok" data-vm-source="ProcessInfo" className="text-[10px] text-text-muted">{formatStartTime(pStartTime)}</span>
          </div>

          {/* Command Line Summary (expandable) */}
          <div
            data-vm-field="command"
            data-vm-status={pCommand ? 'ok' : 'data_missing'}
            data-vm-source="ProcessInfo"
            className="mb-2"
          >
            {pCommand ? (
              <button
                onClick={() => setCommandExpanded(!commandExpanded)}
                className="w-full text-left"
              >
                {commandExpanded ? (
                  <p className="text-[10px] font-mono text-text-muted bg-surface-900 px-2 py-1 hover:bg-surface-800 transition-colors break-all radius-sm">
                    $ {pCommand}
                  </p>
                ) : (
                  <div className="bg-surface-900 px-2 py-1 hover:bg-surface-800 transition-colors radius-sm">
                    <TruncatedText text={`$ ${pCommand}`} className="text-[10px] font-mono text-text-muted" />
                  </div>
                )}
              </button>
            ) : (
              <span className="sr-only">无命令行信息</span>
            )}
          </div>

          {/* CPU/Memory with Sparklines */}
          <div className="space-y-2 mb-3">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-text-muted uppercase tracking-wider">CPU</span>
                <div className="flex items-center gap-2">
                  {cpuHistory && cpuHistory.length > 1 && (
                    <Sparkline data={cpuHistory} width={60} height={14} color="var(--accent)" threshold={80} />
                  )}
                  <span data-vm-field="cpu" data-vm-status="ok" data-vm-source="ProcessInfo" className={`font-mono font-bold ${cpuColor.text}`}>{pCpu.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-surface-800 radius-sm">
                <div
                  className={`h-full transition-all duration-500 ${cpuColor.bg}`}
                  style={{ width: `${Math.min(pCpu, 100)}%`, borderRadius: '1px' }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-text-muted uppercase tracking-wider">内存</span>
                <div className="flex items-center gap-2">
                  {memoryHistory && memoryHistory.length > 1 && (
                    <Sparkline data={memoryHistory} width={60} height={14} color="var(--info)" />
                  )}
                  <span data-vm-field="memory" data-vm-status="ok" data-vm-source="ProcessInfo" className={`font-mono font-bold ${memColor.text}`}>{pMemory}MB</span>
                </div>
              </div>
              <div className="h-1.5 bg-surface-800 radius-sm">
                <div
                  className={`h-full transition-all duration-500 ${memColor.bg}`}
                  style={{ width: `${memPercent}%`, borderRadius: '1px' }}
                />
              </div>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between border-t border-surface-800 pt-2 text-[10px]">
            <span className="text-text-muted uppercase tracking-wider">24h CPU</span>
            <ProcessSparkline history={history24h} metric="cpu" width={92} />
          </div>

          {/* Quick Actions -- always visible */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-surface-700">
            <button
              onClick={() => setShowKillConfirm(true)}
              className="btn-icon-sm text-error/60 hover:text-error hover:bg-error/20 transition-all"
              title="终止进程"
            >
              <CloseIcon size={14} />
            </button>
            <button
              onClick={handleOpenDir}
              className="btn-icon-sm text-text-muted hover:text-text-primary hover:bg-surface-700 transition-all"
              title="打开目录"
              disabled={!pWorkingDir}
            >
              <FolderIcon size={14} />
            </button>
            <button
              onClick={handleCopyCommand}
              className="btn-icon-sm text-text-muted hover:text-text-primary hover:bg-surface-700 transition-all"
              title="复制命令"
              disabled={!pCommand}
            >
              <CopyIcon size={14} />
            </button>
            <button
              onClick={() => onShowDetail(pPid)}
              className="btn-icon-sm text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
              title="查看详情"
            >
              <EyeIcon size={14} />
            </button>
            <button
              onClick={() => onShowTree(pPid)}
              className="btn-icon-sm text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
              title="关系图"
            >
              <TreeIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      <ContextMenu items={contextMenuItems} position={contextMenuPos} onClose={() => setContextMenuPos(null)} />
      <ConfirmDialog
        isOpen={showKillConfirm}
        title="终止进程"
        message={`确定要终止进程 "${pName}" (PID: ${pPid}) 吗？`}
        confirmText="终止"
        variant="danger"
        onConfirm={() => { setShowKillConfirm(false); onKill() }}
        onCancel={() => setShowKillConfirm(false)}
      />
    </>
  )
})

// ============ Process Item (List View - used in virtual list) ============

interface ProcessItemProps {
  process: ProcessInfo
  maxMemory: number
  isSelected: boolean
  processTag?: ProcessTag
  history24h?: ProcessHistory
  onSelect: (event: React.MouseEvent<HTMLDivElement>) => void
  onKill: () => void
  onShowDetail: (pid: number) => void
  onShowTree: (pid: number) => void
  onEditTag: (process: ProcessInfo) => void
}

export const ProcessItem = memo(function ProcessItem({ process, maxMemory, isSelected, processTag, history24h, onSelect, onKill, onShowDetail, onShowTree, onEditTag }: ProcessItemProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const { showToast } = useToast()

  // Defensive: safely access process fields with fallbacks
  const pName = process?.name ?? 'Unknown'
  const pPid = process?.pid ?? 0
  const pCpu = Number.isFinite(process?.cpu) ? process.cpu : 0
  const pMemory = Number.isFinite(process?.memory) ? process.memory : 0
  const pStatus = process?.status ?? 'running'
  const pType = process?.type ?? 'other'
  const pCommand = process?.command ?? ''
  const pPort = process?.port
  const pWorkingDir = process?.workingDir
  const pStartTime = process?.startTime ?? 0
  const pParentLabel = getProcessParentLabel(process)

  const typeConfig = TYPE_ICONS[pType] || TYPE_ICONS['other']
  const statusColor = {
    running: 'bg-success',
    idle: 'bg-warning',
    waiting: 'bg-surface-500',
    unknown: 'bg-surface-400'
  }[pStatus] ?? 'bg-surface-400'
  const cpuColor = getResourceColor(pCpu)
  const memPercent = calcMemoryPercent(pMemory, maxMemory)
  const memColor = getMemoryResourceColor(memPercent)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    onSelect(event)
    if (isProcessMultiSelectGesture(event) || isInteractiveProcessSurfaceTarget(event.target)) return
    onShowDetail(pPid)
  }

  const handleCopyCommand = async () => {
    if (pCommand) {
      await navigator.clipboard.writeText(pCommand)
      showToast('success', '命令已复制到剪贴板')
    }
  }

  const handleCopyPid = async () => {
    await navigator.clipboard.writeText(String(pPid))
    showToast('success', 'PID 已复制到剪贴板')
  }

  const handleOpenDir = () => {
    if (pWorkingDir) {
      window.devhub.shell.openPath(pWorkingDir)
    } else {
      showToast('warning', '该进程没有工作目录信息')
    }
  }

  const handleOpenProcessPopout = () => openProcessBrowserPopout({ pid: pPid, name: pName, showToast })

  const contextMenuItems = [
    { label: '查看详情', icon: <EyeIcon size={16} />, onClick: () => onShowDetail(pPid) },
    { label: '弹出进程', icon: <WindowIcon size={16} />, onClick: () => { void handleOpenProcessPopout() } },
    { label: '打开目录', icon: <FolderIcon size={16} />, onClick: handleOpenDir, disabled: !pWorkingDir },
    { label: '复制 PID', icon: <CopyIcon size={16} />, onClick: handleCopyPid },
    { label: '复制命令', icon: <CopyIcon size={16} />, onClick: handleCopyCommand, disabled: !pCommand },
    { label: '进程树', icon: <TreeIcon size={16} />, onClick: () => onShowTree(pPid) },
    { label: processTag ? '编辑标签' : '添加标签', icon: <TagIcon size={16} />, onClick: () => onEditTag(process) },
    { label: '', onClick: () => {}, divider: true },
    { label: '终止进程', icon: <CloseIcon size={16} />, onClick: () => setShowKillConfirm(true), danger: true }
  ]

  return (
    <>
      <div
        data-testid={`process-row-${pPid}`}
        data-detail-entry="process-row-click-drawer"
        data-vm-surface="list"
        data-vm-pid={pPid}
        data-vm-fields={PROCESS_VM_FIELD_LIST}
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
        className={`
          group flex items-center gap-3 px-4 py-2 cursor-pointer transition-all duration-200
          border-l-3 bg-surface-800 radius-sm min-h-[3rem] min-w-[820px]
          ${isSelected
            ? 'border-accent bg-accent/10'
            : 'border-transparent hover:border-surface-500 hover:bg-surface-700'
          }
        `}
      >
        {/* Status + Type Icon */}
        <div data-vm-field="type" data-vm-status="ok" data-vm-source="ProcessInfo" className="relative flex-shrink-0">
          <span data-vm-field="status" data-vm-status="ok" data-vm-source="ProcessInfo" className={`absolute -top-0.5 -right-0.5 w-2 h-2 ${statusColor} ${pStatus === 'running' ? 'status-dot-running' : ''} radius-sm`} />
          <div className={`w-6 h-6 bg-surface-700 flex items-center justify-center border-l-2 ${typeConfig.borderColor} radius-sm`}>
            {React.cloneElement(typeConfig.icon as React.ReactElement, { size: 14 })}
          </div>
        </div>

        {/* Name */}
        <span data-vm-field="name" data-vm-status="ok" data-vm-source="ProcessInfo" className="min-w-[6.25rem] max-w-[11.25rem]">
          <TruncatedText text={pName} className="text-xs font-bold text-text-primary" maxWidth="180px" />
        </span>

        <span className="min-w-[5.75rem] max-w-[7.5rem]">
          <ProcessTagBadge compact onClick={() => onEditTag(process)} showEmpty tag={processTag} />
        </span>

        {/* PID */}
        <span data-vm-field="pid" data-vm-status="ok" data-vm-source="ProcessInfo" className="text-[10px] text-text-muted font-mono min-w-[3.125rem]">{pPid}</span>

        {/* Parent */}
        <span data-vm-field="ppid" data-vm-status={process.ppid ? 'ok' : 'data_missing'} data-vm-source="ProcessInfo" className="text-[10px] text-text-muted font-mono min-w-[5.75rem] max-w-[7.5rem]">
          <TruncatedText text={pParentLabel} maxWidth="120px" />
        </span>

        {/* Port */}
        <span data-vm-field="port" data-vm-status={pPort ? 'ok' : 'data_missing'} data-vm-source="ProcessInfo" className={`text-[10px] font-mono min-w-[3.125rem] ${pPort ? 'text-gold font-bold' : 'text-text-muted'}`}>
          {pPort ? `:${pPort}` : '-'}
        </span>

        {/* CPU */}
        <div className="flex items-center gap-1 min-w-[4.375rem]">
          <div className="w-[30px] h-1 bg-surface-700 radius-sm">
            <div className={`h-full ${cpuColor.bg}`} style={{ width: `${Math.min(pCpu, 100)}%`, borderRadius: '1px' }} />
          </div>
          <span data-vm-field="cpu" data-vm-status="ok" data-vm-source="ProcessInfo" className={`text-[10px] font-mono font-bold ${cpuColor.text}`}>{pCpu.toFixed(1)}%</span>
        </div>

        {/* Memory */}
        <div className="flex items-center gap-1 min-w-[4.375rem]">
          <div className="w-[30px] h-1 bg-surface-700 radius-sm">
            <div className={`h-full ${memColor.bg}`} style={{ width: `${memPercent}%`, borderRadius: '1px' }} />
          </div>
          <span data-vm-field="memory" data-vm-status="ok" data-vm-source="ProcessInfo" className={`text-[10px] font-mono font-bold ${memColor.text}`}>{pMemory}MB</span>
        </div>

        {/* Start Time */}
        <span data-vm-field="startTime" data-vm-status="ok" data-vm-source="ProcessInfo" className="text-[10px] text-text-muted min-w-[1.875rem]">{formatStartTime(pStartTime)}</span>
        <span className="min-w-[6rem] hidden xl:inline-block">
          <ProcessSparkline history={history24h} metric="cpu" width={96} />
        </span>
        <span data-vm-field="command" data-vm-status={pCommand ? 'ok' : 'data_missing'} data-vm-source="ProcessInfo" className="sr-only">{pCommand ?? '无命令行信息'}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            data-testid={`process-detail-button-${pPid}`}
            onClick={(e) => { e.stopPropagation(); onShowDetail(pPid) }}
            className="btn-icon-sm text-text-muted hover:text-accent"
            title="详情"
          >
            <EyeIcon size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowKillConfirm(true) }}
            className="btn-icon-sm text-error/60 hover:text-error"
            title="终止"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      <ContextMenu items={contextMenuItems} position={contextMenuPos} onClose={() => setContextMenuPos(null)} />
      <ConfirmDialog
        isOpen={showKillConfirm}
        title="终止进程"
        message={`确定要终止进程 "${pName}" (PID: ${pPid}) 吗？`}
        confirmText="终止"
        variant="danger"
        onConfirm={() => { setShowKillConfirm(false); onKill() }}
        onCancel={() => setShowKillConfirm(false)}
      />
    </>
  )
})

// ============ Process Group Card ============

interface ProcessGroupCardProps {
  group: ProcessGroup
  index: number
  maxMemory: number
  selectedPid: number | null
  selectedPids: ReadonlySet<number>
  getProcessTag: (process: ProcessInfo) => ProcessTag | undefined
  getProcessHistory: (process: ProcessInfo) => ProcessHistory | undefined
  onSelectProcess: (pid: number, gesture?: ProcessSelectionGesture) => void
  onKillProcess: (pid: number) => void
  onShowDetail: (pid: number) => void
  onShowTree: (pid: number) => void
  onEditTag: (process: ProcessInfo) => void
}

const ProcessGroupCard = memo(function ProcessGroupCard({
  group, index, maxMemory, selectedPid, selectedPids, getProcessTag, getProcessHistory, onSelectProcess, onKillProcess, onShowDetail, onShowTree, onEditTag
}: ProcessGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div
      className="animate-card-stagger bg-surface-800 border-2 border-surface-700 overflow-hidden"
      style={{ borderRadius: '4px', animationDelay: `${index * 80}ms` }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center flex-wrap justify-between gap-y-2 hover:bg-surface-700/50 transition-all duration-200"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={`
            w-10 h-10 bg-accent/10 flex items-center justify-center border-l-3 border-accent flex-shrink-0
            transition-transform duration-300 ${isExpanded ? 'rotate-0' : '-rotate-90'}
           radius-sm`}>
            <ChevronDownIcon size={20} className="text-accent" />
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-base font-bold text-text-primary truncate">{group.projectName}</h3>
            <span className="text-xs text-text-muted whitespace-nowrap">{group.processes.length} 个进程</span>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold text-text-primary font-mono">{(isFinite(group.totalCpu ?? 0) ? (group.totalCpu ?? 0) : 0).toFixed(1)}%</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">CPU</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-text-primary font-mono">{group.totalMemory ?? 0}MB</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">内存</div>
          </div>
        </div>
      </button>

      <div className={`transition-all duration-300 ease-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 space-y-1">
          {group.processes.map((process) => (
            <ProcessCardErrorBoundary key={process.pid} pid={process.pid ?? 0} processName={process.name}>
              <ProcessItem
                process={process}
                maxMemory={maxMemory}
                isSelected={selectedPids.has(process.pid) || selectedPid === process.pid}
                processTag={getProcessTag(process)}
                history24h={getProcessHistory(process)}
                onSelect={(event) => onSelectProcess(process.pid, event)}
                onKill={() => onKillProcess(process.pid)}
                onShowDetail={onShowDetail}
                onShowTree={onShowTree}
                onEditTag={onEditTag}
              />
            </ProcessCardErrorBoundary>
          ))}
        </div>
      </div>
    </div>
  )
})

// ============ Virtual List View ============

interface VirtualListViewProps {
  processes: ProcessInfo[]
  maxMemory: number
  selectedPid: number | null
  selectedPids: ReadonlySet<number>
  sortConfigs: import('@shared/types-extended').SortConfig[]
  getProcessTag: (process: ProcessInfo) => ProcessTag | undefined
  getProcessHistory: (process: ProcessInfo) => ProcessHistory | undefined
  onSelectProcess: (pid: number, gesture?: ProcessSelectionGesture) => void
  onKillProcess: (pid: number) => void
  onShowDetail: (pid: number) => void
  onShowTree: (pid: number) => void
  onSort: (column: SortColumn, append: boolean) => void
  onEditTag: (process: ProcessInfo) => void
}

const VirtualListView = memo(function VirtualListView({
  processes, maxMemory, selectedPid, selectedPids, sortConfigs, getProcessTag, getProcessHistory, onSelectProcess, onKillProcess, onShowDetail, onShowTree, onSort, onEditTag
}: VirtualListViewProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: processes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10
  })

  return (
    <div className="flex flex-col h-full">
      {/* Table Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-surface-900 border-b border-surface-700 flex-shrink-0 min-h-[2rem] min-w-[820px]">
        <div className="w-6 flex-shrink-0" /> {/* icon spacer */}
        <SortableHeader column="name" label="名称" className="min-w-[6.25rem] max-w-[11.25rem] flex-1 whitespace-nowrap" sortConfigs={sortConfigs} onSort={onSort} />
        <div className="min-w-[5.75rem] text-[10px] uppercase tracking-wider text-text-muted whitespace-nowrap">标签</div>
        <SortableHeader column="pid" label="PID" className="min-w-[3.125rem] whitespace-nowrap" sortConfigs={sortConfigs} onSort={onSort} />
        <div className="min-w-[5.75rem] text-[10px] uppercase tracking-wider text-text-muted whitespace-nowrap">父进程</div>
        <SortableHeader column="port" label="端口" className="min-w-[3.125rem] whitespace-nowrap" sortConfigs={sortConfigs} onSort={onSort} />
        <SortableHeader column="cpu" label="CPU" className="min-w-[4.375rem] whitespace-nowrap" sortConfigs={sortConfigs} onSort={onSort} />
        <SortableHeader column="memory" label="内存" className="min-w-[4.375rem] whitespace-nowrap" sortConfigs={sortConfigs} onSort={onSort} />
        <SortableHeader column="startTime" label="启动" className="min-w-[1.875rem] whitespace-nowrap" sortConfigs={sortConfigs} onSort={onSort} />
        <div className="min-w-[6rem] text-[10px] uppercase tracking-wider text-text-muted whitespace-nowrap hidden xl:block">24h</div>
        <div className="w-[60px] ml-auto" /> {/* actions spacer */}
      </div>

      {/* Virtual Scroll Container */}
      <div ref={parentRef} data-testid="process-list-scroll" className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const process = processes[virtualItem.index]
            if (!process) return null
            return (
              <div
                key={process.pid ?? virtualItem.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`
                }}
              >
                <ProcessCardErrorBoundary pid={process.pid ?? 0} processName={process.name}>
                  <ProcessItem
                    process={process}
                    maxMemory={maxMemory}
                    isSelected={selectedPids.has(process.pid) || selectedPid === process.pid}
                    processTag={getProcessTag(process)}
                    history24h={getProcessHistory(process)}
                    onSelect={(event) => onSelectProcess(process.pid, event)}
                    onKill={() => onKillProcess(process.pid)}
                    onShowDetail={onShowDetail}
                    onShowTree={onShowTree}
                    onEditTag={onEditTag}
                  />
                </ProcessCardErrorBoundary>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

// ============ Main ProcessView ============

export function ProcessView({ initialTarget }: DetachableViewProps = {}) {
  const {
    processes,
    groups,
    zombies,
    isScanning,
    lastScanTime,
    selectedPid,
    sortConfigs,
    searchQuery,
    statusFilters,
    typeFilters,
    scan,
    getGroups,
    killProcess,
    cleanupZombies,
    selectProcess,
    getTotalResources,
    getFullRelationship,
    getProcessHistory,
    getBasicInfo,
    getDeepDetail,
    probeAccess,
    getConnections,
    getEnvironment,
    killProcessTree,
    setProcessPriority,
    openFileLocation,
    getModules,
    relaunchAsAdmin,
    toggleSort,
    clearSort,
    setSearchQuery,
    toggleStatusFilter,
    toggleTypeFilter,
    clearFilters,
    getFilteredAndSortedProcesses
  } = useSystemProcesses()

  const { showToast } = useToast()
  const { getTag, setTag, removeTag } = useProcessTagRegistry()
  const { getHistory: getProcessHistory24h, loadHistory: loadProcessHistory24h, loadHistories } = useProcessHistory24h()

  const [viewMode, setViewModeState] = useState<ProcessViewMode>(() => {
    const stored = localStorage.getItem('devhub:process-view-mode')
    return stored === 'card' || stored === 'list' || stored === 'grouped' || stored === 'tree' || stored === 'treemap' ? stored : 'list'
  })
  const [detailPid, setDetailPid] = useState<number | null>(() => {
    if (initialTarget?.kind !== 'pid') return null
    const pid = Number.parseInt(initialTarget.value, 10)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  })
  const [drawerPid, setDrawerPid] = useState<number | null>(null)
  const [drawerBasicProcessInfo, setDrawerBasicProcessInfo] = useState<ProcessInfo | null>(null)
  const [exactPidSearchResult, setExactPidSearchResult] = useState<ProcessInfo | null>(null)
  const [tagEditorProcess, setTagEditorProcess] = useState<ProcessInfo | null>(null)
  const [tagEditorSaving, setTagEditorSaving] = useState(false)
  const [isProcessTourOpen, setIsProcessTourOpen] = useState(() => localStorage.getItem(PROCESS_MODULE_TOUR_STORAGE_KEY) !== 'dismissed')
  const [processTourStep, setProcessTourStep] = useState(0)
  const [tourOperationMenuPid, setTourOperationMenuPid] = useState<number | null>(null)
  const [isProcessHelpOpen, setIsProcessHelpOpen] = useState(false)
  // Collapsed "?" guide/help dropdown anchor for narrow (<=1280px) toolbars.
  const [helpMenuPos, setHelpMenuPos] = useState<{ x: number; y: number } | null>(null)

  const setViewMode = useCallback((mode: ProcessViewMode) => {
    setViewModeState(mode)
    localStorage.setItem('devhub:process-view-mode', mode)
    void window.devhub?.r8?.processViews?.setViewMode?.(mode).catch(() => undefined)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode
      if (mode === 'card' || mode === 'list' || mode === 'grouped' || mode === 'tree' || mode === 'treemap') {
        setViewModeState(mode)
        localStorage.setItem('devhub:process-view-mode', mode)
      }
    }
    window.addEventListener('devhub:process-view-mode', handler)
    return () => window.removeEventListener('devhub:process-view-mode', handler)
  }, [])

  // CPU/Memory history cache for card view sparklines
  const [historyCache, setHistoryCache] = useState<Map<number, { cpuHistory: number[]; memoryHistory: number[] }>>(new Map())

  const maxMemory = useMemo(() => {
    if (processes.length === 0) return 1
    const max = Math.max(...processes.map(p => p.memory))
    return Math.max(max, 100)
  }, [processes])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- we intentionally depend on store state changes
  const filteredProcesses = useMemo(() => getFilteredAndSortedProcesses(), [
    getFilteredAndSortedProcesses, processes, sortConfigs, searchQuery, statusFilters, typeFilters
  ])

  const exactPidSearch = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase()
    if (!trimmed.startsWith('pid:')) {
      return null
    }

    const parsed = Number.parseInt(trimmed.slice(4).trim(), 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }, [searchQuery])

  useEffect(() => {
    let cancelled = false

    if (exactPidSearch === null || filteredProcesses.length > 0) {
      setExactPidSearchResult(null)
      return () => { cancelled = true }
    }

    const loadExactPid = async () => {
      const result = await getBasicInfo(exactPidSearch)
      if (!cancelled) {
        setExactPidSearchResult(result && result.pid === exactPidSearch ? result : null)
      }
    }

    loadExactPid().catch(() => {
      if (!cancelled) {
        setExactPidSearchResult(null)
      }
    })

    return () => { cancelled = true }
  }, [exactPidSearch, filteredProcesses.length, getBasicInfo])

  const isShowingExactPidFallback = exactPidSearch !== null
    && filteredProcesses.length === 0
    && exactPidSearchResult?.pid === exactPidSearch

  const displayProcesses = useMemo(() => {
    if (isShowingExactPidFallback && exactPidSearchResult) {
      return [exactPidSearchResult]
    }

    return filteredProcesses
  }, [exactPidSearchResult, filteredProcesses, isShowingExactPidFallback])

  const orderedDisplayPids = useMemo(() => displayProcesses.map(process => process.pid), [displayProcesses])
  const processByPid = useMemo(() => new Map(displayProcesses.map(process => [process.pid, process])), [displayProcesses])
  const {
    selectedPids,
    selectedPidList,
    selectedCount,
    clearSelection,
    pruneSelection,
    selectAll,
    selectPid
  } = useProcessSelection()
  const [processBatchProgress, setProcessBatchProgress] = useState<ProcessBatchProgressState | null>(null)
  const [processBatchBusy, setProcessBatchBusy] = useState(false)
  const [batchTagDialogOpen, setBatchTagDialogOpen] = useState(false)
  const [batchTagUndoState, setBatchTagUndoState] = useState<BatchTagUndoState | null>(null)
  const [pendingProcessBatchConfirm, setPendingProcessBatchConfirm] = useState<PendingProcessBatchConfirm | null>(null)
  const [lastProcessBatchRequest, setLastProcessBatchRequest] = useState<ProcessBatchRequest | null>(null)

  useEffect(() => {
    pruneSelection(orderedDisplayPids)
  }, [orderedDisplayPids, pruneSelection])

  useEffect(() => {
    if (!batchTagUndoState) return
    const remainingMs = Math.max(batchTagUndoState.expiresAt - Date.now(), 0)
    const timeout = setTimeout(() => setBatchTagUndoState(null), remainingMs)
    return () => clearTimeout(timeout)
  }, [batchTagUndoState])

  const refreshAll = useCallback(async () => {
    await Promise.all([scan(), getGroups()])
  }, [scan, getGroups])

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 10000)
    return () => clearInterval(interval)
  }, [refreshAll])

  const handleSelectProcess = useCallback((pid: number, gesture: ProcessSelectionGesture = {}) => {
    selectPid(pid, orderedDisplayPids, gesture)
    selectProcess(pid)
  }, [orderedDisplayPids, selectPid, selectProcess])

  const handleSelectAllVisible = useCallback(() => {
    selectAll(orderedDisplayPids)
    if (orderedDisplayPids[0] !== undefined) {
      selectProcess(orderedDisplayPids[0])
    }
  }, [orderedDisplayPids, selectAll, selectProcess])

  const processTourTarget = useMemo(() => {
    const selected = selectedPid === null ? undefined : processByPid.get(selectedPid) ?? processes.find(process => process.pid === selectedPid)
    return selected ?? displayProcesses[0] ?? processes[0] ?? null
  }, [displayProcesses, processByPid, processes, selectedPid])

  const dismissProcessTour = useCallback(() => {
    localStorage.setItem(PROCESS_MODULE_TOUR_STORAGE_KEY, 'dismissed')
    setIsProcessTourOpen(false)
  }, [])

  const openProcessTour = useCallback(() => {
    setProcessTourStep(0)
    setIsProcessTourOpen(true)
  }, [])

  const openProcessHelp = useCallback(() => {
    setIsProcessHelpOpen(true)
  }, [])

  const closeProcessHelp = useCallback(() => {
    setIsProcessHelpOpen(false)
  }, [])

  useGlobalShortcuts([
    {
      id: 'process-module-help-f1',
      keys: ['F1'],
      handler: openProcessHelp,
    },
  ])

  const switchTourCardList = useCallback(() => {
    if (!processTourTarget) return
    setTourOperationMenuPid(null)
    setViewMode(viewMode === 'card' ? 'list' : 'card')
    handleSelectProcess(processTourTarget.pid)
  }, [handleSelectProcess, processTourTarget, setViewMode, viewMode])

  const openTourRelationship = useCallback(() => {
    if (!processTourTarget) return
    setTourOperationMenuPid(null)
    handleSelectProcess(processTourTarget.pid)
    navigateMonitorTab('process', {
      detail: { scope: { kind: 'process', targetId: processTourTarget.pid, depth: 2 } }
    })
  }, [handleSelectProcess, processTourTarget])

  const openTourOperationMenu = useCallback(() => {
    if (!processTourTarget) return
    setViewMode('card')
    handleSelectProcess(processTourTarget.pid)
    setTourOperationMenuPid(processTourTarget.pid)
  }, [handleSelectProcess, processTourTarget, setViewMode])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      event.preventDefault()
      handleSelectAllVisible()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectAllVisible])

  useEffect(() => {
    const handleOpenBatchTag = () => {
      if (selectedCount === 0) {
        showToast('warning', '请先选择一个或多个进程，再使用命令面板批量设标签')
        return
      }
      setBatchTagDialogOpen(true)
    }

    window.addEventListener('devhub:process-batch-tag-open', handleOpenBatchTag)
    return () => window.removeEventListener('devhub:process-batch-tag-open', handleOpenBatchTag)
  }, [selectedCount, showToast])

  // Fetch history for card view (batch fetch for visible processes)
  useEffect(() => {
    if (viewMode !== 'card') return
    let cancelled = false

    const fetchHistories = async () => {
      const visible = displayProcesses.slice(0, 30) // only first 30
      const newCache = new Map<number, { cpuHistory: number[]; memoryHistory: number[] }>()
      // Only keep entries for currently visible processes (prevents unbounded growth)
      for (const proc of visible) {
        try {
          const hist = await getProcessHistory(proc.pid)
          if (cancelled) return
          newCache.set(proc.pid, hist)
        } catch {
          // ignore individual failures
        }
      }
      if (!cancelled) setHistoryCache(newCache)
    }

    fetchHistories()
    const interval = setInterval(fetchHistories, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [viewMode, displayProcesses, getProcessHistory])

  useEffect(() => {
    if (viewMode !== 'list' && viewMode !== 'card' && viewMode !== 'grouped' && viewMode !== 'tree' && viewMode !== 'treemap') return
    let cancelled = false
    const visible = displayProcesses.slice(0, 30)

    const fetchHistories = async () => {
      if (visible.length === 0) return
      await loadHistories(visible)
      if (cancelled) return
    }

    fetchHistories().catch(() => undefined)
    const interval = setInterval(() => {
      fetchHistories().catch(() => undefined)
    }, 60000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [displayProcesses, loadHistories, viewMode])

  const handleCleanupZombies = useCallback(async () => {
    const cleaned = await cleanupZombies()
    if (cleaned > 0) {
      showToast('success', `清理了 ${cleaned} 个僵尸进程`)
    }
  }, [cleanupZombies, showToast])

  const executeProcessBatchAction = useCallback(async (pid: number, request: ProcessBatchRequest): Promise<unknown> => {
    if (request.action === 'kill') {
      return killProcess(pid)
    }

    if (request.action === 'focus') {
      const scanResult = await window.devhub.windowManager?.scan?.(false)
      const targetWindow = scanResult?.data?.find(windowInfo => windowInfo.pid === pid && windowInfo.isVisible)
      if (!targetWindow) return { skipped: true, reason: 'no visible window for pid' }
      return window.devhub.windowManager.focus(targetWindow.hwnd)
    }

    if (request.action === 'tag') {
      const args = processBatchTagArgsSchema.parse(request.args)
      const info = processByPid.get(pid) ?? await getBasicInfo(pid)
      if (!info) return { skipped: true, reason: 'process not found for tag operation' }
      return setTag(info, args.tag, args.color, args.pinned)
    }

    if (request.action === 'export-diag') {
      const info = processByPid.get(pid) ?? await getBasicInfo(pid)
      const exportDiagnostic = window.devhub.r8?.diagnostic?.export
      if (!exportDiagnostic) return { skipped: true, reason: 'diagnostic export bridge is unavailable' }
      const manifest = await exportDiagnostic({
        sectionsIncluded: ['system-info'],
        includeScreenshots: false
      })
      return {
        success: true,
        pid,
        name: info?.name ?? 'unknown',
        manifest
      }
    }

    return { skipped: true, reason: 'dedicated process service is not registered in this slice' }
  }, [getBasicInfo, killProcess, processByPid, setTag])

  const executeProcessBatchRequest = useCallback(async (
    request: ProcessBatchRequest,
    tagUndoSnapshot: BatchTagUndoItem[] = [],
    tagUndoLabel?: string
  ) => {
    setProcessBatchBusy(true)
    setLastProcessBatchRequest(request)
    try {
      const progress = typeof window.devhub.systemProcess.batchOp === 'function'
        ? await runProcessBatchViaIpc(request, setProcessBatchProgress)
        : await runSequentialProcessBatch(
          request,
          executeProcessBatchAction,
          { delayMs: request.action === 'focus' ? 150 : 0 }
        )
      setProcessBatchProgress(progress)
      showToast(
        progress.failed === 0 ? 'success' : 'warning',
        summarizeProcessBatchProgress(progress, PROCESS_BATCH_ACTION_LABELS[request.action])
      )
      if (request.action === 'tag') {
        const succeededPids = new Set(progress.results.filter(result => result.status === 'ok').map(result => result.pid))
        const undoItems = tagUndoSnapshot.filter(item => succeededPids.has(item.pid))
        setBatchTagUndoState(undoItems.length > 0 ? {
          label: tagUndoLabel ?? '批量标签',
          expiresAt: Date.now() + PROCESS_BATCH_LIMITS.UNDO_WINDOW_MS,
          items: undoItems,
        } : null)
      }
      if (request.action === 'kill' && progress.failed === 0) {
        clearSelection()
      }
    } finally {
      setProcessBatchBusy(false)
    }
  }, [clearSelection, executeProcessBatchAction, showToast])

  const runSelectedProcessBatch = useCallback(async (
    action: ProcessBatchAction,
    patch: Partial<Omit<ProcessBatchRequest, 'action' | 'pids'>> = {},
    tagUndoSnapshot: BatchTagUndoItem[] = [],
    tagUndoLabel?: string
  ) => {
    if (selectedPidList.length === 0 || processBatchBusy) return

    const request = createProcessBatchRequest(action, selectedPidList, patch)
    const blockedSystemPids = getBlockedSystemKillPids(request)
    if (blockedSystemPids.length > 0) {
      showToast('warning', buildProcessBatchConfirmMessage(request))
      return
    }

    if (requiresProcessBatchConfirmation(request)) {
      setPendingProcessBatchConfirm({ request, tagUndoSnapshot, tagUndoLabel })
      return
    }

    await executeProcessBatchRequest(request, tagUndoSnapshot, tagUndoLabel)
  }, [executeProcessBatchRequest, processBatchBusy, selectedPidList, showToast])

  const handleProcessBatchAction = useCallback((action: ProcessBatchAction) => {
    if (action === 'tag') {
      setBatchTagDialogOpen(true)
      return
    }
    if (action === 'inject-text') {
      const text = window.prompt('输入要注入到目标进程窗口的文本')
      if (!text) return
      runSelectedProcessBatch(action, { args: { text } }).catch((error: unknown) => {
        showToast('error', error instanceof Error ? error.message : '批量操作失败')
      })
      return
    }
    runSelectedProcessBatch(action).catch((error: unknown) => {
      showToast('error', error instanceof Error ? error.message : '批量操作失败')
    })
  }, [runSelectedProcessBatch, showToast])

  const handleSaveBatchTag = useCallback(async (label: string, color: ProcessTagColor, pinned: boolean) => {
    const undoSnapshot = selectedPidList
      .map((pid): BatchTagUndoItem | null => {
        const process = processByPid.get(pid)
        if (!process) return null
        return {
          pid,
          process: { name: process.name, workingDir: process.workingDir },
          previousTag: getTag(process),
        }
      })
      .filter((item): item is BatchTagUndoItem => item !== null)

    setBatchTagDialogOpen(false)
    await runSelectedProcessBatch('tag', {
      args: { tag: label, color, pinned },
    }, undoSnapshot, label)
  }, [getTag, processByPid, runSelectedProcessBatch, selectedPidList])

  const handleUndoBatchTag = useCallback(async () => {
    if (!batchTagUndoState || processBatchBusy) return
    const undoState = batchTagUndoState
    setBatchTagUndoState(null)
    setProcessBatchBusy(true)
    let restored = 0
    let removed = 0
    let failed = 0
    try {
      for (const item of undoState.items) {
        try {
          if (item.previousTag) {
            await setTag(item.process, item.previousTag.tag, item.previousTag.color, item.previousTag.pinned)
            restored += 1
          } else {
            await removeTag(item.process)
            removed += 1
          }
        } catch {
          failed += 1
        }
      }
      showToast(
        failed === 0 ? 'success' : 'warning',
        failed === 0
          ? `批量标签已撤回：恢复 ${restored}，移除 ${removed}`
          : `批量标签部分撤回：恢复 ${restored}，移除 ${removed}，失败 ${failed}`
      )
    } finally {
      setProcessBatchBusy(false)
    }
  }, [batchTagUndoState, processBatchBusy, removeTag, setTag, showToast])

  const handleConfirmProcessBatch = useCallback(() => {
    const pending = pendingProcessBatchConfirm
    if (!pending || processBatchBusy) return
    setPendingProcessBatchConfirm(null)
    const confirmedRequest = createProcessBatchRequest(pending.request.action, pending.request.pids, {
      args: pending.request.args,
      dryRun: pending.request.dryRun,
      confirmed: true
    })
    executeProcessBatchRequest(confirmedRequest, pending.tagUndoSnapshot, pending.tagUndoLabel).catch((error: unknown) => {
      showToast('error', error instanceof Error ? error.message : '批量操作失败')
    })
  }, [executeProcessBatchRequest, pendingProcessBatchConfirm, processBatchBusy, showToast])

  const handleCancelProcessBatchConfirm = useCallback(() => {
    setPendingProcessBatchConfirm(null)
  }, [])

  const handleRetryFailedProcessBatch = useCallback(() => {
    if (!processBatchProgress || !lastProcessBatchRequest || processBatchBusy) return
    const failedPids = processBatchProgress.results
      .filter(result => result.status === 'failed')
      .map(result => result.pid)
    if (failedPids.length === 0) return
    const retryRequest = createProcessBatchRequest(lastProcessBatchRequest.action, failedPids, {
      args: lastProcessBatchRequest.args,
      dryRun: lastProcessBatchRequest.dryRun,
      confirmed: true
    })
    executeProcessBatchRequest(retryRequest).catch((error: unknown) => {
      showToast('error', error instanceof Error ? error.message : '批量重试失败')
    })
  }, [executeProcessBatchRequest, lastProcessBatchRequest, processBatchBusy, processBatchProgress, showToast])

  const handleShowDetail = useCallback((pid: number) => {
    setDrawerPid((prev) => {
      if (prev === pid) {
        setDrawerBasicProcessInfo(null)
        return null
      }

      setDrawerBasicProcessInfo(
        processes.find((proc) => proc.pid === pid)
        ?? (exactPidSearchResult?.pid === pid ? exactPidSearchResult : null)
      )
      return pid
    })
  }, [exactPidSearchResult, processes])

  // Toggle inline detail panel (used in existing ProcessDetailPanel integration)
  const handleShowInlineDetail = useCallback((pid: number) => {
    setDetailPid(prev => prev === pid ? null : pid)
  }, [])
  // Suppress unused warning — kept for backward compatibility with inline detail panel
  void handleShowInlineDetail

  const handleSaveProcessTag = useCallback(async (label: string, color: ProcessTagColor, pinned: boolean) => {
    if (!tagEditorProcess) return
    setTagEditorSaving(true)
    try {
      await setTag(tagEditorProcess, label, color, pinned)
      showToast('success', '进程标签已保存')
      setTagEditorProcess(null)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '进程标签保存失败')
    } finally {
      setTagEditorSaving(false)
    }
  }, [setTag, showToast, tagEditorProcess])

  const handleRemoveProcessTag = useCallback(async () => {
    if (!tagEditorProcess) return
    setTagEditorSaving(true)
    try {
      await removeTag(tagEditorProcess)
      showToast('success', '进程标签已移除')
      setTagEditorProcess(null)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '进程标签移除失败')
    } finally {
      setTagEditorSaving(false)
    }
  }, [removeTag, showToast, tagEditorProcess])

  const totalResources = getTotalResources()
  const processModuleNewBadge = getProcessModuleNewBadgeState()
  const disabledProcessBatchActions = useMemo<Partial<Record<ProcessBatchAction, string>>>(() => ({}), [])

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b-2 border-surface-700 bg-surface-900 relative">
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 bg-surface-700 flex items-center justify-center border-l-3 border-accent radius-sm flex-shrink-0">
              <ProcessIcon size={20} className="text-accent" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-text-primary font-bold uppercase tracking-wider whitespace-nowrap"
                style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}
              >
                系统进程
              </h2>
              <div className="flex items-center gap-3 text-xs text-text-muted min-w-0">
                <span className="font-mono whitespace-nowrap">{processes.length} 个进程</span>
                {processModuleNewBadge.isActive && (
                  <span
                    data-testid="process-module-new-badge"
                    data-r8-release-window-status="active"
                    data-release-window-days={PROCESS_MODULE_NEW_BADGE_WINDOW_DAYS}
                    data-release-window-remaining-days={processModuleNewBadge.daysRemaining}
                    className="status-badge bg-info/10 text-info border-info/30"
                    title={`R8 后 ${PROCESS_MODULE_NEW_BADGE_WINDOW_DAYS} 天内显示，剩余 ${processModuleNewBadge.daysRemaining} 天`}
                  >
                    NEW
                  </span>
                )}
                <span className="min-w-0 truncate">
                  <LastScanTime lastScanTime={lastScanTime} />
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <ViewModeToggle
              modes={[
                { key: 'list', icon: <ListIcon size={16} />, label: '列表' },
                { key: 'card', icon: <GridIcon size={16} />, label: '卡片' },
                { key: 'tree', icon: <TreeIcon size={16} />, label: 'Tree' },
                { key: 'treemap', icon: <GridIcon size={16} />, label: 'Treemap' },
                { key: 'grouped', icon: <GroupIcon size={16} />, label: '分组' }
              ]}
              current={viewMode}
              onChange={(mode) => setViewMode(mode as ProcessViewMode)}
            />

            <div className="w-px self-stretch bg-surface-700 hidden md:block" />

            {zombies.length > 0 && (
              <button
                onClick={handleCleanupZombies}
                className="btn-warning flex items-center gap-2 text-xs px-4 py-2 whitespace-nowrap"
              >
                <AlertIcon size={16} />
                清理 {zombies.length} 个僵尸
              </button>
            )}

            <div className="hidden xl:flex items-center gap-2">
              <button
                type="button"
                data-testid="process-module-tour-open-button"
                onClick={openProcessTour}
                className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"
                aria-label="打开进程模块导览"
                title="进程导览"
              >
                <InfoIcon size={14} />
                导览
              </button>

              <button
                type="button"
                data-testid="process-module-help-open-button"
                onClick={openProcessHelp}
                className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"
                aria-label="打开进程模块帮助"
                title="进程帮助 F1"
              >
                <InfoIcon size={14} />
                帮助 F1
              </button>
            </div>

            {/* Collapsed guide/help "?" dropdown for narrow toolbars (<=1280px) */}
            <button
              type="button"
              data-testid="process-module-help-menu-button"
              onClick={(e) => setHelpMenuPos({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().bottom + 4 })}
              className="btn-secondary xl:hidden flex items-center justify-center text-xs px-2.5 py-1.5"
              aria-label="打开进程模块导览与帮助"
              title="导览与帮助"
            >
              <InfoIcon size={14} />
            </button>

            <div className="w-px self-stretch bg-surface-700 hidden md:block" />

            <div className="flex items-center gap-2">
              <button
                onClick={refreshAll}
                disabled={isScanning}
                className={`btn-icon bg-surface-800 border border-surface-700 ${isScanning ? 'opacity-50' : 'hover:bg-surface-700 hover:border-surface-600'}`}
                title="刷新"
              >
                <RefreshIcon size={18} className={`text-text-secondary ${isScanning ? 'animate-spin' : ''}`} />
              </button>

              <PanelDetachButton surface="process" />
              <PanelDetachButton
                surface="process-detail"
                target={detailPid === null ? null : `pid:${detailPid}`}
                testId="process-detail-detach-popout"
              />
            </div>
          </div>
        </div>
      </div>

      <ProcessModuleTour
        isOpen={isProcessTourOpen}
        stepIndex={processTourStep}
        processCount={displayProcesses.length}
        targetProcess={processTourTarget}
        currentViewMode={viewMode}
        onStepChange={setProcessTourStep}
        onDismiss={dismissProcessTour}
        onSwitchCardList={switchTourCardList}
        onOpenRelationship={openTourRelationship}
        onOpenOperationMenu={openTourOperationMenu}
      />

      <ProcessModuleHelp
        isOpen={isProcessHelpOpen}
        processCount={displayProcesses.length}
        targetProcess={processTourTarget}
        currentViewMode={viewMode}
        onClose={closeProcessHelp}
      />

      <ContextMenu
        items={[
          { label: '进程导览', icon: <InfoIcon size={16} />, onClick: openProcessTour },
          { label: '进程帮助 F1', icon: <InfoIcon size={16} />, onClick: openProcessHelp }
        ]}
        position={helpMenuPos}
        onClose={() => setHelpMenuPos(null)}
      />

      {/* Hero Stats — compact + height-aware so the process list keeps its space
          in short windows (drawer embed / popout). The `monitor-stat-grid`
          guard collapses the grid to a single scroll-free compact row instead
          of stacking four tall cards when vertical room is scarce. */}
      <div className="flex-shrink-0 py-3 stat-grid monitor-stat-grid border-b border-surface-700/50 bg-surface-900/50" style={{ paddingLeft: 'var(--responsive-padding, 20px)', paddingRight: 'var(--responsive-padding, 20px)', gap: '12px' }}>
        <StatCard compact icon={<ProcessIcon size={16} className="text-accent" />} label="活跃进程" value={processes.length} color="accent" />
        <StatCard compact icon={<ProcessIcon size={16} className="text-info" />} label="CPU 使用" value={`${(isFinite(totalResources.cpu) ? totalResources.cpu : 0).toFixed(1)}%`} color={totalResources.cpu > 50 ? 'warning' : 'default'} />
        <StatCard compact icon={<ProcessIcon size={16} className="text-success" />} label="内存使用" value={formatBytes(totalResources.memory)} color={totalResources.memory > 2000 ? 'warning' : 'default'} />
        <StatCard compact icon={<AlertIcon size={16} className="text-warning" />} label="僵尸进程" value={zombies.length} color={zombies.length > 0 ? 'warning' : 'default'} />
      </div>

      {/* Filter Bar */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-surface-700/30 bg-surface-900/30">
        <ProcessFilterBar
          totalCount={processes.length}
          filteredCount={displayProcesses.length}
          searchQuery={searchQuery}
          statusFilters={statusFilters}
          typeFilters={typeFilters}
          sortConfigs={sortConfigs}
          onSearchChange={setSearchQuery}
          onToggleStatus={toggleStatusFilter}
          onToggleType={toggleTypeFilter}
          onClearFilters={clearFilters}
          onClearSort={clearSort}
        />
      </div>

      <ProcessBatchToolbar
        selectedCount={selectedCount}
        totalCount={displayProcesses.length}
        disabled={processBatchBusy}
        disabledActions={disabledProcessBatchActions}
        onAction={handleProcessBatchAction}
        onSelectAll={handleSelectAllVisible}
        onClearSelection={clearSelection}
      />

      <ProcessBatchProgress
        progress={processBatchProgress}
        onDismiss={() => setProcessBatchProgress(null)}
        onRetryFailed={handleRetryFailedProcessBatch}
      />

      {batchTagUndoState && (
        <div
          data-testid="process-batch-tag-undo"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/30 bg-accent/10 px-5 py-2 text-xs text-text-secondary"
        >
          <span>
            已为 {batchTagUndoState.items.length} 个进程应用标签「{batchTagUndoState.label}」，可在 5 秒内撤回。
          </span>
          <button
            className="btn-secondary px-2 py-1 text-[11px]"
            disabled={processBatchBusy}
            onClick={() => handleUndoBatchTag().catch(() => undefined)}
            type="button"
          >
            撤回批量标签
          </button>
        </div>
      )}

      {isShowingExactPidFallback && exactPidSearchResult && (
        <div className="flex-shrink-0 px-5 py-3 border-b border-surface-700/30 bg-warning/5">
          <div
            data-testid="process-exact-pid-banner"
            className="flex items-start gap-2 border-l-2 border-warning bg-surface-900/70 px-3 py-2 radius-sm"
          >
            <AlertIcon size={14} className="text-warning mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-warning">PID 精确查询结果</div>
              <div className="mt-1 text-[11px] text-text-secondary leading-5">
                当前显示的是 PID {exactPidSearchResult.pid} 的实时查询结果。该进程不在开发进程扫描集合内，但仍可继续查看基础信息与权限降级详情。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel — capped so an open detail never starves the process list
          of vertical space; it scrolls internally instead. */}
      {detailPid !== null && (
        <div className="flex-shrink-0 px-5 py-3 max-h-[40%] overflow-y-auto">
          <ProcessDetailPanel
            pid={detailPid}
            basicProcessInfo={processes.find(p => p.pid === detailPid)}
            onClose={() => setDetailPid(null)}
            onKillProcess={killProcess}
            fetchRelationship={getFullRelationship}
            fetchHistory={getProcessHistory}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'list' ? (
          <VirtualListView
            processes={displayProcesses}
            maxMemory={maxMemory}
            selectedPid={selectedPid}
            selectedPids={selectedPids}
            sortConfigs={sortConfigs}
            getProcessTag={getTag}
            getProcessHistory={getProcessHistory24h}
            onSelectProcess={handleSelectProcess}
            onKillProcess={killProcess}
            onShowDetail={handleShowDetail}
            onShowTree={handleShowDetail}
            onSort={toggleSort}
            onEditTag={setTagEditorProcess}
          />
        ) : viewMode === 'card' ? (
          <div className="h-full overflow-y-auto" style={{ padding: 'var(--responsive-padding, 20px)' }}>
            <div className="monitor-card-grid">
              {displayProcesses.map((process, index) => {
                const hist = historyCache.get(process.pid)
                return (
                  <ProcessCardErrorBoundary key={process.pid} pid={process.pid} processName={process.name}>
                    <ProcessCard
                      process={process}
                      index={index}
                      maxMemory={maxMemory}
                      cpuHistory={hist?.cpuHistory}
                      memoryHistory={hist?.memoryHistory}
                      processTag={getTag(process)}
                      history24h={getProcessHistory24h(process)}
                      onKill={() => killProcess(process.pid)}
                      onShowDetail={handleShowDetail}
                      onShowTree={handleShowDetail}
                      onEditTag={setTagEditorProcess}
                      showOperationMenu={tourOperationMenuPid === process.pid}
                    />
                  </ProcessCardErrorBoundary>
                )
              })}
            </div>
          </div>
        ) : viewMode === 'tree' ? (
          <ProcessTreeView
            processes={displayProcesses}
                selectedPid={selectedPid}
                onSelectProcess={selectProcess}
                onShowDetail={handleShowDetail}
                getProcessTag={getTag}
          />
        ) : viewMode === 'treemap' ? (
          <ProcessTreemapView
            processes={displayProcesses}
                selectedPid={selectedPid}
                onSelectProcess={selectProcess}
                onShowDetail={handleShowDetail}
                getProcessTag={getTag}
          />
        ) : (
          <div className="h-full overflow-y-auto space-y-4" style={{ padding: 'var(--responsive-padding, 20px)' }}>
            {groups.map((group, index) => (
              <ProcessGroupCard
                key={group.projectId}
                group={group}
                index={index}
                maxMemory={maxMemory}
                selectedPid={selectedPid}
                selectedPids={selectedPids}
                getProcessTag={getTag}
                getProcessHistory={getProcessHistory24h}
                onSelectProcess={handleSelectProcess}
                onKillProcess={killProcess}
                onShowDetail={handleShowDetail}
                onShowTree={handleShowDetail}
                onEditTag={setTagEditorProcess}
              />
            ))}
          </div>
        )}

        {isScanning && displayProcesses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <LoadingSpinner size="md" className="mb-4" />
            <p className="text-text-secondary">正在扫描进程...</p>
          </div>
        )}

        {displayProcesses.length === 0 && processes.length === 0 && !isScanning && exactPidSearch === null && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-20 h-20 bg-surface-800 flex items-center justify-center mb-6 border-l-3 border-accent radius-md">
              <ProcessIcon size={40} className="text-text-muted" />
            </div>
            <h3
              className="text-lg font-bold text-text-primary mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              没有检测到开发进程
            </h3>
            <p className="text-text-muted">启动开发服务器后将在此显示</p>
          </div>
        )}

        {displayProcesses.length === 0 && processes.length > 0 && !isScanning && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-16 h-16 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-warning radius-md">
              <AlertIcon size={32} className="text-warning" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-2">
              {exactPidSearch !== null ? `未找到 PID ${exactPidSearch}` : '没有匹配的进程'}
            </h3>
            <p className="text-text-muted text-sm">
              {exactPidSearch !== null ? '该进程可能已退出，或当前无法读取其基础信息' : '尝试调整过滤条件'}
            </p>
            <button onClick={clearFilters} className="btn-secondary mt-4 text-xs px-4 py-2">
              清除所有过滤
            </button>
          </div>
        )}
      </div>

      {tagEditorProcess && (
        <ProcessTagEditor
          process={tagEditorProcess}
          tag={getTag(tagEditorProcess)}
          saving={tagEditorSaving}
          onSave={handleSaveProcessTag}
          onRemove={handleRemoveProcessTag}
          onClose={() => setTagEditorProcess(null)}
        />
      )}

      {batchTagDialogOpen && (
        <ProcessBatchTagDialog
          selectedCount={selectedCount}
          saving={processBatchBusy}
          onSave={handleSaveBatchTag}
          onClose={() => setBatchTagDialogOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={pendingProcessBatchConfirm !== null}
        title="确认批量操作"
        message={pendingProcessBatchConfirm ? buildProcessBatchConfirmMessage(pendingProcessBatchConfirm.request) : ''}
        confirmText="确认执行"
        variant={pendingProcessBatchConfirm?.request.action === 'kill' ? 'danger' : 'warning'}
        onConfirm={handleConfirmProcessBatch}
        onCancel={handleCancelProcessBatchConfirm}
      />

      {/* Process Detail Drawer */}
      {drawerPid !== null && (
        <ProcessDetailDrawer
          pid={drawerPid}
          basicProcessInfo={drawerBasicProcessInfo}
          onClose={() => {
            setDrawerPid(null)
            setDrawerBasicProcessInfo(null)
          }}
          fetchDeepDetail={getDeepDetail}
          probeAccess={probeAccess}
          fetchConnections={getConnections}
          fetchEnvironment={getEnvironment}
          fetchHistory={getProcessHistory}
          fetchHistory24h={loadProcessHistory24h}
          fetchModules={getModules}
          onRelaunchAsAdmin={relaunchAsAdmin}
          onKillProcess={killProcess}
          onKillTree={killProcessTree}
          onSetPriority={setProcessPriority}
          onOpenFileLocation={openFileLocation}
        />
      )}
    </div>
  )
}
