# Spec R8.B-10 — 窗口批量操作（7 项 + 进度反馈 + undo）

> **flag**: `R8.B.window.batch-ops`
> **priority**: P1（V1-Q-6.C.4 全选）
> **status**: planning
> **upstream**: R8.A spec-08（always-on-top IPC）+ R8.B spec-09（缩略图墙多选）
> **downstream**: R8.B spec-04（命令面板触发批量）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-6.C.4
  answer: "全选"
  - id: V2-Q-12.H.1
  answer: "E"  # Ctrl/Shift/Lasso/全选
  - id: V2-Q-12.H.2
  answer: "全选"
  - id: V2-Q-12.H.3
  answer: "全选"  # 二次确认场景
  - id: V2-Q-12.H.4
  answer: "D"  # 进度条 + 失败重试 + undo
```

### 1.2 现状缺陷

```
devhub/src/main/services/WindowService.ts
  - 单 hwnd 操作（focus/min/close）
  - 无批量 API
devhub/src/renderer/components/monitor/WindowView.tsx
  - 无多选 UI（仅单选）
  - 无 lasso 框选
没有：进度条 / undo / 失败重试 / 二次确认
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 7 批量操作 | focus / minimize / close / aot / screenshot / rename / inject |
| 多选方式 | Ctrl+Click / Shift+Click / Lasso 框选 / 全选 |
| 进度反馈 | 实时进度条 + 失败列表 |
| undo 时间窗 | 5 秒 |
| 二次确认 | close > 5 个 / inject 任何场景 |
| 批量并发 | 4（与缩略图截图共池） |

---

## 2. affected_source

```yaml
read:
  - devhub/src/main/services/WindowService.ts
  - R8.A spec-08 always-on-top IPC
  - R8.B spec-09 多选
modify:
  - devhub/src/main/services/WindowService.ts  # 加 batch API
  - devhub/src/renderer/components/monitor/WindowView.tsx  # 多选 UI
new:
  - devhub/src/renderer/components/monitor/window/BatchToolbar.tsx
  - devhub/src/renderer/components/monitor/window/LassoSelect.tsx
  - devhub/src/renderer/components/monitor/window/BatchProgressToast.tsx
  - devhub/src/renderer/components/monitor/window/BatchConfirmDialog.tsx
  - devhub/src/renderer/hooks/useBatchSelection.ts
  - devhub/src/renderer/hooks/useBatchExecutor.ts
  - devhub/src/main/services/WindowBatchExecutor.ts
  - devhub/src/main/services/InjectTextService.ts
  - devhub/src/main/services/RenameWindowService.ts
  - devhub/src/main/ipc/windowBatchHandlers.ts
test:
  - devhub/src/renderer/hooks/useBatchExecutor.test.ts
  - devhub/tests/e2e/window-batch.spec.ts
docs:
  - docs/r8/window-batch.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const BatchActionSchema = z.enum([
  'focus', 'minimize', 'close', 'aot-toggle',
  'screenshot', 'rename', 'inject-text',
])

export const BatchRequestSchema = z.object({
  action: BatchActionSchema,
  hwnds: z.array(z.number().int().positive()),
  args: z.record(z.string(), z.unknown()).default({}),
  confirmed: z.boolean().default(false),
  dryRun: z.boolean().default(false),
})

export const BatchResultSchema = z.object({
  hwnd: z.number().int(),
  status: z.enum(['ok', 'failed', 'skipped', 'rolled-back']),
  error: z.string().optional(),
  output: z.unknown().optional(),
})

export const BatchProgressSchema = z.object({
  jobId: z.string().uuid(),
  total: z.number().int(),
  completed: z.number().int(),
  failed: z.number().int(),
  results: z.array(BatchResultSchema),
  state: z.enum(['running', 'paused', 'completed', 'cancelled']),
})

export const BATCH_LIMITS = {
  CONFIRM_THRESHOLD_CLOSE: 5,
  CONFIRM_REQUIRED_FOR_INJECT: true,
  UNDO_WINDOW_MS: 5000,
  PARALLEL: 4,
  PROGRESS_PUSH_INTERVAL_MS: 100,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  window:batch-op:
  request: BatchRequestSchema
  response: { jobId: string }
  rate_limit: low_freq_op (60 rpm)
  window:batch-progress:
  direction: main → renderer
  payload: BatchProgressSchema
  push: true
  window:batch-cancel:
  request: { jobId: string }
  window:batch-undo:
  request: { jobId: string }
  response: { undone: number }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'inject-text 未确认'
  code: E_NEEDS_CONFIRM
  handling: '弹 BatchConfirmDialog 二次确认'
  - condition: 'close > 5 未确认'
  code: E_NEEDS_CONFIRM
  - condition: 'hwnd 不存在'
  code: E_NOT_FOUND
  handling: 'skip + 记录在 result'
  - condition: '无管理员权限关闭系统进程'
  code: E_PERMISSION
  handling: '提示用户以管理员重启'
  - condition: '某 hwnd 操作超时'
  code: E_TIMEOUT
  handling: '记录失败 + 继续下一个'
  - condition: '用户在 5s undo 窗口内点 undo'
  handling: '执行反向操作（focus 不可 undo / minimize → restore / close → 不可 undo）'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 多选方式
Given Wall 视图显示
When 用户 Ctrl+Click 3 个 tile
Then 多选状态 = 3

When 用户 Shift+Click 范围
Then 范围内全选

When 用户 Lasso 框选
Then 框内 tile 全选

# A2 — 全选
Given 当前过滤词 = "code" 显示 12 个 tile
When 用户按 Ctrl+A
Then 12 个 tile 全选（仅当前过滤集）

# A3 — 批量 focus
Given 已选 5 个 tile
When 用户点击工具栏 "focus all"
Then 依次激活 5 窗口（间隔 150ms）
  And 进度 toast 实时显示

# A4 — 批量 close 二次确认
Given 已选 8 个 tile
When 用户点击 close all
Then 弹 BatchConfirmDialog "你将关闭 8 个窗口，是否继续？"
  And 用户确认 → 执行
  And 用户取消 → 取消

# A5 — inject text 强制二次确认
Given 已选 3 个 AI 工具窗口
When 用户点击 inject "Hello"
Then 弹 BatchConfirmDialog（不论数量）
  And 文本预览
  And 确认后注入

# A6 — 进度反馈
Given 批量执行中
Then 进度条实时（0/N → N/N）
  And 失败列表（hwnd + 原因）
  And 用户可点 cancel

# A7 — undo 5s
Given 批量 minimize 8 个窗口已完成
When 用户在 5s 内点击 undo
Then 8 个窗口 restore

# A8 — 批量 screenshot 写文件
Given 已选 5 个 tile
When 用户点击 screenshot all
Then 5 个 PNG 写到用户指定目录
  And 完成 toast 显示路径

# A9 — 批量 rename
Given 已选 3 窗口（同 EXE）
When 用户输入 alias = "claude-frontend"
Then 3 窗口的 alias 持久化（WindowGroupResolver）

# A10 — 失败重试
Given 批量操作有 2 个失败
When 用户点击"重试失败项"
Then 仅对失败 hwnd 重新执行
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/window-batch.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('lasso select multi', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="window"]')
  await page.click('[data-view-mode="wall"]')
  // lasso
  await page.mouse.move(50, 100)
  await page.mouse.down()
  await page.mouse.move(800, 600, { steps: 10 })
  await page.mouse.up()
  const selected = await page.getByTestId(/^thumbnail-tile-/).filter({ has: page.getByTestId('selected-mark') }).count()
  expect(selected).toBeGreaterThan(0)
  await app.close()
})

test('batch close requires confirm', async () => {
  // ... 选 6 tile + 点 close → 期望 dialog 出现
})
```

---

## 8. reference_impl

### 8.1 useBatchExecutor

```typescript
export function useBatchExecutor() {
  const execute = useCallback(async (req: BatchRequest) => {
  // 二次确认逻辑
  if (req.action === 'inject-text' && !req.confirmed) return await openConfirmDialog(req)
  if (req.action === 'close' && req.hwnds.length > BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE && !req.confirmed) {
  return await openConfirmDialog(req)
  }
  const { jobId } = await window.devhub.invoke('window:batch-op', req)
  const off = window.devhub.on('window:batch-progress', (progress) => {
  if (progress.jobId === jobId) updateUI(progress)
  })
  return jobId
  }, [])
  return { execute }
}
```

### 8.2 WindowBatchExecutor (main)

```typescript
import PQueue from 'p-queue'

export class WindowBatchExecutor {
  private queue = new PQueue({ concurrency: BATCH_LIMITS.PARALLEL })
  async run(req: BatchRequest): Promise<string> {
  const jobId = crypto.randomUUID()
  const progress: BatchProgress = { jobId, total: req.hwnds.length, completed: 0, failed: 0, results: [], state: 'running' }

  for (const hwnd of req.hwnds) {
  this.queue.add(async () => {
  try {
  const out = await this.executeOne(req.action, hwnd, req.args)
  progress.completed++
  progress.results.push({ hwnd, status: 'ok', output: out })
  } catch (err) {
  progress.failed++
  progress.results.push({ hwnd, status: 'failed', error: err.message })
  }
  this.pushProgress(progress)
  })
  }
  return jobId
  }
  private executeOne(action, hwnd, args) {
  switch (action) {
  case 'focus': return WindowService.focus(hwnd)
  case 'minimize': return WindowService.minimize(hwnd)
  case 'close': return WindowService.close(hwnd)
  case 'aot-toggle': return WindowService.toggleAlwaysOnTop(hwnd)
  case 'screenshot': return ThumbnailService.captureToFile(hwnd, args.dir)
  case 'rename': return RenameWindowService.setAlias(hwnd, args.alias)
  case 'inject-text': return InjectTextService.send(hwnd, args.text)
  }
  }
}
```

### 8.3 关键参考链接

- p-queue：https://github.com/sindresorhus/p-queue
- Win32 SetForegroundWindow：https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow

---

## 9. impact_radius_loc

```yaml
new_files: 11
modified_files: 2
estimated_loc:
  BatchToolbar.tsx: 130
  LassoSelect.tsx: 110
  BatchProgressToast.tsx: 100
  BatchConfirmDialog.tsx: 90
  useBatchSelection.ts: 130
  useBatchExecutor.ts: 130
  WindowBatchExecutor.ts: 280
  InjectTextService.ts: 200
  RenameWindowService.ts: 80
  windowBatchHandlers.ts: 130
  WindowService.ts (modify): +100
  WindowView.tsx (modify): +80
  tests: 350
total_loc: ~1810
risk_level: high (inject-text 需要 native + 安全)
```

---

## 10. implement_checklist

- [x] WindowBatchExecutor + p-queue
- [x] InjectTextService（SendInput / WM_CHAR）
- [x] RenameWindowService（持久化 alias 到 WindowGroupResolver）
- [x] BatchToolbar UI（7 按钮 + 选中数）
- [x] LassoSelect 框选交互
- [x] BatchProgressToast 进度条 + cancel
- [x] BatchConfirmDialog 二次确认（close > 5 / inject）
- [x] useBatchSelection（Ctrl/Shift/Lasso/Ctrl+A）
- [x] window:batch-op / batch-progress / batch-cancel / batch-undo IPC
- [x] undo 5s 时间窗（minimize → restore）
- [x] 与 spec-09 联动（多选 from Wall）
- [x] 与 spec-04 联动（命令面板"批量 focus 当前过滤"）
- [x] 单元 + e2e
- [x] 文档：docs/r8/window-batch.md
- [x] 验收 ASSERT_WINDOW_BATCH_7_OPS

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-08 always-on-top IPC
  - R8.B spec-09 缩略图墙
sibling_libs:
  - p-queue: ^8.0.0
  - koffi: 已存在
downstream_specs:
  - R8.C spec-19 自动注入（复用 InjectTextService）
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: 单 hwnd 操作超时
  action: skip + 记录
  - condition: SendInput 被系统拒绝
  action: 回退 WM_CHAR
  - condition: undo 5s 内对方进程已变化
  action: best-effort + toast
  - condition: lasso 性能低
  action: 退化为 Ctrl+Click 多选
flag_disable: 关闭 R8.B.window.batch-ops 时单选回归
```

---

## 13. performance_budget

```yaml
budgets:
  batch_per_action_ms_p95: 200
  parallel: 4
  progress_push_interval_ms: 100
  inject_per_char_ms: 5
  undo_minimize_restore_ms: 50
test_harness:
  - benchmark: bench-batch-window.mjs
  target: 20 hwnd batch focus p95 < 5s
```

---

## 14. implementation_status

```yaml
status_date: 2026-05-17
evidence_status: verified
checked_checkboxes: 15
open_checkboxes: 0
implemented:
  - Shared Zod contract slice in `devhub/src/shared/schemas/r8-runtime.ts`:
  - `windowBatchActionSchema`
  - `windowBatchRequestSchema`
  - `windowBatchResultSchema`
  - `windowBatchProgressSchema`
  - `windowBatchStartResponseSchema`
  - `windowBatchJobRequestSchema`
  - `windowBatchCancelResponseSchema`
  - `windowBatchUndoResponseSchema`
  - `WINDOW_BATCH_LIMITS`
  - `p-queue@8.1.0` installed in `devhub/package.json` and lockfile.
  - Main-process `WindowBatchExecutor` in `devhub/src/main/services/WindowBatchExecutor.ts`:
  - uses `PQueue({ concurrency: WINDOW_BATCH_LIMITS.PARALLEL })` for bounded parallel HWND work;
  - keeps focus sequential with `WINDOW_BATCH_LIMITS.FOCUS_INTERVAL_MS`;
  - uses a single real `WindowManager.focusWindows()` PowerShell/Win32 helper invocation for focus batches when the concrete window manager supports it, avoiding one PowerShell process per HWND while preserving per-HWND success/failure results;
  - records per-HWND `ok`, `failed`, `skipped`, and `rolled-back` results through the shared Zod schema;
  - supports best-effort cancel by clearing queued HWNDs without pretending already-running native calls were killed;
  - supports a 5-second minimize undo window by calling the real `WindowManager.restoreWindow` bridge.
  - Executable main-process IPC in `devhub/src/main/ipc/windowHandlers.ts`:
  - `window:batch-op`
  - `window:batch-cancel`
  - `window:batch-undo`
  - `window:batch-progress` push via `BrowserWindow.webContents.send`.
  - `devhub/src/main/ipc/r8RuntimeHandlers.ts` now reserves executable batch channels for the window IPC owner instead of the R8 contract-only fallback.
  - Preload and renderer global types expose `windowManager.batchOp`, `batchCancel`, `batchUndo`, and `onBatchProgress`.
  - Renderer batch model in `devhub/src/renderer/components/monitor/window/windowBatchModel.ts`.
  - BatchToolbar now exposes selected-count UI plus focus, tile, cascade, stack, layout undo, always-on-top, screenshot, minimize, restore, close, select-all, and clear-selection actions.
  - `BatchProgressToast` renders real `WindowBatchProgress` state for renderer batch operations, including completed/total, progress bar, success/failure/skipped counters, failed HWND detail, close-on-finished, and a best-effort `cancel remaining` path.
  - `BatchProgressToast` now exposes a `retry failed items` action after a non-running batch with failed results, and `WindowView.tsx` reuses the last real renderer batch context to re-execute only HWNDs whose latest `WindowBatchProgress.results` entry has `status === 'failed'`.
  - `runSequentialWindowBatch()` now publishes incremental progress and, when cancellation is requested, skips not-yet-started HWNDs instead of pretending an already-running native window call was killed.
  - `BatchConfirmDialog` replaces platform `confirm()` for the two sensitive window batch boundaries:
  - close selections above `WINDOW_BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE` show a custom danger dialog with the target HWND list before executing;
  - safe keyboard injection shows a custom warning dialog with the redacted HWND/title/key target before calling `sendKeysToWindow`.
  - Existing `spec-09` thumbnail wall Ctrl/Cmd/checkbox selection feeds the same `selectedWindows` set as the batch toolbar.
  - `src/renderer/hooks/useBatchSelection.ts` centralizes real HWND selection state for Ctrl/Cmd toggle, Shift range, Ctrl+A current-filter select-all, lasso rectangle selection, clear, remove-after-close, and stale-prune helpers.
  - `src/renderer/components/monitor/window/LassoSelect.tsx` implements pointer-based lasso selection over rendered DOM nodes marked with `data-window-selection-hwnd`; it collects only real HWND values from the current WindowView surface and supports additive Ctrl/Cmd/Shift lasso without mock rows.
  - `WindowView.tsx` now routes card, list, process-group, AI-window, thumbnail-wall, toolbar select-all, and Ctrl+A selection through `useBatchSelection`, preserving existing focus/detail clicks and existing real window operations.
  - `ThumbnailTile.tsx` and `ThumbnailWall.tsx` now pass selection gestures through the shared selection hook contract so spec-09 wall selection and spec-10 batch selection stay consistent.
  - Batch focus, minimize, restore, close, screenshot, and always-on-top use existing real window bridges and record per-HWND results through the renderer model.
  - Close selection above `WINDOW_BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE` requires platform confirmation before execution.
  - Main-process close requests above `WINDOW_BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE` also require `confirmed=true`.
  - Main-process `inject-text` requires confirmation.
  - Confirmed `args.text` is routed through `WindowManager.sendTextToWindow()`, which focuses the target HWND, sends Unicode text through a real Win32 `SendInput` helper first, falls back to the existing PowerShell/C# `WM_CHAR` `PostMessage` bridge when `SendInput` fails, and returns truthful per-window failures if the HWND is invalid or both Windows API paths fail.
  - Confirmed safe `args.keys` values remain routed through the existing `sendKeysToWindow` bridge.
  - Main-process `rename` calls the existing `setWindowTitle` bridge for `args.title`.
  - Main-process `rename` with `args.alias` persists a real `AIWindowAlias` through the existing `AIAliasManager`, scans the latest real window list before writing, records `pid`, `titlePrefix`, `executablePath`, `toolType`, and `appliedExternalTitle`, applies the real window title, and rolls the persisted alias back if `setWindowTitle` fails.
  - The persisted alias is consumed by the existing WindowView display-name lookup and thumbnail wall group key path, preserving the current WindowGroupResolver-style renderer integration instead of adding a parallel store.
  - Main-process `aot-toggle` requires explicit `args.topmost` and updates the local topmost projection only after successful `setWindowTopmost`.
  - Command palette integration for the spec-04 downstream trigger:
  - `R8RuntimeService.listCommands()` exposes `window.batch.focus-filtered`;
  - `R8RuntimeService.invokeCommand()` emits `monitor-navigate` with `tab: window` and then `window-batch-focus-filtered`;
  - `App.tsx` bridges the command event into `devhub:window-batch-focus-filtered`;
  - `WindowView.tsx` executes batch focus only for the currently filtered real HWND rows.
  - Release assertion `ASSERT_WINDOW_BATCH_7_OPS` is verified by a packaged Electron Playwright test that creates real `BrowserWindow` probes, scans real HWNDs, and covers focus, minimize plus undo, close, always-on-top toggle, screenshot, rename alias/title persistence, and inject-text through the public preload batch API.
  - Documentation in `devhub/docs/r8/window-batch.md`.
verified:
  - `pnpm -C devhub test --run src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"` passed with 2 files and 8 tests.
  - `pnpm -C devhub test --run src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/window/windowBatchModel.test.ts --maxWorkers=1` passed with 4 files and 39 tests.
  - `pnpm -C devhub check:zod-sot` passed.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 667 files.
  - `pnpm -C devhub check:no-cloud-deps` passed.
  - `pnpm -C devhub check:no-ocr-deps` passed.
  - `pnpm -C devhub exec eslint src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/extended.ts src/renderer/types/global.d.ts src/shared/schemas/r8-runtime.ts` passed.
  - Targeted diff whitespace checks passed for the code, docs, spec, contract, and ledger files touched by this slice.
  - TypeScript Compiler API diagnostics passed for the 8 touched TypeScript files during the initial main-executor slice.
  - `pnpm -C devhub typecheck` now passes after the later minimal `GraphCanvas.tsx` syntax repair removed the global parser blocker.
  - `pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "filtered window batch focus|focuses only the current filtered windows"` passed with 2 files and 2 focused tests.
  - `pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 667 files after the command palette focus slice.
  - `git -C devhub diff --check -- src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed with LF-to-CRLF warnings only.
  - `pnpm -C devhub test --run src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "WindowBatchExecutor|R8 IPC contract"` passed with 2 files and 9 tests.
  - `pnpm -C devhub exec eslint src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts` passed after the persisted alias rename slice.
  - TypeScript Compiler API diagnostics passed for `WindowBatchExecutor.ts`, `WindowBatchExecutor.test.ts`, `windowHandlers.ts`, and `r8RuntimeHandlers.test.ts` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
  - `pnpm -C devhub test --run src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "arbitrary text|WindowBatchExecutor|R8 IPC contract"` passed with 3 files, 10 focused tests passed, and 34 skipped.
  - `pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts` passed after the WM_CHAR arbitrary-text slice.
  - TypeScript Compiler API diagnostics passed for `WindowManager.ts`, `WindowManager.test.ts`, `WindowBatchExecutor.ts`, `WindowBatchExecutor.test.ts`, and `r8RuntimeHandlers.test.ts` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 667 files after the WM_CHAR arbitrary-text slice.
  - `git -C devhub diff --check -- src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts docs/r8/window-batch.md docs/r8bc-implementation-report.md` passed with LF-to-CRLF warnings only.
  - `git diff --check -- prompts/0503-2/R8.B/spec-10-window-batch-ops.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md` passed.
  - `pnpm -C devhub test --run src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/BatchProgressToast.test.tsx --maxWorkers=1 -t "R8.B window batch model|R8.B BatchProgressToast"` passed with 2 files and 8 focused tests.
  - `pnpm -C devhub exec eslint src/renderer/components/monitor/window/windowBatchModel.ts src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx` passed after the BatchProgressToast slice.
  - TypeScript Compiler API diagnostics passed for `windowBatchModel.ts`, `windowBatchModel.test.ts`, `BatchProgressToast.tsx`, `BatchProgressToast.test.tsx`, and `WindowView.tsx` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 669 files after the BatchProgressToast slice.
  - `pnpm -C devhub test --run src/renderer/components/monitor/window/BatchConfirmDialog.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "BatchConfirmDialog|safe keyboard|custom batch confirm"` passed with 2 files, 6 focused tests passed, and 10 skipped.
  - `pnpm -C devhub exec eslint src/renderer/components/monitor/window/BatchConfirmDialog.tsx src/renderer/components/monitor/window/BatchConfirmDialog.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed after the BatchConfirmDialog slice.
  - TypeScript Compiler API diagnostics passed for `BatchConfirmDialog.tsx`, `BatchConfirmDialog.test.tsx`, `WindowView.tsx`, and `WindowView.test.tsx` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 671 files after the BatchConfirmDialog slice.
  - `pnpm -C devhub test --run src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "window batch selection|ThumbnailWall|Ctrl|lasso|custom batch confirm|safe keyboard|filtered windows"` passed with 3 files, 14 focused tests passed, and 9 skipped after the useBatchSelection/lasso slice.
  - `pnpm -C devhub exec eslint src/renderer/hooks/useBatchSelection.ts src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/LassoSelect.tsx src/renderer/components/monitor/window/ThumbnailWall.tsx src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/window/ThumbnailTile.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed after the useBatchSelection/lasso slice.
  - TypeScript Compiler API diagnostics passed for `useBatchSelection.ts`, `useBatchSelection.test.ts`, `LassoSelect.tsx`, `ThumbnailWall.tsx`, `ThumbnailWall.test.tsx`, `ThumbnailTile.tsx`, `WindowView.tsx`, and `WindowView.test.tsx` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 674 files after the useBatchSelection/lasso slice.
  - `git -C devhub diff --check -- src/renderer/hooks/useBatchSelection.ts src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/LassoSelect.tsx src/renderer/components/monitor/window/ThumbnailWall.tsx src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/window/ThumbnailTile.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed with LF-to-CRLF warnings only.
  - `pnpm -C devhub test --run src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "BatchProgressToast|retries only failed HWNDs|Ctrl|lasso|custom batch confirm|safe keyboard|filtered windows"` passed with 2 files, 12 focused tests passed, and 9 skipped after the retry-failed-items slice.
  - `pnpm -C devhub exec eslint src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed after the retry-failed-items slice.
  - TypeScript Compiler API diagnostics passed for `BatchProgressToast.tsx`, `BatchProgressToast.test.tsx`, `WindowView.tsx`, and `WindowView.test.tsx` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 674 files after the retry-failed-items slice.
  - `git -C devhub diff --check -- src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed with LF-to-CRLF warnings only.
  - `pnpm -C devhub exec eslint src/main/ipc/index.ts e2e/example.spec.ts` passed after the Electron E2E slice.
  - TypeScript Compiler API diagnostics passed for `src/main/ipc/index.ts` and `e2e/example.spec.ts` before the final full typecheck gate.
  - `pnpm -C devhub build` now passes after the later minimal `GraphCanvas.tsx` syntax repair, emitting main, preload, and renderer bundles.
  - `pnpm -C devhub test:e2e --grep "R8.B spec-10" --reporter=line --workers=1` passed with 1 Electron test. The test launches the packaged app from `out/main/index.js`, creates two real Electron `BrowserWindow` probes, scans their real HWNDs through the runtime test hook, executes `window.devhub.windowManager.batchOp({ action: 'minimize', confirmed: true, hwnds })`, receives real `onBatchProgress`, and restores them through `batchUndo`.
  - `pnpm -C devhub test --run src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.test.ts --maxWorkers=1 -t "focuses multiple HWNDs|single batched focus|WindowBatchExecutor|arbitrary text"` passed with 2 files, 11 focused tests passed, and 10 skipped after the batch-focus benchmark slice.
  - `pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts scripts/bench-batch-window.mjs` passed after the batch-focus benchmark slice.
  - TypeScript Compiler API diagnostics passed for `WindowManager.ts`, `WindowManager.test.ts`, `WindowBatchExecutor.ts`, `WindowBatchExecutor.test.ts`, `src/main/ipc/index.ts`, and `e2e/example.spec.ts` before the final full typecheck gate.
  - `pnpm -C devhub bench:window-batch` passed through the packaged Electron app and public preload bridge with 20 real `BrowserWindow` HWNDs and 5 focus samples: p95 4077.2ms under the 5000ms budget.
  - `npx gitnexus impact DevhubRuntimeTestHooks --repo devhub --direction upstream --depth 2` returned LOW risk with 0 direct callers before adding the runtime alias test hook.
  - `npx gitnexus impact RuntimeTestHooks --repo devhub --direction upstream --depth 2 --include-tests` returned LOW risk with 0 direct callers before extending the E2E hook type.
  - `pnpm -C devhub exec eslint src/main/index.ts e2e/example.spec.ts` passed after the `ASSERT_WINDOW_BATCH_7_OPS` alias persistence verification path moved from unavailable renderer IPC to the real main-process runtime alias manager hook.
  - `pnpm -C devhub build` passed after the runtime test hook update.
  - `pnpm -C devhub test:e2e --grep "ASSERT_WINDOW_BATCH_7_OPS" --reporter=line --workers=1` passed with 1 real Electron test. The test launches the packaged app from `out/main/index.js`, creates seven real `BrowserWindow` probes, scans their real HWNDs through `scanWindowsIntoCacheForTests()`, executes focus, minimize, aot-toggle, screenshot, rename, inject-text, and close through `window.devhub.windowManager.batchOp()`, verifies rename persistence through the same real `AIAliasManager` used by the batch executor, verifies text injection inside the target textarea, checks screenshot file existence, and restores minimized state with `batchUndo`.
  - `pnpm -C devhub exec eslint src/renderer/components/topology/GraphCanvas.tsx` passed after the minimal syntax repair.
  - `pnpm -C devhub build` passed after the minimal syntax repair.
  - `pnpm -C devhub typecheck` passed after the minimal syntax repair.
  - `pnpm -C devhub lint` passed after the benchmark and build-gate recovery slices, including `check:no-emoji` over 675 files.
  - `git -C devhub diff --check -- package.json scripts/bench-batch-window.mjs src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/index.ts e2e/example.spec.ts src/renderer/components/topology/GraphCanvas.tsx docs/r8/window-batch.md docs/r8bc-implementation-report.md src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed with LF-to-CRLF warnings only.
  - `git diff --check -- prompts/0503-2/R8.B/spec-10-window-batch-ops.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md` passed.
completion_boundary:
  - The spec-10 checklist is closed against real local evidence, including the `ASSERT_WINDOW_BATCH_7_OPS` release assertion.
  - The command palette scope intentionally remains the spec-defined "batch focus current filter" command; a broader command suite is not claimed by this spec.
  - No mock, fake HWND, fake progress, OCR, or cloud path is involved in the verified window batch flow.
```
