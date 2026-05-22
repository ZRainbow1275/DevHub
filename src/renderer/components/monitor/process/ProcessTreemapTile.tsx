import type { KeyboardEvent } from 'react'
import type { ProcessTag, TreemapLayout, TreemapNode } from '@shared/schemas/r8-runtime'
import { formatBytes } from '../../../utils/formatNumber'
import { processTagColorValue } from './ProcessTagBadge'

export function ProcessTreemapTile({
  node,
  tag,
  colorBy,
  selected,
  onSelect,
  onShowDetail
}: {
  node: TreemapNode
  tag?: ProcessTag
  colorBy: TreemapLayout['colorBy']
  selected: boolean
  onSelect: (pid: number) => void
  onShowDetail: (pid: number) => void
}) {
  const width = Math.max(0, node.x1 - node.x0)
  const height = Math.max(0, node.y1 - node.y0)
  const tagColor = tag ? processTagColorValue(tag.color) : undefined
  const fill = colorBy === 'tag' && tagColor
    ? `color-mix(in srgb, ${tagColor} 48%, transparent)`
    : node.color?.startsWith('hsl(') ? node.color : node.color === 'warning' ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.35)'
  if (width < 1 || height < 1) return null
  const tileLabel = tag
    ? `${node.exe} PID ${node.pid}，标签 ${tag.tag}，内存 ${formatBytes(node.value)}`
    : `${node.exe} PID ${node.pid}，内存 ${formatBytes(node.value)}`
  const activateTile = () => {
    onSelect(node.pid)
    onShowDetail(node.pid)
  }
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    activateTile()
  }

  return (
    <g
      data-testid={`treemap-tile-${node.pid}`}
      aria-label={tileLabel}
      aria-pressed={selected}
      onClick={activateTile}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <rect
        fill={fill}
        height={height}
        stroke={selected ? 'var(--color-accent)' : 'rgba(255,255,255,0.16)'}
        strokeWidth={selected ? 3 : 1}
        width={width}
        x={node.x0}
        y={node.y0}
      />
      {width > 72 && height > 34 ? (
        <>
          <text className="fill-text-primary text-[11px] font-semibold" x={node.x0 + 6} y={node.y0 + 16}>{node.exe}</text>
          <text className="fill-text-muted text-[10px]" x={node.x0 + 6} y={node.y0 + 30}>{tag ? `${tag.tag} / ${formatBytes(node.value)}` : formatBytes(node.value)}</text>
        </>
      ) : null}
    </g>
  )
}
