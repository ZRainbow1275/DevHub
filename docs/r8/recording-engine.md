# R8.C Recording Engine

## Scope

The recording engine persists local task evidence under the app user-data recordings directory. It captures append-only event streams and local artifacts for stdout, stdin, filesystem activity, git diff snapshots, screenshot metadata, asciinema export, ZIP export, and replay consumers.

This document covers the verified `RecordingService` and `R8RuntimeService` integration slice. It does not claim task-queue-wide automatic start/stop wiring, a dedicated recording browser UI, 1 GB fixture writes, or packaged Electron screenshot frequency benchmarks.

## Verified Contracts

- `RecordingService.start` creates `recordings/{sessionId}/{taskId}/manifest.json`, stream files, `screenshots/`, and `.archive/`.
- Stdout events are persisted from the runtime CLI parser bridge when a matching session or task recording is active.
- Stdin events are persisted from successful inject execution when a recording association is present.
- Filesystem events use `chokidar` and ignore `node_modules`, `.git`, `.devhub-recordings`, and nested `recordings` directories.
- Git-diff streams write pre-task and post-task diff events plus `git-diff.txt` when the task cwd is a Git repository.
- Per-task quota rotation moves stream files into `.archive/{timestamp}/` and keeps fresh stream files writable.
- Global quota enforcement evicts stopped recordings by least-recently-accessed order.
- Redacted ZIP export masks sensitive text in exported files while leaving source recording artifacts recoverable.
- Asciinema export writes a version-2 `.cast` payload from stdout events.

## Feature Flags

- `R8.C.recording.engine` gates both real and legacy recording session starts.
- `R8.C.recording.engine.screenshot` controls screenshot stream inclusion.
- `R8.C.recording.engine.fs` controls filesystem stream inclusion.
- `R8.C.recording.engine.git-diff` controls git-diff stream inclusion.

## Runtime Integration

The runtime bridge exposes these recording calls:

- `recording:start`
- `recording:stop`
- `recording:list`
- `recording:get-manifest`
- `recording:get-events`
- `recording:get-replay-state`
- `recording:get-events-window`
- `recording:get-cast`
- `recording:list-anchors`
- `recording:get-screenshot`
- `recording:get-fs-snapshot-at`
- `recording:export-asciinema`
- `recording:export-zip`
- `recording:delete`
- `recording:event-stream`

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/shared/feature-flags.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "default disabled states|spec-22 recording|recording engine"
pnpm -C devhub exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1
```

## Open Boundaries

- Dedicated `RecordingSession`, `StdoutStream`, `StdinStream`, `ScreenshotStream`, `GitDiffStream`, `RecordingRotator`, and `Redactor` class/module split remains open.
- Direct `cli:event-stream` and `inject:stream` subscription naming remains open; current runtime integration bridges parser and inject success events.
- Screenshot throttling does not use `p-queue`; current implementation uses a bounded interval timer.
- Git diff uses the local `git` executable, not `simple-git`.
- Audit rows for start, stop, rotate, LRU eviction, and redacted export remain open.
- Full task-queue automatic start/stop wiring, packaged screenshot frequency evidence, and stdout performance budget evidence remain open.
