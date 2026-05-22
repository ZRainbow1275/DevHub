import type { ComponentType } from 'react'
import type { StatusTile } from '@shared/schemas/r8-runtime'
import {
  AIIcon,
  BellIcon,
  FolderIcon,
  GlobeIcon,
  LightningIcon,
  MonitorIcon,
  NetworkIcon,
  PaletteIcon,
  PortIcon,
  ProcessIcon,
  SearchIcon,
  WindowIcon
} from '../icons'
import { StatusBarBadge } from './Badge'

interface IconProps {
  className?: string
  size?: number
}

const ICONS: Record<string, ComponentType<IconProps>> = {
  AIIcon,
  BellIcon,
  FolderIcon,
  GlobeIcon,
  LightningIcon,
  MonitorIcon,
  NetworkIcon,
  PaletteIcon,
  PortIcon,
  ProcessIcon,
  SearchIcon,
  WindowIcon
}

const TONE_CLASS: Record<StatusTile['tone'], string> = {
  neutral: 'border-surface-600 text-text-secondary hover:bg-surface-800',
  success: 'border-success text-success hover:bg-success/10',
  warning: 'border-warning text-warning hover:bg-warning/10',
  danger: 'border-danger text-danger hover:bg-danger/10',
  accent: 'border-accent text-accent-300 hover:bg-accent/10'
}

interface StatusBarSlotProps {
  tile: StatusTile
  onAction: (tile: StatusTile) => void
}

export function StatusBarSlot({ tile, onAction }: StatusBarSlotProps) {
  const Icon = tile.iconToken ? ICONS[tile.iconToken] : undefined
  const content = (
    <>
      {Icon && <Icon size={12} className="shrink-0" />}
      <span className="uppercase tracking-wider text-text-muted">{tile.label}</span>
      <span className="font-mono tabular-nums text-text-primary">{String(tile.value)}</span>
      {tile.badgeType && tile.badgeValue !== undefined && (
        <StatusBarBadge type={tile.badgeType} value={tile.badgeValue} />
      )}
    </>
  )

  const className = `flex h-[22px] items-center gap-1.5 border-l-2 bg-surface-900/70 px-2 text-[10px] transition-colors radius-sm ${TONE_CLASS[tile.tone]}`

  if (!tile.clickAction) {
    return (
      <div
        className={className}
        title={tile.tooltip}
        data-testid={`status-tile-${tile.id}`}
        data-status-tile-id={tile.id}
        data-status-badge-type={tile.badgeType ?? 'none'}
        data-status-value={String(tile.value)}
        data-status-badge-value={tile.badgeValue === undefined ? '' : String(tile.badgeValue)}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={className}
      title={tile.tooltip}
      onClick={() => onAction(tile)}
      data-testid={`status-tile-${tile.id}`}
      data-status-tile-id={tile.id}
      data-status-badge-type={tile.badgeType ?? 'none'}
      data-status-value={String(tile.value)}
      data-status-badge-value={tile.badgeValue === undefined ? '' : String(tile.badgeValue)}
    >
      {content}
    </button>
  )
}
