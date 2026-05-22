# Crash Recovery Patterns Research

## Sources Consulted

- Grok Search session `aced7c197a0c`: Electron desktop dirty-state recovery UX.
- Grok Search session `f754b8216c69`: SQLite integrity checks, backup, and rollback recovery.
- Context7 `/electron/electron`: app lifecycle events including `will-quit`, `quit`, `window-all-closed`, and early startup hooks.

## Findings

- Desktop recovery UX should only prompt when recoverable dirty state exists. Safe defaults are `restore`, `discard/skip`, and details; startup should continue if the probe is inconclusive.
- Dirty state must be persisted proactively under app-local storage so crash recovery does not depend on in-memory renderer state.
- Electron clean-shutdown markers belong in final app lifecycle events such as `will-quit`/`quit`, while startup probes should run after app readiness without blocking window creation beyond a bounded timeout.
- SQLite recovery should use `PRAGMA integrity_check` for corruption classification. If corruption is detected, restore/cleanup must first create a backup and should not delete WAL/journal files blindly.
- Consistent database snapshots should prefer SQLite backup APIs when a live database connection exists. For this DevHub slice, filesystem snapshots are acceptable for dormant files, with manifests and restore paths validated before mutation.
- Recovery must not silently auto-restart external AI processes. Orphan SHIM cleanup should be explicit, auditable, and PID-targeted.

## Design Consequences for spec-34

- Implement a `RecoveryProbe` orchestration service with a hard timeout and per-scanner isolation.
- Implement a `DirtyStateScanner` that reads real lifecycle, queue, audit, state-machine, store, process, and SQLite artifacts.
- Implement a `RecoveryStrategy` that always creates a pre-recovery snapshot before mutable actions.
- Expose recovery through existing R8 IPC/preload/renderer surfaces and shared Zod schemas.
- Keep all recovery reports local and auditable; do not introduce remote telemetry.
