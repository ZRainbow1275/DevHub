import { z } from 'zod'
import type { ServiceResult, PortInfo, PortProtocol, PortState, ProcessInfo } from '@shared/types-extended'
import { importOptionalNativeModule, toRecord } from './nativeImport'

type SystemInformationLoader = () => Promise<unknown | null>

interface SystemInformationRuntime {
  networkConnections: () => Promise<unknown>
  processes: () => Promise<unknown>
}

const rawNetworkConnectionSchema = z.object({
  protocol: z.string().optional(),
  localAddress: z.string().optional(),
  localPort: z.union([z.number(), z.string()]).optional(),
  peerAddress: z.string().optional(),
  peerPort: z.union([z.number(), z.string()]).optional(),
  state: z.string().optional(),
  pid: z.union([z.number(), z.string()]).optional(),
  process: z.string().optional()
}).passthrough()

const rawProcessSchema = z.object({
  pid: z.union([z.number(), z.string()]),
  parentPid: z.union([z.number(), z.string()]).optional(),
  name: z.string().optional(),
  command: z.string().optional(),
  cpu: z.union([z.number(), z.string()]).optional(),
  memRss: z.union([z.number(), z.string()]).optional(),
  started: z.union([z.number(), z.string()]).optional()
}).passthrough()

function toRuntime(moduleValue: unknown): SystemInformationRuntime | null {
  const moduleRecord = toRecord(moduleValue)
  const defaultRecord = toRecord(moduleRecord?.default)
  const candidate = defaultRecord ?? moduleRecord
  const networkConnections = candidate?.networkConnections
  const processes = candidate?.processes
  if (typeof networkConnections !== 'function' || typeof processes !== 'function') return null
  return {
    networkConnections: () => networkConnections.call(candidate) as Promise<unknown>,
    processes: () => processes.call(candidate) as Promise<unknown>
  }
}

function readPositiveInt(value: unknown): number | null {
  const next = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isInteger(next) && next > 0 ? next : null
}

function readFiniteNumber(value: unknown, fallback = 0): number {
  const next = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(next) ? next : fallback
}

function normalizeProtocol(value: string | undefined): PortProtocol | null {
  const normalized = (value ?? '').toUpperCase()
  if (normalized.startsWith('TCP')) return 'TCP'
  if (normalized.startsWith('UDP')) return 'UDP'
  return null
}

function normalizeState(value: string | undefined, protocol: PortProtocol): PortState | null {
  if (protocol === 'UDP') return 'LISTENING'
  const normalized = (value ?? '').toUpperCase()
  const stateMap: Record<string, PortState> = {
    CLOSE_WAIT: 'CLOSE_WAIT',
    ESTABLISHED: 'ESTABLISHED',
    LISTEN: 'LISTENING',
    LISTENING: 'LISTENING',
    TIME_WAIT: 'TIME_WAIT'
  }
  return stateMap[normalized] ?? null
}

function formatEndpoint(address: string | undefined, port: number): string {
  const host = address && address.length > 0 ? address : '0.0.0.0'
  return host.includes(':') && !host.startsWith('[') ? `[${host}]:${port}` : `${host}:${port}`
}

function mapNetworkConnection(value: unknown): PortInfo | null {
  const parsed = rawNetworkConnectionSchema.safeParse(value)
  if (!parsed.success) return null
  const protocol = normalizeProtocol(parsed.data.protocol)
  if (!protocol) return null
  const port = readPositiveInt(parsed.data.localPort)
  const pid = readPositiveInt(parsed.data.pid)
  if (port === null || pid === null) return null
  const state = normalizeState(parsed.data.state, protocol)
  if (!state) return null
  const peerPort = readPositiveInt(parsed.data.peerPort)
  return {
    port,
    pid,
    processName: parsed.data.process?.trim() || `PID:${pid}`,
    state,
    protocol,
    localAddress: formatEndpoint(parsed.data.localAddress, port),
    foreignAddress: peerPort === null ? '*:*' : formatEndpoint(parsed.data.peerAddress, peerPort),
    source: 'systeminformation'
  }
}

function mapProcess(value: unknown): ProcessInfo | null {
  const parsed = rawProcessSchema.safeParse(value)
  if (!parsed.success) return null
  const pid = readPositiveInt(parsed.data.pid)
  if (pid === null) return null
  const ppid = readPositiveInt(parsed.data.parentPid)
  return {
    pid,
    ppid: ppid ?? undefined,
    name: parsed.data.name?.trim() || `PID:${pid}`,
    command: parsed.data.command ?? '',
    cpu: readFiniteNumber(parsed.data.cpu),
    memory: Math.max(0, readFiniteNumber(parsed.data.memRss) / 1024 / 1024),
    status: 'unknown',
    startTime: readFiniteNumber(parsed.data.started),
    type: 'other'
  }
}

export class SystemInformationAdapter {
  constructor(private readonly loadModule: SystemInformationLoader = () => importOptionalNativeModule('systeminformation')) {}

  async listNetworkPorts(): Promise<ServiceResult<PortInfo[]>> {
    const runtime = toRuntime(await this.loadModule())
    if (!runtime) return { success: false, error: 'SYSTEMINFORMATION_UNAVAILABLE' }
    try {
      const rows = await runtime.networkConnections()
      if (!Array.isArray(rows)) return { success: false, error: 'SYSTEMINFORMATION_NETWORK_SHAPE' }
      return { success: true, data: rows.map(mapNetworkConnection).filter((port): port is PortInfo => port !== null) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async listProcesses(): Promise<ServiceResult<ProcessInfo[]>> {
    const runtime = toRuntime(await this.loadModule())
    if (!runtime) return { success: false, error: 'SYSTEMINFORMATION_UNAVAILABLE' }
    try {
      const result = await runtime.processes()
      const record = toRecord(result)
      const rows = Array.isArray(record?.list) ? record.list : []
      return { success: true, data: rows.map(mapProcess).filter((process): process is ProcessInfo => process !== null) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
