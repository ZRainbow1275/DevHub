import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { FlowEventKind, FlowEventStreamPayload, FlowExportResult, FlowNode, FlowRequest, FlowSnapshot } from '@shared/schemas/r8-runtime'
import type { ScopedFlowLink, ScopedFlowStep, TopologyScope } from '@shared/topology/scope'
import { useScopedTopology } from '../../../hooks/useScopedTopology'
import { FolderIcon, LightningIcon, NetworkIcon, PlayIcon, PortIcon, ProcessIcon, WindowIcon } from '../../icons'
import { FlowAnimationLayer, FlowAnimationList } from './FlowAnimationLayer'

interface AttachedFlowViewProps {
  scope: TopologyScope
  className?: string
}

type FlowWindowPreset = { label: string; value: FlowRequest['windowMs'] }
type FlowKindFilter = FlowEventKind | 'all'
type FlowToolFilter = NonNullable<FlowRequest['filter']['tools']>[number] | 'all'

const FLOW_WINDOW_PRESETS: FlowWindowPreset[] = [
  { label: '5min', value: 300000 },
  { label: '30min', value: 1800000 },
  { label: '1h', value: 3600000 },
  { label: '6h', value: 21600000 },
  { label: '24h', value: 86400000 },
  { label: 'all', value: -1 }
]
const FLOW_SPEEDS: FlowRequest['speed'][] = [0, 1, 2, 4, 8]
const FLOW_ANIMATION_NODE_LIMIT = 200
const FLOW_KIND_FILTERS: Array<{ label: string; value: FlowKindFilter }> = [
  { label: 'all', value: 'all' },
  { label: 'fail', value: 'task-fail' },
  { label: 'retry', value: 'task-retry' },
  { label: 'watchdog', value: 'watchdog-action' }
]
const FLOW_TOOL_FILTERS: Array<{ label: string; value: FlowToolFilter }> = [
  { label: 'tool all', value: 'all' },
  { label: 'codex', value: 'codex' },
  { label: 'claude', value: 'claude' },
  { label: 'gemini', value: 'gemini' },
  { label: 'cursor', value: 'cursor' },
  { label: 'copilot', value: 'copilot' }
]
const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

function StepIcon({ kind }: { kind: ScopedFlowStep['kind'] }) {
  if (kind === 'project') return <FolderIcon size={12} className="text-accent" />
  if (kind === 'process') return <ProcessIcon size={12} className="text-gold" />
  if (kind === 'port') return <PortIcon size={12} className="text-success" />
  return <WindowIcon size={12} className="text-steel" />
}

function FlowEventIcon({ node }: { node: FlowNode }) {
  if (node.kind === 'task-fail') return <LightningIcon size={12} className="text-danger" />
  if (node.kind === 'task-retry') return <LightningIcon size={12} className="text-warning" />
  if (node.kind === 'cli-event') return <NetworkIcon size={12} className="text-accent" />
  return <PlayIcon size={12} className="text-success" />
}

function getLinkSummary(step: ScopedFlowStep, links: ScopedFlowLink[]): string {
  const outgoing = links.filter(link => link.fromStepId === step.id).length
  const incoming = links.filter(link => link.toStepId === step.id).length
  return `${incoming} in / ${outgoing} out`
}

function toFlowScope(kind: TopologyScope['kind']): FlowRequest['scope'] {
  if (kind === 'process' || kind === 'port' || kind === 'window' || kind === 'project') return kind
  return 'runtime'
}

function formatWindow(value: FlowRequest['windowMs']): string {
  return FLOW_WINDOW_PRESETS.find(preset => preset.value === value)?.label ?? 'custom'
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  return `${minutes}min`
}

interface FlowEventRowProps {
  node: FlowNode
  index: number
  speed: FlowRequest['speed']
}

const FlowEventRow = memo(function FlowEventRow({ node, index, speed }: FlowEventRowProps) {
  return (
    <FlowAnimationLayer node={node} index={index} speed={speed}>
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border-l-2 border-accent bg-surface-800 text-[10px] font-bold text-accent radius-sm">
        {index + 1}
      </div>
      <div data-testid="flow-event-row" className="min-w-0 flex-1 border-l-2 border-surface-600 bg-surface-800 px-3 py-2 radius-sm">
        <div className="flex items-center gap-2">
          <FlowEventIcon node={node} />
          <span className="truncate text-xs font-bold text-text-primary">{node.label}</span>
          <span className="ml-auto text-[10px] text-text-muted">{node.kind}</span>
        </div>
        <div className="mt-1 text-[10px] text-text-muted">task {node.taskId ?? 'none'} - {node.errorCode ?? 'ok'} - {node.durationMs === null ? 'pending' : formatDuration(node.durationMs)}</div>
      </div>
    </FlowAnimationLayer>
  )
}, (prev, next) => (
  prev.index === next.index &&
  prev.speed === next.speed &&
  prev.node.id === next.node.id &&
  prev.node.kind === next.node.kind &&
  prev.node.ts === next.node.ts &&
  prev.node.label === next.node.label &&
  prev.node.taskId === next.node.taskId &&
  prev.node.instanceId === next.node.instanceId &&
  prev.node.errorCode === next.node.errorCode &&
  prev.node.durationMs === next.node.durationMs
))

export const AttachedFlowView = memo(function AttachedFlowView({ scope, className = '' }: AttachedFlowViewProps) {
  const { flow, loading, error, refresh } = useScopedTopology(scope)
  const [windowMs, setWindowMs] = useState<FlowRequest['windowMs']>(1800000)
  const [speed, setSpeed] = useState<FlowRequest['speed']>(1)
  const [kindFilter, setKindFilter] = useState<FlowKindFilter>('all')
  const [taskFilter, setTaskFilter] = useState<string>('all')
  const [toolFilter, setToolFilter] = useState<FlowToolFilter>('all')
  const [minErrorLevel, setMinErrorLevel] = useState<'ERROR' | undefined>(undefined)
  const [cursorTs, setCursorTs] = useState<number | undefined>(undefined)
  const [snapshot, setSnapshot] = useState<FlowSnapshot | null>(null)
  const [flowLoading, setFlowLoading] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [exportResult, setExportResult] = useState<FlowExportResult | null>(null)
  const bridgeAvailable = Boolean(isElectron && window.devhub.r8?.topology?.attachedFlow)
  const request = useMemo<Partial<FlowRequest>>(() => ({
    scope: toFlowScope(scope.kind),
    rootId: `${scope.kind}-${String(scope.targetId)}`,
    targetId: scope.targetId,
    windowMs,
    cursorTs,
    speed,
    filter: {
      ...(kindFilter === 'all' ? {} : { kinds: [kindFilter] }),
      ...(taskFilter === 'all' ? {} : { taskIds: [taskFilter] }),
      ...(toolFilter === 'all' ? {} : { tools: [toolFilter] }),
      ...(minErrorLevel === undefined ? {} : { minErrorLevel })
    }
  }), [cursorTs, kindFilter, minErrorLevel, scope.kind, scope.targetId, speed, taskFilter, toolFilter, windowMs])

  const loadAttachedFlow = useCallback(async () => {
    if (!bridgeAvailable) return
    setFlowLoading(true)
    setFlowError(null)
    try {
      const result = await window.devhub.r8.topology.attachedFlow(request)
      setSnapshot(result)
      if (cursorTs === undefined && result.nodes.length > 0) setCursorTs(result.toTs)
    } catch (err) {
      setSnapshot(null)
      setFlowError(err instanceof Error ? err.message : 'attached flow failed')
    } finally {
      setFlowLoading(false)
    }
  }, [bridgeAvailable, cursorTs, request])

  useEffect(() => {
    void loadAttachedFlow()
  }, [loadAttachedFlow])

  useEffect(() => {
    if (!bridgeAvailable || !window.devhub.r8?.topology?.subscribeFlowEvents) return undefined
    const unsubscribe = window.devhub.r8.topology.subscribeFlowEvents((payload: FlowEventStreamPayload) => {
      setSnapshot(payload.snapshot)
      setCursorTs(current => current ?? payload.snapshot.toTs)
    }, { request, intervalMs: 1000 })
    return unsubscribe
  }, [bridgeAvailable, request])

  const visibleNodes = useMemo(() => {
    const nodes = snapshot?.nodes ?? []
    if (cursorTs === undefined) return nodes
    return nodes.filter(node => node.ts <= cursorTs)
  }, [cursorTs, snapshot])
  const taskFilterOptions = useMemo(() => {
    const taskIds = new Set<string>()
    for (const node of snapshot?.nodes ?? []) {
      if (node.taskId) taskIds.add(node.taskId)
    }
    return ['all', ...[...taskIds].sort((left, right) => left.localeCompare(right))]
  }, [snapshot])

  const handleExport = useCallback(async () => {
    if (!bridgeAvailable || !window.devhub.r8?.topology?.exportFlow) return
    setFlowError(null)
    try {
      setExportResult(await window.devhub.r8.topology.exportFlow({ ...request, format: 'mermaid-sequence' }))
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'flow export failed')
    }
  }, [bridgeAvailable, request])

  const steps = flow?.steps ?? []
  const links = flow?.links ?? []
  const activeLoading = flowLoading || loading
  const activeError = flowError ?? error
  const stats = snapshot?.stats
  const rowAnimationSpeed = visibleNodes.length > FLOW_ANIMATION_NODE_LIMIT ? 0 : speed

  return (
    <div
      data-testid="attached-flow-view"
      data-root-kind={scope.kind}
      data-root-id={String(scope.targetId)}
      data-source={snapshot?.source ?? flow?.source ?? 'pending'}
      data-window-ms={String(snapshot?.windowMs ?? windowMs)}
      data-speed={String(speed)}
      data-flow-node-count={visibleNodes.length}
      data-step-count={steps.length}
      data-link-count={links.length}
      className={`border border-surface-700 bg-surface-900 radius-sm ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-700 px-3 py-2">
        <NetworkIcon size={13} className="text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent" style={{ fontFamily: 'var(--font-display)' }}>
          附属流程
        </span>
        <span className="text-[10px] text-text-muted">
          {snapshot ? `${visibleNodes.length} events - ${snapshot.edges.length} edges` : `${steps.length} 步 - ${links.length} 条真实关系`}
        </span>
        {stats && (
          <span data-testid="flow-stats-badge" className="text-[10px] text-text-muted">
            total {stats.totalEvents} / fail {stats.failCount} / retry {stats.retryCount} / p95 {formatDuration(stats.p95DurationMs)}
          </span>
        )}
        {activeError && <span className="text-[10px] text-warning">{activeError}</span>}
        {snapshot?.warnings.map(warning => (
          <span key={warning.code} data-testid="flow-warning" className="text-[10px] text-warning">{warning.code}</span>
        ))}
        <button type="button" onClick={() => { if (bridgeAvailable) { void loadAttachedFlow() } else { void refresh() } }} disabled={activeLoading} className="ml-auto text-[10px] text-text-muted hover:text-text-primary disabled:opacity-50">
          {activeLoading ? '刷新中' : '刷新'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-surface-800 px-3 py-2">
        <div data-testid="flow-window-menu" className="flex flex-wrap items-center gap-1">
          {FLOW_WINDOW_PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              data-active={preset.value === windowMs ? 'true' : 'false'}
              onClick={() => { setWindowMs(preset.value); setCursorTs(undefined) }}
              className={`border px-2 py-1 text-[10px] radius-sm ${preset.value === windowMs ? 'border-accent bg-accent/10 text-accent' : 'border-surface-700 text-text-muted hover:text-text-primary'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div data-testid="flow-speed-control" className="flex items-center gap-1">
          {FLOW_SPEEDS.map(item => (
            <button
              key={item}
              type="button"
              data-testid={`flow-speed-${item}`}
              data-active={item === speed ? 'true' : 'false'}
              onClick={() => setSpeed(item)}
              className={`border px-2 py-1 text-[10px] radius-sm ${item === speed ? 'border-success bg-success/10 text-success' : 'border-surface-700 text-text-muted hover:text-text-primary'}`}
            >
              {item === 0 ? 'pause' : `${item}x`}
            </button>
          ))}
        </div>
        <div data-testid="flow-filter-menu" className="flex flex-wrap items-center gap-1">
          {FLOW_KIND_FILTERS.map(option => (
            <button
              key={option.value}
              type="button"
              data-testid={`flow-filter-${option.value}`}
              data-active={option.value === kindFilter ? 'true' : 'false'}
              onClick={() => { setKindFilter(option.value); setCursorTs(undefined) }}
              className={`border px-2 py-1 text-[10px] radius-sm ${option.value === kindFilter ? 'border-accent bg-accent/10 text-accent' : 'border-surface-700 text-text-muted hover:text-text-primary'}`}
            >
              {option.label}
            </button>
          ))}
          <select
            data-testid="flow-filter-task"
            value={taskFilter}
            onChange={event => { setTaskFilter(event.currentTarget.value); setCursorTs(undefined) }}
            className="border border-surface-700 bg-surface-900 px-2 py-1 text-[10px] text-text-muted radius-sm"
          >
            {taskFilterOptions.map(taskId => (
              <option key={taskId} value={taskId}>{taskId === 'all' ? 'task all' : taskId}</option>
            ))}
          </select>
          {FLOW_TOOL_FILTERS.map(option => (
            <button
              key={option.value}
              type="button"
              data-testid={`flow-filter-tool-${option.value}`}
              data-active={option.value === toolFilter ? 'true' : 'false'}
              onClick={() => { setToolFilter(option.value); setCursorTs(undefined) }}
              className={`border px-2 py-1 text-[10px] radius-sm ${option.value === toolFilter ? 'border-success bg-success/10 text-success' : 'border-surface-700 text-text-muted hover:text-text-primary'}`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            data-testid="flow-filter-error"
            data-active={minErrorLevel === 'ERROR' ? 'true' : 'false'}
            onClick={() => { setMinErrorLevel(value => value === 'ERROR' ? undefined : 'ERROR'); setCursorTs(undefined) }}
            className={`border px-2 py-1 text-[10px] radius-sm ${minErrorLevel === 'ERROR' ? 'border-warning bg-warning/10 text-warning' : 'border-surface-700 text-text-muted hover:text-text-primary'}`}
          >
            errors
          </button>
        </div>
        <button type="button" data-testid="flow-export-mermaid" onClick={() => { void handleExport() }} className="border border-surface-700 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary radius-sm">
          export mermaid
        </button>
        <span className="text-[10px] text-text-muted">window {formatWindow(windowMs)}</span>
      </div>

      {snapshot && (
        <div className="border-b border-surface-800 px-3 py-2">
          <label className="flex items-center gap-2 text-[10px] text-text-muted">
            cursor
            <input
              data-testid="flow-time-cursor"
              type="range"
              min={snapshot.fromTs}
              max={snapshot.toTs}
              value={cursorTs ?? snapshot.toTs}
              onChange={event => setCursorTs(Number(event.currentTarget.value))}
              className="flex-1"
            />
            <span>{visibleNodes.length}/{snapshot.nodes.length}</span>
          </label>
        </div>
      )}
      <div className="space-y-2 p-3">
        {snapshot && visibleNodes.length === 0 && (
          <div className="border-l-2 border-surface-600 bg-surface-800 px-3 py-4 text-center text-xs text-text-muted radius-sm">
            当前时间窗暂无真实流程事件，可扩大时间窗
          </div>
        )}
        <FlowAnimationList enabled={rowAnimationSpeed > 0}>
          {visibleNodes.map((node, index) => (
            <FlowEventRow key={node.id} node={node} index={index} speed={rowAnimationSpeed} />
          ))}
        </FlowAnimationList>

        {!snapshot && steps.length === 0 && (
          <div className="border-l-2 border-surface-600 bg-surface-800 px-3 py-4 text-center text-xs text-text-muted radius-sm">
            当前对象暂无可展开关系
          </div>
        )}
        {!snapshot && steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border-l-2 border-accent bg-surface-800 text-[10px] font-bold text-accent radius-sm">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1 border-l-2 border-surface-600 bg-surface-800 px-3 py-2 radius-sm">
              <div className="flex items-center gap-2">
                <StepIcon kind={step.kind} />
                <span className="truncate text-xs font-bold text-text-primary">{step.label}</span>
                <span className="ml-auto text-[10px] text-text-muted">{getLinkSummary(step, links)}</span>
              </div>
              <div className="mt-1 text-[10px] text-text-muted">{step.kind} - depth {step.depth}</div>
            </div>
          </div>
        ))}
      </div>

      {exportResult && (
        <pre data-testid="flow-export-result" className="mx-3 mb-3 max-h-32 overflow-auto border border-surface-700 bg-surface-950 p-2 text-[10px] text-text-muted radius-sm">
          {exportResult.content}
        </pre>
      )}
    </div>
  )
})
