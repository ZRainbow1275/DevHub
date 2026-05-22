import { createHash, randomBytes } from 'node:crypto'
import { join } from 'node:path'
import {
  handshakeMessageSchema,
  sessionTokenContextSchema,
  watchdogMarkerFileSchema,
  type HandshakeMessage,
  type SessionTokenContext,
  type WatchdogMarkerWriter,
  type WatchdogMarkerFile
} from '@shared/schemas/watchdog-rpc'

export const WATCHDOG_PROTOCOL_VERSION = '1.0'
const BACKSLASH = String.fromCharCode(92)
const WINDOWS_PIPE_ROOT = `${BACKSLASH}${BACKSLASH}.${BACKSLASH}pipe${BACKSLASH}`

export class HandshakeProtocol {
  createSession(parentPid: number, now: number = Date.now(), entropy: string = randomBytes(32).toString('hex')): SessionTokenContext {
    if (!Number.isInteger(parentPid) || parentPid <= 0) throw new Error('E_VALIDATION:parentPid must be positive')
    const token = createHash('sha256').update(`${parentPid}-${now}-${entropy}`).digest('hex')
    return sessionTokenContextSchema.parse({ token, createdAt: now, parentPid, childPidExpected: null })
  }

  tokenPrefix(token: string): string {
    return sessionTokenContextSchema.shape.token.parse(token).slice(0, 8)
  }

  namedPipePath(token: string): string {
    return `${WINDOWS_PIPE_ROOT}devhub-watchdog-${this.tokenPrefix(token)}`
  }

  eventPipePath(token: string): string {
    return `${WINDOWS_PIPE_ROOT}devhub-watchdog-event-${this.tokenPrefix(token)}`
  }

  markerFilePath(rootDir: string, token: string): string {
    return join(rootDir, 'watchdog', `devhub-watchdog-${this.tokenPrefix(token)}.json`)
  }

  createMarker(context: SessionTokenContext, updatedAt: number, tcpPort: number | null = null, writer: WatchdogMarkerWriter = 'parent-supervisor'): WatchdogMarkerFile {
    return watchdogMarkerFileSchema.parse({
      tokenPrefix: this.tokenPrefix(context.token),
      parentPid: context.parentPid,
      childPidExpected: context.childPidExpected,
      writer,
      protocolVersion: WATCHDOG_PROTOCOL_VERSION,
      namedPipePath: this.namedPipePath(context.token),
      eventPipePath: this.eventPipePath(context.token),
      tcpPort,
      updatedAt
    })
  }

  validateHandshake(input: unknown, context: SessionTokenContext): HandshakeMessage {
    const handshake = handshakeMessageSchema.parse(input)
    if (handshake.sessionToken !== context.token) throw new Error('E_PERMISSION_DENIED:watchdog sessionToken mismatch')
    if (handshake.protocolVersion !== WATCHDOG_PROTOCOL_VERSION) throw new Error('E_VALIDATION:watchdog protocolVersion mismatch')
    if (handshake.parentPid !== context.parentPid) throw new Error('E_VALIDATION:watchdog parentPid mismatch')
    return handshake
  }
}
