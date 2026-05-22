import { z } from 'zod'
import { codexMarkerSchema, type CodexMarker } from '@shared/schemas/r8-runtime'

export const MARKER_PREFIX = 'DEVHUB::MARKER::'
export const MARKER_VERSION = 1

const markerFieldSchema = z.enum(['PHASE', 'PROGRESS', 'TOKENS', 'TOOL', 'ERROR', 'DONE', 'HEARTBEAT'])

export function parseCodexMarkerLine(line: string, observedAt: number): CodexMarker | null {
  if (!line.startsWith(MARKER_PREFIX)) return null
  const body = line.slice(MARKER_PREFIX.length)
  const parts = body.split('::')
  let version: number | null = null
  let field: z.infer<typeof markerFieldSchema> | null = null
  let value: string | null = null

  for (const part of parts) {
    const separator = part.indexOf('=')
    if (separator <= 0) return null
    const key = part.slice(0, separator).trim()
    const rawValue = part.slice(separator + 1).trim()
    if (key === 'v') {
      version = Number(rawValue)
      continue
    }
    const parsedField = markerFieldSchema.safeParse(key)
    if (parsedField.success) {
      field = parsedField.data
      value = rawValue
      continue
    }
    return null
  }

  if (version !== MARKER_VERSION || field === null || value === null) return null
  return codexMarkerSchema.parse({ version, field, value, ts: observedAt })
}

export function formatCodexMarker(marker: CodexMarker): string {
  return `${MARKER_PREFIX}v=${marker.version}::${marker.field}=${marker.value}`
}
