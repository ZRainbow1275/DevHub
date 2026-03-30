import { useCallback, useRef } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const startXRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startXRef.current
      startXRef.current = ev.clientX
      onResize(delta)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [onResize])

  return (
    <div
      className="w-1 cursor-col-resize hover:bg-accent/30 transition-colors flex-shrink-0"
      onMouseDown={handleMouseDown}
    />
  )
}
