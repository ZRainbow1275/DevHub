import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ProcessDeepDetail,
  ProcessInfo,
  AccessReport,
  NetworkConnectionInfo,
  LoadedModuleInfo,
  LegacyProcessTreeNode,
  ProcessPriority,
  isProtectedProcess,
} from '@shared/types-extended'
import type { ProcessHistory } from '@shared/schemas/r8-runtime'
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
import { PROCESS_VM_FIELD_LIST } from './process-vm-contract'
import { ProcessSparkline, type ProcessSparklineMetric } from './process/ProcessSparkline'

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

type ProcessHistoryIdentity = Pick<ProcessInfo, 'name' | 'workingDir'>

const PROCESS_HISTORY_METRIC_OPTIONS: Array<{
  key: ProcessSparklineMetric
  label: string
  color: string
}> = [
  { key: 'cpu', label: 'CPU', color: 'var(--accent)' },
  { key: 'rssMb', label: 'RSS', color: 'var(--info)' },
  { key: 'handles', label: '句柄', color: 'var(--warning)' },
  { key: 'threads', label: '线程', color: 'var(--success)' },
]

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

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return '-'
  try {
    const date = new Date(timestamp)
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
      <div className="bg-surface-900 px-3 py-2 radius-sm">
        <span className="text-[10px] text-text-muted">CPU 数据不足</span>
      </div>
    )
  }

  const currentCpu = data[data.length - 1]
  const isHigh = currentCpu > 80
  const lineColor = isHigh ? 'var(--error)' : 'var(--accent)'

  return (
    <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600 radius-sm">
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

function DetailField({ label, value, mono = false, copyable = false, testId }: {
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
  testId?: string
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
      data-testid={testId}
      className={`bg-surface-900 px-3 py-2 border-l-2 border-surface-700 ${copyable ? 'cursor-pointer hover:bg-surface-800' : ''} radius-sm`}
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

function PermissionNotice({
  report,
  onRetry,
  onRelaunch,
  isRelaunching
}: {
  report: AccessReport
  onRetry: () => void
  onRelaunch?: () => void
  isRelaunching?: boolean
}) {
  const isNotFound = report.scanResult === 'not-found'
  const title = isNotFound ? '目标进程已退出或暂时不可访问' : '完整信息需要更高权限'
  const description = isNotFound
    ? '当前仅保留已捕获的基础信息，你可以重试刷新确认最新状态。'
    : report.suggestion === 'relaunch-as-admin'
      ? 'DevHub 当前不是管理员权限。已保留基础信息，重启为管理员后可继续读取完整详情。'
      : '已保留基础信息，你可以先重试；如果仍失败，再以管理员身份重启 DevHub。'

  return (
    <div
      data-testid="permission-notice"
      className={`mx-4 mt-4 flex flex-col gap-3 border-l-2 px-3 py-3 radius-sm ${
        isNotFound ? 'bg-info/10 border-info' : 'bg-warning/10 border-warning'
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertIcon size={14} className={isNotFound ? 'text-info mt-0.5 flex-shrink-0' : 'text-warning mt-0.5 flex-shrink-0'} />
        <div className="min-w-0">
          <div className={`text-xs font-bold ${isNotFound ? 'text-info' : 'text-warning'}`}>{title}</div>
          <div className="mt-1 text-[11px] text-text-secondary leading-5">
            {description}
          </div>
          <div className="mt-2 text-[10px] text-text-muted">
            当前用户: {report.currentUser || 'unknown'}
            {report.targetProcessUser ? ` | 目标用户: ${report.targetProcessUser}` : ''}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onRetry} className="btn-secondary text-xs px-3 py-1.5">
          重试
        </button>
        {onRelaunch && report.suggestion === 'relaunch-as-admin' && (
          <button
            onClick={onRelaunch}
            className="btn-secondary text-xs px-3 py-1.5"
            disabled={isRelaunching}
          >
            {isRelaunching ? '正在请求提权...' : '以管理员身份重启'}
          </button>
        )}
      </div>
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
    <div className="flex items-center gap-2 bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 text-xs radius-sm">
      <span className="text-[10px] font-mono text-text-muted w-8 flex-shrink-0">{conn.protocol}</span>
      <span className="font-mono text-text-secondary flex-1 truncate" title={`${conn.localAddress}:${conn.localPort}`}>
        {conn.localAddress}:{conn.localPort}
      </span>
      <span className="text-text-muted flex-shrink-0">-&gt;</span>
      <span className="font-mono text-text-secondary flex-1 truncate" title={`${conn.remoteAddress}:${conn.remotePort}`}>
        {conn.remoteAddress}:{conn.remotePort}
      </span>
      <span className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 ${colorClass} radius-sm`}>
        {conn.state}
      </span>
    </div>
  )
}

// ============ Tree Node ============

function TreeNodeRow({ node, depth = 0, isTarget = false }: {
  node: LegacyProcessTreeNode
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
        <span className="text-xs font-mono text-text-muted bg-surface-800 px-1.5 py-0.5 radius-sm">
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
      className="flex items-start gap-2 bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 hover:bg-surface-800 radius-sm"
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
  basicProcessInfo?: ProcessInfo | null
  onClose: () => void
  fetchDeepDetail: (pid: number) => Promise<ProcessDeepDetail | null>
  probeAccess: (pid: number) => Promise<AccessReport>
  fetchConnections: (pid: number) => Promise<NetworkConnectionInfo[]>
  fetchEnvironment: (pid: number) => Promise<{ variables: Record<string, string>; requiresElevation: boolean }>
  fetchHistory: (pid: number) => Promise<{ cpuHistory: number[]; memoryHistory: number[] }>
  fetchHistory24h: (process: ProcessHistoryIdentity) => Promise<ProcessHistory>
  fetchModules: (pid: number) => Promise<{ modules: LoadedModuleInfo[]; requiresElevation: boolean }>
  onRelaunchAsAdmin: () => Promise<{ ok: boolean; reason?: string }>
  onKillProcess: (pid: number) => Promise<boolean>
  onKillTree: (pid: number) => Promise<boolean>
  onSetPriority: (pid: number, priority: string) => Promise<boolean>
  onOpenFileLocation: (filePath: string) => Promise<void>
}

export const ProcessDetailDrawer = memo(function ProcessDetailDrawer({
  pid,
  basicProcessInfo,
  onClose,
  fetchDeepDetail,
  probeAccess,
  fetchConnections,
  fetchEnvironment,
  fetchHistory,
  fetchHistory24h,
  fetchModules,
  onRelaunchAsAdmin,
  onKillProcess,
  onKillTree,
  onSetPriority,
  onOpenFileLocation,
}: ProcessDetailDrawerProps) {
  const { showToast } = useToast()

  // State
  const [detail, setDetail] = useState<ProcessDeepDetail | null>(null)
  const [basicInfo, setBasicInfo] = useState<ProcessInfo | null>(basicProcessInfo ?? null)
  const [accessReport, setAccessReport] = useState<AccessReport | null>(null)
  const [connections, setConnections] = useState<NetworkConnectionInfo[]>([])
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [envRequiresElevation, setEnvRequiresElevation] = useState(false)
  const [modules, setModules] = useState<LoadedModuleInfo[]>([])
  const [modulesRequiresElevation, setModulesRequiresElevation] = useState(false)
  const [moduleSearch, setModuleSearch] = useState('')
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [history24h, setHistory24h] = useState<ProcessHistory | null>(null)
  const [history24hLoading, setHistory24hLoading] = useState(false)
  const [history24hError, setHistory24hError] = useState<string | null>(null)
  const [historyMetric, setHistoryMetric] = useState<ProcessSparklineMetric>('cpu')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [showKillTreeConfirm, setShowKillTreeConfirm] = useState(false)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [envSearch, setEnvSearch] = useState('')
  const [drawerWidth, setDrawerWidth] = useState(480)
  const [isDragging, setIsDragging] = useState(false)
  const [isRelaunching, setIsRelaunching] = useState(false)
  const [connSortCol, setConnSortCol] = useState<'protocol' | 'localPort' | 'remotePort' | 'state' | null>(null)
  const [connSortAsc, setConnSortAsc] = useState(true)

  const drawerRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  useEffect(() => {
    setBasicInfo(basicProcessInfo ?? null)
  }, [basicProcessInfo])

  const processHistoryIdentity = useMemo<ProcessHistoryIdentity | null>(() => {
    const name = detail?.name || basicInfo?.name
    if (!name) return null
    const workingDir = detail?.workingDirectory || basicInfo?.workingDir
    return {
      name,
      workingDir: workingDir || undefined,
    }
  }, [basicInfo?.name, basicInfo?.workingDir, detail?.name, detail?.workingDirectory])

  const processHistoryName = processHistoryIdentity?.name
  const processHistoryWorkingDir = processHistoryIdentity?.workingDir

  const history24hPointCount = history24h?.points.length ?? 0
  const history24hGapCount = history24h?.points.filter(point => point.missing).length ?? 0
  const selectedHistoryMetric = PROCESS_HISTORY_METRIC_OPTIONS.find(option => option.key === historyMetric) ?? PROCESS_HISTORY_METRIC_OPTIONS[0]

  const loadAccessReport = useCallback(async () => {
    const report = await probeAccess(pid)
    setAccessReport(report)
    return report
  }, [pid, probeAccess])

  // Load initial data
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setAccessReport(null)

    const loadData = async () => {
      const [detailData, histData] = await Promise.all([
        fetchDeepDetail(pid),
        fetchHistory(pid),
      ])
      if (cancelled) return
      setDetail(detailData)
      setCpuHistory(detailData?.cpuHistory || histData.cpuHistory || [])
      if (detailData?.requiresElevation || !detailData) {
        try {
          const report = await probeAccess(pid)
          if (!cancelled) {
            setAccessReport(report)
          }
        } catch {
          if (!cancelled) {
            setAccessReport(null)
          }
        }
      }
      setIsLoading(false)
    }

    loadData().catch(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [pid, fetchDeepDetail, fetchHistory, probeAccess])

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

  useEffect(() => {
    if (activeTab !== 'resource') return
    let cancelled = false

    const loadHistory24h = async (silent: boolean) => {
      if (!processHistoryName) {
        if (!cancelled) {
          setHistory24h(null)
          setHistory24hError('缺少进程身份，无法查询 24h 趋势')
        }
        return
      }

      if (!silent) setHistory24hLoading(true)
      setHistory24hError(null)
      try {
        const nextHistory = await fetchHistory24h({
          name: processHistoryName,
          workingDir: processHistoryWorkingDir,
        })
        if (!cancelled) {
          setHistory24h(nextHistory)
        }
      } catch (error) {
        if (!cancelled) {
          setHistory24h(null)
          setHistory24hError(error instanceof Error ? error.message : '24h 趋势加载失败')
        }
      } finally {
        if (!cancelled && !silent) {
          setHistory24hLoading(false)
        }
      }
    }

    loadHistory24h(false).catch(() => undefined)
    const interval = setInterval(() => {
      loadHistory24h(true).catch(() => undefined)
    }, 60000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [activeTab, fetchHistory24h, processHistoryName, processHistoryWorkingDir])

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
    const commandLine = detail?.commandLine ?? basicInfo?.command
    if (commandLine) {
      await navigator.clipboard.writeText(commandLine)
      showToast('success', '命令已复制到剪贴板')
    }
  }, [basicInfo, detail, showToast])

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    setAccessReport(null)
    try {
      const [detailData, histData] = await Promise.all([
        fetchDeepDetail(pid),
        fetchHistory(pid),
      ])
      setDetail(detailData)
      setCpuHistory(detailData?.cpuHistory || histData.cpuHistory || [])

      if (detailData?.requiresElevation || !detailData) {
        try {
          await loadAccessReport()
        } catch {
          setAccessReport(null)
        }
      }

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
  }, [pid, activeTab, fetchDeepDetail, fetchHistory, fetchConnections, fetchEnvironment, fetchModules, loadAccessReport])

  const handleRelaunchAsAdmin = useCallback(async () => {
    setIsRelaunching(true)
    try {
      const result = await onRelaunchAsAdmin()
      if (result.ok) {
        showToast('info', '已请求以管理员身份重启，请在新窗口中继续查看详情')
        return
      }

      if (result.reason === 'user-cancelled') {
        showToast('warning', '已取消管理员重启')
        return
      }

      showToast('error', result.reason ? `管理员重启失败: ${result.reason}` : '管理员重启失败')
    } finally {
      setIsRelaunching(false)
    }
  }, [onRelaunchAsAdmin, showToast])

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
    const candidateName = detail?.name ?? basicInfo?.name
    if (!candidateName) return false
    return isProtectedProcess(candidateName) || pid < 100
  }, [basicInfo, detail, pid])

  // Count children recursively
  const countChildren = (nodes: LegacyProcessTreeNode[]): number => {
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

  // Sorted connections
  const sortedConnections = useMemo(() => {
    if (!connSortCol) return connections
    const sorted = [...connections].sort((a, b) => {
      let cmp = 0
      switch (connSortCol) {
        case 'protocol': cmp = (a.protocol ?? '').localeCompare(b.protocol ?? ''); break
        case 'localPort': cmp = (a.localPort ?? 0) - (b.localPort ?? 0); break
        case 'remotePort': cmp = (a.remotePort ?? 0) - (b.remotePort ?? 0); break
        case 'state': cmp = (a.state ?? '').localeCompare(b.state ?? ''); break
      }
      return connSortAsc ? cmp : -cmp
    })
    return sorted
  }, [connections, connSortCol, connSortAsc])

  const handleConnSort = useCallback((col: typeof connSortCol) => {
    if (connSortCol === col) {
      setConnSortAsc(prev => !prev)
    } else {
      setConnSortCol(col)
      setConnSortAsc(true)
    }
  }, [connSortCol])

  const displayName = detail?.name ?? basicInfo?.name ?? `PID ${pid}`
  const displayPid = String(detail?.pid ?? basicInfo?.pid ?? pid)
  const displayPpid =
    detail?.ancestorChain?.length
      ? String(detail.ancestorChain[detail.ancestorChain.length - 1]?.pid ?? '-')
      : '-'
  const displayUserName = detail?.userName || accessReport?.targetProcessUser || '-'
  const displayStartTime = detail?.startTime
    ? formatStartTime(detail.startTime)
    : formatTimestamp(basicInfo?.startTime)
  const displayCommandLine = detail?.commandLine ?? basicInfo?.command ?? '-'
  const displayWorkingDirectory = detail?.workingDirectory ?? basicInfo?.workingDir ?? '-'
  const displayCpuPercent = detail?.cpuPercent ?? basicInfo?.cpu ?? 0
  const displayMemoryRss = detail?.memoryRSS ?? basicInfo?.memory ?? 0
  const displayMemoryVms = detail?.memoryVMS ?? basicInfo?.memory ?? 0
  const displayThreadCount = detail?.threadCount ?? 0
  const displayHandleCount = detail?.handleCount ?? 0
  const displayConnectionCount = detail?.networkConnections?.length ?? connections.length
  const hasRenderableFallback = Boolean(detail || basicInfo)

  return (
    <>
      {/* Overlay backdrop — click to close */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div
        ref={drawerRef}
        data-vm-surface="detail-drawer"
        data-vm-pid={pid}
        data-vm-fields={PROCESS_VM_FIELD_LIST}
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
                data-vm-field="name"
                data-vm-status="ok"
                data-vm-source="ProcessDetail"
                className="text-sm font-bold text-text-primary uppercase tracking-wider truncate"
                style={{ fontFamily: 'var(--font-display)' }}
                title={displayName}
              >
                {displayName}
              </h4>
              <div className="flex items-center gap-2">
                <span data-vm-field="pid" data-vm-status="ok" data-vm-source="ProcessDetail" className="text-[10px] text-text-muted font-mono">PID: {displayPid}</span>
                {detail?.scriptPath && (
                  <span className="text-[10px] text-accent font-mono truncate" title={detail?.scriptPath}>
                    {detail?.scriptPath}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              data-graph-entry="process-drawer-action"
              data-graph-kind="attached"
              onClick={() => window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: 'process', scope: { kind: 'process', targetId: pid, depth: 2 } } }))}
              className="btn-icon-sm text-text-muted hover:text-accent"
              title="查看关系图"
            >
              <TreeIcon size={14} />
            </button>
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
          ) : !hasRenderableFallback ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <div data-testid="detail-error-only" className="contents">
                <AlertIcon size={24} className="text-error" />
                <span className="text-text-muted text-sm">无法获取进程信息 (PID: {pid})</span>
                <span className="text-[10px] text-text-muted">进程可能已终止或当前会话缺少可显示的基础数据</span>
              </div>
            </div>
          ) : (
            <>
              {accessReport && (
                <PermissionNotice
                  report={accessReport}
                  onRetry={handleRefresh}
                  onRelaunch={handleRelaunchAsAdmin}
                  isRelaunching={isRelaunching}
                />
              )}
              <div className="p-4 space-y-3" data-testid="process-detail-panel">
                {!detail && (
                  <div className="bg-surface-900 px-3 py-2 border-l-2 border-warning radius-sm">
                    <span className="text-xs text-text-secondary">
                      当前显示的是进程基础信息快照。更多字段需要提升权限或稍后重试。
                    </span>
                  </div>
                )}
                {/* Overview Tab — Basic Info */}
              {activeTab === 'overview' && (
                <div className="space-y-3 animate-fade-in">
                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <span data-vm-field="name" data-vm-status="ok" data-vm-source="ProcessDetail"><DetailField label="名称" value={displayName} testId="detail-field-name" /></span>
                    <span data-vm-field="pid" data-vm-status="ok" data-vm-source="ProcessDetail"><DetailField label="PID" value={displayPid} mono testId="detail-field-pid" /></span>
                    <DetailField label="PPID" value={displayPpid} mono />
                    <DetailField label="用户" value={displayUserName} />
                    <span data-vm-field="startTime" data-vm-status="ok" data-vm-source="ProcessDetail"><DetailField label="启动时间" value={displayStartTime} /></span>
                    {detail?.scriptPath && (
                      <DetailField label="脚本路径" value={detail.scriptPath ?? ''} mono copyable />
                    )}
                  </div>

                  {/* Executable Path */}
                  {detail?.executablePath && (
                    <DetailField label="可执行文件路径" value={detail.executablePath ?? ''} mono copyable />
                  )}

                  {/* Command Line */}
                  <span data-vm-field="status" data-vm-status="data_missing" data-vm-source="ProcessDetail" className="sr-only">状态在详情抽屉中由进程快照继承</span>
                  <span data-vm-field="type" data-vm-status="data_missing" data-vm-source="ProcessDetail" className="sr-only">类型在详情抽屉中由进程快照继承</span>
                  <span data-vm-field="port" data-vm-status={displayConnectionCount > 0 ? 'ok' : 'data_missing'} data-vm-source="ProcessDetail" className="sr-only">{displayConnectionCount} 个网络连接</span>

                  {displayCommandLine !== '-' && (
                    <div data-vm-field="command" data-vm-status="ok" data-vm-source="ProcessDetail" className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600 radius-sm">
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
                      <p className="text-xs text-text-secondary font-mono break-all">$ {displayCommandLine}</p>
                    </div>
                  )}

                  {/* Working Directory */}
                  {displayWorkingDirectory !== '-' && (
                    <DetailField label="工作目录" value={displayWorkingDirectory} mono copyable />
                  )}

                  {/* Quick stats links to other tabs */}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {displayConnectionCount > 0 && (
                      <button onClick={() => setActiveTab('network')} className="flex items-center gap-1.5 bg-surface-800 px-2 py-1 hover:bg-surface-700 transition-colors radius-sm">
                        <PortIcon size={12} className="text-gold" />
                        <span className="text-text-muted">{displayConnectionCount} 个网络连接</span>
                      </button>
                    )}
                    {(detail?.relatedProcesses?.length ?? 0) > 0 && (
                      <button onClick={() => setActiveTab('network')} className="flex items-center gap-1.5 bg-surface-800 px-2 py-1 hover:bg-surface-700 transition-colors radius-sm">
                        <ProcessIcon size={12} className="text-steel" />
                        <span className="text-text-muted">{detail?.relatedProcesses?.length ?? 0} 个关联进程</span>
                      </button>
                    )}
                    {totalChildren > 0 && (
                      <span className="flex items-center gap-1.5 bg-surface-800 px-2 py-1 radius-sm">
                        <TreeIcon size={12} className="text-accent" />
                        <span className="text-text-muted">{totalChildren} 个子进程</span>
                      </span>
                    )}
                  </div>

                  {/* Process Tree (inline collapsible) */}
                  {detail && (detail.ancestorChain.length > 0 || detail.children.length > 0) && (
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
                <div data-vm-field="cpu" data-vm-status="ok" data-vm-source="ProcessDetail" className="space-y-3 animate-fade-in">
                  {/* CPU Chart */}
                  <CpuChart data={cpuHistory} />

                  <div
                    data-testid="process-detail-history-24h"
                    className="bg-surface-900 px-3 py-3 border-l-2 border-accent/70 radius-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider block">24h 趋势</span>
                        <span className="text-[10px] text-text-secondary font-mono break-all">
                          {processHistoryName ?? 'unknown'}{processHistoryWorkingDir ? ` · ${processHistoryWorkingDir}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1" role="group" aria-label="选择 24h 趋势指标">
                        {PROCESS_HISTORY_METRIC_OPTIONS.map(option => (
                          <button
                            key={option.key}
                            type="button"
                            aria-pressed={historyMetric === option.key}
                            className={`px-2 py-1 text-[10px] font-bold border transition-colors radius-sm ${
                              historyMetric === option.key
                                ? 'border-accent text-accent bg-accent/10'
                                : 'border-surface-700 text-text-muted hover:text-text-primary hover:border-surface-500'
                            }`}
                            onClick={() => setHistoryMetric(option.key)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {history24hLoading && !history24h && (
                      <div className="flex items-center gap-2 py-3 text-xs text-text-muted">
                        <LoadingSpinner size="sm" />
                        <span>正在加载 24h 趋势...</span>
                      </div>
                    )}
                    {history24hError && (
                      <div className="border-l-2 border-warning bg-warning/10 px-2 py-2 text-[11px] text-warning radius-sm">
                        {history24hError}
                      </div>
                    )}
                    {!history24hError && (!history24hLoading || history24h) && (
                      <ProcessSparkline
                        className="w-full"
                        color={selectedHistoryMetric.color}
                        height={108}
                        history={history24h ?? undefined}
                        metric={historyMetric}
                        testId="process-detail-history-24h-chart"
                        width={420}
                      />
                    )}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
                      <span>采样点 {history24hPointCount}</span>
                      <span>间断 {history24hGapCount}</span>
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600 radius-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider">内存使用</span>
                      <span className="font-mono font-bold text-sm text-info">{displayMemoryRss} MB</span>
                    </div>
                    <div className="h-2 bg-surface-800 radius-sm">
                      <div
                        className="h-full transition-all duration-500 bg-info"
                          style={{ width: `${Math.min((displayMemoryRss / Math.max(displayMemoryRss, 500)) * 100, 100)}%`, borderRadius: '1px' }}
                      />
                    </div>
                  </div>

                  {/* Resource Details Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="CPU" value={`${displayCpuPercent.toFixed(1)}%`} mono />
                    <span data-vm-field="memory" data-vm-status="ok" data-vm-source="ProcessDetail"><DetailField label="内存 (RSS)" value={`${displayMemoryRss} MB`} mono /></span>
                    <DetailField label="内存 (VMS)" value={`${displayMemoryVms} MB`} mono />
                    <DetailField label="线程数" value={String(displayThreadCount)} mono />
                    <DetailField label="句柄数" value={String(displayHandleCount)} mono />
                    <DetailField label="IO 读取" value={formatBytes(detail?.ioReadBytes ?? 0)} mono />
                    <DetailField label="IO 写入" value={formatBytes(detail?.ioWriteBytes ?? 0)} mono />
                  </div>
                </div>
              )}

              {/* Network Tab */}
              {activeTab === 'network' && (
                <div className="space-y-3 animate-fade-in">
                  {/* Connection Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-surface-900 px-3 py-2 border-l-2 border-success radius-sm">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block">监听</span>
                      <span className="text-sm font-bold font-mono text-success">{connectionStats.listening}</span>
                    </div>
                    <div className="bg-surface-900 px-3 py-2 border-l-2 border-info radius-sm">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block">已连接</span>
                      <span className="text-sm font-bold font-mono text-info">{connectionStats.established}</span>
                    </div>
                    <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-500 radius-sm">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block">其他</span>
                      <span className="text-sm font-bold font-mono text-text-muted">{connectionStats.other}</span>
                    </div>
                  </div>

                  {/* Connection List — sortable */}
                  {connections.length > 0 ? (
                    <div className="space-y-1">
                      {/* Column Headers */}
                      <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-text-muted uppercase tracking-wider">
                        <button onClick={() => handleConnSort('protocol')} className="w-8 flex-shrink-0 hover:text-text-primary cursor-pointer select-none">
                          协议{connSortCol === 'protocol' ? (connSortAsc ? ' ^' : ' v') : ''}
                        </button>
                        <button onClick={() => handleConnSort('localPort')} className="flex-1 text-left hover:text-text-primary cursor-pointer select-none">
                          本地地址{connSortCol === 'localPort' ? (connSortAsc ? ' ^' : ' v') : ''}
                        </button>
                        <span className="flex-shrink-0 w-4" />
                        <button onClick={() => handleConnSort('remotePort')} className="flex-1 text-left hover:text-text-primary cursor-pointer select-none">
                          远程地址{connSortCol === 'remotePort' ? (connSortAsc ? ' ^' : ' v') : ''}
                        </button>
                        <button onClick={() => handleConnSort('state')} className="flex-shrink-0 hover:text-text-primary cursor-pointer select-none">
                          状态{connSortCol === 'state' ? (connSortAsc ? ' ^' : ' v') : ''}
                        </button>
                      </div>
                      <span className="text-[10px] text-text-muted block mb-1">
                        {connections.length} 个连接
                      </span>
                      {sortedConnections.map((conn, i) => (
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
                  {(detail?.relatedProcesses?.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
                        关联进程 ({detail?.relatedProcesses?.length ?? 0})
                      </span>
                      {detail?.relatedProcesses.map(rp => (
                        <div
                          key={rp.pid}
                          className="flex items-center justify-between bg-surface-900 px-3 py-1.5 border-l-2 border-steel/30 radius-sm"
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
                    <div className="flex items-center gap-2 bg-warning/10 px-3 py-2 border-l-2 border-warning radius-sm">
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
                      className="w-full bg-surface-800 border border-surface-600 px-9 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent radius-sm"
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
                    <div className="flex items-center gap-2 bg-warning/10 px-3 py-2 border-l-2 border-warning radius-sm">
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
                      className="w-full bg-surface-800 border border-surface-600 px-9 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent radius-sm"
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
                        className="flex items-center gap-2 bg-surface-900 px-3 py-1.5 border-l-2 border-surface-600 hover:bg-surface-800 radius-sm"
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
            </>
          )}
        </div>

        {/* Footer — Action Buttons */}
        {detail && !detail.requiresElevation && (
          <div className="flex items-center gap-2 px-4 py-3 border-t-2 border-surface-700 relative z-10 flex-shrink-0 flex-wrap">
            {isProcessProtected ? (
              <div className="flex items-center gap-2 bg-warning/10 px-3 py-1.5 border-l-2 border-warning radius-sm">
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
                <div className="absolute bottom-full left-0 mb-1 bg-surface-800 border border-surface-600 py-1 z-20 min-w-[120px] radius-sm">
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
        message={`确定要终止进程 "${displayName}" (PID: ${pid}) 吗？`}
        confirmText="终止"
        variant="danger"
        onConfirm={handleKill}
        onCancel={() => setShowKillConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showKillTreeConfirm}
        title="终止进程树"
        message={`确定要终止 "${displayName}" 及其 ${totalChildren} 个子进程吗？此操作不可撤销。`}
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
