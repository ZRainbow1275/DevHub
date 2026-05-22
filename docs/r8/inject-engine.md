# R8.C Inject Engine

## Scope

The current inject engine is a local contract and safety layer for automated text injection. It normalizes actions, resolves targets, selects modes, captures pre-inject screenshots, chunks text, polls foreground focus ownership, routes pty writes through the SHIM control channel, verifies ordinary pty prompt content with real stdout/stderr echo evidence when available, records local audit history in SQLite with store fallback, and fails truthfully when a real execution adapter is unavailable.

This document covers the verified scenario registry, selector, dry-run, countdown-stream, pre/after screenshot capture, chunked-sendinput, foreground focus polling, pty SHIM stdin/control path, pty echo content verification, UIA/Win32 editable-control readback, SQLite audit, failure-diagnosis, task-start trigger, and watchdog restart trigger slice.

## Scenario Registry

`InjectScenarioRegistry` exposes six concrete `ScenarioBase` subclasses:

- `CsvTaskDrivenScenario`
- `WatchdogRestartResumeScenario`
- `TaskChainNextScenario`
- `ErrorRecoveryScenario`
- `UserScheduleScenario`
- `ManualTemplateScenario`

Each scenario provides `prepare(opts)`, `buildAction()`, `onSuccess()`, and `onFailure()` hooks. `InjectService.buildScenarioAction()` routes through the registry, so scenario classes build schema-validated action inputs that the existing dry-run and execute paths can consume.

Scenario defaults encode the current production intent without faking unavailable adapters:

- CSV-driven injection prefers `pty`, falls back to `clipboard-paste` and `sendinput`, and records `confirmedBy=csv-mode`.
- Watchdog restart-resume prefers `pty`, falls back to `uia` and `sendinput`, and appends `[continue]` to the restored prompt when missing.
- Manual template injection remains explicit `sendinput` with `confirmedBy=user-explicit`.

## Mode Selection

`InjectModeSelector` applies deterministic mode selection:

- CLI aliases containing `codex`, `claude`, or `gemini` prefer `pty` unless the caller explicitly requests another non-`sendinput` mode.
- GUI aliases containing `cursor`, `vscode`, or `copilot` prefer `clipboard-paste` when the caller starts from default `sendinput`, with `uia` and `sendinput` fallback.
- Meta commands require `pty` over the SHIM control channel and do not fall back to clipboard or sendinput UI injection.
- Explicit `modeFallback` from the caller is preserved for non-meta commands.

Unavailable mode boundaries fail truthfully:

- `pty` uses the real SHIM control channel for both ordinary prompt stdin writes and meta-command writes. Ordinary prompt writes request stdout/stderr echo verification; meta commands do not require echo because control commands are not guaranteed to echo.
- `uia` uses Windows UIAutomation to locate editable descendants by HWND, writes through `ValuePattern` when available, and falls back to native `WM_SETTEXT` / `WM_GETTEXT` for Win32 `EDIT` child controls that do not expose `ValuePattern`.
- `clipboard-paste` saves the current Electron clipboard text, writes the full action text, sends Ctrl+V through the native keyboard adapter, and restores the original clipboard text.
- `sendinput` only succeeds when the native typer succeeds.

If the native typer reports fewer written characters than requested, the result is downgraded to `partial` with `E_PARTIAL_INJECT`. If a pty SHIM stdin write is acknowledged but the child output does not echo the injected prompt before the bounded verifier timeout, the result is also downgraded to `partial` with `verifiedContentMatches=false`.

## Mode Registry

`InjectModeRegistry` exposes four concrete `IInjectMode` implementations:

- `SendInputMode`
- `PtyMode`
- `UiaMode`
- `ClipboardPasteMode`

`InjectService` routes the selected mode and each fallback mode through the registry. `SendInputMode` delegates to the real chunked native typer pipeline. `ClipboardPasteMode` delegates to the Electron clipboard plus `NutJsAdapter.pressPasteShortcut()` bridge. `PtyMode` sends ordinary prompt and meta-command actions through `ShimRegistry.sendControl()`; ordinary prompt actions require echo verification, while meta-command SHIM failures refuse UI fallback. `UiaMode` requires a real target HWND and fails explicitly on unsupported platforms or targets.

## Pty SHIM Control

`ShimRegistry.sendControl()` uses the existing SHIM frame socket as a bidirectional JSON-line control channel:

- `ShimControlFrame` is registered in the shared R8 Zod schema registry with `type=stdin`, `requestId`, `text`, `appendNewline`, and `ts`.
- `ShimRegistry` tracks live shim sockets per tool, writes stdin control frames to connected clients, and waits for a matching `DEVHUB::MARKER::v=1::CONTROL=<requestId>` frame before returning success.
- When ordinary prompt pty injection requests `verifyEcho=true`, `ShimRegistry` also waits for a real stdout/stderr SHIM frame whose normalized content contains the injected text or all non-empty injected line fragments. DevHub marker frames are ignored for this comparison, so the control ACK cannot be mistaken for content verification.
- If the child stdin write is ACKed but no matching echo arrives before the bounded timeout, the bridge returns `success=true` with `verifiedContentMatches=false` and a verification error. `InjectService` then records a `partial` result instead of falling through to another UI mode that could duplicate the write.
- Generated node shims and the packaged `shim/codex/codex-shim.cjs` source parse reverse socket control frames, write payloads into the real child process stdin, and emit success/error control markers over the same frame stream.
- `R8RuntimeService` wires the inject service bridge to `ShimRegistry.sendControl()`, so runtime pty execution uses the real installed SHIM channel rather than a fixture bridge.
- Meta-command failures do not fall through to clipboard-paste or sendinput, preventing `/devhub:*` or `[continue]` control text from being typed into the foreground UI when the control channel is missing.

## Post-Inject Verification

The implemented post-inject verification branch is the pty echo comparison path named in spec-18.

- Ordinary codex/claude/gemini pty prompt injection sends the text over SHIM stdin with `verifyEcho=true`.
- The verifier listens only to real SHIM stdout/stderr frames emitted by the wrapped child process. It does not use local fixtures, the request ACK marker, or an assumed success state.
- Matching succeeds when the normalized child output contains the injected text or every non-empty injected line fragment.
- A matching echo sets `verifiedContentMatches=true` in the inject result and audit payload.
- An ACKed write without matching echo keeps the real `injectedLength`, captures the after screenshot, persists audit details, and returns `status=partial` with `verifiedContentMatches=false`.
- UIA mode now performs its own readback after writing and returns `verifiedContentMatches` from the actual target value.

## UIA Readback

`UiaMode` is implemented for Windows targets with a real HWND:

- It loads `UIAutomationClient` and `UIAutomationTypes` through the existing bounded PowerShell gateway.
- It starts from the resolved target HWND, walks the raw UIA tree, and selects the first editable `Edit` or `Document` element that supports a real editable pattern.
- If `ValuePattern` is available, it calls `SetValue()` and reads back `Current.Value`.
- If the target is a native Win32 edit control that does not expose `ValuePattern` on this machine, it locates the child `EDIT` window and uses `user32.dll` `WM_SETTEXT` plus `WM_GETTEXT` for real write/readback.
- It returns the real character count and `verifiedContentMatches`; unsupported platforms, missing HWNDs, read-only controls, and non-editable targets fail explicitly.
- The Windows fixture creates a real WinForms TextBox process, captures its HWND, writes through `UiaMode`, and verifies the readback value. The test does not stub UIA or fabricate success.

## Task And Watchdog Triggers

Task queue and watchdog trigger integration now route through the same real inject engine:

- `R8RuntimeService.startReadyTasks()` inspects the real started `TaskRun` rows and triggers injection only when `row.allow_inject === true`.
- The task-start trigger uses scenario `csv-task-driven`, selector `csv-row-alias`, explicit target alias `${tool}-${row.id}`, and the task prompt as the injection text.
- `StoreBackedTaskQueueService.attachInjectAction()` persists the real inject action id on the task run after execution returns, including truthful failed results when adapters are unavailable.
- `WatchdogActionExecutor` restart actions continue to complete the running task into retry state, call `executeInject()` with scenario `watchdog-restart-resume`, store the inject action id in the watchdog action result, and emit the local watchdog notification.
- Explicit `targetAlias` takes precedence over selector row ids during inject action normalization, so audit/history rows show the destination alias instead of the CSV row id.
- The trigger tests intentionally accept truthful adapter failure as evidence of a real attempted inject path; they do not report native success unless the actual adapter succeeds.

## Chunked Sendinput Execution

`sendinput` mode now uses `InjectChunker` during real execution, not only during dry-run planning:

- Each chunk is bounded to 8192 UTF-8 bytes and preserves multi-byte characters.
- The default interval between chunks is 200 ms.
- A focus-safety hook is checked before every chunk. If focus ownership changes between chunks, execution stops with `failureKind=user-stole-focus` and no additional native typing is attempted.
- Successful multi-chunk execution reports the total injected character count and the real `chunkCount`.
- Native short writes remain `status=partial` rather than being counted as successful completion.

## Foreground Focus Polling

`FocusPollingGuard` adds real OS foreground-window polling around executable inject modes:

- Runtime injection wires `foregroundWindowProvider` to `NodeWindowManagerAdapter.getActiveWindow()`, which reuses the installed `node-window-manager@2.2.4` native active-window adapter.
- The polling interval is fixed to 50 ms in `R8RuntimeService`.
- When a resolved target HWND is available, the guard requires the foreground HWND to match it. Otherwise it records the initial foreground HWND as the baseline and aborts if the user switches focus.
- In headless or non-window test paths where no resolved target HWND and no readable foreground baseline exist, the guard yields to the downstream adapter result instead of fabricating a focus-loss failure.
- During `sendinput`, the service checks the guard before and after each native chunk and lets chunk-delay waits end early when a 50 ms poll detects focus loss.
- A focus loss returns a truthful failed inject result with `failureKind=user-stole-focus` and does not fall through to alternate modes.

The guard cannot cancel an already-running native adapter call that does not expose cancellation, but it stops the service immediately after the poll records focus loss and prevents later chunks or fallback modes from running.

## Dry Run Contract

Dry-run mode is a sandbox. It:

- normalizes text to NFC
- computes `sha256(text)`
- chunks the text
- resolves the target
- writes local audit history
- returns a typed inject result
- does not call the native typer
- does not write to a window, terminal, clipboard, or SHIM channel

## Inject Screenshots

`InjectService` captures the before screenshot after target existence, ready-pool, whitelist, and strict-mode gates pass, and before any executable mode writes to a target.

- Runtime injection wires the screenshot bridge to the existing shared `WindowManager.screenshotWindow(hwnd)` path when a `SharedMonitorRuntime.windowManager` is available.
- The bridge uses the resolved target HWND from `InjectTargetResolver`; if the configured screenshot bridge fails, injection stops before native typing and returns a truthful runtime failure.
- After a successful write, the same bridge captures the after screenshot. If the after screenshot fails, the result is downgraded to `partial` with the real injected length rather than being reported as complete success.
- Successful and partial inject results carry `screenshotPathBefore` and, when captured, `screenshotPathAfter`, preserving local audit pointers without embedding image bytes in the inject result.
- Isolated unit tests without a runtime WindowManager leave the bridge as a no-op, so service logic remains testable without creating fake screenshot files.

## Audit Boundary

`InjectAuditRepository` stores append-only local audit records in `%APPDATA%/devhub/inject-audit.sqlite` through `better-sqlite3` when the runtime service configures `auditDbPath`. The existing runtime store remains a bounded fallback for compatibility.

The SQLite table records full text, `sha256(text)`, text length, requested mode, used mode, status, failure kind, target alias, scenario, confirmer, creation time, and the canonical validated payload JSON. The payload JSON now also includes `verifiedContentMatches`, `verificationError`, `screenshotPathBefore`, and `screenshotPathAfter` for post-inject auditability. The table creates indexes on `text_hash`, `created_at`, and `action_id`.

Malformed SQLite payload rows are skipped defensively during reads after schema validation. This prevents one bad persisted row from crashing unrelated audit access while still avoiding fabricated audit entries.

## Failure Diagnosis

`InjectFailureClassifier` exposes two APIs:

- `classify(error)` returns the stable `InjectFailureKind` consumed by `InjectService`.
- `diagnose(error)` returns `failureKind`, `recommendation`, and `retryable` so UI, notifications, and downstream feedback loops can surface concrete operator guidance without inventing a separate mapping.

The verified matrix covers every shared failure kind: `window-not-found`, `window-iconic`, `no-focus`, `input-not-ready`, `user-stole-focus`, `ignored`, `wrong-position`, `encoding-error`, `rate-limited`, `tool-crashed`, `clipboard-conflict`, `permission`, `target-not-found`, `native-disabled`, `shim-not-installed`, and `runtime-error`.

## Feature Flags

- `R8.C.inject.engine` is enabled by default.
- `R8.C.inject.engine.audit-full-content` is enabled by default.
- `R8.C.inject.targets.strict-mode` is disabled by default.

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts src/main/services/inject/InjectTargetResolver.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts src/main/services/inject/InjectTargetResolver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "inject|Inject|default disabled states|feature flag|preload|IPC|schema"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "failure kind|fails truthfully|partial"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "SQLite audit|audit"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "SQLite audit|injection dry-run"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "scenario|SQLite audit"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "mode|fallback|partial|focus"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "clipboard|mode|fallback"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "foreground window|focus ownership|bounded chunks"
pnpm -C devhub exec vitest run src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "control|meta-command|pty"
pnpm -C devhub exec vitest run src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "screenshot|meta-command|fallback|foreground"
pnpm -C devhub exec vitest run src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "control|ordinary pty|meta-command|screenshot|partial"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "task-start inject|allow_inject"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "executes watchdog restart actions through task queue, inject, and notifications"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "UIA"
pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "mode classes|UIA|fails truthfully"
pnpm -C devhub exec eslint src/main/services/shim/ShimRegistry.ts src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.ts src/main/services/inject/InjectService.test.ts src/main/services/inject/InjectAuditRepository.ts src/main/services/inject/modes/IInjectMode.ts src/main/services/inject/modes/PtyMode.ts src/main/services/R8RuntimeService.ts src/shared/schemas/inject.ts
pnpm -C devhub typecheck
```

## Open Boundaries

- Scenario subclasses are implemented as a concrete registry and inheritance tree.
- Real UIA editable-control readback is implemented for Windows HWND targets; ordinary prompt and meta-command pty stdin/control writes are implemented through SHIM.
- Screenshot before/after capture is implemented through the shared WindowManager bridge.
- Post-inject content verification is implemented for SHIM-backed pty prompt echo comparison and UIA editable-control readback.
- Native adapter mid-call cancellation remains limited to adapter support; the service-level 50 ms foreground poll stops later chunks and fallbacks.
- SQLite audit storage is implemented for the full-content local audit DB path and hash index; audit clear/retention UX remains a separate privacy boundary.
- Countdown stream and renderer cancellation UI are implemented through the shared countdown bridge.
- Task-start and watchdog restart trigger integration is implemented. Native adapter success remains environment-dependent and is reported truthfully.
