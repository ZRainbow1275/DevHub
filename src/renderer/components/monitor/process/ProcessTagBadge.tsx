import type { ProcessTag, ProcessTagColor } from '@shared/schemas/r8-runtime'
import { TagIcon } from '../../icons'

const TAG_COLOR_VAR: Record<ProcessTagColor, string> = {
  accent: 'var(--accent)',
  info: 'var(--info)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  gold: 'var(--gold)',
  steel: 'var(--steel)',
  error: 'var(--error)',
}

export function processTagColorValue(color: ProcessTagColor | undefined): string {
  return TAG_COLOR_VAR[color ?? 'accent']
}

export function ProcessTagBadge({
  tag,
  showEmpty = false,
  compact = false,
  onClick,
}: {
  tag?: ProcessTag
  showEmpty?: boolean
  compact?: boolean
  onClick?: () => void
}) {
  if (!tag && !showEmpty) return null

  const color = processTagColorValue(tag?.color)
  const label = tag?.tag ?? '添加标签'

  return (
    <button
      className={`inline-flex max-w-[160px] items-center gap-1 border-l-2 px-1.5 py-0.5 text-[10px] font-semibold ${tag ? 'text-text-primary' : 'text-text-muted'} radius-sm ${compact ? 'h-5' : ''}`}
      data-testid={tag ? `process-tag-${tag.key}` : 'process-tag-empty'}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        borderColor: color,
      }}
      title={label}
      type="button"
    >
      <TagIcon size={compact ? 10 : 12} />
      <span className="truncate">{label}</span>
    </button>
  )
}
