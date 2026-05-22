export interface ReplayClockSnapshot {
  cursorTs: number
  speed: number
  paused: boolean
}

type ReplayClockListener = (snapshot: ReplayClockSnapshot) => void

export class ReplayClock {
  private frameId: number | null = null
  private lastFrameAt: number | null = null
  private snapshot: ReplayClockSnapshot
  private readonly listeners = new Set<ReplayClockListener>()

  constructor(private readonly bounds: { startedAtAbsTs: number; endedAtAbsTs: number }, initial: ReplayClockSnapshot) {
    this.snapshot = { ...initial, cursorTs: this.clamp(initial.cursorTs) }
  }

  subscribe(listener: ReplayClockListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => this.listeners.delete(listener)
  }

  play(): void {
    this.update({ paused: false })
    this.lastFrameAt = null
    this.schedule()
  }

  pause(): void {
    this.update({ paused: true })
    this.cancel()
  }

  seek(cursorTs: number): void {
    this.update({ cursorTs: this.clamp(cursorTs) })
    this.lastFrameAt = null
  }

  setSpeed(speed: number): void {
    this.update({ speed })
    this.lastFrameAt = null
  }

  dispose(): void {
    this.cancel()
    this.listeners.clear()
  }

  private tick = (frameAt: number): void => {
    if (this.snapshot.paused) return
    const delta = this.lastFrameAt === null ? 0 : frameAt - this.lastFrameAt
    this.lastFrameAt = frameAt
    const nextCursor = this.clamp(this.snapshot.cursorTs + delta * this.snapshot.speed)
    const reachedEnd = nextCursor >= this.bounds.endedAtAbsTs
    this.update({ cursorTs: nextCursor, paused: reachedEnd })
    if (!reachedEnd) this.schedule()
  }

  private schedule(): void {
    this.cancel()
    if (typeof window !== 'undefined') this.frameId = window.requestAnimationFrame(this.tick)
  }

  private cancel(): void {
    if (this.frameId !== null && typeof window !== 'undefined') window.cancelAnimationFrame(this.frameId)
    this.frameId = null
  }

  private update(patch: Partial<ReplayClockSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }

  private clamp(value: number): number {
    return Math.min(Math.max(Math.trunc(value), this.bounds.startedAtAbsTs), this.bounds.endedAtAbsTs)
  }
}
