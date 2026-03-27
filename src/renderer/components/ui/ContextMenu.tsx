import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  position: { x: number; y: number } | null
  onClose: () => void
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  useLayoutEffect(() => {
    if (position && menuRef.current) {
      const menu = menuRef.current
      const rect = menu.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let x = position.x
      let y = position.y

      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 8
      }
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 8
      }

      setAdjustedPosition({ x, y })
    }
  }, [position])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!position) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface-900 border-2 border-surface-600 shadow-elevated py-1.5 min-w-48 animate-fade-in"
      style={{
        left: adjustedPosition?.x ?? position.x,
        top: adjustedPosition?.y ?? position.y,
        borderRadius: '4px'
      }}
    >
      {/* Diagonal decoration */}
      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" style={{ borderRadius: '4px' }} />

      {items.map((item, index) => {
        if (item.divider) {
          return (
            <div
              key={index}
              className="border-t-2 border-surface-700 my-1.5 mx-2"
            />
          )
        }

        return (
          <button
            key={index}
            onClick={() => {
              if (!item.disabled) {
                item.onClick()
                onClose()
              }
            }}
            disabled={item.disabled}
            className={`
              w-full px-4 py-2 text-left flex items-center gap-3 text-sm transition-all duration-150 relative z-10
              border-l-2 mx-0.5
              ${item.disabled
                ? 'text-text-muted cursor-not-allowed opacity-50 border-transparent'
                : item.danger
                ? 'text-error hover:bg-error/10 hover:text-error border-transparent hover:border-error'
                : 'text-text-secondary hover:bg-surface-700 hover:text-text-primary border-transparent hover:border-accent'
              }
            `}
            style={{ borderRadius: '2px' }}
          >
            {item.icon && <span className="w-4 h-4">{item.icon}</span>}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
