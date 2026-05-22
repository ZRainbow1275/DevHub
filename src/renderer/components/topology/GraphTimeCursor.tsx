interface GraphTimeCursorProps {
  value: number | null
  onChange: (value: number | null) => void
}

function toLocalDatetime(value: number | null): string {
  if (value === null) return ''
  const date = new Date(value)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function GraphTimeCursor({ value, onChange }: GraphTimeCursorProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-text-muted">
      时间游标
      <input
        data-testid="graph-time-cursor"
        className="input-sm bg-surface-900 text-text-primary"
        type="datetime-local"
        value={toLocalDatetime(value)}
        onChange={event => onChange(event.target.value ? new Date(event.target.value).getTime() : null)}
      />
      {value !== null && (
        <button type="button" className="btn-secondary px-2 py-1 text-[10px]" onClick={() => onChange(null)}>当前</button>
      )}
    </label>
  )
}
