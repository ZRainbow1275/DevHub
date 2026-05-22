import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createConnection, createServer, type Server, type Socket } from 'node:net'
import {
  rpcRequestSchema,
  rpcResponseSchema,
  watchdogMarkerFileSchema,
  type RpcRequest,
  type RpcResponse,
  type WatchdogMarkerFile
} from '../shared/schemas/watchdog-rpc.ts'

const WATCHDOG_PROTOCOL_VERSION = '1.0'
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5_000
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 1_000
const TOKEN_PATTERN = /^[a-f0-9]{64}$/

interface InnerWatchdogCliOptions {
  token: string
  markerFilePath: string
  once: boolean
  heartbeatIntervalMs: number
  handshakeTimeoutMs: number
}

interface InnerWatchedInstance {
  instanceId: string
  pid: number | null
  config: Record<string, unknown>
  registeredAt: number
  updatedAt: number
  lastHeartbeatAt: number
}

export function parseInnerWatchdogArgs(argv: readonly string[]): InnerWatchdogCliOptions {
  const token = readArg(argv, '--token') ?? process.env.DEVHUB_WATCHDOG_TOKEN
  const markerFilePath = readArg(argv, '--marker') ?? process.env.DEVHUB_WATCHDOG_MARKER
  if (!token || !TOKEN_PATTERN.test(token)) throw new Error('E_VALIDATION:watchdog token must be 64 lowercase hex characters')
  if (!markerFilePath || markerFilePath.trim().length === 0) throw new Error('E_VALIDATION:watchdog marker path is required')
  return {
    token,
    markerFilePath,
    once: argv.includes('--once'),
    heartbeatIntervalMs: parsePositiveInteger(readArg(argv, '--heartbeat-interval-ms'), DEFAULT_HEARTBEAT_INTERVAL_MS),
    handshakeTimeoutMs: parsePositiveInteger(readArg(argv, '--handshake-timeout-ms'), DEFAULT_HANDSHAKE_TIMEOUT_MS)
  }
}

export async function runInnerWatchdog(options: InnerWatchdogCliOptions): Promise<void> {
  let marker = readMarker(options.markerFilePath, options.token)
  const watchedInstances = new Map<string, InnerWatchedInstance>()
  writeInnerHeartbeat(options.markerFilePath, marker, options.token)
  if (isPidAlive(marker.parentPid)) {
    await sendSupervisorHandshake(marker, options.token, options.handshakeTimeoutMs)
  }
  if (options.once) return

  const rpcServer = await startChildRpcServer(marker, options.token, options.markerFilePath, options.handshakeTimeoutMs, watchedInstances).catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[devhub-watchdog] child RPC server unavailable: ${message}\n`)
    return null
  })

  try {
    await new Promise<void>(resolve => {
      const heartbeat = setInterval(() => {
        marker = readMarker(options.markerFilePath, options.token)
        touchWatchedInstances(watchedInstances, Date.now())
        writeInnerHeartbeat(options.markerFilePath, marker, options.token)
        if (isPidAlive(marker.parentPid)) {
          void sendSupervisorHandshake(marker, options.token, options.handshakeTimeoutMs)
        }
      }, options.heartbeatIntervalMs)

      const stop = (): void => {
        clearInterval(heartbeat)
        resolve()
      }
      process.once('SIGTERM', stop)
      process.once('SIGINT', stop)
    })
  } finally {
    await closeServer(rpcServer)
  }
}

function readArg(argv: readonly string[], name: string): string | null {
  const prefix = `${name}=`
  const inline = argv.find(item => item.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = argv.indexOf(name)
  const next = index >= 0 ? argv[index + 1] : undefined
  return next && !next.startsWith('--') ? next : null
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (value === null) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function readMarker(markerFilePath: string, token: string): WatchdogMarkerFile {
  const parsed = watchdogMarkerFileSchema.parse(JSON.parse(readFileSync(markerFilePath, 'utf8')))
  if (parsed.tokenPrefix !== token.slice(0, 8)) throw new Error('E_PERMISSION_DENIED:watchdog marker token prefix mismatch')
  return parsed
}

function writeInnerHeartbeat(markerFilePath: string, marker: WatchdogMarkerFile, token: string): void {
  mkdirSync(dirname(markerFilePath), { recursive: true })
  const next = watchdogMarkerFileSchema.parse({
    ...marker,
    tokenPrefix: token.slice(0, 8),
    childPidExpected: process.pid,
    writer: 'inner-watchdog',
    updatedAt: Date.now()
  })
  writeFileSync(markerFilePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

async function startChildRpcServer(
  marker: WatchdogMarkerFile,
  token: string,
  markerFilePath: string,
  timeoutMs: number,
  watchedInstances: Map<string, InnerWatchedInstance>
): Promise<Server> {
  const server = createServer(socket => handleChildRpcSocket(socket, token, markerFilePath, watchedInstances))
  server.unref()
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const settle = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      server.off('listening', onListening)
      server.off('error', onError)
      if (error) {
        try {
          server.close()
        } catch (closeError) {
          const message = closeError instanceof Error ? closeError.message : String(closeError)
          process.stderr.write(`[devhub-watchdog] child RPC cleanup failed: ${message}\n`)
        }
        reject(error)
      } else {
        resolve()
      }
    }
    const onListening = (): void => settle()
    const onError = (error: Error): void => settle(error)
    const timeout = setTimeout(() => {
      settle(new Error('E_TIMEOUT:inner watchdog child RPC server did not start'))
    }, timeoutMs)
    server.once('listening', onListening)
    server.once('error', onError)
    server.listen(marker.eventPipePath)
  })
  return server
}

function handleChildRpcSocket(socket: Socket, token: string, markerFilePath: string, watchedInstances: Map<string, InnerWatchedInstance>): void {
  socket.setEncoding('utf8')
  let buffer = ''
  socket.on('data', chunk => {
    buffer += chunk
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line.length > 0) handleChildRpcLine(socket, line, token, markerFilePath, watchedInstances)
      newlineIndex = buffer.indexOf('\n')
    }
  })
  socket.on('end', () => {
    const line = buffer.trim()
    if (line.length > 0) handleChildRpcLine(socket, line, token, markerFilePath, watchedInstances)
  })
}

function handleChildRpcLine(
  socket: Socket,
  line: string,
  token: string,
  markerFilePath: string,
  watchedInstances: Map<string, InnerWatchedInstance>
): void {
  try {
    const request = rpcRequestSchema.parse(JSON.parse(line) as unknown)
    socket.write(`${JSON.stringify(handleChildRpcRequest(request, token, markerFilePath, watchedInstances))}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    socket.write(`${JSON.stringify(rpcResponseSchema.parse({ jsonrpc: '2.0', id: 'unknown', error: { code: -32000, message } }))}\n`)
  }
}

function handleChildRpcRequest(
  request: RpcRequest,
  token: string,
  markerFilePath: string,
  watchedInstances: Map<string, InnerWatchedInstance>
): RpcResponse {
  if (!hasValidSessionToken(request.params, token)) {
    return rpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32001, message: 'E_PERMISSION_DENIED:watchdog child RPC sessionToken mismatch' }
    })
  }
  const marker = readMarker(markerFilePath, token)
  const orphan = !isPidAlive(marker.parentPid)
  if (orphan && request.method !== 'ping' && request.method !== 'get-status' && request.method !== 'shutdown') {
    return rpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32003, message: 'E_ORPHAN_READ_ONLY:InnerWatchdog is orphaned and refuses new control instructions' }
    })
  }
  if (request.method === 'ping') {
    return rpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        pong: true,
        pid: process.pid,
        parentPid: marker.parentPid,
        mode: orphan ? 'orphan' : 'attached',
        registeredInstanceCount: watchedInstances.size,
        checkedAt: Date.now()
      }
    })
  }
  if (request.method === 'get-status') {
    return rpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        pid: process.pid,
        parentPid: marker.parentPid,
        mode: orphan ? 'orphan' : 'attached',
        protocolVersion: WATCHDOG_PROTOCOL_VERSION,
        markerUpdatedAt: marker.updatedAt,
        registeredInstanceCount: watchedInstances.size,
        registeredInstances: summarizeWatchedInstances(watchedInstances)
      }
    })
  }
  if (request.method === 'register-instance') {
    return registerWatchedInstance(request, marker, watchedInstances)
  }
  if (request.method === 'deregister-instance') {
    return deregisterWatchedInstance(request, watchedInstances)
  }
  if (request.method === 'configure-instance') {
    return configureWatchedInstance(request, watchedInstances)
  }
  if (request.method === 'shutdown') {
    const graceMs = parseGraceMs(request.params)
    const shutdownTimer = setTimeout(() => {
      process.exit(0)
    }, graceMs)
    shutdownTimer.unref()
    return rpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: request.id,
      result: { accepted: true, graceMs }
    })
  }
  return rpcResponseSchema.parse({
    jsonrpc: '2.0',
    id: request.id,
    error: { code: -32601, message: `E_UNSUPPORTED:watchdog RPC method ${request.method} is not implemented in InnerWatchdog child runtime` }
  })
}

function registerWatchedInstance(request: RpcRequest, marker: WatchdogMarkerFile, watchedInstances: Map<string, InnerWatchedInstance>): RpcResponse {
  const params = request.params ?? {}
  const instanceId = readNonEmptyString(params, 'instanceId')
  if (!instanceId) return validationError(request.id, 'E_VALIDATION:instanceId is required')
  const now = Date.now()
  const existing = watchedInstances.get(instanceId)
  watchedInstances.set(instanceId, {
    instanceId,
    pid: readPositiveInteger(params, 'pid'),
    config: readConfig(params),
    registeredAt: existing?.registeredAt ?? now,
    updatedAt: now,
    lastHeartbeatAt: now
  })
  return rpcResponseSchema.parse({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      accepted: true,
      instanceId,
      parentPid: marker.parentPid,
      mode: 'attached',
      registeredInstanceCount: watchedInstances.size
    }
  })
}

function deregisterWatchedInstance(request: RpcRequest, watchedInstances: Map<string, InnerWatchedInstance>): RpcResponse {
  const params = request.params ?? {}
  const instanceId = readNonEmptyString(params, 'instanceId')
  if (!instanceId) return validationError(request.id, 'E_VALIDATION:instanceId is required')
  const removed = watchedInstances.delete(instanceId)
  return rpcResponseSchema.parse({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      accepted: true,
      removed,
      instanceId,
      registeredInstanceCount: watchedInstances.size
    }
  })
}

function configureWatchedInstance(request: RpcRequest, watchedInstances: Map<string, InnerWatchedInstance>): RpcResponse {
  const params = request.params ?? {}
  const instanceId = readNonEmptyString(params, 'instanceId')
  if (!instanceId) return validationError(request.id, 'E_VALIDATION:instanceId is required')
  const existing = watchedInstances.get(instanceId)
  if (!existing) {
    return rpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32004, message: `E_NOT_FOUND:watchdog instance ${instanceId} is not registered` }
    })
  }
  const now = Date.now()
  watchedInstances.set(instanceId, {
    ...existing,
    pid: Object.prototype.hasOwnProperty.call(params, 'pid') ? readPositiveInteger(params, 'pid') : existing.pid,
    config: readConfig(params, existing.config),
    updatedAt: now
  })
  return rpcResponseSchema.parse({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      accepted: true,
      instanceId,
      registeredInstanceCount: watchedInstances.size
    }
  })
}

function summarizeWatchedInstances(watchedInstances: Map<string, InnerWatchedInstance>): Array<Record<string, unknown>> {
  return Array.from(watchedInstances.values()).map(instance => ({
    instanceId: instance.instanceId,
    pid: instance.pid,
    registeredAt: instance.registeredAt,
    updatedAt: instance.updatedAt,
    lastHeartbeatAt: instance.lastHeartbeatAt,
    configKeys: Object.keys(instance.config).sort()
  }))
}

function touchWatchedInstances(watchedInstances: Map<string, InnerWatchedInstance>, timestamp: number): void {
  for (const [instanceId, instance] of watchedInstances.entries()) {
    watchedInstances.set(instanceId, {
      ...instance,
      lastHeartbeatAt: timestamp
    })
  }
}

function readNonEmptyString(params: Record<string, unknown>, key: string): string | null {
  const value = params[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readPositiveInteger(params: Record<string, unknown>, key: string): number | null {
  const value = params[key]
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function readConfig(params: Record<string, unknown>, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  const value = params.config
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...fallback }
  return { ...(value as Record<string, unknown>) }
}

function validationError(id: RpcRequest['id'], message: string): RpcResponse {
  return rpcResponseSchema.parse({
    jsonrpc: '2.0',
    id,
    error: { code: -32602, message }
  })
}

function hasValidSessionToken(params: unknown, token: string): boolean {
  if (!params || typeof params !== 'object') return false
  return (params as Record<string, unknown>).sessionToken === token
}

function parseGraceMs(params: unknown): number {
  if (!params || typeof params !== 'object') return 0
  const value = (params as Record<string, unknown>).graceMs
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= 30_000 ? value : 0
}

async function closeServer(server: Server | null): Promise<void> {
  if (!server) return
  if (!server.listening) {
    try {
      server.close()
    } catch {
      return
    }
    return
  }
  await new Promise<void>(resolve => {
    server.close(() => resolve())
  })
}

async function sendSupervisorHandshake(marker: WatchdogMarkerFile, token: string, timeoutMs: number): Promise<boolean> {
  if (await sendNamedPipeHandshake(marker, token, timeoutMs)) return true
  return await sendTcpHandshake(marker, token, timeoutMs)
}

async function sendNamedPipeHandshake(marker: WatchdogMarkerFile, token: string, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    let settled = false
    const settle = (value: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(value)
    }
    const timeout = setTimeout(() => {
      socket.destroy()
      settle(false)
    }, timeoutMs)
    const socket = createConnection(marker.namedPipePath)
    socket.once('connect', () => {
      const handshake = {
        type: 'handshake',
        sessionToken: token,
        protocolVersion: WATCHDOG_PROTOCOL_VERSION,
        parentPid: marker.parentPid
      }
      socket.end(`${JSON.stringify(handshake)}\n`)
      settle(true)
    })
    socket.once('error', () => settle(false))
  })
}

async function sendTcpHandshake(marker: WatchdogMarkerFile, token: string, timeoutMs: number): Promise<boolean> {
  if (marker.tcpPort === null) return false
  const port = marker.tcpPort
  return new Promise<boolean>(resolve => {
    let settled = false
    const settle = (value: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(value)
    }
    const timeout = setTimeout(() => {
      socket.destroy()
      settle(false)
    }, timeoutMs)
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      const handshake = {
        type: 'handshake',
        sessionToken: token,
        protocolVersion: WATCHDOG_PROTOCOL_VERSION,
        parentPid: marker.parentPid
      }
      socket.end(`${JSON.stringify(handshake)}\n`)
      settle(true)
    })
    socket.once('error', () => settle(false))
  })
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
    return code !== 'ESRCH'
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runInnerWatchdog(parseInnerWatchdogArgs(process.argv.slice(2))).catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[devhub-watchdog] ${message}\n`)
    process.exitCode = 1
  })
}
