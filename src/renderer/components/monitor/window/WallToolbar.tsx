import { memo } from 'react'
import {
  thumbnailWallViewportSchema,
  type ThumbnailWallViewport
} from '@shared/schemas/r8-runtime'
import { GridIcon, RefreshIcon, SearchIcon } from '../../icons'

interface WallToolbarProps {
  viewport: ThumbnailWallViewport
  totalCount: number
  visibleCount: number
  selectedCount: number
  onViewportChange: (viewport: ThumbnailWallViewport) => void
}

const ZOOM_OPTIONS: Array<{ value: ThumbnailWallViewport['zoomLevel']; label: string }> = [
  { value: 'xs', label: 'XS' },
  { value: 'sm', label: 'SM' },
  { value: 'md', label: 'MD' },
  { value: 'lg', label: 'LG' }
]

const GROUP_OPTIONS: Array<{ value: ThumbnailWallViewport['groupBy']; label: string }> = [
  { value: 'group', label: '实例分组' },
  { value: 'monitor', label: '显示器' },
  { value: 'desktop', label: '虚拟桌面' },
  { value: 'exe', label: '进程' },
  { value: 'none', label: '不分组' }
]

const REFRESH_OPTIONS = [2000, 5000, 15000, 30000, 60000]

export const WallToolbar = memo(function WallToolbar({
  viewport,
  totalCount,
  visibleCount,
  selectedCount,
  onViewportChange
}: WallToolbarProps) {
  const updateViewport = (patch: Partial<ThumbnailWallViewport>) => {
    onViewportChange(thumbnailWallViewportSchema.parse({ ...viewport, ...patch }))
  }

  return (
    <div
      data-testid="thumbnail-wall-toolbar"
      className="mb-3 flex flex-wrap items-center gap-2 border border-surface-700 bg-surface-900/80 p-2 radius-sm"
    >
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent">
        <GridIcon size={14} />
        缩略图墙
      </div>
      <div className="relative">
        <SearchIcon
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          data-testid="thumbnail-wall-filter"
          value={viewport.filterText}
          onChange={(event) => updateViewport({ filterText: event.target.value })}
          className="w-48 bg-surface-800 py-1.5 pl-8 pr-2 text-xs text-text-primary placeholder-text-muted outline-none border border-surface-700 focus:border-accent radius-sm"
          placeholder="过滤 title / exe / hwnd"
        />
      </div>
      <select
        data-testid="thumbnail-wall-groupby"
        value={viewport.groupBy}
        onChange={(event) => updateViewport({ groupBy: event.target.value as ThumbnailWallViewport['groupBy'] })}
        className="bg-surface-800 px-2 py-1.5 text-xs text-text-primary outline-none border border-surface-700 focus:border-accent radius-sm"
      >
        {GROUP_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <select
        data-testid="thumbnail-wall-zoom"
        value={viewport.zoomLevel}
        onChange={(event) => updateViewport({ zoomLevel: event.target.value as ThumbnailWallViewport['zoomLevel'] })}
        className="bg-surface-800 px-2 py-1.5 text-xs text-text-primary outline-none border border-surface-700 focus:border-accent radius-sm"
      >
        {ZOOM_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <div className="flex items-center gap-1 text-xs text-text-muted">
        <RefreshIcon size={13} />
        <select
          data-testid="thumbnail-wall-refresh"
          value={viewport.refreshIntervalMs}
          onChange={(event) => updateViewport({ refreshIntervalMs: Number(event.target.value) })}
          className="bg-surface-800 px-2 py-1.5 text-xs text-text-primary outline-none border border-surface-700 focus:border-accent radius-sm"
        >
          {REFRESH_OPTIONS.map((value) => (
            <option key={value} value={value}>{value / 1000}s</option>
          ))}
        </select>
      </div>
      <div className="ml-auto flex items-center gap-2 text-[11px] text-text-muted">
        <span data-testid="thumbnail-wall-visible-count">{visibleCount}/{totalCount} 可见</span>
        <span data-testid="thumbnail-wall-selected-count">已选 {selectedCount}</span>
      </div>
    </div>
  )
})
