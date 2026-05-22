import type { MouseEvent } from 'react'
import { NetworkIcon } from '../icons'

interface CardEdgeGraphBadgeProps {
  testId: string
  graphEntry: string
  scopeKind: 'process' | 'port' | 'window'
  targetId: string | number
  ariaLabel: string
  onClick: () => void
  className?: string
}

export function CardEdgeGraphBadge({
  testId,
  graphEntry,
  scopeKind,
  targetId,
  ariaLabel,
  onClick,
  className = ''
}: CardEdgeGraphBadgeProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onClick()
  }

  return (
    <button
      type="button"
      data-testid={testId}
      data-graph-entry={graphEntry}
      data-graph-kind="attached"
      data-graph-scope={scopeKind}
      data-graph-target-id={String(targetId)}
      aria-label={ariaLabel}
      title="查看关系图"
      onClick={handleClick}
      className={`absolute top-3 right-3 z-20 flex h-7 w-7 items-center justify-center border border-surface-700 bg-surface-950/90 text-text-muted shadow-sm transition-all duration-200 hover:border-accent hover:bg-accent/15 hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent radius-sm ${className}`}
    >
      <NetworkIcon size={14} />
      <span className="sr-only">查看关系图</span>
    </button>
  )
}
