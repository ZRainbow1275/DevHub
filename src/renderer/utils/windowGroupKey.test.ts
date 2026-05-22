import { describe, expect, it } from 'vitest'
import type { WindowInfo } from '@shared/types-extended'
import {
  buildThumbnailWallEntries,
  groupThumbnailWallEntries,
  inferMonitorId,
  normalizeWindowTitlePattern,
  windowGroupKey
} from './windowGroupKey'

const windowFixtures: WindowInfo[] = [
  {
    hwnd: 101,
    title: 'DevHub 1.2.3 - Project 42',
    processName: 'Code.exe',
    pid: 4001,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 100, y: 80, width: 1280, height: 800 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false
  },
  {
    hwnd: 102,
    title: 'DevHub 1.2.4 - Project 77',
    processName: 'Code.exe',
    pid: 4002,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 2100, y: 80, width: 1280, height: 800 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false
  }
]

describe('R8.B window group key', () => {
  it('normalizes volatile title numbers into a stable title pattern', () => {
    expect(normalizeWindowTitlePattern('DevHub 1.2.3 - Project 42')).toBe('devhub vn - project n')
    expect(normalizeWindowTitlePattern('DevHub 2.0.0 - Project 77')).toBe('devhub vn - project n')
  })

  it('uses the full five-tuple for deterministic instance disambiguation', () => {
    const base = windowGroupKey({
      exe: 'Code.exe',
      title: 'DevHub 1.2.3 - Project 42',
      cwd: 'D:/Desktop/CREATOR ONE',
      alias: 'DevHub main',
      launchOrder: 1
    })
    const same = windowGroupKey({
      exe: 'code.exe',
      title: 'DevHub 9.9.9 - Project 99',
      cwd: 'd:/desktop/creator one',
      alias: 'devhub main',
      launchOrder: 1
    })
    const changedLaunch = windowGroupKey({
      exe: 'Code.exe',
      title: 'DevHub 1.2.3 - Project 42',
      cwd: 'D:/Desktop/CREATOR ONE',
      alias: 'DevHub main',
      launchOrder: 2
    })

    expect(same).toBe(base)
    expect(changedLaunch).not.toBe(base)
  })

  it('builds Zod-validated thumbnail entries from real window metadata without synthetic screenshots', () => {
    const entries = buildThumbnailWallEntries(windowFixtures, {
      getDisplayName: (windowInfo) => windowInfo.hwnd === 101 ? 'DevHub main' : windowInfo.processName,
      getLaunchOrder: (_windowInfo, index) => index + 1
    })

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      hwnd: 101,
      thumbnailDataUrl: null,
      capturedAt: 0,
      isStale: true,
      alias: 'DevHub main'
    })
    expect(entries[1]?.alias).toBeNull()
    expect(inferMonitorId(windowFixtures[1].rect)).toBe(1)
  })

  it('groups entries by monitor and executable without losing members', () => {
    const entries = buildThumbnailWallEntries(windowFixtures)
    const byMonitor = groupThumbnailWallEntries(entries, 'monitor')
    const byDesktop = groupThumbnailWallEntries(entries, 'desktop')
    const byExe = groupThumbnailWallEntries(entries, 'exe')

    expect(byMonitor).toHaveLength(2)
    expect(byDesktop).toHaveLength(1)
    expect(byDesktop[0]?.label).toBe('当前桌面')
    expect(byMonitor.reduce((sum, group) => sum + group.entries.length, 0)).toBe(2)
    expect(byExe).toHaveLength(1)
    expect(byExe[0]?.entries.map(entry => entry.hwnd)).toEqual([101, 102])
  })
})
