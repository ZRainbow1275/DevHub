import Store from 'electron-store'
import {
  windowLayoutApplyResponseSchema,
  windowLayoutListResponseSchema,
  windowLayoutPresetSchema,
  windowLayoutSaveResponseSchema,
  type WindowLayoutApplyResponse,
  type WindowLayoutListResponse,
  type WindowLayoutPreset,
  type WindowLayoutSaveResponse
} from '@shared/schemas/r8-runtime'
import type { ServiceResult, WindowInfo } from '@shared/types-extended'
import { WindowGroupResolver } from './WindowGroupResolver'

interface WindowLayoutPresetStoreShape {
  presets: WindowLayoutPreset[]
}

interface WindowLayoutApplyTarget {
  hwnd: number
  rect: WindowInfo['rect']
  desktopId: string | null
}

export interface WindowLayoutPresetRuntime {
  scanWindows(includeSystemWindows?: boolean): Promise<ServiceResult<WindowInfo[]>>
  moveWindow(hwnd: number, x: number, y: number, width: number, height: number): Promise<ServiceResult>
}

export interface WindowLayoutPresetStoreOptions {
  moveWindowToDesktop?: (hwnd: number, desktopId: string) => Promise<ServiceResult<unknown>>
}

function sanitizeName(name: string): string {
  return name.trim()
}

export class WindowLayoutPresetStore {
  private readonly store: Store<WindowLayoutPresetStoreShape>
  private readonly resolver = new WindowGroupResolver()

  constructor(
    private readonly runtime: WindowLayoutPresetRuntime,
    private readonly options: WindowLayoutPresetStoreOptions = {},
    store?: Store<WindowLayoutPresetStoreShape>
  ) {
    this.store = store ?? new Store<WindowLayoutPresetStoreShape>({
      name: 'devhub-window-layout-presets',
      defaults: { presets: [] }
    })
  }

  save(input: unknown): WindowLayoutSaveResponse {
    const preset = windowLayoutPresetSchema.parse({
      ...windowLayoutPresetSchema.parse(input),
      name: sanitizeName(windowLayoutPresetSchema.parse(input).name)
    })
    const presets = this.listPresets().filter(item => item.name !== preset.name)
    presets.push(preset)
    this.store.set('presets', presets)
    return windowLayoutSaveResponseSchema.parse({ preset, savedAt: Date.now() })
  }

  list(): WindowLayoutListResponse {
    return windowLayoutListResponseSchema.parse({ presets: this.listPresets().map(preset => preset.name) })
  }

  get(name: string): WindowLayoutPreset | null {
    const normalized = sanitizeName(name)
    return this.listPresets().find(preset => preset.name === normalized) ?? null
  }

  async apply(name: string): Promise<WindowLayoutApplyResponse> {
    const preset = this.get(name)
    if (!preset) {
      return windowLayoutApplyResponseSchema.parse({
        ok: false,
        applied: [],
        failed: [{ groupKey: name, error: 'E_PRESET_NOT_FOUND' }]
      })
    }

    const scanResult = await this.runtime.scanWindows(false)
    const liveWindows = scanResult.data ?? []
    const targets = this.resolveTargets(preset, liveWindows)
    const applied: WindowLayoutApplyResponse['applied'] = []
    const failed: WindowLayoutApplyResponse['failed'] = []

    for (const target of targets.matched) {
      const moveResult = await this.runtime.moveWindow(target.hwnd, target.rect.x, target.rect.y, target.rect.width, target.rect.height)
      if (!moveResult.success) {
        failed.push({ groupKey: target.groupKey, hwnd: target.hwnd, error: moveResult.error ?? 'E_MOVE_FAILED' })
        continue
      }
      if (target.desktopId && this.options.moveWindowToDesktop) {
        const desktopResult = await this.options.moveWindowToDesktop(target.hwnd, target.desktopId)
        if (!desktopResult.success) {
          failed.push({ groupKey: target.groupKey, hwnd: target.hwnd, error: desktopResult.error ?? 'E_DESKTOP_MOVE_FAILED' })
          continue
        }
      }
      applied.push({ groupKey: target.groupKey, hwnd: target.hwnd })
    }

    for (const missing of targets.missing) {
      failed.push({ groupKey: missing, error: 'E_WINDOW_NOT_FOUND' })
    }

    return windowLayoutApplyResponseSchema.parse({
      ok: failed.length === 0,
      applied,
      failed
    })
  }

  private listPresets(): WindowLayoutPreset[] {
    return this.store.get('presets', []).map(preset => windowLayoutPresetSchema.parse(preset))
  }

  private resolveTargets(preset: WindowLayoutPreset, liveWindows: readonly WindowInfo[]): {
    matched: Array<WindowLayoutApplyTarget & { groupKey: string }>
    missing: string[]
  } {
    const byGroupKey = new Map<string, WindowInfo>()
    liveWindows.forEach((windowInfo, index) => {
      const fingerprint = this.resolver.resolveFingerprint(windowInfo, index)
      if (!byGroupKey.has(fingerprint.fingerprintHash)) {
        byGroupKey.set(fingerprint.fingerprintHash, windowInfo)
      }
    })

    const matched: Array<WindowLayoutApplyTarget & { groupKey: string }> = []
    const missing: string[] = []
    for (const windowPreset of preset.windows) {
      const liveWindow = byGroupKey.get(windowPreset.groupKey)
      if (!liveWindow) {
        missing.push(windowPreset.groupKey)
        continue
      }
      matched.push({
        groupKey: windowPreset.groupKey,
        hwnd: liveWindow.hwnd,
        rect: windowPreset.bounds,
        desktopId: windowPreset.desktopId
      })
    }
    return { matched, missing }
  }
}
