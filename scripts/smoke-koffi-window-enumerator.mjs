#!/usr/bin/env node
import koffi from 'koffi'

if (process.platform !== 'win32') {
  console.log(JSON.stringify({ skipped: true, reason: 'not-win32' }, null, 2))
  process.exit(0)
}

koffi.proto('bool __stdcall EnumWindowsProc(void *hwnd, intptr_t lParam)')
koffi.struct('RECT', {
  left: 'long',
  top: 'long',
  right: 'long',
  bottom: 'long'
})

const user32 = koffi.load('user32.dll')
const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr_t lParam)')
const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(void *hWnd)')
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(void *hWnd, _Out_ char16_t *lpString, int nMaxCount)')
const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)')
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(void *hWnd)')

const samples = []
let visibleTitleCount = 0

const ok = EnumWindows(hwnd => {
  if (!IsWindowVisible(hwnd)) return true

  const titleLength = GetWindowTextLengthW(hwnd)
  if (titleLength <= 0) return true

  const maxChars = Math.min(titleLength + 1, 512)
  const buffer = Buffer.alloc(maxChars * 2)
  const copied = GetWindowTextW(hwnd, buffer, maxChars)
  const pidRef = [null]
  GetWindowThreadProcessId(hwnd, pidRef)

  if (copied > 0) {
    visibleTitleCount += 1
    if (samples.length < 3) {
      samples.push({
        hwnd: Number(koffi.address(hwnd)),
        pid: pidRef[0],
        titleLength: copied
      })
    }
  }

  return true
}, 0n)

console.log(JSON.stringify({ ok, visibleTitleCount, samples }, null, 2))
process.exit(ok && visibleTitleCount > 0 ? 0 : 1)
