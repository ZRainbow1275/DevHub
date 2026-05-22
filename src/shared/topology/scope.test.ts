import { describe, expect, it } from 'vitest'
import { buildScopedFlow, buildScopedTopologyGraph, topologyScopeSchema } from './scope'
import type { Project } from '../types'
import type { PortInfo, ProcessInfo, WindowInfo } from '../types-extended'

const process: ProcessInfo = {
  pid: 4200,
  name: 'node.exe',
  command: 'pnpm dev',
  cpu: 4.2,
  memory: 256,
  status: 'running',
  startTime: 1713830400000,
  type: 'dev-server',
  projectId: 'devhub',
  workingDir: 'D:/Desktop/CREATOR ONE/devhub',
}

const port: PortInfo = {
  port: 5173,
  pid: 4200,
  processName: 'node.exe',
  state: 'LISTENING',
  protocol: 'TCP',
  localAddress: '127.0.0.1:5173',
  foreignAddress: '*:*',
}

const windowInfo: WindowInfo = {
  hwnd: 10001,
  title: 'DevHub',
  processName: 'node.exe',
  pid: 4200,
  className: 'Chrome_WidgetWin_1',
  rect: { x: 0, y: 0, width: 1280, height: 720 },
  isVisible: true,
  isMinimized: false,
  isSystemWindow: false,
}

const project: Project = {
  id: 'devhub',
  name: 'DevHub',
  path: 'D:/Desktop/CREATOR ONE/devhub',
  scripts: ['dev'],
  defaultScript: 'dev',
  projectType: 'npm',
  tags: [],
  status: 'running',
  pid: 4200,
  port: 5173,
  createdAt: 1713830400000,
  updatedAt: 1713830400000,
}

describe('scoped topology builder', () => {
  it('validates scope defaults with zod', () => {
    expect(topologyScopeSchema.parse({ kind: 'process', targetId: 4200 })).toEqual({
      kind: 'process',
      targetId: 4200,
      depth: 2,
    })
  })

  it('builds a process scoped graph from real scan records', () => {
    const graph = buildScopedTopologyGraph(
      { kind: 'process', targetId: 4200, depth: 2 },
      { processes: [process], ports: [port], windows: [windowInfo] },
      'renderer-store'
    )

    expect(graph.nodes.map(node => node.id)).toEqual([
      'process-4200',
      'port-5173-4200-TCP',
      'window-10001',
    ])
    expect(graph.edges).toHaveLength(2)
    expect(graph.nodes.find(node => node.id === 'process-4200')?.root).toBe(true)
  })

  it('builds a project scoped graph from real project and scan records', () => {
    const graph = buildScopedTopologyGraph(
      { kind: 'project', targetId: 'devhub', depth: 2 },
      { projects: [project], processes: [process], ports: [port], windows: [windowInfo] },
      'cache'
    )

    expect(graph.nodes.map(node => node.id)).toEqual([
      'project-devhub',
      'process-4200',
      'port-5173-4200-TCP',
      'window-10001',
    ])
    expect(graph.edges.map(edge => edge.kind)).toContain('project-owns-process')
    expect(graph.nodes.find(node => node.id === 'project-devhub')?.root).toBe(true)
  })

  it('derives a flow from graph edges without synthetic placeholder steps', () => {
    const graph = buildScopedTopologyGraph(
      { kind: 'window', targetId: 10001, depth: 2 },
      { processes: [process], ports: [port], windows: [windowInfo] },
      'cache'
    )
    const flow = buildScopedFlow(graph)

    expect(flow.steps.some(step => step.nodeId === 'window-10001')).toBe(true)
    expect(flow.steps.some(step => step.nodeId === 'process-4200')).toBe(true)
    expect(flow.links.length).toBeGreaterThan(0)
  })
})
