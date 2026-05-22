import type { ServiceResult } from '@shared/types-extended'
import { importOptionalNativeModule, toRecord } from './nativeImport'

export interface ForegroundWindowEvent {
  eventTimeMs: number
  hwnd: number
  threadId: number
}

export type ForegroundWindowEventCallback = (event: ForegroundWindowEvent) => void

export interface Win32ForegroundEventWatcherLike {
  start(callback: ForegroundWindowEventCallback): Promise<ServiceResult<{ source: 'win32-foreground-event-hook' }>>
  stop(): void
}

interface KoffiLibrary {
  func: (definition: string) => unknown
}

interface KoffiRuntime {
  address: (value: unknown) => bigint
  load: (path: string) => KoffiLibrary
  proto: (definition: string) => unknown
  register: (callback: (...args: unknown[]) => void, type: string) => unknown
  unregister: (callback: unknown) => void
}

interface Win32ForegroundBindings {
  koffi: KoffiRuntime
  setWinEventHook: SetWinEventHookFn
  unhookWinEvent: UnhookWinEventFn
}

type SetWinEventHookFn = (
  eventMin: number,
  eventMax: number,
  moduleHandle: bigint,
  callback: unknown,
  processId: number,
  threadId: number,
  flags: number
) => unknown

type UnhookWinEventFn = (hook: unknown) => boolean

const EVENT_SYSTEM_FOREGROUND = 0x0003
const WINEVENT_OUTOFCONTEXT = 0x0000
const WINEVENT_SKIPOWNPROCESS = 0x0002
const WIN_EVENT_PROC_TYPE = 'WinEventProc *'

function bindFunction<TFunction>(library: KoffiLibrary, definition: string): TFunction {
  return library.func(definition) as unknown as TFunction
}

function isCallable(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

function toKoffiRuntime(moduleValue: unknown): KoffiRuntime | null {
  const moduleRecord = toRecord(moduleValue)
  const defaultRecord = toRecord(moduleRecord?.default)
  const candidate = defaultRecord ?? moduleRecord

  const address = candidate?.address
  const load = candidate?.load
  const proto = candidate?.proto
  const register = candidate?.register
  const unregister = candidate?.unregister
  if (!isCallable(address) || !isCallable(load) || !isCallable(proto) || !isCallable(register) || !isCallable(unregister)) return null

  return {
    address: (value: unknown) => address.call(candidate, value) as bigint,
    load: (path: string) => load.call(candidate, path) as KoffiLibrary,
    proto: (definition: string) => proto.call(candidate, definition),
    register: (callback: (...args: unknown[]) => void, type: string) => register.call(candidate, callback, type),
    unregister: (callback: unknown) => {
      unregister.call(candidate, callback)
    }
  }
}

function toSafeHwndNumber(koffi: KoffiRuntime, nativeHwnd: unknown): number | null {
  let address: bigint
  if (typeof nativeHwnd === 'bigint') {
    address = nativeHwnd
  } else if (typeof nativeHwnd === 'number') {
    address = BigInt(nativeHwnd)
  } else {
    address = koffi.address(nativeHwnd)
  }
  const hwnd = Number(address)
  return Number.isSafeInteger(hwnd) && hwnd > 0 ? hwnd : null
}

function hasHookValue(hook: unknown): boolean {
  if (!hook) return false
  if (typeof hook === 'number') return hook !== 0
  if (typeof hook === 'bigint') return hook !== 0n
  return true
}

export class Win32ForegroundEventWatcher implements Win32ForegroundEventWatcherLike {
  private bindingsPromise: Promise<Win32ForegroundBindings | null> | null = null
  private callback: ForegroundWindowEventCallback | null = null
  private hook: unknown = null
  private registeredCallback: unknown = null

  async start(callback: ForegroundWindowEventCallback): Promise<ServiceResult<{ source: 'win32-foreground-event-hook' }>> {
    if (process.platform !== 'win32') {
      return { success: false, error: 'WIN32_FOREGROUND_HOOK_UNSUPPORTED_PLATFORM' }
    }
    if (this.hook) {
      this.callback = callback
      return { success: true, data: { source: 'win32-foreground-event-hook' } }
    }

    const bindings = await this.getBindings()
    if (!bindings) {
      return { success: false, error: 'KOFFI_UNAVAILABLE' }
    }

    this.callback = callback
    const registeredCallback = bindings.koffi.register(
      (_hook, event, nativeHwnd, _idObject, _idChild, threadId, eventTimeMs) => {
        if (event !== EVENT_SYSTEM_FOREGROUND || !this.callback) return
        const hwnd = toSafeHwndNumber(bindings.koffi, nativeHwnd)
        if (!hwnd) return
        this.callback({
          hwnd,
          threadId: typeof threadId === 'number' ? threadId : 0,
          eventTimeMs: typeof eventTimeMs === 'number' ? eventTimeMs : Date.now()
        })
      },
      WIN_EVENT_PROC_TYPE
    )
    const hook = bindings.setWinEventHook(
      EVENT_SYSTEM_FOREGROUND,
      EVENT_SYSTEM_FOREGROUND,
      0n,
      registeredCallback,
      0,
      0,
      WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
    )
    if (!hasHookValue(hook)) {
      bindings.koffi.unregister(registeredCallback)
      this.callback = null
      return { success: false, error: 'SET_WIN_EVENT_HOOK_FAILED' }
    }

    this.registeredCallback = registeredCallback
    this.hook = hook
    return { success: true, data: { source: 'win32-foreground-event-hook' } }
  }

  stop(): void {
    const hook = this.hook
    const registeredCallback = this.registeredCallback
    this.hook = null
    this.registeredCallback = null
    this.callback = null
    void this.getBindings().then(bindings => {
      if (!bindings) return
      if (hook) bindings.unhookWinEvent(hook)
      if (registeredCallback) bindings.koffi.unregister(registeredCallback)
    })
  }

  private async getBindings(): Promise<Win32ForegroundBindings | null> {
    this.bindingsPromise ??= this.createBindings()
    return this.bindingsPromise
  }

  private async createBindings(): Promise<Win32ForegroundBindings | null> {
    const koffi = toKoffiRuntime(await importOptionalNativeModule('koffi'))
    if (!koffi) return null

    koffi.proto('void __stdcall WinEventProc(void *hook, uint32_t event, void *hwnd, int32_t idObject, int32_t idChild, uint32_t threadId, uint32_t eventTimeMs)')
    const user32 = koffi.load('user32.dll')
    if (!isCallable(user32.func)) return null

    return {
      koffi,
      setWinEventHook: bindFunction<SetWinEventHookFn>(user32, 'void * __stdcall SetWinEventHook(uint32_t eventMin, uint32_t eventMax, void *moduleHandle, WinEventProc *callback, uint32_t processId, uint32_t threadId, uint32_t flags)'),
      unhookWinEvent: bindFunction<UnhookWinEventFn>(user32, 'bool __stdcall UnhookWinEvent(void *hook)')
    }
  }
}
