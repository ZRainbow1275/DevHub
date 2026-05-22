import { asciinemaCastSchema, type AsciinemaCast } from '@shared/schemas/replay-state'
import type { RecordingEvent, RecordingManifest } from '@shared/schemas/recording'

interface AsciinemaBuildOptions {
  width?: number
  height?: number
}

export function buildAsciinemaCast(
  manifest: RecordingManifest,
  events: readonly RecordingEvent[],
  options: AsciinemaBuildOptions = {}
): AsciinemaCast {
  const outputEvents = events
    .filter((event): event is Extract<RecordingEvent, { kind: 'stdout' }> => event.kind === 'stdout')
    .sort((left, right) => left.ts - right.ts)
    .map(event => [
      Number(Math.max(0, (event.ts - manifest.startedAt) / 1000).toFixed(6)),
      'o',
      stdoutText(event)
    ] as const)

  const endedAt = manifest.stoppedAt ?? outputEvents.reduce((latest, event) => Math.max(latest, manifest.startedAt + event[0] * 1000), manifest.startedAt)

  return asciinemaCastSchema.parse({
    version: 2,
    width: options.width ?? 120,
    height: options.height ?? 40,
    timestamp: Math.floor(manifest.startedAt / 1000),
    duration: Math.max(0, (endedAt - manifest.startedAt) / 1000),
    title: manifest.label || manifest.taskId,
    env: { TERM: 'xterm-256color' },
    events: outputEvents
  })
}

export function serializeAsciinemaCast(cast: AsciinemaCast): string {
  const { events, ...header } = cast
  return `${[JSON.stringify(header), ...events.map(event => JSON.stringify(event))].join('\n')}\n`
}


function stdoutText(event: Extract<RecordingEvent, { kind: 'stdout' }>): string {
  const payload = event.payload
  const line = payload.line
  if (typeof line === 'string') return line
  const message = payload.message
  if (typeof message === 'string') return message
  const text = payload.text
  if (typeof text === 'string') return text
  return JSON.stringify(payload)
}
