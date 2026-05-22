import { useEffect, useMemo, useState } from 'react'
import {
  STATUSBAR_LIMITS,
  statusAggregateSchema,
  statusbarConfigSchema,
  type StatusAggregate,
  type StatusbarConfig,
  type StatusTile
} from '@shared/schemas/r8-runtime'
import type { CodingTool, Project } from '@shared/types'
import type { AITask, PortInfo, SystemSummary } from '@shared/types-extended'
import { useToolStatus } from './useToolStatus'
import { useProjectStore } from '../stores/projectStore'
import { usePortPopoutStore } from '../stores/portPopoutStore'
import { useScannerStore } from '../stores/scannerStore'
import {
  createEmptyStatusAggregate,
  createStatusTile,
  STATUSBAR_CONFIG_CHANGE_EVENT,
  applyStatusbarConfig,
  mergeStatusTiles,
  splitStatusBarTiles
} from '../components/statusbar/statusbar-model'

interface StatusBarAggregateModel {
  aggregate: StatusAggregate
  visibleTiles: StatusTile[]
  overflowTiles: StatusTile[]
  error: string | null
}

function isPublicEndpoint(value: string | undefined): boolean {
  if (!value) return false
  if (value === '0.0.0.0' || value === '::') return true
  return !value.startsWith('127.') && value !== 'localhost' && value !== '::1'
}

function countPublicPorts(ports: readonly PortInfo[]): number {
  return ports.filter(port => isPublicEndpoint(port.localAddress)).length
}

function countListeningPorts(ports: readonly PortInfo[], summary: SystemSummary): number {
  if (ports.length === 0) return summary.activePortCount
  return ports.filter(port => port.state === 'LISTENING').length
}

function aiTaskState(task: AITask): string {
  return typeof task.status === 'string' ? task.status : task.status.state
}

function runningAiTasks(aiTasks: readonly AITask[], summary: SystemSummary): number {
  if (aiTasks.length === 0) return summary.aiToolCount
  return aiTasks.filter(task => ['running', 'waiting'].includes(aiTaskState(task))).length
}

function failedAiTasks(aiTasks: readonly AITask[]): number {
  return aiTasks.filter(task => ['failed', 'error'].includes(aiTaskState(task))).length
}

function currentTheme(): string {
  if (typeof document === 'undefined') return 'constructivism'
  return document.documentElement.dataset.theme ?? 'constructivism'
}

function numericTileValue(tile: StatusTile | undefined): number {
  if (typeof tile?.value === 'number' && Number.isFinite(tile.value)) return tile.value
  if (typeof tile?.badgeValue === 'number' && Number.isFinite(tile.badgeValue)) return tile.badgeValue
  if (typeof tile?.badgeValue === 'string') {
    const parsed = Number(tile.badgeValue)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function mergeRendererPopoutTile(
  tiles: readonly StatusTile[],
  runtimePopouts: number,
  rendererPopouts: number,
  now: number
): StatusTile[] {
  const combinedPopouts = runtimePopouts + rendererPopouts
  return tiles.map(tile => tile.id !== 'popouts'
    ? tile
    : {
        ...tile,
        value: combinedPopouts,
        badgeType: 'number',
        badgeValue: combinedPopouts,
        tone: combinedPopouts > 0 ? 'accent' : 'neutral',
        updatedAt: now,
        source: rendererPopouts > 0 ? 'renderer' : tile.source,
        tooltip: rendererPopouts > 0
          ? `当前浮卡数量（BrowserWindow ${runtimePopouts} / renderer ${rendererPopouts}）`
          : tile.tooltip
      })
}

export function buildRendererStatusTiles(input: {
  projects: readonly Project[]
  summary: SystemSummary
  ports: readonly PortInfo[]
  aiTasks: readonly AITask[]
  tools: readonly CodingTool[]
  popoutsActive: number
  now: number
}): StatusTile[] {
  const cpuPct = Math.round(input.summary.cpuTotal)
  const memPct = Math.round(input.summary.memoryUsedPercent)
  const projectsCount = input.projects.filter(project => project.status === 'running').length
  const aiTasksRunning = runningAiTasks(input.aiTasks, input.summary)
  const aiTasksFailed = failedAiTasks(input.aiTasks)
  const publicPortsCount = countPublicPorts(input.ports)
  const listeningPortsCount = countListeningPorts(input.ports, input.summary)
  const runningTools = input.tools.filter(tool => tool.status === 'running').length

  return [
    createStatusTile('cpu', cpuPct, input.now, {
      tone: cpuPct >= 80 ? 'warning' : 'neutral',
      badgeType: cpuPct >= 80 ? 'warning' : 'number',
      badgeValue: `${cpuPct}%`,
      iconToken: 'MonitorIcon',
      tooltip: 'CPU 使用率',
      clickAction: { type: 'open-drawer', args: { slot: 'statusbar', contentId: 'statusbar.aggregate' } }
    }),
    createStatusTile('mem', memPct, input.now, {
      tone: memPct >= 80 ? 'warning' : 'neutral',
      badgeType: memPct >= 80 ? 'warning' : 'number',
      badgeValue: `${memPct}%`,
      iconToken: 'ProcessIcon',
      tooltip: '内存使用率',
      clickAction: { type: 'open-drawer', args: { slot: 'statusbar', contentId: 'statusbar.aggregate' } }
    }),
    createStatusTile('net', 0, input.now, {
      badgeType: 'experimental',
      badgeValue: 'EXP',
      iconToken: 'NetworkIcon',
      tooltip: '网络速率聚合待 R8.C observability 接入',
      clickAction: { type: 'open-drawer', args: { slot: 'bottom', contentId: 'observability' } }
    }),
    createStatusTile('battery', 'N/A', input.now, {
      visible: false,
      iconToken: 'LightningIcon',
      tooltip: '电池信息不可用时自动隐藏'
    }),
    createStatusTile('projects', projectsCount, input.now, {
      tone: projectsCount > 0 ? 'success' : 'neutral',
      badgeType: 'number',
      badgeValue: projectsCount,
      iconToken: 'FolderIcon',
      tooltip: '运行中的项目数',
      clickAction: { type: 'navigate', args: { route: 'projects' } }
    }),
    createStatusTile('ai-tasks', aiTasksRunning, input.now, {
      tone: aiTasksFailed > 0 ? 'danger' : aiTasksRunning + runningTools > 0 ? 'accent' : 'neutral',
      badgeType: aiTasksFailed > 0 ? 'error' : 'number',
      badgeValue: aiTasksFailed > 0 ? aiTasksFailed : aiTasksRunning + runningTools,
      iconToken: 'AIIcon',
      tooltip: 'AI 任务运行数',
      clickAction: { type: 'open-drawer', args: { slot: 'right', contentId: 'ai-task.detail', monitorTab: 'ai-task' } }
    }),
    createStatusTile('public-ports', publicPortsCount, input.now, {
      tone: publicPortsCount > 0 ? 'warning' : 'success',
      badgeType: publicPortsCount > 0 ? 'warning' : 'number',
      badgeValue: publicPortsCount,
      iconToken: 'GlobeIcon',
      tooltip: '疑似公网监听端口',
      clickAction: { type: 'navigate', args: { route: 'monitor', tab: 'port' } }
    }),
    createStatusTile('listening-ports', listeningPortsCount, input.now, {
      tone: listeningPortsCount > 0 ? 'accent' : 'neutral',
      badgeType: 'number',
      badgeValue: listeningPortsCount,
      iconToken: 'PortIcon',
      tooltip: '监听端口数量',
      clickAction: { type: 'navigate', args: { route: 'monitor', tab: 'port' } }
    }),
    createStatusTile('notifications', 0, input.now, {
      badgeType: 'unread',
      badgeValue: 0,
      iconToken: 'BellIcon',
      tooltip: '通知中心未处理事件',
      clickAction: { type: 'open-drawer', args: { slot: 'top', contentId: 'notifications.top' } }
    }),
    createStatusTile('popouts', input.popoutsActive, input.now, {
      tone: input.popoutsActive > 0 ? 'accent' : 'neutral',
      badgeType: 'number',
      badgeValue: input.popoutsActive,
      iconToken: 'WindowIcon',
      tooltip: '当前浮卡数量',
      clickAction: { type: 'open-drawer', args: { slot: 'floating', contentId: 'popout.manager' } }
    }),
    createStatusTile('theme', currentTheme(), input.now, {
      tone: 'accent',
      badgeType: 'new',
      badgeValue: 'NEW',
      iconToken: 'PaletteIcon',
      tooltip: '当前主题与装饰轴',
      clickAction: { type: 'open-drawer', args: { slot: 'right', contentId: 'settings' } }
    }),
    createStatusTile('cmdk', 'Ctrl+K', input.now, {
      tone: 'success',
      badgeType: 'experimental',
      badgeValue: 'CMD',
      iconToken: 'SearchIcon',
      tooltip: '打开命令面板',
      clickAction: { type: 'open-cmdk', args: {} }
    })
  ]
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useStatusBarAggregate(): StatusBarAggregateModel {
  const { tools } = useToolStatus()
  const projects = useProjectStore(state => state.projects)
  const summary = useScannerStore(state => state.summary)
  const ports = useScannerStore(state => state.ports)
  const aiTasks = useScannerStore(state => state.aiTasks)
  const rendererPortPopouts = usePortPopoutStore(state => state.popouts.length)
  const [runtimeAggregate, setRuntimeAggregate] = useState<StatusAggregate | null>(null)
  const [statusbarConfig, setStatusbarConfig] = useState<StatusbarConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    const loadRuntimeAggregate = () => {
      void window.devhub?.r8?.status?.aggregate?.()
        .then(result => {
          if (disposed) return
          setRuntimeAggregate(statusAggregateSchema.parse(result))
          setError(null)
        })
        .catch(reason => {
          if (!disposed) setError(toErrorMessage(reason))
        })
    }
    loadRuntimeAggregate()
    const unsubscribe = window.devhub?.r8?.status?.onAggregate?.(result => {
      if (disposed) return
      try {
        setRuntimeAggregate(statusAggregateSchema.parse(result))
        setError(null)
      } catch (reason) {
        setError(toErrorMessage(reason))
      }
    })
    const timer = window.setInterval(loadRuntimeAggregate, STATUSBAR_LIMITS.REFRESH_INTERVAL_MS)
    return () => {
      disposed = true
      window.clearInterval(timer)
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    let disposed = false
    const getConfig = window.devhub?.r8?.statusbar?.getConfig
    if (!getConfig) return () => {
      disposed = true
    }
    void getConfig()
      .then(result => {
        if (disposed) return
        setStatusbarConfig(statusbarConfigSchema.parse(result))
      })
      .catch(reason => {
        if (!disposed) setError(toErrorMessage(reason))
      })
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    const handleConfigChanged = (event: Event) => {
      try {
        const detail = (event as CustomEvent<unknown>).detail
        setStatusbarConfig(statusbarConfigSchema.parse(detail))
      } catch (reason) {
        setError(toErrorMessage(reason))
      }
    }
    window.addEventListener(STATUSBAR_CONFIG_CHANGE_EVENT, handleConfigChanged)
    return () => window.removeEventListener(STATUSBAR_CONFIG_CHANGE_EVENT, handleConfigChanged)
  }, [])

  const aggregate = useMemo(() => {
    const now = Date.now()
    const rendererAggregate = createEmptyStatusAggregate(now)
    const rendererTiles = buildRendererStatusTiles({
      projects,
      summary,
      ports,
      aiTasks,
      tools,
      popoutsActive: rendererPortPopouts,
      now
    })
    const runtimeTiles = runtimeAggregate?.tiles ?? []
    const runtimePopouts = numericTileValue(runtimeTiles.find(tile => tile.id === 'popouts'))
    const mergedTiles = mergeRendererPopoutTile(
      mergeStatusTiles(runtimeTiles, rendererTiles),
      runtimePopouts,
      rendererPortPopouts,
      now
    )
    const tiles = applyStatusbarConfig(mergedTiles, statusbarConfig)
    return statusAggregateSchema.parse({
      generatedAt: runtimeAggregate?.generatedAt ?? now,
      tiles,
      badges: tiles.filter(tile => tile.visible && tile.badgeType !== undefined).slice(0, 6),
      refreshIntervalMs: runtimeAggregate?.refreshIntervalMs ?? rendererAggregate.refreshIntervalMs
    })
  }, [aiTasks, ports, projects, rendererPortPopouts, runtimeAggregate, statusbarConfig, summary, tools])

  const { visibleTiles, overflowTiles } = useMemo(() => splitStatusBarTiles(aggregate.tiles), [aggregate.tiles])

  return { aggregate, visibleTiles, overflowTiles, error }
}
