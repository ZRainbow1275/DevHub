export interface ForegroundWindowSnapshot {
  hwnd: number
  title?: string
  processId?: number
}

export type ForegroundWindowProvider = () => ForegroundWindowSnapshot | null | Promise<ForegroundWindowSnapshot | null>

export interface FocusPollingSession {
  checkNow(): Promise<boolean>
  failureReason(): string | null
  isSafe(): boolean
  stop(): void
  wait(ms: number): Promise<boolean>
}

function normalizeHwnd(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return null
  return Math.floor(value)
}

function focusMismatchError(expectedHwnd: number, actualHwnd: number): string {
  return `E_USER_STOLE_FOCUS:foreground changed from ${expectedHwnd} to ${actualHwnd}`
}

function focusUnavailableError(error?: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return message ? `E_NO_FOCUS:foreground window polling unavailable: ${message}` : 'E_NO_FOCUS:foreground window polling unavailable'
}

class NoopFocusPollingSession implements FocusPollingSession {
  checkNow(): Promise<boolean> {
    return Promise.resolve(true)
  }

  failureReason(): string | null {
    return null
  }

  isSafe(): boolean {
    return true
  }

  stop(): void {}

  wait(ms: number): Promise<boolean> {
    return new Promise(resolve => setTimeout(() => resolve(true), Math.max(0, ms)))
  }
}

class ActiveFocusPollingSession implements FocusPollingSession {
  private timer: NodeJS.Timeout | null = null
  private checking = false
  private stopped = false
  private failure: string | null = null
  private readonly failureWaiters = new Set<() => void>()

  constructor(
    private readonly provider: ForegroundWindowProvider,
    private readonly expectedHwnd: number,
    private readonly intervalMs: number
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.checkNow()
    }, this.intervalMs)
  }

  async checkNow(): Promise<boolean> {
    if (this.stopped || this.failure) return this.isSafe()
    if (this.checking) return this.isSafe()
    this.checking = true
    try {
      const snapshot = await this.provider()
      const actualHwnd = normalizeHwnd(snapshot?.hwnd)
      if (!actualHwnd) {
        this.markFailure(focusUnavailableError())
      } else if (actualHwnd !== this.expectedHwnd) {
        this.markFailure(focusMismatchError(this.expectedHwnd, actualHwnd))
      }
    } catch (error) {
      this.markFailure(focusUnavailableError(error))
    } finally {
      this.checking = false
    }
    return this.isSafe()
  }

  failureReason(): string | null {
    return this.failure
  }

  isSafe(): boolean {
    return this.failure === null
  }

  stop(): void {
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.resolveFailureWaiters()
  }

  wait(ms: number): Promise<boolean> {
    if (ms <= 0 || this.failure) return Promise.resolve(this.isSafe())

    return new Promise(resolve => {
      let timeout: NodeJS.Timeout | null = null
      const complete = (safe: boolean): void => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        this.failureWaiters.delete(onFailure)
        resolve(safe)
      }
      const onFailure = (): void => complete(false)
      this.failureWaiters.add(onFailure)
      timeout = setTimeout(() => complete(this.isSafe()), ms)
    })
  }

  private markFailure(reason: string): void {
    if (this.failure) return
    this.failure = reason
    this.stop()
  }

  private resolveFailureWaiters(): void {
    const waiters = [...this.failureWaiters]
    this.failureWaiters.clear()
    for (const waiter of waiters) waiter()
  }
}

export class FocusPollingGuard {
  private readonly intervalMs: number

  constructor(private readonly provider?: ForegroundWindowProvider, intervalMs = 50) {
    this.intervalMs = Math.max(50, Math.floor(intervalMs))
  }

  async start(expectedHwnd?: number | null): Promise<FocusPollingSession> {
    if (!this.provider) return new NoopFocusPollingSession()

    let initial: ForegroundWindowSnapshot | null = null
    try {
      initial = await this.provider()
    } catch (error) {
      const failed = new ActiveFocusPollingSession(async () => {
        throw error
      }, 1, this.intervalMs)
      await failed.checkNow()
      return failed
    }

    const requestedExpected = normalizeHwnd(expectedHwnd)
    const baseline = normalizeHwnd(initial?.hwnd)
    if (!requestedExpected && !baseline) return new NoopFocusPollingSession()
    const expected = requestedExpected ?? baseline
    if (!expected) {
      const failed = new ActiveFocusPollingSession(async () => null, 1, this.intervalMs)
      await failed.checkNow()
      return failed
    }

    const session = new ActiveFocusPollingSession(this.provider, expected, this.intervalMs)
    session.start()
    await session.checkNow()
    return session
  }
}
