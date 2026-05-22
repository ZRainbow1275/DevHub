import type { WindowInfo } from '@shared/types-extended'
import {
  thumbnailWallEntrySchema,
  type ThumbnailWallEntry,
  type ThumbnailWallViewport
} from '@shared/schemas/r8-runtime'

export interface WindowGroupIdentity {
  exe: string
  title: string
  cwd?: string
  alias?: string
  launchOrder?: number
}

export interface BuildThumbnailEntryOptions {
  getDisplayName?: (windowInfo: WindowInfo) => string
  getWorkingDirectory?: (windowInfo: WindowInfo) => string | undefined
  getLaunchOrder?: (windowInfo: WindowInfo, index: number) => number | undefined
}

function normalizeToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function normalizeWindowTitlePattern(title: string): string {
  return title
    .normalize('NFKC')
    .replace(/\bv?\d+(?:\.\d+){1,}\b/gi, 'vN')
    .replace(/\b\d+\b/g, 'N')
    .replace(/[0-9a-f]{8,}/gi, 'HASH')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function hashWindowGroupIdentity(identity: WindowGroupIdentity): string {
  const payload = [
    normalizeToken(identity.exe),
    normalizeWindowTitlePattern(identity.title),
    normalizeToken(identity.cwd),
    normalizeToken(identity.alias),
    String(identity.launchOrder ?? -1)
  ].join('|')
  let hash = 0x811c9dc5
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function windowGroupKey(identity: WindowGroupIdentity): string {
  return `wg_${hashWindowGroupIdentity(identity)}`
}

export function inferMonitorId(rect: WindowInfo['rect']): number {
  const centerX = rect.x + rect.width / 2
  if (!Number.isFinite(centerX)) return 0
  return Math.max(0, Math.floor(centerX / 1920))
}

export function buildThumbnailWallEntries(
  windows: readonly WindowInfo[],
  options: BuildThumbnailEntryOptions = {}
): ThumbnailWallEntry[] {
  return windows.map((windowInfo, index) => {
    const displayName = options.getDisplayName?.(windowInfo).trim()
    const alias = displayName && displayName !== windowInfo.processName ? displayName : null
    const cwd = options.getWorkingDirectory?.(windowInfo)
    const launchOrder = options.getLaunchOrder?.(windowInfo, index)
    const fingerprintHash = windowGroupKey({
      exe: windowInfo.processName,
      title: windowInfo.title,
      cwd,
      alias: alias ?? undefined,
      launchOrder
    })
    return thumbnailWallEntrySchema.parse({
      hwnd: windowInfo.hwnd,
      fingerprintHash,
      thumbnailDataUrl: null,
      capturedAt: 0,
      isStale: true,
      groupId: fingerprintHash,
      alias,
      pid: windowInfo.pid,
      title: windowInfo.title,
      exe: windowInfo.processName,
      cwd,
      launchOrder,
      monitorId: inferMonitorId(windowInfo.rect),
      desktopId: null
    })
  })
}

export interface ThumbnailEntryGroup {
  id: string
  label: string
  entries: ThumbnailWallEntry[]
}

function groupLabel(entry: ThumbnailWallEntry, groupBy: ThumbnailWallViewport['groupBy']): string {
  if (groupBy === 'monitor') return `显示器 ${entry.monitorId + 1}`
  if (groupBy === 'desktop') return entry.desktopId ? `桌面 ${entry.desktopId}` : '当前桌面'
  if (groupBy === 'exe') return entry.exe
  if (groupBy === 'group') return entry.alias ?? `${entry.exe} / ${normalizeWindowTitlePattern(entry.title) || 'untitled'}`
  return '全部窗口'
}

function groupId(entry: ThumbnailWallEntry, groupBy: ThumbnailWallViewport['groupBy']): string {
  if (groupBy === 'monitor') return `monitor-${entry.monitorId}`
  if (groupBy === 'desktop') return `desktop-${entry.desktopId ?? 'current'}`
  if (groupBy === 'exe') return `exe-${entry.exe.toLowerCase()}`
  if (groupBy === 'group') return entry.groupId ?? entry.fingerprintHash
  return 'all'
}

export function groupThumbnailWallEntries(
  entries: readonly ThumbnailWallEntry[],
  groupBy: ThumbnailWallViewport['groupBy']
): ThumbnailEntryGroup[] {
  const grouped = new Map<string, ThumbnailEntryGroup>()
  for (const entry of entries) {
    const id = groupId(entry, groupBy)
    const existing = grouped.get(id)
    if (existing) {
      existing.entries.push(entry)
    } else {
      grouped.set(id, { id, label: groupLabel(entry, groupBy), entries: [entry] })
    }
  }
  return [...grouped.values()].sort((left, right) => left.label.localeCompare(right.label))
}
