import {
  ICON_FALLBACK_TOKEN,
  ICON_LIBRARY_USAGE,
  ICON_LIBRARY_VALUES,
  isKnownIconName,
  listIconCounts,
  parseIconToken,
} from '@shared/icon-library'
import {
  iconListLibrariesResponseSchema,
  iconResolveResponseSchema,
  type IconListLibrariesResponse,
  type IconResolveResponse,
} from '@shared/schemas/r8-runtime'

export class IconRegistryService {
  listLibraries(): IconListLibrariesResponse {
    const counts = listIconCounts()
    return iconListLibrariesResponseSchema.parse({
      libraries: ICON_LIBRARY_VALUES,
      counts,
      manifests: ICON_LIBRARY_VALUES.map((library) => ({
        library,
        count: counts[library],
        usage: ICON_LIBRARY_USAGE[library],
      })),
    })
  }

  resolveToken(token: string): IconResolveResponse {
    const parsed = parseIconToken(token)
    if (!parsed) {
      return this.fallback(token)
    }

    if (!isKnownIconName(parsed.library, parsed.name)) {
      return this.fallback(token)
    }

    return iconResolveResponseSchema.parse({
      requestedToken: token,
      resolved: {
        library: parsed.library,
        name: parsed.name,
      },
      available: true,
      fallbackToken: null,
    })
  }

  private fallback(requestedToken: string): IconResolveResponse {
    const fallback = parseIconToken(ICON_FALLBACK_TOKEN)
    if (!fallback) {
      throw new Error('Invalid icon fallback token')
    }

    return iconResolveResponseSchema.parse({
      requestedToken,
      resolved: {
        library: fallback.library,
        name: fallback.name,
      },
      available: false,
      fallbackToken: ICON_FALLBACK_TOKEN,
    })
  }
}
