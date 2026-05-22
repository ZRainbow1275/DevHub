# R8.B Process Batch Operations

## Current Verified Slice

The current implementation is a low-risk backend-first slice for `prompts/0503-2/R8.B/spec-12-process-batch-ops.md`. The renderer keeps the earlier sequential runner only as a compatibility fallback when the preload bridge is unavailable.

- Shared runtime contracts live in `src/shared/schemas/r8-runtime.ts`:
  - `processBatchActionSchema`
  - `processBatchRequestSchema`
  - `processBatchResultSchema`
  - `processBatchProgressSchema`
  - `processBatchStartResponseSchema`
  - `processBatchJobRequestSchema`
  - `processBatchCancelResponseSchema`
  - `processBatchUndoResponseSchema`
  - `PROCESS_BATCH_LIMITS`
- Main-process execution lives in `src/main/services/ProcessBatchExecutor.ts`:
  - `p-queue@8.1.0` runs PID work with bounded concurrency
  - `process:batch-op` starts jobs
  - `process:batch-progress` streams validated progress snapshots
  - `process:batch-cancel` skips queued PIDs without pretending in-flight OS calls were interrupted
  - `process:batch-undo` rolls back successful tag writes within the 5-second undo window
- Shared text injection lives in `src/main/services/inject/InjectTextService.ts` and is reused by both `WindowBatchExecutor` and `ProcessBatchExecutor`.
- The process monitor now has a batch toolbar with the six spec actions visible:
  - `kill`
  - `focus`
  - `inject-text`
  - `tag`
  - `add-watchdog`
  - `export-diag`
- List and grouped process rows support real multi-selection:
  - single click replaces the selection
  - Ctrl or Cmd click toggles a PID
  - Shift click selects the visible range from the anchor PID
  - Ctrl or Cmd + A selects the current filtered PID list when focus is not inside an input
- `kill` executes per PID through the main-process scanner and rejects PID values below 100 before any native termination call.
- `focus` executes through the real `WindowManager.scanWindows(false)` + `focusWindow(hwnd)` path by locating a visible window whose `pid` matches the selected process. Explicit `args.hwnd` disambiguates same-PID multi-window cases.
- `inject-text` prompts for text in the renderer, requires confirmation, resolves a visible PID-owned window, then calls shared `InjectTextService` over the real `WindowManager.sendTextToWindow(hwnd, text)` path. Explicit `args.hwnd` can target a specific PID-owned window. Missing windows are reported as skipped.
- `WindowManager.sendTextToWindow()` uses real clipboard-paste with clipboard restoration before falling back to SendInput and WM_CHAR, so successful injection requires a native text path instead of a mocked renderer write.
- `export-diag` calls the real local `R8RuntimeService.exportDiagnosticPack()` bridge and stores the resulting manifest in each PID result.
- `tag` opens `ProcessBatchTagDialog`, validates arguments through `processBatchTagArgsSchema`, and executes through `ProcessTagStore` in the main process for each selected `(exe/name, cwd)` identity.
- Successful batch tag writes expose a 5-second undo banner. Undo restores the previous tag when one existed and removes the newly-created tag when the identity had no prior tag.
- `add-watchdog` requires confirmation and calls `R8RuntimeService.registerWatchdogInstance()` per PID. It fails truthfully when the selected process cannot be mapped to a supported AI tool type or when `args.tool` is missing.
- Confirmation-required actions use the project `ConfirmDialog` surface instead of browser `window.confirm()`.
- Completed failed jobs expose `重试失败项`; retry creates a new request with only the failed PID subset and the original action arguments.

## Safety Rules

- Batch kill is always per PID. The UI does not issue image-name or wildcard process termination.
- PID values are normalized, deduplicated, positive, and Zod-validated before execution.
- PID values below `PROCESS_BATCH_LIMITS.SYSTEM_PID_THRESHOLD` are blocked for batch kill instead of being sent to the native bridge.
- Killing more than `PROCESS_BATCH_LIMITS.CONFIRM_THRESHOLD_KILL` selected PIDs requires platform confirmation.
- `inject-text` and `add-watchdog` remain confirmation-required in the shared model.
- Kill is explicitly treated as non-undoable. No fake undo is exposed.
- Tag undo is only offered for successful tag writes and only for the bounded `PROCESS_BATCH_LIMITS.UNDO_WINDOW_MS` window.
- Diagnostic export remains local-only and does not upload packs or fabricate artifact paths.

## Verification

Targeted low-resource verification for this slice:

```bash
pnpm -C devhub exec vitest run src/main/services/ProcessBatchExecutor.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/ProcessBatchExecutor.test.ts src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/inject/InjectTextService.test.ts src/main/services/WindowBatchExecutor.test.ts src/main/services/ProcessBatchExecutor.test.ts --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/ProcessBatchExecutor.ts src/main/services/ProcessBatchExecutor.test.ts src/main/ipc/processHandlers.ts src/main/ipc/index.ts src/preload/extended.ts src/renderer/types/global.d.ts src/renderer/components/monitor/ProcessView.tsx src/shared/schemas/r8-runtime.ts --max-warnings=0
pnpm -C devhub exec eslint src/main/services/inject/InjectTextService.ts src/main/services/inject/InjectTextService.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/ProcessBatchExecutor.ts src/main/services/ProcessBatchExecutor.test.ts --max-warnings=0
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub test --run src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/hooks/useProcessSelection.test.ts src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx --maxWorkers=1 -t "R8.B"
pnpm -C devhub test --run src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.test.tsx --maxWorkers=1
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.test.tsx src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx src/renderer/components/monitor/process/processBatchModel.test.ts
pnpm -C devhub typecheck
pnpm -C devhub build
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub test:e2e --grep "R8.B spec-12" --reporter=line
pnpm -C devhub bench:process-batch
```

## Release Evidence

- `R8.B spec-12` Electron Playwright passed against the real public preload bridge and executable `process:batch-op` IPC path for `focus`, `inject-text`, `tag`, `add-watchdog`, `export-diag`, and `kill`.
- The E2E inject path uses a real WinForms text box target and verifies text through a filesystem marker written by the target window process.
- `bench:process-batch` passed `BENCH-PROCESS-BATCH-KILL` with `processCount=4`, `sampleCount=3`, `p95=378.8ms`, and `budgetMs=10000`.
- `ASSERT_PROCESS_BATCH_6_OPS` is closed for the R8.B spec-12 release gate by the six-operation Electron path plus the real batch-kill benchmark.
