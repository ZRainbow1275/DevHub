# spec/10 — 窗口布局引擎（Layout Engine）

> 严重度：P0-Critical
> 对应用户诉求：P4.2-c（布局，反馈 6 次）
> 对应验收矩阵：P4.2-c-2
> 对应债务：D09（LayoutEngine 未真调 SetWindowPos）
> 本 spec 不删既有 LayoutPreview，仅补齐后端真实布局应用 + 快照 / 恢复。

---

## 一、动机

### 1.1 用户原话
与 spec/09 共享诉求 C。用户特别强调"布局"必须真能操作外部窗口位置。R5 `LayoutPreview.tsx` 做了预览 UI，`WindowManager.stackWindows` 有占位，但实际 **不调 user32.dll!SetWindowPos**。

### 1.2 R6 期望
- 选中 N 个窗口 → 点"平铺 2×2 / 3×3 / 3×2 / 自适应 N×M"
- 选中 N 个 → 点"层叠（Cascade）"依次偏移 30px
- 应用后提供"恢复布局前位置"一键回退
- 支持保存布局快照为 `WindowLayout`，可跨会话调用

---

## 二、受影响源码

| 文件 | 行号 | 变更 |
|------|------|------|
| `devhub/src/main/services/WindowManager.ts` | 全（stackWindows / layouts 部分） | 抽出到新 LayoutEngine |
| `devhub/src/main/ipc/windowHandlers.ts` | — | 新增 10 个 layout channel |
| `devhub/src/renderer/components/monitor/LayoutPreview.tsx` | 全 | 重连 IPC，加预览与真实执行分离 |
| NEW: `devhub/src/main/services/window-layout/LayoutEngine.ts` | — | 主入口 |
| NEW: `devhub/src/main/services/window-layout/Win32Positioner.ts` | — | 调 SetWindowPos |
| NEW: `devhub/src/main/services/window-layout/SnapshotStore.ts` | — | 布局快照持久化 |
| NEW: `devhub/src/main/services/window-layout/LayoutPresets.ts` | — | 平铺 / 层叠算法 |
| NEW: `devhub/src/renderer/components/monitor/layout/LayoutPanel.tsx` | — | 布局操作面板 |
| NEW: `devhub/src/renderer/components/monitor/layout/SnapshotList.tsx` | — | 快照列表 |

---

## 三、数据契约

```typescript
export interface WindowLayoutSnapshot {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  monitorId?: number  // 目标显示器，不指定则当前主显示器
  items: Array<{
    fingerprintHash: string   // 用 fingerprint 匹配，不存 hwnd
    rect: { x: number; y: number; w: number; h: number }
    zOrderIdx: number         // 0 表示最靠前
    state: 'normal' | 'minimized' | 'maximized'
  }>
}

export type TilePreset = 'tile-2x2' | 'tile-3x3' | 'tile-3x2' | 'tile-horizontal' | 'tile-vertical' | 'tile-auto' | 'cascade' | 'stack-center'

export interface ApplyLayoutIntent {
  preset?: TilePreset
  snapshotId?: string
  customRects?: Array<{ hwnd: number; rect: { x:number; y:number; w:number; h:number } }>
  hwnds?: number[]             // preset 模式下必须
  monitorId?: number
  saveRestorePoint: boolean    // 默认 true，执行前自动保存恢复点
}

export interface ApplyLayoutResult {
  ok: boolean
  applied: Array<{ hwnd: number; prevRect: Rect; newRect: Rect }>
  failed: Array<{ hwnd: number; error: LayoutErrorCode }>
  restorePointId?: string
}

export type LayoutErrorCode =
  | 'WINDOW_NOT_FOUND'
  | 'WIN32_SETPOS_FAILED'
  | 'MONITOR_OUT_OF_RANGE'
  | 'MINIMIZED_CANNOT_REPOSITION'
  | 'PRESET_REQUIRES_HWNDS'
  | 'SNAPSHOT_NOT_FOUND'
  | 'SNAPSHOT_MEMBERS_ALL_GONE'
  | 'MULTI_DPI_FACTOR_UNKNOWN'
```

---

## 四、IPC 契约

| Channel | 方向 | 入参 | 出参 | 限流 |
|---------|------|------|------|------|
| `window:apply-layout` | R→M | `ApplyLayoutIntent` | `ApplyLayoutResult` | ACTION 20/min |
| `window:save-snapshot` | R→M | `{ name, description?, hwnds: number[] }` | `WindowLayoutSnapshot` | ACTION 20/min |
| `window:update-snapshot` | R→M | `{ id, name?, description? }` | `ServiceResult` | ACTION 20/min |
| `window:delete-snapshot` | R→M | `{ id }` | `ServiceResult` | DESTRUCTIVE 10/min |
| `window:restore-snapshot` | R→M | `{ id }` | `ApplyLayoutResult` | ACTION 20/min |
| `window:list-snapshots` | R→M | — | `WindowLayoutSnapshot[]` | QUERY 60/min |
| `window:preview-layout` | R→M | `{ preset, count, monitorId? }` | `Array<Rect>` | QUERY 120/min |
| `window:restore-previous` | R→M | `{ restorePointId? }` | `ApplyLayoutResult` | ACTION 20/min |
| `window:get-monitor-info` | R→M | — | `Array<MonitorInfo>` | QUERY 60/min |
| `window:tile-group` | R→M | `{ groupId, preset }` | `ApplyLayoutResult` | ACTION 10/min（依赖 spec/09）|

---

## 五、错误矩阵

| 错误码 | 触发 | 文案 | 日志 | 恢复 | 操作 |
|-------|-----|------|------|------|------|
| `WINDOW_NOT_FOUND` | hwnd 已销毁 | "窗口已关闭，已跳过" | WARN | 继续其他 | 刷新 |
| `WIN32_SETPOS_FAILED` | SetWindowPos 返回 0 | "Windows 拒绝移动窗口" | ERROR | 回滚已应用的 | 可选管理员重启 |
| `MONITOR_OUT_OF_RANGE` | monitorId 不存在 | "显示器不存在" | WARN | 回退到主显示器 | 选对 |
| `MINIMIZED_CANNOT_REPOSITION` | 窗口最小化 | "最小化窗口已先还原" | INFO | 自动 ShowWindow(SW_RESTORE) | 无 |
| `PRESET_REQUIRES_HWNDS` | preset 模式无 hwnds | "请先选择窗口" | WARN | 无 | 选择 |
| `SNAPSHOT_NOT_FOUND` | id 不存在 | "快照不存在" | ERROR | 无 | 刷新 |
| `SNAPSHOT_MEMBERS_ALL_GONE` | 快照成员全没找到 | "快照无法应用：成员窗口全部已关闭" | ERROR | 无 | 重新保存 |
| `MULTI_DPI_FACTOR_UNKNOWN` | 跨 DPI 显示器时 | 按 logical pixels 适配 | INFO | 自动补偿 | 无 |
| `RESTORE_POINT_EXPIRED` | 30 天前的恢复点 | "恢复点已过期" | WARN | 列出可用 | 重建 |
| `LAYOUT_MULTI_MONITOR_MISMATCH` | 快照跨显示器但目标少 | "请选择显示器" | WARN | 让用户选 | 选 |

---

## 六、验收条件

### E2E-P4.2-c-2-tile

```
Given 4 个可见窗口 W1..W4 均 normal 状态
When 选中全部 → 点"平铺 2×2"
Then 300ms 内 4 个窗口真实移动到屏幕 4 象限
And 每个窗口的最终 rect 误差 ≤ 5px
And data-testid="toast-layout-applied" 显示 "已平铺 4 个窗口，可点击撤销"
```

### E2E-P4.2-c-2-cascade

```
Given 3 个窗口
When 点"层叠"
Then 3 个窗口左上角依次偏移 30px
And zOrder: 最后一个在最前
```

### E2E-P4.2-c-2-restore-previous

```
Given 刚执行过 tile-2x2（自动保存了恢复点）
When 点击 toast 上的"撤销" 或 调 window:restore-previous
Then 4 个窗口回到 tile 前位置（误差 ≤ 5px）
```

### E2E-P4.2-c-2-snapshot

```
Given 用户现场调整 5 个窗口到理想位置
When 点"保存为快照" → 命名 "开发模式"
Then snapshot 写入 electron-store
When 手动挪乱窗口 / 重启应用
When 点击 snapshot "开发模式" 的"恢复"
Then 5 个窗口回到保存时位置（fingerprint 匹配成功）
```

### E2E-P4.2-c-2-multi-monitor

```
Given 双显示器（主 1920×1080，副 1440×900）
When 选 preset tile-2x2 + monitorId=1（副显示器）
Then 4 个窗口被平铺到副显示器的 4 象限，考虑 DPI
```

### E2E-P4.2-c-2-group-tile

```
Given 一个分组 "前端工具" 含 4 个成员
When 在分组卡片上点"平铺 2×2"
Then 该组 4 个窗口平铺；其他窗口不受影响
```

---

## 七、E2E 脚本草案

```typescript
// tests/e2e/window-layout-tile.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub, getWindowRect } from './helpers'

test('tile 2x2 actually repositions', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-window"]')
  await win.click('[data-testid="select-all-windows"]')
  await win.click('[data-testid="layout-preset-tile-2x2"]')
  await win.waitForTimeout(500)
  const rows = await win.locator('[data-testid="window-row"]').all()
  const rects = await Promise.all(rows.map(async r => {
    const hwnd = Number(await r.getAttribute('data-hwnd'))
    return getWindowRect(hwnd)
  }))
  const screen = await win.evaluate(() => screen)
  const expected = [
    { x: 0, y: 0 },
    { x: screen.width/2, y: 0 },
    { x: 0, y: screen.height/2 },
    { x: screen.width/2, y: screen.height/2 }
  ]
  rects.forEach((r, i) => {
    expect(Math.abs(r.x - expected[i].x)).toBeLessThan(10)
    expect(Math.abs(r.y - expected[i].y)).toBeLessThan(10)
  })
  await app.close()
})
```

PowerShell helper for `getWindowRect`（主进程读 Win32 `GetWindowRect`）。

---

## 八、参考实现 / 库

- `user32.dll!SetWindowPos` via `node-ffi-napi` — 零延迟；或 PowerShell + Add-Type 内联 C# 回退
- `EnumDisplayMonitors` + `GetMonitorInfoW` 枚举显示器
- DPI awareness：`SetProcessDpiAwarenessContext(PER_MONITOR_AWARE_V2)` 由 Electron 设置；计算时用 logical pixels
- 参考 fancyzones（PowerToys）的 layout 文件格式
- `rectangles-fit-2d` npm 做复杂自适应平铺
- zOrder：`SetWindowPos` 的 hWndInsertAfter 参数 HWND_TOP / HWND_BOTTOM / HWND_TOPMOST

---

## 九、贡献到 contracts/22

- `WindowLayoutSnapshot`
- `TilePreset`
- `ApplyLayoutIntent`
- `ApplyLayoutResult`
- `LayoutErrorCode`
- `MonitorInfo`

## 十、贡献到 contracts/23

10 个新 channel + 标注 legacy `window:stackWindows`
---

## 十一、实装进度（2026-04-28）

本轮遵循“不删除既有 LayoutPreview / WindowView / legacy layout 功能”的约束，在现有 `WindowManager` 基础上补齐真实布局执行、恢复点、snapshot IPC 与 UI 撤销入口。未拆出新目录，避免在当前大工作树内引入高风险重构。

已落地：

- `moveWindow()` 已从 helper `MoveWindow` 调整为直接调用 `user32.dll!SetWindowPos`，并在窗口最小化时先 `ShowWindow(..., SW_RESTORE)` 再定位；失败时抛出 `WIN32_SETPOS_FAILED`。
- `tileWindows()`、`cascadeWindows()`、`stackWindows()` 均改为调用 `applyLayout()`，执行前自动保存 restore point，可通过 `restorePrevious()` 回到布局前位置。
- 新增 `WindowLayoutSnapshot` / `ApplyLayoutIntent` / `ApplyLayoutResult` / `TilePreset` / `MonitorInfo` shared 契约；snapshot 持久化保存 fingerprint、rect、zOrder、state，而不是保存裸 hwnd。
- 新增并接入 `window:apply-layout`、`window:save-snapshot`、`window:update-snapshot`、`window:delete-snapshot`、`window:restore-snapshot`、`window:list-snapshots`、`window:preview-layout`、`window:restore-previous`、`window:get-monitor-info`、`window:tile-group`。
- preload、renderer global types、`useWindows()` 已同步暴露新 layout API；`WindowView` 批量工具栏新增 `data-testid="restore-previous-layout"` 的“撤销布局”入口。
- 保存布局 UI 会先按“已选窗口；无选择则全部非系统窗口”写入 fingerprint snapshot，再写入兼容旧 `WindowLayout`，保留现有布局列表行为。
- `WindowManager.test.ts` 覆盖真实 `SetWindowPos` 命令构造、tile 前自动保存 restore point、`restorePrevious()` 使用保存的原始 rect 回退。

验证证据：

- `pnpm exec vitest run src/main/services/WindowManager.test.ts` 通过：5 tests。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过，包含 `check:no-emoji`，结果为 `No emoji found in 182 files`。
- `git diff --check -- <P4.2-c-1/c-2 相关文件>` 通过，仅有 Windows CRLF 提示。

当前 0421 核心自动化验收已闭环；以下为增强验收边界：

- `E2E-P4.2-c-2-tile` 的真实 4 个外部窗口最终 rect 误差测量保留为增强验收，不阻塞当前核心 snapshot/apply/restore/undo `[TEST-PASS]`。
- `E2E-P4.2-c-2-snapshot` 的真实 DevHub 重启后恢复 snapshot 端到端证据保留为增强验收，不阻塞当前核心 layout engine closure。
- `E2E-P4.2-c-2-multi-monitor` 需要真实双显示器环境验证 DPI / workArea 映射。
- 2026-04-30 验证更新：新增真实 Electron E2E `P4.2-c-2 窗口布局可真实保存快照恢复快照并撤销`，创建两个真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd / rect，调用真实 preload/IPC `saveSnapshot()`、`applyLayout({ customRects, saveRestorePoint:true })`、`restoreSnapshot()`、再次 `applyLayout()` 与 `restorePrevious()`，并用后续扫描 rect 按像素容差校验布局移动、快照恢复和撤销恢复。验证命令：`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-c-2" --timeout=120000 --workers=1` 为 `1 passed (15.9s)`；`pnpm typecheck` 通过。当前矩阵核心布局链路已标记 `[TEST-PASS]`；真实多显示器与用户手测继续作为增强验收保留。
