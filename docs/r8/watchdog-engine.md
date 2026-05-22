# R8.C Watchdog Engine

## Scope

The R8.C watchdog implementation is a local main-process policy engine plus bounded local collector adapter layer. It tracks registered AI tool instances, collects and accepts real heartbeat records, evaluates liveness with per-phase timeouts, records bounded local history, and decides controlled recovery states.

This document covers the verified policy engine, heartbeat collector adapters, action executor integration, watchdog event stream, 16-instance policy benchmark, and kill/starvation/storm matrix. Subprocess Windows Service UAC execution and packaged kill/orphan E2E remain owned by `spec-17`.

## Heartbeat Sources

`WatchdogEngine` registers the nine source names required by `spec-16`:

- `marker-file`
- `stdout`
- `cpu-pulse`
- `window-title`
- `http-health`
- `fs-activity`
- `hung-window`
- `network`
- `etw`

Each instance stores its own `enabledSources` list. Disabled sources are ignored during heartbeat fusion, so a CPU pulse can be recorded for history without proving liveness when that source is disabled for the instance.

Disabled-source beats are retained in bounded local history with `accepted: false`, but they do not refresh `lastHeartbeatAt` and do not transiently reset a suspect, stuck, or pending instance to `healthy`.

## Collector Adapters

`WatchdogHeartbeatCollector` is the adapter layer between real local signals and `WatchdogEngine.recordHeartbeat()`.

- `marker-file` and `fs-activity` read real filesystem `mtimeMs` values.
- `stdout` uses runtime-supplied parser/stdout timestamps and byte counts.
- `cpu-pulse` reads process CPU data from `SystemInformationAdapter`.
- `window-title` reads visible windows from `Win32WindowEnumerator` and stores only `titleHash` and `titleLength`.
- `http-health` performs a real localhost/loopback-only fetch with a bounded timeout.
- `hung-window` calls Windows `user32.dll` `IsHungAppWindow` through bounded PowerShell P/Invoke.
- `network` reads PID-bound ports from `SystemInformationAdapter`.
- `etw` probes local ETW sessions through `logman` when the process is elevated.

Collector failures are explicit local results and do not fabricate heartbeat success. In a non-elevated Windows session, the ETW adapter returns `E_PERMISSION_DENIED`; on unsupported platforms, Windows-only adapters return `E_UNSUPPORTED_PLATFORM`.

`R8RuntimeService.collectWatchdogHeartbeats()` reads registered watchdog instances, runs the collector, records every real beat into the engine, audits degraded source failures, evaluates the updated status, and emits the existing `watchdog:event-stream` payload.

## Fusion Rules

Lenient mode accepts a single recent enabled source and records the timestamp of the highest-weight recent heartbeat.

Strict mode requires a primary source and either:

- at least two enabled sources in the recent timeout window, or
- one enabled primary source with `weight >= 0.9`.

The current primary sources are `marker-file`, `stdout`, and `http-health`. CPU-only strict heartbeats remain insufficient by design.

## State Machine

The verified policy transition path is:

`healthy -> suspect -> stuck -> restarting | fallback-pending | human-pending`

The engine records local history events for:

- `heartbeat`
- `state-change`
- `action-taken`
- `storm-detected`
- `configure`
- `self-check`
- `manual-restart-override`

These records are a bounded local event history for watchdog decisions. They are not a replacement for future central audit-log rows if later specs require those rows.

## Grace Periods

The default startup grace is 30 seconds. The default restart grace is 60 seconds.

When registration input or the latest heartbeat detail reports `cpuPct > 80` or `ioPct > 80`, the applied grace window is multiplied by `1.5`. This protects instances from being immediately reclassified during known high-load periods while still keeping liveness checks deterministic.

## Restart Storm Control

The restart governor uses a one-hour sliding window. Once restart actions in that window reach `maxRestartsPerHour`, the next restart is rejected and the instance moves to `human-pending` or `fallback-pending`, depending on the configured action policy. A `storm-detected` history event is recorded.

## Feature Flags

- `R8.C.watchdog.engine` is enabled by default.
- `R8.C.watchdog.engine.strict` is disabled by default and can be explicitly enabled by user override.

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/main/services/watchdog/HeartbeatCollector.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "watchdog source adapters|watchdog heartbeat policy|collects real local watchdog"
pnpm -C devhub exec vitest run src/main/services/watchdog/HeartbeatCollector.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "WatchdogHeartbeatCollector|watchdog heartbeat policy|collects real local watchdog"
pnpm -C devhub exec vitest run src/main/services/watchdog/WatchdogEngine.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "watchdog|Watchdog|default disabled states|feature flag"
pnpm -C devhub exec vitest run src/main/services/watchdog/WatchdogEngine.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/watchdog/HeartbeatCollector.ts src/main/services/watchdog/HeartbeatCollector.test.ts src/main/services/watchdog/index.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts --max-warnings=0
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
```

## Open Boundaries

- `spec-17` Windows Service UAC execution remains open because it requires a real elevated service execution path.
- `spec-17` packaged kill/orphan E2E remains open and is not replaced by the spec-16 kill/starvation policy matrix.
- ETW heartbeat collection requires an elevated Windows session; non-elevated sessions must degrade truthfully with `E_PERMISSION_DENIED`.
