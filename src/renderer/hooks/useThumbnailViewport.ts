import { useEffect, useMemo, useRef, useState } from 'react'
import {
  THUMBNAIL_LIMITS,
  thumbnailWallViewportSchema,
  type ThumbnailWallViewport
} from '@shared/schemas/r8-runtime'

const WALL_GAP_PX = 12
const DEFAULT_CONTAINER_WIDTH_PX = 960

export function getThumbnailTileSize(zoomLevel: ThumbnailWallViewport['zoomLevel']) {
  return {
    width: THUMBNAIL_LIMITS.TILE_W_BY_ZOOM[zoomLevel],
    height: THUMBNAIL_LIMITS.TILE_H_BY_ZOOM[zoomLevel]
  }
}

export function computeThumbnailColumns(containerWidth: number, tileWidth: number): number {
  const safeWidth = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : DEFAULT_CONTAINER_WIDTH_PX
  return Math.max(1, Math.floor((safeWidth + WALL_GAP_PX) / (tileWidth + WALL_GAP_PX)))
}

export function useThumbnailViewport(initialViewport: Partial<ThumbnailWallViewport> = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(DEFAULT_CONTAINER_WIDTH_PX)
  const [viewport, setViewport] = useState<ThumbnailWallViewport>(() => thumbnailWallViewportSchema.parse(initialViewport))

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined
    setContainerWidth(element.clientWidth || DEFAULT_CONTAINER_WIDTH_PX)
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width
      if (nextWidth && Number.isFinite(nextWidth)) setContainerWidth(nextWidth)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const tileSize = useMemo(() => getThumbnailTileSize(viewport.zoomLevel), [viewport.zoomLevel])
  const columns = useMemo(() => computeThumbnailColumns(containerWidth, tileSize.width), [containerWidth, tileSize.width])

  return {
    containerRef,
    viewport,
    setViewport,
    tileSize,
    columns,
    gap: WALL_GAP_PX,
    containerWidth
  }
}
