import { useState, useRef, useEffect } from 'react'

interface ScriptSelectorProps {
  scripts: string[]
  defaultScript: string
  onSelect: (script: string) => void
  disabled?: boolean
}

export function ScriptSelector({ scripts, defaultScript, onSelect, disabled }: ScriptSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (scripts.length <= 1) {
    return (
      <button
        onClick={() => onSelect(defaultScript)}
        disabled={disabled}
        className="btn-icon text-text-muted hover:text-success disabled:opacity-50"
        title={`启动 (${defaultScript})`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="btn-icon text-text-muted hover:text-success disabled:opacity-50 flex items-center gap-1"
        title="选择脚本"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 bg-surface-900 border-2 border-surface-600 shadow-elevated py-1.5 min-w-32 z-50 animate-fade-in radius-md"
        >
          {scripts.map(script => (
            <button
              key={script}
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
        </div>
      )}
    </div>
  )
}
