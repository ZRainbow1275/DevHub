import { memo, useMemo } from 'react'
import { WindowIcon } from '../icons'

interface LayoutPreviewWindow {
  title: string
  processName: string
  rect?: { x: number; y: number; width: number; height: number }
}

interface LayoutPreviewProps {
  windows: LayoutPreviewWindow[]
}

/**
 * Mini-map preview of window positions for the save-layout dialog.
 * Renders div-based rectangles scaled to fit the preview container.
 * Falls back to a simple list when no windows have bounds info.
 */
export const LayoutPreview = memo(function LayoutPreview({ windows }: LayoutPreviewProps) {
  const windowsWithBounds = windows.filter(
    (w): w is LayoutPreviewWindow & { rect: NonNullable<LayoutPreviewWindow['rect']> } =>
      !!w.rect && w.rect.width > 0 && w.rect.height > 0
  )

  // Compute the bounding box and scale factor
  const layout = useMemo(() => {
    if (windowsWithBounds.length === 0) return null

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const w of windowsWithBounds) {
      minX = Math.min(minX, w.rect.x)
      minY = Math.min(minY, w.rect.y)
      maxX = Math.max(maxX, w.rect.x + w.rect.width)
      maxY = Math.max(maxY, w.rect.y + w.rect.height)
    }

    const totalWidth = maxX - minX || 1
    const totalHeight = maxY - minY || 1

    return { minX, minY, totalWidth, totalHeight }
  }, [windowsWithBounds])

  // Color palette for window blocks
  const colors = [
    'bg-accent/40 border-accent',
    'bg-success/40 border-success',
    'bg-info/40 border-info',
    'bg-warning/40 border-warning',
    'bg-purple-500/40 border-purple-500',
    'bg-cyan-500/40 border-cyan-500',
  ]

  // Fallback: simple list when no bounds info
  if (!layout || windowsWithBounds.length === 0) {
    return (
      <div
        className="mt-3 p-3 bg-surface-800/50 border-l-3 border-info relative z-10 radius-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <WindowIcon size={14} className="text-info" />
          <span className="text-xs font-medium text-text-secondary">
            包含 {windows.length} 个窗口
          </span>
        </div>
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {windows.slice(0, 8).map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-1.5 h-1.5 bg-accent radius-sm" />
              <span className="truncate">{w.processName}</span>
              <span className="text-text-muted/50 truncate flex-1">{w.title}</span>
            </div>
          ))}
          {windows.length > 8 && (
            <span className="text-xs text-text-muted/50">...还有 {windows.length - 8} 个</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="mt-3 p-3 bg-surface-800/50 border-l-3 border-info relative z-10 radius-sm"
    >
      <div className="flex items-center gap-2 mb-2">
        <WindowIcon size={14} className="text-info" />
        <span className="text-xs font-medium text-text-secondary">
          布局预览 ({windowsWithBounds.length} 个窗口)
        </span>
      </div>

      {/* Mini-map container */}
      <div
        className="relative bg-surface-900 border border-surface-600 overflow-hidden"
        style={{
          borderRadius: '2px',
          // Maintain aspect ratio with a max height
          width: '100%',
          paddingBottom: `${Math.min((layout.totalHeight / layout.totalWidth) * 100, 60)}%`,
        }}
      >
        {windowsWithBounds.map((w, i) => {
          const left = ((w.rect.x - layout.minX) / layout.totalWidth) * 100
          const top = ((w.rect.y - layout.minY) / layout.totalHeight) * 100
          const width = (w.rect.width / layout.totalWidth) * 100
          const height = (w.rect.height / layout.totalHeight) * 100
          const colorClass = colors[i % colors.length]

          return (
            <div
              key={i}
              className={`absolute border ${colorClass} flex items-center justify-center overflow-hidden`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${Math.max(width, 2)}%`,
                height: `${Math.max(height, 2)}%`,
                borderRadius: '1px',
                fontSize: '8px',
              }}
              title={`${w.processName}: ${w.title}`}
            >
              <span className="text-text-primary/70 truncate px-0.5 leading-none" style={{ fontSize: '7px' }}>
                {w.processName}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
