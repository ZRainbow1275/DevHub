import { useEffect, useMemo, useState } from 'react'
import type { WindowInfo } from '@shared/types-extended'
import type { ThumbnailWallEntry, ThumbnailWallViewport } from '@shared/schemas/r8-runtime'
import { buildThumbnailWallEntries } from '../utils/windowGroupKey'

interface UseWindowThumbnailsOptions {
  windows: readonly WindowInfo[]
  viewport: ThumbnailWallViewport
  thumbnailSize: { width: number; height: number }
  getDisplayName: (windowInfo: WindowInfo) => string
}

function mergeEntries(
  fallbackEntries: readonly ThumbnailWallEntry[],
  capturedEntries: ReadonlyMap<number, ThumbnailWallEntry>
): ThumbnailWallEntry[] {
  return fallbackEntries.map(entry => capturedEntries.get(entry.hwnd) ?? entry)
}

export function useWindowThumbnails({
  windows,
  viewport,
  thumbnailSize,
  getDisplayName
}: UseWindowThumbnailsOptions): ThumbnailWallEntry[] {
  const fallbackEntries = useMemo(
    () => buildThumbnailWallEntries(windows, { getDisplayName }),
    [getDisplayName, windows]
  )
  const [capturedEntries, setCapturedEntries] = useState<Map<number, ThumbnailWallEntry>>(() => new Map())

  useEffect(() => {
    const bridge = window.devhub?.windowManager?.getThumbnailsBatch
    const hwnds = fallbackEntries.map(entry => entry.hwnd)
    if (!bridge || hwnds.length === 0) {
      setCapturedEntries(new Map())
      return undefined
    }

    let disposed = false
    const load = async () => {
      try {
        const response = await bridge({
          hwnds,
          maxAgeMs: viewport.refreshIntervalMs,
          thumbnailSize
        })
        if (disposed) return
        setCapturedEntries(new Map(response.entries.map(entry => [entry.hwnd, entry])))
      } catch {
        if (!disposed) setCapturedEntries(new Map())
      }
    }

    void load()
    const interval = window.setInterval(() => { void load() }, viewport.refreshIntervalMs)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [fallbackEntries, thumbnailSize, viewport.refreshIntervalMs])

  return useMemo(() => mergeEntries(fallbackEntries, capturedEntries), [capturedEntries, fallbackEntries])
}
