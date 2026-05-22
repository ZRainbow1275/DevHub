# R8.B Window Batch Operations

This document records the implemented boundary for `prompts/0503-2/R8.B/spec-10-window-batch-ops.md`.

## Implemented Slice

- The window batch contract now exists in `src/shared/schemas/r8-runtime.ts`:
  - `windowBatchActionSchema`
  - `windowBatchRequestSchema`
  - `windowBatchResultSchema`
  - `windowBatchProgressSchema`
  - `WINDOW_BATCH_LIMITS`
- The derived TypeScript types remain `z.infer` outputs:
  - `WindowBatchAction`
  - `WindowBatchRequest`
  - `WindowBatchResult`
  - `WindowBatchProgress`
  - `WindowBatchStartResponse`
  - `WindowBatchJobRequest`
  - `WindowBatchCancelResponse`
  - `WindowBatchUndoResponse`
- `p-queue@8.1.0` is installed and used by `src/main/services/WindowBatchExecutor.ts` with the R8.B concurrency limit:
  - focus runs sequentially with `FOCUS_INTERVAL_MS`,
  - focus batches use one real `WindowManager.focusWindows()` Win32 helper invocation when available, preserving per-HWND results while avoiding one PowerShell process per HWND,
  - all other supported HWND operations run through a bounded queue with `WINDOW_BATCH_LIMITS.PARALLEL`,
  - cancellation clears queued work and reports skipped HWNDs without claiming already-running native calls were killed.
- Main-process batch execution is now exposed through executable IPC in `src/main/ipc/windowHandlers.ts`:
  - `window:batch-op`
  - `window:batch-cancel`
  - `window:batch-undo`
  - `window:batch-progress` is pushed from main to renderer via `webContents.send`.
- The preload bridge in `src/preload/extended.ts` exposes:
  - `windowManager.batchOp`
  - `windowManager.batchCancel`
  - `windowManager.batchUndo`
  - `windowManager.onBatchProgress`
- `src/main/ipc/r8RuntimeHandlers.ts` excludes the executable batch channels from the R8 contract-only fallback so they are owned by the real window IPC layer.
- The renderer has a reusable `windowBatchModel` that:
  - normalizes selected HWNDs,
  - validates batch requests through Zod,
  - identifies close and inject confirmation boundaries,
  - runs selected HWND handlers sequentially,
  - publishes incremental `WindowBatchProgress` snapshots,
  - cancels not-yet-started HWND work by marking remaining results as `skipped`,
  - records per-HWND `ok`, `failed`, or `skipped` results,
  - summarizes partial failure without hiding failures.
- `src/renderer/components/monitor/window/BatchProgressToast.tsx` renders the real progress snapshots from the renderer batch path:
  - progress bar,
  - completed/total count,
  - success/failure/skipped counters,
  - failed HWND detail,
  - `取消剩余` for best-effort skip of not-yet-started HWNDs,
  - `重试失败项` after a non-running batch with failed results,
  - close button after completion or cancellation.
- `WindowView` stores the last real renderer batch execution context and the retry button re-executes only HWNDs whose latest progress result is `failed`; it does not infer retry targets from the current selection.
- The existing window toolbar now exposes additional real operations over selected windows:
  - batch focus,
  - batch tile,
  - batch cascade,
  - batch stack,
  - layout undo,
  - batch always-on-top toggle,
  - batch screenshot,
  - batch minimize,
  - batch restore,
  - batch close.
- Batch focus uses the existing `focusWindow` bridge with the R8.B `FOCUS_INTERVAL_MS` delay.
- Batch screenshot uses the existing `screenshotWindow` bridge and records partial failure.
- Batch always-on-top uses the existing `setWindowTopmost` bridge and updates the local `topmostWindows` projection from successful results only.
- Batch close asks for confirmation when selected HWND count is greater than `WINDOW_BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE`.
- `src/renderer/components/monitor/window/BatchConfirmDialog.tsx` replaces platform `confirm()` for sensitive window batch boundaries:
  - close selections above the threshold show a custom danger dialog with the target HWND list,
  - safe keyboard injection shows a custom warning dialog with the redacted HWND/title/key target.
- Main-process close also refuses unconfirmed `close` requests above `WINDOW_BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE`.
- Main-process inject refuses unconfirmed requests and routes confirmed input through real Windows bridges:
  - confirmed `args.text` values are routed through `WindowManager.sendTextToWindow()`, which focuses the HWND, sends Unicode text through a real Win32 `SendInput` helper first, and falls back to the existing PowerShell/C# `WM_CHAR` bridge if `SendInput` fails,
  - confirmed `args.keys` values are routed through the existing safe `sendKeysToWindow` bridge.
- Main-process rename routes `args.title` through the existing `setWindowTitle` bridge.
- Main-process rename with `args.alias` now persists a real alias through the existing `AIAliasManager` before applying the external title:
  - the executor scans the current window list and refuses to persist if the HWND is not present,
  - persisted aliases include `pid`, `titlePrefix`, `executablePath`, `toolType`, and `appliedExternalTitle`,
  - `setWindowTitle` failure rolls back the alias write instead of leaving stale persisted metadata,
  - the existing WindowView alias lookup and thumbnail wall grouping consume the alias without a new parallel store.
- Main-process always-on-top requires explicit `args.topmost`; it does not guess or fake the current OS topmost state.
- Minimize batches have a 5-second undo window that restores successfully minimized HWNDs through the existing `restoreWindow` bridge.
- The `spec-09` thumbnail wall selection path feeds the same `selectedWindows` set used by this toolbar.
- `src/renderer/hooks/useBatchSelection.ts` centralizes the renderer HWND selection model for:
  - Ctrl/Cmd toggle,
  - Shift range selection,
  - Ctrl+A current-filter selection,
  - lasso rectangle selection,
  - clear/remove-after-close selection maintenance.
- `src/renderer/components/monitor/window/LassoSelect.tsx` provides pointer-based lasso selection over rendered Window monitor nodes marked with `data-window-selection-hwnd`.
- `WindowView` now routes card, list, process-group, AI-window, thumbnail-wall, toolbar select-all, and Ctrl+A selection through the same hook without replacing existing real focus/detail operations.
- `ThumbnailWall` and `ThumbnailTile` pass selection gestures through the shared hook contract so wall Ctrl/Cmd/checkbox selection stays aligned with batch operations.
- The `spec-04` command palette now includes `window.batch.focus-filtered`; invoking it navigates to the Window monitor and dispatches `devhub:window-batch-focus-filtered`, where `WindowView` batch-focuses only the currently filtered real HWND rows through the existing `focusWindow` bridge.
- `ASSERT_WINDOW_BATCH_7_OPS` is closed by a packaged Electron Playwright assertion that creates real probe windows and verifies focus, minimize plus undo, close, always-on-top toggle, screenshot, rename alias/title persistence, and inject-text through the public preload batch API.

## Completion Status

- `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` is verified against its checklist and release assertion.
- The command palette scope remains the spec-defined filtered-window batch focus command; a broader command palette suite is outside this spec's checked scope.
- The verified flow uses real Electron windows, real HWND discovery, real IPC/preload calls, real Win32 window operations, and real filesystem screenshot output.

## Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"
pnpm -C devhub test --run src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/window/windowBatchModel.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub exec eslint src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/extended.ts src/renderer/types/global.d.ts src/shared/schemas/r8-runtime.ts
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "filtered window batch focus|focuses only the current filtered windows"
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub test --run src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "WindowBatchExecutor|R8 IPC contract"
pnpm -C devhub exec eslint src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts
pnpm -C devhub test --run src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "arbitrary text|WindowBatchExecutor|R8 IPC contract"
pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts
pnpm -C devhub test --run src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/BatchProgressToast.test.tsx --maxWorkers=1 -t "R8.B window batch model|R8.B BatchProgressToast"
pnpm -C devhub exec eslint src/renderer/components/monitor/window/windowBatchModel.ts src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx
pnpm -C devhub test --run src/renderer/components/monitor/window/BatchConfirmDialog.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "BatchConfirmDialog|safe keyboard|custom batch confirm"
pnpm -C devhub exec eslint src/renderer/components/monitor/window/BatchConfirmDialog.tsx src/renderer/components/monitor/window/BatchConfirmDialog.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub test --run src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "window batch selection|ThumbnailWall|Ctrl|lasso|custom batch confirm|safe keyboard|filtered windows"
pnpm -C devhub exec eslint src/renderer/hooks/useBatchSelection.ts src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/LassoSelect.tsx src/renderer/components/monitor/window/ThumbnailWall.tsx src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/window/ThumbnailTile.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub test --run src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "BatchProgressToast|retries only failed HWNDs|Ctrl|lasso|custom batch confirm|safe keyboard|filtered windows"
pnpm -C devhub exec eslint src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub exec eslint src/main/ipc/index.ts e2e/example.spec.ts
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.B spec-10" --reporter=line --workers=1
pnpm -C devhub test --run src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.test.ts --maxWorkers=1 -t "focuses multiple HWNDs|single batched focus|WindowBatchExecutor|arbitrary text"
pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts scripts/bench-batch-window.mjs
pnpm -C devhub bench:window-batch
npx gitnexus impact DevhubRuntimeTestHooks --repo devhub --direction upstream --depth 2
npx gitnexus impact RuntimeTestHooks --repo devhub --direction upstream --depth 2 --include-tests
pnpm -C devhub exec eslint src/main/index.ts e2e/example.spec.ts
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "ASSERT_WINDOW_BATCH_7_OPS" --reporter=line --workers=1
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- package.json pnpm-lock.yaml src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/extended.ts src/renderer/types/global.d.ts src/shared/schemas/r8-runtime.ts docs/r8/window-batch.md docs/r8bc-implementation-report.md
git -C devhub diff --check -- src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
git -C devhub diff --check -- src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts docs/r8/window-batch.md docs/r8bc-implementation-report.md
git -C devhub diff --check -- src/renderer/hooks/useBatchSelection.ts src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/LassoSelect.tsx src/renderer/components/monitor/window/ThumbnailWall.tsx src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/window/ThumbnailTile.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
git -C devhub diff --check -- src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
git diff --check -- prompts/0421/contracts/23-ipc-contracts-master.md prompts/0503-2/R8.B/spec-10-window-batch-ops.md prompts/0503-2/_shared/ipc-channels.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
git diff --check -- prompts/0503-2/R8.B/spec-10-window-batch-ops.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
```

Results:

- Targeted batch model and thumbnail wall selection regression passed: 2 files, 8 tests passed, `--maxWorkers=1`.
- Targeted executor, R8 IPC ownership, preload whitelist, and renderer batch model regression passed: 4 files, 39 tests passed, `--maxWorkers=1`.
- Full TypeScript typecheck now passes after the later minimal `src/renderer/components/topology/GraphCanvas.tsx` syntax repair removed the global parser blocker.
- A TypeScript Compiler API diagnostic run over the initial 8 touched TypeScript files passed before the final full typecheck gate.
- Zod SoT verification passed after the IPC/schema extension.
- No-emoji verification passed across 667 files.
- No-cloud and no-OCR dependency verification passed after adding `p-queue`.
- Touched-file ESLint passed for executor, IPC, preload, renderer global type, and shared schema files.
- Targeted diff whitespace checks passed for the files touched by this slice.
- Targeted command palette integration regression passed: 2 files, 2 focused tests passed, `--maxWorkers=1`.
- The command palette test verifies the main-process command emits `monitor-navigate` plus `window-batch-focus-filtered`; the WindowView test dispatches the DOM event after applying a real filter and asserts only the visible HWND is focused.
- Touched-file ESLint passed for the command service, command event bridge, WindowView, and WindowView regression test.
- Targeted persisted alias rename regression passed in `WindowBatchExecutor.test.ts`: one test proves alias persistence before real title mutation, and one test proves rollback on `setWindowTitle` failure.
- Touched-file ESLint and isolated TypeScript diagnostics passed for `WindowBatchExecutor.ts`, `WindowBatchExecutor.test.ts`, `windowHandlers.ts`, and `r8RuntimeHandlers.test.ts`.
- Targeted WM_CHAR arbitrary-text regression passed: `WindowManager.test.ts` asserts `SendText`, `WM_CHAR`, `PostMessage`, target HWND focus, and PowerShell single-quote escaping; `WindowBatchExecutor.test.ts` proves confirmed `args.text` calls `sendTextToWindow()` while safe keys still call `sendKeysToWindow()`.
- Targeted native text injection regression now also proves `WindowManager.sendTextToWindow()` sends arbitrary Unicode text through `SendInput` after focusing the HWND and falls back to `WM_CHAR` if `SendInput` fails.
- Touched-file ESLint and isolated TypeScript diagnostics passed for `WindowManager.ts`, `WindowManager.test.ts`, `WindowBatchExecutor.ts`, `WindowBatchExecutor.test.ts`, and `r8RuntimeHandlers.test.ts`.
- Targeted progress toast regression passed: `windowBatchModel.test.ts` proves incremental progress plus cancelled remaining HWNDs becoming `skipped`; `BatchProgressToast.test.tsx` proves the progress bar, failed HWND detail, cancel button, duplicate-cancel guard, and completion dismiss button.
- Touched-file ESLint and isolated TypeScript diagnostics passed for `windowBatchModel.ts`, `windowBatchModel.test.ts`, `BatchProgressToast.tsx`, `BatchProgressToast.test.tsx`, and `WindowView.tsx`.
- Targeted custom confirmation regression passed: `BatchConfirmDialog.test.tsx` covers close/inject dialog rendering, confirm, Escape cancel, and closed state; `WindowView.test.tsx` proves safe keyboard injection and close-count-above-threshold use the custom dialog instead of `window.confirm`.
- Touched-file ESLint and isolated TypeScript diagnostics passed for `BatchConfirmDialog.tsx`, `BatchConfirmDialog.test.tsx`, `WindowView.tsx`, and `WindowView.test.tsx`.
- Targeted selection regression passed: `useBatchSelection.test.ts` proves Ctrl/Cmd toggle, Shift range, and lasso rectangle merge/replace behavior; `ThumbnailWall.test.tsx` proves wall tiles expose real HWND selection markers and pass Ctrl gesture metadata; `WindowView.test.tsx` proves Ctrl+A selects only the current filter and lasso-selects rendered cards before real batch focus.
- Touched-file ESLint and isolated TypeScript diagnostics passed for the selection hook, lasso component, thumbnail wall/tile, WindowView, and related tests.
- No-emoji verification passed across 674 files after the selection/lasso slice.
- Targeted retry regression passed: `BatchProgressToast.test.tsx` proves completed failed batches expose the retry button and hide it when there are no failures; `WindowView.test.tsx` proves retry uses the last progress results and re-executes only failed HWNDs.
- Touched-file ESLint and isolated TypeScript diagnostics passed for `BatchProgressToast.tsx`, `BatchProgressToast.test.tsx`, `WindowView.tsx`, and `WindowView.test.tsx` after the retry slice.
- No-emoji verification passed across 674 files after the retry slice.
- Touched-file ESLint and isolated TypeScript diagnostics passed for `src/main/ipc/index.ts` and `e2e/example.spec.ts` after the Electron E2E slice.
- `pnpm -C devhub build` now passes after the minimal `src/renderer/components/topology/GraphCanvas.tsx` syntax repair, emitting main, preload, and renderer bundles.
- Electron Playwright E2E passed with 1 real runtime test: the test launches `out/main/index.js`, creates two real Electron `BrowserWindow` probes, scans their real HWNDs through the runtime test hook, runs `window.devhub.windowManager.batchOp({ action: 'minimize' })`, receives `window:batch-progress` through preload, and restores the minimized probes through `batchUndo`.
- Targeted batch-focus regression passed: `WindowManager.test.ts` proves multiple HWNDs are focused through one PowerShell helper invocation and `WindowBatchExecutor.test.ts` proves the executor uses the single batched focus bridge when available.
- Touched-file ESLint and isolated TypeScript diagnostics passed for the batch-focus executor/manager changes and the benchmark script.
- `pnpm -C devhub bench:window-batch` passed against the packaged Electron runtime: 20 real `BrowserWindow` HWNDs, 5 focus samples, p95 4077.2ms under the 5000ms budget.
- GitNexus CLI impact analysis returned LOW risk with 0 direct callers for `DevhubRuntimeTestHooks` and `RuntimeTestHooks` before the assertion hook/type extension.
- Touched-file ESLint passed for `src/main/index.ts` and `e2e/example.spec.ts` after the assertion closure.
- The assertion build passed and emitted main, preload, and renderer bundles.
- `pnpm -C devhub test:e2e --grep "ASSERT_WINDOW_BATCH_7_OPS" --reporter=line --workers=1` passed with 1 real Electron test covering focus, minimize plus undo, close, aot-toggle, screenshot, rename alias/title persistence through the real runtime alias manager, and text injection into the probe textarea.
- `GraphCanvas.tsx` targeted ESLint passed after the syntax repair.
- Full `pnpm -C devhub build` passed after the syntax repair.
- Full `pnpm -C devhub typecheck` passed after the syntax repair.
- Full `pnpm -C devhub lint` passed after the benchmark and build-gate recovery slices, including no-emoji verification over 675 files.
- Final touched-file `git diff --check` gates passed with LF-to-CRLF warnings only.
