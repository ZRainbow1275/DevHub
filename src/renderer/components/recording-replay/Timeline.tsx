import type { RecordingReplayState } from '@shared/schemas/r8-runtime'
import { TimelineCursor } from './TimelineCursor'

interface TimelineProps {
  state: RecordingReplayState
  onSeek: (cursorTs: number) => void
}

export function Timeline({ onSeek, state }: TimelineProps) {
  const durationMs = Math.max(0, state.endedAtAbsTs - state.startedAtAbsTs)
  const cursorOffset = Math.max(0, state.cursorTs - state.startedAtAbsTs)
  const percent = durationMs === 0 ? 0 : Math.min(100, Math.round((cursorOffset / durationMs) * 100))

  return (
    <section className="border border-surface-800 bg-surface-950 p-3 radius-md">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-text-muted">
        <span data-testid="replay-cursor-offset">{formatDuration(cursorOffset)}</span>
        <span>{percent}%</span>
        <span>{formatDuration(durationMs)}</span>
      </div>
      <TimelineCursor cursorTs={state.cursorTs} endedAtAbsTs={state.endedAtAbsTs} onSeek={onSeek} startedAtAbsTs={state.startedAtAbsTs} />
      <div className="mt-2 flex gap-1 overflow-hidden">
        {state.anchors.map(anchor => (
          <button
            aria-label={`Jump to ${anchor.label}`}
            className="h-1 min-w-3 flex-1 bg-accent/80 hover:bg-accent"
            key={`${anchor.kind}-${anchor.ts}-${anchor.label}`}
            onClick={() => onSeek(anchor.ts)}
            title={`${anchor.kind}: ${anchor.label}`}
            type="button"
          />
        ))}
      </div>
    </section>
  )
}

export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.trunc(ms))
  const seconds = Math.floor(safe / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}
