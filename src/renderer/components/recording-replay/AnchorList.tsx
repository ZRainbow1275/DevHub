import type { RecordingReplayState } from '@shared/schemas/r8-runtime'
import { AlertIcon, GearIcon, TerminalIcon } from '../icons'
import { formatDuration } from './Timeline'

interface AnchorListProps {
  anchors: RecordingReplayState['anchors']
  startedAtAbsTs: number
  onSeek: (cursorTs: number) => void
}

export function AnchorList({ anchors, onSeek, startedAtAbsTs }: AnchorListProps) {
  return (
    <section className="border border-surface-800 bg-surface-950 p-3 radius-md">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">锚点</div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {anchors.length === 0 ? <div className="text-xs text-text-muted">暂无可跳转锚点</div> : anchors.map(anchor => (
          <button
            className="grid w-full grid-cols-[auto_auto_1fr] items-center gap-2 border border-surface-800 bg-surface-900 px-2 py-1 text-left text-xs radius-sm hover:border-accent"
            key={`${anchor.kind}-${anchor.ts}-${anchor.label}`}
            onClick={() => onSeek(anchor.ts)}
            type="button"
          >
            {anchor.kind === 'error' ? <AlertIcon size={12} className="text-danger" /> : anchor.kind === 'inject' ? <GearIcon size={12} className="text-accent" /> : <TerminalIcon size={12} className="text-text-muted" />}
            <span className="font-mono text-text-muted">{formatDuration(anchor.ts - startedAtAbsTs)}</span>
            <span className="truncate text-text-primary">{anchor.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
