import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS_EXT, WindowInfo, WindowGroup, WindowLayout, ServiceResult } from '@shared/types-extended'
import { WindowManager } from '../services/WindowManager'
import { validateHwnd, validateString, validateHwndArray } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { z } from 'zod'

// Zod schemas for window IPC input validation
const hwndSchema = z.number().int().positive()
const stringSchema = z.string().min(1).max(200)
const hwndArraySchema = z.array(z.number().int().positive()).max(100)
const opacitySchema = z.number().min(0).max(100)
const coordinateSchema = z.number().finite()

let windowManager: WindowManager | null = null

export function setupWindowHandlers(_mainWindow: BrowserWindow): void {
  windowManager = new WindowManager()

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SCAN, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SCAN, RATE_LIMITS.SCAN,
    async (_, includeSystemWindows?: boolean): Promise<ServiceResult<WindowInfo[]>> => {
      if (!windowManager) return { success: false, data: [], error: 'Window manager not initialized' }
      return windowManager.scanWindows(includeSystemWindows ?? false)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_FOCUS, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_FOCUS, RATE_LIMITS.ACTION,
    async (_, hwnd: number): Promise<ServiceResult> => {
      const parsed = hwndSchema.safeParse(hwnd)
      if (!parsed.success) return { success: false, error: 'Invalid hwnd: must be a positive integer' }
      validateHwnd(hwnd)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.focusWindow(hwnd)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_FOCUS_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_FOCUS_GROUP, RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.focusWindowGroup(groupId)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_MOVE, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_MOVE, RATE_LIMITS.ACTION,
    async (_, hwnd: number, x: number, y: number, width: number, height: number): Promise<ServiceResult> => {
      const moveSchema = z.object({
        hwnd: hwndSchema,
        x: coordinateSchema,
        y: coordinateSchema,
        width: coordinateSchema,
        height: coordinateSchema,
      })
      const parsed = moveSchema.safeParse({ hwnd, x, y, width, height })
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        return { success: false, error: `Invalid ${String(issue?.path[0] ?? 'input')}: must be a finite number` }
      }
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.moveWindow(hwnd, x, y, width, height)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_MINIMIZE, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_MINIMIZE, RATE_LIMITS.ACTION,
    async (_, hwnd: number): Promise<ServiceResult> => {
      validateHwnd(hwnd)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.minimizeWindow(hwnd)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_MAXIMIZE, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_MAXIMIZE, RATE_LIMITS.ACTION,
    async (_, hwnd: number): Promise<ServiceResult> => {
      validateHwnd(hwnd)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.maximizeWindow(hwnd)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_CLOSE, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_CLOSE, RATE_LIMITS.ACTION,
    async (_, hwnd: number): Promise<ServiceResult> => {
      validateHwnd(hwnd)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.closeWindow(hwnd)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_CREATE_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_CREATE_GROUP, RATE_LIMITS.ACTION,
    async (_, name: string, windowHwnds: number[], projectId?: string): Promise<WindowGroup | null> => {
      const groupSchema = z.object({
        name: stringSchema,
        windowHwnds: hwndArraySchema,
        projectId: stringSchema.optional(),
      })
      groupSchema.parse({ name, windowHwnds, projectId })
      if (!windowManager) return null
      return windowManager.createGroup(name, windowHwnds, projectId)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_GET_GROUPS, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_GET_GROUPS, RATE_LIMITS.QUERY,
    async (): Promise<WindowGroup[]> => {
      if (!windowManager) return []
      return windowManager.getGroups()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_REMOVE_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_REMOVE_GROUP, RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<boolean> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return false
      return windowManager.removeGroup(groupId)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SAVE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SAVE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, name: string, description?: string): Promise<WindowLayout | null> => {
      validateString(name, 'name')
      if (description !== undefined) {
        validateString(description, 'description', 1000)
      }
      if (!windowManager) return null
      return windowManager.saveLayout(name, description)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, layoutId: string): Promise<ServiceResult> => {
      validateString(layoutId, 'layoutId')
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.restoreLayout(layoutId)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_GET_LAYOUTS, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_GET_LAYOUTS, RATE_LIMITS.QUERY,
    async (): Promise<WindowLayout[]> => {
      if (!windowManager) return []
      return windowManager.getLayouts()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_REMOVE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_REMOVE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, layoutId: string): Promise<boolean> => {
      validateString(layoutId, 'layoutId')
      if (!windowManager) return false
      return windowManager.removeLayout(layoutId)
    }
  ))

  ipcMain.handle('window:minimize-group', withRateLimit(
    'window:minimize-group', RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.minimizeGroup(groupId)
    }
  ))

  ipcMain.handle('window:close-group', withRateLimit(
    'window:close-group', RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.closeGroup(groupId)
    }
  ))

  ipcMain.handle('window:filter-dev', withRateLimit(
    'window:filter-dev', RATE_LIMITS.SCAN,
    async (): Promise<ServiceResult<WindowInfo[]>> => {
      if (!windowManager) return { success: false, data: [], error: 'Window manager not initialized' }
      const scanResult = await windowManager.scanWindows()
      const allWindows = scanResult.data ?? []
      return { success: true, data: windowManager.filterDevWindows(allWindows) }
    }
  ))

  // ==================== New Window Operations ====================

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE, RATE_LIMITS.ACTION,
    async (_, hwnd: number): Promise<ServiceResult> => {
      validateHwnd(hwnd)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.restoreWindow(hwnd)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SET_TOPMOST, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SET_TOPMOST, RATE_LIMITS.ACTION,
    async (_, hwnd: number, topmost: boolean): Promise<ServiceResult> => {
      const topmostSchema = z.object({ hwnd: hwndSchema, topmost: z.boolean() })
      const parsed = topmostSchema.safeParse({ hwnd, topmost })
      if (!parsed.success) {
        return { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` }
      }
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.setWindowTopmost(hwnd, topmost)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SET_OPACITY, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SET_OPACITY, RATE_LIMITS.ACTION,
    async (_, hwnd: number, opacity: number): Promise<ServiceResult> => {
      const opacityInputSchema = z.object({ hwnd: hwndSchema, opacity: opacitySchema })
      const parsed = opacityInputSchema.safeParse({ hwnd, opacity })
      if (!parsed.success) {
        return { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` }
      }
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.setWindowOpacity(hwnd, opacity)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SEND_KEYS, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SEND_KEYS, RATE_LIMITS.ACTION,
    async (_, hwnd: number, keys: string): Promise<ServiceResult> => {
      const keysSchema = z.object({ hwnd: hwndSchema, keys: z.string().min(1).max(50) })
      keysSchema.parse({ hwnd, keys })
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.sendKeysToWindow(hwnd, keys)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_TILE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_TILE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, hwnds: number[]): Promise<ServiceResult> => {
      validateHwndArray(hwnds)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.tileWindows(hwnds)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_CASCADE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_CASCADE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, hwnds: number[]): Promise<ServiceResult> => {
      validateHwndArray(hwnds)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.cascadeWindows(hwnds)
    }
  ))

  ipcMain.handle('window:stack-layout', withRateLimit(
    'window:stack-layout', RATE_LIMITS.ACTION,
    async (_, hwnds: number[]): Promise<ServiceResult> => {
      validateHwndArray(hwnds)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.stackWindows(hwnds)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_MINIMIZE_ALL, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_MINIMIZE_ALL, RATE_LIMITS.ACTION,
    async (): Promise<ServiceResult> => {
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.minimizeAll()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE_ALL, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE_ALL, RATE_LIMITS.ACTION,
    async (): Promise<ServiceResult> => {
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.restoreAll()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_ADD_TO_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_ADD_TO_GROUP, RATE_LIMITS.ACTION,
    async (_, groupId: string, hwnd: number): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      validateHwnd(hwnd)
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.addToGroup(groupId, hwnd)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE_GROUP, RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return { success: false, error: 'Window manager not initialized' }
      return windowManager.restoreGroup(groupId)
    }
  ))
}

export function cleanupWindowHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SCAN)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_FOCUS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_FOCUS_GROUP)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_MOVE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_MINIMIZE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_MAXIMIZE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_CLOSE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_CREATE_GROUP)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_GET_GROUPS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_REMOVE_GROUP)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SAVE_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_GET_LAYOUTS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_REMOVE_LAYOUT)
  ipcMain.removeHandler('window:minimize-group')
  ipcMain.removeHandler('window:close-group')
  ipcMain.removeHandler('window:filter-dev')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SET_TOPMOST)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SET_OPACITY)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SEND_KEYS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_TILE_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_CASCADE_LAYOUT)
  ipcMain.removeHandler('window:stack-layout')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_MINIMIZE_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_ADD_TO_GROUP)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE_GROUP)
}

export function getWindowManager(): WindowManager | null {
  return windowManager
}
