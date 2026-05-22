# R8.C spec-34 Crash Recovery Implementation

## Scope

Implement `prompts/0503-2/R8.C/spec-34-crash-recovery.md` as a real DevHub vertical slice, building on the verified spec-33 Zod source-of-truth services.

## Non-Negotiable Constraints

- Preserve all existing R8 runtime IPC channels, schemas, preload APIs, renderer views, tests, and compatibility behavior.
- No mock recovery success. Dirty-state findings must come from real persisted files, real process scans, real SQLite integrity probing when a database file exists, or explicit structured fallback errors.
- Do not automatically restart AI subprocesses. Recovery may terminate orphan SHIM processes only when explicitly requested through the recovery action path.
- Recovery actions must create a pre-recovery snapshot before mutating any recoverable state.
- Startup probing must stay bounded and non-blocking: target P95 under 2 seconds, hard timeout under 10 seconds, and degraded findings must not prevent normal app startup.
- Keep validation schema-first through shared Zod contracts; renderer and IPC boundaries must consume those contracts rather than duplicating loose types.
- Keep resource usage low while validating. Use `--maxWorkers=1` for tests.

## Required Capabilities

- Add shared recovery schemas for dirty kinds, findings, snapshots, reports, IPC requests/responses, lifecycle markers, and probe summaries.
- Add main-process recovery services:
  - `DirtyStateScanner`
  - `RecoveryStrategy`
  - `RecoveryProbe`
- Persist and inspect clean-shutdown lifecycle markers in local app data.
- Detect independent dirty findings for:
  - unclean shutdown
  - pending task queue artifacts
  - orphan SHIM processes
  - unsaved store artifacts
  - truncated audit log
  - inconsistent state-machine artifacts
  - SQLite integrity failures
- Wire recovery IPC channels through the existing R8 runtime service and rate-limited handlers:
  - `recovery:check-dirty`
  - `recovery:restore-state`
  - `recovery:list-snapshots`
  - `recovery:create-checkpoint`
  - `recovery:dismiss`
- Add a renderer recovery dialog surface that shows findings, severity, recommended actions, and user choices without deleting or replacing existing R8 Ops surfaces.
- Add real tests for clean startup, dirty detection, snapshot-before-recovery, SQLite integrity failure classification, rollback restore, and probe budget.
- Update spec/docs status with exact validation evidence.

## Acceptance Criteria

- [x] `R8.C.recovery.crash` exists and defaults ON.
- [x] `RecoveryProbe` runs a bounded dirty-state scan and records a validated probe summary.
- [x] Dirty finding scanners are independent: one scanner failure becomes a finding/report entry and does not suppress other scanners.
- [x] `recovery:check-dirty` returns Zod-validated findings from real scanner inputs.
- [x] `recovery:create-checkpoint` creates a real local snapshot manifest with file copies when source files exist.
- [x] `recovery:restore-state` creates a `pre-recovery` snapshot before applying any cleanup/restore action.
- [x] SQLite `PRAGMA integrity_check` is attempted for configured `*.db` files and corruption maps to a critical `sqlite-integrity-fail` finding.
- [x] Orphan SHIM detection is real and conservative: it scans live processes, only targets DevHub SHIM-shaped process metadata, and does not restart subprocesses.
- [x] `RecoveryDialog` renders findings and choices using existing UI/icon libraries, with no emoji.
- [x] Targeted tests, typecheck, lint/no-emoji, license check, and diff whitespace checks pass with low concurrency.

## Implementation Notes

- The implementation should reuse `R8RuntimeService`, `r8RuntimeHandlers`, shared schema registry patterns, and the existing R8 Ops panel surface rather than introducing a parallel IPC stack.
- Snapshot storage should live under local app data or a configurable test root, with manifests validated by Zod.
- Recovery cleanup must be conservative: pending task artifacts can be moved or marked for recovery, but no task may be marked succeeded without a real executor completion path.
- Dismissals should be persisted with a 7-day suppression window for the same finding kind when practical in this slice.

## Completion Boundary

This task completes spec-34 only. It must not claim the full spec-35 backup system, spec-36 diagnostic-pack export, long-run soak testing, or completion of all R8.C specs.

## Implementation Status 2026-05-05

- Added schema-first recovery contracts in `devhub/src/shared/schemas/recovery.ts` and registered them through `devhub/src/shared/schemas/r8-runtime.ts` plus `devhub/src/shared/schemas/index.ts`.
- Added `AppLifecycle`, `DirtyStateScanner`, `RecoveryStrategy`, and `RecoveryProbe` for bounded startup detection, independent dirty scanners, lifecycle markers, local snapshots, rollback restore, and explicit orphan SHIM cleanup.
- Wired recovery through `R8RuntimeService`, `r8RuntimeHandlers`, preload, renderer global types, and the existing `R8OpsPanel` surface without deleting legacy `recovery:scan`, `recovery:report`, or `recovery:dismiss`.
- Added `RecoveryDialog` under `devhub/src/renderer/views/recovery/` using the existing icon library only. The dialog offers restore-all, user checkpoint, and seven-day dismiss choices.
- Added `RecoveryProbe.test.ts` with real temporary directories, real file snapshot/restore, invalid SQLite file classification, orphan SHIM process metadata, and timeout-budget coverage.
- Updated `prompts/0421/contracts/23-ipc-contracts-master.md` and `prompts/0503-2/_shared/ipc-channels.md` so preload whitelist and shared IPC inventory include the spec-34 channels.

## Verification Evidence 2026-05-05

Commands executed from `D:/Desktop/CREATOR ONE` with low resource usage:

```bash
pnpm -C devhub typecheck
pnpm -C devhub test --run src/main/services/recovery/RecoveryProbe.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/recovery/RecoveryProbe.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:license
pnpm -C devhub check:no-emoji
pnpm -C devhub test --run --maxWorkers=1
git -C devhub diff --check
git diff --check
```

Observed results:

- TypeScript typecheck: passed.
- RecoveryProbe targeted test: 1 file passed, 6 tests passed.
- Spec-34 targeted regression suite: 5 files passed, 80 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; no eslint errors and `No emoji found in 444 files`.
- Zod SoT verifier: passed.
- License check: passed; 422 production package entries validated and 1 documented manifest exception retained.
- Full Vitest: 91 files passed, 640 tests passed with `--maxWorkers=1`.
- Final whitespace checks: `git -C devhub diff --check` and `git diff --check` passed. Git reported existing LF-to-CRLF warnings only; no whitespace errors were emitted.
