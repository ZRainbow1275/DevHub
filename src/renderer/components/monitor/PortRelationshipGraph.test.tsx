import { describe, expect, it } from 'vitest'
import type { PortInfo, ProcessInfo, WindowInfo } from '@shared/types-extended'
import {
  PORT_RELATIONSHIP_DEPTH_MAX,
  buildFlowData,
  isConcreteRemoteAddress,
} from './PortRelationshipGraph'

type GraphEdge = ReturnType<typeof buildFlowData>['edges'][number]
type GraphNode = ReturnType<typeof buildFlowData>['nodes'][number]

function requireEdgeData(edge: GraphEdge | undefined): NonNullable<GraphEdge['data']> {
  expect(edge?.data).toBeDefined()
  if (edge?.data === undefined) {
    throw new Error('Expected relationship edge data')
  }
  return edge.data
}

function requireNode(node: GraphNode | undefined): GraphNode {
  expect(node).toBeDefined()
  if (node === undefined) {
    throw new Error('Expected relationship node')
  }
  return node
}

const processFixture: ProcessInfo = {
  pid: 4242,
  name: 'vite',
  command: 'pnpm dev',
  cpu: 3.2,
  memory: 256,
  status: 'running',
  startTime: 1700000000000,
  type: 'dev-server',
}

const databaseProcessFixture: ProcessInfo = {
  pid: 9393,
  name: 'postgres',
  command: 'postgres -D data',
  cpu: 1.4,
  memory: 512,
  status: 'running',
  startTime: 1700000000100,
  type: 'database',
}

const listeningPortFixture: PortInfo = {
  port: 3000,
  pid: 4242,
  processName: 'vite',
  state: 'LISTENING',
  protocol: 'TCP',
  localAddress: '127.0.0.1:3000',
  foreignAddress: '*:*',
}

const establishedPortFixture: PortInfo = {
  port: 443,
  pid: 4242,
  processName: 'vite',
  state: 'ESTABLISHED',
  protocol: 'TCP',
  localAddress: '127.0.0.1:51000',
  foreignAddress: '93.184.216.34:443',
}

const databasePortFixture: PortInfo = {
  port: 5432,
  pid: 9393,
  processName: 'postgres',
  state: 'LISTENING',
  protocol: 'TCP',
  localAddress: '127.0.0.1:5432',
  foreignAddress: '*:*',
}

const windowFixture: WindowInfo = {
  hwnd: 10101,
  title: 'DevHub',
  processName: 'vite',
  pid: 4242,
  className: 'Chrome_WidgetWin_1',
  rect: { x: 0, y: 0, width: 1280, height: 720 },
  isVisible: true,
  isMinimized: false,
  isSystemWindow: false,
}

describe('PortRelationshipGraph data builder', () => {
  it('builds the default relationship graph from every monitored port', () => {
    const graph = buildFlowData(
      [processFixture, databaseProcessFixture],
      [listeningPortFixture, databasePortFixture],
      [],
      '',
      PORT_RELATIONSHIP_DEPTH_MAX,
    )

    const portNodeIds = graph.nodes
      .filter((node) => node.type === 'flowPort')
      .map((node) => node.id)
      .sort()

    expect(graph.portCount).toBe(2)
    expect(portNodeIds).toEqual(['port-3000-4242', 'port-5432-9393'])
  })

  it('marks the real port to process relation as owns', () => {
    const graph = buildFlowData(
      [processFixture],
      [listeningPortFixture],
      [],
      '',
      PORT_RELATIONSHIP_DEPTH_MAX,
    )

    const ownsEdge = graph.edges.find((edge) => edge.id === 'edge-port-3000-4242-process-4242')
    const ownsEdgeData = requireEdgeData(ownsEdge)

    expect(ownsEdgeData.relationshipKind).toBe('owns')
    expect(ownsEdgeData.edgeType).toBe('port-binds-process')
    expect(ownsEdgeData.sourceKind).toBe('port')
    expect(ownsEdgeData.targetKind).toBe('process')
    expect(ownsEdge?.source).toBe('port-3000-4242')
    expect(ownsEdge?.target).toBe('process-4242')
  })

  it('creates connects edges only from concrete remote addresses', () => {
    const graph = buildFlowData(
      [processFixture],
      [listeningPortFixture, establishedPortFixture],
      [],
      '',
      PORT_RELATIONSHIP_DEPTH_MAX,
    )

    const remoteNodes = graph.nodes.filter((node) => node.type === 'flowRemote')
    const connectsEdges = graph.edges.filter((edge) => edge.data?.relationshipKind === 'connects')
    const remoteNode = requireNode(remoteNodes[0])
    const connectsEdgeData = requireEdgeData(connectsEdges[0])

    expect(remoteNodes).toHaveLength(1)
    expect(remoteNode.id).toBe('remote-93-184-216-34-443')
    expect(remoteNode.data.remoteAddress).toBe('93.184.216.34:443')
    expect(connectsEdges).toHaveLength(1)
    expect(connectsEdges[0]?.source).toBe('port-443-4242')
    expect(connectsEdges[0]?.target).toBe('remote-93-184-216-34-443')
    expect(connectsEdgeData.edgeType).toBe('port-external')
    expect(connectsEdgeData.remoteAddress).toBe('93.184.216.34:443')
  })

  it('filters relationship nodes by adjustable depth', () => {
    const ports = [listeningPortFixture, establishedPortFixture]

    const depthOneGraph = buildFlowData([processFixture], ports, [windowFixture], '', 1)
    expect(depthOneGraph.portCount).toBe(2)
    expect(depthOneGraph.processCount).toBe(1)
    expect(depthOneGraph.windowCount).toBe(0)
    expect(depthOneGraph.remoteCount).toBe(0)
    expect(depthOneGraph.edges.every((edge) => edge.data !== undefined && edge.data.relationshipDepth <= 1)).toBe(true)

    const depthTwoGraph = buildFlowData([processFixture], ports, [windowFixture], '', 2)
    expect(depthTwoGraph.windowCount).toBe(1)
    expect(depthTwoGraph.remoteCount).toBe(0)
    expect(depthTwoGraph.edges.every((edge) => edge.data !== undefined && edge.data.relationshipDepth <= 2)).toBe(true)

    const depthThreeGraph = buildFlowData([processFixture], ports, [windowFixture], '', 3)
    expect(depthThreeGraph.windowCount).toBe(1)
    expect(depthThreeGraph.remoteCount).toBe(1)
    expect(depthThreeGraph.edges.some((edge) => edge.data?.relationshipKind === 'connects')).toBe(true)
  })

  it('does not treat wildcard or zero remote addresses as concrete connections', () => {
    expect(isConcreteRemoteAddress('*:*')).toBe(false)
    expect(isConcreteRemoteAddress('0.0.0.0')).toBe(false)
    expect(isConcreteRemoteAddress('0.0.0.0:0')).toBe(false)
    expect(isConcreteRemoteAddress('[::]:0')).toBe(false)
    expect(isConcreteRemoteAddress('93.184.216.34:443')).toBe(true)
  })
})
