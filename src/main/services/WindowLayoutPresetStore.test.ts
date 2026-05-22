import { describe, expect, it, vi } from 'vitest'
import type Store from 'electron-store'
import type { ServiceResult, WindowInfo } from '@shared/types-extended'
import type { WindowLayoutPreset } from '@shared/schemas/r8-runtime'
import { WindowGroupResolver } from './WindowGroupResolver'
import { WindowLayoutPresetStore } from './WindowLayoutPresetStore'

class MemoryPresetStore {
  private presets: WindowLayoutPreset[] = []

  get(key: 'presets', fallback: WindowLayoutPreset[]): WindowLayoutPreset[] {
    return key === 'presets' ? this.presets : fallback
  }

  set(key: 'presets', value: WindowLayoutPreset[]): void {
    if (key === 'presets') this.presets = value
  }
}

function createWindow(): WindowInfo {
  return {
    hwnd: 501,
    title: 'DevHub Main',
    processName: 'DevHub.exe',
    pid: 9001,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 0, y: 0, width: 1200, height: 800 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false
  }
}

describe('WindowLayoutPresetStore', () => {
  it('saves, lists, and applies real window move operations by group key', async () => {
    const windowInfo = createWindow()
    const groupKey = new WindowGroupResolver().resolveFingerprint(windowInfo, 0).fingerprintHash
    const moveWindow = vi.fn(async (): Promise<ServiceResult> => ({ success: true }))
    const runtime = {
      scanWindows: vi.fn(async (): Promise<ServiceResult<WindowInfo[]>> => ({ success: true, data: [windowInfo] })),
      moveWindow
    }
    const store = new WindowLayoutPresetStore(runtime, {}, new MemoryPresetStore() as unknown as Store<{ presets: WindowLayoutPreset[] }>)

    const saved = store.save({
      name: 'debug layout',
      windows: [{
        groupKey,
        desktopId: null,
        monitorId: 0,
        bounds: { x: 10, y: 20, width: 640, height: 480 },
        alwaysOnTop: false
      }],
      popouts: [],
      createdAt: 1
    })
    const applied = await store.apply('debug layout')

    expect(saved.preset.name).toBe('debug layout')
    expect(store.list()).toEqual({ presets: ['debug layout'] })
    expect(applied).toMatchObject({ ok: true, applied: [{ groupKey, hwnd: 501 }], failed: [] })
    expect(moveWindow).toHaveBeenCalledWith(501, 10, 20, 640, 480)
  })
})
