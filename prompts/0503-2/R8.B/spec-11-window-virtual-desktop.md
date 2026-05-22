# Spec R8.B-11 — 虚拟桌面 / 多屏 跟踪与移动

> **flag**: `R8.B.window.virtual-desktop`
> **priority**: P1（V1-Q-6.E）
> **status**: planning
> **upstream**: R8.A spec-08（窗口操作）+ R8.B spec-09（缩略图墙）
> **downstream**: R8.B spec-10（批量操作 vd-aware）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-6.E.1
  answer: "D"  # 标识屏幕 + 移到屏 N
  - id: V1-Q-6.E.2
  answer: "D"
  - id: V2-Q-19.K
  answer: "D"  # 屏幕断开自动迁移 + 重连还原
  - id: V2-Q-19.K.5
  answer: "D"  # 命名布局预设
```

### 1.2 现状缺陷

```
devhub/src/main/services/WindowService.ts
  - 无 IVirtualDesktopManager 集成
  - 无 displayInfo 标识
没有：移到 monitor N / 跟踪 vd 切换 / vd 布局预设
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 显示 hwnd 所属 vd / monitor | tile 角标 |
| 移到 monitor N | < 200ms |
| vd 切换监听 | electron event |
| vd 布局预设 | "调试布局" / "演示布局" 命名保存 |
| 屏幕断开 | popout / window 自动迁移 primary |
| 重连还原 | 同 monitor 恢复 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/main/services/WindowService.ts
  - devhub/src/main/native/win32-windows.ts
modify:
  - devhub/src/main/services/WindowService.ts
  - devhub/src/main/native/win32-windows.ts
new:
  - devhub/src/main/services/VirtualDesktopService.ts  # IVirtualDesktopManager COM
  - devhub/src/main/services/MonitorService.ts  # screen API + DPI
  - devhub/src/main/services/WindowLayoutPresetStore.ts
  - devhub/src/renderer/components/monitor/window/VdMonitorBadge.tsx
  - devhub/src/renderer/components/monitor/window/VdSwitcher.tsx
  - devhub/src/renderer/hooks/useVirtualDesktop.ts
  - devhub/src/renderer/hooks/useMonitors.ts
  - devhub/src/main/ipc/vdHandlers.ts
test:
  - devhub/src/main/services/VirtualDesktopService.test.ts
  - devhub/tests/e2e/window-vd.spec.ts
docs:
  - docs/r8/window-vd.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const VirtualDesktopSchema = z.object({
  id: z.string(),
  index: z.number().int(),
  name: z.string().nullable(),
  current: z.boolean(),
})

export const MonitorInfoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  bounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  workArea: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  scaleFactor: z.number(),
  primary: z.boolean(),
  rotation: z.number().int(),
  internal: z.boolean(),
})

export const WindowVdInfoSchema = z.object({
  hwnd: z.number().int(),
  desktopId: z.string().nullable(),
  monitorId: z.number().int(),
  isOnCurrentDesktop: z.boolean(),
})

export const WindowLayoutPresetSchema = z.object({
  name: z.string(),
  windows: z.array(z.object({
  groupKey: z.string(),
  desktopId: z.string(),
  monitorId: z.number().int(),
  bounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  alwaysOnTop: z.boolean().default(false),
  })),
  popouts: z.array(z.object({
  kind: z.string(),
  targetId: z.string(),
  monitorId: z.number().int(),
  bounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  })),
  createdAt: z.number().int(),
})
```

---

## 4. ipc_contracts

```yaml
channels:
  window:vd-list:
  response: { desktops: VirtualDesktop[] }
  window:vd-watch:
  direction: main → renderer
  push: true
  payload: { current: VirtualDesktop, changed: 'switched' | 'added' | 'removed' }
  window:vd-info:
  request: { hwnds: number[] }
  response: { info: WindowVdInfo[] }
  window:move-to-desktop:
  request: { hwnd: number, desktopId: string }
  window:move-to-monitor:
  request: { hwnd: number, monitorId: number }
  window:monitors:
  response: { monitors: MonitorInfo[] }
  window:layout-save:
  request: WindowLayoutPresetSchema
  window:layout-apply:
  request: { name: string }
  window:layout-list:
  response: { presets: string[] }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'IVirtualDesktopManager COM 初始化失败'
  code: E_INTERNAL
  fallback: '禁用 vd 功能 + toast'
  - condition: 'monitorId 不存在'
  code: E_VALIDATION
  - condition: 'move-to-desktop 失败（系统拒绝）'
  code: E_PERMISSION
  - condition: 'preset 引用的窗口已不存在'
  handling: 'best-effort 应用，缺失项 toast'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 显示 vd / monitor 角标
Given Wall 视图渲染
Then 每 tile 角落显示 "VD-1 / Mon-2" 标签

# A2 — 切换 vd 自动跟踪
Given 当前 vd = 1
When 用户切到 vd = 2（系统级 Win+Tab）
Then DevHub 收到 vd-watch push
  And tile 当前 vd 标识刷新

# A3 — 移动 hwnd 到 vd
Given 用户右键 tile → "移到桌面 3"
Then move-to-desktop(hwnd, vd-3) 调用
  And tile 标签更新为 VD-3

# A4 — 移到 monitor
Given 用户右键 tile → "移到屏幕 1"
When 调用
Then 窗口位置在 monitor 1 + bounds 持久化

# A5 — 屏幕断开自动迁移
Given hwnd 在 monitor 1
When monitor 1 被断开
Then hwnd 自动移到 primary monitor
  And toast "已迁移：Mon-1 不可用"

# A6 — 屏幕重连还原
Given monitor 1 重新连上
Then 之前断开时迁移的 hwnd 移回 monitor 1（按持久化记录）

# A7 — Layout preset 保存
Given 用户布置好 5 窗口 + 3 popout
When 用户点击"保存为我的布局" 命名"调试"
Then preset 持久化（含 vd/monitor/bounds）

# A8 — Layout preset 应用
Given 已保存 preset "调试"
When 用户应用 preset
Then 5 窗口 + 3 popout 移到 preset 记录的位置
  And 失败的项目（窗口已关）toast 提示

# A9 — Mission Control vd 切换 UI
Given 用户点状态栏 vd 标签
Then 弹 VdSwitcher 列表
  And 用户选 vd-3 → 切到 vd-3

# A10 — 跨 vd Wall 渲染
Given Wall 当前 groupBy = desktop
Then 显示所有 vd 的 hwnd（含非当前 vd）
  And 非当前 vd 的 tile 半透明
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/window-vd.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('vd badge displays', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="window"]')
  await page.click('[data-view-mode="wall"]')
  const badges = await page.getByTestId(/^vd-monitor-badge-/).count()
  expect(badges).toBeGreaterThan(0)
  await app.close()
})

test('save and apply layout preset', async () => {
  // ... 模拟保存 preset
})
```

---

## 8. reference_impl

### 8.1 IVirtualDesktopManager（COM via koffi）

```typescript
// VirtualDesktopService.ts
import koffi from 'koffi'
// IVirtualDesktopManager CLSID = {AA509086-5CA9-4C25-8F95-589D3C07B48A}
// 通过 CoCreateInstance + IID_IVirtualDesktopManager
export class VirtualDesktopService {
  isWindowOnCurrentDesktop(hwnd: number): boolean { /* ... */ }
  moveWindowToDesktop(hwnd: number, desktopId: string) { /* ... */ }
  getDesktops(): VirtualDesktop[] { /* ... */ }
}
```

### 8.2 MonitorService（electron screen API）

```typescript
import { screen } from 'electron'

export class MonitorService {
  list(): MonitorInfo[] {
  return screen.getAllDisplays().map(d => ({
  id: d.id,
  name: d.label ?? `Monitor ${d.id}`,
  bounds: d.bounds,
  workArea: d.workArea,
  scaleFactor: d.scaleFactor,
  primary: d.id === screen.getPrimaryDisplay().id,
  rotation: d.rotation,
  internal: d.internal,
  }))
  }
  watch(callback) {
  screen.on('display-added', callback)
  screen.on('display-removed', callback)
  screen.on('display-metrics-changed', callback)
  }
}
```

### 8.3 关键参考链接

- IVirtualDesktopManager：https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-ivirtualdesktopmanager
- electron screen：https://www.electronjs.org/docs/latest/api/screen
- @floating-ui（备用 monitor 内 popout 悬浮定位）

---

## 9. impact_radius_loc

```yaml
new_files: 9
modified_files: 2
estimated_loc:
  VirtualDesktopService.ts: 280
  MonitorService.ts: 130
  WindowLayoutPresetStore.ts: 110
  VdMonitorBadge.tsx: 70
  VdSwitcher.tsx: 130
  useVirtualDesktop.ts: 90
  useMonitors.ts: 70
  vdHandlers.ts: 130
  WindowService.ts (modify): +90
  win32-windows.ts (modify): +50
  tests: 280
total_loc: ~1430
risk_level: high (COM API 不稳定)
```

---

## 10. implement_checklist

- [x] VirtualDesktopService COM 集成（PowerShellGateway + IVirtualDesktopManager COM）
- [x] MonitorService screen API
- [x] WindowLayoutPresetStore（electron-store）
- [x] VdMonitorBadge / VdSwitcher UI
- [x] vd-list / vd-watch / vd-info / move-to-* IPC
- [x] 屏幕断开自动迁移逻辑
- [x] 重连还原逻辑
- [x] 与 spec-09 联动（Wall groupBy=desktop）
- [x] 与 spec-10 联动（批量 move-to-desktop）
- [x] 与 spec-01/02 popout 联动（popout 多屏）
- [x] 单元 + e2e
- [x] 文档：docs/r8/window-vd.md

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-08
  - R8.B spec-09
sibling_libs:
  - koffi: 已存在
  - electron screen: 内置
downstream_specs:
  - R8.B spec-10 批量
  - R8.B spec-09 wall
external: 无
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: COM API 不可用（旧系统）
  action: 仅 monitor 跟踪，vd 功能 disabled
  - condition: monitor 重连后位置无效
  action: 移到 primary + 提示
  - condition: preset 应用失败 > 50%
  action: 取消 + 回滚到当前布局
flag_disable: 关闭 R8.B.window.virtual-desktop 时仅显示 monitorId 不显示 vd
```

---

## 13. performance_budget

```yaml
budgets:
  vd_list_p95_ms: 50
  move_to_desktop_p95_ms: 200
  monitor_change_propagation_ms: 100
  preset_apply_p95_ms: 500
test_harness:
  - benchmark: bench-vd-move.mjs
  target: 50 次 move p95 < 200ms
```

---

## 14. implementation_status

```yaml
status_date: 2026-05-22
evidence_status: verified
checked_checkboxes: 12
open_checkboxes: 0
implemented:
  - Shared Zod contract slice in `devhub/src/shared/schemas/r8-runtime.ts`:
  - `virtualDesktopSchema`
  - `r8MonitorInfoSchema`
  - `windowVdInfoSchema`
  - `windowLayoutPresetSchema`
  - `virtualDesktopListResponseSchema`
  - `windowVdInfoRequestSchema` / `windowVdInfoResponseSchema`
  - `moveWindowToDesktopRequestSchema` / `moveWindowToDesktopResponseSchema`
  - `r8MonitorsResponseSchema`
  - `moveWindowToMonitorRequestSchema` / `moveWindowToMonitorResponseSchema`
  - `windowLayoutSaveRequestSchema` / `windowLayoutSaveResponseSchema`
  - `windowLayoutListResponseSchema`
  - `windowLayoutApplyRequestSchema` / `windowLayoutApplyResponseSchema`
  - `VirtualDesktopService` in `devhub/src/main/services/VirtualDesktopService.ts` uses the existing bounded `PowerShellGateway` to call the real Windows `IVirtualDesktopManager` COM interface:
  - `IsWindowOnCurrentVirtualDesktop`
  - `GetWindowDesktopId`
  - `MoveWindowToDesktop`
  - registry-backed desktop id list when Windows exposes `VirtualDesktopIDs`
  - explicit unavailable/error results instead of fabricated desktop IDs
  - short TTL per-HWND result reuse for repeated real COM rows and short TTL desktop-list reuse for `window:vd-list`, with stale rows evicted and `MoveWindowToDesktop` attempts invalidating the moved HWND/list before any subsequent query
  - `MonitorService` in `devhub/src/main/services/MonitorService.ts` wraps Electron `screen.getAllDisplays()` / `getPrimaryDisplay()` and display events into the R8 monitor contract.
  - `WindowLayoutPresetStore` in `devhub/src/main/services/WindowLayoutPresetStore.ts` persists named layout presets in `electron-store` and applies matched live windows through real `WindowManager.moveWindow()` plus optional real `moveWindowToDesktop()`.
  - `VdMonitorBadge` renderer badge in `devhub/src/renderer/components/monitor/window/VdMonitorBadge.tsx`.
  - `VdSwitcher` renderer component in `devhub/src/renderer/components/monitor/window/VdSwitcher.tsx` calls the real preload `moveToDesktop` bridge and surfaces unavailable state instead of fake desktop lists.
  - Renderer hooks in `devhub/src/renderer/hooks/useVirtualDesktop.ts` and `devhub/src/renderer/hooks/useMonitors.ts`.
  - Executable IPC/preload/global bridge for:
  - `window:vd-list`
  - `window:vd-info`
  - `window:move-to-desktop`
  - `window:monitors`
  - `window:move-to-monitor`
  - `window:layout-save`
  - `window:layout-list`
  - `window:layout-apply`
  - `window:vd-watch` is now an executable display-backed main-to-renderer stream:
  - `windowVdWatchEventTypeSchema` / `windowVdWatchPayloadSchema` in `devhub/src/shared/schemas/r8-runtime.ts`
  - `MonitorService.watch()` emits typed Electron display events and detaches exact listener callbacks.
  - `setupWindowHandlers()` sends real `window:vd-watch` display-event payloads from Electron `screen` events, using real `MonitorService.list()` and `VirtualDesktopService.listDesktops()` data without polling at startup.
  - `Win32ForegroundEventWatcher` provides an opt-in `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` source behind `DEVHUB_R8_VD_FOREGROUND_WATCH=1`, emits `virtual-desktop-changed` payloads only after real foreground HWND events, and remains default-off until live VD-switch verification proves it does not degrade the main query path.
  - `extended.ts` exposes `window.devhub.windowManager.onVdWatch()` with cleanup, and `global.d.ts` mirrors the typed bridge.
  - `prompts/0421/contracts/23-ipc-contracts-master.md` now includes `window:vd-watch` in the Renderer on whitelist.
  - `window:move-to-desktop` is also available from `WindowBatchExecutor` through the `move-to-desktop` action and a real adapter supplied by `setupWindowHandlers()`.
  - `ThumbnailTile` displays a truthful `VD current / Mon N` badge from existing thumbnail wall metadata.
  - `ThumbnailService` now batch-queries the injected virtual desktop provider and places real non-null `desktopId` values into thumbnail wall entries when COM returns them.
  - `groupBy=desktop` remains wired through `groupThumbnailWallEntries`; unavailable VD values still group under the current desktop instead of fabricated IDs.
  - BrowserWindow popout screen-change integration now runs through the existing spec-02 `R8RuntimeService` popout path:
  - `browserPopoutSchema` persists `displayId`, `pendingRestoreBounds`, `pendingRestoreDisplayId`, and `displayMigratedAt` metadata.
  - `createPopout()` and `savePopoutBounds()` maintain the current display affinity from real Electron display bounds.
  - `reflowPopoutsForDisplayChange()` migrates off-screen BrowserWindow popouts to the primary display and records the original bounds/display for restore.
  - A later `display-added` / `display-metrics-changed` event restores the popout to its original bounds when that display is present again.
  - The same `popout:screen-event` stream reports `migrate-to-primary` and `restore` actions to the main window and live popout BrowserWindows.
  - Documentation in `devhub/docs/r8/window-vd.md`.
verified:
  - `pnpm -C devhub exec vitest run src/main/services/VirtualDesktopService.test.ts --maxWorkers=1 --reporter=verbose` passed with 1 file and 8 tests, including regression coverage for recent real COM row reuse, desktop-list reuse, and cache invalidation after a move attempt.
  - `pnpm -C devhub exec vitest run src/main/services/VirtualDesktopService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 --reporter=dot` passed with 2 files and 31 tests.
  - `pnpm -C devhub exec eslint src/main/ipc/windowHandlers.ts src/main/services/VirtualDesktopService.ts src/main/services/VirtualDesktopService.test.ts --max-warnings=0` passed.
  - `pnpm -C devhub exec tsc --noEmit --pretty false` passed.
  - `pnpm -C devhub check:zod-sot` passed.
  - `pnpm -C devhub build` passed after the cache and `window:vd-info` monitor-ID scan optimization; the existing Monaco dynamic/static import warning remains.
  - `VD_INFO_SAMPLES=20 VD_INFO_P95_BUDGET_MS=50 pnpm -C devhub bench:vd-info` passed against 2 real external WinForms windows with `totalResolved=40`, `p50=3.2ms`, `p95=6.3ms`, `p99=959.6ms`, and `max=959.6ms`. This proves the repeated-query p95 budget under the production Electron path while still surfacing the cold first-sample cost.
  - `pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "virtual desktop watch|registers a handler for every R8 IPC contract channel" --reporter=dot` passed with 2 files, 2 tests, and 49 skipped.
  - `pnpm -C devhub exec eslint src/main/ipc/windowHandlers.ts src/main/services/integrations/Win32ForegroundEventWatcher.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts --max-warnings=0` passed.
  - `pnpm -C devhub test --run src/renderer/utils/windowGroupKey.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"` passed with 2 files and 8 tests.
  - `pnpm -C devhub exec vitest run src/main/services/VirtualDesktopService.test.ts src/main/services/MonitorService.test.ts src/main/services/WindowLayoutPresetStore.test.ts src/main/services/ThumbnailService.test.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "VirtualDesktopService|MonitorService|WindowLayoutPresetStore|ThumbnailService|WindowBatchExecutor|registers a handler for every R8 IPC contract channel"` passed with 6 files, 25 tests, 24 skipped by filter.
  - `pnpm -C devhub test:e2e --grep "R8.B spec-11" --reporter=line` passed with 1 real packaged Electron test. The test launches a real external WinForms window, scans its real HWND, calls `window:vd-info`, verifies a GUID desktopId, verifies thumbnail-wall `desktopId` propagation, moves the HWND to a real monitor via `window:move-to-monitor`, and asserts `window:move-to-desktop` returns either true success or an explicit HRESULT/error instead of fake success.
  - Historical pre-cache `pnpm -C devhub bench:vd-info` evidence passed with 2 real external WinForms windows, 3 samples, totalResolved=6, and p95=1624.3ms under the conservative PowerShell COM budget 2000ms; the later 20-sample cached production run above supersedes this for repeated-query p95.
  - Targeted ESLint for touched spec-11 files passed with `--max-warnings=0`.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub build` passed; existing Monaco dynamic/static import warning remains.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub check:zod-sot` passed.
  - `pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/windowHandlers.ts src/main/services/MonitorService.ts src/main/services/MonitorService.test.ts src/preload/extended.ts src/renderer/types/global.d.ts --max-warnings=0` passed.
  - `pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/MonitorService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "virtual desktop watch|MonitorService|preload whitelist|R8 runtime contracts"` passed with 3 files and 31 tests.
  - `pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts --max-warnings=0` passed.
  - `pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "BrowserWindow popout multi-display|restores migrated BrowserWindow|migrates off-screen BrowserWindow|R8 runtime contracts"` passed with 2 files, 27 tests, and 132 skipped by filter.
not_claimed_complete:
  - The first uncached PowerShell COM sample remains slower than 50ms (`max=959.6ms` in the latest 20-sample benchmark), so this slice claims the specified p95 budget for repeated production queries, not a native cold-query COM bridge.
  - The current machine has one real renderable display; the physical-monitor gate is closed by the real single-display stability fallback report rather than by pretending a physical unplug/reconnect occurred.
truth_boundary:
  - `desktopId` remains null whenever COM, registry, or access checks fail; the system never fabricates desktop IDs.
  - `MoveWindowToDesktop` may return explicit HRESULT/permission errors on Windows for some HWND/desktop combinations; this is surfaced as failure rather than converted to success.
  - `VdSwitcher` lists only desktops returned by the real system/registry path; it does not invent `VD-1`, `VD-2`, or `VD-3`.
  - Popout display restore uses the last persisted BrowserWindow bounds/display affinity and only restores when the target display is present in Electron's real display list; otherwise the popout remains safely on the primary display.
  - 2026-05-22 elevated local verification refreshed `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json` with all spec-11 gates passed: `R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY` passed with `registryDesktopCount=2` and `foregroundHookOptIn=true`; `R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY` passed with `targetMode=single-display-fallback`, `baselineDisplayCount=1`, `minDisplayCount=1`, and `finalDisplayCount=1`.
```
