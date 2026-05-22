import { describe, expect, it } from 'vitest'
import { formatCodexMarker, parseCodexMarkerLine } from '../../shim/MarkerProtocol'
import { CodexParser } from './CodexParser'
import { parseSessionSchema } from '@shared/schemas/r8-runtime'

function context() {
  return {
    session: parseSessionSchema.parse({
      sessionId: 'codex-session',
      instanceId: 'codex-instance',
      tool: 'codex',
      strategy: 'shim',
      startedAt: 1,
      bytesProcessed: 0,
      eventsEmitted: 0,
      lastEventAt: null
    }),
    stream: 'stdout' as const,
    observedAt: 10
  }
}

describe('CodexParser', () => {
  it.each([
    ['PHASE', 'coding', 'phase_marker'],
    ['PROGRESS', '42', 'progress'],
    ['TOKENS', '1024', 'progress'],
    ['TOOL', 'shell', 'tool-use'],
    ['ERROR', 'failed', 'error'],
    ['DONE', '0', 'completion'],
    ['HEARTBEAT', 'alive', 'progress']
  ] as const)('parses strict marker field %s', (field, value, eventType) => {
    const parser = new CodexParser()
    const marker = parseCodexMarkerLine(formatCodexMarker({ version: 1, field, value, ts: 10 }), 10)
    const events = parser.parseChunk(`DEVHUB::MARKER::v=1::${field}=${value}`, context())

    expect(marker).toMatchObject({ version: 1, field, value, ts: 10 })
    expect(events[0]).toMatchObject({
      eventType,
      rawSource: 'shim',
      confidence: 1,
      payload: { field, value }
    })
  })

  it('parses strict DevHub marker protocol into high-confidence phase events', () => {
    const parser = new CodexParser()
    const events = parser.parseChunk('DEVHUB::MARKER::v=1::PHASE=coding', context())

    expect(events[0]).toMatchObject({
      tool: 'codex',
      eventType: 'phase_marker',
      rawSource: 'shim',
      confidence: 1,
      phase: 'working',
      payload: { field: 'PHASE', value: 'coding', phase: 'coding' }
    })
  })

  it('treats malformed marker-looking output as ordinary stdout', () => {
    const parser = new CodexParser()
    const events = parser.parseChunk('DEVHUB::MARKER::FAKE', context())

    expect(parseCodexMarkerLine('DEVHUB::MARKER::FAKE', 1)).toBeNull()
    expect(events[0].eventType).not.toBe('phase_marker')
    expect(events[0].confidence).toBeLessThan(1)
  })
})
