import { z } from 'zod'
import { recordingEventSchema, recordingManifestSchema, recordingStreamKindSchema } from './recording'

export const replaySpeedValueSchema = z.union([
  z.literal(0.25),
  z.literal(0.5),
  z.literal(1),
  z.literal(2),
  z.literal(4),
  z.literal(8)
])

export const replaySpeedSchema = z.preprocess(value => {
  if (typeof value === 'string') return Number(value)
  return value
}, replaySpeedValueSchema)

export const replayAnchorKindSchema = z.enum(['error', 'state-flip', 'inject', 'rotate', 'fs-burst'])

export const replayAnchorSchema = z.object({
  ts: z.number().int().nonnegative(),
  kind: replayAnchorKindSchema,
  label: z.string().min(1),
  color: z.string().min(1).optional()
})

export const recordingReplayStateSchema = z.object({
  recordingId: z.string().uuid(),
  manifest: recordingManifestSchema,
  cursorTs: z.number().int().nonnegative(),
  startedAtAbsTs: z.number().int().nonnegative(),
  endedAtAbsTs: z.number().int().nonnegative(),
  speed: replaySpeedSchema.default(1),
  paused: z.boolean().default(true),
  enabledTracks: z.array(recordingStreamKindSchema).min(1),
  anchors: z.array(replayAnchorSchema).default([])
})

export const asciinemaOutputEventSchema = z.tuple([
  z.number().nonnegative(),
  z.literal('o'),
  z.string()
])

export const asciinemaCastSchema = z.object({
  version: z.literal(2),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  timestamp: z.number().int().nonnegative(),
  duration: z.number().nonnegative().optional(),
  title: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  events: z.array(asciinemaOutputEventSchema)
})

export const recordingGetReplayStateRequestSchema = z.object({
  recordingId: z.string().uuid(),
  cursorTs: z.number().int().nonnegative().optional(),
  speed: replaySpeedSchema.optional(),
  paused: z.boolean().optional(),
  enabledTracks: z.array(recordingStreamKindSchema).min(1).optional()
})

export const recordingGetEventsWindowRequestSchema = z.object({
  recordingId: z.string().uuid(),
  sinceTs: z.number().int().nonnegative(),
  untilTs: z.number().int().nonnegative(),
  kinds: z.array(recordingStreamKindSchema).min(1).optional()
}).refine(value => value.untilTs >= value.sinceTs, { message: 'untilTs must be greater than or equal to sinceTs' })

export const recordingGetCastRequestSchema = z.object({
  recordingId: z.string().uuid()
})

export const recordingListAnchorsRequestSchema = z.object({
  recordingId: z.string().uuid()
})

export const recordingGetScreenshotRequestSchema = z.object({
  recordingId: z.string().uuid(),
  ts: z.number().int().nonnegative()
})

export const recordingScreenshotResultSchema = z.object({
  filePath: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  eventTs: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative()
})

export const recordingGetFsSnapshotAtRequestSchema = z.object({
  recordingId: z.string().uuid(),
  ts: z.number().int().nonnegative()
})

export const recordingFsSnapshotEntrySchema = z.object({
  path: z.string().min(1),
  op: z.enum(['add', 'change', 'unlink', 'addDir', 'unlinkDir']),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  sha256After: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  lastTs: z.number().int().nonnegative()
})

export const recordingFsSnapshotResultSchema = z.object({
  recordingId: z.string().uuid(),
  cursorTs: z.number().int().nonnegative(),
  tree: z.array(recordingFsSnapshotEntrySchema)
})

export const recordingGetCastResultSchema = z.object({
  cast: asciinemaCastSchema
})

export const recordingListAnchorsResultSchema = z.object({
  anchors: z.array(replayAnchorSchema)
})

export const recordingGetEventsWindowResultSchema = z.array(recordingEventSchema)

export type ReplaySpeed = z.infer<typeof replaySpeedSchema>
export type ReplayAnchorKind = z.infer<typeof replayAnchorKindSchema>
export type RecordingReplayAnchor = z.infer<typeof replayAnchorSchema>
export type RecordingReplayState = z.infer<typeof recordingReplayStateSchema>
export type AsciinemaCast = z.infer<typeof asciinemaCastSchema>
export type RecordingGetReplayStateRequest = z.infer<typeof recordingGetReplayStateRequestSchema>
export type RecordingEventsWindowRequest = z.infer<typeof recordingGetEventsWindowRequestSchema>
export type RecordingScreenshotResult = z.infer<typeof recordingScreenshotResultSchema>
export type RecordingFsSnapshotResult = z.infer<typeof recordingFsSnapshotResultSchema>
