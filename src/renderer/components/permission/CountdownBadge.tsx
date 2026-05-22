import { useEffect, useMemo, useState } from 'react'
import type { PermissionExpiryStreamPayload } from '@shared/schemas/r8-runtime'

type PermissionExpiryGrant = PermissionExpiryStreamPayload['grants'][number]

interface CountdownBadgeProps {
  grant: PermissionExpiryGrant
}

export function formatPermissionRemainingMs(remainingMs: number): string {
  const boundedMs = Math.max(0, Math.floor(remainingMs))
  const totalSeconds = Math.ceil(boundedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function isPermissionExpiryCritical(remainingMs: number): boolean {
  return remainingMs < 60_000
}

export function CountdownBadge({ grant }: CountdownBadgeProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    setNowMs(Date.now())
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [grant.expiresAt, grant.grantId])

  const remainingMs = useMemo(
    () => Math.max(0, grant.expiresAt - nowMs),
    [grant.expiresAt, nowMs]
  )
  const critical = isPermissionExpiryCritical(remainingMs)

  return (
    <span
      className={`inline-flex items-center rounded-sm border-l-2 px-2 py-0.5 font-mono text-xs ${
        critical
          ? 'border-danger bg-danger/10 text-danger'
          : 'border-warning bg-warning/10 text-warning'
      }`}
      data-testid={`permission-countdown-${grant.grantId}`}
      data-expiry-critical={critical ? 'true' : 'false'}
      title={`${grant.op} expires in ${formatPermissionRemainingMs(remainingMs)}`}
    >
      {formatPermissionRemainingMs(remainingMs)}
    </span>
  )
}
