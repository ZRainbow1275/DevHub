const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const

interface SpeedControlProps {
  paused: boolean
  speed: number
  onPause: () => void
  onPlay: () => void
  onSpeedChange: (speed: number) => void
}

export function SpeedControl({ onPause, onPlay, onSpeedChange, paused, speed }: SpeedControlProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-secondary" data-testid="replay-play-toggle" onClick={paused ? onPlay : onPause} type="button">
        {paused ? '播放' : '暂停'}
      </button>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Replay speed">
        {SPEEDS.map(value => (
          <button
            className={value === speed ? 'btn-primary' : 'btn-secondary'}
            data-testid={`replay-speed-${value}`}
            key={value}
            onClick={() => onSpeedChange(value)}
            type="button"
          >
            {value}x
          </button>
        ))}
      </div>
    </div>
  )
}
