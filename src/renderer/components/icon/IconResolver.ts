import {
  ICON_FALLBACK_TOKEN,
  parseIconToken,
  type IconLibrary,
  type ParsedIconToken,
} from '@shared/icon-library'
import { findRendererIconEntry, type RendererIconEntry, type RendererIconToken } from './registry'

export interface RendererIconResolution {
  available: boolean
  entry: RendererIconEntry
  fallbackToken: RendererIconToken | null
  parsed: ParsedIconToken
  requestedToken: string
  token: RendererIconToken
}

function toRendererToken(library: IconLibrary, name: string): RendererIconToken {
  return `${library}:${name}`
}

export function resolveRendererIcon(token: string): RendererIconResolution {
  const parsed = parseIconToken(token)
  if (parsed) {
    const entry = findRendererIconEntry(parsed.library, parsed.name)
    if (entry) {
      return {
        available: true,
        entry,
        fallbackToken: null,
        parsed,
        requestedToken: token,
        token: toRendererToken(parsed.library, parsed.name),
      }
    }
  }

  const fallback = parseIconToken(ICON_FALLBACK_TOKEN)
  if (!fallback) {
    throw new Error('Invalid renderer icon fallback token')
  }

  const fallbackEntry = findRendererIconEntry(fallback.library, fallback.name)
  if (!fallbackEntry) {
    throw new Error(`Renderer icon fallback is not registered: ${ICON_FALLBACK_TOKEN}`)
  }

  return {
    available: false,
    entry: fallbackEntry,
    fallbackToken: ICON_FALLBACK_TOKEN,
    parsed: fallback,
    requestedToken: token,
    token: toRendererToken(fallback.library, fallback.name),
  }
}
