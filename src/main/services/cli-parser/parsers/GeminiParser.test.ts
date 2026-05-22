import { describe, expect, it } from 'vitest'
import { parseSessionSchema } from '@shared/schemas/r8-runtime'
import { GeminiParser } from './GeminiParser'

function context() {
  return {
    session: parseSessionSchema.parse({
      sessionId: 'gemini-session',
      instanceId: 'gemini-instance',
      tool: 'gemini',
      strategy: 'line',
      startedAt: 1,
      bytesProcessed: 0,
      eventsEmitted: 0,
      lastEventAt: null
    }),
    stream: 'stdout' as const,
    observedAt: 20
  }
}

describe('GeminiParser', () => {
  it('classifies thinking stdout as progress with high confidence', () => {
    const parser = new GeminiParser()
    const events = parser.parseChunk('Thinking...', context())

    expect(events[0]).toMatchObject({
      tool: 'gemini',
      eventType: 'progress',
      phase: 'thinking',
      progress: 0.25,
      confidence: 0.85,
      payload: { kind: 'thinking' }
    })
  })

  it('extracts Gemini tool calls from real stdout lines', () => {
    const parser = new GeminiParser()
    const events = parser.parseChunk('[tool: read_file] path=/tmp/a.ts', context())

    expect(events[0]).toMatchObject({
      eventType: 'tool-use',
      payload: { kind: 'tool_call', tool: 'read_file' }
    })
  })

  it('extracts prose-style Gemini tool calls from stdout', () => {
    const parser = new GeminiParser()
    const events = parser.parseChunk('Running tool: read_file path=/tmp/a.ts', context())

    expect(events[0]).toMatchObject({
      eventType: 'tool-use',
      payload: { kind: 'tool_call', tool: 'read_file' }
    })
  })

  it('classifies completion, rate limit, and safety block stdout', () => {
    const parser = new GeminiParser()
    const events = parser.parseChunk([
      'Done',
      '429 quota exceeded',
      'Safety policy blocked this request'
    ].join('\n'), context())

    expect(events.map(event => event.eventType)).toEqual(['completion', 'error', 'error'])
    expect(events.map(event => event.payload?.kind)).toEqual(['completion', 'rate_limit', 'safety_block'])
  })

  it('strips ANSI sequences and bounds oversized unmatched lines', () => {
    const parser = new GeminiParser()
    const ansi = parser.parseChunk(`\u001B[32mThinking...\u001B[0m`, context())
    const oversized = parser.parseChunk('x'.repeat(20_000), context())

    expect(ansi[0]).toMatchObject({ eventType: 'progress', phase: 'thinking' })
    expect(oversized[0].line.length).toBeLessThan(16_100)
    expect(parser.getStats('gemini-instance').partialBufferBytes).toBeLessThanOrEqual(4096)
  })

  it('tracks pattern stats and unmatched ratio per instance', () => {
    const parser = new GeminiParser()
    parser.parseChunk(['Thinking...', 'plain model text'].join('\n'), context())

    const stats = parser.getStats('gemini-instance')

    expect(stats.totalLines).toBe(2)
    expect(stats.kindCounts.thinking).toBe(1)
    expect(stats.unmatchedLines).toBe(1)
    expect(stats.unmatchedRatio).toBe(0.5)
  })

  it('reloads Gemini stdout rules without restarting the parser', () => {
    const parser = new GeminiParser()

    expect(() => parser.reloadRules([{ kind: 'thinking', regex: '(', confidence: 0.5 }])).toThrow('E_VALIDATION')
    const reloaded = parser.reloadRules([{ kind: 'thinking', regex: 'Waiting for approval', flags: 'i', confidence: 0.77, ansiStrip: true }])
    const events = parser.parseChunk('Waiting for approval', context())

    expect(reloaded).toMatchObject({ success: true, applied: 1 })
    expect(events[0]).toMatchObject({ eventType: 'progress', phase: 'thinking', confidence: 0.77, payload: { kind: 'thinking', ruleVersion: reloaded.ruleVersion } })
  })
})
