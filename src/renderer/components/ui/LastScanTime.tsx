import { memo } from 'react'

interface LastScanTimeProps {
  lastScanTime: Date | null
  label?: string
}

export const LastScanTime = memo(function LastScanTime({
  lastScanTime,
  label = '更新于'
}: LastScanTimeProps) {
  if (!lastScanTime) return null

  return (
    <span className="text-xs text-text-muted">
      {label} {lastScanTime.toLocaleTimeString()}
    </span>
  )
})
