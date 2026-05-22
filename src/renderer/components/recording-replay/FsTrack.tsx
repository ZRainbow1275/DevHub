import type { RecordingFsSnapshotResult } from '@shared/schemas/r8-runtime'

interface FsTrackProps {
  snapshot: RecordingFsSnapshotResult | null
}

export function FsTrack({ snapshot }: FsTrackProps) {
  return (
    <section className="border border-surface-800 bg-surface-950 p-3 radius-md">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-accent">
        <span>fs tree diff</span>
        <span data-testid="fs-cursor-ts">{snapshot?.cursorTs ?? 'N/A'}</span>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
        {!snapshot || snapshot.tree.length === 0 ? <div className="text-text-muted">暂无文件变化</div> : snapshot.tree.map(entry => (
          <div className="grid grid-cols-[5rem_1fr_auto] gap-2 border border-surface-800 bg-surface-900 px-2 py-1 radius-sm" key={`${entry.path}-${entry.lastTs}`}>
            <span className={entry.op.includes('unlink') ? 'text-danger' : entry.op === 'change' ? 'text-warning' : 'text-success'}>{entry.op}</span>
            <span className="truncate font-mono text-text-primary">{entry.path}</span>
            <span className="text-text-muted">{entry.sizeBytes ?? 0}b</span>
          </div>
        ))}
      </div>
    </section>
  )
}
