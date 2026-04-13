import { memo } from 'react'
import { PROJECT_TYPE_LABELS, PROJECT_TYPE_COLORS, type ProjectType } from '@shared/types'

interface ProjectTypeBadgeProps {
  type: ProjectType
  size?: 'sm' | 'md'
}

/**
 * A colored badge displaying the project type label.
 * Uses the project type's brand color with a transparent background.
 */
export const ProjectTypeBadge = memo(function ProjectTypeBadge({
  type,
  size = 'sm'
}: ProjectTypeBadgeProps) {
  if (!type || type === 'unknown') return null

  const label = PROJECT_TYPE_LABELS[type] || type
  const color = PROJECT_TYPE_COLORS[type] || '#6B7280'

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-0.5'

  return (
    <span
      className={`${sizeClasses} font-medium flex-shrink-0 border-l-2`}
      style={{
        borderRadius: '2px',
        color,
        backgroundColor: `${color}15`,
        borderLeftColor: color,
      }}
    >
      {label}
    </span>
  )
})
