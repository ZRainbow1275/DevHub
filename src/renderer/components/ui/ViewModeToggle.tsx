import { memo, type ReactNode } from 'react'

interface ViewMode {
  key: string
  icon: ReactNode
  label: string
}

interface ViewModeToggleProps {
  modes: ViewMode[]
  current: string
  onChange: (mode: string) => void
}

export const ViewModeToggle = memo(function ViewModeToggle({
  modes,
  current,
  onChange
}: ViewModeToggleProps) {
  return (
    <div
      className="flex items-center bg-surface-800 p-1 border border-surface-700"
      style={{ borderRadius: '2px' }}
    >
      {modes.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`
            p-2 transition-all duration-200
            ${current === key
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-700'
            }
          `}
          style={{ borderRadius: '2px' }}
          title={label}
          aria-pressed={current === key}
        >
          {icon}
        </button>
      ))}
    </div>
  )
})
