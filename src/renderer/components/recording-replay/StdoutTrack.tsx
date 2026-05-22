import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { RecordingEvent } from '@shared/schemas/r8-runtime'
import { formatDuration } from './Timeline'

interface StdoutTrackProps {
  cursorTs: number
  events: RecordingEvent[]
  startedAtAbsTs: number
}

export function StdoutTrack({ cursorTs, events, startedAtAbsTs }: StdoutTrackProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const rows = events
    .filter((event): event is Extract<RecordingEvent, { kind: 'stdout' }> => event.kind === 'stdout' && event.ts <= cursorTs)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 28,
    getItemKey: index => `${rows[index]?.ts ?? index}-${rows[index]?.type ?? 'stdout'}-${index}`,
    getScrollElement: () => parentRef.current,
    overscan: 10
  })

  useEffect(() => {
    if (rows.length > 0) rowVirtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
  }, [rowVirtualizer, rows.length])

  return (
    <section className="border border-surface-800 bg-surface-950 p-3 radius-md" data-testid="stdout-track-section">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-accent">
        <span>stdout</span>
        <span data-testid="stdout-cursor-ts">{cursorTs}</span>
      </div>
      <div className="h-56 overflow-y-auto bg-black/50 p-2 font-mono text-xs text-text-primary radius-sm" data-testid="stdout-track" ref={parentRef}>
        {rows.length === 0 ? <div className="text-text-muted">等待 stdout 事件</div> : (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const event = rows[virtualRow.index]
              return (
                <div
                  className="grid grid-cols-[4.5rem_1fr] gap-2"
                  key={virtualRow.key}
                  style={{ height: `${virtualRow.size}px`, left: 0, position: 'absolute', top: 0, transform: `translateY(${virtualRow.start}px)`, width: '100%' }}
                >
                  <span className="text-text-muted">{formatDuration(event.ts - startedAtAbsTs)}</span>
                  <span className={event.type.toLowerCase().includes('error') ? 'text-danger' : 'text-text-primary'}>{String(event.payload.line ?? event.payload.message ?? '')}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
