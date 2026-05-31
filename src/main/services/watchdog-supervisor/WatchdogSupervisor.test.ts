import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn as spawnChild, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionTokenContext } from '@shared/schemas/watchdog-rpc'
import { WATCHDOG_PROTOCOL_VERSION } from './HandshakeProtocol'
import { WatchdogSupervisor, type WatchdogSupervisorStore } from './WatchdogSupervisor'
import { WindowsServiceInstaller, type ElevatedCommandExecutor } from './WindowsServiceInstaller'

class MemoryStore implements WatchdogSupervisorStore {
  private readonly values = new Map<string, unknown>()

  get(key: string, defaultValue?: unknown): unknown {
    return this.values.has(key) ? this.values.get(key) : defaultValue
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value)
  }
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('waitForCondition timeout')
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

async function waitForChildExit(command: string, args: string[], cwd: string, timeoutMs = 5000): Promise<number | null> {
  const child = spawnChild(command, args, { cwd, windowsHide: true, stdio: 'ignore', timeout: timeoutMs })
  return await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolve(code))
  })
}

async function stopChild(child: ChildProcess, timeoutMs = 1500): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>(resolve => {
    let settled = false
    const settle = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve()
    }
    const timeout = setTimeout(() => {
      const pid = child.pid
      if (typeof pid === 'number' && isPidAlive(pid)) child.kill('SIGKILL')
      settle()
    }, timeoutMs)
    child.once('exit', settle)
    child.kill('SIGTERM')
  })
}

async function requestSocket(socket: ReturnType<typeof createConnection>, payload: Record<string, unknown>, timeoutMs = 1000): Promise<Record<string, unknown>> {
  return await new Promise((resolve, reject) => {
    let buffer = ''
    let settled = false
    const settle = (error?: Error, response?: Record<string, unknown>): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.destroy()
      if (error) reject(error)
      else resolve(response ?? {})
    }
    const timeout = setTimeout(() => settle(new Error('named pipe response timeout')), timeoutMs)
    socket.setEncoding('utf8')
    socket.once('connect', () => {
      socket.write(`${JSON.stringify(payload)}\n`)
    })
    socket.on('data', chunk => {
      buffer += chunk
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex < 0) return
      try {
        const parsed = JSON.parse(buffer.slice(0, newlineIndex)) as unknown
        if (!parsed || typeof parsed !== 'object') throw new Error('named pipe response was not an object')
        settle(undefined, parsed as Record<string, unknown>)
      } catch (error) {
        settle(error instanceof Error ? error : new Error(String(error)))
      }
    })
    socket.once('error', error => settle(error))
  })
}

async function requestNamedPipe(pipePath: string, payload: Record<string, unknown>, timeoutMs = 1000): Promise<Record<string, unknown>> {
  return await requestSocket(createConnection(pipePath), payload, timeoutMs)
}

async function waitForNamedPipeResponse(pipePath: string, payload: Record<string, unknown>, timeoutMs = 1500): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs
  let lastError: Error | null = null
  while (Date.now() < deadline) {
    try {
      return await requestNamedPipe(pipePath, payload, 250)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
  throw lastError ?? new Error('named pipe readiness timeout')
}

async function requestTcp(port: number, payload: Record<string, unknown>, timeoutMs = 1000): Promise<Record<string, unknown>> {
  return await requestSocket(createConnection({ host: '127.0.0.1', port }), payload, timeoutMs)
}

describe('WatchdogSupervisor', () => {
  let tempDir = ''
  let now = 1_000_000

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'devhub-watchdog-supervisor-'))
    now = 1_000_000
  })

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  function createSupervisor(store = new MemoryStore()) {
    return { store, supervisor: new WatchdogSupervisor({ store, markerRoot: tempDir, parentPid: 4321, now: () => now }) }
  }

  function createSupervisorWithLiveParent(store = new MemoryStore()) {
    return { store, supervisor: new WatchdogSupervisor({ store, markerRoot: tempDir, parentPid: process.pid, now: () => now }) }
  }

  function createSupervisorWithDeadParent(store = new MemoryStore()) {
    return { store, supervisor: new WatchdogSupervisor({ store, markerRoot: tempDir, parentPid: 9_876_543, now: () => now }) }
  }

  function createSupervisorWithEntry(childEntryFile: string, store = new MemoryStore()) {
    return { store, supervisor: new WatchdogSupervisor({ store, markerRoot: tempDir, parentPid: 4321, now: () => now, childEntryFile }) }
  }

  it('generates a real session token and marker file without claiming child success', () => {
    const { supervisor } = createSupervisor()
    const status = supervisor.status()

    expect(status.status).toBe('not-started')
    expect(status.innerHealthy).toBe(false)
    expect(status.sessionTokenPrefix).toMatch(/^[a-f0-9]{8}$/)
    expect(existsSync(status.markerFilePath)).toBe(true)
    const marker = JSON.parse(readFileSync(status.markerFilePath, 'utf8')) as Record<string, unknown>
    expect(marker.tokenPrefix).toBe(status.sessionTokenPrefix)
    expect(marker.namedPipePath).toBe(status.namedPipePath)
    expect(marker.writer).toBe('parent-supervisor')
    expect(status.evidence.join(' ')).toContain('not started')
  })

  it('validates handshake token and records named pipe liveness', () => {
    const { store, supervisor } = createSupervisor()
    supervisor.status()
    const session = store.get('watchdogSupervisorSession') as SessionTokenContext

    expect(() => supervisor.acceptHandshake({ type: 'handshake', sessionToken: 'b'.repeat(64), protocolVersion: WATCHDOG_PROTOCOL_VERSION, parentPid: 4321 })).toThrow('E_PERMISSION_DENIED')
    supervisor.acceptHandshake({ type: 'handshake', sessionToken: session.token, protocolVersion: WATCHDOG_PROTOCOL_VERSION, parentPid: 4321 })

    const status = supervisor.status()
    expect(status.status).toBe('healthy')
    expect(status.channelStates['named-pipe']).toBe(true)
    expect(status.innerHealthy).toBe(true)
  })

  it('serves authenticated JSON-RPC ping over a real named pipe', async () => {
    const { store, supervisor } = createSupervisor()
    try {
      const status = await supervisor.startNamedPipeServer()
      const session = store.get('watchdogSupervisorSession') as SessionTokenContext
      const response = await requestNamedPipe(status.namedPipePath, {
        jsonrpc: '2.0',
        id: 'ping-1',
        method: 'ping',
        params: { sessionToken: session.token }
      })

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 'ping-1',
        result: expect.objectContaining({ pong: true, status: 'healthy' })
      })
      expect(supervisor.status().channelStates['named-pipe']).toBe(true)
    } finally {
      await supervisor.dispose()
    }
  })

  it('serves authenticated JSON-RPC ping over a real TCP fallback channel', async () => {
    const { store, supervisor } = createSupervisor()
    try {
      const status = await supervisor.startTcpServer()
      if (status.tcpPort === null) throw new Error('expected TCP fallback port')
      const session = store.get('watchdogSupervisorSession') as SessionTokenContext
      const response = await requestTcp(status.tcpPort, {
        jsonrpc: '2.0',
        id: 'tcp-ping-1',
        method: 'ping',
        params: { sessionToken: session.token }
      })
      const marker = JSON.parse(readFileSync(status.markerFilePath, 'utf8')) as Record<string, unknown>

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 'tcp-ping-1',
        result: expect.objectContaining({ pong: true, status: 'degraded' })
      })
      expect(marker.tcpPort).toBe(status.tcpPort)
      expect(supervisor.status().channelStates['tcp-localhost']).toBe(true)
    } finally {
      await supervisor.dispose()
    }
  })

  it('keeps fallback TCP healthy when named pipe is unavailable', () => {
    const { supervisor } = createSupervisor()
    supervisor.status()
    const status = supervisor.recordChannelHeartbeat({ channel: 'tcp-localhost', at: now })

    expect(status.status).toBe('degraded')
    expect(status.channelStates['named-pipe']).toBe(false)
    expect(status.channelStates['tcp-localhost']).toBe(true)
    expect(status.innerHealthy).toBe(true)
  })

  it('marks an already-started inner watchdog dead when all channels are stale', () => {
    const { store, supervisor } = createSupervisor()
    supervisor.status()
    const session = store.get('watchdogSupervisorSession') as SessionTokenContext
    supervisor.acceptHandshake({ type: 'handshake', sessionToken: session.token, protocolVersion: WATCHDOG_PROTOCOL_VERSION, parentPid: 4321 })

    now += 20_000
    const status = supervisor.evaluate()

    expect(status.status).toBe('dead')
    expect(status.innerHealthy).toBe(false)
    expect(status.channelStates['named-pipe']).toBe(false)
  })

  it('does not treat parent-written marker refreshes as child liveness', () => {
    const { store, supervisor } = createSupervisor()
    const initial = supervisor.status()
    const session = store.get('watchdogSupervisorSession') as SessionTokenContext
    supervisor.acceptHandshake({ type: 'handshake', sessionToken: session.token, protocolVersion: WATCHDOG_PROTOCOL_VERSION, parentPid: 4321 })

    now += 20_000
    const status = supervisor.status()

    expect(status.status).toBe('dead')
    expect(status.innerHealthy).toBe(false)
    expect(status.channelStates['marker-file']).toBe(false)
    const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
    expect(marker.writer).toBe('parent-supervisor')
  })

  it('accepts inner-watchdog marker heartbeats as fallback liveness', () => {
    const { store, supervisor } = createSupervisor()
    const initial = supervisor.status()
    const session = store.get('watchdogSupervisorSession') as SessionTokenContext
    supervisor.acceptHandshake({ type: 'handshake', sessionToken: session.token, protocolVersion: WATCHDOG_PROTOCOL_VERSION, parentPid: 4321 })
    now += 20_000
    const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
    writeFileSync(initial.markerFilePath, `${JSON.stringify({ ...marker, writer: 'inner-watchdog', updatedAt: now }, null, 2)}\n`, 'utf8')

    const status = supervisor.status()

    expect(status.status).toBe('degraded')
    expect(status.innerHealthy).toBe(true)
    expect(status.channelStates['marker-file']).toBe(true)
  })

  it('blocks the sixth respawn request in one hour and never fakes spawn success', () => {
    const { supervisor } = createSupervisor()
    const attempts = Array.from({ length: 5 }, (_, index) => supervisor.requestRespawn({ reason: `try-${index}`, confirmedBy: 'vitest' }))
    expect(attempts.every(result => !result.success && result.code === 'E_SPAWN_FAILED')).toBe(true)

    const sixth = supervisor.requestRespawn({ reason: 'storm', confirmedBy: 'vitest' })
    expect(sixth.success).toBe(false)
    expect(sixth.code).toBe('E_RESTART_STORM')
    expect(sixth.status.status).toBe('fatal')
    expect(sixth.status.respawnAllowed).toBe(false)
  })

  it('reports exponential respawn backoff and keeps the governor window sliding', () => {
    const { supervisor } = createSupervisor()

    expect(supervisor.status().nextRespawnDelayMs).toBe(1000)
    expect(supervisor.requestRespawn({ reason: 'first', confirmedBy: 'vitest' }).status.nextRespawnDelayMs).toBe(2000)
    expect(supervisor.requestRespawn({ reason: 'second', confirmedBy: 'vitest' }).status.nextRespawnDelayMs).toBe(4000)
    expect(supervisor.requestRespawn({ reason: 'third', confirmedBy: 'vitest' }).status.nextRespawnDelayMs).toBe(8000)
    expect(supervisor.requestRespawn({ reason: 'fourth', confirmedBy: 'vitest' }).status.nextRespawnDelayMs).toBe(16000)
    expect(supervisor.requestRespawn({ reason: 'fifth', confirmedBy: 'vitest' }).status.nextRespawnDelayMs).toBe(16000)

    now += 3_600_001
    const afterWindow = supervisor.requestRespawn({ reason: 'after-window', confirmedBy: 'vitest' })
    expect(afterWindow.code).toBe('E_SPAWN_FAILED')
    expect(afterWindow.status.spawnAttempts).toBe(1)
    expect(afterWindow.status.respawnAllowed).toBe(true)
  })

  it('spawns a real node InnerWatchdog child command when an entry file is configured', async () => {
    const childEntry = join(tempDir, 'inner-watchdog-child.js')
    const proofPath = join(tempDir, 'inner-watchdog-spawn-proof.json')
    writeFileSync(childEntry, [
      "const fs = require('node:fs')",
      `const proofPath = ${JSON.stringify(proofPath)}`,
      'const token = process.env.DEVHUB_WATCHDOG_TOKEN',
      'const marker = process.env.DEVHUB_WATCHDOG_MARKER',
      "if (!token || !/^[a-f0-9]{64}$/.test(token)) process.exit(2)",
      "if (!marker || !marker.includes('devhub-watchdog-')) process.exit(3)",
      "fs.writeFileSync(proofPath, JSON.stringify({ tokenPrefix: token.slice(0, 8), marker, argv: process.argv.slice(2) }))",
      'setTimeout(() => process.exit(0), 25)',
      ''
    ].join('\n'), 'utf8')
    const { supervisor } = createSupervisorWithEntry(childEntry)

    const result = supervisor.requestRespawn({ reason: 'real-child-spawn', confirmedBy: 'vitest' })

    expect(result.success).toBe(true)
    expect(result.code).toBe('OK')
    expect(result.spawnResult?.pid).toEqual(expect.any(Number))
    expect(result.spawnResult?.command.command).toBe(process.execPath)
    expect(result.spawnResult?.command.args[0]).toBe(childEntry)
    expect(result.spawnResult?.command.args.some(arg => arg.startsWith('--token='))).toBe(true)
    expect(result.spawnResult?.command.args.some(arg => arg.startsWith('--marker='))).toBe(true)
    expect(result.spawnResult?.command.env?.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(result.status.status).toBe('starting')
    expect(result.status.innerWatchdogPid).toBe(result.spawnResult?.pid)

    await waitForCondition(() => existsSync(proofPath))
    const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as Record<string, unknown>
    expect(proof.tokenPrefix).toBe(result.status.sessionTokenPrefix)
    expect(proof.marker).toBe(result.status.markerFilePath)
    expect(proof.argv).toEqual(expect.arrayContaining([
      expect.stringMatching(/^--token=[a-f0-9]{64}$/),
      `--marker=${result.status.markerFilePath}`
    ]))
  })

  it('detects a killed real spawned child as dead after the handshake grace window', async () => {
    const childEntry = join(tempDir, 'inner-watchdog-long-child.js')
    writeFileSync(childEntry, [
      "process.on('SIGTERM', () => process.exit(0))",
      'setInterval(() => undefined, 1000)',
      ''
    ].join('\n'), 'utf8')
    const { supervisor } = createSupervisorWithEntry(childEntry)

    const result = supervisor.requestRespawn({ reason: 'real-child-kill', confirmedBy: 'vitest' })
    const pid = result.spawnResult?.pid
    expect(result.success).toBe(true)
    expect(pid).toEqual(expect.any(Number))
    if (typeof pid !== 'number') throw new Error('expected spawned child pid')

    try {
      process.kill(pid, 'SIGTERM')
      await waitForCondition(() => !isPidAlive(pid), 1500)
      now += 6_000
      const status = supervisor.evaluate()

      expect(status.status).toBe('dead')
      expect(status.innerHealthy).toBe(false)
      expect(status.innerWatchdogPid).toBe(pid)
      expect(status.evidence.join(' ')).toContain('awaiting handshake')
    } finally {
      if (isPidAlive(pid)) process.kill(pid, 'SIGTERM')
    }
  })

  it('runs the InnerWatchdog entrypoint once and writes a real marker heartbeat', async () => {
    const { store, supervisor } = createSupervisor()
    const initial = supervisor.status()
    const session = store.get('watchdogSupervisorSession') as SessionTokenContext
    const entryFile = join(process.cwd(), 'src', 'watchdog-process', 'main.ts')

    const exitCode = await waitForChildExit(process.execPath, [
      '--experimental-strip-types',
      entryFile,
      `--token=${session.token}`,
      `--marker=${initial.markerFilePath}`,
      '--handshake-timeout-ms=25',
      '--once'
    ], process.cwd())

    expect(exitCode).toBe(0)
    const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
    expect(marker.writer).toBe('inner-watchdog')
    expect(marker.childPidExpected).toEqual(expect.any(Number))

    now = Date.now()
    const status = supervisor.status()
    expect(status.status).toBe('degraded')
    expect(status.channelStates['marker-file']).toBe(true)
    expect(status.innerHealthy).toBe(true)
  })

  it('accepts a real InnerWatchdog named-pipe handshake through the parent server', async () => {
    const { store, supervisor } = createSupervisorWithLiveParent()
    try {
      const initial = await supervisor.startNamedPipeServer()
      const session = store.get('watchdogSupervisorSession') as SessionTokenContext
      const entryFile = join(process.cwd(), 'src', 'watchdog-process', 'main.ts')

      const exitCode = await waitForChildExit(process.execPath, [
        '--experimental-strip-types',
        entryFile,
        `--token=${session.token}`,
        `--marker=${initial.markerFilePath}`,
        '--handshake-timeout-ms=1000',
        '--once'
      ], process.cwd())

      expect(exitCode).toBe(0)
      await waitForCondition(() => supervisor.status().channelStates['named-pipe'], 1000)
      const status = supervisor.status()
      const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>

      expect(status.status).toBe('healthy')
      expect(status.channelStates['named-pipe']).toBe(true)
      expect(status.innerHealthy).toBe(true)
      expect(marker.writer).toBe('inner-watchdog')
    } finally {
      await supervisor.dispose()
    }
  })

  it('falls back to TCP when InnerWatchdog cannot reach the named pipe', async () => {
    const { store, supervisor } = createSupervisorWithLiveParent()
    try {
      const initial = await supervisor.startTcpServer()
      const session = store.get('watchdogSupervisorSession') as SessionTokenContext
      const entryFile = join(process.cwd(), 'src', 'watchdog-process', 'main.ts')
      if (initial.tcpPort === null) throw new Error('expected TCP fallback port')

      const exitCode = await waitForChildExit(process.execPath, [
        '--experimental-strip-types',
        entryFile,
        `--token=${session.token}`,
        `--marker=${initial.markerFilePath}`,
        '--handshake-timeout-ms=1000',
        '--once'
      ], process.cwd())

      expect(exitCode).toBe(0)
      await waitForCondition(() => supervisor.status().channelStates['tcp-localhost'], 1000)
      const status = supervisor.status()

      expect(status.status).toBe('degraded')
      expect(status.channelStates['named-pipe']).toBe(false)
      expect(status.channelStates['tcp-localhost']).toBe(true)
      expect(status.innerHealthy).toBe(true)
    } finally {
      await supervisor.dispose()
    }
  })

  it('supports a real parent-to-InnerWatchdog ping over the child event pipe', async () => {
    const { store, supervisor } = createSupervisorWithLiveParent()
    let child: ChildProcess | null = null
    try {
      const initial = await supervisor.startNamedPipeServer()
      const session = store.get('watchdogSupervisorSession') as SessionTokenContext
      const entryFile = join(process.cwd(), 'src', 'watchdog-process', 'main.ts')
      child = spawnChild(process.execPath, [
        '--experimental-strip-types',
        entryFile,
        `--token=${session.token}`,
        `--marker=${initial.markerFilePath}`,
        '--heartbeat-interval-ms=100',
        '--handshake-timeout-ms=1000'
      ], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore', timeout: 5000 })

      await waitForCondition(() => {
        try {
          const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
          return marker.writer === 'inner-watchdog'
        } catch {
          return false
        }
      }, 1500)
      await waitForCondition(() => supervisor.status().channelStates['named-pipe'], 1500)
      const directPing = await waitForNamedPipeResponse(initial.eventPipePath, {
        jsonrpc: '2.0',
        id: 'child-ping-1',
        method: 'ping',
        params: { sessionToken: session.token }
      }, 1500)
      const status = await supervisor.pingInnerWatchdog(1000)

      expect(directPing).toMatchObject({
        jsonrpc: '2.0',
        id: 'child-ping-1',
        result: expect.objectContaining({ pong: true, mode: 'attached', pid: expect.any(Number) })
      })
      expect(status.channelStates['named-pipe']).toBe(true)
      expect(status.innerHealthy).toBe(true)
      expect(status.evidence.join(' ')).toContain('parent-to-inner watchdog ping acknowledged')
    } finally {
      await supervisor.dispose()
      if (child) await stopChild(child)
    }
  })

  it('runs a bounded parent-to-InnerWatchdog heartbeat scheduler over the child event pipe', async () => {
    const { store, supervisor } = createSupervisorWithLiveParent()
    let child: ChildProcess | null = null
    try {
      const initial = await supervisor.startNamedPipeServer()
      const session = store.get('watchdogSupervisorSession') as SessionTokenContext
      const entryFile = join(process.cwd(), 'src', 'watchdog-process', 'main.ts')
      child = spawnChild(process.execPath, [
        '--experimental-strip-types',
        entryFile,
        `--token=${session.token}`,
        `--marker=${initial.markerFilePath}`,
        '--heartbeat-interval-ms=100',
        '--handshake-timeout-ms=1000'
      ], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore', timeout: 5000 })

      await waitForCondition(() => {
        try {
          const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
          return marker.writer === 'inner-watchdog'
        } catch {
          return false
        }
      }, 1500)
      supervisor.startMutualHeartbeat(100, 50)
      await waitForCondition(() => supervisor.status().evidence.join(' ').includes('parent-to-inner watchdog ping acknowledged'), 1500)
      const status = supervisor.status()

      expect(status.channelStates['named-pipe']).toBe(true)
      expect(status.innerHealthy).toBe(true)
      expect(status.evidence.join(' ')).toContain('heartbeat scheduler started every 100ms')
      expect(status.evidence.join(' ')).toContain('parent-to-inner watchdog ping acknowledged')
    } finally {
      await supervisor.dispose()
      if (child) await stopChild(child)
    }
  })

  it('records repeated parent-to-InnerWatchdog heartbeat failures without inventing child liveness', async () => {
    const { supervisor } = createSupervisor()
    try {
      supervisor.status()
      supervisor.startMutualHeartbeat(50, 25)
      await waitForCondition(() => {
        const namedPipe = supervisor.status().channelDiagnostics.find(item => item.channel === 'named-pipe')
        return (namedPipe?.consecutiveFailures ?? 0) >= 3
      }, 1000)
      const status = supervisor.status()
      const namedPipe = status.channelDiagnostics.find(item => item.channel === 'named-pipe')

      expect(status.innerHealthy).toBe(false)
      expect(status.channelStates['named-pipe']).toBe(false)
      expect(namedPipe?.consecutiveFailures).toBe(3)
      expect(namedPipe?.lastError).toContain('inner watchdog marker is unavailable')
    } finally {
      await supervisor.dispose()
    }
  })

  it('refuses new control instructions in orphan mode through the real child event pipe', async () => {
    const { store, supervisor } = createSupervisorWithDeadParent()
    let child: ChildProcess | null = null
    try {
      const initial = supervisor.status()
      const session = store.get('watchdogSupervisorSession') as SessionTokenContext
      const entryFile = join(process.cwd(), 'src', 'watchdog-process', 'main.ts')
      child = spawnChild(process.execPath, [
        '--experimental-strip-types',
        entryFile,
        `--token=${session.token}`,
        `--marker=${initial.markerFilePath}`,
        '--heartbeat-interval-ms=100',
        '--handshake-timeout-ms=1000'
      ], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore', timeout: 5000 })

      await waitForCondition(() => {
        try {
          const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
          return marker.writer === 'inner-watchdog'
        } catch {
          return false
        }
      }, 1500)
      const statusResponse = await waitForNamedPipeResponse(initial.eventPipePath, {
        jsonrpc: '2.0',
        id: 'child-status-orphan',
        method: 'get-status',
        params: { sessionToken: session.token }
      })
      const controlResponse = await requestNamedPipe(initial.eventPipePath, {
        jsonrpc: '2.0',
        id: 'child-register-orphan',
        method: 'register-instance',
        params: { sessionToken: session.token, instanceId: 'orphan-new-work' }
      })

      expect(statusResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'child-status-orphan',
        result: expect.objectContaining({ mode: 'orphan', parentPid: 9_876_543 })
      })
      expect(controlResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'child-register-orphan',
        error: expect.objectContaining({ message: expect.stringContaining('E_ORPHAN_READ_ONLY') })
      })
    } finally {
      await supervisor.dispose()
      if (child) await stopChild(child)
    }
  })

  it('keeps registered instance heartbeat state after the parent marker becomes orphaned', async () => {
    const { store, supervisor } = createSupervisorWithLiveParent()
    let child: ChildProcess | null = null
    try {
      const initial = await supervisor.startNamedPipeServer()
      const session = store.get('watchdogSupervisorSession') as SessionTokenContext
      const entryFile = join(process.cwd(), 'src', 'watchdog-process', 'main.ts')
      child = spawnChild(process.execPath, [
        '--experimental-strip-types',
        entryFile,
        `--token=${session.token}`,
        `--marker=${initial.markerFilePath}`,
        '--heartbeat-interval-ms=100',
        '--handshake-timeout-ms=1000'
      ], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore', timeout: 5000 })

      await waitForCondition(() => {
        try {
          const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
          return marker.writer === 'inner-watchdog'
        } catch {
          return false
        }
      }, 1500)
      const registerResponse = await waitForNamedPipeResponse(initial.eventPipePath, {
        jsonrpc: '2.0',
        id: 'child-register-attached',
        method: 'register-instance',
        params: {
          sessionToken: session.token,
          instanceId: 'carryover-codex-session',
          pid: process.pid,
          config: { heartbeatSource: 'vitest-real-child' }
        }
      })
      const attachedStatus = await requestNamedPipe(initial.eventPipePath, {
        jsonrpc: '2.0',
        id: 'child-status-attached',
        method: 'get-status',
        params: { sessionToken: session.token }
      })
      const markerBeforeOrphan = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
      const orphanMarkerWrittenAt = Date.now()
      writeFileSync(initial.markerFilePath, `${JSON.stringify({
        ...markerBeforeOrphan,
        parentPid: 9_876_543,
        writer: 'parent-supervisor',
        updatedAt: orphanMarkerWrittenAt
      }, null, 2)}\n`, 'utf8')

      await waitForCondition(() => {
        try {
          const marker = JSON.parse(readFileSync(initial.markerFilePath, 'utf8')) as Record<string, unknown>
          return marker.parentPid === 9_876_543 && marker.writer === 'inner-watchdog' && typeof marker.updatedAt === 'number' && marker.updatedAt >= orphanMarkerWrittenAt
        } catch {
          return false
        }
      }, 1500)
      const orphanStatus = await requestNamedPipe(initial.eventPipePath, {
        jsonrpc: '2.0',
        id: 'child-status-orphan-carryover',
        method: 'get-status',
        params: { sessionToken: session.token }
      })
      const blockedRegister = await requestNamedPipe(initial.eventPipePath, {
        jsonrpc: '2.0',
        id: 'child-register-after-orphan',
        method: 'register-instance',
        params: { sessionToken: session.token, instanceId: 'new-orphan-work' }
      })

      expect(registerResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'child-register-attached',
        result: expect.objectContaining({ accepted: true, instanceId: 'carryover-codex-session', registeredInstanceCount: 1 })
      })
      expect(attachedStatus).toMatchObject({
        jsonrpc: '2.0',
        id: 'child-status-attached',
        result: expect.objectContaining({
          mode: 'attached',
          registeredInstanceCount: 1,
          registeredInstances: [
            expect.objectContaining({
              instanceId: 'carryover-codex-session',
              pid: process.pid,
              configKeys: ['heartbeatSource']
            })
          ]
        })
      })
      expect(orphanStatus).toMatchObject({
        jsonrpc: '2.0',
        id: 'child-status-orphan-carryover',
        result: expect.objectContaining({
          mode: 'orphan',
          parentPid: 9_876_543,
          registeredInstanceCount: 1,
          registeredInstances: [
            expect.objectContaining({
              instanceId: 'carryover-codex-session',
              pid: process.pid,
              configKeys: ['heartbeatSource']
            })
          ]
        })
      })
      expect(blockedRegister).toMatchObject({
        jsonrpc: '2.0',
        id: 'child-register-after-orphan',
        error: expect.objectContaining({ message: expect.stringContaining('E_ORPHAN_READ_ONLY') })
      })
      const orphanResult = orphanStatus.result as { registeredInstances?: Array<{ lastHeartbeatAt?: unknown }> }
      const firstInstance = orphanResult.registeredInstances?.[0]
      expect(typeof firstInstance?.lastHeartbeatAt).toBe('number')
    } finally {
      await supervisor.dispose()
      if (child) await stopChild(child)
    }
  })

  it('takes over an existing InnerWatchdog session after the stored parent PID changes', async () => {
    const store = new MemoryStore()
    const oldSupervisor = new WatchdogSupervisor({ store, markerRoot: tempDir, parentPid: 9_876_543, now: () => now })
    let child: ChildProcess | null = null
    let restartedSupervisor: WatchdogSupervisor | null = null
    try {
      const oldStatus = oldSupervisor.status()
      const oldSession = store.get('watchdogSupervisorSession') as SessionTokenContext
      const entryFile = join(process.cwd(), 'src', 'watchdog-process', 'main.ts')
      child = spawnChild(process.execPath, [
        '--experimental-strip-types',
        entryFile,
        `--token=${oldSession.token}`,
        `--marker=${oldStatus.markerFilePath}`,
        '--heartbeat-interval-ms=100',
        '--handshake-timeout-ms=1000'
      ], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore', timeout: 5000 })

      await waitForCondition(() => {
        try {
          const marker = JSON.parse(readFileSync(oldStatus.markerFilePath, 'utf8')) as Record<string, unknown>
          return marker.writer === 'inner-watchdog' && marker.parentPid === 9_876_543
        } catch {
          return false
        }
      }, 1500)

      restartedSupervisor = new WatchdogSupervisor({ store, markerRoot: tempDir, parentPid: process.pid, now: () => now })
      const takeoverSupervisor = restartedSupervisor
      await takeoverSupervisor.startNamedPipeServer()
      const adoptedSession = store.get('watchdogSupervisorSession') as SessionTokenContext

      expect(adoptedSession.token).toBe(oldSession.token)
      expect(adoptedSession.parentPid).toBe(process.pid)
      await waitForCondition(() => {
        try {
          const marker = JSON.parse(readFileSync(oldStatus.markerFilePath, 'utf8')) as Record<string, unknown>
          return marker.writer === 'inner-watchdog' && marker.parentPid === process.pid
        } catch {
          return false
        }
      }, 1500)
      await waitForCondition(() => takeoverSupervisor.status().channelStates['named-pipe'], 1500)
      const childStatus = await requestNamedPipe(oldStatus.eventPipePath, {
        jsonrpc: '2.0',
        id: 'child-status-after-takeover',
        method: 'get-status',
        params: { sessionToken: adoptedSession.token }
      })
      const status = takeoverSupervisor.status()

      expect(status.channelStates['named-pipe']).toBe(true)
      expect(status.innerHealthy).toBe(true)
      expect(status.evidence.join(' ')).toContain('restart takeover adopted existing watchdog session')
      expect(childStatus).toMatchObject({
        jsonrpc: '2.0',
        id: 'child-status-after-takeover',
        result: expect.objectContaining({ mode: 'attached', parentPid: process.pid })
      })
    } finally {
      if (restartedSupervisor) await restartedSupervisor.dispose()
      await oldSupervisor.dispose()
      if (child) await stopChild(child)
    }
  })

  it('marks an established named pipe channel dead on explicit channel failure', () => {
    const { store, supervisor } = createSupervisor()
    supervisor.status()
    const session = store.get('watchdogSupervisorSession') as SessionTokenContext
    supervisor.acceptHandshake({ type: 'handshake', sessionToken: session.token, protocolVersion: WATCHDOG_PROTOCOL_VERSION, parentPid: 4321 })

    const status = supervisor.recordChannelHeartbeat({ channel: 'named-pipe', ok: false, error: 'named pipe closed by fixture' })

    expect(status.status).toBe('dead')
    expect(status.innerHealthy).toBe(false)
    expect(status.channelDiagnostics.find(item => item.channel === 'named-pipe')?.lastError).toBe('named pipe closed by fixture')
  })

  it('returns explicit Windows Service command plans without executing sc.exe before admin confirmation', async () => {
    const { supervisor } = createSupervisor()
    const install = await supervisor.installService({ confirmAdmin: false, confirmedBy: 'vitest' })
    const uninstall = await supervisor.uninstallService({ confirmAdmin: false, confirmedBy: 'vitest' })

    expect(install.success).toBe(false)
    expect(install.requiresElevation).toBe(true)
    expect(install.elevated).toBe(false)
    expect(install.code).toBe('E_PERMISSION')
    expect(install.command.command).toBe('sc.exe')
    expect(install.command.args).toContain('create')
    expect(install.command.commandLine).toContain('sc.exe create devhub-watchdog')
    expect(uninstall.command.args).toContain('delete')
  })

  it('executes Windows Service install and uninstall through an elevated executor and verifies state', async () => {
    const executedCommands: string[] = []
    let installed = false
    const elevatedExecutor: ElevatedCommandExecutor = {
      exec: async (commandLine) => {
        executedCommands.push(commandLine)
        if (commandLine.includes(' create ')) installed = true
        if (commandLine.includes(' delete ')) installed = false
        return { stdout: 'sc.exe completed', stderr: '' }
      }
    }
    const serviceInstaller = new WindowsServiceInstaller('devhub-watchdog', {
      elevatedExecutor,
      platform: 'win32',
      queryServiceInstalled: async () => installed
    })
    const store = new MemoryStore()
    const supervisor = new WatchdogSupervisor({
      store,
      markerRoot: tempDir,
      parentPid: 4321,
      now: () => now,
      childEntryFile: 'C:\\Program Files\\DevHub\\watchdog-process.exe',
      serviceInstaller
    })

    const install = await supervisor.installService({ confirmAdmin: true, confirmedBy: 'vitest' })
    const installStatus = supervisor.status()
    const uninstall = await supervisor.uninstallService({ confirmAdmin: true, confirmedBy: 'vitest' })
    const uninstallStatus = supervisor.status()

    expect(install).toMatchObject({
      success: true,
      requiresElevation: false,
      elevated: true,
      code: 'OK',
      serviceName: 'devhub-watchdog'
    })
    expect(install.command.commandLine).toContain('"C:\\Program Files\\DevHub\\watchdog-process.exe"')
    expect(installStatus.windowsServiceInstalled).toBe(true)
    expect(installStatus.serviceName).toBe('devhub-watchdog')
    expect(uninstall).toMatchObject({
      success: true,
      requiresElevation: false,
      elevated: true,
      code: 'OK',
      serviceName: 'devhub-watchdog'
    })
    expect(uninstallStatus.windowsServiceInstalled).toBe(false)
    expect(uninstallStatus.serviceName).toBeNull()
    expect(executedCommands).toEqual([
      expect.stringContaining('sc.exe create devhub-watchdog'),
      expect.stringContaining('sc.exe delete devhub-watchdog')
    ])
  })
})
