import { memo } from 'react'
import { FolderIcon } from '../../icons'

interface ThumbnailGroupHeaderProps {
  id: string
  label: string
  count: number
}

export const ThumbnailGroupHeader = memo(function ThumbnailGroupHeader({
  id,
  label,
  count
}: ThumbnailGroupHeaderProps) {
  return (
    <div
      data-testid={`thumbnail-group-header-${id}`}
      className="flex items-center gap-2 border-l-3 border-accent bg-surface-900/80 px-3 py-2 radius-sm"
    >
      <FolderIcon size={14} className="text-accent" />
      <span className="min-w-0 truncate text-xs font-bold uppercase tracking-wider text-text-primary">
        {label}
      </span>
      <span className="ml-auto bg-surface-800 px-2 py-0.5 font-mono text-[10px] text-text-muted radius-sm">
        {count}
      </span>
    </div>
  )
})
