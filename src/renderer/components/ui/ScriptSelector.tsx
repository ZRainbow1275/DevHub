import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, PlayIcon } from '../icons'

interface ScriptSelectorProps {
  scripts: string[]
  defaultScript: string
  onSelect: (script: string) => void
  disabled?: boolean
}

export function ScriptSelector({ scripts, defaultScript, onSelect, disabled }: ScriptSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ left: number; top: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setMenuStyle(null)
      return
    }

    const updateMenuPosition = () => {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      const minWidth = 160
      const width = Math.max(minWidth, rect.width + 32)
      const left = Math.min(
        Math.max(8, rect.right - width),
        Math.max(8, window.innerWidth - width - 8)
      )

      setMenuStyle({
        left,
        top: Math.min(rect.bottom + 4, window.innerHeight - 8),
        width
      })
    }

    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen])

  if (scripts.length <= 1) {
    return (
      <button
        onClick={() => onSelect(defaultScript)}
        disabled={disabled}
        className="btn-icon text-text-muted hover:text-success disabled:opacity-50"
        title={`启动 (${defaultScript})`}
      >
        <PlayIcon size={16} />
      </button>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="btn-icon text-text-muted hover:text-success disabled:opacity-50 flex items-center gap-1"
        title="选择脚本"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-testid="script-selector-trigger"
      >
        <PlayIcon size={16} />
        <ChevronDownIcon size={12} />
      </button>

      {isOpen && menuStyle && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-surface-900 border-2 border-surface-600 shadow-elevated py-1.5 animate-fade-in radius-md"
          role="menu"
          data-testid="script-selector-menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setIsOpen(false)
              buttonRef.current?.focus()
            }
          }}
          style={{
            left: `${menuStyle.left}px`,
            top: `${menuStyle.top}px`,
            width: `${menuStyle.width}px`,
            zIndex: 'var(--z-tier-toolbar, 1000)'
          }}
        >
          {scripts.map(script => (
            <button
              key={script}
              role="menuitem"
              data-testid="script-selector-option"
              onClick={() => {
                onSelect(script)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-2 text-left text-sm transition-all duration-150 flex items-center gap-2 ${
                script === defaultScript
                  ? 'text-accent bg-surface-800'
                  : 'text-text-secondary hover:bg-surface-700 hover:text-text-primary'
              }`}
            >
              <span className="font-mono">{script}</span>
              {script === defaultScript && (
                <span className="text-[10px] text-text-muted">(默认)</span>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
