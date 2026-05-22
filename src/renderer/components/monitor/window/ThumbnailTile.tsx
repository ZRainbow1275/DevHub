import { memo, useCallback, type FocusEventHandler, type KeyboardEvent, type MouseEvent } from 'react'
import type { WindowInfo, WindowOperationKind } from '@shared/types-extended'
import type { ThumbnailWallEntry } from '@shared/schemas/r8-runtime'
import type { WindowSelectionGesture } from '../../../hooks/useBatchSelection'
import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  MinimizeIcon,
  WindowIcon
} from '../../icons'
import { TruncatedText } from '../../ui/TruncatedText'
import { VdMonitorBadge } from './VdMonitorBadge'

interface ThumbnailTileProps {
  entry: ThumbnailWallEntry
  windowInfo: WindowInfo
  width: number
  height: number
  isSelected: boolean
  isChecked: boolean
  onSelectWindow: (hwnd: number) => void
  onToggleWindowSelection: (hwnd: number, gesture?: WindowSelectionGesture) => void
  onRunOperation: (kind: WindowOperationKind, windowInfo: WindowInfo) => void
  tabIndex?: number
  'data-roving-item'?: string
  onFocus?: FocusEventHandler<HTMLDivElement>
}

export const ThumbnailTile = memo(function ThumbnailTile({
  entry,
  windowInfo,
  width,
  height,
  isSelected,
  isChecked,
  onSelectWindow,
  onToggleWindowSelection,
  onRunOperation,
  tabIndex,
  'data-roving-item': dataRovingItem,
  onFocus
}: ThumbnailTileProps) {
  const handleTileClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      onToggleWindowSelection(entry.hwnd, {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        toggle: event.ctrlKey || event.metaKey
      })
      return
    }
    onSelectWindow(entry.hwnd)
    onRunOperation('focus', windowInfo)
  }, [entry.hwnd, onRunOperation, onSelectWindow, onToggleWindowSelection, windowInfo])

  const runOperation = useCallback((kind: WindowOperationKind) => {
    onRunOperation(kind, windowInfo)
  }, [onRunOperation, windowInfo])

  const handleTileKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSelectWindow(entry.hwnd)
      onRunOperation('focus', windowInfo)
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      onToggleWindowSelection(entry.hwnd)
    }
  }, [entry.hwnd, onRunOperation, onSelectWindow, onToggleWindowSelection, windowInfo])

  return (
    <div
      data-testid={`thumbnail-tile-${entry.hwnd}`}
      data-window-selection-hwnd={entry.hwnd}
      data-roving-item={dataRovingItem}
      data-thumbnail-stale={entry.isStale ? 'true' : 'false'}
      data-thumbnail-group={entry.groupId ?? ''}
      onClick={handleTileClick}
      onFocus={onFocus}
      onKeyDown={handleTileKeyDown}
      tabIndex={tabIndex}
      role="option"
      aria-selected={isSelected}
      className={`group relative flex flex-col overflow-hidden border-l-3 bg-surface-900 transition-all duration-200 radius-sm ${
        isSelected
          ? 'border-accent shadow-lg shadow-accent/10'
          : isChecked
            ? 'border-success'
            : 'border-surface-600 hover:border-accent/70'
      }`}
      style={{ width, minHeight: height + 96 }}
      title={`${entry.title} / HWND ${entry.hwnd}`}
    >
      <div
        className="relative flex items-center justify-center overflow-hidden bg-surface-950"
        style={{ height }}
      >
        {entry.thumbnailDataUrl ? (
          <img
            alt={entry.title}
            src={entry.thumbnailDataUrl}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 border border-dashed border-surface-700 bg-surface-900/70">
            <WindowIcon size={28} className="text-text-muted" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              no-capture
            </span>
          </div>
        )}
        <button
          type="button"
          data-testid={`thumbnail-select-${entry.hwnd}`}
          onClick={(event) => {
            event.stopPropagation()
            onToggleWindowSelection(entry.hwnd, {
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey,
              toggle: true
            })
          }}
          className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center border-2 transition-all radius-sm ${
            isChecked ? 'bg-success border-success text-white' : 'bg-surface-950/80 border-surface-500 text-transparent hover:border-accent'
          }`}
          title="选择窗口"
        >
          <CheckIcon size={12} />
        </button>
        {entry.isStale && (
          <span className="absolute right-2 top-2 bg-warning/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning radius-sm">
            stale
          </span>
        )}
        <VdMonitorBadge
          hwnd={entry.hwnd}
          desktopId={entry.desktopId}
          monitorId={entry.monitorId}
          isOnCurrentDesktop={entry.desktopId === null}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        <div className="min-w-0">
          <TruncatedText
            text={entry.alias ?? entry.title}
            className="text-xs font-semibold text-text-primary"
            maxChars={42}
            enableMarquee
          />
          {entry.alias && (
            <TruncatedText
              text={entry.title}
              className="mt-0.5 text-[10px] text-text-muted"
              maxChars={42}
              enableMarquee
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] text-text-muted">
          <span className="truncate">PID {entry.pid}</span>
          <span className="truncate">HWND {entry.hwnd}</span>
          <span className="truncate">{entry.exe}</span>
          <span className="truncate">{windowInfo.rect.width}x{windowInfo.rect.height}</span>
        </div>
        <div className="mt-auto grid grid-cols-4 gap-1" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn-icon-sm" title="聚焦窗口" onClick={() => runOperation('focus')}>
            <EyeIcon size={13} />
          </button>
          <button type="button" className="btn-icon-sm" title="最小化窗口" onClick={() => runOperation('minimize')}>
            <MinimizeIcon size={13} />
          </button>
          <button type="button" className="btn-icon-sm" title="窗口截图" onClick={() => runOperation('screenshot')}>
            <DownloadIcon size={13} />
          </button>
          <button type="button" className="btn-icon-sm text-error" title="关闭窗口" onClick={() => runOperation('close')}>
            <CloseIcon size={13} />
          </button>
        </div>
      </div>
    </div>
  )
})
