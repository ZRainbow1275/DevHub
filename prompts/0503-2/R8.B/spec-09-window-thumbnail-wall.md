# Spec R8.B-09 — 窗口缩略图墙（Mission Control 风格 + 实例消歧）

> **flag**: `R8.B.window.thumbnail-wall`
> **priority**: P0（V1-Q-6 窗口模块核心）
> **status**: planning
> **upstream**: R8.A spec-08（窗口操作矩阵）+ R8.A spec-02 ProcessUnifiedViewModel
> **downstream**: R8.B spec-10（批量操作）+ R8.B spec-11（虚拟桌面）+ R8.C spec-08（监控窗口）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-6.A.1
  answer: "Card + List + Thumbnail Wall"
  - id: V1-Q-6.B (实例消歧)
  answer: "(exe, title_pattern, cwd, alias, launchOrder) 五元组"
  - id: V2-Q-12.G
  answer: "E"  # 多对象对比 + 同步滚动 + 差异高亮
  - id: USER-FEEDBACK-1.1
  quote: "显示太不均匀"
  impact: "Thumbnail Wall 让 30+ 窗口可一屏概览"
```

### 1.2 现状缺陷

```
devhub/src/renderer/components/monitor/WindowView.tsx
  - 仅 Card / List 视图
  - 无 thumbnail（需调 Win32 PrintWindow / DwmGetWindowAttribute）
  - 无 Mission Control 网格 + 缩放
  - 实例消歧未实现（同一 EXE 多窗口无法分组）
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 单窗口截图 P95 | < 200ms |
| Thumbnail Wall 平移缩放 | 60fps |
| 缩略图刷新间隔 | 5s（用户可调 2-60s） |
| 实例消歧分组 | (exe, title_pattern, cwd, alias, launchOrder) |
| 视图模式 | wall / list / grid 3 模式 |
| 节点 > 200 时降级 | viewport 内缩略 + 懒加载 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer/components/monitor/WindowView.tsx
  - devhub/src/main/services/WindowService.ts
  - devhub/src/main/native/win32-windows.ts
  - R8.A spec-08 always-on-top IPC
modify:
  - devhub/src/renderer/components/monitor/WindowView.tsx  # 加 wall 模式
  - devhub/src/main/services/WindowService.ts  # 加 captureThumbnail
  - devhub/src/main/native/win32-windows.ts  # PrintWindow / DwmGetWindowAttribute
new:
  - devhub/src/renderer/components/monitor/window/ThumbnailWall.tsx
  - devhub/src/renderer/components/monitor/window/ThumbnailTile.tsx
  - devhub/src/renderer/components/monitor/window/ThumbnailGroupHeader.tsx
  - devhub/src/renderer/components/monitor/window/WallToolbar.tsx
  - devhub/src/renderer/hooks/useWindowThumbnails.ts
  - devhub/src/renderer/hooks/useThumbnailViewport.ts
  - devhub/src/renderer/utils/windowGroupKey.ts  # 五元组 hash
  - devhub/src/main/services/ThumbnailService.ts
  - devhub/src/main/services/WindowGroupResolver.ts  # 分组 / alias
  - devhub/src/main/ipc/thumbnailHandlers.ts
test:
  - devhub/src/renderer/utils/windowGroupKey.test.ts
  - devhub/src/main/services/ThumbnailService.test.ts
  - devhub/tests/e2e/window-thumbnail-wall.spec.ts
docs:
  - docs/r8/window-thumbnail-wall.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const WindowViewModeSchema = z.enum(['card', 'list', 'wall'])

export const ThumbnailWallEntrySchema = z.object({
  hwnd: z.number().int().positive(),
  fingerprintHash: z.string(),
  thumbnailDataUrl: z.string().nullable(),
  capturedAt: z.number().int(),
  isStale: z.boolean(),
  groupId: z.string().nullable(),
  alias: z.string().nullable(),
  pid: z.number().int(),
  title: z.string(),
  exe: z.string(),
  cwd: z.string().optional(),
  launchOrder: z.number().int().optional(),
  monitorId: z.number().int(),
  desktopId: z.string().nullable(),
})

export const ThumbnailWallViewportSchema = z.object({
  zoomLevel: z.enum(['xs', 'sm', 'md', 'lg']).default('md'),
  filterText: z.string().default(''),
  groupBy: z.enum(['none', 'group', 'monitor', 'desktop', 'exe']).default('group'),
  refreshIntervalMs: z.number().int().min(2000).max(60000).default(5000),
  showStaleAfterMs: z.number().int().default(15000),
})

export const WindowGroupSchema = z.object({
  id: z.string(),
  exe: z.string(),
  titlePattern: z.string().optional(),
  cwd: z.string().optional(),
  alias: z.string().optional(),
  launchOrder: z.number().int().optional(),
  members: z.array(z.number().int()),  // hwnd[]
})

export const THUMBNAIL_LIMITS = {
  CAPTURE_TIMEOUT_MS: 800,
  REFRESH_DEFAULT_MS: 5000,
  MAX_PARALLEL_CAPTURES: 4,
  TILE_W_BY_ZOOM: { xs: 120, sm: 180, md: 240, lg: 360 },
  TILE_H_BY_ZOOM: { xs: 80, sm: 120, md: 160, lg: 240 },
  LAZY_THRESHOLD: 200,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  window:thumbnails-batch:
  request: { hwnds: number[], maxAge_ms: number }
  response: { entries: ThumbnailWallEntry[] }
  rate_limit: medium_freq_op (300 rpm)
  window:thumbnail-refresh:
  request: { hwnd: number }
  response: { entry: ThumbnailWallEntry }
  window:groups:
  response: { groups: WindowGroup[] }
  window:set-alias:
  request: { hwnd: number, alias: string }
  window:viewport-config:
  request: ThumbnailWallViewportSchema
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'PrintWindow 失败（GPU/权限）'
  code: E_CAPTURE_FAILED
  handling: '降级到 DWM thumbnail / 占位图'
  - condition: '窗口最小化（不可截图）'
  handling: '使用上次缓存 + isStale=true'
  - condition: '4 并发截图阻塞'
  code: E_RATE_LIMITED
  handling: '排队 + drop 最旧请求'
  - condition: 'hwnd 已不存在'
  code: E_NOT_FOUND
  handling: '从墙上自动移除'
  - condition: '截图 > 200ms（性能预算）'
  handling: '记录 + 自动降低 refreshInterval'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — Wall 模式
Given 用户进入窗口 Tab
Then 视图模式按钮显示 3 个：Card / List / Wall
When 用户点击 Wall
Then 显示缩略图墙

# A2 — 实例消歧分组
Given 同 EXE = chrome.exe 启动了 3 个窗口（不同 cwd）
Then Wall 上 3 窗口分别显示 + 自动 alias 由 (exe, title, cwd, launchOrder) 推断
  And 用户可手动 set-alias

# A3 — 缩略图刷新
Given Wall 显示 + refreshIntervalMs = 5000
Then 每 5 秒批量刷新 thumbnails
  And 单截图 P95 < 200ms

# A4 — Stale 标记
Given thumbnail 上次截图 > 15s 前
Then 显示 stale 标识（半透明 + 时钟图标）

# A5 — Zoom 4 档
Given Wall 显示
When 用户切到 zoomLevel = lg
Then tile 尺寸 = 360x240
  And 60fps 缩放过渡

# A6 — Group by monitor
Given 用户选 groupBy = monitor
Then 每个 monitor 一个分组 header
  And tile 按 monitor 排列

# A7 — > 200 节点降级
Given 窗口数 = 250
Then 仅渲染 viewport 内的缩略 + 懒加载其他
  And 滚动时按需加载

# A8 — Filter 实时
Given 用户输入 "code"
Then 仅显示 title 含 code 的 tile（保持分组）

# A9 — Click 跳转 / Tile 操作
Given Wall 上一个 tile
When 用户单击
Then 主进程 focus 该窗口（V1-Q-6 操作矩阵）

When 用户右键
Then 上下文菜单显示：focus / minimize / close / aot / screenshot / rename / inject

# A10 — Batch select
Given 用户 Ctrl+Click 多个 tile
Then 多选状态进入 + 状态栏显示"已选 N 个"
  And 与 spec-10 联动批量操作
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/window-thumbnail-wall.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('wall mode renders thumbnails', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="window"]')
  await page.click('[data-view-mode="wall"]')
  const tiles = await page.getByTestId(/^thumbnail-tile-/).count()
  expect(tiles).toBeGreaterThan(0)
  await app.close()
})

test('group by monitor', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="window"]')
  await page.click('[data-view-mode="wall"]')
  await page.getByTestId('wall-toolbar-groupby').selectOption('monitor')
  const headers = await page.getByTestId(/^group-header-monitor-/).count()
  expect(headers).toBeGreaterThan(0)
  await app.close()
})

test('zoom level switch 60fps', async () => {
  // perf 测试在 bench-thumbnail-zoom.mjs 中
})
```

---

## 8. reference_impl

### 8.1 windowGroupKey 五元组 hash

```typescript
import { sha256 } from 'js-sha256'

export function windowGroupKey(w: { exe: string, title: string, cwd?: string, alias?: string, launchOrder?: number }): string {
  const titlePattern = w.title
  .replace(/\d+/g, 'N')
  .replace(/v\d+\.\d+\.\d+/g, 'vN')
  .replace(/\s+/g, ' ')
  .trim()
  return sha256([w.exe, titlePattern, w.cwd ?? '', w.alias ?? '', w.launchOrder ?? -1].join('|'))
}
```

### 8.2 ThumbnailService（Win32 PrintWindow）

```typescript
import { app } from 'electron'
import koffi from 'koffi'

const user32 = koffi.load('user32.dll')
const PrintWindow = user32.func('int __stdcall PrintWindow(void *hWnd, void *hdc, int flags)')

export class ThumbnailService {
  private queue = new PQueue({ concurrency: THUMBNAIL_LIMITS.MAX_PARALLEL_CAPTURES })

  async capture(hwnd: number): Promise<string> {
  return this.queue.add(() => this._capture(hwnd), { timeout: THUMBNAIL_LIMITS.CAPTURE_TIMEOUT_MS })
  }
  private async _capture(hwnd: number): Promise<string> {
  // 调用 native PrintWindow / DwmGetWindowAttribute -> capture bitmap
  // 转 PNG dataURL
  return 'data:image/png;base64,...'
  }
}
```

### 8.3 ThumbnailWall

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function ThumbnailWall() {
  const { entries, viewport } = useWindowThumbnails()
  const containerRef = useRef<HTMLDivElement>(null)
  const tileSize = THUMBNAIL_LIMITS.TILE_W_BY_ZOOM[viewport.zoomLevel]

  const rowVirtualizer = useVirtualizer({
  count: Math.ceil(entries.length / 6),
  getScrollElement: () => containerRef.current,
  estimateSize: () => tileSize + 16,
  overscan: 3,
  })

  return (
  <div ref={containerRef} className="thumbnail-wall" data-testid="thumbnail-wall">
  {rowVirtualizer.getVirtualItems().map(virtualRow => (
  <div key={virtualRow.key} style={{ transform: `translateY(${virtualRow.start}px)` }}>
  {entries.slice(virtualRow.index * 6, (virtualRow.index + 1) * 6).map(e => (
  <ThumbnailTile key={e.hwnd} entry={e} />
  ))}
  </div>
  ))}
  </div>
  )
}
```

### 8.4 关键参考链接

- PrintWindow API：https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-printwindow
- DwmGetWindowAttribute：https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmgetwindowattribute
- @tanstack/react-virtual：https://tanstack.com/virtual/

---

## 9. impact_radius_loc

```yaml
new_files: 11
modified_files: 3
estimated_loc:
  ThumbnailWall.tsx: 280
  ThumbnailTile.tsx: 130
  ThumbnailGroupHeader.tsx: 70
  WallToolbar.tsx: 90
  useWindowThumbnails.ts: 130
  useThumbnailViewport.ts: 80
  windowGroupKey.ts: 50
  ThumbnailService.ts: 280
  WindowGroupResolver.ts: 180
  thumbnailHandlers.ts: 120
  WindowView.tsx (modify): +60
  WindowService.ts (modify): +60
  win32-windows.ts (modify): +80
  tests: 380
total_loc: ~2090
risk_level: high (native API 稳定性)
```

---

## 10. implement_checklist

- [x] 安装 koffi（已存在）+ p-queue ^8.0.0
- [x] 实现 ThumbnailService（Win32 PrintWindow / DwmGetWindowAttribute）
- [x] 实现 4 并发限流 + 800ms 超时
- [x] 实现 WindowGroupResolver（五元组 hash + alias 持久化）
- [x] 实现 ThumbnailWall + 虚拟化 + 4 zoom 档
- [x] 实现 WallToolbar（filter / groupBy / refreshInterval）
- [x] IPC：thumbnails-batch / thumbnail-refresh / groups / set-alias / viewport-config
- [x] 与 spec-10 联动（多选 + 批量）
- [x] 与 spec-11 联动（虚拟桌面分组）
- [x] 单元 + e2e
- [x] 文档：docs/r8/window-thumbnail-wall.md
- [x] 验收 ASSERT_THUMBNAIL_WALL_GROUP_KEY 通过

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-08 always-on-top IPC
  - R8.A spec-02 ProcessUnifiedViewModel（pid 关联）
sibling_libs:
  - koffi: 已存在
  - p-queue: ^8.0.0
  - @tanstack/react-virtual: ^3.13.18（已存在）
  - js-sha256 或 crypto.subtle
downstream_specs:
  - R8.B spec-10 批量操作
  - R8.B spec-11 虚拟桌面
  - R8.C spec-08 监控窗口（截图复用）
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: PrintWindow 失败
  action: DwmGetWindowAttribute 备用 / 占位图标
  - condition: 截图卡顿
  action: refreshInterval 自动从 5s → 10s → 30s
  - condition: > 200 节点
  action: viewport 内 + 懒加载
  - condition: alias 持久化失败
  action: in-memory，提示用户
flag_disable: 关闭 R8.B.window.thumbnail-wall 时仅 Card / List
```

---

## 13. performance_budget

```yaml
budgets:
  capture_p95_ms: 200
  capture_p99_ms: 500
  wall_render_60fps: true
  zoom_transition_ms: 200
  filter_debounce_ms: 100
  parallel_captures_max: 4
test_harness:
  - benchmark: bench-thumbnail-capture.mjs
  target: 100 hwnd 连续截图 p95 < 200ms
  - benchmark: bench-wall-zoom.mjs
  target: zoom 4 档切换 60fps
```

---

## 14. implementation_status

```yaml
status_date: 2026-05-19
evidence_status: verified
checked_checkboxes: 12
open_checkboxes: 0
implemented:
  - Shared Zod contract slice in `devhub/src/shared/schemas/r8-runtime.ts`:
  - `windowThumbnailViewModeSchema`
  - `thumbnailWallEntrySchema`
  - `thumbnailWallViewportSchema`
  - `thumbnailWindowGroupSchema`
  - `THUMBNAIL_LIMITS`
  - Renderer five-tuple grouping utility in `devhub/src/renderer/utils/windowGroupKey.ts`.
  - `ThumbnailWall` real metadata wall in `devhub/src/renderer/components/monitor/window/ThumbnailWall.tsx`.
  - Tile, toolbar, group header, and viewport hook for filter/group/refresh/zoom.
  - `WindowView.tsx` wall mode integration without removing card/list/process modes.
  - Ctrl/Cmd multi-select and checkbox selection are wired to the existing `selectedWindows` batch toolbar path.
  - `ViewModeToggle` exposes `data-view-mode` selectors for R8.B/E2E selectors.
  - Main-process `ThumbnailService` in `devhub/src/main/services/ThumbnailService.ts`:
  - `p-queue@8.1.0` concurrency capped by `THUMBNAIL_LIMITS.MAX_PARALLEL_CAPTURES = 4`.
  - Per-capture timeout capped by `THUMBNAIL_LIMITS.CAPTURE_TIMEOUT_MS = 800`.
  - Reuses `WindowManager.getCachedWindows()` when the requested HWNDs are already known, avoiding a per-refresh PowerShell/window scan.
  - Falls back from Win32 native capture to Electron `desktopCapturer`, then bounded cache/unavailable states without fabricating images.
  - Batch-queries the spec-11 `VirtualDesktopService` provider and propagates real COM-backed `desktopId` values into thumbnail entries when Windows returns them.
  - Keeps a bounded 30s virtual-desktop metadata cache during rapid refreshes, preventing release-scale thumbnail loops from repeating Windows COM/registry desktop lookups per HWND while preserving truthful `null` for unavailable provider data.
  - Win32 native capture in `devhub/src/main/services/integrations/Win32ThumbnailCapturer.ts`:
  - `koffi` loads `user32.dll`, `gdi32.dll`, and `dwmapi.dll` through the shared optional native import path.
  - `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)` provides real DWM frame bounds when available.
  - `StretchBlt` copies the real visible HWND surface directly into the target thumbnail bitmap for the fast visible-window path, with `BitBlt` and `PrintWindow(PW_RENDERFULLCONTENT)` as real GDI/Win32 fallbacks.
  - `GetDIBits` feeds `nativeImage.createFromBitmap(...).toDataURL()` to produce real PNG data URLs.
  - Dedicated Koffi struct name avoids global `RECT` collisions with the existing Win32 enumerator.
  - Shared optional native imports in `devhub/src/main/services/integrations/nativeImport.ts` now use `createRequire(import.meta.url)` before dynamic import, fixing Electron main-process native module loading while preserving the previous ESM fallback.
  - Main-process `WindowGroupResolver` persists aliases through the existing `AIAliasManager` path and builds five-tuple group identities.
  - Executable thumbnail IPC is registered in `devhub/src/main/ipc/windowHandlers.ts` for:
  - `window:thumbnails-batch`
  - `window:thumbnail-refresh`
  - `window:groups`
  - `window:set-alias`
  - `window:viewport-config`
  - `devhub/src/preload/extended.ts` and renderer global typings expose the thumbnail bridge to `window.devhub.windowManager`.
  - `useWindowThumbnails` consumes the real preload bridge and preserves truthful metadata fallback only when native/electron capture is unavailable.
  - `scripts/bench-thumbnail-capture.mjs` now defaults to measured per-window p95/p99 capture timing, writes an optional JSON report artifact, and uses bounded release-scale probe hosts of 10 real WinForms HWNDs each instead of launching 100 PowerShell processes.
  - Documentation in `devhub/docs/r8/window-thumbnail-wall.md`.
verified:
  - `pnpm -C devhub test --run src/renderer/utils/windowGroupKey.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"` passed with 2 files and 8 tests.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub check:zod-sot` passed.
  - `pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/ThumbnailService.ts src/main/services/ThumbnailService.test.ts src/main/services/integrations/Win32ThumbnailCapturer.ts src/main/services/integrations/nativeImport.ts e2e/window-thumbnail-wall.spec.ts scripts/bench-thumbnail-capture.mjs --max-warnings=0` passed.
  - `pnpm -C devhub exec eslint src/main/services/ThumbnailService.ts src/main/services/ThumbnailService.test.ts src/main/services/integrations/Win32ThumbnailCapturer.ts scripts/bench-thumbnail-capture.mjs --max-warnings=0` passed.
  - `pnpm -C devhub exec vitest run src/main/services/ThumbnailService.test.ts --maxWorkers=1` passed with 1 file and 8 tests.
  - `pnpm -C devhub build` passed; the only warning was the pre-existing Monaco static/dynamic import chunk warning.
  - `pnpm -C devhub bench:thumbnail-capture` passed with `sourceCounts.win32-printwindow = 3`, `targetWindowCount = 3`, `measuredCaptured = 3`, `totalCaptured = 9`, `p95 = 5.8ms`, and `p99 = 5.8ms` under the 200ms / 500ms budgets.
  - `THUMBNAIL_CAPTURE_WINDOWS=100 THUMBNAIL_CAPTURE_MODE=per-window THUMBNAIL_CAPTURE_REPORT_PATH="D:/Desktop/CREATOR ONE/.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/thumbnail-capture-100hwnd-2026-05-19.json" pnpm -C devhub bench:thumbnail-capture` passed with 100 distinct real WinForms HWNDs, 10 bounded host processes, `measuredCaptured = 100`, `sourceCounts.win32-printwindow = 100`, `uniqueHwndCount = 100`, `totalCaptured = 300`, `p95 = 10.8ms`, and `p99 = 11.9ms`.
  - `pnpm -C devhub test:e2e --grep "R8.B spec-09" --reporter=line` passed with 1 real Electron Playwright test covering a real WinForms HWND, native PNG thumbnail capture, `groupId === fingerprintHash`, alias persistence, and group membership.
  - `pnpm -C devhub test:e2e --grep "R8.B spec-11" --reporter=line` passed with 1 real packaged Electron test covering real HWND `window:vd-info`, GUID `desktopId`, thumbnail-wall `desktopId` propagation, real monitor move, and truthful `MoveWindowToDesktop` success/error semantics.
truth_boundary:
  - Current native thumbnails are real PNG data URLs from Win32/DWM/GDI capture.
  - When native capture fails, the service falls back to Electron `desktopCapturer`, then cache/unavailable states; it still does not fabricate screenshots.
  - `desktopId` is non-null only when the spec-11 COM/registry virtual desktop provider resolves a real Windows desktop GUID; COM, registry, or permission failures remain truthful `null` / unavailable states.
  - The 100-HWND benchmark uses real visible WinForms top-level windows and real Win32/GDI capture calls; warmup captures are reported separately through `totalCaptured`, and measured p95/p99 are computed from the 100 measured per-HWND capture requests.
```
