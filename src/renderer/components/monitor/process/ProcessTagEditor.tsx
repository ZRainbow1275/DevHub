import { useEffect, useState } from 'react'
import type { ProcessInfo } from '@shared/types-extended'
import type { ProcessTag, ProcessTagColor } from '@shared/schemas/r8-runtime'
import { PROCESS_TAG_COLOR_VALUES } from '@shared/process-tags-history'
import { CheckIcon, CloseIcon, TagIcon } from '../../icons'
import { processTagColorValue } from './ProcessTagBadge'

export function ProcessTagEditor({
  process,
  tag,
  saving,
  onSave,
  onRemove,
  onClose,
}: {
  process: ProcessInfo
  tag?: ProcessTag
  saving?: boolean
  onSave: (tag: string, color: ProcessTagColor, pinned: boolean) => Promise<void>
  onRemove: () => Promise<void>
  onClose: () => void
}) {
  const [label, setLabel] = useState(tag?.tag ?? '')
  const [color, setColor] = useState<ProcessTagColor>(tag?.color ?? 'accent')
  const [pinned, setPinned] = useState(tag?.pinned ?? false)

  useEffect(() => {
    setLabel(tag?.tag ?? '')
    setColor(tag?.color ?? 'accent')
    setPinned(tag?.pinned ?? false)
  }, [tag])

  const trimmed = label.trim()

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40"
      data-testid="process-tag-editor"
      onClick={(event) => {
        event.stopPropagation()
        onClose()
      }}
    >
      <form
        className="w-[420px] border-2 border-surface-700 bg-surface-900 p-4 shadow-xl radius-md"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (!trimmed) return
          onSave(trimmed, color, pinned).catch(() => undefined)
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
              <TagIcon size={16} className="text-accent" />
              编辑进程标签
            </div>
            <div className="mt-1 truncate text-[11px] text-text-muted">{process.name} / {process.workingDir ?? 'cwd unknown'}</div>
          </div>
          <button className="btn-icon-sm text-text-muted hover:text-text-primary" onClick={onClose} type="button">
            <CloseIcon size={14} />
          </button>
        </div>

        <label className="mb-2 block text-[10px] uppercase tracking-wider text-text-muted" htmlFor="process-tag-input">
          标签
        </label>
        <input
          autoFocus
          className="mb-4 w-full border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent radius-sm"
          id="process-tag-input"
          maxLength={64}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="例如 devhub-main"
          value={label}
        />

        <div className="mb-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">颜色</div>
          <div className="grid grid-cols-7 gap-2">
            {PROCESS_TAG_COLOR_VALUES.map(item => {
              const selected = item === color
              return (
                <button
                  aria-label={`选择 ${item}`}
                  className={`h-8 border-2 ${selected ? 'border-text-primary' : 'border-surface-700'} radius-sm`}
                  key={item}
                  onClick={() => setColor(item)}
                  style={{ backgroundColor: processTagColorValue(item) }}
                  type="button"
                />
              )
            })}
          </div>
        </div>

        <label className="mb-4 flex items-center gap-2 text-xs text-text-secondary">
          <input checked={pinned} onChange={(event) => setPinned(event.target.checked)} type="checkbox" />
          加入收藏关联
        </label>

        <div className="flex items-center justify-between gap-2 border-t border-surface-700 pt-3">
          <button
            className="btn-secondary px-3 py-2 text-xs"
            disabled={!tag || saving}
            onClick={() => onRemove().catch(() => undefined)}
            type="button"
          >
            移除
          </button>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-3 py-2 text-xs" onClick={onClose} type="button">取消</button>
            <button className="btn-primary flex items-center gap-1 px-3 py-2 text-xs" disabled={!trimmed || saving} type="submit">
              <CheckIcon size={13} />
              保存
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
