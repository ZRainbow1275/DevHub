import { memo, useState, useEffect, useCallback } from 'react'
import { ProcessRelationship, ProcessInfo, PortInfo } from '@shared/types-extended'
import { Sparkline } from './Sparkline'
import { formatPID, formatBytes } from '../../utils/formatNumber'
import {
  CloseIcon,
  TreeIcon,
  FolderIcon,
  CopyIcon,
  EyeIcon,
  ProcessIcon,
  PortIcon,
  WindowIcon,
  AlertIcon
} from '../icons'
import { useToast } from '../ui/Toast'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { LoadingSpinner } from '../ui/LoadingSpinner'

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

function formatStartTime(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚启动'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小时前`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay} 天前`
}

const TYPE_LABELS: Record<string, string> = {
  'dev-server': '开发服务',
  'ai-tool': 'AI 工具',
  'build': '构建',
  'database': '数据库',
  'other': '其他'
}

const STATUS_LABELS: Record<string, string> = {
  running: '运行中',
  idle: '空闲',
  waiting: '等待中'
}

const PRIORITY_LABELS: Record<number, string> = {
  4: '空闲',
  6: '低于正常',
  8: '正常',
  10: '高于正常',
  13: '高',
  24: '实时'
}

// ============ Detail Field ============

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-700" style={{ borderRadius: '2px' }}>
      <span className="text-[10px] text-text-muted uppercase tracking-wider block">{label}</span>
      <span className={`text-sm font-bold text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ============ Compact Process Row ============

function CompactProcessRow({ proc, onClick }: { proc: ProcessInfo; onClick?: () => void }) {
  return (
    <div
      className={`flex items-center justify-between bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 ${onClick ? 'cursor-pointer hover:bg-surface-800' : ''}`}
      style={{ borderRadius: '2px' }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-xs font-mono text-text-muted bg-surface-800 px-1.5 py-0.5" style={{ borderRadius: '2px' }}>
          {proc.pid}
        </span>
        <span className="text-xs text-text-primary truncate" title={proc.name}>
          {proc.name}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] flex-shrink-0">
        <span className="font-mono text-text-secondary">{proc.cpu.toFixed(1)}%</span>
        <span className="font-mono text-text-secondary">{proc.memory}MB</span>
      </div>
    </div>
  )
}

// ============ Port Row ============

function PortRow({ port }: { port: PortInfo }) {
  return (
    <div className="flex items-center justify-between bg-surface-900 px-3 py-1.5 border-l-2 border-gold/30" style={{ borderRadius: '2px' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-gold">:{port.port}</span>
        <span className="text-[10px] text-text-muted">{port.protocol}</span>
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 ${
        port.state === 'LISTENING' ? 'text-success bg-success/10' :
        port.state === 'ESTABLISHED' ? 'text-info bg-info/10' :
        'text-text-muted bg-surface-800'
      }`} style={{ borderRadius: '2px' }}>
        {port.state}
      </span>
    </div>
  )
}

// ============ Main ProcessDetailPanel ============

interface ProcessDetailPanelProps {
  pid: number
  onClose: () => void
  onKillProcess: (pid: number) => Promise<boolean>
  fetchRelationship: (pid: number) => Promise<ProcessRelationship | null>
  fetchHistory: (pid: number) => Promise<{ cpuHistory: number[]; memoryHistory: number[] }>
  onNavigateToNeuralGraph?: (pid: number) => void
}

export const ProcessDetailPanel = memo(function ProcessDetailPanel({
  pid,
  onClose,
  onKillProcess,
  fetchRelationship,
  fetchHistory,
  onNavigateToNeuralGraph
}: ProcessDetailPanelProps) {
  const { showToast } = useToast()
  const [relationship, setRelationship] = useState<ProcessRelationship | null>(null)
  const [history, setHistory] = useState<{ cpuHistory: number[]; memoryHistory: number[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [showKillTreeConfirm, setShowKillTreeConfirm] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string>('info')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    Promise.all([
      fetchRelationship(pid),
      fetchHistory(pid)
    ]).then(([rel, hist]) => {
      if (cancelled) return
      setRelationship(rel)
      setHistory(hist)
      setIsLoading(false)
    }).catch(() => {
      if (cancelled) return
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [pid, fetchRelationship, fetchHistory])

  // Refresh history periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const hist = await fetchHistory(pid)
        setHistory(hist)
      } catch {
        // Process may have been terminated — ignore
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [pid, fetchHistory])

  const handleCopyCommand = useCallback(async () => {
    const cmd = relationship?.self?.commandLine
    if (cmd) {
      await navigator.clipboard.writeText(cmd)
      showToast('success', '命令已复制到剪贴板')
    }
  }, [relationship, showToast])

  const handleOpenDir = useCallback(() => {
    const dir = relationship?.self?.workingDir
    if (dir) {
      window.devhub.shell.openPath(dir)
    } else {
      showToast('warning', '该进程没有工作目录信息')
    }
  }, [relationship, showToast])

  const handleKill = useCallback(async () => {
    setShowKillConfirm(false)
    const success = await onKillProcess(pid)
    if (success) {
      showToast('success', '进程已终止')
      onClose()
    } else {
      showToast('error', '终止进程失败')
    }
  }, [pid, onKillProcess, showToast, onClose])

  const handleKillTree = useCallback(async () => {
    setShowKillTreeConfirm(false)
    // Kill descendants first, then self
    if (relationship) {
      for (const desc of [...relationship.descendants].reverse()) {
        await onKillProcess(desc.pid)
      }
    }
    const success = await onKillProcess(pid)
    if (success) {
      showToast('success', '进程树已终止')
      onClose()
    }
  }, [pid, relationship, onKillProcess, showToast, onClose])

  if (isLoading) {
    return (
      <div className="relative bg-surface-800 border-2 border-surface-600 border-l-3 border-l-accent overflow-hidden animate-fade-in" style={{ borderRadius: '4px' }}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="sm" className="mr-2" />
          <span className="text-text-muted text-sm">加载进程详情...</span>
        </div>
      </div>
    )
  }

  if (!relationship) {
    return (
      <div className="relative bg-surface-800 border-2 border-surface-600 border-l-3 border-l-error overflow-hidden animate-fade-in" style={{ borderRadius: '4px' }}>
        <div className="flex items-center justify-center py-8 gap-2">
          <AlertIcon size={16} className="text-error" />
          <span className="text-text-muted text-sm">无法获取进程信息 (PID: {pid})</span>
          <button onClick={onClose} className="btn-icon-sm text-text-muted hover:text-text-primary ml-4">
            <CloseIcon size={14} />
          </button>
        </div>
      </div>
    )
  }

  const self = relationship.self
  const cpuColor = getResourceColor(self.cpu)
  const memPercent = self.memory > 0 ? Math.min((self.memory / Math.max(self.memory, 100)) * 100, 100) : 0
  const memColor = getMemoryResourceColor(memPercent)

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section)
  }

  return (
    <>
      <div className="relative bg-surface-800 border-2 border-surface-600 border-l-3 border-l-accent overflow-hidden animate-fade-in" style={{ borderRadius: '4px' }}>
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700 relative z-10">
          <div className="flex items-center gap-3">
            <ProcessIcon size={16} className="text-accent" />
            <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              {self.name}
            </h4>
            <span className="text-xs text-text-muted font-mono bg-surface-700 px-2 py-0.5" style={{ borderRadius: '2px' }}>
              PID: {formatPID(self.pid)}
            </span>
            {self.parentName && (
              <span className="text-[10px] text-text-muted">
                &larr; {self.parentName} ({self.ppid})
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn-icon-sm text-text-muted hover:text-text-primary">
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3 relative z-10 max-h-[500px] overflow-y-auto">
          {/* Basic Info Grid */}
          <SectionHeader title="基本信息" icon={<EyeIcon size={14} />} isOpen={expandedSection === 'info'} onToggle={() => toggleSection('info')} />
          {expandedSection === 'info' && (
            <div className="space-y-2 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DetailField label="PID" value={formatPID(self.pid)} mono />
                <DetailField label="PPID" value={self.ppid > 0 ? formatPID(self.ppid) : '-'} mono />
                <DetailField label="状态" value={STATUS_LABELS[self.status] || self.status} />
                <DetailField label="类型" value={TYPE_LABELS[self.type] || self.type} />
                <DetailField label="启动时间" value={formatStartTime(self.startTime)} />
                {self.userName && <DetailField label="用户" value={self.userName} />}
                {self.priority !== undefined && (
                  <DetailField label="优先级" value={PRIORITY_LABELS[self.priority] || `${self.priority}`} />
                )}
                <DetailField label="线程数" value={`${self.threadCount}`} mono />
                <DetailField label="句柄数" value={`${self.handleCount}`} mono />
              </div>

              {/* Command Line */}
              {self.commandLine && (
                <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">完整命令</span>
                  <p className="text-xs text-text-secondary font-mono break-all">$ {self.commandLine}</p>
                </div>
              )}

              {/* Working Directory */}
              {self.workingDir && (
                <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">工作目录</span>
                  <p className="text-xs text-text-secondary font-mono break-all">{self.workingDir}</p>
                </div>
              )}
            </div>
          )}

          {/* Resource Monitoring */}
          <SectionHeader title="资源监控" icon={<ProcessIcon size={14} />} isOpen={expandedSection === 'resources'} onToggle={() => toggleSection('resources')} />
          {expandedSection === 'resources' && (
            <div className="space-y-2 animate-fade-in">
              {/* CPU */}
              <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">CPU 使用率</span>
                  <div className="flex items-center gap-2">
                    {history && history.cpuHistory.length > 1 && (
                      <Sparkline
                        data={history.cpuHistory}
                        width={80}
                        height={16}
                        color="var(--accent)"
                        threshold={80}
                      />
                    )}
                    <span className={`font-mono font-bold text-sm ${cpuColor.text}`}>{self.cpu.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-surface-800" style={{ borderRadius: '1px' }}>
                  <div
                    className={`h-full transition-all duration-500 ${cpuColor.bg}`}
                    style={{ width: `${Math.min(self.cpu, 100)}%`, borderRadius: '1px' }}
                  />
                </div>
              </div>

              {/* Memory */}
              <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">内存使用</span>
                  <div className="flex items-center gap-2">
                    {history && history.memoryHistory.length > 1 && (
                      <Sparkline
                        data={history.memoryHistory}
                        width={80}
                        height={16}
                        color="var(--info)"
                      />
                    )}
                    <span className={`font-mono font-bold text-sm ${memColor.text}`}>{formatBytes(self.memory)}</span>
                  </div>
                </div>
                <div className="h-2 bg-surface-800" style={{ borderRadius: '1px' }}>
                  <div
                    className={`h-full transition-all duration-500 ${memColor.bg}`}
                    style={{ width: `${memPercent}%`, borderRadius: '1px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Relationships */}
          <SectionHeader
            title={`关联 (${relationship.relatedPorts.length} 端口 · ${relationship.children.length} 子进程 · ${relationship.relatedWindows.length} 窗口)`}
            icon={<TreeIcon size={14} />}
            isOpen={expandedSection === 'relations'}
            onToggle={() => toggleSection('relations')}
          />
          {expandedSection === 'relations' && (
            <div className="space-y-2 animate-fade-in">
              {/* Ports */}
              {self.ports.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <PortIcon size={12} className="text-gold" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">绑定端口 ({self.ports.length})</span>
                  </div>
                  <div className="space-y-1">
                    {relationship.relatedPorts.filter(p => p.pid === pid).map(port => (
                      <PortRow key={`${port.port}-${port.state}`} port={port} />
                    ))}
                  </div>
                </div>
              )}

              {/* Children */}
              {relationship.children.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <TreeIcon size={12} className="text-accent" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">子进程 ({relationship.children.length})</span>
                  </div>
                  <div className="space-y-1">
                    {relationship.children.map(child => (
                      <CompactProcessRow key={child.pid} proc={child} />
                    ))}
                  </div>
                </div>
              )}

              {/* Ancestors */}
              {relationship.ancestors.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <TreeIcon size={12} className="text-info" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">祖先链 ({relationship.ancestors.length})</span>
                  </div>
                  <div className="space-y-1">
                    {relationship.ancestors.map(anc => (
                      <CompactProcessRow key={anc.pid} proc={anc} />
                    ))}
                  </div>
                </div>
              )}

              {/* Siblings */}
              {relationship.siblings.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <ProcessIcon size={12} className="text-steel" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">兄弟进程 ({relationship.siblings.length})</span>
                  </div>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {relationship.siblings.slice(0, 10).map(sib => (
                      <CompactProcessRow key={sib.pid} proc={sib} />
                    ))}
                    {relationship.siblings.length > 10 && (
                      <span className="text-[10px] text-text-muted px-3">...还有 {relationship.siblings.length - 10} 个</span>
                    )}
                  </div>
                </div>
              )}

              {/* Windows */}
              {relationship.relatedWindows.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <WindowIcon size={12} className="text-success" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">关联窗口 ({relationship.relatedWindows.length})</span>
                  </div>
                  <div className="space-y-1">
                    {relationship.relatedWindows.map(win => (
                      <div key={win.hwnd} className="flex items-center justify-between bg-surface-900 px-3 py-1.5 border-l-2 border-success/30" style={{ borderRadius: '2px' }}>
                        <span className="text-xs text-text-primary truncate">{win.title || win.className}</span>
                        <span className="text-[10px] font-mono text-text-muted">{win.processName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-surface-700">
            <button
              onClick={() => setShowKillConfirm(true)}
              className="btn-danger flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <CloseIcon size={12} />
              结束进程
            </button>
            {relationship.children.length > 0 && (
              <button
                onClick={() => setShowKillTreeConfirm(true)}
                className="btn-danger flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <TreeIcon size={12} />
                结束进程树
              </button>
            )}
            <button
              onClick={handleOpenDir}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
              disabled={!self.workingDir}
            >
              <FolderIcon size={12} />
              打开目录
            </button>
            <button
              onClick={handleCopyCommand}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
              disabled={!self.commandLine}
            >
              <CopyIcon size={12} />
              复制命令
            </button>
            {onNavigateToNeuralGraph && (
              <button
                onClick={() => onNavigateToNeuralGraph(pid)}
                className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <TreeIcon size={12} />
                关系图
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Kill Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showKillConfirm}
        title="终止进程"
        message={`确定要终止进程 "${self.name}" (PID: ${self.pid}) 吗？`}
        confirmText="终止"
        variant="danger"
        onConfirm={handleKill}
        onCancel={() => setShowKillConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showKillTreeConfirm}
        title="终止进程树"
        message={`确定要终止 "${self.name}" 及其 ${relationship.children.length} 个子进程吗？`}
        confirmText="终止全部"
        variant="danger"
        onConfirm={handleKillTree}
        onCancel={() => setShowKillTreeConfirm(false)}
      />
    </>
  )
})

// ============ Section Header ============

function SectionHeader({ title, icon, isOpen, onToggle }: { title: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-surface-700/30 transition-colors"
    >
      <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}>
        {icon}
      </span>
      <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">{title}</span>
    </button>
  )
}
