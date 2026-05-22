# R8.C Inject Targets

## Scope

`InjectTargetResolver` is the local target-selection and safety gate for R8.C injection. It resolves the requested AI instance from real runtime records supplied by the caller, applies whitelist policy, applies strict-mode confirmation policy, and computes the countdown delay before `InjectService` can proceed.

This document covers the verified resolver, countdown-stream, countdown modal, whitelist cleanup, whitelist drawer, first-time confirmation, SQLite-backed first-time whitelist persistence, and local audit-history slice.

## Target Selectors

The resolver supports these selector contracts:

- `alias`: matches exactly one runtime record by `alias`.
- `ready-pool`: selects the newest record whose `ready` flag is true or whose task-layer `state` is `waiting-input`; `any-<tool>` prefers that tool.
- `csv-row-alias`: resolves only from a CSV/task row alias mapping (`rowAlias`) to an existing runtime alias; it does not silently fall back to the raw instance alias.
- `pid`: requires a concrete `pid` and verifies the resolved alias matches `aliasOrId`.
- `window-handle`: requires a concrete `hwnd` and verifies the resolved alias matches `aliasOrId`.

Selector ambiguity is rejected with `E_VALIDATION`. Missing targets are rejected with `E_NOT_FOUND`.

## Runtime Target Sources

Target records are merged from real runtime sources before the resolver runs:

- Active `AITaskTracker.getActiveTasks()` rows provide live alias, pid, hwnd, tool, task id, monitor state, and readiness timestamp.
- CSV/task-queue rows provide `csv-row-alias` resolution from real queued task rows.
- Whitelist rows still provide fallback instance and `project-cwd` evidence for persisted approvals.
- Compatible rows with the same alias are merged so a whitelist fallback cannot create a false alias collision with a richer active task record.
- The spec-28 three-layer state machine is projected through `StateMachineCoordinator.listStates()`: task-layer `awaiting-input` becomes the resolver's `waiting-input` ready-pool state.

## Safety Gates

The resolver applies layered gates before any injection execution path:

- Whitelist entries are matched by `instance`, `tool`, or normalized `project-cwd` path boundary.
- `project-cwd` matching accepts the exact project path or a descendant path only. Sibling names that merely share a string prefix, such as `D:/Projects/myapp2` for `D:/Projects/myapp`, are rejected.
- Expired matching whitelist entries return `denied-expired`; disabled entries are ignored.
- Manual templates that are not whitelisted return `first-time-needed`.
- Strict mode returns `requires-explicit-confirm` when enabled for the scenario and no `confirmedBy` value is present.
- CSV task-driven injection skips countdown only after whitelist and strict-mode gates both allow the action.

Whitelist hashes use `sha256(scope:normalizedPattern)` so tests and repositories can share a stable lookup key without changing the shared Zod contract.

## Whitelist Cleanup And Audit

`R8RuntimeService` now runs a real cleanup job for whitelist expiry:

- The cleanup job starts with the runtime, runs once at startup, repeats every hour, and is stopped during `dispose()`.
- Expired enabled whitelist entries are marked `enabled=false` instead of being deleted, preserving reviewable history and preventing accidental re-allow.
- `session` duration entries are valid for the current runtime process and are cleaned when encountered from a later runtime startup.
- Cleanup results return the disabled ids, checked timestamp, and disabled count for local verification.
- Runtime history records `whitelist-add`, `whitelist-remove`, `whitelist-expire`, and `strict-mode-block` audit events with whitelist id, scope, pattern hash, confirmer, and reason where available.
- First-time confirmation records `first-time-confirm` and paired `whitelist-add` audit events when the user approves the modal.

## First-Time Confirmation And Whitelist Drawer

First-time injection approval now uses persisted local state rather than an in-memory placeholder:

- `InjectFirstTimeConfirmRepository` stores confirmations in a real SQLite database through `better-sqlite3`.
- Confirmation lookup keys include sha256 alias and scenario hashes, with scenario arrays stored for reviewable evidence.
- `session` confirmations are valid only for the current runtime session; `24h`, `7d`, and `permanent` confirmations follow the shared whitelist duration contract.
- `R8RuntimeService.resolveInjectTarget()` broadcasts `inject:first-time-required` when the first-time gate blocks a request.
- `InjectFirstTimeModal` subscribes to that event, exposes duration and scope choices, and writes approval through `window.devhub.r8.inject.confirmFirstTime()`.
- `InjectWhitelistDrawer` is registered in the existing drawer system and uses the real preload bridge for list, add, remove, and expired-state rendering.

## Countdown Stream

`R8RuntimeService.executeInject()` now performs the countdown controller step before native execution:

- It assigns a stable `actionId` before execution when the caller did not provide one.
- It resolves the real target, whitelist gate, strict-mode gate, and effective `countdownMs` through `InjectTargetResolver`.
- If the target is allowed and `countdownMs > 0`, it emits `inject:countdown-stream` payloads with `scheduled`, `tick`, and `completed` phases before delegating to `InjectService.execute()`.
- Tick payloads use the shared `InjectCountdownStreamPayload` Zod contract and carry `actionId`, `scenario`, `targetAlias`, `totalMs`, `remainingMs`, `elapsedMs`, `emittedAt`, `phase`, and `canCancel`.
- `inject:countdown-cancel` stores the cancellation request. The active countdown loop checks it at the next 100 ms boundary, emits `phase=cancelled`, returns a real `InjectResult` with `status=cancelled`, and does not call native typing.
- `inject:countdown-complete` stores an immediate-completion request. The active countdown loop checks it at the next 100 ms boundary, emits `phase=completed`, and continues into the real execution path.
- The renderer bridge is `window.devhub.r8.inject.onCountdownStream(callback)`, which returns a cleanup function that removes the `ipcRenderer` listener.
- `InjectCountdownModal` subscribes to the same bridge, renders progress plus remaining time, supports ESC cancellation, and uses the immediate-completion bridge for the “立即注入” action.

## Feature Flags

- `R8.C.inject.targets` is enabled by default.
- `R8.C.inject.targets.strict-mode` is disabled by default and can be explicitly enabled by user override.

## Packaged Renderer E2E Closure

`R8.C spec-19` now has a packaged Electron renderer fixture for the first-time target-management flow:

- A real dry-run CSV queued task is created through the preload bridge and resolved as target alias `codex-${taskId}`.
- `inject:resolve-target` reaches the first-time gate and opens `InjectFirstTimeModal` through the runtime event path.
- The modal writes a real `24h` `instance` whitelist confirmation through `inject:first-time-confirm`.
- `R8RuntimeService.confirmInjectFirstTime()` mirrors the confirmed repository entry into the Electron Store fallback after repository confirm, keeping the whitelist visible when packaged `better-sqlite3` cannot load because of Electron ABI mismatch.
- `InjectFirstTimeModal` emits a local whitelist-changed event after successful confirmation, and `InjectWhitelistDrawer` refreshes already-mounted content from the real preload whitelist bridge instead of relying on a stale first load.
- The existing R8.B drawer entry opens `InjectWhitelistDrawer`, which renders the persisted alias from the real whitelist bridge.
- `inject:execute` starts a real countdown stream, and Escape cancellation returns a real cancelled `InjectResult` without calling native injection.

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/main/services/inject/InjectTargetResolver.test.ts src/main/services/inject/InjectService.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/inject/InjectTargetResolver.test.ts src/main/services/inject/InjectService.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "target|Target|inject|Inject|whitelist|strict|countdown|default disabled states|feature flag|preload|IPC|schema"
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "countdown|R8 IPC|injection dry-run"
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "R8.B and R8.C IPC|orchestration result"
pnpm -C devhub exec vitest run src/main/services/inject/InjectTargetResolver.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "InjectTargetResolver|inject whitelist expiry cleanup|injection whitelist"
pnpm -C devhub exec vitest run src/main/services/inject/InjectTargetResolver.test.ts --maxWorkers=1 -t "selector, whitelist scope, and duration matrix|project-cwd|exact alias|ready-pool|csv-row-alias|pid"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "active AI aliases|injection whitelist|first-time|inject whitelist expiry cleanup"
pnpm -C devhub exec vitest run src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "preload whitelist|inject:|countdown|first-time|channel"
pnpm -C devhub exec vitest run src/main/services/inject/InjectFirstTimeConfirmRepository.test.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/inject/InjectSafetyModal.test.tsx --maxWorkers=1 -t "first-time|inject whitelist expiry cleanup|injection whitelist|inject safety UI"
pnpm -C devhub exec eslint src/main/services/inject/InjectFirstTimeConfirmRepository.ts src/main/services/inject/InjectFirstTimeConfirmRepository.test.ts src/main/services/inject/index.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.ts src/shared/schemas/inject.ts src/shared/schemas/r8-runtime.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/App.tsx src/renderer/components/inject/InjectCountdownModal.tsx src/renderer/components/inject/InjectFirstTimeModal.tsx src/renderer/components/inject/InjectWhitelistDrawer.tsx src/renderer/components/inject/InjectSafetyModal.test.tsx src/renderer/components/drawer/drawer-model.ts src/renderer/components/drawer/DrawerContentRegistry.tsx src/renderer/components/drawer/DrawerContentModules.tsx src/renderer/components/monitor/R8OpsPanel.tsx
pnpm -C devhub exec eslint src/main/services/inject/InjectTargetResolver.ts src/main/services/inject/InjectTargetResolver.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts
pnpm -C devhub typecheck
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.C spec-19" --reporter=line --workers=1
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
```

## Open Boundaries

- The resolver matrix covers 4 selector shapes, 3 schema-valid whitelist scopes, and 4 durations. The historical 4-scope wording has been reconciled to the Zod enum rather than adding an invalid fourth scope.
- The spec-19 renderer target-management E2E boundary is closed. Task-start, watchdog restart, and UIA editable-control readback evidence is tracked by the spec-18 inject engine docs.
