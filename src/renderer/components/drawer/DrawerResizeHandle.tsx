import { useEffect, useState } from 'react'
import type { DrawerSlot } from '@shared/schemas/r8-runtime'
import { useDrawer } from '../../hooks/useDrawer'
import { useT } from '../../hooks/useT'
import { DRAWER_LIMITS } from './drawer-model'

interface DrawerResizeHandleProps {
  slot: DrawerSlot
}

interface DragStart {
  pointerX: number
  pointerY: number
  size: number
}

// Keep the drawer reachable: never let a drag push the size below the slot's
// minimum or past the viewport (minus a margin so the header/handle stay grabbable).
const DRAG_VIEWPORT_MARGIN = 80

function maxSizeForDrag(slot: DrawerSlot): number {
  const horizontal = slot === 'top' || slot === 'bottom' || slot === 'statusbar'
  const viewport = horizontal
    ? (typeof window !== 'undefined' ? window.innerHeight : DRAWER_LIMITS[slot].max)
    : (typeof window !== 'undefined' ? window.innerWidth : DRAWER_LIMITS[slot].max)
  return Math.max(DRAWER_LIMITS[slot].min, viewport - DRAG_VIEWPORT_MARGIN)
}

function nextSizeForDrag(slot: DrawerSlot, dragStart: DragStart, event: PointerEvent): number {
  const deltaX = event.clientX - dragStart.pointerX
  const deltaY = event.clientY - dragStart.pointerY
  let raw: number
  if (slot === 'right') raw = dragStart.size - deltaX
  else if (slot === 'bottom') raw = dragStart.size - deltaY
  else if (slot === 'floating') raw = dragStart.size + deltaX
  else raw = dragStart.size + deltaY
  return Math.min(maxSizeForDrag(slot), Math.max(DRAWER_LIMITS[slot].min, raw))
}

export function DrawerResizeHandle({ slot }: DrawerResizeHandleProps) {
  const { t } = useT()
  const { state, setSize } = useDrawer(slot)
  const [dragStart, setDragStart] = useState<DragStart | null>(null)
  const horizontal = slot === 'top' || slot === 'bottom' || slot === 'statusbar'

  useEffect(() => {
    if (!dragStart) return

    const handlePointerMove = (event: PointerEvent) => {
      void setSize(nextSizeForDrag(slot, dragStart, event))
    }
    const handlePointerUp = () => setDragStart(null)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragStart, setSize, slot])

  return (
    <button
      type="button"
      aria-label={t('drawer.resize', 'Resize {{slot}} drawer').replace('{{slot}}', String(slot))}
      data-testid={`drawer-${slot}-resize-handle`}
      className={horizontal
        ? 'absolute left-0 right-0 h-1.5 cursor-row-resize bg-accent/20 hover:h-2 hover:bg-accent/40 before:absolute before:inset-x-0 before:-top-1 before:-bottom-1 before:content-[\'\']'
        : 'absolute top-0 bottom-0 w-1.5 cursor-col-resize bg-accent/20 hover:w-2 hover:bg-accent/40 before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-[\'\']'}
      style={{
        bottom: slot === 'top' ? 0 : undefined,
        top: slot === 'bottom' || slot === 'statusbar' ? 0 : undefined,
        left: slot === 'right' ? 0 : undefined,
        right: slot === 'floating' ? 0 : undefined
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setDragStart({
          pointerX: event.clientX,
          pointerY: event.clientY,
          size: state.size ?? state.width ?? state.height ?? 0
        })
      }}
    />
  )
}
