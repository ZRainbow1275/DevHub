import type { ServiceResult } from '@shared/types-extended'

export interface InjectTextWindowManager {
  sendTextToWindow: (hwnd: number, text: string) => Promise<ServiceResult<{ characters: number; mode: string }>>
  sendKeysToWindow?: (hwnd: number, keys: string) => Promise<ServiceResult>
}

export interface InjectTextRequest {
  hwnd: number
  args: Record<string, unknown>
  allowSafeKeys?: boolean
}

const SAFE_INJECT_KEYS = new Set(['Ctrl+C', 'Ctrl+D', 'Ctrl+Z', 'Enter', 'Escape'])

function extractStringArg(args: Record<string, unknown>, key: string): string | null {
  const value = args[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function serviceFailure<T = unknown>(error: string): ServiceResult<T> {
  return { success: false, error }
}

export class InjectTextService {
  constructor(private readonly windowManager: InjectTextWindowManager) {}

  execute(request: InjectTextRequest): Promise<ServiceResult<unknown>> {
    const text = extractStringArg(request.args, 'text')
    if (text) {
      return this.windowManager.sendTextToWindow(request.hwnd, text)
    }

    const keys = extractStringArg(request.args, 'keys')
    if (!keys) {
      return Promise.resolve(serviceFailure('E_VALIDATION: inject-text requires args.text or args.keys'))
    }
    if (!request.allowSafeKeys) {
      return Promise.resolve(serviceFailure('E_VALIDATION: process inject-text does not support key-only injection'))
    }
    if (!SAFE_INJECT_KEYS.has(keys)) {
      return Promise.resolve(serviceFailure(`E_VALIDATION: unsupported safe key combo ${keys}`))
    }
    if (!this.windowManager.sendKeysToWindow) {
      return Promise.resolve(serviceFailure('E_INJECT_KEYS_UNAVAILABLE: key injection requires sendKeysToWindow'))
    }
    return this.windowManager.sendKeysToWindow(request.hwnd, keys)
  }
}
