import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GLOBAL_TOPOLOGY_GRAPH_KIND_KEY,
  OPEN_GLOBAL_TOPOLOGY_EVENT,
  SELECTED_GLOBAL_TOPOLOGY_NODE_KEY,
  openGlobalTopologyKind,
  openPortInGlobalTopology,
  openProjectInGlobalTopology,
  openWindowInGlobalTopology,
  parseGlobalTopologyGraphKind,
  readPendingGlobalTopologyGraphKind,
  readPendingGlobalTopologyNodeId,
  toPortTopologyNodeId,
  toProjectTopologyNodeId,
  toWindowTopologyNodeId
} from './globalTopologyNavigation'

afterEach(() => {
  window.sessionStorage.clear()
})

describe('global topology navigation', () => {
  it('uses the full graph node id contract for ports, windows, and projects', () => {
    expect(toPortTopologyNodeId({ port: 5173, pid: 4200, protocol: 'TCP' })).toBe('port-5173-4200-TCP')
    expect(toWindowTopologyNodeId(10001)).toBe('window-10001')
    expect(toProjectTopologyNodeId('devhub')).toBe('project-devhub')
  })

  it('stores the selected port node and dispatches the global topology event', () => {
    const openGlobal = vi.fn()
    window.addEventListener(OPEN_GLOBAL_TOPOLOGY_EVENT, openGlobal)

    openPortInGlobalTopology({ port: 5173, pid: 4200, protocol: 'TCP' })

    expect(window.sessionStorage.getItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY)).toBe('port-5173-4200-TCP')
    expect(openGlobal).toHaveBeenCalledTimes(1)

    window.removeEventListener(OPEN_GLOBAL_TOPOLOGY_EVENT, openGlobal)
  })

  it('stores window and project selections through the same event bridge', () => {
    openWindowInGlobalTopology(10001)
    expect(window.sessionStorage.getItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY)).toBe('window-10001')

    openProjectInGlobalTopology('devhub')
    expect(window.sessionStorage.getItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY)).toBe('project-devhub')
  })

  it('stores a one-shot graph kind intent for direct flow navigation', () => {
    const openGlobal = vi.fn()
    window.addEventListener(OPEN_GLOBAL_TOPOLOGY_EVENT, openGlobal)

    openGlobalTopologyKind('flow')

    expect(window.sessionStorage.getItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY)).toBe('flow')
    expect(openGlobal).toHaveBeenCalledTimes(1)
    const event = openGlobal.mock.calls[0]?.[0]
    expect(event).toBeInstanceOf(CustomEvent)
    expect(event instanceof CustomEvent ? event.detail : null).toEqual({ graphKind: 'flow' })
    expect(readPendingGlobalTopologyGraphKind()).toBe('flow')
    expect(window.sessionStorage.getItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY)).toBeNull()

    window.removeEventListener(OPEN_GLOBAL_TOPOLOGY_EVENT, openGlobal)
  })

  it('consumes pending node and ignores invalid graph kinds without persisting stale values', () => {
    window.sessionStorage.setItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY, 'process-1234')
    window.sessionStorage.setItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY, 'invalid-kind')

    expect(readPendingGlobalTopologyNodeId()).toBe('process-1234')
    expect(readPendingGlobalTopologyGraphKind()).toBeNull()
    expect(parseGlobalTopologyGraphKind('neural-relationship')).toBe('neural-relationship')
    expect(parseGlobalTopologyGraphKind('invalid-kind')).toBeNull()
    expect(window.sessionStorage.getItem(SELECTED_GLOBAL_TOPOLOGY_NODE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(GLOBAL_TOPOLOGY_GRAPH_KIND_KEY)).toBeNull()
  })
})
