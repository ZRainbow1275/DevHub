import { useState, useCallback, useRef, useEffect } from 'react'
import { AITask, AIWindowAlias as AIWindowAliasType, ALIAS_MAX_LENGTH, ALIAS_FORBIDDEN_CHARS } from '@shared/types-extended'
import { GearIcon, TrashIcon, CheckIcon, CloseIcon } from '../icons'
import { useAliasStore } from '../../stores/aliasStore'

interface AIWindowAliasBadgeProps {
  /** Display name already resolved (alias > autoName > processName) */
  displayName: string
  /** True if this name is a user-set alias (not autoName or processName) */
  hasAlias: boolean
  task: AITask | undefined
  hwnd: number
  workingDir?: string
  windowTitle: string
  onRename: (newName: string) => void
}

/**
 * Inline alias editor badge for AI window cards.
 * Shows current alias, pencil icon to edit, trash icon to clear.
 * Enter to save, Esc to cancel.
 */
export function AIWindowAliasBadge({
  displayName,
  hasAlias,
  task,
  hwnd: _hwnd,
  workingDir,
  windowTitle,
  onRename,
}: AIWindowAliasBadgeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(displayName)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { aliases, deleteAlias } = useAliasStore()

  const autoSuggest = workingDir
    ? workingDir.split(/[\\/]/).filter(Boolean).at(-1) ?? ''
    : ''

  const handleStartEdit = useCallback(() => {
    setEditValue(displayName)
    setValidationError(null)
    setIsEditing(true)
  }, [displayName])

  const handleConfirm = useCallback(() => {
    const trimmed = editValue.trim()
    if (!trimmed) {
      setValidationError('别名不能为空')
      return
    }
    if (trimmed.length > ALIAS_MAX_LENGTH) {
      setValidationError(`别名不能超过 ${ALIAS_MAX_LENGTH} 个字符`)
      return
    }
    if (ALIAS_FORBIDDEN_CHARS.test(trimmed)) {
      setValidationError('别名包含非法字符')
      return
    }
    setIsEditing(false)
    setValidationError(null)
    onRename(trimmed)
  }, [editValue, onRename])

  const handleCancel = useCallback(() => {
    setEditValue(displayName)
    setValidationError(null)
    setIsEditing(false)
  }, [displayName])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        inputRef.current?.select()
      }, 30)
    }
  }, [isEditing])

  // Find existing alias id for this window (to support delete)
  const existingAlias =
    (task && aliases.find(a =>
      a.matchCriteria.toolType === task.toolType &&
      a.matchCriteria.workingDir &&
      a.matchCriteria.workingDir === task.projectId
    )) ||
    aliases.find(a =>
      a.matchCriteria.titlePrefix && windowTitle.startsWith(a.matchCriteria.titlePrefix)
    ) ||
    aliases.find(a => task && a.matchCriteria.pid === task.pid)

  const handleClearAlias = useCallback(async () => {
    if (!existingAlias) return
    await deleteAlias(existingAlias.id)
  }, [existingAlias, deleteAlias])

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              setValidationError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleConfirm() }
              if (e.key === 'Escape') { e.preventDefault(); handleCancel() }
            }}
            maxLength={ALIAS_MAX_LENGTH}
            placeholder={autoSuggest || '输入别名...'}
            className="flex-1 text-sm font-semibold bg-surface-800 border border-accent/50 px-2 py-0.5 text-text-primary focus:outline-none focus:border-accent radius-sm min-w-0"
            style={{ minWidth: '100px' }}
          />
          <button
            onClick={handleConfirm}
            className="p-1 bg-success/20 hover:bg-success text-success hover:text-white transition-colors radius-sm flex-shrink-0"
            title="确认 (Enter)"
          >
            <CheckIcon size={12} />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 bg-surface-700 hover:bg-surface-600 text-text-muted hover:text-text-primary transition-colors radius-sm flex-shrink-0"
            title="取消 (Esc)"
          >
            <CloseIcon size={12} />
          </button>
        </div>
        {validationError && (
          <span className="text-[10px] text-error">{validationError}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0 group/alias flex-1">
      <span
        className="text-sm font-semibold text-text-primary truncate cursor-text"
        title={hasAlias ? `别名: ${displayName} (双击重命名)` : '双击重命名'}
        onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit() }}
      >
        {displayName}
      </span>
      {hasAlias && (
        <span className="text-[9px] px-1 py-0.5 bg-blue-500/15 text-blue-400 border-l-2 border-blue-500 radius-sm flex-shrink-0 font-mono">
          别名
        </span>
      )}
      {/* Pencil (edit) button - shows on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); handleStartEdit() }}
        className="opacity-0 group-hover/alias:opacity-100 p-0.5 hover:bg-surface-700 transition-all radius-sm flex-shrink-0"
        title="编辑别名"
      >
        <GearIcon size={11} className="text-text-muted" />
      </button>
      {/* Clear alias button - only when alias exists */}
      {hasAlias && existingAlias && (
        <button
          onClick={(e) => { e.stopPropagation(); handleClearAlias() }}
          className="opacity-0 group-hover/alias:opacity-100 p-0.5 hover:bg-error/20 text-text-muted hover:text-error transition-all radius-sm flex-shrink-0"
          title="清除别名"
        >
          <TrashIcon size={10} />
        </button>
      )}
    </div>
  )
}

// ============ Legacy popup editor (kept for compatibility) ============

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
        workingDir: undefined,
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
    <div className="mt-2 p-3 bg-surface-900 border-l-2 border-accent/30 radius-sm">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={aliasName}
          onChange={(e) => setAliasName(e.target.value)}
          placeholder="输入别名..."
          maxLength={ALIAS_MAX_LENGTH}
          className="flex-1 px-3 py-1.5 text-sm bg-surface-800 border border-surface-600 radius-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <button
          onClick={handleSave}
          disabled={!aliasName.trim()}
          className="px-3 py-1.5 text-xs font-medium bg-accent/20 text-accent hover:bg-accent/30 radius-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            className={`w-5 h-5 transition-all ${
              selectedColor === color.value
                ? 'ring-2 ring-offset-1 ring-offset-surface-900 ring-white/50 scale-110'
                : 'hover:scale-110'
            }`}
            style={{ backgroundColor: color.value, borderRadius: '50%' }}
            title={color.name}
          />
        ))}
      </div>
    </div>
  )
}
