import { randomUUID } from 'node:crypto'
import { flowExportResultSchema, flowSnapshotSchema, type FlowExportResult, type FlowFilter, type FlowNode, type FlowRequest, type FlowSnapshot, type FlowStats } from '@shared/schemas/flow'
import type { AuditEntry } from '../AuditLogger'
import { FlowEventCollector, type FlowEventCollectorOptions, type FlowRecordingSource, type FlowTaskLike } from './FlowEventCollector'
import { FlowWindowSelector, type FlowWindowSelection } from './FlowWindowSelector'

export interface FlowBuildSources {
  tasks: FlowTaskLike[]
  csvSessions: Record<string, unknown>[]
  recordings?: FlowRecordingSource[]
  auditEntries?: AuditEntry[]
}

export interface FlowBuilderOptions {
  collector?: FlowEventCollector
  collectorOptions?: FlowEventCollectorOptions
}

const NODE_LIMIT = 500

function flowNodeSeverity(node: FlowNode): 'INFO' | 'WARN' | 'ERROR' {
  if (node.kind === 'task-fail' || node.errorCode !== null) return 'ERROR'
  if (node.kind === 'task-retry' || node.kind === 'watchdog-action') return 'WARN'
  return 'INFO'
}

function severityAtLeast(actual: 'INFO' | 'WARN' | 'ERROR', minimum: 'INFO' | 'WARN' | 'ERROR' | 'FATAL'): boolean {
  const order: Record<'INFO' | 'WARN' | 'ERROR' | 'FATAL', number> = { INFO: 0, WARN: 1, ERROR: 2, FATAL: 3 }
  return order[actual] >= order[minimum]
}

function flowStats(nodes: FlowNode[]): FlowStats {
  const durations = nodes.map(node => node.durationMs ?? 0).filter(value => value > 0).sort((left, right) => left - right)
  const totalDuration = durations.reduce((total, value) => total + value, 0)
  const p95Index = durations.length === 0 ? 0 : Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)
  return {
    totalEvents: nodes.length,
    failCount: nodes.filter(node => node.kind === 'task-fail').length,
    retryCount: nodes.filter(node => node.kind === 'task-retry').length,
    avgDurationMs: durations.length === 0 ? 0 : Math.round(totalDuration / durations.length),
    p95DurationMs: durations[p95Index] ?? 0
  }
}

function mermaidParticipant(node: FlowNode): string {
  return (node.taskId ?? node.sessionId ?? node.instanceId ?? node.id).replace(/[^a-zA-Z0-9_]/g, '_')
}

function sourceLabel(sources: FlowBuildSources): FlowSnapshot['source'] {
  if ((sources.recordings?.length ?? 0) > 0 || (sources.auditEntries?.length ?? 0) > 0) return sources.tasks.length > 0 || sources.csvSessions.length > 0 ? 'mixed' : 'recording-audit'
  return 'task-queue'
}

export class FlowBuilder {
  private readonly collector: FlowEventCollector

  constructor(private readonly windowSelector = new FlowWindowSelector(), options: FlowBuilderOptions = {}) {
    this.collector = options.collector ?? new FlowEventCollector(options.collectorOptions)
  }

  selectWindow(request: FlowRequest): FlowWindowSelection {
    return this.windowSelector.select(request)
  }

  build(request: FlowRequest, sources: FlowBuildSources): FlowSnapshot {
    const window = this.windowSelector.select(request)
    const sourceNodes = [
      ...this.collector.collectTaskNodes(sources.tasks),
      ...this.collector.collectCsvNodes(sources.csvSessions, window.toTs),
      ...this.collector.collectRecordingNodes(sources.recordings ?? []),
      ...this.collector.collectAuditNodes(sources.auditEntries ?? [])
    ]
    this.collector.indexNodes(sourceNodes, window.toTs)
    return this.snapshot(request, window, this.collector.queryIndexedNodes(window.fromTs, window.toTs), sourceLabel(sources))
  }

  exportSnapshot(snapshot: FlowSnapshot, format: 'mermaid-sequence' | 'svg'): FlowExportResult {
    if (format === 'svg') {
      const rows = snapshot.nodes.map((node, index) => `<text x="16" y="${24 + index * 18}">${escapeXml(node.label)}</text>`).join('')
      return flowExportResultSchema.parse({ content: `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${Math.max(64, 48 + snapshot.nodes.length * 18)}">${rows}</svg>`, mimeType: 'image/svg+xml', encoding: 'utf8' })
    }

    const participants = [...new Set(snapshot.nodes.map(mermaidParticipant))].map(id => `    participant ${id}`).join('\n')
    const messages = snapshot.edges.map(edge => {
      const source = snapshot.nodes.find(node => node.id === edge.source)
      const target = snapshot.nodes.find(node => node.id === edge.target)
      if (!source || !target) return null
      const arrow = edge.kind === 'fails' ? '-x' : '->>'
      return `    ${mermaidParticipant(source)}${arrow}${mermaidParticipant(target)}: ${target.label}`
    }).filter((line): line is string => line !== null).join('\n')
    return flowExportResultSchema.parse({ content: `sequenceDiagram
${participants}
${messages}
`, mimeType: 'text/vnd.mermaid', encoding: 'utf8' })
  }

  close(): void {
    this.collector.close()
  }

  private snapshot(request: FlowRequest, window: FlowWindowSelection, nodes: FlowNode[], source: FlowSnapshot['source']): FlowSnapshot {
    const windowed = nodes
      .filter(node => node.ts >= window.fromTs && node.ts <= window.toTs)
      .filter(node => node.ts <= window.cursorTs)
    const scoped = windowed.filter(node => matchesScope(node, request))
    const scopeFiltered = scoped.length > 0 ? scoped : windowed
    const filtered = scopeFiltered
      .filter(node => matchesFilter(node, request.filter ?? {}))
      .sort((left, right) => left.ts - right.ts || left.id.localeCompare(right.id))

    const truncated = filtered.length > NODE_LIMIT
    const limited = truncated ? filtered.slice(-NODE_LIMIT) : filtered
    const nodeIds = new Set(limited.map(node => node.id))
    const edges = limited.slice(1).map((node, index) => {
      const previous = limited[index]
      return {
        id: `flow-edge-${previous.id}-${node.id}`,
        kind: node.kind === 'task-fail' ? 'fails' as const : node.kind === 'task-retry' ? 'retries' as const : 'happens-before' as const,
        source: previous.id,
        target: node.id,
        durationMs: Math.max(0, node.ts - previous.ts)
      }
    }).filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))

    return flowSnapshotSchema.parse({
      snapshotId: randomUUID(),
      generatedAt: Date.now(),
      windowMs: truncated && limited.length > 0 ? Math.max(0, window.toTs - limited[0].ts) : window.windowMs,
      fromTs: truncated && limited.length > 0 ? limited[0].ts : window.fromTs,
      toTs: window.toTs,
      nodes: limited,
      edges,
      stats: flowStats(limited),
      truncated,
      warnings: truncated ? [{ code: 'E_GRAPH_NODE_LIMIT', message: `Flow window was narrowed to the most recent ${NODE_LIMIT} events.` }] : [],
      speed: request.speed,
      source
    })
  }
}

function matchesFilter(node: FlowNode, filter: FlowFilter): boolean {
  if (filter.kinds && !filter.kinds.includes(node.kind)) return false
  if (filter.taskIds && (node.taskId === null || !filter.taskIds.includes(node.taskId))) return false
  if (filter.tools && (node.instanceId === null || !filter.tools.some(tool => tool === node.instanceId))) return false
  if (filter.minErrorLevel && !severityAtLeast(flowNodeSeverity(node), filter.minErrorLevel)) return false
  return true
}

function matchesScope(node: FlowNode, request: FlowRequest): boolean {
  const target = request.targetId === undefined ? request.rootId : String(request.targetId)
  if (!target || request.scope === 'runtime' || request.scope === 'global') return true
  const normalizedRoot = request.rootId ?? `${request.scope}-${target}`
  return node.taskId === target || node.sessionId === target || node.instanceId === target || node.id.includes(normalizedRoot) || node.id.includes(target)
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, char => {
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '&') return '&amp;'
    if (char === '"') return '&quot;'
    return '&apos;'
  })
}
