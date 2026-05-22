# R8.C CSV Task Driver

This document records the implemented boundary for `prompts/0503-2/R8.C/spec-12-csv-task-driver.md`.

## Scope

- CSV task files live under Electron `userData/tasks` and are loaded by `CsvTaskDriver`.
- The driver validates the 18-column CSV contract, isolates invalid rows, validates referenced SKILL names, and maps valid rows into runtime task rows.
- `inputArgs.prompt` may reference a local skill with `@skill:<name>`; the driver validates the referenced skill before launch and maps the runtime row to that skill while preserving the original prompt text.
- `inputArgs.prompt` supports `{{cwd}}` and `{{file}}` interpolation from `inputArgs.cwd` and `inputFile`; it also supports `@file:<path>` references that read real local text files before launch.
- The driver queues local durable task runs. It does not claim external CLI execution success unless a real downstream executor reports completion.

## Parsing And Encoding

- `CsvParser` uses `papaparse` `NODE_STREAM_INPUT` for file loading, so the driver no longer needs to read an entire CSV file into memory before parsing rows.
- `CsvTaskDriver` probes only a bounded 64 KiB prefix to choose UTF-8, UTF-8 BOM, UTF-16LE BOM, or GB18030 fallback decoding through `iconv-lite`.
- UTF-16BE is rejected with an explicit parse error instead of being silently misread.
- Metadata comments, quoted fields, escaped quotes, CRLF/LF, quoted embedded newlines, and comma-containing fields are preserved by the stream parser before strict 18-column validation.
- Invalid rows stay isolated in `CsvDriverRow.errors`; valid rows in the same file still load and can be queued.
- `CsvTaskDriver.rowHash()` computes `sha256(JSON.stringify(row, Object.keys(row).sort()))`, giving the task queue a deterministic resume key for unchanged runtime rows.
- `@file:<path>` references are resolved relative to `inputArgs.cwd` when present, otherwise relative to the current DevHub process cwd. Each referenced file must exist, be a regular file, and be no larger than 64 KiB.
- Missing, unreadable, directory, or over-budget `@file:` references produce explicit `inputArgs` row errors and prevent runtime row launch.
- Duplicate `taskId` values are rejected for every affected row before runtime rows are created.
- `inputArgs.require_input_file=true` or `inputArgs.requireInputFile=true` turns the CSV `inputFile` value into a required real local file check without changing the 18-column format.
- `inputArgs` and prompt text are scanned for likely API key material such as `sk-...`, `ghp_...`, `api_key=...`, and `Bearer ...`; matching rows fail before launch.

## Watch And Stream

- `CsvFileWatcher` uses chokidar with `persistent=false`, `ignoreInitial=true`, `depth=1`, `atomic=true`, `ignorePermissionErrors=true`, and `awaitWriteFinish.stabilityThreshold=500ms`.
- `csv:reload(force, watch)` can start the watcher and then reload the real CSV root.
- Every reload writes a local audit row with group, row, valid-row, and error counts.
- `csv:row-stream` emits a `CsvRowStreamPayload` with `source`, `emittedAt`, `changedGroupIds`, `removedGroupIds`, and a full reload summary.
- Row stream emission is throttled to 100ms and is exposed through preload as `window.devhub.r8.csv.onRowStream()`.

## IPC And Contracts

- Executable invoke channels include `csv:list-groups`, `csv:get-group`, `csv:reload`, `csv:enqueue-row`, `csv:enqueue-group`, and `csv:export-template`.
- Renderer listener contracts now include `csv:row-stream` and `csv:lock-status-stream`.
- `CsvRowStreamPayload` is registered in the R8 runtime Zod schema registry.
- `R8.C.csv.driver` is default-enabled in the shared feature flag registry.

## Task Queue State Boundary

- `StoreBackedTaskQueueService` enforces explicit task state transitions before persisting a status change.
- Executor completion must happen from `running`; completing a `queued` task now fails with `E_STATE_TRANSITION` instead of creating a false terminal state.
- Manual retry uses the strict `failed -> retrying -> queued` path. Already retrying tasks can move back to `queued`; terminal success, skipped, and cancelled tasks are not retried.
- Automatic retry uses persisted `retryBackoffMs` and `nextRetryAt` fields. Executor failure with retries remaining enters `retrying`; `startReadyTasks()` promotes it back to `queued` only after the backoff window elapses.
- Retry backoff uses base `2000ms`, factor `2`, max `60000ms`, and deterministic SHA256-based jitter within `+/-20%`; manual confirmed retry clears the backoff fields immediately.
- The spec-26 attached-flow regression now starts queued tasks through `startReadyTasks()` before completing them, so flow evidence follows the same state machine as the queue service.

## Task Queue DAG Scheduler

- `StoreBackedTaskQueueService` builds a directed `@dagrejs/dagre` graphlib graph for every enqueue batch.
- Internal batch dependency edges use `dependency -> task`, then `graphlib.alg.topsort()` orders persisted task runs so upstream rows are stored before downstream rows.
- `graphlib.alg.tarjan()` runs before scheduling and rejects strongly connected components with `E_DAG_CYCLE`; self-loops are rejected as `task -> task`.
- External dependencies outside the current enqueue batch are not converted into graph nodes; they remain normal `waiting-dependency` gates resolved by persisted task success or resume-skip state.

## Parallel Group Controller

- `ParallelGroupController` applies semaphore-style permits during `startReadyTasks()`.
- Existing `running` tasks seed each group count before new queued tasks are considered, so already-running work consumes permits.
- `parallelGroupOverrides` supplies per-group limits from CSV metadata or caller policy. Groups without an override remain unlimited except for the global `concurrent` cap.

## Task State Stream

- `task:state-stream` is a real main-to-renderer stream over persisted `taskStateTransitions` generated by the store-backed queue.
- `window.devhub.task.onStateStream(callback)` registers a preload listener and returns a cleanup function.
- Stream payloads contain batched `TaskStateTransition` records and are throttled at the 100ms boundary. This does not claim BetterQueue native event subscription until the BetterQueue adapter lands.

## Task Transition Audit

- Store-backed queue transitions are audited as local security-audit entries when `R8RuntimeService` observes new `taskStateTransitions`.
- Current action mapping covers task start, terminal end, retry scheduling, retry readiness, skip, pause, resume, cancel, and dependency satisfaction.
- Full on_fail branch audit remains open until the dedicated `OnFailHandler` and fallback-tool path exist.

## Task Queue Fixtures

Spec-15 queue fixtures live in `src/main/services/task-queue/fixtures/` and are parsed by `CsvTaskDriver` before queue assertions:

- `dag-5.csv` verifies a five-task dependency graph where only the root starts until dependencies succeed.
- `parallel-group-6.csv` verifies six same-group tasks constrained by a per-group concurrency override.
- `on-fail-retry-3.csv` verifies retry metadata and the explicit retrying path.
- `resume-skip-3.csv` verifies three stable rows can be completed and then skipped by resume when rowHash remains unchanged.

## Verification

- `CsvTaskDriver.test.ts` covers real local CSV loads, deterministic sorted-key SHA256 `rowHash`, strict header errors, duplicate `taskId` rejection, unknown SKILL and missing dependency validation, opt-in real `inputFile` existence checks, likely API key leakage rejection, `@skill:<name>` prompt mapping, missing or malformed prompt skill rejection before launch, `{{cwd}}` / `{{file}}` interpolation, real `@file:` expansion, missing `@file:` rejection before launch, template export, GB18030 decoding, a 1200-row Papa Parse streaming fixture with quoted delimiters/embedded newlines, and CLI command generation.
- `TaskQueueService.test.ts` covers graphlib topological persistence order, Tarjan cycle rejection, retry backoff timing, parallel-group semaphore limits, strict executor completion from `running`, blocked `queued -> failed`, and manual `failed -> retrying -> queued` retry transitions.
- `TaskQueueService.test.ts` also loads the four spec-15 CSV fixtures through `CsvTaskDriver` and verifies DAG gating, parallel group limits, retry, and resume-skip behavior.
- `R8RuntimeService.test.ts` covers `task:state-stream` emission and audit rows for queued -> running and running -> succeeded task transitions.
- `R8RuntimeService.test.ts` covers spec-26 attached-flow evidence with tasks started through the real queue scheduler before completion.
- `R8RuntimeService.test.ts` covers CSV reload/list/enqueue/launch paths, row stream payload emission, and reload audit rows.
- `r8RuntimeHandlers.test.ts` and `preloadContract.test.ts` cover executable IPC and preload whitelist synchronization.
- `r8-runtime.test.ts` covers `CsvRowStreamPayload` schema registration.
- The spec-12 backend driver checklist is closed by local unit/runtime/contract evidence; Electron E2E/UI wizard coverage remains outside this backend driver slice.
