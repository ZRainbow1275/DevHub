import { useEffect, memo, useState, useCallback } from 'react'
import { useSystemProcesses } from '../../hooks/useSystemProcesses'
import { ProcessInfo, ProcessGroup } from '@shared/types-extended'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { StatCard } from '../ui/StatCard'
import { ViewModeToggle } from '../ui/ViewModeToggle'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { LastScanTime } from '../ui/LastScanTime'
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
  GroupIcon
} from '../icons'

// 进程类型图标映射
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

// 进程卡片组件
interface ProcessCardProps {
  process: ProcessInfo
  index: number
  onKill: () => void
}

const ProcessCard = memo(function ProcessCard({ process, index, onKill }: ProcessCardProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const typeConfig = TYPE_ICONS[process.type] || TYPE_ICONS['other']

  const statusConfig = {
    running: { color: 'bg-success', text: '运行中', textColor: 'text-success' },
    idle: { color: 'bg-warning', text: '空闲', textColor: 'text-warning' },
    waiting: { color: 'bg-surface-400', text: '等待中', textColor: 'text-text-muted' }
  }[process.status] ?? { color: 'bg-surface-400', text: process.status || 'unknown' }

  return (
    <>
      <div
        className={`
          monitor-card group relative overflow-hidden animate-card-stagger
          ${isHovered ? 'monitor-card-selected' : ''}
          ${process.status === 'running' ? 'card-running' : ''}
        `}
        style={{ animationDelay: `${index * 50}ms` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />

        {/* Running indicator */}
        {process.status === 'running' && (
          <div className="absolute top-3 right-3">
            <span className="status-dot status-dot-running" />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-10 h-10 bg-surface-800 flex items-center justify-center border-l-3 ${typeConfig.borderColor}`} style={{ borderRadius: '2px' }}>
              {typeConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-text-primary truncate mb-1" title={process.name}>
                {process.name}
              </h3>
              <div className="flex items-center gap-2">
                <span className={`status-badge ${process.status === 'running' ? 'status-badge-running' : ''}`}>
                  <span className={`w-1.5 h-1.5 ${statusConfig.color}`} style={{ borderRadius: '1px' }} />
                  {statusConfig.text}
                </span>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="metric-display">
              <span className="text-lg font-bold text-text-primary font-mono">{process.pid}</span>
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">PID</span>
            </div>
            {process.port ? (
              <div className="metric-display border-l-2 border-gold bg-gold/5">
                <span className="text-lg font-bold text-gold font-mono">:{process.port}</span>
                <span className="text-[10px] text-gold uppercase tracking-wider">端口</span>
              </div>
            ) : (
              <div className="metric-display">
                <span className="text-lg font-bold text-text-muted">-</span>
                <span className="text-[10px] text-text-tertiary uppercase tracking-wider">端口</span>
              </div>
            )}
          </div>

          {/* CPU/Memory Bars */}
          <div className="space-y-2 mb-4">
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-text-muted uppercase tracking-wider">CPU</span>
                <span className={`font-mono font-bold ${process.cpu > 50 ? 'text-warning' : 'text-text-secondary'}`}>
                  {process.cpu.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 bg-surface-800" style={{ borderRadius: '1px' }}>
                <div
                  className={`h-full transition-all duration-500 ${
                    process.cpu > 50 ? 'bg-warning' : 'bg-accent'
                  }`}
                  style={{ width: `${Math.min(process.cpu, 100)}%`, borderRadius: '1px' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-text-muted uppercase tracking-wider">内存</span>
                <span className={`font-mono font-bold ${process.memory > 500 ? 'text-warning' : 'text-text-secondary'}`}>
                  {process.memory}MB
                </span>
              </div>
              <div className="h-1.5 bg-surface-800" style={{ borderRadius: '1px' }}>
                <div
                  className={`h-full transition-all duration-500 ${
                    process.memory > 500 ? 'bg-warning' : 'bg-info'
                  }`}
                  style={{ width: `${Math.min(process.memory / 10, 100)}%`, borderRadius: '1px' }}
                />
              </div>
            </div>
          </div>

          {/* Command */}
          {process.command && (
            <div className="bg-surface-900 px-3 py-2 mb-4 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
              <p className="text-[10px] text-text-tertiary truncate font-mono" title={process.command}>
                $ {process.command}
              </p>
            </div>
          )}

          {/* Action Button */}
          <div className={`
            flex items-center justify-end gap-2
            transition-all duration-300
            ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}>
            <button
              onClick={() => setShowKillConfirm(true)}
              className="btn-danger flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <CloseIcon size={14} />
              终止进程
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showKillConfirm}
        title="终止进程"
        message={`确定要终止进程 "${process.name}" (PID: ${process.pid}) 吗？`}
        confirmText="终止"
        variant="danger"
        onConfirm={() => {
          setShowKillConfirm(false)
          onKill()
        }}
        onCancel={() => setShowKillConfirm(false)}
      />
    </>
  )
})

// 列表项组件
interface ProcessItemProps {
  process: ProcessInfo
  index: number
  isSelected: boolean
  onSelect: () => void
  onKill: () => void
}

const ProcessItem = memo(function ProcessItem({ process, index, isSelected, onSelect, onKill }: ProcessItemProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)

  const typeConfig = TYPE_ICONS[process.type] || TYPE_ICONS['other']

  const statusColor = {
    running: 'bg-success',
    idle: 'bg-warning',
    waiting: 'bg-surface-500'
  }[process.status] ?? 'bg-surface-400'

  return (
    <>
      <div
        onClick={onSelect}
        className={`
          animate-card-stagger group p-4 cursor-pointer transition-all duration-200
          border-l-3 bg-surface-800
          ${isSelected
            ? 'border-accent bg-accent/10'
            : 'border-transparent hover:border-surface-500 hover:bg-surface-700'
          }
        `}
        style={{ borderRadius: '2px', animationDelay: `${index * 40}ms` }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="relative">
              <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${statusColor} ${process.status === 'running' ? 'status-dot-running' : ''}`} style={{ borderRadius: '1px' }} />
              <div className={`w-8 h-8 bg-surface-700 flex items-center justify-center border-l-2 ${typeConfig.borderColor}`} style={{ borderRadius: '2px' }}>
                {typeConfig.icon}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-text-primary truncate">
                  {process.name}
                </span>
                <span className="text-xs text-text-muted font-mono bg-surface-700 px-2 py-0.5" style={{ borderRadius: '2px' }}>
                  PID: {process.pid}
                </span>
              </div>
              {process.command && (
                <p className="text-xs text-text-tertiary truncate mt-1 font-mono" title={process.command}>
                  $ {process.command.length > 50 ? process.command.slice(0, 50) + '...' : process.command}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            {process.port && (
              <span className="text-sm font-bold font-mono bg-gold/10 text-gold px-3 py-1 border-l-2 border-gold" style={{ borderRadius: '2px' }}>
                :{process.port}
              </span>
            )}
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <div className={`font-bold font-mono ${process.cpu > 50 ? 'text-warning' : 'text-text-secondary'}`}>
                  {process.cpu.toFixed(1)}%
                </div>
                <div className="text-text-muted text-[10px] uppercase tracking-wider">CPU</div>
              </div>
              <div className="text-center">
                <div className={`font-bold font-mono ${process.memory > 500 ? 'text-warning' : 'text-text-secondary'}`}>
                  {process.memory}MB
                </div>
                <div className="text-text-muted text-[10px] uppercase tracking-wider">内存</div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowKillConfirm(true)
              }}
              className="btn-icon-sm text-error/60 hover:text-error hover:bg-error/20 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="终止进程"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showKillConfirm}
        title="终止进程"
        message={`确定要终止进程 "${process.name}" (PID: ${process.pid}) 吗？`}
        confirmText="终止"
        variant="danger"
        onConfirm={() => {
          setShowKillConfirm(false)
          onKill()
        }}
        onCancel={() => setShowKillConfirm(false)}
      />
    </>
  )
})

// 分组卡片组件
interface ProcessGroupCardProps {
  group: ProcessGroup
  index: number
  selectedPid: number | null
  onSelectProcess: (pid: number) => void
  onKillProcess: (pid: number) => void
}

const ProcessGroupCard = memo(function ProcessGroupCard({
  group,
  index,
  selectedPid,
  onSelectProcess,
  onKillProcess
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
            <span className="text-xs text-text-muted">
              {group.processes.length} 个进程
            </span>
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

      <div className={`
        transition-all duration-300 ease-out overflow-hidden
        ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <div className="px-4 pb-4 space-y-2">
          {group.processes.map((process, idx) => (
            <ProcessItem
              key={process.pid}
              process={process}
              index={idx}
              isSelected={selectedPid === process.pid}
              onSelect={() => onSelectProcess(process.pid)}
              onKill={() => onKillProcess(process.pid)}
            />
          ))}
        </div>
      </div>
    </div>
  )
})

export function ProcessView() {
  const {
    processes,
    groups,
    zombies,
    isScanning,
    lastScanTime,
    selectedPid,
    scan,
    getGroups,
    killProcess,
    cleanupZombies,
    selectProcess,
    getTotalResources
  } = useSystemProcesses()

  const [viewMode, setViewMode] = useState<'list' | 'grouped' | 'cards'>('cards')

  const refreshAll = useCallback(async () => {
    await Promise.all([scan(), getGroups()])
  }, [scan, getGroups])

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 5000)
    return () => clearInterval(interval)
  }, [refreshAll])

  const handleCleanupZombies = useCallback(async () => {
    const cleaned = await cleanupZombies()
    if (cleaned > 0) {
      console.warn(`清理了 ${cleaned} 个僵尸进程`)
    }
  }, [cleanupZombies])

  const totalResources = getTotalResources()

  return (
    <div className="h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b-2 border-surface-700 bg-surface-900 relative">
        {/* Diagonal decoration */}
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
            {/* View Mode Toggle */}
            <ViewModeToggle
              modes={[
                { key: 'cards', icon: <GridIcon size={16} />, label: '卡片' },
                { key: 'list', icon: <ListIcon size={16} />, label: '列表' },
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
      <div className="flex-shrink-0 px-5 py-4 grid grid-cols-4 gap-4 border-b border-surface-700/50 bg-surface-900/50">
        <StatCard
          icon={<ProcessIcon size={20} className="text-accent" />}
          label="活跃进程"
          value={processes.length}
          color="accent"
        />
        <StatCard
          icon={<ProcessIcon size={20} className="text-info" />}
          label="CPU 使用"
          value={`${totalResources.cpu.toFixed(1)}%`}
          color={totalResources.cpu > 50 ? 'warning' : 'default'}
        />
        <StatCard
          icon={<ProcessIcon size={20} className="text-success" />}
          label="内存使用"
          value={`${totalResources.memory}MB`}
          color={totalResources.memory > 2000 ? 'warning' : 'default'}
        />
        <StatCard
          icon={<AlertIcon size={20} className="text-warning" />}
          label="僵尸进程"
          value={zombies.length}
          color={zombies.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {processes.map((process, index) => (
              <ProcessCard
                key={process.pid}
                process={process}
                index={index}
                onKill={() => killProcess(process.pid)}
              />
            ))}
          </div>
        ) : viewMode === 'grouped' ? (
          <div className="space-y-4">
            {groups.map((group, index) => (
              <ProcessGroupCard
                key={group.projectId}
                group={group}
                index={index}
                selectedPid={selectedPid}
                onSelectProcess={selectProcess}
                onKillProcess={killProcess}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {processes.map((process, index) => (
              <ProcessItem
                key={process.pid}
                process={process}
                index={index}
                isSelected={selectedPid === process.pid}
                onSelect={() => selectProcess(process.pid)}
                onKill={() => killProcess(process.pid)}
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
      </div>
    </div>
  )
}
