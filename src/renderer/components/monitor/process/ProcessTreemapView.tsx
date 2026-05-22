import { type KeyboardEvent, type MouseEvent, useMemo, useRef, useState } from 'react'
import type { ProcessInfo } from '@shared/types-extended'
import type { ProcessTag, TreemapLayout, TreemapNode } from '@shared/schemas/r8-runtime'
import { useContainerSize } from '../../../hooks/useContainerSize'
import { useProcessTreemap } from '../../../hooks/useProcessTreemap'
import { formatBytes } from '../../../utils/formatNumber'
import { processTagColorValue } from './ProcessTagBadge'

const SVG_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}
const TREEMAP_LABEL_LIMIT = 80

function escapeSvg(value: string): string {
  return value.replace(/[&<>"']/g, character => SVG_ESCAPE_MAP[character] ?? character)
}

function processFallbackForNode(node: TreemapNode): ProcessInfo {
  return {
    command: '',
    cpu: 0,
    memory: node.value,
    name: node.exe,
    pid: node.pid,
    startTime: 0,
    status: 'running',
    type: 'other'
  }
}

function tileFill(node: TreemapNode, tag: ProcessTag | undefined, colorBy: TreemapLayout['colorBy']): string {
  const tagColor = tag ? processTagColorValue(tag.color) : undefined
  if (colorBy === 'tag' && tagColor) return `color-mix(in srgb, ${tagColor} 48%, transparent)`
  if (node.color?.startsWith('hsl(')) return node.color
  if (node.color === 'warning') return 'rgba(245, 158, 11, 0.45)'
  return 'rgba(56, 189, 248, 0.35)'
}

function treemapTileMarkup({
  colorBy,
  node,
  selected,
  showLabel,
  tag
}: {
  colorBy: TreemapLayout['colorBy']
  node: TreemapNode
  selected: boolean
  showLabel: boolean
  tag?: ProcessTag
}): string {
  const width = Math.max(0, node.x1 - node.x0)
  const height = Math.max(0, node.y1 - node.y0)
  if (width < 1 || height < 1) return ''

  const fill = escapeSvg(tileFill(node, tag, colorBy))
  const stroke = selected ? 'var(--color-accent)' : 'rgba(255,255,255,0.16)'
  const strokeWidth = selected ? 3 : 1
  const label = escapeSvg(node.exe)
  const subtitle = showLabel ? escapeSvg(tag ? `${tag.tag} / ${formatBytes(node.value)}` : formatBytes(node.value)) : ''
  const textMarkup = showLabel
    ? `<text class="fill-text-primary text-[11px] font-semibold" x="${node.x0 + 6}" y="${node.y0 + 16}">${label}</text><text class="fill-text-muted text-[10px]" x="${node.x0 + 6}" y="${node.y0 + 30}">${subtitle}</text>`
    : ''

  return `<g aria-label="${label} PID ${node.pid}" data-testid="treemap-tile-${node.pid}" data-treemap-pid="${node.pid}" role="button" tabindex="0"><rect fill="${fill}" height="${height}" stroke="${stroke}" stroke-width="${strokeWidth}" width="${width}" x="${node.x0}" y="${node.y0}"></rect>${textMarkup}</g>`
}

function canRenderTreemapLabel(node: TreemapNode): boolean {
  return node.x1 - node.x0 > 72 && node.y1 - node.y0 > 34
}

function pidFromTarget(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null
  const tileElement = target.closest('[data-treemap-pid]')
  if (!tileElement) return null
  const pid = Number(tileElement.getAttribute('data-treemap-pid'))
  return Number.isSafeInteger(pid) ? pid : null
}

export function ProcessTreemapView({
  processes,
  selectedPid,
  onSelectProcess,
  onShowDetail,
  getProcessTag
}: {
  processes: ProcessInfo[]
  selectedPid: number | null
  onSelectProcess: (pid: number | null) => void
  onShowDetail: (pid: number) => void
  getProcessTag?: (process: ProcessInfo) => ProcessTag | undefined
}) {
  const [groupBy, setGroupBy] = useState<TreemapLayout['groupBy']>('parent')
  const [colorBy, setColorBy] = useState<TreemapLayout['colorBy']>('exe')
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useContainerSize(containerRef)
  const width = Math.max(320, size.width || 960)
  const height = Math.max(240, size.height || 540)
  const layout = useProcessTreemap(processes, width, height, groupBy, colorBy)
  const processByPid = useMemo(() => new Map(processes.map(process => [process.pid, process])), [processes])
  const tileMarkup = useMemo(() => {
    let renderedLabels = 0

    return layout.nodes.map(node => {
      const showLabel = renderedLabels < TREEMAP_LABEL_LIMIT && canRenderTreemapLabel(node)
      if (showLabel) renderedLabels += 1

      return treemapTileMarkup({
        colorBy,
        node,
        selected: selectedPid === node.pid,
        showLabel,
        tag: getProcessTag?.(processByPid.get(node.pid) ?? processFallbackForNode(node))
      })
    }).join('')
  }, [colorBy, getProcessTag, layout.nodes, processByPid, selectedPid])
  const activateTile = (pid: number) => {
    onSelectProcess(pid)
    onShowDetail(pid)
  }
  const onTreemapClick = (event: MouseEvent<SVGSVGElement>) => {
    const pid = pidFromTarget(event.target)
    if (pid !== null) activateTile(pid)
  }
  const onTreemapKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const pid = pidFromTarget(event.target)
    if (pid === null) return
    event.preventDefault()
    activateTile(pid)
  }

  return (
    <div className="h-full overflow-hidden" ref={containerRef} data-testid="process-treemap">
      <div className="flex items-center justify-between gap-3 border-b border-surface-700 bg-surface-900 px-3 py-2">
        <div className="text-xs text-text-muted">
          RSS proportional tiles: {layout.nodes.length} / {processes.length}{layout.truncated ? '，已截断 Top 500' : ''}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select className="bg-surface-800 px-2 py-1 text-text-secondary" value={groupBy} onChange={event => setGroupBy(event.target.value as TreemapLayout['groupBy'])}>
            <option value="parent">parent</option>
            <option value="exe">exe</option>
            <option value="ai-tool">ai-tool</option>
            <option value="none">none</option>
          </select>
          <select className="bg-surface-800 px-2 py-1 text-text-secondary" value={colorBy} onChange={event => setColorBy(event.target.value as TreemapLayout['colorBy'])}>
            <option value="exe">exe</option>
            <option value="rss">rss</option>
            <option value="cpu">cpu</option>
            <option value="ai-tool">ai-tool</option>
            <option value="tag">tag</option>
          </select>
        </div>
      </div>
      <svg
        className="h-[calc(100%-37px)] w-full bg-surface-950"
        height={height}
        onClick={onTreemapClick}
        onKeyDown={onTreemapKeyDown}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <g dangerouslySetInnerHTML={{ __html: tileMarkup }} />
      </svg>
    </div>
  )
}
