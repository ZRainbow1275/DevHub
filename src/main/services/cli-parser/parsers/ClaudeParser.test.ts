import { describe, expect, it } from 'vitest'
import { parseSessionSchema } from '@shared/schemas/r8-runtime'
import { CLAUDE_STREAM_SCHEMA_VERSION } from '@shared/schemas/claude-stream'
import { ClaudeParser } from './ClaudeParser'

function context() {
  return {
    session: parseSessionSchema.parse({
      sessionId: 'claude-session',
      instanceId: 'claude-instance',
      tool: 'claude',
      strategy: 'ndjson',
      startedAt: 1,
      bytesProcessed: 0,
      eventsEmitted: 0,
      lastEventAt: null
    }),
    stream: 'stdout' as const,
    observedAt: 30
  }
}

describe('ClaudeParser', () => {
  it('maps stream-json lifecycle into phase, tool, progress, and completion events', () => {
    const parser = new ClaudeParser()
    const events = parser.parseChunk([
      JSON.stringify({ type: 'system', subtype: 'init', cwd: 'D:/repo', session_id: 's1', tools: ['Read'], model: 'claude-sonnet-4-5' }),
      JSON.stringify({ type: 'assistant', message: { id: 'm1', role: 'assistant', model: 'claude-sonnet-4-5', content: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: 'README.md' } }], usage: { input_tokens: 10, output_tokens: 2 } } }),
      JSON.stringify({ type: 'assistant', message: { id: 'm2', role: 'assistant', model: 'claude-sonnet-4-5', content: [{ type: 'text', text: 'working' }], usage: { input_tokens: 10, output_tokens: 8 } } }),
      JSON.stringify({ type: 'result', subtype: 'success', is_error: false, duration_ms: 1200, total_cost_usd: 0.001, usage: { input_tokens: 10, output_tokens: 8 } })
    ].join('\n'), context())

    expect(events.map(event => event.eventType)).toEqual(['phase_marker', 'tool_invocation', 'progress_pct', 'completion'])
    expect(events[1].payload?.tool).toBe('Read')
    expect(events[1].payload?.toolUseId).toBe('tu1')
    expect(events[1].payload?.inputTokens).toBe(10)
    expect(events[1].payload?.schemaVersion).toBe(CLAUDE_STREAM_SCHEMA_VERSION)
    expect(events[2].progress).toBeGreaterThan(0)
    expect(events[3].progress).toBe(1)
    expect(events[3].payload).toMatchObject({ durationMs: 1200, costUsd: 0.001, inputTokens: 10, outputTokens: 8, schemaVersion: CLAUDE_STREAM_SCHEMA_VERSION })
  })

  it('preserves Claude result subtype on errors', () => {
    const parser = new ClaudeParser()
    const events = parser.parseChunk(JSON.stringify({
      type: 'result',
      subtype: 'error_max_turns',
      is_error: true,
      duration_ms: 5000,
      total_cost_usd: 0.02,
      usage: { input_tokens: 100, output_tokens: 30 }
    }), context())

    expect(events[0]).toMatchObject({
      eventType: 'error',
      phase: 'error',
      payload: { isError: true, rawType: 'result', subtype: 'error_max_turns', schemaVersion: CLAUDE_STREAM_SCHEMA_VERSION }
    })
  })

  it('rejects schema-incomplete stream-json events explicitly', () => {
    const parser = new ClaudeParser()
    const events = parser.parseChunk(JSON.stringify({ type: 'system', subtype: 'init', session_id: 's1' }), context())

    expect(events[0]).toMatchObject({ eventType: 'error', phase: 'error', payload: { subtype: 'invalid_claude_stream_schema', expectedSchemaVersion: CLAUDE_STREAM_SCHEMA_VERSION } })
  })

  it('turns malformed stream-json lines into explicit parser errors', () => {
    const parser = new ClaudeParser()
    const events = parser.parseChunk('{not-json}', context())

    expect(events[0]).toMatchObject({ eventType: 'error', phase: 'error', payload: { subtype: 'invalid_stream_json' } })
    expect(events[0].payload?.expectedSchemaVersion).toBe(CLAUDE_STREAM_SCHEMA_VERSION)
    expect(events[0].confidence).toBeLessThanOrEqual(0.1)
  })

  it('throttles partial_assistant frames into 100ms merged message events per instance', () => {
    const parser = new ClaudeParser()
    const first = parser.parseChunk(JSON.stringify({ type: 'partial_assistant', message: { content: [{ text: 'Hel' }] } }), { ...context(), observedAt: 100 })
    const suppressed = parser.parseChunk(JSON.stringify({ type: 'partial_assistant', message: { content: [{ text: 'lo' }] } }), { ...context(), observedAt: 150 })
    const emitted = parser.parseChunk(JSON.stringify({ type: 'partial_assistant', message: { content: [{ text: ' world' }] } }), { ...context(), observedAt: 210 })

    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ eventType: 'message-out', payload: { text: 'Hel', throttledPartialCount: 0, schemaVersion: CLAUDE_STREAM_SCHEMA_VERSION } })
    expect(suppressed).toEqual([])
    expect(emitted[0]).toMatchObject({ eventType: 'message-out', payload: { text: 'lo world', throttledPartialCount: 1 } })
  })
})
