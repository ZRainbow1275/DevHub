import { memo, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { WindowInfo, WindowOperationKind } from '@shared/types-extended'
import type { ThumbnailWallEntry } from '@shared/schemas/r8-runtime'
import type { WindowSelectionGesture } from '../../../hooks/useBatchSelection'
import { THUMBNAIL_LIMITS } from '@shared/schemas/r8-runtime'
import { useThumbnailViewport } from '../../../hooks/useThumbnailViewport'
import { useWindowThumbnails } from '../../../hooks/useWindowThumbnails'
import {
  groupThumbnailWallEntries,
  type ThumbnailEntryGroup
} from '../../../utils/windowGroupKey'
import { SearchIcon } from '../../icons'
import { KeyboardNavGroup } from '../../a11y/KeyboardNavGroup'
import { ThumbnailGroupHeader } from './ThumbnailGroupHeader'
import { ThumbnailTile } from './ThumbnailTile'
import { WallToolbar } from './WallToolbar'

interface ThumbnailWallProps {
  windows: readonly WindowInfo[]
  selectedHwnd: number | null
  selectedWindows: Set<number>
  getDisplayName: (windowInfo: WindowInfo) => string
  onSelectWindow: (hwnd: number) => void
  onToggleWindowSelection: (hwnd: number, gesture?: WindowSelectionGesture) => void
  onRunOperation: (kind: WindowOperationKind, windowInfo: WindowInfo) => void
}

interface HeaderRow {
  kind: 'header'
  group: ThumbnailEntryGroup
}

interface TileRow {
  kind: 'tiles'
  groupId: string
  entries: ThumbnailWallEntry[]
}

type WallRow = HeaderRow | TileRow

interface RenderedRow {
  key: string | number
  index: number
  start: number
  size: number
}

interface ThumbnailWallEmptyStateProps {
  title: string
  description: string
}

const ThumbnailWallEmptyState = memo(function ThumbnailWallEmptyState({
  title,
  description
}: ThumbnailWallEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center border-l-3 border-surface-600 bg-surface-800 radius-md">
        <SearchIcon size={40} className="text-text-muted" />
      </div>
      <p
        className="font-bold uppercase tracking-wider text-text-secondary"
        style={{ fontFamily: 'var(--font-display)', fontSize: '14px' }}
      >
        {title}
      </p>
      <p className="mt-1 text-xs text-text-muted">{description}</p>
    </div>
  )
})

function entryMatchesFilter(entry: ThumbnailWallEntry, filterText: string): boolean {
  const query = filterText.trim().toLowerCase()
  if (!query) return true
  return [
    entry.title,
    entry.exe,
    entry.alias ?? '',
    String(entry.hwnd),
    String(entry.pid)
  ].some(value => value.toLowerCase().includes(query))
}

function buildRows(groups: readonly ThumbnailEntryGroup[], columns: number): WallRow[] {
  const rows: WallRow[] = []
  for (const group of groups) {
    rows.push({ kind: 'header', group })
    for (let index = 0; index < group.entries.length; index += columns) {
      rows.push({ kind: 'tiles', groupId: group.id, entries: group.entries.slice(index, index + columns) })
    }
  }
  return rows
}

function rowHeight(row: WallRow | undefined, tileHeight: number, gap: number): number {
  if (!row) return tileHeight + gap
  return row.kind === 'header' ? 42 : tileHeight + gap + 96
}

function fallbackRows(rows: readonly WallRow[], tileHeight: number, gap: number): RenderedRow[] {
  let cursor = 0
  return rows.map((row, index) => {
    const size = rowHeight(row, tileHeight, gap)
    const rendered = { key: `fallback-${index}`, index, start: cursor, size }
    cursor += size
    return rendered
  })
}

export const ThumbnailWall = memo(function ThumbnailWall({
  windows,
  selectedHwnd,
  selectedWindows,
  getDisplayName,
  onSelectWindow,
  onToggleWindowSelection,
  onRunOperation
}: ThumbnailWallProps) {
  const {
    containerRef,
    viewport,
    setViewport,
    tileSize,
    columns,
    gap
  } = useThumbnailViewport()

  const windowByHwnd = useMemo(() => new Map(windows.map(windowInfo => [windowInfo.hwnd, windowInfo])), [windows])
  const entries = useWindowThumbnails({
    windows,
    viewport,
    thumbnailSize: tileSize,
    getDisplayName
  })
  const visibleEntries = useMemo(
    () => entries.filter(entry => entryMatchesFilter(entry, viewport.filterText)),
    [entries, viewport.filterText]
  )
  const groups = useMemo(
    () => groupThumbnailWallEntries(visibleEntries, viewport.groupBy),
    [visibleEntries, viewport.groupBy]
  )
  const rows = useMemo(() => buildRows(groups, columns), [columns, groups])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => rowHeight(rows[index], tileSize.height, gap),
    overscan: 6
  })

  const virtualRows: RenderedRow[] = rowVirtualizer.getVirtualItems().map(item => ({
    key: String(item.key),
    index: item.index,
    start: item.start,
    size: item.size
  }))
  const renderedRows = virtualRows.length > 0 ? virtualRows : fallbackRows(rows, tileSize.height, gap)
  const totalSize = rowVirtualizer.getTotalSize() || renderedRows.reduce((sum, row) => sum + row.size, 0)

  return (
    <div
      data-testid="thumbnail-wall"
      data-r8b-thumbnail-wall="true"
      data-virtualized={windows.length >= THUMBNAIL_LIMITS.LAZY_THRESHOLD ? 'true' : 'ready'}
      data-zoom-level={viewport.zoomLevel}
      className="h-full min-h-[520px]"
    >
      <WallToolbar
        viewport={viewport}
        totalCount={windows.length}
        visibleCount={visibleEntries.length}
        selectedCount={selectedWindows.size}
        onViewportChange={setViewport}
      />
      {rows.length === 0 ? (
        <ThumbnailWallEmptyState
          title="未找到窗口"
          description={viewport.filterText ? '尝试其他缩略图过滤条件' : '系统中没有可用窗口'}
        />
      ) : (
        <div
          ref={containerRef}
          className="relative h-[calc(100vh-360px)] min-h-[420px] overflow-auto border border-surface-800 bg-surface-950/70 p-2 radius-sm"
        >
          <div
            className="relative"
            style={{ height: totalSize }}
          >
            {renderedRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              if (!row) return null
              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 top-0 w-full"
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  {row.kind === 'header' ? (
                    <ThumbnailGroupHeader
                      id={row.group.id}
                      label={row.group.label}
                      count={row.group.entries.length}
                    />
                  ) : (
                    <KeyboardNavGroup
                      ariaLabel={`窗口缩略图组 ${row.groupId}`}
                      role="listbox"
                      orientation="both"
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${columns}, ${tileSize.width}px)`,
                        gap
                      }}
                    >
                      {row.entries.map((entry) => {
                        const windowInfo = windowByHwnd.get(entry.hwnd)
                        if (!windowInfo) return null
                        return (
                          <ThumbnailTile
                            key={entry.hwnd}
                            entry={entry}
                            windowInfo={windowInfo}
                            width={tileSize.width}
                            height={tileSize.height}
                            isSelected={selectedHwnd === entry.hwnd}
                            isChecked={selectedWindows.has(entry.hwnd)}
                            onSelectWindow={onSelectWindow}
                            onToggleWindowSelection={onToggleWindowSelection}
                            onRunOperation={onRunOperation}
                          />
                        )
                      })}
                    </KeyboardNavGroup>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})
