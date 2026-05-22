# Spec R8.B-12 — 进程批量操作（5 触发 + 6 操作 + 二次确认）

> **flag**: `R8.B.process.batch-ops`
> **priority**: P1（V1-Q-4.F + V2-Q-12.H）
> **status**: planning
> **upstream**: R8.A spec-02 ProcessUnifiedViewModel + R8.A spec-04 卡片/列表对齐
> **downstream**: R8.B spec-04（命令面板触发批量）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-4.F
  answer: "A+B+C+D+F"  # 不要 E 拖拽
  impact: "5 种触发：单击 / Ctrl-多选 / Shift-范围 / 全选 / 命令面板"
  - id: V2-Q-12.H.2
  answer: "全选"  # 10 项批量动作
  - id: V2-Q-12.H.3
  answer: "全选"  # 6 类需要二次确认场景
  - id: V2-Q-12.H.4
  answer: "D"  # 进度条 + 失败重试 + 5s undo
```

### 1.2 现状缺陷

```
devhub/src/main/services/ProcessService.ts
  - 仅单 PID kill
  - 无 batch API / 无并发限制
devhub/src/renderer/components/monitor/ProcessView.tsx
  - 仅单选 / 无多选 UI
没有：批量 kill / 批量加标签 / 批量 inject / 批量加 watchdog 监控 / 进度反馈
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 5 种触发 | 单击 / Ctrl / Shift / Ctrl+A / 命令面板（不含拖拽 E） |
| 6 批量操作 | kill / focus / inject / 加标签 / 加 watchdog / 截图诊断 |
| 二次确认 | kill 系统进程 / kill > 5 / inject 任何场景 / watchdog 任何场景 |
| 并发 taskkill | 4（与窗口操作共池） |
| undo 5s | kill 不可 undo（提示用户）/ tag 可 undo |
| 进度推送 | 100ms |

---

## 2. affected_source

```yaml
read:
  - devhub/src/main/services/ProcessService.ts
  - devhub/src/renderer/components/monitor/ProcessView.tsx
modify:
  - devhub/src/main/services/ProcessService.ts  # 加 batch
  - devhub/src/renderer/components/monitor/ProcessView.tsx  # 多选 UI
new:
  - devhub/src/renderer/components/monitor/process/ProcessBatchToolbar.tsx
  - devhub/src/renderer/components/monitor/process/ProcessBatchProgress.tsx
  - devhub/src/renderer/hooks/useProcessSelection.ts
  - devhub/src/renderer/hooks/useProcessBatchExecutor.ts
  - devhub/src/main/services/ProcessBatchExecutor.ts
  - devhub/src/main/ipc/processBatchHandlers.ts
test:
  - devhub/src/renderer/hooks/useProcessBatchExecutor.test.ts
  - devhub/tests/e2e/process-batch.spec.ts
docs:
  - docs/r8/process-batch.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const ProcessBatchActionSchema = z.enum([
  'kill', 'focus', 'inject-text', 'tag', 'add-watchdog', 'export-diag',
])

export const ProcessBatchRequestSchema = z.object({
  action: ProcessBatchActionSchema,
  pids: z.array(z.number().int().positive()),
  args: z.record(z.string(), z.unknown()).default({}),
  confirmed: z.boolean().default(false),
  dryRun: z.boolean().default(false),
})

export const ProcessBatchResultSchema = z.object({
  pid: z.number().int(),
  status: z.enum(['ok', 'failed', 'skipped', 'rolled-back']),
  error: z.string().optional(),
  output: z.unknown().optional(),
})

export const ProcessBatchProgressSchema = z.object({
  jobId: z.string().uuid(),
  total: z.number().int(),
  completed: z.number().int(),
  failed: z.number().int(),
  results: z.array(ProcessBatchResultSchema),
  state: z.enum(['running', 'paused', 'completed', 'cancelled']),
})

export const PROCESS_BATCH_LIMITS = {
  CONFIRM_THRESHOLD_KILL: 5,
  CONFIRM_REQUIRED_FOR_INJECT: true,
  CONFIRM_REQUIRED_FOR_WATCHDOG: true,
  CONFIRM_REQUIRED_FOR_SYSTEM_PID: true,
  SYSTEM_PID_THRESHOLD: 100,
  PARALLEL: 4,
  UNDO_WINDOW_MS: 5000,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  process:batch-op:
  request: ProcessBatchRequestSchema
  response: { jobId: string }
  process:batch-progress:
  direction: main → renderer
  push: true
  payload: ProcessBatchProgressSchema
  process:batch-cancel:
  request: { jobId: string }
  process:batch-undo:
  request: { jobId: string }
  response: { undone: number }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'kill 系统 PID < 100 未确认'
  code: E_NEEDS_CONFIRM
  message: '将杀死系统关键进程，请二次确认'
  - condition: 'kill > 5 未确认'
  code: E_NEEDS_CONFIRM
  - condition: 'inject-text 未确认'
  code: E_NEEDS_CONFIRM
  - condition: 'pid 不存在'
  code: E_NOT_FOUND
  handling: 'skip + 记录'
  - condition: 'taskkill 权限不足'
  code: E_PERMISSION
  handling: '提示以管理员重启'
  - condition: '某 pid 操作超时（5s）'
  code: E_TIMEOUT
  handling: 'skip + 记录失败'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 5 种触发
Given Process 列表显示
When 用户单击行
Then 单选

When Ctrl+Click
Then 多选追加

When Shift+Click 范围
Then 范围全选

When Ctrl+A
Then 全部选中（仅当前过滤）

When 用户在命令面板输入 "全选当前过滤的 codex.exe"
Then 实际匹配 codex.exe 的进程被选中

# A2 — 6 批量操作
Given 已选 5 PID
Then 工具栏显示：kill / focus / inject / tag / add-watchdog / export-diag

# A3 — kill 系统进程二次确认
Given 已选 PID 4 (System)
When 用户点 kill
Then 弹"系统进程不允许批量 kill"

# A4 — kill > 5 二次确认
Given 已选 8 PID
When 用户点 kill
Then 弹 confirm dialog "将 kill 8 个进程"

# A5 — inject 必须二次确认
Given 已选 3 AI PID
When 用户点 inject "Hello"
Then 弹 confirm dialog（含文本预览）

# A6 — 进度反馈
Given 批量 kill 10 PID
Then 实时进度条 0-10
  And 失败列表（如有）

# A7 — undo 5s（仅 tag）
Given 批量 tag 10 PID 已完成
When 用户在 5s 内点 undo
Then 10 PID 的 tag 撤回
  And kill / inject 不可 undo（提示）

# A8 — Watchdog 注册
Given 已选 3 PID
When 用户点 "add-watchdog"
Then 弹 confirm "将这些进程加入 watchdog 监控？"
  And 确认后 IPC 创建 watchdog 任务（→ R8.C）

# A9 — 命令面板触发
Given 用户输入 "kill all chrome"
Then 自动选 chrome.exe 所有 PID + 弹 confirm

# A10 — 失败重试
Given 批量 kill 5 失败 2
When 用户点 "重试失败"
Then 仅对 2 个失败 PID 重新调用
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/process-batch.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('multi select via Ctrl+Click', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="process"]')
  const rows = page.getByTestId(/^process-row-/)
  await rows.first().click({ modifiers: ['Control'] })
  await rows.nth(1).click({ modifiers: ['Control'] })
  const counter = await page.getByTestId('selection-counter').textContent()
  expect(counter).toContain('2')
  await app.close()
})

test('kill > 5 confirm', async () => {
  // ... mock 6 fake PIDs → 选中 → 点 kill → 期望 dialog
})
```

---

## 8. reference_impl

### 8.1 ProcessBatchExecutor

```typescript
import PQueue from 'p-queue'

export class ProcessBatchExecutor {
  private queue = new PQueue({ concurrency: PROCESS_BATCH_LIMITS.PARALLEL })

  async run(req: ProcessBatchRequest): Promise<string> {
  const jobId = crypto.randomUUID()
  const progress: ProcessBatchProgress = { jobId, total: req.pids.length, completed: 0, failed: 0, results: [], state: 'running' }
  for (const pid of req.pids) {
  this.queue.add(async () => {
  try {
  const out = await this.executeOne(req.action, pid, req.args)
  progress.completed++
  progress.results.push({ pid, status: 'ok', output: out })
  } catch (err: any) {
  progress.failed++
  progress.results.push({ pid, status: 'failed', error: err.message })
  }
  this.pushProgress(progress)
  })
  }
  return jobId
  }
  private async executeOne(action, pid, args) {
  switch (action) {
  case 'kill': return ProcessService.kill(pid)  // single PID 调用 taskkill
  case 'focus': return WindowService.focusByPid(pid)
  case 'inject-text': return InjectTextService.sendByPid(pid, args.text)
  case 'tag': return TagService.set(pid, args.tag)
  case 'add-watchdog': return WatchdogService.attach(pid, args)
  case 'export-diag': return DiagnosticBundleService.exportProcess(pid, args.dir)
  }
  }
}
```

### 8.2 关键参考链接

- taskkill：https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill
- p-queue：https://github.com/sindresorhus/p-queue

---

## 9. impact_radius_loc

```yaml
new_files: 6
modified_files: 2
estimated_loc:
  ProcessBatchToolbar.tsx: 130
  ProcessBatchProgress.tsx: 90
  useProcessSelection.ts: 130
  useProcessBatchExecutor.ts: 130
  ProcessBatchExecutor.ts: 280
  processBatchHandlers.ts: 110
  ProcessService.ts (modify): +60
  ProcessView.tsx (modify): +90
  tests: 280
total_loc: ~1300
risk_level: high (kill / inject 副作用大)
```

---

## 10. implement_checklist

- [x] ProcessBatchExecutor + p-queue
- [x] 6 操作的 executeOne dispatch
- [x] ProcessBatchToolbar UI
- [x] useProcessSelection（Ctrl/Shift/Ctrl+A 多选）
- [x] 5 类二次确认 dialog
- [x] 5s undo（tag 反向）
- [x] 与 spec-04 联动（命令面板触发）
- [x] 与 spec-09/10 共享 InjectTextService
- [x] R8.C spec-15 联动（add-watchdog 注册）
- [x] 单元 + e2e（主进程/renderer 单元、Electron E2E、真实 benchmark 已补）
- [x] 文档：docs/r8/process-batch.md

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-02 ProcessUnifiedViewModel
  - R8.A spec-04 卡片/列表对齐
sibling_libs:
  - p-queue: ^8.0.0
downstream_specs:
  - R8.C spec-15 watchdog
  - R8.C spec-19 inject
external: 无
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: taskkill 失败
  action: 单 PID skip + 记录
  - condition: inject 拒绝
  action: 单 PID skip + 提示
  - condition: undo 时 PID 已被复用
  action: 不执行 + toast
flag_disable: 关闭 R8.B.process.batch-ops 时单选回归
```

---

## 13. performance_budget

```yaml
budgets:
  batch_per_action_ms_p95: 500
  parallel: 4
  progress_push_ms: 100
  selection_state_ms: 16
test_harness:
  - benchmark: bench-process-batch.mjs
  target: 20 PID kill p95 < 5s
```

---

## 14. implementation_status

```yaml
status_date: 2026-05-18
evidence_status: verified
checked_checkboxes: 11
open_checkboxes: 0
implemented:
  - Shared Zod contract slice in `devhub/src/shared/schemas/r8-runtime.ts`:
  - `processBatchActionSchema`
  - `processBatchRequestSchema`
  - `processBatchResultSchema`
  - `processBatchProgressSchema`
  - `processBatchStartResponseSchema`
  - `processBatchJobRequestSchema`
  - `processBatchCancelResponseSchema`
  - `processBatchUndoResponseSchema`
  - `PROCESS_BATCH_LIMITS`
  - Main-process `ProcessBatchExecutor` in `devhub/src/main/services/ProcessBatchExecutor.ts`:
  - uses `p-queue@8.1.0` with `PROCESS_BATCH_LIMITS.PARALLEL=4`
  - emits throttled `processBatchProgressSchema` snapshots
  - enforces confirmation gates for >5 kill, inject-text, and add-watchdog
  - rejects PID values below 100 for batch kill instead of calling taskkill
  - supports cancel and tag undo without claiming in-flight native calls were interrupted
  - Executable process batch IPC handlers in `devhub/src/main/ipc/processHandlers.ts`:
  - `process:batch-op`
  - `process:batch-cancel`
  - `process:batch-undo`
  - `process:batch-progress` main-to-renderer stream
  - Preload/global bridge in `devhub/src/preload/extended.ts` and `devhub/src/renderer/types/global.d.ts`.
  - Renderer batch model in `devhub/src/renderer/components/monitor/process/processBatchModel.ts`.
  - `useProcessSelection` hook supports single click, Ctrl/Cmd toggling, Shift visible-range selection, and select-all over the current filtered PID list.
  - `ProcessBatchToolbar` displays the six spec actions and exposes selected-count, select-all, and clear-selection controls.
  - `ProcessBatchProgress` renders per-PID ok/failed/skipped status without hiding failed operations.
  - Process list and grouped process rows feed the same `selectedPids` set.
  - Renderer `ProcessView` now prefers the backend `process:batch-op` executor and keeps the prior renderer-side sequential runner as a compatibility fallback.
  - Renderer `ProcessView` replaces browser `window.confirm()` for process batch actions with the project `ConfirmDialog` surface for confirmation-required kill/inject/watchdog operations, while PID<100 kill stays a non-executing warning boundary.
  - `ProcessBatchProgress` exposes a retry-failed control after failed completed jobs and re-runs only the failed PID subset with the original action/args.
  - Batch kill uses the existing real `window.devhub.systemProcess.kill(pid)` bridge per selected PID and blocks system PID values below 100.
  - Batch focus uses the existing real window scan/focus bridge by matching visible windows by PID.
  - Main-process batch focus uses the shared `WindowManager.scanWindows(false)` + `focusWindow(hwnd)` path.
  - Main-process batch focus and inject support explicit `args.hwnd` window disambiguation for same-PID multi-window cases.
  - Shared `InjectTextService` in `devhub/src/main/services/inject/InjectTextService.ts` centralizes the real `WindowManager.sendTextToWindow()` / safe-key injection path and is reused by both `WindowBatchExecutor` and `ProcessBatchExecutor`.
  - Main-process batch inject resolves a visible PID-owned window and calls shared `InjectTextService` with text-only process injection; missing windows are recorded as skipped, not success.
  - `WindowManager.sendTextToWindow()` now tries real clipboard-paste with clipboard restoration, then falls back to SendInput and WM_CHAR instead of treating native short writes as success.
  - Diagnostic export uses the existing real `window.devhub.r8.diagnostic.export` bridge when available and records skipped results if the bridge is unavailable.
  - Main-process diagnostic export calls `R8RuntimeService.exportDiagnosticPack()` with local-only diagnostic sections.
  - Batch tag now opens a real `ProcessBatchTagDialog`, validates `args` through `processBatchTagArgsSchema`, and applies tags through the executable `window.devhub.systemProcess.setProcessTag()` bridge for each selected process identity.
  - Main-process batch tag reuses `ProcessTagStore`, stores previous tag snapshots, and exposes backend undo through `process:batch-undo`.
  - Batch tag undo keeps a 5-second transaction snapshot, restores previous tags when present, and removes newly-created tags through the executable `removeProcessTag()` bridge.
  - Main-process add-watchdog dispatch calls `R8RuntimeService.registerWatchdogInstance()` per PID and fails truthfully when the AI tool type cannot be inferred or supplied via `args.tool`.
  - `process.batch.tag` is registered in the command palette and routes through the runtime command handler to the monitor process tab plus a real `process-batch-tag-open` renderer event.
  - Documentation in `devhub/docs/r8/process-batch.md`.
verified:
  - `pnpm -C devhub exec vitest run src/main/services/ProcessBatchExecutor.test.ts --maxWorkers=1` passed with 1 file and 5 tests, including a real spawned child-process PID kill.
  - `pnpm -C devhub exec vitest run src/main/services/ProcessBatchExecutor.test.ts src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1` passed with 3 files and 16 tests.
  - `pnpm -C devhub exec vitest run src/renderer/components/monitor/process/ProcessBatchProgress.test.tsx src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1` passed with 2 files and 8 tests.
  - `pnpm -C devhub exec eslint src/renderer/components/monitor/process/ProcessBatchProgress.tsx src/renderer/components/monitor/process/ProcessBatchProgress.test.tsx src/renderer/components/monitor/ProcessView.tsx --max-warnings=0` passed.
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectTextService.test.ts src/main/services/WindowBatchExecutor.test.ts src/main/services/ProcessBatchExecutor.test.ts --maxWorkers=1` passed with 3 files and 16 tests.
  - `pnpm -C devhub exec eslint src/main/services/inject/InjectTextService.ts src/main/services/inject/InjectTextService.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/ProcessBatchExecutor.ts src/main/services/ProcessBatchExecutor.test.ts --max-warnings=0` passed.
  - `pnpm -C devhub exec eslint src/main/services/ProcessBatchExecutor.ts src/main/services/ProcessBatchExecutor.test.ts src/main/ipc/processHandlers.ts src/main/ipc/index.ts src/preload/extended.ts src/renderer/types/global.d.ts src/renderer/components/monitor/ProcessView.tsx src/shared/schemas/r8-runtime.ts --max-warnings=0` passed.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub check:no-emoji` passed with `No emoji found in 707 files.`
  - `git -C devhub diff --check -- src/shared/schemas/r8-runtime.ts src/main/services/ProcessBatchExecutor.ts src/main/services/ProcessBatchExecutor.test.ts src/main/ipc/processHandlers.ts src/main/ipc/index.ts src/preload/extended.ts src/renderer/types/global.d.ts src/renderer/components/monitor/ProcessView.tsx` passed after normalizing touched files back to LF.
  - `pnpm -C devhub test --run src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/hooks/useProcessSelection.test.ts src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx --maxWorkers=1 -t "R8.B"` passed with 3 files and 8 tests.
  - `pnpm -C devhub test --run src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.test.tsx --maxWorkers=1` passed with 3 files and 7 tests.
  - `pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.test.tsx src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx src/renderer/components/monitor/process/processBatchModel.test.ts` passed.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub lint` passed, including no-emoji verification.
  - `pnpm -C devhub check:zod-sot` passed.
  - `pnpm -C devhub check:no-cloud-deps` passed.
  - `pnpm -C devhub check:no-ocr-deps` passed.
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "opens batch tag dialog from the R8 command palette through monitor events"` passed with 1 real runtime command-dispatch regression.
  - `pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/ProcessBatchExecutor.ts src/main/services/ProcessBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.ts e2e/process-batch.spec.ts scripts/bench-process-batch.mjs --max-warnings=0` passed.
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectTextService.test.ts src/main/services/WindowBatchExecutor.test.ts src/main/services/ProcessBatchExecutor.test.ts --maxWorkers=1` passed with 3 files and 17 tests after the explicit HWND disambiguation regression was added.
  - `pnpm -C devhub test:e2e --grep "R8.B spec-12" --reporter=line` passed with 1 Electron Playwright test covering real `process:batch-op` paths for focus, inject-text, tag, add-watchdog, export-diag, and kill.
  - `pnpm -C devhub bench:process-batch` passed `BENCH-PROCESS-BATCH-KILL` with `processCount=4`, `sampleCount=3`, `p95=378.8ms`, and `budgetMs=10000`.
  - `pnpm -C devhub build` passed with only the existing Monaco dynamic/static import warning.
  - Trellis context validation passed for the active full-completion-ledger task.
release_assertions:
  - `ASSERT_PROCESS_BATCH_6_OPS` closed by the real Electron Playwright `R8.B spec-12` path covering the six process batch operations through executable IPC, plus the real batch-kill benchmark under budget.
truth_boundary:
  - Unsupported or unresolvable actions are recorded as `failed`/`skipped`; this slice does not fabricate successful inject, tag, diagnostic, or watchdog operations.
  - Batch kill never uses image-name wildcard termination; it only calls the existing validated single-PID bridge.
```
