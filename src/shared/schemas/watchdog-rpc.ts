import { z } from 'zod'

export const watchdogSessionTokenSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const watchdogProtocolVersionSchema = z.string().regex(/^\d+\.\d+$/)

export const rpcChannelSchema = z.enum(['named-pipe', 'tcp-localhost', 'marker-file'])
export const watchdogMarkerWriterSchema = z.enum(['parent-supervisor', 'inner-watchdog'])
export const watchdogRpcMethodSchema = z.enum([
  'register-instance',
  'deregister-instance',
  'configure-instance',
  'get-status',
  'override-restart',
  'shutdown',
  'ping'
])

export const handshakeMessageSchema = z.object({
  type: z.literal('handshake'),
  sessionToken: watchdogSessionTokenSchema,
  protocolVersion: watchdogProtocolVersionSchema,
  parentPid: z.number().int().positive()
}).strict()

export const rpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string().min(1), z.number().finite()]),
  method: watchdogRpcMethodSchema,
  params: z.record(z.string(), z.unknown()).optional()
}).strict()

export const rpcErrorSchema = z.object({
  code: z.number().int(),
  message: z.string().min(1),
  data: z.unknown().optional()
}).strict()

export const rpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string().min(1), z.number().finite()]),
  result: z.unknown().optional(),
  error: rpcErrorSchema.optional()
}).strict().superRefine((value, ctx) => {
  const hasResult = Object.prototype.hasOwnProperty.call(value, 'result')
  const hasError = value.error !== undefined
  if (hasResult === hasError) {
    ctx.addIssue({ code: 'custom', message: 'RPC response must contain exactly one of result or error' })
  }
})

export const supervisorStateSchema = z.object({
  innerWatchdogPid: z.number().int().positive().nullable(),
  startedAt: z.number().int().nonnegative().nullable(),
  lastInnerHeartbeatAt: z.number().int().nonnegative().nullable(),
  innerHealthy: z.boolean(),
  channelStates: z.record(rpcChannelSchema, z.boolean()),
  spawnAttempts: z.number().int().nonnegative(),
  lastSpawnError: z.string().nullable(),
  windowsServiceInstalled: z.boolean()
}).strict()

export const sessionTokenContextSchema = z.object({
  token: watchdogSessionTokenSchema,
  createdAt: z.number().int().nonnegative(),
  parentPid: z.number().int().positive(),
  childPidExpected: z.number().int().positive().nullable()
}).strict()

export const watchdogMarkerFileSchema = z.object({
  tokenPrefix: z.string().regex(/^[a-f0-9]{8}$/),
  parentPid: z.number().int().positive(),
  childPidExpected: z.number().int().positive().nullable(),
  writer: watchdogMarkerWriterSchema,
  protocolVersion: watchdogProtocolVersionSchema,
  namedPipePath: z.string().min(1),
  eventPipePath: z.string().min(1),
  tcpPort: z.number().int().positive().nullable(),
  updatedAt: z.number().int().nonnegative()
}).strict()

export const watchdogChannelDiagnosticSchema = z.object({
  channel: rpcChannelSchema,
  healthy: z.boolean(),
  lastHeartbeatAt: z.number().int().nonnegative().nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
  lastError: z.string().nullable()
}).strict()

export const watchdogSupervisorStatusValueSchema = z.enum([
  'not-installed',
  'not-started',
  'starting',
  'healthy',
  'degraded',
  'dead',
  'orphan',
  'fatal'
])

export const watchdogSupervisorStatusSchema = supervisorStateSchema.extend({
  status: watchdogSupervisorStatusValueSchema,
  checkedAt: z.number().int().nonnegative(),
  serviceName: z.string().nullable(),
  note: z.string().min(1),
  sessionTokenPrefix: z.string().regex(/^[a-f0-9]{8}$/),
  markerFilePath: z.string().min(1),
  namedPipePath: z.string().min(1),
  eventPipePath: z.string().min(1),
  tcpPort: z.number().int().positive().nullable(),
  protocolVersion: watchdogProtocolVersionSchema,
  respawnAllowed: z.boolean(),
  nextRespawnDelayMs: z.number().int().nonnegative(),
  channelDiagnostics: z.array(watchdogChannelDiagnosticSchema),
  evidence: z.array(z.string().min(1)).default([])
}).strict()

export const watchdogSupervisorEventTypeSchema = z.enum([
  'status',
  'respawn',
  'spawn',
  'install-service',
  'uninstall-service',
  'handshake',
  'handshake-fail',
  'channel-degrade',
  'orphan',
  'takeover',
  'evaluate',
  'heartbeat-start'
])

export const watchdogSupervisorEventResultSchema = z.enum(['info', 'success', 'refused', 'error'])

export const watchdogSupervisorEventSchema = z.object({
  eventId: z.string().min(1),
  emittedAt: z.number().int().nonnegative(),
  type: watchdogSupervisorEventTypeSchema,
  status: watchdogSupervisorStatusSchema,
  result: watchdogSupervisorEventResultSchema,
  code: z.string().min(1).nullable(),
  message: z.string().min(1).nullable(),
  reason: z.string().min(1).nullable(),
  channel: rpcChannelSchema.nullable(),
  evidence: z.string().min(1).nullable()
}).strict()

export const watchdogSupervisorEventStreamPayloadSchema = z.object({
  emittedAt: z.number().int().nonnegative(),
  events: z.array(watchdogSupervisorEventSchema).min(1).max(100)
}).strict()

export const watchdogSupervisorRespawnRequestSchema = z.object({
  reason: z.string().min(1).optional(),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const watchdogSupervisorServiceRequestSchema = z.object({
  confirmAdmin: z.boolean().default(false),
  confirmedBy: z.string().min(3).optional()
}).strict()

export type RpcChannel = z.infer<typeof rpcChannelSchema>
export type WatchdogMarkerWriter = z.infer<typeof watchdogMarkerWriterSchema>
export type WatchdogRpcMethod = z.infer<typeof watchdogRpcMethodSchema>
export type HandshakeMessage = z.infer<typeof handshakeMessageSchema>
export type RpcRequest = z.infer<typeof rpcRequestSchema>
export type RpcResponse = z.infer<typeof rpcResponseSchema>
export type SupervisorState = z.infer<typeof supervisorStateSchema>
export type SessionTokenContext = z.infer<typeof sessionTokenContextSchema>
export type WatchdogMarkerFile = z.infer<typeof watchdogMarkerFileSchema>
export type WatchdogChannelDiagnostic = z.infer<typeof watchdogChannelDiagnosticSchema>
export type WatchdogSupervisorStatus = z.infer<typeof watchdogSupervisorStatusSchema>
export type WatchdogSupervisorEventType = z.infer<typeof watchdogSupervisorEventTypeSchema>
export type WatchdogSupervisorEventResult = z.infer<typeof watchdogSupervisorEventResultSchema>
export type WatchdogSupervisorEvent = z.infer<typeof watchdogSupervisorEventSchema>
export type WatchdogSupervisorEventStreamPayload = z.infer<typeof watchdogSupervisorEventStreamPayloadSchema>
export type WatchdogSupervisorRespawnRequest = z.infer<typeof watchdogSupervisorRespawnRequestSchema>
export type WatchdogSupervisorServiceRequest = z.infer<typeof watchdogSupervisorServiceRequestSchema>
