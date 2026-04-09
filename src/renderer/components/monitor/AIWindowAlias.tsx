import { useState, useCallback } from 'react'
import { AITask, AIWindowAlias as AIWindowAliasType } from '@shared/types-extended'

const ALIAS_COLORS = [
  { name: 'red', value: '#ef4444' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'green', value: '#22c55e' },
  { name: 'purple', value: '#a855f7' },
  { name: 'orange', value: '#f97316' }
] as const

interface AIWindowAliasProps {
  task: AITask
  onSave: (alias: AIWindowAliasType) => void
  onCancel: () => void
  existingAlias?: AIWindowAliasType
}

export function AIWindowAliasEditor({ task, onSave, onCancel, existingAlias }: AIWindowAliasProps) {
  const [aliasName, setAliasName] = useState(existingAlias?.alias ?? '')
  const [selectedColor, setSelectedColor] = useState(existingAlias?.color ?? ALIAS_COLORS[1].value)

  const handleSave = useCallback(() => {
    const trimmed = aliasName.trim()
    if (!trimmed) return

    const alias: AIWindowAliasType = {
      id: existingAlias?.id ?? `alias_${Date.now()}`,
      alias: trimmed,
      matchCriteria: {
        pid: task.pid,
        toolType: task.toolType,
        workingDir: undefined, // filled from process info on backend
        commandHash: undefined,
        titlePrefix: task.status.currentAction?.slice(0, 20)
      },
      createdAt: existingAlias?.createdAt ?? Date.now(),
      lastMatchedAt: Date.now(),
      color: selectedColor
    }

    onSave(alias)
  }, [aliasName, selectedColor, task, existingAlias, onSave])

  return (
    <div className="mt-2 p-3 bg-surface-900 rounded-lg border border-surface-600">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={aliasName}
          onChange={(e) => setAliasName(e.target.value)}
          placeholder="输入别名..."
          maxLength={100}
          className="flex-1 px-3 py-1.5 text-sm bg-surface-800 border border-surface-600 rounded
                     text-text-primary placeholder-text-tertiary
                     focus:outline-none focus:border-accent/50"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <button
          onClick={handleSave}
          disabled={!aliasName.trim()}
          className="px-3 py-1.5 text-xs font-medium bg-accent/20 text-accent-300
                     hover:bg-accent/30 rounded transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          确认
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          取消
        </button>
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-text-muted">颜色:</span>
        {ALIAS_COLORS.map((color) => (
          <button
            key={color.name}
            onClick={() => setSelectedColor(color.value)}
            className={`w-5 h-5 rounded-full transition-all ${
              selectedColor === color.value
                ? 'ring-2 ring-offset-1 ring-offset-surface-900 ring-white/50 scale-110'
                : 'hover:scale-110'
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>
    </div>
  )
}
