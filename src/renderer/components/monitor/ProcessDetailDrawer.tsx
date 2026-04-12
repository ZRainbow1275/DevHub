import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ProcessDeepDetail,
  NetworkConnectionInfo,
  LoadedModuleInfo,
  ProcessTreeNode,
  ProcessPriority,
  isProtectedProcess,
} from '@shared/types-extended'
import {
  CloseIcon,
  TreeIcon,
  FolderIcon,
  CopyIcon,
  EyeIcon,
  ProcessIcon,
  PortIcon,
  AlertIcon,
  SearchIcon,
  RefreshIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GearIcon,
} from '../icons'
import { useToast } from '../ui/Toast'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { LoadingSpinner } from '../ui/LoadingSpinner'

// ============ Constants ============

const PRIORITY_OPTIONS: Array<{ value: ProcessPriority; label: string }> = [
  { value: 'RealTime', label: '实时' },
  { value: 'High', label: '高' },
  { value: 'AboveNormal', label: '高于正常' },
  { value: 'Normal', label: '正常' },
  { value: 'BelowNormal', label: '低于正常' },
  { value: 'Idle', label: '空闲' },
]

const TAB_CONFIG = [
  { key: 'overview', label: '基础' },
  { key: 'resource', label: '资源' },
  { key: 'network', label: '网络' },
  { key: 'env', label: '环境' },
  { key: 'modules', label: '模块' },
] as const

type TabKey = typeof TAB_CONFIG[number]['key']

// Sensitive environment variable name patterns
const SENSITIVE_ENV_PATTERNS = [
  /key/i, /secret/i, /token/i, /password/i, /passwd/i, /credential/i,
  /auth/i, /api[_-]?key/i, /private/i, /access/i, /jwt/i, /bearer/i,
  /connection[_-]?string/i, /database[_-]?url/i, /smtp/i,
]

function isSensitiveEnvVar(name: string): boolean {
  return SENSITIVE_ENV_PATTERNS.some(pattern => pattern.test(name))
}

// ============ Utility Functions ============

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatStartTime(isoString: string): string {
  if (!isoString) return '-'
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '-'
  }
}

function getResourceColor(percent: number): { text: string; bg: string } {
  if (percent > 80) return { text: 'text-error', bg: 'bg-error' }
  if (percent > 50) return { text: 'text-warning', bg: 'bg-warning' }
  if (percent > 25) return { text: 'text-gold', bg: 'bg-gold' }
  return { text: 'text-accent', bg: 'bg-accent' }
}

// ============ CPU Chart Component ============

const CpuChart = memo(function CpuChart({ data }: { data: number[] }) {
  const width = 320
  const height = 60
  const padding = 2

  const { linePath, areaPath, maxVal } = useMemo(() => {
    if (!data || data.length < 2) return { linePath: '', areaPath: '', maxVal: 0 }

    const effectiveWidth = width - padding * 2
    const effectiveHeight = height - padding * 2
    const maxVal = Math.max(...data, 10) // at least 10% scale

    const points = data.map((value, i) => ({
      x: padding + (i / Math.max(data.length - 1, 1)) * effectiveWidth,
      y: padding + effectiveHeight - (value / maxVal) * effectiveHeight,
    }))

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]
    const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${(height - padding).toFixed(1)} L ${firstPoint.x.toFixed(1)} ${(height - padding).toFixed(1)} Z`

    return { linePath, areaPath, maxVal }
  }, [data])

  if (!data || data.length < 2) {
    return (
      <div className="bg-surface-900 px-3 py-2" style={{ borderRadius: '2px' }}>
        <span className="text-[10px] text-text-muted">CPU 数据不足</span>
      </div>
    )
  }

  const currentCpu = data[data.length - 1]
  const isHigh = currentCpu > 80
  const lineColor = isHigh ? 'var(--error)' : 'var(--accent)'

  return (
    <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">CPU 趋势 (60s)</span>
        <span className={`font-mono font-bold text-sm ${getResourceColor(currentCpu).text}`}>
          {currentCpu.toFixed(1)}%
        </span>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Area fill */}
        <path d={areaPath} fill={lineColor} opacity={0.1} className="transition-all duration-500" />
        {/* 80% threshold line */}
        <line
          x1={0}
          y1={padding + (height - padding * 2) - (80 / maxVal) * (height - padding * 2)}
          x2={width}
          y2={padding + (height - padding * 2) - (80 / maxVal) * (height - padding * 2)}
          stroke="var(--error)"
          strokeWidth={0.5}
          strokeDasharray="3 2"
          opacity={0.4}
        />
        {/* Main line */}
        <path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
        />
        {/* Current value dot */}
        <circle
          cx={width - padding}
          cy={padding + (height - padding * 2) - (currentCpu / maxVal) * (height - padding * 2)}
          r={2.5}
          fill={lineColor}
        />
      </svg>
    </div>
  )
})

// ============ Detail Field ============

function DetailField({ label, value, mono = false, copyable = false }: {
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
}) {
  const { showToast } = useToast()

  const handleCopy = async () => {
    if (copyable && value) {
      await navigator.clipboard.writeText(value)
      showToast('success', '已复制')
    }
  }

  return (
    <div
      className={`bg-surface-900 px-3 py-2 border-l-2 border-surface-700 ${copyable ? 'cursor-pointer hover:bg-surface-800' : ''}`}
      style={{ borderRadius: '2px' }}
      onClick={copyable ? handleCopy : undefined}
      title={copyable ? '点击复制' : undefined}
    >
      <span className="text-[10px] text-text-muted uppercase tracking-wider block">{label}</span>
      <span className={`text-sm font-bold text-text-primary break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '-'}
      </span>
    </div>
  )
}

// ============ Connection Row ============

function ConnectionRow({ conn }: { conn: NetworkConnectionInfo }) {
  const stateColor: Record<string, string> = {
    'LISTENING': 'text-success bg-success/10',
    'Listen': 'text-success bg-success/10',
    'ESTABLISHED': 'text-info bg-info/10',
    'Established': 'text-info bg-info/10',
    'CLOSE_WAIT': 'text-warning bg-warning/10',
    'CloseWait': 'text-warning bg-warning/10',
    'TIME_WAIT': 'text-text-muted bg-surface-800',
    'TimeWait': 'text-text-muted bg-surface-800',
  }
  const colorClass = stateColor[conn.state] || 'text-text-muted bg-surface-800'

  return (
    <div className="flex items-center gap-2 bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 text-xs" style={{ borderRadius: '2px' }}>
      <span className="text-[10px] font-mono text-text-muted w-8 flex-shrink-0">{conn.protocol}</span>
      <span className="font-mono text-text-secondary flex-1 truncate" title={`${conn.localAddress}:${conn.localPort}`}>
        {conn.localAddress}:{conn.localPort}
      </span>
      <span className="text-text-muted flex-shrink-0">-&gt;</span>
      <span className="font-mono text-text-secondary flex-1 truncate" title={`${conn.remoteAddress}:${conn.remotePort}`}>
        {conn.remoteAddress}:{conn.remotePort}
      </span>
      <span className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 ${colorClass}`} style={{ borderRadius: '2px' }}>
        {conn.state}
      </span>
    </div>
  )
}

// ============ Tree Node ============

function TreeNodeRow({ node, depth = 0, isTarget = false }: {
  node: ProcessTreeNode
  depth?: number
  isTarget?: boolean
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-1 ${isTarget ? 'bg-accent/10 border-l-2 border-accent' : 'bg-surface-900 border-l-2 border-surface-600'}`}
        style={{ paddingLeft: `${12 + depth * 16}px`, borderRadius: '2px' }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="flex-shrink-0 text-text-muted hover:text-text-primary">
            {expanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="text-xs font-mono text-text-muted bg-surface-800 px-1.5 py-0.5" style={{ borderRadius: '2px' }}>
          {node.pid}
        </span>
        <span className={`text-xs truncate ${isTarget ? 'text-accent font-bold' : 'text-text-primary'}`}>
          {node.name}
        </span>
        <span className="text-[10px] font-mono text-text-muted ml-auto flex-shrink-0">
          {node.cpuPercent.toFixed(1)}% / {node.memoryMB}MB
        </span>
      </div>
      {expanded && hasChildren && (
        <div className="animate-fade-in">
          {node.children!.map(child => (
            <TreeNodeRow key={child.pid} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============ Environment Variable Row ============

function EnvVarRow({ name, value }: { name: string; value: string }) {
  const { showToast } = useToast()
  const sensitive = isSensitiveEnvVar(name)
  const [revealed, setRevealed] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${name}=${value}`)
    showToast('success', '已复制')
  }

  const displayValue = (sensitive && !revealed) ? '********' : value

  return (
    <div
      className="flex items-start gap-2 bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 hover:bg-surface-800"
      style={{ borderRadius: '2px' }}
    >
      <span className="text-xs font-mono font-bold text-accent flex-shrink-0 min-w-[120px] max-w-[200px] truncate" title={name}>
        {name}
      </span>
      <span className="text-xs font-mono text-text-secondary break-all flex-1">{displayValue}</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        {sensitive && (
          <button
            onClick={() => setRevealed(!revealed)}
            className="text-text-muted hover:text-text-primary transition-colors"
            title={revealed ? '隐藏值' : '显示值'}
          >
            <EyeIcon size={12} />
          </button>
        )}
        <button
          onClick={handleCopy}
          className="text-text-muted hover:text-text-primary transition-colors"
          title="复制"
        >
          <CopyIcon size={12} />
        </button>
      </div>
    </div>
  )
}

// ============ Main ProcessDetailDrawer ============

interface ProcessDetailDrawerProps {
  pid: number
  onClose: () => void
  fetchDeepDetail: (pid: number) => Promise<ProcessDeepDetail | null>
  fetchConnections: (pid: number) => Promise<NetworkConnectionInfo[]>
  fetchEnvironment: (pid: number) => Promise<{ variables: Record<string, string>; requiresElevation: boolean }>
  fetchHistory: (pid: number) => Promise<{ cpuHistory: number[]; memoryHistory: number[] }>
  fetchModules: (pid: number) => Promise<{ modules: LoadedModuleInfo[]; requiresElevation: boolean }>
  onKillProcess: (pid: number) => Promise<boolean>
  onKillTree: (pid: number) => Promise<boolean>
  onSetPriority: (pid: number, priority: string) => Promise<boolean>
  onOpenFileLocation: (filePath: string) => Promise<void>
}

export const ProcessDetailDrawer = memo(function ProcessDetailDrawer({
  pid,
  onClose,
  fetchDeepDetail,
  fetchConnections,
  fetchEnvironment,
  fetchHistory,
  fetchModules,
  onKillProcess,
  onKillTree,
  onSetPriority,
  onOpenFileLocation,
}: ProcessDetailDrawerProps) {
  const { showToast } = useToast()

  // State
  const [detail, setDetail] = useState<ProcessDeepDetail | null>(null)
  const [connections, setConnections] = useState<NetworkConnectionInfo[]>([])
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [envRequiresElevation, setEnvRequiresElevation] = useState(false)
  const [modules, setModules] = useState<LoadedModuleInfo[]>([])
  const [modulesRequiresElevation, setModulesRequiresElevation] = useState(false)
  const [moduleSearch, setModuleSearch] = useState('')
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [showKillTreeConfirm, setShowKillTreeConfirm] = useState(false)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [envSearch, setEnvSearch] = useState('')
  const [drawerWidth, setDrawerWidth] = useState(480)
  const [isDragging, setIsDragging] = useState(false)

  const drawerRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Load initial data
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const loadData = async () => {
      const [detailData, histData] = await Promise.all([
        fetchDeepDetail(pid),
        fetchHistory(pid),
      ])
      if (cancelled) return
      setDetail(detailData)
      setCpuHistory(detailData?.cpuHistory || histData.cpuHistory || [])
      setIsLoading(false)
    }

    loadData().catch(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [pid, fetchDeepDetail, fetchHistory])

  // Load connections when network tab is opened
  useEffect(() => {
    if (activeTab !== 'network') return
    let cancelled = false

    fetchConnections(pid).then(conns => {
      if (!cancelled) setConnections(conns)
    })

    return () => { cancelled = true }
  }, [activeTab, pid, fetchConnections])

  // Load environment when env tab is opened
  useEffect(() => {
    if (activeTab !== 'env') return
    let cancelled = false

    fetchEnvironment(pid).then(result => {
      if (!cancelled) {
        setEnvVars(result.variables)
        setEnvRequiresElevation(result.requiresElevation)
      }
    })

    return () => { cancelled = true }
  }, [activeTab, pid, fetchEnvironment])

  // Load modules when modules tab is opened
  useEffect(() => {
    if (activeTab !== 'modules') return
    let cancelled = false

    fetchModules(pid).then(result => {
      if (!cancelled) {
        setModules(result.modules)
        setModulesRequiresElevation(result.requiresElevation)
      }
    })

    return () => { cancelled = true }
  }, [activeTab, pid, fetchModules])

  // Refresh CPU history periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const hist = await fetchHistory(pid)
        setCpuHistory(hist.cpuHistory)
      } catch {
        // Process may have been terminated — ignore
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [pid, fetchHistory])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Drag resize handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartWidth.current = drawerWidth
  }, [drawerWidth])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX
      const newWidth = Math.max(360, Math.min(800, dragStartWidth.current + delta))
      setDrawerWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Actions
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
    const success = await onKillTree(pid)
    if (success) {
      showToast('success', '进程树已终止')
      onClose()
    } else {
      showToast('error', '终止进程树失败')
    }
  }, [pid, onKillTree, showToast, onClose])

  const handleSetPriority = useCallback(async (priority: ProcessPriority) => {
    setShowPriorityMenu(false)
    const success = await onSetPriority(pid, priority)
    if (success) {
      showToast('success', `优先级已设置为 ${priority}`)
    } else {
      showToast('error', '设置优先级失败')
    }
  }, [pid, onSetPriority, showToast])

  const handleOpenFile = useCallback(async () => {
    if (detail?.executablePath) {
      await onOpenFileLocation(detail.executablePath)
    } else {
      showToast('warning', '无法获取可执行文件路径')
    }
  }, [detail, onOpenFileLocation, showToast])

  const handleCopyCommand = useCallback(async () => {
    if (detail?.commandLine) {
      await navigator.clipboard.writeText(detail.commandLine)
      showToast('success', '命令已复制到剪贴板')
    }
  }, [detail, showToast])

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [detailData, histData] = await Promise.all([
        fetchDeepDetail(pid),
        fetchHistory(pid),
      ])
      setDetail(detailData)
      setCpuHistory(detailData?.cpuHistory || histData.cpuHistory || [])

      if (activeTab === 'network') {
        const conns = await fetchConnections(pid)
        setConnections(conns)
      }
      if (activeTab === 'env') {
        const result = await fetchEnvironment(pid)
        setEnvVars(result.variables)
        setEnvRequiresElevation(result.requiresElevation)
      }
      if (activeTab === 'modules') {
        const result = await fetchModules(pid)
        setModules(result.modules)
        setModulesRequiresElevation(result.requiresElevation)
      }
    } finally {
      setIsLoading(false)
    }
  }, [pid, activeTab, fetchDeepDetail, fetchHistory, fetchConnections, fetchEnvironment, fetchModules])

  // Filtered environment variables
  const filteredEnvVars = useMemo(() => {
    const entries = Object.entries(envVars)
    if (!envSearch) return entries
    const lower = envSearch.toLowerCase()
    return entries.filter(([k, v]) =>
      k.toLowerCase().includes(lower) || v.toLowerCase().includes(lower)
    )
  }, [envVars, envSearch])

  // Filtered modules
  const filteredModules = useMemo(() => {
    if (!moduleSearch) return modules
    const lower = moduleSearch.toLowerCase()
    return modules.filter(m =>
      m.name.toLowerCase().includes(lower) || m.path.toLowerCase().includes(lower)
    )
  }, [modules, moduleSearch])

  // Check if process is protected (for UI-level kill prevention)
  const isProcessProtected = useMemo(() => {
    if (!detail?.name) return false
    return isProtectedProcess(detail.name) || pid < 100
  }, [detail, pid])

  // Count children recursively
  const countChildren = (nodes: ProcessTreeNode[]): number => {
    let count = nodes.length
    for (const n of nodes) {
      if (n.children) count += countChildren(n.children)
    }
    return count
  }

  const totalChildren = detail?.children ? countChildren(detail.children) : 0

  // Connection stats
  const connectionStats = useMemo(() => {
    const listening = connections.filter(c => c.state === 'Listen' || c.state === 'LISTENING').length
    const established = connections.filter(c => c.state === 'Established' || c.state === 'ESTABLISHED').length
    const other = connections.length - listening - established
    return { listening, established, other, total: connections.length }
  }, [connections])

  return (
    <>
      {/* Overlay backdrop — click to close */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full z-50 bg-surface-900 border-l-2 border-surface-600 flex flex-col animate-slide-in-right shadow-elevated"
        style={{ width: `${drawerWidth}px` }}
      >
        {/* Drag handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/30 transition-colors z-10"
          onMouseDown={handleDragStart}
        />

        {/* Diagonal decoration */}
        <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-surface-700 relative z-10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <ProcessIcon size={16} className="text-accent flex-shrink-0" />
            <div className="min-w-0">
              <h4
                className="text-sm font-bold text-text-primary uppercase tracking-wider truncate"
                style={{ fontFamily: 'var(--font-display)' }}
                title={detail?.name}
              >
                {detail?.name || `PID ${pid}`}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted font-mono">PID: {pid}</span>
                {detail?.scriptPath && (
                  <span className="text-[10px] text-accent font-mono truncate" title={detail.scriptPath}>
                    {detail.scriptPath}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleRefresh}
              className="btn-icon-sm text-text-muted hover:text-text-primary"
              title="刷新"
            >
              <RefreshIcon size={14} />
            </button>
            <button onClick={onClose} className="btn-icon-sm text-text-muted hover:text-text-primary">
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-700 px-4 flex-shrink-0 relative z-10">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.key
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
              {tab.key === 'network' && connectionStats.total > 0 && (
                <span className="ml-1 text-[10px] text-text-muted">({connectionStats.total})</span>
              )}
              {tab.key === 'modules' && modules.length > 0 && (
                <span className="ml-1 text-[10px] text-text-muted">({modules.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto relative z-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="sm" className="mr-2" />
              <span className="text-text-muted text-sm">加载进程详情...</span>
            </div>
          ) : !detail ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <AlertIcon size={24} className="text-error" />
              <span className="text-text-muted text-sm">无法获取进程信息 (PID: {pid})</span>
              {detail === null && (
                <span className="text-[10px] text-text-muted">进程可能已终止或需要管理员权限</span>
              )}
            </div>
          ) : detail.requiresElevation ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <AlertIcon size={24} className="text-warning" />
              <span className="text-text-muted text-sm">需要管理员权限</span>
              <span className="text-[10px] text-text-muted">以管理员身份运行 DevHub 以查看此进程的详情</span>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Overview Tab — Basic Info */}
              {activeTab === 'overview' && (
                <div className="space-y-3 animate-fade-in">
                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="PID" value={String(detail.pid)} mono />
                    <DetailField label="PPID" value={detail.ancestorChain.length > 0 ? String(detail.ancestorChain[detail.ancestorChain.length - 1].pid) : '-'} mono />
                    <DetailField label="用户" value={detail.userName} />
                    <DetailField label="启动时间" value={formatStartTime(detail.startTime)} />
                    {detail.scriptPath && (
                      <DetailField label="脚本路径" value={detail.scriptPath} mono copyable />
                    )}
                  </div>

                  {/* Executable Path */}
                  {detail.executablePath && (
                    <DetailField label="可执行文件路径" value={detail.executablePath} mono copyable />
                  )}

                  {/* Command Line */}
                  {detail.commandLine && (
                    <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">完整命令</span>
                        <button
                          onClick={handleCopyCommand}
                          className="text-text-muted hover:text-text-primary"
                          title="复制命令"
                        >
                          <CopyIcon size={12} />
                        </button>
                      </div>
                      <p className="text-xs text-text-secondary font-mono break-all">$ {detail.commandLine}</p>
                    </div>
                  )}

                  {/* Working Directory */}
                  {detail.workingDirectory && (
                    <DetailField label="工作目录" value={detail.workingDirectory} mono copyable />
                  )}

                  {/* Quick stats links to other tabs */}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {detail.networkConnections.length > 0 && (
                      <button onClick={() => setActiveTab('network')} className="flex items-center gap-1.5 bg-surface-800 px-2 py-1 hover:bg-surface-700 transition-colors" style={{ borderRadius: '2px' }}>
                        <PortIcon size={12} className="text-gold" />
                        <span className="text-text-muted">{detail.networkConnections.length} 个网络连接</span>
                      </button>
                    )}
                    {detail.relatedProcesses.length > 0 && (
                      <button onClick={() => setActiveTab('network')} className="flex items-center gap-1.5 bg-surface-800 px-2 py-1 hover:bg-surface-700 transition-colors" style={{ borderRadius: '2px' }}>
                        <ProcessIcon size={12} className="text-steel" />
                        <span className="text-text-muted">{detail.relatedProcesses.length} 个关联进程</span>
                      </button>
                    )}
                    {totalChildren > 0 && (
                      <span className="flex items-center gap-1.5 bg-surface-800 px-2 py-1" style={{ borderRadius: '2px' }}>
                        <TreeIcon size={12} className="text-accent" />
                        <span className="text-text-muted">{totalChildren} 个子进程</span>
                      </span>
                    )}
                  </div>

                  {/* Process Tree (inline collapsible) */}
                  {(detail.ancestorChain.length > 0 || detail.children.length > 0) && (
                    <div className="border-t border-surface-700 pt-3">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-2">
                        <TreeIcon size={12} className="inline mr-1 text-info" />
                        进程树
                      </span>
                      {/* Ancestor Chain */}
                      {detail.ancestorChain.length > 0 && (
                        <div className="space-y-0.5 mb-1">
                          {detail.ancestorChain.map((anc, i) => (
                            <div
                              key={anc.pid}
                              className="flex items-center gap-2 bg-surface-900 px-3 py-1 border-l-2 border-info/30"
                              style={{ paddingLeft: `${12 + i * 12}px`, borderRadius: '2px' }}
                            >
                              <span className="text-[10px] text-text-muted">{'>'}</span>
                              <span className="text-xs font-mono text-text-muted">{anc.pid}</span>
                              <span className="text-xs text-text-secondary truncate">{anc.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Current process */}
                      <div
                        className="flex items-center gap-2 bg-accent/10 px-3 py-1 border-l-2 border-accent mb-1"
                        style={{ paddingLeft: `${12 + detail.ancestorChain.length * 12}px`, borderRadius: '2px' }}
                      >
                        <span className="text-[10px] text-accent font-bold">*</span>
                        <span className="text-xs font-mono text-accent">{detail.pid}</span>
                        <span className="text-xs text-accent font-bold truncate">{detail.name}</span>
                      </div>
                      {/* Children */}
                      {detail.children.length > 0 && (
                        <div className="space-y-0.5">
                          {detail.children.map(child => (
                            <TreeNodeRow key={child.pid} node={child} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Resource Tab — CPU/Memory/IO */}
              {activeTab === 'resource' && (
                <div className="space-y-3 animate-fade-in">
                  {/* CPU Chart */}
                  <CpuChart data={cpuHistory} />

                  {/* Memory Usage */}
                  <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600" style={{ borderRadius: '2px' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider">内存使用</span>
                      <span className="font-mono font-bold text-sm text-info">{detail.memoryRSS} MB</span>
                    </div>
                    <div className="h-2 bg-surface-800" style={{ borderRadius: '1px' }}>
                      <div
                        className="h-full transition-all duration-500 bg-info"
                        style={{ width: `${Math.min((detail.memoryRSS / Math.max(detail.memoryRSS, 500)) * 100, 100)}%`, borderRadius: '1px' }}
                      />
                    </div>
                  </div>

                  {/* Resource Details Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="内存 (RSS)" value={`${detail.memoryRSS} MB`} mono />
                    <DetailField label="内存 (VMS)" value={`${detail.memoryVMS} MB`} mono />
                    <DetailField label="线程数" value={String(detail.threadCount)} mono />
                    <DetailField label="句柄数" value={String(detail.handleCount)} mono />
                    <DetailField label="IO 读取" value={formatBytes(detail.ioReadBytes)} mono />
                    <DetailField label="IO 写入" value={formatBytes(detail.ioWriteBytes)} mono />
                  </div>
                </div>
              )}

              {/* Network Tab */}
              {activeTab === 'network' && (
                <div className="space-y-3 animate-fade-in">
                  {/* Connection Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-surface-900 px-3 py-2 border-l-2 border-success" style={{ borderRadius: '2px' }}>
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block">监听</span>
                      <span className="text-sm font-bold font-mono text-success">{connectionStats.listening}</span>
                    </div>
                    <div className="bg-surface-900 px-3 py-2 border-l-2 border-info" style={{ borderRadius: '2px' }}>
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block">已连接</span>
                      <span className="text-sm font-bold font-mono text-info">{connectionStats.established}</span>
                    </div>
                    <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-500" style={{ borderRadius: '2px' }}>
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block">其他</span>
                      <span className="text-sm font-bold font-mono text-text-muted">{connectionStats.other}</span>
                    </div>
                  </div>

                  {/* Connection List */}
                  {connections.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
                        连接列表 ({connections.length})
                      </span>
                      {connections.map((conn, i) => (
                        <ConnectionRow key={`${conn.protocol}-${conn.localPort}-${conn.remotePort}-${i}`} conn={conn} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <PortIcon size={24} className="text-text-muted mb-2" />
                      <span className="text-text-muted text-sm">没有网络连接</span>
                    </div>
                  )}

                  {/* Related processes */}
                  {detail.relatedProcesses.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
                        关联进程 ({detail.relatedProcesses.length})
                      </span>
                      {detail.relatedProcesses.map(rp => (
                        <div
                          key={rp.pid}
                          className="flex items-center justify-between bg-surface-900 px-3 py-1.5 border-l-2 border-steel/30"
                          style={{ borderRadius: '2px' }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-text-muted">{rp.pid}</span>
                            <span className="text-xs text-text-primary">{rp.name}</span>
                          </div>
                          <span className="text-[10px] text-text-muted">{rp.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Environment Tab */}
              {activeTab === 'env' && (
                <div className="space-y-3 animate-fade-in">
                  {envRequiresElevation && (
                    <div className="flex items-center gap-2 bg-warning/10 px-3 py-2 border-l-2 border-warning" style={{ borderRadius: '2px' }}>
                      <AlertIcon size={14} className="text-warning flex-shrink-0" />
                      <span className="text-xs text-warning">需要管理员权限才能查看该进程的环境变量，显示的是当前用户环境变量</span>
                    </div>
                  )}

                  {/* Search */}
                  <div className="relative">
                    <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      placeholder="搜索环境变量..."
                      value={envSearch}
                      onChange={(e) => setEnvSearch(e.target.value)}
                      className="w-full bg-surface-800 border border-surface-600 px-9 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                      style={{ borderRadius: '2px' }}
                    />
                    {envSearch && (
                      <button
                        onClick={() => setEnvSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                      >
                        <CloseIcon size={12} />
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] text-text-muted block">
                    {filteredEnvVars.length} / {Object.keys(envVars).length} 个变量
                  </span>

                  {/* Variables List */}
                  <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                    {filteredEnvVars.map(([key, value]) => (
                      <EnvVarRow key={key} name={key} value={value} />
                    ))}
                    {filteredEnvVars.length === 0 && Object.keys(envVars).length > 0 && (
                      <span className="text-text-muted text-xs block py-4 text-center">没有匹配的环境变量</span>
                    )}
                    {Object.keys(envVars).length === 0 && !envRequiresElevation && (
                      <span className="text-text-muted text-xs block py-4 text-center">无法读取环境变量</span>
                    )}
                  </div>
                </div>
              )}

              {/* Modules/DLL Tab */}
              {activeTab === 'modules' && (
                <div className="space-y-3 animate-fade-in">
                  {modulesRequiresElevation && (
                    <div className="flex items-center gap-2 bg-warning/10 px-3 py-2 border-l-2 border-warning" style={{ borderRadius: '2px' }}>
                      <AlertIcon size={14} className="text-warning flex-shrink-0" />
                      <span className="text-xs text-warning">需要管理员权限才能查看该进程的已加载模块</span>
                    </div>
                  )}

                  {/* Search */}
                  <div className="relative">
                    <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      placeholder="搜索模块..."
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                      className="w-full bg-surface-800 border border-surface-600 px-9 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                      style={{ borderRadius: '2px' }}
                    />
                    {moduleSearch && (
                      <button
                        onClick={() => setModuleSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                      >
                        <CloseIcon size={12} />
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] text-text-muted block">
                    {filteredModules.length} / {modules.length} 个模块
                  </span>

                  {/* Module List */}
                  <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                    {filteredModules.map((mod) => (
                      <div
                        key={mod.path || mod.name}
                        className="flex items-center gap-2 bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 hover:bg-surface-800"
                        style={{ borderRadius: '2px' }}
                        title={mod.path}
                      >
                        <GearIcon size={12} className="text-text-muted flex-shrink-0" />
                        <span className="text-xs font-mono font-bold text-text-primary truncate flex-1" title={mod.name}>
                          {mod.name}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted flex-shrink-0">
                          {mod.sizeKB > 0 ? `${mod.sizeKB} KB` : '-'}
                        </span>
                      </div>
                    ))}
                    {filteredModules.length === 0 && modules.length > 0 && (
                      <span className="text-text-muted text-xs block py-4 text-center">没有匹配的模块</span>
                    )}
                    {modules.length === 0 && !modulesRequiresElevation && (
                      <div className="flex flex-col items-center justify-center py-8">
                        <GearIcon size={24} className="text-text-muted mb-2" />
                        <span className="text-text-muted text-sm">没有已加载模块信息</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Action Buttons */}
        {detail && !detail.requiresElevation && (
          <div className="flex items-center gap-2 px-4 py-3 border-t-2 border-surface-700 relative z-10 flex-shrink-0 flex-wrap">
            {isProcessProtected ? (
              <div className="flex items-center gap-2 bg-warning/10 px-3 py-1.5 border-l-2 border-warning" style={{ borderRadius: '2px' }}>
                <AlertIcon size={12} className="text-warning flex-shrink-0" />
                <span className="text-xs text-warning">系统关键进程，已禁止操作</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowKillConfirm(true)}
                  className="btn-danger flex items-center gap-1.5 text-xs px-3 py-1.5"
                >
                  <CloseIcon size={12} />
                  结束进程
                </button>
            {totalChildren > 0 && (
              <button
                onClick={() => setShowKillTreeConfirm(true)}
                className="btn-danger flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <TreeIcon size={12} />
                结束进程树
              </button>
            )}
            <button
              onClick={handleOpenFile}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
              disabled={!detail.executablePath}
            >
              <FolderIcon size={12} />
              文件位置
            </button>
            <div className="relative">
              <button
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <EyeIcon size={12} />
                优先级
                <ChevronDownIcon size={10} />
              </button>
              {showPriorityMenu && (
                <div className="absolute bottom-full left-0 mb-1 bg-surface-800 border border-surface-600 py-1 z-20 min-w-[120px]" style={{ borderRadius: '2px' }}>
                  {PRIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleSetPriority(opt.value)}
                      className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-700 hover:text-text-primary"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={showKillConfirm}
        title="终止进程"
        message={`确定要终止进程 "${detail?.name}" (PID: ${pid}) 吗？`}
        confirmText="终止"
        variant="danger"
        onConfirm={handleKill}
        onCancel={() => setShowKillConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showKillTreeConfirm}
        title="终止进程树"
        message={`确定要终止 "${detail?.name}" 及其 ${totalChildren} 个子进程吗？此操作不可撤销。`}
        confirmText="终止全部"
        variant="danger"
        onConfirm={handleKillTree}
        onCancel={() => setShowKillTreeConfirm(false)}
      />

      {/* CSS for slide-in animation */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  )
})
