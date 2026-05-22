import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WindowInfo } from '@shared/types-extended'
import type { Win32WindowEnumeratorLike } from './integrations/Win32WindowEnumerator'

const storeData: Record<string, unknown> = { layouts: [], groups: [], layoutSnapshots: [], restorePoints: [] }

vi.mock('electron-store', () => ({
  default: class StoreMock {
    get(key: string, defaultValue: unknown) {
      return storeData[key] ?? defaultValue
    }

    set(key: string, value: unknown) {
      storeData[key] = value
    }
  }
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:/Users/HP/AppData/Roaming/DevHubTest')
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      id: 1,
      label: 'Primary',
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
      workAreaSize: { width: 1200, height: 800 },
      workArea: { x: 0, y: 0, width: 1200, height: 800 },
      scaleFactor: 1
    })),
    getAllDisplays: vi.fn(() => [{
      id: 1,
      label: 'Primary',
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
      workArea: { x: 0, y: 0, width: 1200, height: 800 },
      workAreaSize: { width: 1200, height: 800 },
      scaleFactor: 1
    }])
  },
  shell: {
    openPath: vi.fn(async () => '')
  }
}))

import { WindowManager } from './WindowManager'

function createDisabledWin32Enumerator(): Win32WindowEnumeratorLike {
  return {
    enumerateVisibleWindows: vi.fn(async () => ({
      success: false,
      data: [],
      error: 'WIN32_NATIVE_UNSUPPORTED_PLATFORM'
    }))
  }
}

function createWindow(overrides: Partial<WindowInfo> = {}): WindowInfo {
  return {
    hwnd: 1001,
    title: 'Claude Code - D:/repo/devhub',
    processName: 'node',
    pid: 4321,
    className: 'ConsoleWindowClass',
    rect: { x: 10, y: 20, width: 800, height: 600 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false,
    ...overrides
  }
}

function createManager(): WindowManager {
  return new WindowManager({ execute: vi.fn() } as never, createDisabledWin32Enumerator())
}

describe('WindowManager group persistence', () => {
  beforeEach(() => {
    storeData.layouts = []
    storeData.groups = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists fingerprints and resolves a restarted window to its new hwnd', () => {
    const firstManager = createManager()
    const originalWindow = createWindow({ hwnd: 101, pid: 9001 })
    ;(firstManager as unknown as { windows: Map<number, WindowInfo> }).windows.set(originalWindow.hwnd, originalWindow)

    const group = firstManager.createGroup('AI 工作', [originalWindow.hwnd])
    expect(group.memberFingerprints).toHaveLength(1)
    ;(firstManager as unknown as { saveToDisk: () => void }).saveToDisk()

    const secondManager = createManager()
    const restartedWindow = createWindow({ hwnd: 202, pid: 9102 })
    ;(secondManager as unknown as { windows: Map<number, WindowInfo> }).windows.set(restartedWindow.hwnd, restartedWindow)

    const restoredGroups = secondManager.getGroups()

    expect(restoredGroups).toHaveLength(1)
    expect(restoredGroups[0]).toMatchObject({ name: 'AI 工作' })
    expect(restoredGroups[0].windows.map(windowInfo => windowInfo.hwnd)).toEqual([202])
    expect(restoredGroups[0].resolutionReport?.matched[0]).toMatchObject({ hwnd: 202 })
    expect(restoredGroups[0].resolutionReport?.unmatched).toEqual([])
  })

  it('routes group actions through resolved hwnds instead of stale persisted hwnds', async () => {
    const manager = createManager()
    const originalWindow = createWindow({ hwnd: 101, pid: 9001 })
    ;(manager as unknown as { windows: Map<number, WindowInfo> }).windows.set(originalWindow.hwnd, originalWindow)
    const group = manager.createGroup('后端组', [originalWindow.hwnd])
    ;(manager as unknown as { saveToDisk: () => void }).saveToDisk()

    const restartedManager = createManager()
    const restartedWindow = createWindow({ hwnd: 303, pid: 9103 })
    ;(restartedManager as unknown as { windows: Map<number, WindowInfo> }).windows.set(restartedWindow.hwnd, restartedWindow)
    const restoreWindow = vi.spyOn(restartedManager, 'restoreWindow').mockResolvedValue({ success: true })

    const result = await restartedManager.restoreGroup(group.id)

    expect(result.success).toBe(true)
    expect(restoreWindow).toHaveBeenCalledWith(303)
    expect(restoreWindow).not.toHaveBeenCalledWith(101)
  })

  it('renames groups and rejects duplicate names without mutating the existing group', () => {
    const manager = createManager()
    const firstWindow = createWindow({ hwnd: 111, title: 'Codex - frontend' })
    const secondWindow = createWindow({ hwnd: 222, title: 'Codex - backend' })
    ;(manager as unknown as { windows: Map<number, WindowInfo> }).windows.set(firstWindow.hwnd, firstWindow)
    ;(manager as unknown as { windows: Map<number, WindowInfo> }).windows.set(secondWindow.hwnd, secondWindow)
    const first = manager.createGroup('前端组', [firstWindow.hwnd])
    manager.createGroup('后端组', [secondWindow.hwnd])

    expect(manager.renameGroup(first.id, '客户端组')).toEqual({ success: true })
    expect(manager.getGroups().find(group => group.id === first.id)?.name).toBe('客户端组')

    const duplicate = manager.renameGroup(first.id, '后端组')

    expect(duplicate.success).toBe(false)
    expect(duplicate.error).toBe('GROUP_NAME_DUPLICATE')
    expect(manager.getGroups().find(group => group.id === first.id)?.name).toBe('客户端组')
  })
  it('uses SetWindowPos for physical window moves', async () => {
    const execute = vi.fn().mockResolvedValue('')
    const manager = new WindowManager({ execute } as never)

    const result = await manager.moveWindow(404, 10, 20, 640, 480)

    expect(result.success).toBe(true)
    expect(execute).toHaveBeenCalledTimes(1)
    const [script, options] = execute.mock.calls[0]
    expect(script).toContain('SetWindowPos')
    expect(script).toContain('WIN32_SETPOS_FAILED')
    expect(options.label).toBe('window-manager:set-window-pos')
  })

  it('sends arbitrary text through SendInput after focusing the real HWND', async () => {
    const execute = vi.fn().mockResolvedValue('')
    const manager = new WindowManager({ execute } as never, createDisabledWin32Enumerator())

    const result = await manager.sendTextToWindow(777, "hello 中文 it's")

    expect(result).toEqual({ success: true, data: { characters: 13, mode: 'sendinput' } })
    expect(execute).toHaveBeenCalledTimes(1)
    const [script, options] = execute.mock.calls[0]
    expect(script).toContain('SendInput')
    expect(script).toContain('TextInputHelper')
    expect(script).toContain('SendUnicode')
    expect(script).toContain('[WindowHelper]::Focus([IntPtr]777)')
    expect(script).toContain("[TextInputHelper]::SendUnicode('hello 中文 it''s')")
    expect(options.label).toBe('window-manager:send-text-to-window')
  })

  it('falls back to WM_CHAR when SendInput fails', async () => {
    const execute = vi.fn()
      .mockRejectedValueOnce(new Error('sendinput unavailable'))
      .mockResolvedValueOnce('')
    const manager = new WindowManager({ execute } as never, createDisabledWin32Enumerator())

    const result = await manager.sendTextToWindow(778, 'fallback')

    expect(result).toEqual({ success: true, data: { characters: 8, mode: 'wm-char' } })
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[1][0]).toContain('[WindowHelper]::SendText([IntPtr]778,')
    expect(execute.mock.calls[1][1].label).toBe('window-manager:send-text-to-window-fallback')
  })

  it('focuses multiple HWNDs through one PowerShell helper invocation', async () => {
    const execute = vi.fn().mockResolvedValue(['701|ok', '702|failed|blocked'].join('\n'))
    const manager = new WindowManager({ execute } as never, createDisabledWin32Enumerator())

    const result = await manager.focusWindows([701, 702], 25)

    expect(result).toEqual([
      { hwnd: 701, result: { success: true } },
      { hwnd: 702, result: { success: false, error: 'blocked' } }
    ])
    expect(execute).toHaveBeenCalledTimes(1)
    const [script, options] = execute.mock.calls[0]
    expect(script).toContain('$hwnds = @(701,702)')
    expect(script).toContain('[WindowHelper]::Focus([IntPtr]$hwnd)')
    expect(script).toContain('Start-Sleep -Milliseconds 25')
    expect(options.label).toBe('window-manager:focus-windows')
  })

  it('parses mocked EnumWindows/GetWindowTextW output into real WindowInfo rows', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([
        '6001|Cursor - Editing main.ts|Chrome_WidgetWin_1|7101|10|20|800|600|0',
        '6002|Visual Studio Code - main.ts (Copilot suggesting)|Chrome_WidgetWin_1|7102|30|40|1024|768|1'
      ].join('\n'))
      .mockResolvedValueOnce([
        '"Id","ProcessName"',
        '"7101","cursor"',
        '"7102","Code"'
      ].join('\n'))
    const manager = new WindowManager({ execute } as never, createDisabledWin32Enumerator())

    const result = await manager.scanWindows(false)

    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      expect.objectContaining({
        hwnd: 6001,
        title: 'Cursor - Editing main.ts',
        processName: 'cursor',
        pid: 7101,
        className: 'Chrome_WidgetWin_1',
        rect: { x: 10, y: 20, width: 800, height: 600 },
        isVisible: true,
        isMinimized: false,
        isSystemWindow: false
      }),
      expect.objectContaining({
        hwnd: 6002,
        title: 'Visual Studio Code - main.ts (Copilot suggesting)',
        processName: 'Code',
        pid: 7102,
        rect: { x: 30, y: 40, width: 1024, height: 768 },
        isMinimized: true
      })
    ])
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0][0]).toContain('EnumWindows')
    expect(execute.mock.calls[0][0]).toContain('GetWindowText')
    expect(execute.mock.calls[1][0]).toContain('Get-Process -Id 7101,7102')
  })

  it('prefers direct Koffi EnumWindows/GetWindowTextW snapshots before PowerShell fallback', async () => {
    const execute = vi.fn().mockResolvedValue([
      '"Id","ProcessName"',
      '"7103","cursor"'
    ].join('\n'))
    const nativeEnumerator: Win32WindowEnumeratorLike = {
      enumerateVisibleWindows: vi.fn(async () => ({
        success: true,
        data: [{
          hwnd: 6003,
          title: 'Cursor - Editing native.ts',
          className: 'Chrome_WidgetWin_1',
          pid: 7103,
          x: 100,
          y: 120,
          width: 900,
          height: 700,
          isMinimized: false
        }]
      }))
    }
    const manager = new WindowManager({ execute } as never, nativeEnumerator)

    const result = await manager.scanWindows(false)

    expect(result.success).toBe(true)
    expect(nativeEnumerator.enumerateVisibleWindows).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][0]).toContain('Get-Process -Id 7103')
    expect(execute.mock.calls[0][0]).not.toContain('[WindowEnumerator]::GetWindows')
    expect(result.data).toEqual([
      expect.objectContaining({
        hwnd: 6003,
        title: 'Cursor - Editing native.ts',
        processName: 'cursor',
        pid: 7103,
        className: 'Chrome_WidgetWin_1',
        rect: { x: 100, y: 120, width: 900, height: 700 },
        isVisible: true,
        isMinimized: false,
        isSystemWindow: false
      })
    ])
  })

  it('saves a restore point before applying tile layout and restores previous positions', async () => {
    const manager = createManager()
    const originalWindow = createWindow({ hwnd: 101, rect: { x: 10, y: 20, width: 800, height: 600 } })
    const movedWindow = createWindow({ hwnd: 101, rect: { x: 0, y: 0, width: 600, height: 400 } })
    const scanWindows = vi.spyOn(manager, 'scanWindows')
      .mockResolvedValueOnce({ success: true, data: [originalWindow] })
      .mockResolvedValueOnce({ success: true, data: [movedWindow] })
      .mockResolvedValueOnce({ success: true, data: [movedWindow] })
    const moveWindow = vi.spyOn(manager, 'moveWindow').mockResolvedValue({ success: true })

    const applied = await manager.applyLayout({ preset: 'tile-2x2', hwnds: [101], saveRestorePoint: true })

    expect(applied.ok).toBe(true)
    expect(applied.restorePointId).toMatch(/^restore_/)
    expect(moveWindow).toHaveBeenCalledWith(101, 0, 0, 600, 400)

    const restored = await manager.restorePrevious()

    expect(restored.ok).toBe(true)
    expect(moveWindow).toHaveBeenLastCalledWith(101, 10, 20, 800, 600)
    expect(scanWindows).toHaveBeenCalledTimes(3)
  })

  it('persists favorite window records by fingerprint and toggles them off', () => {
    const manager = createManager()
    const targetWindow = createWindow({ hwnd: 707, title: 'DevHub - Window Ops', processName: 'DevHub.exe', pid: 7707 })
    ;(manager as unknown as { windows: Map<number, WindowInfo> }).windows.set(targetWindow.hwnd, targetWindow)

    const added = manager.toggleFavorite(targetWindow.hwnd)

    expect(added.success).toBe(true)
    expect(added.data?.favorite).toBe(true)
    expect(manager.getFavorites()).toHaveLength(1)
    ;(manager as unknown as { saveToDisk: () => void }).saveToDisk()

    const restoredManager = createManager()
    expect(restoredManager.getFavorites()).toHaveLength(1)

    ;(restoredManager as unknown as { windows: Map<number, WindowInfo> }).windows.set(targetWindow.hwnd, targetWindow)
    const removed = restoredManager.toggleFavorite(targetWindow.hwnd)

    expect(removed.success).toBe(true)
    expect(removed.data?.favorite).toBe(false)
    expect(restoredManager.getFavorites()).toHaveLength(0)
  })

  it('captures a real window screenshot command to a persistent PNG path', async () => {
    const execute = vi.fn().mockResolvedValue('')
    const manager = new WindowManager({ execute } as never)
    const targetWindow = createWindow({ hwnd: 808, rect: { x: 11, y: 22, width: 333, height: 222 } })
    ;(manager as unknown as { windows: Map<number, WindowInfo> }).windows.set(targetWindow.hwnd, targetWindow)

    const result = await manager.screenshotWindow(targetWindow.hwnd)

    expect(result.success).toBe(true)
    expect(result.data?.path).toMatch(/window-808-\d+\.png$/)
    const [script, options] = execute.mock.calls[0]
    expect(script).toContain('CopyFromScreen(11, 22, 0, 0')
    expect(script).toContain('ImageFormat]::Png')
    expect(options.label).toBe('window-manager:screenshot-window')
  })

  it('opens the process executable directory for a window', async () => {
    const execute = vi.fn().mockResolvedValue('C:\\Program Files\\nodejs\\node.exe\n')
    const manager = new WindowManager({ execute } as never)
    const targetWindow = createWindow({ hwnd: 909, pid: 9909 })
    ;(manager as unknown as { windows: Map<number, WindowInfo> }).windows.set(targetWindow.hwnd, targetWindow)

    const result = await manager.openWorkingDirectory(targetWindow.hwnd)

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ hwnd: 909, pid: 9909, directory: 'C:\\Program Files\\nodejs' })
    const [script, options] = execute.mock.calls[0]
    expect(script).toContain('Win32_Process')
    expect(script).toContain('ProcessId = 9909')
    expect(options.label).toBe('window-manager:resolve-window-process-directory')
  })
})
