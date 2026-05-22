import { desktopCapturer } from 'electron'
import PQueue from 'p-queue'
import type { MonitorInfo, ServiceResult, WindowInfo } from '@shared/types-extended'
import {
  THUMBNAIL_LIMITS,
  thumbnailBatchRequestSchema,
  thumbnailBatchResponseSchema,
  thumbnailGroupsResponseSchema,
  thumbnailRefreshRequestSchema,
  thumbnailWallEntrySchema,
  thumbnailWallViewportSchema,
  thumbnailWindowAliasRequestSchema,
  thumbnailWindowAliasResponseSchema,
  thumbnailViewportConfigResponseSchema,
  type ThumbnailBatchRequest,
  type ThumbnailBatchResponse,
  type ThumbnailGroupsResponse,
  type ThumbnailWallEntry,
  type ThumbnailWallViewport,
  type ThumbnailWindowAliasResponse,
  type ThumbnailViewportConfigResponse,
  type WindowVdInfoResponse
} from '@shared/schemas/r8-runtime'
import type { WindowManager } from './WindowManager'
import { WindowGroupResolver, type ThumbnailAliasManager } from './WindowGroupResolver'
import { Win32ThumbnailCapturer, type Win32ThumbnailCapturerLike } from './integrations/Win32ThumbnailCapturer'

interface NativeThumbnailImage {
  isEmpty(): boolean
  toDataURL(): string
}

interface NativeWindowSource {
  id: string
  name: string
  thumbnail: NativeThumbnailImage
}

interface DesktopCapturerLike {
  getSources(options: {
    types: Array<'window'>
    thumbnailSize: { width: number; height: number }
    fetchWindowIcons?: boolean
  }): Promise<NativeWindowSource[]>
}

export type ThumbnailWindowManager = Pick<WindowManager, 'scanWindows' | 'getMonitorInfo'> & {
  getCachedWindows?: () => WindowInfo[]
}

export interface ThumbnailVirtualDesktopProvider {
  getWindowInfo(hwnds: readonly number[], monitorIdByHwnd?: ReadonlyMap<number, number>): Promise<WindowVdInfoResponse>
}

interface ThumbnailCacheEntry {
  dataUrl: string
  capturedAt: number
  width: number
  height: number
}

interface DesktopInfoCacheEntry {
  desktopId: string | null
  capturedAt: number
}

interface ThumbnailSize {
  width: number
  height: number
}

export interface ThumbnailServiceOptions {
  aliasManager?: ThumbnailAliasManager
  capturer?: DesktopCapturerLike | null
  virtualDesktopProvider?: ThumbnailVirtualDesktopProvider | null
  win32Capturer?: Win32ThumbnailCapturerLike | null
}

const DEFAULT_THUMBNAIL_SIZE: ThumbnailSize = {
  width: THUMBNAIL_LIMITS.TILE_W_BY_ZOOM.md,
  height: THUMBNAIL_LIMITS.TILE_H_BY_ZOOM.md
}
const DESKTOP_INFO_CACHE_TTL_MS = 30_000

function parseDesktopSourceHwnd(sourceId: string): number | null {
  const match = /^window:([^:]+):/.exec(sourceId)
  if (!match) return null
  const raw = match[1]
  const value = raw.startsWith('0x') ? Number.parseInt(raw.slice(2), 16) : Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function dedupeHwnds(hwnds: readonly number[]): number[] {
  return [...new Set(hwnds.map(hwnd => Math.floor(hwnd)).filter(hwnd => Number.isSafeInteger(hwnd) && hwnd > 0))]
}

function isDataUrl(value: string): boolean {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)
}

function isInside(rect: WindowInfo['rect'], monitor: MonitorInfo): boolean {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  return centerX >= monitor.bounds.x &&
    centerX <= monitor.bounds.x + monitor.bounds.width &&
    centerY >= monitor.bounds.y &&
    centerY <= monitor.bounds.y + monitor.bounds.height
}

function getDefaultDesktopCapturer(): DesktopCapturerLike | null {
  try {
    return (desktopCapturer as DesktopCapturerLike | undefined) ?? null
  } catch {
    return null
  }
}

export class ThumbnailService {
  private readonly queue = new PQueue({ concurrency: THUMBNAIL_LIMITS.MAX_PARALLEL_CAPTURES })
  private readonly cache = new Map<number, ThumbnailCacheEntry>()
  private readonly desktopInfoCache = new Map<number, DesktopInfoCacheEntry>()
  private readonly capturer: DesktopCapturerLike | null
  private readonly resolver: WindowGroupResolver
  private readonly virtualDesktopProvider: ThumbnailVirtualDesktopProvider | null
  private readonly win32Capturer: Win32ThumbnailCapturerLike | null
  private viewport: ThumbnailWallViewport = thumbnailWallViewportSchema.parse({})

  constructor(
    private readonly windowManager: ThumbnailWindowManager,
    options: ThumbnailServiceOptions = {}
  ) {
    this.capturer = options.capturer === undefined ? getDefaultDesktopCapturer() : options.capturer
    this.virtualDesktopProvider = options.virtualDesktopProvider ?? null
    this.win32Capturer = options.win32Capturer === undefined ? new Win32ThumbnailCapturer() : options.win32Capturer
    this.resolver = new WindowGroupResolver({ aliasManager: options.aliasManager })
  }

  async captureBatch(input: unknown): Promise<ThumbnailBatchResponse> {
    const request = thumbnailBatchRequestSchema.parse(input)
    const windows = await this.resolveWindowsForRequest(request)
    const response = await this.captureForWindows(request, windows)
    return thumbnailBatchResponseSchema.parse(response)
  }

  async refresh(input: unknown): Promise<ServiceResult<ThumbnailWallEntry>> {
    const request = thumbnailRefreshRequestSchema.parse(input)
    const response = await this.captureBatch({
      hwnds: [request.hwnd],
      maxAgeMs: 0,
      thumbnailSize: request.thumbnailSize
    } satisfies ThumbnailBatchRequest)
    const entry = response.entries.find(item => item.hwnd === request.hwnd)
    if (!entry) return { success: false, error: `Window not found: ${request.hwnd}` }
    return { success: Boolean(entry.thumbnailDataUrl), data: entry, error: entry.thumbnailDataUrl ? undefined : 'Thumbnail capture unavailable' }
  }

  async listGroups(): Promise<ThumbnailGroupsResponse> {
    const windowsResult = await this.windowManager.scanWindows(false)
    const windows = windowsResult.data ?? []
    const desktopInfo = await this.resolveDesktopInfo(windows)
    const entries = windows.map((windowInfo, index) => this.buildEntry(windowInfo, index, null, Date.now(), false, desktopInfo.get(windowInfo.hwnd)?.desktopId ?? null))
    return thumbnailGroupsResponseSchema.parse({
      groups: this.resolver.buildGroups(entries),
      generatedAt: Date.now()
    })
  }

  async setAlias(input: unknown): Promise<ThumbnailWindowAliasResponse> {
    const request = thumbnailWindowAliasRequestSchema.parse(input)
    const windowsResult = await this.windowManager.scanWindows(false)
    const windows = windowsResult.data ?? []
    const target = windows.find(windowInfo => windowInfo.hwnd === request.hwnd)
    if (!target) {
      return thumbnailWindowAliasResponseSchema.parse({
        success: false,
        hwnd: request.hwnd,
        error: `Window not found: ${request.hwnd}`
      })
    }
    const success = this.resolver.setAlias(target, request.alias)
    return thumbnailWindowAliasResponseSchema.parse({
      success,
      hwnd: request.hwnd,
      alias: success ? request.alias : undefined,
      error: success ? undefined : 'Alias manager unavailable or rejected the alias'
    })
  }

  saveViewportConfig(input: unknown): ThumbnailViewportConfigResponse {
    this.viewport = thumbnailWallViewportSchema.parse(input)
    return thumbnailViewportConfigResponseSchema.parse({
      viewport: this.viewport,
      savedAt: Date.now()
    })
  }

  dispose(): void {
    this.queue.clear()
    this.cache.clear()
    this.desktopInfoCache.clear()
  }

  private async resolveWindowsForRequest(request: ThumbnailBatchRequest): Promise<WindowInfo[]> {
    const cachedWindows = this.windowManager.getCachedWindows?.() ?? []
    const requested = new Set(dedupeHwnds(request.hwnds))
    if (requested.size > 0 && cachedWindows.length > 0 && [...requested].every(hwnd => cachedWindows.some(windowInfo => windowInfo.hwnd === hwnd))) {
      return cachedWindows
    }

    const windowsResult = await this.windowManager.scanWindows(false)
    return windowsResult.data ?? []
  }

  private async captureForWindows(request: ThumbnailBatchRequest, windows: readonly WindowInfo[]): Promise<ThumbnailBatchResponse> {
    const generatedAt = Date.now()
    const hwnds = dedupeHwnds(request.hwnds)
    const windowsByHwnd = new Map(windows.map(windowInfo => [windowInfo.hwnd, windowInfo]))
    const requestedWindows = hwnds.map(hwnd => windowsByHwnd.get(hwnd)).filter((windowInfo): windowInfo is WindowInfo => Boolean(windowInfo))
    const entries: ThumbnailWallEntry[] = []
    const desktopInfo = await this.resolveDesktopInfo(requestedWindows)
    let cacheHits = 0
    let captured = 0
    let failed = 0
    const uncachedWindows: WindowInfo[] = []

    for (const windowInfo of requestedWindows) {
      const cached = this.getFreshCache(windowInfo.hwnd, request.maxAgeMs, request.thumbnailSize)
      if (cached) {
        cacheHits += 1
        entries.push(this.buildEntry(windowInfo, requestedWindows.indexOf(windowInfo), cached, generatedAt, false, desktopInfo.get(windowInfo.hwnd)?.desktopId ?? null))
      } else {
        uncachedWindows.push(windowInfo)
      }
    }

    const nativeMap = uncachedWindows.length > 0 ? await this.captureNativeMap(uncachedWindows, request.thumbnailSize) : new Map<number, ThumbnailCacheEntry>()
    const missingNativeWindows = uncachedWindows.filter(windowInfo => !nativeMap.has(windowInfo.hwnd))
    const sourceMap = missingNativeWindows.length > 0 ? await this.captureSourceMap(request.thumbnailSize) : new Map<number, ThumbnailCacheEntry>()
    for (const windowInfo of uncachedWindows) {
      const source = nativeMap.get(windowInfo.hwnd) ?? sourceMap.get(windowInfo.hwnd)
      if (source) {
        captured += 1
        this.cache.set(windowInfo.hwnd, source)
        entries.push(this.buildEntry(windowInfo, requestedWindows.indexOf(windowInfo), source, generatedAt, false, desktopInfo.get(windowInfo.hwnd)?.desktopId ?? null))
      } else {
        failed += 1
        const staleCache = this.cache.get(windowInfo.hwnd) ?? null
        entries.push(this.buildEntry(windowInfo, requestedWindows.indexOf(windowInfo), staleCache, generatedAt, Boolean(staleCache), desktopInfo.get(windowInfo.hwnd)?.desktopId ?? null))
      }
    }

    const source = nativeMap.size > 0 ? 'win32-printwindow' : captured > 0 ? 'electron-desktop-capturer' : cacheHits > 0 ? 'cache' : 'unavailable'
    return thumbnailBatchResponseSchema.parse({ entries, captured, cacheHits, failed, generatedAt, source })
  }

  private async captureNativeMap(windows: readonly WindowInfo[], size = DEFAULT_THUMBNAIL_SIZE): Promise<Map<number, ThumbnailCacheEntry>> {
    const win32Capturer = this.win32Capturer
    if (!win32Capturer) return new Map()
    const pairs = await Promise.all(windows.map(async (windowInfo) => {
      try {
        const result = await this.queue.add(() => win32Capturer.capture(windowInfo, size), { timeout: THUMBNAIL_LIMITS.CAPTURE_TIMEOUT_MS })
        return result ? [windowInfo.hwnd, result] as const : null
      } catch (error) {
        if (process.env.DEVHUB_THUMBNAIL_DEBUG === '1') {
          console.warn('[thumbnail:win32]', 'capture-error', {
            error: error instanceof Error ? error.message : String(error),
            hwnd: windowInfo.hwnd
          })
        }
        return null
      }
    }))
    const captured = new Map<number, ThumbnailCacheEntry>()
    for (const pair of pairs) {
      if (!pair) continue
      captured.set(pair[0], {
        capturedAt: pair[1].capturedAt,
        dataUrl: pair[1].dataUrl,
        height: pair[1].height,
        width: pair[1].width
      })
    }
    return captured
  }

  private async captureSourceMap(size: ThumbnailSize = DEFAULT_THUMBNAIL_SIZE): Promise<Map<number, ThumbnailCacheEntry>> {
    const capturer = this.capturer
    if (!capturer) return new Map()
    try {
      return await this.queue.add(async () => {
        const sources = await capturer.getSources({
          types: ['window'],
          thumbnailSize: size,
          fetchWindowIcons: false
        })
        const capturedAt = Date.now()
        const sourceMap = new Map<number, ThumbnailCacheEntry>()
        for (const source of sources) {
          const hwnd = parseDesktopSourceHwnd(source.id)
          if (!hwnd || source.thumbnail.isEmpty()) continue
          const dataUrl = source.thumbnail.toDataURL()
          if (!isDataUrl(dataUrl)) continue
          sourceMap.set(hwnd, {
            dataUrl,
            capturedAt,
            width: size.width,
            height: size.height
          })
        }
        return sourceMap
      }, { timeout: THUMBNAIL_LIMITS.CAPTURE_TIMEOUT_MS }) ?? new Map()
    } catch {
      return new Map()
    }
  }

  private getFreshCache(hwnd: number, maxAgeMs: number, size: ThumbnailSize = DEFAULT_THUMBNAIL_SIZE): ThumbnailCacheEntry | null {
    const cached = this.cache.get(hwnd)
    if (!cached) return null
    if (cached.width !== size.width || cached.height !== size.height) return null
    if (Date.now() - cached.capturedAt > maxAgeMs) return null
    return cached
  }

  private buildEntry(
    windowInfo: WindowInfo,
    launchOrder: number,
    cache: ThumbnailCacheEntry | null,
    generatedAt: number,
    staleCache: boolean,
    desktopId: string | null
  ): ThumbnailWallEntry {
    const resolved = this.resolver.resolveFingerprint(windowInfo, launchOrder)
    return thumbnailWallEntrySchema.parse({
      hwnd: windowInfo.hwnd,
      fingerprintHash: resolved.fingerprintHash,
      thumbnailDataUrl: cache?.dataUrl ?? null,
      capturedAt: cache?.capturedAt ?? 0,
      isStale: staleCache || !cache || generatedAt - cache.capturedAt > this.viewport.showStaleAfterMs || windowInfo.isMinimized,
      groupId: resolved.fingerprintHash,
      alias: resolved.alias,
      pid: windowInfo.pid,
      title: windowInfo.title,
      exe: windowInfo.processName,
      cwd: resolved.cwd,
      launchOrder: resolved.launchOrder,
      monitorId: this.resolveMonitorId(windowInfo),
      desktopId
    })
  }

  private resolveMonitorId(windowInfo: WindowInfo): number {
    const monitors = this.windowManager.getMonitorInfo()
    const index = monitors.findIndex(monitor => isInside(windowInfo.rect, monitor))
    return index >= 0 ? index : 0
  }

  private async resolveDesktopInfo(windows: readonly WindowInfo[]): Promise<Map<number, { desktopId: string | null }>> {
    if (!this.virtualDesktopProvider || windows.length === 0) return new Map()
    const now = Date.now()
    const resolved = new Map<number, { desktopId: string | null }>()
    const missingWindows: WindowInfo[] = []
    for (const windowInfo of windows) {
      const cached = this.desktopInfoCache.get(windowInfo.hwnd)
      if (cached && now - cached.capturedAt <= DESKTOP_INFO_CACHE_TTL_MS) {
        resolved.set(windowInfo.hwnd, { desktopId: cached.desktopId })
      } else {
        missingWindows.push(windowInfo)
      }
    }
    if (missingWindows.length === 0) return resolved

    const monitorIdByHwnd = new Map(missingWindows.map(windowInfo => [windowInfo.hwnd, this.resolveMonitorId(windowInfo)]))
    try {
      const response = await this.virtualDesktopProvider.getWindowInfo(missingWindows.map(windowInfo => windowInfo.hwnd), monitorIdByHwnd)
      const responseByHwnd = new Map(response.info.map(info => [info.hwnd, info.desktopId]))
      for (const windowInfo of missingWindows) {
        const desktopId = responseByHwnd.get(windowInfo.hwnd) ?? null
        this.desktopInfoCache.set(windowInfo.hwnd, { desktopId, capturedAt: now })
        resolved.set(windowInfo.hwnd, { desktopId })
      }
      return resolved
    } catch {
      return resolved
    }
  }
}

export const thumbnailServiceInternals = {
  parseDesktopSourceHwnd
}
