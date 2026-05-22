# R8.C CSV Launch 3-Way

This document records the implemented boundary for `prompts/0503-2/R8.C/spec-14-csv-launch-3way.md`.

## Runner Paths

- DevHub runner validates a real CSV file, builds a dry-run DAG when requested, enqueues rows through `StoreBackedTaskQueueService`, starts ready tasks, persists `CsvLaunchSession`, emits `csv:session-event-stream`, and mirrors task events to `cli:event-stream`.
- CLI runner generates a `devhub run-csv <file>` command, writes it to Electron clipboard, persists `last-csv-command.txt`, and exposes `scripts/devhub-cli.mjs` through `package.json` `bin.devhub`.
- Python runner is user-controlled by `R8.C.csv.launch.python`, verifies `scripts/devhub-batch.py.sha256`, probes real local Python, opens a Node named-pipe server, spawns `scripts/devhub-batch.py`, and bridges JSON-line events back into DevHub.

## Contracts

- Invoke channels: `csv:launch`, `csv:get-runner-info`, `csv:generate-cli-command`, `csv:pause`, `csv:resume`, `csv:abort`, and `csv:list-sessions`.
- Stream channel: `csv:session-event-stream`.
- Shared schemas: `CsvLaunchOptions`, `CsvLaunchSession`, and `CsvSessionEvent`.
- The preload bridge exposes `getRunnerInfo`, `generateCommand`, `launch`, `pause`, `resume`, `abort`, `listSessions`, and `onSessionEvent`.

## UI Surface

- `CsvLaunchWizard` is mounted in `R8OpsPanel`.
- It provides CSV path entry, runner selection, concurrency, dry-run toggle, CLI command generation, launch, session display, and recent event display.
- The renderer calls preload APIs only; no renderer-side fake launch state is created.

## Safety And Boundaries

- Same-`csvPath` active sessions are rejected with `E_VALIDATION`.
- Python runner remains disabled by default until the user enables `R8.C.csv.launch.python`.
- Python script tampering fails with `E_INTEGRITY_FAIL`.
- DevHub dry-run builds a real DAG snapshot and does not mutate the task queue.
- Python pause/resume over a long-lived bidirectional control pipe is not claimed in this slice; abort is real and kills the child process.

## Verification

- `R8RuntimeService.test.ts` covers CLI command generation, DevHub dry-run DAG, DevHub task start, mutual exclusion, pause/resume/abort, audit rows, event streams, and a real Python child launch through named pipe.
- `CsvCliEntry.test.ts` runs the real Node CLI entry against a local CSV.
- `PythonScriptManager.test.ts` verifies the real script hash and tamper failure.
- `CsvMetadataReader.test.ts` verifies metadata parsing.
- `CsvLaunchWizard.test.tsx` verifies the renderer wizard calls preload APIs and displays generated command/session results.
