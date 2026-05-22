import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CountdownBadge, formatPermissionRemainingMs, isPermissionExpiryCritical } from './CountdownBadge'

const grant = {
  grantId: '11111111-1111-4111-8111-111111111111',
  op: 'inject' as const,
  remainingMs: 65_000,
  expiresAt: Date.parse('2026-05-05T00:01:05Z')
}

describe('CountdownBadge', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats bounded permission TTL values as mm:ss', () => {
    expect(formatPermissionRemainingMs(65_000)).toBe('01:05')
    expect(formatPermissionRemainingMs(59_001)).toBe('01:00')
    expect(formatPermissionRemainingMs(0)).toBe('00:00')
    expect(formatPermissionRemainingMs(-1)).toBe('00:00')
    expect(isPermissionExpiryCritical(59_999)).toBe(true)
    expect(isPermissionExpiryCritical(60_000)).toBe(false)
  })

  it('repaints every second and turns critical below one minute', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T00:00:00Z'))

    render(<CountdownBadge grant={grant} />)

    const badge = screen.getByTestId(`permission-countdown-${grant.grantId}`)
    expect(badge).toHaveTextContent('01:05')
    expect(badge).toHaveAttribute('data-expiry-critical', 'false')

    act(() => {
      vi.advanceTimersByTime(999)
    })

    expect(badge).toHaveTextContent('01:05')
    expect(badge).toHaveAttribute('data-expiry-critical', 'false')

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(badge).toHaveTextContent('01:04')
    expect(badge).toHaveAttribute('data-expiry-critical', 'false')

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(badge).toHaveTextContent('00:59')
    expect(badge).toHaveAttribute('data-expiry-critical', 'true')
  })
})
