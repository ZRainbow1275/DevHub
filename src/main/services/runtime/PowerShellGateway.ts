import { execFile, ChildProcess } from 'child_process'
import kill from 'tree-kill'

export interface PowerShellGatewayStats {
  activeCount: number
  queuedCount: number
  completedCount: number
  failedCount: number
  timedOutCount: number
  abortedCount: number
  maxObservedQueue: number
  lastDurationMs: number
  runningPids: number[]
}

export interface PowerShellExecuteOptions<T = string> {
  encoding?: BufferEncoding
  executionPolicyBypass?: boolean
  killOnTimeout?: boolean
  label?: string
  maxBuffer?: number
  nonInteractive?: boolean
  parser?: (stdout: string) => T
  timeoutMs?: number
  windowsHide?: boolean
}

interface QueueItem<T> {
  label: string
  run: () => Promise<T>
  reject: (error: Error) => void
  resolve: (value: T) => void
}

export class PowerShellGatewayTimeoutError extends Error {
  readonly code = 'POWERSHELL_TIMEOUT'

  constructor(readonly timeoutMs: number, readonly label?: string) {
    super(label
      ? `PowerShell command timed out after ${timeoutMs}ms (${label})`
      : `PowerShell command timed out after ${timeoutMs}ms`)
    this.name = 'PowerShellGatewayTimeoutError'
  }
}

export class PowerShellGatewayQueueFullError extends Error {
  readonly code = 'POWERSHELL_QUEUE_FULL'

  constructor(readonly maxQueue: number, readonly label?: string) {
    super(label
      ? `PowerShell queue is full (max ${maxQueue}) while scheduling ${label}`
      : `PowerShell queue is full (max ${maxQueue})`)
    this.name = 'PowerShellGatewayQueueFullError'
  }
}

export class PowerShellGateway {
  private readonly activeChildren = new Map<number, ChildProcess>()
  private readonly activeControllers = new Map<number, AbortController>()
  private activeCount = 0
  private readonly binary: string
  private readonly concurrency: number
  private readonly defaultTimeoutMs: number
  private readonly maxQueue: number
  private readonly queue: Array<QueueItem<unknown>> = []
  private shuttingDown = false
  private readonly stats: PowerShellGatewayStats = {
    activeCount: 0,
    queuedCount: 0,
    completedCount: 0,
    failedCount: 0,
    timedOutCount: 0,
    abortedCount: 0,
    maxObservedQueue: 0,
    lastDurationMs: 0,
    runningPids: []
  }

  constructor(options?: {
    binary?: string
    concurrency?: number
    defaultTimeoutMs?: number
    maxQueue?: number
  }) {
    this.binary = options?.binary ?? 'powershell.exe'
    this.concurrency = options?.concurrency ?? 2
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 3000
    this.maxQueue = options?.maxQueue ?? 16
  }

  async execute<T = string>(
    script: string,
    options?: PowerShellExecuteOptions<T>
  ): Promise<T> {
    if (this.shuttingDown) {
      throw new Error('PowerShell gateway is shutting down')
    }

    const label = options?.label ?? 'powershell'
    if (this.activeCount >= this.concurrency && this.queue.length >= this.maxQueue) {
      throw new PowerShellGatewayQueueFullError(this.maxQueue, label)
    }

    return new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = {
        label,
        resolve,
        reject,
        run: () => this.run(script, options)
      }

      if (this.activeCount < this.concurrency) {
        void this.startItem(item)
        return
      }

      this.queue.push(item as QueueItem<unknown>)
      this.stats.queuedCount = this.queue.length
      this.stats.maxObservedQueue = Math.max(this.stats.maxObservedQueue, this.queue.length)
    })
  }

  getStats(): PowerShellGatewayStats {
    return {
      ...this.stats,
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      runningPids: Array.from(this.activeChildren.keys())
    }
  }

  async shutdown(): Promise<number> {
    this.shuttingDown = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()
      item?.reject(new Error('PowerShell gateway shut down before task started'))
    }
    this.stats.queuedCount = 0

    const pids = Array.from(this.activeChildren.keys())
    for (const pid of pids) {
      this.activeControllers.get(pid)?.abort()
    }
    await Promise.all(pids.map((pid) => this.killProcessTree(pid)))
    this.activeChildren.clear()
    this.activeControllers.clear()
    this.activeCount = 0
    this.stats.activeCount = 0
    this.stats.runningPids = []
    return pids.length
  }

  private async startItem<T>(item: QueueItem<T>): Promise<void> {
    this.activeCount += 1
    this.stats.activeCount = this.activeCount

    try {
      const result = await item.run()
      item.resolve(result)
    } catch (error) {
      item.reject(error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.activeCount = Math.max(0, this.activeCount - 1)
      this.stats.activeCount = this.activeCount
      this.dequeue()
    }
  }

  private dequeue(): void {
    if (this.shuttingDown) return
    if (this.activeCount >= this.concurrency) return

    const next = this.queue.shift()
    this.stats.queuedCount = this.queue.length
    if (next) {
      void this.startItem(next)
    }
  }

  private async run<T>(
    script: string,
    options?: PowerShellExecuteOptions<T>
  ): Promise<T> {
    const startedAt = Date.now()
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs
    const controller = new AbortController()
    let timedOut = false
    let childRef: ChildProcess | null = null
    let childPid: number | null = null
    let timeoutHandle: NodeJS.Timeout | null = null

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true
        controller.abort()
        if (options?.killOnTimeout !== false && childPid) {
          void this.killProcessTree(childPid)
        }
      }, timeoutMs)
      timeoutHandle.unref?.()
    }

    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        const args = [
          '-NoProfile',
          ...(options?.nonInteractive === false ? [] : ['-NonInteractive']),
          ...(options?.executionPolicyBypass === false ? [] : ['-ExecutionPolicy', 'Bypass']),
          '-Command',
          script
        ]

        childRef = execFile(
          this.binary,
          args,
          {
            encoding: options?.encoding ?? 'utf8',
            maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024,
            signal: controller.signal,
            windowsHide: options?.windowsHide ?? true
          },
          (error, stdoutBuffer) => {
            if (error) {
              reject(error)
              return
            }
            resolve(this.toText(stdoutBuffer))
          }
        )

        if (childRef.pid) {
          childPid = childRef.pid
          this.activeChildren.set(childRef.pid, childRef)
          this.activeControllers.set(childRef.pid, controller)
          this.stats.runningPids = Array.from(this.activeChildren.keys())
        }

        childRef.once('exit', () => {
          if (childPid) {
            this.activeChildren.delete(childPid)
            this.activeControllers.delete(childPid)
            this.stats.runningPids = Array.from(this.activeChildren.keys())
          }
        })
      })

      this.stats.completedCount += 1
      this.stats.lastDurationMs = Date.now() - startedAt
      return options?.parser ? options.parser(stdout) : stdout as T
    } catch (error) {
      if (timedOut) {
        this.stats.timedOutCount += 1
        throw new PowerShellGatewayTimeoutError(timeoutMs, options?.label)
      }
      if (this.isAbortError(error)) {
        this.stats.abortedCount += 1
      } else {
        this.stats.failedCount += 1
      }
      throw error instanceof Error ? error : new Error(String(error))
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      if (childPid) {
        this.activeChildren.delete(childPid)
        this.activeControllers.delete(childPid)
        this.stats.runningPids = Array.from(this.activeChildren.keys())
      }
    }
  }

  private async killProcessTree(pid: number): Promise<void> {
    const killWaitMs = 1500

    await new Promise<void>((resolve) => {
      let settled = false
      let timer: NodeJS.Timeout | null = null
      const settle = (): void => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        resolve()
      }

      timer = setTimeout(() => {
        // Windows taskkill can hang behind tree-kill; shutdown must still complete.
        settle()
      }, killWaitMs)
      timer.unref?.()

      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // The process may already be gone; tree-kill still covers child cleanup when available.
      }

      kill(pid, 'SIGTERM', () => settle())
    })
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
  }

  private toText(output: string | Buffer | undefined | null): string {
    if (typeof output === 'string') {
      return output
    }
    if (Buffer.isBuffer(output)) {
      return output.toString('utf8')
    }
    return ''
  }
}

let powerShellGateway: PowerShellGateway | null = null

export function getPowerShellGateway(): PowerShellGateway {
  if (!powerShellGateway) {
    powerShellGateway = new PowerShellGateway()
  }
  return powerShellGateway
}

export async function shutdownPowerShellGateway(): Promise<number> {
  if (!powerShellGateway) {
    return 0
  }
  const active = powerShellGateway
  powerShellGateway = null
  return active.shutdown()
}
