import { memo, useState, useEffect, useCallback } from 'react'
import { ProcessRelationship, ProcessInfo, PortInfo, NetworkConnectionInfo, LoadedModuleInfo } from '@shared/types-extended'
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
  AlertIcon,
  NetworkIcon,
  CodeIcon,
  PackageIcon,
  RefreshIcon,
  SearchIcon
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
    <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-700 radius-sm">
      <span className="text-[10px] text-text-muted uppercase tracking-wider block">{label}</span>
      <span className={`text-sm font-bold text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ============ Compact Process Row ============

function CompactProcessRow({ proc, onClick }: { proc: ProcessInfo; onClick?: () => void }) {
  return (
    <div
      className={`flex items-center justify-between bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 ${onClick ? 'cursor-pointer hover:bg-surface-800' : ''} radius-sm`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-xs font-mono text-text-muted bg-surface-800 px-1.5 py-0.5 radius-sm">
          {proc.pid}
        </span>
        <span className="text-xs text-text-primary truncate" title={proc.name}>
          {proc.name}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] flex-shrink-0">
        <span className="font-mono text-text-secondary">{(Number.isFinite(proc.cpu) ? proc.cpu : 0).toFixed(1)}%</span>
        <span className="font-mono text-text-secondary">{proc.memory}MB</span>
      </div>
    </div>
  )
}

// ============ Port Row ============

function PortRow({ port }: { port: PortInfo }) {
  return (
    <div className="flex items-center justify-between bg-surface-900 px-3 py-1.5 border-l-2 border-gold/30 radius-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-gold">:{port.port}</span>
        <span className="text-[10px] text-text-muted">{port.protocol}</span>
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 ${
        port.state === 'LISTENING' ? 'text-success bg-success/10' :
        port.state === 'ESTABLISHED' ? 'text-info bg-info/10' :
        'text-text-muted bg-surface-800'
      } radius-sm`}>
        {port.state}
      </span>
    </div>
  )
}

// ============ Main ProcessDetailPanel ============

interface ProcessDetailPanelProps {
  pid: number
  /** Optional basic process info from the process list (avoids full re-fetch) */
  basicProcessInfo?: ProcessInfo
  onClose: () => void
  onKillProcess: (pid: number) => Promise<boolean>
  fetchRelationship: (pid: number) => Promise<ProcessRelationship | null>
  fetchHistory: (pid: number) => Promise<{ cpuHistory: number[]; memoryHistory: number[] }>
  onNavigateToNeuralGraph?: (pid: number) => void
}

interface TabState<T> {
  data: T | null
  loading: boolean
  error: string | null
  loaded: boolean
}

/** Active tab for multi-tab design */
type DetailTab = 'info' | 'resources' | 'network' | 'env' | 'modules' | 'relations'

export const ProcessDetailPanel = memo(function ProcessDetailPanel({
  pid,
  basicProcessInfo,
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
  const [fetchError, setFetchError] = useState(false)
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [showKillTreeConfirm, setShowKillTreeConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<DetailTab>('info')
  // Legacy: keep expandedSection for backward-compatible rendering
  const expandedSection = activeTab

  // Per-tab lazy-loaded data states
  const [networkState, setNetworkState] = useState<TabState<NetworkConnectionInfo[]>>({ data: null, loading: false, error: null, loaded: false })
  const [envState, setEnvState] = useState<TabState<{ variables: Record<string, string>; requiresElevation: boolean }>>({ data: null, loading: false, error: null, loaded: false })
  const [modulesState, setModulesState] = useState<TabState<{ modules: LoadedModuleInfo[]; requiresElevation: boolean }>>({ data: null, loading: false, error: null, loaded: false })
  const [envSearch, setEnvSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setFetchError(false)
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
      setFetchError(true)
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

  // Lazy load network tab data on first visit
  useEffect(() => {
    if (activeTab !== 'network' || networkState.loaded || networkState.loading) return
    setNetworkState(s => ({ ...s, loading: true, error: null }))
    window.devhub.systemProcess.getConnections(pid)
      .then(data => setNetworkState({ data, loading: false, error: null, loaded: true }))
      .catch((err: unknown) => setNetworkState({ data: null, loading: false, error: err instanceof Error ? err.message : '获取失败', loaded: true }))
  }, [activeTab, pid, networkState.loaded, networkState.loading])

  // Lazy load environment tab data on first visit
  useEffect(() => {
    if (activeTab !== 'env' || envState.loaded || envState.loading) return
    setEnvState(s => ({ ...s, loading: true, error: null }))
    window.devhub.systemProcess.getEnvironment(pid)
      .then(data => setEnvState({ data, loading: false, error: null, loaded: true }))
      .catch((err: unknown) => setEnvState({ data: null, loading: false, error: err instanceof Error ? err.message : '获取失败', loaded: true }))
  }, [activeTab, pid, envState.loaded, envState.loading])

  // Lazy load modules tab data on first visit
  useEffect(() => {
    if (activeTab !== 'modules' || modulesState.loaded || modulesState.loading) return
    setModulesState(s => ({ ...s, loading: true, error: null }))
    window.devhub.systemProcess.getModules(pid)
      .then(data => setModulesState({ data, loading: false, error: null, loaded: true }))
      .catch((err: unknown) => setModulesState({ data: null, loading: false, error: err instanceof Error ? err.message : '获取失败', loaded: true }))
  }, [activeTab, pid, modulesState.loaded, modulesState.loading])

  const handleCopyCommand = useCallback(async () => {
    const cmd = relationship?.self?.commandLine || basicProcessInfo?.command
    if (cmd) {
      await navigator.clipboard.writeText(cmd)
      showToast('success', '命令已复制到剪贴板')
    }
  }, [relationship, basicProcessInfo, showToast])

  const handleOpenDir = useCallback(() => {
    const dir = relationship?.self?.workingDir || basicProcessInfo?.workingDir
    if (dir) {
      window.devhub.shell.openPath(dir)
    } else {
      showToast('warning', '该进程没有工作目录信息')
    }
  }, [relationship, basicProcessInfo, showToast])

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
      for (const desc of [...(relationship.descendants ?? [])].reverse()) {
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
      <div className="relative bg-surface-800 border-2 border-surface-600 border-l-3 border-l-accent overflow-hidden animate-fade-in radius-md">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="sm" className="mr-2" />
          <span className="text-text-muted text-sm">加载进程详情...</span>
        </div>
      </div>
    )
  }

  // If no relationship data but we have basic process info, show partial view
  if (!relationship && !basicProcessInfo) {
    return (
      <div className="relative bg-surface-800 border-2 border-surface-600 border-l-3 border-l-error overflow-hidden animate-fade-in radius-md">
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

  // Build self from relationship or from basicProcessInfo fallback
  const self = relationship ? relationship.self : (() => {
    const bp = basicProcessInfo!
    return {
      pid: bp.pid,
      name: bp.name,
      command: bp.command,
      port: bp.port,
      cpu: bp.cpu,
      memory: bp.memory,
      status: bp.status,
      startTime: bp.startTime,
      type: bp.type,
      workingDir: bp.workingDir,
      projectId: bp.projectId,
      ppid: 0,
      parentName: undefined,
      childPids: [] as number[],
      siblingPids: [] as number[],
      threadCount: 0,
      handleCount: 0,
      ports: bp.port ? [bp.port] : [] as number[],
      relatedWindowHwnds: [] as number[],
      cpuHistory: [] as number[],
      memoryHistory: [] as number[],
      commandLine: bp.command || '',
      userName: undefined,
      priority: undefined
    }
  })()
  const cpuColor = getResourceColor(self.cpu)
  const memPercent = self.memory > 0 ? Math.min((self.memory / 1024) * 100, 100) : 0
  const memColor = getMemoryResourceColor(memPercent)

  const isPartialData = !relationship && !!basicProcessInfo

  return (
    <>
      <div className="relative bg-surface-800 border-2 border-surface-600 border-l-3 border-l-accent overflow-hidden animate-fade-in radius-md">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700 relative z-10">
          <div className="flex items-center gap-3">
            <ProcessIcon size={16} className="text-accent" />
            <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              {self.name}
            </h4>
            <span className="text-xs text-text-muted font-mono bg-surface-700 px-2 py-0.5 radius-sm">
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

        {/* Partial data warning */}
        {isPartialData && (
          <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 relative z-10">
            <AlertIcon size={12} className="text-warning flex-shrink-0" />
            <span className="text-[10px] text-warning">部分信息不可用 - 仅显示基本信息</span>
          </div>
        )}
        {fetchError && !isPartialData && (
          <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 relative z-10">
            <AlertIcon size={12} className="text-warning flex-shrink-0" />
            <span className="text-[10px] text-warning">部分详细信息获取超时</span>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex items-center gap-0 px-4 pt-2 border-b border-surface-700 relative z-10 overflow-x-auto">
          {([
            { key: 'info' as DetailTab, label: '基础' },
            { key: 'resources' as DetailTab, label: '资源' },
            { key: 'network' as DetailTab, label: '网络' },
            { key: 'env' as DetailTab, label: '环境' },
            { key: 'modules' as DetailTab, label: '模块' },
            { key: 'relations' as DetailTab, label: '关联' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-accent border-accent'
                  : 'text-text-muted border-transparent hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3 relative z-10 max-h-[500px] overflow-y-auto">
          {/* Basic Info Grid */}
          <SectionHeader title="基本信息" icon={<EyeIcon size={14} />} isOpen={expandedSection === 'info'} onToggle={() => setActiveTab('info')} />
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
                <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600 radius-sm">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">完整命令</span>
                  <p className="text-xs text-text-secondary font-mono break-all">$ {self.commandLine}</p>
                </div>
              )}

              {/* Working Directory */}
              {self.workingDir && (
                <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600 radius-sm">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">工作目录</span>
                  <p className="text-xs text-text-secondary font-mono break-all">{self.workingDir}</p>
                </div>
              )}
            </div>
          )}

          {/* Resource Monitoring */}
          <SectionHeader title="资源监控" icon={<ProcessIcon size={14} />} isOpen={expandedSection === 'resources'} onToggle={() => setActiveTab('resources')} />
          {expandedSection === 'resources' && (
            <div className="space-y-2 animate-fade-in">
              {/* CPU */}
              <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600 radius-sm">
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
                <div className="h-2 bg-surface-800 radius-sm">
                  <div
                    className={`h-full transition-all duration-500 ${cpuColor.bg}`}
                    style={{ width: `${Math.min(self.cpu, 100)}%`, borderRadius: '1px' }}
                  />
                </div>
              </div>

              {/* Memory */}
              <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600 radius-sm">
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
                <div className="h-2 bg-surface-800 radius-sm">
                  <div
                    className={`h-full transition-all duration-500 ${memColor.bg}`}
                    style={{ width: `${memPercent}%`, borderRadius: '1px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Network Tab */}
          {expandedSection === 'network' && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-1 mb-2">
                <NetworkIcon size={12} className="text-info" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">网络连接</span>
              </div>
              {networkState.loading && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <LoadingSpinner size="sm" />
                  <span className="text-xs text-text-muted">正在获取网络连接...</span>
                </div>
              )}
              {networkState.error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-error/10 border-l-2 border-error radius-sm">
                  <AlertIcon size={12} className="text-error" />
                  <span className="text-[10px] text-error">{networkState.error}</span>
                  <button
                    className="ml-auto text-[10px] text-text-muted hover:text-text-primary"
                    onClick={() => setNetworkState({ data: null, loading: false, error: null, loaded: false })}
                  >
                    <RefreshIcon size={12} />
                  </button>
                </div>
              )}
              {networkState.loaded && !networkState.error && (
                networkState.data && networkState.data.length > 0 ? (
                  <div className="space-y-1">
                    {networkState.data.map((conn, i) => (
                      <div key={i} className="bg-surface-900 px-3 py-2 border-l-2 border-info/30 radius-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-text-primary">
                            {conn.localAddress}:{conn.localPort}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-info/10 text-info radius-sm">{conn.protocol}</span>
                        </div>
                        {conn.remoteAddress && conn.remotePort > 0 && (
                          <div className="text-[10px] text-text-muted font-mono mt-0.5">
                            → {conn.remoteAddress}:{conn.remotePort}
                          </div>
                        )}
                        <div className="text-[10px] text-text-muted mt-0.5">{conn.state}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-text-muted py-4 text-center">暂无网络连接</div>
                )
              )}
            </div>
          )}

          {/* Environment Tab */}
          {expandedSection === 'env' && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <CodeIcon size={12} className="text-gold" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">环境变量</span>
                <div className="ml-auto flex items-center gap-1 bg-surface-900 px-2 py-1 radius-sm">
                  <SearchIcon size={10} className="text-text-muted" />
                  <input
                    type="text"
                    value={envSearch}
                    onChange={e => setEnvSearch(e.target.value)}
                    placeholder="搜索..."
                    className="bg-transparent text-[10px] text-text-primary outline-none w-24"
                  />
                </div>
              </div>
              {envState.loading && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <LoadingSpinner size="sm" />
                  <span className="text-xs text-text-muted">正在获取环境变量...</span>
                </div>
              )}
              {envState.error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-error/10 border-l-2 border-error radius-sm">
                  <AlertIcon size={12} className="text-error" />
                  <span className="text-[10px] text-error">{envState.error}</span>
                  <button
                    className="ml-auto text-[10px] text-text-muted hover:text-text-primary"
                    onClick={() => setEnvState({ data: null, loading: false, error: null, loaded: false })}
                  >
                    <RefreshIcon size={12} />
                  </button>
                </div>
              )}
              {envState.loaded && !envState.error && envState.data && (
                <>
                  {envState.data.requiresElevation && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border-l-2 border-warning radius-sm">
                      <AlertIcon size={12} className="text-warning" />
                      <span className="text-[10px] text-warning">需要管理员权限 - 部分环境变量不可用</span>
                    </div>
                  )}
                  <div className="space-y-1 max-h-[240px] overflow-y-auto">
                    {Object.entries(envState.data.variables)
                      .filter(([k, v]) => !envSearch || k.toLowerCase().includes(envSearch.toLowerCase()) || v.toLowerCase().includes(envSearch.toLowerCase()))
                      .map(([key, value]) => (
                        <div key={key} className="bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 radius-sm">
                          <div className="text-[10px] text-gold font-mono font-bold truncate">{key}</div>
                          <div className="text-[10px] text-text-secondary font-mono truncate">{value}</div>
                        </div>
                      ))}
                    {Object.keys(envState.data.variables).length === 0 && (
                      <div className="text-[10px] text-text-muted py-4 text-center">暂无环境变量</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Modules Tab */}
          {expandedSection === 'modules' && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-1 mb-2">
                <PackageIcon size={12} className="text-steel" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">已加载模块</span>
              </div>
              {modulesState.loading && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <LoadingSpinner size="sm" />
                  <span className="text-xs text-text-muted">正在获取模块列表...</span>
                </div>
              )}
              {modulesState.error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-error/10 border-l-2 border-error radius-sm">
                  <AlertIcon size={12} className="text-error" />
                  <span className="text-[10px] text-error">{modulesState.error}</span>
                  <button
                    className="ml-auto text-[10px] text-text-muted hover:text-text-primary"
                    onClick={() => setModulesState({ data: null, loading: false, error: null, loaded: false })}
                  >
                    <RefreshIcon size={12} />
                  </button>
                </div>
              )}
              {modulesState.loaded && !modulesState.error && modulesState.data && (
                <>
                  {modulesState.data.requiresElevation && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border-l-2 border-warning radius-sm">
                      <AlertIcon size={12} className="text-warning" />
                      <span className="text-[10px] text-warning">需要管理员权限 - 部分模块信息不可用</span>
                    </div>
                  )}
                  <div className="space-y-1 max-h-[240px] overflow-y-auto">
                    {modulesState.data.modules.map((mod, i) => (
                      <div key={i} className="bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 radius-sm">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-text-primary font-mono truncate">{mod.name}</div>
                          {mod.sizeKB > 0 && <div className="text-[10px] text-text-muted ml-2 flex-shrink-0">{mod.sizeKB} KB</div>}
                        </div>
                        {mod.path && <div className="text-[10px] text-text-muted font-mono truncate">{mod.path}</div>}
                      </div>
                    ))}
                    {modulesState.data.modules.length === 0 && (
                      <div className="text-[10px] text-text-muted py-4 text-center">暂无模块信息</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Relationships */}
          <SectionHeader
            title={`关联 (${(relationship?.relatedPorts?.length ?? 0)} 端口 · ${(relationship?.children?.length ?? 0)} 子进程 · ${(relationship?.relatedWindows?.length ?? 0)} 窗口)`}
            icon={<TreeIcon size={14} />}
            isOpen={expandedSection === 'relations'}
            onToggle={() => setActiveTab('relations')}
          />
          {expandedSection === 'relations' && (
            <div className="space-y-2 animate-fade-in">
              {isPartialData && (
                <div className="bg-surface-900 px-3 py-2 border-l-2 border-warning/50 radius-sm">
                  <span className="text-[10px] text-warning">关联信息不可用 - 详细查询超时</span>
                </div>
              )}

              {/* Ports */}
              {(self.ports?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <PortIcon size={12} className="text-gold" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">绑定端口 ({self.ports.length})</span>
                  </div>
                  <div className="space-y-1">
                    {(relationship?.relatedPorts ?? []).filter(p => p.pid === pid).map(port => (
                      <PortRow key={`${port.port}-${port.state}`} port={port} />
                    ))}
                  </div>
                </div>
              )}

              {/* Children */}
              {(relationship?.children?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <TreeIcon size={12} className="text-accent" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">子进程 ({relationship!.children.length})</span>
                  </div>
                  <div className="space-y-1">
                    {relationship!.children.map(child => (
                      <CompactProcessRow key={child.pid} proc={child} />
                    ))}
                  </div>
                </div>
              )}

              {/* Ancestors */}
              {(relationship?.ancestors?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <TreeIcon size={12} className="text-info" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">祖先链 ({relationship!.ancestors.length})</span>
                  </div>
                  <div className="space-y-1">
                    {relationship!.ancestors.map(anc => (
                      <CompactProcessRow key={anc.pid} proc={anc} />
                    ))}
                  </div>
                </div>
              )}

              {/* Siblings */}
              {(relationship?.siblings?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <ProcessIcon size={12} className="text-steel" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">兄弟进程 ({relationship!.siblings.length})</span>
                  </div>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {relationship!.siblings.slice(0, 10).map(sib => (
                      <CompactProcessRow key={sib.pid} proc={sib} />
                    ))}
                    {relationship!.siblings.length > 10 && (
                      <span className="text-[10px] text-text-muted px-3">...还有 {relationship!.siblings.length - 10} 个</span>
                    )}
                  </div>
                </div>
              )}

              {/* Windows */}
              {(relationship?.relatedWindows?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <WindowIcon size={12} className="text-success" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">关联窗口 ({relationship!.relatedWindows.length})</span>
                  </div>
                  <div className="space-y-1">
                    {relationship!.relatedWindows.map(win => (
                      <div key={win.hwnd} className="flex items-center justify-between bg-surface-900 px-3 py-1.5 border-l-2 border-success/30 radius-sm">
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
            {(relationship?.children?.length ?? 0) > 0 && (
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
        message={`确定要终止 "${self.name}" 及其 ${relationship?.children?.length ?? 0} 个子进程吗？`}
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
