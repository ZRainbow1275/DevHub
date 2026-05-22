import type { ComponentType } from 'react'
import type { SecurityTierClassification, SecurityTierLevel } from '@shared/port-security'
import { SECURITY_TIER_VISUAL } from '@shared/port-security'
import { AlertIcon, CheckIcon, GlobeIcon, NetworkIcon, type IconProps } from '../../icons'

type SecurityTierBadgeSize = 'sm' | 'md'

interface SecurityTierBadgeProps {
  tier: SecurityTierLevel | SecurityTierClassification
  size?: SecurityTierBadgeSize
  showLabel?: boolean
  className?: string
}

const TIER_CLASS: Record<SecurityTierLevel, string> = {
  Local: 'bg-success/10 text-success border-success/60',
  LAN: 'bg-warning/10 text-warning border-warning/60',
  'WAN-Capable': 'bg-orange-500/10 text-orange-400 border-orange-500/70',
  Suspicious: 'bg-error/10 text-error border-error'
}

const TIER_ICON: Record<SecurityTierLevel, ComponentType<IconProps>> = {
  Local: CheckIcon,
  LAN: NetworkIcon,
  'WAN-Capable': GlobeIcon,
  Suspicious: AlertIcon
}

function normalizeTier(input: SecurityTierLevel | SecurityTierClassification): SecurityTierLevel {
  return typeof input === 'string' ? input : input.tier
}

export function SecurityTierBadge({ tier, size = 'sm', showLabel = true, className = '' }: SecurityTierBadgeProps) {
  const normalizedTier = normalizeTier(tier)
  const visual = SECURITY_TIER_VISUAL[normalizedTier]
  const Icon = TIER_ICON[normalizedTier]
  const iconSize = size === 'md' ? 14 : 11
  const padding = size === 'md' ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[9px]'

  return (
    <span
      data-testid={`security-tier-${normalizedTier}`}
      data-security-tier={normalizedTier}
      data-security-tone={visual.tone}
      data-security-label={visual.label}
      className={`inline-flex items-center gap-1 border-l-2 font-bold uppercase tracking-wider radius-sm ${padding} ${TIER_CLASS[normalizedTier]} ${className}`}
      aria-label={`${visual.label} / ${normalizedTier}`}
      title={`${visual.label} / ${normalizedTier}`}
    >
      <Icon size={iconSize} />
      {showLabel && <span>{normalizedTier}</span>}
    </span>
  )
}
