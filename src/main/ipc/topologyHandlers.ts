import { ipcMain } from 'electron'
import { IPC_CHANNELS_EXT, type PortInfo, type ProcessInfo, type ServiceResult, type WindowInfo } from '@shared/types-extended'
import type { AppStore } from '../store/AppStore'
import {
  buildScopedFlow,
  buildScopedTopologyGraph,
  topologyScopeSchema,
  type ScopedFlow,
  type ScopedTopologyGraph,
  type ScopedTopologySnapshot,
  type TopologyScope,
} from '@shared/topology/scope'
import { ScannerRegistry } from '../services/runtime/ScannerRegistry'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import type { SharedMonitorRuntime } from './runtimeBundle'

async function collectSnapshot(appStore?: AppStore, runtime?: SharedMonitorRuntime): Promise<{
  snapshot: ScopedTopologySnapshot
  source: ScopedTopologyGraph['source']
}> {
  const cache = runtime?.scannerCache ?? ScannerRegistry.getInstance('scannerCache')
  const processScanner = runtime?.processScanner ?? ScannerRegistry.getInstance('process')
  const portScanner = runtime?.portScanner ?? ScannerRegistry.getInstance('port')
  const windowManager = runtime?.windowManager ?? ScannerRegistry.getInstance('window')
  let source: ScopedTopologyGraph['source'] = 'cache'

  let processes: ProcessInfo[] = cache?.getProcesses() ?? []
  let ports: PortInfo[] = cache?.getPorts() ?? []
  let windows: WindowInfo[] = cache?.getWindows() ?? []
  const projects = appStore?.getProjects() ?? []

  if (processes.length === 0 && processScanner) {
    const result: ServiceResult<ProcessInfo[]> = await processScanner.scan()
    processes = result.data ?? []
    source = 'scan'
  }

  if (ports.length === 0 && portScanner) {
    ports = await portScanner.scanAll()
    source = 'scan'
  }

  if (windows.length === 0 && windowManager) {
    const result: ServiceResult<WindowInfo[]> = await windowManager.scanWindows(false)
    windows = result.data ?? []
    source = 'scan'
  }

  return {
    snapshot: { projects, processes, ports, windows },
    source,
  }
}

function parseScope(input: unknown): TopologyScope {
  const parsed = topologyScopeSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(`Invalid topology scope: ${issue?.message ?? 'validation failed'}`)
  }
  return parsed.data
}

export function setupTopologyHandlers(appStore?: AppStore, runtime?: SharedMonitorRuntime): void {
  cleanupTopologyHandlers()

  ipcMain.handle(IPC_CHANNELS_EXT.TOPOLOGY_BUILD_SCOPED_GRAPH, withRateLimit(
    IPC_CHANNELS_EXT.TOPOLOGY_BUILD_SCOPED_GRAPH,
    RATE_LIMITS.QUERY,
    async (_, input: unknown): Promise<ScopedTopologyGraph> => {
      const scope = parseScope(input)
      const { snapshot, source } = await collectSnapshot(appStore, runtime)
      return buildScopedTopologyGraph(scope, snapshot, source)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.FLOW_BUILD_SCOPED_FLOW, withRateLimit(
    IPC_CHANNELS_EXT.FLOW_BUILD_SCOPED_FLOW,
    RATE_LIMITS.QUERY,
    async (_, input: unknown): Promise<ScopedFlow> => {
      const scope = parseScope(input)
      const { snapshot, source } = await collectSnapshot(appStore, runtime)
      return buildScopedFlow(buildScopedTopologyGraph(scope, snapshot, source))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.TOPOLOGY_WARM_SCOPE, withRateLimit(
    IPC_CHANNELS_EXT.TOPOLOGY_WARM_SCOPE,
    RATE_LIMITS.QUERY,
    async (_, input: unknown): Promise<{ ok: boolean; nodeCount: number; edgeCount: number; source: ScopedTopologyGraph['source'] }> => {
      const scope = parseScope(input)
      const { snapshot, source } = await collectSnapshot(appStore, runtime)
      const graph = buildScopedTopologyGraph(scope, snapshot, source)
      return { ok: true, nodeCount: graph.nodes.length, edgeCount: graph.edges.length, source }
    }
  ))
}

export function cleanupTopologyHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS_EXT.TOPOLOGY_BUILD_SCOPED_GRAPH)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.FLOW_BUILD_SCOPED_FLOW)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.TOPOLOGY_WARM_SCOPE)
}
