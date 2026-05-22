# R8.C spec-32 Observability Panel Implementation

## Scope

Continue R8.C from the verified spec-31 IPC rate-limit slice and implement `prompts/0503-2/R8.C/spec-32-observability-panel.md` as an executable, local-only vertical slice.

## Non-Negotiable Constraints

- Preserve all existing functionality, modules, components, routes, IPC contracts, and compatibility wrappers.
- No mock production paths, no simulated telemetry, and no outbound telemetry. The panel must consume local runtime/IPC/OS/service data only.
- Keep implementation incremental and consistent with current DevHub Electron + React + Zod + Vitest style.
- Use existing icon library/components only. Do not introduce emoji glyphs.
- Keep resource usage low while developing and validating. Prefer `--maxWorkers=1` for tests.

## Required Capabilities

- Add a shared Zod source-of-truth for observability metrics, snapshot, config, export request/response, and subscription payloads.
- Add main-process observability services for metric collection, bounded ring-buffer storage, snapshot building, health calculation, configuration, and export.
- Wire IPC/preload/global typing for:
  - `obs:get-snapshot`
  - `obs:configure`
  - `obs:export-snapshot`
  - `obs:subscribe`
  - `obs:export-diagnostic-pack` as a safe bridge to future spec-36 behavior, without fake zip creation.
- Build a renderer observability panel/drawer route that displays current snapshot, 11 metric cards, health issues, a time cursor over 30-minute history, and JSON/CSV export controls.
- Integrate the panel into existing navigation without removing existing monitor or R8 ops surfaces.
- Add tests for schemas/services/IPC/preload/renderer interactions and update docs/spec status after verification.

## Acceptance Criteria

- [x] Snapshot path is real, local, Zod-validated, and returns p95-compatible data without outbound network calls.
- [x] Ring buffer defaults to 30 minutes, supports 5 minutes through 6 hours, and degrades sampling under pressure without crashing.
- [x] Health calculation returns `healthy`, `degraded`, or `unhealthy` based on actual reject-rate/state-violation/counter signals.
- [x] Renderer can drag the time cursor and render historical metric subsets without blocking.
- [x] JSON and CSV snapshot exports write real files and emit audit records.
- [x] IPC subscription limit rejects more than 3 simultaneous subscribers.
- [x] Feature flag `R8.C.observability.panel` is registered/default-on or safely interpreted as enabled when no flag store exists.
- [x] `pnpm typecheck`, lint/no-emoji, targeted tests, and relevant regression tests pass with low concurrency.

## Verification Evidence

- `pnpm typecheck` passed on 2026-05-05.
- `pnpm test --run src/main/services/observability/RingBufferStore.test.ts src/main/services/observability/SnapshotBuilder.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/renderer/views/observability/ObservabilityPanel.test.tsx src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1` passed: 6 files, 68 tests.
- `pnpm test --run src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 --reporter=verbose` passed after hardening cleanup against incomplete test doubles while preserving production `dispose()`.
- `pnpm test --run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1` passed after raising the prompts/0503-2 declared IPC contract baseline to 298 and asserting the `obs:*` registry entries.
- `pnpm test --run --maxWorkers=1` passed: 89 files, 630 tests.
- `pnpm lint`, `pnpm check:no-emoji`, `pnpm check:license`, `git diff --check`, and `git -C .. diff --check` passed on 2026-05-05.
- Trellis `trellis-check` agent dispatch was attempted for spec-32 review, but it failed to resolve the active task and then produced no result after an explicit task-path follow-up; it was closed to protect local resources. Main-thread verification above is the authoritative check evidence.

## Completion Boundary

This task completes spec-32 only. It must not claim completion of all 80 PRD/spec documents, spec-36 diagnostic package internals, packaged Electron network-capture certification, or unrelated R8.C specs.
