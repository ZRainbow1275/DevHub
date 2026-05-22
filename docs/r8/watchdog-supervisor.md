# R8.C Watchdog Supervisor

## Scope

The R8.C watchdog supervisor is the main-process boundary for an isolated InnerWatchdog process. The current verified slice is a truthful contract implementation: it creates session and marker artifacts, validates handshake payloads, tracks channel health, exposes supervisor IPC, spawns a configured child entrypoint when present, verifies packaged kill/orphan behavior, and refuses to claim subprocess success when no child entrypoint exists.

This document does not claim Windows Service UAC execution.

## Session And Marker Contract

`WatchdogSupervisor` creates a real 64-character SHA256 session token from the parent PID, timestamp, and random entropy. The marker file contains:

- token prefix
- parent PID
- expected child PID
- marker writer (`parent-supervisor` or `inner-watchdog`)
- protocol version
- named-pipe path
- event-pipe path
- optional TCP port
- update timestamp

The marker file is written under the DevHub user-data watchdog directory. Parent-created marker writes are not accepted as child liveness. Marker fallback liveness requires a valid marker with `writer: "inner-watchdog"`, the current token prefix, and a non-stale `updatedAt`.

## Handshake Rules

`HandshakeProtocol` validates:

- `sessionToken`
- `protocolVersion`
- `parentPid`

Invalid tokens throw `E_PERMISSION_DENIED`. Protocol or parent PID mismatches throw validation errors. This keeps the supervisor from accepting a simulated or unrelated process as a healthy child.

## Channel Health

`MutualHeartbeat` models three channels:

- `named-pipe`
- `tcp-localhost`
- `marker-file`

Any live channel can keep the supervisor reachable, but a healthy named-pipe channel is the only primary healthy state. TCP or marker-only liveness is reported as `degraded`.

`watchdog-supervisor:status` evaluates stale channels before returning the snapshot, so a previously healthy named pipe cannot remain healthy forever without a fresh channel heartbeat.

## Runtime Transport

The parent supervisor now exposes real local transport endpoints:

- `WatchdogSupervisor.startNamedPipeServer()` listens on the session-specific `\\.\pipe\devhub-watchdog-*` named-pipe path and accepts validated InnerWatchdog handshakes plus authenticated JSON-RPC `ping`, `get-status`, and `shutdown` control requests.
- `WatchdogSupervisor.startTcpServer()` binds a loopback-only fallback server on `127.0.0.1:0` and writes the selected port into the marker file for child fallback handshakes.
- `WatchdogSupervisor.pingInnerWatchdog()` reads a fresh `writer: "inner-watchdog"` marker, connects to the child event pipe, sends an authenticated JSON-RPC `ping`, validates the response, and records named-pipe liveness only on a real pong.
- `WatchdogSupervisor.startMutualHeartbeat()` owns the parent-to-child scheduler with a 5000 ms default interval and a 1000 ms timeout. Timer ticks call the real child event-pipe ping path and record failures through `MutualHeartbeat`; they are not accepted as liveness by themselves.
- The long-lived InnerWatchdog runtime listens on the marker-provided event pipe for parent-to-child JSON-RPC. It rejects bad tokens with `E_PERMISSION_DENIED`, maintains a real registered-instance map for `register-instance` / `deregister-instance` / `configure-instance` while attached, refreshes existing instance `lastHeartbeatAt` on heartbeat ticks, and when its parent PID is dead preserves status visibility while refusing new control instructions with `E_ORPHAN_READ_ONLY`.

Unsupported JSON-RPC methods return explicit `E_UNSUPPORTED` errors instead of a successful placeholder response.

## Restart Takeover

When DevHub restarts while an InnerWatchdog child is still alive, `WatchdogSupervisor` preserves the persisted session token only if the stored parent PID is no longer alive. It updates the session parent PID to the new DevHub process, publishes a one-shot parent marker with the new parent PID, and waits for the real child heartbeat loop to re-read that marker, rewrite `writer: "inner-watchdog"`, and handshake with the new parent named-pipe server.

The parent marker write is not treated as child liveness. The supervisor becomes healthy only after the child sends a real channel heartbeat or authenticated response.

## Lifecycle Audit

`R8RuntimeService` emits local audit rows for the packaged InnerWatchdog lifecycle:

- `watchdog-supervisor:spawn` for real spawn attempts that produce a `WatchdogSpawnResult`
- `watchdog-supervisor:respawn` for respawn requests, permission refusals, spawn results, and restart-storm refusals
- `watchdog-supervisor:handshake-fail` for invalid handshakes without recording the full session token
- `watchdog-supervisor:channel-degrade` for failed or degraded channels
- `watchdog-supervisor:orphan` and `watchdog-supervisor:takeover` when a restarted DevHub observes a dead stored parent PID and adopts the existing session

Takeover/orphan audit rows are deduplicated by session token prefix plus evidence string, so repeated status polling does not flood the local audit log.

## Renderer Event Stream

`watchdog-supervisor:event-stream` is the renderer notification channel for the spec-17 supervisor lifecycle. It is a main-to-renderer stream registered under `R8.C.watchdog.subprocess`.

The stream emits `WatchdogSupervisorEventStreamPayload` records for:

- status changes observed by `watchdogSupervisorStatus()`
- respawn refusals and respawn results
- real spawn attempts and heartbeat scheduler start
- Windows Service command-plan refusals
- handshake success and handshake failure
- channel degradation
- orphan and takeover evidence
- dead, fatal, and orphan evaluation results

Each event carries the bounded supervisor status snapshot, audit-style result, code/message/reason/channel/evidence metadata, and only the 8-character session token prefix. The full 64-character session token is never sent to the renderer.

The preload bridge exposes `window.devhub.r8.watchdog.onSupervisorEventStream(callback)` and returns an unsubscribe function. `R8OpsPanel` subscribes to the stream and updates the displayed supervisor state without waiting for the next polling refresh.

## Respawn Governor

Respawn requests require `confirmedBy`. Without a configured child entrypoint, the supervisor returns `E_SPAWN_FAILED` and does not fake success.

Long-lived InnerWatchdog children are spawned without Node `spawn({ timeout })`. The former timeout option acted as a lifetime cap and terminated otherwise healthy children after the startup window. The current lifecycle relies on explicit heartbeat, supervisor state, kill/orphan evaluation, and cleanup code paths.

The governor tracks attempts in a sliding one-hour window:

- attempt 0 delay: 1000 ms
- attempt 1 delay: 2000 ms
- attempt 2 delay: 4000 ms
- attempt 3 delay: 8000 ms
- attempt 4+ delay: 16000 ms

The sixth request inside one hour returns `E_RESTART_STORM`, sets status to `fatal`, and marks `respawnAllowed=false`. Once the one-hour window expires, the attempt count is reduced by the sliding-window filter.

## Windows Service Boundary

`WindowsServiceInstaller` has a real elevated execution path for install and uninstall, but it remains user-controlled:

- `confirmAdmin=true` is required before any Windows Service command is executed.
- The executor uses `sudo-prompt` to request elevation instead of silently running privileged `sc.exe` commands.
- Install/uninstall results are verified through `sc.exe query` before `windowsServiceInstalled` is persisted.
- `WindowsServiceInstaller.ts` imports `execFile` from `node:child_process`, so the `sc.exe query` verification path is covered by strict typecheck instead of relying on an undeclared runtime symbol.
- Non-Windows, unconfirmed, cancelled, failed, and non-admin paths return explicit failure or command-plan states instead of faking service installation.

This session did not execute the live UAC install/uninstall path. The current shell is non-admin and `devhub-watchdog` is not installed, so spec-17 remains partial on that hardware/admin boundary.

Owner evidence for `R8C_SPEC17_WINDOWS_SERVICE_INSTALLED` must use the live application path rather than a paper command plan:

1. Run DevHub from a real Administrator Windows session.
2. Enable the `R8.C.watchdog.subprocess.windows-service` feature flag only for the verification session.
3. Invoke the real preload bridge or equivalent application control path: `window.devhub.watchdog.supervisorInstallService(true, '<real operator identity>')`.
4. Accept the UAC prompt raised by `sudo-prompt`; do not submit a cancelled UAC result, dry-run plan, or hand-written service-name assumption.
5. Rerun `pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json`.
6. Preserve the report showing `admin.isAdministrator=true`, `service.installed=true`, `service.scExitCode=0`, a real `service.status`, and a fresh `generatedAt` timestamp.
7. Rerun `pnpm --silent check:0503-strict:vd-watch`; only that strict gate can close the 0503/R8 completion status.

## E2E Isolation

Packaged Electron E2E tests can set `DEVHUB_USER_DATA_DIR` to a temporary directory. The main process creates the directory and sets Electron `userData` before local stores are initialized. This prevents supervisor session tokens, marker files, and respawn governor state from leaking between the real user profile and isolated E2E runs.

## Feature Flags

- `R8.C.watchdog.subprocess` is enabled by default.
- `R8.C.watchdog.subprocess.windows-service` is disabled by default and can be explicitly enabled by user override.

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "refuses new control instructions in orphan mode"
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "spawns a real node|killed real spawned child|child event pipe|orphan mode|registered instance heartbeat|takes over"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "supports watchdog history"
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "registered instance heartbeat state"
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "takes over an existing InnerWatchdog session"
pnpm -C devhub bench:watchdog-subprocess
pnpm -C devhub typecheck
pnpm -C devhub build
pnpm -C devhub test:e2e e2e/watchdog-subprocess.spec.ts --reporter=line --workers=1
pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/WatchdogSupervisor.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/watchdog-process/main.ts --max-warnings=0
pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/HandshakeProtocol.ts src/main/services/watchdog-supervisor/WatchdogSpawner.ts src/main/index.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts e2e/watchdog-subprocess.spec.ts --max-warnings=0
pnpm -C devhub exec eslint src/watchdog-process/main.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --max-warnings=0
pnpm -C devhub check:zod-sot
pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/WindowsServiceInstaller.ts --max-warnings=0
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "Windows Service"
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/shared/schemas/watchdog-rpc.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "watchdog supervisor|WatchdogSupervisor|watchdog rpc|marker|respawn|Windows Service|default disabled states|feature flag"
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/shared/schemas/watchdog-rpc.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub exec eslint scripts/verify-r8-external-blockers.mjs --max-warnings=0
pnpm -C devhub check:r8-external-blockers
```

## Open Boundaries

- Windows Service UAC install/uninstall remains open because this session did not run an elevated live install/uninstall.
- The current shell reports `admin=false`.
- `sc.exe query devhub-watchdog` reports the service is not installed.
- `check:r8-external-blockers` is expected to exit non-zero until the admin/service and hardware conditions are satisfied.

## Benchmark Evidence

`bench:watchdog-subprocess` runs the built `out/main/watchdog-process/main.js` entrypoint as a real child process, waits for a real `writer: "inner-watchdog"` marker heartbeat, samples RSS and CPU from the real child PID, and enforces the spec budget of RSS < 80 MB and idle CPU < 0.5%.

Latest local result:

```text
BENCH-WATCHDOG-SUBPROCESS PASS rssMb=44.82 cpuPercent=0
```

## External Blocker Evidence

`pnpm -C devhub check:r8-external-blockers` performs a repeatable local check for the remaining non-code gates:

- BrowserWindow second-display placement report from `pnpm -C devhub check:browserwindow-second-display`
- real display count from Windows Forms as supporting environment context
- current admin status
- `devhub-watchdog` Windows Service state through `sc.exe query`
- zero-egress packet capture readiness plus the latest real `devhub-zero-egress-capture-v1` report from `pnpm -C devhub check:zero-egress-capture`
- Windows virtual desktop registry IDs
- foreground-hook opt-in state
- project license file/package metadata plus an explicit legal-decision evidence gate with UTF-8 content checks for AGPL-3.0-or-later, GNU Affero posture, decision or approval language, and legal/product ownership

Use `--write-report <path>` to persist the exact JSON evidence for release review. Latest local evidence reports one renderable Electron/BrowserWindow display, `browserWindowSecondDisplay.valid=false`, two registry virtual desktop IDs, `foregroundHookOptIn=true`, `admin=false`, `devhub-watchdog` not installed, `scExitCode=1060`, zero-egress preflight `windows=true`, `pktmonAvailable=true`, `admin=false`, `preflightExitCode=2`, `zeroEgressCapture.valid=false`, `packageJsonLicense=AGPL-3.0-or-later`, `licenseFileExists=true`, `legalDecisionConfirmed=false`, `legalDecisionEvidenceExists=false`, `legalDecisionEvidenceValid=false`, and `passed=false`. Second-display closure must use `pnpm -C devhub check:browserwindow-second-display` and preserve a real `devhub-browserwindow-second-display-v1` report where the BrowserWindow bounds match a non-primary display. Physical monitor hotplug closure is intentionally separate from static display enumeration and must use `pnpm -C devhub check:physical-monitor-hotplug` with a real two-display baseline, removal observation, and reconnection observation. This is a truthful blocker signal, not a failing code path.
