import { z } from 'zod'
import { ServiceResult } from '@shared/types-extended'
import { importOptionalNativeModule, toRecord } from './nativeImport'

const hwndSchema = z.number().int().positive()

export interface NativeWindowSummary {
  hwnd: number
  title: string
  processId?: number
}

interface NativeWindowManagerLike {
  getActiveWindow?: () => unknown
  getWindows?: () => unknown
}

function resolveWindowManager(nativeModule: Record<string, unknown> | null): NativeWindowManagerLike | null {
  const defaultExport = toRecord(nativeModule?.default)
  const manager = toRecord(nativeModule?.windowManager) ?? toRecord(defaultExport?.windowManager) ?? defaultExport ?? nativeModule
  return manager as NativeWindowManagerLike | null
}

function toNativeWindowSummary(value: unknown): NativeWindowSummary | null {
  const record = toRecord(value)
  if (!record) return null
  const hwnd = Number(record.handle ?? record.hwnd ?? record.id)
  if (!Number.isInteger(hwnd) || hwnd <= 0) return null
  const titleCandidate = record.title
  const getTitle = record.getTitle
  const title = typeof titleCandidate === 'string'
    ? titleCandidate
    : typeof getTitle === 'function'
      ? String(getTitle.call(value))
      : ''
  return {
    hwnd,
    title,
    processId: Number.isInteger(Number(record.processId)) ? Number(record.processId) : undefined
  }
}

export class NodeWindowManagerAdapter {
  async listWindows(): Promise<ServiceResult<NativeWindowSummary[]>> {
    const nativeModule = toRecord(await importOptionalNativeModule('node-window-manager'))
    const manager = resolveWindowManager(nativeModule)
    const getWindows = manager?.getWindows

    if (typeof getWindows !== 'function') return { success: false, error: 'NODE_WINDOW_MANAGER_UNAVAILABLE' }

    try {
      const windows = Array.isArray(getWindows.call(manager)) ? getWindows.call(manager) as unknown[] : []
      return { success: true, data: windows.map(toNativeWindowSummary).filter((item): item is NativeWindowSummary => item !== null) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getActiveWindow(): Promise<ServiceResult<NativeWindowSummary>> {
    const nativeModule = toRecord(await importOptionalNativeModule('node-window-manager'))
    const manager = resolveWindowManager(nativeModule)
    const getActiveWindow = manager?.getActiveWindow

    if (typeof getActiveWindow !== 'function') return { success: false, error: 'NODE_WINDOW_MANAGER_ACTIVE_WINDOW_UNAVAILABLE' }

    try {
      const activeWindow = toNativeWindowSummary(getActiveWindow.call(manager))
      if (!activeWindow) return { success: false, error: 'NODE_WINDOW_MANAGER_ACTIVE_WINDOW_UNAVAILABLE' }
      return { success: true, data: activeWindow }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async setAlwaysOnTop(hwnd: number, topmost: boolean): Promise<ServiceResult<{ hwnd: number; topmost: boolean }>> {
    const parsed = hwndSchema.safeParse(hwnd)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_HWND' }
    return { success: false, error: `NODE_WINDOW_MANAGER_TOPMOST_NOT_SUPPORTED:${topmost}` }
  }
}
