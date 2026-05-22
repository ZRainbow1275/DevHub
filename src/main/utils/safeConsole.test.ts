import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  createSafeUncaughtExceptionHandler,
  createSafeConsoleMethod,
  installSafeConsole,
  isIgnorableConsoleStreamError,
  isIgnorableWindowsPipeReadError
} from './safeConsole'

describe('safeConsole', () => {
  it('identifies ignorable stream errors', () => {
    const brokenPipe = new Error('broken pipe') as NodeJS.ErrnoException
    brokenPipe.code = 'EPIPE'

    const destroyed = new Error('destroyed') as NodeJS.ErrnoException
    destroyed.code = 'ERR_STREAM_DESTROYED'

    const other = new Error('other') as NodeJS.ErrnoException
    other.code = 'ENOENT'

    expect(isIgnorableConsoleStreamError(brokenPipe)).toBe(true)
    expect(isIgnorableConsoleStreamError(destroyed)).toBe(true)
    expect(isIgnorableConsoleStreamError(other)).toBe(false)
    expect(isIgnorableConsoleStreamError('broken')).toBe(false)
  })

  it('identifies the Windows Pipe.onStreamRead out-of-range crash signature', () => {
    const pipeReadError = new RangeError('The value of "err" is out of range. It must be a negative integer. Received 119') as NodeJS.ErrnoException
    pipeReadError.code = 'ERR_OUT_OF_RANGE'
    pipeReadError.stack = 'RangeError [ERR_OUT_OF_RANGE]\\n    at Pipe.onStreamRead (node:internal/stream_base_commons:217:20)'

    const wrongCode = new RangeError(pipeReadError.message) as NodeJS.ErrnoException
    wrongCode.code = 'EPIPE'
    wrongCode.stack = pipeReadError.stack

    expect(isIgnorableWindowsPipeReadError(pipeReadError, 'win32')).toBe(true)
    expect(isIgnorableWindowsPipeReadError(pipeReadError, 'linux')).toBe(false)
    expect(isIgnorableWindowsPipeReadError(wrongCode, 'win32')).toBe(false)
    expect(isIgnorableWindowsPipeReadError(new Error(pipeReadError.message), 'win32')).toBe(false)
  })

  it('swallows broken pipe writes but preserves real failures', () => {
    const brokenPipe = new Error('broken pipe') as NodeJS.ErrnoException
    brokenPipe.code = 'EPIPE'

    const brokenWriter = vi.fn((..._args: unknown[]) => {
      throw brokenPipe
    })
    const safeBrokenWriter = createSafeConsoleMethod(brokenWriter)
    expect(() => safeBrokenWriter('message')).not.toThrow()

    const realFailure = new Error('boom')
    const failingWriter = vi.fn((..._args: unknown[]) => {
      throw realFailure
    })
    const safeFailingWriter = createSafeConsoleMethod(failingWriter)
    expect(() => safeFailingWriter('message')).toThrow(realFailure)
  })

  it('installs guarded console methods and ignores stdout stderr EPIPE events', () => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const brokenPipe = new Error('broken pipe') as NodeJS.ErrnoException
    brokenPipe.code = 'EPIPE'

    const targetConsole = {
      debug: vi.fn((..._args: unknown[]) => {}),
      error: vi.fn((..._args: unknown[]) => {
        throw brokenPipe
      }),
      info: vi.fn((..._args: unknown[]) => {}),
      log: vi.fn((..._args: unknown[]) => {}),
      warn: vi.fn((..._args: unknown[]) => {
        throw brokenPipe
      })
    }

    installSafeConsole({ stderr, stdout, targetConsole })

    expect(() => targetConsole.warn('warn')).not.toThrow()
    expect(() => targetConsole.error('error')).not.toThrow()
    expect(() => stdout.emit('error', brokenPipe)).not.toThrow()
    expect(() => stderr.emit('error', brokenPipe)).not.toThrow()
  })

  it('swallows only the known Windows pipe read crash and rethrows everything else', () => {
    const rethrow = vi.fn()
    const removeListener = vi.fn()
    const handler = createSafeUncaughtExceptionHandler({
      platform: 'win32',
      removeListener,
      rethrow
    })

    const pipeReadError = new RangeError('The value of "err" is out of range. It must be a negative integer. Received 119') as NodeJS.ErrnoException
    pipeReadError.code = 'ERR_OUT_OF_RANGE'
    pipeReadError.stack = 'RangeError [ERR_OUT_OF_RANGE]\\n    at Pipe.onStreamRead (node:internal/stream_base_commons:217:20)'

    handler(pipeReadError)
    expect(removeListener).not.toHaveBeenCalled()
    expect(rethrow).not.toHaveBeenCalled()

    const realFailure = new Error('boom')
    handler(realFailure)
    expect(removeListener).toHaveBeenCalledTimes(1)
    expect(removeListener).toHaveBeenCalledWith(handler)
    expect(rethrow).toHaveBeenCalledTimes(1)
    expect(rethrow).toHaveBeenCalledWith(realFailure)
  })
})
