import { useState } from 'react'
import type { ProcessTag, ProcessTreeNode as ProcessTreeNodeModel } from '@shared/schemas/r8-runtime'
import { ChevronDownIcon, TreeIcon } from '../../icons'
import { formatBytes } from '../../../utils/formatNumber'
import { ProcessTagBadge } from './ProcessTagBadge'

export function flattenTree(node: ProcessTreeNodeModel, expanded: Set<number>): ProcessTreeNodeModel[] {
  const rows = [node]
  if (node.children.length > 0 && (node.expanded || expanded.has(node.pid))) {
    for (const child of node.children) rows.push(...flattenTree(child, expanded))
  }
  return rows
}

export function ProcessTreeNode({
  node,
  tag,
  selected,
  loadingChildren = false,
  childLoadError,
  hasLazyChildren = false,
  onToggle,
  onSelect,
  onShowDetail
}: {
  node: ProcessTreeNodeModel
  tag?: ProcessTag
  selected: boolean
  loadingChildren?: boolean
  childLoadError?: string
  hasLazyChildren?: boolean
  onToggle: (pid: number) => void
  onSelect: (pid: number) => void
  onShowDetail: (pid: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const hasChildren = node.children.length > 0 || hasLazyChildren

  return (
    <div
      className={`grid grid-cols-[minmax(240px,1fr)_120px_90px_120px_96px] items-center gap-3 border-b border-surface-800 px-3 py-2 text-xs ${selected ? 'bg-accent/10 text-accent' : hovered ? 'bg-surface-800/60 text-text-primary' : 'text-text-secondary'}`}
      data-testid={`tree-node-${node.pid}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        className="flex min-w-0 items-center gap-2 text-left"
        onClick={() => {
          onSelect(node.pid)
          onShowDetail(node.pid)
        }}
        style={{ paddingLeft: `${Math.min(node.depth, 8) * 14}px` }}
        type="button"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center text-text-muted">
          {hasChildren ? (
            <span data-testid="tree-expand" onClick={(event) => { event.stopPropagation(); onToggle(node.pid) }}>
              <ChevronDownIcon size={14} className={node.expanded ? '' : '-rotate-90'} />
            </span>
          ) : (
            <TreeIcon size={14} />
          )}
        </span>
        <span className="truncate font-medium">{node.exe}</span>
      </button>
      <ProcessTagBadge compact tag={tag} />
      <span className="tabular-nums text-text-muted">{node.pid}</span>
      <span className="tabular-nums text-text-muted">{formatBytes(node.rss)}</span>
      <span className={node.isAiTool ? 'text-warning' : childLoadError ? 'text-error' : 'text-text-muted'}>
        {loadingChildren ? '加载中' : childLoadError ? '子节点失败' : node.isAiTool ? 'AI' : `${node.cpu.toFixed(1)}%`}
      </span>
    </div>
  )
}
