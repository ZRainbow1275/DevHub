import { useT } from '../../hooks/useT'

interface TimeCursorProps {
  cursorTs: number
  onChange: (timestamp: number) => void
  windowEnd: number
  windowStart: number
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false })
}

export function TimeCursor({ cursorTs, onChange, windowEnd, windowStart }: TimeCursorProps) {
  const { t } = useT()
  const span = Math.max(windowEnd - windowStart, 1)
  const value = Math.round(((cursorTs - windowStart) / span) * 1000)

  return (
    <div className="border border-surface-700 bg-surface-900/80 p-3 radius-md" data-testid="observability-time-cursor">
      <div className="flex items-center justify-between gap-3 text-xs text-text-muted mb-2">
        <span>{formatTime(windowStart)}</span>
        <span>{t('observability.cursor', 'Cursor {{time}}').replace('{{time}}', formatTime(cursorTs))}</span>
        <span>{formatTime(windowEnd)}</span>
      </div>
      <input
        aria-label={t('observability.timeCursor', 'Observability time cursor')}
        className="w-full"
        max={1000}
        min={0}
        onChange={(event) => {
          const next = Number(event.currentTarget.value)
          onChange(windowStart + (span * next) / 1000)
        }}
        type="range"
        value={Math.max(0, Math.min(1000, value))}
      />
    </div>
  )
}
