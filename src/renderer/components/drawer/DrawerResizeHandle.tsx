import { useEffect, useState } from 'react'
import type { DrawerSlot } from '@shared/schemas/r8-runtime'
import { useDrawer } from '../../hooks/useDrawer'

interface DrawerResizeHandleProps {
  slot: DrawerSlot
}

interface DragStart {
  pointerX: number
  pointerY: number
  size: number
}

function nextSizeForDrag(slot: DrawerSlot, dragStart: DragStart, event: PointerEvent): number {
  const deltaX = event.clientX - dragStart.pointerX
  const deltaY = event.clientY - dragStart.pointerY
  if (slot === 'right') return dragStart.size - deltaX
  if (slot === 'bottom') return dragStart.size - deltaY
  if (slot === 'floating') return dragStart.size + deltaX
  return dragStart.size + deltaY
}

export function DrawerResizeHandle({ slot }: DrawerResizeHandleProps) {
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
      aria-label={`Resize ${slot} drawer`}
      data-testid={`drawer-${slot}-resize-handle`}
      className={horizontal
        ? 'absolute left-0 right-0 h-2 cursor-row-resize bg-accent/20 hover:bg-accent/40'
        : 'absolute top-0 bottom-0 w-2 cursor-col-resize bg-accent/20 hover:bg-accent/40'}
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
