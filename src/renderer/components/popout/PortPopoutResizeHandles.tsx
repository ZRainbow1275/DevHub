import type { PortPopout, PortPopoutPosition, PortPopoutResizeDirection } from './port-popout-model'

interface PortPopoutResizeHandlesProps {
  popout: PortPopout
  onStartResize: (direction: PortPopoutResizeDirection, pointer: PortPopoutPosition) => void
}

const RESIZE_HANDLE_CLASSES: Record<PortPopoutResizeDirection, string> = {
  n: 'left-4 right-4 -top-1 h-2 cursor-n-resize',
  ne: '-right-1 -top-1 h-4 w-4 cursor-ne-resize',
  e: '-right-1 top-4 bottom-4 w-2 cursor-e-resize',
  se: '-right-1 -bottom-1 h-4 w-4 cursor-se-resize',
  s: 'left-4 right-4 -bottom-1 h-2 cursor-s-resize',
  sw: '-left-1 -bottom-1 h-4 w-4 cursor-sw-resize',
  w: '-left-1 top-4 bottom-4 w-2 cursor-w-resize',
  nw: '-left-1 -top-1 h-4 w-4 cursor-nw-resize',
}

const RESIZE_DIRECTIONS: readonly PortPopoutResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

export function PortPopoutResizeHandles({ popout, onStartResize }: PortPopoutResizeHandlesProps) {
  return (
    <>
      {RESIZE_DIRECTIONS.map((direction) => (
        <button
          key={direction}
          type="button"
          aria-label={`Resize port popout ${direction}`}
          data-testid={`port-popout-resize-${direction}-${popout.port.port}-${popout.port.pid}`}
          className={`absolute bg-transparent ${RESIZE_HANDLE_CLASSES[direction]}`}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onStartResize(direction, { x: event.clientX, y: event.clientY })
          }}
        />
      ))}
    </>
  )
}
