import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WindowSelectionGesture } from '../../../hooks/useBatchSelection'

interface LassoSelectProps {
  children: ReactNode
  className?: string
  enabled: boolean
  onSelect: (hwnds: number[], gesture: WindowSelectionGesture) => void
}

interface Point {
  x: number
  y: number
}

interface LassoBox {
  left: number
  top: number
  width: number
  height: number
}

const MIN_LASSO_DISTANCE = 6
const SELECTABLE_WINDOW_ATTR = 'data-window-selection-hwnd'

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('button, input, textarea, select, a, [contenteditable="true"], [data-window-selection-ignore="true"]'))
}

function toBox(start: Point, end: Point): LassoBox {
  const left = Math.min(start.x, end.x)
  const top = Math.min(start.y, end.y)
  return {
    left,
    top,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

function intersects(box: LassoBox, rect: DOMRect): boolean {
  const right = box.left + box.width
  const bottom = box.top + box.height
  return rect.left <= right && rect.right >= box.left && rect.top <= bottom && rect.bottom >= box.top
}

function collectIntersectingHwnds(root: HTMLElement, box: LassoBox): number[] {
  const hwnds: number[] = []
  const seen = new Set<number>()
  const nodes = root.querySelectorAll<HTMLElement>(`[${SELECTABLE_WINDOW_ATTR}]`)
  nodes.forEach((node) => {
    const hwnd = Number(node.getAttribute(SELECTABLE_WINDOW_ATTR))
    if (!Number.isInteger(hwnd) || hwnd <= 0 || seen.has(hwnd)) return
    if (!intersects(box, node.getBoundingClientRect())) return
    seen.add(hwnd)
    hwnds.push(hwnd)
  })
  return hwnds
}

export const LassoSelect = memo(function LassoSelect({
  children,
  className,
  enabled,
  onSelect
}: LassoSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const startRef = useRef<Point | null>(null)
  const gestureRef = useRef<WindowSelectionGesture>({})
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null)

  const lassoBox = useMemo(() => {
    if (!startRef.current || !currentPoint) return null
    return toBox(startRef.current, currentPoint)
  }, [currentPoint])

  const reset = useCallback(() => {
    startRef.current = null
    setCurrentPoint(null)
    gestureRef.current = {}
  }, [])

  const finishLasso = useCallback((point: Point) => {
    const root = rootRef.current
    const start = startRef.current
    if (!root || !start) {
      reset()
      return
    }

    const box = toBox(start, point)
    if (box.width < MIN_LASSO_DISTANCE && box.height < MIN_LASSO_DISTANCE) {
      reset()
      return
    }

    onSelect(collectIntersectingHwnds(root, box), gestureRef.current)
    reset()
  }, [onSelect, reset])

  useEffect(() => {
    if (!currentPoint) return undefined

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault()
      setCurrentPoint({ x: event.clientX, y: event.clientY })
    }

    const handlePointerUp = (event: PointerEvent) => {
      event.preventDefault()
      finishLasso({ x: event.clientX, y: event.clientY })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    window.addEventListener('pointercancel', reset, { once: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', reset)
    }
  }, [currentPoint, finishLasso, reset])

  return (
    <div
      ref={rootRef}
      data-testid="window-lasso-region"
      data-window-lasso-enabled={enabled ? 'true' : 'false'}
      className={`relative select-none ${className ?? ''}`}
      onPointerDown={(event) => {
        if (!enabled || event.button !== 0 || isInteractiveElement(event.target)) return
        startRef.current = { x: event.clientX, y: event.clientY }
        gestureRef.current = {
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey
        }
        setCurrentPoint({ x: event.clientX, y: event.clientY })
      }}
    >
      {children}
      {lassoBox && (
        <div
          data-testid="window-lasso-box"
          className="pointer-events-none fixed z-[80] border border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(56,189,248,0.24)]"
          style={{
            left: lassoBox.left,
            top: lassoBox.top,
            width: lassoBox.width,
            height: lassoBox.height
          }}
        />
      )}
    </div>
  )
})
