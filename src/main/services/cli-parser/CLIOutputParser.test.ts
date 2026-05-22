import { describe, expect, it } from 'vitest'
import { CLIOutputParser } from './CLIOutputParser'

describe('CLIOutputParser', () => {
  it('parses NDJSON events and keeps a real parse session', () => {
    const parser = new CLIOutputParser()
    const events = parser.parseChunk({
      tool: 'unknown',
      instanceId: 'generic-ndjson-1',
      strategy: 'ndjson',
      chunk: [
        JSON.stringify({ type: 'start', message: 'started' }),
        JSON.stringify({ type: 'progress', message: 'Step 1', step: 1, total: 2 }),
        JSON.stringify({ type: 'tool_use', message: 'edit file' }),
        JSON.stringify({ type: 'message', content: 'working' }),
        JSON.stringify({ type: 'completion', message: 'done', progress: 1 })
      ].join('\n')
    })

    expect(events).toHaveLength(5)
    expect(new Set(events.map(event => event.eventType)).size).toBeGreaterThanOrEqual(3)
    expect(parser.listSessions()[0].eventsEmitted).toBe(5)
    expect(parser.getProgress('generic-ndjson-1')?.percent).toBeGreaterThan(0)
  })

  it('falls back to low-confidence unknown events for invalid NDJSON without crashing', () => {
    const parser = new CLIOutputParser()
    const events = parser.parseChunk({ tool: 'unknown', instanceId: 'generic-ndjson-bad', strategy: 'ndjson', chunk: '{not-json}' })

    expect(events[0].eventType).toBe('unknown')
    expect(events[0].confidence).toBeLessThanOrEqual(0.2)
  })

  it('parses line-based Step N/M progress', () => {
    const parser = new CLIOutputParser()
    const events = parser.parseChunk({ tool: 'codex', instanceId: 'codex-1', strategy: 'line', chunk: 'Step 2/4 running typecheck' })

    expect(events[0].progress).toBe(0.5)
    expect(events[0].phase).toBe('validating')
    expect(parser.getProgress('codex-1')?.source).toBe('cli-real')
  })

  it('parses SSE data frames through the structured parser path', () => {
    const parser = new CLIOutputParser()
    const events = parser.parseChunk({
      tool: 'gemini',
      instanceId: 'gemini-1',
      strategy: 'sse',
      chunk: `data: ${JSON.stringify({ type: 'progress', message: 'half', progress: 0.5 })}\n\ndata: [DONE]`
    })

    expect(events).toHaveLength(1)
    expect(events[0].rawSource).toBe('sse')
    expect(events[0].progress).toBe(0.5)
  })

  it('parses shim strategy output with rawSource=shim', () => {
    const parser = new CLIOutputParser()
    const events = parser.parseChunk({
      tool: 'codex',
      instanceId: 'codex-shim',
      strategy: 'shim',
      chunk: JSON.stringify({ type: 'progress', message: 'shim progress', step: 3, total: 4 })
    })

    expect(events[0].rawSource).toBe('shim')
    expect(events[0].eventType).toBe('progress')
    expect(events[0].payload).toMatchObject({ step: 3, total: 4 })
  })

  it('fuses line and shim progress for the same instance', () => {
    const parser = new CLIOutputParser()
    parser.parseChunk({ tool: 'codex', instanceId: 'codex-fusion', strategy: 'line', chunk: 'Step 1/4 running' })
    parser.parseChunk({ tool: 'codex', instanceId: 'codex-fusion', strategy: 'shim', chunk: JSON.stringify({ type: 'progress', message: 'shim', progress: 0.75 }) })

    const progress = parser.getProgress('codex-fusion')
    expect(progress?.source).toBe('fusion')
    expect(progress?.confidence).toBe(0.88)
    expect(progress?.percent).toBeCloseTo(((0.25 * 0.82) + (0.75 * 0.88)) / (0.82 + 0.88), 5)
  })

  it('supports explicit strategy switching for an existing session', () => {
    const parser = new CLIOutputParser()
    parser.parseChunk({ tool: 'codex', instanceId: 'codex-switch', strategy: 'line', chunk: 'Step 1/2 running' })
    const updated = parser.selectStrategy({ instanceId: 'codex-switch', strategy: 'shim' })

    expect(updated.strategy).toBe('shim')
  })
})
