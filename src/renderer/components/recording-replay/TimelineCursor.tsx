interface TimelineCursorProps {
  cursorTs: number
  startedAtAbsTs: number
  endedAtAbsTs: number
  onSeek: (cursorTs: number) => void
}

export function TimelineCursor({ cursorTs, endedAtAbsTs, onSeek, startedAtAbsTs }: TimelineCursorProps) {
  return (
    <input
      aria-label="Replay timeline cursor"
      className="w-full accent-accent"
      data-testid="timeline-cursor"
      max={Math.max(startedAtAbsTs, endedAtAbsTs)}
      min={startedAtAbsTs}
      onChange={event => onSeek(Number(event.currentTarget.value))}
      step={100}
      type="range"
      value={Math.min(Math.max(cursorTs, startedAtAbsTs), endedAtAbsTs)}
    />
  )
}
