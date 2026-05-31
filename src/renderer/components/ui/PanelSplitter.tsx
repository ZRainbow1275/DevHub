import { useCallback, useRef, useState, useEffect, useMemo, type ReactNode } from 'react'
import { useContainerSize } from '../../hooks/useContainerSize'

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

function arePanelSizesEquivalent(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => Math.abs(value - right[index]) < 0.1)
}

function clampPanelPixels(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeTwoPaneSizes(
  candidate: number[],
  totalSize: number,
  paneCount: number,
  minSizes: number[],
  maxSizes?: number[]
): number[] {
  if (paneCount !== 2 || candidate.length !== 2 || totalSize <= 0) {
    return candidate
  }

  const availableSize = totalSize - 4
  if (availableSize <= 0) {
    return candidate
  }

  const minLeft = minSizes[0] ?? 0
  const minRight = minSizes[1] ?? 0
  if (minLeft + minRight > availableSize) {
    return candidate
  }

  const maxLeft = maxSizes?.[0] ?? Number.POSITIVE_INFINITY
  const maxRight = maxSizes?.[1] ?? Number.POSITIVE_INFINITY
  let rightPx = (candidate[1] / 100) * availableSize
  rightPx = clampPanelPixels(rightPx, minRight, Math.min(maxRight, availableSize - minLeft))

  let leftPx = availableSize - rightPx
  leftPx = clampPanelPixels(leftPx, minLeft, Math.min(maxLeft, availableSize - minRight))
  rightPx = availableSize - leftPx

  return [
    (leftPx / availableSize) * 100,
    (rightPx / availableSize) * 100
  ]
}

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
  /** Minimum panel width in pixels. Defaults to 300. */
  minPanelWidth?: number
  /** Stack horizontal panes vertically when the splitter container is narrower than this width. */
  stackBelow?: number
  children: ReactNode[]
}

export function PanelSplitter({
  direction,
  defaultSizes,
  minSizes,
  maxSizes,
  storageKey,
  onResize,
  minPanelWidth = 300,
  stackBelow,
  children,
}: PanelSplitterProps) {
  // Enforce minimum panel width: if no minSizes provided, use minPanelWidth for all panes
  const effectiveMinSizes = useMemo(
    () => minSizes ?? Array.from({ length: children.length }, () => minPanelWidth),
    [children.length, minPanelWidth, minSizes]
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const containerSize = useContainerSize(containerRef)
  const isStacked = direction === 'horizontal' && stackBelow !== undefined && containerSize.width > 0 && containerSize.width < stackBelow
  const effectiveDirection = isStacked ? 'vertical' : direction
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

  useEffect(() => {
    if (isStacked) return

    const totalSize = effectiveDirection === 'horizontal' ? containerSize.width : containerSize.height
    if (totalSize <= 0) return

    setSizes((currentSizes) => {
      const normalizedSizes = normalizeTwoPaneSizes(
        currentSizes,
        totalSize,
        children.length,
        effectiveMinSizes,
        maxSizes
      )

      if (arePanelSizesEquivalent(currentSizes, normalizedSizes)) {
        return currentSizes
      }

      onResize?.(normalizedSizes)
      return normalizedSizes
    })
  }, [children.length, containerSize.height, containerSize.width, effectiveDirection, effectiveMinSizes, isStacked, maxSizes, onResize])

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

      const isHorizontal = effectiveDirection === 'horizontal'
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
        if (effectiveMinSizes) {
          const minLeftPct = ((effectiveMinSizes[index] || 0) / availableSize) * 100
          const minRightPct = ((effectiveMinSizes[index + 1] || 0) / availableSize) * 100
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
    [effectiveDirection, sizes, effectiveMinSizes, maxSizes, onResize, children.length],
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

  const isHorizontal = effectiveDirection === 'horizontal'

  return (
    <div
      ref={containerRef}
      className={`panel-splitter-root flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full`}
      data-testid="panel-splitter-root"
      data-splitter-storage-key={storageKey}
      data-panel-mode={isStacked ? 'stacked' : 'split'}
      data-panel-breakpoint={containerSize.breakpoint}
      style={{
        // Prevent text selection while dragging
        userSelect: draggingIndex !== null ? 'none' : undefined,
      }}
    >
      {children.map((child, i) => (
        <PanelPane key={i}>
          {/* Pane content */}
          <div
            className="h-full w-full min-w-0 min-h-0 overflow-hidden panel-splitter-pane"
            style={isStacked
              ? {
                  flexBasis: i === 0 ? 'min(42%, 320px)' : 'auto',
                  flexGrow: i === children.length - 1 ? 1 : 0,
                  flexShrink: i === 0 ? 0 : 1,
                  minHeight: 0
                }
              : { flexBasis: `${sizes[i]}%`, flexGrow: 0, flexShrink: 0 }}
          >
            {child}
          </div>

          {/* Splitter bar between panes */}
          {i < children.length - 1 && (
            <div
              className={`panel-splitter panel-splitter--${isHorizontal ? 'horizontal' : 'vertical'} ${
                draggingIndex === i ? 'panel-splitter--dragging' : ''
              }`}
              data-testid={`panel-splitter-handle-${i}`}
              role="separator"
              aria-label={`调整面板分隔条 ${i + 1}`}
              aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(sizes[i] ?? 0)}
              aria-valuetext={`面板 ${i + 1} 占比 ${Math.round(sizes[i] ?? 0)}%`}
              tabIndex={0}
              onPointerDown={(e) => handleDragStart(i, e)}
              onDoubleClick={handleDoubleClick}
              title="双击重置面板比例"
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
