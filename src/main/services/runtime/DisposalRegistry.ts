export interface DisposalRegistryEntry {
  dispose: () => Promise<void> | void
  name: string
}

export interface DisposalFailure {
  name: string
  reason: string
}

export interface DisposalReport {
  completedAt: number
  durationMs: number
  failed: DisposalFailure[]
  remainingAfter: string[]
  startedAt: number
  succeeded: string[]
  timedOut: string[]
  total: number
}

interface RegisteredDisposalEntry extends DisposalRegistryEntry {
  order: number
}

export class DisposalRegistry {
  private static sharedInstance: DisposalRegistry | null = null

  private readonly entries = new Map<string, RegisteredDisposalEntry>()
  private lastReport: DisposalReport | null = null
  private nextOrder = 0

  static getInstance(): DisposalRegistry {
    return this.sharedInstance ?? (this.sharedInstance = new DisposalRegistry())
  }

  register(entry: DisposalRegistryEntry): void {
    const existing = this.entries.get(entry.name)
    if (existing && existing.dispose !== entry.dispose) {
      console.warn(`DisposalRegistry: replacing existing "${entry.name}" cleanup entry`)
    }

    this.entries.set(entry.name, {
      ...entry,
      order: this.nextOrder++
    })
  }

  unregister(name: string): boolean {
    return this.entries.delete(name)
  }

  remaining(): string[] {
    return Array.from(this.entries.values())
      .sort((left, right) => left.order - right.order)
      .map((entry) => entry.name)
  }

  getLastReport(): DisposalReport | null {
    return this.lastReport
  }

  clear(): void {
    this.entries.clear()
    this.lastReport = null
    this.nextOrder = 0
  }

  async disposeAll(timeoutMs = 5000): Promise<DisposalReport> {
    const startedAt = Date.now()
    const succeeded: string[] = []
    const failed: DisposalFailure[] = []
    const timedOut: string[] = []
    const entries = Array.from(this.entries.values()).sort((left, right) => left.order - right.order)

    for (const entry of entries) {
      let timer: NodeJS.Timeout | null = null
      try {
        await Promise.race([
          Promise.resolve(entry.dispose()),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error(`Timed out after ${timeoutMs}ms`))
            }, timeoutMs)
            timer.unref?.()
          })
        ])
        if (timer) {
          clearTimeout(timer)
        }
        succeeded.push(entry.name)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        if (reason.includes('Timed out after')) {
          timedOut.push(entry.name)
        } else {
          failed.push({
            name: entry.name,
            reason
          })
        }
      } finally {
        if (timer) {
          clearTimeout(timer)
        }
        this.entries.delete(entry.name)
      }
    }

    const completedAt = Date.now()
    const report: DisposalReport = {
      completedAt,
      durationMs: completedAt - startedAt,
      failed,
      remainingAfter: this.remaining(),
      startedAt,
      succeeded,
      timedOut,
      total: entries.length
    }

    this.lastReport = report
    return report
  }
}

export function getDisposalRegistry(): DisposalRegistry {
  return DisposalRegistry.getInstance()
}

export function resetDisposalRegistryForTests(): void {
  DisposalRegistry.getInstance().clear()
}
