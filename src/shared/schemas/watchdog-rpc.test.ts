import { describe, expect, it } from 'vitest'
import {
  handshakeMessageSchema,
  rpcRequestSchema,
  rpcResponseSchema,
  supervisorStateSchema,
  watchdogMarkerFileSchema,
  watchdogSupervisorEventStreamPayloadSchema,
  watchdogSupervisorStatusSchema
} from './watchdog-rpc'

const token = 'a'.repeat(64)

function fullChannelStates() {
  return {
    'named-pipe': true,
    'tcp-localhost': false,
    'marker-file': false
  }
}

describe('watchdog rpc schemas', () => {
  it('validates strict handshake and JSON-RPC contracts', () => {
    expect(handshakeMessageSchema.parse({ type: 'handshake', sessionToken: token, protocolVersion: '1.0', parentPid: 1234 }).sessionToken).toBe(token)
    expect(handshakeMessageSchema.safeParse({ type: 'handshake', sessionToken: 'bad', protocolVersion: '1.0', parentPid: 1234 }).success).toBe(false)
    expect(handshakeMessageSchema.safeParse({ type: 'handshake', sessionToken: token, protocolVersion: '1.0', parentPid: 1234, extra: true }).success).toBe(false)

    expect(rpcRequestSchema.parse({ jsonrpc: '2.0', id: '1', method: 'ping', params: {} }).method).toBe('ping')
    expect(rpcRequestSchema.safeParse({ jsonrpc: '2.0', id: '1', method: 'unknown' }).success).toBe(false)
  })

  it('rejects ambiguous JSON-RPC responses', () => {
    expect(rpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, result: { pong: true } }).success).toBe(true)
    expect(rpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'failed' } }).success).toBe(true)
    expect(rpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1 }).success).toBe(false)
    expect(rpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, result: true, error: { code: -1, message: 'bad' } }).success).toBe(false)
  })

  it('requires exhaustive channel states in supervisor status', () => {
    const state = {
      innerWatchdogPid: null,
      startedAt: null,
      lastInnerHeartbeatAt: null,
      innerHealthy: false,
      channelStates: fullChannelStates(),
      spawnAttempts: 0,
      lastSpawnError: null,
      windowsServiceInstalled: false
    }
    expect(supervisorStateSchema.parse(state).channelStates['named-pipe']).toBe(true)
    expect(supervisorStateSchema.safeParse({ ...state, channelStates: { 'named-pipe': true } }).success).toBe(false)
    expect(watchdogSupervisorStatusSchema.parse({
      ...state,
      status: 'not-started',
      checkedAt: 1,
      serviceName: null,
      note: 'not running',
      sessionTokenPrefix: 'a'.repeat(8),
      markerFilePath: 'C:/tmp/watchdog.json',
      namedPipePath: 'pipe-main',
      eventPipePath: 'pipe-event',
      tcpPort: null,
      protocolVersion: '1.0',
      respawnAllowed: true,
      nextRespawnDelayMs: 1000,
      channelDiagnostics: [
        { channel: 'named-pipe', healthy: false, lastHeartbeatAt: null, consecutiveFailures: 0, lastError: null },
        { channel: 'tcp-localhost', healthy: false, lastHeartbeatAt: null, consecutiveFailures: 0, lastError: null },
        { channel: 'marker-file', healthy: false, lastHeartbeatAt: null, consecutiveFailures: 0, lastError: null }
      ],
      evidence: ['truthful boundary']
    }).status).toBe('not-started')
  })

  it('distinguishes parent marker files from inner watchdog heartbeat markers', () => {
    const marker = {
      tokenPrefix: 'a'.repeat(8),
      parentPid: 1234,
      childPidExpected: null,
      writer: 'parent-supervisor',
      protocolVersion: '1.0',
      namedPipePath: 'pipe-main',
      eventPipePath: 'pipe-event',
      tcpPort: null,
      updatedAt: 1000
    }

    expect(watchdogMarkerFileSchema.parse(marker).writer).toBe('parent-supervisor')
    expect(watchdogMarkerFileSchema.parse({ ...marker, writer: 'inner-watchdog', childPidExpected: 4321 }).writer).toBe('inner-watchdog')
    expect(watchdogMarkerFileSchema.safeParse({ ...marker, writer: 'unknown' }).success).toBe(false)
  })

  it('validates renderer-safe watchdog supervisor event payloads', () => {
    const status = watchdogSupervisorStatusSchema.parse({
      innerWatchdogPid: null,
      startedAt: null,
      lastInnerHeartbeatAt: null,
      innerHealthy: false,
      channelStates: fullChannelStates(),
      spawnAttempts: 0,
      lastSpawnError: null,
      windowsServiceInstalled: false,
      status: 'degraded',
      checkedAt: 1,
      serviceName: null,
      note: 'fallback channel',
      sessionTokenPrefix: 'a'.repeat(8),
      markerFilePath: 'C:/tmp/watchdog.json',
      namedPipePath: 'pipe-main',
      eventPipePath: 'pipe-event',
      tcpPort: null,
      protocolVersion: '1.0',
      respawnAllowed: true,
      nextRespawnDelayMs: 1000,
      channelDiagnostics: [
        { channel: 'named-pipe', healthy: false, lastHeartbeatAt: null, consecutiveFailures: 1, lastError: 'closed' },
        { channel: 'tcp-localhost', healthy: true, lastHeartbeatAt: 1, consecutiveFailures: 0, lastError: null },
        { channel: 'marker-file', healthy: false, lastHeartbeatAt: null, consecutiveFailures: 0, lastError: null }
      ],
      evidence: []
    })
    const payload = watchdogSupervisorEventStreamPayloadSchema.parse({
      emittedAt: 2,
      events: [{
        eventId: 'watchdog-supervisor:channel-degrade:2:1',
        emittedAt: 2,
        type: 'channel-degrade',
        status,
        result: 'success',
        code: null,
        message: 'fallback channel',
        reason: null,
        channel: 'tcp-localhost',
        evidence: null
      }]
    })

    expect(payload.events[0]?.status.sessionTokenPrefix).toBe('a'.repeat(8))
    expect(JSON.stringify(payload)).not.toContain(token)
    expect(watchdogSupervisorEventStreamPayloadSchema.safeParse({
      emittedAt: 2,
      events: []
    }).success).toBe(false)
  })
})
