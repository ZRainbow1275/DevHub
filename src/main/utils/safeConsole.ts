type ConsoleMethodName = 'debug' | 'error' | 'info' | 'log' | 'warn'

type ConsoleLike = Record<ConsoleMethodName, (...args: unknown[]) => void>

type ErrorCapableStream = {
  on?: (event: 'error', listener: (error: unknown) => void) => unknown
}

type UncaughtExceptionHandler = (error: Error) => void

type UncaughtExceptionTarget = {
  off: (event: string, listener: unknown) => unknown
  on: (event: string, listener: unknown) => unknown
}

interface InstallSafeConsoleOptions {
  stderr?: ErrorCapableStream | null
  stdout?: ErrorCapableStream | null
  targetConsole?: ConsoleLike
}

const CONSOLE_METHODS: readonly ConsoleMethodName[] = ['debug', 'error', 'info', 'log', 'warn']

let installedConsole: ConsoleLike | null = null
let installedUncaughtExceptionTarget: UncaughtExceptionTarget | null = null

function rethrowUnhandledError(error: Error): void {
  setImmediate(() => {
    throw error
  })
}

export function isIgnorableConsoleStreamError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const code = (error as NodeJS.ErrnoException).code
  return code === 'EPIPE' || code === 'ERR_STREAM_DESTROYED'
}

export function isIgnorableWindowsPipeReadError(
  error: unknown,
  platform: NodeJS.Platform = process.platform
): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const code = (error as NodeJS.ErrnoException).code
  return platform === 'win32'
    && error.name === 'RangeError'
    && code === 'ERR_OUT_OF_RANGE'
    && error.message.includes('The value of "err" is out of range')
    && error.stack?.includes('Pipe.onStreamRead') === true
}

export function createSafeConsoleMethod<TArgs extends unknown[]>(
  method: (...args: TArgs) => void
): (...args: TArgs) => void {
  return (...args: TArgs) => {
    try {
      method(...args)
    } catch (error) {
      if (isIgnorableConsoleStreamError(error)) {
        return
      }

      throw error
    }
  }
}

function attachIgnorableErrorHandler(stream?: ErrorCapableStream | null): void {
  stream?.on?.('error', (error) => {
    if (isIgnorableConsoleStreamError(error)) {
      return
    }
  })
}

export function createSafeUncaughtExceptionHandler(options?: {
  platform?: NodeJS.Platform
  removeListener?: (handler: UncaughtExceptionHandler) => void
  rethrow?: (error: Error) => void
}): UncaughtExceptionHandler {
  const platform = options?.platform ?? process.platform
  const removeListener = options?.removeListener ?? ((handler: UncaughtExceptionHandler) => {
    const uncaughtTarget = process as unknown as UncaughtExceptionTarget
    uncaughtTarget.off('uncaughtException', handler)
  })
  const rethrow = options?.rethrow ?? rethrowUnhandledError

  const handler: UncaughtExceptionHandler = (error) => {
    if (isIgnorableWindowsPipeReadError(error, platform)) {
      return
    }

    removeListener(handler)
    rethrow(error)
  }

  return handler
}

function installUncaughtExceptionGuard(target?: UncaughtExceptionTarget): void {
  const uncaughtTarget = target ?? (process as unknown as UncaughtExceptionTarget)

  if (installedUncaughtExceptionTarget === uncaughtTarget) {
    return
  }

  uncaughtTarget.on('uncaughtException', createSafeUncaughtExceptionHandler({
    removeListener: (handler) => {
      uncaughtTarget.off('uncaughtException', handler)
    }
  }))
  installedUncaughtExceptionTarget = uncaughtTarget
}

export function installSafeConsole(options: InstallSafeConsoleOptions = {}): void {
  const targetConsole = options.targetConsole ?? (console as ConsoleLike)
  installUncaughtExceptionGuard()

  if (installedConsole === targetConsole) {
    return
  }

  for (const methodName of CONSOLE_METHODS) {
    const original = targetConsole[methodName].bind(targetConsole)
    targetConsole[methodName] = createSafeConsoleMethod(original)
  }

  attachIgnorableErrorHandler(options.stdout ?? process.stdout)
  attachIgnorableErrorHandler(options.stderr ?? process.stderr)
  installedConsole = targetConsole
}
