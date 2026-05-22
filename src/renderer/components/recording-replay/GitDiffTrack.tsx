import { DiffEditor, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import type { RecordingEvent } from '@shared/schemas/r8-runtime'
import { formatDuration } from './Timeline'

loader.config({ monaco })

interface GitDiffTrackProps {
  cursorTs: number
  events: RecordingEvent[]
  startedAtAbsTs: number
}

export function GitDiffTrack({ cursorTs, events, startedAtAbsTs }: GitDiffTrackProps) {
  const gitEvents = events
    .filter((event): event is Extract<RecordingEvent, { kind: 'git-diff' }> => event.kind === 'git-diff' && event.ts <= cursorTs)
    .sort((left, right) => left.ts - right.ts)
  const pre = gitEvents.find(event => event.phase === 'pre-task')
  const post = [...gitEvents].reverse().find(event => event.phase === 'post-task') ?? gitEvents.at(-1)
  const original = pre ? formatDiffEvent(pre, startedAtAbsTs) : ''
  const modified = post ? formatDiffEvent(post, startedAtAbsTs) : ''
  const monacoDiffAvailable = canRenderMonacoDiff()

  return (
    <section className="border border-surface-800 bg-surface-950 p-3 radius-md lg:col-span-2" data-testid="git-diff-track">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">git-diff split</div>
      <div className="grid gap-3 md:grid-cols-2">
        <DiffPane event={pre} label="before" startedAtAbsTs={startedAtAbsTs} />
        <DiffPane event={post} label="after" startedAtAbsTs={startedAtAbsTs} />
      </div>
      {original || modified ? (
        <div className="mt-3 overflow-hidden border border-surface-800 radius-sm" data-testid="git-diff-monaco">
          {monacoDiffAvailable ? (
            <DiffEditor
              height="260px"
              language="diff"
              loading={<div className="p-3 text-xs text-text-muted">正在加载 Monaco diff 视图</div>}
              modified={modified}
              original={original}
              options={{
                automaticLayout: true,
                domReadOnly: true,
                folding: false,
                minimap: { enabled: false },
                originalEditable: false,
                readOnly: true,
                renderSideBySide: true,
                scrollBeyondLastLine: false
              }}
              theme="vs-dark"
            />
          ) : (
            <div className="grid gap-3 p-2 md:grid-cols-2">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap bg-black/40 p-2 font-mono text-xs text-text-primary radius-sm">{original || '暂无 before diff'}</pre>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap bg-black/40 p-2 font-mono text-xs text-text-primary radius-sm">{modified || '暂无 after diff'}</pre>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

function DiffPane({ event, label, startedAtAbsTs }: { event?: Extract<RecordingEvent, { kind: 'git-diff' }>; label: string; startedAtAbsTs: number }) {
  return (
    <div className="min-h-32 border border-surface-800 bg-surface-900 p-2 radius-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
        <span>{label}</span>
        <span>{event ? formatDuration(event.ts - startedAtAbsTs) : 'N/A'}</span>
      </div>
      {event ? <pre className="whitespace-pre-wrap font-mono text-xs text-text-primary">{event.diffStat}</pre> : <div className="text-xs text-text-muted">暂无 git diff 事件</div>}
      {event?.diffPath ? <div className="mt-2 truncate font-mono text-[10px] text-text-muted">{event.diffPath}</div> : null}
    </div>
  )
}

function formatDiffEvent(event: Extract<RecordingEvent, { kind: 'git-diff' }>, startedAtAbsTs: number): string {
  return [`# ${event.phase}`, `time=${formatDuration(event.ts - startedAtAbsTs)}`, `branch=${event.branch}`, `head=${event.headSha}`, `diffPath=${event.diffPath}`, '', event.diffStat].join('\n')
}

function canRenderMonacoDiff(): boolean {
  if (typeof document === 'undefined') return false
  const context = document.createElement('canvas').getContext('2d')
  return Boolean(context)
}
