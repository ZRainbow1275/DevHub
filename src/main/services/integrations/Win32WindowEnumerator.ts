import type { ServiceResult } from '@shared/types-extended'
import { importOptionalNativeModule, toRecord } from './nativeImport'

export interface NativeWindowSnapshot {
  hwnd: number
  title: string
  className: string
  pid: number
  x: number
  y: number
  width: number
  height: number
  isMinimized: boolean
}

export interface Win32WindowEnumeratorLike {
  enumerateVisibleWindows(): Promise<ServiceResult<NativeWindowSnapshot[]>>
}

interface Win32Rect {
  left?: number
  top?: number
  right?: number
  bottom?: number
}

interface KoffiLibrary {
  func: (definition: string) => unknown
}

interface KoffiRuntime {
  load: (path: string) => KoffiLibrary
  proto: (definition: string) => unknown
  struct: (name: string, definition: Record<string, string>) => unknown
  address: (value: unknown) => bigint
}

type EnumWindowsProc = (nativeHwnd: unknown) => boolean
type EnumWindowsFn = (callback: EnumWindowsProc, lParam: bigint) => boolean
type NativeHwndFn = (nativeHwnd: unknown) => boolean
type NativeTextLengthFn = (nativeHwnd: unknown) => number
type NativeTextFn = (nativeHwnd: unknown, buffer: Buffer, maxCount: number) => number
type NativeRectFn = (nativeHwnd: unknown, rect: Win32Rect) => boolean
type NativePidFn = (nativeHwnd: unknown, pidRef: Array<number | null>) => number

interface Win32Bindings {
  koffi: KoffiRuntime
  enumWindows: EnumWindowsFn
  getClassName: NativeTextFn
  getWindowRect: NativeRectFn
  getWindowText: NativeTextFn
  getWindowTextLength: NativeTextLengthFn
  getWindowThreadProcessId: NativePidFn
  isIconic: NativeHwndFn
  isWindowVisible: NativeHwndFn
}

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

  const load = candidate?.load
  const proto = candidate?.proto
  const struct = candidate?.struct
  const address = candidate?.address
  if (!isCallable(load) || !isCallable(proto) || !isCallable(struct) || !isCallable(address)) return null

  return {
    load: (path: string) => load.call(candidate, path) as KoffiLibrary,
    proto: (definition: string) => proto.call(candidate, definition),
    struct: (name: string, definition: Record<string, string>) => struct.call(candidate, name, definition),
    address: (value: unknown) => address.call(candidate, value) as bigint
  }
}

function decodeUtf16Buffer(buffer: Buffer, copiedChars: number): string | null {
  if (copiedChars <= 0) return null
  const rawTitle = buffer.toString('utf16le', 0, copiedChars * 2)
  const withoutControlChars = Array.from(rawTitle, character => {
    const codePoint = character.charCodeAt(0)
    return codePoint <= 0x1F || codePoint === 0x7F ? ' ' : character
  }).join('')
  const normalized = withoutControlChars.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : null
}

function readBoundedUtf16Text(nativeHwnd: unknown, maxChars: number, reader: NativeTextFn): string | null {
  const buffer = Buffer.alloc(maxChars * 2)
  const copied = reader(nativeHwnd, buffer, maxChars)
  return decodeUtf16Buffer(buffer, copied)
}

export class Win32WindowEnumerator implements Win32WindowEnumeratorLike {
  private bindingsPromise: Promise<Win32Bindings | null> | null = null

  async enumerateVisibleWindows(): Promise<ServiceResult<NativeWindowSnapshot[]>> {
    if (process.platform !== 'win32') {
      return { success: false, data: [], error: 'WIN32_NATIVE_UNSUPPORTED_PLATFORM' }
    }

    const bindings = await this.getBindings()
    if (!bindings) {
      return { success: false, data: [], error: 'KOFFI_UNAVAILABLE' }
    }

    const windows: NativeWindowSnapshot[] = []
    const collectWindow: EnumWindowsProc = nativeHwnd => {
      try {
        const snapshot = this.readWindowSnapshot(bindings, nativeHwnd)
        if (snapshot) windows.push(snapshot)
      } catch {
        return true
      }
      return true
    }

    try {
      const success = bindings.enumWindows(collectWindow, 0n)
      if (!success) return { success: false, data: [], error: 'ENUM_WINDOWS_FAILED' }
      return { success: true, data: windows }
    } catch (error) {
      return { success: false, data: [], error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async getBindings(): Promise<Win32Bindings | null> {
    this.bindingsPromise ??= this.createBindings()
    return this.bindingsPromise
  }

  private async createBindings(): Promise<Win32Bindings | null> {
    const koffi = toKoffiRuntime(await importOptionalNativeModule('koffi'))
    if (!koffi) return null

    koffi.proto('bool __stdcall EnumWindowsProc(void *hwnd, intptr_t lParam)')
    koffi.struct('RECT', {
      left: 'long',
      top: 'long',
      right: 'long',
      bottom: 'long'
    })

    const user32 = koffi.load('user32.dll')
    if (!isCallable(user32.func)) return null

    return {
      koffi,
      enumWindows: bindFunction<EnumWindowsFn>(user32, 'bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr_t lParam)'),
      getClassName: bindFunction<NativeTextFn>(user32, 'int __stdcall GetClassNameW(void *hWnd, _Out_ char16_t *lpClassName, int nMaxCount)'),
      getWindowRect: bindFunction<NativeRectFn>(user32, 'bool __stdcall GetWindowRect(void *hWnd, _Out_ RECT *lpRect)'),
      getWindowText: bindFunction<NativeTextFn>(user32, 'int __stdcall GetWindowTextW(void *hWnd, _Out_ char16_t *lpString, int nMaxCount)'),
      getWindowTextLength: bindFunction<NativeTextLengthFn>(user32, 'int __stdcall GetWindowTextLengthW(void *hWnd)'),
      getWindowThreadProcessId: bindFunction<NativePidFn>(user32, 'uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)'),
      isIconic: bindFunction<NativeHwndFn>(user32, 'bool __stdcall IsIconic(void *hWnd)'),
      isWindowVisible: bindFunction<NativeHwndFn>(user32, 'bool __stdcall IsWindowVisible(void *hWnd)')
    }
  }

  private readWindowSnapshot(bindings: Win32Bindings, nativeHwnd: unknown): NativeWindowSnapshot | null {
    if (!bindings.isWindowVisible(nativeHwnd)) return null

    const titleLength = bindings.getWindowTextLength(nativeHwnd)
    if (!Number.isInteger(titleLength) || titleLength <= 0) return null

    const title = readBoundedUtf16Text(nativeHwnd, Math.min(titleLength + 1, 1024), bindings.getWindowText)
    if (!title) return null

    const className = readBoundedUtf16Text(nativeHwnd, 256, bindings.getClassName) ?? ''
    const rect = this.readRect(bindings, nativeHwnd)
    if (!rect) return null

    const pid = this.readPid(bindings, nativeHwnd)
    if (pid === null) return null

    const hwnd = this.toSafeHwndNumber(bindings, nativeHwnd)
    if (hwnd === null) return null

    return {
      hwnd,
      title,
      className,
      pid,
      x: rect.left,
      y: rect.top,
      width: Math.max(0, rect.right - rect.left),
      height: Math.max(0, rect.bottom - rect.top),
      isMinimized: bindings.isIconic(nativeHwnd)
    }
  }

  private readRect(bindings: Win32Bindings, nativeHwnd: unknown): Required<Win32Rect> | null {
    const rect: Win32Rect = {}
    if (!bindings.getWindowRect(nativeHwnd, rect)) return null
    if (
      typeof rect.left !== 'number' ||
      typeof rect.top !== 'number' ||
      typeof rect.right !== 'number' ||
      typeof rect.bottom !== 'number'
    ) {
      return null
    }
    return rect as Required<Win32Rect>
  }

  private readPid(bindings: Win32Bindings, nativeHwnd: unknown): number | null {
    const pidRef: Array<number | null> = [null]
    const threadId = bindings.getWindowThreadProcessId(nativeHwnd, pidRef)
    const pid = pidRef[0]
    if (threadId <= 0 || typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return null
    return pid
  }

  private toSafeHwndNumber(bindings: Win32Bindings, nativeHwnd: unknown): number | null {
    let address: bigint
    if (typeof nativeHwnd === 'bigint') {
      address = nativeHwnd
    } else if (typeof nativeHwnd === 'number') {
      address = BigInt(nativeHwnd)
    } else {
      address = bindings.koffi.address(nativeHwnd)
    }

    const hwnd = Number(address)
    return Number.isSafeInteger(hwnd) && hwnd > 0 ? hwnd : null
  }
}
