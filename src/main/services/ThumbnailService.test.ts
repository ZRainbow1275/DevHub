import { describe, expect, it, vi } from 'vitest'
import type { AIWindowAlias, MonitorInfo, ServiceResult, WindowInfo } from '@shared/types-extended'
import type { ThumbnailAliasManager } from './WindowGroupResolver'

vi.mock('electron', () => ({
  desktopCapturer: null
}))

import { ThumbnailService, thumbnailServiceInternals, type ThumbnailVirtualDesktopProvider, type ThumbnailWindowManager } from './ThumbnailService'

const PNG_DATA_URL = `data:image/png;base64,${Buffer.from('real-png-bytes').toString('base64')}`

function createWindow(overrides: Partial<WindowInfo> = {}): WindowInfo {
  return {
    hwnd: 501,
    title: 'DevHub Main',
    processName: 'DevHub.exe',
    pid: 9001,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 0, y: 0, width: 1200, height: 800 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false,
    ...overrides
  }
}

function createManager(windows: WindowInfo[], options: { cachedWindows?: WindowInfo[] } = {}): ThumbnailWindowManager {
  const monitor: MonitorInfo = {
    id: 1,
    label: 'Primary',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
    primary: true
  }
  return {
    scanWindows: vi.fn(async (): Promise<ServiceResult<WindowInfo[]>> => ({ success: true, data: windows })),
    getMonitorInfo: vi.fn(() => [monitor]),
    ...(options.cachedWindows ? { getCachedWindows: vi.fn(() => options.cachedWindows ?? []) } : {})
  }
}

function createCapturer() {
  return {
    getSources: vi.fn(async () => [
      {
        id: 'window:501:0',
        name: 'DevHub Main',
        thumbnail: {
          isEmpty: () => false,
          toDataURL: () => PNG_DATA_URL
        }
      }
    ])
  }
}

class FakeAliasManager implements ThumbnailAliasManager {
  readonly aliases: AIWindowAlias[] = []

  getAll(): AIWindowAlias[] {
    return [...this.aliases]
  }

  set(alias: AIWindowAlias): boolean {
    const index = this.aliases.findIndex(item => item.id === alias.id)
    if (index >= 0) this.aliases[index] = alias
    else this.aliases.push(alias)
    return true
  }
}

describe('R8.B ThumbnailService', () => {
  it('parses Windows desktopCapturer source ids into HWND values', () => {
    expect(thumbnailServiceInternals.parseDesktopSourceHwnd('window:501:0')).toBe(501)
    expect(thumbnailServiceInternals.parseDesktopSourceHwnd('window:0x1f5:0')).toBe(501)
    expect(thumbnailServiceInternals.parseDesktopSourceHwnd('screen:1:0')).toBeNull()
  })

  it('captures real Electron window thumbnails through executable desktopCapturer data URLs', async () => {
    const capturer = createCapturer()
    const service = new ThumbnailService(createManager([createWindow()]), { capturer, win32Capturer: null })

    const response = await service.captureBatch({
      hwnds: [501],
      maxAgeMs: 5000,
      thumbnailSize: { width: 240, height: 160 }
    })

    expect(response.source).toBe('electron-desktop-capturer')
    expect(response.captured).toBe(1)
    expect(response.failed).toBe(0)
    expect(response.entries[0]).toMatchObject({
      hwnd: 501,
      thumbnailDataUrl: PNG_DATA_URL,
      isStale: false,
      monitorId: 0,
      desktopId: null
    })
    expect(capturer.getSources).toHaveBeenCalledWith({
      types: ['window'],
      thumbnailSize: { width: 240, height: 160 },
      fetchWindowIcons: false
    })
  })

  it('prefers the Win32 PrintWindow provider before the Electron desktopCapturer fallback', async () => {
    const capturer = createCapturer()
    const service = new ThumbnailService(createManager([createWindow()]), {
      capturer,
      win32Capturer: {
        capture: vi.fn(async () => ({
          capturedAt: Date.now(),
          dataUrl: PNG_DATA_URL,
          height: 160,
          width: 240
        }))
      }
    })

    const response = await service.captureBatch({
      hwnds: [501],
      maxAgeMs: 0,
      thumbnailSize: { width: 240, height: 160 }
    })

    expect(response.source).toBe('win32-printwindow')
    expect(response.captured).toBe(1)
    expect(capturer.getSources).not.toHaveBeenCalled()
  })

  it('adds desktop ids from the injected virtual desktop provider', async () => {
    const provider: ThumbnailVirtualDesktopProvider = {
      getWindowInfo: vi.fn(async (_hwnds, monitorIdByHwnd) => ({
        info: [{
          hwnd: 501,
          desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0',
          monitorId: monitorIdByHwnd?.get(501) ?? 0,
          isOnCurrentDesktop: true
        }]
      }))
    }
    const service = new ThumbnailService(createManager([createWindow()]), {
      capturer: createCapturer(),
      virtualDesktopProvider: provider,
      win32Capturer: null
    })

    const response = await service.captureBatch({
      hwnds: [501],
      maxAgeMs: 0,
      thumbnailSize: { width: 240, height: 160 }
    })

    expect(response.entries[0]?.desktopId).toBe('2439fd36-4943-43b0-aa9a-61dbf165add0')
    expect(provider.getWindowInfo).toHaveBeenCalledWith([501], expect.any(Map))
  })

  it('reuses fresh virtual desktop metadata during rapid thumbnail refreshes', async () => {
    const provider: ThumbnailVirtualDesktopProvider = {
      getWindowInfo: vi.fn(async () => ({
        info: [{
          hwnd: 501,
          desktopId: '2439fd36-4943-43b0-aa9a-61dbf165add0',
          monitorId: 0,
          isOnCurrentDesktop: true
        }]
      }))
    }
    const win32Capturer = {
      capture: vi.fn(async () => ({
        capturedAt: Date.now(),
        dataUrl: PNG_DATA_URL,
        height: 160,
        width: 240
      }))
    }
    const service = new ThumbnailService(createManager([createWindow()]), {
      capturer: createCapturer(),
      virtualDesktopProvider: provider,
      win32Capturer
    })

    await service.captureBatch({ hwnds: [501], maxAgeMs: 0, thumbnailSize: { width: 240, height: 160 } })
    const response = await service.captureBatch({ hwnds: [501], maxAgeMs: 0, thumbnailSize: { width: 240, height: 160 } })

    expect(response.entries[0]?.desktopId).toBe('2439fd36-4943-43b0-aa9a-61dbf165add0')
    expect(provider.getWindowInfo).toHaveBeenCalledTimes(1)
    expect(win32Capturer.capture).toHaveBeenCalled()
  })

  it('reuses the latest WindowManager cache when all requested HWNDs are already known', async () => {
    const manager = createManager([], { cachedWindows: [createWindow()] })
    const service = new ThumbnailService(manager, {
      capturer: createCapturer(),
      win32Capturer: {
        capture: vi.fn(async () => ({
          capturedAt: Date.now(),
          dataUrl: PNG_DATA_URL,
          height: 160,
          width: 240
        }))
      }
    })

    const response = await service.captureBatch({
      hwnds: [501],
      maxAgeMs: 0,
      thumbnailSize: { width: 240, height: 160 }
    })

    expect(response.source).toBe('win32-printwindow')
    expect(response.captured).toBe(1)
    expect(manager.scanWindows).not.toHaveBeenCalled()
  })

  it('uses bounded cache hits instead of recapturing fresh thumbnails', async () => {
    const capturer = createCapturer()
    const service = new ThumbnailService(createManager([createWindow()]), { capturer, win32Capturer: null })

    await service.captureBatch({ hwnds: [501], maxAgeMs: 5000, thumbnailSize: { width: 240, height: 160 } })
    const response = await service.captureBatch({ hwnds: [501], maxAgeMs: 5000, thumbnailSize: { width: 240, height: 160 } })

    expect(response.source).toBe('cache')
    expect(response.cacheHits).toBe(1)
    expect(capturer.getSources).toHaveBeenCalledTimes(1)
  })

  it('persists wall aliases through the shared alias manager and exposes grouped identities', async () => {
    const aliasManager = new FakeAliasManager()
    const service = new ThumbnailService(createManager([createWindow()]), {
      capturer: createCapturer(),
      win32Capturer: null,
      aliasManager
    })

    const aliasResponse = await service.setAlias({ hwnd: 501, alias: 'Primary DevHub', confirmedBy: 'test' })
    const groups = await service.listGroups()

    expect(aliasResponse).toMatchObject({ success: true, hwnd: 501, alias: 'Primary DevHub' })
    expect(aliasManager.aliases[0]).toMatchObject({ alias: 'Primary DevHub', matchCriteria: { pid: 9001, toolType: 'other' } })
    expect(groups.groups[0]).toMatchObject({ alias: 'Primary DevHub', members: [501] })
  })
})
