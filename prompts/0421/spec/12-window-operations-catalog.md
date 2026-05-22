# spec/12 — 窗口操作目录（12 个可操作动作）

> 严重度：P1（但强依赖 P0-Critical 之窗口模块，用户明确要求"可操作功能太少"）
> 对应用户诉求：P4.2-e（窗口能进行的功能太少）
> 对应验收矩阵：P4.2-e（12 个操作）
> 本 spec 一次性列齐窗口可操作动作，杜绝"逐轮加一两个"的失败模式。

---

## 一、动机
R2-R6 用户反复说"窗口可操作功能少"。前几轮每次只补 1-2 个（focus、minimize、stack），仍被觉得少。R7 **一次性列齐 12 个**，一起实现。

---

## 二、操作目录（12 个动作）

| # | 动作 | 快捷菜单位置 | IPC channel | WinAPI | 限流 | 权限 |
|---|-----|------------|------------|--------|------|------|
| 1 | 聚焦 / 前置 | 主按钮 | `window:focus` | SetForegroundWindow | ACTION 60/min | 普通 |
| 2 | 最小化 | 主按钮 | `window:minimize` | ShowWindow(SW_MINIMIZE) | ACTION 60/min | 普通 |
| 3 | 最大化 | 主按钮 | `window:maximize` | ShowWindow(SW_MAXIMIZE) | ACTION 60/min | 普通 |
| 4 | 还原 | 主按钮 | `window:restore` | ShowWindow(SW_RESTORE) | ACTION 60/min | 普通 |
| 5 | 置顶（Always on Top） | 右键 | `window:toggle-always-on-top` | SetWindowPos(HWND_TOPMOST / HWND_NOTOPMOST) | ACTION 30/min | 普通 |
| 6 | 截屏当前窗口 | 右键 | `window:screenshot` | PrintWindow(hwnd, hdc, PW_CLIENTONLY or PW_RENDERFULLCONTENT) | ACTION 10/min | 普通（写文件） |
| 7 | 强制关闭窗口 | 右键（带确认） | `window:close` | PostMessage(WM_CLOSE) + 等 1s 超时则 TerminateProcess | DESTRUCTIVE 10/min | 普通或管理员 |
| 8 | 结束所属进程 | 右键（带确认 + 审计） | `process:kill` (EXISTING) | TerminateProcess | DESTRUCTIVE 10/min | 权限视进程而定 |
| 9 | 跳到所属进程详情 | 右键 | （前端路由）`#monitor/process/<pid>` | — | — | — |
| 10 | 跳到所属端口详情 | 右键（若进程有监听端口） | 前端路由 `#monitor/port/<port>` | — | — | — |
| 11 | 跳到所属 AI 任务 | 右键（若匹配到 AI alias） | 前端路由 `#monitor/ai-task/<aliasId>` | — | — | — |
| 12 | 标记收藏 / 取消收藏 | 右键 | `window:toggle-favorite` | — | ACTION 60/min | 普通 |

**扩展 4 个附加**（作为 R7 加量）：

| # | 动作 | channel | 说明 |
|---|-----|---------|------|
| 13 | 打开工作目录（资源管理器） | `window:open-working-dir` | 用 `shell.openPath(workingDir)` |
| 14 | 打开相关项目（DevHub 项目 Tab） | 前端路由 `#project/<id>` | — |
| 15 | 复制窗口标题 | `window:copy-title`（可通过 renderer clipboard 直接） | — |
| 16 | 编辑窗口标题（外部） | `window:set-title`（见 spec/07） | — |

---

## 三、数据契约

```typescript
// src/shared/types/window-ops.ts

export interface WindowOpIntent<K extends WindowOpKind = WindowOpKind> {
  kind: K
  hwnd: number
  args?: WindowOpArgs[K]
  reason?: string
  requestedAt: number
  requesterContextHint?: 'main-btn' | 'context-menu' | 'keyboard' | 'api'
}

export type WindowOpKind =
  | 'focus' | 'minimize' | 'maximize' | 'restore'
  | 'toggle-always-on-top' | 'screenshot' | 'close'
  | 'toggle-favorite' | 'set-title'

export interface WindowOpArgs {
  'focus': void
  'minimize': void
  'maximize': void
  'restore': void
  'toggle-always-on-top': { desiredState?: boolean }
  'screenshot': { target?: 'clipboard' | 'file'; format?: 'png' | 'jpeg'; quality?: number }
  'close': { confirm?: boolean; timeoutMs?: number }
  'toggle-favorite': void
  'set-title': { newTitle: string }
}

export interface WindowOpResult<K extends WindowOpKind = WindowOpKind> {
  ok: boolean
  kind: K
  hwnd: number
  payload?: unknown
  error?: WindowOpErrorCode
  appliedAt: number
}

export type WindowOpErrorCode =
  | 'WINDOW_NOT_FOUND' | 'ACCESS_DENIED' | 'WIN32_ERROR'
  | 'NOT_SUPPORTED_ON_THIS_WINDOW' | 'SCREENSHOT_IO_FAILED'
  | 'CLOSE_REFUSED_BY_APP' | 'TIMEOUT'
```

---

## 四、错误矩阵

| 错误码 | 触发 | 文案 | 日志 | 恢复 |
|-------|-----|------|------|------|
| `WINDOW_NOT_FOUND` | hwnd 已销毁 | "窗口已关闭" | WARN | 自动刷新列表 |
| `ACCESS_DENIED` | 系统 / 其他账户进程 | "无权限操作该窗口，可以尝试以管理员重启 DevHub" | ERROR | 无 |
| `WIN32_ERROR` | WinAPI 返回 0 | "Windows 拒绝该操作" + GetLastError 日志 | ERROR | 无 |
| `NOT_SUPPORTED_ON_THIS_WINDOW` | 如对 modal 执行 maximize | "该窗口不支持此操作" | WARN | 无 |
| `SCREENSHOT_IO_FAILED` | 保存截图时磁盘错 | "截图保存失败" | ERROR | 提示重选目录 |
| `CLOSE_REFUSED_BY_APP` | WM_CLOSE 超时 | "窗口拒绝关闭，是否强制结束进程？" | WARN | 二次确认后 TerminateProcess |
| `TIMEOUT` | 操作 > 3s | "操作超时" | WARN | 无 |
| `FAV_STORE_WRITE_FAIL` | electron-store 写失败 | "收藏保存失败" | ERROR | 回滚内存态 |
| `SCREENSHOT_DPI_UNKNOWN` | 跨 DPI 时需要处理 | 自动校正 | INFO | 无 |
| `INTENT_BATCH_PARTIAL` | 批操作部分失败 | "N/M 成功" | INFO | 展示成功列表 |

---

## 五、验收条件

### E2E-P4.2-e-all-12

```
For each of 12 operations:
Given 一个对应类型的真实窗口
When 触发操作（快捷菜单 / 主按钮）
Then 在 Win32 侧实际发生（通过 GetWindowLong / GetWindowPlacement / 文件系统 / 路由 断言）
And Toast 或 UI 显示操作结果（成功 / 失败 + 原因）
```

### E2E-P4.2-e-ui-exposes-all

```
Given 任一窗口卡片
When 点击三点菜单
Then 看到所有 12 个（+ 4 附加）操作项，按逻辑分组：
  - 窗口状态 (focus/min/max/restore/always-on-top)
  - 截图 (screenshot/copy-title)
  - 跳转 (process/port/ai-task/project)
  - 目录 (open-working-dir)
  - 重命名 (set-title)
  - 收藏 (toggle-favorite)
  - 危险 (close/kill)
And 每个图标使用 lucide-react；data-lucide 属性非空；无 Emoji
```

### E2E-P4.2-e-batch

```
Given 分组 "前端组" 含 3 个窗口
When 在分组右键 → "批量最小化"
Then 3 个窗口全部 minimize
And INTENT_BATCH_PARTIAL 仅在有失败时 toast
```

### E2E-P4.2-e-audit

```
Given 点"结束所属进程"
Then 弹出二次确认 modal：进程名 + PID + 警告
When 确认
Then AuditLogger 写入一条 `process-kill` 记录
And 包含：进程名 / PID / 用户 / 时间 / 发起的窗口 hwnd
```

---

## 六、E2E 脚本草案

```typescript
// tests/e2e/window-operations-full.spec.ts
const ops: Array<{ id: string; assertion: (hwnd: number) => Promise<boolean> }> = [
  { id: 'focus', assertion: async h => (await getForegroundWindow()) === h },
  { id: 'minimize', assertion: async h => (await getWindowPlacement(h)).showCmd === 2 /* SW_SHOWMINIMIZED */ },
  // ...其余 10 个
]
for (const op of ops) {
  test(`op:${op.id}`, async () => {
    const app = await launchDevHub()
    const win = await app.firstWindow()
    const hwnd = Number(await win.getAttribute('[data-testid="window-row"]', 'data-hwnd'))
    await win.click(`[data-testid="window-op-${op.id}"]`)
    await win.waitForTimeout(300)
    expect(await op.assertion(hwnd)).toBe(true)
    await app.close()
  })
}
```

---

## 七、权限与审计

见 `contracts/24-permission-control-spec.md`。要点：

- 写性操作（close / kill / set-title）要求：
  - UI 二次确认 modal
  - AuditLogger 记录
  - 失败时 Toast 可重试
- 读性操作（focus / screenshot / copy-title）无需审计

---

## 八、参考实现 / 库

- `node-ffi-napi` + `user32.dll` — 主要 WinAPI 入口
- `electron` 的 `desktopCapturer` 可替代 PrintWindow 但有限制（不能抓隐藏窗口）
- `sharp` 做截图后处理（PNG 压缩、缩略图）
- `active-win` 测试断言
- 参考：PowerToys FancyZones / Windows Snap Layouts 右键菜单设计

---

## 九、贡献到 contracts/22

- `WindowOpIntent<K>`, `WindowOpKind`, `WindowOpArgs`, `WindowOpResult<K>`, `WindowOpErrorCode`

## 十、贡献到 contracts/23

16 个 channel（包含之前 spec/07 的 `window:set-title`，此处做 catalog 聚合）

## Implementation Snapshot - 2026-04-29 P4.2-e CODE-DONE

本轮已将窗口操作从零散按钮提升为共享操作目录和真实 IPC 垂直链路。新增 `src/shared/window-operations-catalog.ts`，以稳定 `WindowOperationKind` 覆盖 16 个动作，其中前 13 个覆盖 P4.2-e 主验收：聚焦 / 前置、最小化、最大化、还原、置顶 / 取消置顶、截屏当前窗口、强制关闭窗口、结束所属进程、跳到所属进程详情、跳到所属端口详情、跳到所属 AI 任务、收藏 / 取消收藏、打开工作目录。额外动作包括打开相关项目、复制窗口标题、编辑窗口标题。

真实链路说明：`WindowManager.screenshotWindow()` 使用 Windows `System.Drawing.Graphics.CopyFromScreen` 按当前窗口矩形保存 PNG 到 Electron `userData/window-screenshots`；`toggleFavorite()` 按窗口指纹写入 `electron-store` 的 `favorites`；`openWorkingDirectory()` 通过 `Win32_Process.ExecutablePath` 解析 PID 对应可执行文件目录并调用 Electron `shell.openPath`；危险的结束进程操作复用已有 `systemProcess.kill(pid)`，不新增 mock 通道。UI 侧 `WindowOperationPanel` 在普通窗口卡片、列表项、按进程分组项和 AI 窗口卡片中统一暴露，并使用 `data-testid=window-op-<kind>` 供后续 E2E 定位。

已验证：`pnpm exec vitest run src/shared/window-operations-catalog.test.ts src/main/services/WindowManager.test.ts` 通过 11 tests；合并回归 `pnpm exec vitest run src/shared/window-operations-catalog.test.ts src/main/services/WindowManager.test.ts src/shared/detection/derive-progress.test.ts src/renderer/components/monitor/ai-task/ProgressBar.test.tsx src/main/services/AITaskTracker.test.ts` 通过 61 tests；`pnpm typecheck`、`pnpm lint`、`pnpm check:no-emoji` 通过；相关文件 `git diff --check` 仅报告 Windows CRLF 提示。

2026-04-30 验证更新：新增真实 Electron E2E `P4.2-e 窗口操作目录对真实窗口执行关键操作`，创建真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd，并调用真实 preload/IPC 覆盖 `focus`、`minimize`、`restore`、`maximize`、`setTopmost`、`setOpacity`、`toggleFavorite`、`screenshot`、`setTitle` 与 `close`；截图断言真实 PNG 文件落盘，关闭断言后续扫描中窗口消失。验证命令：`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-e" --timeout=120000 --workers=1` 为 `1 passed (9.8s)`；`pnpm typecheck` 通过。当前真实窗口操作链路已标记 `[TEST-PASS]`；端口 / 进程 / AI 任务跳转仍依赖运行时真实关联数据和后续用户手测增强。
