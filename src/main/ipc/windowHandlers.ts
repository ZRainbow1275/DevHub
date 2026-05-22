import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS_EXT, WindowInfo, WindowGroup, WindowLayout, ServiceResult, ApplyLayoutIntent, ApplyLayoutResult, WindowLayoutSnapshot, TilePreset, MonitorInfo, WindowFavoriteRecord, WindowFavoriteToggleResult, WindowOpenDirectoryResult, WindowScreenshotResult } from '@shared/types-extended'
import { WindowManager } from '../services/WindowManager'
import { WindowBatchExecutor } from '../services/WindowBatchExecutor'
import { ThumbnailService } from '../services/ThumbnailService'
import { MonitorService } from '../services/MonitorService'
import { VirtualDesktopService } from '../services/VirtualDesktopService'
import { WindowLayoutPresetStore } from '../services/WindowLayoutPresetStore'
import { Win32ForegroundEventWatcher } from '../services/integrations/Win32ForegroundEventWatcher'
import { auditLogger } from '../services/AuditLogger'
import { ScannerRegistry } from '../services/runtime/ScannerRegistry'
import { validateHwnd, validateString, validateHwndArray } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { z } from 'zod'
import {
  windowBatchCancelResponseSchema,
  windowBatchJobRequestSchema,
  windowBatchRequestSchema,
  windowBatchStartResponseSchema,
  windowBatchUndoResponseSchema,
  thumbnailBatchRequestSchema,
  thumbnailBatchResponseSchema,
  thumbnailGroupsResponseSchema,
  thumbnailRefreshRequestSchema,
  thumbnailViewportConfigResponseSchema,
  thumbnailWindowAliasRequestSchema,
  thumbnailWindowAliasResponseSchema,
  type WindowBatchCancelResponse,
  type WindowBatchStartResponse,
  type WindowBatchUndoResponse,
  type ThumbnailBatchResponse,
  type ThumbnailGroupsResponse,
  type ThumbnailViewportConfigResponse,
  type ThumbnailWindowAliasResponse,
  moveWindowToDesktopRequestSchema,
  moveWindowToDesktopResponseSchema,
  moveWindowToMonitorRequestSchema,
  moveWindowToMonitorResponseSchema,
  r8MonitorsResponseSchema,
  virtualDesktopListResponseSchema,
  windowVdWatchPayloadSchema,
  windowLayoutApplyRequestSchema,
  windowLayoutApplyResponseSchema,
  windowLayoutListResponseSchema,
  windowLayoutSaveRequestSchema,
  windowLayoutSaveResponseSchema,
  windowVdInfoRequestSchema,
  windowVdInfoResponseSchema,
  type MoveWindowToDesktopResponse,
  type MoveWindowToMonitorResponse,
  type R8MonitorsResponse,
  type VirtualDesktopListResponse,
  type WindowVdWatchPayload,
  type WindowLayoutApplyResponse,
  type WindowLayoutListResponse,
  type WindowLayoutSaveResponse,
  type WindowVdInfoResponse
} from '@shared/schemas/r8-runtime'
import type { SharedMonitorRuntime } from './runtimeBundle'

// Zod schemas for window IPC input validation
const hwndSchema = z.number().int().positive()
const stringSchema = z.string().min(1).max(200)
const hwndArraySchema = z.array(z.number().int().positive()).max(100)
const opacitySchema = z.number().min(0).max(100)
const titleSchema = z.string().trim().min(1).max(200)
const coordinateSchema = z.number().finite()
const windowRectSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: coordinateSchema,
  height: coordinateSchema,
})
const tilePresetSchema = z.enum([
  'tile-2x2',
  'tile-3x3',
  'tile-3x2',
  'tile-horizontal',
  'tile-vertical',
  'tile-auto',
  'cascade',
  'stack-center'
])
const applyLayoutIntentSchema = z.object({
  preset: tilePresetSchema.optional(),
  snapshotId: stringSchema.optional(),
  customRects: z.array(z.object({ hwnd: hwndSchema, rect: windowRectSchema })).max(100).optional(),
  hwnds: hwndArraySchema.optional(),
  monitorId: z.number().int().optional(),
  saveRestorePoint: z.boolean().optional(),
})
const saveSnapshotSchema = z.object({
  name: stringSchema,
  description: z.string().max(1000).optional(),
  hwnds: hwndArraySchema,
  monitorId: z.number().int().optional(),
})
const updateSnapshotSchema = z.object({
  id: stringSchema,
  name: stringSchema.optional(),
  description: z.string().max(1000).optional(),
})
const previewLayoutSchema = z.object({
  preset: tilePresetSchema,
  count: z.number().int().positive().max(100),
  monitorId: z.number().int().optional(),
})
const tileGroupSchema = z.object({
  groupId: stringSchema,
  preset: tilePresetSchema.default('tile-auto'),
})

let windowManager: WindowManager | null = null
let windowBatchExecutor: WindowBatchExecutor | null = null
let thumbnailService: ThumbnailService | null = null
let monitorService: MonitorService | null = null
let virtualDesktopService: VirtualDesktopService | null = null
let layoutPresetStore: WindowLayoutPresetStore | null = null
let monitorWatchUnsubscribe: (() => void) | null = null
let foregroundEventWatcher: Win32ForegroundEventWatcher | null = null
let foregroundDesktopId: string | null = null
let foregroundVdWatchInFlight = false
let ownsWindowManager = false
const topmostWindowState = new Set<number>()

function auditServiceResult<T extends ServiceResult<unknown>>(
  action: string,
  target: Record<string, unknown>,
  result: T
): T {
  auditLogger.log(action, target, result.success ? 'success' : 'error', result.error)
  return result
}

function auditApplyLayoutResult<T extends ApplyLayoutResult>(
  action: string,
  target: Record<string, unknown>,
  result: T
): T {
  const failure = result.failed[0]
  auditLogger.log(action, target, result.ok ? 'success' : 'error', failure?.message ?? failure?.error)
  return result
}

function auditBooleanResult(action: string, target: Record<string, unknown>, result: boolean, failureReason: string): boolean {
  auditLogger.log(action, target, result ? 'success' : 'error', result ? undefined : failureReason)
  return result
}

function auditNullableResult<T>(action: string, target: Record<string, unknown>, result: T | null, failureReason: string): T | null {
  auditLogger.log(action, target, result ? 'success' : 'error', result ? undefined : failureReason)
  return result
}

function buildTitleAuditTarget(hwnd: number, title: string): Record<string, unknown> {
  return {
    hwnd,
    newTitleLength: title.length,
    newTitlePreview: title.slice(0, 80)
  }
}

function resolveMonitorIdForWindow(windowInfo: WindowInfo, monitors: R8MonitorsResponse['monitors']): number {
  const centerX = windowInfo.rect.x + windowInfo.rect.width / 2
  const centerY = windowInfo.rect.y + windowInfo.rect.height / 2
  const index = monitors.findIndex(monitor => (
    centerX >= monitor.bounds.x &&
    centerX <= monitor.bounds.x + monitor.bounds.width &&
    centerY >= monitor.bounds.y &&
    centerY <= monitor.bounds.y + monitor.bounds.height
  ))
  return index >= 0 ? monitors[index].id : 0
}

function selectRequestedWindows(windows: readonly WindowInfo[], requestedHwnds: ReadonlySet<number>): WindowInfo[] {
  return windows.filter(windowInfo => requestedHwnds.has(windowInfo.hwnd))
}

async function resolveMonitorIdByHwnd(hwnds: readonly number[], monitors: R8MonitorsResponse['monitors']): Promise<Map<number, number>> {
  if (!windowManager || hwnds.length === 0) return new Map()
  const requestedHwnds = new Set(hwnds)
  const cachedWindows = typeof windowManager.getCachedWindows === 'function'
    ? selectRequestedWindows(windowManager.getCachedWindows(), requestedHwnds)
    : []
  const windows = cachedWindows.length === requestedHwnds.size
    ? cachedWindows
    : selectRequestedWindows((await windowManager.scanWindows(false)).data ?? [], requestedHwnds)
  return new Map(windows.map(windowInfo => [windowInfo.hwnd, resolveMonitorIdForWindow(windowInfo, monitors)]))
}

function formatWatchError(error: unknown): string {
  return error instanceof Error ? `E_VD_WATCH_FAILED: ${error.message}` : 'E_VD_WATCH_FAILED'
}

function shouldStartForegroundVdWatcher(): boolean {
  return process.env.DEVHUB_R8_VD_FOREGROUND_WATCH === '1'
}

async function buildWindowVdWatchPayload(eventType: WindowVdWatchPayload['eventType']): Promise<WindowVdWatchPayload> {
  const monitors = monitorService?.list().monitors ?? []
  const desktopsResponse = virtualDesktopService
    ? virtualDesktopListResponseSchema.parse(await virtualDesktopService.listDesktops())
    : virtualDesktopListResponseSchema.parse({
      desktops: [],
      unavailableReason: 'E_NOT_READY: Virtual desktop service not initialized'
    })

  return windowVdWatchPayloadSchema.parse({
    eventType,
    monitors,
    desktops: desktopsResponse.desktops,
    unavailableReason: desktopsResponse.unavailableReason,
    emittedAt: Date.now()
  })
}

async function emitWindowVdWatch(mainWindow: BrowserWindow, eventType: WindowVdWatchPayload['eventType']): Promise<void> {
  if (mainWindow.isDestroyed()) return
  try {
    const payload = await buildWindowVdWatchPayload(eventType)
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('window:vd-watch', payload)
  } catch (error) {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:vd-watch', windowVdWatchPayloadSchema.parse({
        eventType,
        monitors: [],
        desktops: [],
        unavailableReason: formatWatchError(error),
        emittedAt: Date.now()
      }))
    }
  }
}

async function emitForegroundDesktopChange(mainWindow: BrowserWindow, hwnd: number): Promise<void> {
  if (!virtualDesktopService || foregroundVdWatchInFlight || mainWindow.isDestroyed()) return
  foregroundVdWatchInFlight = true
  try {
    virtualDesktopService.invalidateCaches()
    const response = await virtualDesktopService.getWindowInfo([hwnd])
    const desktopId = response.info[0]?.desktopId ?? null
    if (!desktopId || desktopId === foregroundDesktopId) return
    foregroundDesktopId = desktopId
    await emitWindowVdWatch(mainWindow, 'virtual-desktop-changed')
  } finally {
    foregroundVdWatchInFlight = false
  }
}

export function setupWindowHandlers(_mainWindow: BrowserWindow, runtime?: SharedMonitorRuntime): void {
  const registeredWindowManager = ScannerRegistry.getInstance('window')

  windowManager = runtime?.windowManager ?? registeredWindowManager ?? new WindowManager()
  ownsWindowManager = !runtime?.windowManager && !registeredWindowManager
  windowBatchExecutor = new WindowBatchExecutor(
    windowManager,
    progress => {
      if (!_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('window:batch-progress', progress)
      }
    },
    {
      aliasManager: runtime?.aliasManager,
      moveToDesktop: (hwnd, desktopId) => {
        if (!virtualDesktopService) return Promise.resolve({ success: false, error: 'E_NOT_READY: Virtual desktop service not initialized' })
        return virtualDesktopService.moveWindowToDesktop({ hwnd, desktopId, confirmedBy: 'window-batch' })
      },
      updateTopmostState: (hwnd, topmost) => {
        if (topmost) topmostWindowState.add(hwnd)
        else topmostWindowState.delete(hwnd)
      }
    }
  )
  monitorService = new MonitorService()
  virtualDesktopService = new VirtualDesktopService()
  monitorWatchUnsubscribe?.()
  monitorWatchUnsubscribe = monitorService.watch(eventType => {
    void emitWindowVdWatch(_mainWindow, eventType)
  })
  foregroundEventWatcher?.stop()
  foregroundDesktopId = null
  foregroundEventWatcher = null
  if (shouldStartForegroundVdWatcher()) {
    foregroundEventWatcher = new Win32ForegroundEventWatcher()
    void foregroundEventWatcher.start(event => {
      void emitForegroundDesktopChange(_mainWindow, event.hwnd)
    }).catch(() => undefined)
  }
  layoutPresetStore = new WindowLayoutPresetStore(windowManager, {
    moveWindowToDesktop: (hwnd, desktopId) => {
      if (!virtualDesktopService) return Promise.resolve({ success: false, error: 'E_NOT_READY: Virtual desktop service not initialized' })
      return virtualDesktopService.moveWindowToDesktop({ hwnd, desktopId, confirmedBy: 'layout-preset' })
    }
  })
  thumbnailService = new ThumbnailService(windowManager, {
    aliasManager: runtime?.aliasManager,
    virtualDesktopProvider: virtualDesktopService
  })

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
        const error = `Invalid ${String(issue?.path[0] ?? 'input')}: must be a finite number`
        auditLogger.log('window:move', { hwnd }, 'refused', error)
        return { success: false, error }
      }
      if (!windowManager) {
        return auditServiceResult('window:move', { hwnd, rect: { x, y, width, height } }, { success: false, error: 'Window manager not initialized' })
      }
      return auditServiceResult('window:move', { hwnd, rect: { x, y, width, height } }, await windowManager.moveWindow(hwnd, x, y, width, height))
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
      if (!windowManager) {
        return auditServiceResult('window:close', { hwnd }, { success: false, error: 'Window manager not initialized' })
      }
      return auditServiceResult('window:close', { hwnd }, await windowManager.closeWindow(hwnd))
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
      const parsed = groupSchema.safeParse({ name, windowHwnds, projectId })
      if (!parsed.success) {
        auditLogger.log('window:create-group', { name, memberCount: Array.isArray(windowHwnds) ? windowHwnds.length : 0, projectId }, 'refused', parsed.error.issues[0]?.message)
        return null
      }
      if (!windowManager) {
        auditLogger.log('window:create-group', { name, memberCount: windowHwnds.length, projectId }, 'error', 'Window manager not initialized')
        return null
      }
      return auditNullableResult('window:create-group', { name, memberCount: windowHwnds.length, projectId }, windowManager.createGroup(name, windowHwnds, projectId), 'create group failed')
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_GET_GROUPS, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_GET_GROUPS, RATE_LIMITS.QUERY,
    async (): Promise<WindowGroup[]> => {
      if (!windowManager) return []
      await windowManager.scanWindows()
      return windowManager.getGroups()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_REMOVE_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_REMOVE_GROUP, RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<boolean> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return auditBooleanResult('window:remove-group', { groupId }, false, 'Window manager not initialized')
      return auditBooleanResult('window:remove-group', { groupId }, windowManager.removeGroup(groupId), 'group not found')
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RENAME_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RENAME_GROUP, RATE_LIMITS.ACTION,
    async (_, groupId: string, newName: string): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      validateString(newName, 'newName')
      if (!windowManager) {
        return auditServiceResult('window:rename-group', { groupId, newName }, { success: false, error: 'Window manager not initialized' })
      }
      return auditServiceResult('window:rename-group', { groupId, newName }, windowManager.renameGroup(groupId, newName))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SAVE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SAVE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, name: string, description?: string): Promise<WindowLayout | null> => {
      validateString(name, 'name')
      if (description !== undefined) {
        validateString(description, 'description', 1000)
      }
      if (!windowManager) {
        auditLogger.log('window:save-layout', { name }, 'error', 'Window manager not initialized')
        return null
      }
      return auditNullableResult('window:save-layout', { name, hasDescription: Boolean(description) }, await windowManager.saveLayout(name, description), 'save layout failed')
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, layoutId: string): Promise<ServiceResult> => {
      validateString(layoutId, 'layoutId')
      if (!windowManager) {
        return auditServiceResult('window:restore-layout', { layoutId }, { success: false, error: 'Window manager not initialized' })
      }
      return auditServiceResult('window:restore-layout', { layoutId }, await windowManager.restoreLayout(layoutId))
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
      if (!windowManager) return auditBooleanResult('window:remove-layout', { layoutId }, false, 'Window manager not initialized')
      return auditBooleanResult('window:remove-layout', { layoutId }, windowManager.removeLayout(layoutId), 'layout not found')
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_APPLY_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_APPLY_LAYOUT, RATE_LIMITS.ACTION,
    async (_, intent: ApplyLayoutIntent): Promise<ApplyLayoutResult> => {
      const parsed = applyLayoutIntentSchema.safeParse(intent)
      const target = {
        preset: intent?.preset,
        snapshotId: intent?.snapshotId,
        hwndCount: intent?.hwnds?.length ?? intent?.customRects?.length ?? 0,
        monitorId: intent?.monitorId
      }
      if (!parsed.success) return auditApplyLayoutResult('window:apply-layout', target, { ok: false, applied: [], failed: [{ hwnd: 0, error: 'PRESET_REQUIRES_HWNDS', message: parsed.error.issues[0]?.message }] })
      if (!windowManager) return auditApplyLayoutResult('window:apply-layout', target, { ok: false, applied: [], failed: [{ hwnd: 0, error: 'WINDOW_NOT_FOUND', message: 'Window manager not initialized' }] })
      return auditApplyLayoutResult('window:apply-layout', target, await windowManager.applyLayout(parsed.data))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SAVE_SNAPSHOT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SAVE_SNAPSHOT, RATE_LIMITS.ACTION,
    async (_, payload: { name: string; description?: string; hwnds: number[]; monitorId?: number }): Promise<ServiceResult<WindowLayoutSnapshot>> => {
      const parsed = saveSnapshotSchema.safeParse(payload)
      const target = { name: payload?.name, hwndCount: Array.isArray(payload?.hwnds) ? payload.hwnds.length : 0, monitorId: payload?.monitorId }
      if (!parsed.success) return auditServiceResult('window:save-snapshot', target, { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` })
      if (!windowManager) return auditServiceResult('window:save-snapshot', target, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:save-snapshot', target, await windowManager.saveSnapshot(parsed.data.name, parsed.data.description, parsed.data.hwnds, parsed.data.monitorId))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_UPDATE_SNAPSHOT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_UPDATE_SNAPSHOT, RATE_LIMITS.ACTION,
    async (_, payload: { id: string; name?: string; description?: string }): Promise<ServiceResult> => {
      const parsed = updateSnapshotSchema.safeParse(payload)
      const target = { snapshotId: payload?.id, hasName: typeof payload?.name === 'string', hasDescription: typeof payload?.description === 'string' }
      if (!parsed.success) return auditServiceResult('window:update-snapshot', target, { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` })
      if (!windowManager) return auditServiceResult('window:update-snapshot', target, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:update-snapshot', target, windowManager.updateSnapshot(parsed.data.id, { name: parsed.data.name, description: parsed.data.description }))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_DELETE_SNAPSHOT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_DELETE_SNAPSHOT, RATE_LIMITS.DESTRUCTIVE,
    async (_, id: string): Promise<ServiceResult> => {
      validateString(id, 'snapshotId')
      if (!windowManager) return auditServiceResult('window:delete-snapshot', { snapshotId: id }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:delete-snapshot', { snapshotId: id }, windowManager.deleteSnapshot(id))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE_SNAPSHOT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE_SNAPSHOT, RATE_LIMITS.ACTION,
    async (_, id: string): Promise<ApplyLayoutResult> => {
      validateString(id, 'snapshotId')
      if (!windowManager) return auditApplyLayoutResult('window:restore-snapshot', { snapshotId: id }, { ok: false, applied: [], failed: [{ hwnd: 0, error: 'WINDOW_NOT_FOUND', message: 'Window manager not initialized' }] })
      return auditApplyLayoutResult('window:restore-snapshot', { snapshotId: id }, await windowManager.restoreSnapshot(id))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_LIST_SNAPSHOTS, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_LIST_SNAPSHOTS, RATE_LIMITS.QUERY,
    async (): Promise<WindowLayoutSnapshot[]> => {
      if (!windowManager) return []
      return windowManager.listSnapshots()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_PREVIEW_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_PREVIEW_LAYOUT, RATE_LIMITS.QUERY,
    async (_, payload: { preset: TilePreset; count: number; monitorId?: number }): Promise<WindowInfo['rect'][]> => {
      const parsed = previewLayoutSchema.safeParse(payload)
      if (!parsed.success || !windowManager) return []
      return windowManager.previewLayout(parsed.data.preset, parsed.data.count, parsed.data.monitorId)
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE_PREVIOUS, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE_PREVIOUS, RATE_LIMITS.ACTION,
    async (_, restorePointId?: string): Promise<ApplyLayoutResult> => {
      if (restorePointId !== undefined) validateString(restorePointId, 'restorePointId')
      if (!windowManager) return auditApplyLayoutResult('window:restore-previous', { restorePointId }, { ok: false, applied: [], failed: [{ hwnd: 0, error: 'WINDOW_NOT_FOUND', message: 'Window manager not initialized' }] })
      return auditApplyLayoutResult('window:restore-previous', { restorePointId }, await windowManager.restorePrevious(restorePointId))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_GET_MONITOR_INFO, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_GET_MONITOR_INFO, RATE_LIMITS.QUERY,
    async (): Promise<MonitorInfo[]> => {
      if (!windowManager) return []
      return windowManager.getMonitorInfo()
    }
  ))

  ipcMain.handle('window:monitors', withRateLimit(
    'window:monitors',
    'meta',
    async (): Promise<R8MonitorsResponse> => {
      if (!monitorService) return r8MonitorsResponseSchema.parse({ monitors: [] })
      return r8MonitorsResponseSchema.parse(monitorService.list())
    }
  ))

  ipcMain.handle('window:vd-list', withRateLimit(
    'window:vd-list',
    'medium_query',
    async (): Promise<VirtualDesktopListResponse> => {
      if (!virtualDesktopService) return virtualDesktopListResponseSchema.parse({ desktops: [], unavailableReason: 'E_NOT_READY: Virtual desktop service not initialized' })
      return virtualDesktopListResponseSchema.parse(await virtualDesktopService.listDesktops())
    }
  ))

  ipcMain.handle('window:vd-info', withRateLimit(
    'window:vd-info',
    'medium_query',
    async (_, input: unknown): Promise<WindowVdInfoResponse> => {
      const request = windowVdInfoRequestSchema.parse(input)
      if (!virtualDesktopService) return windowVdInfoResponseSchema.parse({ info: [], unavailableReason: 'E_NOT_READY: Virtual desktop service not initialized' })
      const monitors = monitorService?.list().monitors ?? []
      const monitorIdByHwnd = await resolveMonitorIdByHwnd(request.hwnds, monitors)
      return windowVdInfoResponseSchema.parse(await virtualDesktopService.getWindowInfo(request.hwnds, monitorIdByHwnd))
    }
  ))

  ipcMain.handle('window:move-to-desktop', withRateLimit(
    'window:move-to-desktop',
    'low_freq_op',
    async (_, input: unknown): Promise<MoveWindowToDesktopResponse> => {
      const request = moveWindowToDesktopRequestSchema.parse(input)
      if (!virtualDesktopService) return moveWindowToDesktopResponseSchema.parse({ success: false, error: 'E_NOT_READY: Virtual desktop service not initialized' })
      const response = moveWindowToDesktopResponseSchema.parse(await virtualDesktopService.moveWindowToDesktop(request))
      auditLogger.log('window:move-to-desktop', {
        hwnd: request.hwnd,
        desktopId: request.desktopId,
        confirmedBy: request.confirmedBy
      }, response.success ? 'success' : 'error', response.error)
      return response
    }
  ))

  ipcMain.handle('window:move-to-monitor', withRateLimit(
    'window:move-to-monitor',
    'low_freq_op',
    async (_, input: unknown): Promise<MoveWindowToMonitorResponse> => {
      const request = moveWindowToMonitorRequestSchema.parse(input)
      const targetMonitor = monitorService?.findByIdOrIndex(request.monitorId) ?? null
      if (!windowManager) return moveWindowToMonitorResponseSchema.parse({ success: false, error: 'E_NOT_READY: Window manager not initialized' })
      if (!targetMonitor) return moveWindowToMonitorResponseSchema.parse({ success: false, error: `E_VALIDATION: monitorId not found: ${request.monitorId}` })
      const scanResult = await windowManager.scanWindows(false)
      const targetWindow = scanResult.data?.find(windowInfo => windowInfo.hwnd === request.hwnd)
      if (!targetWindow) return moveWindowToMonitorResponseSchema.parse({ success: false, error: `E_WINDOW_NOT_FOUND: hwnd ${request.hwnd}` })
      const rect = {
        x: targetMonitor.workArea.x,
        y: targetMonitor.workArea.y,
        width: Math.min(targetWindow.rect.width, targetMonitor.workArea.width),
        height: Math.min(targetWindow.rect.height, targetMonitor.workArea.height)
      }
      const moveResult = await windowManager.moveWindow(request.hwnd, rect.x, rect.y, rect.width, rect.height)
      const response = moveWindowToMonitorResponseSchema.parse(moveResult.success
        ? { success: true, data: { hwnd: request.hwnd, monitorId: targetMonitor.id, rect } }
        : { success: false, error: moveResult.error ?? 'E_MOVE_FAILED' })
      auditLogger.log('window:move-to-monitor', {
        hwnd: request.hwnd,
        monitorId: request.monitorId,
        confirmedBy: request.confirmedBy
      }, response.success ? 'success' : 'error', response.error)
      return response
    }
  ))

  ipcMain.handle('window:layout-save', withRateLimit(
    'window:layout-save',
    'low_freq_op',
    async (_, input: unknown): Promise<WindowLayoutSaveResponse> => {
      const request = windowLayoutSaveRequestSchema.parse(input)
      if (!layoutPresetStore) throw new Error('E_NOT_READY: Window layout preset store not initialized')
      const response = windowLayoutSaveResponseSchema.parse(layoutPresetStore.save(request))
      auditLogger.log('window:layout-save', { name: request.name, windowCount: request.windows.length, confirmedBy: request.confirmedBy }, 'success')
      return response
    }
  ))

  ipcMain.handle('window:layout-list', withRateLimit(
    'window:layout-list',
    'medium_query',
    async (): Promise<WindowLayoutListResponse> => {
      if (!layoutPresetStore) return windowLayoutListResponseSchema.parse({ presets: [] })
      return windowLayoutListResponseSchema.parse(layoutPresetStore.list())
    }
  ))

  ipcMain.handle('window:layout-apply', withRateLimit(
    'window:layout-apply',
    'low_freq_op',
    async (_, input: unknown): Promise<WindowLayoutApplyResponse> => {
      const request = windowLayoutApplyRequestSchema.parse(input)
      if (!layoutPresetStore) throw new Error('E_NOT_READY: Window layout preset store not initialized')
      const response = windowLayoutApplyResponseSchema.parse(await layoutPresetStore.apply(request.name))
      auditLogger.log('window:layout-apply', {
        name: request.name,
        confirmedBy: request.confirmedBy,
        applied: response.applied.length,
        failed: response.failed.length
      }, response.ok ? 'success' : 'error', response.failed[0]?.error)
      return response
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_TILE_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_TILE_GROUP, RATE_LIMITS.ACTION,
    async (_, payload: { groupId: string; preset?: TilePreset }): Promise<ApplyLayoutResult> => {
      const parsed = tileGroupSchema.safeParse(payload)
      const target = { groupId: payload?.groupId, preset: payload?.preset }
      if (!parsed.success) return auditApplyLayoutResult('window:tile-group', target, { ok: false, applied: [], failed: [{ hwnd: 0, error: 'PRESET_REQUIRES_HWNDS', message: parsed.error.issues[0]?.message }] })
      if (!windowManager) return auditApplyLayoutResult('window:tile-group', target, { ok: false, applied: [], failed: [{ hwnd: 0, error: 'WINDOW_NOT_FOUND', message: 'Window manager not initialized' }] })
      return auditApplyLayoutResult('window:tile-group', target, await windowManager.tileGroup(parsed.data.groupId, parsed.data.preset))
    }
  ))

  ipcMain.handle('window:minimize-group', withRateLimit(
    'window:minimize-group', RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return auditServiceResult('window:minimize-group', { groupId }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:minimize-group', { groupId }, await windowManager.minimizeGroup(groupId))
    }
  ))

  ipcMain.handle('window:close-group', withRateLimit(
    'window:close-group', RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return auditServiceResult('window:close-group', { groupId }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:close-group', { groupId }, await windowManager.closeGroup(groupId))
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

  const setWindowAlwaysOnTop = async (action: string, hwnd: number, topmost: boolean): Promise<ServiceResult<{ hwnd: number; topmost: boolean }>> => {
    const topmostSchema = z.object({ hwnd: hwndSchema, topmost: z.boolean() })
    const parsed = topmostSchema.safeParse({ hwnd, topmost })
    if (!parsed.success) {
      return auditServiceResult(action, { hwnd, topmost }, { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` })
    }
    if (!windowManager) return auditServiceResult(action, { hwnd, topmost }, { success: false, error: 'Window manager not initialized' })

    const result = await windowManager.setWindowTopmost(hwnd, topmost)
    if (result.success) {
      if (topmost) topmostWindowState.add(hwnd)
      else topmostWindowState.delete(hwnd)
      return auditServiceResult(action, { hwnd, topmost }, { success: true, data: { hwnd, topmost } })
    }
    return auditServiceResult(action, { hwnd, topmost }, { success: false, error: result.error ?? 'WINDOW_TOPMOST_FAILED' })
  }

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SET_TOPMOST, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SET_TOPMOST, RATE_LIMITS.ACTION,
    async (_, hwnd: number, topmost: boolean): Promise<ServiceResult<{ hwnd: number; topmost: boolean }>> =>
      setWindowAlwaysOnTop('window:set-topmost', hwnd, topmost)
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_ALWAYS_ON_TOP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_ALWAYS_ON_TOP, RATE_LIMITS.ACTION,
    async (_, hwnd: number, topmost: boolean): Promise<ServiceResult<{ hwnd: number; topmost: boolean }>> =>
      setWindowAlwaysOnTop('window:always-on-top', hwnd, topmost)
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_GET_TOPMOST, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_GET_TOPMOST, RATE_LIMITS.QUERY,
    async (_, hwnd: number): Promise<ServiceResult<{ hwnd: number; topmost: boolean }>> => {
      const parsed = hwndSchema.safeParse(hwnd)
      if (!parsed.success) return { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` }
      return { success: true, data: { hwnd, topmost: topmostWindowState.has(hwnd) } }
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_LIST_TOPMOST, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_LIST_TOPMOST, RATE_LIMITS.QUERY,
    async (): Promise<ServiceResult<{ hwnds: number[] }>> => ({ success: true, data: { hwnds: Array.from(topmostWindowState) } })
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SET_OPACITY, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SET_OPACITY, RATE_LIMITS.ACTION,
    async (_, hwnd: number, opacity: number): Promise<ServiceResult> => {
      const opacityInputSchema = z.object({ hwnd: hwndSchema, opacity: opacitySchema })
      const parsed = opacityInputSchema.safeParse({ hwnd, opacity })
      if (!parsed.success) {
        return auditServiceResult('window:set-opacity', { hwnd, opacity }, { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` })
      }
      if (!windowManager) return auditServiceResult('window:set-opacity', { hwnd, opacity }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:set-opacity', { hwnd, opacity }, await windowManager.setWindowOpacity(hwnd, opacity))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SET_TITLE, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SET_TITLE, RATE_LIMITS.ACTION,
    async (_, hwnd: number, title: string): Promise<ServiceResult> => {
      const titleInputSchema = z.object({ hwnd: hwndSchema, title: titleSchema })
      const parsed = titleInputSchema.safeParse({ hwnd, title })
      const target = typeof title === 'string' ? buildTitleAuditTarget(hwnd, title) : { hwnd }
      if (!parsed.success) {
        return auditServiceResult('window:set-title', target, { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` })
      }
      if (!windowManager) return auditServiceResult('window:set-title', target, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:set-title', target, await windowManager.setWindowTitle(parsed.data.hwnd, parsed.data.title))
    }
  ))
  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SEND_KEYS, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SEND_KEYS, RATE_LIMITS.ACTION,
    async (_, hwnd: number, keys: string): Promise<ServiceResult> => {
      const keysSchema = z.object({ hwnd: hwndSchema, keys: z.string().min(1).max(50) })
      const parsed = keysSchema.safeParse({ hwnd, keys })
      const target = { hwnd, keyCount: typeof keys === 'string' ? keys.length : 0 }
      if (!parsed.success) return auditServiceResult('window:send-keys', target, { success: false, error: `Validation error: ${parsed.error.issues[0]?.message}` })
      if (!windowManager) return auditServiceResult('window:send-keys', target, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:send-keys', target, await windowManager.sendKeysToWindow(hwnd, keys))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_TILE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_TILE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, hwnds: number[]): Promise<ServiceResult> => {
      validateHwndArray(hwnds)
      if (!windowManager) return auditServiceResult('window:tile-layout', { hwndCount: hwnds.length }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:tile-layout', { hwndCount: hwnds.length }, await windowManager.tileWindows(hwnds))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_CASCADE_LAYOUT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_CASCADE_LAYOUT, RATE_LIMITS.ACTION,
    async (_, hwnds: number[]): Promise<ServiceResult> => {
      validateHwndArray(hwnds)
      if (!windowManager) return auditServiceResult('window:cascade-layout', { hwndCount: hwnds.length }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:cascade-layout', { hwndCount: hwnds.length }, await windowManager.cascadeWindows(hwnds))
    }
  ))

  ipcMain.handle('window:stack-layout', withRateLimit(
    'window:stack-layout', RATE_LIMITS.ACTION,
    async (_, hwnds: number[]): Promise<ServiceResult> => {
      validateHwndArray(hwnds)
      if (!windowManager) return auditServiceResult('window:stack-layout', { hwndCount: hwnds.length }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:stack-layout', { hwndCount: hwnds.length }, await windowManager.stackWindows(hwnds))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_MINIMIZE_ALL, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_MINIMIZE_ALL, RATE_LIMITS.ACTION,
    async (): Promise<ServiceResult> => {
      if (!windowManager) return auditServiceResult('window:minimize-all', {}, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:minimize-all', {}, await windowManager.minimizeAll())
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE_ALL, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE_ALL, RATE_LIMITS.ACTION,
    async (): Promise<ServiceResult> => {
      if (!windowManager) return auditServiceResult('window:restore-all', {}, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:restore-all', {}, await windowManager.restoreAll())
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_ADD_TO_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_ADD_TO_GROUP, RATE_LIMITS.ACTION,
    async (_, groupId: string, hwnd: number): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      validateHwnd(hwnd)
      if (!windowManager) return auditServiceResult('window:add-to-group', { groupId, hwnd }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:add-to-group', { groupId, hwnd }, await windowManager.addToGroup(groupId, hwnd))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_RESTORE_GROUP, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_RESTORE_GROUP, RATE_LIMITS.ACTION,
    async (_, groupId: string): Promise<ServiceResult> => {
      validateString(groupId, 'groupId')
      if (!windowManager) return auditServiceResult('window:restore-group', { groupId }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:restore-group', { groupId }, await windowManager.restoreGroup(groupId))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_SCREENSHOT, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_SCREENSHOT, RATE_LIMITS.ACTION,
    async (_, hwnd: number): Promise<ServiceResult<WindowScreenshotResult>> => {
      validateHwnd(hwnd)
      if (!windowManager) return auditServiceResult('window:screenshot', { hwnd }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:screenshot', { hwnd }, await windowManager.screenshotWindow(hwnd))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_TOGGLE_FAVORITE, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_TOGGLE_FAVORITE, RATE_LIMITS.ACTION,
    async (_, hwnd: number): Promise<ServiceResult<WindowFavoriteToggleResult>> => {
      validateHwnd(hwnd)
      if (!windowManager) return auditServiceResult('window:toggle-favorite', { hwnd }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:toggle-favorite', { hwnd }, await windowManager.toggleFavorite(hwnd))
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_GET_FAVORITES, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_GET_FAVORITES, RATE_LIMITS.QUERY,
    async (): Promise<WindowFavoriteRecord[]> => {
      if (!windowManager) return []
      return windowManager.getFavorites()
    }
  ))

  ipcMain.handle(IPC_CHANNELS_EXT.WINDOW_OPEN_WORKING_DIR, withRateLimit(
    IPC_CHANNELS_EXT.WINDOW_OPEN_WORKING_DIR, RATE_LIMITS.ACTION,
    async (_, hwnd: number): Promise<ServiceResult<WindowOpenDirectoryResult>> => {
      validateHwnd(hwnd)
      if (!windowManager) return auditServiceResult('window:open-working-dir', { hwnd }, { success: false, error: 'Window manager not initialized' })
      return auditServiceResult('window:open-working-dir', { hwnd }, await windowManager.openWorkingDirectory(hwnd))
    }
  ))

  ipcMain.handle('window:thumbnails-batch', withRateLimit(
    'window:thumbnails-batch',
    'meta',
    async (_, input: unknown): Promise<ThumbnailBatchResponse> => {
      if (!thumbnailService) throw new Error('E_NOT_READY: Thumbnail service not initialized')
      const request = thumbnailBatchRequestSchema.parse(input)
      const response = thumbnailBatchResponseSchema.parse(await thumbnailService.captureBatch(request))
      auditLogger.log('window:thumbnails-batch', {
        hwndCount: request.hwnds.length,
        captured: response.captured,
        cacheHits: response.cacheHits,
        failed: response.failed,
        source: response.source
      }, response.entries.length > 0 ? 'success' : 'refused')
      return response
    }
  ))

  ipcMain.handle('window:thumbnail-refresh', withRateLimit(
    'window:thumbnail-refresh',
    'meta',
    async (_, input: unknown): Promise<ServiceResult<unknown>> => {
      if (!thumbnailService) throw new Error('E_NOT_READY: Thumbnail service not initialized')
      const request = thumbnailRefreshRequestSchema.parse(input)
      const response = await thumbnailService.refresh(request)
      auditLogger.log('window:thumbnail-refresh', { hwnd: request.hwnd }, response.success ? 'success' : 'error', response.error)
      return response
    }
  ))

  ipcMain.handle('window:groups', withRateLimit(
    'window:groups',
    'meta',
    async (): Promise<ThumbnailGroupsResponse> => {
      if (!thumbnailService) throw new Error('E_NOT_READY: Thumbnail service not initialized')
      return thumbnailGroupsResponseSchema.parse(await thumbnailService.listGroups())
    }
  ))

  ipcMain.handle('window:set-alias', withRateLimit(
    'window:set-alias',
    'low_freq_op',
    async (_, input: unknown): Promise<ThumbnailWindowAliasResponse> => {
      if (!thumbnailService) throw new Error('E_NOT_READY: Thumbnail service not initialized')
      const request = thumbnailWindowAliasRequestSchema.parse(input)
      const response = thumbnailWindowAliasResponseSchema.parse(await thumbnailService.setAlias(request))
      auditLogger.log('window:set-alias', {
        hwnd: request.hwnd,
        aliasLength: request.alias.length,
        confirmedBy: request.confirmedBy
      }, response.success ? 'success' : 'error', response.error)
      return response
    }
  ))

  ipcMain.handle('window:viewport-config', withRateLimit(
    'window:viewport-config',
    'meta',
    async (_, input: unknown): Promise<ThumbnailViewportConfigResponse> => {
      if (!thumbnailService) throw new Error('E_NOT_READY: Thumbnail service not initialized')
      return thumbnailViewportConfigResponseSchema.parse(thumbnailService.saveViewportConfig(input))
    }
  ))

  ipcMain.handle('window:batch-op', withRateLimit(
    'window:batch-op',
    'low_freq_op',
    async (_, input: unknown): Promise<WindowBatchStartResponse> => {
      const request = windowBatchRequestSchema.parse(input)
      if (!windowBatchExecutor) throw new Error('E_NOT_READY: Window batch executor not initialized')
      const response = windowBatchStartResponseSchema.parse(windowBatchExecutor.run(request))
      auditLogger.log('window:batch-op', {
        action: request.action,
        hwndCount: request.hwnds.length,
        jobId: response.jobId,
        dryRun: request.dryRun
      }, 'success')
      return response
    }
  ))

  ipcMain.handle('window:batch-cancel', withRateLimit(
    'window:batch-cancel',
    'meta',
    async (_, input: unknown): Promise<WindowBatchCancelResponse> => {
      const request = windowBatchJobRequestSchema.parse(input)
      if (!windowBatchExecutor) throw new Error('E_NOT_READY: Window batch executor not initialized')
      const response = windowBatchCancelResponseSchema.parse(windowBatchExecutor.cancel(request.jobId))
      auditLogger.log('window:batch-cancel', {
        jobId: request.jobId,
        confirmedBy: request.confirmedBy,
        skipped: response.skipped
      }, response.cancelled ? 'success' : 'refused')
      return response
    }
  ))

  ipcMain.handle('window:batch-undo', withRateLimit(
    'window:batch-undo',
    'meta',
    async (_, input: unknown): Promise<WindowBatchUndoResponse> => {
      const request = windowBatchJobRequestSchema.parse(input)
      if (!windowBatchExecutor) throw new Error('E_NOT_READY: Window batch executor not initialized')
      const response = windowBatchUndoResponseSchema.parse(await windowBatchExecutor.undo(request.jobId))
      auditLogger.log('window:batch-undo', {
        jobId: request.jobId,
        confirmedBy: request.confirmedBy,
        undone: response.undone
      }, response.undone > 0 ? 'success' : 'refused')
      return response
    }
  ))
}

export function cleanupWindowHandlers(): void {
  monitorWatchUnsubscribe?.()
  monitorWatchUnsubscribe = null
  foregroundEventWatcher?.stop()
  foregroundEventWatcher = null
  foregroundDesktopId = null
  foregroundVdWatchInFlight = false
  windowBatchExecutor?.dispose()
  windowBatchExecutor = null
  thumbnailService?.dispose()
  thumbnailService = null
  monitorService = null
  virtualDesktopService = null
  layoutPresetStore = null
  if (windowManager && ownsWindowManager) {
    windowManager.cleanup()
  }
  windowManager = null
  ownsWindowManager = false

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
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RENAME_GROUP)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SAVE_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_GET_LAYOUTS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_REMOVE_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_APPLY_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SAVE_SNAPSHOT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_UPDATE_SNAPSHOT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_DELETE_SNAPSHOT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE_SNAPSHOT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_LIST_SNAPSHOTS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_PREVIEW_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE_PREVIOUS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_GET_MONITOR_INFO)
  ipcMain.removeHandler('window:monitors')
  ipcMain.removeHandler('window:vd-list')
  ipcMain.removeHandler('window:vd-info')
  ipcMain.removeHandler('window:move-to-desktop')
  ipcMain.removeHandler('window:move-to-monitor')
  ipcMain.removeHandler('window:layout-save')
  ipcMain.removeHandler('window:layout-list')
  ipcMain.removeHandler('window:layout-apply')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_TILE_GROUP)
  ipcMain.removeHandler('window:minimize-group')
  ipcMain.removeHandler('window:close-group')
  ipcMain.removeHandler('window:filter-dev')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SET_TOPMOST)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_ALWAYS_ON_TOP)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_GET_TOPMOST)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_LIST_TOPMOST)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SET_OPACITY)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SET_TITLE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SEND_KEYS)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_TILE_LAYOUT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_CASCADE_LAYOUT)
  ipcMain.removeHandler('window:stack-layout')
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_MINIMIZE_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE_ALL)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_ADD_TO_GROUP)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_RESTORE_GROUP)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_SCREENSHOT)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_TOGGLE_FAVORITE)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_GET_FAVORITES)
  ipcMain.removeHandler(IPC_CHANNELS_EXT.WINDOW_OPEN_WORKING_DIR)
  ipcMain.removeHandler('window:thumbnails-batch')
  ipcMain.removeHandler('window:thumbnail-refresh')
  ipcMain.removeHandler('window:groups')
  ipcMain.removeHandler('window:set-alias')
  ipcMain.removeHandler('window:viewport-config')
  ipcMain.removeHandler('window:batch-op')
  ipcMain.removeHandler('window:batch-cancel')
  ipcMain.removeHandler('window:batch-undo')
}

export function getWindowManager(): WindowManager | null {
  return windowManager ?? ScannerRegistry.getInstance('window')
}
