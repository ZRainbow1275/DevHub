import { progressDataPointSchema, type CliOutputEvent, type ParseSession, type ProgressDataPoint } from '@shared/schemas/r8-runtime'

export class StreamMultiplexer {
  fuse(events: readonly CliOutputEvent[], session: ParseSession): ProgressDataPoint | null {
    const candidates = events.filter(event => event.instanceId === session.instanceId && event.progress !== null)
    if (candidates.length === 0) return null
    const totalConfidence = candidates.reduce((total, event) => total + event.confidence, 0)
    if (totalConfidence <= 0) return null
    const percent = candidates.reduce((total, event) => total + (event.progress ?? 0) * event.confidence, 0) / totalConfidence
    const latest = candidates[candidates.length - 1]
    return progressDataPointSchema.parse({
      instanceId: session.instanceId,
      percent,
      source: candidates.length > 1 ? 'fusion' : 'cli-real',
      confidence: Math.max(...candidates.map(event => event.confidence)),
      observedAt: latest.observedAt,
      message: latest.line
    })
  }
}
