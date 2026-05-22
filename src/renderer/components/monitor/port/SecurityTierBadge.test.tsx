import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SecurityTierLevel, SecurityTierTone } from '@shared/port-security'
import { SecurityTierBadge } from './SecurityTierBadge'

interface SecurityTierCase {
  tier: SecurityTierLevel
  tone: SecurityTierTone
  label: string
  classNames: string[]
}

const SECURITY_TIER_CASES: SecurityTierCase[] = [
  {
    tier: 'Local',
    tone: 'success',
    label: '本机',
    classNames: ['bg-success/10', 'text-success', 'border-success/60']
  },
  {
    tier: 'LAN',
    tone: 'warning',
    label: '局域网',
    classNames: ['bg-warning/10', 'text-warning', 'border-warning/60']
  },
  {
    tier: 'WAN-Capable',
    tone: 'orange',
    label: '公网可达',
    classNames: ['bg-orange-500/10', 'text-orange-400', 'border-orange-500/70']
  },
  {
    tier: 'Suspicious',
    tone: 'error',
    label: '可疑端口',
    classNames: ['bg-error/10', 'text-error', 'border-error']
  }
]

describe('SecurityTierBadge visual coding', () => {
  it.each(SECURITY_TIER_CASES)('exposes a distinct visual tone for $tier', ({ tier, tone, label, classNames }) => {
    render(<SecurityTierBadge tier={tier} />)

    const badge = screen.getByTestId(`security-tier-${tier}`)
    expect(badge).toHaveAttribute('data-security-tier', tier)
    expect(badge).toHaveAttribute('data-security-tone', tone)
    expect(badge).toHaveAttribute('data-security-label', label)
    expect(badge).toHaveAttribute('aria-label', `${label} / ${tier}`)
    expect(badge).toHaveTextContent(tier)
    expect(badge).toHaveClass(...classNames)
  })
})
