import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { FlowBuilder, type FlowBuildSources } from './FlowBuilder'
import { FlowEventCollector } from './FlowEventCollector'
import type { FlowNode } from '@shared/schemas/flow'

function buildOverflowSources(count: number): FlowBuildSources {
  const startedAt = 1_713_830_400_000
  return {
    tasks: Array.from({ length: count }, (_, index) => ({
      runId: `run-${index}`,
      taskId: `T-${index}`,
      sessionId: `session-${index}`,
      row: { id: `T-${index}`, tool: 'codex' },
      status: 'succeeded',
      attempts: 0,
      queuedAt: startedAt + index,
      startedAt: startedAt + index,
      endedAt: startedAt + index + 1,
      errorCode: null,
      error: null,
      errorMessage: null
    })),
    csvSessions: []
  }
}

describe('FlowBuilder spec-26 window overflow', () => {
  it('shrinks the effective window to the most recent 500 flow events', () => {
    const builder = new FlowBuilder()
    const toTs = 1_713_830_400_000 + 260
    const snapshot = builder.build({
      scope: 'runtime',
      windowMs: 86_400_000,
      toTs,
      speed: 1,
      filter: {}
    }, buildOverflowSources(260))

    expect(snapshot.truncated).toBe(true)
    expect(snapshot.warnings).toContainEqual(expect.objectContaining({ code: 'E_GRAPH_NODE_LIMIT' }))
    expect(snapshot.nodes).toHaveLength(500)
    expect(Number(snapshot.nodes[0]?.taskId?.replace('T-', ''))).toBeGreaterThanOrEqual(9)
    expect(snapshot.fromTs).toBe(snapshot.nodes[0]?.ts)
    expect(snapshot.windowMs).toBe(snapshot.toTs - snapshot.fromTs)
    expect(snapshot.nodes.at(-1)?.taskId).toBe('T-259')
  })

  it('maintains a sorted 24h memory index and prunes stale flow events', () => {
    const collector = new FlowEventCollector()
    const now = 1_713_830_400_000
    const stale: FlowNode = { id: 'stale', kind: 'cli-event', ts: now - 86_400_001, label: 'stale', taskId: null, sessionId: null, instanceId: 'codex', meta: {}, errorCode: null, durationMs: null }
    const newest: FlowNode = { id: 'newest', kind: 'task-end', ts: now, label: 'newest', taskId: 'T2', sessionId: null, instanceId: 'codex', meta: {}, errorCode: null, durationMs: 1 }
    const older: FlowNode = { id: 'older', kind: 'task-start', ts: now - 10, label: 'older', taskId: 'T1', sessionId: null, instanceId: 'codex', meta: {}, errorCode: null, durationMs: null }

    collector.indexNodes([newest, stale, older], now)

    expect(collector.queryIndexedNodes(now - 86_400_000, now).map(node => node.id)).toEqual(['older', 'newest'])
  })

  it('persists the recent 24h flow index in SQLite and reloads it without source replay', () => {
    const root = mkdtempSync(join(tmpdir(), 'devhub-flow-index-'))
    const dbPath = join(root, 'flow-events.sqlite')
    const now = 1_713_830_400_000
    try {
      const writer = new FlowEventCollector({ dbPath })
      writer.indexNodes([
        { id: 'persisted-2', kind: 'task-end', ts: now + 2, label: 'persisted 2', taskId: 'T2', sessionId: null, instanceId: 'codex', meta: {}, errorCode: null, durationMs: 2 },
        { id: 'persisted-1', kind: 'task-start', ts: now + 1, label: 'persisted 1', taskId: 'T1', sessionId: null, instanceId: 'codex', meta: {}, errorCode: null, durationMs: null }
      ], now + 2)
      writer.close()

      const reader = new FlowEventCollector({ dbPath })
      expect(reader.queryIndexedNodes(now, now + 5).map(node => node.id)).toEqual(['persisted-1', 'persisted-2'])
      reader.close()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
