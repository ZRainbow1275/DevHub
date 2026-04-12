import React, { useEffect, memo, useState, useCallback, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSystemProcesses } from '../../hooks/useSystemProcesses'
import { ProcessInfo, ProcessGroup, SortColumn } from '@shared/types-extended'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ContextMenu } from '../ui/ContextMenu'
import { useToast } from '../ui/Toast'
import { StatCard } from '../ui/StatCard'
import { ViewModeToggle } from '../ui/ViewModeToggle'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { LastScanTime } from '../ui/LastScanTime'
import { formatBytes } from '../../utils/formatNumber'
import { ProcessFilterBar, SortIndicator } from './ProcessFilterBar'
import { ProcessDetailPanel } from './ProcessDetailPanel'
import { ProcessDetailDrawer } from './ProcessDetailDrawer'
import { Sparkline } from './Sparkline'
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
  TreeIcon
} from '../icons'

// ============ Utility Functions ============

function getResourceColor(percent: number): { text: string; bg: string } {
  if (percent > 80) return { text: 'text-error', bg: 'bg-error' }
  if (percent > 50) return { text: 'text-warning', bg: 'bg-warning' }
  if (percent > 25) return { text: 'text-gold', bg: 'bg-gold' }
  return { text: 'text-accent', bg: 'bg-accent' }
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
  onKill: () => void
  onShowDetail: (pid: number) => void
  onShowTree: (pid: number) => void
}

const ProcessCard = memo(function ProcessCard({ process, index, maxMemory, cpuHistory, memoryHistory, onKill, onShowDetail, onShowTree }: ProcessCardProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [commandExpanded, setCommandExpanded] = useState(false)
  const { showToast } = useToast()

  const typeConfig = TYPE_ICONS[process.type] || TYPE_ICONS['other']

  const statusConfig = {
    running: { color: 'bg-success', text: '运行中', textColor: 'text-success' },
    idle: { color: 'bg-warning', text: '空闲', textColor: 'text-warning' },
    waiting: { color: 'bg-surface-400', text: '等待中', textColor: 'text-text-muted' }
  }[process.status] ?? { color: 'bg-surface-400', text: process.status || 'unknown', textColor: 'text-text-muted' }

  const cpuColor = getResourceColor(process.cpu)
  const memPercent = calcMemoryPercent(process.memory, maxMemory)
  const memColor = getMemoryResourceColor(memPercent)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleCopyCommand = async () => {
    if (process.command) {
      await navigator.clipboard.writeText(process.command)
      showToast('success', '命令已复制到剪贴板')
    }
  }

  const handleOpenDir = () => {
    if (process.workingDir) {
      window.devhub.shell.openPath(process.workingDir)
    } else {
      showToast('warning', '该进程没有工作目录信息')
    }
  }

  const contextMenuItems = [
    { label: '查看详情', icon: <EyeIcon size={16} />, onClick: () => onShowDetail(process.pid) },
    { label: '打开目录', icon: <FolderIcon size={16} />, onClick: handleOpenDir, disabled: !process.workingDir },
    { label: '复制命令', icon: <CopyIcon size={16} />, onClick: handleCopyCommand, disabled: !process.command },
    { label: '进程树', icon: <TreeIcon size={16} />, onClick: () => onShowTree(process.pid) },
    { label: '', onClick: () => {}, divider: true },
    { label: '终止进程', icon: <CloseIcon size={16} />, onClick: () => setShowKillConfirm(true), danger: true }
  ]

  return (
    <>
      <div
        className="monitor-card group relative overflow-hidden animate-card-stagger"
        style={{ animationDelay: `${Math.min(index, 20) * 50}ms` }}
        onContextMenu={handleContextMenu}
      >
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />

        {process.status === 'running' && (
          <div className="absolute top-3 right-3">
            <span className="status-dot status-dot-running" />
          </div>
        )}

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-9 h-9 bg-surface-800 flex items-center justify-center border-l-3 ${typeConfig.borderColor}`} style={{ borderRadius: '2px' }}>
              {typeConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-text-primary truncate" title={process.name}>
                {process.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`status-badge ${process.status === 'running' ? 'status-badge-running' : ''}`}>
                  <span className={`w-1.5 h-1.5 ${statusConfig.color}`} style={{ borderRadius: '1px' }} />
                  {statusConfig.text}
                </span>
                <span className="text-[10px] text-text-muted font-mono">PID: {process.pid}</span>
              </div>
            </div>
          </div>

          {/* Ports (multi-port display) */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {process.port ? (
              <span className="text-xs font-bold font-mono bg-gold/10 text-gold px-2 py-0.5 border-l-2 border-gold" style={{ borderRadius: '2px' }}>
                :{process.port}
              </span>
            ) : (
              <span className="text-xs text-text-muted font-mono px-2 py-0.5 bg-surface-900" style={{ borderRadius: '2px' }}>
                无端口
              </span>
            )}
            <span className="text-[10px] text-text-muted">{formatStartTime(process.startTime)}</span>
          </div>

          {/* Command Line Summary (expandable) */}
          {process.command && (
            <div className="mb-2">
              <button
                onClick={() => setCommandExpanded(!commandExpanded)}
                className="w-full text-left"
              >
                <p className={`text-[10px] font-mono text-text-muted ${commandExpanded ? '' : 'truncate'} bg-surface-900 px-2 py-1 hover:bg-surface-800 transition-colors`} style={{ borderRadius: '2px' }} title={commandExpanded ? undefined : process.command}>
                  $ {process.command}
                </p>
              </button>
            </div>
          )}

          {/* CPU/Memory with Sparklines */}
          <div className="space-y-2 mb-3">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-text-muted uppercase tracking-wider">CPU</span>
                <div className="flex items-center gap-2">
                  {cpuHistory && cpuHistory.length > 1 && (
                    <Sparkline data={cpuHistory} width={60} height={14} color="var(--accent)" threshold={80} />
                  )}
                  <span className={`font-mono font-bold ${cpuColor.text}`}>{process.cpu.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-surface-800" style={{ borderRadius: '1px' }}>
                <div
                  className={`h-full transition-all duration-500 ${cpuColor.bg}`}
                  style={{ width: `${Math.min(process.cpu, 100)}%`, borderRadius: '1px' }}
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
                  <span className={`font-mono font-bold ${memColor.text}`}>{process.memory}MB</span>
                </div>
              </div>
              <div className="h-1.5 bg-surface-800" style={{ borderRadius: '1px' }}>
                <div
                  className={`h-full transition-all duration-500 ${memColor.bg}`}
                  style={{ width: `${memPercent}%`, borderRadius: '1px' }}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions — always visible */}
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
              disabled={!process.workingDir}
            >
              <FolderIcon size={14} />
            </button>
            <button
              onClick={handleCopyCommand}
              className="btn-icon-sm text-text-muted hover:text-text-primary hover:bg-surface-700 transition-all"
              title="复制命令"
              disabled={!process.command}
            >
              <CopyIcon size={14} />
            </button>
            <button
              onClick={() => onShowDetail(process.pid)}
              className="btn-icon-sm text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
              title="查看详情"
            >
              <EyeIcon size={14} />
            </button>
            <button
              onClick={() => onShowTree(process.pid)}
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
        message={`确定要终止进程 "${process.name}" (PID: ${process.pid}) 吗？`}
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
  onSelect: () => void
  onKill: () => void
  onShowDetail: (pid: number) => void
  onShowTree: (pid: number) => void
}

const ProcessItem = memo(function ProcessItem({ process, maxMemory, isSelected, onSelect, onKill, onShowDetail, onShowTree }: ProcessItemProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const { showToast } = useToast()

  const typeConfig = TYPE_ICONS[process.type] || TYPE_ICONS['other']
  const statusColor = {
    running: 'bg-success',
    idle: 'bg-warning',
    waiting: 'bg-surface-500'
  }[process.status] ?? 'bg-surface-400'
  const cpuColor = getResourceColor(process.cpu)
  const memPercent = calcMemoryPercent(process.memory, maxMemory)
  const memColor = getMemoryResourceColor(memPercent)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleCopyCommand = async () => {
    if (process.command) {
      await navigator.clipboard.writeText(process.command)
      showToast('success', '命令已复制到剪贴板')
    }
  }

  const handleOpenDir = () => {
    if (process.workingDir) {
      window.devhub.shell.openPath(process.workingDir)
    } else {
      showToast('warning', '该进程没有工作目录信息')
    }
  }

  const contextMenuItems = [
    { label: '查看详情', icon: <EyeIcon size={16} />, onClick: () => onShowDetail(process.pid) },
    { label: '打开目录', icon: <FolderIcon size={16} />, onClick: handleOpenDir, disabled: !process.workingDir },
    { label: '复制命令', icon: <CopyIcon size={16} />, onClick: handleCopyCommand, disabled: !process.command },
    { label: '进程树', icon: <TreeIcon size={16} />, onClick: () => onShowTree(process.pid) },
    { label: '', onClick: () => {}, divider: true },
    { label: '终止进程', icon: <CloseIcon size={16} />, onClick: () => setShowKillConfirm(true), danger: true }
  ]

  return (
    <>
      <div
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        className={`
          group flex items-center gap-4 px-4 py-2 cursor-pointer transition-all duration-200
          border-l-3 bg-surface-800
          ${isSelected
            ? 'border-accent bg-accent/10'
            : 'border-transparent hover:border-surface-500 hover:bg-surface-700'
          }
        `}
        style={{ borderRadius: '2px', height: '40px' }}
      >
        {/* Status + Type Icon */}
        <div className="relative flex-shrink-0">
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 ${statusColor} ${process.status === 'running' ? 'status-dot-running' : ''}`} style={{ borderRadius: '1px' }} />
          <div className={`w-6 h-6 bg-surface-700 flex items-center justify-center border-l-2 ${typeConfig.borderColor}`} style={{ borderRadius: '2px' }}>
            {React.cloneElement(typeConfig.icon as React.ReactElement, { size: 14 })}
          </div>
        </div>

        {/* Name */}
        <span className="text-xs font-bold text-text-primary truncate min-w-[100px] max-w-[180px]" title={process.name}>
          {process.name}
        </span>

        {/* PID */}
        <span className="text-[10px] text-text-muted font-mono min-w-[50px]">{process.pid}</span>

        {/* Port */}
        <span className={`text-[10px] font-mono min-w-[50px] ${process.port ? 'text-gold font-bold' : 'text-text-muted'}`}>
          {process.port ? `:${process.port}` : '-'}
        </span>

        {/* CPU */}
        <div className="flex items-center gap-1 min-w-[70px]">
          <div className="w-[30px] h-1 bg-surface-700" style={{ borderRadius: '1px' }}>
            <div className={`h-full ${cpuColor.bg}`} style={{ width: `${Math.min(process.cpu, 100)}%`, borderRadius: '1px' }} />
          </div>
          <span className={`text-[10px] font-mono font-bold ${cpuColor.text}`}>{process.cpu.toFixed(1)}%</span>
        </div>

        {/* Memory */}
        <div className="flex items-center gap-1 min-w-[70px]">
          <div className="w-[30px] h-1 bg-surface-700" style={{ borderRadius: '1px' }}>
            <div className={`h-full ${memColor.bg}`} style={{ width: `${memPercent}%`, borderRadius: '1px' }} />
          </div>
          <span className={`text-[10px] font-mono font-bold ${memColor.text}`}>{process.memory}MB</span>
        </div>

        {/* Start Time */}
        <span className="text-[10px] text-text-muted min-w-[30px]">{formatStartTime(process.startTime)}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onShowDetail(process.pid) }}
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
        message={`确定要终止进程 "${process.name}" (PID: ${process.pid}) 吗？`}
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
  onSelectProcess: (pid: number) => void
  onKillProcess: (pid: number) => void
  onShowDetail: (pid: number) => void
  onShowTree: (pid: number) => void
}

const ProcessGroupCard = memo(function ProcessGroupCard({
  group, index, maxMemory, selectedPid, onSelectProcess, onKillProcess, onShowDetail, onShowTree
}: ProcessGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div
      className="animate-card-stagger bg-surface-800 border-2 border-surface-700 overflow-hidden"
      style={{ borderRadius: '4px', animationDelay: `${index * 80}ms` }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-700/50 transition-all duration-200"
      >
        <div className="flex items-center gap-4">
          <div className={`
            w-10 h-10 bg-accent/10 flex items-center justify-center border-l-3 border-accent
            transition-transform duration-300 ${isExpanded ? 'rotate-0' : '-rotate-90'}
          `} style={{ borderRadius: '2px' }}>
            <ChevronDownIcon size={20} className="text-accent" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-bold text-text-primary">{group.projectName}</h3>
            <span className="text-xs text-text-muted">{group.processes.length} 个进程</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-bold text-text-primary font-mono">{group.totalCpu.toFixed(1)}%</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">CPU</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-text-primary font-mono">{group.totalMemory}MB</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">内存</div>
          </div>
        </div>
      </button>

      <div className={`transition-all duration-300 ease-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 space-y-1">
          {group.processes.map((process) => (
            <ProcessItem
              key={process.pid}
              process={process}
              maxMemory={maxMemory}
              isSelected={selectedPid === process.pid}
              onSelect={() => onSelectProcess(process.pid)}
              onKill={() => onKillProcess(process.pid)}
              onShowDetail={onShowDetail}
              onShowTree={onShowTree}
            />
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
  sortConfigs: import('@shared/types-extended').SortConfig[]
  onSelectProcess: (pid: number) => void
  onKillProcess: (pid: number) => void
  onShowDetail: (pid: number) => void
  onShowTree: (pid: number) => void
  onSort: (column: SortColumn, append: boolean) => void
}

const VirtualListView = memo(function VirtualListView({
  processes, maxMemory, selectedPid, sortConfigs, onSelectProcess, onKillProcess, onShowDetail, onShowTree, onSort
}: VirtualListViewProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: processes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10
  })

  return (
    <div className="flex flex-col h-full">
      {/* Table Header */}
      <div className="flex items-center gap-4 px-4 py-2 bg-surface-900 border-b border-surface-700 flex-shrink-0" style={{ minHeight: '32px' }}>
        <div className="w-6 flex-shrink-0" /> {/* icon spacer */}
        <SortableHeader column="name" label="名称" className="min-w-[100px] max-w-[180px] flex-1" sortConfigs={sortConfigs} onSort={onSort} />
        <SortableHeader column="pid" label="PID" className="min-w-[50px]" sortConfigs={sortConfigs} onSort={onSort} />
        <SortableHeader column="port" label="端口" className="min-w-[50px]" sortConfigs={sortConfigs} onSort={onSort} />
        <SortableHeader column="cpu" label="CPU" className="min-w-[70px]" sortConfigs={sortConfigs} onSort={onSort} />
        <SortableHeader column="memory" label="内存" className="min-w-[70px]" sortConfigs={sortConfigs} onSort={onSort} />
        <SortableHeader column="startTime" label="启动" className="min-w-[30px]" sortConfigs={sortConfigs} onSort={onSort} />
        <div className="w-[60px] ml-auto" /> {/* actions spacer */}
      </div>

      {/* Virtual Scroll Container */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const process = processes[virtualItem.index]
            return (
              <div
                key={process.pid}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`
                }}
              >
                <ProcessItem
                  process={process}
                  maxMemory={maxMemory}
                  isSelected={selectedPid === process.pid}
                  onSelect={() => onSelectProcess(process.pid)}
                  onKill={() => onKillProcess(process.pid)}
                  onShowDetail={onShowDetail}
                  onShowTree={onShowTree}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

// ============ Main ProcessView ============

export function ProcessView() {
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
    getDeepDetail,
    getConnections,
    getEnvironment,
    killProcessTree,
    setProcessPriority,
    openFileLocation,
    getModules,
    toggleSort,
    clearSort,
    setSearchQuery,
    toggleStatusFilter,
    toggleTypeFilter,
    clearFilters,
    getFilteredAndSortedProcesses
  } = useSystemProcesses()

  const { showToast } = useToast()

  const [viewMode, setViewMode] = useState<'list' | 'grouped' | 'cards'>('list')
  const [detailPid, setDetailPid] = useState<number | null>(null)
  const [drawerPid, setDrawerPid] = useState<number | null>(null)

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

  const refreshAll = useCallback(async () => {
    await Promise.all([scan(), getGroups()])
  }, [scan, getGroups])

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 5000)
    return () => clearInterval(interval)
  }, [refreshAll])

  // Fetch history for card view (batch fetch for visible processes)
  useEffect(() => {
    if (viewMode !== 'cards') return
    let cancelled = false

    const fetchHistories = async () => {
      const visible = filteredProcesses.slice(0, 30) // only first 30
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
  }, [viewMode, filteredProcesses, getProcessHistory])

  const handleCleanupZombies = useCallback(async () => {
    const cleaned = await cleanupZombies()
    if (cleaned > 0) {
      showToast('success', `清理了 ${cleaned} 个僵尸进程`)
    }
  }, [cleanupZombies, showToast])

  const handleShowDetail = useCallback((pid: number) => {
    setDrawerPid(prev => prev === pid ? null : pid)
  }, [])

  // Toggle inline detail panel (used in existing ProcessDetailPanel integration)
  const handleShowInlineDetail = useCallback((pid: number) => {
    setDetailPid(prev => prev === pid ? null : pid)
  }, [])
  // Suppress unused warning — kept for backward compatibility with inline detail panel
  void handleShowInlineDetail

  const totalResources = getTotalResources()

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b-2 border-surface-700 bg-surface-900 relative">
        <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-surface-700 flex items-center justify-center border-l-3 border-accent" style={{ borderRadius: '2px' }}>
              <ProcessIcon size={20} className="text-accent" />
            </div>
            <div>
              <h2
                className="text-text-primary font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}
              >
                系统进程
              </h2>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="font-mono">{processes.length} 个进程</span>
                <LastScanTime lastScanTime={lastScanTime} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ViewModeToggle
              modes={[
                { key: 'list', icon: <ListIcon size={16} />, label: '列表' },
                { key: 'cards', icon: <GridIcon size={16} />, label: '卡片' },
                { key: 'grouped', icon: <GroupIcon size={16} />, label: '分组' }
              ]}
              current={viewMode}
              onChange={(mode) => setViewMode(mode as typeof viewMode)}
            />

            {zombies.length > 0 && (
              <button
                onClick={handleCleanupZombies}
                className="btn-warning flex items-center gap-2 text-xs px-4 py-2"
              >
                <AlertIcon size={16} />
                清理 {zombies.length} 个僵尸
              </button>
            )}

            <button
              onClick={refreshAll}
              disabled={isScanning}
              className={`btn-icon bg-surface-800 border border-surface-700 ${isScanning ? 'opacity-50' : 'hover:bg-surface-700 hover:border-surface-600'}`}
              title="刷新"
            >
              <RefreshIcon size={18} className={`text-text-secondary ${isScanning ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="flex-shrink-0 px-5 py-4 stat-grid border-b border-surface-700/50 bg-surface-900/50">
        <StatCard icon={<ProcessIcon size={20} className="text-accent" />} label="活跃进程" value={processes.length} color="accent" />
        <StatCard icon={<ProcessIcon size={20} className="text-info" />} label="CPU 使用" value={`${totalResources.cpu.toFixed(1)}%`} color={totalResources.cpu > 50 ? 'warning' : 'default'} />
        <StatCard icon={<ProcessIcon size={20} className="text-success" />} label="内存使用" value={formatBytes(totalResources.memory)} color={totalResources.memory > 2000 ? 'warning' : 'default'} />
        <StatCard icon={<AlertIcon size={20} className="text-warning" />} label="僵尸进程" value={zombies.length} color={zombies.length > 0 ? 'warning' : 'default'} />
      </div>

      {/* Filter Bar */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-surface-700/30 bg-surface-900/30">
        <ProcessFilterBar
          totalCount={processes.length}
          filteredCount={filteredProcesses.length}
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

      {/* Detail Panel */}
      {detailPid !== null && (
        <div className="flex-shrink-0 px-5 py-3">
          <ProcessDetailPanel
            pid={detailPid}
            onClose={() => setDetailPid(null)}
            onKillProcess={killProcess}
            fetchRelationship={getFullRelationship}
            fetchHistory={getProcessHistory}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <VirtualListView
            processes={filteredProcesses}
            maxMemory={maxMemory}
            selectedPid={selectedPid}
            sortConfigs={sortConfigs}
            onSelectProcess={selectProcess}
            onKillProcess={killProcess}
            onShowDetail={handleShowDetail}
            onShowTree={handleShowDetail}
            onSort={toggleSort}
          />
        ) : viewMode === 'cards' ? (
          <div className="h-full overflow-y-auto p-5">
            <div className="monitor-card-grid" style={{ display: 'grid', gap: 'var(--density-grid-gap, 8px)' }}>
              {filteredProcesses.map((process, index) => {
                const hist = historyCache.get(process.pid)
                return (
                  <ProcessCard
                    key={process.pid}
                    process={process}
                    index={index}
                    maxMemory={maxMemory}
                    cpuHistory={hist?.cpuHistory}
                    memoryHistory={hist?.memoryHistory}
                    onKill={() => killProcess(process.pid)}
                    onShowDetail={handleShowDetail}
                    onShowTree={handleShowDetail}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-5 space-y-4">
            {groups.map((group, index) => (
              <ProcessGroupCard
                key={group.projectId}
                group={group}
                index={index}
                maxMemory={maxMemory}
                selectedPid={selectedPid}
                onSelectProcess={selectProcess}
                onKillProcess={killProcess}
                onShowDetail={handleShowDetail}
                onShowTree={handleShowDetail}
              />
            ))}
          </div>
        )}

        {isScanning && processes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <LoadingSpinner size="md" className="mb-4" />
            <p className="text-text-secondary">正在扫描进程...</p>
          </div>
        )}

        {processes.length === 0 && !isScanning && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-20 h-20 bg-surface-800 flex items-center justify-center mb-6 border-l-3 border-accent" style={{ borderRadius: '4px' }}>
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

        {filteredProcesses.length === 0 && processes.length > 0 && !isScanning && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-16 h-16 bg-surface-800 flex items-center justify-center mb-4 border-l-3 border-warning" style={{ borderRadius: '4px' }}>
              <AlertIcon size={32} className="text-warning" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-2">
              没有匹配的进程
            </h3>
            <p className="text-text-muted text-sm">尝试调整过滤条件</p>
            <button onClick={clearFilters} className="btn-secondary mt-4 text-xs px-4 py-2">
              清除所有过滤
            </button>
          </div>
        )}
      </div>

      {/* Process Detail Drawer */}
      {drawerPid !== null && (
        <ProcessDetailDrawer
          pid={drawerPid}
          onClose={() => setDrawerPid(null)}
          fetchDeepDetail={getDeepDetail}
          fetchConnections={getConnections}
          fetchEnvironment={getEnvironment}
          fetchHistory={getProcessHistory}
          fetchModules={getModules}
          onKillProcess={killProcess}
          onKillTree={killProcessTree}
          onSetPriority={setProcessPriority}
          onOpenFileLocation={openFileLocation}
        />
      )}
    </div>
  )
}
