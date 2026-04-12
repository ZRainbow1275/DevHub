import { useCallback, useRef, useState, useEffect, type ReactNode } from 'react'

/**
 * PanelSplitter -- a lightweight, dependency-free resizable panel
 * container that uses pointer events and flex-basis to split its
 * children into draggable panes.
 *
 * - Supports horizontal (left/right) and vertical (top/bottom) splits.
 * - minSizes / maxSizes are in pixels.
 * - defaultSizes are percentages (must sum to 100).
 * - Persists sizes to localStorage when storageKey is provided.
 */

interface PanelSplitterProps {
  /** Split direction. 'horizontal' = side-by-side, 'vertical' = stacked. */
  direction: 'horizontal' | 'vertical'
  /** Initial sizes as percentages. Must have same length as children. */
  defaultSizes: number[]
  /** Minimum pixel sizes for each pane. */
  minSizes?: number[]
  /** Maximum pixel sizes for each pane. */
  maxSizes?: number[]
  /** localStorage key for persisting the split position. */
  storageKey?: string
  /** Called when sizes change (percentages). */
  onResize?: (sizes: number[]) => void
  children: ReactNode[]
}

export function PanelSplitter({
  direction,
  defaultSizes,
  minSizes,
  maxSizes,
  storageKey,
  onResize,
  children,
}: PanelSplitterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState<number[]>(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as number[]
          if (Array.isArray(parsed) && parsed.length === defaultSizes.length) {
            return parsed
          }
        } catch {
          // fall through to default
        }
      }
    }
    return defaultSizes
  })
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  // Persist to localStorage
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(sizes))
    }
  }, [sizes, storageKey])

  const handleDragStart = useCallback(
    (index: number, startEvent: React.PointerEvent) => {
      startEvent.preventDefault()
      const container = containerRef.current
      if (!container) return

      setDraggingIndex(index)

      const isHorizontal = direction === 'horizontal'
      const containerRect = container.getBoundingClientRect()
      const totalSize = isHorizontal ? containerRect.width : containerRect.height
      const startPos = isHorizontal ? startEvent.clientX : startEvent.clientY
      const startSizes = [...sizes]

      // Number of splitter bars * 4px each
      const splitterCount = children.length - 1
      const splitterTotal = splitterCount * 4
      const availableSize = totalSize - splitterTotal

      const onPointerMove = (e: PointerEvent) => {
        const currentPos = isHorizontal ? e.clientX : e.clientY
        const deltaPx = currentPos - startPos
        const deltaPct = (deltaPx / availableSize) * 100

        let newLeftPct = startSizes[index] + deltaPct
        let newRightPct = startSizes[index + 1] - deltaPct

        // Enforce min sizes
        if (minSizes) {
          const minLeftPct = ((minSizes[index] || 0) / availableSize) * 100
          const minRightPct = ((minSizes[index + 1] || 0) / availableSize) * 100
          if (newLeftPct < minLeftPct) {
            const correction = minLeftPct - newLeftPct
            newLeftPct = minLeftPct
            newRightPct -= correction
          }
          if (newRightPct < minRightPct) {
            const correction = minRightPct - newRightPct
            newRightPct = minRightPct
            newLeftPct -= correction
          }
        }

        // Enforce max sizes
        if (maxSizes) {
          if (maxSizes[index] !== undefined) {
            const maxLeftPct = (maxSizes[index] / availableSize) * 100
            if (newLeftPct > maxLeftPct) {
              const correction = newLeftPct - maxLeftPct
              newLeftPct = maxLeftPct
              newRightPct += correction
            }
          }
          if (maxSizes[index + 1] !== undefined) {
            const maxRightPct = (maxSizes[index + 1] / availableSize) * 100
            if (newRightPct > maxRightPct) {
              const correction = newRightPct - maxRightPct
              newRightPct = maxRightPct
              newLeftPct += correction
            }
          }
        }

        // Prevent negatives
        if (newLeftPct < 1) newLeftPct = 1
        if (newRightPct < 1) newRightPct = 1

        const newSizes = [...startSizes]
        newSizes[index] = newLeftPct
        newSizes[index + 1] = newRightPct

        setSizes(newSizes)
        onResize?.(newSizes)
      }

      const onPointerUp = () => {
        setDraggingIndex(null)
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
      }

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    },
    [direction, sizes, minSizes, maxSizes, onResize, children.length],
  )

  // Double-click splitter to reset to default sizes
  const handleDoubleClick = useCallback(
    () => {
      setSizes(defaultSizes)
      onResize?.(defaultSizes)
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(defaultSizes))
      }
    },
    [defaultSizes, onResize, storageKey],
  )

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full`}
      style={{
        // Prevent text selection while dragging
        userSelect: draggingIndex !== null ? 'none' : undefined,
      }}
    >
      {children.map((child, i) => (
        <PanelPane key={i}>
          {/* Pane content */}
          <div
            className="h-full w-full overflow-hidden"
            style={{ flexBasis: `${sizes[i]}%`, flexGrow: 0, flexShrink: 0 }}
          >
            {child}
          </div>

          {/* Splitter bar between panes */}
          {i < children.length - 1 && (
            <div
              className={`panel-splitter panel-splitter--${isHorizontal ? 'horizontal' : 'vertical'} ${
                draggingIndex === i ? 'panel-splitter--dragging' : ''
              }`}
              onPointerDown={(e) => handleDragStart(i, e)}
              onDoubleClick={handleDoubleClick}
              title="Double-click to reset"
            />
          )}
        </PanelPane>
      ))}
    </div>
  )
}

/**
 * Wrapper fragment for each pane + its trailing splitter bar.
 * Rendered as a fragment so flex layout applies directly.
 */
function PanelPane({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}
