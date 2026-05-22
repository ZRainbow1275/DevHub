import { describe, expect, it } from 'vitest'
import { performance } from 'node:perf_hooks'
import { DagOrchestrator } from './DagOrchestrator'
import { CriticalPathAnalyzer, type CriticalPathResult } from './CriticalPathAnalyzer'

const sessionId = 'dag-test-session'

function row(taskId: string, dependsOn = '', overrides: Record<string, unknown> = {}) {
  return {
    taskId,
    taskName: taskId,
    priority: 'P2',
    status: 'pending',
    tool: 'codex',
    skill: 'code-review',
    inputFile: 'src/app.ts',
    inputArgs: '{"prompt":"real dag test"}',
    outputDir: 'out/dag',
    outputFormat: 'md',
    tags: 'dag,test',
    dependsOn,
    timeoutMs: '0',
    retries: '0',
    concurrencyKey: '',
    createdAt: '2026-05-03T08:00:00Z',
    scheduledAt: 'now',
    note: 'vitest dag fixture',
    ...overrides
  }
}

function fanoutRows(count: number): ReturnType<typeof row>[] {
  return Array.from({ length: count }, (_, index) => row(`T${index}`, index === 0 ? '' : 'after:T0'))
}

const dagFixtures = {
  dag5: [row('A'), row('B', 'after:A'), row('C', 'after:A'), row('D', 'after:B,C'), row('E', 'after:A,D')],
  dag100: fanoutRows(100),
  dag1000: fanoutRows(1000),
  cycle3: [row('A', 'after:C'), row('B', 'after:A'), row('C', 'after:B')],
  orphan: [row('A'), row('B', 'after:A'), row('T5')],
  parallelGroupConflict: [
    row('A', '', { concurrencyKey: 'frontend:max=1' }),
    row('B', '', { concurrencyKey: 'frontend:max=1' }),
    row('C', '', { concurrencyKey: 'frontend:max=1' })
  ]
}

describe('DagOrchestrator', () => {
  it('builds deterministic topo layers for a five-node DAG', () => {
    const orchestrator = new DagOrchestrator(undefined, undefined, undefined, undefined, undefined, () => 1)
    const snapshot = orchestrator.build({
      sessionId,
      rows: dagFixtures.dag5
    })

    expect(snapshot.layers).toEqual([['A'], ['B', 'C'], ['D'], ['E']])
    expect(snapshot.nodes.find(node => node.taskId === 'A')).toMatchObject({ inDegree: 0, outDegree: 3 })
    expect(snapshot.warnings).toEqual([])
  })

  it('detects Tarjan cycle paths without pretending the graph is runnable', () => {
    const orchestrator = new DagOrchestrator()
    const cycle = orchestrator.detectCycle({
      sessionId,
      rows: dagFixtures.cycle3
    })

    expect(cycle?.cyclePaths.some(path => path.join('>') === 'A>B>C>A')).toBe(true)
    expect(() => orchestrator.build({ sessionId, rows: dagFixtures.cycle3 })).toThrow('E_DAG_CYCLE')
  })

  it('evaluates any and failure dependency conditions against real terminal sets', () => {
    const orchestrator = new DagOrchestrator(undefined, undefined, undefined, undefined, undefined, () => 1)
    const anySnapshot = orchestrator.build({ sessionId: 'any-session', rows: [row('T1'), row('T2'), row('T3', 'after:T1|T2 if=any')] })
    const failureSnapshot = orchestrator.build({ sessionId: 'failure-session', rows: [row('T1'), row('T3', 'after:T1 if=failure')] })

    expect(orchestrator.isReady(anySnapshot, 'T3', new Set(['T1']), new Set()).ready).toBe(true)
    expect(orchestrator.isReady(anySnapshot, 'missing-task', new Set(['T1']), new Set())).toMatchObject({ ready: false, blockers: ['missing-task'] })
    expect(orchestrator.isReady(failureSnapshot, 'T3', new Set(['T1']), new Set())).toMatchObject({ ready: false, blockers: ['T1'] })
    expect(orchestrator.isReady(failureSnapshot, 'T3', new Set(), new Set(['T1'])).ready).toBe(true)
  })

  it('treats completed dependency conditions as success or failure terminals', () => {
    const orchestrator = new DagOrchestrator(undefined, undefined, undefined, undefined, undefined, () => 1)
    const snapshot = orchestrator.build({ sessionId: 'completed-session', rows: [row('T1'), row('T2'), row('T3', 'after:T1,T2 if=completed')] })

    expect(orchestrator.isReady(snapshot, 'T3', new Set(['T1']), new Set())).toMatchObject({ ready: false, blockers: ['T2'] })
    expect(orchestrator.isReady(snapshot, 'T3', new Set(['T1']), new Set(['T2']))).toMatchObject({ ready: true, blockers: [] })
  })

  it('surfaces parallel group max conflicts in the snapshot', () => {
    const orchestrator = new DagOrchestrator(undefined, undefined, undefined, undefined, undefined, () => 1)
    const snapshot = orchestrator.build({
      sessionId,
      rows: dagFixtures.parallelGroupConflict
    })

    expect(snapshot.nodes.every(node => node.parallelGroupMax === 1)).toBe(true)
    expect(snapshot.warnings).toContainEqual(expect.objectContaining({ kind: 'parallel-group-conflict', taskIds: ['A', 'B', 'C'] }))
  })

  it('marks the estimated critical path and total duration', () => {
    const orchestrator = new DagOrchestrator(undefined, undefined, undefined, undefined, undefined, () => 1)
    const snapshot = orchestrator.build({
      sessionId,
      rows: [
        row('A', '', { estimatedDurationMs: 10 }),
        row('B', 'after:A', { estimatedDurationMs: 20 }),
        row('C', 'after:A', { estimatedDurationMs: 5 }),
        row('D', 'after:B,C', { estimatedDurationMs: 15 })
      ]
    })

    expect(snapshot.criticalPath).toEqual(['A', 'B', 'D'])
    expect(snapshot.estimatedTotalMs).toBe(45)
    expect(snapshot.nodes.filter(node => node.isCriticalPath).map(node => node.taskId)).toEqual(['A', 'B', 'D'])
  })

  it('computes forward and backward critical-path slack from estimated durations', () => {
    class CapturingCriticalPathAnalyzer extends CriticalPathAnalyzer {
      result: CriticalPathResult | null = null
      artifacts: Parameters<CriticalPathAnalyzer['analyze']>[0] | null = null

      override analyze(...args: Parameters<CriticalPathAnalyzer['analyze']>): CriticalPathResult {
        this.artifacts = args[0]
        this.result = super.analyze(...args)
        return this.result
      }
    }

    const analyzer = new CapturingCriticalPathAnalyzer()
    const orchestrator = new DagOrchestrator(undefined, undefined, undefined, analyzer, undefined, () => 1)

    const snapshot = orchestrator.build({
      sessionId,
      rows: [
        row('A', '', { estimatedDurationMs: 10 }),
        row('B', 'after:A', { estimatedDurationMs: 20 }),
        row('C', 'after:A', { estimatedDurationMs: 5 }),
        row('D', 'after:B,C', { estimatedDurationMs: 15 }),
        row('E', 'after:C', { estimatedDurationMs: 5 })
      ]
    })

    expect(snapshot.criticalPath).toEqual(['A', 'B', 'D'])
    expect(analyzer.artifacts?.forwardEdgesByTaskId.get('A')?.map(edge => edge.to)).toEqual(['B', 'C'])
    expect(analyzer.artifacts?.reverseEdgesByTaskId.get('D')?.map(edge => edge.from)).toEqual(['B', 'C'])
    expect(analyzer.result?.timings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: 'A',
        earliestStartMs: 0,
        earliestFinishMs: 10,
        latestStartMs: 0,
        latestFinishMs: 10,
        slackMs: 0,
        isCritical: true
      }),
      expect.objectContaining({
        taskId: 'C',
        earliestStartMs: 10,
        earliestFinishMs: 15,
        latestStartMs: 25,
        latestFinishMs: 30,
        slackMs: 15,
        isCritical: false
      }),
      expect.objectContaining({
        taskId: 'E',
        earliestStartMs: 15,
        earliestFinishMs: 20,
        latestStartMs: 40,
        latestFinishMs: 45,
        slackMs: 25,
        isCritical: false
      })
    ]))
  })

  it('warns about orphan nodes and exports renderable graph formats', () => {
    const orchestrator = new DagOrchestrator(undefined, undefined, undefined, undefined, undefined, () => 1)
    const snapshot = orchestrator.build({ sessionId, rows: dagFixtures.orphan })

    expect(snapshot.warnings).toContainEqual(expect.objectContaining({ kind: 'orphan-node', taskIds: ['T5'] }))
    expect(orchestrator.serialize(snapshot, 'mermaid')).toContain('graph TD')
    expect(orchestrator.serialize(snapshot, 'mermaid')).toContain('A --> B')
    expect(orchestrator.serialize(snapshot, 'dot')).toContain('"A" -> "B"')
    expect(JSON.parse(orchestrator.serialize(snapshot, 'cytoscape')).elements.nodes).toHaveLength(3)
  })

  it('rejects oversized batches before spending CPU on layout', () => {
    const orchestrator = new DagOrchestrator()
    expect(() => orchestrator.build({ sessionId, rows: Array.from({ length: 1001 }, (_, index) => row(`T${index}`)) })).toThrow('E_VALIDATION')
  })

  it('keeps dag-5, dag-100, cycle-3, orphan, parallel-group-conflict, and 1000-node performance fixtures executable', () => {
    const orchestrator = new DagOrchestrator(undefined, undefined, undefined, undefined, undefined, () => 1)

    expect(orchestrator.build({ sessionId: 'fixture-dag-5', rows: dagFixtures.dag5 }).layers).toEqual([['A'], ['B', 'C'], ['D'], ['E']])
    expect(orchestrator.build({ sessionId: 'fixture-dag-100', rows: dagFixtures.dag100 }).nodes).toHaveLength(100)
    expect(orchestrator.detectCycle({ sessionId: 'fixture-cycle-3', rows: dagFixtures.cycle3 })?.cyclePaths.length).toBeGreaterThan(0)
    expect(orchestrator.build({ sessionId: 'fixture-orphan', rows: dagFixtures.orphan }).warnings).toContainEqual(expect.objectContaining({ kind: 'orphan-node', taskIds: ['T5'] }))
    expect(orchestrator.build({ sessionId: 'fixture-parallel-conflict', rows: dagFixtures.parallelGroupConflict }).warnings).toContainEqual(expect.objectContaining({ kind: 'parallel-group-conflict', taskIds: ['A', 'B', 'C'] }))

    const { snapshot, metrics } = orchestrator.buildWithMetrics({ sessionId: 'fixture-dag-1000-budget', rows: dagFixtures.dag1000 })
    const cycleStartedAt = performance.now()
    const cycle = orchestrator.detectCycle({ sessionId: 'fixture-dag-1000-cycle-budget', rows: dagFixtures.dag1000 })
    const cycleDetectMs = performance.now() - cycleStartedAt

    expect(snapshot.nodes).toHaveLength(1000)
    expect(metrics.nodeCount).toBe(1000)
    expect(metrics.edgeCount).toBe(999)
    expect(metrics.totalBuildMs).toBeLessThan(200)
    expect(metrics.topoSortMs).toBeLessThan(80)
    expect(cycle).toBeNull()
    expect(cycleDetectMs).toBeLessThan(50)
  }, 10000)
})
