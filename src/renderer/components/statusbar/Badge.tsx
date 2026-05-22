import type { StatusBadgeType } from '@shared/schemas/r8-runtime'

const BADGE_CLASS: Record<StatusBadgeType, string> = {
  new: 'border-accent bg-accent/10 text-accent-200',
  unread: 'border-warning bg-warning/10 text-warning',
  number: 'border-steel bg-steel/10 text-steel-200',
  experimental: 'border-gold bg-gold/10 text-gold',
  warning: 'border-warning bg-warning/10 text-warning',
  error: 'border-danger bg-danger/10 text-danger'
}

interface BadgeProps {
  type: StatusBadgeType
  value: string | number
}

export function StatusBarBadge({ type, value }: BadgeProps) {
  return (
    <span
      className={`ml-1 rounded-sm border-l-2 px-1.5 py-px text-[9px] font-bold uppercase leading-none tracking-wider ${BADGE_CLASS[type]}`}
      data-testid={`status-badge-${type}`}
      data-badge-type={type}
    >
      {String(value)}
    </span>
  )
}
