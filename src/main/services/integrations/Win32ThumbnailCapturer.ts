import { nativeImage } from 'electron'
import type { WindowInfo } from '@shared/types-extended'
import { importOptionalNativeModule, toRecord } from './nativeImport'

export interface ThumbnailCaptureSize {
  width: number
  height: number
}

export interface Win32ThumbnailCaptureResult {
  dataUrl: string
  capturedAt: number
  height: number
  width: number
}

export interface Win32ThumbnailCapturerLike {
  capture(windowInfo: WindowInfo, size: ThumbnailCaptureSize): Promise<Win32ThumbnailCaptureResult | null>
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
  struct: (name: string, definition: Record<string, string>) => unknown
}

type NativePointer = bigint | number | unknown
type NativeBoolFn = (handle: NativePointer) => boolean
type NativeGetWindowRectFn = (handle: NativePointer, rect: Win32Rect) => boolean
type NativeGetDcFn = (handle: NativePointer) => NativePointer | null
type NativeReleaseDcFn = (handle: NativePointer, dc: NativePointer) => number
type NativeCreateCompatibleDcFn = (dc: NativePointer) => NativePointer | null
type NativeCreateCompatibleBitmapFn = (dc: NativePointer, width: number, height: number) => NativePointer | null
type NativeSelectObjectFn = (dc: NativePointer, object: NativePointer) => NativePointer | null
type NativeDeleteObjectFn = (object: NativePointer) => boolean
type NativeDeleteDcFn = (dc: NativePointer) => boolean
type NativeDwmGetWindowAttributeFn = (handle: NativePointer, attribute: number, attributeValue: Win32Rect, attributeSize: number) => number
type NativePrintWindowFn = (hwnd: NativePointer, dc: NativePointer, flags: number) => boolean
type NativeBitBltFn = (targetDc: NativePointer, x: number, y: number, width: number, height: number, sourceDc: NativePointer, sourceX: number, sourceY: number, rasterOp: number) => boolean
type NativeStretchBltFn = (
  targetDc: NativePointer,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number,
  sourceDc: NativePointer,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  rasterOp: number
) => boolean
type NativeGetDibitsFn = (dc: NativePointer, bitmap: NativePointer, startScan: number, scanLines: number, bits: Buffer, bitmapInfo: Buffer, usage: number) => number

interface Win32ThumbnailBindings {
  bitBlt: NativeBitBltFn
  createCompatibleBitmap: NativeCreateCompatibleBitmapFn
  createCompatibleDc: NativeCreateCompatibleDcFn
  deleteDc: NativeDeleteDcFn
  deleteObject: NativeDeleteObjectFn
  dwmGetWindowAttribute: NativeDwmGetWindowAttributeFn
  getDibits: NativeGetDibitsFn
  getWindowDc: NativeGetDcFn
  getWindowRect: NativeGetWindowRectFn
  isIconic: NativeBoolFn
  isWindow: NativeBoolFn
  printWindow: NativePrintWindowFn
  releaseDc: NativeReleaseDcFn
  selectObject: NativeSelectObjectFn
  stretchBlt: NativeStretchBltFn
}

const BI_RGB = 0
const DIB_RGB_COLORS = 0
const DWMWA_EXTENDED_FRAME_BOUNDS = 9
const PW_RENDERFULLCONTENT = 2
const RECT_STRUCT_NAME = 'DEVHUB_THUMBNAIL_RECT'
const RECT_STRUCT_SIZE_BYTES = 16
const SRCCOPY = 0x00CC0020

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
  const struct = candidate?.struct
  if (!isCallable(load) || !isCallable(struct)) return null
  return {
    load: (path: string) => load.call(candidate, path) as KoffiLibrary,
    struct: (name: string, definition: Record<string, string>) => struct.call(candidate, name, definition)
  }
}

function toHwndPointer(hwnd: number): bigint {
  return BigInt(Math.floor(hwnd))
}

function isPointer(value: NativePointer | null): value is NativePointer {
  return value !== null && value !== undefined && value !== 0 && value !== 0n
}

function createBitmapInfoHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(40)
  buffer.writeUInt32LE(40, 0)
  buffer.writeInt32LE(width, 4)
  buffer.writeInt32LE(-height, 8)
  buffer.writeUInt16LE(1, 12)
  buffer.writeUInt16LE(32, 14)
  buffer.writeUInt32LE(BI_RGB, 16)
  buffer.writeUInt32LE(width * height * 4, 20)
  buffer.writeInt32LE(0, 24)
  buffer.writeInt32LE(0, 28)
  buffer.writeUInt32LE(0, 32)
  buffer.writeUInt32LE(0, 36)
  return buffer
}

function isPngDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/png;base64,')
}

function debugWin32Thumbnail(reason: string, details: Record<string, unknown> = {}): void {
  if (process.env.DEVHUB_THUMBNAIL_DEBUG !== '1') return
  console.warn('[thumbnail:win32]', reason, details)
}

export class Win32ThumbnailCapturer implements Win32ThumbnailCapturerLike {
  private bindingsPromise: Promise<Win32ThumbnailBindings | null> | null = null

  async capture(windowInfo: WindowInfo, size: ThumbnailCaptureSize): Promise<Win32ThumbnailCaptureResult | null> {
    if (process.platform !== 'win32') {
      debugWin32Thumbnail('unsupported-platform', { platform: process.platform })
      return null
    }
    if (windowInfo.isMinimized || windowInfo.rect.width <= 0 || windowInfo.rect.height <= 0) {
      debugWin32Thumbnail('invalid-window-state', { hwnd: windowInfo.hwnd, isMinimized: windowInfo.isMinimized, rect: windowInfo.rect })
      return null
    }
    const bindings = await this.getBindings()
    if (!bindings) {
      debugWin32Thumbnail('bindings-unavailable', { hwnd: windowInfo.hwnd })
      return null
    }

    const hwnd = toHwndPointer(windowInfo.hwnd)
    if (!bindings.isWindow(hwnd) || bindings.isIconic(hwnd)) {
      debugWin32Thumbnail('window-invalid-or-iconic', { hwnd: windowInfo.hwnd })
      return null
    }

    const rect = this.readDwmFrameRect(bindings, hwnd) ?? this.readWindowRect(bindings, hwnd)
    if (!rect) {
      debugWin32Thumbnail('rect-unavailable', { hwnd: windowInfo.hwnd })
      return null
    }

    const width = Math.min(Math.max(1, rect.right - rect.left), 4096)
    const height = Math.min(Math.max(1, rect.bottom - rect.top), 4096)
    const windowDc = bindings.getWindowDc(hwnd)
    if (!isPointer(windowDc)) {
      debugWin32Thumbnail('window-dc-unavailable', { hwnd: windowInfo.hwnd, width, height })
      return null
    }

    const memoryDc = bindings.createCompatibleDc(windowDc)
    if (!isPointer(memoryDc)) {
      debugWin32Thumbnail('memory-dc-unavailable', { hwnd: windowInfo.hwnd, width, height })
      bindings.releaseDc(hwnd, windowDc)
      return null
    }

    const targetWidth = Math.max(1, Math.floor(size.width))
    const targetHeight = Math.max(1, Math.floor(size.height))
    const bitmap = bindings.createCompatibleBitmap(windowDc, targetWidth, targetHeight)
    if (!isPointer(bitmap)) {
      debugWin32Thumbnail('bitmap-unavailable', { hwnd: windowInfo.hwnd, width, height })
      bindings.deleteDc(memoryDc)
      bindings.releaseDc(hwnd, windowDc)
      return null
    }

    const previousObject = bindings.selectObject(memoryDc, bitmap)
    try {
      const copiedByBlt = bindings.stretchBlt(memoryDc, 0, 0, targetWidth, targetHeight, windowDc, 0, 0, width, height, SRCCOPY) ||
        bindings.bitBlt(memoryDc, 0, 0, targetWidth, targetHeight, windowDc, 0, 0, SRCCOPY)
      const printed = copiedByBlt ? false : bindings.printWindow(hwnd, memoryDc, PW_RENDERFULLCONTENT)
      const copied = copiedByBlt || printed
      if (!copied) {
        debugWin32Thumbnail('copy-failed', { hwnd: windowInfo.hwnd, printed })
        return null
      }

      const pixels = Buffer.alloc(targetWidth * targetHeight * 4)
      const bitmapInfo = createBitmapInfoHeader(targetWidth, targetHeight)
      const scanLines = bindings.getDibits(memoryDc, bitmap, 0, targetHeight, pixels, bitmapInfo, DIB_RGB_COLORS)
      if (scanLines !== targetHeight) {
        debugWin32Thumbnail('get-dibits-failed', { hwnd: windowInfo.hwnd, scanLines, height: targetHeight })
        return null
      }

      const image = nativeImage.createFromBitmap(pixels, { width: targetWidth, height: targetHeight, scaleFactor: 1 })
      const dataUrl = image.toDataURL()
      if (!isPngDataUrl(dataUrl)) {
        debugWin32Thumbnail('invalid-data-url', { hwnd: windowInfo.hwnd, dataUrlPrefix: dataUrl.slice(0, 32) })
        return null
      }
      return {
        capturedAt: Date.now(),
        dataUrl,
        height: size.height,
        width: size.width
      }
    } finally {
      if (isPointer(previousObject)) bindings.selectObject(memoryDc, previousObject)
      bindings.deleteObject(bitmap)
      bindings.deleteDc(memoryDc)
      bindings.releaseDc(hwnd, windowDc)
    }
  }

  private async getBindings(): Promise<Win32ThumbnailBindings | null> {
    this.bindingsPromise ??= this.createBindings()
    return this.bindingsPromise
  }

  private async createBindings(): Promise<Win32ThumbnailBindings | null> {
    const koffi = toKoffiRuntime(await importOptionalNativeModule('koffi'))
    if (!koffi) {
      debugWin32Thumbnail('koffi-unavailable')
      return null
    }
    koffi.struct(RECT_STRUCT_NAME, {
      left: 'long',
      top: 'long',
      right: 'long',
      bottom: 'long'
    })

    const user32 = koffi.load('user32.dll')
    const gdi32 = koffi.load('gdi32.dll')
    const dwmapi = koffi.load('dwmapi.dll')
    if (!isCallable(user32.func) || !isCallable(gdi32.func) || !isCallable(dwmapi.func)) {
      debugWin32Thumbnail('win32-library-unavailable')
      return null
    }

    return {
      bitBlt: bindFunction<NativeBitBltFn>(gdi32, 'bool __stdcall BitBlt(void *hdcDest, int xDest, int yDest, int wDest, int hDest, void *hdcSrc, int xSrc, int ySrc, uint32_t rop)'),
      createCompatibleBitmap: bindFunction<NativeCreateCompatibleBitmapFn>(gdi32, 'void * __stdcall CreateCompatibleBitmap(void *hdc, int cx, int cy)'),
      createCompatibleDc: bindFunction<NativeCreateCompatibleDcFn>(gdi32, 'void * __stdcall CreateCompatibleDC(void *hdc)'),
      deleteDc: bindFunction<NativeDeleteDcFn>(gdi32, 'bool __stdcall DeleteDC(void *hdc)'),
      deleteObject: bindFunction<NativeDeleteObjectFn>(gdi32, 'bool __stdcall DeleteObject(void *ho)'),
      dwmGetWindowAttribute: bindFunction<NativeDwmGetWindowAttributeFn>(dwmapi, `int __stdcall DwmGetWindowAttribute(void *hWnd, uint32_t dwAttribute, _Out_ ${RECT_STRUCT_NAME} *pvAttribute, uint32_t cbAttribute)`),
      getDibits: bindFunction<NativeGetDibitsFn>(gdi32, 'int __stdcall GetDIBits(void *hdc, void *hbm, uint32_t start, uint32_t cLines, void *lpvBits, void *lpbmi, uint32_t usage)'),
      getWindowDc: bindFunction<NativeGetDcFn>(user32, 'void * __stdcall GetWindowDC(void *hWnd)'),
      getWindowRect: bindFunction<NativeGetWindowRectFn>(user32, `bool __stdcall GetWindowRect(void *hWnd, _Out_ ${RECT_STRUCT_NAME} *lpRect)`),
      isIconic: bindFunction<NativeBoolFn>(user32, 'bool __stdcall IsIconic(void *hWnd)'),
      isWindow: bindFunction<NativeBoolFn>(user32, 'bool __stdcall IsWindow(void *hWnd)'),
      printWindow: bindFunction<NativePrintWindowFn>(user32, 'bool __stdcall PrintWindow(void *hWnd, void *hdcBlt, uint32_t nFlags)'),
      releaseDc: bindFunction<NativeReleaseDcFn>(user32, 'int __stdcall ReleaseDC(void *hWnd, void *hDC)'),
      selectObject: bindFunction<NativeSelectObjectFn>(gdi32, 'void * __stdcall SelectObject(void *hdc, void *h)'),
      stretchBlt: bindFunction<NativeStretchBltFn>(gdi32, 'bool __stdcall StretchBlt(void *hdcDest, int xDest, int yDest, int wDest, int hDest, void *hdcSrc, int xSrc, int ySrc, int wSrc, int hSrc, uint32_t rop)')
    }
  }

  private readDwmFrameRect(bindings: Win32ThumbnailBindings, hwnd: NativePointer): Required<Win32Rect> | null {
    const rect = this.readRectFromNative((candidate) =>
      bindings.dwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, candidate, RECT_STRUCT_SIZE_BYTES) === 0
    )
    if (!rect) return null
    if (rect.right <= rect.left || rect.bottom <= rect.top) return null
    return rect
  }

  private readWindowRect(bindings: Win32ThumbnailBindings, hwnd: NativePointer): Required<Win32Rect> | null {
    return this.readRectFromNative((rect) => bindings.getWindowRect(hwnd, rect))
  }

  private readRectFromNative(read: (rect: Win32Rect) => boolean): Required<Win32Rect> | null {
    const rect: Win32Rect = {}
    if (!read(rect)) return null
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
}
