import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import type { Project } from '@shared/types'
import type { AITask, PortInfo, ProcessInfo, ScannerCacheSnapshot, WindowInfo } from '@shared/types-extended'
import type { GraphKind } from '@shared/schemas/r8-runtime'
import { GraphService } from './GraphService'
import { GraphSnapshotter } from './GraphSnapshotter'

const now = 1_900_000

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'DevHub',
    path: 'D:/repo/devhub',
    scripts: ['dev'],
    defaultScript: 'dev',
    projectType: 'pnpm',
    tags: ['r8'],
    status: 'running',
    createdAt: 1,
    updatedAt: 2,
    ...overrides
  }
}

function processInfo(overrides: Partial<ProcessInfo> & { ppid?: number } = {}): ProcessInfo & { ppid?: number } {
  return {
    pid: 1234,
    name: 'node.exe',
    command: 'pnpm dev',
    cpu: 12,
    memory: 256,
    status: 'running',
    projectId: 'project-1',
    startTime: 10,
    type: 'dev-server',
    workingDir: 'D:/repo/devhub',
    ...overrides
  }
}

function processWithoutProjectId(overrides: Partial<ProcessInfo> & { ppid?: number } = {}): ProcessInfo & { ppid?: number } {
  const record = processInfo(overrides) as ProcessInfo & { ppid?: number; projectId?: string }
  delete record.projectId
  return record
}

function portInfo(overrides: Partial<PortInfo> = {}): PortInfo {
  return {
    port: 5173,
    pid: 1234,
    processName: 'node.exe',
    state: 'LISTENING',
    protocol: 'TCP',
    localAddress: '127.0.0.1',
    foreignAddress: '0.0.0.0',
    projectId: 'project-1',
    ...overrides
  }
}

function windowInfo(overrides: Partial<WindowInfo> = {}): WindowInfo {
  return {
    hwnd: 9001,
    title: 'DevHub',
    processName: 'node.exe',
    pid: 1234,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 0, y: 0, width: 1200, height: 800 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false,
    ...overrides
  }
}

function aiTask(overrides: Partial<AITask> = {}): AITask {
  return {
    id: 'task-1',
    toolType: 'codex',
    pid: 1234,
    startTime: 100,
    status: { state: 'running', lastActivity: 100 },
    projectId: 'project-1',
    metrics: { cpuHistory: [], outputLineCount: 3, lastOutputTime: 100, idleDuration: 0 },
    ...overrides
  }
}

function snapshot(input: { processes?: ProcessInfo[]; ports?: PortInfo[]; windows?: WindowInfo[]; aiTasks?: AITask[] }): ScannerCacheSnapshot {
  return {
    processes: { data: input.processes ?? [] },
    ports: { data: input.ports ?? [] },
    windows: { data: input.windows ?? [] },
    aiTasks: { data: input.aiTasks ?? [] }
  } as unknown as ScannerCacheSnapshot
}

function service(input: { snapshot: ScannerCacheSnapshot; projects?: Project[]; root?: string }) {
  return new GraphService({
    getSnapshot: () => input.snapshot,
    getProjects: () => input.projects ?? [project()],
    getUserDataRoot: () => input.root ?? process.cwd(),
    now: () => now
  })
}

const SPEC24_FIXTURE_NODE_COUNTS = [100, 500, 800] as const
const SPEC24_FIXTURE_GRAPH_KINDS = ['network-topology', 'neural-relationship', 'flow'] as const satisfies readonly GraphKind[]
const SPEC24_HISTORICAL_CURSOR = 1_800_024
const SPEC24_BUILD_BUDGET_MS = 2_500

function spec24Process(index: number): ProcessInfo {
  return processInfo({
    pid: 20_000 + index,
    name: `spec24-proc-${index}`,
    command: '',
    cpu: index % 17,
    memory: 64 + (index % 31),
    projectId: undefined,
    startTime: index,
    type: 'other',
    workingDir: ''
  })
}

function spec24AiTask(index: number): AITask {
  return aiTask({
    id: `spec24-task-${index}`,
    pid: 30_000 + index,
    projectId: undefined,
    startTime: index,
    status: { state: 'running', lastActivity: index }
  })
}

function spec24FixtureSnapshot(graphKind: GraphKind, nodeCount: number): ScannerCacheSnapshot {
  if (graphKind === 'flow') {
    return snapshot({ aiTasks: Array.from({ length: nodeCount }, (_, index) => spec24AiTask(index)) })
  }

  const processCount = graphKind === 'neural-relationship' ? nodeCount - 1 : nodeCount
  return snapshot({ processes: Array.from({ length: processCount }, (_, index) => spec24Process(index)) })
}

describe('GraphService', () => {
  it('builds a network topology from real scanner cache entities', async () => {
    const graph = await service({ snapshot: snapshot({ processes: [processInfo()], ports: [portInfo()], windows: [windowInfo()], aiTasks: [aiTask()] }) }).buildNetwork()

    expect(graph.slice.graphKind).toBe('network-topology')
    expect(graph.nodes.map(node => node.kind)).toEqual(expect.arrayContaining(['process', 'port', 'window', 'project']))
    expect(graph.edges.map(edge => edge.type)).toEqual(expect.arrayContaining(['owns', 'listens']))
    expect(graph.edges.every(edge => graph.nodes.some(node => node.id === edge.source) && graph.nodes.some(node => node.id === edge.target))).toBe(true)
  })

  it('builds neural relationships from tags, project ownership, cwd buckets, and AI task sessions', async () => {
    const graph = await service({
      snapshot: snapshot({
        processes: [processInfo(), processInfo({ pid: 2222, name: 'codex.exe', type: 'ai-tool', workingDir: 'D:/repo/devhub' })],
        aiTasks: [aiTask({ id: 'task-2', pid: 2222 })]
      })
    }).buildNeuralRelationship()

    expect(graph.slice.graphKind).toBe('neural-relationship')
    expect(graph.edges.map(edge => edge.type)).toEqual(expect.arrayContaining(['has-tag', 'belongs-to-project', 'shares-cwd', 'ai-session-of']))
  })

  it('infers neural project ownership from cwd roots and command-line aliases', async () => {
    const graph = await service({
      snapshot: snapshot({
        processes: [
          processWithoutProjectId({
            pid: 3333,
            name: 'claude.exe',
            command: 'claude -p --cwd D:/repo/devhub',
            type: 'ai-tool',
            workingDir: 'D:/repo/devhub/packages/api'
          })
        ]
      })
    }).buildNeuralRelationship()

    expect(graph.nodes.map(node => node.id)).toEqual(expect.arrayContaining(['project-project-1', 'tag-alias-claude']))
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'process-3333', target: 'project-project-1', type: 'belongs-to-project', inferenceConfidence: 0.72 }),
      expect.objectContaining({ source: 'process-3333', target: 'tag-alias-claude', type: 'has-tag', inferenceConfidence: 0.72 })
    ]))
  })

  it('slices process scope to the selected PID and one-hop process neighbors', async () => {
    const graph = await service({
      snapshot: snapshot({
        processes: [processInfo({ pid: 1, name: 'parent.exe' }), processInfo({ pid: 1234, ppid: 1 }), processInfo({ pid: 1235, ppid: 1234 }), processInfo({ pid: 9999, name: 'unrelated.exe' })],
        ports: [portInfo({ pid: 1234 })],
        windows: [windowInfo({ pid: 1234 })]
      })
    }).buildGlobal({ scope: 'process', targetIds: [1234], graphKind: 'network-topology', depth: 1, selectedNodeId: 'process-1234' })

    const ids = graph.nodes.map(node => node.id)
    expect(graph.slice.selectedNodeId).toBe('process-1234')
    expect(ids).toEqual(expect.arrayContaining(['process-1', 'process-1234', 'process-1235', 'port-5173-1234-TCP', 'window-9001']))
    expect(ids).not.toContain('process-9999')
  })

  it('degrades at the default 500 node limit and expands to the 2000 cap explicitly', async () => {
    const processes = Array.from({ length: 501 }, (_, index) => processInfo({ pid: index + 1, name: `proc-${index + 1}` }))
    const graph = await service({ snapshot: snapshot({ processes }) }).buildNetwork()
    const expanded = await service({ snapshot: snapshot({ processes }) }).buildNetwork({ expandAll: true })

    expect(graph.degraded).toBe(true)
    expect(graph.nodes).toHaveLength(500)
    expect(graph.warnings.some(warning => warning.code === 'E_GRAPH_NODE_LIMIT')).toBe(true)
    expect(expanded.degraded).toBe(false)
    expect(expanded.nodes).toHaveLength(502)
  })

  it('saves snapshots, lists them, and exports mermaid, dot, and svg while refusing fake PNG', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-graph-'))
    try {
      const graphService = service({ root, snapshot: snapshot({ processes: [processInfo()], ports: [portInfo()] }) })
      const graph = await graphService.buildNetwork()
      await graphService.saveSnapshot({ snapshotId: graph.snapshotId, label: 'claude-debug-2026-05-03', confirmedBy: 'vitest' })

      const saved = await graphService.listSavedSnapshots()
      const mermaid = await graphService.exportFormat({ snapshotId: graph.snapshotId, format: 'mermaid' })
      const dot = await graphService.exportFormat({ snapshotId: graph.snapshotId, format: 'dot' })
      const svg = await graphService.exportFormat({ snapshotId: graph.snapshotId, format: 'svg' })

      expect(saved[0]?.label).toBe('claude-debug-2026-05-03')
      expect(mermaid.content).toMatch(/^graph TD/)
      expect(dot.content).toContain('digraph DevHubTopology')
      expect(svg.mimeType).toBe('image/svg+xml')
      await expect(graphService.exportFormat({ snapshotId: graph.snapshotId, format: 'png' })).rejects.toThrow('E_RUNTIME:png export requires renderer canvas')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('marks historical cursor renders explicitly without inventing old data', async () => {
    const graph = await service({ snapshot: snapshot({ processes: [processInfo()] }) }).buildGlobal({ asOfTs: 1_800_000 })

    expect(graph.slice.asOfTs).toBe(1_800_000)
    expect(graph.nodes[0]?.signals?.state).toBe('historical')
    expect(graph.warnings.some(warning => warning.code === 'E_GRAPH_HISTORICAL_CURSOR')).toBe(true)
  })

  it('takes fresh automatic snapshots and prunes only expired auto labels', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-graph-snapshotter-'))
    let currentNow = 2_000_000
    try {
      const graphService = new GraphService({
        getSnapshot: () => snapshot({ processes: [processInfo()], ports: [portInfo()] }),
        getProjects: () => [project()],
        getUserDataRoot: () => root,
        now: () => currentNow
      })
      const snapshotter = new GraphSnapshotter({
        graphService,
        graphKinds: ['network-topology'],
        retentionMs: 1_000,
        now: () => currentNow
      })

      const first = await snapshotter.runOnce('vitest-first')
      const firstSaved = first.saved[0]
      if (!firstSaved) throw new Error('missing first snapshot')

      currentNow += 2_000
      const second = await snapshotter.runOnce('vitest-second')
      const secondSaved = second.saved[0]
      if (!secondSaved) throw new Error('missing second snapshot')

      expect(first.status).toBe('saved')
      expect(second.status).toBe('saved')
      expect(secondSaved.snapshotId).not.toBe(firstSaved.snapshotId)
      expect(second.pruned.map(row => row.path)).toContain(firstSaved.path)
      await expect(readFile(firstSaved.path, 'utf-8')).rejects.toThrow()

      const remaining = await graphService.listSavedSnapshots()
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.label).toBe(secondSaved.label)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips automatic snapshots when the topology feature is disabled', async () => {
    const graphService = service({ snapshot: snapshot({ processes: [processInfo()] }) })
    const snapshotter = new GraphSnapshotter({
      graphService,
      isEnabled: () => false
    })

    const result = await snapshotter.runOnce('vitest-disabled')

    expect(result.status).toBe('skipped')
    expect(result.skippedReason).toBe('disabled')
    expect(result.saved).toEqual([])
  })

  it.each(SPEC24_FIXTURE_GRAPH_KINDS.flatMap(graphKind =>
    SPEC24_FIXTURE_NODE_COUNTS.map(nodeCount => [graphKind, nodeCount] as const)
  ))('covers R8.C spec-24 %s fixture with %i nodes and historical time cursor', async (graphKind, nodeCount) => {
    const graphService = service({
      projects: [],
      snapshot: spec24FixtureSnapshot(graphKind, nodeCount)
    })
    const startedAt = performance.now()
    const graph = await graphService.buildGlobal({
      asOfTs: SPEC24_HISTORICAL_CURSOR,
      expandAll: nodeCount > 500,
      graphKind
    })
    const durationMs = performance.now() - startedAt

    expect(graph.slice.graphKind).toBe(graphKind)
    expect(graph.slice.asOfTs).toBe(SPEC24_HISTORICAL_CURSOR)
    expect(graph.nodes).toHaveLength(nodeCount)
    expect(graph.nodes.every(node => node.signals?.state === 'historical')).toBe(true)
    expect(graph.edges.every(edge =>
      graph.nodes.some(node => node.id === edge.source)
      && graph.nodes.some(node => node.id === edge.target)
    )).toBe(true)
    expect(durationMs).toBeLessThan(SPEC24_BUILD_BUDGET_MS)
  })

  it.each(SPEC24_FIXTURE_GRAPH_KINDS)('keeps R8.C spec-24 %s 800-node fixture guarded by explicit expand-all', async (graphKind) => {
    const graphService = service({
      projects: [],
      snapshot: spec24FixtureSnapshot(graphKind, 800)
    })

    const defaultGraph = await graphService.buildGlobal({ graphKind })
    const expandedGraph = await graphService.buildGlobal({ expandAll: true, graphKind })

    expect(defaultGraph.degraded).toBe(true)
    expect(defaultGraph.nodes).toHaveLength(500)
    expect(defaultGraph.warnings.some(warning => warning.code === 'E_GRAPH_NODE_LIMIT')).toBe(true)
    expect(expandedGraph.degraded).toBe(false)
    expect(expandedGraph.nodes).toHaveLength(800)
  })
})
