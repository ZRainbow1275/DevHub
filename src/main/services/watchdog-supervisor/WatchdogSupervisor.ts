import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createConnection, createServer, type Server, type Socket } from 'node:net'
import { dirname } from 'node:path'
import {
  rpcChannelSchema,
  rpcRequestSchema,
  rpcResponseSchema,
  sessionTokenContextSchema,
  watchdogMarkerFileSchema,
  supervisorStateSchema,
  watchdogChannelDiagnosticSchema,
  watchdogSupervisorStatusSchema,
  type HandshakeMessage,
  type RpcChannel,
  type SessionTokenContext,
  type SupervisorState,
  type WatchdogChannelDiagnostic,
  type RpcRequest,
  type RpcResponse,
  type WatchdogMarkerFile,
  type WatchdogSupervisorRespawnRequest,
  type WatchdogSupervisorServiceRequest,
  type WatchdogSupervisorStatus
} from '@shared/schemas/watchdog-rpc'
import { HandshakeProtocol, WATCHDOG_PROTOCOL_VERSION } from './HandshakeProtocol'
import { MutualHeartbeat } from './MutualHeartbeat'
import { WatchdogSpawner, type WatchdogSpawnResult } from './WatchdogSpawner'
import { WindowsServiceInstaller, type WindowsServiceOperationResult } from './WindowsServiceInstaller'

export interface WatchdogSupervisorStore {
  get(key: string, defaultValue?: unknown): unknown
  set(key: string, value: unknown): void
}

export interface WatchdogSupervisorOptions {
  store: WatchdogSupervisorStore
  markerRoot: string
  parentPid?: number
  now?: () => number
  childEntryFile?: string | null
  spawner?: WatchdogSpawner
  serviceInstaller?: WindowsServiceInstaller
}

interface SupervisorPersistedState extends SupervisorState {
  status?: WatchdogSupervisorStatus['status']
  serviceName?: string | null
  tcpPort?: number | null
  evidence?: string[]
  spawnAttemptTimestamps?: number[]
}

export interface WatchdogRespawnResult {
  success: boolean
  code: 'OK' | 'E_PERMISSION' | 'E_SPAWN_FAILED' | 'E_RESTART_STORM'
  message: string
  status: WatchdogSupervisorStatus
  spawnResult?: WatchdogSpawnResult
}

const SUPERVISOR_SESSION_KEY = 'watchdogSupervisorSession'
const SUPERVISOR_STATE_KEY = 'watchdogSupervisorState'
const SUPERVISOR_CHANNELS_KEY = 'watchdogSupervisorChannels'
const ONE_HOUR_MS = 3_600_000
const HANDSHAKE_GRACE_MS = 5_000
const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 16000] as const

export class WatchdogSupervisor {
  private readonly protocol = new HandshakeProtocol()
  private readonly heartbeat = new MutualHeartbeat()
  private readonly spawner: WatchdogSpawner
  private readonly serviceInstaller: WindowsServiceInstaller
  private readonly now: () => number
  private readonly markerRoot: string
  private readonly parentPid: number
  private readonly childEntryFile: string | null
  private readonly store: WatchdogSupervisorStore
  private namedPipeServer: Server | null = null
  private namedPipePath: string | null = null
  private tcpServer: Server | null = null
  private parentPingTimer: ReturnType<typeof setInterval> | null = null
  private takeoverMarkerPending = false

  constructor(options: WatchdogSupervisorOptions) {
    this.markerRoot = options.markerRoot
    this.parentPid = options.parentPid ?? process.pid
    this.now = options.now ?? (() => Date.now())
    this.spawner = options.spawner ?? new WatchdogSpawner()
    this.serviceInstaller = options.serviceInstaller ?? new WindowsServiceInstaller()
    this.childEntryFile = options.childEntryFile ?? null
    this.store = options.store
  }

  async startNamedPipeServer(timeoutMs = 1000): Promise<WatchdogSupervisorStatus> {
    const context = this.ensureSession()
    const path = this.protocol.namedPipePath(context.token)
    if (this.namedPipeServer && this.namedPipePath === path) return this.status()
    await this.closeNamedPipeServer()
    const server = createServer(socket => this.handleNamedPipeSocket(socket))
    server.unref()
    this.namedPipeServer = server
    this.namedPipePath = path
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const settle = (error?: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        server.off('listening', onListening)
        server.off('error', onError)
        if (error) reject(error)
        else resolve()
      }
      const onListening = (): void => settle()
      const onError = (error: Error): void => {
        this.recordChannelHeartbeat({ channel: 'named-pipe', ok: false, error: error.message })
        settle(error)
      }
      const timeout = setTimeout(() => {
        this.recordChannelHeartbeat({ channel: 'named-pipe', ok: false, error: 'named pipe listen timeout' })
        settle(new Error('E_TIMEOUT:watchdog named pipe server did not start'))
      }, timeoutMs)
      server.once('listening', onListening)
      server.once('error', onError)
      server.listen(path)
    })
    const state = this.readState()
    this.persistState({
      ...state,
      evidence: [...(state.evidence ?? []), `parent named-pipe server listening at ${this.protocol.tokenPrefix(context.token)}`].slice(-20)
    })
    return this.status()
  }

  async startTcpServer(timeoutMs = 1000): Promise<WatchdogSupervisorStatus> {
    const existingPort = this.readState().tcpPort
    if (this.tcpServer && existingPort !== null) return this.status()
    await this.closeTcpServer()
    const server = createServer(socket => this.handleRpcSocket(socket, 'tcp-localhost'))
    server.unref()
    this.tcpServer = server
    const port = await new Promise<number>((resolve, reject) => {
      let settled = false
      const settle = (error?: Error, resolvedPort?: number): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        server.off('listening', onListening)
        server.off('error', onError)
        if (error) reject(error)
        else resolve(resolvedPort ?? 0)
      }
      const onListening = (): void => {
        const address = server.address()
        if (!address || typeof address === 'string') {
          settle(new Error('E_RUNTIME:watchdog TCP server did not expose a port'))
          return
        }
        settle(undefined, address.port)
      }
      const onError = (error: Error): void => {
        this.recordChannelHeartbeat({ channel: 'tcp-localhost', ok: false, error: error.message })
        settle(error)
      }
      const timeout = setTimeout(() => {
        this.recordChannelHeartbeat({ channel: 'tcp-localhost', ok: false, error: 'TCP listen timeout' })
        settle(new Error('E_TIMEOUT:watchdog TCP server did not start'))
      }, timeoutMs)
      server.once('listening', onListening)
      server.once('error', onError)
      server.listen(0, '127.0.0.1')
    })
    const state = this.readState()
    this.persistState({
      ...state,
      tcpPort: port,
      evidence: [...(state.evidence ?? []), `parent TCP fallback server listening on 127.0.0.1:${port}`].slice(-20)
    })
    this.writeMarker(this.ensureSession())
    return this.status()
  }

  async dispose(): Promise<void> {
    this.stopMutualHeartbeat()
    await this.closeNamedPipeServer()
    await this.closeTcpServer()
  }

  startMutualHeartbeat(intervalMs = 5_000, timeoutMs = 1_000): WatchdogSupervisorStatus {
    if (!Number.isInteger(intervalMs) || intervalMs < 25) throw new Error('E_VALIDATION:watchdog heartbeat interval must be at least 25ms')
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs >= intervalMs) throw new Error('E_VALIDATION:watchdog heartbeat timeout must be positive and below interval')
    if (this.parentPingTimer !== null) return this.status()
    const timer = setInterval(() => {
      void this.pingInnerWatchdog(timeoutMs)
    }, intervalMs)
    const maybeUnref = timer as { unref?: () => void }
    maybeUnref.unref?.()
    this.parentPingTimer = timer
    const state = this.readState()
    this.persistState({
      ...state,
      evidence: [...(state.evidence ?? []), `parent-to-inner watchdog heartbeat scheduler started every ${intervalMs}ms`].slice(-20)
    })
    return this.status()
  }

  stopMutualHeartbeat(): void {
    if (this.parentPingTimer === null) return
    clearInterval(this.parentPingTimer)
    this.parentPingTimer = null
  }

  async pingInnerWatchdog(timeoutMs = 1000): Promise<WatchdogSupervisorStatus> {
    const context = this.ensureSession()
    const marker = this.readInnerWatchdogMarker(context)
    if (marker === null) {
      return this.recordChannelHeartbeat({
        channel: 'named-pipe',
        ok: false,
        error: 'E_RUNTIME:inner watchdog marker is unavailable for parent-to-child ping'
      })
    }
    try {
      const request = rpcRequestSchema.parse({
        jsonrpc: '2.0',
        id: `parent-ping-${this.now()}`,
        method: 'ping',
        params: { sessionToken: context.token }
      })
      const response = await this.sendRpcRequest(marker.eventPipePath, request, timeoutMs)
      if (response.error) {
        return this.recordChannelHeartbeat({ channel: 'named-pipe', ok: false, error: response.error.message })
      }
      if (!this.isPongResult(response.result)) {
        return this.recordChannelHeartbeat({ channel: 'named-pipe', ok: false, error: 'E_VALIDATION:inner watchdog ping response was not a pong result' })
      }
      this.recordChannelHeartbeat({ channel: 'named-pipe', at: this.now() })
      const pid = this.numberField(response.result, 'pid')
      const state = this.readState()
      this.persistState({
        ...state,
        evidence: [
          ...(state.evidence ?? []),
          pid === null ? 'parent-to-inner watchdog ping acknowledged' : `parent-to-inner watchdog ping acknowledged by pid ${pid}`
        ].slice(-20)
      })
      return this.status()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return this.recordChannelHeartbeat({ channel: 'named-pipe', ok: false, error: message })
    }
  }

  status(): WatchdogSupervisorStatus {
    const context = this.ensureSession()
    const state = this.readState()
    const diagnostics = state.innerWatchdogPid !== null || state.startedAt !== null
      ? this.heartbeat.evaluate(this.readDiagnostics(), this.now())
      : this.readDiagnostics()
    this.persistDiagnostics(diagnostics)
    const forceTakeoverMarker = this.takeoverMarkerPending
    this.takeoverMarkerPending = false
    this.writeMarker(context, forceTakeoverMarker)
    return this.buildStatus(state, diagnostics, context)
  }

  acceptHandshake(input: unknown): HandshakeMessage {
    return this.acceptHandshakeForChannel(input, 'named-pipe')
  }

  private acceptHandshakeForChannel(input: unknown, channel: RpcChannel): HandshakeMessage {
    const context = this.ensureSession()
    const handshake = this.protocol.validateHandshake(input, context)
    const at = this.now()
    const current = this.readState()
    this.persistState({ ...current, startedAt: current.startedAt ?? at, lastInnerHeartbeatAt: at, innerHealthy: true })
    this.recordChannelHeartbeat({ channel, at })
    return handshake
  }

  recordChannelHeartbeat(input: { channel: RpcChannel; at?: number; ok?: boolean; error?: string | null }): WatchdogSupervisorStatus {
    const channel = rpcChannelSchema.parse(input.channel)
    const at = input.at ?? this.now()
    const nextDiagnostics = this.heartbeat.record(this.readDiagnostics(), { channel, at, ok: input.ok, error: input.error })
    this.persistDiagnostics(nextDiagnostics)
    const state = this.readState()
    const nextState = this.persistState({
      ...state,
      lastInnerHeartbeatAt: this.latestHeartbeat(nextDiagnostics),
      innerHealthy: this.heartbeat.innerHealthy(nextDiagnostics),
      channelStates: this.heartbeat.toChannelStates(nextDiagnostics)
    })
    return this.buildStatus(nextState, nextDiagnostics, this.ensureSession())
  }

  evaluate(): WatchdogSupervisorStatus {
    const diagnostics = this.heartbeat.evaluate(this.readDiagnostics(), this.now())
    this.persistDiagnostics(diagnostics)
    const current = this.readState()
    const innerHealthy = this.heartbeat.innerHealthy(diagnostics)
    const status = this.statusFor(current, diagnostics)
    const nextState = this.persistState({
      ...current,
      innerHealthy,
      channelStates: this.heartbeat.toChannelStates(diagnostics),
      status
    })
    return this.buildStatus(nextState, diagnostics, this.ensureSession())
  }

  requestRespawn(input: WatchdogSupervisorRespawnRequest): WatchdogRespawnResult {
    if (!input.confirmedBy || input.confirmedBy.length < 3) {
      return { success: false, code: 'E_PERMISSION', message: 'confirmedBy required for watchdog supervisor respawn', status: this.status() }
    }
    const now = this.now()
    const attempts = this.recentSpawnAttempts(now)
    if (attempts.length >= 5) {
      this.persistState({
        ...this.readState(),
        status: 'fatal',
        lastSpawnError: 'E_RESTART_STORM:inner watchdog respawn rejected after 5 attempts in 1 hour',
        evidence: [`respawn rejected by storm governor: ${attempts.length} attempts in 1h`],
        spawnAttemptTimestamps: attempts
      })
      return { success: false, code: 'E_RESTART_STORM', message: 'inner watchdog respawn rejected by storm governor', status: this.status() }
    }
    const context = this.ensureSession()
    const markerFilePath = this.markerFilePath(context)
    this.writeMarker(context)
    const nextAttempts = [...attempts, now]
    if (!this.childEntryFile) {
      this.persistState({
        ...this.readState(),
        status: 'not-started',
        spawnAttempts: nextAttempts.length,
        lastSpawnError: 'E_SPAWN_FAILED:inner watchdog entry file is not configured',
        evidence: [`respawn requested by ${input.confirmedBy}`, input.reason ?? 'operator-requested'],
        spawnAttemptTimestamps: nextAttempts
      })
      return { success: false, code: 'E_SPAWN_FAILED', message: 'inner watchdog entry file is not configured', status: this.status() }
    }
    void this.startNamedPipeServer().catch(error => {
      this.recordChannelHeartbeat({ channel: 'named-pipe', ok: false, error: error instanceof Error ? error.message : String(error) })
    })
    void this.startTcpServer().catch(error => {
      this.recordChannelHeartbeat({ channel: 'tcp-localhost', ok: false, error: error instanceof Error ? error.message : String(error) })
    })
    const command = this.spawner.buildNodeCommand(this.childEntryFile, context.token, markerFilePath)
    const spawnResult = this.spawner.spawn(command)
    this.persistSpawnResult(spawnResult, nextAttempts)
    return {
      success: spawnResult.started,
      code: spawnResult.started ? 'OK' : 'E_SPAWN_FAILED',
      message: spawnResult.started ? 'inner watchdog spawn requested' : spawnResult.error ?? 'inner watchdog spawn failed',
      status: this.status(),
      spawnResult
    }
  }

  async installService(input: WatchdogSupervisorServiceRequest): Promise<WindowsServiceOperationResult> {
    const result = await this.serviceInstaller.install(this.serviceBinaryPath(), input)
    if (result.success) {
      const state = this.readState()
      this.persistState({
        ...state,
        windowsServiceInstalled: true,
        serviceName: result.serviceName,
        evidence: [...(state.evidence ?? []), 'Windows Service install verified by sc.exe query after elevated execution'].slice(-20)
      })
    }
    return result
  }

  async uninstallService(input: WatchdogSupervisorServiceRequest): Promise<WindowsServiceOperationResult> {
    const result = await this.serviceInstaller.uninstall(input)
    if (result.success) {
      const state = this.readState()
      this.persistState({
        ...state,
        windowsServiceInstalled: false,
        serviceName: null,
        evidence: [...(state.evidence ?? []), 'Windows Service uninstall verified by sc.exe query after elevated execution'].slice(-20)
      })
    }
    return result
  }

  loadMarkerFileForDiagnostics(): unknown {
    const context = this.ensureSession()
    const markerFilePath = this.markerFilePath(context)
    if (!existsSync(markerFilePath)) return null
    return JSON.parse(readFileSync(markerFilePath, 'utf8'))
  }

  private ensureSession(): SessionTokenContext {
    const stored = sessionTokenContextSchema.safeParse(this.store.get(SUPERVISOR_SESSION_KEY, null))
    if (stored.success && stored.data.parentPid === this.parentPid) return stored.data
    if (stored.success && !this.isPidAlive(stored.data.parentPid)) {
      const adopted = sessionTokenContextSchema.parse({ ...stored.data, parentPid: this.parentPid })
      this.store.set(SUPERVISOR_SESSION_KEY, adopted)
      this.takeoverMarkerPending = true
      const state = this.readState()
      this.persistState({
        ...state,
        evidence: [
          ...(state.evidence ?? []),
          `restart takeover adopted existing watchdog session from parent pid ${stored.data.parentPid} to ${this.parentPid}`
        ].slice(-20)
      })
      return adopted
    }
    const created = this.protocol.createSession(this.parentPid, this.now())
    this.store.set(SUPERVISOR_SESSION_KEY, created)
    return created
  }

  private readState(): SupervisorPersistedState {
    const rawValue = this.store.get(SUPERVISOR_STATE_KEY, null)
    const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, unknown> : {}
    const parsed = supervisorStateSchema.safeParse({
      innerWatchdogPid: raw.innerWatchdogPid,
      startedAt: raw.startedAt,
      lastInnerHeartbeatAt: raw.lastInnerHeartbeatAt,
      innerHealthy: raw.innerHealthy,
      channelStates: raw.channelStates,
      spawnAttempts: raw.spawnAttempts,
      lastSpawnError: raw.lastSpawnError,
      windowsServiceInstalled: raw.windowsServiceInstalled
    })
    if (parsed.success) {
      return {
        ...parsed.data,
        status: this.parseStatus(raw.status),
        serviceName: typeof raw.serviceName === 'string' ? raw.serviceName : null,
        tcpPort: typeof raw.tcpPort === 'number' ? raw.tcpPort : null,
        evidence: this.parseEvidence(raw.evidence),
        spawnAttemptTimestamps: this.parseAttempts(raw.spawnAttemptTimestamps)
      }
    }
    return {
      innerWatchdogPid: null,
      startedAt: null,
      lastInnerHeartbeatAt: null,
      innerHealthy: false,
      channelStates: this.heartbeat.toChannelStates(this.heartbeat.createDiagnostics()),
      spawnAttempts: 0,
      lastSpawnError: null,
      windowsServiceInstalled: false,
      status: 'not-started',
      serviceName: null,
      tcpPort: null,
      evidence: ['inner watchdog subprocess is not started by default'],
      spawnAttemptTimestamps: []
    }
  }

  private persistState(state: SupervisorPersistedState): SupervisorPersistedState {
    this.store.set(SUPERVISOR_STATE_KEY, state)
    return state
  }

  private async closeServer(server: Server | null): Promise<void> {
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

  private async closeNamedPipeServer(): Promise<void> {
    const server = this.namedPipeServer
    this.namedPipeServer = null
    this.namedPipePath = null
    await this.closeServer(server)
  }

  private handleNamedPipeSocket(socket: Socket): void {
    this.handleRpcSocket(socket, 'named-pipe')
  }

  private async closeTcpServer(): Promise<void> {
    const server = this.tcpServer
    this.tcpServer = null
    await this.closeServer(server)
  }

  private handleRpcSocket(socket: Socket, channel: RpcChannel): void {
    socket.setEncoding('utf8')
    let buffer = ''
    socket.on('data', chunk => {
      buffer += chunk
      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (line.length > 0) this.handleRpcLine(socket, line, channel)
        newlineIndex = buffer.indexOf('\n')
      }
    })
    socket.on('end', () => {
      const line = buffer.trim()
      if (line.length > 0) this.handleRpcLine(socket, line, channel)
    })
    socket.on('error', error => {
      this.recordChannelHeartbeat({ channel, ok: false, error: error.message })
    })
  }

  private handleRpcLine(socket: Socket, line: string, channel: RpcChannel): void {
    try {
      const parsed = JSON.parse(line) as unknown
      const context = this.ensureSession()
      if (this.isHandshakeLike(parsed)) {
        this.acceptHandshakeForChannel(parsed, channel)
        this.writeRpcResult(socket, 'handshake', { accepted: true, channel })
        return
      }
      const request = rpcRequestSchema.parse(parsed)
      const response = this.handleRpcRequest(request, context, channel)
      socket.write(`${JSON.stringify(response)}\n`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.recordChannelHeartbeat({ channel, ok: false, error: message })
      this.writeRpcError(socket, 'unknown', -32000, message)
    }
  }

  private handleRpcRequest(request: RpcRequest, context: SessionTokenContext, channel: RpcChannel): RpcResponse {
    if (!this.hasValidSessionToken(request.params, context.token)) {
      return rpcResponseSchema.parse({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32001, message: 'E_PERMISSION_DENIED:watchdog RPC sessionToken mismatch' }
      })
    }
    if (request.method === 'ping') {
      const status = this.recordChannelHeartbeat({ channel, at: this.now() })
      return rpcResponseSchema.parse({
        jsonrpc: '2.0',
        id: request.id,
        result: { pong: true, checkedAt: status.checkedAt, status: status.status }
      })
    }
    if (request.method === 'get-status') {
      return rpcResponseSchema.parse({ jsonrpc: '2.0', id: request.id, result: this.status() })
    }
    if (request.method === 'shutdown') {
      return rpcResponseSchema.parse({ jsonrpc: '2.0', id: request.id, result: { accepted: true } })
    }
    return rpcResponseSchema.parse({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: `E_UNSUPPORTED:watchdog RPC method ${request.method} is not implemented in parent control plane` }
    })
  }

  private async sendRpcRequest(path: string, request: RpcRequest, timeoutMs: number): Promise<RpcResponse> {
    return await new Promise<RpcResponse>((resolve, reject) => {
      let buffer = ''
      let settled = false
      const socket = createConnection(path)
      const settle = (error?: Error, response?: RpcResponse): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        socket.destroy()
        if (error) reject(error)
        else resolve(response ?? rpcResponseSchema.parse({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32000, message: 'E_RUNTIME:empty watchdog RPC response' }
        }))
      }
      const timeout = setTimeout(() => {
        settle(new Error('E_TIMEOUT:inner watchdog RPC ping timed out'))
      }, timeoutMs)
      socket.setEncoding('utf8')
      socket.once('connect', () => {
        socket.write(`${JSON.stringify(request)}\n`)
      })
      socket.on('data', chunk => {
        buffer += chunk
        const newlineIndex = buffer.indexOf('\n')
        if (newlineIndex < 0) return
        try {
          settle(undefined, rpcResponseSchema.parse(JSON.parse(buffer.slice(0, newlineIndex)) as unknown))
        } catch (error) {
          settle(error instanceof Error ? error : new Error(String(error)))
        }
      })
      socket.once('error', error => settle(error))
    })
  }

  private writeRpcResult(socket: Socket, id: string | number, result: Record<string, unknown>): void {
    socket.write(`${JSON.stringify(rpcResponseSchema.parse({ jsonrpc: '2.0', id, result }))}\n`)
  }

  private writeRpcError(socket: Socket, id: string | number, code: number, message: string): void {
    socket.write(`${JSON.stringify(rpcResponseSchema.parse({ jsonrpc: '2.0', id, error: { code, message } }))}\n`)
  }

  private isHandshakeLike(input: unknown): input is HandshakeMessage {
    return Boolean(input && typeof input === 'object' && (input as Record<string, unknown>).type === 'handshake')
  }

  private hasValidSessionToken(params: unknown, token: string): boolean {
    if (!params || typeof params !== 'object') return false
    return (params as Record<string, unknown>).sessionToken === token
  }

  private readInnerWatchdogMarker(context: SessionTokenContext): WatchdogMarkerFile | null {
    const markerFilePath = this.markerFilePath(context)
    try {
      if (!existsSync(markerFilePath)) return null
      const parsed = watchdogMarkerFileSchema.safeParse(JSON.parse(readFileSync(markerFilePath, 'utf8')))
      if (!parsed.success) return null
      if (parsed.data.writer !== 'inner-watchdog') return null
      if (parsed.data.tokenPrefix !== this.protocol.tokenPrefix(context.token)) return null
      return parsed.data
    } catch {
      return null
    }
  }

  private isPongResult(input: unknown): input is Record<string, unknown> {
    return Boolean(input && typeof input === 'object' && (input as Record<string, unknown>).pong === true)
  }

  private numberField(input: Record<string, unknown>, field: string): number | null {
    const value = input[field]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private readDiagnostics(): WatchdogChannelDiagnostic[] {
    const value = this.store.get(SUPERVISOR_CHANNELS_KEY, [])
    if (!Array.isArray(value)) return this.heartbeat.createDiagnostics()
    const parsed: WatchdogChannelDiagnostic[] = []
    for (const item of value) {
      const result = watchdogChannelDiagnosticSchema.safeParse(item)
      if (result.success) parsed.push(result.data)
    }
    return parsed.length > 0 ? parsed : this.heartbeat.createDiagnostics()
  }

  private persistDiagnostics(diagnostics: WatchdogChannelDiagnostic[]): void {
    this.store.set(SUPERVISOR_CHANNELS_KEY, diagnostics)
  }

  private buildStatus(state: SupervisorPersistedState, diagnostics: WatchdogChannelDiagnostic[], context: SessionTokenContext): WatchdogSupervisorStatus {
    const markerFilePath = this.markerFilePath(context)
    const evaluatedDiagnostics = this.applyMarkerMtime(diagnostics, markerFilePath, context)
    const channelStates = this.heartbeat.toChannelStates(evaluatedDiagnostics)
    const innerHealthy = this.heartbeat.innerHealthy(evaluatedDiagnostics)
    const status = this.statusFor({ ...state, innerHealthy, channelStates }, evaluatedDiagnostics)
    const attempts = this.recentSpawnAttempts(this.now())
    return watchdogSupervisorStatusSchema.parse({
      innerWatchdogPid: state.innerWatchdogPid,
      startedAt: state.startedAt,
      lastInnerHeartbeatAt: state.lastInnerHeartbeatAt,
      innerHealthy,
      channelStates,
      spawnAttempts: attempts.length,
      lastSpawnError: state.lastSpawnError,
      windowsServiceInstalled: state.windowsServiceInstalled,
      status,
      checkedAt: this.now(),
      serviceName: state.serviceName ?? null,
      note: this.statusNote(status),
      sessionTokenPrefix: this.protocol.tokenPrefix(context.token),
      markerFilePath,
      namedPipePath: this.protocol.namedPipePath(context.token),
      eventPipePath: this.protocol.eventPipePath(context.token),
      tcpPort: state.tcpPort ?? null,
      protocolVersion: WATCHDOG_PROTOCOL_VERSION,
      respawnAllowed: attempts.length < 5,
      nextRespawnDelayMs: BACKOFF_STEPS_MS[Math.min(attempts.length, BACKOFF_STEPS_MS.length - 1)],
      channelDiagnostics: evaluatedDiagnostics,
      evidence: state.evidence ?? []
    })
  }

  private statusFor(state: SupervisorPersistedState, diagnostics: WatchdogChannelDiagnostic[]): WatchdogSupervisorStatus['status'] {
    if (state.status === 'fatal') return 'fatal'
    if (state.windowsServiceInstalled && state.innerWatchdogPid === null) return 'not-installed'
    if (this.heartbeat.innerHealthy(diagnostics)) {
      const primary = diagnostics.find(item => item.channel === 'named-pipe')?.healthy ?? false
      return primary ? 'healthy' : 'degraded'
    }
    if (state.status === 'starting' && state.startedAt !== null && this.now() - state.startedAt <= HANDSHAKE_GRACE_MS) return 'starting'
    if (state.innerWatchdogPid !== null || state.startedAt !== null) return 'dead'
    return state.status ?? 'not-started'
  }

  private statusNote(status: WatchdogSupervisorStatus['status']): string {
    if (status === 'healthy') return 'InnerWatchdog has at least one live RPC channel and named pipe is healthy.'
    if (status === 'degraded') return 'InnerWatchdog is reachable through a fallback channel; named pipe is not currently healthy.'
    if (status === 'dead') return 'InnerWatchdog has no live channel and should be respawned if the storm governor allows it.'
    if (status === 'fatal') return 'InnerWatchdog respawn storm guard is active; manual inspection is required.'
    return 'InnerWatchdog subprocess is not running; DevHub does not fake spawn success without a configured child entry.'
  }

  private writeMarker(context: SessionTokenContext, force = false): void {
    const markerFilePath = this.markerFilePath(context)
    mkdirSync(dirname(markerFilePath), { recursive: true })
    if (!force && this.markerWriter(markerFilePath) === 'inner-watchdog') return
    const marker = this.protocol.createMarker(context, this.now(), this.readState().tcpPort ?? null)
    writeFileSync(markerFilePath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8')
  }

  private applyMarkerMtime(diagnostics: WatchdogChannelDiagnostic[], markerFilePath: string, context: SessionTokenContext): WatchdogChannelDiagnostic[] {
    if (!existsSync(markerFilePath)) return diagnostics
    const marker = this.readInnerWatchdogMarkerHeartbeat(markerFilePath, context)
    const now = this.now()
    if (marker === null || marker > now + 1000 || now - marker > 15_000) return diagnostics
    return this.heartbeat.record(diagnostics, { channel: 'marker-file', at: marker })
  }

  private readInnerWatchdogMarkerHeartbeat(markerFilePath: string, context: SessionTokenContext): number | null {
    try {
      const stat = statSync(markerFilePath)
      if (!stat.isFile()) return null
      const parsed = watchdogMarkerFileSchema.safeParse(JSON.parse(readFileSync(markerFilePath, 'utf8')))
      if (!parsed.success) return null
      if (parsed.data.writer !== 'inner-watchdog') return null
      if (parsed.data.tokenPrefix !== this.protocol.tokenPrefix(context.token)) return null
      return parsed.data.updatedAt
    } catch {
      return null
    }
  }

  private markerWriter(markerFilePath: string): string | null {
    try {
      if (!existsSync(markerFilePath)) return null
      const parsed = watchdogMarkerFileSchema.safeParse(JSON.parse(readFileSync(markerFilePath, 'utf8')))
      return parsed.success ? parsed.data.writer : null
    } catch {
      return null
    }
  }

  private markerFilePath(context: SessionTokenContext): string {
    return this.protocol.markerFilePath(this.markerRoot, context.token)
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      return code !== 'ESRCH'
    }
  }

  private recentSpawnAttempts(now: number): number[] {
    const rawValue = this.store.get(SUPERVISOR_STATE_KEY, {})
    const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, unknown> : {}
    return this.parseAttempts(raw.spawnAttemptTimestamps).filter(at => now - at <= ONE_HOUR_MS)
  }

  private persistSpawnResult(result: WatchdogSpawnResult, attempts: number[]): void {
    const context = this.ensureSession()
    const nextContext = result.pid === null ? context : { ...context, childPidExpected: result.pid }
    this.store.set(SUPERVISOR_SESSION_KEY, nextContext)
    this.persistState({
      ...this.readState(),
      innerWatchdogPid: result.pid,
      startedAt: result.started ? this.now() : this.readState().startedAt,
      spawnAttempts: attempts.length,
      lastSpawnError: result.started ? null : result.error ?? 'E_SPAWN_FAILED',
      status: result.started ? 'starting' : 'not-started',
      evidence: result.started ? ['spawn command accepted; awaiting handshake'] : ['spawn command failed before handshake'],
      spawnAttemptTimestamps: attempts
    })
  }

  private latestHeartbeat(diagnostics: WatchdogChannelDiagnostic[]): number | null {
    return diagnostics.reduce<number | null>((latest, item) => {
      if (item.lastHeartbeatAt === null) return latest
      return latest === null ? item.lastHeartbeatAt : Math.max(latest, item.lastHeartbeatAt)
    }, null)
  }

  private serviceBinaryPath(): string {
    return this.childEntryFile ?? process.execPath
  }

  private parseStatus(value: unknown): WatchdogSupervisorStatus['status'] | undefined {
    const statuses: WatchdogSupervisorStatus['status'][] = ['not-installed', 'not-started', 'starting', 'healthy', 'degraded', 'dead', 'orphan', 'fatal']
    return typeof value === 'string' && statuses.includes(value as WatchdogSupervisorStatus['status']) ? value as WatchdogSupervisorStatus['status'] : undefined
  }

  private parseEvidence(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0).slice(0, 20) : []
  }

  private parseAttempts(value: unknown): number[] {
    return Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item) && item >= 0) : []
  }
}
