import type { RecordingEvent } from '@shared/schemas/r8-runtime'
import { GearIcon, TerminalIcon } from '../icons'
import { formatDuration } from './Timeline'

interface StdinTrackProps {
  cursorTs: number
  events: RecordingEvent[]
  startedAtAbsTs: number
}

export function StdinTrack({ cursorTs, events, startedAtAbsTs }: StdinTrackProps) {
  const rows = events.filter((event): event is Extract<RecordingEvent, { kind: 'stdin' }> => event.kind === 'stdin' && event.ts <= cursorTs)

  return (
    <section className="border border-surface-800 bg-surface-950 p-3 radius-md" data-testid="stdin-track">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">stdin / inject</div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {rows.length === 0 ? <div className="text-xs text-text-muted">暂无 stdin 事件</div> : rows.map((event, index) => {
          const detail = event.injectAction
          return (
            <div className="grid grid-cols-[auto_4.5rem_1fr] gap-2 border border-surface-800 bg-surface-900 px-2 py-1 text-xs radius-sm" key={`${event.ts}-${index}`} title={injectTitle(event)}>
              {event.origin === 'inject' ? <GearIcon size={12} className="text-accent" /> : <TerminalIcon size={12} className="text-text-muted" />}
              <span className="font-mono text-text-muted">{formatDuration(event.ts - startedAtAbsTs)}</span>
              <span className="min-w-0">
                <span className="block truncate text-text-primary">{event.text}</span>
                {detail ? <span className="block truncate font-mono text-[10px] text-text-muted">{detail.targetAlias ?? 'unknown-target'} · {detail.mode ?? 'unknown-mode'} · {detail.scenario ?? 'unknown-scenario'}</span> : null}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function injectTitle(event: Extract<RecordingEvent, { kind: 'stdin' }>): string | undefined {
  if (event.origin !== 'inject') return undefined
  const detail = event.injectAction
  return [
    `InjectAction: ${detail?.actionId ?? event.injectActionId ?? 'unknown'}`,
    `target: ${detail?.targetAlias ?? 'unknown'}`,
    `mode: ${detail?.mode ?? 'unknown'}`,
    `scenario: ${detail?.scenario ?? 'unknown'}`
  ].join('\n')
}
