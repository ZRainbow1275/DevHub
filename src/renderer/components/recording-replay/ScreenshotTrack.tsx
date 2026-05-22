import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { RecordingEvent, RecordingScreenshotResult } from '@shared/schemas/r8-runtime'
import { formatDuration } from './Timeline'

interface ScreenshotTrackProps {
  cursorTs: number
  events: RecordingEvent[]
  screenshot: RecordingScreenshotResult | null
  startedAtAbsTs: number
  onSeek: (cursorTs: number) => void
}

export function ScreenshotTrack({ cursorTs, events, onSeek, screenshot, startedAtAbsTs }: ScreenshotTrackProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const rows = events.filter((event): event is Extract<RecordingEvent, { kind: 'screenshot' }> => event.kind === 'screenshot')
  const columnVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 96,
    getItemKey: index => `${rows[index]?.ts ?? index}-${rows[index]?.filePath ?? 'screenshot'}`,
    getScrollElement: () => parentRef.current,
    horizontal: true,
    overscan: 6
  })

  return (
    <section className="border border-surface-800 bg-surface-950 p-3 radius-md" data-testid="screenshot-track">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-accent">
        <span>screenshot</span>
        <span>{formatDuration(cursorTs - startedAtAbsTs)}</span>
      </div>
      <div className="mb-2 h-10 max-w-full overflow-x-auto pb-1" ref={parentRef}>
        {rows.length === 0 ? <span className="text-xs text-text-muted">无截图事件</span> : (
          <div style={{ height: '100%', position: 'relative', width: `${columnVirtualizer.getTotalSize()}px` }}>
            {columnVirtualizer.getVirtualItems().map(virtualColumn => {
              const event = rows[virtualColumn.index]
              return (
                <button
                  className={event.ts <= cursorTs ? 'border border-accent bg-surface-900 text-accent radius-sm' : 'border border-surface-700 bg-surface-900 text-text-muted radius-sm'}
                  key={virtualColumn.key}
                  onClick={() => onSeek(event.ts)}
                  style={{ height: '32px', left: 0, position: 'absolute', top: 0, transform: `translateX(${virtualColumn.start}px)`, width: `${virtualColumn.size - 8}px` }}
                  type="button"
                >
                  <span className="block truncate px-2 py-1 text-xs">{formatDuration(event.ts - startedAtAbsTs)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {screenshot ? (
        <div className="border border-surface-800 bg-black/40 p-2 radius-sm">
          <img alt="Recorded task screenshot" className="max-h-56 w-full object-contain" src={toFileUrl(screenshot.filePath)} />
          <div className="mt-1 text-xs text-text-muted">{screenshot.width}x{screenshot.height} · {screenshot.sizeBytes} bytes</div>
        </div>
      ) : (
        <div className="border border-dashed border-surface-700 px-3 py-8 text-center text-xs text-text-muted radius-sm">原始截图文件不可用或该时间点未捕获截图</div>
      )}
    </section>
  )
}

function toFileUrl(filePath: string): string {
  return `file://${filePath.split(String.fromCharCode(92)).join('/')}`
}
